// WW1: WEAPON WIDGET'S TEXTURES, from the player's own copy of the mod.
//
// The mod's bundle carries 173 PNGs - the classic weapon sprites, record
// 0 frame 0 (the idle pose), one per metal, repainted at double size
// for its DoubleScaleTextures and Inertia modules. They are renders of
// ARENA2 art and so are NOT in this repository (the doctrine ruling is
// in vendor/weapon-widget/README.md); they reach the game the way
// Seasons of the Iliac Bay's repaints do: the player attaches the
// `.dfmod` through the textures pick, and this door reads the bundle by
// its manifest's GUID and answers a texture by the name the mod asks
// for - TextureReplacement.TryImportCifRci's own spelling,
// `<prefix><FILE>_<record>-<frame>[_<Metal>]`, the `w_` prefix being
// the mod's for its double-scale set (GetWeaponTextureAtlas, IL
// 0x2d72). A loose PNG of the same name in the texture folder answers
// too, which is what TryImportCifRci reads in DFU when the bundle has
// none.
//
// Same registry shape as systems/seasonsIliacBayAssets.js - a name list
// and a loader, the bundle opened once, never throwing: a missing
// bundle means the modules run as the mod runs without its textures
// (the classic frame at double size).

import { readUnityBundle } from '../formats/unityBundle.js';
import { toColor32Order } from '../formats/color32Order.js';
import { decodePng } from '../systems/textureReplacement.js';
import { MATERIAL_NAMES } from '../systems/itemInfo.js';   // MetalTypes' names, Iron..Daedric
import { WEAPON_MATERIALS } from '../characters/weapons.js';

export const WEAPON_WIDGET_MOD = Object.freeze({
  guid: '9f301f2b-298b-43d8-8f3f-c54deaa841e0',
  title: 'Weapon Widget',
  version: '1.6',
  author: 'RedRoryOTheGlen',
});

import { DFMOD_KEY_PREFIX } from '../systems/seasonsIliacBayAssets.js';   // the stored-name prefix the texture pick writes for a bundle - one home (audit24's ratchet)
export { DFMOD_KEY_PREFIX };
const isWidgetDfmod = (name) => /\.dfmod$/i.test(name) && /weapon.?widget/i.test(name.slice(name.lastIndexOf('/') + 1));
const isPng = (name) => /\.png$/i.test(name);

/** TryImportCifRci's name for a weapon frame: the file, the record and
 *  frame, and the metal's name when there is one (MetalTypes.None -
 *  bare hands, the werecreature - adds nothing). */
export function widgetTextureName(fileName, record, frame, material, prefix = 'w_') {
  const metal = material != null && material !== WEAPON_MATERIALS.None ? MATERIAL_NAMES[material] : null;
  return `${prefix}${fileName}_${record}-${frame}${metal ? `_${metal}` : ''}`;
}

// ---- the registry ----------------------------------------------------

let _names = [];
let _load = null;
let _bundle = null;     // Promise<{ bundle, manifest } | null>
let _images = new Map();   // texture name -> Promise<image | null>

/** Register the stored names and a `load(name) -> bytes` loader (the
 *  texture pick's own). Returns how many entries could carry this mod's
 *  textures: its bundle (one) and any loose PNG spelt as it asks. */
export function setWeaponWidgetSources(fileNames, load) {
  const names = (fileNames ?? []).filter((n) => (n.startsWith(DFMOD_KEY_PREFIX) && isWidgetDfmod(n)) || (isPng(n) && /(^|\/)w?_?WEAPO/i.test(n)));
  const loader = typeof load === 'function' ? load : null;
  const same = loader === _load && names.length === _names.length && names.every((n, i) => n === _names[i]);
  _names = names;
  _load = loader;
  if (!same) { _bundle = null; _images = new Map(); }
  return _names.length;
}
export const clearWeaponWidgetSources = () => setWeaponWidgetSources([], null);
export const weaponWidgetSourcesCount = () => _names.length;

function manifestOf(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try { return JSON.parse(t.text); } catch { /* not this one */ }
  }
  return null;
}

/** The mod's bundle, found by GUID (then title) among the stored
 *  bundles, opened once. */
export async function weaponWidgetBundle() {
  if (!_bundle) {
    _bundle = (async () => {
      if (!_load) return null;
      for (const name of _names) {
        if (!name.startsWith(DFMOD_KEY_PREFIX)) continue;
        try {
          const bytes = await _load(name);
          if (!bytes || !bytes.byteLength) continue;
          const bundle = readUnityBundle(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
          const manifest = manifestOf(bundle);
          if (!manifest) continue;
          if (manifest.GUID === WEAPON_WIDGET_MOD.guid || manifest.ModTitle === WEAPON_WIDGET_MOD.title) {
            if (manifest.ModVersion && String(manifest.ModVersion) !== WEAPON_WIDGET_MOD.version) console.warn(`[weapon widget] the bundle is ${manifest.ModTitle} ${manifest.ModVersion}; the port is ${WEAPON_WIDGET_MOD.version}'s IL`);
            return { bundle, manifest };
          }
        } catch (e) {
          console.warn(`[weapon widget] ${name} would not open:`, e?.message ?? e);
        }
      }
      return null;
    })();
  }
  return _bundle;
}

/** One texture by name - `{ width, height, data }` RGBA in the port's
 *  color32 (bottom-up) order, the order renderer.uploadTexture takes -
 *  or null when neither the bundle nor a loose PNG carries it. Cached
 *  per name, misses included. */
export function weaponWidgetImage(name) {
  if (!_images.has(name)) {
    _images.set(name, (async () => {
      const b = await weaponWidgetBundle();
      const tex = b?.bundle?.textures?.find((t) => t.name === name);
      if (tex) {
        try { return toColor32Order(tex.rgba()); } catch (e) { console.warn(`[weapon widget] ${name} would not decode:`, e?.message ?? e); }
      }
      if (!_load) return null;
      const loose = _names.find((n) => isPng(n) && n.slice(n.lastIndexOf('/') + 1).replace(/\.png$/i, '') === name);
      if (!loose) return null;
      try {
        const bytes = await _load(loose);
        if (!bytes || !bytes.byteLength) return null;
        return toColor32Order(await decodePng(bytes));
      } catch (e) {
        console.warn(`[weapon widget] ${loose} would not decode:`, e?.message ?? e);
        return null;
      }
    })());
  }
  return _images.get(name);
}

/** Is the mod's bundle attached? Answers once the bundle question is settled. */
export async function weaponWidgetTexturesAttached() {
  if (!_names.length) return false;
  return !!(await weaponWidgetBundle()) || _names.some(isPng);
}
