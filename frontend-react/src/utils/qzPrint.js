const API_URL = window.location.origin + '/api'

let _tokenCache = null

function _getPrintServer(tipo) {
  if (tipo === 'cocina') {
    return localStorage.getItem('pipper_print_server_cocina') || 'http://localhost:5123'
  }
  return localStorage.getItem('pipper_print_server_caja') || 'http://localhost:5123'
}

function _getPrinterName(tipo) {
  if (tipo === 'cocina') {
    return localStorage.getItem('pipper_printer_cocina') || localStorage.getItem('pipper_printer_name') || localStorage.getItem('qz_printer_name') || ''
  }
  return localStorage.getItem('pipper_printer_caja') || localStorage.getItem('pipper_printer_name') || localStorage.getItem('qz_printer_name') || ''
}

async function _getToken() {
  if (_tokenCache) return _tokenCache
  try {
    const res = await fetch(API_URL + '/print-token')
    const data = await res.json()
    if (data.success) _tokenCache = data.token
  } catch {}
  return _tokenCache || 'pipper-print-token-default'
}

function _stringToBase64(str) {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i)
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function _sendRaw(data, printerName, serverUrl) {
  const token = await _getToken()
  const body = { data: _stringToBase64(data) }
  if (printerName) {
    body.impresora = printerName
  }
  const res = await fetch(serverUrl + '/print/raw', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error || 'Error al imprimir')
}

const ESC = '\x1B'
const GS = '\x1D'

const CMD = {
  INIT: ESC + '@',
  LF: '\x0A',
  CENTER: ESC + 'a' + '\x01',
  LEFT: ESC + 'a' + '\x00',
  RIGHT: ESC + 'a' + '\x02',
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  FONT_NORMAL: GS + '!' + '\x00',
  FONT_DOUBLE: GS + '!' + '\x11',
  CUT_FULL: GS + 'V' + '\x00',
  CUT_PARTIAL: GS + 'V' + '\x01',
  DRAWER: ESC + 'p' + '\x00' + '\x19' + '\xFA',
  DOUBLE_ON: GS + '!' + '\x11',
  DOUBLE_OFF: GS + '!' + '\x00',
}

function _line(text = '') {
  return text + CMD.LF
}

function _center(text) {
  return CMD.CENTER + text + CMD.LF
}

function _left(text) {
  return CMD.LEFT + text + CMD.LF
}

function _bold(text) {
  return CMD.BOLD_ON + text + CMD.BOLD_OFF + CMD.LF
}

function _boldCenter(text) {
  return CMD.CENTER + CMD.BOLD_ON + text + CMD.BOLD_OFF + CMD.LF
}

function _right(text) {
  return CMD.RIGHT + text + CMD.LF
}

function _getPaperWidth() {
  const ps = localStorage.getItem('pipper_paper_size') || '58mm'
  return ps === '80mm' ? 48 : 32
}

function _divider(char = '-') {
  return char.repeat(_getPaperWidth()) + CMD.LF
}

function _spacer(lines = 1) {
  return CMD.LF.repeat(lines)
}

function _row(leftText, rightText, width) {
  if (!width) width = _getPaperWidth()
  const dots = width - leftText.length - rightText.length
  const padding = dots > 0 ? ' '.repeat(dots) : ' '
  return _left(leftText + padding + rightText)
}

function _formatGuarani(val) {
  const num = Math.round(val || 0)
  return num.toLocaleString('es-PY') + ' Gs'
}

