import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

const DOMINIOS_VALIDOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'msn.com', 'protonmail.com', 'mail.com']

const inputStyle = {
  width: '100%', padding: '12px 44px 12px 16px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff', fontSize: '15px', outline: 'none',
  boxSizing: 'border-box',
  fontFamily: "'Inter', 'Roboto', sans-serif",
}

const labelStyle = { color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }

function InputPass({ value, onChange, placeholder, show, toggleShow, label }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          style={inputStyle}
        />
        <span className="material-icons" onClick={toggleShow}
          style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '20px',
            userSelect: 'none',
          }}>
          {show ? 'visibility_off' : 'visibility'}
        </span>
      </div>
    </div>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  const len = password.length
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  const score = [len >= 8, len >= 12, hasUpper && hasLower, hasNumber, hasSpecial].filter(Boolean).length

  let color = '#ef5350'; let label = 'Débil'; let pct = 25
  if (score >= 4) { color = '#66bb6a'; label = 'Fuerte'; pct = 100 }
  else if (score >= 3) { color = '#ffa726'; label = 'Buena'; pct = 66 }
  else if (score >= 2) { color = '#ffa726'; label = 'Regular'; pct = 50 }

  return (
    <div style={{ marginBottom: '14px', marginTop: '-8px' }}>
      <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.2s, background 0.2s' }} />
      </div>
      <p style={{ color, fontSize: '11px', margin: '3px 0 0', fontWeight: 500 }}>{label}</p>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const loginPin = useStore((s) => s.loginPin)
  const loginSaaS = useStore((s) => s.loginSaaS)
  const registerSaaS = useStore((s) => s.registerSaaS)
  const verificarCuenta = useStore((s) => s.verificarCuenta)
  const reenviarCodigo = useStore((s) => s.reenviarCodigo)
  const olvideContrasena = useStore((s) => s.olvideContrasena)
  const verificarCodigo = useStore((s) => s.verificarCodigo)
  const restablecerContrasena = useStore((s) => s.restablecerContrasena)
  const user = useStore((s) => s.user)

  const [tab, setTab] = useState('pin')
  const [pin, setPin] = useState('')
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPass, setRegConfirmPass] = useState('')
  const [regNombre, setRegNombre] = useState('')
  const [showRegPass, setShowRegPass] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [forgotStep, setForgotStep] = useState(null)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotNewPass, setForgotNewPass] = useState('')
  const [forgotMsg, setForgotMsg] = useState('')
  const [verifyStep, setVerifyStep] = useState(false)
  const [verifyEmail, setVerifyEmail] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyDevCode, setVerifyDevCode] = useState('')
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    if (user) navigate('/app/inicio', { replace: true })
  }, [user])

  const dominioValido = (e) => {
    const d = e.split('@')[1]?.toLowerCase()
    return d && DOMINIOS_VALIDOS.includes(d)
  }

  const handlePinLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!pin || !slug) { setError('Completá todos los campos'); return }
    setLoading(true)
    try {
      await loginPin(pin, slug)
      navigate('/app/inicio', { replace: true })
    } catch (err) {
      setError(err.message || 'PIN o restaurante incorrecto')
    }
    setLoading(false)
  }

  const handleSaaSMagic = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completá todos los campos'); return }
    setLoading(true)
    try {
      await loginSaaS(email, password)
      navigate('/app/inicio', { replace: true })
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas')
    }
    setLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (!regEmail || !regPassword || !regConfirmPass || !regNombre) {
      setError('Completá todos los campos'); return
    }
    if (!dominioValido(regEmail)) {
      setError('Usá Gmail, Hotmail, Outlook, Yahoo o iCloud'); return
    }
    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres'); return
    }
    if (regPassword !== regConfirmPass) {
      setError('Las contraseñas no coinciden'); return
    }
    setLoading(true)
    try {
      const data = await registerSaaS(regEmail, regPassword, regNombre)
      setVerifyEmail(regEmail)
      setVerifyDevCode(data.devCode || '')
      setVerifyStep(true)
    } catch (err) {
      setError(err.message || 'Error al registrar')
    }
    setLoading(false)
  }

  const handleVerificar = async (e) => {
    e.preventDefault()
    setError('')
    if (verifyCode.length !== 6) { setError('Ingresá el código de 6 dígitos'); return }
    setVerificando(true)
    try {
      await verificarCuenta(verifyEmail, verifyCode)
      navigate('/app/inicio', { replace: true })
    } catch (err) {
      setError(err.message || 'Código inválido')
    }
    setVerificando(false)
  }

  const handleReenviar = async () => {
    setError('')
    try {
      const data = await reenviarCodigo(verifyEmail)
      if (data.devCode) setVerifyDevCode(data.devCode)
    } catch (err) {
      setError(err.message || 'Error al reenviar')
    }
  }

  const handleForgotEmail = async (e) => {
    e.preventDefault()
    setError(''); setForgotMsg('')
    if (!forgotEmail) { setError('Ingresá tu email'); return }
    setLoading(true)
    try {
      await olvideContrasena(forgotEmail)
      setForgotMsg('Si el email existe, recibirás un código por email')
      setForgotStep('code')
    } catch (err) {
      setError(err.message || 'Error al enviar código')
    }
    setLoading(false)
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setError(''); setForgotMsg('')
    if (!forgotCode) { setError('Ingresá el código'); return }
    setLoading(true)
    try {
      await verificarCodigo(forgotEmail, forgotCode)
      setForgotStep('newpass')
    } catch (err) {
      setError(err.message || 'Código inválido')
    }
    setLoading(false)
  }

  const handleResetPass = async (e) => {
    e.preventDefault()
    setError(''); setForgotMsg('')
    if (!forgotNewPass || forgotNewPass.length < 4) { setError('La contraseña debe tener al menos 4 caracteres'); return }
    setLoading(true)
    try {
      await restablecerContrasena(forgotEmail, forgotCode, forgotNewPass)
      setForgotMsg('Contraseña actualizada. Ahora iniciá sesión.')
      setForgotStep(null)
      setEmail(forgotEmail)
    } catch (err) {
      setError(err.message || 'Error al restablecer')
    }
    setLoading(false)
  }

  const s = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0d0d0d 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', 'Roboto', sans-serif",
    },
    card: {
      width: '100%', maxWidth: '400px', padding: '40px 32px',
      background: '#1e1e1e', borderRadius: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
    },
    input: {
      width: '100%', padding: '12px 16px', borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(255,255,255,0.04)',
      color: '#fff', fontSize: '15px', outline: 'none',
      boxSizing: 'border-box',
      fontFamily: "'Inter', 'Roboto', sans-serif",
    },
    btn: {
      width: '100%', padding: '12px', borderRadius: '10px',
      border: 'none', background: '#F44336', color: '#fff',
      fontSize: '15px', fontWeight: 700, cursor: 'pointer',
      fontFamily: "'Inter', 'Roboto', sans-serif",
    },
    tab: (active) => ({
      flex: 1, padding: '10px', borderRadius: '10px',
      border: 'none', background: active ? '#F44336' : 'rgba(255,255,255,0.04)',
      color: active ? '#fff' : 'rgba(255,255,255,0.5)',
      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
      fontFamily: "'Inter', 'Roboto', sans-serif",
    }),
  }

  if (verifyStep) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={{ position: 'relative', marginBottom: '24px', textAlign: 'center' }}>
            <button type="button" onClick={() => { setVerifyStep(false); setVerifyCode(''); setError(''); setShowRegister(true) }}
              style={{
                position: 'absolute', left: 0, top: 0,
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
              }}>
              <span className="material-icons" style={{ fontSize: '24px' }}>arrow_back</span>
            </button>
            <span className="material-icons" style={{ fontSize: '48px', color: '#FF9800', marginBottom: '8px' }}>mail</span>
            <h2 style={{ color: '#fff', fontSize: '18px', margin: '0 0 6px' }}>Activá tu cuenta</h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0' }}>
              Te enviamos un código a tu email.
            </p>
            {verifyDevCode && (
              <p style={{ color: '#FF9800', fontSize: '11px', margin: '8px 0 0', background: 'rgba(255,152,0,0.1)', padding: '6px 10px', borderRadius: '8px' }}>
                Modo desarrollo — Código: <strong>{verifyDevCode}</strong>
              </p>
            )}
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(244,67,54,0.15)', color: '#ef5350',
              fontSize: '13px', marginBottom: '16px', textAlign: 'center',
            }}>{error}</div>
          )}
          <form onSubmit={handleVerificar}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>CÓDIGO DE 6 DÍGITOS</label>
              <input
                placeholder="123456"
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                style={{ ...s.input, fontSize: '20px', textAlign: 'center', letterSpacing: '8px' }}
                autoFocus
              />
            </div>
            <button type="submit" style={s.btn} disabled={verificando}>
              {verificando ? 'Verificando...' : 'Activar cuenta'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
            <button type="button" onClick={handleReenviar}
              style={{ background: 'none', border: 'none', color: '#FF9800', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
              Reenviar código
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.png" alt="karuAPP" style={{ width: '56px', height: '56px', borderRadius: '14px', marginBottom: '12px' }} />
          <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: 0 }}>karuAPP</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '4px' }}>Sistema POS para restaurantes</p>
        </div>

        {!forgotStep && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
            <button style={s.tab(tab === 'pin')} onClick={() => setTab('pin')}>PIN</button>
            <button style={s.tab(tab === 'email')} onClick={() => setTab('email')}>Email</button>
          </div>
        )}

        {(error || forgotMsg) && (
          <div style={{
            padding: '10px 14px', borderRadius: '10px',
            background: error ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.15)',
            color: error ? '#ef5350' : '#66bb6a',
            fontSize: '13px', marginBottom: '16px', textAlign: 'center',
          }}>{error || forgotMsg}</div>
        )}

        {tab === 'pin' && !forgotStep && (
          <form onSubmit={handlePinLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>RESTAURANTE</label>
              <input style={s.input} placeholder="mi-restaurante" value={slug} onChange={(e) => setSlug(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>PIN</label>
              <input style={s.input} type="password" placeholder="1234" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={10} />
            </div>
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        )}

        {tab === 'email' && !forgotStep && !showRegister && (
          <form onSubmit={handleSaaSMagic}>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>EMAIL</label>
              <input style={s.input} type="email" placeholder="admin@karuapp.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <InputPass value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" show={showPass} toggleShow={() => setShowPass(!showPass)} label="CONTRASEÑA" />
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              <button type="button" onClick={() => { setForgotStep('email'); setForgotEmail(email); setError(''); setForgotMsg('') }}
                style={{ background: 'none', border: 'none', color: '#FF9800', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
                ¿Olvidó su contraseña?
              </button>
            </p>
            <p style={{ textAlign: 'center', marginTop: '8px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              ¿No tenés cuenta?{' '}
              <button type="button" onClick={() => { setShowRegister(true); setError('') }}
                style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
                Registrarse
              </button>
            </p>
          </form>
        )}

        {tab === 'email' && !forgotStep && showRegister && (
          <form onSubmit={handleRegister}>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>NOMBRE DEL RESTAURANTE</label>
              <input style={s.input} placeholder="Mi Restaurante" value={regNombre} onChange={(e) => setRegNombre(e.target.value)} autoFocus />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>EMAIL</label>
              <input style={s.input} type="email" placeholder="admin@gmail.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px', margin: '4px 0 0' }}>
                Solo Gmail, Hotmail, Outlook, Yahoo, iCloud
              </p>
            </div>
            <InputPass value={regPassword} onChange={e => setRegPassword(e.target.value)} placeholder="Mínimo 8 caracteres" show={showRegPass} toggleShow={() => setShowRegPass(!showRegPass)} label="CONTRASEÑA" />
            <PasswordStrength password={regPassword} />
            <InputPass value={regConfirmPass} onChange={e => setRegConfirmPass(e.target.value)} placeholder="Repetí la contraseña" show={showRegConfirm} toggleShow={() => setShowRegConfirm(!showRegConfirm)} label="CONFIRMAR CONTRASEÑA" />
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
              ¿Ya tenés cuenta?{' '}
              <button type="button" onClick={() => { setShowRegister(false); setError('') }}
                style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit' }}>
                Iniciar sesión
              </button>
            </p>
          </form>
        )}

        {forgotStep === 'email' && (
          <form onSubmit={handleForgotEmail}>
            <h3 style={{ color: '#fff', fontSize: '16px', margin: '0 0 6px' }}>¿Olvidaste tu contraseña?</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 20px' }}>
              Te enviamos un código a tu email.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>EMAIL</label>
              <input style={s.input} type="email" placeholder="admin@karuapp.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoFocus />
            </div>
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px' }}>
              <button type="button" onClick={() => { setForgotStep(null); setError(''); setForgotMsg('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                Volver
              </button>
            </p>
          </form>
        )}

        {forgotStep === 'code' && (
          <form onSubmit={handleVerifyCode}>
            <h3 style={{ color: '#fff', fontSize: '16px', margin: '0 0 6px' }}>Código de verificación</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 20px' }}>
              Ingresá el código de 6 dígitos que recibiste por email.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>CÓDIGO</label>
              <input style={s.input} type="text" placeholder="123456" value={forgotCode} onChange={(e) => setForgotCode(e.target.value)} maxLength={6} autoFocus />
            </div>
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px' }}>
              <button type="button" onClick={() => { setForgotStep('email'); setError(''); setForgotMsg('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                Volver
              </button>
            </p>
          </form>
        )}

        {forgotStep === 'newpass' && (
          <form onSubmit={handleResetPass}>
            <h3 style={{ color: '#fff', fontSize: '16px', margin: '0 0 6px' }}>Nueva contraseña</h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '0 0 20px' }}>
              Elegí una nueva contraseña para tu cuenta.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>NUEVA CONTRASEÑA</label>
              <input style={s.input} type="password" placeholder="••••••" value={forgotNewPass} onChange={(e) => setForgotNewPass(e.target.value)} autoFocus />
            </div>
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? 'Guardando...' : 'Restablecer contraseña'}
            </button>
            <p style={{ textAlign: 'center', marginTop: '16px' }}>
              <button type="button" onClick={() => { setForgotStep(null); setError(''); setForgotMsg('') }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                Volver
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
