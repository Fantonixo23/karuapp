import json
import logging
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import models, transaction
from django.utils import timezone
from datetime import timedelta
from apps.usuarios.decorators import requiere_autenticacion, requiere_rol
from .models import Pedido, Impresion, transicion_valida
from apps.usuarios.models import Usuario
from apps.mesas.models import Mesa
from apps.caja.models import CajaSession, MovimientoCaja
from pipperfood.middleware import _scope, _scope_get, _get_restaurante

logger = logging.getLogger(__name__)
from apps.productos.models import Producto


MAX_IMPRESIONES = 3

# Metodos de pago validos para MovimientoCaja
METODOS_PAGO_VALIDOS = {'efectivo', 'tarjeta', 'transferencia', 'qr', 'mixto'}
METODOS_PAGO_MAP = {
    'credito': 'tarjeta', 'debito': 'tarjeta', 'credito_debito': 'tarjeta',
    'visa': 'tarjeta', 'mastercard': 'tarjeta', 'cabal': 'tarjeta',
    'american_express': 'tarjeta', 'amex': 'tarjeta', 'maestro': 'tarjeta',
    'tigo_money': 'qr', 'personal_pay': 'qr', 'bancard_qr': 'qr',
    'bancard': 'qr', 'zimple': 'qr',
    'transferencia_bancaria': 'transferencia', 'transf': 'transferencia',
    'tarjeta_debito': 'tarjeta', 'tarjeta_credito': 'tarjeta',
    'posnet': 'tarjeta', 'infonet': 'tarjeta',
    'pago_movil': 'transferencia', 'giro': 'transferencia',
}


def normalizar_metodo_pago(metodo):
    if not metodo:
        return 'efectivo'
    metodo = metodo.lower().strip()
    if metodo in METODOS_PAGO_VALIDOS:
        return metodo
    return METODOS_PAGO_MAP.get(metodo, 'efectivo')


def verificar_inventario(request, items):
    """Verifica stock disponible sin descontar"""
    from apps.inventario.models import Inventario

    for item in items:
        producto_id = item.get('producto_id')
        cantidad = item.get('cantidad', 1)

        if not producto_id:
            continue

        inventario = _scope(request, Inventario.objects.filter(producto_id=producto_id)).first()
        if inventario and inventario.stock_actual < cantidad:
            from apps.productos.models import Producto
            producto = _scope(request, Producto.objects.filter(pk=producto_id)).first()
            nombre = producto.nombre if producto else f'ID {producto_id}'
            raise Exception(f'Stock insuficiente para {nombre} (disponible: {inventario.stock_actual}, requerido: {cantidad})')

        variante_nombre = item.get('variante')
        if variante_nombre:
            from apps.productos.models import Producto
            producto = _scope(request, Producto.objects.filter(pk=producto_id)).first()
            if producto and producto.variantes:
                variantes = producto.variantes
                if isinstance(variantes, list):
                    for v in variantes:
                        if isinstance(v, dict) and v.get('nombre') == variante_nombre:
                            inv_producto_id = v.get('inventario_producto_id')
                            if inv_producto_id:
                                inv_variante = _scope(request, Inventario.objects.filter(producto_id=inv_producto_id)).first()
                                if inv_variante and inv_variante.stock_actual < cantidad:
                                    raise Exception(f'Stock insuficiente para variante {variante_nombre} (disponible: {inv_variante.stock_actual})')


def descontar_inventario(request, items):
    """Descuenta stock del inventario (al pagar)"""
    from apps.inventario.models import Inventario, MovimientoInventario
    
    for item in items:
        producto_id = item.get('producto_id')
        cantidad = item.get('cantidad', 1)
        variante_nombre = item.get('variante')
        
        if not producto_id:
            continue
        
        # Descontar del inventario del producto principal
        inventario = _scope(request, Inventario.objects.select_for_update().filter(producto_id=producto_id)).first()
        if inventario:
            if inventario.stock_actual < cantidad:
                raise Exception(f'Stock insuficiente para {inventario.producto.nombre}')
            inventario.stock_actual -= cantidad
            inventario.save()
            
            MovimientoInventario.objects.create(
                restaurante=_get_restaurante(request),
                inventario=inventario,
                tipo='salida',
                cantidad=cantidad,
                motivo='venta',
                notas=f'Venta - Pedido'
            )
        
        # Descontar del inventario de la variante si tiene inventario vinculado
        if variante_nombre:
            from apps.productos.models import Producto
            producto = _scope(request, Producto.objects.filter(pk=producto_id)).first()
            if producto and producto.variantes:
                variantes = producto.variantes
                if isinstance(variantes, list):
                    for v in variantes:
                        if isinstance(v, dict) and v.get('nombre') == variante_nombre:
                            inv_producto_id = v.get('inventario_producto_id')
                            if inv_producto_id:
                                inv_variante = _scope(request, Inventario.objects.select_for_update().filter(producto_id=inv_producto_id)).first()
                                if inv_variante:
                                    if inv_variante.stock_actual < cantidad:
                                        raise Exception(f'Stock insuficiente para variante {variante_nombre}')
                                    inv_variante.stock_actual -= cantidad
                                    inv_variante.save()
                                    
                                    MovimientoInventario.objects.create(
                                        restaurante=_get_restaurante(request),
                                        inventario=inv_variante,
                                        tipo='salida',
                                        cantidad=cantidad,
                                        motivo='venta',
                                        notas=f'Venta - Variante: {variante_nombre}'
                                    )

