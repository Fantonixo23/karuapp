const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default function CantidadInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  allowDecimal = false,
  placeholder = '0',
  disabled = false,
  ariaLabel = 'Cantidad',
  inputStyle,
  containerStyle,
  buttonWidth = 34,
}) {
  const iconSize = buttonWidth <= 28 ? '13px' : '16px'
  const aplicar = (next) => {
    let numero = allowDecimal ? Math.round(next * 1000) / 1000 : Math.round(next)
    if (numero < min) numero = min
    if (max != null && numero > max) numero = max
    onChange(String(numero))
  }

  const subir = () => aplicar(toNumber(value) + step)
  const bajar = () => aplicar(toNumber(value) - step)

  const handleChange = (e) => {
    const raw = e.target.value
    const limpio = allowDecimal ? raw.replace(/[^0-9.,-]/g, '') : raw.replace(/[^0-9-]/g, '')
    onChange(limpio)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', ...containerStyle }}>
      <input
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', ...inputStyle }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: `${buttonWidth}px`,
          height: `${buttonWidth}px`,
          flexShrink: 0,
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#E53935',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <button
          type="button"
          className="k-stepper-btn"
          onClick={subir}
          disabled={disabled}
          aria-label="Aumentar"
          tabIndex={-1}
        >
          <span className="material-icons" style={{ fontSize: iconSize, color: '#fff' }}>keyboard_arrow_up</span>
        </button>
        <span style={{ height: '1px', background: 'rgba(255,255,255,0.4)' }} />
        <button
          type="button"
          className="k-stepper-btn"
          onClick={bajar}
          disabled={disabled}
          aria-label="Disminuir"
          tabIndex={-1}
        >
          <span className="material-icons" style={{ fontSize: iconSize, color: '#fff' }}>keyboard_arrow_down</span>
        </button>
      </div>
    </div>
  )
}
