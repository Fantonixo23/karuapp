from django.db import transaction
from django.db.models import Count, F, Sum, Value, FloatField
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
import json
from apps.usuarios.decorators import requiere_autenticacion
from pipperfood.middleware import _scope, _scope_get, _get_restaurante
from apps.inventario.models import Inventario, MovimientoInventario
from apps.productos.models import Producto


@require_http_methods(["GET"])
@requiere_autenticacion
def lista_inventario(request):
    """Lista todo el inventario"""
    estado = request.GET.get('estado')
    categoria_id = request.GET.get('categoria')

    inventarios = _scope(request, Inventario.objects.select_related('producto', 'producto__categoria'))

    if estado:
        if estado == 'bajo':
            inventarios = inventarios.filter(stock_actual__lte=F('stock_minimo'), stock_actual__gt=0)
        elif estado == 'agotado':
            inventarios = inventarios.filter(stock_actual=0)
        elif estado == 'normal':
            inventarios = inventarios.filter(stock_actual__gt=F('stock_minimo'))

    if categoria_id:
        inventarios = inventarios.filter(producto__categoria_id=categoria_id)

    data = []
    for inv in inventarios:
        data.append({
            'id': inv.id,
            'producto_id': inv.producto.id,
            'producto_nombre': inv.producto.nombre,
            'categoria': inv.producto.categoria.nombre if inv.producto.categoria else 'Sin categoría',
            'stock_actual': inv.stock_actual,
            'stock_minimo': inv.stock_minimo,
            'unidad_medida': inv.unidad_medida,
            'precio_costo': float(inv.precio_costo),
            'estado_stock': inv.estado_stock,
            'fecha_actualizacion': inv.fecha_actualizacion.isoformat() if inv.fecha_actualizacion else None
        })

    return JsonResponse({'success': True, 'data': data})


