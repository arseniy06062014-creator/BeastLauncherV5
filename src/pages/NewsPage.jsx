import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmtDate, openLink } from '../utils';
import { NewsThumb } from './HomePage';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'release', label: 'Релизы' },
  { id: 'snapshot', label: 'Снапшоты' },
];

export default function NewsPage() {
  const [news, setNews] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.getNews().then(setNews).catch((e) => setError(e.message));
  }, []);

  const shown = (news || []).filter((n) => filter === 'all' || n.type === filter);

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,77,0,0.12),transparent_60%)] p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lava-gradient font-display text-4xl font-bold">Новости</h1>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                filter === f.id ? 'bg-lava text-white' : 'glass-item text-white/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!news && !error && <p className="text-white/50">Загрузка…</p>}
      {error && <p className="text-red-300">Не удалось загрузить новости: {error}</p>}

      <div className="grid grid-cols-2 gap-4">
        {shown.map((n) => (
          <article
            key={n.id}
            onClick={() => openLink(n.url)}
            className="glass glass-item fade-up flex cursor-pointer gap-4 rounded-2xl p-4"
          >
            <NewsThumb src={n.image} size={110} />
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-base font-bold leading-tight">{n.title}</h2>
              <p className="mt-1 text-xs text-white/50">
                {fmtDate(n.date)} · {n.type === 'snapshot' ? 'Снапшот' : 'Релиз'}
              </p>
              <p className="mt-2 line-clamp-3 text-sm text-white/75">{n.text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
