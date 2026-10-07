# Plan KaruApp: NestJS + Kysely + Supabase

> Reescrito desde cero. El plan anterior describía un backend Django que ya no existe en el repo.
> Regla: si el código cambia de rumbo, se actualiza este archivo en el mismo commit.

## 0. Migración Prisma → `pg` + Kysely (COMPLETADA)

El engine de Prisma no lograba conectar al Session pooler de Supabase (`P1001`) y el driver adapter rompía
las transacciones interactivas. La base se accede con `node-postgres` + Kysely:

- `DatabaseService` (`pg.Pool` + `PostgresDialect`) con `run`/`runBypassRls`/`transaction`/`withTx` y
  contexto de tenant por `set_config(..., TRUE)` dentro de la transacción.
- `database.types.ts` con las 18 tablas en snake_case (contrato de API). Los campos JSONB exigen
  `JSON.stringify` al escribir; los conteos pasan por `countInt()` (`src/database/agg.ts`) porque `pg`
  devuelve bigint como string.
- Zona horaria resuelta **en el driver**: `defaults.parseInputDatesAsUTC = true` + parser de
  `timestamp` como UTC (1114). El pooler ignora `-c TimeZone`, por eso no se hace por sesión.
- Migraciones con **node-pg-migrate** (`migrations/0_init.sql`, marcada como aplicada). Las
  `prisma/migrations/` quedan como referencia histórica; la tabla `_prisma_migrations` fue eliminada.
- Tabla `_count`/`usuarios` del panel admin y resto del contrato: el frontend consumió el cambio a
  snake_case (ver Fase 9: contracto de API).

## 1. Diagnóstico: estado real del repo

| Tema | El plan viejo asumía | Realidad |
|---|---|---|
| Backend | Django (`backend/apps/...`) | `backend-nest/`: NestJS 11 + Prisma 6. Django borrado del working tree (348 eliminaciones sin commitear) |
| Proxy dev | `:8000` | `:3000` (`vite.config.js:17-25`) hacia NestJS |
| Migraciones | Django `tenants/0003-0005` (RLS) | `prisma/migrations/` tiene una sola (`20260728_add_email_unique`) y `0_init/` está **vacía**. La RLS nunca se portó |
| Realtime | Socket.IO por migrar | Socket.IO ya está en NestJS (`socket.gateway.ts`) |
| Storage | `DEFAULT_FILE_STORAGE` (Django) | Ya usa `@supabase/supabase-js` (`productos.controller.ts:64-76`) |

### Hallazgos

**Bloqueantes**

1. **No existe columna de contraseña.** `schema.prisma:43-70` (`Usuario`) no tiene `password`. `registerSaas` guarda el hash bcrypt dentro de `pin` (`auth.service.ts:165,188`) y `loginSaas` compara contra `pin` (`auth.service.ts:43`). `pin` es `@@unique([restauranteId, pin])` y debería ser de 4 dígitos. Consecuencia: un dueño no puede entrar por PIN, y quien regenera PIN (`Funcionarios.jsx`) pierde el login por email.
2. **Takeover de cualquier cuenta.** `utils.controller.ts:115-139`: `forgot-password` y `verify-reset-code` son `@Public()` y devuelven el código en el JSON (línea 127). Lo mismo `send-owner-code` (línea 102). Cualquiera puede resetear la contraseña de cualquier email.
3. **Cero aislamiento en la base.** No hay RLS y `DATABASE_URL` usa el rol `postgres` (BYPASSRLS). El `set_config` de `withTenant()` (`prisma.service.ts:20-27`) hoy no hace nada. El aislamiento depende de que cada service pase `restauranteId` en el `where` (140 llamadas de 178 van por `withTenant()`, 33 por `bypassRls()`).

**Graves**

4. **El slug elige el tenant.** `rls-context.interceptor.ts:15-26, 39-48` acepta `?restaurante=`, el header `x-restaurant-slug` y `body.restaurante_slug`. El frontend lo manda en todos los `/api/*` (`api.js:73-77`).
5. **`login-pin` busca en toda la base.** El DTO espera `restaurante` (`auth.controller.ts:19`) y el frontend manda `restaurante_slug` (`useStore.js:141`). Llega `undefined`, no se filtra por tenant (`auth.service.ts:85-91`) y no hay rate limiting. Un PIN de 4 dígitos son 10.000 combinaciones.
6. **Sin refresh token.** `JWT_EXPIRATION` por defecto 7 d, sin endpoint de refresh y sin manejo de 401 en el frontend. A los 7 días el local pierde la sesión (y la venta en curso).

**Bug activo, independiente de la nube**

7. **Cuatro vocabularios de licencia distintos**, y uno de los checks es código muerto:

   | Capa | Valores |
   |---|---|
   | Admin panel escribe (`AdminRestauranteDetalle.jsx:37`) | `activo`, `suspendido`, `pendiente` |
   | `LicenseGuard:25-31` | `pendiente`, `suspendido`, y `!== 'activo'` |
   | `jwt.strategy:50,53` | `suspended` (inglés, **nunca se escribe**), `expirado` |
   | `LicenseBanner.jsx:9-27,67` | `bloqueada`, `por_vencer_1/3/5`, `gracia` |

   `jwt.strategy:50` compara contra `'suspended'`, un valor que el panel no puede generar: ese check nunca dispara y solo lo salva el `catch-all` de `LicenseGuard`. Y `expirado` lo escribe `jwt.strategy:55` pero no está en el dropdown del panel, así que un tenant vencido queda en un estado que el admin no puede volver a seleccionar.

