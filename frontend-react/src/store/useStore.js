import { create } from 'zustand'
import { apiRequest } from '../utils/api'

// Migración de tema KaruApp: aplica una sola vez la identidad oscura a todos
// los usuarios existentes; después se respeta la preferencia guardada.
if (typeof window !== 'undefined') {
  const THEME_VERSION = 'karuapp-theme-1'
  if (localStorage.getItem('karuappThemeVersion') !== THEME_VERSION) {
    localStorage.setItem('darkMode', 'true')
    localStorage.setItem('karuappThemeVersion', THEME_VERSION)
  }
}

const getInitialDarkMode = () => {
  if (typeof window === 'undefined') return true
  const saved = localStorage.getItem('darkMode')
  if (saved === null) {
    localStorage.setItem('darkMode', 'true')
    return true
  }
  return saved !== 'false'
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

const getInitialHiddenModules = () => {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('hiddenModules')) || []
  } catch {
    return []
  }
}

export const useStore = create((set, get) => ({
  darkMode: getInitialDarkMode(),
  license: getInitialLicense(),
  token: getToken(),
  user: getStoredUser(),
  hiddenModules: getInitialHiddenModules(),
  loading: true,
  isMobile: typeof window !== 'undefined' && (window.innerWidth < 768 || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1280)),

  setIsMobile: (val) => set({ isMobile: val }),

  toggleModuloOculto: (modulo) => {
    const current = get().hiddenModules
    const next = current.includes(modulo)
      ? current.filter((m) => m !== modulo)
      : [...current, modulo]
    localStorage.setItem('hiddenModules', JSON.stringify(next))
    set({ hiddenModules: next })
  },

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
    const saved = localStorage.getItem('darkMode')
    const enabled = saved === null ? true : saved === 'true'
    if (saved === null) localStorage.setItem('darkMode', 'true')
    set({ darkMode: enabled })
    if (enabled) {
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
      const data = await apiRequest('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
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
    const data = await apiRequest('/auth/login-pin', {
      method: 'POST',
      body: JSON.stringify({ pin, restaurante_slug: restauranteSlug }),
    })
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
    const data = await apiRequest('/auth/login-saas', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
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
    return apiRequest('/auth/register-saas', {
      method: 'POST',
      body: JSON.stringify({ email, password, restaurante_nombre: restauranteNombre }),
    })
  },

  verificarCuenta: async (email, code) => {
    return apiRequest('/auth/verificar-cuenta', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  },

  reenviarCodigo: async (email) => {
    return apiRequest('/auth/reenviar-codigo', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  olvideContrasena: async (email) => {
    return apiRequest('/auth/olvide-contrasena', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  verificarCodigo: async (email, code) => {
    return apiRequest('/auth/verificar-codigo', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  },

  restablecerContrasena: async (email, code, newPassword) => {
    return apiRequest('/auth/restablecer-contrasena', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    })
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