def reponer_inventario(request, items):
    """Repone stock del inventario al cancelar un pedido o revertir cambios"""
    from apps.inventario.models import Inventario, MovimientoInventario
    
    for item in items:
        producto_id = item.get('producto_id')
        cantidad = item.get('cantidad', 1)
        variante_nombre = item.get('variante')
        
        if not producto_id:
            continue
        
        inventario = _scope(request, Inventario.objects.select_for_update().filter(producto_id=producto_id)).first()
        if inventario:
            inventario.stock_actual += cantidad
            inventario.save()
            
            MovimientoInventario.objects.create(
                restaurante=_get_restaurante(request),
                inventario=inventario,
                tipo='entrada',
                cantidad=cantidad,
                motivo='devolucion',
                notas=f'Devolucion - Cancelacion/Modificacion'
            )
        
        if variante_nombre:
            from apps.productos.models import Producto
            producto = _scope(request, Producto.objects.filter(pk=producto_id)).first()
            if producto and producto.variantes:
                variantes = producto.variantes
                if isinstance(variantes, list):
                    for v in variantes:
                        if isinstance(v, dict) and v.get('nombre') == variante_nombre:
                            inv_producto_id = v.get('inventario_producto_id')
                            if inv_producto_id:
                                inv_variante = _scope(request, Inventario.objects.select_for_update().filter(producto_id=inv_producto_id)).first()
                                if inv_variante:
                                    inv_variante.stock_actual += cantidad
                                    inv_variante.save()
                                    
                                    MovimientoInventario.objects.create(
                                        restaurante=_get_restaurante(request),
                                        inventario=inv_variante,
                                        tipo='entrada',
                                        cantidad=cantidad,
                                        motivo='devolucion',
                                        notas=f'Devolucion - Cancelacion/Modificacion Variante: {variante_nombre}'
                                    )

def puede_imprimir(pedido, tipo='factura'):
    """Verifica si se puede imprimir (mÃ¡x 3 veces por tipo)"""
    contador = Impresion.objects.filter(pedido=pedido, tipo=tipo).count()
    return contador < MAX_IMPRESIONES

def registrar_impresion(request, pedido, tipo='factura', usuario=None):
    """Registra una nueva impresiÃ³n"""
    if not puede_imprimir(pedido, tipo):
        return None
    return Impresion.objects.create(restaurante=_get_restaurante(request), pedido=pedido, tipo=tipo, usuario=usuario)

def obtener_contador_impresiones(pedido, tipo='factura'):
    """Obtiene el contador de impresiones"""
    return Impresion.objects.filter(pedido=pedido, tipo=tipo).count()


@require_http_methods(["GET"])
@requiere_autenticacion
def lista_pedidos(request):
    """Lista todos los pedidos"""
    estado = request.GET.get('estado')
    solo_delivery = request.GET.get('delivery')
    
    pedidos = _scope(request, Pedido.objects.select_related('mesa', 'mesero').all())
    
    if estado:
        pedidos = pedidos.filter(estado=estado)
    if solo_delivery:
        pedidos = pedidos.filter(delivery=True)
    
    data = [{
        'id': p.id,
        'numero_orden': p.numero_orden,
        'mesa_id': p.mesa_id,
        'mesa_numero': p.mesa.numero if p.mesa else None,
        'mesero_id': p.mesero_id,
        'mesero_nombre': p.mesero.nombre if p.mesero else None,
        'estado': p.estado,
        'delivery': p.delivery,
        'nombre_cliente': p.nombre_cliente,
        'telefono_cliente': p.telefono_cliente,
        'direccion': p.direccion,
        'notas': p.notas,
        'items': p.items,
        'total': str(p.total),
        'metodo_pago': p.metodo_pago,
        'sincronizado': p.sincronizado,
        'created_at': p.created_at.isoformat() if p.created_at else None
    } for p in pedidos]
    
    return JsonResponse({'success': True, 'pedidos': data})


