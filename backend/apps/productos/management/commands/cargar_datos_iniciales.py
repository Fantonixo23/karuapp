from django.core.management.base import BaseCommand
from apps.productos.models import Categoria, Producto
from apps.mesas.models import Mesa
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Carga datos iniciales para el restaurant'

    def handle(self, *args, **options):
        self.stdout.write('Cargando datos iniciales...')
        
        # 1. Crear usuario admin si no existe
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(
                username='admin',
                email='admin@pipperfood.com',
                password='admin123'
            )
            self.stdout.write(self.style.SUCCESS('[OK] Usuario admin creado'))
        else:
            self.stdout.write('[INFO] Usuario admin ya existe')

        # 2. Crear categorías
        categorias_data = [
            ('Hamburguesas', 'hamburger'),
            ('Hot Dogs', 'hotdog'),
            ('Lomitos', 'lunch_dining'),
            ('Sandwiches', 'breakfast_dining'),
            ('Milanesas', 'restaurant'),
            ('Parrillada', 'outdoor_grill'),
            ('Empanadas', 'food_bank'),
            ('Bebidas', 'local_bar'),
            ('Postres', 'cake'),
            ('Guarniciones', 'egg_alt'),
        ]
        
        categorias = {}
        for nombre, icono in categorias_data:
            cat, created = Categoria.objects.get_or_create(
                nombre=nombre,
                defaults={'icono': icono}
            )
            categorias[nombre] = cat
            if created:
                self.stdout.write(f'[OK] Categoria: {nombre}')
        
        # 3. Crear productos
        productos_data = [
            # Hamburguesas
            ('Hamburguesa Simple', 25000, 'hamburguesa', categorias['Hamburguesas']),
            ('Hamburguesa Doble', 35000, 'hamburguesa', categorias['Hamburguesas']),
            ('Hamburguesa Especial', 45000, 'hamburguesa', categorias['Hamburguesas']),
            ('Hamburguesa Pollo', 28000, 'hamburguesa', categorias['Hamburguesas']),
            ('Hamburguesa Vegetariana', 30000, 'hamburguesa', categorias['Hamburguesas']),
            
            # Hot Dogs
            ('Hot Dog Simple', 15000, 'hotdog', categorias['Hot Dogs']),
            ('Hot Dog Completo', 25000, 'hotdog', categorias['Hot Dogs']),
            ('Hot Dog Especial', 30000, 'hotdog', categorias['Hot Dogs']),
            ('Hot Dog Chileno', 28000, 'hotdog', categorias['Hot Dogs']),
            
            # Lomitos
            ('Lomito Simple', 30000, 'lomito', categorias['Lomitos']),
            ('Lomito Completo', 40000, 'lomito', categorias['Lomitos']),
            ('Lomito Especial', 48000, 'lomito', categorias['Lomitos']),
            ('Lomito Pollo', 32000, 'lomito', categorias['Lomitos']),
            
            # Sandwiches
            ('Sandwich de Milanesa', 32000, 'sandwich', categorias['Sandwiches']),
            ('Sandwich Jamón y Queso', 25000, 'sandwich', categorias['Sandwiches']),
            ('Sandwich de Huevo', 20000, 'sandwich', categorias['Sandwiches']),
            ('Sandwich Veggie', 28000, 'sandwich', categorias['Sandwiches']),
            
            # Milanesas
            ('Milanesa de Res', 35000, 'milanesa', categorias['Milanesas']),
            ('Milanesa de Pollo', 32000, 'milanesa', categorias['Milanesas']),
            ('Milanesa Napolitana', 42000, 'milanesa', categorias['Milanesas']),
            ('Milanesa Suprema', 48000, 'milanesa', categorias['Milanesas']),
            
            # Parrillada
            ('Parrillada Individual', 55000, 'parrillada', categorias['Parrillada']),
            ('Parrillada Pareja', 100000, 'parrillada', categorias['Parrillada']),
            ('Parrillada Familiar', 180000, 'parrillada', categorias['Parrillada']),
            
            # Empanadas
            ('Empanada de Carne', 8000, 'empanada', categorias['Empanadas']),
            ('Empanada de Pollo', 8000, 'empanada', categorias['Empanadas']),
            ('Empanada de Queso', 7000, 'empanada', categorias['Empanadas']),
            ('Empanada Jamón y Queso', 9000, 'empanada', categorias['Empanadas']),
            ('Empanada de Verdura', 7000, 'empanada', categorias['Empanadas']),
            
            # Bebidas
            ('Coca Cola 500ml', 8000, 'bebida', categorias['Bebidas']),
            ('Coca Cola 1.5L', 15000, 'bebida', categorias['Bebidas']),
            ('Pepsi 500ml', 7000, 'bebida', categorias['Bebidas']),
            ('Agua Mineral 500ml', 5000, 'bebida', categorias['Bebidas']),
            ('Cerveza Botella', 15000, 'bebida', categorias['Bebidas']),
            ('Jugo Natural', 12000, 'bebida', categorias['Bebidas']),
            ('Tereré', 10000, 'bebida', categorias['Bebidas']),
            
            # Postres
            ('Flan con Dulce', 12000, 'postre', categorias['Postres']),
            ('Helado 3 Bolas', 15000, 'postre', categorias['Postres']),
            ('Mazamorra', 8000, 'postre', categorias['Postres']),
            ('Pastel de Papa', 10000, 'postre', categorias['Postres']),
            
            # Guarniciones
            ('Papas Fritas', 12000, 'guarnicion', categorias['Guarniciones']),
            ('Papas Rusas', 15000, 'guarnicion', categorias['Guarniciones']),
            ('Arroz', 8000, 'guarnicion', categorias['Guarniciones']),
            ('Ensalada Mixta', 10000, 'guarnicion', categorias['Guarniciones']),
            ('Ensalada Rusa', 12000, 'guarnicion', categorias['Guarniciones']),
        ]
        
        for nombre, precio, imagen, categoria in productos_data:
            prod, created = Producto.objects.get_or_create(
                nombre=nombre,
                defaults={
                    'descripcion': f'{nombre} delicioso',
                    'precio': precio,
                    'categoria': categoria,
                    'disponible': True,
                    'imagen': f'productos/{imagen}.jpg'
                }
            )
        
        self.stdout.write(self.style.SUCCESS(f'[OK] {len(productos_data)} productos creados'))
        
        # 4. Crear 20 mesas
        areas = ['Salon Principal', 'Terraza', 'Bar', 'VIP']
        mesas_count = 0
        
        for i in range(1, 21):
            area = areas[i % len(areas)]
            Mesa.objects.get_or_create(
                numero=i,
                defaults={
                    'area': area,
                    'comensales': 4,
                    'estado': 'libre'
                }
            )
            mesas_count += 1
        
        self.stdout.write(self.style.SUCCESS(f'[OK] {mesas_count} mesas creadas'))
        
        self.stdout.write(self.style.SUCCESS('\n=== DATOS CARGADOS EXITOSAMENTE ==='))
        self.stdout.write('Usuario: admin')
        self.stdout.write('Contrasena: admin123')
        self.stdout.write('Mesas: 20')
        self.stdout.write('Productos: 46')