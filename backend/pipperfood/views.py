import os
import sys
import socket
import json
import subprocess
import re
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from .licencia import license_manager
from django.conf import settings


def _get_local_ips():
    """Devuelve la IP real de la PC conectada a la red local"""
    ip = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(1)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass
    if ip and not ip.startswith('127.'):
        return [ip]
    hostname = socket.gethostname()
    try:
        for info in socket.getaddrinfo(hostname, None):
            if info[0] == socket.AF_INET:
                addr = info[4][0]
                if not addr.startswith('127.'):
                    return [addr]
    except Exception:
        pass
    try:
        result = subprocess.run(['ipconfig'], capture_output=True, text=True, timeout=5)
        todas = set(re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', result.stdout))
        gateways = set()
        for line in result.stdout.split('\n'):
            ips_linea = re.findall(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', line)
            for gw_ip in ips_linea:
                partes = gw_ip.split('.')
                if partes[3] in ('1', '254'):
                    gateways.add(gw_ip)
        for ip_raw in todas:
            partes = ip_raw.split('.')
            if len(partes) != 4:
                continue
            try:
                p = [int(x) for x in partes]
            except ValueError:
                continue
            if p[0] == 127 or p[0] == 0 or (p[0] == 169 and p[1] == 254):
                continue
            if ip_raw in gateways:
                continue
            return [ip_raw]
    except Exception:
        pass
    return ['127.0.0.1']


def info_empresa(request):
    """Obtiene información de la empresa"""
    from apps.facturacion.models import Configuracion
    try:
        config = Configuracion.objects.first()
        if config:
            return JsonResponse({
                'empresa': config.nombre_empresa,
                'ruc': config.ruc,
                'direccion': config.direccion,
                'telefono': config.telefono,
                'version': '1.0.0'
            })
    except Exception:
        pass
    return JsonResponse({
        'empresa': 'karuAPP',
        'ruc': '5418755-8',
        'version': '1.0.0'
    })


def verificar_suscripcion(request):
    """Verifica el estado de la suscripción"""
    lic = license_manager.verificar()
    estado = lic['estado']
    if estado == 'expirado':
        estado = 'bloqueada'
    return JsonResponse({
        'estado': estado,
        'dias_restantes': lic['dias_restantes'],
        'mensaje': lic['mensaje']
    })


def obtener_ip_local(request):
    """Obtiene las IPs locales del servidor"""
    hostname = socket.gethostname()
    ips = _get_local_ips()
    urls = [f'http://{ip}:8000' for ip in ips]
    return JsonResponse({
        'ip': ips[0] if ips else '127.0.0.1',
        'ips': ips,
        'hostname': hostname,
        'urls': urls,
        'url_principal': urls[0] if urls else f'http://{hostname}:8000',
        'url_hostname': f'http://{hostname}:8000',
    })


@csrf_exempt
@require_http_methods(["GET"])
def verificar_licencia(request):
    """Verifica el estado de la licencia (endpoint legacy)"""
    lic = license_manager.verificar()
    estado = lic['estado']
    if estado == 'expirado':
        estado = 'bloqueada'
    return JsonResponse({
        'success': estado != 'bloqueada',
        'licencia_valida': estado not in ('bloqueada', 'expirado'),
        'estado': estado,
        'dias_restantes': lic['dias_restantes'],
        'mensaje': lic['mensaje']
    })


@require_http_methods(["GET"])
def print_token(request):
    return JsonResponse({'success': True, 'token': settings.PRINT_API_TOKEN})

@require_http_methods(["GET"])
def qr_conexion(request):
    hostname = socket.gethostname()
    ips = _get_local_ips()
    urls = [f'http://{ip}:8000' for ip in ips]
    url_principal = urls[0] if urls else f'http://{hostname}:8000'
    try:
        import qrcode
        from io import BytesIO
        import base64
        img = qrcode.make(url_principal)
        buf = BytesIO()
        img.save(buf, format='PNG')
        qr_b64 = base64.b64encode(buf.getvalue()).decode()
    except Exception:
        qr_b64 = None
    return JsonResponse({
        'hostname': hostname,
        'ips': ips,
        'urls': urls,
        'url_principal': url_principal,
        'qr_base64': qr_b64,
    })

from pathlib import Path
import datetime

@require_http_methods(["GET"])
def backup_status(request):
    backup_dir = Path(__file__).parent.parent / 'backups'
    info = []
    if backup_dir.exists():
        backups = sorted(backup_dir.glob('karuapp_backup_*.db'), key=os.path.getmtime, reverse=True)
        for b in backups:
            info.append({
                'nombre': b.name,
                'tamano': b.stat().st_size,
                'fecha': datetime.datetime.fromtimestamp(b.stat().st_mtime).isoformat()
            })
    return JsonResponse({'ok': True, 'backups': info, 'total': len(info)})


@csrf_exempt
@require_http_methods(["POST"])
def backup_run(request):
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        body = {}
    mode = body.get('mode', 'local')
    tag = body.get('tag', '')

    script = Path(__file__).parent.parent / 'backup_db.py'
    cmd = [sys.executable, str(script)]
    if mode == 'rclone':
        cmd.append('--rclone')
    elif mode == 'upload':
        cmd.append('--upload')
    if tag:
        cmd.extend(['--tag', tag])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        output = result.stdout.strip()
        if result.returncode != 0:
            return JsonResponse({'ok': False, 'error': result.stderr[:500]}, status=500)
        try:
            data = json.loads(output)
            return JsonResponse(data)
        except json.JSONDecodeError:
            return JsonResponse({'ok': True, 'raw': output})
    except subprocess.TimeoutExpired:
        return JsonResponse({'ok': False, 'error': 'Backup timeout (2 min)'}, status=500)
    except Exception as e:
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def activar_licencia(request):
    """Endpoint legacy - ahora la activación se maneja desde karuAPP"""
    return JsonResponse({
        'success': False,
        'error': 'La activación ahora se gestiona desde karuAPP Dashboard'
    })