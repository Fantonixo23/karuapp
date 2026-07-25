from django.db import models
from apps.tenants.models import Restaurante


class Configuracion(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='configuraciones',
        null=True,
        blank=True,
    )
    nombre_empresa = models.CharField(max_length=255)
    ruc = models.CharField(max_length=20)
    direccion = models.TextField(blank=True, null=True)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    tasa_iva = models.DecimalField(max_digits=5, decimal_places=2, default=10)
    timbrado_numero = models.CharField(max_length=20, default='001-001-0000001')
    establecimiento = models.CharField(max_length=3, default='001')
    punto_expedicion = models.CharField(max_length=3, default='001')
    estado = models.CharField(
        max_length=20,
        choices=[
            ('demo', 'Demo'),
            ('activo', 'Activo'),
            ('suspendido', 'Suspendido')
        ],
        default='demo'
    )
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    # SIFEN fields
    ambiente_sifen = models.CharField(
        max_length=20,
        choices=[('test', 'Pruebas'), ('produccion', 'Producción')],
        default='test'
    )
    certificado_pkcs12 = models.FileField(
        upload_to='certificados/', blank=True, null=True,
        help_text='Certificado digital .p12 para firma de facturas electrónicas'
    )
    csc = models.CharField(
        max_length=100, blank=True, null=True,
        help_text='Código de Seguridad del Contribuyente (CSC) para SIFEN'
    )
    csc_pin = models.CharField(
        max_length=20, blank=True, null=True,
        help_text='PIN del CSC'
    )
    csc_id = models.IntegerField(default=1, help_text='ID del CSC (1 o 2) - identifica cuál CSC está activo')
    cDepEmi = models.CharField(max_length=10, default='1', help_text='Código de departamento (SIFEN)')
    cCiuEmi = models.CharField(max_length=10, default='1', help_text='Código de ciudad/distrito')
    dDesDepEmi = models.CharField(max_length=100, default='CAPITAL', help_text='Descripción del departamento')
    dDesCiuEmi = models.CharField(max_length=100, default='ASUNCION (DISTRITO)', help_text='Descripción de la ciudad/distrito')
    cDirEmi = models.TextField(blank=True, default='', help_text='Dirección fiscal del emisor (para SIFEN)')
    dNumCas = models.IntegerField(default=0, help_text='Número de casa del emisor')
    dEmailE = models.EmailField(blank=True, default='', help_text='Email del emisor')
    gActEco_codigo = models.CharField(max_length=10, default='47111', help_text='Código de actividad económica (SIFEN)')
    gActEco_descripcion = models.CharField(
        max_length=255, default='Venta al por menor en comercios no especializados',
        help_text='Descripción de la actividad económica'
    )
    tamano_papel = models.CharField(
        max_length=4,
        choices=[('58mm', '58mm'), ('80mm', '80mm')],
        default='58mm',
        help_text='Tamaño de papel para impresión térmica'
    )
    sifen_habilitado = models.BooleanField(default=False, help_text='Habilitar facturación electrónica SIFEN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'configuracion'
        verbose_name = 'Configuración'
        verbose_name_plural = 'Configuraciones'
    
    def __str__(self):
        return self.nombre_empresa


class Timbrado(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='timbrados',
        null=True,
        blank=True,
    )
    establecimiento = models.CharField(max_length=3, default='001')
    punto_expedicion = models.CharField(max_length=3, default='001')
    numero_inicio = models.IntegerField()
    numero_fin = models.IntegerField()
    numero_actual = models.IntegerField(default=0)
    fecha_vencimiento = models.DateField()
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'timbrados'
        verbose_name = 'Timbrado'
        verbose_name_plural = 'Timbrados'
    
    def __str__(self):
        return f"{self.establecimiento}-{self.punto_expedicion}"


class Factura(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='facturas',
        null=True,
        blank=True,
    )
    numero = models.CharField(max_length=20)
    pedido = models.ForeignKey(
        'pedidos.Pedido',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='facturas'
    )
    ruc_cliente = models.CharField(max_length=20)
    nombre_cliente = models.CharField(max_length=255)
    xml = models.TextField(blank=True, default='')
    cdc = models.CharField(max_length=32, blank=True, default='', verbose_name='Código de Control')
    kude = models.TextField(blank=True, default='', verbose_name='KUDE para QR')
    qr_base64 = models.TextField(blank=True, default='', verbose_name='QR en base64')
    sifen_estado = models.CharField(
        max_length=20,
        choices=[
            ('pendiente', 'Pendiente'),
            ('enviada', 'Enviada a SIFEN'),
            ('aprobada', 'Aprobada por SIFEN'),
            ('rechazada', 'Rechazada por SIFEN'),
            ('anulada', 'Anulada'),
        ],
        default='pendiente',
        verbose_name='Estado SIFEN'
    )
    sifen_mensaje = models.TextField(blank=True, default='', verbose_name='Mensaje SIFEN')
    protocolo = models.TextField(blank=True, default='', verbose_name='Protocolo SIFEN')
    estado = models.CharField(
        max_length=20,
        choices=[
            ('borrador', 'Borrador'),
            ('generada', 'Generada'),
            ('anulada', 'Anulada')
        ],
        default='borrador'
    )
    total = models.DecimalField(max_digits=10, decimal_places=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'facturas'
        verbose_name = 'Factura'
        verbose_name_plural = 'Facturas'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Factura {self.numero} ({self.cdc[:16]}...)"


class MetodoPago(models.Model):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='metodos_pago',
        null=True,
        blank=True,
    )
    nombre = models.CharField(max_length=50)
    etiqueta = models.CharField(max_length=100)
    icono = models.CharField(max_length=50, default='payments')
    color = models.CharField(max_length=7, default='#4CAF50')
    activo = models.BooleanField(default=True)
    orden = models.IntegerField(default=0)

    class Meta:
        db_table = 'metodos_pago'
        verbose_name = 'Método de Pago'
        verbose_name_plural = 'Métodos de Pago'
        ordering = ['orden']
        unique_together = ('restaurante', 'nombre')

    def __str__(self):
        return self.etiqueta