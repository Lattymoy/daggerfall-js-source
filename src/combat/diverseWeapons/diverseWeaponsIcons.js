// DW3: DIVERSE WEAPONS' ICONS - the inventory (233) and paper-doll (234)
// weapon records in every metal, and the Wabbajack's two (432/433,
// record 25) - registered on the texture-replacement door behind the
// mod's switch.
//
// In DFU the mod's icons are loose files in its texture folder, and
// GetItemImage finds them by the item's dye: TryImportTexture(archive,
// record, 0, item.dyeColor) (ItemHelper.cs:458), the name GetName
// writes (`233_5-0_Elven`; bare for Unchanged, which is what a silver
// weapon's dye is - see characters/dyes.js DYE_NAMES). The port's door
// is systems/textureReplacement.js, keyed the same way since DW3, and
// the icon doors (the GL lists, the DOM screens, the paper doll) ask
// it by the item's dye. OWN-WORK4: each icon is ours, built when an item
// wearing it is first drawn (`lazy`) from the player's own record by our
// metal law (diverseWeaponsArt.js paintIcon), answering only while the
// mod is on (`gate`).
import { addVendorTextures, vendorTextureCount } from '../../systems/textureReplacement.js';
import { DYE_COLORS, dyeToken } from '../../characters/dyes.js';
import { moddedWeaponHUDAnimsEnabled } from './diverseWeapons.js';
import { ownWeaponArt } from './diverseWeaponsArt.js';
import { DIVERSE_WEAPONS_STEMS, DIVERSE_WEAPONS_METALS, DIVERSE_WEAPONS_BARE, LOOKS } from './diverseWeaponsIndex.js';

/** The icon stems in the index: `<archive>_<record>-<frame>`
 *  with a numeric archive, as against a weapon CIF's. */
const ICON_STEM = /^(\d{3})_(\d+)-(\d+)$/;
/** The archives an item of this port draws: the weapons' inventory
 *  (233) and paper-doll (234) archives and the artifact ones (432 male,
 *  433 female - GetArtifactTextureIndices). */
export const ICON_ARCHIVES = Object.freeze([233, 234, 432, 433]);
/** The artifact archives' one record of ours is the Wabbajack's, in its own colour law. */
const ARTIFACT_ARCHIVES = Object.freeze([432, 433]);

/** Every icon the index names, as vendor entries: { archive, record,
 *  frame, dye, fileName, ramp } - `dye` a DyeColors value, or null for the
 *  bare stem (a silver weapon's ask, so the Silver law); `ramp` the colour law
 *  it is painted in. Pure, for the pins. */
export function diverseWeaponsIconEntries(stems = DIVERSE_WEAPONS_STEMS) {
  const out = [];
  for (const [stem, bits] of Object.entries(stems)) {
    const m = ICON_STEM.exec(stem);
    if (!m) continue;
    const archive = Number(m[1]),
      record = Number(m[2]),
      frame = Number(m[3]);
    if (!ICON_ARCHIVES.includes(archive)) continue;
    for (let i = 0; i < DIVERSE_WEAPONS_METALS.length; i++) {
      if (!(bits & (1 << i))) continue;
      const dye = DYE_COLORS[DIVERSE_WEAPONS_METALS[i]];
      // a `_Silver` name can never be asked for (Silver is Unchanged, and
      // GetName prints no dye for it), and keyed by its dye it would be
      // the BARE key - the bare stem's own entry, or a false one
      if (!dyeToken(dye)) continue;
      out.push({
        archive,
        record,
        frame,
        dye,
        fileName: `${stem}_${DIVERSE_WEAPONS_METALS[i]}`,
        ramp: DIVERSE_WEAPONS_METALS[i],
      });
    }
    const bare = ARTIFACT_ARCHIVES.includes(archive) ? LOOKS.WABBAJACK.ramp : 'Silver';
    if (bits & DIVERSE_WEAPONS_BARE) out.push({ archive, record, frame, dye: null, fileName: stem, ramp: bare });
  }
  return out;
}

let _installed = false;
/** Register the icons once. `art` is the test seam (createOwnWeaponArt's
 *  shape); the default reads the player's own files. Returns how many
 *  entries were registered (0 when already installed). */
export function installDiverseWeaponsIcons({ art = null } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0; // once - unless the registry was cleared under it (a test's reset)
  _installed = true;
  // AUDIT-DW F1: `lazy` - an icon is built when an item that wears it
  // is drawn (systems/textureReplacement.js preloadTextureRecord), never
  // 560 at once ahead of the first classic icon. `selfBuilt`: our reader
  // needs no world pipeline (NO-BETHESDA2's door)
  return addVendorTextures(
    diverseWeaponsIconEntries().map(({ ramp, ...e }) => ({
      ...e,
      build: () => (art ?? ownWeaponArt()).icon(e.archive, e.record, ramp),
      selfBuilt: true,
      gate: moddedWeaponHUDAnimsEnabled,
      lazy: true,
    })),
  );
}

/** Test seam. */
export function _resetDiverseWeaponsIcons() {
  _installed = false;
}
