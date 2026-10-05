// DFMOD1 - ANY DAGGERFALL UNITY TEXTURE MOD, ATTACHED BY THE PLAYER.
//
// Until this door every `.dfmod` the port read had a module of its own
// (Seasons of the Iliac Bay, Weapon Widget, Diverse Weapons), because
// each came with a script whose law lives in the port. A pure texture
// mod - DREAM 90s's eight bundles, and the hundreds like it - carries no
// law at all: it is DFU's asset-injection folder packed into a UnityFS
// bundle, the same `003_5-0` / `235_56-0_Aquamarine` / `FACES.CIF_14-0`
// / `SCBG04I0.IMG` names a loose pack uses, plus the `.xml` sidecars
// (`<scaleX>` for a billboard, `<rect>` for a paperdoll sprite). So one
// door serves them all:
//
//   - archive-named textures go on the texture door's BUNDLE tier
//     (systems/textureReplacement.js setBundleTextures) - world flats,
//     walls, mobs, NPCs, item icons and paperdoll items by dye, with the
//     `_Mask` map beside them; the other maps (Normal, Height, Emission,
//     ...) have no reader in the port and are not registered;
//   - billboard xml scales go on world/billboardXml.js's registry;
//   - IMG and CIF/RCI names (paperdoll backgrounds, bodies, heads, talk
//     portraits) answer `dfmodImgImage` / `dfmodCifRciImage` for the
//     screens that draw them.
//
// THE INDEX IS STORED, THE BUNDLE IS OPENED LATE. Opening a bundle is
// seconds of LZ4 (DREAM's textures are 383 MB), so at attach time the
// bundle is opened once, its names written beside it as a small JSON
// (`dfmod-index/<file>`), and closed. A boot registers from the JSON
// alone; a bundle is opened - in a worker, formats/unityBundleClient.js
// - the first time one of its pictures is asked for. The paperdoll's
// 330 MB is never opened by a player who never looks at the doll.
//
// VE1 - DFU'S LOAD ORDER. Where two attached mods carry the same name,
// DFU's ModManager answers with the one loaded LAST: TryGetAsset walks
// EnumerateEnabledModsReverse (ModManager.cs:404-415, :1146-1153), and
// AutoSortMods (:1059-1082) loads every mod after the mods it depends on
// (TopologicalSort, :1261-1288). An add-on built on a base mod - Vanilla
// Enhanced's Masked Roads and Snowless Swamps on its Base - wins every
// name the two share. This door used to keep the FIRST mod by file name
// and read no dependency at all, so the add-ons lost to their own base.
//
// VE4 - MODS THAT SHIP WITH THE PORT. Vanilla Enhanced's Base, Masked Roads and Snowless Swamps and Jungles ship with
// the port (systems/vanillaEnhancedPack.js, Mac 2026-10-05) and register HERE, beside the attached mods - one load
// order, one walk, one set of doors; only where a picture comes from differs. An attached .dfmod under the same key
// shadows the shipped one (the player's copy - a newer version - is the one read).
//
// Nothing here touches the DOM: the store and the opener are handed in.

import { openUnityBundle } from '../formats/unityBundleClient.js';
import { createBundlePool } from '../formats/unityBundlePool.js';   // DFMOD3: a few shared workers, not one per mod
import { resampleRgba } from '../formats/resample.js';
import { textureEntry, textureKey, setBundleTextures, textureReplacementEnabled, looseTextureExists, looseTextureBytes, looseTextureGeneration, decodePng, PRELOAD_CONCURRENCY } from './textureReplacement.js';
import { toColor32 } from '../formats/color32Order.js';   // GROUND1: the terrain's layers are world texels, bottom row first
import { registerBillboardXml, unregisterBillboardXml } from '../world/billboardXml.js';
import { getPref, setPref } from './uiPrefs.js';   // VE3: which attached mods are switched off - the port's prefs shelf

export const DFMOD_PREFIX = 'dfmod/';               // the stored key of a bundle (seasonsIliacBayAssets' DFMOD_KEY_PREFIX)
export const DFMOD_INDEX_PREFIX = 'dfmod-index/';   // the stored key of its name index
export const DFMOD_INDEX_VERSION = 3;   // GROUND1: 2 carries the texture arrays; VE1: 3 the manifest's dependencies - an older index is rebuilt in the background

// ---- DFMOD2: BIG MODS (DREAM's full-resolution set, gigabytes a bundle) --------------------------------------------
// A multi-gigabyte bundle read whole into memory was a blank screen: the boot awaited it (a bundle stored without an
// index was indexed there), and the first archive's preload awaited its open. Now:
//   - a bundle is read BY RANGE in its worker from the stored Blob (unityBundleWorker blobSource) - never whole;
//   - the boot registers from stored indexes only; a missing one is built in the background, and lands as a new
//     generation the doll, the icons and the next area pick up;
//   - a picture bigger than the chosen detail is decoded from a smaller MIP (unityBundle mipLevelFor);
//   - no picture ask waits on a bundle's open longer than OPEN_WAIT_MS: that archive draws the classic art this
//     time rather than the game standing on a blank screen.
/** The texture-detail choices, in pixels on the longer side (0 = the mod's full resolution). */
export const DFMOD_DETAIL = Object.freeze([256, 512, 1024, 0]);
// 256 by default: a DREAM HD monster is hundreds of frames, and every decoded frame stays in memory as the picture
// the renderer uploads - at 512 a dungeon's worth ran the tab out of memory (a player's log, 2026-09-27)
export const DFMOD_DETAIL_DEFAULT = 256;
let _detail = () => DFMOD_DETAIL_DEFAULT;
/** The host's detail setting (a getter, read at every decode). */
export function setDfmodDetailSource(fn) { _detail = typeof fn === 'function' ? fn : () => DFMOD_DETAIL_DEFAULT; }
/** The longest side a decode keeps: the setting, the default when it is unset, Infinity for 0 (full). */
export const dfmodMaxSize = () => {
  const v = _detail();
  const d = v == null || v === '' || !Number.isFinite(Number(v)) ? DFMOD_DETAIL_DEFAULT : Number(v);
  return d > 0 ? d : Infinity;
};
const maxSize = dfmodMaxSize;
export const OPEN_WAIT_MS = 20000;
/** DFMOD3: how long a picture ask may wait in the pool's queue before it is dropped (the classic art draws). */
export const ASK_DEADLINE_MS = 15000;
let _pool = null;
/** The default opener: the shared pool when there are workers (a browser), else this thread (node, a test). */
const poolOpen = (src, opts) => {
  if (typeof Worker === 'undefined') return openUnityBundle(src, opts);
  _pool ??= createBundlePool({ size: 2 });
  return _pool.open(src, opts);
};

