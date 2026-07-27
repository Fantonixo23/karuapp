export const formatGuarani = (value) => {
  if (value === null || value === undefined || value === '') return '0 Gs'
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value
  return `${Math.round(num).toLocaleString('es-PY', { minimumFractionDigits: 0 })} Gs`
}

export const formatGuaraniInput = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value
  return Math.round(num).toLocaleString('es-PY', { minimumFractionDigits: 0 })
}