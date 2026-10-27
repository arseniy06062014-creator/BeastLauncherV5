const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const UA = 'BeastLauncher/0.2.0 (Minecraft launcher)';

class HttpError extends Error {
  constructor(status, data, message) {
    super(message || `HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

async function request(url, { method = 'GET', headers = {}, json, timeout = 20000 } = {}) {
  const h = { 'User-Agent': UA, Accept: 'application/json', ...headers };
  let body;
  if (json !== undefined) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  return fetch(url, {
    method,
    headers: h,
    body,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout),
  });
}

async function fetchJson(url, opts) {
  const res = await request(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new HttpError(res.status, data);
  return data;
}

async function fetchBuffer(url, { maxBytes = 5 * 1024 * 1024, ...opts } = {}) {
  const res = await request(url, { ...opts, headers: { Accept: '*/*', ...(opts.headers || {}) } });
  if (!res.ok) throw new HttpError(res.status, null);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error('Файл слишком большой');
  return buf;
}

async function urlExists(url) {
  try {
    const res = await request(url, { method: 'HEAD', headers: { Accept: '*/*' }, timeout: 15000 });
    return res.ok;
  } catch {
    return false;
  }
}

async function downloadFile(url, dest, { sha1, onProgress, timeout = 180000 } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await request(url, { headers: { Accept: '*/*' }, timeout });
  if (!res.ok || !res.body) {
    throw new HttpError(res.status, null, `Не удалось скачать файл (HTTP ${res.status})`);
  }
  const total = Number(res.headers.get('content-length')) || 0;
  let got = 0;
  const hash = crypto.createHash('sha1');
  const tmp = dest + '.part';
  const stream = Readable.fromWeb(res.body);
  stream.on('data', (chunk) => {
    got += chunk.length;
    hash.update(chunk);
    if (onProgress && total) onProgress(got / total);
  });
  await pipeline(stream, fs.createWriteStream(tmp));
  if (sha1 && hash.digest('hex') !== String(sha1).toLowerCase()) {
    fs.rmSync(tmp, { force: true });
    throw new Error('Контрольная сумма файла не совпала — загрузка отменена');
  }
  fs.renameSync(tmp, dest);
}

module.exports = { HttpError, fetchJson, fetchBuffer, downloadFile, urlExists };
