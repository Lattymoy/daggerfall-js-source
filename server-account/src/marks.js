// @ts-check
// ═══════════════════════════════════════════════════════════════════
// MARKS1 - MARKS, AS THE SERVICE KEEPS THEM (bible/06-Systems/
// Professions-Arc.md 10.5; the law both ends read is
// src/net/marksLaw.js).
//
// ═══ REGISTERED ONLY, AND BEHIND A SWITCH ══════════════════════════
//
// A balance is an account's, and a guest is a device (MAIL1's reading):
// Marks held by a credential a cleared browser loses are Marks gone. And
// the currency opens by the service's own config, MARKS_OPEN (PROF0 20):
// `off`, `dev` (the developers alone - the dev glyph's handles), `on`.
// Closed, nothing here strikes, moves or answers a balance.
//
// ═══ ONE STATEMENT DECIDES ═════════════════════════════════════════
//
// Every movement is ONE `INSERT ... SELECT ... WHERE` into the ledger
// (0025_marks.sql), its WHERE holding the payer's balance, the payee's
// cap and the day's cap as they stand at that statement; the ledger's own
// triggers move the balances on the line's insert. So two requests racing
// never overdraw a balance nor pass a cap, no Mark moves without its line,
// and no line is written for Marks that did not move (GUILD1's law,
// guilds.js). A statement that changed nothing is read again for WHY, and
// the answer names it.
//
// ═══ A REQUEST ASKED TWICE IS ONE LINE ═════════════════════════════
//
// The client names each act (`rid`), and the ledger holds (actor, rid)
// once: a request sent again because its answer was lost is answered
// with the line it made (`repeat`), never charged or paid twice - the
// Bank's gold above all, which the client adds to its purse only on an
// answer (RENOWN1 DATA-4's rule). AUDIT 28 M2: THAT LINE IS LOOKED FOR
// BEFORE THE SWITCH - a request whose line exists is answered it whatever
// the switch says now, so the client can tell "made, and here it is"
// from "never made" and keeps a sale until it knows which. The service's
// own lines (a gate's strike, a disband's sweep) carry a `:` the client's
// ids never can (MARKS_RID_RE), so no client request can take one.
//
// ═══ GOLD NEVER BUYS MARKS ═════════════════════════════════════════
//
// There is no line kind, route or statement here that takes gold and
// strikes Marks. The faucets are acts a server witnessed (MARKS1 builds
// the first: the gate's receipts, from claimGate); the Bank only BUYS
// Marks back (exchange).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { isDeveloper } from './titles.js';
import { guildActorOf, guildKeepsSql } from './guilds.js';
import {
  MARKS_MAX, MARKS_FAUCETS, MARKS_COMBAT, MARKS_BANK, MARKS_MOVE_MAX, MARKS_REPORT_DAYS, MARKS_OPS_MAX, MARKS_OPS_WINDOW_S, MARKS_RID_RE,
  marksSwitchOf, utcDay, marksAmountOk, exchangeGold,
} from '../../src/net/marksLaw.js';
import { guildMay } from '../../src/net/guildLaw.js';
import { medianOf, MARKET_REPORT_MEDIANS } from '../../src/net/marketLaw.js';   // PROF5: the report's medians

