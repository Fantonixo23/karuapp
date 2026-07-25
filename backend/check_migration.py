import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
django.setup()
from django.db import connection
c = connection.cursor()
c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='pedidos' AND column_name='cajero_id'")
print('cajero_id column exists:', bool(c.fetchone()))
c.execute("SELECT app, name, applied FROM django_migrations WHERE app='pedidos' ORDER BY name")
for r in c.fetchall():
    print(r)
