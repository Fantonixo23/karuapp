from django.shortcuts import redirect
from django.urls import reverse
from django.http import JsonResponse
from django.contrib.auth import logout
from apps.usuarios.models import Usuario


class SessionAuthMiddleware:
    EXEMPT_PATHS = [
        '/login',
        '/login-pin/',
        '/mobile/',
        '/api/auth/login-saas',
        '/api/auth/register-saas',
        '/api/auth/me',
        '/saas/',
        '/static/',
        '/media/',
        '/assets/',
        '/sounds/',
        '/favicon',
        '/logo',
        '/manifest',
    ]

    STATIC_EXTENSIONS = ('.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.json', '.webmanifest', '.mp3', '.pdf')

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info

        if any(path.startswith(e) for e in self.EXEMPT_PATHS):
            return self.get_response(request)

        if path.startswith('/api/'):
            return self.get_response(request)

        for ext in self.STATIC_EXTENSIONS:
            if path.endswith(ext):
                return self.get_response(request)

        if not request.user.is_authenticated:
            return redirect('/login')

        usuario = Usuario.objects.filter(email=request.user.email).first()
        if usuario and usuario.restaurante:
            r = usuario.restaurante
            if r.estado_licencia == 'suspended':
                logout(request)
                return redirect('/login?error=bloqueo')

        return self.get_response(request)