from django.urls import path
from .views import (
    get_sifen_status,
    upload_certificate,
    transmitir_factura,
    consultar_factura,
)

urlpatterns = [
    path('sifen/status', get_sifen_status, name='sifen_status'),
    path('sifen/certificado/subir', upload_certificate, name='upload_certificate'),
    path('sifen/facturas/transmitir', transmitir_factura, name='transmitir_factura'),
    path('sifen/facturas/<str:cdc>/consultar', consultar_factura, name='consultar_factura'),
]
