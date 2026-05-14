import { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { FileText } from 'lucide-react';
import type { FolderInfo } from '../types';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

interface CarouselProps {
  activeIndex: number;
  setActiveIndex: (val: number | ((prev: number) => number)) => void;
  folders: FolderInfo[];
}

export function Carousel({ activeIndex, setActiveIndex, folders }: CarouselProps) {
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const panStartIndexRef = useRef(activeIndex);

  const totalItems = folders.length;

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      
      const scaleX = 600 / rect.width;
      let svgX = x * scaleX;
      
      if (svgX < 100) svgX = 100;
      if (svgX > 500) svgX = 500;

      const t = (svgX - 100) / 400;
      const newIndex = Math.round(t * (totalItems - 1));
      
      const currentModIndex = ((activeIndex % totalItems) + totalItems) % totalItems;
      const diff = newIndex - currentModIndex;
      if (diff !== 0) {
        setActiveIndex(prev => prev + diff);
      }
    };

    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, activeIndex, totalItems]);

  if (totalItems === 0) {
    return (
      <div className="relative w-full h-[300px] md:h-[400px] flex items-center justify-center">
        <p className="text-white/40 text-sm text-center px-6">
          Papkalar topilmadi. AI Metodist Agent papkasida normativ hujjatli papkalar borligini tekshiring.
        </p>
      </div>
    );
  }

  const currentModIndex = ((activeIndex % totalItems) + totalItems) % totalItems;
  const t = totalItems > 1 ? currentModIndex / (totalItems - 1) : 0;
  const cx = 100 + 400 * t;
  const cy = 200 - 500 * t + 500 * t * t;

  return (
    <div className="relative w-full h-[300px] md:h-[400px] flex items-center justify-center overflow-visible select-none scale-75 md:scale-100 -mt-10 md:mt-0 m-[0px] px-[0px] py-[10px]" style={{ perspective: '1200px', perspectiveOrigin: '50% 50%' }}>
      
      {/* The Arc Graphic connecting top to the active folder */}
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[200px] z-10">
        <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 600 200" fill="none" style={{ touchAction: 'none', transform: 'translateY(50%) scale(0.85)' }}>
          <path d="M 100 200 Q 300 -50 500 200" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1" strokeDasharray="4 4" fill="transparent" />
          <motion.g
            animate={{ x: cx, y: cy }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onPointerDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 1.1 }}
          >
            <circle cx="0" cy="0" r="18" fill="#052e16" stroke="rgba(16, 185, 129, 0.8)" strokeWidth="1" className="drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
            <path d="M -5 -5 L -9 0 L -5 5 M 5 -5 L 9 0 L 5 5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.g>
        </svg>
      </div>

      <motion.div 
        className="relative w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing" 
        style={{ transformStyle: 'preserve-3d', transform: 'translateY(20%) scale(0.85) rotateX(-20deg)', touchAction: 'pan-y' }}
        onPanStart={() => {
          panStartIndexRef.current = activeIndex;
        }}
        onPan={(e, info) => {
          const shift = Math.round(-info.offset.x / 50); // Every 50px drag shifts 1 folder
          setActiveIndex(panStartIndexRef.current + shift);
        }}
      >
        {folders.map((folder, index) => {
          const totalItems = folders.length;
          
          // Calculate the shortest circular path distance (offset) from the activeIndex
          let closestIndex = index;
          while (closestIndex < activeIndex - totalItems / 2) closestIndex += totalItems;
          while (closestIndex > activeIndex + totalItems / 2) closestIndex -= totalItems;
          
          const offset = closestIndex - activeIndex;
          const absOffset = Math.abs(offset);
          const isActive = offset === 0;

          // Circular positioning math
          const angleDeg = offset * (360 / totalItems);
          const angleRad = angleDeg * (Math.PI / 180);
          const radius = 600; // Radius of the carousel circle
          
          const translateX = Math.sin(angleRad) * radius;
          // Pull active item slightly forward to emphasize it
          const translateZ = Math.cos(angleRad) * radius - radius + (isActive ? 60 : 0);
          
          // Rotate items so they face outward from the center of the cylinder
          const rotateY = -angleDeg;
          
          // Items in the back fade out
          const opacity = isActive ? 1 : Math.max(0, 1 - (absOffset * 0.15));
          const zIndex = 50 - absOffset;

          return (
            <motion.div
              key={index}
              onClick={() => setActiveIndex(activeIndex + offset)}
              className="absolute top-1/2 left-1/2 cursor-pointer"
              initial={false}
              animate={{
                x: `calc(-50% + ${translateX}px)`,
                y: '-50%',
                z: translateZ,
                rotateY: rotateY,
                rotateX: 20, // Counter-tilt so folders stand perfectly upright while the floor is tilted
                opacity: opacity,
              }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                zIndex,
                transformStyle: 'preserve-3d',
                // Hide completely when it is far in the back to avoid seeing it clip
                pointerEvents: absOffset > 6 ? 'none' : 'auto',
                visibility: opacity <= 0 ? 'hidden' : 'visible',
                filter: isActive ? 'drop-shadow(0 15px 40px rgba(40,122,68,0.6))' : 'drop-shadow(0 10px 20px rgba(0,0,0,0.15))'
              }}
            >
              <div className={`relative w-[300px] h-[210px] group transition-all duration-500`}>
                
                {/* Unified Glass Background with exact path clipping */}
                <div 
                  className={`absolute inset-0 transition-colors duration-500 z-0
                    ${isActive 
                      ? 'bg-gradient-to-br from-[#287a44]/95 via-[#287a44]/90 to-[#16502b]/95' 
                      : 'bg-white/70 group-hover:bg-white/80'
                    }
                  `}
                  style={{ 
                    backdropFilter: isActive ? 'blur(12px)' : 'blur(24px)',
                    WebkitBackdropFilter: isActive ? 'blur(12px)' : 'blur(24px)',
                    clipPath: "path('M 0 200 Q 0 210 10 210 L 290 210 Q 300 210 300 200 L 300 42 Q 300 32 290 32 L 116 32 Q 108 32 100 24 L 84 8 Q 76 0 66 0 L 10 0 Q 0 0 0 10 Z')"
                  }}
                >
                  {/* Clean active state without noise */}
                  {isActive && (
                    <div className="absolute top-[32px] left-[116px] right-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  )}
                </div>

                {/* SVG Border Layer to perfectly trace the 45-deg angled folder shape */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 300 210" fill="none">
                  <path 
                    d="M 0 200 Q 0 210 10 210 L 290 210 Q 300 210 300 200 L 300 42 Q 300 32 290 32 L 116 32 Q 108 32 100 24 L 84 8 Q 76 0 66 0 L 10 0 Q 0 0 0 10 Z" 
                    stroke={isActive ? "url(#carousel-morph-border)" : "rgba(255,255,255,0.8)"}
                    strokeWidth={isActive ? "2" : "1.5"}
                  />
                  {isActive && (
                    <defs>
                      <linearGradient id="carousel-morph-border" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                        <stop offset="50%" stopColor="rgba(80,200,120,0.3)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
                      </linearGradient>
                    </defs>
                  )}
                </svg>

                {/* Content Layer */}
                <div className="absolute top-[32px] left-0 w-full h-[178px] flex flex-col justify-end z-20 pointer-events-none px-[15px] py-[20px]">
                  {/* Decorative dots / Icon placeholder */}
                  {!isActive && (
                    <div className="absolute top-1/2 left-5 -translate-y-1/2 grid grid-cols-2 gap-1.5 opacity-60">
                      {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-full bg-white shadow-sm" />)}
                    </div>
                  )}
                  
                  {/* Folder Label — active folder name sits on the right, smaller, clear of the white card */}
                  <div className={`font-medium tracking-wide z-10 drop-shadow-md text-white ${isActive ? 'text-lg mb-1 drop-shadow-lg text-right' : 'text-base text-right'}`}>
                    {folder.name}
                  </div>

                  {/* White folder — count, file types and total size of the active folder */}
                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: -90 }}
                      transition={{ delay: 0.2 }}
                      className="absolute top-[8px] left-0 w-[198px] h-[117px] bg-white/[0.85] backdrop-blur-md rounded-2xl p-3 shadow-[0_15px_50px_rgba(0,0,0,0.5)] z-30 flex flex-col items-center justify-center pointer-events-auto cursor-default"
                    >
                      <div className="flex items-center gap-1.5">
                        <FileText size={16} className="text-emerald-600" />
                        <span className="text-[30px] font-light text-black tracking-tight leading-none">
                          {folder.documentCount}
                        </span>
                        <span className="text-[11px] text-black/50 font-medium self-end mb-1">fayl</span>
                      </div>
                      <div className="text-[10px] text-black/60 font-medium mt-1.5 text-center leading-tight px-1">
                        {[
                          folder.pdfCount > 0 && `PDF ${folder.pdfCount}`,
                          folder.wordCount > 0 && `Word ${folder.wordCount}`,
                          folder.excelCount > 0 && `Excel ${folder.excelCount}`,
                        ]
                          .filter(Boolean)
                          .join('  ·  ') || 'Hujjat yo‘q'}
                      </div>
                      <div className="text-[11px] text-black/45 font-semibold mt-1">
                        {formatSize(folder.totalSizeBytes)}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
