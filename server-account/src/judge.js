// @ts-check
// ═══════════════════════════════════════════════════════════════════
// INT2 (2026-10-09, the INTEGRITY arc - bible/06-Systems/Integrity-Arc.md; Mac: "I want to do everything and do it
// properly"): THE JUDGE. Every checkpoint a realm character's tab writes is READ here - not only its first.
//
// ═══ WHAT REALM-ARC SECTION 4 PROMISED, AND THE SAVE NEVER GOT ═════
//
// "The service reads the checkpoint's summary, spot-checks the blob, and refuses a checkpoint that breaks the law." Until
// this module the service read a save twice - customs' wealth at the first checkpoint (realm.js firstSaveRefusal) and
// the goods a hand-over takes (realmTradeLaw.js) - and stored every other checkpoint unopened. A client could write any
// character it liked one checkpoint after its first: a sword no producer mints, a level it never earned, a purse that
// grew by a million between two saves, and every route that hands a realm character's goods to another player
// (market.js, realmTrade.js, guildVault.js, rent.js, cards.js) took them from that record as the truth.
//
// ═══ THE VERDICT FREEZES TRADE, NEVER PROGRESS ═════════════════════
//
// Mac's call (2026-10-09, asked what a breach does): "Freeze trading". A checkpoint that breaks the law is STORED - the
// player loses nothing they played, because a finding can be the law's mistake and "THE CLOUD IS A BACKUP" exists
// because players lost games - and the character is HELD: every route that moves its value to another player refuses
// it (realm.js holdRefusal) until a later checkpoint is clean or staff clear it. A character the law has found three
// times is held for a time, whatever its next checkpoint says (STRIKES_FOR_TIMED, verdict.js LAW_HOLD_S): a client that
// keeps writing impossible things is not an accident - and since AUTO-HOLD (2026-10-16) the hold lifts on its own when
// its time is out, never on a person's review.
//
// ═══ WHAT IS JUDGED ════════════════════════════════════════════════
//
//   - THE CHARACTER: its level a whole number in the realm's range and the one its summary claims (the summary's level
//     is the token's `cl`, which the ladder's health reads - arenaLaw.js ladderVitality); its eight attributes within
//     MAX_STAT_VALUE (statMods.js, both leveling lanes' cap); its skills within SKILL_HARD_CAP (skillSoftcap.js); and
//     SCHOOLS5 (bible/06-Systems/Arcane-Specialisations.md section 7) its specialisation, when it carries one - a path the
//     table holds and both its schools mastered (arcanePaths.js pathFindings - no signature spell is judged).
//   - EVERY ITEM IT HOLDS (possessedItemLists) - the pack, the wagon, the bag, the furnisher's and the repairer's lists,
//     what it set out or stored in its own rooms, a rented room's and a deed's chests, a boat's hold, a companion's pack -
//     through the item law (systems/item/itemLaw.js), and a crafted piece against the service's own `products` (judgeProducts:
//     a provenance the service never minted, one minted for another template or material, or one it holds at a lower
//     quality than the piece claims, is no craft). Never a list the world fills: a shop's shelf, a dungeon's chest, a
//     body - the scene cache keeps a place's loot from the moment it is entered, and a piece sold to a counter stands on
//     its shelf (AUDIT INT: a piece sold online was still "held" there, and its finding with it).
//   - ITS WEALTH (wealthOf): the purse, the banks less what they lend (never past what the Empire lends a character of
//     its level - realmLoanOwedMax), the deeds, and the worth of what it holds and what it laid on the ground (the
//     piles it dropped - picked up again, a pile is no gain). INT5's budget reads it.
// ═══════════════════════════════════════════════════════════════════

