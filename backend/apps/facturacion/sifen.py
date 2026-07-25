import hashlib
import base64
import io
import json
from datetime import datetime, date
from lxml import etree
import requests

# URLs oficiales SIFEN/SET Paraguay
# Producción: https://sifen.set.gov.py/
# Test (homologación): https://sifen-test.set.gov.py/
SIFEN_SANDBOX_URL = "https://sifen-test.set.gov.py/"
SIFEN_PRODUCTION_URL = "https://sifen.set.gov.py/"
SIFEN_VERIFY_URL = "https://sifen.set.gov.py/consultas/"  # URL para verificar CDC

CDC_QR_URL = "https://sifen.set.gov.py/consultas/"


def calcular_cdc(d, tipo_cdc=1):
    """
    Calcula el CDC (Código de Control) según el estándar SET Paraguay.
    tipo_cdc 1 = CDC para DE (Documento Electrónico)
    """
    d_flat = _flatten_dict(d, prefix='')
    sorted_keys = sorted(d_flat.keys())
    concat_data = ''.join(str(d_flat[k]) for k in sorted_keys)
    hash_obj = hashlib.sha256(concat_data.encode('utf-8'))
    digest = hash_obj.hexdigest().upper()
    cdc = digest[:31]
    dv = _calculate_verification_digit(cdc)
    return cdc + dv


def _calculate_verification_digit(num_str):
    """Calcula dígito verificador - módulo 11"""
    weights = [2, 3, 4, 5, 6, 7]
    total = 0
    for i, char in enumerate(reversed(num_str)):
        digit = int(char, 16)
        weight = weights[i % len(weights)]
        total += digit * weight
    remainder = total % 11
    dv = 11 - remainder
    if dv == 11:
        dv = 0
    elif dv == 10:
        dv = 1
    return str(dv)


