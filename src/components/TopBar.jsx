import { useState } from 'react';
import { Bell, Flame, Minus, Settings, Square, X } from 'lucide-react';
import { api } from '../api';
import { SkinHead } from './Skin';
import { useApp } from '../context';

export default function TopBar() {
  const { user, goto } = useApp();
  const [maximized, setMaximized] = useState(false);

  const handleMax = async () => {
    const result = await api?.maximize();
    if (typeof result === 'boolean') setMaximized(result);
  };

  return (
    <header className="drag-region flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0a0a0a] pl-5">
      <div className="flex items-center gap-3">
        <Flame className="h-8 w-8 text-lava" strokeWidth={2.2} />
        <span className="font-display text-2xl font-bold tracking-wide">BeastLauncher</span>
      </div>

      <div className="no-drag flex h-full items-center">
        {user && (
          <>
            <div className="flex items-center gap-3 pr-3">
              <SkinHead nick={user.name} size={40} />
              <span className="text-[15px] font-semibold">{user.name}</span>
            </div>
            <button
              className="relative mx-1 rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Уведомления"
              onClick={() => goto('news')}
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              className="mx-1 mr-4 rounded-lg p-2 text-white/80 transition hover:rotate-45 hover:bg-white/10 hover:text-white"
              aria-label="Настройки"
              onClick={() => goto('settings')}
            >
              <Settings className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="flex h-full border-l border-white/10">
          <button
            onClick={() => api?.minimize()}
            className="flex w-12 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Свернуть"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={handleMax}
            className="flex w-12 items-center justify-center text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={maximized ? 'Восстановить' : 'Развернуть'}
          >
            <Square className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => api?.close()}
            className="flex w-12 items-center justify-center text-white/70 transition hover:bg-red-600 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
