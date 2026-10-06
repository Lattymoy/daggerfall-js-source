// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1b (2026-09-30, Mac: "Finish the seats") - INFLUENCE: the pledge,
// the week's sources and the standings.
//
// bible/11-Multiplayer/Seats-Arc.md 4.1-4.2. Influence is counted per
// guild, per seat, per week (townSeatLaw.js seatWeekOf). A guild PLEDGES
// to one seat a region, in at most five (an Officer's or the
// guildmaster's act, until the Reckoning). Every source then counts for
// an account's guild at that guild's pledged seat in the region it was
// earned in - never where the guild pledged nothing:
//
//   the Watch    a relay-signed tick (net/watchReceipt.js `k1`) in a
//                confirmed seat's own pixel; 1 each, 60 an account a UTC
//                day (in the write);
//   gate kills   a gate receipt claimed with the region the client
//                derived for its game day, 300 each - counted only where
//                3 of that day's claims agree on the region (on read),
//                only in its own week, 900 an account a week;
//   Renown       the XP a character was credited in a region, 1 per 20,
//                400 an account a week;
//   homes        a counting member's home in the seat's town, 25 a day,
//                5 homes a guild a seat - read, never written;
//   Tribute      Marks out of the guild's Drake treasury, burnt, 1 per
//                10, never past 20% of the guild's week at the seat.
//
// The stockpile's deliveries (the Writs source, SEAT0 4.2) are SEAT1c's,
// with the Siege Camp they fill and the Turning that spends it; the
// sources' table already admits their rows (`writ`, `bought`) and the law
// reads them (townSeatLaw.js guildSeatInfluence).
//
// ═══ WHO COUNTS ═════════════════════════════════════════════════════
//
// A character 7 days in its guild (SEAT_MEMBER_WAIT_S); an account
// BOUND to that guild for the week - the first guild one of its
// characters contributes to (town_seat_binds: per-account war, Mac:
// "Yes"). Its other characters earn nothing for any other guild that
// week. A receipt names an account, not a character, so the Watch's
// ticks and a gate's kill count for the account's war-guild through any
// of its seasoned members; Renown is a character's, and counts only
// through that character. One account's whole week at one seat is at
// most 2,000 from every source together (ACCOUNT_SEAT_WEEK_CAP) - read,
// each source at its own cap first (townSeatLaw.js accountSeatInfluence).
//
// ═══ SUMMED ON READ, CAPPED ON WRITE ════════════════════════════════
//
// Every event is a row (town_seat_influence, town_seat_renown), never a
// running total two writers race. Each write asks, IN its statement, that
// the account is bound to the guild it credits and that the guild's
// pledge still stands where the row counts; the Watch's day cap is asked
// there too. The standings read the rows and the law caps them.
//
// Behind SEATS_OPEN (townSeats.js seatsOpenFor). EVERY CLOCK IS AN
// ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { heraldryOfRow } from './halls.js';
import { mustChange } from './realm.js';
import { seatsOpenFor, confirmedSeats } from './townSeats.js';
import { marksOpenFor } from './marks.js';
import { verifyWatchReceipt } from '../../src/net/watchReceipt.js';
import { gateTimes, gameDayAt } from '../../src/net/gateLaw.js';
import { shrineGateInfluence, towersSee } from '../../src/net/fortLaw.js';   // SEAT2b part two (7.5): a Shrine's gates, the Watchtowers' word
import { fortTierAt } from './seatForts.js';   // SEAT2b part two: the Shrine standing, read without a write
import { MARKS_RID_RE, utcDay } from '../../src/net/marksLaw.js';
import { RENOWN_XP_REPORT_MAX } from '../../src/net/renown.js';
import {
  seatWeekOf, seatWeekStartMs, seatPhaseOf, seatRegionOk, seatKeyOk, seatMay, SEAT_POWERS, SEAT_PLEDGE_REGIONS_MAX, SEAT_MEMBER_WAIT_S,
  SEAT_PLEDGES_HOUR, SEAT_WATCH_CLAIM_MAX, WATCH_DAY_CAP, GATE_INFLUENCE, GATE_REGION_AGREE, HOMES_SEAT_MAX, TRIBUTE_MARKS_PER_INFLUENCE,
  GATE_WEEK_RECEIPTS, RENOWN_WEEK_XP,   // AUDIT-SEATS S7: the account's week, every seat together
  SEAT_WEEK_MS, SEAT_RECKONING_MS,
  accountSeatInfluence, guildSeatInfluence, tributeRoom, homeDaysIn, seatDefence, SEAT_CHRONICLE_SHOWN,
  overreachOf, unrestInfluence, crownsHeld, seatReach, withReach, FREE_LAND_WATCH_BONUS, pledgeBarred, fealtyKingdom, seasonOf, seasonZeroOf, bountySitePixel, HALL_OF_RECORDS_ROWS,
} from '../../src/net/townSeatLaw.js';
import { isFreeLand } from '../../src/net/kingdomLaw.js';
import { holdingOf } from './seatHolding.js';   // SEAT1d: the holder's own view of its Charter
import { fightOf } from './seatBattles.js';   // SEAT2a: the battle as the Seat tab shows it
import { royalView } from './seatRoyal.js';   // CROWN1 part two: a Royal Tourney's ladder
import { bansOf, politicsOf } from './seatPolitics.js';   // CROWN2: the pledges fealty and Pacts forbid; a guild's politics
import { tideAt, TIDE_EFFECTS } from '../../src/net/tideLaw.js';   // SEASON1 part two: the Tides
import { tideNow } from './tides.js';   // SEASON1 part two: an Orc Raid's camps

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
/** Whether a member row has stood its 7 days (SEAT0 4.2: "A new member waits"). */
const seasoned = (m, nowS) => Number(m.joined_at) <= nowS - SEAT_MEMBER_WAIT_S;
/** The ranks that may do a seat's `power`, in SQL (`rank IN (...)`) - SEAT_POWERS' own. */
const ranksSql = (power) => SEAT_POWERS[power].join(', ');

async function boundTo(db, week, account) {
  return (await db.prepare('SELECT guild_id FROM town_seat_binds WHERE week = ? AND account = ?').bind(week, account).first())?.guild_id ?? null;
}
/** The guild's pledged seat in a region this week, or null - SEAT1c: a seat it HOLDS there first (SEAT0 4.1: "A guild
 *  holding a seat is pledged to it automatically and cannot pledge elsewhere in that region"). */
async function pledgeIn(db, week, guildId, region) {
  const held = await db.prepare('SELECT key FROM town_seat_holds WHERE guild_id = ? AND region = ? ORDER BY key LIMIT 1').bind(guildId, region).first();
  if (held) return Number(held.key);
  const r = await db.prepare('SELECT key FROM town_seat_pledges WHERE week = ? AND guild_id = ? AND region = ?').bind(week, guildId, region).first();
  return r ? Number(r.key) : null;
}
/** SEAT1c: a guild's standing at a seat in SQL - pledged there this week, or holding it (`w` the week, `k` the key, `g`
 *  the guild, as parameters). */
