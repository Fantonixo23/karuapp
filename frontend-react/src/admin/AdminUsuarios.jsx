import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getApiUrl } from '../utils/api'

const API = getApiUrl()

const ROL_STYLES = {
  superadmin: { color: '#F44336', label: 'Superadmin' },
  administrador: { color: '#FF9800', label: 'Administrador' },
  cajero: { color: '#777777', label: 'Cajero' },
  cocina: { color: '#777777', label: 'Cocina' },
  mesero: { color: '#777777', label: 'Mesero' },
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'activos', label: 'Activos' },
  { id: 'bloqueados', label: 'Bloqueados' },
]

export default function AdminUsuarios() {
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [ocupado, setOcupado] = useState(null)

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) { navigate('/admin/login', { replace: true }); return }
    cargar()
  }, [])

  const cargar = async () => {
    try {
      const res = await fetch(`${API}/admin/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No autorizado')
      const data = await res.json()
      setUsuarios(data)
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      navigate('/admin/login', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const mostrarMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/admin/login', { replace: true })
  }

  const cambiarEstado = async (u) => {
    setOcupado(u.id)
    try {
      const res = await fetch(`${API}/admin/usuarios/${u.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activo: !u.activo }),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Error')
      setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, activo: !u.activo } : x))
      mostrarMsg(u.activo ? `Usuario "${u.nombre}" bloqueado` : `Usuario "${u.nombre}" desbloqueado`)
    } catch (e) {
      mostrarMsg('Error: ' + e.message, 'error')
    } finally {
      setOcupado(null)
    }
  }

  const eliminar = async (u) => {
    if (!window.confirm(`Eliminar permanentemente al usuario "${u.nombre}"? Esta acción no se puede deshacer.`)) return
    setOcupado(u.id)
    try {
      const res = await fetch(`${API}/admin/usuarios/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Error')
      setUsuarios(prev => prev.filter(x => x.id !== u.id))
      mostrarMsg(`Usuario "${u.nombre}" eliminado`)
    } catch (e) {
      mostrarMsg('Error: ' + e.message, 'error')
    } finally {
      setOcupado(null)
    }
  }

  const activos = usuarios.filter(u => u.activo).length
  const bloqueados = usuarios.length - activos

  const filtrados = usuarios.filter(u => {
    if (filtro === 'activos' && !u.activo) return false
    if (filtro === 'bloqueados' && u.activo) return false
    const t = busqueda.toLowerCase()
    if (!t) return true
    return (
      u.nombre?.toLowerCase().includes(t) ||
      u.email?.toLowerCase().includes(t) ||
      u.restaurante_nombre?.toLowerCase().includes(t)
    )
  })

  if (loading) return <PantallaCarga />

  return (
    <div style={s.container}>
      <header style={s.header}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '14px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link to="/admin" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px', textDecoration: 'none' }}>←</Link>
              <div>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#F44336' }}>LaCarta</span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>Usuarios</span>
              </div>
            </div>
            <button onClick={logout} style={{
              padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(244,67,54,0.3)',
              background: 'transparent', color: '#EF5350', fontWeight: '600', fontSize: '12px', cursor: 'pointer',
            }}>Salir</button>
          </div>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, email o restaurante..."
            style={s.search} />
        </div>
      </header>

      <div style={s.body}>
        {msg.text && (
          <div style={{
            padding: '12px', borderRadius: '10px', marginBottom: '16px', textAlign: 'center',
            background: msg.type === 'error' ? 'rgba(244,67,54,0.12)' : 'rgba(120,120,120,0.12)',
            color: msg.type === 'error' ? '#EF5350' : '#A0A0A0', fontSize: '13px', fontWeight: '600',
          }}>{msg.text}</div>
        )}

        <Resumen total={usuarios.length} activos={activos} bloqueados={bloqueados} />

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => setFiltro(f.id)} style={{
              padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              border: filtro === f.id ? '1px solid #F44336' : '1px solid rgba(255,255,255,0.08)',
              background: filtro === f.id ? 'rgba(244,67,54,0.12)' : 'transparent',
              color: filtro === f.id ? '#EF5350' : 'rgba(255,255,255,0.5)',
            }}>{f.label}</button>
          ))}
        </div>

        {filtrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
            <span className="material-icons" style={{ fontSize: '48px' }}>person_off</span>
            <p style={{ marginTop: '12px', fontSize: '14px' }}>No se encontraron usuarios</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtrados.map(u => (
              <CardUsuario
                key={u.id}
                u={u}
                ocupado={ocupado === u.id}
                onEstado={() => cambiarEstado(u)}
                onEliminar={() => eliminar(u)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PantallaCarga() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', 'Roboto', sans-serif" }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '36px', height: '36px', border: '3px solid rgba(244,67,54,0.2)',
          borderTopColor: '#F44336', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Cargando usuarios...</div>
      </div>
    </div>
  )
}

function Resumen({ total, activos, bloqueados }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '24px' }}>
      {[
        { label: 'Total', count: total, color: 'white', bg: 'rgba(255,255,255,0.04)' },
        { label: 'Activos', count: activos, color: '#A0A0A0', bg: 'rgba(120,120,120,0.1)' },
        { label: 'Bloqueados', count: bloqueados, color: '#EF5350', bg: 'rgba(244,67,54,0.1)' },
      ].map((item, i) => (
        <div key={i} style={{ borderRadius: '12px', padding: '16px', background: item.bg, border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: '800', color: item.color }}>{item.count}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function CardUsuario({ u, ocupado, onEstado, onEliminar }) {
  const rol = ROL_STYLES[u.rol] || { color: '#888', label: u.rol }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', borderRadius: '12px',
      background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', fontSize: '14px' }}>{u.nombre}</span>
          <span style={{
            padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700',
            background: `${rol.color}22`, color: rol.color,
          }}>{rol.label}</span>
          <span style={{
            padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700',
            background: u.activo ? 'rgba(120,120,120,0.15)' : 'rgba(244,67,54,0.15)',
            color: u.activo ? '#A0A0A0' : '#EF5350',
          }}>{u.activo ? 'Activo' : 'Bloqueado'}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {u.email && <span>{u.email}</span>}
          {u.restaurante_nombre && <span>{u.restaurante_nombre}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
        <button onClick={onEstado} disabled={ocupado} title={u.activo ? 'Bloquear' : 'Desbloquear'} style={{
          width: '36px', height: '36px', borderRadius: '8px', cursor: ocupado ? 'wait' : 'pointer',
          border: u.activo ? '1px solid rgba(255,152,0,0.3)' : '1px solid rgba(120,120,120,0.3)',
          background: u.activo ? 'rgba(255,152,0,0.1)' : 'rgba(120,120,120,0.1)',
          color: u.activo ? '#FFB74D' : '#A0A0A0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: ocupado ? 0.5 : 1,
        }}>
          <span className="material-icons" style={{ fontSize: '18px' }}>{u.activo ? 'lock' : 'lock_open'}</span>
        </button>
        <button onClick={onEliminar} disabled={ocupado} title="Eliminar" style={{
          width: '36px', height: '36px', borderRadius: '8px', cursor: ocupado ? 'wait' : 'pointer',
          border: '1px solid rgba(244,67,54,0.3)', background: 'rgba(244,67,54,0.1)', color: '#EF5350',
          display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: ocupado ? 0.5 : 1,
        }}>
          <span className="material-icons" style={{ fontSize: '18px' }}>delete</span>
        </button>
      </div>
    </div>
  )
}

const s = {
  container: {
    minHeight: '100vh', background: '#0f0f0f', color: 'white',
    fontFamily: "'Inter', 'Roboto', sans-serif",
  },
  header: {
    background: '#121212', borderBottom: '1px solid rgba(255,255,255,0.06)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  search: {
    width: '100%', padding: '10px 14px', fontSize: '13px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: '#1a1a1a',
    color: 'white', outline: 'none', boxSizing: 'border-box',
  },
  body: { maxWidth: '900px', margin: '0 auto', padding: '20px' },
}
