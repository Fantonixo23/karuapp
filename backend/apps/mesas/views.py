import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from apps.usuarios.decorators import requiere_autenticacion
from pipperfood.middleware import _scope, _scope_get, _get_restaurante
from .models import Mesa


@require_http_methods(["GET"])
@requiere_autenticacion
def lista_mesas(request):
    """Lista todas las mesas"""
    mesas = _scope(request, Mesa.objects.all()).order_by('numero')
    data = [{
        'id': m.id,
        'numero': m.numero,
        'nombre': m.nombre,
        'capacidad': m.capacidad,
        'area': m.area,
        'estado': m.estado,
        'comensales': m.comensales,
        'pedidos_activos': m.pedidos_activos,
        'pedido_id': m.pedido_actual.id if m.pedido_actual else None,
        'tiempo_ocupado': m.tiempo_ocupado
    } for m in mesas]
    return JsonResponse({'success': True, 'mesas': data})


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def crear_mesa(request):
    """Crea una nueva mesa"""
    try:
        data = json.loads(request.body)
        numero = data.get('numero')
        nombre = data.get('nombre')
        capacidad = data.get('capacidad', 4)
        area = data.get('area', 'principal')
        
        if not numero:
            return JsonResponse({
                'success': False,
                'error': 'El numero es requerido'
            }, status=400)
        
        if Mesa.objects.filter(restaurante=_get_restaurante(request), numero=numero).exists():
            return JsonResponse({
                'success': False,
                'error': 'Ya existe una mesa con este numero'
            }, status=400)
        
        mesa = Mesa.objects.create(
            restaurante=_get_restaurante(request),
            numero=numero,
            nombre=nombre or f'Mesa {numero}',
            capacidad=capacidad,
            area=area
        )

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'nombre': mesa.nombre, 'capacidad': mesa.capacidad,
                'area': mesa.area, 'estado': mesa.estado,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'mesa': {
                'id': mesa.id,
                'numero': mesa.numero,
                'nombre': mesa.nombre,
                'capacidad': mesa.capacidad,
                'area': mesa.area,
                'estado': mesa.estado
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
def modificar_mesa(request, pk):
    """Modifica una mesa"""
    try:
        data = json.loads(request.body)
        try:
            mesa = _scope_get(request, Mesa, pk)
        except Mesa.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Mesa no encontrada'
            }, status=404)
        
        numero = data.get('numero')
        nombre = data.get('nombre')
        capacidad = data.get('capacidad')
        estado = data.get('estado')
        area = data.get('area')
        comensales = data.get('comensales')
        
        if numero:
            mesa.numero = numero
        if nombre is not None:
            mesa.nombre = nombre
        if capacidad:
            mesa.capacidad = capacidad
        if estado:
            mesa.estado = estado
        if area:
            mesa.area = area
        if comensales is not None:
            mesa.comensales = comensales
        
        mesa.save()

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'nombre': mesa.nombre, 'capacidad': mesa.capacidad,
                'area': mesa.area, 'estado': mesa.estado,
                'comensales': mesa.comensales,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'mesa': {
                'id': mesa.id,
                'numero': mesa.numero,
                'nombre': mesa.nombre,
                'capacidad': mesa.capacidad,
                'area': mesa.area,
                'estado': mesa.estado,
                'comensales': mesa.comensales
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def abrir_mesa(request):
    """Abre una mesa (establece comensales y cambia estado a ocupada)"""
    try:
        data = json.loads(request.body)
        mesa_id = data.get('mesa_id')
        comensales = data.get('comensales', 0)
        
        if not mesa_id:
            return JsonResponse({
                'success': False,
                'error': 'mesa_id es requerido'
            }, status=400)
        
        try:
            mesa = _scope_get(request, Mesa, mesa_id)
        except Mesa.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Mesa no encontrada'
            }, status=404)
        
        mesa.comensales = comensales
        mesa.estado = 'ocupada'
        mesa.save()

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'estado': mesa.estado,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'mesa': {
                'id': mesa.id,
                'numero': mesa.numero,
                'comensales': mesa.comensales,
                'estado': mesa.estado
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def cerrar_mesa(request):
    """Cierra una mesa (libera y limpia)"""
    try:
        data = json.loads(request.body)
        mesa_id = data.get('mesa_id')
        
        if not mesa_id:
            return JsonResponse({
                'success': False,
                'error': 'mesa_id es requerido'
            }, status=400)
        
        try:
            mesa = _scope_get(request, Mesa, mesa_id)
        except Mesa.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Mesa no encontrada'
            }, status=404)
        
        mesa.estado = 'disponible'
        mesa.comensales = 0
        mesa.save()

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'estado': mesa.estado,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'mesa': {
                'id': mesa.id,
                'numero': mesa.numero,
                'estado': mesa.estado
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def marcar_limpieza(request):
    """Marca mesa para limpieza"""
    try:
        data = json.loads(request.body)
        mesa_id = data.get('mesa_id')
        
        try:
            mesa = _scope_get(request, Mesa, mesa_id)
        except Mesa.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Mesa no encontrada'
            }, status=404)
        
        mesa.estado = 'limpieza'
        mesa.save()

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'estado': mesa.estado,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def cambiar_estado_mesa(request, pk):
    """Cambia el estado de una mesa"""
    try:
        data = json.loads(request.body)
        nuevo_estado = data.get('estado')
        
        if nuevo_estado not in ['disponible', 'libre', 'ocupada', 'limpieza']:
            return JsonResponse({
                'success': False,
                'error': 'Estado no válido'
            }, status=400)
        
        try:
            mesa = _scope_get(request, Mesa, pk)
        except Mesa.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Mesa no encontrada'
            }, status=404)
        
        mesa.estado = nuevo_estado
        mesa.save()

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'estado': mesa.estado,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'mesa': {
                'id': mesa.id,
                'numero': mesa.numero,
                'estado': mesa.estado
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
def eliminar_mesa(request, pk):
    """Elimina una mesa"""
    try:
        try:
            mesa = _scope_get(request, Mesa, pk)
        except Mesa.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Mesa no encontrada'
            }, status=404)
        
        numero_mesa = mesa.numero
        mesa.delete()

        try:
            from pipperfood.socket_events import emit_mesa_update
            emit_mesa_update({
                'id': mesa.id, 'numero': mesa.numero,
                'estado': 'eliminada',
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception:
            pass
        
        return JsonResponse({
            'success': True,
            'message': f'Mesa {numero_mesa} eliminada'
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)