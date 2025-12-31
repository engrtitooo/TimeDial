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
    # Verify API Key Availability
    if not os.getenv("ELEVENLABS_API_KEY"):
         print("ERROR: ELEVENLABS_API_KEY is missing inside endpoint check!", flush=True)
         raise HTTPException(status_code=500, detail="Server Configuration Error: Missing Voice API Key")

    try:
        audio_content = await eleven_service.generate_speech(request)
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        print(f"CRITICAL ELEVENLABS ERROR: {str(e)}", flush=True)
        # Return the actual error to the frontend
        raise HTTPException(status_code=500, detail=f"Speech Generation Failed: {str(e)}")

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
