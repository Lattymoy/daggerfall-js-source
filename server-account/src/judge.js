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
// times stays held for staff (STRIKES_FOR_REVIEW): a client that keeps writing impossible things is not an accident.
//
// ═══ WHAT IS JUDGED ════════════════════════════════════════════════
//
//   - THE CHARACTER: its level a whole number in the realm's range and the one its summary claims (the summary's level
//     is the token's `cl`, which the ladder's health reads - arenaLaw.js ladderVitality); its eight attributes within
//     MAX_STAT_VALUE (statMods.js, both leveling lanes' cap); its skills within SKILL_HARD_CAP (skillSoftcap.js).
//   - EVERY ITEM IT HOLDS, wherever it lies - the pack, the wagon, the bag, the furnisher's and the repairer's lists, and
//     every list customs reads (realmGoldLaw.js carriedItemLists) - through the item law (systems/itemLaw.js), and a
//     crafted piece's provenance against the service's own `products` (judgeProducts: a provenance the service never
//     minted, or one minted for another template, is no craft).
//   - ITS WEALTH (wealthOf): the purse, the banks less their loans, the deeds, and the worth of what it owns - its own
//     lists and its own storage, never the world's loot it has not taken (a dungeon's chests ride the save's scene
//     cache from the moment it is entered). INT5's budget reads it.
// ═══════════════════════════════════════════════════════════════════

import { itemFindings, itemWorth, lawTemplate, PROVENANCE_RE, ITEM_LAW_VERSION } from '../../src/systems/itemLaw.js';
import { carriedItemLists, liquidWorthOf, deedsOf } from '../../src/net/realmGoldLaw.js';
import { MAX_STAT_VALUE } from '../../src/systems/statMods.js';
import { SKILL_HARD_CAP } from '../../src/systems/skillSoftcap.js';
import { STAT_KEYS_ORDER } from '../../src/systems/statMods.js';

/** The judge's version: the item law's, and its own character law beside it. */
export const JUDGE_VERSION = ITEM_LAW_VERSION;
/** The highest level the realm reads (realm.js REALM_LEVEL_CLAIM_MAX, the summary's own bound - pinned equal). */
export const JUDGE_LEVEL_MAX = 1000;
/** Checkpoints carrying a law finding before a held character waits for staff, whatever its next checkpoint says. */
export const STRIKES_FOR_REVIEW = 3;
/** How many findings one judgement keeps for staff to read - a save of ten thousand forged pieces is one verdict. */
export const FINDINGS_KEPT = 40;

const lists = (/** @type {any[]} */ ...ls) => ls.filter(Array.isArray);
const arrayOf = (/** @type {unknown} */ x) => (Array.isArray(x) ? x : []);

/** Every list the judge reads: customs' (the stashes, the wagon, the bag, the pack) and the character's own two others -
 *  the furnisher's deliveries and the repairer's shelf (save.js snapshotPlayer's `furnishings`, `otherItems`). */
export const judgedItemLists = (/** @type {any} */ save) => [...carriedItemLists(save), ...lists(save?.furnishings, save?.otherItems)];

/** Come Sail Away's, the sea fight's and the feud's records in a save's per-mod slot (realmGoldLaw.js's own names). */
const CSA_VENDOR = 'come-sail-away', NAVAL_VENDOR = 'NavalCombat', REVENANT_VENDOR = 'Revenant';

/**
 * THE LISTS THE CHARACTER OWNS - what its wealth is: its five own lists; what it dropped (a room's or a street's piles,
 * a dungeon's `droppedLoot`); its storage (DECOR1c `decorItems`) and the chests of the rooms its deeds stand for; a
 * boat's hold, a companion's pack, a sworn revenant's pack. Never a dungeon's treasure, a body or a shop's shelf it has
 * not emptied into one of these: the scene cache keeps a place's loot from the moment it is entered, taken or not.
 * @param {any} save
 */
export function ownedItemLists(save) {
  const out = lists(save?.items, save?.wagonItems, save?.bagItems, save?.furnishings, save?.otherItems);
  const rooms = new Set(deedsOf(save).map((d) => d.room).filter(Boolean));
  for (const scene of arrayOf(save?.sceneCache?.scenes)) {
    for (const pile of arrayOf(scene?.droppedPiles)) out.push(...lists(pile?.items));
    for (const held of Object.values(scene?.decorItems ?? {})) out.push(...lists(held));
    if (rooms.has(scene)) for (const c of arrayOf(scene?.lootContainers)) out.push(...lists(c?.items));
  }
  for (const pile of arrayOf(save?.world?.droppedLoot)) out.push(...lists(pile?.items));
  const csa = save?.modData?.[CSA_VENDOR];
  for (const boat of arrayOf(csa?.placedBoats)) out.push(...lists(boat?.Items));
  out.push(...lists(...Object.values(csa?.packedCargoes ?? {})));
  for (const c of arrayOf(save?.modData?.[NAVAL_VENDOR]?.party?.party)) out.push(...lists(c?.items));
  for (const r of arrayOf(save?.modData?.[REVENANT_VENDOR]?.list)) if (r?.sworn && !r.defeated) out.push(...lists(r.companion?.items));
  return out;
}

