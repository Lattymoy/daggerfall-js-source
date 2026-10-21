// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EG-E2 (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 19 and 20) - THE
// FEATS, THE ANNALS, THE HONOURS AND THE BOARDS, AS THE SERVICE KEEPS THEM.
//
// ═══ THE FEATS ═════════════════════════════════════════════════════
//
// A Redoubt's `w` receipt names its lord (`lk`) and the feats its Court saw (`ft`, three bits - src/net/eliteGates/egFeats.js).
// The account keeps them a lord at a time (`eg_feats`, the bits OR'ed - a feat once held is held), never from a
// Rehearsal. A band's lords' feats, all held (egBandMastered), are that band's Master.
//
// ═══ THE ANNALS ════════════════════════════════════════════════════
//
// A member's end (`x`) says the pages of the Annals of 3E 398 the breach gave them (`an`, a bit a page -
// src/net/eliteGates/egAnnals.js). The account keeps every page it was ever given (`players.eg_annals`, OR'ed), a Rehearsal's too:
// a page is the Spire's lore, not its pay, and the relay says what it gave. `/v1/eg/keys` answers both (egRecordOf).
//
// ═══ THE HONOURS ═══════════════════════════════════════════════════
//
// Section 19's table, on the account's row (`players.eg_honours`, a bit an honour - EG_HONOUR), written at a recorded
// non-Rehearsal `w` and guarded by the receipt's own row, as sds.js guards `sd_honours`; held for good. Taking a
// Redoubt grants every honour at or above whose number it stands (a company that starts deeper has taken the shallower
// ones to earn its start). The Unfallen asks Redoubt 10 with no fall in a breach begun at Hall 1; the Lone Beacon a
// Court felled alone in a company of four or more (the relay's `lb`). Spire Champion is the boards' (below) and First of
// the Spire is a list in config, as Hour's First is (titles.js EG_FIRST_HANDLES). titles.js reads the row.
//
// ═══ THE BOARDS ════════════════════════════════════════════════════
//
// `/v1/eg/board` (egBoardOf), the arena's season (arenaSeasonOf, eight weeks), rows by topWithMe (arena.js) and names by
// boardNamesOf - iliacBoardOf's way. The ends' rows (`eg_runs`) carry what the boards rank by: the company's size (`n`),
// the start Redoubt (`ew`), the Wager (`wg`), the falls (`fl`), the seconds from Hall 1's wake to the deepest hall's door
// (`td`, the receipt's when it says it - else its `t`), the Rehearsal (`rh`) and the season of the receipt's issue.
//   - THE DESCENT: three brackets by the company's size (Alone 1, the Few 2-4, the Company 5-8); only unwagered breaches
//     begun at Hall 1, this season; ranked by the deepest hall cleared, then the fewest seconds. A company is one row -
//     the accounts that ended the same breach, its deepest hall its deepest member's, the Unfallen's flame when none
//     fell - and the same company's best breach alone.
//   - THE DEPTHS: every account, the deepest hall it cleared this season from any start, its start Redoubt and its Wager.
//   - THE DEEPEST REDOUBTS: every account, all time, the deepest Redoubt it ever took and when.
// SPIRE CHAMPION: each Descent bracket's top ten at a season's end hold it through the next season - kept in
// `eg_champions` the first time a read finds the last one unkept (a board, a token's mint, a badge) once the season is a
// receipt's life past its end (AUDIT EG IV: an end claimed late lands in it until then, and the title follows the
// standing as it is), and read onto the row (`eg`) at the doors the Iliac Champion is (withEgHonours, withEgHonoursAll).
//
// ═══ THE RECAP'S BOARD LINE AND FIRST OF THE SPIRE'S LETTER (EG-ZF) ═
//
// Section 27.6's recap ends on the board's line (*The Descent, the Few: 14th*): an end's claim answers the member's
// standing (egStandingOf) - its company's rank in its Descent bracket where the breach ranks there, else the account's on
// the Depths. Section 19: First of the Spire "is granted as Hour's First was: a list in the service's config, and the
// mailbox" - Hour's First's letter was the operator's send (tools/sendServerPost.mjs HOURS_FIRST, migration 0094) to names
// frozen the day they were known; First of the Spire's names are not known until its company comes, so THE LIST IS THE
// SEND: an account EG_FIRST_HANDLES names is written its letter, once (0093's ux_server_post_batch), at its next balance's
// read (egFirstPost) - the operator's act still the one that sends it, words fixed here, never a player's.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js. Not a DFU member: Daggerfall Unity has no accounts.
// ═══════════════════════════════════════════════════════════════════

