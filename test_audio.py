import os
from google import genai

api_key = os.getenv("GOOGLE_API_KEY")
print("API Key exists:", bool(api_key))

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-3.1-pro",
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
    
    audio_data = None
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            audio_data = part.inline_data.data
            break
            
    if audio_data:
        print("Success! Got audio bytes:", type(audio_data), len(audio_data))
        if isinstance(audio_data, str):
            print("It is a string! Needs base64 decoding.")
        elif isinstance(audio_data, bytes):
            print("It is bytes! Ready to serve.")
    else:
        print("No audio data returned.")

except Exception as e:
    import traceback
    traceback.print_exc()
    print("Failed to generate with gemini-3.1-pro. Trying another model...")