const pledgedOrHeldSql = (w, k, g) => `(EXISTS (SELECT 1 FROM town_seat_pledges WHERE week = ${w} AND guild_id = ${g} AND key = ${k})
  OR EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ${k} AND guild_id = ${g}))`;
/** A guild's pledges this week, region by region - SEAT1c: a region where it holds a Charter answers that seat, `held`
 *  (pledged to it by holding it). */
async function pledgesOf(db, week, guildId) {
  const { results = [] } = await db.prepare('SELECT region, key, set_by, at FROM town_seat_pledges WHERE week = ? AND guild_id = ? ORDER BY region').bind(week, guildId).all();
  const { results: holds = [] } = await db.prepare('SELECT region, key, at FROM town_seat_holds WHERE guild_id = ? ORDER BY region, key').bind(guildId).all();
  const heldIn = new Map();
  for (const h of holds) if (!heldIn.has(Number(h.region))) heldIn.set(Number(h.region), { region: Number(h.region), key: Number(h.key), by: null, at: Number(h.at), held: true });
  const out = results.filter((p) => !heldIn.has(Number(p.region))).map((p) => ({ region: Number(p.region), key: Number(p.key), by: p.set_by, at: Number(p.at) }));
  return [...out, ...heldIn.values()].sort((a, b) => a.region - b.region);
}

/**
 * THE ACCOUNT'S WAR THIS WEEK (SEAT0 4.2, Mac: "Yes"): the guild a contribution counts for, and the member it counts
 * through - `{ guild, char }`, or `{ why }`. Bound already: its war-guild, through `character` when that is a seasoned
 * member of it, else (`anyCharacter` - a receipt names an account) through any seasoned member of the account's. Not
 * bound yet: `character`'s own guild, 7 days a member - which the write then binds.
 */
async function warOf(db, player, character, nowS, week, { anyCharacter = false } = {}) {
  if (accountKind(player) !== 'linked') return { why: 'guest' };
  const bound = await boundTo(db, week, player.id);
  const me = typeof character === 'string'
    ? await db.prepare('SELECT guild_id, joined_at FROM guild_members WHERE player = ? AND char_id = ?').bind(player.id, character).first() : null;
  if (bound == null) {
    if (!me) return { why: 'no-guild' };
    return seasoned(me, nowS) ? { guild: me.guild_id, char: character } : { why: 'new-member' };
  }
  if (me && me.guild_id === bound) return seasoned(me, nowS) ? { guild: bound, char: character } : { why: 'new-member' };
  if (!anyCharacter) return { why: me ? 'bound-elsewhere' : 'no-guild' };
  const other = await db.prepare('SELECT char_id FROM guild_members WHERE player = ? AND guild_id = ? AND joined_at <= ? ORDER BY joined_at, char_id LIMIT 1')
    .bind(player.id, bound, nowS - SEAT_MEMBER_WAIT_S).first();
  return other ? { guild: bound, char: other.char_id } : { why: me ? 'bound-elsewhere' : 'no-guild' };
}

/**
 * WHERE A CONTRIBUTION COUNTS: the war-guild's pledged seat in `region` this week - `{ guild, char, key, week }`, or
 * `{ counted: false, why }`. A contribution that counts for nothing is answered, never refused (the act it rode on
 * stands). `key` given: that seat must be the pledge.
 */
async function countsAt(db, player, character, region, nowS, { key = null, anyCharacter = false } = {}) {
  const week = weekAt(nowS);
  const war = await warOf(db, player, character, nowS, week, { anyCharacter });
  if ('why' in war) return { counted: false, why: war.why };
  const pledged = await pledgeIn(db, week, war.guild, region);
  if (pledged == null || (key != null && pledged !== key)) return { counted: false, why: 'no-pledge' };
  return { guild: war.guild, char: war.char, key: pledged, week };
}

/** THE BIND, and the two things every influence row asks in its own statement: the account bound to the guild it
 *  credits, and that guild's pledge still standing at the seat (`?1` the week, `?2` the key, `?3` the guild, `?4` the
 *  account). */
const bindStatement = (db, at, account, nowS) => db.prepare(
  'INSERT OR IGNORE INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)',
).bind(at.week, account, at.guild, at.char, nowS);
const STILL_COUNTS = `(SELECT guild_id FROM town_seat_binds WHERE week = ?1 AND account = ?4) = ?3
  AND ${pledgedOrHeldSql('?1', '?2', '?3')}`;

// ─── THE PLEDGE ──────────────────────────────────────────────────────

/**
 * PLEDGE A GUILD TO A SEAT for this week (SEAT0 4.1): an Officer's or the guildmaster's, a confirmed seat, in the Muster.
 * One seat a region - a pledge moved within a region replaces the last - and at most SEAT_PLEDGE_REGIONS_MAX regions,
 * counted inside the write, with the rank. `key` null and a `region` takes that region's pledge down.
 * @param {{db: any, nowS: number}} ctx
 */
export async function pledgeSeat({ db, nowS }, player, env, { character, key = null, region = null } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!seatMay(Number(a.me.rank), 'pledge')) return { error: 'guild-rank' };
  if (seatPhaseOf(nowS * 1000) !== 'muster') return { error: 'seat-reckoning' };
  if (await overRate({ db, nowS }, `seat-pledge:${player.id}`, SEAT_PLEDGES_HOUR, 3600)) return { error: 'seats-rate' };
  const week = weekAt(nowS);
  const gid = a.me.guild_id;
  // the rank, again IN the write: one made a Member between the read and the write pledges nothing
  const rankHeld = `EXISTS (SELECT 1 FROM guild_members WHERE rowid = ${Number(a.me.rid)} AND guild_id = ?2 AND rank IN (${ranksSql('pledge')}))`;
  if (key == null) {
    if (!seatRegionOk(region)) return { error: 'bad-seat' };
    const r = await db.prepare(`DELETE FROM town_seat_pledges WHERE week = ?1 AND guild_id = ?2 AND region = ?3 AND ${rankHeld}`).bind(week, gid, region).run();
    return r?.meta?.changes ? { ok: true, pledges: await pledgesOf(db, week, gid) } : { error: 'seat-no-pledge' };
  }
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const seat = (await confirmedSeats(db, nowS)).get(key);
  if (!seat) return { error: 'seat-unconfirmed' };
  // SEAT1c: a guild holding a seat in the region is pledged to it, and nowhere else there
  if (await db.prepare('SELECT 1 FROM town_seat_holds WHERE guild_id = ? AND region = ?').bind(gid, seat.region).first()) return { error: 'seat-held-here' };
  // CROWN2 (7.8): never against a liege's, a vassal's or a Pact partner's seat
  const heldBy = (await db.prepare('SELECT guild_id FROM town_seat_holds WHERE key = ?').bind(key).first())?.guild_id ?? null;
  const barred = pledgeBarred(gid, heldBy, await bansOf(db, gid, week));
  if (barred) return { error: barred };
  // AUDIT SEATS-3 D5 (4.1: "A guild holding a seat is pledged to it automatically", at most five regions): the reach counted
  // over the regions pledged AND held, each once - a guild holding two regions pledges in three more, as the Muster's
  // count shows it - the region pledged now never among them
  const r = await db.prepare(`INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE ${rankHeld}
      AND (SELECT COUNT(*) FROM (SELECT region FROM town_seat_pledges WHERE week = ?1 AND guild_id = ?2 AND region <> ?3
        UNION SELECT region FROM town_seat_holds WHERE guild_id = ?2 AND region <> ?3)) < ?7
    ON CONFLICT (week, guild_id, region) DO UPDATE SET key = excluded.key, set_by = excluded.set_by, at = excluded.at`)
    .bind(week, gid, seat.region, key, displayName(player), nowS, SEAT_PLEDGE_REGIONS_MAX).run();
  if (!r?.meta?.changes) {
    const still = await db.prepare(`SELECT ${rankHeld.replace(/\?2/g, '?1')} AS m`).bind(gid).first();
    return { error: still?.m ? 'seat-pledges-full' : 'guild-rank' };
  }
  return { ok: true, pledges: await pledgesOf(db, week, gid) };
}

