import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  handleConnection(client: Socket) {
    const restaurante = (client.handshake.query.restaurante as string)
      || (client.handshake.auth as any)?.restaurante
      || this.getRestauranteFromCookie(client);

    if (restaurante) {
      client.join(restaurante);
    }
  }

  handleDisconnect(_client: Socket) {}

  async emitMesaUpdate(restauranteId: number, mesa: any) {
    const slug = await this.getSlug(restauranteId);
    if (slug) this.server.to(slug).emit('mesa_update', mesa);
  }

  async emitPedidoUpdate(restauranteId: number, pedido: any) {
    const slug = await this.getSlug(restauranteId);
    if (slug) this.server.to(slug).emit('pedido_update', pedido);
  }

  async emitNuevoPedidoCocina(restauranteId: number, pedido: any) {
    const slug = await this.getSlug(restauranteId);
    if (slug) this.server.to(slug).emit('nuevo_pedido_cocina', pedido);
  }

  async emitPedidoModificado(restauranteId: number, pedido: any) {
    const slug = await this.getSlug(restauranteId);
    if (slug) this.server.to(slug).emit('pedido_modificado', pedido);
  }

  async emitCobro(restauranteId: number, cobro: any) {
    const slug = await this.getSlug(restauranteId);
    if (slug) this.server.to(slug).emit('cobro', cobro);
  }

  private slugCache = new Map<number, string>();

  private async getSlug(restauranteId: number): Promise<string | null> {
    if (!restauranteId) return null;
    if (this.slugCache.has(restauranteId)) return this.slugCache.get(restauranteId)!;

    const rest = await this.prisma.bypassRls<{ slug: string } | null>((tx) =>
      tx.restaurante.findUnique({
        where: { id: restauranteId },
        select: { slug: true },
      }),
    );
    if (rest) {
      this.slugCache.set(restauranteId, rest.slug);
      return rest.slug;
    }
    return null;
  }

  private getRestauranteFromCookie(client: Socket): string | null {
    const cookie = client.handshake.headers.cookie;
    if (!cookie) return null;
    for (const part of cookie.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith('restaurante=')) {
        return trimmed.split('=', 2)[1];
      }
    }
    return null;
  }
}
