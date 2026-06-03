import { Loader2 } from 'lucide-react';
import { Carousel } from '../components/Carousel';
import { DashboardBottom } from '../components/DashboardBottom';
import type { FolderInfo } from '../types';
import { useLang } from '../i18n';

interface DashboardPageProps {
  folders: FolderInfo[] | null;
  foldersError: string | null;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  activeFolder: FolderInfo | null;
}

export default function DashboardPage({
  folders,
  foldersError,
  activeIndex,
  setActiveIndex,
  activeFolder,
}: DashboardPageProps) {
  const { t } = useLang();

  return (
    <div className="flex-1 relative flex flex-col pt-8 overflow-y-auto overflow-x-hidden">
      <div className="flex-1 flex flex-col w-full md:-translate-y-[5%] transition-transform duration-500">
        <div className="-translate-y-[1%]">
          {folders === null ? (
            <div className="relative w-full h-[300px] md:h-[400px] flex items-center justify-center">
              <Loader2 className="animate-spin text-emerald-500" size={24} />
            </div>
          ) : foldersError ? (
            <div className="relative w-full h-[300px] md:h-[400px] flex items-center justify-center">
              <p className="text-red-300/80 text-sm text-center px-6 max-w-md">
                {t('app.foldersLoadError', { error: foldersError })}
              </p>
            </div>
          ) : (
            <Carousel
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              folders={folders}
            />
          )}
        </div>
        <div className="mt-auto w-full">
          <DashboardBottom activeFolder={activeFolder} />
        </div>
      </div>
    </div>
  );
}
