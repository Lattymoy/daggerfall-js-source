// @ts-check
// ═══════════════════════════════════════════════════════════════════
// POI-6 (2026-10-14) - A POI PACK: POIS, LIBRARY ENTRIES AND EVERY ASSET THEY NAME, IN ONE FILE.
//
// Mac: "a tool my developers can use without having to access the codebase" (bible/06-Systems/POI-Editor-Arc.md
// POI-6). A builder takes work from one realm to another, hands it to another builder, or keeps it safe, as one .zip:
//
//   pack.json            { v: 1, kind: 'poi-pack', pois: [document, ...], shelf: [entry, ...] }
//   assets/<sha>.mesh    a mesh (poi/poiMesh.js), named by the sha256 of its bytes
//   assets/<sha>.png     a picture (.png, .jpg or .webp by its own header), the same
//
// Written STORED (systems/save/saveTransfer.js zipStore - the meshes and pictures are already packed); read by the port's
// own zip reader (scenes/dataSource.js readZipEntries: stored and deflated, so a pack a builder zipped again still
// opens - its files, or the folder that holds them). READ, NOTHING IS TRUSTED: each asset hashed against its name and
// read as its kind (a mesh decoded, a picture by its header), each document and entry held to the law - its own shape,
// its id once, and what it wears against the pack's own assets - and each name an asset is used under present - a pack
// that falls short is refused by CODE (`{ code, ...args }`, said by poi/poiText.js packErrorText), never half-read.
// WRITTEN, THE SAME LAW: a pack the reader would refuse is never written (AUDIT POI P2). `readPackBytes` reads the .zip
// itself, inflating only what a pack is made of, each file to its bound (AUDIT POI P5).
//
// Pure but for the hash (crypto.subtle). Not a DFU member. Ledger A (POI).
// ═══════════════════════════════════════════════════════════════════

import { zipStore } from '../systems/save/saveTransfer.js';
import { poiDocProblems, poiShelfProblems, poiAssetsOf, poiAssetProblems, POI_LIMITS } from './poiLaw.js';
import { decodePoiMesh, poiMeshFacts, POI_MESH_LIMITS } from './poiMesh.js';
import { poiImageMetaOf, POI_IMAGE_LIMITS } from './poiImage.js';
import { poiSha256 } from './poiService.js';

export const POI_PACK_VERSION = 1;
export const POI_PACK_KIND = 'poi-pack';
const MAX_POIS = 500, MAX_SHELF = 2000;
/**
 * A pack's bounds: its documents and entries, and its files; AUDIT POI P5: and its bytes as read - `pack.json` at most
 * every document and entry at the law's own bound (poiLaw.js POI_LIMITS.docBytes), the whole at most what a builder may
 * upload in a day (server-account/src/poi.js POI_UPLOAD_DAY_BYTES, held here so the reader stands alone).
 */
export const POI_PACK_LIMITS = Object.freeze({
  pois: MAX_POIS, shelf: MAX_SHELF, files: 20000,
  headBytes: (MAX_POIS + MAX_SHELF) * POI_LIMITS.docBytes + 65536, bytes: 1024 * 1024 * 1024,
});
const EXT = { png: 'png', jpeg: 'jpg', webp: 'webp' };
const ASSET_RE = /^assets\/([0-9a-f]{64})\.(mesh|png|jpg|webp)$/;
const bytesOf = (d) => /** @type {Uint8Array} */ (d instanceof Uint8Array ? d : new Uint8Array(d));

/** An asset's file name in a pack, from its bytes: a mesh `.mesh`, a picture by its header. */
export function packAssetName(sha, bytes) {
  const im = poiImageMetaOf(bytes);
  return `assets/${sha}.${'error' in im ? 'mesh' : EXT[im.format]}`;
}

/**
 * What a pack holds, held to the law before a byte of it is fetched, written or trusted: its counts, each document and
 * entry (`problems` all the law's, `problem` the first), and each id once - `null`, or the refusal `{ code, ...args }`.
 * @param {{ pois?: any[], shelf?: any[] }} what
 */
