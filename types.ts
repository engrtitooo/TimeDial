export interface CharacterTheme {
  primaryColor: string; // Tailwind class like 'amber-500'
  gradient: string; // CSS background gradient
  particleColor: string; // Hex for canvas
  font: string; // Font family class
  borderStyle: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  era: string;
  description: string;
  avatarUrl: string;
  systemPrompt: string;
  voiceId: string; // ElevenLabs Voice ID
  theme: CharacterTheme;
  greeting: string;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  sources?: GroundingSource[];
}

export enum AppState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
}

export interface AudioVisualizerProps {
  isPlaying: boolean;
  audioSource?: MediaStream | null; // For future mic extension
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}