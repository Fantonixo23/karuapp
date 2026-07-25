"""
Simulación E2E completa — Mozo real
karuAPP — Flujo completo de atención al cliente
"""
import requests, json, time, sys
from datetime import datetime

BASE = 'http://localhost:8000/api'
s = requests.Session()

def req(method, path, **kw):
    url = f'{BASE}{path}'
    kw.setdefault('timeout', 30)
    try:
        r = s.request(method, url, **kw)
        return r
    except Exception as e:
        print(f'  [ERROR] {url}: {e}')
        return None

def auth(pin='1234'):
    r = req('POST', '/auth/login', json={'pin': pin})
    if r and r.status_code == 200 and r.json().get('success'):
        token = r.json().get('token')
        s.headers['Authorization'] = f'Bearer {token}'
        print(f'✅ Login exitoso (PIN {pin})')
        return True
    return False

def paso(msg):
    print(f'\n━━━ {msg} ━━━')

# ─── Login ───
paso('1. APERTURA DE CAJA')
if not auth():
    auth('0000')

# ─── Crear menú real ───
paso('2. CREANDO MENÚ DEL DÍA')

def crear_producto(nombre, precio, categoria, variantes=None):
    data = {'nombre': nombre, 'precio': precio, 'categoria_nombre': categoria, 'disponible': True}
    if variantes:
        data['variantes'] = variantes
    r = req('POST', '/productos/crear', json=data)
    if r and r.status_code == 200:
        pid = r.json().get('data', {}).get('id') or r.json().get('producto', {}).get('id')
        print(f'  ✅ {nombre} (${precio:,}) — id={pid}')
        return pid
    else:
        print(f'  ❌ {nombre}: {r.text[:100] if r else "no response"}')
        return None

# Ver si ya hay productos
r = req('GET', '/productos')
productos_existentes = r.json().get('productos', []) if r else []
if len(productos_existentes) >= 6:
    print(f'  (usando {len(productos_existentes)} productos existentes)')
    menu = {}
    for p in productos_existentes:
        name = p['nombre'].split(' ')[0] if ' ' in p['nombre'] else p['nombre']
        name = name.split('\u2014')[0].strip() if '\u2014' in name else name
        # Map common names to keys used below
        menu[p['nombre']] = {'id': p['id'], 'precio': int(float(p.get('precio', 0)))}
    # Also build alias dict for simpler key access
    alias = {}
    for fullname in menu:
        for kw in ['Empanada','Chipa','Pizza','Hamburguesa','Milanesa','Sopa','Coca','Pilsen','Tereré','Dulce','Flan']:
            if kw.lower() in fullname.lower():
                alias[kw] = menu[fullname]
                break
    menu.update(alias)
    print(f'  Keys: {list(menu.keys())[:15]}')
else:
    menu = {}
    # Entradas
    pid = crear_producto('Empanada de Carne', 7000, 'Entrada', [
        {'nombre': 'frita', 'precio_extra': 0},
        {'nombre': 'al horno', 'precio_extra': 0},
    ])
    if pid: menu['Empanada'] = {'id': pid, 'precio': 7000}

    pid = crear_producto('Chipa Guazu', 12000, 'Entrada')
    if pid: menu['Chipa Guazu'] = {'id': pid, 'precio': 12000}

    # Platos principales
    pid = crear_producto('Pizza Muzzarella', 45000, 'Comidas', [
        {'nombre': 'grande', 'precio_extra': 10000},
        {'nombre': 'chica', 'precio_extra': 0},
    ])
    if pid: menu['Pizza Muzzarella'] = {'id': pid, 'precio': 45000}

    pid = crear_producto('Hamburguesa Completa', 35000, 'Comidas')
    if pid: menu['Hamburguesa'] = {'id': pid, 'precio': 35000}

    pid = crear_producto('Milanesa con Puré', 25000, 'Comidas')
    if pid: menu['Milanesa'] = {'id': pid, 'precio': 25000}

    pid = crear_producto('Sopa Paraguaya', 18000, 'Comidas')
    if pid: menu['Sopa Paraguaya'] = {'id': pid, 'precio': 18000}

    # Bebidas
    pid = crear_producto('Coca Cola 500ml', 8000, 'Bebidas')
    if pid: menu['Coca Cola'] = {'id': pid, 'precio': 8000}

    pid = crear_producto('Pilsen 1L', 12000, 'Bebidas')
    if pid: menu['Pilsen'] = {'id': pid, 'precio': 12000}

    pid = crear_producto('Tereré Grande', 6000, 'Bebidas')
    if pid: menu['Tereré'] = {'id': pid, 'precio': 6000}

    # Postres
    pid = crear_producto('Dulce de Leche', 15000, 'Postres')
    if pid: menu['Dulce de Leche'] = {'id': pid, 'precio': 15000}

    pid = crear_producto('Flan con Huevo', 12000, 'Postres')
    if pid: menu['Flan'] = {'id': pid, 'precio': 12000}

