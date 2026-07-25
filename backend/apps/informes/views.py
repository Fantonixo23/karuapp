from django.db.models import Count, Sum
from django.db.models.functions import TruncDate, TruncHour
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from datetime import timedelta
from apps.usuarios.decorators import requiere_autenticacion
from pipperfood.middleware import _scope
from apps.pedidos.models import Pedido


@require_http_methods(["GET"])
@requiere_autenticacion
def dashboard(request):
    """Dashboard con todas las estadisticas"""
    today = timezone.now().date()
    inicio_semana = today - timedelta(days=today.weekday())
    
    # Pedidos de hoy
    pedidos_hoy = _scope(request, Pedido.objects.filter(created_at__date=today))
    pedidos_semana = _scope(request, Pedido.objects.filter(created_at__date__gte=inicio_semana))
    pedidos_mes = _scope(request, Pedido.objects.filter(created_at__month=today.month, created_at__year=today.year))
    
    ventas_hoy = float(pedidos_hoy.filter(estado='pagado').aggregate(Sum('total'))['total__sum'] or 0)
    total_pedidos_hoy = pedidos_hoy.count()
    cancelados_hoy = pedidos_hoy.filter(estado='cancelado').count()
    cancelados_en_cocina = pedidos_hoy.filter(estado='cancelado', cancelado_en_estado__in=['cocinando', 'listo', 'entregado']).count()
    
    # Top productos (solo pagados, filtrados por hoy para performance)
    productos = {}
    for pedido in pedidos_hoy.filter(estado='pagado'):
        for item in pedido.items:
            nombre = item.get('producto_nombre', 'Sin nombre')
            cantidad = item.get('cantidad', 1)
            precio = float(item.get('precio', 0))
            
            if nombre in productos:
                productos[nombre]['cantidad'] += cantidad
                productos[nombre]['total'] += cantidad * precio
            else:
                productos[nombre] = {'nombre': nombre, 'cantidad': cantidad, 'total': cantidad * precio}
    
    stats = {
        'ventas_hoy': ventas_hoy,
        'total_pedidos_hoy': total_pedidos_hoy,
        'cancelados_hoy': cancelados_hoy,
        'cancelados_en_cocina': cancelados_en_cocina,
        'top_productos': sorted(productos.values(), key=lambda x: x['cantidad'], reverse=True)[:5],
        'pedidos_recientes': list(pedidos_hoy.filter(estado__in=['pendiente', 'cocinando', 'listo', 'entregado']).order_by('-created_at')[:10].values('id', 'mesa__numero', 'total', 'created_at', 'estado')),
    }
    
    return JsonResponse({'success': True, 'data': stats})


