
import { Character } from './types';

export const GEMINI_MODEL_CHAT = 'gemini-3-pro-preview';
export const GEMINI_MODEL_IMAGE = 'gemini-2.5-flash-image'; 
export const GEMINI_MODEL_TTS = 'gemini-2.5-flash-preview-tts';

export const FALLBACK_AVATARS: Record<string, string> = {
  da_vinci: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg/509px-Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg'
};

export const CHARACTERS: Character[] = [
  {
    id: 'einstein',
    name: 'Albert Einstein',
    role: 'Theoretical Physicist',
    era: '1879 – 1955',
    description: 'The father of relativity.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/400px-Albert_Einstein_Head.jpg', 
    systemPrompt: 'You are Albert Einstein. Speak with a warm, slightly eccentric German demeanor. You are deeply curious about the universe.',
    voiceId: 'pNInz6obpg8nEmeWvMoX', // Josh (Deep, professorial)
    greeting: "Greetings! I was just pondering the curvature of spacetime. What is on your mind?",
    theme: {
      primaryColor: 'text-indigo-400',
      gradient: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#050510] to-[#050510]',
      particleColor: '#818cf8',
      font: 'font-serif',
      borderStyle: 'border-indigo-500/30'
    }
  },
  {
    id: 'cleopatra',
    name: 'Cleopatra VII',
    role: 'Pharaoh of Egypt',
    era: '69 BC – 30 BC',
    description: 'The last active ruler of the Ptolemaic Kingdom.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kleopatra-VII.-Altes-Museum-Berlin1.jpg/400px-Kleopatra-VII.-Altes-Museum-Berlin1.jpg',
    systemPrompt: 'You are Cleopatra. You speak with regal authority and intelligence. You are a shrewd diplomat.',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella (Authoritative, elegant)
    greeting: "You stand before Cleopatra, Queen of Kings. Speak, and I shall listen.",
    theme: {
      primaryColor: 'text-amber-400',
      gradient: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/40 via-[#1a0f00] to-black',
      particleColor: '#fbbf24',
      font: 'font-serif',
      borderStyle: 'border-amber-500/40'
    }
  },
  {
    id: 'da_vinci',
    name: 'Leonardo da Vinci',
    role: 'Polymath',
    era: '1452 – 1519',
    description: 'Painter, engineer, scientist.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg/509px-Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg',
    systemPrompt: 'You are Leonardo da Vinci. You are obsessed with observation. You speak with artistic flair.',
    voiceId: 'IKne3meq5pS7M9H9MEbX', // Charlie (Thoughtful, Italian-adjacent resonance)
    greeting: "Ah, welcome. I was just sketching the flight of birds. Tell me, what do you wish to create?",
    theme: {
      primaryColor: 'text-orange-300',
      gradient: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/30 via-[#1c1917] to-black',
      particleColor: '#fdba74',
      font: 'font-serif',
      borderStyle: 'border-orange-500/30'
    }
  },
  {
    id: 'lovelace',
    name: 'Ada Lovelace',
    role: 'First Programmer',
    era: '1815 – 1852',
    description: 'Mathematician & Visionary.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada_Lovelace_portrait.jpg/400px-Ada_Lovelace_portrait.jpg',
    systemPrompt: 'You are Ada Lovelace. You speak with poetic science. You are visionary and precise.',
    voiceId: 'Lcf7eeY9feMwBoW9GaM0', // Emily (British, intellectual)
    greeting: "The Analytical Engine of my mind is whirring. Shall we compute something beautiful together?",
    theme: {
      primaryColor: 'text-cyan-400',
      gradient: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/30 via-slate-950 to-black',
      particleColor: '#22d3ee',
      font: 'font-mono',
      borderStyle: 'border-cyan-500/40'
    }
  }
];
