// L10N3b (2026-09-27, Mac: "Install + bundle allowed"): THE TRANSLATION PACKS A PLAYER INSTALLED - kept in this
// browser (or the desktop app), never uploaded, never bundled, one pack a language. A DFU pack is its authors' work
// under their own terms, so the port carries none of it that they have not allowed: the player brings their own, as
// they bring ARENA2, a music pack or their Morrowind files.
//
// Its own IndexedDB database, as the roads cache has its own ('daggerfall-roads', world/roadsCache.js): a pack is
// hundreds of files with a lifecycle of its own, and a store in 'project-dagger' would cost that database a version
// bump - a blocked upgrade for a player with two tabs open - for nothing the game data needs.
//   packs  language tag -> { code, name, installedAt, counts }
//   files  `${tag}/${kind}:${name}` -> { kind, name, path, data }   (text as a string; a font as bytes)
// Every call answers as if nothing were installed when the browser has no IndexedDB (a private window, bare node).

import { classifyPackFile, packContents, isTranslationPack, packNameOf, TEXT_KINDS } from '../systems/translationPacks.js';

const DB_NAME = 'daggerfall-translations';
const PACKS = 'packs';
const FILES = 'files';
let _db = null;

function openDb() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    const idb = globalThis.indexedDB;
    if (!idb) { rej(new Error('no IndexedDB')); return; }
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(PACKS)) d.createObjectStore(PACKS);
      if (!d.objectStoreNames.contains(FILES)) d.createObjectStore(FILES);
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  _db.catch(() => { _db = null; });
  return _db;
}

const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
const result = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const fileKey = (code, kind, name) => `${code}/${kind}:${name}`;

/** Every installed pack, by language tag. Empty without IndexedDB. */
export async function installedPacks() {
  try {
    const d = await openDb();
    const tx = d.transaction(PACKS, 'readonly');
    const store = tx.objectStore(PACKS);
    const [keys, values] = await Promise.all([result(store.getAllKeys()), result(store.getAll())]);
    return new Map(keys.map((k, i) => [k, values[i]]));
  } catch { return new Map(); }
}

/** A language's installed files: [{ kind, name, path, data }]. Empty when it has no pack. */
export async function packFiles(code) {
  try {
    const d = await openDb();
    const store = d.transaction(FILES, 'readonly').objectStore(FILES);
    const prefix = `${code}/`;
    const keys = (await result(store.getAllKeys())).filter((k) => typeof k === 'string' && k.startsWith(prefix));
    const out = [];
    for (const k of keys) {
      const v = await result(d.transaction(FILES, 'readonly').objectStore(FILES).get(k));
      if (v) out.push(v);
    }
    return out;
  } catch { return []; }
}

/** Remove a language's pack - its files and its record. Answers whether there was one. */
export async function removePack(code) {
  try {
    const d = await openDb();
    const store = d.transaction(FILES, 'readonly').objectStore(FILES);
    const keys = (await result(store.getAllKeys())).filter((k) => typeof k === 'string' && k.startsWith(`${code}/`));
    const had = (await installedPacks()).has(code);
    const tx = d.transaction([FILES, PACKS], 'readwrite');
    for (const k of keys) tx.objectStore(FILES).delete(k);
    tx.objectStore(PACKS).delete(code);
    await done(tx);
    return had || keys.length > 0;
  } catch { return false; }
}

/**
 * Install `entries` - [{ path, read(): Promise<string|Uint8Array> }], a folder's files or a zip's - as `code`'s pack,
 * replacing any pack that language had. Only the files the game reads are kept (systems/translationPacks.js); text is
 * decoded as UTF-8, a font kept as bytes. Throws when nothing in them is a translation, and changes nothing then.
 * Answers the pack's record.
 */
export async function installPack(code, entries, { name = null } = {}) {
  const list = [...(entries ?? [])];
  const { files, counts } = packContents(list.map((e) => e.path));
  if (!isTranslationPack(counts)) throw new Error('no string table, quest or book in it - is this a Daggerfall Unity translation?');
  const byPath = new Map(list.map((e) => [e.path, e]));
  const loaded = [];
  for (const f of files) {
    const raw = await byPath.get(f.path).read();
    const data = TEXT_KINDS.has(f.kind)
      ? (typeof raw === 'string' ? raw : new TextDecoder('utf-8').decode(raw))
      : (typeof raw === 'string' ? new TextEncoder().encode(raw) : new Uint8Array(raw));
    loaded.push({ ...f, data });
  }
  await removePack(code);
  const d = await openDb();
  const record = { code, name: name ?? packNameOf(list.map((e) => e.path)), installedAt: Date.now(), counts };
  const tx = d.transaction([FILES, PACKS], 'readwrite');
  for (const f of loaded) tx.objectStore(FILES).put(f, fileKey(code, f.kind, f.name));
  tx.objectStore(PACKS).put(record, code);
  await done(tx);
  return record;
}

/** A picked folder's files (webkitRelativePath) or a zip's entries, as installPack's entries. */
export function packEntriesFromFiles(fileList) {
  return [...(fileList ?? [])].map((f) => ({ path: f.webkitRelativePath || f.name, read: () => f.arrayBuffer().then((b) => new Uint8Array(b)) }))
    .filter((e) => classifyPackFile(e.path));
}

/** Tests: forget the open database (a fresh fake per test). */
export function _resetTranslationStoreForTests() { _db = null; }
