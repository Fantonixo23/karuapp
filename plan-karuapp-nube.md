# Plan de implementación: KaruApp 100% en la nube

Repositorio de trabajo: `karuapp-nube`
Rama sugerida: `feature/multi-tenant-cloud`

## Arquitectura objetivo

| Componente | Hoy (nativo) | Destino |
|---|---|---|
| Base de datos | SQLite local (`datos.db`) | Postgres en Supabase |
| Media/imágenes | Disco local (`backend/media`) | Supabase Storage |
| Backend (Django + Socket.IO) | `socket_server.py` en la PC del local | VPS + Coolify (o Render pago), 24/7 |
| Frontend (React) | Servido por Django/whitenoise | Vercel, con subdominio por cliente |
| Impresión | `print_service` local, backend llama a `localhost:5123` | Agente local que conecta *hacia afuera* al backend |
| Datos de cada restaurante | Todo en una sola instancia, sin separación | Modelo `Restaurante` (tenant) + `restaurante_id` en cada tabla |
| Login personal | PIN único global | PIN por restaurante (mozo/cajero/cocina) + email/contraseña (admin) |

Cada fase de abajo es independiente y se puede mergear a `main` por separado. El orden importa: las fases 1-3 son de código (no dependen de infraestructura nueva) y conviene hacerlas y probarlas localmente antes de tocar hosting.

---

## Fase 1 — Modelo de datos multi-tenant

**Objetivo:** que la base de datos pueda contener varios restaurantes sin que se mezclen los datos.

**Archivos a crear:**
- `backend/apps/tenants/models.py` → modelo `Restaurante`
- `backend/apps/tenants/migrations/`

**Archivos a modificar (agregar `restaurante = models.ForeignKey('tenants.Restaurante', on_delete=models.CASCADE)`):**
- `apps/usuarios/models.py` → `Usuario`
- `apps/productos/models.py` → `Categoria`, `Producto`
- `apps/mesas/models.py` → `Mesa`
- `apps/pedidos/models.py` → `Pedido`, `Impresion`
- `apps/facturacion/models.py` → `Configuracion`, `Timbrado`, `Factura`, `MetodoPago`
- `apps/inventario/models.py` → `Inventario`, `MovimientoInventario`
- `apps/caja/models.py` → `CajaSession`, `MovimientoCaja`, `CorteCaja`

**Pasos:**
1. Crear la app `tenants` con el modelo `Restaurante` (nombre, slug, activo, plan, fecha de alta).
2. Agregar el FK `restaurante` a cada modelo de la lista de arriba.
3. Corregir constraints que hoy son únicos globales pero deben ser por-tenant: el caso más importante es `Usuario.pin`, que pasa de `unique=True` a `unique_together = ('restaurante', 'pin')`.
4. Generar y correr migraciones (`python manage.py makemigrations`, `migrate`).
5. Para los datos existentes de un solo restaurante: crear un `Restaurante` "por defecto" y asignar ese `restaurante_id` a todas las filas ya existentes con una migración de datos (`RunPython`).

**Listo cuando:** podés crear dos restaurantes de prueba en la base y confirmar que un `Producto` de uno no aparece al consultar productos del otro.

**Estimado:** 3-5 días.

---

## Fase 2 — Autenticación (PIN operativo + email para administración)

**Objetivo:** el personal (mozo, cajero, cocina) entra por PIN scopeado a su restaurante; el dueño/administrador entra por email + contraseña y gestiona a su propio personal.

**Archivos a modificar/crear:**
- `apps/usuarios/models.py` → agregar `email`, `password_hash` opcionales en `Usuario`
- `apps/usuarios/views.py` (o nuevo `apps/usuarios/auth_views.py`) → dos endpoints de login
- `pipperfood/settings.py` → agregar `djangorestframework-simplejwt` a `INSTALLED_APPS` y configurar `REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`

**Pasos:**
1. Instalar `djangorestframework-simplejwt`.
2. Endpoint `POST /api/auth/pin/` → recibe `slug_restaurante` + `pin`, devuelve JWT con claim `restaurante_id` y `rol`.
3. Endpoint `POST /api/auth/admin/` → recibe `email` + `password`, mismo tipo de JWT.
4. Middleware o permission class que, en cada request, valide que el `restaurante_id` del JWT coincide con el `restaurante` resuelto por subdominio (ver Fase 3).
5. Vista simple en el panel de administrador para crear/editar/desactivar usuarios de su propio restaurante (rol admin únicamente).

