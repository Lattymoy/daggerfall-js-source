// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT RELEASE R4-4 (bible/01-Overview/audits/Audit-Release-R4.md; the owner: "Take care of exclusions and gaps") - THE
// BOOT'S CONTINENT, KEPT. Every boot, a returning one too, traced the picture (TMAP00I0 + TAMRIEL2), masked the
// relief and fitted the Bay to the picture - the same answers from the same inputs, some 0.5-1 s of the page's thread.
// They are kept in IndexedDB under a print of their inputs - the two pictures' bytes, the palette the trace reads them
// through, the relief's own data, and BOOT_CACHE_VERSION (moved whenever the trace's, the relief's mask's or the fit's
// law moves: test/world/smoothland.test.js holds each law's print under it) - and a returning boot takes them:
//   - the trace and its relief: one record a print, its arrays' own checksum checked on load (a record that does not
//     answer to its key, its sizes or its checksum is no record - the boot builds as it always did);
//   - the fit: kept beside the trace, a record a print of the Bay's land as the fit samples it (fitBayToPicture's own
//     masks), so a fit is only ever taken for the very land it was made on;
//   - the roads' regions with land (scenes/tamrielRoadsHost.js, the scan at the roads' start): kept beside the trace under
//     a print of the ground they were scanned on - the fit, the Bay's own bytes, GROUND_ROLL_VERSION and BIOMES_VERSION
//     (moved whenever a law of the ground past the Bay moves - test/world/audittesa2r_roads.test.js R6) - and the lattice.
// No IndexedDB, a blocked one, a store that fails: the boot builds as it always did, and keeps nothing.
// ═══════════════════════════════════════════════════════════════════
import { idbStore } from '../roadsCache.js';

/** Moved whenever the trace's law (ui/tamrielTrace.js traceTamrielPicture), the relief's mask (tamrielRelief.js
 *  maskRelief) or the fit's (tamrielLand.js fitBayToPicture) moves - every kept continent is then built again. */
export const BOOT_CACHE_VERSION = 2; // 2: NIBEN-SEA - the trace opens the Niben's mouth (ui/tamrielTrace.js openNiben)
const DB = 'dfo-tamriel-boot',
  STORE = 'continent';

