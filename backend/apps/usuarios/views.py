import json
import random
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from apps.usuarios.decorators import requiere_autenticacion, requiere_rol
from pipperfood.middleware import _get_restaurante
from .models import Usuario, Rol


def _scope_usuarios(request, qs):
    rest = _get_restaurante(request)
    if rest:
        return qs.filter(restaurante=rest)
    return qs.none()


# ==================== CRUD USUARIOS ====================

@csrf_exempt
@require_http_methods(["GET"])
@requiere_autenticacion
@requiere_rol('administrador', 'cajero')
def lista_usuarios(request):
    """Lista todos los usuarios del restaurante"""
    incluir_inactivos = request.GET.get('incluir_inactivos') == 'true'
    only_activos = request.GET.get('only_activos') == 'true'
    
    base = Usuario.objects.all()
    if only_activos or not incluir_inactivos:
        base = base.filter(activo=True)
    usuarios = _scope_usuarios(request, base).order_by('nombre')
    
    data = [{
        'id': u.id,
        'nombre': u.nombre,
        'rol': u.rol,
        'telefono': u.telefono,
        'email': u.email,
        'activo': u.activo,
        'ultimo_acceso': u.ultimo_acceso.isoformat() if u.ultimo_acceso else None,
        'created_at': u.created_at.isoformat() if u.created_at else None,
    } for u in usuarios]
    
    return JsonResponse({'success': True, 'usuarios': data})