**Listo cuando:** un mozo no puede loguearse con el PIN de otro restaurante aunque coincida el número, y el admin puede crear un mozo nuevo desde su panel sin que vos intervengas.

**Estimado:** 4-6 días.

---

## Fase 3 — Middleware de tenant + tiempo real por restaurante

**Objetivo:** cada request y cada evento de Socket.IO sabe a qué restaurante pertenece.

**Archivos a modificar:**
- `pipperfood/middleware.py` (nuevo) → `TenantMiddleware`
- `pipperfood/settings.py` → agregarlo a `MIDDLEWARE`
- `pipperfood/socket_events.py` → todas las funciones `emit_*`
- `socket_server.py` → manejo de `connect`/`join_room`

**Pasos:**
1. `TenantMiddleware` resuelve `request.restaurante` a partir del subdominio (`pizzeria-juan.karuapp.com` → slug `pizzeria-juan`).
2. Todas las `ViewSet` filtran sus querysets por `self.request.restaurante` en vez de traer todo.
3. En `socket_server.py`, cuando un cliente se conecta, lo unís a una "room" de Socket.IO con el slug de su restaurante (`sio.enter_room(sid, restaurante_slug)`).
4. En `socket_events.py`, cada `emit_mesa_update`, `emit_nuevo_pedido_cocina`, `emit_cobro`, etc. emite con `room=restaurante_slug` en vez de broadcast global.

**Listo cuando:** abrís dos pestañas con dos restaurantes distintos y un pedido nuevo en uno no aparece como notificación en el otro.

**Estimado:** 3-4 días.

---

## Fase 4 — Migrar la base de datos a Supabase (Postgres)

**Objetivo:** dejar de depender de SQLite local.

**Archivos a modificar:**
- `config.env` (nunca `config.env.example`, ese queda como plantilla)

**Pasos:**
1. Crear proyecto en Supabase.
2. Configurar `config.env` con `DB_ENGINE=django.db.backends.postgresql` y los datos de conexión del **pooler** (puerto 6543, modo transaction) — no la conexión directa, para no agotar conexiones con muchos requests concurrentes.
3. Correr `python manage.py migrate` contra Supabase.
4. Migrar los datos actuales: `python manage.py dumpdata` desde SQLite → `python manage.py loaddata` contra Supabase (o `pgloader` si el volumen es grande).
5. Probar que la app corre igual apuntando a Supabase en vez de SQLite.

**Listo cuando:** la app funciona en local (`iniciar.bat`) pero contra la base en Supabase, sin errores de conexión.

**Estimado:** 2-3 días.

---

## Fase 5 — Storage de archivos a Supabase Storage

**Objetivo:** que las imágenes de productos/logos no dependan del disco de una PC.

**Archivos a modificar:**
- `pipperfood/settings.py` → `DEFAULT_FILE_STORAGE`, credenciales del bucket
- `backend/requirements.txt` → agregar `django-storages`, `boto3`

**Pasos:**
1. Crear un bucket en Supabase Storage.
2. Instalar y configurar `django-storages` apuntando al endpoint S3-compatible de Supabase.
3. Migrar las imágenes ya existentes en `backend/media` al bucket con un script único.
4. Confirmar que `MEDIA_URL` en el frontend sigue funcionando (ya usa `getMediaUrl()` dinámico en `api.js`, no debería requerir cambios ahí).

**Listo cuando:** subís una foto de producto nueva desde la app y aparece servida desde el bucket, no desde disco local.

**Estimado:** 1-2 días.

---

## Fase 6 — Backend en Ubuntu Server (laptop) + Supabase + Vercel

**Objetivo:** que tu laptop con Ubuntu Server 24.04 haga solo el trabajo de "puente" (Django + Socket.IO), con los datos en Supabase (ya migrado, Fases 4-5) y el frontend en Vercel — sin depender de que la laptop sirva la base de datos ni los archivos estáticos.

Esto es una versión "gratis con lo que ya tenés" — más adelante, cuando factures en serio, esto mismo se migra a Oracle/Koyeb/VPS sin rehacer nada, porque el código y los datos ya están separados de la máquina que los ejecuta.

### Parte 1 — Preparar la laptop para que se comporte como servidor de verdad

