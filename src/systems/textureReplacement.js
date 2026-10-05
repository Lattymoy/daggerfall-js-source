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
import { dyeToken } from '../characters/dyes.js';   // DW3: GetName's dye arm - the key carries the dye a caller asks with

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
 *  import works. DW3: and the DYE - GetName (TextureReplacement.cs
 *  :725-735) writes `_<Dye>` before the map for every dye but
 *  Unchanged, and GetItemImage asks with the item's own (ItemHelper.cs
 *  :453, :458), so an Iron dagger's icon and a Daedric one's are two
 *  keys. This key used to drop it, so a pack's `233_5-0_Iron` and
 *  `233_5-0_Daedric` collided on one entry. `dye` is a DyeColors value
 *  or the name already read off a file name. */
export const textureKey = (archive, record, frame = 0, map = 'Albedo', dye = null) => {
  const d = dyeToken(dye);
  return `${Number(archive)}_${Number(record)}-${Number(frame)}${d ? `_${d}` : ''}${map && map !== 'Albedo' ? `_${map}` : ''}`;
};

// ---- the registry, one shape with music ----------------------------

let _index = new Map();
let _load = null;
let _looseGen = 0;   // VE2: bumps with every pick or clear - a picture built from the loose tier keys on it

/** Register a picked set; `load(fileName)` resolves to bytes. */
export function setTextureReplacements(fileNames, load) {
  _looseGen++;
  const was = _index;
  _index = new Map();
  for (const fileName of fileNames ?? []) {
    const e = textureEntry(fileName);
    if (!e) continue;
    // LAST WINS is wrong here for the same reason it was wrong for
    // music, but textures have no format preference to rank by - one
    // extension only - so a duplicate name IS the same texture twice
    // and keeping the first is stable and enough.
    const key = textureKey(e.archive, e.record, e.frame, e.map, e.dye);   // DW3: the dye rides the key
    if (!_index.has(key)) _index.set(key, e);
  }
  const wasLoad = _load;
  _load = typeof load === 'function' ? load : null;
  // AUDIT WD3 T2: the pick's picture, not the stand-in's already decoded - AUDIT VE R1: no longer deleted here; a
  // decoded picture answers only the entry it was decoded from (decodedTexture), and the sweep lets go of the rest
  if (_load !== wasLoad || !sameEntries(was, _index)) tierChanged();
  return _index.size;
}

export const textureReplacementCount = () => _index.size;

// ---- VE2: THE LOOSE TIER ALONE, for the ground's tile set ----------------
//
// TextureReplacement.TryImportTextureArray (TextureReplacement.cs:325-352) asks the loose folder BEFORE any mod:
// `!TextureExistsAmongLooseFiles(archive, 0, 0, textureMap)` (:847-851) is what lets it seek a mod's array at all. A
// loose record 0 sends the archive straight to its individual textures (TryMakeTextureArrayCopyTexture), each record
// sought loose-then-mods by TryImportTexture (:984-1005). systems/dfmodTextures.js dfmodGroundLayers asks these two.
/** TextureExistsAmongLooseFiles: the folder pick names the texture and the gate is open. */
export const looseTextureExists = (archive, record, frame = 0, map = 'Albedo') =>
  textureReplacementEnabled() && !!_load && _index.has(textureKey(archive, record, frame, map));