/** Whether Marks are open to this account: the switch, and at `dev` the developers alone. */
export function marksOpenFor(player, env) {
  const s = marksSwitchOf(env?.MARKS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

/** An account's balance - 0 for one that never held a Mark. */
export async function balanceOf(db, account) {
  const r = await db.prepare('SELECT balance FROM marks WHERE account = ?').bind(account).first();
  return r ? Number(r.balance) : 0;
}
/** A guild's Marks treasury. */
export async function guildBalanceOf(db, guildId) {
  const r = await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(guildId).first();
  return r ? Number(r.balance) : 0;
}
/** SILVER-WAYS: the combat faucets' kinds, in SQL (`kind IN (...)`) - MARKS_COMBAT's own. */
const COMBAT_KINDS_SQL = MARKS_COMBAT.kinds.map((k) => `'${k}'`).join(', ');
/** SILVER-WAYS: the combat silver account `a` has had struck on UTC day `d`, in SQL - what the day's cap counts. */
const combatEarnedSql = (a, d) => `(SELECT COALESCE(SUM(amount), 0) FROM marks_ledger WHERE dst_kind = 'account' AND dst_id = ${a}
  AND kind IN (${COMBAT_KINDS_SQL}) AND day = ${d})`;
/** What an account has had struck by a faucet today, and sold to the Bank today. */
async function todayOf(db, account, day) {
  const g = await db.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE dst_id = ? AND kind = 'gate' AND day = ?").bind(account, day).first();
  const c = await db.prepare(`SELECT ${combatEarnedSql('?1', '?2')} AS s`).bind(account, day).first();
  const x = await db.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM marks_ledger WHERE src_id = ? AND kind = 'exchange' AND day = ?").bind(account, day).first();
  return { gate: Number(g?.n ?? 0), combat: Number(c?.s ?? 0), exchanged: Number(x?.s ?? 0) };
}
/** The line an actor's request already made, if it made one. */
const lineOf = (db, actor, rid) => db.prepare('SELECT * FROM marks_ledger WHERE actor = ? AND rid = ?').bind(actor, rid).first();
const INSERT_LINE = 'INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)';

/** The first door every Marks act walks through: a registered account, and (for an act) a request id. */
function whoAsks(player, rid, { needRid = true } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'marks-need-account' };
  if (needRid && (typeof rid !== 'string' || !MARKS_RID_RE.test(rid))) return { error: 'marks-rid' };
  return null;
}
/** The switch - asked AFTER the line an act's request may already have made (AUDIT 28 M2). */
const shut = (player, env) => (marksOpenFor(player, env) ? null : { error: 'marks-closed' });
/** Runs one deciding INSERT; a UNIQUE clash (the same request, racing itself) reads as "made no line". */
async function decide(stmt) {
  try { return Number((await stmt.run())?.meta?.changes ?? 0) > 0; } catch (e) {
    if (/UNIQUE/i.test(String(e?.message ?? e))) return false;
    throw e;
  }
}

// ─── THE COMBAT FAUCETS: A GATE'S RECEIPT, A RAID'S ─────────────────

/** A gate's line id: its game day, under the service's own `:` (AUDIT 28 M11 - never a client's). */
export const gateStrikeRid = (gameDay) => `gate:${gameDay}`;
/** SILVER-WAYS: a raid's line id - its key (`region:location:day`, RAID_KEY_RE), under the service's own `:`. */
export const raidStrikeRid = (key) => `raid:${key}`;

/**
 * SILVER-WAYS: THE CLAIM'S OWN ROW, as a combat line's (and a deed's) guard - the line is written only while the row
 * this claim wrote stands, so a strike that fails takes the row back with it (AUDIT 28 M4's law, the gate's first).
 * Every statement that reads one binds the account at ?1 and the moment at ?4; `p` is the guard's first parameter.
 *   gate - the receipt's gate_kills row, written this second (`at` = now): its game day at ?p.
 *   raid - the receipt's raid_cleanses row, stamped with this claim's nonce: the key at ?p, the nonce at ?p+1.
 */
const CLAIM_GUARDS = Object.freeze({
  gate: (p) => `EXISTS (SELECT 1 FROM gate_kills WHERE day = ?${p} AND account = ?1 AND at = ?4)`,
  raid: (p) => `EXISTS (SELECT 1 FROM raid_cleanses WHERE raid = ?${p} AND account = ?1 AND nonce = ?${p + 1})`,
});

/**
 * A COMBAT STRIKE: `kind`'s amount (MARKS_FAUCETS) to the account, or what the day's combat cap has left of it
 * (MARKS_COMBAT - the gates' and the raids' together, a UTC day), never past MARKS_MAX; `rid` the claim's own, so one
 * gate or one raid strikes once whatever asks; written only while the claim's own row stands (CLAIM_GUARDS).
 */
function combatStrikeStatement({ db, nowS }, player, kind, rid, guard) {
  const { amount } = MARKS_FAUCETS[kind];
  const day = utcDay(nowS);
  const pay = `MIN(?2, ?6 - ${combatEarnedSql('?1', '?3')})`;
  return db.prepare(`${INSERT_LINE}
    SELECT 'mint', NULL, 'account', ?1, '${kind}', ${pay}, ?3, ?4, ?1, NULL, ?5
    WHERE ${combatEarnedSql('?1', '?3')} < ?6
      AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + ${pay} <= ?7
      AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?5)
      AND ${CLAIM_GUARDS[kind](8)}`)
    .bind(player.id, amount, day, nowS, rid, MARKS_COMBAT.perDay, MARKS_MAX, ...guard);
}
/** Whether Marks are this account's to be struck: registered, and the switch. */
const strikesFor = (player, env) => accountKind(player) === 'linked' && marksOpenFor(player, env);

/**
 * WB5b's receipt, counted: 50 silver to the account - SILVER-WAYS: under the day's combat cap, the day's last strike
 * what it has left - never past MARKS_MAX. The gate's game day is the line's request id, so one gate strikes once
 * whatever asks. THE STATEMENT, not its run - null where Marks are not this account's (a guest, the switch). AUDIT 28
 * M4: claimGate runs it IN ONE BATCH with the receipt's gate_kills row, and only while that row is the one this claim
 * wrote (`at` = now): a strike that fails takes the row back with it, so the client's retry claims afresh and strikes,
 * where a row kept without its Marks answered `claimed` for ever.
 */
export function gateStrikeStatement(ctx, player, env, gameDay) {
  if (!strikesFor(player, env) || !Number.isSafeInteger(gameDay)) return null;
  return combatStrikeStatement(ctx, player, 'gate', gateStrikeRid(gameDay), [gameDay]);
}
/** SILVER-WAYS: a raid's receipt, counted - 30 silver under the day's combat cap, in claimRaid's own batch and only
 *  while the raid_cleanses row this claim stamped with `nonce` stands. Null where Marks are not this account's. */
export function raidStrikeStatement(ctx, player, env, key, nonce) {
  if (!strikesFor(player, env) || typeof key !== 'string' || typeof nonce !== 'string') return null;
  return combatStrikeStatement(ctx, player, 'raid', raidStrikeRid(key), [key, nonce]);
}
/** What a combat strike answers: `{ struck, balance, combat }`, `struck` 0 with a `why` (`cap` - the day's combat cap
 *  met; `full` - the balance at the most), or null where Marks are not this account's. `struck` says whether the
 *  statement wrote its line; the amount is the line's own (the day's last strike may be less than the faucet's).
 *  `combat` the day's combat silver and its cap, for the line the client says. */
export async function combatStrikeAnswer({ db, nowS }, player, env, struck, rid) {
  if (!strikesFor(player, env)) return null;
  const balance = await balanceOf(db, player.id);
  const today = await todayOf(db, player.id, utcDay(nowS));
  const combat = { earned: today.combat, max: MARKS_COMBAT.perDay };
  const line = struck ? await lineOf(db, player.id, rid) : null;
  if (line) return { struck: Number(line.amount), balance, combat };
  return { struck: 0, balance, combat, why: today.combat >= MARKS_COMBAT.perDay ? 'cap' : 'full' };
}
/** The gate's answer (combatStrikeAnswer, under the gate's line id). */
export const gateStrikeAnswer = (ctx, player, env, struck, gameDay) => combatStrikeAnswer(ctx, player, env, struck, gateStrikeRid(gameDay));
/** The strike alone (the statement, run, and its answer) - for a gate_kills row this same second already wrote. */
export async function strikeGateMarks(ctx, player, env, gameDay) {
  const stmt = gateStrikeStatement(ctx, player, env, gameDay);
  if (!stmt) return null;
  return gateStrikeAnswer(ctx, player, env, await decide(stmt), gameDay);
}

// ─── GUILD DEEDS: A GUILD'S ACCOUNTS ON ONE RAID OR GATE ────────────

/** SILVER-WAYS: the deed's event - one raid (its key) or one gate (its game day). */
export const deedEvent = (kind, id) => `${kind}:${id}`;
/** A deed's line id, under its guild as the actor (so a guild strikes one deed an event, whoever completes it). */
export const deedRid = (event) => `deed:${event}`;

/**
 * SILVER-WAYS: A GUILD DEED'S TWO STATEMENTS, for a claim's own batch - `null` where Marks are not this account's.
 *   1. THE MARK: this account counts for the guild its claiming `character` is in - where that character has been in
 *      it MARKS_FAUCETS.deed.tenureS (7 days: a guild joined for the day earns nothing) - once an (event, account)
 *      WHATEVER THE GUILD, and only while the claim's own row stands (CLAIM_GUARDS[`kind`], its parameters `guard`).
 *      AUDIT SILVER-WAYS A1: a gate's guard is its row's second, and a refused re-claim in that second (the same
 *      receipt, another character named) passed it - the mark was once a (guild, event, account), so an account with a
 *      character in each of three guilds marked all three, and its gate struck their deeds. One account, one guild an
 *      event: the migration's unique (event, account), which this INSERT OR IGNORE meets.
 *   2. THE STRIKE: where that guild now has `members` (3) accounts' marks on the event, 25 silver into its treasury -
 *      once an event a guild (the line's id the deed's, the guild its actor), at most `perDay` (4) a guild a UTC day,
 *      never past MARKS_MAX. A strike the day's cap refused is struck by the next member's COUNTED claim of that event:
 *      AUDIT SILVER-WAYS A2 - by the claim's own row as the mark is (a refused re-send of a week-old receipt the next
 *      day struck a deed its answer never said).
 * A character counts on the claim alone: one account is one mark, however many of its characters are in the guild.
 */
export function deedStatements({ db, nowS }, player, env, { kind, event, character, guard }) {
  if (!strikesFor(player, env) || typeof character !== 'string' || !character || !CLAIM_GUARDS[kind]) return null;
  const { amount, perDay, members, tenureS } = MARKS_FAUCETS.deed;
  return [
    db.prepare(`INSERT OR IGNORE INTO guild_deed_marks (guild_id, event, account, char_id, at)
      SELECT m.guild_id, ?2, ?1, ?3, ?4 FROM guild_members m
      WHERE m.player = ?1 AND m.char_id = ?3 AND m.joined_at <= ?4 - ?5 AND ${CLAIM_GUARDS[kind](6)}`)
      .bind(player.id, event, character, nowS, tenureS, ...guard),
    db.prepare(`${INSERT_LINE}
      SELECT 'mint', NULL, 'guild', d.guild_id, 'guild-deed', ?2, ?3, ?4, d.guild_id, ?5, ?6
      FROM guild_deed_marks d
      WHERE d.event = ?7 AND d.account = ?1
        AND (SELECT COUNT(*) FROM guild_deed_marks x WHERE x.guild_id = d.guild_id AND x.event = ?7) >= ?8
        AND (SELECT COUNT(*) FROM marks_ledger l WHERE l.dst_kind = 'guild' AND l.dst_id = d.guild_id AND l.kind = 'guild-deed' AND l.day = ?3) < ?9
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = d.guild_id), 0) + ?2 <= ?10
        AND NOT EXISTS (SELECT 1 FROM marks_ledger l WHERE l.actor = d.guild_id AND l.rid = ?6)
        AND ${CLAIM_GUARDS[kind](11)}`)
      .bind(player.id, amount, utcDay(nowS), nowS, displayName(player), deedRid(event), event, members, perDay, MARKS_MAX, ...guard),
  ];
}
/** SILVER-WAYS: the claim's deed, as its answer says it - `{ struck, guild: { name, tag } }` where THIS claim's batch
 *  struck it (`struck` the strike statement's result), else null. */
export async function deedAnswer(db, player, event, struck) {
  if (!struck) return null;
  const r = await db.prepare(`SELECT l.amount, g.name, g.tag FROM guild_deed_marks d JOIN marks_ledger l ON l.actor = d.guild_id AND l.rid = ?2
      JOIN guilds g ON g.id = d.guild_id WHERE d.event = ?1 AND d.account = ?3`).bind(event, deedRid(event), player.id).first();
  return r ? { struck: Number(r.amount), guild: { name: r.name, tag: r.tag } } : null;
}
/** SILVER-WAYS: a guild's deeds today, against the day's cap - the Guild tab's line. */
export async function guildDeedsToday(db, guildId, nowS) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE dst_kind = 'guild' AND dst_id = ?1 AND kind = 'guild-deed' AND day = ?2")
    .bind(guildId, utcDay(nowS)).first();
  return { deeds: Number(r?.n ?? 0), deedsMax: MARKS_FAUCETS.deed.perDay };
}

