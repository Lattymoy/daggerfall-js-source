// @ts-check
// EG-E (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, REWARDS AND THE
// ECONOMY): A REDOUBT'S SPOILS - what one earner's Redoubt pays in the pack, rolled on the secret seed the relay put on
// their `w` receipt (net/eliteGates/egReceipt.js `c`) at the level the breach admitted them (`l`), the Hour's and the gate's twin
// (systems/superDungeon/sdSpoils.js, systems/gate/gateSpoils.js).
//
// THE ROLL, in rollSdSpoils' order - every new draw after the last, as SET6's law requires: gold (EG_SPOILS_GOLD_PER_LEVEL
// a level, a tenth more a Redoubt to EG_SPOILS_GOLD_MAX times, the seed varying it a fifth either way); ONE Rare or
// Legendary piece (the Legendary egLegendaryShare of the time - 20% at Redoubt 1 to 65% at 16); ONE TO THREE
// magicOrBetter at a boss's source; A PANOPLY PIECE when the Panoply's own draw says so (net/eliteGates/egPay.js egPanoplyHit - its
// own stream, so the account service reads a miss for its pity without the ladder) or the service's pity forces it,
// the piece's choice ONE draw, always taken; THE LORD'S NAMED LEGENDARY 1 in EG_LORD_ARM_IN (systems/eliteGates/egLordArms.js);
// the ladder's last pass; THE LORD'S CARD (systems/bossCards.js bossCardRoll by its key); then the sockets, the gem and
// the technique pass, the gate's.
//
// A VALKYNAZ'S REDOUBT ROLLS TWICE, two seeds from the receipt's (net/eliteGates/egPay.js egPassSeed). THE WEEK: a Redoubt's number
// pays once an account an arena week - the account service answers whether this claim paid (server-account/src/eg.js),
// and one that did not pays its gold alone (`goldOnly`).
//
// AUDIT EG III (lane2 #1; section 16.3): THE RELIQUARIES' ROLLS - each Reliquary a good end opens (the end receipt's `rl` as
// the account service answers it: the circles that pay this week) is one more pass at its Redoubt's depth, rolled on its own
// seed off the END receipt's (egReliquarySeed), its Panoply at twice the Redoubt's chance (EG_RELIQUARY_PANOPLY_X, its own
// stream - no pity: the service never sees a Reliquary's roll), no lord's arm nor card (a Reliquary is no lord's).
//
// AUDIT EG V (2026-10-15; sections 16.1, 16.3 and 19): THE SEED IS THE CLAIM'S - a receipt's spoils and an end's Reliquaries
// roll on the seed the account service answers its claim with (`seed` - net/eliteGates/egPay.js egSpoilsSeed: the receipt's `c` mixed
// with the service's own draw), never the receipt's own, which the page could read and roll ahead (lane8 L8-5); and A PAID
// REDOUBT'S DEADLANDS EMBERS are in its spoils - one stack of the gate's currency, as many as the service paid (the claim's
// `embers`, the row's `stones`), which the Broker's insignia and the Panoply's sink take from the pack (lane8 L8-2).
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { seededRng } from '../wind/wind.js';
import { spoilsBase, magicOrBetter, sigilStone, SPOILS_SOURCE } from '../gate/gateSpoils.js';
import { applyRarity, lastPass, socketPass, weaponSocketPass, techniquePass } from '../loot/lootRarity.js';
import { bossGems } from '../gems.js';
import { bossCardRoll } from '../bossCards.js';
import { mintPanoplyPiece } from '../aetheric.js';   // EG15: THE BATTLEMAGE'S PANOPLY's nine records - which piece, one draw
import { egLordArm } from './egLordArms.js';
import { RANDOM_TREASURE_ICONS } from '../loot/loot.js';
import { egSpoilsPasses, egPassSeed, egPanoplyHit, egLegendaryShare, EG_LORD_ARM_IN } from '../../net/eliteGates/egPay.js';
import { egPanoplyDraw, egPanoplyIn } from '../../net/eliteGates/egPay.js';   // AUDIT EG III: a Reliquary's Panoply, twice the chance

