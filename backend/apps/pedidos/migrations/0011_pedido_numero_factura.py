from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0010_pedido_cajero'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedido',
            name='numero_factura',
            field=models.CharField(blank=True, help_text='Número de factura del timbrado: 001-001-0000001', max_length=20, null=True),
        ),
    ]
