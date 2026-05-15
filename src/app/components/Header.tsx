import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import {
  Menu,
  Search,
  Calendar,
  Clock,
  RefreshCw,
  Maximize,
  Minimize,
  Settings,
  Bell,
  FolderPlus,
  FilePlus,
  Folder,
  Monitor,
  Smartphone,
  X,
} from 'lucide-react';
import { useLang, LOCALE_BY_LANG } from '../i18n';
import type { Lang } from '../i18n';
import { CreateFolderModal } from './CreateFolderModal';
import { AddFilesModal } from './AddFilesModal';

interface HeaderProps {
  activeIndex?: number;
  setActiveIndex?: (index: number) => void;
  folders?: string[];
}

const LANGS: Lang[] = ['uz', 'ru', 'en'];

const navPillClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-500/20 text-emerald-400'
      : 'text-white/60 hover:text-white'
  }`;

function formatLastActive(
  diffMs: number,
  t: (key: string, params?: Record<string, string | number>) => string
): string {
  if (diffMs < 5000) return t('header.now');
  if (diffMs < 60_000) return t('header.activeSecondsAgo', { s: Math.floor(diffMs / 1000) });
  if (diffMs < 3_600_000) return t('header.activeMinutesAgo', { m: Math.floor(diffMs / 60_000) });
  return t('header.activeHoursAgo', { h: Math.floor(diffMs / 3_600_000) });
}

export function Header({ activeIndex = 0, setActiveIndex, folders = [] }: HeaderProps) {
  const { lang, setLang, t } = useLang();
  const locale = LOCALE_BY_LANG[lang];

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- Real-time clock (also drives "last active" relative label) ---
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    // Sekundi 30s — soat HH:MM va "last active" yangilanishi uchun yetarli.
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // --- Last active tracking ---
  const lastActiveRef = useRef<number>(Date.now());
  useEffect(() => {
    const handler = () => {
      lastActiveRef.current = Date.now();
    };
    let throttle = 0;
    const throttled = () => {
      const t = Date.now();
      if (t - throttle > 3000) {
        throttle = t;
        handler();
      }
    };
    window.addEventListener('mousemove', throttled);
    window.addEventListener('keydown', handler);
    window.addEventListener('click', handler);
    return () => {
      window.removeEventListener('mousemove', throttled);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
    };
  }, []);

  // --- Live KB folder count (excluding the Archive folder) ---
  const [kbCount, setKbCount] = useState<number | null>(null);
  const fetchKb = () => {
    fetch('/api/folders?includeEmpty=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.folders)) {
          setKbCount(
            data.folders.filter((f: { name: string }) => f.name !== 'Archive folder').length
          );
        }
      })
      .catch(() => {});
  };
  useEffect(() => {
    fetchKb();
    const id = setInterval(fetchKb, 60_000);
    return () => clearInterval(id);
  }, []);

  // --- Fullscreen toggle ---
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' && !!document.fullscreenElement
  );
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // --- Modals (Create folder / Add files) ---
  const [showCreate, setShowCreate] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // --- Refresh: re-fetch KB folder count + ping save/archive endpoints to warm caches ---
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        fetch('/api/folders?includeEmpty=1').then((r) => r.ok ? r.json() : null).then((d) => {
          if (d && Array.isArray(d.folders)) {
            setKbCount(
              d.folders.filter((f: { name: string }) => f.name !== 'Archive folder').length
            );
          }
        }),
        fetch('/api/archive/files').catch(() => {}),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // --- Viewport toggle (Desktop / Mobile preview) ---
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop');
  const mobileWinRef = useRef<Window | null>(null);
  const openMobilePreview = () => {
    if (mobileWinRef.current && !mobileWinRef.current.closed) {
      mobileWinRef.current.focus();
      setViewportMode('mobile');
      return;
    }
    const win = window.open(
      window.location.href,
      'metodistai-mobile-preview',
      'width=410,height=860,resizable=yes,scrollbars=yes'
    );
    if (win) mobileWinRef.current = win;
    setViewportMode('mobile');
  };
  const setDesktopView = () => {
    if (mobileWinRef.current && !mobileWinRef.current.closed) {
      try {
        mobileWinRef.current.close();
      } catch {}
    }
    setViewportMode('desktop');
  };

  // --- Display strings ---
  const dateStr = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const lastActiveMs = now.getTime() - lastActiveRef.current;
  const lastActiveStr = formatLastActive(lastActiveMs, t);

  const handleFolderClick = (index: number) => {
    if (setActiveIndex) setActiveIndex(index);
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim() && setActiveIndex) {
      const matchIndex = folders.findIndex((f) => f.toLowerCase().includes(value.toLowerCase()));
      if (matchIndex !== -1) setActiveIndex(matchIndex);
    }
  };

  return (
    <>
      <div className="w-full flex flex-col px-6 py-4 space-y-6 relative z-50">
        {/* Top Nav */}
        <div className="flex items-center justify-between">
          {/* Left: M logo + Menu + page nav */}
          <div className="flex items-center space-x-3">
            <button className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-bold text-xl">
              M
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <Menu size={18} />
            </button>
            <nav className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full p-1">
              <NavLink to="/" end className={navPillClass}>
                {t('nav.metodist')}
              </NavLink>
              <NavLink to="/workflow" className={navPillClass}>
                {t('nav.workflow')}
              </NavLink>
            </nav>
          </div>

          {/* Center Timeline Pill (Desktop only) */}
          <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full p-1.5 backdrop-blur-md">
            {/* Date — bugungi sana, real time */}
            <div
              className="flex items-center space-x-2 px-4 border-r border-white/10"
              title={t('header.today')}
            >
              <Calendar size={14} className="text-white/50" />
              <span className="text-sm font-medium text-white/80">{dateStr}</span>
            </div>

            {/* Last active */}
            <div
              className="flex items-center space-x-2 px-3 border-r border-white/10"
              title={t('header.lastActive')}
            >
              <div className="relative w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]">
                {lastActiveMs < 5000 && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                )}
              </div>
              <span className="text-xs text-white/60 font-medium">{lastActiveStr}</span>
            </div>

            {/* Current time + KB info — yashil pill */}
            <div className="flex items-center px-4 bg-emerald-900/30 rounded-full py-1 ml-2 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] relative">
              <Clock size={12} className="text-emerald-400 mr-2" />
              <span className="text-xs text-emerald-400 font-medium tabular-nums mr-3">
                {timeStr}
              </span>
              <span className="text-sm font-medium text-emerald-100">
                {kbCount === null
                  ? t('header.kbBadgeLoading')
                  : t('header.kbBadge', { count: kbCount })}
              </span>
              <div className="absolute -bottom-2 left-1/2 w-2 h-2 bg-emerald-500 rounded-full blur-sm" />
            </div>

            {/* Action buttons: Refresh + Fullscreen */}
            <div className="flex items-center space-x-2 px-3">
              <button
                onClick={handleRefresh}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-emerald-400 disabled:opacity-50"
                aria-label={t('header.refresh')}
                title={t('header.refreshTitle')}
                disabled={refreshing}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={toggleFullscreen}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-emerald-400"
                aria-label={isFullscreen ? t('header.fsExit') : t('header.fsEnter')}
                title={isFullscreen ? t('header.fsExit') : t('header.fsEnter')}
              >
                {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
              </button>
            </div>
          </div>

          {/* Right Actions (Desktop only) */}
          <div className="hidden md:flex items-center space-x-3">
            <button className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <Settings size={18} />
            </button>
            <button className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-black flex items-center justify-center text-[8px] font-bold text-white">2</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors font-medium text-sm"
                aria-label={t('header.language')}
                title={t('header.language')}
              >
                {lang.toUpperCase()}
              </button>
              {isLangOpen && (
                <div className="absolute top-full right-0 mt-2 w-24 bg-[#111111] border border-emerald-500/20 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.5)] py-1.5 z-[60]">
                  {LANGS.map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setLang(l);
                        setIsLangOpen(false);
                      }}
                      className={`w-full text-left px-4 py-1.5 text-sm transition-colors flex items-center justify-between ${
                        lang === l
                          ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{l.toUpperCase()}</span>
                      {lang === l && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub Nav (Desktop only) */}
        <div className="hidden md:flex items-center justify-between -translate-y-[20%] relative z-50">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 transition-colors"
              >
                <Folder size={16} className="text-white/50" />
                <span>{t('header.folders')} ({folders.length})</span>
              </button>
              {isDropdownOpen && folders.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-[#111111] border border-emerald-500/20 rounded-xl shadow-[0_4_20px_rgba(0,0,0,0.5)] py-2 z-[60] overflow-y-auto max-h-[224px]">
                  {folders.map((folder, idx) => {
                    const modIdx = ((activeIndex % folders.length) + folders.length) % folders.length;
                    const isActive = modIdx === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleFolderClick(idx)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between shrink-0 ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                            : 'text-white/70 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="truncate pr-2">{folder}</span>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center bg-white/5 border border-white/10 rounded-full px-4 py-2 space-x-2 w-48 transition-colors focus-within:bg-white/10 focus-within:border-white/20">
              <Search size={16} className="text-white/50 shrink-0" />
              <input
                type="text"
                placeholder={t('header.searchFolders')}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 w-full"
              />
            </div>

            {/* Desktop / Mobile viewport toggle */}
            <div
              className="flex items-center bg-white/5 border border-white/10 rounded-full p-0.5"
              title={t('header.mobilePreviewTitle')}
            >
              <button
                onClick={setDesktopView}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  viewportMode === 'desktop'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Monitor size={13} />
                <span>{t('header.desktop')}</span>
              </button>
              <button
                onClick={openMobilePreview}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  viewportMode === 'mobile'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone size={13} />
                <span>{t('header.mobile')}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 rounded-full text-sm text-white/80 hover:text-white transition-colors"
            >
              <FolderPlus size={16} className="text-emerald-400" />
              <span>{t('header.createFolders')}</span>
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 rounded-full text-sm text-white/80 hover:text-white transition-colors"
            >
              <FilePlus size={16} className="text-emerald-400" />
              <span>{t('header.addFiles')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Fullscreen Menu Overlay */}
      <div
        className={`fixed inset-0 bg-[#030303]/95 backdrop-blur-xl z-[100] transition-all duration-300 md:hidden flex flex-col ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <button className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-bold text-xl">
            M
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col space-y-8">

          {/* Pages */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('nav.pages')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <NavLink
                to="/"
                end
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm rounded-xl transition-colors font-medium text-center ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/5'
                  }`
                }
              >
                {t('nav.metodist')}
              </NavLink>
              <NavLink
                to="/workflow"
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm rounded-xl transition-colors font-medium text-center ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/5'
                  }`
                }
              >
                {t('nav.workflow')}
              </NavLink>
            </div>
          </div>

          {/* Language */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('header.language')}</h3>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-4 py-3 text-sm rounded-xl transition-colors font-medium ${
                    lang === l
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Search Area */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('header.search')}</h3>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 space-x-3 w-full focus-within:bg-white/10 focus-within:border-white/20 transition-colors">
              <Search size={18} className="text-white/50 shrink-0" />
              <input
                type="text"
                placeholder={t('header.searchFolders')}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none text-base text-white placeholder:text-white/40 w-full"
              />
            </div>
          </div>

          {/* Folders List */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('header.folders')}</h3>
              <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md">{t('header.total', { count: folders.length })}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {folders.slice(0, 10).map((folder, idx) => {
                const modIdx = ((activeIndex % folders.length) + folders.length) % folders.length;
                const isActive = modIdx === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleFolderClick(idx)}
                    className={`text-left px-4 py-3 text-sm rounded-xl transition-colors flex items-center justify-between ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 font-medium border border-emerald-500/30'
                        : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/5'
                    }`}
                  >
                    <span className="truncate pr-2">{folder}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('header.quickActions')}</h3>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => {
                  setShowCreate(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors"
              >
                <FolderPlus size={18} className="text-emerald-400" />
                <span>{t('header.createFolders')}</span>
              </button>
              <button
                onClick={() => {
                  setShowAdd(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors"
              >
                <FilePlus size={18} className="text-emerald-400" />
                <span>{t('header.addFiles')}</span>
              </button>
              <button
                onClick={() => {
                  handleRefresh();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors"
              >
                <RefreshCw size={18} className={`text-emerald-400 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{t('header.refresh')}</span>
              </button>
              <button
                onClick={() => {
                  openMobilePreview();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors"
              >
                <Smartphone size={18} className="text-emerald-400" />
                <span>{t('header.mobile')}</span>
              </button>
            </div>
          </div>

          {/* Settings & Profile */}
          <div className="flex flex-col space-y-4 pb-8">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">{t('header.account')}</h3>
            <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="text-sm font-medium text-white">{t('header.youTeam')}</div>
                  <div className="text-xs text-white/50">{lastActiveStr}</div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/70 hover:text-white">
                  <Bell size={18} />
                </button>
                <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white/70 hover:text-white">
                  <Settings size={18} />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Shared modals — Create folder / Add files */}
      <CreateFolderModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchKb}
      />
      <AddFilesModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSuccess={fetchKb}
      />
    </>
  );
}
