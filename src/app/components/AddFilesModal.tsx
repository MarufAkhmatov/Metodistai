import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FileIcon, X, RotateCcw } from 'lucide-react';
import { useLang } from '../i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function AddFilesModal({ open, onClose, onSuccess }: Props) {
  const { t } = useLang();
  const [folders, setFolders] = useState<{ name: string }[]>([]);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setTarget('');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    let cancelled = false;
    fetch('/api/folders?includeEmpty=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || !Array.isArray(d.folders)) return;
        setFolders(
          d.folders
            .filter((f: { name: string }) => f.name !== 'Archive folder')
            .map((f: { name: string }) => ({ name: f.name }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const submit = async () => {
    if (!target) {
      setError(t('wf.add.errorSelectFolder'));
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t('wf.add.errorSelectFile'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/folders/${encodeURIComponent(target)}/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `HTTP ${res.status}`);
        return;
      }
      onSuccess?.();
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
            className="w-full max-w-[460px] bg-[#0a0a0a] border border-emerald-500/30 rounded-2xl p-5 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <FileIcon className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-base font-semibold text-white">{t('wf.add.title')}</h2>
              </div>
              <button
                onClick={close}
                className="text-white/50 hover:text-white p-1 rounded"
                aria-label={t('wf.common.close')}
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-white/55 mb-3 leading-relaxed">{t('wf.add.desc')}</p>

            <label className="block text-[11px] uppercase tracking-wider text-white/40 font-medium mb-1">
              {t('wf.add.targetLabel')}
            </label>
            <select
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-black/50 border border-white/10 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/40 outline-none rounded-xl px-3 py-2.5 text-sm text-white mb-3"
            >
              <option value="" disabled>
                {folders.length === 0 ? t('wf.add.emptyHint') : t('wf.add.selectHint')}
              </option>
              {folders.map((f) => (
                <option key={f.name} value={f.name}>
                  {f.name}
                </option>
              ))}
            </select>

            <label className="block text-[11px] uppercase tracking-wider text-white/40 font-medium mb-1">
              {t('wf.add.fileLabel')}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
              onChange={() => error && setError(null)}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/15 file:text-emerald-400 file:text-xs file:font-medium file:cursor-pointer hover:file:bg-emerald-500/25"
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
                disabled={submitting || !target || folders.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-500/90 disabled:bg-white/10 disabled:text-white/30 text-black text-sm font-semibold flex items-center gap-1.5 transition-colors"
              >
                {submitting ? (
                  <>
                    <RotateCcw size={13} className="animate-spin" /> {t('wf.add.submitting')}
                  </>
                ) : (
                  <>
                    <FileIcon size={13} /> {t('wf.add.submit')}
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