def generar_pin_unico(restaurante_id=None):
    """Genera un PIN de 4 dígitos no usado en el restaurante"""
    for _ in range(100):
        pin = f"{random.randint(0, 9999):04d}"
        filtro = {'pin': pin}
        if restaurante_id:
            filtro['restaurante_id'] = restaurante_id
        if not Usuario.objects.filter(**filtro).exists():
            return pin
    return None


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
@requiere_rol('administrador')
def crear_usuario(request):
    """Crea un nuevo usuario en el restaurante del autenticado"""
    try:
        data = json.loads(request.body)
        rest = _get_restaurante(request)
        nombre = data.get('nombre', '').strip()
        pin = data.get('pin', '').strip()
        rol = data.get('rol', 'mesero')
        telefono = data.get('telefono', '')
        email = data.get('email', '')
        
        if not rest:
            return JsonResponse({
                'success': False,
                'error': 'Se requiere autenticación para crear usuarios'
            }, status=401)
        
        if not nombre:
            return JsonResponse({
                'success': False,
                'error': 'El nombre es requerido'
            }, status=400)
        
        if pin:
            if len(pin) != 4 or not pin.isdigit():
                return JsonResponse({
                    'success': False,
                    'error': 'El PIN debe tener 4 dígitos numericos'
                }, status=400)
            if Usuario.objects.filter(restaurante=rest, pin=pin).exists():
                return JsonResponse({
                    'success': False,
                    'error': 'Este PIN ya está en uso en este restaurante'
                }, status=400)
        else:
            pin = generar_pin_unico(rest.id)
            if not pin:
                return JsonResponse({
                    'success': False,
                    'error': 'No se pudo generar un PIN unico'
                }, status=500)
        
        usuario = Usuario.objects.create(
            restaurante=rest,
            nombre=nombre,
            pin=pin,
            rol=rol,
            telefono=telefono,
            email=email,
        )
        
        return JsonResponse({
            'success': True,
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol,
                'pin': usuario.pin,
                'telefono': usuario.telefono,
                'email': usuario.email,
                'activo': usuario.activo,
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
@requiere_rol('administrador')
def modificar_usuario(request, pk):
    """Modifica un usuario de su restaurante"""
    try:
        data = json.loads(request.body)
        rest = _get_restaurante(request)
        try:
            usuario = _scope_usuarios(request, Usuario.objects.all()).get(pk=pk)
        except Usuario.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Usuario no encontrado'
            }, status=404)
        
        nombre = data.get('nombre')
        pin = data.get('pin')
        rol = data.get('rol')
        telefono = data.get('telefono')
        email = data.get('email')
        activo = data.get('activo')
        
        if nombre:
            usuario.nombre = nombre.strip()
        if pin:
            if len(pin) == 4 and pin.isdigit():
                if pin != usuario.pin and Usuario.objects.filter(restaurante=rest, pin=pin).exists():
                    return JsonResponse({
                        'success': False,
                        'error': 'Este PIN ya está en uso en este restaurante'
                    }, status=400)
                usuario.pin = pin
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'El PIN debe tener 4 digitos numericos'
                }, status=400)
        if rol:
            usuario.rol = rol
        if telefono is not None:
            usuario.telefono = telefono
        if email is not None:
            usuario.email = email
        if activo is not None:
            usuario.activo = activo
        
        usuario.save()
        
        return JsonResponse({
            'success': True,
            'usuario': {
                'id': usuario.id,
                'nombre': usuario.nombre,
                'rol': usuario.rol,
                'pin': usuario.pin,
                'telefono': usuario.telefono,
                'email': usuario.email,
                'activo': usuario.activo,
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
@requiere_rol('administrador')
def eliminar_usuario(request, pk):
    """Desactiva un usuario de su restaurante"""
    try:
        usuario = _scope_usuarios(request, Usuario.objects.all()).get(pk=pk)
        usuario.activo = False
        usuario.save()
        return JsonResponse({'success': True, 'mensaje': 'Usuario desactivado'})
    except Usuario.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Usuario no encontrado'
        }, status=404)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
@requiere_rol('administrador')
def activar_usuario(request, pk):
    """Activa un usuario de su restaurante"""
    try:
        usuario = _scope_usuarios(request, Usuario.objects.all()).get(pk=pk)
        usuario.activo = True
        usuario.save()
        return JsonResponse({'success': True, 'mensaje': 'Usuario activado'})
    except Usuario.DoesNotExist:
        return JsonResponse({
            'success': False,
            'error': 'Usuario no encontrado'
        }, status=404)


@csrf_exempt
@require_http_methods(["POST"])
@requiere_autenticacion
@requiere_rol('administrador')
def reestablecer_pin(request, pk):
    """Reestablece el PIN de un usuario de su restaurante"""
    try:
        data = json.loads(request.body)
        nuevo_pin = data.get('pin', '').strip()
        rest = _get_restaurante(request)
        
        try:
            usuario = _scope_usuarios(request, Usuario.objects.all()).get(pk=pk)
        except Usuario.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Usuario no encontrado'
            }, status=404)
        
        if nuevo_pin:
            if len(nuevo_pin) != 4 or not nuevo_pin.isdigit():
                return JsonResponse({
                    'success': False,
                    'error': 'El PIN debe tener 4 digitos numericos'
                }, status=400)
            if Usuario.objects.filter(restaurante=rest, pin=nuevo_pin).exclude(pk=pk).exists():
                return JsonResponse({
                    'success': False,
                    'error': 'Este PIN ya está en uso en este restaurante'
                }, status=400)
        else:
            nuevo_pin = generar_pin_unico(rest.id)
            if not nuevo_pin:
                return JsonResponse({
                    'success': False,
                    'error': 'No se pudo generar un PIN unico'
                }, status=500)
        
        usuario.pin = nuevo_pin
        usuario.save(update_fields=['pin'])
        
        return JsonResponse({
            'success': True,
            'mensaje': 'PIN reestablecido',
            'pin': nuevo_pin
        })
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
@requiere_autenticacion
@requiere_rol('administrador', 'cajero')
def estadisticas_usuarios(request):
    """Estadisticas de usuarios del restaurante"""
    base = _scope_usuarios(request, Usuario.objects.all())
    total = base.count()
    activos = base.filter(activo=True).count()
    inactivos = total - activos
    
    por_rol = {}
    for rol, _ in Rol.choices:
        por_rol[rol] = base.filter(rol=rol).count()
    
    return JsonResponse({
        'success': True,
        'estadisticas': {
            'total': total,
            'activos': activos,
            'inactivos': inactivos,
            'por_rol': por_rol,
        }
    })