import React from 'react';
import { Volume2, VolumeX, Shield, PlayCircle, Users } from 'lucide-react';
import { getSoundMuted, setSoundMuted } from '../services/sound.ts';

interface NavbarProps {
  currentTab: 'play' | 'admin' | 'how-to';
  setCurrentTab: (tab: 'play' | 'admin' | 'how-to') => void;
  isAdminLoggedIn: boolean;
  activeRoomId?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  isAdminLoggedIn,
  activeRoomId
}) => {
  const [muted, setMuted] = React.useState(getSoundMuted());

  const toggleSound = () => {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element Brand Zone */}
        <button
          onClick={() => setCurrentTab('play')}
          className="text-right text-lg sm:text-xl font-bold tracking-tight text-white hover:text-amber-400 transition-colors"
        >
          مسابقة التحدي التفاعلية
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={() => setCurrentTab('play')}
            className={`transition-colors flex items-center gap-1.5 ${
              currentTab === 'play' ? 'text-amber-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>اللعب المباشر</span>
          </button>

          <button
            onClick={() => setCurrentTab('admin')}
            className={`transition-colors flex items-center gap-1.5 ${
              currentTab === 'admin' ? 'text-amber-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>لوحة المضيف {isAdminLoggedIn ? '(متصل)' : ''}</span>
          </button>

          <button
            onClick={() => setCurrentTab('how-to')}
            className={`hidden sm:flex items-center gap-1.5 transition-colors ${
              currentTab === 'how-to' ? 'text-amber-400 font-semibold' : 'hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>طريقة اللعب وقواعد النقاط</span>
          </button>
        </nav>

        {/* Zone 3: Primary action & controls */}
        <div className="flex items-center gap-3">
          {activeRoomId && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
              <span>الغرفة النشطة</span>
              <span className="font-mono font-bold text-amber-400 tracking-wider bg-slate-800 px-2 py-1 rounded">
                {activeRoomId}
              </span>
            </div>
          )}

          <button
            onClick={toggleSound}
            title={muted ? 'تفعيل المؤثرات الصوتية' : 'كتم المؤثرات الصوتية'}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="تبديل الصوت"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
