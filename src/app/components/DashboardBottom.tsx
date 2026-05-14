import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Minus, UserPlus, FileText, FileSpreadsheet,
  ChevronRight, ChevronLeft, Eye, Download, Loader2, Folder,
  Maximize2, Minimize2,
} from 'lucide-react';
import type { FolderInfo, FolderDocuments } from '../types';
import { useLang, LOCALE_BY_LANG } from '../i18n';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function docIconFor(format: string) {
  const f = format.toLowerCase();
  if (f === 'pdf') return { Icon: FileText, color: 'text-red-300', bg: 'bg-red-500/15' };
  if (f === 'xls' || f === 'xlsx') return { Icon: FileSpreadsheet, color: 'text-emerald-300', bg: 'bg-emerald-500/15' };
  return { Icon: FileText, color: 'text-blue-300', bg: 'bg-blue-500/15' };
}

function fileUrl(folder: string, name: string, download = false): string {
  const base = `/api/folders/${encodeURIComponent(folder)}/files/${encodeURIComponent(name)}`;
  return download ? `${base}?download=1` : base;
}

export function DashboardBottom({ activeFolder = null }: { activeFolder?: FolderInfo | null }) {
  const { lang, t } = useLang();
  const [isLeftOpen, setIsLeftOpen] = useState(false);
  const [isRightOpen, setIsRightOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [docs, setDocs] = useState<FolderDocuments | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const folderName = activeFolder?.name ?? null;

  const fetchDocs = useCallback(
    async (silent: boolean) => {
      if (!folderName) {
        setDocs(null);
        setDocsError(null);
        return;
      }
      if (!silent) {
        setDocsLoading(true);
        setDocsError(null);
      }
      try {
        const res = await fetch(`/api/folders/${encodeURIComponent(folderName)}/documents`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setDocs(data as FolderDocuments);
        if (silent) setDocsError(null);
      } catch (e) {
        if (!silent) {
          setDocs(null);
          setDocsError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!silent) setDocsLoading(false);
      }
    },
    [folderName]
  );

  // Tanlangan papka o'zgarganda — to'liq yuklash; so'ng har 20s da jim yangilash
  // (yangi qo'shilgan hujjatlar avtomat ko'rinadi).
  useEffect(() => {
    setSelectedDoc(null);
    fetchDocs(false);
  }, [fetchDocs]);

  useEffect(() => {
    if (!folderName) return;
    const id = setInterval(() => fetchDocs(true), 20000);
    return () => clearInterval(id);
  }, [folderName, fetchDocs]);

  const openDoc = (name: string) => {
    if (!folderName) return;
    window.open(fileUrl(folderName, name), '_blank', 'noopener');
  };

  const downloadDoc = (name: string) => {
    if (!folderName) return;
    const a = document.createElement('a');
    a.href = fileUrl(folderName, name, true);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Expanded folder grows in real size (not scaled) so the document list shows more rows.
  const cardW = isExpanded ? 1000 : 500;
  const cardH = isExpanded ? 645 : 340;
  const folderPath = `M 24 0 L 120 0 Q 144 0 156 12 L 168 24 Q 180 36 204 36 L ${cardW - 24} 36 Q ${cardW} 36 ${cardW} 60 L ${cardW} ${cardH - 24} Q ${cardW} ${cardH} ${cardW - 24} ${cardH} L 24 ${cardH} Q 0 ${cardH} 0 ${cardH - 24} L 0 24 Q 0 0 24 0 Z`;

  // Decorative file cards behind the folder show the top 3 real documents (PDFs first).
  const topDocs = docs
    ? [...docs.documents]
        .sort((a, b) => {
          const ap = a.format.toLowerCase() === 'pdf' ? 0 : 1;
          const bp = b.format.toLowerCase() === 'pdf' ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 3)
    : [];
  const fileCardWidths = [120, 130, 150];
  const fileCardZ = ['z-0', 'z-10', 'z-20'];

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-[1fr_500px_1fr] gap-4 items-end mt-[-60px] md:mt-[-60px] relative z-20">
      
      {/* Mobile Left Toggle */}
      <button 
        onClick={() => setIsLeftOpen(!isLeftOpen)}
        className="lg:hidden absolute left-0 top-1/2 -translate-y-1/2 w-12 h-14 bg-[#16502b] border border-white/20 rounded-r-xl flex items-center justify-center text-white z-[100] shadow-[4px_0_15px_rgba(0,0,0,0.5)] active:scale-95 cursor-pointer"
      >
        <ChevronRight size={20} className={isLeftOpen ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {/* Left Panel */}
      <div className={`
        h-[280px] bg-gradient-to-b from-white/[0.04] to-transparent rounded-tl-[32px] rounded-tr-[32px] lg:rounded-tr-none border-t border-l lg:border-r-0 border-r border-white/[0.08] flex flex-col overflow-hidden backdrop-blur-md lg:-mr-4 pt-10 pl-4
        absolute lg:relative left-4 lg:left-0 bottom-0 lg:bottom-auto w-[300px] lg:w-auto z-40 transition-transform duration-300
        ${isLeftOpen ? "translate-x-0" : "-translate-x-[150%]"} ${isExpanded ? "lg:-translate-x-16" : "lg:translate-x-0"}
      `}>
        <div className="flex-1 min-h-0 w-full mt-1 bg-gradient-to-b from-white/[0.07] to-transparent rounded-tl-[20px] rounded-tr-none border-t border-l border-white/[0.08] pt-2 pl-3 pr-0 pb-0 flex flex-col relative">
          <div className="mb-4 pr-6">
            <h2 className="text-lg font-medium text-white mb-1">{t('dash.keyDates')}</h2>
            <p className="text-xs text-white/40">{t('dash.championing')}</p>
          </div>

          <div className="flex text-xs font-medium text-white/50 mb-3 px-2 pr-6">
            <div className="w-12"></div>
            <div className="w-[110px]">{t('dash.date')}</div>
            <div>{t('dash.event')}</div>
          </div>

          {/* Third Nested Folder */}
          <div className="flex-1 min-h-0 ml-12 bg-gradient-to-b from-white/[0.07] to-transparent rounded-tl-[16px] rounded-tr-none border-t border-l border-white/[0.08] pt-3 pl-3 pr-6 pb-6 flex flex-col relative">
            <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar -ml-12">
              {/* Item 1 */}
              <div className="flex items-center group cursor-pointer hover:bg-white/[0.02] p-2 rounded-xl transition-colors -mx-2">
                <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 mr-4 group-hover:bg-white/10 transition-colors">
                  <Plus size={14} />
                </button>
                <div className="w-[110px]">
                  <div className="text-sm text-white font-medium">{t('dash.twoWeeks')}</div>
                  <div className="text-[10px] text-white/40">01/12/2025</div>
                </div>
                <div className="text-sm text-white/70 font-medium">{t('dash.autorenewDate')}</div>
              </div>

              {/* Item 2 */}
              <div className="flex items-center group cursor-pointer hover:bg-white/[0.02] p-2 rounded-xl transition-colors -mx-2">
                <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 mr-4 group-hover:bg-white/10 transition-colors">
                  <Minus size={14} />
                </button>
                <div className="w-[110px]">
                  <div className="text-sm text-white font-medium">{t('dash.twoMonths')}</div>
                  <div className="text-[10px] text-white/40">01/02/2025</div>
                </div>
                <div className="text-sm text-white/70 font-medium">{t('dash.terminationDate')}</div>
              </div>

              {/* Item 3 */}
              <div className="flex items-center group cursor-pointer hover:bg-white/[0.02] p-2 rounded-xl transition-colors -mx-2 mt-2">
                <div className="w-8 h-8 mr-4 flex items-center justify-center text-sm font-medium text-white/60">
                  {t('dash.start')}
                </div>
                <div className="w-[110px]">
                   <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
                     <UserPlus size={14} />
                   </button>
                </div>
                <div className="w-6 h-[1px] bg-white/20"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center Panel (folder details) */}
      <div className={`relative h-[280px] sm:h-[320px] md:h-[460px] w-full flex flex-col justify-end translate-y-[10px] md:translate-y-[20px] ${isExpanded ? "z-[60]" : "z-30"}`}>

        <div className="absolute inset-x-0 bottom-0 flex justify-center scale-[0.75] sm:scale-[0.85] md:scale-100 origin-bottom">
          {/* Background Dark Green Folder */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-[#16502b] rounded-[30px] z-[-1] shadow-[inset_0_2px_10px_rgba(255,255,255,0.1),0_-15px_30px_rgba(22,80,43,0.4)] border border-white/5"
            style={{ width: cardW, height: cardH + 70 }}
          />

          {/* Vertical Files behind — top 3 real documents */}
          <div
            className="absolute left-1/2 -translate-x-1/2 translate-y-[40%] w-[350px] h-[200px] z-0 flex items-end justify-center space-x-[-30px]"
            style={{ bottom: cardH - 40 }}
          >
            {topDocs.map((doc, i) => (
              <div
                key={doc.name}
                onClick={() => openDoc(doc.name)}
                className={`h-[170px] bg-gradient-to-br from-[#16502b]/50 via-white/20 to-white/40 backdrop-blur-xl rounded-[15px] p-4 border-t border-l border-white/50 border-r border-b border-black/10 shadow-[inset_1px_1px_10px_rgba(255,255,255,0.4),0_10px_20px_rgba(0,0,0,0.3)] transition-transform hover:-translate-y-4 relative ${fileCardZ[i]} group cursor-pointer`}
                style={{ width: fileCardWidths[i] }}
                title={doc.name}
              >
                <div className="absolute inset-0 bg-white/20 rounded-[15px] transition-colors group-hover:bg-white/30" />
                <div className="text-[11px] font-medium text-white mb-0.5 relative z-10 drop-shadow-md truncate">{doc.name}</div>
                <div className="text-[9px] text-white/90 relative z-10 drop-shadow-sm uppercase">{doc.format}</div>
                <div className="mt-4 space-y-2 opacity-90 relative z-10">
                  <div className="h-1.5 w-full bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                  <div className="h-1.5 w-3/4 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.5)]"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Green Card (Folder Shape) */}
          <div
            className="relative z-10 drop-shadow-[0_-15px_40px_rgba(40,122,68,0.4)]"
            style={{ width: cardW, height: cardH }}
          >

            {/* Expand / collapse toggle */}
            <button
              onClick={() => setIsExpanded((v) => !v)}
              className="absolute top-[44px] right-4 z-30 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              title={isExpanded ? t('dash.collapse') : t('dash.expand')}
              aria-label={isExpanded ? t('dash.collapse') : t('dash.expand')}
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>

            {/* Glass Background with exact path clipping */}
            <div
              className="absolute inset-0 z-0 bg-gradient-to-br from-[#287a44]/80 via-[#287a44]/50 to-[#16502b]/70"
              style={{
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                clipPath: `path('${folderPath}')`
              }}
            >
              {/* Neo morph inner noise/glow */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,_rgba(255,255,255,0.25)_0%,_transparent_30%,_transparent_70%,_rgba(0,0,0,0.3)_100%)] pointer-events-none" />
              <div className="absolute top-[36px] left-[170px] right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
            </div>

            {/* SVG Border Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox={`0 0 ${cardW} ${cardH}`} fill="none" preserveAspectRatio="none">
              <path
                d={folderPath}
                stroke="url(#morph-border)"
                strokeWidth="2"
              />
              <defs>
                <linearGradient id="morph-border" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
                  <stop offset="30%" stopColor="rgba(40,122,68,0.5)" />
                  <stop offset="70%" stopColor="rgba(40,122,68,0.2)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
                </linearGradient>
              </defs>
            </svg>

            {/* Content Layer */}
            <div className="relative z-20 w-full h-full flex flex-col px-10 pb-8 pt-[52px]">
              {/* Header — folder metadata */}
              <div className="mb-5 relative z-10 pr-8">
                <h1 className="text-xl font-medium text-white mb-1 transition-all duration-300 truncate">
                  {activeFolder?.name ?? '—'}
                </h1>
                <p className="text-sm text-emerald-100/60">
                  {activeFolder
                    ? `${t('dash.documents', { count: activeFolder.documentCount })} · ${t('dash.subfolders', { count: activeFolder.subfolderCount })} · ${t('dash.lastModified', { date: formatDate(activeFolder.modifiedAt, LOCALE_BY_LANG[lang]) })}`
                    : t('dash.noFolderSelected')}
                </p>
              </div>

            {/* Progress Slider */}
            <div className="mb-6 relative z-10">
              <div className="flex justify-between text-xs font-medium text-white mb-3">
                <span>{t('dash.annualAudit')}</span>
                <span className="text-white/60">{t('dash.finalValidation')}</span>
              </div>
              <div className="relative h-[2px] w-full bg-white/20 flex items-center">
                <div className="absolute left-0 top-0 h-full w-[80%] bg-emerald-400" />
                <div className="absolute left-[80%] top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <div className="absolute left-[80%] right-0 top-0 h-full bg-transparent border-t-2 border-dashed border-white/20" />
              </div>
            </div>

            {/* Document list */}
            <div className="space-y-2 relative z-10 flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
              {docsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-emerald-300" />
                </div>
              )}

              {!docsLoading && docsError && (
                <div className="text-xs text-red-300/80 bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                  {docsError}
                </div>
              )}

              {!docsLoading && !docsError && docs && (
                <>
                  {docs.subfolders.map((sf) => (
                    <div
                      key={`sf-${sf.name}`}
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex items-center"
                    >
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/50 mr-3 shrink-0">
                        <Folder size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white/80 truncate">{sf.name}</div>
                        <div className="text-xs text-white/40">{t('dash.documents', { count: sf.documentCount })}</div>
                      </div>
                    </div>
                  ))}

                  {docs.documents.map((doc) => {
                    const { Icon, color, bg } = docIconFor(doc.format);
                    const isSelected = selectedDoc === doc.name;
                    return (
                      <div
                        key={doc.name}
                        onClick={() => setSelectedDoc(isSelected ? null : doc.name)}
                        className={`w-full border rounded-2xl p-3 flex items-center cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-400/40'
                            : 'bg-white/[0.06] hover:bg-white/[0.08] border-white/10'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mr-3 shrink-0`}>
                          <Icon size={16} className={color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">{doc.name}</div>
                          <div className="text-xs text-white/50">
                            {doc.format.toUpperCase()} · {formatSize(doc.sizeBytes)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openDoc(doc.name); }}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                            title={t('dash.open')}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadDoc(doc.name); }}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                            title={t('dash.download')}
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {docs.documents.length === 0 && docs.subfolders.length === 0 && (
                    <div className="text-xs text-white/40 text-center py-8">
                      {t('dash.noDocsInFolder')}
                    </div>
                  )}
                </>
              )}

              {!docsLoading && !docsError && !docs && (
                <div className="text-xs text-white/40 text-center py-8">
                  {t('dash.folderNotSelected')}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Right Toggle */}
      <button 
        onClick={() => setIsRightOpen(!isRightOpen)}
        className="lg:hidden absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-[#16502b] border border-white/20 rounded-l-full flex items-center justify-center text-white z-50 shadow-[-4px_0_15px_rgba(0,0,0,0.5)]"
      >
        <ChevronLeft size={18} className={isRightOpen ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {/* Right Panel */}
      <div className={`
        h-[280px] bg-gradient-to-b from-white/[0.04] to-transparent rounded-tr-[32px] rounded-tl-[32px] lg:rounded-tl-none border-t border-r lg:border-l-0 border-l border-white/[0.08] flex flex-col overflow-hidden backdrop-blur-md lg:-ml-4 pt-10 pr-4
        absolute lg:relative right-4 lg:right-0 bottom-0 lg:bottom-auto w-[300px] lg:w-auto z-40 transition-transform duration-300
        ${isRightOpen ? "translate-x-0" : "translate-x-[150%]"} ${isExpanded ? "lg:translate-x-16" : "lg:translate-x-0"}
      `}>
        <div className="flex-1 min-h-0 w-full mt-1 bg-gradient-to-b from-white/[0.07] to-transparent rounded-tr-[20px] rounded-tl-none border-t border-r border-white/[0.08] pt-2 pr-3 pl-0 pb-0 flex flex-col relative">
          
          <div className="mb-4 flex items-center text-xs font-medium text-white/50 pl-6 pt-2">
            {t('dash.event')}
          </div>

          {/* Third Nested Folder Equivalent */}
          <div className="flex-1 min-h-0 mr-12 bg-gradient-to-b from-white/[0.07] to-transparent rounded-tr-[16px] rounded-tl-none border-t border-r border-white/[0.08] flex flex-col relative pl-[24px] pr-[0px] pt-[12px] pb-[24px]">
            <div className="flex-1 flex flex-col min-h-0 -mr-12">
              
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                {/* Event 1 */}
                <div className="group cursor-pointer">
                  <div className="text-sm text-white font-medium mb-1 group-hover:text-emerald-400 transition-colors">{t('dash.riskAssessment')}</div>
                  <div className="h-[1px] w-full bg-white/10 mt-3" />
                </div>

                {/* Event 2 */}
                <div className="group cursor-pointer">
                  <div className="text-sm text-white font-medium mb-1 group-hover:text-emerald-400 transition-colors">{t('dash.deliverableDue')}</div>
                  <div className="h-[1px] w-full bg-white/10 mt-3" />
                </div>
              </div>

              {/* Bottom Users / Action */}
              <div className="flex items-center justify-between pt-4 mt-auto border-t border-white/5 pr-4">
                <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
                   <UserPlus size={14} />
                </button>
                
                <button className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold rounded-full transition-colors flex items-center space-x-1">
                   <span>{t('dash.wereHere')}</span>
                </button>
                
                <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
                   <UserPlus size={14} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
