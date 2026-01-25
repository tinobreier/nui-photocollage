// Tablet view - marker display with glow effects
// This page shows all 8 markers and responds to phone confirmations

import Communication from './communication.js';

console.log('Tablet view loaded');
console.log('Displaying 8 AprilTag markers at positions:');
console.log('- ID 0: Top-Left');
console.log('- ID 1: Top-Center');
console.log('- ID 2: Top-Right');
console.log('- ID 3: Right-Center');
console.log('- ID 4: Bottom-Right');
console.log('- ID 5: Bottom-Center');
console.log('- ID 6: Bottom-Left');
console.log('- ID 7: Left-Center');

// Initialize communication layer
const communication = new Communication();
const container = document.querySelector('.container');

// Listen for marker confirmations from phone
communication.onMessage((data) => {
  console.log('[Tablet] Received message:', data);

  if (data.type === 'marker-confirmed') {
    const position = data.position;
    console.log('[Tablet] Marker confirmed at position:', position);

    // Remove all previous glow classes
    container.classList.remove(
      'glow-top-left',
      'glow-top-center',
      'glow-top-right',
      'glow-right-center',
      'glow-bottom-right',
      'glow-bottom-center',
      'glow-bottom-left',
      'glow-left-center'
    );

    // Add glow class for confirmed position
    container.classList.add(`glow-${position}`);

    console.log('[Tablet] Applied glow effect:', `glow-${position}`);

    // Remove glow after 3 seconds
    setTimeout(() => {
      container.classList.remove(`glow-${position}`);
      console.log('[Tablet] Removed glow effect');
    }, 3000);
  }
});

console.log('[Tablet] Communication listener initialized');
