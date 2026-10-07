// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): A SEAT'S FORTIFICATIONS AS THE SERVICE KEEPS THEM (bible/11-Multiplayer/Seats-Arc.md 7.5; the law
// src/net/fortLaw.js; migration 0061).
//
// THE SEAT'S, NOT THE GUILD'S: a work's tier stands at the seat whoever holds it. A PROJECT is one tier of one work,
// begun by the holder's Guildmaster or an Officer at the board - its Marks burnt from the treasury then - and supplied
// from the seat's STOCKPILE (the Levy's tenth, and the seat writs SEAT2b delivers): each read and each delivery moves
// what the stockpile holds of the project's needs into it, the works in the table's order. The day its last need is
// met it is "delivered", and it stands 2, 4 or 7 days later (7.5). A Builder's project (Masonry 50, its starter's)
// asks nine tenths of the stone.
//
// THE DROPS: a capture takes every work a tier down (fortLaw.js fortsAfterCapture - the Walls kept once a Season where
// a Fortifier stood on the losing side's roster), and a building project falls with the Charter, what it held going
// back to the stockpile (the seat's) and its Marks spent; a Season's end takes every work a tier down; Season 0's end
// wipes them (seatTurning.js SEASON_ZERO_WIPED). A Charter relinquished keeps them (16).
//
// DECIDED: one project a work at a time, any number of works at once; a Harbour is raised where the funding client
// names its town a port (DFU's own port flag, read by the client - bounded: a lie spends the liar's own treasury on a
// harbour nothing docks at).
// ═══════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { seatsOpenFor, confirmedSeats } from './townSeats.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { seatWeekOf, seatKeyOk, SEAT_LEVER_RANKS, SEAT_EDICTS_HOUR } from '../../src/net/townSeatLaw.js';
import { FORT_WORKS, fortWork, fortMaxTier, fortMayRaise, fortNeeds, fortStandsAt, fortWanting, marketHallListings, marketHallTitheCap, campSpent } from '../../src/net/fortLaw.js';
import { MARKET_LISTINGS_MAX } from '../../src/net/marketLaw.js';
import { TITHE_CAP } from '../../src/net/townSeatLaw.js';
import { specsAt, trackOf, isBuilder as isBuilderSpec, isFortifier as isFortifierSpec, isSiegewright as isSiegewrightSpec } from '../../src/net/professionLaw.js';

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
const ORDER = new Map(FORT_WORKS.map((w, i) => [w.id, i]));
const byOrder = (a, b) => (ORDER.get(a.work) ?? 99) - (ORDER.get(b.work) ?? 99);
/** A Chronicle row at `key` this week. */
const historyRow = (db, key, nowS, kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)')
  .bind(key, weekAt(nowS), kind, JSON.stringify(data), nowS);

/** A seat's works' rows, `[{ work, tier, building, builder, standsAt, guild }]`, in the table's order. */
async function rowsOf(db, key) {
  const { results = [] } = await db.prepare('SELECT work, tier, building, builder, siegewright, stands_at, guild_id FROM town_seat_forts WHERE key = ?').bind(key).all();
  return results.map((r) => ({ work: r.work, tier: Number(r.tier), building: r.building == null ? null : Number(r.building), builder: Number(r.builder) === 1,
    siegewright: Number(r.siegewright) === 1,   // SEAT2b part two: a Siegewright began it - it stands a day sooner
    standsAt: r.stands_at == null ? null : Number(r.stands_at), guild: r.guild_id ?? null })).filter((r) => fortWork(r.work)).sort(byOrder);
}
/** What each of a seat's projects holds: `Map<work, Map<material, qty>>`. */
async function heldOf(db, key) {
  const { results = [] } = await db.prepare('SELECT work, material, qty FROM town_seat_fort_held WHERE key = ?').bind(key).all();
  const out = new Map();
  for (const r of results) { let m = out.get(r.work); if (!m) out.set(r.work, m = new Map()); m.set(r.material, Number(r.qty)); }
  return out;
}

