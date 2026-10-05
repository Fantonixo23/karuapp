import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'karuapp-jwt-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { restaurante: true },
    });

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    if (usuario.restaurante && !usuario.restaurante.activo) {
      throw new UnauthorizedException('Restaurante inactivo');
    }

    const { licencia_activa } = await this.verificarLicencia(usuario.restauranteId);
    if (!licencia_activa) {
      throw new UnauthorizedException('Licencia expirada');
    }

    return payload;
  }

  private async verificarLicencia(restauranteId: number | null) {
    if (!restauranteId) return { licencia_activa: true };

    const restaurante = await this.prisma.restaurante.findUnique({
      where: { id: restauranteId },
    });

    if (!restaurante) return { licencia_activa: false };
    if (!restaurante.activo || restaurante.estadoLicencia === 'suspended') {
      return { licencia_activa: false };
    }
    if (restaurante.estadoLicencia === 'expirado') return { licencia_activa: false };
    if (restaurante.fechaExpiracion && restaurante.fechaExpiracion < new Date()) {
      await this.prisma.restaurante.update({
        where: { id: restauranteId },
        data: { estadoLicencia: 'expirado' },
      });
      return { licencia_activa: false };
    }
    return { licencia_activa: true };
  }
}
