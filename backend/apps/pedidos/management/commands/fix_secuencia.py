from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Corrige la secuencia de IDs de pedidos'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Obtener el máximo ID actual
            cursor.execute("SELECT MAX(id) FROM pedidos")
            max_id = cursor.fetchone()[0]
            
            if max_id:
                nuevo_id = max_id + 1
                # Actualizar la secuencia
                cursor.execute(f"SELECT setval('pedidos_id_seq', {nuevo_id})")
                self.stdout.write(self.style.SUCCESS(f'✅ Secuencia actualizada: próximo ID será {nuevo_id}'))
            else:
                # Si no hay pedidos, resets a 1
                cursor.execute("SELECT setval('pedidos_id_seq', 1)")
                self.stdout.write(self.style.WARNING('⚠️ No hay pedidos, secuencia reseteada a 1'))