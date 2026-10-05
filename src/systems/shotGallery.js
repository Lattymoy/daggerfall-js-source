// @ts-check
// LOAD1 (2026-10-05, Mac: "add loading screens where needed for the game in an enhanced UI type fashion, maybe make it
// where people can also use screenshots for the loading screen and a way to access them in the menu"): THE GALLERY.
//
// The PrintScreen key (ui/screenshot.js, KB1) saved a PNG to the player's downloads and kept nothing, so the game had
// no picture of its own to show. Every shot is now ALSO kept here - a JPEG no longer than FULL_EDGE on its long side
// and a THUMB_W thumbnail - in this browser's own IndexedDB, and the loading screen (ui/loadingScreen.js) stands on
// one of them. The menu's Screenshots pane (ui/shotsPane.js) shows them, takes one out of the loading screens' turn,
// saves it, deletes it, and brings a picture in from a file.
//
// A RENDER OF GAME DATA IS GAME DATA (Port-Doctrine, non-negotiables): a shot of the world is ARENA2's pixels, so it
// lives where the player's ARENA2 lives - in the player's own browser, never in the repository, never uploaded. This
// module touches no network and no repository path.
//
// ITS OWN DATABASE, not dataSource's: that one holds the ARENA2 ingest behind a versioned upgrade (`openDb`, v5), and
// a version bump there makes every other open tab block the boot (RA1's note). A gallery that fails costs a gallery.
//
// NEVER SILENT, NEVER LOSSY: a full gallery refuses the next shot and says so (`keepShot` answers 'full'); it never
// drops the oldest on its own - a player's pictures are theirs to delete.

export const SHOT_DB = 'dagger-shots';
export const SHOT_STORE = 'shots';
/** The most the gallery keeps. At FULL_EDGE and JPEG_Q a shot is about 150-400 KB, so a full gallery is tens of MB -
 *  well inside a browser's per-site quota, and a number a pane can page through. */
export const GALLERY_MAX = 120;
/** The kept copy's long edge, in pixels. A loading screen is the window's size; past this the bytes buy nothing. */
export const FULL_EDGE = 1920;
export const THUMB_W = 320;
export const JPEG_Q = 0.86;
export const THUMB_Q = 0.72;

/** `w` x `h` scaled to fit within `edge` on its long side, never up - whole pixels, at least 1. */
export function fitWithin(w, h, edge) {
  const W = Math.max(1, Math.round(Number(w) || 0));
  const H = Math.max(1, Math.round(Number(h) || 0));
  const s = Math.min(1, edge / Math.max(W, H));
  return { w: Math.max(1, Math.round(W * s)), h: Math.max(1, Math.round(H * s)) };
}

/** One shot of the rotation, or null - a uniform pick among the shots still in the loading screens' turn
 *  (`loading !== false`: a shot is in the turn until the player takes it out). `rand` is [0, 1). */
export function pickLoadingShot(list, rand = Math.random) {
  const pool = (Array.isArray(list) ? list : []).filter((s) => s && s.loading !== false);
  if (!pool.length) return null;
  const i = Math.min(pool.length - 1, Math.floor(Math.max(0, rand()) * pool.length));
  return pool[i];
}

/** A record as the pane and the loading screen read it: the facts, newest first by `at`. */
export function sortShots(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => (b?.at ?? 0) - (a?.at ?? 0) || (b?.id ?? 0) - (a?.id ?? 0));
}

/** `Daggerfall · 5 Oct 2026` - the caption under a shot: where, and the real day it was taken. */
export function shotCaption(shot) {
  if (!shot) return '';
  const d = new Date(shot.at ?? 0);
  const day = Number.isFinite(d.getTime())
    ? `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getFullYear()}`
    : '';
  return [shot.place || '', day].filter(Boolean).join(' · ');
}

// ── THE BACKEND ──────────────────────────────────────────────────
// IndexedDB in a browser; a memory map for the tests, and for a browser that refuses IndexedDB - no `indexedDB` at all,
// or an open that fails (a private window, blocked site data): the gallery then lives as long as the tab, better than a
// key that answers "could not be kept" every press (AUDIT LOAD1 G4). A connection the browser closes under the tab
// (site data cleared, a version change) is let go and opened again on the next ask.

