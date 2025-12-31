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
        data = await request.json()
        text = data.get("text", "")
        # Fallback to Einstein ID if none provided
        voice_id = str(data.get("voiceId") or "ozS9N1i8sNqA3YvH014P").strip()
        
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
            print("CRITICAL: ELEVENLABS_API_KEY is missing from environment variables.")
            return JSONResponse(status_code=500, content={"detail": "API_KEY_MISSING"})

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

        print(f"DEBUG: Sending request to ElevenLabs for voice {voice_id}")
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        
        try:
            with urllib.request.urlopen(req) as response:
                audio_content = response.read()
                print(f"DEBUG: Successfully received {len(audio_content)} bytes of audio")
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
            print(f"ELEVENLABS ERROR ({e.code}): {error_body}")
            return JSONResponse(status_code=e.code, content={"detail": f"ElevenLabs Rejected: {e.code}", "raw": error_body})

    except Exception as e:
        full_trace = traceback.format_exc()
        print(f"BACKEND CRASH:\n{full_trace}")
        return JSONResponse(status_code=500, content={"detail": str(e), "trace": full_trace})

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve Frontend
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

if __name__ == "__main__":
    # REQUIRED: Google Cloud Run sets the PORT env variable
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port)