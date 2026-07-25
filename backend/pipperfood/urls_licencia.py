from django.urls import path
from .views_licencia import (
    verificar_licencia,
    registrar_cliente,
    estado_licencia,
    extender_licencia,
    bloquear_licencia,
    dashboard_data,
    lista_clientes,
    crear_cliente,
    editar_cliente,
    eliminar_cliente,
    agregar_pago,
    cambiar_plan,
)

urlpatterns = [
    # API del cliente (llamada desde la app)
    path('licencia/verificar', verificar_licencia, name='verificar_licencia'),
    path('licencia/registrar', registrar_cliente, name='registrar_cliente'),
    path('licencia/estado/<str:dispositivo_id>', estado_licencia, name='estado_licencia'),
    
    # API de gestión (solo accesible desde localhost)
    path('admin/licencias', lista_clientes, name='lista_clientes'),
    path('admin/licencias/crear', crear_cliente, name='crear_cliente'),
    path('admin/licencias/<int:pk>/editar', editar_cliente, name='editar_cliente'),
    path('admin/licencias/<int:pk>/eliminar', eliminar_cliente, name='eliminar_cliente'),
    path('admin/licencias/<int:pk>/extender', extender_licencia, name='extender_licencia'),
    path('admin/licencias/<int:pk>/bloquear', bloquear_licencia, name='bloquear_licencia'),
    path('admin/licencias/<int:pk>/pago', agregar_pago, name='agregar_pago'),
    path('admin/licencias/<int:pk>/cambiar-plan', cambiar_plan, name='cambiar_plan'),
    path('admin/dashboard', dashboard_data, name='dashboard_data'),
]