/** A loose texture's bytes, or null - never throws (a picture that will not load is the classic one's to stand in for). */
export async function looseTextureBytes(archive, record, frame = 0, map = 'Albedo') {
  if (!looseTextureExists(archive, record, frame, map)) return null;
  const entry = _index.get(textureKey(archive, record, frame, map));
  try {
    const bytes = await _load(entry.fileName);
    return bytes && bytes.byteLength > 0 ? bytes : null;
  } catch (e) {
    console.warn(`[texture] replacement ${entry.fileName} would not load:`, e?.message ?? e);
    return null;
  }
}
/** Bumps with every loose pick and clear: what a cache of pictures built from the loose tier keys on. */
export const looseTextureGeneration = () => _looseGen;

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
/** Register vendored files: [{ archive, record, frame?, dye?, gate?, load | build, standIn? }]
 *  where `load()` resolves to the PNG bytes - or, WD2, `build(ctx)`
 *  resolves to a top-down RGBA picture `{ width, height, data }` made
 *  from the player's own classic records through `ctx.classicRgba`
 *  (a mod's sprite that IS a classic record, or one with the author's
 *  edits laid on it: the edit ships, the record never does). DW3: `dye` is the
 *  DyeColors value (or name) the entry answers for, GetName's way;
 *  `gate` is a predicate read at lookup - a vendored mod's art behind
 *  that mod's own switch (Diverse Weapons' icons), decoded once and
 *  answering only while it is on.
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
    if (!Number.isFinite(e?.archive) || !Number.isFinite(e?.record) || (typeof e.load !== 'function' && typeof e.build !== 'function')) continue;
    const map = e.map ?? 'Albedo';   // RRI1: a mod's helmet mask registers under TextureMap.Mask
    const key = textureKey(e.archive, e.record, e.frame ?? 0, map, e.dye ?? null);
    _vendor.set(key, { archive: Number(e.archive), record: Number(e.record), frame: Number(e.frame ?? 0), map, dye: e.dye ?? null, gate: typeof e.gate === 'function' ? e.gate : null, lazy: e.lazy === true, fileName: e.fileName ?? key, load: e.load ?? null, build: typeof e.build === 'function' ? e.build : null, standIn: e.standIn === true, yields: e.yields === true, offset: e.offset ?? null });   // WD2: `build(ctx)` - a picture DERIVED from the player's own classic records (formats/derivedTexture.js), never a file   // FIELD-GUN4: a WORN stand-in needs a place on the doll, which only its registration knows; AUDIT-DW F1: `lazy` - decoded per record when asked, never by the archive's preload
    n++;
  }
  if (n) tierChanged();   // AUDIT VE R1: a scene's archives are asked again
  return n;
}
export const vendorTextureCount = () => _vendor.size;
export function clearVendorTextures() { _vendor.clear(); tierChanged(); }   // AUDIT VE R1: the sweep lets their pictures go
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

/** RRI1: the stand-in's per-record answers look past the DYE. A dyed
 *  set (the mod's 520_10-0_Iron .. _Daedric, and a bare 520_10-0 for
 *  leather) registers one entry per dye under one record; a size or an
 *  offset is the record's, the same for every dye, so the first entry
 *  of the record answers when the bare key has none. */
