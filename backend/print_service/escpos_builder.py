ESC = b'\x1b'
GS = b'\x1d'
LF = b'\x0a'
import io
import base64
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

def init():
    return ESC + b'\x40'

def center():
    return ESC + b'\x61\x01'

def left():
    return ESC + b'\x61\x00'

def right():
    return ESC + b'\x61\x02'

def bold_on():
    return ESC + b'\x45\x01'

def bold_off():
    return ESC + b'\x45\x00'

def font_a():
    return ESC + b'\x4d\x00'

def font_b():
    return ESC + b'\x4d\x01'

def double_width_on():
    return ESC + b'\x21\x20'

def double_height_on():
    return ESC + b'\x21\x10'

def double_on():
    return ESC + b'\x21\x30'

def font_normal():
    return ESC + b'\x21\x00'

def feed(n=1):
    return b'\x0a' * n

def cut():
    return GS + b'\x56\x00'

def cut_full():
    return GS + b'\x56\x01'

def bitmap_to_escpos(img_b64, max_width=384):
    if not HAS_PIL or not img_b64:
        return b''
    try:
        buf = io.BytesIO(base64.b64decode(img_b64))
        img = Image.open(buf).convert('1')
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
        img = img.transpose(Image.ROTATE_90)
        pixels = list(img.tobytes())
        bytes_per_row = (img.width + 7) // 8
        raster_bytes = bytearray(bytes_per_row * img.height)
        i = 0
        for y in range(img.height):
            for x in range(img.width):
                if x < img.width and y < img.height:
                    bit_idx = 7 - (x % 8)
                    byte_idx = y * bytes_per_row + x // 8
                    if pixel := img.getpixel((x, y)):
                        pass
                    else:
                        raster_bytes[byte_idx] |= (1 << bit_idx)
        w_bytes = bytes_per_row
        h_dots = img.height
        cmd = GS + b'v0' + bytes([48, w_bytes & 0xFF, (w_bytes >> 8) & 0xFF, h_dots & 0xFF, (h_dots >> 8) & 0xFF])
        return cmd + bytes(raster_bytes)
    except Exception:
        return b''

def separator(c='-', n=42):
    return (c * n + '\n').encode('cp1252', errors='replace')

def text_line(txt, align='left', bold=False, double=False, font='A'):
    cmd = b''
    if align == 'center':
        cmd += center()
    elif align == 'right':
        cmd += right()
    else:
        cmd += left()
    if bold:
        cmd += bold_on()
    if double:
        cmd += double_on()
    elif font == 'B':
        cmd += font_b()
    else:
        cmd += font_a()
    cmd += (txt + '\n').encode('cp1252', errors='replace')
    if bold:
        cmd += bold_off()
    if double or font == 'B':
        cmd += font_a()
    return cmd

