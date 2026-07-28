import json
import random
import string
import logging
from datetime import timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken
from apps.tenants.models import Restaurante
from apps.usuarios.models import Usuario, Rol, VerificationCode

logger = logging.getLogger(__name__)


def _generar_codigo():
    return ''.join(random.choices(string.digits, k=6))


def _enviar_codigo(email, codigo, proposito):
    asunto_map = {
        'password_reset': 'karuAPP - Código para restablecer contraseña',
        'owner_access': 'karuAPP - Código de verificación para dueño',
    }
    mensaje_map = {
        'password_reset': (
            f'Hola,\n\n'
            f'Recibimos una solicitud para restablecer la contraseña de tu cuenta en karuAPP.\n\n'
            f'Tu código de verificación es: {codigo}\n\n'
            f'Este código expira en 15 minutos.\n\n'
            f'Si no solicitaste este cambio, ignorá este mensaje.\n\n'
            f'Saludos,\nEquipo karuAPP'
        ),
        'owner_access': (
            f'Hola,\n\n'
            f'Recibimos una solicitud para acceder a la gestión de funcionarios en karuAPP.\n\n'
            f'Tu código de verificación es: {codigo}\n\n'
            f'Este código expira en 15 minutos.\n\n'
            f'Si no solicitaste este acceso, ignorá este mensaje.\n\n'
            f'Saludos,\nEquipo karuAPP'
        ),
    }
    asunto = asunto_map.get(proposito, 'karuAPP - Código de verificación')
    mensaje = mensaje_map.get(proposito, f'Tu código es: {codigo}')
    try:
        send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        return True
    except Exception as e:
        logger.error(f"Error enviando email a {email}: {e}")
        return False


def _crear_codigo(email, proposito):
    VerificationCode.objects.filter(email=email, purpose=proposito, used=False).update(used=True)
    codigo = _generar_codigo()
    VerificationCode.objects.create(
        email=email,
        code=codigo,
        purpose=proposito,
        expires_at=timezone.now() + timedelta(minutes=15),
    )
    return codigo


def _verificar_codigo(email, codigo, proposito):
    try:
        vc = VerificationCode.objects.filter(
            email=email, code=codigo, purpose=proposito,
            used=False, expires_at__gt=timezone.now()
        ).latest('created_at')
        vc.used = True
        vc.save(update_fields=['used'])
        return True
    except VerificationCode.DoesNotExist:
        return False


def _generar_token(usuario):
    token = AccessToken()
    token['user_id'] = usuario.id
    token['restaurante_id'] = usuario.restaurante_id
    token['rol'] = usuario.rol
    token['nombre'] = usuario.nombre
    return str(token)


# ── Forgot password ──