**Otros** (detalle en las fases): `GET /api/print-token` público, `GET /api/info` público filtrando datos de otro tenant, sin límite de tamaño/tipo en la subida de imágenes, token JWT en query string, endpoints que el frontend llama y no existen, licencia hardcodeada, impresión sin cola real, sin tests, sin health check.

## 2. Decisiones tomadas

| Decisión | Resolución |
|---|---|
| Código Django | Crear tag `django-final` antes y **commitear el borrado**. No restaurar en el working tree |
| RLS: modelo de transacción | **Opción (a):** transacción por request con `AsyncLocalStorage` y `set_config(..., true)` (local a la transacción). `restauranteId` sigue en cada `where` como segunda barrera |
| Nombre del GUC | Se conserva `app.current_restaurante_id` (el que usan el código actual y las políticas de Django). No renombrar durante el port |
| Origen del tenant | Solo el JWT. El slug se acepta **únicamente en el body de los endpoints de login/registro** |
| Rate limiting | Backend compartido (Redis o Postgres), **nunca en memoria**: con más de una instancia el throttle en memoria no cuenta nada |
| SIFEN | Fuera de alcance por ahora. Ver Fase 9: se deshabilita la UI y se documenta con fecha de revisión |
| Proyecto Supabase | Nuevo. No se reutiliza `sbgmmrsmqdcxzecdmrww` (datos de dev y service key en texto plano). **Hecho:** `ibwdxpjpeyhpljucihkd`, esquema aplicado con `migrate deploy` |
| Hosting | **Solo Supabase + Vercel.** Sin Render, sin Fly, sin Railway, sin VPS y **sin Docker**. El backend NestJS se despliega como serverless functions en Vercel |
| Realtime | **Supabase Realtime, obligatorio.** No es una optimización: serverless no sostiene conexiones WebSocket persistentes, así que Socket.IO no puede funcionar en Vercel |
| Uploads | **Supabase Storage, obligatorio.** Vercel tiene el filesystem de solo lectura, así que `backend-nest/uploads/` no puede existir en cloud |
| Pooler | **Session mode (Supavisor), nunca transaction mode.** Cada invocación serverless abre su propia conexión; `set_config(..., true)` a nivel de transacción exige sesión dedicada |

> Por qué (a): con rol `nobypassrls` y `FORCE ROW LEVEL SECURITY`, cualquier query fuera de `withTenant()` devuelve cero filas o falla. La RLS deja de ser "red de seguridad" y pasa a ser obligatoria, así que conviene que funcione bien en flujos multi-query (pedido + items + impresión), donde la atomicidad importa más que el esfuerzo extra.

## 3. Orden de ejecución

```
Fase A  Fixes urgentes (días 1-3)        -> cierra takeover y fuerza bruta de PIN
Fase 0  Supabase nuevo + roles + baseline + secretos
Fase 1  Baseline git
Fase 2  Tests de aislamiento (mínimos)   -> red de seguridad antes de tocar tenant/RLS
Fase 3  Schema: contraseña real
Fase 4  Tenant solo desde JWT
Fase 5  RLS real
Fase 5b Vocabulario de licencia unificado
Fase 6  Auth: refresh + login unificado
Fase 7  Spike JWT de Realtime            -> idealmente antes de cerrar Fase 6
Fase 8  Realtime con Supabase           -> BLOQUEANTE de deploy (sin WS en serverless)
Fase 9  Storage + contrato API roto + SIFEN  -> BLOQUEANTE de deploy (fs de solo lectura)
Fase 10 Impresión
Fase 11 Deploy
Fase 12 Tests ampliados
Fase 13 Migración de datos y piloto
```

> Las Fases 8 y 9 dejaron de ser "mejoras" y pasaron a ser **precondición del deploy**. Con el backend en Vercel serverless no hay WebSocket persistente ni disco escribible: si se deploya sin ellas, el backend no levanta o las imágenes no se guardan.

## Fase A: Fixes urgentes (hoy)

Cambios chicos que cierran los riesgos más graves sin esperar a nada.

