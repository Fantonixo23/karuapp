import { create } from 'zustand'
import { getApiUrl } from '../utils/api'

const API = getApiUrl()

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem('darkMode')
  if (saved === null) {
    localStorage.setItem('darkMode', 'false')
    return false
  }
  return saved === 'true'
}

const getInitialLicense = () => {
  if (typeof window === 'undefined') return { estado: 'activa', dias_restantes: 999, mensaje: '', nombre: '' }
  const saved = localStorage.getItem('license')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      return { estado: 'activa', dias_restantes: 999, mensaje: '', nombre: '' }
    }
  }
  return { estado: 'activa', dias_restantes: 999, mensaje: '', nombre: '' }
}

const getToken = () => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

const getStoredUser = () => {
  try {
    const stored = localStorage.getItem('user')
    if (stored) return JSON.parse(stored)
  } catch {}
  return null
}

export const useStore = create((set, get) => ({
  darkMode: getInitialDarkMode(),
  license: getInitialLicense(),
  token: getToken(),
  user: getStoredUser(),
  loading: true,
  isMobile: typeof window !== 'undefined' && (window.innerWidth < 768 || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1280)),

  setIsMobile: (val) => set({ isMobile: val }),

  toggleDarkMode: () => {
    const newMode = !get().darkMode
    localStorage.setItem('darkMode', newMode)
    set({ darkMode: newMode })
    if (newMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
    window.dispatchEvent(new Event('darkModeChange'))
  },

  initDarkMode: () => {
    const saved = localStorage.getItem('darkMode') === 'true'
    set({ darkMode: saved })
    if (saved) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  },

  syncDarkMode: () => {
    const saved = localStorage.getItem('darkMode') === 'true'
    const current = get().darkMode
    if (saved !== current) {
      set({ darkMode: saved })
      if (saved) {
        document.body.classList.add('dark')
      } else {
        document.body.classList.remove('dark')
      }
    }
  },

  setLicense: (licenseData) => {
    localStorage.setItem('license', JSON.stringify(licenseData))
    set({ license: licenseData })
  },

  setUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
    } else {
      localStorage.removeItem('user')
    }
    set({ user })
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },

  initAuth: async () => {
    const token = getToken()
    if (!token) {
      set({ loading: false, user: null })
      return
    }
    try {
      const res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Token inválido')
      const data = await res.json()
      const u = data.user || data
      const user = {
        id: u.sub || u.id,
        email: u.email,
        name: u.name || u.nombre,
        rol: u.rol,
        restauranteId: u.restauranteId || u.restaurante_id || u.restaurante?.id,
        restauranteSlug: u.restauranteSlug || u.restaurante_slug || u.restaurante?.slug,
      }
      localStorage.setItem('user', JSON.stringify(user))
      set({ user, loading: false })
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      set({ user: null, token: null, loading: false })
    }
  },

  loginPin: async (pin, restauranteSlug) => {
    const res = await fetch(`${API}/auth/login-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, restaurante_slug: restauranteSlug }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al iniciar sesión')
    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.nombre || data.user.name,
      rol: data.user.rol,
      restauranteId: data.user.restaurante_id || data.user.restauranteId,
      restauranteSlug: data.user.restaurante_slug || data.user.restauranteSlug,
    }
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token: data.access_token, user })
    return user
  },

  loginSaaS: async (email, password) => {
    const res = await fetch(`${API}/auth/login-saas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al iniciar sesión')
    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.nombre || data.user.name,
      rol: data.user.rol,
      restauranteId: data.user.restaurante_id || data.user.restauranteId,
      restauranteSlug: data.user.restaurante_slug || data.user.restauranteSlug,
    }
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token: data.access_token, user })
    return user
  },

  registerSaaS: async (email, password, restauranteNombre) => {
    const res = await fetch(`${API}/auth/register-saas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, restaurante_nombre: restauranteNombre }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al registrar')
    return data
  },

  verificarCuenta: async (email, code) => {
    const res = await fetch(`${API}/auth/verificar-cuenta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al verificar')
    const user = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.nombre || data.user.name,
      rol: data.user.rol,
      restauranteId: data.user.restaurante_id || data.user.restauranteId,
      restauranteSlug: data.user.restaurante_slug || data.user.restauranteSlug,
    }
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token: data.access_token, user })
    return user
  },

  reenviarCodigo: async (email) => {
    const res = await fetch(`${API}/auth/reenviar-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al reenviar')
    return data
  },

  olvideContrasena: async (email) => {
    const res = await fetch(`${API}/auth/olvide-contrasena`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.json()
  },

  verificarCodigo: async (email, code) => {
    const res = await fetch(`${API}/auth/verificar-codigo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Código inválido')
    return data
  },

  restablecerContrasena: async (email, code, newPassword) => {
    const res = await fetch(`${API}/auth/restablecer-contrasena`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Error al restablecer')
    return data
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ user: null, token: null })
    window.location.href = '/login'
  },
}))

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'darkMode') {
      useStore.getState().syncDarkMode()
    }
  })

  window.addEventListener('darkModeChange', () => {
    useStore.getState().syncDarkMode()
  })

  window.addEventListener('focus', () => {
    useStore.getState().syncDarkMode()
  })
}
