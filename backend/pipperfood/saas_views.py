import json
import random
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import transaction
from apps.tenants.models import Restaurante
from apps.usuarios.models import Usuario, Rol


@csrf_exempt
@require_http_methods(["POST"])
def login_saas(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return JsonResponse({'success': False, 'error': 'Email y contraseña requeridos'}, status=400)

        user = authenticate(request, username=email, password=password)
        if user is None:
            return JsonResponse({'success': False, 'error': 'Email o contraseña incorrectos'}, status=401)

        # Verificar si el restaurante del usuario está bloqueado
        usuario = Usuario.objects.filter(email=user.email).first()
        if usuario and usuario.restaurante:
            r = usuario.restaurante
            estado = r.estado_licencia
            if estado == 'suspended':
                return JsonResponse({
                    'success': False,
                    'error': 'Bloqueo del sistema por falta de pago, por favor contacte con el administrador'
                }, status=403)
            if estado == 'expirado':
                return JsonResponse({
                    'success': False,
                    'error': 'Bloqueo del sistema por falta de pago, por favor contacte con el administrador'
                }, status=403)

        login(request, user)
        return JsonResponse({
            'success': True,
            'user': {'email': user.email, 'name': user.get_full_name() or user.username}
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def register_saas(request):
    try:
        data = json.loads(request.body)
        nombre_restaurante = data.get('nombre_restaurante', '').strip()
        nombre = data.get('nombre', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not nombre_restaurante or not nombre or not email or not password:
            return JsonResponse({'success': False, 'error': 'Todos los campos son requeridos'}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({'success': False, 'error': 'Este email ya está registrado'}, status=400)

        slug = nombre_restaurante.lower().replace(' ', '-')[:100]
        slug_base = slug
        counter = 1
        while Restaurante.objects.filter(slug=slug).exists():
            slug = f"{slug_base}-{counter}"
            counter += 1

        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password, first_name=nombre)
            user.save()

            restaurante = Restaurante.objects.create(
                nombre=nombre_restaurante,
                slug=slug,
                plan='free',
                activo=True,
                fecha_expiracion=timezone.now() + timezone.timedelta(days=14)
            )

            Usuario.objects.create(
                restaurante=restaurante,
                nombre=nombre,
                pin=f"{random.randint(1000, 9999)}",
                rol=Rol.ADMIN,
                email=email,
                activo=True,
            )

        login(request, user)
        return JsonResponse({
            'success': True,
            'restaurante': {'slug': slug, 'nombre': nombre_restaurante}
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@csrf_exempt
def me(request):
    if request.user.is_authenticated:
        usuario = Usuario.objects.filter(email=request.user.email).first()
        rol = usuario.rol if usuario else 'administrador'
        modulos = usuario.modulos_acceso if usuario else [
            'mesas', 'cocina', 'caja', 'delivery', 'informes', 'productos', 'inventario', 'funcionarios', 'configuracion'
        ]
        return JsonResponse({
            'authenticated': True,
            'user': {
                'email': request.user.email,
                'name': request.user.get_full_name() or request.user.username,
                'rol': rol,
                'modulos': modulos,
            }
        })
    return JsonResponse({'authenticated': False})


@csrf_exempt
@require_http_methods(["POST"])
def logout_saas(request):
    logout(request)
    return JsonResponse({'success': True})