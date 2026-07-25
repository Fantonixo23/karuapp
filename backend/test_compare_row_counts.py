import sqlite3
import os, sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
import django
django.setup()

import psycopg2

# SQLite (old schema)
sqlite_path = os.path.join(os.path.dirname(__file__), 'datos.db')
sqlite_conn = sqlite3.connect(sqlite_path)
sqlite_cur = sqlite_conn.cursor()

# Supabase (new schema with Django tables)
supa_conn = psycopg2.connect(
    host=os.environ.get('DB_HOST', 'db.sbgmmrsmqdcxzecdmrww.supabase.co'),
    port=os.environ.get('DB_PORT', '6543'),
    dbname=os.environ.get('DB_NAME', 'postgres'),
    user=os.environ.get('DB_USER', 'postgres'),
    password=os.environ.get('DB_PASSWORD', 'Kinflid1289'),
)
supa_cur = supa_conn.cursor()

# Map old table -> new table, and check by row count
MAPPING = [
    ('restaurantes',       'tenants_restaurante'),
    ('categorias',         'productos_categoria'),
    ('productos',          'productos_producto'),
    ('mesas',              'mesas_mesa'),
    ('pedidos',            'pedidos_pedido'),
    (None,                 'pedidos_pedidoitem'),
    ('caja_sesiones',     'caja_cajasession'),
    ('caja_cortes',        'caja_cortecaja'),
    ('caja_movimientos',   None),
    ('configuracion',     'facturacion_configuracion'),
    ('metodos_pago',      'facturacion_metodopago'),
    ('facturas',          'facturacion_factura'),
    ('inventario',        'inventario_inventario'),
    ('movimientos_inventario', None),
    ('usuarios',           'usuarios_usuario'),
    ('timbrados',          None),
    ('impresiones',        None),
]

def sqlite_count(table):
    if table is None: return 'N/A'
    try:
        sqlite_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        return sqlite_cur.fetchone()[0]
    except Exception as e:
        return f'ERR:{e}'

def supa_count(table):
    if table is None: return 'N/A'
    try:
        supa_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        return supa_cur.fetchone()[0]
    except Exception as e:
        supa_conn.rollback()
        return f'ERR:{e}'

print(f'\n{"OLD TABLE":25s} {"NEW TABLE":30s} {"OLD cnt":>8s} {"NEW cnt":>8s} {"DIF":>10s}')
print('-' * 85)
ok = True
for old, new in MAPPING:
    s = sqlite_count(old)
    p = supa_count(new)
    diff = ''
    if isinstance(s, int) and isinstance(p, int):
        if s == p:
            diff = 'OK'
        else:
            diff = f'DIF {p-s:+d}'
            ok = False
    else:
        diff = 'ERR'
    print(f'{str(old):25s} {str(new):30s} {str(s):>8s} {str(p):>8s} {diff:>10s}')

sqlite_conn.close()
supa_conn.close()

print(f'\n=> {"ALL OK" if ok else "DIFFERENCES FOUND"}')
sys.exit(0 if ok else 1)
