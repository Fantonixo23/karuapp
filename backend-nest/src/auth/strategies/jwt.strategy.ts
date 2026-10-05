import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { requireJwtSecret } from '../../common/jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: requireJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const usuario = await this.db.runBypassRls(async (db) =>
      db
        .selectFrom('usuarios')
        .leftJoin('restaurantes', 'restaurantes.id', 'usuarios.restaurante_id')
        .select([
          'usuarios.id',
          'usuarios.activo',
          'restaurantes.activo as rest_activo',
        ])
        .where('usuarios.id', '=', payload.sub)
        .executeTakeFirst(),
    );

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    if (usuario.rest_activo === false) {
      throw new UnauthorizedException('Restaurante inactivo');
    }

    const { licencia_activa } = await this.verificarLicencia(payload.restauranteId);
    if (!licencia_activa) {
      throw new UnauthorizedException('Licencia expirada');
    }

    return payload;
  }

  private async verificarLicencia(restauranteId: number | null) {
    if (!restauranteId) return { licencia_activa: true };

    const restaurante = await this.db.runBypassRls(async (db) =>
      db.selectFrom('restaurantes').selectAll().where('id', '=', restauranteId).executeTakeFirst(),
    );

    if (!restaurante) return { licencia_activa: false };
    if (!restaurante.activo || restaurante.estado_licencia === 'suspended') {
      return { licencia_activa: false };
    }
    if (restaurante.estado_licencia === 'expirado') return { licencia_activa: false };
    if (restaurante.fecha_expiracion && restaurante.fecha_expiracion < new Date()) {
      await this.db.runBypassRls(async (db) =>
        db
          .updateTable('restaurantes')
          .set({ estado_licencia: 'expirado' })
          .where('id', '=', restauranteId)
          .execute(),
      );
      return { licencia_activa: false };
    }
    return { licencia_activa: true };
  }
}
