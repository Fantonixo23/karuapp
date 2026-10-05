import { Controller, Get, Post, Delete, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SocketGateway } from '../socket/socket.gateway';

@Controller('api')
export class PedidosController {
  constructor(
    private service: PedidosService,
    private prisma: PrismaService,
    private socket: SocketGateway,
  ) {}

  @Get('pedidos')
  async listar(
    @CurrentUser('restauranteId') rid: number,
    @Query('estado') estado?: string,
    @Query('delivery') delivery?: string,
  ) {
    const pedidos = await this.service.listar(rid, { estado, delivery });
    return { success: true, pedidos };
  }

  @Post('pedidos/crear')
  async crear(@CurrentUser('restauranteId') rid: number, @CurrentUser('sub') uid: number, @Body() body: any) {
    const pedido = await this.service.crear(rid, body, uid);
    return { success: true, pedido: { id: pedido.id, estado: pedido.estado, delivery: pedido.delivery, total: String(pedido.total) } };
  }

  @Post('pedidos/:id/estado')
  async cambiarEstado(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: { estado: string },
  ) {
    const pedido = await this.service.cambiarEstado(rid, +id, body.estado);
    return { success: true, pedido: { id: pedido.id, estado: pedido.estado } };
  }

  @Post('pedidos/:id/cancelar')
  async cancelar(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: { motivo?: string },
  ) {
    const pedido = await this.service.cambiarEstado(rid, +id, 'cancelado');
    return { success: true, pedido: { id: pedido.id, estado: pedido.estado } };
  }

  @Post('pedidos/:id/items')
  async agregarItems(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: { items: any[] },
  ) {
    const pedido = await this.service.agregarItems(rid, +id, body.items);
    return { success: true, pedido: { id: pedido.id, items: pedido.items, total: String(pedido.total) } };
  }

  @Post('pedidos/:id/items/reemplazar')
  async reemplazarItems(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: { items: any[] },
  ) {
    const pedido = await this.service.reemplazarItems(rid, +id, body.items);
    return { success: true, pedido: { id: pedido.id, items: pedido.items, total: String(pedido.total), estado: pedido.estado } };
  }

  @Delete('pedidos/:id/items/:idx')
  async eliminarItem(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Param('idx') idx: string,
  ) {
    const pedido = await this.service.eliminarItem(rid, +id, +idx);
    return { success: true, pedido: { id: pedido.id, items: pedido.items, total: String(pedido.total) } };
  }

  @Post('pedidos/:id/pagar')
  async pagar(
    @CurrentUser('restauranteId') rid: number,
    @CurrentUser('sub') uid: number,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const pedido = await this.service.pagar(rid, +id, body, uid);
    return {
      success: true,
      pedido: {
        id: pedido.id,
        estado: pedido.estado,
        metodo_pago: pedido.metodoPago,
        propina: String(pedido.propina),
        total: String(pedido.total),
      },
    };
  }

  @Get('pedidos/mesa/:mesaId')
  async pedidosPorMesa(@CurrentUser('restauranteId') rid: number, @Param('mesaId') mesaId: string) {
    return this.service.pedidosPorMesa(rid, +mesaId);
  }

