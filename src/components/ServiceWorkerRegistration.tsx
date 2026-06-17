'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Register after page load so the SW doesn't compete with initial page resources
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(err => console.warn('[yearns/sw] registration failed:', err))
    })
  }, [])

  return null
}
