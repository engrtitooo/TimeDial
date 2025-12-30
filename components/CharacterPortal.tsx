import React from 'react';
import { Character, AppState } from '../types';
import { Visualizer } from './Visualizer';

interface CharacterPortalProps {
  character: Character;
  appState: AppState;
  avatarUrl: string;
  isGeneratingAvatar: boolean;
  analyser?: AnalyserNode | null;
}

export const CharacterPortal: React.FC<CharacterPortalProps> = ({ 
  character, 
  appState, 
  avatarUrl,
  isGeneratingAvatar,
  analyser
}) => {
  const isSpeaking = appState === AppState.SPEAKING;
  const isThinking = appState === AppState.THINKING;

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-2xl mx-auto my-8">
      {/* Outer Glow Ring */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${
          isSpeaking ? 'bg-amber-500/30 scale-110' : 
          isThinking || isGeneratingAvatar ? 'bg-blue-500/20 scale-105 animate-pulse' : 'bg-transparent'
        }`}
      ></div>

      {/* Main Portal Container */}
      <div className="relative z-10 w-64 h-64 md:w-80 md:h-80 rounded-full border-4 border-amber-500/20 overflow-hidden glass-panel flex items-center justify-center shadow-2xl transition-all duration-500 bg-black/40">
        
        {isGeneratingAvatar ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
             <div className="w-16 h-16 border-4 border-amber-500/50 border-t-amber-500 rounded-full animate-spin mb-4"></div>
             <p className="text-amber-500 text-xs tracking-[0.2em] animate-pulse">RECONSTRUCTING TIMELINE</p>
          </div>
        ) : avatarUrl ? (
           <img 
            src={avatarUrl} 
            alt={character.name} 
            className={`w-full h-full object-cover transition-transform duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-600">
             <span className="text-6xl font-serif text-amber-900/50 mb-2">{character.name.charAt(0)}</span>
             <span className="text-[10px] uppercase tracking-widest opacity-50">Signal Weak</span>
          </div>
        )}
        
        {isThinking && !isGeneratingAvatar && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center z-10">
        <h2 className="text-3xl md:text-4xl font-serif text-white tracking-widest uppercase drop-shadow-lg">
          {character.name}
        </h2>
        <p className="text-amber-400 font-light tracking-widest text-sm mt-1 uppercase">
          {character.era} • {character.role}
        </p>
      </div>

      <div className="w-64 md:w-96 h-12 mt-4 z-10">
        <Visualizer isPlaying={isSpeaking} analyser={analyser} color={character.theme.particleColor} />
      </div>
    </div>
  );
};