import sqlite3
import psycopg2
import os, sys

# SQLite
sqlite_path = os.path.join(os.path.dirname(__file__), 'datos.db')
print(f'SQLite path: {sqlite_path}')
sqlite_conn = sqlite3.connect(sqlite_path)
cur = sqlite_conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print(f'\nSQLite tables ({len(tables)}):')
for t in tables:
    cur.execute(f'SELECT COUNT(*) FROM "{t}"')
    c = cur.fetchone()[0]
    print(f'  {t}: {c} rows')

# Supabase
sys.path.insert(0, os.path.dirname(__file__))
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
import django
django.setup()

supa_conn = psycopg2.connect(
    host=os.environ.get('DB_HOST', 'db.sbgmmrsmqdcxzecdmrww.supabase.co'),
    port=os.environ.get('DB_PORT', '6543'),
    dbname=os.environ.get('DB_NAME', 'postgres'),
    user=os.environ.get('DB_USER', 'postgres'),
    password=os.environ.get('DB_PASSWORD', 'Kinflid1289'),
)
cur2 = supa_conn.cursor()
cur2.execute("""
  SELECT tablename FROM pg_catalog.pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  ORDER BY tablename
""")
supa_tables = [r[0] for r in cur2.fetchall()]
print(f'\nSupabase tables ({len(supa_tables)}):')
for t in supa_tables:
    try:
        cur2.execute(f'SELECT COUNT(*) FROM "{t}"')
        c = cur2.fetchone()[0]
        print(f'  {t}: {c} rows')
    except Exception as e:
        print(f'  {t}: ERROR {e}')

sqlite_conn.close()
supa_conn.close()
