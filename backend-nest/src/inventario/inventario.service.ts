import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventarioService {
  constructor(private prisma: PrismaService) {}

  async listar(restauranteId: number) {
    return this.prisma.withTenant().inventario.findMany({
      where: { restauranteId },
      include: { producto: { select: { id: true, nombre: true, categoria: { select: { nombre: true } } } } },
      orderBy: { fechaActualizacion: 'desc' },
    });
  }

  async actualizar(restauranteId: number, data: { producto_id: number; stock_actual?: number; stock_minimo?: number; precio_costo?: number; unidad_medida?: string }) {
    const producto = await this.prisma.withTenant().producto.findFirst({ where: { id: data.producto_id, restauranteId } });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const existing = await this.prisma.withTenant().inventario.findUnique({ where: { productoId: data.producto_id } });

    if (existing) {
      return this.prisma.withTenant().inventario.update({
        where: { productoId: data.producto_id },
        data: {
          stockActual: data.stock_actual ?? existing.stockActual,
          stockMinimo: data.stock_minimo ?? existing.stockMinimo,
          precioCosto: data.precio_costo ?? existing.precioCosto,
          unidadMedida: data.unidad_medida ?? existing.unidadMedida,
        },
        include: { producto: { select: { id: true, nombre: true } } },
      });
    }

    return this.prisma.withTenant().inventario.create({
      data: {
        restauranteId,
        productoId: data.producto_id,
        stockActual: data.stock_actual || 0,
        stockMinimo: data.stock_minimo || 5,
        precioCosto: data.precio_costo || 0,
        unidadMedida: data.unidad_medida || 'und',
      },
      include: { producto: { select: { id: true, nombre: true } } },
    });
  }

  async movimiento(restauranteId: number, data: { inventario_id: number; tipo: string; cantidad: number; motivo?: string; notas?: string }) {
    const inv = await this.prisma.withTenant().inventario.findFirst({ where: { id: data.inventario_id, restauranteId } });
    if (!inv) throw new NotFoundException('Inventario no encontrado');

    if (data.tipo === 'salida' && inv.stockActual < data.cantidad) {
      throw new BadRequestException('Stock insuficiente');
    }

    const stockChange = data.tipo === 'entrada' ? data.cantidad : -data.cantidad;

    await this.prisma.withTenant().inventario.update({
      where: { id: data.inventario_id },
      data: { stockActual: inv.stockActual + stockChange },
    });

    return this.prisma.withTenant().movimientoInventario.create({
      data: {
        restauranteId,
        inventarioId: data.inventario_id,
        tipo: data.tipo as any,
        cantidad: data.cantidad,
        motivo: data.motivo || null,
        notas: data.notas || null,
      },
      include: { inventario: { include: { producto: { select: { nombre: true } } } } },
    });
  }

  async eliminar(restauranteId: number, id: number) {
    const inv = await this.prisma.withTenant().inventario.findFirst({ where: { id, restauranteId } });
    if (!inv) throw new NotFoundException('Inventario no encontrado');
    await this.prisma.withTenant().inventario.delete({ where: { id } });
    return { success: true };
  }

  async resumen(restauranteId: number) {
    const inventarios = await this.prisma.withTenant().inventario.findMany({ where: { restauranteId } });

    const totalProductos = inventarios.length;
    const agotados = inventarios.filter(i => i.stockActual <= 0).length;
    const bajos = inventarios.filter(i => i.stockActual > 0 && i.stockActual <= i.stockMinimo).length;
    const normales = inventarios.filter(i => i.stockActual > i.stockMinimo).length;
    const valorTotal = inventarios.reduce((s, i) => s + i.precioCosto * i.stockActual, 0);

    return { total_productos: totalProductos, agotados, bajos, normales, valor_total: valorTotal };
  }

  async alertas(restauranteId: number) {
    const bajos = await this.prisma.withTenant().inventario.findMany({
      where: { restauranteId, stockActual: { lte: this.prisma.inventario.fields.stockMinimo } },
      include: { producto: { select: { nombre: true } } },
      orderBy: { stockActual: 'asc' },
    });

    return bajos.map(i => ({
      id: i.id,
      producto: i.producto.nombre,
      stock_actual: i.stockActual,
      stock_minimo: i.stockMinimo,
      estado: i.stockActual <= 0 ? 'agotado' : 'bajo',
    }));
  }
}
