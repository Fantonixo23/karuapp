from django.core.management.base import BaseCommand
from apps.productos.models import Producto


class Command(BaseCommand):
    help = 'Actualiza las imágenes de productos con URLs correctas'

    def handle(self, *args, **options):
        imagenes = {
            'coca': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80',
            'pepsi': 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80',
            'agua': 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400&q=80',
            'jugo': 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&q=80',
            'cerveza': 'https://images.unsplash.com/photo-1535958636474-b021ee8876a3?w=400&q=80',
            'tereré': 'https://images.unsplash.com/photo-1545912452-8efe9d8e3f25?w=400&q=80',
            
            'hamburguesa': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
            
            'empanada': 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80',
            
            'hot dog': 'https://images.unsplash.com/photo-VNcWRWZn4Dw?w=400&q=80',
            
            'lomito': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&q=80',
            
            'milanesa': 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&q=80',
            
            'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
            
            'helado': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68b?w=400&q=80',
            
            'flan': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80',
            
            'mazamorra': 'https://images.unsplash.com/photo-1609630875171-b1321377ee53?w=400&q=80',
            
            'ensalada mixta': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80',
            'ensalada rusa': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&q=80',
            
            'papas fritas': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80',
            'papas': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&q=80',
            
            'arroz': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400&q=80',
            
            'pastel de papa': 'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=400&q=80',
            
            'parrillada': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80',
        }

        default_image = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80'

        productos = Producto.objects.all()
        actualizados = 0

        for producto in productos:
            nombre_lower = producto.nombre.lower()
            imagen_encontrada = None

            for clave, url in imagenes.items():
                if clave in nombre_lower:
                    imagen_encontrada = url
                    break

            if not imagen_encontrada:
                imagen_encontrada = default_image

            producto.imagen = imagen_encontrada
            producto.save()
            actualizados += 1
            self.stdout.write(f'  [OK] {producto.nombre}')

        self.stdout.write(self.style.SUCCESS(f'\n*** {actualizados} productos actualizados ***'))