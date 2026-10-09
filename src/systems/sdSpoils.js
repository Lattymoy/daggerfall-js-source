// @ts-check
// SD9e (2026-10-07, the Super Dungeons arc; bible/11-Multiplayer/Super-Dungeons.md section 11): THE BRASS REMNANT'S SPOILS -
// what one fighter's share of the Last Moment pays, rolled from the relay's receipt. The gate's spoils' and the serpent's
// hoard's twin (systems/gateSpoils.js, systems/serpentSpoils.js).
//
// PER FIGHTER, AND THE SEED'S OWN. The receipt the relay signs at the fall (net/sdReceipt.js `h1`) carries a seed (`c`,
// 32 bits of the relay's CSPRNG) and the level the fight admitted its account at (`l`), and everything here is rolled on
// `seededRng(c)` (systems/wind.js): every fighter's spoils are their own. The roll reads the player's world as well as the
// seed (the level, the registered custom pieces), so what was rolled is what is kept - scenes/spoilsPool.js records the
// pieces themselves. A fighter who dealt and one who stood are paid alike, as the gate pays them.
//
// THE ROLL, with the gate's own makers - section 11's table: gold (SD_SPOILS_GOLD_PER_LEVEL a level, the seed varying it
// a fifth either way); ONE piece Legendary SD_SPOILS_LEGENDARY of the time, else Rare; TWO Rare or better by the
// source's chances (SD_SPOILS_SOURCE - a boss past the ladder's top tier, a lucky hand: the hardest fight in the game);
// every piece KNOWN, the ladder's last pass after them (LOOT2); then (SD9d) a piece of the Brass of Numidium
// NUMIDIUM_SET_CHANCE of the time (systems/aetheric.js rollNumidiumPiece); and LAST OF ALL (GILDED1) the Hourlock, the
// Gilded rung's one record, GILDED_CHANCE of the time (systems/gilded.js rollHourlock) - so no roll before either ever moves.
//
// THROWN FROM WHERE IT FELL (scenes/sdSpoils.js): the spoils pool's burst on the arena's floor, under keys of its own
// (SD_SPOILS_KEYS - an Hour's receipts never push a boss's or a hoard's out of the spent list); a receipt that comes
// outside its realm is its spoils straight into the pack (the pool's `grant`).
//
// Not a DFU member. Ledger A (SUPER-DUNGEONS).
import { seededRng } from './wind.js';
import { spoilsBase } from './gateSpoils.js';
import { applyRarity, rarityChances, lastPass } from './lootRarity.js';
import { rollNumidiumPiece } from './aetheric.js';   // SD9d: the Brass Remnant's own set
import { rollHourlock } from './gilded.js';   // GILDED1: the Hourlock - the spoils' last roll
import { RANDOM_TREASURE_ICONS } from './loot.js';
import { bossCardRoll } from './bossCards.js';   // CARDS9: the Brass Remnant's own card, the hoard's last draw

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it) - over half again a gate boss's. */
export const SD_SPOILS_GOLD_PER_LEVEL = 400;
/** The first piece is Legendary this share of the time, else Rare. */
export const SD_SPOILS_LEGENDARY = 0.25;
/** The source the two Rare-or-better pieces are laddered at: a boss, past the ladder's top tier, a lucky hand. */
export const SD_SPOILS_SOURCE = Object.freeze({ boss: true, tier: 24, luck: 70 });
/** The device's record of spoils no save holds yet, and the receipts spent - the spoils pool's two keys, the Hour's own. */
export const SD_SPOILS_KEYS = Object.freeze({ store: 'sd9.spoils', day: 'sd9.spoilsDay' });
/** The spoils the device keeps a crash's record of (a Hollow rises after a rest: a few a week). */
export const SD_SPOILS_RECORDS_MAX = 8;
/** The words: the burst on the arena's floor (scenes/sdSpoils.js), what leaving it gathers, spoils given outside the
 *  realm, and the crash's door. */
