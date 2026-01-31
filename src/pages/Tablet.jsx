import { useState, useEffect, useRef, useCallback } from "react";
import { usePlayroom } from "../hooks/usePlayroom";
import { Box, IconButton, Paper, Typography, darken } from "@mui/material";
import { MARKER_POSITIONS } from "../marker-config";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

// use gestures
import { animated } from '@react-spring/web'
import usePreventZoom from '../utils/usePreventZoom'
import DraggablePhoto from "../components/DraggablePhoto";

import "./Tablet.css";

const markers = Object.entries(MARKER_POSITIONS).map(([id, position], index) => {
	const MARKER_STYLES = [
		{ top: 60, left: 20 },
		{ top: 60, left: "50%", transform: "translateX(-50%)" },
		{ top: 60, right: 20 },
		{ top: "50%", right: 20, transform: "translateY(-50%)" },
		{ bottom: 20, right: 20 },
		{ bottom: 20, left: "50%", transform: "translateX(-50%)" },
		{ bottom: 20, left: 20 },
		{ top: "50%", left: 20, transform: "translateY(-50%)" },
	];

	return {
		id: parseInt(id),
		src: `assets/markers/AprilTag-tag36h11-ID${id}.png`,
		sx: MARKER_STYLES[index] || {},
	};
});

// Dots are 40px, positioned so 30% is hidden outside viewport (-12px offset)
// Exported for use in Phone UI to color elements by player position
export const DOT_INDICATOR_CONFIG = {
	"top-left": { color: "#4CAF50", top: -12, left: -12, transform: "none" },
	"top-center": { color: "#E91E63", top: -12, left: "50%", transform: "translateX(-50%)" },
	"top-right": { color: "#FF9800", top: -12, right: -12, transform: "none" },
	"left-center": { color: "#009688", top: "50%", left: -12, transform: "translateY(-50%)" },
	"right-center": { color: "#9C27B0", top: "50%", right: -12, transform: "translateY(-50%)" },
	"bottom-left": { color: "#00BCD4", bottom: -12, left: -12, transform: "none" },
	"bottom-center": { color: "#42A5F5", bottom: -12, left: "50%", transform: "translateX(-50%)" },
	"bottom-right": { color: "#5C6BC0", bottom: -12, right: -12, transform: "none" },
	"center-left": { color: "#009688", top: "50%", left: -12, transform: "translateY(-50%)" },
	"center-right": { color: "#9C27B0", top: "50%", right: -12, transform: "translateY(-50%)" },
};

// Position-based image placement (images appear at viewport edges/corners)
// Positioned with custom safety margins so images stay fully visible
const EDGE_X = "80px";
const EDGE_Y = "200px";
const CENTER_X = "50vw";
const CENTER_Y = "40vh";

// Base rotation based on player seating position (diagonal for corners)
// Photos spawn rotated so they appear right-side-up for the player sitting at that position
const POSITION_BASE_ROTATION = {
  "top-left": 135,
  "top-center": 180,
  "top-right": -135,
  "left-center": 90,
  "right-center": -90,
  "bottom-left": 45,
  "bottom-center": 0,
  "bottom-right": -45,
};   

const IMAGE_POSITION_CONFIG = {
  // top row
  "top-left": {
    left: EDGE_X,
    top: "10px",
  },
  "top-center": {
    left: CENTER_X,
    top: "10px",
  },
  "top-right": {
    left: `calc(100vw - ${EDGE_X})`,
    top: "10px",
  },

  // middle row
  "left-center": {
    left: EDGE_X,
    top: CENTER_Y,
  },
  "right-center": {
    left: `calc(100vw - ${EDGE_X})`,
    top: CENTER_Y,
  },

  // bottom row
  "bottom-left": {
    left: EDGE_X,
    top: `calc(100vh - ${EDGE_Y})`,
  },
  "bottom-center": {
    left: CENTER_X,
    top: `calc(100vh - ${EDGE_Y})`,
  },
  "bottom-right": {
    left: `calc(100vw - ${EDGE_X})`,
    top: `calc(100vh - ${EDGE_Y})`,
  },
};

