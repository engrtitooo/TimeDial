import React, { useRef, useEffect } from 'react';
import { Message } from '../types';

interface TranscriptProps {
  messages: Message[];
}

export const Transcript: React.FC<TranscriptProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 px-4 z-10 relative">
      <div 
        ref={scrollRef}
        className="h-48 overflow-y-auto glass-panel rounded-xl p-4 space-y-4 shadow-inner bg-black/20"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed
              ${msg.role === 'user' 
                ? 'bg-gradient-to-br from-amber-600/30 to-amber-800/30 border border-amber-500/30 text-amber-50 rounded-tr-none' 
                : 'bg-slate-800/60 border border-slate-600/30 text-slate-100 rounded-tl-none backdrop-blur-md'
              }
            `}>
              {msg.text}

              {/* Citations / Grounding Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/10">
                  <p className="text-[10px] uppercase text-slate-400 mb-1 font-bold tracking-wider">
                    Historical References & Facts:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((source, idx) => (
                      <a 
                        key={idx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] flex items-center gap-1 bg-black/30 hover:bg-amber-500/20 px-2 py-1 rounded transition-colors text-amber-400 hover:text-amber-200 border border-transparent hover:border-amber-500/50"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <span className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest font-mono opacity-60">
              {msg.role === 'model' ? `TIMEDIAL AI • ${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'YOU'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};