def _flatten_dict(d, prefix=''):
    """Aplana un diccionario anidado para cálculo de CDC"""
    result = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            result.update(_flatten_dict(v, key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    result.update(_flatten_dict(item, f"{key}[{i}]"))
                else:
                    result[f"{key}[{i}]"] = str(item)
        else:
            result[key] = str(v)
    return result


def _bool_str(val):
    return "S" if val else "N"


def _fmt_dt(dt):
    if isinstance(dt, str):
        return dt
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    return str(dt)


def _parse_iva(item, default=10):
    """Parsea el valor IVA de un item manejando string 'exento'."""
    raw = item.get("iva", default)
    if raw is None:
        return int(default)
    if isinstance(raw, str):
        if raw.lower() in ("exento", "exenta", "exonerado", "0"):
            return 0
        try:
            return int(raw)
        except (ValueError, TypeError):
            return int(default)
    return int(raw)


def generar_de_xml(config, factura_data, cliente, items, operacion="1"):
    """
    Genera el XML del DE (Documento Electrónico) versión 150.
    
    Args:
        config: Configuracion instance
        factura_data: dict with numero_factura, fecha_emision, etc
        cliente: dict with ruc, nombre, direccion
        items: list of item dicts with producto, cantidad, precio, iva
        operacion: "1"=venta, "2"=anulacion
    
    Returns:
        XML string
    """
    now = datetime.now()
    
    nsmap = {
        None: "http://www.set.gov.py/sifen/ns/de",
        "xsi": "http://www.w3.org/2001/XMLSchema-instance",
    }
    DE = etree.Element("DE", nsmap=nsmap)
    DE.set("{http://www.w3.org/2001/XMLSchema-instance}schemaLocation",
           "http://www.set.gov.py/sifen/ns/de sifen-de.xsd")
    DE.set("version", "150")

    rDE = etree.SubElement(DE, "rDE")

    # dTipDE - Tipo de Documento Electrónico
    etree.SubElement(rDE, "dTipDE").text = operacion  # 1=Factura

    # dDesTipDE
    etree.SubElement(rDE, "dDesTipDE").text = "FACTURA" if operacion == "1" else "NOTA DE CRÉDITO"

    # dEsti - Establecimiento
    etree.SubElement(rDE, "dEsti").text = config.establecimiento or "001"

    # dPunExp - Punto de Expedición
    etree.SubElement(rDE, "dPunExp").text = config.punto_expedicion or "001"

    # dNumDoc - Número de Documento
    numero_factura = factura_data.get("numero", "0000001")
    etree.SubElement(rDE, "dNumDoc").text = numero_factura.zfill(7)

    # dCDC - Código de Control (se genera después)
    cdc_placeholder = factura_data.get("cdc", "X" * 32)
    etree.SubElement(rDE, "dCDC").text = cdc_placeholder

    # dTipEmi - Tipo de Emisión
    etree.SubElement(rDE, "dTipEmi").text = "1"  # 1=Normal, 2=Contingencia

    # dFecEmi - Fecha de Emisión
    etree.SubElement(rDE, "dFecEmi").text = now.strftime("%Y-%m-%d")

    # dHorEmi - Hora de Emisión
    etree.SubElement(rDE, "dHorEmi").text = now.strftime("%H:%M:%S")

    # dFecVig - Vigencia del timbrado
    if config.fecha_vencimiento:
        etree.SubElement(rDE, "dFecVig").text = config.fecha_vencimiento.strftime("%Y-%m-%d")
    else:
        etree.SubElement(rDE, "dFecVig").text = now.strftime("%Y-%m-%d")

    # gTimb - Timbrado
    gTimb = etree.SubElement(rDE, "gTimb")
    etree.SubElement(gTimb, "dNumTim").text = config.timbrado_numero or "001-001-0000001"

    # gEmis - Emisor
    gEmis = etree.SubElement(rDE, "gEmis")
    etree.SubElement(gEmis, "dRucEm").text = config.ruc
    etree.SubElement(gEmis, "dNomEm").text = config.nombre_empresa[:60]
    if config.direccion:
        etree.SubElement(gEmis, "dDirEm").text = config.direccion[:80]
    if config.telefono:
        etree.SubElement(gEmis, "dTelEm").text = config.telefono[:20]
    etree.SubElement(gEmis, "dTipCon").text = "1"  # 1=Contribuyente

    # gDatGralOpe - Datos Generales de la Operación
    gDatGralOpe = etree.SubElement(rDE, "gDatGralOpe")

    # gDatRec - Datos del Receptor
    gDatRec = etree.SubElement(gDatGralOpe, "gDatRec")
    etree.SubElement(gDatRec, "dRucRec").text = cliente.get("ruc", "44444444-7")
    etree.SubElement(gDatRec, "dNomRec").text = (cliente.get("nombre", "CONSUMIDOR FINAL") or "CONSUMIDOR FINAL")[:60]
    if cliente.get("direccion"):
        etree.SubElement(gDatRec, "dDirRec").text = cliente["direccion"][:80]
    if cliente.get("telefono"):
        etree.SubElement(gDatRec, "dTelRec").text = cliente["telefono"][:20]
    if cliente.get("email"):
        etree.SubElement(gDatRec, "dEmailRec").text = cliente["email"][:50]

    # gValores - Valores de la operación
    gValores = etree.SubElement(rDE, "gValoresOpe")

    total_iva10 = 0
    total_iva5 = 0
    total_exentas = 0
    total_gravadas_10 = 0
    total_gravadas_5 = 0
    subtotal = 0

    for item in items:
        cantidad = item.get("cantidad", 1)
        precio = float(item.get("precio", 0))
        iva_tipo = _parse_iva(item, 10)
        total_item = cantidad * precio
        subtotal += total_item

        if iva_tipo == 10:
            total_gravadas_10 += total_item
            total_iva10 += total_item * 0.10 / 1.10
        elif iva_tipo == 5:
            total_gravadas_5 += total_item
            total_iva5 += total_item * 0.05 / 1.05
        else:
            total_exentas += total_item

    total_iva_liq = total_iva10 + total_iva5

    etree.SubElement(gValores, "dTotOpe").text = f"{subtotal:.0f}"
    exenta_elem = etree.SubElement(gValores, "dTotOpeExe")
    exenta_elem.text = f"{total_exentas:.0f}" if total_exentas > 0 else "0"
    gValorItem5 = etree.SubElement(gValores, "gValorItem5")
    if total_gravadas_5 > 0:
        etree.SubElement(gValorItem5, "dTotOpe5").text = f"{total_gravadas_5:.0f}"
        etree.SubElement(gValorItem5, "dTotIVA5").text = f"{total_iva5:.0f}"
    gValorItem10 = etree.SubElement(gValores, "gValorItem10")
    if total_gravadas_10 > 0:
        etree.SubElement(gValorItem10, "dTotOpe10").text = f"{total_gravadas_10:.0f}"
        etree.SubElement(gValorItem10, "dTotIVA10").text = f"{total_iva10:.0f}"
    etree.SubElement(gValores, "dTotIVA").text = f"{total_iva_liq:.0f}"
    total_final = subtotal
    etree.SubElement(gValores, "dTotGralOpe").text = f"{total_final:.0f}"

    # gCamIVA - Campos del IVA
    gCamIVA = etree.SubElement(rDE, "gCamIVA")
    gCamIVA11 = etree.SubElement(gCamIVA, "gCamIVA11")
    etree.SubElement(gCamIVA11, "dIVA5").text = f"{total_iva5:.0f}" if total_iva5 > 0 else "0"
    gCamIVA12 = etree.SubElement(gCamIVA, "gCamIVA12")
    etree.SubElement(gCamIVA12, "dIVA10").text = f"{total_iva10:.0f}" if total_iva10 > 0 else "0"

    # gItems - Detalle de Items
    gItems = etree.SubElement(rDE, "gItems")
    for i, item in enumerate(items, 1):
        gItem = etree.SubElement(gItems, "gItem")
        etree.SubElement(gItem, "dNumItem").text = str(i)
        etree.SubElement(gItem, "dCodItem").text = str(item.get("codigo", item.get("producto_id", str(i))))
        etree.SubElement(gItem, "dDesItem").text = (item.get("producto_nombre") or item.get("nombre") or "Producto")[:80]
        etree.SubElement(gItem, "dCantidad").text = f"{item.get('cantidad', 1):.0f}"
        etree.SubElement(gItem, "dUniMed").text = "99"  # 99=Unidad
        etree.SubElement(gItem, "dPrecioUni").text = f"{float(item.get('precio', 0)):.0f}"
        
        iva_tipo = _parse_iva(item, 10)
        if iva_tipo == 0:
            etree.SubElement(gItem, "dExeItem").text = "S"
        else:
            etree.SubElement(gItem, "dExeItem").text = "N"
        
        total_item = float(item.get("cantidad", 1)) * float(item.get("precio", 0))
        iva_item = total_item * iva_tipo / (100 + iva_tipo) if iva_tipo > 0 else 0
        etree.SubElement(gItem, "dTpoImp").text = f"{iva_tipo}"
        
        gValorItem = etree.SubElement(gItem, "gValorItem")
        etree.SubElement(gValorItem, "dTotBruItem").text = f"{total_item:.0f}"
        etree.SubElement(gValorItem, "dTotNetItem").text = f"{total_item:.0f}"

    # gCamRef - Campos de Referencia (opcional)
    if factura_data.get("referencia"):
        gCamRef = etree.SubElement(rDE, "gCamRef")
        etree.SubElement(gCamRef, "dRef").text = factura_data["referencia"]

    # gCamCond - Condiciones de la operación
    gCamCond = etree.SubElement(rDE, "gCamCond")
    gCamCond12 = etree.SubElement(gCamCond, "gCamCond12")
    etree.SubElement(gCamCond12, "dCondVent").text = "1"  # 1=Contado, 2=Crédito
    etree.SubElement(gCamCond12, "dDescCondVent").text = "CONTADO"

    # dDigAni - Dígito de Anulación (opcional, default 0)
    etree.SubElement(rDE, "dDigAni").text = "0"

    # gCamGen - Campos Generales
    gCamGen = etree.SubElement(rDE, "gCamGen")

    return etree.tostring(DE, encoding="unicode", pretty_print=True)


def calcular_cdc_desde_xml(xml_str):
    """Calcula el CDC a partir del XML del DE."""
    root = etree.fromstring(xml_str.encode("utf-8"))
    ns = {"ns": "http://www.set.gov.py/sifen/ns/de"}
    
    rDE = root.find("rDE", ns)
    if rDE is None:
        rDE = root.find("{http://www.set.gov.py/sifen/ns/de}rDE")
    
    def _find_text(xpath):
        elem = rDE.find(xpath)
        if elem is not None:
            return elem.text or ""
        return ""

    dEsti = _find_text("dEsti")
    dPunExp = _find_text("dPunExp")
    dNumDoc = _find_text("dNumDoc")
    dTipDE = _find_text("dTipDE")
    dRucEm = _find_text("gEmis/dRucEm")
    dFecEmi = _find_text("dFecEmi")
    dTotGralOpe = _find_text("gValoresOpe/dTotGralOpe")

    if dEsti and dPunExp and dNumDoc and dTipDE and dRucEm and dFecEmi and dTotGralOpe:
        cdc_input = f"{dEsti}{dPunExp}{dNumDoc.zfill(7)}{dTipDE}{dRucEm}{dFecEmi.replace('-', '')}{float(dTotGralOpe):.0f}"
    else:
        cdc_input = xml_str

    hash_obj = hashlib.sha256(cdc_input.encode("utf-8"))
    cdc = hash_obj.hexdigest().upper()[:31]
    dv = _calculate_verification_digit(cdc)
    return cdc + dv


def generar_kude(cdc, ruc_emisor, total, fecha_emision, tipo_doc="1"):
    """
    Genera el KUDE (Código Único de Documento Electrónico) para QR.
    Formato: CDC|RUC|Total|Fecha|TipoDoc
    """
    kude = f"{cdc}|{ruc_emisor}|{float(total):.0f}|{fecha_emision}|{tipo_doc}"
    return kude


def generar_qr_base64(kude_str):
    """Genera un QR code en base64 a partir del KUDE."""
    import qrcode
    from PIL import Image

    qr = qrcode.QRCode(
        version=2,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=1,
    )
    qr.add_data(kude_str)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    qr_img.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return img_base64


def enviar_a_sifen(xml_str, cdc, modo="sandbox"):
    """
    Envía el DE a SIFEN (sandbox o producción) con reintentos.
    
    Returns:
        dict con resultado de la comunicación
    """
    import time
    urls = [SIFEN_SANDBOX_URL] if modo == "sandbox" else [SIFEN_PRODUCTION_URL]
    max_retries = 3

    for base_url in urls:
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    f"{base_url}recepcion",
                    data=xml_str.encode("utf-8"),
                    headers={
                        "Content-Type": "application/xml; charset=utf-8",
                        "Accept": "application/xml",
                    },
                    timeout=10,
                )
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "response": response.text,
                    "url": base_url,
                }
            except requests.exceptions.RequestException:
                if attempt < max_retries - 1:
                    time.sleep(1 * (2 ** attempt))
                continue
    
    return {
        "success": False,
        "error": "No se pudo conectar con SIFEN (modo: {0}). La factura se generó localmente con CDC y KUDE.".format(modo),
        "modo": modo,
    }


