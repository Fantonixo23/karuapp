from django.urls import path
from .views import (
    dashboard,
    ventas_hoy,
    ventas_fecha,
    productos_mas_vendidos,
    ventas_metodo_pago,
    resumen_general,
    resumen_completo,
    ventas_por_dia,
    productos_estadisticas,
    metodos_pago_estadisticas,
    pedidos_lista
)

urlpatterns = [
    path('informes/dashboard', dashboard, name='dashboard'),
    path('informes/ventas-hoy', ventas_hoy, name='ventas_hoy'),
    path('informes/ventas', ventas_fecha, name='ventas_fecha'),
    path('informes/productos-mas-vendidos', productos_mas_vendidos, name='productos_mas_vendidos'),
    path('informes/ventas-metodo-pago', ventas_metodo_pago, name='ventas_metodo_pago'),
    path('informes/resumen', resumen_general, name='resumen_general'),
    path('informes/resumen-completo', resumen_completo, name='resumen_completo'),
    path('informes/ventas-por-dia', ventas_por_dia, name='ventas_por_dia'),
    path('informes/productos-estadisticas', productos_estadisticas, name='productos_estadisticas'),
    path('informes/metodos-pago', metodos_pago_estadisticas, name='metodos_pago_estadisticas'),
    path('informes/pedidos-lista', pedidos_lista, name='pedidos_lista'),
]