import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductosService {
  constructor(private prisma: PrismaService) {}

  async listarCategorias(restauranteId: number) {
    return this.prisma.withTenant().categoria.findMany({
      where: { restauranteId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crearCategoria(restauranteId: number, data: { nombre: string; icono?: string; orden?: number }) {
    return this.prisma.withTenant().categoria.create({
      data: {
        restauranteId,
        nombre: data.nombre,
        icono: data.icono || 'category',
        orden: data.orden || 0,
      },
    });
  }

  async eliminarCategoria(restauranteId: number, id: number) {
    const cat = await this.prisma.withTenant().categoria.findFirst({ where: { id, restauranteId } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');

    const count = await this.prisma.withTenant().producto.count({ where: { categoriaId: id } });
    if (count > 0) throw new BadRequestException('No se puede eliminar una categoría con productos');

    await this.prisma.withTenant().categoria.delete({ where: { id } });
    return { success: true };
  }

  async listarProductos(restauranteId: number, categoriaId?: number) {
    const where: any = { restauranteId };
    if (categoriaId) where.categoriaId = categoriaId;

    return this.prisma.withTenant().producto.findMany({
      where,
      include: { categoria: true, inventario: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async crearProducto(restauranteId: number, data: any) {
    return this.prisma.withTenant().producto.create({
      data: {
        restauranteId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
        categoriaId: data.categoria_id || null,
        disponible: data.disponible ?? true,
        imagen: data.imagen,
        variantes: data.variantes || undefined,
        iva: data.iva || 10,
      },
      include: { categoria: true },
    });
  }

  async actualizarProducto(restauranteId: number, id: number, data: any) {
    const prod = await this.prisma.withTenant().producto.findFirst({ where: { id, restauranteId } });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    return this.prisma.withTenant().producto.update({
      where: { id },
      data: {
        nombre: data.nombre,
        descripcion: data.descripcion,
        precio: data.precio,
        categoriaId: data.categoria_id ?? prod.categoriaId,
        disponible: data.disponible,
        imagen: data.imagen,
        variantes: data.variantes !== undefined ? data.variantes : undefined,
        iva: data.iva,
      },
      include: { categoria: true },
    });
  }

  async toggleDisponible(restauranteId: number, id: number) {
    const prod = await this.prisma.withTenant().producto.findFirst({ where: { id, restauranteId } });
    if (!prod) throw new NotFoundException('Producto no encontrado');

    return this.prisma.withTenant().producto.update({
      where: { id },
      data: { disponible: !prod.disponible },
    });
  }

  async eliminarProducto(restauranteId: number, id: number) {
    const prod = await this.prisma.withTenant().producto.findFirst({ where: { id, restauranteId } });
    if (!prod) throw new NotFoundException('Producto no encontrado');
    await this.prisma.withTenant().producto.delete({ where: { id } });
    return { success: true };
  }
}
