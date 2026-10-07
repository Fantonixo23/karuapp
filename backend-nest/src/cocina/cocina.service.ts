import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RealtimeService } from '../realtime/realtime.service';

const TRANSICIONES_COCINA: Record<string, string[]> = {
  pendiente: ['cocinando', 'listo', 'cancelado'],
  cocinando: ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
};

@Injectable()
export class CocinaService {
  constructor(
    private db: DatabaseService,
    private realtime: RealtimeService,
  ) {}

  async listarPedidos(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('pedidos')
        .leftJoin('mesas', 'mesas.id', 'pedidos.mesa_id')
        .select([
          'pedidos.id',
          'pedidos.numero_orden',
          'pedidos.estado',
          'pedidos.items',
          'pedidos.total',
          'pedidos.delivery',
          'pedidos.nombre_cliente',
          'pedidos.telefono_cliente',
          'pedidos.direccion',
          'pedidos.tipo_pedido',
          'pedidos.notas',
          'pedidos.created_at',
          'mesas.numero as mesa_numero',
        ])
        .where('pedidos.restaurante_id', '=', restauranteId)
        .where('pedidos.estado', 'in', ['pendiente', 'cocinando', 'listo'])
        .orderBy('pedidos.estado', 'asc')
        .orderBy('pedidos.created_at', 'asc')
        .execute(),
    );
  }

  async cambiarEstado(restauranteId: number, id: number, estado: string) {
    const updated = await this.db.transaction(async (tx) => {
      const pedido = await tx
        .selectFrom('pedidos')
        .select(['id', 'estado'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!pedido) throw new NotFoundException('Pedido no encontrado');

      const allowed = TRANSICIONES_COCINA[pedido.estado] || [];
      if (!allowed.includes(estado)) {
        throw new BadRequestException(`Transición inválida: ${pedido.estado} → ${estado}`);
      }

      return tx
        .updateTable('pedidos')
        .set({ estado, updated_at: new Date() })
        .where('id', '=', id)
        .returning(['id', 'numero_orden', 'estado'])
        .executeTakeFirstOrThrow();
    });

    await this.realtime.emitPedidoUpdate(restauranteId, {
      id: updated.id,
      numero_orden: updated.numero_orden,
      estado: updated.estado,
    });

    return updated;
  }
}
