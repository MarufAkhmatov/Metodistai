import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Loader2,
  Paperclip,
  X,
  Copy,
  Check,
  Save,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLang } from '../i18n';

export type KbFile = { name: string; relPath: string };
export type KbFolder = { folder: string; files: KbFile[] };

type Role = 'user' | 'assistant' | 'error';
type Message = { id: string; role: Role; text: string };

type WorkflowChatProps = {
  onFileChange?: (file: File | null) => void;
  onBusyChange?: (busy: boolean) => void;
  onKbMatches?: (matches: KbFolder[]) => void;
  onAnalysis?: (text: string, id: string) => void;
  onSaveRequest?: (text: string, id: string) => Promise<{ ok: boolean }> | void;
  savedIds?: Set<string>;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  expanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
};

const STORAGE_KEY = 'metodistai.workflow.chat.v1';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,.txt,.md';

// Default base: oldingi 360×460 dan eni +30%, bo'yi -20%
export const CHAT_BASE_W = 468;
export const CHAT_BASE_H = 368;
// Kengaytirilgan o'lcham: maydon ~3× (har bir o'lcham ×1.73)
const EXPAND_FACTOR = 1.73;
export const CHAT_EXPANDED_W = Math.round(CHAT_BASE_W * EXPAND_FACTOR);
export const CHAT_EXPANDED_H = Math.round(CHAT_BASE_H * EXPAND_FACTOR);
const BASE_W = CHAT_BASE_W;
const BASE_H = CHAT_BASE_H;
const EXPANDED_W = CHAT_EXPANDED_W;
const EXPANDED_H = CHAT_EXPANDED_H;

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
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

