// General imports
import { useState, useEffect, useRef, useCallback } from "react";

// Marker detection related
import { usePlayroom } from "../hooks/usePlayroom";
import { useAprilTag } from "../hooks/useAprilTag";
import { MARKER_POSITIONS, POSITION_LABELS, DETECTION_CONFIG } from "../marker-config";

// Phone UI related
import "./Phone.css";
import CameraGalleryScreen from "./CameraGalleryScreen";
import { Box, Typography, Paper, Button, Fade } from '@mui/material';
import CenterFocusWeakIcon from '@mui/icons-material/CenterFocusWeak';

const accentColor = "#4da6ff"

function Phone() {
  console.log('💥💥💥 Phone.jsx FILE LOADED 💥💥💥');
	const { isConnected, error: connectionError, sendMarkerConfirmation, sendImage } = usePlayroom();
	const { isReady: detectorReady, error: detectorError, detect } = useAprilTag();

	const [isLoading, setIsLoading] = useState(true);
	const [loadingMessage, setLoadingMessage] = useState("Starting app...");
	const [error, setError] = useState(null);
	const [currentMarker, setCurrentMarker] = useState(null);
	const [debugInfo, setDebugInfo] = useState({ fps: 0, detections: 0, processingTime: 0 });
	const [confirmFeedback, setConfirmFeedback] = useState(false);
	const [screen, setScreen] = useState("markerDetection"); // "scanner" | "cameraGallery"
  const [labelPos, setLabelPos] = useState({ x: 0, y: 0 });
  const [userPosition, setUserPosition] = useState(null); // Store the confirmed position NEU!

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
      x: (p.x * factorX) * scale + offsetX,
      y: (p.y * factorY) * scale + offsetY
    });

    const corners = detection.corners.map(mapP);
    const center = mapP(detection.center);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.forEach((p, i) => i > 0 && ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();

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

      // Calculate scaling parameters precisely for THIS frame
      const scale = Math.max(oW / vW, oH / vH);
      const scaleParams = {
        scale,
        offsetX: (oW - vW * scale) / 2,
        offsetY: (oH - vH * scale) / 2,
        factorX: vW / currentCanvasWidth,
        factorY: vH / currentCanvasHeight
      };

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
      setDebugInfo(prev => ({ ...prev, fps: frameCountRef.current, detections: validDetections.length }));
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

	// Initialize; only run once on mount, after DOM is ready
	useEffect(() => {
		let mounted = true;

		async function init() {
			// Wait for video element to be available in DOM
			// This is more robust than a single setTimeout, especially on GitHub Pages
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
	}, []); // Empty deps = means run only once on mount

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
	}, [isLoading]);

	// Handle confirm
	const handleConfirm = () => {
    console.log('🔵 handleConfirm called');
		if (!currentMarker) return;

		const position = MARKER_POSITIONS[currentMarker.id];
    console.log('🔵 Position:', position);
		sendMarkerConfirmation(currentMarker.id, position);
    setUserPosition(position); // Store the position for later use NEU!!

		setConfirmFeedback(true);
		setTimeout(() => setConfirmFeedback(false), 1500);
    console.log('🔵 Switching screen to: cameraGallery');
		setScreen("cameraGallery");
    console.log('🔵 Screen state set!');
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

	return (
  <div className='phone-container' style={{ position: 'relative', backgroundColor: '#000', overflow: 'hidden' }}>
    {console.log('🟢 Phone rendering, screen state:', screen)}
    {screen === "markerDetection" && (
      <>
        {/* TOP OVERLAY: Scan Message & Status */}
        <div style={{ 
            position: 'absolute', top: '20px', width: '100%', 
            display: 'flex', justifyContent: 'center', zIndex: 100, pointerEvents: 'none' 
        }}>
          <span style={{ 
              backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '8px 16px', 
              borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', backdropFilter: 'blur(4px)' 
          }}>
            Scan marker at your position
          </span>
          
          <div style={{ position: 'absolute', right: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ 
                width: '8px', height: '8px', borderRadius: '50%', 
                backgroundColor: isConnected ? '#4caf50' : '#f44336',
                boxShadow: isConnected ? '0 0 8px #4caf50' : 'none' 
            }} />
            <span style={{ color: 'white', fontSize: '0.7rem', opacity: 0.8, fontWeight: 'bold' }}>
                {isConnected ? "CONNECTED" : "DISCONNECTED"}
            </span>
          </div>
        </div>

        {/* CAMERA VIEW */}
        <div className='camera-container' style={{ visibility: isLoading ? "hidden" : "visible" }}>
          <video ref={videoRef} playsInline muted style={{ width: '100vw', height: '100vh', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <canvas ref={overlayRef} className='overlay-canvas' style={{ position: 'absolute', top: 0, left: 0 }} />
        </div>

        {/* FLOATING MARKER INFO */}
{currentMarker && (
  <div style={{
      position: 'absolute',
      left: `${labelPos.x}px`,
      top: `${labelPos.y}px`,
      transform: 'translate(-50%, -130%)',
      zIndex: 1000,
      pointerEvents: 'none'
  }}>
    <div style={{
        backgroundColor: 'white', 
        padding: '12px 20px', 
        borderRadius: '16px',
        border: `3px solid ${accentColor}`, // Dickere Stroke für das Label
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', // Mittig zentriert
        justifyContent: 'center',
        minWidth: '120px',
        textAlign: 'center'
    }}>
      {/* Position jetzt oben und präsenter */}
      <div style={{ 
          color: '#000', 
          fontSize: '1.2rem', 
          fontWeight: 'bold',
          lineHeight: '1.1' 
      }}>
        {positionLabel}
      </div>
      
      {/* ID jetzt darunter und klein */}
      <div style={{ 
          color: '#999', 
          fontSize: '0.7rem', 
          marginTop: '4px' 
      }}>
        ID: {currentMarker.id}
      </div>

      {/* Pfeil nach unten */}
      <div style={{
          position: 'absolute', bottom: '-12px', left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0, 
          borderLeft: '12px solid transparent',
          borderRight: '12px solid transparent', 
          borderTop: `12px solid ${accentColor}`
      }} />
    </div>
  </div>
)}

{/* CONFIRM BUTTON */}
{currentMarker && (
  <button 
    className={`confirm-button ${confirmFeedback ? "confirmed" : ""}`} 
    onClick={handleConfirm}
    style={{
        position: 'absolute', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: accentColor, 
        color: 'white', 
        padding: '16px 48px',
        borderRadius: '40px', 
        border: 'none', 
        fontWeight: 'bold', 
        fontSize: '1.1rem',
        boxShadow: 'none', // Glow/Schatten entfernt
        zIndex: 100,
        transition: 'transform 0.1s active'
    }}
  >
    {confirmFeedback ? "✓ Confirmed" : "Confirm Position"}
  </button>
)}
    
      </>
    )}
    {console.log('🟢 Rendering CameraGalleryScreen with:', { sendImage: typeof sendImage, userPosition })}
    {screen === "cameraGallery" && <CameraGalleryScreen sendImage={sendImage} userPosition={userPosition} />}
  </div>
);
}

export default Phone;
