// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CRAFT4 (2026-10-07) — TEMPERING AND REFORGING: the crafter improves
// what loot gives, never past law 7 (bible/06-Systems/Professions-Arc.md
// section 41, CRAFT0's fourth slice; 41.7 as built). Pure: no clock, no
// DOM, no network - the account service decides by it, the stations
// draw by it.
//
// Asked (2026-10-07, Mac: "How could we enhance the profession element
// of the game while reducing complexity and making crafting more
// viable"; then, of the five proposals, "Lets do it"). FACT (41.1): a
// craft reaches Rare at most and loot reaches Legendary, Aetheric,
// Artifact and Sigil - a crafted piece was never the best a slot holds,
// so a crafter had nothing to offer a player wearing loot. NOW THE
// CRAFTER WORKS ON WHAT IS WORN:
//
// ═══ TEMPER (41.2, DECIDED) ═════════════════════════════════════════
//
// - Smithing for weapons and metal armour (the plate, the shields, the
//   chain), Outfitting for leather armour and cloth.
// - +1 QUALITY STEP (recipeLaw QUALITY_EFFECTS - its condition and its
//   weight) on any piece of Rare or below, up to SUPERIOR: a Masterwork
//   stays a maker's, and a Superior has no step left.
// - For HALF THE PIECE'S RECIPE'S main input of its material, rounded
//   up - a Steel Longsword's 3 Steel Ingots, 2; a Leather Cuirass's 6
//   Cured Leather, 3; a Plain Robe's 3 bolts, 2 - from the Stores.
// - At the material's tier's rank - the recipe's own rank - and paying
//   the craft's XP (recipeLaw craftXp at the recipe's tier, no first).
// - DECIDED, each: a piece is tempered by its own recipe where it was
//   made (its `recipe`); a found piece by the recipe that makes its
//   template in its material - a Daggerfall weapon or plate in its metal
//   (Ebony's, never the Warforged's - loot is never Warforged), chain
//   the Steel's (the anvil's one chain), leather the Cured Leather's (DFU
//   has one leather), a garment the Linen's (DFU's cloth names none). A
//   staff, a bow, jewellery, a tool, a kit is none of this - the record
//   names the smith's and the tailor's alone. A found piece is Standard
//   until it is tempered (DFU's own item, 9.2).
// - The step is the WORK's: a found piece's condition and weight (its
//   Loot Rarity, its affixes, are its own - the Reforge's, below); a made
//   piece's record is re-signed at its new quality (41.2: "so the market
//   sees what it is") and the piece is what that record mints.
// - A save's own piece is the save's word, as its condition is: the
//   Stores' spend is the bound (41.2).
//
// ═══ REFORGE (41.2, DECIDED) ════════════════════════════════════════
//
// - Enchanting 50: one property of a Magic or Rare piece rolled again -
//   the Loot arc's own Reforge (systems/lootRarity.js reforgeAffix: one
//   line, and once a piece is reforged, that line alone) - for 2 (Magic)
//   or 5 (Rare) Arcane Essence from the Stores, in place of the Mages
//   Guild's shards and gold. The roll's seed is the service's.
// - DECIDED: no XP - the Essence's XP was its disenchanting's (a log's
//   was its fall's, PROF0 25's law).
//
// Legendary, Aetheric, Artifact and Sigil pieces are neither (law 7) - nor, since GILDED1 (systems/gilded.js), a Gilded
// one: a static roll is its record's to the last number.
// ═══════════════════════════════════════════════════════════════════

import { RECIPES, recipeById, QUALITY_EFFECTS, MASTERWORK, craftXp, ARMOR_LEATHER, ARMOR_CHAIN } from './recipeLaw.js';

/** The highest quality a temper reaches: Superior (QUALITY_NAMES[3]). */
export const TEMPER_TOP = 3;
/** The recipes' kinds a temper takes: the smith's weapons and metal armour, the tailor's leather and cloth. */
export const TEMPER_KINDS = Object.freeze(['weapon', 'plate', 'shield', 'chain', 'leather', 'garment']);
/** Whether a recipe's piece takes a temper. */
export const temperableRecipe = (/** @type {any} */ r) => !!r && TEMPER_KINDS.includes(r.kind);
/** The Loot Rarity tiers law 7 keeps from the crafter (GILDED1: the Gilded rung's too). */
export const TEMPER_SHUT = Object.freeze(['legendary', 'aetheric', 'artifact', 'gilded']);
/** A piece's quality as a temper reads it: a made or tempered piece's own, every other Daggerfall's (Standard). */
export const pieceQuality = (/** @type {any} */ item) => (Number.isInteger(item?.quality) ? item.quality : 1);

