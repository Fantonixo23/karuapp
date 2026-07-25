import json
import urllib.request
import urllib.parse
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from apps.usuarios.decorators import requiere_autenticacion, requiere_rol
from pipperfood.middleware import _scope, _scope_get, _get_restaurante
from .models import Configuracion, Timbrado, Factura, MetodoPago
from apps.pedidos.models import Pedido


@require_http_methods(["GET"])
@requiere_autenticacion
def get_config(request):
    """Obtiene la configuraciÃ³n"""
    config = _scope(request, Configuracion.objects).first()
    if not config:
        config = Configuracion.objects.create(
            restaurante=_get_restaurante(request),
            nombre_empresa='Mi Restaurant',
            ruc='44444444-7',
            direccion='Sin direcciÃ³n',
            telefono='0000000000',
            tasa_iva=10,
            timbrado_numero='001-001-0000001',
            establecimiento='001',
            punto_expedicion='001',
            estado='activo'
        )
    return JsonResponse({
        'success': True,
        'config': {
            'id': config.id,
            'nombre_empresa': config.nombre_empresa,
            'ruc': config.ruc,
            'direccion': config.direccion,
            'telefono': config.telefono,
            'tasa_iva': str(config.tasa_iva),
            'timbrado_numero': config.timbrado_numero or '001-001-0000001',
            'establecimiento': config.establecimiento or '001',
            'punto_expedicion': config.punto_expedicion or '001',
            'estado': config.estado,
            'fecha_inicio': config.fecha_inicio.isoformat() if config.fecha_inicio else None,
            'fecha_vencimiento': config.fecha_vencimiento.isoformat() if config.fecha_vencimiento else None,
            'tamano_papel': config.tamano_papel or '58mm',
            # SIFEN fields
            'sifen_habilitado': config.sifen_habilitado,
            'ambiente_sifen': config.ambiente_sifen or 'test',
            'certificado_configurado': bool(config.certificado_pkcs12),
            'certificado_nombre': config.certificado_pkcs12.name.split('/')[-1] if config.certificado_pkcs12 else None,
            'csc_configurado': bool(config.csc),
            'csc_id': config.csc_id,
            'cDepEmi': config.cDepEmi,
            'cCiuEmi': config.cCiuEmi,
            'dDesDepEmi': config.dDesDepEmi,
            'dDesCiuEmi': config.dDesCiuEmi,
            'cDirEmi': config.cDirEmi,
            'dNumCas': config.dNumCas,
            'dEmailE': config.dEmailE,
            'gActEco_codigo': config.gActEco_codigo,
            'gActEco_descripcion': config.gActEco_descripcion,
        }
    })


