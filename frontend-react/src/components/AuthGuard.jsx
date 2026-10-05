import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'

export default function AuthGuard({ children }) {
  const user = useStore((s) => s.user)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true, state: { from: location } })
    }
  }, [user])

  if (!user) return null

  return children
}