print(f'\n📋 Menú: {len(menu)} productos')

# ─── Crear mesas ───
paso('3. VERIFICANDO MESAS')
r = req('GET', '/mesas')
mesas = (r.json().get('mesas') or r.json().get('data') or []) if r else []
if len(mesas) < 3:
    for i in range(1, 5):
        req('POST', '/mesas/crear', json={'numero': i, 'capacidad': 4})
    r = req('GET', '/mesas')
    mesas = (r.json().get('mesas') or r.json().get('data') or []) if r else []
print(f'  {len(mesas)} mesas disponibles')

# ─── Seed inventario ───
paso('4. CARGANDO INVENTARIO')
for nombre, p in menu.items():
    req('POST', '/inventario/movimiento', json={
        'producto_id': p['id'], 'tipo': 'entrada', 'cantidad': 50,
        'motivo': 'compra', 'notas': 'Stock diario'
    })
print(f'  Inventario cargado para {len(menu)} productos')

# ─── Abrir caja ───
paso('5. ABRIENDO CAJA')
r = req('POST', '/caja/apertura', json={'fondo_inicial': 500000, 'notas': f'Apertura {datetime.now().strftime("%d/%m/%Y")}'})
if r and r.status_code == 200:
    print('  ✅ Caja abierta')
else:
    print(f'  ℹ️ {r.json().get("error","ya estaba abierta") if r else "?"}')

# ─── Mesa 1: Familia Pérez ───
paso('6. 🧑‍🧑‍🧒‍🧒 MESA 1 — Familia Pérez (4 personas)')
m1 = mesas[0]['id']
items = [
    {'producto_id': menu['Empanada']['id'], 'cantidad': 4, 'precio': 7000, 'variante': 'frita'},
    {'producto_id': menu['Pizza']['id'], 'cantidad': 2, 'precio': 45000, 'variante': 'grande'},
    {'producto_id': menu['Milanesa']['id'], 'cantidad': 2, 'precio': 25000},
    {'producto_id': menu['Coca']['id'], 'cantidad': 3, 'precio': 8000},
    {'producto_id': menu['Pilsen']['id'], 'cantidad': 1, 'precio': 12000},
]
r = req('POST', '/pedidos/crear', json={'mesa_id': m1, 'items': items, 'notas': 'Traer todo junto'})
pedido1 = r.json().get('pedido', {}) if r else {}
pid1 = pedido1.get('id')
total1 = float(pedido1.get('total', 0))
# Get full pedido for numero_orden
if pid1:
    r2 = req('GET', f'/pedidos/{pid1}')
    if r2: pedido1 = r2.json().get('pedido', pedido1)
print(f'  📝 Pedido #{pedido1.get("numero_orden")} — Total: ${total1:,.0f}')
for it in items:
    print(f'    • {it["cantidad"]}x {next(n for n,p in menu.items() if p["id"]==it["producto_id"])}')

# Editar: agregar un postre
req('POST', f'/pedidos/{pid1}/items', json={'items': [{'producto_id': menu['Flan']['id'], 'cantidad': 2, 'precio': 12000}]})
print('  ✏️ +2 Flan (agregado después)')

# Cocina
paso('7. 👨‍🍳 COCINA — Pedidos entrantes')
req('POST', f'/pedidos/{pid1}/estado', json={'estado': 'cocinando'})
print(f'  Pedido #{pedido1.get("numero_orden")} → cocinando')
time.sleep(0.5)

