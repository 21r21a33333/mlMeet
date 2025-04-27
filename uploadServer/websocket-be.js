// server.js - Express server with WebSocket support using ES modules
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import {getInMemoryVideoData} from "./videoWorker.js"; // Adjust the path as needed


// ES modules don't have __dirname, so we need to create it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Enable CORS for API requests from React app
app.use(cors());

// Simple API endpoint to verify server is running
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Handle messages from clients
  ws.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (error) {
      console.error('Error parsing message:', error);
      return;
    }

    // Handle request for video
    if (msg.type === 'requestVideo') {
      console.log('Video requested');
      try {
        const videoBuffer = getInMemoryVideoData();
        if (!videoBuffer) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Video not available' }));
        }
        console.log('videoBuffer', videoBuffer);
        ws.send(JSON.stringify({
          type: 'videoData',
          data: videoBuffer.toString('base64'),
          mimeType: 'video/mp4' // Adjust MIME type as needed
        }));

        console.log('Video sent to client');
      } catch (error) {
        console.error('Error reading video file:', error);

        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to read video file'
        }));
      }
    }
  });

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Set port and start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});