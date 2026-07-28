from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from apps.tenants.models import Restaurante


class Rol(models.TextChoices):
    ADMIN = 'administrador', 'Administrador'
    MESERO = 'mesero', 'Mesero'
    CAJERO = 'cajero', 'Cajero'
    COCINA = 'cocina', 'Cocina'


MODULOS_POR_ROL = {
    'administrador': ['mesas', 'cocina', 'caja', 'delivery', 'informes', 'productos', 'inventario', 'funcionarios', 'configuracion'],
    'cajero':        ['mesas', 'caja', 'delivery', 'cocina'],
    'mesero':        ['mesas', 'cocina'],
    'cocina':        ['cocina'],
}


class UsuarioManager(BaseUserManager):
    def create_user(self, nombre, pin, rol=Rol.MESERO, created_by=None):
        if not pin:
            raise ValueError('El PIN es requerido')
        
        usuario = self.model(
            nombre=nombre,
            pin=pin,
            rol=rol,
            created_by=created_by
        )
        usuario.save(using=self._db)
        return usuario
    
    def create_superuser(self, nombre, pin, rol=Rol.ADMIN):
        return self.create_user(nombre, pin, rol, created_by=None)


class Usuario(AbstractBaseUser):
    restaurante = models.ForeignKey(
        Restaurante,
        on_delete=models.CASCADE,
        related_name='usuarios',
        null=True,
        blank=True,
    )
    nombre = models.CharField(max_length=255)
    pin = models.CharField(max_length=4, null=True, blank=True)
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.MESERO)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    activo = models.BooleanField(default=True)
    creado_por = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usuarios_creados'
    )
    ultimo_acceso = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = UsuarioManager()
    
    USERNAME_FIELD = 'pin'
    REQUIRED_FIELDS = ['nombre']
    
    class Meta:
        db_table = 'usuarios'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        unique_together = ('restaurante', 'pin')
    
    def __str__(self):
        return f"{self.nombre} ({self.rol})"
    
    def has_perm(self, perm, obj=None):
        return self.activo
    
    def has_module_perms(self, app_label):
        return self.activo
    
    @property
    def is_staff(self):
        return self.rol == Rol.ADMIN
    
    @property
    def modulos_acceso(self):
        return MODULOS_POR_ROL.get(self.rol, [])


class VerificationCode(models.Model):
    PURPOSES = [
        ('password_reset', 'Restablecer contraseña'),
        ('owner_access', 'Acceso de dueño'),
    ]
    email = models.EmailField()
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSES)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)
    blocked_until = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'verification_codes'
        verbose_name = 'Código de verificación'
        verbose_name_plural = 'Códigos de verificación'

    def __str__(self):
        return f"{self.code} ({self.purpose}) - {self.email}"


