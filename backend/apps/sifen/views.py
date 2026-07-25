import json
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from apps.facturacion.models import Configuracion, Factura
from .sifen_service import (
    SIFEN_AVAILABLE, generar_de01, transmitir_sincrono,
    consultar_por_cdc,
    extraer_cdc,
)
from .kude_service import KUDE_AVAILABLE
from apps.usuarios.decorators import requiere_autenticacion, requiere_rol
from pipperfood.middleware import _scope, _scope_get, _get_restaurante

logger = logging.getLogger(__name__)


@require_http_methods(["GET"])
@requiere_autenticacion
def get_sifen_status(request):
    """Returns SIFEN integration status"""
    config = _scope(request, Configuracion.objects).first()
    return JsonResponse({
        'success': True,
        'sifen_disponible': SIFEN_AVAILABLE,
        'kude_disponible': KUDE_AVAILABLE,
        'sifen_habilitado': bool(config and config.sifen_habilitado),
        'certificado_configurado': bool(config and config.certificado_pkcs12),
        'csc_configurado': bool(config and config.csc),
        'ambiente': config.ambiente_sifen if config else 'test',
        'empresa': config.nombre_empresa if config else None,
    })


@csrf_exempt
@require_http_methods(["PUT"])
@requiere_rol('administrador')
def upload_certificate(request):
    """Upload PKCS12 certificate file"""
    try:
        config = _scope(request, Configuracion.objects).first()
        if not config:
            return JsonResponse({'success': False, 'error': 'Configure la empresa primero'}, status=400)

        data = json.loads(request.body) if request.body else {}
        if 'certificado' in request.FILES:
            config.certificado_pkcs12 = request.FILES['certificado']
        if data.get('pin'):
            config.csc_pin = data.get('pin')
        if data.get('csc'):
            config.csc = data.get('csc')
        config.save()

        return JsonResponse({
            'success': True,
            'certificado': config.certificado_pkcs12.url if config.certificado_pkcs12 else None,
            'csc_configurado': bool(config.csc),
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
def transmitir_factura(request):
    """Generates DE-01, signs, transmits to SIFEN"""
    try:
        data = json.loads(request.body) if request.body else {}
        pedido_id = data.get('pedido_id')
        cliente_ruc = data.get('cliente_ruc', '44444444-7')
        cliente_nombre = data.get('cliente_nombre', 'CONSUMIDOR FINAL')

        if not SIFEN_AVAILABLE:
            return JsonResponse({
                'success': False,
                'error': 'Librería SIFEN no instalada. Ejecute: pip install sifen[sign,transmissao]'
            }, status=500)

        config = _scope(request, Configuracion.objects).first()
        if not config:
            return JsonResponse({'success': False, 'error': 'Configure la empresa primero'}, status=400)

        if not config.certificado_pkcs12:
            return JsonResponse({
                'success': False,
                'error': 'Debe subir un certificado digital .p12 en Configuración'
            }, status=400)

        from apps.pedidos.models import Pedido
        try:
            pedido = _scope_get(request, Pedido, pedido_id)
        except Pedido.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Pedido no encontrado'}, status=404)

        factura, created = _scope(request, Factura.objects).get_or_create(
            pedido=pedido,
            estado='borrador',
            defaults={
                'numero': str(pedido.id).zfill(7),
                'ruc_cliente': cliente_ruc,
                'nombre_cliente': cliente_nombre,
                'total': pedido.total or 0,
                'restaurante': _get_restaurante(request),
            }
        )

        if not created:
            factura.ruc_cliente = cliente_ruc
            factura.nombre_cliente = cliente_nombre
            factura.total = pedido.total or 0

        pedido_data = {
            'numero_factura': factura.numero,
            'items': list(pedido.items.values(
                'producto_nombre', 'cantidad', 'precio', 'variante',
                'producto_id', 'nota'
            )),
            'total': float(pedido.total or 0),
        }
        rde = generar_de01(pedido_data, config, cliente_ruc, cliente_nombre)

        cert_data = config.certificado_pkcs12.read()
        password = config.csc_pin or ''

        factura.xml = rde.to_xml()
        factura.save()

        try:
            result = transmitir_sincrono(rde, cert_data, password, config.ambiente_sifen)
            factura.protocolo = str(result)
            factura.cdc = extraer_cdc(result)
            factura.estado = 'generada'
            factura.save()
            return JsonResponse({
                'success': True,
                'factura': {
                    'id': factura.id,
                    'numero': factura.numero,
                    'cdc': factura.cdc,
                    'estado': factura.estado,
                }
            })
        except Exception as e:
            error_msg = str(e)
            factura.estado = 'rechazado'
            factura.protocolo = error_msg
            factura.save()
            logger.error(f'SIFEN transmission failed: {error_msg}')
            return JsonResponse({
                'success': False,
                'error': f'Error al transmitir a SIFEN: {error_msg}',
                'factura_id': factura.id,
            }, status=500)

    except Exception as e:
        logger.error(f'Error in transmitir_factura: {e}', exc_info=True)
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
def consultar_factura(request, cdc):
    """Consult SIFEN for invoice status by CDC"""
    try:
        config = _scope(request, Configuracion.objects).first()
        if not config or not config.certificado_pkcs12:
            return JsonResponse({'success': False, 'error': 'Certificado no configurado'}, status=400)

        if not SIFEN_AVAILABLE:
            return JsonResponse({'success': False, 'error': 'Librería SIFEN no instalada'}, status=500)

        cert_data = config.certificado_pkcs12.read()
        result = consultar_por_cdc(cdc, cert_data, config.csc_pin or '', config.ambiente_sifen)
        return JsonResponse({'success': True, 'resultado': str(result)})

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
