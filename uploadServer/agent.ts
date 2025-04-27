import {
  // RemoteParticipant,
  // RemoteTrack,
  // RemoteTrackPublication,
  Room,
  RoomEvent,
  // dispose,
} from '@livekit/rtc-node';



let url = 'https://442b-183-82-8-164.ngrok-free.app/'
let token ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDU3MjQxNDMsImlzcyI6ImRldmtleSIsIm5hbWUiOiJ0ZXN0X3VzZXIiLCJuYmYiOjE3NDU2Mzc3NDMsInN1YiI6InRlc3RfdXNlciIsInZpZGVvIjp7InJvb20iOiJ0ZXN0Iiwicm9vbUpvaW4iOnRydWV9fQ.821WaOYCN_jW67llOkGhv7qmu0u4obnWbUTwAlRFMZ8"
const room = new Room();
await room.connect(url, token, { autoSubscribe: true, dynacast: true });
console.log('connected to room', room);

// add event listeners
room
  .on(RoomEvent.TrackSubscribed, ()=>{console.log('TrackSubscribed')})
  .on(RoomEvent.Disconnected, ()=>{console.log('Disconnected')})
  .on(RoomEvent.LocalTrackPublished, ()=>{
    room.localParticipant?.registerRpcMethod('activeSpeakers', (speakers) => {
      console.log('activeSpeakers', speakers);
      let isUserActiveSpeaker=false;
      console.log('speakers', speakers.localParticipant);
      console.log("remoteParticipants", room.remoteParticipants);
    })   
  });


  let agent= "agent"
  let user="host"
// room.on(RoomEvent.ActiveSpeakersChanged,()=>{
//    room.localParticipant?.registerRpcMethod('activeSpeakers', (speakers) => {
//     // console.log('activeSpeakers', speakers);
//     let isUserActiveSpeaker=false;
//     console.log('speakers', speakers.localParticipant);
//     console.log("remoteParticipants", room.remoteParticipants);
    
//   });
// })