/** Whether a piece is worth nothing to the economy: bound to its owner (the Broker's wares, a Sigil Stone - never sold or
 *  handed over, systems/itemBound.js) or a quest's (never sold). */
const worthless = (/** @type {any} */ it) => it?.bound === true || lawTemplate(it?.templateIndex)?.bound === true || it?.questItem === true;

/**
 * THE CHARACTER'S WEALTH: the purse, every bank account less what it owes, each deed at the realm's buy-back
 * (realmGoldLaw.js deedsOf), and every owned piece - a coin or a letter at its gold, any other piece at its worth
 * (itemLaw.js itemWorth: its price, never past the law's ceiling). A whole number of gold.
 * @param {any} save
 */
export function wealthOf(save) {
  if (!save || typeof save !== 'object') return 0;
  const purse = Math.max(0, Number(save.goldPieces) || 0);
  let banks = 0;
  for (const a of arrayOf(save.bankAccounts)) banks += Math.max(0, Number(a?.accountGold) || 0) - Math.max(0, Number(a?.loanTotal) || 0);
  const deeds = deedsOf(save).reduce((s, d) => s + d.value, 0);
  let goods = 0;
  for (const list of ownedItemLists(save)) {
    for (const it of list) {
      const liquid = liquidWorthOf(it);
      goods += liquid > 0 ? liquid : worthless(it) ? 0 : itemWorth(it);
    }
  }
  return Math.trunc(purse + banks + deeds + goods);
}

/**
 * THE CHARACTER LAW: a level the summary agrees with, attributes and skills inside the port's own caps. Answers the
 * findings, as `{ code }` records.
 * @param {any} save @param {{ level?: unknown } | null} summary
 */
export function characterFindings(save, summary) {
  const out = [];
  const level = save?.level;
  if (!Number.isInteger(level) || level < 1 || level > JUDGE_LEVEL_MAX) out.push({ code: 'level' });
  else if (summary && summary.level != null && summary.level !== level) out.push({ code: 'level-claim' });
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
  return out;
}

/**
 * ONE SAVE JUDGED, with no database: the character law and the item law over every list. Answers `{ findings, wealth,
 * items, provenances, uids }` - `findings` the first FINDINGS_KEPT of them (`{ code, list, at, t }` an item's), `items`
 * the count judged, `provenances` every crafted piece's provenance and template (judgeProducts reads them), `uids`
 * INT4's ids: every valuable piece's id the character OWNS (ownedItemLists), for the duplicate ledger.
 * @param {any} save @param {{ level?: unknown } | null} [summary]
 */
export function judgeSave(save, summary = null) {
  /** @type {any[]} */
  const findings = [];
  let count = 0;
  const keep = (/** @type {any} */ f) => { count++; if (findings.length < FINDINGS_KEPT) findings.push(f); };
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { findings: [{ code: 'save' }], count: 1, wealth: 0, items: 0, provenances: [], uids: [] };
  for (const f of characterFindings(save, summary)) keep(f);
  let items = 0;
  /** @type {{ provenance: string, t: number }[]} */
  const provenances = [];
  judgedItemLists(save).forEach((list, li) => {
    list.forEach((/** @type {any} */ it, /** @type {number} */ i) => {
      items++;
      for (const code of itemFindings(it)) keep({ code, list: li, at: i, t: it?.templateIndex ?? null });
      if (typeof it?.provenance === 'string' && PROVENANCE_RE.test(it.provenance)) provenances.push({ provenance: it.provenance, t: it.templateIndex });
    });
  });
  return { findings, count, wealth: wealthOf(save), items, provenances, uids: ownedUids(save) };
}

/** INT4: every valuable piece's id the character owns (ownedItemLists), in order, repeats kept - the ledger reads a
 *  repeat as a duplicate inside one record. */
export function ownedUids(/** @type {any} */ save) {
  /** @type {string[]} */
  const uids = [];
  for (const list of ownedItemLists(save)) for (const it of list) if (typeof it?.uid === 'string') uids.push(it.uid);
  return uids;
}

/** How many provenances one statement asks about - D1 binds at most 100 a statement. */
const PROVENANCE_CHUNK = 90;

/**
 * THE CRAFT'S OWN RECORD: every crafted piece's provenance the service minted (`products`, PROF3), for the template it
 * was minted for. A provenance the table has never held, or holds for another template, is no craft - a finding. A
 * piece disenchanted is gone from the table and from the save together (alchemy.js), so no honest piece is left behind.
 * @param {any} db @param {{ provenance: string, t: number }[]} provenances
 * @returns {Promise<any[]>}
 */
export async function judgeProducts(db, provenances) {
  const out = [];
  const want = new Map(provenances.map((p) => [p.provenance, p.t]));
  const ids = [...want.keys()];
  /** @type {Map<string, number>} */
  const have = new Map();
  for (let i = 0; i < ids.length; i += PROVENANCE_CHUNK) {
    const chunk = ids.slice(i, i + PROVENANCE_CHUNK);
    const rows = await db.prepare(`SELECT provenance, template FROM products WHERE provenance IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all();
    for (const r of rows?.results ?? []) have.set(r.provenance, r.template);
  }
  for (const [p, t] of want) if (have.get(p) !== t) out.push({ code: 'provenance', at: p, t });
  return out;
}