// ─── THE BALANCE ────────────────────────────────────────────────────

/** An account's Marks as its card says them: the balance, today's gate strikes, the day's combat silver (SILVER-WAYS)
 *  and Bank sales against their caps. */
export async function marksOf({ db, nowS }, player, env) {
  const refused = whoAsks(player, null, { needRid: false }) ?? shut(player, env);
  if (refused) return refused;
  const today = await todayOf(db, player.id, utcDay(nowS));
  return {
    balance: await balanceOf(db, player.id),
    today: { gate: today.gate, combat: today.combat, combatMax: MARKS_COMBAT.perDay, exchanged: today.exchanged, exchangeMax: MARKS_BANK.perDay },
    bank: { goldPerMark: MARKS_BANK.goldPerMark },
  };
}
/** The account view's one field: the balance where Marks are this account's, null where they are not. */
export async function marksCardOf(ctx, player, env) {
  if (accountKind(player) !== 'linked' || !marksOpenFor(player, env)) return null;
  return balanceOf(ctx.db, player.id);
}

// ─── THE BANK: MARKS FOR GOLD, NEVER GOLD FOR MARKS ─────────────────

/**
 * SELL MARKS TO THE BANK OF THE EMPIRE: `marks` burnt, `gold` = marks x 8 for the client to put in the purse, at most
 * 300 Marks a UTC day. The gold is the save's (it always is); the service's part is the burn and its cap.
 */
