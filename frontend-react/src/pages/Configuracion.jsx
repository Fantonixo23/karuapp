import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import Sidebar from '../components/Sidebar'
import { formatGuarani } from '../utils/currency'
import { getApiUrl } from '../utils/api'

const API_URL = getApiUrl()
const DEPARTAMENTOS = {
  '1': { nombre: 'Capital', ciudades: { '1': 'ASUNCION (DISTRITO)' } },
  '2': { nombre: 'Concepción', ciudades: { '1': 'CONCEPCION', '2': 'HORQUETA', '3': 'LORETO', '4': 'YBY YAU' } },
  '3': { nombre: 'San Pedro', ciudades: { '1': 'SAN PEDRO DE YCUAMANDIYU', '2': 'SANTA ROSA', '3': 'CHORE' } },
  '4': { nombre: 'Cordillera', ciudades: { '1': 'CAACUPE', '2': 'PIRIBEBUY', '3': 'TOBATI', '4': 'ALTOS' } },
  '5': { nombre: 'Guairá', ciudades: { '1': 'VILLARRICA', '2': 'INDEPENDENCIA', '3': 'MBOCAYATY' } },
  '6': { nombre: 'Caaguazú', ciudades: { '1': 'CORONEL OVIEDO', '2': 'CAAGUAZU', '3': 'REPATRIACION' } },
  '7': { nombre: 'Caazapá', ciudades: { '1': 'CAAZAPA', '2': 'YUTY', '3': 'SAN JUAN NEPOMUCENO' } },
  '8': { nombre: 'Itapúa', ciudades: { '1': 'ENCARNACION', '2': 'CAMBYRETA', '3': 'CARMEN DEL PARANA' } },
  '9': { nombre: 'Misiones', ciudades: { '1': 'SAN JUAN BAUTISTA', '2': 'SANTA MARIA', '3': 'AYOLAS' } },
  '10': { nombre: 'Paraguarí', ciudades: { '1': 'PARAGUARI', '2': 'PIRAYU', '3': 'YAGUARON', '4': 'CARAPEGUA' } },
  '11': { nombre: 'Alto Paraná', ciudades: { '1': 'CIUDAD DEL ESTE', '2': 'PRESIDENTE FRANCO', '3': 'HERNANDARIAS', '4': 'MINGA GUAZU', '5': 'MINGA PORA', '6': 'SANTA RITA' } },
  '12': { nombre: 'Central', ciudades: { '1': 'AREGUA', '2': 'LUQUE', '3': 'CAPIATA', '4': 'ITAGUA', '5': 'LAMBARE', '6': 'FERNANDO DE LA MORA', '7': 'SAN LORENZO' } },
  '13': { nombre: 'Ñeembucú', ciudades: { '1': 'PILAR' } },
  '14': { nombre: 'Amambay', ciudades: { '1': 'PEDRO JUAN CABALLERO', '2': 'BELLA VISTA' } },
  '15': { nombre: 'Canindeyú', ciudades: { '1': 'SALTO DEL GUAIRA', '2': 'YPEJHU', '3': 'CURUGUATY' } },
  '16': { nombre: 'Presidente Hayes', ciudades: { '1': 'VILLA HAYES', '2': 'BENJAMIN ACEVAL', '3': 'NANAWA' } },
  '17': { nombre: 'Boquerón', ciudades: { '1': 'FILADELFIA', '2': 'LOMA PLATA', '3': 'MARISCAL ESTIGARRIBIA' } },
  '18': { nombre: 'Alto Paraguay', ciudades: { '1': 'FUERTE OLIMPO' } },
}

const ICONOS_DISPONIBLES = [
  'payments', 'credit_card', 'account_balance', 'qr_code', 'qr_code_scanner',
  'wallet', 'money', 'receipt', 'currency_exchange', 'paid',
  'smartphone', 'phone_iphone', 'tap_and_play', 'contactless',
  'check_circle', 'done_all', 'shopping_cart', 'point_of_sale'
]