const vendorEntryOf = (archive, record, map = 'Albedo') => {
  const bare = _vendor.get(textureKey(archive, record, 0, map));
  if (bare) return bare;
  for (const e of _vendor.values()) if (e.archive === Number(archive) && e.record === Number(record) && e.frame === 0 && e.map === map) return e;
  return null;
};
const decodedOf = (archive, record) => {
  const bare = _decoded.get(textureKey(archive, record, 0));
  if (bare) return bare;
  for (const [k, e] of _vendor) if (e.archive === Number(archive) && e.record === Number(record) && e.frame === 0 && e.map === 'Albedo' && _decoded.has(k)) return _decoded.get(k);
  return null;
};
export function vendorTextureStandIn(archive) {
  const recordCount = vendorRecordCount(archive);
  const size = (record) => { const d = decodedOf(archive, record); return d ? { width: d.width, height: d.height } : { width: 1, height: 1 }; };
  return {
    vendor: true,
    archive: Number(archive),   // WD2: billboardSize reads `t.archive` to lay a mod's xml scale on (billboardXml.js) - a stand-in without it lost every one
    recordCount,
    getSize: (record) => (record >= 0 && record < recordCount ? size(record) : { width: 0, height: 0 }),   // TextureFile.getSize's own out-of-range answer
    // WD2: TextureFile.getScale's own shape, `{ width, height }` - rmbFlats' scaledBillboardSize reads those two, and the
    // `{ x, y }` this answered made every stand-in flat NaN-sized. A mod texture carries no classic record scale: zero
    // (MeshReader.GetBillboardMesh then leaves the size at the picture's own, and the xml scale is laid on after).
    getScale: (record) => decodedOf(archive, record)?.recordScale ?? { width: 0, height: 0 },   // DS1: a built stand-in may carry its classic record's scale
    // FIELD-GUN4: a classic record carries its own paper-doll offset
    // and this one has nowhere else to get one, so the registration
    // supplies it. Zero stays the answer for art that is never worn -
    // every icon door measures from its own rect and never asks.
    getOffset: (record) => vendorEntryOf(archive, record ?? 0)?.offset ?? { x: 0, y: 0 },
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
    getDFBitmap: (record) => ({ ...size(record), data: null, rgba: topDownRgba(decodedOf(archive, record)) }),
    getColor32: (record) => decodedOf(archive, record?.record ?? 0) ?? null,
  };
}
// ---- DFMOD1: TEXTURES FROM A PLAYER-ATTACHED .dfmod ------------------
//
// The third tier. A Daggerfall Unity texture mod (DREAM 90s and its
// kin) is the same DFU-named PNGs a loose pack carries, packed into a
// UnityFS bundle: `210_1-0`, `235_56-0_Aquamarine`, `235_56-0_Iron_Mask`.
// systems/dfmodTextures.js opens the bundles the player attached and
// registers every archive-named texture here, each with its own
// `image()` - a top-down RGBA picture decoded in the bundle's worker on
// first ask. Loose files outrank it (DFU reads the loose folder before
// it asks the mods, TextureReplacement.TryImportTexture), the port's own
// vendored art outranks both, and the AssetInjection gate covers it as
// it covers loose files. `rect` carries a paperdoll xml's `<rect>`
// (OverridePaperdollItemRect) for the doll to place a hi-res sprite by.
let _bundle = new Map();
// DFMOD3: A MEMORY BUDGET FOR THE BUNDLE TIER. Every decoded picture stays in `_decoded` as the one the upload path
// reads, and an HD mod set is thousands of them; past the budget a bundle picture is not decoded (its classic art
// draws, said once) rather than the tab running out of memory - the game's own textures, IndexedDB and the navmesh
// went with it in a player's log. navigator.deviceMemory (GB, capped at 8 by the browser) scales it.
// DFMOD3b: navigator.deviceMemory is capped at 8 by the browser itself (a
// privacy limit, not a real reading) - a 16 GB+ machine still reports 8, so
// the old 96/GB * 768 ceiling never gave one any more room than an actual
// 8 GB machine got. Most players are well past 8 GB now, so both numbers
// are doubled: 192/GB, up to 1536 MB, still leaving the tab's other memory
// (the game engine, the browser itself) untouched on a 16 GB machine, and
// a genuinely low-memory device is no worse off than before - it scales
// the same way, just twice as generously.
export const bundleBudgetBytes = () => Math.round(Math.min(1536, 192 * (Number(globalThis.navigator?.deviceMemory) || 8)) * 1024 * 1024);
let _bundleBytes = 0;
let _budgetWarned = false;
export const bundleDecodedBytes = () => _bundleBytes;
/** Replace the bundle tier: [{ archive, record, frame?, map?, dye?, fileName, src?, image, lazy?, rect? }]. `src` names
 *  where the picture comes from - the mod and its content as well as the name (AUDIT VE R1): two installs that hand the
 *  same `src` for a key hand the same picture, and its decode is kept. */
