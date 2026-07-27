import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'
import { formatGuarani } from '../utils/currency'
import { TicketFactura } from '../components/Ticket'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

import { getApiUrl } from '../utils/api'
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
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .animate-fade-in { animation: fadeInUp 0.5s ease-out forwards; }
  .animate-pulse { animation: pulse 2s infinite; }
  .animate-slide { animation: slideIn 0.4s ease-out forwards; }
`

export default function Informes() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  const [periodo, setPeriodo] = useState('hoy')
  const [resumen, setResumen] = useState(null)
  const [ventasDia, setVentasDia] = useState([])
  const [productos, setProductos] = useState([])
  const [metodosPago, setMetodosPago] = useState({})
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [animacionIndex, setAnimacionIndex] = useState(0)

  const LIMITE_PAGINA = 15
  const [modalHistorial, setModalHistorial] = useState(false)
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [totalResultados, setTotalResultados] = useState(0)
  const [paginaActual, setPaginaActual] = useState(1)
  const [buscandoHistorial, setBuscandoHistorial] = useState(false)
  const [buscarCliente, setBuscarCliente] = useState('')
  const [buscarRucInput, setBuscarRucInput] = useState('')
  const [buscarOrden, setBuscarOrden] = useState('')
  const [buscarFactura, setBuscarFactura] = useState('')
  const [buscarTimbrado, setBuscarTimbrado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [resultadoExpandido, setResultadoExpandido] = useState(null)
  const [pedidoPrint, setPedidoPrint] = useState(null)
  const [empresa, setEmpresa] = useState({ nombre: '', ruc: '', direccion: '', telefono: '' })
  const totalPaginasHistorial = Math.max(1, Math.ceil(totalResultados / LIMITE_PAGINA))

  useEffect(() => {
    initDarkMode()
    syncDarkMode()
    cargarDatosEmpresa()
  }, [])

  const cargarDatosEmpresa = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/config`)
      const data = await res.json()
      if (data.success && data.config) {
        setEmpresa({ nombre: data.config.nombre_empresa || '', ruc: data.config.ruc || '', direccion: data.config.direccion || '', telefono: data.config.telefono || '' })
      }
    } catch (e) { console.error('Error cargando datos empresa:', e) }
  }

  useEffect(() => {
    cargarDatos()
  }, [periodo])

  const cargarDatos = async () => {
    setCargando(true)
    const { inicio, fin } = getFechas()
    
    try {
      const [resResumen, resVentas, resProductos, resMetodos, resPedidos] = await Promise.all([
        fetch(`${API_URL}/informes/resumen-completo?fecha_inicio=${inicio}&fecha_fin=${fin}`),
        fetch(`${API_URL}/informes/ventas-por-dia?dias=${periodo === 'hoy' || periodo === 'ayer' ? 1 : periodo === 'semana' ? 7 : 30}&estado=pagado`),
        fetch(`${API_URL}/informes/productos-estadisticas?fecha_inicio=${inicio}&fecha_fin=${fin}&limite=10`),
        fetch(`${API_URL}/informes/metodos-pago?fecha_inicio=${inicio}&fecha_fin=${fin}&estado=pagado`),
        fetch(`${API_URL}/informes/pedidos-lista?fecha_inicio=${inicio}&fecha_fin=${fin}&limit=20`)
      ])

      const dataResumen = await resResumen.json()
      const dataVentas = await resVentas.json()
      const dataProductos = await resProductos.json()
      const dataMetodos = await resMetodos.json()
      const dataPedidos = await resPedidos.json()

      if (dataResumen.success) setResumen(dataResumen.data)
      if (dataVentas.success) setVentasDia(dataVentas.data)
      if (dataProductos.success) setProductos(dataProductos.data.productos || [])
      if (dataMetodos.success) setMetodosPago(dataMetodos.data)
      if (dataPedidos.success) setPedidos(dataPedidos.data.pedidos || [])
      
      setAnimacionIndex(0)
    } catch (e) {
      console.error('Error cargando datos:', e)
    }
    setCargando(false)
  }

  const getFechas = () => {
    const today = new Date()
    const formato = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    
    switch (periodo) {
      case 'hoy': return { inicio: formato(today), fin: formato(today) }
      case 'semana':
        const inicioSemana = new Date(today)
        inicioSemana.setDate(today.getDate() - 7)
        return { inicio: formato(inicioSemana), fin: formato(today) }
      case 'mes':
        const inicioMes = new Date(today)
        inicioMes.setDate(1)
        return { inicio: formato(inicioMes), fin: formato(today) }
      case 'ayer':
        const ayer = new Date(today)
        ayer.setDate(today.getDate() - 1)
        return { inicio: formato(ayer), fin: formato(ayer) }
      default: return { inicio: formato(today), fin: formato(today) }
    }
  }

  const s = {
    container: (dm) => ({ 
      minHeight: '100vh', 
      background: dm ? '#121212' : '#f0f2f5',
      color: dm ? '#fff' : '#1a1a1a'
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
    btn: { 
      width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.8)', fontSize: '18px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textDecoration: 'none', transition: 'all 0.15s'
    },
    title: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
    kpiCard: (dm, index) => ({ 
      borderRadius: '14px', 
      padding: '20px', 
      textAlign: 'center', 
      border: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      background: dm ? '#1e1e1e' : 'white',
      boxShadow: dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
      animationDelay: `${index * 0.1}s`,
    }),
    gridKpi: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' },
    gridGraficos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px', marginBottom: '24px' },
    sectionTitle: (dm) => ({ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: dm ? '#fff' : '#1a1a1a' }),
    filtro: (dm) => ({ 
      padding: '8px 14px', 
      border: '1px solid rgba(255,255,255,0.15)', 
      borderRadius: '8px', 
      background: '#1a1a1a', 
      color: 'rgba(255,255,255,0.8)', 
      fontSize: '13px', 
      cursor: 'pointer', 
      outline: 'none',
    }),
  }

  const textColor = darkMode ? '#fff' : '#333'
  const gridColor = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'

  const datosGraficoVentas = {
    labels: ventasDia.map(v => v.fecha ? new Date(v.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }) : ''),
    datasets: [{
      label: 'Ventas',
      data: ventasDia.map(v => v.ventas),
      backgroundColor: (context) => {
        const ctx = context.chart.ctx
        const gradient = ctx.createLinearGradient(0, 0, 0, 300)
        gradient.addColorStop(0, 'rgba(25, 118, 210, 0.9)')
        gradient.addColorStop(1, 'rgba(25, 118, 210, 0.3)')
        return gradient
      },
      borderColor: '#1976D2',
      borderWidth: 3,
      borderRadius: 12,
      borderSkipped: false,
      hoverBackgroundColor: '#1565C0'
    }]
  }

  const opcionesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 1500, easing: 'easeOutQuart' },
    plugins: {
      legend: { labels: { color: textColor, font: { size: 12 } } }
    },
    scales: {
      x: { 
        ticks: { color: textColor, font: { size: 11 } }, 
        grid: { color: gridColor, drawBorder: false },
        border: { display: false }
      },
      y: { 
        ticks: { color: textColor, font: { size: 11 } }, 
        grid: { color: gridColor, drawBorder: false },
        border: { display: false }
      }
    }
  }

  const datosGraficoProductos = {
    labels: productos.slice(0, 8).map(p => p.nombre.length > 15 ? p.nombre.substring(0, 15) + '...' : p.nombre),
    datasets: [{
      label: 'Ventas ($)',
      data: productos.slice(0, 8).map(p => p.ventas),
      backgroundColor: [
        '#FF9800',
        '#4CAF50',
        '#E53935',
        '#1976D2',
        '#9C27B0',
        '#00BCD4',
        '#795548',
        '#607D8B'
      ],
      borderRadius: 8,
      borderSkipped: false
    }]
  }

  const opcionesProductos = {
    ...opcionesGrafico,
    indexAxis: 'y'
  }

  const datosGraficoMetodos = {
    labels: ['Efectivo', 'Transferencia', 'Tarjeta'],
    datasets: [{
      data: [metodosPago.efectivo || 0, metodosPago.transferencia || 0, metodosPago.tarjeta || 0],
      backgroundColor: [
        'rgba(76, 175, 80, 0.9)',
        'rgba(33, 150, 243, 0.9)',
        'rgba(255, 152, 0, 0.9)'
      ],
      borderColor: ['#4CAF50', '#2196F3', '#FF9800'],
      borderWidth: 3,
      hoverOffset: 15
    }]
  }

  const opcionesDoughnut = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { animateRotate: true, animateScale: true, duration: 1500 },
    plugins: {
      legend: { position: 'bottom', labels: { color: textColor, padding: 20, font: { size: 13 } } }
    }
  }

  const getEstadoColor = (estado) => {
    const colores = { pendiente: '#FBC02D', cocinando: '#1976D2', listo: '#4CAF50', pagado: '#7B1FA2', cancelado: '#E53935' }
    return colores[estado] || '#666'
  }

  const kpis = [
    { label: '💰 Ventas Totales', valor: resumen?.ventas_totales || 0, color: '#4CAF50', icono: 'attach_money', formato: 'moneda' },
    { label: '📦 Total Pedidos', valor: resumen?.total_pedidos || 0, color: '#1976D2', icono: 'receipt_long', formato: 'numero' },
    { label: '🎯 Ticket Promedio', valor: resumen?.ticket_promedio || 0, color: '#FF9800', icono: 'trending_up', formato: 'moneda' },
    { label: '⚠️ Tasa Cancelación', valor: resumen?.tasa_cancelacion || 0, color: '#E53935', icono: 'cancel', formato: 'porcentaje' }
  ]

  const kpiColors = { '#4CAF50': '#81C784', '#1976D2': '#64B5F6', '#FF9800': '#FFB74D', '#E53935': '#EF5350' }

  const formatearNumero = (valor, tipo) => {
    if (tipo === 'moneda') return formatGuarani(valor)
    if (tipo === 'porcentaje') return `${Number(valor).toFixed(1)}%`
    return Number(valor).toLocaleString()
  }

  const buscarHistorial = async (pagina = 1) => {
    setBuscandoHistorial(true)
    setResultadoExpandido(null)
    try {
      const params = new URLSearchParams({
        limit: String(LIMITE_PAGINA),
        offset: String((pagina - 1) * LIMITE_PAGINA),
        fecha_desde: fechaDesde || '',
        fecha_hasta: fechaHasta || '',
        cliente_nombre: buscarCliente,
        cliente_ruc: buscarRucInput,
        numero_orden: buscarOrden,
        numero_factura: buscarFactura,
        timbrado: buscarTimbrado,
      })
      const res = await fetch(`${API_URL}/caja/pedidos-pagados?${params}`)
      const data = await res.json()
      if (data.success) {
        setResultadosBusqueda(data.pedidos || [])
        setTotalResultados(data.total || 0)
        setPaginaActual(pagina)
      }
    } catch (e) {
      console.error('Error buscando historial:', e)
    }
    setBuscandoHistorial(false)
  }

  const limpiarFiltrosHistorial = () => {
    setBuscarCliente('')
    setBuscarRucInput('')
    setBuscarOrden('')
    setBuscarFactura('')
    setBuscarTimbrado('')
    setFechaDesde('')
    setFechaHasta('')
    setResultadosBusqueda([])
    setTotalResultados(0)
    setPaginaActual(1)
    setResultadoExpandido(null)
  }

  const formatearFechaHistorial = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const sHistoriasModal = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
    modal: { background: darkMode ? '#2d2d2d' : 'white', borderRadius: '20px', padding: '25px', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' },
    input: { width: '100%', padding: '10px 14px', border: 'none', borderRadius: '10px', background: darkMode ? '#3a3a3a' : '#f5f5f5', color: darkMode ? '#fff' : '#333', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
    btn: { padding: '10px 20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
    btnPrimary: { padding: '12px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '700', background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white' },
  }

  return (
    <div style={s.container(darkMode)}>
      <style>{estilosAnimados}</style>
      
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={s.btn}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={s.title}>Informes</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={s.filtro(darkMode)}>
            <option value="hoy">Hoy</option>
            <option value="ayer">Ayer</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
          </select>
          <button onClick={() => setModalHistorial(true)} style={{
            padding: '8px 14px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
          }}>
            🎫 Historial
          </button>
          {!isMobile && <FullscreenButton />}
          <button onClick={toggleDarkMode} style={s.btn}><span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span></button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '70px 1fr', height: 'calc(100vh - 64px)', overflow: 'hidden', paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/informes" />
        
        <div style={{ padding: isMobile ? '12px' : '25px', overflowY: 'auto', overflowX: 'hidden' }}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '100px', color: darkMode ? '#888' : '#666' }}>
              <div style={{ width: '80px', height: '80px', margin: '0 auto', border: '4px solid #eee', borderTop: '4px solid #1976D2', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <p style={{ marginTop: '25px', fontSize: '18px', fontWeight: '600' }}>Cargando estadísticas...</p>
              <p style={{ marginTop: '10px', fontSize: '14px', opacity: 0.7 }}>Analizando datos de ventas</p>
            </div>
          ) : (
            <>
              {/* TARJETAS KPI ANIMADAS */}
              <h2 style={s.sectionTitle(darkMode)}>
                <span style={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  width: '5px', 
                  height: '70%', 
                  background: 'linear-gradient(to bottom, #1976D2, #4CAF50)', 
                  borderRadius: '3px' 
                }}></span>
                📈 Resumen del Período
              </h2>
              <div style={s.gridKpi}>
                {kpis.map((kpi, index) => (
                  <div 
                    key={index} 
                    className="kpi-card animate-fade-in"
                    style={{ 
                      ...s.kpiCard(darkMode, index),
                      animationDelay: `${index * 0.15}s`
                    }}
                  >
                    <div style={{ 
                      position: 'absolute', 
                      top: '-20px', 
                      right: '-20px', 
                      width: '80px', 
                      height: '80px', 
                      background: `linear-gradient(135deg, ${kpi.color}40, ${kpi.color}20)`,
                      borderRadius: '50%'
                    }}></div>
                    <span className="material-icons" style={{ 
                      fontSize: '45px', 
                      color: kpi.color,
                      animation: 'bounce 2s infinite',
                      animationDelay: `${index * 0.3}s`
                    }}>{kpi.icono}</span>
                    <p style={{ fontSize: '14px', color: darkMode ? '#aaa' : '#666', marginTop: '12px', fontWeight: '500' }}>{kpi.label}</p>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: kpi.color, margin: '8px 0 0' }}>{formatearNumero(kpi.valor, kpi.formato)}</p>
                    {index === 0 && (
                      <div style={{ 
                        position: 'absolute', 
                        bottom: '10px', 
                        right: '10px',
                        animation: 'pulse 2s infinite'
                      }}>
                        <span className="material-icons" style={{ fontSize: '20px', color: '#4CAF50' }}>arrow_upward</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* GRÁFICOS */}
              <h2 style={{ ...s.sectionTitle(darkMode), marginTop: '30px' }}>
                📊 Análisis de Rendimiento
              </h2>
              <div style={s.gridGraficos}>
                <div 
                  className="animate-fade-in" 
                  style={{ 
                    ...s.kpiCard(darkMode, 0),
                    animationDelay: '0.4s',
                    minHeight: '350px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>📈 Ventas Diarias</p>
                    <span className="material-icons animate-bounce" style={{ color: '#1976D2' }}>show_chart</span>
                  </div>
                  <div style={{ height: '280px', position: 'relative' }}>
                    <Bar data={datosGraficoVentas} options={opcionesGrafico} />
                  </div>
                </div>

                <div 
                  className="animate-fade-in" 
                  style={{ 
                    ...s.kpiCard(darkMode, 1),
                    animationDelay: '0.5s',
                    minHeight: '350px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>🏆 Productos Más Vendidos</p>
                    <span className="material-icons animate-bounce" style={{ color: '#FF9800' }}>emoji_events</span>
                  </div>
                  <div style={{ height: '280px', position: 'relative' }}>
                    <Bar data={datosGraficoProductos} options={opcionesProductos} />
                  </div>
                </div>
              </div>

              <div style={s.gridGraficos}>
                <div 
                  className="animate-fade-in" 
                  style={{ 
                    ...s.kpiCard(darkMode, 2),
                    animationDelay: '0.6s',
                    minHeight: '320px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>💳 Métodos de Pago</p>
                    <span className="material-icons animate-bounce" style={{ color: '#4CAF50' }}>payment</span>
                  </div>
                  <div style={{ height: '220px', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    <Doughnut data={datosGraficoMetodos} options={opcionesDoughnut} />
                  </div>
                </div>

                <div 
                  className="animate-fade-in" 
                  style={{ 
                    ...s.kpiCard(darkMode, 3),
                    animationDelay: '0.7s',
                    minHeight: '320px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>
                      📊 Estado de Pedidos
                      {resumen?.cancelados_en_cocina > 0 && (
                        <span style={{ fontSize: '12px', color: '#E53935', marginLeft: '8px', fontWeight: '400' }}>
                          ({resumen.cancelados_en_cocina} en cocina)
                        </span>
                      )}
                    </p>
                    <span className="material-icons animate-bounce" style={{ color: '#9C27B0' }}>analytics</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', justifyContent: 'center', height: '220px' }}>
                    {resumen?.pedidos_por_estado && Object.entries(resumen.pedidos_por_estado).map(([estado, cantidad], i) => {
                      const total = Object.values(resumen.pedidos_por_estado).reduce((a, b) => a + b, 0)
                      const porcentaje = total > 0 ? (cantidad / total) * 100 : 0
                      const color = getEstadoColor(estado)
                      return (
                        <div key={estado} style={{ animation: `slideIn 0.5s ease-out ${0.8 + i * 0.1}s forwards`, opacity: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ textTransform: 'capitalize', color: darkMode ? '#ccc' : '#666', fontWeight: '600' }}>{estado}</span>
                            <span style={{ fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>{cantidad} ({porcentaje.toFixed(0)}%)</span>
                          </div>
                          <div style={{ 
                            height: '10px', 
                            background: darkMode ? '#333' : '#eee', 
                            borderRadius: '5px', 
                            overflow: 'hidden' 
                          }}>
                            <div style={{ 
                              height: '100%', 
                              width: `${porcentaje}%`,
                              background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                              borderRadius: '5px',
                              transition: 'width 1s ease-out'
                            }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* MOTIVOS DE CANCELACION */}
              {resumen?.motivos_cancelacion?.length > 0 && (
                <div 
                  className="animate-fade-in" 
                  style={{ 
                    ...s.kpiCard(darkMode, 5),
                    animationDelay: '0.85s',
                    marginBottom: '24px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <p style={{ fontSize: '18px', fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>
                      ⛔ Motivos de Cancelación
                    </p>
                    <span className="material-icons" style={{ color: '#E53935' }}>report_problem</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {resumen.motivos_cancelacion.map((m, i) => {
                      const total = resumen.motivos_cancelacion.reduce((a, b) => a + b.cantidad, 0)
                      const pct = total > 0 ? (m.cantidad / total) * 100 : 0
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: darkMode ? '#ccc' : '#666', fontWeight: '600' }}>{m.motivo_cancelacion}</span>
                            <span style={{ fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>{m.cantidad} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div style={{ height: '8px', background: darkMode ? '#333' : '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #E53935, #FF7043)', borderRadius: '4px', transition: 'width 1s ease-out' }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* TABLA DE PEDIDOS */}
              <h2 style={{ ...s.sectionTitle(darkMode), marginTop: '30px' }}>
                📋 Últimos Pedidos
              </h2>
              <div 
                className="animate-fade-in" 
                style={{ 
                  ...s.kpiCard(darkMode, 4),
                  animationDelay: '0.9s',
                  overflow: 'hidden',
                  padding: 0
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
                        <th style={{ padding: '18px', textAlign: 'left', color: darkMode ? '#aaa' : '#666', fontWeight: '700' }}>#Orden</th>
                        <th style={{ padding: '18px', textAlign: 'left', color: darkMode ? '#aaa' : '#666', fontWeight: '700' }}>Fecha</th>
                        <th style={{ padding: '18px', textAlign: 'left', color: darkMode ? '#aaa' : '#666', fontWeight: '700' }}>Ubicación</th>
                        <th style={{ padding: '18px', textAlign: 'left', color: darkMode ? '#aaa' : '#666', fontWeight: '700' }}>Estado</th>
                        <th style={{ padding: '18px', textAlign: 'left', color: darkMode ? '#aaa' : '#666', fontWeight: '700' }}>Método</th>
                        <th style={{ padding: '18px', textAlign: 'right', color: darkMode ? '#aaa' : '#666', fontWeight: '700' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: darkMode ? '#666' : '#999' }}>
                            <span className="material-icons" style={{ fontSize: '50px', opacity: 0.5 }}>inbox</span>
                            <p style={{ marginTop: '10px' }}>No hay pedidos en este período</p>
                          </td>
                        </tr>
                      ) : pedidos.map((pedido, i) => (
                        <tr 
                          key={pedido.id} 
                          style={{ 
                            borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            animation: `fadeInUp 0.4s ease-out ${1 + i * 0.05}s forwards`,
                            opacity: 0
                          }}
                        >
                          <td style={{ padding: '15px' }}>
                            <span style={{ 
                              fontWeight: '800', 
                              color: '#1976D2',
                              background: 'rgba(25, 118, 210, 0.1)',
                              padding: '5px 10px',
                              borderRadius: '8px'
                            }}>
                              #{pedido.numero_orden}
                            </span>
                          </td>
                          <td style={{ padding: '15px', color: darkMode ? '#ccc' : '#666' }}>
                            {pedido.created_at ? new Date(pedido.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td style={{ padding: '15px', color: darkMode ? '#ccc' : '#666' }}>
                            {pedido.delivery ? '🚴 Delivery' : `🍽️ Mesa ${pedido.mesa || '-'}`}
                          </td>
                          <td style={{ padding: '15px' }}>
                            <span style={{ 
                              padding: '6px 14px', 
                              borderRadius: '20px', 
                              background: getEstadoColor(pedido.estado) + '20',
                              color: getEstadoColor(pedido.estado),
                              fontSize: '12px',
                              fontWeight: '700',
                              textTransform: 'capitalize'
                            }}>
                              {pedido.estado}
                            </span>
                          </td>
                          <td style={{ padding: '15px', color: darkMode ? '#ccc' : '#666', textTransform: 'capitalize' }}>
                            {pedido.metodo_pago || '-'}
                          </td>
                          <td style={{ padding: '15px', textAlign: 'right' }}>
                            <span style={{ 
                              fontWeight: '800', 
                              color: '#4CAF50',
                              fontSize: '16px'
                            }}>
                              {formatGuarani(pedido.total)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '30px', color: darkMode ? '#666' : '#999', fontSize: '14px' }}>
                <span className="material-icons" style={{ verticalAlign: 'middle', fontSize: '18px' }}>auto_graph</span>
                Datos actualizados en tiempo real
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL HISTORIAL */}
      {modalHistorial && (
        <div style={sHistoriasModal.overlay} onClick={() => { setModalHistorial(false); limpiarFiltrosHistorial() }}>
          <div className="animate-scale" style={sHistoriasModal.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: darkMode ? '#fff' : '#333', margin: 0 }}>🎫 Historial de Pedidos</h3>
              <button onClick={() => { setModalHistorial(false); limpiarFiltrosHistorial() }} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: 0 }}>&times;</button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <input type="text" placeholder="Cliente" value={buscarCliente} onChange={e => setBuscarCliente(e.target.value)} style={sHistoriasModal.input} />
              <input type="text" placeholder="RUC" value={buscarRucInput} onChange={e => setBuscarRucInput(e.target.value)} style={sHistoriasModal.input} />
              <input type="text" placeholder="N° Orden" value={buscarOrden} onChange={e => setBuscarOrden(e.target.value)} style={sHistoriasModal.input} />
              <input type="text" placeholder="N° Factura" value={buscarFactura} onChange={e => setBuscarFactura(e.target.value)} style={sHistoriasModal.input} />
              <input type="text" placeholder="N° Timbrado" value={buscarTimbrado} onChange={e => setBuscarTimbrado(e.target.value)} style={sHistoriasModal.input} />
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={sHistoriasModal.input} title="Desde" />
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={sHistoriasModal.input} title="Hasta" />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => buscarHistorial(1)} disabled={buscandoHistorial} style={{ ...sHistoriasModal.btnPrimary, flex: 2, opacity: buscandoHistorial ? 0.5 : 1, padding: '10px', fontSize: '14px' }}>
                  {buscandoHistorial ? 'Buscando...' : '🔍 Buscar'}
                </button>
                <button onClick={limpiarFiltrosHistorial} style={{ ...sHistoriasModal.btn, background: darkMode ? '#3a3a3a' : '#f0f0f0', color: darkMode ? '#ccc' : '#555', flex: 1, padding: '8px' }}>Limpiar</button>
              </div>
            </div>

            {/* Resultados */}
            <div style={{ maxHeight: '420px', overflow: 'auto', borderRadius: '8px', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
              {resultadosBusqueda.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '14px' }}>
                  {buscandoHistorial ? 'Buscando...' : 'Use los filtros y haga clic en Buscar'}
                </div>
              ) : (
                <>
                  {/* Header tabla */}
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 100px 100px 50px', padding: '8px 12px', background: darkMode ? '#2a2a2a' : '#f5f5f5', fontSize: '11px', fontWeight: '700', color: darkMode ? '#aaa' : '#666', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                    <span>Fecha</span>
                    <span>N° Orden</span>
                    <span>Cliente</span>
                    <span>Total</span>
                    <span>Factura</span>
                    <span></span>
                  </div>
                  {resultadosBusqueda.map((p) => (
                    <div key={p.id}>
                      <div onClick={() => setResultadoExpandido(resultadoExpandido === p.id ? null : p.id)}
                        style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 100px 100px 50px', padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, background: resultadoExpandido === p.id ? (darkMode ? '#2a2a2a' : '#f9f9f9') : 'transparent', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: darkMode ? '#aaa' : '#888' }}>{formatearFechaHistorial(p.created_at)}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: darkMode ? '#fff' : '#333' }}>#{p.numero_orden}</span>
                        <div>
                          <span style={{ fontSize: '12px', color: darkMode ? '#ddd' : '#444' }}>{p.cliente_nombre}</span>
                          {p.cliente_ruc && p.cliente_ruc !== '44444444-7' && (
                            <span style={{ fontSize: '10px', color: '#888', marginLeft: '6px' }}>({p.cliente_ruc})</span>
                          )}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#4CAF50' }}>{formatGuarani(p.total)}</span>
                        <span style={{ fontSize: '11px', color: p.factura?.numero ? '#FF9800' : '#888' }}>{p.factura?.numero || '-'}</span>
                        <button onClick={(e) => { e.stopPropagation(); setPedidoPrint(p) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>
                          🖨️
                        </button>
                      </div>
                      {/* Expandido: items y detalles */}
                      {resultadoExpandido === p.id && (
                        <div style={{ padding: '12px 12px 12px 24px', background: darkMode ? '#222' : '#fafafa', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: darkMode ? '#ccc' : '#666', marginBottom: '6px' }}>Productos:</div>
                          {(p.items || []).map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: darkMode ? '#aaa' : '#555', padding: '2px 0' }}>
                              <span>{item.cantidad || 1}x {item.producto_nombre || item.nombre || item.producto}</span>
                              <span>{formatGuarani((item.cantidad || 1) * (item.precio || 0))}</span>
                            </div>
                          ))}
                          {p.propina && parseFloat(p.propina) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#FF9800', padding: '2px 0', marginTop: '4px', borderTop: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, paddingTop: '4px' }}>
                              <span>Propina:</span>
                              <span>{formatGuarani(p.propina)}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px', color: darkMode ? '#999' : '#777' }}>
                            <span>Método: {p.metodo_pago}</span>
                            {p.mesa && <span>Mesa: {p.mesa}</span>}
                            <span>Mesero: {p.mesero_nombre || '-'}</span>
                            {p.factura?.cdc && <span style={{ wordBreak: 'break-all', maxWidth: '300px' }}>CDC: {p.factura.cdc}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Paginacion */}
            {totalResultados > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <button onClick={() => buscarHistorial(paginaActual - 1)} disabled={paginaActual <= 1 || buscandoHistorial}
                  style={{ ...sHistoriasModal.btn, padding: '6px 12px', fontSize: '12px', opacity: paginaActual <= 1 ? 0.4 : 1 }}>◀ Anterior</button>
                <span style={{ fontSize: '13px', color: darkMode ? '#ccc' : '#555' }}>Página {paginaActual} de {totalPaginasHistorial}</span>
                <button onClick={() => buscarHistorial(paginaActual + 1)} disabled={paginaActual >= totalPaginasHistorial || buscandoHistorial}
                  style={{ ...sHistoriasModal.btn, padding: '6px 12px', fontSize: '12px', opacity: paginaActual >= totalPaginasHistorial ? 0.4 : 1 }}>Siguiente ▶</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ticket para imprimir con window.print() */}
      {pedidoPrint && (
        <TicketFactura
          pedido={pedidoPrint}
          negocio={empresa}
          cliente={{ nombre: pedidoPrint.cliente_nombre, ruc: pedidoPrint.cliente_ruc }}
          factura={pedidoPrint.factura}
          sifen_error={pedidoPrint.sifen_mensaje || null}
          onClose={() => setPedidoPrint(null)}
          numero={pedidoPrint.factura?.numero || pedidoPrint.numero_orden}
        />
      )}
    </div>
  )
}
