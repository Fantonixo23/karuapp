from django.urls import path
from .views import (
    lista_mesas,
    crear_mesa,
    modificar_mesa,
    eliminar_mesa,
    abrir_mesa,
    cerrar_mesa,
    marcar_limpieza,
    cambiar_estado_mesa
)

urlpatterns = [
    path('mesas', lista_mesas, name='lista_mesas'),
    path('mesas/crear', crear_mesa, name='crear_mesa'),
    path('mesas/<int:pk>/editar', modificar_mesa, name='modificar_mesa'),
    path('mesas/<int:pk>/eliminar', eliminar_mesa, name='eliminar_mesa'),
    path('mesas/<int:pk>/borrar', eliminar_mesa, name='borrar_mesa'),
    path('mesas/<int:pk>/estado', cambiar_estado_mesa, name='cambiar_estado_mesa'),
    path('mesas/abrir', abrir_mesa, name='abrir_mesa'),
    path('mesas/cerrar', cerrar_mesa, name='cerrar_mesa'),
    path('mesas/limpieza', marcar_limpieza, name='marcar_limpieza'),
]