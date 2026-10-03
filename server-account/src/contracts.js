// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SILVER-WAYS (2026-10-03, Mac: "Do it") - GUILD CONTRACTS, AS THE SERVICE
// KEEPS THEM. A contract is a guild writ for DEEDS: a guild puts up `pay`
// silver for each defender of a raid in a region, `deeds` of them, held
// from its treasury while it stands; every account a raid's receipt counts
// there is paid by it as its claim is counted (raids.js claimRaid's own
// batch), less the market's 5% tax. The law both ends read is
// src/net/writLaw.js (GUILD CONTRACTS); the record is
// bible/06-Systems/Professions-Arc.md 10.5 and bible/06-Systems/Online-Arc.md
// SILVER-WAYS.
//
// ═══ IT MINTS NOTHING ═══════════════════════════════════════════════
//
// Every line here moves silver a guild already holds: the treasury to the
// ledger's `escrow` end at the post, the escrow to a defender (and its tax
// to the burn) at each deed, what is left home at a withdrawal or the
// seventh day. A guild of gatherers pays a guild's fighters without a coin
// struck.
//
// ═══ ONE STATEMENT DECIDES, AND A REQUEST ASKED TWICE IS ONE ════════
//
// PROF6's law (writs.js), whole: a post or a withdrawal is one batch whose
// first statement writes its row with a fresh nonce only where every
// condition holds, and every statement after it moves silver only where
// that row carries the nonce. A deed's pay is keyed on the raid claim's
// own nonce (raid_cleanses.nonce), so a claim that is not counted pays
// nothing, and one that is pays each contract once - (contract, raid,
// account) is the pay row's key.
//
// ═══ SETTLED ON READ ════════════════════════════════════════════════
//
// A contract past its seventh day is closed, and its escrow home, by the
// next Work read of anyone - the guild writs' close.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, mintId, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { marksOpenFor, guildBalanceOf } from './marks.js';
import { CHAR_ID_RE } from './service.js';
import { heraldryOfRow } from './halls.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { regionOk } from '../../src/net/nodeLaw.js';
import { MARKET_TAX_PCT } from '../../src/net/marketLaw.js';   // AUDIT SILVER-WAYS B1: a deed's tax reckoned in the batch (deedTaxSql - saleTaxOn's law)
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';
import {
  CONTRACT_S, GUILD_CONTRACTS_MAX, CONTRACTS_PAID_MAX, WRIT_POSTS_MAX, WRIT_OPS_MAX, WRIT_WINDOW_S, WRIT_SETTLE_MAX, WRIT_SHOWN,
  WRIT_RID_RE, WRIT_ID_RE, WRIT_POWERS, contractKindOk, contractPayOk, contractDeedsOk, contractRegionOfRaid, writMay, seatWeek,
} from '../../src/net/writLaw.js';
import { officerSpentSql } from './writs.js';

const INSERT_LINE = 'INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)';
/** The ranks that post and withdraw contracts, in SQL - and so are never paid by their guild's (writLaw contractPaidMay). */
const POSTERS_SQL = WRIT_POWERS.postWrit.join(', ');

/** Whether contracts are open to this account: they move silver alone, so the silver's switch. */
export const contractsOpenFor = (player, env) => marksOpenFor(player, env);
const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
const idOk = (id) => typeof id === 'string' && WRIT_ID_RE.test(id);
/** The first door: a registered account, its character, a request id. */
function asks(player, { character, rid }) {
  if (accountKind(player) !== 'linked') return { error: 'marks-need-account' };
  if (!charOk(character)) return { error: 'prof-character' };
  if (typeof rid !== 'string' || !WRIT_RID_RE.test(rid)) return { error: 'prof-rid' };
  return null;
}
const shut = (player, env) => (contractsOpenFor(player, env) ? null : { error: 'marks-closed' });

// ─── WHAT A CONTRACT LOOKS LIKE TO THE CLIENT ────────────────────────

const CONTRACT_ROW = `SELECT c.*, g.name AS guild_name, g.tag AS guild_tag, g.heraldry AS guild_heraldry
  FROM guild_contracts c JOIN guilds g ON g.id = c.guild_id`;
