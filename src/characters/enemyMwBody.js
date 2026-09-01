// NPC2: WHICH ENEMIES WEAR A MORROWIND BODY, and what they wear.
//
// The translation from a live Daggerfall enemy to mwActorBody's opts,
// in one home - the same shape weaponRig's armBuildOptsOf gives the
// player, and for the same reason: two copies of "what is this actor
// wearing" is how the card and the frame end up describing different
// characters.
//
// ── WHO QUALIFIES ────────────────────────────────────────────────
//
// The 19 CLASS enemies (128-146) and the four ORC tiers. Both are
// humanoid, both carry rolled equipment, and Morrowind has a body for
// both - orcs are a playable MW race, so an Orc Warlord is an Orsimer
// in his own armour rather than a human in orc-coloured pixels.
//
// VAMPIRES ARE DELIBERATELY OUT, and this is the honest reason: a
// Morrowind vampire is a normal body wearing vampire HEAD parts, which
// this port's body-part resolution does not select. Included, a
// Vampire Ancient would render as an ordinary human - visibly WORSE
// than the classic sprite it replaced. They keep their sprite until
// the vampire head is a resolved part, and the card says so.
//
// BEASTS ARE NOT HERE AT ALL: a rat is not an NPC body but a CREATURE,
// a self-contained model with its own skeleton (OpenMW splits them the
// same way - CreatureAnimation against NpcAnimation). That is NPC2b.
import { MOBILE_TYPES } from './mobileTypes.js';
import { ARMOR_ENUM } from '../combat/enemyEquipment.js';

/** Class enemies occupy 128..146 with no gaps (DaggerfallUnityEnums). */
export const FIRST_CLASS_MOBILE = MOBILE_TYPES.Mage;
export const LAST_CLASS_MOBILE = MOBILE_TYPES.Knight_CityWatch;

/** The four Orc tiers, which are one MW race in four kits. */
export const ORC_MOBILES = Object.freeze([
  MOBILE_TYPES.Orc, MOBILE_TYPES.OrcSergeant, MOBILE_TYPES.OrcShaman, MOBILE_TYPES.OrcWarlord,
]);

/**
 * THE PORT DECISION, DECLARED. Daggerfall gives a class enemy no race
 * at all - the sprite is per class, not per people - so a Morrowind
 * body has to be told which one to wear. Breton is the choice: it is
 * the Iliac Bay's own people and it is already this port's default
 * race everywhere a race is missing (chargen, classicSave). It is a
 * PREFERENCE, not a law, and it lives here as one name so a later
 * slice can vary it per region without hunting for the literal.
 */
export const DEFAULT_ENEMY_RACE = 'breton';
/** Orcs are the one enemy whose race Daggerfall does tell us. */
export const ORC_RACE = 'orc';

/** Does this enemy wear a Morrowind NPC body at all? */
export function isMwHumanoid(mobileType) {
  if (mobileType >= FIRST_CLASS_MOBILE && mobileType <= LAST_CLASS_MOBILE) return true;
  return ORC_MOBILES.includes(mobileType);
}

/** The MW race this enemy wears. */
export function enemyMwRace(mobileType) {
  return ORC_MOBILES.includes(mobileType) ? ORC_RACE : DEFAULT_ENEMY_RACE;
}

/**
 * The worn set, from what AssignEnemyStartingEquipment actually rolled
 * for this enemy - so the armour you SEE is the armour whose material
 * the damage maths already uses. `armorPieces` is the roll's own list
 * ({piece, material, shield}); composeWornArmor wants
 * {templateIndex, material}.
 *
 * A shield is worn like any other piece: the composer resolves it
 * through getShieldMesh's ladder (IG3), which is the one worn slot
 * whose ladder may end at the item's ground mesh.
 */
export function enemyWornPieces(entity) {
  const rolled = entity?.armorPieces;
  if (!Array.isArray(rolled)) return [];
  return rolled
    .filter((a) => a && a.piece != null && a.piece <= ARMOR_ENUM.Tower_Shield)
    .map((a) => ({ templateIndex: a.piece, material: a.material ?? 0 }));
}

/**
 * The whole opts object mwActorBody takes, from a live enemy.
 * Answers null for anyone who does not wear one, so the caller keeps
 * its classic sprite by the same test it already makes.
 */
export function enemyMwBodyOpts(entity, mobileType, gender = 'male') {
  if (!isMwHumanoid(mobileType)) return null;
  return {
    race: enemyMwRace(mobileType),
    // The sex is REAL - MobileUnit.resolveGender rolls it off DFU's own
    // DFRandom stream (NT2/F210), so a female Nightblade is female here
    // for the same reason her sprite is.
    female: gender === 'female',
    faceIndex: 0,
    worn: enemyWornPieces(entity),
    weapon: entity?.weapon ?? null,
    hasAmmo: false,
  };
}
