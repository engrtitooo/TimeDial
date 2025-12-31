from fastapi import FastAPI, HTTPException, Response
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

@app.post("/speech")
async def speech_endpoint(request: SpeechRequest):
    import requests
    import os
    
    # 1. Verify Configuration
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
         print("CRITICAL: ELEVENLABS_API_KEY missing from environment", flush=True)
         raise HTTPException(status_code=500, detail="Server Error: Missing Voice API Key")

    try:
        # 2. Extract Data
        text = request.text.replace("*", "").strip()
        # Fallback to a stable voice (Antoni) if ID is missing or invalid
        voice_id = request.voice_id or "ErXwobaYiN019PkySvjV" 

        # 3. Direct HTTP Request (Bypassing all SDKs)
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5, 
                "similarity_boost": 0.75
            }
        }

        print(f"DEBUG: Generating Speech for VoiceID: {voice_id}", flush=True)
        
        # 4. Synchronous but reliable request
        response = requests.post(url, json=payload, headers=headers)

        # 5. Handle Errors Explicitly
        if response.status_code != 200:
            error_msg = f"ElevenLabs API Error ({response.status_code}): {response.text}"
            print(f"CRITICAL: {error_msg}", flush=True)
            raise HTTPException(status_code=500, detail=error_msg)

        # 6. Return Audio
        print(f"DEBUG: Audio Generated Success ({len(response.content)} bytes)", flush=True)
        return Response(content=response.content, media_type="audio/mpeg")

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"SERVER CRASH: {traceback.format_exc()}", flush=True)
        raise HTTPException(status_code=500, detail=f"Internal Crash: {str(e)}")

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
