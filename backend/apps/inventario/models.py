from django.db import models
from apps.productos.models import Producto
from apps.tenants.models import Restaurante


class Inventario(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='inventarios',
        null=True,
        blank=True,
    )
    producto = models.OneToOneField(
        Producto,
        on_delete=models.CASCADE,
        related_name='inventario'
    )
    stock_actual = models.IntegerField(default=0)
    stock_minimo = models.IntegerField(default=5)
    unidad_medida = models.CharField(max_length=50, default='und')
    precio_costo = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventario'
        verbose_name = 'Inventario'
        verbose_name_plural = 'Inventarios'

    def __str__(self):
        return f"{self.producto.nombre} - Stock: {self.stock_actual}"

    @property
    def estado_stock(self):
        if self.stock_actual <= 0:
            return 'agotado'
        elif self.stock_actual <= self.stock_minimo:
            return 'bajo'
        return 'normal'


class MovimientoInventario(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='movimientos_inventario',
        null=True,
        blank=True,
    )
    TIPO_CHOICES = [
        ('entrada', 'Entrada'),
        ('salida', 'Salida'),
        ('ajuste', 'Ajuste'),
    ]

    MOTIVO_ENTRADA = [
        ('compra', 'Compra'),
        ('reposicion', 'Reposición'),
        ('ajuste', 'Ajuste de inventario'),
        ('devolucion', 'Devolución'),
    ]

    MOTIVO_SALIDA = [
        ('venta', 'Venta'),
        ('desperdicio', 'Desperdicio'),
        ('ajuste', 'Ajuste de inventario'),
        ('donacion', 'Donación'),
    ]

    inventario = models.ForeignKey(
        Inventario,
        on_delete=models.CASCADE,
        related_name='movimientos'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    cantidad = models.IntegerField()
    motivo = models.CharField(max_length=50, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'movimientos_inventario'
        verbose_name = 'Movimiento de Inventario'
        verbose_name_plural = 'Movimientos de Inventario'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.tipo} - {self.cantidad} - {self.inventario.producto.nombre}"