export default function Configuracion() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  useEffect(() => { initDarkMode(); syncDarkMode() }, [])

  const [datos, setDatos] = useState({
    nombre_empresa: '',
    ruc: '',
    direccion: '',
    telefono: '',
    timbrado_numero: '',
    establecimiento: '001',
    punto_expedicion: '001'
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const [metodos, setMetodos] = useState([])
  const [metodoForm, setMetodoForm] = useState({ nombre: '', etiqueta: '', icono: 'payments', color: '#4CAF50', activo: true, orden: 0 })
  const [editMetodoId, setEditMetodoId] = useState(null)
  const [showMetodoModal, setShowMetodoModal] = useState(false)
  const [metodoMsg, setMetodoMsg] = useState('')

  const [logoPreview, setLogoPreview] = useState(() => localStorage.getItem('pipper_logo_base64') || '')
  const logoInputRef = useRef(null)
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('pipper_printer_name') || localStorage.getItem('qz_printer_name') || '')
  const [paperSize, setPaperSize] = useState(() => localStorage.getItem('pipper_paper_size') || '58mm')
  const [printServerCaja, setPrintServerCaja] = useState(() => localStorage.getItem('pipper_print_server_caja') || 'http://localhost:5123')
  const [printerCaja, setPrinterCaja] = useState(() => localStorage.getItem('pipper_printer_caja') || '')
  const [printServerCocina, setPrintServerCocina] = useState(() => localStorage.getItem('pipper_print_server_cocina') || 'http://localhost:5123')
  const [printerCocina, setPrinterCocina] = useState(() => localStorage.getItem('pipper_printer_cocina') || '')

  const [sifenHabilitado, setSifenHabilitado] = useState(false)
  const [backupInfo, setBackupInfo] = useState(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')

  useEffect(() => {
    cargarDatos()
    cargarMetodos()
    cargarBackupStatus()
  }, [])

  useEffect(() => {
    if (datos.sifen_habilitado !== undefined) {
      setSifenHabilitado(datos.sifen_habilitado)
    }
  }, [datos.sifen_habilitado])

  const cargarMetodos = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/metodos-pago`)
      const data = await res.json()
      if (data.success) setMetodos(data.metodos || [])
    } catch {}
  }

  const cargarBackupStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/backup`)
      const data = await res.json()
      if (data.ok) setBackupInfo(data)
    } catch {}
  }

  const realizarBackup = async (mode = 'local') => {
    setBackupLoading(true)
    setBackupMsg('')
    try {
      const res = await fetch(`${API_URL}/backup/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      })
      const data = await res.json()
      if (data.ok) {
        setBackupMsg('Backup creado: ' + (data.nombre || data.archivo || 'OK'))
        cargarBackupStatus()
      } else {
        setBackupMsg('Error: ' + (data.error || 'desconocido'))
      }
    } catch (e) {
      setBackupMsg('Error de conexion: ' + e.message)
    }
    setBackupLoading(false)
  }

  const abrirMetodoModal = (metodo = null) => {
    if (metodo) {
      setMetodoForm({
        nombre: metodo.nombre,
        etiqueta: metodo.etiqueta,
        icono: metodo.icono,
        color: metodo.color,
        activo: metodo.activo,
        orden: metodo.orden
      })
      setEditMetodoId(metodo.id)
    } else {
      setMetodoForm({ nombre: '', etiqueta: '', icono: 'payments', color: '#4CAF50', activo: true, orden: metodos.length + 1 })
      setEditMetodoId(null)
    }
    setMetodoMsg('')
    setShowMetodoModal(true)
  }

  const guardarMetodo = async () => {
    if (!metodoForm.nombre || !metodoForm.etiqueta) {
      setMetodoMsg('Nombre y etiqueta son requeridos')
      return
    }
    try {
      const url = editMetodoId
        ? `${API_URL}/facturacion/metodos-pago/${editMetodoId}/editar`
        : `${API_URL}/facturacion/metodos-pago/crear`
      const res = await fetch(url, {
        method: editMetodoId ? 'PUT' : 'POST',
        body: JSON.stringify(metodoForm)
      })
      const data = await res.json()
      if (data.success) {
        setShowMetodoModal(false)
        setMetodoMsg('')
        cargarMetodos()
      } else {
        setMetodoMsg(data.error || 'Error al guardar')
      }
    } catch {
      setMetodoMsg('Error de conexión')
    }
  }

  const eliminarMetodo = async (id) => {
    if (!confirm('Eliminar este metodo de pago?')) return
    try {
      const res = await fetch(`${API_URL}/facturacion/metodos-pago/${id}/eliminar`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        cargarMetodos()
      }
    } catch {}
  }

  const cargarDatos = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/config`)
      const data = await res.json()
      if (data.success && data.config) {
        setDatos({
          nombre_empresa: data.config.nombre_empresa || '',
          ruc: data.config.ruc || '',
          direccion: data.config.direccion || '',
          telefono: data.config.telefono || '',
          timbrado_numero: data.config.timbrado_numero || '001-001-0000001',
          establecimiento: data.config.establecimiento || '001',
          punto_expedicion: data.config.punto_expedicion || '001',
          tamano_papel: data.config.tamano_papel || '58mm'
        })
        if (data.config.tamano_papel) {
          setPaperSize(data.config.tamano_papel)
          localStorage.setItem('pipper_paper_size', data.config.tamano_papel)
        }
      }
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const guardar = async () => {
    if (!datos.nombre_empresa || !datos.ruc) {
      setMensaje('Complete los campos requeridos')
      return
    }
    
    setGuardando(true)
    setMensaje('')
    
    try {
      const res = await fetch(`${API_URL}/facturacion/config/actualizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, tamano_papel: paperSize })
      })
      const data = await res.json()
      
      if (data.success) {
        setMensaje('Datos guardados correctamente')
      } else {
        setMensaje(data.error || 'Error al guardar')
      }
    } catch (e) {
      setMensaje('Error de conexión')
    }
    
    setGuardando(false)
  }

  return (
    <div style={{ ...s.container(darkMode), display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate { animation: fadeIn 0.3s ease-out; }
        .cfg-input, .cfg-select, .cfg-textarea {
          width: 100%; padding: 11px 14px; font-size: 14px; border-radius: 10px;
          border: 1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'};
          background: ${darkMode ? '#2a2a2a' : '#f8f8f8'};
          color: ${darkMode ? 'white' : '#1a1a1a'};
          outline: none; box-sizing: border-box; transition: border 0.15s;
        }
        .cfg-input:focus, .cfg-select:focus, .cfg-textarea:focus { border-color: #FF9800; }
      `}</style>
      
      <header style={{ ...s.header, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={s.btnHeader}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={s.title}>Configuracion</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={toggleDarkMode} style={s.btnHeader}><span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span></button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/configuracion" />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={s.content}>
        <div style={s.card(darkMode)} className="animate">
          <h2 style={s.cardTitle(darkMode)}>Datos de la Empresa</h2>
          <p style={s.subtitle(darkMode)}>Estos datos aparecen en los tickets y facturas</p>
          
          <div style={s.field}>
            <label style={s.label(darkMode)}>Nombre del Restaurante *</label>
            <input 
              type="text"
              value={datos.nombre_empresa}
              onChange={(e) => setDatos({...datos, nombre_empresa: e.target.value})}
              placeholder="Mi Restaurante"
              style={s.input(darkMode)}
            />
          </div>
          
          <div style={s.field}>
            <label style={s.label(darkMode)}>RUC *</label>
            <input 
              type="text"
              value={datos.ruc}
              onChange={(e) => setDatos({...datos, ruc: e.target.value})}
              placeholder="80012345-7"
              style={s.input(darkMode)}
            />
          </div>
          
          <div style={s.field}>
            <label style={s.label(darkMode)}>Dirección</label>
            <input 
              type="text"
              value={datos.direccion}
              onChange={(e) => setDatos({...datos, direccion: e.target.value})}
              placeholder="Ciudad, Paraguay"
              style={s.input(darkMode)}
            />
          </div>
          
          <div style={s.field}>
            <label style={s.label(darkMode)}>Teléfono</label>
            <input 
              type="text"
              value={datos.telefono}
              onChange={(e) => setDatos({...datos, telefono: e.target.value})}
              placeholder="021-123456"
              style={s.input(darkMode)}
            />
          </div>
        </div>

        <div style={s.card(darkMode)} className="animate">
          <h2 style={s.cardTitle(darkMode)}>Datos de Facturacion</h2>
          <p style={s.subtitle(darkMode)}>Configuracion del timbrado SET y facturación electrónica SIFEN</p>

          {/* SWITCH HABILITAR SIFEN */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px', borderRadius: '10px', marginBottom: '16px',
            background: sifenHabilitado ? 'rgba(76,175,80,0.1)' : (darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
            border: `1px solid ${sifenHabilitado ? 'rgba(76,175,80,0.3)' : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`
          }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: darkMode ? '#fff' : '#333' }}>
                Facturación Electrónica SIFEN
              </div>
              <div style={{ fontSize: '12px', color: sifenHabilitado ? '#2E7D32' : '#999', marginTop: '2px' }}>
                {sifenHabilitado ? '✔ Activado — se generarán facturas electrónicas al cobrar' : 'Desactivado'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {sifenHabilitado && (
                <Link to="/app/sifen" style={{
                  padding: '8px 14px', borderRadius: '8px',
                  background: '#FF9800', color: 'white', fontWeight: '700',
                  fontSize: '12px', textDecoration: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <span className="material-icons" style={{ fontSize: '16px' }}>settings</span>
                  Configurar
                </Link>
              )}
              <button
                onClick={async () => {
                  const nuevoValor = !sifenHabilitado
                  setSifenHabilitado(nuevoValor)
                  try {
                    await fetch(`${API_URL}/facturacion/config/actualizar`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sifen_habilitado: nuevoValor })
                    })
                  } catch {}
                }}
                style={{
                  position: 'relative', width: '44px', height: '24px', flexShrink: 0,
                  background: sifenHabilitado ? '#4CAF50' : (darkMode ? '#555' : '#ccc'),
                  borderRadius: '12px', cursor: 'pointer', border: 'none', padding: 0
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: sifenHabilitado ? '22px' : '2px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
              </button>
            </div>
          </div>
          
          <div style={s.field}>
            <label style={s.label(darkMode)}>Numero de Timbrado</label>
            <input 
              type="text"
              value={datos.timbrado_numero}
              onChange={(e) => setDatos({...datos, timbrado_numero: e.target.value})}
              placeholder="001-001-0000001"
              style={s.input(darkMode)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{...s.field, flex: 1}}>
              <label style={s.label(darkMode)}>Establecimiento</label>
              <input 
                type="text"
                value={datos.establecimiento}
                onChange={(e) => setDatos({...datos, establecimiento: e.target.value})}
                placeholder="001"
                style={s.input(darkMode)}
              />
            </div>
            <div style={{...s.field, flex: 1}}>
              <label style={s.label(darkMode)}>Punto Expedicion</label>
              <input 
                type="text"
                value={datos.punto_expedicion}
                onChange={(e) => setDatos({...datos, punto_expedicion: e.target.value})}
                placeholder="001"
                style={s.input(darkMode)}
              />
            </div>
          </div>
        </div>

        {/* MÉTODOS DE PAGO */}
        <div style={s.card(darkMode)} className="animate">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={s.cardTitle(darkMode)}>Metodos de Pago</h2>
            <button onClick={() => abrirMetodoModal(null)} style={{
              padding: '8px 16px', border: 'none', borderRadius: '8px',
              background: '#4CAF50', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer'
            }}>+ Agregar</button>
          </div>
          <p style={s.subtitle(darkMode)}>Estos metodos aparecen al cobrar en Caja</p>

          {metodos.length === 0 ? (
            <p style={{ color: '#999', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No hay metodos de pago configurados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {metodos.map((m) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', borderRadius: '10px',
                  background: '#f9f9f9', border: '1px solid #eee',
                  opacity: m.activo ? 1 : 0.5
                }}>
                  <span className="material-icons" style={{ color: m.color, fontSize: '24px' }}>{m.icono}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#333' }}>{m.etiqueta}</div>
                    <div style={{ fontSize: '11px', color: '#999' }}>/{m.nombre} - Orden {m.orden}</div>
                  </div>
                  <button onClick={() => abrirMetodoModal(m)} style={{
                    padding: '6px 10px', border: '2px solid #ddd', borderRadius: '8px',
                    background: 'white', cursor: 'pointer', fontSize: '12px', color: '#666'
                  }}>Editar</button>
                  <button onClick={() => eliminarMetodo(m.id)} style={{
                    padding: '6px 10px', border: '2px solid #E53935', borderRadius: '8px',
                    background: 'white', cursor: 'pointer', fontSize: '12px', color: '#E53935'
                  }}>Eliminar</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONFIGURACION DE IMPRESION TERMICA */}
        <div style={s.card(darkMode)} className="animate">
          <h2 style={s.cardTitle(darkMode)}>Impresion Termica</h2>
          <p style={s.subtitle(darkMode)}>Configura las impresoras de Caja (tickets/facturas) y Cocina (comandas)</p>

          {/* --- IMPRESORA DE CAJA --- */}
          <div style={{ ...s.field, padding: '12px', borderRadius: '10px', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`, marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: darkMode ? '#FFB74D' : '#E65100', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>point_of_sale</span> Impresora de Caja
            </h3>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px 0' }}>Para tickets de factura, cuenta y delivery</p>

            <div style={s.field}>
              <label style={s.label(darkMode)}>Servidor de impresion (IP:Puerto)</label>
              <input
                type="text"
                value={printServerCaja}
                onChange={(e) => {
                  setPrintServerCaja(e.target.value)
                  localStorage.setItem('pipper_print_server_caja', e.target.value)
                }}
                placeholder="http://192.168.100.10:5123"
                style={s.input(darkMode)}
              />
            </div>

            <div style={s.field}>
              <label style={s.label(darkMode)}>Nombre de la impresora</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={printerCaja}
                  onChange={(e) => {
                    setPrinterCaja(e.target.value)
                    localStorage.setItem('pipper_printer_caja', e.target.value)
                  }}
                  placeholder="Dejar vacío = predeterminada"
                  style={{ ...s.input(darkMode), flex: 1 }}
                />
                <button
                  onClick={async () => {
                    try {
                      const { listPrinters } = await import('../utils/qzPrint')
                      const data = await listPrinters(printServerCaja)
                      if (data.success && data.impresoras && data.impresoras.length > 0) {
                        const nombres = data.impresoras.map(i => i.nombre || i)
                        alert('Impresoras en ' + printServerCaja + ':\n\n' + nombres.join('\n'))
                      } else {
                        alert('No se encontraron impresoras en ' + printServerCaja + '\nVerifica que el Servicio de Impresion este iniciado.')
                      }
                    } catch (e) {
                      alert('Error al conectar con ' + printServerCaja + ':\n' + e.message)
                    }
                  }}
                  style={{
                    padding: '10px 14px', border: 'none', borderRadius: '10px',
                    background: '#FF9800', color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>

          {/* --- IMPRESORA DE COCINA --- */}
          <div style={{ ...s.field, padding: '12px', borderRadius: '10px', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`, marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: darkMode ? '#81C784' : '#2E7D32', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>restaurant</span> Impresora de Cocina
            </h3>
            <p style={{ fontSize: '12px', color: '#999', margin: '0 0 12px 0' }}>Para comandas de cocina</p>

            <div style={s.field}>
              <label style={s.label(darkMode)}>Servidor de impresion (IP:Puerto)</label>
              <input
                type="text"
                value={printServerCocina}
                onChange={(e) => {
                  setPrintServerCocina(e.target.value)
                  localStorage.setItem('pipper_print_server_cocina', e.target.value)
                }}
                placeholder="http://192.168.100.5:5123"
                style={s.input(darkMode)}
              />
            </div>

            <div style={s.field}>
              <label style={s.label(darkMode)}>Nombre de la impresora</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={printerCocina}
                  onChange={(e) => {
                    setPrinterCocina(e.target.value)
                    localStorage.setItem('pipper_printer_cocina', e.target.value)
                  }}
                  placeholder="Dejar vacío = predeterminada"
                  style={{ ...s.input(darkMode), flex: 1 }}
                />
                <button
                  onClick={async () => {
                    try {
                      const { listPrinters } = await import('../utils/qzPrint')
                      const data = await listPrinters(printServerCocina)
                      if (data.success && data.impresoras && data.impresoras.length > 0) {
                        const nombres = data.impresoras.map(i => i.nombre || i)
                        alert('Impresoras en ' + printServerCocina + ':\n\n' + nombres.join('\n'))
                      } else {
                        alert('No se encontraron impresoras en ' + printServerCocina + '\nVerifica que el Servicio de Impresion este iniciado.')
                      }
                    } catch (e) {
                      alert('Error al conectar con ' + printServerCocina + ':\n' + e.message)
                    }
                  }}
                  style={{
                    padding: '10px 14px', border: 'none', borderRadius: '10px',
                    background: '#FF9800', color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap'
                  }}
                >
                  Buscar
                </button>
              </div>
            </div>
          </div>

          {/* --- CONFIGURACION COMPARTIDA --- */}
          <div style={s.field}>
            <label style={s.label(darkMode)}>Tamano del papel</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setPaperSize('58mm')
                  localStorage.setItem('pipper_paper_size', '58mm')
                }}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                  background: paperSize === '58mm' ? '#FF9800' : (darkMode ? '#333' : '#e0e0e0'),
                  color: paperSize === '58mm' ? 'white' : (darkMode ? '#ccc' : '#333'),
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                58mm (2")
              </button>
              <button
                onClick={() => {
                  setPaperSize('80mm')
                  localStorage.setItem('pipper_paper_size', '80mm')
                }}
                style={{
                  flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                  background: paperSize === '80mm' ? '#FF9800' : (darkMode ? '#333' : '#e0e0e0'),
                  color: paperSize === '80mm' ? 'white' : (darkMode ? '#ccc' : '#333'),
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                80mm (3")
              </button>
            </div>
          </div>

          {/* --- BOTONES DE PRUEBA --- */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={async () => {
                try {
                  const { printDeliveryTicket } = await import('../utils/qzPrint')
                  const pedidoPrueba = {
                    numero_orden: 'TEST',
                    nombre_cliente: 'Cliente de Prueba',
                    telefono_cliente: '0981 123 456',
                    direccion: 'Calle Prueba 123',
                    created_at: new Date().toISOString(),
                    items: [
                      { producto_nombre: 'Hamburguesa Simple', cantidad: 2, precio: 25000 },
                      { producto_nombre: 'Coca Cola 500ml', cantidad: 1, precio: 8000 },
                    ],
                    total: 58000,
                  }
                  const empresaPrueba = { nombre: datos.nombre_empresa || 'Mi Restaurante' }
                  await printDeliveryTicket(pedidoPrueba, empresaPrueba)
                  alert('Impresion de Caja enviada correctamente')
                } catch (e) {
                  alert('Error (Caja): ' + e.message)
                }
              }}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                background: '#E65100', color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
              }}
            >
              Probar Caja
            </button>
            <button
              onClick={async () => {
                try {
                  const { printComanda } = await import('../utils/qzPrint')
                  const pedidoPrueba = {
                    numero_orden: 'TEST',
                    mesa: 99,
                    mesero_nombre: 'Prueba',
                    tipo_pedido: 'local',
                    created_at: new Date().toISOString(),
                    items: [
                      { producto_nombre: 'Milanesa con papas', categoria_nombre: 'PLATO PRINCIPAL', cantidad: 2, precio: 35000 },
                      { producto_nombre: 'Ensalada', categoria_nombre: 'ENTRADA', cantidad: 1, precio: 15000 },
                    ],
                  }
                  await printComanda(pedidoPrueba)
                  alert('Impresion de Cocina enviada correctamente')
                } catch (e) {
                  alert('Error (Cocina): ' + e.message)
                }
              }}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                background: '#2E7D32', color: 'white', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
              }}
            >
              Probar Cocina
            </button>
          </div>
        </div>

        {/* RESPALDO DE BASE DE DATOS */}
        <div style={s.card(darkMode)} className="animate">
          <h2 style={s.cardTitle(darkMode)}>Respaldo de Base de Datos</h2>
          <p style={s.subtitle(darkMode)}>Crea copias de seguridad de la base de datos y subelas a Google Drive</p>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => realizarBackup('local')}
              disabled={backupLoading}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                background: backupLoading ? '#999' : '#FF9800',
                color: 'white', fontWeight: '700', fontSize: '12px', cursor: backupLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {backupLoading ? 'Respaldando...' : 'Respaldar Ahora'}
            </button>
            <button
              onClick={() => realizarBackup('rclone')}
              disabled={backupLoading}
              style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                background: backupLoading ? '#999' : '#2196F3',
                color: 'white', fontWeight: '700', fontSize: '12px', cursor: backupLoading ? 'not-allowed' : 'pointer'
              }}
            >
              Backup + Google Drive
            </button>
          </div>

          {backupMsg && (
            <div style={{
              padding: '10px', borderRadius: '8px', marginBottom: '12px',
              background: backupMsg.startsWith('Error') ? 'rgba(229,57,53,0.1)' : 'rgba(76,175,80,0.1)',
              color: backupMsg.startsWith('Error') ? '#E53935' : '#2E7D32',
              fontSize: '12px', fontWeight: '600', textAlign: 'center'
            }}>
              {backupMsg}
            </div>
          )}

          {backupInfo && backupInfo.backups && backupInfo.backups.length > 0 && (
            <div>
              <label style={s.label(darkMode)}>Ultimos respaldos</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {backupInfo.backups.slice(0, 5).map((b, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: '8px',
                    background: darkMode ? '#2a2a2a' : '#f5f5f5',
                    fontSize: '12px'
                  }}>
                    <span style={{ color: darkMode ? '#ccc' : '#555' }}>
                      {new Date(b.fecha).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: darkMode ? '#aaa' : '#777' }}>
                      {(b.tamano / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '12px', fontSize: '11px', color: '#999', lineHeight: '1.5' }}>
            Los backups se guardan en <code>backend/backups/</code>.<br />
            Para Google Drive via rclone: instala <a href="https://rclone.org/downloads/" target="_blank" rel="noopener" style={{ color: '#FF9800' }}>rclone</a>, configuralo y ejecuta "Backup + Google Drive".
          </div>
        </div>


        {/* MODAL MÉTODO DE PAGO */}
        {showMetodoModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)', zIndex: 300,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              background: 'white', borderRadius: '20px', width: '92%', maxWidth: '450px',
              maxHeight: '85vh', overflow: 'auto', padding: '24px'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#333' }}>
                {editMetodoId ? 'Editar Metodo' : 'Nuevo Metodo de Pago'}
              </h3>

              {metodoMsg && (
                <p style={{ color: '#E53935', fontSize: '12px', marginBottom: '12px', background: 'rgba(229,57,53,0.1)', padding: '8px', borderRadius: '8px' }}>
                  {metodoMsg}
                </p>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#333' }}>Nombre (clave)</label>
                <input type="text" value={metodoForm.nombre} onChange={e => setMetodoForm({ ...metodoForm, nombre: e.target.value })}
                  placeholder="efectivo, qr, etc." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#333' }}>Etiqueta (visible)</label>
                <input type="text" value={metodoForm.etiqueta} onChange={e => setMetodoForm({ ...metodoForm, etiqueta: e.target.value })}
                  placeholder="Efectivo, QR, etc." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#333' }}>Icono</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {ICONOS_DISPONIBLES.map(ic => (
                    <button key={ic} onClick={() => setMetodoForm({ ...metodoForm, icono: ic })} style={{
                      padding: '8px', borderRadius: '8px',
                      border: `2px solid ${metodoForm.icono === ic ? '#FF9800' : '#ddd'}`,
                      background: metodoForm.icono === ic ? 'rgba(255,152,0,0.1)' : 'white',
                      cursor: 'pointer'
                    }}>
                      <span className="material-icons" style={{ fontSize: '20px', color: metodoForm.icono === ic ? '#FF9800' : '#666' }}>{ic}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#333' }}>Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="color" value={metodoForm.color} onChange={e => setMetodoForm({ ...metodoForm, color: e.target.value })}
                    style={{ width: '48px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: 0 }} />
                  <input type="text" value={metodoForm.color} onChange={e => setMetodoForm({ ...metodoForm, color: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px', fontFamily: 'monospace' }} />
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: metodoForm.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <span className="material-icons" style={{ color: 'white', fontSize: '18px' }}>{metodoForm.icono}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: '600', color: '#333' }}>Orden</label>
                <input type="number" value={metodoForm.orden} onChange={e => setMetodoForm({ ...metodoForm, orden: Number(e.target.value) })}
                  min={0} max={99} style={{ width: '80px', padding: '10px 12px', borderRadius: '8px', border: '2px solid #ddd', fontSize: '14px' }} />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={metodoForm.activo} onChange={e => setMetodoForm({ ...metodoForm, activo: e.target.checked })}
                  id="metodo-activo" style={{ width: '18px', height: '18px' }} />
                <label htmlFor="metodo-activo" style={{ fontSize: '13px', fontWeight: '600', color: '#333' }}>Activo</label>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowMetodoModal(false)} style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                  background: '#ccc', color: '#333', fontWeight: '600', cursor: 'pointer'
                }}>Cancelar</button>
                <button onClick={guardarMetodo} style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white',
                  fontWeight: '700', cursor: 'pointer'
                }}>{editMetodoId ? 'Guardar' : 'Crear'}</button>
              </div>
            </div>
          </div>
        )}

        {mensaje && (
          <div style={{
            ...s.mensaje,
            background: '#d4edda',
            color: '#155724'
          }}>
            {mensaje}
          </div>
        )}

        <button 
          onClick={guardar}
          disabled={guardando}
          style={{
            ...s.btn,
            opacity: guardando ? 0.7 : 1
          }}
        >
          {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </button>

        <div style={s.info}>
          <p>Los cambios se aplican inmediatamente a los tickets.</p>
        </div>
        </div>
      </div>
      </div>
    </div>
  )
}

const s = {
  container: (dm) => ({
    minHeight: '100vh',
    background: dm ? '#121212' : '#f0f2f5',
    color: dm ? '#fff' : '#1a1a1a',
    overflow: 'hidden',
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: '#1a1a1a',
    color: 'white',
    borderBottom: '1px solid rgba(255,152,0,0.2)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
  },
  btnHeader: {
    width: '36px',
    height: '36px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    transition: 'all 0.15s'
  },
  title: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
  content: {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto'
  },
  card: (dm) => ({
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '20px',
    border: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    background: dm ? '#1e1e1e' : 'white',
    boxShadow: dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
  }),
  cardTitle: (dm) => ({
    margin: '0 0 5px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: dm ? '#fff' : '#1a1a1a'
  }),
  subtitle: (dm) => ({
    margin: '0 0 20px 0',
    fontSize: '13px',
    color: dm ? 'rgba(255,255,255,0.5)' : '#888'
  }),
  field: {
    marginBottom: '15px'
  },
  label: (dm) => ({
    display: 'block',
    marginBottom: '5px',
    fontSize: '13px',
    fontWeight: '600',
    color: dm ? '#ccc' : '#555'
  }),
  mensaje: {
    padding: '12px',
    borderRadius: '10px',
    marginBottom: '15px',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: '13px'
  },
  btn: {
    width: '100%',
    padding: '12px',
    border: 'none',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
    color: 'white',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  input: (dm) => ({
    width: '100%',
    padding: '11px 14px',
    fontSize: '14px',
    borderRadius: '10px',
    border: `1px solid ${dm ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
    background: dm ? '#2a2a2a' : '#f8f8f8',
    color: dm ? 'white' : '#1a1a1a',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border 0.15s',
  }),
}