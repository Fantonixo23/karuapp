import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'
import { formatGuarani } from '../utils/currency'

import { getApiUrl } from '../utils/api'
import { printDeliveryTicket } from '../utils/qzPrint'
const API_URL = getApiUrl()

const estilosAnimados = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-up { animation: fadeInUp 0.5s ease-out forwards; }
  .animate-pulse-fast { animation: pulse 1s infinite; }
  .animate-scale { animation: scaleIn 0.3s ease-out forwards; }
`

const ESTADOS = {
  pendiente: { color: '#FBC02D', label: 'Pendiente', icono: 'schedule' },
  cocinando: { color: '#1976D2', label: 'Preparando', icon: 'restaurant' },
  listo: { color: '#4CAF50', label: 'Listo para Entregar', icon: 'check_circle' },
  en_camino: { color: '#FF9800', label: 'En Camino', icon: 'local_shipping' },
  entregado: { color: '#7B1FA2', label: 'Entregado', icon: 'done_all' },
  cancelado: { color: '#E53935', label: 'Cancelado', icon: 'cancel' },
  pagado: { color: '#00BCD4', label: 'Pagado', icon: 'payments' }
}

export default function Delivery() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  const [dashboard, setDashboard] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(null)
  const [carrito, setCarrito] = useState([])
  const [cliente, setCliente] = useState({ nombre: '', telefono: '', direccion: '', notas: '' })
  const audioRef = useRef(null)
  const [hora, setHora] = useState(new Date())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [modalProducto, setModalProducto] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [variante, setVariante] = useState(null)
  const [nota, setNota] = useState('')
  const [empresa, setEmpresa] = useState({ nombre: '', logo: '' })
  const [editandoPedido, setEditandoPedido] = useState(null)
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    initDarkMode()
    syncDarkMode()
    cargarDatosEmpresa()
    const savedLogo = localStorage.getItem('pipper_logo_base64')
    if (savedLogo) setEmpresa(prev => ({ ...prev, logo: savedLogo }))
  }, [])

  const cargarDatosEmpresa = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/config`)
      const data = await res.json()
      if (data.success && data.config) {
        setEmpresa(prev => ({ ...prev, nombre: data.config.nombre_empresa || '' }))
      }
    } catch (e) {
      console.error('Error cargando empresa:', e)
    }
  }

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    cargarDatos()
    const interval = setInterval(cargarDatos, 8000)
    return () => clearInterval(interval)
  }, [filtroEstado])

  const cargarDatos = async () => {
    try {
      const [resDash, resPedidos, resProductos] = await Promise.all([
        fetch(`${API_URL}/pedidos/delivery/dashboard`),
        fetch(`${API_URL}/pedidos?delivery=true`),
        fetch(`${API_URL}/productos`)
      ])
      
      const dataDash = await resDash.json()
      const dataPedidos = await resPedidos.json()
      const dataProductos = await resProductos.json()
      
      if (dataDash.success) setDashboard(dataDash.data)
      if (dataPedidos.success) setPedidos(dataPedidos.pedidos || [])
      if (dataProductos.success) setProductos(dataProductos.productos || [])
    } catch (e) {
      console.error('Error:', e)
    }
    setCargando(false)
  }

  const cambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedidoId}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      })
      const data = await res.json()
      if (data.success) {
        cargarDatos()
      }
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const agregarAlCarrito = (producto, { variante: varSel, nota: prodNota, cantidad: cant } = {}) => {
    const cantFinal = cant || 1
    let precioExtra = 0
    if (varSel && producto.variantes && Array.isArray(producto.variantes)) {
      const v = producto.variantes.find(x => typeof x === 'string' ? x === varSel : x.nombre === varSel)
      if (v && typeof v === 'object' && v.precio_extra) precioExtra = parseFloat(v.precio_extra)
    }
    const precioUnitario = parseFloat(producto.precio) + precioExtra
    const key = `${producto.id}_${varSel || ''}`
    const existente = carrito.find(p => `${p.producto_id}_${p.variante || ''}` === key)
    if (existente) {
      setCarrito(carrito.map(p => 
        `${p.producto_id}_${p.variante || ''}` === key
          ? { ...p, cantidad: p.cantidad + cantFinal }
          : p
      ))
    } else {
      setCarrito([...carrito, {
        producto_id: producto.id,
        producto_nombre: producto.nombre,
        cantidad: cantFinal,
        precio: precioUnitario,
        variante: varSel || null,
        nota: prodNota || '',
      }])
    }
  }

  const quitarDelCarrito = (productoId, variante = null) => {
    const key = `${productoId}_${variante || ''}`
    const existente = carrito.find(p => `${p.producto_id}_${p.variante || ''}` === key)
    if (existente && existente.cantidad > 1) {
      setCarrito(carrito.map(p => 
        `${p.producto_id}_${p.variante || ''}` === key
          ? { ...p, cantidad: p.cantidad - 1 }
          : p
      ))
    } else {
      setCarrito(carrito.filter(p => `${p.producto_id}_${p.variante || ''}` !== key))
    }
  }

  const abrirEdicion = (pedido) => {
    setEditandoPedido(pedido)
    setCliente({
      nombre: pedido.nombre_cliente || '',
      telefono: pedido.telefono_cliente || '',
      direccion: pedido.direccion || '',
      notas: pedido.notas || '',
    })
    setCarrito(pedido.items?.map(item => ({
      producto_id: item.producto_id,
      producto_nombre: item.producto_nombre,
      cantidad: item.cantidad,
      precio: item.precio,
      variante: item.variante || null,
      nota: item.nota || '',
    })) || [])
    setModalNuevo(true)
  }

  const cerrarModal = () => {
    setModalNuevo(false)
    setEditandoPedido(null)
    setCarrito([])
    setCliente({ nombre: '', telefono: '', direccion: '', notas: '' })
  }

  const [guardando, setGuardando] = useState(false)

  const guardarPedido = async () => {
    if (!cliente.nombre || !carrito.length || guardando) return
    
    setGuardando(true)
    try {
      let res
      if (editandoPedido) {
        res = await fetch(`${API_URL}/pedidos/${editandoPedido.id}/items/reemplazar`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: carrito,
            nombre_cliente: cliente.nombre,
            telefono_cliente: cliente.telefono,
            direccion: cliente.direccion,
            notas: cliente.notas,
          })
        })
      } else {
        res = await fetch(`${API_URL}/pedidos/crear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delivery: true,
            tipo_pedido: 'delivery',
            nombre_cliente: cliente.nombre,
            telefono_cliente: cliente.telefono,
            direccion: cliente.direccion,
            notas: cliente.notas,
            items: carrito,
          })
        })
      }
      const data = await res.json()
      if (data.success) {
        cerrarModal()
        cargarDatos()
      } else {
        alert('Error: ' + (data.error || 'Error desconocido'))
      }
    } catch (e) {
      console.error('Error:', e)
      alert('Error de conexión: ' + e.message)
    }
    setGuardando(false)
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.cantidad * item.precio), 0)

  const fechaStr = hora.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const horaStr = hora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
  const pedidosFiltrados = filtroEstado === 'todos' 
    ? pedidos.filter(p => !['entregado', 'pagado', 'cancelado'].includes(p.estado))
    : pedidos.filter(p => p.estado === filtroEstado)

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
    title: {
      fontSize: '22px',
      fontWeight: '800',
      letterSpacing: '0.5px'
    },
    kpiCard: (dm, color) => ({
      borderRadius: '14px',
      padding: '18px',
      textAlign: 'center',
      border: `1px solid ${color}30`,
      background: dm ? '#1e1e1e' : 'white',
      boxShadow: dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
    }),
    filtro: (dm, activo) => ({
      padding: '8px 16px',
      border: 'none',
      borderRadius: '8px',
      background: activo ? `${ESTADOS[Object.keys(ESTADOS).find(k => k === activo) || 'pendiente']?.color}30` : (dm ? '#2a2a2a' : '#e8e8e8'),
      color: activo ? (ESTADOS[Object.keys(ESTADOS).find(k => k === activo)]?.color || '#FF9800') : (dm ? '#ccc' : '#666'),
      fontSize: '13px',
      cursor: 'pointer',
      fontWeight: '600',
      transition: 'all 0.15s'
    }),
    pedidoCard: (dm, pedido) => ({
      borderRadius: '14px',
      padding: '18px',
      border: `1px solid ${ESTADOS[pedido.estado]?.color || '#666'}30`,
      background: dm ? '#1e1e1e' : 'white',
      cursor: 'pointer',
      transition: 'all 0.15s',
      boxShadow: dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
    }),
    productoBtn: (dm) => ({
      padding: '10px 8px',
      border: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      borderRadius: '10px',
      background: dm ? '#1e1e1e' : 'white',
      color: dm ? '#fff' : '#1a1a1a',
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'all 0.15s',
      textAlign: 'center',
      minHeight: '60px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }),
    modal: (dm) => ({
      background: dm ? '#1e1e1e' : 'white',
      borderRadius: '20px',
      padding: '28px',
      width: '95%',
      maxWidth: '500px',
      zIndex: 200,
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
    }),
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
      marginBottom: '10px',
      transition: 'border 0.15s',
    }),
    btnPrimary: (disabled) => ({
      padding: '12px',
      border: 'none',
      borderRadius: '10px',
      fontWeight: '700',
      fontSize: '14px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      color: 'white',
      background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
    }),
    estadoBadge: (estado) => ({
      padding: '2px 8px',
      borderRadius: '6px',
      fontSize: '10px',
      fontWeight: '600',
      background: (ESTADOS[estado]?.color || '#666') + '20',
      color: ESTADOS[estado]?.color || '#666',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    })
  }

  const kpis = dashboard ? [
    { label: 'Pendientes', valor: dashboard.pendientes, color: '#FBC02D', estado: 'pendiente' },
    { label: 'Preparando', valor: dashboard.preparando, color: '#1976D2', estado: 'cocinando' },
    { label: 'Listos', valor: dashboard.listos, color: '#4CAF50', estado: 'listo' },
    { label: 'En Camino', valor: dashboard.en_camino, color: '#FF9800', estado: 'en_camino' },
    { label: 'Entregados', valor: dashboard.entregados, color: '#7B1FA2', estado: 'entregado' },
    { label: 'Hoy', valor: formatGuarani(dashboard.total_hoy || 0), color: '#00BCD4', esMoneda: true }
  ] : []

  return (
    <div style={{ ...s.container(darkMode), display: 'flex', flexDirection: 'column' }}>
      <style>{estilosAnimados}</style>
      
      <header style={{ ...s.header, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={s.btnHeader}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={s.title}>Delivery</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', marginRight: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#FF9800', lineHeight: 1.2 }}>{horaStr}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{fechaStr}</div>
          </div>
          <FullscreenButton />
          <button onClick={toggleDarkMode} style={s.btnHeader}><span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span></button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/delivery" />
        
        <div style={{ padding: isMobile ? '12px' : '20px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '20px' }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '100px' }}>
              <div style={{ width: '60px', height: '60px', margin: '0 auto', border: '4px solid #43A047', borderTop: '4px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '20px', color: darkMode ? '#888' : '#666' }}>Cargando delivery...</p>
            </div>
          ) : (
            <>
              {/* KPIs ANIMADOS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' }}>
                {kpis.map((kpi, index) => (
                  <div 
                    key={index}
                    className="animate-fade-up"
                    style={{ 
                      ...s.kpiCard(darkMode, kpi.color),
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: '32px', color: kpi.color, marginBottom: '8px' }}>
                      {kpi.esMoneda ? 'attach_money' : ESTADOS[kpi.estado]?.icono || 'inventory'}
                    </span>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: kpi.color, margin: 0 }}>{kpi.valor}</p>
                    <p style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#666', marginTop: '5px' }}>{kpi.label}</p>
                  </div>
                ))}
              </div>

              {/* FILTROS DE ESTADO */}
<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  onClick={() => setFiltroEstado('todos')}
                  style={{ ...s.filtro(darkMode, filtroEstado === 'todos'), ...(filtroEstado === 'todos' ? { background: 'rgba(76, 175, 80, 0.4)' } : {}) }}
                >
                  Activos ({pedidos.filter(p => !['entregado', 'pagado', 'cancelado'].includes(p.estado)).length})
                </button>
                {/* Estados activos - solo pendientes, preparándose, listos, en camino */}
                {['pendiente', 'cocinando', 'listo', 'en_camino'].map(key => {
                  const value = ESTADOS[key]
                  const count = pedidos.filter(p => p.estado === key).length
                  return (
                    <button 
                      key={key}
                      onClick={() => setFiltroEstado(key)}
                      style={{ 
                        ...s.filtro(darkMode, filtroEstado === key), 
                        ...(filtroEstado === key ? { background: `${value.color}40` } : {}),
                        borderLeft: `3px solid ${value.color}`
                      }}
                    >
                      {value.label} ({count})
                    </button>
                  )
                })}
                {/* Historial de entregados - abre modal */}
                {pedidos.filter(p => p.estado === 'entregado').length > 0 && (
                  <button 
                    onClick={() => setFiltroEstado('entregado')}
                    style={{ 
                      ...s.filtro(darkMode, filtroEstado === 'entregado'), 
                      ...(filtroEstado === 'entregado' ? { background: 'rgba(121, 31, 178, 0.4)' } : {}),
                      borderLeft: `3px solid #7B1FA2`,
                      marginLeft: '10px',
                      cursor: filtroEstado === 'entregado' ? 'not-allowed' : 'pointer',
                      opacity: filtroEstado === 'entregado' ? 0.5 : 1
                    }}
                  >
                    Entregados ({pedidos.filter(p => p.estado === 'entregado').length})
                  </button>
                )}
              </div>

              {/* LISTA DE PEDIDOS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px' }}>
                {pedidosFiltrados.map((pedido, index) => (
                  <div 
                    key={pedido.id}
                    className={`pedido-card ${pedido.estado === 'pendiente' ? 'animate-new-order' : ''}`}
                    style={{ 
                      ...s.pedidoCard(darkMode, pedido),
                      animationDelay: `${index * 0.05}s`
                    }}
                    onClick={() => setModalDetalle(pedido)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#43A047' }}>
                          #{pedido.numero_orden || pedido.id}
                        </span>
                        <span style={s.estadoBadge(pedido.estado)}>
                          {ESTADOS[pedido.estado]?.label}
                        </span>
                      </div>
                      <span className="material-icons" style={{ fontSize: '24px', color: ESTADOS[pedido.estado]?.color }}>
                        {ESTADOS[pedido.estado]?.icon}
                      </span>
                    </div>
                    
                    <div style={{ marginBottom: '10px' }}>
                      <p style={{ fontSize: '16px', fontWeight: '700', color: darkMode ? '#fff' : '#333', margin: 0 }}>
                        {pedido.nombre_cliente || 'Cliente'}
                      </p>
                      <p style={{ fontSize: '14px', color: darkMode ? '#aaa' : '#666', margin: '4px 0' }}>
                        Tel: {pedido.telefono_cliente || 'Sin teléfono'}
                      </p>
                      <p style={{ fontSize: '13px', color: darkMode ? '#888' : '#999', margin: 0 }}>
                        Dir: {pedido.direccion || 'Sin dirección'}
                      </p>
                    </div>

                    <div style={{ 
                      background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', 
                      borderRadius: '10px', 
                      padding: '10px',
                      marginBottom: '12px'
                    }}>
                      <p style={{ fontSize: '12px', color: darkMode ? '#888' : '#666', margin: '0 0 5px 0' }}>
                        {pedido.items?.length || 0} items
                      </p>
                      <div style={{ fontSize: '12px', color: darkMode ? '#ccc' : '#444' }}>
                        {pedido.items?.slice(0, 3).map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{item.cantidad}x {item.producto_nombre}</span>
                          </div>
                        ))}
                        {(pedido.items?.length || 0) > 3 && (
                          <span style={{ color: '#43A047' }}>+{pedido.items.length - 3} más...</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#43A047' }}>
                        {formatGuarani(pedido.total)}
                      </span>
                      {pedido.created_at && (
                        <span style={{ fontSize: '11px', color: darkMode ? '#666' : '#999' }}>
                          {new Date(pedido.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {/* BOTONES EDITAR Y CANCELAR */}
                    {pedido.estado !== 'cancelado' && pedido.estado !== 'pagado' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            abrirEdicion(pedido)
                          }}
                          style={{
                            flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                            background: '#FF9800', color: 'white', fontWeight: '700', fontSize: '12px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                          }}
                        >
                          Editar
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            cambiarEstado(pedido.id, 'cancelado')
                          }}
                          style={{
                            flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                            background: '#E53935', color: 'white', fontWeight: '700', fontSize: '12px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {pedidosFiltrados.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#666' : '#999' }}>
                  <span className="material-icons" style={{ fontSize: '80px', opacity: 0.3 }}>delivery_dining</span>
                  <p style={{ marginTop: '20px', fontSize: '18px' }}>No hay pedidos de delivery</p>
                  <button 
                    onClick={() => setModalNuevo(true)}
                    style={{ marginTop: '20px', padding: '14px 28px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #4CAF50, #388E3C)', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span className="material-icons" style={{ fontSize: '20px' }}>add_circle</span>
                    Crear primer pedido
                  </button>
                </div>
              )}

              {/* FAB - boton flotante para nuevo pedido siempre visible */}
              <button
                onClick={() => setModalNuevo(true)}
                style={{
                  position: 'fixed', bottom: isMobile ? '75px' : '30px', right: isMobile ? '16px' : '30px',
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
                  color: 'white', border: 'none',
                  boxShadow: '0 4px 20px rgba(76, 175, 80, 0.5)',
                  cursor: 'pointer', zIndex: 100,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', fontWeight: '300',
                  transition: 'transform 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                +
              </button>
            </>
          )}
        </div>
      </div>

      {/* MODAL NUEVO PEDIDO */}
      {modalNuevo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 150, display: 'flex' }}>
          <div style={{ ...s.modal(darkMode), maxWidth: '95%', width: '800px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: darkMode ? '#fff' : '#333', margin: 0 }}>
                {editandoPedido ? 'Editar Pedido' : 'Nuevo Pedido Delivery'}
              </h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: darkMode ? '#fff' : '#333' }}>×</button>
            </div>

            {/* DATOS DEL CLIENTE */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#43A047', marginBottom: '12px' }}>Datos del Cliente</h3>
              <input 
                type="text" 
                placeholder="Nombre del cliente *" 
                value={cliente.nombre}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                style={s.input(darkMode)}
              />
              <input 
                type="tel" 
                placeholder="Teléfono" 
                value={cliente.telefono}
                onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                style={s.input(darkMode)}
              />
              <input 
                type="text" 
                placeholder="Dirección de entrega" 
                value={cliente.direccion}
                onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                style={s.input(darkMode)}
              />
              <textarea 
                placeholder="Notas adicionales" 
                value={cliente.notas}
                onChange={(e) => setCliente({ ...cliente, notas: e.target.value })}
                style={{ ...s.input(darkMode), minHeight: '60px', resize: 'none' }}
              />
            </div>

            {/* CATÁLOGO DE PRODUCTOS */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#43A047', marginBottom: '12px' }}>Seleccionar Productos</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {productos.map((producto) => (
                  <div
                    key={producto.id}
                    onClick={() => { setModalProducto(producto); setCantidad(1); setVariante(null); setNota('') }}
                    style={{
                      borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative',
                      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                      background: darkMode ? '#1e1e1e' : 'white',
                      overflow: 'hidden',
                    }}
                  >
                    {producto.imagen ? (
                      <img src={producto.imagen} alt={producto.nombre} style={{ width: '100%', height: '70px', objectFit: 'cover', background: darkMode ? '#2a2a2a' : '#f0f2f5' }} />
                    ) : (
                      <div style={{ width: '100%', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: darkMode ? '#2a2a2a' : '#f0f2f5', fontSize: '24px' }}>
                        <span className="material-icons" style={{ opacity: 0.3, fontSize: '32px' }}>restaurant</span>
                      </div>
                    )}
                    {producto.variantes?.length > 0 && (
                      <div style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '50%', background: '#FF9800', color: 'white', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>V</div>
                    )}
                    <div style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <div style={{ fontWeight: '600', fontSize: '11px', color: darkMode ? '#fff' : '#1a1a1a', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{producto.nombre}</div>
                      <div style={{ color: '#43A047', fontWeight: '700', fontSize: '12px' }}>{formatGuarani(producto.precio)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARRITO */}
            <div style={{ 
              background: darkMode ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.1)', 
              borderRadius: '12px', 
              padding: '15px',
              marginBottom: '20px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#43A047', marginBottom: '12px' }}>
                Carrito ({carrito.length} items)
              </h3>
              {carrito.length === 0 ? (
                <p style={{ color: darkMode ? '#888' : '#666', textAlign: 'center' }}>Agregue productos del catálogo</p>
              ) : (
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {carrito.map((item) => (
                    <div key={`${item.producto_id}_${item.variante || ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px', background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                      <div>
                        <span style={{ fontWeight: '600' }}>{item.producto_nombre}</span>
                        {item.variante && <div style={{ fontSize: '10px', color: '#FF9800' }}>+ {item.variante}</div>}
                        {item.nota && <div style={{ fontSize: '10px', color: darkMode ? '#aaa' : '#888', fontStyle: 'italic' }}>Nota: {item.nota}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button onClick={() => quitarDelCarrito(item.producto_id, item.variante)} style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', background: '#E53935', color: 'white', cursor: 'pointer' }}>-</button>
                        <span style={{ fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>{item.cantidad}</span>
                        <button onClick={() => agregarAlCarrito({ id: item.producto_id, precio: item.precio }, { variante: item.variante, cantidad: 1 })} style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', background: '#43A047', color: 'white', cursor: 'pointer' }}>+</button>
                        <span style={{ fontWeight: '700', color: '#43A047', minWidth: '60px', textAlign: 'right' }}>{formatGuarani(item.cantidad * item.precio)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', paddingTop: '15px', borderTop: `2px solid ${darkMode ? '#444' : '#ddd'}` }}>
                <span style={{ fontSize: '18px', fontWeight: '700' }}>TOTAL:</span>
                <span style={{ fontSize: '24px', fontWeight: '800', color: '#43A047' }}>{formatGuarani(totalCarrito)}</span>
              </div>
            </div>

            <button 
              onClick={guardarPedido}
              disabled={!cliente.nombre || !carrito.length || guardando}
              style={{ 
                padding: '16px', border: 'none', borderRadius: '10px',
                background: guardando ? '#999' : 'linear-gradient(135deg, #4CAF50, #388E3C)',
                color: 'white', fontWeight: '800', fontSize: '16px',
                cursor: (!cliente.nombre || !carrito.length || guardando) ? 'not-allowed' : 'pointer',
                opacity: (!cliente.nombre || !carrito.length || guardando) ? 0.5 : 1,
                width: '100%'
              }}
            >
              {guardando ? 'Guardando...' : (editandoPedido ? 'Guardar cambios' : 'Crear este pedido')}
            </button>
          </div>
        </div>
      )}

      {modalProducto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{
            background: darkMode ? '#1e1e1e' : 'white', borderRadius: '20px', padding: '24px',
            width: '90%', maxWidth: '400px', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: darkMode ? '#fff' : '#1a1a1a' }}>{modalProducto.nombre}</h3>
              <button onClick={() => setModalProducto(null)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '8px', background: darkMode ? '#444' : '#eee', cursor: 'pointer', color: darkMode ? 'white' : '#333', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {modalProducto.imagen && (
              <img src={modalProducto.imagen} alt={modalProducto.nombre} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '12px', marginBottom: '16px', background: darkMode ? '#2a2a2a' : '#f0f2f5' }} />
            )}

            <div style={{ fontSize: '22px', fontWeight: '800', color: '#43A047', marginBottom: '16px' }}>{formatGuarani(modalProducto.precio)}</div>

            {modalProducto.variantes && Array.isArray(modalProducto.variantes) && modalProducto.variantes.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FF9800', marginBottom: '8px' }}>VARIANTES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {modalProducto.variantes.map((v, i) => {
                    const vName = typeof v === 'string' ? v : v?.nombre || 'Opci\u00f3n ' + (i + 1)
                    const vPrice = typeof v === 'object' && v?.precio_extra ? parseFloat(v.precio_extra) : 0
                    const isSelected = variante === vName
                    return (
                      <button
                        key={i}
                        onClick={() => setVariante(isSelected ? null : vName)}
                        style={{
                          padding: '8px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                          fontWeight: '600', fontSize: '12px', transition: 'all 0.15s',
                          background: isSelected ? '#FF9800' : (darkMode ? '#2a2a2a' : '#f0f0f0'),
                          color: isSelected ? 'white' : (darkMode ? '#ccc' : '#333'),
                        }}
                      >{vName}{vPrice > 0 ? ' +' + formatGuarani(vPrice) : ''}</button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FF9800', marginBottom: '8px' }}>CANTIDAD</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', background: '#E53935', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&minus;</button>
                <span style={{ fontSize: '22px', fontWeight: '700', minWidth: '30px', textAlign: 'center', color: darkMode ? '#fff' : '#1a1a1a' }}>{cantidad}</span>
                <button onClick={() => setCantidad(cantidad + 1)} style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', background: '#43A047', color: 'white', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#FF9800', marginBottom: '8px' }}>NOTA</div>
              <textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Sin cebolla, extra salsa, etc."
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '10px',
                  border: '1px solid ' + (darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'),
                  background: darkMode ? '#2a2a2a' : '#f8f8f8',
                  color: darkMode ? 'white' : '#1a1a1a', fontSize: '13px',
                  outline: 'none', resize: 'none', minHeight: '60px', boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={() => {
                agregarAlCarrito(modalProducto, { variante, nota, cantidad })
                setModalProducto(null)
              }}
              style={{
                width: '100%', padding: '14px', border: 'none', borderRadius: '12px',
                background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
              }}
            >Agregar al Carrito</button>
          </div>
        </div>
      )}

      {/* MODAL DETALLE PEDIDO */}
      {modalDetalle && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 150, display: 'flex' }}>
          <style>{`
            .dlv-print-ticket { display: none; }
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
              .dlv-print-ticket {
                display: block;
                position: fixed;
                top: 0;
                left: 0;
                width: 280px;
                padding: 8px;
                background: #fff;
                z-index: 9999;
                font-family: 'Courier New', Courier, monospace;
                font-size: 12px;
                line-height: 1.2;
                color: #000;
              }
              .dlv-print-ticket, .dlv-print-ticket * { visibility: visible; color: #000 !important; }
              .dlv-print-ticket .divider { border-top: 1px solid #000; margin: 6px 0; }
              .no-print { display: none !important; }
            }
          `}</style>

          <div className="dlv-print-ticket">
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              {empresa.logo && (
                <img src={empresa.logo} alt="Logo" style={{ maxHeight: '60px', marginBottom: '4px' }} />
              )}
              <h2 style={{ margin: '0 0 2px 0', fontSize: '14px', fontWeight: 'bold', color: '#000' }}>{empresa.nombre || 'RESTAURANTE'}</h2>
            </div>

            <div className="divider" />

            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#000' }}>DELIVERY</p>
              <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '2px 0', color: '#000' }}>Cliente: {modalDetalle.nombre_cliente}</p>
            </div>

            <div className="divider" />

            <div style={{ marginBottom: '8px' }}>
              {modalDetalle.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontWeight: 'bold', color: '#000', fontSize: '12px' }}>
                  <span>{item.cantidad}x {item.producto_nombre}</span>
                  <span>{formatGuarani(item.cantidad * Number(item.precio))}</span>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', padding: '3px 0', color: '#000' }}>
              <span>TOTAL Gs:</span>
              <span>{formatGuarani(modalDetalle.total)}</span>
            </div>

            <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', marginTop: '10px', color: '#000' }}>
              Gracias por su preferencia!
            </div>
          </div>

          <div className="no-print" style={{
            ...s.modal(darkMode),
            width: isMobile ? '100%' : s.modal(darkMode).width,
            maxWidth: isMobile ? '100%' : s.modal(darkMode).maxWidth,
            height: isMobile ? '100%' : 'auto',
            maxHeight: isMobile ? '100%' : s.modal(darkMode).maxHeight,
            borderRadius: isMobile ? '0' : s.modal(darkMode).borderRadius,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '800', color: darkMode ? '#fff' : '#333', margin: 0 }}>
                    #{modalDetalle.numero_orden || modalDetalle.id}
                  </h2>
                <span style={s.estadoBadge(modalDetalle.estado)}>
                  {ESTADOS[modalDetalle.estado]?.label}
                </span>
              </div>
              <button onClick={() => setModalDetalle(null)} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: darkMode ? '#fff' : '#333' }}>×</button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#43A047', marginBottom: '12px' }}>Cliente</h3>
              <p style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 5px 0' }}>{modalDetalle.nombre_cliente}</p>
              <p style={{ fontSize: '14px', color: darkMode ? '#aaa' : '#666', margin: '0' }}>Tel: {modalDetalle.telefono_cliente}</p>
              <p style={{ fontSize: '14px', color: darkMode ? '#aaa' : '#666', margin: '5px 0 0 0' }}>Dir: {modalDetalle.direccion}</p>
              {modalDetalle.notas && (
                <p style={{ fontSize: '13px', color: '#FF9800', margin: '10px 0 0 0', fontStyle: 'italic' }}>Nota: {modalDetalle.notas}</p>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#43A047', marginBottom: '12px' }}>Items</h3>
              <div style={{ background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: '12px', padding: '15px' }}>
                {modalDetalle.items?.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '8px', borderBottom: i < modalDetalle.items.length - 1 ? `1px solid ${darkMode ? '#333' : '#eee'}` : 'none' }}>
                    <span style={{ fontWeight: '600' }}>{item.cantidad}x {item.producto_nombre}</span>
                    <span style={{ fontWeight: '700', color: '#43A047' }}>{formatGuarani(item.cantidad * Number(item.precio))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '15px', background: 'rgba(67, 160, 71, 0.1)', borderRadius: '12px' }}>
              <span style={{ fontSize: '20px', fontWeight: '700' }}>TOTAL:</span>
              <span style={{ fontSize: '28px', fontWeight: '800', color: '#43A047' }}>{formatGuarani(modalDetalle.total)}</span>
            </div>

            {modalDetalle.estado !== 'cancelado' && modalDetalle.estado !== 'pagado' && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={async () => {
                    if (imprimiendo) return
                    setImprimiendo(true)
                    try {
                      await printDeliveryTicket(modalDetalle, empresa)
                      setImprimiendo(false)
                    } catch {
                      window.print()
                      setImprimiendo(false)
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: 'none',
                    borderRadius: '12px',
                    background: imprimiendo ? '#999' : '#FF9800',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '16px',
                    cursor: imprimiendo ? 'not-allowed' : 'pointer',
                    opacity: imprimiendo ? 0.6 : 1
                  }}
                >
                  {imprimiendo ? 'Imprimiendo...' : 'Imprimir'}
                </button>
                <button
                  onClick={() => {
                    cambiarEstado(modalDetalle.id, 'cancelado')
                    setModalDetalle(null)
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    border: 'none',
                    borderRadius: '12px',
                    background: '#E53935',
                    color: 'white',
                    fontWeight: '700',
                    fontSize: '16px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}