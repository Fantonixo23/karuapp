import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { getApiUrl } from '../utils/api'
import { formatGuarani } from '../utils/currency'
import Sidebar from '../components/Sidebar'

const API_URL = getApiUrl()

const s = {
  container: (dm) => ({
    minHeight: '100vh',
    background: dm ? '#121212' : '#f0f2f5',
    color: dm ? '#fff' : '#1a1a1a'
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: '#1a1a1a',
    color: 'white',
    borderBottom: '1px solid rgba(244,67,54,0.2)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
  },
  btnHeader: {
    width: '36px',
    height: '36px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    transition: 'all 0.15s'
  },
}

import { MOBILE_HIDDEN_MODULES } from '../constants'

const ALL_AREAS = [
  { path: '/app/mesas', icon: 'table_restaurant', label: 'Mesas', desc: 'Gestionar mesas', modulo: 'mesas' },
  { path: '/app/cocina', icon: 'restaurant', label: 'Cocina', desc: 'Pedidos en cocina', modulo: 'cocina' },
  { path: '/app/caja', icon: 'point_of_sale', label: 'Caja', desc: 'Cobros y facturas', modulo: 'caja' },
  { path: '/app/delivery', icon: 'delivery_dining', label: 'Delivery', desc: 'Pedidos a domicilio', modulo: 'delivery' },
  { path: '/app/informes', icon: 'analytics', label: 'Informes', desc: 'Reportes y ventas', modulo: 'informes' },
  { path: '/app/productos', icon: 'inventory_2', label: 'Productos', desc: 'Catalogo y stock', modulo: 'productos' },
  { path: '/app/inventario', icon: 'warehouse', label: 'Inventario', desc: 'Control de stock', modulo: 'inventario' },
]

export default function Inicio() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)
  useEffect(() => { initDarkMode(); syncDarkMode() }, [])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hora, setHora] = useState(new Date())
  const [stats, setStats] = useState(null)
  const [conexion, setConexion] = useState(null)
  const [showConexion, setShowConexion] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000)
    cargarStats()
    return () => clearInterval(t)
  }, [])

  const cargarStats = async () => {
    const [ventasRes, mesasRes, pedidosRes] = await Promise.all([
      fetch(`${API_URL}/informes/ventas-hoy`).catch(() => null),
      fetch(`${API_URL}/mesas`).catch(() => null),
      fetch(`${API_URL}/cocina/pedidos/`).catch(() => null),
    ])
    const ventas = ventasRes?.ok ? await ventasRes.json() : null
    const mesas = mesasRes?.ok ? await mesasRes.json() : null
    const pedidos = pedidosRes?.ok ? await pedidosRes.json() : null
    setStats({
      total_hoy: ventas?.data?.monto_total || 0,
      ordenes_hoy: ventas?.data?.total_ordenes || 0,
      mesas_ocupadas: mesas?.mesas?.filter(m => m.estado === 'ocupada')?.length || 0,
      pedidos_pendientes: pedidos?.pedidos?.length || 0,
    })
  }

  const cargarConexion = async () => {
    const res = await fetch(`${API_URL}/qr-conexion`).catch(() => null)
    if (res?.ok) setConexion(await res.json())
  }
  useEffect(() => { cargarConexion() }, [])

  const horas = hora.getHours()
  const saludo = horas < 12 ? 'Buenos dias' : horas < 18 ? 'Buenas tardes' : 'Buenas noches'
  const fechaStr = hora.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const horaStr = hora.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={s.container(darkMode)}>
      <header style={s.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="karuAPP" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>karuAPP</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right', marginRight: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#F44336', lineHeight: 1.2 }}>{horaStr}</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{fechaStr}</div>
          </div>
          <button onClick={toggleDarkMode} style={s.btnHeader}>
            <span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span>
          </button>
          <button onClick={() => setSidebarOpen(true)} style={s.btnHeader}>
            <span className="material-icons">menu</span>
          </button>
        </div>
      </header>

      <div style={{ padding: isMobile ? '60px 12px 80px' : '70px 20px 20px', maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '20px 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>
          {saludo}
        </h2>
        <p style={{ fontSize: '13px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', margin: '0 0 20px' }}>
          Selecciona un area para comenzar
        </p>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
            <div style={{
              borderRadius: '14px', padding: '14px', textAlign: 'center',
              border: '1px solid rgba(76,175,80,0.25)',
              background: darkMode ? 'rgba(76,175,80,0.1)' : 'rgba(76,175,80,0.06)',
            }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#4CAF50' }}>{formatGuarani(stats.total_hoy)}</div>
              <div style={{ fontSize: '10px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', marginTop: '2px' }}>Ventas hoy</div>
            </div>
            <div style={{
              borderRadius: '14px', padding: '14px', textAlign: 'center',
              border: '1px solid rgba(244,67,54,0.25)',
              background: darkMode ? 'rgba(244,67,54,0.1)' : 'rgba(244,67,54,0.06)',
            }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#F44336' }}>{stats.mesas_ocupadas}</div>
              <div style={{ fontSize: '10px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', marginTop: '2px' }}>Mesas ocupadas</div>
            </div>
            <div style={{
              borderRadius: '14px', padding: '14px', textAlign: 'center',
              border: '1px solid rgba(33,150,243,0.25)',
              background: darkMode ? 'rgba(33,150,243,0.1)' : 'rgba(33,150,243,0.06)',
            }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#2196F3' }}>{stats.pedidos_pendientes}</div>
              <div style={{ fontSize: '10px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', marginTop: '2px' }}>Pendientes</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px' }}>
          {ALL_AREAS.filter(area => !isMobile || !MOBILE_HIDDEN_MODULES.includes(area.modulo)).map((area, i) => (
            <Link key={i} to={area.path} style={{
              borderRadius: '14px', padding: '18px 10px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '8px', cursor: 'pointer',
              textDecoration: 'none', transition: 'all 0.15s',
              minHeight: '100px',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              background: darkMode ? '#1e1e1e' : 'white',
            }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'rgba(244,67,54,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span className="material-icons" style={{ fontSize: '22px', color: '#F44336' }}>{area.icon}</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: darkMode ? '#fff' : '#1a1a1a', textAlign: 'center', lineHeight: 1.2 }}>{area.label}</span>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: '16px' }}>
          <button onClick={() => setShowConexion(true)} style={{
            width: '100%', padding: '12px', borderRadius: '12px',
            border: `1px solid ${darkMode ? 'rgba(33,150,243,0.2)' : 'rgba(33,150,243,0.3)'}`,
            background: darkMode ? 'rgba(33,150,243,0.08)' : 'rgba(33,150,243,0.04)',
            color: darkMode ? '#90CAF9' : '#1976D2', cursor: 'pointer',
            fontSize: '13px', fontWeight: '600',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            <span className="material-icons" style={{ fontSize: '18px' }}>wifi</span>
            Acceder desde el celular
          </button>
        </div>

        {showConexion && conexion && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }} onClick={() => setShowConexion(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: darkMode ? '#1e1e1e' : 'white',
              borderRadius: '20px', padding: '30px', maxWidth: '340px', width: '90%',
              textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}>
              <h3 style={{ margin: '0 0 4px', color: darkMode ? '#fff' : '#1a1a1a' }}>Acceso desde celular</h3>
              <p style={{ fontSize: '12px', color: darkMode ? 'rgba(255,255,255,0.5)' : '#888', margin: '0 0 16px' }}>
                Escaneá el código QR con tu celular
              </p>
              {conexion.qr_base64 && (
                <img src={`data:image/png;base64,${conexion.qr_base64}`} alt="QR"
                  style={{ width: '200px', height: '200px', borderRadius: '12px', marginBottom: '16px' }} />
              )}
              <div style={{
                background: darkMode ? '#2a2a2a' : '#f5f5f5',
                borderRadius: '10px', padding: '12px', textAlign: 'left',
                fontSize: '13px'
              }}>
                <div style={{ color: darkMode ? '#aaa' : '#666', marginBottom: '4px' }}>O ingresá esta URL:</div>
                <code style={{
                  display: 'block', padding: '8px', borderRadius: '6px',
                  background: darkMode ? '#333' : '#e8e8e8',
                  color: '#4CAF50', fontWeight: '700', fontSize: '14px',
                  wordBreak: 'break-all', marginBottom: '8px'
                }}>{conexion.url_principal}</code>
                <div style={{ color: darkMode ? '#aaa' : '#666', fontSize: '11px' }}>
                  PC: <strong>{conexion.hostname}</strong>
                </div>
                {conexion.ips?.length > 1 && (
                  <div style={{ color: darkMode ? '#aaa' : '#666', fontSize: '11px', marginTop: '2px' }}>
                    IPs: {conexion.ips.join(', ')}
                  </div>
                )}
              </div>
              <button onClick={() => setShowConexion(false)}
                style={{ marginTop: '16px', padding: '10px 30px', borderRadius: '10px',
                  border: 'none', background: '#F44336', color: 'white', cursor: 'pointer',
                  fontWeight: '600' }}>Cerrar</button>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', padding: '40px 20px 80px', color: darkMode ? 'rgba(255,255,255,0.35)' : '#999' }}>
          <p style={{ fontSize: '12px', margin: 0 }}>
            ¿Tienes dudas o sugerencias? Contáctenos al <strong>+0992609484</strong>
          </p>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: isMobile ? '70px' : '20px', right: '20px', display: 'flex', gap: '10px', zIndex: 50 }}>
        <a href="https://wa.me/595992609484?text=Hola!%20tengo%20dudas%20o%20problemas%20con%20el%20sistema.%20%20Muchas%20gracias" target="_blank" rel="noopener noreferrer" style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none', boxShadow: '0 4px 12px rgba(37,211,102,0.3)' }}>
          <span className="material-icons" style={{ fontSize: '22px' }}>chat</span>
        </a>
        <a href="https://www.instagram.com/karu_app/" target="_blank" rel="noopener noreferrer" style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(45deg, #833AB4, #FD1D1D, #F77737)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textDecoration: 'none', boxShadow: '0 4px 12px rgba(131,58,180,0.3)' }}>
          <span className="material-icons" style={{ fontSize: '22px' }}>camera_alt</span>
        </a>
      </div>

      {sidebarOpen && (
        <>
          <div onClick={() => setSidebarOpen(false)} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 150
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: '280px', height: '100vh',
            background: 'linear-gradient(180deg, #1a1a1a, #0d0d0d)', zIndex: 200,
            borderLeft: '1px solid rgba(244,67,54,0.2)',
            display: 'flex', flexDirection: 'column',
            transform: 'translateX(0)', transition: 'transform 0.25s'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#F44336', fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '24px', cursor: 'pointer', padding: 0 }}>&times;</button>
            </div>

            {ALL_AREAS.filter(area => !isMobile || !MOBILE_HIDDEN_MODULES.includes(area.modulo)).map((area, i) => (
              <Link key={i} to={area.path} onClick={() => setSidebarOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px',
                border: 'none', background: 'none', color: '#ccc', fontSize: '14px',
                cursor: 'pointer', width: '100%', textAlign: 'left', textDecoration: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.15s'
              }}>
                <span className="material-icons" style={{ fontSize: '20px', color: '#F44336' }}>{area.icon}</span>
                <div>
                  <div style={{ fontWeight: '600' }}>{area.label}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{area.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      {isMobile && <Sidebar activePath="/app/inicio" />}
    </div>
  )
}