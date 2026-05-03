import json
import httpx
from config import GOOGLE_API_KEY, ELEVENLABS_API_KEY
from models import ChatRequest, ChatResponse, SpeechRequest, GroundingSource

# Defensive Import for Gemini
# Defensive Import for Gemini
try:
    # from google import genai
    # HAS_GEMINI = True
    print("DEBUG: Force-disabling Gemini for isolation testing.", flush=True)
    HAS_GEMINI = False
except ImportError as e:
    print(f"CRITICAL WARNING: Could not import google.genai: {e}")
    HAS_GEMINI = False

# --- Gemini Service ---
class GeminiService:
    def __init__(self):
        self.client = None
        if not HAS_GEMINI:
             print("GeminiService: Library missing. Chat disabled.")
             return
             
        if GOOGLE_API_KEY:
            try:
                self.client = genai.Client(api_key=GOOGLE_API_KEY)
                self.model_name = "gemini-2.0-flash-exp"
            except Exception as e:
                print(f"Gemini Client Init Warning: {e}")
                self.client = None
        else:
            print("Gemini Service Warning: GOOGLE_API_KEY not set. Chat will fail.")
            self.client = None

    async def generate_response(self, request: ChatRequest) -> ChatResponse:
        if not self.client:
             return ChatResponse(text="I cannot speak. My mind key (GOOGLE_API_KEY) is missing.", sources=[])
        
        immersive_wrapper = f"""
        Role: {request.system_instruction}
        Constraint: 2 sentences max. No markdown. Never break character.
        """
        
        # Convert history to format expected by Google GenAI SDK if needed, 
        # or pass primarily as contents. The SDK usually expects a specific structure.
        # Based on SDK usage: contents=[...] where items are dicts or Content objects
        
        contents = []
        for msg in request.history:
             contents.append({
                 "role": msg.role,
                 "parts": [{"text": part.text} for part in msg.parts]
             })
        
        contents.append({
            "role": "user",
            "parts": [{"text": request.prompt}]
        })

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
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
                         sources.append(GroundingSource(title=chunk.web.title, url=chunk.web.uri))

            return ChatResponse(text=text, sources=sources)

        except Exception as e:
            print(f"Gemini Service Error: {e}")
            # Identify fallback
            return ChatResponse(
                text="The temporal link is failing. I cannot hear you clearly.",
                sources=[]
            )

# --- Gemini Voice Service ---
class GeminiVoiceService:
    def __init__(self):
        self.api_key = GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY")

    async def generate_speech(self, request: SpeechRequest) -> bytes:
        clean_text = request.text.replace("*", "").strip()
        voice_id = request.voice_id
        
        if not self.api_key:
            raise Exception("GOOGLE_API_KEY missing for speech generation")
            
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            
            voice_map = {
                "UGTtbzgh3HObxRjWaSpr": "Puck",     # Einstein
                "4RZ84U1b4WCqpu57LvIq": "Aoede",    # Cleopatra
                "IRHApOXLvnW57QJPQH2P": "Charon",   # Da Vinci
                "E4IXevHtHpKGh0bvrPPr": "Kore"      # Lovelace
            }
            voice_name = voice_map.get(voice_id, "Fenrir")
            
            response = client.models.generate_content(
                model="gemini-2.0-flash-exp",
                contents=f"Please say exactly this text out loud, with no other words: {clean_text}",
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
                raise Exception("No audio data returned by Gemini.")
                
            if isinstance(audio_data, str):
                import base64
                audio_data = base64.b64decode(audio_data)
                
            return audio_data
            
        except Exception as e:
            print(f"CRITICAL GEMINI VOICE EXCEPTION: {str(e)}", flush=True)
            raise e
