const fs = require('fs');
const { safeStorage } = require('electron');
const paths = require('./paths.cjs');

const DEFAULTS = {
  ram: 8,
  javaPath: 'java',
  showSnapshots: true,
  showOld: true,
  autoConnect: false,
  autoConnectServer: '',
  selected: { loader: 'forge', mc: '1.20.1' },
  // Replace these in Настройки → Серверы with your own servers.
  servers: [
    { name: 'Hypixel', address: 'mc.hypixel.net' },
    { name: 'CubeCraft', address: 'play.cubecraft.net' },
    { name: 'Mineplex', address: 'us.mineplex.com' },
  ],
};

let cache = null;

function read() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(paths.configFile(), 'utf8'));
  } catch {
    cache = {};
  }
  cache.settings = { ...DEFAULTS, ...(cache.settings || {}) };
  if (cache.settings._v !== 2) {
    // v2: snapshots, beta and alpha versions are shown by default
    cache.settings.showSnapshots = true;
    cache.settings.showOld = true;
    cache.settings._v = 2;
  }
  return cache;
}

function write() {
  paths.ensure(paths.root());
  fs.writeFileSync(paths.configFile(), JSON.stringify(cache, null, 2));
}

const getSettings = () => read().settings;

function patchSettings(patch = {}) {
  const s = read().settings;
  if ('ram' in patch) s.ram = Math.min(64, Math.max(1, Math.round(Number(patch.ram)) || 8));
  if ('javaPath' in patch) s.javaPath = String(patch.javaPath || 'java').trim() || 'java';
  if ('showSnapshots' in patch) s.showSnapshots = !!patch.showSnapshots;
  if ('showOld' in patch) s.showOld = !!patch.showOld;
  if ('autoConnect' in patch) s.autoConnect = !!patch.autoConnect;
  if ('autoConnectServer' in patch) s.autoConnectServer = String(patch.autoConnectServer || '');
  if ('selected' in patch) s.selected = paths.assertSelection(patch.selected);
  if ('servers' in patch && Array.isArray(patch.servers)) {
    s.servers = patch.servers
      .map((x) => ({
        name: String(x.name || '').trim().slice(0, 40),
        address: String(x.address || '').trim().slice(0, 100),
      }))
      .filter((x) => x.name && x.address)
      .slice(0, 10);
  }
  write();
  return s;
}

// --- Account (tokens are encrypted with the OS keychain when available) ---
function enc(text) {
  if (safeStorage.isEncryptionAvailable()) {
    return 'enc:' + safeStorage.encryptString(text).toString('base64');
  }
  return 'raw:' + Buffer.from(text, 'utf8').toString('base64');
}

function dec(value) {
  if (!value) return null;
  try {
    const kind = value.slice(0, 4);
    const buf = Buffer.from(value.slice(4), 'base64');
    return kind === 'enc:' ? safeStorage.decryptString(buf) : buf.toString('utf8');
  } catch {
    return null;
  }
}

function getAccount() {
  const a = read().account;
  if (!a) return null;
  if (a.offline) return { name: a.name, uuid: a.uuid, offline: true };
  const accessToken = dec(a.accessToken);
  if (!accessToken) return null;
  return { name: a.name, uuid: a.uuid, clientToken: a.clientToken, accessToken };
}

function setAccount(acc) {
  read().account = acc && acc.offline
    ? { name: acc.name, uuid: acc.uuid, offline: true }
    : acc
    ? {
        name: acc.name,
        uuid: acc.uuid,
        clientToken: acc.clientToken,
        accessToken: enc(acc.accessToken),
      }
    : null;
  write();
}

module.exports = { getSettings, patchSettings, getAccount, setAccount };
