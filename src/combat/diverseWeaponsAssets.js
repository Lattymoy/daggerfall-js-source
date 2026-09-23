// DW1: DIVERSE WEAPONS' TEXTURES, from the player's own copy of the mod.
//
// Diverse Weapons 1.7.3 (RealAKP; script by RealAKP & Kirk.O, MIT) is
// 12,624 sprites and one line of code. The line is
// `FPSWeapon.moddedWeaponHUDAnimsEnabled = true` (DiverseWeaponsMain.cs
// :37, carried verbatim in vendor/diverse-weapons/), and the law it
// switches on lives in DFU itself - combat/diverseWeapons.js is the
// port's home for it. The sprites are a first-person set PER WEAPON
// TEMPLATE where the classic art has one per weapon CLASS - eighteen
// weapons, each in ten metals, each plain and enchanted, a record and
// frame for every pose (`LONGSWORD.CIF_3-2_Dwarven`, `KATANAMAGIC.CIF
// _0-0_Ebony`), plus Weapon Widget's double-scale idle set for each
// (`w_LONGSWORD.CIF_0-0_Iron`) and the inventory and paper-doll icons
// in the same metals (`233_5-0_Elven`).
//
// They reach the game the way Weapon Widget's and Seasons of the Iliac
// Bay's do (combat/weaponWidgetAssets.js, systems/seasonsIliacBayAssets
// .js): the player attaches the mod's `.dfmod` through the textures
// pick, this door opens the bundle by its manifest's GUID, and answers
// a texture by the name DFU asks for - TextureReplacement.GetNameCifRci
// 's spelling (TextureReplacement.cs:783-801), `<prefix><FILE>_<record>
// -<frame>[_<Metal>]`. A loose PNG of the same name in the texture
// folder answers too, as TryImportCifRci reads one in DFU when the
// bundle has none. Without either, the law runs as it runs in DFU with
// the flag on and no textures: every ask misses and the classic frame
// draws.
//
// Not in the repository, on purpose: 58 MB is the reason that shows,
// and the doctrine reason is bible/01-Overview/Port-Doctrine.md - the
// port ships no mod's art, and reads it off the player's own copy.
//
// Same registry shape as the widget's door - a name list and a loader,
// the bundle opened once, never throwing.

import { openUnityBundle } from '../formats/unityBundleClient.js';   // the open runs in a worker (~10 s of LZ4 for this bundle); this thread when there is none
import { toColor32, toScreenOrder } from '../formats/color32Order.js';   // WW3's law: the bundle arm is a FLIP (Unity stores bottom-up), the loose PNG keeps its rows
import { decodePng } from '../systems/textureReplacement.js';
import { DFMOD_KEY_PREFIX } from '../systems/seasonsIliacBayAssets.js';   // the stored-name prefix the texture pick writes for a bundle - one home
import { weaponWidgetImage } from './weaponWidgetAssets.js';

export const DIVERSE_WEAPONS_MOD = Object.freeze({
  guid: '8e83d67c-a0ac-4935-a8c5-6b18c9f35bfc',
  title: 'Diverse Weapons',
  version: '1.7.3',
  author: 'RealAKP',
});

const isDiverseDfmod = (name) => /\.dfmod$/i.test(name) && /diverse.?weapons/i.test(name.slice(name.lastIndexOf('/') + 1));
const isPng = (name) => /\.png$/i.test(name);
/** The mod's own spellings for a loose PNG: a per-weapon CIF name with
 *  or without the `w_` prefix (`LONGSWORD.CIF_0-0_Iron.png`), or an
 *  icon archive with a metal suffix (`233_5-0_Elven.png`). */
const isDiversePng = (name) => {
  const base = name.slice(name.lastIndexOf('/') + 1);
  return /^(w_)?[A-Z0-9]+\.CIF_\d+-\d+(_[A-Za-z]+)?\.png$/i.test(base) || /^\d{3}_\d+-\d+_[A-Za-z]+\.png$/i.test(base);
};

// ---- the registry ----------------------------------------------------

let _names = [];
let _load = null;
let _bundle = null;     // Promise<{ bundle, manifest, byName } | null>
let _images = new Map();   // texture name -> Promise<image | null>
let _workerFactory = null;   // test seam: a fake Worker, or a factory that throws (the same-thread fallback)

/** Register the stored names and a `load(name) -> bytes` loader (the
 *  texture pick's own). Returns how many entries could carry this mod's
 *  textures: its bundle and any loose PNG spelt as it asks. */
export function setDiverseWeaponsSources(fileNames, load, { workerFactory = null } = {}) {
  const names = (fileNames ?? []).filter((n) => (n.startsWith(DFMOD_KEY_PREFIX) && isDiverseDfmod(n)) || (isPng(n) && isDiversePng(n)));
  const loader = typeof load === 'function' ? load : null;
  const same = loader === _load && names.length === _names.length && names.every((n, i) => n === _names[i]) && workerFactory === _workerFactory;
  _names = names;
  _load = loader;
  _workerFactory = workerFactory;
  if (!same) forgetBundle();
  return _names.length;
}
/** Drop the open bundle (and its worker, when it has one) and the name cache. */
function forgetBundle() {
  const old = _bundle;
  _bundle = null; _images = new Map();
  old?.then((b) => b?.bundle.close()).catch(() => null);
}
export const clearDiverseWeaponsSources = () => setDiverseWeaponsSources([], null);
export const diverseWeaponsSourcesCount = () => _names.length;

