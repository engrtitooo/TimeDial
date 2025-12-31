from fastapi import FastAPI, Response, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
import urllib.request
import json
import urllib.error
import traceback

app = FastAPI(title="TimeDial Backend")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/speech")
async def generate_speech(request: Request):
    try:
        # 1. Parse Input
        data = await request.json()
        text = data.get("text", "")
        voice_id = str(data.get("voiceId") or "ozS9N1i8sNqA3YvH014P").strip()
        
        # 2. Get and Clean API Key
        raw_key = os.getenv("ELEVENLABS_API_KEY")
        if not raw_key:
            return JSONResponse(status_code=500, content={"detail": "SERVER_ERROR: API_KEY_MISSING_IN_ENV"})
        
        api_key = raw_key.strip()
        # MASKED LOGGING: Check Google Cloud Logs to verify these match your dashboard key
        print(f"DEBUG AUTH: Key found. Starts with '{api_key[:4]}' and ends with '{api_key[-4:]}'", flush=True)

        # 3. Request Preparation
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

        # 4. Direct API Call
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        
        try:
            with urllib.request.urlopen(req) as response:
                audio_content = response.read()
                
                # 5. Delivery Fix
                return Response(
                    content=audio_content,
                    media_type="audio/mpeg",
                    headers={
                        "Content-Type": "audio/mpeg",
                        "Content-Length": str(len(audio_content)),
                        "Cache-Control": "no-cache"
                    }
                )
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"ELEVENLABS ERROR ({e.code}): {error_body}", flush=True)
            return JSONResponse(
                status_code=e.code, 
                content={"detail": f"ElevenLabs API Error: {e.code}", "api_response": error_body}
            )

    except Exception as e:
        full_trace = traceback.format_exc()
        print(f"BACKEND CRASH:\n{full_trace}", flush=True)
        return JSONResponse(status_code=500, content={"detail": str(e), "trace": full_trace})

# Serve Frontend
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)