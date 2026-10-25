// @ts-check
// STAFF-EVENT THE REWARD (2026-10-24, mob: "what should we do for the mini bosses drop for loot?", "something like dagons
// leaderboard", "but not his ghear", "build that base", "but we will tweak the drop table"): A STAFF EVENT'S SPOILS -
// what one fighter's part in an event pays when its mini boss first falls, rolled from the relay's receipt. Design:
// bible/11-Multiplayer/Staff-Events.md section 9.
//
// PER PLAYER, AND THE SEED'S OWN - the gate's spoils' law (systems/gate/gateSpoils.js) and a town's thanks' makers
// (systems/raidSpoils.js): the receipt the relay signs for each earner (net/staffEvent/staffEventReceipt.js `e1`) carries
// a seed (`c`) and the earner's rank on the board (`r`), and everything here is rolled on `seededRng(c)`. NONE OF DAGON'S
// OWN: no Sigil Stone, no Regalia, no Dragonfire Oath, nothing gilded.
//
// THE DROP TABLE IS STAFF_SPOILS_TABLE, the one place to tweak it (mob: "we will tweak the drop table").
//
// GIVEN ONCE A RECEIPT, straight into the pack, through the spoils pool a town's thanks use (scenes/spoilsPool.js under
// RAID_SPOILS_KEYS, keyed `sev:<id>` - never a raid's `raid:<key>`): the relay hands the same receipt again after a
// reconnect, and it is spent; from the grant until a save holds them the pieces ride the device's record.
//
// Not a DFU member. Ledger A (STAFF-EVENT's row).
import { seededRng } from './wind/wind.js';
import { spoilsBase, magicOrBetter } from './gate/gateSpoils.js';
import { applyRarity, lastPass, techniquePass } from './loot/lootRarity.js';
import { t } from './textManager.js';

/**
 * THE DROP TABLE - every number the reward pays, here alone.
 * - `goldPerLevel`: every earner's gold a level of theirs, the seed varying it a fifth either way.
 * - `source`: the source each piece is laddered at (a treasure pile's, two thirds up the ladder, even luck).
 * - `everyone`: the pieces every earner gets, each its least tier ('magic' - Magic or better, by the source's chances).
 * - `top`: the pieces more for a place on the board (rank 1 to 10), each its least tier.
 * - `first`: the piece more for first place - Legendary `legendary` of the time, else its least tier.
 */
export const STAFF_SPOILS_TABLE = Object.freeze({
  goldPerLevel: 100,
  source: Object.freeze({ kind: 'pile', tier: 16, luck: 50 }),
  everyone: Object.freeze(['magic']),
  top: Object.freeze(['rare']),
  first: Object.freeze({ legendary: 0.1, least: 'rare' }),
});
/** The receipt's day as the spoils pool keys it spent: its event, never a raid's or a gate's. */
export const staffSpoilsDay = (/** @type {string} */ id) => `sev:${id}`;
/** The words. */
export const STAFF_SPOILS_TEXT = Object.freeze({
  granted: () => t('staffEvent.spoils', 'Your reward for the fight is in your pack.'),
});

const ORDER = ['magic', 'rare', 'legendary'];
/** A tier at least `least`, by the source's chances. @param {() => number} rolls @param {string} least */
function atLeast(rolls, least) {
  const got = magicOrBetter(rolls, STAFF_SPOILS_TABLE.source);
  return ORDER.indexOf(got) >= ORDER.indexOf(least) ? got : least;
}
/** @param {number} lv @param {string} tier @param {() => number} rolls */
function piece(lv, tier, rolls) {
  const item = spoilsBase(lv, rolls);
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };   // a Legendary with no record for its kind falls to Rare: read back off the item
}

/**
 * ONE FIGHTER'S SPOILS: `{ gold, pieces: [{ item, tier }] }` - every earner's pieces first, then the board's, then first
 * place's. The same seed, level, rank and world answer the same spoils.
 * @param {number} seed the receipt's `c` @param {number} level the player's @param {number} rank the receipt's `r` (0 past the board)
 */
export function rollStaffSpoils(seed, level, rank) {
  const T = STAFF_SPOILS_TABLE;
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const gold = Math.round(T.goldPerLevel * lv * (0.8 + 0.4 * rolls()));
  const pieces = T.everyone.map((least) => piece(lv, atLeast(rolls, least), rolls));
  if (rank >= 1) for (const least of T.top) pieces.push(piece(lv, atLeast(rolls, least), rolls));
  if (rank === 1) pieces.push(piece(lv, rolls() < T.first.legendary ? 'legendary' : atLeast(rolls, T.first.least), rolls));
  lastPass(pieces.map((p) => p.item), rolls);   // LOOT2: the ladder's last pass, after every piece
  techniquePass(pieces.map((p) => p.item), rolls);   // TECH1: a weapon's technique - LAST of all
  return { gold, pieces };
}

/** The spoils as the spoils pool hands them over (scenes/spoilsPool.js's pieces): each item, then the gold. Pure. */
export function staffSpoilsList(/** @type {number} */ seed, /** @type {number} */ level, /** @type {number} */ rank) {
  const s = rollStaffSpoils(seed, level, rank);
  return [...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier })), { kind: 'gold', gold: s.gold, tier: 'common' }];
}

/**
 * A RECEIPT'S SPOILS INTO THE PACK (scenes/world.js onRaidReceipt, for an `e1`): through `pool` (the town's thanks'
 * pool) under `lock` (the world's spoils lock), at `level`, once a receipt and account.
 * @param {{ grant: (o: any) => any }} pool @param {(f: () => any) => Promise<any>} lock
 * @param {{ v: string, s: string, c: number, r: number }} c the receipt's claims (readStaffReceipt) @param {number} level
 */
export function grantStaffSpoils(pool, lock, c, level) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  return lock(() => pool.grant({ day: staffSpoilsDay(c.v), acct: c.s, roll: () => staffSpoilsList(c.c, lv, c.r), text: STAFF_SPOILS_TEXT.granted() }))
    .catch((e) => console.warn('[sev] spoils', e?.message ?? e));
}