/** The stored key for a picked `.dfmod` - lower-cased basename, the shape the other doors already read. */
export const dfmodStoreKey = (fileName) => {
  const base = String(fileName ?? '').replace(/\\/g, '/').split('/').pop();
  return /\.dfmod$/i.test(base) ? DFMOD_PREFIX + base.toLowerCase() : null;
};
export const dfmodIndexKey = (storeKey) => DFMOD_INDEX_PREFIX + String(storeKey).slice(DFMOD_PREFIX.length);

/** Mods with a door of their own (a script the port carries) - read there, not here. */
export const hasOwnDoor = (storeKey) => /season|weapon.?widget/i.test(String(storeKey)) || isOriginalDiverseWeapons(storeKey);
/** DWHD1: RealAKP's Diverse Weapons bundle has a door of its own; the HD REPLACERS for it (DeBlue's "Diverse Weapons HD
 *  - Handhelds I/II", "- Inventory") are plain texture mods under the same words, and were refused by both doors - the
 *  generic one skipped them by name, the Diverse Weapons one by GUID. An HD name comes here. */
export const isOriginalDiverseWeapons = (storeKey) => /diverse.?weapons/i.test(String(storeKey)) && !/\bhd\b/i.test(String(storeKey));
/** A handheld weapon frame is drawn large; it keeps at least this much of its detail whatever the texture detail. */
export const WEAPON_FRAME_MIN_SIZE = 512;

/** The maps a port reader asks for. */
const USED_MAPS = new Set(['Albedo', 'Mask']);
/** Archives whose records are drawn one at a time by the icon and paperdoll doors (and are thousands, per dye):
 *  never decoded by an archive preload. */
const isItemArchive = (a) => a >= 233 && a <= 252;

/** XMLManager.GetRect: x, y, width, height over the rect's `scale`. */
export function xmlRect(text) {
  const m = /<rect\s+scale="([\d.]+)"\s*>[\s\S]*?<x>(-?[\d.]+)<\/x>\s*<y>(-?[\d.]+)<\/y>\s*<width>(-?[\d.]+)<\/width>\s*<height>(-?[\d.]+)<\/height>/.exec(text);
  if (!m) return null;
  const s = Number(m[1]) || 1;
  return { x: Number(m[2]) / s, y: Number(m[3]) / s, width: Number(m[4]) / s, height: Number(m[5]) / s };
}
/** SetBillboardScale's `<scaleX>`/`<scaleY>`, or null. */
export function xmlScale(text) {
  const x = /<scaleX>\s*(-?[\d.]+)\s*<\/scaleX>/.exec(text);
  const y = /<scaleY>\s*(-?[\d.]+)\s*<\/scaleY>/.exec(text);
  if (!x && !y) return null;
  return [x ? Number(x[1]) : 1, y ? Number(y[1]) : 1];
}

/** The manifest (the `<title>.dfmod` text asset), or null. */
function manifestOf(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try { return JSON.parse(t.text); } catch { /* not this one */ }
  }
  return null;
}

/** The name index of an opened bundle - what is stored beside it. */
export function buildDfmodIndex(bundle) {
  const manifest = manifestOf(bundle) ?? {};
  const xml = {};
  for (const t of bundle.textAssets ?? []) {
    if (/\.dfmod$/i.test(t.name)) continue;
    let text;
    try { text = t.text; } catch { continue; }
    if (/<info>/i.test(text) && (/<scale[XY]>/i.test(text) || /<rect/i.test(text))) xml[t.name] = text;
  }
  return {
    v: DFMOD_INDEX_VERSION,
    title: manifest.ModTitle ?? null, version: manifest.ModVersion ?? null, author: manifest.ModAuthor ?? null, guid: manifest.GUID ?? null,
    deps: manifestDeps(manifest),   // VE1
    textures: (bundle.textures ?? []).map((t) => [t.name, t.width, t.height]),
    arrays: (bundle.arrays ?? []).map((a) => [a.name, a.width, a.height, a.depth]),   // GROUND1
    xml,
  };
}

/** VE1: ModInfo.Dependencies (ModTypes.cs ModDependency :118-145) as `[name, isOptional, isPeer]` - the three fields the
 *  load order reads (the minimum Version is the mod window's warning, never the order's). */
export function manifestDeps(manifest) {
  const deps = Array.isArray(manifest?.Dependencies) ? manifest.Dependencies : [];
  return deps.filter((d) => typeof d?.Name === 'string' && d.Name).map((d) => [d.Name, d.IsOptional === true, d.IsPeer === true]);
}

// ---- VE1: THE LOAD ORDER -------------------------------------------------------------------------------------------

/** Mod.FileName: the .dfmod's name without the extension (GetModNameFromPath, ModManager.cs:1236-1241) - the store key
 *  without its prefix and suffix. It is what a dependency names. DFU matches it Ordinal; the store keeps every key lower
 *  case (dfmodStoreKey), so the port matches lower case on both sides (a mod builder writes them lower case). */
export const dfmodFileName = (key) => String(key ?? '').slice(DFMOD_PREFIX.length).replace(/\.dfmod$/i, '');

/**
 * AutoSortMods (ModManager.cs:1059-1082): the attached mods in their base order - the Mods folder's listing, by file
 * name - each placed after every attached mod it depends on, optional or not, unless the dependency is a PEER
 * (`where !dependency.IsPeer`, then `GetModFromName` and the missing dropped). TopologicalSort (:1261-1288) is a
 * depth-first visit in the base order, dependencies first; a cycle throws there and AutoSortMods keeps the order it had,
 * so a cycle here answers the base order. Pure: `mods` is `[{ key, index }]`.
 */
