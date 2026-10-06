// @ts-check
// SERPENT1 (2026-10-04, Mac: "a large scale sea serpent in the ocean"): THE OLD COIL'S HOARD - what one player's share in
// Sethrakul's kill pays, rolled from the relay's receipt. The gate's spoils' and the raid's thanks' twin
// (systems/gateSpoils.js, systems/raidSpoils.js). Design: bible/11-Multiplayer/Sea-Serpent.md section 8.
//
// PER PLAYER, AND THE SEED'S OWN. The receipt the relay signs at the kill (net/serpentReceipt.js `l1`) carries a seed
// (`c`, 32 bits of the relay's CSPRNG) and how it was earned (`x`: 'dealt' - a ship whose guns did their share of the
// harm - or 'stood' - one that held its waters through the fight), and everything here is rolled on `seededRng(c)`
// (systems/wind.js): every crew's hoard is its own. The roll reads the player's world as well as the seed (the level,
// the registered custom pieces), so what was rolled is what is kept - scenes/spoilsPool.js records the pieces themselves.
//
// THE ROLL, with the gate's own makers: gold (SERPENT_SPOILS_GOLD_PER_LEVEL a level, the seed varying it a fifth either
// way - STOOD_GOLD of it for a ship that stood), and for a ship that DEALT, ONE piece Rare or better (Legendary
// SERPENT_SPOILS_LEGENDARY of the time - the sea's wrecks are older than the gate's) and ONE Magic or better laddered at
// SERPENT_SPOILS_SOURCE; for one that STOOD, the Magic-or-better piece alone. Every piece KNOWN, the ladder's last pass
// last of all (LOOT2).
//
// SERPENT-SET (2026-10-05, Mac: "The serpent boss needs to use the currency from oblivion gate and have its own
// equipment rewards"): THE GATE'S CURRENCY AND THE SERPENT'S OWN SET. Every hoard carries SERPENT_EMBERS Deadlands Embers
// (net/serpentHoardLaw.js - a ship that dealt and one that stood alike, the gate's own law: an ember a receipt), minted as the
// gate mints them (systems/gateSpoils.js sigilStone) and counted on the kill's row by the account service, so the Broker
// and the insignia take them as a breach's. A ship that DEALT finds a piece of Sethrakul's Coilscale SERPENT_SET_CHANCE
// of the time (systems/aetheric.js rollSerpentSetPiece) - rolled after the ladder's last pass, so every hoard rolled
// before it is what it was for its seed; the ember takes no roll at all.
//
// GIVEN WHEN THE SERVICE SAYS SO (net/serpentClaims.js onSpoils - the raids' AUDIT RAID R4 law: the account service's
// hoard row is written once a serpent and account, so a second browser or a phone is answered no), straight into the
// pack through a spoils pool of its own keys (SERPENT_SPOILS_KEYS); from the grant until a save holds them the pieces
// ride the device's record, and the crash's door hands them back.
//
// Not a DFU member. Ledger A (SERPENT1).
import { seededRng } from './wind.js';
import { spoilsBase, magicOrBetter, sigilStone } from './gateSpoils.js';
import { applyRarity, lastPass } from './lootRarity.js';
import { rollSerpentSetPiece } from './aetheric.js';   // SERPENT-SET: the Old Coil's own
import { SERPENT_EMBERS } from '../net/serpentHoardLaw.js';   // SERPENT-SET: the gate's currency

/** Gold a level of the player's, before the seed's variation (0.8 to 1.2 of it) - two thirds of a gate boss's. */
export const SERPENT_SPOILS_GOLD_PER_LEVEL = 160;
/** A ship that stood, not dealt: this share of the gold. */
export const STOOD_GOLD = 0.6;
/** The Rare-or-better piece is Legendary this share of the time. */
export const SERPENT_SPOILS_LEGENDARY = 0.15;
/** The source the Magic-or-better piece is laddered at: a boss, high on the ladder, a player's even luck. */
export const SERPENT_SPOILS_SOURCE = Object.freeze({ boss: true, tier: 18, luck: 50 });
/** The device's record of a hoard no save holds yet, and the receipts spent - the spoils pool's two keys, the serpent's
 *  own (a serpent's receipts never push a boss's or a town's out of the spent list). */
