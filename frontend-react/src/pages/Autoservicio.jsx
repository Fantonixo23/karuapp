import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import UserButton from '../components/UserButton'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'

export default function Autoservicio() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  useEffect(() => {
    initDarkMode()
    syncDarkMode()
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: darkMode ? '#121212' : '#f0f2f5',
      color: darkMode ? '#fff' : '#1a1a1a',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', background: '#1a1a1a', color: 'white',
        borderBottom: '1px solid rgba(255,152,0,0.2)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/inicio" style={{
            width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.8)', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
          }}><span className="material-icons">home</span></Link>
          <img src="/logo.png" alt="LaCarta" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={{ fontSize: '18px', fontWeight: '700' }}>Autoservicio</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <FullscreenButton />
          <UserButton slim />
          <button onClick={toggleDarkMode} style={{
            width: '36px', height: '36px', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.8)', fontSize: '18px', cursor: 'pointer',
          }}>
            <span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)', paddingBottom: isMobile ? '60px' : '0' }}>
        {!isMobile && <Sidebar activePath="/app/autoservicio" />}
        <div style={{ flex: 1, padding: isMobile ? '12px' : '20px', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
          <div style={{
            borderRadius: '14px', padding: '20px', textAlign: 'center',
            background: darkMode ? '#1e1e1e' : 'white',
            border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <span className="material-icons" style={{ fontSize: '56px', color: '#FF9800' }}>storefront</span>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '12px 0 4px' }}>Autoservicio</h2>
            <p style={{ fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', margin: 0 }}>
              Modulo de autoservicio. En construccion.
            </p>
          </div>
        </div>
      </div>
      {isMobile && <Sidebar activePath="/app/autoservicio" />}
    </div>
  )
}