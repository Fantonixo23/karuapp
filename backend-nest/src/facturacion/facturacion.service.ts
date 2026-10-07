import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

const escapeLike = (v: string) => `%${v.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

@Injectable()
export class FacturacionService {
  constructor(private db: DatabaseService) {}

  async getConfig(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('configuracion')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst(),
    );
  }

  async actualizarConfig(restauranteId: number, data: any) {
    return this.db.transaction(async (tx) => {
      const existente = await tx
        .selectFrom('configuracion')
        .select('id')
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();

      const input: Record<string, unknown> = {
        ...(data.nombre_empresa !== undefined && { nombre_empresa: data.nombre_empresa }),
        ...(data.ruc !== undefined && { ruc: data.ruc }),
        ...(data.direccion !== undefined && { direccion: data.direccion }),
        ...(data.telefono !== undefined && { telefono: data.telefono }),
        ...(data.tasa_iva !== undefined && { tasa_iva: data.tasa_iva }),
        ...(data.timbrado_numero !== undefined && { timbrado_numero: data.timbrado_numero }),
        ...(data.establecimiento !== undefined && { establecimiento: data.establecimiento }),
        ...(data.punto_expedicion !== undefined && { punto_expedicion: data.punto_expedicion }),
        ...(data.tamano_papel !== undefined && { tamano_papel: data.tamano_papel }),
        updated_at: new Date(),
      };

      if (existente) {
        return tx
          .updateTable('configuracion')
          .set(input)
          .where('id', '=', existente.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return tx
        .insertInto('configuracion')
        .values({
          restaurante_id: restauranteId,
          nombre_empresa: data.nombre_empresa || '',
          ruc: data.ruc || '',
          ...input,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async listarMetodosPago(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('metodos_pago')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .orderBy('orden', 'asc')
        .execute(),
    );
  }

  async crearMetodoPago(restauranteId: number, data: any) {
    return this.db.run(async (db) =>
      db
        .insertInto('metodos_pago')
        .values({
          restaurante_id: restauranteId,
          nombre: data.nombre,
          etiqueta: data.etiqueta,
          icono: data.icono || 'payments',
          color: data.color || '#4CAF50',
          activo: data.activo ?? true,
          orden: data.orden || 0,
        })
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  async actualizarMetodoPago(restauranteId: number, id: number, data: any) {
    return this.db.run(async (db) =>
      db
        .updateTable('metodos_pago')
        .set({
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.etiqueta !== undefined && { etiqueta: data.etiqueta }),
          ...(data.icono !== undefined && { icono: data.icono }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.activo !== undefined && { activo: data.activo }),
          ...(data.orden !== undefined && { orden: data.orden }),
        })
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .returningAll()
        .executeTakeFirst(),
    );
  }

  async eliminarMetodoPago(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const mp = await tx
        .selectFrom('metodos_pago')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!mp) throw new NotFoundException('Método de pago no encontrado');

      await tx.deleteFrom('metodos_pago').where('id', '=', id).execute();
      return { success: true };
    });
  }

  async listarTimbrados(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('timbrados')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .execute(),
    );
  }

  async crearTimbrado(restauranteId: number, data: any) {
    return this.db.run(async (db) =>
      db
        .insertInto('timbrados')
        .values({
          restaurante_id: restauranteId,
          establecimiento: data.establecimiento || '001',
          punto_expedicion: data.punto_expedicion || '001',
          numero_inicio: data.numero_inicio,
          numero_fin: data.numero_fin,
          numero_actual: data.numero_actual || 0,
          fecha_vencimiento: new Date(data.fecha_vencimiento),
          activo: data.activo ?? true,
        })
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  async listarFacturas(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('facturas')
        .selectAll()
        .where('restaurante_id', '=', restauranteId)
        .orderBy('created_at', 'desc')
        .limit(50)
        .execute(),
    );
  }

  async buscarRuc(restauranteId: number, query: string) {
    const externos = await this.buscarRucExterno(query);
    if (externos.length > 0) return externos;

    return this.db.run(async (db) => {
      const pedidos = await db
        .selectFrom('pedidos')
        .select(['cliente_ruc', 'cliente_nombre'])
        .where('restaurante_id', '=', restauranteId)
        .where('cliente_ruc', 'is not', null)
        .where('cliente_ruc', 'ilike', escapeLike(query))
        .distinct()
        .limit(20)
        .execute();

      return pedidos.map((p) => ({
        ruc: p.cliente_ruc,
        nombre: p.cliente_nombre,
      }));
    });
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
