import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Paperclip, LogOut, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatPanelProps = {
  onLogout?: () => void;
};

type Role = 'user' | 'assistant' | 'error';
type Message = { id: string; role: Role; text: string };

const STORAGE_KEY = 'metodistai.chat.history.v1';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.txt,.md';

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatPanel({ onLogout }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'error',
          text: `Fayl juda katta (${formatSize(f.size)}). Limit: 10 MB.`,
        },
      ]);
      e.target.value = '';
      return;
    }
    setFile(f);
    e.target.value = '';
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !file) || isSending) return;

    const userText = [text, file ? `📎 ${file.name} (${formatSize(file.size)})` : '']
      .filter(Boolean)
      .join('\n');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const sentFile = file;
    setFile(null);
    setIsSending(true);

    try {
      const formData = new FormData();
      formData.append('message', text);
      if (sentFile) formData.append('file', sentFile);

      const res = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch {
          const errText = await res.text();
          if (errText) errMsg = errText;
        }
        if (res.status === 401 && onLogout) {
          onLogout();
          return;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const replyText: string = data.reply ?? "(bo'sh javob)";
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

  const copyMessage = async (id: string, text: string) => {
    const el = document.querySelector(`[data-msg-id="${id}"]`);
    const html = el ? (el as HTMLElement).innerHTML : '';

    let ok = false;
    try {
      if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
        ok = true;
      }
    } catch {}

    if (!ok) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {}
    }

    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }

    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
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
        <div
          className={
            isExpanded
              ? 'fixed inset-4 z-[120] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden'
              : 'fixed bottom-6 right-6 z-[120] w-[min(520px,calc(100vw-2rem))] h-[min(680px,calc(100vh-3rem))] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden'
          }
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-emerald-900/30 to-transparent">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-medium text-sm">AI Metodist</span>
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
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-white/60 hover:text-white p-1 rounded"
                  aria-label="Chiqish"
                  title="Tizimdan chiqish"
                >
                  <LogOut size={16} />
                </button>
              )}
              <button
                onClick={() => setIsExpanded((v) => !v)}
                className="text-white/60 hover:text-white p-1 rounded"
                aria-label={isExpanded ? 'Kichraytirish' : 'Kattalashtirish'}
                title={isExpanded ? 'Kichraytirish' : 'Kattalashtirish'}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
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
                Xat matnini yozing yoki PDF/DOCX faylni biriktiring.
                Claude metodologiya bo'yicha jadval qaytaradi.
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] bg-emerald-600/90 text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm whitespace-pre-wrap break-words'
                      : m.role === 'error'
                      ? 'max-w-[85%] bg-red-900/40 border border-red-500/30 text-red-100 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm whitespace-pre-wrap break-words'
                      : 'max-w-[92%] bg-white/[0.06] border border-white/10 text-white/90 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm break-words chat-md'
                  }
                >
                  {m.role === 'assistant' ? (
                    <>
                      <div data-msg-id={m.id}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                      </div>
                      <div className="flex justify-end mt-1.5 -mb-0.5">
                        <button
                          onClick={() => copyMessage(m.id, m.text)}
                          className="text-white/40 hover:text-white/80 text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
                          title="Nusxa olish"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check size={12} /> Nusxalandi
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Nusxa olish
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    m.text
                  )}
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
            {file && (
              <div className="mb-2 flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80">
                <Paperclip size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="truncate flex-1">{file.name}</span>
                <span className="text-white/40 flex-shrink-0">{formatSize(file.size)}</span>
                <button
                  onClick={() => setFile(null)}
                  className="text-white/50 hover:text-white flex-shrink-0"
                  aria-label="Faylni olib tashlash"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={onFileChange}
              className="hidden"
            />
            <div className="flex items-end gap-2">
              <button
                onClick={pickFile}
                disabled={isSending}
                className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 disabled:opacity-40 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Fayl biriktirish"
                title="PDF, DOCX, TXT, MD"
              >
                <Paperclip size={16} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Xat matnini yoki savolingizni yozing..."
                rows={1}
                className="flex-1 resize-none bg-white/[0.04] border border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 outline-none rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 max-h-32"
              />
              <button
                onClick={send}
                disabled={(!input.trim() && !file) || isSending}
                className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label="Yuborish"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="text-[10px] text-white/30 mt-1.5 px-1">
              Enter — yuborish, Shift+Enter — yangi qator. Fayl limit: 10 MB.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
