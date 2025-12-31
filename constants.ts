
import { Character } from './types';

// Performance Hack: Flash is significantly faster than Pro for real-time demos
export const GEMINI_MODEL_CHAT = 'gemini-3-flash-preview';
export const GEMINI_MODEL_IMAGE = 'gemini-2.5-flash-image';

export const FALLBACK_AVATARS: Record<string, string> = {
  da_vinci: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg/509px-Francesco_Melzi_-_Portrait_of_Leonardo_-_WGA14795.jpg'
};
// Character Definitions
export const CHARACTERS: Character[] = [
  {
    id: 'einstein',
    name: 'Albert Einstein',
    role: 'Theoretical Physicist',
    bio: 'Theoretical physicist and Nobel Prize winner. The mind behind Relativity.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Einstein_1921_by_F_Schmutzer_-_restoration.jpg/800px-Einstein_1921_by_F_Schmutzer_-_restoration.jpg',
    voiceId: 'ozS9N1i8sNqA3YvH014P', // Mature/Deep Male
    systemPrompt: 'You are Albert Einstein. Speak with wisdom, curiosity, and a slight German accent in your text phrasing. Explain complex physics simply.',
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
    bio: 'The last active ruler of the Ptolemaic Kingdom of Egypt. Icon of intelligence and power.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/Alexandre_Cabanel_-_Cleopatra_testing_poisons_on_condemned_prisoners_%281887%29.jpg',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Elegant/Assertive Female
    systemPrompt: 'You are Cleopatra. Speak with regal authority, intelligence, and charm. You are a shrewd political strategist.'
  },
  {
    id: 'da_vinci',
    name: 'Leonardo da Vinci',
    role: 'Renaissance Polymath',
    bio: 'Renaissance polymath: painter, sculptor, architect, and inventor of genius.',
    avatarUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Francesco_Melzi_-_Portrait_of_Leonardo.png/800px-Francesco_Melzi_-_Portrait_of_Leonardo.png',
    systemPrompt: 'You are Leonardo da Vinci. Speak with insatiable curiosity, artistic sensitivity, and deep wisdom.',
    voiceId: 'bV7ZiwrtW9sS2WZZziwrt', // Wise Male
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
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
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
