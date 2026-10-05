import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocketGateway } from '../socket/socket.gateway';

@Injectable()
export class CocinaService {
  constructor(
    private prisma: PrismaService,
    private socket: SocketGateway,
  ) {}

  async listarPedidos(restauranteId: number) {
    return this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        estado: { in: ['pendiente', 'cocinando', 'listo'] as any },
      },
      include: {
        mesa: { select: { id: true, numero: true } },
      },
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async cambiarEstado(restauranteId: number, id: number, estado: string) {
    const pedido = await this.prisma.withTenant().pedido.findFirst({ where: { id, restauranteId } });
    if (!pedido) throw new NotFoundException('Pedido no encontrado');

    const validTransitions: Record<string, string[]> = {
      pendiente: ['cocinando', 'listo', 'cancelado'],
      cocinando: ['listo', 'cancelado'],
      listo: ['entregado', 'cancelado'],
    };

    const allowed = validTransitions[pedido.estado] || [];
    if (!allowed.includes(estado)) {
      throw new BadRequestException(`Transición inválida: ${pedido.estado} → ${estado}`);
    }

    const updated = await this.prisma.withTenant().pedido.update({
      where: { id },
      data: { estado: estado as any },
    });

    await this.socket.emitPedidoUpdate(restauranteId, { id: updated.id, numero_orden: updated.numeroOrden, estado: updated.estado });

    return updated;
  }
}