// ─── THE WATCH ───────────────────────────────────────────────────────

/**
 * THE WATCH'S TICKS CLAIMED (SEAT0 4.2): each receipt the relay signed (net/watchReceipt.js) - this account's, issued
 * this week, in a confirmed seat's own pixel - counts 1 for the account's war-guild at its pledged seat there, at most
 * WATCH_DAY_CAP an account a UTC day of issue (asked in the write), each receipt once. `character` the one standing
 * watch. Answers how many counted, and why the rest did not.
 * @param {{db: any, nowS: number, subtle: SubtleCrypto}} ctx
 * @param {CryptoKey|null} publicKey the relay's public half (index.js gatePublicKey)
 */
export async function claimWatch({ db, nowS, subtle }, player, env, { character, receipts } = {}, publicKey = null) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > SEAT_WATCH_CLAIM_MAX) return { error: 'bad-watch' };
  if (!publicKey) return { error: 'no-gate-key' };
  const seats = await confirmedSeats(db, nowS, { kept: true });   // STORM-SHED: the isolate's kept witness rows
  const byPixel = new Map([...seats.values()].map((s) => [`${s.pixel[0]},${s.pixel[1]}`, s]));
  const week = weekAt(nowS);
  let counted = 0;
  /** @type {Record<string, number>} */
  const why = {};
  const tally = (w) => { why[w] = (why[w] ?? 0) + 1; };   // why a receipt counted nothing - an answer, never a refusal
  for (const r of receipts) {
    const v = await verifyWatchReceipt(r, publicKey, { subtle, nowS });
    if (!v.ok) { tally(v.why); continue; }
    const c = v.claims;
    if (c.s !== player.id) { tally('not-yours'); continue; }
    if (weekAt(c.i) !== week) { tally('old-week'); continue; }
    const seat = byPixel.get(`${c.x},${c.y}`);
    if (!seat) { tally('no-seat'); continue; }
    const at = await countsAt(db, player, character, seat.region, nowS, { key: seat.key, anyCharacter: true });
    if ('counted' in at) { tally(at.why); continue; }
    const day = utcDay(c.i);
    const ref = `${c.s}:${c.c}:${c.i}`;
    const [, ins] = await db.batch([
      bindStatement(db, at, player.id, nowS),
      db.prepare(`INSERT OR IGNORE INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        SELECT ?1, ?2, ?3, ?4, ?5, 'watch', 1, ?6, ?7, ?8, ?9
        WHERE ${STILL_COUNTS}
          AND (SELECT COUNT(*) FROM town_seat_influence WHERE account = ?4 AND source = 'watch' AND day = ?7) < ?10`)
        .bind(week, seat.key, at.guild, player.id, at.char, seat.region, day, ref, nowS, WATCH_DAY_CAP),
    ]);
    if (ins?.meta?.changes) counted++;
    else tally((await db.prepare("SELECT 1 FROM town_seat_influence WHERE source = 'watch' AND ref = ?").bind(ref).first()) ? 'claimed' : 'capped');
  }
  return { ok: true, counted, ...(Object.keys(why).length ? { why } : {}) };
}

// ─── GATE KILLS AND RENOWN (written beside their own acts) ───────────

/**
 * A GATE KILL'S INFLUENCE (SEAT0 4.2): the claim that recorded game day `day`'s kill, with the region the client derived
 * for it - written for the account's war-guild at its pledged seat there, when the kill's day falls in this week. Counted
 * on read only where GATE_REGION_AGREE of the day's claims agree on the region (gate_kills.region).
 * @param {{db: any, nowS: number}} ctx
 */
export async function creditGate({ db, nowS }, player, env, { character, day, region } = {}) {
  if (!seatsOpenFor(player, env)) return { counted: false, why: 'seats-closed' };
  if (!seatRegionOk(region) || !Number.isSafeInteger(day) || day < 0) return { counted: false, why: 'no-region' };
  if (weekAt(Math.floor(gateTimes(day).riseAt / 1000)) !== weekAt(nowS)) return { counted: false, why: 'old-week' };
  const at = await countsAt(db, player, character, region, nowS, { anyCharacter: true });
  if ('counted' in at) return at;
  // AUDIT-SEATS S7 (4.2: "at most 900 an account a week (three receipts)"): the account's gate rows this week, every seat
  // together, fewer than GATE_WEEK_RECEIPTS - asked in the write (the read's cap sees one seat; a voided row counts, S9)
  const [, ins] = await db.batch([
    bindStatement(db, at, player.id, nowS),
    db.prepare(`INSERT OR IGNORE INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      SELECT ?1, ?2, ?3, ?4, ?5, 'gate', ?6, ?7, ?8, ?9, ?10 WHERE ${STILL_COUNTS}
        AND (SELECT COUNT(*) FROM town_seat_influence WHERE account = ?4 AND source = 'gate' AND week = ?1) < ?11`)
      .bind(at.week, at.key, at.guild, player.id, at.char, GATE_INFLUENCE, region, day, `${day}:${player.id}`, nowS, GATE_WEEK_RECEIPTS),
  ]);
  if (ins?.meta?.changes) return { counted: true, key: at.key };
  const n = await db.prepare("SELECT COUNT(*) AS n FROM town_seat_influence WHERE account = ? AND source = 'gate' AND week = ?").bind(player.id, at.week).first();
  return { counted: false, why: Number(n?.n ?? 0) >= GATE_WEEK_RECEIPTS ? 'capped' : 'bound-elsewhere' };
}

/**
 * SEASON1 part two (9.3): AN ORC RAID'S CAMP - a World of Daggerfall camp the character cleared (`site` its id, naming its
 * pixel - townSeatLaw.js bountySitePixel) in `region` (the client's) while that land's Tide is Orc Raids: 50 influence for
 * the account's war-guild at its pledged seat there - at most 5 camps an account a UTC day and 250 influence an account a
 * week, a camp once a day an account (all asked in the write). Bounded, not witnessed, as the Bounty's camps are: a
 * modified client can claim camps it never fought, five a day and 250 a week. Answers `{ ok, counted, why? }`.
 * @param {{db: any, nowS: number}} ctx
 */
