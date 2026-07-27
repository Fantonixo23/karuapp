const printStyles = `
  @media print {
    @page { margin: 0; }
    body {
      width: 100%;
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-font-smoothing: none;
      font-smoothing: none;
    }
    body * { visibility: hidden; }
    .print-wrapper {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      padding: 8px !important;
      margin: 0 !important;
      background: #fff !important;
      z-index: 9999 !important;
      font-family: 'Courier New', Courier, monospace !important;
      font-size: 12px !important;
      line-height: 1.2 !important;
      color: #000 !important;
    }
    .print-wrapper, .print-wrapper * { visibility: visible; color: #000 !important; }
    .print-wrapper .no-print { display: none !important; }
    .print-divider { border-top: 1px solid #000 !important; margin: 6px 0 !important; }
  }
`

const formatGuarani = (value) => {
  return `${Math.round(value || 0).toLocaleString('es-PY')} Gs`
}

const formatDate = (date) => {
  if (!date) return new Date().toLocaleString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
  return new Date(date).toLocaleString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

import { useState } from 'react'
import { printTicketFactura } from '../utils/qzPrint'

export const TicketFactura = ({ pedido, negocio, cliente, onClose, numero, vuelto, montoRecibido, factura, sifen_error }) => {
  const [imprimiendo, setImprimiendo] = useState(false)
  const items = pedido?.items || []
  const numeroFactura = numero || pedido?.numero_orden || 1
  const tipoIvaTicket = pedido?.tipo_iva !== undefined ? Number(pedido.tipo_iva) : null

  const calculos = calcularIVA(items, tipoIvaTicket)

  const ruc = negocio?.ruc || '-'
  const detallePagos = pedido?.detalle_pagos || []

  const paperSize = localStorage.getItem('pipper_paper_size') || '58mm'
  const ticketWidth = paperSize === '80mm' ? '280px' : '190px'

  return (
    <div style={styles.overlay}>
      <style>{printStyles}</style>
      <div className="print-wrapper" style={{ ...styles.ticket, width: ticketWidth, minWidth: ticketWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="ticket-content">
          <div style={styles.header}>
            <h2 style={styles.title}>{negocio?.nombre || 'RESTAURANTE'}</h2>
            <p style={styles.ruc}>RUC: {ruc}</p>
            <p style={styles.datos}>{negocio?.direccion || '-'}</p>
            <p style={styles.datos}>Tel: {negocio?.telefono || '-'}</p>
          </div>

          <div className="print-divider" style={styles.divider} />

          <div style={styles.center}>
            <p style={styles.bigTitle}>TICKET DE CAJA</p>
            <p style={styles.docNum}>N°: {String(numeroFactura).padStart(4, '0')}</p>
            <p>Fecha: {formatDate(pedido?.fecha)}</p>
          </div>

          <div className="print-divider" style={styles.divider} />

          {pedido?.delivery || pedido?.tipo_pedido === 'delivery' ? (
            <>
              <div style={styles.row}>
                <span>Mesa:</span>
                <span>Delivery</span>
              </div>
              {(pedido?.nombre_cliente || cliente?.nombre) && (
                <div style={styles.row}>
                  <span>Cliente:</span>
                  <span>{pedido?.nombre_cliente || cliente?.nombre}</span>
                </div>
              )}
              {(pedido?.telefono_cliente || cliente?.telefono) && (
                <div style={styles.row}>
                  <span>Tel:</span>
                  <span>{pedido?.telefono_cliente || cliente?.telefono}</span>
                </div>
              )}
              {(pedido?.direccion || cliente?.direccion) && (
                <div style={styles.row}>
                  <span>Direccion:</span>
                  <span>{pedido?.direccion || cliente?.direccion}</span>
                </div>
              )}
            </>
          ) : pedido?.mesa ? (
            <div style={styles.row}>
              <span>Mesa:</span>
              <span>{pedido.mesa}</span>
            </div>
          ) : null}

          <div style={styles.section}>
            <p style={styles.label}>CLIENTE:</p>
            <div style={styles.row}>
              <span>Razón Social:</span>
              <span>{cliente?.nombre || 'CONSUMIDOR FINAL'}</span>
            </div>
            <div style={styles.row}>
              <span>RUC:</span>
              <span>{cliente?.ruc || '44444444-7'}</span>
            </div>
          </div>

          <div className="print-divider" style={styles.divider} />

          <div style={styles.items}>
            <div style={styles.tableHeader}>
              <span>Cant</span>
              <span>Descripción</span>
              <span>Total</span>
            </div>
            {items.map((item, idx) => (
              <div key={idx} style={styles.itemRow}>
                <span style={styles.itemQty}>{item.cantidad}</span>
                <span style={styles.itemName}>{item.producto_nombre || item.nombre || item.producto}</span>
                <span style={styles.itemPrice}>{formatGuarani(item.cantidad * item.precio)}</span>
              </div>
            ))}
          </div>

          <div className="print-divider" style={styles.divider} />

          <div style={styles.totals}>
            <div style={styles.row}>
              <span>Subtotal:</span>
              <span>{formatGuarani(calculos.subtotal)}</span>
            </div>
            <div style={styles.row}>
              <span>IVA 10%:</span>
              <span>{formatGuarani(calculos.iva10)}</span>
            </div>
            {calculos.iva5 > 0 && (
              <div style={styles.row}>
                <span>IVA 5%:</span>
                <span>{formatGuarani(calculos.iva5)}</span>
              </div>
            )}
            <div className="print-divider" style={styles.divider} />
            <div style={styles.grandTotal}>
              <span>TOTAL Gs:</span>
              <span>{formatGuarani(pedido?.total || 0)}</span>
            </div>
          </div>

          {detallePagos.length > 0 && (
            <>
              <div className="print-divider" style={styles.divider} />
              <div style={styles.totals}>
                <p style={{ ...styles.label, textAlign: 'center', marginBottom: '4px' }}>FORMA DE PAGO</p>
                {detallePagos.map((p, idx) => (
                  <div key={idx} style={styles.row}>
                    <span>{p.metodo} ({p.moneda}):</span>
                    <span>{formatGuarani(p.monto_pyg)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="print-divider" style={styles.divider} />

          {pedido?.qr_base64 && (
            <>
              <div style={{ textAlign: 'center', margin: '8px 0' }}>
                <p style={styles.label}>FACTURA ELECTRÓNICA</p>
                <img
                  src={`data:image/png;base64,${pedido.qr_base64}`}
                  alt="QR Factura"
                  style={{ width: '100px', height: '100px', margin: '4px auto', display: 'block' }}
                />
                {pedido?.cdc && (
                  <p style={{ fontSize: '9px', wordBreak: 'break-all', margin: '2px 0', color: '#000' }}>
                    CDC: {pedido.cdc}
                  </p>
                )}
                {pedido?.kude && (
                  <p style={{ fontSize: '9px', wordBreak: 'break-all', margin: '2px 0', color: '#000' }}>
                    KUDE: {pedido.kude}
                  </p>
                )}
              </div>
              <div className="print-divider" style={styles.divider} />
            </>
          )}

          {vuelto > 0 && (
            <div style={{ textAlign: 'center', margin: '4px 0' }}>
              <p style={{ fontWeight: 'bold', fontSize: '14px', color: '#000', margin: '2px 0' }}>
                VUELTO: {formatGuarani(vuelto)}
              </p>
            </div>
          )}

          {sifen_error && (
            <div style={{ textAlign: 'center', margin: '4px 0', padding: '4px', border: '1px solid #E53935' }}>
              <p style={{ fontWeight: 'bold', fontSize: '10px', color: '#E53935', margin: '2px 0' }}>
                Error SIFEN: {sifen_error}
              </p>
            </div>
          )}

          <div style={styles.footer}>
            <p>Gracias por su preferencia!</p>
          </div>
        </div>

        <div className="no-print" style={styles.actions}>
          <button
            style={{
              ...styles.printBtn,
              background: imprimiendo ? '#999' : '#1565C0',
              cursor: imprimiendo ? 'not-allowed' : 'pointer',
              opacity: imprimiendo ? 0.6 : 1
            }}
            onClick={async () => {
              if (imprimiendo) return
              setImprimiendo(true)
              try {
                await printTicketFactura(pedido, negocio, cliente, numero)
                setImprimiendo(false)
              } catch {
                window.print()
                setImprimiendo(false)
              }
            }}
          >
            {imprimiendo ? '⏳ Imprimiendo...' : 'Imprimir'}
          </button>
          <button style={styles.closeBtn} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

function calcularIVA(items, tipoIvaGlobal) {
  let subtotal = 0
  let iva10 = 0
  let iva5 = 0
  let exentas = 0

  if (tipoIvaGlobal !== null) {
    items.forEach(item => {
      const total = item.cantidad * item.precio
      subtotal += total
    })
    if (tipoIvaGlobal === 0) {
      exentas = subtotal
    } else if (tipoIvaGlobal === 5) {
      iva5 = subtotal * 5 / 105
    } else {
      iva10 = subtotal * 10 / 110
    }
  } else {
    items.forEach(item => {
      const total = item.cantidad * item.precio
      subtotal += total
      const tipoIva = (item.iva !== undefined && item.iva !== null && item.iva !== '') ? Number(item.iva) : 10
      if (tipoIva === 0) {
        exentas += total
      } else if (tipoIva === 5) {
        iva5 += total * 5 / 105
      } else {
        iva10 += total * 10 / 110
      }
    })
  }

  return { subtotal, iva10, iva5, exentas }
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    overflow: 'auto'
  },
  ticket: {
    background: '#fff',
    width: '280px',
    minWidth: '280px',
    padding: '8px',
    borderRadius: '4px',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '12px',
    lineHeight: 1.2,
    color: '#000',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px'
  },
  title: {
    margin: '0 0 2px 0',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#000'
  },
  ruc: {
    margin: '2px 0',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  datos: {
    margin: '1px 0',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  divider: {
    borderTop: '1px solid #000',
    margin: '6px 0'
  },
  center: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  bigTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
    color: '#000'
  },
  docNum: {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0',
    color: '#000'
  },
  section: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  label: {
    fontWeight: 'bold',
    marginBottom: '3px',
    color: '#000'
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1px 0',
    fontWeight: 'bold',
    color: '#000'
  },
  items: {
    marginBottom: '5px',
    fontSize: '12px',
    color: '#000'
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
    borderBottom: '2px solid #000',
    paddingBottom: '2px',
    marginBottom: '4px',
    color: '#000'
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
    fontWeight: 'bold',
    color: '#000'
  },
  itemQty: {
    width: '30px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  itemName: {
    flex: 1,
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  itemPrice: {
    textAlign: 'right',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  totals: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000'
  },
  grandTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 'bold',
    fontSize: '12px',
    borderTop: '2px solid #000',
    paddingTop: '3px',
    color: '#000'
  },
  footer: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    marginTop: '8px',
    color: '#000'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '12px',
  },
  printBtn: {
    padding: '12px 20px',
    background: '#1565C0',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    flex: 1,
    maxWidth: '120px',
  },
  closeBtn: {
    padding: '12px 20px',
    background: '#333',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    flex: 1,
    maxWidth: '120px',
  }
}
