// RRI1 - the install: what RoleplayRealismItemsMod.Awake/InitMod does
// that the port must do once at boot - the template rows and patches
// (ItemHelper.LoadItemTemplates merges the mod's ItemTemplates.json the
// moment the mod is loaded, before any module is read), and the items'
// pictures on the texture-replacement door (in DFU the release's PNGs
// are loose files found by GetItemImage through the item's dye; here,
// OWN-WORK4, our own pictures are built at runtime by rriArt.js, lazy
// and gated on the mod's switch).
//
// A separate module from the law (systems/roleplayRealismItems/rriItems.js) so the law stays
// a leaf: this one imports the template registry that the registry's
// own image law asks the law through.
import { registerCustomTemplates, registerTemplateOverrides } from '../item/itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from '../textureReplacement.js';
import { registerCustomArmorValue } from '../armorMaterials.js';
import { registerSwingSound, SOUND } from '../soundClips.js';
import { classicArt } from '../classicArt.js';
import { rriOwnPicture } from './rriArt.js';
import { RRI_TEMPLATES, RRI_TEMPLATE_PATCHES, RRI_CLASSES, customItemClass, rriEnabled, rriModule, rriSpriteEntries } from './rriItems.js';
// RRI2: the nine modules' delegates and overrides - each checks its own
// switch at the call, so a pane toggle takes effect at the next roll
import { registerItemUseHandler } from '../item/itemTemplates.js';
import { setEnemyEquipmentAssigner } from '../../combat/enemyEquipment.js';
import { assignRriEnemyEquipment } from '../../combat/rriEnemyEquipment.js';
import { setStartingEquipmentAssigner } from '../startingGear.js';
import { setStartingSpellsAssigner } from '../chargen.js';
import { registerWeaponDamageOverride } from '../../characters/weapons.js';
import { registerMeleeWeaponAnimTime } from '../../characters/weaponStates.js';
import { BANDAGE_TEMPLATE, rriWeaponMinDamage, rriWeaponMaxDamage } from './rriRealism.js';
import { useBandage, assignSkillEquipment, assignSkillSpellbook, rriAnimTimeOverride } from './rriKits.js';

let _installed = false;
/** Once: the fourteen rows, the seven patches (while the mod is on at
 *  boot - a patch changes what a minted item weighs and costs, so like
 *  DFU's merge it is read at load, not per frame), and the 280
 *  pictures as lazy, gated vendor entries, each one ours, built at its
 *  first draw. `art` (the classic reader) is the test seam. Returns
 *  how many pictures were registered (0 when already installed). */
export function installRoleplayRealismItems({ art = null, enabledAtBoot = rriEnabled() } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;
  _installed = true;
  registerCustomTemplates(RRI_TEMPLATES);
  registerTemplateOverrides(enabledAtBoot ? RRI_TEMPLATE_PATCHES : []);
  // the two virtuals whose homes are leaves take a registration rather than an import
  registerCustomArmorValue((item) => { const cls = customItemClass(item?.templateIndex); return cls?.materialArmorValue ? cls.materialArmorValue(item) : null; });
  for (const cls of Object.values(RRI_CLASSES)) if (cls.swingSound) registerSwingSound(cls.index, SOUND[cls.swingSound]);
  installRoleplayRealismModules();
  return addVendorTextures(rriSpriteEntries().map((e) => ({
    archive: e.archive, record: e.record, frame: e.frame, dye: e.dye, map: e.map, fileName: e.name,
    // the archives 513-526 exist only as this art (no TEXTURE.513): the
    // stand-in kind (SURV-TENT); the <rect> beside a sprite is where
    // the paper doll puts it, in the doll's own space
    standIn: true, lazy: true, offset: e.rect ? { x: e.rect.x, y: e.rect.y, paperdoll: true } : null,
    build: () => rriOwnPicture(e.name, art ?? classicArt()), selfBuilt: true, gate: rriEnabled,
  })));
}

/** RRI2: InitMod's registrations past the items (RoleplayRealismItemsMod.cs
 *  :91-133) - the bandage's use handler (ItemHelper.RegisterItemUseHandler),
 *  the enemy kit (EnemyEntity.AssignEnemyEquipment), the starting kit and
 *  spellbook (StartGameBehaviour's two delegates), the two damage formulas
 *  and the swing time (FormulaHelper.RegisterOverride). The loot matrix,
 *  the stackable arm, the cost and repair overrides and the shelf hooks
 *  are read at their sites (loot.js, inventory.js, shopStock.js,
 *  repairService.js, worldModes.js) through the same switches. */
export function installRoleplayRealismModules() {
  registerItemUseHandler(BANDAGE_TEMPLATE, useBandage);
  setEnemyEquipmentAssigner(assignRriEnemyEquipment);
  setStartingEquipmentAssigner((entity, opts) => (rriModule('skillBasedStartingEquipment') ? assignSkillEquipment(entity, opts) : null));
  setStartingSpellsAssigner((career, spellsByIndex) => (rriModule('skillBasedStartingSpells') ? assignSkillSpellbook(career, spellsByIndex) : null));
  registerWeaponDamageOverride({ min: rriWeaponMinDamage, max: rriWeaponMaxDamage });
  registerMeleeWeaponAnimTime(rriAnimTimeOverride);
}

/** Test seam. */
export function _resetRoleplayRealismItems() { _installed = false; }
