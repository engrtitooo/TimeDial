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
        text = data.get("text", "Hello")
        # Extract Dynamic Voice ID, fallback to Antoni (ErX...) if missing
        voice_id = data.get("voiceId", "ErXwobaYiN019PkySvjV") 
        
        api_key = os.getenv("ELEVENLABS_API_KEY")
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = json.dumps({"text": text, "model_id": "eleven_multilingual_v2"}).encode("utf-8")

        # Calling ElevenLabs
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req) as response:
            audio_data = response.read()
            
            # THE FIX: Direct binary response
            return Response(
                content=audio_data, 
                media_type="audio/mpeg",
                headers={
                    "Content-Type": "audio/mpeg",
                    "Content-Length": str(len(audio_data))
                }
            )

    except Exception as e:
        import traceback
        print(f"DELIVERY ERROR: {traceback.format_exc()}", flush=True)
        return JSONResponse(status_code=500, content={"error": str(e)})

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