export async function claimOrcCamp({ db, nowS }, player, env, { character, site, region } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!bountySitePixel(site) || !seatRegionOk(region)) return { error: 'bad-orc-camp' };
  if (tideNow(env, nowS, region) !== 'orcs') return { ok: true, counted: false, why: 'no-raid' };
  const at = await countsAt(db, player, character, region, nowS, { anyCharacter: true });
  if ('counted' in at) return { ok: true, counted: false, why: at.why };
  const day = utcDay(nowS);
  const ref = `${day}:${site}:${player.id}`;
  const [, ins] = await db.batch([
    bindStatement(db, at, player.id, nowS),
    db.prepare(`INSERT OR IGNORE INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      SELECT ?1, ?2, ?3, ?4, ?5, 'raid', ?6, ?7, ?8, ?9, ?10 WHERE ${STILL_COUNTS}
        AND (SELECT COUNT(*) FROM town_seat_influence WHERE account = ?4 AND source = 'raid' AND day = ?8) < ?11
        AND COALESCE((SELECT SUM(amount) FROM town_seat_influence WHERE account = ?4 AND source = 'raid' AND week = ?1), 0) + ?6 <= ?12`)
      .bind(at.week, at.key, at.guild, player.id, at.char, TIDE_EFFECTS.orcsCampInfluence, region, day, ref, nowS, TIDE_EFFECTS.orcsCampsDay, TIDE_EFFECTS.orcsInfluenceWeek),
  ]);
  if (ins?.meta?.changes) return { ok: true, counted: true, key: at.key };
  if (await db.prepare("SELECT 1 FROM town_seat_influence WHERE source = 'raid' AND ref = ?").bind(ref).first()) return { ok: true, counted: false, why: 'claimed' };
  return { ok: true, counted: false, why: 'capped' };
}

/**
 * SEAT2b (4.2: "Writs ... 1 per Mark of the materials' value"): A SEAT WRIT'S DELIVERY AS INFLUENCE - `own` units at the
 * materials' value (`value` a unit's Marks, never the writ's pay, so a guild paying itself mints nothing) and `bought`
 * units at Tribute's rate inside Tribute's cap (their value as a `bought` row, read as Tribute's Marks); for the posting
 * guild alone, through a 7-day member whose account is bound to it this week (warOf) - anyone else's delivery earns the
 * pay alone and binds nobody's war - and only while that guild still holds or is pledged to the seat. `ref` the delivery's
 * own id (a fill's rid), so a delivery counts once. Answers `{ counted, why? }`; never refuses the delivery it rode on.
 * @param {{db: any, nowS: number}} ctx
 */
export async function creditSeatWrit({ db, nowS }, player, env, { character, key, region, guild, own = 0, bought = 0, value = 0, ref } = {}) {
  if (!seatsOpenFor(player, env)) return { counted: false, why: 'seats-closed' };
  const week = weekAt(nowS);
  const war = await warOf(db, player, character, nowS, week);
  if ('why' in war) return { counted: false, why: war.why };
  if (war.guild !== guild) return { counted: false, why: 'not-its-guild' };
  const at = { guild, char: war.char, key, week };
  const rows = [['writ', Math.max(0, own) * value], ['bought', Math.max(0, bought) * value]].filter(([, n]) => n > 0);
  if (!rows.length) return { counted: false, why: 'nothing' };
  const done = await db.batch([
    bindStatement(db, at, player.id, nowS),
    ...rows.map(([source, amount]) => db.prepare(`INSERT OR IGNORE INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11 WHERE ${STILL_COUNTS}`)
      .bind(week, key, guild, player.id, war.char, source, amount, region, utcDay(nowS), `${ref}:${source}`, nowS)),
  ]);
  return done.slice(1).some((r) => r?.meta?.changes) ? { counted: true } : { counted: false, why: 'bound-elsewhere' };
}

/** Each gate day's region, where GATE_REGION_AGREE of its claims agree on it - the most agreeing; two regions level at
 *  the top agree on neither. */
export async function agreedGateRegions(db, days) {
  const out = new Map();
  if (!days.length) return out;
  const { results = [] } = await db.prepare(`SELECT day, region, COUNT(*) AS n FROM gate_kills
    WHERE region IS NOT NULL AND day IN (${days.map(() => '?').join(', ')}) GROUP BY day, region`).bind(...days).all();
  const best = new Map();
  for (const r of results) {
    const d = Number(r.day), n = Number(r.n);
    const b = best.get(d);
    if (!b || n > b.n) best.set(d, { n, region: Number(r.region), level: false });
    else if (n === b.n) b.level = true;
  }
  for (const [d, b] of best) if (b.n >= GATE_REGION_AGREE && !b.level) out.set(d, b.region);
  return out;
}

/**
 * RENOWN IN THE REGION (SEAT0 4.2): the XP `character` was credited, earned in `region` - kept for the week where its
 * war-guild pledged there (read at that pledge, 1 per 20, at most 400 an account a week). Only through the character
 * itself: Renown is a character's.
 * @param {{db: any, nowS: number}} ctx
 */
export async function creditRenown({ db, nowS }, player, env, { character, region, xp } = {}) {
  if (!seatsOpenFor(player, env)) return { counted: false, why: 'seats-closed' };
  if (!seatRegionOk(region) || !Number.isSafeInteger(xp) || xp < 1 || xp > RENOWN_XP_REPORT_MAX) return { counted: false, why: 'no-region' };
  const at = await countsAt(db, player, character, region, nowS);
  if ('counted' in at) return at;
  // AUDIT-SEATS S7 (4.2: "capped 400 an account a week"; "the Watch and Renown caps above are per account too"): the
  // account's Renown XP this week, every region together, at most RENOWN_WEEK_XP - what is left of it banked, asked in the
  // write (the read's cap sees one seat's region)
  const banked = '(SELECT COALESCE(SUM(xp), 0) FROM town_seat_renown WHERE week = ?1 AND account = ?4)';
  const [, ins] = await db.batch([
    bindStatement(db, at, player.id, nowS),
    db.prepare(`INSERT INTO town_seat_renown (week, account, char_id, region, xp) SELECT ?1, ?4, ?5, ?6, MIN(?7, ?8 - ${banked})
      WHERE (SELECT guild_id FROM town_seat_binds WHERE week = ?1 AND account = ?4) = ?3
        AND ${pledgedOrHeldSql('?1', '?2', '?3')} AND ${banked} < ?8
      ON CONFLICT (week, account, char_id, region) DO UPDATE SET xp = xp + excluded.xp`)
      .bind(at.week, at.key, at.guild, player.id, at.char, region, xp, RENOWN_WEEK_XP),
  ]);
  if (ins?.meta?.changes) return { counted: true, key: at.key };
  const n = await db.prepare('SELECT COALESCE(SUM(xp), 0) AS n FROM town_seat_renown WHERE week = ? AND account = ?').bind(at.week, player.id).first();
  return { counted: false, why: Number(n?.n ?? 0) >= RENOWN_WEEK_XP ? 'capped' : 'bound-elsewhere' };
}

// ─── THE STANDINGS ───────────────────────────────────────────────────

