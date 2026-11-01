// DW1: DIVERSE WEAPONS' TEXTURES. OWN-WORK4 (2026-10-31; the owner: "no latching onto other mod authors"): the set
// that comes with the game is our own, built at runtime from the player's classic WEAPON*.CIF and TEXTURE records by
// our looks (combat/diverseWeapons/diverseWeaponsArt.js) - by the names DFU asks for, TextureReplacement.GetNameCifRci's
// `<prefix><FILE>_<record>-<frame>_<Metal>` (TextureReplacement.cs:783-801). Diverse Weapons 1.7.3's own sprites
// (RealAKP) are no longer carried. A player's own copy of the mod, attached through the textures pick, still answers
// first - its bundle by GUID, or a loose PNG of a name - as TryImportCifRci reads one in DFU.
import { openUnityBundle } from '../../formats/unity/unityBundleClient.js'; // the open runs in a worker (~10 s of LZ4 for this bundle); this thread when there is none
import { toScreenOrder } from '../../formats/color32Order.js'; // DWHD1: EVERY arm keeps its rows - a screen quad, and the bundle reader already answers top-first
import { decodePng } from '../../systems/textureReplacement.js';
import { DFMOD_KEY_PREFIX } from '../../systems/seasonsIliacBayAssets.js'; // the stored-name prefix the texture pick writes for a bundle - one home
import { weaponWidgetImage } from '../weapon/weaponWidgetAssets.js';
import { dfmodCifRciNamed } from '../../systems/dfmodTextures.js'; // DFMOD2: an attached mod's handheld frames, after the two weapon mods
import { moddedWeaponHUDAnimsEnabled } from './diverseWeapons.js';
import { ownWeaponArt } from './diverseWeaponsArt.js'; // OWN-WORK4: our frames, from the player's files
import { DIVERSE_WEAPONS_STEMS, DIVERSE_WEAPONS_METALS, DIVERSE_WEAPONS_BARE } from './diverseWeaponsIndex.js';

export const DIVERSE_WEAPONS_MOD = Object.freeze({
  guid: '8e83d67c-a0ac-4935-a8c5-6b18c9f35bfc',
  title: 'Diverse Weapons',
  version: '1.7.3',
  author: 'RealAKP',
});

// DWHD1: not the HD replacers ("Diverse Weapons HD - ...") - they are texture mods the generic door reads; this door
// opened each one whole only to find its GUID was not RealAKP's
const isDiverseDfmod = (name) =>
  /\.dfmod$/i.test(name) &&
  /diverse.?weapons/i.test(name.slice(name.lastIndexOf('/') + 1)) &&
  !/\bhd\b/i.test(name.slice(name.lastIndexOf('/') + 1));
const isPng = (name) => /\.png$/i.test(name);
/** The mod's own spellings for a loose PNG: a per-weapon CIF name with
 *  or without the `w_` prefix (`LONGSWORD.CIF_0-0_Iron.png`), or an
 *  icon archive with a metal suffix (`233_5-0_Elven.png`). */
const isDiversePng = (name) => {
  const base = name.slice(name.lastIndexOf('/') + 1);
  return /^(w_)?[A-Z0-9]+\.CIF_\d+-\d+(_[A-Za-z]+)?\.png$/i.test(base) || /^\d{3}_\d+-\d+_[A-Za-z]+\.png$/i.test(base);
};

// ---- OWN-WORK4: our set ------------------------------------------------

/** Does our set answer this name? A stem (`LONGSWORD.CIF_0-0`) with a bit per metal in MetalTypes' order, bit 10 for
 *  the bare stem (diverseWeaponsIndex.js). No build is started for a name this answers false to. */
export function hasDiverseWeaponsSprite(name) {
  if (typeof name !== 'string') return false;
  const m = /^(.*?_\d+-\d+)(?:_([A-Za-z]+))?$/.exec(name);
  const bits = m ? DIVERSE_WEAPONS_STEMS[m[1]] : 0;
  if (!bits) return false;
  if (m[2] === undefined) return (bits & DIVERSE_WEAPONS_BARE) !== 0;
  const i = DIVERSE_WEAPONS_METALS.indexOf(m[2]);
  return i >= 0 && (bits & (1 << i)) !== 0;
}

/** How many names our set answers. */
export const DIVERSE_WEAPONS_SPRITE_COUNT = Object.values(DIVERSE_WEAPONS_STEMS).reduce(
  (n, b) => n + (b.toString(2).split('1').length - 1),
  0,
);

// ---- the registry ----------------------------------------------------

let _names = [];
let _load = null;
let _bundle = null; // Promise<{ bundle, manifest, byName } | null>
let _images = new Map(); // texture name -> Promise<image | null>, the attached arms
let _own = new Map(); // texture name -> Promise<image | null>, our set (OWN-WORK4)
let _art = null; // test seam: the reader our frames are built through
let _workerFactory = null; // test seam: a fake Worker, or a factory that throws (the same-thread fallback)

/** Register the stored names and a `load(name) -> bytes` loader (the
 *  texture pick's own). Returns how many entries could carry this mod's
 *  textures: its bundle and any loose PNG spelt as it asks. */
