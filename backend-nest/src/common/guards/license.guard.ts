import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LicenseGuard implements CanActivate {
  constructor(private prisma: PrismaService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.rol === 'superadmin') return true;

    const restaurante = await this.prisma.bypassRls<any>((tx) =>
      tx.restaurante.findUnique({ where: { id: user.restauranteId } }),
    );
    if (!restaurante) throw new ForbiddenException('Restaurante no encontrado');
    if (restaurante.estadoLicencia === 'pendiente') {
      throw new ForbiddenException('Tu cuenta está pendiente de aprobación. Te contactaremos pronto.');
    }
    if (restaurante.estadoLicencia === 'suspendido') {
      throw new ForbiddenException(`Cuenta suspendida. Motivo: ${restaurante.motivoBloqueo || 'contactá al administrador'}`);
    }
    if (restaurante.estadoLicencia !== 'activo') {
      throw new ForbiddenException('Cuenta no activa. Contactá al administrador.');
    }
    if (restaurante.fechaExpiracion && restaurante.fechaExpiracion < new Date()) {
      throw new ForbiddenException(`Cuenta suspendida. Motivo: ${restaurante.motivoBloqueo || 'licencia vencida'}`);
    }
    return true;
  }
}
