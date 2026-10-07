import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { countInt } from '../database/agg';

const ESTADOS_CON_PEDIDOS = ['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado'];

@Injectable()
export class MesasService {
  constructor(private db: DatabaseService) {}

  async listar(restauranteId: number) {
    return this.db.run(async (db) =>
      db.selectFrom('mesas').selectAll().where('restaurante_id', '=', restauranteId).orderBy('numero', 'asc').execute(),
    );
  }

  async crear(restauranteId: number, data: { numero: number; nombre?: string; capacidad?: number; area?: string }) {
    return this.db.transaction(async (tx) => {
      const existente = await tx
        .selectFrom('mesas')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .where('numero', '=', data.numero)
        .executeTakeFirst();
      if (existente) throw new BadRequestException('Ya existe una mesa con ese número');

      return tx
        .insertInto('mesas')
        .values({
          restaurante_id: restauranteId,
          numero: data.numero,
          nombre: data.nombre ?? null,
          capacidad: data.capacidad || 4,
          area: (data.area as string) || 'principal',
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async editar(restauranteId: number, id: number, data: any) {
    return this.db.transaction(async (tx) => {
      const mesa = await tx
        .selectFrom('mesas')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!mesa) throw new NotFoundException('Mesa no encontrada');

      return tx
        .updateTable('mesas')
        .set({
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.capacidad !== undefined && { capacidad: data.capacidad }),
          ...(data.area !== undefined && { area: data.area }),
          ...(data.estado !== undefined && { estado: data.estado }),
          ...(data.comensales !== undefined && { comensales: data.comensales }),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async eliminar(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const mesa = await tx
        .selectFrom('mesas')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!mesa) throw new NotFoundException('Mesa no encontrada');

      const pedidosActivos = await tx
        .selectFrom('pedidos')
        .select(() => countInt())
        .where('mesa_id', '=', id)
        .where('estado', 'in', ESTADOS_CON_PEDIDOS)
        .executeTakeFirst();

      if ((pedidosActivos?.c ?? 0) > 0) {
        throw new BadRequestException('No se puede eliminar una mesa con pedidos activos');
      }

      await tx.deleteFrom('mesas').where('id', '=', id).execute();
      return { success: true };
    });
  }

  async cambiarEstado(restauranteId: number, id: number, estado: string, comensales?: number) {
    return this.db.transaction(async (tx) => {
      const mesa = await tx
        .selectFrom('mesas')
        .select(['id', 'comensales'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!mesa) throw new NotFoundException('Mesa no encontrada');

      return tx
        .updateTable('mesas')
        .set({ estado, comensales: comensales ?? mesa.comensales, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }
}
