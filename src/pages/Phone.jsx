import { useState, useEffect, useRef, useCallback } from 'react'
import { usePlayroom } from '../hooks/usePlayroom'
import { useAprilTag } from '../hooks/useAprilTag'
import { MARKER_POSITIONS, POSITION_LABELS, DETECTION_CONFIG } from '../marker-config'
import './Phone.css'

function Phone() {
  const { isConnected, error: connectionError, sendMarkerConfirmation } = usePlayroom()
  const { isReady: detectorReady, error: detectorError, detect } = useAprilTag()

  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState('Initialisiere...')
  const [error, setError] = useState(null)
  const [currentMarker, setCurrentMarker] = useState(null)
  const [debugInfo, setDebugInfo] = useState({ fps: 0, detections: 0, processingTime: 0 })
  const [confirmFeedback, setConfirmFeedback] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const isDetectingRef = useRef(false)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(0)

  // Start camera
  const startCamera = useCallback(async () => {
    setLoadingMessage('Kamera wird gestartet...')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (videoRef.current) {
        const video = videoRef.current
        console.log('[Camera] Setting up video element...')

        // Required for iOS
        video.playsInline = true
        video.muted = true

        // Set up the promise BEFORE setting srcObject
        const metadataPromise = new Promise((resolve) => {
          const handler = () => {
            console.log('[Camera] Metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight)
            video.removeEventListener('loadedmetadata', handler)
            resolve()
          }
          video.addEventListener('loadedmetadata', handler)
        })

        // Now set the stream
        video.srcObject = stream
        console.log('[Camera] Stream assigned, waiting for metadata...')

        // Wait for metadata
        await metadataPromise

        // Start playing
        await video.play()
        console.log('[Camera] Video playing, readyState:', video.readyState)
      } else {
        console.error('[Camera] videoRef.current is null!')
      }

      return true
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Kamera-Zugriff verweigert. Bitte erlaube den Zugriff und lade die Seite neu.')
      } else if (err.name === 'NotFoundError') {
        throw new Error('Keine Kamera gefunden.')
      } else {
        throw new Error('Kamera-Fehler: ' + err.message)
      }
    }
  }, [])

  // Convert image to grayscale (same as working old version)
  const convertToGrayscale = useCallback((imageData) => {
    const pixels = imageData.data;
    const grayscale = new Uint8Array(imageData.width * imageData.height);

    for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
      // Average of RGB - same as working phone.js
      grayscale[j] = Math.round((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3);
    }
    return grayscale;
  }, []);

  // Score a marker
  const scoreMarker = useCallback((detection, canvasWidth, canvasHeight) => {
    let score = 1.0

    if (detection.p && detection.p.length === 4) {
      const c0 = detection.p[0]
      const c2 = detection.p[2]
      const diagonal = Math.sqrt(
        Math.pow(c2[0] - c0[0], 2) + Math.pow(c2[1] - c0[1], 2)
      )
      const normalizedSize = diagonal / Math.sqrt(
        canvasWidth * canvasWidth + canvasHeight * canvasHeight
      )
      score *= normalizedSize * 10
    }

    if (detection.hamming !== undefined) {
      score *= Math.max(0.1, 1.0 - (detection.hamming / 10))
    }

    if (detection.decision_margin !== undefined) {
      score *= Math.max(0.1, Math.min(2.0, detection.decision_margin / 50))
    }

    return score
  }, [])

  // Draw detection overlay
  const drawOverlay = useCallback((detection, canvas, overlay) => {
    const ctx = overlay.getContext('2d')
    ctx.clearRect(0, 0, overlay.width, overlay.height)

    if (!detection || !detection.p || detection.p.length !== 4) return

    const scaleX = overlay.width / canvas.width
    const scaleY = overlay.height / canvas.height

    // Draw outline
    ctx.strokeStyle = '#ffeb3b'
    ctx.lineWidth = 3
    ctx.beginPath()

    const corners = detection.p
    ctx.moveTo(corners[0][0] * scaleX, corners[0][1] * scaleY)
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i][0] * scaleX, corners[i][1] * scaleY)
    }
    ctx.closePath()
    ctx.stroke()

    // Draw corner dots
    ctx.fillStyle = '#ffeb3b'
    for (const corner of corners) {
      ctx.beginPath()
      ctx.arc(corner[0] * scaleX, corner[1] * scaleY, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Draw marker ID
    if (detection.c) {
      ctx.font = 'bold 24px Arial'
      ctx.fillStyle = '#ffeb3b'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`ID: ${detection.id}`, detection.c[0] * scaleX, detection.c[1] * scaleY)
    }
  }, [])

  // Process frame
  const processFrame = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const overlay = overlayRef.current

    if (!video) {
      console.log('[ProcessFrame] No video ref')
      return
    }
    if (video.readyState < 4) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) console.log('[ProcessFrame] Video not ready, readyState:', video.readyState)
      return
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const startTime = performance.now()

    // Set ONLY if the size is not yet correct
    if (canvas.width !== DETECTION_CONFIG.CANVAS_WIDTH) {
      const videoAspect = video.videoWidth / video.videoHeight;
      canvas.width = DETECTION_CONFIG.CANVAS_WIDTH;
      canvas.height = Math.round(DETECTION_CONFIG.CANVAS_WIDTH / videoAspect);
    }

    // Draw video to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get grayscale data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const grayscale = convertToGrayscale(imageData)

    // Detect markers
    const detections = await detect(grayscale, canvas.width, canvas.height)

    const processingTime = performance.now() - startTime

    // Filter valid markers (ID 0-7)
    const validDetections = (detections || []).filter(d => d.id >= 0 && d.id <= 7)

    if (validDetections.length > 0) {
      console.log(`Marker erkannt, ID: ${validDetections[0].id} (Anzahl: ${validDetections.length})`);

      // Score and select best
      const scored = validDetections.map(d => ({
        ...d,
        score: scoreMarker(d, canvas.width, canvas.height)
      }))
      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]

      setCurrentMarker(best)
      drawOverlay(best, canvas, overlay)
    } else {
      setCurrentMarker(null)
      const ctx = overlay.getContext('2d')
      ctx.clearRect(0, 0, overlay.width, overlay.height)
    }

    // Update FPS
    frameCountRef.current++
    const now = performance.now()
    if (now - lastFpsUpdateRef.current >= 1000) {
      setDebugInfo(prev => ({
        ...prev,
        fps: frameCountRef.current,
        detections: validDetections.length,
        processingTime: Math.round(processingTime)
      }))
      frameCountRef.current = 0
      lastFpsUpdateRef.current = now
    }
  }, [detect, convertToGrayscale, scoreMarker, drawOverlay])

  // Detection loop - only starts when camera is ready (isLoading === false)
  useEffect(() => {
    // Don't start until loading is complete
    if (isLoading) {
      console.log('[DetectionLoop] Waiting for loading to complete...')
      return
    }

    console.log('[DetectionLoop] Starting detection loop')
    let lastTime = 0
    isDetectingRef.current = true

    const loop = (timestamp) => {
      if (!isDetectingRef.current) return

      if (timestamp - lastTime >= DETECTION_CONFIG.FRAME_INTERVAL) {
        lastTime = timestamp
        processFrame()
      }

      requestAnimationFrame(loop)
    }

    requestAnimationFrame(loop)

    return () => {
      console.log('[DetectionLoop] Stopping detection loop')
      isDetectingRef.current = false
    }
  }, [isLoading, processFrame])

  // Initialize - only run once on mount, after DOM is ready
  useEffect(() => {
    let mounted = true

    async function init() {
      // Wait a tick for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 0))

      if (!mounted || !videoRef.current) {
        console.log('[Init] Aborted - component unmounted or video not ready')
        return
      }

      try {
        console.log("Starte Initialisierung...");
        // 1. Kamera zuerst starten
        await startCamera();
        if (!mounted) return
        console.log("Kamera bereit");

        // 2. Kurz warten, falls Playroom/Detector noch Zeit brauchen
        setLoadingMessage('Synchronisiere...');

        setIsLoading(false);
        console.log("Loading beendet");
      } catch (err) {
        console.error("Init Fehler:", err);
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    }
    init();

    return () => { mounted = false }
  }, []); // Empty deps - run only once on mount

  // Update overlay size
  useEffect(() => {
    const updateOverlaySize = () => {
      const video = videoRef.current
      const overlay = overlayRef.current
      if (!video || !overlay) return

      const rect = video.getBoundingClientRect()
      overlay.width = rect.width
      overlay.height = rect.height
    }

    window.addEventListener('resize', updateOverlaySize)
    const timer = setTimeout(updateOverlaySize, 100)

    return () => {
      window.removeEventListener('resize', updateOverlaySize)
      clearTimeout(timer)
    }
  }, [isLoading])

  // Handle confirm
  const handleConfirm = () => {
    if (!currentMarker) return

    const position = MARKER_POSITIONS[currentMarker.id]
    sendMarkerConfirmation(currentMarker.id, position)

    setConfirmFeedback(true)
    setTimeout(() => setConfirmFeedback(false), 1500)
  }

  // Show error
  if (error || connectionError || detectorError) {
    return (
      <div className="phone-container">
        <div className="error-panel">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error || connectionError || detectorError}</div>
          <button onClick={() => window.location.reload()}>Neu laden</button>
        </div>
      </div>
    )
  }

  const position = currentMarker ? MARKER_POSITIONS[currentMarker.id] : null
  const positionLabel = position ? POSITION_LABELS[position] : null

  return (
    <div className="phone-container">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-panel">
          <div className="spinner"></div>
          <div>{loadingMessage}</div>
        </div>
      )}

      {/* Connection Status */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? 'Verbunden' : 'Getrennt'}
      </div>

      {/* Camera View - always rendered so ref is available */}
      <div className="camera-container" style={{ visibility: isLoading ? 'hidden' : 'visible' }}>
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <canvas ref={overlayRef} className="overlay-canvas" />
      </div>

      {/* Status Panel */}
      <div className={`status-panel ${currentMarker ? 'detected' : ''}`}>
        {currentMarker ? (
          <div className="marker-info">
            <div className="marker-id">
              <span className="label">Marker ID:</span>
              <span className="value">{currentMarker.id}</span>
            </div>
            <div className="marker-position">
              <span className="label">Position:</span>
              <span className="value">{positionLabel}</span>
            </div>
          </div>
        ) : (
          <div className="scanning-message">Suche nach Markern...</div>
        )}
      </div>

      {/* Confirm Button */}
      {currentMarker && (
        <button
          className={`confirm-button ${confirmFeedback ? 'confirmed' : ''}`}
          onClick={handleConfirm}
        >
          {confirmFeedback ? '✓ Bestätigt' : 'Bestätigen'}
        </button>
      )}

      {/* Debug Panel */}
      <div className="debug-panel">
        <span>FPS: {debugInfo.fps}</span>
        <span>Erkannt: {debugInfo.detections}</span>
        <span>{debugInfo.processingTime}ms</span>
      </div>
    </div>
  )
}

export default Phone
