import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { countInt } from '../database/agg';

export interface MovCaja {
  id: number;
  tipo: string;
  metodo_pago: string;
  monto_pyg: number;
  propina: number;
  vuelto: number;
  motivo: string;
  pedido_numero: string | null;
  created_at: Date;
}

@Injectable()
export class CajaService {
  constructor(private db: DatabaseService) {}

  async apertura(restauranteId: number, usuarioId: number, data: { fondo_inicial: number; notas?: string }) {
    const session = await this.db.transaction(async (tx) => {
      const abierta = await tx
        .selectFrom('caja_sesiones')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (abierta) throw new BadRequestException('Ya hay una sesión de caja abierta. Ciérrela primero.');

      if (data.fondo_inicial < 0) throw new BadRequestException('El fondo inicial no puede ser negativo');

      return tx
        .insertInto('caja_sesiones')
        .values({
          restaurante_id: restauranteId,
          usuario_id: usuarioId || null,
          fondo_inicial: data.fondo_inicial,
          notas_apertura: data.notas || '',
          estado: 'abierta',
        })
        .returning(['id', 'fondo_inicial', 'apertura_en', 'estado'])
        .executeTakeFirstOrThrow();
    });

    return {
      success: true,
      session: {
        id: session.id,
        fondo_inicial: session.fondo_inicial,
        apertura_en: session.apertura_en,
        estado: session.estado,
      },
    };
  }

  async sesionActual(restauranteId: number) {
    const datos = await this.db.run(async (db) => {
      const session = await db
        .selectFrom('caja_sesiones')
        .select(['id', 'fondo_inicial', 'apertura_en', 'estado'])
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (!session) return null;

      const movimientos = await this.movimientosDeSesion(db, session.id);
      return { session, movimientos };
    });

    if (!datos) return { success: true, session: null, message: 'No hay sesión de caja abierta' };

    const totales = this.calcularTotales(datos.movimientos, datos.session.fondo_inicial);

    return {
      success: true,
      session: {
        id: datos.session.id,
        fondo_inicial: datos.session.fondo_inicial,
        apertura_en: datos.session.apertura_en,
        estado: datos.session.estado,
        totales: {
          total_pedidos: totales.totalPedidos,
          total_ventas: totales.totalVentas,
          ventas_efectivo: totales.ventasEfectivo,
          ventas_tarjeta: totales.ventasTarjeta,
          ventas_transferencia: totales.ventasTransferencia,
          ventas_qr: totales.ventasQr,
          total_general: totales.totalGeneral,
          propinas: totales.propinas,
          ingresos_extra: totales.ingresosExtra,
          retiros: totales.retiros,
          efectivo_esperado: totales.efectivoEsperado,
        },
      },
    };
  }

