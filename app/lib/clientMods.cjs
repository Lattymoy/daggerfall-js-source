'use strict';
// Explicitly trusted local scripts, not a sandbox. Never search/download/execute files here.
const fs = require('node:fs/promises');
const path = require('node:path');
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_FILE = 1024 * 1024;
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
const below = (root, file) => { const rel = path.relative(root, file); return !!rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
async function readBounded(root, file, limit) {
  const real = await fs.realpath(file);
  if (!below(root, real)) throw Error('Mod file escapes its root');
  const handle = await fs.open(real, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw Error('Invalid mod file size');
    const bytes = Buffer.alloc(limit + 1);
    let size = 0;
    while (size < bytes.length) {
      const read = await handle.read(bytes, size, bytes.length - size, null);
      if (!read.bytesRead) break;
      size += read.bytesRead;
    }
    if (size > limit) throw Error('Mod file exceeds limit');
    return bytes.subarray(0, size);
  } finally { await handle.close(); }
}
function validParts(parts) { return parts.length > 0 && parts.every(p => /^[a-zA-Z0-9_.-]+$/.test(p) && p !== '.' && p !== '..'); }
async function readIndex(userData) {
  const parent = await fs.realpath(userData), root = await fs.realpath(path.join(parent, 'ClientMods'));
  if (!below(parent, root)) throw Error('Mod root escapes user data');
  const index = JSON.parse((await readBounded(root, path.join(root, 'enabled.json'), 64 * 1024)).toString('utf8'));
  if (index.enabled !== true || index.apiVersion !== 1 || !Array.isArray(index.mods) || index.mods.length > 32) throw Error('Disabled or invalid mod index');
  const ids = new Set();
  for (const mod of index.mods) {
    if (typeof mod?.id !== 'string' || !ID.test(mod.id) || ids.has(mod.id) || mod.apiVersion !== 1 || !Array.isArray(mod.requires)
      || mod.requires.length > 16 || mod.requires.some(cap => typeof cap !== 'string' || cap.length > 64)
      || typeof mod.entry !== 'string' || !validParts(mod.entry.split('/')) || !/\.(?:m?js)$/.test(mod.entry)) throw Error('Invalid client mod');
    ids.add(mod.id);
  }
  return { root, index: { enabled: true, apiVersion: 1, mods: index.mods.map(({ id, apiVersion, requires, entry }) => ({ id, apiVersion, requires, entry })) } };
}

/** Reserved same-origin route; no arbitrary filesystem path or remote URL is accepted. */
async function clientModResponse(request, userData) {
  const off = () => Response.json({ enabled: false, apiVersion: 1, mods: [] }, { headers: { 'Cache-Control': 'no-store' } });
  let parts;
  try {
    const url = new URL(request.url);
    if (url.protocol !== 'dagger:' || url.host !== 'game' || request.method !== 'GET') return new Response('not found', { status: 404 });
    parts = url.pathname.split('/').slice(1).map(decodeURIComponent);
    if (parts[0] !== '__client_mods' || !validParts(parts)) return new Response('not found', { status: 404 });
  } catch { return new Response('bad request', { status: 400 }); }
  const isIndex = parts.length === 2 && parts[1] === 'index.json';
  try {
    const { root, index } = await readIndex(userData);
    if (isIndex) return Response.json(index, { headers: { 'Cache-Control': 'no-store' } });
    if (parts.length < 3 || !index.mods.some(mod => mod.id === parts[1])) return new Response('not found', { status: 404 });
    const modRoot = await fs.realpath(path.join(root, parts[1]));
    if (!below(root, modRoot)) throw Error('Mod directory escapes root');
    const file = path.join(modRoot, ...parts.slice(2)), mime = MIME[path.extname(file)];
    if (!mime) return new Response('not found', { status: 404 });
    return new Response(await readBounded(modRoot, file, MAX_FILE), { headers: { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return isIndex ? off() : new Response('not found', { status: 404 }); }
}
module.exports = { clientModResponse };
