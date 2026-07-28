import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function UserButton({ slim }) {
  const user = useStore((s) => s.user)
  const logout = useStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  if (!user || !user.email) return null

  const name = user.name || user.email

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        style={{
          height: '36px',
          border: '1px solid rgba(255,255,255,0.12)',
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
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            padding: '8px', minWidth: '170px', zIndex: 9999,
          }}>
            <div style={{
              padding: '8px 12px', color: '#f8fafc', fontSize: '13px',
              fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.1)',
              marginBottom: '4px', whiteSpace: 'nowrap'
            }}>
              {name}
            </div>
            <button onClick={logout} style={{
              width: '100%', padding: '8px 12px', background: '#ef4444',
              color: '#fff', border: 'none', borderRadius: '6px',
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