@csrf_exempt
@require_http_methods(["POST"])
def forgot_password(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        if not email:
            return JsonResponse({'success': False, 'error': 'Email requerido'}, status=400)
        if not User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'error': 'No hay una cuenta con ese email'}, status=404)
        codigo = _crear_codigo(email, 'password_reset')
        ok = _enviar_codigo(email, codigo, 'password_reset')
        if not ok:
            return JsonResponse({'success': False, 'error': 'Error al enviar el email. Verificá la configuración SMTP.'}, status=500)
        return JsonResponse({'success': True, 'mensaje': 'Código enviado a tu email'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def verify_reset_code(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        code = data.get('code', '').strip()
        password = data.get('password', '')
        if not email or not code or not password:
            return JsonResponse({'success': False, 'error': 'Todos los campos son requeridos'}, status=400)
        if len(password) < 6:
            return JsonResponse({'success': False, 'error': 'La contraseña debe tener al menos 6 caracteres'}, status=400)
        if not _verificar_codigo(email, code, 'password_reset'):
            return JsonResponse({'success': False, 'error': 'Código inválido o expirado'}, status=400)
        user = User.objects.get(email=email)
        user.set_password(password)
        user.save(update_fields=['password'])
        return JsonResponse({'success': True, 'mensaje': 'Contraseña restablecida correctamente'})
    except User.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Usuario no encontrado'}, status=404)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


# ── Owner verification (for accessing /app/funcionarios) ──

@csrf_exempt
@require_http_methods(["POST"])
def send_owner_code(request):
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'No autenticado'}, status=401)
        email = request.user.email
        codigo = _crear_codigo(email, 'owner_access')
        ok = _enviar_codigo(email, codigo, 'owner_access')
        if not ok:
            return JsonResponse({'success': False, 'error': 'Error al enviar el email'}, status=500)
        return JsonResponse({'success': True, 'mensaje': 'Código enviado a tu email'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def verify_owner_code(request):
    try:
        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'No autenticado'}, status=401)
        data = json.loads(request.body)
        code = data.get('code', '').strip()
        email = request.user.email
        if not code:
            return JsonResponse({'success': False, 'error': 'Código requerido'}, status=400)
        if not _verificar_codigo(email, code, 'owner_access'):
            return JsonResponse({'success': False, 'error': 'Código inválido o expirado'}, status=400)
        request.session['owner_verified'] = True
        request.session['owner_verified_at'] = timezone.now().isoformat()
        return JsonResponse({'success': True, 'mensaje': 'Verificado correctamente'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


def _owner_verificado(request):
    if not request.user.is_authenticated:
        return False
    if not request.session.get('owner_verified'):
        return False
    verified_at = request.session.get('owner_verified_at')
    if verified_at:
        try:
            vt = timezone.datetime.fromisoformat(verified_at)
            if timezone.now() - vt > timedelta(hours=1):
                request.session['owner_verified'] = False
                return False
        except Exception:
            return False
    return True


# ── Funcionarios CRUD ──

def _get_restaurante_from_user(request):
    if not request.user.is_authenticated:
        return None
    usuario = Usuario.objects.filter(email=request.user.email).first()
    if not usuario or not usuario.restaurante:
        return None
    if usuario.rol != Rol.ADMIN:
        return None
    return usuario.restaurante


@csrf_exempt
def funcionarios_list(request):
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)
    if not _owner_verificado(request):
        return JsonResponse({'success': False, 'error': 'Debe verificar su identidad primero'}, status=403)
    restaurante = _get_restaurante_from_user(request)
    if not restaurante:
        return JsonResponse({'success': False, 'error': 'No autorizado'}, status=403)
    funcionarios = Usuario.objects.filter(restaurante=restaurante).order_by('nombre')
    data = []
    for f in funcionarios:
        data.append({
            'id': f.id,
            'nombre': f.nombre,
            'pin': f.pin,
            'rol': f.rol,
            'email': f.email or '',
            'activo': f.activo,
            'ultimo_acceso': f.ultimo_acceso.isoformat() if f.ultimo_acceso else None,
            'created_at': f.created_at.isoformat() if f.created_at else None,
        })
    return JsonResponse({'success': True, 'funcionarios': data})


@csrf_exempt
@require_http_methods(["POST"])
def funcionarios_create(request):
    if not _owner_verificado(request):
        return JsonResponse({'success': False, 'error': 'Debe verificar su identidad primero'}, status=403)
    restaurante = _get_restaurante_from_user(request)
    if not restaurante:
        return JsonResponse({'success': False, 'error': 'No autorizado'}, status=403)
    try:
        data = json.loads(request.body)
        nombre = data.get('nombre', '').strip()
        rol = data.get('rol', 'mesero')
        email = data.get('email', '').strip().lower()
        if not nombre:
            return JsonResponse({'success': False, 'error': 'Nombre requerido'}, status=400)
        if rol not in [r[0] for r in Rol.choices]:
            return JsonResponse({'success': False, 'error': 'Rol inválido'}, status=400)
        # Generar PIN único de 4 dígitos
        pin = None
        for _ in range(100):
            p = f"{random.randint(0, 9999):04d}"
            if not Usuario.objects.filter(restaurante=restaurante, pin=p).exists():
                pin = p
                break
        if not pin:
            return JsonResponse({'success': False, 'error': 'No se pudo generar un PIN único'}, status=500)
        usuario = Usuario.objects.create(
            restaurante=restaurante,
            nombre=nombre,
            pin=pin,
            rol=rol,
            email=email or None,
            activo=True,
        )
        return JsonResponse({
            'success': True,
            'funcionario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'pin': usuario.pin,
                'rol': usuario.rol,
                'email': usuario.email or '',
                'activo': usuario.activo,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["PUT"])
def funcionarios_update(request, funcionario_id):
    if not _owner_verificado(request):
        return JsonResponse({'success': False, 'error': 'Debe verificar su identidad primero'}, status=403)
    restaurante = _get_restaurante_from_user(request)
    if not restaurante:
        return JsonResponse({'success': False, 'error': 'No autorizado'}, status=403)
    try:
        funcionario = Usuario.objects.get(id=funcionario_id, restaurante=restaurante)
    except Usuario.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Funcionario no encontrado'}, status=404)
    try:
        data = json.loads(request.body)
        if 'nombre' in data:
            n = data['nombre'].strip()
            if n: funcionario.nombre = n
        if 'rol' in data and data['rol'] in [r[0] for r in Rol.choices]:
            funcionario.rol = data['rol']
        if 'email' in data:
            funcionario.email = data['email'].strip().lower() or None
        if 'activo' in data:
            funcionario.activo = data['activo']
        funcionario.save()
        return JsonResponse({
            'success': True,
            'funcionario': {
                'id': funcionario.id,
                'nombre': funcionario.nombre,
                'pin': funcionario.pin,
                'rol': funcionario.rol,
                'email': funcionario.email or '',
                'activo': funcionario.activo,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["DELETE"])
def funcionarios_delete(request, funcionario_id):
    if not _owner_verificado(request):
        return JsonResponse({'success': False, 'error': 'Debe verificar su identidad primero'}, status=403)
    restaurante = _get_restaurante_from_user(request)
    if not restaurante:
        return JsonResponse({'success': False, 'error': 'No autorizado'}, status=403)
    try:
        funcionario = Usuario.objects.get(id=funcionario_id, restaurante=restaurante)
        if funcionario.email == request.user.email:
            return JsonResponse({'success': False, 'error': 'No podés eliminarte a vos mismo'}, status=400)
        funcionario.delete()
        return JsonResponse({'success': True})
    except Usuario.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Funcionario no encontrado'}, status=404)


@csrf_exempt
@require_http_methods(["POST"])
def funcionarios_regenerar_pin(request, funcionario_id):
    if not _owner_verificado(request):
        return JsonResponse({'success': False, 'error': 'Debe verificar su identidad primero'}, status=403)
    restaurante = _get_restaurante_from_user(request)
    if not restaurante:
        return JsonResponse({'success': False, 'error': 'No autorizado'}, status=403)
    try:
        funcionario = Usuario.objects.get(id=funcionario_id, restaurante=restaurante)
    except Usuario.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Funcionario no encontrado'}, status=404)
    pin = None
    for _ in range(100):
        p = f"{random.randint(0, 9999):04d}"
        if not Usuario.objects.filter(restaurante=restaurante, pin=p).exists():
            pin = p
            break
    if not pin:
        return JsonResponse({'success': False, 'error': 'No se pudo generar un PIN único'}, status=500)
    funcionario.pin = pin
    funcionario.save(update_fields=['pin'])
    return JsonResponse({'success': True, 'pin': pin})


# ── Mobile PIN login ──

@csrf_exempt
def funcionarios_listado_mobile(request, slug):
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)
    try:
        restaurante = Restaurante.objects.get(slug=slug, activo=True)
    except Restaurante.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Restaurante no encontrado'}, status=404)
    funcionarios = Usuario.objects.filter(restaurante=restaurante, activo=True).order_by('nombre')
    data = [{'id': f.id, 'nombre': f.nombre} for f in funcionarios]
    return JsonResponse({'success': True, 'funcionarios': data, 'restaurante': restaurante.nombre})


@csrf_exempt
@require_http_methods(["POST"])
def login_pin_mobile(request):
    try:
        data = json.loads(request.body)
        funcionario_id = data.get('funcionario_id', '').strip()
        pin = data.get('pin', '').strip()
        if not funcionario_id or not pin:
            return JsonResponse({'success': False, 'error': 'Todos los campos son requeridos'}, status=400)
        try:
            usuario = Usuario.objects.get(id=funcionario_id, pin=pin, activo=True)
        except Usuario.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Nombre o PIN incorrectos'}, status=401)
        if not usuario.restaurante or not usuario.restaurante.activo:
            return JsonResponse({'success': False, 'error': 'Restaurante no disponible'}, status=400)
        from django.utils import timezone
        usuario.ultimo_acceso = timezone.now()
        usuario.save(update_fields=['ultimo_acceso'])
        token = _generar_token(usuario)
        return JsonResponse({
            'success': True,
            'access_token': token,
            'user': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol,
                'restaurante_id': usuario.restaurante_id,
                'restaurante_slug': usuario.restaurante.slug,
                'modulos': usuario.modulos_acceso,
            }
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)