@require_http_methods(["GET"])
@requiere_autenticacion
def dashboard_delivery(request):
    """Dashboard con estadÃ­sticas de delivery"""
    from datetime import timedelta
    from django.utils import timezone
    
    hoy = timezone.now().date()
    manana = hoy + timedelta(days=1)
    
    pedidos_delivery = _scope(request, Pedido.objects.filter(delivery=True))
    pedidos_hoy = pedidos_delivery.filter(created_at__date=hoy)
    
    pendientes = pedidos_hoy.filter(estado='pendiente').count()
    preparando = pedidos_hoy.filter(estado='cocinando').count()
    listos = pedidos_hoy.filter(estado='listo').count()
    en_camino = pedidos_hoy.filter(estado='en_camino').count()
    entregados = pedidos_hoy.filter(estado='entregado').count()
    cancelados = pedidos_hoy.filter(estado='cancelado').count()
    
    total_hoy = pedidos_hoy.filter(estado__in=['pagado', 'entregado']).aggregate(total=models.Sum('total'))['total'] or 0
    
    ultimos = pedidos_delivery.order_by('-created_at')[:15]
    lista_ultimos = [{
        'id': p.id,
        'numero_orden': p.numero_orden,
        'estado': p.estado,
        'nombre_cliente': p.nombre_cliente,
        'telefono_cliente': p.telefono_cliente,
        'items': p.items,
        'total': str(p.total),
        'created_at': p.created_at.isoformat() if p.created_at else None
    } for p in ultimos]
    
    return JsonResponse({
        'success': True,
        'data': {
            'pendientes': pendientes,
            'preparando': preparando,
            'listos': listos,
            'en_camino': en_camino,
            'entregados': entregados,
            'cancelados': cancelados,
            'total_hoy': str(total_hoy),
            'pedidos': lista_ultimos
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def crear_pedido(request):
    """Crea un nuevo pedido"""
    try:
        data = json.loads(request.body)
        mesa_id = data.get('mesa_id')
        mesero_id = data.get('mesero_id')
        items = data.get('items', [])
        notas = data.get('notas') or data.get('nota', '')
        
        # Tipo de pedido (mesa, venta, delivery)
        tipo_pedido = data.get('tipo_pedido', 'mesa')
        
        # Delivery
        delivery = data.get('delivery', False)
        nombre_cliente = data.get('nombre_cliente', '')
        telefono_cliente = data.get('telefono_cliente', '')
        direccion = data.get('direccion', '')
        
        if not items:
            return JsonResponse({
                'success': False,
                'error': 'El pedido debe tener al menos un item'
            }, status=400)
        
        # Validar precios y calcular total desde la base de datos
        from apps.productos.models import Producto
        items_validados = []
        total = 0
        
        for item in items:
            producto_id = item.get('producto_id')
            cantidad = item.get('cantidad', 1)
            
            if not producto_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Cada item debe tener producto_id'
                }, status=400)
            
            try:
                producto = _scope_get(request, Producto, producto_id)
            except Producto.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': f'Producto {producto_id} no encontrado'
                }, status=400)
            
            if not producto.disponible:
                return JsonResponse({
                    'success': False,
                    'error': f'El producto {producto.nombre} no esta disponible'
                }, status=400)
            
            precio_item = Decimal(str(item.get('precio', producto.precio)))
            items_validados.append({
                'producto_id': producto.id,
                'producto_nombre': producto.nombre,
                'categoria_nombre': producto.categoria.nombre if producto.categoria and hasattr(producto.categoria, 'nombre') else None,
                'cantidad': cantidad,
                'precio': str(precio_item),
                'variante': item.get('variante'),
                'nota': item.get('nota', ''),
            })
            total += cantidad * precio_item
        
        # Obtener mesero
        mesero = None
        if mesero_id:
            try:
                mesero = _scope_get(request, Usuario, mesero_id)
            except Usuario.DoesNotExist:
                pass
        
        with transaction.atomic():
            # Bloquear mesa si existe para evitar pedidos concurrentes
            mesa = None
            if mesa_id:
                try:
                    mesa = _scope(request, Mesa.objects.select_for_update()).get(pk=mesa_id)
                except Mesa.DoesNotExist:
                    pass
            
            # Generar numero_orden con lock para evitar race conditions
            hoy = timezone.now().date()
            pedidos_hoy = _scope(request, Pedido.objects.select_for_update()).filter(created_at__date=hoy)
            numero_mas_alto = 0
            for p in pedidos_hoy:
                try:
                    num = int(p.numero_orden)
                    if num > numero_mas_alto:
                        numero_mas_alto = num
                except (ValueError, TypeError):
                    pass
            numero_orden = f"{numero_mas_alto + 1:03d}"
            
            # Crear pedido
            pedido = Pedido.objects.create(restaurante=_get_restaurante(request), 
                numero_orden=numero_orden,
                mesa=mesa,
                mesero=mesero,
                delivery=delivery,
                nombre_cliente=nombre_cliente if (delivery or tipo_pedido == 'venta') else None,
                telefono_cliente=telefono_cliente if delivery else None,
                direccion=direccion if delivery else None,
                notas=notas,
                items=items_validados,
                total=total,
                sincronizado=True,
                tipo_pedido=tipo_pedido
            )
            
            # Cambiar estado de mesa a ocupada
            if mesa:
                mesa.save()
            
            verificar_inventario(request, items_validados)
        
        try:
            from pipperfood.socket_events import emit_mesa_update, emit_nuevo_pedido_cocina
            
            if mesa:
                emit_mesa_update({'id': mesa.id, 'numero': mesa.numero, 'estado': 'ocupada', 'restaurante_slug': _get_restaurante(request).slug})
            
            emit_nuevo_pedido_cocina({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado,
                'mesa': mesa.numero if mesa else None,
                'delivery': pedido.delivery,
                'nombre_cliente': pedido.nombre_cliente,
                'items': pedido.items,
                'total': str(pedido.total),
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception as e:
            logger.warning(f'Error enviando socket al crear pedido {pedido.id}: {e}')
        
        return JsonResponse({
            'success': True,
            'pedido': {
                'id': pedido.id,
                'estado': pedido.estado,
                'delivery': pedido.delivery,
                'total': str(pedido.total)
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["PUT", "POST"])
@requiere_autenticacion
def cambiar_estado(request, pk):
    """Cambia el estado de un pedido validando transiciones"""
    try:
        data = json.loads(request.body)
        estado = data.get('estado')
        
        if not estado:
            return JsonResponse({
                'success': False,
                'error': 'El estado es requerido'
            }, status=400)
        
        with transaction.atomic():
            pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            
            if not transicion_valida(pedido.estado, estado):
                return JsonResponse({
                    'success': False,
                    'error': f'Transicion invalida: {pedido.estado} → {estado}'
                }, status=400)
            
            pedido.estado = estado
            pedido.save()
        
        try:
            from pipperfood.socket_events import emit_pedido_update
            emit_pedido_update({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception as e:
            logger.warning(f'Error enviando socket al cambiar estado pedido {pedido.id}: {e}')
        
        return JsonResponse({
            'success': True,
            'pedido': {
                'id': pedido.id,
                'estado': pedido.estado
            }
        })
    except Pedido.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Pedido no encontrado'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def agregar_items(request, pk):
    """Agrega items a un pedido existente"""
    try:
        data = json.loads(request.body)
        items = data.get('items', [])
        
        if not items:
            return JsonResponse({
                'success': False,
                'error': 'No hay items para agregar'
            }, status=400)
        
        # Validar precios desde la base de datos
        from apps.productos.models import Producto
        items_validados = []
        
        for item in items:
            producto_id = item.get('producto_id')
            cantidad = item.get('cantidad', 1)
            
            if not producto_id:
                return JsonResponse({
                    'success': False,
                    'error': 'Cada item debe tener producto_id'
                }, status=400)
            
            try:
                producto = _scope_get(request, Producto, producto_id)
            except Producto.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': f'Producto {producto_id} no encontrado'
                }, status=400)
            
            if not producto.disponible:
                return JsonResponse({
                    'success': False,
                    'error': f'El producto {producto.nombre} no esta disponible'
                }, status=400)
            
            precio_item = Decimal(str(item.get('precio', producto.precio)))
            items_validados.append({
                'producto_id': producto.id,
                'producto_nombre': producto.nombre,
                'categoria_nombre': producto.categoria.nombre if producto.categoria and hasattr(producto.categoria, 'nombre') else None,
                'cantidad': cantidad,
                'precio': str(precio_item),
                'variante': item.get('variante'),
                'nota': item.get('nota', ''),
            })
        
        with transaction.atomic():
            pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            
            if pedido.estado in ('pagado', 'cancelado'):
                return JsonResponse({
                    'success': False,
                    'error': 'No se pueden agregar items a un pedido pagado o cancelado'
                }, status=400)
        
            # Verificar stock de los nuevos items
            verificar_inventario(request, items_validados)
        
            # Agregar items validados
            pedido.items.extend(items_validados)
        
            # Actualizar total
            from decimal import Decimal as Dec
            nuevo_total = sum(
                int(item.get('cantidad', 1)) * Dec(item.get('precio', 0))
                for item in pedido.items
            )
            pedido.total = nuevo_total
            pedido.save()
        
        try:
            from pipperfood.socket_events import emit_pedido_modificado
            emit_pedido_modificado({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado,
                'items': pedido.items,
                'total': str(pedido.total),
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception as e:
            logger.warning(f'Error enviando socket al agregar items pedido {pedido.id}: {e}')
        
        return JsonResponse({
            'success': True,
            'pedido': {
                'id': pedido.id,
                'items': pedido.items,
                'total': str(pedido.total)
            }
        })
    except Pedido.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Pedido no encontrado'
        }, status=404)
    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["PUT"])
@requiere_autenticacion
def reemplazar_items(request, pk):
    """Reemplaza TODOS los items de un pedido (editar pedido)"""
    try:
        data = json.loads(request.body)
        nuevos_items = data.get('items', [])
        
        if not nuevos_items:
            return JsonResponse({
                'success': False,
                'error': 'El pedido debe tener al menos un item'
            }, status=400)
        
        with transaction.atomic():
            pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            
            if pedido.estado in ('pagado', 'cancelado'):
                return JsonResponse({
                    'success': False,
                    'error': 'No se puede modificar un pedido pagado o cancelado'
                }, status=400)
            
            
            # Validar y preparar items nuevos
            from apps.productos.models import Producto
            items_validados = []
            total = 0
            
            for item in nuevos_items:
                producto_id = item.get('producto_id')
                cantidad = item.get('cantidad', 1)
                
                if not producto_id:
                    return JsonResponse({
                        'success': False,
                        'error': 'Cada item debe tener producto_id'
                    }, status=400)
                
                try:
                    producto = _scope_get(request, Producto, producto_id)
                except Producto.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'error': f'Producto {producto_id} no encontrado'
                    }, status=400)
                
                if not producto.disponible:
                    return JsonResponse({
                        'success': False,
                        'error': f'El producto {producto.nombre} no esta disponible'
                    }, status=400)
                
                precio_item = Decimal(str(item.get('precio', producto.precio)))
                items_validados.append({
                    'producto_id': producto.id,
                    'producto_nombre': producto.nombre,
                    'categoria_nombre': producto.categoria.nombre if producto.categoria and hasattr(producto.categoria, 'nombre') else None,
                    'cantidad': cantidad,
                    'precio': str(precio_item),
                    'variante': item.get('variante'),
                    'nota': item.get('nota', '')
                })
                total += cantidad * precio_item
            
            # Verificar stock de items nuevos
            verificar_inventario(request, items_validados)
            
            # Reemplazar items y actualizar total
            pedido.items = items_validados
            pedido.total = total
            pedido.save()
        
        try:
            from pipperfood.socket_events import emit_pedido_modificado
            emit_pedido_modificado({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado,
                'items': pedido.items,
                'total': str(pedido.total),
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception as e:
            logger.warning(f'Error enviando socket al reemplazar items pedido {pedido.id}: {e}')
        
        return JsonResponse({
            'success': True,
            'pedido': {
                'id': pedido.id,
                'items': pedido.items,
                'total': str(pedido.total),
                'estado': pedido.estado
            }
        })
    except Pedido.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Pedido no encontrado'
        }, status=404)
    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
@requiere_autenticacion
def eliminar_item(request, pk, idx):
    """Elimina un item especifico de un pedido por su indice"""
    try:
        with transaction.atomic():
            pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            
            if pedido.estado in ('pagado', 'cancelado'):
                return JsonResponse({
                    'success': False,
                    'error': 'No se puede modificar un pedido pagado o cancelado'
                }, status=400)
            
            items = pedido.items
            if not isinstance(items, list) or idx < 0 or idx >= len(items):
                return JsonResponse({
                    'success': False,
                    'error': 'Item no encontrado'
                }, status=404)
            
            # Eliminar el item
            items.pop(idx)
            pedido.items = items
            
            if not items:
                return JsonResponse({
                    'success': False,
                    'error': 'No se puede eliminar el unico item. Cancele el pedido en su lugar.'
                }, status=400)
            
            # Recalcular total
            from decimal import Decimal as Dec
            nuevo_total = sum(
                int(it.get('cantidad', 1)) * Dec(it.get('precio', 0))
                for it in items
            )
            pedido.total = nuevo_total
            pedido.save()
        
        try:
            from pipperfood.socket_events import emit_pedido_modificado
            emit_pedido_modificado({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado,
                'items': pedido.items,
                'total': str(pedido.total),
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception as e:
            logger.warning(f'Error enviando socket al eliminar item pedido {pedido.id}: {e}')
        
        return JsonResponse({
            'success': True,
            'pedido': {
                'id': pedido.id,
                'items': pedido.items,
                'total': str(pedido.total)
            }
        })
    except Pedido.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Pedido no encontrado'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def pagar_pedido(request, pk):
    """Paga y cierra un pedido"""
    try:
        data = json.loads(request.body)
        metodo_pago = data.get('metodo_pago', 'efectivo')
        propinas = data.get('propina', 0)
        tipo_iva = data.get('tipo_iva', 10)
        dividir_pago = data.get('dividir_pago', None)
        usuario_id = data.get('usuario_id')
        marca_tarjeta = data.get('marca_tarjeta', '')
        ultimos_4 = data.get('ultimos_4', '')
        comprobante_nro = data.get('comprobante_nro', '')
        marca_qr = data.get('marca_qr', '')
        cuotas = data.get('cuotas', 1)
        
        session = _scope(request, CajaSession.objects.filter(estado='abierta')).first()
        if not session:
            return JsonResponse({
                'success': False,
                'error': 'No hay una sesion de caja abierta. Abra la caja primero.',
                'need_apertura': True,
            }, status=400)

        with transaction.atomic():
            try:
                pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            except Pedido.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'Pedido no encontrado'
                }, status=404)
            
            if not transicion_valida(pedido.estado, 'pagado'):
                return JsonResponse({
                    'success': False,
                    'error': f'No se puede pagar un pedido en estado {pedido.estado}. Debe estar entregado.'
                }, status=400)
            
            pedido.estado = 'pagado'
            
            if isinstance(metodo_pago, dict):
                pedido.metodo_pago = normalizar_metodo_pago(metodo_pago.get('principal', 'efectivo'))
            else:
                pedido.metodo_pago = normalizar_metodo_pago(metodo_pago)
            
            pedido.propina = propinas
            pedido.marca_tarjeta = marca_tarjeta
            pedido.ultimos_4 = ultimos_4
            pedido.comprobante_nro = comprobante_nro
            pedido.marca_qr = marca_qr
            pedido.cuotas = cuotas
            pedido.tipo_iva = tipo_iva
            pedido.save()
            
            descontar_inventario(request, pedido.items)
            
            if pedido.mesa:
                otros_activos = _scope(request, Pedido.objects.filter(
                    mesa=pedido.mesa,
                    estado__in=['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado']
                )).exclude(pk=pedido.pk).exists()
                if not otros_activos:
                    pedido.mesa.estado = 'disponible'
                    pedido.mesa.save()
            
            total_con_propina = Decimal(str(pedido.total)) + Decimal(str(propinas))
            usuario_obj = _scope(request, Usuario.objects.filter(pk=usuario_id)).first() if usuario_id else None
            
            metodo_pago_str = pedido.metodo_pago if isinstance(pedido.metodo_pago, str) else 'efectivo'
            MovimientoCaja.objects.create(restaurante=_get_restaurante(request), 
                session=session,
                tipo='venta',
                metodo_pago=metodo_pago_str,
                monto=total_con_propina,
                moneda='PYG',
                monto_pyg=total_con_propina,
                pedido=pedido,
                propina=Decimal(str(propinas)),
                vuelto=Decimal('0'),
                usuario=usuario_obj,
            )
            
            return JsonResponse({
                'success': True,
                'pedido': {
                    'id': pedido.id,
                    'estado': pedido.estado,
                    'metodo_pago': pedido.metodo_pago,
                    'propina': str(pedido.propina or 0),
                    'total': str(pedido.total)
                }
            })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["GET"])