/** THE PROJECTS DUE RAISED: each whose day has come stands at its tier, its held materials spent (they are the work now). */
async function riseDue(db, key, nowS) {
  for (const r of await rowsOf(db, key)) {
    if (r.building == null || r.standsAt == null || r.standsAt > nowS) continue;
    try {
      await db.batch([
        db.prepare('UPDATE town_seat_forts SET tier = building, building = NULL, stands_at = NULL, builder = 0, siegewright = 0 WHERE key = ? AND work = ? AND building = ? AND stands_at <= ?')
          .bind(key, r.work, r.building, nowS),
        mustChange(db),
        db.prepare('DELETE FROM town_seat_fort_held WHERE key = ? AND work = ?').bind(key, r.work),
        historyRow(db, key, nowS, 'fort-raised', { work: r.work, tier: r.building }),
      ]);
    } catch { /* another reader raised it first */ }
  }
}

/**
 * THE SUPPLY: what the stockpile holds of each building project's needs moved into it, the works in the table's order -
 * and a project whose needs are met given its day (fortLaw.js fortStandsAt). Each move asks the stockpile's units in
 * its own statement (mustChange), so two readers racing move a unit once; the loser's batch rolls back whole.
 */
export async function supplyForts(db, key, nowS) {
  const rows = (await rowsOf(db, key)).filter((r) => r.building != null && r.standsAt == null);
  if (!rows.length) return;
  const { results: stock = [] } = await db.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0').bind(key).all();
  const left = new Map(stock.map((s) => [s.material, Number(s.qty)]));
  const held = await heldOf(db, key);
  const stmts = [];
  for (const r of rows) {
    const needs = fortNeeds(r.work, r.building, { builder: r.builder })?.needs ?? [];
    const has = new Map(held.get(r.work) ?? []);
    for (const [k, want] of fortWanting(needs, has)) {
      const take = Math.min(want, left.get(k) ?? 0);
      if (take <= 0) continue;
      left.set(k, (left.get(k) ?? 0) - take);
      has.set(k, (has.get(k) ?? 0) + take);
      stmts.push(
        db.prepare('UPDATE town_seat_stockpile SET qty = qty - ? WHERE key = ? AND material = ? AND qty >= ?').bind(take, key, k, take), mustChange(db),
        db.prepare(`INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, ?, ?, ?)
          ON CONFLICT (key, work, material) DO UPDATE SET qty = town_seat_fort_held.qty + excluded.qty`).bind(key, r.work, k, take),
      );
    }
    if (fortWanting(needs, has).every(([, n]) => n === 0)) {
      stmts.push(db.prepare('UPDATE town_seat_forts SET stands_at = ? WHERE key = ? AND work = ? AND building = ? AND stands_at IS NULL')
        .bind(fortStandsAt(nowS, r.building, { siegewright: r.siegewright }), key, r.work, r.building));   // SEAT2b part two: a Siegewright's a day sooner
    }
  }
  if (!stmts.length) return;
  try { await db.batch(stmts); } catch { /* a racing reader moved them; the next read moves what is left */ }
}

/**
 * A SEAT'S WORKS AS THE BOARD SHOWS THEM - the due raised and the stockpile's units moved in first: `{ [work]: { tier,
 * building, standsAt, needs, held } }` for every work with a row (`needs` the building tier's, as `[[material, units]]`;
 * `held` what the project holds), and the stockpile itself (`stockpile`: `[[material, qty]]`).
 */
export async function fortsOf(db, key, nowS) {
  await riseDue(db, key, nowS);
  await supplyForts(db, key, nowS);
  await riseDue(db, key, nowS);   // a project met with nothing to wait (none today: every tier waits days) - kept honest
  const held = await heldOf(db, key);
  const works = {};
  for (const r of await rowsOf(db, key)) {
    const needs = r.building == null ? null : fortNeeds(r.work, r.building, { builder: r.builder })?.needs ?? null;
    works[r.work] = { tier: r.tier, building: r.building, standsAt: r.standsAt, needs, held: needs ? needs.map(([k]) => [k, held.get(r.work)?.get(k) ?? 0]) : null };
  }
  const { results: stock = [] } = await db.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0 ORDER BY material').bind(key).all();
  return { works, stockpile: stock.map((s) => [s.material, Number(s.qty)]) };
}
/** SEAT2b part two: ONE WORK'S TIER standing at `nowS` - its row's, or the building tier whose day has come (riseDue's
 *  rule, read and never written) - nought for none. For a read that writes nothing (a standings read). */
