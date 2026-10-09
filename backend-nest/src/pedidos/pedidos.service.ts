import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { sql } from 'kysely';
import { DatabaseService } from '../database/database.service';
import { countInt } from '../database/agg';
import { JsonValue } from '../database/database.types';
import { RealtimeService } from '../realtime/realtime.service';
import { rangoDiaParaguay } from '../common/fecha';

const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  pendiente: ['cocinando', 'cancelado'],
  cocinando: ['listo', 'cancelado'],
  listo: ['en_camino', 'entregado', 'cancelado'],
  en_camino: ['entregado', 'cancelado'],
  entregado: ['pagado', 'cancelado'],
  pagado: [],
  cancelado: [],
};

const ESTADOS_ACTIVOS = ['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado'];

interface ItemPedido {
  producto_id: number;
  producto_nombre: string;
  categoria_nombre: string | null;
  cantidad: number;
  precio: number;
  variante: string | null;
  nota: string;
}

const PEDIDO_CON_RELACIONES = (qb: any) =>
  qb
    .leftJoin('mesas', 'mesas.id', 'pedidos.mesa_id')
    .leftJoin('usuarios', 'usuarios.id', 'pedidos.mesero_id')
    .select([
      'pedidos.id',
      'pedidos.restaurante_id',
      'pedidos.mesa_id',
      'pedidos.mesero_id',
      'pedidos.estado',
      'pedidos.delivery',
      'pedidos.nombre_cliente',
      'pedidos.telefono_cliente',
      'pedidos.direccion',
      'pedidos.tipo_pedido',
      'pedidos.notas',
      'pedidos.items',
      'pedidos.total',
      'pedidos.metodo_pago',
      'pedidos.sincronizado',
      'pedidos.numero_orden',
      'pedidos.propina',
      'pedidos.comprobante_nro',
      'pedidos.marca_tarjeta',
      'pedidos.marca_qr',
      'pedidos.cuotas',
      'pedidos.ultimos_4',
      'pedidos.detalle_pagos',
      'pedidos.cliente_tipo',
      'pedidos.cliente_ruc',
      'pedidos.cliente_nombre',
      'pedidos.generar_comanda',
      'pedidos.generar_factura',
      'pedidos.tipo_iva',
      'pedidos.motivo_cancelacion',
      'pedidos.cancelado_en_estado',
      'pedidos.created_at',
      'pedidos.updated_at',
      'mesas.numero as mesa_numero',
      'usuarios.nombre as mesero_nombre',
    ]);

@Injectable()
export class PedidosService {
  constructor(
    private db: DatabaseService,
    private realtime: RealtimeService,
  ) {}

  async listar(restauranteId: number, filtros?: { estado?: string; delivery?: string }) {
    return this.db.run(async (db) => {
      let qb = PEDIDO_CON_RELACIONES(db.selectFrom('pedidos')).where('pedidos.restaurante_id', '=', restauranteId);
      if (filtros?.estado) qb = qb.where('pedidos.estado', '=', filtros.estado);
      if (filtros?.delivery) qb = qb.where('pedidos.delivery', '=', true);
      return qb.orderBy('pedidos.created_at', 'desc').execute();
    });
  }

