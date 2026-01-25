// Phone view - Camera and AprilTag detection using apriltag-js-standalone with Comlink
import { MARKER_POSITIONS, POSITION_LABELS, DETECTION_CONFIG } from './marker-config.js';
import * as Comlink from "https://unpkg.com/comlink/dist/esm/comlink.mjs";
import Communication from './communication.js';

// DOM elements
let video, canvas, ctx, overlayCanvas, overlayCtx;
let statusPanel, markerInfo, loadingPanel, errorPanel;
let markerIdValue, markerPositionValue;
let debugPanel, fpsElement, detectionCountElement, processingTimeElement;
let confirmButton;

// AprilTag detector
let apriltag = null;
let isDetecting = false;
let lastDetectionTime = 0;

// Debug stats
let frameCount = 0;
let lastFpsUpdate = 0;
let totalDetections = 0;
let lastProcessingTime = 0;

// Current best detection
let currentBestMarker = null;

// Communication layer
let communication = null;

// Initialize camera and detection
async function init() {
  // Get DOM elements
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  overlayCanvas = document.getElementById('overlay');
  overlayCtx = overlayCanvas.getContext('2d');

  statusPanel = document.getElementById('status');
  markerInfo = document.getElementById('marker-info');
  loadingPanel = document.getElementById('loading');
  errorPanel = document.getElementById('error');
  markerIdValue = document.getElementById('marker-id-value');
  markerPositionValue = document.getElementById('marker-position-value');

  debugPanel = document.getElementById('debug');
  fpsElement = document.getElementById('fps');
  detectionCountElement = document.getElementById('detection-count');
  processingTimeElement = document.getElementById('processing-time');

  confirmButton = document.getElementById('confirm-button');
  confirmButton.addEventListener('click', handleConfirm);

  try {
    console.log('=== Starting initialization ===');

    // Initialize communication
    console.log('Step 1: Initializing communication...');
    communication = new Communication();
    console.log('✓ Communication initialized');

    // Initialize AprilTag detector
    updateLoadingMessage('Loading AprilTag detector...');
    console.log('Step 2: Initializing detector...');
    await initAprilTagDetector();
    console.log('✓ Detector initialized');

    // Start camera
    updateLoadingMessage('Requesting camera access...');
    console.log('Step 3: Starting camera...');
    await startCamera();
    console.log('✓ Camera started');

    // Hide loading, start detection
    updateLoadingMessage('Starting detection...');
    console.log('Step 4: Starting detection loop...');
    loadingPanel.style.display = 'none';
    startDetection();
    console.log('✓ Detection started');
    console.log('=== Initialization complete ===');
  } catch (error) {
    console.error('✗ Initialization error:', error);
    showError(error.message);
  }
}

// Update loading message
function updateLoadingMessage(message) {
  const loadingText = loadingPanel.querySelector('div:last-child');
  if (loadingText) {
    loadingText.textContent = message;
  }
  console.log('[Loading]', message);
}

// Initialize AprilTag detector using Comlink
async function initAprilTagDetector() {
  console.log('[1/3] Initializing AprilTag detector...');

  try {
    // Create Comlink-wrapped worker
    console.log('[2/3] Creating Web Worker...');
    const worker = new Worker('/lib/apriltag.js');
    const Apriltag = Comlink.wrap(worker);

    console.log('[3/3] Initializing detector instance...');

    // Create detector instance with callback (await the initialization)
    apriltag = await new Apriltag(Comlink.proxy(() => {
      console.log('✓ AprilTag detector ready!');
    }));

    console.log('✓ Detector fully initialized');
  } catch (error) {
    console.error('✗ Failed to initialize detector:', error);
    throw error;
  }
}

