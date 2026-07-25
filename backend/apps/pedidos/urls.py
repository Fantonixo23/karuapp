from django.urls import path
from .views import (
    lista_pedidos,
    crear_pedido,
    cambiar_estado,
    agregar_items,
    reemplazar_items,
    eliminar_item,
    pagar_pedido,
    cancelar_pedido,
    sincronizar_pedidos,
    dashboard_delivery,
    pedidos_por_mesa,
    cobrar_mesa,
    historial_caja,
    lista_pedidos_pagados,
    reimprimir_factura
)

urlpatterns = [
    path('pedidos', lista_pedidos, name='lista_pedidos'),
    path('pedidos/crear', crear_pedido, name='crear_pedido'),
    path('pedidos/<int:pk>/estado', cambiar_estado, name='cambiar_estado'),
    path('pedidos/<int:pk>/items', agregar_items, name='agregar_items'),
    path('pedidos/<int:pk>/items/reemplazar', reemplazar_items, name='reemplazar_items'),
    path('pedidos/<int:pk>/items/<int:idx>', eliminar_item, name='eliminar_item'),
    path('pedidos/<int:pk>/pagar', pagar_pedido, name='pagar_pedido'),
    path('pedidos/<int:pk>/cancelar', cancelar_pedido, name='cancelar_pedido'),
    path('pedidos/sincronizar', sincronizar_pedidos, name='sincronizar_pedidos'),
    path('pedidos/delivery/dashboard', dashboard_delivery, name='dashboard_delivery'),
    path('pedidos/mesa/<int:mesa_id>', pedidos_por_mesa, name='pedidos_por_mesa'),
    path('pedidos/mesa/<int:mesa_id>/cobrar', cobrar_mesa, name='cobrar_mesa'),
    path('caja/historial', historial_caja, name='historial_caja'),
    path('caja/pedidos-pagados', lista_pedidos_pagados, name='lista_pedidos_pagados'),
    path('caja/reimprimir/<int:pk>', reimprimir_factura, name='reimprimir_factura'),
]