```bash
# Evitar que se suspenda al cerrar la tapa
sudo nano /etc/systemd/logind.conf
# Buscar y descomentar/editar:
# HandleLidSwitch=ignore
# HandleLidSwitchExternalPower=ignore
sudo systemctl restart systemd-logind

# Desactivar suspensión automática por inactividad
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

La laptop debe estar siempre conectada a la corriente (no a batería) — es la causa más común de caídas.

**Listo cuando:** dejás la laptop un buen rato sin tocarla y sigue respondiendo a ping o SSH sin haberse dormido.

### Parte 2 — Instalar lo necesario para correr el backend

```bash
sudo apt update
sudo apt install -y python3-pip python3-venv git

git clone https://github.com/Fantonixo23/karuapp.git
cd karuapp/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Configurar `config.env` con los datos reales de Supabase (los mismos que ya usás):

```
SECRET_KEY=...
DEBUG=False
DB_ENGINE=django.db.backends.postgresql
DB_HOST=db.sbgmmrsmqdcxzecdmrww.supabase.co
DB_PORT=6543
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=...
USE_SUPABASE_STORAGE=True
SUPABASE_S3_ACCESS_KEY=...
SUPABASE_S3_SECRET_KEY=...
SUPABASE_S3_ENDPOINT_URL=...
SUPABASE_S3_BUCKET=karuapp-media
```

```bash
python manage.py migrate --check
```

**Listo cuando:** el comando de arriba no tira error de conexión a la base.

### Parte 3 — Servicio systemd (arranque automático + autoreinicio)

```bash
sudo nano /etc/systemd/system/karuapp-backend.service
```

Contenido (ajustar rutas y usuario):

```ini
[Unit]
Description=KaruApp Backend (Django + Socket.IO)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=TU_USUARIO
WorkingDirectory=/home/TU_USUARIO/karuapp/backend
EnvironmentFile=/home/TU_USUARIO/karuapp/backend/config.env
ExecStart=/home/TU_USUARIO/karuapp/backend/venv/bin/python socket_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable karuapp-backend
sudo systemctl start karuapp-backend
sudo systemctl status karuapp-backend
```

**Listo cuando:** `systemctl status` muestra `active (running)`, y si matás el proceso (`sudo pkill -f socket_server.py`) se reinicia solo.

### Parte 4 — Exponer el backend a internet (Cloudflare Tunnel)

Tu laptop está detrás del router de tu casa sin IP pública fija — usamos Cloudflare Tunnel (gratis, sin tarjeta).

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
```

(Esto abre un link para autorizar con tu cuenta de Cloudflare — necesitás un dominio agregado a Cloudflare.)

```bash
cloudflared tunnel create karuapp-backend
cloudflared tunnel route dns karuapp-backend api.tudominio.com

sudo nano /etc/cloudflared/config.yml
```

```yaml
tunnel: karuapp-backend
credentials-file: /home/TU_USUARIO/.cloudflared/<ID_DEL_TUNEL>.json

ingress:
  - hostname: api.tudominio.com
    service: http://localhost:8000
  - service: http_status:404
```

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

**Listo cuando:** desde el celular con datos móviles (no tu wifi de casa), entrás a `https://api.tudominio.com` y el backend responde.

### Parte 5 — Ajustes en Django para aceptar el dominio del túnel

En `settings.py`:

```python
ALLOWED_HOSTS = ['api.tudominio.com', 'localhost']
CORS_ALLOWED_ORIGINS = ['https://tudominio.com', 'https://tu-proyecto.vercel.app']
```

---

## Fase 7 — Frontend en Vercel

**Objetivo:** servir el frontend React desde Vercel, apuntando al backend en tu laptop vía Cloudflare Tunnel.

**Pasos:**
1. Conectar el repo `karuapp` a Vercel, apuntando a la carpeta `frontend-react/`.
2. Vercel detecta que es un proyecto Vite/React y arma el build solo.
3. Confirmar que `api.js` usa la URL completa de `api.tudominio.com` (agregar `VITE_API_URL=https://api.tudominio.com` en Vercel si es necesario).
4. Probar que el frontend en Vercel carga datos reales desde tu laptop en casa, sin errores de CORS.

**Listo cuando:** el frontend en Vercel carga datos reales desde tu laptop en casa, sin errores.

### Tests específicos de este armado

- [ ] Reiniciar la laptop entera y confirmar que backend + túnel arrancan solos.
- [ ] Cerrar la tapa de la laptop y confirmar que no se suspende.
- [ ] Simular caída del proceso (`sudo pkill -f socket_server.py`) y confirmar que systemd lo levanta solo.
- [ ] Cortar el Wi-Fi/cable y reconectar, confirmar que cloudflared reconecta solo.
- [ ] Probar flujo completo (mozo → cocina → cobro) contra la URL pública.
- [ ] Crear 2-3 pedidos simultáneos desde distintos dispositivos.

