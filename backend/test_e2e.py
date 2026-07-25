"""
karuAPP E2E Test - Mozo > Cocina > Admin > Caja
"""
import requests
import json
import sys
import time
import subprocess

BASE = 'http://127.0.0.1:8000/api'
OK = 0
FAIL = 0
TOKEN = None

def test(name, ok, detail=''):
    global OK, FAIL
    if ok:
        OK += 1
        print(f'  PASS [{OK}] {name}')
    else:
        FAIL += 1
        print(f'  FAIL [{FAIL}] {name} - {detail}')

_req_session = requests.Session()

def req(method, path, **kwargs):
    global _req_session
    url = f'{BASE}{path}'
    headers = kwargs.pop('headers', {})
    if TOKEN:
        headers['Authorization'] = f'Bearer {TOKEN}'
    kwargs.setdefault('timeout', 5)
    try:
        return _req_session.request(method, url, headers=headers, **kwargs)
    except Exception as e:
        print(f'  ~~REQ ERROR~~ {method} {path}: {type(e).__name__}: {e}')
        return None

import functools
print = functools.partial(print, flush=True)

# ── Cleanup pending pedidos from previous runs ──
try:
    s_cleanup = requests.Session()
    r = s_cleanup.post(f'{BASE}/auth/pin', json={'slug_restaurante': 'default', 'pin': '0000'}, timeout=10)
    if r.status_code == 200:
        admin_h = {'Authorization': f'Bearer {r.json().get("token")}'}
        r = s_cleanup.get(f'{BASE}/informes/pedidos-lista?estado=todos&limit=500&fecha_inicio=2000-01-01&fecha_fin=2100-01-01',
                          headers=admin_h, timeout=10)
        if r.status_code == 200:
            todos = r.json().get('data', {}).get('pedidos', [])
            pending = [p for p in todos if p.get('estado') not in ('pagado', 'cancelado')]
            for p in pending:
                s_cleanup.post(f'{BASE}/pedidos/{p["id"]}/cancelar',
                               json={'motivo': 'Cleanup E2E test'},
                               headers=admin_h, timeout=5)
            if pending:
                print(f'[CLEANUP] Canceled {len(pending)} pending pedidos previos')
    s_cleanup.close()
except Exception:
    pass

print('=' * 60)
print('karuAPP E2E Test Suite')
print('=' * 60)

# ── Login ──
print('\n[0] AUTH LOGIN')
r = req('POST', '/auth/pin', json={'slug_restaurante': 'default', 'pin': '0000'})
if r and r.status_code == 200 and r.json().get('success'):
    TOKEN = r.json().get('token')
    test('Login admin PIN 0000', bool(TOKEN))
else:
    test('Login admin PIN 0000', False, r.text[:100] if r else 'no response')
    r = req('POST', '/auth/pin', json={'slug_restaurante': 'default', 'pin': '1234'})
    if r and r.status_code == 200 and r.json().get('success'):
        TOKEN = r.json().get('token')
        test('Login PIN 1234', bool(TOKEN))
    else:
        test('Login - no valid PIN found', False, 'Try creating admin user')
        r = req('POST', '/auth/register', json={
            'slug_restaurante': 'default', 'nombre': 'Admin', 'pin': '1234', 'rol': 'administrador'
        })
        r = req('POST', '/auth/pin', json={'slug_restaurante': 'default', 'pin': '1234'})
        if r and r.status_code == 200:
            TOKEN = r.json().get('token')
        test('Register + Login admin', bool(TOKEN))
print(f'  Token: {TOKEN[:20] if TOKEN else "None"}...')

# ─────────────────────────────────────────────
# 1. MOZO (Waiter) Flow
# ─────────────────────────────────────────────
print('\n[1] MOZO FLOW')

r = req('GET', '/productos')
test('List productos', r and r.status_code == 200)
productos = []
if r and r.status_code == 200:
    data = r.json()
    productos = data.get('data') or data.get('productos') or []
    print(f'  Found {len(productos)} productos')

r = req('GET', '/mesas')
test('List mesas', r and r.status_code == 200)
mesas = []
if r and r.status_code == 200:
    data = r.json()
    mesas = data.get('data') or data.get('mesas') or []
    print(f'  Found {len(mesas)} mesas')

