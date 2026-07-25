from django.db import migrations, models
from django.utils.text import slugify


def populate_default_tenant(apps, schema_editor):
    Restaurante = apps.get_model('tenants', 'Restaurante')
    Usuario = apps.get_model('usuarios', 'Usuario')
    Categoria = apps.get_model('productos', 'Categoria')
    Producto = apps.get_model('productos', 'Producto')
    Mesa = apps.get_model('mesas', 'Mesa')
    Pedido = apps.get_model('pedidos', 'Pedido')
    Impresion = apps.get_model('pedidos', 'Impresion')
    Configuracion = apps.get_model('facturacion', 'Configuracion')
    Timbrado = apps.get_model('facturacion', 'Timbrado')
    Factura = apps.get_model('facturacion', 'Factura')
    MetodoPago = apps.get_model('facturacion', 'MetodoPago')
    Inventario = apps.get_model('inventario', 'Inventario')
    MovimientoInventario = apps.get_model('inventario', 'MovimientoInventario')
    CajaSession = apps.get_model('caja', 'CajaSession')
    MovimientoCaja = apps.get_model('caja', 'MovimientoCaja')
    CorteCaja = apps.get_model('caja', 'CorteCaja')

    default_tenant = Restaurante.objects.create(
        nombre='Restaurante por defecto',
        slug='default',
        activo=True,
        plan='free',
    )

    for model in [Usuario, Categoria, Producto, Mesa, Pedido, Impresion,
                  Configuracion, Timbrado, Factura, MetodoPago,
                  Inventario, MovimientoInventario,
                  CajaSession, MovimientoCaja, CorteCaja]:
        model.objects.filter(restaurante__isnull=True).update(restaurante=default_tenant)


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
        ('usuarios', '0004_usuario_restaurante_alter_usuario_pin_and_more'),
        ('productos', '0004_categoria_restaurante_producto_restaurante'),
        ('mesas', '0004_mesa_restaurante_alter_mesa_numero_and_more'),
        ('pedidos', '0016_impresion_restaurante_pedido_restaurante_and_more'),
        ('facturacion', '0011_configuracion_restaurante_factura_restaurante_and_more'),
        ('inventario', '0002_inventario_restaurante_and_more'),
        ('caja', '0002_cajasession_restaurante_cortecaja_restaurante_and_more'),
    ]

    operations = [
        migrations.RunPython(populate_default_tenant, migrations.RunPython.noop),
    ]
