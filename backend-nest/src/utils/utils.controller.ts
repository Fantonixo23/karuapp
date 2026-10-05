import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as os from 'os';

@Controller('api')
export class UtilsController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('info')
  async infoEmpresa() {
    const config = await this.prisma.withTenant().configuracion.findFirst();
    return {
      empresa: config?.nombreEmpresa || 'karuAPP',
      ruc: config?.ruc || '5418755-8',
      version: '2.0.0',
    };
  }

  @Get('verificar-suscripcion')
  async verificarSuscripcion(@CurrentUser('restauranteId') rid: number) {
    const rest = await this.prisma.withTenant().restaurante.findUnique({ where: { id: rid } });
    if (!rest) return { estado: 'bloqueada', dias_restantes: 0, mensaje: 'Restaurante no encontrado' };

    const ahora = new Date();
    const expirado = rest.fechaExpiracion && rest.fechaExpiracion < ahora;
    const estado = expirado ? 'bloqueada' : rest.estadoLicencia;
    const dias = rest.fechaExpiracion
      ? Math.max(0, Math.floor((rest.fechaExpiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    return { estado, dias_restantes: dias, mensaje: estado === 'activo' ? 'Licencia activa' : 'Licencia expirada' };
  }

  @Public()
  @Get('obtener-ip')
  async obtenerIp() {
    const interfaces = os.networkInterfaces();
    const ips: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    return { ip: ips[0] || '127.0.0.1', ips, hostname: os.hostname(), urls: ips.map(ip => `http://${ip}:3000`) };
  }

  @Public()
  @Get('verificar-licencia')
  async verificarLicencia() {
    return { success: true, licencia_valida: true, estado: 'activo', dias_restantes: 365, mensaje: 'Licencia activa' };
  }

  @Public()
  @Get('print-token')
  async printToken() {
    return { success: true, token: process.env.PRINT_API_TOKEN || 'karuapp-print-token' };
  }

  @Public()
  @Get('qr-conexion')
  async qrConexion() {
    const hostname = os.hostname();
    const interfaces = os.networkInterfaces();
    let ip = '127.0.0.1';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ip = iface.address;
          break;
        }
      }
    }
    return { hostname, ips: [ip], urls: [`http://${ip}:3000`], url_principal: `http://${ip}:3000`, qr_base64: null };
  }

  @Get('backup')
  async backupStatus() {
    return { ok: true, backups: [], total: 0 };
  }

  @Post('backup/run')
  async backupRun() {
    return { ok: true, message: 'Backup no implementado en cloud' };
  }

  @Post('auth/send-owner-code')
  async sendOwnerCode(@Body() body: { email: string }) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.withTenant().verificationCode.create({
      data: {
        email: body.email,
        code,
        purpose: 'owner_access',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { success: true, message: 'Código enviado (simulado)', code };
  }

  @Post('auth/verify-owner-code')
  async verifyOwnerCode(@Body() body: { email: string; code: string }) {
    const vc = await this.prisma.withTenant().verificationCode.findFirst({
      where: { email: body.email, code: body.code, purpose: 'owner_access', used: false, expiresAt: { gte: new Date() } },
    });
    if (!vc) return { success: false, error: 'Código inválido o expirado' };
    await this.prisma.withTenant().verificationCode.update({ where: { id: vc.id }, data: { used: true } });
    return { success: true, verified: true };
  }

  @Public()
  @Post('auth/forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.withTenant().verificationCode.create({
      data: {
        email: body.email,
        code,
        purpose: 'password_reset',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { success: true, message: 'Código enviado al email (simulado)', code };
  }

  @Public()
  @Post('auth/verify-reset-code')
  async verifyResetCode(@Body() body: { email: string; code: string }) {
    const vc = await this.prisma.withTenant().verificationCode.findFirst({
      where: { email: body.email, code: body.code, purpose: 'password_reset', used: false, expiresAt: { gte: new Date() } },
    });
    if (!vc) return { success: false, error: 'Código inválido o expirado' };
    await this.prisma.withTenant().verificationCode.update({ where: { id: vc.id }, data: { used: true } });
    return { success: true, verified: true };
  }

  @Get('mobile/funcionarios/:slug')
  async funcionariosMobile(@Param('slug') slug: string) {
    const rest = await this.prisma.withTenant().restaurante.findUnique({ where: { slug } });
    if (!rest) return { success: false, error: 'Restaurante no encontrado' };

    const funcionarios = await this.prisma.withTenant().usuario.findMany({
      where: { restauranteId: rest.id, activo: true },
      select: { id: true, nombre: true, pin: true, rol: true },
    });
    return { success: true, funcionarios };
  }

  @Get('usuarios')
  async listarUsuarios(@CurrentUser('restauranteId') rid: number) {
    const usuarios = await this.prisma.withTenant().usuario.findMany({
      where: { restauranteId: rid },
      select: { id: true, nombre: true, rol: true, telefono: true, email: true, activo: true, ultimoAcceso: true },
      orderBy: { nombre: 'asc' },
    });
    return { success: true, usuarios };
  }
}
