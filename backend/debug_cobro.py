import requests, json

s = requests.Session()
r = s.post('http://localhost:8000/api/auth/login', json={'pin':'0000'})
s.headers['Authorization'] = 'Bearer '+r.json().get('token')

r = s.get('http://localhost:8000/api/pedidos')
data = r.json().get('pedidos') or r.json().get('data') or []
for p in data:
    estado = p.get('estado')
    if estado in ('entregado',):
        pid = p['id']
        mesa_id = p.get('mesa')
        total = int(float(p.get('total', 0)))
        print(f'Pedido id={pid} mesa={mesa_id} estado={estado} total={total}')
        
        # Try pagar single
        r2 = s.post(f'http://localhost:8000/api/pedidos/{pid}/pagar', json={
            'metodo_pago': 'tarjeta', 'propina': 0, 'monto_recibido': total
        }, timeout=10)
        print(f'  pagar: {r2.status_code}')
        try:
            print(f'    {json.dumps(r2.json(), indent=2, ensure_ascii=False)[:200]}')
        except:
            print(f'    {r2.text[:200]}')
        
        # If mesa_id, try cobrar_mesa with tarjeta
        if mesa_id and r2.status_code != 200:
            r3 = s.post(f'http://localhost:8000/api/pedidos/mesa/{mesa_id}/cobrar', json={
                'metodo_pago': 'tarjeta', 'propina': 0, 'monto_recibido': total
            }, timeout=10)
            print(f'  cobrar_mesa: {r3.status_code}')
            try:
                print(f'    {json.dumps(r3.json(), indent=2, ensure_ascii=False)[:200]}')
            except:
                print(f'    {r3.text[:200]}')
                # Print full exception
                import traceback
                traceback.print_exc()
