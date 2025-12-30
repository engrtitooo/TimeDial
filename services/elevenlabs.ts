const BACKEND_URL = 'http://localhost:8000';

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
        voice_id: voiceId
      })
    });

    if (!response.ok) {
      throw new Error(`Speech Backend Error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);

  } catch (error) {
    console.error("Speech Generation Error:", error);
    return null;
  }
};