  async movimiento(restauranteId: number, usuarioId: number, data: { tipo: string; monto: number; motivo: string }) {
    if (!['ingreso_extra', 'retiro'].includes(data.tipo)) throw new BadRequestException('Tipo inválido');
    if (data.monto <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
    if (!data.motivo) throw new BadRequestException('Debe ingresar un motivo');

    const mov = await this.db.transaction(async (tx) => {
      const session = await tx
        .selectFrom('caja_sesiones')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (!session) throw new BadRequestException('No hay sesión de caja abierta');

      return tx
        .insertInto('caja_movimientos')
        .values({
          restaurante_id: restauranteId,
          session_id: session.id,
          tipo: data.tipo,
          metodo_pago: 'efectivo',
          monto: data.monto,
          moneda: 'PYG',
          monto_pyg: data.monto,
          motivo: data.motivo,
          usuario_id: usuarioId || null,
        })
        .returning(['id', 'tipo', 'monto_pyg', 'motivo', 'created_at'])
        .executeTakeFirstOrThrow();
    });

    return {
      success: true,
      movimiento: {
        id: mov.id,
        tipo: mov.tipo,
        monto_pyg: mov.monto_pyg,
        motivo: mov.motivo,
        created_at: mov.created_at,
      },
    };
  }

  async movimientosLista(restauranteId: number) {
    const movs = await this.db.run(async (db) => {
      const session = await db
        .selectFrom('caja_sesiones')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (!session) return null;

      return this.movimientosDeSesion(db, session.id);
    });

    if (!movs) return { success: true, movimientos: [] };

    return { success: true, movimientos: movs };
  }

  async arqueo(restauranteId: number, data: { denominaciones: any[] }) {
    const session = await this.db.run(async (db) =>
      db
        .selectFrom('caja_sesiones')
        .select(['id', 'fondo_inicial'])
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst(),
    );
    if (!session) throw new BadRequestException('No hay sesión de caja abierta');

    const totalContado = (data.denominaciones || []).reduce((sum, d) => sum + d.valor * d.cantidad, 0);
    const efectivoEsperado = await this.calcularEfectivoEsperado(session.id, session.fondo_inicial);
    const diferencia = totalContado - efectivoEsperado;

    return {
      success: true,
      arqueo: {
        denominaciones: data.denominaciones,
        total_contado: totalContado,
        total_esperado: efectivoEsperado,
        diferencia,
        tipo_diferencia: diferencia > 0 ? 'sobrante' : diferencia < 0 ? 'faltante' : '',
      },
    };
  }

  async cierre(restauranteId: number, usuarioId: number, data: { denominaciones: any[]; observaciones?: string }) {
    const resultado = await this.db.transaction(async (tx) => {
      const session = await tx
        .selectFrom('caja_sesiones')
        .select(['id', 'fondo_inicial'])
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (!session) throw new BadRequestException('No hay sesión de caja abierta');

      const pendientes = await tx
        .selectFrom('pedidos')
        .select(() => countInt())
        .where('restaurante_id', '=', restauranteId)
        .where('estado', 'not in', ['pagado', 'cancelado'])
        .executeTakeFirst();
      if ((pendientes?.c ?? 0) > 0) {
        throw new BadRequestException('No se puede cerrar caja con pedidos pendientes');
      }

      const movimientos = await this.movimientosDeSesion(tx, session.id);
      const totales = this.calcularTotales(movimientos, session.fondo_inicial);

      const totalContado = (data.denominaciones || []).reduce((sum, d) => sum + d.valor * d.cantidad, 0);
      const diferencia = totalContado - totales.efectivoEsperado;
      const tipoDiferencia = diferencia > 0 ? 'sobrante' : diferencia < 0 ? 'faltante' : '';

      const corte = await tx
        .insertInto('caja_cortes')
        .values({
          restaurante_id: restauranteId,
          session_id: session.id,
          usuario_cierre_id: usuarioId || null,
          fondo_inicial: session.fondo_inicial,
          total_ventas_efectivo: totales.ventasEfectivo,
          total_ventas_tarjeta: totales.ventasTarjeta,
          total_ventas_transferencia: totales.ventasTransferencia,
          total_ventas_qr: totales.ventasQr,
          total_ingresos_extra: totales.ingresosExtra,
          total_retiros: totales.retiros,
          total_propinas: totales.propinas,
          total_ventas: totales.totalVentas,
          denominaciones: JSON.stringify(data.denominaciones || []),
          total_contado_efectivo: totalContado,
          total_esperado: totales.efectivoEsperado,
          diferencia,
          tipo_diferencia: tipoDiferencia,
          observaciones: data.observaciones || '',
        })
        .returning(['id', 'fondo_inicial', 'total_ventas', 'total_contado_efectivo', 'diferencia', 'tipo_diferencia'])
        .executeTakeFirstOrThrow();

      await tx
        .updateTable('caja_sesiones')
        .set({ estado: 'cerrada', cierre_en: new Date(), notas_cierre: data.observaciones || '' })
        .where('id', '=', session.id)
        .execute();

      return corte;
    });

    return {
      success: true,
      corte: {
        id: resultado.id,
        fondo_inicial: resultado.fondo_inicial,
        total_ventas: resultado.total_ventas,
        total_contado_efectivo: resultado.total_contado_efectivo,
        diferencia: resultado.diferencia,
        tipo_diferencia: resultado.tipo_diferencia,
      },
    };
  }

  async cortesLista(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('caja_cortes')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .orderBy('created_at', 'desc')
        .limit(30)
        .execute(),
    );
  }

  /** Los movimientos se cargan con su pedido para exponer numero_orden y mesa. */
  private async movimientosDeSesion(db: any, sessionId: number): Promise<MovCaja[]> {
    const movs = await db
      .selectFrom('caja_movimientos')
      .leftJoin('pedidos', 'pedidos.id', 'caja_movimientos.pedido_id')
      .select([
        'caja_movimientos.id',
        'caja_movimientos.tipo',
        'caja_movimientos.metodo_pago',
        'caja_movimientos.monto_pyg',
        'caja_movimientos.propina',
        'caja_movimientos.vuelto',
        'caja_movimientos.motivo',
        'caja_movimientos.created_at',
        'pedidos.numero_orden as pedido_numero',
      ])
      .where('caja_movimientos.session_id', '=', sessionId)
      .orderBy('caja_movimientos.created_at', 'desc')
      .execute();

    return movs as unknown as MovCaja[];
  }

  private calcularTotales(movs: MovCaja[], fondoInicial: number) {
    const ventas = movs.filter((m) => m.tipo === 'venta');
    const porMetodo = (metodo: string) => ventas.filter((m) => m.metodo_pago === metodo);
    const monto = (arr: MovCaja[]) => arr.reduce((s, m) => s + Number(m.monto_pyg || 0), 0);

    const ventasEfectivo = monto(porMetodo('efectivo'));
    const ventasTarjeta = monto(porMetodo('tarjeta'));
    const ventasTransferencia = monto(porMetodo('transferencia'));
    const ventasQr = monto(porMetodo('qr'));
    const totalVentas = monto(ventas);
    const ingresosExtra = monto(movs.filter((m) => m.tipo === 'ingreso_extra'));
    const retiros = monto(movs.filter((m) => m.tipo === 'retiro'));
    const propinas = ventas.reduce((s, m) => s + Number(m.propina || 0), 0);

    const efectivoEsperado = fondoInicial + ventasEfectivo + ingresosExtra - retiros;
    const totalGeneral = ventasEfectivo + ventasTarjeta + ventasTransferencia + ventasQr;

    return {
      totalPedidos: ventas.length,
      totalVentas,
      ventasEfectivo,
      ventasTarjeta,
      ventasTransferencia,
      ventasQr,
      totalGeneral,
      propinas,
      ingresosExtra,
      retiros,
      efectivoEsperado,
    };
  }

  private async calcularEfectivoEsperado(sessionId: number, fondoInicial: number) {
    const movs = await this.db.run((db) => this.movimientosDeSesion(db, sessionId));
    return this.calcularTotales(movs, fondoInicial).efectivoEsperado;
  }
}