export async function fortTierAt(db, key, work, nowS) {
  const r = await db.prepare('SELECT tier, building, stands_at FROM town_seat_forts WHERE key = ? AND work = ?').bind(key, work).first();
  if (!r) return 0;
  return r.building != null && r.stands_at != null && Number(r.stands_at) <= nowS ? Number(r.building) : Number(r.tier);
}
/** A seat's standing tiers alone - `{ [work]: tier }` - the effects' input (the pass, the Tithe's cap, the Shrine). */
export async function fortTiersOf(db, key, nowS) {
  await riseDue(db, key, nowS);
  return Object.fromEntries((await rowsOf(db, key)).map((r) => [r.work, r.tier]));
}

/** A character's choices in `profession` now (professionLaw.js specsAt over its track's row). */
async function specsOf(db, player, character, profession, nowS) {
  const row = await db.prepare('SELECT spec50, spec100, respec_rank, respec_to, respec_at FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?')
    .bind(player, character, trackOf(profession)).first();   // CRAFT3: Masonry's and Carpentry's choices are Building's
  return specsAt(row ? { ...row, respec_rank: row.respec_rank == null ? null : Number(row.respec_rank), respec_at: row.respec_at == null ? null : Number(row.respec_at) } : null, nowS);
}
/** Whether `character` of `player` is a Builder (Masonry 50) now. */
const isBuilder = async (db, player, character, nowS) => isBuilderSpec(await specsOf(db, player, character, 'masonry', nowS));   // PROF11's law
/** SEAT2b part two: whether `character` of `player` is a Siegewright (Carpentry 100) now. */
const isSiegewright = async (db, player, character, nowS) => isSiegewrightSpec(await specsOf(db, player, character, 'carpentry', nowS));

/**
 * BEGIN A PROJECT (7.5): `{ character, key, work, port, rid }` - the holder's Guildmaster or an Officer, the next tier
 * of a work the seat may raise and that is not already building; its Marks burnt from the treasury in the same batch
 * as the row (`fort`, once a `rid`), and the stockpile's units moved in at once. Answers `{ ok, work, tier, needs,
 * forts }` or `{ error }`.
 * @param {{db: any, nowS: number}} ctx
 */
