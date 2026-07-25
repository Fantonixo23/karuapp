from django.urls import path
from .views import (
    info_empresa,
    verificar_suscripcion,
    obtener_ip_local,
    verificar_licencia as verificar_licencia_viejo,
    activar_licencia,
    print_token,
    qr_conexion,
    backup_status,
    backup_run,
)
from .licencia import verificar_licencia_api

urlpatterns = [
    path('info', info_empresa, name='info'),
    path('verificar-suscripcion', verificar_suscripcion, name='verificar_suscripcion'),
    path('obtener-ip', obtener_ip_local, name='obtener_ip'),
    path('verificar-licencia', verificar_licencia_api, name='verificar_licencia'),
    path('activar-licencia', activar_licencia, name='activar_licencia'),
    path('print-token', print_token, name='print_token'),
    path('qr-conexion', qr_conexion, name='qr_conexion'),
    path('backup', backup_status, name='backup_status'),
    path('backup/run', backup_run, name='backup_run'),
]