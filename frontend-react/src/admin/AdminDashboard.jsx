import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getApiUrl } from '../utils/api'

const API = getApiUrl()

const ESTADO_STYLES = {
  pendiente: { bg: 'rgba(255,152,0,0.15)', color: '#FFB74D', label: 'Pendiente' },
  activo: { bg: 'rgba(76,175,80,0.15)', color: '#81C784', label: 'Activo' },
  suspendido: { bg: 'rgba(244,67,54,0.15)', color: '#EF5350', label: 'Suspendido' },
}

const PLAN_STYLES = {
  estandar: { bg: 'rgba(255,152,0,0.1)', color: '#FFB74D', label: 'Estándar' },
  premium: { bg: 'rgba(156,39,176,0.1)', color: '#CE93D8', label: 'Premium' },
  sin_plan: { bg: 'rgba(255,255,255,0.05)', color: '#666', label: 'Sin plan' },
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [restaurantes, setRestaurantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/admin/login', { replace: true }); return }
    fetch(`${API}/admin/restaurantes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => { if (!r.ok) throw new Error('No autorizado'); return r.json() })
      .then(data => { setRestaurantes(data); setLoading(false) })
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/admin/login', { replace: true }) })
  }, [])

  const filtrados = restaurantes.filter(r =>
    r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    r.usuarios?.[0]?.email?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const pendientes = filtrados.filter(r => r.estadoLicencia === 'pendiente')
  const activos = filtrados.filter(r => r.estadoLicencia === 'activo')
  const suspendidos = filtrados.filter(r => r.estadoLicencia === 'suspendido')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/admin/login', { replace: true })
  }

  const adminEmail = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').email } catch { return '' }
  })()

  if (loading) return <PantallaCarga />

  return (
    <div style={s.container}>
      <Header
        adminEmail={adminEmail}
        logout={logout}
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        total={restaurantes.length}
      />

      <div style={s.body}>
        <Resumen restaurantes={restaurantes} />

        {pendientes.length > 0 && (
          <Seccion titulo="Pendientes de aprobación" count={pendientes.length} color="#FFB74D" icon="hourglass_empty">
            {pendientes.map(r => <CardRestaurante key={r.id} r={r} />)}
          </Seccion>
        )}

        <Seccion titulo="Activos" count={activos.length} color="#81C784" icon="check_circle">
          {activos.map(r => <CardRestaurante key={r.id} r={r} />)}
        </Seccion>

        {suspendidos.length > 0 && (
          <Seccion titulo="Suspendidos" count={suspendidos.length} color="#EF5350" icon="block">
            {suspendidos.map(r => <CardRestaurante key={r.id} r={r} />)}
          </Seccion>
        )}

        {filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
            <span className="material-icons" style={{ fontSize: '48px' }}>search_off</span>
            <p style={{ marginTop: '12px', fontSize: '14px' }}>No se encontraron restaurantes</p>
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
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Cargando panel...</div>
      </div>
    </div>
  )
}

function Header({ adminEmail, logout, busqueda, setBusqueda, total }) {
  return (
    <header style={{
      background: '#121212', borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#F44336' }}>karuAPP</span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginLeft: '8px' }}>Admin Panel</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{adminEmail}</span>
            <button onClick={logout} style={{
              padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(244,67,54,0.3)',
              background: 'transparent', color: '#EF5350',
              fontWeight: '600', fontSize: '12px', cursor: 'pointer',
            }}>Salir</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span className="material-icons" style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '18px', color: 'rgba(255,255,255,0.3)',
            }}>search</span>
            <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o email..."
              style={{
                width: '100%', padding: '10px 14px 10px 38px', fontSize: '13px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)', background: '#1a1a1a',
                color: 'white', outline: 'none', boxSizing: 'border-box',
              }} />
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            {total} restaurantes
          </div>
        </div>
      </div>
    </header>
  )
}

function Resumen({ restaurantes }) {
  const counts = {
    pendiente: restaurantes.filter(r => r.estadoLicencia === 'pendiente').length,
    activo: restaurantes.filter(r => r.estadoLicencia === 'activo').length,
    suspendido: restaurantes.filter(r => r.estadoLicencia === 'suspendido').length,
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '24px' }}>
      {[
        { label: 'Pendientes', count: counts.pendiente, color: '#FFB74D', bg: 'rgba(255,152,0,0.1)' },
        { label: 'Activos', count: counts.activo, color: '#81C784', bg: 'rgba(76,175,80,0.1)' },
        { label: 'Suspendidos', count: counts.suspendido, color: '#EF5350', bg: 'rgba(244,67,54,0.1)' },
        { label: 'Total', count: restaurantes.length, color: 'white', bg: 'rgba(255,255,255,0.04)' },
      ].map((item, i) => (
        <div key={i} style={{ borderRadius: '12px', padding: '16px', background: item.bg, border: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontWeight: '800', color: item.color }}>{item.count}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

function Seccion({ titulo, count, color, icon, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
        <span className="material-icons" style={{ fontSize: '18px', color }}>{icon}</span>
        <h2 style={{ fontSize: '14px', fontWeight: '700', color, margin: 0 }}>{titulo}</h2>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginLeft: '4px' }}>({count})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
    </div>
  )
}

function CardRestaurante({ r }) {
  const es = ESTADO_STYLES[r.estadoLicencia] || { bg: 'rgba(255,255,255,0.05)', color: '#999', label: r.estadoLicencia }
  const ps = PLAN_STYLES[r.plan] || PLAN_STYLES.sin_plan
  const admin = r.usuarios?.[0]
  const diasRestantes = r.fechaExpiracion
    ? Math.ceil((new Date(r.fechaExpiracion) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Link to={`/admin/restaurantes/${r.id}`} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', borderRadius: '12px', textDecoration: 'none',
      background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
      transition: 'all 0.15s', color: 'white',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '700', fontSize: '14px' }}>{r.nombre}</span>
          <span style={{
            padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700',
            background: es.bg, color: es.color,
          }}>{es.label}</span>
          <span style={{
            padding: '2px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700',
            background: ps.bg, color: ps.color,
          }}>{ps.label}</span>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {admin?.email && <span>✉ {admin.email}</span>}
          {admin?.telefono && <span>📞 {admin.telefono}</span>}
          <span>👤 {r._count?.usuarios || 0} usuarios</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {diasRestantes !== null && (
          <div style={{
            fontSize: '11px', fontWeight: '600',
            color: diasRestantes <= 7 ? '#EF5350' : diasRestantes <= 30 ? '#FFB74D' : 'rgba(255,255,255,0.4)',
          }}>
            {diasRestantes > 0 ? `${diasRestantes} días` : 'Vencido'}
          </div>
        )}
        {r.fechaExpiracion && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
            {new Date(r.fechaExpiracion).toLocaleDateString('es-PY')}
          </div>
        )}
      </div>
    </Link>
  )
}

const s = {
  container: {
    minHeight: '100vh', background: '#0f0f0f', color: 'white',
    fontFamily: "'Inter', 'Roboto', sans-serif",
  },
  body: {
    maxWidth: '900px', margin: '0 auto', padding: '20px',
  },
}
