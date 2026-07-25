from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0005_configuracion_sifen_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='factura',
            name='kude',
            field=models.TextField(blank=True, default='', verbose_name='KUDE para QR'),
        ),
        migrations.AddField(
            model_name='factura',
            name='qr_base64',
            field=models.TextField(blank=True, default='', verbose_name='QR en base64'),
        ),
        migrations.AddField(
            model_name='factura',
            name='sifen_estado',
            field=models.CharField(choices=[('pendiente', 'Pendiente'), ('enviada', 'Enviada a SIFEN'), ('aprobada', 'Aprobada por SIFEN'), ('rechazada', 'Rechazada por SIFEN'), ('anulada', 'Anulada')], default='pendiente', max_length=20, verbose_name='Estado SIFEN'),
        ),
        migrations.AddField(
            model_name='factura',
            name='sifen_mensaje',
            field=models.TextField(blank=True, default='', verbose_name='Mensaje SIFEN'),
        ),
    ]