import { arenaSeasonOf, arenaSeasonDay, arenaSeasonEndsS, arenaWeekOf } from '../../src/net/arena/arenaLaw.js';
import { egBandMastered, EG_FEAT_BANDS } from '../../src/net/eliteGates/egFeats.js';
import { egProclamationOf, EG_DECREE_BY_KEY } from '../../src/net/eliteGates/egLaw.js';
import { topWithMe, ARENA_BOARD_TOP } from './arena.js';
import { boardNamesOf } from './boardNames.js';
import { isSpireFirst } from './titles.js';   // EG-ZF: First of the Spire's list - its letter's addressees
import { POST_SENDER } from '../../src/net/postLaw.js';   // EG-ZF: the post's sender, as the box shows it
import { egWagerOf } from '../../src/net/eliteGates/egStartLaw.js';   // AUDIT EG V (L8-9): the Wager's decrees, read
import { EG_RECEIPT_TTL_S } from '../../src/net/eliteGates/egReceipt.js';   // AUDIT EG IV (lane3 #13): a season's champions kept once its late ends are claimed

/** THE SPIRE'S HONOURS on the row (`players.eg_honours`), a bit each, in section 19's table's order - each a title of
 *  the same id (src/net/identityToken.js TITLES). */
export const EG_HONOUR = Object.freeze({
  spirewalker: 1, beaconlighter: 2, kynbane: 4, unfallen: 8, lonebeacon: 16, battlemage: 32, wellheadwalker: 64,
  mastergallery: 128, mastercairn: 256, mastershade: 512, masterwellhead: 1024,
});
/** The titles the bits are, in their order. */
export const EG_HONOUR_TITLES = Object.freeze(Object.keys(EG_HONOUR));
/** The two whose titles carry an aura: Kynbane's Beaconlight, Wellhead-Walker's The Burning Stair. */
export const EG_HONOUR_AURA = Object.freeze({ kynbane: 'beaconlight', wellheadwalker: 'burningstair' });
/** The Redoubts that grant a title by their number alone: taking one at or past it holds it. */
export const EG_REDOUBT_HONOURS = Object.freeze([
  Object.freeze([2, 'spirewalker']), Object.freeze([5, 'beaconlighter']), Object.freeze([10, 'kynbane']),
  Object.freeze([15, 'battlemage']), Object.freeze([20, 'wellheadwalker']),
]);
/** The Unfallen's Redoubt: taken with no fall, in a breach begun at Hall 1. */
export const EG_UNFALLEN_REDOUBT = 10;
/** Each band's Master, in EG_FEAT_BANDS' order: the Galleries, the Cairn, the Shade, the Wellhead. */
export const EG_BAND_MASTERS = Object.freeze(['mastergallery', 'mastercairn', 'mastershade', 'masterwellhead']);
/** Spire Champion's title; First of the Spire's and its aura. */
export const EG_CHAMPION_TITLE = 'spirechampion';
export const EG_FIRST_TITLE = 'spirefirst';
export const EG_FIRST_AURA = 'firstlight';
/** THE DESCENT'S BRACKETS, by the company's size: Alone (1), the Few (2-4), the Company (5-8). */
export const EG_BRACKETS = Object.freeze(['alone', 'few', 'company']);
export const egBracketOf = (n) => (n >= 5 ? 'company' : n >= 2 ? 'few' : 'alone');
/** A company's names a Descent row carries. */
export const EG_COMPANY_MAX = 8;
/** Each bracket's companies that hold Spire Champion through the next season. */
export const EG_CHAMPIONS_TOP = 10;
/** How long a Worker keeps its word of the last season's champions before it reads them again, seconds. */
export const EG_CHAMPION_CACHE_S = 600;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
/** Was the breach wagered - the receipt's `wg`, the Wager's decrees (or a flag)? */
const wagered = (c) => (Array.isArray(c?.wg) ? c.wg.length > 0 : !!c?.wg);
/** AUDIT EG V (lane8 L8-9; sections 18 and 20 - "the Wager shown on the row"): the receipt's Wager as its end's row keeps it,
 *  its decrees' numbers joined by commas ('' none - eg_stakes.wg's form), and read back. */
