import psycopg

conn = psycopg.connect(host='127.0.0.1', port='5432', user='postgres', password='Kinflid1289', dbname='pipperfood')
conn.autocommit = True
cur = conn.cursor()

print("=== DATOS EN POSTGRESQL ===")
cur.execute("SELECT COUNT(*) FROM mesas")
print(f"MESAS: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM productos")
print(f"PRODUCTOS: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM usuarios")
print(f"USUARIOS: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM categorias")
print(f"CATEGORIAS: {cur.fetchone()[0]}")

print("\n=== PRIMERA MESA ===")
cur.execute("SELECT * FROM mesas LIMIT 1")
for row in cur.fetchall():
    print(row)

conn.close()