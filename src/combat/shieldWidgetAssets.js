// @ts-check
// SW1: SHIELD WIDGET'S TEXTURES, from the player's own copy of the mod.
//
// The mod's bundle carries 600 PNGs - four archives (112360 Buckler,
// 112361 Round, 112362 Kite, 112363 Tower), thirty records each, five
// frames each. A record is a material group plus a condition tier, so
// the set is the mod's own art for every shield in every metal at three
// states of wear.
//
// They are renders of ARENA2 art, so by the port's doctrine (A RENDER
// OF GAME DATA IS GAME DATA - bible/01-Overview/Port-Doctrine.md, and
// the ruling vendor/weapon-widget/README.md records for the sibling)
// they are NOT in this repository. They reach the game the way Seasons
// of the Iliac Bay's repaints and Weapon Widget's do: the player
// attaches the `.dfmod` through the textures pick, and this door reads
// the bundle by its manifest's GUID and answers a texture by the name
// the mod asks for - TextureReplacement's own `<archive>_<record>-<frame>`.
// A loose PNG of the same name answers too, which is what
// TryImportTexture reads in DFU when the bundle has none.
//
// Without the bundle the widget has no sprite and draws nothing, which
// is the mod without its own textures: there is no classic shield art
// to fall back to, because classic Daggerfall draws no shield at all.

import { readUnityBundle } from '../formats/unityBundle.js';
import { toColor32, toScreenOrder } from '../formats/color32Order.js';
import { decodePng } from '../systems/textureReplacement.js';
import { DFMOD_KEY_PREFIX } from '../systems/seasonsIliacBayAssets.js';
import { SHIELD_ARCHIVE_FIRST, SHIELD_FRAMES, SHIELD_RECORDS, SHIELD_TEXTURE_COUNT, shieldTextureName } from './shieldWidget.js';

export { DFMOD_KEY_PREFIX };

export const SHIELD_WIDGET_MOD = Object.freeze({
  guid: 'e59d8114-e9a2-4e8e-84e8-4666475dbb9f',
  title: 'Shield Widget',
  version: '1.6',
  author: 'RedRoryOTheGlen',
});

const isWidgetDfmod = (name) => /\.dfmod$/i.test(name) && /shield.?widget/i.test(name.slice(name.lastIndexOf('/') + 1));
const isPng = (name) => /\.png$/i.test(name);
/** The four archives' own spelling, which is what a loose PNG is named. */
const isShieldPng = (name) => isPng(name) && /(^|\/)11236[0-3]_\d+-\d+\.png$/i.test(name);

/** The texture name for a flat index, TextureReplacement's spelling. */
export function shieldTextureFileName(index) {
  const { archive, record, frame } = shieldTextureName(index);
  return `${archive}_${record}-${frame}`;
}

// ---- the registry ----------------------------------------------------

let _names = [];
let _load = null;
let _bundle = null;        // Promise<{ bundle, manifest } | null>
let _images = new Map();   // texture name -> Promise<image | null>
let _sizes = new Map();    // flat index -> { width, height } | null, once known

/** Register the stored names and a `load(name) -> bytes` loader (the
 *  texture pick's own). Returns how many entries could carry this mod's
 *  textures: its bundle (one) and any loose PNG spelt as it asks. */
export function setShieldWidgetSources(fileNames, load) {
  const names = (fileNames ?? []).filter((n) => (n.startsWith(DFMOD_KEY_PREFIX) && isWidgetDfmod(n)) || isShieldPng(n));
  const loader = typeof load === 'function' ? load : null;
  const same = loader === _load && names.length === _names.length && names.every((n, i) => n === _names[i]);
  _names = names;
  _load = loader;
  if (!same) { _bundle = null; _images = new Map(); _sizes = new Map(); }
  return _names.length;
}
export const clearShieldWidgetSources = () => setShieldWidgetSources([], null);
export const shieldWidgetSourcesCount = () => _names.length;

function manifestOf(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try { return JSON.parse(t.text); } catch { /* not this one */ }
  }
  return null;
}

/** The mod's bundle, found by GUID (then title) among the stored
 *  bundles, opened once. */
