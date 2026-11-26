import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import FullscreenButton from '../components/FullscreenButton'
import { useStore } from '../store/useStore'

const createPlaceholder = (title, color, icon, activeRoute) => {
  return function() {
    const darkMode = useStore((state) => state.darkMode)
    const toggleDarkMode = useStore((state) => state.toggleDarkMode)
    const initDarkMode = useStore((state) => state.initDarkMode)
    const syncDarkMode = useStore((state) => state.syncDarkMode)
    const isMobile = useStore((state) => state.isMobile)

    useEffect(() => {
      initDarkMode()
      syncDarkMode()
    }, [])

    const styles = {
      container: (dm) => ({ minHeight: '100vh', background: 'transparent', color: 'var(--k-text-secondary)' }),
      header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: color, color: 'var(--k-text)' },
      btn: { width: '42px', height: '42px', border: 'none', background: 'transparent', color: 'var(--k-text)', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    }

    return (
      <div style={styles.container(darkMode)}>
        <header style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Link to="/app/inicio" style={styles.btn}><span className="material-icons">home</span></Link>
            <h1 style={{ fontSize: '22px', fontWeight: '700' }}>{title}</h1>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <FullscreenButton />
            <button onClick={toggleDarkMode} style={styles.btn}><span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span></button>
          </div>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '70px 1fr', height: 'calc(100vh - 64px)', paddingBottom: isMobile ? '60px' : '0' }}>
          <Sidebar activePath={activeRoute} />
          <div style={{ padding: isMobile ? '12px' : '20px' }}>
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--k-text-secondary)' }}>
              <span className="material-icons" style={{ fontSize: '60px', color: 'var(--k-text-secondary)' }}>{icon}</span>
              <p style={{ marginTop: '16px', color: 'var(--k-text-secondary)' }}>Página en construcción</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export const Productos = createPlaceholder('Productos', 'linear-gradient(135deg, #E53935, #e68900)', 'inventory_2', '/app/productos')
export const Inventario = createPlaceholder('Inventario', 'linear-gradient(135deg, #9C27B0, #7B1FA2)', 'inventory', '/app/inventario')
export const Config = createPlaceholder('Configuracion', 'linear-gradient(135deg, #666, #444)', 'settings', '/app/config')
export const Mesero = createPlaceholder('Vista Mesero', 'linear-gradient(135deg, #E53935, #C62828)', 'table_restaurant', '/app/mesero')
export const ParaLlevar = createPlaceholder('Para Llevar', 'linear-gradient(135deg, #22C55E, #388E3C)', 'takeout_dining', '/app/para-llevar')
export const Admin = createPlaceholder('Admin', 'linear-gradient(135deg, #333, #111)', 'admin_panel_settings', '/app/admin')