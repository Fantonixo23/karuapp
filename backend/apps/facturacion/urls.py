from django.urls import path
from .views import (
    get_config,
    update_config,
    lista_timbrados,
    crear_timbrado,
    generar_factura,
    lista_facturas,
    lista_metodos_pago,
    crear_metodo_pago,
    actualizar_metodo_pago,
    eliminar_metodo_pago,
    buscar_cliente_ruc
)

urlpatterns = [
    path('facturacion/config', get_config, name='get_config'),
    path('facturacion/config/actualizar', update_config, name='update_config'),
    path('facturacion/timbrados', lista_timbrados, name='lista_timbrados'),
    path('facturacion/timbrados/crear', crear_timbrado, name='crear_timbrado'),
    path('facturacion/facturas/generar', generar_factura, name='generar_factura'),
    path('facturacion/facturas', lista_facturas, name='lista_facturas'),
    path('facturacion/metodos-pago', lista_metodos_pago, name='lista_metodos_pago'),
    path('facturacion/metodos-pago/crear', crear_metodo_pago, name='crear_metodo_pago'),
    path('facturacion/metodos-pago/<int:pk>/editar', actualizar_metodo_pago, name='actualizar_metodo_pago'),
    path('facturacion/metodos-pago/<int:pk>/eliminar', eliminar_metodo_pago, name='eliminar_metodo_pago'),
    path('facturacion/buscar-ruc', buscar_cliente_ruc, name='buscar_cliente_ruc'),
]