/** @typedef {{ id?: number, at: number, place: string, w: number, h: number, loading: boolean, blob: Blob, thumb: Blob }} ShotRecord */
/** @typedef {{ put: (rec: ShotRecord) => Promise<number>, all: () => Promise<ShotRecord[]>, get: (id: number) => Promise<ShotRecord|null>, del: (id: number) => Promise<void>, count: () => Promise<number> }} GalleryBackend */

/** @returns {GalleryBackend} */
export function memoryGalleryBackend() {
  const rows = new Map();
  let next = 1;
  return {
    put: async (rec) => { const id = rec.id ?? next++; if (id >= next) next = id + 1; rows.set(id, { ...rec, id }); return id; },
    all: async () => [...rows.values()].map((r) => ({ ...r })),
    get: async (id) => (rows.has(id) ? { ...rows.get(id) } : null),
    del: async (id) => { rows.delete(id); },
    count: async () => rows.size,
  };
}

/** @returns {GalleryBackend|null} */
function idbGalleryBackend(idb = globalThis.indexedDB) {
  if (!idb) return null;
  let dbp = null;
  const open = () => (dbp ??= new Promise((res, rej) => {
    let req;
    try { req = idb.open(SHOT_DB, 1); } catch (e) { dbp = null; rej(openFailed(e)); return; }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(SHOT_STORE)) d.createObjectStore(SHOT_STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbp = null; };   // the browser closed it under the tab: the next ask opens again
      db.onversionchange = () => { db.close(); dbp = null; };   // a newer tab's upgrade is never blocked by this one
      res(db);
    };
    req.onerror = () => { dbp = null; rej(openFailed(req.error)); };
  }));
  const once = (mode, fn) => open().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(SHOT_STORE, mode);
    const req = fn(tx.objectStore(SHOT_STORE));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = (e) => rej(e?.target?.error ?? tx.error);   // AUDIT LOAD1 G7: tx.error is still null while a request's error bubbles
    tx.onabort = (e) => rej(e?.target?.error ?? tx.error ?? new Error('the transaction aborted'));
  }));
  // a connection closing under a transaction throws InvalidStateError at db.transaction - let it go and ask once more
  const run = (mode, fn) => once(mode, fn).catch((e) => {
    if (e?.name !== 'InvalidStateError') throw e;
    dbp = null;
    return once(mode, fn);
  });
  return {
    // a new record carries no `id` at all, so the store's key generator mints one
    put: (rec) => { const { id, ...fresh } = rec; return run('readwrite', (s) => s.put(id == null ? fresh : rec)).then(Number); },
    all: () => run('readonly', (s) => s.getAll()).then((r) => r ?? []),
    get: (id) => run('readonly', (s) => s.get(id)).then((r) => r ?? null),
    del: (id) => run('readwrite', (s) => s.delete(id)).then(() => undefined),
    count: () => run('readonly', (s) => s.count()).then(Number),
  };
}

const openFailed = (cause) => Object.assign(new Error(`the gallery's database would not open: ${cause?.message ?? cause}`), { galleryOpenFailed: true });

/** The backend the gallery asks: IndexedDB while it opens, the memory map from the first open that fails. */
function resilientBackend(primary) {
  const mem = memoryGalleryBackend();
  let use = primary ?? mem;
  const call = (name) => async (...a) => {
    if (use !== mem) {
      try { return await use[name](...a); } catch (e) {
        if (!e?.galleryOpenFailed) throw e;
        console.warn('[shots] IndexedDB refused - the gallery lives in this tab only:', e.message);
        use = mem;
      }
    }
    return mem[name](...a);
  };
  return { put: call('put'), all: call('all'), get: call('get'), del: call('del'), count: call('count') };
}

/** @type {GalleryBackend|null} */
let _backend = null;
/** The tests' second seam: an encode of their own where node has no canvas. */
let _encode = null;
export function setShotEncoder(fn) { _encode = typeof fn === 'function' ? fn : null; }
const listeners = new Set();
/** The tests' seam: a backend of their own (memoryGalleryBackend), or null to fall back to IndexedDB again. */
export function setGalleryBackend(backend) { _backend = backend ?? null; }
function backend() {
  if (_backend) return _backend;
  let idbb = null;
  try { idbb = idbGalleryBackend(); } catch { idbb = null; }
  return (_backend = resilientBackend(idbb));
}
/** The tests' window on the browser path: a backend over `idb` (an IndexedDB factory), the fallback included. */
export const galleryBackendOver = (idb) => resilientBackend(idbGalleryBackend(idb));
/** A pane open on the gallery hears every change - a shot kept while it stands, or one deleted from another view. */
export function onGalleryChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const changed = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* a listener's failure is its own */ } } };

