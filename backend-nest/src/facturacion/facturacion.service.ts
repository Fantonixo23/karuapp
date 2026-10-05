import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FacturacionService {
  constructor(private prisma: PrismaService) {}

  async getConfig(restauranteId: number) {
    const config = await this.prisma.withTenant().configuracion.findFirst({
      where: { restauranteId },
    });
    return config || null;
  }

  async actualizarConfig(restauranteId: number, data: any) {
    const existing = await this.prisma.withTenant().configuracion.findFirst({ where: { restauranteId } });

    const input: any = {
      nombreEmpresa: data.nombre_empresa,
      ruc: data.ruc,
      direccion: data.direccion,
      telefono: data.telefono,
      tasaIva: data.tasa_iva,
      establecimiento: data.establecimiento,
      puntoExpedicion: data.punto_expedicion,
      tamanioPapel: data.tamano_papel,
    };
    Object.keys(input).forEach(k => input[k] === undefined && delete input[k]);

    if (existing) {
      return this.prisma.withTenant().configuracion.update({ where: { id: existing.id }, data: input });
    }
    return this.prisma.withTenant().configuracion.create({ data: { restauranteId, ...input, nombreEmpresa: data.nombre_empresa || '', ruc: data.ruc || '' } });
  }

  async listarMetodosPago(restauranteId: number) {
    return this.prisma.withTenant().metodoPago.findMany({
      where: { restauranteId },
      orderBy: { orden: 'asc' },
    });
  }

  async crearMetodoPago(restauranteId: number, data: any) {
    return this.prisma.withTenant().metodoPago.create({
      data: {
        restauranteId,
        nombre: data.nombre,
        etiqueta: data.etiqueta,
        icono: data.icono || 'payments',
        color: data.color || '#4CAF50',
        activo: data.activo ?? true,
        orden: data.orden || 0,
      },
    });
  }

  async eliminarMetodoPago(restauranteId: number, id: number) {
    const mp = await this.prisma.withTenant().metodoPago.findFirst({ where: { id, restauranteId } });
    if (!mp) throw new NotFoundException('Método de pago no encontrado');
    await this.prisma.withTenant().metodoPago.delete({ where: { id } });
    return { success: true };
  }

  async listarTimbrados(restauranteId: number) {
    return this.prisma.withTenant().timbrado.findMany({ where: { restauranteId } });
  }

  async crearTimbrado(restauranteId: number, data: any) {
    return this.prisma.withTenant().timbrado.create({
      data: {
        restauranteId,
        establecimiento: data.establecimiento || '001',
        puntoExpedicion: data.punto_expedicion || '001',
        numeroInicio: data.numero_inicio,
        numeroFin: data.numero_fin,
        numeroActual: data.numero_actual || 0,
        fechaVencimiento: new Date(data.fecha_vencimiento),
        activo: data.activo ?? true,
      },
    });
  }

  async listarFacturas(restauranteId: number) {
    return this.prisma.withTenant().factura.findMany({
      where: { restauranteId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async buscarRuc(restauranteId: number, query: string) {
    const externalResults = await this.buscarRucExterno(query);
    if (externalResults.length > 0) return externalResults;

    const pedidos = await this.prisma.withTenant().pedido.findMany({
      where: {
        restauranteId,
        clienteRuc: { contains: query },
      },
      select: { clienteRuc: true, clienteNombre: true },
      distinct: ['clienteRuc'],
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return pedidos.map(p => ({
      ruc: p.clienteRuc,
      nombre: p.clienteNombre,
    }));
  }

  private async buscarRucExterno(query: string): Promise<{ ruc: string; nombre: string }[]> {
    try {
      // Try exact lookup first if looks like a full RUC
      if (/^\d{6,8}-\d$/.test(query.trim())) {
        const exact = await this.fetchSunApi(`https://ruc.sun.com.py/api/ruc/${encodeURIComponent(query.trim())}`);
        if (exact) return [exact];
      }

      const res = await fetch(`https://ruc.sun.com.py/api/search?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Karuapp/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      if (!data?.results?.length) return [];

      return data.results
        .filter((r: any) => r.fullRuc && r.name)
        .slice(0, 10)
        .map((r: any) => ({
          ruc: r.fullRuc,
          nombre: r.name,
        }));
    } catch {
      return [];
    }
  }

  private async fetchSunApi(url: string): Promise<{ ruc: string; nombre: string } | null> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Karuapp/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data: any = await res.json();
      if (data?.fullRuc && data?.name) {
        return { ruc: data.fullRuc, nombre: data.name };
      }
      return null;
    } catch {
      return null;
    }
  }
}
