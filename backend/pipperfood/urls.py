from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView, RedirectView
from django.views.static import serve
from django.shortcuts import redirect, render
from django.contrib import admin
from apps.usuarios.models import Usuario

from .saas_views import login_saas, register_saas, me, logout_saas
from apps.usuarios.saas_auth_views import (
    forgot_password, verify_reset_code,
    send_owner_code, verify_owner_code,
    funcionarios_list, funcionarios_create, funcionarios_update, funcionarios_delete, funcionarios_regenerar_pin,
    funcionarios_listado_mobile, login_pin_mobile,
)


def login_redirect(request):
    if request.user.is_authenticated:
        return redirect('/app/')
    return TemplateView.as_view(template_name='login.html')(request)


def login_pin_view(request, slug):
    return render(request, 'login_pin.html')


def app_view(request):
    usuario = None
    if request.user.is_authenticated:
        usuario = Usuario.objects.filter(email=request.user.email).first()
    return render(request, 'app.html', {'usuario': usuario})


def mobile_app_view(request, slug):
    return render(request, 'app.html', {'usuario': None})


urlpatterns = [
    path('saas/', admin.site.urls),
    path('api/auth/login-saas', login_saas, name='login_saas'),
    path('api/auth/register-saas', register_saas, name='register_saas'),
    path('api/auth/me', me, name='auth_me'),
    path('api/auth/logout', logout_saas, name='logout_saas'),
    path('api/auth/forgot-password', forgot_password, name='forgot_password'),
    path('api/auth/verify-reset-code', verify_reset_code, name='verify_reset_code'),
    path('api/auth/send-owner-code', send_owner_code, name='send_owner_code'),
    path('api/auth/verify-owner-code', verify_owner_code, name='verify_owner_code'),
    path('api/funcionarios', funcionarios_list, name='funcionarios_list'),
    path('api/funcionarios/crear', funcionarios_create, name='funcionarios_create'),
    path('api/funcionarios/<int:funcionario_id>/editar', funcionarios_update, name='funcionarios_update'),
    path('api/funcionarios/<int:funcionario_id>/eliminar', funcionarios_delete, name='funcionarios_delete'),
    path('api/funcionarios/<int:funcionario_id>/regenerar-pin', funcionarios_regenerar_pin, name='funcionarios_regenerar_pin'),
    path('api/mobile/funcionarios/<slug:slug>', funcionarios_listado_mobile, name='funcionarios_listado_mobile'),
    path('api/auth/login-pin-mobile', login_pin_mobile, name='login_pin_mobile'),
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
    path('login', login_redirect, name='login'),
    path('login-pin/<slug:slug>', login_pin_view, name='login_pin'),
]

urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]

frontend_dir = settings.BASE_DIR / 'frontend'
urlpatterns += [
    re_path(r'^(?P<path>assets/.*)$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?P<path>sounds/.*)$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?P<path>(apple-touch-icon|logo|favicon|pwa-\d+x\d+|manifest|registerSW|sw|workbox-e4022e15)\..*)$', serve, {'document_root': frontend_dir}),
    re_path(r'^(?P<path>.*\.(png|jpg|jpeg|gif|ico|svg|css|js|json|webmanifest|mp3|pdf))$', serve, {'document_root': frontend_dir}),
    re_path(r'^app/', app_view),
    re_path(r'^mobile/(?P<slug>[^/]+)/', mobile_app_view),
    re_path(r'^(?!api/|saas/|login|login-pin|media/|static/|mobile/).*$', app_view),
]