export function dfmodLoadOrder(mods) {
  const base = [...(mods ?? [])].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const byName = new Map(base.map((m) => [dfmodFileName(m.key), m]));
  const depsOf = (m) => (m.index?.deps ?? []).filter(([, , peer]) => !peer).map(([name]) => byName.get(String(name).toLowerCase())).filter(Boolean);
  const sorted = [];
  const visited = new Set();
  const visit = (m) => {
    if (!visited.has(m)) {
      visited.add(m);
      for (const d of depsOf(m)) visit(d);
      sorted.push(m);
    } else if (!sorted.includes(m)) throw new Error('Cyclic dependency found');
  };
  try {
    for (const m of base) visit(m);
    return sorted;
  } catch (e) {
    console.warn(`[dfmod] the attached mods could not be sorted by their dependencies (${e?.message ?? e}) - they load by file name`);
    return base;
  }
}

// ---- VE3: A MOD SWITCHED OFF (Mod.Enabled) ---------------------------------------------------------------------------
// DFU's mod window switches a mod off without removing it, and a mod switched off contributes nothing - TryGetAsset reads
// only EnumerateEnabledModsReverse. The port keeps the keys switched off on its prefs shelf (never in DFU's settings); a
// mod attached is on.
export const DFMOD_OFF_PREF = 'dfmodOff';
const offKeys = () => { const v = getPref(DFMOD_OFF_PREF); return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []; };
// VE4: a SHIPPED mod stands at its own default until the player chooses - AUDIT VE (Mac, 2026-10-05: "Ensure this is on
// by default"): Vanilla Enhanced's Base ships ON, as a mod in DFU's Mods folder is, and its add-ons OFF - so its switch
// is the player's CHOICE either way, `{ key: on }` on its own shelf entry, and a key with no choice reads the mod's
// default (`on` in setShippedDfmods' list).
// AUDIT VE R3/R9: ONE SWITCH A MOD. DFU keeps one Mod.Enabled a Title (ModManager.cs:859-868 restores it by
// GetModIndex(Title)), so a copy the player attaches over a shipped mod - under its file name, or another with its Title
// (R9) - wears the shipped mod's switch: switching the copy off was a key on the attached shelf, and removing the copy
// brought the shipped mod back as it was before (Classic worn over the copy came back as Vanilla Enhanced).
export const DFMOD_SHIPPED_PREF = 'dfmodShipped';
const shippedChoices = () => { const v = getPref(DFMOD_SHIPPED_PREF); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
/** The switch a registered mod wears: a copy over a shipped mod wears the shipped mod's, every other mod its own. */
const switchKeyOf = (key) => _shadowOf.get(key) ?? key;
const shippedOf = (key) => _shipped.find((s) => s.key === key) ?? null;
/** The mod registered under `key` is switched on (Mod.Enabled). */
export const dfmodEnabled = (key) => {
  const k = switchKeyOf(key);
  const shipped = shippedOf(k);
  if (!shipped) return !offKeys().includes(k);
  const choice = shippedChoices()[k];
  return typeof choice === 'boolean' ? choice : shipped.on === true;   // AUDIT VE: the shipped default
};

/** Open a bundle's bytes, index it and close it - the attach step. */
export async function indexDfmodBytes(bytes, { open = openUnityBundle } = {}) {
  const isBlob = typeof Blob !== 'undefined' && bytes instanceof Blob;   // DFMOD2: a picked File is read by range
  const bundle = await open(isBlob || bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  try { return buildDfmodIndex(bundle); } finally { try { bundle.close?.(); } catch { /* gone */ } }
}

// ---- the registry ------------------------------------------------------

let _mods = [];                 // [{ key, index, stamp }] in DFU's load order (VE1: dfmodLoadOrder), every registered mod, off or on
let _prio = [];                 // VE1/VE2: the mods switched on, LAST LOADED FIRST - [{ key, names, arrays }], TryGetAsset's walk
let _open = new Map();          // store key -> Promise<bundle client | null>
let _openErrors = new Map();    // DFMOD2: store key -> why it would not open (the packs card says so)
let _img = new Map();           // 'SCBG04I0.IMG' -> { key, name }
let _cifRci = new Map();        // 'FACES.CIF_14-0' -> { key, name }
let _load = null;
let _loadBlob = null;           // DFMOD2: the stored Blob, for a by-range open
let _opener = poolOpen;
let _generation = 0;
let _reads = 0;           // AUDIT VE R4: the newest registration's ticket - an older one's reads stop where they are
let _sig = null;          // the stored set last registered - AUDIT VE R4: its keys AND each index's content
let _sigParts = new Map();      // AUDIT VE R4: store key -> its index's fingerprint, or 'missing'
let _registered = null;   // Promise-free count it registered
let _warmedGen = -1;      // DFMOD2: the registration whose bundles were last warmed
let _shippedSrc = null;         // VE4: the list setShippedDfmods was handed - the same list again changes nothing
let _shipped = [];              // VE4: [{ key, index, open, on, stamp }], the mods that ship with the port
let _attached = [];             // AUDIT VE R5: the attached mods REGISTERED - [{ key, index, stamp }]; only these shadow
let _unregistered = new Map();  // AUDIT VE R5/R11: store key -> { state: 'indexing' | 'error' | 'nomods', error } - stored, not registered
let _shippedLive = new Set();   // VE4: the shipped keys no attached copy shadows - read from the port's own files
let _shadowOf = new Map();      // AUDIT VE R3/R9: an attached copy's key -> the shipped key it shadows (whose switch it wears)

/** DFU loads one mod a Title (ModManager.cs:590-595: `GetModIndex(mod.Title)`, the second never added). */
const sameMod = (s, m) => s.key === m.key || (!!s.index?.title && s.index.title === m.index?.title);
/** VE4: the shipped mods no attached copy shadows, as `_mods` holds a mod - `_shippedLive` and `_shadowOf` brought up to
 *  date. AUDIT VE R5: only a REGISTERED copy shadows (one still being indexed, or one that will not index, left the
 *  shipped mod unregistered and itself unlisted); R9: by its key or its Title. */
function liveShipped() {
  _shadowOf = new Map();
  for (const m of _attached) { const s = _shipped.find((x) => sameMod(x, m)); if (s) _shadowOf.set(m.key, s.key); }
  const shadowed = new Set(_shadowOf.values());
  _shippedLive = new Set(_shipped.filter((s) => !shadowed.has(s.key)).map((s) => s.key));
  return _shipped.filter((s) => _shippedLive.has(s.key)).map(({ key, index, stamp }) => ({ key, index, stamp: `s:${stamp ?? index.version ?? ''}` }));
}

/** DFMOD2 / AUDIT VE R11: `?nomods` - the page registers no attached mod, wherever the registration comes from (the boot,
 *  a menu, a pick): the way back in when a mod will not load on this machine. The packs card lists them to remove. The
 *  shipped mods are the port's own and register either way. */
const NO_MODS = /[?&]nomods\b/;
export const noModsPage = (search = globalThis.location?.search ?? '') => NO_MODS.test(search);

/** AUDIT VE R4: a stored index's fingerprint - FNV-1a over its text, with its length. */
function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `${text.length}:${h.toString(16)}`;
}

function forgetOpen() {
  for (const p of _open.values()) p.then((b) => b?.close?.()).catch(() => null);
  _open = new Map();
  _openErrors = new Map();
}

/** DFMOD2: the stored index's texture list for a bundle - the open skips its heads with it. */
const knownOf = (key) => _mods.find((m) => m.key === key)?.index?.textures ?? null;

/** One stored bundle, opened once, in a worker when there is one. */
function bundleFor(key) {
  if (!_open.has(key)) {
    const shipped = _shippedLive.has(key) ? _shipped.find((s) => s.key === key) : null;   // VE4
    _open.set(key, (async () => {
      if (shipped) return shipped.open();   // VE4: the port's own files - nothing stored to read
      if (_loadBlob) {   // DFMOD2: by range, in the worker - never the whole file on this thread
        const blob = await _loadBlob(key);
        if (blob?.size) return _opener(blob, { maxTextureSize: maxSize(), knownTextures: knownOf(key) });
      }
      if (!_load) return null;
      const bytes = await _load(key);
      if (!bytes || !bytes.byteLength) return null;
      return _opener(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { maxTextureSize: maxSize(), knownTextures: knownOf(key) });
    })().catch((e) => {
      console.warn(`[dfmod] ${key} would not open:`, e?.message ?? e);
      _openErrors.set(key, openWords(e));
      return null;
    }));
  }
  return _open.get(key);
}

/** A texture of a stored bundle, top-down RGBA `{ width, height, data }` (a decoded PNG's order), or null. */
async function bundleImage(key, name, { floor = 0 } = {}) {
  // DFMOD2: an open still running after OPEN_WAIT_MS answers nothing for THIS ask (the classic art draws); the open
  // goes on, and the next ask finds it done
  let timer;
  const waited = new Promise((res) => { timer = setTimeout(() => res(null), OPEN_WAIT_MS); });
  const b = await Promise.race([bundleFor(key), waited]);
  clearTimeout(timer);
  if (!b) return null;
  try { return await b.rgba(name, { maxSize: Math.max(maxSize(), floor), deadline: Date.now() + ASK_DEADLINE_MS }); } catch (e) { console.warn(`[dfmod] ${name} would not decode:`, e?.message ?? e); return null; }
}

/** A stored index - `{ index, fp, stale }` - or null when there is none to read. AUDIT VE R6: an index of the version
 *  before (2: no dependencies) registers as it is, its order the listing's, and is rebuilt in the background (`stale`) -
 *  VE1's bump refused it, and every attached mod stood unregistered on the first boot after the update until its
 *  rebuild landed, and one that could not be rebuilt vanished with no word. */
async function readIndex(key, load) {
  try {
    const bytes = await load(dfmodIndexKey(key));
    if (!bytes || !bytes.byteLength) return null;
    const text = new TextDecoder().decode(bytes);
    const idx = JSON.parse(text);
    if (idx?.v === DFMOD_INDEX_VERSION) return { index: idx, fp: fingerprint(text), stale: false };
    if (idx?.v === 2) return { index: { ...idx, deps: [] }, fp: fingerprint(text), stale: true };
    return null;
  } catch { return null; }
}
/** Why a stored bundle would not open or index, in the packs card's words. */
const openWords = (e) => (e?.name === 'NotReadableError' || /could not be read/i.test(e?.message ?? '')
  ? 'the browser could not read the stored file - remove it and add it again'
  : /allocation failed|out of memory/i.test(e?.message ?? '') ? 'ran out of memory - lower Texture detail, or attach fewer mods'
    : String(e?.message ?? e));

/**
 * Register every generic `.dfmod` among the texture store's names. `load(key)` answers stored bytes;
 * `saveIndex(key, json)` (optional) writes an index built here for a bundle stored without one (a folder pick).
 * Resolves to how many textures the bundles put on the door. Never throws.
 */
export async function setDfmodSources(fileNames, load, { saveIndex = null, open = null, loadBlob = null, background = true, warm = false } = {}) {
  const stored = (fileNames ?? []).filter((n) => typeof n === 'string' && n.startsWith(DFMOD_PREFIX) && /\.dfmod$/i.test(n) && !hasOwnDoor(n)).sort();
  const noMods = noModsPage();   // AUDIT VE R11: the door's own rule
  const names = noMods ? [] : stored;
  // AUDIT VE R4: what a registration is, is its stored indexes - not only their keys. The signature was the key list,
  // so a mod attached again under its own file name (a newer version) was the "same set": the old index stood, and the
  // bundle opened under it, for the rest of the session. The indexes are read first (a few small JSON files), and a
  // registration that reads the same is the same one.
  const ticket = ++_reads;
  const reads = [];
  for (const key of names) {
    if (typeof load !== 'function') break;
    reads.push([key, await readIndex(key, load)]);
    if (ticket !== _reads) return 0;   // a newer registration overtook this one
  }
  const parts = new Map(reads.map(([key, r]) => [key, r ? r.fp : 'missing']));
  const sig = [...stored.map((k) => `${k}=${noMods ? 'nomods' : parts.get(k) ?? 'missing'}`)].join('\n');
  // IDEMPOTENT: the boot seam registers on every host boot (scenes/shared.js ensureAudio), and closing a bundle a
  // player has already paid seconds to open, for the same set, would pay them again at every door
  // VE3: a registration that put NOTHING on the doors is still a registration - every texture mod switched off (the
  // Classic look) counts 0, and a truthiness test read that as none, registering again at every host's boot
  if (sig === _sig && load === _load && _registered !== null) {
    if (warm) warmOpen(_generation);   // a menu's registration came first, unwarmed (AUDIT VE R2)
    return _registered;
  }
  const gen = ++_generation;
  _load = typeof load === 'function' ? load : null;
  _loadBlob = typeof loadBlob === 'function' ? loadBlob : null;
  if (open) _opener = open;
  // AUDIT VE R7: the opened bundles are let go HERE, where the new registration replaces the old in one step - not
  // before the reads above. A picture asked during them was the old registration's to serve, and its client (the
  // shipped one, under a key a copy now takes) stood cached for the new one; a removed copy's open cached its null.
  forgetOpen();
  _attached = reads.filter(([, r]) => r).map(([key, r]) => ({ key, index: r.index, stamp: `a:${r.fp}` }));
  _unregistered = new Map([
    ...stored.filter(() => noMods).map((k) => [k, { state: 'nomods', error: null }]),
    ...reads.filter(([, r]) => !r).map(([k]) => [k, { state: 'indexing', error: null }]),
  ]);
  _mods = dfmodLoadOrder([..._attached, ...liveShipped()]);   // VE1: AutoSortMods' order, not the listing's; VE4: the shipped among them
  _sig = sig; _sigParts = parts;
  _registered = install();
  // DFMOD2: a bundle stored without its index (a folder pick, an attach that did not finish) is indexed OFF the boot
  // path - the game starts with what is indexed, and the rest lands as a new generation when it is ready. AUDIT VE R6:
  // and one registered from the version before is rebuilt the same way; a rebuild that fails keeps what it had.
  const todo = reads.filter(([, r]) => !r || r.stale).map(([key]) => key);
  const indexMissing = async () => {
    for (const key of todo) {
      let index = null, why = null;
      try {
        const src = (_loadBlob && await _loadBlob(key)) || await _load(key);
        if (src && (src.size || src.byteLength)) index = await indexDfmodBytes(src, { open: _opener === poolOpen ? openUnityBundle : _opener });   // DFMOD3: an index needs the full answer, not the pool's quiet open
        else why = new Error('nothing stored to read');
        if (index && saveIndex) {
          const text = JSON.stringify(index);
          if (await saveIndex(dfmodIndexKey(key), text).then(() => true, () => false) && gen === _generation) {
            _sigParts.set(key, fingerprint(text));   // the next boot reads it back: the same registration
            _sig = stored.map((k) => `${k}=${_sigParts.get(k) ?? 'missing'}`).join('\n');
          }
        }
      } catch (e) { why = e; console.warn(`[dfmod] ${key} could not be indexed:`, e?.message ?? e); }
      if (gen !== _generation) return;
      if (index) {
        const text = JSON.stringify(index);
        _attached = [..._attached.filter((m) => m.key !== key), { key, index, stamp: `a:${fingerprint(text)}` }];
        _unregistered.delete(key);
        _mods = dfmodLoadOrder([..._attached, ...liveShipped()]);   // VE1; AUDIT VE R5: a copy shadows from here
        _registered = install();
      } else if (!_attached.some((m) => m.key === key)) {
        _unregistered.set(key, { state: 'error', error: openWords(why) });   // AUDIT VE R5: said, with a Remove
      }
    }
  };
  if (todo.length) { if (background) indexMissing(); else await indexMissing(); }
  if (warm) warmOpen(gen);
  return _registered;
}

/** DFMOD2: WARM - open the bundles now, one after another, off the boot path, so the first area's pictures find them
 *  open rather than waiting (each open is a worker reading its index by range); VE3: a mod switched off is not. Once
 *  a registration. */
function warmOpen(gen) {
  if (_warmedGen === gen) return;
  _warmedGen = gen;
  (async () => { for (const { key } of _mods) { if (gen !== _generation) return; if (dfmodEnabled(key)) await bundleFor(key); } })();
}

/** Put the registered mods' names on the doors. VE1: TryGetAsset's walk (ModManager.cs:404-415, :429-442) - the mods switched
 *  on, the one loaded LAST first - and the first mod to carry a name keeps it, on every door alike: the textures, the
 *  billboard xml (XMLManager seeks it by name, whichever mod carried the picture), the IMG and CIF/RCI pictures, and
 *  the ground's names (VE2). */
function install() {
  const entries = [];
  const table = {};
  _img = new Map(); _cifRci = new Map(); _prio = [];
  // AUDIT VE R1: the walk this install puts on the doors - each mod switched on, with its content. The same walk again (a
  // switch pressed twice, a registration that reads the same) keeps every picture built from it: the ground's tile
  // sets, the IMG and CIF pictures, the doll's (dfmodGeneration).
  const walk = [];
  for (const { key, index, stamp } of [..._mods].reverse()) {
    if (!dfmodEnabled(key)) continue;   // VE3: EnumerateEnabledModsReverse - a mod switched off answers nothing
    walk.push(`${key}@${stamp ?? ''}`);
    const rects = new Map();
    for (const [name, text] of Object.entries(index.xml ?? {})) {
      const rect = xmlRect(text);
      if (rect) rects.set(name, rect);
      const scale = xmlScale(text);
      const e = scale && textureEntry(`${name}.png`);
      if (e && e.map === 'Albedo' && !e.dye) ((table[e.archive] ??= {})[e.record] ??= scale);
    }
    // GROUND1: a texture array named `<archive>-TexArray` is that terrain archive's whole tile set (DREAM's 302, 402...)
    const arrays = new Map();
    for (const [name, , , depth] of index.arrays ?? []) {
      const m = /^(\d+)-TexArray$/i.exec(name);
      if (m && !arrays.has(Number(m[1]))) arrays.set(Number(m[1]), { name, depth });
    }
    const names = new Map();   // VE2: an undyed albedo picture's key -> its name in this bundle (a ground record's)
    for (const [name] of index.textures ?? []) {
      const e = textureEntry(`${name}.png`);
      if (e) {
        if (!USED_MAPS.has(e.map)) continue;
        if (e.map === 'Albedo' && !e.dye && !names.has(textureKey(e.archive, e.record, e.frame))) names.set(textureKey(e.archive, e.record, e.frame), name);
        entries.push({
          archive: e.archive, record: e.record, frame: e.frame, map: e.map, dye: e.dye, fileName: `${key}:${name}`,
          src: `${key}@${stamp ?? ''}:${name}`,   // AUDIT VE R1: the mod, its content and the name - a decode is kept while this answers
          image: () => bundleImage(key, name), lazy: isItemArchive(e.archive), rect: rects.get(name) ?? null,
        });
        continue;
      }
      const up = name.toUpperCase();
      if (/\.IMG$/.test(up)) { if (!_img.has(up)) _img.set(up, { key, name }); continue; }
      if (/\.(CIF|RCI)_\d+-\d+(_[A-Z]+)?$/.test(up) && !_cifRci.has(up)) _cifRci.set(up, { key, name });   // DFMOD2: with a metal suffix too (a handheld weapon's frames)
    }
    _prio.push({ key, names, arrays });
  }
  const n = setBundleTextures(entries);
  if (Object.keys(table).length) registerBillboardXml('dfmod', table); else unregisterBillboardXml('dfmod');
  // AUDIT VE R13: the doll's own art - a backdrop or body (IMG), a head (CIF/RCI), an item's picture (233-252)
  _dollArt = _img.size > 0 || _cifRci.size > 0 || entries.some((e) => isItemArchive(e.archive));
  const sig = walk.join('|');
  if (sig !== _walkSig) {   // AUDIT VE R1
    _walkSig = sig;
    _groundCache = new Map();
    _imgCache = new Map();
    _installGen++;
  }
  return n + _img.size + _cifRci.size;
}
let _walkSig = null;   // AUDIT VE R1: the walk last put on the doors
let _dollArt = false;  // AUDIT VE R13
/** AUDIT VE R13: a mod switched on carries the paper doll's own art - what makes its 4x compose worth its cost. It was
 *  "any attached mod", so the lighting mod, a mod switched off and a copy of Vanilla Enhanced (none of them carries any)
 *  composed the classic doll at four times for nothing. */
export const dfmodCarriesDollArt = () => _dollArt;

/**
 * VE4: register the mods that ship with the port - `[{ key, index, open, on }]`: `index` in buildDfmodIndex's shape,
 * `open()` answering a client in unityBundleClient's (`rgba`, `layers`, `close`) that serves the port's own files, `on`
 * the mod's default until the player chooses (AUDIT VE). They join the attached mods in one load order; an attached copy
 * under the same key shadows one. The same list again changes nothing; another replaces it. The doors are put back at
 * once. Answers what install() put on them.
 */
export function setShippedDfmods(list) {
  if (list === _shippedSrc) return _registered;
  _shippedSrc = list;
  for (const key of _shippedLive) { const p = _open.get(key); if (p) { _open.delete(key); p.then((b) => b?.close?.()).catch(() => null); } }
  _shipped = (list ?? []).filter((s) => typeof s?.key === 'string' && s.key.startsWith(DFMOD_PREFIX) && s.index && typeof s.open === 'function');
  _mods = dfmodLoadOrder([..._attached, ...liveShipped()]);
  _registered = install();
  return _registered;
}

/** Forget every attached mod's registration. VE4: the shipped mods stay - they are not the store's. */
export function clearDfmodSources() {
  _generation++; _reads++;   // AUDIT VE R4: a registration still reading stops too
  _load = null; _sig = null; _sigParts = new Map(); _registered = null; _attached = []; _unregistered = new Map();
  forgetOpen();
  _mods = dfmodLoadOrder(liveShipped());
  install();
}

/**
 * VE3: switch registered mods on or off (Mod.Enabled) and put the doors back at once. The choice is kept on the prefs
 * shelf - an attached mod's as a key switched off, a shipped one's (VE4, AUDIT VE) as the player's choice either way; a
 * mod switched off has its bundle closed (DFU unloads it). Answers the shelf's word - a refused write still holds for
 * this session. What is already drawn keeps its pictures until its area loads again.
 */
export function setDfmodEnabled(keys, on) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter((k) => typeof k === 'string');
  const off = new Set(offKeys());
  const choices = { ...shippedChoices() };   // VE4 / AUDIT VE: a shipped mod's switch is the player's choice, either way
  let attached = false, shipped = false;
  for (const key of list) {
    const k = switchKeyOf(key);   // AUDIT VE R3/R9: a copy over a shipped mod switches the shipped mod's switch
    if (shippedOf(k)) { shipped = true; choices[k] = !!on; }
    else { attached = true; if (on) off.delete(k); else off.add(k); }
  }
  let saved = true;
  if (attached) saved = setPref(DFMOD_OFF_PREF, [...off].sort()) && saved;
  if (shipped) saved = setPref(DFMOD_SHIPPED_PREF, choices) && saved;
  if (!on) {
    for (const k of list) {
      const p = _open.get(k);
      if (!p) continue;
      _open.delete(k);
      p.then((b) => b?.close?.()).catch(() => null);
    }
  }
  _registered = install();
  return saved;
}
/** VE3: a mod attached again, or removed, is no longer remembered as switched off - a fresh attach is on. */
export function forgetDfmodOff(keys) {
  const drop = new Set((Array.isArray(keys) ? keys : [keys]).filter((k) => typeof k === 'string'));
  const off = offKeys();
  if (off.some((k) => drop.has(k))) setPref(DFMOD_OFF_PREF, off.filter((k) => !drop.has(k)));
}
/** VE3: a mod attached is on, whatever an earlier copy of it was - AUDIT VE R3/R9: a copy over a shipped mod (its key, or
 *  its Title in `index`) wears the shipped mod's switch, so that switch goes on with it. */
