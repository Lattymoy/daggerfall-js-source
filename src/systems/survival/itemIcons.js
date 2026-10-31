// The survival items' pictures on the texture door - apart from items.js, whose rules the account Worker bundles: these
// reach the player's classic files (systems/classicArt.js), which a Worker never holds (NO-BETHESDA2/3, test/server/
// accountdeploy.test.js walks the bundle).
import { addVendorTextures, vendorTextureCount } from '../textureReplacement.js';
import { rebuiltPicture } from '../rebuiltPicture.js';   // NO-BETHESDA2: a picture that is Daggerfall's own, built from the player's files
import { rotPicture } from './rotPicture.js';   // NO-BETHESDA3: our own rot, over the player's own picture
import { VENDOR_ICON_FILES } from './food.js';
import DERIVED_ICONS from '../../../vendor/climates-calories/derived.json' with { type: 'json' };

/** SURV-TENT: the tent's two reskins - records of REAL archives (TEXTURE.050 record 7, the canvas; TEXTURE.067 record
 *  10, the pole), so they register WITHOUT `standIn` and the pipeline swaps only these two records. */
export const VENDOR_TENT_FILES = Object.freeze(['50_7-0', '67_10-0']);
export const vendorIconUrl = (name) => new URL(`../../../vendor/climates-calories/Textures/${name}.png`, import.meta.url).href;
/** NO-BETHESDA2 (2026-10-31): the mod's pictures that are Daggerfall's own - the tent's two (TEXTURE.050 record 7,
 *  TEXTURE.067 record 10), the mouldy bread over TEXTURE.211 record 31 and the mouldy cooked fish, record 10 itself
 *  (vendor/climates-calories/derived.json). The spec for `name`, or null where the picture is the author's own file. */
export const derivedIconSpec = (name) => (Object.hasOwn(DERIVED_ICONS, name) ? DERIVED_ICONS[name] : null);
/** NO-BETHESDA3 (2026-10-31; the owner: "Drop the rotten fish icon", "Also rebuild the rotten fish ourself"): our own
 *  pictures. The rotten cooked fish is our rot (rotPicture.js, our seed) over the player's cooked fish, TEXTURE.211
 *  record 10 in PAL.PAL as the mouldy one is. The mod's re-shade is not carried and no pixel of it is read. */
export const OWN_ICONS = Object.freeze({ '536_1-0': Object.freeze({ from: Object.freeze([211, 10, 0]), pal: 'PAL.PAL', seed: 536 }) });
export const ownIconSpec = (name) => (Object.hasOwn(OWN_ICONS, name) ? OWN_ICONS[name] : null);
/** Our picture `name`, built through `art` (the session's classic reader by default). */
export async function ownIconPicture(name, art) {
  const own = OWN_ICONS[name];
  return rotPicture(await rebuiltPicture({ from: own.from, pal: own.pal }, art), { seed: own.seed });
}
let _iconsInstalled = false;
/** A picture rebuilt is built through the session's classic reader (its spec's own palette - the texture door's
 *  `build(ctx)` context reads ART_PAL alone), our own the same way, every other one fetched. */
const vendorEntry = (f, load, standIn, art) => {
  const m = /^(\d+)_(\d+)-(\d+)$/.exec(f), spec = derivedIconSpec(f);
  const at = { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]), fileName: f, standIn };
  if (ownIconSpec(f)) return { ...at, build: () => ownIconPicture(f, art), selfBuilt: true };
  return { ...at, ...(spec ? { build: () => rebuiltPicture(spec, art), selfBuilt: true } : { load: () => load(f) }) };
};
/** Register the mod's own art with the texture pipeline (once; a test
 *  may pass its own fetch, and `art`, its own classic reader). The icons are archives that exist ONLY as
 *  this art (`standIn`); the tent's two are records of real archives. */
export function installSurvivalIcons({ fetchBytes = null, art = undefined } = {}) {
  if (_iconsInstalled && vendorTextureCount() > 0) return 0;   // once - unless the registry was cleared under it (a test's reset)
  _iconsInstalled = true;
  const load = fetchBytes ?? (async (name) => { const r = await fetch(vendorIconUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  return addVendorTextures([
    ...VENDOR_ICON_FILES.map((f) => vendorEntry(f, load, true, art)),
    ...VENDOR_TENT_FILES.map((f) => vendorEntry(f, load, false, art)),
  ]);
}
