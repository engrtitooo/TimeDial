const BACKEND_URL = '';

export const generateElevenLabsSpeech = async (
  text: string,
  voiceId: string,
  _apiKey: string, // Kept for signature compatibility but ignored
  audioContext: AudioContext
): Promise<AudioBuffer | null> => {

  try {
    const response = await fetch(`${BACKEND_URL}/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voiceId: voiceId
      })
    });

    if (!response.ok) {
      // Try to parse JSON error first
      try {
        const errorData = await response.json();
        const detail = errorData.detail || errorData.error || errorData.trace || JSON.stringify(errorData);
        console.error("Backend Error Detail:", detail);
        throw new Error(`Speech Error (${response.status}): ${detail.substring(0, 200)}...`); // Truncate for UI
      } catch (jsonError) {
        // Fallback to text
        const errorText = await response.text();
        throw new Error(`Speech Error (${response.status}): ${errorText.substring(0, 100)}`);
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log("Audio Buffer received, size:", arrayBuffer.byteLength);

    if (arrayBuffer.byteLength < 100) {
      throw new Error("Received audio data is too small (likely text error).");
    }

    return await audioContext.decodeAudioData(arrayBuffer);

  } catch (error) {
    console.error("Speech Generation Error:", error);
    return null;
  }
};
