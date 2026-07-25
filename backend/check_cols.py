import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
django.setup()
from django.db import connection
c = connection.cursor()
c.execute("SELECT column_name FROM information_schema.columns WHERE table_name='pedidos' AND column_name='numero_factura'")
print('numero_factura column exists:', bool(c.fetchone()))
