"""
Multi-tenant Socket.IO Isolation Test
=======================================
Simula 2+ clientes conectados a distintos restaurantes y verifica que los
eventos en tiempo real no se filtren entre tenants.

Requisitos:
  - Servidor Django + Socket.IO corriendo en http://127.0.0.1:8000
  - python-socketio (cliente) instalado
  - Dos restaurantes creados en BD: slugs "pizzeria-juan" y "pizzeria-ana"
    (si no existen, el test los crea via API)
  - Al menos un producto y una mesa en cada restaurante

Uso:
  python test_mt_socket_isolation.py
"""

import os, sys, json, time, logging, asyncio
from urllib.parse import urlencode

logging.basicConfig(level=logging.WARNING, format='%(asctime)s [%(levelname)s] %(message)s')

import socketio
import requests

BASE = 'http://127.0.0.1:8000/api'
SIO_URL = 'http://127.0.0.1:8000'

OK = 0
FAIL = 0
_errors = []

def test(name, ok, detail=''):
    global OK, FAIL
    if ok:
        OK += 1
        print(f'  PASS [{OK}] {name}')
    else:
        FAIL += 1
        _errors.append((name, detail))
        print(f'  FAIL [{FAIL}] {name} - {detail}')

def create_restaurante(slug, nombre):
    """Crea un restaurante via API si no existe."""
    r = requests.get(f'{BASE}/auth/pin', json={'slug_restaurante': slug, 'pin': '0000'}, timeout=5)
    if r.status_code == 200:
        return slug
    # Crear restaurante via DB direct (o asume existe)
    # Try to use tenants endpoint if available
    from apps.tenants.models import Restaurante
    import django
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pipperfood.settings')
    django.setup()
    rest, created = Restaurante.objects.get_or_create(slug=slug, defaults={'nombre': nombre, 'activo': True})
    return slug

def login(slug, pin='0000'):
    r = requests.post(f'{BASE}/auth/pin', json={'slug_restaurante': slug, 'pin': pin}, timeout=10)
    if r.status_code == 200:
        return r.json().get('token')
    r = requests.post(f'{BASE}/auth/register', json={
        'slug_restaurante': slug, 'nombre': 'Test Admin', 'pin': pin, 'rol': 'administrador'
    }, timeout=10)
    if r.status_code == 200:
        r = requests.post(f'{BASE}/auth/pin', json={'slug_restaurante': slug, 'pin': pin}, timeout=10)
        return r.json().get('token') if r.status_code == 200 else None
    return None

def seed_rest(slug, token):
    """Crea producto + mesa si el restaurante está vacío."""
    h = {'Authorization': f'Bearer {token}'}
    r = requests.get(f'{BASE}/productos?restaurante={slug}', headers=h, timeout=5)
    if r.status_code == 200 and (r.json().get('data') or r.json().get('productos') or []):
        prod = (r.json().get('data') or r.json().get('productos'))[0]
    else:
        r2 = requests.post(f'{BASE}/productos/crear?restaurante={slug}', json={
            'nombre': 'Pizza Test', 'precio': 30000, 'categoria_nombre': 'Test', 'disponible': True
        }, headers=h, timeout=5)
        prod = (r2.json().get('data') or r2.json().get('producto') or {}) if r2.status_code == 200 else {}
    r = requests.get(f'{BASE}/mesas?restaurante={slug}', headers=h, timeout=5)
    if r.status_code == 200 and (r.json().get('data') or r.json().get('mesas') or []):
        mesa = (r.json().get('data') or r.json().get('mesas'))[0]
    else:
        r2 = requests.post(f'{BASE}/mesas/crear?restaurante={slug}', json={'numero': 1, 'capacidad': 4}, headers=h, timeout=5)
        mesa = (r2.json().get('data') or r2.json().get('mesa') or {}) if r2.status_code == 200 else {}
    return prod, mesa

def _req(token, method, path, **kw):
    h = kw.pop('headers', {})
    if token:
        h['Authorization'] = f'Bearer {token}'
    kw.setdefault('timeout', 10)
    return requests.request(method, f'{BASE}{path}', headers=h, **kw)


