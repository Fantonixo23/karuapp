import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocketGateway } from '../socket/socket.gateway';

const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  pendiente: ['cocinando', 'cancelado'],
  cocinando: ['listo', 'cancelado'],
  listo: ['en_camino', 'entregado', 'cancelado'],
  en_camino: ['entregado', 'cancelado'],
  entregado: ['pagado', 'cancelado'],
  pagado: [],
  cancelado: [],
};

@Injectable()
export class PedidosService {
  constructor(
    private prisma: PrismaService,
    private socket: SocketGateway,
  ) {}

  async listar(restauranteId: number, filtros?: { estado?: string; delivery?: string }) {
    const where: any = { restauranteId };
    if (filtros?.estado) where.estado = filtros.estado;
    if (filtros?.delivery) where.delivery = true;

    return this.prisma.withTenant().pedido.findMany({
      where,
      include: { mesa: { select: { id: true, numero: true } }, mesero: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async crear(restauranteId: number, data: any, usuarioId: number) {
    const items = data.items || [];
    if (!items.length) throw new BadRequestException('El pedido debe tener al menos un item');

    const itemsValidados = await this.validarItems(restauranteId, items);
    const total = itemsValidados.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const pedidosHoy = await this.prisma.withTenant().pedido.findMany({
      where: { restauranteId, createdAt: { gte: hoy, lt: manana } },
      select: { numeroOrden: true },
      orderBy: { numeroOrden: 'desc' },
      take: 1,
    });

    let numeroOrden = '001';
    if (pedidosHoy.length > 0) {
      const last = parseInt(pedidosHoy[0].numeroOrden || '0', 10);
      numeroOrden = String(last + 1).padStart(3, '0');
    }

    const pedido = await this.prisma.withTenant().pedido.create({
      data: {
        restauranteId,
        mesaId: data.mesa_id || null,
        meseroId: data.mesero_id || usuarioId || null,
        items: itemsValidados as any,
        total,
        notas: data.notas || data.nota,
        tipoPedido: data.tipo_pedido || 'mesa',
        delivery: data.delivery || false,
        nombreCliente: data.nombre_cliente || null,
        telefonoCliente: data.telefono_cliente || null,
        direccion: data.direccion || null,
        numeroOrden,
      },
      include: { mesa: { select: { id: true, numero: true } } },
    });

    if (data.mesa_id) {
      await this.prisma.withTenant().mesa.update({
        where: { id: data.mesa_id },
        data: { estado: 'ocupada' },
      });

      await this.socket.emitMesaUpdate(restauranteId, { id: data.mesa_id, estado: 'ocupada' });
    }

    await this.socket.emitNuevoPedidoCocina(restauranteId, {
      id: pedido.id,
      numero_orden: pedido.numeroOrden,
      estado: pedido.estado,
      mesa: pedido.mesa?.numero || null,
      delivery: pedido.delivery,
      nombre_cliente: pedido.nombreCliente,
      items: pedido.items,
      total: String(pedido.total),
    });

    return pedido;
  }

  async cambiarEstado(restauranteId: number, id: number, nuevoEstado: string) {
    const pedido = await this.prisma.withTenant().pedido.findFirst({ where: { id, restauranteId } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const transiciones = TRANSICIONES_VALIDAS[pedido.estado] || [];
    if (!transiciones.includes(nuevoEstado)) {
      throw new BadRequestException(`Transición inválida: ${pedido.estado} → ${nuevoEstado}`);
    }

    const updated = await this.prisma.withTenant().pedido.update({
      where: { id },
      data: { estado: nuevoEstado as any },
    });

    await this.socket.emitPedidoUpdate(restauranteId, { id: updated.id, numero_orden: updated.numeroOrden, estado: updated.estado });

    return updated;
  }

  async agregarItems(restauranteId: number, id: number, items: any[]) {
    if (!items.length) throw new BadRequestException('No hay items para agregar');

    const pedido = await this.prisma.withTenant().pedido.findFirst({ where: { id, restauranteId } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
      throw new BadRequestException('No se pueden agregar items a un pedido pagado o cancelado');
    }

    const itemsValidados = await this.validarItems(restauranteId, items);
    const itemsActuales = (pedido.items as any[]) || [];
    itemsActuales.push(...itemsValidados);

    const total = itemsActuales.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

    const updated = await this.prisma.withTenant().pedido.update({
      where: { id },
      data: { items: itemsActuales as any, total },
    });

    await this.socket.emitPedidoModificado(restauranteId, { id: updated.id, numero_orden: updated.numeroOrden, items: updated.items, total: String(updated.total) });

    return updated;
  }

  async reemplazarItems(restauranteId: number, id: number, items: any[]) {
    if (!items.length) throw new BadRequestException('El pedido debe tener al menos un item');

    const pedido = await this.prisma.withTenant().pedido.findFirst({ where: { id, restauranteId } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
      throw new BadRequestException('No se puede modificar un pedido pagado o cancelado');
    }

    const itemsValidados = await this.validarItems(restauranteId, items);
    const total = itemsValidados.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

    const updated = await this.prisma.withTenant().pedido.update({
      where: { id },
      data: { items: itemsValidados as any, total },
    });

    await this.socket.emitPedidoModificado(restauranteId, { id: updated.id, numero_orden: updated.numeroOrden, items: updated.items, total: String(updated.total) });

    return updated;
  }

  async eliminarItem(restauranteId: number, id: number, idx: number) {
    const pedido = await this.prisma.withTenant().pedido.findFirst({ where: { id, restauranteId } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
      throw new BadRequestException('No se puede modificar un pedido pagado o cancelado');
    }

    const items = (pedido.items as any[]) || [];
    if (idx < 0 || idx >= items.length) throw new NotFoundException('Item no encontrado');

    items.splice(idx, 1);
    if (!items.length) throw new BadRequestException('No se puede eliminar el único item. Cancele el pedido.');

    const total = items.reduce((sum, item) => sum + item.cantidad * item.precio, 0);
    const updated = await this.prisma.withTenant().pedido.update({
      where: { id },
      data: { items: items as any, total },
    });

    await this.socket.emitPedidoModificado(restauranteId, { id: updated.id, numero_orden: updated.numeroOrden, items: updated.items, total: String(updated.total) });

    return updated;
  }

  async pagar(restauranteId: number, id: number, data: any, usuarioId: number) {
    const pedido = await this.prisma.withTenant().pedido.findFirst({ where: { id, restauranteId } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const transiciones = TRANSICIONES_VALIDAS[pedido.estado] || [];
    if (!transiciones.includes('pagado')) {
      throw new BadRequestException(`No se puede pagar un pedido en estado ${pedido.estado}`);
    }

    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
    });
    if (!session) throw new BadRequestException('No hay una sesión de caja abierta');

    const metodoPago = data.metodo_pago || 'efectivo';
    const propina = data.propina || 0;
    const totalConPropina = pedido.total + propina;

    const updated = await this.prisma.withTenant().pedido.update({
      where: { id },
      data: {
        estado: 'pagado',
        metodoPago,
        propina,
        marcaTarjeta: data.marca_tarjeta || '',
        ultimos4: data.ultimos_4 || '',
        comprobanteNro: data.comprobante_nro || '',
        marcaQr: data.marca_qr || '',
        cuotas: data.cuotas || 1,
        tipoIva: data.tipo_iva || 10,
      },
    });

    await this.prisma.withTenant().movimientoCaja.create({
      data: {
        restauranteId,
        sessionId: session.id,
        tipo: 'venta',
        metodoPago,
        monto: totalConPropina,
        moneda: 'PYG',
        montoPyg: totalConPropina,
        pedidoId: id,
        propina,
        usuarioId: usuarioId || null,
      },
    });

    if (pedido.mesaId) {
      const otrosActivos = await this.prisma.withTenant().pedido.count({
        where: {
          mesaId: pedido.mesaId,
          estado: { in: ['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado'] },
          id: { not: id },
        },
      });
      if (!otrosActivos) {
        await this.prisma.withTenant().mesa.update({
          where: { id: pedido.mesaId },
          data: { estado: 'disponible' },
        });
      }
    }

    await this.socket.emitPedidoUpdate(restauranteId, { id: updated.id, numero_orden: updated.numeroOrden, estado: 'pagado' });
    await this.socket.emitCobro(restauranteId, { pedido_id: id, total: totalConPropina, metodo_pago: metodoPago });

    return updated;
  }

  async pedidosPorMesa(restauranteId: number, mesaId: number) {
    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        mesaId,
        estado: { notIn: ['pagado', 'cancelado'] },
      },
      include: { mesero: { select: { id: true, nombre: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const totalMesa = pedidos.reduce((sum, p) => sum + p.total, 0);

    return { pedidos, total_mesa: totalMesa, cantidad: pedidos.length };
  }

  private async validarItems(restauranteId: number, items: any[]) {
    const itemsValidados: any[] = [];
    for (const item of items) {
      if (!item.producto_id) throw new BadRequestException('Cada item debe tener producto_id');

      const producto = await this.prisma.withTenant().producto.findFirst({
        where: { id: item.producto_id, restauranteId },
        include: { categoria: { select: { nombre: true } } },
      });
      if (!producto) throw new NotFoundException(`Producto ${item.producto_id} no encontrado`);
      if (!producto.disponible) throw new BadRequestException(`El producto ${producto.nombre} no está disponible`);

      const cantidad = item.cantidad || 1;
      const precio = item.precio || producto.precio;

      itemsValidados.push({
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        categoria_nombre: producto.categoria?.nombre || null,
        cantidad,
        precio,
        variante: item.variante || null,
        nota: item.nota || '',
      });
    }
    return itemsValidados;
  }
}
