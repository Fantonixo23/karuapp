import sqlite3

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()

tables = c.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()

print('=== TABLAS ===')
for t in tables:
    print(f'  - {t[0]}')

print()
print('=== REGISTROS POR TABLA ===')
for t in tables:
    try:
        count = c.execute(f'SELECT COUNT(*) FROM {t[0]}').fetchone()[0]
        print(f'  {t[0]}: {count}')
    except Exception:
        pass

conn.close()