# Seed if empty
if not productos:
    print('  [SEED] Creating products...')
    for nombre, precio in [('Pizza Muzzarella', 35000), ('Hamburguesa', 25000), ('Coca Cola', 5000)]:
        r2 = req('POST', '/productos/crear', json={
            'nombre': nombre, 'precio': precio, 'categoria_nombre': 'Comidas', 'disponible': True
        })
        if r2 and r2.status_code == 200:
            data = r2.json()
            prod = data.get('data') or data.get('producto') or data
            productos.append(prod)
            print(f'    Created: {nombre} (id={prod.get("id")})')

if not mesas:
    print('  [SEED] Creating mesas...')
    for i in range(1, 4):
        r2 = req('POST', '/mesas/crear', json={'numero': i, 'capacidad': 4})
        if r2 and r2.status_code == 200:
            data = r2.json()
            mesa = data.get('data') or data.get('mesa') or data
            mesas.append(mesa)
            print(f'    Created Mesa {i}')

p_a = productos[0] if productos else None
p_b = productos[1] if len(productos) > 1 else None
p_c = productos[2] if len(productos) > 2 else None
m1 = mesas[0] if mesas else None

pedido_id = None

# Seed inventory for products
print('  [SEED] Creating inventory...')
for p in [p_a, p_b, p_c]:
    if p:
        req('POST', '/inventario/movimiento', json={
            'producto_id': p['id'], 'tipo': 'entrada', 'cantidad': 100,
            'motivo': 'compra', 'notas': 'Stock inicial E2E test'
        })

if p_a and m1:
    items = [{'producto_id': p_a['id'], 'cantidad': 2, 'precio': float(p_a.get('precio', 35000))}]
    if p_b:
        items.append({'producto_id': p_b['id'], 'cantidad': 1, 'precio': float(p_b.get('precio', 25000))})

    r = req('POST', '/pedidos/crear', json={'mesa_id': m1['id'], 'items': items, 'notas': 'Test E2E'})
    test('Crear pedido', r and r.status_code == 200)
    if r and r.status_code == 200:
        pedido_id = r.json().get('pedido', {}).get('id')
        test('Pedido ID', bool(pedido_id))

    if pedido_id and p_c:
        r = req('POST', f'/pedidos/{pedido_id}/items', json={
            'items': [{'producto_id': p_c['id'], 'cantidad': 3, 'precio': float(p_c.get('precio', 5000))}]
        })
        test('Agregar items', r and r.status_code == 200)

    if pedido_id and p_b:
        r = req('PUT', f'/pedidos/{pedido_id}/items/reemplazar', json={
            'items': [
                {'producto_id': p_b['id'], 'cantidad': 1, 'precio': float(p_b.get('precio', 25000))},
                {'producto_id': p_a['id'], 'cantidad': 1, 'precio': float(p_a.get('precio', 35000))}
            ]
        })
        ok = r and r.status_code == 200
        test('Reemplazar items', ok, r.json().get('error','') if r else 'no response')

    if pedido_id:
        r = req('DELETE', f'/pedidos/{pedido_id}/items/0')
        test('Eliminar item', r and r.status_code == 200)

    if pedido_id:
        r = req('POST', f'/pedidos/{pedido_id}/estado', json={'estado': 'cocinando'})
        test('Estado -> cocinando', r and r.status_code == 200)
else:
    test('Mozo: products/mesas', False, 'Seed failed')

# ─────────────────────────────────────────────
# 2. COCINA (Kitchen) Flow
# ─────────────────────────────────────────────
print('\n[2] COCINA FLOW')

if pedido_id:
    r = req('GET', '/cocina/pedidos/')
    test('List cocina', r and r.status_code == 200)

    r = req('POST', f'/pedidos/{pedido_id}/estado', json={'estado': 'listo'})
    test('Estado -> listo', r and r.status_code == 200)

    r = req('POST', f'/pedidos/{pedido_id}/estado', json={'estado': 'entregado'})
    test('Estado -> entregado', r and r.status_code == 200)
else:
    test('Cocina flow', False, 'No pedido_id')

# ─────────────────────────────────────────────
# 3. CAJA (Cashier) Flow
# ─────────────────────────────────────────────
print('\n[3] CAJA FLOW')

