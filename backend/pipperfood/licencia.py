import os
import json
import logging
import hashlib
import subprocess
import re
from datetime import datetime, timedelta

import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)


def _get_hardware_id():
    """Genera un ID único basado en hardware (UUID de placa madre + computername)"""
    hid = 'unknown'
    try:
        result = subprocess.run('wmic csproduct get uuid /value', capture_output=True, text=True, timeout=5, shell=True)
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if 'UUID=' in line:
                    hid = line.split('=', 1)[1].strip()
                    break
    except Exception:
        pass
    if not hid or hid == 'unknown':
        try:
            result = subprocess.run('getmac /FO CSV /NH', capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if lines and lines[0]:
                    parts = lines[0].split(',')
                    if len(parts) >= 1:
                        hid = parts[0].strip('"')
        except Exception:
            pass
    computername = os.environ.get('COMPUTERNAME', 'unknown')
    raw = f"{hid}::{computername}"
    return hashlib.sha256(raw.encode()).hexdigest()


class LicenseManager:
    """Gestor de licencias contra karuAPP License Server"""

    CACHE_FILE = 'licencia_cache.json'
    CONFIG_FILE = 'licencia_config.json'
    TRIAL_FILE = 'trial_cache.json'

    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(__file__))
        self.cache_path = os.path.join(self.base_dir, self.CACHE_FILE)
        self.config_path = os.path.join(self.base_dir, self.CONFIG_FILE)
        self.trial_path = os.path.join(self.base_dir, self.TRIAL_FILE)
        self.server_url = os.environ.get('LICENSE_SERVER_URL', 'http://127.0.0.1:8001')
        self.hardware_id = _get_hardware_id()
        self.restaurant_name = os.environ.get('LICENCIA_NOMBRE', 'Mi Restaurante')
        self.debug = os.environ.get('DEBUG', 'False') == 'True'
        self.cache_ttl_segundos = int(os.environ.get('CACHE_TTL_SEGUNDOS', 43200))
        self._config = self._load_config()

    def _load_config(self):
        """Carga client_id y api_key desde archivo local"""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return {'client_id': None, 'api_key': None}

    def _save_config(self, client_id, api_key):
        """Guarda client_id y api_key localmente"""
        try:
            with open(self.config_path, 'w') as f:
                json.dump({'client_id': client_id, 'api_key': api_key}, f)
            self._config = {'client_id': client_id, 'api_key': api_key}
        except Exception as e:
            logger.error(f"Error guardando config de licencia: {e}")

    def _load_cache(self):
        """Carga cache desde archivo local"""
        if os.path.exists(self.cache_path):
            try:
                with open(self.cache_path, 'r') as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    def _save_cache(self, data):
        """Guarda cache en archivo local"""
        try:
            data['ultima_verificacion'] = datetime.now().isoformat()
            with open(self.cache_path, 'w') as f:
                json.dump(data, f)
        except Exception as e:
            logger.error(f"Error guardando cache de licencia: {e}")

    def _default_cache(self, mensaje='Modo desarrollo - sin verificación', estado='activa', dias=999, bloqueado=False):
        return {
            'estado': estado,
            'dias_restantes': dias,
            'mensaje': mensaje,
            'nombre': self.restaurant_name,
            'online': False,
            'bloqueado': bloqueado,
            'ultima_verificacion': datetime.now().isoformat(),
        }

    def _check_offline_grace(self, cache):
        """Verifica si la tolerancia offline ha expirado"""
        ultima = cache.get('ultima_verificacion')
        if not ultima:
            return cache
        try:
            ult = datetime.fromisoformat(ultima)
            offline_grace_dias = cache.get('offline_grace_dias', 3)
            limite = ult + timedelta(days=offline_grace_dias)
            if datetime.now() > limite:
                logger.warning(f"Tolerancia offline expirada ({offline_grace_dias} días sin conexión)")
                return {
                    'estado': 'bloqueada',
                    'dias_restantes': 0,
                    'mensaje': '⚫ Sin conexión prolongada - Licencia bloqueada',
                    'nombre': cache.get('nombre', self.restaurant_name),
                    'online': False,
                    'bloqueado': True,
                    'ultima_verificacion': ultima,
                }
            dias_restantes = (limite - datetime.now()).days
            cache['dias_restantes'] = dias_restantes
            cache['mensaje'] = f'🟡 Sin conexión - {dias_restantes} días de gracia restantes'
            cache['online'] = False
            return cache
        except Exception:
            return cache

    def _register_with_server(self):
        """Registra este POS en el license server"""
        url = f"{self.server_url}/api/v1/license/register"
        try:
            resp = requests.post(url, json={
                'hardware_id': self.hardware_id,
                'nombre_restaurante': self.restaurant_name,
            }, timeout=10)
            if resp.status_code in (200, 201):
                data = resp.json()
                self._save_config(data['client_id'], data['api_key'])
                logger.info(f"Registrado en license server: {data['client_id']} (nuevo={data.get('nuevo', False)})")
                return True
            elif resp.status_code == 409:
                logger.warning("Hardware ya registrado pero sin config local. Contacte a soporte.")
                return False
            else:
                logger.error(f"Error registrando: {resp.status_code} {resp.text}")
                return False
        except requests.exceptions.ConnectionError:
            logger.warning("License server no accesible para registro. Usando caché.")
            return False
        except Exception as e:
            logger.error(f"Error en registro: {e}")
            return False

    def _verify_with_server(self):
        """Verifica licencia contra license server"""
        client_id = self._config.get('client_id')
        api_key = self._config.get('api_key')

        if not client_id or not api_key:
            if self._register_with_server():
                client_id = self._config.get('client_id')
                api_key = self._config.get('api_key')
            else:
                return None

        url = f"{self.server_url}/api/v1/license/verify"
        try:
            resp = requests.post(url, headers={
                'X-Client-Id': str(client_id),
                'X-Api-Key': str(api_key),
            }, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    'estado': data['estado'],
                    'dias_restantes': data['dias_restantes'],
                    'mensaje': data['mensaje'],
                    'nombre': self.restaurant_name,
                    'online': True,
                    'bloqueado': data.get('bloqueado', False) or data.get('estado') == 'pendiente',
                    'offline_grace_dias': data.get('offline_grace_dias', 3),
                    'paid_until': data.get('paid_until'),
                }
            elif resp.status_code == 401:
                logger.error("API Key inválida. Re-registrando...")
                self._save_config(None, None)
                return None
            else:
                logger.error(f"Error verificando: {resp.status_code} {resp.text}")
                return None
        except requests.exceptions.ConnectionError:
            logger.warning("License server no accesible. Usando caché offline.")
            return None
        except Exception as e:
            logger.error(f"Error en verificación: {e}")
            return None

    def _check_trial(self):
        """Cuenta regresiva local de días de prueba"""
        dias_prueba = int(os.environ.get('DIAS_PRUEBA', 14))
        trial = None
        if os.path.exists(self.trial_path):
            try:
                with open(self.trial_path, 'r') as f:
                    trial = json.load(f)
            except Exception:
                pass

        if not trial or 'fecha_activacion' not in trial:
            trial = {
                'fecha_activacion': datetime.now().isoformat(),
                'dias_prueba': dias_prueba,
            }
            try:
                with open(self.trial_path, 'w') as f:
                    json.dump(trial, f)
            except Exception as e:
                logger.error(f"Error guardando trial cache: {e}")

        try:
            activacion = datetime.fromisoformat(trial['fecha_activacion'])
            transcurridos = (datetime.now() - activacion).days
            restantes = max(0, dias_prueba - transcurridos)
        except Exception:
            restantes = dias_prueba

        if restantes <= 0:
            return self._default_cache(
                'Período de prueba vencido - Contacte a karuAPP',
                estado='bloqueada', dias=0, bloqueado=True
            )

        mensaje = f'{restantes} días de prueba restantes'
        return self._default_cache(mensaje, estado='activa', dias=restantes)

    def verificar(self, force_refresh=False):
        """Verifica el estado de la licencia"""
        if self.debug:
            return self._check_trial()

        if not force_refresh:
            cache = self._load_cache()
            if cache:
                ultima_verif = cache.get('ultima_verificacion')
                if ultima_verif:
                    try:
                        ult = datetime.fromisoformat(ultima_verif)
                        segundos_diff = (datetime.now() - ult).total_seconds()
                        if segundos_diff < self.cache_ttl_segundos and not cache.get('bloqueado'):
                            return self._check_offline_grace(cache)
                    except Exception:
                        pass

        server_data = self._verify_with_server()

        if server_data:
            cache = {
                'estado': server_data['estado'],
                'dias_restantes': server_data['dias_restantes'],
                'mensaje': server_data['mensaje'],
                'nombre': server_data['nombre'],
                'online': True,
                'bloqueado': server_data['bloqueado'],
                'offline_grace_dias': server_data.get('offline_grace_dias', 3),
                'paid_until': server_data.get('paid_until'),
            }
            self._save_cache(cache)
            return cache

        cache = self._load_cache()
        if cache:
            if cache.get('bloqueado'):
                cache['online'] = False
                return cache
            return self._check_offline_grace(cache)

        return self._default_cache('🔴 Sin conexión - No se pudo verificar licencia', estado='gracia', dias=3)

    def get_status(self):
        return self.verificar()

    def send_heartbeat(self):
        """Envía heartbeat al license server"""
        client_id = self._config.get('client_id')
        api_key = self._config.get('api_key')
        if not client_id or not api_key:
            return
        try:
            url = f"{self.server_url}/api/v1/license/heartbeat"
            requests.post(url, headers={
                'X-Client-Id': str(client_id),
                'X-Api-Key': str(api_key),
            }, json={'ip': ''}, timeout=5)
        except Exception:
            pass


