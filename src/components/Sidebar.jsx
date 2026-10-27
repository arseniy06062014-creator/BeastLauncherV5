import { Home, LogOut, Newspaper, Package, Puzzle, Settings, Shirt } from 'lucide-react';
import { useApp } from '../context';

export const NAV_ITEMS = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'news', label: 'Новости', icon: Newspaper },
  { id: 'modpacks', label: 'Модпаки', icon: Package },
  { id: 'mods', label: 'Моды', icon: Puzzle },
  { id: 'skins', label: 'Скины', icon: Shirt },
  { id: 'settings', label: 'Настройки', icon: Settings },
];

export default function Sidebar({ active, onSelect, onLogout }) {
  return (
    <nav className="flex w-[200px] shrink-0 flex-col justify-between border-r border-white/10 bg-[#0c0c0c] py-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <li key={id}>
              <button
                onClick={() => onSelect(id)}
                className={`flex w-full items-center gap-4 px-6 py-3.5 text-left text-[15px] font-medium transition ${
                  isActive ? 'nav-active text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        onClick={onLogout}
        className="flex items-center gap-4 px-6 py-3 text-sm text-white/60 transition hover:text-white"
      >
        <LogOut className="h-5 w-5" />
        Выход
      </button>
    </nav>
  );
}
