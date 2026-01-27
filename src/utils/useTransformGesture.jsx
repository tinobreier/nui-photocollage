import { useGesture } from '@use-gesture/react'
import { useSpring } from '@react-spring/web'

export function useTransformGesture() {
  // useSpring mit smooth config
  const [style, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    rotateZ: 0,
    config: { tension: 300, friction: 30 }, // smooth animation
  }))

  const bind = useGesture(
    {
      // Drag / Verschieben
      onDrag: ({ offset: [dx, dy] }) => {
        api.start({ x: dx, y: dy, immediate: false })
      },

      // Pinch / Scale + Rotation
      onPinch: ({ movement: [ms], offset: [s, a], memo, first }) => {
        // Memo speichern für smooth scaling
        if (first) {
          memo = style.scale.get() // aktueller Scale
        }

        const newScale = memo * ms // smooth scaling
        api.start({
          scale: newScale,
          rotateZ: a,
          immediate: false,
        })

        return memo
      },
    },
    {
      drag: {
        from: () => [style.x.get(), style.y.get()],
      },
      pinch: {
        scaleBounds: { min: 0.5, max: 3 },
        rubberband: true,
      },
    }
  )

  return { bind, style }
}
