import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../database/database.service';

/**
 * Realtime con Supabase en vez de Socket.IO.
 *
 * Serverless no sostiene conexiones WebSocket persistentes, asi que la salida
 * de eventos no usa un servidor socket: se emite por `realtime.send()` desde la
 * propia base (Supabase Realtime). Los 5 helpers conservan la firma que tenia
 * SocketGateway para que los llamadores no cambien semantica.
 *
 * El broadcast sale como `postgres` (runBypassRls) al topic `restaurante:<id>`.
 * Del lado del cliente, quien se suscribe debe pasar un `access_token` de
 * Realtime (POST /api/auth/realtime-token) con claim `restaurante_id`; las
 * politicas de `realtime.messages` restringen el canal a ese tenant (ver
 * supabase/realtime_policies.sql). En modo canales publicos el mensaje
 * llega igual, pero sin el token no deberia usarse en produccion.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private sendDisponible: boolean | null = null;

  constructor(private db: DatabaseService) {}

  async emitEvent(restauranteId: number, evento: string, payload: unknown): Promise<void> {
    if (!restauranteId) return;

    if (this.sendDisponible === null) {
      this.sendDisponible = await this.realtimeDisponible();
    }
    if (!this.sendDisponible) return;

    try {
      await this.db.runBypassRls((db) =>
        sql`select realtime.send(${JSON.stringify(payload)}::jsonb, ${evento}, ${`restaurante:${restauranteId}`}, true)`.execute(
          db,
        ),
      );
    } catch (e) {
      this.logger.warn(`realtime.send('${evento}') fallo: ${(e as Error).message}`);
    }
  }

  private async realtimeDisponible(): Promise<boolean> {
    try {
      const fila = await this.db.runBypassRls((db) =>
        sql<{ f: string | null }>`select to_regprocedure('realtime.send(jsonb,text,text,boolean)') as f`.execute(db),
      );
      const proc = fila[0]?.f;
      if (!proc) this.logger.warn('realtime.send() no existe: los eventos no se emiten.');
      return Boolean(proc);
    } catch (e) {
      this.logger.warn(`No se pudo verificar realtime.send: ${(e as Error).message}`);
      return false;
    }
  }

  async emitMesaUpdate(restauranteId: number, mesa: unknown) {
    await this.emitEvent(restauranteId, 'mesa_update', mesa);
  }

  async emitPedidoUpdate(restauranteId: number, pedido: unknown) {
    await this.emitEvent(restauranteId, 'pedido_update', pedido);
  }

  async emitNuevoPedidoCocina(restauranteId: number, pedido: unknown) {
    await this.emitEvent(restauranteId, 'nuevo_pedido_cocina', pedido);
  }

  async emitPedidoModificado(restauranteId: number, pedido: unknown) {
    await this.emitEvent(restauranteId, 'pedido_modificado', pedido);
  }

  async emitCobro(restauranteId: number, cobro: unknown) {
    await this.emitEvent(restauranteId, 'cobro', cobro);
  }
}