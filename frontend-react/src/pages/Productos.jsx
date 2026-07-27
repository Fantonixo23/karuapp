import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'
import { formatGuarani } from '../utils/currency'
import { getApiUrl, getMediaUrl } from '../utils/api'
const API_URL = getApiUrl()
const MEDIA_URL = getMediaUrl()

const FIELDS = {
  nombre: '',
  descripcion: '',
  precio: '',
  categoria_id: '',
  disponible: true,
  imagen: '',
  variantes: [],
}

export default function Productos() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  const [productos, setProductos] = useState([])
  const [inventarios, setInventarios] = useState([])
  const [categoria, setCategoria] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ ...FIELDS })
  const [editId, setEditId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [subiendo, setSubiendo] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const [error, setError] = useState(null)
  const [imagenError, setImagenError] = useState('')
  const [categorias, setCategorias] = useState([])
  const [modalCategorias, setModalCategorias] = useState(false)
  const [editCategoria, setEditCategoria] = useState(null)
  const [formCategoria, setFormCategoria] = useState({ nombre: '' })
  const fileInputRef = useRef(null)
  const catBarRef = useRef(null)
  const dragRef = useRef(null)

  useEffect(() => {
    initDarkMode()
    syncDarkMode()
    loadProductos()
    loadInventarios()
    loadCategorias()
  }, [])

  const loadProductos = async () => {
    try {
      setCargando(true)
      const res = await fetch(`${API_URL}/productos`)
      const data = await res.json()
      if (data.success) setProductos(data.productos || [])
    } catch (e) {
      console.error(e)
    } finally {
      setCargando(false)
    }
  }

  const loadInventarios = async () => {
    try {
      const res = await fetch(`${API_URL}/inventario/`)
      const data = await res.json()
      if (data.success) setInventarios(data.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  const loadCategorias = async () => {
    try {
      const res = await fetch(`${API_URL}/categorias`)
      const data = await res.json()
      if (data.success) setCategorias(data.categorias || [])
    } catch (e) {
      console.error(e)
    }
  }

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

  const productosFiltrados = (() => {
    let filtrados = categoria === 'todas'
      ? productos
      : productos.filter(p => p.categoria_id === categoria)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      filtrados = filtrados.filter(p => p.nombre?.toLowerCase().includes(q))
    }
    return filtrados
  })()

  const abrirModal = (producto = null) => {
    setError(null)
    if (producto) {
      setForm({
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        precio: String(producto.precio || ''),
        categoria_id: producto.categoria_id ? String(producto.categoria_id) : '',
        disponible: producto.disponible ?? true,
        imagen: producto.imagen || '',
        variantes: Array.isArray(producto.variantes) ? [...producto.variantes] : [],
      })
      setEditId(producto.id)
    } else {
      setForm({ ...FIELDS })
      setEditId(null)
    }
    setModal(true)
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handlePrecioChange = (value) => {
    const soloDigitos = value.replace(/[^0-9]/g, '')
    handleChange('precio', soloDigitos)
  }

  const formatearPrecio = (val) => {
    if (!val) return ''
    return parseInt(val, 10).toLocaleString('es-PY')
  }

  const agregarVariante = () => {
    setForm(prev => ({
      ...prev,
      variantes: [...prev.variantes, { nombre: '', precio: '0', inventario_producto_id: '' }],
    }))
  }

  const editarVariante = (index, field, value) => {
    setForm(prev => {
      const v = [...prev.variantes]
      v[index] = { ...v[index], [field]: value }
      return { ...prev, variantes: v }
    })
  }

  const eliminarVariante = (index) => {
    setForm(prev => ({
      ...prev,
      variantes: prev.variantes.filter((_, i) => i !== index),
    }))
  }

  const subirImagen = async (file) => {
    if (!file) return
    setImagenError('')
    if (file.size > 20 * 1024 * 1024) {
      setImagenError('La imagen no debe superar los 20MB')
      return
    }
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('imagen', file)
      const res = await fetch(`${API_URL}/productos/subir-imagen`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (data.success) {
        handleChange('imagen', data.url)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setImagenError(data.error || 'Error al subir imagen')
      }
    } catch (e) {
      setImagenError('Error de conexión al subir imagen')
      console.error(e)
    } finally {
      setSubiendo(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDropActive(false)
    let file = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
    if (!file && e.dataTransfer?.items?.length) {
      const item = e.dataTransfer.items[0]
      if (item.kind === 'file') file = item.getAsFile()
    }
    if (file) { subirImagen(file); return }
    const url = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain')
    if (url) {
      setImagenError('')
      handleChange('imagen', url.trim())
    }
  }

  const guardar = async () => {
    if (!form.nombre || !form.precio) return

    const body = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      precio: parseInt(form.precio, 10),
      categoria_id: form.categoria_id ? parseInt(form.categoria_id, 10) : null,
      disponible: form.disponible,
      imagen: form.imagen,
      variantes: form.variantes.map(v => ({
        ...v,
        precio: v.precio ? parseInt(v.precio, 10) : null,
        inventario_producto_id: v.inventario_producto_id ? parseInt(v.inventario_producto_id, 10) : null,
      })),
    }

    try {
      const url = editId
        ? `${API_URL}/productos/${editId}/editar`
        : `${API_URL}/productos/crear`
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setModal(false)
        loadProductos()
        loadInventarios()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const eliminar = async () => {
    if (!confirmDelete) return
    try {
      const res = await fetch(`${API_URL}/productos/${confirmDelete}/eliminar`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        setConfirmDelete(null)
        setError(null)
        loadProductos()
        loadInventarios()
      } else {
        setError(data.error || 'Error al eliminar')
      }
    } catch (e) {
      setError('Error de conexión al eliminar')
      console.error(e)
    }
  }

  const toggleDisponible = async (id, current) => {
    try {
      await fetch(`${API_URL}/productos/${id}/toggle`, { method: 'POST' })
      loadProductos()
    } catch (e) {
      console.error(e)
    }
  }

  const s = {
    container: {
      minHeight: '100vh',
      background: darkMode ? '#121212' : '#f0f2f5',
      color: darkMode ? '#fff' : '#1a1a1a',
      overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 20px',
      background: '#1a1a1a',
      color: 'white',
      borderBottom: '1px solid rgba(255,152,0,0.2)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    },
    btn: {
      width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
      color: 'rgba(255,255,255,0.8)', fontSize: '18px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      textDecoration: 'none', transition: 'all 0.15s',
    },
    title: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
    body: {
      display: 'flex', height: 'calc(100vh - 64px)',
    },
    main: {
      flex: 1, overflow: 'auto', padding: '16px',
    },
    catBar: {
      display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto', padding: '0 4px',
      maxWidth: '100%', WebkitOverflowScrolling: 'touch', cursor: 'grab', userSelect: 'none',
    },
    catBtn: (active) => ({
      padding: '6px 14px', border: 'none', borderRadius: '8px',
      cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: '600',
      background: active ? '#FF9800' : darkMode ? '#2a2a2a' : '#e8e8e8',
      color: active ? 'white' : darkMode ? '#ccc' : '#666',
    }),
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '12px',
    },
    card: (disponible) => ({
      borderRadius: '14px', overflow: 'hidden', cursor: 'pointer',
      background: darkMode ? '#1e1e1e' : 'white',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      opacity: disponible ? 1 : 0.5,
      transition: 'all 0.15s',
    }),
    img: {
      width: '100%', height: '120px', objectFit: 'cover',
      background: darkMode ? '#2a2a2a' : '#f0f2f5',
    },
    placeholderImg: {
      width: '100%', height: '120px', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: darkMode ? '#2a2a2a' : '#f0f2f5',
      color: darkMode ? '#555' : '#ccc', fontSize: '32px',
    },
    cardBody: {
      padding: '10px 12px',
    },
    fab: {
      position: 'fixed', bottom: '24px', right: '24px',
      width: '48px', height: '48px', border: 'none', borderRadius: '14px',
      background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
      color: 'white', fontSize: '22px', cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(76,175,80,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50,
    },
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    },
    modalCard: {
      background: darkMode ? '#1e1e1e' : 'white',
      borderRadius: '20px', width: '92%', maxWidth: '500px',
      maxHeight: '85vh', overflow: 'auto', padding: '24px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    },
    input: {
      width: '100%', padding: '10px 14px',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
      borderRadius: '10px', background: darkMode ? '#2a2a2a' : '#f8f8f8',
      color: darkMode ? 'white' : '#1a1a1a', fontSize: '13px', outline: 'none',
      marginBottom: '10px', boxSizing: 'border-box',
    },
    select: {
      width: '100%', padding: '10px 14px',
      border: `1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
      borderRadius: '10px', background: darkMode ? '#2a2a2a' : '#f8f8f8',
      color: darkMode ? 'white' : '#1a1a1a', fontSize: '13px', outline: 'none',
      marginBottom: '10px', boxSizing: 'border-box',
    },
    dropZone: (active) => ({
      border: `2px dashed ${active ? '#FF9800' : darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
      borderRadius: '12px', padding: '20px', textAlign: 'center',
      background: active ? 'rgba(255,152,0,0.1)' : 'transparent',
      cursor: 'pointer', marginBottom: '10px',
      color: darkMode ? '#888' : '#999', fontSize: '12px',
    }),
  }

  return (
    <div style={{ ...s.container, overflowY: isMobile ? 'auto' : 'hidden', overflowX: 'hidden' }}>
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={s.btn}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={s.title}>Productos</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {!isMobile && <FullscreenButton />}
          <button onClick={toggleDarkMode} style={s.btn}><span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span></button>
        </div>
      </header>

      <div style={{ ...s.body, height: isMobile ? undefined : 'calc(100vh - 64px)', minHeight: isMobile ? 'calc(100vh - 64px)' : undefined, paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/productos" />

        <div style={s.main}>
          <div style={{ padding: '8px 12px', background: darkMode ? '#222' : '#fff', borderBottom: `1px solid ${darkMode ? '#333' : '#ddd'}` }}>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="🔍 Buscar producto..."
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${darkMode ? '#444' : '#ddd'}`,
                borderRadius: '8px', background: darkMode ? '#333' : '#f5f5f5',
                color: darkMode ? 'white' : '#333', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div
            ref={catBarRef}
            style={s.catBar}
            onMouseDown={iniciarDrag}
            onMouseMove={moverDrag}
            onMouseUp={detenerDrag}
            onMouseLeave={detenerDrag}
          >
            <button
              key="todas"
              style={s.catBtn(categoria === 'todas')}
              onClick={() => setCategoria('todas')}
            >🍽️ Todas</button>
            {categorias.map((cat) => (
              <button
                key={cat.id}
                style={s.catBtn(categoria === cat.id)}
                onClick={() => setCategoria(cat.id)}
              >{cat.nombre}</button>
            ))}
            <button
              onClick={() => setModalCategorias(true)}
              style={s.catBtn(false)}
              title="Gestionar categorías"
            >⚙️</button>
          </div>

          {cargando ? (
            <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#666' : '#999' }}>
              <span className="material-icons" style={{ fontSize: '48px' }}>sync</span>
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: darkMode ? '#666' : '#999' }}>
              <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800' }}>inventory_2</span>
              <p style={{ marginTop: '12px' }}>No hay productos. Tocá + para crear.</p>
            </div>
          ) : (
            <div style={s.grid}>
              {productosFiltrados.map((p) => (
                <div key={p.id} style={s.card(p.disponible)} onClick={() => abrirModal(p)}>
                  {p.imagen ? (
                    <img src={p.imagen} alt={p.nombre} style={s.img} />
                  ) : (
                    <div style={s.placeholderImg}>🍽️</div>
                  )}
                  <div style={s.cardBody}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: darkMode ? 'white' : '#333', marginBottom: '2px' }}>
                      {p.nombre}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#FF9800' }}>
                      {formatGuarani(p.precio)}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: darkMode ? '#888' : '#999' }}>
                          {p.categoria_nombre || 'Sin categoría'}
                        </span>
                      </div>
                      <span
                        onClick={(e) => { e.stopPropagation(); toggleDisponible(p.id, p.disponible) }}
                        style={{
                          padding: '2px 8px', borderRadius: '8px', fontSize: '9px', fontWeight: '700',
                          background: p.disponible ? '#4CAF50' : '#E53935',
                          color: 'white', cursor: 'pointer',
                        }}
                      >{p.disponible ? 'DISP' : 'NO'}</span>
                    </div>
                    {p.variantes?.length > 0 && (
                      <div style={{ fontSize: '9px', color: '#FF9800', marginTop: '4px' }}>
                        {p.variantes.length} variante(s)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button style={{ ...s.fab, bottom: isMobile ? '70px' : '24px' }} onClick={() => abrirModal(null)}>+</button>

      {confirmDelete && (
        <div style={s.overlay}>
          <div style={{ ...s.modalCard, textAlign: 'center', maxWidth: '350px' }}>
            <span className="material-icons" style={{ fontSize: '60px', color: '#E53935' }}>warning</span>
            <h3 style={{ margin: '10px 0', color: darkMode ? 'white' : '#333' }}>¿Eliminar producto?</h3>
            <p style={{ color: darkMode ? '#aaa' : '#666', fontSize: '13px', marginBottom: '16px' }}>
              Esta acción no se puede deshacer
            </p>
            {error && (
              <p style={{ color: '#E53935', fontSize: '12px', marginBottom: '12px', background: 'rgba(229,57,53,0.1)', padding: '8px', borderRadius: '8px' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => { setConfirmDelete(null); setError(null) }} style={{
                padding: '10px 24px', border: 'none', borderRadius: '10px',
                background: darkMode ? '#444' : '#ccc', color: darkMode ? 'white' : '#333', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={eliminar} style={{
                padding: '10px 24px', border: 'none', borderRadius: '10px',
                background: '#E53935', color: 'white', fontWeight: '700', cursor: 'pointer',
              }}>🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div style={s.overlay} onClick={() => { setModal(false); setError(null) }}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: darkMode ? 'white' : '#333', fontSize: '20px' }}>
                {editId ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
              </h2>
              <button onClick={() => setModal(false)} style={{
                width: '32px', height: '32px', border: 'none', borderRadius: '8px',
                background: darkMode ? '#444' : '#eee', cursor: 'pointer',
                color: darkMode ? 'white' : '#333', fontSize: '18px',
              }}>×</button>
            </div>

            <input
              style={s.input} placeholder="Nombre del producto"
              value={form.nombre} onChange={(e) => handleChange('nombre', e.target.value)}
            />

            <textarea
              style={{ ...s.input, minHeight: '60px', resize: 'vertical' }}
              placeholder="Descripción (opcional)"
              value={form.descripcion}
              onChange={(e) => handleChange('descripcion', e.target.value)}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '11px',
                  fontSize: '12px', color: darkMode ? '#888' : '#999',
                }}>Gs.</span>
                <input
                  style={{ ...s.input, paddingLeft: '36px' }}
                  placeholder="0"
                  value={formatearPrecio(form.precio)}
                  onChange={(e) => handlePrecioChange(e.target.value)}
                />
              </div>
              <select
                style={{ ...s.select, width: 'auto', minWidth: '120px' }}
                value={form.categoria_id}
                onChange={(e) => handleChange('categoria_id', e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', color: darkMode ? '#ccc' : '#666' }}>Disponible:</span>
              <button
                onClick={() => handleChange('disponible', !form.disponible)}
                style={{
                  padding: '6px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                  background: form.disponible ? '#4CAF50' : '#E53935',
                  color: 'white', fontWeight: '700', fontSize: '11px',
                }}
              >{form.disponible ? 'SÍ' : 'NO'}</button>
            </div>

            <div style={{ fontSize: '13px', fontWeight: '600', color: darkMode ? '#ccc' : '#666', marginBottom: '6px' }}>
              IMAGEN
            </div>
            <div
              style={s.dropZone(dropActive)}
              onDragEnter={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; setDropActive(true) }}
              onDragOver={(e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; setDropActive(true) }}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleDrop}
              />
              {form.imagen ? (
                <div>
                  <img src={form.imagen} alt="preview" style={{ maxHeight: '100px', borderRadius: '8px', marginBottom: '6px' }} />
                  <div style={{ fontSize: '11px', color: '#4CAF50' }}>✓ Imagen cargada</div>
                </div>
              ) : subiendo ? (
                <div style={{ fontSize: '13px', color: '#FF9800' }}>⏳ Subiendo imagen...</div>
              ) : (
                <div>
                  <span className="material-icons" style={{ fontSize: '28px' }}>cloud_upload</span>
                  <p style={{ margin: '4px 0' }}>Arrastrá una imagen o hacé clic</p>
                  <p style={{ fontSize: '10px', color: darkMode ? '#666' : '#aaa', margin: 0 }}>PNG o JPEG · Máx 5MB</p>
                </div>
              )}
            </div>
            {imagenError && (
              <div style={{ fontSize: '11px', color: '#E53935', marginBottom: '10px', padding: '6px 10px', background: 'rgba(229,57,53,0.1)', borderRadius: '8px' }}>
                ❌ {imagenError}
              </div>
            )}
            <input
              style={s.input} placeholder="O pegá una URL de imagen"
              value={form.imagen}
              onChange={(e) => { setImagenError(''); handleChange('imagen', e.target.value) }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', marginTop: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: darkMode ? '#ccc' : '#666' }}>
                VARIANTES {form.variantes.length > 0 && `(${form.variantes.length})`}
              </span>
              <button onClick={agregarVariante} style={{
                padding: '4px 12px', border: 'none', borderRadius: '8px',
                background: '#FF9800', color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
              }}>+ Variante</button>
            </div>

            {form.variantes.map((v, i) => (
              <div key={i} style={{
                background: darkMode ? '#333' : '#f5f5f5', borderRadius: '10px',
                padding: '10px', marginBottom: '8px',
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: darkMode ? '#888' : '#999', fontWeight: '600' }}>#{i + 1}</span>
                  <input
                    style={{ flex: 1, padding: '6px 10px', border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
                      borderRadius: '6px', background: darkMode ? '#3a3a3a' : 'white',
                      color: darkMode ? 'white' : '#333', fontSize: '12px', outline: 'none' }}
                    placeholder="Nombre (ej: Doble Carne)"
                    value={v.nombre}
                    onChange={(e) => editarVariante(i, 'nombre', e.target.value)}
                  />
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '8px', top: '7px', fontSize: '9px', color: '#999', fontWeight: '600' }}>Gs.</span>
                    <input
                      style={{ width: '100px', padding: '6px 6px 6px 28px', border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
                        borderRadius: '6px', background: darkMode ? '#3a3a3a' : 'white',
                        color: darkMode ? 'white' : '#333', fontSize: '12px', outline: 'none' }}
                      placeholder="Precio total"
                      value={v.precio}
                      onChange={(e) => editarVariante(i, 'precio', e.target.value.replace(/[^0-9]/g, ''))}
                    />
                  </div>
                  <button
                    onClick={() => eliminarVariante(i)}
                    style={{
                      width: '28px', height: '28px', border: 'none', borderRadius: '6px',
                      background: '#E53935', color: 'white', cursor: 'pointer', fontSize: '14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                </div>
                <select
                  style={{ width: '100%', padding: '6px 10px', border: `1px solid ${darkMode ? '#555' : '#ddd'}`,
                    borderRadius: '6px', background: darkMode ? '#3a3a3a' : 'white',
                    color: darkMode ? 'white' : '#333', fontSize: '11px', outline: 'none', boxSizing: 'border-box' }}
                  value={v.inventario_producto_id}
                  onChange={(e) => editarVariante(i, 'inventario_producto_id', e.target.value)}
                >
                  <option value="">Sin inventario vinculado</option>
                  {inventarios.map((inv) => (
                    <option key={inv.id} value={inv.producto_id}>
                      {inv.producto_nombre} (stock: {inv.stock_actual})
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button onClick={() => setModal(false)} style={{
                flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                background: darkMode ? '#444' : '#ccc', cursor: 'pointer',
                color: darkMode ? 'white' : '#333', fontWeight: '600',
              }}>Cancelar</button>
              {editId && (
                <button onClick={() => { setModal(false); setConfirmDelete(editId) }} style={{
                  padding: '12px 16px', border: 'none', borderRadius: '10px',
                  background: '#E53935', color: 'white', fontWeight: '700', cursor: 'pointer',
                }}>🗑️</button>
              )}
              <button onClick={guardar} disabled={!form.nombre || !form.precio} style={{
                flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white',
                fontWeight: '700', cursor: (!form.nombre || !form.precio) ? 'not-allowed' : 'pointer',
                opacity: (!form.nombre || !form.precio) ? 0.5 : 1,
              }}>💾 Guardar</button>
            </div>
          </div>
        </div>
      )}

      {modalCategorias && (
        <div style={s.overlay} onClick={() => setModalCategorias(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: darkMode ? 'white' : '#333', fontSize: '20px' }}>📁 Gestionar Categorías</h2>
              <button onClick={() => setModalCategorias(false)} style={{
                width: '32px', height: '32px', border: 'none', borderRadius: '8px',
                background: darkMode ? '#444' : '#eee', cursor: 'pointer',
                color: darkMode ? 'white' : '#333', fontSize: '18px',
              }}>×</button>
            </div>

            {editCategoria !== null ? (
              <div>
                <input
                  style={s.input} placeholder="Nombre"
                  value={formCategoria.nombre}
                  onChange={e => setFormCategoria(p => ({ ...p, nombre: e.target.value }))}
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <button onClick={() => { setEditCategoria(null); setFormCategoria({ nombre: '' }) }} style={{
                    flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                    background: darkMode ? '#444' : '#ccc', cursor: 'pointer',
                    color: darkMode ? 'white' : '#333', fontWeight: '600',
                  }}>Cancelar</button>
                  <button onClick={async () => {
                    if (!formCategoria.nombre) return
                    try {
                      const url = editCategoria === 'nueva'
                        ? `${API_URL}/categorias/crear`
                        : `${API_URL}/categorias/${editCategoria}/editar`
                      const method = editCategoria === 'nueva' ? 'POST' : 'PUT'
                      const res = await fetch(url, {
                        method,
                        body: JSON.stringify({ nombre: formCategoria.nombre }),
                      })
                      const data = await res.json()
                      if (data.success) {
                        setEditCategoria(null)
                        setFormCategoria({ nombre: '' })
                        loadCategorias()
                        loadProductos()
                      }
                    } catch (e) { console.error(e) }
                  }} style={{
                    flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #FF9800, #F57C00)', color: 'white',
                    fontWeight: '700', cursor: formCategoria.nombre ? 'pointer' : 'not-allowed',
                    opacity: formCategoria.nombre ? 1 : 0.5,
                  }}>💾 Guardar</button>
                </div>
              </div>
            ) : (
              <div>
                {categorias.length === 0 ? (
                  <p style={{ textAlign: 'center', color: darkMode ? '#888' : '#999', padding: '20px' }}>
                    No hay categorías. Creá la primera.
                  </p>
                ) : (
                  categorias.map(cat => (
                    <div key={cat.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', marginBottom: '6px',
                      borderRadius: '10px', background: darkMode ? '#2a2a2a' : '#f5f5f5',
                    }}>
                      <span style={{ flex: 1, fontWeight: '600', fontSize: '13px' }}>{cat.nombre}</span>
                      <button onClick={() => {
                        setEditCategoria(cat.id)
                        setFormCategoria({ nombre: cat.nombre })
                      }} style={{
                        width: '30px', height: '30px', border: 'none', borderRadius: '8px',
                        background: '#FF9800', color: 'white', cursor: 'pointer', fontSize: '14px',
                      }}>✏️</button>
                      <button onClick={async () => {
                        if (!window.confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return
                        try {
                          const res = await fetch(`${API_URL}/categorias/${cat.id}/eliminar`, { method: 'DELETE' })
                          const data = await res.json()
                          if (data.success) {
                            loadCategorias()
                            loadProductos()
                          }
                        } catch (e) { console.error(e) }
                      }} style={{
                        width: '30px', height: '30px', border: 'none', borderRadius: '8px',
                        background: '#E53935', color: 'white', cursor: 'pointer', fontSize: '14px',
                      }}>🗑️</button>
                    </div>
                  ))
                )}
                <button onClick={() => {
                  setEditCategoria('nueva')
                  setFormCategoria({ nombre: '' })
                }} style={{
                  width: '100%', padding: '12px', border: `1px dashed ${darkMode ? 'rgba(255,255,255,0.2)' : '#d0d0d0'}`,
                  borderRadius: '10px', background: 'transparent', cursor: 'pointer',
                  color: '#FF9800', fontWeight: '700', fontSize: '13px', marginTop: '8px',
                }}>+ Añadir categoría</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
