const { contextBridge, ipcRenderer } = require('electron');

// Turns {ok, data} / {ok:false, error, code} from the main process into promises.
async function call(channel, ...args) {
  const r = await ipcRenderer.invoke(channel, ...args);
  if (!r.ok) {
    const err = new Error(r.error || 'Неизвестная ошибка');
    err.code = r.code;
    throw err;
  }
  return r.data;
}

contextBridge.exposeInMainWorld('beast', {
  // window
  minimize: () => call('window:minimize'),
  maximize: () => call('window:maximize'),
  close: () => call('window:close'),
  // app
  getSettings: () => call('settings:get'),
  saveSettings: (patch) => call('settings:patch', patch),
  systemInfo: () => call('system:info'),
  checkJava: (javaPath) => call('java:check', javaPath),
  openGameFolder: () => call('folder:open'),
  openExternal: (url) => call('external:open', url),
  // account
  login: (creds) => call('auth:login', creds),
  loginOffline: (name) => call('auth:offline', name),
  me: () => call('auth:me'),
  logout: () => call('auth:logout'),
  getSkin: (nick) => call('skin:get', nick),
  // data
  getVersions: (opts) => call('versions:get', opts),
  getNews: () => call('news:get'),
  getServerStatus: () => call('servers:status'),
  // mods
  searchMods: (query) => call('mods:search', query),
  installMod: (id, selection) => call('mods:install', id, selection),
  removeMod: (id, selection) => call('mods:remove', id, selection),
  installedMods: (selection) => call('mods:installed', selection),
  // launch
  play: (opts) => call('launcher:play', opts),
  onLaunchEvent: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on('launcher:event', handler);
    return () => ipcRenderer.removeListener('launcher:event', handler);
  },
});
