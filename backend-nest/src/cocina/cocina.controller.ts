import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { CocinaService } from './cocina.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/cocina')
export class CocinaController {
  constructor(private service: CocinaService) {}

  @Get('pedidos')
  async listarPedidos(@CurrentUser('restauranteId') rid: number) {
    const pedidos = await this.service.listarPedidos(rid);
    return { success: true, pedidos };
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
}
