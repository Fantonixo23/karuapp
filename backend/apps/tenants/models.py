from django.db import models


from django.utils import timezone
from datetime import timedelta


class Restaurante(models.Model):
    PLANES = [
        ('free', 'Free'),
        ('basic', 'Básico'),
        ('pro', 'Pro'),
    ]
    ESTADOS_LICENCIA = [
        ('activo', 'Activo'),
        ('expirado', 'Expirado'),
        ('suspended', 'Suspendido'),
    ]

    nombre = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=100)
    activo = models.BooleanField(default=True)
    plan = models.CharField(max_length=20, choices=PLANES, default='free')
    fecha_alta = models.DateTimeField(auto_now_add=True)
    fecha_expiracion = models.DateTimeField(null=True, blank=True)
    estado_licencia = models.CharField(
        max_length=20, choices=ESTADOS_LICENCIA, default='activo'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurantes'
        verbose_name = 'Restaurante'
        verbose_name_plural = 'Restaurantes'

    def __str__(self):
        return self.nombre

    def save(self, *args, **kwargs):
        if not self.fecha_expiracion:
            self.fecha_expiracion = timezone.now() + timedelta(days=14)
        super().save(*args, **kwargs)

    def extender_licencia(self, dias=31):
        ahora = timezone.now()
        if self.fecha_expiracion and self.fecha_expiracion > ahora:
            self.fecha_expiracion += timedelta(days=dias)
        else:
            self.fecha_expiracion = ahora + timedelta(days=dias)
        self.estado_licencia = 'activo'
        self.save(update_fields=['fecha_expiracion', 'estado_licencia'])

    @property
    def licencia_activa(self):
        if not self.activo or self.estado_licencia == 'suspended':
            return False
        if self.estado_licencia == 'expirado':
            return False
        if self.fecha_expiracion and self.fecha_expiracion < timezone.now():
            self.estado_licencia = 'expirado'
            self.save(update_fields=['estado_licencia'])
            return False
        return True