### Recordatorio de límites

Esto sigue siendo **"gratis pero frágil"**: si se corta la luz en tu casa, o el ISP tiene un corte, el sistema se cae para todos los restaurantes. Es un buen punto de partida para pilotos, no el destino final — ahí migrás el mismo código (sin cambios, gracias al Dockerfile) a Oracle, Koyeb, o un VPS pago.

---

## Fase 8 — Agente de impresión saliente

**Objetivo:** que la impresora térmica del local siga funcionando aunque el backend esté en la nube.

**Archivos a modificar:**
- `backend/print_service/print_server.py`
- Donde se dispara la impresión en `apps/pedidos` / `apps/caja`

**Pasos:**
1. Cambiar `print_server.py` para que abra una conexión saliente (websocket) hacia el backend en la nube, en vez de esperar llamadas entrantes en `localhost:5123`.
2. El backend, en vez de llamar directo a la IP local del restaurante, encola el trabajo de impresión y lo envía por esa conexión cuando el agente esté conectado.
3. Probar con la impresora física de un local piloto.

**Listo cuando:** un pedido cobrado desde el backend en la nube imprime correctamente en la impresora física del local.

**Estimado:** 3-4 días.

---

## Fase 9 — Panel super-admin

**Objetivo:** que vos puedas ver/gestionar todos los restaurantes clientes desde un solo lugar.

**Pasos:**
1. Rol especial `SUPERADMIN` en `Usuario`, sin scope de `restaurante` (o con acceso a todos).
2. Vista (Django admin personalizado o pantalla React aparte) para listar restaurantes, activar/desactivar, ver métricas básicas de uso.

**Listo cuando:** podés loguearte como super-admin y ver la lista completa de restaurantes activos.

**Estimado:** 3-4 días.

---

## Fase 10 — CI/CD y entorno de staging

**Objetivo:** probar cambios antes de que lleguen a los restaurantes reales.

**Pasos:**
1. Rama `staging` con su propio backend (otro proyecto en Coolify) y su propio proyecto de Supabase.
2. Deploy automático: `main` → producción, `staging` → entorno de pruebas.

**Estimado:** 1-2 días.

---

## Fase 11 — Backups y monitoreo

**Pasos:**
1. Backups automáticos de Supabase (diarios en plan Pro; cron propio con `pg_dump` si seguís en free tier).
2. Monitoreo de uptime del backend (UptimeRobot, gratis) con alerta a tu teléfono/email.
3. Logs centralizados del backend (aunque sea simple, como enviar `backend/logs` a un servicio gratuito de logs).

**Estimado:** 1-2 días.

---

## Fase 12 — Migración de datos existentes y piloto

**Pasos:**
1. Elegir 1-2 restaurantes piloto (idealmente el/los que ya usan la versión nativa).
2. Migrar sus datos reales a la nube usando el proceso de la Fase 4.
3. Correr en paralelo (nativo + nube) unos días antes de cortar el nativo.
4. Recién con el piloto estable, abrir el onboarding al resto de los restaurantes.

**Estimado:** 1-2 semanas de acompañamiento.

---

## Orden recomendado y checklist rápido

- [ ] Fase 1 — Modelo `Restaurante` + FK en todos los modelos
- [ ] Fase 2 — Login PIN (personal) + email (admin)
- [ ] Fase 3 — Middleware de tenant + Socket.IO por rooms
- [ ] Fase 4 — Base de datos en Supabase
- [ ] Fase 5 — Storage en Supabase
- [ ] Fase 6 — Backend en Ubuntu Server + Supabase + Vercel
  - [ ] Parte 1: laptop no se suspende
  - [ ] Parte 2: dependencias instaladas, migrate --check OK
  - [ ] Parte 3: servicio systemd activo y autoreinicio
  - [ ] Parte 4: Cloudflare Tunnel funcionando
  - [ ] Parte 5: CORS/ALLOWED_HOSTS configurados
- [ ] Fase 7 — Frontend en Vercel (conecta al backend vía túnel)
- [ ] Fase 8 — Agente de impresión saliente
- [ ] Fase 9 — Panel super-admin
- [ ] Fase 10 — Staging y CI/CD
- [ ] Fase 11 — Backups y monitoreo
- [ ] Fase 12 — Migración de datos y piloto

Las fases 1 a 3 se pueden desarrollar y probar completamente en tu PC, sin gastar nada ni tocar infraestructura. Recién en la fase 4 empieza a intervenir Supabase.
