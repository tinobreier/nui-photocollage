import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Phone from './pages/Phone'
import Tablet from './pages/Tablet'
import './index.css'

// Redirect path-based URLs to hash-based URLs for convenience
// e.g., /nui-photocollage/tablet -> /nui-photocollage/#/tablet
const pathname = window.location.pathname
const basePath = import.meta.env.BASE_URL || '/'

if (pathname.startsWith(basePath) && pathname !== basePath) {
  const route = pathname.slice(basePath.length).replace(/\/$/, '')
  if (route && !route.includes('.')) {
    window.location.replace(basePath + '#/' + route)
  }
}

// Simple hash-based router that handles Playroom's URL modifications
// Uses stable component references to prevent unmount/remount cycles
const AppRouter = () => {
  const [currentRoute, setCurrentRoute] = useState(() => {
    const hash = window.location.hash
    if (hash.includes('tablet')) return 'tablet'
    if (hash.includes('phone')) return 'phone'
    return 'home'
  })

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      let newRoute = 'home'

      if (hash.includes('tablet')) {
        newRoute = 'tablet'
      } else if (hash.includes('phone')) {
        newRoute = 'phone'
      } else if (hash === '' || hash === '#' || hash === '#/') {
        newRoute = 'home'
      }

      // Only update if route actually changed - prevents unnecessary re-renders
      // when Playroom adds its params to the URL
      setCurrentRoute(prev => {
        if (prev !== newRoute) {
          console.log('[Router] Route changed:', prev, '->', newRoute)
          return newRoute
        }
        return prev
      })
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  switch (currentRoute) {
    case 'tablet':
      return <Tablet />
    case 'phone':
      return <Phone />
    default:
      return <App />
  }
}

// Note: StrictMode removed because it causes Playroom's insertCoin to be called twice,
// which breaks the connection. This is a known issue with side-effect-heavy libraries.
ReactDOM.createRoot(document.getElementById('root')).render(<AppRouter />)