import { useState, useEffect } from "react";
import { usePlayroom } from "../hooks/usePlayroom";
import { Box, IconButton, Paper, Typography, darken } from "@mui/material";
import { MARKER_POSITIONS } from "../marker-config";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
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
const DOT_INDICATOR_CONFIG = {
	"top-left": { color: "#FF5252", top: -12, left: -12, transform: "none" },
	"top-center": { color: "#FF4081", top: -12, left: "50%", transform: "translateX(-50%)" },
	"top-right": { color: "#E040FB", top: -12, right: -12, transform: "none" },
	"center-left": { color: "#7C4DFF", top: "50%", left: -12, transform: "translateY(-50%)" },
	"left-center": { color: "#7C4DFF", top: "50%", left: -12, transform: "translateY(-50%)" },
	"center-right": { color: "#536DFE", top: "50%", right: -12, transform: "translateY(-50%)" },
	"right-center": { color: "#536DFE", top: "50%", right: -12, transform: "translateY(-50%)" },
	"bottom-left": { color: "#448AFF", bottom: -12, left: -12, transform: "none" },
	"bottom-center": { color: "#40C4FF", bottom: -12, left: "50%", transform: "translateX(-50%)" },
	"bottom-right": { color: "#18FFFF", bottom: -12, right: -12, transform: "none" },
};

// Position-based image placement (images appear at VIEWPORT edges, not paper edges)
// Positioned with safe margins so images stay fully visible
const IMAGE_POSITION_CONFIG = {
	"top-left": { top: "10px", left: "10px" },
	"top-center": { top: "10px", left: "50%", transform: "translateX(-50%)" },
	"top-right": { top: "10px", right: "10px" },
	"center-left": { top: "50%", left: "10px", transform: "translateY(-50%)" },
	"left-center": { top: "50%", left: "10px", transform: "translateY(-50%)" },
	"center-right": { top: "50%", right: "10px", transform: "translateY(-50%)" },
	"right-center": { top: "50%", right: "10px", transform: "translateY(-50%)" },
	"bottom-left": { bottom: "10px", left: "10px" },
	"bottom-center": { bottom: "10px", left: "50%", transform: "translateX(-50%)" },
	"bottom-right": { bottom: "10px", right: "10px" },
};

function Tablet() {
	const { onMessage } = usePlayroom();
	const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
	const [showMarkers, setShowMarkers] = useState(false);
	const [dots, setDots] = useState({});
	const [collageImages, setCollageImages] = useState([]);

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
				
				// Add image to collage
				const newImage = {
					id: crypto.randomUUID(),
					src: data.imageData,
					position: data.position,
					playerId: data.playerId,
					timestamp: data.timestamp,
				};
				
				setCollageImages(prev => [...prev, newImage]);
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
				// Get base position config (now relative to viewport)
				const posConfig = IMAGE_POSITION_CONFIG[image.position] || { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
				
				// Add small random offset for visual variety (stacking effect)
				const hash = image.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
				const offsetX = (hash % 30) - 15; // -15 to +15px
				const offsetY = ((hash * 7) % 30) - 15; // -15 to +15px
				const rotation = (hash % 20) - 10; // -10 to +10 degrees
				
				// Combine base transform with offsets and rotation
				const baseTransform = posConfig.transform || "";
				const offsetTransform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;
				const combinedTransform = baseTransform ? `${baseTransform} ${offsetTransform}` : offsetTransform;
				
				return (
					<Box
						key={image.id}
						sx={{
							position: "fixed", // FIXED positioning relative to viewport
							width: "140px", // Smaller images to fit in margins
							height: "auto",
							zIndex: 1500, // Above paper
							...posConfig, // Apply top/left/right/bottom from position config
							transform: combinedTransform,
							boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
							animation: "fadeIn 0.5s ease-in",
							animationDelay: `${index * 0.1}s`,
							animationFillMode: "both",
							"@keyframes fadeIn": {
								from: { opacity: 0, transform: `${combinedTransform} scale(0.8)` },
								to: { opacity: 1, transform: `${combinedTransform} scale(1)` }
							}
						}}
					>
						<Box
							component="img"
							src={image.src}
							alt={`Photo from ${image.position}`}
							sx={{
								width: "100%",
								height: "auto",
								borderRadius: "4px",
								border: "6px solid white",
								boxSizing: "border-box"
							}}
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
