// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GEM2 (2026-10-09) — THE GRADED GEMS.
//
// Gem Sockets (bible/06-Systems/Gem-Sockets.md section 4; Mac: "Id
// like to have and show weapons with physical gem slots that can be
// slotted into, along with introducing new gem items into the world
// loot pool and world bosses"). DFU's eight gems are the plain grade;
// this file owns the port's four others of each - Chipped, Flawed,
// Flawless, Perfect - thirty-two rows of its own (1900-1931,
// lootRarity.js GEM_GRADE_TEMPLATE_BASE), and where they are found:
//   - THE WORLD'S GEM FIND (rollGemFind): every door the ladder rolls
//     at has a chance at one, by the source's tier, its kind and luck -
//     registered with the door (lootRarity.js registerGemFind), whose
//     very last draw it is (law 9: every draw before it stays its
//     seed's);
//   - THE BOSSES' GEMS (bossGems): the Warden's, the Old Coil's and the
//     Brass Remnant's spoils, at a boss's grade, after their cards.
//
// A graded gem is a gem in every way DFU's are: the Gems group (worn as
// a crystal, as a Ruby is - equipTable.js getEquipSlot), an ingredient
// that stacks with its own row alone (inventory.js isStackable /
// stacksWith: one template, one stack), on its kind's own DFU art
// (TEXTURE.254), the grade in its name. No counter stocks one: the rows
// are in no group's enum a shelf draws from (the Sigil Stone's law).
// Its line, by grade, is lootRarity.js GEM_GRADE_LINES - one table for
// the plain grade and the four.
//
// Registered at import: systems/worldTick.js and scenes/shared.js
// import this, as they import the Ayleid stones and the gate's spoils,
// so every host has the rows before a save carrying one loads.
// ═══════════════════════════════════════════════════════════════════

import { registerCustomTemplates, templateByIndex, mintCondition, setItemFields } from './itemTemplates.js';
import {
  GEM_IDS, GEM_ROW_GRADES, GEM_GRADES, GEM_NAMES, GEM_GRADE_TEMPLATES, gemId, gemTemplateOf, registerGemFind,
  SOURCE_MULT, luckMult, lootRarityOn,
} from './lootRarity.js';

/** A graded row's price and rarity against its kind's DFU row: a Chipped stone a quarter of a Ruby's price, a Perfect
 *  one four times. The item maker's points stay the kind's own (a grade is a socket's line, never an enchanting base). */
export const GEM_GRADE_PRICE = Object.freeze({ chipped: 0.25, flawed: 0.5, plain: 1, flawless: 2, perfect: 4 });
export const GEM_GRADE_RARITY = Object.freeze({ chipped: -2, flawed: -1, plain: 0, flawless: 3, perfect: 6 });
/** The thirty-two rows, in DFU's ItemTemplates.txt columns: the kind's weight, wear, points and art; the grade's name,
 *  price and rarity; an ingredient, as every DFU gem is (so a stack is one row's). */
export const GEM_GRADE_ROWS = Object.freeze(GEM_ROW_GRADES.flatMap((grade) => GEM_IDS.map((kind, k) => {
  const dfu = /** @type {any} */ (templateByIndex(k));
  return Object.freeze({
    index: /** @type {number} */ (gemTemplateOf(gemId(kind, grade))),
    name: GEM_NAMES[gemId(kind, grade)],
    baseWeight: dfu.baseWeight,
    hitPoints: dfu.hitPoints,
    basePrice: Math.max(1, Math.round(dfu.basePrice * GEM_GRADE_PRICE[grade])),
    enchantmentPoints: dfu.enchantmentPoints,
    rarity: Math.max(1, Math.min(20, dfu.rarity + GEM_GRADE_RARITY[grade])),
    isIngredient: true,
    worldTextureArchive: dfu.worldTextureArchive,
    worldTextureRecord: dfu.worldTextureRecord,
  });
})));
registerCustomTemplates(GEM_GRADE_ROWS);
/** Whether a template is one of the port's graded rows. */
export const isGradedGemTemplate = (/** @type {number} */ t) => GEM_GRADE_TEMPLATES.includes(t);

/** ONE GEM, minted on its row - DFU's own for a plain id, the port's for a graded one; null for no gem. */
export function mintGem(/** @type {string} */ id) {
  const t = gemTemplateOf(id);
  return t == null ? null : mintCondition(setItemFields({ group: 'Gems', templateIndex: t }));
}

