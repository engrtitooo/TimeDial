
import { Character } from './types';

// Performance Hack: Flash is significantly faster than Pro for real-time demos
export const GEMINI_MODEL_CHAT = 'gemini-3-flash-preview';
export const GEMINI_MODEL_IMAGE = 'gemini-2.5-flash-image';

export const FALLBACK_AVATARS: Record<string, string> = {
  da_vinci: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg/509px-Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg',
  cleopatra: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kleopatra-VII.-Altes-Museum-Berlin1.jpg/440px-Kleopatra-VII.-Altes-Museum-Berlin1.jpg'
};
// Character Definitions
export const CHARACTERS: Character[] = [
  {
    id: 'einstein',
    name: 'Albert Einstein',
    role: 'Theoretical Physicist',
    bio: 'A mature, deep, and steady male voice that reflects a calm and thoughtful personality. It has a professional yet gentle tone, suitable for a wise scientist.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Einstein_1921_by_F_Schmutzer_-_restoration.jpg/800px-Einstein_1921_by_F_Schmutzer_-_restoration.jpg',
    voiceId: 'UGTtbzgh3HObxRjWaSpr', // Brian (Manual ID)
    systemPrompt: 'You are Albert Einstein. Speak with wisdom, curiosity, and a slight German accent in your text phrasing. Explain complex physics simply.',
    greeting: "Ah, a curious mind approaches! Time and space are relative, but questions... questions are eternal. What puzzles you today?",
    theme: {
      primaryColor: 'text-amber-400',
      gradient: 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/40 via-[#1a0f00] to-black',
      particleColor: '#fbbf24',
      font: 'font-serif',
      borderStyle: 'border-amber-500/40'
    }
  },
  {
    id: 'cleopatra',
    name: 'Cleopatra VII',
    role: 'Pharaoh of Egypt',
    bio: 'An elegant, confident, and assertive female voice. It conveys the authority of a powerful ruler with a sophisticated and commanding tone.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kleopatra-VII.-Altes-Museum-Berlin1.jpg/440px-Kleopatra-VII.-Altes-Museum-Berlin1.jpg',
    voiceId: '4RZ84U1b4WCqpu57LvIq', // Bella (Manual ID)
    systemPrompt: 'You are Cleopatra. Speak with regal authority, intelligence, and charm. You are a shrewd political strategist.',
    greeting: "Welcome to my court. I am Cleopatra, last pharaoh of Egypt. Speak, and you shall have my attention.",
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
    role: 'Renaissance Polymath',
    bio: 'A wise, warm, and mature male voice. It carries a sense of curiosity and seasoned experience, fitting for the ultimate Renaissance polymath.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Francesco_Melzi_-_Portrait_of_Leonardo.png/800px-Francesco_Melzi_-_Portrait_of_Leonardo.png',
    voiceId: 'IRHApOXLvnW57QJPQH2P', // Adam (Manual ID)
    systemPrompt: 'You are Leonardo da Vinci. Speak with insatiable curiosity, artistic sensitivity, and deep wisdom.',
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
    bio: 'A sharp, intelligent female voice with a clear British accent. It sounds visionary and precise, capturing her persona as a mathematical pioneer.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada_Lovelace_portrait.jpg/400px-Ada_Lovelace_portrait.jpg',
    voiceId: 'E4IXevHtHpKGh0bvrPPr', // Alice (Manual ID - Emillia Replacement)
    systemPrompt: 'You are Ada Lovelace. You speak with poetic science. You are visionary and precise.',
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
