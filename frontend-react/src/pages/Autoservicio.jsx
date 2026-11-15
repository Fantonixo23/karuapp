import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import UserButton from '../components/UserButton'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'
import { getApiUrl, getMediaUrl } from '../utils/api'

const API_URL = getApiUrl()
const MEDIA_URL = getMediaUrl()

const ESTADOS = {
  pendiente: { label: 'Pendiente', color: '#E53935', bg: '#FFEBEE' },
  cocinando: { label: 'Preparando', color: '#F9A825', bg: '#FFF8E1' },
  listo: { label: 'Listo', color: '#2E7D32', bg: '#E8F5E9' },
  entregado: { label: 'Entregado', color: '#1565C0', bg: '#E3F2FD' },
  pagado: { label: 'Pagado', color: '#455A64', bg: '#ECEFF1' },
  cancelado: { label: 'Cancelado', color: '#B71C1C', bg: '#FFEBEE' },
}

const ESTADOS_ACTIVOS = ['pendiente', 'cocinando', 'listo', 'entregado']

const fmtGs = (n) => `Gs. ${Math.round(Number(n) || 0).toLocaleString('es-PY')}`

const fmtCantidad = (n) => {
  const num = Number(n) || 0
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '')
}

const fmtHora = (fecha) => {
  if (!fecha) return ''
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })
}