/**
 * EVERY PLEDGED GUILD'S WEEK AT A SEAT (SEAT0 4.2; 7.9's "the standings"): each guild's accounts' own influence (each
 * source at its cap, then ACCOUNT_SEAT_WEEK_CAP), and its Tribute inside its room. Pure over the rows the read gathers:
 * `rows` the seat's influence rows, `renown` the region's Renown rows, `homes` the town's 7-day members' homes, `binds`
 * account -> war-guild, `agreed` gate day -> its agreed region. CROWN1 (4.3): `reach` guild -> its reach here (a crown's
 * at its kingdom's palace seats, a March's claiming crowns'), every source but Tribute raised by it; `freeLand` the seat
 * a Free Land's, every account's Watch there a tenth more.
 * @param {{ guilds: string[], rows: any[], renown: any[], homes: any[], binds: Map<string, string>,
 *   agreed: Map<number, number>, weekStartS: number, nowS: number, reach?: Map<string, number>, freeLand?: boolean }} o
 */
export function standingsOf({ guilds, rows, renown, homes, binds, agreed, weekStartS, nowS, reach = new Map(), freeLand = false, tide = 'calm', shrine = null }) {
  const out = [];
  for (const g of guilds) {
    /** @type {Map<string, { watch: number, gates: number, renownXp: number, writ: number, homeDays: number, raid: number }>} */
    const acc = new Map();
    const a = (id) => { let v = acc.get(id); if (!v) acc.set(id, v = { watch: 0, gates: 0, renownXp: 0, writ: 0, homeDays: 0, raid: 0 }); return v; };
    let tributeMarks = 0;
    for (const r of rows) {
      if (r.guild_id !== g) continue;
      if (r.source === 'tribute' || r.source === 'bought') { tributeMarks += Number(r.amount); continue; }
      if (binds.get(r.account) !== g) continue;
      if (r.source === 'watch') a(r.account).watch += Number(r.amount);
      else if (r.source === 'gate') { if (agreed.get(Number(r.day)) === Number(r.region)) a(r.account).gates += Number(r.n ?? 1); }   // AUDIT-SEATS S11: a row the read grouped counts its receipts
      else if (r.source === 'writ') a(r.account).writ += Number(r.amount);
      else if (r.source === 'raid') a(r.account).raid += Number(r.amount);   // SEASON1 part two: an Orc Raid's camps
    }
    for (const r of renown) if (binds.get(r.account) === g) a(r.account).renownXp += Number(r.xp);
    // HOMES: a 7-day member's, its account bound to this guild - the guild's HOMES_SEAT_MAX that stood longest this week
    const hs = homes.filter((h) => h.guild_id === g && binds.get(h.player) === g)
      .map((h) => ({ player: h.player, days: homeDaysIn(Number(h.bought_at), weekStartS, nowS) }))
      .sort((x, y) => y.days - x.days).slice(0, HOMES_SEAT_MAX);
    for (const h of hs) if (h.days > 0) a(h.player).homeDays += h.days;
    const per = new Map([...acc].map(([id, v]) => [id, accountSeatInfluence(v, freeLand ? FREE_LAND_WATCH_BONUS : 0, tide)]));   // SEASON1 part two: the week's Tide here
    const row = { guild: g, ...withReach(guildSeatInfluence([...per.values()], tributeMarks), reach.get(g) ?? 0), accounts: [...per.values()].filter((v) => v > 0).length, per };
    // SEAT2b part two (7.5: "each gate felled in the region gives the holder +50 influence"): THE SHRINE'S, the holder's
    // own - a guild's row beside its accounts' (no account's cap is spent on it, as Tribute's is not), past the reach
    if (shrine && shrine.guild === g && shrine.influence > 0) { row.total += shrine.influence; row.shrine = shrine.influence; }
    out.push(row);
  }
  return out.sort((x, y) => y.total - x.total || (x.guild < y.guild ? -1 : 1));
}

/** SEAT1c: every guild at a seat this week - its pledges, and its holder (pledged there by holding it) - each with when it
 *  pledged (a holder at its Charter's week). */
export async function seatGuildsOf(db, key, week) {
  const { results: pledged = [] } = await db.prepare('SELECT guild_id, at FROM town_seat_pledges WHERE week = ? AND key = ?').bind(week, key).all();
  const out = new Map(pledged.map((p) => [p.guild_id, Number(p.at)]));
  const held = await db.prepare('SELECT guild_id, at FROM town_seat_holds WHERE key = ?').bind(key).first();
  if (held && !out.has(held.guild_id)) out.set(held.guild_id, Number(held.at));
  return out;
}
/** SEAT2b part two: THE GATES FELLED IN `region` this seat week, to `nowS` - each gate day whose rise falls in the week
 *  and whose claims agree on the region (GATE_REGION_AGREE - agreedGateRegions), as the Turning counts them for Standing
 *  (seatTurning.js gatesIn). */
export async function gatesFelledIn(db, week, region, nowS) {
  const fromS = Math.floor(seatWeekStartMs(week) / 1000), toS = Math.min(nowS, fromS + SEAT_WEEK_MS / 1000);
  const days = [];
  for (let d = gameDayAt(fromS * 1000); d <= gameDayAt(toS * 1000); d++) { const r = gateTimes(d).riseAt / 1000; if (r >= fromS && r < toS) days.push(d); }
  let n = 0;
  for (const rg of (await agreedGateRegions(db, days)).values()) if (rg === Number(region)) n++;
  return n;
}
/** SEAT2b part two: A HOLDER'S SHRINE AT A SEAT this week - `{ guild, influence }` (its tier's 50 a gate felled in the
 *  region - fortLaw.js shrineGateInfluence), or null with no holder, no Shrine or no gate. */
export async function shrineOf(db, seat, week, nowS) {
  const h = await db.prepare('SELECT guild_id FROM town_seat_holds WHERE key = ?').bind(seat.key).first();
  if (!h) return null;
  const per = shrineGateInfluence(await fortTierAt(db, seat.key, 'shrine', nowS));
  if (per <= 0) return null;
  const gates = await gatesFelledIn(db, week, seat.region, nowS);
  return gates > 0 ? { guild: h.guild_id, influence: per * gates, gates } : null;
}
/** Each pledged guild's week at a seat (standingsOf), the rows gathered. Exported for the Turning (seatTurning.js).
 *  SEASON1 part two: `counted` whether a Season is counted that week - the Tides roll only then. */
