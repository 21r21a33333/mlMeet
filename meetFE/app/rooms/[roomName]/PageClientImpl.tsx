'use client';

import { decodePassphrase } from '@/lib/client-utils';
import { DebugMode } from '@/lib/Debug';
import { RecordingIndicator } from '@/lib/RecordingIndicator';
import { SettingsMenu } from '@/lib/SettingsMenu';
import { ConnectionDetails } from '@/lib/types';
import FloatingButton from "@/components/FloatingButton";
import ScreenshotModal from "@/components/ScreenshotModal"
import VideoPlayer from '@/components/VideoLayout';


const serverUrl =  'https://spicy-showers-do.loca.lt';

import {
  formatChatMessageLinks,
  LocalUserChoices,
  PreJoin,
  RoomContext,
  VideoConference,
} from '@livekit/components-react';
import {
  ExternalE2EEKeyProvider,
  RoomOptions,
  VideoCodec,
  VideoPresets,
  Room,
  DeviceUnsupportedError,
  RoomConnectOptions,
  RoomEvent,
} from 'livekit-client';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

const CONN_DETAILS_ENDPOINT =
  process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? '/api/connection-details';
const SHOW_SETTINGS_MENU = process.env.NEXT_PUBLIC_SHOW_SETTINGS_MENU == 'true';
const RECORDING_ENDPOINT = '/api/record-video';
const DOWNLOAD_ENDPOINT_PREFIX = '/api/download-video/';

function setInlocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
}
function getFromlocalStorage(key: string) {
  return localStorage.getItem(key);
}

export function PageClientImpl(props: {
  roomName: string;
  region?: string;
  hq: boolean;
  codec: VideoCodec;
}) {
  const [preJoinChoices, setPreJoinChoices] = React.useState<LocalUserChoices | undefined>(
    undefined,
  );
  const preJoinDefaults = React.useMemo(() => {
    return {
      username: '',
      videoEnabled: true,
      audioEnabled: true,
    };
  }, []);
  const [connectionDetails, setConnectionDetails] = React.useState<ConnectionDetails | undefined>(
    undefined,
  );

  const handlePreJoinSubmit = React.useCallback(async (values: LocalUserChoices) => {
    setPreJoinChoices(values);
    const url = new URL(CONN_DETAILS_ENDPOINT, window.location.origin);
    url.searchParams.append('roomName', props.roomName);
    url.searchParams.append('participantName', values.username);
    if (props.region) {
      url.searchParams.append('region', props.region);
    }
    const connectionDetailsResp = await fetch(url.toString());
    const connectionDetailsData = await connectionDetailsResp.json();
    setConnectionDetails(connectionDetailsData);
  }, []);
  const handlePreJoinError = React.useCallback((e: any) => console.error(e), []);

  return (
    <main data-lk-theme="default" style={{ height: '100%' }}>
      {connectionDetails === undefined || preJoinChoices === undefined ? (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <PreJoin
            defaults={preJoinDefaults}
            onSubmit={handlePreJoinSubmit}
            onError={handlePreJoinError}
          />
        </div>
      ) : (
        <VideoConferenceComponent
          connectionDetails={connectionDetails}
          userChoices={preJoinChoices}
          options={{ codec: props.codec, hq: props.hq }}
        />
      )}
    </main>
  );
}

