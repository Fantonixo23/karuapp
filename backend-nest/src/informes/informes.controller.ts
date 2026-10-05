import { Controller, Get, Query } from '@nestjs/common';
import { InformesService } from './informes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/informes')
export class InformesController {
  constructor(private service: InformesService) {}

  @Get('ventas-hoy')
  async ventasHoy(@CurrentUser('restauranteId') rid: number) {
    const ventas = await this.service.ventasHoy(rid);
    return { success: true, ventas };
  }

  @Get('resumen-completo')
  async resumenCompleto(@CurrentUser('restauranteId') rid: number) {
    return this.service.resumenCompleto(rid);
  }

  @Get('ventas-por-dia')
  async ventasPorDia(
    @CurrentUser('restauranteId') rid: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const ventas = await this.service.ventasPorDia(rid, desde, hasta);
    return { success: true, ventas };
  }

  @Get('productos-estadisticas')
  async productosEstadisticas(@CurrentUser('restauranteId') rid: number) {
    return this.service.productosEstadisticas(rid);
  }

  @Get('metodos-pago')
  async metodosPago(
    @CurrentUser('restauranteId') rid: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.metodosPago(rid, desde, hasta);
  }

  @Get('pedidos-lista')
  async pedidosLista(
    @CurrentUser('restauranteId') rid: number,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
    @Query('cliente_nombre') clienteNombre?: string,
    @Query('numero_orden') numeroOrden?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const pedidos = await this.service.pedidosLista(rid, {
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      cliente_nombre: clienteNombre,
      numero_orden: numeroOrden,
      limit: limit || '20',
      offset: offset || '0',
    });
    return { success: true, pedidos };
  }
}
