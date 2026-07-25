from functools import wraps
from django.http import JsonResponse


def requiere_autenticacion(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Autenticación requerida'}, status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def requiere_modulo(modulo):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                return JsonResponse({'success': False, 'error': 'Autenticación requerida'}, status=401)
            if not request.user.puede_acceder(modulo):
                return JsonResponse({'success': False, 'error': f'No tienes acceso al modulo {modulo}'}, status=403)
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def requiere_rol(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not hasattr(request, 'usuario_rol') or request.usuario_rol not in roles:
                return JsonResponse({'success': False, 'error': 'No tienes permiso para esta acción'}, status=403)
            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator
