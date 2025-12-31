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
        # Remove any potential whitespace from voiceId
        voice_id = str(data.get("voiceId") or "ozS9N1i8sNqA3YvH014P").strip()
        
        # KEY VERIFICATION LOGIC
        raw_key = os.getenv("ELEVENLABS_API_KEY")
        if not raw_key:
            print("CRITICAL: ELEVENLABS_API_KEY is NULL in environment variables.")
            return JSONResponse(status_code=500, content={"detail": "API_KEY_MISSING_ON_SERVER"})
        
        # Masked logging to verify key in Cloud Run Logs
        clean_key = raw_key.strip()
        print(f"DEBUG: Key found. Starts with '{clean_key[:4]}' and ends with '{clean_key[-4:]}'")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": clean_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = json.dumps({
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        
        try:
            with urllib.request.urlopen(req) as response:
                audio_content = response.read()
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
            error_msg = e.read().decode()
            # If you see 401 here, your key is definitely wrong
            return JSONResponse(
                status_code=e.code, 
                content={"detail": f"ElevenLabs API Error: {e.code}", "raw_response": error_msg}
            )

    except Exception as e:
        return JSONResponse(
            status_code=500, 
            content={"detail": "Internal Crash", "message": str(e), "trace": traceback.format_exc()}
        )

# Serve Frontend
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000)