const wagerText = (c) => (Array.isArray(c?.wg) ? (egWagerOf(c.wg) ?? []).join(',') : '');
const wagerOfText = (s) => egWagerOf(String(s ?? '').split(',').filter(Boolean).map(Number)) ?? [];

/** THE HONOURS A `w` RECEIPT GRANTS, as bits (EG_HONOUR) - none from a Rehearsal or any other kind. Pure.
 *  @param {any} c the receipt's claims */
export function egHonourBitsOf(c) {
  if (!c || c.q !== 'w' || c.rh === 1 || !Number.isSafeInteger(c.w)) return 0;
  let bits = 0;
  for (const [r, t] of EG_REDOUBT_HONOURS) if (c.w >= r) bits |= EG_HONOUR[t];
  if (c.w >= EG_UNFALLEN_REDOUBT && c.fl === 0 && c.ew === 0) bits |= EG_HONOUR.unfallen;
  if (c.lb === 1) bits |= EG_HONOUR.lonebeacon;
  return bits;
}
/** THE MASTERS the feats `held` (lord key to its bits) make, as bits - each band whose lords' feats are all held. Pure. */
export function egMasterBitsOf(held) {
  let bits = 0;
  EG_FEAT_BANDS.forEach((_, b) => { if (egBandMastered(held, b)) bits |= EG_HONOUR[EG_BAND_MASTERS[b]]; });
  return bits;
}
/** The titles a set of honour bits is, in their order. Pure. */
export const egHonourTitlesOf = (bits) => EG_HONOUR_TITLES.filter((t) => (int(bits) & EG_HONOUR[t]) !== 0);

/**
 * THE CLAIM'S STATEMENTS, for claimEg's batch after the receipt's own row (eg.js): a `w` - the lord's feats OR'ed into
 * `eg_feats` (none from a Rehearsal); an `x` - the end's row given what the boards rank by, and the Annals' pages OR'ed
 * into `players.eg_annals`. Each guarded by the receipt's row, so it writes only for a receipt the service recorded.
 * @param {any} db @param {{ id: string }} player @param {any} c the verified claims @param {number} _nowS
 */
export function egHonourStatements(db, player, c, _nowS) {
  if (c.q === 'w') {
    if (c.rh === 1 || typeof c.lk !== 'string' || !Number.isSafeInteger(c.ft)) return [];
    return [db.prepare(`INSERT INTO eg_feats (account, lord, bits) SELECT ?1, ?2, ?5
        WHERE EXISTS (SELECT 1 FROM eg_redoubts WHERE b = ?3 AND account = ?1 AND w = ?4)
        ON CONFLICT (account, lord) DO UPDATE SET bits = bits | excluded.bits`).bind(player.id, c.lk, c.b, c.w, c.ft)];
  }
  if (c.q !== 'x') return [];
  const td = Number.isSafeInteger(c.td) && c.td >= 0 ? c.td : null;
  return [
    db.prepare('UPDATE eg_runs SET n = ?3, ew = ?4, wg = ?5, fl = ?6, td = ?7, rh = ?8, season = ?9, wgs = ?10 WHERE b = ?1 AND account = ?2')
      .bind(c.b, player.id, int(c.n), int(c.ew), wagered(c) ? 1 : 0, int(c.fl), td, c.rh === 1 ? 1 : 0, arenaSeasonOf(c.i), wagerText(c)),   // AUDIT EG V (lane8 L8-9): and the Wager's decrees
    ...(int(c.an) > 0 ? [db.prepare('UPDATE players SET eg_annals = eg_annals | ?2 WHERE id = ?1 AND EXISTS (SELECT 1 FROM eg_runs WHERE b = ?3 AND account = ?1)').bind(player.id, int(c.an), c.b)] : []),
  ];
}