- [x] `forgot-password`, `verify-reset-code`, `send-owner-code`: **nunca devolver el código** en la respuesta. Exigir SMTP configurado; si no está, fallar de forma explícita. **Hecho, pero por borrado:** los cuatro endpoints no los usaba el frontend, así que se eliminaron en vez de repararse. `EmailService.assertConfigured()` ahora corta los flujos con 503 si falta SMTP, y se eliminó el log `[DEV EMAIL]` que escribía el código en el log del server.
- [x] Unificar los dos flujos de reset que compiten (`auth.controller.ts` vs `utils.controller.ts`) en uno solo. **Hecho:** sobreviven `olvide-contrasena` / `verificar-codigo` / `restablecer-contrasena`.
- [x] Quitar `devCode` de la respuesta (`auth.service.ts:209`). **Hecho** en `registerSaas` y en `reenviarCodigo`.
- [x] `login-pin`: corregir el nombre del campo (`restaurante_slug` en el DTO) y **filtrar siempre por tenant**. Si falta el slug, rechazar. **Hecho, y además:** el código viejo filtraba por `where: { pin }` en texto plano contra un campo hasheado con bcrypt, así que nunca podía funcionar. Ahora busca los usuarios del restaurante y compara con bcrypt, rehasheando los PINs legacy en plaintext.
- [ ] Rate limit en `login-pin`, `login-saas` y en el reset de contraseña: 5 intentos / 15 min por IP + tenant, con backend Redis o Postgres (ver §2). Aprovechar que `verification_codes.attempts` y `blockedUntil` (`schema.prisma:79-80`) ya existen y hoy nadie escribe. **Parcial:** `RateLimitService` con ventana deslizante y clave `scope:ip:identificador`, aplicado a los 8 endpoints públicos de auth. El backend es **memoria**, no Redis: sirve con una sola instancia y hay que migrarlo antes de escalar (Fase 11). Además el lockout de `verification_codes.attempts` era inalcanzable porque nada lo incrementaba; ahora `consumeCode` lo cuenta y bloquea.
- [x] Borrar `GET /api/print-token` (público, devuelve el token). **Hecho.** La impresión sigue funcionando por el fallback `pipper-print-token-default` de `qzPrint.js:26` hasta que se rehaga en la Fase 10.
- [x] `helmet` y CORS con lista de orígenes (sin `origin: '*'`). **Hecho:** `CORS_ORIGINS` es obligatorio en producción y el backend no arranca sin eso.
- [x] Fijar el algoritmo del JWT en `jwt.strategy.ts` (`algorithms: ['HS256']`) para evitar confusión de algoritmo. **Hecho,** y de yapa se quitó `ExtractJwt.fromUrlQueryParameter('token')` (el token viajaba en la URL de los uploads multipart y quedaba en los logs del proxy) junto con el `api.js` que lo agregaba.
- [x] `GET /api/info` es público y hace `configuracion.findFirst()` con el tenant derivado del slug: devuelve RUC y nombre de empresa de cualquier restaurante. Dejarlo público solo con datos del proyecto, o borrarlo. **Hecho:** borrado, no lo usaba el frontend.
- [ ] Rotar la service key de `sbgmmrsmqdcxzecdmrww` y verificar que no quedó en el historial de git (`.env` está en `.gitignore`, pero conviene confirmarlo una vez).

**Extra, fuera de la lista pero del mismo tipo de agujero:**

- [x] `GET /api/mobile/funcionarios/:slug` devolvía `select: { pin: true }`: los hashes de PIN de **todos** los empleados del restaurante, a cualquier usuario con un JWT (es decir, también a un mesero). Ahora no devuelve el PIN.
- [x] El backend nunca cargaba `.env` (no había `ConfigModule` ni `dotenv`), así que `JWT_SECRET`, `SMTP_*` y `CORS_ORIGINS` llegaban `undefined`. Con `JWT_SECRET` ahora obligatorio eso rompía el arranque. Agregado `ConfigModule.forRoot({ isGlobal: true })` y `JwtModule.registerAsync` para que la validación corra en la instanciación y no al importar el módulo.
- [x] `prisma/migrations/0_init/` estaba **vacío**, sin `migration.sql`. `migrate deploy` no creaba ninguna tabla. Baseline generado desde `schema.prisma` (18 tablas, 7 índices únicos) y aplicado.
- [ ] `usuarios.service.ts:12` sigue devolviendo `pin: true` en el listado de empleados, y `Funcionarios.jsx:239` lo mete en el formulario de edición. Con bcrypt el campo muestra un hash, así que la pantalla está rota además de filtrar. Es Fase 3 (separar `pin` de `passwordHash`), no Fase A.
- [ ] `usuarios.service.ts:72` compara el PIN nuevo en texto plano contra los hashes para detectar duplicados: nunca coincide. Y `:80` devuelve el hash en vez del PIN generado, así que el admin nunca ve el PIN nuevo. Mismo Fase 3.

**Criterio de salida:** ningún endpoint público devuelve un código o token; un PIN no se puede probar más de 5 veces por ventana; la suspensión de un tenant bloquea de forma consistente.

## Fase 0: Proyecto Supabase nuevo

Datos necesarios: URL, project-ref, anon key, service_role key, contraseña de DB.

Crear **dos roles**:

```sql
create role karuapp_migrate login password '...' bypassrls;   -- solo node-pg-migrate
create role karuapp_app     login password '...' nobypassrls; -- la app
```

- La app conecta con `karuapp_app`.
- `npm run db:migrate` (`node-pg-migrate up`) corre con `karuapp_migrate` como paso de release, contra la **conexión directa (5432)**, no contra el pooler.

**Baseline del esquema (paso obligatorio).** `prisma/migrations/0_init/` está vacía, así que hoy `migrate deploy` no crea nada: solo intentaría crear el índice de email sobre una tabla inexistente. Generar la migración inicial antes de tocar la base nueva:

```bash
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql
```

> **Estado actual (actualizado):** el baseline ya no depende de Prisma. Está en
> `migrations/0_init.sql` (node-pg-migrate): reproduce el esquema completo más el índice único de email,
> los defaults de `updated_at` y el `ENABLE ROW LEVEL SECURITY` de las 18 tablas. En la base actual la
> migración está **marcada como aplicada** en `public.pgmigrations` (no se ejecuta de nuevo). En la Fase
> 2/5 se cambia el rol de la app a `karuapp_app`.

