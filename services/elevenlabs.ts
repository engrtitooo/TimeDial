
/**
 * ElevenLabs Speech Synthesis Service
 * Optimized for high-fidelity historical character reproduction.
 */

export const generateElevenLabsSpeech = async (
  text: string,
  voiceId: string,
  apiKey: string,
  audioContext: AudioContext
): Promise<AudioBuffer | null> => {
  if (!apiKey) {
    throw new Error("ElevenLabs API Key is missing. Please add it in settings.");
  }

  try {
    // Clean text: strip markdown, citations, and non-verbal symbols
    const cleanText = text
      .replace(/\[\d+\]/g, '') // Remove [1], [2] etc
      .replace(/\*/g, '')      // Remove bold/italic stars
      .replace(/#+/g, '')      // Remove headers
      .trim();

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2', // More reliable fallback than turbo
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ detail: { message: "Unknown API error" } }));
      const errorMsg = errorJson.detail?.message || `Voice synthesis failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error: any) {
    console.error("ElevenLabs Synthesis Error:", error);
    throw error; // Rethrow to let App.tsx handle UI display
  }
};
