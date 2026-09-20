// The Dwarven Thunderlock's numbers, and NOTHING ELSE - no imports at
// all, on purpose.
//
// systems/thunderlock.js is the weapon's home, but it reaches
// systems/itemTemplates.js to register its rows, and that file imports
// characters/weapons.js for the condition ladder. So a weapons.js that
// wanted the indices from the home would close a cycle
// (weapons -> thunderlock -> itemTemplates -> weapons) and leave one
// of the three holding an undefined const on the way up, depending on
// which the bundler reached first.
//
// A leaf breaks it. The same answer weaponAlign.js is to fpsWeapon's
// three integers: the law stays in one place, and the place has no
// dependencies to drag round behind it.

/** The two custom template indices. Past DFU's 288 and past Climates &
 *  Calories' 530-541, so registerCustomTemplates takes them and the
 *  frozen DFU table is not touched. */
export const THUNDERLOCK_TEMPLATE = 560;
export const PELLET_TEMPLATE = 561;

/** Its art archives - its own, not the classic weapon pair 233/234. */
export const THUNDERLOCK_ARCHIVE = 560;
export const PELLET_ARCHIVE = 561;

/**
 * THE AMMUNITION LINK: what does this weapon spend?
 *
 * Here on the leaf rather than with the weapon, because
 * systems/inventory.js is one of the askers and it is upstream of
 * everything systems/thunderlock.js touches - importing the home from
 * there would close a second cycle for the sake of one comparison.
 * Null for everything that spends nothing; the bow's own answer
 * (Arrow, 131) stays with the bow.
 */
export const ammoTemplateFor = (item) =>
  (item?.templateIndex === THUNDERLOCK_TEMPLATE ? PELLET_TEMPLATE : null);

/**
 * WHAT COMES OUT OF THE BARREL.
 *
 * FIELD-GUN14 (2026-09-20, Mac: "The projectile that shoots out
 * should be an orb, not an arrow").
 *
 * IT WAS AN ARROW, and by now the reason will be familiar: the shot
 * rides the port's RANGED lane, which is the bow's, and that lane
 * draws model 99800 - the arrow - oriented along its direction. A
 * lane written for the one ranged weapon Daggerfall has, asked about
 * this one, answering its default. Nothing went red, and a dwarven
 * firearm fired arrows.
 *
 * The orb is DAGGERFALL'S OWN, not new art: the spell missiles are
 * archives 375-379 (systems/spellcast.js's `missileArchive`), each an
 * animated glowing ball the game already loads and the hosts already
 * know how to draw. 378 is the SHOCK missile, and the pick is the
 * weapon's own name - a Thunderlock firing a crackling orb is the
 * thing it says on the tin. It is one constant, so it is one edit to
 * make it fire fire (375) or frost (376) instead.
 *
 * Here on the leaf with the other numbers, for the reason the file's
 * header gives: combat/arrowFlight.js and scenes/dungeonContext.js
 * are the two askers, and both are upstream of everything
 * systems/thunderlock.js touches.
 */
export const ORB_ARCHIVE = 378;
/** The flight record. Record 1 of the same archive is the IMPACT
 *  flash (AUDIT 26 F033), which is not this. */
export const ORB_RECORD = 0;

/** Does this weapon's shot fly as an orb? The archive, or null for
 *  every weapon whose shot is a shaft - which is all of DFU's. */
export const orbArchiveFor = (item) =>
  (item?.templateIndex === THUNDERLOCK_TEMPLATE ? ORB_ARCHIVE : null);
