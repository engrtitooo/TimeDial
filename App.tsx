import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CHARACTERS, FALLBACK_AVATARS } from './constants';
import { Character, Message, AppState } from './types';
import { CharacterPortal } from './components/CharacterPortal';
import { Controls } from './components/Controls';
import { Transcript } from './components/Transcript';
import { TimeParticles } from './components/TimeParticles';
import { generateCharacterResponse } from './services/gemini';
import { generateElevenLabsSpeech } from './services/elevenlabs';

type ViewMode = 'LOBBY' | 'ROOM';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('LOBBY');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Note: Local avatar caching removed effectively as we no longer generate avatars on client
  // and server-side image generation is currently disabled/placeholder.

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentCharacter = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
  // Fallback to static URLs only since we removed client-side generation
  const activeAvatarUrl = currentCharacter ? (currentCharacter.avatarUrl || FALLBACK_AVATARS[currentCharacter.id]) : '';

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Global unlock for iOS audio
  useEffect(() => {
    const unlockAudio = () => {
      initAudio();
      // Play silent buffer to warm up
      if (audioContextRef.current) {
        const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start(0);
        console.log("Audio Context Unlocked");
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [initAudio]);

  const playAudio = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

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
    setAppState(AppState.SPEAKING);
  };

  const triggerCharacterSpeech = async (text: string, char: Character) => {
    if (!audioContextRef.current) {
      setAppState(AppState.IDLE);
      return;
    }

    try {
      // Keys are now handled on backend, passed empty string or ignored
      const audioBuffer = await generateElevenLabsSpeech(
        text,
        char.voiceId,
        "",
        audioContextRef.current
      );
      if (audioBuffer) {
        playAudio(audioBuffer);
        setVoiceError(null);
      } else {
        throw new Error("Voice synthesis yielded no audio buffer.");
      }
    } catch (e: any) {
      console.error("Speech Error:", e);
      setVoiceError("Voice Service Unavailable");
      setAppState(AppState.IDLE);
    }
  };

  const handleMessageSubmit = async (text: string) => {
    if (!text.trim() || appState !== AppState.IDLE) return;
    initAudio();

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

    await triggerCharacterSpeech(aiText, currentCharacter);
  };

  const enterRoom = async (charId: string) => {
    initAudio();

    setSelectedCharId(charId);
    setMessages([]);
    setVoiceError(null);
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
      setAppState(AppState.THINKING);

      await triggerCharacterSpeech(char.greeting, char);
    }
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
        if (appState === AppState.LISTENING) setAppState(AppState.IDLE);
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

  const backToLobby = () => {
    if (audioContextRef.current) audioContextRef.current.suspend();
    setViewMode('LOBBY');
    setAppState(AppState.IDLE);
    setAnalyser(null);
    setVoiceError(null);
  };

  if (viewMode === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#050510] text-slate-200 flex flex-col items-center justify-center relative overflow-hidden font-sans">
        <TimeParticles color="#64748b" />
        <div className="z-10 text-center mb-16 animate-fade-in-down px-4">
          <h1 className="text-7xl md:text-9xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-500 to-amber-700 drop-shadow-2xl mb-6 tracking-tighter">TIMEDIAL</h1>
          <p className="text-slate-500 uppercase tracking-[0.6em] text-[10px] md:text-xs opacity-80">Synchronize with Historical Frequencies</p>
        </div>
        <div className="z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 px-6 max-w-7xl">
          {CHARACTERS.map(char => {
            const displayUrl = char.avatarUrl || FALLBACK_AVATARS[char.id];
            return (
              <button key={char.id} onClick={() => enterRoom(char.id)} className="group relative h-[380px] md:h-[450px] w-full md:w-64 rounded-3xl overflow-hidden border border-white/5 transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_20px_60px_-15px_rgba(251,191,36,0.3)] bg-slate-900/40">
                <div className={`absolute inset-0 bg-gradient-to-b ${char.theme.gradient} opacity-90 group-hover:opacity-100 transition-opacity`}></div>
                {displayUrl && <img src={displayUrl} className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-all scale-100 group-hover:scale-105 duration-1000 mix-blend-overlay" alt={char.name} />}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-transparent to-transparent opacity-80"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 text-left">
                  <h3 className={`text-2xl font-serif font-bold ${char.theme.primaryColor} mb-2 transition-all transform group-hover:translate-x-1`}>{char.name}</h3>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest font-black mb-1">{char.role}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-mono">{char.era}</p>
                </div>
                <div className={`absolute inset-0 border-2 border-transparent group-hover:${char.theme.borderStyle} transition-all rounded-3xl duration-500`}></div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden transition-colors duration-1000 ${currentCharacter.theme.gradient}`}>
      <TimeParticles color={currentCharacter.theme.particleColor} />
      <header className="p-8 flex justify-between items-center z-10">
        <button onClick={backToLobby} className="flex items-center gap-3 text-white/40 hover:text-white transition-all group">
          <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-amber-500/20 group-hover:text-amber-400 group-hover:scale-105 transition-all border border-white/5 group-hover:border-amber-500/30">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </div>
          <span className="text-[10px] uppercase tracking-[0.3em] hidden md:inline font-black">Disconnect Stream</span>
        </button>
        <div className="flex items-center gap-6">
          {voiceError && (
            <div className="text-[9px] font-bold text-red-400 uppercase tracking-widest animate-pulse border border-red-500/30 px-3 py-1 rounded-full bg-red-500/5">
              {voiceError}
            </div>
          )}
          <div className={`text-[10px] font-black px-6 py-2.5 rounded-2xl border bg-black/60 backdrop-blur-xl ${currentCharacter.theme.borderStyle} ${currentCharacter.theme.primaryColor} shadow-2xl tracking-[0.2em]`}>
            <span className="animate-pulse mr-3">●</span> {currentCharacter.era}
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center relative w-full max-w-6xl mx-auto px-6">
        <CharacterPortal
          character={currentCharacter}
          appState={appState}
          avatarUrl={activeAvatarUrl}
          isGeneratingAvatar={false}
          analyser={analyser}
        />
        <Transcript messages={messages} />
        <div className="w-full mt-auto mb-12">
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
