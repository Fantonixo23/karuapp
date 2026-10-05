import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('restaurantes')
  async listarTodos() {
    return this.prisma.withTenant().restaurante.findMany({
      orderBy: { fechaAlta: 'desc' },
      include: {
        _count: { select: { usuarios: true } },
        usuarios: {
          where: { rol: 'administrador' },
          select: { id: true, nombre: true, email: true, telefono: true },
          take: 1,
        },
      },
    });
  }

  @Get('restaurantes/:id')
  async detalle(@Param('id') id: string) {
    return this.prisma.withTenant().restaurante.findUnique({
      where: { id: Number(id) },
      include: {
        usuarios: { select: { id: true, nombre: true, email: true, rol: true, activo: true, telefono: true, ultimoAcceso: true } },
        pagos: { orderBy: { fecha: 'desc' } },
      },
    });
  }

  @Patch('restaurantes/:id/licencia')
  async actualizarLicencia(
    @Param('id') id: string,
    @Body() body: { plan?: string; fechaExpiracion?: string; estadoLicencia?: string; motivoBloqueo?: string },
  ) {
    const data: any = {};
    if (body.plan !== undefined) data.plan = body.plan;
    if (body.fechaExpiracion !== undefined) data.fechaExpiracion = new Date(body.fechaExpiracion);
    if (body.estadoLicencia !== undefined) data.estadoLicencia = body.estadoLicencia;
    if (body.motivoBloqueo !== undefined) data.motivoBloqueo = body.motivoBloqueo;

    return this.prisma.withTenant().restaurante.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Patch('restaurantes/:id/estado')
  async cambiarEstado(@Param('id') id: string, @Body() body: { estadoLicencia: string; motivoBloqueo?: string }) {
    const data: any = { estadoLicencia: body.estadoLicencia };
    if (body.motivoBloqueo !== undefined) data.motivoBloqueo = body.motivoBloqueo;
    if (body.estadoLicencia === 'activo') data.motivoBloqueo = null;
    return this.prisma.withTenant().restaurante.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Post('restaurantes/:id/pagos')
  async registrarPago(
    @Param('id') id: string,
    @Body() body: { monto: number; moneda?: string; nota?: string },
    @CurrentUser('sub') superadminId: number,
  ) {
    return this.prisma.withTenant().pagoLicencia.create({
      data: {
        restauranteId: Number(id),
        monto: body.monto,
        moneda: body.moneda || 'PYG',
        nota: body.nota,
        registradoPor: superadminId,
      },
    });
  }

  @Get('restaurantes/:id/total-pagado')
  async totalPagado(@Param('id') id: string) {
    const resultado = await this.prisma.withTenant().pagoLicencia.aggregate({
      where: { restauranteId: Number(id) },
      _sum: { monto: true },
    });
    return { total: resultado._sum.monto || 0 };
  }

  @Delete('usuarios/:userId')
  async eliminarUsuario(@Param('userId') userId: string) {
    const usuario = await this.prisma.bypassRls<any>((tx) =>
      tx.usuario.findUnique({ where: { id: Number(userId) }, select: { id: true, nombre: true, email: true } }),
    );
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.bypassRls((tx) =>
      tx.verificationCode.deleteMany({ where: { email: usuario.email } }),
    );

    await this.prisma.bypassRls((tx) =>
      tx.usuario.delete({ where: { id: Number(userId) } }),
    );

    return { success: true, message: `Usuario "${usuario.nombre}" eliminado permanentemente` };
  }

  @Delete('restaurantes/:id')
  async eliminarRestaurante(@Param('id') id: string) {
    const restaurante = await this.prisma.bypassRls<any>((tx) =>
      tx.restaurante.findUnique({ where: { id: Number(id) }, select: { id: true, nombre: true } }),
    );
    if (!restaurante) throw new NotFoundException('Restaurante no encontrado');

    const rid = Number(id);

    await this.prisma.bypassRls(async (tx) => {
      await tx.pagoLicencia.deleteMany({ where: { restauranteId: rid } });
      await tx.movimientoInventario.deleteMany({ where: { restauranteId: rid } });
      await tx.inventario.deleteMany({ where: { restauranteId: rid } });
      await tx.corteCaja.deleteMany({ where: { restauranteId: rid } });
      await tx.movimientoCaja.deleteMany({ where: { restauranteId: rid } });
      await tx.cajaSession.deleteMany({ where: { restauranteId: rid } });
      await tx.impresion.deleteMany({ where: { restauranteId: rid } });
      await tx.factura.deleteMany({ where: { restauranteId: rid } });
      await tx.metodoPago.deleteMany({ where: { restauranteId: rid } });
      await tx.configuracion.deleteMany({ where: { restauranteId: rid } });
      await tx.timbrado.deleteMany({ where: { restauranteId: rid } });
      await tx.pedido.deleteMany({ where: { restauranteId: rid } });
      await tx.mesa.deleteMany({ where: { restauranteId: rid } });
      await tx.producto.deleteMany({ where: { restauranteId: rid } });
      await tx.categoria.deleteMany({ where: { restauranteId: rid } });
      await tx.verificationCode.deleteMany({ where: { email: { in: (await tx.usuario.findMany({ where: { restauranteId: rid }, select: { email: true } })).map(u => u.email).filter(Boolean) } } });
      await tx.usuario.deleteMany({ where: { restauranteId: rid } });
      await tx.restaurante.delete({ where: { id: rid } });
    });

    return { success: true, message: `Restaurante "${restaurante.nombre}" y todos sus datos eliminados permanentemente` };
  }
}
