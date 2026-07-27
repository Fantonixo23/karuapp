import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import Sidebar from '../components/Sidebar'
import { getApiUrl } from '../utils/api'

const API_URL = getApiUrl()

const DEPARTAMENTOS = {
  '1': { nombre: 'Capital', ciudades: { '1': 'ASUNCION (DISTRITO)' } },
  '2': { nombre: 'Concepción', ciudades: { '1': 'CONCEPCION', '2': 'HORQUETA', '3': 'LORETO', '4': 'YBY YAU' } },
  '3': { nombre: 'San Pedro', ciudades: { '1': 'SAN PEDRO DE YCUAMANDIYU', '2': 'SANTA ROSA', '3': 'CHORE' } },
  '4': { nombre: 'Cordillera', ciudades: { '1': 'CAACUPE', '2': 'PIRIBEBUY', '3': 'TOBATI', '4': 'ALTOS' } },
  '5': { nombre: 'Guairá', ciudades: { '1': 'VILLARRICA', '2': 'INDEPENDENCIA', '3': 'MBOCAYATY' } },
  '6': { nombre: 'Caaguazú', ciudades: { '1': 'CORONEL OVIEDO', '2': 'CAAGUAZU', '3': 'REPATRIACION' } },
  '7': { nombre: 'Caazapá', ciudades: { '1': 'CAAZAPA', '2': 'YUTY', '3': 'SAN JUAN NEPOMUCENO' } },
  '8': { nombre: 'Itapúa', ciudades: { '1': 'ENCARNACION', '2': 'CAMBYRETA', '3': 'CARMEN DEL PARANA' } },
  '9': { nombre: 'Misiones', ciudades: { '1': 'SAN JUAN BAUTISTA', '2': 'SANTA MARIA', '3': 'AYOLAS' } },
  '10': { nombre: 'Paraguarí', ciudades: { '1': 'PARAGUARI', '2': 'PIRAYU', '3': 'YAGUARON', '4': 'CARAPEGUA' } },
  '11': { nombre: 'Alto Paraná', ciudades: { '1': 'CIUDAD DEL ESTE', '2': 'PRESIDENTE FRANCO', '3': 'HERNANDARIAS', '4': 'MINGA GUAZU', '5': 'MINGA PORA', '6': 'SANTA RITA' } },
  '12': { nombre: 'Central', ciudades: { '1': 'AREGUA', '2': 'LUQUE', '3': 'CAPIATA', '4': 'ITAGUA', '5': 'LAMBARE', '6': 'FERNANDO DE LA MORA', '7': 'SAN LORENZO' } },
  '13': { nombre: 'Ñeembucú', ciudades: { '1': 'PILAR' } },
  '14': { nombre: 'Amambay', ciudades: { '1': 'PEDRO JUAN CABALLERO', '2': 'BELLA VISTA' } },
  '15': { nombre: 'Canindeyú', ciudades: { '1': 'SALTO DEL GUAIRA', '2': 'YPEJHU', '3': 'CURUGUATY' } },
  '16': { nombre: 'Presidente Hayes', ciudades: { '1': 'VILLA HAYES', '2': 'BENJAMIN ACEVAL', '3': 'NANAWA' } },
  '17': { nombre: 'Boquerón', ciudades: { '1': 'FILADELFIA', '2': 'LOMA PLATA', '3': 'MARISCAL ESTIGARRIBIA' } },
  '18': { nombre: 'Alto Paraguay', ciudades: { '1': 'FUERTE OLIMPO' } },
}

