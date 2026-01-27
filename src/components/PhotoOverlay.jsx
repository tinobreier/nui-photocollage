import { useState, useEffect } from 'react'

/**
 * PhotoOverlay-Komponente
 * Props:
 * - id: eindeutige ID des Fotos
 * - photoBase64: Bild als Base64-String
 * - initialX, initialY: Startposition
 * - onPositionChange: Callback, wird aufgerufen, wenn das Foto verschoben wird
 */
export default function PhotoOverlay({ id, photoBase64, initialX, initialY, onPositionChange, animating }) {
  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [dragging, setDragging] = useState(null)

  // Drag starten
  const handleDragStart = (e) => {
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY
    const rect = e.target.getBoundingClientRect()

    setDragging({
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top
    })

    e.preventDefault()
  }

  // Drag bewegen
  const handleDragMove = (e) => {
    if (!dragging) return

    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY

    const newX = clientX - dragging.offsetX
    const newY = clientY - dragging.offsetY

    setPosition({ x: newX, y: newY })
    if (onPositionChange) onPositionChange({ x: newX, y: newY })
  }

  // Drag beenden
  const handleDragEnd = () => setDragging(null)

  return (
    <div
      className={`photo-item ${animating ? 'photo-animating' : ''}`}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 1000 : 1
      }}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
    >
      <img
        src={`data:image/jpeg;base64,${photoBase64}`}
        alt={`Photo ${id}`}
        className="uploaded-photo"
      />
    </div>
  )
}
