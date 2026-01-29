import { animated } from '@react-spring/web'
import { useTransformGesture } from '../utils/useTransformGesture'

export default function DraggablePhoto({
  id,
  photoBase64,
  initialX,
  initialY,
  initialRotate = 0,
  animating,
  onPositionChange,
}) {
  const { bind, style } = useTransformGesture({
    initialX,
    initialY,
    initialRotate,
    onPositionChange,
  })

  return (
    <animated.div
      {...bind()}
      className={`photo-item ${animating ? 'photo-animating' : ''}`}
      style={{
        position: 'absolute',
        touchAction: 'none',
        zIndex: 10,
        ...style,
      }}
    >
      <img
        src={`data:image/jpeg;base64,${photoBase64}`}
        alt={`Photo ${id}`}
        className="uploaded-photo"
        draggable={false}
      />
    </animated.div>
  )
}
