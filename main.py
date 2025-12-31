from fastapi import FastAPI, HTTPException, Response, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
import urllib.request
import json
import urllib.error
import traceback # ضروري جداً لكشف الأخطاء المخفية

# Ensure config is loaded first to validate keys
import config 
from models import ChatRequest, ChatResponse, SpeechRequest
from backend_services import GeminiService, ElevenLabsService

app = FastAPI(title="TimeDial Backend")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Services
gemini_service = GeminiService()

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    try:
        response = await gemini_service.generate_response(request)
        return response
    except Exception as e:
        print(f"Chat Endpoint Error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/speech")
async def generate_speech(request: Request):
    try:
        # 1. استلام البيانات من الفرونت-اند
        data = await request.json()
        text = data.get("text", "")
        # التأكد من تنظيف الـ ID من أي مسافات زائدة
        voice_id = (data.get("voiceId") or "ozS9N1i8sNqA3YvH014P").strip() 
        
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
             return JSONResponse(status_code=500, content={"error": "ELEVENLABS_API_KEY_MISSING"})

        # 2. إعداد الرابط والبيانات (Direct HTTP Request)
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

        # 3. محاولة الاتصال بـ ElevenLabs
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        
        try:
            with urllib.request.urlopen(req) as response:
                audio_content = response.read() 
                
                # الرد بالملف الصوتي مع تحديد الطول والنوع بدقة لمنع انهيار المتصفح
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
            # إذا رفضت ElevenLabs الطلب (مثل انتهاء الرصيد أو مفتاح خطأ)
            error_body = e.read().decode()
            print(f"ElevenLabs API Error: {error_body}")
            return JSONResponse(status_code=e.code, content={"error": "ELEVENLABS_REJECTED", "detail": error_body})

    except Exception as e:
        # التقاط الانهيار البرمجي وإرسال تفاصيله كاملة للمتصفح
        full_trace = traceback.format_exc()
        print(f"CRITICAL BACKEND ERROR:\n{full_trace}")
        return JSONResponse(
            status_code=500, 
            content={"error": "PYTHON_CRASH", "message": str(e), "trace": full_trace}
        )

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "TimeDial Backend"}

# --- Serve Frontend (Must be last) ---
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="static")
else:
    print("WARNING: 'dist' directory not found. Frontend will not be served.")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)