  @Post('pedidos/mesa/:mesaId/cobrar')
  async cobrarMesa(
    @CurrentUser('restauranteId') rid: number,
    @CurrentUser('sub') uid: number,
    @Param('mesaId') mesaId: string,
    @Body() body: any,
  ) {
    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId: rid, estado: 'abierta' },
    });
    if (!session) {
      return { success: false, error: 'No hay una sesión de caja abierta', need_apertura: true };
    }

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: { restauranteId: rid, mesaId: +mesaId, estado: { notIn: ['pagado', 'cancelado'] as any } },
      orderBy: { createdAt: 'asc' },
    });

    if (!pedidos.length) {
      return { success: false, error: 'No hay pedidos en esta mesa' };
    }

    const metodoPago = body.metodo_pago || 'efectivo';
    const propinas = body.propina || 0;
    const totalPedidos = pedidos.reduce((s, p) => s + p.total, 0);
    const totalConPropina = totalPedidos + propinas;
    const idsCobrados: number[] = [];

    for (const pedido of pedidos) {
      await this.prisma.withTenant().pedido.update({
        where: { id: pedido.id },
        data: {
          estado: 'pagado',
          metodoPago,
          propina: totalPedidos > 0 ? Math.round(propinas * pedido.total / totalPedidos) : 0,
          clienteTipo: body.cliente_tipo || 'consumidor',
          clienteRuc: body.cliente_ruc || '44444444-7',
          clienteNombre: body.cliente_nombre || 'Consumidor Final',
          tipoIva: body.tipo_iva || 10,
        },
      });

      await this.prisma.withTenant().movimientoCaja.create({
        data: {
          restauranteId: rid,
          sessionId: session.id,
          tipo: 'venta',
          metodoPago,
          monto: pedido.total,
          moneda: 'PYG',
          montoPyg: pedido.total,
          pedidoId: pedido.id,
          propina: 0,
          usuarioId: uid,
        },
      });

      idsCobrados.push(pedido.id);
    }

    await this.prisma.withTenant().mesa.update({
      where: { id: +mesaId },
      data: { estado: 'disponible' },
    });

    const vuelto = body.monto_recibido ? Math.max(0, body.monto_recibido - totalConPropina) : 0;

    await this.socket.emitCobro(rid, { mesa_id: +mesaId, total: totalConPropina, metodo_pago: metodoPago });

    return {
      success: true,
      cobrados: idsCobrados,
      total_cobrado: String(totalPedidos),
      total_con_propina: String(totalConPropina),
      vuelto,
      pedidos,
    };
  }

  @Get('pedidos/delivery/dashboard')
  async dashboardDelivery(@CurrentUser('restauranteId') rid: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidosDelivery = await this.prisma.withTenant().pedido.findMany({
      where: { restauranteId: rid, delivery: true, createdAt: { gte: hoy, lt: manana } },
    });

    const pendientes = pedidosDelivery.filter(p => p.estado === 'pendiente').length;
    const cocinando = pedidosDelivery.filter(p => p.estado === 'cocinando').length;
    const listos = pedidosDelivery.filter(p => p.estado === 'listo').length;
    const enCamino = pedidosDelivery.filter(p => p.estado === 'en_camino').length;
    const entregados = pedidosDelivery.filter(p => p.estado === 'entregado').length;
    const cancelados = pedidosDelivery.filter(p => p.estado === 'cancelado').length;
    const totalHoy = pedidosDelivery
      .filter(p => p.estado === 'pagado' || p.estado === 'entregado')
      .reduce((s, p) => s + p.total, 0);

    const ultimos = await this.prisma.withTenant().pedido.findMany({
      where: { restauranteId: rid, delivery: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return {
      success: true,
      data: {
        pendientes,
        cocinando,
        listos,
        enCamino,
        entregados,
        cancelados,
        total_hoy: String(totalHoy),
        pedidos: ultimos.map(p => ({
          id: p.id,
          numero_orden: p.numeroOrden,
          estado: p.estado,
          nombre_cliente: p.nombreCliente,
          items: p.items,
          total: String(p.total),
          created_at: p.createdAt,
        })),
      },
    };
  }

  @Get('pedidos/historial')
  async historialCaja(@CurrentUser('restauranteId') rid: number) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId: rid,
        estado: { in: ['pagado', 'entregado'] as any },
        createdAt: { gte: hoy, lt: manana },
      },
    });

    const resumen: Record<string, number> = {};
    let totalPropinas = 0;

    for (const p of pedidos) {
      const mp = p.metodoPago || 'efectivo';
      resumen[mp] = (resumen[mp] || 0) + p.total;
      totalPropinas += p.propina || 0;
    }

    const resumenStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(resumen)) resumenStr[k] = String(v);
    resumenStr['propinas'] = String(totalPropinas);
    resumenStr['total'] = String(Object.values(resumen).reduce((a, b) => a + b, 0));

    return { success: true, resumen: resumenStr };
  }

  @Get('pedidos/pagados')
  async pedidosPagados(
    @CurrentUser('restauranteId') rid: number,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
    @Query('cliente_nombre') clienteNombre?: string,
    @Query('cliente_ruc') clienteRuc?: string,
    @Query('numero_orden') numeroOrden?: string,
    @Query('numero_factura') numeroFactura?: string,
    @Query('timbrado') timbrado?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const where: any = { restauranteId: rid, estado: 'pagado' };
    if (fechaDesde || fechaHasta) {
      where.createdAt = {};
      if (fechaDesde) where.createdAt.gte = new Date(fechaDesde);
      if (fechaHasta) where.createdAt.lte = new Date(fechaHasta + 'T23:59:59');
    }
    if (clienteNombre) where.clienteNombre = { contains: clienteNombre, mode: 'insensitive' };
    if (clienteRuc) where.clienteRuc = { contains: clienteRuc };
    if (numeroOrden) where.numeroOrden = { contains: numeroOrden };
    if (numeroFactura) where.comprobanteNro = { contains: numeroFactura };
    if (timbrado) where.timbrado = { contains: timbrado };

    const total = await this.prisma.withTenant().pedido.count({ where });

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where,
      include: { mesa: { select: { numero: true } }, mesero: { select: { nombre: true } } },
      orderBy: { createdAt: 'desc' },
      take: +(limit || 20),
      skip: +(offset || 0),
    });

    return {
      success: true,
      pedidos: pedidos.map(p => ({
        id: p.id,
        numero_orden: p.numeroOrden,
        mesa_numero: p.mesa?.numero,
        mesero_nombre: p.mesero?.nombre,
        estado: p.estado,
        items: p.items,
        total: String(p.total),
        metodo_pago: p.metodoPago,
        propina: String(p.propina),
        cliente_nombre: p.clienteNombre,
        created_at: p.createdAt,
      })),
      total,
    };
  }
}
