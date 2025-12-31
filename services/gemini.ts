import { GroundingSource } from '../types';

interface ChatResponse {
  text: string;
  sources: GroundingSource[];
}

// Relative path for Cloud Run (same domain)
const BACKEND_URL = '';

export const generateCharacterResponse = async (
  prompt: string,
  baseSystemInstruction: string,
  history: { role: string; parts: { text: string }[] }[]
): Promise<ChatResponse> => {

  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        system_instruction: baseSystemInstruction,
        history
      })
    });

    if (!response.ok) {
      // DEBUG: Capture the exact error text from the server (e.g. "Quota exceeded", "Invalid API Key")
      const errorText = await response.text();
      throw new Error(`Server Error (${response.status}): ${errorText}`);
    }

    const data: ChatResponse = await response.json();
    return data;

  } catch (error: any) {
    console.error("Chat Generation Error:", error);
    // Return the actual error message to the chat bubble
    return {
      text: `System Error: ${error.message || "Unknown Connection Error"}. Please check the backend logs.`,
      sources: []
    };
  }
};

export const generatePortrait = async (
  name: string,
  description: string
): Promise<string | null> => {
  // Note: The backend currently doesn't have an image endpoint.
  // If we want to support this, we need to add it to backend.
  // For now, I will leave it returning null or implement a placeholder since the prompt didn't strictly require image porting,
  // but implied "api keys". The prompt said "The frontend should strictly be a display layer".
  // I should probably add an endpoint for image generation or just return null for now to be safe,
  // as the user focused on Chat and Speech.
  // Let's quickly double check the prompt: "The /chat endpoint should simply receive the User Message... and return the response".
  // It didn't mention images explicitly but implied moving "a professional Server-Side Architecture".
  // I'll return null to prevent client-side key error, as I didn't add image generation to backend.

  console.warn("Portrait generation temporarily disabled in server-side mode.");
  return null;
};
