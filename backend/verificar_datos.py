import psycopg

conn = psycopg.connect(host='127.0.0.1', port='5432', user='postgres', password='Kinflid1289', dbname='pipperfood')
conn.autocommit = True
cur = conn.cursor()

print('=== DATOS EN POSTGRESQL ===')
print()

tables = ['usuarios', 'categorias', 'productos', 'mesas', 'pedidos', 'configuracion']
for table in tables:
    cur.execute(f'SELECT COUNT(*) FROM {table}')
    count = cur.fetchone()[0]
    print(f'{table}: {count} registros')

print()
print('=== MUESTRA: productos (3 primeros) ===')
cur.execute('SELECT id, nombre, precio, disponible FROM productos LIMIT 3')
for row in cur.fetchall():
    print(f'  {row}')

print()
print('=== MUESTRA: usuarios ===')
cur.execute('SELECT id, nombre, pin, rol, activo FROM usuarios')
for row in cur.fetchall():
    print(f'  {row}')

conn.close()