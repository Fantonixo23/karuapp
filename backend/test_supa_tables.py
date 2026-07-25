import os, sys
sys.path.insert(0, os.path.dirname(__file__))
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
import django
django.setup()
from django.db import connection

with connection.cursor() as cur:
    cur.execute("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")
    tables = [r[0] for r in cur.fetchall()]
    print(f'Django sees {len(tables)} tables in public schema:')
    for t in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        c = cur.fetchone()[0]
        print(f'  {t}: {c} rows')