/**
 * THE HONOURS AT A `w` CLAIM, after its batch (eg.js): the receipt's (egHonourBitsOf) and the Masters the account's
 * feats now make (egMasterBitsOf), written onto the row where the receipt's own row stands - OR'ed, held for good. Answers
 * `{ honours: [titles] }` for the ones this claim newly granted, or `{}` (nothing new, another kind). A Rehearsal's
 * receipt grants none (egHonourBitsOf) and keeps no feat (egHonourStatements), so it can make no new Master.
 * @param {any} db @param {{ id: string }} player @param {any} c the verified claims
 */
export async function egHonoursAnswer(db, player, c) {
  if (c.q !== 'w') return {};
  const row = await db.prepare('SELECT eg_honours AS h FROM players WHERE id = ?1').bind(player.id).first();
  const feats = (await db.prepare('SELECT lord, bits FROM eg_feats WHERE account = ?1').bind(player.id).all()).results ?? [];
  const bits = egHonourBitsOf(c) | egMasterBitsOf(Object.fromEntries(feats.map((f) => [f.lord, int(f.bits)])));
  const fresh = bits & ~int(row?.h);
  if (!fresh) return {};
  const set = await db.prepare('UPDATE players SET eg_honours = eg_honours | ?2 WHERE id = ?1 AND EXISTS (SELECT 1 FROM eg_redoubts WHERE b = ?3 AND account = ?1 AND w = ?4)')
    .bind(player.id, fresh, c.b, c.w).run();
  return Number(set?.meta?.changes ?? 0) > 0 ? { honours: egHonourTitlesOf(fresh) } : {};
}

/** WHAT THE ACCOUNT KEEPS OF THE SPIRE, for `/v1/eg/keys`: `{ annals, feats }` - the Annals' pages it holds (a bit a
 *  page) and each lord's feats (lord key to its bits).
 *  @param {any} db @param {string} id */
export async function egRecordOf(db, id) {
  const row = await db.prepare('SELECT eg_annals AS a FROM players WHERE id = ?1').bind(id).first();
  const feats = (await db.prepare('SELECT lord, bits FROM eg_feats WHERE account = ?1 ORDER BY lord').bind(id).all()).results ?? [];
  return { annals: int(row?.a), feats: Object.fromEntries(feats.map((f) => [f.lord, int(f.bits)])) };
}

// ── THE BOARDS ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The season's ends the Descent may rank: unwagered, begun at Hall 1, no Rehearsal, a hall cleared. */
const DESCENT_SQL = 'SELECT b, account, h, COALESCE(td, t) AS secs, n, fl, at, co_n, co_h FROM eg_runs WHERE season = ?1 AND rh = 0 AND ew = 0 AND wg = 0 AND h >= 1 ORDER BY at ASC, account ASC';   // EG-ZA: and the receipt's company
/** Each account's deepest hall this season, from any start - its start Redoubt and its Wager with it. */
const DEPTHS_SQL = `SELECT account, h, ew, wg, wgs, at FROM (
    SELECT account, h, ew, wg, wgs, at, ROW_NUMBER() OVER (PARTITION BY account ORDER BY h DESC, at ASC, b ASC) AS rn
      FROM eg_runs WHERE season = ?1 AND rh = 0 AND h >= 1)
  WHERE rn = 1 ORDER BY h DESC, at ASC, account ASC`;
/** Each account's deepest Redoubt, all time, and when it first took it. */
const DEEPEST_SQL = `SELECT account, w, at FROM (
    SELECT account, w, at, ROW_NUMBER() OVER (PARTITION BY account ORDER BY w DESC, at ASC) AS rn FROM eg_redoubts)
  WHERE rn = 1 ORDER BY w DESC, at ASC, account ASC`;

/** The Descent's order: the deepest hall, then the fewest seconds, then the first there. */
const descentOrder = (a, b) => b.h - a.h || a.t - b.t || a.at - b.at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * THE DESCENT'S COMPANIES from a season's ends (DESCENT_SQL's rows), ranked: one row a company - the accounts that ended
 * one breach (in the order they ended it), its deepest hall its deepest member's and its seconds the fewest of those
 * there, its size the receipts' (or its members', where more), the Unfallen's flame when no member fell - and the same
 * company's best breach alone. EG-ZA (section 20, "Who counts"): a company is the receipt's `co` where it says one -
 * every member's receipt of a breach carries the same tag of its entrants - so the same company is one row whoever of it
 * claimed, and two companies that share their claimers are two; an end from before it is keyed by its claimers, as it
 * was. THE SEAL's ranking needs no case of its own: a sealed run ends at the sealed Redoubt's Court, its `td` the
 * seconds to that Court's fall, so the deepest hall then the fewest seconds ranks every sealed run by its seconds. Pure.
 * @param {any[]} rows
 */
