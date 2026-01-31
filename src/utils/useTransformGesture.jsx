import { useRef, useMemo, useLayoutEffect } from 'react';
import { useSpring } from '@react-spring/web';
import { useGesture } from '@use-gesture/react';

export function useTransformGesture(initialValues = {}, { skipSyncUntil = 0 } = {}) {
  // Saves the current state (Updated during drag/pinch)
  const stateRef = useRef({
    x: initialValues.x ?? 0,
    y: initialValues.y ?? 0,
    scale: initialValues.scale ?? 1,
    rotateZ: initialValues.rotate ?? 0,
  });

  // Track mount time to skip sync during initial CSS animation
  const mountTimeRef = useRef(Date.now());

  const [style, api] = useSpring(() => ({
    x: stateRef.current.x,
    y: stateRef.current.y,
    scale: stateRef.current.scale,
    rotateZ: stateRef.current.rotateZ,
    config: { tension: 300, friction: 30 },
  }));

  // FIX: useLayoutEffect runs after DOM update but BEFORE browser paint
  // This ensures we correct any spring reset before the user sees it
  // Skip during initial CSS fly-in animation (skipSyncUntil ms after mount)
  useLayoutEffect(() => {
    const timeSinceMount = Date.now() - mountTimeRef.current;
    if (timeSinceMount < skipSyncUntil) {
      return; // Don't interfere with CSS animation
    }

    // Stop any ongoing animations first
    api.stop();

    // Then immediately set to the correct values
    api.set({
      x: stateRef.current.x,
      y: stateRef.current.y,
      scale: stateRef.current.scale,
      rotateZ: stateRef.current.rotateZ,
    });
  });

  // Memoize gesture config to prevent unnecessary re-creation
  const gestureConfig = useMemo(() => ({
    drag: {
      from: () => [stateRef.current.x, stateRef.current.y],
    },
    pinch: {
      from: () => [stateRef.current.scale, stateRef.current.rotateZ],
      scaleBounds: { min: 0.5 },
      rubberband: true
    },
  }), []);

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
