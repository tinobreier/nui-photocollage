// Playroom-based communication layer
// Replaces WebSocket communication for GitHub Pages compatibility
// Uses a fixed roomCode for automatic connection without QR codes or room IDs
// Uses RPC (Remote Procedure Calls) for real-time messaging between devices

// Room configuration
const ROOM_CODE = "NUI-2026-PHOTOCOLLAGE";

// Helper function to load Playroom SDK via script tag
function loadPlayroomSDK() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Playroom) {
      console.log('[Playroom] SDK already loaded');
      resolve(window.Playroom);
      return;
    }

    const script = document.createElement('script');
    // Use full bundle that includes all dependencies (React, etc.)
    script.src = 'https://unpkg.com/playroomkit@0.0.95/multiplayer.full.umd.js';
    script.onload = () => {
      console.log('[Playroom] SDK loaded via script tag');
      // Playroom is now available as window.Playroom
      resolve(window.Playroom);
    };
    script.onerror = (err) => {
      reject(new Error('Failed to load Playroom SDK'));
    };
    document.head.appendChild(script);
  });
}

class PlayroomCommunication {
  constructor(options = {}) {
    this.listeners = [];
    this.isHost = options.isHost || false;
    this.isConnected = false;
    this.players = new Map();
    this.onConnectionChangeCallbacks = [];
    this.onPlayerJoinCallbacks = [];
    this.onPlayerLeaveCallbacks = [];

    // Will be set after Playroom is loaded
    this.Playroom = null;
    this.RPC = null;
  }

  // Initialize Playroom connection
  async init() {
    try {
      console.log('[Playroom] Loading Playroom SDK...');

      // Load Playroom via script tag (UMD build)
      const Playroom = await loadPlayroomSDK();

      const { insertCoin, onPlayerJoin, isHost, myPlayer, getState, setState, onDisconnect, RPC } = Playroom;

      this.Playroom = { insertCoin, onPlayerJoin, isHost, myPlayer, getState, setState, onDisconnect };
      this.RPC = RPC;

      console.log('[Playroom] Joining room with code:', ROOM_CODE);

      // Join the room with fixed room code
      // Note: gameId is only required for Discord Activities, not for regular web games
      await insertCoin({
        roomCode: ROOM_CODE,
        skipLobby: true, // Skip the lobby screen, connect immediately
        maxPlayersPerRoom: 9, // 1 tablet + 8 phones
      });

      this.isConnected = true;
      console.log('[Playroom] Connected! Is host:', isHost());

      // Register RPC handler for marker confirmations
      // All clients register this handler, but typically only the tablet will process it
      RPC.register('marker-confirmed', (data, sender) => {
        console.log('[Playroom] RPC received marker-confirmed from:', sender.id, data);
        this.notifyListeners({
          type: 'marker-confirmed',
          markerId: data.markerId,
          position: data.position,
          playerId: sender.id
        });
        return 'ok';
      });

      // Set up player join/leave handlers
      onPlayerJoin((player) => {
        console.log('[Playroom] Player joined:', player.id);
        this.players.set(player.id, player);

        // Listen for player leaving
        player.onQuit(() => {
          console.log('[Playroom] Player left:', player.id);
          this.players.delete(player.id);
          this.onPlayerLeaveCallbacks.forEach(cb => cb(player));
        });

        this.onPlayerJoinCallbacks.forEach(cb => cb(player));
      });

      // Handle disconnection
      onDisconnect(() => {
        console.log('[Playroom] Disconnected from room');
        this.isConnected = false;
        this.notifyConnectionChange(false);
      });

      this.notifyConnectionChange(true);
      return true;

    } catch (error) {
      console.error('[Playroom] Failed to initialize:', error);
      this.isConnected = false;
      this.notifyConnectionChange(false);
      throw error;
    }
  }

  // Send marker confirmation (from phone to tablet)
  sendMarkerConfirmation(markerId, position) {
    if (!this.isConnected || !this.RPC) {
      console.warn('[Playroom] Not connected, cannot send marker confirmation');
      return false;
    }

    console.log('[Playroom] Sending marker confirmation via RPC:', markerId, position);

    // Use RPC to send to all other players (tablet will receive this)
    this.RPC.call('marker-confirmed', {
      markerId,
      position,
      timestamp: Date.now()
    }, this.RPC.Mode.OTHERS);

    return true;
  }

  // Legacy send method for compatibility
  send(data) {
    if (data.type === 'marker-confirmed') {
      return this.sendMarkerConfirmation(data.markerId, data.position);
    }
    console.warn('[Playroom] Unknown message type:', data.type);
    return false;
  }

  // Add message listener
  onMessage(callback) {
    this.listeners.push(callback);
  }

  // Notify all listeners
  notifyListeners(data) {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('[Playroom] Error in listener callback:', error);
      }
    });
  }

  // Connection state change callbacks
  onConnectionChange(callback) {
    this.onConnectionChangeCallbacks.push(callback);
    // Call immediately with current state
    callback(this.isConnected);
  }

  notifyConnectionChange(connected) {
    this.onConnectionChangeCallbacks.forEach(cb => cb(connected));
  }

  // Player join/leave callbacks
  onPlayerJoin(callback) {
    this.onPlayerJoinCallbacks.push(callback);
  }

  onPlayerLeave(callback) {
    this.onPlayerLeaveCallbacks.push(callback);
  }

  // Get connected player count
  getPlayerCount() {
    return this.players.size;
  }

  // Check if connected
  getIsConnected() {
    return this.isConnected;
  }

  // Check if this client is the host (first to join)
  getIsHost() {
    return this.Playroom ? this.Playroom.isHost() : false;
  }
}

export default PlayroomCommunication;
export { ROOM_CODE };
