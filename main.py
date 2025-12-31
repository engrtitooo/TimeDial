"""
MAIN.PY - Voice Only Mode
=========================
This file has voice working (ElevenLabs) but chat disabled (Gemini crashed).
"""
import os
import json
import urllib.request
import urllib.error
import traceback
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

print("BOOT: Starting Voice-Only server...", flush=True)

app = FastAPI(title="TimeDial Backend - Voice Only Mode")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "mode": "voice_only"}

@app.post("/chat")
async def chat_endpoint():
    # Chat disabled - Gemini library crashing container
    return JSONResponse(
        status_code=503,
        content={"text": "The temporal link is undergoing maintenance. Voice still works!", "sources": []}
    )

@app.post("/speech")
async def generate_speech(request: Request):
    try:
        data = await request.json()
        text = data.get("text", "")
        
        print(f"DEBUG: Received speech request: {data}", flush=True)
        
        request_voice_id = data.get("voiceId")
        print(f"DEBUG: Frontend sent voiceId: '{request_voice_id}'", flush=True)

        voice_id = str(request_voice_id or "ozS9N1i8sNqA3YvH014P").strip()
        print(f"DEBUG: Final voiceId used: '{voice_id}'", flush=True)

        api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        
        key_suffix = api_key[-4:] if api_key and len(api_key) > 4 else "MISSING"
        print(f"DEBUG: Using key ending in ...{key_suffix}", flush=True)

        if not api_key:
            print("CRITICAL: ELEVENLABS_API_KEY is missing!", flush=True)
            return JSONResponse(status_code=500, content={"detail": "API_KEY_MISSING_ON_SERVER"})

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = json.dumps({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
        }).encode("utf-8")

        print(f"DEBUG: Calling ElevenLabs for voice {voice_id}...", flush=True)
        
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as response:
                audio_data = response.read()
                print(f"DEBUG: Received {len(audio_data)} bytes of audio", flush=True)
                return Response(
                    content=audio_data, 
                    media_type="audio/mpeg", 
                    headers={
                        "Content-Length": str(len(audio_data)),
                        "Cache-Control": "no-cache"
                    }
                )
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"ELEVENLABS API ERROR ({e.code}): {error_body}", flush=True)
            return JSONResponse(status_code=e.code, content={"error": f"ElevenLabs Rejected: {e.code}", "raw": error_body})
            
    except Exception as e:
        full_trace = traceback.format_exc()
        print(f"BACKEND CRASH:\n{full_trace}", flush=True)
        return JSONResponse(status_code=500, content={"error": str(e), "trace": full_trace})

# Serve Frontend
if os.path.exists("dist"):
    print("BOOT: Mounting frontend from dist/", flush=True)
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

print("BOOT: App ready, starting uvicorn...", flush=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"BOOT: Binding to port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)