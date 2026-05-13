import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';

type Role = 'user' | 'assistant' | 'error';
type Message = { id: string; role: Role; text: string };

const STORAGE_KEY = 'metodistai.chat.history.v1';

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const replyText: string = data.reply ?? '(bo‘sh javob)';
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: replyText },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'error',
          text: `Xato: ${msg}\n\nBackend ishlayotganini tekshiring: \`npm run server\` yoki \`npm run dev:all\`.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-[120] w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_8px_30px_rgba(16,185,129,0.45)] flex items-center justify-center transition-transform active:scale-95"
          aria-label="Chat ochish"
        >
          <MessageCircle size={24} />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-[120] w-[min(420px,calc(100vw-2rem))] h-[min(620px,calc(100vh-3rem))] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-900/30 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-medium text-sm">Claude Code</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="text-xs text-white/50 hover:text-white/80 px-2 py-1 rounded"
                  title="Tarixni tozalash"
                >
                  Tozalash
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded"
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 custom-scrollbar"
          >
            {messages.length === 0 && (
              <div className="text-center text-white/40 text-sm mt-8 px-4">
                Savolingizni yozing. Javob lokal Claude Code CLI orqali keladi.
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] bg-emerald-600/90 text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm whitespace-pre-wrap break-words'
                      : m.role === 'error'
                      ? 'max-w-[85%] bg-red-900/40 border border-red-500/30 text-red-100 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm whitespace-pre-wrap break-words'
                      : 'max-w-[85%] bg-white/[0.06] border border-white/10 text-white/90 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm whitespace-pre-wrap break-words'
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-white/[0.06] border border-white/10 text-white/70 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Claude o&apos;ylayapti...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-3 bg-black/40">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Savolingizni yozing..."
                rows={1}
                className="flex-1 resize-none bg-white/[0.04] border border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 outline-none rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 max-h-32"
              />
              <button
                onClick={send}
                disabled={!input.trim() || isSending}
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Yuborish"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="text-[10px] text-white/30 mt-1.5 px-1">
              Enter — yuborish, Shift+Enter — yangi qator
            </div>
          </div>
        </div>
      )}
    </>
  );
}
