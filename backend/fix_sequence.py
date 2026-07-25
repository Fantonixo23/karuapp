import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pipperfood.settings')
django.setup()

from django.db import connection
from apps.pedidos.models import Pedido

max_pedido = Pedido.objects.order_by('-id').first()
if max_pedido:
    nuevo_id = max_pedido.id + 1
    print(f'Último ID: {max_pedido.id}')
    print(f'Próximo ID será: {nuevo_id}')
    
    # Atualizar a sequência manualmente
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT setval('pedidos_id_seq', {nuevo_id})")
    
    print('✅ Sequência sincronizada!')
else:
    print('Não há pedidos ainda')