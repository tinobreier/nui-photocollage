// Marker ID to position mapping
// 8 positions: 4 corners + 4 side centers
export const MARKER_POSITIONS = {
  0: 'top-left',
  1: 'top-center',
  2: 'top-right',
  3: 'right-center',
  4: 'bottom-right',
  5: 'bottom-center',
  6: 'bottom-left',
  7: 'left-center'
};

// Human-readable position labels
export const POSITION_LABELS = {
  'top-left': 'Top-Left',
  'top-center': 'Top-Center',
  'top-right': 'Top-Right',
  'right-center': 'Right-Center',
  'bottom-right': 'Bottom-Right',
  'bottom-center': 'Bottom-Center',
  'bottom-left': 'Bottom-Left',
  'left-center': 'Left-Center'
};

// Valid marker IDs
export const VALID_MARKER_IDS = [0, 1, 2, 3, 4, 5, 6, 7];

// Get position label from marker ID
export function getPositionLabel(markerId) {
  const position = MARKER_POSITIONS[markerId];
  return position ? POSITION_LABELS[position] : 'Unknown';
}

// Rotation penalty thresholds (in degrees)
export const ROTATION_THRESHOLDS = {
  MEDIUM_PENALTY: 45,  // Apply 0.7x score multiplier
  HIGH_PENALTY: 70     // Apply 0.5x score multiplier
};

// Detection configuration
export const DETECTION_CONFIG = {
  FRAME_INTERVAL: 100,  // Process every 100ms (10 FPS)
  CANVAS_WIDTH: 640,    // Processing resolution
  CANVAS_HEIGHT: 480
};
