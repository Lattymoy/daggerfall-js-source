// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE FAITHFUL'S CHEST - what the faithful keep in their circle,
// opened once their rite is broken, for each character once a day: gold, two to four reagents of the rite (Sulphur,
// Ichor, Ectoplasm, Lich Dust - a Daedra's Heart rarely) and, one time in twenty, a piece of Dagon's Brand - a Magic
// piece of armour bearing the set's sigil. Design: bible/11-Multiplayer/World-Bosses.md section 19 D.
//
// The day it was opened is the character's own record in the save (systems/modSaveData.js), as the Broker's is - and
// beside it, the rite's memory (AUDIT WB12d: which of the day's faithful fell, whether the Summoner did).
//
// Not a DFU member. Ledger A (WB).
import { createRandomArmor } from './loot/loot.js';
import { setItemFields, mintCondition } from './item/itemTemplates.js';
import { applyRarity } from './loot/lootRarity.js';
import { goldStack } from './inventory.js';
import { sigilParty } from './sigil/sigil.js';
import { registerModSaveData } from './modSaveData.js';
import { DAEDRA_HEART } from '../net/professionLaw.js';   // DAEDRIC-SMELT: the heart's one row (ONE DFU MEMBER, ONE EXPORT)

/** Gold a level of the opener's, the low and high of the roll. */
export const RITE_CHEST_GOLD = Object.freeze([20, 40]);
/** The rite's reagents (their templates and groups), two to four of them. */
export const RITE_REAGENTS = Object.freeze([
  Object.freeze({ templateIndex: 69, group: 'MetalIngredients' }),           // Sulphur
  Object.freeze({ templateIndex: 64, group: 'MiscellaneousIngredients1' }),  // Ichor
  Object.freeze({ templateIndex: 39, group: 'CreatureIngredients1' }),       // Ectoplasm
  Object.freeze({ templateIndex: 45, group: 'CreatureIngredients1' }),       // Lich Dust
]);
export const RITE_REAGENTS_MIN = 2;
export const RITE_REAGENTS_MAX = 4;
/** A reagent drawn is a Daedra's Heart this often - DFU's own (CreatureIngredients1 53), the Stores' row of it since
 *  DAEDRIC-SMELT: the Daedric smelt takes it at the forge, loose (bible/06-Systems/Professions-Arc.md section 53). */
export const RITE_HEART = Object.freeze({ templateIndex: DAEDRA_HEART.templateIndex, group: DAEDRA_HEART.group });
export const RITE_HEART_CHANCE = 0.08;
/** A piece of Dagon's Brand, one chest in this many. */
export const RITE_BRAND_IN = 20;
/** The set the brand bears (systems/sigil/sigilSets.js). */
export const RITE_BRAND_SET = 'dagon';

/**
 * What one chest holds for a character of `level`: gold first, the reagents, then the brand when the roll gives one.
 * @param {number} level @param {() => number} [rolls]
 */
export function riteChestItems(level, rolls = Math.random) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const [lo, hi] = RITE_CHEST_GOLD;
  const items = [goldStack(Math.round(lv * (lo + rolls() * (hi - lo))))];
  const n = RITE_REAGENTS_MIN + Math.floor(rolls() * (RITE_REAGENTS_MAX - RITE_REAGENTS_MIN + 1));
  for (let i = 0; i < n; i++) {
    const r = rolls() < RITE_HEART_CHANCE ? RITE_HEART : RITE_REAGENTS[Math.floor(rolls() * RITE_REAGENTS.length) % RITE_REAGENTS.length];
    items.push(mintCondition(setItemFields({ group: r.group, templateIndex: r.templateIndex })));
  }
  if (rolls() * RITE_BRAND_IN < 1) items.push(riteBrand(lv, rolls));
  return items;
}

/** A piece of Dagon's Brand: a Magic piece of armour bearing the set's sigil, at Faint. */
export function riteBrand(level, rolls = Math.random) {
  const it = createRandomArmor(level, rolls);
  applyRarity(it, 'magic', rolls);
  it.isIdentified = true;
  it.sigil = { set: RITE_BRAND_SET, party: sigilParty(1), xp: 0 };
  return it;
}

// ── the record: the day this character last opened a chest ──
export const RITE_CHEST_SAVE_VENDOR = 'RiteChest';
let _day = -1;
/** Whether this character has opened `day`'s chest. */
export const riteChestOpened = (day) => _day === day;
/** This character has opened `day`'s chest. */
export function markRiteChest(day) { if (Number.isSafeInteger(day)) _day = day; }
registerModSaveData(RITE_CHEST_SAVE_VENDOR, {
  newSaveData: () => ({ day: -1 }),
  getSaveData: () => ({ day: _day }),
  restoreSaveData: (r) => { _day = Number.isSafeInteger(r?.day) ? r.day : -1; },
});

// ── AUDIT WB12d (C1, C5): THE RITE'S MEMORY - what this character saw of a day's faithful, in the save beside the chest:
// how many of each career fell, whether the Summoner did, and whether the broken word and the opening's line were said.
// The faithful are never in a save themselves (transient): a circle stood again - after a teleport, a reload, a load, a
// peer who left with them - stands the survivors alone, never a fallen Summoner, and its lines are not said twice ──
export const RITE_DAY_SAVE_VENDOR = 'RiteDay';
/** The most of one career a day's faithful hold (riteFaithfulOf: the Summoner and RITE_FAITHFUL_MAX beside him). */
const SLAIN_MAX = 9;
const blank = (d) => ({ d, slain: {}, fell: 0, struck: 0, passed: 0, saidBroken: 0 });
let _rite = blank(-1);
/** The day's memory, this character's (a new day's starts blank). Mutated in place by the rite's host. */
export function riteMemory(day) {
  if (_rite.d !== day) _rite = blank(day);
  return _rite;
}
/** BROKER-CAGE: what this character saw of day `day`'s faithful, or null - read, never begun (riteMemory begins a day). */
export const riteSeen = (day) => (_rite.d === day ? _rite : null);
const bit = (v) => (v === 1 ? 1 : 0);
registerModSaveData(RITE_DAY_SAVE_VENDOR, {
  newSaveData: () => blank(-1),
  getSaveData: () => ({ ..._rite, slain: { ..._rite.slain } }),
  restoreSaveData: (r) => {
    if (!r || !Number.isSafeInteger(r.d)) { _rite = blank(-1); return; }
    const slain = {};
    for (const [k, v] of Object.entries(r.slain && typeof r.slain === 'object' ? r.slain : {})) if (/^\d{1,4}$/.test(k) && Number.isSafeInteger(v) && v > 0) slain[k] = Math.min(v, SLAIN_MAX);
    _rite = { d: r.d, slain, fell: bit(r.fell), struck: bit(r.struck), passed: bit(r.passed), saidBroken: bit(r.saidBroken) };
  },
});