export function setBundleTextures(entries) {
  const was = _bundle;
  _bundle = new Map();
  _budgetWarned = false;   // DFMOD3
  for (const e of entries ?? []) {
    if (!Number.isFinite(e?.archive) || !Number.isFinite(e?.record) || typeof e.image !== 'function') continue;
    const map = e.map ?? 'Albedo';
    const key = textureKey(e.archive, e.record, e.frame ?? 0, map, e.dye ?? null);
    if (_bundle.has(key)) continue;   // the first attached mod that carries a name keeps it
    _bundle.set(key, { archive: Number(e.archive), record: Number(e.record), frame: Number(e.frame ?? 0), map, dye: e.dye ?? null, fileName: e.fileName ?? key, src: e.src ?? null, image: e.image, lazy: e.lazy === true, rect: e.rect ?? null });
  }
  // AUDIT VE R1: the doors were put back (a switch, an add-on, a registration landing) - which is not the same as their
  // pictures changing. This used to let go of EVERY mod picture decoded, while a scene preloads an archive once: a switch
  // pressed mid-game left everything not yet uploaded classic for the rest of the page. A picture answers only the entry
  // it was decoded from (decodedTexture); what no entry answers with any more is let go (the sweep); nothing else is.
  // AUDIT WD3 T2's stand-in yielding to the attached mod's picture is the same law: the stand-in's no longer answers.
  if (!sameEntries(was, _bundle)) tierChanged();
  return _bundle.size;
}
export const bundleTextureCount = () => _bundle.size;
/** A bundle texture's paperdoll `<rect>` ({ x, y, width, height } in the doll's own pixels), or null. */
export function textureReplacementRect(archive, record, frame = 0, map = 'Albedo', dye = null) {
  const key = textureKey(archive, record, frame, map, dye);
  if (_index.has(key) || vendorOf(key)) return null;
  return _bundle.get(key)?.rect ?? null;
}

/** WD3 (AUDIT WD3 T2): a vendored entry that YIELDS - the town mods' stand-ins for peers this port does not carry
 *  (DET's, the RMB Resource Pack's, Rosy's) - steps aside where the player's own replacement answers the same record
 *  (a loose file or an attached .dfmod: the real peer mod's own picture, which the stand-in only stands in for). */
const ownPick = (key) => textureReplacementEnabled() && (_index.has(key) || _bundle.has(key));
const vendorOf = (key) => { const v = _vendor.get(key); return v && !(v.yields && ownPick(key)) ? v : null; };
const entryFor = (key) => _index.get(key) ?? vendorOf(key) ?? _bundle.get(key) ?? null;

export function clearTextureReplacements() {
  _looseGen++;   // VE2
  const had = _index.size > 0 || _load !== null;
  _index = new Map();
  _load = null;
  // a new pick must not inherit the old one's pixels; the port's own stay (DFMOD1: and an attached bundle's); AUDIT WD3
  // T2: a yielding stand-in's picture is decided again against the new pick - AUDIT VE R1: all three by the one law, a
  // picture answers only the entry it was decoded from, and the sweep lets the loose pick's go
  if (had) tierChanged();
}

// ---- AUDIT VE R1/R8: A DECODED PICTURE KNOWS WHICH ENTRY IT CAME FROM ---------------------------------------------------
// One picture a key is kept (`_decoded`), and with it the source it was decoded from (`_decodedFrom`): a loose file's
// name, the port's own file, a mod's `src` - its key, its content and the name. A picture answers only while the entry
// that answers its key now has that source, so a switch never draws a stale picture and never costs a picture whose
// source still answers. A decode that lands after its entry stopped answering - a mod switched off while an area loads
// (R8) - is dropped where it lands.
const _decodedFrom = new Map();     // textureKey -> the source its picture was decoded from
const _bundleBytesOf = new Map();   // DFMOD3: textureKey -> the bytes a mod's decoded picture holds against the budget
const srcOf = (e) => e?.src ?? e?.fileName ?? null;
/** The entry whose picture a key answers with now - entryFor's order, behind Replace Game Artwork where the tier is:
 *  the loose pick (DFU reads the loose folder before any mod), else the port's own (unless it yields to the player's
 *  pick; it answers with the gate shut too), else the mods'. A vendored entry's own switch is read at lookup
 *  (decodedTexture). */
