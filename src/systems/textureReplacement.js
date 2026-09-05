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

export function clearTextureReplacements() {
  _index = new Map();
  _load = null;
  _decoded.clear();   // a new pick must not inherit the old one's pixels
}

/** Synchronous, and for the same reason music's is: the upload path
 *  has to know which branch it is on before it can proceed. */
export function hasTextureReplacement(archive, record, frame = 0, map = 'Albedo') {
  if (!textureReplacementEnabled()) return false;
  return _index.has(textureKey(archive, record, frame, map));
}

/**
 * Bytes for a replacement, or null. NEVER THROWS - a texture that will
 * not load is a cosmetic failure with the classic art right behind it.
 */
export async function textureReplacementBytes(archive, record, frame = 0, map = 'Albedo') {
  if (!hasTextureReplacement(archive, record, frame, map)) return null;
  const entry = _index.get(textureKey(archive, record, frame, map));
  if (!entry || !_load) return null;
  try {
    const bytes = await _load(entry.fileName);
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

const _decoded = new Map();   // textureKey -> { width, height, data }

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
  if (!textureReplacementEnabled() || !_load) return 0;
  let done = 0;
  for (const [key, entry] of _index) {
    if (entry.archive !== Number(archive) || _decoded.has(key)) continue;
    try {
      const bytes = await _load(entry.fileName);
      if (!bytes || !bytes.byteLength) continue;
      _decoded.set(key, await decode(bytes));
      done++;
    } catch (e) {
      console.warn(`[texture] ${entry.fileName} would not decode:`, e?.message ?? e);
    }
  }
  return done;
}

/** The SYNC read the upload path uses. Null means "draw the classic". */
export function decodedTexture(archive, record, frame = 0, map = 'Albedo') {
  if (!textureReplacementEnabled()) return null;
  return _decoded.get(textureKey(archive, record, frame, map)) ?? null;
}

export const decodedTextureCount = () => _decoded.size;

/** Test seam: place an already-decoded image without touching the DOM. */
export function _setDecodedForTests(archive, record, frame, map, image) {
  _decoded.set(textureKey(archive, record, frame, map), image);
}