export function noteDfmodAttached(key, index = null) {
  forgetDfmodOff(key);
  const s = _shipped.find((x) => sameMod(x, { key, index }));
  if (s && shippedChoices()[s.key] !== true) setPref(DFMOD_SHIPPED_PREF, { ...shippedChoices(), [s.key]: true });
}

/** The registered mods, for the menu, in load order (VE1): [{ key, fileName, title, version, author, textures, arrays,
 *  deps, enabled, error, guid, shipped }] - the attached, and (VE4) the shipped no attached copy shadows. */
export const attachedDfmods = () => _mods.map(({ key, index }) => ({
  key, fileName: dfmodFileName(key),   // VE1: the name a dependency names
  title: index.title ?? key.slice(DFMOD_PREFIX.length), version: index.version, author: index.author, textures: index.textures?.length ?? 0,
  arrays: index.arrays?.length ?? 0,   // VE3: a mod of ground tile sets alone is a texture mod too
  deps: (index.deps ?? []).map(([name]) => String(name).toLowerCase()),   // VE1
  enabled: dfmodEnabled(key),   // VE3
  error: _openErrors.get(key) ?? null,   // DFMOD2
  guid: index.guid ?? null,   // IIL1: a script mod (Improved Interior Lighting) is known by its GUID
  shipped: _shippedLive.has(key),   // VE4: ships with the port - switched, never removed
}));
/** AUDIT VE R5/R11: the stored mods NOT registered, for the packs card to list with their state and a Remove -
 *  [{ key, fileName, state, error }]: 'indexing' (its index is being built), 'error' (it will not index: `error` says
 *  why), 'nomods' (the page was opened with ?nomods). A stored mod that never registered was listed nowhere, so a mod
 *  that would not read could not be removed. */