export async function gatherStandings(db, seat, week, nowS, counted = false) {
  const guilds = [...(await seatGuildsOf(db, seat.key, week)).keys()];
  if (!guilds.length) return [];
  const qs = guilds.map(() => '?').join(', ');
  // AUDIT-SEATS S11: summed in SQL - one row a guild, account, source, region and game or UTC day (its amount the sum, `n`
  // its rows), never one a Watch tick (some 210,000 a read at 500 accounts); everything standingsOf asks of a row is in
  // its group's key, so the caps read the same. S9: a barred challenger's rows voided, kept for the caps, never counted.
  const { results: rows = [] } = await db.prepare(`SELECT guild_id, account, source, region, day, SUM(amount) AS amount, COUNT(*) AS n FROM town_seat_influence
    WHERE week = ? AND key = ? AND voided = 0 GROUP BY guild_id, account, source, region, day`).bind(week, seat.key).all();
  const { results: bindRows = [] } = await db.prepare(`SELECT account, guild_id FROM town_seat_binds WHERE week = ? AND guild_id IN (${qs})`).bind(week, ...guilds).all();
  const binds = new Map(bindRows.map((b) => [b.account, b.guild_id]));
  const { results: renown = [] } = await db.prepare('SELECT account, xp FROM town_seat_renown WHERE week = ? AND region = ?').bind(week, seat.region).all();
  // the town's homes whose owning character is a 7-day member of a pledged guild (a guild's hall is no member's home)
  const { results: homes = [] } = await db.prepare(`SELECT h.player, h.bought_at, m.guild_id FROM homes h
    JOIN guild_members m ON m.player = h.player AND m.char_id = h.char_id
    WHERE h.map_id = ? AND h.guild_id IS NULL AND m.guild_id IN (${qs}) AND m.joined_at <= ?`).bind(seat.key, ...guilds, nowS - SEAT_MEMBER_WAIT_S).all();
  const days = [...new Set(rows.filter((r) => r.source === 'gate').map((r) => Number(r.day)))];
  const agreed = await agreedGateRegions(db, days);
  // CROWN1 (4.3): each guild's reach here - the crowns it holds, at a palace seat of their kingdom or March
  const { results: crownRows = [] } = seat.tier === 'palace'
    ? await db.prepare(`SELECT guild_id, tier, region FROM town_seat_holds WHERE tier = 'crown' AND guild_id IN (${qs})`).bind(...guilds).all() : { results: [] };
  const reach = new Map(guilds.map((g) => [g, seatReach(seat, crownsHeld(crownRows.filter((h) => h.guild_id === g).map((h) => ({ tier: h.tier, region: Number(h.region) }))))]));
  return standingsOf({ guilds, rows, renown, homes, binds, agreed, weekStartS: Math.floor(seatWeekStartMs(week) / 1000), nowS, reach, freeLand: isFreeLand(seat.region), tide: tideAt(week, seat.region, counted),
    shrine: await shrineOf(db, seat, week, nowS) });   // SEAT2b part two: the holder's Shrine
}

/**
 * THE STANDINGS AT A SEAT (SEAT0 7.9: "every pledged guild's influence this week, live"), the week's clock, and - for
 * the reading character - its guild's pledges, its account's war and its own week here, and the room left for Tribute.
 * @param {{db: any, nowS: number}} ctx
 */
export async function readStandings({ db, nowS }, player, env, { key, character = null } = {}) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const seat = (await confirmedSeats(db, nowS)).get(key);
  if (!seat) return { error: 'seat-unconfirmed' };
  const week = weekAt(nowS);
  const season = seasonOf(week, seasonZeroOf(env?.SEASON_ZERO_WEEK));   // SEASON1: the Season counted, and its Tides
  const list = await gatherStandings(db, seat, week, nowS, !!season);
  // SEAT1c: the Legacy each guild carried in, the holder and its defence, the week's battle here, the Chronicle
  const { results: legacyRows = [] } = await db.prepare('SELECT guild_id, amount FROM town_seat_legacy WHERE week = ? AND key = ?').bind(week, key).all();
  const legacy = new Map(legacyRows.map((l) => [l.guild_id, Number(l.amount)]));
  const holder = (await holdsOf(db)).get(key) ?? null;
  const own = holder ? list.find((s) => s.guild === holder.guild.id) : null;
  // SEAT1d: the holder's own view - its Standing, Tithe, Edicts and upkeep; its defence at its Overreach
  const holding = holder ? await holdingOf(db, key, nowS) : null;
  const was = await standingWas(db, key, week - 1, holder);   // STANDING-TREND: the last Turning settled the week before this one
  const { results: tiers = [] } = holder ? await db.prepare('SELECT tier, region FROM town_seat_holds WHERE guild_id = ?').bind(holder.guild.id).all() : { results: [] };
  const held = holder ? !!(await db.prepare("SELECT 1 FROM town_seat_aftermath WHERE week = ? AND key = ? AND guild_id = ? AND what = 'bonus'").bind(week, key, holder.guild.id).first()) : false;   // SEAT2a: a held siege's x1.2
  // CROWN2 (7.8): a vassal's - its liege's half-reach here, as the Turning reckons it: a fealty sworn (not breaking) that
  // still fits
  const liege = holder ? (await db.prepare("SELECT liege FROM guild_fealty WHERE vassal = ? AND state = 'sworn'").bind(holder.guild.id).first())?.liege ?? null : null;
  const { results: liegeRows = [] } = liege ? await db.prepare('SELECT tier, region FROM town_seat_holds WHERE guild_id = ?').bind(liege).all() : { results: [] };
  const liegeHolds = liegeRows.map((h) => ({ tier: h.tier, region: Number(h.region) }));
  const fits = liege && fealtyKingdom(tiers.map((h) => ({ tier: h.tier, region: Number(h.region) })), liegeHolds);
  const liegeReach = fits ? seatReach(seat, crownsHeld(liegeHolds)) : 0;
  const defence = holder ? seatDefence({ influence: own?.total ?? 0, legacy: legacy.get(holder.guild.id) ?? 0 }, holder.standing, overreachOf(tiers.map((t) => t.tier)), held, liegeReach) : null;
  const ids = list.map((s) => s.guild);
  const { results: gs = [] } = ids.length
    ? await db.prepare(`SELECT id, name, tag, heraldry FROM guilds WHERE id IN (${ids.map(() => '?').join(', ')})`).bind(...ids).all() : { results: [] };
  const byId = new Map(gs.map((g) => [g.id, g]));
  const start = seatWeekStartMs(week);
  let mine = null;
  if (typeof character === 'string' && accountKind(player) === 'linked') {
    const me = await db.prepare('SELECT guild_id, rank, joined_at FROM guild_members WHERE player = ? AND char_id = ?').bind(player.id, character).first();
    if (me) {
      const s = list.find((x) => x.guild === me.guild_id);
      mine = {
        guild: me.guild_id, rank: Number(me.rank), seasoned: seasoned(me, nowS), bound: await boundTo(db, week, player.id),
        pledges: await pledgesOf(db, week, me.guild_id), influence: s?.per.get(player.id) ?? 0,
        politics: await politicsOf(db, me.guild_id, nowS),   // CROWN2: its liege, vassals, Pacts and the offers standing
        tributeRoom: s ? tributeRoom(s.others, s.tribute) * TRIBUTE_MARKS_PER_INFLUENCE : 0,
      };
    }
  }
  const standings = list.map((s) => {
    const g = byId.get(s.guild);
    const carried = legacy.get(s.guild) ?? 0;
    // SEAT1d: a challenger's influence at a seat in Unrest risen a quarter, as the Turning counts it
    const own = s.guild === holder?.guild.id;
    const influence = own || !holder ? s.total : unrestInfluence(s.total, holder.standing);
    return { guild: { id: s.guild, name: g?.name ?? '', tag: g?.tag ?? '', heraldry: heraldryOfRow(g?.heraldry) }, influence: influence + carried, legacy: carried, tribute: s.tribute, accounts: s.accounts, holder: own,
      ...(s.shrine ? { shrine: s.shrine } : {}) };   // SEAT2b part two: the holder's Shrine's part of its week
  }).sort((x, y) => y.influence - x.influence);
  // SEAT2b part two (7.5: "the holder is told when a challenger passes half its defence (tier 1) or a quarter (tier 2)"):
  // THE WATCHTOWERS' WORD, to the holder's own members alone - every challenger at or past its towers' share of the
  // defence, as the Seat tab shows both (fortLaw.js towersSee); the client says each once (net/townSeatBook.js towers)
  const towerTier = holder && mine?.guild === holder.guild.id ? await fortTierAt(db, key, 'watchtowers', nowS) : 0;
  const towers = towerTier > 0 && defence != null
    ? towersSee(standings.map((s) => ({ guild: s.guild.id, influence: s.influence })), { holder: holder.guild.id, defence, t: towerTier })
      .map((w) => ({ ...w, name: byId.get(w.guild)?.name ?? '', tag: byId.get(w.guild)?.tag ?? '' }))
    : null;
  return {
    seat, week, phase: seatPhaseOf(nowS * 1000), season,   // SEASON1: the Season this week falls in, or null
    // SEASON1 part two (9.3): this week's Tide in the seat's land and the coming week's, while a Season is counted
    // AUDIT-SEATS L6: and the week before the first counted one - the Turning prices next week's Edict at next week's Tide
    tides: (() => {
      const nextCounted = !!seasonOf(week + 1, seasonZeroOf(env?.SEASON_ZERO_WEEK));
      return season || nextCounted ? { now: tideAt(week, seat.region, !!season), next: tideAt(week + 1, seat.region, nextCounted) } : null;
    })(),
    reckoningAt: Math.floor((start + SEAT_WEEK_MS - SEAT_RECKONING_MS) / 1000), turningAt: Math.floor((start + SEAT_WEEK_MS) / 1000),
    standings,
    ...(towers ? { towers } : {}),   // SEAT2b part two: the Watchtowers' word, the holder's members'
    holder: holder ? { ...holder, ...(holding ? { edict: holding.edict } : {}), ...(was != null ? { was } : {}) } : holder, defence, battle: (await battlesOf(db, week)).get(key) ?? null, chronicle: await chronicleOf(db, key),   // STANDING-TREND: the holder's `was`, its Standing at the last Turning
    fight: await fightOf(db, key, player, character, nowS),   // SEAT2a: the week's battle placed, its sides, the reader's place; the holder's window
    royal: seat.tier === 'crown' ? await royalView(db, key, nowS) : null,   // CROWN1 part two: the Royal Tourney ruling here this week, its prize and ladder
    ...(holding && mine?.guild === holder?.guild.id ? { holding } : {}),
    ...(mine ? { mine } : {}),
  };
}

