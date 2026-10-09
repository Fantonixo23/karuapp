import { Controller, Get, Post, Body } from '@nestjs/common';
import { CajaService } from './caja.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('api/caja')
export class CajaController {
  constructor(private service: CajaService) {}

  @Post('apertura')
  @Roles('administrador', 'cajero')
  async apertura(@CurrentUser('restauranteId') rid: number, @CurrentUser('sub') uid: number, @Body() body: any) {
    return this.service.apertura(rid, uid, body);
  }

  @Get('sesion-actual')
  async sesionActual(@CurrentUser('restauranteId') rid: number) {
    return this.service.sesionActual(rid);
  }

  @Post('movimiento')
  @Roles('administrador', 'cajero')
  async movimiento(@CurrentUser('restauranteId') rid: number, @CurrentUser('sub') uid: number, @Body() body: any) {
    return this.service.movimiento(rid, uid, body);
  }

  @Get('movimientos')
  async movimientos(@CurrentUser('restauranteId') rid: number) {
    return this.service.movimientosLista(rid);
  }

  @Post('arqueo')
  @Roles('administrador', 'cajero')
  async arqueo(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    return this.service.arqueo(rid, body);
  }

  @Post('cierre')
  @Roles('administrador')
  async cierre(@CurrentUser('restauranteId') rid: number, @CurrentUser('sub') uid: number, @Body() body: any) {
    return this.service.cierre(rid, uid, body);
  }

  @Get('cortes')
  async cortes(@CurrentUser('restauranteId') rid: number) {
    const cortes = await this.service.cortesLista(rid);
    return { success: true, cortes };
  }
}
