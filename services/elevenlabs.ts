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
      const errorText = await response.text();
      throw new Error(`Speech Error (${response.status}): ${errorText}`);
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
