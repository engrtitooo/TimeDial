from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os

# Ensure config is loaded first to validate keys
import config 
from models import ChatRequest, ChatResponse, SpeechRequest
from backend_services import GeminiService, ElevenLabsService

app = FastAPI(title="TimeDial Backend")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
gemini_service = GeminiService()
eleven_service = ElevenLabsService()

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        response = await gemini_service.generate_response(request)
        return response
    except Exception as e:
        print(f"Chat Endpoint Error: {e}")
        # Return the actual error to help with debugging in Cloud Logs
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

import urllib.request
import json
import urllib.error

@app.post("/speech")
async def generate_speech(request: Request):
    try:
        data = await request.json()
        text = data.get("text", "")
        voice_id = data.get("voiceId", "ErXwobaYiN019PkySvjV")
        
        api_key = os.getenv("ELEVENLABS_API_KEY")
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

        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        
        print(f"DEBUG: Successfully sent request to ElevenLabs for text: {text[:20]}...", flush=True)

        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                audio_data = response.read()
                print(f"DEBUG: Successfully read {len(audio_data)} bytes from ElevenLabs", flush=True)
                # Return raw binary content directly
                return Response(
                    content=audio_data, 
                    media_type="audio/mpeg",
                    headers={"Content-Disposition": "attachment; filename=speech.mp3"}
                )
            else:
                return JSONResponse(status_code=response.status, content={"error": "API_REJECTED"})

    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"CRITICAL SERVER ERROR:\n{error_msg}", flush=True)
        return JSONResponse(status_code=500, content={"error": str(e), "trace": error_msg})

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "TimeDial Backend"}

# --- Serve Frontend (Must be last) ---
# Mount static assets (JS/CSS)
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")
else:
    print("WARNING: 'dist' directory not found. Frontend will not be served.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
