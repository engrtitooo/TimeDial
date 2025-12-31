"""
MAIN.PY - Full Mode with Safe Gemini Import
============================================
Voice works + Chat works (with safe Gemini import)
"""
import os
import json
import urllib.request
import urllib.error
import traceback
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

print("BOOT: Starting TimeDial server...", flush=True)

app = FastAPI(title="TimeDial Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Safe Gemini Import ---
gemini_client = None
try:
    from google import genai
    api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if api_key:
        gemini_client = genai.Client(api_key=api_key)
        print("BOOT: Gemini client initialized successfully.", flush=True)
    else:
        print("BOOT WARNING: GOOGLE_API_KEY missing, chat disabled.", flush=True)
except ImportError as e:
    print(f"BOOT WARNING: Could not import google.genai: {e}", flush=True)
except Exception as e:
    print(f"BOOT WARNING: Gemini init failed: {e}", flush=True)

@app.get("/health")
def health_check():
    return {"status": "ok", "gemini": gemini_client is not None}

@app.post("/chat")
async def chat_endpoint(request: Request):
    try:
        data = await request.json()
        prompt = data.get("prompt", "")
        system_instruction = data.get("system_instruction", "You are a helpful assistant.")
        history = data.get("history", [])
        
        if not gemini_client:
            return JSONResponse(content={
                "text": "The temporal link is being repaired. Please try again later.",
                "sources": []
            })
        
        # Build contents
        contents = []
        for msg in history:
            contents.append({
                "role": msg.get("role", "user"),
                "parts": [{"text": p.get("text", "")} for p in msg.get("parts", [])]
            })
        contents.append({"role": "user", "parts": [{"text": prompt}]})
        
        immersive_wrapper = f"""
        Role: {system_instruction}
        Constraint: 2 sentences max. No markdown. Never break character.
        """
        
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=contents,
            config={
                "system_instruction": immersive_wrapper,
                "temperature": 0.7,
                "tools": [{"google_search": {}}]
            }
        )
        
        text = response.text or "I am momentarily speechless..."
        
        sources = []
        if response.candidates and response.candidates[0].grounding_metadata:
            chunks = response.candidates[0].grounding_metadata.grounding_chunks or []
            for chunk in chunks:
                if chunk.web and chunk.web.uri and chunk.web.title:
                    sources.append({"title": chunk.web.title, "url": chunk.web.uri})
        
        return JSONResponse(content={"text": text, "sources": sources})
        
    except Exception as e:
        print(f"CHAT ERROR: {e}", flush=True)
        traceback.print_exc()
        return JSONResponse(content={
            "text": "The temporal link is failing. I cannot hear you clearly.",
            "sources": []
        })

@app.post("/speech")
async def generate_speech(request: Request):
    try:
        data = await request.json()
        text = data.get("text", "")
        
        print(f"DEBUG: Received speech request: {data}", flush=True)
        
        request_voice_id = data.get("voiceId")
        print(f"DEBUG: Frontend sent voiceId: '{request_voice_id}'", flush=True)

        voice_id = str(request_voice_id or "ozS9N1i8sNqA3YvH014P").strip()
        print(f"DEBUG: Final voiceId used: '{voice_id}'", flush=True)

        api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        
        key_suffix = api_key[-4:] if api_key and len(api_key) > 4 else "MISSING"
        print(f"DEBUG: Using key ending in ...{key_suffix}", flush=True)

        if not api_key:
            print("CRITICAL: ELEVENLABS_API_KEY is missing!", flush=True)
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

        print(f"DEBUG: Calling ElevenLabs for voice {voice_id}...", flush=True)
        
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

# Serve Frontend
if os.path.exists("dist"):
    print("BOOT: Mounting frontend from dist/", flush=True)
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

print("BOOT: App ready, starting uvicorn...", flush=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"BOOT: Binding to port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)