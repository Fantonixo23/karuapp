import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'

import { formatGuarani } from '../utils/currency'
import { TicketFactura } from '../components/Ticket'
import { printTicketFactura } from '../utils/qzPrint'

import { getApiUrl } from '../utils/api'
const API_URL = getApiUrl()

const PROPINAS = [
  { porcentaje: 0, label: 'Sin Propina' },
  { porcentaje: 5, label: '5%' },
  { porcentaje: 10, label: '10%' },
  { porcentaje: 15, label: '15%' },
  { porcentaje: 20, label: '20%' }
]

const DENOMINACIONES = [
  { valor: 100000, label: '100.000 Gs' },
  { valor: 50000, label: '50.000 Gs' },
  { valor: 20000, label: '20.000 Gs' },
  { valor: 10000, label: '10.000 Gs' },
  { valor: 5000, label: '5.000 Gs' },
  { valor: 2000, label: '2.000 Gs' },
  { valor: 1000, label: '1.000 Gs' },
  { valor: 500, label: '500 Gs' },
  { valor: 100, label: '100 Gs' },
  { valor: 50, label: '50 Gs' },
]

const s = (dm) => ({
  page: { minHeight: '100vh', background: dm ? '#121212' : '#f0f2f5', fontFamily: "'Roboto', sans-serif" },
  header: { background: '#1a1a1a', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,152,0,0.2)' },
  headerTitle: { color: '#FF9800', fontSize: '22px', fontWeight: '700', margin: 0 },
  content: { padding: '24px', maxWidth: '1800px', margin: '0 auto' },
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' },
  modal: { background: dm ? '#2d2d2d' : 'white', borderRadius: '20px', padding: '25px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' },
  modalLg: { background: dm ? '#2d2d2d' : 'white', borderRadius: '20px', padding: '25px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' },
  card: { background: dm ? '#2d2d2d' : 'white', borderRadius: '14px', padding: '16px', boxShadow: dm ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)' },
  input: { width: '100%', padding: '10px 14px', border: 'none', borderRadius: '10px', background: dm ? '#3a3a3a' : '#f5f5f5', color: dm ? '#fff' : '#333', fontSize: '14px', outline: 'none', boxSizing: 'border-box' },
  btn: { padding: '10px 20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  btnPrimary: { padding: '12px 24px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '16px', fontWeight: '700', background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' },
})

export default function Caja() {

  const darkMode = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)
  const initDarkMode = useStore((s) => s.initDarkMode)
  const isMobile = useStore((s) => s.isMobile)

  const [hora, setHora] = useState(new Date())

  const [filtroMesas, setFiltroMesas] = useState('todos')
  const [deliveryPedidos, setDeliveryPedidos] = useState([])
  const [deliveryPedidoSeleccionado, setDeliveryPedidoSeleccionado] = useState(null)
  const [mostrarDelivery, setMostrarDelivery] = useState(false)

  // SIFEN status
  const [sifenStatus, setSifenStatus] = useState(null)

  // Caja session
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [showApertura, setShowApertura] = useState(false)
  const [fondoInicial, setFondoInicial] = useState('')


  // Mesas & cobro
  const [mesas, setMesas] = useState([])
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null)
  const [pedidosMesa, setPedidosMesa] = useState([])
  const [cargando, setCargando] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [propina, setPropina] = useState(0)
  const [propinaCustom, setPropinaCustom] = useState('')
  const [modalCobrar, setModalCobrar] = useState(false)
  const [modalConfirmarCobro, setModalConfirmarCobro] = useState(false)
  const [comprobanteNro, setComprobanteNro] = useState('')
  const [clienteDatos, setClienteDatos] = useState({ nombre: '', ruc: '', tipo: 'consumidor' })
  const [rucResults, setRucResults] = useState([])
  const [rucSearching, setRucSearching] = useState(false)
  const [rucShowDropdown, setRucShowDropdown] = useState(false)
  const [rucError, setRucError] = useState('')
  const rucDebounceRef = useRef(null)
  const buscarRuc = (query) => {
    if (rucDebounceRef.current) clearTimeout(rucDebounceRef.current)
    if (query.length < 3) { setRucResults([]); setRucShowDropdown(false); return }
    rucDebounceRef.current = setTimeout(async () => {
      setRucSearching(true)
      setRucError('')
      try {
        const res = await fetch(`${API_URL}/facturacion/buscar-ruc?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success) {
          setRucResults(data.resultados || [])
          setRucShowDropdown(data.resultados?.length > 0)
        } else {
          setRucResults([])
          setRucShowDropdown(false)
          setRucError(data.error || 'Error al consultar RUC')
        }
      } catch { setRucResults([]); setRucShowDropdown(false); setRucError('Error de conexión') }
      setRucSearching(false)
    }, 300)
  }

  // ====================== BUSQUEDA REIMPRESION ======================

  const LIMITE_PAGINA = 15

  const buscarHistorial = async (pagina = 1) => {
    setBuscando(true)
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
    } catch { }
    setBuscando(false)
  }

  const buscarRucReimpresion = (query) => {
    if (rucDebounceRef.current) clearTimeout(rucDebounceRef.current)
    if (query.length < 3) { setRucResults([]); setRucShowDropdown(false); return }
    rucDebounceRef.current = setTimeout(async () => {
      setRucSearching(true)
      setRucError('')
      try {
        const res = await fetch(`${API_URL}/facturacion/buscar-ruc?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success) {
          setRucResults(data.resultados || [])
          setRucShowDropdown(data.resultados?.length > 0)
        } else {
          setRucResults([])
          setRucShowDropdown(false)
          setRucError(data.error || 'Error al consultar RUC')
        }
      } catch { setRucResults([]); setRucShowDropdown(false); setRucError('Error de conexión') }
      setRucSearching(false)
    }, 300)
  }

  const limpiarFiltros = () => {
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

  const formatearFecha = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const [generarFactura, setGenerarFactura] = useState(false)
  const [tipoIva, setTipoIva] = useState(10)
  const [showTicket, setShowTicket] = useState(false)
  const [ticketData, setTicketData] = useState(null)
  const [empresa, setEmpresa] = useState({ nombre: '', ruc: '', direccion: '', telefono: '', timbrado: '', establecimiento: '001' })
  const [metodosApi, setMetodosApi] = useState([])
  const [vuelto, setVuelto] = useState(0)
  const [montoRecibido, setMontoRecibido] = useState('')
  const [entregando, setEntregando] = useState({})

  // Ingreso / Retiro
  const [showMovimiento, setShowMovimiento] = useState(false)
  const [movTipo, setMovTipo] = useState('ingreso_extra')
  const [movMonto, setMovMonto] = useState('')
  const [movMotivo, setMovMotivo] = useState('')

  // Cierre
  const [showCierre, setShowCierre] = useState(false)
  const [denominaciones, setDenominaciones] = useState(DENOMINACIONES.map(d => ({ ...d, cantidad: '' })))
  const [obsCierre, setObsCierre] = useState('')
  const [resultadoCierre, setResultadoCierre] = useState(null)
  const [showCorteTicket, setShowCorteTicket] = useState(false)

  // Reimpresion
  const [modalReimpresion, setModalReimpresion] = useState(false)
  const [buscarCliente, setBuscarCliente] = useState('')
  const [buscarRucInput, setBuscarRucInput] = useState('')
  const [buscarOrden, setBuscarOrden] = useState('')
  const [buscarFactura, setBuscarFactura] = useState('')
  const [buscarTimbrado, setBuscarTimbrado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([])
  const [totalResultados, setTotalResultados] = useState(0)
  const [paginaActual, setPaginaActual] = useState(1)
  const [resultadoExpandido, setResultadoExpandido] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [reimprimiendoId, setReimprimiendoId] = useState(null)

  const totalPaginas = Math.max(1, Math.ceil(totalResultados / LIMITE_PAGINA))

  const st = s(darkMode)

  const fechaStr = hora.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const horaStr = hora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })

  // ====================== APERTURA DE CAJA ======================
  const verificarSesion = async () => {
    setLoadingSession(true)
    try {
      const res = await fetch(`${API_URL}/caja/sesion-actual`)
      const data = await res.json()
      if (data.success && data.session) {
        setSession(data.session)
        setShowApertura(false)
      } else {
        setSession(null)
        setShowApertura(true)
      }
    } catch { setSession(null); setShowApertura(true) }
    setLoadingSession(false)
  }

  const abrirCaja = async () => {
    const fondo = parseFloat(fondoInicial) || 0
    try {
      const res = await fetch(`${API_URL}/caja/apertura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fondo_inicial: fondo })
      })
      const data = await res.json()
      if (data.success) {
        setSession(data.session)
        setShowApertura(false)
        setFondoInicial('')
        await cargarDatos()
      } else alert(data.error || 'Error al abrir caja')
    } catch (e) { alert('Error de conexión') }
  }

  // ====================== DATOS INICIALES ======================

  const cargarDatos = async () => {
    try {
      const [resMesas, resHistorial, resMetodos, resDelivery] = await Promise.all([
        fetch(`${API_URL}/mesas`),
        fetch(`${API_URL}/caja/movimientos`),
        fetch(`${API_URL}/facturacion/metodos-pago`),
        fetch(`${API_URL}/pedidos?delivery=true`),
      ])
      const dataMesas = await resMesas.json()
      if (dataMesas.success) setMesas(dataMesas.mesas || [])
      const dataMetodos = await resMetodos.json()
      if (dataMetodos.success) setMetodosApi(dataMetodos.metodos || [])
      const dataDelivery = await resDelivery.json()
      if (dataDelivery.success) setDeliveryPedidos(dataDelivery.pedidos || [])
    } catch {}
  }

  const cargarDatosEmpresa = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/config`)
      const data = await res.json()
      if (data.success) {
        const c = data.config
        setEmpresa({ nombre: c.nombre_empresa || '', ruc: c.ruc || '', direccion: c.direccion || '', telefono: c.telefono || '', timbrado: c.timbrado_numero || '', establecimiento: c.establecimiento || '001' })
      }
    } catch {}
  }

  const cargarSifenStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/sifen/status`)
      const data = await res.json()
      if (data.success) setSifenStatus(data)
    } catch {}
  }

  useEffect(() => {
    initDarkMode(); verificarSesion(); cargarDatosEmpresa(); cargarSifenStatus()
  }, [])
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (session) { cargarDatos() }
  }, [session])

  // ====================== CALCULOS ======================

  const redondearGs = (valor) => Math.round(valor / 50) * 50
  const formatearNumero = (val) => {
    if (!val) return ''
    const num = parseInt(val.replace(/[^0-9]/g, ''), 10)
    if (isNaN(num)) return ''
    return num.toLocaleString('es-PY')
  }
  const handleMontoChange = (setter) => (e) => {
    setter(e.target.value.replace(/[^0-9]/g, ''))
  }

  const calcularTotal = () => {
    if (!pedidosMesa || pedidosMesa.length === 0) return 0
    return redondearGs(pedidosMesa.reduce((sum, p) => sum + parseFloat(p.total || 0), 0))
  }

  const calcularPropina = () => {
    const total = calcularTotal()
    if (propinaCustom) return parseFloat(propinaCustom) || 0
    return total * (propina / 100)
  }

  const calcularIva = () => {
    const total = calcularTotal()
    if (tipoIva === 0) return { monto: 0, subtotal: total }
    const ivaMonto = total * tipoIva / (100 + tipoIva)
    return { monto: ivaMonto, subtotal: total - ivaMonto }
  }

  const totalConPropina = calcularTotal() + calcularPropina()

  // ====================== SELECCIONAR MESA Y COBRAR ======================

  const seleccionarMesa = async (mesa) => {
    setMesaSeleccionada(mesa)
    setMetodoPago('efectivo')
    setPropina(0)
    setPropinaCustom('')
    setVuelto(0)
    setMontoRecibido('')
    setDeliveryPedidoSeleccionado(null)
    setGenerarFactura(false)
    setClienteDatos({ nombre: '', ruc: '', tipo: 'consumidor' })
    setComprobanteNro('')
    try {
      const res = await fetch(`${API_URL}/pedidos/mesa/${mesa.id}`)
      const data = await res.json()
      setPedidosMesa(data.pedidos || [])
      setModalCobrar(true)
    } catch {}
  }

  // ====================== ENTREGAR PEDIDO ======================

  const marcarEntregado = async (pedido) => {
    setEntregando(prev => ({ ...prev, [pedido.id]: true }))
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedido.id}/estado`, {
        method: 'POST', body: JSON.stringify({ estado: 'entregado' })
      })
      const data = await res.json()
      if (data.success) {
        setPedidosMesa(prev => prev.map(p => p.id === pedido.id ? { ...p, estado: 'entregado' } : p))
      }
    } catch { }
    setEntregando(prev => ({ ...prev, [pedido.id]: false }))
  }

  // ====================== PROCESAR COBRO ======================

  const procesarCobro = async () => {
    const esDelivery = !!deliveryPedidoSeleccionado
    if (cargando || (!mesaSeleccionada && !esDelivery)) return
    if (metodoPago === 'efectivo' && (!montoRecibido || parseFloat(montoRecibido) < 1)) { alert('El monto recibido debe ser mayor a 0'); return }
    if (metodoPago === 'transferencia' && !comprobanteNro) { alert('Ingrese el N° de comprobante de la transferencia'); return }

    setCargando(true)
    const body = {
      metodo_pago: metodoPago,
      propina: calcularPropina(),
      tipo_iva: tipoIva,
      cliente_tipo: clienteDatos.tipo,
      cliente_ruc: clienteDatos.ruc || '44444444-7',
      cliente_nombre: clienteDatos.nombre || 'Consumidor Final',
      generar_factura: generarFactura,
      monto_recibido: metodoPago === 'efectivo' ? parseFloat(montoRecibido) || 0 : 0,
      usuario_id: session?.usuario_id,
    }
    if (metodoPago === 'transferencia') {
      body.comprobante_nro = comprobanteNro
    }

    try {
      const url = esDelivery
        ? `${API_URL}/pedidos/${deliveryPedidoSeleccionado.id}/pagar`
        : `${API_URL}/pedidos/mesa/${mesaSeleccionada.id}/cobrar`
      const res = await fetch(url, {
        method: 'POST', body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!data.success) {
        if (data.need_apertura) {
          setModalCobrar(false)
          setShowApertura(true)
          alert(data.error)
          setCargando(false)
          return
        }
        alert(data.error || 'Error al cobrar'); setCargando(false); return
      }

      setVuelto(data.vuelto || 0)

      const itemsCompletos = esDelivery
        ? (deliveryPedidoSeleccionado.items || [])
        : (data.pedidos?.flatMap(p => p.items || []) || pedidosMesa)
      const totalFinal = data.total_con_propina || calcularTotal()
      const ticketInfo = {
        id: esDelivery ? deliveryPedidoSeleccionado.id : (data.cobrados?.[0] || mesaSeleccionada?.id || 1),
        numero_orden: esDelivery ? (deliveryPedidoSeleccionado.numero_orden || deliveryPedidoSeleccionado.id) : (data.numero_factura || 1),
        fecha: new Date(), items: itemsCompletos,
        total: totalFinal,
        detalle_pagos: data.detalle_pagos || [],
        metodo_pago: metodoPago,
        tipo_iva: tipoIva,
        propina: calcularPropina(),
        mesa: esDelivery ? 'Delivery' : mesaSeleccionada.numero, delivery: esDelivery, vuelto: data.vuelto || 0,
        monto_recibido: data.monto_recibido || 0,
        nombre_cliente: esDelivery ? (deliveryPedidoSeleccionado.cliente_nombre || deliveryPedidoSeleccionado.nombre_cliente || '') : '',
        telefono_cliente: esDelivery ? (deliveryPedidoSeleccionado.telefono_cliente || '') : '',
        direccion: esDelivery ? (deliveryPedidoSeleccionado.direccion || '') : '',
      }

      const facturaData = data.factura || null
      const sifenError = data.sifen_error || null
      setTicketData({
        type: 'factura', vuelto: data.vuelto || 0, monto_recibido: data.monto_recibido || 0,
        pedido: { ...ticketInfo, cliente: clienteDatos, cdc: facturaData?.cdc || '', kude: facturaData?.kude || '', qr_base64: facturaData?.qr_base64 || '' },
        negocio: empresa, numero: data.numero_factura || null,
        factura: facturaData,
        sifen_error: sifenError,
        cliente: {
          nombre: clienteDatos.tipo === 'consumidor' ? 'Consumidor Final' : clienteDatos.nombre,
          ruc: clienteDatos.tipo === 'consumidor' ? '44444444-7' : clienteDatos.ruc,
          telefono: esDelivery ? (deliveryPedidoSeleccionado.telefono_cliente || '') : '',
          direccion: esDelivery ? (deliveryPedidoSeleccionado.direccion || '') : '-',
        }
      })
      setShowTicket(true)
      setGenerarFactura(false)
      setModalConfirmarCobro(false)
      setCargando(false)
      setDeliveryPedidoSeleccionado(null)
      setSession(prev => ({ ...prev }))
      setTimeout(() => cargarDatos(), 500)
    } catch (e) { alert('Error de conexión'); setCargando(false) }
  }

  // ====================== INGRESO / RETIRO ======================

  const registrarMovimiento = async () => {
    const monto = parseFloat(movMonto)
    if (!monto || monto <= 0) { alert('Ingrese un monto válido'); return }
    if (!movMotivo.trim()) { alert('Ingrese un motivo'); return }
    try {
      const res = await fetch(`${API_URL}/caja/movimiento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: movTipo, monto, motivo: movMotivo, usuario_id: session?.usuario_id })
      })
      const data = await res.json()
      if (data.success) {
        setShowMovimiento(false); setMovMonto(''); setMovMotivo('')
        setSession(prev => ({ ...prev }))
        alert('Movimiento registrado')
      } else { alert(data.error) }
    } catch { alert('Error de conexión') }
  }

  // ====================== ARQUEO Y CIERRE ======================

  const totalContado = () => denominaciones.reduce((sum, d) => sum + (parseInt(d.valor) * (parseInt(d.cantidad) || 0)), 0)

  const cerrarCaja = async () => {
    try {
      const res = await fetch(`${API_URL}/caja/cierre`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          denominaciones: denominaciones.filter(d => d.cantidad),
          observaciones: obsCierre,
      usuario_id: session?.usuario_id,
        })
      })
      const data = await res.json()
      if (data.success) {
        setResultadoCierre(data.corte)
        setShowCierre(false)
        setShowCorteTicket(true)
      } else alert(data.error)
    } catch { alert('Error de conexión') }
  }

  // ====================== RENDER ======================

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a' }}>
        <p style={{ color: '#FF9800', fontSize: '18px' }}>Verificando sesión de caja...</p>
      </div>
    )
  }

  // ==================== MODAL APERTURA ====================
  if (showApertura) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#2d2d2d', borderRadius: '24px', padding: '40px', width: '90%', maxWidth: '420px', textAlign: 'center' }}>
          <span className="material-icons" style={{ fontSize: '64px', color: '#FF9800', marginBottom: '16px' }}>point_of_sale</span>
          <h2 style={{ color: 'white', fontSize: '24px', margin: '0 0 6px' }}>Apertura de Caja</h2>
          <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 24px' }}>Ingrese el fondo inicial para comenzar el turno</p>
 
          <div style={{ marginBottom: '20px', textAlign: 'left' }}>
            <label style={{ color: '#ccc', fontSize: '13px', marginBottom: '6px', display: 'block' }}>Fondo Inicial (Gs.)</label>
            <input type="text" inputMode="numeric" placeholder="0" value={formatearNumero(fondoInicial)} onChange={handleMontoChange(setFondoInicial)}
              style={{ width: '100%', padding: '14px', border: '2px solid #444', borderRadius: '12px', background: '#3a3a3a', color: 'white', fontSize: '18px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button onClick={abrirCaja} style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: '12px', cursor: 'pointer',
            fontSize: '16px', fontWeight: '700', background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white',
          }}>
            ABRIR CAJA
          </button>

          <p style={{ color: '#666', fontSize: '11px', marginTop: '16px' }}>Debe abrir la caja antes de poder cobrar</p>
        </div>
      </div>
    )
  }



  // ==================== DASHBOARD PRINCIPAL ====================
  const sesion = session
  const sTotales = sesion?.totales || {}
  const efectivoEsperado = sTotales.efectivo_esperado || 0

  return (
    <div style={st.page}>


      <div style={st.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={{ width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            <span className="material-icons">home</span>
          </Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px', color: 'white', flex: 1 }}>CAJA</span>

        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ color: '#aaa', fontSize: '12px' }}>Fondo: {formatGuarani(sTotales.fondo_inicial || 0)}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {sifenStatus?.sifen_habilitado && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
              background: sifenStatus.certificado_configurado && sifenStatus.csc_configurado
                ? 'rgba(76,175,80,0.2)' : 'rgba(255,152,0,0.2)',
              color: sifenStatus.certificado_configurado && sifenStatus.csc_configurado
                ? '#81C784' : '#FFB74D',
            }}>
              <span className="material-icons" style={{ fontSize: '14px' }}>
                {sifenStatus.certificado_configurado && sifenStatus.csc_configurado ? 'check_circle' : 'warning'}
              </span>
              SIFEN
            </div>
          )}
          <div style={{ textAlign: 'right', marginRight: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#FF9800', lineHeight: 1.2 }}>{horaStr}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{fechaStr}</div>
          </div>
          {!isMobile && <FullscreenButton />}
          <span className="material-icons" style={{ color: '#aaa', cursor: 'pointer' }} onClick={toggleDarkMode}>dark_mode</span>

        </div>
      </div>

      <div style={{
          display: 'grid',
          height: 'calc(100vh - 64px)', overflow: 'hidden',
          gridTemplateColumns: isMobile ? '1fr' : '70px 1fr',
          paddingBottom: isMobile ? '60px' : '0',
        }}>
        <Sidebar activePath="/app/caja" />
        <div style={st.content}>
        {/* TARJETAS RESUMEN */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ ...st.card, borderLeft: '4px solid #4CAF50' }}>
            <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px' }}>EFECTIVO</p>
            <p style={{ color: darkMode ? '#81C784' : '#2E7D32', fontSize: '18px', fontWeight: '700', margin: 0 }}>{formatGuarani(sTotales.ventas_efectivo || 0)}</p>
            <p style={{ color: '#888', fontSize: '10px', margin: '2px 0 0' }}>En caja: {formatGuarani(efectivoEsperado)}</p>
          </div>
          <div style={{ ...st.card, borderLeft: '4px solid #2196F3' }}>
            <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px' }}>TRANSFERENCIA</p>
            <p style={{ color: '#64B5F6', fontSize: '18px', fontWeight: '700', margin: 0 }}>{formatGuarani(sTotales.ventas_transferencia || 0)}</p>
          </div>
          <div style={{ ...st.card, borderLeft: '4px solid #FF9800' }}>
            <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px' }}>TOTAL VENTAS</p>
            <p style={{ color: '#FFB74D', fontSize: '18px', fontWeight: '700', margin: 0 }}>{formatGuarani(sTotales.total_general || 0)}</p>
            <p style={{ color: '#888', fontSize: '10px', margin: '2px 0 0' }}>{sTotales.total_pedidos || 0} pedidos</p>
          </div>
          <div style={{ ...st.card, borderLeft: '4px solid #E91E63' }}>
            <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px' }}>PROPINAS</p>
            <p style={{ color: '#F48FB1', fontSize: '18px', fontWeight: '700', margin: 0 }}>{formatGuarani(sTotales.propinas || 0)}</p>
          </div>
        </div>

        {/* BOTONES ACCION */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => { setMovTipo('ingreso_extra'); setMovMonto(''); setMovMotivo(''); setShowMovimiento(true) }}
            style={{ ...st.btnPrimary, background: 'linear-gradient(135deg, #4CAF50, #388E3C)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>add_circle</span> Ingreso
          </button>
          <button onClick={() => { setMovTipo('retiro'); setMovMonto(''); setMovMotivo(''); setShowMovimiento(true) }}
            style={{ ...st.btnPrimary, background: 'linear-gradient(135deg, #E53935, #C62828)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>remove_circle</span> Retiro
          </button>
          <button onClick={() => { setShowCierre(true); setDenominaciones(DENOMINACIONES.map(d => ({ ...d, cantidad: '' }))); setObsCierre('') }}
            style={{ ...st.btnPrimary, background: 'linear-gradient(135deg, #E53935, #B71C1C)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>logout</span> Cerrar Caja
          </button>
          <button onClick={() => setModalReimpresion(true)}
            style={{ ...st.btnPrimary, background: 'linear-gradient(135deg, #607D8B, #455A64)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>print</span> Reimprimir
          </button>
        </div>

        {/* TABS: MESAS / DELIVERY */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => setMostrarDelivery(false)} style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: '700',
            cursor: 'pointer', background: !mostrarDelivery ? '#FF9800' : (darkMode ? '#2a2a2a' : '#e0e0e0'),
            color: !mostrarDelivery ? 'white' : (darkMode ? '#ccc' : '#666'),
          }}>
            <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>table_restaurant</span>
            Mesas
          </button>
          <button onClick={() => setMostrarDelivery(true)} style={{
            padding: '8px 18px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: '700',
            cursor: 'pointer', background: mostrarDelivery ? '#FF9800' : (darkMode ? '#2a2a2a' : '#e0e0e0'),
            color: mostrarDelivery ? 'white' : (darkMode ? '#ccc' : '#666'),
          }}>
            <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>delivery_dining</span>
            Delivery
            {deliveryPedidos.filter(p => ['listo', 'entregado'].includes(p.estado)).length > 0 && (
              <span style={{ marginLeft: '6px', background: '#F44336', color: 'white', borderRadius: '50%', padding: '1px 6px', fontSize: '11px' }}>
                {deliveryPedidos.filter(p => ['listo', 'entregado'].includes(p.estado)).length}
              </span>
            )}
          </button>
        </div>

        {!mostrarDelivery ? (
          <>
            {/* FILTRO DE MESAS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ color: darkMode ? '#ccc' : '#333', fontSize: '16px', fontWeight: '600' }}>Mesas</span>
              {['todos', 'libres', 'para_cobrar'].map(f => (
                <button key={f} onClick={() => setFiltroMesas(f)} style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', background: filtroMesas === f ? '#FF9800' : (darkMode ? '#2a2a2a' : '#e0e0e0'),
                  color: filtroMesas === f ? 'white' : (darkMode ? '#ccc' : '#666'), transition: 'all 0.15s'
                }}>
                  {f === 'todos' ? 'Todos' : f === 'libres' ? 'Libres' : 'Para cobrar'}
                </button>
              ))}
            </div>
            {/* GRILLA DE MESAS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
              {mesas.filter(m => filtroMesas === 'todos' || (filtroMesas === 'libres' && m.estado !== 'ocupada') || (filtroMesas === 'para_cobrar' && m.estado === 'ocupada')).map((mesa, i) => {
                const ocupada = mesa.estado === 'ocupada'
                return (
                  <div key={mesa.id} onClick={() => ocupada && seleccionarMesa(mesa)} style={{
                    animationDelay: `${i * 0.05}s`, cursor: ocupada ? 'pointer' : 'default',
                    ...st.card, textAlign: 'center',
                    border: ocupada ? '2px solid #E53935' : '2px solid rgba(76,175,80,0.3)',
                    opacity: ocupada ? 1 : 0.7, transition: 'transform 0.2s',
                  }} onMouseEnter={e => { if (ocupada) e.currentTarget.style.transform = 'scale(1.03)' }}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <span className="material-icons" style={{ fontSize: '36px', color: ocupada ? '#E53935' : '#4CAF50', marginBottom: '4px' }}>table_restaurant</span>
                    <p style={{ fontSize: '20px', fontWeight: '700', margin: '0', color: darkMode ? '#fff' : '#333' }}>Mesa {mesa.numero}</p>
                    <p style={{ fontSize: '11px', color: ocupada ? '#E53935' : '#4CAF50', margin: '2px 0 0' }}>{ocupada ? 'OCUPADA' : 'LIBRE'}</p>
                  </div>
                )
              })}
              {mesas.filter(m => filtroMesas === 'todos' || (filtroMesas === 'libres' && m.estado !== 'ocupada') || (filtroMesas === 'para_cobrar' && m.estado === 'ocupada')).length === 0 && (
                <div style={{ ...st.card, textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
                  <span className="material-icons" style={{ fontSize: '48px', color: '#888' }}>check_circle</span>
                  <p style={{ color: '#888', margin: '8px 0 0' }}>
                    {filtroMesas === 'todos' ? 'No hay mesas' : filtroMesas === 'libres' ? 'No hay mesas libres' : 'No hay mesas para cobrar'}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ color: darkMode ? '#ccc' : '#333', fontSize: '16px', fontWeight: '600' }}>
                Delivery para cobrar ({deliveryPedidos.filter(p => ['listo', 'entregado'].includes(p.estado)).length})
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {deliveryPedidos.filter(p => ['listo', 'entregado'].includes(p.estado)).map((pedido, i) => (
                <div key={pedido.id} onClick={async () => {
                  if (pedido.estado === 'listo') {
                    try {
                      await fetch(`${API_URL}/pedidos/${pedido.id}/estado`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ estado: 'entregado' })
                      })
                      setDeliveryPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, estado: 'entregado' } : p))
                    } catch (e) { console.error('Error:', e) }
                  }
                  setDeliveryPedidoSeleccionado(pedido); setMesaSeleccionada(null); setPedidosMesa([pedido]); setModalCobrar(true); setMetodoPago('efectivo'); setPropina(0); setPropinaCustom(''); setVuelto(0); setMontoRecibido(''); setGenerarFactura(false); setClienteDatos({ nombre: pedido.cliente_nombre || '', ruc: pedido.cliente_ruc || '', tipo: pedido.cliente_ruc ? 'factura' : 'consumidor' }); setComprobanteNro('')
                }} style={{
                  animationDelay: `${i * 0.05}s`, cursor: 'pointer',
                  ...st.card, border: `2px solid ${pedido.estado === 'listo' ? '#4CAF50' : '#FF9800'}`, transition: 'transform 0.2s',
                }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="material-icons" style={{ fontSize: '28px', color: '#FF9800' }}>delivery_dining</span>
                    <span style={{ fontSize: '10px', color: pedido.estado === 'listo' ? '#4CAF50' : '#FF9800', fontWeight: '600' }}>{pedido.estado === 'listo' ? 'LISTO' : 'ENTREGADO'}</span>
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: '700', margin: '6px 0 2px', color: darkMode ? '#fff' : '#333' }}>
                    {pedido.cliente_nombre || 'Cliente'}
                  </p>
                  <p style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#666', margin: '0' }}>
                    #{pedido.numero_orden || pedido.id}
                  </p>
                  <p style={{ fontSize: '18px', fontWeight: '700', margin: '8px 0 0', color: '#FF9800' }}>
                    {formatGuarani(pedido.total || 0)}
                  </p>
                </div>
              ))}
              {deliveryPedidos.filter(p => ['listo', 'entregado'].includes(p.estado)).length === 0 && (
                <div style={{ ...st.card, textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>
                  <span className="material-icons" style={{ fontSize: '48px', color: '#888' }}>check_circle</span>
                  <p style={{ color: '#888', margin: '8px 0 0' }}>No hay entregas pendientes de cobro</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ==================== MODAL COBRAR ==================== */}
      {modalCobrar && (
        <div style={st.overlay}>
          <div style={st.modalLg} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: darkMode ? '#fff' : '#333', fontSize: '20px' }}>
                {deliveryPedidoSeleccionado ? `Cobrar Delivery #${deliveryPedidoSeleccionado.numero_orden || deliveryPedidoSeleccionado.id}` : `Cobrar Mesa ${mesaSeleccionada?.numero}`}
              </h2>
              <span className="material-icons" style={{ cursor: 'pointer', color: '#888' }}
                onClick={() => { setModalCobrar(false); setMesaSeleccionada(null) }}>close</span>
            </div>

            {/* Items del pedido */}
            <div style={{ marginBottom: '16px' }}>
              {pedidosMesa.map((p, i) => (
                <div key={p.id} style={{ marginBottom: '8px' }}>
                  <p style={{ fontWeight: '600', color: darkMode ? '#ddd' : '#555', fontSize: '13px', margin: '0 0 4px' }}>
                    Pedido #{p.numero_orden} - {formatGuarani(p.total || 0)}
                    {p.estado === 'entregado' ? (
                      <span style={{ color: '#4CAF50', fontSize: '12px', marginLeft: '8px' }}>✓ Entregado</span>
                    ) : p.estado === 'listo' ? (
                      <button onClick={() => marcarEntregado(p)} disabled={entregando[p.id]}
                        style={{ marginLeft: '8px', padding: '4px 12px', border: 'none', borderRadius: '6px', cursor: entregando[p.id] ? 'not-allowed' : 'pointer', background: '#4CAF50', color: 'white', fontSize: '12px', fontWeight: '600' }}>
                        {entregando[p.id] ? '...' : 'Entregar'}
                      </button>
                    ) : (
                      <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>({p.estado})</span>
                    )}
                  </p>
                  {(p.items || []).map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: darkMode ? '#aaa' : '#666', padding: '2px 8px' }}>
                      <span>{item.cantidad}x {item.producto_nombre || item.nombre || item.producto}{item.variante ? ` (${item.variante})` : ''}</span>
                      <span>{formatGuarani((item.cantidad || 1) * (item.precio || 0))}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Factura Electrónica */}
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={generarFactura} onChange={e => setGenerarFactura(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <span style={{ color: darkMode ? '#ddd' : '#333', fontSize: '14px' }}>Generar Factura</span>
              </label>
            </div>

            {generarFactura && (
              <div style={{ marginBottom: '16px', padding: '12px', background: darkMode ? '#3a3a3a' : '#f9f9f9', borderRadius: '10px' }}>
                <div style={{ marginBottom: '8px', position: 'relative' }}>
                  <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>RUC Cliente</label>
                  <input type="text" placeholder="44444444-7" value={clienteDatos.ruc}
                    onChange={e => {
                      setClienteDatos({ ...clienteDatos, ruc: e.target.value, tipo: e.target.value ? 'factura' : 'consumidor' })
                      buscarRuc(e.target.value)
                    }}
                    onFocus={() => rucResults.length > 0 && setRucShowDropdown(true)}
                    onBlur={() => setTimeout(() => setRucShowDropdown(false), 200)}
                    style={{ ...st.input, fontSize: '13px' }} />
                  {rucSearching && <span style={{ position: 'absolute', right: '10px', top: '32px', color: '#888' }}>...</span>}
                  {rucError && <div style={{ color: '#f44336', fontSize: '12px', marginTop: '4px' }}>{rucError}</div>}
                  {rucShowDropdown && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: darkMode ? '#2d2d2d' : 'white', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflow: 'auto' }}>
                      {rucResults.map((r, i) => (
                        <div key={i} onMouseDown={() => { setClienteDatos({ ...clienteDatos, ruc: r.ruc, nombre: r.nombre, tipo: 'factura' }); setRucShowDropdown(false); setRucResults([]) }} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: darkMode ? '#fff' : '#333', fontSize: '13px', fontWeight: '600' }}>{r.nombre}</span>
                          <span style={{ color: '#FF9800', fontSize: '12px' }}>{r.ruc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Razón Social</label>
                  <input type="text" placeholder="Nombre del cliente" value={clienteDatos.nombre}
                    onChange={e => setClienteDatos({ ...clienteDatos, nombre: e.target.value })}
                    style={{ ...st.input, fontSize: '13px' }} />
                </div>
              </div>
            )}

            {/* Métodos de Pago */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '13px', fontWeight: '600', margin: '0 0 8px' }}>Método de Pago</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {metodosApi.filter(m => m.activo).map(m => (
                  <button key={m.nombre} onClick={() => { setMetodoPago(m.nombre); setComprobanteNro('') }}
                    style={{
                      padding: '10px 16px', border: metodoPago === m.nombre ? '2px solid ' + m.color : '2px solid transparent',
                      borderRadius: '12px', background: metodoPago === m.nombre ? (darkMode ? '#3a3a3a' : '#fff') : (darkMode ? '#2a2a2a' : '#f5f5f5'),
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: metodoPago === m.nombre ? m.color : (darkMode ? '#ccc' : '#666'), fontWeight: metodoPago === m.nombre ? '700' : '400',
                    }}>
                    <span className="material-icons" style={{ fontSize: '20px' }}>{m.icono || 'payments'}</span>
                    <span style={{ fontSize: '13px' }}>{m.etiqueta}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Monto Recibido + Vuelto (solo efectivo) */}
            {metodoPago === 'efectivo' && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '13px', fontWeight: '600', margin: '0 0 8px' }}>Monto Recibido</p>
                <input type="text" inputMode="numeric" placeholder="Ingrese el monto recibido" value={formatearNumero(montoRecibido)}
                  onChange={handleMontoChange(setMontoRecibido)}
                  style={{ ...st.input, fontSize: '20px', fontWeight: '700', textAlign: 'center', padding: '14px' }} />
                {parseFloat(montoRecibido) > 0 && (
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    {parseFloat(montoRecibido) >= totalConPropina ? (
                      <p style={{ color: '#4CAF50', fontSize: '14px', fontWeight: '700' }}>
                        Vuelto: {formatGuarani(parseFloat(montoRecibido) - totalConPropina)}
                      </p>
                    ) : (
                      <p style={{ color: '#E53935', fontSize: '14px', fontWeight: '600' }}>
                        Faltan: {formatGuarani(totalConPropina - parseFloat(montoRecibido))}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Datos de pago Transferencia */}
            {metodoPago === 'transferencia' && (
              <div style={{ marginBottom: '16px', padding: '12px', background: darkMode ? '#3a3a3a' : '#f5f5f5', borderRadius: '10px' }}>
                <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '13px', fontWeight: '600', margin: '0 0 10px' }}>Datos de la transferencia</p>
                <div>
                  <label style={{ fontSize: '11px', color: darkMode ? '#999' : '#777', display: 'block', marginBottom: '4px' }}>N° Comprobante <span style={{ color: '#E53935' }}>*</span></label>
                  <input type="text" placeholder="Ej: TRANS-123456" value={comprobanteNro} onChange={e => setComprobanteNro(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '13px', background: darkMode ? '#2a2a2a' : 'white', color: darkMode ? '#ccc' : '#333', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Propinas */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '13px', fontWeight: '600', margin: '0 0 8px' }}>Propina</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PROPINAS.map(p => (
                  <button key={p.porcentaje} onClick={() => { setPropina(p.porcentaje); setPropinaCustom('') }}
                    style={{
                      padding: '6px 14px', border: propina === p.porcentaje && !propinaCustom ? '2px solid #FF9800' : '2px solid transparent',
                      borderRadius: '8px', background: propina === p.porcentaje && !propinaCustom ? (darkMode ? '#3a3a3a' : '#fff') : (darkMode ? '#2a2a2a' : '#f5f5f5'),
                      cursor: 'pointer', color: darkMode ? '#ccc' : '#555', fontSize: '12px',
                    }}>{p.label}</button>
                ))}
                <input type="number" placeholder="Otra" value={propinaCustom} onChange={e => { setPropinaCustom(e.target.value); setPropina(0) }}
                  style={{ ...st.input, width: '80px', padding: '6px', fontSize: '12px' }} />
              </div>
            </div>

            {/* IVA */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '13px', fontWeight: '600', margin: '0 0 8px' }}>Tipo de IVA</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[0, 5, 10].map(iva => (
                  <button key={iva} onClick={() => setTipoIva(iva)}
                    style={{
                      padding: '6px 14px', border: tipoIva === iva ? '2px solid #FF9800' : '2px solid transparent',
                      borderRadius: '8px', background: tipoIva === iva ? (darkMode ? '#3a3a3a' : '#fff') : (darkMode ? '#2a2a2a' : '#f5f5f5'),
                      cursor: 'pointer', color: darkMode ? '#ccc' : '#555', fontSize: '12px',
                    }}>{iva === 0 ? 'Exento' : `${iva}%`}</button>
                ))}
              </div>
            </div>

            {/* Totales */}
            <div style={{ background: 'linear-gradient(135deg, #FF9800, #F57C00)', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                <span>Subtotal sin IVA</span>
                <span>{formatGuarani(Math.round(calcularIva().subtotal))}</span>
              </div>
              {calcularIva().monto > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  <span>IVA {tipoIva}%</span>
                  <span>{formatGuarani(Math.round(calcularIva().monto))}</span>
                </div>
              )}
              {calcularPropina() > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  <span>Propina</span>
                  <span>{formatGuarani(calcularPropina())}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'white', fontSize: '18px', fontWeight: '700', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '6px', marginTop: '6px' }}>
                <span>TOTAL</span>
                <span>{formatGuarani(totalConPropina)}</span>
              </div>
            </div>

            {/* Botones acción */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setModalCobrar(false); setMesaSeleccionada(null) }}
                style={{ ...st.btn, background: darkMode ? '#3a3a3a' : '#f0f0f0', color: darkMode ? '#ccc' : '#555', flex: 1 }}>Cancelar</button>
              <button onClick={() => setModalConfirmarCobro(true)} disabled={cargando || (metodoPago === 'efectivo' && (!montoRecibido || parseFloat(montoRecibido) < 1)) || (metodoPago === 'transferencia' && !comprobanteNro)}
                style={{ ...st.btnPrimary, flex: 2, opacity: (cargando || (metodoPago === 'efectivo' && (!montoRecibido || parseFloat(montoRecibido) < 1)) || (metodoPago === 'transferencia' && !comprobanteNro)) ? 0.5 : 1 }}>
                {cargando ? 'PROCESANDO...' : `COBRAR ${formatGuarani(totalConPropina)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL CONFIRMAR COBRO ==================== */}
      {modalConfirmarCobro && (
        <div style={st.overlay}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: darkMode ? '#fff' : '#333', margin: '0 0 12px', textAlign: 'center' }}>Confirmar Cobro</h3>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '14px', margin: '4px 0' }}>Mesa: {mesaSeleccionada?.numero}</p>
              <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '14px', margin: '4px 0' }}>Total: <strong>{formatGuarani(totalConPropina)}</strong></p>
              <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '14px', margin: '4px 0' }}>Método: {metodosApi.find(m => m.nombre === metodoPago)?.etiqueta || metodoPago}</p>
              {parseFloat(montoRecibido) > 0 && <p style={{ color: '#4CAF50', fontSize: '14px', margin: '4px 0' }}>Recibido: {formatGuarani(parseFloat(montoRecibido))}</p>}
              {parseFloat(montoRecibido) > totalConPropina && (
                <p style={{ color: '#4CAF50', fontSize: '16px', fontWeight: '700', margin: '4px 0', textAlign: 'center' }}>
                  Vuelto a entregar: {formatGuarani(parseFloat(montoRecibido) - totalConPropina)}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setModalConfirmarCobro(false)} style={{ ...st.btn, background: darkMode ? '#3a3a3a' : '#f0f0f0', color: darkMode ? '#ccc' : '#555', flex: 1 }}>Cancelar</button>
              <button onClick={() => { setModalConfirmarCobro(false); procesarCobro() }} style={{ ...st.btnPrimary, flex: 2 }}>CONFIRMAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TICKET ==================== */}
      {showTicket && ticketData && (
        <TicketFactura
          pedido={ticketData.pedido}
          negocio={ticketData.negocio}
          cliente={ticketData.cliente}
          numero={ticketData.numero}
          factura={ticketData.factura}
          vuelto={ticketData.vuelto}
          montoRecibido={ticketData.monto_recibido}
          sifen_error={ticketData.sifen_error}
          onClose={() => {
            setShowTicket(false)
            setModalCobrar(false)
            setMesaSeleccionada(null)
            setPedidosMesa([])
            setClienteDatos({ nombre: '', ruc: '', tipo: 'consumidor' })
            verificarSesion()
            cargarDatos()
          }}
        />
      )}

      {/* ==================== MODAL INGRESO / RETIRO ==================== */}
      {showMovimiento && (
        <div style={st.overlay} onClick={() => setShowMovimiento(false)}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: darkMode ? '#fff' : '#333', margin: '0 0 16px' }}>
              {movTipo === 'ingreso_extra' ? '💰 Ingreso Extra' : '💸 Retiro de Efectivo'}
            </h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Monto (Gs.)</label>
              <input type="text" inputMode="numeric" placeholder="0" value={formatearNumero(movMonto)} onChange={handleMontoChange(setMovMonto)}
                style={st.input} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Motivo</label>
              <input type="text" placeholder={movTipo === 'ingreso_extra' ? 'Ej: Pago de cuenta anterior' : 'Ej: Compra de insumos'}
                value={movMotivo} onChange={e => setMovMotivo(e.target.value)} style={st.input} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowMovimiento(false)} style={{ ...st.btn, background: darkMode ? '#3a3a3a' : '#f0f0f0', color: darkMode ? '#ccc' : '#555', flex: 1 }}>Cancelar</button>
              <button onClick={registrarMovimiento} style={{ ...st.btnPrimary, flex: 2 }}>REGISTRAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL CIERRE DE CAJA ==================== */}
      {showCierre && (
        <div style={st.overlay} onClick={() => setShowCierre(false)}>
          <div style={{ ...st.modalLg, maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: darkMode ? '#fff' : '#333', margin: '0 0 16px', textAlign: 'center' }}>
              🛑 Cierre de Caja
            </h3>

            {/* Denomminaciones */}
            <p style={{ color: darkMode ? '#ccc' : '#555', fontSize: '14px', fontWeight: '600', margin: '0 0 8px' }}>Conteo de Billetes / Monedas</p>
            <div style={{ marginBottom: '16px' }}>
              {denominaciones.map((d, idx) => (
                <div key={d.valor} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: darkMode ? '#ccc' : '#555', width: '90px', fontSize: '13px', textAlign: 'right' }}>{d.label}</span>
                  <span style={{ color: '#666', fontSize: '13px' }}>×</span>
                  <input type="number" min="0" placeholder="0" value={d.cantidad}
                    onChange={e => { const newD = [...denominaciones]; newD[idx] = { ...newD[idx], cantidad: e.target.value }; setDenominaciones(newD) }}
                    style={{ ...st.input, width: '60px', padding: '6px', fontSize: '13px', textAlign: 'center' }} />
                  <span style={{ color: darkMode ? '#aaa' : '#888', fontSize: '12px' }}>= {formatGuarani((parseInt(d.valor) * (parseInt(d.cantidad) || 0)))}</span>
                </div>
              ))}
              <p style={{ textAlign: 'right', color: '#FF9800', fontSize: '16px', fontWeight: '700', margin: '8px 0 0' }}>
                Total: {formatGuarani(totalContado())}
              </p>
            </div>

            {/* Observaciones */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#888', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Observaciones</label>
              <textarea value={obsCierre} onChange={e => setObsCierre(e.target.value)} rows="2"
                style={{ ...st.input, resize: 'none' }} placeholder="Notas sobre el cierre..." />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCierre(false)} style={{ ...st.btn, background: darkMode ? '#3a3a3a' : '#f0f0f0', color: darkMode ? '#ccc' : '#555', flex: 1 }}>Cancelar</button>
              <button onClick={cerrarCaja} disabled={totalContado() === 0}
                style={{ ...st.btnPrimary, flex: 2, opacity: totalContado() === 0 ? 0.5 : 1 }}>
                CERRAR CAJA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CORTE TICKET ==================== */}
      {showCorteTicket && resultadoCierre && (
        <div style={st.overlay} onClick={() => { setShowCorteTicket(false); setSession(null); setShowApertura(true) }}>
          <div style={{ background: '#fff', maxWidth: '450px', width: '95%', padding: '25px', borderRadius: '20px', fontFamily: "'Courier New', monospace", maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 'bold', color: '#000' }}>{empresa.nombre || 'RESTAURANTE'}</h3>
              <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0', color: '#000' }}>RUC: {empresa.ruc}</p>
              <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0', color: '#000' }}>CORTE DE CAJA</p>
              <p style={{ fontSize: '11px', fontWeight: 'bold', margin: '0', color: '#000' }}>{new Date(resultadoCierre.created_at).toLocaleString('es-PY')}</p>
            </div>
            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '10px 0', marginBottom: '10px', color: '#000', fontWeight: 'bold' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}><span>Cajero:</span><span>{session?.usuario || 'Sin asignar'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold' }}><span>Fondo Inicial:</span><span>{formatGuarani(resultadoCierre.fondo_inicial)}</span></div>
            </div>
            <div style={{ marginBottom: '10px', color: '#000', fontWeight: 'bold' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 6px', color: '#000' }}>VENTAS</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}><span>Efectivo:</span><span>{formatGuarani(resultadoCierre.total_ventas_efectivo)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}><span>Transferencia:</span><span>{formatGuarani(resultadoCierre.total_ventas_transferencia)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', borderTop: '1px solid #ccc', paddingTop: '3px', marginTop: '3px', color: '#000' }}><span>Total Ventas:</span><span>{formatGuarani(resultadoCierre.total_ventas)}</span></div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#4CAF50' }}><span>+ Ingresos:</span><span>{formatGuarani(resultadoCierre.total_ingresos_extra)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#E53935' }}><span>- Retiros:</span><span>{formatGuarani(resultadoCierre.total_retiros)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#E91E63' }}><span>Propinas:</span><span>{formatGuarani(resultadoCierre.total_propinas)}</span></div>
            </div>
            <div style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '8px 0', marginBottom: '12px', color: '#000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#000' }}><span>ESPERADO:</span><span>{formatGuarani(resultadoCierre.total_esperado)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#000' }}><span>CONTADO:</span><span>{formatGuarani(resultadoCierre.total_contado_efectivo)}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', paddingTop: '4px', color: '#000' }}>
                <span>{resultadoCierre.tipo_diferencia === 'sobrante' ? 'SOBRANTE' : resultadoCierre.tipo_diferencia === 'faltante' ? 'FALTANTE' : 'DIFERENCIA'}:</span>
                <span style={{ color: resultadoCierre.diferencia > 0 ? '#4CAF50' : resultadoCierre.diferencia < 0 ? '#E53935' : '#000', fontWeight: 'bold' }}>
                  {resultadoCierre.diferencia > 0 ? '+' : ''}{formatGuarani(resultadoCierre.diferencia)}
                </span>
              </div>
            </div>
            {resultadoCierre.observaciones && <p style={{ fontSize: '10px', fontWeight: 'bold', color: '#000', textAlign: 'center', margin: '0 0 12px' }}>Obs: {resultadoCierre.observaciones}</p>}
            <button
              onClick={() => { setShowCorteTicket(false); setSession(null); setShowApertura(true) }}
              style={{
                width: '100%', padding: '14px', border: 'none', borderRadius: '12px',
                background: 'linear-gradient(135deg, #FF9800, #F57C00)',
                color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* ==================== MODAL REIMPRESION AVANZADO ==================== */}
      {modalReimpresion && (
        <div style={st.overlay} onClick={() => setModalReimpresion(false)}>
          <div style={{ ...st.modalLg, maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: darkMode ? '#fff' : '#333', margin: 0 }}>🖨️ Reimprimir Ticket</h3>
              <button onClick={() => { setModalReimpresion(false); limpiarFiltros() }} style={{ background: 'none', border: 'none', color: '#888', fontSize: '24px', cursor: 'pointer', padding: 0 }}>&times;</button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <input type="text" placeholder="Cliente" value={buscarCliente} onChange={e => setBuscarCliente(e.target.value)} style={st.input} />
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="RUC" value={buscarRucInput} onChange={e => { setBuscarRucInput(e.target.value); buscarRucReimpresion(e.target.value) }}
                  onFocus={() => rucResults.length > 0 && setRucShowDropdown(true)}
                  onBlur={() => setTimeout(() => setRucShowDropdown(false), 200)}
                  style={st.input} />
                {rucSearching && <span style={{ position: 'absolute', right: '8px', top: '10px', color: '#888', fontSize: '12px' }}>...</span>}
                {rucShowDropdown && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: darkMode ? '#2d2d2d' : 'white', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', zIndex: 10, maxHeight: '150px', overflow: 'auto' }}>
                    {rucResults.map((r, i) => (
                      <div key={i} onMouseDown={() => { setBuscarRucInput(r.ruc); setBuscarCliente(r.nombre); setRucShowDropdown(false) }}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '13px' }}>
                        <span style={{ color: darkMode ? '#fff' : '#333' }}>{r.nombre}</span>
                        <span style={{ color: '#FF9800', marginLeft: '8px', fontSize: '12px' }}>{r.ruc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input type="text" placeholder="N° Orden" value={buscarOrden} onChange={e => setBuscarOrden(e.target.value)} style={st.input} />
              <input type="text" placeholder="N° Factura" value={buscarFactura} onChange={e => setBuscarFactura(e.target.value)} style={st.input} />
              <input type="text" placeholder="N° Timbrado" value={buscarTimbrado} onChange={e => setBuscarTimbrado(e.target.value)} style={st.input} />
              <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={st.input} title="Desde" />
              <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={st.input} title="Hasta" />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => buscarHistorial(1)} disabled={buscando} style={{ ...st.btnPrimary, flex: 2, opacity: buscando ? 0.5 : 1 }}>
                  {buscando ? 'Buscando...' : '🔍 Buscar'}
                </button>
                <button onClick={limpiarFiltros} style={{ ...st.btn, background: darkMode ? '#3a3a3a' : '#f0f0f0', color: darkMode ? '#ccc' : '#555', flex: 1, padding: '8px' }}>Limpiar</button>
              </div>
            </div>

            {/* Resultados */}
            <div style={{ maxHeight: '420px', overflow: 'auto', borderRadius: '8px', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
              {resultadosBusqueda.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#888', fontSize: '14px' }}>
                  {buscando ? 'Buscando...' : 'Use los filtros y haga clic en Buscar'}
                </div>
              ) : (
                <div style={{ minWidth: isMobile ? '600px' : 'auto' }}>
                  {/* Header tabla */}
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 100px 100px 60px', padding: '8px 12px', background: darkMode ? '#2a2a2a' : '#f5f5f5', fontSize: '11px', fontWeight: '700', color: darkMode ? '#aaa' : '#666', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
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
                        style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 100px 100px 60px', padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, background: resultadoExpandido === p.id ? (darkMode ? '#2a2a2a' : '#f9f9f9') : 'transparent', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: darkMode ? '#aaa' : '#888' }}>{formatearFecha(p.created_at)}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: darkMode ? '#fff' : '#333' }}>#{p.numero_orden}</span>
                        <div>
                          <span style={{ fontSize: '12px', color: darkMode ? '#ddd' : '#444' }}>{p.cliente_nombre}</span>
                          {p.cliente_ruc && p.cliente_ruc !== '44444444-7' && (
                            <span style={{ fontSize: '10px', color: '#888', marginLeft: '6px' }}>({p.cliente_ruc})</span>
                          )}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#4CAF50' }}>{formatGuarani(p.total)}</span>
                        <span style={{ fontSize: '11px', color: p.factura?.numero ? '#FF9800' : '#888' }}>{p.factura?.numero || '-'}</span>
                        <button onClick={async (e) => { e.stopPropagation(); setReimprimiendoId(p.id); try { await printTicketFactura(p, empresa, { nombre: p.cliente_nombre, ruc: p.cliente_ruc }, p.factura?.numero || p.numero_orden) } catch (e) { console.error(e) } setReimprimiendoId(null) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>
                          {reimprimiendoId === p.id ? '⏳' : '🖨️'}
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
                </div>
              )}
            </div>

            {/* Paginacion */}
            {totalResultados > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <button onClick={() => buscarHistorial(paginaActual - 1)} disabled={paginaActual <= 1 || buscando}
                  style={{ ...st.btn, padding: '6px 12px', fontSize: '12px', opacity: paginaActual <= 1 ? 0.4 : 1 }}>◀ Anterior</button>
                <span style={{ fontSize: '13px', color: darkMode ? '#ccc' : '#555' }}>Página {paginaActual} de {totalPaginas}</span>
                <button onClick={() => buscarHistorial(paginaActual + 1)} disabled={paginaActual >= totalPaginas || buscando}
                  style={{ ...st.btn, padding: '6px 12px', fontSize: '12px', opacity: paginaActual >= totalPaginas ? 0.4 : 1 }}>Siguiente ▶</button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>


    </div>
  )
}