const liveEntry = (key) => {
  const on = textureReplacementEnabled();
  return (on && _load ? _index.get(key) : null) ?? vendorOf(key) ?? (on ? _bundle.get(key) : null) ?? null;
};
/** The picture decoded for a key from `entry`, or null - a picture decoded from anything else is not this entry's. */
const decodedFrom = (key, entry) => (entry && _decodedFrom.get(key) === srcOf(entry) ? _decoded.get(key) ?? null : null);
function dropDecoded(key) {
  _decoded.delete(key);
  _decodedFrom.delete(key);
  const b = _bundleBytesOf.get(key);
  if (b !== undefined) { _bundleBytes -= b; _bundleBytesOf.delete(key); }
}
function putDecoded(key, entry, c32) {
  dropDecoded(key);
  _decoded.set(key, c32);
  _decodedFrom.set(key, srcOf(entry));
  if (entry.image) { const b = c32.width * c32.height * 4; _bundleBytesOf.set(key, b); _bundleBytes += b; }   // DFMOD3: what it holds
}
/** Some tier still registers an entry of the picture's source for its key (behind the gate or not, yielding or not). */
const sourceRegistered = (key, src) => [_vendor.get(key), _index.get(key), _bundle.get(key)].some((e) => e && srcOf(e) === src);
/** Two registrations of a tier answer the same keys from the same sources. */
function sameEntries(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, e] of b) if (srcOf(a.get(k)) !== srcOf(e)) return false;
  return true;
}
let _tierGen = 0;
/** A tier's answers changed: the pictures no tier registers any more are let go (memory - the read checks anyway), and
 *  the epoch moves, so a scene asks its archives again (scenes/dataPipeline.js getTexture). */
function tierChanged() {
  _tierGen++;
  for (const [k, src] of [..._decodedFrom]) if (!sourceRegistered(k, src)) dropDecoded(k);
}
/** AUDIT VE R1: what a scene's decoded archives are current with - every tier's registrations and Replace Game Artwork.
 *  A scene preloads an archive's pictures once; when this moves, its next ask of the archive decodes what answers now,
 *  so a switch takes effect for whatever is drawn after it (what is already drawn keeps its pictures until its area loads
 *  again, as the Texture Overhaul card says). */
export const textureTierEpoch = () => `${_tierGen}:${textureReplacementEnabled() ? 1 : 0}`;

/** Synchronous, and for the same reason music's is: the upload path
 *  has to know which branch it is on before it can proceed. */
export function hasTextureReplacement(archive, record, frame = 0, map = 'Albedo', dye = null) {
  const key = textureKey(archive, record, frame, map, dye);
  const v = vendorOf(key);
  if (v) return !v.gate || v.gate() === true;   // DW3: a gated entry answers only while its switch is on
  if (!textureReplacementEnabled()) return false;
  return _index.has(key) || _bundle.has(key);   // DFMOD1: an attached bundle's texture answers too
}

/**
 * Bytes for a replacement, or null. NEVER THROWS - a texture that will
 * not load is a cosmetic failure with the classic art right behind it.
 */
