import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const ESTADOS_VENTA = ['pagado', 'entregado'];

const escapeLike = (v: string) => `%${v.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

@Injectable()
export class InformesService {
  constructor(private db: DatabaseService) {}

  async ventasHoy(restauranteId: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidos = await this.db.run(async (db) =>
      db
        .selectFrom('pedidos')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .where('estado', 'in', ESTADOS_VENTA)
        .where('created_at', '>=', hoy)
        .where('created_at', '<', manana)
        .execute(),
    );

    return this.procesarVentas(pedidos);
  }

  async resumenCompleto(restauranteId: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const [pedidosHoy, pendientes, mesasOcupadas, totalMesas, totalProductos, ventas] = await this.db.run(
      async (db) => {
        const pedidosHoy = await db
          .selectFrom('pedidos')
          .selectAll()
          .where('restaurante_id', '=', restauranteId)
          .where('estado', 'in', ESTADOS_VENTA)
          .where('created_at', '>=', hoy)
          .where('created_at', '<', manana)
          .execute();

        const pendientes = await db
          .selectFrom('pedidos')
          .select((eb) => eb.fn.countAll().as('c'))
          .where('restaurante_id', '=', restauranteId)
          .where('estado', 'in', ['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado'])
          .executeTakeFirst();

        const mesasOcupadas = await db
          .selectFrom('mesas')
          .select((eb) => eb.fn.countAll().as('c'))
          .where('restaurante_id', '=', restauranteId)
          .where('estado', '=', 'ocupada')
          .executeTakeFirst();

        const totalMesas = await db
          .selectFrom('mesas')
          .select((eb) => eb.fn.countAll().as('c'))
          .where('restaurante_id', '=', restauranteId)
          .executeTakeFirst();

        const totalProductos = await db
          .selectFrom('productos')
          .select((eb) => eb.fn.countAll().as('c'))
          .where('restaurante_id', '=', restauranteId)
          .where('disponible', '=', true)
          .executeTakeFirst();

        const ventas = this.procesarVentas(pedidosHoy);

        return [pedidosHoy, pendientes, mesasOcupadas, totalMesas, totalProductos, ventas];
      },
    );

    return {
      ventas_hoy: ventas,
      pendientes: Number(pendientes?.c ?? 0),
      mesas_ocupadas: Number(mesasOcupadas?.c ?? 0),
      total_mesas: Number(totalMesas?.c ?? 0),
      productos_disponibles: Number(totalProductos?.c ?? 0),
    };
  }

  async ventasPorDia(restauranteId: number, desde?: string, hasta?: string) {
    const hoy = new Date();
    const desdeDate = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

    const pedidos = await this.db.run(async (db) =>
      db
        .selectFrom('pedidos')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .where('estado', 'in', ESTADOS_VENTA)
        .where('created_at', '>=', desdeDate)
        .where('created_at', '<=', hastaDate)
        .execute(),
    );

    const ventasPorDia: Record<string, number> = {};
    for (const p of pedidos) {
      const key = p.created_at.toISOString().split('T')[0];
      ventasPorDia[key] = (ventasPorDia[key] || 0) + p.total;
    }

    return Object.entries(ventasPorDia)
      .map(([fecha, total]) => ({ fecha, total: String(total) }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  async productosEstadisticas(restauranteId: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidos = await this.db.run(async (db) =>
      db
        .selectFrom('pedidos')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .where('estado', 'in', ESTADOS_VENTA)
        .where('created_at', '>=', hoy)
        .where('created_at', '<', manana)
        .execute(),
    );

    const counts: Record<string, { cantidad: number; total: number }> = {};
    for (const p of pedidos) {
      const items = (p.items as any[]) || [];
      for (const item of items) {
        const nombre = item.producto_nombre || 'Desconocido';
        if (!counts[nombre]) counts[nombre] = { cantidad: 0, total: 0 };
        counts[nombre].cantidad += item.cantidad || 1;
        counts[nombre].total += (item.cantidad || 1) * (item.precio || 0);
      }
    }

    const masVendidos = Object.entries(counts)
      .map(([producto, stats]) => ({ producto, ...stats, total: String(stats.total) }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 20);

    const totalPedidos = pedidos.length;
    const ticketPromedio = totalPedidos > 0 ? pedidos.reduce((s, p) => s + p.total, 0) / totalPedidos : 0;

    return { mas_vendidos: masVendidos, total_pedidos: totalPedidos, ticket_promedio: Math.round(ticketPromedio) };
  }

  async metodosPago(restauranteId: number, desde?: string, hasta?: string) {
    const hoy = new Date();
    const desdeDate = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : new Date();

    const pedidos = await this.db.run(async (db) =>
      db
        .selectFrom('pedidos')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .where('estado', 'in', ESTADOS_VENTA)
        .where('created_at', '>=', desdeDate)
        .where('created_at', '<=', hastaDate)
        .execute(),
    );

    const resumen: Record<string, number> = {};
    let totalGeneral = 0;
    for (const p of pedidos) {
      const mp = p.metodo_pago || 'efectivo';
      resumen[mp] = (resumen[mp] || 0) + p.total;
      totalGeneral += p.total;
    }

    const metodos = Object.entries(resumen).map(([metodo, total]) => ({
      metodo,
      total: String(total),
      porcentaje: totalGeneral > 0 ? Math.round((total / totalGeneral) * 100) : 0,
    }));

    return { metodos, total_general: String(totalGeneral) };
  }

  async pedidosLista(restauranteId: number, filtros: any = {}) {
    const limit = +((filtros as any).limit || 20);
    const offset = +((filtros as any).offset || 0);

    const pedidos = await this.db.run(async (db) => {
      let qb = db
        .selectFrom('pedidos')
        .leftJoin('mesas', 'pedidos.mesa_id', 'mesas.id')
        .leftJoin('usuarios as mesero', 'pedidos.mesero_id', 'mesero.id')
        .select([
          'pedidos.id',
          'pedidos.numero_orden',
          'pedidos.estado',
          'pedidos.items',
          'pedidos.total',
          'pedidos.metodo_pago',
          'pedidos.created_at',
          'mesas.numero as mesa_numero',
          'mesero.nombre as mesero_nombre',
        ])
        .where('pedidos.restaurante_id', '=', restauranteId)
        .where('pedidos.estado', 'in', ESTADOS_VENTA);

      if (filtros.fecha_desde) qb = qb.where('pedidos.created_at', '>=', new Date(filtros.fecha_desde));
      if (filtros.fecha_hasta) qb = qb.where('pedidos.created_at', '<=', new Date(`${filtros.fecha_hasta}T23:59:59`));
      if (filtros.cliente_nombre) qb = qb.where('pedidos.cliente_nombre', 'ilike', escapeLike(filtros.cliente_nombre));
      if (filtros.numero_orden) qb = qb.where('pedidos.numero_orden', 'ilike', escapeLike(filtros.numero_orden));

      return qb.orderBy('pedidos.created_at', 'desc').limit(limit).offset(offset).execute();
    });

    return pedidos.map((p) => ({
      id: p.id,
      numero_orden: p.numero_orden,
      mesa_numero: (p as any).mesa_numero ?? null,
      mesero_nombre: (p as any).mesero_nombre ?? null,
      estado: p.estado,
      items: p.items,
      total: String(p.total),
      metodo_pago: p.metodo_pago,
      created_at: p.created_at,
    }));
  }

  private procesarVentas(pedidos: any[]) {
    const resumen: Record<string, number> = {};
    let total = 0;
    let totalPropinas = 0;

    for (const p of pedidos) {
      const mp = p.metodo_pago || 'efectivo';
      resumen[mp] = (resumen[mp] || 0) + p.total;
      total += p.total;
      totalPropinas += p.propina || 0;
    }

    const resumenStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(resumen)) {
      resumenStr[k] = String(v);
    }
    resumenStr['propinas'] = String(totalPropinas);

    return {
      ...resumenStr,
      total: String(total),
      cantidad: pedidos.length,
    };
  }
}