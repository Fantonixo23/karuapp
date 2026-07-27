import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store/useStore'
import { formatGuarani } from '../utils/currency'
import { getApiUrl } from '../utils/api'
const API_URL = getApiUrl()

export default function TomarPedido({ mesa, onVolver, usuario, pedidoExistente, onPedidoActualizado }) {
  const darkMode = useStore((state) => state.darkMode)
  const isMobile = useStore((state) => state.isMobile)

  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [categoria, setCategoria] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [modalProducto, setModalProducto] = useState(null)
  const [nota, setNota] = useState('')
  const [variante, setVariante] = useState(null)
  const [cantidad, setCantidad] = useState(1)
  const [carrito, setCarrito] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalExito, setModalExito] = useState(false)
  const [modalError, setModalError] = useState(false)
  const [modalConfirmarCocina, setModalConfirmarCocina] = useState(false)
  const [modalCancelarPedido, setModalCancelarPedido] = useState(false)
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [cargandoCancelar, setCargandoCancelar] = useState(false)
  const [mensajeError, setMensajeError] = useState('')
  const [pagina, setPagina] = useState(1)
  const [sidebarDerAbierto, setSidebarDerAbierto] = useState(false)
  const catBarRef = useRef(null)
  const dragRef = useRef(null)
  const PRODUCTOS_POR_PAGINA = 24

  const iniciarDrag = (e) => {
    const el = catBarRef.current
    if (!el) return
    el.style.cursor = 'grabbing'
    dragRef.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
  }
  const moverDrag = (e) => {
    const el = catBarRef.current
    const d = dragRef.current
    if (!el || !d || !d.isDown) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    const walk = (x - d.startX) * 1.5
    el.scrollLeft = d.scrollLeft - walk
  }
  const detenerDrag = () => {
    const d = dragRef.current
    if (!d) return
    d.isDown = false
    if (catBarRef.current) catBarRef.current.style.cursor = 'grab'
  }
  
  const esEdicion = !!pedidoExistente
  const editandoPedidoId = pedidoExistente?.id || null

  useEffect(() => {
    loadCategorias()
    loadProductos()
  }, [])

  const loadCategorias = async () => {
    try {
      const res = await fetch(`${API_URL}/categorias`)
      const data = await res.json()
      if (data.success) setCategorias(data.categorias || [])
    } catch (e) {
      console.error('Error cargando categorias:', e)
    }
  }
  
  useEffect(() => {
    // Si estamos en modo edicion, precargar items del pedido existente
    if (pedidoExistente?.items) {
      const itemsCarrito = pedidoExistente.items.map(item => ({
        producto_id: item.producto_id,
        producto: item.producto_nombre,
        producto_nombre: item.producto_nombre,
        cantidad: item.cantidad,
        variante: item.variante || null,
        nota: item.nota || '',
        precio: parseFloat(item.precio) || 0,
        precio_total: (parseFloat(item.precio) || 0) * (item.cantidad || 1),
      }))
      setCarrito(itemsCarrito)
    }
  }, [pedidoExistente])

  const loadProductos = async () => {
    try {
      setCargando(true)
      const res = await fetch(`${API_URL}/productos`)
      const data = await res.json()
      if (data.success) setProductos(data.productos || [])
      else setProductos([])
    } catch (e) {
      console.error('Error cargando productos:', e)
    } finally {
      setCargando(false)
    }
  }

  const productosFiltrados = useMemo(() => {
    let filtrados = productos.filter(p => p.disponible)
    if (categoria !== 'todas') {
      filtrados = filtrados.filter(p => Number(p.categoria_id) === Number(categoria))
    }
    if (busqueda) {
      filtrados = filtrados.filter(p => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()))
    }
    return filtrados
  }, [productos, categoria, busqueda])

  const totalPaginas = Math.ceil(productosFiltrados.length / PRODUCTOS_POR_PAGINA)
  const productosPagina = productosFiltrados.slice((pagina - 1) * PRODUCTOS_POR_PAGINA, pagina * PRODUCTOS_POR_PAGINA)

  const totalCarrito = useMemo(() => carrito.reduce((sum, item) => sum + item.precio_total, 0), [carrito])

  const obtenerPrecioVariant = (producto, varianteNombre) => {
    if (!varianteNombre || !producto.variantes) return null
    const vs = Array.isArray(producto.variantes) ? producto.variantes : Object.values(producto.variantes)
    const v = vs.find(v => (typeof v === 'string' ? v : v?.nombre) === varianteNombre)
    if (v && typeof v === 'object') {
      if (v.precio) return parseFloat(v.precio)
      if (v.precio_extra) return parseFloat(v.precio_extra) + parseFloat(producto.precio)
    }
    return null
  }

  const agregarAlCarrito = () => {
    if (!modalProducto) return
    const precioVariant = obtenerPrecioVariant(modalProducto, variante)
    const precioUnitario = precioVariant !== null ? precioVariant : parseFloat(modalProducto.precio)
    setCarrito([...carrito, {
      producto_id: modalProducto.id,
      producto: modalProducto.nombre,
      producto_nombre: modalProducto.nombre,
      cantidad,
      variante,
      nota,
      precio: precioUnitario,
      precio_total: precioUnitario * cantidad,
    }])
    setModalProducto(null)
    setCantidad(1)
    setNota('')
    setVariante(null)
  }

  const eliminarDelCarrito = (index) => {
    const nuevo = [...carrito]
    nuevo.splice(index, 1)
    setCarrito(nuevo)
  }

  const enviarAPedido = async () => {
    if (carrito.length === 0) return
    if (!mesa?.id) {
      setMensajeError('Selecciona una mesa primero')
      setModalError(true)
      return
    }

    const items = carrito.map(item => ({
      producto_id: item.producto_id,
      producto: item.producto,
      producto_nombre: item.producto_nombre,
      cantidad: item.cantidad,
      variante: item.variante,
      nota: item.nota,
      precio: item.precio,
    }))

    try {
      const res = await fetch(`${API_URL}/pedidos/crear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: mesa.id,
          items,
          total: totalCarrito,
          usuario_id: usuario?.id,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setCarrito([])
        setModalExito(true)
      } else {
        setMensajeError(data.error || 'Error al crear pedido')
        setModalError(true)
      }
    } catch (e) {
      setMensajeError('Error de conexión')
      setModalError(true)
    }
  }

  const enviarActualizacion = async () => {
    if (carrito.length === 0 || !editandoPedidoId) return

    const items = carrito.map(item => ({
      producto_id: item.producto_id,
      producto: item.producto,
      producto_nombre: item.producto_nombre,
      cantidad: item.cantidad,
      variante: item.variante,
      nota: item.nota,
      precio: item.precio,
    }))

    try {
      const res = await fetch(`${API_URL}/pedidos/${editandoPedidoId}/items/reemplazar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (data.success) {
        setCarrito([])
        if (onPedidoActualizado) onPedidoActualizado(data.pedido)
        setModalExito(true)
      } else {
        setMensajeError(data.error || 'Error al actualizar pedido')
        setModalError(true)
      }
    } catch (e) {
      setMensajeError('Error de conexión')
      setModalError(true)
    }
  }

  const cancelarPedidoConMotivo = async () => {
    if (!editandoPedidoId) return
    setCargandoCancelar(true)
    try {
      const res = await fetch(`${API_URL}/pedidos/${editandoPedidoId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: motivoCancelacion }),
      })
      const data = await res.json()
      if (data.success) {
        setModalCancelarPedido(false)
        if (onPedidoActualizado) onPedidoActualizado({ cancelado: true })
        onVolver()
      } else {
        setMensajeError(data.error || 'Error al cancelar pedido')
        setModalError(true)
      }
    } catch (e) {
      setMensajeError('Error de conexión')
      setModalError(true)
    }
    setCargandoCancelar(false)
  }

  const styles = {
    container: {
      display: 'flex', height: '100%', width: '100%', flex: 1, minWidth: 0,
      position: 'relative',
      background: darkMode ? '#1a1a1a' : '#f0f0f0',
    },
    mainContent: {
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    headerBar: {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px',
      background: darkMode ? '#222' : '#fff',
      borderBottom: `1px solid ${darkMode ? '#333' : '#ddd'}`,
    },
    backBtn: {
      width: '36px', height: '36px', border: 'none', borderRadius: '8px',
      background: '#FF9800', color: 'white', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '18px', flexShrink: 0,
    },
    mesaBadge: {
      background: 'linear-gradient(135deg, #FF9800, #F57C00)',
      color: 'white', padding: '6px 14px', borderRadius: '20px',
      fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0,
    },
    searchInput: {
      flex: 1, padding: '8px 14px', border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
      borderRadius: '20px', background: darkMode ? '#333' : '#f5f5f5',
      color: darkMode ? 'white' : '#333', fontSize: '13px', outline: 'none',
    },
    categoriaBar: {
      display: 'flex', gap: '6px', padding: '8px 16px', overflowX: 'auto',
      background: darkMode ? '#222' : '#fff',
      borderBottom: `1px solid ${darkMode ? '#333' : '#eee'}`,
      cursor: 'grab', userSelect: 'none',
    },
    catBtn: (active) => ({
      padding: '6px 14px', border: 'none', borderRadius: '16px',
      cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: '600',
      background: active ? '#FF9800' : darkMode ? '#333' : '#eee',
      color: active ? 'white' : darkMode ? '#ccc' : '#666',
      transition: 'all 0.2s',
    }),
    gridArea: {
      flex: 1, overflow: 'auto', padding: '12px',
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
      gap: '10px',
    },
    card: {
      borderRadius: '15px', overflow: 'hidden', cursor: 'pointer',
      position: 'relative', transition: 'all 0.3s',
      background: darkMode ? '#2d2d2d' : 'white',
      boxShadow: darkMode ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
    },
    cardImg: {
      width: '100%', height: '110px', objectFit: 'cover',
      background: darkMode ? '#3a3a3a' : '#eee',
    },
    cardPlaceholder: {
      width: '100%', height: '110px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: darkMode ? '#3a3a3a' : '#eee',
      color: darkMode ? '#666' : '#999', fontSize: '30px',
    },
    cardBody: {
      padding: '8px 10px',
    },
    cardNombre: {
      fontSize: '11px', fontWeight: '700', color: darkMode ? 'white' : '#333',
      marginBottom: '2px', lineHeight: 1.2,
    },
    cardPrecio: {
      fontSize: '13px', fontWeight: '700', color: '#FF9800',
    },
    variantBadge: {
      position: 'absolute', top: '6px', right: '6px',
      background: '#FF9800', color: 'white', borderRadius: '8px',
      padding: '2px 6px', fontSize: '9px', fontWeight: '700',
    },
    rightPanel: {
      position: 'fixed', right: 0, top: '56px', bottom: isMobile ? '65px' : 0,
      width: 'min(30%, 320px)', minWidth: '280px',
      background: darkMode ? '#1e1e1e' : 'white',
      borderLeft: `1px solid ${darkMode ? '#333' : '#ddd'}`,
      zIndex: 50, display: 'flex', flexDirection: 'column',
      transform: sidebarDerAbierto ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease',
    },
    panelHeader: {
      padding: '12px 16px',
      background: 'linear-gradient(135deg, #FF9800, #F57C00)',
      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    toggleBtn: {
      width: '28px', height: '28px', border: 'none', borderRadius: '50%',
      background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '16px', flexShrink: 0,
    },
    panelItems: {
      flex: 1, overflow: 'auto', padding: '10px',
    },
    cartItem: {
      background: darkMode ? '#2d2d2d' : '#f5f5f5',
      borderRadius: '10px', padding: '8px 10px', marginBottom: '8px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    deleteBtn: {
      width: '24px', height: '24px', border: 'none', borderRadius: '50%',
      background: '#E53935', color: 'white', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '14px', flexShrink: 0,
    },
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.8)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)',
    },
    modalCard: {
      background: darkMode ? '#2d2d2d' : 'white',
      borderRadius: '20px', width: '90%', maxWidth: '400px',
      maxHeight: '85vh', overflow: 'auto',
    },
    modalImg: {
      width: '100%', height: '160px', objectFit: 'cover',
      borderRadius: '20px 20px 0 0',
    },
    btnOrange: {
      padding: '12px 20px', border: 'none', borderRadius: '10px',
      background: 'linear-gradient(135deg, #FF9800, #F57C00)',
      color: 'white', fontWeight: '700', cursor: 'pointer',
      width: '100%', fontSize: '14px',
    },
  }

  const showVariantBadge = (p) => {
    if (!p.variantes) return false
    if (Array.isArray(p.variantes) && p.variantes.length > 0) return true
    if (typeof p.variantes === 'object' && Object.keys(p.variantes).length > 0) return true
    return false
  }

  return (
    <div style={styles.container}>
      <div style={styles.mainContent}>
        <div style={styles.headerBar}>
          <button onClick={onVolver} style={styles.backBtn}>←</button>
          {mesa && <span style={styles.mesaBadge}>🪑 Mesa {mesa.numero}</span>}
          {esEdicion && <span style={{ background: '#1976D2', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>✏️ Editando #{pedidoExistente.numero_orden || pedidoExistente.id}</span>}
          <input
            style={styles.searchInput}
            placeholder="🔍 Buscar producto..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          />
        </div>

        <div
          ref={catBarRef}
          style={styles.categoriaBar}
          onMouseDown={iniciarDrag}
          onMouseMove={moverDrag}
          onMouseUp={detenerDrag}
          onMouseLeave={detenerDrag}
        >
          <button
            style={styles.catBtn(categoria === 'todas')}
            onClick={() => { setCategoria('todas'); setPagina(1) }}
          >🍽️ Todas</button>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              style={styles.catBtn(categoria === cat.id)}
              onClick={() => { setCategoria(cat.id); setPagina(1) }}
            >🍽️ {cat.nombre}</button>
          ))}
        </div>

        <style>{`@keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        <div style={styles.gridArea}>
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#666' : '#999' }}>
              <span className="material-icons" style={{ fontSize: '48px' }}>sync</span>
              <p>Cargando productos...</p>
            </div>
          ) : productosPagina.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#666' : '#999' }}>
              <span className="material-icons" style={{ fontSize: '48px' }}>search_off</span>
              <p>No hay productos</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {productosPagina.map((p, i) => (
                <div
                  key={p.id}
                  style={{ ...styles.card, animation: `fadeInScale 0.4s ease-out forwards`, animationDelay: `${(i % PRODUCTOS_POR_PAGINA) * 0.05}s`, opacity: 0 }}
                  onClick={() => { setModalProducto(p); setCantidad(1); setNota(''); setVariante(null) }}
                >
                  {p.imagen ? (
                    <img src={p.imagen} alt={p.nombre} style={styles.cardImg} />
                  ) : (
                    <div style={styles.cardPlaceholder}>🍽️</div>
                  )}
                  {showVariantBadge(p) && <div style={styles.variantBadge}>V</div>}
                  <div style={styles.cardBody}>
                    <div style={styles.cardNombre}>{p.nombre}</div>
                    <div style={styles.cardPrecio}>{formatGuarani(p.precio)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPaginas > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '20px',
              position: 'sticky', bottom: 0, padding: '10px',
              background: darkMode ? '#1a1a1a' : '#f0f0f0',
            }}>
              <button
                onClick={() => setPagina(Math.max(1, pagina - 1))}
                disabled={pagina === 1}
                style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', background: pagina === 1 ? '#ccc' : '#FF9800', color: 'white', cursor: pagina === 1 ? 'not-allowed' : 'pointer' }}
              >‹</button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPagina(p)}
                  style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', background: p === pagina ? '#FF9800' : darkMode ? '#333' : '#ddd', color: p === pagina ? 'white' : darkMode ? '#ccc' : '#333', cursor: 'pointer', fontWeight: p === pagina ? '700' : '400' }}
                >{p}</button>
              ))}
              <button
                onClick={() => setPagina(Math.min(totalPaginas, pagina + 1))}
                disabled={pagina === totalPaginas}
                style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', background: pagina === totalPaginas ? '#ccc' : '#FF9800', color: 'white', cursor: pagina === totalPaginas ? 'not-allowed' : 'pointer' }}
              >›</button>
            </div>
          )}
        </div>
      </div>

      {!sidebarDerAbierto && (
        <button
          onClick={() => setSidebarDerAbierto(true)}
          style={{
            position: 'fixed', right: '12px', bottom: isMobile ? '80px' : '20px',
            width: '50px', height: '50px', border: 'none', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FF9800, #F57C00)',
            color: 'white', cursor: 'pointer', zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: '700',
            boxShadow: '0 4px 12px rgba(255,152,0,0.4)',
          }}
        >🛒</button>
      )}
      <div style={styles.rightPanel}>
        <div style={styles.panelHeader}>
          <span style={{ fontWeight: '700', fontSize: '14px' }}>🧾 Pedido Actual</span>
          <button onClick={() => setSidebarDerAbierto(false)} style={styles.toggleBtn}>›</button>
        </div>

        <>
          <div style={styles.panelItems}>
              {carrito.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: darkMode ? '#666' : '#999' }}>
                  <span className="material-icons" style={{ fontSize: '36px' }}>shopping_cart</span>
                  <p style={{ fontSize: '12px', marginTop: '8px' }}>Sin productos</p>
                  <p style={{ fontSize: '11px', color: darkMode ? '#555' : '#bbb' }}>Toca un producto para agregar</p>
                </div>
              ) : (
                carrito.map((item, i) => (
                  <div key={i} style={styles.cartItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: darkMode ? 'white' : '#333' }}>
                        {item.cantidad}x {item.producto_nombre}
                      </div>
                      {item.variante && <div style={{ fontSize: '10px', color: '#FF9800' }}>+ {item.variante}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#4CAF50' }}>{formatGuarani(item.precio_total)}</span>
                      <button onClick={() => eliminarDelCarrito(i)} style={styles.deleteBtn}>×</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <div style={{
                padding: '12px 16px', borderTop: `1px solid ${darkMode ? '#333' : '#ddd'}`,
                background: darkMode ? '#222' : '#fafafa',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: darkMode ? '#ccc' : '#666', marginBottom: '4px' }}>
                  <span>Total</span>
                  <span style={{ fontWeight: '700', color: '#4CAF50', fontSize: '16px' }}>{formatGuarani(totalCarrito)}</span>
                </div>
                {esEdicion ? (
                  <>
                    <button
                      onClick={() => setModalConfirmarCocina(true)}
                      style={{ ...styles.btnOrange, marginTop: '8px', background: 'linear-gradient(135deg, #4CAF50, #388E3C)' }}
                    >✅ Actualizar Pedido</button>
                    <button
                      onClick={() => setModalCancelarPedido(true)}
                      style={{ ...styles.btnOrange, marginTop: '6px', background: 'linear-gradient(135deg, #E53935, #C62828)' }}
                    >❌ Cancelar Pedido</button>
                  </>
                ) : (
                  <button
                    onClick={() => setModalConfirmarCocina(true)}
                    disabled={!mesa?.id}
                    style={{
                      ...styles.btnOrange, marginTop: '8px',
                      opacity: mesa?.id ? 1 : 0.5,
                    }}
                  >📨 Enviar a Cocina</button>
                )}
              </div>
            )}
          </>
      </div>

      {modalProducto && (
        <div style={styles.modalOverlay} onClick={() => setModalProducto(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            {modalProducto.imagen && <img src={modalProducto.imagen} alt={modalProducto.nombre} style={styles.modalImg} />}
            <div style={{ padding: '16px 20px 20px' }}>
              <h3 style={{ color: darkMode ? 'white' : '#333', margin: '0 0 4px', fontSize: '18px' }}>{modalProducto.nombre}</h3>
              <div style={{ color: '#FF9800', fontWeight: '700', fontSize: '22px', marginBottom: '16px' }}>{formatGuarani(modalProducto.precio)}</div>

              {(modalProducto.variantes && (
                Array.isArray(modalProducto.variantes) ? modalProducto.variantes : Object.values(modalProducto.variantes)
              ).length > 0) && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: darkMode ? '#ccc' : '#666', marginBottom: '8px' }}>VARIANTES</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(Array.isArray(modalProducto.variantes) ? modalProducto.variantes : Object.values(modalProducto.variantes)).map((v, i) => {
                      const vName = typeof v === 'string' ? v : v?.nombre || `Opción ${i + 1}`
                      const vPrecio = typeof v === 'object' ? (v?.precio ? parseFloat(v.precio) : v?.precio_extra ? parseFloat(v.precio_extra) + parseFloat(modalProducto.precio) : null) : null
                      const isSelected = variante === vName
                      return (
                        <button
                          key={i}
                          onClick={() => setVariante(isSelected ? null : vName)}
                          style={{
                            padding: '8px 14px', border: `2px solid ${isSelected ? '#FF9800' : darkMode ? '#444' : '#ddd'}`,
                            borderRadius: '10px', cursor: 'pointer', fontSize: '12px',
                            background: isSelected ? '#FF9800' : darkMode ? '#333' : '#f5f5f5',
                            color: isSelected ? 'white' : darkMode ? '#ccc' : '#333',
                            fontWeight: isSelected ? '700' : '400',
                          }}
                        >{vName}{vPrecio !== null ? ` ${formatGuarani(vPrecio)}` : ''}</button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <button onClick={() => setCantidad(Math.max(1, cantidad - 1))} style={{
                  width: '36px', height: '36px', border: 'none', borderRadius: '10px',
                  background: '#E53935', color: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: '700',
                }}>−</button>
                <span style={{ fontSize: '22px', fontWeight: '700', color: darkMode ? 'white' : '#333', minWidth: '40px', textAlign: 'center' }}>{cantidad}</span>
                <button onClick={() => setCantidad(cantidad + 1)} style={{
                  width: '36px', height: '36px', border: 'none', borderRadius: '10px',
                  background: '#4CAF50', color: 'white', cursor: 'pointer', fontSize: '18px', fontWeight: '700',
                }}>+</button>
              </div>

              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Sin cebolla, extra salsa, etc."
                style={{
                  width: '100%', padding: '10px 14px', border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  borderRadius: '10px', background: darkMode ? '#333' : '#f5f5f5',
                  color: darkMode ? 'white' : '#333', fontSize: '13px', marginBottom: '12px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <button onClick={agregarAlCarrito} style={styles.btnOrange}>
                🛒 Agregar al Carrito — {formatGuarani((obtenerPrecioVariant(modalProducto, variante) ?? parseFloat(modalProducto.precio)) * cantidad)}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalConfirmarCocina && (
        <div style={{ ...styles.modalOverlay, zIndex: 500 }}>
          <div style={{ ...styles.modalCard, padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>{esEdicion ? '✏️' : '🍽️'}</div>
            <h3 style={{ color: darkMode ? 'white' : '#333', margin: '0 0 6px' }}>{esEdicion ? 'Actualizar Pedido?' : 'Enviar a Cocina?'}</h3>
            {mesa && <p style={{ color: darkMode ? '#ccc' : '#666', fontSize: '14px' }}>Mesa: {mesa.numero}</p>}
            {esEdicion && <p style={{ color: '#FF9800', fontSize: '12px' }}>Los items modificados se enviaran a cocina</p>}
            <p style={{ color: darkMode ? '#999' : '#999', fontSize: '13px' }}>{carrito.length} item(s) · Total: {formatGuarani(totalCarrito)}</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'center' }}>
              <button onClick={() => setModalConfirmarCocina(false)} style={{
                padding: '12px 24px', border: 'none', borderRadius: '10px',
                background: darkMode ? '#444' : '#ccc', color: darkMode ? 'white' : '#333', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={() => { setModalConfirmarCocina(false); esEdicion ? enviarActualizacion() : enviarAPedido() }} style={{
                padding: '12px 24px', border: 'none', borderRadius: '10px',
                background: 'linear-gradient(135deg, #4CAF50, #388E3C)', color: 'white', fontWeight: '700', cursor: 'pointer',
              }}>✅ Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalCancelarPedido && (
        <div style={{ ...styles.modalOverlay, zIndex: 600 }}>
          <div style={{ ...styles.modalCard, padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>❌</div>
              <h3 style={{ color: darkMode ? 'white' : '#333', margin: '0 0 4px', fontSize: '18px' }}>Cancelar Pedido</h3>
              <p style={{ color: darkMode ? '#ccc' : '#666', fontSize: '13px' }}>
                #{pedidoExistente?.numero_orden || pedidoExistente?.id} - Mesa {mesa?.numero}
              </p>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: darkMode ? '#ccc' : '#666', display: 'block', marginBottom: '6px' }}>
                Motivo de cancelación
              </label>
              <textarea
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Ej: Cliente no tiene efectivo, Cliente ya no quiere el pedido, Error del mozo, etc."
                style={{
                  width: '100%', padding: '12px', fontSize: '13px', borderRadius: '10px',
                  border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                  background: darkMode ? '#333' : '#f5f5f5',
                  color: darkMode ? 'white' : '#333', outline: 'none', resize: 'vertical',
                  minHeight: '80px', boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => { setModalCancelarPedido(false); setMotivoCancelacion('') }} style={{
                padding: '12px 24px', border: 'none', borderRadius: '10px',
                background: darkMode ? '#444' : '#ccc', color: darkMode ? 'white' : '#333', cursor: 'pointer', fontWeight: '600', flex: 1,
              }}>Volver</button>
              <button
                onClick={cancelarPedidoConMotivo}
                disabled={!motivoCancelacion.trim() || cargandoCancelar}
                style={{
                  padding: '12px 24px', border: 'none', borderRadius: '10px',
                  background: !motivoCancelacion.trim() ? (darkMode ? '#555' : '#ccc') : 'linear-gradient(135deg, #E53935, #C62828)',
                  color: 'white', fontWeight: '700', cursor: !motivoCancelacion.trim() ? 'not-allowed' : 'pointer', flex: 1,
                }}
              >{cargandoCancelar ? 'Cancelando...' : 'Confirmar Cancelación'}</button>
            </div>
          </div>
        </div>
      )}

      {modalExito && (
        <div style={{ ...styles.modalOverlay, zIndex: 400 }}>
          <div style={{
            background: 'linear-gradient(135deg, #4CAF50, #388E3C)', borderRadius: '20px',
            padding: '40px', textAlign: 'center', color: 'white', maxWidth: '350px',
          }}>
            <span className="material-icons" style={{ fontSize: '80px' }}>check_circle</span>
            <h2 style={{ margin: '10px 0 4px' }}>{esEdicion ? 'Pedido actualizado!' : 'Pedido enviado a cocina!'}</h2>
            <p style={{ opacity: 0.8, fontSize: '14px' }}>{esEdicion ? 'Los cambios se enviaron a cocina' : 'El pedido está siendo preparado'}</p>
            <button onClick={() => { setModalExito(false); onVolver() }} style={{
              marginTop: '20px', padding: '12px 30px', border: 'none', borderRadius: '10px',
              background: 'white', color: '#4CAF50', fontWeight: '700', cursor: 'pointer',
            }}>Aceptar</button>
          </div>
        </div>
      )}

      {modalError && (
        <div style={{ ...styles.modalOverlay, zIndex: 400 }}>
          <div style={{
            background: '#E53935', borderRadius: '20px', padding: '30px 40px',
            textAlign: 'center', color: 'white', maxWidth: '350px',
          }}>
            <span className="material-icons" style={{ fontSize: '60px' }}>warning</span>
            <h2 style={{ margin: '10px 0 4px', fontSize: '18px' }}>{mensajeError}</h2>
            <button onClick={() => setModalError(false)} style={{
              marginTop: '20px', padding: '12px 30px', border: 'none', borderRadius: '10px',
              background: 'white', color: '#E53935', fontWeight: '700', cursor: 'pointer',
            }}>Aceptar</button>
          </div>
        </div>
      )}
    </div>
  )
}
