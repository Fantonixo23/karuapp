import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  base: '/',
  build: {
    outDir: '../backend/frontend',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://backend:8000',
        ws: true,
        changeOrigin: true
      },
      '/media': {
        target: 'http://nginx:80',
        changeOrigin: true
      }
    }
  }
})