import { useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

export function useTransformGesture(onUpdate) {
  const [style, api] = useSpring(() => ({
    x: 0,
    y: 0,
    scale: 1,
    rotateZ: 0,
    config: { tension: 300, friction: 30 },
  }));

  const bind = useGesture(
    {
      onDrag: ({ offset: [dx, dy] }) => {
        api.start({ x: dx, y: dy });
        onUpdate?.({ x: dx, y: dy, scale: style.scale.get(), rotate: style.rotateZ.get() });
      },
      onPinch: ({ offset: [s, a] }) => {
        api.start({ scale: s, rotateZ: a });
        onUpdate?.({ x: style.x.get(), y: style.y.get(), scale: s, rotate: a });
      },
    },
    {
      drag: { from: () => [style.x.get(), style.y.get()] },
      pinch: { scaleBounds: { min: 0.5, max: 1 }, rubberband: true },
    }
  );

  return { bind, style };
}
