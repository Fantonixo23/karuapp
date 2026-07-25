import os
from django.core.management.base import BaseCommand
from apps.productos.models import Categoria, Producto


class Command(BaseCommand):
    help = 'Carga productos con variantes (basado en imagenes disponibles)'

    def handle(self, *args, **options):
        # Limpiar
        Producto.objects.all().delete()
        Categoria.objects.all().delete()
        
        # Crear categorías
        cat_hamburguesas = Categoria.objects.create(
            nombre='Hamburguesas', 
            icono='lunch_dining', 
            orden=1
        )
        cat_hotdogs = Categoria.objects.create(
            nombre='Hot Dogs', 
            icono='dinner_dining', 
            orden=2
        )
        cat_lomitos = Categoria.objects.create(
            nombre='Lomitos', 
            icono='kebab_dining', 
            orden=3
        )
        cat_bebidas = Categoria.objects.create(
            nombre='Bebidas', 
            icono='local_cafe', 
            orden=4
        )
        
        # Hamburguesas con variantes
        hamburguesa = Producto.objects.create(
            nombre='Hamburguesa',
            descripcion='Deliciosa hamburguesa',
            precio=25000,
            categoria=cat_hamburguesas,
            imagen='productos/hamburguesa.png',
            variantes={
                'tipos': [
                    {'nombre': 'Simple', 'precio_extra': 0},
                    {'nombre': 'Doble', 'precio_extra': 10000},
                    {'nombre': 'Especial', 'precio_extra': 20000},
                ],
                'queso': {'nombre': 'Con Queso', 'precio_extra': 5000},
                'huevo': {'nombre': 'Con Huevo', 'precio_extra': 5000},
                'tocineta': {'nombre': 'Con Tocineta', 'precio_extra': 7000},
            }
        )
        
        # Hot Dogs con variantes
        hotdog = Producto.objects.create(
            nombre='Hot Dog',
            descripcion='Salchicha premium',
            precio=15000,
            categoria=cat_hotdogs,
            imagen='productos/hotdog.jpg',
            variantes={
                'tipos': [
                    {'nombre': 'Simple', 'precio_extra': 0},
                    {'nombre': 'Completo', 'precio_extra': 10000},
                    {'nombre': 'Especial', 'precio_extra': 15000},
                ],
                'palta': {'nombre': 'Con Palta', 'precio_extra': 5000},
                'chucrut': {'nombre': 'Con Chucrut', 'precio_extra': 3000},
            }
        )
        
        # Lomitos con variantes
        lomito = Producto.objects.create(
            nombre='Lomito',
            descripcion='Lomo de cerdo',
            precio=30000,
            categoria=cat_lomitos,
            imagen='productos/lomito.jpg',
            variantes={
                'tipos': [
                    {'nombre': 'Simple', 'precio_extra': 0},
                    {'nombre': 'Completo', 'precio_extra': 10000},
                    {'nombre': 'Especial', 'precio_extra': 18000},
                ],
                'queso': {'nombre': 'Con Queso', 'precio_extra': 5000},
                'huevo': {'nombre': 'Con Huevo', 'precio_extra': 5000},
                'jamon': {'nombre': 'Con Jamón', 'precio_extra': 5000},
            }
        )
        
        # Bebidas
        Producto.objects.create(
            nombre='Coca Cola',
            descripcion='Bebida gaseosa 500ml',
            precio=8000,
            categoria=cat_bebidas,
            imagen='productos/cocacola.png',
            variantes={
                'tamaños': [
                    {'nombre': '500ml', 'precio_extra': 0},
                    {'nombre': '1.5L', 'precio_extra': 7000},
                ]
            }
        )
        
        Producto.objects.create(
            nombre='Pepsi',
            descripcion='Bebida gaseosa 500ml',
            precio=7000,
            categoria=cat_bebidas,
            imagen='productos/cocacola.png',  # usar misma imagen por ahora
            variantes=None
        )
        
        Producto.objects.create(
            nombre='Agua Mineral',
            descripcion='Agua sin gas 500ml',
            precio=5000,
            categoria=cat_bebidas,
            imagen='productos/cocacola.png',  # usar misma imagen por ahora
            variantes=None
        )
        
        self.stdout.write(self.style.SUCCESS('\n[+] Productos cargados con variantes'))
        self.stdout.write('\nPRODUCTOS CREADOS:')
        self.stdout.write('1. Hamburguesa (Simple 25k, Doble 35k, Especial 45k)')
        self.stdout.write('   Variantes: +Queso 5k, +Huevo 5k, +Tocineta 7k')
        self.stdout.write('2. Hot Dog (Simple 15k, Completo 25k, Especial 30k)')
        self.stdout.write('   Variantes: +Palta 5k, +Chucrut 3k')
        self.stdout.write('3. Lomito (Simple 30k, Completo 40k, Especial 48k)')
        self.stdout.write('   Variantes: +Queso 5k, +Huevo 5k, +Jamón 5k')
        self.stdout.write('4. Coca Cola (500ml 8k, 1.5L 15k)')
        self.stdout.write('5. Pepsi (500ml 7k)')
        self.stdout.write('6. Agua Mineral (500ml 5k)')
        self.stdout.write('\nIMÁGENES USADAS (en frontend/src/productos imagenes/):')
        self.stdout.write('  - hamburguesa.png')
        self.stdout.write('  - hotdog.jpg')
        self.stdout.write('  - lomito.jpg')
        self.stdout.write('  - cocacola.png')
