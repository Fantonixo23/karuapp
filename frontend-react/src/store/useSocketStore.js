import { create } from 'zustand'
import { createClient } from '@supabase/supabase-js'
import { getApiUrl, getToken } from '../utils/api'

let supabase = null
let channel = null

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function getRestauranteId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return user.restauranteId || user.restaurante_id || null
  } catch {
    return null
  }
}

async function pedirRealtimeToken() {
  const token = getToken()
  const res = await fetch(`${getApiUrl()}/auth/realtime-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`realtime-token: HTTP ${res.status}`)
  return res.json()
}

export const useSocketStore = create((set, get) => ({
  connected: false,
  lastUpdate: null,
  mesaUpdates: [],
  pedidoUpdates: [],
  cocinaNotifications: [],

  initSocket: async () => {
    if (channel) return

    let cfg
    try {
      cfg = await pedirRealtimeToken()
    } catch (e) {
      console.error('❌ No se pudo obtener el token de Realtime:', e.message)
      return
    }

    const url = cfg.url || SUPABASE_URL
    const anonKey = cfg.anonKey || SUPABASE_ANON_KEY
    const restauranteId = cfg.restaurante_id || getRestauranteId()

    if (!url || !anonKey || !restauranteId) {
      console.error('❌ Realtime sin configurar (SUPABASE_URL/ANON_KEY/restaurante_id).')
      return
    }

    if (!supabase) {
      supabase = createClient(url, anonKey, {
        realtime: { params: { eventsPerSecond: 10 } },
      })
    }

    supabase.realtime.setAuth(cfg.token)

    channel = supabase
      .channel(`restaurante:${restauranteId}`, { config: { private: true } })
      .on('broadcast', { event: '*' }, ({ event, payload }) => {
        get().handleBroadcast(event, payload)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔌 Realtime conectado')
          set({ connected: true })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.log('🔌 Realtime desconectado:', status)
          set({ connected: false })
        }
      })
  },

  reconnect: () => {
    setTimeout(() => {
      console.log('🔄 Reconectando...')
      get().disconnectSocket()
      get().initSocket()
    }, 3000)
  },

  handleBroadcast: (evento, payload) => {
    const tipo = evento?.type || evento

    if (tipo === 'mesa_update') {
      get().handleMessage({ type: 'mesa_update', mesa: payload })
    } else if (tipo === 'pedido_update') {
      get().handleMessage({ type: 'pedido_update', pedido: payload })
    } else if (tipo === 'nuevo_pedido_cocina') {
      get().handleMessage({ type: 'nuevo_pedido_cocina', pedido: payload })
    } else if (tipo === 'pedido_modificado') {
      get().handleMessage({ type: 'pedido_modificado', pedido: payload })
    } else if (tipo === 'cobro') {
      get().handleMessage({ type: 'cobro', cobro: payload })
    }
  },

  handleMessage: (data) => {
    const tipo = data?.type

    if (tipo === 'connected') {
      console.log('✅', data.message)
      return
    }

    if (tipo === 'mesa_update') {
      const mesa = data.mesa
      set(state => ({
        lastUpdate: { type: 'mesa', data: mesa, time: new Date() },
        mesaUpdates: [...state.mesaUpdates.slice(-9), mesa]
      }))
    }

    if (tipo === 'pedido_update') {
      const pedido = data.pedido
      set(state => ({
        lastUpdate: { type: 'pedido', data: pedido, time: new Date() },
        pedidoUpdates: [...state.pedidoUpdates.slice(-9), pedido]
      }))
    }

    if (tipo === 'nuevo_pedido_cocina') {
      const pedido = data.pedido
      set(state => ({
        lastUpdate: { type: 'cocina', data: pedido, time: new Date() },
        cocinaNotifications: [...state.cocinaNotifications.slice(-19), pedido]
      }))

      if (typeof window !== 'undefined') {
        try {
          const audio = new Audio('/sounds/ding-dong.mp3')
          audio.volume = 0.5
          audio.play().catch(() => {
            const fallback = new Audio('data:audio/wav;base64,UklGRnoPv19XQVZFZm10IBAAAAABAAEAQB8AAEAfQAABm5vdm9wZWNvZ25lX29iamVjdF92MSIgY29udGVudF9mb3JtYXRfdGV4dAAAAgpH0AA')
            fallback.volume = 0.5
            fallback.play().catch(() => {})
          })
        } catch (e) {}
      }
    }

    if (tipo === 'pedido_modificado') {
      const pedido = data.pedido
      set(state => ({
        lastUpdate: { type: 'pedido_modificado', data: pedido, time: new Date() },
        pedidoUpdates: [...state.pedidoUpdates.slice(-9), pedido]
      }))
    }

    if (tipo === 'cobro') {
      set(state => ({
        lastUpdate: { type: 'cobro', data: data.cobro, time: new Date() }
      }))
    }
  },

  disconnectSocket: () => {
    if (supabase && channel) {
      supabase.removeChannel(channel)
    }
    channel = null
    set({ connected: false })
  },

  getSocket: () => channel,

  clearNotifications: () => {
    set({ cocinaNotifications: [] })
  }
}))

export const useRealTime = () => {
  const initSocket = useSocketStore(state => state.initSocket)
  const disconnectSocket = useSocketStore(state => state.disconnectSocket)
  const lastUpdate = useSocketStore(state => state.lastUpdate)
  const cocinaNotifications = useSocketStore(state => state.cocinaNotifications)
  const mesaUpdates = useSocketStore(state => state.mesaUpdates)
  const connected = useSocketStore(state => state.connected)
  const clearNotifications = useSocketStore(state => state.clearNotifications)

  return {
    initSocket,
    disconnectSocket,
    lastUpdate,
    cocinaNotifications,
    mesaUpdates,
    connected,
    clearNotifications
  }
}