# ─── Mesa 2: Pareja joven ───
paso('8. 👫 MESA 2 — Pareja')
m2 = mesas[1]['id']
items2 = [
    {'producto_id': menu['Chipa']['id'], 'cantidad': 1, 'precio': 12000},
    {'producto_id': menu['Hamburguesa']['id'], 'cantidad': 2, 'precio': 35000},
    {'producto_id': menu['Tereré']['id'], 'cantidad': 2, 'precio': 6000},
    {'producto_id': menu['Dulce']['id'], 'cantidad': 1, 'precio': 15000},
]
r = req('POST', '/pedidos/crear', json={'mesa_id': m2, 'items': items2, 'notas': ''})
pedido2 = r.json().get('pedido', {}) if r else {}
pid2 = pedido2.get('id')
total2 = float(pedido2.get('total', 0))
if pid2:
    r2 = req('GET', f'/pedidos/{pid2}')
    if r2: pedido2 = r2.json().get('pedido', pedido2)
print(f'  📝 Pedido #{pedido2.get("numero_orden")} — Total: ${total2:,.0f}')

req('POST', f'/pedidos/{pid2}/estado', json={'estado': 'cocinando'})
print(f'  Pedido #{pedido2.get("numero_orden")} → cocinando')

# ─── Mesa 3: Cliente solo ───
paso('9. 🧑 MESA 3 — Cliente solo (almuerzo ejecutivo)')
m3 = mesas[2]['id']
items3 = [
    {'producto_id': menu['Sopa']['id'], 'cantidad': 1, 'precio': 18000},
    {'producto_id': menu['Milanesa']['id'], 'cantidad': 1, 'precio': 25000},
    {'producto_id': menu['Coca']['id'], 'cantidad': 1, 'precio': 8000},
]
r = req('POST', '/pedidos/crear', json={'mesa_id': m3, 'items': items3, 'notas': 'Sin cebolla'})
pedido3 = r.json().get('pedido', {}) if r else {}
pid3 = pedido3.get('id')
total3 = float(pedido3.get('total', 0))
if pid3:
    r2 = req('GET', f'/pedidos/{pid3}')
    if r2: pedido3 = r2.json().get('pedido', pedido3)
print(f'  📝 Pedido #{pedido3.get("numero_orden")} — Total: ${total3:,.0f}')

req('POST', f'/pedidos/{pid3}/estado', json={'estado': 'cocinando'})
print(f'  Pedido #{pedido3.get("numero_orden")} → cocinando')

# ─── Cocina: platos listos ───
paso('10. 🔔 COCINA — Platos terminados')
for pid, label in [(pid1, '#1 Familia'), (pid2, '#2 Pareja'), (pid3, '#3 Solo')]:
    req('POST', f'/pedidos/{pid}/estado', json={'estado': 'listo'})
    print(f'  Pedido {label} → listo')
    req('POST', f'/pedidos/{pid}/estado', json={'estado': 'entregado'})
    print(f'  Pedido {label} → entregado')

def cobrar(mesa_id, payload, label):
    try:
        r = req('POST', f'/pedidos/mesa/{mesa_id}/cobrar', json=payload)
    except Exception as e:
        print(f'  ❌ {label}: EXCEPTION: {e}')
        return None
    if r and r.status_code == 200:
        print(f'  ✅ {label}')
        return r.json()
    else:
        err = r.json().get('error', r.text[:200]) if r else 'no response'
        print(f'  ❌ {label}: {err}')
        return None

# ─── Cobro Mesa 1 — Pago MIXTO (efectivo + tarjeta) ───
paso('11. 💳 MESA 1 — Familia Pérez — Pago MIXTO')
print(f'  Total: ${total1:,.0f}')
monto_tarjeta = int(total1) - 80000 + 15000  # propina incluida
cobrar(m1, {
    'metodo_pago': {
        'principal': 'mixto',
        'pagos': [
            {'metodo': 'efectivo', 'monto': 80000, 'moneda': 'PYG', 'monto_pyg': 80000},
            {'metodo': 'tarjeta', 'monto': monto_tarjeta, 'moneda': 'PYG', 'monto_pyg': monto_tarjeta},
        ],
    },
    'propina': 15000,
    'cliente_tipo': 'consumidor_final',
    'generar_factura': False,
}, f'Pagado — ${total1 + 15000:,.0f} ($80,000 efectivo + ${monto_tarjeta:,.0f} tarjeta)')

