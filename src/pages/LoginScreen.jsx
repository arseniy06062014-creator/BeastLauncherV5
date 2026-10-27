import { useState } from 'react';
import { Flame, Loader2, LogIn } from 'lucide-react';
import { api } from '../api';
import { heroStyle, openLink } from '../utils';

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('ely'); // ely | offline
  const [nick, setNick] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const me =
        mode === 'offline'
          ? await api.loginOffline(nick)
          : await api.login({ username, password, totp: needTotp ? totp : undefined });
      onLogin(me);
    } catch (err) {
      if (err.code === 'TOTP_REQUIRED') setNeedTotp(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <div className="hero-bg absolute inset-0" style={heroStyle} />
      <div className="absolute inset-0 bg-black/55" />

      <form onSubmit={submit} className="glass-strong fade-up relative w-[400px] rounded-2xl p-7">
        <div className="mb-6 flex items-center gap-3">
          <Flame className="h-9 w-9 text-lava" strokeWidth={2.2} />
          <div>
            <h1 className="font-display text-3xl font-bold leading-none">Вход</h1>
            <p className="mt-1 text-sm text-white/60">
              {mode === 'ely' ? 'Аккаунт Ely.by' : 'Без аккаунта, без пароля'}
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-black/40 p-1">
          {[
            { id: 'ely', label: 'Ely.by' },
            { id: 'offline', label: 'Офлайн' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setError('');
              }}
              className={`rounded-md py-1.5 text-sm font-semibold transition ${
                mode === t.id ? 'bg-lava text-white' : 'text-white/60 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mode === 'offline' ? (
          <>
            <label className="mb-1.5 block text-sm font-semibold">Ник в игре</label>
            <input
              className="input mb-2"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={16}
              autoFocus
              placeholder="Например, DragonSlayer99"
            />
            <p className="mb-4 text-xs text-white/50">
              Офлайн-режим: подходит для одиночной игры и серверов без проверки лицензии. Серверы с Ely.by и
              лицензионные серверы такой ник не пустят.
            </p>
          </>
        ) : (
          <>
        <label className="mb-1.5 block text-sm font-semibold">Ник или e-mail</label>
        <input
          className="input mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
        />

        <label className="mb-1.5 block text-sm font-semibold">Пароль</label>
        <input
          className="input mb-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {needTotp && (
          <>
            <label className="mb-1.5 block text-sm font-semibold">Код двухфакторной аутентификации</label>
            <input
              className="input mb-4"
              inputMode="numeric"
              maxLength={6}
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              autoFocus
            />
          </>
        )}
          </>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (mode === 'offline' ? nick.trim().length < 3 : !username || !password)}
          className="btn-play flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-2xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <LogIn className="h-6 w-6" />}
          {mode === 'offline' ? 'Играть офлайн' : 'Войти'}
        </button>

        {mode === 'ely' && (
        <button
          type="button"
          onClick={() => openLink('https://ely.by/register')}
          className="mt-4 w-full text-center text-sm text-white/60 transition hover:text-white"
        >
          Нет аккаунта? Зарегистрироваться на Ely.by
        </button>
        )}
      </form>
    </div>
  );
}
