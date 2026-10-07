import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { getApiUrl } from '../utils/api'

const API = getApiUrl()

const PLANES = {
  estandar: {
    label: 'Estándar',
    precio: 350000,
    moneda: 'Gs',
    color: '#FF9800',
    features: [
      'Mesas', 'Caja', 'Productos', 'Inventario',
      'Configuración', 'Pantalla Cocina',
    ],
    limites: { usuarios: 3, sucursales: 1 },
  },
  premium: {
    label: 'Avanzado / Premium',
    precio: 0,
    moneda: 'Gs',
    color: '#9C27B0',
    features: [
      'Todos los módulos',
      'Delivery',
      'Informes',
      'Funcionarios',
      'SIFEN',
    ],
    limites: { usuarios: 6, sucursales: 'Ilimitadas' },
    extra: 'Atención al cliente prioritaria',
  },
  sin_plan: { label: 'Sin plan', precio: 0, moneda: '', color: '#666', features: [], limites: {} },
}

const STATUS_OPTIONS = ['activo', 'suspendido', 'pendiente']

export default function AdminRestauranteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [totalPagado, setTotalPagado] = useState(0)

  const [editPlan, setEditPlan] = useState('sin_plan')
  const [editEstado, setEditEstado] = useState('')
  const [editMotivo, setEditMotivo] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoNota, setPagoNota] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const token = localStorage.getItem('token')
  useEffect(() => {
    if (!token) { navigate('/admin/login', { replace: true }); return }
    cargar()
  }, [])

  const cargar = async () => {
    try {
      const [res, resTotal] = await Promise.all([
        fetch(`${API}/admin/restaurantes/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/admin/restaurantes/${id}/total-pagado`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (!res.ok || !resTotal.ok) throw new Error('Error')
      const d = await res.json()
      const t = await resTotal.json()
      setData(d)
      setTotalPagado(t.total || 0)
      setEditPlan(d.plan || 'sin_plan')
      setEditEstado(d.estado_licencia)
      setEditMotivo(d.motivo_bloqueo || '')
      setEditFecha(d.fecha_expiracion ? d.fecha_expiracion.split('T')[0] : '')
    } catch { navigate('/admin', { replace: true }) }
    finally { setLoading(false) }
  }

  const mostrarMsg = (text, type = 'success') => {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: '' }), 3000)
  }

  const guardarCambios = async () => {
    const body = { plan: editPlan, estado_licencia: editEstado, fecha_expiracion: editFecha || null }
    if (editEstado === 'suspendido') body.motivo_bloqueo = editMotivo || 'Sin motivo'
    try {
      const res = await fetch(`${API}/admin/restaurantes/${id}/licencia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Error')
      mostrarMsg('Cambios guardados correctamente')
      cargar()
    } catch (e) { mostrarMsg('Error: ' + e.message, 'error') }
  }

  const registrarPago = async () => {
    const monto = parseInt(pagoMonto)
    if (!monto || monto <= 0) { mostrarMsg('Ingresá un monto válido', 'error'); return }
    try {
      const res = await fetch(`${API}/admin/restaurantes/${id}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ monto, nota: pagoNota || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Error')
      setPagoMonto(''); setPagoNota('')
      mostrarMsg('Pago registrado correctamente')
      cargar()
    } catch (e) { mostrarMsg('Error: ' + e.message, 'error') }
  }

  const eliminarUsuario = async (userId, nombre) => {
    if (!window.confirm(`Eliminar permanentemente al usuario "${nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`${API}/admin/usuarios/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Error')
      mostrarMsg(`Usuario "${nombre}" eliminado`)
      cargar()
    } catch (e) { mostrarMsg('Error: ' + e.message, 'error') }
  }

  const eliminarRestaurante = async () => {
    try {
      const res = await fetch(`${API}/admin/restaurantes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Error')
      navigate('/admin', { replace: true })
    } catch (e) { mostrarMsg('Error: ' + e.message, 'error') }
  }

  if (loading) return <PantallaCarga />
  if (!data) return null

  const adminUser = data.usuarios?.find(u => u.rol === 'administrador')
  const planActual = PLANES[data.plan] || PLANES.sin_plan
  const diasRestantes = data.fecha_expiracion
    ? Math.ceil((new Date(data.fecha_expiracion) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div style={s.container}>
      <Header data={data} planActual={planActual} />

      <div style={s.body}>
        {msg.text && (
          <div style={{
            padding: '12px', borderRadius: '10px', marginBottom: '16px',
            background: msg.type === 'error' ? 'rgba(244,67,54,0.12)' : 'rgba(76,175,80,0.12)',
            color: msg.type === 'error' ? '#EF5350' : '#81C784',
            fontSize: '13px', fontWeight: '600', textAlign: 'center',
          }}>{msg.text}</div>
        )}

        <Grid cols="1fr 1fr">
          <Card title="Información general">
            <Fila label="Restaurante" value={data.nombre} />
            <Fila label="Plan" value={planActual.label} />
            <Fila label="Estado" value={data.estado_licencia} />
            <Fila label="Creado" value={new Date(data.fecha_alta).toLocaleDateString('es-PY')} />
            <Fila label="Slug" value={data.slug} />
            {data.motivo_bloqueo && <Fila label="Motivo bloqueo" value={data.motivo_bloqueo} />}
          </Card>

          <Card title="Licencia">
            <Fila label="Total pagado" value={`Gs ${totalPagado.toLocaleString('es-PY')}`} />
            {data.fecha_expiracion && (
              <Fila label="Vence" value={new Date(data.fecha_expiracion).toLocaleDateString('es-PY')} />
            )}
            {diasRestantes !== null && (
              <Fila label="Días restantes" value={
                <span style={{ color: diasRestantes <= 7 ? '#EF5350' : diasRestantes <= 30 ? '#FFB74D' : '#81C784', fontWeight: '700' }}>
                  {diasRestantes > 0 ? `${diasRestantes} días` : 'VENCIDA'}
                </span>
              } />
            )}
            <Fila label="Usuarios" value={`${data.usuarios?.length || 0} / ${planActual.limites?.usuarios || '∞'}`} />
            <Fila label="Sucursales" value={`${planActual.limites?.sucursales || '∞'}`} />
          </Card>
        </Grid>

        {adminUser && (
          <Card title="Contacto del cliente">
            <Grid cols="1fr 1fr">
              {adminUser.nombre && <Fila label="Nombre" value={adminUser.nombre} />}
              {adminUser.email && <Fila label="Email" value={adminUser.email} />}
              {adminUser.telefono && <Fila label="Teléfono" value={adminUser.telefono} />}
              {adminUser.ultimo_acceso && <Fila label="Último acceso" value={new Date(adminUser.ultimo_acceso).toLocaleString('es-PY')} />}
            </Grid>
          </Card>
        )}

        <Card title="Seleccionar plan">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <PlanCard
              plan="estandar"
              selected={editPlan === 'estandar'}
              onClick={() => { setEditPlan('estandar'); if (editEstado === 'pendiente') setEditEstado('activo') }}
            />
            <PlanCard
              plan="premium"
              selected={editPlan === 'premium'}
              onClick={() => { setEditPlan('premium'); if (editEstado === 'pendiente') setEditEstado('activo') }}
            />
          </div>

          <Grid cols="1fr 1fr 1fr">
            <div style={s.field}>
              <label style={s.label}>Estado</label>
              <select value={editEstado} onChange={e => setEditEstado(e.target.value)} style={s.input}>
                {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Vence</label>
              <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} style={s.input} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {editPlan !== 'sin_plan' && (
                <div style={{ fontSize: '22px', fontWeight: '800', color: PLANES[editPlan]?.color }}>
                  {PLANES[editPlan]?.precio > 0 ? `Gs ${PLANES[editPlan].precio.toLocaleString('es-PY')}/mes` : ''}
                </div>
              )}
            </div>
          </Grid>

          {editEstado === 'suspendido' && (
            <div style={s.field}>
              <label style={s.label}>Motivo del bloqueo</label>
              <input type="text" value={editMotivo} onChange={e => setEditMotivo(e.target.value)}
                placeholder="Ej: Falta de pago, Fin de prueba gratuita..." style={s.input} />
            </div>
          )}

          <button onClick={guardarCambios} style={s.btn}>Guardar cambios</button>
        </Card>

        <Card title="Registrar pago">
          <Grid cols="1fr 1fr">
            <div style={s.field}>
              <label style={s.label}>Monto (Gs)</label>
              <input type="number" value={pagoMonto} onChange={e => setPagoMonto(e.target.value)}
                placeholder="350000" min="0" style={s.input} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Nota (opcional)</label>
              <input type="text" value={pagoNota} onChange={e => setPagoNota(e.target.value)}
                placeholder="Pago mensual..." style={s.input} />
            </div>
          </Grid>
          <button onClick={registrarPago} style={{ ...s.btn, background: '#FF9800' }}>Registrar pago</button>
        </Card>

        {data.pagos?.length > 0 && (
          <Card title={`Historial de pagos (${data.pagos.length})`}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Fecha</th>
                  <th style={{ textAlign: 'right', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Monto</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {data.pagos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)' }}>{new Date(p.fecha).toLocaleDateString('es-PY')}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '700' }}>Gs {Number(p.monto).toLocaleString('es-PY')}</td>
                    <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.4)' }}>{p.nota || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {data.usuarios?.length > 0 && (
          <Card title={`Usuarios (${data.usuarios.length})`}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Nombre</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Email</th>
                  <th style={{ textAlign: 'left', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Rol</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>Estado</th>
                  <th style={{ textAlign: 'center', padding: '8px 4px', width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {data.usuarios.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 4px', fontWeight: '600' }}>{u.nombre}</td>
                    <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)' }}>{u.email || '—'}</td>
                    <td style={{ padding: '8px 4px', color: 'rgba(255,255,255,0.5)' }}>{u.rol}</td>
                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                        background: u.activo ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                        color: u.activo ? '#81C784' : '#EF5350',
                      }}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                      <button onClick={() => eliminarUsuario(u.id, u.nombre)} style={{
                        background: 'none', border: 'none', color: '#EF5350', cursor: 'pointer',
                        fontSize: '16px', padding: '2px', opacity: 0.6,
                      }} title="Eliminar usuario">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card title="Eliminar restaurante" style={{ border: '1px solid rgba(244,67,54,0.2)' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 10px 0' }}>
            Esta acción eliminará <strong>todos los datos</strong> del restaurante (usuarios, productos, pedidos, pagos, etc.) de forma permanente. No se puede deshacer.
          </p>
          <div style={{ marginBottom: '10px' }}>
            <label style={s.label}>Escribí <strong style={{ color: '#EF5350' }}>{data.nombre}</strong> para confirmar:</label>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={data.nombre} style={s.input} />
          </div>
          <button onClick={eliminarRestaurante} disabled={deleteConfirm !== data.nombre} style={{
            width: '100%', padding: '11px', borderRadius: '8px', border: 'none',
            background: deleteConfirm === data.nombre ? '#F44336' : '#333',
            color: deleteConfirm === data.nombre ? 'white' : '#666',
            fontWeight: '700', fontSize: '13px', cursor: deleteConfirm === data.nombre ? 'pointer' : 'not-allowed',
          }}>
            Eliminar permanentemente
          </button>
        </Card>
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
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Cargando...</div>
      </div>
    </div>
  )
}

function Header({ data, planActual }) {
  const estadoStyles = {
    pendiente: { bg: 'rgba(255,152,0,0.15)', color: '#FFB74D' },
    activo: { bg: 'rgba(76,175,80,0.15)', color: '#81C784' },
    suspendido: { bg: 'rgba(244,67,54,0.15)', color: '#EF5350' },
  }
  const es = estadoStyles[data.estado_licencia] || { bg: 'rgba(255,255,255,0.1)', color: '#999' }
  return (
    <header style={{
      background: '#121212', borderBottom: '1px solid rgba(255,255,255,0.06)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/admin" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '20px', textDecoration: 'none' }}>←</Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: '700' }}>{data.nombre}</span>
              <span style={{
                padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '700',
                background: es.bg, color: es.color,
              }}>{data.estado_licencia}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span>ID {data.id}</span>
              <span style={{ color: planActual.color }}>{planActual.label}</span>
              {planActual.precio > 0 && <span>Gs {planActual.precio.toLocaleString('es-PY')}/mes</span>}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function PlanCard({ plan, selected, onClick }) {
  const p = PLANES[plan]
  if (!p) return null
  return (
    <div onClick={onClick} style={{
      borderRadius: '12px', padding: '16px', cursor: 'pointer',
      border: selected ? `2px solid ${p.color}` : '2px solid rgba(255,255,255,0.08)',
      background: selected ? `${p.color}10` : '#1a1a1a',
      transition: 'all 0.15s',
    }}>
      <div style={{ fontSize: '14px', fontWeight: '700', color: selected ? p.color : 'white' }}>{p.label}</div>
      {p.precio > 0 && (
        <div style={{ fontSize: '20px', fontWeight: '800', color: p.color, margin: '6px 0' }}>
          Gs {p.precio.toLocaleString('es-PY')}
          <span style={{ fontSize: '11px', fontWeight: '400', color: 'rgba(255,255,255,0.4)' }}>/mes</span>
        </div>
      )}
      <ul style={{ margin: '6px 0 0', padding: '0 0 0 14px', fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.8' }}>
        {p.features.map((f, i) => <li key={i}>{f}</li>)}
        {p.limites?.usuarios && <li>Máx. {p.limites.usuarios} usuarios</li>}
        {p.limites?.sucursales && <li>{typeof p.limites.sucursales === 'number' ? `Máx. ${p.limites.sucursales}` : p.limites.sucursales} sucursal(es)</li>}
        {p.extra && <li style={{ color: '#FFB74D', fontWeight: '600' }}>{p.extra}</li>}
      </ul>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{
      borderRadius: '12px', padding: '18px', marginBottom: '16px',
      background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <h3 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
      {children}
    </div>
  )
}

function Fila({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ fontWeight: '600' }}>{value}</span>
    </div>
  )
}

function Grid({ cols, children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: cols || '1fr 1fr', gap: '12px' }}>{children}</div>
}

const s = {
  container: {
    minHeight: '100vh', background: '#0f0f0f', color: 'white',
    fontFamily: "'Inter', 'Roboto', sans-serif",
  },
  body: { maxWidth: '800px', margin: '0 auto', padding: '20px' },
  field: { marginBottom: '12px' },
  label: { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '600', color: '#aaa' },
  input: {
    width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)', background: '#222', color: 'white',
    outline: 'none', boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: '11px', borderRadius: '8px', border: 'none',
    background: '#4CAF50', color: 'white', fontWeight: '700', fontSize: '13px',
    cursor: 'pointer', marginTop: '8px',
  },
}
