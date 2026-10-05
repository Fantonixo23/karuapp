import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { MODULE_KEY } from '../decorators/modules.decorator';

const MODULOS_POR_ROL: Record<string, string[]> = {
  administrador: ['mesas', 'cocina', 'caja', 'delivery', 'informes', 'productos', 'inventario', 'funcionarios', 'configuracion'],
  cajero: ['mesas', 'caja', 'delivery', 'cocina'],
  mesero: ['mesas', 'cocina'],
  cocina: ['cocina'],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredModule = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles && !requiredModule) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('No tienes permiso para esta acción');

    if (requiredRoles && !requiredRoles.includes(user.rol)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }

    if (requiredModule) {
      const modulos = MODULOS_POR_ROL[user.rol] || [];
      if (!modulos.includes(requiredModule)) {
        throw new ForbiddenException(`No tienes acceso al módulo ${requiredModule}`);
      }
    }

    return true;
  }
}
