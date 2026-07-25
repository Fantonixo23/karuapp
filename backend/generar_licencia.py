# Script para generar licencias karuAPP
# Usage: python generar_licencia.py [CODIGO_CLIENTE] [DIAS]

import os
import sys
from datetime import date, timedelta


def generar_licencia(codigo_cliente, dias=30):
    base_dir = os.path.dirname(os.path.dirname(__file__))
    licencia_path = os.path.join(base_dir, 'licencia.dat')
    
    fecha_venc = date.today() + timedelta(days=dias)
    
    licencia_contenido = f"""# Licencia karuAPP - NO MODIFICAR
# Cliente: {codigo_cliente}
CODIGO_CLIENTE={codigo_cliente}
FECHA_VENCIMIENTO={fecha_venc.strftime('%Y-%m-%d')}
DIAS_GRACIA=3
CODIGO_ACTIVACION={codigo_cliente.upper()}-PF
ACTIVADA=false
GENERADO={date.today().strftime('%Y-%m-%d')}
"""
    
    with open(licencia_path, 'w') as f:
        f.write(licencia_contenido)
    
    print(f"Licencia creada para: {codigo_cliente}")
    print(f"Fecha vencimiento: {fecha_venc}")
    print(f"Días de gracia: 3")
    print(f"Código activación: {codigo_cliente.upper()}-PF")
    print(f"\nArchivo: {licencia_path}")


def activar_licencia():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    licencia_path = os.path.join(base_dir, 'licencia.dat')
    
    if not os.path.exists(licencia_path):
        print("ERROR: Archivo de licencia no existe")
        return
    
    with open(licencia_path, 'r') as f:
        contenido = f.read()
    
    contenido = contenido.replace('ACTIVADA=false', 'ACTIVADA=true')
    
    with open(licencia_path, 'w') as f:
        f.write(contenido)
    
    print("Licencia activada correctamente!")


def mostrar_info():
    base_dir = os.path.dirname(os.path.dirname(__file__))
    licencia_path = os.path.join(base_dir, 'licencia.dat')
    
    if not os.path.exists(licencia_path):
        print("Sin licencia - Modo demo")
        return
    
    with open(licencia_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                print(line)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("=== Generador de Licencias karuAPP ===")
        print("")
        print("Uso:")
        print("  python generar_licencia.py generar [CODIGO_CLIENTE] [DIAS]")
        print("  python generar_licencia.py activar")
        print("  python generar_licencia.py info")
        print("")
        print("Ejemplos:")
        print("  python generar_licencia.py generar manuelcafe 30")
        print("  python generar_licencia.py activar")
        print("  python generar_licencia.py info")
        sys.exit(1)
    
    comando = sys.argv[1].lower()
    
    if comando == 'generar':
        codigo = sys.argv[2] if len(sys.argv) > 2 else 'CLIENTE'
        dias = int(sys.argv[3]) if len(sys.argv) > 3 else 30
        generar_licencia(codigo, dias)
    elif comando == 'activar':
        activar_licencia()
    elif comando == 'info':
        mostrar_info()
    else:
        print(f"Comando desconocido: {comando}")