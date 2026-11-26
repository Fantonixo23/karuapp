import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiUrl } from '../utils/api'
import { SUPERADMIN_EMAILS } from './superadmin'

const API = getApiUrl()

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

      const userEmail = data.user?.email?.trim().toLowerCase()
      if (!userEmail || !SUPERADMIN_EMAILS.includes(userEmail)) {
        throw new Error('Acceso restringido')
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
      background: 'transparent', fontFamily: "'Inter', 'Roboto', sans-serif",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'var(--k-surface)', borderRadius: '14px', padding: '36px 32px',
        width: '92%', maxWidth: '380px', border: '1px solid var(--k-border)',
        boxShadow: 'var(--k-shadow-sm)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--k-primary)', letterSpacing: '1px' }}>KaruApp</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>Panel de Administración</div>
        </div>

        {error && (
          <div style={{
            padding: '10px', borderRadius: '8px', marginBottom: '16px',
            background: 'rgba(229,57,53,0.12)', color: 'var(--k-primary-hover)',
            fontSize: '13px', fontWeight: '600', textAlign: 'center',
          }}>{error}</div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: 'var(--k-text-secondary)' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="vos@tuempresa.com"
            style={inputStyle} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: 'var(--k-text-secondary)' }}>Contraseña</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={inputStyle} />
        </div>

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
          background: loading ? '#555' : 'linear-gradient(135deg, #E53935, #D32F2F)',
          color: 'var(--k-text)', fontSize: '14px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
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
  border: '1px solid var(--k-border)', background: '#222',
  color: 'var(--k-text)', outline: 'none', boxSizing: 'border-box',
  transition: 'border 0.15s',
}
