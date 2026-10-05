import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { apiFetch, getApiUrl } from '../utils/api'
import UserButton from '../components/UserButton'
import Sidebar from '../components/Sidebar'

const API_URL = getApiUrl()
const F2A_KEY = '2fa_funcionarios_at'
const F2A_TIMEOUT = 60 * 60 * 1000

const s = {
  container: (dm) => ({
    minHeight: '100vh',
    background: dm ? '#121212' : '#f0f2f5',
    color: dm ? '#fff' : '#1a1a1a',
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: '#1a1a1a',
    color: 'white',
    borderBottom: '1px solid rgba(244,67,54,0.2)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
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
    transition: 'all 0.15s',
  },
  card: (dm) => ({
    background: dm ? '#1e1e1e' : 'white',
    borderRadius: '14px',
    padding: '20px',
    border: `1px solid ${dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  }),
  input: (dm) => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${dm ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
    background: dm ? '#2a2a2a' : '#f8f8f8',
    color: dm ? 'white' : '#1a1a1a',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  }),
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)',
  },
  overlayCard: {
    width: '90%', maxWidth: '380px',
    background: '#1e1e1e', borderRadius: '20px',
    padding: '32px', textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.06)',
  },
}

export default function Funcionarios() {
  const navigate = useNavigate()
  const darkMode = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)
  const isMobile = useStore((s) => s.isMobile)
  const user = useStore((s) => s.user)

  const [funcionarios, setFuncionarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', rol: 'mesero', email: '', pin: '' })
  const [error, setError] = useState('')

  const [verificado, setVerificado] = useState(false)
  const [esperandoCodigo, setEsperandoCodigo] = useState(false)
  const [codigo2FA, setCodigo2FA] = useState('')
  const [error2FA, setError2FA] = useState('')
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null)

  useEffect(() => {
    if (!user || user.rol !== 'administrador') {
      navigate('/app/inicio', { replace: true })
      return
    }
    const saved = localStorage.getItem(F2A_KEY)
    if (saved && Date.now() - Number(saved) < F2A_TIMEOUT) {
      setVerificado(true)
      cargarFuncionarios()
    }
  }, [])

  useEffect(() => {
    if (verificado) cargarFuncionarios()
  }, [verificado])

  const cargarFuncionarios = async () => {
    setLoading(true)
    try {
      const r = await apiFetch(`${API_URL}/funcionarios`)
      const d = await r.json()
      if (d.success) setFuncionarios(d.funcionarios)
    } catch {}
    setLoading(false)
  }

  const enviar2FA = async () => {
    setError2FA('')
    setEsperandoCodigo(false)
    setBloqueadoHasta(null)
    try {
      const r = await fetch(`${API_URL}/auth/enviar-2fa`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const d = await r.json()
      if (!r.ok) {
        if (d.message?.toLowerCase().includes('bloqueado') || d.message?.toLowerCase().includes('esper')) {
          setError2FA(d.message)
        } else {
          setError2FA(d.message || 'Error al enviar código')
        }
        return
      }
      setEsperandoCodigo(true)
    } catch {
      setError2FA('Error de conexión')
    }
  }

  const verificar2FA = async () => {
    setError2FA('')
    if (codigo2FA.length !== 6) { setError2FA('El código debe tener 6 dígitos'); return }
    try {
      const r = await fetch(`${API_URL}/auth/verificar-2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ code: codigo2FA }),
      })
      const d = await r.json()
      if (!r.ok) {
        const msg = d.message || 'Código inválido'
        if (msg.toLowerCase().includes('bloqueado')) {
          setBloqueadoHasta(Date.now() + 15 * 60 * 1000)
        }
        setError2FA(msg)
        return
      }
      localStorage.setItem(F2A_KEY, String(Date.now()))
      setVerificado(true)
    } catch {
      setError2FA('Error de conexión')
    }
  }

  const bloquear = () => {
    localStorage.removeItem(F2A_KEY)
    setVerificado(false)
    setEsperandoCodigo(false)
    setCodigo2FA('')
    setError2FA('')
    setBloqueadoHasta(null)
  }

  const guardarFuncionario = async () => {
    setError('')
    if (!form.nombre.trim()) { setError('Nombre requerido'); return }
    setLoading(true)
    try {
      const url = editando
        ? `${API_URL}/funcionarios/${editando.id}/editar`
        : `${API_URL}/funcionarios/crear`
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(form),
      })
      const d = await r.json()
      if (d.success) {
        setShowForm(false); setEditando(null); setForm({ nombre: '', rol: 'mesero', email: '', pin: '' })
        if (!editando) alert('Funcionario creado con PIN: ' + form.pin)
        cargarFuncionarios()
      } else setError(d.error || 'Error al guardar')
    } catch { setError('Error de conexión') }
    setLoading(false)
  }

  const eliminarFuncionario = async (f) => {
    if (!confirm('¿Eliminar a ' + f.nombre + '?')) return
    try {
      const r = await fetch(`${API_URL}/funcionarios/${f.id}/eliminar`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      const d = await r.json()
      if (d.success) cargarFuncionarios()
      else setError(d.error || 'Error al eliminar')
    } catch { setError('Error de conexión') }
  }

  const regenerarPin = async (f) => {
    try {
      const r = await fetch(`${API_URL}/funcionarios/${f.id}/regenerar-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ pin: '' }),
      })
      const d = await r.json()
      if (d.success) {
        alert('PIN regenerado correctamente')
        cargarFuncionarios()
      } else setError(d.error || 'Error al regenerar PIN')
    } catch { setError('Error de conexión') }
  }

  const editar = (f) => {
    setEditando(f)
    setForm({ nombre: f.nombre, rol: f.rol, email: f.email || '', pin: f.pin || '' })
    setShowForm(true)
  }

  return (
    <>
      {!verificado && (
        <div style={s.overlay}>
          <div style={s.overlayCard}>
            <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800', marginBottom: '12px' }}>lock</span>
            <h2 style={{ color: '#fff', fontSize: '18px', margin: '0 0 6px' }}>Verificación de seguridad</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 24px' }}>
              Para acceder a funcionarios, primero verificá tu identidad con un código enviado a tu email.
            </p>

            {error2FA && (
              <div style={{
                padding: '10px 14px', borderRadius: '10px',
                background: 'rgba(244,67,54,0.15)', color: '#ef5350',
                fontSize: '13px', marginBottom: '16px', textAlign: 'center',
              }}>{error2FA}</div>
            )}

            {bloqueadoHasta && (
              <div>
                <span className="material-icons" style={{ fontSize: '40px', color: '#ef5350', marginBottom: '8px' }}>gpp_bad</span>
                <p style={{ color: '#ef5350', fontSize: '14px', margin: '0 0 16px' }}>
                  Acceso bloqueado temporalmente por seguridad.
                </p>
                <button onClick={() => { setBloqueadoHasta(null); setError2FA(''); setCodigo2FA('') }}
                  style={{
                    padding: '10px 20px', borderRadius: '10px', border: 'none',
                    background: '#FF9800', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  }}>
                  Reintentar
                </button>
              </div>
            )}

            {!bloqueadoHasta && !esperandoCodigo && (
              <button onClick={enviar2FA} style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: '#FF9800', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}>
                Enviar código
              </button>
            )}

            {!bloqueadoHasta && esperandoCodigo && (
              <div>
                <input
                  placeholder="Ingresá el código de 6 dígitos"
                  value={codigo2FA}
                  onChange={e => setCodigo2FA(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(255,255,255,0.04)', color: '#fff',
                    fontSize: '20px', textAlign: 'center', letterSpacing: '8px',
                    outline: 'none', boxSizing: 'border-box',
                    marginBottom: '12px',
                  }}
                  autoFocus
                />
                <button onClick={verificar2FA} style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: '#F44336', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                }}>
                  Verificar
                </button>
                <p style={{ marginTop: '12px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                  <button onClick={enviar2FA}
                    style={{ background: 'none', border: 'none', color: '#FF9800', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
                    Reenviar código
                  </button>
                  {' · '}
                  <button onClick={() => { setError2FA(''); setCodigo2FA(''); setEsperandoCodigo(false) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                    Cancelar
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={s.container(darkMode)}>
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to="/app/inicio" style={s.btnHeader}><span className="material-icons">home</span></Link>
            <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
            <span style={{ fontSize: '18px', fontWeight: '700' }}>Funcionarios</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <UserButton slim />
            <button onClick={toggleDarkMode} style={s.btnHeader}>
              <span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span>
            </button>
            {verificado && (
              <button onClick={bloquear} title="Bloquear acceso" style={{
                ...s.btnHeader, color: '#FF9800',
              }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>lock</span>
              </button>
            )}
          </div>
        </header>

        <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
          {!isMobile && <Sidebar activePath="/app/funcionarios" />}
          <div style={{ flex: 1, padding: isMobile ? '16px 12px 80px' : '20px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Empleados</h2>
              <button onClick={() => { setEditando(null); setForm({ nombre: '', rol: 'mesero', email: '', pin: '' }); setShowForm(true); setError('') }} style={{
                padding: '10px 20px', borderRadius: '10px', border: 'none',
                background: '#FF9800', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span className="material-icons" style={{ fontSize: '18px' }}>add</span>
                Nuevo
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#7f1d1d', color: '#fca5a5', borderRadius: '8px', fontSize: '13px', marginBottom: '12px' }}>
                {error}
                <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>&times;</button>
              </div>
            )}

            {showForm && (
              <div style={s.card(darkMode)}>
                <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>{editando ? 'Editar' : 'Nuevo'} funcionario</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input placeholder="Nombre" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={s.input(darkMode)} />
                  <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value})} style={s.input(darkMode)}>
                    <option value="mesero">Mesero</option>
                    <option value="cajero">Cajero</option>
                    <option value="cocina">Cocina</option>
                  </select>
                  <input placeholder="Email (opcional)" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} style={s.input(darkMode)} />
                  <input placeholder="PIN" type="text" value={form.pin} onChange={e => setForm({...form, pin: e.target.value})} style={s.input(darkMode)} />
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => { setShowForm(false); setEditando(null); setError('') }} style={{
                      padding: '10px 20px', borderRadius: '8px', border: 'none',
                      background: darkMode ? '#333' : '#e0e0e0', color: darkMode ? '#ccc' : '#333', cursor: 'pointer', fontWeight: '600',
                    }}>Cancelar</button>
                    <button onClick={guardarFuncionario} disabled={loading} style={{
                      padding: '10px 20px', borderRadius: '8px', border: 'none',
                      background: '#FF9800', color: 'white', cursor: 'pointer', fontWeight: '600', opacity: loading ? 0.5 : 1,
                    }}>{loading ? '...' : editando ? 'Guardar' : 'Crear'}</button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {funcionarios.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '40px', color: darkMode ? '#666' : '#999' }}>
                  <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800' }}>people</span>
                  <p style={{ marginTop: '12px' }}>No hay funcionarios registrados</p>
                </div>
              )}
              {funcionarios.map(f => {
                const rolColor = f.rol === 'administrador' ? '#F44336' : f.rol === 'cajero' ? '#1976D2' : f.rol === 'cocina' ? '#FF9800' : '#4CAF50'
                return (
                  <div key={f.id} style={s.card(darkMode)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {f.nombre}
                          <span style={{
                            fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                            background: rolColor + '20', color: rolColor,
                          }}>{f.rol}</span>
                          {!f.activo && <span style={{ fontSize: '10px', color: '#ef4444' }}>(Inactivo)</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#888', marginTop: '4px', display: 'flex', gap: '16px' }}>
                          {f.email && <span>Email: {f.email}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => regenerarPin(f)} title="Regenerar PIN" style={{
                          width: '34px', height: '34px', borderRadius: '8px', border: '1px solid rgba(255,152,0,0.3)',
                          background: 'rgba(255,152,0,0.1)', color: '#FF9800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="material-icons" style={{ fontSize: '16px' }}>refresh</span>
                        </button>
                        <button onClick={() => editar(f)} title="Editar" style={{
                          width: '34px', height: '34px', borderRadius: '8px', border: '1px solid rgba(33,150,243,0.3)',
                          background: 'rgba(33,150,243,0.1)', color: '#2196F3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="material-icons" style={{ fontSize: '16px' }}>edit</span>
                        </button>
                        <button onClick={() => eliminarFuncionario(f)} title="Eliminar" style={{
                          width: '34px', height: '34px', borderRadius: '8px', border: '1px solid rgba(244,67,54,0.3)',
                          background: 'rgba(244,67,54,0.1)', color: '#F44336', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span className="material-icons" style={{ fontSize: '16px' }}>delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        {isMobile && <Sidebar activePath="/app/funcionarios" />}
      </div>
    </>
  )
}
