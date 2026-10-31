// @ts-check
// STUDIO1 (2026-10-17, Mac, of trashBattery on the dev chat - "what Latty is working to build right now, and what I'm
// waiting for, is a centralized location for you and I to put 2d art assets": "We need to build what trash is talking
// about"): THE STUDIO - ONE FOLDER WHERE THE GAME'S ARTISTS PUT THEIR PICTURES, AND THE GAME WEARS THEM.
//
// Until now every picture the game drew was a mod's it was handed, a record of the player's own ARENA2, or one the port
// painted from numbers (the wagons, the ships, the yards - bible/01-Overview/DF-Art.md; the wagons' recoloured for each
// paint). The studio is the fourth: `public/art/studio/<artist>/`, each artist's own drawings, named the way every
// Daggerfall texture pack names its pictures (systems/textureReplacement.js textureName - `38181_1-0.png`), with a label
// for the eye after `--` if the artist likes (`38181_1-0--cart-side.png`). An artist drops a PNG in their folder and it
// is worn: the dev server and the build list the folder themselves (scripts/studioArtIndex.mjs), so there is no list
// to keep and no tool to run.
//
// WHERE IT STANDS. On the texture door's vendor tier - the port's own art - and above every other picture there
// (addVendorTextures, STUDIO1): over the shipped packs and every attached texture mod (the bundle tier), over the
// port's painted ships and hangings, worn with Replace Game Artwork off and on Classic, because it is the game's own
// art, not a pack. A player's own loose texture pack (a folder of pictures, behind Replace Game Artwork) still answers
// first, as it does over every picture of the port's (liveEntry). The ground's tile sets are built apart from this door
// and lay the studio's records in themselves (systems/dfmodTextures.js dfmodGroundLayers). The port's own models that
// upload their pictures themselves (the wagons and the caravan, the yards, the port, the monument) wear them through
// `wearPainted`. A studio picture is worn as drawn: DF-LOOK's grain and palette are for pictures painted from numbers,
// and an artist's picture is already the look they meant.
//
// Not a DFU member: DFU's loose folder (TextureReplacement.TryImportTexture) is the player's; this is the game's own.
// Ledger A (STUDIO1).
import {
  textureEntry, textureKey, addVendorTextures, hasTextureReplacement, decodedTexture, decodedTextureTopDown, preloadTextureRecord, decodePng,
  holdTextureTiers, PRELOAD_CONCURRENCY,
} from '../textureReplacement.js';
import { LAST_CLASSIC_TEXTURE_ARCHIVE } from '../../formats/textureFile.js';
import { DYE_COLORS, dyeToken } from '../../characters/dyes.js';
import { APP_ROOT } from '../appRoot.js';

/** Where the studio is served, under the site's root (`public/art/studio/` in the tree). */
export const STUDIO_DIR = 'art/studio';
/** The folder's listing, written by the dev server and the build (scripts/studioArtIndex.mjs) - never a file in the
 *  tree: `{ studio: 1, files: ["<artist>/<name>.png", ...] }`. */
export const STUDIO_INDEX = 'index.json';
/** What parts a picture's name from its label (`38181_1-0--cart-side.png`): a DFU name never holds it - its record and
 *  frame are digits on either side of ONE dash. */
export const STUDIO_LABEL = '--';
/** A picture's file name: what it replaces, then its label after STUDIO_LABEL if it has one. */
const STUDIO_FILE = new RegExp(`^(.+?)(?:${STUDIO_LABEL}(.+))?\\.png$`, 'i');
/** How long an archive's first load waits for the studio's listing (textureReplacement.js holdTextureTiers), ms: one
 *  small fetch, and past this the world loads without it - its pictures then land as each area loads again. */
export const STUDIO_HOLD_MS = 3000;

/** A dye a picture's name may carry: one the game asks a picture by. GetName prints the dye of an item that is not
 *  Unchanged (characters/dyes.js dyeToken), so `_Iron` is asked and `_Silver`, `_iron` and `_Unchanged` never are. */
export const askedDye = (token) => Object.hasOwn(DYE_COLORS, token) && dyeToken(DYE_COLORS[token]) === token;

