from django.http import JsonResponse
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from apps.usuarios.models import Usuario


class JWTAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token_str = auth_header[7:]
            try:
                token = AccessToken(token_str)
                user_id = token.payload.get('user_id')
                if user_id:
                    try:
                        request.user = Usuario.objects.get(id=user_id, activo=True)
                        request.restaurante_id = token.payload.get('restaurante_id')
                        request.usuario_rol = token.payload.get('rol')
                    except Usuario.DoesNotExist:
                        pass
            except TokenError:
                pass
        return self.get_response(request)
