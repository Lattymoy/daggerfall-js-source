// THE WEAPONS MORROWIND DOES NOT HAVE.
//
// FIELD-GUN-MW2 (2026-09-20, Mac: "texturing and rigging this for the
// morrowind model"). The Morrowind first-person lane resolves a held
// weapon in two steps: `dfWeaponToMw` turns a Daggerfall item into a
// Morrowind weapon TYPE, and `pickWeaponRecord` finds a record of that
// type in the PLAYER'S OWN records. Both steps are right, and for the
// Dwarven Thunderlock both are unanswerable:
//
//   - `dfWeaponToMw` walks `characters/weapons.js`'s WEAPONS, which is
//     DFU's frozen eighteen. Template 560 is registered at RUNTIME by
//     `registerCustomTemplates` and is not in it, so the lookup returns
//     MW_WEAPON_TYPE.None.
//   - and even if it did not, no search token finds a dwemer firearm in
//     data that has none. Morrowind has no gun.
//
// So `resolveWeaponParts` fell to its last arm, pushed the note
// "weapon: Morrowind has no weapon type for what you are holding", and
// the arm drew EMPTY HANDS.
//
// ═══ WHY THIS IS A TABLE AND NOT A BRANCH ═════════════════════════
//
// The fix that suggests itself is an `if (isThunderlock(...))` inside
// the resolve. It would work once. This is a DOOR instead - "which of
// the port's own models does this item wear, if any" - because the
// Thunderlock is explicitly not meant to be the last of its kind (it is
// "THE FIRST ONE OF ITS KIND", systems/thunderlock.js's own header),
// and the second one must not be a second branch in somebody else's
// function.
//
// ═══ A LEAF, FOR THE SAME REASON thunderlockIds.js IS ═════════════
//
// One import, and it is the leaf that exists precisely so this kind of
// lookup cannot close a cycle. `src/formats/mwItemMap.js` and
// `src/combat/fpArm.js` are both askers and both sit upstream of
// everything `systems/thunderlock.js` touches.
import { THUNDERLOCK_TEMPLATE } from './thunderlockIds.js';

/**
 * The port's own Morrowind-format models, by template index.
 *
 * `model` is a data-files path exactly as a Morrowind record's would be
 * - `resolveWeaponParts` prefixes `meshes/` to a record's model and
 * this takes the same prefix, so the two go down ONE path - and the
 * file itself is shipped by `systems/ownMwAssets.js`.
 *
 * `bone` is the skeleton bone it hangs on. "Weapon Bone" rather than
 * the typed left/right pair, because the typed names belong to
 * Morrowind's own weapon types (MW-D32 / npcanimation.cpp:787-795) and
 * this weapon has none - and "Weapon Bone" is the reference's own
 * fallback, present on every rig, which is exactly what an item with no
 * type should land on.
 */
export const OWN_MW_MODELS = Object.freeze({
  [THUNDERLOCK_TEMPLATE]: Object.freeze({
    model: 'thunderlock.nif',
    bone: 'Weapon Bone',
    // THE ANIMATION IT BORROWS, and without this the rig plays HAND TO
    // HAND: `animWeaponType` turns MW_WEAPON_TYPE.None into HandToHand
    // (fpArm.js:310), which is right for empty hands and absurd for a
    // man holding a dwemer firearm - the arms punch, and the gun goes
    // along for the ride.
    //
    // A weapon TYPE is not a MODEL. The model had to be ours because
    // Morrowind has no gun; the ANIMATION does not, because Morrowind
    // has something shaped exactly like this act. MarksmanCrossbow (10,
    // weapontype.hpp) matches the Thunderlock on every axis the
    // animation system asks about:
    //
    //   two-handed      isOneHanded: false, both hands on it
    //   ranged          fired, not swung - so `shootsRatherThanSwings`
    //                   is true and the attack keys are "shoot start"
    //                   / "shoot max attack" / "shoot release" rather
    //                   than a chop's small/medium/large follow
    //   reloads itself  `reloadsItself` is true ONLY for the crossbow,
    //                   and the Thunderlock's cycle has a visible
    //                   reload in it - which is the lab's own finding
    //   spends ammo     a pellet, where the crossbow spends a bolt
    //
    // THE NUMBER, NOT THE IMPORT, because this file is a leaf on
    // purpose (see the header) and `MW_WEAPON_TYPE` lives in
    // mwFirstPerson.js, which would drag the whole Morrowind
    // first-person module into `mwItemMap.js`'s graph for one integer.
    // test/fieldgunmw.test.js asserts it IS
    // MW_WEAPON_TYPE.MarksmanCrossbow, so the number cannot drift from
    // the name it stands for.
    animateAs: 10,
    // ...AND ITS AMMUNITION IS NOT BORROWED. `ammoTypeFor(10)` is Bolt,
    // and instancing a Morrowind bolt on the arrow bone would put a
    // quarrel through a dwemer gun. `resolveWeaponParts` returns before
    // its ammunition arm for exactly this reason, and says so there.
    borrowsAmmo: false,
    // What the arm's card says it is holding, where a Morrowind record
    // would have supplied an id and a name.
    id: 'daggerfall_thunderlock',
    name: 'Dwarven Thunderlock',
    // A Morrowind record carries its own attack speed (MW-D28,
    // character.cpp:1326). The port's own weapons have no record to
    // carry one, and 1 is the reference's own value for a record that
    // does not set it.
    speed: 1,
  }),
});

/** The model this item wears, or null for everything that resolves
 *  through Morrowind's own records. */
export const ownWeaponModelFor = (item) =>
  (item && OWN_MW_MODELS[item.templateIndex]) || null;

/** Every model path this table can ask for, so a preload and a coverage
 *  walk can both be DERIVED rather than typed out again. */
export const ownWeaponModelPaths = () =>
  Object.values(OWN_MW_MODELS).map((m) => `meshes/${m.model}`);
