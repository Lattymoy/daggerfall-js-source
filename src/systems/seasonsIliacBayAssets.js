// SEASONS OF THE ILIAC BAY - THE TEXTURE DOOR.
//
// In Daggerfall Unity the mod's textures ride its `.dfmod` (a Unity
// AssetBundle) and SeasonHelper asks the mod system for them by name
// (`Mod.GetAsset<Texture2D>`) over the manifest's file list. Here they
// come from the player's own copy of the mod through the "Your own
// textures" pick (scenes/dataSource.js), in either of the two shapes a
// player has it in:
//
//   1. THE `.dfmod` ITSELF (`seasons of the iliac bay.dfmod`, the file
//      Nexus ships and DFU loads) - read by formats/unityBundle.js; the
//      manifest inside names the mod and its file list, and every
//      texture decodes from the bundle exactly as DFU would sample it.
//   2. THE MOD'S `Textures/` FOLDERS as loose PNGs (the shape its source
//      is kept in) - each file stored under its folder, decoded by the
//      browser.
//
// Either way the registry answers SeasonHelper's one question: the
// textures whose name starts with a prefix, each with its size. The
// pixels are never in this repository (see the module header of
// systems/seasonsIliacBay.js for why).
//
// Registration is a name list and a loader, exactly like the music and
// texture replacement registries. The bundle is opened ONCE, when a
// host first asks whether the mod is installed (its blocks decompressed
// and its object table read, to find the manifest and learn whose it
// is); no texture's pixels decode until a season asks for its prefix.
// The loose folders are read only per prefix.

import { readUnityBundle } from '../formats/unityBundle.js';
import { toColor32Order } from '../formats/color32Order.js';   // ROAD-H H4: the flip moved to the shared door M-TEX takes too
import { decodePng } from './textureReplacement.js';
import { SEASONS_MOD, PREFIX_FOLDER, filesForPrefix } from './seasonsIliacBay.js';

/** The stored-name prefixes the texture pick writes for this mod. */
export const DFMOD_KEY_PREFIX = 'dfmod/';
export const LOOSE_KEY_PREFIX = 'Seasons of the Iliac Bay/';

const FOLDERS = new Set(Object.values(PREFIX_FOLDER).map((f) => f.toLowerCase()));
const isPng = (name) => /\.png$/i.test(name);
/** The bundle this door takes. SIB2 (2026-09-08, Mac: "ensure the
 *  seasons mod is 1:1 and working"): a mod's IDENTITY is its manifest -
 *  the GUID and the title inside the bundle, which `seasonsBundle` reads
 *  - never its file name, which DFU does not check either and which no
 *  record here evidences (the mod's own manifest names its manifest
 *  "4 Seasons.dfmod.json"; Nexus renames downloads). So any `.dfmod`
 *  whose name says "season" is stored and read; the manifest decides.
 *  The name test stays only because a player's whole Mods folder runs
 *  to gigabytes and a bundle is decompressed whole to be read - this
 *  registry has no use for another mod's. `SEASONS_DFMOD` is the name
 *  the record expects, for the docs and the tests. */
export const SEASONS_DFMOD = 'seasons of the iliac bay.dfmod';
const isSeasonsDfmod = (name) => /\.dfmod$/i.test(name) && /season/i.test(name);

/**
 * Does a picked file belong to this mod, and under what stored key?
 * `relativePath` is the picker's webkitRelativePath (or the bare name).
 * The mod's own `.dfmod` is kept whole under `dfmod/<name>`; a PNG is
 * kept only when one of its path segments is one of the mod's eleven
 * folders, under `Seasons of the Iliac Bay/<Folder>/<file>`. Null means
 * "not ours".
 */
export function seasonsAssetKey(relativePath) {
  const path = String(relativePath ?? '').replace(/\\/g, '/');
  const parts = path.split('/').filter(Boolean);
  const base = parts[parts.length - 1] ?? '';
  if (isSeasonsDfmod(base)) return DFMOD_KEY_PREFIX + base.toLowerCase();
  if (!isPng(base)) return null;
  for (let i = parts.length - 2; i >= 0; i--) {
    const seg = parts[i];
    if (FOLDERS.has(seg.toLowerCase())) return `${LOOSE_KEY_PREFIX}${seg}/${base}`;
  }
  return null;
}

// ---- the registry ----------------------------------------------------

let _names = [];
let _load = null;
let _bundles = new Map();   // stored name -> Promise<bundle | null>
let _seasonsBundle = null;  // Promise<{ files, textures } | null> for the mod's own bundle

/** Register the stored names and a `load(name) -> bytes` loader. Returns
 *  how many stored entries belong to this mod (bundles count one). */
export function setSeasonsSources(fileNames, load) {
  const names = (fileNames ?? []).filter((n) => n.startsWith(DFMOD_KEY_PREFIX) || n.startsWith(LOOSE_KEY_PREFIX));
  const loader = typeof load === 'function' ? load : null;
  // The boot seam registers on EVERY host boot (ensureAudio is called
  // by each host, some twice); the same names and loader keep the
  // opened bundle rather than dropping it to be read again.
  const same = loader === _load && names.length === _names.length && names.every((n, i) => n === _names[i]);
  _names = names;
  _load = loader;
  if (!same) {
    _bundles = new Map();
    _seasonsBundle = null;
  }
  return _names.length;
}

export const clearSeasonsSources = () => setSeasonsSources([], null);

