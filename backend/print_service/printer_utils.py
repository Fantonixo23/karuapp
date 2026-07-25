try:
    import win32print
    HAS_WIN32PRINT = True
except ImportError:
    HAS_WIN32PRINT = False

PRINTER_TYPES = ['yp', 'yichi', 'thermal', 'pos', 'receipt', 'ticket', 'bematech', 'daruma', 'elgin', 'ftx', 'tdr', '58mm', '80mm']

def listar_impresoras():
    if not HAS_WIN32PRINT:
        return []
    impresoras = []
    for name in win32print.EnumPrinters(2):
        nombre = name[2]
        es_termica = any(marca in nombre.lower() for marca in PRINTER_TYPES)
        impresoras.append({
            'nombre': nombre,
            'termica': es_termica
        })
    return impresoras

def detectar_impresora_termica():
    for p in listar_impresoras():
        if p['termica']:
            return p['nombre']
    impresoras = listar_impresoras()
    if impresoras:
        return impresoras[0]['nombre']
    return None

def imprimir_texto(nombre_impresora, texto):
    if not HAS_WIN32PRINT:
        raise Exception('pywin32 no instalado. No es posible imprimir en este sistema.')
    if not nombre_impresora:
        raise Exception('No se especificó ninguna impresora.')
    try:
        handle = win32print.OpenPrinter(nombre_impresora)
    except Exception as e:
        raise Exception(f'No se pudo abrir la impresora "{nombre_impresora}": {e}')
    try:
        win32print.StartDocPrinter(handle, 1, ("Ticket", None, "RAW"))
        win32print.StartPagePrinter(handle)
        if isinstance(texto, str):
            datos = texto.encode('cp1252', errors='replace')
        else:
            datos = texto
        win32print.WritePrinter(handle, datos)
        win32print.EndPagePrinter(handle)
        win32print.EndDocPrinter(handle)
        return True
    except Exception as e:
        raise Exception(f'Error al imprimir en "{nombre_impresora}": {e}')
    finally:
        try:
            win32print.ClosePrinter(handle)
        except Exception:
            pass
