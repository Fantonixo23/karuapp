const getBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const hostname = window.location.hostname
  const defaultPort = protocol === 'https:' ? '443' : '80'
  const port = window.location.port || defaultPort
  const isStandard = (protocol === 'https:' && port === '443') || (protocol === 'http:' && port === '80')
  return isStandard ? `${protocol}//${hostname}` : `${protocol}//${hostname}:${port}`
}

export const getApiUrl = () => `${getBaseUrl()}/api`

export const getSocketUrl = () => getBaseUrl()

export const getMediaUrl = () => getBaseUrl()

function getRestauranteSlug() {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  return params.get('restaurante') || ''
}

export async function apiFetch(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  const restaurante = getRestauranteSlug()
  if (restaurante) {
    const sep = url.includes('?') ? '&' : '?'
    url = `${url}${sep}restaurante=${encodeURIComponent(restaurante)}`
  }
  const res = await fetch(url, { ...options, headers })
  return res
}