/** Gold a level of the earner's at Redoubt 1, before the seed's variation (0.8 to 1.2 of it). */
export const EG_SPOILS_GOLD_PER_LEVEL = 200;
/** Each Redoubt past the first adds this share of it, to EG_SPOILS_GOLD_MAX times (Redoubt 21). */
export const EG_SPOILS_GOLD_STEP = 0.1;
export const EG_SPOILS_GOLD_MAX = 3;
/** The device's record of spoils no save holds yet, and the receipts spent - the spoils pool's two keys, the Spire's own. */
export const EG_SPOILS_KEYS = Object.freeze({ store: 'eg.spoils', day: 'eg.spoilsDay' });
/** The spoils the device keeps a crash's record of (a few Redoubts a breach, a breach or two a week). */
export const EG_SPOILS_RECORDS_MAX = 12;
/** The words: the burst at the Redoubt's beacon, what leaving gathers, spoils given outside the Spire, the crash's door. */
export const EG_SPOILS_TEXT = Object.freeze({
  spilled: "The Redoubt's spoils spill from the beacon.",
  gathered: "The Redoubt's spoils are in your pack.",
  granted: (w) => `Your spoils from Redoubt ${w} are in your pack.`,
  goldOnly: (w) => `You already took Redoubt ${w} this week. You get its gold, and each of its Reliquaries gives 20 lumen.`,
  opened: (n) => (n === 1 ? 'Your Reliquary opens: its spoils are in your pack.' : `Your ${n} Reliquaries open: their spoils are in your pack.`),   // AUDIT EG III
  guest: 'Add a username to keep the Spire\'s spoils. Its gold is yours.',
  recovered: "The Spire's spoils are in your pack.",
});
/** A Redoubt's receipt as the pool keys it spent: its breach and its number. */
export const egSpoilsDay = (b, w) => `eg:${b}:${w}`;
/** The breach and Redoubt a spent key names, or null. Pure. */
export function egSpoilsOf(day) {
  const m = typeof day === 'string' ? /^eg:([0-9a-f]{16}):(\d{1,5})$/.exec(day) : null;
  return m ? { b: m[1], w: Number(m[2]) } : null;
}

/** A piece laddered to its tier and known (applyRarity's own fall from Legendary read back off the item). */
function graded(item, tier, rolls) {
  applyRarity(item, tier, rolls);
  item.isIdentified = true;
  return { item, tier: item.rarity ?? tier };
}
/** The gold of Redoubt `w` at level `lv`, before the seed's variation. Pure. */
export const egSpoilsGold = (lv, w) => EG_SPOILS_GOLD_PER_LEVEL * Math.max(1, lv) * Math.min(EG_SPOILS_GOLD_MAX, 1 + EG_SPOILS_GOLD_STEP * (Math.max(1, w | 0) - 1));

/**
 * ONE PASS of a Redoubt's spoils: `{ gold, pieces: [{ item, tier }], card, gems }`. `o.panoply` whether its Panoply piece
 * comes (its choice one draw either way).
 * @param {number} seed the pass's seed @param {number} lv @param {number} w the Redoubt
 * @param {{ lord?: string, panoply: boolean }} o
 */
function rollPass(seed, lv, w, o) {
  const rolls = seededRng(seed >>> 0);
  const gold = Math.round(egSpoilsGold(lv, w) * (0.8 + 0.4 * rolls()));
  const pieces = [];
  pieces.push(graded(spoilsBase(lv, rolls), rolls() < egLegendaryShare(w) ? 'legendary' : 'rare', rolls));
  const more = 1 + Math.min(2, Math.floor(rolls() * 3));
  for (let i = 0; i < more; i++) pieces.push(graded(spoilsBase(lv, rolls), magicOrBetter(rolls, SPOILS_SOURCE), rolls));
  // THE BATTLEMAGE'S PANOPLY: whether, by its own stream (or the service's pity); which, one draw always taken
  const which = rolls();
  if (o.panoply) { const p = mintPanoplyPiece(() => which); if (p) pieces.push({ item: p, tier: p.rarity }); }
  // THE LORD'S NAMED LEGENDARY: one draw always; its making's draws when it comes
  const named = rolls() * EG_LORD_ARM_IN < 1 && o.lord ? egLordArm(o.lord, lv, rolls) : null;
  if (named) pieces.push({ item: named, tier: named.rarity });
  lastPass(pieces.map((p) => p.item), rolls);
  const card = o.lord ? bossCardRoll(o.lord, rolls) : null;
  socketPass(pieces.map((p) => p.item), rolls);
  weaponSocketPass(pieces.map((p) => p.item), rolls);
  const gems = bossGems('gate', rolls);
  techniquePass(pieces.map((p) => p.item), rolls);
  return { gold, pieces, card, gems };
}

