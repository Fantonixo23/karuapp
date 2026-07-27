import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'
import { useRealTime } from '../store/useSocketStore'
import ComandaTicket from '../components/ComandaTicket'

import { getApiUrl } from '../utils/api'
const API_URL = getApiUrl()

const FILTROS = [
  { key: 'todo', label: 'Todo', color: '#666' },
  { key: 'pendiente', label: 'Pendiente', color: '#E53935' },
  { key: 'cocinando', label: 'Preparando', color: '#FBC02D' },
  { key: 'listo', label: 'Listo', color: '#4CAF50' }
]

export default function Cocina() {
  const [pedidos, setPedidos] = useState([])
  const [pedidosMostrar, setPedidosMostrar] = useState([])
  const [filtro, setFiltro] = useState('todo')
  const [busqueda, setBusqueda] = useState('')
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null)
  const [modalConfirmar, setModalConfirmar] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [imprimiendo, setImprimiendo] = useState(null)
  const [modalCancelar, setModalCancelar] = useState(null)
  const [motivoCancelacionCocina, setMotivoCancelacionCocina] = useState('')
  const [comandaMostrar, setComandaMostrar] = useState(null)
  const [hora, setHora] = useState(new Date())
  
  // WebSocket en tiempo real
  const { initSocket, lastUpdate, cocinaNotifications, connected, clearNotifications } = useRealTime()

  useEffect(() => {
    initSocket()
    initDarkMode()
    syncDarkMode()
    loadPedidos()
    const interval = setInterval(loadPedidos, 15000)
    return () => clearInterval(interval)
  }, [])

  // Aplicar filtros cuando cambian pedidos, filtro o búsqueda
  useEffect(() => {
    let filtrados = pedidos

    // Aplicar filtro de estado
    if (filtro === 'todo') {
      filtrados = filtrados.filter(p => p.estado !== 'listo')
    } else {
      filtrados = filtrados.filter(p => p.estado === filtro)
    }

    // Aplicar búsqueda por número de orden
    if (busqueda.trim()) {
      const busq = busqueda.toLowerCase()
      filtrados = filtrados.filter(p => 
        (p.numero_orden && p.numero_orden.toLowerCase().includes(busq))
      )
    }

    setPedidosMostrar(filtrados)
  }, [pedidos, filtro, busqueda])
  
  // Escuchar nuevos pedidos en tiempo real
  useEffect(() => {
    if (lastUpdate?.type === 'cocina') {
      loadPedidos()
    }
  }, [lastUpdate])

  useEffect(() => {
    if (lastUpdate?.type === 'pedido_modificado' || lastUpdate?.type === 'pedido') {
      loadPedidos()
    }
  }, [lastUpdate])

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  
  // Escuchar modificaciones de pedidos en tiempo real
  useEffect(() => {
    if (lastUpdate?.type === 'pedido_modificado') {
      console.log('🔔 Pedido modificado:', lastUpdate.data)
      loadPedidos()
    }
  }, [lastUpdate])
  
  // Cuando hay notificaciones de cocina
  useEffect(() => {
    if (cocinaNotifications.length > 0) {
      console.log('📡 Nuevo pedido recibido')
      loadPedidos()
    }
  }, [cocinaNotifications])

  const loadPedidos = async () => {
    try {
      setError(null)
      let url = `${API_URL}/cocina/pedidos/`
      const params = new URLSearchParams()
      if (filtro !== 'todo') params.append('estado', filtro)
      if (busqueda.trim()) params.append('buscar', busqueda.trim())
      if (params.toString()) url += '?' + params.toString()
      
      const res = await fetch(url)
      if (!res.ok) { setPedidos([]); return }
      const data = await res.json()
      if (data.success) {
        console.log('Pedidos cargados:', data.pedidos?.length)
        setPedidos(data.pedidos || [])
      } else {
        setPedidos([])
      }
    } catch (e) {
      setError('Error de conexión')
    }
  }

  // Recargar cuando cambie el filtro o búsqueda
  useEffect(() => {
    loadPedidos()
  }, [filtro])

  const getEstadoColor = (estado) => {
    if (estado === 'cocinando') return { border: '#FBC02D', texto: 'Cocinando', color: '#FBC02D' }
    if (estado === 'listo') return { border: '#4CAF50', texto: 'Listo', color: '#4CAF50' }
    return { border: '#E53935', texto: 'Pendiente', color: '#E53935' }
  }

  const cambiarEstado = async (nuevoEstado) => {
    if (!pedidoSeleccionado) return
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/cocina/pedidos/${pedidoSeleccionado.id}/estado/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (data.success) {
        setModalConfirmar(false)
        // Actualizar el pedido en la lista sin eliminarlo
        setPedidos(pedidos.map(p => 
          p.id === pedidoSeleccionado.id 
            ? { ...p, estado: nuevoEstado }
            : p
        ))
        setPanelAbierto(false)
        setPedidoSeleccionado(null)
      } else {
        setError(data.error || 'Error al cambiar estado')
      }
    } catch (e) {
      setError('Error de conexión')
    }
    setCargando(false)
  }

  const imprimirComanda = async (pedido) => {
    setImprimiendo(pedido.id)
    try {
      // Mostrar el modal de comanda
      setComandaMostrar(pedido)
    } catch (e) {
      setError('Error al imprimir')
    }
    setImprimiendo(null)
  }

  const cancelarPedido = async (pedido) => {
    if (!pedido) return
    setCargando(true)
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedido.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoCancelacionCocina })
      })
      const data = await res.json()
      if (data.success) {
        setPedidos(pedidos.filter(p => p.id !== pedido.id))
        setModalCancelar(null)
        setMotivoCancelacionCocina('')
      } else {
        setError(data.error || 'Error al cancelar')
      }
    } catch (e) {
      setError('Error de conexión')
    }
    setCargando(false)
  }

  const fechaStr = hora.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const horaStr = hora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })

  const seleccionarPedido = (pedido) => {
    setPedidoSeleccionado(pedido)
    setPanelAbierto(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#121212' : '#f0f2f5', color: darkMode ? '#fff' : '#1a1a1a', overflow: 'hidden' }}>
      <header style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between',
        padding: isMobile ? '8px 12px' : '10px 20px',
        background: '#1a1a1a', color: 'white',
        borderBottom: '1px solid rgba(255,152,0,0.2)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        gap: isMobile ? '8px' : '0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link to="/app/inicio" style={{ width: '34px', height: '34px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              <span className="material-icons">home</span>
            </Link>
            <img src="/logo.png" alt="karuAPP" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
            <span style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', letterSpacing: '0.5px' }}>Cocina</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right', marginRight: '2px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#FF9800', lineHeight: 1.2 }}>{horaStr}</div>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{fechaStr}</div>
            </div>
            {!isMobile && <FullscreenButton />}
            <button onClick={toggleDarkMode} style={{ width: '34px', height: '34px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-icons" style={{ fontSize: '18px' }}>{darkMode ? 'dark_mode' : 'light_mode'}</span>
            </button>
          </div>
        </div>
        
        {/* Buscador y filtros — segunda fila en mobile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: '2px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <input
            type="text"
            placeholder="Buscar #orden..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPedidos()}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '13px',
              width: isMobile ? '100px' : '120px',
              minWidth: isMobile ? '80px' : '100px',
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              outline: 'none', flexShrink: 0,
            }}
          />
          <button onClick={loadPedidos} style={{ width: '32px', height: '32px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-icons" style={{ fontSize: '16px' }}>search</span>
          </button>
          {FILTROS.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                background: filtro === f.key ? f.color : 'rgba(255,255,255,0.08)',
                color: filtro === f.key ? (f.key === 'cocinando' ? '#1a1a1a' : 'white') : 'rgba(255,255,255,0.7)',
                transition: 'all 0.15s'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {error && <div style={{ padding: '10px', background: '#E53935', color: 'white', textAlign: 'center' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/cocina" />

        <div style={{ flex: 1, padding: isMobile ? '10px' : '15px', overflowY: 'auto' }}>
          {pedidosMostrar.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ marginTop: '16px', fontSize: '24px', fontWeight: '600', color: darkMode ? '#aaa' : '#888' }}>
                {pedidos.length === 0 ? 'No hay pedidos en cocina' : 'No hay pedidos con ese filtro'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
              {pedidosMostrar.map((p) => (
                <div 
                  key={p.id}
                  onClick={() => seleccionarPedido(p)}
                  style={{
                    background: darkMode ? '#1e1e1e' : 'white',
                    borderRadius: '14px',
                    padding: '15px',
                    minHeight: '230px',
                    border: `1px solid ${getEstadoColor(p.estado).border}30`,
                    cursor: 'pointer',
                    boxShadow: darkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '24px', fontWeight: '900', color: '#1a1a1a' }}>#{p.numero_orden || p.id}</span>
                    {p.tipo_pedido === 'venta' ? (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#FF6D00', background: '#FFF3E0', padding: '4px 8px', borderRadius: '4px' }}>
                        VENTA {p.nombre_cliente ? `- ${p.nombre_cliente}` : ''}
                      </span>
                    ) : p.tipo_pedido === 'delivery' ? (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#2196F3', background: '#E3F2FD', padding: '4px 8px', borderRadius: '4px' }}>
                        DELIVERY {p.nombre_cliente ? `- ${p.nombre_cliente}` : ''}
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#4CAF50', background: '#E8F5E9', padding: '4px 8px', borderRadius: '4px' }}>
                        🍽️ Mesa {p.mesa || '?'}
                      </span>
                    )}
                  </div>

                  {p.notas && (
                    <div style={{ fontSize: '12px', color: '#E53935', fontWeight: '600', marginBottom: '8px', fontStyle: 'italic' }}>
                      Notas: {p.notas}
                    </div>
                  )}

                  <div style={{ flex: 1, background: darkMode ? '#1a1a1a' : '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' }}>Pedido:</div>
                    {(!p.items || p.items.length === 0) ? (
                      <div style={{ color: '#E53935', fontSize: '12px' }}>Sin items</div>
                    ) : (
                      p.items.slice(0, 5).map((item, i) => (
                        <div key={i} style={{ fontSize: '14px', marginBottom: '6px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                          <span style={{ color: '#4CAF50', fontWeight: '700' }}>{item.cantidad}x </span>
                          <span style={{ fontWeight: '600' }}>{item.producto_nombre || item.producto}</span>
                          {item.categoria_nombre && (
                            <span style={{ fontSize: '9px', color: '#888', marginLeft: '6px', fontWeight: '400' }}>
                              ({item.categoria_nombre})
                            </span>
                          )}
                          {item.variante && (
                            <div style={{ fontSize: '11px', color: '#F57C00', fontWeight: '600', marginTop: '1px' }}>
                              ▸ {item.variante}
                            </div>
                          )}
                          {item.nota && (
                            <div style={{ fontSize: '11px', color: '#FF9800', fontStyle: 'italic', marginTop: '2px' }}>
                              📝 {item.nota}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {p.items && p.items.length > 5 && (
                      <div style={{ fontSize: '12px', color: '#FF9800', marginTop: '4px' }}>+{p.items.length - 5} más</div>
                    )}
                  </div>

                  <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: getEstadoColor(p.estado).color }}>
                      ● {getEstadoColor(p.estado).texto}
                    </span>
                    {p.created_at && (
                      <span style={{ fontSize: '11px', color: '#888' }}>
                        {new Date(p.created_at).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); imprimirComanda(p) }}
                      disabled={imprimiendo === p.id}
                      style={{
                        padding: '8px',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#2196F3',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        opacity: imprimiendo === p.id ? 0.5 : 1
                      }}
                    >
                      🖨️ Imprimir
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setModalCancelar(p) }}
                      style={{
                        padding: '8px',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#E53935',
                        color: 'white',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panel Lateral */}
      {panelAbierto && pedidoSeleccionado && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '0' : '64px',
          left: isMobile ? '0' : 'auto',
          right: 0,
          width: isMobile ? '100%' : '320px',
          height: isMobile ? '100%' : 'calc(100vh - 64px)',
          background: darkMode ? '#1e1e1e' : 'white',
          borderLeft: isMobile ? 'none' : `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          padding: isMobile ? '16px' : '20px',
          paddingBottom: isMobile ? '70px' : '20px',
          overflowY: 'auto',
          zIndex: isMobile ? 1200 : 'auto',
          boxShadow: isMobile ? 'none' : '-4px 0 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: '900' }}>#{pedidoSeleccionado.numero_orden || pedidoSeleccionado.id}</h2>
              <span style={{ color: '#666' }}>{pedidoSeleccionado.delivery ? '🏍️ Delivery' : `Mesa ${pedidoSeleccionado.mesa}`}</span>
            </div>
            <button onClick={() => { setPanelAbierto(false); setPedidoSeleccionado(null) }} style={{ fontSize: '30px', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
          </div>

          <h3 style={{ color: '#4CAF50', fontSize: '14px', marginBottom: '10px' }}>PEDIDO</h3>
          {(pedidoSeleccionado.items || []).map((item, i) => (
            <div key={i} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>
                <strong>{item.cantidad}x</strong> {item.producto_nombre || item.producto}
                {item.categoria_nombre && (
                  <span style={{ fontSize: '10px', color: '#888', marginLeft: '6px', fontWeight: '400' }}>
                    ({item.categoria_nombre})
                  </span>
                )}
              </div>
              {item.variante && (
                <div style={{ fontSize: '12px', color: '#F57C00', fontWeight: '600', marginTop: '2px' }}>
                  ▸ {item.variante}
                </div>
              )}
              {item.nota && (
                <div style={{ fontSize: '11px', color: '#FF9800', fontStyle: 'italic', marginTop: '1px' }}>
                  📝 {item.nota}
                </div>
              )}
            </div>
          ))}

          <div style={{ marginTop: '20px', display: 'grid', gap: '10px' }}>
            <button onClick={() => cambiarEstado('pendiente')} disabled={cargando} style={{ padding: '14px', border: 'none', borderRadius: '10px', background: '#E53935', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
              ⏳ Pendiente
            </button>
            <button onClick={() => cambiarEstado('cocinando')} disabled={cargando} style={{ padding: '14px', border: 'none', borderRadius: '10px', background: '#FBC02D', color: '#333', fontWeight: '700', cursor: 'pointer' }}>
              👨‍🍳 Preparando
            </button>
            <button onClick={() => setModalConfirmar(true)} disabled={cargando} style={{ padding: '14px', border: 'none', borderRadius: '10px', background: '#4CAF50', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
              ✅ Listo!
            </button>
          </div>
        </div>
      )}

      {/* Modal Confirmar */}
      {modalConfirmar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: darkMode ? '#1e1e1e' : 'white', padding: '28px', borderRadius: '20px', textAlign: 'center', width: '90%', maxWidth: '360px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <h2 style={{ marginBottom: '15px', fontSize: '18px', color: darkMode ? '#fff' : '#1a1a1a' }}>¿Marcar como Listo?</h2>
            <p style={{ color: darkMode ? '#aaa' : '#666', marginBottom: '20px', fontSize: '14px' }}>#{pedidoSeleccionado?.numero_orden}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setModalConfirmar(false)} style={{ padding: '12px 24px', border: 'none', borderRadius: '10px', background: darkMode ? '#2a2a2a' : '#e8e8e8', color: darkMode ? '#ccc' : '#333', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={() => cambiarEstado('listo')} disabled={cargando} style={{ padding: '12px 24px', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg, #4CAF50, #388E3C)', color: 'white', fontWeight: '700', cursor: 'pointer' }}>
                {cargando ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar Pedido */}
      {modalCancelar && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: darkMode ? '#1e1e1e' : 'white', padding: '28px', borderRadius: '20px', maxWidth: '400px', width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: '0 0 4px', color: '#E53935', fontSize: '18px' }}>Cancelar Pedido</h2>
              <p style={{ fontWeight: '700', fontSize: '16px', color: darkMode ? '#fff' : '#1a1a1a', margin: '4px 0 0' }}>#{modalCancelar.numero_orden} - Mesa {modalCancelar.mesa}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: darkMode ? '#aaa' : '#666', display: 'block', marginBottom: '6px' }}>
                Motivo de cancelación
              </label>
              <textarea
                value={motivoCancelacionCocina}
                onChange={(e) => setMotivoCancelacionCocina(e.target.value)}
                placeholder="Ej: Cliente canceló, Sin stock, etc."
                style={{
                  width: '100%', padding: '10px', fontSize: '13px', borderRadius: '10px',
                  border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  background: darkMode ? '#2a2a2a' : '#f5f5f5',
                  color: darkMode ? 'white' : '#333', outline: 'none', resize: 'vertical',
                  minHeight: '60px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => { setModalCancelar(null); setMotivoCancelacionCocina('') }} style={{ padding: '12px 20px', border: 'none', borderRadius: '10px', background: darkMode ? '#2a2a2a' : '#e8e8e8', color: darkMode ? '#ccc' : '#333', cursor: 'pointer', fontWeight: '600', flex: 1 }}>Volver</button>
              <button onClick={() => cancelarPedido(modalCancelar)} disabled={cargando || !motivoCancelacionCocina.trim()} style={{
                padding: '12px 20px', border: 'none', borderRadius: '10px',
                background: (!motivoCancelacionCocina.trim() || cargando) ? (darkMode ? '#555' : '#ccc') : '#E53935',
                color: 'white', fontWeight: '700', cursor: (!motivoCancelacionCocina.trim() || cargando) ? 'not-allowed' : 'pointer', flex: 1,
              }}>
                {cargando ? '...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comanda para imprimir */}
      {comandaMostrar && (
        <ComandaTicket
          pedido={comandaMostrar}
          onClose={() => setComandaMostrar(null)}
        />
      )}

    </div>
  )
}
