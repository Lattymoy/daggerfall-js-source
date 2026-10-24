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
// lookup cannot close a cycle. `src/formats/morrowind/mwItemMap.js` and
// `src/combat/fpArm.js` are both askers and both sit upstream of
// everything `systems/thunderlock.js` touches.
import { THUNDERLOCK_TEMPLATE, PISTOLET_TEMPLATE } from '../thunderlockIds.js';

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
/**
 * RIFLE-STANCE: THE GUN ON THE HAND AS A HAND HOLDS A PISTOL GRIP - the part's preTransform (`{ a, t }`, the shape the
 * torch's LIGHT_ATTITUDE takes: the mesh's vertices turned and moved before the bone places them). The bake laid the
 * barrel along the bone's +Y (tools/bakeThunderlock.mjs: forward -z, up -x, chosen against a preview and never against
 * the bone - the record said so twice), which is the sword's way: Morrowind's Weapon Bone runs its +Y out of the fist's
 * thumb side and its +X down the hand toward the fingers, so the gun rode the fist by its receiver, rolled onto its side.
 * A pistol grip goes THROUGH the fist instead: the gun's top (+Z) to the thumb's side (+Y), its barrel along the hand
 * toward the knuckles (+X) - turned `GRIP_RAKE` degrees up toward the thumb, the grip's own rake - and its right (+X)
 * to the back of the hand (+Z); `GRIP_CENTRE`, the middle of the shipped mesh's grip, at the bone's origin (the fist's
 * middle, where a sword's grip sits).
 */
