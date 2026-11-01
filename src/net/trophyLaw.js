// @ts-check
// HUNTERS-MARK (2026-10-27; bible/06-Systems/Bounty-Boards.md 12.5, bible/06-Systems/Professions-Arc.md section 58): A
// MOUNTED TROPHY - the item a named mark's payday and a Trophy Hunter's clean pelt give, hung in a home as a mount. A
// leaf both ends read: the item law knows the template headless (systems/item/itemLaw.js through profTemplates.js), and
// the decor law hangs it (net/decorLaw.js decorIsTrophy). Its picture is drawn at runtime from the player's own data
// (scenes/decor/trophyArt.js) - nothing of ARENA2 is kept.

/** The template, in the professions' reserved range (Professions-Arc 4.8: 601 was unused). */
export const TROPHY_TEMPLATE = 601;
/** Its row, in DFU's ItemTemplates.txt columns (systems/professions/profTemplates.js registers it). A plaque, light enough
 *  to carry; worth little at a counter, so a trophy is never a purse. */
export const TROPHY_ROW = Object.freeze({
  index: TROPHY_TEMPLATE,
  name: 'Trophy',
  baseWeight: 2,
  hitPoints: 100,
  capacityOrTarget: 0,
  basePrice: 40,
  enchantmentPoints: 0,
  rarity: 10,
  variants: 0,
  drawOrderOrEffect: 0,
  isBluntWeapon: false,
  isLiquid: false,
  isOneHanded: false,
  isIngredient: false,
  worldTextureArchive: 0,
  worldTextureRecord: 0,
  playerTextureArchive: 0,
  playerTextureRecord: 0,
});
/** A trophy's numbers: `message` the beast (its MobileTypes value), `variant` a named mark's name - its index in
 *  huntLaw.js HUNT_MARK_NAMES, plus one - or 0 for a beast with no name. */
export const trophyFoeOf = (/** @type {any} */ item) =>
  item?.templateIndex === TROPHY_TEMPLATE && Number.isSafeInteger(item.message) ? item.message : null;
export const trophyNameIndexOf = (/** @type {any} */ item) =>
  item?.templateIndex === TROPHY_TEMPLATE && Number.isSafeInteger(item.variant) && item.variant > 0
    ? item.variant - 1
    : null;