const contractView = (c, me, may = false) => ({
  id: c.id, kind: c.kind, guild: { id: c.guild_id, name: c.guild_name ?? null, tag: c.guild_tag ?? null, heraldry: heraldryOfRow(c.guild_heraldry) },
  region: Number(c.region), pay: Number(c.pay), deeds: Number(c.deeds), left: Number(c.left_deeds), escrow: Number(c.escrow),
  at: Number(c.at), expiresAt: Number(c.expires_at), state: c.state, mine: c.poster === me, may,
});
async function contractOf(db, id, me, may = false) {
  const c = await db.prepare(`${CONTRACT_ROW} WHERE c.id = ?1`).bind(id).first();
  return c ? contractView(c, me, may) : null;
}
/** Whether a rank may withdraw a contract: the Guildmaster any of the guild's, an Officer those they posted. */
const mayWithdraw = (rank, c, me) => rank === GUILD_RANK_MASTER || (rank != null && writMay(rank, 'postWrit') && c.poster === me);

// ─── THE RETURN (one line keyed on the contract's own id) ────────────

/** What is left of a closed contract's escrow, home to its guild's treasury under the cap - the line's actor the guild
 *  (its id the contract's, so it is written once whoever's read settles it). */
function contractReturn(db, id, nowS) {
  return [
    db.prepare(`${INSERT_LINE} SELECT 'escrow', id, 'guild', guild_id, 'contract-return', escrow, ?2, ?3, guild_id, 'A contract', 'contract-return:' || id
      FROM guild_contracts WHERE id = ?1 AND state != 'open' AND returned = 0 AND escrow > 0
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = guild_contracts.guild_id AND rid = 'contract-return:' || ?1)
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = guild_contracts.guild_id), 0) + escrow <= ?4`)
      .bind(id, utcDay(nowS), nowS, MARKS_MAX),
    db.prepare(`UPDATE guild_contracts SET returned = 1, escrow = 0 WHERE id = ?1 AND state != 'open' AND returned = 0
      AND (escrow = 0 OR EXISTS (SELECT 1 FROM marks_ledger WHERE actor = guild_contracts.guild_id AND rid = 'contract-return:' || ?1))`).bind(id),
  ];
}
/** THE CONTRACTS PAST THEIR DAYS, closed, and every closed contract's escrow home - anyone's Work read runs it; at most
 *  WRIT_SETTLE_MAX a read, one batch each; a treasury the cap cannot take waits. */
async function closeContracts({ db, nowS }) {
  const { results: due = [] } = await db.prepare(`SELECT id FROM guild_contracts WHERE (state = 'open' AND expires_at <= ?1)
      OR (state != 'open' AND returned = 0 AND (escrow = 0 OR COALESCE((SELECT balance FROM guild_marks WHERE guild_id = guild_contracts.guild_id), 0) + escrow <= ?2))
    ORDER BY expires_at LIMIT ${WRIT_SETTLE_MAX}`).bind(nowS, MARKS_MAX).all();
  for (const c of due) {
    await db.batch([
      db.prepare(`UPDATE guild_contracts SET state = 'expired', closed_at = ?2 WHERE id = ?1 AND state = 'open' AND expires_at <= ?2`).bind(c.id, nowS),
      ...contractReturn(db, c.id, nowS),
    ]);
  }
}

// ─── THE WORK TAB'S READ ─────────────────────────────────────────────

/**
 * THE BOARD'S CONTRACTS: `{ character, region }` - merged into `/v1/writs/list`'s answer beside the writs (index.js).
 * The expired swept; then this region's open contracts, the best-paying first; "yours" - this character's guild's
 * open contracts, every region; and whether it may post one (its rank). Empty while silver is shut.
 */
export async function contractBoard(ctx, player, env, { character, region } = {}) {
  const { db, nowS } = ctx;
  if (accountKind(player) !== 'linked' || !contractsOpenFor(player, env) || !charOk(character) || !regionOk(region)) return {};
  const me = player.id;
  await closeContracts(ctx);
  const member = await db.prepare('SELECT guild_id, rank FROM guild_members WHERE player = ?1 AND char_id = ?2').bind(me, character).first();
  const rank = member ? Number(member.rank) : null;
  const { results: here = [] } = await db.prepare(`${CONTRACT_ROW} WHERE c.region = ?1 AND c.state = 'open' AND c.expires_at > ?2
    ORDER BY c.pay DESC, c.at LIMIT ${WRIT_SHOWN}`).bind(region, nowS).all();
  const { results: ours = [] } = member ? await db.prepare(`${CONTRACT_ROW} WHERE c.guild_id = ?1 AND c.state = 'open' AND c.expires_at > ?2
    ORDER BY c.expires_at LIMIT ${WRIT_SHOWN}`).bind(member.guild_id, nowS).all() : { results: [] };
  const own = member?.guild_id ?? null;
  return {
    contracts: here.map((c) => contractView(c, me, c.guild_id === own && mayWithdraw(rank, c, me))),
    yoursContracts: ours.map((c) => contractView(c, me, mayWithdraw(rank, c, me))),
    contractPost: member ? writMay(rank, 'postWrit') : false,
  };
}

