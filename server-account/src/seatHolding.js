// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1d (2026-10-01, Mac: "Finish the seats"; "Continue") - HOLDING A
// SEAT: the holder's levers on its board (the Tithe, the Edict), what a
// Charter pays (the Tithe across its bailiwick, beside every sale that
// takes one - market.js), what its Edicts do on the service (the Levy on
// a harvest, the Bounty's camps paid, Open Gates' homes), and what the
// Seat tab shows the holder (its Standing, Tithe, Edicts and upkeep).
//
// bible/11-Multiplayer/Seats-Arc.md 7.1-7.3, 7.6. The numbers are
// src/net/townSeatLaw.js's; the week's reckoning of them is the Turning's
// (seatTurning.js), in its one batch.
//
// ONE STATEMENT DECIDES, as everywhere the Marks move: each act's first
// write asks every condition against the rows as they stand (the rank,
// the Charter still the guild's, the week's one change, the escrow left,
// the day's camps), and what follows it moves Marks or goods only where
// that write landed.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { accountKind, displayName, mintId, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { titheCapAt } from './seatForts.js';   // SEAT2b: the Market Hall's Tithe cap
import { marketHallTitheCap } from '../../src/net/fortLaw.js';   // AUDIT SEATS-3 A2: and a Tithe charged under it
import { confirmedSeats, seatsOpenFor } from './townSeats.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import {
  seatWeekOf, seatWeekStartMs, SEAT_WEEK_MS, seatKeyOk, seatRegionOk, edictOk, edictForTier, edictMayFollow, bailiwickOf, bountySitePixel, overreachOf, seatUpkeep,
  SEAT_LEVER_RANKS, SEAT_EDICTS_HOUR, BOUNTY_MARKS, BOUNTY_CAMPS_DAY, CROWN_SCALE, TITHE_CAP,
} from '../../src/net/townSeatLaw.js';

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
const LEVERS_SQL = SEAT_LEVER_RANKS.join(', ');
/** The most a Bounty may set aside - a week of its 5-camp days for a hundred accounts. */
export const BOUNTY_SET_ASIDE_MAX = 100_000;

/** THE ACCOUNTS THAT PLAYED IN A WEEK (SEAT0 7.1, the crown's scale) - a registered account whose last play beat
 *  (`players.played_at`, accounts.js creditPlay) falls inside it. The last beat only: one that played on after the
 *  week is counted in the next, so a settle read late counts low, and the scale's floor (0.4) holds it. */
export async function activeIn(db, week) {
  const from = Math.floor(seatWeekStartMs(week) / 1000), to = Math.floor((seatWeekStartMs(week) + SEAT_WEEK_MS) / 1000);
  const r = await db.prepare('SELECT COUNT(*) AS n FROM players WHERE handle IS NOT NULL AND played_at >= ? AND played_at < ?').bind(from, to).first();
  return Number(r?.n ?? 0);
}

/** The Charter's lever-puller: a character of `player` whose guild holds `key`, of a rank that may pull its levers. */
async function leverOf(db, player, env, character, key) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!SEAT_LEVER_RANKS.includes(Number(a.me.rank))) return { error: 'guild-rank' };
  const hold = await db.prepare('SELECT key, guild_id, tier, region, tithe, tithe_week FROM town_seat_holds WHERE key = ?').bind(key).first();
  if (!hold || hold.guild_id !== a.me.guild_id) return { error: 'seat-not-held' };
  return { me: a.me, hold };
}
/** The rank still standing and the Charter still the guild's, IN a write (`?G` the guild's id bound, `rid` the row). */
const stillSql = (rid, g) => `EXISTS (SELECT 1 FROM guild_members WHERE rowid = ${Number(rid)} AND guild_id = ${g} AND rank IN (${LEVERS_SQL}))`;

/**
 * THE TITHE SET (SEAT0 7.2: "The holder sets it: palace 0-10%, crown 0-15%, whole percents, changed at most once a
 * week") - the Guildmaster's or an Officer's, at the board. The cap and the week's one change asked in the UPDATE.
 * @param {{db: any, nowS: number}} ctx
 */
