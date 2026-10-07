import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private db: DatabaseService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.rol === 'superadmin') return true;

    const restaurante = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('restaurantes')
        .select(['estado_licencia', 'motivo_bloqueo', 'fecha_expiracion'])
        .where('id', '=', user.restauranteId)
        .executeTakeFirst(),
    );
    if (!restaurante) throw new ForbiddenException('Restaurante no encontrado');
    if (restaurante.estado_licencia === 'pendiente') {
      throw new ForbiddenException('Tu cuenta está pendiente de aprobación. Te contactaremos pronto.');
    }
    if (restaurante.estado_licencia === 'suspendido') {
      throw new ForbiddenException(`Cuenta suspendida. Motivo: ${restaurante.motivo_bloqueo || 'contactá al administrador'}`);
    }
    if (restaurante.estado_licencia !== 'activo') {
      throw new ForbiddenException('Cuenta no activa. Contactá al administrador.');
    }
    if (restaurante.fecha_expiracion && restaurante.fecha_expiracion < new Date()) {
      throw new ForbiddenException(`Cuenta suspendida. Motivo: ${restaurante.motivo_bloqueo || 'licencia vencida'}`);
    }
    return true;
  }
}