def build_comanda(pedido, negocio=None, size='normal', paper_width='80mm'):
    chars = get_chars_per_line(size, paper_width)
    font = get_font_for_size(size, paper_width)
    lines = []
    lines.append(init())
    lines.append(center())
    lines.append(double_on())
    lines.append(b'--- COMANDA ---\n')
    lines.append(font_normal())
    lines.append(('#' + str(pedido.get('numero_orden', '')).zfill(4) + '\n').encode('cp1252', errors='replace'))
    lines.append(left())
    lines.append(font_b() if font == 'B' else font_a())

    lines.append(separator('-', chars))

    fecha_creacion = pedido.get('created_at', '')
    if fecha_creacion:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(fecha_creacion.replace('Z', '+00:00'))
            fecha_str = dt.strftime('%d/%m/%Y %H:%M')
        except (ValueError, TypeError):
            fecha_str = fecha_creacion[:16]
    else:
        fecha_str = ''
    if fecha_str:
        lines.append(('Fecha: ' + fecha_str + '\n').encode('cp1252', errors='replace'))

    mesa = pedido.get('mesa')
    if mesa:
        lines.append(('Mesa: ' + str(mesa) + '\n').encode('cp1252', errors='replace'))

    tipo = pedido.get('tipo_pedido', '')
    nombre_cliente = pedido.get('nombre_cliente', '')
    if tipo == 'venta':
        txt = 'VENTA'
        if nombre_cliente:
            txt += ' - ' + nombre_cliente
        lines.append((txt + '\n').encode('cp1252', errors='replace'))
    elif tipo == 'delivery':
        txt = 'DELIVERY'
        if nombre_cliente:
            txt += ' - ' + nombre_cliente
        lines.append((txt + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    items = pedido.get('items', [])
    # Group by category
    grupos = {}
    for item in items:
        cat = item.get('categoria_nombre') or 'Otros'
        if cat not in grupos:
            grupos[cat] = []
        grupos[cat].append(item)

    for cat, cat_items in grupos.items():
        lines.append(('[' + cat.upper() + ']\n').encode('cp1252', errors='replace'))
        for item in cat_items:
            cant = item.get('cantidad', 1)
            nombre = item.get('producto_nombre') or item.get('nombre') or item.get('producto', '')
            variante = item.get('variante', '')
            nota = item.get('nota', '')
            line_txt = str(cant) + 'x ' + nombre
            if len(line_txt) > chars:
                line_txt = line_txt[:chars]
            lines.append((line_txt + '\n').encode('cp1252', errors='replace'))
            if variante:
                lines.append(('  + ' + variante + '\n').encode('cp1252', errors='replace'))
            if nota:
                lines.append(('  >> ' + nota + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))
    lines.append(center())
    lines.append(b'Pedido recibido\n')
    lines.append(center())
    lines.append(b'Gracias por su preferencia!\n')
    lines.append(feed(3))
    lines.append(cut())

    return b''.join(lines)


def build_cuenta(pedidos, negocio=None, size='normal', mesa='', mesero_nombre='', paper_width='80mm'):
    chars = get_chars_per_line(size, paper_width)
    font = get_font_for_size(size, paper_width)
    lines = []
    lines.append(init())

    lines.append(center())
    lines.append(double_on())
    lines.append((negocio.get('nombre', 'RESTAURANTE') + '\n').encode('cp1252', errors='replace') if negocio else b'RESTAURANTE\n')
    lines.append(font_normal())
    lines.append(left())
    lines.append(font_b() if font == 'B' else font_a())

    if negocio and negocio.get('ruc'):
        lines.append(('RUC: ' + negocio['ruc'] + '\n').encode('cp1252', errors='replace'))

    lines.append(center())
    lines.append(b'*** CUENTA ***\n')
    lines.append(left())
    lines.append(separator('-', chars))

    primer_pedido = pedidos[0] if pedidos else {}
    fecha = primer_pedido.get('created_at', '')
    if fecha:
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(fecha.replace('Z', '+00:00'))
            fecha = dt.strftime('%d/%m/%Y %H:%M')
        except (ValueError, TypeError):
            fecha = fecha[:16]
    else:
        fecha = ''

    info_line = ''
    if mesa:
        info_line += 'Mesa: ' + str(mesa)
    if mesero_nombre:
        if info_line:
            info_line += '  |  '
        info_line += 'Mozo: ' + mesero_nombre
    if fecha:
        if info_line:
            info_line += '  |  '
        info_line += fecha
    lines.append((info_line + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    items = []
    for pedido in pedidos:
        for item in pedido.get('items', []):
            items.append(item)

    grupos = {}
    for item in items:
        key = (item.get('producto_nombre') or item.get('producto', '')) + '|' + (item.get('variante', '') or '')
        if key in grupos:
            grupos[key]['cantidad'] += item.get('cantidad', 1)
            if item.get('nota') and item['nota'] not in grupos[key]['notas']:
                grupos[key]['notas'].append(item['nota'])
        else:
            grupos[key] = {
                'cantidad': item.get('cantidad', 1),
                'nombre': item.get('producto_nombre') or item.get('producto', ''),
                'precio': item.get('precio', 0),
                'variante': item.get('variante', ''),
                'notas': [item.get('nota', '')] if item.get('nota') else [],
            }

    subtotal = 0
    for g in grupos.values():
        line_total = g['cantidad'] * float(g['precio'])
        subtotal += line_total
        name = g['nombre']
        if len(name) > chars - 10:
            name = name[:chars - 10]
        line_txt = str(g['cantidad']) + 'x ' + name.ljust(chars - 8) + str(int(line_total)).rjust(8)
        lines.append((line_txt + '\n').encode('cp1252', errors='replace'))
        if g['variante']:
            lines.append(('  + ' + g['variante'] + '\n').encode('cp1252', errors='replace'))
        for n in g['notas']:
            if n:
                lines.append(('  >> ' + n + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    iva10 = subtotal * 0.10
    iva5 = subtotal * 0.05

    lines.append(right())
    lines.append(('Subtotal: ' + str(int(subtotal)).rjust(8) + '\n').encode('cp1252', errors='replace'))
    lines.append(('IVA 10%:   ' + str(int(iva10)).rjust(8) + '\n').encode('cp1252', errors='replace'))
    lines.append(('IVA 5%:    ' + str(int(iva5)).rjust(8) + '\n').encode('cp1252', errors='replace'))
    lines.append(separator('-', chars))
    lines.append(bold_on())
    lines.append(('TOTAL Gs:  ' + str(int(subtotal + iva10 + iva5)).rjust(8) + '\n').encode('cp1252', errors='replace'))
    lines.append(bold_off())
    lines.append(left())

    lines.append(separator('-', chars))
    lines.append(feed(3))
    lines.append(cut())

    return b''.join(lines)

def calcular_iva(items):
    subtotal = 0
    iva10 = 0
    iva5 = 0
    for item in items:
        cant = item.get('cantidad', 1)
        precio = float(item.get('precio', 0))
        total_item = cant * precio
        subtotal += total_item
        tipo_iva = item.get('iva', 10)
        if tipo_iva == 5:
            iva5 += total_item * 0.05
        else:
            iva10 += total_item * 0.10
    return subtotal, iva10, iva5

def build_factura(pedido, negocio=None, cliente=None, size='normal', qr_base64=None, paper_width='80mm'):
    chars = get_chars_per_line(size, paper_width)
    font = get_font_for_size(size, paper_width)
    lines = []
    lines.append(init())

    cdc = pedido.get('cdc', '') or ''
    kude = pedido.get('kude', '') or ''
    es_fiscal = bool(cdc)
    use_font_b = font == 'B'
    p9 = 9
    desc_max = chars - 5 - 10 - 2

    # ===== HEADER =====
    lines.append(center())
    lines.append(double_on())
    nombre_emp = (negocio or {}).get('nombre', 'RESTAURANTE')
    lines.append((nombre_emp + '\n').encode('cp1252', errors='replace'))
    lines.append(font_normal())
    lines.append(left())
    lines.append(font_b() if use_font_b else font_a())

    lines.append(('RUC: ' + ((negocio or {}).get('ruc', '-') or '-') + '\n').encode('cp1252', errors='replace'))
    lines.append((((negocio or {}).get('direccion', '-') or '-') + '\n').encode('cp1252', errors='replace'))
    lines.append(('Tel: ' + ((negocio or {}).get('telefono', '-') or '-') + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    # ===== TITLE =====
    lines.append(center())
    lines.append(bold_on())
    lines.append(b'DOCUMENTO TRIBUTARIO\n' if es_fiscal else b'TICKET DE CAJA\n')
    lines.append(bold_off())

    if es_fiscal:
        timbrado = (negocio or {}).get('timbrado_numero') or (negocio or {}).get('timbrado', '-')
        lines.append(('Timbrado Nro: ' + str(timbrado) + '\n').encode('cp1252', errors='replace'))

    num = str(pedido.get('numero_factura') or pedido.get('numero_orden', '1'))
    if es_fiscal:
        lines.append(('FACTURA Nro: ' + num.zfill(7) + '\n').encode('cp1252', errors='replace'))
    else:
        lines.append(('Nro: ' + num.zfill(4) + '\n').encode('cp1252', errors='replace'))

    fecha = pedido.get('fecha', '')
    if not fecha:
        from datetime import datetime
        fecha = datetime.now().isoformat()
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(str(fecha).replace('Z', '+00:00'))
        fecha_str = dt.strftime('%d/%m/%Y %H:%M')
    except Exception:
        fecha_str = str(fecha)[:16]
    lines.append(('Fecha: ' + fecha_str + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    # ===== MESA =====
    mesa = pedido.get('mesa', '')
    if mesa:
        lines.append(('Mesa: ' + str(mesa) + '\n').encode('cp1252', errors='replace'))
        lines.append(separator('-', chars))

    # ===== CLIENTE =====
    lines.append(bold_on())
    lines.append(b'CLIENTE:\n')
    lines.append(bold_off())
    lines.append(('Razon Social: ' + ((cliente or {}).get('nombre', 'CONSUMIDOR FINAL') or 'CONSUMIDOR FINAL') + '\n').encode('cp1252', errors='replace'))
    lines.append(('RUC: ' + ((cliente or {}).get('ruc', '44444444-7') or '44444444-7') + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    # ===== ITEMS =====
    items = pedido.get('items', [])
    lines.append(bold_on())
    lines.append(('Cant'.ljust(5) + 'Descripcion'.ljust(desc_max) + 'Total'.rjust(10) + '\n').encode('cp1252', errors='replace'))
    lines.append(bold_off())
    lines.append(separator('-', chars))

    for item in items:
        cant = item.get('cantidad', 1)
        nombre = item.get('producto_nombre') or item.get('nombre') or item.get('producto', '')
        total_item = cant * float(item.get('precio', 0))
        lines.append((str(int(cant)).ljust(5) + nombre[:desc_max].ljust(desc_max) + format_guarani(total_item).rjust(10) + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    # ===== IVA =====
    subtotal, iva10, iva5 = calcular_iva(items)

    lines.append(right())
    lines.append(('Subtotal:'.ljust(chars - p9) + format_guarani(int(subtotal)).rjust(p9) + '\n').encode('cp1252', errors='replace'))
    lines.append(('IVA 10%:'.ljust(chars - p9) + format_guarani(int(iva10)).rjust(p9) + '\n').encode('cp1252', errors='replace'))
    if iva5 > 0:
        lines.append(('IVA 5%:'.ljust(chars - p9) + format_guarani(int(iva5)).rjust(p9) + '\n').encode('cp1252', errors='replace'))
    lines.append(separator('-', chars))

    total_linea = pedido.get('total', subtotal)
    lines.append(bold_on())
    lines.append(('TOTAL Gs.:'.ljust(chars - p9) + format_guarani(int(total_linea)).rjust(p9) + '\n').encode('cp1252', errors='replace'))
    lines.append(bold_off())
    lines.append(left())

    # ===== PAYMENT METHODS =====
    detalle_pagos = pedido.get('detalle_pagos', [])
    if detalle_pagos:
        lines.append(separator('-', chars))
        lines.append(center())
        lines.append(bold_on())
        lines.append(b'FORMA DE PAGO\n')
        lines.append(bold_off())
        lines.append(left())
        for pago in detalle_pagos:
            metodo = pago.get('metodo', '')
            moneda = pago.get('moneda', '')
            monto = float(pago.get('monto_pyg', 0))
            lines.append((f'{metodo} ({moneda}):'.ljust(chars - p9) + format_guarani(int(monto)).rjust(p9) + '\n').encode('cp1252', errors='replace'))

    # ===== PROPINA / RECIBIDO / VUELTO =====
    propina = float(pedido.get('propina', 0))
    monto_recibido = float(pedido.get('monto_recibido', 0))
    vuelto = float(pedido.get('vuelto', 0))

    if propina > 0:
        lines.append(('Propina:'.ljust(chars - p9) + format_guarani(int(propina)).rjust(p9) + '\n').encode('cp1252', errors='replace'))
    if monto_recibido > 0:
        lines.append(('Recibido:'.ljust(chars - p9) + format_guarani(int(monto_recibido)).rjust(p9) + '\n').encode('cp1252', errors='replace'))
        lines.append(('Vuelto:'.ljust(chars - p9) + format_guarani(int(vuelto)).rjust(p9) + '\n').encode('cp1252', errors='replace'))

    lines.append(separator('-', chars))

    # ===== CDC + KUDE =====
    if cdc:
        lines.append(center())
        lines.append(bold_on())
        lines.append(b'CDC:\n')
        lines.append(bold_off())
        lines.append(font_b())
        lines.append((cdc + '\n').encode('cp1252', errors='replace'))
        if kude:
            lines.append(b'KUDE:\n')
            lines.append((kude + '\n').encode('cp1252', errors='replace'))
        lines.append(font_a())
        lines.append(left())
        lines.append(separator('-', chars))

    # ===== QR =====
    if qr_base64:
        qr_data = bitmap_to_escpos(qr_base64, max_width=chars * 5)
        if qr_data:
            lines.append(center())
            lines.append(qr_data)
            lines.append(left())
            lines.append(b'\n')
            lines.append(center())
            lines.append(b'Escanee el QR para verificar\n')
            lines.append(left())

    # ===== FOOTER =====
    if es_fiscal:
        lines.append(center())
        lines.append(bold_on())
        lines.append(b'Documento Electronico\n')
        lines.append(bold_off())
        lines.append(b'SIFEN - SET Paraguay\n')
        lines.append(b'Consulte en: www.set.gov.py\n')
        lines.append(b'Este comprobante puede ser verificado\n')
        lines.append(b'utilizando el visor de la SET\n')

    lines.append(bold_on())
    lines.append(b'Gracias por su preferencia!\n')
    lines.append(bold_off())
    lines.append(feed(3))
    lines.append(cut())

    return b''.join(lines)

def build_test_page(nombre_impresora, size='normal', paper_width='80mm'):
    chars = get_chars_per_line(size, paper_width)
    lines = []
    lines.append(init())
    lines.append(center())
    lines.append(double_on())
    lines.append(b'=== PRUEBA DE IMPRESION ===\n')
    lines.append(font_normal())
    lines.append(left())

    lines.append(separator('=', chars))
    lines.append(('Impresora: ' + nombre_impresora + '\n').encode('cp1252', errors='replace'))
    lines.append(('Tamano: ' + size + '\n').encode('cp1252', errors='replace'))
    lines.append(('Caracteres/linea: ' + str(chars) + '\n').encode('cp1252', errors='replace'))
    lines.append(separator('-', chars))

    lines.append(b'Texto Normal\n')
    lines.append(bold_on())
    lines.append(b'Texto en Negrita\n')
    lines.append(bold_off())
    lines.append(double_on())
    lines.append(b'TEXTO GRANDE\n')
    lines.append(font_normal())

    lines.append(font_b())
    lines.append(b'Texto condensado (Font B)\n')
    lines.append(font_a())

    lines.append(center())
    lines.append(b'--- Centrado ---\n')
    lines.append(right())
    lines.append(b'--- Derecha ---\n')
    lines.append(left())

    lines.append(separator('=', chars))
    lines.append(center())
    lines.append(b'Si lee esto, la impresora funciona!\n')
    lines.append(feed(4))
    lines.append(cut())

    return b''.join(lines)

def format_guarani(n):
    try:
        num = int(float(n))
        return f'{num:,}'.replace(',', '.')
    except (ValueError, TypeError):
        return str(n)

def get_chars_per_line(size, paper_width='80mm'):
    widths = {
        '58mm': {'pequeno': 42, 'normal': 32, 'grande': 16},
        '80mm': {'pequeno': 64, 'normal': 48, 'grande': 24},
    }
    pw = widths.get(paper_width, widths['80mm'])
    if isinstance(size, dict):
        return size.get('custom_width', pw['normal'])
    return pw.get(size, pw['normal'])


def get_font_for_size(size, paper_width='80mm'):
    widths = {
        '58mm': {'pequeno': 'B', 'normal': 'A', 'grande': 'A'},
        '80mm': {'pequeno': 'B', 'normal': 'A', 'grande': 'A'},
    }
    pw = widths.get(paper_width, widths['80mm'])
    return pw.get(size, 'A')

