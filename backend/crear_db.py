import psycopg

conn = psycopg.connect(host='127.0.0.1', port='5432', user='postgres', password='Kinflid1289', dbname='postgres')
conn.autocommit = True
cur = conn.cursor()

cur.execute("DROP DATABASE IF EXISTS pipperfood")
print("Base de datos existente eliminada")

cur.execute("CREATE DATABASE pipperfood WITH ENCODING 'UTF8'")
print("Base de datos pipperfood creada con UTF-8")

conn.commit()
conn.close()
print("Listo!")