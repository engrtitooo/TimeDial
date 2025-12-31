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

# Initialize Services (Global placeholder)
gemini_service = None

@app.on_event("startup")
async def startup_event():
    global gemini_service
    print("STARTUP: Initializing backend services...", flush=True)
    try:
        gemini_service = GeminiService()
        print("STARTUP: GeminiService initialized successfully.", flush=True)
    except Exception as e:
        print(f"STARTUP ERROR: Failed to init GeminiService: {e}", flush=True)
        # We do NOT exit here, to keep the container alive for logs/health checks

# --- NUCLEAR OPTION: MINIMAL SERVER ---
# @app.post("/chat", response_model=ChatResponse)
# async def chat_endpoint(request: ChatRequest):
#     raise HTTPException(status_code=503, detail="Maintenance Mode")

# @app.post("/speech")
# async def generate_speech(request: Request):
#      raise HTTPException(status_code=503, detail="Maintenance Mode")

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
    uvicorn.run(app, host="0.0.0.0", port=port)
```