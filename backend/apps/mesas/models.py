from django.db import models
from apps.tenants.models import Restaurante


class Mesa(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='mesas',
        null=True,
        blank=True,
    )
    numero = models.IntegerField()
    nombre = models.CharField(max_length=100, blank=True, null=True)
    capacidad = models.IntegerField(default=4)
    area = models.CharField(
        max_length=50,
        choices=[
            ('principal', 'Principal'),
            ('interior', 'Interior'),
            ('exterior', 'Exterior'),
            ('patio', 'Patio'),
        ],
        default='principal'
    )
    estado = models.CharField(
        max_length=20,
        choices=[
            ('disponible', 'Disponible'),
            ('ocupada', 'Ocupada'),
            ('reservada', 'Reservada'),
            ('limpieza', 'Limpieza')
        ],
        default='disponible'
    )
    comensales = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'mesas'
        verbose_name = 'Mesa'
        verbose_name_plural = 'Mesas'
        ordering = ['numero']
        unique_together = ('restaurante', 'numero')
    
    def __str__(self):
        return self.nombre or f"Mesa {self.numero}"
    
    @property
    def pedidos_activos(self):
        from apps.pedidos.models import Pedido
        return Pedido.objects.filter(
            mesa=self,
            estado__in=['pendiente', 'cocinando', 'listo']
        ).count()
    
    @property
    def pedido_actual(self):
        from apps.pedidos.models import Pedido
        return Pedido.objects.filter(
            mesa=self,
            estado__in=['pendiente', 'cocinando', 'listo']
        ).first()
    
    @property
    def tiempo_ocupado(self):
        if self.estado == 'ocupada' and self.pedido_actual:
            from django.utils import timezone
            diff = timezone.now() - self.pedido_actual.created_at
            minutos = int(diff.total_seconds() / 60)
            if minutos < 60:
                return f"{minutos}min"
            horas = minutos // 60
            mins = minutos % 60
            return f"{horas}h {mins}m"
        return "0min"