# ─── Cobro Mesa 2 — Solo TARJETA ───
paso('12. 💳 MESA 2 — Pareja — Solo TARJETA')
print(f'  Total: ${total2:,.0f}')
monto_tarjeta2 = int(total2) + 5000
cobrar(m2, {
    'metodo_pago': 'tarjeta',
    'propina': 5000,
    'monto_recibido': monto_tarjeta2,
    'cliente_tipo': 'consumidor_final',
    'generar_factura': False,
}, f'Pagado — ${monto_tarjeta2:,.0f} con tarjeta. Pasar por Infonet')

# ─── Cobro Mesa 3 — EFECTIVO con vuelto ───
paso('13. 💵 MESA 3 — Cliente solo — EFECTIVO')
print(f'  Total: ${total3:,.0f}')
cobrar(m3, {
    'metodo_pago': 'efectivo',
    'propina': 0,
    'monto_recibido': 60000,
    'cliente_tipo': 'consumidor_final',
    'generar_factura': False,
}, f'Pagado — Recibí $60,000 — Vuelto: ${60000 - total3:,.0f}')

# ─── Reportes ───
paso('14. 📊 REPORTES DEL DÍA')
r = req('GET', '/informes/resumen-completo')
if r and r.status_code == 200:
    d = r.json().get('data', r.json())
    print(f'  Ventas totales: ${d.get("ventas_totales",0):,.0f}')
    print(f'  Pedidos: {d.get("total_pedidos",0)}')
    print(f'  Cancelados: {d.get("total_cancelados",0)} (en cocina: {d.get("cancelados_en_cocina",0)})')
    print(f'  Ticket promedio: ${d.get("ticket_promedio",0):,.0f}')
else:
    print(f'  ⚠️ {r.text[:200] if r else "no response"}')

r = req('GET', '/informes/dashboard')
if r and r.status_code == 200:
    d = r.json().get('data', r.json())
    print(f'  Producto más vendido: {d.get("top_productos",[{}])[0].get("nombre","N/A") if d.get("top_productos") else "N/A"}')
    print(f'  Ingresos hoy: ${float(d.get("ingresos_hoy",0)):,.0f}')

# ─── Cierre de caja ───
paso('15. 🔒 CIERRE DE CAJA')
r = req('POST', '/caja/cierre', json={
    'denominaciones': [
        {'valor': 100000, 'cantidad': 0},
        {'valor': 50000, 'cantidad': 3},
        {'valor': 20000, 'cantidad': 2},
        {'valor': 10000, 'cantidad': 5},
        {'valor': 5000, 'cantidad': 3},
        {'valor': 2000, 'cantidad': 5},
        {'valor': 1000, 'cantidad': 10},
    ],
    'observaciones': 'Cierre del día — todas las mesas pagadas',
})
if r and r.status_code == 200:
    d = r.json().get('corte', r.json())
    print(f'  ✅ Caja cerrada')
    print(f'  Total efectivo: ${float(d.get("total_efectivo",0)):,.0f}')
    print(f'  Total tarjeta: ${float(d.get("total_tarjeta",0)):,.0f}')
    print(f'  Diferencia: ${float(d.get("diferencia",0)):,.0f}')
else:
    print(f'  ❌ Error: {r.json().get("error","") if r else "no response"}')

# ─── Resumen final ───
paso('✅ RESUMEN DE ATENCIÓN')
print(f'''
🧑‍🍳 Mozo: Simulación completada
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mesa 1 — Familia Pérez (4 pax)
  Total: ${total1 + 15000:,.0f}
  💵 Efectivo: $80,000
  💳 Tarjeta (Infonet): ${total1 - 80000 + 15000:,.0f}

Mesa 2 — Pareja
  Total: ${total2 + 5000:,.0f}
  💳 Tarjeta (Infonet): ${total2 + 5000:,.0f}

Mesa 3 — Cliente solo
  Total: ${total3:,.0f}
  💵 Efectivo: $60,000 (vuelto ${60000 - total3:,.0f})

───
💰 Total procesado: ${total1 + total2 + total3 + 20000:,.0f}
💳 Pasar por Infonet: ${total1 - 80000 + 15000 + total2 + 5000:,.0f}
💵 Efectivo en caja: $80,000 + ${total3:,.0f} = ${80000 + total3:,.0f}
''')
