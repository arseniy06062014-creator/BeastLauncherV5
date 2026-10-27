const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const paths = require('./services/paths.cjs');
const store = require('./services/store.cjs');
const ely = require('./services/ely.cjs');
const versions = require('./services/versions.cjs');
const modrinth = require('./services/modrinth.cjs');
const info = require('./services/info.cjs');
const launcher = require('./services/launcher.cjs');

const DEV_URL = 'http://localhost:5173';
const EXTERNAL_HOSTS = ['ely.by', 'modrinth.com', 'minecraft.wiki', 'minecraft.net'];

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    frame: false, // custom title bar is drawn in React
    backgroundColor: '#0f0f0f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.once('ready-to-show', () => win.show());

  // Never navigate the app window away; open links in the system browser instead.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(DEV_URL) && !url.startsWith('file://')) e.preventDefault();
  });

  if (app.isPackaged) win.loadFile(path.join(__dirname, '../dist/index.html'));
  else win.loadURL(DEV_URL);
}

// Every handler returns {ok, data} or {ok:false, error, code}; the preload turns that back into promises.
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await fn(event, ...args) };
    } catch (err) {
      return { ok: false, error: (err && err.message) || String(err), code: err && err.code };
    }
  });
}

const winOf = (event) => BrowserWindow.fromWebContents(event.sender);

// --- window
handle('window:minimize', (e) => winOf(e).minimize());
handle('window:maximize', (e) => {
  const w = winOf(e);
  if (w.isMaximized()) w.unmaximize();
  else w.maximize();
  return w.isMaximized();
});
handle('window:close', (e) => winOf(e).close());

// --- app / settings
handle('settings:get', () => store.getSettings());
handle('settings:patch', (_e, patch) => store.patchSettings(patch));
handle('system:info', () => info.systemInfo());
handle('java:check', (_e, javaPath) => info.checkJava(javaPath));
handle('folder:open', () => shell.openPath(paths.ensure(paths.root())));
handle('external:open', (_e, url) => {
  const u = new URL(url);
  const ok = u.protocol === 'https:' && EXTERNAL_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  if (!ok) throw new Error('Ссылка не разрешена');
  return shell.openExternal(u.toString());
});

// --- account (Ely.by)
handle('auth:login', (_e, creds) => ely.login(creds));
handle('auth:offline', (_e, name) => ely.loginOffline(name));
handle('auth:me', () => ely.me());
handle('auth:logout', () => ely.logout());
handle('skin:get', (_e, nick) => ely.getSkin(nick));

// --- game data
handle('versions:get', (_e, opts) => versions.getVersions(opts));
handle('news:get', () => info.getNews());
handle('servers:status', () => info.getServerStatus());

// --- mods (Modrinth)
handle('mods:search', (_e, q) => modrinth.search(q));
handle('mods:install', (_e, id, sel) => modrinth.install(id, sel));
handle('mods:remove', (_e, id, sel) => modrinth.remove(id, sel));
handle('mods:installed', (_e, sel) => modrinth.installed(sel));

// --- launch
handle('launcher:play', (event, opts) =>
  launcher.play(opts, (payload) => {
    if (!event.sender.isDestroyed()) event.sender.send('launcher:event', payload);
  })
);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