// ── where they are found ──────────────────────────────────────────────
/** THE WORLD'S CHANCE AT A GEM, per mille: `base` and `perTier` a tier of the source to `cap`, a pile 1.3 times and a
 *  boss 2.5 (the ladder's SOURCE_MULT), and the player's live Luck through the ladder's own multiplier (luckMult) - the
 *  odds are the source's, the Luck the finder's, as every ladder roll reads it. */
export const GEM_FIND = Object.freeze({ base: 30, perTier: 5, cap: 150 });
/** THE GRADE A SOURCE'S TIER GIVES: from `tier` on, each grade's weight (GEM_GRADES' order - chipped, flawed, plain,
 *  flawless, perfect). A boss reads GEM_BOSS_TIERS deeper. */
export const GEM_GRADE_BANDS = Object.freeze([
  Object.freeze({ tier: 0, weights: Object.freeze([70, 30, 0, 0, 0]) }),
  Object.freeze({ tier: 5, weights: Object.freeze([30, 50, 20, 0, 0]) }),
  Object.freeze({ tier: 10, weights: Object.freeze([0, 30, 45, 25, 0]) }),
  Object.freeze({ tier: 15, weights: Object.freeze([0, 0, 35, 50, 15]) }),
  Object.freeze({ tier: 20, weights: Object.freeze([0, 0, 0, 60, 40]) }),
]);
export const GEM_BOSS_TIERS = 4;
/** Per mille that a source finds a gem. Nothing with the ladder off. */
export function gemFindChance({ kind = 'corpse', tier = 0, boss = false, luck = 50 } = {}) {
  if (!lootRarityOn()) return 0;
  const mult = boss ? SOURCE_MULT.boss : (SOURCE_MULT[kind] ?? 1);
  return Math.max(0, Math.min(GEM_FIND.cap, (GEM_FIND.base + GEM_FIND.perTier * Math.max(0, tier)) * mult * luckMult(luck)));
}
/** The band a source's tier reads (a boss GEM_BOSS_TIERS deeper). */
export function gemGradeBand({ tier = 0, boss = false } = {}) {
  const t = Math.max(0, tier | 0) + (boss ? GEM_BOSS_TIERS : 0);
  let band = GEM_GRADE_BANDS[0];
  for (const b of GEM_GRADE_BANDS) if (t >= b.tier) band = b;
  return band;
}
/** ONE GEM AT A SOURCE'S GRADE: the grade by its band's weights, then the kind evenly over the eight - two draws. */
export function rollGem(source, rolls = Math.random) {
  const { weights } = gemGradeBand(source);
  const total = weights.reduce((n, w) => n + w, 0);
  let r = rolls() * total, g = 0;
  while (g < weights.length - 1 && r >= weights[g]) { r -= weights[g]; g++; }
  const kind = GEM_IDS[Math.min(GEM_IDS.length - 1, Math.floor(rolls() * GEM_IDS.length))];
  return mintGem(gemId(kind, GEM_GRADES[g]));
}
/** THE WORLD'S GEM FIND at one door: one draw for the chance, two more when it lands (rollGem). Answers the items to add -
 *  most often none. */
export function rollGemFind(source, rolls = Math.random) {
  const chance = gemFindChance(source ?? {});
  if (!(chance > 0) || !(rolls() * 1000 < chance)) return [];
  const gem = rollGem(source ?? {}, rolls);
  return gem ? [gem] : [];
}
registerGemFind(rollGemFind);

/** THE BOSSES' GEMS: how many each boss's spoils carry, at a boss's grade at the ladder's top tier (the bands' last row).
 *  The Old Coil's go to a ship that dealt (systems/serpentSpoils.js). */
export const BOSS_GEMS = Object.freeze({ gate: 1, serpent: 1, abyss: 2 });
export const BOSS_GEM_SOURCE = Object.freeze({ tier: 21, boss: true });
/** A boss's gems, each known (a gem is always known - it carries no enchantment) - two draws a gem. */
export function bossGems(/** @type {string} */ boss, rolls = Math.random) {
  if (!lootRarityOn()) return [];   // AUDIT GEM (law 3): with the ladder off no graded gem is found - a boss's last draws, so nothing before them moves
  const out = [];
  for (let i = 0; i < (BOSS_GEMS[boss] ?? 0); i++) { const g = rollGem(BOSS_GEM_SOURCE, rolls); if (g) out.push(g); }
  return out;
}
