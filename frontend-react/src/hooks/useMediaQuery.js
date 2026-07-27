import { useEffect } from 'react'
import { useStore } from '../store/useStore'

export function useMediaQuery() {
  const setIsMobile = useStore((state) => state.setIsMobile)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), ((pointer: coarse) and (max-width: 1279px))')
    const handler = (e) => setIsMobile(e.matches)
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setIsMobile])
}
