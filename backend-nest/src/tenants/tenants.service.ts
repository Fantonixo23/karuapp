import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class TenantsService {
  constructor(private db: DatabaseService) {}

  async getRestauranteBySlug(slug: string) {
    const restaurante = await this.db.run(async (db) =>
      db.selectFrom('restaurantes').selectAll().where('slug', '=', slug).executeTakeFirst(),
    );
    if (!restaurante) throw new NotFoundException('Restaurante no encontrado');
    return restaurante;
  }

  async verifyLicense(restauranteId: number) {
    const restaurante = await this.db.run(async (db) =>
      db.selectFrom('restaurantes').selectAll().where('id', '=', restauranteId).executeTakeFirst(),
    );
    if (!restaurante) return { valid: false, reason: 'not_found' };

    if (!restaurante.activo || restaurante.estado_licencia === 'suspended') {
      return { valid: false, reason: 'suspended' };
    }

    if (restaurante.fecha_expiracion && restaurante.fecha_expiracion < new Date()) {
      await this.db.run(async (db) =>
        db
          .updateTable('restaurantes')
          .set({ estado_licencia: 'expirado' })
          .where('id', '=', restauranteId)
          .execute(),
      );
      return { valid: false, reason: 'expired' };
    }

    return { valid: true };
  }
}