- Activar backups/PITR y **probar una restauración** antes del piloto.

**Criterio de salida:** `karuapp_app` no puede leer tablas de otro tenant ni saltarse RLS, y el esquema existe completo tras `migrate deploy`.

## Fase 1: Baseline git

1. `git tag django-final` (o rama) sobre el último commit con Django.
2. Commitear el borrado de Django, el alta de `backend-nest/` y este `plan.md`.
3. Este `plan.md` queda como única fuente de verdad.

## Fase 2: Tests de aislamiento mínimos

No hay runner instalado. Montar `backend-nest/test/` con Jest + supertest.

Checks iniciales (se amplían en la Fase 12):

- [ ] Usuario del tenant A no lee datos del tenant B.
- [ ] Usuario del tenant A no puede escribir/modificar datos del tenant B.
- [ ] Un slug en query/header no cambia el tenant.
- [ ] `login-pin` con PIN de otro tenant falla.
- [ ] Endpoints de reset no devuelven el código.
- [ ] `GET /api/info` sin token no filtra datos de ningún tenant.

## Fase 3: Schema, contraseña real

1. Agregar `Usuario.passwordHash String? @map("password_hash")`.
2. **Migración de datos:**
   - Hacer backup antes.
   - Detectar hashes bcrypt en `usuarios.pin` por prefijo (`$2a$`, `$2b$`, `$2y$`) y longitud 60, no solo por longitud.
   - Mover el hash a `passwordHash`; generar un PIN real de 4 dígitos o dejar `pin` en `null`.
3. `registerSaas` y `loginSaas` pasan a `passwordHash`. `pin` vuelve a ser solo de 4 dígitos.
4. Email único **case-insensitive**: índice único sobre `lower(email)` (SQL crudo, Prisma no declara índices funcionales) o `citext`. Antes, verificar que no existan duplicados que difieran solo en mayúsculas.
5. **Normalizar `restauranteId`:** hoy 11 modelos lo tienen nullable y 4 lo tienen `NOT NULL` (`caja_sesiones`, `caja_movimientos`, `caja_cortes`, `pagos_licencia`). Con RLS, un tenant ausente produce conjunto vacío en unas tablas y error de FK en otras: dos comportamientos distintos según la tabla. Dejar `NOT NULL` donde sea semánticamente obligatorio y limpiar huérfanos antes.

## Fase 4: Tenant solo desde el JWT

1. Borrar `extraerSlug()` de `rls-context.interceptor.ts`. Sin token, `restauranteId = null` y las queries devuelven vacío.
2. **Excepción acotada:** `login-pin`, `login-saas` y registro reciben el slug en el body (aún no hay token). El interceptor general nunca lo lee: estos endpoints resolvieron el tenant por su cuenta.
3. **Bypass explícito para endpoints públicos.** `loginPin` hoy usa `withTenant()` (`auth.service.ts:86,93`), y con `restauranteId = null` + `FORCE RLS` devolvería 0 filas: **el login por PIN deja de funcionar**. Estos handlers deben pasar por `bypassRls` o por una función `SECURITY DEFINER` acotada, nunca por `withTenant()`.
4. Frontend: en `api.js:73-77` eliminar el append de `?restaurante=` y borrar `getRestauranteSlug()`.
5. `productos.controller.ts:64` (subir imagen): `@Roles('administrador')` y prefijo `tenant/<restauranteId>/productos/`.
6. `utils.controller.ts:141` (`mobile/funcionarios/:slug`): hoy devuelve PINs. Restringir a administrador del propio tenant.
7. Auditar los 16 services **con tests**, no con grep.

## Fase 5: RLS real (COMPLETADA)

> Hecho con la migracion `migrations/20261007000000_rls_tenant_isolation.js`:
> roles `karuapp_app` (NOBYPASSRLS, la app) y `karuapp_migrate` (BYPASSRLS) creados
> como NOLOGIN (password por `ALTER ROLE ... LOGIN PASSWORD`, fuera del repo);
> `ENABLE` + `FORCE ROW LEVEL SECURITY` en las 18 tablas; politicas
> `tenant_isolation` con `USING` **y** `WITH CHECK` (`app_is_superadmin()` o
> `restaurante_id = app_restaurante_id()`); `restaurantes` con politica propia
> (sin listado publico); `verification_codes` con `superadmin_only`.
> `DATABASE_URL` apunta a `karuapp_app` (pooler) y `DIRECT_DATABASE_URL` queda
> para `node-pg-migrate` (postgres, dueno, BYPASSRLS).
>
> Los endpoints publicos ya resolvian el tenant por su cuenta con `runBypassRls`
> (no hizo falta `SECURITY DEFINER`). Ajustes de codigo para RLS: `caja.service`
> (`calcularEfectivoEsperado`) ahora pasa por `run()` con contexto;
> `utils.verificar-licencia` y el `ultimo_acceso` de `loginPin` pasan a `runBypassRls`.
>
> **Criterio de salida cumplido:** E2E completo verde con `karuapp_app`; sin
> contexto de tenant las queries devuelven 0 filas; aislamiento cross-tenant
> verificado (SELECT/UPDATE no ven al otro tenant y `WITH CHECK` rechaza INSERT
> cruzado); login por PIN y SaaS siguen funcionando con RLS activa.
>
> **Pendiente operativo:** en Vercel cargar `DATABASE_URL` con `karuapp_app` y
> definir la password de los roles en el proyecto de produccion.