export async function fundFort(ctx, player, env, { character, key, work, port = false, rid } = {}) {
  const { db, nowS } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  if (typeof rid !== 'string' || !/^[A-Za-z0-9_-]{8,40}$/.test(rid)) return { error: 'bad-rid' };
  const w = fortWork(work);
  if (!w) return { error: 'bad-work' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!SEAT_LEVER_RANKS.includes(Number(a.me.rank))) return { error: 'guild-rank' };
  const hold = await db.prepare('SELECT key, guild_id, tier FROM town_seat_holds WHERE key = ?').bind(key).first();
  if (!hold || hold.guild_id !== a.me.guild_id) return { error: 'seat-not-held' };
  const prior = await db.prepare("SELECT 1 FROM marks_ledger WHERE actor = ? AND rid = ? AND kind = 'fort'").bind(player.id, `${rid}:fort`).first();
  if (prior) return { ok: true, repeat: true, work, forts: await fortsOf(db, key, nowS) };
  const tiers = await fortTiersOf(db, key, nowS);
  const rows = await rowsOf(db, key);
  const cur = rows.find((r) => r.work === work);
  if (!fortMayRaise(work, { tier: hold.tier, coastal: port === true, walls: tiers.walls ?? 0 })) return { error: 'fort-not-here' };
  if (cur?.building != null) return { error: 'fort-building' };
  const t = (cur?.tier ?? 0) + 1;
  if (t > fortMaxTier(work)) return { error: 'fort-max' };
  const builder = await isBuilder(db, player.id, character, nowS);
  const siegewright = await isSiegewright(db, player.id, character, nowS);   // SEAT2b part two: its project stands a day sooner
  const { marks, needs } = /** @type {{ marks: number, needs: any[] }} */ (fortNeeds(work, t, { builder }));
  // the rate, once the ask is one the board would take - its own bucket, beside the levers' (Appendix B's five an hour)
  if (await overRate(ctx, `seat-fort:${player.id}`, SEAT_EDICTS_HOUR, 3600)) return { error: 'seats-rate' };
  const g = hold.guild_id;
  const guild = await db.prepare('SELECT name, tag FROM guilds WHERE id = ?').bind(g).first();
  try {
    await db.batch([
      // the treasury's Marks, burnt - the rank and the Charter still the guild's, asked in the write
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'guild', ?1, 'burn', NULL, 'fort', ?2, ?3, ?4, ?5, ?6, ?7
        WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2
          AND EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?8 AND guild_id = ?1)
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?9 AND guild_id = ?1 AND rank IN (${SEAT_LEVER_RANKS.join(', ')}))`)
        .bind(g, marks, utcDay(nowS), nowS, player.id, w.name, `${rid}:fort`, key, Number(a.me.rid)),
      mustChange(db),
      // the project: the next tier, no other building at this work
      db.prepare(`INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, siegewright, stands_at, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?8, NULL, ?7)
        ON CONFLICT (key, work) DO UPDATE SET building = excluded.building, guild_id = excluded.guild_id, builder = excluded.builder, siegewright = excluded.siegewright, stands_at = NULL, at = excluded.at
        WHERE town_seat_forts.building IS NULL AND town_seat_forts.tier = ?3`).bind(key, work, t - 1, t, g, builder ? 1 : 0, nowS, siegewright ? 1 : 0),
      mustChange(db),
      historyRow(db, key, nowS, 'fort-begun', { guild: { name: guild?.name ?? '', tag: guild?.tag ?? '' }, work, tier: t }),
    ]);
  } catch {
    const has = Number((await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(g).first())?.balance ?? 0);
    if (has < marks) return { error: 'seat-treasury' };
    return { error: 'fort-building' };
  }
  await supplyForts(db, key, nowS);
  return { ok: true, work, tier: t, marks, needs, builder, siegewright, forts: await fortsOf(db, key, nowS) };
}

/** THE BOARD'S READ (`/v1/seats/forts`): `{ ok, key, works, stockpile }` - anyone the seats are open to. */
export async function readForts({ db, nowS }, player, env, { key } = {}) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  return { ok: true, key, ...(await fortsOf(db, key, nowS)) };
}

// ─── THE DROPS (7.5, 6.8, 9.1) ───────────────────────────────────────

/**
 * AUDIT SEATS-2 S1: THE PROJECTS DUE RAISED, AS STATEMENTS for a batch that moves the works (a capture, a lapse) -
 * riseDue's rule written in SQL: each project at `key` (every seat's, `key` null) whose day has come by
 * `nowS` stands at its tier, its held materials spent, the Chronicle saying so ('fort-raised', as riseDue's row). A due
 * project is the work's tier wherever it is read (fortTierAt - the siege's frozen works, the map), but `tier` holds it only
 * once something reads it through riseDue: a drop that ran first took the OLD tier down and handed the held materials to
 * the stockpile, so the very project the pass counted fell. Idempotent - a second batch finds none due.
 */
export function fortsDueStatements(db, nowS, key = null) {
  const due = 'building IS NOT NULL AND stands_at IS NOT NULL AND stands_at <= ?1 AND (?3 IS NULL OR key = ?3)';
  return [
    db.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at) SELECT key, ?2, 'fort-raised', json_object('work', work, 'tier', building), ?1
      FROM town_seat_forts WHERE ${due} ORDER BY key, work`).bind(nowS, weekAt(nowS), key),
    db.prepare(`DELETE FROM town_seat_fort_held WHERE EXISTS (SELECT 1 FROM town_seat_forts
      WHERE town_seat_forts.key = town_seat_fort_held.key AND town_seat_forts.work = town_seat_fort_held.work AND ${due})`).bind(nowS, null, key),
    db.prepare(`UPDATE town_seat_forts SET tier = building, building = NULL, stands_at = NULL, builder = 0, siegewright = 0 WHERE ${due}`).bind(nowS, null, key),
  ];
}
/**
 * THE CAPTURE'S STATEMENTS, for the result's own batch (seatSiege.js applyResult): every work at `key` a tier down - the
 * Walls kept where `fortifier` (a Fortifier saved them this Season) - every building project fallen, what it held back
 * to the stockpile. AUDIT SEATS-2 S1: `nowS` - the projects whose day had come raised FIRST (fortsDueStatements), so the
 * drop takes the tier the siege was fought behind a tier down and a stood project's materials stay spent.
 */