/** FNV-1a over bytes (or a string's char codes), from `h`. @param {ArrayLike<number>|string} data @param {number} [h] */
export function fnv32(data, h = 0x811c9dc5) {
  const str = typeof data === 'string';
  for (let i = 0; i < data.length; i++) {
    h ^= str ? /** @type {string} */ (data).charCodeAt(i) & 0xff : /** @type {ArrayLike<number>} */ (data)[i] & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The store, or null where there is no IndexedDB. @param {any} [indexedDBRef] */
export const bootStore = (indexedDBRef = globalThis.indexedDB) => idbStore(indexedDBRef, { db: DB, store: STORE });

/** A trace's key: its inputs' print. @param {{ picture: ArrayLike<number>, picker: ArrayLike<number>, palette: ArrayLike<number>, relief: string|null }} inputs */
export function traceKey({ picture, picker, palette, relief }) {
  return `tamriel-boot:v${BOOT_CACHE_VERSION}:${fnv32(picture).toString(36)}:${fnv32(picker).toString(36)}:${fnv32(palette).toString(36)}:${relief === null ? 'none' : fnv32(relief).toString(36)}`;
}

/** A trace's arrays' own checksum. @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array, relief?: Uint8Array|null }} t */
const sumOf = (t) => fnv32(t.relief ?? [], fnv32(t.province, fnv32(t.land, (t.w * 65536 + t.h) >>> 0)));

/** The kept trace for `key`, or null - a record that does not answer to its key, its sizes or its checksum is none.
 *  @param {any} store @param {string} key */
export async function keptTrace(store, key) {
  const v = store ? await store.get(key).catch(() => null) : null;
  if (!v || v.key !== key || !(v.land instanceof Uint8Array) || !(v.province instanceof Uint8Array)) return null;
  if (v.w * v.h !== v.land.length || v.land.length !== v.province.length) return null;
  if (v.relief !== null && (!(v.relief instanceof Uint8Array) || v.relief.length !== v.land.length * 4)) return null;
  if (sumOf(v) !== v.sum) return null;
  return { w: v.w, h: v.h, land: v.land, province: v.province, relief: v.relief };
}

/** Keep a trace under `key` (its relief with it). @param {any} store @param {string} key @param {{ w: number, h: number, land: Uint8Array, province: Uint8Array, relief?: Uint8Array|null }} t */
export async function keepTrace(store, key, t) {
  if (!store) return null;
  const v = { key, w: t.w, h: t.h, land: t.land, province: t.province, relief: t.relief ?? null };
  return store.set(key, { ...v, sum: sumOf(v) }).catch(() => null);
}

/** The fits kept for a trace's key (the Bay's land's print -> the fit), loaded with the trace so the fit, which is
 *  asked synchronously, finds them. @type {Map<string, Map<string, any>>} */
const _fits = new Map();
/** Load the fits kept for `key` into memory. @param {any} store @param {string} key */
export async function loadFits(store, key) {
  const v = store ? await store.get(`${key}:fits`).catch(() => null) : null;
  const m = new Map();
  if (v && v.key === key && Array.isArray(v.fits))
    for (const [land, fit] of v.fits) if (typeof land === 'string' && fit && typeof fit === 'object') m.set(land, fit);
  _fits.set(key, m);
  _store = store;
  _traceKey = key;
  const l = store ? await store.get(`${key}:lands`).catch(() => null) : null;
  _lands =
    l && l.key === key && typeof l.ground === 'string' && Array.isArray(l.lands)
      ? { ground: l.ground, set: new Set(l.lands) }
      : null;
  return m;
}
let _store = /** @type {any} */ (null);
let _traceKey = /** @type {string|null} */ (null);
let _lands = /** @type {{ ground: string, set: Set<string> }|null} */ (null);
/**
 * AUDIT RELEASE R4-4: THE ROADS' REGIONS WITH LAND, KEPT - the predicate the roads' start hands regionsByNearness: the
 * kept answer where this boot's trace was kept and the ground's print (`ground`, with the lattice) is the one it was
 * scanned on; else `scan` itself, region by region in the lattice's order, its answers kept when the last is asked.
 * @param {{ lattice: { x0: number, y0: number, cols: number, rows: number }, scan: (r: { i: number, j: number }) => boolean, ground: string }} o
 * @returns {(r: { i: number, j: number }) => boolean}
 */
export function keptLandRegions({ lattice, scan, ground }) {
  const print = `${ground}|${lattice.x0},${lattice.y0},${lattice.cols},${lattice.rows}`;
  const kept = _traceKey && _lands?.ground === print ? _lands.set : null;
  if (kept) return (r) => kept.has(`${r.i},${r.j}`);
  const found = new Set(),
    total = lattice.cols * lattice.rows,
    key = _traceKey;
  let asked = 0;
  return (r) => {
    const has = scan(r);
    if (has) found.add(`${r.i},${r.j}`);
    if (++asked === total && key && key === _traceKey) {
      _lands = { ground: print, set: found };
      _store?.set(`${key}:lands`, { key, ground: print, lands: [...found] }).catch(() => null);
    }
    return has;
  };
}
/** The fit kept for a trace's key and the Bay's land's print, or null. @param {string|undefined} key @param {string} land */
export const keptFit = (key, land) => (key ? (_fits.get(key)?.get(land) ?? null) : null);
/** Keep a fit (in memory now, in the store when it answers). @param {string|undefined} key @param {string} land @param {any} fit */
export function keepFit(key, land, fit) {
  if (!key || !fit) return;
  const m = _fits.get(key) ?? new Map();
  m.set(land, fit);
  _fits.set(key, m);
  _store?.set(`${key}:fits`, { key, fits: [...m] }).catch(() => null);
}
