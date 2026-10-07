import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/facturacion')
export class FacturacionController {
  constructor(private service: FacturacionService) {}

  @Get('config')
  async getConfig(@CurrentUser('restauranteId') rid: number) {
    const config = await this.service.getConfig(rid);
    return { success: true, config };
  }

  @Post('config/actualizar')
  @Roles('administrador')
  async actualizarConfig(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const config = await this.service.actualizarConfig(rid, body);
    return { success: true, config };
  }

  @Put('config/actualizar')
  @Roles('administrador')
  async actualizarConfigPut(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const config = await this.service.actualizarConfig(rid, body);
    return { success: true, config };
  }

  @Get('metodos-pago')
  async listarMetodosPago(@CurrentUser('restauranteId') rid: number) {
    const metodos = await this.service.listarMetodosPago(rid);
    return { success: true, metodos_pago: metodos };
  }

  @Post('metodos-pago/crear')
  @Roles('administrador')
  async crearMetodoPago(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const metodo = await this.service.crearMetodoPago(rid, body);
    return { success: true, metodo_pago: metodo };
  }

  @Delete('metodos-pago/:id/eliminar')
  @Roles('administrador')
  async eliminarMetodoPago(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    return this.service.eliminarMetodoPago(rid, +id);
  }

  @Put('metodos-pago/:id/editar')
  @Roles('administrador')
  async editarMetodoPago(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const metodo = await this.service.actualizarMetodoPago(rid, +id, body);
    if (!metodo) return { success: false, error: 'Método de pago no encontrado' };
    return { success: true, metodo_pago: metodo };
  }

  @Get('timbrados')
  @Roles('administrador')
  async listarTimbrados(@CurrentUser('restauranteId') rid: number) {
    const timbrados = await this.service.listarTimbrados(rid);
    return { success: true, timbrados };
  }

  @Post('timbrados/crear')
  @Roles('administrador')
  async crearTimbrado(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const timbrado = await this.service.crearTimbrado(rid, body);
    return { success: true, timbrado };
  }

  @Get('facturas')
  async listarFacturas(@CurrentUser('restauranteId') rid: number) {
    const facturas = await this.service.listarFacturas(rid);
    return { success: true, facturas };
  }

  @Get('buscar-ruc')
  async buscarRuc(@CurrentUser('restauranteId') rid: number, @Query('q') q: string) {
    if (!q || q.length < 3) {
      return { success: false, error: 'Mínimo 3 caracteres' };
    }
    const resultados = await this.service.buscarRuc(rid, q);
    return { success: true, resultados };
  }
}