  async crear(restauranteId: number, data: any, usuarioId: number) {
    const items = data.items || [];
    if (!items.length) throw new BadRequestException('El pedido debe tener al menos un item');

    const itemsValidados = await this.validarItems(restauranteId, items);
    const total = itemsValidados.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

    const pedido = await this.db.transaction(async (tx) => {
      const { hoy, manana } = rangoDiaParaguay();

      // Serializa la numeracion por restaurante: sin el lock, dos meseros que
      // crean a la vez leen el mismo maximo y repiten numero_orden.
      await sql`select pg_advisory_xact_lock(hashtext('karuapp_numero_orden')::int, ${restauranteId}::int)`.execute(tx);

      const ultimo = await tx
        .selectFrom('pedidos')
        .select('numero_orden')
        .where('restaurante_id', '=', restauranteId)
        .where('created_at', '>=', hoy)
        .where('created_at', '<', manana)
        .orderBy('numero_orden', 'desc')
        .limit(1)
        .executeTakeFirst();

      let numeroOrden = '001';
      if (ultimo) {
        const last = parseInt(ultimo.numero_orden || '0', 10);
        numeroOrden = String(last + 1).padStart(3, '0');
      }

      const creado = await tx
        .insertInto('pedidos')
        .values({
          restaurante_id: restauranteId,
          mesa_id: data.mesa_id || null,
          mesero_id: data.mesero_id || usuarioId || null,
          items: JSON.stringify(itemsValidados),
          total,
          notas: data.notas || data.nota || null,
          tipo_pedido: data.tipo_pedido || 'mesa',
          delivery: data.delivery || false,
          nombre_cliente: data.nombre_cliente || null,
          telefono_cliente: data.telefono_cliente || null,
          direccion: data.direccion || null,
          numero_orden: numeroOrden,
        })
        .returning(['id', 'numero_orden', 'estado', 'items', 'total', 'delivery', 'nombre_cliente', 'mesa_id'])
        .executeTakeFirstOrThrow();

      let mesaNumero: number | null = null;
      if (data.mesa_id) {
        await tx
          .updateTable('mesas')
          .set({ estado: 'ocupada', updated_at: new Date() })
          .where('id', '=', data.mesa_id)
          .where('restaurante_id', '=', restauranteId)
          .execute();

        mesaNumero = (
          await tx.selectFrom('mesas').select('numero').where('id', '=', data.mesa_id).executeTakeFirst()
        )?.numero ?? null;
      }

      return { ...creado, mesa_numero: mesaNumero };
    });

    if (data.mesa_id) {
      await this.realtime.emitMesaUpdate(restauranteId, { id: data.mesa_id, estado: 'ocupada' });
    }

    await this.realtime.emitNuevoPedidoCocina(restauranteId, {
      id: pedido.id,
      numero_orden: pedido.numero_orden,
      estado: pedido.estado,
      mesa: pedido.mesa_numero,
      delivery: pedido.delivery,
      nombre_cliente: pedido.nombre_cliente,
      items: pedido.items,
      total: String(pedido.total),
    });

    return pedido;
  }

