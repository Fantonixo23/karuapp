import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from apps.usuarios.decorators import requiere_autenticacion, requiere_rol
from pipperfood.middleware import _scope, _scope_get, _get_restaurante
from .models import Categoria, Producto


# ========== CATEGORÍAS ==========

@require_http_methods(["GET"])
def lista_categorias(request):
    """Lista todas las categorías"""
    categorias = _scope(request, Categoria.objects.all()).order_by('orden', 'nombre')
    data = [{
        'id': c.id,
        'nombre': c.nombre,
        'icono': c.icono,
        'orden': c.orden
    } for c in categorias]
    return JsonResponse({'success': True, 'categorias': data})


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def crear_categoria(request):
    """Crea una nueva categoría"""
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre')
        icono = data.get('icono', 'category')
        orden = data.get('orden', 0)
        
        if not nombre:
            return JsonResponse({
                'success': False,
                'error': 'El nombre es requerido'
            }, status=400)
        
        from pipperfood.middleware import _get_restaurante
        categoria = Categoria.objects.create(
            restaurante=_get_restaurante(request),
            nombre=nombre,
            icono=icono,
            orden=orden
        )
        
        return JsonResponse({
            'success': True,
            'categoria': {
                'id': categoria.id,
                'nombre': categoria.nombre,
                'icono': categoria.icono,
                'orden': categoria.orden
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["PUT"])
@requiere_autenticacion
def modificar_categoria(request, pk):
    """Modifica una categoría"""
    try:
        data = json.loads(request.body)
        try:
            categoria = _scope_get(request, Categoria, pk)
        except Categoria.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Categoría no encontrada'
            }, status=404)
        
        nombre = data.get('nombre')
        icono = data.get('icono')
        orden = data.get('orden')
        
        if nombre:
            categoria.nombre = nombre
        if icono:
            categoria.icono = icono
        if orden is not None:
            categoria.orden = orden
        
        categoria.save()
        
        return JsonResponse({
            'success': True,
            'categoria': {
                'id': categoria.id,
                'nombre': categoria.nombre,
                'icono': categoria.icono,
                'orden': categoria.orden
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
@requiere_autenticacion
def eliminar_categoria(request, pk):
    """Elimina una categoría"""
    try:
        categoria = _scope_get(request, Categoria, pk)
        categoria.delete()
        return JsonResponse({'success': True})
    except Categoria.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Categoría no encontrada'
        }, status=404)


# ========== PRODUCTOS ==========

@require_http_methods(["GET"])
def lista_productos(request):
    """Lista todos los productos"""
    categoria_id = request.GET.get('categoria_id')
    
    productos = _scope(request, Producto.objects.select_related('categoria').all())
    
    if categoria_id and categoria_id != '0':
        productos = productos.filter(categoria_id=categoria_id)
    
    data = []
    for p in productos:
        imagen_url = None
        if p.imagen:
            if str(p.imagen).startswith('http'):
                imagen_url = str(p.imagen)
            elif str(p.imagen).startswith('/media/'):
                imagen_url = str(p.imagen)
            else:
                imagen_url = '/media/' + str(p.imagen)
        
        imagen_archivo_url = None
        if p.imagen_archivo:
            try:
                imagen_archivo_url = p.imagen_archivo.url
            except Exception:
                pass
        
        data.append({
            'id': p.id,
            'nombre': p.nombre,
            'descripcion': p.descripcion,
            'precio': str(p.precio),
            'categoria_id': p.categoria_id,
            'categoria_nombre': p.categoria.nombre if p.categoria else None,
            'disponible': p.disponible,
            'iva': p.iva,
            'imagen': imagen_url or imagen_archivo_url,
            'imagen_archivo': imagen_archivo_url,
            'variantes': p.variantes
        })
    
    return JsonResponse({'success': True, 'productos': data})


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def crear_producto(request):
    """Crea un nuevo producto"""
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre')
        precio = data.get('precio', 0)
        descripcion = data.get('descripcion', '')
        categoria_id = data.get('categoria_id')
        disponible = data.get('disponible', True)
        variantes = data.get('variantes')
        
        if not nombre or not precio:
            return JsonResponse({
                'success': False,
                'error': 'Nombre y precio son requeridos'
            }, status=400)
        
        from pipperfood.middleware import _get_restaurante
        producto = Producto.objects.create(
            restaurante=_get_restaurante(request),
            nombre=nombre,
            descripcion=descripcion,
            precio=precio,
            categoria_id=categoria_id,
            disponible=disponible,
            iva=data.get('iva', 10),
            variantes=variantes,
            imagen=data.get('imagen', '')
        )
        
        # Auto-crear Inventario si no existe
        from apps.inventario.models import Inventario
        from pipperfood.middleware import _get_restaurante
        Inventario.objects.get_or_create(
            restaurante=_get_restaurante(request),
            producto=producto,
            defaults={'stock_actual': 100, 'stock_minimo': 5, 'unidad_medida': 'und', 'precio_costo': 0}
        )
        
        return JsonResponse({
            'success': True,
            'producto': {
                'id': producto.id,
                'nombre': producto.nombre,
                'precio': str(producto.precio),
                'disponible': producto.disponible
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["PUT"])
@requiere_autenticacion
def modificar_producto(request, pk):
    """Modifica un producto"""
    try:
        data = json.loads(request.body)
        try:
            producto = _scope_get(request, Producto, pk)
        except Producto.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Producto no encontrado'
            }, status=404)
        
        producto.nombre = data.get('nombre', producto.nombre)
        producto.descripcion = data.get('descripcion', producto.descripcion)
        producto.precio = data.get('precio', producto.precio)
        producto.categoria_id = data.get('categoria_id', producto.categoria_id)
        producto.disponible = data.get('disponible', producto.disponible)
        producto.iva = data.get('iva', producto.iva)
        producto.imagen = data.get('imagen', producto.imagen)
        producto.variantes = data.get('variantes', producto.variantes)
        
        producto.save()
        
        return JsonResponse({
            'success': True,
            'producto': {
                'id': producto.id,
                'nombre': producto.nombre,
                'precio': str(producto.precio),
                'disponible': producto.disponible
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
@requiere_autenticacion
def eliminar_producto(request, pk):
    """Elimina un producto"""
    try:
        producto = _scope_get(request, Producto, pk)
        producto.delete()
        return JsonResponse({'success': True})
    except Producto.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Producto no encontrado'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Error al eliminar: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
@requiere_rol('administrador')
def limpiar_productos(request):
    """Elimina todos los productos, inventario y movimientos"""
    try:
        from apps.inventario.models import Inventario, MovimientoInventario
        
        from pipperfood.middleware import _scope
        MovimientoInventario.objects.filter(restaurante=_get_restaurante(request)).delete()
        Inventario.objects.filter(restaurante=_get_restaurante(request)).delete()
        Producto.objects.filter(restaurante=_get_restaurante(request)).delete()
        Categoria.objects.filter(restaurante=_get_restaurante(request)).delete()
        
        return JsonResponse({'success': True, 'message': 'Todos los productos e inventario fueron eliminados'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def subir_imagen(request):
    """Sube una imagen para un producto"""
    try:
        if 'imagen' not in request.FILES:
            return JsonResponse({'success': False, 'error': 'No se envió ninguna imagen'}, status=400)
        
        archivo = request.FILES['imagen']
        import uuid
        ext = archivo.name.split('.')[-1] if '.' in archivo.name else 'jpg'
        nombre_archivo = f'productos/{uuid.uuid4().hex}.{ext}'
        
        content_type = getattr(archivo, 'content_type', None) or 'application/octet-stream'
        data = archivo.read()

        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        if bucket_name:
            import requests as req
            service_key = settings.AWS_SECRET_ACCESS_KEY
            project_url = settings.AWS_S3_ENDPOINT_URL.replace('/storage/v1/s3', '')
            upload_url = f'{project_url}/storage/v1/object/{bucket_name}/{nombre_archivo}'
            r = req.post(
                upload_url,
                headers={
                    'Authorization': f'Bearer {service_key}',
                    'Content-Type': content_type,
                },
                data=data,
            )
            if r.status_code not in (200, 201):
                return JsonResponse({'success': False, 'error': f'Error al subir imagen: {r.text}'}, status=500)
            url = f'{project_url}/storage/v1/object/public/{bucket_name}/{nombre_archivo}'
        else:
            from django.core.files.storage import default_storage
            from django.core.files.base import ContentFile
            ruta_guardada = default_storage.save(nombre_archivo, ContentFile(data))
            url = f'{settings.MEDIA_URL}{ruta_guardada}'
        
        return JsonResponse({
            'success': True,
            'url': url,
            'ruta': nombre_archivo,
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def toggle_producto(request, pk):
    """Alterna la disponibilidad de un producto"""
    try:
        producto = _scope_get(request, Producto, pk)
        producto.disponible = not producto.disponible
        producto.save()
        
        return JsonResponse({
            'success': True,
            'producto': {
                'id': producto.id,
                'disponible': producto.disponible
            }
        })
    except Producto.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Producto no encontrado'
        }, status=404)