// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SCALE4b (2026-10-08, Mac: "Do 1 2 and 3" - the scaling audit's D1 discipline, bible/11-Multiplayer/Scale-Arc.md):
// THE SERVICE'S OWN CLOCK. Until this the account service had no scheduled job at all, so everything that keeps the
// database small ran inside somebody's read: the Notice Board swept its expired notes on every look, a guild's board
// the same, the professions' state pruned old harvests on every gatherer's ask, the market's History deleted nine
// tables' old rows before it answered - writes on the busiest reads, every reader racing every other to run the same
// sweep, and no read of them ever servable by a D1 read replica. And the tables nothing swept grew for ever: a rate
// window's row lives on long after its window closed, a session idle past its year is deleted only if its secret is
// ever presented again, and a guild invitation outlives its week.
//
// wrangler.toml's [triggers] name two schedules, and each runs its own list:
//
//   EVERY MINUTE (CRON_MINUTE) - the settlements nobody's read should have to wait on: the auctions past their end
//   (market.js closeAuctions), the guilds' writs and contracts past theirs (writs.js closeGuildWrits, contracts.js
//   closeContracts), the seats' weekly Turning (seatTurning.js settleDue), the season's #1 before its kept word ages
//   out (arena.js storeArenaChampion - a token's mint, an account's read and a board's badges counted it and wrote it)
//   and the day's Motherlodes (motherlodes.js motherlodesOf). EVERY ONE OF THEM STILL RUNS ON ITS READ TOO, exactly as before - a read must never answer from a
//   world the clock has not caught up with - but the clock has nearly always been first, so the read's own pass finds
//   nothing due and writes nothing. Each was written for a race (two readers at once), so the clock is one more racer.
//
//   EVERY HOUR (CRON_HOUR) - the sweeps the reads no longer run (the board's, the guild boards', the harvests', the
//   market's history, each its module's own law, exported beside its table) and the retention the tables never had:
//   a rate window a day past its start (RATE_ROW_KEEP_S - the longest window any bucket counts is an hour), a session
//   idle past SESSION_IDLE_S (the very bound resolveSession refuses it at), an invitation past GUILD_INVITE_TTL_S
//   (the bound every read of one asks).
//
// WHAT IS NOT PRUNED, AND WHY (the audit asked; read against the code, SCALE4b's record):
//   - the act receipts (prof_withdrawals, prof_choices, guild_store_moves and their kind): a client keeps an
//     unanswered act and asks it again until it is answered, with no age bound (net/profBook.js) - a receipt pruned
//     is an act that would run twice;
//   - a guest with no session left: unreachable, but its rows cascade through the realm, and its realm characters'
//     objects in R2 would be orphaned (realm.js deleteRealm is the one door that cleans both);
//   - world_witness: its rows are compacted by meaning (the first agreeing witnesses decide a fact), not by age, and
//     the seats' audit reads them - its redesign is its own slice.
//
// A JOB NEVER STOPS ANOTHER: each runs alone, a throw is logged and the next runs. Each writes one metrics point, as a
// request does (metrics.js; `cron:<job>` its route, `CRON` its method, the statements it ran, the rows it moved as a
// fourth double). A service held for maintenance (service.js maintaining - RESTORE's rewind) runs nothing: a write in
// the rewind's minute would vanish with it.
// ═══════════════════════════════════════════════════════════════════

import { closeAuctions, pruneMarketHistory, SETTLE_MAX } from './market.js';
import { closeGuildWrits } from './writs.js';
import { closeContracts } from './contracts.js';
import { settleDue } from './seatTurning.js';
import { motherlodesOf } from './motherlodes.js';
import { sweepBoard } from './board.js';
import { sweepGuildNotes } from './guildBoard.js';
import { sweepHarvests } from './professions.js';
import { SESSION_IDLE_S } from './accounts.js';
import { storeArenaChampion, ARENA_CHAMPION_CLOCK_S } from './arena.js';
import { countedDb } from './metrics.js';
import { maintaining } from './service.js';
import { WRIT_SETTLE_MAX } from '../../src/net/writLaw.js';
import { seatsSwitchOf, seasonZeroOf } from '../../src/net/townSeatLaw.js';
import { profSwitchOf } from '../../src/net/professionLaw.js';
import { GUILD_INVITE_TTL_S } from '../../src/net/guildLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { arenaSeasonOf } from '../../src/net/arenaLaw.js';