export function egDescentCompanies(rows) {
  const best = new Map();
  for (const c of breachesOf(rows).values()) {
    const key = companyKeyOf(c);
    const row = { key, players: c.players.slice(0, EG_COMPANY_MAX), h: c.h, t: c.t, n: Math.max(c.n, c.players.length), flame: c.fell === 0, at: c.at };
    const had = best.get(key);
    if (!had || descentOrder(row, had) < 0) best.set(key, row);
  }
  return [...best.values()].sort(descentOrder);
}
/** The Descent's breaches from a season's ends (DESCENT_SQL's rows): breach -> its company as its claims say it - the
 *  accounts that ended it (in the order they ended it), its deepest hall and the fewest seconds there, its size, its falls,
 *  its first claim, and the receipt's company tag (`co`). Pure. */
function breachesOf(rows) {
  const by = new Map();
  for (const r of rows) {
    let c = by.get(r.b);
    if (!c) by.set(r.b, (c = { players: [], h: 0, t: Infinity, n: 0, fell: 0, at: Infinity, co: '' }));
    if (!c.players.includes(r.account)) c.players.push(r.account);
    const h = int(r.h), secs = int(r.secs);
    if (h > c.h) { c.h = h; c.t = secs; } else if (h === c.h) c.t = Math.min(c.t, secs);
    c.n = Math.max(c.n, int(r.n), int(r.co_n));
    c.fell += int(r.fl);
    c.at = Math.min(c.at, int(r.at));
    if (!c.co && typeof r.co_h === 'string' && r.co_h) c.co = `${int(r.co_n)}:${r.co_h}`;
  }
  return by;
}
/** A breach's company's key on the Descent - its receipt's `co` where it says one, else its claimers - ONE KEY for the
 *  board's rows and the recap's standing (AUDIT EG III lane3 #4: the standing keyed by the claimers alone found no row for
 *  a company the relay had tagged, and every end the relay mints is tagged). Pure. */
const companyKeyOf = (c) => (c.co ? `co:${c.co}` : [...c.players].sort().join(','));
/** The Descent's three brackets from its ranked companies, each ranked. Pure. */
export function egDescentBrackets(companies) {
  const out = Object.fromEntries(EG_BRACKETS.map((k) => [k, /** @type {any[]} */ ([])]));
  for (const c of companies) out[egBracketOf(c.n)].push(c);
  return out;
}
/** A season's Descent: its companies ranked, and its brackets. */
async function descentOf(db, season) {
  const companies = egDescentCompanies((await db.prepare(DESCENT_SQL).bind(season).all()).results ?? []);
  return { companies, brackets: egDescentBrackets(companies) };
}

/**
 * SPIRE CHAMPION KEPT: each bracket's top EG_CHAMPIONS_TOP companies of season `season`'s Descent, every member, into
 * `eg_champions` (once a row - a second count adds nothing). Answers how many rows it wrote.
 * @param {{ db: any }} ctx @param {number} season
 */
