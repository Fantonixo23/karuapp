import { Controller, Get, Param, Query } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as os from 'os';

@Controller('api')
export class UtilsController {
  constructor(private db: DatabaseService) {}

  @Get('verificar-suscripcion')
  async verificarSuscripcion(@CurrentUser('restauranteId') rid: number) {
    const rest = await this.db.run(async (db) =>
      db.selectFrom('restaurantes').selectAll().where('id', '=', rid).executeTakeFirst(),
    );
    if (!rest) return { estado: 'bloqueada', dias_restantes: 0, mensaje: 'Restaurante no encontrado' };

    const ahora = new Date();
    const expirado = rest.fecha_expiracion && rest.fecha_expiracion < ahora;
    const estado = expirado ? 'bloqueada' : rest.estado_licencia;
    const dias = rest.fecha_expiracion
      ? Math.max(0, Math.floor((rest.fecha_expiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)))
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
  async verificarLicencia(@Query('restaurante') slug?: string) {
    const rest = slug
      ? await this.db.runBypassRls(async (db) =>
          db.selectFrom('restaurantes').selectAll().where('slug', '=', slug).executeTakeFirst(),
        )
      : undefined;

    if (!rest) {
      return {
        success: true,
        licencia_valida: true,
        estado: 'activo',
        dias_restantes: 365,
        mensaje: 'Licencia activa',
        nombre: '',
        online: false,
        bloqueado: false,
      };
    }

    const ahora = new Date();
    const dias = rest.fecha_expiracion
      ? Math.max(0, Math.floor((rest.fecha_expiracion.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24)))
      : null;
    const estadoBase = rest.estado_licencia || 'activo';

    let estado: string;
    let mensaje: string;
    let bloqueado = false;

    if (estadoBase === 'bloqueada' || (dias !== null && dias <= 0)) {
      estado = 'bloqueada';
      bloqueado = true;
      mensaje = rest.motivo_bloqueo || 'Licencia vencida. Contacte al administrador.';
    } else if (estadoBase === 'gracia') {
      estado = 'gracia';
      mensaje = 'Período de gracia. Renueve su licencia para continuar operando.';
    } else if (dias !== null && dias <= 1) {
      estado = 'por_vencer_1';
      mensaje = `Licencia crítica: vence en ${dias} día(s).`;
    } else if (dias !== null && dias <= 3) {
      estado = 'por_vencer_3';
      mensaje = `Licencia por vencer en ${dias} día(s).`;
    } else if (dias !== null && dias <= 5) {
      estado = 'por_vencer_5';
      mensaje = `Licencia próxima a vencer en ${dias} día(s).`;
    } else {
      estado = 'activo';
      mensaje = 'Licencia activa';
    }

    return {
      success: true,
      licencia_valida: estado !== 'bloqueada',
      estado,
      dias_restantes: Math.max(0, dias ?? 365),
      mensaje,
      nombre: rest.nombre,
      online: true,
      bloqueado,
    };
  }

  @Get('mobile/funcionarios/:slug')
  async funcionariosMobile(@Param('slug') slug: string) {
    return this.db.run(async (db) => {
      const rest = await db.selectFrom('restaurantes').select('id').where('slug', '=', slug).executeTakeFirst();
      if (!rest) return { success: false, error: 'Restaurante no encontrado' };

      const funcionarios = await db
        .selectFrom('usuarios')
        .select(['id', 'nombre', 'rol'])
        .where('restaurante_id', '=', rest.id)
        .where('activo', '=', true)
        .execute();
      return { success: true, funcionarios };
    });
  }

  @Get('usuarios')
  async listarUsuarios(@CurrentUser('restauranteId') rid: number) {
    const usuarios = await this.db.run(async (db) =>
      db
        .selectFrom('usuarios')
        .select(['id', 'nombre', 'rol', 'telefono', 'email', 'activo', 'ultimo_acceso'])
        .where('restaurante_id', '=', rid)
        .orderBy('nombre', 'asc')
        .execute(),
    );
    return { success: true, usuarios };
  }
}
