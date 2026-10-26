// @ts-check
// LOCKPICK (2026-10-26, the owner: "I want to build a detailed lock picking minigame and introduce a lockpick item";
// bible/06-Systems/Lockpicking.md): THE LOCKPICK - the thing a lock is picked with. Template 584 (lockpickRow.js - the leaf
// the item law reads headless), miscellany, stacked, traded freely.
//
// A LOCK NEEDS ONE (Lockpicking.md section 2): picking a lock in Steal mode - a building's front door, a dungeon's door, a
// locked chest or crate - opens the lock's window (ui/lockpickDoor.js) only with a lockpick in the pack, and a pick that
// snaps in it is gone. DFU picks with no item (DaggerfallActionDoor.AttemptLockpicking checks no inventory) - the departure,
// Ledger A (LOCKPICK). So the pick must be easy to come by:
//   - EVERY GENERAL STORE AND PAWN SHOP keeps a stack of them on its counter, ENDLESS-STOCK's way (systems/shopStock.js):
//     a full stack every day, online refilled as it is bought;
//   - A NEW CHARACTER whose class holds Lockpicking - primary, major or minor - sets out with LOCKPICK_KIT of them
//     (startingGear.js addSurvivalProvisions, the port's own tail), and A CHARACTER FROM BEFORE THE LOCKPICK is given the
//     same, once, as its save is restored - the Wallet's gift (save.js restorePlayer; the save's `lockpickGift` mark);
//   - A ROGUE'S POCKETS: a Burglar or a Thief carries some more often than not, the other rogues now and then (the port's
//     own extra on a foe with a loot table - systems/loot/loot.js registerEnemyLootExtra).
//
// ITS PICTURE is its own (lockpickArt.js), put on the texture door at this file's import as its archive's stand-in, so
// every door that draws an item's picture draws it (Starglass's law, systems/starfall/starglass.js).
//
// Not a DFU member. Ledger A (LOCKPICK).
import { registerCustomTemplates, setItemFields, mintCondition, registerItemUseHandler } from '../item/itemTemplates.js';
import { addItem, removeOne } from '../inventory.js';
import { registerEnemyLootExtra } from '../loot/loot.js';
import { addVendorTextures } from '../textureReplacement.js';
import { SKILLS } from '../skills.js';
import { t } from '../textManager.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../characters/mobile/mobileTypes.js';
import { LOCKPICK_ART, registerLockpickArt } from './lockpickArt.js';
import { LOCKPICK_TEMPLATE, LOCKPICK_LAW_ROW } from './lockpickRow.js';

export { LOCKPICK_TEMPLATE };
/** Its row: the leaf's with its name and its picture. */
export const LOCKPICK_ROW = Object.freeze({
  ...LOCKPICK_LAW_ROW, name: 'Lockpick', capacityOrTarget: 0, enchantmentPoints: 0, variants: 0, drawOrderOrEffect: 0,
  isBluntWeapon: false, isLiquid: false, isOneHanded: false, isIngredient: false,
  worldTextureArchive: LOCKPICK_ART.archive, worldTextureRecord: LOCKPICK_ART.record, playerTextureArchive: 0, playerTextureRecord: 0,
});
registerCustomTemplates([LOCKPICK_ROW]);
registerLockpickArt(addVendorTextures);   // the import IS the registration

/** The stack a General Store's or a Pawn Shop's counter keeps (ENDLESS-STOCK). */
export const ENDLESS_LOCKPICK_STACK = 25;
/** The picks a character whose class holds Lockpicking sets out with - and is given once, from before the lockpick. */
export const LOCKPICK_KIT = 5;
/** The gift's mark a save carries once its character has had it (the Wallet's shape, walletItem.js WALLET_GIFT). */
export const LOCKPICK_GIFT = 1;
/** A rogue's pockets: [mobile type, chance (0..1), the most picks] - a Burglar's and a Thief's trade, the rest's now
 *  and then. One to `most`, evenly. */
export const ROGUE_LOCKPICKS = Object.freeze([
  Object.freeze([MOBILE_TYPES.Burglar, 0.6, 3]), Object.freeze([MOBILE_TYPES.Thief, 0.6, 3]),
  Object.freeze([MOBILE_TYPES.Rogue, 0.3, 2]), Object.freeze([MOBILE_TYPES.Nightblade, 0.25, 2]),
  Object.freeze([MOBILE_TYPES.Acrobat, 0.25, 2]), Object.freeze([MOBILE_TYPES.Assassin, 0.25, 2]),
  Object.freeze([MOBILE_TYPES.Bard, 0.15, 1]),
]);

/** Whether a record IS a lockpick - its template and its group, the one spelling every rule reads. */
export const isLockpick = (/** @type {any} */ item) => item?.templateIndex === LOCKPICK_TEMPLATE && item?.group === 'UselessItems2';
/** `n` lockpicks (at least one), one stack, minted on their own row. */
export function lockpicks(n = 1) {
  return Object.assign(mintCondition(setItemFields({ group: 'UselessItems2', templateIndex: LOCKPICK_TEMPLATE })), { stackCount: Math.max(1, Math.trunc(Number(n) || 1)) });
}
/** How many lockpicks a list (the pack) holds, every stack together. */
export const lockpickCount = (/** @type {any} */ items) => (Array.isArray(items)
  ? items.reduce((n, it) => n + (isLockpick(it) ? Math.max(1, Math.trunc(Number(it.stackCount) || 1)) : 0), 0) : 0);