export async function exchangeMarks(ctx, player, env, { marks, rid } = {}) {
  const { db, nowS } = ctx;
  const refused = whoAsks(player, rid);
  if (refused) return refused;
  const day = utcDay(nowS);
  // AUDIT 28 M9: every answer says today's sales, so "Sold today" moves with the sale
  const sold = async () => (await todayOf(db, player.id, day)).exchanged;
  const repeat = async (line) => (line.kind !== 'exchange' ? { error: 'marks-rid' }
    : { repeat: true, marks: line.amount, gold: exchangeGold(line.amount), balance: await balanceOf(db, player.id), exchangedToday: await sold() });
  const prior = await lineOf(db, player.id, rid);
  if (prior) return repeat(prior);   // AUDIT 28 M2: before the switch - a sale made is a sale answered
  const closed = shut(player, env);
  if (closed) return closed;
  if (!marksAmountOk(marks, MARKS_BANK.perDay)) return { error: 'bad-marks' };
  if (await overRate(ctx, `marks:${player.id}`, MARKS_OPS_MAX, MARKS_OPS_WINDOW_S)) return { error: 'marks-rate' };
  const made = await decide(db.prepare(`${INSERT_LINE}
    SELECT 'account', ?1, 'burn', NULL, 'exchange', ?2, ?3, ?4, ?1, NULL, ?5
    WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?2
      AND COALESCE((SELECT SUM(amount) FROM marks_ledger WHERE src_id = ?1 AND kind = 'exchange' AND day = ?3), 0) + ?2 <= ?6`)
    .bind(player.id, marks, day, nowS, rid, MARKS_BANK.perDay));
  if (!made) {
    const again = await lineOf(db, player.id, rid);
    if (again) return repeat(again);   // the same request, racing itself - or an id another act already took, which is never a sale
    return { error: (await sold()) + marks > MARKS_BANK.perDay ? 'marks-bank-cap' : 'marks-short' };
  }
  return { ok: true, marks, gold: exchangeGold(marks), balance: await balanceOf(db, player.id), exchangedToday: await sold() };
}