export function packRefusal({ pois = [], shelf = [] }) {
  if (pois.length > POI_PACK_LIMITS.pois || shelf.length > POI_PACK_LIMITS.shelf) return { code: 'pack-too-large' };
  for (const [i, d] of pois.entries()) { const ps = poiDocProblems(d); if (ps.length) return { code: 'pack-bad-poi', index: i, name: String(d?.name ?? ''), problem: ps[0], problems: ps }; }
  for (const [i, d] of shelf.entries()) { const ps = poiShelfProblems(d); if (ps.length) return { code: 'pack-bad-entry', index: i, name: String(d?.name ?? ''), problem: ps[0], problems: ps }; }
  // AUDIT POI P7: an id once - a second POI under one was dropped unsaid at the import, a second entry put over the first
  const twice = (/** @type {any[]} */ list, /** @type {string} */ code) => {
    const seen = new Set();
    for (const [i, d] of list.entries()) { if (seen.has(d.id)) return { code, index: i, id: d.id, name: String(d.name) }; seen.add(d.id); }
    return null;
  };
  return twice(pois, 'pack-poi-twice') ?? twice(shelf, 'pack-entry-twice');
}

/** What the documents and entries wear, against the pack's own assets (`factsOf(sha)`, poiLaw.js poiAssetProblems'
 *  metaOf). AUDIT POI P3: a part's materials its mesh's submeshes, as the store asks - a pack the store refused halfway
 *  (its assets and the entries before stored, no POI opened) is refused whole, before anything is uploaded. */
function wornRefusal(pois, shelf, factsOf) {
  const worn = (/** @type {any[]} */ list, /** @type {string} */ code) => {
    for (const [i, d] of list.entries()) { const ps = poiAssetProblems(d, factsOf); if (ps.length) return { code, index: i, name: String(d.name), problem: ps[0], problems: ps }; }
    return null;
  };
  return worn(pois, 'pack-bad-poi') ?? worn(shelf, 'pack-bad-entry');
}
/** An asset's facts from its bytes, as the store keeps them - a picture by its header, else a mesh decoded - or null. */
function factsOfBytes(bytes) {
  const im = poiImageMetaOf(bytes);
  if (!('error' in im)) return { kind: 'texture', w: im.w, h: im.h };
  const d = decodePoiMesh(bytes);
  return 'error' in d ? null : { kind: 'mesh', submeshes: d.mesh.submeshes.length };
}

/**
 * A pack's bytes (a .zip): the documents, the entries and every asset they name (`assets`: sha -> bytes; one missing
 * is refused - a pack never names what it does not carry). AUDIT POI P2: and never a pack the reader refuses - the law,
 * the counts and the bytes asked as `readPack` asks them (one open "New place" with no part yet was written, and the
 * whole pack would not open again).
 * @param {{ pois?: any[], shelf?: any[], assets: Map<string, Uint8Array> }} p
 * @returns {{ ok: true, bytes: Uint8Array } | { ok: false, code: string, [arg: string]: any }}
 */
export function writePack({ pois = [], shelf = [], assets }) {
  const refused = packRefusal({ pois, shelf });
  if (refused) return { ok: false, ...refused };
  const named = new Set();
  for (const d of [...pois, ...shelf]) { const { meshes, textures } = poiAssetsOf(d); for (const s of [...meshes, ...textures]) named.add(s); }
  if (named.size + 1 > POI_PACK_LIMITS.files) return { ok: false, code: 'pack-too-large' };
  // pack.json cannot pass its own bound here: every document in it is held to the law's (packRefusal)
  const head = new TextEncoder().encode(JSON.stringify({ v: POI_PACK_VERSION, kind: POI_PACK_KIND, pois, shelf }));
  const order = [...named].sort();
  let total = head.byteLength;
  for (const sha of order) {
    const bytes = assets.get(sha);
    if (!bytes) return { ok: false, code: 'pack-missing-asset', sha };
    total += bytes.byteLength;
  }
  if (total > POI_PACK_LIMITS.bytes) return { ok: false, code: 'pack-too-large' };
  /** @type {{ name: string, data: Uint8Array }[]} */
  const files = [{ name: 'pack.json', data: head }];
  const facts = new Map();
  for (const sha of order) {
    const bytes = assets.get(sha), f = factsOfBytes(bytes);
    if (!f) return { ok: false, code: 'pack-asset-bad', sha };
    facts.set(sha, f);
    files.push({ name: packAssetName(sha, bytes), data: bytes });
  }
  const worn = wornRefusal(pois, shelf, (sha) => facts.get(sha) ?? null);
  if (worn) return { ok: false, ...worn };
  return { ok: true, bytes: zipStore(files) };
}

