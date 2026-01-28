// General imports
import { useState, useEffect, useRef, useCallback } from "react";

// Marker detection related
import { usePlayroom } from "../hooks/usePlayroom";
import { useAprilTag } from "../hooks/useAprilTag";
import { MARKER_POSITIONS, POSITION_LABELS, DETECTION_CONFIG } from "../marker-config";

// Phone UI related
import "./Phone.css";
import CameraGalleryScreen from "./CameraGalleryScreen";
import { Box, Typography, Paper, Button, Fade } from "@mui/material";
import CenterFocusWeakIcon from "@mui/icons-material/CenterFocusWeak";

const accentColor = "#4da6ff";

function Phone() {
	const { isConnected, error: connectionError, sendMarkerConfirmation, cancelMarker } = usePlayroom();
	const { isReady: detectorReady, error: detectorError, detect } = useAprilTag();

	const [isLoading, setIsLoading] = useState(true);
	const [loadingMessage, setLoadingMessage] = useState("Starting app...");
	const [error, setError] = useState(null);
	const [currentMarker, setCurrentMarker] = useState(null);
	const [debugInfo, setDebugInfo] = useState({ fps: 0, detections: 0, processingTime: 0 });
	const [confirmFeedback, setConfirmFeedback] = useState(false);
	const [screen, setScreen] = useState("markerDetection"); // "scanner" | "cameraGallery"; Default on markerDetection
	const [labelPos, setLabelPos] = useState({ x: 0, y: 0 });
	const [detectedMarker, setDetectedMarker] = useState(null); // For creating the state from scratch
	const [confirmStatus, setConfirmStatus] = useState(false);
	const [debugDisplay, setDebugDisplay] = useState("");

	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const overlayRef = useRef(null);
	const isDetectingRef = useRef(false);
	const frameCountRef = useRef(0);
	const lastFpsUpdateRef = useRef(0);

	// Start camera
	const startCamera = useCallback(async () => {
		setLoadingMessage("Starting camera...");

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: { ideal: "environment" },
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
			});

			if (videoRef.current) {
				const video = videoRef.current;
				console.log("[Camera] Setting up video element...");

				// (Required for iOS)
				video.playsInline = true;
				video.muted = true;

				// Set up the promise (before setting srcObject)
				const metadataPromise = new Promise((resolve) => {
					const handler = () => {
						console.log("[Camera] Metadata loaded, dimensions:", video.videoWidth, "x", video.videoHeight);
						video.removeEventListener("loadedmetadata", handler);
						resolve();
					};
					video.addEventListener("loadedmetadata", handler);
				});

				// Set the stream
				video.srcObject = stream;
				console.log("[Camera] Stream assigned, waiting for metadata...");

				// Wait for metadata
				await metadataPromise;

				// Start playing cam stream
				await video.play();
				console.log("[Camera] Video playing, readyState:", video.readyState);
			} else {
				console.error("[Camera] videoRef.current is null!");
			}

			return true;
		} catch (err) {
			if (err.name === "NotAllowedError") {
				throw new Error("Camera access denied. Please allow access and reload the page.");
			} else if (err.name === "NotFoundError") {
				throw new Error("No camera found.");
			} else {
				throw new Error("Camera error: " + err.message);
			}
		}
	}, []);

	// Convert image to grayscale
	const convertToGrayscale = useCallback((imageData) => {
		const pixels = imageData.data;
		const grayscale = new Uint8Array(imageData.width * imageData.height);

		for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
			// Average of RGB
			grayscale[j] = Math.round((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
		}
		return grayscale;
	}, []);

	// Score a marker
	const scoreMarker = useCallback((detection, canvasWidth, canvasHeight) => {
		let score = 1.0;

		if (detection.corners && detection.corners.length === 4) {
			const c0 = detection.corners[0];
			const c2 = detection.corners[2];
			const diagonal = Math.sqrt(Math.pow(c2.x - c0.x, 2) + Math.pow(c2.y - c0.y, 2));
			const normalizedSize = diagonal / Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
			score *= normalizedSize * 10;
		}

		// Hamming and decision margin, if available (Fallback) (Not yet implemented)
		if (detection.hamming !== undefined) {
			score *= Math.max(0.1, 1.0 - detection.hamming / 10);
		}

		return score;
	}, []);

	const drawBorderAroundMarker = useCallback((detection, overlay, params) => {
		if (!overlay) return null;

		const ctx = overlay.getContext("2d");
		ctx.clearRect(0, 0, overlay.width, overlay.height);

		if (!detection || !detection.corners || !params) return;

		// conversion function (scale is wrong otherwise)
		const { scale, offsetX, offsetY, factorX, factorY } = params;
		const mapP = (p) => ({
			x: p.x * factorX * scale + offsetX,
			y: p.y * factorY * scale + offsetY,
		});

		const corners = detection.corners.map(mapP);
		const center = mapP(detection.center);

		ctx.strokeStyle = accentColor;
		ctx.lineWidth = 6;
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(corners[0].x, corners[0].y);
		corners.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
		ctx.closePath();
		ctx.stroke();

		// ===> Animation Start
		// optional for later
		// ===> Animation End

		// (Optional) Small dots at the corners for debugging
		// ctx.fillStyle = accentColor;
		// corners.forEach(p => {
		//   ctx.beginPath();
		//   ctx.arc(p.x, p.y, 4, 0, Math.PI * 1);
		//   ctx.fill();
		// });

		return center;
	}, []);

	const processFrame = useCallback(async () => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		const overlay = overlayRef.current;

		if (!video || video.readyState < 4 || video.videoWidth === 0) return;

		const ctx = canvas.getContext("2d", { willReadFrequently: true });

		// Fix dimensions BEFORE detection
		const vW = video.videoWidth;
		const vH = video.videoHeight;
		const oW = overlay.width;
		const oH = overlay.height;

		if (canvas.width !== DETECTION_CONFIG.CANVAS_WIDTH) {
			const videoAspect = vW / vH;
			canvas.width = DETECTION_CONFIG.CANVAS_WIDTH;
			canvas.height = Math.round(DETECTION_CONFIG.CANVAS_WIDTH / videoAspect);
		}

		// For later scaling
		const currentCanvasWidth = canvas.width;
		const currentCanvasHeight = canvas.height;

		ctx.drawImage(video, 0, 0, currentCanvasWidth, currentCanvasHeight);
		const imageData = ctx.getImageData(0, 0, currentCanvasWidth, currentCanvasHeight);
		const grayscale = convertToGrayscale(imageData);

		// Start detection
		const detections = await detect(grayscale, currentCanvasWidth, currentCanvasHeight);

		const validDetections = (detections || []).filter((d) => d.id >= 0 && d.id <= 7);

		if (validDetections.length > 0) {
			const scored = validDetections.map((d) => ({
				...d,
				score: scoreMarker(d, currentCanvasWidth, currentCanvasHeight),
			}));

			scored.sort((a, b) => b.score - a.score);
			const best = scored[0];

			// Real video dimensions (e.g., 1280x720)
			const vW = video.videoWidth;
			const vH = video.videoHeight;

			// Real visible size of the video on the screen (CSS Pixel)
			const rect = video.getBoundingClientRect();
			const displayW = rect.width;
			const displayH = rect.height;

			if (overlay.width !== displayW || overlay.height !== displayH) {
				overlay.width = displayW;
				overlay.height = displayH;
			}

			const scanScale = Math.max(displayW / vW, displayH / vH);
			const offX = (displayW - vW * scanScale) / 2;
			const offY = (displayH - vH * scanScale) / 2;

			// Convert display coordinates to canvas coordinates
			const scaleParams = {
				scale: scanScale, // Combine video scale with canvas scale
				offsetX: offX,
				offsetY: offY,
				factorX: vW / currentCanvasWidth,
				factorY: vH / currentCanvasHeight,
			};

			// DEBUG ONLY (CAN BE USED IF NEEDED)
			// if (frameCountRef.current === 0) {
			//   const videoRect = video.getBoundingClientRect();
			//   const overlayRect = overlay.getBoundingClientRect();
			//   setDebugDisplay(
			//     `vid: ${vW}x${vH} | vidRect: ${videoRect.width.toFixed(0)}x${videoRect.height.toFixed(0)}\n` +
			//     `overlay: ${oW}x${oH} | ovRect: ${overlayRect.width.toFixed(0)}x${overlayRect.height.toFixed(0)}\n` +
			//     `vidRect.top: ${videoRect.top.toFixed(0)} | ovRect.top: ${overlayRect.top.toFixed(0)}\n` +
			//     `scale:${scanScale.toFixed(3)} | offX:${offsetX.toFixed(1)} offY:${offsetY.toFixed(1)}`
			//   );
			// }

			setCurrentMarker(best);
			const centerPos = drawBorderAroundMarker(best, overlay, scaleParams);
			if (centerPos) setLabelPos(centerPos);
		} else {
			setCurrentMarker(null);
			if (overlay) {
				overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
			}
		}

		// FPS counter logic
		frameCountRef.current++;
		const now = performance.now();
		if (now - lastFpsUpdateRef.current >= 1000) {
			setDebugInfo((prev) => ({ ...prev, fps: frameCountRef.current, detections: validDetections.length }));
			frameCountRef.current = 0;
			lastFpsUpdateRef.current = now;
		}
	}, [detect, convertToGrayscale, scoreMarker, drawBorderAroundMarker]);

	// Detection loop; only starts when camera is ready (isLoading === false)
	useEffect(() => {
		if (isLoading) {
			console.log("[DetectionLoop] Waiting for loading to complete...");
			return;
		}

		console.log("[DetectionLoop] Starting detection loop");
		let lastTime = 0;
		isDetectingRef.current = true;

		const loop = (timestamp) => {
			if (!isDetectingRef.current) return;

			if (timestamp - lastTime >= DETECTION_CONFIG.FRAME_INTERVAL) {
				lastTime = timestamp;
				processFrame();
			}

			requestAnimationFrame(loop);
		};

		requestAnimationFrame(loop);

		return () => {
			console.log("[DetectionLoop] Stopping detection loop");
			isDetectingRef.current = false;
		};
	}, [isLoading, processFrame]);

	// Tab in foreground/background?
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.hidden) {
				// User has switched tabs or locked their phone
				cancelMarker();
			} else {
				// When the user comes back and we still have their marker
				if (currentMarker) {
					const position = MARKER_POSITIONS[currentMarker.id];
					sendMarkerConfirmation(currentMarker.id, position);
				}
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [cancelMarker, sendMarkerConfirmation, currentMarker]);

	// Initialize; only run once on mount, after DOM is ready
	useEffect(() => {
		let mounted = true;

		async function init() {
			// Wait for video element to be available in DOM
			let attempts = 0;
			const maxAttempts = 50; // 5 seconds max
			while (!videoRef.current && attempts < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				attempts++;
			}

			if (!mounted || !videoRef.current) {
				console.log("[Init] Aborted - component unmounted or video not ready after", attempts, "attempts");
				return;
			}
			console.log("[Init] Video element ready after", attempts, "attempts");

			try {
				console.log("Starting initialization...");
				// 1. Start camera first
				await startCamera();
				if (!mounted) return;
				console.log("Camera ready");

				// 2. Brief wait in case Playroom/Detector need more time
				setLoadingMessage("Synchronizing...");

				setIsLoading(false);
				console.log("Loading complete");
			} catch (err) {
				console.error("Init Fehler:", err);
				if (mounted) {
					setError(err.message);
					setIsLoading(false);
				}
			}
		}
		init();

		return () => {
			mounted = false;
		};
	}, [screen]); // Empty deps = means run only once on mount

	// Update overlay size
	useEffect(() => {
		const updateOverlaySize = () => {
			const video = videoRef.current;
			const overlay = overlayRef.current;
			if (!video || !overlay) return;

			const rect = video.getBoundingClientRect();
			overlay.width = rect.width;
			overlay.height = rect.height;

			console.log("Overlay resized to:", overlay.width, "x", overlay.height);
		};

		window.addEventListener("resize", updateOverlaySize);
		const timer = setTimeout(updateOverlaySize, 100);

		return () => {
			window.removeEventListener("resize", updateOverlaySize);
			clearTimeout(timer);
		};
	}, [isLoading, screen]);

	// Handle confirm
	const handleConfirm = () => {
		if (!currentMarker) return;

		const position = MARKER_POSITIONS[currentMarker.id];
		sendMarkerConfirmation(currentMarker.id, position);

		setConfirmFeedback(true);
		setTimeout(() => setConfirmFeedback(false), 1500);
		setScreen("cameraGallery");
	};

	// Show error
	if (error || connectionError || detectorError) {
		return (
			<div className='phone-container'>
				<div className='error-panel'>
					<div className='error-icon'>⚠️</div>
					<div className='error-message'>{error || connectionError || detectorError}</div>
					<button onClick={() => window.location.reload()}>Reload</button>
				</div>
			</div>
		);
	}

	const position = currentMarker ? MARKER_POSITIONS[currentMarker.id] : null;
	const positionLabel = position ? POSITION_LABELS[position] : null;

	const handleGoBack = () => {
		// Tell the tablet that we are leaving our position
		cancelMarker();

		// Reset UI states
		setDetectedMarker(null);
		setConfirmStatus(false);

		// Set screen back on marker detector
		setScreen("markerDetection");
	};

	return (
		<div className='phone-container' style={{ position: "relative", backgroundColor: "#000", overflow: "hidden" }}>
			{screen === "markerDetection" && (
				<>
					{/* DEBUG DISPLAY */}
					{debugDisplay && (
						<div
							style={{
								position: "absolute",
								bottom: "120px",
								left: "10px",
								right: "10px",
								backgroundColor: "rgba(0,0,0,0.8)",
								color: "#0f0",
								padding: "8px",
								borderRadius: "8px",
								fontSize: "10px",
								fontFamily: "monospace",
								zIndex: 9999,
								whiteSpace: "pre-line",
							}}
						>
							{debugDisplay}
						</div>
					)}

					{/* TOP OVERLAY: Scan Message & Status */}
					<div
						style={{
							position: "absolute",
							top: "20px",
							width: "100%",
							display: "flex",
							justifyContent: "center",
							zIndex: 100,
							pointerEvents: "none",
						}}
					>
						<span
							style={{
								backgroundColor: "rgba(0,0,0,0.6)",
								color: "white",
								padding: "8px 16px",
								borderRadius: "20px",
								fontSize: "0.9rem",
								fontWeight: "bold",
								backdropFilter: "blur(4px)",
							}}
						>
							Scan marker at your position
						</span>

						<div style={{ position: "absolute", right: "20px", display: "flex", alignItems: "center", gap: "6px" }}>
							<div
								style={{
									width: "8px",
									height: "8px",
									borderRadius: "50%",
									backgroundColor: isConnected ? "#4caf50" : "#f44336",
									boxShadow: isConnected ? "0 0 8px #4caf50" : "none",
								}}
							/>
							<span style={{ color: "white", fontSize: "0.7rem", opacity: 0.8, fontWeight: "bold" }}>
								{isConnected ? "CONNECTED" : "DISCONNECTED"}
							</span>
						</div>
					</div>

					{/* CAMERA VIEW */}
					<div className='camera-container' style={{ visibility: isLoading ? "hidden" : "visible" }}>
						<video ref={videoRef} playsInline muted style={{ width: "100vw", height: "100vh", objectFit: "cover" }} />
						<canvas ref={canvasRef} style={{ display: "none" }} />
						<canvas ref={overlayRef} className='overlay-canvas' style={{ position: "absolute", top: 0, left: 0 }} />
					</div>

					{/* FLOATING MARKER INFO */}
					{currentMarker && (
						<div
							style={{
								position: "absolute",
								left: `${labelPos.x}px`,
								top: `${labelPos.y}px`,
								transform: "translate(-50%, -130%)",
								zIndex: 1000,
								pointerEvents: "none",
							}}
						>
							<div
								style={{
									backgroundColor: "white",
									padding: "12px 20px",
									borderRadius: "16px",
									border: `3px solid ${accentColor}`, 
									boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									minWidth: "120px",
									textAlign: "center",
								}}
							>
								{/* Position label */}
								<div
									style={{
										color: "#000",
										fontSize: "1.2rem",
										fontWeight: "bold",
										lineHeight: "1.1",
									}}
								>
									{positionLabel}
								</div>

								{/* ID */}
								<div
									style={{
										color: "#999",
										fontSize: "0.9rem",
										marginTop: "5px",
									}}
								>
									ID: {currentMarker.id}
								</div>

								{/* down arrow */}
								<div
									style={{
										position: "absolute",
										bottom: "-12px",
										left: "50%",
										transform: "translateX(-50%)",
										width: 0,
										height: 0,
										borderLeft: "12px solid transparent",
										borderRight: "12px solid transparent",
										borderTop: `12px solid ${accentColor}`,
									}}
								/>
							</div>
						</div>
					)}

					{/* CONFIRM BUTTON */}
					{currentMarker && (
						<button
							className={`confirm-button ${confirmFeedback ? "confirmed" : ""}`}
							onClick={handleConfirm}
							style={{
								position: "absolute",
								bottom: "40px",
								left: "50%",
								transform: "translateX(-50%)",
								backgroundColor: accentColor,
								color: "white",
								padding: "16px 48px",
								borderRadius: "40px",
								border: "none",
								fontWeight: "bold",
								fontSize: "1.1rem",
								boxShadow: "none", // (Optional) Glow removed
								zIndex: 100,
								transition: "transform 0.1s active",
							}}
						>
							{confirmFeedback ? "✓ Confirmed" : "Confirm Position"}
						</button>
					)}
				</>
			)}
			{screen === "cameraGallery" && <CameraGalleryScreen key='cameraGallery' onGoBack={handleGoBack} />}
		</div>
	);
}

export default Phone;
