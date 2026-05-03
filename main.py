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

@app.get("/debug")
def debug_check():
    """Debug endpoint to verify API keys are set"""
    el_key = os.getenv("ELEVENLABS_API_KEY", "")
    goog_key = os.getenv("GOOGLE_API_KEY", "")
    return {
        "elevenlabs_key_suffix": f"...{el_key[-4:]}" if len(el_key) > 4 else "MISSING/SHORT",
        "google_key_suffix": f"...{goog_key[-4:]}" if len(goog_key) > 4 else "MISSING/SHORT",
        "elevenlabs_key_length": len(el_key),
        "google_key_length": len(goog_key)
    }

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
    """Generate speech with Gemini Voice"""
    try:
        data = await request.json()
        text = data.get("text", "")
        
        print(f"SPEECH: Request received - voiceId: {data.get('voiceId')}", flush=True)
        
        voice_id = str(data.get("voiceId") or "default").strip()
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        
        key_suffix = api_key[-4:] if api_key and len(api_key) > 4 else "MISSING"
        print(f"SPEECH: Using Google key ...{key_suffix}, original voice {voice_id}", flush=True)

        if not api_key:
            print("SPEECH: GOOGLE_API_KEY is missing!", flush=True)
            return JSONResponse(status_code=500, content={"detail": "GOOGLE_API_KEY_MISSING"})

        try:
            from google import genai
        except ImportError as e:
            print(f"SPEECH: Failed to import google.genai: {e}", flush=True)
            return JSONResponse(status_code=500, content={"detail": "Google GenAI library missing"})
            
        client = genai.Client(api_key=api_key)
        
        # Ensure unique voices for each character
        voice_map = {
            "UGTtbzgh3HObxRjWaSpr": "Puck",     # Einstein
            "4RZ84U1b4WCqpu57LvIq": "Aoede",    # Cleopatra
            "IRHApOXLvnW57QJPQH2P": "Charon",   # Da Vinci
            "E4IXevHtHpKGh0bvrPPr": "Kore"      # Lovelace
        }
        voice_name = voice_map.get(voice_id, "Fenrir")
        
        print(f"SPEECH: Mapped to Gemini Voice: {voice_name}", flush=True)

        # Gemini audio generation
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=f"Please say exactly this text out loud, with no other words: {text}",
            config={
                "response_modalities": ["AUDIO"],
                "speech_config": {
                    "voice_config": {
                        "prebuilt_voice_config": {
                            "voice_name": voice_name
                        }
                    }
                }
            }
        )
        
        audio_data = None
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.inline_data:
                    audio_data = part.inline_data.data
                    break
        
        if not audio_data:
            print("SPEECH: No audio returned by Gemini", flush=True)
            return JSONResponse(status_code=500, content={"error": "No audio returned by Gemini"})

        if isinstance(audio_data, str):
            import base64
            audio_data = base64.b64decode(audio_data)

        print(f"SPEECH: Got {len(audio_data)} bytes", flush=True)
        return Response(
            content=audio_data, 
            media_type="audio/wav", 
            headers={"Content-Length": str(len(audio_data)), "Cache-Control": "no-cache"}
        )
            
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