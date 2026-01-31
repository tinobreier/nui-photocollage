// General imports
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Box, Button, ToggleButton, ToggleButtonGroup, IconButton, Typography, darken, alpha } from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CameraAltIconEnhanced from "@mui/icons-material/CameraEnhance";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

// Image transfer utilities
import { sendImageToTablet, shouldTriggerSend, getSwipeTransform } from "../hooks/imageTransfer";

// Shutter sound as base64 data URI (short click sound)
const SHUTTER_SOUND_DATA =
	"data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CAAICAgACAgIAAgICAAICAgACAgIAAgICAAICAgACAgIAAgICAAICAgACAgIAAgICAAICAgACAgIAAgICA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CA/3+AgP9/gID/f4CAAICAgACAgIAAgICAAICAgACAgIAAgICAAICAgACAgIAAgICAAICAgACAgIAAgICAAICAgACAgIAAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CAAICA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CAAICA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CAAICA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CA/3+AwP9/gID/f4CAAICA";

export default function CameraGalleryScreen({ sendImage, userPosition, onGoBack, accentColor = "#4da6ff" }) {
	const [mode, setMode] = useState("camera");
	const [images, setImages] = useState([]);
	const [selectedImage, setSelectedImage] = useState(null);
	const [galleryHeight, setGalleryHeight] = useState("collapsed"); // "collapsed" | "expanded"
	const [showShutter, setShowShutter] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [isDraggingHandle, setIsDraggingHandle] = useState(false);
	const [handleDragStartY, setHandleDragStartY] = useState(0);
	const [handleDragCurrentY, setHandleDragCurrentY] = useState(0);
	const [swipeStartY, setSwipeStartY] = useState(0);
	const [swipeCurrentY, setSwipeCurrentY] = useState(0);
	const [isSwiping, setIsSwiping] = useState(false);
	const [transmissionStatus, setTransmissionStatus] = useState(null); // null | "sending" | "success" | "error"

	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const fileInputRef = useRef(null);
	const containerRef = useRef(null);
	const shutterAudioRef = useRef(null);
	const pinchRef = useRef({ initialDistance: 0, initialZoom: 1 });
	const handleRef = useRef(null);

	/* ---------------- Audio Setup ---------------- */

	useEffect(() => {
		shutterAudioRef.current = new Audio(SHUTTER_SOUND_DATA);
		shutterAudioRef.current.volume = 0.5;
	}, []);

	/* ---------------- Camera ---------------- */

	useEffect(() => {
		if (mode !== "camera") return;

		let stream;

		navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
			stream = s;
			if (videoRef.current) videoRef.current.srcObject = stream;
		});

		return () => {
			if (stream) stream.getTracks().forEach((t) => t.stop());
		};
	}, [mode]);

	/* ---------------- Pinch to Zoom ---------------- */

	const getDistance = useCallback((touch1, touch2) => {
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}, []);

	const handleTouchStart = useCallback(
		(e) => {
			if (e.touches.length === 2) {
				e.preventDefault();
				pinchRef.current.initialDistance = getDistance(e.touches[0], e.touches[1]);
				pinchRef.current.initialZoom = zoom;
			}
		},
		[zoom, getDistance],
	);

	const handleTouchMove = useCallback(
		(e) => {
			if (e.touches.length === 2) {
				e.preventDefault();
				const currentDistance = getDistance(e.touches[0], e.touches[1]);
				const scale = currentDistance / pinchRef.current.initialDistance;
				const newZoom = Math.min(Math.max(pinchRef.current.initialZoom * scale, 1), 5);
				setZoom(newZoom);
			}
		},
		[getDistance],
	);

	const handleTouchEnd = useCallback(() => {
		pinchRef.current.initialDistance = 0;
	}, []);

	const takePhoto = () => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		if (!video || !canvas) return;

		// Play shutter sound
		if (shutterAudioRef.current) {
			shutterAudioRef.current.currentTime = 0;
			shutterAudioRef.current.play().catch(() => {});
		}

		// Show shutter flash effect
		setShowShutter(true);
		setTimeout(() => setShowShutter(false), 120);

		// Haptic feedback (if supported)
		if (navigator.vibrate) {
			navigator.vibrate(50);
		}

		// Calculate cropped area based on zoom
		const videoWidth = video.videoWidth;
		const videoHeight = video.videoHeight;
		const cropWidth = videoWidth / zoom;
		const cropHeight = videoHeight / zoom;
		const cropX = (videoWidth - cropWidth) / 2;
		const cropY = (videoHeight - cropHeight) / 2;

		// Set canvas to output size (cropped area at full resolution)
		canvas.width = cropWidth;
		canvas.height = cropHeight;

		const ctx = canvas.getContext("2d");
		ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

		canvas.toBlob((blob) => {
			if (!blob) return;
			const url = URL.createObjectURL(blob);

			const img = {
				id: crypto.randomUUID(),
				src: url,
			};

			setImages((prev) => [img, ...prev]);
		}, "image/jpeg");
	};

	/* ---------------- Gallery Input ---------------- */

	const loadGalleryImages = (e) => {
		const files = Array.from(e.target.files || []);
		const imgs = files.map((file) => ({
			id: crypto.randomUUID(),
			src: URL.createObjectURL(file),
		}));
		setImages((prev) => [...imgs, ...prev]);
	};

	/* ---------------- Mode Change Handler ---------------- */

	const handleModeChange = (_, newMode) => {
		if (!newMode) return;
		if (newMode === "gallery") {
			setGalleryHeight("collapsed");
		}
		if (newMode === "camera") {
			setZoom(1);
		}
		setMode(newMode);
	};

	/* ---------------- Handle Drag Gesture ---------------- */

	const handleDragThreshold = 50; // pixels to trigger state change

	const onHandleTouchStart = useCallback((e) => {
		const touch = e.touches[0];
		setIsDraggingHandle(true);
		setHandleDragStartY(touch.clientY);
		setHandleDragCurrentY(touch.clientY);
	}, []);

	const onHandleTouchMove = useCallback(
		(e) => {
			if (!isDraggingHandle) return;
			const touch = e.touches[0];
			setHandleDragCurrentY(touch.clientY);
		},
		[isDraggingHandle],
	);

	const onHandleTouchEnd = useCallback(() => {
		if (!isDraggingHandle) return;

		const dragDelta = handleDragCurrentY - handleDragStartY;

		if (galleryHeight === "collapsed" && dragDelta < -handleDragThreshold) {
			// Swiped up while collapsed -> expand
			setGalleryHeight("expanded");
		} else if (galleryHeight === "expanded" && dragDelta > handleDragThreshold) {
			// Swiped down while expanded -> collapse
			setGalleryHeight("collapsed");
		}

		setIsDraggingHandle(false);
		setHandleDragStartY(0);
		setHandleDragCurrentY(0);
	}, [isDraggingHandle, handleDragStartY, handleDragCurrentY, galleryHeight]);

	/* ---------------- Image Swipe to Send ---------------- */

	// This makes mouse and touch work simultaneously
	const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

	const onImageSwipeStart = useCallback(
		(e) => {
			setTransmissionStatus(null);
			if (!selectedImage) return;
      const y = getY(e);
			setIsSwiping(true);
			setSwipeStartY(y);
			setSwipeCurrentY(y);
		},
		[selectedImage],
	);

	const onImageSwipeMove = useCallback(
		(e) => {
			if (!isSwiping) return;
			const y = getY(e);
			setSwipeCurrentY(y);
			// Log every 10 pixels for less spam
			const delta = Math.abs(touch.clientY - swipeStartY);
			if (delta % 10 < 5) {
				console.log("Swiping... Delta:", swipeStartY - touch.clientY);
			}
		},
		[isSwiping, swipeStartY],
	);

	const onImageSwipeEnd = useCallback(async () => {
		if (!isSwiping || !selectedImage) {
			setIsSwiping(false);
			return;
		}

		// Use utility function to check if swipe threshold is met
		const shouldSend = shouldTriggerSend(swipeStartY, swipeCurrentY);

		if (shouldSend) {
			const imageSrc = selectedImage.src;
			setSelectedImage(null);
			setTransmissionStatus("sending");
			try {
				const success = await sendImageToTablet(sendImage, imageSrc, userPosition);
				if (success) {
					setTransmissionStatus("success");
				} else {
					setTransmissionStatus("error");
				}
			} catch (err) {
				setTransmissionStatus("error");
			}

			setTimeout(() => setTransmissionStatus(null), 1500);
		}

		setIsSwiping(false);
		setSwipeStartY(0);
		setSwipeCurrentY(0);
	}, [isSwiping, selectedImage, swipeStartY, swipeCurrentY, sendImage, userPosition]);

	/* ---------------- Load Device Gallery Images ---------------- */

	useEffect(() => {
		// Request access to device photos when gallery mode is active
		const loadDevicePhotos = async () => {
			try {
				// Use the file input with capture attribute to access gallery
				if (fileInputRef.current && images.length === 0) {
					// Automatically trigger file picker for gallery access
					// Note: This requires user interaction, so show a prompt
				}
			} catch (err) {
				console.log("Could not access device gallery:", err);
			}
		};

		if (mode === "gallery") {
			loadDevicePhotos();
		}
	}, [mode, images.length]);

	const openDeviceGallery = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	/* ---------------- Render ---------------- */

	return (
		<Box sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
			{/* MAIN CONTENT */}
			<Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
				{/* Re-Scan Pill Button */}
				{mode === "camera" && (
					<Button
						variant='contained'
						startIcon={<QrCodeScannerIcon />}
						onClick={onGoBack}
						sx={{
							position: "absolute",
							top: 16,
							left: 16,
							zIndex: 10,
							borderRadius: "50px",
							bgcolor: "rgba(0,0,0,0.5)",
							color: "white",
							textTransform: "none", // (optional)
							px: 2,
							backdropFilter: "blur(6px)",
						}}
					>
						Reposition
					</Button>
				)}
				{mode === "camera" && (
					<Box
						ref={containerRef}
						onTouchStart={handleTouchStart}
						onTouchMove={handleTouchMove}
						onTouchEnd={handleTouchEnd}
						sx={{ height: "100%", position: "relative", overflow: "hidden", touchAction: "none" }}
					>
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								transform: `scale(${zoom})`,
								transformOrigin: "center center",
							}}
						/>

						{/* Shutter Flash Overlay */}
						{showShutter && (
							<Box
								sx={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									bottom: 0,
									bgcolor: "white",
									opacity: 0.8,
									pointerEvents: "none",
								}}
							/>
						)}

						{/* Zoom Indicator */}
						{zoom > 1 && (
							<Box
								sx={{
									position: "absolute",
									top: 16,
									left: "50%",
									transform: "translateX(-50%)",
									bgcolor: "rgba(0,0,0,0.6)",
									color: "white",
									px: 2,
									py: 0.5,
									borderRadius: 2,
									fontSize: 14,
								}}
							>
								{zoom.toFixed(1)}x
							</Box>
						)}

						{/* Capture Button */}
						<IconButton
							onClick={takePhoto}
							sx={{
								position: "absolute",
								bottom: 24,
								left: "50%",
								transform: "translateX(-50%)",
								width: 80,
								height: 80,
								bgcolor: "white",
								border: "4px solid #ccc",
								"&:hover": {
									bgcolor: "#eee",
								},
								"&:active": {
									transform: "translateX(-50%) scale(0.95)",
								},
							}}
						>
							<CameraAltIconEnhanced sx={{ fontSize: 36 }} />
						</IconButton>

						<canvas ref={canvasRef} style={{ display: "none" }} />
					</Box>
				)}

				{mode === "gallery" && (
					<Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#111" }}>
						{/* Top section – instruction (only when collapsed) */}
						{galleryHeight === "collapsed" && (
							<Box
								sx={{
									height: "15%",
									minHeight: 40,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 50%, #111 100%)",
								}}
							>
								<Typography color='white' textAlign='center'>
									Swipe your photo upwards <br /> to send it to the tablet
								</Typography>
							</Box>
						)}

						{/* Middle section – detail / preview (only when collapsed) */}
						{galleryHeight === "collapsed" && (
							<Box
								// Touch Events
								onTouchStart={onImageSwipeStart}
								onTouchMove={onImageSwipeMove}
								onTouchEnd={onImageSwipeEnd}
								// Mouse Events (for testing)
								onMouseDown={onImageSwipeStart}
								onMouseMove={(e) => {
									// The movement is only calculated when we are in swiping mode
									if (isSwiping) onImageSwipeMove(e);
								}}
								onMouseUp={onImageSwipeEnd}
								onMouseLeave={onImageSwipeEnd}
								sx={{
									height: "35%",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									bgcolor: "#000",
									position: "relative",
									touchAction: "none",
									userSelect: "none",
								}}
							>
								{selectedImage ? (
									<>
										<img
											src={selectedImage.src}
											alt=''
											draggable='false'
											style={{
												maxWidth: "100%",
												maxHeight: "100%",
												userSelect: "none",
												pointerEvents: "none",
												...(isSwiping ? getSwipeTransform(swipeStartY, swipeCurrentY) : { transform: "none", opacity: 1 }),
												transition: isSwiping ? "none" : "transform 0.3s ease",
											}}
										/>

										{/* Swipe Hint */}
										{isSwiping && shouldTriggerSend(swipeStartY, swipeCurrentY - 20) && (
											<Box
												sx={{
													position: "absolute",
													top: "16px",
													left: "50%",
													transform: "translateX(-50%)",
													bgcolor: alpha(accentColor, 0.9),
													color: "white",
													padding: "8px 20px",
													borderRadius: "20px",
													fontSize: "0.9rem",
													whiteSpace: "nowrap",
													fontWeight: "bold",
													pointerEvents: "none",
													animation: "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.27) both",
													"@keyframes popIn": {
														"0%": {
															opacity: 0,
															transform: "translateX(-50%) translateY(25%) scale(0.6)",
														},
														"100%": {
															opacity: 1,
															transform: "translateX(-50%) translateY(0%) scale(1)",
														},
													},
												}}
											>
												↑ Keep swiping to send ↑
											</Box>
										)}
									</>
								) : (
									<Typography color='gray'>Select a photo for preview</Typography>
								)}

								{/* Transmission Status Feedback */}
								{transmissionStatus && !isSwiping && (
									<Box
										sx={{
											position: "absolute",
											top: "16px",
											left: "50%",
											transform: "translateX(-50%)",
											bgcolor: transmissionStatus === "success" ? "#4caf50" : transmissionStatus === "error" ? "#f44336" : accentColor,
											color: "white",
											padding: "8px 20px",
											borderRadius: "20px",
											fontSize: "0.9rem",
											whiteSpace: "nowrap",
											fontWeight: "bold",
											pointerEvents: "none",
											zIndex: 20,
											animation: "popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.27) forwards, fadeOutUp 0.5s ease forwards 2.5s",
											"@keyframes popIn": {
												"0%": { opacity: 0, transform: "translateX(-50%) translateY(25%) scale(0.6)" },
												"100%": { opacity: 1, transform: "translateX(-50%) translateY(0%) scale(1)" },
											},
											"@keyframes fadeOutUp": {
												"0%": {
													opacity: 1,
													transform: "translateX(-50%) translateY(0)",
												},
												"100%": {
													opacity: 0,
													transform: "translateX(-50%) translateY(-20px)",
												},
											},
										}}
									>
										{transmissionStatus === "success" && "Photo sent ✔"}
									</Box>
								)}
							</Box>
						)}

						{/* Bottom Sheet – Mini Gallery */}
						<Box
							sx={{
								flex: 1,
								minHeight: galleryHeight === "collapsed" ? "50%" : "100%",
								transition: "all 0.25s ease",
								bgcolor: "#111",
								borderTopLeftRadius: 16,
								borderTopRightRadius: 16,
								overflow: "hidden",
								display: "flex",
								flexDirection: "column",
							}}
						>
							{/* Handle */}
							<Box
								ref={handleRef}
								onTouchStart={onHandleTouchStart}
								onTouchMove={onHandleTouchMove}
								onTouchEnd={onHandleTouchEnd}
								sx={{
									py: 2,
									display: "flex",
									justifyContent: "center",
									cursor: "grab",
									touchAction: "none",
									userSelect: "none",
								}}
							>
								<Box
									sx={{
										width: 50,
										height: 5,
										borderRadius: 2.5,
										bgcolor: isDraggingHandle ? "#999" : "#666",
										transition: "background-color 0.15s ease",
									}}
								/>
							</Box>

							{/* Grid Gallery */}
							<Box
								sx={{
									flex: 1,
									px: 1,
									pb: 1,
									display: "grid",
									gridTemplateColumns: "repeat(3, 1fr)",
									gridAutoRows: "calc((100vw - 24px) / 3)",
									gap: 1,
									overflowY: "auto",
									WebkitOverflowScrolling: "touch",
									alignContent: "start",
								}}
							>
								{/* Add Photos Button - first cell */}
								<Box
									onClick={openDeviceGallery}
									sx={{
										width: "100%",
										height: "100%",
										borderRadius: 1,
										overflow: "hidden",
										border: "2px dashed #666",
										boxSizing: "border-box",
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										justifyContent: "center",
										cursor: "pointer",
										bgcolor: "rgba(255,255,255,0.05)",
										"&:active": {
											bgcolor: "rgba(255,255,255,0.1)",
										},
									}}
								>
									<AddPhotoAlternateIcon sx={{ color: "#888", fontSize: 32 }} />
									<Typography sx={{ color: "#888", fontSize: 10, mt: 0.5 }}>Add Photos</Typography>
								</Box>

								{images.map((img) => (
									<Box
										key={img.id}
										onClick={() => {
											setSelectedImage(img);
											setGalleryHeight("collapsed");
										}}
										sx={{
											width: "100%",
											height: "100%",
											borderRadius: 1,
											overflow: "hidden",
											border: selectedImage?.id === img.id ? "2px solid white" : "2px solid transparent",
											boxSizing: "border-box",
										}}
									>
										<img
											src={img.src}
											alt=''
											style={{
												width: "100%",
												height: "100%",
												objectFit: "cover",
												display: "block",
											}}
										/>
									</Box>
								))}
							</Box>

							{/* Hidden file input for device gallery access */}
							<input ref={fileInputRef} type='file' accept='image/*' multiple onChange={loadGalleryImages} style={{ display: "none" }} />
						</Box>
					</Box>
				)}
			</Box>

			{/* TOGGLE — ALWAYS BOTTOM */}
			<Box
				sx={{
					p: 1,
					borderTop: "1px solid #333",
					bgcolor: "#000",
				}}
			>
				<ToggleButtonGroup
					value={mode}
					exclusive
					onChange={handleModeChange}
					fullWidth
					sx={{
						bgcolor: "#222",
						borderRadius: "50px", // Outer frame as a pill
						// padding: "2px",       // Creates the spacing for the "inlay" effect (optional, can be removed later if we want)
						border: "1px solid #444",
						"& .MuiToggleButtonGroup-grouped": {
							// Forces rounding on both sides for each button
							borderRadius: "50px !important",
							border: "none !important",
						},
						"& .MuiToggleButton-root": {
							color: "white",
							// textTransform: "none", // Prevents automatic capitalization
							"&:not(:first-of-type)": {
								marginLeft: 0, // Prevents MUI standard margin correction
							},
						},
						"& .MuiToggleButton-root.Mui-selected": {
							bgcolor: accentColor,
							color: "white",
							fontWeight: 600,
							"&.MuiToggleButton-root.Mui-selected:hover": {
								bgcolor: darken(accentColor, 0.2),
							},
						},
					}}
				>
					<ToggleButton value='camera'>Camera</ToggleButton>
					<ToggleButton value='gallery'>Photos taken</ToggleButton>
				</ToggleButtonGroup>
			</Box>
		</Box>
	);
}