function manifestOf(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try { return JSON.parse(t.text); } catch { /* not this one */ }
  }
  return null;
}

/** The mod's bundle, found by GUID (then title) among the stored
 *  bundles, opened once - in a worker, formats/unityBundleClient.js:
 *  this bundle's index is ~10 s of LZ4 the frame cannot carry. The
 *  textures are indexed by name at open: 12,934 of them, and the
 *  widget's `find` per ask would walk them all for every frame of
 *  every weapon. */
export async function diverseWeaponsBundle() {
  if (!_bundle) {
    _bundle = (async () => {
      if (!_load) return null;
      for (const name of _names) {
        if (!name.startsWith(DFMOD_KEY_PREFIX)) continue;
        try {
          const bytes = await _load(name);
          if (!bytes || !bytes.byteLength) continue;
          const bundle = await openUnityBundle(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { workerFactory: _workerFactory });
          const manifest = manifestOf(bundle);
          if (!manifest) { bundle.close(); continue; }
          if (manifest.GUID === DIVERSE_WEAPONS_MOD.guid || manifest.ModTitle === DIVERSE_WEAPONS_MOD.title) {
            if (manifest.ModVersion && String(manifest.ModVersion) !== DIVERSE_WEAPONS_MOD.version) console.warn(`[diverse weapons] the bundle is ${manifest.ModTitle} ${manifest.ModVersion}; the port carries ${DIVERSE_WEAPONS_MOD.version}'s script`);
            const byName = new Map();
            for (const t of bundle.textures ?? []) if (!byName.has(t.name)) byName.set(t.name, t);
            return { bundle, manifest, byName };
          }
          bundle.close();
        } catch (e) {
          console.warn(`[diverse weapons] ${name} would not open:`, e?.message ?? e);
        }
      }
      return null;
    })();
  }
  return _bundle;
}

/** True once a bundle answering to the mod's GUID has been opened. */
export async function diverseWeaponsTexturesAttached() { return !!(await diverseWeaponsBundle()); }

/** One texture by name - `{ width, height, colors }` RGBA in the port's
 *  color32 (bottom-up) order, the shape renderer.uploadTexture reads -
 *  or null when neither the bundle nor a loose PNG carries it. Cached
 *  per name, misses included. The two arms are the widget door's
 *  (WW3, HT3): the bundle's texel rows are Unity's, bottom-up, and
 *  `toColor32` is the flip into the port's order; a decoded PNG is
 *  top-first already and keeps its rows through `toScreenOrder`. */
export function diverseWeaponsImage(name, { decode = decodePng } = {}) {
  if (!_images.has(name)) {
    _images.set(name, (async () => {
      if (!_names.length) return null;   // nothing attached: the fast miss, so a weapon load with the flag on costs no work
      const b = await diverseWeaponsBundle();
      if (b?.byName.has(name)) {
        // the pixels cross from the worker per ask (one transfer), and
        // are flipped here: the reader answers Unity's bottom-up rows
        try { const img = await b.bundle.rgba(name); if (img) return toColor32(img); } catch (e) { console.warn(`[diverse weapons] ${name} would not decode:`, e?.message ?? e); }
      }
      if (!_load) return null;
      const loose = _names.find((n) => isPng(n) && n.slice(n.lastIndexOf('/') + 1).replace(/\.png$/i, '') === name);
      if (!loose) return null;
      try {
        const bytes = await _load(loose);
        if (!bytes || !bytes.byteLength) return null;
        return toScreenOrder(await decode(bytes));
      } catch (e) {
        console.warn(`[diverse weapons] ${loose} would not decode:`, e?.message ?? e);
        return null;
      }
    })());
  }
  return _images.get(name);
}

/**
 * THE ONE ASK BOTH FIRST-PERSON LANES MAKE - TryImportCifRci's answer
 * for a name (FPSWeapon.cs:647; the widget clone's GetWeaponTextureAtlas
 * arm, IL 0x2d72). DFU has one texture folder every mod's files land
 * in; the port has one door per mod, so the ask walks them: this mod's
 * bundle and PNGs first (it is the one that carries whole animation
 * sets), then Weapon Widget's (its own double-scale idles for the
 * classic archives). The first that carries the name answers.
 */
export async function customWeaponImage(name) {
  return (await diverseWeaponsImage(name)) ?? (await weaponWidgetImage(name)) ?? null;
}

/** Test seam: forget the name cache without touching the sources. */
export function _resetDiverseWeaponsImages() { forgetBundle(); }