@require_http_methods(["GET"])
@requiere_autenticacion
def ventas_hoy(request):
    """Ventas del día"""
    today = timezone.now().date()
    resultado = _scope(request, Pedido.objects.filter(
        estado='pagado',
        created_at__date=today
    )).aggregate(
        total_ordenes=Count('id'),
        monto_total=Sum('total')
    )
    return JsonResponse({
        'success': True,
        'data': {
            'total_ordenes': resultado['total_ordenes'] or 0,
            'monto_total': resultado['monto_total'] or 0
        }
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def ventas_fecha(request):
    """Ventas por rango de fechas"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    
    pedidos = _scope(request, Pedido.objects.filter(estado='pagado'))
    
    if fecha_inicio:
        pedidos = pedidos.filter(created_at__date__gte=fecha_inicio)
    if fecha_fin:
        pedidos = pedidos.filter(created_at__date__lte=fecha_fin)
    
    resultado = pedidos.annotate(
        fecha=TruncDate('created_at')
    ).values('fecha').annotate(
        total_ordenes=Count('id'),
        monto_total=Sum('total')
    ).order_by('-fecha')
    
    return JsonResponse({
        'success': True,
        'data': list(resultado)
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def productos_mas_vendidos(request):
    """Productos más vendidos"""
    limite = int(request.GET.get('limite', 10))
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    
    pedidos = _scope(request, Pedido.objects.filter(estado='pagado'))
    if fecha_inicio:
        pedidos = pedidos.filter(created_at__date__gte=fecha_inicio)
    if fecha_fin:
        pedidos = pedidos.filter(created_at__date__lte=fecha_fin)
    
    productos = {}
    
    for pedido in pedidos:
        for item in pedido.items:
            nombre = item.get('producto_nombre', 'Sin nombre')
            cantidad = item.get('cantidad', 1)
            precio = item.get('precio', 0)
            
            if nombre in productos:
                productos[nombre]['cantidad'] += cantidad
                productos[nombre]['monto'] += cantidad * precio
            else:
                productos[nombre] = {
                    'producto_nombre': nombre,
                    'cantidad': cantidad,
                    'monto': cantidad * precio
                }
    
    # Ordenar por cantidad
    lista = sorted(productos.values(), key=lambda x: x['cantidad'], reverse=True)
    return JsonResponse({
        'success': True,
        'data': lista[:limite]
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def ventas_metodo_pago(request):
    """Ventas por método de pago"""
    today = timezone.now().date()
    
    resultado = _scope(request, Pedido.objects.filter(
        estado='pagado',
        created_at__date=today
    )).values('metodo_pago').annotate(
        cantidad=Count('id'),
        monto=Sum('total')
    )
    
    return JsonResponse({
        'success': True,
        'data': list(resultado)
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def resumen_general(request):
    """Resumen general"""
    today = timezone.now().date()
    
    # Hoy
    hoy = _scope(request, Pedido.objects.filter(
        estado='pagado',
        created_at__date=today
    )).aggregate(
        ordenes=Count('id'),
        ventas=Sum('total')
    )
    
    # Esta semana
    semana = _scope(request, Pedido.objects.filter(
        estado='pagado',
        created_at__date__gte=today - timedelta(days=7)
    )).aggregate(
        ordenes=Count('id'),
        ventas=Sum('total')
    )
    
    # Este mes
    mes = _scope(request, Pedido.objects.filter(
        estado='pagado',
        created_at__month=today.month,
        created_at__year=today.year
    )).aggregate(
        ordenes=Count('id'),
        ventas=Sum('total')
    )
    
    return JsonResponse({
        'success': True,
        'data': {
            'hoy': {
                'ordenes': hoy['ordenes'] or 0,
                'ventas': float(hoy['ventas'] or 0)
            },
            'semana': {
                'ordenes': semana['ordenes'] or 0,
                'ventas': float(semana['ventas'] or 0)
            },
            'mes': {
                'ordenes': mes['ordenes'] or 0,
                'ventas': float(mes['ventas'] or 0)
            }
        }
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def resumen_completo(request):
    """Resumen completo con todos los KPIs"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    estado = request.GET.get('estado', 'todos')
    
    today = timezone.now().date()
    
    if not fecha_inicio:
        fecha_inicio = today.isoformat()
    if not fecha_fin:
        fecha_fin = today.isoformat()
    
    pedidos = _scope(request, Pedido.objects.filter(
        created_at__date__gte=fecha_inicio,
        created_at__date__lte=fecha_fin
    ))
    
    if estado != 'todos':
        pedidos = pedidos.filter(estado=estado)
    
    total_pedidos = pedidos.count()
    ventas_totales = float(pedidos.filter(estado='pagado').aggregate(Sum('total'))['total__sum'] or 0)
    pagados_count = pedidos.filter(estado='pagado').count()
    ticket_promedio = ventas_totales / pagados_count if pagados_count > 0 else 0

    cancelados = pedidos.filter(estado='cancelado')
    total_cancelados = cancelados.count()
    cancelados_en_cocina = cancelados.filter(cancelado_en_estado__in=['cocinando', 'listo', 'entregado']).count()
    tasa_cancelacion = (cancelados_en_cocina / total_pedidos * 100) if total_pedidos > 0 else 0

    motivos_cancelacion = list(cancelados.exclude(motivo_cancelacion='').exclude(motivo_cancelacion__isnull=True).values('motivo_cancelacion').annotate(
        cantidad=Count('id')
    ).order_by('-cantidad')[:10])

    pendientes = pedidos.filter(estado='pendiente').count()
    cocinado = pedidos.filter(estado='cocinando').count()
    listos = pedidos.filter(estado='listo').count()
    pagados = pedidos.filter(estado='pagado').count()

    return JsonResponse({
        'success': True,
        'data': {
            'ventas_totales': ventas_totales,
            'total_pedidos': total_pedidos,
            'ticket_promedio': round(ticket_promedio, 2),
            'tasa_cancelacion': round(tasa_cancelacion, 2),
            'total_cancelados': total_cancelados,
            'cancelados_en_cocina': cancelados_en_cocina,
            'motivos_cancelacion': motivos_cancelacion,
            'pedidos_por_estado': {
                'pendiente': pendientes,
                'cocinando': cocinado,
                'listo': listos,
                'pagado': pagados,
                'cancelado': total_cancelados
            }
        }
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def ventas_por_dia(request):
    """Ventas por día para gráficos - últimos 30 días"""
    dias = int(request.GET.get('dias', 7))
    estado = request.GET.get('estado', 'pagado')
    
    today = timezone.now().date()
    fecha_inicio = today - timedelta(days=dias)
    
    pedidos = _scope(request, Pedido.objects.filter(created_at__date__gte=fecha_inicio))
    
    if estado != 'todos':
        pedidos = pedidos.filter(estado=estado)
    
    ventas_diarias = pedidos.annotate(
        fecha=TruncDate('created_at')
    ).values('fecha').annotate(
        pedidos=Count('id'),
        ventas=Sum('total')
    ).order_by('fecha')
    
    result = []
    for v in ventas_diarias:
        result.append({
            'fecha': v['fecha'].isoformat() if v['fecha'] else None,
            'pedidos': v['pedidos'],
            'ventas': float(v['ventas'] or 0)
        })
    
    return JsonResponse({
        'success': True,
        'data': result
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def productos_estadisticas(request):
    """Productos más vendidos con estadísticas detalladas"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    limite = int(request.GET.get('limite', 10))
    estado = request.GET.get('estado', 'pagado')
    
    today = timezone.now().date()
    if not fecha_inicio:
        fecha_inicio = (today - timedelta(days=30)).isoformat()
    if not fecha_fin:
        fecha_fin = today.isoformat()
    
    pedidos = _scope(request, Pedido.objects.filter(
        created_at__date__gte=fecha_inicio,
        created_at__date__lte=fecha_fin
    ))
    
    if estado != 'todos':
        pedidos = pedidos.filter(estado=estado)
    
    productos = {}
    for pedido in pedidos:
        for item in pedido.items:
            nombre = item.get('producto_nombre', 'Sin nombre')
            cantidad = int(item.get('cantidad', 1))
            precio = float(item.get('precio', 0))
            
            if nombre in productos:
                productos[nombre]['cantidad'] += cantidad
                productos[nombre]['ventas'] += cantidad * precio
            else:
                productos[nombre] = {
                    'nombre': nombre,
                    'cantidad': cantidad,
                    'ventas': cantidad * precio
                }
    
    lista = sorted(productos.values(), key=lambda x: x['ventas'], reverse=True)
    
    producto_top = lista[0] if lista else {'nombre': 'Sin datos', 'cantidad': 0, 'ventas': 0}
    
    return JsonResponse({
        'success': True,
        'data': {
            'productos': lista[:limite],
            'producto_top': producto_top
        }
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def metodos_pago_estadisticas(request):
    """Estadísticas por método de pago"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    estado = request.GET.get('estado', 'pagado')
    
    today = timezone.now().date()
    if not fecha_inicio:
        fecha_inicio = today.isoformat()
    if not fecha_fin:
        fecha_fin = today.isoformat()
    
    pedidos = _scope(request, Pedido.objects.filter(
        created_at__date__gte=fecha_inicio,
        created_at__date__lte=fecha_fin
    ))
    
    if estado != 'todos':
        pedidos = pedidos.filter(estado=estado)
    
    resultado = pedidos.values('metodo_pago').annotate(
        cantidad=Count('id'),
        monto=Sum('total')
    ).order_by('-monto')
    
    efectivo = 0
    transferencia = 0
    tarjeta = 0
    
    for r in resultado:
        monto = float(r['monto'] or 0)
        if r['metodo_pago'] == 'efectivo':
            efectivo = monto
        elif r['metodo_pago'] == 'transferencia':
            transferencia = monto
        elif r['metodo_pago'] == 'tarjeta':
            tarjeta = monto
    
    return JsonResponse({
        'success': True,
        'data': {
            'efectivo': efectivo,
            'transferencia': transferencia,
            'tarjeta': tarjeta,
            'detalle': list(resultado)
        }
    })


@require_http_methods(["GET"])
@requiere_autenticacion
def pedidos_lista(request):
    """Lista de pedidos con filtros"""
    fecha_inicio = request.GET.get('fecha_inicio')
    fecha_fin = request.GET.get('fecha_fin')
    estado = request.GET.get('estado', 'todos')
    limit = int(request.GET.get('limit', 50))
    offset = int(request.GET.get('offset', 0))
    
    today = timezone.now().date()
    if not fecha_inicio:
        fecha_inicio = today.isoformat()
    if not fecha_fin:
        fecha_fin = today.isoformat()
    
    pedidos = _scope(request, Pedido.objects.filter(
        created_at__date__gte=fecha_inicio,
        created_at__date__lte=fecha_fin
    )).order_by('-created_at')
    
    if estado != 'todos':
        pedidos = pedidos.filter(estado=estado)
    
    total = pedidos.count()
    pedidos_lista = pedidos[offset:offset+limit]
    
    data = []
    for p in pedidos_lista:
        data.append({
            'id': p.id,
            'numero_orden': p.numero_orden,
            'mesa': p.mesa.numero if p.mesa else None,
            'delivery': p.delivery,
            'nombre_cliente': p.nombre_cliente,
            'estado': p.estado,
            'total': float(p.total),
            'metodo_pago': p.metodo_pago,
            'created_at': p.created_at.isoformat() if p.created_at else None
        })
    
    return JsonResponse({
        'success': True,
        'data': {
            'pedidos': data,
            'total': total,
            'limit': limit,
            'offset': offset
        }
    })