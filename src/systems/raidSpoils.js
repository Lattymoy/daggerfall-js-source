// @ts-check
// RAID4b (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric +
// armor sets"): A TOWN'S THANKS - what one player's defence of a raided town pays, rolled from the relay's receipt.
// Design: bible/03-World/Raiding-Parties.md, "The rewards (RAID4)".
//
// PER PLAYER, AND THE SEED'S OWN. The receipt the relay signs at a town's cleanse for each account that struck a raider
// and stood in the town (net/raidReceipt.js `w1`) carries a seed (`c`, 32 bits of the relay's CSPRNG) and the raiding
// party (`y`: 0 knights, 1 bandits, 2 orcs), and everything here is rolled on `seededRng(c)` (systems/wind.js) - the
// gate's spoils' own law (systems/gateSpoils.js): every defender's thanks are their own. The roll reads the player's
// world as well as the seed (the level, the registered custom pieces), so what was rolled is what is kept -
// scenes/spoilsPool.js records the pieces themselves.
//
// THE ROLL, with the gate's own makers and less of everything: gold (RAID_SPOILS_GOLD_PER_LEVEL a level, the seed
// varying it a fifth either way), ONE piece Magic or better (gateSpoils.js spoilsBase - a weapon, a piece of armour or a
// jewel, never arrows - laddered at RAID_SPOILS_SOURCE: a treasure pile's, halfway up the ladder), KNOWN; and LAST, a
// piece of the raiding party's own Aetheric set RAID_SET_CHANCE of the time (systems/aetheric.js rollRaidSetPiece: the
// knights' Broken Oath, the bandits' Thief-Taker's Garb, the orcs' Orcsbane Harness), which one by the same seed.
//
// GIVEN ONCE A RECEIPT, straight into the pack (the spoils pool's `grant`, under RAID_SPOILS_KEYS - a pool of its own,
// so a town's receipts never push a boss's out of the list of those spent): the relay hands the same receipt again
// after a reconnect, and it is spent. From the grant until a save holds them the pieces ride the device's record, and
// the crash's door hands them back (the gate's AUDIT WBX S3 law, whole).
//
// Not a DFU member. Ledger A (RAID1's row).
import { seededRng } from './wind.js';
import { spoilsBase, magicOrBetter } from './gateSpoils.js';
import { applyRarity, lastPass, techniquePass } from './lootRarity.js';   // TECH1: the technique pass, a door's last draw
import { rollRaidSetPiece } from './aetheric.js';

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it) - a third of a boss's. */
export const RAID_SPOILS_GOLD_PER_LEVEL = 80;
/** The source the one Magic-or-better piece is laddered at: a treasure pile's, halfway up the ladder, even luck. */
export const RAID_SPOILS_SOURCE = Object.freeze({ kind: 'pile', tier: 12, luck: 50 });
/** The device's record of a town's thanks no save holds yet, and the receipts spent - the spoils pool's two keys, a
 *  town's own. */
export const RAID_SPOILS_KEYS = Object.freeze({ store: 'raid4.spoils', day: 'raid4.spoilsDay' });
/** The words. */
export const RAID_SPOILS_TEXT = Object.freeze({
  granted: 'The town\'s thanks are in your pack.',
  recovered: 'A town\'s thanks are in your pack.',
  kept: (name) => `The town's thanks wait for ${name || 'the one who fought'}.`,   // AUDIT RAID R4: another character's
});
/** AUDIT RAID R8a: the town's thanks the device keeps a crash's record of - many a session, where a boss's is one a day. */
export const RAID_SPOILS_RECORDS_MAX = 32;
/** A raid's receipt as the pool keys it spent: its raid, never a whole number (a gate's day is one). */
export const raidSpoilsDay = (w) => `raid:${w}`;

/**
 * A TOWN'S THANKS for one player: `{ gold, pieces: [{ item, tier }] }` - the Magic-or-better piece first, the party's
 * set piece (when one comes) last. The same seed, level, party and world answer the same thanks.
 * @param {number} seed the receipt's `c` @param {number} level the player's @param {number} party the receipt's `y`
 */
export function rollRaidSpoils(seed, level, party) {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const gold = Math.round(RAID_SPOILS_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls()));
  const item = spoilsBase(lv, rolls);
  const tier = magicOrBetter(rolls, RAID_SPOILS_SOURCE);
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  const pieces = [{ item, tier: item.rarity ?? tier }];   // a Legendary with no record for its kind falls to Rare: read back off the item
  const set = rollRaidSetPiece(party, rolls);   // LAST: every thanks before it stays what it was for its seed
  if (set) pieces.push({ item: set, tier: set.rarity });
  lastPass([item], rolls);   // LOOT2: the ladder's last pass, after the set piece - its earlier draws stay its seed's
  techniquePass([item], rolls);   // TECH1: a weapon's technique - LAST of all (law 9)
  return { gold, pieces };
}

/** The thanks as the spoils pool hands them over (scenes/spoilsPool.js's pieces): each item, then the gold. Pure. */
export function raidSpoilsList(seed, level, party) {
  const s = rollRaidSpoils(seed, level, party);
  return [...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier })), { kind: 'gold', gold: s.gold, tier: 'common' }];
}
