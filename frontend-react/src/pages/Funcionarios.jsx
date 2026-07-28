import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getApiUrl } from '../utils/api'
import UserButton from '../components/UserButton'
import Sidebar from '../components/Sidebar'

const API_URL = getApiUrl()

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
}

export default function Funcionarios() {
  const darkMode = useStore((s) => s.darkMode)
  const toggleDarkMode = useStore((s) => s.toggleDarkMode)
  const isMobile = useStore((s) => s.isMobile)
  const user = useStore((s) => s.user)

  const [verifying, setVerifying] = useState(true)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [funcionarios, setFuncionarios] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', rol: 'mesero', email: '' })
  const [error, setError] = useState('')

  useEffect(() => { verificarAcceso() }, [])

  const verificarAcceso = async () => {
    try {
      const r = await fetch(API_URL + '/auth/me', { credentials: 'include' })
      const d = await r.json()
      if (!d.authenticated) { window.location.href = '/login'; return }
      if (d.user.rol !== 'administrador') { window.location.href = '/app/inicio'; return }
    } catch {}
    try {
      const r = await fetch(API_URL + '/funcionarios', { credentials: 'include' })
      if (r.ok) {
        const d = await r.json()
        if (d.success) { setFuncionarios(d.funcionarios); setVerifying(false); return }
      }
    } catch {}
    setVerifying(false)
    setCodeSent(false)
  }

  const enviarCodigo = async () => {
    setCodeError('')
    try {
      const r = await fetch(API_URL + '/auth/send-owner-code', { method: 'POST', credentials: 'include' })
      const d = await r.json()
      if (d.success) setCodeSent(true)
      else setCodeError(d.error || 'Error al enviar código')
    } catch { setCodeError('Error de conexión') }
  }

  const verificarCodigo = async () => {
    setCodeError('')
    if (!code || code.length !== 6) { setCodeError('Ingresá el código de 6 dígitos'); return }
    try {
      const r = await fetch(API_URL + '/auth/verify-owner-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }), credentials: 'include',
      })
      const d = await r.json()
      if (d.success) { setVerifying(false); cargarFuncionarios() }
      else setCodeError(d.error || 'Código inválido')
    } catch { setCodeError('Error de conexión') }
  }

  const cargarFuncionarios = async () => {
    setLoading(true)
    try {
      const r = await fetch(API_URL + '/funcionarios', { credentials: 'include' })
      const d = await r.json()
      if (d.success) setFuncionarios(d.funcionarios)
    } catch {}
    setLoading(false)
  }

  const guardarFuncionario = async () => {
    setError('')
    if (!form.nombre.trim()) { setError('Nombre requerido'); return }
    setLoading(true)
    try {
      const url = editando
        ? API_URL + '/funcionarios/' + editando.id + '/editar'
        : API_URL + '/funcionarios/crear'
      const r = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form), credentials: 'include',
      })
      const d = await r.json()
      if (d.success) {
        setShowForm(false); setEditando(null); setForm({ nombre: '', rol: 'mesero', email: '' })
        cargarFuncionarios()
      } else setError(d.error || 'Error al guardar')
    } catch { setError('Error de conexión') }
    setLoading(false)
  }

  const eliminarFuncionario = async (f) => {
    if (!confirm('¿Eliminar a ' + f.nombre + '?')) return
    try {
      const r = await fetch(API_URL + '/funcionarios/' + f.id + '/eliminar', {
        method: 'DELETE', credentials: 'include',
      })
      const d = await r.json()
      if (d.success) cargarFuncionarios()
      else setError(d.error || 'Error al eliminar')
    } catch { setError('Error de conexión') }
  }

  const regenerarPin = async (f) => {
    try {
      const r = await fetch(API_URL + '/funcionarios/' + f.id + '/regenerar-pin', {
        method: 'POST', credentials: 'include',
      })
      const d = await r.json()
      if (d.success) {
        alert('Nuevo PIN: ' + d.pin)
        cargarFuncionarios()
      } else setError(d.error || 'Error al regenerar PIN')
    } catch { setError('Error de conexión') }
  }

  const editar = (f) => {
    setEditando(f)
    setForm({ nombre: f.nombre, rol: f.rol, email: f.email || '' })
    setShowForm(true)
  }

  if (verifying) {
    return (
      <div style={s.container(darkMode)}>
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to="/app/inicio" style={s.btnHeader}><span className="material-icons">home</span></Link>
            <span style={{ fontSize: '18px', fontWeight: '700' }}>Funcionarios</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <UserButton slim />
          </div>
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '20px', textAlign: 'center' }}>
          {!codeSent ? (
            <>
              <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800', marginBottom: '16px' }}>verified_user</span>
              <h2 style={{ margin: '0 0 8px' }}>Verificación de identidad</h2>
              <p style={{ fontSize: '14px', color: darkMode ? '#aaa' : '#666', margin: '0 0 20px', maxWidth: '320px' }}>
                Para acceder a la gestión de funcionarios, te enviaremos un código de verificación a tu email.
              </p>
              <button onClick={enviarCodigo} style={{
                padding: '12px 30px', borderRadius: '10px', border: 'none',
                background: '#FF9800', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
              }}>Enviar código</button>
            </>
          ) : (
            <>
              <span className="material-icons" style={{ fontSize: '48px', color: '#4CAF50', marginBottom: '16px' }}>mark_email_read</span>
              <h2 style={{ margin: '0 0 8px' }}>Código enviado</h2>
              <p style={{ fontSize: '14px', color: darkMode ? '#aaa' : '#666', margin: '0 0 20px' }}>
                Revisá tu email e ingresá el código de 6 dígitos
              </p>
              <input
                type="text" maxLength={6} placeholder="000000"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                style={{
                  width: '200px', padding: '12px', fontSize: '24px', textAlign: 'center',
                  borderRadius: '10px', border: `2px solid ${codeError ? '#ef4444' : darkMode ? 'rgba(255,255,255,0.2)' : '#ddd'}`,
                  background: darkMode ? '#2a2a2a' : '#f8f8f8', color: darkMode ? 'white' : '#1a1a1a',
                  outline: 'none', letterSpacing: '8px', marginBottom: '12px',
                }}
              />
              {codeError && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px' }}>{codeError}</p>}
              <button onClick={verificarCodigo} style={{
                padding: '12px 30px', borderRadius: '10px', border: 'none',
                background: '#4CAF50', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
              }}>Verificar</button>
              <button onClick={() => { setCodeSent(false); setCode(''); setCodeError('') }} style={{
                display: 'block', margin: '12px auto 0', background: 'none', border: 'none',
                color: '#FF9800', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline',
              }}>Reenviar código</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
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
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>
        {!isMobile && <Sidebar activePath="/app/funcionarios" />}
        <div style={{ flex: 1, padding: isMobile ? '16px 12px 80px' : '20px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Empleados</h2>
            <button onClick={() => { setEditando(null); setForm({ nombre: '', rol: 'mesero', email: '' }); setShowForm(true); setError('') }} style={{
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
                        <span>PIN: <strong style={{ color: '#FF9800', letterSpacing: '2px' }}>{f.pin}</strong></span>
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
  )
}