/**
 * The folder a pack's files stand in: '' when `pack.json` is at the top, `X/` when every file is under one folder that
 * holds it - AUDIT POI P10: a builder who zips the pack's FOLDER (Finder, Explorer) gets `Shrine/pack.json`, which was
 * read as no pack - else null. A Mac's `__MACOSX/` shadows are no file of the pack.
 * @param {string[]} names
 */
export function packRoot(names) {
  const real = names.filter((n) => !n.startsWith('__MACOSX/'));
  if (real.includes('pack.json')) return '';
  const top = /^[^/]+\//.exec(real[0] ?? '')?.[0];
  return top && real.every((n) => n.startsWith(top)) && real.includes(`${top}pack.json`) ? top : null;
}
/** Every asset the documents and entries name, and the kind it is named as: sha -> 'mesh' | 'texture'. */
function namedAssets(docs) {
  const named = new Map();
  for (const d of docs) {
    const { meshes, textures } = poiAssetsOf(d);
    for (const s of meshes) named.set(s, 'mesh');
    for (const s of textures) if (!named.has(s)) named.set(s, 'texture');
  }
  return named;
}

/** `pack.json` read: `{ ok: true, pois, shelf }` - its kind and version, then packRefusal's law - or the refusal. */
function readHead(bytes) {
  let pack;
  try { pack = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { ok: false, code: 'pack-not-a-pack' }; }
  if (pack?.kind !== POI_PACK_KIND) return { ok: false, code: 'pack-not-a-pack' };
  if (pack.v !== POI_PACK_VERSION) return { ok: false, code: 'pack-version', v: pack.v };
  const pois = Array.isArray(pack.pois) ? pack.pois : [], shelf = Array.isArray(pack.shelf) ? pack.shelf : [];
  const refused = packRefusal({ pois, shelf });
  return refused ? { ok: false, ...refused } : { ok: true, pois, shelf };
}

/**
 * A pack read and checked: `{ ok: true, pois, shelf, assets: Map<sha, { kind, bytes }> }` or `{ ok: false, code, ... }`.
 * `assets` holds what the documents and entries name and no more (AUDIT POI P11: a file nothing named was kept, then
 * uploaded against the builder's day).
 * @param {{ name: string, data: ArrayBuffer | Uint8Array }[]} entries the zip's files (readZipEntries')
 */
