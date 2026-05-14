import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Database, Sparkles, CheckCircle, Plug, Folder } from 'lucide-react';
import { ChatPanel } from './ChatPanel';

interface NodePosition {
  x: number;
  y: number;
}

interface Connection {
  id: string;
  from: string;
  fromPort: 'left' | 'right' | 'top' | 'bottom';
  to: string;
  toPort: 'left' | 'right' | 'top' | 'bottom';
}

export function NodeEngine({ isRunning, generatedItems = [] }: { isRunning: boolean, generatedItems?: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial positions
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 600;
  const bottomY = typeof window !== 'undefined' ? window.innerHeight - 450 : 400;

  const [positions, setPositions] = useState<Record<string, NodePosition>>({
    input: { x: centerX - 450, y: 180 },
    agent: { x: centerX - 150, y: 200 },
    kb: { x: centerX + 250, y: 100 },
    chat: { x: centerX - 170, y: bottomY }, // moved chat to center bottom
    action_create: { x: centerX + 180, y: 300 }, // under KB
    action_add: { x: centerX + 380, y: 300 }, // under KB
    kb_folders: { x: centerX + 220, y: 400 }, // KB generated folders
  });

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', from: 'input', fromPort: 'right', to: 'agent', toPort: 'left' },
    { id: 'c2', from: 'agent', fromPort: 'right', to: 'kb', toPort: 'left' },
    // Connected chat to AI Metodist
    { id: 'c3', from: 'chat', fromPort: 'top', to: 'agent', toPort: 'bottom' },
    // Connected buttons to Knowledge base
    { id: 'c4', from: 'kb', fromPort: 'bottom', to: 'action_create', toPort: 'top' },
    { id: 'c5', from: 'kb', fromPort: 'bottom', to: 'action_add', toPort: 'top' },
    // Connected KB folders to Knowledge base buttons
    { id: 'c6', from: 'action_create', fromPort: 'bottom', to: 'kb_folders', toPort: 'top' },
  ]);

  const [draggingConn, setDraggingConn] = useState<{ from: string, x: number, y: number, port: 'left'|'right'|'top'|'bottom' } | null>(null);
  const [hasFile, setHasFile] = useState(false);

  // Dynamic ports coordinates
  const getPortPos = (nodeId: string, port: 'left' | 'right' | 'top' | 'bottom') => {
    const pos = positions[nodeId];
    if (!pos) return { x: 0, y: 0 };
    
    if (nodeId === 'input') {
      return { x: pos.x + 220, y: pos.y + 70 };
    }
    if (nodeId === 'agent') {
      if (port === 'left') return { x: pos.x, y: pos.y + 60 };
      if (port === 'right') return { x: pos.x + 300, y: pos.y + 60 };
      if (port === 'bottom') return { x: pos.x + 150, y: pos.y + 180 };
    }
    if (nodeId === 'kb') {
      if (port === 'left') return { x: pos.x, y: pos.y + 70 };
      if (port === 'bottom') return { x: pos.x + 120, y: pos.y + 140 };
    }
    if (nodeId === 'chat') {
      if (port === 'top') return { x: pos.x + 170, y: pos.y };
    }
    if (nodeId === 'action_create') {
      if (port === 'top') return { x: pos.x + 90, y: pos.y };
      if (port === 'bottom') return { x: pos.x + 90, y: pos.y + 44 };
    }
    if (nodeId === 'action_add') {
      if (port === 'top') return { x: pos.x + 90, y: pos.y };
    }
    if (nodeId === 'kb_folders') {
      if (port === 'top') return { x: pos.x + 130, y: pos.y };
    }
    return { x: pos.x, y: pos.y };
  };

  const handleDrag = (id: string, info: any) => {
    setPositions(prev => ({
      ...prev,
      [id]: {
        x: prev[id].x + info.delta.x,
        y: prev[id].y + info.delta.y,
      }
    }));
  };

  const drawCurve = (p1: NodePosition, p2: NodePosition, fromPort?: string, toPort?: string) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    let cp1x = p1.x;
    let cp1y = p1.y;
    let cp2x = p2.x;
    let cp2y = p2.y;

    if (fromPort === 'bottom') {
      cp1y = p1.y + Math.max(Math.abs(dy) * 0.5, 50);
    } else if (fromPort === 'top') {
      cp1y = p1.y - Math.max(Math.abs(dy) * 0.5, 50);
    } else if (fromPort === 'left') {
      cp1x = p1.x - Math.max(Math.abs(dx) * 0.5, 50);
    } else {
      cp1x = p1.x + Math.max(Math.abs(dx) * 0.5, 50);
    }

    if (toPort === 'top') {
      cp2y = p2.y - Math.max(Math.abs(dy) * 0.5, 50);
    } else if (toPort === 'bottom') {
      cp2y = p2.y + Math.max(Math.abs(dy) * 0.5, 50);
    } else if (toPort === 'right') {
      cp2x = p2.x + Math.max(Math.abs(dx) * 0.5, 50);
    } else {
      cp2x = p2.x - Math.max(Math.abs(dx) * 0.5, 50);
    }

    return `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingConn) {
      setDraggingConn(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  };

  const handleMouseUp = () => {
    if (draggingConn) {
      setDraggingConn(null);
    }
  };

  const startConnection = (e: React.MouseEvent, fromNodeId: string, port: 'left'|'right'|'top'|'bottom') => {
    e.stopPropagation();
    setDraggingConn({ from: fromNodeId, x: e.clientX, y: e.clientY, port });
  };

  const completeConnection = (toNodeId: string, toPort: 'left' | 'top' | 'right' | 'bottom') => {
    if (draggingConn && draggingConn.from !== toNodeId) {
      const newConn: Connection = {
        id: `c_${Date.now()}`,
        from: draggingConn.from,
        fromPort: draggingConn.port,
        to: toNodeId,
        toPort: toPort
      };
      setConnections(prev => [...prev, newConn]);
      setDraggingConn(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* SVG Connections Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="yellow-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dynamic Connections */}
        {connections.map(conn => {
          const p1 = getPortPos(conn.from, conn.fromPort);
          const p2 = getPortPos(conn.to, conn.toPort);
          
          // KB related paths glow yellow when running
          const isYellowPath = isRunning && (
            conn.to === 'kb_folders' || 
            conn.to === 'action_create' || 
            conn.to === 'action_add' || 
            conn.from === 'kb' ||
            conn.from === 'action_create'
          );
          
          const strokeColor = isYellowPath ? "#ffcc00" : (isRunning ? "#22ff88" : "rgba(255,255,255,0.15)");
          const filterUrl = isYellowPath ? "url(#yellow-glow)" : (isRunning ? "url(#neon-glow)" : "");
          
          return (
            <React.Fragment key={conn.id}>
              <path
                d={drawCurve(p1, p2, conn.fromPort, conn.toPort)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isRunning ? 3 : 2}
                filter={filterUrl}
                className="transition-all duration-500 ease-in-out"
              />
              {isRunning && (
                <circle r={isYellowPath ? "5" : "4"} fill={strokeColor} filter={filterUrl}>
                  <animateMotion dur={conn.from === 'input' ? "2s" : "2.5s"} repeatCount="indefinite" path={drawCurve(p1, p2, conn.fromPort, conn.toPort)} />
                </circle>
              )}
            </React.Fragment>
          );
        })}

        {/* Dragging Connection */}
        {draggingConn && (
          <path
            d={drawCurve(getPortPos(draggingConn.from, draggingConn.port), { x: draggingConn.x, y: draggingConn.y }, draggingConn.port, 'left')}
            fill="none"
            stroke="#22ff88"
            strokeWidth="2"
            strokeDasharray="5,5"
            className="opacity-50 pointer-events-none"
          />
        )}
      </svg>

      {/* NODES */}
      
      {/* 1. Input Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('input', info)}
        initial={false}
        animate={{ x: positions.input.x, y: positions.input.y }}
        className="absolute z-10 w-[220px]"
      >
        <div 
          onClick={() => setHasFile(!hasFile)}
          className={`cursor-pointer rounded-2xl p-5 backdrop-blur-xl border transition-all duration-500 shadow-2xl flex flex-col items-center gap-4 group ${
            hasFile 
              ? 'bg-[#22ff88]/10 border-[#22ff88]/40 shadow-[0_0_30px_rgba(34,255,136,0.15)]' 
              : 'bg-white/5 border-white/10 hover:border-[#22ff88]/30 hover:bg-white/10'
          }`}
        >
          <div 
            onMouseDown={(e) => startConnection(e, 'input', 'right')}
            className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20" 
          />
          
          <div className="relative w-16 h-20 bg-white/5 border border-white/20 rounded-lg flex items-center justify-center overflow-hidden">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: hasFile ? 0 : 50, opacity: hasFile ? 1 : 0 }}
              className="absolute inset-2 bg-white rounded flex items-center justify-center shadow-inner"
            >
              <FileText className="w-6 h-6 text-black/40" />
            </motion.div>
            
            <div className={`absolute inset-0 border-t border-white/20 rounded-lg backdrop-blur-md transition-all duration-500 origin-bottom ${
              hasFile ? 'bg-[#22ff88]/20 rotate-x-12 translate-y-2' : 'bg-white/10'
            }`}></div>
          </div>
          
          <div className="text-center">
            <h3 className="text-sm font-medium text-white">{hasFile ? 'data_q3.csv' : 'New file to compare'}</h3>
            <p className="text-xs text-white/40 mt-1">{hasFile ? 'Ready for analysis' : 'Click to add file'}</p>
          </div>
        </div>
      </motion.div>

      {/* 2. Main Agent Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('agent', info)}
        initial={false}
        animate={{ x: positions.agent.x, y: positions.agent.y }}
        className="absolute z-20 w-[300px]"
      >
        <div className={`rounded-2xl backdrop-blur-xl border transition-all duration-500 shadow-2xl overflow-hidden group ${
          isRunning 
            ? 'bg-[#22ff88]/5 border-[#22ff88]/50 shadow-[0_0_40px_rgba(34,255,136,0.2)]' 
            : 'bg-black/40 border-white/10 hover:border-white/20'
        }`}>
          <div 
            onMouseUp={() => completeConnection('agent', 'left')}
            className="absolute left-[-6px] top-[60px] -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />
          <div 
            onMouseUp={() => completeConnection('agent', 'right')}
            className="absolute right-[-6px] top-[60px] -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />
          <div 
            onMouseUp={() => completeConnection('agent', 'bottom')}
            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />

          <div className="p-4 border-b border-white/5 flex items-start justify-between relative overflow-hidden">
            {isRunning && (
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#22ff88]/10 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
            )}
            <div className="flex gap-3 relative z-10">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isRunning ? 'bg-[#22ff88]/20 border border-[#22ff88]/50 text-[#22ff88]' : 'bg-white/10 border border-white/20 text-white/70'
              }`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                  AI Metodist
                  {isRunning && <CheckCircle className="w-4 h-4 text-[#22ff88]" />}
                </h3>
                <p className="text-xs text-white/50">Claude Agent (claude-3-5-sonnet)</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-medium">{isRunning ? 'Running' : 'Idle'}</span>
              <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${
                isRunning ? 'bg-[#22ff88] text-[#22ff88] animate-pulse' : 'bg-white/30 text-transparent'
              }`} />
            </div>
          </div>

          <div className="p-3 bg-white/[0.02]">
            <div className="space-y-1.5">
              {[
                { name: 'Chat model', active: isRunning },
                { name: 'Connect', active: isRunning },
                { name: 'Tool (API)', active: false }
              ].map((tool, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-medium text-white/70">
                  <div className="flex items-center gap-2">
                    <Plug className="w-3.5 h-3.5 text-white/40" />
                    {tool.name}
                  </div>
                  {tool.active && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-1.5 h-1.5 rounded-full bg-[#22ff88]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3. Knowledge Base Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('kb', info)}
        initial={false}
        animate={{ x: positions.kb.x, y: positions.kb.y }}
        className="absolute z-10 w-[240px]"
      >
        <div className={`rounded-2xl p-5 bg-white/5 backdrop-blur-xl border ${isRunning ? 'border-[#ffcc00]/50 shadow-[0_0_30px_rgba(255,204,0,0.15)]' : 'border-[#22ff88]/30 shadow-[0_0_30px_rgba(34,255,136,0.05)]'} transition-all duration-500 group hover:border-[#22ff88]/60 hover:shadow-[0_0_30px_rgba(34,255,136,0.15)]`}>
          <div 
            onMouseUp={() => completeConnection('kb', 'left')}
            className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />
          <div 
            onMouseDown={(e) => startConnection(e, 'kb', 'bottom')}
            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20" 
          />

          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <div className={`absolute inset-0 ${isRunning ? 'bg-[#ffcc00]/20' : 'bg-[#22ff88]/20'} blur-xl rounded-full transition-colors duration-500`} />
              <div className={`w-16 h-16 rounded-2xl ${isRunning ? 'bg-[#ffcc00]/10 border-[#ffcc00]/40' : 'bg-[#22ff88]/10 border-[#22ff88]/40'} border flex items-center justify-center relative z-10 transition-colors duration-500`}>
                <Database className={`w-8 h-8 ${isRunning ? 'text-[#ffcc00]' : 'text-[#22ff88]'} transition-colors duration-500`} />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Knowledge Base</h3>
              <p className="text-xs text-white/50 mt-1">12 connected folders</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 4. ChatPanel Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('chat', info)}
        initial={false}
        animate={{ x: positions.chat.x, y: positions.chat.y }}
        className="absolute z-30"
      >
        <div className="relative group">
          <div 
            onMouseDown={(e) => startConnection(e, 'chat', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-40" 
          />
          <ChatPanel />
        </div>
      </motion.div>

      {/* 5. Create Folders Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('action_create', info)}
        initial={false}
        animate={{ x: positions.action_create.x, y: positions.action_create.y }}
        className="absolute z-10 w-[180px]"
      >
        <div className="relative group">
          <div 
            onMouseUp={() => completeConnection('action_create', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />
          <div 
            onMouseDown={(e) => startConnection(e, 'action_create', 'bottom')}
            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20" 
          />
          <button className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/5 border ${isRunning ? 'border-[#ffcc00]/50 bg-[#ffcc00]/10 text-white shadow-[0_0_15px_rgba(255,204,0,0.2)]' : 'border-white/10 hover:border-[#22ff88]/50 hover:bg-[#22ff88]/10 text-white/80 hover:text-white'} text-sm font-medium transition-all shadow-lg backdrop-blur-md`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRunning ? 'text-[#ffcc00]' : 'text-white/50 group-hover:text-[#22ff88]'}><path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
            <span>Create folders</span>
          </button>
        </div>
      </motion.div>

      {/* 6. Add Files Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('action_add', info)}
        initial={false}
        animate={{ x: positions.action_add.x, y: positions.action_add.y }}
        className="absolute z-10 w-[180px]"
      >
        <div className="relative group">
          <div 
            onMouseUp={() => completeConnection('action_add', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />
          <button className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white/5 border ${isRunning ? 'border-[#ffcc00]/50 bg-[#ffcc00]/10 text-white shadow-[0_0_15px_rgba(255,204,0,0.2)]' : 'border-white/10 hover:border-[#22ff88]/50 hover:bg-[#22ff88]/10 text-white/80 hover:text-white'} text-sm font-medium transition-all shadow-lg backdrop-blur-md`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isRunning ? 'text-[#ffcc00]' : 'text-white/50 group-hover:text-[#22ff88]'}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/></svg>
            <span>Add files</span>
          </button>
        </div>
      </motion.div>

      {/* 7. KB Folders Dynamic Grid Node */}
      <motion.div
        drag
        dragConstraints={containerRef}
        dragMomentum={false}
        onDrag={(e, info) => handleDrag('kb_folders', info)}
        initial={false}
        animate={{ x: positions.kb_folders.x, y: positions.kb_folders.y }}
        className="absolute z-10 w-[260px]"
      >
        <div className="relative group">
          <div 
            onMouseUp={() => completeConnection('kb_folders', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#ffcc00] border-2 border-black/80 shadow-[0_0_10px_#ffcc00] opacity-0 group-hover:opacity-100 transition-opacity z-20" 
          />
          <div className="grid grid-cols-3 gap-3 w-full p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5">
            <h4 className="col-span-3 text-xs font-semibold text-white/50 text-center mb-1">Folders from KB</h4>
            
            {generatedItems.length > 0 ? generatedItems.map((id) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: id * 0.1, duration: 0.3 }}
                key={id}
                className={`aspect-square bg-white/5 backdrop-blur-md border ${isRunning ? 'border-[#ffcc00]/50 shadow-[0_0_15px_rgba(255,204,0,0.2)]' : 'border-[#22ff88]/30 shadow-[0_0_15px_rgba(34,255,136,0.1)]'} rounded-xl flex flex-col items-center justify-center gap-2 hover:border-[#ffcc00] hover:bg-[#ffcc00]/10 transition-colors cursor-pointer group/folder`}
              >
                <Folder className={`w-6 h-6 ${isRunning ? 'text-[#ffcc00]/80 group-hover/folder:text-[#ffcc00]' : 'text-[#22ff88]/60 group-hover/folder:text-[#22ff88]'} transition-colors`} />
                <div className="flex gap-1 mt-1">
                  <div className={`w-2 h-3 rounded-[2px] bg-white/20 border border-white/30 ${isRunning ? 'group-hover/folder:bg-[#ffcc00]/30 group-hover/folder:border-[#ffcc00]/50' : 'group-hover/folder:bg-[#22ff88]/20 group-hover/folder:border-[#22ff88]/40'} transition-colors`}></div>
                  <div className={`w-2 h-3 rounded-[2px] bg-white/20 border border-white/30 ${isRunning ? 'group-hover/folder:bg-[#ffcc00]/30 group-hover/folder:border-[#ffcc00]/50' : 'group-hover/folder:bg-[#22ff88]/20 group-hover/folder:border-[#22ff88]/40'} transition-colors`}></div>
                  <div className={`w-2 h-3 rounded-[2px] bg-white/20 border border-white/30 ${isRunning ? 'group-hover/folder:bg-[#ffcc00]/30 group-hover/folder:border-[#ffcc00]/50' : 'group-hover/folder:bg-[#22ff88]/20 group-hover/folder:border-[#22ff88]/40'} transition-colors`}></div>
                </div>
              </motion.div>
            )) : (
              <div className="col-span-3 flex items-center justify-center h-[80px] text-white/30 text-xs">
                {isRunning ? (
                  <span className="flex items-center gap-2 text-[#ffcc00]/80">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-3 h-3 border-2 border-[#ffcc00]/30 border-t-[#ffcc00] rounded-full" />
                    Syncing...
                  </span>
                ) : (
                  <span>No folders loaded</span>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
