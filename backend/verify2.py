import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
django.setup()
from apps.pedidos.models import Pedido
from apps.facturacion.models import Timbrado

p = Pedido.objects.get(id=141)
t = Timbrado.objects.get(activo=True)
print(f'Pedido 141: estado={p.estado}, factura={p.numero_factura}')
print(f'  tarjeta: marca={p.marca_tarjeta}, ultimos4={p.ultimos_4}, comprobante={p.comprobante_nro}, cuotas={p.cuotas}')
print(f'  cajero={p.cajero.nombre if p.cajero else None}, propina={p.propina}')
print(f'Timbrado actual={t.numero_actual}')
