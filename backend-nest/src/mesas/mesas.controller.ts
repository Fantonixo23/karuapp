import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { MesasService } from './mesas.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RealtimeService } from '../realtime/realtime.service';

@Controller('api/mesas')
export class MesasController {
  constructor(
    private service: MesasService,
    private realtime: RealtimeService,
  ) {}

  @Get()
  async listar(@CurrentUser('restauranteId') rid: number) {
    const mesas = await this.service.listar(rid);
    return { success: true, mesas };
  }

  @Post('crear')
  @Roles('administrador')
  async crear(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const mesa = await this.service.crear(rid, body);
    return { success: true, mesa };
  }

  @Put(':id/editar')
  @Roles('administrador')
  async editar(@CurrentUser('restauranteId') rid: number, @Param('id') id: string, @Body() body: any) {
    const mesa = await this.service.editar(rid, +id, body);
    return { success: true, mesa };
  }

  @Delete(':id/eliminar')
  @Roles('administrador')
  async eliminar(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    return this.service.eliminar(rid, +id);
  }

  @Post(':id/estado')
  async cambiarEstado(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: { estado: string; comensales?: number },
  ) {
    const mesa = await this.service.cambiarEstado(rid, +id, body.estado, body.comensales);
    await this.realtime.emitMesaUpdate(rid, { id: mesa.id, numero: mesa.numero, estado: mesa.estado });
    return { success: true, mesa };
  }
}
