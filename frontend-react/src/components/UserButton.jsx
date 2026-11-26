import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function UserButton({ slim }) {
  const user = useStore((s) => s.user)
  const logout = useStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  if (!user) return null

  const name = user.name || user.email || 'Usuario'

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        style={{
          height: '36px',
          border: '1px solid var(--k-border)',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.9)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 10px',
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: "'Inter', 'Roboto', sans-serif",
        }}
      >
        <span className="material-icons" style={{ fontSize: '18px' }}>person</span>
        {!slim && <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: '#1e293b', borderRadius: '8px',
            boxShadow: 'var(--k-shadow-sm)',
            padding: '8px', minWidth: '170px', zIndex: 9999,
          }}>
            <div style={{
              padding: '8px 12px', color: '#f8fafc', fontSize: '13px',
              fontWeight: 500, borderBottom: '1px solid var(--k-border)',
              marginBottom: '4px', whiteSpace: 'nowrap'
            }}>
              {name}
            </div>
            <button onClick={logout} style={{
              width: '100%', padding: '8px 12px', background: '#ef4444',
              color: 'var(--k-text)', border: 'none', borderRadius: '10px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}>
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}
