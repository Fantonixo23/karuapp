import { Controller, Get, Query } from '@nestjs/common';
import { InformesService } from './informes.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { fechaParaguayISO } from '../common/fecha';

@Controller('api/informes')
export class InformesController {
  constructor(private service: InformesService) {}

  @Get('ventas-hoy')
  async ventasHoy(@CurrentUser('restauranteId') rid: number) {
    const data = await this.service.ventasHoy(rid);
    return { success: true, data };
  }

  @Get('resumen-completo')
  async resumenCompleto(
    @CurrentUser('restauranteId') rid: number,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    const data = await this.service.resumenCompleto(rid, fechaInicio, fechaFin);
    return { success: true, data };
  }

  @Get('ventas-por-dia')
  async ventasPorDia(
    @CurrentUser('restauranteId') rid: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('dias') dias?: string,
  ) {
    // El frontend manda `dias=N`; el backend trabaja con rango de fechas.
    let d = desde;
    let h = hasta;
    if (!d && !h && dias) {
      const n = Math.max(1, Math.min(365, Number(dias) || 1));
      d = fechaParaguayISO(n - 1);
      h = fechaParaguayISO(0);
    }
    const data = await this.service.ventasPorDia(rid, d, h);
    return { success: true, data };
  }

  @Get('productos-estadisticas')
  async productosEstadisticas(
    @CurrentUser('restauranteId') rid: number,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
    @Query('limite') limite?: string,
  ) {
    const data = await this.service.productosEstadisticas(rid, fechaInicio, fechaFin, limite);
    return { success: true, data };
  }

  @Get('metodos-pago')
  async metodosPago(
    @CurrentUser('restauranteId') rid: number,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
  ) {
    const data = await this.service.metodosPago(rid, desde || fechaInicio, hasta || fechaFin);
    return { success: true, data };
  }

  @Get('pedidos-lista')
  async pedidosLista(
    @CurrentUser('restauranteId') rid: number,
    @Query('fecha_desde') fechaDesde?: string,
    @Query('fecha_hasta') fechaHasta?: string,
    @Query('fecha_inicio') fechaInicio?: string,
    @Query('fecha_fin') fechaFin?: string,
    @Query('cliente_nombre') clienteNombre?: string,
    @Query('numero_orden') numeroOrden?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const pedidos = await this.service.pedidosLista(rid, {
      fecha_desde: fechaDesde || fechaInicio,
      fecha_hasta: fechaHasta || fechaFin,
      cliente_nombre: clienteNombre,
      numero_orden: numeroOrden,
      limit: limit || '20',
      offset: offset || '0',
    });
    return { success: true, data: { pedidos, total: pedidos.length } };
  }
}
