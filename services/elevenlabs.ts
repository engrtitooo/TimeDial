// Service to handle ElevenLabs TTS API
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech

export const generateSpeech = async (
  text: string,
  voiceId: string
): Promise<AudioBuffer | null> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.error("ElevenLabs API Key is missing.");
    return null;
  }

  try {
    // Clean text of citation markers for smoother speech
    const speechText = text.replace(/\[\d+\]/g, '').replace(/\*/g, '');

    // Using Turbo v2.5 for ultra-low latency as per Hackathon requirements
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4`, 
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: speechText,
          model_id: "eleven_turbo_v2_5", 
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("ElevenLabs API Error:", errorData);
      throw new Error(`ElevenLabs request failed: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Decode the MP3 stream
    const audioBuffer = await outputAudioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;

  } catch (error) {
    console.error("ElevenLabs TTS Error:", error);
    return null;
  }
};