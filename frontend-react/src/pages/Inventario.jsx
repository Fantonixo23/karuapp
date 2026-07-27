import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'

import { getApiUrl } from '../utils/api'
const API_URL = getApiUrl()

export default function Inventario() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  const [inventario, setInventario] = useState([])
  const [resumen, setResumen] = useState({})
  const [alertas, setAlertas] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [modalMovimiento, setModalMovimiento] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(null)
  const [productoSeleccionado, setProductoSeleccionado] = useState(null)
  const [tipoMovimiento, setTipoMovimiento] = useState('entrada')
  const [cantidadMovimiento, setCantidadMovimiento] = useState('')
  const [motivoMovimiento, setMotivoMovimiento] = useState('')

  const [modalNuevo, setModalNuevo] = useState(false)
  const [nuevoForm, setNuevoForm] = useState({
    nombre: '', stock: '0', stock_minimo: '5', precio_costo: '0', unidad_medida: 'und',
  })

  const [modalEditar, setModalEditar] = useState(false)
  const [editarForm, setEditarForm] = useState({
    id: null, producto_id: null, stock_minimo: '5', precio_costo: '0', unidad_medida: 'und',
  })
  const [modalEliminar, setModalEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  useEffect(() => {
    initDarkMode()
    syncDarkMode()
  }, [])

  useEffect(() => {
    cargarDatos()
  }, [filtroEstado])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const estadoParam = filtroEstado === 'todos' ? '' : filtroEstado

      const [resInventario, resResumen, resAlertas] = await Promise.all([
        fetch(`${API_URL}/inventario/?estado=${estadoParam}`),
        fetch(`${API_URL}/inventario/resumen`),
        fetch(`${API_URL}/inventario/alertas`)
      ])

      const dataInventario = await resInventario.json()
      const dataResumen = await resResumen.json()
      const dataAlertas = await resAlertas.json()

      if (dataInventario.success) setInventario(dataInventario.data)
      if (dataResumen.success) setResumen(dataResumen.data)
      if (dataAlertas.success) setAlertas(dataAlertas.data)
    } catch (e) {
      console.error('Error:', e)
    }
    setCargando(false)
  }

  const abrirMovimiento = (producto, tipo) => {
    setProductoSeleccionado(producto)
    setTipoMovimiento(tipo)
    setCantidadMovimiento('')
    setMotivoMovimiento('')
    setModalMovimiento(true)
  }

  const ejecutarMovimiento = async () => {
    if (!cantidadMovimiento || parseInt(cantidadMovimiento) <= 0) return

    try {
      const res = await fetch(`${API_URL}/inventario/movimiento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: productoSeleccionado.producto_id,
          tipo: tipoMovimiento,
          cantidad: parseInt(cantidadMovimiento),
          motivo: motivoMovimiento,
        })
      })
      const data = await res.json()
      if (data.success) {
        setModalMovimiento(false)
        cargarDatos()
      } else {
        alert(data.error)
      }
    } catch (e) {
      alert('Error de conexión')
    }
  }

  const abrirEditar = (item) => {
    setEditarForm({
      id: item.id,
      producto_id: item.producto_id,
      stock_minimo: String(item.stock_minimo),
      precio_costo: String(item.precio_costo),
      unidad_medida: item.unidad_medida || 'und',
    })
    setModalEditar(true)
  }

  const guardarEditar = async () => {
    try {
      const res = await fetch(`${API_URL}/inventario/actualizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: editarForm.producto_id,
          stock_minimo: parseInt(editarForm.stock_minimo),
          precio_costo: parseInt(editarForm.precio_costo || '0'),
          unidad_medida: editarForm.unidad_medida,
        })
      })
      const data = await res.json()
      if (data.success) {
        setModalEditar(false)
        cargarDatos()
      } else {
        alert(data.error)
      }
    } catch (e) {
      alert('Error de conexión')
    }
  }

  const confirmarEliminar = (item) => {
    setProductoSeleccionado(item)
    setModalEliminar(true)
  }

  const ejecutarEliminar = async () => {
    if (!productoSeleccionado) return
    setEliminando(true)
    try {
      const res = await fetch(`${API_URL}/inventario/${productoSeleccionado.id}/eliminar`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setModalEliminar(false)
        setProductoSeleccionado(null)
        cargarDatos()
      } else {
        alert(data.error || 'Error al eliminar')
      }
    } catch (e) {
      alert('Error de conexión')
    }
    setEliminando(false)
  }

  const crearNuevoItem = async () => {
    if (!nuevoForm.nombre) return
    try {
      const res = await fetch(`${API_URL}/productos/crear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoForm.nombre,
          precio: 0,
          disponible: true,
        })
      })
      const data = await res.json()
      if (data.success) {
        const prodId = data.producto.id
        const res2 = await fetch(`${API_URL}/inventario/actualizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: prodId,
            stock_actual: parseInt(nuevoForm.stock || '0'),
            stock_minimo: parseInt(nuevoForm.stock_minimo || '5'),
            precio_costo: parseInt(nuevoForm.precio_costo || '0'),
            unidad_medida: nuevoForm.unidad_medida || 'und',
          })
        })
        const data2 = await res2.json()
        if (data2.success) {
          setModalNuevo(false)
          setNuevoForm({ nombre: '', stock: '0', stock_minimo: '5', precio_costo: '0', unidad_medida: 'und' })
          cargarDatos()
        }
      } else {
        alert(data.error)
      }
    } catch (e) {
      alert('Error de conexión')
    }
  }

  const getEstadoStock = (estado) => {
    const estilos = {
      normal: { color: '#4CAF50', bg: 'rgba(76, 175, 80, 0.15)', texto: 'Normal' },
      bajo: { color: '#FBC02D', bg: 'rgba(251, 192, 45, 0.15)', texto: 'Stock Bajo' },
      agotado: { color: '#E53935', bg: 'rgba(229, 57, 53, 0.15)', texto: 'Agotado' }
    }
    return estilos[estado] || estilos.normal
  }

  const s = {
    container: (dm) => ({ minHeight: '100vh', background: dm ? '#121212' : '#f0f2f5', color: dm ? '#fff' : '#1a1a1a', overflow: 'hidden' }),
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#1a1a1a', color: 'white', borderBottom: '1px solid rgba(255,152,0,0.2)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
    btn: { width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'all 0.15s' },
    title: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
    kpiCard: (dm) => ({ borderRadius: '14px', padding: '18px', textAlign: 'center', border: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, background: dm ? '#1e1e1e' : 'white', boxShadow: dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)' }),
    gridKpi: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' },
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 400,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    },
    modalCard: (dm) => ({
      background: dm ? '#1e1e1e' : 'white',
      padding: '28px', borderRadius: '20px',
      width: '90%', maxWidth: '400px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    }),
    input: (dm) => ({
      width: '100%', padding: '11px 14px', borderRadius: '10px',
      border: `1px solid ${dm ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
      background: dm ? '#2a2a2a' : '#f8f8f8',
      color: dm ? 'white' : '#1a1a1a', marginBottom: '10px',
      boxSizing: 'border-box', outline: 'none',
    }),
    fab: {
      position: 'fixed', bottom: '24px', right: '24px',
      width: '48px', height: '48px', border: 'none', borderRadius: '14px',
      background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
      color: 'white', fontSize: '22px', cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50,
    },
  }

  return (
    <div style={{ ...s.container(darkMode), display: 'flex', flexDirection: 'column' }}>
      <header style={{ ...s.header, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={s.btn}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={s.title}>Inventario</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ ...s.input(darkMode), width: 'auto', marginBottom: 0 }}>
            <option value="todos">Todos</option>
            <option value="normal">Normal</option>
            <option value="bajo">Stock Bajo</option>
            <option value="agotado">Agotado</option>
          </select>
          {!isMobile && <FullscreenButton />}
          <button onClick={toggleDarkMode} style={s.btn}>{darkMode ? '🌙' : '☀️'}</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/inventario" />

        <div style={{ padding: '20px', flex: 1, overflow: 'auto' }}>
          {/* ALERTAS - persistente */}
          {alertas.length > 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #E53935, #C62828)',
              padding: '15px 20px', borderRadius: '12px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '12px',
              boxShadow: '0 4px 12px rgba(229,57,53,0.3)',
            }}>
              <span className="material-icons" style={{ color: 'white', fontSize: '28px' }}>warning</span>
              <span style={{ color: 'white', flex: 1, fontSize: '14px' }}>
                <strong>{alertas.length} producto(s) con stock bajo o agotado</strong>
              </span>
              <button
                onClick={() => setFiltroEstado('bajo')}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: '8px',
                  background: 'white', color: '#E53935', cursor: 'pointer',
                  fontWeight: '700', fontSize: '12px',
                }}
              >Ver Stock Bajo</button>
              <button
                onClick={() => setFiltroEstado('agotado')}
                style={{
                  padding: '8px 16px', border: 'none', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer',
                  fontWeight: '700', fontSize: '12px',
                }}
              >Ver Agotados</button>
            </div>
          )}

          {/* RESUMEN KPIs */}
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px', color: darkMode ? '#fff' : '#333' }}>📊 Resumen</h2>
          <div style={s.gridKpi}>
            <div style={s.kpiCard(darkMode)}>
              <span className="material-icons" style={{ fontSize: '35px', color: '#9C27B0' }}>inventory_2</span>
              <p style={{ fontSize: '13px', color: darkMode ? '#aaa' : '#666', marginTop: '8px' }}>Total Productos</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: darkMode ? '#fff' : '#333' }}>{resumen.total_productos || 0}</p>
            </div>
            <div style={s.kpiCard(darkMode)}>
              <span className="material-icons" style={{ fontSize: '35px', color: '#4CAF50' }}>check_circle</span>
              <p style={{ fontSize: '13px', color: darkMode ? '#aaa' : '#666', marginTop: '8px' }}>Normal</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#4CAF50' }}>{resumen.normal || 0}</p>
            </div>
            <div style={s.kpiCard(darkMode)}>
              <span className="material-icons" style={{ fontSize: '35px', color: '#FBC02D' }}>warning</span>
              <p style={{ fontSize: '13px', color: darkMode ? '#aaa' : '#666', marginTop: '8px' }}>Stock Bajo</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#FBC02D' }}>{resumen.bajo || 0}</p>
            </div>
            <div style={s.kpiCard(darkMode)}>
              <span className="material-icons" style={{ fontSize: '35px', color: '#E53935' }}>cancel</span>
              <p style={{ fontSize: '13px', color: darkMode ? '#aaa' : '#666', marginTop: '8px' }}>Agotado</p>
              <p style={{ fontSize: '24px', fontWeight: '700', color: '#E53935' }}>{resumen.agotado || 0}</p>
            </div>
          </div>

          {/* TABLA DE INVENTARIO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: darkMode ? '#fff' : '#333' }}>📋 Inventario de Productos</h2>
            <button
              onClick={() => setModalNuevo(true)}
              style={{
                padding: '10px 18px', border: 'none', borderRadius: '10px',
                background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '13px',
              }}
            >+ Nuevo Item</button>
          </div>

          <div style={{ background: darkMode ? '#333' : '#fff', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: darkMode ? '#444' : '#f5f5f5' }}>
                    <th style={{ padding: '15px', textAlign: 'left', color: darkMode ? '#aaa' : '#666' }}>Producto</th>
                    <th style={{ padding: '15px', textAlign: 'left', color: darkMode ? '#aaa' : '#666' }}>Categoría</th>
                    <th style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>Stock</th>
                    <th style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>Mín.</th>
                    <th style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>Costo</th>
                    <th style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>Estado</th>
                    <th style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargando ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: darkMode ? '#666' : '#999' }}>
                        <span className="material-icons" style={{ fontSize: '40px', animation: 'spin 1s linear infinite' }}>sync</span>
                        <p style={{ marginTop: '10px' }}>Cargando inventario...</p>
                      </td>
                    </tr>
                  ) : inventario.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: darkMode ? '#666' : '#999' }}>
                        No hay productos en inventario
                      </td>
                    </tr>
                  ) : (
                    inventario.map((item) => {
                      const estado = getEstadoStock(item.estado_stock)
                      return (
                        <tr
                          key={item.id}
                          style={{ borderBottom: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, cursor: 'pointer' }}
                          onClick={() => abrirEditar(item)}
                        >
                          <td style={{ padding: '15px' }}>
                            <span style={{ fontWeight: '600', color: darkMode ? '#fff' : '#333' }}>{item.producto_nombre}</span>
                          </td>
                          <td style={{ padding: '15px', color: darkMode ? '#aaa' : '#666' }}>{item.categoria}</td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <span style={{ fontSize: '20px', fontWeight: '700', color: estado.color }}>{item.stock_actual}</span>
                            <span style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#666', marginLeft: '5px' }}>{item.unidad_medida}</span>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>{item.stock_minimo}</td>
                          <td style={{ padding: '15px', textAlign: 'center', color: darkMode ? '#aaa' : '#666' }}>
                            {parseInt(item.precio_costo).toLocaleString('es-PY')} Gs.
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <span style={{
                              padding: '5px 12px',
                              borderRadius: '20px',
                              background: estado.bg,
                              color: estado.color,
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              {estado.texto}
                            </span>
                          </td>
                          <td style={{ padding: '15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => abrirMovimiento(item, 'entrada')}
                                title="Entrada"
                                style={{ padding: '8px', border: 'none', borderRadius: '8px', background: '#4CAF50', color: 'white', cursor: 'pointer' }}
                              >
                                <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                              </button>
                              <button
                                onClick={() => abrirMovimiento(item, 'salida')}
                                title="Salida"
                                style={{ padding: '8px', border: 'none', borderRadius: '8px', background: '#E53935', color: 'white', cursor: 'pointer' }}
                              >
                                <span className="material-icons" style={{ fontSize: '18px' }}>remove</span>
                              </button>
                              <button
                                onClick={() => confirmarEliminar(item)}
                                title="Eliminar"
                                style={{ padding: '8px', border: 'none', borderRadius: '8px', background: '#9C27B0', color: 'white', cursor: 'pointer' }}
                              >
                                <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* FAB - Nuevo Item */}
      <button style={{ ...s.fab, bottom: isMobile ? '70px' : '24px' }} onClick={() => setModalNuevo(true)}>+</button>

      {/* MODAL MOVIMIENTO (entrada/salida) */}
      {modalMovimiento && (
        <div style={s.overlay}>
          <div style={s.modalCard(darkMode)}>
            <h3 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '20px', textAlign: 'center' }}>
              {tipoMovimiento === 'entrada' ? '📥 Entrada de Inventario' : '📤 Salida de Inventario'}
            </h3>
            <p style={{ color: darkMode ? '#aaa' : '#666', marginBottom: '20px', textAlign: 'center' }}>
              {productoSeleccionado?.producto_nombre}
            </p>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: darkMode ? '#aaa' : '#666' }}>Cantidad</label>
              <p style={{ fontSize: '12px', color: darkMode ? '#888' : '#999', margin: '0 0 8px' }}>{tipoMovimiento === 'entrada' ? 'Cuántos unidades estás agregando' : 'Cuántos unidades estás sacando'}</p>
              <input
                type="number"
                value={cantidadMovimiento}
                onChange={(e) => setCantidadMovimiento(e.target.value)}
                placeholder="Cantidad"
                style={s.input(darkMode)}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', color: darkMode ? '#aaa' : '#666' }}>Motivo</label>
              <select
                value={motivoMovimiento}
                onChange={(e) => setMotivoMovimiento(e.target.value)}
                style={s.input(darkMode)}
              >
                <option value="">Seleccionar...</option>
                {tipoMovimiento === 'entrada' ? (
                  <>
                    <option value="compra">Compra</option>
                    <option value="reposicion">Reposición</option>
                    <option value="ajuste">Ajuste de inventario</option>
                    <option value="devolucion">Devolución</option>
                  </>
                ) : (
                  <>
                    <option value="venta">Venta</option>
                    <option value="desperdicio">Desperdicio</option>
                    <option value="ajuste">Ajuste de inventario</option>
                    <option value="donacion">Donación</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setModalMovimiento(false)}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: '#ccc', color: '#333', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarMovimiento}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: tipoMovimiento === 'entrada' ? '#4CAF50' : '#E53935', color: 'white', cursor: 'pointer', fontWeight: '700' }}
              >
                {tipoMovimiento === 'entrada' ? '➕ Entrada' : '➖ Salida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO ITEM (crea producto + inventario) */}
      {modalNuevo && (
        <div style={s.overlay} onClick={() => setModalNuevo(false)}>
          <div style={s.modalCard(darkMode)} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '20px', textAlign: 'center' }}>➕ Nuevo Item de Inventario</h3>

            <label style={{ display: 'block', marginBottom: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Nombre del producto</label>
            <input
              style={s.input(darkMode)}
              placeholder="Ej: Hamburguesa, Coca Cola..."
              value={nuevoForm.nombre}
              onChange={(e) => setNuevoForm({ ...nuevoForm, nombre: e.target.value })}
            />
            <label style={{ display: 'block', marginBottom: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Stock inicial — cantidad que tenés ahora</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                style={{ ...s.input(darkMode), flex: 1 }}
                type="number" placeholder="0"
                value={nuevoForm.stock}
                onChange={(e) => setNuevoForm({ ...nuevoForm, stock: e.target.value })}
              />
              <input
                style={{ ...s.input(darkMode), flex: 1 }}
                type="number" placeholder="5"
                value={nuevoForm.stock_minimo}
                onChange={(e) => setNuevoForm({ ...nuevoForm, stock_minimo: e.target.value })}
              />
            </div>
            <label style={{ display: 'block', marginBottom: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Stock mínimo — cuando llegue a este número, te alertará</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                style={{ ...s.input(darkMode), flex: 1 }}
                type="number" placeholder="0"
                value={nuevoForm.precio_costo}
                onChange={(e) => setNuevoForm({ ...nuevoForm, precio_costo: e.target.value })}
              />
              <input
                style={{ ...s.input(darkMode), flex: 1 }}
                placeholder="und"
                value={nuevoForm.unidad_medida}
                onChange={(e) => setNuevoForm({ ...nuevoForm, unidad_medida: e.target.value })}
              />
            </div>
            <label style={{ display: 'block', marginBottom: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Precio costo = precio que pagaste por unidad (en Gs.)</label>
            <label style={{ display: 'block', marginBottom: '10px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Unidad de medida: und = unidades, kg = kilos, lts = litros</label>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => setModalNuevo(false)}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: '#ccc', color: '#333', cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={crearNuevoItem}
                disabled={!nuevoForm.nombre}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                  color: 'white', cursor: nuevoForm.nombre ? 'pointer' : 'not-allowed',
                  fontWeight: '700', opacity: nuevoForm.nombre ? 1 : 0.5,
                }}
              >✅ Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ELIMINAR */}
      {modalEliminar && (
        <div style={s.overlay}>
          <div style={s.modalCard(darkMode)}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(156,39,176,0.12)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-icons" style={{ fontSize: '28px', color: '#9C27B0' }}>warning_amber</span>
              </div>
              <h3 style={{ color: darkMode ? '#fff' : '#333', margin: '0 0 4px', fontSize: '18px' }}>¿Eliminar Item?</h3>
              <p style={{ color: darkMode ? '#aaa' : '#666', fontSize: '13px', margin: '0' }}>
                {productoSeleccionado?.producto_nombre}
              </p>
              <p style={{ color: '#E53935', fontSize: '12px', marginTop: '12px', background: 'rgba(229,57,53,0.1)', padding: '8px', borderRadius: '8px' }}>
                Se eliminará el inventario y el producto. Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setModalEliminar(false); setProductoSeleccionado(null) }}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: '#ccc', color: '#333', cursor: 'pointer' }}
                disabled={eliminando}
              >Cancelar</button>
              <button
                onClick={ejecutarEliminar}
                disabled={eliminando}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: eliminando ? '#999' : 'linear-gradient(135deg, #E53935, #C62828)', color: 'white', cursor: eliminando ? 'not-allowed' : 'pointer', fontWeight: '700' }}
              >{eliminando ? 'Eliminando...' : '🗑️ Eliminar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR (stock_minimo, precio_costo, unidad_medida) */}
      {modalEditar && (
        <div style={s.overlay} onClick={() => setModalEditar(false)}>
          <div style={s.modalCard(darkMode)} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: darkMode ? '#fff' : '#333', marginBottom: '20px', textAlign: 'center' }}>✏️ Editar Configuración</h3>

            <label style={{ display: 'block', marginBottom: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Stock mínimo — alerta cuando el stock llegue a este número</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                style={{ ...s.input(darkMode), flex: 1 }}
                type="number" placeholder="Stock mínimo"
                value={editarForm.stock_minimo}
                onChange={(e) => setEditarForm({ ...editarForm, stock_minimo: e.target.value })}
              />
              <input
                style={{ ...s.input(darkMode), flex: 1 }}
                type="number" placeholder="Precio costo"
                value={editarForm.precio_costo}
                onChange={(e) => setEditarForm({ ...editarForm, precio_costo: e.target.value })}
              />
            </div>
            <label style={{ display: 'block', marginBottom: '4px', marginTop: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Precio costo — lo que pagaste por unidad (en Gs.)</label>
            <input
              style={s.input(darkMode)}
              placeholder="Unidad de medida"
              value={editarForm.unidad_medida}
              onChange={(e) => setEditarForm({ ...editarForm, unidad_medida: e.target.value })}
            />
            <label style={{ display: 'block', marginBottom: '4px', color: darkMode ? '#aaa' : '#666', fontSize: '13px' }}>Unidad de medida: und, kg, lts...</label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setModalEditar(false)}
                style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '10px', background: '#ccc', color: '#333', cursor: 'pointer' }}
              >Cancelar</button>
              <button
                onClick={guardarEditar}
                style={{
                  flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                  color: 'white', cursor: 'pointer', fontWeight: '700',
                }}
              >💾 Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
