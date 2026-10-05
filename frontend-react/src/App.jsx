import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Inicio from './pages/Inicio'
import Funcionarios from './pages/Funcionarios'
import NuevaVenta from './pages/NuevaVenta'
import Cocina from './pages/Cocina'
import Caja from './pages/Caja'
import Delivery from './pages/Delivery'
import Informes from './pages/Informes'
import Productos from './pages/Productos'
import Inventario from './pages/Inventario'
import Configuracion from './pages/Configuracion'
import SifenConfig from './pages/SifenConfig'
import Login from './pages/Login'
import AdminLogin from './admin/AdminLogin'
import AdminDashboard from './admin/AdminDashboard'
import AdminRestauranteDetalle from './admin/AdminRestauranteDetalle'
import RequireRole from './admin/RequireRole'
import { Config, Mesero, ParaLlevar, Admin } from './pages/Placeholders'
import { FullscreenProvider } from './hooks/useFullscreen.jsx'
import { useMediaQuery } from './hooks/useMediaQuery'
import { MOBILE_HIDDEN_MODULES } from './constants'
import LicenseBanner from './components/LicenseBanner'
import AuthGuard from './components/AuthGuard'

function MobileGuard({ children }) {
  const isMobile = useStore((s) => s.isMobile)
  if (isMobile) return <Navigate to="/app/inicio" replace />
  return children
}

export default function App() {
  useMediaQuery()
  const initAuth = useStore((s) => s.initAuth)
  const loading = useStore((s) => s.loading)

  useEffect(() => {
    initAuth()
  }, [])

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#121212', color: '#fff', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid rgba(244,67,54,0.2)',
            borderTopColor: '#F44336', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>Cargando...</div>
        </div>
      </div>
    )
  }

  return (
    <FullscreenProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<RequireRole rol="superadmin"><AdminDashboard /></RequireRole>} />
        <Route path="/admin/restaurantes/:id" element={<RequireRole rol="superadmin"><AdminRestauranteDetalle /></RequireRole>} />
        <Route path="/app/*" element={
          <AuthGuard>
            <LicenseBanner />
            <Routes>
              <Route path="inicio" element={<Inicio />} />
              <Route path="mesas" element={<NuevaVenta />} />
              <Route path="cocina" element={<Cocina />} />
              <Route path="caja" element={<MobileGuard><Caja /></MobileGuard>} />
              <Route path="delivery" element={<Delivery />} />
              <Route path="informes" element={<MobileGuard><Informes /></MobileGuard>} />
              <Route path="productos" element={<Productos />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="configuracion" element={<MobileGuard><Configuracion /></MobileGuard>} />
              <Route path="funcionarios" element={<Funcionarios />} />
              <Route path="sifen" element={<SifenConfig />} />
              <Route path="config" element={<Config />} />
              <Route path="mesero" element={<Mesero />} />
              <Route path="para-llevar" element={<ParaLlevar />} />
              <Route path="admin" element={<Admin />} />
            </Routes>
          </AuthGuard>
        } />
        <Route path="*" element={<Navigate to="/app/inicio" replace />} />
      </Routes>
    </FullscreenProvider>
  )
}
