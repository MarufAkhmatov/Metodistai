import { Workflow } from 'lucide-react';
import { useLang } from '../i18n';

// 2-sahifa: AI-Workflow (https://github.com/MarufAkhmatov/AI-Workflow).
//
// Hozir bu vaqtinchalik (placeholder) sahifa. AI-Workflow loyihasining
// kodi bu repozitoriyga qo'shilgach, shu fayl uning asosiy komponentini
// import qilib ko'rsatadigan qilib yangilanadi. Masalan:
//
//   import WorkflowApp from '../workflow/App';
//   export default function WorkflowPage() { return <WorkflowApp />; }
//
// Kodni qo'shish yo'riqnomasi README ("AI-Workflow — 2-sahifa") da.
export default function WorkflowPage() {
  const { t } = useLang();

  return (
    <div className="flex-1 relative flex flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-6 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
        <Workflow className="text-emerald-400" size={28} />
      </div>
      <h1 className="text-xl md:text-2xl font-semibold text-white/95 mb-3">
        {t('workflow.title')}
      </h1>
      <p className="text-sm text-white/60 max-w-md leading-relaxed">
        {t('workflow.placeholder')}
      </p>
    </div>
  );
}
