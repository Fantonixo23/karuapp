import { Link } from 'react-router-dom'

const Page = ({ title, color, icon, children }) => (
  <div style={{ minHeight: '100vh', background: '#1a1a1a' }}>
    <header style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', background: color, color: 'white' }}>
      <h1 style={{ flex: 1, fontSize: '22px' }}>{title}</h1>
      <Link to="/app/inicio" style={{ width: '42px', height: '42px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-icons">home</span>
      </Link>
    </header>
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', height: 'calc(100vh - 64px)' }}>
      <div style={{ background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', gap: '6px' }}>
        <Link to="/app/mesas" style={{ width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: '#999', fontSize: '8px', borderRadius: '8px', textDecoration: 'none' }}>
          <span className="material-icons">add_shopping_cart</span>Nueva
        </Link>
        <Link to="/app/cocina" style={{ width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: '#999', fontSize: '8px', borderRadius: '8px', textDecoration: 'none' }}>
          <span className="material-icons">restaurant</span>Cocina
        </Link>
        <Link to="/app/caja" style={{ width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', background: color, color: 'white', fontSize: '8px', borderRadius: '8px', textDecoration: 'none' }}>
          <span className="material-icons">point_of_sale</span>Caja
        </Link>
        <Link to="/app/delivery" style={{ width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: '#999', fontSize: '8px', borderRadius: '8px', textDecoration: 'none' }}>
          <span className="material-icons">delivery_dining</span>Delivery
        </Link>
        <Link to="/app/informes" style={{ width: '54px', height: '54px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: '#999', fontSize: '8px', borderRadius: '8px', textDecoration: 'none' }}>
          <span className="material-icons">analytics</span>Informes
        </Link>
      </div>
      <div style={{ padding: '20px' }}>
        {children || <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}><span className="material-icons" style={{ fontSize: '60px', color: '#333' }}>{icon}</span><p style={{ marginTop: '16px' }}>Página en construcción</p></div>}
      </div>
    </div>
  </div>
)

export default function Caja() { return <Page title="Caja" color="linear-gradient(135deg, #FF9800, #e68900)" icon="point_of_sale" /> }
export function Delivery() { return <Page title="Delivery" color="linear-gradient(135deg, #4CAF50, #388E3C)" icon="delivery_dining" /> }
export function Informes() { return <Page title="Informes" color="linear-gradient(135deg, #1976D2, #1565C0)" icon="analytics" /> }
export function Productos() { return <Page title="Productos" color="linear-gradient(135deg, #FF9800, #e68900)" icon="inventory_2" /> }
export function Inventario() { return <Page title="Inventario" color="linear-gradient(135deg, #9C27B0, #7B1FA2)" icon="inventory" /> }
export function Config() { return <Page title="Configuracion" color="linear-gradient(135deg, #666, #444)" icon="settings" /> }
export function Mesero() { return <Page title="Vista Mesero" color="linear-gradient(135deg, #E53935, #C62828)" icon="table_restaurant" /> }
export function ParaLlevar() { return <Page title="Para Llevar" color="linear-gradient(135deg, #4CAF50, #388E3C)" icon="takeout_dining" /> }
export function Admin() { return <Page title="Admin" color="linear-gradient(135deg, #333, #111)" icon="admin_panel_settings" /> }