/**
 * One picture of the studio's, read off its path under the studio (`trashBattery/wagons/38181_1-0--cart-side.png`), or
 * null when the path names no picture the game can wear: its artist (the path's first folder), what it replaces (the
 * DFU name before any label - textureEntry's, with a dye the game asks by), and its label.
 * @param {string} path
 */
export function studioFile(path) {
  const parts = String(path ?? '').split('/');
  if (parts.length < 2 || parts.some((p) => !p || p === '.' || p === '..')) return null;
  const m = STUDIO_FILE.exec(parts[parts.length - 1]);
  const e = m && textureEntry(`${m[1]}.png`);
  if (!e || (e.dye != null && !askedDye(e.dye))) return null;
  return {
    path, artist: parts[0], label: m[2] ?? null,
    archive: e.archive, record: e.record, frame: e.frame, map: e.map, dye: e.dye,
    key: textureKey(e.archive, e.record, e.frame, e.map, e.dye),
  };
}

/** The pictures a listing names, one a key: the first path in order keeps a key two pictures name (the folder's check -
 *  tools/studioArt.mjs - refuses that before it ships). */
export function studioEntries(files) {
  const byKey = new Map();
  for (const path of [...(Array.isArray(files) ? files : [])].filter((f) => typeof f === 'string').sort()) {
    const e = studioFile(path);
    if (e && !byKey.has(e.key)) byKey.set(e.key, e);
  }
  return [...byKey.values()];
}

/** A studio path's served URL. */
export const studioUrl = (path, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`${STUDIO_DIR}/${String(path).split('/').map(encodeURIComponent).join('/')}`, root).href;

/** @type {Promise<number> | null} */
let _install = null;
/** @type {Promise<void>} */
let _decoded = Promise.resolve();
/** @type {(bytes: Uint8Array) => Promise<any>} */
let _decode = decodePng;
let _generation = 0;
/** @type {ReturnType<typeof studioEntries>} */
let _worn = [];

/**
 * Once: the studio's listing read and every picture in it on the texture door. Answers how many registered, once they
 * are - the boot waits for that alone (scenes/shared.js ensureAudio), and an archive's first load waits for it too, a
 * bounded while (STUDIO_HOLD_MS). The pictures of the port's own archives (past TEXTURE.511) are then decoded a few at a
 * time (PRELOAD_CONCURRENCY), for the doors that paint without an archive load (`wearPainted`, which also takes a
 * picture that lands after it painted). No listing served (a page off a plain static server) is 0, and the game as it
 * was; a listing that would not read is 0 and asked again at the next boot. Never throws: art is never what stops a boot.
 * @param {{ fetch?: (url: string) => Promise<any>, root?: string, decode?: (bytes: Uint8Array) => Promise<any> }} [io]
 */
export function installStudioArt(io = {}) {
  if (_install) return _install;
  const asked = register(io).then((n) => {
    if (n !== null) return n;
    if (_install === asked) _install = null;   // a read that failed is no answer: the next boot asks again
    return 0;
  });
  _install = asked;
  holdTextureTiers(asked, STUDIO_HOLD_MS);
  return asked;
}
/** The registration: its count, or null when the listing would not read (a network that failed). */
async function register({ fetch = (u) => globalThis.fetch(u), root = undefined, decode = decodePng }) {
  let files;
  try {
    const r = await fetch(studioUrl(STUDIO_INDEX, root));
    if (!r?.ok) return 0;
    files = (await r.json())?.files;
  } catch { return null; }
  _worn = studioEntries(files);
  _decode = decode;
  const bytes = async (path) => { const r = await fetch(studioUrl(path, root)); return r?.ok ? new Uint8Array(await r.arrayBuffer()) : null; };
  const n = addVendorTextures(_worn.map((e) => ({
    archive: e.archive, record: e.record, frame: e.frame, map: e.map, dye: e.dye,
    studio: true, fileName: `studio:${e.path}`, load: () => bytes(e.path),
  })));
  if (n) _generation++;
  const own = _worn.filter((e) => e.archive > LAST_CLASSIC_TEXTURE_ARCHIVE);
  let next = 0;
  const lane = async () => { while (next < own.length) { const e = own[next++]; await preloadTextureRecord(e.archive, e.record, e.frame, e.map, e.dye, { decode }); } };
  _decoded = Promise.all(Array.from({ length: Math.min(PRELOAD_CONCURRENCY, own.length) }, lane)).then(() => {});
  return n;
}
/** The install asked, and landed: registered, and the port's own archives' pictures decoded. Answers the count. */
export async function studioLanded() {
  const n = await installStudioArt();
  await _decoded;
  return n;
}
/** The pictures the studio wears, as its listing named them (studioFile's). */
export const studioWorn = () => _worn;
/** Moves each time the studio registers pictures - what a cache of pictures drawn before it keys on (ui/textureCanvas.js). */
export const studioGeneration = () => _generation;
/** Test seam: not installed. */
export function _resetStudioArt() { _install = null; _decoded = Promise.resolve(); _decode = decodePng; _worn = []; _slots.clear(); }

