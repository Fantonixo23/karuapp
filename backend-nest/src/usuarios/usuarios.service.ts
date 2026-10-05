import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async listar(restauranteId: number) {
    return this.prisma.withTenant().usuario.findMany({
      where: { restauranteId },
      select: { id: true, nombre: true, pin: true, rol: true, telefono: true, email: true, activo: true, ultimoAcceso: true, createdAt: true },
      orderBy: { nombre: 'asc' },
    });
  }

  async crear(restauranteId: number, data: { nombre: string; pin: string; rol: string; telefono?: string; creadoPorId?: number }) {
    const existente = await this.prisma.withTenant().usuario.findFirst({
      where: { restauranteId, pin: data.pin },
    });
    if (existente) throw new ConflictException('El PIN ya está en uso');

    const hashedPin = await bcrypt.hash(data.pin, 10);
    return this.prisma.withTenant().usuario.create({
      data: {
        restauranteId,
        nombre: data.nombre,
        pin: hashedPin,
        rol: data.rol,
        telefono: data.telefono,
        creadoPorId: data.creadoPorId,
      },
      select: { id: true, nombre: true, rol: true, telefono: true, activo: true },
    });
  }

  async editar(restauranteId: number, id: number, data: { nombre?: string; rol?: string; telefono?: string; activo?: boolean }) {
    const usuario = await this.prisma.withTenant().usuario.findFirst({ where: { id, restauranteId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.withTenant().usuario.update({
      where: { id },
      data: {
        nombre: data.nombre,
        rol: data.rol,
        telefono: data.telefono,
        activo: data.activo,
      },
      select: { id: true, nombre: true, rol: true, telefono: true, activo: true },
    });
  }

  async eliminar(restauranteId: number, id: number) {
    const usuario = await this.prisma.withTenant().usuario.findFirst({ where: { id, restauranteId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const pedidosCount = await this.prisma.withTenant().pedido.count({ where: { meseroId: id } });
    if (pedidosCount > 0) {
      await this.prisma.withTenant().usuario.update({ where: { id }, data: { activo: false } });
      return { success: true, message: 'Usuario desactivado (tiene pedidos asociados)' };
    }

    await this.prisma.withTenant().usuario.delete({ where: { id } });
    return { success: true };
  }

  async regenerarPin(restauranteId: number, id: number, nuevoPin: string) {
    const usuario = await this.prisma.withTenant().usuario.findFirst({ where: { id, restauranteId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const conflict = await this.prisma.withTenant().usuario.findFirst({
      where: { restauranteId, pin: nuevoPin, id: { not: id } },
    });
    if (conflict) throw new ConflictException('El PIN ya está en uso por otro usuario');

    const hashedPin = await bcrypt.hash(nuevoPin, 10);
    return this.prisma.withTenant().usuario.update({
      where: { id },
      data: { pin: hashedPin },
      select: { id: true, nombre: true, pin: true },
    });
  }
}
