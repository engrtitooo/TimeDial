import { GoogleGenAI, Modality } from "@google/genai";
import { GEMINI_MODEL_CHAT, GEMINI_MODEL_IMAGE, GEMINI_MODEL_TTS } from '../constants';
import { GroundingSource } from '../types';

// Safely retrieve the AI instance.
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

interface ChatResponse {
  text: string;
  sources: GroundingSource[];
}

// PCM Audio Decoding Utilities
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodePcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Helper to handle API operations with auto-retry for API Key selection
async function withRetry<T>(operation: () => Promise<T>, fallbackValue: T): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMessage = error?.toString() || "";
    
    const isKeyError = 
      errorMessage.includes("API key") || 
      errorMessage.includes("Requested entity was not found") || 
      errorMessage.includes("403") ||
      errorMessage.includes("404");

    if (
      isKeyError &&
      typeof window !== 'undefined' &&
      window.aistudio
    ) {
      console.warn("API Key issue detected. Triggering selection...");
      try {
        await window.aistudio.openSelectKey();
        return await operation();
      } catch (retryError) {
        console.error("Retry failed after key selection:", retryError);
      }
    }
    
    console.error("Gemini API Error:", error);
    return fallbackValue;
  }
}

// Chat Function with Search Grounding & Thinking Config
export const generateCharacterResponse = async (
  prompt: string,
  systemInstruction: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<ChatResponse> => {
  
  const operation = async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_CHAT,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 16384 } // Enable thinking for deeper historical reasoning
      },
    });

    const text = response.text || "I am lost in thought...";
    
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    chunks.forEach(chunk => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({
          title: chunk.web.title,
          url: chunk.web.uri
        });
      }
    });

    return { text, sources };
  };

  const fallback: ChatResponse = { 
    text: "The connection to the timeline is flickering... please ensure your Temporal Key (API Key) is valid.", 
    sources: [] 
  };

  return withRetry(operation, fallback);
};

// Gemini Native TTS Function
export const generateSpeech = async (
  text: string,
  voiceName: string,
  audioContext: AudioContext
): Promise<AudioBuffer | null> => {
  
  const operation = async () => {
    const ai = getAI();
    // Clean text of citation markers for smoother speech
    const speechText = text.replace(/\[\d+\]/g, '').replace(/\*/g, '');

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_TTS,
      contents: [{ parts: [{ text: speechText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioData = decodeBase64(base64Audio);
      return await decodePcmToAudioBuffer(audioData, audioContext, 24000, 1);
    }
    return null;
  };

  return withRetry(operation, null);
};

// Image Generation Function
export const generatePortrait = async (
  name: string,
  description: string
): Promise<string | null> => {
  
  const operation = async () => {
    const ai = getAI();
    const prompt = `A museum-grade, highly detailed historical oil painting portrait of ${name}, ${description}. Dramatic chiaroscuro lighting, visible brushstrokes, renaissance masterpiece style. Professional color grading.`;
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_IMAGE,
      contents: [
        {
          parts: [
            { text: prompt }
          ],
        },
      ],
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  };

  return withRetry(operation, null);
};