  async cambiarEstado(restauranteId: number, id: number, nuevoEstado: string) {
    const updated = await this.db.transaction(async (tx) => {
      const pedido = await tx
        .selectFrom('pedidos')
        .select(['id', 'estado'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!pedido) throw new NotFoundException('Pedido no encontrado');

      const transiciones = TRANSICIONES_VALIDAS[pedido.estado] || [];
      if (!transiciones.includes(nuevoEstado)) {
        throw new BadRequestException(`Transición inválida: ${pedido.estado} → ${nuevoEstado}`);
      }

      return tx
        .updateTable('pedidos')
        .set({ estado: nuevoEstado, updated_at: new Date() })
        .where('id', '=', id)
        .returning(['id', 'numero_orden', 'estado'])
        .executeTakeFirstOrThrow();
    });

    await this.realtime.emitPedidoUpdate(restauranteId, {
      id: updated.id,
      numero_orden: updated.numero_orden,
      estado: updated.estado,
    });

    return updated;
  }

  async agregarItems(restauranteId: number, id: number, items: any[]) {
    if (!items.length) throw new BadRequestException('No hay items para agregar');

    const itemsValidados = await this.validarItems(restauranteId, items);
    const updated = await this.actualizarItemsYTotal(restauranteId, id, itemsValidados, 'agregar');

    await this.realtime.emitPedidoModificado(restauranteId, {
      id: updated.id,
      numero_orden: updated.numero_orden,
      items: updated.items,
      total: String(updated.total),
    });

    return updated;
  }

  async reemplazarItems(restauranteId: number, id: number, items: any[]) {
    if (!items.length) throw new BadRequestException('El pedido debe tener al menos un item');

    const itemsValidados = await this.validarItems(restauranteId, items);
    const updated = await this.actualizarItemsYTotal(restauranteId, id, itemsValidados, 'reemplazar');

    await this.realtime.emitPedidoModificado(restauranteId, {
      id: updated.id,
      numero_orden: updated.numero_orden,
      items: updated.items,
      total: String(updated.total),
    });

    return updated;
  }

  async eliminarItem(restauranteId: number, id: number, idx: number) {
    const itemsActuales = await this.cargarItemsParaEditar(restauranteId, id, 'No se puede modificar un pedido pagado o cancelado');

    if (idx < 0 || idx >= itemsActuales.length) throw new NotFoundException('Item no encontrado');

    const restantes = itemsActuales.filter((_, i) => i !== idx);
    if (!restantes.length) throw new BadRequestException('No se puede eliminar el único item. Cancele el pedido.');

    const updated = await this.actualizarItemsYTotal(restauranteId, id, restantes, 'reemplazar');

    await this.realtime.emitPedidoModificado(restauranteId, {
      id: updated.id,
      numero_orden: updated.numero_orden,
      items: updated.items,
      total: String(updated.total),
    });

    return updated;
  }

  async pagar(restauranteId: number, id: number, data: any, usuarioId: number) {
    const resultado = await this.db.transaction(async (tx) => {
      const pedido = await tx
        .selectFrom('pedidos')
        .select(['id', 'estado', 'total', 'mesa_id', 'numero_orden', 'items'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!pedido) throw new NotFoundException('Pedido no encontrado');

      const transiciones = TRANSICIONES_VALIDAS[pedido.estado] || [];
      if (!transiciones.includes('pagado')) {
        throw new BadRequestException(`No se puede pagar un pedido en estado ${pedido.estado}`);
      }

      const session = await tx
        .selectFrom('caja_sesiones')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (!session) throw new BadRequestException('No hay una sesión de caja abierta');

      const metodoPago = data.metodo_pago || 'efectivo';
      const propina = this.normalizarPropina(data.propina);
      const totalConPropina = pedido.total + propina;

      const updated = await tx
        .updateTable('pedidos')
        .set({
          estado: 'pagado',
          metodo_pago: metodoPago,
          propina,
          marca_tarjeta: data.marca_tarjeta || '',
          ultimos_4: data.ultimos_4 || '',
          comprobante_nro: data.comprobante_nro || '',
          marca_qr: data.marca_qr || '',
          cuotas: data.cuotas || 1,
          tipo_iva: data.tipo_iva || 10,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returning(['id', 'numero_orden', 'estado', 'metodo_pago', 'propina', 'total'])
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('caja_movimientos')
        .values({
          restaurante_id: restauranteId,
          session_id: session.id,
          tipo: 'venta',
          metodo_pago: metodoPago,
          monto: totalConPropina,
          moneda: 'PYG',
          monto_pyg: totalConPropina,
          pedido_id: id,
          propina,
          usuario_id: usuarioId || null,
        })
        .execute();

      let liberadaMesa = false;
      if (pedido.mesa_id) {
        const otrosActivos = await tx
          .selectFrom('pedidos')
          .select(() => countInt())
          .where('mesa_id', '=', pedido.mesa_id)
          .where('estado', 'in', ESTADOS_ACTIVOS)
          .where('id', '!=', id)
          .executeTakeFirst();

        if ((otrosActivos?.c ?? 0) === 0) {
          await tx
            .updateTable('mesas')
            .set({ estado: 'disponible', updated_at: new Date() })
            .where('id', '=', pedido.mesa_id)
            .execute();
          liberadaMesa = true;
        }
      }

      await this.descontarInventario(tx, restauranteId, id, pedido.items);

      return { updated, totalConPropina, metodoPago, mesaId: pedido.mesa_id, liberadaMesa };
    });

    await this.realtime.emitPedidoUpdate(restauranteId, {
      id: resultado.updated.id,
      numero_orden: resultado.updated.numero_orden,
      estado: 'pagado',
    });

    if (resultado.liberadaMesa) {
      await this.realtime.emitMesaUpdate(restauranteId, { id: resultado.mesaId, estado: 'disponible' });
    }

    await this.realtime.emitCobro(restauranteId, {
      pedido_id: id,
      total: resultado.totalConPropina,
      metodo_pago: resultado.metodoPago,
    });

    return resultado.updated;
  }

  async pedidosPorMesa(restauranteId: number, mesaId: number) {
    const pedidos = await this.db.run(async (db) =>
      PEDIDO_CON_RELACIONES(db.selectFrom('pedidos'))
        .where('pedidos.restaurante_id', '=', restauranteId)
        .where('pedidos.mesa_id', '=', mesaId)
        .where('pedidos.estado', 'not in', ['pagado', 'cancelado'])
        .orderBy('pedidos.created_at', 'asc')
        .execute(),
    );

    const totalMesa = pedidos.reduce((sum, p) => sum + p.total, 0);

    return { pedidos, total_mesa: totalMesa, cantidad: pedidos.length };
  }

  async cobrarMesa(restauranteId: number, mesaId: number, body: any, usuarioId: number) {
    const resultado = await this.db.transaction(async (tx) => {
      const session = await tx
        .selectFrom('caja_sesiones')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .where('estado', '=', 'abierta')
        .executeTakeFirst();
      if (!session) return { error: 'No hay una sesión de caja abierta' as const, need_apertura: true };

      const pedidos = await tx
        .selectFrom('pedidos')
        .select(['id', 'total', 'numero_orden', 'items'])
        .where('restaurante_id', '=', restauranteId)
        .where('mesa_id', '=', mesaId)
        .where('estado', 'not in', ['pagado', 'cancelado'])
        .orderBy('created_at', 'asc')
        .execute();

      if (!pedidos.length) return { error: 'No hay pedidos en esta mesa' as const };

      const metodoPago = body.metodo_pago || 'efectivo';
      const propinas = this.normalizarPropina(body.propina);
      const detallePagos = body.detalle_pagos ? JSON.stringify(body.detalle_pagos) : null;
      const montoRecibido = this.normalizarMontoRecibido(body.monto_recibido);
      const totalPedidos = pedidos.reduce((s, p) => s + p.total, 0);
      const totalConPropina = totalPedidos + propinas;
      const vuelto = montoRecibido > 0 ? Math.max(0, montoRecibido - totalConPropina) : 0;
      const idsCobrados: number[] = [];

      for (const pedido of pedidos) {
        // La propina se prorratea entre los pedidos de la mesa y se registra
        // en caja junto al venta (antes se guardaba 0 y se perdia en el arqueo).
        const propinaPedido = totalPedidos > 0 ? Math.round((propinas * pedido.total) / totalPedidos) : 0;
        const monto = pedido.total + propinaPedido;

        await tx
          .updateTable('pedidos')
          .set({
            estado: 'pagado',
            metodo_pago: metodoPago,
            propina: propinaPedido,
            detalle_pagos: detallePagos,
            cliente_tipo: body.cliente_tipo || 'consumidor',
            cliente_ruc: body.cliente_ruc || '44444444-7',
            cliente_nombre: body.cliente_nombre || 'Consumidor Final',
            tipo_iva: body.tipo_iva || 10,
            updated_at: new Date(),
          })
          .where('id', '=', pedido.id)
          .execute();

        await tx
          .insertInto('caja_movimientos')
          .values({
            restaurante_id: restauranteId,
            session_id: session.id,
            tipo: 'venta',
            metodo_pago: metodoPago,
            monto,
            moneda: 'PYG',
            monto_pyg: monto,
            pedido_id: pedido.id,
            detalle_pagos: detallePagos,
            propina: propinaPedido,
            // El vuelto es del cobro entero: se registra en un solo movimiento
            // para no sumarlo varias veces en los reportes.
            vuelto: idsCobrados.length === 0 ? vuelto : 0,
            usuario_id: usuarioId,
          })
          .execute();

        await this.descontarInventario(tx, restauranteId, pedido.id, pedido.items);

        idsCobrados.push(pedido.id);
      }

      const restantes = await tx
        .selectFrom('pedidos')
        .select(() => countInt())
        .where('mesa_id', '=', mesaId)
        .where('estado', 'not in', ['pagado', 'cancelado'])
        .executeTakeFirst();

      const liberada = (restantes?.c ?? 0) === 0;
      if (liberada) {
        await tx.updateTable('mesas').set({ estado: 'disponible', updated_at: new Date() }).where('id', '=', mesaId).execute();
      }

      return {
        cobrados: idsCobrados,
        totalPedidos,
        totalConPropina,
        metodoPago,
        liberado: liberada,
        pedidos,
        numeroFactura: pedidos[0]?.numero_orden ?? null,
      };
    });

    if ('error' in resultado) {
      return { success: false as const, error: resultado.error, need_apertura: 'need_apertura' in resultado ? true : undefined };
    }

    await this.realtime.emitCobro(restauranteId, {
      mesa_id: mesaId,
      total: resultado.totalConPropina,
      metodo_pago: resultado.metodoPago,
    });

    const montoRecibido = this.normalizarMontoRecibido(body.monto_recibido);
    const vuelto = montoRecibido > 0 ? Math.max(0, montoRecibido - resultado.totalConPropina) : 0;

    // SIFEN esta fuera de alcance: no se genera comprobante electronico, pero el
    // contrato de Caja.jsx espera estos campos. `factura: null` = sin CDC/kude/QR.
    return {
      success: true as const,
      cobrados: resultado.cobrados,
      total_cobrado: String(resultado.totalPedidos),
      total_con_propina: String(resultado.totalConPropina),
      vuelto,
      monto_recibido: montoRecibido,
      numero_factura: resultado.numeroFactura,
      factura: null,
      detalle_pagos: body.detalle_pagos || [],
      pedidos: resultado.pedidos,
    };
  }

  async dashboardDelivery(restauranteId: number) {
    return this.db.run(async (db) => {
      const { hoy, manana } = rangoDiaParaguay();

      const base = db
        .selectFrom('pedidos')
        .where('restaurante_id', '=', restauranteId)
        .where('delivery', '=', true)
        .where('created_at', '>=', hoy)
        .where('created_at', '<', manana);

      const conteos = await base
        .select([
          'estado',
          countInt(),
          (eb) =>
            sql<string>`coalesce(sum(case when pedidos.estado in ('pagado', 'entregado') then pedidos.total else 0 end), 0)`.as(
              'total_hoy',
            ),
        ])
        .groupBy('estado')
        .execute();

      const ultimos = await db
        .selectFrom('pedidos')
        .select(['id', 'numero_orden', 'estado', 'nombre_cliente', 'items', 'total', 'created_at'])
        .where('restaurante_id', '=', restauranteId)
        .where('delivery', '=', true)
        .orderBy('created_at', 'desc')
        .limit(15)
        .execute();

      const porEstado = (estado: string) => conteos.find((c) => c.estado === estado)?.c ?? 0;
      const totalHoy = conteos.reduce((s, c) => s + Number(c.total_hoy ?? 0), 0);

      return {
        success: true,
        data: {
          pendientes: porEstado('pendiente'),
          cocinando: porEstado('cocinando'),
          listos: porEstado('listo'),
          en_camino: porEstado('en_camino'),
          entregados: porEstado('entregado'),
          cancelados: porEstado('cancelado'),
          total_hoy: String(totalHoy),
          pedidos: ultimos.map((p) => ({
            id: p.id,
            numero_orden: p.numero_orden,
            estado: p.estado,
            nombre_cliente: p.nombre_cliente,
            items: p.items,
            total: String(p.total),
            created_at: p.created_at,
          })),
        },
      };
    });
  }

  async historialCaja(restauranteId: number) {
    return this.db.run(async (db) => {
      const { hoy, manana } = rangoDiaParaguay();

      const filas = await db
        .selectFrom('pedidos')
        .select(['metodo_pago', (eb) => eb.fn.sum('total').as('total'), (eb) => eb.fn.sum('propina').as('propinas')])
        .where('restaurante_id', '=', restauranteId)
        .where('estado', 'in', ['pagado', 'entregado'])
        .where('created_at', '>=', hoy)
        .where('created_at', '<', manana)
        .groupBy('metodo_pago')
        .execute();

      const resumen: Record<string, string> = {};
      let totalPropinas = 0;
      let totalGeneral = 0;

      for (const f of filas) {
        const mp = f.metodo_pago || 'efectivo';
        const monto = Number(f.total ?? 0);
        resumen[mp] = String((resumen[mp] ? Number(resumen[mp]) : 0) + monto);
        totalPropinas += Number(f.propinas ?? 0);
        totalGeneral += monto;
      }

      resumen['propinas'] = String(totalPropinas);
      resumen['total'] = String(totalGeneral);

      return { success: true, resumen };
    });
  }

  async pedidosPagados(
    restauranteId: number,
    filtros: {
      fecha_desde?: string;
      fecha_hasta?: string;
      cliente_nombre?: string;
      cliente_ruc?: string;
      numero_orden?: string;
      numero_factura?: string;
      limit?: string;
      offset?: string;
    },
  ) {
    const escapeLike = (v: string) => `%${v.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

    return this.db.run(async (db) => {
      // Todas las columnas se califican con `pedidos.`: el listado trae JOINs a
      // mesas y usuarios y cualquiera de ellas quedaria ambigua.
      const aplicar = (qb: any) => {
        let q = qb.where('pedidos.restaurante_id', '=', restauranteId).where('pedidos.estado', '=', 'pagado');
        if (filtros.fecha_desde) q = q.where('pedidos.created_at', '>=', new Date(filtros.fecha_desde!));
        if (filtros.fecha_hasta) q = q.where('pedidos.created_at', '<=', new Date(`${filtros.fecha_hasta}T23:59:59`));
        if (filtros.cliente_nombre) q = q.where('pedidos.cliente_nombre', 'ilike', escapeLike(filtros.cliente_nombre));
        if (filtros.cliente_ruc) q = q.where('pedidos.cliente_ruc', 'ilike', escapeLike(filtros.cliente_ruc));
        if (filtros.numero_orden) q = q.where('pedidos.numero_orden', 'ilike', escapeLike(filtros.numero_orden));
        if (filtros.numero_factura) q = q.where('pedidos.comprobante_nro', 'ilike', escapeLike(filtros.numero_factura));
        return q;
      };

      const total = await aplicar(db.selectFrom('pedidos').select(() => countInt()))
        .executeTakeFirst();

      const pedidos = await aplicar(
        PEDIDO_CON_RELACIONES(db.selectFrom('pedidos')).select([
          'pedidos.id',
          'pedidos.numero_orden',
          'pedidos.estado',
          'pedidos.items',
          'pedidos.total',
          'pedidos.metodo_pago',
          'pedidos.propina',
          'pedidos.cliente_nombre',
          'pedidos.created_at',
          'mesas.numero as mesa_numero',
          'usuarios.nombre as mesero_nombre',
        ]),
      )
        .orderBy('pedidos.created_at', 'desc')
        .limit(+(filtros.limit || 20))
        .offset(+(filtros.offset || 0))
        .execute();

      return {
        success: true,
        pedidos: pedidos.map((p) => ({
          id: p.id,
          numero_orden: p.numero_orden,
          mesa_numero: p.mesa_numero,
          mesero_nombre: p.mesero_nombre,
          estado: p.estado,
          items: p.items,
          total: String(p.total),
          metodo_pago: p.metodo_pago,
          propina: String(p.propina),
          cliente_nombre: p.cliente_nombre,
          created_at: p.created_at,
        })),
        total: total?.c ?? 0,
      };
    });
  }

  private async cargarItemsParaEditar(restauranteId: number, id: number, mensajeEstado: string) {
    const pedido = await this.db.run(async (db) =>
      db
        .selectFrom('pedidos')
        .select(['estado', 'items'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst(),
    );
    if (!pedido) throw new NotFoundException('Pedido no encontrado');
    if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') throw new BadRequestException(mensajeEstado);

    return ((pedido.items as unknown as ItemPedido[]) || []) as ItemPedido[];
  }

  private async actualizarItemsYTotal(
    restauranteId: number,
    id: number,
    itemsValidados: ItemPedido[],
    modo: 'agregar' | 'reemplazar',
  ) {
    return this.db.transaction(async (tx) => {
      const pedido = await tx
        .selectFrom('pedidos')
        .select(['estado', 'items'])
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!pedido) throw new NotFoundException('Pedido no encontrado');
      if (pedido.estado === 'pagado' || pedido.estado === 'cancelado') {
        throw new BadRequestException('No se puede modificar un pedido pagado o cancelado');
      }

      const itemsActuales = ((pedido.items as unknown as ItemPedido[]) || []) as ItemPedido[];
      const itemsFinales = modo === 'agregar' ? [...itemsActuales, ...itemsValidados] : itemsValidados;
      const total = itemsFinales.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

      return tx
        .updateTable('pedidos')
        .set({ items: JSON.stringify(itemsFinales), total, updated_at: new Date() })
        .where('id', '=', id)
        .returning(['id', 'numero_orden', 'estado', 'items', 'total'])
        .executeTakeFirstOrThrow();
    });
  }

  private async validarItems(restauranteId: number, items: any[]) {
    const itemsValidados: ItemPedido[] = [];
    for (const item of items) {
      if (!item.producto_id) throw new BadRequestException('Cada item debe tener producto_id');

      const producto = await this.db.run(async (db) =>
        db
          .selectFrom('productos')
          .leftJoin('categorias', 'categorias.id', 'productos.categoria_id')
          .select(['productos.id', 'productos.nombre', 'productos.precio', 'productos.disponible', 'categorias.nombre as categoria_nombre'])
          .where('productos.id', '=', item.producto_id)
          .where('productos.restaurante_id', '=', restauranteId)
          .executeTakeFirst(),
      );
      if (!producto) throw new NotFoundException(`Producto ${item.producto_id} no encontrado`);
      if (!producto.disponible) throw new BadRequestException(`El producto ${producto.nombre} no está disponible`);

      const cantidad = item.cantidad || 1;
      // El precio SIEMPRE sale del catalogo: nunca del body, que es manipulable.
      const precio = producto.precio;

      itemsValidados.push({
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        categoria_nombre: (producto.categoria_nombre as string | null) ?? null,
        cantidad,
        precio,
        variante: item.variante || null,
        nota: item.nota || '',
      });
    }
    return itemsValidados;
  }

  /** La propina la decide quien cobra, pero nunca puede ser negativa. */
  private normalizarPropina(valor: unknown): number {
    const n = Math.round(Number(valor));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  private normalizarMontoRecibido(valor: unknown): number {
    const n = Math.round(Number(valor));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Descuenta del inventario los productos del pedido cobrado. Solo toca los
   * productos que tienen fila en `inventario`: el resto se vende sin control de
   * stock. Corre dentro de la misma transaccion del cobro.
   */
  private async descontarInventario(tx: any, restauranteId: number, pedidoId: number, itemsRaw: unknown): Promise<void> {
    const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as ItemPedido[];
    for (const item of items) {
      if (!item?.producto_id || !item.cantidad) continue;

      const inv = await tx
        .selectFrom('inventario')
        .select(['id', 'stock_actual'])
        .where('producto_id', '=', item.producto_id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!inv) continue;

      await tx
        .updateTable('inventario')
        .set({ stock_actual: inv.stock_actual - item.cantidad, fecha_actualizacion: new Date() })
        .where('id', '=', inv.id)
        .execute();

      await tx
        .insertInto('movimientos_inventario')
        .values({
          restaurante_id: restauranteId,
          inventario_id: inv.id,
          tipo: 'venta',
          cantidad: -item.cantidad,
          motivo: `Pedido #${pedidoId}`,
        })
        .execute();
    }
  }
}