const GRIP_RAKE = 18;
const GRIP_CENTRE = Object.freeze([0, -2.5, -3.5]);
export const GUN_GRIP_ATTITUDE = (() => {
  const r = (GRIP_RAKE * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const a = [0, c, -s, 0, s, c, 1, 0, 0];   // columns: the mesh's right to +Z, its barrel to (c, s, 0), its top to (-s, c, 0)
  const [x, y, z] = GRIP_CENTRE;
  const t = [-(a[0] * x + a[1] * y + a[2] * z), -(a[3] * x + a[4] * y + a[5] * z), -(a[6] * x + a[7] * y + a[8] * z)];
  return Object.freeze({ a: Object.freeze(a), t: Object.freeze(t) });
})();

/** PISTOLET: THE DWARVEN PISTOLET'S GRIP through the fist - GUN_GRIP_ATTITUDE's turn at the pistol's own rake (its grip
 *  runs 12 degrees off square to its barrel - the owner's sprite's slope, tools/pistoletArt.mjs BAND, which the modelled
 *  grip keeps: tools/modelPistolet.mjs GRIP_RAKE).
 *  PISTOL-STANCE (2026-10-22, the owner, of the first renders: "You can definitely tell the grip is too high up when
 *  held"): THE FIST CLOSES HIGH ON THE GRIP, under the guard - `PISTOL_FIST_UP` model units up the grip from its middle.
 *  The grip's middle at the bone (the first cut) closed retail's fist on the grip's LOWER half: measured in the gun's
 *  own frame, its upper fingers' knuckles (Finger1) stood 0.16 under the middle and its lower (Finger2) 3.04, the
 *  trigger's tip 3.4 above - the whole lock and barrel riding over the fist. Moved up 2.4, the upper knuckles stand 2.2
 *  up the grip, the fingers wrapping it from just under the guard down to the butt's flare. */
const PISTOL_GRIP_RAKE = 12;
export const PISTOL_FIST_UP = 2.4;
export const PISTOL_GRIP_ATTITUDE = (() => {
  const r = (PISTOL_GRIP_RAKE * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const a = Object.freeze([0, c, -s, 0, s, c, 1, 0, 0]);   // GUN_GRIP_ATTITUDE's turn, at the pistol's own rake
  // the grip's way in the mesh (0, sin, cos), turned onto the bone: the mesh moved DOWN it so the fist stands up it
  const up = [a[1] * s + a[2] * c, a[4] * s + a[5] * c, a[7] * s + a[8] * c];
  return Object.freeze({ a, t: Object.freeze(up.map((v) => -PISTOL_FIST_UP * v)) });
})();

export const OWN_MW_MODELS = Object.freeze({
  [THUNDERLOCK_TEMPLATE]: Object.freeze({
    model: 'thunderlock.nif',
    bone: 'Weapon Bone',
    // THE ANIMATION IT BORROWS, and without this the rig plays HAND TO
    // HAND: `animWeaponType` turns MW_WEAPON_TYPE.None into HandToHand
    // (fpArm.js:"return mwType ==="), which is right for empty hands and absurd for a
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
    // test/formats/morrowind/fieldgunmw.test.js asserts it IS
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
    // RIFLE-STANCE (bible/05-Combat/Dwarven-Thunderlock.md): HELD AS A LONG GUN - the arms solved onto it while it is drawn
    // (combat/gun/rifleStance.js), not the crossbow clip's; and HELD BY ITS GRIP - the part's attitude on the bone.
    holdAs: 'rifle',
    attitude: GUN_GRIP_ATTITUDE,
  }),
  // PISTOLET (2026-10-21): the Dwarven Pistolet - modelled part by part and painted (tools/modelPistolet.mjs,
  // PISTOLET-MODEL: the owner, of the first bake's extruded sprite, "can you make an actual 3d model"), on the Weapon
  // Bone, and a pair's second on the Weapon Bone Left (fpArm.js resolveOffWeaponParts reads this table for the left hand
  // as for the right). Morrowind has no pistol either: it
  // borrows MarksmanThrown (11, weapontype.hpp) - Morrowind's ONE ONE-HANDED RANGED act: it shoots rather than swings
  // (the shot rides the arm's "shoot release", MW-D42's hold, as the Thunderlock's does) and has no ammunition arm, so
  // nothing is drawn through the pistol. Its clip is a throw, not a pistol's raise - so the arms are the PISTOL-STANCE's
  // while it is drawn (`holdAs: 'pistol'`, combat/gun/pistolStance.js: the idle low with the muzzle down, the aim with the arm
  // out; a pair's left on its second pistol), the throw clip timing the shot and the draw beneath, as the crossbow's does
  // for the Thunderlock's RIFLE-STANCE.
  [PISTOLET_TEMPLATE]: Object.freeze({
    model: 'pistolet.nif',
    bone: 'Weapon Bone',
    animateAs: 11,
    borrowsAmmo: false,
    holdAs: 'pistol',
    id: 'daggerfall_pistolet',
    name: 'Dwarven Pistolet',
    speed: 1,
    attitude: PISTOL_GRIP_ATTITUDE,
  }),
});

/**
 * GILDED1 (2026-10-07): A GILDED PIECE'S OWN TWIN - the same mesh and the same everything a rig asks (the bone, the
 * borrowed animation, the ammunition it does not borrow, the speed), in its own file with its own texture
 * (tools/bakeThunderlock.mjs bakes both from the one FBX: `thunderlock_gilded.nif` names `thunderlock_gilded.dds`, the
 * gold leaf of meshTexture.mjs GILDED_BANDS). 'gilded' is lootRarity.js's tier id; this file is a leaf, so it names it.
 */
export const OWN_MW_GILDED = Object.freeze({
  [THUNDERLOCK_TEMPLATE]: Object.freeze({
    ...OWN_MW_MODELS[THUNDERLOCK_TEMPLATE],
    model: 'thunderlock_gilded.nif',
    id: 'daggerfall_hourlock',
    name: 'The Hourlock',
  }),
  // PISTOLET: the Sunken Sovereign's (systems/gilded.js) - the Pistolet in gold leaf (tools/bakePistolet.mjs)
  [PISTOLET_TEMPLATE]: Object.freeze({
    ...OWN_MW_MODELS[PISTOLET_TEMPLATE],
    model: 'pistolet_gilded.nif',
    id: 'daggerfall_sunken_sovereign',
    name: 'The Sunken Sovereign',
  }),
});

/** The model this item wears, or null for everything that resolves
 *  through Morrowind's own records. GILDED1: a Gilded piece wears its gold twin. */
export const ownWeaponModelFor = (item) =>
  (item && ((item.rarity === 'gilded' && OWN_MW_GILDED[item.templateIndex]) || OWN_MW_MODELS[item.templateIndex])) || null;

/** Every model path this table can ask for, so a preload and a coverage
 *  walk can both be DERIVED rather than typed out again. */
export const ownWeaponModelPaths = () =>
  [...Object.values(OWN_MW_MODELS), ...Object.values(OWN_MW_GILDED)].map((m) => `meshes/${m.model}`);