export const unregisteredDfmods = () => [..._unregistered].map(([key, u]) => ({ key, fileName: dfmodFileName(key), state: u.state, error: u.error ?? null }));

// ---- IMG and CIF/RCI pictures --------------------------------------------

let _imgCache = new Map();   // name -> Promise<img | null>
let _installGen = 0;
/** Bumps whenever the attached set changes - a cache of pictures built from it (the paperdoll's art) keys on it. */
export const dfmodGeneration = () => _installGen;
const cached = (id, hit, opts) => {
  if (!hit) return Promise.resolve(null);
  if (!_imgCache.has(id)) _imgCache.set(id, bundleImage(hit.key, hit.name, opts));
  return _imgCache.get(id);
};
export const hasDfmodImg = (name) => _img.has(String(name).toUpperCase());
export const hasDfmodCifRci = (file, record, frame = 0) => _cifRci.has(`${String(file).toUpperCase()}_${record}-${frame}`);
/** An attached mod's picture of a whole IMG (`SCBG04I0.IMG`), top-down RGBA, or null. */
export const dfmodImgImage = (name) => cached(`img:${String(name).toUpperCase()}`, _img.get(String(name).toUpperCase()));
/** An attached mod's picture of one CIF/RCI record (`FACES.CIF`, 14, 0), top-down RGBA, or null. */
export const dfmodCifRciImage = (file, record, frame = 0) => {
  const k = `${String(file).toUpperCase()}_${record}-${frame}`;
  return cached(`cif:${k}`, _cifRci.get(k));
};