if pedido_id:
    # Use dedicated session for caja to avoid req() hanging
    caja_session = requests.Session()
    ch = {'Authorization': f'Bearer {TOKEN}'}

    r = caja_session.post(f'{BASE}/caja/apertura', json={'fondo_inicial': 500000}, headers=ch, timeout=10)
    if r.status_code == 400:
        test('Abrir caja (ya abierta)', True)
    else:
        ok = r.status_code == 200
        err = r.json().get('error', '') if ok else str(r.status_code)
        test('Abrir caja', ok, err)

    r = caja_session.get(f'{BASE}/caja/sesion-actual', headers=ch, timeout=10)
    test('Sesion actual', r.status_code == 200)

    r = caja_session.post(f'{BASE}/pedidos/{pedido_id}/pagar', json={
        'metodo_pago': 'efectivo', 'propina': 5000, 'monto_recibido': 100000,
    }, headers=ch, timeout=10)
    test('Pagar pedido', r.status_code == 200, r.json().get('error',''))

    if m1 and p_a:
        r2 = caja_session.post(f'{BASE}/pedidos/crear', json={
            'mesa_id': m1['id'],
            'items': [{'producto_id': p_a['id'], 'cantidad': 1, 'precio': float(p_a.get('precio', 35000))}]
        }, headers=ch, timeout=10)
        pid2 = r2.json().get('pedido', {}).get('id') if r2.status_code == 200 else None
        if pid2:
            caja_session.post(f'{BASE}/pedidos/{pid2}/estado', json={'estado': 'cocinando'}, headers=ch, timeout=10)
            caja_session.post(f'{BASE}/pedidos/{pid2}/estado', json={'estado': 'listo'}, headers=ch, timeout=10)
            caja_session.post(f'{BASE}/pedidos/{pid2}/estado', json={'estado': 'entregado'}, headers=ch, timeout=10)
            r = caja_session.post(f'{BASE}/pedidos/mesa/{m1["id"]}/cobrar', json={
                'metodo_pago': 'efectivo', 'propina': 0, 'monto_recibido': 50000,
            }, headers=ch, timeout=10)
            test('Cobrar mesa', r.status_code == 200, r.json().get('error',''))

    # Login como admin (PIN 0000) para cierre
    r = caja_session.post(f'{BASE}/auth/pin', json={'slug_restaurante': 'default', 'pin': '0000'}, timeout=10)
    if r.status_code == 200 and r.json().get('success'):
        ch['Authorization'] = f'Bearer {r.json().get("token")}'
        test('Login admin PIN 0000', True)
    else:
        test('Login admin PIN 0000', False, r.text[:80])

    # Cerrar caja (ya con token de admin)
    r = caja_session.post(f'{BASE}/caja/cierre', json={
        'denominaciones': [{'valor': 50000, 'cantidad': 2}, {'valor': 10000, 'cantidad': 5}],
        'observaciones': 'Cierre E2E test',
    }, headers=ch, timeout=10)
    test('Cerrar caja', r.status_code == 200, r.json().get('error',''))

    caja_session.close()
else:
    test('Caja flow', False, 'No pedido_id')

# ─────────────────────────────────────────────
# 4. VALIDATION TESTS
# ─────────────────────────────────────────────
print('\n[4] VALIDATION TESTS')

if p_a:
    r1 = req('POST', '/pedidos/crear', json={
        'items': [{'producto_id': p_a['id'], 'cantidad': 1, 'precio': float(p_a.get('precio', 35000))}],
        'tipo_pedido': 'venta',
    })
    cancel_pedido_id = r1.json().get('pedido', {}).get('id') if r1 and r1.status_code == 200 else None
    if cancel_pedido_id:
        # Test without motivo (empty body) - should fail with 400
        url = f'{BASE}/pedidos/{cancel_pedido_id}/cancelar'
        try:
            r = _req_session.post(url, json={}, headers={'Authorization': f'Bearer {TOKEN}'}, timeout=5)
        except Exception as exc:
            print(f'  [EXC] {type(exc).__name__}: {exc}')
            r = None
        test('Cancel sin motivo = 400', r is not None and r.status_code == 400,
             r.json().get('error','') if r else 'no response')
        
        r = req('POST', f'/pedidos/{cancel_pedido_id}/cancelar', json={'motivo': 'Cliente cancelo'})
        test('Cancel con motivo = 200', r and r.status_code == 200,
             r.json().get('error','') if r else 'no response')
    else:
        test('Cancel tests', False, f'No se pudo crear pedido ({r1.status_code if r1 else "no response"} > {r1.text[:200] if r1 else "N/A"})')
else:
    test('Cancel tests', False, 'No hay productos')

# ── Summary ──
print('\n' + '=' * 60)
print(f'TEST SUMMARY: {OK} passed, {FAIL} failed')
print('=' * 60)
sys.exit(1 if FAIL else 0)
