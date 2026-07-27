import { useFullscreen } from '../hooks/useFullscreen.jsx'

export default function FullscreenButton() {
  const { isFullscreen, toggle } = useFullscreen() || { isFullscreen: false, toggle: () => {} }

  return (
    <button
      onClick={toggle}
      title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      style={{
        width: '42px',
        height: '42px',
        border: 'none',
        background: 'transparent',
        color: 'white',
        fontSize: '24px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isFullscreen ? '⛶' : '⛶'}
    </button>
  )
}