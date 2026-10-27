const fs = require('fs');
const path = require('path');
const paths = require('./paths.cjs');
const { fetchJson, downloadFile } = require('./http.cjs');

const API = 'https://api.modrinth.com/v2';

const indexFile = (sel) => path.join(paths.instanceDir(sel), 'beast-mods.json');

function readIndex(sel) {
  try {
    return JSON.parse(fs.readFileSync(indexFile(sel), 'utf8'));
  } catch {
    return [];
  }
}
function writeIndex(sel, list) {
  paths.ensure(paths.instanceDir(sel));
  fs.writeFileSync(indexFile(sel), JSON.stringify(list, null, 2));
}

// ---------------------------------------------------------------- search
async function search({ query = '', projectType = 'mod', mc, loader, index = 'relevance', offset = 0, limit = 20 }) {
  const facets = [[`project_type:${projectType}`]];
  if (mc) facets.push([`versions:${mc}`]);
  if (loader && loader !== 'vanilla') facets.push([`categories:${loader}`]);

  const params = new URLSearchParams({
    query: String(query).slice(0, 100),
    facets: JSON.stringify(facets),
    index: ['relevance', 'downloads', 'follows', 'newest', 'updated'].includes(index) ? index : 'relevance',
    limit: String(Math.min(50, limit)),
    offset: String(Math.max(0, offset)),
  });
  const res = await fetchJson(`${API}/search?${params}`);
  return {
    total: res.total_hits || 0,
    hits: (res.hits || []).map((h) => ({
      id: h.project_id,
      slug: h.slug,
      type: h.project_type,
      title: h.title,
      description: h.description,
      author: h.author,
      icon: h.icon_url || null,
      downloads: h.downloads || 0,
    })),
  };
}

// ---------------------------------------------------------------- install
async function pickVersion(projectId, sel) {
  const params = new URLSearchParams({
    loaders: JSON.stringify([sel.loader]),
    game_versions: JSON.stringify([sel.mc]),
  });
  const versions = await fetchJson(`${API}/project/${encodeURIComponent(projectId)}/version?${params}`);
  if (!versions || !versions.length) return null;
  return versions.find((v) => v.version_type === 'release') || versions[0];
}

async function installOne(projectId, sel, seen, asDependency) {
  if (seen.has(projectId)) return [];
  seen.add(projectId);

  const list = readIndex(sel);
  if (list.some((m) => m.projectId === projectId)) return [];

  const version = await pickVersion(projectId, sel);
  if (!version) {
    if (asDependency) return [];
    throw new Error(`Нет версии мода для ${sel.loader} ${sel.mc}`);
  }
  const file = (version.files || []).find((f) => f.primary) || version.files?.[0];
  if (!file) throw new Error('У мода нет файла для скачивания');
  if (!/^[\w.\-+() ]+\.jar$/.test(file.filename)) throw new Error('Недопустимое имя файла мода');

  const project = await fetchJson(`${API}/project/${encodeURIComponent(projectId)}`);
  const dest = path.join(paths.ensure(paths.modsDir(sel)), file.filename);
  await downloadFile(file.url, dest, { sha1: file.hashes?.sha1 });

  const installed = [
    {
      projectId,
      slug: project.slug,
      title: project.title,
      icon: project.icon_url || null,
      versionId: version.id,
      versionNumber: version.version_number,
      filename: file.filename,
      dependency: !!asDependency,
    },
  ];

  for (const dep of version.dependencies || []) {
    if (dep.dependency_type === 'required' && dep.project_id) {
      try {
        installed.push(...(await installOne(dep.project_id, sel, seen, true)));
      } catch {
        /* a missing optional-ish dependency shouldn't fail the whole install */
      }
    }
  }

  const fresh = readIndex(sel);
  writeIndex(sel, [...fresh, ...installed.filter((m) => !fresh.some((x) => x.projectId === m.projectId))]);
  return installed;
}

async function install(projectId, selection) {
  const sel = paths.assertSelection(selection);
  if (sel.loader === 'vanilla') throw new Error('Моды работают только с Forge и Fabric');
  const installed = await installOne(String(projectId), sel, new Set(), false);
  return { installed: installed.length };
}

function remove(projectId, selection) {
  const sel = paths.assertSelection(selection);
  const list = readIndex(sel);
  const mod = list.find((m) => m.projectId === projectId);
  if (!mod) return { removed: false };
  fs.rmSync(path.join(paths.modsDir(sel), path.basename(mod.filename)), { force: true });
  writeIndex(sel, list.filter((m) => m.projectId !== projectId));
  return { removed: true };
}

function installed(selection) {
  return readIndex(paths.assertSelection(selection));
}

module.exports = { search, install, remove, installed };
