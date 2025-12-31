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
class ElevenLabsService:
    def __init__(self):
        self.api_key = ELEVENLABS_API_KEY
        self.base_url = "https://api.elevenlabs.io/v1"
        self.cached_voices = []

    async def _fetch_voices(self):
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(
                    f"{self.base_url}/voices",
                    headers={"xi-api-key": self.api_key}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    self.cached_voices = data.get("voices", [])
            except Exception as e:
                print(f"Failed to fetch voices: {e}")

    async def generate_speech(self, request: SpeechRequest) -> bytes:
        clean_text = request.text.replace("*", "").strip()
        
        # Simple cleanup as per original TS
        
        voice_id = request.voice_id
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First attempt
            # DEBUG: Check if API Key exists
            import os
            print(f"DEBUG: ElevenLabs Key loaded? {bool(self.api_key)}", flush=True)

            url = f"{self.base_url}/text-to-speech/{voice_id}"
            payload = {
                "text": clean_text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.75
                }
            }
            headers = {
                "Content-Type": "application/json",
                "xi-api-key": self.api_key
            }

            resp = await client.post(url, json=payload, headers=headers)
            
            print(f"DEBUG: ElevenLabs API Status: {resp.status_code}", flush=True)

            if resp.status_code == 401:
                print("DEBUG: Unauthorized - Invalid API Key", flush=True)
            elif resp.status_code == 429:
                print("DEBUG: Quota Exceeded", flush=True)

            if resp.status_code == 404:
                print(f"Voice {voice_id} not found. Attempting fallback.")
                if not self.cached_voices:
                    await self._fetch_voices()
                
                if self.cached_voices:
                     # Fallback logic: find Rachel or take first
                     fallback = next((v for v in self.cached_voices if v['name'].lower() == 'rachel'), self.cached_voices[0])
                     voice_id = fallback['voice_id']
                     print(f"Redirecting to fallback voice: {fallback['name']}")
                     url = f"{self.base_url}/text-to-speech/{voice_id}"
                     resp = await client.post(url, json=payload, headers=headers)
                else:
                    raise Exception("No voices available.")

            if resp.status_code != 200:
                 error_msg = resp.text
                 print(f"ElevenLabs Error: {resp.status_code} - {error_msg}")
                 raise Exception(f"ElevenLabs API Error: {resp.status_code}")

            print(f"DEBUG: Audio chunk size: {len(resp.content)} bytes", flush=True)
            return resp.content