// ─── SEAT1c: THE HOLDERS, THE WEEK'S BATTLES, THE CHRONICLE ─────────

const guildView = (id, name, tag, heraldry) => ({ id, name: name ?? '', tag: tag ?? '', heraldry: heraldryOfRow(heraldry) });
/** EVERY CHARTER HELD, by key: `{ guild: { id, name, tag, heraldry }, since, standing, tithe }` (SEAT1d: its Tithe). */
export async function holdsOf(db) {
  const { results = [] } = await db.prepare(`SELECT h.key, h.guild_id, h.since_week, h.standing, h.tithe, g.name, g.tag, g.heraldry FROM town_seat_holds h
    JOIN guilds g ON g.id = h.guild_id`).all();
  return new Map(results.map((h) => [Number(h.key), {
    guild: guildView(h.guild_id, h.name, h.tag, h.heraldry), since: Number(h.since_week), standing: Number(h.standing), tithe: Number(h.tithe ?? 0),
  }]));
}
/** THE WEEK'S BATTLES the last Turning named, by key: `{ kind, guild, against, startsAt, endsAt, moved, state }` - a
 *  Right of Siege's challenger and holder, or a Contested seat's two contenders; AUDIT-SEATS G2: and when the schedule
 *  placed it (seconds, as the standings' `fight` - null for a battle no hour could hold), whether it was moved and its
 *  state, so the arrival line can call the siege (3.3) and the client's herald say it (G1) without a standings read. */
export async function battlesOf(db, week) {
  const { results = [] } = await db.prepare(`SELECT r.key, r.kind, r.guild_id, r.against, a.name AS an, a.tag AS at, a.heraldry AS ah,
      b.name AS bn, b.tag AS bt, b.heraldry AS bh, x.starts_at, x.ends_at, x.moved, x.state FROM town_seat_rights r JOIN guilds a ON a.id = r.guild_id
      LEFT JOIN guilds b ON b.id = r.against LEFT JOIN town_seat_battles x ON x.week = r.week AND x.key = r.key
    WHERE r.week = ?`).bind(week).all();
  const out = new Map(results.map((r) => [Number(r.key), {
    kind: r.kind, guild: guildView(r.guild_id, r.an, r.at, r.ah), against: r.against ? guildView(r.against, r.bn, r.bt, r.bh) : null,
    startsAt: r.starts_at == null ? null : Number(r.starts_at), endsAt: r.ends_at == null ? null : Number(r.ends_at),
    moved: Number(r.moved ?? 0) === 1, state: r.state ?? null,
  }]));
  // SEAT2b part two (c) (7.7): a revolt is no Right - its battle row alone names it, the holder it rises against `against`
  const { results: revolts = [] } = await db.prepare(`SELECT x.key, x.defender, b.name AS bn, b.tag AS bt, b.heraldry AS bh, x.starts_at, x.ends_at, x.moved, x.state
    FROM town_seat_battles x LEFT JOIN guilds b ON b.id = x.defender WHERE x.week = ? AND x.kind = 'revolt'`).bind(week).all();
  for (const r of revolts) {
    out.set(Number(r.key), { kind: 'revolt', guild: null, against: guildView(r.defender, r.bn, r.bt, r.bh), startsAt: Number(r.starts_at), endsAt: Number(r.ends_at),
      moved: Number(r.moved ?? 0) === 1, state: r.state ?? null });
  }
  return out;
}
/** A seat's Chronicle, newest first - `{ kind, week, data }`, at most `max` (SEAT_CHRONICLE_SHOWN, the Seat tab's).
 *  STANDING-TREND: never the Turning's Standing rows (they are the trend's, standingWas). */
async function chronicleOf(db, key, max = SEAT_CHRONICLE_SHOWN) {
  const { results = [] } = await db.prepare("SELECT kind, week, data, at FROM town_seat_history WHERE key = ? AND kind <> 'standing' ORDER BY seq DESC LIMIT ?").bind(key, max).all();
  const rows = results.map((r) => { let data = {}; try { data = JSON.parse(r.data); } catch { /* none */ } return { kind: r.kind, week: Number(r.week), data, at: Number(r.at) }; });
  await renamedSince(db, rows);
  return rows.map(({ kind, week, data }) => ({ kind, week, data }));
}

