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
      `}</style>
    </div>
  );
}
