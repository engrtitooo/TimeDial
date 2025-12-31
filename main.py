"""
MAIN.PY - Lazy Import Version
=============================
All imports are done INSIDE functions to prevent module-level crashes.
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

print("BOOT: Starting TimeDial server (Lazy Import Mode)...", flush=True)

app = FastAPI(title="TimeDial Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/chat")
async def chat_endpoint(request: Request):
    """Chat with Gemini - imports library lazily inside function"""
    try:
        data = await request.json()
        prompt = data.get("prompt", "")
        system_instruction = data.get("system_instruction", "You are a helpful assistant.")
        history = data.get("history", [])
        
        # LAZY IMPORT - only when needed
        try:
            from google import genai
        except ImportError as e:
            print(f"CHAT: Failed to import google.genai: {e}", flush=True)
            return JSONResponse(content={
                "text": "The Gemini library could not be loaded. Please check server logs.",
                "sources": []
            })
        
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        if not api_key:
            print("CHAT: GOOGLE_API_KEY is missing!", flush=True)
            return JSONResponse(content={
                "text": "My mind link is not configured. The keeper must set GOOGLE_API_KEY.",
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
        
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
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
            "text": f"Error: {str(e)[:100]}",
            "sources": []
        })

@app.post("/speech")
async def generate_speech(request: Request):
    """Generate speech with ElevenLabs"""
    try:
        data = await request.json()
        text = data.get("text", "")
        
        print(f"SPEECH: Request received - voiceId: {data.get('voiceId')}", flush=True)
        
        voice_id = str(data.get("voiceId") or "ozS9N1i8sNqA3YvH014P").strip()
        api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
        
        key_suffix = api_key[-4:] if api_key and len(api_key) > 4 else "MISSING"
        print(f"SPEECH: Using key ...{key_suffix}, voice {voice_id}", flush=True)

        if not api_key:
            print("SPEECH: ELEVENLABS_API_KEY is missing!", flush=True)
            return JSONResponse(status_code=500, content={"detail": "ELEVENLABS_API_KEY_MISSING"})

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
        try:
            with urllib.request.urlopen(req) as response:
                audio_data = response.read()
                print(f"SPEECH: Got {len(audio_data)} bytes", flush=True)
                return Response(
                    content=audio_data, 
                    media_type="audio/mpeg", 
                    headers={"Content-Length": str(len(audio_data)), "Cache-Control": "no-cache"}
                )
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"SPEECH ERROR ({e.code}): {error_body}", flush=True)
            return JSONResponse(status_code=e.code, content={"error": f"ElevenLabs: {e.code}", "raw": error_body})
            
    except Exception as e:
        print(f"SPEECH CRASH: {e}", flush=True)
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

# Serve Frontend
if os.path.exists("dist"):
    print("BOOT: Mounting frontend...", flush=True)
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

print("BOOT: Ready!", flush=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"BOOT: Starting on port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)