// ── THE ENCODE ───────────────────────────────────────────────────

/** A drawable (an ImageBitmap, an <img>, a canvas) of `w` x `h` encoded as the kept JPEG and its thumbnail. */
async function encodePair(src, w, h, doc = globalThis.document) {
  const full = fitWithin(w, h, FULL_EDGE);
  const thumb = fitWithin(w, h, THUMB_W);
  const draw = (size) => {
    const c = doc.createElement('canvas');
    c.width = size.w; c.height = size.h;
    const g = c.getContext('2d');
    if (!g) throw new Error('no 2d context');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, size.w, size.h);
    return c;
  };
  const blobOf = (c, q) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q));
  const [blob, tb] = await Promise.all([blobOf(draw(full), JPEG_Q), blobOf(draw(thumb), THUMB_Q)]);
  return { blob, thumb: tb, w: full.w, h: full.h };
}

/** An image Blob decoded to something drawImage takes. */
async function decode(blob) {
  if (typeof globalThis.createImageBitmap === 'function') {
    const bm = await globalThis.createImageBitmap(blob);
    return { src: bm, w: bm.width, h: bm.height, done: () => bm.close?.() };
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

/**
 * Keep an image (the PrintScreen PNG, or a picture brought in from a file) in the gallery.
 * Answers the new id, 'full' when the gallery already holds GALLERY_MAX, or null when the image could not be kept
 * (no decoder, no storage) - never a throw: a screenshot that cannot be kept is still a downloaded screenshot.
 * @param {Blob} image
 * @param {{ place?: string, at?: number, encode?: (image: Blob) => Promise<{blob: Blob, thumb: Blob, w: number, h: number}> }} [meta]
 */
export function keepShot(image, meta = {}) {
  // AUDIT LOAD1 G1: ONE AT A TIME. The cap is a count, then a put in another transaction, with a decode between - two
  // presses inside that window both passed at 119. Each keep waits for the last, so the count it reads is the truth.
  const run = _keeping.then(() => keepOne(image, meta));
  _keeping = run.catch(() => null);
  return run;
}
let _keeping = Promise.resolve(null);
async function keepOne(image, { place = '', at = Date.now(), encode = null } = {}) {
  try {
    const b = backend();
    if ((await b.count()) >= GALLERY_MAX) return 'full';
    let enc;
    const encodeWith = encode ?? _encode;
    if (encodeWith) enc = await encodeWith(image);
    else {
      const d = await decode(image);
      try { enc = await encodePair(d.src, d.w, d.h); } finally { d.done(); }
    }
    const id = await b.put({ at, place: String(place || ''), w: enc.w, h: enc.h, loading: true, blob: enc.blob, thumb: enc.thumb });
    changed();
    return id;
  } catch (e) {
    console.warn('[shots] the screenshot could not be kept in the gallery:', e?.message ?? e);
    return null;
  }
}

/** Every shot, newest first - records carrying their Blobs (IndexedDB hands Blobs back lazily). [] when unreadable. */
export async function listShots() {
  try { return sortShots(await backend().all()); } catch { return []; }
}

export async function shotCount() {
  try { return await backend().count(); } catch { return 0; }
}

export async function deleteShot(id) {
  try { await backend().del(id); changed(); return true; } catch { return false; }
}

/** In or out of the loading screens' turn. */
export async function setShotLoading(id, on) {
  try {
    const b = backend();
    const rec = await b.get(id);
    if (!rec) return false;
    await b.put({ ...rec, loading: !!on });
    changed();
    return true;
  } catch { return false; }
}

/** The shot a loading screen stands on: a pick from the turn, or null with nothing in it. */
export async function loadingShot(rand = Math.random) {
  return pickLoadingShot(await listShots(), rand);
}