// Start camera with rear camera preference
async function startCamera() {
  console.log('[Camera] Requesting camera access...');

  const constraints = {
    video: {
      facingMode: { ideal: 'environment' }, // Prefer rear camera
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  try {
    console.log('[Camera] getUserMedia constraints:', constraints);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('[Camera] ✓ Stream acquired');

    video.srcObject = stream;

    // Wait for video metadata to load
    console.log('[Camera] Waiting for video metadata...');
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        console.log('[Camera] ✓ Metadata loaded');
        video.play();
        resolve();
      };
    });

    // Set canvas sizes - maintain aspect ratio
    const videoAspect = video.videoWidth / video.videoHeight;
    const targetWidth = DETECTION_CONFIG.CANVAS_WIDTH;

    // Calculate height to maintain aspect ratio
    canvas.width = targetWidth;
    canvas.height = Math.round(targetWidth / videoAspect);

    console.log('[Camera] ✓ Started:', video.videoWidth, 'x', video.videoHeight);
    console.log('[Camera] Processing canvas:', canvas.width, 'x', canvas.height, '(aspect ratio preserved)');

    // Function to update overlay canvas size to match rendered video
    function updateOverlaySize() {
      // Get the container dimensions
      const container = video.parentElement;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Calculate the actual rendered video dimensions (respecting object-fit: contain)
      const videoAspect = video.videoWidth / video.videoHeight;
      const containerAspect = containerWidth / containerHeight;

      let renderedWidth, renderedHeight;
      let offsetX = 0, offsetY = 0;

      if (containerAspect > videoAspect) {
        // Container is wider - video is limited by height
        renderedHeight = containerHeight;
        renderedWidth = renderedHeight * videoAspect;
        offsetX = (containerWidth - renderedWidth) / 2;
      } else {
        // Container is taller - video is limited by width
        renderedWidth = containerWidth;
        renderedHeight = renderedWidth / videoAspect;
        offsetY = (containerHeight - renderedHeight) / 2;
      }

      if (renderedWidth > 0 && renderedHeight > 0) {
        overlayCanvas.width = renderedWidth;
        overlayCanvas.height = renderedHeight;
        overlayCanvas.style.left = `${offsetX}px`;
        overlayCanvas.style.top = `${offsetY}px`;
        overlayCanvas.style.width = `${renderedWidth}px`;
        overlayCanvas.style.height = `${renderedHeight}px`;

        console.log('[Overlay] Container:', containerWidth, 'x', containerHeight);
        console.log('[Overlay] Video aspect:', videoAspect, 'Container aspect:', containerAspect);
        console.log('[Overlay] Rendered video:', renderedWidth, 'x', renderedHeight);
        console.log('[Overlay] Offset:', offsetX, ',', offsetY);
      }
    }

    // Initial overlay size - wait multiple frames and add delay to ensure video is fully rendered
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateOverlaySize();
          console.log('[Overlay] Initial size set');
        });
      });
    }, 100);

    // Watch for video element size changes (orientation changes, etc.)
    const resizeObserver = new ResizeObserver(() => {
      console.log('[Overlay] ResizeObserver triggered');
      updateOverlaySize();
    });
    resizeObserver.observe(video);

    // Also update on window resize
    window.addEventListener('resize', () => {
      console.log('[Overlay] Window resize triggered');
      updateOverlaySize();
    });
  } catch (error) {
    console.error('[Camera] ✗ Error:', error);
    console.error('[Camera] Error name:', error.name);
    console.error('[Camera] Error message:', error.message);

    if (error.name === 'NotAllowedError') {
      throw new Error('Camera permission denied. Please allow camera access and reload the page.');
    } else if (error.name === 'NotFoundError') {
      throw new Error('No camera found on this device.');
    } else if (error.name === 'NotReadableError') {
      throw new Error('Camera is already in use by another application.');
    } else {
      throw new Error('Failed to access camera: ' + error.message);
    }
  }
}

// Start detection loop
function startDetection() {
  isDetecting = true;
  detectLoop();
}

// Main detection loop
function detectLoop() {
  if (!isDetecting) return;

  const now = Date.now();
  if (now - lastDetectionTime >= DETECTION_CONFIG.FRAME_INTERVAL) {
    lastDetectionTime = now;
    processFrame();
  }

  requestAnimationFrame(detectLoop);
}