const ACTIVIDADES = [
  { codigo: '56100', descripcion: 'Servicio de comidas y bebidas (Restaurante, pizzería, bar)' },
  { codigo: '47111', descripcion: 'Venta al por menor en comercios no especializados' },
  { codigo: '47211', descripcion: 'Venta al por menor de frutas, verduras y hortalizas' },
  { codigo: '47222', descripcion: 'Venta al por menor de carnes y productos cárnicos' },
  { codigo: '47299', descripcion: 'Venta al por menor de otros productos alimenticios' },
  { codigo: '56210', descripcion: 'Servicio de comidas para eventos (catering)' },
  { codigo: '56300', descripcion: 'Servicio de bebidas (bar, discoteca)' },
  { codigo: '55100', descripcion: 'Servicio de alojamiento (hotel, hostal)' },
  { codigo: '10799', descripcion: 'Elaboración de otros productos alimenticios n.c.p.' },
]

export default function SifenConfig() {
  const darkMode = useStore((state) => state.darkMode)
  const toggleDarkMode = useStore((state) => state.toggleDarkMode)
  const initDarkMode = useStore((state) => state.initDarkMode)
  const syncDarkMode = useStore((state) => state.syncDarkMode)
  const isMobile = useStore((state) => state.isMobile)

  useEffect(() => { initDarkMode(); syncDarkMode() }, [])

  const [habilitado, setHabilitado] = useState(false)
  const [ambiente, setAmbiente] = useState('test')
  const [certNombre, setCertNombre] = useState(null)
  const [certFile, setCertFile] = useState(null)
  const [certPin, setCertPin] = useState('')
  const [csc, setCsc] = useState('')
  const [cscPin, setCscPin] = useState('')
  const [cscId, setCscId] = useState(1)
  const [cDepEmi, setCDepEmi] = useState('1')
  const [cCiuEmi, setCCiuEmi] = useState('1')
  const [dDesDepEmi, setDDesDepEmi] = useState('CAPITAL')
  const [dDesCiuEmi, setDDesCiuEmi] = useState('ASUNCION (DISTRITO)')
  const [cDirEmi, setCDirEmi] = useState('')
  const [dNumCas, setDNumCas] = useState(0)
  const [dEmailE, setDEmailE] = useState('')
  const [gActEco, setGActEco] = useState('56100')
  const [gActEcoDesc, setGActEcoDesc] = useState('Servicio de comidas y bebidas (Restaurante, pizzería, bar)')

  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' })
  const [testResult, setTestResult] = useState(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    cargarConfig()
    cargarStatus()
  }, [])

  const cargarConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/facturacion/config`)
      const data = await res.json()
      if (data.success && data.config) {
        const c = data.config
        setHabilitado(c.sifen_habilitado || false)
        setAmbiente(c.ambiente_sifen || 'test')
        setCertNombre(c.certificado_nombre || null)
        c.csc_configurado && setCsc('••••••••')
        setCscId(c.csc_id || 1)
        setCDepEmi(c.cDepEmi || '1')
        setCCiuEmi(c.cCiuEmi || '1')
        setDDesDepEmi(c.dDesDepEmi || 'CAPITAL')
        setDDesCiuEmi(c.dDesCiuEmi || 'ASUNCION (DISTRITO)')
        setCDirEmi(c.cDirEmi || '')
        setDNumCas(c.dNumCas || 0)
        setDEmailE(c.dEmailE || '')
        setGActEco(c.gActEco_codigo || '56100')
        setGActEcoDesc(c.gActEco_descripcion || '')
      }
    } catch {}
  }

  const cargarStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/sifen/status`)
      const data = await res.json()
      if (data.success) setStatus(data)
    } catch {}
  }

  const handleDepChange = (depCodigo) => {
    setCDepEmi(depCodigo)
    const dep = DEPARTAMENTOS[depCodigo]
    if (dep) {
      setDDesDepEmi(dep.nombre)
      const ciudadKeys = Object.keys(dep.ciudades)
      const firstCity = ciudadKeys[0]
      setCCiuEmi(firstCity)
      setDDesCiuEmi(dep.ciudades[firstCity])
    }
  }

  const handleCityChange = (ciuCodigo) => {
    setCCiuEmi(ciuCodigo)
    const dep = DEPARTAMENTOS[cDepEmi]
    if (dep && dep.ciudades[ciuCodigo]) {
      setDDesCiuEmi(dep.ciudades[ciuCodigo])
    }
  }

  const handleActividadChange = (codigo) => {
    setGActEco(codigo)
    const act = ACTIVIDADES.find(a => a.codigo === codigo)
    if (act) setGActEcoDesc(act.descripcion)
  }

  const guardarGeneral = async () => {
    setLoading(true)
    setMensaje({ tipo: '', texto: '' })
    try {
      const res = await fetch(`${API_URL}/facturacion/config/actualizar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sifen_habilitado: habilitado,
          ambiente_sifen: ambiente,
          csc,
          csc_pin: cscPin,
          csc_id: cscId,
          cDepEmi,
          cCiuEmi,
          dDesDepEmi,
          dDesCiuEmi,
          cDirEmi,
          dNumCas,
          dEmailE,
          gActEco_codigo: gActEco,
          gActEco_descripcion: gActEcoDesc,
        })
      })
      const data = await res.json()
      if (data.success) {
        setMensaje({ tipo: 'exito', texto: 'Configuración SIFEN guardada correctamente' })
        cargarStatus()
      } else {
        setMensaje({ tipo: 'error', texto: data.error || 'Error al guardar' })
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión: ' + e.message })
    }
    setLoading(false)
  }

  const subirCertificado = async () => {
    if (!certFile) {
      setMensaje({ tipo: 'error', texto: 'Seleccione un archivo .p12' })
      return
    }
    setLoading(true)
    setMensaje({ tipo: '', texto: '' })
    try {
      const formData = new FormData()
      formData.append('certificado', certFile)
      formData.append('pin', certPin)
      if (csc) formData.append('csc', csc)

      const res = await fetch(`${API_URL}/sifen/certificado/subir`, {
        method: 'PUT',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setCertNombre(certFile.name)
        setCertFile(null)
        setMensaje({ tipo: 'exito', texto: 'Certificado subido correctamente' })
        cargarStatus()
      } else {
        setMensaje({ tipo: 'error', texto: data.error || 'Error al subir certificado' })
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: 'Error de conexión: ' + e.message })
    }
    setLoading(false)
  }

  const probarSifen = async () => {
    setTestLoading(true)
    setTestResult(null)
    setMensaje({ tipo: '', texto: '' })
    try {
      const res = await fetch(`${API_URL}/sifen/status`)
      const data = await res.json()
      if (data.success) {
        const issues = []
        if (!data.sifen_habilitado) issues.push('SIFEN no está habilitado')
        if (!data.certificado_configurado) issues.push('Falta certificado digital')
        if (!data.csc_configurado) issues.push('Falta CSC')
        if (!data.sifen_disponible) issues.push('Librería sifen no instalada')

        if (issues.length > 0) {
          setTestResult({ success: false, message: 'Problemas detectados:\n• ' + issues.join('\n• ') })
        } else {
          setTestResult({
            success: true,
            message: `Todo configurado correctamente.\nAmbiente: ${data.ambiente === 'test' ? '🧪 Pruebas' : '🚀 Producción'}\nEmpresa: ${data.empresa || '—'}`
          })
        }
      } else {
        setTestResult({ success: false, message: 'Error al consultar estado' })
      }
    } catch (e) {
      setTestResult({ success: false, message: 'Error de conexión: ' + e.message })
    }
    setTestLoading(false)
  }

  const ciudades = DEPARTAMENTOS[cDepEmi]?.ciudades || {}

  return (
    <div style={{ ...s.container(darkMode), display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .anim { animation: fadeIn 0.3s ease-out; }
        .sf-input, .sf-select, .sf-textarea {
          width: 100%; padding: 11px 14px; font-size: 14px; border-radius: 10px;
          border: 1px solid ${darkMode ? 'rgba(255,255,255,0.15)' : '#d0d0d0'};
          background: ${darkMode ? '#2a2a2a' : '#f8f8f8'};
          color: ${darkMode ? 'white' : '#1a1a1a'};
          outline: none; box-sizing: border-box; transition: border 0.15s;
        }
        .sf-input:focus, .sf-select:focus { border-color: #FF9800; }
        .sf-toggle {
          position: relative; width: 48px; height: 26px; flex-shrink: 0;
          background: ${habilitado ? '#4CAF50' : (darkMode ? '#555' : '#ccc')};
          border-radius: 13px; cursor: pointer; transition: background 0.2s;
          border: none; padding: 0;
        }
        .sf-toggle::after {
          content: ''; position: absolute; top: 3px; left: ${habilitado ? '24px' : '3px'};
          width: 20px; height: 20px; border-radius: 50%;
          background: white; transition: left 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
      `}</style>

      <header style={{ ...s.header, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link to="/app/configuracion" style={s.btnHeader}>
            <span className="material-icons">arrow_back</span>
          </Link>
          <img src="/logo.png" alt="karuAPP" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
          <span style={s.title}>Facturación Electrónica SIFEN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={toggleDarkMode} style={s.btnHeader}>
            <span className="material-icons">{darkMode ? 'dark_mode' : 'light_mode'}</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, paddingBottom: isMobile ? '60px' : '0' }}>
        <Sidebar activePath="/app/sifen" />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={s.content}>

            {/* ESTADO */}
            {status && (
              <div style={{ ...s.card(darkMode), marginBottom: '16px' }} className="anim">
                <h2 style={s.cardTitle(darkMode)}>Estado de la Integración</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                  {[
                    { label: 'Habilitado', ok: status.sifen_habilitado },
                    { label: 'Certificado', ok: status.certificado_configurado },
                    { label: 'CSC', ok: status.csc_configurado },
                    { label: 'Librería SIFEN', ok: status.sifen_disponible },
                    { label: 'Librería KuDE', ok: status.kude_disponible },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 14px', borderRadius: '8px',
                      background: item.ok ? 'rgba(76,175,80,0.12)' : 'rgba(229,57,53,0.1)',
                      fontSize: '13px', fontWeight: '600',
                      color: item.ok ? '#2E7D32' : '#E53935'
                    }}>
                      <span className="material-icons" style={{ fontSize: '18px' }}>
                        {item.ok ? 'check_circle' : 'cancel'}
                      </span>
                      {item.label}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '13px', color: darkMode ? '#aaa' : '#666' }}>
                  Ambiente: <strong>{status.ambiente === 'test' ? '🧪 Pruebas (Homologación)' : '🚀 Producción'}</strong>
                  {status.empresa && <> · Empresa: <strong>{status.empresa}</strong></>}
                </div>
              </div>
            )}

            {/* HABILITAR SIFEN */}
            <div style={{ ...s.card(darkMode) }} className="anim">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={s.cardTitle(darkMode)}>Habilitar Facturación Electrónica</h2>
                  <p style={s.subtitle(darkMode)}>
                    {habilitado
                      ? 'SIFEN está activo. Al cobrar se generará factura electrónica.'
                      : 'Desactivado. El sistema funciona sin factura electrónica.'}
                  </p>
                </div>
                <button className="sf-toggle" onClick={() => setHabilitado(!habilitado)} />
              </div>
            </div>

            {habilitado && (
              <>
                {/* AMBIENTE */}
                <div style={{ ...s.card(darkMode) }} className="anim">
                  <h2 style={s.cardTitle(darkMode)}>Ambiente</h2>
                  <p style={s.subtitle(darkMode)}>Seleccioná el entorno de trabajo</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setAmbiente('test')}
                      style={{
                        flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                        background: ambiente === 'test' ? '#FF9800' : (darkMode ? '#333' : '#e0e0e0'),
                        color: ambiente === 'test' ? 'white' : (darkMode ? '#ccc' : '#333'),
                        fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                      }}
                    >
                      🧪 Pruebas (Homologación)
                    </button>
                    <button
                      onClick={() => setAmbiente('produccion')}
                      style={{
                        flex: 1, padding: '12px', border: 'none', borderRadius: '10px',
                        background: ambiente === 'produccion' ? '#4CAF50' : (darkMode ? '#333' : '#e0e0e0'),
                        color: ambiente === 'produccion' ? 'white' : (darkMode ? '#ccc' : '#333'),
                        fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                      }}
                    >
                      🚀 Producción
                    </button>
                  </div>
                  {ambiente === 'test' && (
                    <p style={{ marginTop: '10px', fontSize: '12px', color: '#FF9800', fontWeight: '600' }}>
                      Las facturas en ambiente de pruebas NO tienen validez fiscal.
                    </p>
                  )}
                </div>

                {/* CERTIFICADO DIGITAL */}
                <div style={{ ...s.card(darkMode) }} className="anim">
                  <h2 style={s.cardTitle(darkMode)}>Certificado Digital (PKCS12)</h2>
                  <p style={s.subtitle(darkMode)}>Archivo .p12 emitido por la DNIT para firmar facturas electrónicas</p>

                  {certNombre && (
                    <div style={{
                      padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
                      background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.3)',
                      display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#2E7D32'
                    }}>
                      <span className="material-icons" style={{ fontSize: '18px' }}>verified</span>
                      Certificado actual: <strong>{certNombre}</strong>
                    </div>
                  )}

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>Archivo .p12</label>
                    <input
                      type="file"
                      accept=".p12,.pfx"
                      onChange={(e) => setCertFile(e.target.files[0] || null)}
                      style={{ ...s.fileInput(darkMode), padding: '8px' }}
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>Contraseña del Certificado (PIN)</label>
                    <input
                      type="password"
                      value={certPin}
                      onChange={(e) => setCertPin(e.target.value)}
                      placeholder="PIN del archivo .p12"
                      className="sf-input"
                    />
                  </div>

                  <button
                    onClick={subirCertificado}
                    disabled={loading || !certFile}
                    style={{
                      width: '100%', padding: '11px', border: 'none', borderRadius: '10px',
                      background: loading || !certFile ? '#999' : '#FF9800',
                      color: 'white', fontWeight: '700', fontSize: '13px',
                      cursor: loading || !certFile ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? 'Subiendo...' : 'Subir Certificado'}
                  </button>
                </div>

                {/* CSC */}
                <div style={{ ...s.card(darkMode) }} className="anim">
                  <h2 style={s.cardTitle(darkMode)}>Código de Seguridad (CSC)</h2>
                  <p style={s.subtitle(darkMode)}>Código y PIN otorgados por SET al habilitarte como facturador electrónico</p>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>CSC</label>
                    <input
                      type="text"
                      value={csc}
                      onChange={(e) => setCsc(e.target.value)}
                      placeholder="Código de ~32 caracteres"
                      className="sf-input"
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>CSC PIN</label>
                    <input
                      type="password"
                      value={cscPin}
                      onChange={(e) => setCscPin(e.target.value)}
                      placeholder="PIN numérico del CSC"
                      className="sf-input"
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>ID del CSC</label>
                    <p style={{ fontSize: '12px', color: darkMode ? '#aaa' : '#888', margin: '0 0 8px' }}>
                      Identifica cuál de tus CSC está activo. Generalmente es <strong>1</strong>.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => setCscId(1)}
                        style={{
                          flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                          background: cscId === 1 ? '#FF9800' : (darkMode ? '#333' : '#e0e0e0'),
                          color: cscId === 1 ? 'white' : (darkMode ? '#ccc' : '#333'),
                          fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                        }}
                      >
                        CSC #1
                      </button>
                      <button
                        onClick={() => setCscId(2)}
                        style={{
                          flex: 1, padding: '10px', border: 'none', borderRadius: '10px',
                          background: cscId === 2 ? '#FF9800' : (darkMode ? '#333' : '#e0e0e0'),
                          color: cscId === 2 ? 'white' : (darkMode ? '#ccc' : '#333'),
                          fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                        }}
                      >
                        CSC #2
                      </button>
                    </div>
                  </div>
                </div>

                {/* ACTIVIDAD ECONÓMICA */}
                <div style={{ ...s.card(darkMode) }} className="anim">
                  <h2 style={s.cardTitle(darkMode)}>Actividad Económica</h2>
                  <p style={s.subtitle(darkMode)}>Código de actividad para el SIFEN</p>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>Seleccionar actividad</label>
                    <select
                      value={gActEco}
                      onChange={(e) => handleActividadChange(e.target.value)}
                      className="sf-select"
                    >
                      {ACTIVIDADES.map(a => (
                        <option key={a.codigo} value={a.codigo}>
                          {a.codigo} — {a.descripcion}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>Código</label>
                    <input type="text" value={gActEco} readOnly className="sf-input" style={{ fontFamily: 'monospace', opacity: 0.7 }} />
                  </div>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>Descripción</label>
                    <textarea
                      value={gActEcoDesc}
                      onChange={(e) => setGActEcoDesc(e.target.value)}
                      className="sf-textarea"
                      rows={2}
                    />
                  </div>
                </div>

                {/* DIRECCIÓN FISCAL */}
                <div style={{ ...s.card(darkMode) }} className="anim">
                  <h2 style={s.cardTitle(darkMode)}>Dirección Fiscal del Emisor</h2>
                  <p style={s.subtitle(darkMode)}>Datos de ubicación para el SIFEN</p>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ ...s.field, flex: 1 }}>
                      <label style={s.label(darkMode)}>Departamento</label>
                      <select
                        value={cDepEmi}
                        onChange={(e) => handleDepChange(e.target.value)}
                        className="sf-select"
                      >
                        {Object.entries(DEPARTAMENTOS).map(([cod, dep]) => (
                          <option key={cod} value={cod}>{dep.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ ...s.field, flex: 1 }}>
                      <label style={s.label(darkMode)}>Ciudad / Distrito</label>
                      <select
                        value={cCiuEmi}
                        onChange={(e) => handleCityChange(e.target.value)}
                        className="sf-select"
                      >
                        {Object.entries(ciudades).map(([cod, nom]) => (
                          <option key={cod} value={cod}>{nom}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={s.field}>
                    <label style={s.label(darkMode)}>Dirección (calle/avenida)</label>
                    <input
                      type="text"
                      value={cDirEmi}
                      onChange={(e) => setCDirEmi(e.target.value)}
                      placeholder="Av. San Martín"
                      className="sf-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ ...s.field, flex: 1 }}>
                      <label style={s.label(darkMode)}>Número de casa</label>
                      <input
                        type="number"
                        value={dNumCas}
                        onChange={(e) => setDNumCas(Number(e.target.value))}
                        placeholder="1234"
                        className="sf-input"
                      />
                    </div>
                    <div style={{ ...s.field, flex: 1 }}>
                      <label style={s.label(darkMode)}>Email</label>
                      <input
                        type="email"
                        value={dEmailE}
                        onChange={(e) => setDEmailE(e.target.value)}
                        placeholder="email@restaurante.com"
                        className="sf-input"
                      />
                    </div>
                  </div>
                </div>

                {/* BOTÓN GUARDAR */}
                <button
                  onClick={guardarGeneral}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px', border: 'none', borderRadius: '10px',
                    background: loading ? '#999' : 'linear-gradient(135deg, #4CAF50, #388E3C)',
                    color: 'white', fontSize: '15px', fontWeight: '700',
                    cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '12px'
                  }}
                >
                  {loading ? 'Guardando...' : 'Guardar Configuración SIFEN'}
                </button>

                {/* MENSAJE */}
                {mensaje.texto && (
                  <div style={{
                    padding: '12px', borderRadius: '10px', marginBottom: '12px',
                    background: mensaje.tipo === 'exito' ? 'rgba(76,175,80,0.12)' : 'rgba(229,57,53,0.1)',
                    color: mensaje.tipo === 'exito' ? '#2E7D32' : '#E53935',
                    fontWeight: '600', fontSize: '13px', textAlign: 'center'
                  }}>
                    {mensaje.texto}
                  </div>
                )}

                {/* PROBAR TRANSMISIÓN */}
                <div style={{ ...s.card(darkMode) }} className="anim">
                  <h2 style={s.cardTitle(darkMode)}>Probar Configuración</h2>
                  <p style={s.subtitle(darkMode)}>Verifica que todos los datos estén correctos antes de emitir facturas reales</p>

                  <button
                    onClick={probarSifen}
                    disabled={testLoading}
                    style={{
                      width: '100%', padding: '12px', border: 'none', borderRadius: '10px',
                      background: testLoading ? '#999' : '#2196F3',
                      color: 'white', fontWeight: '700', fontSize: '14px',
                      cursor: testLoading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {testLoading ? 'Verificando...' : '🔍 Verificar Estado SIFEN'}
                  </button>

                  {testResult && (
                    <div style={{
                      marginTop: '12px', padding: '14px', borderRadius: '10px', whiteSpace: 'pre-line',
                      background: testResult.success ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)',
                      border: `1px solid ${testResult.success ? 'rgba(76,175,80,0.3)' : 'rgba(255,152,0,0.3)'}`,
                      color: testResult.success ? '#2E7D32' : '#E65100',
                      fontSize: '13px', fontWeight: '600', lineHeight: '1.6'
                    }}>
                      <span className="material-icons" style={{ fontSize: '20px', verticalAlign: 'middle', marginRight: '6px' }}>
                        {testResult.success ? 'check_circle' : 'warning'}
                      </span>
                      {testResult.message}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* INFO LATERAL */}
            {!habilitado && (
              <div style={{
                ...s.card(darkMode), textAlign: 'center', padding: '40px 20px',
                opacity: 0.6
              }} className="anim">
                <span className="material-icons" style={{ fontSize: '48px', color: '#999', marginBottom: '12px' }}>receipt_long</span>
                <p style={{ fontSize: '14px', color: '#999', margin: 0 }}>
                  Activá la facturación electrónica para configurar certificado, CSC y datos fiscales.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  container: (dm) => ({
    minHeight: '100vh',
    background: dm ? '#121212' : '#f0f2f5',
    color: dm ? '#fff' : '#1a1a1a',
    overflow: 'hidden',
  }),
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    background: '#1a1a1a',
    color: 'white',
    borderBottom: '1px solid rgba(255,152,0,0.2)',
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
  title: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
  content: {
    padding: '20px',
    maxWidth: '600px',
    margin: '0 auto'
  },
  card: (dm) => ({
    borderRadius: '14px',
    padding: '20px',
    marginBottom: '16px',
    border: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    background: dm ? '#1e1e1e' : 'white',
    boxShadow: dm ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
  }),
  cardTitle: (dm) => ({
    margin: '0 0 5px 0',
    fontSize: '16px',
    fontWeight: '700',
    color: dm ? '#fff' : '#1a1a1a'
  }),
  subtitle: (dm) => ({
    margin: '0 0 16px 0',
    fontSize: '13px',
    color: dm ? 'rgba(255,255,255,0.5)' : '#888'
  }),
  field: {
    marginBottom: '15px'
  },
  label: (dm) => ({
    display: 'block',
    marginBottom: '5px',
    fontSize: '13px',
    fontWeight: '600',
    color: dm ? '#ccc' : '#555'
  }),
  fileInput: (dm) => ({
    width: '100%',
    padding: '8px',
    fontSize: '13px',
    borderRadius: '10px',
    border: `1px solid ${dm ? 'rgba(255,255,255,0.15)' : '#d0d0d0'}`,
    background: dm ? '#2a2a2a' : '#f8f8f8',
    color: dm ? 'white' : '#1a1a1a',
    boxSizing: 'border-box',
  }),
}
