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

function Tablet() {
	const { onMessage } = usePlayroom();
	const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
	const [showMarkers, setShowMarkers] = useState(false);
	const [dots, setDots] = useState({});

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
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
						pointerEvents: "auto",
					}}
				>
					<Typography
						sx={{ position: "absolute", bottom: 10, right: 15, opacity: 0.2, fontSize: "0.9rem", pointerEvents: "none", fontWeight: "bold" }}
					>
						PHOTO COLLAGE WORKSPACE
					</Typography>
				</Paper>
			</Box>

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
