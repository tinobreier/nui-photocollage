import { useState, useEffect } from 'react'
import { usePlayroom } from '../hooks/usePlayroom'
import { MARKER_POSITIONS } from '../marker-config'

// use gestures
import { animated } from '@react-spring/web'
import { useTransformGesture } from '../utils/useTransformGesture'
import usePreventZoom from '../utils/usePreventZoom'

import PhotoOverlay from '../components/PhotoOverlay'
import './Tablet.css'

// Generate marker image paths
const markers = Object.entries(MARKER_POSITIONS).map(([id, position]) => ({
  id: parseInt(id),
  position,
  src: `assets/markers/AprilTag-tag36h11-ID${id}.png`,
}))

function Tablet() {
    usePreventZoom()

  const { isConnected, playerCount, error, onMessage } = usePlayroom()
  const [glowPosition, setGlowPosition] = useState(null)
  const [photos, setPhotos] = useState({}) 
  // { markerId: [{ id, photoBase64, timestamp, animating, x, y }] }
  const [firstConfirmedMarkerId, setFirstConfirmedMarkerId] = useState(null)

  // gesture
  const { bind, style } = useTransformGesture()

  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      console.log('[Tablet] Received message:', data)
      switch (data.type) {
        case 'marker-confirmed':
          handleMarkerConfirmed(data.markerId, data.position)
          console.log('[Tablet] Marker confirmed at position:', position)
          break
        case 'photo-upload':
          handlePhotoUpload(data.markerId, data.photoBase64, data.timestamp)
          break
      }
    })

    return unsubscribe
  }, [onMessage, firstConfirmedMarkerId])

  // Marker bestätigt
  const handleMarkerConfirmed = (markerId, position) => {
    setGlowPosition(position)
    if (!firstConfirmedMarkerId) setFirstConfirmedMarkerId(markerId)
    setTimeout(() => setGlowPosition(null), 3000)
  }

  // Foto hochgeladen
  const handlePhotoUpload = (markerId, photoBase64, timestamp) => {
    const markerIdToUse = firstConfirmedMarkerId || markerId
    const position = MARKER_POSITIONS[markerIdToUse]

    const newPhoto = {
      id: Date.now(),
      photoBase64,
      timestamp,
      animating: true,
      x: position.x,
      y: position.y
    }

    setPhotos(prev => ({
      ...prev,
      [markerIdToUse]: prev[markerIdToUse] ? [...prev[markerIdToUse], newPhoto] : [newPhoto]
    }))

    setGlowPosition(position)
    setTimeout(() => setGlowPosition(null), 3000)

    // Animation beenden
    setTimeout(() => {
      setPhotos(prev => ({
        ...prev,
        [markerIdToUse]: prev[markerIdToUse].map(p =>
          p.id === newPhoto.id ? { ...p, animating: false } : p
        )
      }))
    }, 1500)
  }

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

      {/** Test bis ich wieder mein Handy für die Fotos benutzt habe */}
      <animated.div
        {...bind()}
        style={{
          width: 150,
          height: 150,
          backgroundColor: 'red',
          touchAction: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          ...style,
        }}
      >
        Hilfe Verschieb Mich
      </animated.div>


      {/* Fotos */}
      {Object.entries(photos).map(([markerId, photoArray]) =>
        photoArray.map((photo) => (
          <PhotoOverlay
            key={photo.id}
            id={photo.id}
            photoBase64={photo.photoBase64}
            initialX={photo.x}
            initialY={photo.y}
            animating={photo.animating}
            onPositionChange={(pos) => {
              setPhotos(prev => ({
                ...prev,
                [markerId]: prev[markerId].map(p =>
                  p.id === photo.id ? { ...p, x: pos.x, y: pos.y } : p
                )
              }))
            }}
          />
        ))
      )}

      {/* Background header */}
      <div className="tablet-header">
        <h1>Tablet Marker Display</h1>
        <p>8 AprilTag markers positioned around the screen</p>
      </div>

      {/* Markers */}
      {markers.map((marker) => (
        <div key={marker.id} className={`marker marker-${marker.id}`}>
          <img src={marker.src} alt={`Marker ${marker.id}`} />
          <div className="marker-label">
            ID {marker.id}: ({marker.position.x}, {marker.position.y})
          </div>
        </div>
      ))}
    </div>
  )
}

export default Tablet
