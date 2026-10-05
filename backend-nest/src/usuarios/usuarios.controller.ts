import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api')
export class UsuariosController {
  constructor(private service: UsuariosService) {}

  @Get('funcionarios')
  @Roles('administrador')
  async listar(@CurrentUser('restauranteId') rid: number) {
    const funcionarios = await this.service.listar(rid);
    return { success: true, funcionarios };
  }

  @Post('funcionarios/crear')
  @Roles('administrador')
  async crear(@CurrentUser('restauranteId') rid: number, @CurrentUser('sub') userId: number, @Body() body: any) {
    const funcionario = await this.service.crear(rid, { ...body, creadoPorId: userId });
    return { success: true, funcionario };
  }

  @Post('funcionarios/:id/editar')
  @Roles('administrador')
  async editar(@CurrentUser('restauranteId') rid: number, @Param('id') id: string, @Body() body: any) {
    const funcionario = await this.service.editar(rid, +id, body);
    return { success: true, funcionario };
  }

  @Delete('funcionarios/:id/eliminar')
  @Roles('administrador')
  async eliminar(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    return this.service.eliminar(rid, +id);
  }

  @Post('funcionarios/:id/regenerar-pin')
  @Roles('administrador')
  async regenerarPin(@CurrentUser('restauranteId') rid: number, @Param('id') id: string, @Body() body: { pin: string }) {
    const funcionario = await this.service.regenerarPin(rid, +id, body.pin);
    return { success: true, funcionario };
  }
}
