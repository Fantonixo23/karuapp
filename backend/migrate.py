import sqlite3
import psycopg
import os
import sys
from decimal import Decimal

SQLITE_PATH = 'db.sqlite3'

POSTGRES_CONFIG = {
    'dbname': os.environ.get('DB_NAME', 'pipperfood'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'Kinflid1289'),
    'host': os.environ.get('DB_HOST', '127.0.0.1'),
    'port': os.environ.get('DB_PORT', '5432'),
}

def get_sqlite_data(table_name):
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(f'SELECT * FROM {table_name}')
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    conn.close()
    return columns, [dict(row) for row in rows]

def migrate_table(table_name, columns, rows, cursor_pg, conn_pg):
    if not rows:
        print(f'  {table_name}: 0 registros (omitido)')
        return
    
    for row in rows:
        values = []
        for col in columns:
            val = row.get(col)
            if val is None:
                values.append(None)
            elif isinstance(val, int):
                if col in ['activo', 'disponible', 'delivery', 'sincronizado']:
                    values.append(True if val == 1 else False)
                else:
                    values.append(val)
            elif isinstance(val, float):
                values.append(val)
            elif isinstance(val, Decimal):
                values.append(float(val))
            elif isinstance(val, str):
                values.append(val)
            elif isinstance(val, bytes):
                values.append(val)
            elif isinstance(val, bool):
                values.append(val)
            else:
                values.append(str(val))
        
        placeholders = ','.join(['%s'] * len(columns))
        cols_str = ','.join(columns)
        
        try:
            query = f'INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'
            cursor_pg.execute(query, values)
        except Exception as e:
            print(f'  Error en {table_name}: {e}')
            continue
    
    conn_pg.commit()
    print(f'  {table_name}: {len(rows)} registros migrados')

def main():
    print('='*50)
    print('MIGRACION SQLite -> PostgreSQL')
    print('='*50)
    
    tables_to_migrate = [
        'usuarios',
        'categorias', 
        'productos',
        'mesas',
        'pedidos',
        'configuracion',
        'timbrados',
        'facturas',
        'inventario',
        'movimientos_inventario',
    ]
    
    print('\nConectando a PostgreSQL...')
    try:
        conn_pg = psycopg.connect(**POSTGRES_CONFIG)
        conn_pg.autocommit = True
        cursor_pg = conn_pg.cursor()
        print('OK')
    except Exception as e:
        print(f'ERROR: No se pudo conectar a PostgreSQL: {e}')
        print('Asegurate de que PostgreSQL este corriendo y la base de datos exista.')
        sys.exit(1)
    
    print('\nMigrando tablas...')
    for table in tables_to_migrate:
        try:
            columns, rows = get_sqlite_data(table)
            migrate_table(table, columns, rows, cursor_pg, conn_pg)
        except Exception as e:
            print(f'  {table}: Error - {e}')
    
    cursor_pg.close()
    conn_pg.close()
    
    print('\n' + '='*50)
    print('MIGRACION COMPLETADA')
    print('='*50)

if __name__ == '__main__':
    main()