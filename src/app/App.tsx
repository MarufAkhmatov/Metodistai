import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { Header } from "./components/Header";
import { ChatPanel } from "./components/ChatPanel";
import { LoginPage } from "./components/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import type { FolderInfo } from "./types";
import { useLang } from "./i18n";

const WorkflowPage = lazy(() => import("./pages/WorkflowPage"));

type AuthState = 'loading' | 'out' | 'in';

export default function App() {
  const { t } = useLang();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [activeIndex, setActiveIndex] = useState(0);
  const [folders, setFolders] = useState<FolderInfo[] | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me')
      .then((res) => {
        if (!cancelled) setAuthState(res.ok ? 'in' : 'out');
      })
      .catch(() => {
        if (!cancelled) setAuthState('out');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchFolders = useCallback(async (silent: boolean) => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setFolders(Array.isArray(data.folders) ? data.folders : []);
      setFoldersError(null);
    } catch (e) {
      if (!silent) {
        setFolders([]);
        setFoldersError(e instanceof Error ? e.message : String(e));
      }
    }
  }, []);

  // Initial load + auto-refresh: yangi qo'shilgan papkalar avtomat ko'rinadi.
  useEffect(() => {
    if (authState !== 'in') return;
    fetchFolders(false);
    const id = setInterval(() => fetchFolders(true), 20000);
    return () => clearInterval(id);
  }, [authState, fetchFolders]);

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {}
    setAuthState('out');
  };

  const folderList = folders ?? [];
  const folderNames = folderList.map((f) => f.name);
  const currentModIndex =
    folderList.length > 0
      ? ((activeIndex % folderList.length) + folderList.length) % folderList.length
      : 0;
  const activeFolder = folderList.length > 0 ? folderList[currentModIndex] : null;

  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }

  if (authState === 'out') {
    return <LoginPage onSuccess={() => setAuthState('in')} />;
  }

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-hidden font-sans flex flex-col relative selection:bg-emerald-500/30 custom-scrollbar">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none z-0" />

      <Header
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        folders={folderNames}
      />

      <Routes>
        <Route
          path="/"
          element={
            <DashboardPage
              folders={folders}
              foldersError={foldersError}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              activeFolder={activeFolder}
            />
          }
        />
        <Route
          path="/workflow"
          element={
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-500" size={24} />
                </div>
              }
            >
              <WorkflowPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ChatPanel onLogout={handleLogout} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Workflow chat scrollbar — dark + green accent */
        .workflow-chat-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .workflow-chat-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 8px;
          margin: 4px 0;
        }
        .workflow-chat-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(34,255,136,0.35), rgba(34,255,136,0.15));
          border-radius: 8px;
          border: 1px solid rgba(34,255,136,0.25);
          box-shadow: 0 0 6px rgba(34,255,136,0.18) inset;
        }
        .workflow-chat-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(34,255,136,0.55), rgba(34,255,136,0.3));
        }
        .workflow-chat-scroll {
          scrollbar-color: rgba(34,255,136,0.35) rgba(255,255,255,0.04);
          scrollbar-width: thin;
        }

        .chat-md p { margin: 0.35rem 0; line-height: 1.5; }
        .chat-md p:first-child { margin-top: 0; }
        .chat-md p:last-child { margin-bottom: 0; }
        .chat-md ul, .chat-md ol { margin: 0.4rem 0; padding-left: 1.25rem; }
        .chat-md li { margin: 0.15rem 0; }
        .chat-md h1, .chat-md h2, .chat-md h3, .chat-md h4 {
          margin: 0.6rem 0 0.3rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        .chat-md h1 { font-size: 1.05rem; }
        .chat-md h2 { font-size: 1rem; }
        .chat-md h3 { font-size: 0.95rem; }
        .chat-md code {
          background: rgba(255, 255, 255, 0.08);
          padding: 0.1rem 0.35rem;
          border-radius: 4px;
          font-size: 0.85em;
        }
        .chat-md pre {
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.5rem 0;
        }
        .chat-md pre code { background: transparent; padding: 0; }
        .chat-md a { color: rgb(52, 211, 153); text-decoration: underline; }
        .chat-md strong { color: rgba(255, 255, 255, 0.95); font-weight: 600; }
        .chat-md blockquote {
          border-left: 3px solid rgba(16, 185, 129, 0.5);
          padding-left: 0.75rem;
          margin: 0.5rem 0;
          color: rgba(255, 255, 255, 0.7);
        }
        .chat-md hr {
          border: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          margin: 0.75rem 0;
        }
        .chat-md table {
          display: block;
          overflow-x: auto;
          max-width: 100%;
          width: max-content;
          border-collapse: collapse;
          margin: 0.6rem 0;
          font-size: 0.8rem;
        }
        .chat-md thead {
          background: rgba(16, 185, 129, 0.12);
        }
        .chat-md th, .chat-md td {
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 0.45rem 0.65rem;
          text-align: left;
          vertical-align: top;
        }
        .chat-md th {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
        }
        .chat-md tbody tr:nth-child(even) {
          background: rgba(255, 255, 255, 0.025);
        }
      `}</style>
    </div>
  );
}
