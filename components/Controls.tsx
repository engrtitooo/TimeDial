import React, { useState } from 'react';
import { AppState, Character } from '../types';

interface ControlsProps {
  appState: AppState;
  onSendMessage: (text: string) => void;
  onStartListening: () => void;
  onStopListening: () => void;
  character: Character;
  interimText?: string; // Live transcription while speaking
}

export const Controls: React.FC<ControlsProps> = ({
  appState,
  onSendMessage,
  onStartListening,
  onStopListening,
  character,
  interimText = '',
}) => {
  const [inputText, setInputText] = useState('');
  const isListening = appState === AppState.LISTENING;
  const isBusy = appState === AppState.THINKING || appState === AppState.SPEAKING;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isBusy) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 z-20">
      <div className={`glass-panel p-2 rounded-2xl flex items-center gap-3 ${character.theme.borderStyle} bg-black/40`}>

        {/* Text Input / Live Transcription Display */}
        <form onSubmit={handleSubmit} className="flex-1">
          <input
            type="text"
            value={isListening && interimText ? interimText : inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isBusy || isListening}
            placeholder={isListening ? (interimText || "Listening...") : isBusy ? "Character is responding..." : `Message ${character.name}...`}
            className={`w-full bg-transparent border-none focus:ring-0 px-4 py-3 text-base text-white placeholder-slate-400 font-light ${isListening && interimText ? 'italic text-amber-300/80' : ''}`}
            readOnly={isListening}
          />
        </form>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pr-1">
          {/* Send Button (only shows if text exists) */}
          {inputText.trim() && (
            <button
              onClick={handleSubmit}
              disabled={isBusy}
              className={`p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white min-w-[48px] min-h-[48px] flex items-center justify-center`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Mic Button */}
          <button
            onMouseDown={!isBusy ? onStartListening : undefined}
            onMouseUp={!isBusy ? onStopListening : undefined}
            onTouchStart={!isBusy ? onStartListening : undefined}
            onTouchEnd={!isBusy ? onStopListening : undefined}
            disabled={isBusy}
            className={`
              relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
              ${isListening
                ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500 ring-offset-2 ring-offset-black scale-110'
                : isBusy
                  ? 'bg-slate-700/50 text-slate-500 cursor-wait'
                  : `bg-white/10 hover:bg-white/20 ${character.theme.primaryColor} ring-1 ring-white/10`
              }
            `}
          >
            {isListening && <div className="absolute inset-0 rounded-full animate-ping bg-red-500/30"></div>}
            <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="text-center mt-2">
        <span className={`text-[10px] uppercase tracking-[0.2em] opacity-50 ${character.theme.primaryColor}`}>
          {isListening ? (interimText ? 'Hearing you...' : 'Listening...') : isBusy ? 'Processing Time Stream...' : 'Type or Hold Mic'}
        </span>
      </div>
    </div>
  );
};
