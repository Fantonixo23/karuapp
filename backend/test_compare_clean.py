import sqlite3
import os, sys

sys.path.insert(0, os.path.dirname(__file__))
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
import django
django.setup()
from django.db import connection

# SQLite backup (original pre-migration)
backup_path = os.path.join(os.path.dirname(__file__), 'datos.db.backup')
backup = sqlite3.connect(backup_path)
cur_b = backup.cursor()

# Supabase via Django
cur_s = connection.cursor()

TABLAS = [
    ('categorias',      'categorias'),
    ('productos',       'productos'),
    ('restaurantes',    'restaurantes'),
    ('mesas',           'mesas'),
    ('pedidos',         'pedidos'),
]

print(f'\n{"TABLA":25s} {"Backup (orig)":>15s} {"Supabase (hoy)":>15s} {"DIF":>10s}')
print('-' * 70)
ok = True
for old, new in TABLAS:
    cur_b.execute(f'SELECT COUNT(*) FROM "{old}"')
    b_cnt = cur_b.fetchone()[0]
    cur_s.execute(f'SELECT COUNT(*) FROM "{new}"')
    s_cnt = cur_s.fetchone()[0]
    diff = ''
    if b_cnt == s_cnt:
        diff = 'OK'
    else:
        diff = f'DIF {s_cnt-b_cnt:+d}'
        ok = False
    print(f'{old:25s} {str(b_cnt):>15s} {str(s_cnt):>15s} {diff:>10s}')

backup.close()
connection.close()

print(f'\n=> {"ALL OK - coinciden exactamente" if ok else "NO COINCIDEN - ver detalle arriba"}')
sys.exit(0 if ok else 1)
