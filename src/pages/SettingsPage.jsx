import { useState } from 'react';
import { FolderOpen, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context';

function Section({ title, children }) {
  return (
    <section className="glass fade-up mb-5 rounded-2xl p-5">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { user, settings, saveSettings, onLogout } = useApp();

  const [javaPath, setJavaPath] = useState(settings.javaPath);
  const [javaInfo, setJavaInfo] = useState(null);
  const [servers, setServers] = useState(settings.servers);
  const [saved, setSaved] = useState(false);

  const checkJava = async () => {
    setJavaInfo({ text: 'Проверка…' });
    await saveSettings({ javaPath });
    setJavaInfo(await api.checkJava(javaPath));
  };

  const setServer = (i, key, value) =>
    setServers((list) => list.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));

  const saveServers = async () => {
    await saveSettings({ servers });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,77,0,0.12),transparent_60%)] p-8">
      <h1 className="text-lava-gradient mb-6 font-display text-4xl font-bold">Настройки</h1>

      <div className="max-w-3xl">
        <Section title="Аккаунт">
          <div className="flex items-center justify-between">
            <span className="text-[15px]">
              Вы вошли как <b>{user.name}</b>
              {user.offline ? ' (офлайн)' : ' (Ely.by)'}
            </span>
            <button onClick={onLogout} className="btn-ghost">
              {user.offline ? 'Сменить ник / войти через Ely.by' : 'Выйти из аккаунта'}
            </button>
          </div>
        </Section>

        <Section title="Игра">
          <label className="mb-1.5 block text-sm font-semibold">Путь к Java</label>
          <div className="flex gap-2">
            <input className="input flex-1" value={javaPath} onChange={(e) => setJavaPath(e.target.value)} />
            <button onClick={checkJava} className="btn-ghost">
              Проверить
            </button>
          </div>
          {javaInfo && (
            <p className={`mt-2 text-sm ${javaInfo.ok === false ? 'text-red-300' : 'text-white/70'}`}>{javaInfo.text}</p>
          )}
          <p className="mt-2 text-xs text-white/45">
            Значение «java» — автоматический режим: лаунчер сам скачает нужную Java (8, 17 или 21) под выбранную версию
            Minecraft. Менять путь нужно только если хотите использовать свою Java.
          </p>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-[15px] font-semibold">Показывать снапшоты</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.showSnapshots}
              onClick={() => saveSettings({ showSnapshots: !settings.showSnapshots })}
              className="toggle"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[15px] font-semibold">Показывать Beta и Alpha</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.showOld}
              onClick={() => saveSettings({ showOld: !settings.showOld })}
              className="toggle"
            />
          </div>

          <button onClick={() => api.openGameFolder()} className="btn-ghost mt-5">
            <FolderOpen className="h-4 w-4" /> Открыть папку лаунчера
          </button>
        </Section>

        <Section title="Серверы (статус и авто-подключение)">
          <ul className="flex flex-col gap-2">
            {servers.map((s, i) => (
              <li key={i} className="flex gap-2">
                <input
                  className="input w-48"
                  placeholder="Название"
                  value={s.name}
                  onChange={(e) => setServer(i, 'name', e.target.value)}
                />
                <input
                  className="input flex-1"
                  placeholder="адрес[:порт]"
                  value={s.address}
                  onChange={(e) => setServer(i, 'address', e.target.value)}
                />
                <button
                  onClick={() => setServers((l) => l.filter((_, idx) => idx !== i))}
                  className="btn-ghost"
                  aria-label="Удалить сервер"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setServers((l) => [...l, { name: '', address: '' }])}
              disabled={servers.length >= 10}
              className="btn-ghost"
            >
              <Plus className="h-4 w-4" /> Добавить
            </button>
            <button onClick={saveServers} className="btn-lava">
              {saved ? 'Сохранено' : 'Сохранить'}
            </button>
          </div>

          <label className="mb-1.5 mt-5 block text-sm font-semibold">Сервер для авто-подключения</label>
          <select
            className="input cursor-pointer"
            value={settings.autoConnectServer}
            onChange={(e) => saveSettings({ autoConnectServer: e.target.value })}
          >
            <option value="" className="bg-[#111]">
              Первый в списке
            </option>
            {settings.servers.map((s) => (
              <option key={s.address} value={s.address} className="bg-[#111]">
                {s.name} ({s.address})
              </option>
            ))}
          </select>
        </Section>
      </div>
    </div>
  );
}