export async function setTithe({ db, nowS }, player, env, { character, key, pct } = {}) {
  const l = await leverOf(db, player, env, character, key);
  if ('error' in l) return l;
  const cap = await titheCapAt(db, key, l.hold.tier, nowS);   // SEAT2b (7.5): a Market Hall's point a tier
  if (!Number.isSafeInteger(pct) || pct < 0 || pct > cap) return { error: 'bad-tithe' };
  const week = weekAt(nowS);
  if (l.hold.tithe_week != null && Number(l.hold.tithe_week) === week) return { error: 'tithe-this-week' };
  if (await overRate({ db, nowS }, `seat-lever:${player.id}`, SEAT_EDICTS_HOUR, 3600)) return { error: 'seats-rate' };
  const r = await db.prepare(`UPDATE town_seat_holds SET tithe = ?1, tithe_week = ?2
    WHERE key = ?3 AND guild_id = ?4 AND (tithe_week IS NULL OR tithe_week <> ?2)
      AND ?1 <= ?5 AND ${stillSql(l.me.rid, '?4')}`)
    .bind(pct, week, key, l.hold.guild_id, cap).run();
  if (!r?.meta?.changes) return { error: 'tithe-this-week' };
  return { ok: true, tithe: pct };
}

/**
 * AN EDICT PROCLAIMED (SEAT0 7.6: "At each Turning the holder proclaims one Edict for the coming week ... No Edict may
 * be proclaimed two weeks running except Market Day") - for NEXT week, by the Guildmaster or an Officer at the board,
 * replaced (or taken back, `edict: null`) freely until the Turning, which makes it law and pays its cost. A Bounty
 * names the Drakes it sets aside (`setAside`, escrowed at the Turning).
 * @param {{db: any, nowS: number}} ctx
 */
export async function proclaimEdict({ db, nowS }, player, env, { character, key, edict = null, setAside = 0 } = {}) {
  const l = await leverOf(db, player, env, character, key);
  if ('error' in l) return l;
  const week = weekAt(nowS), next = week + 1;
  if (await overRate({ db, nowS }, `seat-lever:${player.id}`, SEAT_EDICTS_HOUR, 3600)) return { error: 'seats-rate' };
  if (edict === null) {
    const r = await db.prepare(`DELETE FROM town_seat_edicts WHERE key = ?1 AND week = ?2 AND guild_id = ?3 AND state = 'proclaimed' AND ${stillSql(l.me.rid, '?3')}`)
      .bind(key, next, l.hold.guild_id).run();
    return r?.meta?.changes ? { ok: true, next: null } : { error: 'seat-no-edict' };
  }
  if (!edictOk(edict)) return { error: 'bad-edict' };
  if (!edictForTier(edict, l.hold.tier)) return { error: 'edict-tier' };   // CROWN1: a crown's Edicts at a crown seat alone
  const aside = edict === 'bounty' ? setAside : 0;
  if (edict === 'bounty' && (!Number.isSafeInteger(aside) || aside < BOUNTY_MARKS || aside > BOUNTY_SET_ASIDE_MAX)) return { error: 'bad-bounty' };
  const now = await db.prepare("SELECT edict FROM town_seat_edicts WHERE key = ? AND week = ? AND state = 'law'").bind(key, week).first();
  if (!edictMayFollow(edict, now?.edict ?? null)) return { error: 'edict-twice' };
  const r = await db.prepare(`INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, set_aside, state, at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'proclaimed', ?7 WHERE ${stillSql(l.me.rid, '?4')}
      AND EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?1 AND guild_id = ?4)
    ON CONFLICT (key, week) DO UPDATE SET edict = excluded.edict, guild_id = excluded.guild_id, set_by = excluded.set_by,
      set_aside = excluded.set_aside, at = excluded.at WHERE town_seat_edicts.state = 'proclaimed'`)
    .bind(key, next, edict, l.hold.guild_id, displayName(player), aside, nowS).run();
  if (!r?.meta?.changes) return { error: 'guild-rank' };
  return { ok: true, next: edict };
}

/** THE EDICTS THAT RULE THIS WEEK, by seat key: `{ edict, guild, setAside, spent }`. */
export async function edictsOf(db, week) {
  return edictsFrom((await edictsRead(db, week).all()).results);
}
/** SEAT-BATCH (2026-10-16): edictsOf's statement and its answer apart, so the seats' list sends it in one batch. */
export const edictsRead = (/** @type {any} */ db, /** @type {number} */ week) => db.prepare("SELECT key, edict, guild_id, set_aside, spent FROM town_seat_edicts WHERE week = ? AND state = 'law'").bind(week);
export const edictsFrom = (/** @type {any[]} */ results = []) => new Map(results.map((e) => [Number(e.key), { edict: e.edict, guild: e.guild_id, setAside: Number(e.set_aside), spent: Number(e.spent) }]));

/**
 * THE HOLDER'S OWN VIEW of its Charter (the Seat tab's lines, SEAT0 7.9) - `{ standing, tithe, titheWeek, edict, next,
 * last, upkeep, owed }`: this week's Edict and the one proclaimed for the next, the upkeep the Turning will ask (its
 * Overreach over the guild's Charters, the crown's scale over this week's accounts so far - the week it settles), what it owes from Neglect. Null for
 * a seat not held.
 */
