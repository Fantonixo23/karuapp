import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Kysely, sql } from 'kysely';
import { DatabaseService } from '../database/database.service';
import { countInt } from '../database/agg';
import { DB } from '../database/database.types';
import { EmailService } from '../common/email.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const DOMINIOS_PERMITIDOS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'live.com', 'msn.com', 'protonmail.com', 'mail.com',
];

const CAMPOS_USUARIO = [
  'usuarios.id',
  'usuarios.restaurante_id',
  'usuarios.nombre',
  'usuarios.pin',
  'usuarios.rol',
  'usuarios.email',
  'usuarios.telefono',
  'usuarios.activo',
  'usuarios.verificado',
  'usuarios.ultimo_acceso',
] as const;

const CAMPOS_RESTAURANTE = [
  'restaurantes.id as rest_id',
  'restaurantes.nombre as rest_nombre',
  'restaurantes.slug as rest_slug',
  'restaurantes.activo as rest_activo',
  'restaurantes.plan as rest_plan',
  'restaurantes.estado_licencia as rest_estado_licencia',
  'restaurantes.motivo_bloqueo as rest_motivo_bloqueo',
  'restaurantes.fecha_expiracion as rest_fecha_expiracion',
] as const;

type UsuarioConRestaurante = {
  id: number;
  restaurante_id: number | null;
  nombre: string;
  pin: string | null;
  rol: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  verificado: boolean;
  ultimo_acceso: Date | null;
  rest_id: number | null;
  rest_nombre: string | null;
  rest_slug: string | null;
  rest_activo: boolean | null;
  rest_plan: string | null;
  rest_estado_licencia: string | null;
  rest_motivo_bloqueo: string | null;
  rest_fecha_expiracion: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  /** Usuario + restaurante en una sola query. leftJoin: un superadmin no tiene restaurante. */
  private usuarioConRestaurante(filtro: (qb: any) => any) {
    return this.db.runBypassRls(async (db) =>
      filtro(
        db
          .selectFrom('usuarios')
          .leftJoin('restaurantes', 'restaurantes.id', 'usuarios.restaurante_id')
          .select([...CAMPOS_USUARIO, ...CAMPOS_RESTAURANTE]),
      ).executeTakeFirst() as Promise<UsuarioConRestaurante | undefined>,
    );
  }

  private usuarioPublico(u: UsuarioConRestaurante) {
    return {
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      telefono: u.telefono,
      activo: u.activo,
      restaurante_id: u.rest_id,
      restaurante_slug: u.rest_slug,
      restaurante: u.rest_id
        ? {
            id: u.rest_id,
            nombre: u.rest_nombre,
            slug: u.rest_slug,
            plan: u.rest_plan,
            estado_licencia: u.rest_estado_licencia,
            fecha_expiracion: u.rest_fecha_expiracion,
          }
        : null,
    };
  }

  /** Misma validacion de licencia que se usaba en loginSaas y loginPin. */
  private verificarLicencia(u: UsuarioConRestaurante): void {
    if (!u.rest_id) return;

    if (!u.rest_activo) throw new UnauthorizedException('Restaurante inactivo');
    if (u.rest_estado_licencia === 'pendiente') {
      throw new UnauthorizedException('Sistema pendiente de aprobación. Te contactaremos pronto.');
    }
    if (u.rest_estado_licencia === 'suspendido') {
      throw new UnauthorizedException(`Sistema suspendido. Motivo: ${u.rest_motivo_bloqueo || 'contactá al administrador'}`);
    }
    if (u.rest_fecha_expiracion && u.rest_fecha_expiracion < new Date()) {
      throw new UnauthorizedException(`Sistema suspendido. Motivo: ${u.rest_motivo_bloqueo || 'licencia vencida'}`);
    }
  }

  async loginSaas(email: string, password: string) {
    const usuario = await this.usuarioConRestaurante((qb) =>
      qb.where('usuarios.email', '=', email).where('usuarios.activo', '=', true),
    );

    if (!usuario || !usuario.pin) throw new UnauthorizedException('Credenciales inválidas');

    if (!usuario.verificado) {
      throw new UnauthorizedException('Cuenta no verificada. Revisá tu celular para activarla.');
    }

    if (!(await bcrypt.compare(password, usuario.pin))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.verificarLicencia(usuario);

    const publico = this.usuarioPublico(usuario);
    return {
      success: true,
      access_token: this.generateToken(usuario),
      user: { ...publico, modulo_acceso: this.getModulosAcceso(usuario.rol) },
    };
  }

  async loginPin(pin: string, restauranteSlug?: string) {
    if (!restauranteSlug) throw new BadRequestException('restaurante_slug requerido');
    if (!pin) throw new BadRequestException('PIN requerido');

    const restaurante = await this.db.runBypassRls(async (db) =>
      db.selectFrom('restaurantes').select('id').where('slug', '=', restauranteSlug).executeTakeFirst(),
    );
    if (!restaurante) throw new UnauthorizedException('Restaurante no encontrado');

    // Los PIN se guardan con bcrypt, asi que hay que probar contra cada usuario
    // activo del tenant: no se puede filtrar por el PIN en la query.
    const candidatos = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('usuarios')
        .leftJoin('restaurantes', 'restaurantes.id', 'usuarios.restaurante_id')
        .select([...CAMPOS_USUARIO, ...CAMPOS_RESTAURANTE])
        .where('usuarios.restaurante_id', '=', restaurante.id)
        .where('usuarios.activo', '=', true)
        .execute() as Promise<UsuarioConRestaurante[]>,
    );

    let usuario: UsuarioConRestaurante | null = null;
    for (const candidato of candidatos) {
      if (await this.pinMatches(pin, candidato)) {
        usuario = candidato;
        break;
      }
    }

    if (!usuario) throw new UnauthorizedException('PIN inválido');

    this.verificarLicencia(usuario);

    const token = this.generateToken(usuario);
    await this.db.runBypassRls(async (db) =>
      db.updateTable('usuarios').set({ ultimo_acceso: new Date() }).where('id', '=', usuario!.id).execute(),
    );

    const publico = this.usuarioPublico(usuario);
    return {
      success: true,
      access_token: token,
      user: { ...publico, modulo_acceso: this.getModulosAcceso(usuario.rol) },
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

    const existing = await this.db.runBypassRls(async (db) =>
      db.selectFrom('usuarios').select('id').where('email', '=', data.email).executeTakeFirst(),
    );
    if (existing) throw new ConflictException('El email ya está registrado');

    const hashedPin = await bcrypt.hash(data.password, 10);
    const slug =
      data.restauranteNombre
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + uuidv4().slice(0, 6);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.transaction(async (tx) => {
      const rest = await tx
        .insertInto('restaurantes')
        .values({
          nombre: data.restauranteNombre,
          slug,
          plan: 'estandar',
          fecha_expiracion: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          estado_licencia: 'activo',
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('usuarios')
        .values({
          restaurante_id: rest.id,
          nombre: data.nombre || data.restauranteNombre,
          pin: hashedPin,
          email: data.email,
          telefono: data.telefono ?? null,
          rol: 'administrador',
          activo: true,
          verificado: false,
        })
        .execute();

      await tx
        .insertInto('verification_codes')
        .values({ email: data.email, code, purpose: 'account_activation', expires_at: expiresAt })
        .execute();
    }, { bypassRls: true });

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

    const usuario = await this.db.runBypassRls(async (db) =>
      db
        .updateTable('usuarios')
        .set({ verificado: true, updated_at: new Date() })
        .where('email', '=', email)
        .returning('id')
        .executeTakeFirst(),
    );
    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    const completo = await this.usuarioConRestaurante((qb) => qb.where('usuarios.email', '=', email));
    if (!completo) throw new UnauthorizedException('Usuario no encontrado');

    return {
      success: true,
      access_token: this.generateToken(completo),
      user: this.usuarioPublico(completo),
    };
  }

  async reenviarCodigo(email: string) {
    const usuario = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('usuarios')
        .select('email')
        .where('email', '=', email)
        .where('activo', '=', true)
        .where('verificado', '=', false)
        .executeTakeFirst(),
    );
    if (!usuario?.email) throw new BadRequestException('Cuenta no encontrada o ya verificada');

    this.emailService.assertConfigured();
    await this.invalidateCodes(email, 'account_activation');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.db.runBypassRls(async (db) =>
      db
        .insertInto('verification_codes')
        .values({ email, code, purpose: 'account_activation', expires_at: expiresAt })
        .execute(),
    );

    await this.emailService.sendEmail(email, 'Tu código de activación de karuAPP',
      `Tu código de activación es: ${code}. Válido por 10 minutos.`);

    return { success: true, message: 'Código reenviado' };
  }

  async me(userId: number) {
    const usuario = await this.db.run(async (db) =>
      db
        .selectFrom('usuarios')
        .leftJoin('restaurantes', 'restaurantes.id', 'usuarios.restaurante_id')
        .select([...CAMPOS_USUARIO, ...CAMPOS_RESTAURANTE])
        .where('usuarios.id', '=', userId)
        .executeTakeFirst() as Promise<UsuarioConRestaurante | undefined>,
    );

    if (!usuario) throw new UnauthorizedException('Usuario no encontrado');

    const publico = this.usuarioPublico(usuario);
    return {
      success: true,
      user: {
        ...publico,
        modulo_acceso: this.getModulosAcceso(usuario.rol),
        ultimo_acceso: usuario.ultimo_acceso,
      },
    };
  }

  async olvideContrasena(email: string) {
    this.emailService.assertConfigured();

    const usuario = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('usuarios')
        .select(['id', 'email', 'nombre'])
        .where('email', '=', email)
        .where('activo', '=', true)
        .executeTakeFirst(),
    );

    const generico = { success: true, message: 'Si el email existe, recibirás un código por email' };
    if (!usuario?.email) return generico;
    const emailUsuario = usuario.email;

    await this.invalidateCodes(emailUsuario, 'password_reset');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.runBypassRls(async (db) =>
      db
        .insertInto('verification_codes')
        .values({ email: emailUsuario, code, purpose: 'password_reset', expires_at: expiresAt })
        .execute(),
    );

    await this.emailService.sendEmail(emailUsuario, 'Recuperación de contraseña karuAPP',
      `Tu código de verificación es: ${code}. Válido por 10 minutos.`);

    return generico;
  }

  async verificarCodigo(email: string, code: string) {
    await this.consumeCode(email, 'password_reset', code);
    return { success: true, message: 'Código válido' };
  }

  async restablecerContrasena(email: string, code: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    const record = await this.ultimoCodigoUsado(email, 'password_reset');
    if (!record) throw new BadRequestException('Código inválido, expirado o ya utilizado');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.db.transaction(async (tx) => {
      await tx.updateTable('usuarios').set({ pin: hashed, updated_at: new Date() }).where('email', '=', email).execute();
      await tx.deleteFrom('verification_codes').where('email', '=', email).where('purpose', '=', 'password_reset').execute();
    }, { bypassRls: true });

    return { success: true, message: 'Contraseña actualizada correctamente' };
  }

  async enviar2fa(userId: number) {
    const usuario = await this.db.runBypassRls(async (db) =>
      db.selectFrom('usuarios').select(['id', 'email', 'nombre']).where('id', '=', userId).executeTakeFirst(),
    );
    if (!usuario?.email) throw new UnauthorizedException('Usuario sin email asociado');
    const emailUsuario = usuario.email;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const existing = await this.codigoActivo(emailUsuario, '2fa');
    if (existing?.blocked_until && existing.blocked_until > new Date()) {
      const wait = Math.ceil((existing.blocked_until.getTime() - Date.now()) / 60000);
      throw new BadRequestException(`Demasiados intentos. Esperá ${wait} minutos.`);
    }

    this.emailService.assertConfigured();
    await this.invalidateCodes(emailUsuario, '2fa');

    await this.db.runBypassRls(async (db) =>
      db
        .insertInto('verification_codes')
        .values({ email: emailUsuario, code, purpose: '2fa', expires_at: expiresAt })
        .execute(),
    );

    await this.emailService.sendEmail(emailUsuario, 'Código de verificación karuAPP',
      `Tu código de verificación es: ${code}. Válido por 10 minutos.`);

    return { success: true, message: 'Código enviado a tu email' };
  }

  async verificar2fa(userId: number, code: string) {
    if (!code || code.length !== 6) throw new BadRequestException('Código inválido');

    const usuario = await this.db.runBypassRls(async (db) =>
      db.selectFrom('usuarios').select(['id', 'email']).where('id', '=', userId).executeTakeFirst(),
    );
    if (!usuario?.email) throw new UnauthorizedException('Usuario sin email asociado');

    const record = await this.codigoActivo(usuario.email, '2fa');
    if (!record) throw new BadRequestException('Primero solicitá un código');

    if (record.blocked_until && record.blocked_until > new Date()) {
      throw new BadRequestException('Demasiados intentos. Esperá unos minutos.');
    }

    const totalAttempts = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('verification_codes')
        .select(() => countInt())
        .where('email', '=', usuario.email)
        .where('purpose', '=', '2fa')
        .where('created_at', '>=', new Date(Date.now() - 30 * 60 * 1000))
        .executeTakeFirst(),
    );

    if ((totalAttempts?.c ?? 0) > 10) {
      await this.bloquearCodigo(record.id, 60 * 60 * 1000);
      throw new BadRequestException('Demasiados intentos. Acceso bloqueado por 1 hora.');
    }

    if (code !== record.code) {
      await this.db.runBypassRls(async (db) =>
        db
          .updateTable('verification_codes')
          .set({ attempts: sql`attempts + 1` })
          .where('id', '=', record.id)
          .execute(),
      );

      if (record.attempts + 1 >= 5) {
        await this.bloquearCodigo(record.id, 15 * 60 * 1000);
        throw new BadRequestException('Código incorrecto. Bloqueado por 15 minutos.');
      }
      throw new BadRequestException(`Código incorrecto. Intentos restantes: ${4 - record.attempts}`);
    }

    await this.db.runBypassRls(async (db) =>
      db.updateTable('verification_codes').set({ used: true }).where('id', '=', record.id).execute(),
    );

    return { success: true, message: 'Verificación exitosa' };
  }

  private async bloquearCodigo(id: number, ms: number): Promise<void> {
    await this.db.runBypassRls(async (db) =>
      db
        .updateTable('verification_codes')
        .set({ blocked_until: new Date(Date.now() + ms) })
        .where('id', '=', id)
        .execute(),
    );
  }

  /** Codigo vigente (no usado, no expirado) mas reciente. */
  private async codigoActivo(email: string, purpose: string) {
    return this.db.runBypassRls(async (db) =>
      db
        .selectFrom('verification_codes')
        .selectAll()
        .where('email', '=', email)
        .where('purpose', '=', purpose)
        .where('used', '=', false)
        .where('expires_at', '>=', new Date())
        .orderBy('created_at', 'desc')
        .executeTakeFirst(),
    );
  }

  /** Ultimo codigo ya validado, para el paso final del reset de contrasena. */
  private async ultimoCodigoUsado(email: string, purpose: string) {
    return this.db.runBypassRls(async (db) =>
      db
        .selectFrom('verification_codes')
        .selectAll()
        .where('email', '=', email)
        .where('purpose', '=', purpose)
        .where('used', '=', true)
        .where('expires_at', '>=', new Date())
        .orderBy('created_at', 'desc')
        .executeTakeFirst(),
    );
  }

  private async pinMatches(pin: string, usuario: { id: number; pin: string | null }): Promise<boolean> {
    const stored = usuario.pin;
    if (!stored) return false;

    if (!/^\$2[aby]?\$/.test(stored)) {
      if (stored !== pin) return false;
      const rehashed = await bcrypt.hash(pin, 10);
      await this.db.runBypassRls(async (db) =>
        db.updateTable('usuarios').set({ pin: rehashed }).where('id', '=', usuario.id).execute(),
      );
      return true;
    }

    return bcrypt.compare(pin, stored);
  }

  private async invalidateCodes(email: string, purpose: string): Promise<void> {
    await this.db.runBypassRls(async (db) =>
      db.deleteFrom('verification_codes').where('email', '=', email).where('purpose', '=', purpose).where('used', '=', false).execute(),
    );
  }

  private async consumeCode(email: string, purpose: string, code: string, maxAttempts = 5) {
    if (!code) throw new BadRequestException('Código requerido');

    const record = await this.codigoActivo(email, purpose);
    if (!record) throw new BadRequestException('Código inválido o expirado');

    if (record.blocked_until && record.blocked_until > new Date()) {
      const wait = Math.max(1, Math.ceil((record.blocked_until.getTime() - Date.now()) / 60000));
      throw new BadRequestException(`Demasiados intentos. Esperá ${wait} minutos.`);
    }

    if (record.code !== code) {
      const attempts = record.attempts + 1;
      const exhausted = attempts >= maxAttempts;

      await this.db.runBypassRls(async (db) =>
        db
          .updateTable('verification_codes')
          .set({
            attempts,
            ...(exhausted ? { blocked_until: new Date(Date.now() + 15 * 60 * 1000) } : {}),
          })
          .where('id', '=', record.id)
          .execute(),
      );

      if (exhausted) {
        throw new BadRequestException('Demasiados intentos. Intentá de nuevo en 15 minutos.');
      }
      throw new BadRequestException(`Código incorrecto. Intentos restantes: ${maxAttempts - attempts}`);
    }

    await this.db.runBypassRls(async (db) =>
      db.updateTable('verification_codes').set({ used: true }).where('id', '=', record.id).execute(),
    );

    return record;
  }

  private generateToken(usuario: UsuarioConRestaurante): string {
    const payload: JwtPayload = {
      sub: usuario.id,
      restauranteId: usuario.restaurante_id ?? null,
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
