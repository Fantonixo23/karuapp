import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function RequireRole({ rol, children }) {
  const navigate = useNavigate()

  useEffect(() => {
    const user = (() => {
      try { return JSON.parse(localStorage.getItem('user') || '{}') }
      catch { return {} }
    })()
    const token = localStorage.getItem('token')
    if (!token || user.rol !== rol) {
      navigate('/admin/login', { replace: true })
    }
  }, [])

  return children
}
