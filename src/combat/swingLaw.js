// @ts-check
// SWING-LAW (2026-09-28, Mac: "swing speed is insane", then "Do whatever is the most detailed. I dont care about departure,
// especially if we can do it better"): THE WEAPON IN THE HAND, AS THE SWING LAW READS IT. characters/weaponStates.js holds
// the law (swingFrameSeconds - the tempo of the wielder's Speed, the heft of the weapon's weight against their Strength,
// the handling of its kind) and is a leaf, so what it needs of the player is read here and registered: the held item
// off the equip table - the hand the swing is in (`ctx.usingRightHand`, AUDIT-RR F1's ctx) - its template's base weight
// and whether it takes both hands, and the live Strength. Bare hands and a beast's claws weigh nothing.
//
// Not a DFU member. Ledger A (SWING-LAW).
import { registerSwingReader } from '../characters/weaponStates.js';
import { WEAPON_TYPES } from './fpsWeapon.js';
import { EQUIP_SLOTS } from '../systems/equip.js';
import { getItemHands, ITEM_HANDS } from '../characters/equipTable.js';
import { templateByIndex } from '../systems/item/itemTemplates.js';
import { liveStat } from '../systems/statMods.js';
import { techniqueFamily } from './technique/techniqueRoster.js';   // BAL10, MARTIAL2: the family a swing is made with (its skill's, an RRI class's own)

/**
 * What the swing law reads of a swing's wielder, or null without one.
 * @param {{entity?: any, weaponType?: number, usingRightHand?: boolean}|null} ctx
 * BAL10 / MARTIAL2: and the FAMILY the swing is made with (combat/technique/techniqueRoster.js techniqueFamily - the
 * skill it swings with; 'handToHand' bare, null for the beast's claws), and whether that is a short blade (the dagger's
 * handling, characters/weaponStates.js SWING_SHORT_BLADE).
 * @returns {{weaponType: number, weight: number, strength: number, twoHanded: boolean, family: string|null, shortBlade: boolean}|null}
 */
export function readSwing(ctx) {
  const entity = ctx?.entity;
  if (!entity) return null;
  const weaponType = Number.isInteger(ctx.weaponType) ? ctx.weaponType : WEAPON_TYPES.Melee;
  const item = handItem(entity, ctx);
  const bare = !item || weaponType === WEAPON_TYPES.Melee || weaponType === WEAPON_TYPES.Werecreature;
  const family = familyOf(weaponType, item, bare);
  return {
    weaponType,
    weight: bare ? 0 : (templateByIndex(item.templateIndex)?.baseWeight ?? 0),
    strength: liveStat(entity, 'strength'),
    twoHanded: !bare && getItemHands(item) === ITEM_HANDS.Both,
    family,
    shortBlade: family === 'shortBlade',
  };
}

// AUDIT PRE-MERGE 0929 S6: read WITHOUT materialising - `equipTableOf` is `entity.equip ??= createEquipTable()`, and a
// reader that grew an empty table on an entity with none handed combat/weapon/weaponRig.js's syncWorn that table, which nulls
// the hand's weapon (the rig's shieldItem names the same trap; the unsheathe went silent). The shape syncWorn reads.
const handItem = (entity, ctx) => entity.equip?.slots?.[ctx.usingRightHand === false ? EQUIP_SLOTS.LeftHand : EQUIP_SLOTS.RightHand] ?? null;
const familyOf = (weaponType, item, bare) => (weaponType === WEAPON_TYPES.Werecreature ? null : bare ? 'handToHand' : techniqueFamily(item));
/** The swing's family alone (readSwing's `family`), read with no record built - AUDIT MARTIAL L2 F3: the Short Blade's
 *  pace asks it every frame of a swing (systems/weaponMastery.js). */
export function swingFamily(ctx) {
  const entity = ctx?.entity;
  if (!entity) return null;
  const weaponType = Number.isInteger(ctx.weaponType) ? ctx.weaponType : WEAPON_TYPES.Melee;
  const item = handItem(entity, ctx);
  return familyOf(weaponType, item, !item || weaponType === WEAPON_TYPES.Melee || weaponType === WEAPON_TYPES.Werecreature);
}

/** Register the reader. AUDIT PRE-MERGE 0929 S5: it was registered only inside scenes/shared.js ensureAudio, and a rig
 *  built without that boot - a probe, a suite, AUDIT DISC28 AR-4's own - silently swung with no weight and no second
 *  hand in the law (its saber ticked 0.199 s for the reader's 0.210), where "the law reads the weapon in the hand". Now
 *  this module registers it as it loads, and combat/weapon/weaponRig.js - the one maker of a swing's ctx - imports it, so no
 *  rig exists without it. Kept for a caller that cleared the reader and wants it back. */
export function installSwingLaw() { registerSwingReader(readSwing); }
installSwingLaw();
