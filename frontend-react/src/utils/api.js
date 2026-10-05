const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (typeof window === 'undefined') return 'http://localhost:3000'
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

export const getToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

function getRestauranteSlug() {
  if (typeof window === 'undefined') return ''
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch { return {} }
  })()
  return user.restauranteSlug || user.restaurante_slug || ''
}

function isApiUrl(url) {
  const apiUrl = getApiUrl()
  return url.startsWith(apiUrl) || url.startsWith('/api/')
}

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch

  function hasHeader(headers, key) {
    if (headers instanceof Headers) return headers.has(key)
    if (Array.isArray(headers)) return headers.some(([k]) => k.toLowerCase() === key.toLowerCase())
    if (headers && typeof headers === 'object') return Object.keys(headers).some(k => k.toLowerCase() === key.toLowerCase())
    return false
  }

  function setHeader(headers, key, value) {
    if (headers instanceof Headers) { headers.set(key, value); return headers }
    if (Array.isArray(headers)) { headers.push([key, value]); return headers }
    return { ...headers, [key]: value }
  }

  window.fetch = function (input, init = {}) {
    let url = typeof input === 'string' ? input : input.url
    if (isApiUrl(url)) {
      init.headers = init.headers || {}
      const token = getToken()
      if (token && !hasHeader(init.headers, 'Authorization')) {
        init.headers = setHeader(init.headers, 'Authorization', `Bearer ${token}`)
      }
      if (init.body && typeof init.body === 'string' && !hasHeader(init.headers, 'Content-Type')) {
        init.headers = setHeader(init.headers, 'Content-Type', 'application/json')
      }
      const restaurante = getRestauranteSlug()
      if (restaurante) {
        const sep = url.includes('?') ? '&' : '?'
        url = `${url}${sep}restaurante=${encodeURIComponent(restaurante)}`
      }
      if (typeof input !== 'string') {
        input = new Request(url, input)
      } else {
        input = url
      }
    }
    return originalFetch.call(window, input, init)
  }
}

export async function apiFetch(url, options = {}) {
  const response = await fetch(url, options)
  return response
}
