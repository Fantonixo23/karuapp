import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';

const CAMPOS_PUBLICOS = ['id', 'nombre', 'rol', 'telefono', 'email', 'activo'] as const;

@Injectable()
export class UsuariosService {
  constructor(private db: DatabaseService) {}

  /**
   * El hash del PIN nunca sale del backend. El frontend lo necesita solo al
   * crear (para mostrarlo al admin) y lo recibe como texto plano en ese momento.
   */
  async listar(restauranteId: number) {
    return this.db.run(async (db) =>
      db
        .selectFrom('usuarios')
        .select(['id', 'nombre', 'rol', 'telefono', 'email', 'activo', 'ultimo_acceso', 'created_at'])
        .where('restaurante_id', '=', restauranteId)
        .orderBy('nombre', 'asc')
        .execute(),
    );
  }

  /**
   * Los PIN se guardan con bcrypt, asi que no se pueden comparar por igualdad:
   * el hash de un PIN nunca es igual al PIN. Hay que recorrer los usuarios del
   * tenant y validar con bcrypt.compare.
   */
  private async pinEnUso(restauranteId: number, pin: string, excluirId?: number): Promise<boolean> {
    const hashes = await this.db.run(async (db) =>
      db
        .selectFrom('usuarios')
        .select(['id', 'pin'])
        .where('restaurante_id', '=', restauranteId)
        .execute(),
    );

    for (const u of hashes) {
      if (!u.pin) continue;
      if (excluirId !== undefined && u.id === excluirId) continue;
      if (await bcrypt.compare(pin, u.pin)) return true;
    }
    return false;
  }

  async crear(restauranteId: number, data: { nombre: string; pin: string; rol: string; telefono?: string; creadoPorId?: number }) {
    if (await this.pinEnUso(restauranteId, data.pin)) throw new ConflictException('El PIN ya está en uso');

    const hashedPin = await bcrypt.hash(data.pin, 10);

    return this.db.run(async (db) =>
      db
        .insertInto('usuarios')
        .values({
          restaurante_id: restauranteId,
          nombre: data.nombre,
          pin: hashedPin,
          rol: data.rol,
          telefono: data.telefono ?? null,
          creado_por_id: data.creadoPorId ?? null,
        })
        .returning(CAMPOS_PUBLICOS)
        .executeTakeFirstOrThrow(),
    );
  }

  async editar(restauranteId: number, id: number, data: { nombre?: string; rol?: string; telefono?: string; activo?: boolean }) {
    return this.db.transaction(async (tx) => {
      const usuario = await tx
        .selectFrom('usuarios')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      return tx
        .updateTable('usuarios')
        .set({
          ...(data.nombre !== undefined && { nombre: data.nombre }),
          ...(data.rol !== undefined && { rol: data.rol }),
          ...(data.telefono !== undefined && { telefono: data.telefono }),
          ...(data.activo !== undefined && { activo: data.activo }),
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .returning(CAMPOS_PUBLICOS)
        .executeTakeFirstOrThrow();
    });
  }

  async eliminar(restauranteId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const usuario = await tx
        .selectFrom('usuarios')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      const pedidos = await tx
        .selectFrom('pedidos')
        .select((eb) => eb.fn.countAll<number>().as('c'))
        .where('mesero_id', '=', id)
        .executeTakeFirst();

      if ((pedidos?.c ?? 0) > 0) {
        await tx.updateTable('usuarios').set({ activo: false }).where('id', '=', id).execute();
        return { success: true, message: 'Usuario desactivado (tiene pedidos asociados)' };
      }

      await tx.deleteFrom('usuarios').where('id', '=', id).execute();
      return { success: true };
    });
  }

  async regenerarPin(restauranteId: number, id: number, nuevoPin: string) {
    if (await this.pinEnUso(restauranteId, nuevoPin, id)) {
      throw new ConflictException('El PIN ya está en uso por otro usuario');
    }

    const hashedPin = await bcrypt.hash(nuevoPin, 10);

    return this.db.transaction(async (tx) => {
      const usuario = await tx
        .selectFrom('usuarios')
        .select('id')
        .where('id', '=', id)
        .where('restaurante_id', '=', restauranteId)
        .executeTakeFirst();
      if (!usuario) throw new NotFoundException('Usuario no encontrado');

      // No se devuelve el hash: el admin ya conoce el PIN que acaba de fijar.
      return tx
        .updateTable('usuarios')
        .set({ pin: hashedPin, updated_at: new Date() })
        .where('id', '=', id)
        .returning(['id', 'nombre'])
        .executeTakeFirstOrThrow();
    });
  }
}
