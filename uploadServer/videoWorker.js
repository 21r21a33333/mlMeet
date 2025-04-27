import PocketBase from 'pocketbase';
import fetch from 'node-fetch'; // Needed for Node <18
import fs from 'fs';
// Initialize PocketBase
const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');

// In-memory storage for video
let inMemoryVideoBytes = null;

// Function to fetch video data (chunks) from PocketBase
async function fetchVideoData(recordId) {
    try {
      // Fetch the recording from PocketBase
      // where roomName = recordId
      const recordings = await pb.collection('recordings').getFullList(200, {
        filter: `roomName="${recordId}"`,
        expand: 'chunks'
      });
      
      // Check if recordings were found
      if (!recordings || recordings.length === 0) {
        console.log(`[Worker] No recordings found for room: ${recordId}`);
        return;
      }
      
      // Get the first recording
      const recording = recordings[0];
      
      // Check if chunks exist and are expanded
      if (!recording.expand || !recording.expand.chunks || recording.expand.chunks.length === 0) {
        console.log(`[Worker] No chunks found for recording with room: ${recordId}`);
        return;
      }
      
      // Sort chunks by their order
      const chunks = [...recording.expand.chunks].sort((a, b) => a.order - b.order);
      
      // Fetch each chunk and combine them into a single in-memory video buffer
      let videoBuffer = Buffer.alloc(0);
      for (let chunk of chunks) {
        const fileUrl = pb.files.getURL(chunk, chunk.data);
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        videoBuffer = Buffer.concat([videoBuffer, Buffer.from(arrayBuffer)]);
      }

      
      // Store the full video in memory
      inMemoryVideoBytes = videoBuffer;

      


      // Write it to a file
      fs.writeFileSync(`video-${recordId}.mp4`, videoBuffer);
      console.log(`[Worker] Video data for room ${recordId} fetched and stored in memory`);
    } catch (error) {
      console.error('[Worker] Error fetching video data:', error);
    }
  }
// Fetch video data every 2 seconds (adjust timing as needed)
setInterval(() => {
  const recordId = 'common69'; // Replace with dynamic record ID or logic to fetch the right one
  fetchVideoData(recordId);
}, 2000);

// Function to retrieve in-memory video
export function getInMemoryVideoData() {
  return inMemoryVideoBytes;
}
