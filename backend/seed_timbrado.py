import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'pipperfood.settings'
django.setup()
from apps.facturacion.models import Timbrado
t = Timbrado.objects.filter(activo=True).first()
if t:
    print(f'Timbrado exists: {t.establecimiento}-{t.punto_expedicion}, actual={t.numero_actual}, fin={t.numero_fin}')
else:
    t = Timbrado.objects.create(
        establecimiento='001',
        punto_expedicion='001',
        numero_inicio=1,
        numero_fin=999999,
        numero_actual=0,
        fecha_vencimiento='2027-12-31',
        activo=True
    )
    print(f'Timbrado created: {t.establecimiento}-{t.punto_expedicion}, actual={t.numero_actual}')