// ─── POST ────────────────────────────────────────────────────────────

/**
 * POST: `{ character, region, kind, pay, deeds, rid }` - a contract paying `pay` silver to each of `deeds` defenders of
 * a raid in `region`, for seven days; the whole pay escrowed from the character's guild's treasury. The Guildmaster's;
 * an Officer's within the Officers' writ budget this seat week (one budget for their writs and their contracts).
 */
export async function postContract(ctx, player, env, { character, region, kind, pay, deeds, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  const answer = async (row, extra = {}) => ({ ok: true, ...extra, contract: await contractOf(db, row.id, me, true), guildMarks: await guildBalanceOf(db, row.guild_id) });
  const prior = await db.prepare('SELECT * FROM guild_contracts WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!regionOk(region)) return { error: 'bad-region' };
  if (!contractKindOk(kind)) return { error: 'contract-kind' };
  if (!contractPayOk(pay)) return { error: 'contract-pay' };
  if (!contractDeedsOk(deeds)) return { error: 'contract-deeds' };
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const rank = Number(a.me.rank);
  if (!writMay(rank, 'postWrit')) return { error: 'guild-rank' };
  const g = a.me.guild_id;
  if (await overRate(ctx, `writ-post:${me}`, WRIT_POSTS_MAX, WRIT_WINDOW_S)) return { error: 'writ-rate' };
  const officer = rank === GUILD_RANK_MASTER ? 0 : 1;
  const escrow = deeds * pay;
  const week = seatWeek(nowS);
  const nonce = mintId(rand);
  const id = mintId(rand);
  await db.batch([
    // THE DECISION: the rank still held, the treasury's silver, the guild's five, an Officer's budget, the id unspent
    db.prepare(`INSERT OR IGNORE INTO guild_contracts (id, guild_id, poster, poster_char, officer, week, region, kind, deeds, left_deeds, pay, escrow,
        at, expires_at, rid, n)
      SELECT ?3, ?4, ?1, ?2, ?5, ?6, ?7, ?8, ?9, ?9, ?10, ?11, ?12, ?13, ?14, ?15
      WHERE EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?2 AND guild_id = ?4 AND rank = ?16)
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?4), 0) >= ?11
        AND (SELECT COUNT(*) FROM guild_contracts WHERE guild_id = ?4 AND state = 'open' AND expires_at > ?12) < ?17
        AND (?5 = 0 OR ${officerSpentSql('?4', '?6')} + ?11 <= COALESCE((SELECT budget FROM guild_writ_budgets WHERE guild_id = ?4), 0))
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?14 || ':cesc')`)
      .bind(me, character, id, g, officer, week, region, kind, deeds, pay, escrow, nowS, nowS + CONTRACT_S, rid, nonce, rank, GUILD_CONTRACTS_MAX),
    // the pay held: the treasury to the ledger's escrow end, the contract's id
    db.prepare(`${INSERT_LINE} SELECT 'guild', guild_id, 'escrow', id, 'contract-escrow', escrow, ?4, at, poster, ?5, rid || ':cesc'
      FROM guild_contracts WHERE poster = ?1 AND rid = ?2 AND n = ?3`).bind(me, rid, nonce, utcDay(nowS), displayName(player)),
  ]);
  const made = await db.prepare('SELECT * FROM guild_contracts WHERE poster = ?1 AND rid = ?2').bind(me, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  if (await db.prepare('SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(me, `${rid}:cesc`).first()) return { error: 'prof-rid' };
  const now = await db.prepare('SELECT rank FROM guild_members WHERE player = ?1 AND char_id = ?2 AND guild_id = ?3').bind(me, character, g).first();
  if (!now || Number(now.rank) !== rank) return { error: 'guild-rank' };
  if ((await guildBalanceOf(db, g)) < escrow) return { error: 'guild-marks-short' };
  const open = await db.prepare(`SELECT COUNT(*) AS n FROM guild_contracts WHERE guild_id = ?1 AND state = 'open' AND expires_at > ?2`).bind(g, nowS).first();
  if (Number(open?.n ?? 0) >= GUILD_CONTRACTS_MAX) return { error: 'guild-contracts-max' };
  return { error: 'writ-budget' };
}

// ─── WITHDRAW ────────────────────────────────────────────────────────

/**
 * WITHDRAW: `{ character, contract, rid }` - an open contract closed by its guild's Guildmaster (any of them) or the
 * Officer who posted it; what is left of its escrow home (under the cap - else on a later read). Asked again, a
 * contract this account withdrew answers as done.
 */
export async function withdrawContract(ctx, player, env, { character, contract: id, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const me = player.id;
  if (!idOk(id)) return { error: 'no-contract' };
  const c = await db.prepare('SELECT * FROM guild_contracts WHERE id = ?1').bind(id).first();
  if (!c) return { error: 'no-contract' };
  const answer = async (extra = {}) => ({ ok: true, ...extra, contract: await contractOf(db, id, me), guildMarks: await guildBalanceOf(db, c.guild_id) });
  if (c.state === 'withdrawn' && c.closed_by === me) return answer({ repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  if (a.me.guild_id !== c.guild_id) return { error: 'guild-rank' };
  const rank = Number(a.me.rank);
  if (!mayWithdraw(rank, c, me)) return { error: 'guild-rank' };
  if (c.state !== 'open') return { error: 'contract-gone' };
  if (await overRate(ctx, `writ:${me}`, WRIT_OPS_MAX, WRIT_WINDOW_S)) return { error: 'writ-rate' };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`UPDATE guild_contracts SET state = 'withdrawn', closed_at = ?3, closed_by = ?4, cn = ?5 WHERE id = ?1 AND state = 'open'
      AND EXISTS (SELECT 1 FROM guild_members WHERE player = ?4 AND char_id = ?2 AND guild_id = guild_contracts.guild_id AND rank = ?6)
      AND (?6 = ${GUILD_RANK_MASTER} OR poster = ?4)`).bind(id, character, nowS, me, nonce, rank),
    ...contractReturn(db, id, nowS),
  ]);
  const now = await db.prepare('SELECT state, cn FROM guild_contracts WHERE id = ?1').bind(id).first();
  if (now?.cn === nonce) return answer();
  if (now?.state !== 'open') return { error: 'contract-gone' };
  return { error: 'guild-rank' };
}

// ─── A DEED'S PAY: A RAID'S CLAIM, COUNTED ───────────────────────────

/** A deed pay's line ids - the contract's and the raid's, under the paid account as the actor. */
const payRid = (id, key) => `cpay:${id}:${key}`;
const taxRid = (id, key) => `ctax:${id}:${key}`;

/** AUDIT SILVER-WAYS B1: the open contracts a claim reads to pay - twice what it may be paid by, so a contract another
 *  claim fills in the meantime leaves the next-best to pay (the batch pays CONTRACTS_PAID_MAX at most). */
const CONTRACTS_READ_MAX = CONTRACTS_PAID_MAX * 2;
/** AUDIT SILVER-WAYS B1: a deed's tax in SQL, off the contract row AS THE BATCH FINDS IT (`c`) - marketLaw.js saleTaxOn's
 *  running total (5% of the deeds paid with this one, floored, less 5% of those before it). MARKET_TAX_PCT is written
 *  into the text as the law's integer, never bound: a bound number is a REAL to the driver, and the division with it
 *  (1.5) would not floor; every term here an INTEGER column or literal, SQLite's integer division floors what is never
 *  negative. */
const TAX_PCT = Math.trunc(MARKET_TAX_PCT);
const deedTaxSql = `(((c.deeds - c.left_deeds + 1) * c.pay * ${TAX_PCT}) / 100 - ((c.deeds - c.left_deeds) * c.pay * ${TAX_PCT}) / 100)`;

/**
 * THE STATEMENTS A RAID'S CLAIM RUNS FOR THE CONTRACTS OF ITS REGION (raids.js claimRaid's batch): `{ key, nonce }` the
 * raid's key and the claim's own nonce. The region is the key's (RAID-ROLL: the relay read it against the day's roll);
 * the open contracts there with a deed left, the best-paying first, CONTRACTS_PAID_MAX of them - each paid once a (raid,
 * account), only where the claim's own row stands with its nonce, never to an account any of whose characters may post
 * or withdraw that guild's contracts, never past the defender's MARKS_MAX.
 * AUDIT SILVER-WAYS B1: the deed's tax is reckoned IN the batch, off the contract as the batch finds it - it was read
 * before it and the pay written only while the contract still stood as read, so a party's claims, which the relay's
 * receipts send together, passed over every defender but the first, who could never claim again. The batch's own
 * serial order is the running total's now; and the read takes twice the contracts it pays, the batch paying
 * CONTRACTS_PAID_MAX at most, so one filled meanwhile leaves the next-best.
 * AUDIT SILVER-WAYS B2: the read skips a guild whose contracts this account may not be paid by (its posters' ranks), so
 * an officer of a guild whose own contracts outrank the rest is still paid by the others'.
 * Null where silver is not this account's or no contract stands there.
 */
export async function contractPayStatements({ db, nowS }, player, env, { key, nonce }) {
  if (accountKind(player) !== 'linked' || !contractsOpenFor(player, env)) return null;
  const region = contractRegionOfRaid(key);
  if (region == null) return null;
  const posters = (g) => `EXISTS (SELECT 1 FROM guild_members m WHERE m.player = ?3 AND m.guild_id = ${g} AND m.rank IN (${POSTERS_SQL}))`;
  const { results: open = [] } = await db.prepare(`SELECT id FROM guild_contracts
    WHERE region = ?1 AND kind = 'raid' AND state = 'open' AND expires_at > ?2 AND left_deeds >= 1 AND NOT ${posters('guild_contracts.guild_id')}
    ORDER BY pay DESC, at LIMIT ${CONTRACTS_READ_MAX}`).bind(region, nowS, player.id).all();
  if (!open.length) return null;
  const day = utcDay(nowS);
  const event = `raid:${key}`;
  const statements = [];
  for (const c of open) {
    const paid = 'EXISTS (SELECT 1 FROM guild_contract_pays WHERE contract = ?2 AND event = ?3 AND account = ?1 AND n = ?4)';
    statements.push(
      // THE DECISION: the claim's own row, the contract as the batch finds it (a deed left, its escrow, its tax), the
      // account none of the guild's posters, its room, and the claim's CONTRACTS_PAID_MAX
      db.prepare(`INSERT OR IGNORE INTO guild_contract_pays (contract, event, account, char_id, guild_id, pay, tax, at, day, n)
        SELECT c.id, ?3, ?1, rc.char_id, c.guild_id, c.pay - ${deedTaxSql}, ${deedTaxSql}, ?5, ?6, ?4
        FROM guild_contracts c JOIN raid_cleanses rc ON rc.raid = ?7 AND rc.account = ?1 AND rc.nonce = ?4
        WHERE c.id = ?2 AND c.state = 'open' AND c.expires_at > ?5 AND c.left_deeds >= 1 AND c.escrow >= c.pay
          AND NOT EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND guild_id = c.guild_id AND rank IN (${POSTERS_SQL}))
          AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?8)
          AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + c.pay - ${deedTaxSql} <= ?9
          AND (SELECT COUNT(*) FROM guild_contract_pays p WHERE p.event = ?3 AND p.account = ?1) < ?10`)
        .bind(player.id, c.id, event, nonce, nowS, day, key, payRid(c.id, key), MARKS_MAX, CONTRACTS_PAID_MAX),
      // the contract drawn down, a filled one closed
      db.prepare(`UPDATE guild_contracts SET left_deeds = left_deeds - 1, escrow = escrow - pay,
          state = CASE WHEN left_deeds = 1 THEN 'filled' ELSE state END, closed_at = CASE WHEN left_deeds = 1 THEN ?5 ELSE closed_at END
        WHERE id = ?2 AND ${paid}`).bind(player.id, c.id, event, nonce, nowS),
      // the silver: the pay out of the escrow, the tax burnt from it
      db.prepare(`${INSERT_LINE} SELECT 'escrow', contract, 'account', account, 'contract-pay', pay, day, at, account, ?5, ?6
        FROM guild_contract_pays WHERE contract = ?2 AND event = ?3 AND account = ?1 AND n = ?4 AND pay > 0`)
        .bind(player.id, c.id, event, nonce, displayName(player), payRid(c.id, key)),
      db.prepare(`${INSERT_LINE} SELECT 'escrow', contract, 'burn', NULL, 'market-tax', tax, day, at, account, ?5, ?6
        FROM guild_contract_pays WHERE contract = ?2 AND event = ?3 AND account = ?1 AND n = ?4 AND tax > 0`)
        .bind(player.id, c.id, event, nonce, displayName(player), taxRid(c.id, key)),
      // the filled contract's escrow (none - a filled one held exactly its deeds' pay) marked home
      ...contractReturn(db, c.id, nowS),
    );
  }
  return { statements };
}

/** What a raid's claim was paid by contracts - `[{ contract, guild: { name, tag }, pay, tax }]`, the best first - for
 *  its answer. */
export async function contractPaysOf(db, player, key) {
  const { results = [] } = await db.prepare(`SELECT p.contract, p.pay, p.tax, g.name, g.tag FROM guild_contract_pays p JOIN guilds g ON g.id = p.guild_id
    WHERE p.event = ?1 AND p.account = ?2 ORDER BY p.pay DESC`).bind(`raid:${key}`, player.id).all();
  return results.map((r) => ({ contract: r.contract, guild: { name: r.name, tag: r.tag }, pay: Number(r.pay), tax: Number(r.tax) }));
}
