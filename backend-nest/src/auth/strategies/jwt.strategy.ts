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
          'usuarios.rol',
          'usuarios.nombre',
          'usuarios.restaurante_id',
          'restaurantes.activo as rest_activo',
          'restaurantes.estado_licencia',
          'restaurantes.fecha_expiracion',
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

    const licencia_activa = await this.verificarLicencia(usuario);
    if (!licencia_activa) {
      throw new UnauthorizedException('Licencia expirada');
    }

    // El rol y el tenant se releen de la base: el token dura dias y un cambio de
    // rol o de restaurante debe impactar sin esperar a que expire.
    return {
      ...payload,
      restauranteId: usuario.restaurante_id,
      rol: usuario.rol,
      nombre: usuario.nombre,
    };
  }

  private async verificarLicencia(usuario: {
    restaurante_id: number | null;
    rest_activo: boolean | null;
    estado_licencia: string | null;
    fecha_expiracion: Date | null;
  }): Promise<boolean> {
    if (!usuario.restaurante_id) return true;
    if (!usuario.rest_activo || ['suspendido', 'bloqueada'].includes(usuario.estado_licencia ?? '')) {
      return false;
    }
    if (usuario.estado_licencia === 'expirado') return false;
    if (usuario.fecha_expiracion && usuario.fecha_expiracion < new Date()) {
      await this.db.runBypassRls(async (db) =>
        db
          .updateTable('restaurantes')
          .set({ estado_licencia: 'expirado' })
          .where('id', '=', usuario.restaurante_id)
          .execute(),
      );
      return false;
    }
    return true;
  }
}