/**
 * A REDOUBT'S SPOILS for one earner - each pass's (twice at a Valkynaz's), in order. The same seed, level, Redoubt, lord
 * and pity answer the same spoils. `pity` the passes the account service forced a Panoply piece on (its `pity` answer);
 * `goldOnly` a Redoubt taken again this week: its gold alone.
 * @param {number} seed the receipt's `c` @param {number} level @param {number} w
 * @param {{ lord?: string, pity?: number[], goldOnly?: boolean }} [o]
 */
export function rollEgSpoils(seed, level, w, { lord = '', pity = [], goldOnly = false } = {}) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const passes = [];
  for (let p = 0; p < egSpoilsPasses(w); p++) {
    if (goldOnly) { const r = seededRng(egPassSeed(seed, p)); passes.push({ gold: Math.round(egSpoilsGold(lv, w) * (0.8 + 0.4 * r())), pieces: [], card: null, gems: [] }); continue; }
    passes.push(rollPass(egPassSeed(seed, p), lv, w, { lord, panoply: pity.includes(p) || egPanoplyHit(seed >>> 0, w, p) }));
  }
  return passes;
}

/** The spoils as the pool throws them (scenes/spoilsPool.js's pieces): each pass's items, its card, its gems, then its
 *  gold - the Hour's order - each dressed in the treasure flat the seed chooses. AUDIT EG V (lane8 L8-2): `o.embers` the
 *  Deadlands Embers the claim paid, one stack thrown last (egEmberStack), its flat drawn after every other. Pure.
 * @param {number} seed @param {number} level @param {number} w @param {{ lord?: string, pity?: number[], goldOnly?: boolean, embers?: number }} [o] */
export function egSpoilsList(seed, level, w, o = {}) {
  return dressed(seed, rollEgSpoils(seed, level, w, o), o.goldOnly ? null : egEmberStack(o.embers));
}
/** The most embers one Redoubt pays (net/eliteGates/egPay.js egEmbersOf at its deepest Redoubt, 19,999 - and the wire's bound on a
 *  claim's answer is the service's own). */
export const EG_EMBERS_MAX = 2001;
/** AUDIT EG V (lane8 L8-2; section 19 - "the Spire's embers join EMBERS_EARNED_SQL ... so the insignia and the sink spend
 *  them"): A PAID REDOUBT'S DEADLANDS EMBERS - one stack of the gate's currency (systems/gate/gateSpoils.js sigilStone, minted as
 *  the gate's and the serpent's: no roll taken), as many as the claim paid (`embers`, the row's `stones`), or null. The
 *  service wrote them to the purse and no pack ever held them, so the Broker - who takes them from the pack - could not. */
export const egEmberStack = (n) => (Number.isSafeInteger(n) && n > 0 ? Object.assign(sigilStone(), { stackCount: Math.min(n, EG_EMBERS_MAX) }) : null);
/** AUDIT EG V (lane8 L8-5): the seed a claimed receipt's spoils roll on - the account service's answer's (`seed`), its
 *  receipt's own (`c`) only where the service kept no row (a guest's gold). Pure. */
export const egSpoilsSeedOf = (c, d) => (Number.isSafeInteger(d?.seed) && d.seed >= 0 ? d.seed >>> 0 : (c?.c ?? 0) >>> 0);
/** Passes as the pool throws them, each piece dressed in the treasure flat `seed`'s own stream chooses - AUDIT EG V: the
 *  embers' stack last, its flat drawn after every other (the gate's glow - scenes/spoilsPool.js SIGIL_TIER, 'artifact',
 *  as systems/serpent/serpentSpoils.js says it). Pure. */
