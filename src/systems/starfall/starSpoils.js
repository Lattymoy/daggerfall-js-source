// @ts-check
// STAR7 (2026-10-20): A HELD STAR'S SPOILS - what one defender's share in a held star pays, rolled from the relay's
// receipt. The raid's thanks' twin (systems/raidSpoils.js), rung for rung: a star is held three times an hour while the
// festival runs, as a town is raided through the day. Design: bible/11-Multiplayer/Starfall.md section 6.
//
// PER PLAYER, AND THE SEED'S OWN. The receipt the relay signs at the master's fall (net/starfall/starReceipt.js `j1`)
// carries a seed (`c`, 32 bits of the relay's CSPRNG), and everything here is rolled on `seededRng(c)` (systems/wind/wind.js):
// every defender's spoils are its own. The Heart-Star is not in the receipt: it is the sky's (systems/starfall/starfallNight.js
// heartStar), read off the receipt's night and star alike on every device.
//
// THE ROLL: gold (STAR_SPOILS_GOLD_PER_LEVEL a level, the seed varying it a fifth either way); one to three pieces of
// Starglass (systems/starfall/starglass.js); ONE piece Magic or better, KNOWN, laddered at the town's thanks' own source; and
// LAST, a piece of the Starspun Weave STARSPUN_SET_CHANCE of the time (systems/aetheric.js rollStarspunPiece). The Heart-Star
// doubles the gold and the Starglass and always carries a Starspun piece. The ladder's last pass after the set piece, the
// technique pass last of all (LOOT2, TECH1's law 9), so every draw before them stays the seed's.
//
// GIVEN WHEN THE SERVICE SAYS SO (net/starfall/starClaims.js onSpoils - the raids' AUDIT RAID R4 law: the account service's
// spoils row is written once a star and account, so a second browser or a phone is answered no), straight into the pack
// through a spoils pool of its own keys (STAR_SPOILS_KEYS); from the grant until a save holds them the pieces ride the
// device's record, and the crash's door hands them back.
//
// Not a DFU member. Ledger A (STARFALL).
import { seededRng } from '../wind/wind.js';
import { spoilsBase, magicOrBetter } from '../gate/gateSpoils.js';
import { applyRarity, lastPass, techniquePass } from '../loot/lootRarity.js';
import { rollStarspunPiece } from '../aetheric.js';
import { RAID_SPOILS_SOURCE } from '../raidSpoils.js';
import { starglass } from './starglass.js';
import { heartStar } from './starfallNight.js';
import { t } from '../textManager.js';

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it) - under a town's thanks: a star is held
 *  three times an hour. */
export const STAR_SPOILS_GOLD_PER_LEVEL = 60;
/** Starglass in a star's spoils: one to this many; the Heart-Star doubles it. */
export const STARGLASS_MAX = 3;
/** The device's record of a star's spoils no save holds yet, and the receipts spent - the spoils pool's two keys, the
 *  star's own. */
export const STAR_SPOILS_KEYS = Object.freeze({ store: 'star7.spoils', day: 'star7.spoilsDay' });
/** The spoils the device keeps a crash's record of - many a night, as a town's thanks are. */
export const STAR_SPOILS_RECORDS_MAX = 32;
/** A star's receipt as the pool keys it spent: its night and star, never a gate's bare day. */
export const starSpoilsDay = (n, k) => `star:${n}.${k}`;
/** The words. */
export const STAR_SPOILS_TEXT = Object.freeze({
  granted: () => t('starfall.spoils.granted', 'The star\'s spoils are in your pack.'),   // AUDIT STAR (W5): gold, Starfall Glass and a piece, never the glass alone
  recovered: () => t('starfall.spoils.recovered', 'A fallen star\'s spoils are in your pack.'),
  kept: (name) => (name ? t('starfall.spoils.keptFor', 'A fallen star\'s spoils wait for {name}.', { name }) : t('starfall.spoils.kept', 'A fallen star\'s spoils wait for the one who held it.')),
});

/**
 * A HELD STAR'S SPOILS for one player: `{ gold, starglass, pieces: [{ item, tier }] }` - the Magic-or-better piece first,
 * the Starspun piece (when one comes) last; `starglass` its stack. The same seed, level, star and world answer the same
 * spoils.
 * @param {number} seed the receipt's `c` @param {number} level the level it held at @param {number} n the night @param {number} k the star
 */
export function rollStarSpoils(seed, level, n, k) {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const twice = heartStar(n, k) ? 2 : 1;
  const gold = Math.round(STAR_SPOILS_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls())) * twice;
  const glass = starglass((1 + Math.min(STARGLASS_MAX - 1, Math.floor(rolls() * STARGLASS_MAX))) * twice);
  const item = spoilsBase(lv, rolls);
  const tier = magicOrBetter(rolls, RAID_SPOILS_SOURCE);
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  const pieces = [{ item, tier: item.rarity ?? tier }];   // a Legendary with no record for its kind falls to Rare: read back off the item
  const set = rollStarspunPiece(rolls, twice === 2);   // LAST: every spoils before it stays what it was for its seed
  if (set) pieces.push({ item: set, tier: set.rarity });
  lastPass([item], rolls);   // LOOT2: the ladder's last pass, after the set piece
  techniquePass([item], rolls);   // TECH1: a weapon's technique - LAST of all (law 9)
  return { gold, starglass: glass, pieces };
}

/** The spoils as the spoils pool hands them over (scenes/spoilsPool.js's pieces): each item, the Starglass, then the gold.
 *  Pure. */
export function starSpoilsList(seed, level, n, k) {
  const s = rollStarSpoils(seed, level, n, k);
  return [...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier })), { kind: 'item', item: s.starglass, tier: 'common' }, { kind: 'gold', gold: s.gold, tier: 'common' }];
}