export function setDiverseWeaponsSources(fileNames, load, { workerFactory = null } = {}) {
  const names = (fileNames ?? []).filter(
    (n) => (n.startsWith(DFMOD_KEY_PREFIX) && isDiverseDfmod(n)) || (isPng(n) && isDiversePng(n)),
  );
  const loader = typeof load === 'function' ? load : null;
  const same =
    loader === _load &&
    names.length === _names.length &&
    names.every((n, i) => n === _names[i]) &&
    workerFactory === _workerFactory;
  _names = names;
  _load = loader;
  _workerFactory = workerFactory;
  if (!same) forgetBundle();
  return _names.length;
}
/** Drop the open bundle (and its worker, when it has one) and the name cache. */
function forgetBundle() {
  const old = _bundle;
  _bundle = null;
  _images = new Map();
  old?.then((b) => b?.bundle.close()).catch(() => null);
}
export const clearDiverseWeaponsSources = () => setDiverseWeaponsSources([], null);
export const diverseWeaponsSourcesCount = () => _names.length;

function manifestOf(bundle) {
  for (const t of bundle?.textAssets ?? []) {
    if (!/\.dfmod$/i.test(t.name)) continue;
    try {
      return JSON.parse(t.text);
    } catch {
      /* not this one */
    }
  }
  return null;
}

/** The mod's bundle, found by GUID (then title) among the stored
 *  bundles, opened once - in a worker, formats/unity/unityBundleClient.js:
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
          const bundle = await openUnityBundle(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), {
            workerFactory: _workerFactory,
          });
          const manifest = manifestOf(bundle);
          if (!manifest) {
            bundle.close();
            continue;
          }
          if (manifest.GUID === DIVERSE_WEAPONS_MOD.guid || manifest.ModTitle === DIVERSE_WEAPONS_MOD.title) {
            if (manifest.ModVersion && String(manifest.ModVersion) !== DIVERSE_WEAPONS_MOD.version)
              console.warn(
                `[diverse weapons] the bundle is ${manifest.ModTitle} ${manifest.ModVersion}; the port carries ${DIVERSE_WEAPONS_MOD.version}'s script`,
              );
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
export async function diverseWeaponsTexturesAttached() {
  return !!(await diverseWeaponsBundle());
}

/** One texture by name - `{ width, height, colors }` in screen order, the shape renderer.uploadTexture reads - or null
 *  when neither the player's attached copy nor our set answers it. Each arm is cached per name, misses included. A
 *  decoded PNG and the bundle reader are top-first already and keep their rows (WW3, HT3). OWN-WORK4: our set answers
 *  only while the mod is on, built through `art` (the session's own reader of the player's files), never fetched. */
export async function diverseWeaponsImage(
  name,
  { decode = decodePng, art = undefined, enabled = moddedWeaponHUDAnimsEnabled() } = {},
) {
  if (_names.length) {
    if (!_images.has(name)) _images.set(name, attachedImage(name, decode)); // nothing attached: no bundle walk
    const attached = await _images.get(name);
    if (attached) return attached;
  }
  if (!enabled || !hasDiverseWeaponsSprite(name)) return null;
  if (!_own.has(name)) _own.set(name, ownImage(name, art ?? _art ?? ownWeaponArt()));
  return _own.get(name);
}

/** Our frame of `name`, or null - said once - where the player's files will not build it: the classic frame draws. */
async function ownImage(name, art) {
  try {
    const pic = await art.frame(name);
    return pic ? toScreenOrder(pic) : null;
  } catch (e) {
    console.warn(`[diverse weapons] ${name} would not build from the player's files:`, e?.message ?? e);
    return null;
  }
}

/** Test seam: the reader our frames are built through (createOwnWeaponArt's shape), the built ones forgotten. */
export function setDiverseWeaponsArt(art) {
  _art = art ?? null;
  _own = new Map();
}

/** The attached arms: the player's bundle, then a loose PNG of the name. */
async function attachedImage(name, decode) {
  const b = await diverseWeaponsBundle();
  if (b?.byName.has(name)) {
    // the pixels cross from the worker per ask (one transfer). DWHD1 (a player: "all weapons are overhead"): NOT
    // flipped - unityBundle.decodeTexture2D already turns Unity's bottom-up rows top-first, the order a decoded PNG
    // has, and this is a SCREEN quad (HT3's rule). The flip here drew every bundle frame upside down.
    try {
      const img = await b.bundle.rgba(name);
      if (img) return toScreenOrder(img);
    } catch (e) {
      console.warn(`[diverse weapons] ${name} would not decode:`, e?.message ?? e);
    }
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
  // DWHD1: a player-attached texture mod FIRST - Diverse Weapons HD is a replacer for the sprites the two weapon doors
  // (and our own Diverse Weapons set) would otherwise answer with
  return (await dfmodWeaponImage(name)) ?? (await weaponModImage(name));
}
/** The two weapon mods' arms, in their order. */
async function weaponModImage(name) {
  return (await diverseWeaponsImage(name)) ?? (await weaponWidgetImage(name)) ?? null;
}
/** DFMOD2: a player-attached texture mod's frame of the name (DREAM's handhelds, Diverse Weapons HD). DWHD1: top-first,
 *  a screen quad's order - the flip this used drew every such frame upside down. */
async function dfmodWeaponImage(name) {
  try {
    const img = await dfmodCifRciNamed(name);
    return img ? toScreenOrder(img) : null;
  } catch {
    return null;
  }
}

/** Test seam: forget the name caches without touching the sources. */
export function _resetDiverseWeaponsImages() {
  forgetBundle();
  _own = new Map();
}
