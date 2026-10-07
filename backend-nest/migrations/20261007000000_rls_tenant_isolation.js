/* Fase 5: RLS real.
 *
 * Aisla cada tenant con politicas `USING` + `WITH CHECK` sobre las 18 tablas
 * de negocio. El contexto lo pone `DatabaseService` con
 * `set_config('app.current_restaurante_id', ..., TRUE)` /
 * `set_config('app.is_superadmin', ..., TRUE)` dentro de cada transaccion.
 *
 * Los roles `karuapp_app` (la app, nobypassrls) y `karuapp_migrate`
 * (migraciones, bypassrls) se crean aca como NOLOGIN: la password se define
 * fuera del repo con `ALTER ROLE ... LOGIN PASSWORD`. En una base fresca hay
 * que correr ese ALTER antes de que la app pueda conectar.
 */

exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'karuapp_app') THEN
        CREATE ROLE karuapp_app NOLOGIN NOBYPASSRLS;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'karuapp_migrate') THEN
        CREATE ROLE karuapp_migrate NOLOGIN BYPASSRLS;
      END IF;
    END $$;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.app_restaurante_id() RETURNS integer
      LANGUAGE sql STABLE AS $fn$
        SELECT NULLIF(current_setting('app.current_restaurante_id', true), '')::integer
      $fn$;

    CREATE OR REPLACE FUNCTION public.app_is_superadmin() RETURNS boolean
      LANGUAGE sql STABLE AS $fn$
        SELECT current_setting('app.is_superadmin', true) = 'true'
      $fn$;
  `);

  pgm.sql(`
    GRANT USAGE ON SCHEMA public TO karuapp_app, karuapp_migrate;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO karuapp_app, karuapp_migrate;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO karuapp_app, karuapp_migrate;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO karuapp_app, karuapp_migrate;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO karuapp_app, karuapp_migrate;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO karuapp_app, karuapp_migrate;
  `);

  const conRestaurante = [
    'usuarios',
    'categorias',
    'productos',
    'mesas',
    'pedidos',
    'impresiones',
    'configuracion',
    'timbrados',
    'facturas',
    'metodos_pago',
    'caja_sesiones',
    'caja_movimientos',
    'caja_cortes',
    'inventario',
    'movimientos_inventario',
    'pagos_licencia',
  ];

  // Tenant por columna `restaurante_id`.
  for (const tabla of conRestaurante) {
    pgm.sql(`
      ALTER TABLE "${tabla}" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "${tabla}" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS tenant_isolation ON "${tabla}";
      CREATE POLICY tenant_isolation ON "${tabla}"
        USING (
          public.app_is_superadmin()
          OR "restaurante_id" = public.app_restaurante_id()
        )
        WITH CHECK (
          public.app_is_superadmin()
          OR "restaurante_id" = public.app_restaurante_id()
        );
    `);
  }

  // `restaurantes`: cada tenant ve y toca solo su propia fila (no se copia
  // el listado publico de activos del proyecto Django).
  pgm.sql(`
    ALTER TABLE "restaurantes" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "restaurantes" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON "restaurantes";
    CREATE POLICY tenant_isolation ON "restaurantes"
      USING (
        public.app_is_superadmin()
        OR "id" = public.app_restaurante_id()
      )
      WITH CHECK (
        public.app_is_superadmin()
        OR "id" = public.app_restaurante_id()
      );
  `);

  // `verification_codes` es global (no tiene restaurante_id): solo superadmin
  // (login, registro, reset, 2FA pasan por runBypassRls).
  pgm.sql(`
    ALTER TABLE "verification_codes" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "verification_codes" FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS superadmin_only ON "verification_codes";
    CREATE POLICY superadmin_only ON "verification_codes"
      USING (public.app_is_superadmin())
      WITH CHECK (public.app_is_superadmin());
  `);

  // `pgmigrations` queda con RLS activa y sin politica: solo la tocan los roles
  // con bypassrls (migraciones), la app no.
  pgm.sql(`ALTER TABLE "pgmigrations" ENABLE ROW LEVEL SECURITY;`);
};

exports.down = (pgm) => {
  const tablas = [
    'usuarios',
    'categorias',
    'productos',
    'mesas',
    'pedidos',
    'impresiones',
    'configuracion',
    'timbrados',
    'facturas',
    'metodos_pago',
    'caja_sesiones',
    'caja_movimientos',
    'caja_cortes',
    'inventario',
    'movimientos_inventario',
    'pagos_licencia',
    'restaurantes',
    'verification_codes',
  ];

  for (const tabla of tablas) {
    pgm.sql(`
      DROP POLICY IF EXISTS tenant_isolation ON "${tabla}";
      DROP POLICY IF EXISTS superadmin_only ON "${tabla}";
      ALTER TABLE "${tabla}" NO FORCE ROW LEVEL SECURITY;
    `);
  }

  pgm.sql(`
    REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM karuapp_app, karuapp_migrate;
    REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM karuapp_app, karuapp_migrate;
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM karuapp_app, karuapp_migrate;
    DROP FUNCTION IF EXISTS public.app_restaurante_id();
    DROP FUNCTION IF EXISTS public.app_is_superadmin();
  `);
};