// @ts-check
// DELVE II (bible/03-World/Delve-II.md section 6): THE VAULT'S ROLL - the dungeon's own treasure pile's
// (scenes/dungeonContext.js rollPileItems: its tables, its tier's odds, LOOT-GATE's rarity). DELVE-VAULT (2026-10-31, the
// owner: "the rewards for these are really really bad"): beside the pile, gold by the level and one known piece Magic or
// better - the raids' and the stars' spoils' shape (systems/raidSpoils.js), laddered at the dungeon's own pile source and
// held back by the opener's level as any dungeon chest is. No new rung or band: POWER-CEILING holds. Not a DFU member
// (Ledger A: DELVE II).
import { goldStack } from '../inventory.js';
import { spoilsBase, magicOrBetter } from '../gate/gateSpoils.js';
import { applyRarity, lastPass, techniquePass, pileSource, dungeonRarityTier, dungeonFamily, lootRarityOn } from '../loot/lootRarity.js';
import { ELITE_LOOT_QUALITY_MULT } from '../../world/spawnedDungeons.js';

/** Gold a level of the opener's, before the roll's variation (0.8 to 1.2 of it): half a raided town's thanks. */
export const DELVE_VAULT_GOLD_PER_LEVEL = 40;

const levelOf = (level) => Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));

/** The source the vault's piece is laddered at: the dungeon's own pile's - its type's tier, an Elite's quality, its family -
 *  at the opener's level (LOOT-GATE). Pure. @param {number|undefined} dungeonType @param {boolean} elite @param {number} level */
export function vaultSource(dungeonType, elite, level) {
  return { ...pileSource(dungeonRarityTier(dungeonType)), qualityMult: elite ? ELITE_LOOT_QUALITY_MULT : 1, family: dungeonFamily(dungeonType), rollerLevel: levelOf(level) };
}

/** One known piece - a weapon, a piece of armour or a jewel, never arrows - Magic or better at `source` (the ladder off,
 *  a plain one). @param {number} level @param {any} source @param {() => number} rolls */
export function vaultPiece(level, source, rolls = Math.random) {
  const piece = spoilsBase(levelOf(level), rolls);
  if (lootRarityOn()) {
    applyRarity(piece, magicOrBetter(rolls, source), rolls, null, { family: source?.family ?? null });
    lastPass([piece], rolls);
    techniquePass([piece], rolls);
  }
  piece.isIdentified = true;
  return piece;
}

/** The vault's items: the piece first, the pile's roll, then the gold. Pure but for `roll` and `rolls`.
 *  @param {() => any[]} roll @param {number} level @param {any} [source] @param {() => number} [rolls] @returns {any[]} */
export function rollVault(roll, level, source = vaultSource(undefined, false, level), rolls = Math.random) {
  const lv = levelOf(level);
  const pile = roll();
  const piece = vaultPiece(lv, source, rolls);
  const gold = goldStack(Math.round(DELVE_VAULT_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls())));
  return [piece, ...(Array.isArray(pile) ? pile : []), gold];
}
