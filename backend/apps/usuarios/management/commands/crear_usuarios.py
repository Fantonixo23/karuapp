from django.core.management.base import BaseCommand
from apps.usuarios.models import Usuario
from apps.tenants.models import Restaurante


class Command(BaseCommand):
    help = 'Crea los usuarios por defecto del sistema'

    def handle(self, *args, **options):
        restaurante = Restaurante.objects.first()
        if not restaurante:
            restaurante = Restaurante.objects.create(
                nombre='Restaurante por defecto',
                slug='default',
                activo=True,
                plan='free',
            )

        usuarios = [
            {'nombre': 'Admin', 'pin': '0000', 'rol': 'administrador'},
            {'nombre': 'mesero1', 'pin': '1111', 'rol': 'mesero'},
            {'nombre': 'mesero2', 'pin': '2222', 'rol': 'mesero'},
            {'nombre': 'cocina', 'pin': '3333', 'rol': 'cocina'},
        ]

        for u in usuarios:
            if Usuario.objects.filter(restaurante=restaurante, nombre=u['nombre']).exists():
                self.stdout.write(f"  - {u['nombre']} ya existe, omitiendo")
                continue

            Usuario.objects.create(
                restaurante=restaurante,
                nombre=u['nombre'],
                pin=u['pin'],
                rol=u['rol'],
            )
            self.stdout.write(f"  + {u['nombre']} creado (PIN: {u['pin']})")

        self.stdout.write(self.style.SUCCESS('Usuarios por defecto creados exitosamente'))