/** Is anything registered that could carry this mod's textures? */
export const seasonsSourcesCount = () => _names.length;

async function openBundle(name) {
  if (!_bundles.has(name)) {
    _bundles.set(name, (async () => {
      try {
        const bytes = await _load(name);
        if (!bytes || !bytes.byteLength) return null;
        return readUnityBundle(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
      } catch (e) {
        console.warn(`[seasons] ${name} would not open:`, e?.message ?? e);
        return null;
      }
    })());
  }
  return _bundles.get(name);
}

/** The manifest a bundle carries (its `.dfmod` TextAsset), parsed. */
export function bundleManifest(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try { return JSON.parse(t.text); } catch { /* not this one */ }
  }
  return null;
}

/** Find the stored bundle whose manifest is this mod's (by GUID, then
 *  by title), once. */
async function seasonsBundle() {
  if (!_seasonsBundle) {
    _seasonsBundle = (async () => {
      if (!_load) return null;
      for (const name of _names) {
        if (!name.startsWith(DFMOD_KEY_PREFIX)) continue;
        const bundle = await openBundle(name);
        if (!bundle) continue;
        const manifest = bundleManifest(bundle);
        if (!manifest) continue;
        if (manifest.GUID === SEASONS_MOD.guid || manifest.ModTitle === SEASONS_MOD.title) {
          // SIB2: the port is 1.1's IL, method by method; a later build may wire what 1.1 leaves unreachable
          if (manifest.ModVersion && String(manifest.ModVersion) !== SEASONS_MOD.version) console.warn(`[seasons] the bundle is ${manifest.ModTitle} ${manifest.ModVersion}; the port is ${SEASONS_MOD.version}'s script - a later version may do what this one does not`);
          return { bundle, manifest, files: manifest.Files ?? [] };
        }
      }
      return null;
    })();
  }
  return _seasonsBundle;
}

// AUDIT 62 F26: rows reversed - a top-down RGBA raster (what a PNG
// decodes to, and what `decodeTexture2D` hands back) in the port's
// COLOR32 ORDER: row 0 is the picture's BOTTOM row, exactly what
// `BaseImageFile.getColor32` produces (baseImageFile.js:123,
// BaseImageFile.cs:250) and what `renderer.uploadTexture` uploads
// as-is with UNPACK_FLIP_Y_WEBGL off (renderer.js:1795).
// In DFU the mod's asset is a Unity Texture2D, whose pixels are
// bottom-up like every Texture2D the classic reader builds, so its
// flats and the classic ones agree; here the seasonal record entered
// through a PNG-order door and every seasonal tree, rock and plant
// drew vertically mirrored under BB_VS (renderer.js:299-304, v=0 =
// image bottom). The flip belongs at THIS door: `decodeTexture2D` and
// `decodePng` keep the PNG raster order each states as its contract,
// and the port's upload order is reached here, once, per texture.
// ROAD-H H4: `toColor32Order` itself now lives in
// formats/color32Order.js, because M-TEX's loose-file override needs
// the very same conversion at its own door and two copies of a flip
// is how one of them ends up flipped twice.

/**
 * SeasonHelper.LoadTexturesFromMod(prefix): every texture whose file
 * name starts with the prefix, loaded and decoded, as
 * `{ name, width, height, image }` where `image` is
 * `{ width, height, data }` RGBA in getColor32 (bottom-up) order - the
 * order the hosts upload it in (see formats/color32Order.js). The bundle
 * is asked first, over ITS manifest's file list, as the mod does; the
 * loose folders answer when there is no bundle. Never throws: one bad
 * texture is skipped with a warning, the way `Mod.GetAsset` returning
 * null is.
 */
export async function loadSeasonsTextures(prefix, { decode = decodePng } = {}) {
  const out = [];
  const b = await seasonsBundle();
  if (b) {
    const byName = new Map(b.bundle.textures.map((t) => [t.name, t]));
    for (const file of filesForPrefix(b.files, prefix)) {
      const base = file.slice(file.lastIndexOf('/') + 1);
      const stem = base.replace(/\.[^.]*$/, '');
      const tex = byName.get(stem);
      if (!tex) { console.warn(`LoadTexturesFromMod: failed to load asset ${base}`); continue; }
      try {
        const image = toColor32Order(tex.rgba());
        out.push({ name: base, width: image.width, height: image.height, image });
      } catch (e) {
        console.warn(`[seasons] ${base} would not decode:`, e?.message ?? e);
      }
    }
    return out;
  }
  if (!_load) return out;
  const loose = _names.filter((n) => n.startsWith(LOOSE_KEY_PREFIX));
  for (const name of filesForPrefix(loose, prefix)) {
    const base = name.slice(name.lastIndexOf('/') + 1);
    try {
      const bytes = await _load(name);
      if (!bytes || !bytes.byteLength) continue;
      const image = toColor32Order(await decode(bytes));
      out.push({ name: base, width: image.width, height: image.height, image });
    } catch (e) {
      console.warn(`[seasons] ${base} would not decode:`, e?.message ?? e);
    }
  }
  return out;
}

/** Is the mod "installed" - is there a source that carries it? Answers
 *  once the bundle question is settled; loose folders count by name. */
export async function seasonsInstalled() {
  if (!_names.length) return false;
  if (await seasonsBundle()) return true;
  return _names.some((n) => n.startsWith(LOOSE_KEY_PREFIX));
}
