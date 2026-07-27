import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { MOBILE_HIDDEN_MODULES } from '../constants'
import { Link, useLocation } from 'react-router-dom'

const ALL_ITEMS = [
  { path: '/app/inicio', icon: 'home', label: 'Inicio', modulo: 'inicio' },
  { path: '/app/mesas', icon: 'table_restaurant', label: 'Mesas', modulo: 'mesas' },
  { path: '/app/cocina', icon: 'restaurant', label: 'Cocina', modulo: 'cocina' },
  { path: '/app/caja', icon: 'point_of_sale', label: 'Caja', modulo: 'caja' },
  { path: '/app/delivery', icon: 'delivery_dining', label: 'Delivery', modulo: 'delivery' },
  { path: '/app/informes', icon: 'analytics', label: 'Informes', modulo: 'informes' },
  { path: '/app/productos', icon: 'inventory_2', label: 'Productos', modulo: 'productos' },
  { path: '/app/inventario', icon: 'inventory', label: 'Inventario', modulo: 'inventario' },
  { path: '/app/configuracion', icon: 'settings', label: 'Config', modulo: 'configuracion' },
]

const RED = '#D32F2F'

export default function Sidebar({ activePath }) {
  const isMobile = useStore((state) => state.isMobile)
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  )
  const location = useLocation()
  const currentPath = activePath || location.pathname
  const visibleItems = ALL_ITEMS.filter(item => !isMobile || !MOBILE_HIDDEN_MODULES.includes(item.modulo))

  useEffect(() => {
    const check = () => setIsLandscape(window.innerWidth > window.innerHeight)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (isMobile) {
    const sidebarHeight = isLandscape ? '46px' : '58px'
    return (
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: sidebarHeight,
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        zIndex: 1000,
        borderTop: '1px solid rgba(255,255,255,0.08)',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          flex: 1,
          minWidth: 'max-content',
          padding: '0 4px',
        }}>
        {visibleItems.map((item, index) => {
          const isActive = currentPath === item.path
          return (
            <Link
              key={index}
              to={item.path}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                padding: isLandscape ? '4px 8px' : '6px 10px',
                borderRadius: '8px',
                textDecoration: 'none',
                background: isActive ? RED : 'transparent',
                color: isActive ? 'white' : '#999',
                minWidth: 0,
              }}
            >
              <span className="material-icons" style={{ fontSize: isLandscape ? '18px' : '22px', lineHeight: 1 }}>
                {item.icon}
              </span>
              <span style={{ fontSize: isLandscape ? '8px' : '9px', fontWeight: '600', lineHeight: 1.1 }}>{item.label}</span>
            </Link>
          )
        })}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: '6px',
      width: '90px',
      flexShrink: 0,
      height: '100vh',
      position: 'sticky',
      top: 0,
      overflowY: 'auto',
    }}>
      <Link to="/app/inicio" style={{
        width: '70px', height: '60px', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: 'none', background: RED, color: 'white',
        fontSize: '9px', fontWeight: '700', borderRadius: '10px', textDecoration: 'none',
        marginBottom: '4px',
      }}>
        <span className="material-icons" style={{ fontSize: '24px' }}>home</span>
        <span style={{ marginTop: '3px' }}>Inicio</span>
      </Link>

      <div style={{ width: '80%', height: '1px', background: 'rgba(255,255,255,0.08)', margin: '2px 0 4px' }} />

      {visibleItems.filter(item => item.modulo !== 'inicio').map((item, index) => (
        <Link
          key={index}
          to={item.path}
          style={{
            width: '70px',
            height: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: currentPath === item.path ? RED : 'transparent',
            color: currentPath === item.path ? 'white' : '#bbb',
            fontSize: '9px',
            fontWeight: '700',
            borderRadius: '10px',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
        >
          <span className="material-icons" style={{ fontSize: '24px' }}>
            {item.icon}
          </span>
          <span style={{ marginTop: '3px' }}>{item.label}</span>
        </Link>
      ))}
    </div>
  )
}