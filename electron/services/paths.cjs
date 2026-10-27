const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const LOADERS = ['forge', 'fabric', 'vanilla'];

function root() {
  return path.join(app.getPath('appData'), '.beastlauncher');
}
const gameRoot = () => path.join(root(), 'game');
const cacheDir = () => path.join(root(), 'cache');
const configFile = () => path.join(root(), 'config.json');

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Protects against path traversal: only known loaders and plain version ids are allowed.
function assertSelection(sel) {
  if (!sel || !LOADERS.includes(sel.loader) || !/^[\w.+\- ]{1,60}$/.test(String(sel.mc))) {
    throw new Error('Некорректная версия игры');
  }
  return { loader: sel.loader, mc: String(sel.mc) };
}

function instanceDir(sel) {
  const { loader, mc } = assertSelection(sel);
  return path.join(root(), 'instances', `${loader}-${mc}`);
}
const modsDir = (sel) => path.join(instanceDir(sel), 'mods');

module.exports = {
  LOADERS,
  root,
  gameRoot,
  cacheDir,
  configFile,
  ensure,
  assertSelection,
  instanceDir,
  modsDir,
};
