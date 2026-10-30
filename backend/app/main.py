"""FastAPI entry point for Sahayak."""

import asyncio
import json
import os
import ssl
from typing import Literal
from urllib.parse import urlencode

import httpx
import websockets
import certifi
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from starlette.responses import StreamingResponse

from app.data_loader import load_schemes
from app.eligibility import evaluate_eligibility


load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# This voice is listed in Chariot's own TTS API example. It can speak Hindi;
# the ID is public configuration, while the API key stays in backend/.env.
CHARIOT_TTS_VOICE_ID = "3c763516-1d51-4d0a-b328-57b5507fb20b"
CHARIOT_API_BASE = "https://api.chariot.in"


class InterviewAnswers(BaseModel):
    """Small, non-identifying set of answers used for an in-memory assessment."""

    model_config = ConfigDict(extra="forbid")

    farming: Literal["yes", "no", "unsure"] = "unsure"
    farmer_type: Literal[
        "owner_cultivator",
        "tenant_sharecropper",
        "farmer_group",
        "other",
        "unsure",
    ] = "unsure"
    land_records: Literal["yes", "no", "unsure"] = "unsure"
    state: str | None = Field(default=None, max_length=50)
    crop_season: str | None = Field(default=None, max_length=120)
    notification: Literal["yes", "no", "unsure"] = "unsure"


class EligibilityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answers: InterviewAnswers


class SpeechRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=1000)
    language: Literal["hi", "en", "pa"] = "hi"

app = FastAPI(
    title="Sahayak API",
    description="A voice-first assistant for discovering government schemes.",
    version="0.1.0",
)

allowed_origins = [
    origin.strip()
    for origin in os.getenv("SAHAYAK_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["service"])
def health_check() -> dict[str, str | int | bool]:
    """Report API availability and how many scheme records are curated."""
    return {
        "status": "ok",
        "service": "sahayak-api",
        "scheme_records": len(load_schemes()),
        "speech_configured": bool(os.getenv("CHARIOT_API_KEY")),
    }


@app.get("/api/schemes", tags=["schemes"])
def list_schemes() -> list[dict]:
    """Return reviewed scheme data and its official information sources."""
    return load_schemes()


@app.post("/api/eligibility", tags=["eligibility"])
def assess_eligibility(payload: EligibilityRequest) -> dict:
    """Assess up to three curated schemes; the API does not persist answers."""
    answers = payload.answers.model_dump()
    return evaluate_eligibility(answers)


@app.post("/api/speech/synthesize", tags=["speech"])
async def synthesize_speech(payload: SpeechRequest) -> StreamingResponse:
    """Stream Chariot PCM to the browser without exposing the backend API key."""
    api_key = os.getenv("CHARIOT_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Speech service is not configured.")

    client = httpx.AsyncClient(
        timeout=httpx.Timeout(45, connect=10),
        verify=certifi.where(),
    )
    try:
        request = client.build_request(
            "POST",
            f"{CHARIOT_API_BASE}/v1/tts/stream",
            headers={"chariotai-api-key": api_key, "Content-Type": "application/json"},
            json={
                "voice_id": CHARIOT_TTS_VOICE_ID,
                "text": payload.text,
                "model_type": "chariot-multilingual-v1",
            },
        )
        response = await client.send(request, stream=True)
    except httpx.HTTPError:
        await client.aclose()
        raise HTTPException(status_code=502, detail="Speech generation is temporarily unavailable.") from None

    if response.status_code >= 400:
        await response.aclose()
        await client.aclose()
        raise HTTPException(status_code=502, detail="Speech generation is temporarily unavailable.")

    async def audio_chunks():
        try:
            async for chunk in response.aiter_bytes(chunk_size=4096):
                if chunk:
                    yield chunk
        finally:
            await response.aclose()
            await client.aclose()

    return StreamingResponse(
        audio_chunks(),
        media_type="audio/L16",
        headers={
            "Cache-Control": "no-store",
            "X-Audio-Sample-Rate": "44100",
            "X-Audio-Channels": "1",
            "X-Audio-Format": "s16le",
            "X-Accel-Buffering": "no",
        },
    )


@app.websocket("/api/speech/transcribe")
async def transcribe_speech(websocket: WebSocket) -> None:
    """Relay raw 16 kHz PCM between the browser and Chariot ASR."""
    api_key = os.getenv("CHARIOT_API_KEY")
    await websocket.accept()
    if not api_key:
        await websocket.send_json({"type": "error", "message": "Speech service is not configured."})
        await websocket.close(code=1011)
        return

    requested_language = websocket.query_params.get("language", "hi")
    language = requested_language if requested_language in {"en", "hi", "pa"} else "hi"
    options = {
        "language": language,
        "audio_format": "pcm_16000",
        "mode": "balanced",
        # Native keeps English speech in Latin script. Hindi uses codemix so
        # borrowed English words remain readable in their original script.
        "style": "codemix" if language == "hi" else "native",
    }
    url = f"{CHARIOT_API_BASE.replace('https://', 'wss://')}/v1/asr/ws?{urlencode(options)}"

    try:
        async with websockets.connect(
            url,
            additional_headers={"chariotai-api-key": api_key},
            open_timeout=15,
            max_size=None,
            ssl=ssl.create_default_context(cafile=certifi.where()),
        ) as chariot:
            started = json.loads(await asyncio.wait_for(chariot.recv(), timeout=15))
            if started.get("type") != "session.started":
                await websocket.send_json({"type": "error", "message": "Speech recognition could not start."})
                await websocket.close(code=1011)
                return

            await websocket.send_json({"type": "ready"})

            async def send_audio() -> bool:
                while True:
                    message = await websocket.receive()
                    if message["type"] == "websocket.disconnect":
                        return False
                    if message.get("bytes") is not None:
                        if len(message["bytes"]) > 256_000:
                            await websocket.send_json({"type": "error", "message": "Audio chunk was too large."})
                            return False
                        await chariot.send(message["bytes"])
                    elif message.get("text"):
                        try:
                            control = json.loads(message["text"])
                        except json.JSONDecodeError:
                            continue
                        if control.get("type") == "input.done":
                            await chariot.send(json.dumps({"type": "input.done"}))
                            return True

            async def send_transcript() -> None:
                async for message in chariot:
                    if not isinstance(message, str):
                        continue
                    event = json.loads(message)
                    event_type = event.get("type")
                    if event_type == "error":
                        await websocket.send_json({"type": "error", "message": "Speech recognition failed. Please try again or type your answer."})
                        return
                    if event_type in {"transcript.delta", "transcript.done"}:
                        await websocket.send_json(event)
                    if event_type == "transcript.done":
                        return

            audio_task = asyncio.create_task(send_audio())
            transcript_task = asyncio.create_task(send_transcript())
            done, pending = await asyncio.wait(
                {audio_task, transcript_task}, return_when=asyncio.FIRST_COMPLETED
            )
            if audio_task in done and audio_task.result() and not transcript_task.done():
                await transcript_task
            elif not transcript_task.done():
                transcript_task.cancel()
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                if not task.cancelled() and task.exception() is not None:
                    raise task.exception()
    except WebSocketDisconnect:
        return
    except Exception:
        # Do not expose upstream URLs, headers, or provider error bodies to the client.
        try:
            await websocket.send_json({"type": "error", "message": "Speech service connection failed. Please try again or type your answer."})
            await websocket.close(code=1011)
        except Exception:
            pass