export async function shieldWidgetBundle() {
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
          if (manifest.GUID === SHIELD_WIDGET_MOD.guid || manifest.ModTitle === SHIELD_WIDGET_MOD.title) {
            if (manifest.ModVersion && String(manifest.ModVersion) !== SHIELD_WIDGET_MOD.version) console.warn(`[shield widget] the bundle is ${manifest.ModTitle} ${manifest.ModVersion}; the port is ${SHIELD_WIDGET_MOD.version}'s IL`);
            return { bundle, manifest };
          }
        } catch (e) {
          console.warn(`[shield widget] ${name} would not open:`, e?.message ?? e);
        }
      }
      return null;
    })();
  }
  return _bundle;
}

/** One sprite by flat index - `{ width, height, colors }` RGBA in the
 *  port's color32 (bottom-up) order, the SHAPE renderer.uploadTexture
 *  reads (WW3's crash: the order was right and the shape was not) - or
 *  null when neither the bundle nor a loose PNG carries it. Cached per
 *  name, misses included. */
export function shieldWidgetImage(index) {
  if (!(index >= 0 && index < SHIELD_TEXTURE_COUNT)) return Promise.resolve(null);
  const name = shieldTextureFileName(index);
  if (!_images.has(name)) {
    _images.set(name, (async () => {
      const b = await shieldWidgetBundle();
      const tex = b?.bundle?.textures?.find((t) => t.name === name);
      if (tex) {
        try {
          const img = toColor32(tex.rgba());
          _sizes.set(index, { width: img.width, height: img.height });
          return img;
        } catch (e) { console.warn(`[shield widget] ${name} would not decode:`, e?.message ?? e); }
      }
      if (!_load) { _sizes.set(index, null); return null; }
      const loose = _names.find((n) => isPng(n) && n.slice(n.lastIndexOf('/') + 1).replace(/\.png$/i, '') === name);
      if (!loose) { _sizes.set(index, null); return null; }
      try {
        const bytes = await _load(loose);
        if (!bytes || !bytes.byteLength) { _sizes.set(index, null); return null; }
        // HT3's law, as the sibling's door states it: a decoded PNG is
        // already top-first and this is a SCREEN quad, so it keeps its
        // rows where the bundle arm above flips.
        const img = toScreenOrder(await decodePng(bytes));
        _sizes.set(index, { width: img.width, height: img.height });
        return img;
      } catch (e) {
        console.warn(`[shield widget] ${loose} would not decode:`, e?.message ?? e);
        _sizes.set(index, null);
        return null;
      }
    })());
  }
  return _images.get(name);
}

/** The sprite's size, which is all the widget's rect maths needs -
 *  answered from the bundle's own header without decoding pixels, so a
 *  frame that has not drawn yet still measures. Null until the bundle
 *  is open. */
export function shieldWidgetSize(index) {
  if (_sizes.has(index)) return _sizes.get(index);
  return null;
}

/** Read every sprite's size out of the open bundle in one pass, so the
 *  widget can measure before a single texture has been uploaded. */
export async function primeShieldWidgetSizes() {
  const b = await shieldWidgetBundle();
  if (!b?.bundle?.textures) return 0;
  const by = new Map(b.bundle.textures.map((t) => [t.name, t]));
  let n = 0;
  for (let i = 0; i < SHIELD_TEXTURE_COUNT; i++) {
    const t = by.get(shieldTextureFileName(i));
    if (!t) continue;
    _sizes.set(i, { width: t.width, height: t.height });
    n++;
  }
  return n;
}

/** The widget's `textures` dep. */
export const shieldWidgetTextures = Object.freeze({ size: shieldWidgetSize, image: shieldWidgetImage });

/** Is the mod's bundle attached? Answers once the bundle question is settled. */
export async function shieldWidgetTexturesAttached() {
  if (!_names.length) return false;
  return !!(await shieldWidgetBundle()) || _names.some(isShieldPng);
}

/** The four archives, for a probe or a pin. */
export const SHIELD_ARCHIVES = Object.freeze([0, 1, 2, 3].map((i) => SHIELD_ARCHIVE_FIRST + i));
export { SHIELD_FRAMES, SHIELD_RECORDS, SHIELD_TEXTURE_COUNT };
