import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

const apiUrl = import.meta.env.VITE_API_URL
if (apiUrl && (apiUrl.includes('serveo.net') || apiUrl.includes('serveousercontent.com'))) {
  const orig = window.fetch
  window.fetch = function(url, opts = {}) {
    opts = opts || {}
    opts.headers = new Headers(opts.headers || {})
    opts.headers.set('serveo-skip-browser-warning', 'true')
    return orig.call(this, url, opts)
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
}

if (localStorage.getItem('darkMode') === null) {
  localStorage.setItem('darkMode', 'false')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)