from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import transaction
from apps.usuarios.decorators import requiere_autenticacion
from pipperfood.middleware import _scope, _scope_get, _get_restaurante
from apps.pedidos.models import Pedido, transicion_valida
import json


@require_http_methods(["GET"])
@requiere_autenticacion
def pedidos_cocina(request):
    """Lista pedidos para cocina"""
    try:
        from django.db.models import Q
        from datetime import timedelta
        
        today = timezone.localdate()
        hoy_inicio = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
        
        estado_filtro = request.GET.get('estado')
        buscar = request.GET.get('buscar', '').strip()
        
        query = Q(estado__in=['pendiente', 'cocinando', 'listo'])
        
        if estado_filtro and estado_filtro != 'todo':
            query = Q(estado=estado_filtro)
        
        pedidos = _scope(request, Pedido.objects.select_related('mesa', 'mesero').filter(query)).order_by('-created_at')
        
        if buscar:
            pedidos = pedidos.filter(numero_orden__icontains=buscar)
        
        data = [{
            'id': p.id,
            'numero_orden': p.numero_orden,
            'mesa': p.mesa.numero if p.mesa else None,
            'mesa_id': p.mesa_id,
            'delivery': p.delivery,
            'nombre_cliente': p.nombre_cliente,
            'telefono_cliente': p.telefono_cliente,
            'estado': p.estado,
            'items': p.items,
            'notas': p.notas,
            'tipo_pedido': p.tipo_pedido,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'mesero_nombre': p.mesero.nombre if p.mesero else None
        } for p in pedidos]
        
        return JsonResponse({'success': True, 'pedidos': data})
    except Exception as e:
        import traceback
        return JsonResponse({'success': False, 'error': str(e), 'trace': traceback.format_exc()}, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def tickets(request):
    """Lista tickets (pedidos listos) - solo de hoy"""
    try:
        from django.db.models import Q
        from datetime import timedelta
        
        today = timezone.localdate()
        hoy_inicio = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
        
        pedidos = _scope(request, Pedido.objects.select_related('mesa', 'mesero').filter(
            Q(created_at__gte=hoy_inicio) & Q(estado='listo')
        )).order_by('-created_at')[:50]
        
        data = [{
            'id': p.id,
            'numero_orden': p.numero_orden,
            'mesa': p.mesa.numero if p.mesa else None,
            'items': p.items,
            'total': float(p.total),
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'mesero_nombre': p.mesero.nombre if p.mesero else None
        } for p in pedidos]
        
        return JsonResponse({'success': True, 'tickets': data})
    except Exception as e:
        import traceback
        return JsonResponse({'success': False, 'error': str(e), 'trace': traceback.format_exc()}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def cambiar_estado_cocina(request, pk):
    """Cambia el estado de un pedido desde cocina (solo pendiente/cocinando/listo)"""
    try:
        data = json.loads(request.body)
        nuevo_estado = data.get('estado')
        
        if nuevo_estado not in ['pendiente', 'cocinando', 'listo']:
            return JsonResponse({'success': False, 'error': 'Estado no válido para cocina'}, status=400)
        
        with transaction.atomic():
            pedido = _scope(request, Pedido.objects.select_for_update()).get(pk=pk)
            
            if not transicion_valida(pedido.estado, nuevo_estado):
                return JsonResponse({
                    'success': False,
                    'error': f'Transicion invalida desde cocina: {pedido.estado} → {nuevo_estado}'
                }, status=400)
            
            pedido.estado = nuevo_estado
            pedido.save()
        
        try:
            from pipperfood.socket_events import emit_pedido_update
            
            emit_pedido_update({
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado,
                'mesa': pedido.mesa.numero if pedido.mesa else None,
                'delivery': pedido.delivery,
                'items': pedido.items,
                'restaurante_slug': _get_restaurante(request).slug
            })
        except Exception as e:
            pass
        
        return JsonResponse({
            'success': True,
            'pedido': {
                'id': pedido.id,
                'numero_orden': pedido.numero_orden,
                'estado': pedido.estado
            }
        })
    except Pedido.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Pedido no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)