def generar_factura_completa(config, pedido, cliente_data):
    """
    Flujo completo de generación de factura electrónica:
    Intenta usar pysifen (producción) si está disponible,
    fallback al generador interno (sandbox/demo).
    """
    factura_number = str(pedido.get("numero_orden", "1")).zfill(7)
    items = pedido.get("items", [])
    total = sum(float(item.get("cantidad", 1)) * float(item.get("precio", 0)) for item in items)
    ruc_emisor = config.ruc
    fecha = datetime.now().strftime("%Y-%m-%d")

    # Try pysifen-based generation (production)
    try:
        from apps.sifen.sifen_service import (
            SIFEN_AVAILABLE, generar_de01, transmitir_sincrono,
            extraer_cdc as extraer_cdc_pysifen,
        )
        if SIFEN_AVAILABLE and config.certificado_pkcs12:
            cliente_ruc = cliente_data.get("ruc", "44444444-7")
            cliente_nombre = cliente_data.get("nombre", "CONSUMIDOR FINAL")
            rde = generar_de01(pedido, config, cliente_ruc, cliente_nombre)
            cert_data = config.certificado_pkcs12.read()
            password = config.csc_pin or ""
            result = transmitir_sincrono(rde, cert_data, password, config.ambiente_sifen)
            cdc = extraer_cdc_pysifen(result)
            xml_final = rde.to_xml()
            kude = generar_kude(cdc, ruc_emisor, total, fecha)
            qr_base64 = generar_qr_base64(kude)
            return {
                "xml": xml_final,
                "cdc": cdc,
                "kude": kude,
                "qr_base64": qr_base64,
                "numero": factura_number,
                "total": total,
                "fecha": fecha,
                "sifen_result": {"success": True, "modo": "pysifen"},
            }
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"pysifen fallback to homegrown: {e}")

    # Fallback: homegrown implementation (sandbox/demo)
    factura_data = {"numero": factura_number}
    xml_temp = generar_de_xml(config=config, factura_data=factura_data, cliente=cliente_data, items=items)
    cdc = calcular_cdc_desde_xml(xml_temp)
    factura_data["cdc"] = cdc
    xml_final = generar_de_xml(config=config, factura_data=factura_data, cliente=cliente_data, items=items)
    kude = generar_kude(cdc, ruc_emisor, total, fecha)
    qr_base64 = generar_qr_base64(kude)
    sifen_result = enviar_a_sifen(xml_final, cdc)

    return {
        "xml": xml_final,
        "cdc": cdc,
        "kude": kude,
        "qr_base64": qr_base64,
        "numero": factura_number,
        "total": total,
        "fecha": fecha,
        "sifen_result": sifen_result,
    }
