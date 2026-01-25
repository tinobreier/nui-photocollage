const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Special handler for WASM files MUST come BEFORE static middleware
app.get('/lib/*.wasm', (req, res) => {
  const wasmPath = path.join(__dirname, 'public', req.path);
  console.log('WASM request:', req.path, '→', wasmPath);

  // Check if file exists first
  if (!fs.existsSync(wasmPath)) {
    console.error('WASM file not found:', wasmPath);
    res.status(404).send('WASM file not found');
    return;
  }

  // Read and send the file manually to ensure correct content-type
  fs.readFile(wasmPath, (err, data) => {
    if (err) {
      console.error('Error reading WASM file:', err);
      res.status(500).send('Error reading WASM file');
      return;
    }
    console.log('Sending WASM file, size:', data.length, 'bytes');

    // Set headers to prevent caching and ensure binary transfer
    res.setHeader('Content-Type', 'application/wasm');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Length', data.length);

    // Send as buffer to ensure binary data
    res.end(data, 'binary');
  });
});

// Serve static files
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/lib', express.static(path.join(__dirname, 'public/lib')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/phone', (req, res) => {
  res.sendFile(path.join(__dirname, 'phone.html'));
});

app.get('/tablet', (req, res) => {
  res.sendFile(path.join(__dirname, 'tablet.html'));
});

app.get('/debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug.html'));
});

app.get('/phone-simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'phone-simple.html'));
});

// Load SSL certificate
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
};

// Start HTTPS server
const server = https.createServer(sslOptions, app);

// WebSocket server for cross-device communication
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('[WebSocket] Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[WebSocket] Received:', data);

      // Broadcast to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
          console.log('[WebSocket] Broadcasted to client');
        }
      });
    } catch (error) {
      console.error('[WebSocket] Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[WebSocket] Error:', error);
  });
});

server.listen(HTTPS_PORT, () => {
  console.log('='.repeat(60));
  console.log('HTTPS Server running!');
  console.log('='.repeat(60));
  console.log(`Local:  https://localhost:${HTTPS_PORT}`);
  console.log('');
  console.log('On your phone/tablet, use your computer\'s IP address:');
  console.log(`Network: https://[YOUR-IP]:${HTTPS_PORT}`);
  console.log('');
  console.log('Routes:');
  console.log(`  Phone:  https://[YOUR-IP]:${HTTPS_PORT}/phone`);
  console.log(`  Tablet: https://[YOUR-IP]:${HTTPS_PORT}/tablet`);
  console.log(`  Debug:  https://[YOUR-IP]:${HTTPS_PORT}/debug`);
  console.log('');
  console.log('⚠️  IMPORTANT: First time, accept the certificate warning!');
  console.log('='.repeat(60));
  console.log('[WebSocket] Server ready for cross-device communication');
});
