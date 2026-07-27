import { useState } from 'react'
import { printComanda } from '../utils/qzPrint'

export default function ComandaTicket({ pedido, onClose, onImprimir }) {
  const [imprimiendo, setImprimiendo] = useState(false)
  const paperSize = localStorage.getItem('pipper_paper_size') || '58mm'
  const ticketWidth = paperSize === '80mm' ? '280px' : '190px'

  const handlePrint = async () => {
    if (imprimiendo) return
    setImprimiendo(true)
    try {
      if (onImprimir) {
        await onImprimir(pedido)
      }
      await printComanda(pedido)
      setImprimiendo(false)
    } catch {
      window.print()
      setImprimiendo(false)
    }
  }

  const formatHora = (fecha) => {
    if (!fecha) return new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return new Date(fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  const formatFecha = (fecha) => {
    if (!fecha) return new Date().toLocaleDateString('es-ES')
    return new Date(fecha).toLocaleDateString('es-ES')
  }

  const getTiempoTranscurrido = (fecha) => {
    if (!fecha) return ''
    const diff = Date.now() - new Date(fecha).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '<1 min'
    return `${mins} min`
  }

  const getTiempoMinutos = (fecha) => {
    if (!fecha) return 0
    return Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  }

  const mergedItems = (() => {
    const items = pedido?.items || []
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
  const tiempoMin = getTiempoMinutos(pedido?.created_at)
  const esUrgente = tiempoMin >= 30

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div className="comanda-ticket" style={{ ...styles.ticket, width: ticketWidth, minWidth: ticketWidth }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>COMANDA</h2>
          <p style={styles.subtitle}>Pedido de Cocina</p>
          <p style={styles.numero}>#{pedido?.numero_orden || '001'}</p>
          <p style={styles.fecha}>{formatFecha(pedido?.created_at)} - {formatHora(pedido?.created_at)}</p>
        </div>

        <div style={styles.divider} />

        <div style={styles.info}>
          {pedido?.tipo_pedido === 'venta' ? (
            <div style={styles.row}>
              <span style={styles.label}>TIPO:</span>
              <span style={styles.value}>VENTA</span>
            </div>
          ) : pedido?.tipo_pedido === 'delivery' ? (
            <>
              <div style={styles.row}>
                <span style={styles.label}>TIPO:</span>
                <span style={styles.value}>DELIVERY</span>
              </div>
              {pedido?.nombre_cliente && (
                <div style={styles.row}>
                  <span style={styles.label}>CLIENTE:</span>
                  <span style={styles.value}>{pedido.nombre_cliente}</span>
                </div>
              )}
              {pedido?.telefono_cliente && (
                <div style={styles.row}>
                  <span style={styles.label}>TEL:</span>
                  <span style={styles.value}>{pedido.telefono_cliente}</span>
                </div>
              )}
              {pedido?.direccion && (
                <div style={styles.row}>
                  <span style={styles.label}>DIR:</span>
                  <span style={styles.value}>{pedido.direccion}</span>
                </div>
              )}
            </>
          ) : (
            <div style={styles.row}>
              <span style={styles.label}>MESA:</span>
              <span style={{ ...styles.value, fontWeight: 'bold', fontSize: '15px' }}>{pedido?.mesa || '?'}</span>
            </div>
          )}
          {pedido?.mesero_nombre && (
            <div style={styles.row}>
              <span style={styles.label}>MOZO:</span>
              <span style={styles.value}>{pedido.mesero_nombre}</span>
            </div>
          )}
          <div style={styles.row}>
            <span style={styles.label}>TIEMPO:</span>
            <span style={styles.value}>{getTiempoTranscurrido(pedido?.created_at)}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>ITEMS:</span>
            <span style={styles.value}>{totalItems}</span>
          </div>
        </div>

        {esUrgente && (
          <div style={styles.urgente}>
            *** URGENTE ***
          </div>
        )}

        {(pedido?.notas || mergedItems.some(i => i.notas.length > 0)) && (
          <>
            <div style={styles.notasSection}>
              <strong>NOTAS:</strong>
              {pedido?.notas && <div style={styles.notaLine}>{pedido.notas}</div>}
              {mergedItems.filter(i => i.notas.length > 0).flatMap(i => i.notas).filter((n, idx, arr) => arr.indexOf(n) === idx).map((n, i) => (
                <div key={i} style={styles.notaLine}>- {n}</div>
              ))}
            </div>
            <div style={styles.divider} />
          </>
        )}

        <div style={styles.itemsSection}>
          {Object.entries(grupos).map(([cat, catItems]) => (
            <div key={cat}>
              <div style={styles.catHeader}>[{cat.toUpperCase()}]</div>
              {catItems.map((item, i) => (
                <div key={i} style={styles.itemBlock}>
                  <div style={styles.itemMain}>
                    <span style={styles.itemQty}>{item.cantidad}x</span>
                    <span style={styles.itemName}>{item.nombre}</span>
                  </div>
                  {item.variante && (
                    <div style={styles.itemDetail}>+ {item.variante}</div>
                  )}
                  {item.notas.length > 0 && item.notas.map((n, j) => (
                    <div key={j} style={styles.itemDetail}>&gt;&gt; {n}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={styles.divider} />

        <div style={styles.footer}>
          <p>Pedido recibido</p>
        </div>

        <div style={styles.actions}>
          <button
            style={styles.printBtn}
            onClick={handlePrint}
            disabled={imprimiendo}
          >
            {imprimiendo ? '⏳ Imprimiendo...' : 'Imprimir'}
          </button>
          <button style={styles.closeBtn} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>

      <style>{`
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
          body * {
            visibility: hidden;
          }
          .comanda-ticket, .comanda-ticket * {
            visibility: visible;
            color: #000 !important;
          }
          .comanda-ticket {
            position: absolute;
            left: 0;
            top: 0;
            padding: 8px;
            background: #fff !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            line-height: 1.2 !important;
            color: #000 !important;
          }
          .comanda-ticket button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
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
  },
  header: {
    textAlign: 'center',
    marginBottom: '8px',
  },
  title: {
    margin: '0 0 2px 0',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    margin: '0',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000',
  },
  numero: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: '4px 0',
    color: '#000',
  },
  fecha: {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0',
    color: '#000',
  },
  divider: {
    borderTop: '1px solid #000',
    margin: '6px 0',
  },
  info: {
    fontSize: '12px',
    marginBottom: '8px',
    color: '#000',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '1px 0',
  },
  label: {
    fontWeight: 'bold',
    marginRight: '8px',
    color: '#000',
  },
  value: {
    fontWeight: 'bold',
    color: '#000',
  },
  urgente: {
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#000',
    margin: '4px 0',
    padding: '4px',
    border: '2px solid #000',
  },
  notasSection: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000',
    marginBottom: '4px',
  },
  notaLine: {
    fontStyle: 'italic',
    padding: '1px 0 1px 4px',
    color: '#000',
  },
  itemsSection: {
    marginBottom: '5px',
    fontSize: '12px',
    color: '#000',
  },
  catHeader: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000',
    margin: '4px 0 2px',
    letterSpacing: '1px',
  },
  itemBlock: {
    padding: '3px 0',
    borderBottom: '1px solid #000',
  },
  itemMain: {
    display: 'flex',
  },
  itemQty: {
    width: '30px',
    fontWeight: 'bold',
    flexShrink: 0,
    color: '#000',
  },
  itemName: {
    flex: 1,
    fontWeight: 'bold',
    color: '#000',
  },
  itemDetail: {
    padding: '1px 0 1px 30px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#000',
  },
  footer: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    marginTop: '8px',
    color: '#000',
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
  },
}
