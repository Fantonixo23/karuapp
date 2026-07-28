from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from django.http import HttpResponseRedirect
from django.urls import path
from django.contrib import messages
from apps.tenants.models import Restaurante


@admin.action(description='Extender licencia +31 días')
def extender_licencia_31(modeladmin, request, queryset):
    for r in queryset:
        r.extender_licencia(31)
    modeladmin.message_user(request, f'{queryset.count()} restaurante(s) actualizado(s): +31 días', messages.SUCCESS)


@admin.action(description='Extender licencia +7 días')
def extender_licencia_7(modeladmin, request, queryset):
    for r in queryset:
        r.extender_licencia(7)
    modeladmin.message_user(request, f'{queryset.count()} restaurante(s) actualizado(s): +7 días', messages.SUCCESS)


@admin.action(description='Suspender licencia')
def suspender_licencia(modeladmin, request, queryset):
    queryset.update(estado_licencia='suspended')
    modeladmin.message_user(request, f'{queryset.count()} restaurante(s) suspendido(s)', messages.WARNING)


@admin.action(description='Reactivar licencia')
def reactivar_licencia(modeladmin, request, queryset):
    for r in queryset:
        r.estado_licencia = 'activo'
        if not r.fecha_expiracion or r.fecha_expiracion < timezone.now():
            r.fecha_expiracion = timezone.now() + timezone.timedelta(days=14)
        r.save(update_fields=['estado_licencia', 'fecha_expiracion'])
    modeladmin.message_user(request, f'{queryset.count()} restaurante(s) reactivado(s)', messages.SUCCESS)


class RestauranteAdmin(admin.ModelAdmin):
    list_display = [
        'nombre', 'slug', 'plan', 'estado_licencia_colored',
        'fecha_expiracion', 'dias_restantes', 'activo', 'usuario_count'
    ]
    list_filter = ['plan', 'estado_licencia', 'activo']
    search_fields = ['nombre', 'slug']
    ordering = ['-fecha_alta']
    actions = [extender_licencia_31, extender_licencia_7, suspender_licencia, reactivar_licencia]

    def estado_licencia_colored(self, obj):
        colors = {'activo': 'green', 'expirado': 'red', 'suspended': 'orange'}
        c = colors.get(obj.estado_licencia, 'gray')
        return format_html('<span style="color:{};font-weight:600">● {}</span>', c, obj.get_estado_licencia_display())
    estado_licencia_colored.short_description = 'Estado'

    def dias_restantes(self, obj):
        if not obj.fecha_expiracion:
            return '—'
        delta = obj.fecha_expiracion - timezone.now()
        if delta.days < 0:
            return format_html('<span style="color:red;font-weight:600">Vencido</span>')
        return f'{delta.days} día(s)'
    dias_restantes.short_description = 'Días rest.'

    def usuario_count(self, obj):
        return obj.usuarios.count()
    usuario_count.short_description = 'Usuarios'

    fieldsets = [
        ('Información básica', {'fields': ['nombre', 'slug', 'activo']}),
        ('Plan y licencia', {'fields': [
            'plan', 'estado_licencia', 'fecha_expiracion',
        ]}),
    ]


admin.site.register(Restaurante, RestauranteAdmin)