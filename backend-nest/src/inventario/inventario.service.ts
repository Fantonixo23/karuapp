import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class InventarioService {
  constructor(private db: DatabaseService) {}

  async listar(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('inventario')
        .innerJoin('productos', 'productos.id', 'inventario.producto_id')
        .leftJoin('categorias', 'categorias.id', 'productos.categoria_id')
        .select([
          'inventario.id',
          'inventario.restaurante_id',
          'inventario.producto_id',
          'inventario.stock_actual',
          'inventario.stock_minimo',
          'inventario.unidad_medida',
          'inventario.precio_costo',
          'inventario.fecha_actualizacion',
          'productos.nombre as producto_nombre',
          'productos.precio as producto_precio',
          'categorias.nombre as categoria_nombre',
        ])
        .where('inventario.restaurante_id', '=', restauranteId)
        .orderBy('inventario.fecha_actualizacion', 'desc')
        .execute(),
    );
  }

  async actualizar(restauranteId: number, data: { producto_id: number; stock_actual?: number; stock_minimo?: number; precio_costo?: number; unidad_medida?: string }) {
    return this.db.transaction(async (tx) => {
      const producto = await tx
        .selectFrom('productos')
        .select('id')
        .where('id', '=', data.producto_id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!producto) throw new NotFoundException('Producto no encontrado');

      const existente = await tx
        .selectFrom('inventario')
        .selectAll()
        .where('producto_id', '=', data.producto_id)
        .executeTakeFirst();

      if (existente) {
        await tx
          .updateTable('inventario')
          .set({
            stock_actual: data.stock_actual ?? existente.stock_actual,
            stock_minimo: data.stock_minimo ?? existente.stock_minimo,
            precio_costo: data.precio_costo ?? existente.precio_costo,
            unidad_medida: data.unidad_medida ?? existente.unidad_medida,
            fecha_actualizacion: new Date(),
          })
          .where('id', '=', existente.id)
          .execute();
      } else {
        await tx
          .insertInto('inventario')
          .values({
            restaurante_id: restauranteId,
            producto_id: data.producto_id,
            stock_actual: data.stock_actual || 0,
            stock_minimo: data.stock_minimo || 5,
            precio_costo: data.precio_costo || 0,
            unidad_medida: data.unidad_medida || 'und',
          })
          .execute();
      }

      return tx
        .selectFrom('inventario')
        .innerJoin('productos', 'productos.id', 'inventario.producto_id')
        .select([
          'inventario.id',
          'inventario.restaurante_id',
          'inventario.producto_id',
          'inventario.stock_actual',
          'inventario.stock_minimo',
          'inventario.unidad_medida',
          'inventario.precio_costo',
          'inventario.fecha_actualizacion',
          'productos.nombre as producto_nombre',
          'productos.precio as producto_precio',
        ])
        .where('inventario.producto_id', '=', data.producto_id)
        .executeTakeFirstOrThrow();
    });
  }

  async movimiento(restauranteId: number, data: { inventario_id: number; tipo: string; cantidad: number; motivo?: string; notas?: string }) {
    return this.db.transaction(async (tx) => {
      const inv = await tx
        .selectFrom('inventario')
        .selectAll()
        .where('id', '=', data.inventario_id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!inv) throw new NotFoundException('Inventario no encontrado');

      if (data.tipo === 'salida' && inv.stock_actual < data.cantidad) {
        throw new BadRequestException('Stock insuficiente');
      }

      const stockChange = data.tipo === 'entrada' ? data.cantidad : -data.cantidad;

      await tx
        .updateTable('inventario')
        .set({ stock_actual: inv.stock_actual + stockChange, fecha_actualizacion: new Date() })
        .where('id', '=', data.inventario_id)
        .execute();

      return tx
        .insertInto('movimientos_inventario')
        .values({
          restaurante_id: restauranteId,
          inventario_id: data.inventario_id,
          tipo: data.tipo,
          cantidad: data.cantidad,
          motivo: data.motivo || null,
          notas: data.notas || null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async eliminar(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const inv = await tx
        .selectFrom('inventario')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!inv) throw new NotFoundException('Inventario no encontrado');

      await tx.deleteFrom('inventario').where('id', '=', id).execute();
      return { success: true };
    });
  }

  async resumen(restauranteId: number) {
    const inventarios = await this.db.run(async (db) =>
      db
        .selectFrom('inventario')
        .select(['stock_actual', 'stock_minimo', 'precio_costo'])
        .where('restaurante_id', '=', restauranteId)
        .execute(),
    );

    const totalProductos = inventarios.length;
    const agotados = inventarios.filter((i) => i.stock_actual <= 0).length;
    const bajos = inventarios.filter((i) => i.stock_actual > 0 && i.stock_actual <= i.stock_minimo).length;
    const normales = inventarios.filter((i) => i.stock_actual > i.stock_minimo).length;
    const valorTotal = inventarios.reduce((s, i) => s + Number(i.precio_costo) * i.stock_actual, 0);

    return { total_productos: totalProductos, agotados, bajos, normales, valor_total: valorTotal };
  }

  async alertas(restauranteId: number) {
    const bajos = await this.db.run(async (db) =>
      db
        .selectFrom('inventario')
        .innerJoin('productos', 'productos.id', 'inventario.producto_id')
        .select([
          'inventario.id',
          'inventario.stock_actual',
          'inventario.stock_minimo',
          'productos.nombre as producto_nombre',
        ])
        .where('inventario.restaurante_id', '=', restauranteId)
        .where(sql<boolean>`inventario.stock_actual <= inventario.stock_minimo`)
        .orderBy('inventario.stock_actual', 'asc')
        .execute(),
    );

    return bajos.map((i) => ({
      id: i.id,
      producto: i.producto_nombre,
      stock_actual: i.stock_actual,
      stock_minimo: i.stock_minimo,
      estado: i.stock_actual <= 0 ? 'agotado' : 'bajo',
    }));
  }
}
