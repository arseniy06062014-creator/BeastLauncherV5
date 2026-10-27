const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths.cjs');
const store = require('./store.cjs');
const { fetchJson, fetchBuffer, downloadFile } = require('./http.cjs');

const AUTH = 'https://authserver.ely.by/auth';
const SKINS = 'http://skinsystem.ely.by'; // Ely.by documents the skin system over plain HTTP

function coded(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function mapAuthError(e) {
  const msg = (e && e.data && (e.data.errorMessage || e.data.message)) || '';
  if (e.status === 401 && /two factor/i.test(msg)) {
    return coded('TOTP_REQUIRED', 'Аккаунт защищён двухфакторной аутентификацией. Введите код из приложения.');
  }
  if (e.status === 401 || e.status === 400 || e.status === 403) {
    return new Error('Неверный ник/e-mail, пароль или код 2FA');
  }
  if (e.status === 429) return new Error('Слишком много попыток входа. Подождите немного.');
  if (e.status) return new Error(msg || `Ошибка Ely.by (HTTP ${e.status})`);
  return new Error('Нет связи с Ely.by. Проверьте интернет.');
}

// ---------------------------------------------------------------- login
async function login({ username, password, totp }) {
  if (!username || !password) throw new Error('Введите ник/e-mail и пароль');
  const clientToken = crypto.randomUUID();
  let res;
  try {
    res = await fetchJson(`${AUTH}/authenticate`, {
      method: 'POST',
      json: {
        username: String(username).trim(),
        password: totp ? `${password}:${String(totp).trim()}` : String(password),
        clientToken,
        requestUser: true,
      },
    });
  } catch (e) {
    throw mapAuthError(e);
  }
  const profile = res.selectedProfile || (res.availableProfiles || [])[0];
  if (!profile) throw new Error('В аккаунте Ely.by нет игрового профиля');
  store.setAccount({
    name: profile.name,
    uuid: profile.id,
    accessToken: res.accessToken,
    clientToken: res.clientToken || clientToken,
  });
  return { name: profile.name, uuid: profile.id };
}

// Offline account: no password, no Ely.by. Same UUID Minecraft itself uses for offline players.
function offlineUuid(name) {
  const h = crypto.createHash('md5').update('OfflinePlayer:' + name, 'utf8').digest();
  h[6] = (h[6] & 0x0f) | 0x30;
  h[8] = (h[8] & 0x3f) | 0x80;
  return h.toString('hex');
}

function loginOffline(name) {
  name = String(name || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
    throw new Error('Ник: 3–16 символов, только латинские буквы, цифры и _');
  }
  const acc = { name, uuid: offlineUuid(name), offline: true };
  store.setAccount(acc);
  return { name, uuid: acc.uuid, offline: true };
}

function me() {
  const a = store.getAccount();
  return a ? { name: a.name, uuid: a.uuid, offline: !!a.offline } : null;
}

async function logout() {
  const a = store.getAccount();
  store.setAccount(null);
  if (a && !a.offline) {
    try {
      await fetchJson(`${AUTH}/invalidate`, {
        method: 'POST',
        json: { accessToken: a.accessToken, clientToken: a.clientToken },
        timeout: 8000,
      });
    } catch {
      /* best effort */
    }
  }
}

// Validates the saved token; refreshes it if it has expired.
async function ensureValid() {
  const a = store.getAccount();
  if (!a) throw coded('NOT_LOGGED_IN', 'Войдите в аккаунт Ely.by или играйте офлайн');
  if (a.offline) return a;
  try {
    await fetchJson(`${AUTH}/validate`, { method: 'POST', json: { accessToken: a.accessToken } });
    return a;
  } catch (e) {
    if (!e.status) throw new Error('Нет связи с Ely.by. Проверьте интернет.');
  }
  try {
    const r = await fetchJson(`${AUTH}/refresh`, {
      method: 'POST',
      json: { accessToken: a.accessToken, clientToken: a.clientToken, requestUser: true },
    });
    const profile = r.selectedProfile || { id: a.uuid, name: a.name };
    const next = {
      name: profile.name,
      uuid: profile.id,
      accessToken: r.accessToken,
      clientToken: r.clientToken || a.clientToken,
    };
    store.setAccount(next);
    return next;
  } catch {
    store.setAccount(null);
    throw coded('NOT_LOGGED_IN', 'Сессия истекла. Войдите в аккаунт снова.');
  }
}

// ---------------------------------------------------- authlib-injector
// Lets the game talk to Ely.by instead of Mojang: -javaagent:authlib-injector.jar=ely.by
async function ensureInjector() {
  const jar = path.join(paths.ensure(paths.cacheDir()), 'authlib-injector.jar');
  const fresh = fs.existsSync(jar) && Date.now() - fs.statSync(jar).mtimeMs < 30 * 24 * 3600 * 1000;
  if (fresh) return jar;
  try {
    const rel = await fetchJson('https://api.github.com/repos/yushijinhun/authlib-injector/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    const asset = (rel.assets || []).find((x) => /\.jar$/.test(x.name));
    if (!asset) throw new Error('asset not found');
    await downloadFile(asset.browser_download_url, jar);
  } catch {
    try {
      const latest = await fetchJson('https://authlib-injector.yushi.moe/artifact/latest.json');
      await downloadFile(latest.download_url, jar);
    } catch {
      if (!fs.existsSync(jar)) throw new Error('Не удалось скачать authlib-injector (нужен для входа через Ely.by)');
    }
  }
  return jar;
}

// ---------------------------------------------------------------- skins
const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

async function getSkin(nick) {
  nick = String(nick || '').trim();
  if (!/^[A-Za-z0-9_.\- ]{2,32}$/.test(nick)) throw new Error('Некорректный ник');
  const enc = encodeURIComponent(nick);

  let skinUrl = null;
  let model = 'default';
  try {
    const tex = await fetchJson(`${SKINS}/textures/${enc}`, { timeout: 10000 });
    skinUrl = tex?.SKIN?.url || null;
    if (tex?.SKIN?.metadata?.model === 'slim') model = 'slim';
  } catch {
    /* no textures entry — try direct PNG below */
  }

  let buf = null;
  for (const url of [skinUrl, `${SKINS}/skins/${enc}.png`]) {
    if (!url) continue;
    try {
      const b = await fetchBuffer(url, { maxBytes: 1024 * 1024, timeout: 10000 });
      if (isPng(b)) {
        buf = b;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!buf) return { found: false };
  return { found: true, model, dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
}

module.exports = { login, loginOffline, me, logout, ensureValid, ensureInjector, getSkin };