export async function textureReplacementBytes(archive, record, frame = 0, map = 'Albedo', dye = null) {
  if (!hasTextureReplacement(archive, record, frame, map, dye)) return null;
  const entry = entryFor(textureKey(archive, record, frame, map, dye));
  if (entry?.build || entry?.image) return null;   // WD2: a derived picture has no file to hand over - it is built, never loaded; DFMOD1: nor has a bundle's
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
// which reads `color32.colors` and `asBytes` of it (renderer.js:3463),
// and every texture it uploads is BOTTOM-UP - `getColor32` writes
// `dstRow = (dstHeight - 1 - border - y) * dstWidth`
// (baseImageFile.js:143, BaseImageFile.cs:250) and the upload leaves
// UNPACK_FLIP_Y_WEBGL off (renderer.js:4101). A browser decode hands
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

/** WD2: what a `build` entry derives from - the host pipeline's own
 *  classic textures (`classicRgba(archive, record, frame)` answers a
 *  top-down RGBA picture of the player's record, index 0 clear). Set by
 *  scenes/dataPipeline.js when a pipeline is made; null until then, and a
 *  build asked without one is refused (its classic art is not here). */
let _deriveContext = null;
export function setTextureDeriveContext(ctx) { _deriveContext = ctx ?? null; }
/** DS1: a built picture may carry the classic record scale it is to be
 *  sized by (`scale: { width, height }`, TextureFile.getScale's shape) - a
 *  stand-in for a classic sprite stands as big as that sprite does. */
const withRecordScale = (c32, picture) => { if (picture?.scale) c32.recordScale = picture.scale; return c32; };
/** An entry's picture in the port's color32 contract - a vendored PNG
 *  decoded, or (WD2) a derived one built - or null when it has none.
 *  H4: both cross into color32 HERE, at the door, never at the upload sites. */
async function entryColor32(entry, decode) {
  if (entry.build) {
    if (!_deriveContext) throw new Error(`${entry.fileName}: derived from classic art and no pipeline is up to read it`);
    const picture = await entry.build(_deriveContext);
    return picture ? withRecordScale(toColor32(picture), picture) : null;
  }
  if (entry.image) {   // DFMOD1: a bundle's texture, decoded in its worker, top-down like a PNG
    if (_bundleBytes >= bundleBudgetBytes()) {   // DFMOD3: the budget is spent - the classic art draws
      if (!_budgetWarned) { _budgetWarned = true; console.warn(`[texture] texture mods reached their memory budget (${Math.round(bundleBudgetBytes() / 1048576)} MB) - further mod pictures draw classic this session; lower Texture detail to fit more`); }
      return null;
    }
    const img = await entry.image();
    return img ? toColor32(img) : null;   // AUDIT VE R8: counted against the budget where it is kept (putDecoded), not here
  }
  const bytes = await (entry.load ?? _load)(entry.fileName);
  if (!bytes || !bytes.byteLength) return null;
  return toColor32(await decode(bytes));
}

/** The browser decode. Injectable because node has none of this, and
 *  the pins drive the cache rather than the DOM. */
export async function decodePng(bytes) {
  const blob = new Blob([bytes], { type: 'image/png' });
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bmp.width, bmp.height);
  // FIELD 2026-09-27 (a player's console: "Canvas2D: Multiple readback operations using getImageData are faster with
  // the willReadFrequently attribute" x24): a canvas made to be READ is asked for as one - CPU-backed, no GPU readback
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
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
/** DW3: how many of an archive's replacements load at once. A gated
 *  entry is decoded whether or not its switch is on, so flipping the
 *  switch takes effect at once - the gate is read at lookup, not here.
 *
 *  AUDIT-DW F1: a LAZY entry is not preloaded here at all. Diverse
 *  Weapons registers 280 icons on archive 233; `getTexture(233)` awaits
 *  this preload before it publishes the archive, so the first inventory
 *  drew NOTHING - not even the classic icons - until all 280 had come
 *  down. DFU imports an icon when GetItemImage asks for it and never
 *  earlier; `preloadTextureRecord` below is that ask, and the icon doors
 *  make it per record. */
export const PRELOAD_CONCURRENCY = 8;
export async function preloadTextureArchive(archive, { decode = decodePng, concurrency = PRELOAD_CONCURRENCY } = {}) {
  let done = 0;
  const a = Number(archive);
  // SURV2: the port's own art, ungated; then the loose pick and an attached bundle's, behind the gate - AUDIT VE R1: each
  // key decoded from the ONE entry that answers it now (decodedTexture's), and only if its picture is not that entry's
  const keys = new Set();
  for (const tier of [_vendor, _index, _bundle]) for (const [k, e] of tier) if (e.archive === a) keys.add(k);
  const todo = [];
  for (const key of keys) {
    const entry = liveEntry(key);
    if (entry && !entry.lazy && !decodedFrom(key, entry)) todo.push([key, entry]);
  }
  const one = async ([key, entry]) => {
    try {
      const c32 = await entryColor32(entry, decode);   // WD2: a PNG decoded or a picture derived
      if (!c32) return;
      if (srcOf(liveEntry(key)) !== srcOf(entry)) return;   // AUDIT VE R8: switched away while it decoded - it lands nowhere
      putDecoded(key, entry, c32);
      done++;
    } catch (e) {
      console.warn(`[texture] ${entry.fileName} would not decode:`, e?.message ?? e);
    }
  };
  let next = 0;
  const lane = async () => { while (next < todo.length) await one(todo[next++]); };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, todo.length)) }, lane));
  return done;
}

