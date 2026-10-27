const fs = require('fs');
const path = require('path');
const paths = require('./paths.cjs');
const { fetchJson, downloadFile, urlExists } = require('./http.cjs');

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const FORGE_PROMOS_URL = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const FABRIC_META = 'https://meta.fabricmc.net/v2';
const FORGE_MAVEN = 'https://maven.minecraftforge.net/net/minecraftforge/forge';

function parseMc(v) {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

function cmpMc(a, b) {
  const A = parseMc(a);
  const B = parseMc(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i];
  return 0;
}

let cache = { t: 0, data: null };

async function load() {
  if (cache.data && Date.now() - cache.t < 10 * 60 * 1000) return cache.data;
  // Forge's / Fabric's sites being down must not break Vanilla, so their lists are optional.
  const [manifest, promos, fabricGames, fabricLoaders] = await Promise.all([
    fetchJson(MANIFEST_URL),
    fetchJson(FORGE_PROMOS_URL).catch(() => ({ promos: {} })),
    fetchJson(`${FABRIC_META}/versions/game`).catch(() => []),
    fetchJson(`${FABRIC_META}/versions/loader`).catch(() => []),
  ]);
  cache = { t: Date.now(), data: { manifest, promos, fabricGames, fabricLoaders } };
  return cache.data;
}

const VISIBLE_OLD = ['old_beta', 'old_alpha'];

// All Minecraft versions from Mojang's manifest (release, snapshot, beta, alpha),
// plus the ones that have a Forge or Fabric build.
async function getVersions({ snapshots = true, old = true } = {}) {
  const { manifest, promos, fabricGames } = await load();
  const all = manifest.versions;
  const order = new Map(all.map((v, i) => [v.id, i]));
  const typeOf = new Map(all.map((v) => [v.id, v.type]));

  const vanilla = all
    .filter(
      (v) =>
        v.type === 'release' ||
        (snapshots && v.type === 'snapshot') ||
        (old && VISIBLE_OLD.includes(v.type))
    )
    .map((v) => ({ id: v.id, type: v.type }));

  const byMc = {};
  for (const [key, value] of Object.entries(promos.promos || {})) {
    const m = /^(.+)-(latest|recommended)$/.exec(key);
    if (!m) continue;
    (byMc[m[1]] ||= {})[m[2]] = value;
  }
  const forge = Object.entries(byMc)
    .filter(([mc]) => typeOf.get(mc) === 'release' && cmpMc(mc, '1.7.10') >= 0)
    .sort((a, b) => order.get(a[0]) - order.get(b[0]))
    .map(([mc, v]) => ({ mc, forge: v.recommended || v.latest, recommended: !!v.recommended }));

  const fabric = (fabricGames || [])
    .map((g) => ({ mc: g.version, type: typeOf.get(g.version) }))
    .filter((g) => g.type === 'release' || (snapshots && g.type === 'snapshot'))
    .sort((a, b) => order.get(a.mc) - order.get(b.mc));

  return { vanilla, forge, fabric };
}

async function getVersionType(mc) {
  const { manifest } = await load();
  return manifest.versions.find((v) => v.id === mc)?.type || 'release';
}

// Fabric is launched through a generated "version" profile that inherits from vanilla.
async function ensureFabric(mc) {
  const { fabricLoaders } = await load();
  const loader = (fabricLoaders || []).find((l) => l.stable) || (fabricLoaders || [])[0];
  if (!loader) throw new Error('Не удалось получить версию загрузчика Fabric');

  const profile = await fetchJson(
    `${FABRIC_META}/versions/loader/${encodeURIComponent(mc)}/${encodeURIComponent(loader.version)}/profile/json`
  ).catch((e) => {
    if (e.status === 400 || e.status === 404) throw new Error(`Для Minecraft ${mc} нет Fabric`);
    throw e;
  });

  const id = String(profile.id || '');
  if (!/^[\w.+\-]{1,80}$/.test(id)) throw new Error('Некорректный профиль Fabric');
  const file = path.join(paths.gameRoot(), 'versions', id, `${id}.json`);
  paths.ensure(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(profile));
  return id;
}

// Forge < 1.13 is launched from the "universal" jar, 1.13+ from the "installer" jar.
async function ensureForge(mc, onProgress) {
  const { forge } = await getVersions();
  const entry = forge.find((f) => f.mc === mc);
  if (!entry) throw new Error(`Для Minecraft ${mc} нет сборки Forge`);

  const legacy = cmpMc(mc, '1.13') < 0;
  const suffix = legacy ? 'universal.jar' : 'installer.jar';
  // Some old versions have a "-<mc>" branch suffix in the maven path (e.g. 1.7.10).
  const candidates = [`${mc}-${entry.forge}`, `${mc}-${entry.forge}-${mc}`];
  const dir = path.join(paths.cacheDir(), 'forge');

  for (const full of candidates) {
    const file = path.join(dir, `forge-${full}-${suffix}`);
    if (fs.existsSync(file)) return file;
  }
  for (const full of candidates) {
    const name = `forge-${full}-${suffix}`;
    const url = `${FORGE_MAVEN}/${full}/${name}`;
    if (await urlExists(url)) {
      const dest = path.join(dir, name);
      await downloadFile(url, dest, { onProgress });
      return dest;
    }
  }
  throw new Error(`Не удалось найти файл Forge для Minecraft ${mc}`);
}

module.exports = { getVersions, getVersionType, ensureForge, ensureFabric, cmpMc };
