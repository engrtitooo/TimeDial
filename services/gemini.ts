
import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_CHAT, GEMINI_MODEL_IMAGE } from '../constants';
import { GroundingSource } from '../types';

// Safely retrieve the AI instance.
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

interface ChatResponse {
  text: string;
  sources: GroundingSource[];
}

// Helper to handle API operations with auto-retry
async function withRetry<T>(operation: () => Promise<T>, fallbackValue: T): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMessage = error?.toString() || "";
    const isKeyError = errorMessage.includes("API key") || errorMessage.includes("403") || errorMessage.includes("404");

    if (isKeyError && typeof window !== 'undefined' && window.aistudio) {
      console.warn("Gemini API Key issue detected.");
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
    3. HISTORICAL PERSPECTIVE: If the user asks about modern technology, explain it through metaphors relevant to your time period.
    4. NO MARKDOWN: Avoid bolding, bullet points, or citation markers like [1]. Speak naturally.
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
