from django.db import models
from django.contrib.auth.models import User


class Plan(models.TextChoices):
    BASICO = 'basico', 'Basico (320.000 Gs)'
    STANDARD = 'standard', 'Standard (450.000 Gs)'
    PREMIUM = 'premium', 'Premium (550.000 Gs)'


class EstadoLicencia(models.TextChoices):
    ACTIVA = 'activa', 'Activa'
    BLOQUEADA = 'bloqueada', 'Bloqueada'
    VENCIDA = 'vencida', 'Vencida'
    CANCELADA = 'cancelada', 'Cancelada'
    PENDIENTE = 'pendiente', 'Pendiente'


class Cliente(models.Model):
    empresa = models.CharField(max_length=255)
    ruc = models.CharField(max_length=20)
    direccion = models.TextField(blank=True, null=True)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    plan = models.CharField(max_length=20, choices=Plan.choices, default=Plan.BASICO)
    estado = models.CharField(max_length=20, choices=EstadoLicencia.choices, default=EstadoLicencia.PENDIENTE)
    
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    
    dispositivo_id = models.CharField(max_length=100, blank=True, null=True)
    
    ultimo_check = models.DateTimeField(null=True, blank=True)
    ultima_ip = models.GenericIPAddressField(null=True, blank=True)
    esta_online = models.BooleanField(default=False)
    
    total_pagado = models.BigIntegerField(default=0)
    notas = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'clientes'
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def __str__(self):
        return f"{self.empresa} ({self.get_estado_display()})"

    @property
    def dias_hasta_vencimiento(self):
        from datetime import date
        if self.fecha_vencimiento:
            return (self.fecha_vencimiento - date.today()).days
        return None

    @property
    def esta_en_gracia(self):
        if self.estado == EstadoLicencia.BLOQUEADA:
            if self.dias_hasta_vencimiento and self.dias_hasta_vencimiento >= -4:
                return True
        return False


class HistorialPago(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='pagos')
    monto = models.BigIntegerField()
    fecha_pago = models.DateField()
    metodo_pago = models.CharField(max_length=50, blank=True, null=True)
    referencia = models.CharField(max_length=100, blank=True, null=True)
    notas = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'historial_pagos'
        verbose_name = 'Historial de Pago'
        verbose_name_plural = 'Historial de Pagos'
        ordering = ['-fecha_pago']

    def __str__(self):
        return f"{self.cliente.empresa} - {self.monto} Gs - {self.fecha_pago}"