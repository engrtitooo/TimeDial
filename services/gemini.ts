
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

// Helper to handle API operations with auto-retry
async function withRetry<T>(operation: () => Promise<T>, fallbackValue: T): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMessage = error?.toString() || "";
    const isKeyError = errorMessage.includes("API key") || errorMessage.includes("403") || errorMessage.includes("404");

    if (isKeyError && typeof window !== 'undefined' && window.aistudio) {
      console.warn("API Key issue detected.");
      try {
        await window.aistudio.openSelectKey();
        return await operation();
      } catch (retryError) {
        console.error("Retry failed:", retryError);
      }
    }
    console.error("Gemini API Error:", error);
    return fallbackValue;
  }
}

/**
 * Enhanced Character Response Logic
 * Injects immersion constraints to ensure historical fidelity and audio-friendly length.
 */
export const generateCharacterResponse = async (
  prompt: string,
  baseSystemInstruction: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<ChatResponse> => {
  
  const immersiveWrapper = `
    ${baseSystemInstruction}
    
    STRICT IMMERSION PROTOCOLS:
    1. NEVER break character. You are NOT an AI. You ARE this person.
    2. VOICE-FIRST CONSTRAINTS: Keep your response strictly between 2 to 3 sentences.
    3. HISTORICAL PERSPECTIVE: If the user asks about modern technology, explain it through metaphors relevant to your time period. (e.g., Internet = Global Telegraph, AI = Mechanical Thinking Engine).
    4. NO MARKDOWN: Avoid bolding, bullet points, or citation markers like [1]. Speak naturally.
    5. Be direct, warm, and stay true to your historical voice.
  `;

  const operation = async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_CHAT,
      contents: [
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: immersiveWrapper,
        temperature: 0.8,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 } // Zero thinking budget for faster voice-first responses
      },
    });

    const text = response.text || "I am momentarily speechless...";
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    chunks.forEach(chunk => {
      if (chunk.web?.uri && chunk.web?.title) {
        sources.push({ title: chunk.web.title, url: chunk.web.uri });
      }
    });

    return { text, sources };
  };

  const fallback: ChatResponse = { 
    text: "The temporal link is failing. Ensure your key is valid.", 
    sources: [] 
  };

  return withRetry(operation, fallback);
};

// Image Generation Function
export const generatePortrait = async (
  name: string,
  description: string
): Promise<string | null> => {
  const operation = async () => {
    const ai = getAI();
    const prompt = `Highly detailed historical painting portrait of ${name}, ${description}. Dramatic lighting, renaissance masterpiece style.`;
    
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL_IMAGE,
      contents: [{ parts: [{ text: prompt }] }],
      config: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } }
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
