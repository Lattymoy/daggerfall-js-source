// HAND-WRAPS (2026-10-29, the owner: "allow players using hand combat to recieve the outlines others recieve when a
// weapon is enchanted? Maybe a new weapon type like hand wraps?"). The Hand Wraps' template index and its test, and
// nothing else: no imports, so weapons.js, equipTable.js and fpsWeapon.js can ask it without the cycle
// characters/thunderlockIds.js describes. The home is systems/handWraps.js; the page bible/05-Combat/Hand-Wraps.md.

/** The template: past the Pistolet's 562, before Climates & Calories' next block. */
export const HAND_WRAPS_TEMPLATE = 563;

/** Whether an item (or a look's item) is a pair of Hand Wraps. */
export const isHandWraps = (item) => !!item && item.templateIndex === HAND_WRAPS_TEMPLATE;
