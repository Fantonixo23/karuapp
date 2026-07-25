from django.urls import path
from .views import (
    lista_usuarios, crear_usuario, modificar_usuario,
    eliminar_usuario, activar_usuario, reestablecer_pin,
    estadisticas_usuarios,
)

urlpatterns = [
    path('usuarios', lista_usuarios, name='lista_usuarios'),
    path('usuarios/crear', crear_usuario, name='crear_usuario'),
    path('usuarios/estadisticas', estadisticas_usuarios, name='estadisticas_usuarios'),
    path('usuarios/<int:pk>/editar', modificar_usuario, name='modificar_usuario'),
    path('usuarios/<int:pk>/eliminar', eliminar_usuario, name='eliminar_usuario'),
    path('usuarios/<int:pk>/activar', activar_usuario, name='activar_usuario'),
    path('usuarios/<int:pk>/reestablecer-pin', reestablecer_pin, name='reestablecer_pin'),
]
