// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LOOT8 (2026-10-01) — THE DROUGHT.
//
// The Loot arc (bible/06-Systems/Loot-Arc.md section 10; Mac: "Do you
// wanna turn this into an arc and do all of the above?" - "Bad-luck
// protection"). Every eligible piece (LR1's eligibility: a weapon, armour,
// jewellery) the player TAKES from a body or a pile below Legendary adds
// one to the character's DROUGHT; a Legendary or better taken empties it.
// At every source door the Legendary threshold is multiplied by
// `1 + 0.2 x floor(drought / 25)`, at most x3 - after 25 pieces x1.2,
// after 250 x3 - and never above the Rare threshold (lootRarity.js
// rarityChances: the ladder never inverts). It is a FINDER (LOOT5's
// registry), Foxglove's beside it, so the two multiply.
//
// COUNTED AT THE TAKE, never the roll: a body's loot is rolled when its
// foe is spawned (hostCombat.spawnEnemyLoot), so counting the rolls would
// fill the drought by walking into a dungeon. And counted ONCE: the source
// door marks every piece it rolls `untaken` (lootRarity.js rollLootRarity
// - a field, so it rides a save, a body's record and a peer's grant), and
// the first take clears it - a piece dropped and taken again, or a shop's,
// a quest's or a crafted piece that no source door ever rolled, counts
// nothing. The take is inventory.js's one listener seam (the loot
// window's, quick loot's, a body's bulk take, a peer's grant).
//
// It rides the character's save (a mod record, the Sigil Broker's way);
// offline and online alike. OFF IS DFU EXACTLY: the doors mark nothing
// and the finder answers 1.
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn, registerLegendaryFind, rarityRank, RARITIES, isGarment, legendariesFor } from './lootRarity.js';
import { registerTakeListener } from './inventory.js';
import { registerModSaveData } from './modSaveData.js';

/** Every this many pieces taken below Legendary, the threshold this much more - at most this many times. */
export const DROUGHT_STEP = 25;
export const DROUGHT_STEP_MULT = 0.2;
export const DROUGHT_MAX_MULT = 3;
/** A counter's ceiling (the cap is reached at 250; a save never carries a number past this). */
export const DROUGHT_MAX = 100000;

let _drought = 0;
/** The pieces taken since the last Legendary. */
export const droughtOf = () => _drought;
/** The Legendary threshold's multiplier at a drought. */
export const droughtMult = (d = _drought) => Math.min(DROUGHT_MAX_MULT, 1 + DROUGHT_STEP_MULT * Math.floor(Math.max(0, Number(d) || 0) / DROUGHT_STEP));

/** THE TAKE: a piece a source door rolled and nobody took before - its mark cleared, the drought one more below
 *  Legendary, emptied at Legendary or better. Answers whether it counted. AUDIT LOOT II A10: a garment counts only if it
 *  could have been a Legendary - one of the eighteen templates the wardrobe's six are cut on; a cheap shirt off every
 *  body filled the drought toward its x3 for a ladder it never stood on (the mark still clears: it is the door's word
 *  that the piece was rolled). */
export function noteTaken(item) {
  if (!item || item.untaken !== true) return false;
  delete item.untaken;
  if (!lootRarityOn()) return false;
  if (isGarment(item) && !legendariesFor(item).length) return false;
  _drought = rarityRank(item) >= RARITIES.legendary.rank ? 0 : Math.min(DROUGHT_MAX, _drought + 1);
  return true;
}

export const DROUGHT = 'lootDrought';
/** The save's slot (systems/modSaveData.js), under this name. */
export const DROUGHT_SAVE_VENDOR = 'LootDrought';
/** A record off a save: a whole count of none or more (past the ceiling, the ceiling), or none. */
export function validDroughtRecord(r) {
  const d = r && typeof r === 'object' ? r.drought : null;
  return Number.isSafeInteger(d) && d >= 0 ? Math.min(DROUGHT_MAX, d) : 0;
}
registerModSaveData(DROUGHT_SAVE_VENDOR, {
  newSaveData: () => ({ drought: 0 }),
  getSaveData: () => ({ drought: _drought }),
  restoreSaveData: (r) => { _drought = validDroughtRecord(r); },
});
registerLegendaryFind(DROUGHT, () => (lootRarityOn() ? droughtMult() : 1));
registerTakeListener(DROUGHT, noteTaken);

/** Tests only: the drought set outright. */
export function _setDroughtForTests(n) { _drought = Math.max(0, Math.trunc(Number(n) || 0)); }
