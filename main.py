import os
import json
import urllib.request
import urllib.error
import traceback
from fastapi import FastAPI, Response, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

# Config and Services (Keep existing chat functionality)
import config 
from models import ChatRequest, ChatResponse, SpeechRequest
from backend_services import GeminiService

app = FastAPI(title="TimeDial Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
gemini_service = GeminiService()

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        response = await gemini_service.generate_response(request)
        return response
    except Exception as e:
        print(f"Chat Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/speech")
async def generate_speech(request: Request):
    try:
        data = await request.json()
        text = data.get("text", "")
        # DEBUGGING: Print exact received data
        print(f"DEBUG: Received JSON: {data}", flush=True)
        
        request_voice_id = data.get("voiceId")
        print(f"DEBUG: Frontend sent voiceId: '{request_voice_id}'", flush=True)

        voice_id = str(request_voice_id or "ozS9N1i8sNqA3YvH014P").strip()
        print(f"DEBUG: Final voiceId used for API call: '{voice_id}'", flush=True)

        api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        
        # Log key mask for debugging (visible in Cloud Run Logs)
        key_suffix = api_key[-4:] if api_key and len(api_key) > 4 else "MISSING"
        print(f"DEBUG: Using key ending in ...{key_suffix}", flush=True)

        if not api_key:
             print("CRITICAL: ELEVENLABS_API_KEY is missing from environment variables.")
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

        print(f"DEBUG: Sending request to ElevenLabs for voice {voice_id}", flush=True)
        
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

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve Frontend
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

if __name__ == "__main__":
    # Dynamic Port Logic for Cloud Run
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting server on port {port}...", flush=True)
    uvicorn.run("main:app", host="0.0.0.0", port=port)
```