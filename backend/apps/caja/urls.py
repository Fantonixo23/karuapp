from django.urls import path
from . import views

urlpatterns = [
    path('caja/apertura', views.apertura, name='caja_apertura'),
    path('caja/sesion-actual', views.sesion_actual, name='caja_sesion_actual'),
    path('caja/movimiento', views.movimiento, name='caja_movimiento'),
    path('caja/movimientos', views.movimientos_lista, name='caja_movimientos'),
    path('caja/arqueo', views.arqueo, name='caja_arqueo'),
    path('caja/cierre', views.cierre, name='caja_cierre'),
    path('caja/cortes', views.cortes_lista, name='caja_cortes'),
]
