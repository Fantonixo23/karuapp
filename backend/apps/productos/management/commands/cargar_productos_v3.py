from django.core.management.base import BaseCommand
from apps.productos.models import Categoria, Producto


class Command(BaseCommand):
    help = 'Carga productos de ejemplo con variantes e imágenes'

    def handle(self, *args, **options):
        imagenes = {
            'pizza': 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=300',
            'hamburguesa': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300',
            'hotdog': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=300',
            'lomito': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=300',
            'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300',
            'pollo': 'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=300',
            'sushi': 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300',
            'empanada': 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=300',
            'salteado': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300',
            'cerveza': 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=300',
            'refresco': 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=300',
            'jugo': 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=300',
            'cafe': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300',
            'postre': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300',
            'helado': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68b?w=300',
            'te': 'https://images.unsplash.com/photo-1556679343-c7306c1972bc?w=300',
            'agua': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300',
            'soda': 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=300',
            'milanesa': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300',
            'milanesa_carne': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300',
            'bebida': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2f7?w=300',
            'sopa': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300',
            'caldo': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300',
            'vorivori': 'https://images.unsplash.com/photo-1574484284002-952c9248c0a1?w=300',
            'sancocho': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300',
            'tortilla': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300',
            'arepa': 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=300',
            'empanada_carne': 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=300',
            'cuy': 'https://images.unsplash.com/photo-1603894584373-5ac82b241391?w=300',
            'chicha': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2f7?w=300',
        }

        productos_data = [
            # PIZZAS
            {'nombre': 'Pizza Margherita', 'precio': 45000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Personal', 'precio': 15000}, {'nombre': 'Mediana', 'precio': 30000}, {'nombre': 'Familiar', 'precio': 45000}
            ], 'imagen': imagenes['pizza'], 'disponible': True},
            {'nombre': 'Pizza Pepperoni', 'precio': 50000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Personal', 'precio': 17000}, {'nombre': 'Mediana', 'precio': 35000}, {'nombre': 'Familiar', 'precio': 50000}
            ], 'imagen': imagenes['pizza'], 'disponible': True},
            {'nombre': 'Pizza 4 Quesos', 'precio': 55000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Personal', 'precio': 18000}, {'nombre': 'Mediana', 'precio': 38000}, {'nombre': 'Familiar', 'precio': 55000}
            ], 'imagen': imagenes['pizza'], 'disponible': True},
            {'nombre': 'Pizza Hawaiana', 'precio': 48000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Personal', 'precio': 16000}, {'nombre': 'Mediana', 'precio': 32000}, {'nombre': 'Familiar', 'precio': 48000}
            ], 'imagen': imagenes['pizza'], 'disponible': True},
            
            # HAMBURGUESAS
            {'nombre': 'Hamburguesa Clásica', 'precio': 18000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Simple', 'precio': 12000}, {'nombre': 'Doble', 'precio': 18000}, {'nombre': 'Triple', 'precio': 24000}
            ], 'imagen': imagenes['hamburguesa'], 'disponible': True},
            {'nombre': 'Hamburguesa BBQ', 'precio': 22000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Simple', 'precio': 15000}, {'nombre': 'Doble', 'precio': 22000}
            ], 'imagen': imagenes['hamburguesa'], 'disponible': True},
            {'nombre': 'Hamburguesa Vegetariana', 'precio': 20000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Simple', 'precio': 14000}, {'nombre': 'Doble', 'precio': 20000}
            ], 'imagen': imagenes['hamburguesa'], 'disponible': True},
            
            # HOT DOGS
            {'nombre': 'Hot Dog Clásico', 'precio': 8000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Normal', 'precio': 8000}, {'nombre': 'Grande', 'precio': 12000}
            ], 'imagen': imagenes['hotdog'], 'disponible': True},
            {'nombre': 'Hot Dog Especial', 'precio': 12000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Normal', 'precio': 12000}, {'nombre': 'Grande', 'precio': 15000}
            ], 'imagen': imagenes['hotdog'], 'disponible': True},
            
            # LOMITOS
            {'nombre': 'Lomito de Cerdo', 'precio': 25000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Normal', 'precio': 25000}, {'nombre': 'Con queso', 'precio': 30000}
            ], 'imagen': imagenes['lomito'], 'disponible': True},
            {'nombre': 'Lomito de Pollo', 'precio': 22000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Normal', 'precio': 22000}, {'nombre': 'Con queso', 'precio': 27000}
            ], 'imagen': imagenes['pollo'], 'disponible': True},
            {'nombre': 'Lomito de Res', 'precio': 28000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Normal', 'precio': 28000}, {'nombre': 'Con queso', 'precio': 33000}
            ], 'imagen': imagenes['lomito'], 'disponible': True},
            
            # MILANESAS
            {'nombre': 'Milanesa de Pollo', 'precio': 20000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Normal', 'precio': 20000}, {'nombre': 'Napolitana', 'precio': 25000}, {'nombre': 'A la plancha', 'precio': 18000}
            ], 'imagen': imagenes['milanesa'], 'disponible': True},
            {'nombre': 'Milanesa de Carne', 'precio': 22000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Normal', 'precio': 22000}, {'nombre': 'Napolitana', 'precio': 27000}, {'nombre': 'A la plancha', 'precio': 20000}
            ], 'imagen': imagenes['milanesa_carne'], 'disponible': True},
            
            # PLATOS TÍPICOS PARAGUAYOS
            {'nombre': 'Vori Vori', 'precio': 18000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción individual', 'precio': 18000}, {'nombre': 'Familiar', 'precio': 45000}
            ], 'imagen': imagenes['vorivori'], 'disponible': True},
            {'nombre': 'Sancocho', 'precio': 20000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción individual', 'precio': 20000}, {'nombre': 'Familiar', 'precio': 50000}
            ], 'imagen': imagenes['sancocho'], 'disponible': True},
            {'nombre': 'Caldo de Gallina', 'precio': 15000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción', 'precio': 15000}
            ], 'imagen': imagenes['caldo'], 'disponible': True},
            {'nombre': 'Mbutuco', 'precio': 22000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción individual', 'precio': 22000}, {'nombre': 'Familiar', 'precio': 55000}
            ], 'imagen': imagenes['sancocho'], 'disponible': True},
            {'nombre': 'Chipa', 'precio': 5000, 'categoria': 'entrada', 'variantes': [
                {'nombre': 'Unidad', 'precio': 500}, {'nombre': 'Docena', 'precio': 5000}, {'nombre': '25 unidades', 'precio': 10000}
            ], 'imagen': imagenes['tortilla'], 'disponible': True},
            {'nombre': 'Empanada de Carne', 'precio': 3500, 'categoria': 'entrada', 'variantes': [
                {'nombre': 'Unidad', 'precio': 3500}, {'nombre': 'Docena', 'precio': 35000}
            ], 'imagen': imagenes['empanada'], 'disponible': True},
            {'nombre': 'Empanada de Queso', 'precio': 3000, 'categoria': 'entrada', 'variantes': [
                {'nombre': 'Unidad', 'precio': 3000}, {'nombre': 'Docena', 'precio': 30000}
            ], 'imagen': imagenes['empanada'], 'disponible': True},
            
            # PASTAS
            {'nombre': 'Spaghetti Bolognese', 'precio': 22000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Normal', 'precio': 22000}, {'nombre': 'Con pollo', 'precio': 27000}
            ], 'imagen': imagenes['pasta'], 'disponible': True},
            {'nombre': 'Lasagna', 'precio': 28000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción', 'precio': 14000}, {'nombre': 'Familiar', 'precio': 45000}
            ], 'imagen': imagenes['pasta'], 'disponible': True},
            {'nombre': 'Ravioles', 'precio': 24000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Con salsa', 'precio': 24000}, {'nombre': 'Con relleno especial', 'precio': 28000}
            ], 'imagen': imagenes['pasta'], 'disponible': True},
            
            # BEBIDAS ALCOHÓLICAS
            {'nombre': 'Cerveza Nacional', 'precio': 8000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Botella 330ml', 'precio': 6000}, {'nombre': 'Botella 500ml', 'precio': 8000}, {'nombre': 'Litro', 'precio': 15000}
            ], 'imagen': imagenes['cerveza'], 'disponible': True},
            {'nombre': 'Cerveza Importada', 'precio': 12000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Botella 330ml', 'precio': 10000}, {'nombre': 'Botella 500ml', 'precio': 12000}
            ], 'imagen': imagenes['cerveza'], 'disponible': True},
            {'nombre': 'Chicha Paraguaya', 'precio': 6000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Vaso 300ml', 'precio': 4000}, {'nombre': 'Jarra 1L', 'precio': 12000}
            ], 'imagen': imagenes['chicha'], 'disponible': True},
            {'nombre': 'Tereré', 'precio': 5000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Vaso', 'precio': 3000}, {'nombre': 'Jarra', 'precio': 8000}
            ], 'imagen': imagenes['jugo'], 'disponible': True},
            
            # BEBIDAS NO ALCOHÓLICAS
            {'nombre': 'Refresco', 'precio': 4000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Vaso', 'precio': 3000}, {'nombre': 'Botella 500ml', 'precio': 5000}, {'nombre': 'Botella 1L', 'precio': 8000}
            ], 'imagen': imagenes['refresco'], 'disponible': True},
            {'nombre': 'Jugo Natural', 'precio': 6000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Vaso', 'precio': 5000}, {'nombre': 'Jarra', 'precio': 15000}
            ], 'imagen': imagenes['jugo'], 'disponible': True},
            {'nombre': 'Agua Mineral', 'precio': 3000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Botella 500ml', 'precio': 3000}, {'nombre': 'Botella 1L', 'precio': 5000}
            ], 'imagen': imagenes['agua'], 'disponible': True},
            {'nombre': 'Café', 'precio': 5000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Expresso', 'precio': 3500}, {'nombre': 'Americano', 'precio': 5000}, {'nombre': 'Con leche', 'precio': 6000}
            ], 'imagen': imagenes['cafe'], 'disponible': True},
            {'nombre': 'Batido', 'precio': 8000, 'categoria': 'bebidas', 'variantes': [
                {'nombre': 'Leche con cocoa', 'precio': 7000}, {'nombre': 'Leche con plátano', 'precio': 8000}, {'nombre': 'Leche con fresa', 'precio': 8000}
            ], 'imagen': imagenes['helado'], 'disponible': True},
            
            # ENSALADAS
            {'nombre': 'Ensalada Mixta', 'precio': 12000, 'categoria': 'ensaladas', 'variantes': [
                {'nombre': 'Normal', 'precio': 12000}, {'nombre': 'Con pollo', 'precio': 16000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            {'nombre': 'Ensalada César', 'precio': 15000, 'categoria': 'ensaladas', 'variantes': [
                {'nombre': 'Normal', 'precio': 15000}, {'nombre': 'Con pollo', 'precio': 19000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            
            # ENTRADAS
            {'nombre': 'Alitas BBQ', 'precio': 18000, 'categoria': 'entrada', 'variantes': [
                {'nombre': '6 unidades', 'precio': 12000}, {'nombre': '12 unidades', 'precio': 18000}, {'nombre': '20 unidades', 'precio': 28000}
            ], 'imagen': imagenes['pollo'], 'disponible': True},
            {'nombre': 'Nachos con Queso', 'precio': 14000, 'categoria': 'entrada', 'variantes': [
                {'nombre': 'Porción pequeña', 'precio': 10000}, {'nombre': 'Porción grande', 'precio': 18000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            {'nombre': 'Papas Fritas', 'precio': 8000, 'categoria': 'entrada', 'variantes': [
                {'nombre': 'Porción pequeña', 'precio': 5000}, {'nombre': 'Porción mediana', 'precio': 8000}, {'nombre': 'Porción grande', 'precio': 12000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            
            # POSTRES
            {'nombre': 'Flan', 'precio': 8000, 'categoria': 'postres', 'variantes': [
                {'nombre': 'Normal', 'precio': 8000}, {'nombre': 'Con dulce de leche', 'precio': 10000}
            ], 'imagen': imagenes['postre'], 'disponible': True},
            {'nombre': 'Helado', 'precio': 6000, 'categoria': 'postres', 'variantes': [
                {'nombre': 'Bola', 'precio': 4000}, {'nombre': '3 bolas', 'precio': 10000}, {'nombre': '1/2 Litro', 'precio': 15000}
            ], 'imagen': imagenes['helado'], 'disponible': True},
            {'nombre': 'Brownie', 'precio': 10000, 'categoria': 'postres', 'variantes': [
                {'nombre': 'Porción', 'precio': 10000}, {'nombre': 'Con helado', 'precio': 14000}
            ], 'imagen': imagenes['postre'], 'disponible': True},
            {'nombre': 'Tiramisú', 'precio': 12000, 'categoria': 'postres', 'variantes': [
                {'nombre': 'Porción', 'precio': 12000}
            ], 'imagen': imagenes['postre'], 'disponible': True},
            {'nombre': 'Alfajores', 'precio': 3000, 'categoria': 'postres', 'variantes': [
                {'nombre': 'Unidad', 'precio': 3000}, {'nombre': 'Pack de 6', 'precio': 15000}, {'nombre': 'Pack de 12', 'precio': 25000}
            ], 'imagen': imagenes['postre'], 'disponible': True},
            
            # COMIDA RÁPIDA ADICIONAL
            {'nombre': 'Tacos', 'precio': 15000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': '3 tacos', 'precio': 12000}, {'nombre': '5 tacos', 'precio': 18000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            {'nombre': 'Burrito', 'precio': 18000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Pollo', 'precio': 16000}, {'nombre': 'Carne', 'precio': 18000}, {'nombre': 'Mixto', 'precio': 20000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            {'nombre': 'Sandwich', 'precio': 10000, 'categoria': 'comida_rapida', 'variantes': [
                {'nombre': 'Pollo', 'precio': 10000}, {'nombre': 'Jamón y queso', 'precio': 9000}, {'nombre': 'Vegetariano', 'precio': 11000}
            ], 'imagen': imagenes['salteado'], 'disponible': True},
            {'nombre': 'Panes de Agua', 'precio': 25000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Docena', 'precio': 25000}, {'nombre': '20 unidades', 'precio': 40000}
            ], 'imagen': imagenes['tortilla'], 'disponible': True},
            
            # PLATOS ESPECIALES
            {'nombre': 'Pescado Frito', 'precio': 28000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción', 'precio': 28000}
            ], 'imagen': imagenes['lomito'], 'available': True},
            {'nombre': 'Carne a la Parrilla', 'precio': 35000, 'categoria': 'platos', 'variantes': [
                {'nombre': 'Porción individual', 'precio': 35000}, {'nombre': 'Parrillada para 2', 'precio': 60000}
            ], 'imagen': imagenes['lomito'], 'disponible': True},
            {'nombre': 'Pollo a la Brasa', 'precio': 22000, 'categoria': 'platos', 'variantes': [
                {'nombre': '1/2 Pollo', 'precio': 15000}, {'nombre': 'Pollo entero', 'precio': 28000}
            ], 'imagen': imagenes['pollo'], 'disponible': True},
        ]

        self.stdout.write('\n--- Cargando productos con variantes e imagenes ---\n')

        for i, prod in enumerate(productos_data):
            nombre = prod['nombre']
            existe = Producto.objects.filter(nombre=nombre).exists()
            if existe:
                self.stdout.write(f'  [SKIP] {nombre} - Ya existe')
                continue

            categoria_nom = prod.get('categoria', 'platos')
            cat = Categoria.objects.filter(nombre__icontains=categoria_nom).first()
            if not cat:
                cat, _ = Categoria.objects.get_or_create(
                    nombre=categoria_nom.capitalize(),
                    defaults={'icono': 'category', 'orden': 10}
                )

            Producto.objects.create(
                nombre=nombre,
                descripcion=f'Delicioso {nombre} listo para servir',
                precio=prod['precio'],
                categoria=cat,
                disponible=prod.get('disponible', True),
                imagen=prod.get('imagen', ''),
                variantes=prod.get('variantes', [])
            )
            
            indicador = '[OK]' if (i + 1) % 5 == 0 else '[+]'
            self.stdout.write(f'  {indicador} {nombre} - ${prod["precio"]:,}')

        total = Producto.objects.count()
        self.stdout.write(f'\n*** Total de productos: {total} ***')
        self.stdout.write('*** Productos cargados exitosamente! ***\n')