license_manager = LicenseManager()


class VerificarLicenciaMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        excluded_paths = [
            '/api/verificar-licencia',
            '/api/verificar-pin',
            '/api/activar-licencia',
            '/admin/',
            '/static/',
            '/media/',
            '/login',
        ]

        path = request.path.rstrip('/') or '/'
        for prefix in excluded_paths:
            if path.startswith(prefix.rstrip('/')):
                return self.get_response(request)

        licencia = license_manager.verificar()

        if licencia['estado'] in ('bloqueada', 'expirado') or licencia.get('bloqueado'):
            return JsonResponse({
                'success': False,
                'error': 'Licencia bloqueada',
                'mensaje': licencia['mensaje'],
                'bloqueada': True,
                'estado': licencia['estado']
            }, status=403)

        return self.get_response(request)


def verificar_licencia_api(request):
    """API endpoint para verificar licencia desde el frontend"""
    licencia = license_manager.verificar(force_refresh=True)

    estado = licencia['estado']
    if estado in ('expirado', 'pendiente'):
        estado = 'bloqueada'

    license_manager.send_heartbeat()

    return JsonResponse({
        'success': True,
        'estado': estado,
        'dias_restantes': licencia['dias_restantes'],
        'mensaje': licencia['mensaje'],
        'nombre': licencia.get('nombre', ''),
        'online': licencia.get('online', False),
        'bloqueado': licencia.get('bloqueado', False),
    })


def verificar_pin_api(request):
    """API endpoint para verificar PIN"""
    if request.method != 'POST':
        return JsonResponse({'error': 'Método no permitido'}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido'}, status=400)

    pin = data.get('pin', '')
    from apps.usuarios.models import Usuario
    try:
        usuario = Usuario.objects.get(pin=pin, activo=True)
        return JsonResponse({
            'success': True,
            'valido': True,
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol
            }
        })
    except Usuario.DoesNotExist:
        return JsonResponse({
            'success': False,
            'valido': False,
            'error': 'PIN inválido'
        })
