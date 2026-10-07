import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { countInt } from '../database/agg';

const PRODUCTO_CON_RELACIONES = (qb: any) =>
  qb
    .leftJoin('categorias', 'categorias.id', 'productos.categoria_id')
    .leftJoin('inventario', 'inventario.producto_id', 'productos.id')
    .select([
      'productos.id',
      'productos.restaurante_id',
      'productos.nombre',
      'productos.descripcion',
      'productos.precio',
      'productos.categoria_id',
      'productos.disponible',
      'productos.imagen',
      'productos.imagen_archivo',
      'productos.variantes',
      'productos.iva',
      'productos.created_at',
      'productos.updated_at',
      'categorias.nombre as categoria_nombre',
      'categorias.icono as categoria_icono',
      'inventario.id as inventario_id',
      'inventario.stock_actual',
      'inventario.stock_minimo',
      'inventario.unidad_medida',
      'inventario.precio_costo',
    ]);

@Injectable()
export class ProductosService {
  constructor(private db: DatabaseService) {}

  async listarCategorias(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('categorias')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .orderBy('orden', 'asc')
        .orderBy('nombre', 'asc')
        .execute(),
    );
  }

  async crearCategoria(restauranteId: number, data: { nombre: string; icono?: string; orden?: number }) {
    return this.db.run(async (db) =>
      db
        .insertInto('categorias')
        .values({
          restaurante_id: restauranteId,
          nombre: data.nombre,
          icono: data.icono || 'category',
          orden: data.orden || 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  async actualizarCategoria(restauranteId: number, id: number, data: { nombre?: string; icono?: string; orden?: number }) {
    return this.db.run(async (db) =>
      db
        .updateTable('categorias')
        .set({
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.icono !== undefined && { icono: data.icono }),
          ...(data.orden !== undefined && { orden: data.orden }),
        })
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .returningAll()
        .executeTakeFirst(),
    );
  }

  async eliminarCategoria(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const cat = await tx
        .selectFrom('categorias')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!cat) throw new NotFoundException('Categoría no encontrada');

      const count = await tx
        .selectFrom('productos')
        .select(() => countInt())
        .where('categoria_id', '=', id)
        .executeTakeFirst();
      if ((count?.c ?? 0) > 0) throw new BadRequestException('No se puede eliminar una categoría con productos');

      await tx.deleteFrom('categorias').where('id', '=', id).execute();
      return { success: true };
    });
  }

  async listarProductos(restauranteId: number, categoriaId?: number) {
    return this.db.run(async (db) => {
      let qb = PRODUCTO_CON_RELACIONES(db.selectFrom('productos')).where('productos.restaurante_id', '=', restauranteId);
      if (categoriaId) qb = qb.where('productos.categoria_id', '=', categoriaId);
      return qb.orderBy('productos.nombre', 'asc').execute();
    });
  }

  async crearProducto(restauranteId: number, data: any) {
    return this.db.transaction(async (tx) => {
      const creado = await tx
        .insertInto('productos')
        .values({
          restaurante_id: restauranteId,
          nombre: data.nombre,
          descripcion: data.descripcion ?? null,
          precio: data.precio,
          categoria_id: data.categoria_id || null,
          disponible: data.disponible ?? true,
          imagen: data.imagen ?? null,
          variantes: data.variantes ? JSON.stringify(data.variantes) : null,
          iva: data.iva || 10,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      return PRODUCTO_CON_RELACIONES(tx.selectFrom('productos').where('productos.id', '=', creado.id))
        .executeTakeFirstOrThrow();
    });
  }

  async actualizarProducto(restauranteId: number, id: number, data: any) {
    return this.db.transaction(async (tx) => {
      const prod = await tx
        .selectFrom('productos')
        .select(['id', 'categoria_id'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!prod) throw new NotFoundException('Producto no encontrado');

      await tx
        .updateTable('productos')
        .set({
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
          ...(data.precio !== undefined && { precio: data.precio }),
          categoria_id: data.categoria_id ?? prod.categoria_id,
          ...(data.disponible !== undefined && { disponible: data.disponible }),
          ...(data.imagen !== undefined && { imagen: data.imagen }),
          ...(data.variantes !== undefined && { variantes: data.variantes ? JSON.stringify(data.variantes) : null }),
          ...(data.iva !== undefined && { iva: data.iva }),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();

      return PRODUCTO_CON_RELACIONES(
        tx.selectFrom('productos').where('productos.id', '=', id),
      ).executeTakeFirstOrThrow();
    });
  }

  async toggleDisponible(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const prod = await tx
        .selectFrom('productos')
        .select(['id', 'disponible'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!prod) throw new NotFoundException('Producto no encontrado');

      return tx
        .updateTable('productos')
        .set({ disponible: !prod.disponible, updated_at: new Date() })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async eliminarProducto(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const prod = await tx
        .selectFrom('productos')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!prod) throw new NotFoundException('Producto no encontrado');

      await tx.deleteFrom('productos').where('id', '=', id).execute();
      return { success: true };
    });
  }
}
