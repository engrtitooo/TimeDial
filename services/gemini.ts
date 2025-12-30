import { GoogleGenAI } from "@google/genai";
import { GEMINI_MODEL_CHAT, GEMINI_MODEL_IMAGE } from '../constants';
import { GroundingSource } from '../types';

// Safely retrieve the AI instance.
// Exclusively uses process.env.API_KEY as requested.
const getAI = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

interface ChatResponse {
  text: string;
  sources: GroundingSource[];
}

// Helper to handle API operations with auto-retry for API Key selection (via AI Studio popup if available)
async function withRetry<T>(operation: () => Promise<T>, fallbackValue: T): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMessage = error?.toString() || "";
    
    // Check if the error is due to an invalid/missing API key context
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
      console.warn("API Key entity not found or invalid. Triggering key selection...");
      try {
        // Trigger the key selection dialog
        await window.aistudio.openSelectKey();
        // Retry the operation immediately after selection
        return await operation();
      } catch (retryError) {
        console.error("Retry failed after key selection:", retryError);
      }
    }
    
    console.error("Gemini API Error:", error);
    return fallbackValue;
  }
}

// Chat Function with Search Grounding
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
        tools: [{ googleSearch: {} }], // Enable Search for "Smart" responses
      },
    });

    const text = response.text || "I am lost in thought...";
    
    // Extract Grounding Metadata (Sources)
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
    text: "My connection to the timeline is fading... (System Error: API Key)", 
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
    const prompt = `A highly detailed, photorealistic historical oil painting portrait of ${name}, ${description}. The subject is facing forward, looking at the viewer. Museum quality fine art, dramatic lighting.`;
    
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
        // High quality generation config
      }
    });

    // Iterate through parts to find the image
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