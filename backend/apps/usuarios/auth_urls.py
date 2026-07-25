from django.urls import path
from .auth_views import login_pin, login_admin, register

urlpatterns = [
    path('auth/pin', login_pin, name='auth_login_pin'),
    path('auth/admin', login_admin, name='auth_login_admin'),
    path('auth/register', register, name='auth_register'),
]
