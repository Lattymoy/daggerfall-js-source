// The survival items' pictures on the texture door - apart from items.js, whose rules the account Worker bundles: these
// reach the player's classic files (systems/classicArt.js), which a Worker never holds (NO-BETHESDA2/3, test/server/
// accountdeploy.test.js walks the bundle).
import { addVendorTextures, vendorTextureCount } from '../textureReplacement.js';
import { rebuiltPicture } from '../rebuiltPicture.js';   // NO-BETHESDA2: a picture that is Daggerfall's own, built from the player's files
import { rotPicture, MOULDY } from './rotPicture.js';
import { survivalPicture } from './survivalArt.js';   // OWN-WORK4: the pictures we paint
import { VENDOR_ICON_FILES } from './food.js';
import DERIVED_ICONS from './derivedIcons.json' with { type: 'json' };

/** SURV-TENT: the tent's two reskins - records of REAL archives (TEXTURE.050 record 7, the canvas; TEXTURE.067 record
 *  10, the pole), so they register WITHOUT `standIn` and the pipeline swaps only these two records. */
export const VENDOR_TENT_FILES = Object.freeze(['50_7-0', '67_10-0']);
/** NO-BETHESDA2 (2026-10-31): the pictures that are Daggerfall's own records alone - the tent's two (TEXTURE.050
 *  record 7, TEXTURE.067 record 10; derivedIcons.json). OWN-WORK4 took out the mouldy bread, whose spec carried the
 *  author's mould, and OWN-AUDIT (2026-11-01) the mouldy cooked fish, which was the plain fish. Or null. */
export const derivedIconSpec = (name) => (Object.hasOwn(DERIVED_ICONS, name) ? DERIVED_ICONS[name] : null);
const own = (spec) => Object.freeze({ ...spec, ...(spec.from ? { from: Object.freeze(spec.from) } : {}) });
const FOOD = (archive, from) => [
  [`${archive}_0-0`, own({ from, pal: 'PAL.PAL', seed: archive * 10, mouldy: true })],
  [`${archive}_1-0`, own({ from, pal: 'PAL.PAL', seed: archive })],
];
/** OUR OWN PICTURES (NO-BETHESDA3, the rotten cooked fish; OWN-WORK4 the rest - the owner: "A proper 1 to 1 recreation
 *  for everything"). A spoiled face is our rot (rotPicture.js, our seed; `mouldy` the first stage) over the fresh
 *  food - the player's own picture of it (`from`, in PAL.PAL) or one we paint (`paint`, survivalArt.js). Raw meat
 *  and the waterskin are painted whole. No pixel of the retired release is read. */
export const OWN_ICONS = Object.freeze(
  Object.fromEntries([
    ...FOOD(532, [213, 1, 0]),
    ...FOOD(533, [213, 0, 0]),
    ...FOOD(534, [211, 31, 0]),
    ...FOOD(535, [211, 9, 0]),
    ...FOOD(536, [211, 10, 0]),   // OWN-AUDIT (2026-11-01): the mouldy cooked fish is our mould too, not the plain fish
    ...FOOD(537, [211, 40, 0]),
    ['538_0-0', own({ paint: '538_2-0', seed: 5380, mouldy: true })],
    ['538_1-0', own({ paint: '538_2-0', seed: 538 })],
    ['538_2-0', own({ paint: '538_2-0' })],
    ['539_0-0', own({ paint: '539_0-0' })],
  ]),
);
export const ownIconSpec = (name) => (Object.hasOwn(OWN_ICONS, name) ? OWN_ICONS[name] : null);
/** Our picture `name`: the fresh picture (painted, or built through `art`, the session's classic reader by default),
 *  spoiled by our rot where the spec says a stage. */
export async function ownIconPicture(name, art) {
  const o = OWN_ICONS[name];
  const fresh = o.paint ? survivalPicture(o.paint) : await rebuiltPicture({ from: o.from, pal: o.pal }, art);
  return o.seed == null ? fresh : rotPicture(fresh, { seed: o.seed, ...(o.mouldy ? MOULDY : {}) });
}
let _iconsInstalled = false;
/** Every picture is built, none fetched: a rebuilt one through the session's classic reader (its spec's own palette -
 *  the texture door's `build(ctx)` context reads ART_PAL alone), our own the same way or painted. */
const vendorEntry = (f, standIn, art) => {
  const m = /^(\d+)_(\d+)-(\d+)$/.exec(f), spec = derivedIconSpec(f);
  const at = { archive: Number(m[1]), record: Number(m[2]), frame: Number(m[3]), fileName: f, standIn, selfBuilt: true };
  return { ...at, build: ownIconSpec(f) ? () => ownIconPicture(f, art) : () => rebuiltPicture(spec, art) };
};
/** Register the survival pictures with the texture pipeline (once; a test may pass `art`, its own classic reader).
 *  The icons are archives that exist ONLY as this art (`standIn`); the tent's two are records of real archives. */
export function installSurvivalIcons({ art = undefined } = {}) {
  if (_iconsInstalled && vendorTextureCount() > 0) return 0;   // once - unless the registry was cleared under it (a test's reset)
  _iconsInstalled = true;
  return addVendorTextures([
    ...VENDOR_ICON_FILES.map((f) => vendorEntry(f, true, art)),
    ...VENDOR_TENT_FILES.map((f) => vendorEntry(f, false, art)),
  ]);
}