class EventCollector:
    """Captura eventos socket.io en una lista."""

    def __init__(self, slug, client_id):
        self.slug = slug
        self.client_id = client_id
        self.events = []
        self.connected = False

    def on_connect(self):
        self.connected = True
        self.events.append(('connected', None))

    def on_disconnect(self):
        self.connected = False
        self.events.append(('disconnected', None))

    def handler_factory(self, event_name):
        def handler(data):
            self.events.append((event_name, data))
        return handler


async def run_isolation_test():
    print('=' * 60)
    print('Multi-tenant Socket.IO Isolation Test')
    print('=' * 60)

    # ── Setup restaurantes ──
    SLUG_A = 'pizzeria-juan'
    SLUG_B = 'pizzeria-ana'

    print('\n[SETUP] Restaurantes + login')
    token_a = login(SLUG_A)
    test(f'Login {SLUG_A}', bool(token_a))
    token_b = login(SLUG_B)
    test(f'Login {SLUG_B}', bool(token_b))

    if not token_a or not token_b:
        print('  SKIP: No se pudieron autenticar ambos restaurantes')
        return

    prod_a, mesa_a = seed_rest(SLUG_A, token_a)
    prod_b, mesa_b = seed_rest(SLUG_B, token_b)
    test(f'Seed {SLUG_A}: prod={prod_a.get("id")} mesa={mesa_a.get("id")}', bool(prod_a and mesa_a))
    test(f'Seed {SLUG_B}: prod={prod_b.get("id")} mesa={mesa_b.get("id")}', bool(prod_b and mesa_b))

    A_ID = prod_a.get('id') if prod_a else None
    A_MESA_ID = mesa_a.get('id') if mesa_a else None
    B_ID = prod_b.get('id') if prod_b else None
    B_MESA_ID = mesa_b.get('id') if mesa_b else None

    if not all([A_ID, A_MESA_ID, B_ID, B_MESA_ID]):
        print('  SKIP: Seed incompleto')
        return

    # Seed inventario
    for slug, token, pid in [(SLUG_A, token_a, A_ID), (SLUG_B, token_b, B_ID)]:
        _req(token, 'POST', f'/inventario/movimiento?restaurante={slug}', json={
            'producto_id': pid, 'tipo': 'entrada', 'cantidad': 100,
            'motivo': 'compra', 'notas': 'Stock test'
        })

    # ── Conectar clientes Socket.IO ──
    print('\n[TEST 1] Conexión y aislamiento de eventos')

    col_a = EventCollector(SLUG_A, 'CLIENTE-A')
    col_b = EventCollector(SLUG_B, 'CLIENTE-B')

    sio_a = socketio.AsyncClient(logger=False)
    sio_b = socketio.AsyncClient(logger=False)

    sio_a.on('connect', col_a.on_connect)
    sio_a.on('disconnect', col_a.on_disconnect)
    sio_b.on('connect', col_b.on_connect)
    sio_b.on('disconnect', col_b.on_disconnect)

    # Registrar handlers para todos los eventos emitidos por el backend
    for ev in ['mesa_update', 'pedido_update', 'nuevo_pedido_cocina',
               'pedido_modificado', 'cobro']:
        sio_a.on(ev, col_a.handler_factory(ev))
        sio_b.on(ev, col_b.handler_factory(ev))

    query_a = urlencode({'restaurante': SLUG_A})
    query_b = urlencode({'restaurante': SLUG_B})

    try:
        await sio_a.connect(f'{SIO_URL}?{query_a}', socketio_path='socket.io',
                            transports=['polling'], auth={},
                            headers={'Origin': 'http://localhost'})
    except Exception as e:
        test(f'Conectar Cliente-A a {SLUG_A}', False, str(e))

    try:
        await sio_b.connect(f'{SIO_URL}?{query_b}', socketio_path='socket.io',
                            transports=['polling'], auth={},
                            headers={'Origin': 'http://localhost'})
    except Exception as e:
        test(f'Conectar Cliente-B a {SLUG_B}', False, str(e))

    await asyncio.sleep(0.5)

    test(f'Cliente-A conectado a {SLUG_A}', col_a.connected)
    test(f'Cliente-B conectado a {SLUG_B}', col_b.connected)

    if not col_a.connected or not col_b.connected:
        print('  SKIP: No se pudieron conectar los clientes Socket.IO')
        # Cleanup
        if sio_a.connected: await sio_a.disconnect()
        if sio_b.connected: await sio_b.disconnect()
        return

    # ── Test: crear pedido en A -> solo A recibe nuevo_pedido_cocina ──
    print('\n[TEST 2] Pedido nuevo en A -> solo Cliente-A recibe evento')
    col_a.events.clear()
    col_b.events.clear()

    r = _req(token_a, 'POST', f'/pedidos/crear?restaurante={SLUG_A}', json={
        'mesa_id': A_MESA_ID,
        'items': [{'producto_id': A_ID, 'cantidad': 1, 'precio': 30000}],
        'notas': 'Test MT'
    })
    pid_a = r.json().get('pedido', {}).get('id') if r.status_code == 200 else None
    test(f'Crear pedido en {SLUG_A}', bool(pid_a), r.text[:100] if r.status_code != 200 else '')

    await asyncio.sleep(0.5)

    events_a = [e for e in col_a.events if e[0] != 'connected']
    events_b = [e for e in col_b.events if e[0] != 'connected']
    test(f'Cliente-A recibió evento nuevo_pedido_cocina',
         any('nuevo_pedido_cocina' in str(e) for e in events_a),
         f'events: {events_a}')
    test(f'Cliente-B NO recibió evento de A',
         not any('nuevo_pedido_cocina' in str(e) for e in events_b),
         f'events: {events_b}')

    # Test: cambiar estado de mesa en B -> solo B recibe mesa_update
    print('\n[TEST 3] Ocupar mesa en B -> solo Cliente-B recibe mesa_update')
    col_a.events.clear()
    col_b.events.clear()

    r = _req(token_b, 'POST', f'/mesas/abrir?restaurante={SLUG_B}',
             json={'mesa_id': B_MESA_ID, 'comensales': 2})
    test(f'Abrir mesa en {SLUG_B}', r.status_code == 200, r.text[:100])

    await asyncio.sleep(0.5)

    events_b = [e for e in col_b.events if e[0] != 'connected']
    events_a = [e for e in col_a.events if e[0] != 'connected']
    test(f'Cliente-B recibió mesa_update',
         any('mesa_update' in str(e) for e in events_b),
         f'events: {events_b}')
    test(f'Cliente-A NO recibió mesa_update de B',
         not any('mesa_update' in str(e) for e in events_a),
         f'events: {events_a}')

    # ── Test: cobrar mesa en A -> solo A recibe cobro ──
    print('\n[TEST 4] Cobrar mesa en A -> solo Cliente-A recibe cobro')
    col_a.events.clear()
    col_b.events.clear()

    if pid_a:
        # Pasar pedido por estados hasta entregado
        for st in ['cocinando', 'listo', 'entregado']:
            _req(token_a, 'POST', f'/pedidos/{pid_a}/estado?restaurante={SLUG_A}',
                 json={'estado': st})

        # Abrir caja en A
        _req(token_a, 'POST', f'/caja/apertura?restaurante={SLUG_A}',
             json={'fondo_inicial': 500000})

        r = _req(token_a, 'POST', f'/pedidos/{pid_a}/pagar?restaurante={SLUG_A}', json={
            'metodo_pago': 'efectivo', 'propina': 0, 'monto_recibido': 50000
        })
        test(f'Pagar pedido en {SLUG_A}', r.status_code == 200, r.text[:100])

        # Cerrar caja
        _req(token_a, 'POST', f'/caja/cierre?restaurante={SLUG_A}', json={
            'denominaciones': [{'valor': 50000, 'cantidad': 1}],
            'observaciones': 'Cierre test MT'
        })

    await asyncio.sleep(0.5)

    events_a = [e for e in col_a.events if e[0] != 'connected']
    events_b = [e for e in col_b.events if e[0] != 'connected']
    test(f'Cliente-A recibió evento de cobro/pedido_update',
         len(events_a) > 0, f'events: {events_a}')
    test(f'Cliente-B NO recibió eventos de A (aislamiento)',
         len(events_b) == 0, f'events leaked: {events_b}')

    # ── Test: verificar logs ──
    print('\n[TEST 5] Verificación de logs del servidor')
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    room_lines = []
    for fname in ['django.log', 'uvicorn.log']:
        fpath = os.path.join(log_dir, fname)
        if os.path.exists(fpath):
            with open(fpath, 'r', encoding='utf-8') as f:
                room_lines.extend([l for l in f.read().split('\n') if 'unido a sala' in l])
    test(f'Logs muestran clientes unidos a salas',
         len(room_lines) >= 2, f'encontradas {len(room_lines)} líneas')

    # ── Test: 3-4 clientes simultáneos en el mismo restaurante ──
    print('\n[TEST 6] Múltiples clientes en el mismo restaurante')
    collectors = []
    clients = []
    for i in range(3):
        col = EventCollector(SLUG_A, f'CLIENTE-A-{i}')
        cl = socketio.AsyncClient(logger=False)
        cl.on('connect', col.on_connect)
        cl.on('disconnect', col.on_disconnect)
        for ev in ['mesa_update', 'pedido_update', 'nuevo_pedido_cocina', 'cobro']:
            cl.on(ev, col.handler_factory(ev))
        try:
            await cl.connect(f'{SIO_URL}?{urlencode({"restaurante": SLUG_A})}',
                             socketio_path='socket.io', transports=['polling'],
                             auth={}, headers={'Origin': 'http://localhost'})
        except Exception:
            pass
        collectors.append(col)
        clients.append(cl)

    await asyncio.sleep(0.5)
    all_connected = all(c.connected for c in collectors)
    test(f'Todos los clientes del mismo restaurante conectados ({sum(1 for c in collectors if c.connected)}/3)',
         all_connected)

    # Crear otro pedido en A y ver que todos los clientes A lo reciben
    for c in collectors:
        c.events.clear()

    r = _req(token_a, 'POST', f'/pedidos/crear?restaurante={SLUG_A}', json={
        'mesa_id': A_MESA_ID,
        'items': [{'producto_id': A_ID, 'cantidad': 1, 'precio': 30000}],
        'notas': 'Test multi-cliente'
    })
    pid_a2 = r.json().get('pedido', {}).get('id') if r.status_code == 200 else None
    test(f'Crear pedido en {SLUG_A} (test multi-cliente)', bool(pid_a2))

    await asyncio.sleep(0.5)

    todos_recibieron = all(
        any('nuevo_pedido_cocina' in str(e) for e in c.events)
        for c in collectors
    )
    test(f'Todos los clientes de {SLUG_A} recibieron el evento',
         todos_recibieron,
         f'recepciones: {[sum(1 for e in c.events if "nuevo_pedido_cocina" in str(e)) for c in collectors]}')

    # ── Limpiar cliente B ──
    for cl in clients:
        if cl.connected:
            await cl.disconnect()
    if sio_a.connected:
        await sio_a.disconnect()
    if sio_b.connected:
        await sio_b.disconnect()

    print(f'\n{"=" * 60}')
    print(f'TEST SUMMARY: {OK} passed, {FAIL} failed')
    print(f'{"=" * 60}')
    if FAIL:
        print('\nFailures:')
        for name, detail in _errors:
            print(f'  - {name}: {detail}')
    return FAIL


if __name__ == '__main__':
    # Configurar Django para acceder a modelos en create_restaurante
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pipperfood.settings')
    sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

    exit_code = asyncio.run(run_isolation_test())
    sys.exit(exit_code or 0)
