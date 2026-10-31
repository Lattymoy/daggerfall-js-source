// @ts-check
// DRAGON4 (bible/11-Multiplayer/Dwarven-Dragon.md section 8): THE DRAGON'S HOARD - what one player's share in its kill pays,
// rolled from the relay's `z1` receipt on the receipt's own seed (`c`, seededRng): the serpent's hoard's law
// (systems/serpent/serpentSpoils.js), rung for rung. Gold, DRAGON_GOLD_PER_LEVEL a level and a fifth either way (a
// stander STOOD_GOLD of it); a dealer one piece Rare or better (Legendary DRAGON_SPOILS_LEGENDARY of the time) and one
// Magic or better; a stander the Magic-or-better piece alone. Every piece known, the ladder's last passes over them. Given
// when the account service says this claim is its (watch, place, account)'s, straight into the pack. Not a DFU member. Ledger A
// (DRAGON).
import { seededRng } from '../wind/wind.js';
import { spoilsBase, magicOrBetter } from '../gate/gateSpoils.js';
import { applyRarity, lastPass, socketPass, weaponSocketPass, techniquePass } from '../loot/lootRarity.js';
import { STOOD_GOLD, SERPENT_SPOILS_SOURCE } from '../serpent/serpentSpoils.js';   // a stander's share and the boss's ladder, the serpent's own
import { DRAGON_SPOILS_TEXT } from './dragonWords.js';

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it). */
export const DRAGON_GOLD_PER_LEVEL = 180;
/** The Rare-or-better piece is Legendary this share of the time. */
export const DRAGON_SPOILS_LEGENDARY = 0.15;
/** The device's record of a hoard no save holds yet, and the receipts spent - the dragon's own spoils-pool keys. */
export const DRAGON_SPOILS_KEYS = Object.freeze({ store: 'dragon4.spoils', day: 'dragon4.spoilsDay' });
export const DRAGON_SPOILS_RECORDS_MAX = 16;
/** A dragon's receipt as the pool keys it spent: its watch and place (DRAGON-EACH); one from before it, its watch. */
export const dragonSpoilsDay = (w, p) => (p === undefined ? `dragon:${w}` : `dragon:${w}:${p}`);
export { DRAGON_SPOILS_TEXT };

/** A piece laddered to its tier and known. */
function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}

/**
 * THE HOARD for one player: `{ gold, pieces: [{ item, tier }] }`, the Rare-or-better piece first. The same seed, level,
 * earning and world answer the same hoard.
 * @param {number} seed the receipt's `c` @param {number} level the level it fought at @param {string} earned the receipt's `x`
 */
export function rollDragonSpoils(seed, level, earned = 'dealt') {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const dealt = earned !== 'stood';
  const gold = Math.round(DRAGON_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls()) * (dealt ? 1 : STOOD_GOLD));
  const pieces = [];
  if (dealt) pieces.push(graded(spoilsBase(lv, rolls), rolls() < DRAGON_SPOILS_LEGENDARY ? 'legendary' : 'rare', rolls));
  pieces.push(graded(spoilsBase(lv, rolls), magicOrBetter(rolls, SERPENT_SPOILS_SOURCE), rolls));
  const items = pieces.map((p) => p.item);
  lastPass(items, rolls);
  socketPass(items, rolls);
  weaponSocketPass(items, rolls);
  techniquePass(items, rolls);
  return { gold, pieces };
}

/** The hoard as the spoils pool hands it over: each item, then the gold. Pure. */
export function dragonSpoilsList(seed, level, earned) {
  const s = rollDragonSpoils(seed, level, earned);
  return [...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier })), { kind: 'gold', gold: s.gold, tier: 'common' }];
}
