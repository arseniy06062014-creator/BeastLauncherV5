import { useState } from 'react';
import { ExternalLink, RotateCw, Search } from 'lucide-react';
import { useApp } from '../context';
import { SkinFigure, useSkin } from '../components/Skin';
import { openLink } from '../utils';

function SkinCard({ nick, title }) {
  const skin = useSkin(nick);
  const [back, setBack] = useState(false);

  return (
    <section className="glass fade-up flex flex-col items-center rounded-2xl p-6">
      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      <p className="mb-4 text-sm text-white/55">{nick}</p>

      <div className="flex h-[330px] items-center justify-center">
        {skin.loading && <p className="text-white/50">Загрузка…</p>}
        {!skin.loading && !skin.found && (
          <p className="max-w-[220px] text-center text-white/55">
            {skin.error ? 'Не удалось загрузить скин' : 'У игрока нет скина на Ely.by'}
          </p>
        )}
        {skin.found && <SkinFigure skin={skin} back={back} scale={10} />}
      </div>

      {skin.found && (
        <button onClick={() => setBack((b) => !b)} className="btn-ghost mt-4">
          <RotateCw className="h-4 w-4" /> {back ? 'Спереди' : 'Сзади'}
        </button>
      )}
    </section>
  );
}

export default function SkinsPage() {
  const { user } = useApp();
  const [input, setInput] = useState('');
  const [other, setOther] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setOther(input.trim());
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,77,0,0.12),transparent_60%)] p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lava-gradient font-display text-4xl font-bold">Скины</h1>
        <button onClick={() => openLink('https://ely.by/skins')} className="btn-lava">
          <ExternalLink className="h-4 w-4" /> Сменить скин на Ely.by
        </button>
      </div>

      {user.offline && (
        <p className="mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
          В офлайн-режиме скин в игре не отображается. Здесь показан скин с Ely.by, если такой ник там зарегистрирован.
        </p>
      )}

      <div className="grid grid-cols-2 gap-6">
        <SkinCard nick={user.name} title="Мой скин" />

        <div className="flex flex-col gap-4">
          <form onSubmit={submit} className="glass rounded-2xl p-4">
            <label className="mb-2 block text-sm font-semibold">Посмотреть скин игрока</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  className="input pl-10"
                  placeholder="Ник на Ely.by"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-lava" disabled={input.trim().length < 2}>
                Найти
              </button>
            </div>
          </form>

          {other && <SkinCard nick={other} title="Скин игрока" />}
        </div>
      </div>
    </div>
  );
}
