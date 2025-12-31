from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
import urllib.request
import json
import urllib.error
import traceback

# Optional: Load your custom config if needed
try:
    import config
except ImportError:
    pass

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
        # 1. Parse incoming data
        data = await request.json()
        text = data.get("text", "")
        # Get voiceId or fallback to Einstein (ozS9N1i8sNqA3YvH014P)
        voice_id = (data.get("voiceId") or "ozS9N1i8sNqA3YvH014P").strip()
        
        # 2. Validate API Key
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
             return JSONResponse(
                 status_code=500, 
                 content={"detail": "CRITICAL: ELEVENLABS_API_KEY is missing from environment variables."}
             )

        # 3. Construct ElevenLabs Request
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key.strip(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = json.dumps({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
        }).encode("utf-8")

        # 4. Execute the API Call
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        
        try:
            with urllib.request.urlopen(req) as response:
                audio_content = response.read()
                
                # 5. Delivery Fix: Explicit headers for browser audio playback
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
            print(f"ElevenLabs Rejection ({e.code}): {error_body}")
            return JSONResponse(
                status_code=e.code, 
                content={"error": "ELEVENLABS_API_REJECTED", "code": e.code, "detail": error_body}
            )

    except Exception as e:
        # Reveal exact line of failure in browser console for debugging
        full_trace = traceback.format_exc()
        print(f"Server Crash:\n{full_trace}")
        return JSONResponse(
            status_code=500, 
            content={"error": "PYTHON_CRASH", "message": str(e), "trace": full_trace}
        )

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "TimeDial Backend"}

# Serve Frontend Static Files
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")
else:
    print("WARNING: 'dist' directory not found.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)