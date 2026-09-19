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
