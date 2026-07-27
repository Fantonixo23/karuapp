import { create } from 'zustand'
import { io } from 'socket.io-client'
import { getSocketUrl } from '../utils/api'

let socket = null

export const useSocketStore = create((set, get) => ({
  connected: false,
  lastUpdate: null,
  mesaUpdates: [],
  pedidoUpdates: [],
  cocinaNotifications: [],
  
  initSocket: () => {
    if (socket?.connected) return
    
    if (socket) {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('message')
      socket.off('mesa_update')
      socket.off('pedido_update')
      socket.off('nuevo_pedido_cocina')
      socket.off('pedido_modificado')
      socket.off('connect_error')
      socket.disconnect()
      socket = null
    }
    
    const SOCKET_URL = getSocketUrl()
    const params = new URLSearchParams(window.location.search)
    const restaurante = params.get('restaurante') || ''
    console.log('🔌 Conectando socket a:', SOCKET_URL, 'restaurante:', restaurante)
    
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: { restaurante },
      query: restaurante ? { restaurante } : undefined,
    })
    
    socket.on('connect', () => {
      console.log('🔌 WebSocket conectado')
      set({ connected: true })
    })
    
    socket.on('disconnect', () => {
      console.log('🔌 WebSocket desconectado')
      set({ connected: false })
    })
    
    socket.on('message', (data) => {
      console.log('📡 Mensaje received:', data)
      get().handleMessage(data)
    })
    
    // También escuchar eventos directamente
    socket.on('mesa_update', (data) => {
      console.log('📡 Mesa update:', data)
      get().handleMessage({ type: 'mesa_update', mesa: data })
    })
    
    socket.on('pedido_update', (data) => {
      console.log('📡 Pedido update:', data)
      get().handleMessage({ type: 'pedido_update', pedido: data })
    })
    
    socket.on('nuevo_pedido_cocina', (data) => {
      console.log('📡 Nuevo pedido cocina:', data)
      get().handleMessage({ type: 'nuevo_pedido_cocina', pedido: data })
    })
    
    socket.on('pedido_modificado', (data) => {
      console.log('📡 Pedido modificado:', data)
      get().handleMessage({ type: 'pedido_modificado', pedido: data })
    })

    socket.on('connect_error', (error) => {
      console.error('❌ Error WebSocket:', error.message)
    })
  },
  
  reconnect: () => {
    setTimeout(() => {
      console.log('🔄 Reconectando...')
      get().initSocket()
    }, 3000)
  },
  
  // Manejar mensajes entrantes
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
      
      // Reproducir sonido si hay nuevo pedido
      if (typeof window !== 'undefined') {
        try {
          const audio = new Audio('/sounds/ding-dong.mp3')
          audio.volume = 0.5
          audio.play().catch(() => {
            // Fallback: reproducir sonido del sistema
            const fallback = new Audio('data:audio/wav;base64,UklGRnoPv19XQVZFZm10IBAAAAABAAEAQB8AAEAfQAABm5vdm9wZWNvZ25lbl9vYmplY3RfdjEiIGNvbnRlbnRfZm9ybWF0X3RleHQAAAIpH0AA')
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
  
  // Desconectar
  disconnectSocket: () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
    set({ connected: false })
  },
  
  //获取socket实例
  getSocket: () => socket,
  
  // Limpiar notificaciones
  clearNotifications: () => {
    set({ cocinaNotifications: [] })
  }
}))

// Hook personalizado para usar WebSocket en componentes
export const useRealTime = () => {
  const store = useSocketStore()
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
