from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.views.static import serve

urlpatterns = [
    path('api/', include('apps.usuarios.auth_urls')),
    path('api/', include('apps.usuarios.urls')),
    path('api/', include('apps.productos.urls')),
    path('api/', include('apps.mesas.urls')),
    path('api/', include('apps.pedidos.urls')),
    path('api/', include('apps.cocina.urls')),
    path('api/', include('apps.facturacion.urls')),
    path('api/', include('apps.informes.urls')),
    path('api/', include('apps.inventario.urls')),
    path('api/', include('apps.caja.urls')),
    path('api/', include('apps.sifen.urls')),
    path('api/', include('pipperfood.api_urls')),
]

urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]

frontend_dir = settings.BASE_DIR / 'frontend'
urlpatterns += [
    re_path(r'^(?P<path>assets/.*)$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?P<path>sounds/.*)$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?P<path>(apple-touch-icon|logo|favicon|pwa-\d+x\d+|manifest|registerSW|sw|workbox-e4022e15)\..*)$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?P<path>.*\.(png|jpg|jpeg|gif|ico|svg|css|js|json|webmanifest|mp3|pdf))$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?!api/).*$', TemplateView.as_view(template_name='index.html')),
]