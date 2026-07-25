from django.db import models
from django.utils import timezone
from apps.usuarios.models import Usuario
from apps.mesas.models import Mesa
from apps.tenants.models import Restaurante


ESTADOS_PEDIDO = [
    ('pendiente', 'Pendiente'),
    ('cocinando', 'Cocinando'),
    ('listo', 'Listo'),
    ('en_camino', 'En Camino'),
    ('entregado', 'Entregado'),
    ('pagado', 'Pagado'),
    ('cancelado', 'Cancelado'),
]

def transicion_valida(estado_actual, nuevo_estado):
    return True


class Pedido(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='pedidos',
        null=True,
        blank=True,
    )
    mesa = models.ForeignKey(
        Mesa,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos'
    )
    mesero = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pedidos'
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADOS_PEDIDO,
        default='pendiente'
    )
    
    # Delivery
    delivery = models.BooleanField(default=False)
    nombre_cliente = models.CharField(max_length=255, blank=True, null=True)
    telefono_cliente = models.CharField(max_length=50, blank=True, null=True)
    direccion = models.TextField(blank=True, null=True)
    
    # Tipo de pedido (mesa, venta, delivery)
    tipo_pedido = models.CharField(
        max_length=20,
        choices=[
            ('mesa', 'Mesa'),
            ('venta', 'Venta'),
            ('delivery', 'Delivery')
        ],
        default='mesa'
    )
    
    notas = models.TextField(blank=True, null=True)
    items = models.JSONField(default=list)
    total = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    metodo_pago = models.CharField(
        max_length=50,
        default='efectivo'
    )
    sincronizado = models.BooleanField(default=True)
    numero_orden = models.CharField(max_length=20, blank=True, null=True)
    propina = models.DecimalField(max_digits=10, decimal_places=0, default=0)
    
    # Datos de comprobante para métodos de pago
    comprobante_nro = models.CharField(max_length=50, blank=True, null=True, help_text='Numero de comprobante/operacion')
    marca_tarjeta = models.CharField(max_length=50, blank=True, null=True, help_text='Visa, Mastercard, Cabal, Amex')
    marca_qr = models.CharField(max_length=50, blank=True, null=True, help_text='Tigo Money, Personal Pay, Bancard QR')
    cuotas = models.IntegerField(default=1, help_text='Cantidad de cuotas')
    ultimos_4 = models.CharField(max_length=4, blank=True, null=True, help_text='Ultimos 4 digitos de tarjeta')
    
    # Pagos mixtos multi-moneda
    detalle_pagos = models.JSONField(blank=True, null=True, help_text='Array de pagos: [{metodo, moneda, monto, monto_pyg}]')
    
    # Datos para ticket/factura
    cliente_tipo = models.CharField(max_length=20, default='consumidor')  # consumidor o factura
    cliente_ruc = models.CharField(max_length=20, default='44444444-7')
    cliente_nombre = models.CharField(max_length=255, default='Consumidor Final')
    generar_comanda = models.BooleanField(default=False)
    generar_factura = models.BooleanField(default=False)
    tipo_iva = models.IntegerField(default=10, help_text='Tasa de IVA aplicada al cobro (0, 5, 10)')
    
    motivo_cancelacion = models.TextField(blank=True, null=True, help_text='Motivo de cancelacion texto libre')
    cancelado_en_estado = models.CharField(max_length=20, blank=True, null=True, help_text='Estado en el que estaba cuando se cancelo')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'pedidos'
        verbose_name = 'Pedido'
        verbose_name_plural = 'Pedidos'
        ordering = ['-created_at']
    
    def __str__(self):
        if self.delivery:
            return f"Pedido #{self.numero_orden or self.id} - DELIVERY"
        return f"Pedido #{self.numero_orden or self.id} - Mesa {self.mesa.numero if self.mesa else 'Sin mesa'}"

    def save(self, *args, **kwargs):
        if not self.numero_orden:
            today = timezone.now().date()
            
            pedidos_hoy = Pedido.objects.filter(restaurante=self.restaurante, created_at__date=today).order_by('-numero_orden')
            
            numero_mas_alto = 0
            for p in pedidos_hoy:
                try:
                    num = int(p.numero_orden)
                    if num > numero_mas_alto:
                        numero_mas_alto = num
                except (ValueError, TypeError):
                    pass
            
            siguiente = numero_mas_alto + 1
            self.numero_orden = f"{siguiente:03d}"
        super().save(*args, **kwargs)


class Impresion(models.Model):
    pedido = models.ForeignKey(
        Pedido,
        on_delete=models.CASCADE,
        related_name='impresiones'
    )
    tipo = models.CharField(
        max_length=20,
        choices=[
            ('comanda', 'Comanda'),
            ('factura', 'Factura'),
            ('ticket', 'Ticket')
        ]
    )
    numero_impresion = models.IntegerField(default=1)
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='impresiones',
        null=True,
        blank=True,
    )
    impresion_id = models.CharField(max_length=50)
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'impresiones'
        verbose_name = 'Impresión'
        verbose_name_plural = 'Impresiones'
        ordering = ['-created_at']
        unique_together = ('restaurante', 'impresion_id')
    
    def __str__(self):
        return f"{self.impresion_id} - {self.tipo} - Pedido #{self.pedido.numero_orden}"
    
    def save(self, *args, **kwargs):
        if not self.impresion_id:
            from uuid import uuid4
            self.impresion_id = f"IMP-{uuid4().hex[:8].upper()}"
            
            ultimo = Impresion.objects.filter(pedido=self.pedido, tipo=self.tipo).order_by('-numero_impresion').first()
            self.numero_impresion = (ultimo.numero_impresion + 1) if ultimo else 1
        super().save(*args, **kwargs)