/**
 * THE RECIPE A PIECE IS TEMPERED BY: its own where it was made, else the one that makes its template in its material -
 * a weapon in its metal, plate and shields in theirs, chain the Steel's, leather the Cured Leather's, a garment the
 * Linen's. Null for a piece no temper takes.
 * @param {any} item
 */
export function temperRecipeOf(item) {
  if (!item) return null;
  if (typeof item.recipe === 'string') { const r = recipeById(item.recipe); return temperableRecipe(r) ? r : null; }
  const t = item.templateIndex, m = item.material ?? 0;
  if (item.group === 'Weapons') return RECIPES.find((r) => r.kind === 'weapon' && r.templateIndex === t && r.material === m) ?? null;
  if (item.group === 'Armor') {
    if (m === ARMOR_LEATHER) return RECIPES.find((r) => r.kind === 'leather' && r.templateIndex === t && r.leather === 'leather:cured') ?? null;
    if ((m & 0xff00) === ARMOR_CHAIN) return RECIPES.find((r) => r.kind === 'chain' && r.templateIndex === t) ?? null;
    return RECIPES.find((r) => (r.kind === 'plate' || r.kind === 'shield') && r.templateIndex === t && r.material === m) ?? null;
  }
  if (item.group === 'MensClothing' || item.group === 'WomensClothing') {
    return RECIPES.find((r) => r.kind === 'garment' && r.templateIndex === t && r.cloth === 'cloth:linen') ?? null;
  }
  return null;
}

/** What a temper spends: half the recipe's main input (its metal's ingots, its leather, its bolts), rounded up.
 *  @param {any} r */
export const temperCost = (r) => ({ key: r.inputs[0].key, n: Math.ceil(r.inputs[0].n / 2) });
/** A temper's XP: the craft's, at the recipe's tier (a quarter more than two tiers below the rank's top), no first.
 *  @param {any} r @param {number} rank */
export const temperXp = (r, rank) => craftXp(r.tier, rank, false);
/** Whether `q` is a quality a temper may raise: Crude, Standard or Fine (the service's door). */
export const temperFrom = (q) => Number.isInteger(q) && q >= 0 && q < TEMPER_TOP;

/**
 * WHY A PIECE MAY NOT BE TEMPERED, or null: 'not' (no recipe tempers it), 'masterwork' (a maker's), 'top' (Superior -
 * no step left), 'rarity' (Legendary, Aetheric, Artifact or Gilded - law 7), 'sigil' (a Sigil's piece - law 7).
 * @param {any} item
 */
export function temperRefusal(item) {
  if (!temperRecipeOf(item)) return 'not';
  if (item.sigil != null) return 'sigil';
  if (TEMPER_SHUT.includes(item.rarity) || item.artifact) return 'rarity';
  const q = pieceQuality(item);
  if (q === MASTERWORK) return 'masterwork';
  if (q >= TEMPER_TOP) return 'top';
  return null;
}

/** The share a step takes a piece's condition and weight by: the next quality's over its own (Standard to Fine: x1.15
 *  and x0.95). @param {number} q */
export function temperStep(q) {
  const from = QUALITY_EFFECTS[q], to = QUALITY_EFFECTS[q + 1];
  return { condition: to.condition / from.condition, weight: to.weight / from.weight };
}

// ─── THE REFORGE ─────────────────────────────────────────────────────

/** The Enchanting rank a Reforge with Essence asks (41.2: "Enchanting 50"). */
export const REFORGE_RANK = 50;
/** The Arcane Essence a Reforge takes, by the piece's tier (41.2: "2 (Magic) or 5 (Rare)"). */
export const REFORGE_ESSENCE = Object.freeze({ magic: 2, rare: 5 });
/** The Essence a piece's Reforge takes, or null for a tier it does not take (Legendary and up - law 7). */
export const reforgeEssence = (/** @type {string|null|undefined} */ tier) => (tier === 'magic' || tier === 'rare' ? REFORGE_ESSENCE[tier] : null);
