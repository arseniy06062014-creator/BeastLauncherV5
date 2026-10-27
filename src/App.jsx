import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { api } from './api';
import { AppCtx } from './context';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import LoginScreen from './pages/LoginScreen';
import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import ModsPage from './pages/ModsPage';
import SkinsPage from './pages/SkinsPage';
import SettingsPage from './pages/SettingsPage';

function Centered({ children }) {
  return (
    <div className="flex h-screen items-center justify-center bg-obsidian">
      <div className="glass rounded-2xl px-10 py-8 text-center">
        <Flame className="mx-auto mb-3 h-10 w-10 text-lava" />
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [boot, setBoot] = useState('loading'); // loading | ready | browser
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [system, setSystem] = useState({ totalMemGB: 16 });
  const [versions, setVersions] = useState(null);
  const [versionsError, setVersionsError] = useState('');
  const [page, setPage] = useState('home');

  useEffect(() => {
    if (!api) {
      setBoot('browser');
      return;
    }
    Promise.all([api.me(), api.getSettings(), api.systemInfo()])
      .then(([me, s, sys]) => {
        setUser(me);
        setSettings(s);
        setSystem(sys);
        setBoot('ready');
      })
      .catch(() => setBoot('browser'));
  }, []);

  const showSnapshots = settings?.showSnapshots;
  const showOld = settings?.showOld;
  const loggedIn = !!user;

  useEffect(() => {
    if (!api || !loggedIn || showSnapshots === undefined) return;
    setVersionsError('');
    api
      .getVersions({ snapshots: !!showSnapshots, old: !!showOld })
      .then(setVersions)
      .catch((e) => setVersionsError(e.message));
  }, [loggedIn, showSnapshots, showOld]);

  const saveSettings = useCallback(async (patch) => {
    setSettings((s) => ({ ...s, ...patch }));
    try {
      setSettings(await api.saveSettings(patch));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setPage('home');
    }
  }, []);

  const ctx = useMemo(
    () =>
      settings && {
        user,
        settings,
        saveSettings,
        system,
        versions,
        versionsError,
        selection: settings.selected,
        setSelection: (selected) => saveSettings({ selected }),
        goto: setPage,
        onLogout,
        onSessionExpired: () => setUser(null),
      },
    [user, settings, saveSettings, system, versions, versionsError, onLogout]
  );

  if (boot === 'loading') {
    return (
      <Centered>
        <p className="text-white/70">Загрузка…</p>
      </Centered>
    );
  }
  if (boot === 'browser' || !ctx) {
    return (
      <Centered>
        <h1 className="font-display text-2xl font-bold">BeastLauncher</h1>
        <p className="mt-2 text-white/60">Откройте лаунчер через Electron (npm run electron:dev).</p>
      </Centered>
    );
  }

  return (
    <AppCtx.Provider value={ctx}>
      <div className="flex h-screen min-h-[720px] min-w-[1280px] flex-col bg-obsidian">
        <TopBar />
        {!user ? (
          <main className="relative min-h-0 flex-1">
            <LoginScreen onLogin={setUser} />
          </main>
        ) : (
          <div className="flex min-h-0 flex-1">
            <Sidebar active={page} onSelect={setPage} onLogout={onLogout} />
            <main className="relative min-w-0 flex-1">
              {page === 'home' && <HomePage />}
              {page === 'news' && <NewsPage />}
              {page === 'modpacks' && <ModsPage kind="modpack" />}
              {page === 'mods' && <ModsPage kind="mod" />}
              {page === 'skins' && <SkinsPage />}
              {page === 'settings' && <SettingsPage />}
            </main>
          </div>
        )}
      </div>
    </AppCtx.Provider>
  );
}