/** One lockpick gone from the pack - a pick snapped in a lock. Answers whether there was one to lose. */
export const spendLockpick = (/** @type {any} */ entity) => (Array.isArray(entity?.items) ? removeOne(entity.items, LOCKPICK_TEMPLATE, { group: 'UselessItems2' }) : false);

/** ENDLESS-STOCK (systems/shopStock.js): a counter's stack of lockpicks stood whole - made when it has none, filled back
 *  to ENDLESS_LOCKPICK_STACK when it holds fewer. Answers the list. */
export function ensureEndlessLockpicks(/** @type {any[]} */ items) {
  if (!Array.isArray(items)) return items;
  const stack = items.find(isLockpick);
  if (!stack) items.push(lockpicks(ENDLESS_LOCKPICK_STACK));
  else if ((stack.stackCount ?? 1) < ENDLESS_LOCKPICK_STACK) stack.stackCount = ENDLESS_LOCKPICK_STACK;
  return items;
}

/** AUDIT LOCKPICK B4: an online counter's picks stood back by what a PURCHASE took, never past the whole stack - ENDLESS-ARROWS'
 *  law (shopStock.js restockArrows): a stack shoplifted stays gone, and a pick bought after it brought every stolen one back.
 *  Answers 1 when the counter changed. */
export function restockLockpicks(/** @type {any[]} */ items, /** @type {number} */ took) {
  if (!Array.isArray(items) || !(took > 0)) return 0;
  const stack = items.find(isLockpick);
  if (!stack) { items.push(lockpicks(Math.min(ENDLESS_LOCKPICK_STACK, took))); return 1; }
  const was = stack.stackCount ?? 1;
  if (was >= ENDLESS_LOCKPICK_STACK) return 0;
  stack.stackCount = Math.min(ENDLESS_LOCKPICK_STACK, was + took);
  return 1;
}

/** Whether a character's class holds Lockpicking at all - primary, major or minor. */
export function careerPicksLocks(/** @type {any} */ entity) {
  const c = entity?.career;
  return !!c && [c.primarySkills, c.majorSkills, c.minorSkills].some((list) => Array.isArray(list) && list.includes(SKILLS.Lockpicking));
}
/** A new character's picks (startingGear.js addSurvivalProvisions): LOCKPICK_KIT for a class that holds Lockpicking,
 *  none for the rest. Answers the stack given, or null. */
export function giveStartingLockpicks(/** @type {any} */ entity) {
  if (!careerPicksLocks(entity)) return null;
  if (!Array.isArray(entity.items)) entity.items = [];
  const stack = lockpicks(LOCKPICK_KIT);
  addItem(entity.items, stack);
  return stack;
}
/** The gift, the Wallet's shape (walletItem.js giveWalletGift): a character from before the lockpick (its save's mark short
 *  of LOCKPICK_GIFT) is marked, and given the kit if its class holds Lockpicking - once. Answers the picks given. */
export function giveLockpickGift(/** @type {any} */ entity) {
  if (!entity || typeof entity !== 'object') return 0;
  if ((Number.isSafeInteger(entity.lockpickGift) ? entity.lockpickGift : 0) >= LOCKPICK_GIFT) return 0;
  entity.lockpickGift = LOCKPICK_GIFT;
  return giveStartingLockpicks(entity) ? LOCKPICK_KIT : 0;
}

/** A rogue's pockets (ROGUE_LOCKPICKS) for a foe's EnemyBasics row - its row, read by identity (the rows carry no id), so a
 *  mod's edits over a row keep it. */
const _rogueRows = new Map(ROGUE_LOCKPICKS.map(([type, chance, most]) => [ENEMY_BASICS[type], { chance, most }]));
/** The extra: on a rogue's body, its picks, on the roll's own dice. Answers how many. */
export function rogueLockpicks(/** @type {any[]} */ items, /** @type {any} */ basics, rolls = Math.random) {
  const r = _rogueRows.get(basics);
  if (!r || !Array.isArray(items) || !(rolls() < r.chance)) return 0;
  const n = 1 + Math.min(r.most - 1, Math.floor(rolls() * r.most));
  addItem(items, lockpicks(n));
  return n;
}
registerEnemyLootExtra('lockpick', ({ items, basics, rolls }) => { rogueLockpicks(items, basics, rolls); });

/** Its card's lines: what it is for, read when the card is shown (Starglass's shape). */
export const LOCKPICK_TEXT = Object.freeze({
  card: () => [
    t('lockpick.item.what', 'A thin steel pick and a tension wrench, for locks that are not yours.'),
    t('lockpick.item.use', 'In Steal mode, activate a locked door, chest or crate to pick it. A pick can snap.'),
  ],
  use: () => t('lockpick.item.useLine', 'Switch to Steal mode and activate a locked door, chest or crate to pick its lock.'),
});
/** The pack's Use: how a lock is picked (every reader shows a `text` result). */
registerItemUseHandler(LOCKPICK_TEMPLATE, () => ({ kind: 'text', text: LOCKPICK_TEXT.use() }));
