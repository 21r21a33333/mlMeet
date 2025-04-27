from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import google, deepgram, silero
from livekit import rtc
import asyncio
from livekit.rtc import TrackKind, Track, VideoStream, VideoBufferType
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from livekit.agents import (
    AgentSession,
    Agent,
    RoomInputOptions,
    function_tool,
    get_job_context,
    RunContext,
)
import logging
import av
import numpy as np

WIDTH = 640
HEIGHT = 480

load_dotenv()

logger = logging.getLogger("video-recorder")


class HindiTranslatorAgent(Agent):
    def __init__(self) -> None:
        super().__init__(instructions="""you are just going to resppond to user everytime and stop recording immediately""")
        
    async def on_enter(self):
        job_ctx = get_job_context()
        self.video_track = job_ctx.user_data.get("video_track")
        if self.video_track:
            print("Video track found, starting recording...")
            self.video_task = asyncio.create_task(self.record_video(self.video_track))

    @function_tool()
    async def stop_recording_immediately(self, context: RunContext):
        await self.stop_recording()


    async def stop_recording(self):
        if self.video_task:
            self.video_task.cancel()
            try:
                await self.video_task
            except asyncio.CancelledError:
                pass
        logger.info("Recording manually stopped.")

    async def record_video(self, track: Track, output_path="recorded_session.mp4"):
        if track.kind != TrackKind.KIND_VIDEO:
            return

        try:
            container = av.open(output_path, mode='w')
            stream = container.add_stream("libx264", rate=15)
            stream.width = 640
            stream.height = 480
            stream.pix_fmt = "yuv420p"

            video_stream = VideoStream(track)

            async for event in video_stream:
                frame = event.frame
                if frame is None:
                    continue

                converted = frame.convert(VideoBufferType.BGRA)
                img_bgra = np.frombuffer(converted.data, dtype=np.uint8).reshape(
                    (converted.height, converted.width, 4)
                )
                img_bgr = img_bgra[:, :, :3]
                video_frame = av.VideoFrame.from_ndarray(img_bgr, format="bgr24")

                for packet in stream.encode(video_frame):
                    container.mux(packet)
        except asyncio.CancelledError:
            logger.info("Video recording cancelled.")
        finally:
            if 'stream' in locals():
                for packet in stream.encode():
                    container.mux(packet)
            if 'container' in locals():
                container.close()

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()
    ctx.user_data = {
        "video_track": None
    }
    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind == TrackKind.KIND_VIDEO:
            ctx.user_data["video_track"] = track
    

    print(f"Connected to room: {ctx.room.name}")

    # Setup a fake video feed with a solid color
    source = rtc.VideoSource(WIDTH, HEIGHT)
    track = rtc.LocalVideoTrack.create_video_track("example-track", source)

    options = rtc.TrackPublishOptions(
        source=rtc.TrackSource.SOURCE_CAMERA,
        simulcast=True,
        video_encoding=rtc.VideoEncoding(
            max_framerate=30,
            max_bitrate=3_000_000,
        ),
        video_codec=rtc.VideoCodec.H264,
    )

    await ctx.agent.publish_track(track, options)

    # Red color frame loop
    COLOR = [255, 255, 0, 0]  # ARGB: red

    async def _draw_color():
        argb_frame = bytearray(WIDTH * HEIGHT * 4)
        while True:
            await asyncio.sleep(0.1)
            argb_frame[:] = COLOR * WIDTH * HEIGHT
            frame = rtc.VideoFrame(WIDTH, HEIGHT, rtc.VideoBufferType.RGBA, argb_frame)
            source.capture_frame(frame)

    asyncio.create_task(_draw_color())

    # Set up the agent session
    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="multi"),
        llm=google.beta.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice="Puck",
            temperature=0.5,
            instructions="Translate user input into Hindi.",
        ),
        tts=google.TTS(),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await session.start(
        room=ctx.room,
        agent=HindiTranslatorAgent(),
        room_input_options=RoomInputOptions(),  # Removed noise_cancellation to avoid cloud error
    )

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
