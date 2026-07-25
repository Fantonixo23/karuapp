from django.db import models
from apps.tenants.models import Restaurante


class Categoria(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='categorias',
        null=True,
        blank=True,
    )
    nombre = models.CharField(max_length=100)
    icono = models.CharField(max_length=50, default='category')
    orden = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'categorias'
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['orden', 'nombre']
    
    def __str__(self):
        return self.nombre


class Producto(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='productos',
        null=True,
        blank=True,
    )
    nombre = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    precio = models.DecimalField(max_digits=10, decimal_places=0)
    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='productos'
    )
    disponible = models.BooleanField(default=True)
    imagen = models.URLField(blank=True, null=True, max_length=500)
    imagen_archivo = models.ImageField(upload_to='productos/', null=True, blank=True)
    variantes = models.JSONField(blank=True, null=True)
    iva = models.IntegerField(
        default=10,
        choices=[
            (0, 'Exento'),
            (5, '5%'),
            (10, '10%'),
            (15, '15%'),
        ],
        help_text='Tasa de IVA aplicable al producto'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'productos'
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['nombre']
    
    def __str__(self):
        return self.nombre