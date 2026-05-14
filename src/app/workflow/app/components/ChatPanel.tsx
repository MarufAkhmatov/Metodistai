import React, { useState } from 'react';
import { Send, Bot } from 'lucide-react';

export function ChatPanel() {
  const [msg, setMsg] = useState('');
  
  return (
    <div className="w-[340px] h-[400px] flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden relative group">
      {/* Glow effect behind panel */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#22ff88]/5 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 bg-white/[0.02]">
        <div className="w-8 h-8 rounded-full bg-[#22ff88]/20 flex items-center justify-center border border-[#22ff88]/30">
          <Bot className="w-4 h-4 text-[#22ff88]" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Metodist Assistant</h3>
          <p className="text-xs text-white/50">Online</p>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
        <div className="self-start max-w-[85%]">
          <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-white/90 leading-relaxed shadow-sm">
            I'm ready to analyze your files. Drop a new file into the input folder or select from the knowledge base to begin.
          </div>
          <span className="text-[10px] text-white/40 mt-1.5 ml-1 block">10:42 AM</span>
        </div>
        
        <div className="self-end max-w-[85%]">
          <div className="bg-[#22ff88]/10 border border-[#22ff88]/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-white leading-relaxed shadow-[0_0_15px_rgba(34,255,136,0.05)]">
            Let's compare the Q3 reports.
          </div>
          <span className="text-[10px] text-[#22ff88]/60 mt-1.5 mr-1 block text-right">10:43 AM</span>
        </div>
      </div>
      
      {/* Input */}
      <div className="p-3 bg-white/[0.02] border-t border-white/10">
        <div className="relative flex items-center">
          <input 
            type="text" 
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Type a message..." 
            className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 pl-4 pr-10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#22ff88]/50 focus:ring-1 focus:ring-[#22ff88]/50 transition-all"
          />
          <button className="absolute right-2 p-1.5 rounded-lg text-white/50 hover:text-[#22ff88] hover:bg-[#22ff88]/10 transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
