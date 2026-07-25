import os
from django.core.management.base import BaseCommand
from apps.productos.models import Categoria, Producto


class Command(BaseCommand):
    help = 'Carga productos típicos de un restaurante paraguayo'

    def handle(self, *args, **options):
        # Crear categorías
        categorias_data = [
            {'nombre': 'Hamburguesas', 'icono': 'lunch_dining', 'orden': 1},
            {'nombre': 'Hot Dogs', 'icono': 'dinner_dining', 'orden': 2},
            {'nombre': 'Lomitos', 'icono': 'kebab_dining', 'orden': 3},
            {'nombre': 'Sándwiches', 'icono': 'breakfast_dining', 'orden': 4},
            {'nombre': 'Milanesas', 'icono': 'set_meal', 'orden': 5},
            {'nombre': 'Parrillada', 'icono': 'outdoor_grill', 'orden': 6},
            {'nombre': 'Empanadas', 'icono': 'bakery_dining', 'orden': 7},
            {'nombre': 'Bebidas', 'icono': 'local_cafe', 'orden': 8},
            {'nombre': 'Postres', 'icono': 'cake', 'orden': 9},
            {'nombre': 'Guarniciones', 'icono': 'vegetable', 'orden': 10},
        ]

        categorias = {}
        for cat_data in categorias_data:
            cat, created = Categoria.objects.get_or_create(
                nombre=cat_data['nombre'],
                defaults={'icono': cat_data['icono'], 'orden': cat_data['orden']}
            )
            categorias[cat_data['nombre']] = cat
            if created:
                self.stdout.write(f'[+] Categoria creada: {cat_data["nombre"]}')

        # Productos por categoría
        productos_data = [
            # Hamburguesas
            {'nombre': 'Hamburguesa Simple', 'precio': 25000, 'categoria': 'Hamburguesas', 'descripcion': 'Carne de res, pan, lechuga, tomate'},
            {'nombre': 'Hamburguesa Doble', 'precio': 35000, 'categoria': 'Hamburguesas', 'descripcion': 'Doble carne, queso, pan, vegetales'},
            {'nombre': 'Hamburguesa Especial', 'precio': 45000, 'categoria': 'Hamburguesas', 'descripcion': 'Carne, queso, huevo, jamón, tocineta'},
            {'nombre': 'Hamburguesa Vegetariana', 'precio': 30000, 'categoria': 'Hamburguesas', 'descripcion': 'Hamburguesa de soja, vegetales frescos'},
            {'nombre': 'Hamburguesa Pollo', 'precio': 28000, 'categoria': 'Hamburguesas', 'descripcion': 'Pechuga de pollo, lechuga, mayonesa'},

            # Hot Dogs
            {'nombre': 'Hot Dog Simple', 'precio': 15000, 'categoria': 'Hot Dogs', 'descripcion': 'Salchicha, pan, salsa de tomate y mostaza'},
            {'nombre': 'Hot Dog Completo', 'precio': 25000, 'categoria': 'Hot Dogs', 'descripcion': 'Salchicha, palta, tomate, mayonesa, chucrut'},
            {'nombre': 'Hot Dog Especial', 'precio': 30000, 'categoria': 'Hot Dogs', 'descripcion': 'Salchicha premium, queso, tocineta'},
            {'nombre': 'Hot Dog Chileno', 'precio': 28000, 'categoria': 'Hot Dogs', 'descripcion': 'Salchicha, palta, tomate, mayonesa'},

            # Lomitos
            {'nombre': 'Lomito Simple', 'precio': 30000, 'categoria': 'Lomitos', 'descripcion': 'Carne de cerdo, pan, lechuga, tomate'},
            {'nombre': 'Lomito Completo', 'precio': 40000, 'categoria': 'Lomitos', 'descripcion': 'Carne, huevo, jamón, queso, lechuga, tomate'},
            {'nombre': 'Lomito Especial', 'precio': 48000, 'categoria': 'Lomitos', 'descripcion': 'Carne premium, huevo, jamón, queso, tocineta'},
            {'nombre': 'Lomito de Pollo', 'precio': 32000, 'categoria': 'Lomitos', 'descripcion': 'Pechuga de pollo, lechuga, mayonesa'},

            # Sándwiches
            {'nombre': 'Sándwich de Milanesa', 'precio': 32000, 'categoria': 'Sándwiches', 'descripcion': 'Milanesa de res, pan, lechuga, tomate'},
            {'nombre': 'Sándwich de Jamón y Queso', 'precio': 25000, 'categoria': 'Sándwiches', 'descripcion': 'Jamón, queso, pan, lechuga'},
            {'nombre': 'Sándwich de Huevo', 'precio': 20000, 'categoria': 'Sándwiches', 'descripcion': 'Huevo frito, pan, lechuga, tomate'},
            {'nombre': 'Sándwich Veggie', 'precio': 28000, 'categoria': 'Sándwiches', 'descripcion': 'Vegetales frescos, queso, pan integral'},

            # Milanesas
            {'nombre': 'Milanesa de Res', 'precio': 35000, 'categoria': 'Milanesas', 'descripcion': 'Milanesa de res con guarnición'},
            {'nombre': 'Milanesa de Pollo', 'precio': 32000, 'categoria': 'Milanesas', 'descripcion': 'Milanesa de pollo con guarnición'},
            {'nombre': 'Milanesa Napolitana', 'precio': 42000, 'categoria': 'Milanesas', 'descripcion': 'Milanesa con salsa, queso y jamón'},
            {'nombre': 'Milanesa Suprema', 'precio': 48000, 'categoria': 'Milanesas', 'descripcion': 'Milanesa especial con huevo y jamón'},

            # Parrillada
            {'nombre': 'Parrillada Individual', 'precio': 55000, 'categoria': 'Parrillada', 'descripcion': 'Asado, chorizo, morcilla, costillas'},
            {'nombre': 'Parrillada Pareja', 'precio': 100000, 'categoria': 'Parrillada', 'descripcion': 'Para 2 personas, variedad de carnes'},
            {'nombre': 'Parrillada Familiar', 'precio': 180000, 'categoria': 'Parrillada', 'descripcion': 'Para 4 personas, asado completo'},
            {'nombre': 'Asado de Tira', 'precio': 45000, 'categoria': 'Parrillada', 'descripcion': 'Asado de tira con guarnición'},

            # Empanadas
            {'nombre': 'Empanada de Carne', 'precio': 8000, 'categoria': 'Empanadas', 'descripcion': 'Empanada de carne picada'},
            {'nombre': 'Empanada de Pollo', 'precio': 8000, 'categoria': 'Empanadas', 'descripcion': 'Empanada de pollo desmenuzado'},
            {'nombre': 'Empanada de Queso', 'precio': 7000, 'categoria': 'Empanadas', 'descripcion': 'Empanada de queso derretido'},
            {'nombre': 'Empanada de Jamón y Queso', 'precio': 9000, 'categoria': 'Empanadas', 'descripcion': 'Jamón y queso'},
            {'nombre': 'Empanada de Verdura', 'precio': 7000, 'categoria': 'Empanadas', 'descripcion': 'Espinaca y queso'},

            # Bebidas
            {'nombre': 'Coca Cola 500ml', 'precio': 8000, 'categoria': 'Bebidas', 'descripcion': 'Bebida gaseosa'},
            {'nombre': 'Coca Cola 1.5L', 'precio': 15000, 'categoria': 'Bebidas', 'descripcion': 'Bebida gaseosa grande'},
            {'nombre': 'Pepsi 500ml', 'precio': 7000, 'categoria': 'Bebidas', 'descripcion': 'Bebida gaseosa'},
            {'nombre': 'Agua Mineral 500ml', 'precio': 5000, 'categoria': 'Bebidas', 'descripcion': 'Agua mineral sin gas'},
            {'nombre': 'Jugo Natural', 'precio': 12000, 'categoria': 'Bebidas', 'descripcion': 'Jugo de naranja, piña o sandía'},
            {'nombre': 'Cerveza Botella', 'precio': 15000, 'categoria': 'Bebidas', 'descripcion': 'Cerveza nacional'},
            {'nombre': 'Tereré', 'precio': 10000, 'categoria': 'Bebidas', 'descripcion': 'Tereré tradicional paraguayo'},

            # Postres
            {'nombre': 'Helado 3 Bolas', 'precio': 15000, 'categoria': 'Postres', 'descripcion': 'Helado de varios sabores'},
            {'nombre': 'Flan con Dulce', 'precio': 12000, 'categoria': 'Postres', 'descripcion': 'Flan casero con dulce de leche'},
            {'nombre': 'Pastel de Papa', 'precio': 10000, 'categoria': 'Postres', 'descripcion': 'Pastel de papa dulce'},
            {'nombre': 'Mazamorra', 'precio': 8000, 'categoria': 'Postres', 'descripcion': 'Postre tradicional paraguayo'},

            # Guarniciones
            {'nombre': 'Papas Fritas', 'precio': 12000, 'categoria': 'Guarniciones', 'descripcion': 'Papas fritas crocantes'},
            {'nombre': 'Papas Rusticas', 'precio': 15000, 'categoria': 'Guarniciones', 'descripcion': 'Papas con cáscara y especias'},
            {'nombre': 'Ensalada Mixta', 'precio': 10000, 'categoria': 'Guarniciones', 'descripcion': 'Lechuga, tomate, cebolla'},
            {'nombre': 'Arroz', 'precio': 8000, 'categoria': 'Guarniciones', 'descripcion': 'Arroz blanco'},
            {'nombre': 'Ensalada Rusa', 'precio': 12000, 'categoria': 'Guarniciones', 'descripcion': 'Papas, zanahoria, arvejas con mayonesa'},
        ]

        for prod_data in productos_data:
            categoria = categorias.get(prod_data['categoria'])
            if not categoria:
                self.stdout.write(f'[-] Categoria no encontrada: {prod_data["categoria"]}')
                continue

            # Generar nombre de imagen basado en el nombre del producto
            nombre_imagen = prod_data['nombre'].lower().replace(' ', '_') + '.jpg'
            imagen_path = f'productos/{nombre_imagen}'

            producto, created = Producto.objects.get_or_create(
                nombre=prod_data['nombre'],
                defaults={
                    'precio': prod_data['precio'],
                    'descripcion': prod_data['descripcion'],
                    'categoria': categoria,
                    'imagen': imagen_path,
                    'disponible': True
                }
            )

            if created:
                self.stdout.write(f'[+] Producto creado: {prod_data["nombre"]} (imagen: {nombre_imagen})')
            else:
                # Actualizar imagen si no tiene
                if not producto.imagen:
                    producto.imagen = imagen_path
                    producto.save()
                    self.stdout.write(f'[*] Imagen actualizada: {prod_data["nombre"]}')

        self.stdout.write(self.style.SUCCESS('\n[+] Productos cargados exitosamente'))
        self.stdout.write('\nIMÁGENES ESPERADAS (deben estar en media/productos/):')
        self.stdout.write('Ejemplos:')
        self.stdout.write('  - hamburguesa_simple.jpg')
        self.stdout.write('  - hot_dog_completo.jpg')
        self.stdout.write('  - lomito_especial.jpg')
        self.stdout.write('  - milanesa_napolitana.jpg')
        self.stdout.write('\nEl nombre del archivo se genera reemplazando espacios con _ y convirtiendo a minúsculas.')
