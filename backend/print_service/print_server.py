import json
import os
import time
import logging
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from printer_utils import listar_impresoras, detectar_impresora_termica, imprimir_texto
from escpos_builder import build_comanda, build_cuenta, build_factura, build_test_page

HOST = '0.0.0.0'
PORT = 5123
MAX_RETRIES = 3
RETRY_DELAY = 1

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = BASE_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(str(LOG_DIR / 'print.log'), encoding='utf-8'),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger('karuprint')

TOKEN = os.environ.get('PRINT_API_TOKEN')
if not TOKEN:
    env_path = BASE_DIR / 'config.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('PRINT_API_TOKEN='):
                    TOKEN = line.split('=', 1)[1]
                    break
if not TOKEN:
    TOKEN = 'pipper-print-token-default'


class PrintHandler(BaseHTTPRequestHandler):

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def _json(self, data, status=200):
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _text(self, text, status=200):
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'text/plain')
        self.end_headers()
        self.wfile.write(text.encode('utf-8'))

    def _check_auth(self):
        auth = self.headers.get('Authorization', '')
        expected = f'Bearer {TOKEN}'
        if auth != expected:
            self._json({'success': False, 'error': 'No autorizado'}, 401)
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self._json({'status': 'ok', 'servicio': 'karu-print'})

        elif self.path == '/printers':
            try:
                impresoras = listar_impresoras()
                self._json({'success': True, 'impresoras': impresoras})
            except Exception as e:
                self._json({'success': False, 'error': str(e)}, 500)

        else:
            self._json({'error': 'not found'}, 404)

    def do_POST(self):
        if not self._check_auth():
            return

        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length).decode('utf-8')) if length else {}
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
            body = {}

        try:
            if self.path == '/print/comanda':
                return self._print_comanda(body)
            elif self.path == '/print/cuenta':
                return self._print_cuenta(body)
            elif self.path == '/print/factura':
                return self._print_factura(body)
            elif self.path == '/print/test':
                return self._print_test(body)
            elif self.path == '/print/raw':
                return self._print_raw(body)
            else:
                self._json({'error': 'not found'}, 404)
        except Exception as e:
            import traceback
            logger.error(f'{e}', exc_info=True)
            self._json({'success': False, 'error': str(e)}, 500)

    def _get_printer(self, body):
        printer = body.get('impresora', '')
        if not printer:
            printer = detectar_impresora_termica()
        if not printer:
            raise Exception('No se encontr ninguna impresora. Configrela en Ajustes.')
        return printer

    def _get_size(self, body):
        size = body.get('tamano', 'normal')
        if isinstance(size, dict):
            if size.get('type') == 'custom':
                return size
            return 'normal'
        return size if size in ('pequeno', 'normal', 'grande') else 'normal'

    def _get_paper_size(self, body):
        ps = body.get('paper_size', '80mm')
        return ps if ps in ('58mm', '80mm') else '80mm'

    def _print_with_retry(self, printer, escpos):
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                imprimir_texto(printer, escpos)
                return
            except Exception as e:
                last_error = e
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY * (2 ** attempt))
        raise last_error

    def _print_comanda(self, body):
        printer = self._get_printer(body)
        size = self._get_size(body)
        paper_width = self._get_paper_size(body)
        pedido = body.get('pedido', {})
        negocio = body.get('negocio', {})
        escpos = build_comanda(pedido, negocio, size, paper_width)
        self._print_with_retry(printer, escpos)
        self._json({'success': True, 'impresora': printer, 'tamano': size, 'paper_size': paper_width})

    def _print_cuenta(self, body):
        printer = self._get_printer(body)
        size = self._get_size(body)
        paper_width = self._get_paper_size(body)
        pedidos = body.get('pedidos', [])
        negocio = body.get('negocio', {})
        mesa = body.get('mesa', '')
        mesero_nombre = body.get('mesero_nombre', '')
        escpos = build_cuenta(pedidos, negocio, size, mesa, mesero_nombre, paper_width)
        self._print_with_retry(printer, escpos)
        self._json({'success': True, 'impresora': printer, 'tamano': size, 'paper_size': paper_width})

    def _print_factura(self, body):
        printer = self._get_printer(body)
        size = self._get_size(body)
        paper_width = self._get_paper_size(body)
        pedido = body.get('pedido', {})
        negocio = body.get('negocio', {})
        cliente = body.get('cliente', {})
        factura = body.get('factura') or {}
        detalle_pagos = body.get('detalle_pagos', pedido.get('detalle_pagos', []))
        qr_base64 = body.get('qr_base64') or factura.get('qr_base64', '') or pedido.get('qr_base64', '')
        pedido['cdc'] = factura.get('cdc', '') or pedido.get('cdc', '')
        pedido['kude'] = factura.get('kude', '') or pedido.get('kude', '')
        pedido['detalle_pagos'] = detalle_pagos
        pedido['vuelto'] = body.get('vuelto', pedido.get('vuelto', 0))
        pedido['propina'] = body.get('propina', pedido.get('propina', 0))
        pedido['monto_recibido'] = body.get('monto_recibido', pedido.get('monto_recibido', 0))
        escpos = build_factura(pedido, negocio, cliente, size, qr_base64, paper_width)
        self._print_with_retry(printer, escpos)
        self._json({'success': True, 'impresora': printer, 'tamano': size, 'paper_size': paper_width})

    def _print_test(self, body):
        printer = self._get_printer(body)
        size = self._get_size(body)
        paper_width = self._get_paper_size(body)
        escpos = build_test_page(printer, size, paper_width)
        self._print_with_retry(printer, escpos)
        self._json({'success': True, 'impresora': printer, 'tamano': size, 'paper_size': paper_width})

    def _print_raw(self, body):
        import base64
        printer = self._get_printer(body)
        raw_b64 = body.get('data', '')
        if not raw_b64:
            raise Exception('No se recibieron datos ESC/POS')
        escpos = base64.b64decode(raw_b64)
        self._print_with_retry(printer, escpos)
        self._json({'success': True, 'impresora': printer})

    def log_message(self, format, *args):
        logger.info(f'{args[0]} {args[1]} {args[2]}')


if __name__ == '__main__':
    logger.info('Servicio de impresion iniciado en puerto 5123')
    server = HTTPServer((HOST, PORT), PrintHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info('Servicio de impresion detenido')
        server.server_close()
