import { useSpring, animated } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

export default function DraggablePhoto({ src, id, initialPos = { x: 0, y: 0 }, style = {}, onUpdate }) {
  const [spring, api] = useSpring(() => ({
    x: initialPos.x,
    y: initialPos.y,
    scale: 1,
    rotate: 0,
    config: { tension: 300, friction: 30 },
  }));

  const bind = useGesture({
    onDrag: ({ offset: [x, y] }) => {
      api.start({ x, y });
    },
    onPinch: ({ offset: [d, a] }) => {
      api.start({ scale: 1 + d / 200, rotate: a });
    },
    onHover: ({ hovering }) => {
      api.start({ scale: hovering ? 1.05 : 1 });
    }
  }, {
    drag: { from: () => [spring.x.get(), spring.y.get()] },
    pinch: { scaleBounds: { min: 0.5, max: 2 }, rubberband: true }
  });

  return (
    <animated.img
      {...bind()}
      src={src}
      style={{
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
        width: '140px',
        height: 'auto',
        borderRadius: '6px',
        border: '6px solid white',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        position: 'fixed',
        ...spring,
        ...style
      }}
      alt="draggable"
    />
  );
}