function _formatDate(date) {
  if (!date) return new Date().toLocaleString('es-PY', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  return new Date(date).toLocaleString('es-PY', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function _formatTime(date) {
  if (!date) return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function _sanitize(text) {
  if (!text) return ''
  return text
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'N')
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/Á/g, 'A')
    .replace(/É/g, 'E')
    .replace(/Í/g, 'I')
    .replace(/Ó/g, 'O')
    .replace(/Ú/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
}

function _getWidth() {
  return _getPaperWidth()
}

function buildTicketFactura(pedido, negocio, cliente, numero) {
  const items = pedido?.items || []
  const numeroFactura = numero || pedido?.numero_orden || '001'
  const tipoIva = pedido?.tipo_iva !== undefined ? Number(pedido.tipo_iva) : 10
  const total = Number(pedido?.total || 0)
  const propina = Number(pedido?.propina || 0)
  const ivaMonto = tipoIva === 0 ? 0 : Math.round(total * tipoIva / (100 + tipoIva))
  const subtotalSinIva = total - ivaMonto
  const width = _getWidth()
  let data = ''

  data += CMD.INIT
  data += _center(CMD.DOUBLE_ON + _sanitize(negocio?.nombre || 'RESTAURANTE') + CMD.DOUBLE_OFF)
  if (negocio?.ruc) data += _center('RUC: ' + _sanitize(negocio.ruc))
  if (negocio?.direccion) data += _center(_sanitize(negocio.direccion))
  if (negocio?.telefono) data += _center('Tel: ' + _sanitize(negocio.telefono))
  data += _divider()

  data += _boldCenter('TICKET DE CAJA')
  data += _center('N: ' + String(numeroFactura).padStart(4, '0'))
  data += _center('Fecha: ' + _formatDate(pedido?.fecha))
  data += _divider()

  const esDelivery = pedido?.delivery || pedido?.tipo_pedido === 'delivery'
  if (esDelivery) {
    data += _row('Mesa:', 'Delivery')
    if (pedido?.nombre_cliente || cliente?.nombre) data += _row('Cliente:', _sanitize(pedido?.nombre_cliente || cliente?.nombre || ''))
    if (pedido?.telefono_cliente || cliente?.telefono) data += _row('Tel:', pedido?.telefono_cliente || cliente?.telefono || '')
    if (pedido?.direccion || cliente?.direccion) data += _row('Direccion:', _sanitize(pedido?.direccion || cliente?.direccion || ''))
  } else if (pedido?.mesa) {
    data += _row('Mesa:', String(pedido.mesa))
  }

  data += _left('CLIENTE:')
  data += _row('Razon Social:', _sanitize(cliente?.nombre || 'CONSUMIDOR FINAL'))
  data += _row('RUC:', cliente?.ruc || '44444444-7')
  data += _divider()

  if (items.length > 0) {
    const colQty = 5
    const colPrice = 10
    const colDesc = width - colQty - colPrice
    data += _left('Cant'.padEnd(colQty) + 'Descripcion'.padEnd(colDesc) + 'Total'.padStart(colPrice))
    data += _divider('-')

    items.forEach(item => {
      const nombre = _sanitize(item.producto_nombre || item.nombre || item.producto)
      const itemTotal = item.cantidad * Number(item.precio)
      const cantStr = String(item.cantidad) + 'x'
      const descMax = colDesc - 2
      const nombreTrunc = nombre.length > descMax ? nombre.slice(0, descMax - 1) + '…' : nombre
      data += _left(cantStr.padEnd(colQty) + nombreTrunc.padEnd(colDesc) + _formatGuarani(itemTotal).padStart(colPrice))
    })
    data += _divider()
  }

  data += _row('Subtotal sin IVA:', _formatGuarani(subtotalSinIva))
  if (tipoIva > 0) {
    data += _row('IVA ' + tipoIva + '%:', _formatGuarani(ivaMonto))
  }
  if (propina > 0) {
    data += _row('Propina:', _formatGuarani(propina))
  }
  data += _divider()
  data += CMD.LEFT + CMD.BOLD_ON + 'TOTAL Gs:'.padEnd(width - 10 - CMD.LEFT.length) + _formatGuarani(total + propina) + CMD.BOLD_OFF + CMD.LF

  if (pedido?.metodo_pago) {
    const metodoLabels = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia', qr: 'QR', mixto: 'Mixto' }
    data += _row('Pago:', metodoLabels[pedido.metodo_pago] || pedido.metodo_pago)
    if (pedido?.monto_recibido > 0) data += _row('Recibido:', _formatGuarani(pedido.monto_recibido))
    if (pedido?.vuelto > 0) data += _bold('VUELTO: ' + _formatGuarani(pedido.vuelto))
  }

  if (pedido?.qr_base64) {
    data += _divider()
    data += _boldCenter('FACTURA ELECTRONICA')
    if (pedido?.cdc) data += _left('CDC:')
    if (pedido?.cdc) data += _left(_sanitize(pedido.cdc))
    if (pedido?.kude) data += _left('KUDE:')
    if (pedido?.kude) data += _left(_sanitize(pedido.kude))
  }

  if (pedido?.sifen_error) {
    data += _divider()
    data += _bold('ERROR SIFEN:')
    data += _left(_sanitize(pedido.sifen_error))
  }

  data += _spacer(1)
  data += _center('Gracias por su preferencia!')
  data += _spacer(2)
  data += CMD.CUT_FULL
  data += CMD.DRAWER

  return data
}

function buildComanda(pedido) {
  const items = pedido?.items || []
  const mergedItems = (() => {
    const map = {}
    items.forEach(item => {
      const key = (item.producto_nombre || item.producto || '') + '|' + (item.variante || '')
      if (map[key]) {
        map[key].cantidad += item.cantidad
        if (item.nota && map[key].notas.indexOf(item.nota) === -1) {
          map[key].notas.push(item.nota)
        }
      } else {
        map[key] = {
          cantidad: item.cantidad,
          nombre: item.producto_nombre || item.producto,
          variante: item.variante,
          categoria_nombre: item.categoria_nombre,
          notas: item.nota ? [item.nota] : [],
        }
      }
    })
    return Object.values(map)
  })()

  const grupos = {}
  mergedItems.forEach(item => {
    const cat = item.categoria_nombre || 'PRODUCTOS'
    if (!grupos[cat]) grupos[cat] = []
    grupos[cat].push(item)
  })

  const totalItems = mergedItems.reduce((sum, i) => sum + i.cantidad, 0)

  let data = ''
  data += CMD.INIT

  data += _boldCenter('COMANDA')
  data += _center('Pedido de Cocina')
  data += _boldCenter('#' + (pedido?.numero_orden || '001'))
  data += _center(_formatDate(pedido?.created_at) + ' - ' + _formatTime(pedido?.created_at))
  data += _divider()

  if (pedido?.tipo_pedido === 'delivery') {
    data += _row('TIPO:', 'DELIVERY')
    if (pedido?.nombre_cliente) data += _row('CLIENTE:', _sanitize(pedido.nombre_cliente))
    if (pedido?.telefono_cliente) data += _row('TEL:', pedido.telefono_cliente)
    if (pedido?.direccion) data += _row('DIR:', _sanitize(pedido.direccion))
  } else if (pedido?.tipo_pedido === 'venta') {
    data += _row('TIPO:', 'VENTA')
  } else {
    data += _row('MESA:', String(pedido?.mesa || '?'))
  }
  if (pedido?.mesero_nombre) data += _row('MOZO:', _sanitize(pedido.mesero_nombre))
  data += _row('ITEMS:', String(totalItems))
  data += _divider()

  const tiempoMin = pedido?.created_at ? Math.floor((Date.now() - new Date(pedido.created_at).getTime()) / 60000) : 0
  if (tiempoMin >= 30) {
    data += _boldCenter('*** URGENTE ***')
    data += CMD.LF
  }

  const todasNotas = [...(pedido?.notas ? [pedido.notas] : []), ...mergedItems.filter(i => i.notas.length > 0).flatMap(i => i.notas)]
  const notasUnicas = [...new Set(todasNotas.map(n => _sanitize(n)))]
  if (notasUnicas.length > 0) {
    data += _bold('NOTAS:')
    notasUnicas.forEach(n => {
      data += _left('>> ' + n)
    })
    data += _divider()
  }

  Object.entries(grupos).forEach(([cat, catItems]) => {
    data += _boldCenter('[' + cat + ']')
    catItems.forEach(item => {
      data += _left(item.cantidad + 'x ' + _sanitize(item.nombre))
      if (item.variante) data += _left('  + ' + _sanitize(item.variante))
      item.notas.forEach(n => {
        data += _left('  >> ' + _sanitize(n))
      })
    })
    data += CMD.LF
  })

  data += _divider()
  data += _center('Pedido recibido')
  data += _spacer(3)
  data += CMD.CUT_FULL

  return data
}

function buildDeliveryTicket(pedido, empresa) {
  const items = pedido?.items || []
  const total = Number(pedido?.total || 0)
  const tipoIva = pedido?.tipo_iva !== undefined ? Number(pedido.tipo_iva) : 10
  const ivaMonto = tipoIva === 0 ? 0 : Math.round(total * tipoIva / (100 + tipoIva))
  const subtotalSinIva = total - ivaMonto
  const width = _getWidth()
  let data = ''

  data += CMD.INIT
  data += _center(CMD.DOUBLE_ON + _sanitize(empresa?.nombre || 'RESTAURANTE') + CMD.DOUBLE_OFF)
  if (empresa?.telefono) data += _center('Tel: ' + _sanitize(empresa.telefono))
  data += _divider()

  data += _boldCenter('DELIVERY')
  data += _boldCenter('#' + (pedido?.numero_orden || pedido?.id || '001'))
  data += _center('Fecha: ' + _formatDate(pedido?.created_at))
  data += _divider()

  data += _row('Cliente:', _sanitize(pedido?.nombre_cliente || ''))
  if (pedido?.telefono_cliente) data += _row('Tel:', pedido.telefono_cliente)
  if (pedido?.direccion) data += _row('Direccion:', _sanitize(pedido.direccion))
  if (pedido?.notas) data += _row('Notas:', _sanitize(pedido.notas))
  data += _divider()

  if (items.length > 0) {
    const colQty = 5
    const colPrice = 10
    const colDesc = width - colQty - colPrice
    data += _left('Cant'.padEnd(colQty) + 'Descripcion'.padEnd(colDesc) + 'Total'.padStart(colPrice))
    data += _divider('-')

    items.forEach(item => {
      const nombre = _sanitize(item.producto_nombre || item.producto)
      const itemTotal = item.cantidad * Number(item.precio)
      const cantStr = String(item.cantidad) + 'x'
      const descMax = colDesc - 2
      const nombreTrunc = nombre.length > descMax ? nombre.slice(0, descMax - 1) + '\u2026' : nombre
      data += _left(cantStr.padEnd(colQty) + nombreTrunc.padEnd(colDesc) + _formatGuarani(itemTotal).padStart(colPrice))
    })
    data += _divider()
  }

  data += _row('Subtotal sin IVA:', _formatGuarani(subtotalSinIva))
  if (tipoIva > 0) {
    data += _row('IVA ' + tipoIva + '%:', _formatGuarani(ivaMonto))
  }
  data += _divider()
  data += CMD.LEFT + CMD.BOLD_ON + 'TOTAL Gs:'.padEnd(width - 10) + _formatGuarani(total) + CMD.BOLD_OFF + CMD.LF
  data += _spacer(1)
  data += _center('Gracias por su preferencia!')
  data += _spacer(2)
  data += CMD.CUT_FULL

  return data
}

export async function listPrinters(serverUrl) {
  try {
    const token = await _getToken()
    const res = await fetch(serverUrl + '/printers', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    return await res.json()
  } catch (e) {
    return { success: false, error: e.message }
  }
}

export async function printTicketFactura(pedido, negocio, cliente, numero) {
  const data = buildTicketFactura(pedido, negocio, cliente, numero)
  const printerName = _getPrinterName('caja')
  const serverUrl = _getPrintServer('caja')
  await _sendRaw(data, printerName, serverUrl)
}

export async function printComanda(pedido) {
  const data = buildComanda(pedido)
  const printerName = _getPrinterName('cocina')
  const serverUrl = _getPrintServer('cocina')
  await _sendRaw(data, printerName, serverUrl)
}

export async function printDeliveryTicket(pedido, empresa) {
  const data = buildDeliveryTicket(pedido, empresa)
  const printerName = _getPrinterName('caja')
  const serverUrl = _getPrintServer('caja')
  await _sendRaw(data, printerName, serverUrl)
}
