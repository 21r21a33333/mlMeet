// VideoPlayer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { X, Video } from 'lucide-react';

interface VideoPlayerProps {
  serverUrl: string; // WebSocket server URL
  isParticipant?: boolean; // Whether this is shown as a participant in a conference
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  serverUrl, 
  isParticipant = true
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Connect to WebSocket server
  const connectWebSocket = () => {
    setError(null);
    
    // Close existing connection if any
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
    
    // Create new WebSocket connection
    const wsUrl = serverUrl.replace(/^http/, 'ws');
    const socket = new WebSocket(wsUrl);
    ws.current = socket;
    
    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected');
    };
    
    socket.onclose = (event) => {
      setIsConnected(false);
      console.log('WebSocket disconnected', event.code, event.reason);
      
      // Try to reconnect after delay
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('Attempting to reconnect...');
        connectWebSocket();
      }, 3000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error');
    };
    
    socket.onmessage = (event) => {
      handleWebSocketMessage(event.data);
    };
  };
  
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = (messageData: string) => {
    try {
      const message = JSON.parse(messageData);
      
      switch (message.type) {
        case 'videoData':
          handleVideoData(message);
          break;
        case 'error':
          setError(message.message || 'Server error');
          setIsLoading(false);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      setError('Failed to process server response');
      setIsLoading(false);
    }
  };
  
  // Process video data received from server
  const handleVideoData = (message: { data: string, mimeType: string }) => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(message.data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      const blob = new Blob(byteArrays, { type: message.mimeType || 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      // Update video source
      setVideoSrc(url);
      setIsLoading(false);
      
      // Auto-play video if browser allows
      if (videoRef.current) {
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play().catch(e => {
            console.warn('Auto-play prevented:', e);
          });
        };
      }
    } catch (error) {
      console.error('Error processing video data:', error);
      setError('Failed to process video data');
      setIsLoading(false);
    }
  };
  
  // Request video from server
  const handleRequestVideo = () => {
    if (!isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to server');
      return;
    }
    
    // Clean up previous video if any
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
      setVideoSrc(null);
    }
    
    setIsLoading(true);
    setError(null);
    
    // Send request message without specifying a video name
    ws.current.send(JSON.stringify({
      type: 'requestVideo'
    }));
  };

  // Toggle minimized state
  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
  };

  // Expand from minimized state
  const expandVideo = () => {
    setIsMinimized(false);
  };
  
  // Connect WebSocket on component mount
  useEffect(() => {
    connectWebSocket();
    
    // Clean up on unmount
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Clean up video URL if any
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [serverUrl]); // Reconnect if server URL changes
  
  // Render the minimized floating button
  if (isMinimized) {
    return (
      <div 
        className="floating-video-button"
        onClick={expandVideo}
        title="Expand video"
      >
        <Video size={24} />
        <style jsx>{`
          .floating-video-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background-color: #0070f3;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            transition: all 0.3s ease;
          }
          .floating-video-button:hover {
            transform: scale(1.1);
            background-color: #0060d3;
          }
        `}</style>
      </div>
    );
  }

  // Main component render
  return (
    <div className={`video-player-container ${isParticipant ? 'participant-style' : ''}`}>
      <div className="video-header">
        <h3>{isParticipant ? 'Conference Participant' : 'Video Player'}</h3>
        <button 
          className="minimize-button" 
          onClick={toggleMinimized}
          aria-label="Minimize"
        >
          <X size={20} />
        </button>
      </div>

      <div className="video-wrapper">
        {videoSrc ? (
          <video 
            ref={videoRef}
            src={videoSrc}
            controls
            className="video-element"
            onEnded={() => {
              if (videoSrc) URL.revokeObjectURL(videoSrc);
            }}
          />
        ) : (
          <div className="video-placeholder">
            {isLoading ? 'Loading video...' : 'Click the button to load video'}
          </div>
        )}
      </div>
      
      <div className="controls">
        <button 
          onClick={handleRequestVideo} 
          disabled={!isConnected || isLoading}
          className={`request-button ${!isConnected || isLoading ? 'disabled' : ''}`}
        >
          {isLoading ? 'Loading...' : 'Request Video'}
        </button>
        
        <div className="status">
          {isConnected ? (
            <span className="status-connected">Connected to server</span>
          ) : (
            <span className="status-disconnected">Disconnected from server</span>
          )}
          
          {error && (
            <span className="status-error">{error}</span>
          )}
        </div>
      </div>
      
      <style jsx>{`
        .video-player-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 15px;
          background-color: #1a1a1a;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          color: white;
        }
        
        .participant-style {
          width: 100%;
          height: 100%;
          margin: 0;
          background-color: #1a1a1a;
          border-radius: 0;
          box-shadow: none;
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 100;
          display: flex;
          flex-direction: column;
        }

        .video-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .minimize-button {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 5px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s;
        }

        .minimize-button:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .video-wrapper {
          width: 100%;
          background-color: #000;
          position: relative;
          border-radius: 4px;
          overflow: hidden;
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
        }
        
        .video-element {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        
        .video-placeholder {
          color: #ccc;
          text-align: center;
          padding: 20px;
          font-size: 18px;
        }
        
        .controls {
          margin-top: 15px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .request-button {
          padding: 10px 20px;
          background-color: #0070f3;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
          min-width: 150px;
        }
        
        .request-button:hover:not(.disabled) {
          background-color: #0060d3;
        }
        
        .request-button.disabled {
          background-color: #555;
          cursor: not-allowed;
        }
        
        .status {
          margin-top: 15px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          font-size: 14px;
        }
        
        .status-connected {
          color: #4caf50;
        }
        
        .status-disconnected {
          color: #f44336;
        }
        
        .status-error {
          color: #f44336;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;