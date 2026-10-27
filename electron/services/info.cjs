const os = require('os');
const { execFile } = require('child_process');
const store = require('./store.cjs');
const { fetchJson } = require('./http.cjs');

const MOJANG_CONTENT = 'https://launchercontent.mojang.com';

// Real news: official Minecraft: Java Edition patch notes from Mojang.
async function getNews() {
  const data = await fetchJson(`${MOJANG_CONTENT}/v2/javaPatchNotes.json`);
  const entries = (data.entries || []).map((e) => {
    const version = e.version || '';
    const imageUrl = e.image && e.image.url ? e.image.url : null;
    return {
      id: `${e.type || 'x'}-${version}`,
      title: e.title || `Minecraft ${version}`,
      type: e.type || 'release',
      version,
      date: e.date || null,
      text: e.shortText || '',
      image: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : MOJANG_CONTENT + imageUrl) : null,
      url: `https://minecraft.wiki/w/Java_Edition_${encodeURIComponent(version.replace(/ /g, '_'))}`,
    };
  });
  entries.sort((a, b) => (new Date(b.date || 0) - new Date(a.date || 0)));
  return entries.slice(0, 40);
}

// Real server status through the public mcsrvstat.us API.
async function getServerStatus() {
  const { servers } = store.getSettings();
  return Promise.all(
    servers.map(async (s) => {
      try {
        const r = await fetchJson(`https://api.mcsrvstat.us/3/${encodeURIComponent(s.address)}`, { timeout: 12000 });
        if (!r.online) return { ...s, status: 'offline' };
        const motd = (r.motd && r.motd.clean ? r.motd.clean.join(' ') : '') || '';
        const maintenance = /maint|обслуж|техн\S* работ|restart/i.test(motd);
        return {
          ...s,
          status: maintenance ? 'maintenance' : 'online',
          players: r.players ? { online: r.players.online, max: r.players.max } : null,
        };
      } catch {
        return { ...s, status: 'unknown' };
      }
    })
  );
}

function checkJava(javaPath) {
  return new Promise((resolve) => {
    execFile(String(javaPath || 'java'), ['-version'], { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) return resolve({ ok: false, text: 'Java не найдена по этому пути' });
      resolve({ ok: true, text: String(stderr || stdout).split('\n')[0].trim() });
    });
  });
}

const systemInfo = () => ({ totalMemGB: Math.max(2, Math.floor(os.totalmem() / 1024 ** 3)) });

module.exports = { getNews, getServerStatus, checkJava, systemInfo };
