from django.urls import path
from .views import (
    lista_inventario,
    detalle_producto_inventario,
    crear_movimiento,
    actualizar_inventario,
    alertas_inventario,
    historial_movimientos,
    resumen_inventario,
    eliminar_inventario,
)

urlpatterns = [
    path('inventario/', lista_inventario, name='lista_inventario'),
    path('inventario/producto/<int:producto_id>', detalle_producto_inventario, name='detalle_producto_inventario'),
    path('inventario/movimiento', crear_movimiento, name='crear_movimiento'),
    path('inventario/actualizar', actualizar_inventario, name='actualizar_inventario'),
    path('inventario/alertas', alertas_inventario, name='alertas_inventario'),
    path('inventario/historial', historial_movimientos, name='historial_movimientos'),
    path('inventario/resumen', resumen_inventario, name='resumen_inventario'),
    path('inventario/<int:inventario_id>/eliminar', eliminar_inventario, name='eliminar_inventario'),
]