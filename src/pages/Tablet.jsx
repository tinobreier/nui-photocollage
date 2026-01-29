import { useState, useEffect } from 'react'
import { usePlayroom } from '../hooks/usePlayroom'
import { MARKER_POSITIONS } from '../marker-config'
import './Tablet.css'

// Generate marker image paths
const markers = Object.entries(MARKER_POSITIONS).map(([id, position]) => ({
  id: parseInt(id),
  position,
  src: `assets/markers/AprilTag-tag36h11-ID${id}.png`,
}))

function Tablet() {
  const { isConnected, playerCount, error, onMessage } = usePlayroom()
  const [glowPosition, setGlowPosition] = useState(null)
  const [collageImages, setCollageImages] = useState([])

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      console.log('[Tablet] Received message:', data)

      if (data.type === 'marker-confirmed') {
        const position = data.position
        console.log('[Tablet] Marker confirmed at position:', position)

        // Set glow
        setGlowPosition(position)

        // Remove glow after 3 seconds
        setTimeout(() => {
          setGlowPosition(null)
        }, 3000)
      }
     if (data.type === 'image-sent') {
        console.log('[Tablet] Image received from position:', data.position)
        
        // Add image to collage
        const newImage = {
          id: crypto.randomUUID(),
          src: data.imageData,
          position: data.position,
          playerId: data.playerId,
          timestamp: data.timestamp,
        }
        
        setCollageImages(prev => [...prev, newImage])
      }
    })

    return unsubscribe
  }, [onMessage])


  // Calculate collaborator count (exclude tablet itself)
  const collaboratorCount = Math.max(0, playerCount - 1)

  return (
    <div className={`tablet-container ${glowPosition ? `glow-${glowPosition}` : ''}`}>
      {/* Status Bar */}
      <div className="status-bar">
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {error ? `Fehler: ${error}` : isConnected ? 'Verbunden' : 'Verbinde...'}
        </div>
        <div className="player-info">
          Kollaborateure: <span>{collaboratorCount}</span>
        </div>
      </div>

      {/* Background header */}
      <div className="tablet-header">
        <h1>Tablet Marker Display</h1>
        <p>8 AprilTag markers positioned around the screen</p>
      </div>

       {/* Image Collage Center Area */}
      <div className="collage-container">
        {collageImages.map((image, index) => {
          // Simple hash-based random positioning
          const hash = image.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const offsetX = (hash % 80) - 40; // -40 to +40px
          const offsetY = ((hash * 7) % 8) - 80; // -40 to +40px 
          
          return (
            <div 
              key={image.id} 
              className="collage-image"
              data-position={image.position}
              style={{
                animationDelay: `${index * 0.1}s`,
                transform: `translate(${offsetX}px, ${offsetY}px)`,
              }}
            >
              <img src={image.src} alt={`Photo from ${image.position}`} />
            </div>
          );
        })}
      </div>

      {/* Markers */}
      {markers.map((marker) => (
        <div key={marker.id} className={`marker marker-${marker.id}`}>
          <img src={marker.src} alt={`Marker ${marker.id}`} />
          <div className="marker-label">
            ID {marker.id}: {marker.position.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-')}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Tablet