// Process a single video frame
async function processFrame() {
  if (!video.videoWidth || !video.videoHeight || !apriltag) return;

  // Update overlay canvas size to match rendered video (in case of resize)
  const videoRect = video.getBoundingClientRect();
  if (overlayCanvas.width !== videoRect.width || overlayCanvas.height !== videoRect.height) {
    overlayCanvas.width = videoRect.width;
    overlayCanvas.height = videoRect.height;
    console.log('[Frame] Updated overlay size:', overlayCanvas.width, 'x', overlayCanvas.height);
  }

  const startTime = performance.now();

  // Draw video frame to canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Convert to grayscale
  const grayscalePixels = convertToGrayscale(imageData);

  try {
    // Detect tags
    console.log('[Processing] Running detection on', canvas.width, 'x', canvas.height, 'frame');
    console.log('[Processing] apriltag object:', apriltag);
    console.log('[Processing] apriltag.detect type:', typeof apriltag.detect);

    const detections = await apriltag.detect(grayscalePixels, canvas.width, canvas.height);
    console.log('[Processing] Raw detection result:', detections);

    // Update timing
    const processingTime = performance.now() - startTime;
    lastProcessingTime = processingTime;

    handleDetections(detections);
    updateDebugPanel();
  } catch (error) {
    console.error('[Processing] Detection error:', error);
    console.error('[Processing] Error stack:', error.stack);
    updateDebugPanel();
  }

  // Update FPS counter
  frameCount++;
  const now = performance.now();
  if (now - lastFpsUpdate >= 1000) {
    fpsElement.textContent = frameCount.toFixed(1);
    frameCount = 0;
    lastFpsUpdate = now;
  }
}