const imgSrc = (producto) => {
  const img = producto?.imagen
  if (!img) return ''
  if (/^https?:\/\//i.test(img) || /^data:/i.test(img)) return img
  return `${MEDIA_URL}${img.startsWith('/') ? '' : '/'}${img}`
}

export default function Autoservicio() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  const [vista, setVista] = useState('tickets')
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [cargando, setCargando] = useState(true)

  const [carrito, setCarrito] = useState([])
  const [notas, setNotas] = useState('')
  const [ticketEditando, setTicketEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const [menuProductoId, setMenuProductoId] = useState('')
  const [menuPrecio, setMenuPrecio] = useState('0')
  const [menuPeso, setMenuPeso] = useState('1')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

  const [productoModal, setProductoModal] = useState(null)
  const [cantidadModal, setCantidadModal] = useState('1')
  const [notaModal, setNotaModal] = useState('')

  const [detalleId, setDetalleId] = useState(null)
  const [verTodos, setVerTodos] = useState(false)
  const [busquedaTicket, setBusquedaTicket] = useState('')
  const [confirmacion, setConfirmacion] = useState(null)
  const [exito, setExito] = useState(null)
  const [mensajeError, setMensajeError] = useState('')
  const [accionCargando, setAccionCargando] = useState(false)

  const bg = darkMode ? '#121212' : '#f0f2f5'
  const cardBg = darkMode ? '#1e1e1e' : '#ffffff'
  const softBg = darkMode ? '#161616' : '#f7f7f7'
  const borderColor = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textColor = darkMode ? '#f5f5f5' : '#1a1a1a'
  const muted = darkMode ? 'rgba(255,255,255,0.55)' : '#777'

  const card = {
    background: cardBg,
    border: `1px solid ${borderColor}`,
    borderRadius: '10px',
  }

  const inputStyle = {
    width: '100%',
    padding: '9px 10px',
    border: `1px solid ${borderColor}`,
    borderRadius: '10px',
    background: darkMode ? '#141414' : '#fff',
    color: textColor,
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '11px',
    fontWeight: 700,
    color: muted,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  }

  const btnPrimary = {
    border: 'none',
    borderRadius: '10px',
    background: '#FF9800',
    color: '#1a1a1a',
    fontSize: '13px',
    fontWeight: 800,
    padding: '10px 14px',
    cursor: 'pointer',
  }

  const btnSecondary = {
    border: `1px solid ${borderColor}`,
    borderRadius: '10px',
    background: darkMode ? '#242424' : '#fff',
    color: textColor,
    fontSize: '13px',
    fontWeight: 700,
    padding: '10px 14px',
    cursor: 'pointer',
  }

  const btnDanger = {
    border: '1px solid rgba(229,57,53,0.4)',
    borderRadius: '10px',
    background: darkMode ? 'rgba(229,57,53,0.16)' : '#FFEBEE',
    color: darkMode ? '#FF8A80' : '#C62828',
    fontSize: '13px',
    fontWeight: 800,
    padding: '10px 14px',
    cursor: 'pointer',
  }

  const iconBtn = {
    border: 'none',
    background: 'transparent',
    color: muted,
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
  }

  const overlay = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  }

  const modal = {
    ...card,
    padding: '18px',
    width: '100%',
    maxWidth: '460px',
    maxHeight: '90vh',
    overflowY: 'auto',
  }

  const chip = (activo, suave = false) => ({
    border: activo ? '1px solid #FF9800' : `1px solid ${borderColor}`,
    background: activo ? (suave ? 'rgba(255,152,0,0.14)' : '#FF9800') : (darkMode ? '#202020' : '#fff'),
    color: activo && !suave ? '#1a1a1a' : textColor,
    fontSize: '12px',
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: '999px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  const categoriasMap = useMemo(() => {
    const map = {}
    categorias.forEach((c) => { map[c.id] = c.nombre })
    return map
  }, [categorias])

  const menuProducts = useMemo(() => {
    const conMenu = categorias.filter((c) => /men[uú]/i.test(c.nombre || ''))
    const principales = conMenu.length
      ? conMenu
      : categorias.filter((c) => /plato|principal/i.test(c.nombre || ''))

    let ids = new Set(principales.map((c) => Number(c.id)))
    let lista = productos.filter((p) => ids.has(Number(p.categoria_id)))

    if (!lista.length) {
      const excluir = new Set(
        categorias
          .filter((c) => /bebida|postre|trago|helado/i.test(c.nombre || ''))
          .map((c) => Number(c.id)),
      )
      lista = productos.filter((p) => !excluir.has(Number(p.categoria_id)))
    }

    return lista.length ? lista : productos
  }, [categorias, productos])

  useEffect(() => {
    if (menuProducts.length && !menuProducts.some((p) => Number(p.id) === Number(menuProductoId))) {
      setMenuProductoId(String(menuProducts[0].id))
    }
  }, [menuProducts, menuProductoId])

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter((p) => {
      if (categoriaFiltro !== 'todas' && Number(p.categoria_id) !== Number(categoriaFiltro)) return false
      if (q && !String(p.nombre || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [productos, categoriaFiltro, busqueda])

  const menuProducto = useMemo(
    () => productos.find((p) => Number(p.id) === Number(menuProductoId)) || null,
    [productos, menuProductoId],
  )

  useEffect(() => {
    const p = productos.find((x) => Number(x.id) === Number(menuProductoId))
    if (p) setMenuPrecio(String(Number(p.precio) || 0))
  }, [menuProductoId])

  const pesoNum = Number.parseFloat(menuPeso) || 0
  const precioNum = Number.parseFloat(menuPrecio) || 0
  const subtotalMenu = Math.round(precioNum * pesoNum)
  const totalCarrito = Math.round(
    carrito.reduce((sum, item) => sum + (Number(item.precio) || 0) * (Number(item.cantidad) || 0), 0),
  )
  const subtotalModal = Math.round((Number(productoModal?.precio) || 0) * (Number(cantidadModal) || 0))

  const ticketsActivos = useMemo(
    () => pedidos.filter((p) => ESTADOS_ACTIVOS.includes(p.estado)),
    [pedidos],
  )

  const ticketsMostrados = useMemo(() => {
    const base = verTodos ? pedidos : ticketsActivos
    const q = busquedaTicket.trim().toLowerCase()
    if (!q) return base
    return base.filter((p) => String(p.numero_orden || p.id).toLowerCase().includes(q))
  }, [pedidos, verTodos, ticketsActivos, busquedaTicket])

  const ticketDetalle = useMemo(
    () => pedidos.find((p) => Number(p.id) === Number(detalleId)) || null,
    [pedidos, detalleId],
  )

  const itemsDe = (pedido) => (Array.isArray(pedido?.items) ? pedido.items : [])

  const cargarDatos = async (silencioso = false) => {
    if (!silencioso) {
      setCargando(true)
      setMensajeError('')
    }

    try {
      const [resProductos, resCategorias, resPedidos] = await Promise.all([
        fetch(`${API_URL}/productos`),
        fetch(`${API_URL}/categorias`),
        fetch(`${API_URL}/pedidos?tipo_pedido=autoservicio`),
      ])

      const [dataProductos, dataCategorias, dataPedidos] = await Promise.all([
        resProductos.json(),
        resCategorias.json(),
        resPedidos.json(),
      ])

      let fallo = ''

      if (dataProductos.success) {
        setProductos((dataProductos.productos || []).filter((p) => p.disponible !== false))
      } else {
        fallo = dataProductos.error || 'No se pudieron cargar los productos'
      }

      if (dataCategorias.success) {
        setCategorias(dataCategorias.categorias || [])
      }

      if (dataPedidos.success) {
        setPedidos((dataPedidos.pedidos || []).filter((p) => p.tipo_pedido === 'autoservicio'))
      } else if (!fallo) {
        fallo = dataPedidos.error || 'No se pudieron cargar los tickets'
      }

      if (fallo && !silencioso) setMensajeError(fallo)
    } catch (e) {
      if (!silencioso) setMensajeError('Error de conexión')
    } finally {
      if (!silencioso) setCargando(false)
    }
  }

  useEffect(() => {
    initDarkMode()
    syncDarkMode()
    cargarDatos()
    const intervalo = setInterval(() => cargarDatos(true), 15000)
    return () => clearInterval(intervalo)
  }, [])

  const nuevoTicket = () => {
    setCarrito([])
    setNotas('')
    setTicketEditando(null)
    setMensajeError('')
    setProductoModal(null)
    setVista('nuevo')
  }

  const volver = () => {
    if (carrito.length && !window.confirm('¿Descartar los productos cargados en este ticket?')) return
    setVista('tickets')
    setCarrito([])
    setNotas('')
    setTicketEditando(null)
    setMensajeError('')
  }

  const agregarAlTicket = (pedido) => {
    setCarrito([])
    setNotas('')
    setTicketEditando(pedido)
    setMensajeError('')
    setDetalleId(null)
    setVista('nuevo')
  }

  const agregarMenu = () => {
    if (!menuProducto) {
      setMensajeError('Seleccioná un menú')
      return
    }
    const peso = Math.round(pesoNum * 100) / 100
    if (!(peso > 0)) {
      setMensajeError('Ingresá el peso en kg del menú')
      return
    }
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setMensajeError('Ingresá un precio por kg válido')
      return
    }
    const precio = Math.round(precioNum * 100) / 100

    setCarrito((prev) => {
      const idx = prev.findIndex(
        (i) => i.es_menu && Number(i.producto_id) === Number(menuProducto.id) && Number(i.precio) === precio,
      )
      if (idx >= 0) {
        const copia = [...prev]
        copia[idx] = { ...copia[idx], cantidad: Math.round((Number(copia[idx].cantidad) + peso) * 100) / 100 }
        return copia
      }
      return [
        ...prev,
        {
          key: `menu-${menuProducto.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          producto_id: menuProducto.id,
          producto_nombre: menuProducto.nombre,
          categoria_nombre: categoriasMap[menuProducto.categoria_id] || '',
          precio,
          cantidad: peso,
          es_menu: true,
          nota: '',
        },
      ]
    })

    setMenuPeso('1')
    setMensajeError('')
  }

  const abrirProductoModal = (producto) => {
    setProductoModal(producto)
    setCantidadModal('1')
    setNotaModal('')
  }

  const agregarProductoNormal = () => {
    if (!productoModal) return
    const cantidad = Math.max(1, Math.round(Number(cantidadModal) || 1))
    const nota = notaModal.trim()

    setCarrito((prev) => {
      const idx = prev.findIndex(
        (i) => !i.es_menu && Number(i.producto_id) === Number(productoModal.id) && (i.nota || '') === nota,
      )
      if (idx >= 0) {
        const copia = [...prev]
        copia[idx] = { ...copia[idx], cantidad: Number(copia[idx].cantidad) + cantidad }
        return copia
      }
      return [
        ...prev,
        {
          key: `prod-${productoModal.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          producto_id: productoModal.id,
          producto_nombre: productoModal.nombre,
          categoria_nombre: categoriasMap[productoModal.categoria_id] || '',
          precio: Number(productoModal.precio) || 0,
          cantidad,
          es_menu: false,
          nota,
        },
      ]
    })

    setProductoModal(null)
    setMensajeError('')
  }

  const actualizarCantidad = (key, valor) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        const n = Number(valor) || 0
        const cantidad = item.es_menu
          ? Math.max(0, Math.round(n * 100) / 100)
          : Math.max(0, Math.floor(n))
        return { ...item, cantidad }
      }),
    )
  }

  const actualizarPrecio = (key, valor) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item
        const n = Number(valor) || 0
        return { ...item, precio: Math.max(0, Math.round(n * 100) / 100) }
      }),
    )
  }

  const quitarDelCarrito = (key) => {
    setCarrito((prev) => prev.filter((item) => item.key !== key))
  }

  const emitirTicket = async () => {
    if (guardando) return
    if (!carrito.length) {
      setMensajeError('Agregá al menos un producto al ticket')
      return
    }
    if (carrito.some((item) => !(Number(item.cantidad) > 0))) {
      setMensajeError('Hay productos con cantidad 0. Corregí o quitá esas líneas.')
      return
    }

    const items = carrito.map((item) => {
      const base = {
        producto_id: item.producto_id,
        producto_nombre: item.producto_nombre,
        categoria_nombre: item.categoria_nombre,
        cantidad: Number(item.cantidad),
        precio: Number(item.precio),
        variante: null,
        nota: item.es_menu ? `${fmtCantidad(item.cantidad)} kg` : (item.nota || ''),
      }
      return item.es_menu ? { ...base, precio_manual: true } : base
    })

    setGuardando(true)
    setMensajeError('')

    try {
      if (ticketEditando) {
        const res = await fetch(`${API_URL}/pedidos/${ticketEditando.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        })
        const data = await res.json()
        if (data.success) {
          const pedido = ticketEditando
          setCarrito([])
          setNotas('')
          setTicketEditando(null)
          setVista('tickets')
          setDetalleId(pedido.id)
          setExito({
            titulo: 'Añadidos guardados',
            mensaje: `Ticket #${pedido.numero_orden || pedido.id}`,
            total: data.pedido?.total,
            pedido,
          })
          cargarDatos(true)
        } else {
          setMensajeError(data.error || data.message || 'No se pudieron agregar los items')
        }
      } else {
        const res = await fetch(`${API_URL}/pedidos/crear`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo_pedido: 'autoservicio',
            items,
            total: totalCarrito,
            notas: notas.trim() || null,
          }),
        })
        const data = await res.json()
        if (data.success) {
          const pedido = data.pedido
          setCarrito([])
          setNotas('')
          setVista('tickets')
          setExito({
            titulo: 'Ticket creado',
            mensaje: `Ticket #${pedido.numero_orden || pedido.id}`,
            total: pedido.total,
            pedido,
          })
          cargarDatos(true)
        } else {
          setMensajeError(data.error || data.message || 'No se pudo crear el ticket')
        }
      }
    } catch (e) {
      setMensajeError('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const entregarTicket = async (pedido) => {
    if (accionCargando) return
    setAccionCargando(true)
    setMensajeError('')
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedido.id}/estado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'entregado' }),
      })
      const data = await res.json()
      if (!data.success) setMensajeError(data.error || data.message || 'No se pudo marcar como entregado')
      else await cargarDatos(true)
    } catch (e) {
      setMensajeError('Error de conexión')
    } finally {
      setAccionCargando(false)
    }
  }

  const cobrarTicket = async (pedido) => {
    if (accionCargando) return
    setAccionCargando(true)
    setMensajeError('')
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedido.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo_pago: 'efectivo' }),
      })
      const data = await res.json()
      if (data.success) {
        setConfirmacion(null)
        setDetalleId(null)
        setExito({
          titulo: 'Cobro registrado',
          mensaje: `Ticket #${pedido.numero_orden || pedido.id}`,
          total: data.pedido?.total,
          pedido,
        })
        await cargarDatos(true)
      } else {
        setMensajeError(data.error || data.message || 'No se pudo cobrar el ticket')
      }
    } catch (e) {
      setMensajeError('Error de conexión')
    } finally {
      setAccionCargando(false)
    }
  }

  const cancelarTicket = async (pedido) => {
    if (accionCargando) return
    setAccionCargando(true)
    setMensajeError('')
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedido.id}/cancelar`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setConfirmacion(null)
        setDetalleId(null)
        setExito({
          titulo: 'Ticket cancelado',
          mensaje: `Ticket #${pedido.numero_orden || pedido.id}`,
          pedido,
        })
        await cargarDatos(true)
      } else {
        setMensajeError(data.error || data.message || 'No se pudo cancelar el ticket')
      }
    } catch (e) {
      setMensajeError('Error de conexión')
    } finally {
      setAccionCargando(false)
    }
  }

  const estadoDe = (pedido) => ESTADOS[pedido?.estado] || ESTADOS.pendiente

  return (
    <div style={{ minHeight: '100vh', background: bg, color: textColor }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: '#1a1a1a',
        color: 'white',
        borderBottom: '1px solid rgba(255,152,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={{
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
          }}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="LaCarta" style={{ width: '28px', height: '28px', borderRadius: '10px' }} />
          <span style={{ fontSize: '18px', fontWeight: '700' }}>Autoservicio</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <FullscreenButton />
          <UserButton slim />
          <button onClick={toggleDarkMode} style={{
            width: '36px',
            height: '36px',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '18px',
            cursor: 'pointer',
          }}>
            <span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', paddingBottom: isMobile ? '60px' : '0' }}>
        {!isMobile && <Sidebar activePath="/app/autoservicio" />}

        <div style={{
          flex: 1,
          padding: isMobile ? '12px' : '20px',
          width: '100%',
          maxWidth: vista === 'nuevo' ? '1350px' : '1100px',
          margin: '0 auto',
          minWidth: 0,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '14px',
          }}>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 800 }}>
                {vista === 'nuevo'
                  ? (ticketEditando ? `Agregar al ticket #${ticketEditando.numero_orden || ticketEditando.id}` : 'Nuevo ticket')
                  : 'Autoservicio'}
              </h1>
              <p style={{ margin: '3px 0 0', color: muted, fontSize: '13px' }}>
                {vista === 'nuevo'
                  ? 'Menú por kg + añadidos de la sección Productos.'
                  : 'Tickets activos. El cliente se sirve y se cobra por ticket.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {vista === 'nuevo' ? (
                <button onClick={volver} style={btnSecondary}>Volver</button>
              ) : (
                <>
                  <button onClick={() => cargarDatos()} disabled={cargando} style={btnSecondary}>
                    {cargando ? 'Actualizando...' : 'Actualizar'}
                  </button>
                  <button onClick={nuevoTicket} style={btnPrimary}>+ Nuevo ticket</button>
                </>
              )}
            </div>
          </div>

          {mensajeError && (
            <div style={{
              background: darkMode ? 'rgba(229,57,53,0.14)' : '#FFEBEE',
              color: darkMode ? '#FF8A80' : '#B71C1C',
              border: '1px solid rgba(229,57,53,0.35)',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              fontSize: '13px',
            }}>
              <span>{mensajeError}</span>
              <button onClick={() => setMensajeError('')} style={{ ...iconBtn, color: 'inherit' }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
          )}

          {vista === 'tickets' && (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                <button onClick={() => setVerTodos(false)} style={chip(!verTodos, true)}>
                  Activos ({ticketsActivos.length})
                </button>
                <button onClick={() => setVerTodos(true)} style={chip(verTodos, true)}>
                  Todos ({pedidos.length})
                </button>
                <input
                  value={busquedaTicket}
                  onChange={(e) => setBusquedaTicket(e.target.value)}
                  placeholder="Buscar ticket..."
                  style={{ ...inputStyle, marginLeft: 'auto', maxWidth: '240px' }}
                />
              </div>

              {cargando && pedidos.length === 0 ? (
                <div style={{ ...card, padding: '30px', textAlign: 'center', color: muted }}>Cargando tickets...</div>
              ) : ticketsMostrados.length === 0 ? (
                <div style={{ ...card, padding: '34px 20px', textAlign: 'center' }}>
                  <span className="material-icons" style={{ fontSize: '52px', color: '#FF9800' }}>confirmation_number</span>
                  <h2 style={{ margin: '10px 0 4px', fontSize: '18px', fontWeight: 800 }}>
                    {verTodos ? 'Todavía no hay tickets' : 'No hay tickets activos'}
                  </h2>
                  <p style={{ margin: '0 0 14px', color: muted, fontSize: '13px' }}>
                    Creá un ticket con menú por kg y añadidos.
                  </p>
                  <button onClick={nuevoTicket} style={btnPrimary}>+ Nuevo ticket</button>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '12px',
                }}>
                  {ticketsMostrados.map((p) => {
                    const status = estadoDe(p)
                    const items = itemsDe(p)
                    return (
                      <div key={p.id} style={{ ...card, padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '24px', fontWeight: 900, color: '#FF9800', lineHeight: 1 }}>
                              #{p.numero_orden || p.id}
                            </div>
                            <div style={{ fontSize: '12px', color: muted, marginTop: '4px' }}>
                              {fmtHora(p.created_at)} · {items.length} item(s)
                            </div>
                          </div>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                            padding: '4px 8px',
                            borderRadius: '999px',
                            color: status.color,
                            background: status.bg,
                          }}>{status.label}</span>
                        </div>

                        <div style={{
                          background: softBg,
                          border: `1px solid ${borderColor}`,
                          borderRadius: '10px',
                          padding: '8px 10px',
                          minHeight: '54px',
                        }}>
                          {items.slice(0, 3).map((it, idx) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: '8px',
                              fontSize: '12px',
                              padding: '2px 0',
                            }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {fmtCantidad(it.cantidad)}x {it.producto_nombre}
                              </span>
                              <span style={{ color: muted, whiteSpace: 'nowrap' }}>
                                {fmtGs(Number(it.precio) * Number(it.cantidad))}
                              </span>
                            </div>
                          ))}
                          {items.length > 3 && (
                            <div style={{ fontSize: '11px', color: muted, marginTop: '2px' }}>
                              +{items.length - 3} más
                            </div>
                          )}
                          {items.length === 0 && (
                            <div style={{ fontSize: '12px', color: muted }}>Sin items</div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: muted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                              Total
                            </div>
                            <div style={{ fontSize: '17px', fontWeight: 800 }}>{fmtGs(p.total)}</div>
                          </div>
                          <button onClick={() => setDetalleId(p.id)} style={{ ...btnPrimary, padding: '8px 12px' }}>
                            Ver ticket
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {vista === 'nuevo' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 360px',
              gap: '14px',
              alignItems: 'start',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
                <div style={{ ...card, padding: '14px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>1. Menú por kg</h2>
                  <p style={{ margin: '3px 0 10px', fontSize: '12px', color: muted }}>
                    Cargá el precio por kilogramo y el peso. Ambos valores se pueden modificar a gusto.
                  </p>

                  <label style={{ ...labelStyle, marginBottom: '10px' }}>
                    Producto / Menú (para cocina)
                    <select
                      value={menuProductoId}
                      onChange={(e) => setMenuProductoId(e.target.value)}
                      style={inputStyle}
                    >
                      {menuProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} — {fmtGs(p.precio)}/kg
                        </option>
                      ))}
                      {menuProducts.length === 0 && <option value="">Sin menús configurados</option>}
                    </select>
                  </label>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr) 150px',
                    gap: '8px',
                    alignItems: 'end',
                  }}>
                    <label style={labelStyle}>
                      Precio por kg
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={menuPrecio}
                        onChange={(e) => setMenuPrecio(e.target.value)}
                        style={inputStyle}
                      />
                    </label>

                    <label style={labelStyle}>
                      Peso (kg)
                      <input
                        type="number"
                        min="0.01"
                        step="0.1"
                        value={menuPeso}
                        onChange={(e) => setMenuPeso(e.target.value)}
                        style={inputStyle}
                      />
                    </label>

                    <button
                      onClick={agregarMenu}
                      disabled={!menuProducto || !(pesoNum > 0) || !Number.isFinite(precioNum) || precioNum < 0}
                      style={{ ...btnPrimary, height: '38px' }}
                    >
                      Agregar menú
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginTop: '10px',
                    fontSize: '13px',
                    color: muted,
                    flexWrap: 'wrap',
                  }}>
                    <span>
                      {menuProducto
                        ? `${menuProducto.nombre} · ${fmtGs(precioNum)}/kg · ${fmtCantidad(pesoNum)} kg`
                        : 'Seleccioná un menú'}
                    </span>
                    <span style={{ fontWeight: 800, color: textColor }}>Subtotal: {fmtGs(subtotalMenu)}</span>
                  </div>

                  {menuProducts.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {menuProducts.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setMenuProductoId(String(p.id))}
                          style={chip(Number(menuProductoId) === Number(p.id))}
                        >
                          {p.nombre}
                        </button>
                      ))}
                      {menuProducts.length > 6 && (
                        <span style={{ fontSize: '11px', color: muted, alignSelf: 'center' }}>
                          +{menuProducts.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ ...card, padding: '14px' }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>2. Añadidos</h2>
                  <p style={{ margin: '3px 0 10px', fontSize: '12px', color: muted }}>
                    Todo lo que está en la sección de productos. Tocá un producto para agregarlo por unidad.
                  </p>

                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar producto..."
                    style={{ ...inputStyle, marginBottom: '10px' }}
                  />

                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    overflowX: isMobile ? 'auto' : 'visible',
                    flexWrap: isMobile ? 'nowrap' : 'wrap',
                    paddingBottom: '4px',
                    marginBottom: '10px',
                  }}>
                    <button onClick={() => setCategoriaFiltro('todas')} style={chip(categoriaFiltro === 'todas')}>
                      Todas
                    </button>
                    {categorias.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategoriaFiltro(String(c.id))}
                        style={chip(String(categoriaFiltro) === String(c.id))}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '138px' : '158px'}, 1fr))`,
                    gap: '10px',
                    maxHeight: isMobile ? '440px' : '520px',
                    overflowY: 'auto',
                    paddingRight: '2px',
                  }}>
                    {productosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => abrirProductoModal(p)}
                        style={{
                          ...card,
                          padding: '8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: textColor,
                        }}
                      >
                        <div style={{
                          height: '78px',
                          background: softBg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          borderRadius: '10px',
                          marginBottom: '8px',
                        }}>
                          {imgSrc(p) ? (
                            <img
                              src={imgSrc(p)}
                              alt={p.nombre}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span className="material-icons" style={{ color: '#FF9800', fontSize: '30px' }}>
                              restaurant
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, lineHeight: 1.2, minHeight: '29px' }}>
                          {p.nombre}
                        </div>
                        <div style={{ fontSize: '10px', color: muted, marginTop: '2px', minHeight: '12px' }}>
                          {categoriasMap[p.categoria_id] || ''}
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '6px',
                          gap: '4px',
                        }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#FF9800' }}>
                            {fmtGs(p.precio)}
                          </span>
                          <span className="material-icons" style={{ fontSize: '20px', color: '#FF9800' }}>
                            add_circle
                          </span>
                        </div>
                      </button>
                    ))}

                    {productosFiltrados.length === 0 && (
                      <div style={{
                        gridColumn: '1 / -1',
                        padding: '20px',
                        textAlign: 'center',
                        color: muted,
                        fontSize: '13px',
                      }}>
                        No hay productos para este filtro.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{
                ...card,
                padding: '14px',
                position: isMobile ? 'static' : 'sticky',
                top: '20px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginBottom: '10px',
                }}>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>
                    {ticketEditando ? 'Agregar al ticket' : 'Ticket'}
                  </h2>
                  <span style={{ fontSize: '12px', color: muted }}>{carrito.length} línea(s)</span>
                </div>

                {ticketEditando && (
                  <div style={{
                    background: darkMode ? 'rgba(255,152,0,0.12)' : '#FFF3E0',
                    border: '1px solid rgba(255,152,0,0.35)',
                    color: darkMode ? '#FFCC80' : '#E65100',
                    padding: '8px 10px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    marginBottom: '10px',
                  }}>
                    Ticket #{ticketEditando.numero_orden || ticketEditando.id}. Los items actuales se conservan
                    y se suman los nuevos.
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: isMobile ? 'none' : '360px',
                  overflowY: isMobile ? 'visible' : 'auto',
                  marginBottom: '10px',
                }}>
                  {carrito.length === 0 ? (
                    <div style={{ padding: '18px 8px', textAlign: 'center', color: muted, fontSize: '13px' }}>
                      Agregá un menú por kg o un añadido.
                    </div>
                  ) : carrito.map((item) => (
                    <div key={item.key} style={{
                      border: `1px solid ${borderColor}`,
                      background: softBg,
                      borderRadius: '10px',
                      padding: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {item.producto_nombre}
                          </div>
                          <div style={{ fontSize: '10px', color: muted }}>
                            {item.es_menu
                              ? 'Menú por kg'
                              : (item.categoria_nombre || 'Añadido')}
                            {item.nota && !item.es_menu ? ` · ${item.nota}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => quitarDelCarrito(item.key)}
                          style={iconBtn}
                          title="Quitar"
                        >
                          <span className="material-icons" style={{ fontSize: '17px' }}>close</span>
                        </button>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginTop: '6px',
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {item.es_menu && (
                            <>
                              <span style={{ fontSize: '10px', color: muted }}>Gs.</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={item.precio}
                                onChange={(e) => actualizarPrecio(item.key, e.target.value)}
                                title="Precio por kg"
                                style={{ ...inputStyle, width: '92px', padding: '4px 6px', fontSize: '12px' }}
                              />
                              <span style={{ fontSize: '11px', color: muted }}>/kg ·</span>
                            </>
                          )}
                          <input
                            type="number"
                            min="0"
                            step={item.es_menu ? '0.1' : '1'}
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(item.key, e.target.value)}
                            title={item.es_menu ? 'Peso (kg)' : 'Cantidad'}
                            style={{ ...inputStyle, width: '78px', padding: '4px 6px', fontSize: '12px' }}
                          />
                          <span style={{ fontSize: '11px', color: muted }}>
                            {item.es_menu ? 'kg' : 'u.'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 800 }}>
                          {fmtGs(Number(item.precio) * Number(item.cantidad))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {!ticketEditando && (
                  <label style={labelStyle}>
                    Nota del ticket
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      rows={2}
                      placeholder="Ej: sin hielo, para llevar..."
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '52px' }}
                    />
                  </label>
                )}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderTop: `1px solid ${borderColor}`,
                  marginTop: '6px',
                }}>
                  <span style={{ fontSize: '13px', color: muted, fontWeight: 700 }}>TOTAL</span>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: '#FF9800' }}>{fmtGs(totalCarrito)}</span>
                </div>

                <button
                  onClick={emitirTicket}
                  disabled={guardando || carrito.length === 0}
                  style={{
                    ...btnPrimary,
                    width: '100%',
                    height: '44px',
                    opacity: guardando || carrito.length === 0 ? 0.55 : 1,
                    cursor: guardando || carrito.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {guardando ? 'Guardando...' : (ticketEditando ? 'Agregar al ticket' : 'Emitir ticket')}
                </button>
                <button
                  onClick={volver}
                  disabled={guardando}
                  style={{ ...btnSecondary, width: '100%', marginTop: '8px' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isMobile && <Sidebar activePath="/app/autoservicio" />}

      {productoModal && (
        <div style={overlay} onClick={() => !guardando && setProductoModal(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>{productoModal.nombre}</h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: muted }}>
                  {categoriasMap[productoModal.categoria_id] || 'Añadido'} · {fmtGs(productoModal.precio)} por unidad
                </p>
              </div>
              <button onClick={() => setProductoModal(null)} style={iconBtn}>
                <span className="material-icons" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={labelStyle}>
                Cantidad
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={cantidadModal}
                  onChange={(e) => setCantidadModal(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={labelStyle}>
                Nota (opcional)
                <input
                  value={notaModal}
                  onChange={(e) => setNotaModal(e.target.value)}
                  placeholder="Ej: sin cebolla"
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              margin: '14px 0',
              fontSize: '14px',
            }}>
              <span style={{ color: muted }}>Subtotal</span>
              <strong>{fmtGs(subtotalModal)}</strong>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setProductoModal(null)} style={{ ...btnSecondary, flex: 1 }}>Cancelar</button>
              <button onClick={agregarProductoNormal} style={{ ...btnPrimary, flex: 1 }}>Agregar</button>
            </div>
          </div>
        </div>
      )}

      {ticketDetalle && (
        <div style={overlay} onClick={() => setDetalleId(null)}>
          <div style={{ ...modal, maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px',
              alignItems: 'flex-start',
              marginBottom: '10px',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ticket
                </div>
                <h3 style={{ margin: '2px 0 0', fontSize: '28px', fontWeight: 900, color: '#FF9800' }}>
                  #{ticketDetalle.numero_orden || ticketDetalle.id}
                </h3>
                <div style={{ fontSize: '12px', color: muted }}>
                  {fmtHora(ticketDetalle.created_at)} · {estadoDe(ticketDetalle).label}
                </div>
              </div>
              <button onClick={() => setDetalleId(null)} style={iconBtn}>
                <span className="material-icons" style={{ fontSize: '22px' }}>close</span>
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: softBg,
              border: `1px solid ${borderColor}`,
              borderRadius: '10px',
              padding: '10px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}>
              {itemsDe(ticketDetalle).map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fmtCantidad(it.cantidad)}x {it.producto_nombre}
                    </div>
                    {(it.nota || it.variante) && (
                      <div style={{ fontSize: '10px', color: muted }}>{it.nota || it.variante}</div>
                    )}
                  </div>
                  <span style={{ color: muted, whiteSpace: 'nowrap' }}>
                    {fmtGs(Number(it.precio) * Number(it.cantidad))}
                  </span>
                </div>
              ))}
              {itemsDe(ticketDetalle).length === 0 && (
                <div style={{ color: muted, fontSize: '12px', textAlign: 'center', padding: '10px' }}>Sin items</div>
              )}
            </div>

            {ticketDetalle.notas && (
              <p style={{ fontSize: '12px', color: muted, margin: '10px 0 0', fontStyle: 'italic' }}>
                Nota: {ticketDetalle.notas}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
              <span style={{ fontSize: '13px', color: muted, fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#FF9800' }}>{fmtGs(ticketDetalle.total)}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {ESTADOS_ACTIVOS.includes(ticketDetalle.estado) && (
                <button onClick={() => agregarAlTicket(ticketDetalle)} style={{ ...btnSecondary, flex: '1 1 150px' }}>
                  + Agregar productos
                </button>
              )}
              {ticketDetalle.estado === 'listo' && (
                <button
                  onClick={() => entregarTicket(ticketDetalle)}
                  disabled={accionCargando}
                  style={{ ...btnPrimary, flex: '1 1 150px' }}
                >
                  Marcar entregado
                </button>
              )}
              {ticketDetalle.estado === 'entregado' && (
                <button
                  onClick={() => setConfirmacion({ tipo: 'cobrar', pedido: ticketDetalle })}
                  disabled={accionCargando}
                  style={{ ...btnPrimary, flex: '1 1 150px' }}
                >
                  Cobrar
                </button>
              )}
              {ESTADOS_ACTIVOS.includes(ticketDetalle.estado) && (
                <button
                  onClick={() => setConfirmacion({ tipo: 'cancelar', pedido: ticketDetalle })}
                  disabled={accionCargando}
                  style={{ ...btnDanger, flex: '1 1 120px' }}
                >
                  Cancelar
                </button>
              )}
              <button onClick={() => setDetalleId(null)} style={{ ...btnSecondary, flex: '1 1 100px' }}>
                Cerrar
              </button>
            </div>

            {accionCargando && (
              <p style={{ fontSize: '12px', color: muted, margin: '8px 0 0' }}>Procesando...</p>
            )}
            {mensajeError && (
              <p style={{ fontSize: '12px', color: '#E53935', margin: '8px 0 0' }}>{mensajeError}</p>
            )}
          </div>
        </div>
      )}

      {confirmacion && (
        <div style={overlay} onClick={() => !accionCargando && setConfirmacion(null)}>
          <div style={{ ...modal, maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 900 }}>
              {confirmacion.tipo === 'cobrar' ? 'Cobrar ticket' : 'Cancelar ticket'}
            </h3>
            <p style={{ margin: 0, color: muted, fontSize: '14px', lineHeight: 1.5 }}>
              {confirmacion.tipo === 'cobrar'
                ? `Se va a registrar el cobro en efectivo del ticket #${confirmacion.pedido.numero_orden || confirmacion.pedido.id} por ${fmtGs(confirmacion.pedido.total)}. Necesitás una caja abierta.`
                : `¿Seguro que querés cancelar el ticket #${confirmacion.pedido.numero_orden || confirmacion.pedido.id}? Esta acción no se puede deshacer.`}
            </p>
            {mensajeError && (
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#E53935' }}>{mensajeError}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => setConfirmacion(null)}
                disabled={accionCargando}
                style={{ ...btnSecondary, flex: 1 }}
              >
                Volver
              </button>
              <button
                onClick={() => (confirmacion.tipo === 'cobrar'
                  ? cobrarTicket(confirmacion.pedido)
                  : cancelarTicket(confirmacion.pedido))}
                disabled={accionCargando}
                style={{ ...(confirmacion.tipo === 'cobrar' ? btnPrimary : btnDanger), flex: 1 }}
              >
                {accionCargando
                  ? 'Procesando...'
                  : (confirmacion.tipo === 'cobrar' ? 'Cobrar' : 'Sí, cancelar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {exito && (
        <div style={overlay} onClick={() => setExito(null)}>
          <div style={{ ...modal, maxWidth: '430px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <span className="material-icons" style={{ fontSize: '56px', color: '#4CAF50' }}>check_circle</span>
            <h3 style={{ margin: '8px 0 2px', fontSize: '20px', fontWeight: 900 }}>{exito.titulo}</h3>
            <p style={{ margin: '4px 0', fontSize: '15px', color: muted }}>{exito.mensaje}</p>
            {exito.total !== undefined && (
              <p style={{ margin: '6px 0 0', fontSize: '22px', fontWeight: 900, color: '#FF9800' }}>
                {fmtGs(exito.total)}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
              {exito.pedido && (
                <button
                  onClick={() => {
                    const pedido = exito.pedido
                    setExito(null)
                    setVista('tickets')
                    setDetalleId(pedido.id)
                    cargarDatos(true)
                  }}
                  style={{ ...btnSecondary, flex: '1 1 120px' }}
                >
                  Ver ticket
                </button>
              )}
              <button
                onClick={() => {
                  setExito(null)
                  nuevoTicket()
                }}
                style={{ ...btnPrimary, flex: '1 1 120px' }}
              >
                Nuevo ticket
              </button>
              <button
                onClick={() => {
                  setExito(null)
                  setVista('tickets')
                }}
                style={{ ...btnSecondary, flex: '1 1 100px' }}
              >
                Lista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
