
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
    console.error("ElevenLabs API Key is missing.");
    return null;
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
        model_id: 'eleven_turbo_v2_5', // Upgraded for lower latency
        voice_settings: {
          stability: 0.65,      // Slightly higher stability for historical weight
          similarity_boost: 0.8, // Maximum character likeness
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail?.message || "Voice engine failed.");
    }

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("ElevenLabs Synthesis Error:", error);
    return null;
  }
};
