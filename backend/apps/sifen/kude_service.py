import os
import logging
from typing import Optional
from django.conf import settings

logger = logging.getLogger(__name__)

try:
    from pykude import KudeFe
    KUDE_AVAILABLE = True
except ImportError:
    KUDE_AVAILABLE = False
    logger.warning('pykude library not installed. KuDE generation disabled.')


def generar_kude_pdf(xml_firmado: str, output_path: str, logo_path: Optional[str] = None):
    if not KUDE_AVAILABLE:
        raise ImportError('pykude library not installed. Run: pip install pykude[all]')

    kude = KudeFe(xml=xml_firmado)
    if logo_path and os.path.exists(logo_path):
        kude.output(output_path, logo=logo_path)
    else:
        kude.output(output_path)

    return output_path


def generar_kude_bytes(xml_firmado: str, logo_path: Optional[str] = None) -> bytes:
    if not KUDE_AVAILABLE:
        raise ImportError('pykude library not installed')

    kude = KudeFe(xml=xml_firmado)
    if logo_path and os.path.exists(logo_path):
        pdf_bytes = kude.output(logo=logo_path)
    else:
        pdf_bytes = kude.output()

    if isinstance(pdf_bytes, bytes):
        return pdf_bytes
    return pdf_bytes.read() if hasattr(pdf_bytes, 'read') else b''