@requiere_autenticacion
def pedidos_por_mesa(request, mesa_id):
    """Obtiene todos los pedidos de una mesa"""
    try:
        pedidos = _scope(request, Pedido.objects.select_related('mesero').filter(mesa_id=mesa_id)).exclude(estado__in=['pagado', 'cancelado'])
        
        data = [{
            'id': p.id,
            'numero_orden': p.numero_orden,
            'estado': p.estado,
            'items': p.items,
            'notas': p.notas,
            'total': str(p.total),
            'metodo_pago': p.metodo_pago,
            'mesero_nombre': p.mesero.nombre if p.mesero else None,
            'mesero_id': p.mesero_id,
            'created_at': p.created_at.isoformat() if p.created_at else None
        } for p in pedidos]
        
        total_mesa = sum(Decimal(p.total) for p in pedidos)
        
        return JsonResponse({
            'success': True,
            'pedidos': data,
            'total_mesa': str(total_mesa),
            'cantidad': len(data)
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def cobrar_mesa(request, mesa_id):
    """Cobra todos los pedidos de una mesa a través de la caja"""
    try:
        data = json.loads(request.body)
        metodo_pago = data.get('metodo_pago', 'efectivo')
        propinas = data.get('propina', 0)
        tipo_iva = data.get('tipo_iva', 10)
        pagos = data.get('pagos')

        cliente_tipo = data.get('cliente_tipo', 'consumidor')
        cliente_ruc = data.get('cliente_ruc', '44444444-7')
        cliente_nombre = data.get('cliente_nombre', 'Consumidor Final')
        generar_comanda = data.get('generar_comanda', False)
        generar_factura = data.get('generar_factura', False)

        comprobante_nro = data.get('comprobante_nro')
        marca_tarjeta = data.get('marca_tarjeta')
        marca_qr = data.get('marca_qr')
        cuotas = data.get('cuotas', 1)
        ultimos_4 = data.get('ultimos_4')

        with transaction.atomic():
            # Bloquear la mesa para evitar cobros concurrentes
            mesa = _scope(request, Mesa.objects.select_for_update()).get(pk=mesa_id)

            # Validar sesión de caja abierta
            from apps.caja.models import CajaSession
            session = _scope(request, CajaSession.objects.filter(estado='abierta')).first()
            if not session:
                return JsonResponse({
                    'success': False,
                    'error': 'No hay una sesión de caja abierta. Abra la caja primero.',
                    'need_apertura': True,
                }, status=400)

            pedidos = _scope(request, Pedido.objects.select_for_update().filter(mesa_id=mesa_id)).exclude(estado__in=['pagado', 'cancelado'])
        
            if not pedidos.exists():
                return JsonResponse({
                    'success': False,
                    'error': 'No hay pedidos en esta mesa'
                }, status=400)
        
            total_cobrado = 0
            ids_cobrados = []
            vuelto = 0
            monto_recibido = float(data.get('monto_recibido', 0))

            # Normalizar metodo_pago a valores permitidos
            metodo_pago_str = 'efectivo'
            if isinstance(metodo_pago, dict):
                metodo_pago_str = metodo_pago.get('principal', 'efectivo')
            elif isinstance(metodo_pago, str):
                metodo_pago_str = metodo_pago

            metodo_pago_str = normalizar_metodo_pago(metodo_pago_str)

            # Total de pedidos para distribuir propina proporcionalmente
            total_pedidos_valor = sum(float(p.total) for p in pedidos)

            usuario_id = data.get('usuario_id')
            from apps.usuarios.models import Usuario
            usuario_obj = _scope(request, Usuario.objects.filter(pk=usuario_id)).first() if usuario_id else None

            for pedido in pedidos:
                if not transicion_valida(pedido.estado, 'pagado'):
                    return JsonResponse({
                        'success': False,
                        'error': f'Pedido #{pedido.numero_orden} en estado {pedido.estado} no puede pagarse. Debe estar entregado.'
                    }, status=400)
                pedido.estado = 'pagado'
                pedido.metodo_pago = metodo_pago_str
                if total_pedidos_valor > 0 and propinas:
                    pedido.propina = round(float(propinas) * float(pedido.total) / total_pedidos_valor)
                else:
                    pedido.propina = 0
                pedido.cliente_tipo = cliente_tipo
                pedido.cliente_ruc = cliente_ruc
                pedido.cliente_nombre = cliente_nombre
                pedido.generar_comanda = generar_comanda
                pedido.generar_factura = generar_factura

                if pagos:
                    pedido.detalle_pagos = pagos

                if comprobante_nro:
                    pedido.comprobante_nro = comprobante_nro
                if marca_tarjeta:
                    pedido.marca_tarjeta = marca_tarjeta
                if marca_qr:
                    pedido.marca_qr = marca_qr
                if cuotas:
                    pedido.cuotas = cuotas
                if ultimos_4:
                    pedido.ultimos_4 = ultimos_4
                pedido.tipo_iva = tipo_iva
                pedido.save()
                total_cobrado += float(pedido.total)
                ids_cobrados.append(pedido.id)
                descontar_inventario(request, pedido.items)

                # Crear un MovimientoCaja por cada pedido (excepto mixto que se maneja aparte)
                if metodo_pago_str != 'mixto':
                    monto_mov = float(pedido.total) + float(pedido.propina)
                    MovimientoCaja.objects.create(restaurante=_get_restaurante(request), 
                        session=session,
                        tipo='venta',
                        metodo_pago=metodo_pago_str,
                        monto=monto_mov,
                        moneda='PYG',
                        monto_pyg=monto_mov,
                        pedido=pedido,
                        propina=float(pedido.propina),
                        vuelto=0,
                        usuario=usuario_obj,
                    )

            total_con_propina = total_cobrado + float(propinas)

            # Calcular vuelto para efectivo
            if metodo_pago_str == 'efectivo' and monto_recibido > 0:
                vuelto = monto_recibido - total_con_propina
                if vuelto < 0:
                    vuelto = 0

            # Para mixto: crear un MovimientoCaja por cada pago (despues del loop)
            if metodo_pago_str == 'mixto' and pagos:
                for i, pago in enumerate(pagos):
                    pago_metodo = normalizar_metodo_pago(pago.get('metodo', 'efectivo'))
                    MovimientoCaja.objects.create(restaurante=_get_restaurante(request), 
                        session=session,
                        tipo='venta',
                        metodo_pago=pago_metodo,
                        monto=float(pago.get('monto', 0)),
                        moneda=pago.get('moneda', 'PYG'),
                        monto_pyg=float(pago.get('monto_pyg', 0)),
                        pedido=None,
                        detalle_pagos=pagos,
                        propina=propinas if i == 0 else 0,
                        vuelto=0,
                        usuario=usuario_obj,
                    )

            # Si fue efectivo, actualizar el vuelto en el ultimo movimiento creado
            if metodo_pago_str == 'efectivo' and vuelto > 0:
                ultimo_mov = session.movimientos.filter(tipo='venta', metodo_pago='efectivo').last()
                if ultimo_mov:
                    ultimo_mov.vuelto = vuelto
                    ultimo_mov.save()
        
            mesa = _scope_get(request, Mesa, mesa_id)
            otros_activos = _scope(request, Pedido.objects.filter(
                mesa=mesa,
                estado__in=['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado']
            )).exists()
            if not otros_activos:
                mesa.estado = 'disponible'
                mesa.save()
        
            factura_data = None
        
            if generar_factura:
                try:
                    from apps.facturacion.models import Configuracion, Timbrado, Factura
                    from apps.facturacion.sifen import generar_factura_completa

                    config = _scope(request, Configuracion.objects).first()
                    if not config:
                        raise Exception('Configure la empresa primero en Configuracion')

                    timbrado = _scope(request, Timbrado.objects.filter(activo=True)).first()
                    if timbrado:
                        timbrado.numero_actual += 1
                        timbrado.save()
                        num_factura = str(timbrado.numero_actual).zfill(7)
                    else:
                        num_factura = '0000001'

                    cliente_data = {
                        'ruc': cliente_ruc,
                        'nombre': cliente_nombre,
                        'direccion': data.get('cliente_direccion', ''),
                    }

                    all_items = []
                    total_final = 0
                    for p in pedidos:
                        all_items.extend(p.items if isinstance(p.items, list) else [])
                        total_final += float(p.total)

                    pedido_dict = {
                        'numero_orden': num_factura,
                        'items': all_items,
                        'total': total_final,
                    }

                    sifen_result = generar_factura_completa(config, pedido_dict, cliente_data)

                    first_pedido = pedidos.first() if pedidos.exists() else None

                    sr = sifen_result.get('sifen_result', {})
                    sifen_envio_ok = sr.get('success', False)
                    sifen_estado_val = 'enviada' if sifen_envio_ok else 'pendiente'
                    sifen_mensaje_val = sr.get('response') or sr.get('error', '')

                    factura = Factura.objects.create(restaurante=_get_restaurante(request), 
                        numero=num_factura,
                        pedido=first_pedido,
                        ruc_cliente=cliente_ruc,
                        nombre_cliente=cliente_nombre,
                        xml=sifen_result['xml'],
                        cdc=sifen_result['cdc'],
                        kude=sifen_result['kude'],
                        qr_base64=sifen_result['qr_base64'],
                        estado='generada',
                        sifen_estado=sifen_estado_val,
                        sifen_mensaje=sifen_mensaje_val,
                        total=total_final,
                    )

                    factura_data = {
                        'numero': factura.numero,
                        'cdc': factura.cdc,
                        'kude': factura.kude,
                        'qr_base64': factura.qr_base64,
                        'sifen_estado': factura.sifen_estado,
                        'sifen_mensaje': factura.sifen_mensaje,
                    }
                except Exception as factura_err:
                    if timbrado:
                        timbrado.numero_actual -= 1
                        timbrado.save()
                    factura_data = {
                        'error': str(factura_err),
                    }
                    logger.warning(f'SIFEN error al facturar pedidos de mesa {mesa_id}: {factura_err}')
        
            sifen_error = None
            if isinstance(factura_data, dict) and 'error' in factura_data:
                sifen_error = factura_data['error']
                factura_data = None

            response_data = {
                'success': True,
                'cobrados': ids_cobrados,
                'total_cobrado': str(total_cobrado),
                'total_con_propina': str(total_con_propina),
                'monto_recibido': monto_recibido,
                'vuelto': vuelto,
                'numero_factura': factura_data.get('numero', len(ids_cobrados)) if isinstance(factura_data, dict) else len(ids_cobrados),
                'factura': factura_data or {},
                'sifen_error': sifen_error,
                'pedidos': [
                    {
                        'id': p.id,
                        'numero_orden': p.numero_orden,
                        'items': p.items if isinstance(p.items, list) else [],
                        'total': str(p.total),
                        'fecha': p.created_at.isoformat() if p.created_at else None
                    }
                    for p in pedidos
                ]
            }
        
            return JsonResponse(response_data)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def historial_caja(request):
    """Historial de pagos del dÃ­a"""
    try:
        desde = request.GET.get('desde')
        
        filtros = {'estado__in': ['pagado', 'entregado']}
        
        if desde:
            filtros['created_at__date'] = desde
        else:
            filtros['created_at__date'] = timezone.now().date()
        
        pedidos = _scope(request, Pedido.objects.filter(**filtros))
        
        total_propinas = 0
        resumen = {}
        
        for p in pedidos:
            mp = p.metodo_pago or 'efectivo'
            total = float(p.total or 0)
            resumen[mp] = resumen.get(mp, 0) + total
            total_propinas += float(p.propina or 0)
        
        resumen_str = {k: str(v) for k, v in resumen.items()}
        total_dia = sum(resumen.values())
        
        return JsonResponse({
            'success': True,
            'resumen': {
                **resumen_str,
                'propinas': str(total_propinas),
                'total': str(total_dia)
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def lista_pedidos_pagados(request):
    """Lista de pedidos pagados para historial en Caja con filtros avanzados"""
    try:
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        cliente_nombre = request.GET.get('cliente_nombre', '').strip()
        cliente_ruc = request.GET.get('cliente_ruc', '').strip()
        numero_orden = request.GET.get('numero_orden', '').strip()
        numero_factura = request.GET.get('numero_factura', '').strip()
        timbrado = request.GET.get('timbrado', '').strip()
        limit = int(request.GET.get('limit', 20))
        offset = int(request.GET.get('offset', 0))

        today = timezone.now().date()
        if not fecha_desde:
            fecha_desde = today.isoformat()
        if not fecha_hasta:
            fecha_hasta = today.isoformat()

        pedidos = _scope(request, Pedido.objects.filter(
            estado__in=['pagado']),
            created_at__date__gte=fecha_desde,
            created_at__date__lte=fecha_hasta
        ).select_related('mesa', 'mesero')

        if cliente_nombre:
            pedidos = pedidos.filter(cliente_nombre__icontains=cliente_nombre)
        if cliente_ruc:
            pedidos = pedidos.filter(cliente_ruc__icontains=cliente_ruc)
        if numero_orden:
            pedidos = pedidos.filter(numero_orden__icontains=numero_orden)

        if numero_factura or timbrado:
            q_factura = models.Q()
            if numero_factura:
                q_factura &= models.Q(facturas__numero__icontains=numero_factura)
            if timbrado:
                q_factura &= models.Q(facturas__numero__icontains=timbrado)
            pedidos = pedidos.filter(q_factura).distinct()

        total = pedidos.count()
        pedidos = pedidos.order_by('-created_at')[offset:offset + limit]

        data = []
        for p in pedidos:
            factura = p.facturas.first()
            item = {
                'id': p.id,
                'numero_orden': p.numero_orden,
                'mesa': p.mesa.numero if p.mesa else None,
                'items': p.items,
                'total': str(p.total),
                'metodo_pago': p.metodo_pago,
                'cliente_nombre': p.cliente_nombre,
                'cliente_ruc': p.cliente_ruc,
                'cliente_tipo': p.cliente_tipo,
                'generar_factura': p.generar_factura,
                'propina': str(p.propina),
                'detalle_pagos': p.detalle_pagos,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'mesero_nombre': p.mesero.nombre if p.mesero else None,
            }
            if factura:
                item['factura'] = {
                    'numero': factura.numero,
                    'cdc': factura.cdc,
                    'kude': factura.kude,
                    'qr_base64': factura.qr_base64,
                    'sifen_estado': factura.sifen_estado,
                }
            data.append(item)

        return JsonResponse({
            'success': True,
            'pedidos': data,
            'total': total,
            'limit': limit,
            'offset': offset,
        })
    except Exception as e:
        import traceback
        return JsonResponse({'success': False, 'error': str(e), 'trace': traceback.format_exc()}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def cancelar_pedido(request, pk):
    """Cancela un pedido con motivo"""
    try:
        data = json.loads(request.body) if request.body else {}
        motivo = (data.get('motivo', '') or '').strip()
        
        if not motivo:
            return JsonResponse({
                'success': False,
                'error': 'Debe ingresar un motivo de cancelacion'
            }, status=400)
        
        with transaction.atomic():
            pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            
            if pedido.estado in ('pagado', 'cancelado'):
                return JsonResponse({
                    'success': False,
                    'error': 'Este pedido ya fue pagado o cancelado'
                }, status=400)
            
            # Guardar en que estado estaba cuando se cancelo
            pedido.cancelado_en_estado = pedido.estado
            pedido.motivo_cancelacion = motivo
            pedido.estado = 'cancelado'
            pedido.save()
            
            # Liberar mesa solo si no quedan otros pedidos activos
            if pedido.mesa:
                otros_activos = _scope(request, Pedido.objects.filter(
                    mesa=pedido.mesa,
                    estado__in=['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado']
                )).exclude(pk=pedido.pk).exists()
                if not otros_activos:
                    pedido.mesa.estado = 'disponible'
                    pedido.mesa.save()
        
        try:
            from pipperfood.socket_events import emit_pedido_update, emit_mesa_update
            emit_pedido_update({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': 'cancelado',
                'motivo': motivo,
                'restaurante_slug': _get_restaurante(request).slug
            })
            if pedido.mesa:
                estado_mesa = 'disponible'
                otros_activos = _scope(request, Pedido.objects.filter(
                    mesa=pedido.mesa,
                    estado__in=['pendiente', 'cocinando', 'listo', 'en_camino', 'entregado']
                )).exclude(pk=pedido.pk).exists()
                if otros_activos:
                    estado_mesa = 'ocupada'
                emit_mesa_update({'id': pedido.mesa.id, 'numero': pedido.mesa.numero, 'estado': estado_mesa, 'restaurante_slug': _get_restaurante(request).slug})
        except Exception as e:
            logger.warning(f'Error enviando socket al cancelar pedido {pedido.id}: {e}')
        
        return JsonResponse({'success': True})
    except Pedido.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Pedido no encontrado'
        }, status=404)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def sincronizar_pedidos(request):
    """Sincroniza pedidos offline"""
    try:
        data = json.loads(request.body)
        pedidos_data = data.get('pedidos', [])
        
        sincronizados = []
        for pd in pedidos_data:
            pedido_id = pd.get('id')
            
            with transaction.atomic():
                pedido = _scope(request, Pedido.objects.select_for_update()).filter(pk=pedido_id).first()
                
                if pedido:
                    pedido.sincronizado = True
                    pedido.save()
                    sincronizados.append(pedido.id)
                else:
                    from apps.productos.models import Producto
                    items_offline = pd.get('items', [])
                    
                    items_validados = []
                    total = 0
                    
                    for item in items_offline:
                        producto_id = item.get('producto_id')
                        cantidad = item.get('cantidad', 1)
                        
                        if producto_id:
                            producto = _scope(request, Producto.objects.filter(pk=producto_id)).first()
                            if producto and producto.disponible:
                                items_validados.append({
                                    'producto_id': producto.id,
                                    'producto_nombre': producto.nombre,
                                    'categoria_nombre': producto.categoria.nombre if producto.categoria and hasattr(producto.categoria, 'nombre') else None,
                                    'cantidad': cantidad,
                                    'precio': str(producto.precio),
                                    'nota': item.get('nota', '') or ''
                                })
                                total += cantidad * producto.precio
                            else:
                                items_validados.append(item)
                                total += cantidad * item.get('precio', 0)
                        else:
                            items_validados.append(item)
                            total += cantidad * item.get('precio', 0)
                    
                    if not items_validados:
                        continue
                    
                    Pedido.objects.create(restaurante=_get_restaurante(request), 
                        mesa_id=pd.get('mesa_id'),
                        items=items_validados,
                        total=total,
                        sincronizado=True,
                        estado=pd.get('estado', 'pendiente')
                    )
                    sincronizados.append(pedido_id)
        
        return JsonResponse({
            'success': True,
            'sincronizados': sincronizados
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["POST"])
@requiere_autenticacion
def reimprimir_factura(request, pk):
    """Reimprime una factura - mÃ¡ximo 3 veces"""
    try:
        try:
            pedido = _scope(request, Pedido.objects.select_related('mesa', 'mesero')).get(pk=pk)
        except Pedido.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Pedido no encontrado'}, status=404)
        
        if not puede_imprimir(pedido, 'factura'):
            contador = obtener_contador_impresiones(pedido, 'factura')
            return JsonResponse({
                'success': False,
                'error': f'LÃ­mite de impresiones alcanzado ({contador}/{MAX_IMPRESIONES})',
                'limite_alcanzado': True,
                'contador': contador
            })
        
        impresion = registrar_impresion(request, pedido, 'factura', None)
        
        return JsonResponse({
            'success': True,
            'mensaje': 'ImpresiÃ³n registrada',
            'impresion_id': impresion.impresion_id if impresion else None,
            'numero_impresion': impresion.numero_impresion if impresion else None,
            'contador': obtener_contador_impresiones(pedido, 'factura'),
            'pedido': {
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'cliente_nombre': pedido.cliente_nombre,
                'cliente_ruc': pedido.cliente_ruc,
                'items': pedido.items,
                'total': str(pedido.total),
                'mesa': pedido.mesa.numero if pedido.mesa else None,
                'created_at': pedido.created_at.isoformat() if pedido.created_at else None
            }
        })
    except Exception as e:
        import traceback
        return JsonResponse({'success': False, 'error': str(e), 'trace': traceback.format_exc()}, status=500)