/** DFMOD2: an attached mod's CIF/RCI picture by its whole TryImportCifRci name (`WEAPON03.CIF_0-4_Iron`) - the
 *  first-person weapon's ask - top-down RGBA, or null. */
export const dfmodCifRciNamed = (name) => {
  const k = String(name).toUpperCase();
  return cached(`cif:${k}`, _cifRci.get(k), { floor: WEAPON_FRAME_MIN_SIZE });   // DWHD1: a weapon frame keeps its detail
};

// ---- GROUND1 + VE2: THE TERRAIN'S TILE SET ---------------------------------------------------------------------------
// The ground is not drawn through the texture door: the world hosts upload each ground archive's 56 records as one
// texture array (renderer.uploadTileArray), straight off the classic file. DFU dresses it in TextureReader's
// GetTerrainTextureArray (TextureReader.cs:757-803), and the hosts ask here first. Its law, in order:
//   1. TryImportTextureArray (TextureReplacement.cs:325-352): unless a LOOSE `<archive>_0-0` exists, the mods are asked
//      for two names at once in load order - `<archive>-TexArray`, then `<archive>_0-0` - and the FIRST mod carrying
//      either decides. Its array, at the archive's depth, is the tile set whole.
//   2. Otherwise the set is made of the archive's own records, each sought loose-then-mods by TryImportTexture
//      (TryMakeTextureArrayCopyTexture :1085-1149, and GetTerrainTextureArray's own loop :776-795, which also takes the
//      records when no record 0 is replaced): the set is record 0's size, else the classic size.
// GROUND1 read only the arrays - an archive a loose pack or an array-less mod dressed record by record (Kokey's
// Temperate: TEXTURE.302's 56 pictures, no array) stood classic - and took the FIRST mod by file name.
let _groundCache = new Map();   // `${archive}:${depth}:${loose generation}` -> Promise<layers | null>, least recently asked first
/** AUDIT VE P2: how many tile sets the ground cache keeps. A set stands on the GPU once uploaded (renderer.tileArrays); this
 *  copy only spares a re-decode when PLACE-LRU lets the array go and the player comes back - and it was kept for every
 *  archive the session ever drew, 14.7 MB a set at Vanilla Enhanced's 256 pixels (eleven sets, 162 MB). Three cover a
 *  junction of climates; an older set is decoded again if it is ever asked for (off the main thread, AUDIT VE P1). */