export function fortsCapturedStatements(db, key, { fortifier = false, nowS = null } = {}) {
  return [
    ...(nowS != null ? fortsDueStatements(db, nowS, key) : []),
    db.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) SELECT key, material, qty FROM town_seat_fort_held WHERE key = ? AND qty > 0
      ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).bind(key),
    db.prepare('DELETE FROM town_seat_fort_held WHERE key = ?').bind(key),
    db.prepare(`UPDATE town_seat_forts SET tier = CASE WHEN ?2 = 1 AND work = 'walls' THEN tier ELSE MAX(0, tier - 1) END,
      building = NULL, stands_at = NULL, builder = 0, siegewright = 0, guild_id = NULL WHERE key = ?1`).bind(key, fortifier ? 1 : 0),
  ];
}
/**
 * AUDIT SEATS-2 S5: A CHARTER LAPSED (Neglect twice, a revolt that stood - by its receipt or at the Turning - a seat the
 * registry no longer confirms, a relinquishing, a strike): every building project at `key` falls with it, what it held
 * back to the stockpile (the seat's), its Marks spent - as at a capture (7.5: "a building project falls with the
 * Charter"); the standing tiers stay (16: "its fortifications stay"). The projects whose day had come by `nowS` raised
 * first, as at a capture. For the lapse's own batch, AFTER its DELETE of the hold: each fall statement asks that the seat
 * is held by none (`NOT EXISTS`), so a DELETE that moved nothing (a relinquishing whose rank went between) drops nothing.
 * Before, only a capture made a project fall - a lapsed seat's project kept building for nobody, and the next holder
 * inherited it with its starter's Builder and Siegewright marks.
 */
export function fortsLapsedStatements(db, key, nowS) {
  const unheld = 'NOT EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?1)';
  return [
    ...fortsDueStatements(db, nowS, key),
    db.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) SELECT key, material, qty FROM town_seat_fort_held WHERE key = ?1 AND qty > 0 AND ${unheld}
      ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).bind(key),
    db.prepare(`DELETE FROM town_seat_fort_held WHERE key = ?1 AND ${unheld}`).bind(key),
    db.prepare(`UPDATE town_seat_forts SET building = NULL, stands_at = NULL, builder = 0, siegewright = 0, guild_id = NULL
      WHERE key = ?1 AND building IS NOT NULL AND ${unheld}`).bind(key),
  ];
}
/**
 * VOID (Seats-Arc 18, `/siege void`): A VOIDED CAPTURE'S PROJECTS - every building project at `key` that `guild` (the
 * capturer, whose Charter the void takes back) began falls, what it held back to the seat's stockpile, its Marks spent - as
 * fortsLapsedStatements' fall, but asked of that guild's projects alone, since the seat is held again (by the guild it
 * was taken from) in the same batch.
 */
export function fortsGuildFallStatements(db, key, guild) {
  const theirs = 'key = ?1 AND guild_id = ?2 AND building IS NOT NULL';
  return [
    db.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) SELECT key, material, qty FROM town_seat_fort_held
      WHERE key = ?1 AND qty > 0 AND work IN (SELECT work FROM town_seat_forts WHERE ${theirs})
      ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).bind(key, guild),
    db.prepare(`DELETE FROM town_seat_fort_held WHERE key = ?1 AND work IN (SELECT work FROM town_seat_forts WHERE ${theirs})`).bind(key, guild),
    db.prepare(`UPDATE town_seat_forts SET building = NULL, stands_at = NULL, builder = 0, siegewright = 0, guild_id = NULL WHERE ${theirs}`).bind(key, guild),
  ];
}
/**
 * AUDIT 529 V2 (Seats-Arc 18, `/siege void`): A VOIDED RESULT'S FALLEN PROJECTS BEGUN AGAIN - each building project
 * `guild` had at `key` when a capture or a revolt that stood made it fall (`projects`: `[work, building, builder,
 * siegewright, standsAt, at]`; `held`: `[work, material, qty]` - the result's `prior`, seatSiege.js), for the void's own
 * batch AFTER the works' tiers are given back: the project again at the tier it was raising, its starter's marks and its
 * clock as they were, where its work stands where it stood (no project there, the tier one below) - and what it held
 * taken back out of the seat's stockpile, as much of each as is still there (it went there when the project fell). Its
 * day kept only where everything it held came back; short, it waits on the stockpile as any project does (supplyForts).
 * Before, a void gave the works' tiers back but not the defender's projects - the Marks it burnt funding them lost.
 */
