import { memo, useRef } from 'react';
import { animated } from '@react-spring/web';
import { useTransformGesture } from '../utils/useTransformGesture';

const DraggablePhoto = memo(function DraggablePhoto({ src, id, initialPos, rotation, onUpdate, playerColor }) {
  // Only save initialPos during the FIRST mount, then ignore it
  const initialPosRef = useRef(initialPos);
  const { bind, style, stateRef } = useTransformGesture(initialPosRef.current);

  return (
    <animated.img
      {...bind()}
      src={src}
      alt="draggable"
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
        width: '140px',
        height: 'auto',
        borderRadius: '6px',
        border: '6px solid white',
        outline: playerColor ? `2px solid ${playerColor}` : 'none',
        outlineOffset: '0px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        position: 'absolute',
        x: style.x,
        y: style.y,
        scale: style.scale,
        rotateZ: style.rotateZ.to(z => z + rotation),
      }}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if src or rotation changes (No changes to initialPos or the onUpdate)
  return prevProps.src === nextProps.src &&
         prevProps.rotation === nextProps.rotation &&
         prevProps.id === nextProps.id &&
         prevProps.playerColor === nextProps.playerColor;
});

export default DraggablePhoto;