export async function recordEgChampions({ db }, season) {
  const rows = championsOf((await descentOf(db, season)).brackets);
  if (!rows.length) return 0;
  const out = await db.batch(rows.map(([k, p]) => db.prepare('INSERT OR IGNORE INTO eg_champions (season, bracket, account) VALUES (?1, ?2, ?3)').bind(season, k, p)));
  return out.reduce((s, r) => s + Number(r?.meta?.changes ?? 0), 0);
}
/** A season's Descent brackets' top EG_CHAMPIONS_TOP companies, every member: `[bracket, account]`. Pure. */
function championsOf(brackets) {
  const rows = [];
  for (const k of EG_BRACKETS) for (const c of brackets[k].slice(0, EG_CHAMPIONS_TOP)) for (const p of c.players) rows.push([k, p]);
  return rows;
}
/** One Worker's word of the last season's champions, kept EG_CHAMPION_CACHE_S within the season it was read in. */
let _champs = { season: 0, at: -Infinity, ids: /** @type {Set<string>} */ (new Set()) };
/** Tests: the kept word forgotten (AUDIT EG III: and the boards' rankings). */
export function _resetEgHonoursCache() { _champs = { season: 0, at: -Infinity, ids: new Set() }; egBoardsMoved(); }
/** The accounts holding Spire Champion at `nowS`: the last season's champions - kept first if that season is unkept.
 *  AUDIT EG IV (lane3 #13; section 20): kept only once the season is a receipt's life past its end (EG_RECEIPT_TTL_S) - an
 *  end issued in its last hours may be claimed that much later, and its row lands in that season after the first read;
 *  until then they are the season's standing as it is, read afresh and never kept. */
async function championsNow(ctx, nowS) {
  const season = arenaSeasonOf(nowS);
  if (_champs.season === season && nowS - _champs.at < EG_CHAMPION_CACHE_S) return _champs.ids;
  const last = season - 1;
  const read = async () => new Set(((await ctx.db.prepare('SELECT account FROM eg_champions WHERE season = ?1').bind(last).all()).results ?? []).map((r) => r.account));
  let ids = new Set();
  if (last >= 1 && nowS < arenaSeasonEndsS(last) + EG_RECEIPT_TTL_S) ids = new Set(championsOf((await descentOf(ctx.db, last)).brackets).map(([, p]) => p));
  else if (last >= 1) {
    ids = await read();
    if (!ids.size && (await recordEgChampions(ctx, last)) > 0) ids = await read();
  }
  _champs = { season, at: nowS, ids };
  return ids;
}
/** THE SPIRE'S HONOURS an account holds by the boards, as the token's mint reads them: `champion`. Never a guest's. */
export async function egHonoursOf(ctx, player, nowS) {
  if (!player?.handle) return { champion: false };
  return { champion: (await championsNow(ctx, nowS)).has(player.id) };
}
/** The row with them on it - what titles.js reads (`eg`). */
export async function withEgHonours(ctx, player, nowS) {
  return player ? { ...player, eg: await egHonoursOf(ctx, player, nowS) } : player;
}
/** MANY ROWS WITH THEM - a box's senders, a board's authors, a board's names (letters.js, board.js, boardNames.js,
 *  beside withIliacHonoursAll): the Worker's kept word, laid on each registered row as `eg`. */
export async function withEgHonoursAll(ctx, rows, nowS) {
  if (!rows.some((r) => r?.handle)) return rows;
  const ids = await championsNow(ctx, nowS);
  return rows.map((r) => (r?.handle ? { ...r, eg: { champion: ids.has(r.id) } } : r));
}

/**
 * EG-ZF (section 27.6, THE RECAP: "the board's line: *The Descent, the Few: 14th*") - A MEMBER'S STANDING, answered on
 * its end's claim (eg.js claimEg, after the end's row is written): where the breach ranks on the Descent (its rows among
 * DESCENT_SQL's - begun at Hall 1, unwagered, no Rehearsal), its company's - keyed as the board keys it (the receipt's
 * `co`, else the accounts that have claimed an end of this breach so far), its best breach's place if it has a better one - bracket and rank this season; else the account's own
 * rank on the Depths this season. `{ board: { k: 'descent', br, rank } }`, `{ board: { k: 'depths', rank } }`, or `{}` (a Rehearsal, no
 * hall cleared, another kind).
 * @param {any} db @param {{ id: string }} player @param {any} c the verified claims
 */
export async function egStandingOf(db, player, c) {
  if (c?.q !== 'x' || c.rh === 1 || !(int(c.h) >= 1)) return {};
  const season = arenaSeasonOf(c.i);
  const rows = (await db.prepare(DESCENT_SQL).bind(season).all()).results ?? [];
  const mine = breachesOf(rows).get(c.b), key = mine ? companyKeyOf(mine) : '';   // '' off the Descent: no company's - AUDIT EG III (lane3 #4): the board's own key
  const brackets = egDescentBrackets(egDescentCompanies(rows));
  for (const br of EG_BRACKETS) {
    const i = brackets[br].findIndex((r) => r.key === key);
    if (i >= 0) return { board: { k: 'descent', br, rank: i + 1 } };
  }
  const i = ((await db.prepare(DEPTHS_SQL).bind(season).all()).results ?? []).findIndex((r) => r.account === player.id);
  return i >= 0 ? { board: { k: 'depths', rank: i + 1 } } : {};
}

