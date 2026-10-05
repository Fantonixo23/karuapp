import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../common/email.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const DOMINIOS_PERMITIDOS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'live.com', 'msn.com', 'protonmail.com', 'mail.com',
];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async loginSaas(email: string, password: string) {
    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findFirst({
        where: { email, activo: true },
        include: { restaurante: true },
      }),
    );

    if (!usuario || !usuario.pin) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.verificado) {
      throw new UnauthorizedException('Cuenta no verificada. Revisá tu celular para activarla.');
    }

    const isMatch = await bcrypt.compare(password, usuario.pin);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (usuario.restaurante) {
      const r = usuario.restaurante;
      if (!usuario.restaurante.activo) {
        throw new UnauthorizedException('Restaurante inactivo');
      }
      if (r.estadoLicencia === 'pendiente') {
        throw new UnauthorizedException('Sistema pendiente de aprobación. Te contactaremos pronto.');
      }
      if (r.estadoLicencia === 'suspendido') {
        throw new UnauthorizedException(`Sistema suspendido. Motivo: ${r.motivoBloqueo || 'contactá al administrador'}`);
      }
      if (r.fechaExpiracion && r.fechaExpiracion < new Date()) {
        throw new UnauthorizedException(`Sistema suspendido. Motivo: ${r.motivoBloqueo || 'licencia vencida'}`);
      }
    }

    const token = this.generateToken(usuario);

    return {
      success: true,
      access_token: token,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        restaurante_id: usuario.restaurante?.id ?? null,
        restaurante_slug: usuario.restaurante?.slug ?? null,
        restaurante: usuario.restaurante
          ? { id: usuario.restaurante.id, nombre: usuario.restaurante.nombre, slug: usuario.restaurante.slug }
          : null,
      },
    };
  }

  async loginPin(pin: string, restauranteSlug?: string) {
    if (!restauranteSlug) {
      throw new BadRequestException('restaurante_slug requerido');
    }
    if (!pin) {
      throw new BadRequestException('PIN requerido');
    }

    const restaurante = await this.prisma.bypassRls<any>((tx) =>
      tx.restaurante.findUnique({
        where: { slug: restauranteSlug },
        select: { id: true },
      }),
    );
    if (!restaurante) throw new UnauthorizedException('Restaurante no encontrado');

    const candidatos = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findMany({
        where: { restauranteId: restaurante.id, activo: true },
        include: { restaurante: true },
      }),
    );

    let usuario: any = null;
    for (const candidato of candidatos) {
      if (await this.pinMatches(pin, candidato)) {
        usuario = candidato;
        break;
      }
    }

    if (!usuario) {
      throw new UnauthorizedException('PIN inválido');
    }

    if (usuario.restaurante) {
      const r = usuario.restaurante;
      if (!r.activo) {
        throw new UnauthorizedException('Restaurante inactivo');
      }
      if (r.estadoLicencia === 'pendiente') {
        throw new UnauthorizedException('Sistema pendiente de aprobación. Te contactaremos pronto.');
      }
      if (r.estadoLicencia === 'suspendido') {
        throw new UnauthorizedException(`Sistema suspendido. Motivo: ${r.motivoBloqueo || 'contactá al administrador'}`);
      }
      if (r.fechaExpiracion && r.fechaExpiracion < new Date()) {
        throw new UnauthorizedException(`Sistema suspendido. Motivo: ${r.motivoBloqueo || 'licencia vencida'}`);
      }
    }

    const token = this.generateToken(usuario);
    await this.prisma.withTenant().usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcceso: new Date() },
    });

    return {
      success: true,
      access_token: token,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        rol: usuario.rol,
        modulo_acceso: this.getModulosAcceso(usuario.rol),
        restaurante_id: usuario.restaurante?.id ?? null,
        restaurante_slug: usuario.restaurante?.slug ?? null,
        restaurante: usuario.restaurante
          ? { id: usuario.restaurante.id, nombre: usuario.restaurante.nombre, slug: usuario.restaurante.slug }
          : null,
      },
    };
  }

  async registerSaas(data: {
    email: string;
    password: string;
    nombre: string;
    restauranteNombre: string;
    telefono?: string;
  }) {
    if (!data.email) throw new BadRequestException('Email requerido');
    const dominio = data.email.split('@')[1]?.toLowerCase();
    if (!dominio || !DOMINIOS_PERMITIDOS.includes(dominio)) {
      throw new BadRequestException('Usá un email de Gmail, Hotmail, Outlook, Yahoo o iCloud');
    }

    if (!data.password || data.password.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    this.emailService.assertConfigured();

    const existing = await this.prisma.bypassRls((tx) =>
      tx.usuario.findFirst({ where: { email: data.email }, select: { id: true } }),
    );
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const hashedPin = await bcrypt.hash(data.password, 10);
    const slug = data.restauranteNombre
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + uuidv4().slice(0, 6);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const { restaurante, usuario } = await this.prisma.bypassRls(async (tx) => {
      const rest = await tx.restaurante.create({
        data: {
          nombre: data.restauranteNombre,
          slug,
          plan: 'estandar',
          fechaExpiracion: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          estadoLicencia: 'activo',
        },
      });
      const user = await tx.usuario.create({
        data: {
          restauranteId: rest.id,
          nombre: data.nombre || data.restauranteNombre,
          pin: hashedPin,
          email: data.email,
          telefono: data.telefono,
          rol: 'administrador',
          activo: true,
          verificado: false,
        },
      });
      await tx.verificationCode.create({
        data: { email: data.email, code, purpose: 'account_activation', expiresAt },
      });
      return { restaurante: rest, usuario: user };
    });

    await this.emailService.sendEmail(data.email, 'Activá tu cuenta en karuAPP',
      `Tu código de activación es: ${code}. Válido por 10 minutos.`);

    return {
      success: true,
      message: 'Cuenta creada. Revisá tu email para activarla.',
      user: { email: data.email },
    };
  }

  async verificarCuenta(email: string, code: string) {
    await this.consumeCode(email, 'account_activation', code);

    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.update({
        where: { email },
        data: { verificado: true },
        include: { restaurante: true },
      }),
    );

    const token = this.generateToken(usuario);

    return {
      success: true,
      access_token: token,
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol,
        telefono: usuario.telefono,
        restaurante_id: usuario.restaurante?.id ?? null,
        restaurante_slug: usuario.restaurante?.slug ?? null,
        restaurante: usuario.restaurante
          ? { id: usuario.restaurante.id, nombre: usuario.restaurante.nombre, slug: usuario.restaurante.slug }
          : null,
      },
    };
  }

  async reenviarCodigo(email: string) {
    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findFirst({
        where: { email, activo: true, verificado: false },
        select: { email: true },
      }),
    );
    if (!usuario) throw new BadRequestException('Cuenta no encontrada o ya verificada');

    this.emailService.assertConfigured();

    await this.invalidateCodes(email, 'account_activation');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.create({
        data: { email, code, purpose: 'account_activation', expiresAt },
      }),
    );

    await this.emailService.sendEmail(email, 'Tu código de activación de karuAPP',
      `Tu código de activación es: ${code}. Válido por 10 minutos.`);

    return {
      success: true,
      message: 'Código reenviado',
    };
  }

  async me(userId: number) {
    const usuario = await this.prisma.withTenant().usuario.findUnique({
      where: { id: userId },
      include: { restaurante: true },
    });

    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    return {
      success: true,
      user: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        telefono: usuario.telefono,
        activo: usuario.activo,
        modulo_acceso: this.getModulosAcceso(usuario.rol),
        ultimo_acceso: usuario.ultimoAcceso,
        restaurante: usuario.restaurante ? {
          id: usuario.restaurante.id,
          nombre: usuario.restaurante.nombre,
          slug: usuario.restaurante.slug,
          plan: usuario.restaurante.plan,
          estado_licencia: usuario.restaurante.estadoLicencia,
          fecha_expiracion: usuario.restaurante.fechaExpiracion,
        } : null,
      },
    };
  }

  async olvideContrasena(email: string) {
    this.emailService.assertConfigured();

    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findFirst({
        where: { email, activo: true },
        select: { id: true, email: true, nombre: true },
      }),
    );
    if (!usuario) {
      return { success: true, message: 'Si el email existe, recibirás un código por email' };
    }

    await this.invalidateCodes(usuario.email, 'password_reset');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.create({
        data: { email: usuario.email, code, purpose: 'password_reset', expiresAt },
      }),
    );

    await this.emailService.sendEmail(usuario.email, 'Recuperación de contraseña karuAPP',
      `Tu código de verificación es: ${code}. Válido por 10 minutos.`);

    return { success: true, message: 'Si el email existe, recibirás un código por email' };
  }

  async verificarCodigo(email: string, code: string) {
    await this.consumeCode(email, 'password_reset', code);

    return { success: true, message: 'Código válido' };
  }

  async restablecerContrasena(email: string, code: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    const record = await this.prisma.bypassRls<any>((tx) =>
      tx.verificationCode.findFirst({
        where: { email, code, purpose: 'password_reset', used: true, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    if (!record) throw new BadRequestException('Código inválido, expirado o ya utilizado');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.bypassRls(async (tx) => {
      await tx.usuario.update({
        where: { email },
        data: { pin: hashed },
      });
      await tx.verificationCode.deleteMany({ where: { email, purpose: 'password_reset' } });
    });

    return { success: true, message: 'Contraseña actualizada correctamente' };
  }

  async enviar2fa(userId: number) {
    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findUnique({
        where: { id: userId },
        select: { id: true, email: true, nombre: true },
      }),
    );
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const existing = await this.prisma.bypassRls<any>((tx) =>
      tx.verificationCode.findFirst({
        where: { email: usuario.email, purpose: '2fa', used: false, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    if (existing && existing.blockedUntil && existing.blockedUntil > new Date()) {
      const wait = Math.ceil((existing.blockedUntil.getTime() - Date.now()) / 60000);
      throw new BadRequestException(`Demasiados intentos. Esperá ${wait} minutos.`);
    }

    this.emailService.assertConfigured();
    await this.invalidateCodes(usuario.email, '2fa');

    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.create({
        data: { email: usuario.email, code, purpose: '2fa', expiresAt },
      }),
    );

    await this.emailService.sendEmail(usuario.email, 'Código de verificación karuAPP',
      `Tu código de verificación es: ${code}. Válido por 10 minutos.`);

    return { success: true, message: 'Código enviado a tu email' };
  }

  async verificar2fa(userId: number, code: string) {
    if (!code || code.length !== 6) throw new BadRequestException('Código inválido');

    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      }),
    );
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    const record = await this.prisma.bypassRls<any>((tx) =>
      tx.verificationCode.findFirst({
        where: { email: usuario.email, purpose: '2fa', used: false, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    );

    if (!record) throw new BadRequestException('Primero solicitá un código');

    if (record.blockedUntil && record.blockedUntil > new Date()) {
      throw new BadRequestException('Demasiados intentos. Esperá unos minutos.');
    }

    const totalAttempts = await this.prisma.bypassRls<any>((tx) =>
      tx.verificationCode.count({
        where: { email: usuario.email, purpose: '2fa', createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
      }),
    );

    if (totalAttempts > 10) {
      const blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
      await this.prisma.bypassRls((tx) =>
        tx.verificationCode.update({ where: { id: record.id }, data: { blockedUntil } }),
      );
      throw new BadRequestException('Demasiados intentos. Acceso bloqueado por 1 hora.');
    }

    if (code !== record.code) {
      await this.prisma.bypassRls((tx) =>
        tx.verificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } }),
      );
      if (record.attempts + 1 >= 5) {
        const blockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await this.prisma.bypassRls((tx) =>
          tx.verificationCode.update({ where: { id: record.id }, data: { blockedUntil } }),
        );
        throw new BadRequestException('Código incorrecto. Bloqueado por 15 minutos.');
      }
      throw new BadRequestException(`Código incorrecto. Intentos restantes: ${4 - record.attempts}`);
    }

    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.update({ where: { id: record.id }, data: { used: true } }),
    );

    return { success: true, message: 'Verificación exitosa' };
  }

  private async pinMatches(pin: string, usuario: { id: number; pin: string | null }): Promise<boolean> {
    const stored = usuario.pin;
    if (!stored) return false;

    if (!/^\$2[aby]?\$/.test(stored)) {
      if (stored !== pin) return false;
      const rehashed = await bcrypt.hash(pin, 10);
      await this.prisma.bypassRls((tx) =>
        tx.usuario.update({
          where: { id: usuario.id },
          data: { pin: rehashed },
        }),
      );
      return true;
    }

    return bcrypt.compare(pin, stored);
  }

  private async invalidateCodes(email: string, purpose: string): Promise<void> {
    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.deleteMany({ where: { email, purpose, used: false } }),
    );
  }

  private async consumeCode(email: string, purpose: string, code: string, maxAttempts = 5) {
    if (!code) throw new BadRequestException('Código requerido');

    const record = await this.prisma.bypassRls<any>((tx) =>
      tx.verificationCode.findFirst({
        where: { email, purpose, used: false, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    if (!record) throw new BadRequestException('Código inválido o expirado');

    if (record.blockedUntil && record.blockedUntil > new Date()) {
      const wait = Math.max(1, Math.ceil((record.blockedUntil.getTime() - Date.now()) / 60000));
      throw new BadRequestException(`Demasiados intentos. Esperá ${wait} minutos.`);
    }

    if (record.code !== code) {
      const attempts = record.attempts + 1;
      const exhausted = attempts >= maxAttempts;
      await this.prisma.bypassRls((tx) =>
        tx.verificationCode.update({
          where: { id: record.id },
          data: {
            attempts,
            ...(exhausted ? { blockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {}),
          },
        }),
      );
      if (exhausted) {
        throw new BadRequestException('Demasiados intentos. Intentá de nuevo en 15 minutos.');
      }
      throw new BadRequestException(`Código incorrecto. Intentos restantes: ${maxAttempts - attempts}`);
    }

    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.update({ where: { id: record.id }, data: { used: true } }),
    );

    return record;
  }

  private generateToken(usuario: any): string {
    const payload: JwtPayload = {
      sub: usuario.id,
      restauranteId: usuario.restauranteId ?? null,
      rol: usuario.rol,
      nombre: usuario.nombre,
    };
    return this.jwtService.sign(payload);
  }

  private getModulosAcceso(rol: string): string[] {
    const map: Record<string, string[]> = {
      administrador: ['mesas', 'cocina', 'caja', 'delivery', 'informes', 'productos', 'inventario', 'funcionarios', 'configuracion'],
      cajero: ['mesas', 'caja', 'delivery', 'cocina'],
      mesero: ['mesas', 'cocina'],
      cocina: ['cocina'],
    };
    return map[rol] || [];
  }
}
