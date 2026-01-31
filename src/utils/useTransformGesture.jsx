import { useRef } from 'react';
import { useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

export function useTransformGesture(initialValues = {}) {
  // Saves the current state (Updated during drag/pinch)
  const stateRef = useRef({
    x: initialValues.x ?? 0,
    y: initialValues.y ?? 0,
    scale: initialValues.scale ?? 1,
    rotateZ: initialValues.rotate ?? 0,
  });

  const [style, api] = useSpring(() => ({
    x: stateRef.current.x,
    y: stateRef.current.y,
    scale: stateRef.current.scale,
    rotateZ: stateRef.current.rotateZ,
    config: { tension: 300, friction: 30 },
  }));

  // Exists only once!
  const gestureConfig = useRef({
    drag: { from: () => [stateRef.current.x, stateRef.current.y] },
    pinch: { scaleBounds: { min: 0.5 }, rubberband: true },
  }).current;

  const bind = useGesture({
    onDrag: ({ offset: [dx, dy] }) => {
      stateRef.current.x = dx;
      stateRef.current.y = dy;
      api.start({ x: dx, y: dy });
    },
    onPinch: ({ offset: [s, a] }) => {
      stateRef.current.scale = s;
      stateRef.current.rotateZ = a;
      api.start({ scale: s, rotateZ: a });
    },
  }, gestureConfig);

  return { bind, style, stateRef };
}