/** EG-ZF (section 19): FIRST OF THE SPIRE'S LETTER - its send's name (one piece a send an account), its subject and its
 *  words, the developers' (src/net/postLaw.js POST_SENDER), Hour's First's in kind (tools/sendServerPost.mjs HOURS_FIRST).
 *  No item: the title and Firstlight are the account's by the list. */
export const EG_FIRST_POST = Object.freeze({
  batch: 'spire-first',
  subject: 'First of the Spire',
  body: [
    'You were the first ever to take Redoubt 10 of the Battlespire. The Spire remembers.',   // AUDIT FB1020d L1-4: a company's words or one's - the first company came alone (SPIRE-FIRST)
    '',
    'Your title, First of the Spire, and its aura, Firstlight, are yours to wear - choose them on your profile.',
    '',
    `- ${POST_SENDER}`,
  ].join('\n'),
});
/**
 * EG-ZF: FIRST OF THE SPIRE'S LETTER, SENT - to `player` while First of the Spire's list names it (titles.js isSpireFirst:
 * a handle, never a guest), once (INSERT OR IGNORE over 0093's one-a-send index; its id the database's own random, as the
 * operator's statement draws one). Answers whether this call wrote it.
 * @param {any} db @param {{ id: string, handle?: string|null }} player @param {any} env @param {number} nowS
 */
export async function egFirstPost(db, player, env, nowS) {
  if (!isSpireFirst(player, env)) return false;
  const r = await db.prepare(`INSERT OR IGNORE INTO server_post (id, to_id, batch, sender, subject, body, item, sent_at)
    VALUES (lower(hex(randomblob(12))), ?1, ?2, ?3, ?4, ?5, NULL, ?6)`)
    .bind(player.id, EG_FIRST_POST.batch, POST_SENDER, EG_FIRST_POST.subject, EG_FIRST_POST.body, nowS).run();
  return Number(r?.meta?.changes ?? 0) > 0;
}

/** AUDIT EG III (lane3 #18): how long one Worker keeps the boards' rankings before it reads them again (s). The rankings
 *  are every company's and every account's of the season (and the Deepest's of all time) - a caller's own row and the
 *  total are placed in them - so a board read the season's ends, the season's depths and every Redoubt ever taken each
 *  time anyone opened the window; a crowd at the board now reads them once a minute a Worker, and a claim this Worker
 *  records forgets them at once (egBoardsMoved). An end's claim still reads its season fresh: the recap's standing must
 *  count the claim itself (egStandingOf). */
export const EG_BOARD_CACHE_S = 60;
/** One Worker's rankings, kept EG_BOARD_CACHE_S within the season they were read for; the read in flight (shared by every
 *  board asked meanwhile - ASYNC NEVER DROPS: coalesced); and the claims' count, so a read a claim overtook keeps nothing. */
let _ranks = { season: -1, at: -Infinity, v: /** @type {any} */ (null) };
let _ranksAsking = /** @type {{ season: number, gen: number, p: Promise<any> } | null} */ (null);
let _ranksGen = 0;
/** AUDIT EG III: the kept rankings forgotten - a claim recorded here moved them (eg.js claimEg). */
export function egBoardsMoved() { _ranks = { season: -1, at: -Infinity, v: null }; _ranksAsking = null; _ranksGen++; }
/** The boards' rankings for `season` at `nowS`: the Descent's companies and brackets, the Depths' rows, the Deepest's -
 *  kept, else read (once, however many ask while it is read). Each reader copies the rows it ranks (topWithMe marks the
 *  caller's own on them). */
