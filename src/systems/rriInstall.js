// RRI1 - the install: what RoleplayRealismItemsMod.Awake/InitMod does
// that the port must do once at boot - the template rows and patches
// (ItemHelper.LoadItemTemplates merges the mod's ItemTemplates.json the
// moment the mod is loaded, before any module is read), and the mod's
// art on the texture-replacement door (in DFU the PNGs are loose files
// in the mod's Textures folder, found by GetItemImage through the
// item's dye; here they ship under public/art/roleplay-realism-items/,
// as Diverse Weapons' icons do, lazy and gated on the mod's switch).
//
// A separate module from the law (systems/rriItems.js) so the law stays
// a leaf: this one imports the template registry that the registry's
// own image law asks the law through.
import { registerCustomTemplates, registerTemplateOverrides } from './itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from './textureReplacement.js';
import { registerCustomArmorValue } from './armorMaterials.js';
import { registerSwingSound, SOUND } from './soundClips.js';
import { APP_ROOT } from './appRoot.js';
import { RRI_TEMPLATES, RRI_TEMPLATE_PATCHES, RRI_CLASSES, customItemClass, rriEnabled, rriSpriteEntries } from './rriItems.js';

/** The shipped sprite's URL - `<root>/art/roleplay-realism-items/<name>.png`. */
export const rriSpriteUrl = (name, root = APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/') =>
  new URL(`art/roleplay-realism-items/${encodeURIComponent(name)}.png`, root).href;

let _installed = false;
/** Once: the fourteen rows, the twenty patches (while the mod is on at
 *  boot - a patch changes what a minted item weighs and costs, so like
 *  DFU's merge it is read at load, not per frame), and the 280
 *  sprites as lazy, gated vendor entries. `fetchBytes(name)` is the
 *  test seam. Returns how many sprites were registered (0 when already
 *  installed). */
export function installRoleplayRealismItems({ fetchBytes = null, enabledAtBoot = rriEnabled() } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;
  _installed = true;
  registerCustomTemplates(RRI_TEMPLATES);
  registerTemplateOverrides(enabledAtBoot ? RRI_TEMPLATE_PATCHES : []);
  // the two virtuals whose homes are leaves take a registration rather than an import
  registerCustomArmorValue((item) => { const cls = customItemClass(item?.templateIndex); return cls?.materialArmorValue ? cls.materialArmorValue(item) : null; });
  for (const cls of Object.values(RRI_CLASSES)) if (cls.swingSound) registerSwingSound(cls.index, SOUND[cls.swingSound]);
  const load = fetchBytes ?? (async (name) => { const r = await fetch(rriSpriteUrl(name)); if (!r.ok) throw new Error(`${name}: ${r.status}`); return new Uint8Array(await r.arrayBuffer()); });
  return addVendorTextures(rriSpriteEntries().map((e) => ({
    archive: e.archive, record: e.record, frame: e.frame, dye: e.dye, map: e.map, fileName: e.name,
    // the archives 513-526 exist only as this art (no TEXTURE.513): the
    // stand-in kind (SURV-TENT); the <rect> beside a sprite is where
    // the paper doll puts it, in the doll's own space
    standIn: true, lazy: true, offset: e.rect ? { x: e.rect.x, y: e.rect.y, paperdoll: true } : null,
    load, gate: rriEnabled,
  })));
}

/** Test seam. */
export function _resetRoleplayRealismItems() { _installed = false; }
