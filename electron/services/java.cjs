const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFile } = require('child_process');
const paths = require('./paths.cjs');
const { fetchJson, downloadFile } = require('./http.cjs');

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

// Fallback when the version json has no javaVersion (very old versions).
function fallbackMajor(mc) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(mc);
  if (!m) return 8; // alpha / beta / classic and other pre-1.0 ids
  if (Number(m[1]) >= 26) return 25;
  const minor = Number(m[2]);
  const patch = Number(m[3] || 0);
  if (minor <= 16) return 8;
  if (minor === 17) return 16;
  if (minor < 20 || (minor === 20 && patch < 5)) return 17;
  return 21;
}

// Mojang's own version json says which Java the version needs.
async function requiredMajor(mc) {
  try {
    const manifest = await fetchJson(MANIFEST_URL);
    const entry = manifest.versions.find((v) => v.id === mc);
    if (!entry) return fallbackMajor(mc);
    const vjson = await fetchJson(entry.url);
    return vjson.javaVersion?.majorVersion || fallbackMajor(mc);
  } catch {
    return fallbackMajor(mc);
  }
}

const OS = { win32: 'windows', linux: 'linux', darwin: 'mac' }[process.platform];
const ARCH = process.arch === 'arm64' ? 'aarch64' : 'x64';
const EXE = process.platform === 'win32' ? 'java.exe' : 'java';

function findJava(dir) {
  if (!fs.existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === EXE && path.basename(d) === 'bin') return p;
    }
  }
  return null;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 300000, windowsHide: true }, (err, _out, stderr) =>
      err ? reject(new Error(String(stderr || err.message).trim())) : resolve()
    );
  });
}

// Pure-Node .zip extractor (no PowerShell / tar needed). Supports stored + deflate, which is
// all Adoptium uses. Guards against "zip slip" paths.
function extractZip(archive, dest) {
  const buf = fs.readFileSync(archive);
  if (buf.length < 22 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('скачанный файл не является zip-архивом');
  }
  // find End Of Central Directory record
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('повреждённый zip-архив');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const root = path.resolve(dest);
  fs.mkdirSync(root, { recursive: true });

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('повреждённый zip-архив');
    const flags = buf.readUInt16LE(off + 8);
    const method = buf.readUInt16LE(off + 10);
    const csize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commentLen;

    const target = path.resolve(root, name.replace(/\\/g, '/'));
    if (target !== root && !target.startsWith(root + path.sep)) throw new Error('небезопасный путь в архиве');

    if (name.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    let out;
    if (method === 0) out = data;
    else if (method === 8) out = zlib.inflateRawSync(data);
    else throw new Error(`неподдерживаемый способ сжатия ${method}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, out);
  }
}

async function extract(archive, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  try {
    if (archive.endsWith('.zip')) extractZip(archive, dest);
    else await run('tar', ['-xzf', archive, '-C', dest]);
  } catch (e) {
    fs.rmSync(dest, { recursive: true, force: true });
    throw new Error('Не удалось распаковать Java: ' + e.message);
  }
}

// Downloads a Temurin JRE for the given major version once and reuses it afterwards.
async function ensureJava(major, onProgress) {
  const dir = path.join(paths.cacheDir(), 'java', String(major));
  const existing = findJava(dir);
  if (existing) return existing;
  if (!OS) throw new Error('Эта система не поддерживается для автоустановки Java');

  const url = `https://api.adoptium.net/v3/binary/latest/${major}/ga/${OS}/${ARCH}/jre/hotspot/normal/eclipse`;
  const archive = path.join(paths.cacheDir(), 'java', `jre-${major}.${OS === 'windows' ? 'zip' : 'tar.gz'}`);
  await downloadFile(url, archive, { onProgress, timeout: 600000 });
  try {
    await extract(archive, dir);
  } finally {
    fs.rmSync(archive, { force: true });
  }
  const found = findJava(dir);
  if (!found) {
    const top = fs.existsSync(dir) ? fs.readdirSync(dir).join(', ') : '(папка пуста)';
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`Java ${major} скачана, но ${EXE} не найден (в архиве: ${top}). Попробуйте ещё раз.`);
  }
  if (process.platform !== 'win32') fs.chmodSync(found, 0o755);
  return found;
}

// "java" (default) = automatic. Any other value is the user's own path and is used as is.
async function resolveJava(userPath, mc, send) {
  if (userPath && userPath !== 'java') return userPath;
  const major = await requiredMajor(mc);
  send({ type: 'stage', text: `Подготовка Java ${major}…` });
  return ensureJava(major, (p) =>
    send({ type: 'progress', text: `Загрузка Java ${major}…`, percent: Math.round(p * 100) })
  );
}

module.exports = { extractZip, resolveJava, ensureJava, requiredMajor, fallbackMajor, findJava };
