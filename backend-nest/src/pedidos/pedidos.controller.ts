import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { PedidosService } from './pedidos.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api')
export class PedidosController {
  constructor(private service: PedidosService) {}

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

  @Put('pedidos/:id/items/reemplazar')
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
        metodo_pago: pedido.metodo_pago,
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
    return this.service.cobrarMesa(rid, +mesaId, body, uid);
  }

  @Get('pedidos/delivery/dashboard')
  async dashboardDelivery(@CurrentUser('restauranteId') rid: number) {
    return this.service.dashboardDelivery(rid);
  }

  @Get('pedidos/historial')
  async historialCaja(@CurrentUser('restauranteId') rid: number) {
    return this.service.historialCaja(rid);
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.pedidosPagados(rid, {
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      cliente_nombre: clienteNombre,
      cliente_ruc: clienteRuc,
      numero_orden: numeroOrden,
      numero_factura: numeroFactura,
      limit,
      offset,
    });
  }
}
