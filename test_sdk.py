import os
import sys

# Test SDK
try:
    from google import genai
    api_key = os.getenv("GOOGLE_API_KEY")
    client = genai.Client(api_key=api_key)
    
    response = client.models.generate_content(
        model="gemini-3.1-pro-preview",
        contents="Say hello",
        config={
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": "Puck"
                    }
                }
            }
        }
    )
    
    parts = response.candidates[0].content.parts
    print(f"Parts count: {len(parts)}")
    for i, part in enumerate(parts):
        print(f"Part {i} keys/attributes:")
        print(dir(part))
        if hasattr(part, 'inline_data') and part.inline_data:
            print(f" inline_data exists: {type(part.inline_data)}")
        elif hasattr(part, 'text') and part.text:
            print(f" text exists: {len(part.text)} chars")
            
except Exception as e:
    import traceback
    traceback.print_exc()
