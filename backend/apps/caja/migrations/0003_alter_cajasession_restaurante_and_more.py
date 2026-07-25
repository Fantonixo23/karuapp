from django.db import migrations, models
import django.db.models.deletion


def set_default_restaurante(apps, schema_editor):
    CajaSession = apps.get_model('caja', 'CajaSession')
    MovimientoCaja = apps.get_model('caja', 'MovimientoCaja')
    CorteCaja = apps.get_model('caja', 'CorteCaja')
    Restaurante = apps.get_model('tenants', 'Restaurante')
    primero = Restaurante.objects.filter(activo=True).first()
    if primero:
        CajaSession.objects.filter(restaurante__isnull=True).update(restaurante=primero)
        MovimientoCaja.objects.filter(restaurante__isnull=True).update(restaurante=primero)
        CorteCaja.objects.filter(restaurante__isnull=True).update(restaurante=primero)


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0002_cajasession_restaurante_cortecaja_restaurante_and_more'),
    ]

    operations = [
        migrations.RunPython(set_default_restaurante, reverse_code=migrations.RunPython.noop),
        migrations.AlterField(
            model_name='cajasession',
            name='restaurante',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='caja_sesiones', to='tenants.restaurante'),
        ),
        migrations.AlterField(
            model_name='cortecaja',
            name='restaurante',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cortes_caja', to='tenants.restaurante'),
        ),
        migrations.AlterField(
            model_name='movimientocaja',
            name='restaurante',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movimientos_caja', to='tenants.restaurante'),
        ),
        migrations.AddConstraint(
            model_name='cajasession',
            constraint=models.UniqueConstraint(condition=models.Q(('estado', 'abierta')), fields=('restaurante',), name='una_caja_abierta_por_restaurante'),
        ),
    ]
