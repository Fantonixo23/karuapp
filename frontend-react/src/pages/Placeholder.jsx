import { Link } from 'react-router-dom'

const createPage = (title, color, activeRoute) => {
  const Sidebar = () => {
    const items = [
      { path: '/app/mesas', icon: 'add_shopping_cart', label: 'Nueva' },
      { path: '/app/cocina', icon: 'restaurant', label: 'Cocina' },
      { path: '/app/caja', icon: 'point_of_sale', label: 'Caja' },
      { path: '/app/delivery', icon: 'delivery_dining', label: 'Delivery' },
      { path: '/app/informes', icon: 'analytics', label: 'Informes' },
      { path: '/app/productos', icon: 'inventory_2', label: 'Productos' },
    ]
    return (
      <div style={{ background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', gap: '6px' }}>
        {items.map((item, i) => (
          <Link key={i} to={item.path} style={{
            width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: 'none', background: activeRoute === item.path ? color.replace('linear-gradient(', 'rgba(').replace('), ', ',0.8), ') : 'none', 
            color: activeRoute === item.path ? 'white' : '#999', fontSize: '8px', borderRadius: '8px', textDecoration: 'none'
          }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>{item.icon}</span>{item.label}
          </Link>
        ))}
      </div>
    )
  }
  
  return function Page() {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1a1a' }}>
        <header style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', background: color, color: 'white' }}>
          <h1 style={{ flex: 1, fontSize: '22px' }}>{title}</h1>
          <Link to="/app/inicio" style={{ width: '42px', height: '42px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-icons">home</span>
          </Link>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', height: 'calc(100vh - 64px)' }}>
          <Sidebar />
          <div style={{ padding: '20px' }}>
            <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
              <span className="material-icons" style={{ fontSize: '60px', color: '#333' }}>build</span>
              <p style={{ marginTop: '16px' }}>Página en construcción</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export const Config = createPage('⚙️ Configuración', 'linear-gradient(135deg, #666, #444)', '/app/config')
export const Mesero = createPage('🍽️ Vista Mesero', 'linear-gradient(135deg, #E53935, #C62828)', '/app/mesero')
export const ParaLlevar = createPage('🥡 Para Llevar', 'linear-gradient(135deg, #4CAF50, #388E3C)', '/app/para-llevar')
export const Admin = createPage('⚙️ Admin', 'linear-gradient(135deg, #333, #111)', '/app/admin')
