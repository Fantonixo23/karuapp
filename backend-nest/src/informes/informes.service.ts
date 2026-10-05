import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InformesService {
  constructor(private prisma: PrismaService) {}

  async ventasHoy(restauranteId: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        estado: { in: ['pagado', 'entregado'] as any },
        createdAt: { gte: hoy, lt: manana },
      },
    });

    return this.procesarVentas(pedidos);
  }

  async resumenCompleto(restauranteId: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidosHoy = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        estado: { in: ['pagado', 'entregado'] as any },
        createdAt: { gte: hoy, lt: manana },
      },
    });

    const pendientes = await this.prisma.withTenant().pedido.count({
      where: { restauranteId, estado: { in: ['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado'] as any } },
    });

    const mesasOcupadas = await this.prisma.withTenant().mesa.count({
      where: { restauranteId, estado: 'ocupada' },
    });

    const totalMesas = await this.prisma.withTenant().mesa.count({
      where: { restauranteId },
    });

    const totalProductos = await this.prisma.withTenant().producto.count({
      where: { restauranteId, disponible: true },
    });

    const ventas = this.procesarVentas(pedidosHoy);

    return {
      ventas_hoy: ventas,
      pendientes,
      mesas_ocupadas: mesasOcupadas,
      total_mesas: totalMesas,
      productos_disponibles: totalProductos,
    };
  }

  async ventasPorDia(restauranteId: number, desde?: string, hasta?: string) {
    const hoy = new Date();
    const desdeDate = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hastaDate = hasta ? new Date(hasta + 'T23:59:59') : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59);

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        estado: { in: ['pagado', 'entregado'] as any },
        createdAt: { gte: desdeDate, lte: hastaDate },
      },
    });

    const ventasPorDia: Record<string, number> = {};
    for (const p of pedidos) {
      const key = p.createdAt.toISOString().split('T')[0];
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

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        estado: { in: ['pagado', 'entregado'] as any },
        createdAt: { gte: hoy, lt: manana },
      },
    });

    const counts: Record<string, { cantidad: number; total: number }> = {};
    for (const p of pedidos) {
      const items = p.items as any[] || [];
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

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        estado: { in: ['pagado', 'entregado'] as any },
        createdAt: { gte: desdeDate, lte: hastaDate },
      },
    });

    const resumen: Record<string, number> = {};
    let totalGeneral = 0;
    for (const p of pedidos) {
      const mp = p.metodoPago || 'efectivo';
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
    const where: any = { restauranteId, estado: { in: ['pagado', 'entregado'] as any } };

    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.createdAt = {};
      if (filtros.fecha_desde) where.createdAt.gte = new Date(filtros.fecha_desde);
      if (filtros.fecha_hasta) where.createdAt.lte = new Date(filtros.fecha_hasta + 'T23:59:59');
    }

    if (filtros.cliente_nombre) {
      where.clienteNombre = { contains: filtros.cliente_nombre, mode: 'insensitive' };
    }
    if (filtros.numero_orden) {
      where.numeroOrden = { contains: filtros.numero_orden };
    }

    const limit = filtros.limit || 20;
    const offset = filtros.offset || 0;

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where,
      include: { mesa: { select: { numero: true } }, mesero: { select: { nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: +limit,
      skip: +offset,
    });

    return pedidos.map(p => ({
      id: p.id,
      numero_orden: p.numeroOrden,
      mesa_numero: p.mesa?.numero || null,
      mesero_nombre: p.mesero?.nombre || null,
      estado: p.estado,
      items: p.items,
      total: String(p.total),
      metodo_pago: p.metodoPago,
      created_at: p.createdAt,
    }));
  }

  private procesarVentas(pedidos: any[]) {
    const resumen: Record<string, number> = {};
    let total = 0;
    let totalPropinas = 0;

    for (const p of pedidos) {
      const mp = p.metodoPago || 'efectivo';
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