import { itemFindings, itemWorth, lawTemplate, classicPiece, PROVENANCE_RE, ITEM_LAW_VERSION, GOLD_INT_MAX } from '../../src/systems/item/itemLaw.js';
import { ledgerKeyOf } from '../../src/systems/item/itemIds.js';
import { armsOf } from '../../src/net/siege/siegeRef.js';   // INT7: the arms the token signs
import { liquidWorthOf, deedsOf } from '../../src/net/realm/realmGoldLaw.js';
import { possessedItemLists } from '../../src/systems/item/possessedItems.js';   // AUDIT AUTO-HOLD: one home, the client's shelf reads it too
import { MAX_STAT_VALUE } from '../../src/systems/statMods.js';
import { SKILL_HARD_CAP } from '../../src/systems/skillSoftcap.js';
import { STAT_KEYS_ORDER } from '../../src/systems/statMods.js';
import { pathFindings } from '../../src/systems/arcanePaths.js';   // SCHOOLS5: a save's specialisation

/** The judge's version: the item law's, and its own character law beside it. */
export const JUDGE_VERSION = ITEM_LAW_VERSION;
/** The highest level the realm reads (realm.js REALM_LEVEL_CLAIM_MAX, the summary's own bound - pinned equal). */
export const JUDGE_LEVEL_MAX = 1000;
/** The holds the law has come to before a held character is held for a time (verdict.js LAW_HOLD_S), whatever its next
 *  checkpoint says. */
export const STRIKES_FOR_TIMED = 3;
/** THE WEALTH MEASURE'S VERSION (wealthOf, itemLaw.js itemWorth, realmGoldLaw.js deedsOf's prices): moved whenever any of
 *  them counts a save differently, so a character's next checkpoint measures its stored record again under the new one
 *  and the change is no gain the budget charges (AUDIT INT: an open number moved was every character's gain at once).
 *  2: AUDIT WAGON-PRICE Y4 - a marked wagon counted at its kind's price (itemLaw.js worthCeiling). */
export const WEALTH_VERSION = 2;
/** How many findings one judgement keeps for staff to read - a save of ten thousand forged pieces is one verdict. */
export const FINDINGS_KEPT = 40;

const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
const arrayOf = (/** @type {unknown} */ x) => (Array.isArray(x) ? x : []);
/** A count of gold in a save: a whole number, never below nothing - any other word (a fraction, Infinity, a string) is
 *  nothing (AUDIT INT: `goldPieces: 1e999` read as Infinity, and the verdict's NOT NULL threw the save away). */
export const goldOf = (/** @type {unknown} */ v) => (Number.isSafeInteger(v) && /** @type {number} */ (v) > 0 ? /** @type {number} */ (v) : 0);

/** THE LISTS THE CHARACTER HOLDS (possessedItemLists) - systems/item/possessedItems.js, their one home since AUDIT AUTO-HOLD
 *  (the client's shelf reads them too: a piece stowed in a ship's hold came back to its holder off a stale shelf), handed
 *  on here for the service's own readers. */
export { possessedItemLists };

/** THE PILES ON THE GROUND the save keeps - a room's, a dungeon's (`droppedPiles`) and the street's (`world.piles`). Its
 *  wealth counts them (a pile dropped and taken up again is no gain); the law and the ledger do not (anyone may take a
 *  pile up, and the piece is then theirs). */
export function groundItemLists(/** @type {any} */ save) {
  const out = [];
  for (const scene of arrayOf(save?.sceneCache?.scenes)) for (const pile of arrayOf(/** @type {any} */ (scene)?.droppedPiles)) out.push(...lists(/** @type {any} */ (pile)?.items));
  for (const pile of [...arrayOf(save?.world?.piles), ...arrayOf(save?.world?.droppedLoot)]) out.push(...lists(/** @type {any} */ (pile)?.items));
  return out;
}

/** The most a realm character of `level` can owe the Empire's bank: the Empire lends a tenth of DFU's level x 50,000
 *  (banking.js calculateMaxBankLoan online - Roleplay & Realism's per-level choice is never more), and the debt is the
 *  loan and its tenth (calculateBankLoanRepayment) - pinned equal by test/server/int2_judge.test.js; the Worker bundles no
 *  banking.js. A loan the save claims past it lends the wealth nothing (AUDIT INT: a forged loan of ten million hid ten
 *  million of forged gold from the budget). */
