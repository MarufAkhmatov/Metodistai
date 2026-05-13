import { useState } from 'react';
import { 
  Menu, 
  Search, 
  Calendar, 
  Copy, 
  ArrowUpRight, 
  Settings, 
  Bell, 
  ChevronDown, 
  Download, 
  CheckSquare, 
  Plus, 
  Folder, 
  Tag,
  X
} from "lucide-react";

interface HeaderProps {
  activeIndex?: number;
  setActiveIndex?: (index: number) => void;
  folders?: string[];
}

export function Header({ activeIndex = 0, setActiveIndex, folders = [] }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleFolderClick = (index: number) => {
    if (setActiveIndex) {
      setActiveIndex(index);
    }
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim() && setActiveIndex) {
      const matchIndex = folders.findIndex(f => 
        f.toLowerCase().includes(value.toLowerCase())
      );
      if (matchIndex !== -1) {
        setActiveIndex(matchIndex);
      }
    }
  };

  return (
    <>
      <div className="w-full flex flex-col px-6 py-4 space-y-6 relative z-50">
        {/* Top Nav */}
        <div className="flex items-center justify-between">
          {/* Left Actions */}
          <div className="flex items-center space-x-3">
            <button className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center font-bold text-xl">
              R
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <Menu size={18} />
            </button>
          </div>

          {/* Center Timeline Pill (Desktop only) */}
          <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-full p-1.5 backdrop-blur-md">
            {/* Date section */}
            <div className="flex items-center space-x-2 px-4 border-r border-white/10">
              <Calendar size={14} className="text-white/50" />
              <span className="text-sm font-medium text-white/80">January 12</span>
            </div>
            
            {/* Active Status section */}
            <div className="flex items-center px-2 border-r border-white/10">
              <div className="flex items-center -space-x-2">
                <img src="https://images.unsplash.com/photo-1610387694365-19fafcc86d86?w=64&h=64&fit=crop&crop=faces" className="w-6 h-6 rounded-full border-2 border-[#0a0a0a]" alt="User" />
                <img src="https://images.unsplash.com/photo-1629507208649-70919ca33793?w=64&h=64&fit=crop&crop=faces" className="w-6 h-6 rounded-full border-2 border-[#0a0a0a]" alt="User" />
              </div>
              <span className="text-xs text-white/60 ml-3 font-medium">You +</span>
              <div className="w-4 h-4 ml-3 rounded-sm bg-blue-500/20 flex items-center justify-center text-[10px]">
                <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-green-400 rotate-90" />
              </div>
            </div>

            {/* Event section */}
            <div className="flex items-center px-4 bg-emerald-900/30 rounded-full py-1 ml-2 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] relative">
              <span className="text-xs text-emerald-400 font-medium mr-3">09:00 AM</span>
              <div className="flex items-center -space-x-2 mr-3">
                <img src="https://images.unsplash.com/photo-1672675611932-9d722165f0ad?w=64&h=64&fit=crop&crop=faces" className="w-6 h-6 rounded-full border-2 border-emerald-900" alt="User" />
                <img src="https://images.unsplash.com/photo-1614023342667-6f060e9d1e04?w=64&h=64&fit=crop&crop=faces" className="w-6 h-6 rounded-full border-2 border-emerald-900" alt="User" />
              </div>
              <span className="text-sm font-medium text-emerald-100">Audit Committee Review</span>
              <div className="w-4 h-4 ml-4 rounded-sm bg-blue-500/20 flex items-center justify-center text-[10px]">
                <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[5px] border-transparent border-b-yellow-400 -rotate-90" />
              </div>
              <span className="text-xs text-emerald-400/70 font-medium ml-3">10:00 AM</span>
              <div className="flex items-center -space-x-2 ml-3">
                <img src="https://images.unsplash.com/photo-1610387694365-19fafcc86d86?w=64&h=64&fit=crop&crop=faces" className="w-6 h-6 rounded-full border-2 border-emerald-900 opacity-50" alt="User" />
                <img src="https://images.unsplash.com/photo-1629507208649-70919ca33793?w=64&h=64&fit=crop&crop=faces" className="w-6 h-6 rounded-full border-2 border-emerald-900 opacity-50" alt="User" />
              </div>
              <div className="absolute -bottom-2 left-1/2 w-2 h-2 bg-emerald-500 rounded-full blur-sm" />
            </div>

            <div className="flex items-center space-x-2 px-3">
              <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50">
                <Copy size={14} />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/50">
                <ArrowUpRight size={14} />
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
            <button className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors font-medium text-sm">
              EV
            </button>
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
                <span>Folders ({folders.length > 0 ? folders.length : 14})</span>
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
                placeholder="Search folders..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/40 w-full"
              />
            </div>
            
            <button className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 transition-colors">
              <Folder size={16} className="text-white/50" />
              <span>Small</span>
              <ChevronDown size={14} className="text-white/50 ml-1" />
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 transition-colors">
              <Download size={16} className="text-white/50" />
              <span>Export</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 transition-colors">
              <CheckSquare size={16} className="text-white/50" />
              <span>View tasks</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-white/80 transition-colors">
              <Plus size={16} className="text-white/50" />
              <span>Add Contracts</span>
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
            R
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col space-y-8">
          
          {/* Search Area */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Search</h3>
            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-3 space-x-3 w-full focus-within:bg-white/10 focus-within:border-white/20 transition-colors">
              <Search size={18} className="text-white/50 shrink-0" />
              <input
                type="text"
                placeholder="Search folders..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-transparent border-none outline-none text-base text-white placeholder:text-white/40 w-full"
              />
            </div>
          </div>

          {/* Folders List */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Folders</h3>
              <span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded-md">{folders.length} Total</span>
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
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Quick Actions</h3>
            <div className="flex flex-col space-y-2">
              <button className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors">
                <CheckSquare size={18} className="text-white/50" />
                <span>View tasks</span>
              </button>
              <button className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors">
                <Plus size={18} className="text-white/50" />
                <span>Add Contracts</span>
              </button>
              <button className="flex items-center space-x-3 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white/80 transition-colors">
                <Download size={18} className="text-white/50" />
                <span>Export Data</span>
              </button>
            </div>
          </div>

          {/* Settings & Profile */}
          <div className="flex flex-col space-y-4 pb-8">
            <h3 className="text-sm font-medium text-white/50 uppercase tracking-wider">Account</h3>
            <div className="flex items-center justify-between bg-white/5 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center -space-x-2">
                  <img src="https://images.unsplash.com/photo-1610387694365-19fafcc86d86?w=64&h=64&fit=crop&crop=faces" className="w-8 h-8 rounded-full border-2 border-[#111]" alt="User" />
                  <img src="https://images.unsplash.com/photo-1629507208649-70919ca33793?w=64&h=64&fit=crop&crop=faces" className="w-8 h-8 rounded-full border-2 border-[#111]" alt="User" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">You & Team</div>
                  <div className="text-xs text-white/50">2 Active</div>
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
    </>
  );
}