## Fase 5 (notas originales)

1. Migración SQL con `ENABLE` + `FORCE ROW LEVEL SECURITY` en las 15 tablas de negocio.
2. Políticas con `USING` **y** `WITH CHECK` (las de Django solo tenían `USING`, así que las escrituras no se restringían).
3. `restaurantes` con política propia. No copiar `lectura_publica_activos` de Django `0005:39-41` (dejaba leer todos los tenants activos).
4. **Endpoints públicos con RLS forzada.** Login, registro y reset corren sin tenant (ver Fase 4.3). Definir un camino explícito: funciones `SECURITY DEFINER` acotadas (buscar usuario por email, buscar restaurante por slug) o políticas específicas. Es el punto más fácil de olvidar.
5. `verification_codes` (global, sin `restauranteId`): decidir explícitamente cómo se accede (función `SECURITY DEFINER` o tabla fuera de RLS con permisos mínimos).

6. **Arreglar las 4 queries que quedan fuera del contexto RLS.** Con `nobypassrls` + `FORCE`, cualquier `this.prisma.<model>` directo devuelve `null`, y las cuatro están en el path de autenticación:

   | Línea | Query | Consecuencia al activar RLS |
   |---|---|---|
   | `jwt.strategy.ts:21` | `prisma.usuario.findUnique` | `usuario = null` → **401 en todas las requests** |
   | `jwt.strategy.ts:45` | `prisma.restaurante.findUnique` | `{licencia_activa:false}` → **401 "Licencia expirada" para todos** |
   | `jwt.strategy.ts:55` | `prisma.restaurante.update` | no puede marcar `expirado` |
   | `rls-context.interceptor.ts:19` | lookup por slug | desaparece en la Fase 4 |

   Las tres de `JwtStrategy` pasan a `bypassRls`: el strategy corre **antes** que los guards y que el interceptor, así que no hay contexto de request al que agarrarse. Son tres líneas, pero si se pasan la app no arranca en el deploy. De las 178 llamadas totales, las otras 174 ya usan `withTenant()` o `bypassRls()`.

7. Implementar `withTenant()` request-scoped:
   - Una transacción por request con `AsyncLocalStorage`.
   - `set_config('app.current_restaurante_id', ..., true)` al inicio.
   - Todos los services usan el cliente de la transacción del contexto.

8. **Detalles de implementación que hay que respetar:**
   - **Commitear antes de responder.** El commit ocurre cuando el observable del handler completa. Si Nest ya serializó y mandó el `201`, el cliente ve éxito y después la transacción hace rollback. Estructurar el interceptor con `lastValueFrom` y resolver recién después del commit, no con un `tap()`.
   - **Los guards quedan fuera de la transacción.** `LicenseGuard:21` ya usa `bypassRls` (bien). `RolesGuard` no consulta DB. Que quede documentado para que nadie asuma que los guards ven la transacción del request.
   - **Nada de subidas dentro de la transacción.** `productos.controller.ts:64-76` sube el archivo a Supabase con el `service_role`. Si eso corre dentro de la transacción del request, retiene una conexión durante toda la subida. Subir primero, escribir la fila después.
   - **Medir el fan-out.** Hoy el pooler ve una conexión por query; con transacción por request, `Informes.jsx:116-120` dispara 6 endpoints en un `Promise.all` y retiene 6 conexiones a la vez. Si `Informes` se pone lento, el problema es el fan-out, no la RLS.
   - Evaluar sacar las lecturas simples fuera de la transacción solo si las mediciones lo justifican.

**Criterio de salida:** los tests de la Fase 2 pasan con `karuapp_app`; una query sin contexto de tenant devuelve cero filas; y un login por PIN sigue funcionando con RLS activa.

## Fase 5b: Vocabulario de licencia unificado

Hoy hay cuatro vocabularios (§1, hallazgo 7) y un check muerto.

1. Definir un enum de Prisma (o una tabla de constantes) con el vocabulario único: `activo`, `pendiente`, `suspendido`, `expirado`.
2. Migrar los valores existentes y agregar `expirado` al `STATUS_OPTIONS` del admin panel (`AdminRestauranteDetalle.jsx:37`), que hoy no lo puede seleccionar.
3. `jwt.strategy:50`: el check contra `'suspended'` se elimina o se corrige al valor canónico.
4. `LicenseGuard` y `JwtStrategy` pasan a consumir el enum, y se elimina la duplicación: hoy los dos chequean licencia en cada request con dos queries de sobra.
5. Alinear `/api/verificar-licencia` (hardcodeado a activa/365) con el vocabulario del banner (`por_vencer_1/3/5`, `gracia`, `bloqueada`). Hoy el backend devuelve `activo` y `LicenseBanner` nunca se renderiza.
6. Decidir una sola fuente para el frontend: alimentar el banner desde `/api/auth/me` o dejar el poll, pero no ambos.

