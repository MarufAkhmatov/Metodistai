import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { NodeEngine } from './NodeEngine';

export function WorkflowEditor() {
  const [activeTab, setActiveTab] = useState('Editor');
  const [isRunning, setIsRunning] = useState(false);

  // Generate some grid items when running
  const [generatedItems, setGeneratedItems] = useState<number[]>([]);

  useEffect(() => {
    if (isRunning) {
      const timer = setTimeout(() => {
        setGeneratedItems(Array.from({ length: 6 }, (_, i) => i));
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setGeneratedItems([]);
    }
  }, [isRunning]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050505] text-white font-sans selection:bg-[#22ff88] selection:text-black">
      {/* Background with noise texture and grid */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC44JyBydW09JzEnIHN0aXRjaFRpbGVzPSdzdGl0Y2gnLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nMTAwJz4gaGVpZ2h0PScxMDAnIGZpbHRlcj0ndXJsKCNuKScgb3BhY2l0eT0nMC4wNScvPjwvc3ZnPg==')] opacity-[0.15]" />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex flex-col p-6 pointer-events-none gap-4">
        <div className="flex justify-between w-full">
          <div className="flex flex-col gap-4 pointer-events-auto">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-[#22ff88]" />
              <h1 className="text-xl font-medium tracking-tight text-white">AI Metodist</h1>
              <span className="text-sm px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5 ml-2">Workflow</span>
            </div>
            
            <div className="flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md w-fit">
              {['Editor', 'Executions', 'Tests'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                    activeTab === tab 
                      ? 'bg-[#22ff88]/20 text-[#22ff88] shadow-[0_0_10px_rgba(34,255,136,0.2)]' 
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="w-[120px] pointer-events-auto flex justify-end">
            <button 
              onClick={() => setIsRunning(!isRunning)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 h-fit ${
                isRunning 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-[#22ff88] text-black hover:bg-[#22ff88]/90 hover:shadow-[0_0_20px_rgba(34,255,136,0.4)]'
              }`}
            >
              {isRunning ? 'Stop' : 'Run Workflow'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div className="absolute inset-0 z-10">
        <NodeEngine isRunning={isRunning} generatedItems={generatedItems} />
      </div>
    </div>
  );
}