// ─── A GUILD'S MARKS TREASURY ───────────────────────────────────────

/** PUT MARKS IN - any member, from the account's balance (PROF0 10.5: "deposits from any member's balance"). */
export async function depositGuildMarks(ctx, player, env, { character, marks, rid } = {}) {
  return moveGuildMarks(ctx, player, env, { character, marks, rid }, 'guild-deposit');
}
/** TAKE MARKS OUT - the guildmaster's alone (GUILD1's law), into the guildmaster's account balance. */
export async function withdrawGuildMarks(ctx, player, env, { character, marks, rid } = {}) {
  return moveGuildMarks(ctx, player, env, { character, marks, rid }, 'guild-withdraw');
}
async function moveGuildMarks(ctx, player, env, { character, marks, rid }, kind) {
  const { db, nowS } = ctx;
  const refused = whoAsks(player, rid);
  if (refused) return refused;
  const a = await guildActorOf(db, player, character);
  if (a.error) return a;
  const deposit = kind === 'guild-deposit';
  const answer = async (extra) => ({ ...extra, balance: await balanceOf(db, player.id), guildMarks: await guildBalanceOf(db, a.me.guild_id) });
  const prior = await lineOf(db, player.id, rid);
  if (prior) return prior.kind === kind ? answer({ repeat: true, marks: prior.amount }) : { error: 'marks-rid' };   // AUDIT 28 M2: before the switch
  const closed = shut(player, env);
  if (closed) return closed;
  if (!guildMay(a.me.rank, deposit ? 'deposit' : 'withdraw')) return { error: 'guild-rank' };
  if (!marksAmountOk(marks, MARKS_MOVE_MAX)) return { error: 'bad-marks' };
  if (await overRate(ctx, `marks:${player.id}`, MARKS_OPS_MAX, MARKS_OPS_WINDOW_S)) return { error: 'marks-rate' };
  const day = utcDay(nowS);
  const who = displayName(player);
  const made = await decide(deposit
    ? db.prepare(`${INSERT_LINE}
      SELECT 'account', ?1, 'guild', ?2, 'guild-deposit', ?3, ?4, ?5, ?1, ?6, ?7
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?3
        AND COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) + ?3 <= ?8
        AND EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?9 AND guild_id = ?2)`)
      .bind(player.id, a.me.guild_id, marks, day, nowS, who, rid, MARKS_MAX, character)
    : db.prepare(`${INSERT_LINE}
      SELECT 'guild', ?2, 'account', ?1, 'guild-withdraw', ?3, ?4, ?5, ?1, ?6, ?7
      WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) >= ?3
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + ?3 <= ?8
        AND EXISTS (SELECT 1 FROM guild_members WHERE player = ?1 AND char_id = ?9 AND guild_id = ?2 AND rank = ?10)`)
      .bind(player.id, a.me.guild_id, marks, day, nowS, who, rid, MARKS_MAX, character, a.me.rank));
  if (!made) {
    const again = await lineOf(db, player.id, rid);
    if (again) return again.kind === kind ? answer({ repeat: true, marks: again.amount }) : { error: 'marks-rid' };
    const [mine, theirs] = [await balanceOf(db, player.id), await guildBalanceOf(db, a.me.guild_id)];
    if (deposit) return { error: mine < marks ? 'marks-short' : theirs + marks > MARKS_MAX ? 'guild-marks-full' : 'no-guild' };
    return { error: theirs < marks ? 'guild-marks-short' : mine + marks > MARKS_MAX ? 'marks-full' : 'guild-rank' };
  }
  return answer({ ok: true, marks });
}