export async function readPack(entries, subtle = globalThis.crypto.subtle) {
  if (entries.length > POI_PACK_LIMITS.files) return { ok: false, code: 'pack-too-large' };
  const root = packRoot(entries.map((e) => e.name));
  const top = root == null ? null : entries.find((e) => e.name === `${root}pack.json`);
  if (!top) return { ok: false, code: 'pack-not-a-pack' };
  const h = readHead(bytesOf(top.data));
  if (!h.ok) return h;
  const { pois, shelf } = h;
  const named = namedAssets([...pois, ...shelf]);
  // every asset named, by its name: hashed, read as its kind
  const assets = new Map();
  for (const e of entries) {
    const m = e.name.startsWith(root) ? ASSET_RE.exec(e.name.slice(root.length)) : null;
    if (!m || !named.has(m[1])) continue;
    const bytes = bytesOf(e.data);
    if ((await poiSha256(bytes, subtle)) !== m[1]) return { ok: false, code: 'pack-asset-hash', sha: m[1] };
    if (m[2] === 'mesh') {
      const d = decodePoiMesh(bytes);
      if ('error' in d) return { ok: false, code: 'pack-asset-bad', sha: m[1] };
      assets.set(m[1], { kind: 'mesh', bytes, ...poiMeshFacts(d.mesh) });   // AUDIT POI S6: the facts the budgets read
    } else {
      const im = poiImageMetaOf(bytes);
      if ('error' in im) return { ok: false, code: 'pack-asset-bad', sha: m[1] };
      assets.set(m[1], { kind: 'texture', bytes, w: im.w, h: im.h });
    }
  }
  // what they wear is all there, and of its kind
  for (const d of [...pois, ...shelf]) {
    const { meshes, textures } = poiAssetsOf(d);
    for (const s of meshes) if (assets.get(s)?.kind !== 'mesh') return { ok: false, code: 'pack-missing-asset', sha: s, name: String(d.name) };
    for (const s of textures) if (assets.get(s)?.kind !== 'texture') return { ok: false, code: 'pack-missing-asset', sha: s, name: String(d.name) };
  }
  const worn = wornRefusal(pois, shelf, (sha) => assets.get(sha) ?? null);
  if (worn) return { ok: false, ...worn };
  return { ok: true, pois, shelf, assets };
}

/**
 * A pack's .zip read and checked, answered as `readPack` answers. AUDIT POI P5: the whole archive was inflated before
 * anything was asked - a 255 KiB pack carried a 256 MiB file of nothing (768 MiB at its peak) and was taken. Here the
 * central directory is counted before a byte is inflated; `pack.json` is inflated alone, to its bound, and read; then
 * only the assets it names, each to its kind's bound (a mesh's, a picture's) and all of them to the pack's - a size the
 * archive declares past one is refused before anything is inflated, and an entry that inflates past what it declared is
 * stopped there (scenes/dataSource.js readZipEntries' `limit`). Bytes that are no zip are no pack.
 * @param {Uint8Array} bytes the .zip
 */
export async function readPackBytes(bytes, subtle = globalThis.crypto.subtle) {
  const { readZipEntries } = await import('../scenes/dataSource.js');   // the port's own zip reader, stored and deflated
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const file = { arrayBuffer: async () => buf };
  try {
    let count = 0, root = null;
    const heads = await readZipEntries(file, {
      pick: (names) => { count = names.length; root = packRoot(names); return root == null || count > POI_PACK_LIMITS.files ? [] : [`${root}pack.json`]; },
      limit: () => POI_PACK_LIMITS.headBytes,
    });
    if (count > POI_PACK_LIMITS.files) return { ok: false, code: 'pack-too-large' };
    if (!heads.length) return { ok: false, code: 'pack-not-a-pack' };
    const h = readHead(bytesOf(heads[0].data));
    if (!h.ok) return h;
    const named = namedAssets([...h.pois, ...h.shelf]);
    const wanted = (n) => { const m = n.startsWith(root) ? ASSET_RE.exec(n.slice(root.length)) : null; return !!m && named.get(m[1]) === (m[2] === 'mesh' ? 'mesh' : 'texture'); };
    let room = POI_PACK_LIMITS.bytes - heads[0].data.byteLength;
    const assets = await readZipEntries(file, {
      pick: (names) => names.filter(wanted),
      limit: (name, size) => { const max = Math.min(name.endsWith('.mesh') ? POI_MESH_LIMITS.bytes : POI_IMAGE_LIMITS.bytes, room); room -= size; return max; },
    });
    return await readPack([...heads, ...assets], subtle);
  } catch (e) {
    return { ok: false, code: e?.code === 'zip-too-large' ? 'pack-too-large' : 'pack-not-a-pack' };
  }
}
