// Cross-device communication layer
// Supports both BroadcastChannel (same browser) and WebSocket (cross-device)

class Communication {
  constructor() {
    this.listeners = [];
    this.ws = null;
    this.channel = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    this.initBroadcastChannel();
    this.initWebSocket();
  }

  // Initialize BroadcastChannel for same-browser tabs
  initBroadcastChannel() {
    try {
      this.channel = new BroadcastChannel('marker-channel');
      this.channel.onmessage = (event) => {
        console.log('[Communication] BroadcastChannel message:', event.data);
        this.notifyListeners(event.data);
      };
      console.log('[Communication] BroadcastChannel initialized');
    } catch (error) {
      console.warn('[Communication] BroadcastChannel not available:', error);
    }
  }

  // Initialize WebSocket for cross-device communication
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    console.log('[Communication] Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Communication] WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = async (event) => {
        try {
          // Handle both string and Blob data
          let dataString;
          if (event.data instanceof Blob) {
            dataString = await event.data.text();
          } else {
            dataString = event.data;
          }

          const data = JSON.parse(dataString);
          console.log('[Communication] WebSocket message:', data);
          this.notifyListeners(data);
        } catch (error) {
          console.error('[Communication] Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[Communication] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[Communication] WebSocket closed');
        this.handleReconnect();
      };
    } catch (error) {
      console.error('[Communication] Error initializing WebSocket:', error);
    }
  }

  // Handle reconnection
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      console.log(`[Communication] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

      setTimeout(() => {
        this.initWebSocket();
      }, delay);
    } else {
      console.error('[Communication] Max reconnection attempts reached');
    }
  }

  // Send message via both channels
  send(data) {
    console.log('[Communication] Sending message:', data);

    // Send via BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(data);
        console.log('[Communication] Sent via BroadcastChannel');
      } catch (error) {
        console.error('[Communication] Error sending via BroadcastChannel:', error);
      }
    }

    // Send via WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        console.log('[Communication] Sent via WebSocket');
      } catch (error) {
        console.error('[Communication] Error sending via WebSocket:', error);
      }
    } else {
      console.warn('[Communication] WebSocket not ready, message not sent');
    }
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
        console.error('[Communication] Error in listener callback:', error);
      }
    });
  }
}

export default Communication;
