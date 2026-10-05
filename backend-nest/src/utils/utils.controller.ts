import { Controller, Get, Post, Param } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as os from 'os';

@Controller('api')
export class UtilsController {
  constructor(private prisma: PrismaService) {}

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

  @Get('mobile/funcionarios/:slug')
  async funcionariosMobile(@Param('slug') slug: string) {
    const rest = await this.prisma.withTenant().restaurante.findUnique({ where: { slug } });
    if (!rest) return { success: false, error: 'Restaurante no encontrado' };

    const funcionarios = await this.prisma.withTenant().usuario.findMany({
      where: { restauranteId: rest.id, activo: true },
      select: { id: true, nombre: true, rol: true },
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
