import { memo, useRef } from "react";
import { animated } from "@react-spring/web";
import { useTransformGesture } from "../utils/useTransformGesture";

const FLY_IN_ANIMATION_DURATION = 900;

const DraggablePhoto = memo(
	function DraggablePhoto({ src, id, initialPos, baseRotation = 0, rotation, onUpdate, onInteractionStart, playerColor, offsetX = 0, offsetY = 0 }) {
		const initialPosRef = useRef({
			...initialPos,
			x: offsetX,
			y: offsetY,
			rotateZ: rotation,
		});

		const { bind, style, stateRef } = useTransformGesture(initialPosRef.current, {
			skipSyncUntil: FLY_IN_ANIMATION_DURATION,
			onDragStart: () => onInteractionStart?.(id),
		});

		return (
			<animated.div
				{...bind()}
				onPointerUp={() => {
					onUpdate?.(id, {
						x: stateRef.current.x,
						y: stateRef.current.y,
						scale: stateRef.current.scale,
						rotate: stateRef.current.rotateZ,
					});
				}}
				style={{
					touchAction: "none",
					cursor: "grab",
					userSelect: "none",
					position: "absolute",
					x: style.x,
					y: style.y,
					scale: style.scale,
					rotateZ: style.rotateZ,
				}}
			>
				<img
					src={src}
					alt='draggable'
					style={{
						width: "140px",
						height: "auto",
						borderRadius: "6px",
						border: "6px solid white",
						outline: playerColor ? `2px solid ${playerColor}` : "none",
						outlineOffset: "0px",
						boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
						display: "block",
						transform: `rotate(${baseRotation}deg)`,
					}}
				/>
			</animated.div>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.src === nextProps.src &&
			prevProps.rotation === nextProps.rotation &&
			prevProps.baseRotation === nextProps.baseRotation &&
			prevProps.id === nextProps.id &&
			prevProps.playerColor === nextProps.playerColor
		);
	},
);

export default DraggablePhoto;
