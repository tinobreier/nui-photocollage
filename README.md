# AprilTag Marker Detection Web Application

A minimal web application for detecting AprilTag markers from a smartphone camera to identify player positions around a tablet.

## Features

- **Marker Detection**: Detects AprilTag-style markers from oblique camera angles
- **8 Position Mapping**: Maps markers to 8 positions (4 corners + 4 sides)
- **Nearest Marker Priority**: Prioritizes the closest marker when multiple are visible
- **Rotation Tolerance**: Handles markers viewed from various angles

## Project Structure

```
PhotoCollage-Marker/
├── server.js              # Express web server
├── package.json           # Dependencies
├── index.html            # Landing page
├── phone.html            # Camera detection view
├── tablet.html           # Marker display view
├── src/
│   ├── phone.js          # Detection logic
│   ├── tablet.js         # Display logic
│   └── marker-config.js  # Shared configuration
├── assets/
│   └── markers/          # Generated AprilTag images (tag_0.png - tag_7.png)
└── generate_markers.py   # Python script to generate markers
```

## Marker-to-Position Mapping

| Marker ID | Position |
|-----------|----------|
| 0 | Top-Left |
| 1 | Top-Center |
| 2 | Top-Right |
| 3 | Right-Center |
| 4 | Bottom-Right |
| 5 | Bottom-Center |
| 6 | Bottom-Left |
| 7 | Left-Center |

## Setup

### Prerequisites

- Node.js (v14 or higher)
- Python 3 (for marker generation, optional)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Generate markers (if needed):
```bash
python generate_markers.py
```

This creates 8 AprilTag-style markers in `assets/markers/`.

## Usage

### Start the Server

```bash
npm start
```

The server will start at `http://localhost:3000`.

### Access the Application

1. **Landing Page**: `http://localhost:3000`
   - Choose between Phone and Tablet views

2. **Tablet View**: `http://localhost:3000/tablet`
   - Displays all 8 markers positioned around the screen
   - Use this to test detection with markers on screen
   - You can also print the markers from `assets/markers/` for paper testing

3. **Phone View**: `http://localhost:3000/phone`
   - Opens camera for marker detection
   - Point camera at markers (on tablet or printed)
   - Shows detected marker ID and position

### Camera Permissions

- The phone view requires camera access
- Allow camera permissions when prompted
- Works best with rear camera (automatically selected if available)
- Requires HTTPS in production or localhost for development

## Testing

### Test Scenarios

1. **Tablet Screen Test**:
   - Open `/tablet` on a tablet device
   - Open `/phone` on your smartphone
   - Point phone camera at tablet screen from various angles
   - Test detection from each position

2. **Printed Markers Test**:
   - Print markers from `assets/markers/` folder
   - Lay printed markers on a flat surface
   - Test detection from oblique angles
   - Verify nearest-marker selection with multiple markers

3. **Angle Tolerance Test**:
   - Hold phone at various angles (not just perpendicular)
   - Test at 30°, 45°, 60° angles
   - Verify detection works at oblique perspectives

### Expected Behavior

- Camera feed displays smoothly
- Marker detection updates 6-10 times per second
- When marker detected:
  - Green border appears around marker
  - Marker ID displayed (0-7)
  - Position label shown (e.g., "Top-Right")
- When multiple markers visible:
  - Closest marker prioritized
  - Detection switches when moving closer to different marker

## Implementation Notes

### Marker Detection

The current implementation uses a **simplified pattern-matching approach** for marker detection. This is suitable for proof-of-concept and testing.

**For production use**, consider upgrading to a proper AprilTag detection library:
- [apriltag-js](https://github.com/vHeemstra/apriltag-js) - Pure JavaScript AprilTag detector
- [OpenCV.js](https://docs.opencv.org/4.x/d5/d10/tutorial_js_root.html) with AprilTag module - More robust but heavier

### Camera Configuration

The phone view requests camera with these preferences:
- **Facing mode**: `environment` (rear camera)
- **Resolution**: 1280x720 (ideal)
- **Processing**: 640x480 (for performance)

### Performance

- Detection runs at ~10 FPS (configurable in `marker-config.js`)
- Lower for better performance on slow devices
- Higher for more responsive detection

## Browser Compatibility

**Recommended Browsers**:
- Chrome Mobile (Android)
- Safari (iOS)
- Chrome/Firefox (Desktop for testing)

**Requirements**:
- WebRTC support (getUserMedia)
- Canvas 2D context
- ES6 modules support

## Troubleshooting

### Camera Not Working

1. **Check permissions**: Ensure camera access is allowed
2. **Use HTTPS**: Camera requires secure context (HTTPS or localhost)
3. **Check browser**: Use Chrome or Safari
4. **Restart browser**: Sometimes permissions get stuck

### Markers Not Detected

1. **Lighting**: Ensure good lighting conditions
2. **Distance**: Hold phone ~20-40cm from marker
3. **Size**: Markers should be visible but not too small
4. **Focus**: Ensure camera is focused (tap to focus on mobile)
5. **Angle**: Try different angles, but not too extreme (< 60°)

### Multiple Markers Interfering

- The system prioritizes the closest marker by size
- Move phone closer to the desired marker
- Ensure marker fills more of the camera view

## Configuration

Edit `src/marker-config.js` to adjust:

```javascript
// Detection frame rate
FRAME_INTERVAL: 100  // milliseconds (10 FPS)

// Rotation penalties
MEDIUM_PENALTY: 45   // degrees
HIGH_PENALTY: 70     // degrees

// Processing resolution
CANVAS_WIDTH: 640
CANVAS_HEIGHT: 480
```

## Future Enhancements

Potential improvements for production use:

1. **Better Detection Library**: Integrate proper AprilTag library (apriltag-js or OpenCV.js)
2. **Pose Estimation**: Calculate 3D position and orientation
3. **Distance Calculation**: Use marker size for accurate distance
4. **Multi-marker Tracking**: Track multiple markers simultaneously
5. **Calibration**: Camera calibration for better accuracy
6. **WebSocket**: Real-time position updates to server
7. **UI Improvements**: Better visual feedback and controls

## License

MIT

## Credits

Built with:
- Express.js for web server
- Native WebRTC for camera access
- AprilTag-inspired marker design