/**
 * AUDIT 28 M3/M5: A GUILD THAT GOES TAKES NO MARKS WITH IT. Its Marks treasury goes to its guildmaster's balance - the
 * one account that could take them out - as one `guild-withdraw` line, in the SAME batch as the delete that ends the
 * guild (guilds.js: a disband, or the last member's leave). The statement: it writes its line only while the guild
 * would go - its gold treasury empty and, for a leave, nobody else in it - and only while the guildmaster's balance has
 * room; the delete after it then finds the Marks treasury empty, or finds it full and refuses. No switch is asked: a
 * closed currency locked every guild holding Marks (the guildmaster could neither take them out nor disband), and a
 * cascade that deleted them wrote no line, so the ledger stopped adding up. The line's id is the guild's, under the
 * service's own `:`.
 */
export function guildMarksSweep(db, guildId, player, nowS, { alone = false } = {}) {
  return db.prepare(`${INSERT_LINE}
    SELECT 'guild', ?1, 'account', ?2, 'guild-withdraw', gm.balance, ?3, ?4, ?2, ?5, ?6
    FROM guild_marks gm
    WHERE gm.guild_id = ?1 AND gm.balance > 0
      AND COALESCE((SELECT balance FROM marks WHERE account = ?2), 0) + gm.balance <= ?7
      AND EXISTS (SELECT 1 FROM guilds WHERE id = ?1 AND treasury = 0)
      AND NOT ${guildKeepsSql('?1')}   -- PROF6: a guild that keeps its Stores or a writ does not go, so its Marks stay
      AND (?8 = 0 OR (SELECT COUNT(*) FROM guild_members WHERE guild_id = ?1) = 1)`)
    .bind(guildId, player.id, utcDay(nowS), nowS, displayName(player), `disband:${guildId}`, MARKS_MAX, alone ? 1 : 0);
}

