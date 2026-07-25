with open('apps/facturacion/views.py', 'r', encoding='utf-8') as f:
    content = f.read()

le = '\n' if '\r\n' not in content else '\r\n'

content = content.replace(
    'from .models import Configuracion, Timbrado, Factura, MetodoPago',
    'from apps.usuarios.decorators import requiere_autenticacion, requiere_rol' + le + 'from .models import Configuracion, Timbrado, Factura, MetodoPago'
)

pairs = [
    ('@csrf_exempt' + le + '@require_http_methods(["PUT"])' + le + 'def update_config(request):',
     '@csrf_exempt' + le + '@require_http_methods(["PUT"])' + le + "@requiere_rol('administrador')" + le + 'def update_config(request):'),
    ('@require_http_methods(["GET"])' + le + 'def lista_timbrados(request):',
     '@require_http_methods(["GET"])' + le + '@requiere_autenticacion' + le + 'def lista_timbrados(request):'),
    ('@csrf_exempt' + le + '@require_http_methods(["POST"])' + le + 'def crear_timbrado(request):',
     '@csrf_exempt' + le + '@require_http_methods(["POST"])' + le + "@requiere_rol('administrador')" + le + 'def crear_timbrado(request):'),
    ('@csrf_exempt' + le + '@require_http_methods(["POST"])' + le + 'def generar_factura(request):',
     '@csrf_exempt' + le + '@require_http_methods(["POST"])' + le + '@requiere_autenticacion' + le + 'def generar_factura(request):'),
    ('@require_http_methods(["GET"])' + le + 'def lista_facturas(request):',
     '@require_http_methods(["GET"])' + le + '@requiere_autenticacion' + le + 'def lista_facturas(request):'),
    ('@csrf_exempt' + le + '@require_http_methods(["POST"])' + le + 'def crear_metodo_pago(request):',
     '@csrf_exempt' + le + '@require_http_methods(["POST"])' + le + "@requiere_rol('administrador')" + le + 'def crear_metodo_pago(request):'),
    ('@csrf_exempt' + le + '@require_http_methods(["PUT"])' + le + 'def actualizar_metodo_pago(request, pk):',
     '@csrf_exempt' + le + '@require_http_methods(["PUT"])' + le + "@requiere_rol('administrador')" + le + 'def actualizar_metodo_pago(request, pk):'),
    ('@csrf_exempt' + le + '@require_http_methods(["DELETE"])' + le + 'def eliminar_metodo_pago(request, pk):',
     '@csrf_exempt' + le + '@require_http_methods(["DELETE"])' + le + "@requiere_rol('administrador')" + le + 'def eliminar_metodo_pago(request, pk):'),
    ('@csrf_exempt' + le + '@require_http_methods(["GET"])' + le + 'def buscar_cliente_ruc(request):',
     '@csrf_exempt' + le + '@require_http_methods(["GET"])' + le + '@requiere_autenticacion' + le + 'def buscar_cliente_ruc(request):'),
]

for old, new in pairs:
    if old in content:
        content = content.replace(old, new)
        print(f'OK: {new.split(le)[-1]}')
    else:
        print(f'MISS: {old.split(le)[-1]}')

with open('apps/facturacion/views.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f'\nTotal lines: {len(content.splitlines())}')
print('All done' if 'requiere_autenticacion' in content else 'ERROR')