export function fortsRestoredStatements(db, key, guild, projects, held) {
  const out = [];
  for (const [work, building, builder, siegewright, standsAt, at] of projects) {
    const back = held.filter((h) => h[0] === work).map(([, m, n]) => [m, n]);
    const again = 'EXISTS (SELECT 1 FROM town_seat_forts WHERE key = ?1 AND work = ?2 AND building = ?3 AND guild_id = ?4 AND stands_at IS NULL)';
    out.push(db.prepare(`UPDATE town_seat_forts SET building = ?3, guild_id = ?4, builder = ?5, siegewright = ?6, stands_at = NULL, at = ?7
      WHERE key = ?1 AND work = ?2 AND building IS NULL AND tier = ?3 - 1`).bind(key, work, building, guild, builder ? 1 : 0, siegewright ? 1 : 0, at));
    for (const [material, n] of back) {
      // the stockpile's units read before either statement moves them: the same MIN in both
      out.push(
        db.prepare(`INSERT INTO town_seat_fort_held (key, work, material, qty) SELECT ?1, ?2, ?5, MIN(?6, qty) FROM town_seat_stockpile
          WHERE key = ?1 AND material = ?5 AND qty > 0 AND ${again}
          ON CONFLICT (key, work, material) DO UPDATE SET qty = town_seat_fort_held.qty + excluded.qty`).bind(key, work, building, guild, material, n),
        db.prepare(`UPDATE town_seat_stockpile SET qty = qty - MIN(?6, qty) WHERE key = ?1 AND material = ?5 AND ${again}`).bind(key, work, building, guild, material, n),
      );
    }
    out.push(db.prepare(`UPDATE town_seat_forts SET stands_at = ?5 WHERE key = ?1 AND work = ?2 AND building = ?3 AND guild_id = ?4 AND stands_at IS NULL AND ?5 IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM json_each(?6) j WHERE COALESCE((SELECT h.qty FROM town_seat_fort_held h
        WHERE h.key = ?1 AND h.work = ?2 AND h.material = json_extract(j.value, '$[0]')), 0) < json_extract(j.value, '$[1]'))`)
      .bind(key, work, building, guild, standsAt, JSON.stringify(back)));
  }
  return out;
}
/**
 * THE FORTIFIER'S SAVE AT A CAPTURE (Masonry 100, Professions-Arc 3.3: "once a Season a seat's Walls skip their drop on
 * capture") - DECIDED: a Fortifier who stood on the losing side's roster of that siege (the fortifications are the seat's,
 * so the save is a defender's craft at the walls it defended), once a Season a seat (`town_seat_fortifier`, keyed by the
 * Season's first week - seasonFloor's stand-in where none is counted), and only Walls that stand. Answers the account
 * whose save it is, or null.
 */
export async function fortifierAt(db, week, key, nowS, seasonWeek) {
  // AUDIT SEATS-2 S1: the Walls standing at the capture - a project whose day has come counted (fortTierAt), as the drop
  // now raises it first (fortsCapturedStatements' `nowS`): Walls that stood only by a due project were "none" to save
  const walls = await fortTierAt(db, key, 'walls', nowS);
  if (walls <= 0) return null;
  if (await db.prepare('SELECT 1 FROM town_seat_fortifier WHERE season = ? AND key = ?').bind(seasonWeek, key).first()) return null;
  const { results = [] } = await db.prepare(`SELECT r.account, t.spec50, t.spec100, t.respec_rank, t.respec_to, t.respec_at FROM town_seat_rosters r
    JOIN prof_tracks t ON t.player = r.account AND t.char_id = r.char_id AND t.profession = '${trackOf('masonry')}'
    WHERE r.week = ? AND r.key = ? AND r.side = 'defend' ORDER BY r.at, r.account`).bind(week, key).all();
  for (const row of results) {
    const specs = specsAt({ ...row, respec_rank: row.respec_rank == null ? null : Number(row.respec_rank), respec_at: row.respec_at == null ? null : Number(row.respec_at) }, nowS);
    if (isFortifierSpec(specs)) return row.account;
  }
  return null;
}
/**
 * SEAT2b part two (b): A SIEGEWRIGHT ON THE ATTACKING ROSTER (Carpentry 100, Professions-Arc 3.3: "Rams +50% vitality") -
 * the Rams are the attackers' (the camp's), so the craft is an attacker's: any character the attacking side signed who
 * stands as a Siegewright now. Answers its account, or null.
 */
