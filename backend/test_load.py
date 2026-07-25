"""
Load test: 10 concurrent threads making API calls to Supabase
"""
import requests
import threading
import time
import random
import sys

BASE = 'http://localhost:8000/api'
RESTAURANTES = ['pizzeria-juan', 'pizzeria-ana']
OK = 0
ERRORS = []
LOCK = threading.Lock()

def do_requests(thread_id):
    global OK
    slug = random.choice(RESTAURANTES)
    params = {'restaurante': slug}
    for i in range(20):
        endpoints = [
            f'{BASE}/productos',
            f'{BASE}/mesas',
            f'{BASE}/pedidos',
            f'{BASE}/pedidos/delivery/dashboard',
        ]
        ep = random.choice(endpoints)
        try:
            r = requests.get(ep, params=params, timeout=10)
            with LOCK:
                if r.status_code == 200:
                    OK += 1
                else:
                    ERRORS.append(f'#{thread_id}.{i} {ep} -> {r.status_code}')
        except Exception as e:
            with LOCK:
                ERRORS.append(f'#{thread_id}.{i} {ep} -> {e}')
        time.sleep(random.uniform(0.05, 0.3))

THREADS = 10
print(f'Lanzando {THREADS} hilos con 20 requests c/u = {THREADS*20} requests total...')
start = time.time()

threads = []
for t in range(THREADS):
    th = threading.Thread(target=do_requests, args=(t,))
    threads.append(th)
    th.start()

for th in threads:
    th.join()

elapsed = time.time() - start
print(f'\nResultados:')
print(f'  OK: {OK}/{THREADS*20}')
print(f'  Errors: {len(ERRORS)}')
if ERRORS:
    for e in ERRORS[:5]:
        print(f'    {e}')
    if len(ERRORS) > 5:
        print(f'    ... y {len(ERRORS)-5} mas')
print(f'  Tiempo: {elapsed:.1f}s')
print(f'  RPS: {OK/elapsed:.1f} req/s')

if ERRORS:
    sys.exit(1)
