import { useCallback, useEffect, useState } from 'react';
import { Check, Download, ExternalLink, Loader2, Search, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context';
import { fmtNum, openLink } from '../utils';

const SORTS = [
  { id: 'relevance', label: 'По релевантности' },
  { id: 'downloads', label: 'По загрузкам' },
  { id: 'newest', label: 'Новые' },
  { id: 'updated', label: 'Обновлённые' },
];

function Icon({ src }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {src && !failed ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <Download className="h-6 w-6 text-white/30" />
      )}
    </div>
  );
}

// kind = 'mod' (installable Forge mods) or 'modpack' (browse Modrinth modpacks)
export default function ModsPage({ kind = 'mod' }) {
  const { selection, goto } = useApp();
  const isPack = kind === 'modpack';

  const [tab, setTab] = useState('browse');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState('relevance');
  const [hits, setHits] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [installed, setInstalled] = useState([]);
  const [busy, setBusy] = useState({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const refreshInstalled = useCallback(() => {
    if (isPack || selection.loader === 'vanilla') return;
    api.installedMods(selection).then(setInstalled).catch(() => setInstalled([]));
  }, [isPack, selection]);

  useEffect(refreshInstalled, [refreshInstalled]);

  const runSearch = useCallback(
    async (offset) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.searchMods({
          query: debounced,
          projectType: isPack ? 'modpack' : 'mod',
          mc: selection.mc,
          loader: selection.loader === 'vanilla' ? undefined : selection.loader,
          index: sort,
          offset,
        });
        setTotal(res.total);
        setHits((prev) => (offset === 0 ? res.hits : [...prev, ...res.hits]));
      } catch (e) {
        setError(e.message || 'Ошибка поиска');
      } finally {
        setLoading(false);
      }
    },
    [debounced, isPack, selection.mc, selection.loader, sort]
  );

  useEffect(() => {
    runSearch(0);
  }, [runSearch]);

  const isInstalled = (id) => installed.some((m) => m.projectId === id);

  const install = async (hit) => {
    setBusy((b) => ({ ...b, [hit.id]: true }));
    setNotice('');
    try {
      const r = await api.installMod(hit.id, selection);
      setNotice(
        r.installed > 1
          ? `Установлено: ${hit.title} (+${r.installed - 1} зависимостей)`
          : `Установлено: ${hit.title}`
      );
      refreshInstalled();
    } catch (e) {
      setNotice(`Ошибка: ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, [hit.id]: false }));
    }
  };

  const remove = async (id, title) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await api.removeMod(id, selection);
      setNotice(`Удалено: ${title}`);
      refreshInstalled();
    } catch (e) {
      setNotice(`Ошибка: ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  if (!isPack && selection.loader === 'vanilla') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="glass fade-up max-w-md rounded-2xl px-8 py-7 text-center">
          <h1 className="text-lava-gradient font-display text-3xl font-bold">Моды</h1>
          <p className="mt-3 text-white/70">
            Моды работают только с Forge и Fabric. Сейчас выбрана версия Vanilla {selection.mc}. Выберите Forge или
            Fabric на главной.
          </p>
          <button onClick={() => goto('home')} className="btn-lava mt-5">
            На главную
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,77,0,0.12),transparent_60%)] p-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-lava-gradient font-display text-4xl font-bold">{isPack ? 'Модпаки' : 'Моды'}</h1>
          <p className="mt-1 text-sm text-white/60">
            Modrinth · {{ forge: 'Forge', fabric: 'Fabric', vanilla: 'Vanilla' }[selection.loader]} {selection.mc}
          </p>
        </div>
        {!isPack && (
          <div className="flex gap-2">
            {[
              { id: 'browse', label: 'Каталог' },
              { id: 'installed', label: `Установленные (${installed.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? 'bg-lava text-white' : 'glass-item text-white/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {notice && (
        <p className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">{notice}</p>
      )}

      {tab === 'browse' || isPack ? (
        <>
          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                className="input pl-10"
                placeholder={isPack ? 'Поиск модпаков' : 'Поиск модов'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="input w-56 cursor-pointer">
              {SORTS.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#111]">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {error && <p className="text-red-300">Ошибка: {error}</p>}
            {!error && !loading && hits.length === 0 && <p className="text-white/50">Ничего не найдено</p>}

            <ul className="flex flex-col gap-2.5">
              {hits.map((h) => (
                <li key={h.id} className="glass glass-item flex items-center gap-4 rounded-xl p-3">
                  <Icon src={h.icon} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <h3 className="truncate text-[15px] font-bold">{h.title}</h3>
                      <span className="shrink-0 text-xs text-white/45">от {h.author}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-white/70">{h.description}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-white/45">
                      <Download className="h-3 w-3" /> {fmtNum(h.downloads)}
                    </p>
                  </div>

                  {isPack ? (
                    <button onClick={() => openLink(`https://modrinth.com/modpack/${h.slug}`)} className="btn-ghost">
                      <ExternalLink className="h-4 w-4" /> Открыть
                    </button>
                  ) : isInstalled(h.id) ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-400">
                      <Check className="h-4 w-4" /> Установлено
                    </span>
                  ) : (
                    <button onClick={() => install(h)} disabled={busy[h.id]} className="btn-lava">
                      {busy[h.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {busy[h.id] ? 'Установка…' : 'Установить'}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {loading && <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-lava" />}
            {!loading && hits.length > 0 && hits.length < total && (
              <button onClick={() => runSearch(hits.length)} className="btn-ghost mx-auto my-4">
                Показать ещё
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {installed.length === 0 && <p className="text-white/50">Модов для этой версии пока нет</p>}
          <ul className="flex flex-col gap-2.5">
            {installed.map((m) => (
              <li key={m.projectId} className="glass glass-item flex items-center gap-4 rounded-xl p-3">
                <Icon src={m.icon} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-bold">{m.title}</h3>
                  <p className="text-xs text-white/50">
                    {m.versionNumber} · {m.filename}
                    {m.dependency ? ' · зависимость' : ''}
                  </p>
                </div>
                <button onClick={() => remove(m.projectId, m.title)} disabled={busy[m.projectId]} className="btn-ghost">
                  <Trash2 className="h-4 w-4" /> Удалить
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
