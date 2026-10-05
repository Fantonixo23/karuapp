import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/inventario')
export class InventarioController {
  constructor(private service: InventarioService) {}

  @Get()
  async listar(@CurrentUser('restauranteId') rid: number) {
    const inventarios = await this.service.listar(rid);
    return { success: true, inventarios };
  }

  @Post('actualizar')
  @Roles('administrador')
  async actualizar(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const inventario = await this.service.actualizar(rid, body);
    return { success: true, inventario };
  }

  @Post('movimiento')
  @Roles('administrador')
  async movimiento(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const mov = await this.service.movimiento(rid, body);
    return { success: true, movimiento: mov };
  }

  @Delete(':id/eliminar')
  @Roles('administrador')
  async eliminar(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    return this.service.eliminar(rid, +id);
  }

  @Get('resumen')
  async resumen(@CurrentUser('restauranteId') rid: number) {
    const resumen = await this.service.resumen(rid);
    return { success: true, ...resumen };
  }

  @Get('alertas')
  async alertas(@CurrentUser('restauranteId') rid: number) {
    const alertas = await this.service.alertas(rid);
    return { success: true, alertas };
  }
}
