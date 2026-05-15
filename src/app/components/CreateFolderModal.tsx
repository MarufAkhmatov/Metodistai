import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Folder, X, RotateCcw } from 'lucide-react';
import { useLang } from '../i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function CreateFolderModal({ open, onClose, onSuccess }: Props) {
  const { t } = useLang();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose();
    setName('');
    setError(null);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('wf.create.errorEmpty'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/folders/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `HTTP ${res.status}`);
        return;
      }
      onSuccess?.();
      setName('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
          onClick={close}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ y: 10, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-[#0a0a0a] border border-emerald-500/30 rounded-2xl p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Folder className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-base font-semibold text-white">{t('wf.create.title')}</h2>
              </div>
              <button
                onClick={close}
                className="text-white/50 hover:text-white p-1 rounded"
                aria-label={t('wf.common.close')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-white/55 mb-3 leading-relaxed">{t('wf.create.desc')}</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') close();
              }}
              placeholder={t('wf.create.placeholder')}
              className="w-full bg-black/50 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40 outline-none rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30"
            />
            {error && <p className="text-[12px] text-red-300 mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={close}
                disabled={submitting}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm transition-colors"
              >
                {t('wf.common.cancel')}
              </button>
              <button
                onClick={submit}
                disabled={submitting || !name.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-500/90 disabled:bg-white/10 disabled:text-white/30 text-black text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                {submitting ? (
                  <>
                    <RotateCcw size={13} className="animate-spin" /> {t('wf.create.submitting')}
                  </>
                ) : (
                  <>
                    <Folder size={13} /> {t('wf.create.submit')}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
