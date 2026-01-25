// Tablet view - marker display with glow effects
// This page shows all 8 markers and responds to phone confirmations
// Uses Playroom for cross-device communication (GitHub Pages compatible)

import PlayroomCommunication from './playroom-communication.js';

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

const container = document.querySelector('.container');
const connectionStatusElement = document.getElementById('connection-status');
const playerCountElement = document.getElementById('player-count');

// Initialize Playroom communication
let communication = null;

async function init() {
  console.log('[Tablet] Initializing Playroom communication...');
  updateConnectionStatus(false, 'Verbinde...');

  try {
    communication = new PlayroomCommunication({ isHost: true });

    // Set up connection status updates
    communication.onConnectionChange((connected) => {
      updateConnectionStatus(connected);
    });

    // Set up player join/leave handlers
    communication.onPlayerJoin((player) => {
      console.log('[Tablet] Phone connected:', player.id);
      updatePlayerCount();
    });

    communication.onPlayerLeave((player) => {
      console.log('[Tablet] Phone disconnected:', player.id);
      updatePlayerCount();
    });

    // Listen for marker confirmations from phones
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

    await communication.init();
    console.log('[Tablet] Playroom communication initialized');

  } catch (error) {
    console.error('[Tablet] Failed to initialize communication:', error);
    updateConnectionStatus(false, 'Fehler: ' + error.message);
  }
}

function updateConnectionStatus(connected, customText = null) {
  if (!connectionStatusElement) return;

  if (customText) {
    connectionStatusElement.textContent = customText;
    connectionStatusElement.classList.remove('connected', 'disconnected');
    return;
  }

  if (connected) {
    connectionStatusElement.textContent = 'Verbunden';
    connectionStatusElement.classList.add('connected');
    connectionStatusElement.classList.remove('disconnected');
  } else {
    connectionStatusElement.textContent = 'Getrennt';
    connectionStatusElement.classList.remove('connected');
    connectionStatusElement.classList.add('disconnected');
  }
}

function updatePlayerCount() {
  if (!playerCountElement || !communication) return;
  // Subtract 1 to exclude the tablet itself from the count
  const count = Math.max(0, communication.getPlayerCount() - 1);
  playerCountElement.textContent = count;
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
