from django.db import models


class Restaurante(models.Model):
    PLANES = [
        ('free', 'Free'),
        ('basic', 'Básico'),
        ('pro', 'Pro'),
    ]

    nombre = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=100)
    activo = models.BooleanField(default=True)
    plan = models.CharField(max_length=20, choices=PLANES, default='free')
    fecha_alta = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'restaurantes'
        verbose_name = 'Restaurante'
        verbose_name_plural = 'Restaurantes'

    def __str__(self):
        return self.nombre