export function WorkflowChat({
  onFileChange,
  onBusyChange,
  onKbMatches,
  onAnalysis,
  onSaveRequest,
  savedIds,
  onHeaderMouseDown,
  expanded: expandedProp,
  onExpandedChange,
}: WorkflowChatProps) {
  const { t } = useLang();
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp !== undefined ? expandedProp : internalExpanded;
  const toggleExpanded = () => {
    const next = !expanded;
    if (expandedProp === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  };
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isSending]);

  const setFileAndNotify = (f: File | null) => {
    setFile(f);
    onFileChange?.(f);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'error',
          text: t('chat.fileTooLarge', { size: formatSize(f.size) }),
        },
      ]);
      return;
    }
    setFileAndNotify(f);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !file) || isSending) return;

    const sentFile = file;
    const userText = [
      text,
      sentFile ? `\u{1F4CE} ${sentFile.name} (${formatSize(sentFile.size)})` : '',
    ]
      .filter(Boolean)
      .join('\n');

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: userText }]);
    setInput('');
    setFile(null);
    setIsSending(true);
    onBusyChange?.(true);
    onKbMatches?.([]);

    try {
      const formData = new FormData();
      formData.append('message', text);
      if (sentFile) formData.append('file', sentFile);

      const res = await fetch('/api/chat', { method: 'POST', body: formData });
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      const replyText: string = data.reply ?? t('chat.emptyReply');
      const replyId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: replyId, role: 'assistant', text: replyText }]);
      onKbMatches?.(Array.isArray(data.kbMatches) ? data.kbMatches : []);
      onAnalysis?.(replyText, replyId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'error', text: t('chat.error', { msg }) },
      ]);
    } finally {
      setIsSending(false);
      onBusyChange?.(false);
      onFileChange?.(null);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const copyMessage = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopiedId(id);
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
  };

  const requestSave = async (m: Message) => {
    if (!onSaveRequest || savingId) return;
    setSavingId(m.id);
    try {
      await onSaveRequest(m.text, m.id);
    } finally {
      setSavingId(null);
    }
  };

  const width = expanded ? EXPANDED_W : BASE_W;
  const height = expanded ? EXPANDED_H : BASE_H;

  return (
    <div
      style={{ width, height }}
      className="flex flex-col bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden relative transition-[width,height] duration-300 ease-out"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-[#22ff88]/5 to-transparent pointer-events-none opacity-50" />

      {/* Header — drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        className="px-4 py-2.5 border-b border-white/10 flex items-center gap-3 bg-white/[0.02] cursor-grab active:cursor-grabbing relative z-10"
      >
        <div className="w-7 h-7 rounded-full bg-[#22ff88]/20 flex items-center justify-center border border-[#22ff88]/30 shrink-0">
          <Bot className="w-3.5 h-3.5 text-[#22ff88]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-white">AI Metodist</h3>
          <p className="text-[11px] text-white/50 flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSending ? 'bg-[#22ff88] animate-pulse' : 'bg-[#22ff88]/60'
              }`}
            />
            {isSending ? t('chat.thinking') : 'Online'}
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setMessages([])}
            className="text-[11px] text-white/40 hover:text-white/80 px-1.5 py-0.5 rounded"
            title={t('chat.clearHistory')}
          >
            {t('chat.clear')}
          </button>
        )}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={toggleExpanded}
          className="text-white/60 hover:text-[#22ff88] p-1 rounded transition-colors"
          aria-label={expanded ? t('chat.collapse') : t('chat.expand')}
          title={expanded ? t('chat.collapse') : t('chat.expand')}
        >
          {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Messages */}
      <div
        ref={listRef}
        className="workflow-chat-scroll flex-1 p-4 overflow-y-auto flex flex-col gap-3 relative z-10"
      >
        {messages.length === 0 && (
          <div className="text-center text-white/40 text-xs mt-6 px-2 leading-relaxed">
            {t('chat.emptyState')}
          </div>
        )}

        {messages.map((m) => {
          const isAssistant = m.role === 'assistant';
          const alreadySaved = savedIds?.has(m.id) === true;
          return (
            <div
              key={m.id}
              className={m.role === 'user' ? 'self-end max-w-[85%]' : 'self-start max-w-[92%]'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'bg-[#22ff88]/10 border border-[#22ff88]/20 rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm text-white leading-relaxed whitespace-pre-wrap break-words'
                    : m.role === 'error'
                    ? 'bg-red-900/40 border border-red-500/30 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-red-100 whitespace-pre-wrap break-words'
                    : 'bg-white/[0.06] border border-white/10 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-white/90 break-words chat-md'
                }
              >
                {isAssistant ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    <div className="flex justify-end gap-2 mt-1.5 -mb-0.5">
                      <button
                        onClick={() => copyMessage(m.id, m.text)}
                        className="text-white/40 hover:text-white/80 text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
                        title={t('chat.copy')}
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check size={11} /> {t('chat.copied')}
                          </>
                        ) : (
                          <>
                            <Copy size={11} /> {t('chat.copy')}
                          </>
                        )}
                      </button>
                      {onSaveRequest && (
                        <button
                          onClick={() => requestSave(m)}
                          disabled={alreadySaved || savingId === m.id}
                          className={`text-[11px] flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                            alreadySaved
                              ? 'text-[#22ff88]/70 border-[#22ff88]/30 bg-[#22ff88]/5'
                              : 'text-[#22ff88] border-[#22ff88]/40 hover:bg-[#22ff88]/10'
                          }`}
                          title="Save as Word (.docx)"
                        >
                          {savingId === m.id ? (
                            <>
                              <Loader2 size={11} className="animate-spin" /> Saving…
                            </>
                          ) : alreadySaved ? (
                            <>
                              <Check size={11} /> Saved
                            </>
                          ) : (
                            <>
                              <Save size={11} /> Save as Word?
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  m.text
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="self-start">
            <div className="bg-white/[0.06] border border-white/10 text-white/70 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#22ff88]" />
              {t('chat.thinking')}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 bg-white/[0.02] border-t border-white/10 relative z-10">
        {file && (
          <div className="mb-2 flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/80">
            <Paperclip size={12} className="text-[#22ff88] flex-shrink-0" />
            <span className="truncate flex-1">{file.name}</span>
            <span className="text-white/40 flex-shrink-0">{formatSize(file.size)}</span>
            <button
              onClick={() => setFileAndNotify(null)}
              className="text-white/50 hover:text-white flex-shrink-0"
              aria-label={t('chat.removeFile')}
            >
              <X size={12} />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={onFileInput}
          className="hidden"
        />
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-[#22ff88]/40 disabled:opacity-40 text-white/70 hover:text-[#22ff88] flex items-center justify-center transition-colors flex-shrink-0"
            aria-label={t('chat.attachFile')}
            title="PDF, DOCX, TXT, MD"
          >
            <Paperclip size={15} />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('chat.inputPlaceholder')}
            rows={1}
            className="flex-1 resize-none bg-black/50 border border-white/10 focus:border-[#22ff88]/50 focus:ring-1 focus:ring-[#22ff88]/40 outline-none rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 max-h-24"
          />
          <button
            onClick={send}
            disabled={(!input.trim() && !file) || isSending}
            className="w-9 h-9 rounded-xl bg-[#22ff88] hover:bg-[#22ff88]/90 disabled:bg-white/10 disabled:text-white/30 text-black flex items-center justify-center transition-colors flex-shrink-0"
            aria-label={t('chat.send')}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
