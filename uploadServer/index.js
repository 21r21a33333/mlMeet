import express, { response } from 'express';
import multer from 'multer';
import PocketBase from 'pocketbase';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Needed for Node <18
import  cors from 'cors';
import dotenv from "dotenv";
dotenv.config();

import {
    GoogleGenAI,
    createUserContent,
    createPartFromUri,
  } from "@google/genai";
  


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');
const PORT = process.env.PORT || 8800;


const upload = multer({ dest: 'uploads/' });
app.use(cors())
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Upload endpoint
app.post('/api/record-video', upload.single('video'), async (req, res) => {
    try {
        const { roomName, participantName } = req.body;
        const videoPath = req.file.path;

        let recording;
        try {
            recording = await pb.collection('recordings').getFirstListItem(
                `roomName="${roomName}" && participantName="${participantName}"`,
                { $autoCancel: false }
            );
        } catch {
            recording = await pb.collection('recordings').create({
                roomName,
                participantName,
                chunks: [],
            });
        }

        const fileBuffer = await fs.readFile(videoPath);

        const chunkRecord = await pb.collection('chunks').create({
            recording: recording.id,
            data: new Blob([fileBuffer]),
            order: (recording.chunks?.length || 0) + 1,
        });

        await pb.collection('recordings').update(recording.id, {
            chunks: [...(recording.chunks || []), chunkRecord.id],
        });

        await fs.unlink(videoPath); // Clean up upload

        res.status(200).json({ success: true, recordId: recording.id });
    } catch (error) {
        console.error('Error handling video chunk:', error);
        res.status(500).json({ error: 'Failed to process video chunk' });
    }
});

// delete endpoint
// Upload endpoint
app.delete('/api/recordings/:roomName', async (req, res) => {
    try {
        const { roomName } = req.params;

        // Fetch all recordings with the given roomName
        const recordings = await pb.collection('recordings').getFullList(200, {
            filter: `roomName="${roomName}"`,
        });

        if (!recordings || recordings.length === 0) {
            return res.status(404).json({ error: 'No recordings found for the specified roomName' });
        }

        for (const recording of recordings) {
            // Delete all chunks associated with the recording
            const chunks = await pb.collection('chunks').getFullList(200, {
                filter: `recording="${recording.id}"`,
            });

            for (const chunk of chunks) {
                await pb.collection('chunks').delete(chunk.id);
            }

            // Delete the recording itself
            await pb.collection('recordings').delete(recording.id);
        }

        res.status(200).json({ success: true, message: 'Recordings and associated chunks deleted successfully' });
    } catch (error) {
        console.error('Error deleting recordings:', error);
        res.status(500).json({ error: 'Failed to delete recordings' });
    }
});



/*
5x495xs11qei4i2
380b5ezdy54m569
a2992p509efgf8c
71g42627jl42cud
321tf9n0057a5jt
pr2w5ghs60nw916
*/

// Download endpoint (improved)
app.get('/api/download-video/chunk/:chunkId', async (req, res) => {
    try {
        const { chunkId } = req.params;
        const chunk = await pb.collection('chunks').getOne(chunkId);
        console.log('Chunk:', chunk);

        const fileUrl = pb.files.getURL(chunk, chunk.data);
        const response = await fetch(fileUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch chunk data: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/mp4');
        res.setHeader('Content-Disposition', `attachment; filename=chunk-${chunkId}.webm`);
        res.setHeader('Content-Length', buffer.length);
        
        res.write(buffer); // Write buffer directly to response
        res.end(); // End the response after sending the buffer
        
    } catch (error) {
        console.error('Error downloading video chunk:', error);
        res.status(500).json({ error: 'Failed to download video chunk' });
    }
});

// Download endpoint (improved)
app.get('/api/download-video/:recordId', async (req, res) => {
    try {
        const { recordId } = req.params;

        const recording = await pb.collection('recordings').getOne(recordId, {
            expand: 'chunks',
        });
        console.log('Recording:', recording);

        if (!recording || !Array.isArray(recording.expand?.chunks) || recording.expand.chunks.length === 0) {
            return res.status(404).json({ error: 'Recording not found or has no chunks' });
        }

        const chunks = [...recording.expand.chunks].sort((a, b) => a.order - b.order);

        console.log('Chunks:', chunks);
        res.setHeader('Content-Type', 'video/webm');
        res.setHeader('Content-Disposition', `attachment; filename=recording-${recordId}.webm`);

        let responseBuffer = Buffer.alloc(0); // Initialize an empty buffer to store the response data
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const fileUrl = pb.files.getURL(chunk, chunk.data);
            const response = await fetch(fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer
            res.write(buffer); // Write buffer directly to response
        }

        res.end(); // End after sending all chunks

    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
});


// Download endpoint (improved)
app.get('/api/download-video/:recordId/chunks', async (req, res) => {
    try {
        const { recordId } = req.params;

        const recording = await pb.collection('recordings').getOne(recordId, {
            expand: 'chunks',
        });
        console.log('Recording:', recording);

        if (!recording || !Array.isArray(recording.expand?.chunks) || recording.expand.chunks.length === 0) {
            return res.status(404).json({ error: 'Recording not found or has no chunks' });
        }

        const chunks = [...recording.expand.chunks].sort((a, b) => a.order - b.order);

        console.log('Chunks:', chunks);
        res.json(chunks);
    } catch (error) {
        console.error('Error downloading video:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
});

// Google GenAI setup
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Multer config to store files in /uploads
const upload2 = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB per image
});

// API endpoint
app.post("/generate", upload2.array("images", 5), async (req, res) => {
  const prompt = req.body.prompt;
  const files = req.files;

  if (!prompt || !files || files.length === 0) {
    return res.status(400).json({ error: "At least one image and a prompt are required." });
  }

  try {
    const uploads = [];

    // Upload each image to Gemini
    for (const file of files) {
      const mimeType = file.mimetype;
      const filepath = path.resolve(file.path);

      const uploadedFile = await ai.files.upload({
        file: filepath,
        config: { mimeType },
      });

      uploads.push(createPartFromUri(uploadedFile.uri, uploadedFile.mimeType));
    }

    // Send prompt and uploaded images to Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: createUserContent([...uploads, prompt]),
    });

    // Clean up local uploads
    files.forEach(async file => await fs.unlink(file.path));

    res.json({ response: response.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});


app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});


