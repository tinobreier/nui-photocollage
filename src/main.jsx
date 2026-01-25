import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App'
import Phone from './pages/Phone'
import Tablet from './pages/Tablet'
import './index.css'

// Diese kleine Hilfskomponente entscheidet basierend auf dem URL-Inhalt, was angezeigt wird
const PlayroomRouterGuard = () => {
  const hash = window.location.hash;
  
  if (hash.includes('tablet')) {
    return <Tablet />;
  } else if (hash.includes('phone')) {
    return <Phone />;
  }
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        {/* Die Standard-Routen für den ersten Klick */}
        <Route path="/phone" element={<Phone />} />
        <Route path="/tablet" element={<Tablet />} />
        
        {/* DER FIX: Wenn Playroom die URL verhunzt, greift dieser Catch-All */}
        <Route path="*" element={<PlayroomRouterGuard />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>,
)