export async function holdingOf(db, key, nowS) {
  const h = await db.prepare('SELECT key, guild_id, tier, standing, tithe, tithe_week, owed FROM town_seat_holds WHERE key = ?').bind(key).first();
  if (!h) return null;
  const week = weekAt(nowS);
  const { results: es = [] } = await db.prepare("SELECT week, edict, state FROM town_seat_edicts WHERE key = ? AND week IN (?, ?) AND state IN ('law', 'proclaimed')")
    .bind(key, week, week + 1).all();
  const { results: tiers = [] } = await db.prepare('SELECT tier FROM town_seat_holds WHERE guild_id = ?').bind(h.guild_id).all();
  const active = h.tier === 'crown' ? await activeIn(db, week) : CROWN_SCALE.per;   // AUDIT SEATS-3 D1: the week the Turning settles, as it reads it
  return {
    standing: Number(h.standing), tithe: Number(h.tithe), titheWeek: h.tithe_week == null ? null : Number(h.tithe_week),
    edict: es.find((e) => Number(e.week) === week && e.state === 'law')?.edict ?? null,
    next: es.find((e) => Number(e.week) === week + 1 && e.state === 'proclaimed')?.edict ?? null,
    upkeep: seatUpkeep(h.tier, overreachOf(tiers.map((t) => t.tier)), active), owed: Number(h.owed),
  };
}

// ─── THE BAILIWICK'S TITHE, THE LEVY, OPEN GATES ────────────────────

/**
 * THE SEAT A BOARD IN `region` AT `pixel` BELONGS TO, AND ITS HOLDER'S TITHE (SEAT0 7.2) - `{ key, guild, pct }`, or
 * null where its seat is unheld or the region has none. One read when the region holds no Charter.
 */
export async function titheAt(db, nowS, region, pixel = null) {
  if (!seatRegionOk(region)) return null;
  // AUDIT SEATS-3 A2: and the Market Hall standing under it - a Tithe never charged above the cap its Hall gives now (the
  // Season's wear clamps the row in its own batch, seatForts.js fortsSeasonStatements; this is the belt to those braces).
  // The stored tier, no project raised: a Tithe was set under a cap read after its rise (titheCapAt), and only a wear or
  // a lapse lowers a tier after that
  const { results: held = [] } = await db.prepare(`SELECT h.key, h.guild_id, h.tithe, h.tier,
    (SELECT f.tier FROM town_seat_forts f WHERE f.key = h.key AND f.work = 'market') AS market FROM town_seat_holds h WHERE h.region = ?`).bind(region).all();
  if (!held.length) return null;
  // MARKET-SPEED: the seats' places off the isolate's kept witness rows (townSeats.js seatRowsOf) - the holder and its
  // Tithe above are read as they stand; only which seat a board's bailiwick is comes from the minute's rows
  const seat = bailiwickOf((await confirmedSeats(db, nowS)).values(), region, pixel);
  const h = seat ? held.find((x) => Number(x.key) === seat.key) : null;
  return h ? { key: seat.key, guild: h.guild_id, pct: Math.min(Number(h.tithe), marketHallTitheCap(TITHE_CAP[h.tier] ?? 0, Number(h.market ?? 0))) } : null;
}

/** THE LEVY'S SEAT for a harvest at `pixel` in `region` (SEAT0 7.6: "from the nodes of the region nearer this seat than
 *  any other seat of the region"): the bailiwick's seat key, where its Levy rules this week - else null. */
export async function levyAt(db, nowS, region, pixel) {
  if (!seatRegionOk(region) || !pixel) return null;
  const { results = [] } = await db.prepare("SELECT key FROM town_seat_edicts WHERE week = ? AND state = 'law' AND edict = 'levy'").bind(weekAt(nowS)).all();
  if (!results.length) return null;
  // GATHER-SPEED: the seats' places off the isolate's kept witness rows - every harvest under a Levy read them whole
  const seat = bailiwickOf((await confirmedSeats(db, nowS)).values(), region, pixel);
  return seat && results.some((e) => Number(e.key) === seat.key) ? seat.key : null;
}

/** OPEN GATES (SEAT0 7.6: "homes in the town may not be set private this week"): whether it rules at the town `mapId`
 *  this week - a row when it does. The town answer opens every home there (homes.js homesInTown), each home's own choice
 *  kept for after. HOMES-SHED (2026-10-13): the statement, not its answer - homesInTown sends it in the homes read's own
 *  batch, so a town's homes cost the database one request where they cost two. */