## Fase 6: Auth, refresh y login unificado

1. Access token 1 h + refresh token 30 d rotativo. `POST /api/auth/refresh`.
2. `apiFetch` (`api.js:88-91`): un solo reintento tras 401; si el refresh falla, `logout()` y redirección a `/login`.
3. `jwt.strategy.ts:20-40`: verificar `payload.restauranteId === usuario.restauranteId`.
4. Unificar el shape de `user`: `AdminLogin.jsx:31` escribe snake_case, `useStore.js:145` escribe camelCase.
5. `Sidebar.jsx:17` cae a `administrador` si el rol no existe (fail-open). Usar el `modulo_acceso` que ya manda el backend (`auth.service.ts:131`).
6. `RequireRole.jsx:18` renderiza `children` antes del redirect (flash de contenido admin).
7. Borrar el whitelist `DOMINIOS_VALIDOS` del cliente (`Login.jsx:5`); el backend ya valida (`auth.service.ts:150`).
8. Quitar el token JWT del query string en subidas con `FormData` (queda en access logs). `fetch` sí permite headers con `FormData`.

## Fase 7: Spike de Realtime (medio día)

Es la mayor incertidumbre técnica y puede cambiar el diseño de auth, así que se hace antes de cerrar la Fase 6.

1. En el proyecto nuevo: Dashboard, Authentication, JWT Keys. Si el proyecto usa clave de firma asimétrica en vez del secret legado, el `JWT_SECRET` propio no sirve: hay que importar una clave propia.
2. Probar el caso negativo: un token con `restaurante_id = 1` **no** debe poder suscribirse al canal `restaurante:2`.

## Fase 8: Realtime (COMPLETADA)

> Hecho: `RealtimeService` con `realtime.send()` desde la base (mismos 5 helpers), `POST /api/auth/realtime-token`,
> `useSocketStore.js` reescrito con `@supabase/supabase-js` (mismo contrato de `useRealTime()`), `socket.gateway.ts`
> borrado y dependencias `socket.io` / `@nestjs/platform-socket.io` / `@nestjs/websockets` retiradas.
> Politicas de `realtime.messages` en `supabase/realtime_policies.sql` (aplicar a mano + activar canales privados).
> Falta operativo: configurar `SUPABASE_JWT_SECRET` y `VITE_SUPABASE_*` en Vercel, y aplicar el SQL de politicas.

> **Bloqueante del deploy.** El backend va a Vercel serverless, que no sostiene conexiones WebSocket persistentes. Si se deploya sin esta fase, `socket.gateway.ts` no puede funcionar y las reservas de mesa, los cambios de estado de pedidos y las notificaciones de cocina dejan de llegar al frontend. No hay alternativa técnica: o Supabase Realtime, o un host always-awake (que no se va a usar).

1. Políticas sobre `realtime.messages` + proyecto en modo solo canales privados.
2. `src/realtime/realtime.ts` con `select realtime.send(payload, evento, 'restaurante:<id>', true)`. Los 5 helpers de `socket.gateway.ts:32-55` conservan su firma.
3. `POST /api/auth/realtime-token`: JWT de 1 h con `role: authenticated`, `aud: authenticated`, `restaurante_id` (string); variante `agente` para el agente de impresión.
4. Frontend: agregar `@supabase/supabase-js` y reescribir `useSocketStore.js` preservando el contrato de `useRealTime()` (`Cocina.jsx:42` y `NuevaVenta.jsx:59` no se tocan). En `SUBSCRIBED`, llamar `refetchEstado()` por REST: Broadcast no repite mensajes perdidos.
5. Borrar `socket.gateway.ts` y las dependencias `socket.io`, `@nestjs/platform-socket.io`, `@nestjs/websockets`.

## Fase 9: Storage, contrato API roto y SIFEN (COMPLETADA)

> Hecho: `subir-imagen` con `@Roles`, limite 5 MB, filtro de tipo y path `tenant/<id>/productos/`;
> `main.ts` ya no sirve `/uploads`. Verbos corregidos a `PUT` (`mesas/:id/editar`, `pedidos/:id/items/reemplazar`)
> y agregados `PUT categorias/:id/editar` y `PUT facturacion/metodos-pago/:id/editar`. Borrados `/api/backup`
> y `/api/qr-conexion` (con su UI) y `verificar-licencia` ahora calcula el estado real. SIFEN fuera: ruta
> `/app/sifen`, `SifenConfig.jsx` y llamadas a `/api/sifen/status` eliminadas.

> **Bloqueante del deploy.** Vercel monta el filesystem de solo lectura, así que `backend-nest/uploads/` no puede existir en cloud: `productos/subir-imagen` y `main.ts:30` no tienen dónde escribir. Hasta que el bucket esté por tenant, el deploy no sirve.

**Storage** (ya está a medio hacer)

- El bucket `productos` existe. Falta: path por tenant, `@Roles`, límite de tamaño y tipo (hoy un archivo de 500 MB sube), y decidir bucket público vs privado con signed URLs.

**Endpoints que el frontend llama y el backend no tiene (o con otro verbo)**

| Endpoint | Frontend |
|---|---|
| `PUT pedidos/:id/items/reemplazar` | `TomarPedido.jsx:216` |
| `PUT mesas/:id/editar` | `NuevaVenta.jsx:225` |
| `PUT categorias/:id/editar` | `Productos.jsx:761` |
| `PUT facturacion/metodos-pago/:id/editar` | `Configuracion.jsx:155` |

