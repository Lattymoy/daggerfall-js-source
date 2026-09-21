// M-TEX: user-supplied TEXTURES, the second domain of DFU's
// asset-injection layer (Utility/AssetInjection/TextureReplacement.cs).
//
// Same shape as systems/musicReplacement.js and deliberately so: index
// by name, check DFU's `Settings.AssetInjection` gate INSIDE the
// lookup, answer bytes or nothing, and let the caller treat nothing as
// "draw the classic texture". A second domain that invented its own
// shape would be a second thing to learn and a second thing to get
// wrong.
//
// THE NAMING IS DFU'S, VERBATIM (TextureReplacement.cs:725-736):
//
//     {archive:000}_{record}-{frame}[_{dye}][_{map}].png
//
// - the archive is ZERO-PADDED TO THREE digits; record and frame are
//   not padded at all, which is why `003_5-0` and not `003_005-000`;
// - the dye suffix appears only when it is not Unchanged;
// - the map suffix appears only when it is not Albedo.
//
// So the plain colour texture of archive 3, record 5, frame 0 is
// `003_5-0.png`, and its normal map is `003_5-0_Normal.png`. Every
// texture pack built for Daggerfall Unity already uses these names -
// which is the whole point, exactly as the `song_` prefix was for
// music.

import { getBool } from './settings.js';
import { toColor32 } from '../formats/color32Order.js';   // ROAD-H H4: the one door a decoded PNG crosses into the port's texel convention

/** TextureReplacement.cs:39-47, in declaration order. Albedo is the
 *  default and carries NO suffix, which is why it leads. */
export const TEXTURE_MAPS = Object.freeze(['Albedo', 'Normal', 'Height', 'Emission', 'MetallicGloss', 'Mask']);

/** DFU seeks `.png` and nothing else here - unlike sound, where the
 *  browser's codec set is the real constraint. A texture is decoded by
 *  the same image path either way, so there is no reason to widen it
 *  and every reason to match the packs. */
export const TEXTURE_EXTENSION = 'png';

/** The same gate as music: DFU asks it in both import paths. */
export const textureReplacementEnabled = () => getBool('Enhancements', 'AssetInjection');

/**
 * GetName (:725-736), verbatim. The `000` pad is on the ARCHIVE only.
 */
export function textureName(archive, record, frame = 0, map = 'Albedo', dye = null) {
  let name = `${String(archive).padStart(3, '0')}_${record}-${frame}`;
  if (dye) name = `${name}_${dye}`;
  if (map && map !== 'Albedo') name = `${name}_${map}`;
  return name;
}

/**
 * Parse a supplied filename back to what it replaces, or null.
 *
 * THE TWO OPTIONAL SUFFIXES ARE BOTH BARE WORDS, so order alone cannot
 * tell a dye from a map. DFU writes the dye FIRST and the map LAST, so
 * the map is identified by BEING a TextureMap name and anything left
 * over in front of it is the dye. A pack that ships a dye literally
 * named "Normal" would be misread, and there is no reading of the
 * format that avoids that - DFU has the same ambiguity.
 */
