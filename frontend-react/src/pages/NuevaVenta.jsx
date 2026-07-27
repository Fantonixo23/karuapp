import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import TomarPedido from '../components/TomarPedido'
import { useStore } from '../store/useStore'
import { useSocketStore, useRealTime } from '../store/useSocketStore'
import { formatGuarani } from '../utils/currency'

import { getApiUrl } from '../utils/api'
const API_URL = getApiUrl()

const estilosImpresionBluetooth = `
  @media print {
    body * { visibility: hidden; }
    #cuenta-print, #cuenta-print * { visibility: visible; }
    #cuenta-print { position: absolute; left: 0; top: 0; width: 58mm; font-family: 'Courier New', monospace; font-size: 10px; padding: 4px; margin: 0; color: #000 !important; }
    #cuenta-print * { color: #000 !important; border-color: #000 !important; }
    #cuenta-print .no-print { display: none !important; }
  }
`

export default function NuevaVenta() {
  const [vista, setVista] = useState('mesas')
  const [mesas, setMesas] = useState([])
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)
  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalOcupar, setModalOcupar] = useState(false)
  const [modalEstado, setModalEstado] = useState(false)
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [mesaAEliminar, setMesaAEliminar] = useState(null)
  const [error, setError] = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [mesaNumero, setMesaNumero] = useState('')
  const [mesaArea, setMesaArea] = useState('')
  const [mesaCapacidad, setMesaCapacidad] = useState('')
  const [cargando, setCargando] = useState(false)
  const [pedidosMesa, setPedidosMesa] = useState([])
  const [mostrarPedidoModal, setMostrarPedidoModal] = useState(false)
  const [modalCuenta, setModalCuenta] = useState(false)
  const [pedidoParaEditar, setPedidoParaEditar] = useState(null)
  const [modalCancelarConMotivo, setModalCancelarConMotivo] = useState(false)
  const [pedidoACancelar, setPedidoACancelar] = useState(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [modalEntregar, setModalEntregar] = useState(false)
  const [pedidoAEntregar, setPedidoAEntregar] = useState(null)
  const [empresa, setEmpresa] = useState({ nombre: '', ruc: '', direccion: '', telefono: '' })
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  )
  
  const { initSocket, lastUpdate, mesaUpdates, connected } = useRealTime()
  
  useEffect(() => {
    initSocket()
    initDarkMode()
    syncDarkMode()
    cargarDatosEmpresa()
    loadMesas()
    const interval = setInterval(loadMesas, 30000)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => {
    if (lastUpdate?.type === 'mesa') {
      loadMesas()
    }
  }, [lastUpdate])

  useEffect(() => {
    if (lastUpdate?.type === 'pedido_modificado' || lastUpdate?.type === 'pedido') {
      if (mesaSeleccionada) cargarPedidosMesa(mesaSeleccionada.id)
    }
  }, [lastUpdate])
  
  useEffect(() => {
    if (mesaUpdates.length > 0) {
      console.log('Actualización de mesa recibida')
      loadMesas()
    }
  }, [mesaUpdates])

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const handler = (e) => setIsLandscape(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const cargarDatosEmpresa = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/config`)
      const data = await res.json()
      if (data.success && data.config) {
        setEmpresa({
          nombre: data.config.nombre_empresa || '',
          ruc: data.config.ruc || '',
          direccion: data.config.direccion || '',
          telefono: data.config.telefono || '',
        })
      }
    } catch (e) {
      console.error('Error cargando datos empresa:', e)
    }
  }

  const loadMesas = async () => {
    try {
      setError(null)
      const res = await fetch(`${API_URL}/mesas`)
      const data = await res.json()
      if (data.success) setMesas(data.mesas || [])
      else setMesas([])
    } catch (e) {
      setError(`No conectar a ${API_URL}`)
    }
  }

  const cargarPedidosMesa = async (mesaId, abrirModal = false) => {
    try {
      const res = await fetch(`${API_URL}/pedidos/mesa/${mesaId}`)
      const data = await res.json()
      if (data.success && data.pedidos) {
        const activos = data.pedidos.filter(p => p.estado !== 'pagado' && p.estado !== 'cancelado')
        setPedidosMesa(activos)
      } else {
        setPedidosMesa([])
      }
      if (abrirModal) setMostrarPedidoModal(true)
    } catch (e) {
      console.error('Error cargando pedidos:', e)
      setPedidosMesa([])
      if (abrirModal) setMostrarPedidoModal(true)
    }
  }

  const handlePrintBluetooth = () => {
    window.print()
  }

  const seleccionarMesa = (mesa) => {
    if (mesaSeleccionada?.id === mesa.id) {
      setMesaSeleccionada(null)
      setPanelAbierto(false)
    } else {
      setMesaSeleccionada(mesa)
      if (mesa.estado === 'disponible' || mesa.estado === 'libre') {
        setModalOcupar(true)
      } else if (mesa.estado === 'ocupada') {
        setPanelAbierto(true)
        cargarPedidosMesa(mesa.id)
      } else if (mesa.estado === 'limpieza') {
        setPanelAbierto(true)
      }
    }
  }

  const confirmarOcupar = async () => {
    if (!mesaSeleccionada) return
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/mesas/${mesaSeleccionada.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'ocupada' })
      })
      const data = await res.json()
      if (data.success) {
        setModalOcupar(false)
        setMesas(mesas.map(m => 
          m.id === mesaSeleccionada.id 
            ? { ...m, estado: 'ocupada' }
            : m
        ))
        setMesaSeleccionada({ ...mesaSeleccionada, estado: 'ocupada' })
        setPanelAbierto(true)
      } else {
        alert(data.error || 'Error')
      }
    } catch (e) {
      alert('Error de conexión')
    }
    setCargando(false)
  }

  const rechazarOcupar = () => {
    setModalOcupar(false)
  }

  const crearMesa = async () => {
    if (!mesaNumero) return
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/mesas/crear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: parseInt(mesaNumero), nombre: `Mesa ${mesaNumero}`, capacidad: parseInt(mesaCapacidad) || 4, area: mesaArea })
      })
      const data = await res.json()
      if (data.success) {
        setModalCrear(false)
        setMesaNumero('')
        setMesaCapacidad('')
        loadMesas()
      } else {
        console.log('Error:', data.error)
      }
    } catch (e) { console.log('Error:', e) }
    setCargando(false)
  }

  const editarMesa = async () => {
    if (!mesaSeleccionada || !mesaNumero) return
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/mesas/${mesaSeleccionada.id}/editar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: parseInt(mesaNumero), nombre: `Mesa ${mesaNumero}`, capacidad: parseInt(mesaCapacidad) || 4, area: mesaArea })
      })
      const data = await res.json()
      if (data.success) {
        setModalEditar(false)
        loadMesas()
      } else {
        console.log('Error:', data.error || 'Error')
      }
    } catch (e) { console.log('Error de conexión') }
    setCargando(false)
  }

  const confirmarBorrarMesa = (mesa) => {
    setMesaAEliminar(mesa)
    setModalConfirmar(true)
  }

  const borrarMesa = async () => {
    if (!mesaAEliminar) return
    setModalConfirmar(false)
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/mesas/${mesaAEliminar.id}/eliminar`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        loadMesas()
        setMesaSeleccionada(null)
        setPanelAbierto(false)
        localStorage.removeItem('mesa_seleccionada')
      } else {
        console.log('Error:', data.error)
      }
    } catch (e) { console.log('Error:', e) }
    setCargando(false)
    setMesaAEliminar(null)
  }

  const cambiarEstado = async (nuevoEstado) => {
    if (!mesaSeleccionada) return
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/mesas/${mesaSeleccionada.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (data.success) {
        setModalEstado(false)
        setMesas(mesas.map(m => 
          m.id === mesaSeleccionada.id 
            ? { ...m, estado: nuevoEstado }
            : m
        ))
        setMesaSeleccionada({ ...mesaSeleccionada, estado: nuevoEstado })
        setPanelAbierto(false)
      } else {
        alert(data.error || 'Error')
      }
    } catch (e) { alert('Error de conexión') }
    setCargando(false)
  }

  const getEstado = (estado) => {
    if (estado === 'ocupada') return { bg: '#E53935', bgSoft: 'rgba(229,57,53,0.12)', border: '#E53935', texto: 'Ocupada', icono: 'block' }
    if (estado === 'limpieza') return { bg: '#FBC02D', bgSoft: 'rgba(251,192,45,0.12)', border: '#FBC02D', texto: 'Limpieza', icono: 'cleaning_services' }
    return { bg: '#4CAF50', bgSoft: 'rgba(76,175,80,0.12)', border: '#4CAF50', texto: 'Disponible', icono: 'check_circle' }
  }

  const getAreaIcono = (area) => {
    return 'place'
  }

  const formatTime = (min) => {
    if (!min || min === '0min') return '-'
    const n = parseInt(min)
    if (n < 60) return `${n} min`
    return `${Math.floor(n/60)}h ${n%60}m`
  }

  const s = {
    container: (dm) => ({ minHeight: '100vh', background: dm ? '#121212' : '#f0f2f5', color: dm ? '#fff' : '#1a1a1a', overflow: 'hidden' }),
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px', background: '#1a1a1a',
      color: 'white', borderBottom: '1px solid rgba(255,152,0,0.2)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
    btnHeader: {
      width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)',
      fontSize: '18px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
      transition: 'all 0.15s'
    },
    title: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
    error: { padding: '10px 16px', background: '#E53935', color: 'white', fontSize: '13px' },
    gridMesas: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: '12px', padding: '16px', maxWidth: '1200px', width: '100%'
    },
    mesaCard: (m, selected, dm) => {
      const st = getEstado(m.estado)
      const baseBg = selected
        ? (dm ? 'rgba(255,152,0,0.12)' : 'rgba(255,152,0,0.08)')
        : st.bgSoft
      return {
        padding: '16px 12px', borderRadius: '14px', cursor: 'pointer',
        transition: 'all 0.2s',
        border: selected
          ? `2px solid #FF9800`
          : `1px solid ${st.border}30`,
        background: baseBg,
        boxShadow: selected
          ? '0 4px 20px rgba(255,152,0,0.2)'
          : (dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)'),
        transform: selected ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
      }
    },
    estadoBadge: (estado) => {
      const st = getEstado(estado)
      return {
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
        background: st.bgSoft, color: st.bg,
      }
    },
    panel: (dm) => ({
      position: 'fixed', top: '60px', right: panelAbierto ? '-20px' : '-400px',
      width: '320px', height: 'calc(100vh - 60px)',
      background: dm ? '#1a1a1a' : 'white',
      borderLeft: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      transition: 'right 0.25s ease', zIndex: 100,
      display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,0.1)'
    }),
    btnAction: (bg, disabled) => ({
      width: '44px', height: '44px', border: 'none', borderRadius: '12px',
      background: disabled ? (darkMode ? '#2a2a2a' : '#e0e0e0') : bg,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', transition: 'all 0.15s'
    }),
    input: (dm) => ({
      width: '100%', padding: '11px 14px', fontSize: '14px', borderRadius: '10px',
      border: `1px solid ${dm ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
      background: dm ? '#2a2a2a' : '#f8f8f8', color: dm ? 'white' : '#1a1a1a',
      outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
      transition: 'border 0.15s',
    }),
    select: (dm) => ({
      width: '100%', padding: '11px 14px', fontSize: '14px', borderRadius: '10px',
      border: `1px solid ${dm ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
      background: dm ? '#2a2a2a' : '#f8f8f8', color: dm ? 'white' : '#1a1a1a',
      outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
    }),
    modal: (dm) => ({
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }),
    modalCard: (dm) => ({
      background: dm ? '#1e1e1e' : 'white', borderRadius: '20px',
      padding: '28px', width: '90%', maxWidth: '400px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    }),
    btnPrimario: (disabled) => ({
      flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
      fontWeight: '700', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1, color: 'white',
    }),
    btnSecundario: (dm) => ({
      padding: '12px 20px', border: 'none', borderRadius: '10px',
      background: dm ? '#2a2a2a' : '#e8e8e8', color: dm ? '#ccc' : '#333',
      cursor: 'pointer', fontWeight: '600', fontSize: '14px',
    }),
  }

  return (
    <div style={s.container(darkMode)}>
      <header style={s.header}>
        <div style={s.headerLeft}>
          <Link to="/app/inicio" style={s.btnHeader}>
            <span className="material-icons" style={{ fontSize: '20px' }}>home</span>
          </Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <h1 style={s.title}>Mesas</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isMobile && <FullscreenButton />}
          <button onClick={toggleDarkMode} style={s.btnHeader}>
            <span className="material-icons" style={{ fontSize: '20px' }}>{darkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </header>

      {error && <div style={s.error}><span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>error_outline</span>{error}</div>}

      <div style={{ display: 'flex', height: 'calc(100vh - 60px)', position: 'relative', paddingBottom: isMobile ? (isLandscape ? '46px' : '60px') : '0' }}>
        <Sidebar activePath="/app/mesas" />

        {vista === 'pedido' ? (
          <TomarPedido
            mesa={mesaSeleccionada}
            onVolver={() => { setVista('mesas'); setPedidoParaEditar(null); cargarPedidosMesa(mesaSeleccionada?.id) }}
            pedidoExistente={pedidoParaEditar}
            onPedidoActualizado={() => { setPedidoParaEditar(null); cargarPedidosMesa(mesaSeleccionada?.id) }}
          />
        ) : (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 0', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.4)' : '#888' }}>
                {mesas.filter(m => m.estado === 'ocupada').length} ocupadas &middot; {mesas.filter(m => m.estado === 'disponible' || m.estado === 'libre').length} libres
              </span>
            </div>
            <div style={{ ...s.gridMesas, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto' }}>
              {mesas.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: darkMode ? '#666' : '#999' }}>
                  <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800' }}>table_restaurant</span>
                  <p style={{ marginTop: '12px', fontSize: '14px' }}>No hay mesas registradas</p>
                </div>
              ) : (
                mesas.map((m) => {
                  const st = getEstado(m.estado)
                  return (
                    <div key={m.id} onClick={() => seleccionarMesa(m)} style={s.mesaCard(m, mesaSeleccionada?.id === m.id, darkMode)}>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: darkMode ? '#fff' : '#1a1a1a', lineHeight: 1.1 }}>{m.numero}</div>
                      <div style={{ fontSize: '10px', color: darkMode ? 'rgba(255,255,255,0.35)' : '#999', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span className="material-icons" style={{ fontSize: '12px' }}>{getAreaIcono(m.area)}</span>
                        {m.area || 'Principal'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#777' }}>
                        <span className="material-icons" style={{ fontSize: '13px' }}>group</span>
                        {m.capacidad || 4}
                      </div>
                      <div style={s.estadoBadge(m.estado)}>
                        {st.texto}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* PANEL LATERAL */}
        {vista === 'mesas' && (
          <div style={{
            ...s.panel(darkMode),
            width: isMobile && !isLandscape ? '100%' : isMobile ? 'min(60%, 460px)' : '320px',
            top: isMobile && !isLandscape ? '0' : '60px',
            height: isMobile && !isLandscape ? '100%' : 'calc(100vh - 60px)',
            zIndex: isMobile && !isLandscape ? 1200 : 100,
            borderLeft: isMobile && !isLandscape ? 'none' : undefined,
            boxShadow: isMobile && !isLandscape ? 'none' : undefined,
          }}>
            {mesaSeleccionada && (
              <>
                <div style={{ padding: '20px', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: darkMode ? '#fff' : '#1a1a1a' }}>
                        Mesa {mesaSeleccionada.numero}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={s.estadoBadge(mesaSeleccionada.estado)}>{getEstado(mesaSeleccionada.estado).texto}</span>
                        <span style={{ fontSize: '12px', color: darkMode ? 'rgba(255,255,255,0.35)' : '#888' }}>
                          {mesaSeleccionada.area || 'Sin área'}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => { setPanelAbierto(false); setMesaSeleccionada(null) }} style={{
                      width: '32px', height: '32px', border: 'none', borderRadius: '8px',
                      background: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      color: darkMode ? '#fff' : '#333', cursor: 'pointer', fontSize: '18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>&times;</button>
                  </div>
                </div>

                <div style={{ padding: '16px 20px', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FF9800', marginBottom: '10px' }}>Detalles</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.7)' : '#555' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: darkMode ? 'rgba(255,255,255,0.3)' : '#999' }}>group</span>
                      <span>1 a 6 personas</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: darkMode ? 'rgba(255,255,255,0.3)' : '#999' }}>{getAreaIcono(mesaSeleccionada.area)}</span>
                      <span style={{ textTransform: 'capitalize' }}>{mesaSeleccionada.area || 'Sin área'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-icons" style={{ fontSize: '16px', color: darkMode ? 'rgba(255,255,255,0.3)' : '#999' }}>schedule</span>
                      <span>{formatTime(mesaSeleccionada.tiempo_ocupado)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '16px 20px', borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FF9800', marginBottom: '10px' }}>Pedido</div>
                  {pedidosMesa.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: darkMode ? 'rgba(255,255,255,0.25)' : '#999' }}>
                      <span className="material-icons" style={{ fontSize: '32px', color: '#FF9800' }}>receipt_long</span>
                      <p style={{ marginTop: '8px', fontSize: '12px' }}>
                        {mesaSeleccionada.estado === 'ocupada' ? 'Cargando pedidos...' : 'Sin pedidos en esta mesa'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {pedidosMesa.map((pedido, idx) => (
                        <div key={pedido.id || idx} style={{ background: darkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: '10px', padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '700', color: '#FF9800', fontSize: '13px' }}>
                              #{pedido.numero_orden || pedido.id}
                            </span>
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '600',
                              background: pedido.estado === 'cocinando' ? 'rgba(251,192,45,0.2)' : pedido.estado === 'listo' ? 'rgba(76,175,80,0.2)' : pedido.estado === 'entregado' ? 'rgba(33,150,243,0.2)' : 'rgba(229,57,53,0.2)',
                              color: pedido.estado === 'cocinando' ? '#FBC02D' : pedido.estado === 'listo' ? '#4CAF50' : pedido.estado === 'entregado' ? '#2196F3' : '#E53935',
                            }}>
                              {pedido.estado === 'pendiente' ? 'Pendiente' : pedido.estado === 'cocinando' ? 'Cocinando' : pedido.estado === 'listo' ? 'Listo' : pedido.estado === 'entregado' ? 'Entregado' : pedido.estado}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: darkMode ? '#bbb' : '#555' }}>
                            {(pedido.items || []).map((item, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                                <span>{item.cantidad}x {item.producto_nombre || item.producto}</span>
                              </div>
                            ))}
                          </div>
                          {pedido.total && (
                            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '700', fontSize: '12px' }}>Total</span>
                              <span style={{ fontWeight: '700', color: '#4CAF50', fontSize: '13px' }}>{formatGuarani(pedido.total)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {pedido.estado === 'listo' ? (
                              <button onClick={() => { setPedidoAEntregar(pedido); setModalEntregar(true) }} style={{
                                flex: 1, padding: '6px', border: 'none', borderRadius: '6px',
                                background: '#4CAF50', color: 'white', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                              }}>✅ Entregar</button>
                            ) : pedido.estado === 'entregado' ? (
                              <span style={{ flex: 1, textAlign: 'center', padding: '6px', color: '#4CAF50', fontSize: '10px', fontWeight: '600' }}>✓ Entregado</span>
                            ) : null}
                            <button onClick={() => {
                              setPedidoParaEditar(pedido)
                              setVista('pedido')
                            }} style={{
                              flex: 1, padding: '6px', border: 'none', borderRadius: '6px',
                              background: '#1976D2', color: 'white', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                            }}>✏️ Editar</button>
                            <button onClick={() => { setPedidoACancelar(pedido); setModalCancelarConMotivo(true) }} style={{
                              flex: 1, padding: '6px', border: 'none', borderRadius: '6px',
                              background: '#E53935', color: 'white', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                            }}>❌ Cancelar</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ padding: '16px 20px', borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flexShrink: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={() => {
                      localStorage.setItem('mesa_seleccionada', JSON.stringify({ id: mesaSeleccionada.id, numero: mesaSeleccionada.numero }))
                      setVista('pedido')
                    }} style={{ ...s.btnPrimario(false), background: 'linear-gradient(135deg, #4CAF50, #388E3C)' }}>
                      <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>add_circle</span>
                      Nuevo Pedido
                    </button>
                    <button onClick={() => setModalCuenta(true)} style={{ ...s.btnPrimario(false), background: 'linear-gradient(135deg, #FF9800, #F57C00)' }}>
                      <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>receipt_long</span>
                      Cuenta
                    </button>
                    <button onClick={() => { setMesaNumero(String(mesaSeleccionada.numero)); setMesaArea(mesaSeleccionada.area || ''); setMesaCapacidad(String(mesaSeleccionada.capacidad || 4)); setModalEstado(true) }} style={{ ...s.btnPrimario(false), background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)' }}>
                      <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '4px' }}>swap_horiz</span>
                      Estado
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {vista === 'mesas' && (
        <>
          <div style={{ position: 'fixed', bottom: isMobile ? (isLandscape ? '56px' : '70px') : '20px', left: isMobile ? '12px' : '90px', display: 'flex', gap: '8px', zIndex: isMobile && isLandscape ? 300 : 200 }}>
            <button onClick={() => setModalCrear(true)} style={s.btnAction('#4CAF50', false)}>
              <span className="material-icons" style={{ fontSize: '22px' }}>add</span>
            </button>
            <button onClick={() => { if (mesaSeleccionada) { setMesaNumero(String(mesaSeleccionada.numero)); setMesaArea(mesaSeleccionada.area || ''); setMesaCapacidad(String(mesaSeleccionada.capacidad || 4)); setModalEditar(true) }}} disabled={!mesaSeleccionada} style={s.btnAction('#1976D2', !mesaSeleccionada)}>
              <span className="material-icons" style={{ fontSize: '22px' }}>edit</span>
            </button>
            <button onClick={() => mesaSeleccionada && confirmarBorrarMesa(mesaSeleccionada)} disabled={!mesaSeleccionada} style={s.btnAction('#E53935', !mesaSeleccionada)}>
              <span className="material-icons" style={{ fontSize: '22px' }}>delete</span>
            </button>
          </div>

          {/* Modal crear mesa */}
          {modalCrear && (
            <div style={s.modal(darkMode)}>
              <div style={s.modalCard(darkMode)} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 16px', color: darkMode ? '#fff' : '#1a1a1a', textAlign: 'center' }}>Nueva Mesa</h3>
                <input type="number" value={mesaNumero} onChange={(e) => setMesaNumero(e.target.value)} placeholder="N'mero de mesa" style={s.input(darkMode)} />
                <input type="text" value={mesaArea} onChange={(e) => setMesaArea(e.target.value)} placeholder="Área (ej: Principal, Patio, Tejado)" style={s.input(darkMode)} />
                <input type="number" value={mesaCapacidad} onChange={(e) => setMesaCapacidad(e.target.value)} placeholder="Capacidad" style={s.input(darkMode)} />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setModalCrear(false); setMesaNumero(''); setMesaArea(''); setMesaCapacidad('') }} style={s.btnSecundario(darkMode)}>Cancelar</button>
                  <button onClick={crearMesa} disabled={cargando || !mesaNumero} style={{ ...s.btnPrimario(cargando || !mesaNumero), background: 'linear-gradient(135deg, #4CAF50, #388E3C)' }}>
                    {cargando ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal ocupar mesa */}
          {modalOcupar && mesaSeleccionada && (
            <div style={s.modal(darkMode)}>
              <div style={s.modalCard(darkMode)}>
                <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(76,175,80,0.12)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-icons" style={{ fontSize: '28px', color: '#4CAF50' }}>check_circle</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>Mesa {mesaSeleccionada.numero}</h3>
                  <p style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', fontSize: '14px', margin: 0 }}>Ocupar esta mesa?</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button onClick={rechazarOcupar} style={s.btnSecundario(darkMode)}>Cancelar</button>
                  <button onClick={confirmarOcupar} disabled={cargando} style={{ ...s.btnPrimario(cargando), background: 'linear-gradient(135deg, #4CAF50, #388E3C)' }}>
                    {cargando ? 'Ocupando...' : 'Ocupar Mesa'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal editar mesa */}
          {modalEditar && mesaSeleccionada && (
            <div style={s.modal(darkMode)}>
              <div style={s.modalCard(darkMode)} onClick={e => e.stopPropagation()}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 16px', color: darkMode ? '#fff' : '#1a1a1a', textAlign: 'center' }}>Editar Mesa {mesaSeleccionada.numero}</h3>
                <input type="number" value={mesaNumero} onChange={(e) => setMesaNumero(e.target.value)} placeholder="N'mero" style={s.input(darkMode)} />
                <input type="text" value={mesaArea} onChange={(e) => setMesaArea(e.target.value)} placeholder="Área (ej: Principal, Patio, Tejado)" style={s.input(darkMode)} />
                <input type="number" value={mesaCapacidad} onChange={(e) => setMesaCapacidad(e.target.value)} placeholder="Capacidad" style={s.input(darkMode)} />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModalEditar(false)} style={s.btnSecundario(darkMode)}>Cancelar</button>
                  <button onClick={editarMesa} disabled={cargando} style={{ ...s.btnPrimario(cargando), background: 'linear-gradient(135deg, #1976D2, #1565C0)' }}>
                    {cargando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal cambiar estado */}
          {modalEstado && mesaSeleccionada && (
            <div style={s.modal(darkMode)}>
              <div style={s.modalCard(darkMode)}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a', textAlign: 'center' }}>Cambiar Estado</h3>
                <p style={{ textAlign: 'center', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', fontSize: '13px', marginBottom: '20px' }}>Mesa {mesaSeleccionada.numero}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[{ estado: 'disponible', label: 'Disponible', color: '#4CAF50', icono: 'check_circle' },
                    { estado: 'ocupada', label: 'Ocupada', color: '#E53935', icono: 'block' },
                    { estado: 'limpieza', label: 'Limpieza', color: '#FBC02D', icono: 'cleaning_services' }
                  ].map(({ estado, label, color, icono }) => (
                    <button key={estado} onClick={() => cambiarEstado(estado)}
                      disabled={cargando || mesaSeleccionada.estado === estado}
                      style={{
                        ...s.btnPrimario(cargando || mesaSeleccionada.estado === estado),
                        background: mesaSeleccionada.estado === estado
                          ? (darkMode ? '#2a2a2a' : '#e8e8e8')
                          : (darkMode ? `${color}22` : `${color}11`),
                        color: mesaSeleccionada.estado === estado
                          ? (darkMode ? 'rgba(255,255,255,0.3)' : '#999')
                          : color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      }}>
                      <span className="material-icons" style={{ fontSize: '18px' }}>{icono}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                  <button onClick={() => setModalEstado(false)} style={s.btnSecundario(darkMode)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal confirmar eliminar */}
          {modalConfirmar && (
            <div style={s.modal(darkMode)}>
              <div style={{ ...s.modalCard(darkMode), textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(229,57,53,0.12)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-icons" style={{ fontSize: '28px', color: '#E53935' }}>warning_amber</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>Eliminar Mesa?</h3>
                <p style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', fontSize: '13px', margin: '0 0 20px' }}>
                  Mesa {mesaAEliminar?.numero} - Esta acci&oacute;n no se puede deshacer
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={() => { setModalConfirmar(false); setMesaAEliminar(null) }} style={s.btnSecundario(darkMode)}>Cancelar</button>
                  <button onClick={borrarMesa} disabled={cargando} style={{ ...s.btnPrimario(cargando), background: 'linear-gradient(135deg, #E53935, #C62828)', maxWidth: '140px' }}>
                    {cargando ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Ver Pedido */}
          {mostrarPedidoModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <div style={{ background: darkMode ? '#1e1e1e' : 'white', borderRadius: '20px', padding: '24px', width: '90%', maxWidth: '450px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ color: darkMode ? '#fff' : '#1a1a1a', margin: 0, fontSize: '18px' }}>
                    Pedido - Mesa {mesaSeleccionada?.numero}
                  </h2>
                  <button onClick={() => setMostrarPedidoModal(false)} style={{ fontSize: '24px', border: 'none', background: 'none', cursor: 'pointer', color: darkMode ? '#fff' : '#333', padding: 0, lineHeight: 1 }}>&times;</button>
                </div>

                {pedidosMesa.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: darkMode ? '#666' : '#999' }}>
                    <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800' }}>receipt_long</span>
                    <p style={{ marginTop: '10px', fontSize: '14px' }}>No hay pedidos activos en esta mesa</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pedidosMesa.map((pedido, idx) => (
                      <div key={pedido.id || idx} style={{ background: darkMode ? '#2a2a2a' : '#f5f5f5', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '700', color: '#FF9800', fontSize: '15px' }}>
                            #{pedido.numero_orden || pedido.id}
                          </span>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                            background: pedido.estado === 'cocinando' ? 'rgba(251,192,45,0.2)' : pedido.estado === 'listo' ? 'rgba(76,175,80,0.2)' : 'rgba(229,57,53,0.2)',
                            color: pedido.estado === 'cocinando' ? '#FBC02D' : pedido.estado === 'listo' ? '#4CAF50' : '#E53935',
                          }}>
                            {pedido.estado === 'pendiente' ? 'Pendiente' : pedido.estado === 'cocinando' ? 'Cocinando' : pedido.estado === 'listo' ? 'Listo' : pedido.estado}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: darkMode ? '#bbb' : '#555' }}>
                          {(pedido.items || []).map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                              <span>{item.cantidad}x {item.producto_nombre || item.producto}</span>
                              <span style={{ fontWeight: '600' }}>{formatGuarani(item.cantidad * item.precio)}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: '700', fontSize: '13px' }}>Total</span>
                          <span style={{ fontWeight: '700', color: '#4CAF50', fontSize: '15px' }}>{formatGuarani(pedido.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={() => setMostrarPedidoModal(false)} style={s.btnSecundario(darkMode)}>Cerrar</button>
                  <button onClick={() => {
                    localStorage.setItem('mesa_seleccionada', JSON.stringify({ id: mesaSeleccionada.id, numero: mesaSeleccionada.numero }))
                    setVista('pedido')
                  }} style={{ ...s.btnPrimario(false), background: 'linear-gradient(135deg, #4CAF50, #388E3C)', maxWidth: '160px' }}>
                    Agregar Productos
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Cancelar con Motivo */}
          {modalCancelarConMotivo && pedidoACancelar && (
            <div style={s.modal(darkMode)}>
              <div style={{ ...s.modalCard(darkMode), maxWidth: '420px' }}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(229,57,53,0.12)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-icons" style={{ fontSize: '28px', color: '#E53935' }}>warning_amber</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>Cancelar Pedido</h3>
                  <p style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', fontSize: '13px', margin: '0' }}>
                    #{pedidoACancelar.numero_orden || pedidoACancelar.id}
                  </p>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: darkMode ? '#ccc' : '#666', display: 'block', marginBottom: '6px' }}>
                    Motivo de cancelación
                  </label>
                  <textarea
                    value={motivoCancelacion}
                    onChange={(e) => setMotivoCancelacion(e.target.value)}
                    placeholder="Ej: Cliente no tiene efectivo, Cliente ya no quiere el pedido, Error del mozo, etc."
                    style={{
                      width: '100%', padding: '12px', fontSize: '14px', borderRadius: '10px',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
                      background: darkMode ? '#2a2a2a' : '#f8f8f8', color: darkMode ? 'white' : '#1a1a1a',
                      outline: 'none', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setModalCancelarConMotivo(false); setMotivoCancelacion(''); setPedidoACancelar(null) }} style={s.btnSecundario(darkMode)}>Volver</button>
                  <button
                    onClick={async () => {
                      if (!pedidoACancelar || !motivoCancelacion.trim()) return
                      setCargando(true)
                      try {
                        const res = await fetch(`${API_URL}/pedidos/${pedidoACancelar.id}/cancelar`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ motivo: motivoCancelacion }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setModalCancelarConMotivo(false)
                          setMotivoCancelacion('')
                          setPedidoACancelar(null)
                          cargarPedidosMesa(mesaSeleccionada?.id)
                          loadMesas()
                        } else {
                          alert(data.error || 'Error al cancelar')
                        }
                      } catch (e) {
                        alert('Error de conexión')
                      }
                      setCargando(false)
                    }}
                    disabled={!motivoCancelacion.trim() || cargando}
                    style={{ ...s.btnPrimario(!motivoCancelacion.trim() || cargando), background: 'linear-gradient(135deg, #E53935, #C62828)' }}
                  >{cargando ? 'Cancelando...' : 'Confirmar Cancelación'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Entregar Pedido */}
          {modalEntregar && pedidoAEntregar && (
            <div style={s.modal(darkMode)}>
              <div style={{ ...s.modalCard(darkMode), maxWidth: '420px' }}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(76,175,80,0.12)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-icons" style={{ fontSize: '28px', color: '#4CAF50' }}>check_circle</span>
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>Entregar Pedido</h3>
                  <p style={{ color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', fontSize: '13px', margin: '0' }}>
                    #{pedidoAEntregar.numero_orden || pedidoAEntregar.id}
                  </p>
                </div>
                <p style={{ textAlign: 'center', color: darkMode ? '#ccc' : '#555', fontSize: '14px', margin: '0 0 20px' }}>
                  ¿Seguro que quieres entregar este pedido?
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setModalEntregar(false); setPedidoAEntregar(null) }} style={s.btnSecundario(darkMode)}>Cancelar</button>
                  <button
                    onClick={async () => {
                      if (!pedidoAEntregar) return
                      setCargando(true)
                      try {
                        const res = await fetch(`${API_URL}/pedidos/${pedidoAEntregar.id}/estado`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ estado: 'entregado' }),
                        })
                        const data = await res.json()
                        if (data.success) {
                          setModalEntregar(false)
                          setPedidoAEntregar(null)
                          cargarPedidosMesa(mesaSeleccionada?.id)
                          loadMesas()
                        } else {
                          alert(data.error || 'Error al entregar')
                        }
                      } catch (e) {
                        alert('Error de conexión')
                      }
                      setCargando(false)
                    }}
                    disabled={cargando}
                    style={{ ...s.btnPrimario(cargando), background: 'linear-gradient(135deg, #4CAF50, #388E3C)' }}
                  >{cargando ? 'Entregando...' : 'Sí, entregar'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Cuenta */}
          {modalCuenta && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <style>{estilosImpresionBluetooth}</style>
              <div style={{ background: darkMode ? '#1e1e1e' : 'white', borderRadius: '20px', padding: '28px', width: '90%', maxWidth: '480px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                <div id="cuenta-print">
                {(() => {
                  const items = []
                  pedidosMesa.forEach(p => {
                    (p.items || []).forEach(item => items.push(item))
                  })

                  const grupos = {}
                  items.forEach(item => {
                    const key = (item.producto_nombre || item.producto || '') + '|' + (item.variante || '')
                    if (grupos[key]) {
                      grupos[key].cantidad += item.cantidad
                      if (item.nota && grupos[key].notas.indexOf(item.nota) === -1) {
                        grupos[key].notas.push(item.nota)
                      }
                    } else {
                      grupos[key] = {
                        cantidad: item.cantidad,
                        nombre: item.producto_nombre || item.producto,
                        precio: parseFloat(item.precio) || 0,
                        variante: item.variante,
                        notas: item.nota ? [item.nota] : [],
                      }
                    }
                  })

                  let subtotal = 0
                  let iva10 = 0
                  let iva5 = 0
                  Object.values(grupos).forEach(g => {
                    const total = g.cantidad * g.precio
                    subtotal += total
                    const tipoIva = g.iva || 10
                    if (tipoIva === 5) iva5 += total * 0.05
                    else iva10 += total * 0.10
                  })

                  const meseroNombre = pedidosMesa[0]?.mesero_nombre || ''
                  const created = pedidosMesa[0]?.created_at || ''
                  const fechaStr = created
                    ? new Date(created).toLocaleDateString('es-ES') + ' ' + new Date(created).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : ''

                  return (
                    <>
                      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>
                          {empresa.nombre || 'RESTAURANTE'}
                        </h2>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#FF9800', letterSpacing: '2px', marginBottom: '12px' }}>
                          *** C U E N T A ***
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#000', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          {mesaSeleccionada?.numero && <span>Mesa: {mesaSeleccionada.numero}</span>}
                          {meseroNombre && <span>Mozo: {meseroNombre}</span>}
                          {fechaStr && <span>{fechaStr}</span>}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #000', marginBottom: '12px' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', fontWeight: 'bold', color: '#000', borderBottom: '2px solid #000', marginBottom: '8px' }}>
                        <span style={{ flex: '0 0 30px', fontWeight: 'bold' }}>Cant</span>
                        <span style={{ flex: 1, fontWeight: 'bold' }}>Producto</span>
                        <span style={{ flex: '0 0 70px', textAlign: 'right', fontWeight: 'bold' }}>Precio</span>
                        <span style={{ flex: '0 0 80px', textAlign: 'right', fontWeight: 'bold' }}>Total</span>
                      </div>

                      {Object.values(grupos).map((g, i) => (
                        <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #000' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', color: '#000' }}>
                            <span style={{ flex: '0 0 30px', fontWeight: 'bold' }}>{g.cantidad}x</span>
                            <span style={{ flex: 1, fontWeight: 'bold', color: '#000' }}>{g.nombre}</span>
                            <span style={{ flex: '0 0 70px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>{formatGuarani(g.precio)}</span>
                            <span style={{ flex: '0 0 80px', textAlign: 'right', fontWeight: 'bold', color: '#000' }}>{formatGuarani(g.cantidad * g.precio)}</span>
                          </div>
                          {g.variante && (
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', paddingLeft: '30px' }}>+ {g.variante}</div>
                          )}
                          {g.notas.map((n, j) => n ? <div key={j} style={{ fontSize: '11px', fontWeight: 'bold', color: '#000', fontStyle: 'italic', paddingLeft: '30px' }}>&gt;&gt; {n}</div> : null)}
                        </div>
                      ))}

                      <div style={{ borderTop: '2px solid #000', marginTop: '12px', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#000', padding: '2px 0' }}>
                          <span>Subtotal</span>
                          <span>{formatGuarani(subtotal)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#000', padding: '2px 0' }}>
                          <span>IVA 10%</span>
                          <span>{formatGuarani(iva10)}</span>
                        </div>
                        {iva5 > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#000', padding: '2px 0' }}>
                            <span>IVA 5%</span>
                            <span>{formatGuarani(iva5)}</span>
                          </div>
                        )}
                        <div style={{ borderTop: '2px solid #000', marginTop: '4px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
                          <span>TOTAL Gs.</span>
                          <span>{formatGuarani(subtotal + iva10 + iva5)}</span>
                        </div>
                      </div>

                      <div className="no-print" style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => setModalCuenta(false)} style={s.btnSecundario(darkMode)}>Cerrar</button>
                        <button onClick={handlePrintBluetooth} style={{ ...s.btnPrimario(false), background: 'linear-gradient(135deg, #FF9800, #F57C00)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span className="material-icons" style={{ fontSize: '16px' }}>print</span>
                          Imprimir
                        </button>
                      </div>
                    </>
                  )
                })()}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