export async function siegewrightAt(db, week, key, nowS) {
  const { results = [] } = await db.prepare(`SELECT r.account, t.spec50, t.spec100, t.respec_rank, t.respec_to, t.respec_at FROM town_seat_rosters r
    JOIN prof_tracks t ON t.player = r.account AND t.char_id = r.char_id AND t.profession = '${trackOf('carpentry')}'
    WHERE r.week = ? AND r.key = ? AND r.side = 'attack' ORDER BY r.at, r.account`).bind(week, key).all();
  for (const row of results) {
    const specs = specsAt({ ...row, respec_rank: row.respec_rank == null ? null : Number(row.respec_rank), respec_at: row.respec_at == null ? null : Number(row.respec_at) }, nowS);
    if (isSiegewrightSpec(specs)) return row.account;
  }
  return null;
}
/** The capture's statements with the Fortifier's save written beside them (its Season's one), and the Chronicle's word. */
export function fortsCaptureWithSave(db, key, { nowS, seasonWeek, fortifier = null, history }) {
  return [
    ...fortsCapturedStatements(db, key, { fortifier: !!fortifier, nowS }),   // AUDIT SEATS-2 S1: the due raised first
    ...(fortifier ? [
      db.prepare('INSERT OR IGNORE INTO town_seat_fortifier (season, key, account, at) VALUES (?, ?, ?, ?)').bind(seasonWeek, key, fortifier, nowS),
      history('walls-kept', {}),
    ] : []),
  ];
}
/**
 * THE SIEGE CAMPS AT THE TURNING (4.2: "its siege works (a Ram Kit) go to the siege it won, and everything else is burnt;
 * a camp that won no Right of Siege is burnt whole"): the week's camps read, each guild's Ram Kits (fortLaw.js campSpent)
 * set on the battle the Turning placed for `next` where its Right was won and a Gatehouse stands (`tierOf` the seat's
 * tier), and every camp of the week emptied.
 * (The Gatehouse's `tier` is the Turning's own: its gather read every held seat's works through fortTiersOf at the
 * Turning's clock, which raised a project whose day had come - and a Right is won only at a held seat. At a Season's end
 * the wear comes after, in the same batch: campsWorn.)
 */
export async function campsSpent(db, week, next, rights, tierOf) {
  const { results = [] } = await db.prepare('SELECT key, guild_id, material, qty FROM town_seat_camps WHERE week = ? AND qty > 0').bind(week).all();
  if (!results.length) return [];
  const camps = new Map();
  for (const r of results) {
    const k = `${r.key}\n${r.guild_id}`;
    if (!camps.has(k)) camps.set(k, { key: Number(r.key), guild: r.guild_id, items: [] });
    camps.get(k).items.push([r.material, Number(r.qty)]);
  }
  const out = [];
  for (const c of camps.values()) {
    const won = (rights ?? []).some((r) => r.key === c.key && r.guild === c.guild);
    const gate = Number((await db.prepare("SELECT tier FROM town_seat_forts WHERE key = ? AND work = 'gatehouse'").bind(c.key).first())?.tier ?? 0);
    const { rams } = campSpent(c.items, { won, gated: tierOf(c.key) === 'crown' || gate >= 1 });
    if (rams > 0) out.push(db.prepare('UPDATE town_seat_battles SET rams = rams + ? WHERE week = ? AND key = ? AND attacker = ?').bind(rams, next, c.key, c.guild));
  }
  out.push(db.prepare('DELETE FROM town_seat_camps WHERE week = ?').bind(week));
  return out;
}
/**
 * A Season's end (9.1): every seat's works a tier down; a building project keeps building.
 * AUDIT SEATS-2 S4: A PROJECT UNDER WAY GOES DOWN WITH ITS WORK. A project always raises the tier above the one standing
 * (fundFort begins `tier + 1`), but the wear lowered `tier` alone, and the rise then set tier = building: a work at tier 2
 * raising 3 wore to 1 and rose to 3 - tier 2 skipped and the Season's wear erased. Now every work standing above nought
 * goes a tier down and its project, if one is under way, with it - still the tier above the one standing (building - 1 >
 * tier - 1, so none falls to or below its work). DECIDED: a lowered project's needs are another tier's (the Walls' third
 * asks steel, its second iron), so what it held goes back to the stockpile and its delivery is reckoned again - the next
 * read moves the lower tier's needs back in and gives it its days from there (`stands_at` cleared); its Marks stay
 * spent, the Season's cost. A project at a work standing at nought keeps building and holding - there is no tier to wear
 * (fortLaw.js fortDropped). A project whose day had come by the Turning stood before this: the Turning's gather read every
 * held seat's works through fortTiersOf at its clock (riseDue), and a lapsed seat's stood or fell in its lapse's own
 * statements (fortsLapsedStatements) - no other seat has a project.
 */
