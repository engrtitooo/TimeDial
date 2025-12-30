
/**
 * ElevenLabs Speech Synthesis Service
 * Optimized for high-fidelity historical character reproduction.
 * Includes Dynamic Voice Discovery to prevent "Voice Not Found" crashes.
 */

let cachedVoices: { voice_id: string; name: string }[] | null = null;

async function fetchAvailableVoices(apiKey: string) {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: { 'xi-api-key': apiKey },
    });
    if (response.ok) {
      const data = await response.json();
      return data.voices || [];
    }
  } catch (e) {
    console.error("Failed to fetch available voices", e);
  }
  return [];
}

export const generateElevenLabsSpeech = async (
  text: string,
  voiceId: string,
  apiKey: string,
  audioContext: AudioContext
): Promise<AudioBuffer | null> => {
  if (!apiKey) {
    throw new Error("ElevenLabs API Key is missing.");
  }

  const cleanText = text
    .replace(/\[\d+\]/g, '') 
    .replace(/\*/g, '')      
    .replace(/#+/g, '')      
    .trim();

  const synthesize = async (vid: string) => {
    console.debug(`[ElevenLabs] Attempting synthesis with Voice ID: ${vid}`);
    return await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });
  };

  try {
    let response = await synthesize(voiceId);

    // DYNAMIC VOICE DISCOVERY: If requested voice is not found (404)
    if (response.status === 404) {
      console.warn(`[ElevenLabs] Requested voice ${voiceId} not found. Fetching account voices...`);
      
      if (!cachedVoices) {
        cachedVoices = await fetchAvailableVoices(apiKey);
      }

      if (cachedVoices && cachedVoices.length > 0) {
        // Find a fallback: either Rachel or just the first available one
        const fallback = cachedVoices.find(v => v.name.toLowerCase() === 'rachel') || cachedVoices[0];
        console.info(`[ElevenLabs] Diverting stream to available voice: ${fallback.name} (${fallback.voice_id})`);
        response = await synthesize(fallback.voice_id);
      } else {
        throw new Error("No voices available in this ElevenLabs account library.");
      }
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({ detail: { message: "Unknown API error" } }));
      const errorMsg = errorJson.detail?.message || `Voice synthesis failed with status ${response.status}`;
      
      if (response.status === 401 || response.status === 429) {
        throw new Error("Insufficient ElevenLabs Credit or Invalid Key.");
      }
      
      throw new Error(errorMsg);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error: any) {
    console.error("ElevenLabs Synthesis Error:", error);
    throw error;
  }
};
