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
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  const [generatedAvatars, setGeneratedAvatars] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('timedial_avatars');
        return saved ? JSON.parse(saved) : {};
      } catch (e) { return {}; }
    }
    return {};
  });
  
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [generationAttempts, setGenerationAttempts] = useState<Record<string, number>>({});
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentCharacter = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
  const activeAvatarUrl = currentCharacter ? (generatedAvatars[currentCharacter.id] || currentCharacter.avatarUrl || FALLBACK_AVATARS[currentCharacter.id]) : '';

  const checkGoogleKey = async () => {
    if (typeof window !== 'undefined' && window.aistudio?.openSelectKey) {
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) await window.aistudio.openSelectKey();
        } catch (e) { console.error("Error checking Google API Key:", e); }
    }
  };

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  useEffect(() => {
    if (viewMode !== 'ROOM' || !currentCharacter) return;

    const checkAndGenerateAvatar = async () => {
      const charId = currentCharacter.id;
      const attempts = generationAttempts[charId] || 0;
      const MAX_ATTEMPTS = 1;

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
  }, [currentCharacter, viewMode]);

  const saveAvatar = (id: string, url: string) => {
    setGeneratedAvatars(prev => {
      const newState = { ...prev, [id]: url };
      try { localStorage.setItem('timedial_avatars', JSON.stringify(newState)); } catch (e) {}
      return newState;
    });
  };

  const handleMessageSubmit = async (text: string) => {
    if (!text.trim() || appState !== AppState.IDLE) return;
    initAudio();
    await checkGoogleKey();

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setAppState(AppState.THINKING);

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

    setAppState(AppState.SPEAKING);
    if (audioContextRef.current) {
        const audioBuffer = await generateSpeech(aiText, currentCharacter.voiceId, audioContextRef.current);
        if (audioBuffer) {
            playAudio(audioBuffer);
        } else {
            setAppState(AppState.IDLE);
        }
    } else {
        setAppState(AppState.IDLE);
    }
  };

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Create Analyser for reactivity
    const newAnalyser = ctx.createAnalyser();
    newAnalyser.fftSize = 256;
    setAnalyser(newAnalyser);

    source.connect(newAnalyser);
    newAnalyser.connect(ctx.destination);
    
    source.onended = () => {
      setAppState(AppState.IDLE);
      setAnalyser(null);
    };
    source.start(0);
  };

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
  }, [currentCharacter, messages, appState]);

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

  const enterRoom = async (charId: string) => {
    await checkGoogleKey();
    initAudio();
    setSelectedCharId(charId);
    setMessages([]);
    setViewMode('ROOM');
    
    const char = CHARACTERS.find(c => c.id === charId);
    if (char) {
        const welcomeMsg: Message = {
            id: 'welcome',
            role: 'model',
            text: char.greeting,
            timestamp: Date.now()
        };
        setMessages([welcomeMsg]);
        setAppState(AppState.SPEAKING);
        if (audioContextRef.current) {
            const audioBuffer = await generateSpeech(char.greeting, char.voiceId, audioContextRef.current);
            if (audioBuffer) playAudio(audioBuffer);
            else setAppState(AppState.IDLE);
        }
    }
  };

  const backToLobby = () => {
    if (audioContextRef.current) audioContextRef.current.suspend();
    setViewMode('LOBBY');
    setAppState(AppState.IDLE);
    setAnalyser(null);
  };

  const SettingsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-serif text-white mb-4">Timeline Tuning</h2>
        <div className="mb-6 space-y-4">
           <div className="p-3 bg-amber-900/10 border border-amber-800/30 rounded-lg">
             <h3 className="text-sm font-semibold text-amber-300 mb-1">Quantum Status</h3>
             <p className="text-xs text-slate-400">Connection to historical stream is active.</p>
           </div>
           {typeof window !== 'undefined' && window.aistudio && (
             <div className="space-y-2">
               <button 
                 onClick={checkGoogleKey}
                 className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded px-3 py-2 text-sm transition-colors flex items-center justify-center gap-2"
               >
                 Recalibrate Gemini Key
               </button>
             </div>
           )}
        </div>
        <button onClick={() => setShowSettings(false)} className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors">Close</button>
      </div>
    </div>
  );

  if (viewMode === 'LOBBY') {
    return (
        <div className="min-h-screen bg-[#050510] text-slate-200 flex flex-col items-center justify-center relative overflow-hidden font-sans">
            <TimeParticles color="#64748b" />
            <button onClick={() => setShowSettings(true)} className="absolute top-6 right-6 z-20 p-2 text-slate-500 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            {showSettings && <SettingsModal />}
            <div className="z-10 text-center mb-12 animate-fade-in-down">
                <h1 className="text-6xl md:text-8xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-500 to-amber-700 drop-shadow-lg mb-4">TIMEDIAL</h1>
                <p className="text-slate-400 uppercase tracking-[0.4em] text-sm md:text-base">Select a Timeline Frequency</p>
            </div>
            <div className="z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-6 max-w-7xl">
                {CHARACTERS.map(char => {
                   const displayUrl = generatedAvatars[char.id] || char.avatarUrl || FALLBACK_AVATARS[char.id];
                   return (
                       <button key={char.id} onClick={() => enterRoom(char.id)} className={`group relative h-96 w-full md:w-64 rounded-2xl overflow-hidden border border-white/10 transition-all duration-500 hover:-translate-y-2`}>
                            <div className={`absolute inset-0 bg-gradient-to-b ${char.theme.gradient} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
                            {displayUrl && <img src={displayUrl} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-all scale-100 group-hover:scale-110 duration-700 mix-blend-overlay" />}
                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
                                <h3 className={`text-2xl font-serif font-bold ${char.theme.primaryColor} mb-1`}>{char.name}</h3>
                                <p className="text-xs text-white/60 uppercase tracking-widest">{char.role}</p>
                            </div>
                            <div className={`absolute inset-0 border-2 border-transparent group-hover:${char.theme.borderStyle} transition-all rounded-2xl`}></div>
                       </button>
                   );
                })}
            </div>
        </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden transition-colors duration-1000 ${currentCharacter.theme.gradient}`}>
      {showSettings && <SettingsModal />}
      <TimeParticles color={currentCharacter.theme.particleColor} />
      <header className="p-6 flex justify-between items-center z-10">
         <button onClick={backToLobby} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group">
             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></div>
             <span className="text-xs uppercase tracking-widest hidden md:inline">Exit Timeline</span>
         </button>
         <div className="flex items-center gap-4">
             <div className={`text-xs px-3 py-1 rounded-full border bg-black/20 backdrop-blur-md ${currentCharacter.theme.borderStyle} ${currentCharacter.theme.primaryColor}`}>Connected: {currentCharacter.era}</div>
         </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-5xl mx-auto px-4">
        <CharacterPortal character={currentCharacter} appState={appState} avatarUrl={activeAvatarUrl} isGeneratingAvatar={isGeneratingAvatar} analyser={analyser} />
        <Transcript messages={messages} />
        <div className="w-full mt-6 mb-8">
            <Controls appState={appState} onSendMessage={handleMessageSubmit} onStartListening={startListening} onStopListening={stopListening} character={currentCharacter} />
        </div>
      </main>
    </div>
  );
}