/**
 * THE DOOR OF A PICTURE THE PORT PAINTS ITSELF (STUDIO1): what replaces it - the studio's picture, or a player's own
 * loose pack's - ready for renderer.uploadTexture, or null to wear the painted one (null too while it is not decoded:
 * `wearPainted` waits for it). `topDown` for a host whose pictures go up with row 0 their top (the yards', the port's,
 * the monument's: their faces are laid that way); otherwise the port's color32 order (row 0 the bottom -
 * formats/color32Order.js), which the wagons' go up in.
 * @param {number} archive @param {number} record
 * @param {{ topDown?: boolean }} [how]
 * @returns {{ width: number, height: number, colors: Uint8ClampedArray } | null}
 */
export function paintedReplacement(archive, record, { topDown = false } = {}) {
  if (!hasTextureReplacement(archive, record)) return null;
  if (!topDown) return decodedTexture(archive, record);
  const d = decodedTextureTopDown(archive, record);
  return d ? { width: d.width, height: d.height, colors: d.rgba } : null;
}

/** A put's slot -> the newest wear asked of it: a late picture lands only on the wear still current (ASYNC NEVER DROPS -
 *  the newest ask wins, never a superseded one). */
const _slots = new Map();

/**
 * A painted record WORN: `put(picture, { replaced, late })` is handed the picture it wears now - its replacement
 * (paintedReplacement) or `paint()`. When the replacement is on its way - the studio's listing still read (a host that
 * streams before the boot's install lands: the world's does), or a picture registered and not decoded yet - `put` is
 * handed it again when it lands (`late`: the painted one is up under the key, and the renderer keeps the first picture a
 * key is given, so the host lets it go first). Only the newest wear of a `slot` (by default the record's own key) takes
 * a late picture: a room repainted while one was on its way keeps its new paint.
 * @template P
 * @param {number} archive @param {number} record - the record whose replacement is worn
 * @param {() => P} paint
 * @param {(picture: P | NonNullable<ReturnType<typeof paintedReplacement>>, how: { replaced: boolean, late: boolean }) => void} put
 * @param {{ topDown?: boolean, slot?: string }} [how]
 */
export function wearPainted(archive, record, paint, put, how = {}) {
  const slot = how.slot ?? `${archive}_${record}`;
  const wear = {};
  _slots.set(slot, wear);
  const own = paintedReplacement(archive, record, how);
  if (own) { _slots.delete(slot); put(own, { replaced: true, late: false }); return; }
  put(paint(), { replaced: false, late: false });
  Promise.resolve(_install)
    .then(() => (hasTextureReplacement(archive, record) ? preloadTextureRecord(archive, record, 0, 'Albedo', null, { decode: _decode }) : null))
    .then((got) => {
      if (!got || _slots.get(slot) !== wear) return;
      const late = paintedReplacement(archive, record, how);
      if (late) put(late, { replaced: true, late: true });
    })
    .catch((e) => console.warn(`[studio] ${archive}_${record}: the picture that landed would not go up`, e?.message ?? e))
    .finally(() => { if (_slots.get(slot) === wear) _slots.delete(slot); });
}
