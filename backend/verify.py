import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
django.setup()
from apps.facturacion.models import Timbrado
from apps.pedidos.models import Pedido

t = Timbrado.objects.get(activo=True)
print(f'Timbrado: actual={t.numero_actual}, fin={t.numero_fin}')

p = Pedido.objects.get(id=140)
print(f'Pedido 140: numero_factura={p.numero_factura}, estado={p.estado}')
