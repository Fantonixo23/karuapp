import React, { useState, useEffect, createContext, useContext } from 'react'

const FullscreenContext = createContext()

function getFullscreenEl() {
  return document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
}

function requestFs(el) {
  const fn = el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen
  if (!fn) return Promise.reject()
  return fn.call(el)
}

function exitFs() {
  const fn = document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen
  if (!fn) return Promise.reject()
  return fn.call(document)
}

export function FullscreenProvider({ children }) {
  const [isFullscreen, setIsFullscreen] = useState(() => {
    const saved = localStorage.getItem('fullscreen') === 'true'
    if (saved && !getFullscreenEl()) {
      localStorage.setItem('fullscreen', 'false')
      return false
    }
    return saved
  })

  useEffect(() => {
    localStorage.setItem('fullscreen', String(isFullscreen))

    if (isFullscreen) {
      if (!getFullscreenEl()) {
        requestFs(document.documentElement).catch(() => {})
      }
    } else {
      if (getFullscreenEl()) {
        exitFs().catch(() => {})
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!getFullscreenEl())
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    document.addEventListener('mozfullscreenchange', handleChange)
    document.addEventListener('MSFullscreenChange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
      document.removeEventListener('mozfullscreenchange', handleChange)
      document.removeEventListener('MSFullscreenChange', handleChange)
    }
  }, [])

  const toggle = () => setIsFullscreen(!isFullscreen)

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggle }}>
      {children}
    </FullscreenContext.Provider>
  )
}

export function useFullscreen() {
  return useContext(FullscreenContext)
}
