import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CajaService {
  constructor(private prisma: PrismaService) {}

  async apertura(restauranteId: number, data: { fondo_inicial: number; notas?: string; usuario_id?: number }) {
    const abierta = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
    });
    if (abierta) throw new BadRequestException('Ya hay una sesión de caja abierta. Ciérrela primero.');

    if (data.fondo_inicial < 0) throw new BadRequestException('El fondo inicial no puede ser negativo');

    const session = await this.prisma.withTenant().cajaSession.create({
      data: {
        restauranteId,
        usuarioId: data.usuario_id || null,
        fondoInicial: data.fondo_inicial,
        notasApertura: data.notas || '',
        estado: 'abierta',
      },
    });

    return {
      success: true,
      session: {
        id: session.id,
        fondo_inicial: session.fondoInicial,
        apertura_en: session.aperturaEn,
        estado: session.estado,
      },
    };
  }

  async sesionActual(restauranteId: number) {
    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
      include: { movimientos: true },
    });

    if (!session) return { success: true, session: null, message: 'No hay sesión de caja abierta' };

    const ventas = session.movimientos.filter(m => m.tipo === 'venta');
    const ventasEfectivo = ventas.filter(m => m.metodoPago === 'efectivo');
    const ventasTarjeta = ventas.filter(m => m.metodoPago === 'tarjeta');
    const ventasTransferencia = ventas.filter(m => m.metodoPago === 'transferencia');
    const ventasQr = ventas.filter(m => m.metodoPago === 'qr');
    const ingresosExtra = session.movimientos.filter(m => m.tipo === 'ingreso_extra');
    const retiros = session.movimientos.filter(m => m.tipo === 'retiro');

    const sum = (arr: any[], field: string) => arr.reduce((s, m) => s + (m[field] || 0), 0);

    const totalVentasEfectivo = sum(ventasEfectivo, 'montoPyg');
    const totalVentasTarjeta = sum(ventasTarjeta, 'montoPyg');
    const totalVentasTransferencia = sum(ventasTransferencia, 'montoPyg');
    const totalVentasQr = sum(ventasQr, 'montoPyg');
    const totalVentas = sum(ventas, 'montoPyg');
    const totalIngresos = sum(ingresosExtra, 'montoPyg');
    const totalRetiros = sum(retiros, 'montoPyg');
    const totalPropinas = sum(ventas, 'propina');

    const efectivoEsperado = session.fondoInicial + totalVentasEfectivo + totalIngresos - totalRetiros;
    const totalGeneral = totalVentasEfectivo + totalVentasTarjeta + totalVentasTransferencia + totalVentasQr;

    return {
      success: true,
      session: {
        id: session.id,
        fondo_inicial: session.fondoInicial,
        apertura_en: session.aperturaEn,
        estado: session.estado,
        totales: {
          total_pedidos: ventas.length,
          total_ventas: totalVentas,
          ventas_efectivo: totalVentasEfectivo,
          ventas_tarjeta: totalVentasTarjeta,
          ventas_transferencia: totalVentasTransferencia,
          ventas_qr: totalVentasQr,
          total_general: totalGeneral,
          propinas: totalPropinas,
          ingresos_extra: totalIngresos,
          retiros: totalRetiros,
          efectivo_esperado: efectivoEsperado,
        },
      },
    };
  }

  async movimiento(restauranteId: number, data: { tipo: string; monto: number; motivo: string; usuario_id?: number }) {
    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
    });
    if (!session) throw new BadRequestException('No hay sesión de caja abierta');

    if (!['ingreso_extra', 'retiro'].includes(data.tipo)) {
      throw new BadRequestException('Tipo inválido');
    }
    if (data.monto <= 0) throw new BadRequestException('El monto debe ser mayor a 0');
    if (!data.motivo) throw new BadRequestException('Debe ingresar un motivo');

    const mov = await this.prisma.withTenant().movimientoCaja.create({
      data: {
        restauranteId,
        sessionId: session.id,
        tipo: data.tipo as any,
        metodoPago: 'efectivo',
        monto: data.monto,
        moneda: 'PYG',
        montoPyg: data.monto,
        motivo: data.motivo,
        usuarioId: data.usuario_id || null,
      },
    });

    return {
      success: true,
      movimiento: { id: mov.id, tipo: mov.tipo, monto_pyg: mov.montoPyg, motivo: mov.motivo, created_at: mov.createdAt },
    };
  }

  async movimientosLista(restauranteId: number) {
    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
    });
    if (!session) return { success: true, movimientos: [] };

    const movs = await this.prisma.withTenant().movimientoCaja.findMany({
      where: { sessionId: session.id },
      include: { pedido: { select: { numeroOrden: true, mesaId: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      movimientos: movs.map(m => ({
        id: m.id,
        tipo: m.tipo,
        metodo_pago: m.metodoPago,
        monto_pyg: m.montoPyg,
        propina: m.propina,
        vuelto: m.vuelto,
        motivo: m.motivo,
        pedido_numero: m.pedido?.numeroOrden || null,
        created_at: m.createdAt,
      })),
    };
  }

  async arqueo(restauranteId: number, data: { denominaciones: any[] }) {
    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
    });
    if (!session) throw new BadRequestException('No hay sesión de caja abierta');

    const totalContado = data.denominaciones.reduce((sum, d) => sum + d.valor * d.cantidad, 0);
    const efectivoEsperado = await this.calcularEfectivoEsperado(session.id);

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

  async cierre(restauranteId: number, data: { denominaciones: any[]; observaciones?: string; usuario_id?: number }) {
    const session = await this.prisma.withTenant().cajaSession.findFirst({
      where: { restauranteId, estado: 'abierta' },
      include: { movimientos: true },
    });
    if (!session) throw new BadRequestException('No hay sesión de caja abierta');

    const pendientes = await this.prisma.withTenant().pedido.count({
      where: { restauranteId, estado: { notIn: ['pagado', 'cancelado'] as any } },
    });
    if (pendientes > 0) {
      throw new BadRequestException('No se puede cerrar caja con pedidos pendientes');
    }

    const totalContado = data.denominaciones.reduce((sum, d) => sum + d.valor * d.cantidad, 0);

    const ventas = session.movimientos.filter(m => m.tipo === 'venta');
    const ventasEfectivo = ventas.filter(m => m.metodoPago === 'efectivo');
    const ventasTarjeta = ventas.filter(m => m.metodoPago === 'tarjeta');
    const ventasTransferencia = ventas.filter(m => m.metodoPago === 'transferencia');
    const ventasQr = ventas.filter(m => m.metodoPago === 'qr');
    const ingresosExtra = session.movimientos.filter(m => m.tipo === 'ingreso_extra');
    const retiros = session.movimientos.filter(m => m.tipo === 'retiro');

    const sum = (arr: any[], field: string) => arr.reduce((s, m) => s + (m[field] || 0), 0);

    const totalVentasEfectivo = sum(ventasEfectivo, 'montoPyg');
    const totalVentasTarjeta = sum(ventasTarjeta, 'montoPyg');
    const totalVentasTransferencia = sum(ventasTransferencia, 'montoPyg');
    const totalVentasQr = sum(ventasQr, 'montoPyg');
    const totalVentas = sum(ventas, 'montoPyg');
    const totalIngresos = sum(ingresosExtra, 'montoPyg');
    const totalRetiros = sum(retiros, 'montoPyg');
    const totalPropinas = sum(ventas, 'propina');
    const efectivoEsperado = session.fondoInicial + totalVentasEfectivo + totalIngresos - totalRetiros;
    const diferencia = totalContado - efectivoEsperado;

    const corte = await this.prisma.withTenant().corteCaja.create({
      data: {
        restauranteId,
        sessionId: session.id,
        usuarioCierreId: data.usuario_id || null,
        fondoInicial: session.fondoInicial,
        totalVentasEfectivo,
        totalVentasTarjeta,
        totalVentasTransferencia,
        totalVentasQr,
        totalIngresosExtra: totalIngresos,
        totalRetiros,
        totalPropinas,
        totalVentas,
        denominaciones: data.denominaciones as any,
        totalContadoEfectivo: totalContado,
        totalEsperado: efectivoEsperado,
        diferencia,
        tipoDiferencia: diferencia > 0 ? 'sobrante' : diferencia < 0 ? 'faltante' : '',
        observaciones: data.observaciones || '',
      },
    });

    await this.prisma.withTenant().cajaSession.update({
      where: { id: session.id },
      data: { estado: 'cerrada', cierreEn: new Date(), notasCierre: data.observaciones || '' },
    });

    return {
      success: true,
      corte: {
        id: corte.id,
        fondo_inicial: corte.fondoInicial,
        total_ventas: corte.totalVentas,
        total_contado_efectivo: corte.totalContadoEfectivo,
        diferencia: corte.diferencia,
        tipo_diferencia: corte.tipoDiferencia,
      },
    };
  }

  async cortesLista(restauranteId: number) {
    return this.prisma.withTenant().corteCaja.findMany({
      where: { restauranteId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  private async calcularEfectivoEsperado(sessionId: number) {
    const session = await this.prisma.withTenant().cajaSession.findUnique({
      where: { id: sessionId },
      include: { movimientos: true },
    });
    if (!session) return 0;

    const ventasEfectivo = session.movimientos
      .filter(m => m.tipo === 'venta' && m.metodoPago === 'efectivo')
      .reduce((s, m) => s + m.montoPyg, 0);
    const ingresos = session.movimientos
      .filter(m => m.tipo === 'ingreso_extra')
      .reduce((s, m) => s + m.montoPyg, 0);
    const retiros = session.movimientos
      .filter(m => m.tipo === 'retiro')
      .reduce((s, m) => s + m.montoPyg, 0);

    return session.fondoInicial + ventasEfectivo + ingresos - retiros;
  }
}
