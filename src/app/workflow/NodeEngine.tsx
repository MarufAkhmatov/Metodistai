import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Database,
  Sparkles,
  CheckCircle,
  Plug,
  Folder,
  FolderArchive,
  FileIcon,
  Save,
  X,
} from 'lucide-react';
import { WorkflowChat, type KbFolder } from './WorkflowChat';

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

// Chat panel default geometry — port hisoblash uchun NodeEngine bilan sinxron.
const CHAT_BASE_W = 468;
const CHAT_BASE_H = 368;

export function NodeEngine({ isRunning, generatedItems = [] }: { isRunning: boolean; generatedItems?: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial positions — kichraytirilgan tugunlar uchun moslangan.
  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 600;
  const innerH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const chatY = Math.max(innerH - CHAT_BASE_H - 80, 360);

  const [positions, setPositions] = useState<Record<string, NodePosition>>({
    input: { x: centerX - 400, y: 170 },
    agent: { x: centerX - 120, y: 130 },
    kb: { x: centerX + 200, y: 90 },
    chat: { x: centerX - CHAT_BASE_W / 2, y: chatY },
    action_create: { x: centerX + 160, y: 260 },
    action_add: { x: centerX + 320, y: 260 },
    kb_folders: { x: centerX + 200, y: 340 },
    archive: { x: centerX + 460, y: 460 },
  });

  const [connections, setConnections] = useState<Connection[]>([
    { id: 'c1', from: 'input', fromPort: 'right', to: 'agent', toPort: 'left' },
    { id: 'c2', from: 'agent', fromPort: 'right', to: 'kb', toPort: 'left' },
    { id: 'c3', from: 'chat', fromPort: 'top', to: 'agent', toPort: 'bottom' },
    { id: 'c4', from: 'kb', fromPort: 'bottom', to: 'action_create', toPort: 'top' },
    { id: 'c5', from: 'kb', fromPort: 'bottom', to: 'action_add', toPort: 'top' },
    { id: 'c6', from: 'action_create', fromPort: 'bottom', to: 'kb_folders', toPort: 'top' },
  ]);

  const [draggingConn, setDraggingConn] = useState<{ from: string; x: number; y: number; port: 'left' | 'right' | 'top' | 'bottom' } | null>(null);

  // --- Chat-driven workflow state ---
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [kbMatches, setKbMatches] = useState<KbFolder[]>([]);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [folderCount, setFolderCount] = useState<number | null>(null);

  // --- Save / archive state ---
  type Analysis = { id: string; text: string };
  const [lastAnalysis, setLastAnalysis] = useState<Analysis | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [archiveCount, setArchiveCount] = useState(0);
  const [archivePulse, setArchivePulse] = useState(false);
  const [kbPromptDismissed, setKbPromptDismissed] = useState<string | null>(null); // analysis id
  const [savingKb, setSavingKb] = useState(false);
  const [flying, setFlying] = useState<
    { key: number; from: NodePosition; to: NodePosition } | null
  >(null);

  const running = isRunning || chatBusy;
  const hasFile = chatFile !== null;

  // Real Knowledge Base folder count.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/folders')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.folders)) {
          setFolderCount(data.folders.length);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Archive folder size (saved docx count).
  const refreshArchive = () => {
    fetch('/api/archive/files')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.files)) setArchiveCount(data.files.length);
      })
      .catch(() => {});
  };
  useEffect(() => {
    refreshArchive();
  }, []);

  // Archive node tagged to bottom-right after container measures.
  useEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      setPositions((prev) => ({
        ...prev,
        archive: { x: Math.max(0, rect.width - 220), y: Math.max(0, rect.height - 220) },
      }));
    }
  }, []);

  // --- Node dragging (manual pointer events) ---
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: MouseEvent) => {
      setPositions((prev) => {
        const cur = prev[dragId];
        if (!cur) return prev;
        let nx = cur.x + e.movementX;
        let ny = cur.y + e.movementY;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          nx = Math.min(Math.max(nx, 0), Math.max(rect.width - 60, 0));
          ny = Math.min(Math.max(ny, 0), Math.max(rect.height - 40, 0));
        }
        return { ...prev, [dragId]: { x: nx, y: ny } };
      });
    };
    const onUp = () => setDragId(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragId]);

  const startNodeDrag = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setDragId(id);
  };

  const nodeStyle = (id: string): React.CSSProperties => ({
    transform: `translate(${positions[id].x}px, ${positions[id].y}px)`,
  });

  // Dynamic port coordinates — kichraytirilgan tugunlarga moslangan.
  const getPortPos = (nodeId: string, port: 'left' | 'right' | 'top' | 'bottom') => {
    const pos = positions[nodeId];
    if (!pos) return { x: 0, y: 0 };

    if (nodeId === 'input') {
      // w-[176px]
      return { x: pos.x + 176, y: pos.y + 56 };
    }
    if (nodeId === 'agent') {
      // w-[240px]
      if (port === 'left') return { x: pos.x, y: pos.y + 48 };
      if (port === 'right') return { x: pos.x + 240, y: pos.y + 48 };
      if (port === 'bottom') return { x: pos.x + 120, y: pos.y + 150 };
    }
    if (nodeId === 'kb') {
      // w-[192px]
      if (port === 'left') return { x: pos.x, y: pos.y + 56 };
      if (port === 'bottom') return { x: pos.x + 96, y: pos.y + 112 };
    }
    if (nodeId === 'chat') {
      if (port === 'top') return { x: pos.x + CHAT_BASE_W / 2, y: pos.y };
    }
    if (nodeId === 'action_create') {
      if (port === 'top') return { x: pos.x + 72, y: pos.y };
      if (port === 'bottom') return { x: pos.x + 72, y: pos.y + 40 };
    }
    if (nodeId === 'action_add') {
      if (port === 'top') return { x: pos.x + 72, y: pos.y };
    }
    if (nodeId === 'kb_folders') {
      // w-[224px]
      if (port === 'top') return { x: pos.x + 112, y: pos.y };
    }
    return { x: pos.x, y: pos.y };
  };

  // Node markazi — flying animatsiya manbai uchun.
  const nodeCenter = (id: string): NodePosition => {
    const pos = positions[id];
    if (!pos) return { x: 0, y: 0 };
    const sizes: Record<string, [number, number]> = {
      input: [176, 180],
      agent: [240, 170],
      kb: [192, 170],
      chat: [CHAT_BASE_W, CHAT_BASE_H],
      action_create: [144, 40],
      action_add: [144, 40],
      kb_folders: [224, 100],
      archive: [176, 180],
    };
    const [w, h] = sizes[id] || [120, 80];
    return { x: pos.x + w / 2, y: pos.y + h / 2 };
  };

  const drawCurve = (p1: NodePosition, p2: NodePosition, fromPort?: string, toPort?: string) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let cp1x = p1.x;
    let cp1y = p1.y;
    let cp2x = p2.x;
    let cp2y = p2.y;

    if (fromPort === 'bottom') cp1y = p1.y + Math.max(Math.abs(dy) * 0.5, 50);
    else if (fromPort === 'top') cp1y = p1.y - Math.max(Math.abs(dy) * 0.5, 50);
    else if (fromPort === 'left') cp1x = p1.x - Math.max(Math.abs(dx) * 0.5, 50);
    else cp1x = p1.x + Math.max(Math.abs(dx) * 0.5, 50);

    if (toPort === 'top') cp2y = p2.y - Math.max(Math.abs(dy) * 0.5, 50);
    else if (toPort === 'bottom') cp2y = p2.y + Math.max(Math.abs(dy) * 0.5, 50);
    else if (toPort === 'right') cp2x = p2.x + Math.max(Math.abs(dx) * 0.5, 50);
    else cp2x = p2.x - Math.max(Math.abs(dx) * 0.5, 50);

    return `M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingConn) {
      setDraggingConn((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    }
  };
  const handleMouseUp = () => {
    if (draggingConn) setDraggingConn(null);
  };

  const startConnection = (e: React.MouseEvent, fromNodeId: string, port: 'left' | 'right' | 'top' | 'bottom') => {
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
        toPort: toPort,
      };
      setConnections((prev) => [...prev, newConn]);
      setDraggingConn(null);
    }
  };
  const stopMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const openKbFile = (relPath: string) => {
    window.open(`/api/kb/file?path=${encodeURIComponent(relPath)}`, '_blank', 'noopener');
  };

  const triggerFly = (fromId: string) => {
    const from = nodeCenter(fromId);
    const to = nodeCenter('archive');
    setFlying({ key: Date.now(), from, to });
  };

  // --- Save flow ---
  const performSave = async (text: string, fromId: string): Promise<{ ok: boolean }> => {
    try {
      triggerFly(fromId);
      const res = await fetch('/api/save-archive', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ markdown: text }),
      });
      if (!res.ok) {
        setFlying(null);
        return { ok: false };
      }
      await res.json().catch(() => null);
      // Yetib borgan deb hisoblaymiz; archive count'ni yangilash flying tugaganda.
      return { ok: true };
    } catch {
      setFlying(null);
      return { ok: false };
    }
  };

  const saveFromChat = async (text: string, id: string) => {
    const r = await performSave(text, 'chat');
    if (r.ok) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
    return r;
  };

  const saveFromKb = async () => {
    if (!lastAnalysis || savingKb) return;
    setSavingKb(true);
    try {
      const r = await performSave(lastAnalysis.text, 'kb_folders');
      if (r.ok) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.add(lastAnalysis.id);
          return next;
        });
        setKbPromptDismissed(lastAnalysis.id);
      }
    } finally {
      setSavingKb(false);
    }
  };

  const onAnalysis = (text: string, id: string) => {
    setLastAnalysis({ text, id });
    setKbPromptDismissed(null);
  };

  // KB bubble ko'rinishi
  const showKbPrompt =
    !!lastAnalysis &&
    kbMatches.length > 0 &&
    !savedIds.has(lastAnalysis.id) &&
    kbPromptDismissed !== lastAnalysis.id;

  return (
    <div ref={containerRef} className="w-full h-full relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* SVG Connections */}
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

        {connections.map((conn) => {
          const p1 = getPortPos(conn.from, conn.fromPort);
          const p2 = getPortPos(conn.to, conn.toPort);

          const isYellowPath =
            running &&
            (conn.to === 'kb_folders' ||
              conn.to === 'action_create' ||
              conn.to === 'action_add' ||
              conn.from === 'kb' ||
              conn.from === 'action_create');

          const strokeColor = isYellowPath ? '#ffcc00' : running ? '#22ff88' : 'rgba(255,255,255,0.15)';
          const filterUrl = isYellowPath ? 'url(#yellow-glow)' : running ? 'url(#neon-glow)' : '';

          return (
            <React.Fragment key={conn.id}>
              <path
                d={drawCurve(p1, p2, conn.fromPort, conn.toPort)}
                fill="none"
                stroke={strokeColor}
                strokeWidth={running ? 3 : 2}
                filter={filterUrl}
                className="transition-all duration-500 ease-in-out"
              />
              {running && (
                <circle r={isYellowPath ? '5' : '4'} fill={strokeColor} filter={filterUrl}>
                  <animateMotion
                    dur={conn.from === 'input' ? '2s' : '2.5s'}
                    repeatCount="indefinite"
                    path={drawCurve(p1, p2, conn.fromPort, conn.toPort)}
                  />
                </circle>
              )}
            </React.Fragment>
          );
        })}

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

      {/* 1. Input — "New file to compare" */}
      <div
        style={nodeStyle('input')}
        onMouseDown={(e) => startNodeDrag(e, 'input')}
        className="absolute top-0 left-0 z-10 w-[176px] cursor-grab active:cursor-grabbing"
      >
        <div
          className={`rounded-2xl p-3 backdrop-blur-xl border transition-all duration-500 shadow-2xl flex flex-col items-center gap-3 group ${
            hasFile
              ? 'bg-[#22ff88]/10 border-[#22ff88]/40 shadow-[0_0_30px_rgba(34,255,136,0.15)]'
              : 'bg-white/5 border-white/10 hover:border-[#22ff88]/30 hover:bg-white/10'
          }`}
        >
          <div
            onMouseDown={(e) => startConnection(e, 'input', 'right')}
            className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20"
          />

          {/* Inner grey file box — kichraytirilgan (w-16 h-20 dan ~40% kichik) */}
          <div className="relative w-[44px] h-14 bg-white/5 border border-white/20 rounded-lg flex items-center justify-center overflow-hidden">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: hasFile ? 0 : 50, opacity: hasFile ? 1 : 0 }}
              className="absolute inset-1.5 bg-white rounded flex items-center justify-center shadow-inner"
            >
              <FileText className="w-4 h-4 text-black/40" />
            </motion.div>

            <div
              className={`absolute inset-0 border-t border-white/20 rounded-lg backdrop-blur-md transition-all duration-500 origin-bottom ${
                hasFile ? 'bg-[#22ff88]/20 rotate-x-12 translate-y-2' : 'bg-white/10'
              }`}
            />
          </div>

          <div className="text-center w-full">
            <h3 className="text-[12px] font-medium text-white truncate">{hasFile ? chatFile!.name : 'New file to compare'}</h3>
            <p className="text-[10px] text-white/40 mt-0.5">
              {hasFile ? (chatBusy ? 'Analyzing…' : 'Ready for analysis') : 'Upload via chat'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Main Agent — Claude agent ishlayotganini ko'rsatadi */}
      <div
        style={nodeStyle('agent')}
        onMouseDown={(e) => startNodeDrag(e, 'agent')}
        className="absolute top-0 left-0 z-20 w-[240px] cursor-grab active:cursor-grabbing"
      >
        <div
          className={`rounded-2xl backdrop-blur-xl border transition-all duration-500 shadow-2xl overflow-hidden group ${
            running
              ? 'bg-[#22ff88]/5 border-[#22ff88]/50 shadow-[0_0_40px_rgba(34,255,136,0.2)]'
              : 'bg-black/40 border-white/10 hover:border-white/20'
          }`}
        >
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('agent', 'left')}
            className="absolute left-[-6px] top-[48px] -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('agent', 'right')}
            className="absolute right-[-6px] top-[48px] -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('agent', 'bottom')}
            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />

          <div className="p-3 border-b border-white/5 flex items-start justify-between relative overflow-hidden">
            {running && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#22ff88]/10 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              />
            )}
            <div className="flex gap-2.5 relative z-10">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  running ? 'bg-[#22ff88]/20 border border-[#22ff88]/50 text-[#22ff88]' : 'bg-white/10 border border-white/20 text-white/70'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                  AI Metodist
                  {running && <CheckCircle className="w-3.5 h-3.5 text-[#22ff88]" />}
                </h3>
                <p className="text-[10px] text-white/50">Claude Agent (claude-3-5-sonnet)</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-medium">{running ? 'Running' : 'Idle'}</span>
              <div
                className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] ${
                  running ? 'bg-[#22ff88] text-[#22ff88] animate-pulse' : 'bg-white/30 text-transparent'
                }`}
              />
            </div>
          </div>

          <div className="p-2.5 bg-white/[0.02]">
            <div className="space-y-1">
              {[
                { name: 'Chat model', active: running },
                { name: 'Connect', active: running },
                { name: 'Tool (API)', active: false },
              ].map((tool, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-medium text-white/70"
                >
                  <div className="flex items-center gap-2">
                    <Plug className="w-3 h-3 text-white/40" />
                    {tool.name}
                  </div>
                  {tool.active && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-1.5 h-1.5 rounded-full bg-[#22ff88]" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Knowledge Base */}
      <div
        style={nodeStyle('kb')}
        onMouseDown={(e) => startNodeDrag(e, 'kb')}
        className="absolute top-0 left-0 z-10 w-[192px] cursor-grab active:cursor-grabbing"
      >
        <div
          className={`rounded-2xl p-4 bg-white/5 backdrop-blur-xl border ${
            running ? 'border-[#ffcc00]/50 shadow-[0_0_30px_rgba(255,204,0,0.15)]' : 'border-[#22ff88]/30 shadow-[0_0_30px_rgba(34,255,136,0.05)]'
          } transition-all duration-500 group hover:border-[#22ff88]/60 hover:shadow-[0_0_30px_rgba(34,255,136,0.15)]`}
        >
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('kb', 'left')}
            className="absolute left-[-6px] top-[56px] -translate-y-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />
          <div
            onMouseDown={(e) => startConnection(e, 'kb', 'bottom')}
            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20"
          />

          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <div className={`absolute inset-0 ${running ? 'bg-[#ffcc00]/20' : 'bg-[#22ff88]/20'} blur-xl rounded-full transition-colors duration-500`} />
              <div
                className={`w-14 h-14 rounded-2xl ${
                  running ? 'bg-[#ffcc00]/10 border-[#ffcc00]/40' : 'bg-[#22ff88]/10 border-[#22ff88]/40'
                } border flex items-center justify-center relative z-10 transition-colors duration-500`}
              >
                <Database className={`w-7 h-7 ${running ? 'text-[#ffcc00]' : 'text-[#22ff88]'} transition-colors duration-500`} />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Knowledge Base</h3>
              <p className="text-[11px] text-white/50 mt-0.5">
                {folderCount === null ? 'Loading…' : `${folderCount} connected folders`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Chat */}
      <div style={nodeStyle('chat')} className="absolute top-0 left-0 z-30">
        <div className="relative group">
          <div
            onMouseDown={(e) => startConnection(e, 'chat', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-40"
          />
          <WorkflowChat
            onFileChange={setChatFile}
            onBusyChange={setChatBusy}
            onKbMatches={setKbMatches}
            onAnalysis={onAnalysis}
            onSaveRequest={saveFromChat}
            savedIds={savedIds}
            onHeaderMouseDown={(e) => startNodeDrag(e, 'chat')}
          />
        </div>
      </div>

      {/* 5. Create Folders */}
      <div
        style={nodeStyle('action_create')}
        onMouseDown={(e) => startNodeDrag(e, 'action_create')}
        className="absolute top-0 left-0 z-10 w-[144px] cursor-grab active:cursor-grabbing"
      >
        <div className="relative group">
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('action_create', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />
          <div
            onMouseDown={(e) => startConnection(e, 'action_create', 'bottom')}
            className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20"
          />
          <div
            className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-white/5 border ${
              running
                ? 'border-[#ffcc00]/50 bg-[#ffcc00]/10 text-white shadow-[0_0_15px_rgba(255,204,0,0.2)]'
                : 'border-white/10 group-hover:border-[#22ff88]/50 group-hover:bg-[#22ff88]/10 text-white/80 group-hover:text-white'
            } text-[12px] font-medium transition-all shadow-lg backdrop-blur-md`}
          >
            <Folder size={13} className={running ? 'text-[#ffcc00]' : 'text-white/50 group-hover:text-[#22ff88]'} />
            <span>Create folders</span>
          </div>
        </div>
      </div>

      {/* 6. Add Files */}
      <div
        style={nodeStyle('action_add')}
        onMouseDown={(e) => startNodeDrag(e, 'action_add')}
        className="absolute top-0 left-0 z-10 w-[144px] cursor-grab active:cursor-grabbing"
      >
        <div className="relative group">
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('action_add', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#22ff88] border-2 border-black/80 shadow-[0_0_10px_#22ff88] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />
          <div
            className={`flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-white/5 border ${
              running
                ? 'border-[#ffcc00]/50 bg-[#ffcc00]/10 text-white shadow-[0_0_15px_rgba(255,204,0,0.2)]'
                : 'border-white/10 group-hover:border-[#22ff88]/50 group-hover:bg-[#22ff88]/10 text-white/80 group-hover:text-white'
            } text-[12px] font-medium transition-all shadow-lg backdrop-blur-md`}
          >
            <FileIcon size={13} className={running ? 'text-[#ffcc00]' : 'text-white/50 group-hover:text-[#22ff88]'} />
            <span>Add files</span>
          </div>
        </div>
      </div>

      {/* 7. Folders from KB + save bubble */}
      <div style={nodeStyle('kb_folders')} className="absolute top-0 left-0 z-10 w-[224px]">
        <div className="relative group">
          <div
            onMouseDown={stopMouseDown}
            onMouseUp={() => completeConnection('kb_folders', 'top')}
            className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#ffcc00] border-2 border-black/80 shadow-[0_0_10px_#ffcc00] opacity-0 group-hover:opacity-100 transition-opacity z-20"
          />
          <div className="w-full p-3 rounded-2xl bg-black/20 backdrop-blur-md border border-white/5">
            <h4
              onMouseDown={(e) => startNodeDrag(e, 'kb_folders')}
              className="text-[11px] font-semibold text-white/50 text-center mb-2 cursor-grab active:cursor-grabbing select-none"
            >
              Folders from KB
            </h4>

            {kbMatches.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                {kbMatches.map((dept) => {
                  const isOpen = openFolder === dept.folder;
                  return (
                    <div key={dept.folder} className="rounded-lg bg-white/5 border border-[#ffcc00]/30 overflow-hidden">
                      <button
                        onMouseDown={stopMouseDown}
                        onClick={() => setOpenFolder(isOpen ? null : dept.folder)}
                        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[#ffcc00]/10 transition-colors"
                      >
                        <Folder className="w-3.5 h-3.5 text-[#ffcc00] shrink-0" />
                        <span className="text-[11px] font-medium text-white/90 truncate flex-1">{dept.folder}</span>
                        <span className="text-[9px] text-white/40 shrink-0">{dept.files.length}</span>
                      </button>
                      {isOpen && (
                        <div className="px-1.5 pb-1.5 flex flex-col gap-0.5">
                          {dept.files.map((f) => (
                            <button
                              key={f.relPath}
                              onMouseDown={stopMouseDown}
                              onClick={() => openKbFile(f.relPath)}
                              className="flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left hover:bg-[#22ff88]/10 transition-colors group/file"
                              title={f.relPath}
                            >
                              <FileIcon className="w-3 h-3 text-white/40 group-hover/file:text-[#22ff88] shrink-0" />
                              <span className="text-[10px] text-white/70 group-hover/file:text-white truncate">{f.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : generatedItems.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {generatedItems.map((id) => (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: id * 0.1, duration: 0.3 }}
                    key={id}
                    className={`aspect-square bg-white/5 backdrop-blur-md border ${
                      running ? 'border-[#ffcc00]/50 shadow-[0_0_15px_rgba(255,204,0,0.2)]' : 'border-[#22ff88]/30 shadow-[0_0_15px_rgba(34,255,136,0.1)]'
                    } rounded-lg flex items-center justify-center`}
                  >
                    <Folder className={`w-5 h-5 ${running ? 'text-[#ffcc00]/80' : 'text-[#22ff88]/60'} transition-colors`} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[60px] text-white/30 text-[11px]">
                {chatBusy ? (
                  <span className="flex items-center gap-2 text-[#ffcc00]/80">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-3 h-3 border-2 border-[#ffcc00]/30 border-t-[#ffcc00] rounded-full"
                    />
                    Comparing…
                  </span>
                ) : (
                  <span>No related folders yet</span>
                )}
              </div>
            )}
          </div>

          {/* Speech bubble: "Save these analyses?" */}
          <AnimatePresence>
            {showKbPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute -right-2 -top-2 translate-x-full w-[200px] z-30"
                onMouseDown={stopMouseDown}
              >
                <div className="relative bg-[#ffcc00]/10 border border-[#ffcc00]/40 backdrop-blur-xl rounded-2xl p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                  <div className="absolute left-[-6px] top-4 w-3 h-3 rotate-45 bg-[#ffcc00]/10 border-l border-b border-[#ffcc00]/40" />
                  <p className="text-[11px] text-white/85 leading-snug mb-2">
                    Ushbu analizlarni Word'ga saqlashni xohlaysizmi?
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={saveFromKb}
                      disabled={savingKb}
                      className="flex-1 px-2 py-1 rounded-lg bg-[#ffcc00] hover:bg-[#ffcc00]/90 disabled:bg-white/10 disabled:text-white/30 text-black text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Save size={11} /> {savingKb ? 'Saving…' : "Ha, saqla"}
                    </button>
                    <button
                      onClick={() => lastAnalysis && setKbPromptDismissed(lastAnalysis.id)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[11px] flex items-center justify-center"
                      aria-label="Yopish"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 8. Archive folder — sariq neomorph (o'ng-quyi burchak) */}
      <div
        style={nodeStyle('archive')}
        onMouseDown={(e) => startNodeDrag(e, 'archive')}
        className="absolute top-0 left-0 z-10 w-[176px] cursor-grab active:cursor-grabbing"
      >
        <motion.div
          animate={{
            scale: archivePulse ? 1.05 : 1,
            boxShadow: archivePulse
              ? '0 0 40px rgba(255,204,0,0.5), inset 0 -4px 0 rgba(0,0,0,0.25)'
              : '0 12px 28px rgba(0,0,0,0.55), inset 0 -4px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
          transition={{ duration: 0.35 }}
          className="relative rounded-2xl p-4 flex flex-col items-center gap-2 border border-[#ffcc00]/40 bg-gradient-to-br from-[#3a2f00] via-[#251d00] to-[#15110b]"
        >
          <div className="absolute -top-2 left-3 right-3 h-3 rounded-t-md bg-gradient-to-b from-[#ffcc00]/80 to-[#a37d00]/80 border-x border-t border-[#ffcc00]/50" />
          <div className="relative w-16 h-12 mt-1">
            <div className="absolute inset-0 rounded-md bg-gradient-to-b from-[#ffd84a] to-[#c08e00] shadow-[0_4px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.4)] border border-[#ffd84a]/80" />
            <FolderArchive className="absolute inset-0 m-auto w-8 h-8 text-[#3a2700]" />
            {archiveCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff5252] border-2 border-[#15110b] text-white text-[10px] font-bold flex items-center justify-center shadow">
                {archiveCount}
              </div>
            )}
          </div>
          <div className="text-center">
            <h3 className="text-[12px] font-semibold text-[#ffe27a] tracking-wide">Archive folder</h3>
            <p className="text-[10px] text-[#ffe27a]/60 mt-0.5" title="Local: <AGENT_DIR>/Archive folder/">
              {archiveCount} saved {archiveCount === 1 ? 'file' : 'files'}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Flying file animation: chat/kb_folders -> archive */}
      <AnimatePresence>
        {flying && (
          <motion.div
            key={flying.key}
            initial={{ x: flying.from.x - 14, y: flying.from.y - 14, opacity: 0, scale: 0.6 }}
            animate={{ x: flying.to.x - 14, y: flying.to.y - 14, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => {
              setArchivePulse(true);
              setTimeout(() => setArchivePulse(false), 400);
              refreshArchive();
              setFlying(null);
            }}
            className="absolute top-0 left-0 z-40 pointer-events-none"
          >
            <div className="w-7 h-9 rounded-md bg-gradient-to-b from-[#ffe27a] to-[#c08e00] border border-[#ffd84a] shadow-[0_4px_12px_rgba(255,204,0,0.55)] flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-[#3a2700]" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
