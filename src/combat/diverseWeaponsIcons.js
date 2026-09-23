// DW3: DIVERSE WEAPONS' ICONS - the inventory (233) and paper-doll (234)
// weapon records in every metal, and the Wabbajack's two (432/433,
// record 25) - registered on the texture-replacement door as the port's
// own vendored art, behind the mod's switch.
//
// In DFU the mod's icons are loose files in its texture folder, and
// GetItemImage finds them by the item's dye: TryImportTexture(archive,
// record, 0, item.dyeColor) (ItemHelper.cs:458), the name GetName
// writes (`233_5-0_Elven`; bare for Unchanged, which is what a silver
// weapon's dye is - see characters/dyes.js DYE_NAMES). The port's door
// is systems/textureReplacement.js, keyed the same way since DW3, and
// the icon doors (the GL lists, the DOM screens, the paper doll) ask
// it by the item's dye. So this is a registration and nothing else:
// which names, from the shipped index (combat/diverseWeaponsIndex.js),
// each loaded from public/art/diverse-weapons/ when its archive is
// first drawn, and answering only while the mod is on (`gate`).
import { addVendorTextures, vendorTextureCount } from '../systems/textureReplacement.js';
import { DYE_COLORS, dyeToken } from '../characters/dyes.js';
import { moddedWeaponHUDAnimsEnabled } from './diverseWeapons.js';
import { diverseWeaponsSpriteUrl } from './diverseWeaponsAssets.js';
import { DIVERSE_WEAPONS_STEMS, DIVERSE_WEAPONS_METALS, DIVERSE_WEAPONS_BARE } from './diverseWeaponsIndex.js';

/** The icon stems in the shipped index: `<archive>_<record>-<frame>`
 *  with a numeric archive, as against a weapon CIF's. */
const ICON_STEM = /^(\d{3})_(\d+)-(\d+)$/;
/** The archives an item of this port draws: the weapons' inventory
 *  (233) and paper-doll (234) archives and the artifact ones (432 male,
 *  433 female - GetArtifactTextureIndices). The index also names 513
 *  and 514, Roleplay & Realism: Items' own custom-weapon archives; no
 *  template here has them, so nothing would ask, and they are not
 *  registered against archives that do not exist. */
export const ICON_ARCHIVES = Object.freeze([233, 234, 432, 433]);

/** Every icon the index names, as vendor entries: { archive, record,
 *  frame, dye, fileName } - `dye` a DyeColors value, or null for the
 *  bare stem. Pure, for the pins. */
export function diverseWeaponsIconEntries(stems = DIVERSE_WEAPONS_STEMS) {
  const out = [];
  for (const [stem, bits] of Object.entries(stems)) {
    const m = ICON_STEM.exec(stem);
    if (!m) continue;
    const archive = Number(m[1]), record = Number(m[2]), frame = Number(m[3]);
    if (!ICON_ARCHIVES.includes(archive)) continue;
    for (let i = 0; i < DIVERSE_WEAPONS_METALS.length; i++) {
      if (!(bits & (1 << i))) continue;
      const dye = DYE_COLORS[DIVERSE_WEAPONS_METALS[i]];
      // a `_Silver` file can never be asked for (Silver is Unchanged, and
      // GetName prints no dye for it), and keyed by its dye it would be
      // the BARE key - the bare stem's own entry, or a false one
      if (!dyeToken(dye)) continue;
      out.push({ archive, record, frame, dye, fileName: `${stem}_${DIVERSE_WEAPONS_METALS[i]}` });
    }
    if (bits & DIVERSE_WEAPONS_BARE) out.push({ archive, record, frame, dye: null, fileName: stem });
  }
  return out;
}

let _installed = false;
/** Register the icons once. `fetchBytes(name)` is the test seam; the
 *  default fetches the shipped PNG by name. Returns how many entries
 *  were registered (0 when already installed). */
export function installDiverseWeaponsIcons({ fetchBytes = null } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;   // once - unless the registry was cleared under it (a test's reset)
  _installed = true;
  const load = fetchBytes ?? (async (name) => { const r = await fetch(diverseWeaponsSpriteUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  return addVendorTextures(diverseWeaponsIconEntries().map((e) => ({ ...e, load, gate: moddedWeaponHUDAnimsEnabled })));
}

/** Test seam. */
export function _resetDiverseWeaponsIcons() { _installed = false; }