**Stubs y limpieza**

- `/api/verificar-licencia` está hardcodeado a activa/365 (ver Fase 5b).
- Borrar `/api/backup` ("no implementado en cloud") y `/api/qr-conexion` (`qr_base64: null`, pero `Inicio.jsx` renderiza un QR).
- `main.ts:30` sirve `/uploads` desde `__dirname/../uploads`: en cloud es código muerto y obliga a que el directorio exista. Sacarlo.

**SIFEN (fuera de alcance por ahora)**

- Quitar la ruta `/app/sifen` de `App.jsx`, eliminar `SifenConfig.jsx` y las 3 llamadas a `/api/sifen/status` (`Caja.jsx:300` y las de `SifenConfig.jsx`) para no dejar 404.
- `Factura.sifenEstado` y `Timbrado` quedan sin uso.
- **La facturación electrónica en Paraguay es obligatoria.** Registrar una fecha de revisión (a definir), porque puede bloquear la venta a clientes reales.

## Fase 10: Impresión

Es casi un subproyecto, no una fase menor.

1. `Impresion` (`schema.prisma:186-202`) hoy es un contador, no una cola. Agregar `estado`, `intentos`, `error`, `updatedAt` y un proceso de reintentos.
2. Hoy el navegador imprime directo a `http://localhost:5123` (`qzPrint.js:47`). Con la SPA en Vercel esto es mixed content / `localhost` inexistente. Construir un **agente saliente** (WSS hacia afuera) que consuma la tabla `Impresion` como cola real.
3. `qzPrint.js:1` usa `window.location.origin` e ignora `VITE_API_URL`.

## Fase 11: Deploy (PARCIAL)