@require_http_methods(["GET"])
@requiere_autenticacion
def detalle_producto_inventario(request, producto_id):
    """Detalle del inventario de un producto"""
    try:
        inv = _scope(request, Inventario.objects.select_related('producto')).get(producto_id=producto_id)

        movimientos = inv.movimientos.all()[:20]
        movimientos_data = []
        for m in movimientos:
            movimientos_data.append({
                'id': m.id,
                'tipo': m.tipo,
                'cantidad': m.cantidad,
                'motivo': m.motivo,
                'notas': m.notas,
                'created_at': m.created_at.isoformat() if m.created_at else None
            })

        return JsonResponse({
            'success': True,
            'data': {
                'id': inv.id,
                'producto_id': inv.producto.id,
                'producto_nombre': inv.producto.nombre,
                'stock_actual': inv.stock_actual,
                'stock_minimo': inv.stock_minimo,
                'unidad_medida': inv.unidad_medida,
                'precio_costo': float(inv.precio_costo),
                'estado_stock': inv.estado_stock,
                'movimientos': movimientos_data
            }
        })
    except Inventario.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Producto no encontrado en inventario'}, status=404)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def crear_movimiento(request):
    """Crear un movimiento de inventario (entrada/salida)"""
    try:
        data = json.loads(request.body)
        producto_id = data.get('producto_id')
        tipo = data.get('tipo')
        cantidad = int(data.get('cantidad', 0))
        motivo = data.get('motivo', '')
        notas = data.get('notas', '')

        if not producto_id or not tipo or cantidad <= 0:
            return JsonResponse({'success': False, 'error': 'Faltan datos requeridos'}, status=400)

        if tipo not in ['entrada', 'salida', 'ajuste']:
            return JsonResponse({'success': False, 'error': 'Tipo de movimiento inválido'}, status=400)

        with transaction.atomic():
            inv = Inventario.objects.select_for_update().filter(producto_id=producto_id).first()
            if not inv:
                inv = Inventario.objects.create(
                    producto_id=producto_id,
                    stock_actual=100,
                    stock_minimo=5,
                    unidad_medida='und',
                    precio_costo=0
                )

            if tipo == 'entrada':
                inv.stock_actual += cantidad
            elif tipo == 'salida':
                if inv.stock_actual < cantidad:
                    return JsonResponse({'success': False, 'error': 'Stock insuficiente'}, status=400)
                inv.stock_actual -= cantidad
            else:
                inv.stock_actual = cantidad

            inv.save()

            MovimientoInventario.objects.create(
                restaurante=_get_restaurante(request),
                inventario=inv,
                tipo=tipo,
                cantidad=cantidad,
                motivo=motivo,
                notas=notas
            )

        return JsonResponse({
            'success': True,
            'data': {
                'stock_actual': inv.stock_actual,
                'estado_stock': inv.estado_stock
            }
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def actualizar_inventario(request):
    """Actualizar inventario directamente (stock, mínimo, precio costo)"""
    try:
        data = json.loads(request.body)
        producto_id = data.get('producto_id')
        stock_actual = data.get('stock_actual')
        stock_minimo = data.get('stock_minimo')
        unidad_medida = data.get('unidad_medida')
        precio_costo = data.get('precio_costo')

        if not producto_id:
            return JsonResponse({'success': False, 'error': 'producto_id requerido'}, status=400)

        with transaction.atomic():
            inv = _scope(request, Inventario.objects.select_for_update().filter(producto_id=producto_id)).first()
            if not inv:
                inv = Inventario.objects.create(
                    restaurante=_get_restaurante(request),
                    producto_id=producto_id,
                    stock_actual=100,
                    stock_minimo=5,
                    unidad_medida='und',
                    precio_costo=0
                )

            if stock_actual is not None:
                if stock_actual != inv.stock_actual:
                    diff = abs(stock_actual - inv.stock_actual)
                    MovimientoInventario.objects.create(
                        restaurante=_get_restaurante(request),
                        inventario=inv,
                        tipo='ajuste',
                        cantidad=diff,
                        motivo='Ajuste de inventario',
                        notas=f'Ajuste manual: {inv.stock_actual} -> {stock_actual}'
                    )
                inv.stock_actual = stock_actual

            if stock_minimo is not None:
                inv.stock_minimo = stock_minimo
            if unidad_medida:
                inv.unidad_medida = unidad_medida
            if precio_costo is not None:
                inv.precio_costo = precio_costo

            inv.save()

        return JsonResponse({
            'success': True,
            'data': {
                'id': inv.id,
                'stock_actual': inv.stock_actual,
                'stock_minimo': inv.stock_minimo,
                'estado_stock': inv.estado_stock
            }
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def alertas_inventario(request):
    """Productos con stock bajo o agotado"""
    inventarios = _scope(request, Inventario.objects.select_related('producto').filter(
        stock_actual__lte=F('stock_minimo')
    )).order_by('stock_actual')

    data = []
    for inv in inventarios:
        data.append({
            'id': inv.id,
            'producto_id': inv.producto.id,
            'producto_nombre': inv.producto.nombre,
            'stock_actual': inv.stock_actual,
            'stock_minimo': inv.stock_minimo,
            'estado_stock': inv.estado_stock
        })

    return JsonResponse({'success': True, 'data': data})


@require_http_methods(["GET"])
@requiere_autenticacion
def historial_movimientos(request):
    """Historial de movimientos de inventario"""
    limite = int(request.GET.get('limit', 50))
    offset = int(request.GET.get('offset', 0))

    movimientos = _scope(request, MovimientoInventario.objects.select_related(
        'inventario', 'inventario__producto'
    )).order_by('-created_at')

    total = movimientos.count()
    lista = movimientos[offset:offset+limite]

    data = []
    for m in lista:
        data.append({
            'id': m.id,
            'producto_nombre': m.inventario.producto.nombre,
            'tipo': m.tipo,
            'cantidad': m.cantidad,
            'stock_resultado': m.inventario.stock_actual,
            'motivo': m.motivo,
            'notas': m.notas,
            'created_at': m.created_at.isoformat() if m.created_at else None
        })

    return JsonResponse({'success': True, 'data': data, 'total': total})


@csrf_exempt
@require_http_methods(["DELETE"])
@requiere_autenticacion
def eliminar_inventario(request, inventario_id):
    """Elimina un item del inventario"""
    try:
        with transaction.atomic():
            inv = _scope(request, Inventario.objects.select_for_update()).get(id=inventario_id)
            inv.delete()
        return JsonResponse({'success': True, 'message': 'Item eliminado correctamente del inventario'})
    except Inventario.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Item no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def resumen_inventario(request):
    """Resumen del estado del inventario"""
    total_productos = _scope(request, Inventario.objects.all()).count()
    normal = _scope(request, Inventario.objects.filter(stock_actual__gt=F('stock_minimo'))).count()
    bajo = _scope(request, Inventario.objects.filter(stock_actual__lte=F('stock_minimo'), stock_actual__gt=0)).count()
    agotado = _scope(request, Inventario.objects.filter(stock_actual=0)).count()

    valor_inventario = _scope(request, Inventario.objects.all()).aggregate(
        valor=Coalesce(Sum(F('stock_actual') * F('precio_costo'), output_field=FloatField()), Value(0.0))
    )['valor']

    return JsonResponse({
        'success': True,
        'data': {
            'total_productos': total_productos,
            'normal': normal,
            'bajo': bajo,
            'agotado':agotado,
            'valor_inventario': valor_inventario
        }
    })