@csrf_exempt
@require_http_methods(["PUT"])
@requiere_rol('administrador')
def update_config(request):
    """Actualiza la configuraciÃ³n"""
    try:
        data = json.loads(request.body)
        config = _scope(request, Configuracion.objects).first()
        
        if not config:
            config = Configuracion.objects.create(
                restaurante=_get_restaurante(request),
                nombre_empresa=data.get('nombre_empresa', 'Mi Restaurant'),
                ruc=data.get('ruc', '5418755-8')
            )
        else:
            config.nombre_empresa = data.get('nombre_empresa', config.nombre_empresa)
            config.ruc = data.get('ruc', config.ruc)
            config.direccion = data.get('direccion', config.direccion)
            config.telefono = data.get('telefono', config.telefono)
            config.tasa_iva = data.get('tasa_iva', config.tasa_iva)
            config.timbrado_numero = data.get('timbrado_numero', config.timbrado_numero)
            config.establecimiento = data.get('establecimiento', config.establecimiento)
            config.punto_expedicion = data.get('punto_expedicion', config.punto_expedicion)
            config.tamano_papel = data.get('tamano_papel', config.tamano_papel)
            # SIFEN fields
            config.sifen_habilitado = data.get('sifen_habilitado', config.sifen_habilitado)
            config.ambiente_sifen = data.get('ambiente_sifen', config.ambiente_sifen)
            config.csc = data.get('csc', config.csc)
            config.csc_pin = data.get('csc_pin', config.csc_pin)
            config.csc_id = data.get('csc_id', config.csc_id)
            config.cDepEmi = data.get('cDepEmi', config.cDepEmi)
            config.cCiuEmi = data.get('cCiuEmi', config.cCiuEmi)
            config.dDesDepEmi = data.get('dDesDepEmi', config.dDesDepEmi)
            config.dDesCiuEmi = data.get('dDesCiuEmi', config.dDesCiuEmi)
            config.cDirEmi = data.get('cDirEmi', config.cDirEmi)
            config.dNumCas = data.get('dNumCas', config.dNumCas)
            config.dEmailE = data.get('dEmailE', config.dEmailE)
            config.gActEco_codigo = data.get('gActEco_codigo', config.gActEco_codigo)
            config.gActEco_descripcion = data.get('gActEco_descripcion', config.gActEco_descripcion)
            config.save()
        
        return JsonResponse({
            'success': True,
            'config': {
                'nombre_empresa': config.nombre_empresa,
                'ruc': config.ruc,
                'direccion': config.direccion,
                'telefono': config.telefono,
                'timbrado_numero': config.timbrado_numero,
                'establecimiento': config.establecimiento,
                'punto_expedicion': config.punto_expedicion,
                'sifen_habilitado': config.sifen_habilitado,
                'ambiente_sifen': config.ambiente_sifen,
                'csc_configurado': bool(config.csc),
                'csc_id': config.csc_id,
                'certificado_configurado': bool(config.certificado_pkcs12),
            }
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def lista_timbrados(request):
    """Lista timbrados"""
    timbrados = _scope(request, Timbrado.objects).all().order_by('-id')
    data = [{
        'id': t.id,
        'establecimiento': t.establecimiento,
        'punto_expedicion': t.punto_expedicion,
        'numero_inicio': t.numero_inicio,
        'numero_fin': t.numero_fin,
        'numero_actual': t.numero_actual,
        'fecha_vencimiento': t.fecha_vencimiento.isoformat() if t.fecha_vencimiento else None,
        'activo': t.activo
    } for t in timbrados]
    return JsonResponse({'success': True, 'timbrados': data})


@csrf_exempt
@require_http_methods(["POST"])
@requiere_rol('administrador')
def crear_timbrado(request):
    """Crea un timbrado"""
    try:
        data = json.loads(request.body)
        timbrado = Timbrado.objects.create(
            restaurante=_get_restaurante(request),
            establecimiento=data.get('establecimiento', '001'),
            punto_expedicion=data.get('punto_expedicion', '001'),
            numero_inicio=data.get('numero_inicio'),
            numero_fin=data.get('numero_fin'),
            numero_actual=data.get('numero_inicio', 1) - 1,
            fecha_vencimiento=data.get('fecha_vencimiento')
        )
        return JsonResponse({
            'success': True,
            'timbrado': {'id': timbrado.id}
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def generar_factura(request):
    """Genera factura electrÃ³nica con SIFEN (sandbox)"""
    try:
        data = json.loads(request.body)
        pedido_id = data.get('pedido_id')
        ruc_cliente = data.get('ruc_cliente', '44444444-7')
        nombre_cliente = data.get('nombre_cliente', 'CONSUMIDOR FINAL')
        
        config = _scope(request, Configuracion.objects).first()
        if not config:
            return JsonResponse({
                'success': False,
                'error': 'Configure la empresa primero'
            }, status=400)
        
        from apps.pedidos.models import Pedido
        pedido = _scope(request, Pedido.objects).get(pk=pedido_id)

        # Consumir nÃºmero secuencial del timbrado (se revertirÃ¡ si falla)
        timbrado = _scope(request, Timbrado.objects.filter(activo=True)).first()
        if not timbrado:
            numero = str(1).zfill(7)
        else:
            timbrado.numero_actual += 1
            timbrado.save()
            numero = str(timbrado.numero_actual).zfill(7)

        try:
            # Preparar datos del cliente
            cliente_data = {
                "ruc": ruc_cliente,
                "nombre": nombre_cliente,
                "direccion": data.get('cliente_direccion', ''),
                "telefono": data.get('cliente_telefono', ''),
            }

            # Usar SIFEN para generar factura completa
            from .sifen import generar_factura_completa

            pedido_dict = {
                "numero_orden": numero,
                "items": pedido.items or [],
                "total": float(pedido.total),
            }

            sifen_result = generar_factura_completa(config, pedido_dict, cliente_data)

            factura = Factura.objects.create(
                restaurante=_get_restaurante(request),
                numero=numero,
                pedido=pedido,
                ruc_cliente=ruc_cliente,
                nombre_cliente=nombre_cliente,
                xml=sifen_result["xml"],
                cdc=sifen_result["cdc"],
                kude=sifen_result["kude"],
                qr_base64=sifen_result["qr_base64"],
                estado='generada',
                total=sifen_result["total"],
            )
        except Exception:
            if timbrado:
                timbrado.numero_actual -= 1
                timbrado.save()
            raise
        
        return JsonResponse({
            'success': True,
            'factura': {
                'numero': factura.numero,
                'cdc': factura.cdc,
                'kude': factura.kude,
                'qr_base64': factura.qr_base64,
                'xml': factura.xml,
                'total': str(factura.total),
                'sifen_result': sifen_result["sifen_result"],
            }
        })
    except Pedido.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Pedido no encontrado'}, status=404)
    except Exception as e:
        import traceback
        return JsonResponse({
            'success': False,
            'error': str(e),
            'trace': traceback.format_exc()
        }, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def lista_facturas(request):
    """Lista facturas"""
    facturas = _scope(request, Factura.objects).all().order_by('-created_at')[:50]
    data = [{
        'id': f.id,
        'numero': f.numero,
        'ruc_cliente': f.ruc_cliente,
        'nombre_cliente': f.nombre_cliente,
        'estado': f.estado,
        'total': str(f.total),
        'created_at': f.created_at.isoformat() if f.created_at else None
    } for f in facturas]
    return JsonResponse({'success': True, 'facturas': data})


# ========== MÃ‰TODOS DE PAGO ==========

@require_http_methods(["GET"])
@requiere_autenticacion
def lista_metodos_pago(request):
    """Lista todos los mÃ©todos de pago"""
    if not _scope(request, MetodoPago.objects).exists():
        defaults = [
            {'nombre': 'efectivo', 'etiqueta': 'Efectivo', 'icono': 'payments', 'color': '#4CAF50', 'orden': 1},
            {'nombre': 'tarjeta', 'etiqueta': 'DÃ©bito/CrÃ©dito', 'icono': 'credit_card', 'color': '#9C27B0', 'orden': 2},
            {'nombre': 'transferencia', 'etiqueta': 'Transferencia', 'icono': 'account_balance', 'color': '#2196F3', 'orden': 3},
            {'nombre': 'qr', 'etiqueta': 'QR', 'icono': 'qr_code', 'color': '#00BCD4', 'orden': 4},
        ]
        for d in defaults:
            MetodoPago.objects.create(restaurante=_get_restaurante(request), **d)
    metodos = _scope(request, MetodoPago.objects).all().order_by('orden')
    data = [{
        'id': m.id,
        'nombre': m.nombre,
        'etiqueta': m.etiqueta,
        'icono': m.icono,
        'color': m.color,
        'activo': m.activo,
        'orden': m.orden
    } for m in metodos]
    return JsonResponse({'success': True, 'metodos': data})


@csrf_exempt
@require_http_methods(["POST"])
@requiere_rol('administrador')
def crear_metodo_pago(request):
    """Crea un nuevo mÃ©todo de pago"""
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre', '').strip().lower().replace(' ', '_')
        if not nombre:
            return JsonResponse({'success': False, 'error': 'El nombre es requerido'}, status=400)
        if _scope(request, MetodoPago.objects.filter(nombre=nombre)).exists():
            return JsonResponse({'success': False, 'error': 'Ya existe un mÃ©todo con ese nombre'}, status=400)
        metodo = MetodoPago.objects.create(
            restaurante=_get_restaurante(request),
            nombre=nombre,
            etiqueta=data.get('etiqueta', nombre),
            icono=data.get('icono', 'payments'),
            color=data.get('color', '#4CAF50'),
            activo=data.get('activo', True),
            orden=data.get('orden', 0)
        )
        return JsonResponse({
            'success': True,
            'metodo': {
                'id': metodo.id,
                'nombre': metodo.nombre,
                'etiqueta': metodo.etiqueta,
                'icono': metodo.icono,
                'color': metodo.color,
                'activo': metodo.activo,
                'orden': metodo.orden
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["PUT"])
@requiere_rol('administrador')
def actualizar_metodo_pago(request, pk):
    """Actualiza un mÃ©todo de pago"""
    try:
        data = json.loads(request.body)
        try:
            metodo = _scope_get(request, MetodoPago, pk)
        except MetodoPago.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'MÃ©todo no encontrado'}, status=404)

        if 'nombre' in data:
            nombre = data['nombre'].strip().lower().replace(' ', '_')
            if nombre != metodo.nombre and _scope(request, MetodoPago.objects.filter(nombre=nombre)).exists():
                return JsonResponse({'success': False, 'error': 'Ya existe un mÃ©todo con ese nombre'}, status=400)
            metodo.nombre = nombre
        if 'etiqueta' in data:
            metodo.etiqueta = data['etiqueta']
        if 'icono' in data:
            metodo.icono = data['icono']
        if 'color' in data:
            metodo.color = data['color']
        if 'activo' in data:
            metodo.activo = data['activo']
        if 'orden' in data:
            metodo.orden = data['orden']
        metodo.save()

        return JsonResponse({
            'success': True,
            'metodo': {
                'id': metodo.id,
                'nombre': metodo.nombre,
                'etiqueta': metodo.etiqueta,
                'icono': metodo.icono,
                'color': metodo.color,
                'activo': metodo.activo,
                'orden': metodo.orden
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
@requiere_rol('administrador')
def eliminar_metodo_pago(request, pk):
    """Elimina un mÃ©todo de pago"""
    try:
        metodo = _scope_get(request, MetodoPago, pk)
        metodo.delete()
        return JsonResponse({'success': True})
    except MetodoPago.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'MÃ©todo no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def buscar_cliente_ruc(request):
    """Busca contribuyentes usando la API de TuRuc (consulta DNIT)"""
    q = request.GET.get('q', '').strip()
    if len(q) < 3:
        return JsonResponse({'success': True, 'resultados': []})
    try:
        url = f'https://turuc.com.py/api/contribuyente/search?search={urllib.parse.quote(q)}&page=0'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read().decode())
        contribuyentes = data.get('data', {}).get('contribuyentes', [])
        resultados = [{'ruc': c['ruc'], 'nombre': c['razonSocial']} for c in contribuyentes]
        return JsonResponse({'success': True, 'resultados': resultados})
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return JsonResponse({'success': False, 'error': 'Servicio de consulta RUC temporalmente no disponible. Intente más tarde.'}, status=503)
        return JsonResponse({'success': False, 'error': f'Error del servicio RUC ({e.code})'}, status=502)
    except Exception as e:
        return JsonResponse({'success': False, 'error': 'Error al consultar RUC. Verifique su conexión a internet.'}, status=500)