import { useState } from 'react';
import { Lock, Mail, Loader2, ShieldCheck } from 'lucide-react';

type Props = {
  onSuccess: (email: string) => void;
};

export function LoginPage({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!email.trim() || !password) {
      setError('Email va parolni kiriting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || `Kirib bo'lmadi (HTTP ${res.status})`);
      }

      setPassword('');
      onSuccess(data.email ?? email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans flex items-center justify-center relative overflow-hidden px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-emerald-900/15 blur-[150px] rounded-full pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/90 flex items-center justify-center mb-4 shadow-[0_8px_30px_rgba(16,185,129,0.35)]">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white">AI Metodist</h1>
          <p className="text-sm text-white/40 mt-1">Tizimga kirish</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] space-y-4"
        >
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Email</label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="email@example.com"
                className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 outline-none rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Parol</label>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-white/[0.04] border border-white/10 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 outline-none rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-500/30 text-red-100 rounded-xl px-3 py-2 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Tekshirilmoqda...
              </>
            ) : (
              'Kirish'
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-white/25 mt-5">
          Faqat ruxsat berilgan foydalanuvchilar uchun.
        </p>
      </div>
    </div>
  );
}
