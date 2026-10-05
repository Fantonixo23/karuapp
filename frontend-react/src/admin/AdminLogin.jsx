import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const API = '/api'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Completá todos los campos'); return }
    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/login-saas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Credenciales inválidas')

      if (data.user?.rol !== 'superadmin') {
        throw new Error('Acceso solo para administradores')
      }

      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f0f0f', fontFamily: "'Inter', 'Roboto', sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#1a1a1a', borderRadius: '16px', padding: '36px 32px',
        width: '92%', maxWidth: '380px', border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#F44336', letterSpacing: '1px' }}>karuAPP</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Panel de Administración</div>
        </div>

        {error && (
          <div style={{
            padding: '10px', borderRadius: '8px', marginBottom: '16px',
            background: 'rgba(244,67,54,0.12)', color: '#EF5350',
            fontSize: '13px', fontWeight: '600', textAlign: 'center',
          }}>{error}</div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#aaa' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="vos@tuempresa.com"
            style={inputStyle} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#aaa' }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle} />
        </div>

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
          background: loading ? '#555' : 'linear-gradient(135deg, #F44336, #D32F2F)',
          color: 'white', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '12px 14px', fontSize: '14px', borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)', background: '#222',
  color: 'white', outline: 'none', boxSizing: 'border-box',
  transition: 'border 0.15s',
}