export const GROUND_CACHE_SETS = 3;

/** VE2: what dresses a ground archive - `{ kind: 'array', key, name, depth }` (a mod's array decided first),
 *  `{ kind: 'records' }` (a loose record 0, or a mod whose first name is the record), or null: no loose record 0 and no
 *  mod switched on carries either name. Behind the gate. */
export function groundSource(archive) {
  if (!textureReplacementEnabled()) return null;
  const a = Number(archive);
  if (looseTextureExists(a, 0, 0)) return { kind: 'records' };
  for (const m of _prio) {
    const arr = m.arrays.get(a);
    if (arr) return { kind: 'array', key: m.key, name: arr.name, depth: arr.depth };
    if (m.names.has(textureKey(a, 0, 0))) return { kind: 'records' };
  }
  return null;
}
/** A mod or a loose pack dresses the archive's ground in some way (its array, or any of its records), behind the gate. */
export const hasDfmodGround = (archive, recordCount = 56) => !!groundSource(archive) || recordOwners(archive, recordCount).some(Boolean);

/** VE2: TryImportTexture(archive, record, 0) for each record: the loose file, else the first mod switched on - in
 *  TryGetAsset's order - that carries the name. Null where neither does. */
function recordOwners(archive, recordCount) {
  if (!textureReplacementEnabled()) return [];
  const a = Number(archive);
  return Array.from({ length: recordCount }, (_, r) => {
    if (looseTextureExists(a, r, 0)) return { loose: true };
    const k = textureKey(a, r, 0);
    const m = _prio.find((p) => p.names.has(k));
    return m ? { key: m.key, name: m.names.get(k) } : null;
  });
}

