"""
MAIN.PY - Production Security & AI Model Version
================================================
Enterprise 2FA Authentication, HttpOnly Session Guards, and Gemini 3.1 Pro AI.
"""
import os
import json
import urllib.request
import urllib.error
import traceback
from fastapi import FastAPI, Request, Response, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from auth_security import (
    is_rate_limited,
    generate_challenge,
    verify_challenge,
    create_session_token,
    verify_session_token,
    get_current_session,
    APP_PASSWORD
)
from email_dispatcher import send_2fa_code, mask_email

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@timedial.app").strip()
GEMINI_MODEL_ID = os.getenv("GEMINI_MODEL_ID", "gemini-3.1-pro").strip()

print("BOOT: Starting TimeDial server with Enterprise 2FA & Gemini 3.1 Pro...", flush=True)

app = FastAPI(title="TimeDial Enterprise Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "model": GEMINI_MODEL_ID}

@app.get("/debug")
def debug_check(session: dict = Depends(get_current_session)):
    """Protected Debug endpoint to verify API keys are set."""
    el_key = os.getenv("ELEVENLABS_API_KEY", "")
    goog_key = os.getenv("GOOGLE_API_KEY", "")
    return {
        "elevenlabs_key_suffix": f"...{el_key[-4:]}" if len(el_key) > 4 else "MISSING/SHORT",
        "google_key_suffix": f"...{goog_key[-4:]}" if len(goog_key) > 4 else "MISSING/SHORT",
        "model": GEMINI_MODEL_ID,
        "admin_email": mask_email(ADMIN_EMAIL)
    }

# ==========================================
# 🔑 ENTERPRISE 2FA AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/verify-access")
async def verify_access(request: Request):
    """
    Step 1 (Master Password):
    Verifies master application password against APP_PASSWORD.
    Generates a 6-digit OTP code and dispatches to ADMIN_EMAIL.
    """
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip, "/api/verify-access", max_requests=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed access attempts. Maximum 5 per minute allowed."
        )
        
    try:
        data = await request.json()
        password = data.get("password", "")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")
        
    configured_password = os.getenv("APP_PASSWORD", APP_PASSWORD)
    if not password or password != configured_password:
        raise HTTPException(status_code=401, detail="Invalid master application password.")
        
    # Generate 6-digit OTP challenge
    challenge_token, code = generate_challenge(code_ttl_seconds=300)
    
    # Dispatch code via Email / Resend / Console
    success, msg = send_2fa_code(ADMIN_EMAIL, code)
    
    return {
        "success": True,
        "challengeToken": challenge_token,
        "maskedEmail": mask_email(ADMIN_EMAIL),
        "message": "Verification code dispatched to admin email."
    }

@app.post("/api/verify-2fa")
async def verify_2fa(request: Request, response: Response):
    """
    Step 2 (Email 2FA Verification):
    Verifies the 6-digit OTP code against the challenge token.
    Issues a signed HttpOnly session cookie on success (24-hour TTL).
    """
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip, "/api/verify-2fa", max_requests=5, window_seconds=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many 2FA verification attempts. Maximum 5 per minute allowed."
        )
        
    try:
        data = await request.json()
        challenge_token = data.get("challengeToken", "")
        code = data.get("code", "")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid request body.")
        
    if not challenge_token or not code:
        raise HTTPException(status_code=400, detail="Challenge token and 6-digit verification code are required.")
        
    verified, msg = verify_challenge(challenge_token, code)
    if not verified:
        raise HTTPException(status_code=400, detail=msg)
        
    # Generate 24-hour signed session token
    session_token = create_session_token(sub="admin", ttl_seconds=86400)
    
    # Set HttpOnly, SameSite=Strict, Secure cookie
    # Note: secure=False in development over HTTP if required, or True when HTTPS/prod
    is_secure = request.url.scheme == "https" or os.getenv("NODE_ENV") == "production"
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        samesite="strict",
        secure=is_secure,
        max_age=86400,
        path="/"
    )
    
    return {
        "success": True,
        "token": session_token,  # Also returned for Bearer token fallback if needed
        "message": "2FA Verification successful. Session established."
    }

@app.get("/api/check-auth")
async def check_auth(request: Request):
    """
    Server-side session validator endpoint.
    Validates HttpOnly cookie or Authorization Bearer header.
    """
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            
    if not token:
        return {"authenticated": False}
        
    payload = verify_session_token(token)
    if not payload:
        return {"authenticated": False}
        
    return {"authenticated": True, "user": payload.get("sub", "admin")}

@app.post("/api/logout")
async def logout(response: Response):
    """Logs out the user by invalidating and clearing the HttpOnly session cookie."""
    response.delete_cookie(key="session_token", path="/")
    return {"success": True, "message": "Logged out successfully."}

# ==========================================
# 🤖 PROTECTED AI ENDPOINTS (GEMINI 3.1 PRO)
# ==========================================

async def handle_chat_request(request: Request, session: dict = Depends(get_current_session)):
    """Chat with Gemini 3.1 Pro - protected by session guard"""
    try:
        data = await request.json()
        prompt = data.get("prompt", "")
        system_instruction = data.get("system_instruction", "You are a helpful assistant.")
        history = data.get("history", [])
        
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
            model=GEMINI_MODEL_ID,
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

@app.post("/chat")
@app.post("/api/chat")
async def chat_endpoint(request: Request, session: dict = Depends(get_current_session)):
    return await handle_chat_request(request, session)

async def handle_speech_request(request: Request, session: dict = Depends(get_current_session)):
    """Generate speech with Gemini Voice - protected by session guard"""
    try:
        data = await request.json()
        text = data.get("text", "")
        
        print(f"SPEECH: Request received - voiceId: {data.get('voiceId')}", flush=True)
        
        voice_id = str(data.get("voiceId") or "default").strip()
        api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        
        if not api_key:
            print("SPEECH: GOOGLE_API_KEY is missing!", flush=True)
            return JSONResponse(status_code=500, content={"detail": "GOOGLE_API_KEY_MISSING"})

        try:
            from google import genai
        except ImportError as e:
            print(f"SPEECH: Failed to import google.genai: {e}", flush=True)
            return JSONResponse(status_code=500, content={"detail": "Google GenAI library missing"})
            
        client = genai.Client(api_key=api_key)
        
        voice_map = {
            "UGTtbzgh3HObxRjWaSpr": "Puck",     # Einstein
            "4RZ84U1b4WCqpu57LvIq": "Aoede",    # Cleopatra
            "IRHApOXLvnW57QJPQH2P": "Charon",   # Da Vinci
            "E4IXevHtHpKGh0bvrPPr": "Kore"      # Lovelace
        }
        voice_name = voice_map.get(voice_id, "Fenrir")
        
        print(f"SPEECH: Mapped to Gemini Voice: {voice_name}", flush=True)

        response = client.models.generate_content(
            model="gemini-3.1-flash-tts-preview",
            contents=text,
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

        import io, wave
        with io.BytesIO() as wav_io:
            with wave.open(wav_io, 'wb') as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(24000)
                wav_file.writeframes(audio_data)
            audio_data = wav_io.getvalue()

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

@app.post("/speech")
@app.post("/api/speech")
async def speech_endpoint(request: Request, session: dict = Depends(get_current_session)):
    return await handle_speech_request(request, session)

# Serve Frontend
if os.path.exists("dist"):
    print("BOOT: Mounting frontend...", flush=True)
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")

print(f"BOOT: Server ready with Gemini Model [{GEMINI_MODEL_ID}]!", flush=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"BOOT: Starting on port {port}...", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port)