function Tablet() {
	usePreventZoom()
	const { onMessage } = usePlayroom();
	const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
	const [showMarkers, setShowMarkers] = useState(false);
	const [dots, setDots] = useState({});
	const [collageImages, setCollageImages] = useState([]);
	const positionsRef = useRef({});

	// Get player color dynamically from their current position
	const getPlayerColor = useCallback((playerId) => {
		const playerDot = dots[playerId];
		if (!playerDot) return null;
		return DOT_INDICATOR_CONFIG[playerDot.position]?.color || null;
	}, [dots]);

	// Callback reference for DraggablePhoto
	const handlePhotoUpdate = useCallback((id, newPos) => {
		positionsRef.current[id] = newPos;
	}, []);


	useEffect(() => {
		const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
		window.addEventListener("resize", handleResize);

		const unsubscribe = onMessage((data) => {
			if (data.type === "marker-confirmed") {
				setDots((prev) => ({
					...prev,
					[data.playerId]: { position: data.position, status: "active", isPopping: false },
				}));
			}

			if (data.type === "marker-cancelled") {
				setDots((prev) => {
					if (!prev[data.playerId]) return prev;
					return {
						...prev,
						[data.playerId]: { ...prev[data.playerId], status: "inactive" },
					};
				});
			}

			// Handle marker reservation events
			if (data.type === "marker-reserved") {
				const posLabel = MARKER_POSITIONS[data.markerId];
				console.log(`[Tablet] >>> MARKER RESERVED: Position "${posLabel}" (ID ${data.markerId}) by player ${data.playerId}`);
			}

			if (data.type === "marker-released") {
				const posLabel = MARKER_POSITIONS[data.markerId];
				console.log(`[Tablet] >>> MARKER RELEASED: Position "${posLabel}" (ID ${data.markerId}) by player ${data.playerId}`);
			}


			if (data.type === "image-sent") {
				console.log("[Tablet] Image received from position:", data.position);

        const id = crypto.randomUUID();
        const posConfig = IMAGE_POSITION_CONFIG[data.position] || { top: "50%", left: "50%" };
        
        // Stabile Zufallswerte generieren
        const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const stableOffsetX = (hash % 30) - 15;
        const stableOffsetY = ((hash * 7) % 30) - 15;
        // Base rotation for player's seating position (visual-only, doesn't affect drag)
        const baseRotation = POSITION_BASE_ROTATION[data.position] || 0;
        // Small random rotation variation (added to pinch rotation)
        const stableRotation = (hash % 20) - 10;

				// Stabile initialPosition - wird einmal erstellt und im Image-Objekt gespeichert
				const initialPosition = { x: 0, y: 0, scale: 1, rotate: 0 };

				// Add image to collage
				const newImage = {
					id: id,
					src: data.imageData,
					position: data.position,
					initialPosition,  // Stabile Referenz im Objekt
          initialStyles: {
            left: posConfig.left,
            top: posConfig.top,
            baseRotation: baseRotation,  // Visual-only rotation for seating position
            rotation: stableRotation,     // Random variation for pinch
            offsetX: stableOffsetX,
            offsetY: stableOffsetY,
          },
					playerId: data.playerId,
					timestamp: data.timestamp,
				};

				setCollageImages(prev => [...prev, newImage]);
        positionsRef.current[id] = initialPosition;  // Gleiche Referenz!
			}

			if (data.type === "player-left") {
				setDots((prev) => {
					if (!prev[data.playerId]) return prev;
					return {
						...prev,
						[data.playerId]: {
							...prev[data.playerId],
							status: "exiting",
						},
					};
				});

				// Delete from state after animation
				setTimeout(() => {
					setDots((prev) => {
						const { [data.playerId]: _, ...rest } = prev;
						return rest;
					});
				}, 600);
			}
		});

		return () => {
			window.removeEventListener("resize", handleResize);
			unsubscribe();
		};
	}, [onMessage]);

	return (
		<Box
			sx={{
				width: "100vw",
				height: "100vh",
				position: "relative",
				bgcolor: "#5D4037",
				backgroundImage: "radial-gradient(circle, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 100%)",
				overflow: "hidden",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<IconButton
				onClick={() => setShowMarkers(!showMarkers)}
				sx={{
					position: "absolute",
					top: 20,
					right: 20,
					zIndex: 1000,
					color: "white",
					bgcolor: "rgba(0,0,0,0.3)",
					"&:hover": { bgcolor: "rgba(0,0,0,0.5)" },
				}}
			>
				<QrCodeScannerIcon fontSize='medium' />
			</IconButton>

			{showMarkers && (
				<Box sx={{ position: "absolute", inset: 0, bgcolor: "white", zIndex: 900 }}>
					{markers.map((m, i) => (
						<Box
							key={i}
							sx={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", zIndex: 910, ...m.sx }}
						>
							<Box
								component='img'
								src={m.src}
								alt='tag'
								sx={{ width: 120, height: 120, objectFit: "contain", border: "2px solid #333", borderRadius: "4px" }}
							/>
						</Box>
					))}
				</Box>
			)}

			{/* Paper / Workspace */}
			<Box sx={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1, pointerEvents: "none" }}>
				<Paper
					elevation={0}
					sx={{
						// DIN A4 aspect ratio: 297x210mm (landscape) or 210x297mm (portrait)
						// Use min() to ensure the paper fits within 85% of viewport while preserving aspect ratio
						aspectRatio: isLandscape ? "297 / 210" : "210 / 297",
						width: isLandscape
							? "min(85vw, 85vh * (297 / 210))"
							: "min(85vw, 85vh * (210 / 297))",
						height: isLandscape
							? "min(85vh, 85vw * (210 / 297))"
							: "min(85vh, 85vw * (297 / 210))",
						boxShadow: "0 10px 10px rgba(0,0,0,0.2)",
						bgcolor: "white",
						borderRadius: "1px",
						position: "relative",
						overflow: "visible",
						transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
						pointerEvents: "auto",
					}}
				>
					{/* Watermark text - low opacity */}
					<Typography
						sx={{ position: "absolute", bottom: 10, right: 15, opacity: 0.2, fontSize: "0.9rem", pointerEvents: "none", fontWeight: "bold" }}
					>
						PHOTO COLLAGE WORKSPACE
					</Typography>
				</Paper>
			</Box>

			{/* Image Collage - positioned relative to VIEWPORT edges, not paper */}
			{collageImages.map((image, index) => {
        // Spawn outside viewport
				let startX = "0px", startY = "0px";
        if (image.position.includes("left")) startX = "-100vw";
        else if (image.position.includes("right")) startX = "100vw";
        if (image.position.includes("top")) startY = "-100vh";
        else if (image.position.includes("bottom")) startY = "100vh";

				return (
					<Box
						key={image.id}
						sx={{
							position: "fixed", // FIXED positioning relative to viewport
							width: "140px", // Smaller images to fit in margins
							height: "auto",
							zIndex: 1500, // Above paper

              // CSS Variables
              "--start-x": startX,
              "--start-y": startY,
              "--land-offset-x": `${image.initialStyles.offsetX}px`,
              "--land-offset-y": `${image.initialStyles.offsetY}px`,
              "--land-rotation": `${image.initialStyles.rotation}deg`,
              left: image.initialStyles.left,
              top: image.initialStyles.top,
              transform: "translate(-50%, -50%)",
							animation: "fly-in-from-edge 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.1) both",
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
              // Hide photos when markers are shown (visual only)
              visibility: showMarkers ? "hidden" : "visible",
						}}
					>
						<DraggablePhoto
							id={image.id}
							src={image.src}
							initialPos={image.initialPosition}
							baseRotation={image.initialStyles.baseRotation}
							rotation={image.initialStyles.rotation}
							onUpdate={handlePhotoUpdate}
							playerColor={getPlayerColor(image.playerId)}
						/>
					</Box>
				);
			})}

			{/* Dot Indicators - at edges of Viewport-Box */}
			{Object.entries(dots).map(([playerId, dot]) => {
				const config = DOT_INDICATOR_CONFIG[dot.position];
				if (!config) return null;

				const isExiting = dot.status === "exiting";
				const isInactive = dot.status === "inactive" || isExiting;

				// Determine flight direction based on position
				const flyX = dot.position.includes("left") ? "-120vw" : dot.position.includes("right") ? "120vw" : "0";
				const flyY = dot.position.includes("top") ? "-120vh" : dot.position.includes("bottom") ? "120vh" : "0";

				return (
					<Box
						key={playerId}
						sx={{
							position: "absolute",
							width: isInactive ? 32 : 40,
							height: isInactive ? 32 : 40,
							borderRadius: "50%",
							backgroundColor: isInactive ? darken(config.color, 0.4) : config.color,
							zIndex: 2000,
							top: config.top,
							left: config.left,
							right: config.right,
							bottom: config.bottom,

							// CSS variables for animation
							"--current-transform": config.transform || "none",
							"--fly-x": flyX,
							"--fly-y": flyY,

							transform: config.transform,
							animation: isExiting ? "fly-out 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards" : "none",
							transition: isExiting ? "none !important" : "all 0.3s ease",

							opacity: isInactive ? 0.5 : 1,
							boxShadow: isInactive ? "none" : `0 0 15px ${config.color}`,
							pointerEvents: "none",
						}}
					/>
				);
			})}
		</Box>
	);
}

export default Tablet;
