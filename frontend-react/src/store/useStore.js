import { create } from 'zustand'

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

const getInitialUser = () => {
  if (typeof window !== 'undefined' && window.__KARU_USER__ && window.__KARU_USER__.email) {
    return window.__KARU_USER__
  }
  try {
    const stored = localStorage.getItem('karu_user')
    if (stored) return JSON.parse(stored)
  } catch {}
  return { email: null, name: null, rol: null }
}

export const useStore = create((set, get) => ({
  darkMode: getInitialDarkMode(),
  license: getInitialLicense(),
  user: getInitialUser(),
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

  logout: () => {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(() => { window.location.href = '/login' })
      .catch(() => { window.location.href = '/login' })
  }
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