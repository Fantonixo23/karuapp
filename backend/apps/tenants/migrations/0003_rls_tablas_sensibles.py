from django.db import migrations


TABLAS_SENSIBLES = [
    'usuarios',
    'caja_sesiones',
    'caja_movimientos',
    'caja_cortes',
    'facturas',
]

SQL_HABILITAR = '\n'.join(
    f'ALTER TABLE {t} ENABLE ROW LEVEL SECURITY;'
    f' ALTER TABLE {t} FORCE ROW LEVEL SECURITY;'
    for t in TABLAS_SENSIBLES
)

SQL_POLICIES = '\n'.join(
    f'''CREATE POLICY tenant_isolation ON {t}
    FOR ALL
    USING (
        restaurante_id = NULLIF(current_setting('app.current_restaurante_id', true), '')::int
        OR current_setting('app.is_superadmin', true) = 'true'
    );'''
    for t in TABLAS_SENSIBLES
)

SQL_REVERTIR_HABILITAR = '\n'.join(
    f'ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY;'
    f' ALTER TABLE {t} DISABLE ROW LEVEL SECURITY;'
    for t in reversed(TABLAS_SENSIBLES)
)

SQL_REVERTIR_POLICIES = '\n'.join(
    f'DROP POLICY IF EXISTS tenant_isolation ON {t};'
    for t in TABLAS_SENSIBLES
)


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0002_populate_default_tenant'),
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