export const realmLoanOwedMax = (/** @type {number} */ level) => Math.trunc(Math.max(1, Math.trunc(level) || 1) * 5_000 * 1.1);

/** Whether a piece is worth nothing to the economy: bound to its owner (the Broker's wares, a Sigil Stone - never sold or
 *  handed over, systems/item/itemBound.js) or a quest's (never sold). */
const worthless = (/** @type {any} */ it) => it?.bound === true || lawTemplate(it?.templateIndex)?.bound === true || it?.questItem === true;

/** The pieces wealthOf counts - every one the character holds or laid on the ground - and each as it counts it: a coin or
 *  a letter at its gold (`liquid`), a bound or quest piece at nothing, any other at its worth. */
const wealthLists = (/** @type {any} */ save) => [...possessedItemLists(save), ...groundItemLists(save)];
const pieceWealth = (/** @type {any} */ it, liquid = liquidWorthOf(it)) => (liquid > 0 ? liquid : worthless(it) ? 0 : itemWorth(it));

/**
 * THE CHARACTER'S WEALTH: the purse, every bank account less what it owes (the debt counted no further than
 * realmLoanOwedMax at `level` - the save's own, or the level the realm trusts), each deed at the realm's buy-back
 * (realmGoldLaw.js deedsOf), and every piece it holds or laid on the ground - a coin or a letter at its gold, any other
 * at its worth (itemLaw.js itemWorth: its price, never past the law's ceiling). A whole number of gold, and a finite one.
 * @param {any} save @param {{ level?: number }} [o]
 */
export function wealthOf(save, { level = save?.level } = {}) {
  if (!save || typeof save !== 'object') return 0;
  const purse = goldOf(save.goldPieces);
  let banks = 0, owed = 0;
  for (const a of arrayOf(save.bankAccounts)) { banks += goldOf(/** @type {any} */ (a)?.accountGold); owed += goldOf(/** @type {any} */ (a)?.loanTotal); }
  const deeds = deedsOf(save).reduce((s, d) => s + d.value, 0);
  let goods = 0;
  for (const list of wealthLists(save)) for (const it of list) goods += pieceWealth(it);
  const w = Math.trunc(purse + banks - Math.min(owed, realmLoanOwedMax(Number(level))) + deeds + goods);
  return Number.isSafeInteger(w) ? w : Math.sign(w) * Number.MAX_SAFE_INTEGER;
}
/** STAFF-PANEL3-REALM (design doc weak spots: "split gold from item worth"): THE GOODS OF wealthOf - its pieces that are
 *  not gold, at its own worth; the rest of the wealth is gold, the debt off it (verdict.js writes it on a gain's finding).
 *  @param {any} save */
export function goodsOf(save) {
  if (!save || typeof save !== 'object') return 0;
  let goods = 0;
  for (const list of wealthLists(save)) for (const it of list) if (!(liquidWorthOf(it) > 0)) goods += pieceWealth(it, 0);
  return Math.trunc(goods);
}

/** A count the save may leave out, and must otherwise write as gold is written: a whole number, never below nothing. */
const goldWord = (/** @type {unknown} */ v) => v == null || (Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0);
/** HACKED-GOLD (GOLD-INT): and the purse is one count - DFU's `int goldPieces` (itemLaw.js GOLD_INT_MAX). A purse past it
 *  is no honest one: a modified client's nine quadrillion was "lawful" here, a law finding now. */
const purseWord = (/** @type {unknown} */ v) => goldWord(v) && !(/** @type {number} */ (v) > GOLD_INT_MAX);

/**
 * THE CHARACTER LAW: a level the summary agrees with, attributes and skills inside the port's own caps, its gold - the
 * purse, each account and each loan - written as gold is. Answers the findings, as `{ code }` records.
 * @param {any} save @param {{ level?: unknown } | null} summary
 */
