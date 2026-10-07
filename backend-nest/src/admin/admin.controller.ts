import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DatabaseService } from '../database/database.service';
import { countInt } from '../database/agg';
import { Actualizar } from '../database/database.types';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('superadmin')
export class AdminController {
  constructor(private db: DatabaseService) {}

  @Get('restaurantes')
  async listarTodos() {
    return this.db.run(async (db) => {
      const restaurantes = await db
        .selectFrom('restaurantes')
        .selectAll()
        .orderBy('fecha_alta', 'desc')
        .execute();
      if (!restaurantes.length) return [];

      const ids = restaurantes.map((r) => r.id);

      const conteos = await db
        .selectFrom('usuarios')
        .select(['restaurante_id', countInt('usuarios')])
        .where('restaurante_id', 'in', ids)
        .groupBy('restaurante_id')
        .execute();

      const admins = await db
        .selectFrom('usuarios')
        .distinctOn(['restaurante_id'])
        .select(['restaurante_id', 'id', 'nombre', 'email', 'telefono'])
        .where('restaurante_id', 'in', ids)
        .where('rol', '=', 'administrador')
        .orderBy('restaurante_id')
        .orderBy('id')
        .execute();

      const usuariosPorRestaurante = new Map<number, number>();
      for (const c of conteos) {
        if (c.restaurante_id !== null) usuariosPorRestaurante.set(c.restaurante_id, c.usuarios);
      }

      const adminPorRestaurante = new Map<
        number,
        { id: number; nombre: string; email: string | null; telefono: string | null }
      >();
      for (const a of admins) {
        if (a.restaurante_id !== null) {
          adminPorRestaurante.set(a.restaurante_id, { id: a.id, nombre: a.nombre, email: a.email, telefono: a.telefono });
        }
      }

      return restaurantes.map((r) => ({
        ...r,
        _count: { usuarios: usuariosPorRestaurante.get(r.id) ?? 0 },
        usuarios: adminPorRestaurante.has(r.id) ? [adminPorRestaurante.get(r.id)!] : [],
      }));
    });
  }

  @Get('restaurantes/:id')
  async detalle(@Param('id') id: string) {
    return this.db.run(async (db) => {
      const restaurante = await db
        .selectFrom('restaurantes')
        .selectAll()
        .where('id', '=', Number(id))
        .executeTakeFirst();
      if (!restaurante) return null;

      const usuarios = await db
        .selectFrom('usuarios')
        .select(['id', 'nombre', 'email', 'rol', 'activo', 'telefono', 'ultimo_acceso'])
        .where('restaurante_id', '=', restaurante.id)
        .orderBy('id', 'asc')
        .execute();

      const pagos = await db
        .selectFrom('pagos_licencia')
        .selectAll()
        .where('restaurante_id', '=', restaurante.id)
        .orderBy('fecha', 'desc')
        .execute();

      return { ...restaurante, usuarios, pagos };
    });
  }

  @Patch('restaurantes/:id/licencia')
  async actualizarLicencia(
    @Param('id') id: string,
    @Body() body: { plan?: string; fecha_expiracion?: string | null; estado_licencia?: string; motivo_bloqueo?: string },
  ) {
    const data: Actualizar<'restaurantes'> = { updated_at: new Date() };
    if (body.plan !== undefined) data.plan = body.plan;
    if (body.fecha_expiracion !== undefined) {
      data.fecha_expiracion = body.fecha_expiracion ? new Date(body.fecha_expiracion) : null;
    }
    if (body.estado_licencia !== undefined) data.estado_licencia = body.estado_licencia;
    if (body.motivo_bloqueo !== undefined) data.motivo_bloqueo = body.motivo_bloqueo;

    return this.db.run(async (db) =>
      db
        .updateTable('restaurantes')
        .set(data)
        .where('id', '=', Number(id))
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  @Patch('restaurantes/:id/estado')
  async cambiarEstado(@Param('id') id: string, @Body() body: { estado_licencia: string; motivo_bloqueo?: string }) {
    const data: Actualizar<'restaurantes'> = { estado_licencia: body.estado_licencia, updated_at: new Date() };
    if (body.estado_licencia === 'activo') data.motivo_bloqueo = null;
    else if (body.motivo_bloqueo !== undefined) data.motivo_bloqueo = body.motivo_bloqueo;

    return this.db.run(async (db) =>
      db
        .updateTable('restaurantes')
        .set(data)
        .where('id', '=', Number(id))
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  @Post('restaurantes/:id/pagos')
  async registrarPago(
    @Param('id') id: string,
    @Body() body: { monto: number; moneda?: string; nota?: string },
    @CurrentUser('sub') superadminId: number,
  ) {
    return this.db.run(async (db) =>
      db
        .insertInto('pagos_licencia')
        .values({
          restaurante_id: Number(id),
          monto: body.monto,
          moneda: body.moneda || 'PYG',
          nota: body.nota ?? null,
          registrado_por: superadminId,
        })
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  @Get('restaurantes/:id/total-pagado')
  async totalPagado(@Param('id') id: string) {
    const resultado = await this.db.run(async (db) =>
      db
        .selectFrom('pagos_licencia')
        .select((eb) => eb.fn.sum('monto').as('total'))
        .where('restaurante_id', '=', Number(id))
        .executeTakeFirst(),
    );
    return { total: Number(resultado?.total ?? 0) };
  }

  @Delete('usuarios/:userId')
  async eliminarUsuario(@Param('userId') userId: string) {
    return this.db.transaction(
      async (tx) => {
        const usuario = await tx
          .selectFrom('usuarios')
          .select(['id', 'nombre', 'email'])
          .where('id', '=', Number(userId))
          .executeTakeFirst();
        if (!usuario) throw new NotFoundException('Usuario no encontrado');

        if (usuario.email) {
          await tx.deleteFrom('verification_codes').where('email', '=', usuario.email).execute();
        }
        await tx.deleteFrom('usuarios').where('id', '=', Number(userId)).execute();

        return { success: true, message: `Usuario "${usuario.nombre}" eliminado permanentemente` };
      },
      { bypassRls: true },
    );
  }

  @Delete('restaurantes/:id')
  async eliminarRestaurante(@Param('id') id: string) {
    return this.db.transaction(
      async (tx) => {
        const rid = Number(id);
        const restaurante = await tx
          .selectFrom('restaurantes')
          .select(['id', 'nombre'])
          .where('id', '=', rid)
          .executeTakeFirst();
        if (!restaurante) throw new NotFoundException('Restaurante no encontrado');

        await tx.deleteFrom('pagos_licencia').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('movimientos_inventario').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('inventario').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('caja_cortes').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('caja_movimientos').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('caja_sesiones').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('impresiones').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('facturas').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('metodos_pago').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('configuracion').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('timbrados').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('pedidos').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('mesas').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('productos').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('categorias').where('restaurante_id', '=', rid).execute();

        const emails = (
          await tx.selectFrom('usuarios').select('email').where('restaurante_id', '=', rid).execute()
        )
          .map((u) => u.email)
          .filter((email): email is string => Boolean(email));
        if (emails.length) {
          await tx.deleteFrom('verification_codes').where('email', 'in', emails).execute();
        }

        await tx.deleteFrom('usuarios').where('restaurante_id', '=', rid).execute();
        await tx.deleteFrom('restaurantes').where('id', '=', rid).execute();

        return {
          success: true,
          message: `Restaurante "${restaurante.nombre}" y todos sus datos eliminados permanentemente`,
        };
      },
      { bypassRls: true },
    );
  }
}
