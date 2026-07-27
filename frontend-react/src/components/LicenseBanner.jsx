import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { getApiUrl } from '../utils/api'

const API_URL = getApiUrl()

function getEstilo(estado) {
  const estilos = {
    por_vencer_5: {
      bg: 'linear-gradient(135deg, #f9a825, #f57f17)',
      icon: '🟡',
      titulo: 'Licencia próxima a vencer',
    },
    por_vencer_3: {
      bg: 'linear-gradient(135deg, #ff8f00, #e65100)',
      icon: '🟠',
      titulo: '⚠️ Licencia por vencer',
    },
    por_vencer_1: {
      bg: 'linear-gradient(135deg, #d32f2f, #b71c1c)',
      icon: '🔴',
      titulo: '🚨 Licencia crítica',
    },
    gracia: {
      bg: 'linear-gradient(135deg, #ff8f00, #e65100)',
      icon: '⚠️',
      titulo: 'Período de gracia',
    },
  }
  return estilos[estado] || null
}

export default function LicenseBanner() {
  const license = useStore((state) => state.license)
  const setLicense = useStore((state) => state.setLicense)
  const [minimized, setMinimized] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    verificarLicencia()
    const interval = setInterval(verificarLicencia, 12 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const verificarLicencia = async () => {
    try {
      const res = await fetch(`${API_URL}/verificar-licencia`)
      const data = await res.json()
      if (data.success) {
        setLicense({
          estado: data.estado,
          dias_restantes: data.dias_restantes,
          mensaje: data.mensaje,
          nombre: data.nombre || '',
          online: data.online || false,
          bloqueado: data.bloqueado || false,
        })
      }
    } catch (e) {
      console.error('Error verificando licencia:', e)
    }
    setLoading(false)
  }

  if (loading) return null

  const bloqueada = license.estado === 'bloqueada' || license.bloqueado

  if (bloqueada) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #d32f2f, #b71c1c)',
          padding: '40px 60px', borderRadius: '20px', textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          <span style={{ fontSize: '80px' }}>🔒</span>
          <h1 style={{ fontSize: '36px', marginTop: '20px', fontWeight: '800' }}>
            SISTEMA BLOQUEADO
          </h1>
          <p style={{ fontSize: '18px', marginTop: '15px', opacity: 0.9 }}>
            {license.mensaje || 'Su licencia ha vencido. Contacte al administrador.'}
          </p>
          <div style={{ marginTop: '30px', padding: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
            <p style={{ fontSize: '14px', margin: '5px 0' }}>📧 Contacte a karuAPP para renovar</p>
            <p style={{ fontSize: '14px', margin: '5px 0' }}>📱 Solicite renovación de licencia</p>
          </div>
        </div>
        <p style={{ marginTop: '20px', fontSize: '12px', opacity: 0.5 }}>
          karuAPP License Server
        </p>
      </div>
    )
  }

  const estilo = getEstilo(license.estado)
  if (!estilo) return null

  const esCritico = license.estado === 'por_vencer_1'

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        style={{
          position: 'fixed', bottom: '10px', right: '10px',
          background: estilo.bg, color: 'white', border: 'none',
          borderRadius: '50%', width: '40px', height: '40px',
          cursor: 'pointer', fontSize: '20px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
        {estilo.icon}
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: '10px', right: '10px',
      background: esCritico
        ? 'linear-gradient(135deg, #d32f2f, #b71c1c)'
        : estilo.bg,
      color: 'white', padding: '12px 20px', borderRadius: '12px',
      boxShadow: esCritico
        ? '0 0 30px rgba(211, 47, 47, 0.6)'
        : '0 8px 25px rgba(0,0,0,0.3)',
      zIndex: 9999, maxWidth: '380px',
      animation: `${esCritico ? 'pulseRojo' : 'fadeIn'} 0.3s ease-out`,
      border: esCritico ? '2px solid #ff5252' : 'none'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRojo {
          0% { opacity: 0; transform: scale(0.9); }
          50% { opacity: 0.5; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <span style={{
          fontSize: '24px',
          animation: esCritico ? 'blink 1.5s infinite' : 'none'
        }}>
          {estilo.icon}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '5px'
          }}>
            <strong style={{ fontSize: '14px' }}>{estilo.titulo}</strong>
            <button
              onClick={() => setMinimized(true)}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                color: 'white', cursor: 'pointer', padding: '2px 8px',
                borderRadius: '5px', fontSize: '16px'
              }}
            >−</button>
          </div>
          <p style={{
            fontSize: '12px', margin: 0, opacity: 0.95,
            fontWeight: esCritico ? 'bold' : 'normal'
          }}>
            {license.mensaje}
          </p>
          {license.dias_restantes <= 5 && (
            <div style={{
              marginTop: '8px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: esCritico ? 'bold' : 'normal'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: '3px'
              }}>
                <span>Días restantes:</span>
                <span style={{
                  fontWeight: 'bold',
                  fontSize: '16px',
                  color: esCritico ? '#ff5252' : '#fff'
                }}>{license.dias_restantes}</span>
              </div>
              <div style={{
                width: '100%', height: '6px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '3px', overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min(100, (license.dias_restantes / 5) * 100)}%`,
                  height: '100%',
                  background: esCritico
                    ? 'linear-gradient(90deg, #ff5252, #d32f2f)'
                    : 'linear-gradient(90deg, #fff176, #ffb300)',
                  borderRadius: '3px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>
          )}
          {esCritico && (
            <p style={{
              fontSize: '13px', margin: '8px 0 0 0',
              fontWeight: 'bold', textAlign: 'center',
              animation: 'blink 1s infinite'
            }}>
              ⚠️ El sistema se bloqueará automáticamente ⚠️
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