export function characterFindings(save, summary) {
  const out = [];
  const level = save?.level;
  if (!Number.isInteger(level) || level < 1 || level > JUDGE_LEVEL_MAX) out.push({ code: 'level' });
  else if (summary && summary.level != null && summary.level !== level) out.push({ code: 'level-claim' });
  if (!purseWord(save?.goldPieces)) out.push({ code: 'gold' });
  arrayOf(save?.bankAccounts).forEach((/** @type {any} */ a, /** @type {number} */ i) => {
    if (a != null && !(goldWord(a?.accountGold) && goldWord(a?.loanTotal))) out.push({ code: 'bank', at: i });
  });
  const stats = save?.stats;
  if (stats && typeof stats === 'object') {
    for (const k of STAT_KEYS_ORDER) {
      const v = stats[k];
      if (v != null && !(Number.isInteger(v) && v >= 0 && v <= MAX_STAT_VALUE)) out.push({ code: 'stat', at: k });
    }
  }
  if (Array.isArray(save?.skills)) {
    save.skills.forEach((/** @type {unknown} */ v, /** @type {number} */ i) => {
      if (v != null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= SKILL_HARD_CAP)) out.push({ code: 'skill', at: i });
    });
  }
  for (const f of pathFindings(save)) out.push(f);   // SCHOOLS5: an honest save never breaks it - only the choice writes the path
  return out;
}

/** A law finding's item codes, safe: a piece the law cannot read without throwing (AUDIT INT: `enchantments: [null]`
 *  threw, and the checkpoint answered 500) is a piece of no shape the game writes. */
const findingsOf = (/** @type {any} */ it) => { try { return itemFindings(it); } catch { return ['shape']; } };

/**
 * ONE SAVE JUDGED, with no database: the character law and the item law over every list it holds. Answers `{ findings,
 * count, wealth, items, provenances, pieces, arms }` - `findings` the first FINDINGS_KEPT of them (`{ code, list, at, t }`
 * an item's), `items` the count judged, `provenances` every crafted piece's provenance, template, material and quality
 * (judgeProducts reads them), `pieces` INT4's: every valuable piece it holds, by its ledger key (ledgerPieces); `arms`
 * INT7's `[reach, bow]` (net/siege/siegeRef.js armsOf - the pack's lawful weapons alone).
 * @param {any} save @param {{ level?: unknown } | null} [summary] @param {{ level?: number }} [o] the level its wealth's debt is read at
 */
export function judgeSave(save, summary = null, o = {}) {
  /** @type {any[]} */
  const findings = [];
  let count = 0;
  const keep = (/** @type {any} */ f) => { count++; if (findings.length < FINDINGS_KEPT) findings.push(f); };
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { findings: [{ code: 'save' }], count: 1, wealth: 0, items: 0, provenances: [], pieces: [], arms: [0, 0] };
  for (const f of characterFindings(save, summary)) keep(f);
  let items = 0;
  /** @type {{ provenance: string, t: number, m: unknown, q: unknown, w: number }[]} */
  const provenances = [];
  possessedItemLists(save).forEach((list, li) => {
    list.forEach((/** @type {any} */ it, /** @type {number} */ i) => {
      items++;
      for (const code of findingsOf(it)) keep({ code, list: li, at: i, t: it?.templateIndex ?? null });
      if (typeof it?.provenance === 'string' && PROVENANCE_RE.test(it.provenance)) provenances.push({ provenance: it.provenance, t: it.templateIndex, m: it.material, q: it.quality, w: worthless(it) ? 0 : itemWorth(it) });
    });
  });
  // INT7: THE ARMS - the most reach of the weapons in the pack the law takes, and whether a lawful bow is among them
  // (net/siege/siegeRef.js armsOf); the identity mint signs them (`wa`), and every referee clips a blow between players to them
  const arms = armsOf(save.items, (it) => findingsOf(it).length === 0);
  return { findings, count, wealth: wealthOf(save, o), items, provenances, pieces: ledgerPieces(save), arms };
}

/** INT4: A PIECE'S KEY IN THE LEDGER - systems/item/itemIds.js ledgerKeyOf, its one home since AUTO-HOLD (the client's room
 *  word reads it too), handed on here for the service's own readers. */
