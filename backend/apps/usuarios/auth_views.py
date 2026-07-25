import json
import random
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework_simplejwt.tokens import AccessToken
from apps.tenants.models import Restaurante
from .models import Usuario, Rol


def _generar_token(usuario):
    token = AccessToken()
    token['user_id'] = usuario.id
    token['restaurante_id'] = usuario.restaurante_id
    token['rol'] = usuario.rol
    token['nombre'] = usuario.nombre
    return str(token)


@csrf_exempt
@require_http_methods(["POST"])
def login_pin(request):
    try:
        data = json.loads(request.body)
        slug = data.get('slug_restaurante', '').strip()
        pin = data.get('pin', '').strip()

        if not slug or not pin:
            return JsonResponse({'success': False, 'error': 'slug_restaurante y pin son requeridos'}, status=400)

        try:
            restaurante = Restaurante.objects.get(slug=slug, activo=True)
        except Restaurante.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Restaurante no encontrado o inactivo'}, status=404)

        try:
            usuario = Usuario.objects.get(restaurante=restaurante, pin=pin, activo=True)
        except Usuario.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'PIN incorrecto o usuario inactivo'}, status=401)

        usuario.ultimo_acceso = None
        from django.utils import timezone
        usuario.ultimo_acceso = timezone.now()
        usuario.save(update_fields=['ultimo_acceso'])

        token = _generar_token(usuario)
        return JsonResponse({
            'success': True,
            'token': token,
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol,
                'restaurante_id': usuario.restaurante_id,
                'restaurante_slug': restaurante.slug,
                'modulos': usuario.modulos_acceso,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def login_admin(request):
    try:
        data = json.loads(request.body)
        slug = data.get('slug_restaurante', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not slug or not email or not password:
            return JsonResponse({'success': False, 'error': 'slug_restaurante, email y password son requeridos'}, status=400)

        try:
            restaurante = Restaurante.objects.get(slug=slug, activo=True)
        except Restaurante.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Restaurante no encontrado o inactivo'}, status=404)

        try:
            usuario = Usuario.objects.get(restaurante=restaurante, email=email, activo=True)
        except Usuario.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Email o contraseña incorrectos'}, status=401)

        if not usuario.check_password(password):
            return JsonResponse({'success': False, 'error': 'Email o contraseña incorrectos'}, status=401)

        from django.utils import timezone
        usuario.ultimo_acceso = timezone.now()
        usuario.save(update_fields=['ultimo_acceso'])

        token = _generar_token(usuario)
        return JsonResponse({
            'success': True,
            'token': token,
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol,
                'email': usuario.email,
                'restaurante_id': usuario.restaurante_id,
                'restaurante_slug': restaurante.slug,
                'modulos': usuario.modulos_acceso,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def _generar_pin_unico(restaurante):
    for _ in range(100):
        pin = f"{random.randint(0, 9999):04d}"
        if not Usuario.objects.filter(restaurante=restaurante, pin=pin).exists():
            return pin
    return None


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    try:
        data = json.loads(request.body)
        slug = data.get('slug_restaurante', '').strip()
        nombre = data.get('nombre', '').strip()
        pin = data.get('pin', '').strip()
        rol = data.get('rol', 'mesero')
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not slug or not nombre:
            return JsonResponse({'success': False, 'error': 'slug_restaurante y nombre son requeridos'}, status=400)

        try:
            restaurante = Restaurante.objects.get(slug=slug, activo=True)
        except Restaurante.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Restaurante no encontrado o inactivo'}, status=404)

        if pin:
            if len(pin) != 4 or not pin.isdigit():
                return JsonResponse({'success': False, 'error': 'El PIN debe tener 4 dígitos numéricos'}, status=400)
            if Usuario.objects.filter(restaurante=restaurante, pin=pin).exists():
                return JsonResponse({'success': False, 'error': 'Este PIN ya está en uso en este restaurante'}, status=400)
        else:
            pin = _generar_pin_unico(restaurante)
            if not pin:
                return JsonResponse({'success': False, 'error': 'No se pudo generar un PIN único'}, status=500)

        usuario = Usuario(
            restaurante=restaurante,
            nombre=nombre,
            pin=pin,
            rol=rol,
            email=email or None,
        )
        if password:
            usuario.set_password(password)
        usuario.save()

        return JsonResponse({
            'success': True,
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol,
                'pin': usuario.pin,
                'email': usuario.email,
                'restaurante_id': usuario.restaurante_id,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
