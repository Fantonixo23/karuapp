"""
Reset Supabase data and reload from SQLite dump (datos_dump.json).
Keeps table schema intact.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
import django
django.setup()
from django.db import connection, transaction
from django.core.management import call_command
from io import StringIO

TABLAS = [
    'auth_permission', 'auth_group', 'auth_group_permissions',
    'auth_user', 'auth_user_groups', 'auth_user_user_permissions',
    'django_admin_log', 'django_content_type', 'django_session',
    'caja_cortes', 'caja_movimientos', 'caja_sesiones',
    'facturas', 'metodos_pago', 'configuracion', 'timbrados',
    'inventario', 'movimientos_inventario',
    'mesas', 'pedidos', 'impresiones',
    'productos', 'categorias',
    'restaurantes', 'usuarios',
]

with connection.cursor() as cur:
    cur.execute("SET session_replication_role = 'replica';")
    for t in TABLAS:
        try:
            cur.execute(f'TRUNCATE TABLE "{t}" CASCADE;')
            print(f'  Truncated {t}')
        except Exception as e:
            print(f'  SKIP {t}: {e}')
    cur.execute("SET session_replication_role = 'origin';")
    transaction.commit()

print('\nLoading datos_dump.json...')
out = StringIO()
call_command('loaddata', 'datos_dump.json', stdout=out)
print(out.getvalue())

print('\nDone. Verifying counts...')
cur = connection.cursor()
for t in TABLAS:
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        c = cur.fetchone()[0]
        if c > 0:
            print(f'  {t}: {c} rows')
    except:
        pass

connection.close()