export { ledgerKeyOf };
/** What a piece IS, as the ledger keeps it beside its key: its template and its material - an id on another piece is no
 *  claim to the piece the id was minted for. */
export const ledgerPrintOf = (/** @type {any} */ it) => `${Number.isSafeInteger(it?.templateIndex) ? it.templateIndex : '-'}:${Number.isSafeInteger(it?.material) ? it.material : '-'}`;

/** How many classic save's pieces the character holds (itemLaw.js classicPiece) - a route that would leave it fewer hands
 *  one to another player, and none does ('piece-legacy'). */
export const classicCount = (/** @type {any} */ save) => possessedItemLists(save).reduce((n, list) => n + list.filter(classicPiece).length, 0);

/** INT4: every valuable piece the character holds (possessedItemLists), as `{ key, fp }`, in order, repeats kept - the
 *  ledger reads a repeat as a copy inside one record. */
export function ledgerPieces(/** @type {any} */ save) {
  /** @type {{ key: string, fp: string }[]} */
  const out = [];
  for (const list of possessedItemLists(save)) {
    for (const it of list) {
      const key = ledgerKeyOf(it);
      if (key) out.push({ key, fp: ledgerPrintOf(it) });
    }
  }
  return out;
}

/** How many provenances one statement asks about - D1 binds at most 100 a statement. */
const PROVENANCE_CHUNK = 90;

/**
 * THE CRAFT'S OWN RECORD: every crafted piece's provenance the service minted (`products`, PROF3) - the template and the
 * material it was made in, and the quality it stands at (a temper raises the row with the piece - professions.js
 * temperPiece - so a piece may lag its row a checkpoint, never pass it). A provenance the table has never held, holds
 * for another template or material, or holds lower than the piece claims, is no craft - a finding (AUDIT INT: a
 * Crude Iron Dagger's provenance on a Masterwork Daedric one passed, five of them at once). A piece disenchanted is gone
 * from the table and from the save together (alchemy.js), so no honest piece is left behind.
 * Answers `{ findings, arrived }` - `arrived` the lawful pieces `player`'s account owns that the service has not yet
 * witnessed arriving (`products.credited` 0: made, or bought at the market, since), each with its worth: the budget's
 * witness for a piece the service minted and the client's pack took (AUDIT INT: a crafted or market-bought piece was
 * charged to the budget as a find).
 * @param {any} db @param {{ provenance: string, t: number, m?: unknown, q?: unknown, w?: number }[]} provenances @param {string | null} [player]
 * @returns {Promise<{ findings: any[], arrived: { provenance: string, w: number }[] }>}
 */
export async function judgeProducts(db, provenances, player = null) {
  const out = [];
  /** @type {{ provenance: string, w: number }[]} */
  const arrived = [];
  const want = new Map(provenances.map((p) => [p.provenance, p]));
  const ids = [...want.keys()];
  /** @type {Map<string, any>} */
  const have = new Map();
  for (let i = 0; i < ids.length; i += PROVENANCE_CHUNK) {
    const chunk = ids.slice(i, i + PROVENANCE_CHUNK);
    const rows = await db.prepare(`SELECT provenance, template, material, quality, owner, credited FROM products WHERE provenance IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all();
    for (const r of rows?.results ?? []) have.set(r.provenance, r);
  }
  for (const [p, piece] of want) {
    const row = have.get(p);
    const lawful = !!row && row.template === piece.t
      && (piece.m == null || row.material == null || Number(row.material) === piece.m)
      && (piece.q == null || (Number.isInteger(piece.q) && /** @type {number} */ (piece.q) <= Number(row.quality)));
    if (!lawful) out.push({ code: 'provenance', at: p, t: piece.t });
    else if (player != null && row.owner === player && Number(row.credited) === 0) arrived.push({ provenance: p, w: Number.isSafeInteger(piece.w) ? /** @type {number} */ (piece.w) : 0 });
  }
  return { findings: out, arrived };
}