async function ranksOf(db, season, nowS) {
  if (_ranks.v && _ranks.season === season && nowS >= _ranks.at && nowS - _ranks.at < EG_BOARD_CACHE_S) return _ranks.v;
  if (_ranksAsking?.season === season && _ranksAsking.gen === _ranksGen) return _ranksAsking.p;
  const gen = _ranksGen;
  const p = (async () => {
    const { companies, brackets } = await descentOf(db, season);
    const depths = ((await db.prepare(DEPTHS_SQL).bind(season).all()).results ?? []).map((r) => ({ player: r.account, h: int(r.h), ew: int(r.ew), wagered: int(r.wg) === 1, wg: wagerOfText(r.wgs) }));   // AUDIT EG V (L8-9): the Wager's decrees
    const deepest = ((await db.prepare(DEEPEST_SQL).all()).results ?? []).map((r) => ({ player: r.account, w: int(r.w), at: int(r.at) }));
    const v = { companies, brackets, depths, deepest };
    if (gen === _ranksGen) _ranks = { season, at: nowS, v };
    return v;
  })().finally(() => { if (_ranksAsking?.p === p) _ranksAsking = null; });
  _ranksAsking = { season, gen, p };
  return p;
}

/** The week's Proclamation (section 20): its decree's key, name and line. */
export function egProclamationNow(nowS) {
  const week = arenaWeekOf(nowS), key = egProclamationOf(week), d = EG_DECREE_BY_KEY[key];
  return { week, key, name: d?.name ?? key, line: d?.line ?? '' };
}

/**
 * THE BOARDS (`/v1/eg/board`): the season (its number, day and end); the Descent's three brackets, the Depths and the
 * Deepest Redoubts, each `{ rows, pinned, total }` (topWithMe: a top ten, the caller's own pinned under it, each row its
 * `rank` and `you`); the week's Proclamation; the caller's best this season on the Descent (`{ h, t }`, or null).
 * A Descent row: `{ players, names, h, t, n, flame, pr }` (`pr` the Proclamation of its breach's week); a Depths row:
 * `{ player, name, title, glyphs, h, ew, wagered, wg }` (AUDIT EG V: `wg` the Wager's decrees' numbers);
 * a Deepest row: `{ player, name, title, glyphs, w, at }`.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function egBoardOf(ctx, player, env) {
  const { db, nowS } = ctx;
  const season = arenaSeasonOf(nowS);
  const me = player?.id ?? null;
  await championsNow(ctx, nowS);   // the last season's champions kept, the first read of a new season
  const R = await ranksOf(db, season, nowS), { companies } = R, copy = (rows) => rows.map((r) => ({ ...r }));   // AUDIT EG III (lane3 #18): kept a minute
  const mine = (r) => !!me && r.players.includes(me);
  const descent = Object.fromEntries(EG_BRACKETS.map((k) => [k, topWithMe(copy(R.brackets[k]), mine, ARENA_BOARD_TOP)]));
  const depths = topWithMe(copy(R.depths), me, ARENA_BOARD_TOP);
  const deepest = topWithMe(copy(R.deepest), me, ARENA_BOARD_TOP);
  const shownOf = (b) => [...b.rows, ...(b.pinned ? [b.pinned] : [])];
  const ids = [
    ...EG_BRACKETS.flatMap((k) => shownOf(descent[k]).flatMap((r) => r.players)),
    ...shownOf(depths).map((r) => r.player), ...shownOf(deepest).map((r) => r.player),
  ];
  const names = await boardNamesOf(ctx, ids, env, nowS, {});
  const company = (r) => (r ? { players: r.players, names: r.players.map((p) => names.get(p)?.name ?? '?'), h: r.h, t: r.t, n: r.n, flame: r.flame, pr: egProclamationNow(r.at).name, rank: r.rank, you: r.you } : null);
  const named = (r) => (r ? { ...r, ...(names.get(r.player) ?? { name: '?', title: null, glyphs: [] }) } : null);
  const board = (b, f) => ({ rows: b.rows.map(f), pinned: f(b.pinned), total: b.total });
  const best = companies.find(mine) ?? null;
  return {
    ok: true,
    season: { n: season, day: arenaSeasonDay(nowS), ends: arenaSeasonEndsS(season) },
    descent: Object.fromEntries(EG_BRACKETS.map((k) => [k, board(descent[k], company)])),
    depths: board(depths, named),
    deepest: board(deepest, named),
    proclamation: egProclamationNow(nowS),
    best: best ? { h: best.h, t: best.t } : null,
  };
}
