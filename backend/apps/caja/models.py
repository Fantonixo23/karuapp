from django.db import models
from django.db.models import Q, UniqueConstraint
from django.utils import timezone
from apps.usuarios.models import Usuario
from apps.tenants.models import Restaurante


class CajaSession(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='caja_sesiones',
    )
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='Cajero'
    )
    fondo_inicial = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='Fondo Inicial Gs.')
    apertura_en = models.DateTimeField(auto_now_add=True, verbose_name='Apertura')
    cierre_en = models.DateTimeField(null=True, blank=True, verbose_name='Cierre')
    estado = models.CharField(
        max_length=20,
        choices=[('abierta', 'Abierta'), ('cerrada', 'Cerrada')],
        default='abierta'
    )
    notas_apertura = models.TextField(blank=True, default='')
    notas_cierre = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'caja_sesiones'
        verbose_name = 'Sesión de Caja'
        verbose_name_plural = 'Sesiones de Caja'
        ordering = ['-apertura_en']
        constraints = [
            UniqueConstraint(
                fields=['restaurante'],
                condition=Q(estado='abierta'),
                name='una_caja_abierta_por_restaurante'
            ),
        ]

    def __str__(self):
        return f'Caja #{self.id} ({self.usuario.nombre if self.usuario else "?"}) - {self.apertura_en.strftime("%d/%m/%Y %H:%M")}'

    def cerrar(self):
        self.cierre_en = timezone.now()
        self.estado = 'cerrada'
        self.save()

    def total_ventas_efectivo(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='venta', metodo_pago='efectivo'
        )) or 0

    def total_ventas_tarjeta(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='venta', metodo_pago='tarjeta'
        )) or 0

    def total_ventas_transferencia(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='venta', metodo_pago='transferencia'
        )) or 0

    def total_ventas_qr(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='venta', metodo_pago='qr'
        )) or 0

    def total_ingresos_extra(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='ingreso_extra'
        )) or 0

    def total_retiros(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='retiro'
        )) or 0

    def total_propinas(self):
        return sum(float(m.propina) for m in self.movimientos.filter(
            tipo='venta'
        )) or 0

    def total_ventas(self):
        return sum(float(m.monto_pyg) for m in self.movimientos.filter(
            tipo='venta'
        )) or 0

    def efectivo_esperado(self):
        ventas_efectivo = self.total_ventas_efectivo()
        ingresos = self.total_ingresos_extra()
        retiros = self.total_retiros()
        return float(self.fondo_inicial) + ventas_efectivo + ingresos - retiros


class MovimientoCaja(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='movimientos_caja',
    )
    session = models.ForeignKey(
        CajaSession,
        on_delete=models.CASCADE,
        related_name='movimientos'
    )
    tipo = models.CharField(
        max_length=20,
        choices=[
            ('venta', 'Venta'),
            ('ingreso_extra', 'Ingreso Extra'),
            ('retiro', 'Retiro'),
            ('ajuste', 'Ajuste'),
        ],
        default='venta'
    )
    metodo_pago = models.CharField(
        max_length=20,
        choices=[
            ('efectivo', 'Efectivo'),
            ('tarjeta', 'Tarjeta'),
            ('transferencia', 'Transferencia'),
            ('qr', 'QR'),
            ('mixto', 'Mixto'),
        ],
        default='efectivo'
    )
    monto = models.DecimalField(max_digits=12, decimal_places=0, verbose_name='Monto')
    moneda = models.CharField(max_length=10, default='PYG')
    monto_pyg = models.DecimalField(max_digits=12, decimal_places=0, verbose_name='Monto en Gs.')
    pedido = models.ForeignKey(
        'pedidos.Pedido',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='movimientos_caja'
    )
    detalle_pagos = models.JSONField(null=True, blank=True, verbose_name='Detalle de pagos mixtos')
    motivo = models.CharField(max_length=255, blank=True, default='',
                              verbose_name='Motivo (retiros/ingresos)')
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    propina = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='Propina')
    vuelto = models.DecimalField(max_digits=12, decimal_places=0, default=0, verbose_name='Vuelto')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'caja_movimientos'
        verbose_name = 'Movimiento de Caja'
        verbose_name_plural = 'Movimientos de Caja'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_tipo_display()} {self.monto_pyg}Gs - {self.created_at.strftime("%H:%M")}'


class CorteCaja(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='cortes_caja',
    )
    session = models.ForeignKey(
        CajaSession,
        on_delete=models.CASCADE,
        related_name='cortes'
    )
    usuario_cierre = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    fondo_inicial = models.DecimalField(max_digits=12, decimal_places=0)
    total_ventas_efectivo = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_ventas_tarjeta = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_ventas_transferencia = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_ventas_qr = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_ingresos_extra = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_retiros = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_propinas = models.DecimalField(max_digits=12, decimal_places=0, default=0)
    total_ventas = models.DecimalField(max_digits=12, decimal_places=0, default=0)

    # Arqueo
    denominaciones = models.JSONField(null=True, blank=True,
                                      verbose_name='Conteo de billetes/monedas')
    total_contado_efectivo = models.DecimalField(max_digits=12, decimal_places=0, default=0,
                                                  verbose_name='Efectivo contado físicamente')
    total_esperado = models.DecimalField(max_digits=12, decimal_places=0, default=0)

    diferencia = models.DecimalField(max_digits=12, decimal_places=0, default=0,
                                      verbose_name='Diferencia (sobrante+/faltante-)')
    tipo_diferencia = models.CharField(max_length=20, blank=True, default='',
                                       choices=[('', 'Sin diferencia'), ('sobrante', 'Sobrante'),
                                                ('faltante', 'Faltante')])
    observaciones = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'caja_cortes'
        verbose_name = 'Corte de Caja'
        verbose_name_plural = 'Cortes de Caja'
        ordering = ['-created_at']

    def __str__(self):
        return f'Corte #{self.id} - {self.created_at.strftime("%d/%m/%Y %H:%M")}'
