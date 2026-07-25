from django.db import connection
from apps.pedidos.models import Pedido

max_id = Pedido.objects.order_by('-id').first()
if max_id:
    print(f'Max ID actual: {max_id.id}')
    # Sincronizar la secuencia
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT setval('pedidos_id_seq', {max_id.id})")
    print('Secuencia sincronizada!')
else:
    print('No hay pedidos')