/** The two schedules - wrangler.toml's [triggers] crons name exactly these (test/scale4b.test.js holds the two to
 *  each other). The hour's minute is off the hour, where every other Worker's cron lands. */
export const CRON_MINUTE = '* * * * *';
export const CRON_HOUR = '41 * * * *';

/** A rate window's row is dead once its window has closed; the longest window any bucket counts is an hour
 *  (accounts.js overRate's callers - test/scale4b.test.js sweeps every one), so a day past its start is two dozen
 *  windows dead. */
export const RATE_ROW_KEEP_S = 24 * 3600;
/** Rows one sweep's statement takes at once, and how many times a job asks again while it took a full page - a firing
 *  is bounded however far behind it starts (an hour later it goes on). */
export const SWEEP_ROWS = 1000;
export const ROUNDS_MAX = 25;

/** Ask `step` again while it took a whole page (`page`), ROUNDS_MAX times at most - answering what it took in all. */
async function rounds(/** @type {() => Promise<number>} */ step, /** @type {number} */ page) {
  let n = 0;
  for (let i = 0; i < ROUNDS_MAX; i++) {
    const got = Number(await step()) || 0;
    n += got;
    if (got < page) break;
  }
  return n;
}

/** A bounded DELETE, `?1` the cutoff and `?2` the page - answering how many rows went. */
const deleted = async (/** @type {any} */ db, /** @type {string} */ sql, /** @type {number} */ cutoff) => {
  const r = await db.prepare(sql).bind(cutoff, SWEEP_ROWS).run();
  return Number(r?.meta?.changes ?? 0);
};

/** MOTHERLODES: the day this isolate has seen picked - asked once a day here, not every minute (the pick itself is the
 *  day's first ask, and every later one only reads it back). */
let lodesPicked = -1;
/** Tests stand fresh isolates. */
export const _resetCronForTests = () => { lodesPicked = -1; };

/** @typedef {{ db: any, nowS: number, rand: (b: Uint8Array) => void }} CronCtx */
/** @typedef {[string, (ctx: CronCtx, env: any) => Promise<number>]} CronJob */

/** @type {readonly CronJob[]} */
export const MINUTE_JOBS = Object.freeze([
  ['auctions', (ctx) => rounds(() => closeAuctions(ctx), SETTLE_MAX)],
  ['guild-writs', (ctx) => rounds(() => closeGuildWrits(ctx), WRIT_SETTLE_MAX)],
  ['contracts', (ctx) => rounds(() => closeContracts(ctx), WRIT_SETTLE_MAX)],
  // a seat's Turning while the seats are open to everyone - behind `dev` they are a developer's, settled by their reads
  ['seats', async (ctx, env) => (seatsSwitchOf(env?.SEATS_OPEN) === 'on' ? settleDue(ctx.db, ctx.nowS, seasonZeroOf(env.SEASON_ZERO_WEEK)) : 0)],
  // the season's #1, counted before a reader would count it (arena.js championNow, STORM-SHED 2's kept word)
  ['arena-champion', async (ctx) => {
    const season = arenaSeasonOf(ctx.nowS);
    const kept = await ctx.db.prepare('SELECT at FROM arena_champions WHERE season = ?1').bind(season).first();
    if (kept && ctx.nowS - Number(kept.at) < ARENA_CHAMPION_CLOCK_S) return 0;
    await storeArenaChampion(ctx, season, ctx.nowS);
    return 1;
  }],
  ['motherlodes', async (ctx, env) => {
    const day = utcDay(ctx.nowS);
    if (profSwitchOf(env?.PROFESSIONS_OPEN) !== 'on' || lodesPicked === day) return 0;
    const lodes = await motherlodesOf(ctx, day);
    lodesPicked = day;
    return lodes.length;
  }],
]);