// Convert image to grayscale
function convertToGrayscale(imageData) {
  const pixels = imageData.data;
  const grayscale = new Uint8Array(imageData.width * imageData.height);

  for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
    // Simple grayscale conversion (average of RGB)
    grayscale[j] = Math.round((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
  }

  return grayscale;
}

// Handle detection results
function handleDetections(detections) {
  console.log('[Detection] Received detections:', detections ? detections.length : 0, detections);

  // Update detection count
  totalDetections = detections ? detections.length : 0;

  if (!detections || detections.length === 0) {
    // No markers detected
    statusPanel.classList.remove('detected');
    markerInfo.style.display = 'none';
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    confirmButton.classList.remove('show');
    currentBestMarker = null;
    return;
  }

  // Filter for valid marker IDs (0-7)
  const validDetections = detections.filter(d => d.id >= 0 && d.id <= 7);
  console.log('[Detection] Valid detections (ID 0-7):', validDetections.length, validDetections);

  if (validDetections.length === 0) {
    statusPanel.classList.remove('detected');
    markerInfo.style.display = 'none';
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    confirmButton.classList.remove('show');
    currentBestMarker = null;
    return;
  }

  // Score and select best marker
  const scoredDetections = validDetections.map(d => ({
    ...d,
    score: scoreMarker(d)
  }));

  // Sort by score (highest first)
  scoredDetections.sort((a, b) => b.score - a.score);

  // Take the best one
  const best = scoredDetections[0];
  console.log('[Detection] Best marker selected:', best.id, 'score:', best.score);

  // Update UI
  updateUI(best);
}

// Score a marker detection
function scoreMarker(detection) {
  let score = 1.0;

  // Calculate marker size (diagonal distance between corners)
  if (detection.p && detection.p.length === 4) {
    const c0 = detection.p[0];
    const c2 = detection.p[2];
    const diagonal = Math.sqrt(
      Math.pow(c2[0] - c0[0], 2) + Math.pow(c2[1] - c0[1], 2)
    );

    // Normalize to canvas size and use as proximity indicator
    const normalizedSize = diagonal / Math.sqrt(
      canvas.width * canvas.width + canvas.height * canvas.height
    );
    score *= normalizedSize * 10; // Amplify size influence
  }

  // Use hamming distance as quality indicator (lower is better)
  if (detection.hamming !== undefined) {
    score *= Math.max(0.1, 1.0 - (detection.hamming / 10));
  }

  // Use decision margin as quality indicator (higher is better)
  if (detection.decision_margin !== undefined) {
    score *= Math.max(0.1, Math.min(2.0, detection.decision_margin / 50));
  }

  return score;
}

// Update UI with detection
function updateUI(detection) {
  console.log('[UI] Updating UI for marker ID:', detection.id);
  statusPanel.classList.add('detected');
  markerInfo.style.display = 'block';
  markerIdValue.textContent = detection.id;

  const position = MARKER_POSITIONS[detection.id];
  markerPositionValue.textContent = POSITION_LABELS[position] || 'Unknown';
  console.log('[UI] Position:', POSITION_LABELS[position]);

  // Store current best marker
  currentBestMarker = detection;

  // Show confirm button
  console.log('[UI] Showing confirm button');
  console.log('[UI] Button element:', confirmButton);
  console.log('[UI] Button position:', confirmButton.style.position || 'absolute (from CSS)');
  console.log('[UI] Button bottom:', confirmButton.style.bottom || '80px (from CSS)');
  confirmButton.classList.add('show');
  console.log('[UI] Button classes:', confirmButton.classList.toString());

  // Draw overlay
  drawDetectionOverlay(detection);
}

// Draw detection overlay
function drawDetectionOverlay(detection) {
  console.log('[Overlay] Drawing marker ID:', detection.id, 'corners:', detection.p);
  // Clear overlay
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (!detection.p || detection.p.length !== 4) {
    console.warn('[Overlay] Invalid corners, skipping draw');
    return;
  }

  // Scale corners from processing resolution to display resolution
  const scaleX = overlayCanvas.width / canvas.width;
  const scaleY = overlayCanvas.height / canvas.height;

  console.log('[Overlay] Scale factors:', scaleX, 'x', scaleY);
  console.log('[Overlay] Canvas size:', canvas.width, 'x', canvas.height);
  console.log('[Overlay] Overlay size:', overlayCanvas.width, 'x', overlayCanvas.height);

  // Draw outline
  overlayCtx.strokeStyle = '#ffeb3b'; // Bright yellow
  overlayCtx.lineWidth = 3;
  overlayCtx.beginPath();

  const corners = detection.p; // p is array of [x,y] pairs
  overlayCtx.moveTo(corners[0][0] * scaleX, corners[0][1] * scaleY);
  for (let i = 1; i < corners.length; i++) {
    overlayCtx.lineTo(corners[i][0] * scaleX, corners[i][1] * scaleY);
  }
  overlayCtx.closePath();
  overlayCtx.stroke();

  // Draw corner dots
  overlayCtx.fillStyle = '#ffeb3b'; // Bright yellow
  for (const corner of corners) {
    overlayCtx.beginPath();
    overlayCtx.arc(corner[0] * scaleX, corner[1] * scaleY, 5, 0, Math.PI * 2);
    overlayCtx.fill();
  }

  // Draw marker ID at center
  if (detection.c) {
    overlayCtx.font = 'bold 24px Arial';
    overlayCtx.fillStyle = '#ffeb3b'; // Bright yellow
    overlayCtx.textAlign = 'center';
    overlayCtx.textBaseline = 'middle';
    overlayCtx.fillText(
      `ID: ${detection.id}`,
      detection.c[0] * scaleX,
      detection.c[1] * scaleY
    );
  }
}

// Update debug panel
function updateDebugPanel() {
  if (detectionCountElement) {
    detectionCountElement.textContent = totalDetections;
  }
  if (processingTimeElement) {
    processingTimeElement.textContent = `${lastProcessingTime.toFixed(0)}ms`;
  }
}

// Show error message
function showError(message) {
  loadingPanel.style.display = 'none';
  errorPanel.style.display = 'block';
  document.getElementById('error-message').textContent = message;
}

// Handle confirm button click
function handleConfirm() {
  if (!currentBestMarker || !communication) return;

  console.log('[Confirm] Sending marker confirmation:', currentBestMarker.id);

  const position = MARKER_POSITIONS[currentBestMarker.id];

  // Send via communication layer (BroadcastChannel + WebSocket)
  communication.send({
    type: 'marker-confirmed',
    markerId: currentBestMarker.id,
    position: position
  });

  console.log('[Confirm] Sent position:', position);

  // Visual feedback
  confirmButton.textContent = '✓ Bestätigt';
  confirmButton.style.background = '#4caf50';

  setTimeout(() => {
    confirmButton.textContent = 'Bestätigen';
    confirmButton.style.background = '#ffeb3b';
  }, 1500);
}

// Start on page load
window.addEventListener('DOMContentLoaded', init);

// Handle page visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    isDetecting = false;
  } else if (video && video.srcObject && apriltag) {
    isDetecting = true;
    detectLoop();
  }
});