function dressed(seed, passes, embers = null) {
  const look = seededRng(((seed >>> 0) ^ 0x5eed) >>> 0);
  const flat = () => RANDOM_TREASURE_ICONS[Math.floor(look() * RANDOM_TREASURE_ICONS.length)];
  const out = [];
  for (const s of passes) {
    for (const p of s.pieces) out.push({ kind: 'item', item: p.item, tier: p.tier, record: flat() });
    const gold = { kind: 'gold', gold: s.gold, tier: 'common', record: flat() };
    if (s.card) out.push({ kind: 'item', item: s.card, tier: 'aetheric', record: flat() });
    for (const g of s.gems) out.push({ kind: 'item', item: g, tier: 'common', record: flat() });
    out.push(gold);
  }
  if (embers) out.push({ kind: 'item', item: embers, tier: 'artifact', record: flat() });
  return out;
}

// ── AUDIT EG III (lane2 #1; section 16.3): THE RELIQUARIES ──────────────────────────────────────────────────────────────
/** A Reliquary's Panoply chance, this many times its Redoubt's (section 16.3: "at twice the Panoply chance"). */
export const EG_RELIQUARY_PANOPLY_X = 2;
/** The most Reliquaries one end opens (net/eliteGates/egBrain.js oweEnd's own trim of `rl`). */
export const EG_RELIQUARIES_MAX = 64;
/** The seed Reliquary `i` of an end rolls on - the end receipt's own (`c`) mixed past every Redoubt pass's (net/eliteGates/egPay.js
 *  egPassSeed), so no two of an end's draw alike. Pure. */
export const egReliquarySeed = (seed, i) => egPassSeed(seed >>> 0, 16 + i);
/** Whether Reliquary `i` of an end, at Redoubt `w`'s depth, holds a Panoply piece: its own stream off its seed at
 *  EG_RELIQUARY_PANOPLY_X times the Redoubt's odds (net/eliteGates/egPay.js egPanoplyIn). Pure. */
export const egReliquaryPanoply = (seed, w, i) => egPanoplyDraw(seed >>> 0, 16 + i) * egPanoplyIn(w) < EG_RELIQUARY_PANOPLY_X;
/** The pool's key for an end's Reliquaries - once a breach and account (scenes/spoilsPool.js spentKey adds the account). */
export const egReliquaryDay = (b) => `eg:${b}:rl`;
/**
 * THE RELIQUARIES AN END OPENS, as the pool throws them: each circle `w` of `rl` one pass at its depth (gold, the Rare or
 * Legendary piece, the magicOrBetter, the Panoply at twice the chance, sockets, gems), on its own seed off the end receipt's.
 * The same seed, level and circles answer the same spoils. Pure.
 * @param {number} seed the end receipt's `c` @param {number} level @param {number[]} rl
 */
export function egReliquaryList(seed, level, rl) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const ws = (Array.isArray(rl) ? rl : []).filter((w) => Number.isSafeInteger(w) && w >= 1).slice(0, EG_RELIQUARIES_MAX);
  return dressed(egReliquarySeed(seed, 0xffff), ws.map((w, i) => rollPass(egReliquarySeed(seed, i), lv, w, { panoply: egReliquaryPanoply(seed, w, i) })));
}
/**
 * WHAT AN END'S CLAIM OPENS (scenes/world.js egSpoilsPaid): `c` the end receipt's claims (`q` 'x'), `d` the account service's
 * answer - its `rl`, the circles whose Reliquaries open (server-account/src/egEconomy.js egReliquariesOf) - and `level` the
 * spoils' level. Answers the pool's grant (`{ day, roll, text, n }`), or null: not an end, no seed, none opening.
 * @param {any} c @param {any} d @param {number} level
 */
export function egReliquaryGrant(c, d, level) {
  if (c?.q !== 'x' || !Number.isSafeInteger(c.c) || typeof c.b !== 'string') return null;
  const rl = (Array.isArray(d?.rl) ? d.rl : []).filter((w) => Number.isSafeInteger(w) && w >= 1).slice(0, EG_RELIQUARIES_MAX);
  if (!rl.length) return null;
  const seed = egSpoilsSeedOf(c, d);   // AUDIT EG V (lane8 L8-5): the claim's seed, never the receipt's own
  return { day: egReliquaryDay(c.b), roll: () => egReliquaryList(seed, level, rl), text: EG_SPOILS_TEXT.opened(rl.length), n: rl.length };
}