const _decoding = new Map();   // textureKey -> Promise<color32 | null>, the asks in flight
/** AUDIT-DW F1: ONE record's replacement, decoded on demand - the ask
 *  GetItemImage makes (ItemHelper.cs:458) when an icon is drawn. Any
 *  entry, lazy or not; idempotent; the asks in flight for a key share
 *  one fetch; never throws. Answers the color32, or null when nothing
 *  is registered for the key, it is gated off, or it would not decode.
 *  The gate is read here too, so a gated-off icon costs no fetch. */
export function preloadTextureRecord(archive, record, frame = 0, map = 'Albedo', dye = null, { decode = decodePng } = {}) {
  const key = textureKey(archive, record, frame, map, dye);
  const entry = liveEntry(key);   // AUDIT VE R1: the entry that answers now - decodedTexture's
  if (decodedFrom(key, entry)) return Promise.resolve(decodedTexture(archive, record, frame, map, dye));
  if (!entry || !hasTextureReplacement(archive, record, frame, map, dye)) return Promise.resolve(null);
  const ask = `${key}\n${srcOf(entry)}`;   // the asks in flight share one fetch - for one source
  if (!_decoding.has(ask)) {
    _decoding.set(ask, (async () => {
      try {
        const c32 = await entryColor32(entry, decode);   // WD2
        if (!c32) return null;
        if (srcOf(liveEntry(key)) !== srcOf(entry)) return null;   // AUDIT VE R8: switched away while it decoded
        putDecoded(key, entry, c32);
        return decodedTexture(archive, record, frame, map, dye);
      } catch (e) {
        console.warn(`[texture] ${entry.fileName} would not decode:`, e?.message ?? e);
        return null;
      } finally { _decoding.delete(ask); }
    })());
  }
  return _decoding.get(ask);
}

/** The SYNC read the upload path uses, as a COLOR32 (`{ colors, width,
 *  height }`, rows bottom-up) - the shape `getColor32` returns, so the
 *  two arms in scenes/dataPipeline.js can write `swap ?? t.getColor32(...)`
 *  and upload either without knowing which it got. Null means "draw the
 *  classic". */
export function decodedTexture(archive, record, frame = 0, map = 'Albedo', dye = null) {
  const key = textureKey(archive, record, frame, map, dye);
  const v = vendorOf(key);
  // AUDIT VE R1/R8: the picture of the entry that answers now, never a stale one
  if (v) return (!v.gate || v.gate() === true) ? decodedFrom(key, liveEntry(key)) : null;   // SURV2: the port's own, ungated - DW3: unless its registration gates it
  if (!textureReplacementEnabled()) return null;
  return decodedFrom(key, liveEntry(key));
}

/** DW3: the same, with the rows top-down - what a compositor into a
 *  top-down buffer (the paper doll) blits. `topDownRgba`'s reversal,
 *  answered from the one place that knows which order it holds. */
export function decodedTextureTopDown(archive, record, frame = 0, map = 'Albedo', dye = null) {
  const d = decodedTexture(archive, record, frame, map, dye);
  return d ? { width: d.width, height: d.height, rgba: topDownRgba(d) } : null;
}

export const decodedTextureCount = () => _decoded.size;