export const fortsSeasonStatements = (db) => {
  const lowered = 'EXISTS (SELECT 1 FROM town_seat_forts f WHERE f.key = town_seat_fort_held.key AND f.work = town_seat_fort_held.work AND f.tier > 0 AND f.building IS NOT NULL)';
  const wear = [db.prepare('UPDATE town_seat_forts SET tier = MAX(0, tier - 1) WHERE tier > 0')];   // SEAT2b's wear, after its projects are lowered
  // AUDIT SEATS-3 A2 (7.5: "the Tithe's cap +1%" a tier): A TITHE SET UNDER A MARKET HALL THE WEAR LOWERED, down to the cap
  // its worn tier gives (marketHallTitheCap over the holder's tier, the law's own numbers spelt out for SQL) - a palace's
  // 11% under a first-tier Hall worn to nought is 10% from this Turning; a Tithe under the new cap stands as it was
  const capSql = `CASE ${Object.entries(TITHE_CAP).flatMap(([t, c]) => Array.from({ length: fortMaxTier('market') + 1 }, (_, m) =>
    `WHEN town_seat_holds.tier = '${t}' AND COALESCE((SELECT f.tier FROM town_seat_forts f WHERE f.key = town_seat_holds.key AND f.work = 'market'), 0) = ${m} THEN ${marketHallTitheCap(c, m)}`)).join(' ')} END`;
  wear.push(db.prepare(`UPDATE town_seat_holds SET tithe = ${capSql} WHERE tithe > ${capSql}`));
  return [
    db.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) SELECT key, material, qty FROM town_seat_fort_held WHERE qty > 0 AND ${lowered}
      ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`),
    db.prepare(`DELETE FROM town_seat_fort_held WHERE ${lowered}`),
    db.prepare('UPDATE town_seat_forts SET building = building - 1, stands_at = NULL WHERE tier > 0 AND building IS NOT NULL'),
    ...wear,
  ];
};
/**
 * AUDIT SEATS-2 S4: THE CAMPS' RAMS AFTER A SEASON'S WEAR, for the Turning's batch after fortsSeasonStatements: a palace's
 * battle placed for `next` keeps the Ram Kits its challenger's camp sent it (campsSpent) only where a Gatehouse still stands
 * once the works are worn - the rest burnt (rams 0), as campsSpent burns a camp's kits at a palace with no gate. campsSpent
 * read the Gatehouse before the wear: a tier-1 Gatehouse worn to nought took a camp's Rams onto a battle with no gate, and
 * a gate standing again before that battle's first pass (its lowered project re-supplied) let them through. A crown's
 * gate always stands (6.2).
 */
export const campsWorn = (db, next) => db.prepare(`UPDATE town_seat_battles SET rams = 0 WHERE week = ? AND rams > 0 AND tier <> 'crown'
  AND NOT EXISTS (SELECT 1 FROM town_seat_forts f WHERE f.key = town_seat_battles.key AND f.work = 'gatehouse' AND f.tier >= 1)`).bind(next);

// ─── THE MARKET HALL (7.5: "the town's boards list 25% more; the Tithe's cap +1%") ───

/** A seat's Market Hall tier, or nought. */
const marketTierOf = async (db, key, nowS) => (await fortTiersOf(db, key, nowS)).market ?? 0;
/**
 * THE OPEN LISTINGS an account may hold, listing at the board at map pixel `board` (`[x, y]`, or null): the market's
 * MARKET_LISTINGS_MAX, a quarter more a tier where the board stands in a seat town with a Market Hall. DECIDED: the
 * board's town, not its bailiwick - "the town's boards".
 */
export async function listingsCapAt(db, nowS, board) {
  if (!Array.isArray(board)) return MARKET_LISTINGS_MAX;
  if (!(await db.prepare("SELECT 1 FROM town_seat_forts WHERE work = 'market' AND tier > 0 LIMIT 1").first())) return MARKET_LISTINGS_MAX;
  const seat = [...(await confirmedSeats(db, nowS)).values()].find((x) => x.pixel?.[0] === board[0] && x.pixel?.[1] === board[1]);
  return seat ? marketHallListings(MARKET_LISTINGS_MAX, await marketTierOf(db, seat.key, nowS)) : MARKET_LISTINGS_MAX;
}
/** A held seat's Tithe cap: its tier's, a point more a Market Hall tier. */
export const titheCapAt = async (db, key, tier, nowS) => marketHallTitheCap(TITHE_CAP[tier] ?? 0, await marketTierOf(db, key, nowS));
