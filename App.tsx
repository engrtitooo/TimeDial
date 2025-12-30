import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTERS, FALLBACK_AVATARS } from './constants';
import { Character, Message, AppState } from './types';
import { CharacterPortal } from './components/CharacterPortal';
import { Controls } from './components/Controls';
import { Transcript } from './components/Transcript';
import { TimeParticles } from './components/TimeParticles';
import { generateCharacterResponse, generatePortrait } from './services/gemini';
import { generateSpeech } from './services/elevenlabs';

type ViewMode = 'LOBBY' | 'ROOM';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('LOBBY');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Avatar Persistence
  const [generatedAvatars, setGeneratedAvatars] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('timedial_avatars');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generationAttempts, setGenerationAttempts] = useState<Record<string, number>>({});
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentCharacter = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
  const activeAvatarUrl = currentCharacter ? (generatedAvatars[currentCharacter.id] || currentCharacter.avatarUrl || FALLBACK_AVATARS[currentCharacter.id]) : '';

  // Google API Key Selection Check (Fallback for AI Studio environments)
  const checkGoogleKey = async () => {
    if (typeof window !== 'undefined' && window.aistudio?.openSelectKey) {
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await window.aistudio.openSelectKey();
            }
        } catch (e) {
            console.error("Error checking Google API Key:", e);
        }
    }
  };

  // Initialize Audio
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  // ----------------------------------------------------------------------
  // Avatar Generation Logic
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (viewMode !== 'ROOM' || !currentCharacter) return;

    const checkAndGenerateAvatar = async () => {
      // Ensure we have a valid key before generating heavy assets
      await checkGoogleKey();

      const charId = currentCharacter.id;
      const attempts = generationAttempts[charId] || 0;
      const MAX_ATTEMPTS = 2;

      // Only generate if no STATIC url and no GENERATED url
      if (!currentCharacter.avatarUrl && !generatedAvatars[charId] && !isGeneratingAvatar) {
        if (attempts < MAX_ATTEMPTS) {
          setIsGeneratingAvatar(true);
          setGenerationAttempts(prev => ({ ...prev, [charId]: attempts + 1 }));
          const generatedImage = await generatePortrait(currentCharacter.name, currentCharacter.description);
          if (generatedImage) saveAvatar(charId, generatedImage);
          setIsGeneratingAvatar(false);
        } 
      }
    };
    checkAndGenerateAvatar();
  }, [currentCharacter, viewMode, generatedAvatars]);

  const saveAvatar = (id: string, url: string) => {
    setGeneratedAvatars(prev => {
      const newState = { ...prev, [id]: url };
      try { localStorage.setItem('timedial_avatars', JSON.stringify(newState)); } catch (e) {}
      return newState;
    });
  };

  // ----------------------------------------------------------------------
  // Chat & Speech Logic
  // ----------------------------------------------------------------------
  const playTuningSound = () => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  };

  const handleMessageSubmit = async (text: string) => {
    if (!text.trim()) return;
    initAudio(); // Ensure audio context is ready

    // Ensure API Key is selected before chatting
    await checkGoogleKey();

    // 1. User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setAppState(AppState.THINKING);

    // 2. AI Generation
    const history = messages.slice(-5).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const { text: aiText, sources } = await generateCharacterResponse(
      text,
      currentCharacter.systemPrompt,
      history
    );

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: aiText,
      timestamp: Date.now(),
      sources: sources,
    };
    setMessages(prev => [...prev, aiMsg]);

    // 3. TTS
    setAppState(AppState.SPEAKING);
    const audioBuffer = await generateSpeech(aiText, currentCharacter.voiceId);

    if (audioBuffer && audioContextRef.current) {
      playAudio(audioBuffer);
    } else {
      setTimeout(() => setAppState(AppState.IDLE), 2000);
    }
  };

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => setAppState(AppState.IDLE);
    source.start(0);
  };

  // ----------------------------------------------------------------------
  // Speech Recognition
  // ----------------------------------------------------------------------
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event: any) => {
        handleMessageSubmit(event.results[0][0].transcript);
      };
      recognitionRef.current.onerror = () => setAppState(AppState.IDLE);
      recognitionRef.current.onend = () => { 
        if(appState === AppState.LISTENING) setAppState(AppState.IDLE); 
      };
    }
  }, [currentCharacter]);

  const startListening = useCallback(() => {
    initAudio();
    if (recognitionRef.current && appState === AppState.IDLE) {
      setAppState(AppState.LISTENING);
      recognitionRef.current.start();
    }
  }, [appState]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && appState === AppState.LISTENING) {
      recognitionRef.current.stop();
    }
  }, [appState]);

  // ----------------------------------------------------------------------
  // Navigation & Welcome Logic
  // ----------------------------------------------------------------------
  const enterRoom = async (charId: string) => {
    // Check keys before entering
    await checkGoogleKey();
    
    initAudio();
    playTuningSound();
    setSelectedCharId(charId);
    setMessages([]); // Clear previous chat
    setViewMode('ROOM');
    
    // Auto-Welcome Logic
    const char = CHARACTERS.find(c => c.id === charId);
    if (char) {
        const welcomeMsg: Message = {
            id: 'welcome',
            role: 'model',
            text: char.greeting,
            timestamp: Date.now()
        };
        setMessages([welcomeMsg]);
        
        setAppState(AppState.THINKING);
        setTimeout(async () => {
             setAppState(AppState.SPEAKING);
             const audioBuffer = await generateSpeech(char.greeting, char.voiceId);
             if (audioBuffer && audioContextRef.current) {
                 playAudio(audioBuffer);
             } else {
                 setAppState(AppState.IDLE);
             }
        }, 800);
    }
  };

  const backToLobby = () => {
    if (audioContextRef.current) {
        audioContextRef.current.suspend();
    }
    setViewMode('LOBBY');
    setAppState(AppState.IDLE);
  };

  // ----------------------------------------------------------------------
  // Views
  // ----------------------------------------------------------------------
  
  // Settings Modal (Information Only)
  const SettingsModal = () => {
    const hasAIStudio = typeof window !== 'undefined' && !!window.aistudio;

    return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-serif text-white mb-4">Configurations</h2>
        
        <div className="mb-6 space-y-4">
           <div className="p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
             <h3 className="text-sm font-semibold text-blue-300 mb-1">System Status</h3>
             <p className="text-xs text-slate-400">Application configured for deployment.</p>
           </div>
           
           {hasAIStudio && (
             <button 
               onClick={checkGoogleKey}
               className="w-full bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800 rounded px-3 py-2 text-sm transition-colors flex items-center justify-center gap-2"
             >
               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
               Manage Gemini Key (AI Studio)
             </button>
           )}
        </div>

        <div className="flex justify-end gap-2">
          <button 
            onClick={() => setShowSettings(false)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    );
  };

  // View 1: The Lobby
  if (viewMode === 'LOBBY') {
    return (
        <div className="min-h-screen bg-[#050510] text-slate-200 flex flex-col items-center justify-center relative overflow-hidden font-sans">
            <TimeParticles color="#64748b" />
            
            {/* Settings Toggle */}
            <button 
              onClick={() => setShowSettings(true)}
              className="absolute top-6 right-6 z-20 p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {showSettings && <SettingsModal />}

            <div className="z-10 text-center mb-12 animate-fade-in-down">
                <h1 className="text-6xl md:text-8xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-500 to-amber-700 drop-shadow-lg mb-4">
                    TIMEDIAL
                </h1>
                <p className="text-slate-400 uppercase tracking-[0.4em] text-sm md:text-base">
                    Select a Timeline Frequency
                </p>
            </div>

            <div className="z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 max-w-7xl">
                {CHARACTERS.map(char => {
                   const displayUrl = generatedAvatars[char.id] || char.avatarUrl || FALLBACK_AVATARS[char.id];
                   return (
                       <button
                         key={char.id}
                         onClick={() => enterRoom(char.id)}
                         className={`group relative h-96 w-full md:w-64 rounded-2xl overflow-hidden border border-white/10 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
                       >
                            <div className={`absolute inset-0 bg-gradient-to-b ${char.theme.gradient} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                            
                            {displayUrl ? (
                                <img src={displayUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-all scale-100 group-hover:scale-110 duration-700 mix-blend-overlay" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-9xl font-serif opacity-10">{char.name.charAt(0)}</div>
                            )}

                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
                                <h3 className={`text-2xl font-serif font-bold ${char.theme.primaryColor} mb-1`}>{char.name}</h3>
                                <p className="text-xs text-white/60 uppercase tracking-widest">{char.role}</p>
                            </div>
                            
                            <div className={`absolute inset-0 border-2 border-transparent group-hover:${char.theme.borderStyle} transition-all rounded-2xl`}></div>
                       </button>
                   );
                })}
            </div>
            
             <footer className="absolute bottom-6 text-slate-600 text-[10px] uppercase tracking-widest">
                Powered by Gemini 3.0 Pro & ElevenLabs
            </footer>
        </div>
    );
  }

  // View 2: The Character Room
  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden transition-colors duration-1000 ${currentCharacter.theme.gradient}`}>
      
      {/* Settings (In Room) */}
      {showSettings && <SettingsModal />}

      <TimeParticles color={currentCharacter.theme.particleColor} />

      <header className="p-6 flex justify-between items-center z-10">
         <button 
           onClick={backToLobby}
           className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
         >
             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </div>
             <span className="text-xs uppercase tracking-widest hidden md:inline">Return to Lobby</span>
         </button>

         <div className="flex items-center gap-4">
             <div className={`text-xs px-3 py-1 rounded-full border bg-black/20 backdrop-blur-md ${currentCharacter.theme.borderStyle} ${currentCharacter.theme.primaryColor}`}>
                 Connected to: {currentCharacter.era}
             </div>
             <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-500 hover:text-white bg-black/20 hover:bg-white/10 rounded-full"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
         </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-5xl mx-auto px-4">
        
        <CharacterPortal 
          character={currentCharacter} 
          appState={appState} 
          avatarUrl={activeAvatarUrl}
          isGeneratingAvatar={isGeneratingAvatar}
        />

        <Transcript messages={messages} />

        <div className="w-full mt-6 mb-8">
            <Controls 
              appState={appState}
              onSendMessage={handleMessageSubmit}
              onStartListening={startListening}
              onStopListening={stopListening}
              character={currentCharacter}
            />
        </div>
      </main>
    </div>
  );
}