require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { initDb } = require('./db/database');
const personasRouter = require('./routes/personas');
const uploadRouter = require('./routes/upload');
const setupCallHandler = require('./websocket/callHandler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());

// API routes
app.use('/api', personasRouter);
app.use('/api', uploadRouter);
app.use('/api', require('./routes/asr'));

// Serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve Vite build output (dist/)
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
  const indexPath = path.join(distDir, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// WebSocket call handler
setupCallHandler(wss);

// Initialize database
initDb();

// Start
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Digital Human Call Platform`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Server] Zhipu API key: ${process.env.ZHIPU_API_KEY ? '✓ configured' : '✗ missing'}`);
  console.log(`[Server] Fish Audio key: ${process.env.FISH_AUDIO_API_KEY ? '✓ configured' : '✗ missing'}`);
  console.log(`[Server] D-ID API key: ${process.env.DID_API_KEY ? '✓ configured' : '✗ missing'}`);
});
