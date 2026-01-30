import { useEffect } from 'react';
import { animated } from '@react-spring/web';
import { useTransformGesture } from '../utils/useTransformGesture';

export default function DraggablePhoto({ src, id, initialPos = { x: 0, y: 0 }, onUpdate }) {
  const { bind, style } = useTransformGesture();

  // Set initial position once
  useEffect(() => {
    style.x.set(initialPos.x);
    style.y.set(initialPos.y);
    style.scale.set(1);
    style.rotateZ.set(0);
  }, [initialPos.x, initialPos.y, style]);

  return (
    <animated.img
      {...bind()}
      src={src}
      alt="draggable"
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
        // IMPORTANT: combine translate, scale, rotate in one transform
        transform: style.x.to(
          (x) =>
            `translateX(${x}px) translateY(${style.y.get()}px) scale(${style.scale.get()}) rotateZ(${style.rotateZ.get()}deg)`
        ),
      }}
    />
  );
}
