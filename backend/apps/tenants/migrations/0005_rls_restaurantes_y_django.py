from django.db import migrations

TABLAS_DENY_BY_DEFAULT = [
    'auth_group_permissions',
    'auth_permission',
    'auth_user',
    'auth_user_groups',
    'auth_user_user_permissions',
    'django_admin_log',
    'django_content_type',
    'django_migrations',
    'django_session',
]

SQL_DENY_DEFAULT = "\n".join(
    f"""
    ALTER TABLE {tabla} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE {tabla} FORCE ROW LEVEL SECURITY;
    -- Sin ninguna policy: FORCE + ENABLE sin CREATE POLICY = nadie puede
    -- leer/escribir vía la API de Supabase. Django sigue accediendo normal
    -- porque usa el rol postgres directo, no PostgREST.
    """
    for tabla in TABLAS_DENY_BY_DEFAULT
)

SQL_REVERTIR_DENY_DEFAULT = "\n".join(
    f"""
    ALTER TABLE {tabla} NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE {tabla} DISABLE ROW LEVEL SECURITY;
    """
    for tabla in TABLAS_DENY_BY_DEFAULT
)

SQL_RESTAURANTES = """
ALTER TABLE restaurantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurantes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lectura_publica_activos ON restaurantes;
CREATE POLICY lectura_publica_activos ON restaurantes
    FOR SELECT
    USING (activo = true OR current_setting('app.is_superadmin', true) = 'true');

DROP POLICY IF EXISTS escritura_solo_superadmin ON restaurantes;
CREATE POLICY escritura_solo_superadmin ON restaurantes
    FOR INSERT
    WITH CHECK (current_setting('app.is_superadmin', true) = 'true');

DROP POLICY IF EXISTS modificacion_solo_superadmin ON restaurantes;
CREATE POLICY modificacion_solo_superadmin ON restaurantes
    FOR UPDATE
    USING (current_setting('app.is_superadmin', true) = 'true');

DROP POLICY IF EXISTS borrado_solo_superadmin ON restaurantes;
CREATE POLICY borrado_solo_superadmin ON restaurantes
    FOR DELETE
    USING (current_setting('app.is_superadmin', true) = 'true');
"""

SQL_REVERTIR_RESTAURANTES = """
DROP POLICY IF EXISTS lectura_publica_activos ON restaurantes;
DROP POLICY IF EXISTS escritura_solo_superadmin ON restaurantes;
DROP POLICY IF EXISTS modificacion_solo_superadmin ON restaurantes;
DROP POLICY IF EXISTS borrado_solo_superadmin ON restaurantes;
ALTER TABLE restaurantes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE restaurantes DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0004_rls_tablas_restantes'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_RESTAURANTES, reverse_sql=SQL_REVERTIR_RESTAURANTES),
        migrations.RunSQL(sql=SQL_DENY_DEFAULT, reverse_sql=SQL_REVERTIR_DENY_DEFAULT),
    ]
