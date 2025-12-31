import json
import httpx
from google import genai
from config import GOOGLE_API_KEY, ELEVENLABS_API_KEY
from models import ChatRequest, ChatResponse, SpeechRequest, GroundingSource

# --- Gemini Service ---
class GeminiService:
    def __init__(self):
        self.client = genai.Client(api_key=GOOGLE_API_KEY)
        self.model_name = "gemini-2.0-flash-exp" # Using a fast model as per original code implications
        # Note: Original code imported GEMINI_MODEL_CHAT from constants. 
        # Ideally we'd mirror that or stick to a known working model.
        # Let's assume a standard capable model.

    async def generate_response(self, request: ChatRequest) -> ChatResponse:
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

# --- ElevenLabs Service ---
# --- ElevenLabs Service ---
import requests
import os

class ElevenLabsService:
    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY or os.getenv("ELEVENLABS_API_KEY")

    async def generate_speech(self, request: SpeechRequest) -> bytes:
        clean_text = request.text.replace("*", "").strip()
        voice_id = request.voice_id
        
        # Use direct HTTP request to avoid SDK version issues
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "xi-api-key": self.api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "text": clean_text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5, 
                "similarity_boost": 0.75
            }
        }

        try:
            print(f"DEBUG: Calling ElevenLabs API (Direct Request) for Voice {voice_id}", flush=True)
            # Use requests (sync) but it's reliable. 
            # In a full prod app we should wrap in run_in_executor, but for hackathon this works.
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code != 200:
                print(f"CRITICAL ELEVENLABS ERROR {response.status_code}: {response.text}", flush=True)
                raise Exception(f"Voice API Error ({response.status_code}): {response.text}")

            audio_data = response.content
            print(f"DEBUG: Generated Audio Size: {len(audio_data)} bytes", flush=True)
            return audio_data

        except Exception as e:
            print(f"CRITICAL ELEVENLABS EXCEPTION: {str(e)}", flush=True)
            raise e
