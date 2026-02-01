import { memo, useRef } from 'react';
import { animated } from '@react-spring/web';
import { useTransformGesture } from '../utils/useTransformGesture';

// CSS fly-in animation duration + buffer
const FLY_IN_ANIMATION_DURATION = 900;

const DraggablePhoto = memo(function DraggablePhoto({ src, id, initialPos, baseRotation = 0, rotation, onUpdate, onInteractionStart, playerColor,offsetX = 0, offsetY = 0 }) {
  // Only save initialPos during the FIRST mount, then ignore it
  const initialPosRef = useRef({
    ...initialPos,
    x: offsetX, // Startet bei z.B. 15 statt 0
    y: offsetY, // Startet bei z.B. -10 statt 0
    rotateZ: rotation // Startet bei der Zufalls-Rotation
  });
  // Skip spring sync during CSS fly-in animation to prevent interference
  const { bind, style, stateRef } = useTransformGesture(initialPosRef.current, {
    skipSyncUntil: FLY_IN_ANIMATION_DURATION,
    onDragStart: () => onInteractionStart?.(id)
  });

  return (
    <animated.div
      {...bind()}
      onPointerUp={() => {
        onUpdate?.(id, {
          x: stateRef.current.x,
          y: stateRef.current.y,
          scale: stateRef.current.scale,
          rotate: stateRef.current.rotateZ
        });
      }}
      style={{
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
        position: 'absolute',
        // Drag/Pinch transformations - NOT affected by baseRotation
        x: style.x,
        y: style.y,
        scale: style.scale,
        rotateZ: style.rotateZ,
      }}
    >
      <img
        src={src}
        alt="draggable"
        style={{
          width: '140px',
          height: 'auto',
          borderRadius: '6px',
          border: '6px solid white',
          outline: playerColor ? `2px solid ${playerColor}` : 'none',
          outlineOffset: '0px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
          display: 'block',
          // Visual-only rotation based on player seating position
          transform: `rotate(${baseRotation}deg)`,
        }}
      />
    </animated.div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props change
  return prevProps.src === nextProps.src &&
         prevProps.rotation === nextProps.rotation &&
         prevProps.baseRotation === nextProps.baseRotation &&
         prevProps.id === nextProps.id &&
         prevProps.playerColor === nextProps.playerColor;
});

export default DraggablePhoto;