/** @type {readonly CronJob[]} */
export const HOUR_JOBS = Object.freeze([
  ['board', (ctx) => rounds(() => sweepBoard(ctx.db, ctx.nowS, SWEEP_ROWS), SWEEP_ROWS)],
  ['guild-board', (ctx) => rounds(() => sweepGuildNotes(ctx.db, ctx.nowS, SWEEP_ROWS), SWEEP_ROWS)],
  ['harvests', (ctx) => rounds(() => sweepHarvests(ctx.db, ctx.nowS, SWEEP_ROWS), SWEEP_ROWS)],
  ['market-history', (ctx) => pruneMarketHistory(ctx.db, ctx.nowS)],
  ['rate-limits', (ctx) => rounds(() => deleted(ctx.db,
    'DELETE FROM rate_limits WHERE rowid IN (SELECT rowid FROM rate_limits WHERE window_start < ?1 LIMIT ?2)', ctx.nowS - RATE_ROW_KEEP_S), SWEEP_ROWS)],
  // resolveSession's own bound: idle when nowS - last_seen > SESSION_IDLE_S (0090_scale4.sql indexes last_seen)
  ['sessions', (ctx) => rounds(() => deleted(ctx.db,
    'DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE last_seen < ?1 LIMIT ?2)', ctx.nowS - SESSION_IDLE_S), SWEEP_ROWS)],
  // every read of an invitation asks `at > now - GUILD_INVITE_TTL_S` (guilds.js)
  ['guild-invites', (ctx) => rounds(() => deleted(ctx.db,
    'DELETE FROM guild_invites WHERE rowid IN (SELECT rowid FROM guild_invites WHERE at <= ?1 LIMIT ?2)', ctx.nowS - GUILD_INVITE_TTL_S), SWEEP_ROWS)],
]);

/** The jobs a schedule runs - none for a schedule this service does not keep. */
export const jobsFor = (/** @type {string} */ cron) => (cron === CRON_MINUTE ? MINUTE_JOBS : cron === CRON_HOUR ? HOUR_JOBS : []);

/**
 * ONE FIRING: every job of `cron`'s list, each alone - answering what each did.
 * @param {any} env @param {{ cron: string, nowS: number, rand?: (b: Uint8Array) => void, jobs?: readonly CronJob[] }} at
 * @returns {Promise<Array<{ name: string, ok: boolean, changed: number, statements: number, ms: number }>>}
 */
export async function runCron(env, { cron, nowS, rand = (b) => { crypto.getRandomValues(b); }, jobs = jobsFor(cron) }) {
  if (!env?.DB || maintaining(env) || !Number.isSafeInteger(nowS)) return [];
  const out = [];
  for (const [name, job] of jobs) {
    const tally = { n: 0 };
    const started = Date.now();
    let ok = true, changed = 0;
    try {
      changed = Number(await job({ db: countedDb(env.DB, tally), nowS, rand }, env)) || 0;
    } catch (e) {
      ok = false;
      console.warn(`[cron] ${name} failed`, e?.message ?? e);
    }
    const ms = Date.now() - started;
    out.push({ name, ok, changed, statements: tally.n, ms });
    try {
      env.METRICS?.writeDataPoint?.({ indexes: [`cron:${name}`], blobs: [`cron:${name}`, 'CRON', ok ? '200' : '500', ok ? '' : 'failed'], doubles: [ms, ok ? 200 : 500, tally.n, changed] });
    } catch { /* a metric never costs a job */ }
  }
  return out;
}