/** A record's own replacement in getColor32's shape (bottom row first), or null - never throws. A mod's is asked with
 *  no deadline, as the arrays are (the ground waits for it: a tile set is uploaded once), at the texture detail. */
async function recordPicture(archive, record, owner, decode) {
  try {
    if (owner.loose) {
      const bytes = await looseTextureBytes(archive, record, 0);
      return bytes ? toColor32(await decode(bytes)) : null;
    }
    const b = await bundleFor(owner.key);
    const img = b ? await b.rgba(owner.name, { maxSize: maxSize() }) : null;
    return img ? toColor32(img) : null;
  } catch (e) {
    console.warn(`[dfmod] ground record ${archive}_${record}-0 would not decode:`, e?.message ?? e);
    return null;
  }
}

/** The classic record stood in a set of another size, texel for texel (a whole-number scale is the classic tile, each
 *  texel a block). DFU leaves such a slice unset (TryMakeTextureArrayCopyTexture logs it and copies nothing) or throws
 *  (SetPixels32 of another size) - a hole in the ground; the port draws the record Daggerfall has. */
function classicAt(c, w, h) {
  if (c.width === w && c.height === h) return c;
  const out = resampleRgba({ width: c.width, height: c.height, data: c.colors }, w, h);
  return { width: out.width, height: out.height, colors: out.data };
}

/** The classic file's record as the hosts upload it (getColor32 of its bitmap, index 0 clear). */
const classicLayer = (tex, r) => tex.getColor32(tex.getDFBitmap(r, 0), 0);

/**
 * The tile set a texture pack or mod dresses a ground archive with - one layer per record of the archive's classic
 * TEXTURE file (`tex`, a TextureFile: `recordCount`, `getDFBitmap`, `getColor32`), in the upload path's
 * `{ width, height, colors }` shape, bottom row first (getColor32's order) - or null when the classic set stands: the
 * gate is shut, nothing dresses the archive, or nothing would decode. The classic records size the set when no
 * record 0 is replaced and stand for a record nothing replaces. `decode` turns a loose PNG's bytes into a top-down
 * picture (the browser's decodePng).
 */
export function dfmodGroundLayers(archive, tex, { decode = decodePng } = {}) {
  const n = tex?.recordCount ?? 0;
  if (!n || !textureReplacementEnabled()) return Promise.resolve(null);
  const id = `${Number(archive)}:${n}:${looseTextureGeneration()}`;
  const hit = _groundCache.get(id);
  _groundCache.delete(id);   // AUDIT VE P2: re-entered last - the Map's order is the cache's recency
  if (hit) { _groundCache.set(id, hit); return hit; }
  for (const k of _groundCache.keys()) if (k.startsWith(`${Number(archive)}:`)) _groundCache.delete(k);   // a set built off an older loose pick
  // AUDIT VE R12: a set that lost a picture to a failure (a dropped fetch, a decode that threw) is answered, not kept -
  // the next ask builds it again rather than the failure standing for the page
  const answer = groundLayers(Number(archive), tex, decode).then(({ layers, whole }) => {
    if (!whole && _groundCache.get(id) === answer) _groundCache.delete(id);
    return layers;
  });
  _groundCache.set(id, answer);
  while (_groundCache.size > GROUND_CACHE_SETS) _groundCache.delete(_groundCache.keys().next().value);   // AUDIT VE P2: the least recently asked goes
  return _groundCache.get(id);
}

/** The set and whether every picture it asked for came (`whole`) - AUDIT VE R12. */
async function groundLayers(archive, tex, decode) {
  const n = tex.recordCount;
  const src = groundSource(archive);
  if (src?.kind === 'array') {
    // TryImportTextureArray: the array at the archive's depth is the set (`textureArray.depth == depth`); one of
    // another depth is refused there (logged) and the records are sought instead
    if (src.depth === n) {
      const b = await bundleFor(src.key);
      if (b?.layers) {
        try {
          // AUDIT VE R12: a slice that would not load answers null (the shipped pack's are files, one by one) and stands
          // as the classic record, as a record-built set's missing record does - one dropped fetch cost the climate
          const imgs = await b.layers(src.name);
          const first = imgs?.find(Boolean);
          if (imgs?.length === n && first && imgs.every((i) => !i || (i.width === first.width && i.height === first.height))) {
            return { layers: imgs.map((i, r) => (i ? toColor32(i) : classicAt(classicLayer(tex, r), first.width, first.height))), whole: imgs.every(Boolean) };
          }
        } catch (e) { console.warn(`[dfmod] ${src.name} would not decode:`, e?.message ?? e); return { layers: null, whole: false }; }
      }
      return { layers: null, whole: !!b?.layers };   // the array decided and would not draw - the classic set, as when a mod's array fails to load
    }
    console.warn(`[dfmod] ${src.name}: expected depth ${n} but got ${src.depth} - the records are sought instead`);
  }
  const owners = recordOwners(archive, n);
  if (!owners.some(Boolean)) return { layers: null, whole: true };
  // the records decode a few at once, as an archive's preload does (PRELOAD_CONCURRENCY) - 56 PNGs of an HD pack
  // decoded together would hold every one of them at once
  const pics = new Array(n).fill(null);
  let next = 0;
  const lane = async () => { while (next < n) { const r = next++; if (owners[r]) pics[r] = await recordPicture(archive, r, owners[r], decode); } };
  await Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, n) }, lane));
  const whole = owners.every((o, r) => !o || !!pics[r]);   // AUDIT VE R12: every record a tier carries came
  if (!pics.some(Boolean)) return { layers: null, whole };
  const size = pics[0] ?? classicLayer(tex, 0);
  return { layers: pics.map((p, r) => (p && p.width === size.width && p.height === size.height ? p : classicAt(classicLayer(tex, r), size.width, size.height))), whole };
}

export { resampleRgba };   // DFMOD2: its home is formats/resample.js (the worker downscales with it too)

/** Test seam. */
export function _resetDfmodForTests() { _shippedSrc = null; _shipped = []; clearDfmodSources(); _opener = poolOpen; _warmedGen = -1; }
