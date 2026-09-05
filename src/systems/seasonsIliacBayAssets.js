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
// Registration is a name list and two loaders, exactly like the music
// and texture replacement registries: nothing is read or decoded until
// a season that needs a prefix is installed, and a bundle is opened at
// most once.

import { readUnityBundle } from '../formats/unityBundle.js';
import { decodePng } from './textureReplacement.js';
import { SEASONS_MOD, PREFIX_FOLDER, filesForPrefix } from './seasonsIliacBay.js';

/** The stored-name prefixes the texture pick writes for this mod. */
export const DFMOD_KEY_PREFIX = 'dfmod/';
export const LOOSE_KEY_PREFIX = 'Seasons of the Iliac Bay/';

const FOLDERS = new Set(Object.values(PREFIX_FOLDER).map((f) => f.toLowerCase()));
const isPng = (name) => /\.png$/i.test(name);
const isDfmod = (name) => /\.dfmod$/i.test(name);

/**
 * Does a picked file belong to this mod, and under what stored key?
 * `relativePath` is the picker's webkitRelativePath (or the bare name).
 * A `.dfmod` is kept whole under `dfmod/<name>`; a PNG is kept only when
 * one of its path segments is one of the mod's eleven folders, under
 * `Seasons of the Iliac Bay/<Folder>/<file>`. Null means "not ours".
 */
export function seasonsAssetKey(relativePath) {
  const path = String(relativePath ?? '').replace(/\\/g, '/');
  const parts = path.split('/').filter(Boolean);
  const base = parts[parts.length - 1] ?? '';
  if (isDfmod(base)) return DFMOD_KEY_PREFIX + base.toLowerCase();
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
  _names = (fileNames ?? []).filter((n) => n.startsWith(DFMOD_KEY_PREFIX) || n.startsWith(LOOSE_KEY_PREFIX));
  _load = typeof load === 'function' ? load : null;
  _bundles = new Map();
  _seasonsBundle = null;
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
          return { bundle, manifest, files: manifest.Files ?? [] };
        }
      }
      return null;
    })();
  }
  return _seasonsBundle;
}

/**
 * SeasonHelper.LoadTexturesFromMod(prefix): every texture whose file
 * name starts with the prefix, loaded and decoded, as
 * `{ name, width, height, image }` where `image` is
 * `{ width, height, data }` RGBA top-down. The bundle is asked first,
 * over ITS manifest's file list, as the mod does; the loose folders
 * answer when there is no bundle. Never throws: one bad texture is
 * skipped with a warning, the way `Mod.GetAsset` returning null is.
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
        const image = tex.rgba();
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
      const image = await decode(bytes);
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