export function textureEntry(fileName) {
  const name = String(fileName ?? '').trim();
  const base = name.slice(name.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null;
  if (base.slice(dot + 1).toLowerCase() !== TEXTURE_EXTENSION) return null;

  const tokens = base.slice(0, dot).split('_');
  if (tokens.length < 2) return null;
  if (!/^\d+$/.test(tokens[0])) return null;
  const rf = /^(\d+)-(\d+)$/.exec(tokens[1]);
  if (!rf) return null;

  const rest = tokens.slice(2);
  let map = 'Albedo';
  if (rest.length && TEXTURE_MAPS.includes(rest[rest.length - 1]) && rest[rest.length - 1] !== 'Albedo') {
    map = rest.pop();
  }
  // Whatever is still in front of the map is the dye. More than one
  // token means a name this format cannot express, so it is refused
  // rather than guessed at.
  if (rest.length > 1) return null;
  return {
    archive: Number(tokens[0]),
    record: Number(rf[1]),
    frame: Number(rf[2]),
    map,
    dye: rest.length ? rest[0] : null,
    fileName,
  };
}

/** The lookup key a caller asks with. Frame is part of it: an animated
 *  flat replaces frame by frame, which is how DFU's own per-frame
 *  import works. */
export const textureKey = (archive, record, frame = 0, map = 'Albedo') =>
  `${Number(archive)}_${Number(record)}-${Number(frame)}${map && map !== 'Albedo' ? `_${map}` : ''}`;

// ---- the registry, one shape with music ----------------------------

let _index = new Map();
let _load = null;

/** Register a picked set; `load(fileName)` resolves to bytes. */
export function setTextureReplacements(fileNames, load) {
  _index = new Map();
  for (const fileName of fileNames ?? []) {
    const e = textureEntry(fileName);
    if (!e) continue;
    // LAST WINS is wrong here for the same reason it was wrong for
    // music, but textures have no format preference to rank by - one
    // extension only - so a duplicate name IS the same texture twice
    // and keeping the first is stable and enough.
    const key = textureKey(e.archive, e.record, e.frame, e.map);
    if (!_index.has(key)) _index.set(key, e);
  }
  _load = typeof load === 'function' ? load : null;
  return _index.size;
}

export const textureReplacementCount = () => _index.size;

// ---- SURV2: THE PORT'S OWN VENDORED ART ------------------------------
//
// A vendored mod's pictures (Climates & Calories' spoiled-food and
// waterskin icons, archives 532-539) are not a user's pick: they ship
// with the port, they survive a pick replacing the user index above,
// and they are not behind the AssetInjection gate - the port owns them.
// Their archives have no ARENA2 file at all, so the pipeline builds a
// stand-in TextureFile for them (vendorTextureStandIn) and draws the
// decoded PNGs through the same swap arm a replacement uses.
const _vendor = new Map();
/** Register vendored files: [{ archive, record, frame?, load, standIn? }]
 *  where `load()` resolves to the PNG bytes.
 *
 *  `standIn` IS THE WHOLE DIFFERENCE BETWEEN THE TWO KINDS, and it is
 *  declared rather than guessed at (SURV-TENT). A vendored file is
 *  either
 *    - the ONLY thing its archive is (Climates & Calories' item icons
 *      at 532-539: no TEXTURE.532 exists or ever will, so the pipeline
 *      must stand a shell in for the file) - `standIn: true`; or
 *    - ONE RECORD of a real ARENA2 archive, overridden the way a
 *      texture pack overrides one (the same mod's tent reskins at
 *      50_7-0 and 67_10-0, where TEXTURE.050 is a real file carrying
 *      dozens of other records) - `standIn` absent.
 *  Nothing about the archive number tells them apart. */
export function addVendorTextures(entries) {
  let n = 0;
  for (const e of entries ?? []) {
    if (!Number.isFinite(e?.archive) || !Number.isFinite(e?.record) || typeof e.load !== 'function') continue;
    const key = textureKey(e.archive, e.record, e.frame ?? 0, 'Albedo');
    _vendor.set(key, { archive: Number(e.archive), record: Number(e.record), frame: Number(e.frame ?? 0), map: 'Albedo', fileName: e.fileName ?? key, load: e.load, standIn: e.standIn === true, offset: e.offset ?? null });   // FIELD-GUN4: a WORN stand-in needs a place on the doll, which only its registration knows
    n++;
  }
  return n;
}
export const vendorTextureCount = () => _vendor.size;
export function clearVendorTextures() { for (const k of _vendor.keys()) _decoded.delete(k); _vendor.clear(); }
/** An archive that exists ONLY as vendored art (no ARENA2 file), which
 *  is what sends the pipeline down the stand-in branch instead of
 *  fetching TEXTURE.###.
 *
 *  SURV-TENT (2026-09-19): this used to answer true if ANY record of
 *  the archive was vendored, which was harmless only while every
 *  vendored file happened to be of the first kind. Registering one
 *  record of a REAL archive - the tent's 50_7-0 - would have sent
 *  TEXTURE.050 down the stand-in branch too, and every other record in
 *  it (every wall and floor drawn from archive 50) would have come
 *  back as a 1x1 nothing. The archive number cannot tell you; only the
 *  registration can, so it says. */
export const isVendorArchive = (archive) => { for (const e of _vendor.values()) if (e.standIn && e.archive === Number(archive)) return true; return false; };
/** One past the highest RECORD vendored for an archive, off the
 *  REGISTRY and not the decoded map - a PNG that has not been fetched
 *  yet, or would not decode, must not shrink the archive underneath a
 *  caller that is about to ask for its record. */
export function vendorRecordCount(archive) {
  let n = 0;
  for (const e of _vendor.values()) if (e.standIn && e.archive === Number(archive)) n = Math.max(n, e.record + 1);
  return n;
}
/** A TextureFile stand-in for a vendor-only archive: sizes from the
 *  decoded PNGs, a bitmap the swap arm never reads.
 *
 *  SURV-ART (2026-09-19, Mac: "the sprites aren't showing at all") -
 *  IT MUST ANSWER `recordCount` AND `getSize`. Every icon door in the
 *  port gates on `record < tex.recordCount` before it uploads
 *  (ui/itemScroller.js, ui/nativeInventory.js, ui/paperDoll.js, and
 *  the world arms in scenes/) and then measures with `tex.getSize`,
 *  which is the TextureFile surface those lines were written against.
 *  This object carried neither, so the comparison read
 *  `0 < undefined` - FALSE for every record of every vendored archive
 *  - and the upload it guards never ran: no texture, no size, nothing
 *  drawn. The mod's art was registered, fetched and decoded, and then
 *  fell off the last step. A stand-in for a file must answer like the
 *  file. */
/** FIELD-GUN4: a decoded vendor record's pixels with the rows put
 *  back the way the PNG had them. `_decoded` holds `toColor32` of the
 *  file - row 0 the picture's BOTTOM - and a caller compositing into a
 *  top-down buffer needs the reverse. Null in, null out. */
function topDownRgba(decoded) {
  if (!decoded?.colors) return null;
  const { width, height, colors } = decoded;
  const row = width * 4;
  const out = new Uint8ClampedArray(colors.length);
  for (let y = 0; y < height; y++) out.set(colors.subarray(y * row, (y + 1) * row), (height - 1 - y) * row);
  return out;
}

export function vendorTextureStandIn(archive) {
  const recordCount = vendorRecordCount(archive);
  const size = (record) => { const d = _decoded.get(textureKey(archive, record, 0)); return d ? { width: d.width, height: d.height } : { width: 1, height: 1 }; };
  return {
    vendor: true,
    recordCount,
    getSize: (record) => (record >= 0 && record < recordCount ? size(record) : { width: 0, height: 0 }),   // TextureFile.getSize's own out-of-range answer
    getScale: () => ({ x: 0, y: 0 }),
    // FIELD-GUN4: a classic record carries its own paper-doll offset
    // and this one has nowhere else to get one, so the registration
    // supplies it. Zero stays the answer for art that is never worn -
    // every icon door measures from its own rect and never asks.
    getOffset: (record) => _vendor.get(textureKey(archive, record ?? 0, 0))?.offset ?? { x: 0, y: 0 },
    getFrameCount: () => 1,
    getWidth: (record) => size(record).width,
    getHeight: (record) => size(record).height,
    // FIELD-GUN4 (Mac, from play: "The paperdoll doesn't equip the
    // texture"). This used to answer `data: null` under the comment
    // "a bitmap the swap arm never reads" - true of every door that
    // existed when SURV-ART wrote it, because the mod's art is never
    // WORN. The paper doll is the one door that reads the bitmap
    // itself: composeDoll blits palette INDICES through the doll's
    // own palette, and it got null and drew nothing.
    //
    // Our art is truecolor and has no index to give, so the honest
    // answer is the RGBA beside the shape - `rgba` is what the doll's
    // own vendor arm blits, and `data` stays null because there is
    // genuinely no indexed bitmap here, rather than a zero-filled one
    // that would draw as a black rectangle.
    //
    // TOP-DOWN, because the doll's composite is. The decode-ahead
    // stores `toColor32` of the PNG (H4, "into the port's color32
    // contract at the door"), which is the BOTTOM-UP order a world
    // billboard wants; the paper doll composites into a top-down RGBA
    // buffer that ends on a screen quad. So this hands back the rows
    // the other way round - the same HT3 fork the sprite itself just
    // paid, one pipeline over, and the reason it is resolved HERE is
    // that only this function knows which order it is holding.
    getDFBitmap: (record) => ({ ...size(record), data: null, rgba: topDownRgba(_decoded.get(textureKey(archive, record, 0))) }),
    getColor32: (record) => _decoded.get(textureKey(archive, record?.record ?? 0, 0)) ?? null,
  };
}
const entryFor = (key) => _index.get(key) ?? _vendor.get(key) ?? null;

export function clearTextureReplacements() {
  _index = new Map();
  _load = null;
  for (const k of _decoded.keys()) if (!_vendor.has(k)) _decoded.delete(k);   // a new pick must not inherit the old one's pixels; the port's own stay
}

/** Synchronous, and for the same reason music's is: the upload path
 *  has to know which branch it is on before it can proceed. */
export function hasTextureReplacement(archive, record, frame = 0, map = 'Albedo') {
  const key = textureKey(archive, record, frame, map);
  if (_vendor.has(key)) return true;
  if (!textureReplacementEnabled()) return false;
  return _index.has(key);
}

/**
 * Bytes for a replacement, or null. NEVER THROWS - a texture that will
 * not load is a cosmetic failure with the classic art right behind it.
 */
export async function textureReplacementBytes(archive, record, frame = 0, map = 'Albedo') {
  if (!hasTextureReplacement(archive, record, frame, map)) return null;
  const entry = entryFor(textureKey(archive, record, frame, map));
  const load = entry?.load ?? _load;
  if (!entry || !load) return null;
  try {
    const bytes = await load(entry.fileName);
    return bytes && bytes.byteLength > 0 ? bytes : null;
  } catch (e) {
    console.warn(`[texture] replacement ${entry.fileName} would not load:`, e?.message ?? e);
    return null;
  }
}

// ---- decode-ahead, so the UPLOAD path stays synchronous ------------
//
// uploadRecord/uploadRecordFrame are sync and are called from the draw
// path, while loading and decoding a PNG is neither. Music could get
// away with committing and arriving late because a song is a
// continuous thing; a texture is needed for the frame being drawn, and
// a late arrival would be a visible pop or a missing wall.
//
// So the work happens where there is already an await: getTexture()
// loads TEXTURE.### asynchronously and caches per archive, and the
// replacements for that archive are decoded alongside it. By the time
// anything uploads a record, its replacement is either decoded and
// waiting or genuinely absent.

// ROAD-H H4: WHAT IS IN THIS MAP IS A COLOR32, NOT A DECODED PNG.
//
// The upload path is `renderer.uploadTexture(archive, record, color32)`,
// which reads `color32.colors` and `asBytes` of it (renderer.js:2714),
// and every texture it uploads is BOTTOM-UP - `getColor32` writes
// `dstRow = (dstHeight - 1 - border - y) * dstWidth`
// (baseImageFile.js:143, BaseImageFile.cs:250) and the upload leaves
// UNPACK_FLIP_Y_WEBGL off (renderer.js:2704). A browser decode hands
// back `{ width, height, data }` with the TOP row first, so a swap
// stored raw was BOTH the wrong field name - `color32.colors` was
// `undefined` and `asBytes` threw on the first swapped record a pack
// covered - and, once named, upside-down.
//
// DFU has neither problem and the reason is one line of Unity:
// `TryImportTextureFromDisk` builds the replacement with
// `Texture2D.LoadImage(bytes)` (TextureReplacement.cs:1041-1056) and a
// Texture2D's rows are bottom-up, exactly like the classic texture it
// displaces - `TextureReader.GetTexture2D` assigns the imported albedo
// into the same slot `SetPixels32(albedoColors)` would have filled from
// `GetColor32` (TextureReader.cs:261-267). Same orientation, same
// shape, no conversion anywhere.
//
// So the conversion happens HERE, at the ONE door a replacement enters
// by, and `decodedTexture` answers something a caller can hand straight
// to `uploadTexture` beside a classic `getColor32`. `decodePng` keeps
// the PNG raster order it states as its contract (the seasons door
// takes the same conversion from the same module for the same reason -
// AUDIT 62 F26).
const _decoded = new Map();   // textureKey -> { width, height, colors } in getColor32 (bottom-up) order

/** The browser decode. Injectable because node has none of this, and
 *  the pins drive the cache rather than the DOM. */
export async function decodePng(bytes) {
  const blob = new Blob([bytes], { type: 'image/png' });
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close?.();
  return { width: img.width, height: img.height, data: new Uint8Array(img.data.buffer) };
}

/**
 * Decode every registered replacement belonging to one archive.
 * Idempotent, and never throws: one unreadable PNG costs that texture
 * and leaves the rest of the pack working.
 */
export async function preloadTextureArchive(archive, { decode = decodePng } = {}) {
  let done = 0;
  const sources = [..._vendor.entries(), ...(textureReplacementEnabled() && _load ? _index.entries() : [])];   // SURV2: the port's own art first, ungated
  for (const [key, entry] of sources) {
    if (entry.archive !== Number(archive) || _decoded.has(key)) continue;
    try {
      const bytes = await (entry.load ?? _load)(entry.fileName);
      if (!bytes || !bytes.byteLength) continue;
      _decoded.set(key, toColor32(await decode(bytes)));   // H4: into the port's color32 contract at the door, never at the upload sites
      done++;
    } catch (e) {
      console.warn(`[texture] ${entry.fileName} would not decode:`, e?.message ?? e);
    }
  }
  return done;
}

/** The SYNC read the upload path uses, as a COLOR32 (`{ colors, width,
 *  height }`, rows bottom-up) - the shape `getColor32` returns, so the
 *  two arms in scenes/dataPipeline.js can write `swap ?? t.getColor32(...)`
 *  and upload either without knowing which it got. Null means "draw the
 *  classic". */
export function decodedTexture(archive, record, frame = 0, map = 'Albedo') {
  const key = textureKey(archive, record, frame, map);
  if (_vendor.has(key)) return _decoded.get(key) ?? null;   // SURV2: the port's own, ungated
  if (!textureReplacementEnabled()) return null;
  return _decoded.get(key) ?? null;
}

export const decodedTextureCount = () => _decoded.size;
