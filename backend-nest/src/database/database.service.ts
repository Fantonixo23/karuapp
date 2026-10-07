import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kysely, PostgresDialect, Transaction, sql } from 'kysely';
import { Pool, defaults, types } from 'pg';
import { DB } from './database.types';
import { tenantContext } from './tenant-context';

/**
 * Zona horaria: toda la base usa `timestamp without time zone` y `pg` por defecto
 * serializa y parsea los Date con la hora LOCAL del proceso, mientras que
 * `CURRENT_TIMESTAMP` guarda hora UTC. Resultado: `created_at` (lo escribe la base)
 * y `updated_at` (lo escribe el codigo) quedaban separadas exactamente por el
 * desfase local (3h). Se fija UTC en ambos sentidos para que el instante sea el
 * mismo venga de donde venga.
 *
 * Nota: el pooler de Supabase ignora `-c TimeZone` en las opciones de conexion,
 * por eso esto se resuelve en el driver y no en la sesion.
 */
defaults.parseInputDatesAsUTC = true;
types.setTypeParser(1114, (v) => new Date(`${v}Z`)); // timestamp without time zone

/**
 * `set_config` con is_local = TRUE: la variable vive lo que dura la transaccion y
 * Postgres la descarta al hacer COMMIT o ROLLBACK. Asi el contexto de un tenant
 * no puede sobrevivir en una conexion del pool y heredarse en otro request.
 */
function setContexto(db: Kysely<DB>, restauranteId: string, isSuperadmin: string) {
  return sql`
    SELECT
      set_config('app.current_restaurante_id', ${restauranteId}, TRUE),
      set_config('app.is_superadmin', ${isSuperadmin}, TRUE)
  `.execute(db);
}

/**
 * Acceso a Postgres via `pg` + Kysely.
 *
 * Por que no Prisma: el motor de Prisma no logra conectar al Session pooler de
 * Supabase (P1001) desde este entorno, y con el driver adapter las transacciones
 * interactivas quedan rotas ("Transaction not found"). `pg` conecta sin problema
 * y soporta transacciones, asi que es el camino que funciona contra el pooler.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  private readonly db: Kysely<DB>;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Falta DATABASE_URL: no se puede inicializar DatabaseService');
    }

    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      application_name: 'karuapp',
    });

    this.db = new Kysely<DB>({ dialect: new PostgresDialect({ pool: this.pool }) });
  }

  async onModuleInit() {
    const conn = await this.pool.connect();
    conn.release();
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }

  /** Consultas sin tenant: catalogos publicos y tablas de plataforma. */
  get raw(): Kysely<DB> {
    return this.db;
  }

  /** Pool nativo, para lo que necesite el driver (pg_dump, COPY, etc.). */
  get poolClient(): Pool {
    return this.pool;
  }

  /** Corre `fn` con el tenant actual aplicado. Sin tenant, usa el pool directo. */
  async run<T>(fn: (db: Kysely<DB>) => Promise<T>): Promise<T> {
    const ctx = tenantContext.getStore();
    if (!ctx?.restauranteId && !ctx?.isSuperadmin) return fn(this.db);

    return this.db.transaction().execute(async (tx) => {
      await setContexto(tx, ctx.restauranteId ? String(ctx.restauranteId) : '', ctx.isSuperadmin ? 'true' : 'false');
      return fn(tx);
    });
  }

  /** Igual que `run` pero forzando superadmin (bypass de RLS). */
  async runBypassRls<T>(fn: (db: Kysely<DB>) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(async (tx) => {
      await setContexto(tx, '', 'true');
      return fn(tx);
    });
  }

  /**
   * Varias consultas atomicas con el contexto del tenant ya aplicado.
   * Equivale al `bypassRls(fn)` que teniamos con Prisma.
   */
  async transaction<T>(fn: (tx: Transaction<DB>) => Promise<T>, opciones?: { bypassRls?: boolean }): Promise<T> {
    const ctx = tenantContext.getStore();
    const usaSetConfig = opciones?.bypassRls || Boolean(ctx?.restauranteId) || Boolean(ctx?.isSuperadmin);
    const restauranteId = opciones?.bypassRls ? '' : ctx?.restauranteId ? String(ctx.restauranteId) : '';
    const isSuperadmin = opciones?.bypassRls ? 'true' : ctx?.isSuperadmin ? 'true' : 'false';

    return this.db.transaction().execute(async (tx) => {
      if (usaSetConfig) await setContexto(tx, restauranteId, isSuperadmin);
      return fn(tx);
    });
  }

  /** Transaccion ya inicializada, para cuando el caller hace commit/rollback. */
  async withTx(opciones?: { bypassRls?: boolean }): Promise<Transaction<DB>> {
    const ctx = tenantContext.getStore();
    const usaSetConfig = opciones?.bypassRls || Boolean(ctx?.restauranteId) || Boolean(ctx?.isSuperadmin);
    const restauranteId = opciones?.bypassRls ? '' : ctx?.restauranteId ? String(ctx.restauranteId) : '';
    const isSuperadmin = opciones?.bypassRls ? 'true' : ctx?.isSuperadmin ? 'true' : 'false';

    const tx = await this.db.startTransaction().execute();
    if (usaSetConfig) await setContexto(tx, restauranteId, isSuperadmin);
    return tx;
  }
}