export const openGatesRead = (db, nowS, mapId) => db.prepare("SELECT 1 FROM town_seat_edicts WHERE key = ? AND week = ? AND state = 'law' AND edict = 'open-gates'")
  .bind(mapId, weekAt(nowS));

/**
 * A BOUNTY'S CAMP PAID (SEAT0 7.6: "the treasury pays 20 Marks per camp cleared, up to the sum set aside ... validated
 * at the reader, never the relay ... an account is paid for at most 5 camps a UTC day"): `site` the World of Daggerfall
 * camp the character cleared (its id names its map pixel), `region` the client's - in the bailiwick of a seat whose
 * Bounty rules this week. 20 Drakes from the Bounty's escrow to the account; a camp paid once a day, whoever cleared it.
 * Bounded, not witnessed: a modified client can claim camps it never fought, five a day.
 * @param {{db: any, nowS: number, rand: (b: Uint8Array) => any}} ctx
 */
export async function claimBounty({ db, nowS, rand }, player, env, { character, site, region } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (typeof character !== 'string' || !character) return { error: 'bad-bounty' };
  const pixel = bountySitePixel(site);
  if (!pixel || !seatRegionOk(region)) return { error: 'bad-bounty' };
  const week = weekAt(nowS), day = utcDay(nowS);
  const { results: rules = [] } = await db.prepare("SELECT key FROM town_seat_edicts WHERE week = ? AND state = 'law' AND edict = 'bounty'").bind(week).all();
  if (!rules.length) return { ok: true, paid: 0, why: 'no-bounty' };
  const seat = bailiwickOf((await confirmedSeats(db, nowS)).values(), region, pixel);
  if (!seat || !rules.some((e) => Number(e.key) === seat.key)) return { ok: true, paid: 0, why: 'no-bounty' };
  if (await overRate({ db, nowS }, `seat-bounty:${player.id}`, BOUNTY_CAMPS_DAY * 4, 3600)) return { error: 'seats-rate' };
  const n = mintId(rand);
  const escrow = `bounty:${seat.key}:${week}`;
  await db.batch([
    // THE DECISION: the camp unpaid today, the account under its five, the escrow holding twenty more, the balance's room
    db.prepare(`INSERT OR IGNORE INTO town_seat_bounties (day, site, account, key, week, at, n)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
      WHERE (SELECT COUNT(*) FROM town_seat_bounties WHERE account = ?3 AND day = ?1) < ?8
        AND EXISTS (SELECT 1 FROM town_seat_edicts WHERE key = ?4 AND week = ?5 AND state = 'law' AND edict = 'bounty' AND spent + ?9 <= set_aside)
        AND COALESCE((SELECT balance FROM marks WHERE account = ?3), 0) + ?9 <= ?10`)
      .bind(day, site, player.id, seat.key, week, nowS, n, BOUNTY_CAMPS_DAY, BOUNTY_MARKS, MARKS_MAX),
    db.prepare(`UPDATE town_seat_edicts SET spent = spent + ?3 WHERE key = ?1 AND week = ?2
      AND EXISTS (SELECT 1 FROM town_seat_bounties WHERE day = ?4 AND site = ?5 AND n = ?6)`).bind(seat.key, week, BOUNTY_MARKS, day, site, n),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', ?1, 'account', account, 'bounty', ?2, day, at, account, ?3, 'bounty:' || day || ':' || site
      FROM town_seat_bounties WHERE day = ?4 AND site = ?5 AND n = ?6`).bind(escrow, BOUNTY_MARKS, character, day, site, n),
  ]);
  const row = await db.prepare('SELECT account, n FROM town_seat_bounties WHERE day = ? AND site = ?').bind(day, site).first();
  if (row?.n === n) return { ok: true, paid: BOUNTY_MARKS, key: seat.key };
  if (row) return { ok: true, paid: 0, why: row.account === player.id ? 'repeat' : 'claimed' };
  const today = await db.prepare('SELECT COUNT(*) AS c FROM town_seat_bounties WHERE account = ? AND day = ?').bind(player.id, day).first();
  if (Number(today?.c ?? 0) >= BOUNTY_CAMPS_DAY) return { ok: true, paid: 0, why: 'day-full' };
  const e = await db.prepare('SELECT set_aside, spent FROM town_seat_edicts WHERE key = ? AND week = ?').bind(seat.key, week).first();
  if (e && Number(e.spent) + BOUNTY_MARKS > Number(e.set_aside)) return { ok: true, paid: 0, why: 'spent' };
  return { error: 'marks-full' };
}