export const SD_SPOILS_TEXT = Object.freeze({
  spilled: 'Your spoils spill across the arena floor.',
  none: 'No spoils. Your part in the fight was too small.',
  gathered: 'The spoils of the Last Moment are in your pack.',
  granted: 'Your share of the Brass Remnant\'s spoils is in your pack.',
  recovered: 'The Brass Remnant\'s spoils are in your pack.',
});
/** An Hour's receipt as the pool keys it spent: its slot, never a gate's bare day. */
export const sdSpoilsDay = (d) => `sd:${d}`;
/** The slot a spent key names, or null. Pure. */
export function sdSpoilsSlot(day) {
  const m = typeof day === 'string' ? /^sd:(\d{1,9})$/.exec(day) : null;
  const s = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(s) && s >= 1 ? s : null;
}

/** A Rare-or-better tier by the source's own chances, the Common and Magic shares cut away. Pure.
 * @param {() => number} rolls @param {{ kind?: string, tier?: number, boss?: boolean, luck?: number }} [source] */
export function rareOrBetter(rolls, source = SD_SPOILS_SOURCE) {
  const c = rarityChances(source);
  return rolls() * c.rare < c.legendary ? 'legendary' : 'rare';
}

/** A piece laddered to its tier and known (applyRarity's own fall from Legendary is read back off the item). */
function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}

/**
 * THE SPOILS for one fighter: `{ gold, pieces: [{ item, tier }] }` - in the order they leave it: the first piece, the two
 * Rare-or-better, then (SD9d) a piece of the Brass of Numidium when one drops, then (GILDED1) the Hourlock when it does.
 * The same seed, level and world answer the same spoils.
 * @param {number} seed the receipt's `c` @param {number} level the level it fought at
 */
export function rollSdSpoils(seed, level) {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const gold = Math.round(SD_SPOILS_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls()));
  const pieces = [];
  pieces.push(graded(spoilsBase(lv, rolls), rolls() < SD_SPOILS_LEGENDARY ? 'legendary' : 'rare', rolls));
  for (let i = 0; i < 2; i++) pieces.push(graded(spoilsBase(lv, rolls), rareOrBetter(rolls), rolls));
  lastPass(pieces.map((p) => p.item), rolls);
  // SD9d: THE BRASS OF NUMIDIUM - rolled after every piece, so every spoils before it is what it was for its seed
  const brass = rollNumidiumPiece(rolls);
  if (brass) pieces.push({ item: brass, tier: brass.rarity });
  // GILDED1: THE HOURLOCK - one draw more, LAST of all, so every spoils before it (the Brass's own) is what it was
  const hourlock = rollHourlock(rolls);
  if (hourlock) pieces.push({ item: hourlock, tier: hourlock.rarity });
  // CARDS9 (Tavern-Cards section 30; Mac: "Dont forget about a card needing to come from the abyss dungeon also"): THE
  // BRASS REMNANT'S OWN CARD - one draw more after the Hourlock's, LAST of all; kept beside the pieces
  const card = bossCardRoll('abyss', rolls);
  return { gold, pieces, card };
}

/** The spoils as the pool throws them (scenes/spoilsPool.js's pieces): each item, then the gold - the gate's own order -
 *  each dressed in the treasure flat the seed chooses (the pile a piece stands as until its own picture loads). Pure. */
export function sdSpoilsList(seed, level) {
  const look = seededRng(((seed >>> 0) ^ 0x5eed) >>> 0);
  const flat = () => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
  const s = rollSdSpoils(seed, level);
  return [
    ...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier, record: flat() })),
    ...(s.card ? [{ kind: 'item', item: s.card, tier: 'aetheric', record: flat() }] : []),   // CARDS9: the Remnant's card, after the pieces
    { kind: 'gold', gold: s.gold, tier: 'common', record: flat() },
  ];
}
