import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MesasService {
  constructor(private prisma: PrismaService) {}

  async listar(restauranteId: number) {
    return this.prisma.withTenant().mesa.findMany({
      where: { restauranteId },
      orderBy: { numero: 'asc' },
    });
  }

  async crear(restauranteId: number, data: { numero: number; nombre?: string; capacidad?: number; area?: string }) {
    const existente = await this.prisma.withTenant().mesa.findFirst({
      where: { restauranteId, numero: data.numero },
    });
    if (existente) throw new BadRequestException('Ya existe una mesa con ese número');

    return this.prisma.withTenant().mesa.create({
      data: {
        restauranteId,
        numero: data.numero,
        nombre: data.nombre,
        capacidad: data.capacidad || 4,
        area: (data.area as any) || 'principal',
      },
    });
  }

  async editar(restauranteId: number, id: number, data: any) {
    const mesa = await this.prisma.withTenant().mesa.findFirst({ where: { id, restauranteId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    return this.prisma.withTenant().mesa.update({
      where: { id },
      data: {
        nombre: data.nombre,
        capacidad: data.capacidad,
        area: data.area,
        estado: data.estado,
        comensales: data.comensales,
      },
    });
  }

  async eliminar(restauranteId: number, id: number) {
    const mesa = await this.prisma.withTenant().mesa.findFirst({ where: { id, restauranteId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    const pedidosActivos = await this.prisma.withTenant().pedido.count({
      where: { mesaId: id, estado: { in: ['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado'] as any } },
    });
    if (pedidosActivos > 0) throw new BadRequestException('No se puede eliminar una mesa con pedidos activos');

    await this.prisma.withTenant().mesa.delete({ where: { id } });
    return { success: true };
  }

  async cambiarEstado(restauranteId: number, id: number, estado: string, comensales?: number) {
    const mesa = await this.prisma.withTenant().mesa.findFirst({ where: { id, restauranteId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    return this.prisma.withTenant().mesa.update({
      where: { id },
      data: { estado: estado as any, comensales: comensales ?? mesa.comensales },
    });
  }
}
