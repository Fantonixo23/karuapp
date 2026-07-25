from django.db import migrations


TABLAS_RESTANTES = [
    'pedidos',
    'impresiones',
    'categorias',
    'productos',
    'inventario',
    'movimientos_inventario',
    'mesas',
    'configuracion',
    'timbrados',
    'metodos_pago',
]

SQL_HABILITAR = '\n'.join(
    f'ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;'
    f' ALTER TABLE {t} FORCE ROW LEVEL SECURITY;'
    for t in TABLAS_RESTANTES
)

SQL_POLICIES = '\n'.join(
    f'''CREATE POLICY tenant_isolation ON {t}
    FOR ALL
    USING (
        restaurante_id = NULLIF(current_setting('app.current_restaurante_id', true), '')::int
        OR current_setting('app.is_superadmin', true) = 'true'
    );'''
    for t in TABLAS_RESTANTES
)

SQL_REVERTIR_HABILITAR = '\n'.join(
    f'ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY;'
    f' ALTER TABLE {t} DISABLE ROW LEVEL SECURITY;'
    for t in reversed(TABLAS_RESTANTES)
)

SQL_REVERTIR_POLICIES = '\n'.join(
    f'DROP POLICY IF EXISTS tenant_isolation ON {t};'
    for t in TABLAS_RESTANTES
)


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0003_rls_tablas_sensibles'),
    ]

    operations = [
        migrations.RunSQL(
            sql=SQL_HABILITAR,
            reverse_sql=SQL_REVERTIR_HABILITAR,
        ),
        migrations.RunSQL(
            sql=SQL_POLICIES,
            reverse_sql=SQL_REVERTIR_POLICIES,
        ),
    ]