/** D1's bound on a statement's parameters, less a margin. */
const IN_CHUNK = 90;
/**
 * AUDIT2 GUILD2 G1: A CHRONICLE ROW'S GUILD AS IT IS NOW. A row names each guild as it was that day (`{ name, tag }`), and
 * the client finds a guild's arms by its tag and name now (net/heraldryIndex.js armsNamed) - so a guild renamed since
 * (GUILD2a) lost its shield on every line before the rename, and a new guild founded with the old name and tag wore
 * them. Each such guild is given `now`, its name and tag today: the guild that bore that name and tag at the row's
 * moment is the one whose first rename away from them came at or after it (guild_renames). The line's own words stay
 * as they were. A guild that never took another name, or one disbanded since, is left as it was.
 */
async function renamedSince(db, rows) {
  const named = [];
  for (const r of rows) {
    for (const g of Object.values(r.data ?? {})) {
      if (g && typeof g === 'object' && typeof g.tag === 'string' && g.tag && typeof g.name === 'string') named.push([r, g]);
    }
  }
  const tags = [...new Set(named.map(([, g]) => g.tag))];
  const renames = [];
  for (let i = 0; i < tags.length; i += IN_CHUNK) {
    const part = tags.slice(i, i + IN_CHUNK);
    const { results = [] } = await db.prepare(`SELECT guild_id, at, old_name, old_tag FROM guild_renames WHERE old_tag IN (${part.map(() => '?').join(', ')}) ORDER BY at, seq`).bind(...part).all();
    renames.push(...results);
  }
  if (!renames.length) return;
  const whose = new Map();
  for (const [r, g] of named) {
    const hit = renames.find((x) => x.old_tag === g.tag && x.old_name === g.name && Number(x.at) >= r.at);
    if (hit) whose.set(g, hit.guild_id);
  }
  const ids = [...new Set(whose.values())];
  const byId = new Map();
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const part = ids.slice(i, i + IN_CHUNK);
    const { results = [] } = await db.prepare(`SELECT id, name, tag FROM guilds WHERE id IN (${part.map(() => '?').join(', ')})`).bind(...part).all();
    for (const x of results) byId.set(x.id, x);
  }
  for (const [g, id] of whose) {
    const n = byId.get(id);
    if (n && (n.name !== g.name || n.tag !== g.tag)) g.now = { name: n.name, tag: n.tag };
  }
}

/**
 * STANDING-TREND (7.9: "Standing and its trend"): the Standing `holder` held as week `week`'s Turning began - its
 * 'standing' row, written by that Turning (seatTurning.js settleWeek) - or null where that Turning reckoned no Standing
 * for this holder (a Charter it claimed, a seat taken since, a week it never settled).
 */
export async function standingWas(db, key, week, holder) {
  if (!holder) return null;
  const row = await db.prepare("SELECT data FROM town_seat_history WHERE key = ? AND week = ? AND kind = 'standing' ORDER BY seq DESC LIMIT 1").bind(key, week).first();
  let d = null;
  try { d = row ? JSON.parse(row.data) : null; } catch { /* none */ }
  return d && d.guild === holder.guild.id && Number.isFinite(d.was) ? d.was : null;
}

/**
 * SEASON1 part three (9.2): THE HALL OF RECORDS - a seat's Chronicle for its book, oldest first (its newest
 * HALL_OF_RECORDS_ROWS), and the week Season 0 began so the book reads each row in its Season's words. Anyone the seats
 * are open to may read it, as the standings; a seat the registry has struck reads its rows all the same.
 * @param {{db: any}} ctx
 */
export async function readRecords({ db }, player, env, { key } = {}) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const rows = (await chronicleOf(db, key, HALL_OF_RECORDS_ROWS)).reverse();
  return { ok: true, key, rows, zero: seasonZeroOf(env?.SEASON_ZERO_WEEK) };
}

// ─── TRIBUTE ─────────────────────────────────────────────────────────

/**
 * TRIBUTE (SEAT0 4.2): the guildmaster spends `marks` of the guild's Drake treasury on its pledge at `key` - burnt, a
 * `guild -> burn` line of kind `tribute` under the request id - worth 1 influence per 10, never past the guild's room
 * (tributeRoom: 20% of its week there, read first). One batch: the line only where the treasury holds it, the id is
 * unspent, the rank still stands and the pledge too; the influence row only with it. Asked again, the line it made
 * answers `repeat`.
 * @param {{db: any, nowS: number}} ctx
 */
export async function payTribute({ db, nowS }, player, env, { character, key, marks, rid } = {}) {
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (typeof rid !== 'string' || !MARKS_RID_RE.test(rid)) return { error: 'marks-rid' };
  const prior = await db.prepare('SELECT kind FROM marks_ledger WHERE actor = ? AND rid = ?').bind(player.id, rid).first();
  if (prior) return prior.kind === 'tribute' ? { ok: true, repeat: true } : { error: 'marks-rid' };
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!seatMay(Number(a.me.rank), 'tribute')) return { error: 'guild-rank' };
  if (!Number.isSafeInteger(marks) || marks < TRIBUTE_MARKS_PER_INFLUENCE || marks % TRIBUTE_MARKS_PER_INFLUENCE !== 0) return { error: 'bad-tribute' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const week = weekAt(nowS);
  const seat = (await confirmedSeats(db, nowS)).get(key);
  if (!seat) return { error: 'seat-unconfirmed' };
  const gid = a.me.guild_id;
  if ((await pledgeIn(db, week, gid, seat.region)) !== key) return { error: 'seat-no-pledge' };
  const s = (await gatherStandings(db, seat, week, nowS, !!seasonOf(week, seasonZeroOf(env?.SEASON_ZERO_WEEK)))).find((x) => x.guild === gid);
  const room = s ? tributeRoom(s.others, s.tribute) : 0;
  if (marks / TRIBUTE_MARKS_PER_INFLUENCE > room) return { error: 'seat-tribute-cap' };   // the room is the standings' to say (mine.tributeRoom)
  try {
    await db.batch([
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'guild', ?1, 'burn', NULL, 'tribute', ?2, ?3, ?4, ?5, ?6, ?7
        WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2
          AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?5 AND rid = ?7)
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?8 AND guild_id = ?1 AND rank IN (${ranksSql('tribute')}))
          AND ${pledgedOrHeldSql('?9', '?10', '?1')}`)
        .bind(gid, marks, utcDay(nowS), nowS, player.id, displayName(player), rid, Number(a.me.rid), week, key),
      mustChange(db),
      db.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, ref, at)
        VALUES (?, ?, ?, ?, ?, 'tribute', ?, ?, ?, ?)`)
        .bind(week, key, gid, player.id, character, marks, seat.region, `${player.id}:${rid}`, nowS),
    ]);
  } catch {
    const landed = await db.prepare('SELECT kind FROM marks_ledger WHERE actor = ? AND rid = ?').bind(player.id, rid).first();
    if (landed) return landed.kind === 'tribute' ? { ok: true, repeat: true } : { error: 'marks-rid' };
    const bal = await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(gid).first();
    if (Number(bal?.balance ?? 0) < marks) return { error: 'guild-marks-short' };
    return { error: (await pledgeIn(db, week, gid, seat.region)) !== key ? 'seat-no-pledge' : 'guild-rank' };
  }
  return { ok: true, influence: marks / TRIBUTE_MARKS_PER_INFLUENCE, marks };
}