// ─── THE WEEKLY REPORT (for Mac, from the ledger) ────────────────────

/**
 * PROF0 10.5's report, a developer's alone: the last seven UTC days' Marks struck by faucet and burnt by sink, what
 * moved between accounts and guilds, what is in circulation now, the day-by-day line, and the accounts that reached a
 * cap (a faucet's or the Bank's), each once, with the account-days beside them - the numbers PROF0 16 steers the
 * economy by. PROF5: the median prices of the twenty most-traded materials over the same days (10.5), and the Marks held
 * in escrow beside the balances in circulation (PROF6: every escrow - orders, bids, guild writs, commissions).
 */
export async function marksReport({ db, nowS }, player, env) {
  if (!isDeveloper(player, env)) return { error: 'not-developer' };
  const today = utcDay(nowS);
  const from = today - MARKS_REPORT_DAYS + 1;
  const byKind = async (where) => Object.fromEntries(((await db.prepare(`SELECT kind, SUM(amount) AS s FROM marks_ledger WHERE day >= ? AND ${where} GROUP BY kind`)
    .bind(from).all())?.results ?? []).map((r) => [r.kind, Number(r.s)]));
  const minted = await byKind("src_kind = 'mint'");
  const burnt = await byKind("dst_kind = 'burn'");
  const moved = await byKind("src_kind <> 'mint' AND dst_kind <> 'burn'");
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const acc = await db.prepare('SELECT COALESCE(SUM(balance), 0) AS s, COUNT(*) AS n FROM marks WHERE balance > 0').first();
  const gld = await db.prepare('SELECT COALESCE(SUM(balance), 0) AS s FROM guild_marks').first();
  // PROF6: the Marks in escrow are the ledger's escrow end - what went in less what came out - so the orders', the bids'
  // (PROF5b's, which the orders' own column never counted), the guild writs' and the commissions' are one number
  const esc = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN dst_kind = 'escrow' THEN amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN src_kind = 'escrow' THEN amount ELSE 0 END), 0) AS s FROM marks_ledger WHERE dst_kind = 'escrow' OR src_kind = 'escrow'`).first();
  // PROF5: the market's twenty most-traded materials, each its units and its median over the report's days
  const { results: traded = [] } = await db.prepare(`SELECT material, SUM(units) AS u FROM market_prices WHERE day >= ?1 GROUP BY material
    ORDER BY u DESC, material LIMIT ?2`).bind(from, MARKET_REPORT_MEDIANS).all();
  const { results: priced = [] } = traded.length ? await db.prepare(`SELECT material, price, units FROM market_prices WHERE day >= ?1 AND material IN
    (${traded.map((_, i) => `?${i + 2}`).join(', ')})`).bind(from, ...traded.map((t) => t.material)).all() : { results: [] };
  const medians = traded.map((t) => ({
    material: t.material, units: Number(t.u),
    median: medianOf(priced.filter((r) => r.material === t.material).map((r) => ({ price: Number(r.price), units: Number(r.units) }))),
  }));
  const days = ((await db.prepare(`SELECT day,
      SUM(CASE WHEN src_kind = 'mint' THEN amount ELSE 0 END) AS minted,
      SUM(CASE WHEN dst_kind = 'burn' THEN amount ELSE 0 END) AS burnt
    FROM marks_ledger WHERE day >= ? GROUP BY day ORDER BY day`).bind(from).all())?.results ?? [])
    .map((r) => ({ day: Number(r.day), minted: Number(r.minted), burnt: Number(r.burnt) }));
  // AUDIT 28 M10: the ACCOUNTS that reached a cap (each once, however many of the days), and the account-days beside it -
  // SILVER-WAYS: the day's combat cap (the gates' and the raids' together) where the gate's two a day stood
  const combatCapped = await db.prepare(`SELECT COUNT(DISTINCT dst_id) AS n, COUNT(*) AS d FROM (SELECT dst_id FROM marks_ledger
    WHERE dst_kind = 'account' AND kind IN (${COMBAT_KINDS_SQL}) AND day >= ? GROUP BY dst_id, day HAVING SUM(amount) >= ?)`).bind(from, MARKS_COMBAT.perDay).first();
  const bankCapped = await db.prepare(`SELECT COUNT(DISTINCT src_id) AS n, COUNT(*) AS d FROM (SELECT src_id FROM marks_ledger WHERE kind = 'exchange' AND day >= ?
    GROUP BY src_id, day HAVING SUM(amount) >= ?)`).bind(from, MARKS_BANK.perDay).first();
  const m = sum(minted), b = sum(burnt);
  return {
    from, to: today, minted, burnt, moved, mintedTotal: m, burntTotal: b, ratio: b > 0 ? Math.round((m / b) * 100) / 100 : null,
    circulation: { accounts: Number(acc?.s ?? 0), guilds: Number(gld?.s ?? 0), escrow: Number(esc?.s ?? 0), holders: Number(acc?.n ?? 0) },
    days, capped: { combat: Number(combatCapped?.n ?? 0), bank: Number(bankCapped?.n ?? 0) },
    cappedDays: { combat: Number(combatCapped?.d ?? 0), bank: Number(bankCapped?.d ?? 0) },
    medians,
  };
}
