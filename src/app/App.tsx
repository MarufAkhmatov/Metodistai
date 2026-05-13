import { useState } from 'react';
import { Header } from "./components/Header";
import { Carousel, FOLDERS } from "./components/Carousel";
import { DashboardBottom } from "./components/DashboardBottom";
import { ChatPanel } from "./components/ChatPanel";

export default function App() {
  const [activeIndex, setActiveIndex] = useState(5);
  
  const currentModIndex = ((activeIndex % FOLDERS.length) + FOLDERS.length) % FOLDERS.length;
  const activeFolderName = FOLDERS[currentModIndex];

  return (
    <div className="min-h-screen bg-[#030303] text-white overflow-hidden font-sans flex flex-col relative selection:bg-emerald-500/30 custom-scrollbar">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] bg-emerald-900/10 blur-[150px] rounded-full pointer-events-none z-0" />
      
      <Header 
        activeIndex={activeIndex} 
        setActiveIndex={setActiveIndex} 
        folders={FOLDERS} 
      />
      
      <div className="flex-1 relative flex flex-col pt-8 overflow-y-auto overflow-x-hidden">
        <div className="flex-1 flex flex-col w-full md:-translate-y-[5%] transition-transform duration-500">
          <div className="-translate-y-[1%]">
            <Carousel activeIndex={activeIndex} setActiveIndex={setActiveIndex} />
          </div>
          <div className="mt-auto w-full">
            <DashboardBottom activeFolder={activeFolderName} />
          </div>
        </div>
      </div>

      <ChatPanel />

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