export const SERPENT_SPOILS_KEYS = Object.freeze({ store: 'serpent1.spoils', day: 'serpent1.spoilsDay' });
/** The hoards the device keeps a crash's record of. */
export const SERPENT_SPOILS_RECORDS_MAX = 16;
/** A serpent's receipt as the pool keys it spent: its day, never a gate's bare day. */
export const serpentSpoilsDay = (d) => `serpent:${d}`;
/** The words - the serpent named off the receipt's boss (net/serpentLaw.js SERPENT_BOSSES). AUDIT SERPENT B10: the
 *  hoard goes into the pack, and the words say no more than that (never a ship's hold it is not in); B11: the name is the
 *  table's, never written here. */
export const SERPENT_SPOILS_TEXT = Object.freeze({
  granted: (boss) => `${boss.name}'s hoard is yours - it is in your pack.`,
  recovered: 'A sea serpent\'s hoard is in your pack.',
  kept: (name, boss) => `${boss.name}'s hoard waits for ${name || 'the one who fought it'}.`,
});

/** A piece laddered to its tier and known (applyRarity's own fall from Legendary is read back off the item). */
function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}

/** SERPENT-SET: the hoard's embers - one stack of SERPENT_EMBERS Deadlands Embers, minted as the gate's (no roll taken). */
export function serpentEmbers() {
  return SERPENT_EMBERS > 0 ? Object.assign(sigilStone(), { stackCount: SERPENT_EMBERS }) : null;
}

/**
 * THE HOARD for one player: `{ gold, pieces: [{ item, tier }], embers }` - the Rare-or-better piece first, SERPENT-SET's
 * Coilscale piece (when one drops) last; `embers` the stack of the gate's currency every hoard carries. The same seed,
 * level, earning and world answer the same hoard.
 * @param {number} seed the receipt's `c` @param {number} level the level it fought at @param {string} earned the receipt's `x`
 */
export function rollSerpentSpoils(seed, level, earned = 'dealt') {
  const rolls = seededRng(seed >>> 0);
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const dealt = earned !== 'stood';
  const gold = Math.round(SERPENT_SPOILS_GOLD_PER_LEVEL * lv * (0.8 + 0.4 * rolls()) * (dealt ? 1 : STOOD_GOLD));
  const pieces = [];
  if (dealt) pieces.push(graded(spoilsBase(lv, rolls), rolls() < SERPENT_SPOILS_LEGENDARY ? 'legendary' : 'rare', rolls));
  pieces.push(graded(spoilsBase(lv, rolls), magicOrBetter(rolls, SERPENT_SPOILS_SOURCE), rolls));
  lastPass(pieces.map((p) => p.item), rolls);
  // SERPENT-SET: the Old Coil's own set, a dealer's alone - rolled LAST, so every hoard before it is what it was
  const coil = dealt ? rollSerpentSetPiece(rolls) : null;
  if (coil) pieces.push({ item: coil, tier: coil.rarity });
  return { gold, pieces, embers: serpentEmbers() };
}

/** The hoard as the spoils pool hands it over (scenes/spoilsPool.js's pieces): each item, then (SERPENT-SET) the embers,
 *  then the gold - the gate's own order. The embers wear the gate's glow tier (scenes/spoilsPool.js SIGIL_TIER), which
 *  only the crash's record keeps here: the hoard has no floor. Pure. */
export function serpentSpoilsList(seed, level, earned) {
  const s = rollSerpentSpoils(seed, level, earned);
  return [
    ...s.pieces.map((p) => ({ kind: 'item', item: p.item, tier: p.tier })),
    ...(s.embers ? [{ kind: 'item', item: s.embers, tier: 'artifact' }] : []),
    { kind: 'gold', gold: s.gold, tier: 'common' },
  ];
}