> Hecho: `createApp()` extraido en `main.ts` (bootstrap condicional), `GET /api/health`, entrypoint
> `backend-nest/api/index.js` + `vercel.json` (frontend y backend por separado), `vercel.json` de la SPA.
> Falta operativo: cargar env vars en Vercel (`DATABASE_URL` pooler sesion, `JWT_SECRET`, `SUPABASE_*`,
> `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, `VITE_*`), correr `npm run db:migrate` como paso previo, y validar
> el cold start (~4 s) contra `maxDuration: 60`.

Solo **Supabase + Vercel**. Sin Docker, sin Render, sin Fly, sin Railway, sin VPS. El backend NestJS se despliega como serverless functions en el mismo proyecto de Vercel que el frontend (o en uno aparte, con el dominio del API propio; esto decide si `VITE_API_URL` apunta a un host distinto).

**Precondiciones, no opcionales:** las Fases 8 y 9 tienen que estar terminadas. Serverless no tiene WebSocket persistente ni disco escribible.

1. **Backend como serverless functions.** `@vercel/node` con un entrypoint que levante Nest y exporte el handler. Ajustar `maxDuration` (por defecto 10 s y el bootstrap de Nest mide ~4 s, así que va justo) y `export const config = { maxDuration: 60 }`.
2. **Pool en serverless.** Instanciar el `pg.Pool` una sola vez por instancia reutilizada (module-level singleton + `enablePingTesting`). Sin conexión directa a Supabase: usar el **Session pooler** (Supavisor modo sesión). El modo transacción rompe `set_config(..., TRUE)` de la Fase 5. Con Kysely + `pg` el pooler del proyecto `ibwdxpjpeyhpljucihkd` ya conecta sin `P1001`.
3. **`npm run db:migrate` fuera del arranque.** Como paso de CI o comando manual previo al deploy, con el rol `karuapp_migrate`. Arrancarlo en cada cold start duplica migraciones y racea con el tráfico.
4. **Migrar `RateLimitService` a Redis.** En serverless cada invocación es una instancia nueva, así que el backend en memoria cuenta cero. Sale de la definición del límite en 15 min por IP + tenant de la Fase A.
5. **Frontend en Vercel**, root `frontend-react`, `VITE_API_URL` obligatorio. Ojo con el rewrite actual de `vercel.json`: `/(.*) → /index.html` es un catch-all que se come `/api/*`; si el API termina en el mismo dominio hay que agregar un rewrite más específico **antes** del catch-all.
6. **Cabeceras de seguridad en `vercel.json`:** CSP (debe permitir el WSS de Supabase, `fonts.googleapis.com` **y** `fonts.gstatic.com`, que `index.html` carga ambas), HSTS, `nosniff`, `X-Frame-Options`.
7. `GET /api/health` para monitoreo.
8. ~~Borrar el `Dockerfile` y el `.dockerignore` del frontend~~ **hecho.** Falta borrar el hack de serveo en `main.jsx:8-15`.
9. Verificar que `CORS_ORIGINS` incluya el dominio real de Vercel. `main.ts` ahora se niega a arrancar en producción sin eso.

## Fase 12: Tests ampliados

Portar los 12 checks de aislamiento del plan anterior (§5) a `backend-nest/test/` y agregar: refresh token, rate limit, subida de archivos, canales Realtime y flujos multi-query atómicos (pedido + items + impresión). Correr en CI antes de cada deploy.

## Fase 13: Migración de datos y piloto

1. Script de migración Django/SQLite a Supabase.
2. 1-2 restaurantes piloto en paralelo con el sistema actual.
3. Corte cuando estén estables, con backup verificado y plan de rollback.
4. Si SIFEN sigue deshabilitado, la numeración de facturas no colisiona entre los dos sistemas. Si se reactiva antes del piloto, hay que definir qué sistema es el dueño de la secuencia para no duplicar.

## 4. Estimación

| Bloque | Estimación |
|---|---|
| Fase A | 2-3 días |
| Fases 0-6 (cierran los 3 bloqueantes: contraseña, takeover, RLS) | 12-15 días |
| Fases 7-11 | 6-8 días (la impresión puede crecer) |
| Fases 12-13 | 1-2 semanas |

Las cifras son estimaciones, no compromisos. La más incierta es la Fase 10 y, en menor medida, el resultado del spike de la Fase 7.

## 5. Riesgos abiertos

- **Serverless sin estado:** Vercel no mantiene instancias entre requests. Rompe el rate limit en memoria (Fase 11.4), obliga a `maxDuration` holgado por el cold start de Nest+Prisma, y rompe cualquier singletón en memoria. Es la contrapartida de no usar un host always-awake.
- **Pooler del proyecto nuevo:** hoy ningún pooler de `ibwdxpjpeyhpljucihkd` responde. La conexión directa funciona, pero no es sostenible para serverless. Bloqueante del deploy.
- **RLS en el path de auth:** las 4 queries de la Fase 5.6 son el punto de falla más duro. Si se activa RLS sin arreglarlas, la app devuelve 401 en todas las requests.
- **Spike JWT (Fase 7):** si Supabase exige claves asimétricas, cambia el diseño de auth.
- **Transacción por request:** commit después de la respuesta, conexiones retenidas durante uploads, y el fan-out de `Informes`. Los tres están detallados en la Fase 5.8.
- **Pooler en modo transacción:** cualquier `set_config` a nivel de sesión rompe el aislamiento.
- **Impresión:** agente saliente + cola es el ítem más subestimado.
- **SIFEN:** decisión válida hoy, pero con fecha de revisión.
- **Auditoría de services:** los 16 services deben cubrirse con tests, no con búsquedas de texto.

## 6. Pendientes de esta etapa (Fases 5, 8, 9 y 11-código)

Lo que ya quedó hecho y verificado: RLS real (Fase 5), Realtime con Supabase (Fase 8),
Storage + contrato API + limpieza SIFEN (Fase 9) y la parte de código del deploy
(Fase 11: `createApp`, `/api/health`, entrypoints y `vercel.json`). El E2E completo
pasa con el rol `karuapp_app` y RLS activa, y el aislamiento cross-tenant está probado.

Queda pendiente, en orden de prioridad:

1. **Env de producción en Vercel (bloqueante para desplegar).**
   - Backend: `DATABASE_URL` con el rol `karuapp_app` (Session pooler, 5432),
     `DIRECT_DATABASE_URL` para migraciones, `JWT_SECRET`, `SUPABASE_URL`,
     `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWT_SECRET`,
     `CORS_ORIGINS`, `FRONTEND_URL`, `SMTP_*`, `PRINT_*`.
   - Frontend: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
   - Definir la password de los roles en el proyecto de producción
     (`ALTER ROLE karuapp_app LOGIN PASSWORD '...'`); la migración los crea NOLOGIN.
   - Correr `npm run db:migrate` como paso de release antes de levantar la app.

2. **Realtime, toggles manuales en Supabase.**
   - Activar "Private channels only".
   - Aplicar `supabase/realtime_policies.sql`.
   - Cargar `SUPABASE_JWT_SECRET` en el backend (hoy falta en `.env`).

3. **Validar el deploy real en Vercel.**
   - Cold start de Nest (medir contra `maxDuration: 60`).
   - Rate limit in-memory: solo sirve con una instancia (Fase 11.4).
   - Probar login por PIN/SaaS y Realtime end-to-end en producción.

4. **Roles de base de datos.**
   - `karuapp_migrate` está creado como NOLOGIN/BYPASSRLS pero las migraciones
     siguen corriendo como `postgres` (dueño de las tablas: sólo él puede hacer DDL).
     Si se quiere migrar con `karuapp_migrate`, hay que transferir la propiedad de
     las tablas o agregar el rol, y definir su password.

5. **Restos de la Fase 4 (no bloqueantes).**
   - Quitar `extraerSlug()` de `rls-context.interceptor.ts` (bajo RLS ya no resuelve
     nada y los endpoints públicos usan `runBypassRls`).
   - Quitar el `?restaurante=` del frontend (`utils/api.js`) si sigue presente.

6. **Lint del frontend.**
   - `npm run lint` está roto: falta la config de ESLint (`eslint.config.js`).
     Al agregarla pueden aparecer avisos pre-existentes.

7. **Deuda operativa previa (sigue abierta).**
   - Rotar la contraseña de DB y la `service_role` key expuestas.
   - Borrar el proyecto Supabase viejo `sbgmmrsmqdcxzecdmrww`.

8. **Fases todavía no encaradas:** Fase 10 (impresión con agente saliente) y
   Fase 12 (tests por service / auditoría con tests).