function VideoConferenceComponent(props: {
  userChoices: LocalUserChoices;
  connectionDetails: ConnectionDetails;
  options: {
    hq: boolean;
    codec: VideoCodec;
  };
}) {
  const [isRecordingEnabled, setIsRecordingEnabled] = React.useState(false);
  const [isRemovePrevRecording,setIsRemovePrevRecording]=React.useState(false);
  const e2eePassphrase =
    typeof window !== 'undefined' && decodePassphrase(location.hash.substring(1));

  const worker =
    typeof window !== 'undefined' &&
    e2eePassphrase &&
    new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
  const e2eeEnabled = !!(e2eePassphrase && worker);
  const keyProvider = new ExternalE2EEKeyProvider();
  const [e2eeSetupComplete, setE2eeSetupComplete] = React.useState(false);

  const roomOptions = React.useMemo((): RoomOptions => {
    let videoCodec: VideoCodec | undefined = props.options.codec ? props.options.codec : 'vp9';
    if (e2eeEnabled && (videoCodec === 'av1' || videoCodec === 'vp9')) {
      videoCodec = undefined;
    }
    return {
      videoCaptureDefaults: {
        deviceId: props.userChoices.videoDeviceId ?? undefined,
        resolution: props.options.hq ? VideoPresets.h2160 : VideoPresets.h720,
      },
      publishDefaults: {
        dtx: false,
        videoSimulcastLayers: props.options.hq
          ? [VideoPresets.h1080, VideoPresets.h720]
          : [VideoPresets.h540, VideoPresets.h216],
        red: !e2eeEnabled,
        videoCodec,
      },
      audioCaptureDefaults: {
        deviceId: props.userChoices.audioDeviceId ?? undefined,
      },
      adaptiveStream: { pixelDensity: 'screen' },
      dynacast: true,
      e2ee: e2eeEnabled
        ? {
            keyProvider,
            worker,
          }
        : undefined,
    };
  }, [props.userChoices, props.options.hq, props.options.codec]);

  const room = React.useMemo(() => new Room(roomOptions), []);

  React.useEffect(() => {
    if (e2eeEnabled) {
      keyProvider
        .setKey(decodePassphrase(e2eePassphrase))
        .then(() => {
          room.setE2EEEnabled(true).catch((e) => {
            if (e instanceof DeviceUnsupportedError) {
              alert(
                `You're trying to join an encrypted meeting, but your browser does not support it. Please update it to the latest version and try again.`,
              );
              console.error(e);
            } else {
              throw e;
            }
          });
        })
        .then(() => setE2eeSetupComplete(true));
    } else {
      setE2eeSetupComplete(true);
    }
  }, [e2eeEnabled, room, e2eePassphrase]);

  const connectOptions = React.useMemo((): RoomConnectOptions => {
    return {
      autoSubscribe: true,
    };
  }, []);

  React.useEffect(() => {
    room.on(RoomEvent.Disconnected, handleOnLeave);
    room.on(RoomEvent.EncryptionError, handleEncryptionError);
    room.on(RoomEvent.MediaDevicesError, handleError);
    room.on(RoomEvent.ActiveSpeakersChanged, () => {
      const pastActiveSpeakers = getFromlocalStorage('pastActiveSpeakers');
      if (room.activeSpeakers.length > 0) {
        const activeSpeaker = room.activeSpeakers[0].identity;
        if (activeSpeaker != pastActiveSpeakers) {
          if (activeSpeaker.toLocaleLowerCase().includes('agent')) {
            setIsRecordingEnabled(false);
          } else {
            setIsRemovePrevRecording(true);
            setIsRecordingEnabled(true);
          }
          setInlocalStorage('pastActiveSpeakers', activeSpeaker);
        } else if (activeSpeaker.toLocaleLowerCase().includes('host')){
          setIsRecordingEnabled(true);
        }
      } 
    });
    if (e2eeSetupComplete) {
      room
        .connect(
          props.connectionDetails.serverUrl,
          props.connectionDetails.participantToken,
          connectOptions,
        )
        .catch((error) => {
          handleError(error);
        });
      if (props.userChoices.videoEnabled) {
        room.localParticipant.setCameraEnabled(true).catch((error) => {
          handleError(error);
        });
      }
      if (props.userChoices.audioEnabled) {
        room.localParticipant.setMicrophoneEnabled(true).catch((error) => {
          handleError(error);
        });
      }
    }
    return () => {
      room.off(RoomEvent.Disconnected, handleOnLeave);
      room.off(RoomEvent.EncryptionError, handleEncryptionError);
      room.off(RoomEvent.MediaDevicesError, handleError);
    };
  }, [e2eeSetupComplete, room, props.connectionDetails, props.userChoices]);

  const router = useRouter();
  const handleOnLeave = React.useCallback(() => router.push('/'), [router]);
  const handleError = React.useCallback((error: Error) => {
    console.error(error);
    alert(`Encountered an unexpected error, check the console logs for details: ${error.message}`);
  }, []);
  const handleEncryptionError = React.useCallback((error: Error) => {
    console.error(error);
    alert(
      `Encountered an unexpected encryption error, check the console logs for details: ${error.message}`,
    );
  }, []);
    const [screenshots, setScreenshots] = useState<string[]>([]); // Store screenshots
    const [isModalOpen, setModalOpen] = useState(false); // Modal visibility
  
    // Handle the captured screenshot
    const handleCapture = (img: string) => {
      console.log("Captured image:", img); // Log the captured image
      setScreenshots((prev) => [...prev, img]); // Add captured image to state
      setModalOpen(true); // Open the modal to show the captured screenshots
    };
  return (
    <div className="lk-room-container">
      {/* Floating Button for Triggering Screenshot Capture  */}
            <FloatingButton onCapture={handleCapture} />
      
            {/* {/ Screenshot Modal */}
            <ScreenshotModal
              isOpen={isModalOpen}
              onClose={() => setModalOpen(false)} // Close modal
              screenshots={screenshots}
              setScreenshots={setScreenshots} // Update screenshots
            />
      <RoomContext.Provider value={room}>
      <div className="player-wrapper">
          <VideoPlayer serverUrl={serverUrl} />
        </div>
        <HandleUploadOrDownload
          isRecordingEnabled={isRecordingEnabled}
          isRemovePrevRecording={isRemovePrevRecording}
        />
        <VideoConference
          chatMessageFormatter={formatChatMessageLinks}
          SettingsComponent={SHOW_SETTINGS_MENU ? SettingsMenu : undefined}
        />
        <DebugMode />
        <RecordingIndicator />
      </RoomContext.Provider>
    </div>
  );
}
function HandleUploadOrDownload(props: {
  isRecordingEnabled: boolean;
  isRemovePrevRecording: boolean;
}) {
  const { isRecordingEnabled, isRemovePrevRecording } = props;
  const [mediaRecorder, setMediaRecorder] = React.useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = React.useState<Blob[]>([]);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const room = React.useContext(RoomContext);

  const currentParticipant = room?.localParticipant;
  const roomName = room?.name;
  const participantName = currentParticipant?.name;

  // Start recording when isRecordingEnabled becomes true
  React.useEffect(() => {
    if (isRecordingEnabled && !mediaRecorder) {
      const videoTrack = currentParticipant?.getTrackPublications()
        .find((pub) => pub.kind === 'video')?.track?.mediaStreamTrack;

      
      if (videoTrack ) {
        const combinedStream = new MediaStream([videoTrack]);
        setStream(combinedStream);

        const recorder = new MediaRecorder(combinedStream, {
          mimeType: 'video/mp4',
        });

        const localChunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            console.log("ondataavailable", e.data);
            localChunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
            const fullBlob = new Blob(localChunks, { type: 'video/mp4' });
          console.log("fullBlob", fullBlob);
          const formData = new FormData();
          formData.append('video', fullBlob);
          formData.append('roomName', roomName || 'default_room');
          formData.append('participantName', participantName || 'host');

          try {
            const res = await fetch('https://2d8c-183-82-8-164.ngrok-free.app/api/record-video', {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            console.log('Uploaded:', data.recordId);
            setInlocalStorage('recordId', data.recordId);
          } catch (error) {
            console.error('Upload error:', error);
          }

          // Clean up
          setChunks([]);
          setMediaRecorder(null);
          stream?.getTracks().forEach((t) => t.stop());
          setStream(null);
        };

        recorder.start();
        setMediaRecorder(recorder);
      }
    }

    // Stop recording if recording flag becomes false
    if (!isRecordingEnabled && mediaRecorder) {
      mediaRecorder.stop();
    }
  }, [isRecordingEnabled]);

  // Optionally delete previous recording (when speaker switches)
  React.useEffect(() => {
    if (isRemovePrevRecording && roomName) {
      fetch(`https://2d8c-183-82-8-164.ngrok-free.app/api/recordings/${roomName}`, {
        method: 'DELETE',
      })
        .then((res) => res.json())
        .then((data) => console.log('Previous recording deleted:', data))
        .catch((err) => console.error('Failed to delete previous recording:', err));
    }
  }, [isRemovePrevRecording]);

  return null;
}





  
 
    // <div className="container">
    //   <Head>
    //     <title>WebSocket Video Player</title>
    //     <meta name="description" content="WebSocket video streaming example" />
    //     <link rel="icon" href="/favicon.ico" />
    //   </Head>

    //   <main className="main">
    //     <h1 className="title">
    //       WebSocket Video Streaming
    //     </h1>

    //     <p className="description">
    //       Click the button below to request and stream a video from the server
    //     </p>

        
    //   </main>

    //   <style jsx>{`
    //     .container {
    //       min-height: 100vh;
    //       padding: 0 0.5rem;
    //       display: flex;
    //       flex-direction: column;
    //       justify-content: center;
    //       align-items: center;
    //     }

    //     .main {
    //       padding: 4rem 0;
    //       flex: 1;
    //       display: flex;
    //       flex-direction: column;
    //       justify-content: center;
    //       align-items: center;
    //       width: 100%;
    //       max-width: 1200px;
    //     }

    //     .title {
    //       margin: 0;
    //       line-height: 1.15;
    //       font-size: 3rem;
    //       text-align: center;
    //     }

    //     .description {
    //       margin: 1rem 0 2rem;
    //       line-height: 1.5;
    //       font-size: 1.5rem;
    //       text-align: center;
    //     }

    //     .player-wrapper {
    //       width: 100%;
    //       max-width: 800px;
    //     }
    //   `}</style>
    // </div>
 
