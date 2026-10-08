// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP3b (2026-10-08, Mac: "Continue", on "Keep going with the arc/
// slices") — STRENGTH AND THE CHAPTER SHEET: each chapter's Strength moved
// at the week's Turning toward its members' Merit (Chapters-Arc 5.2), and
// every chapter's state published (5.3). The law is
// src/net/npcChapterLaw.js; the record is migration 0096_npc_chapters.
//
// THE CHAPTERS' TURNING IS THEIR OWN, ON THE SEATS' WEEK. Section 11 drew it
// inside the seats' settleWeek; it is built beside it instead - the same
// lazy law (Seats-Arc 5.2: "never a job that runs" - week N settled the
// first time anything asks after N's boundary), keyed on its own row
// (`npc_chapter_weeks`), so neither switch waits on the other. ONE batch a
// week whose first statement is the week's own key - a plain INSERT, so a
// second reader racing the first fails on the key and its whole batch rolls
// back - and every chapter's new Strength in ONE statement over a bound
// JSON array (SCALE1's law: never a statement a chapter).
//
// The week's chapters: every chapter confirmed when it settles, every one
// that earned Merit that week, every one the sheet already holds. Its scale
// is the accounts that played in the week before its Turning or since (a
// player's last play is all the service keeps).
//
// CHAP4a (2026-10-08, Mac: "Your decision", on "Whats next"): AND ITS
// SEATS - the same batch places every chapter's Master and three officers
// by its Eligible members' Merit over the four weeks to the one it settles
// (npcChapterLaw.js chapterSeatPlan, Chapters-Arc 6), writes the seats'
// table whole again, and a Chronicle row for every seat that moved.
//
// AUDIT CHAP3: a week settles CHAPTER_TURNING_GRACE_S after its boundary
// (S1: a credit in flight across it lands in its week first); only while
// the Chapters are 'dev' or 'on', and the first week settled 'on' after
// weeks at 'dev' starts every chapter from 50 (S2); a gate's Merit counts
// only in the region the day's claims agree on (E1, the seats' own law).
// ═══════════════════════════════════════════════════════════════════

import { chaptersOpenFor } from './npcRoll.js';
import { allRegionChapters } from './npcHalls.js';
import { agreedGateRegions } from './seatInfluence.js';   // AUDIT CHAP3 E1: a gate's region, as three of the day's claims agree on it
import { seatWeekStartMs, SEAT_WEEK_MS, seasonEndingAt, seasonZeroOf, seasonOf, SEASON_WEEKS } from '../../src/net/townSeatLaw.js';
import {
  STRENGTH_START, strengthAfter, strengthTarget, strengthSeasonEnd, chapterBandOf, meritWeekOf, hallHidden, chaptersSwitchOf,
  SEAT_MERIT_WEEKS, seatEligibleAt, chapterSeatPlan, seatChangesOf, chapterTitlesOf,
} from '../../src/net/npcChapterLaw.js';

/** The most weeks one read settles - a service asleep for longer starts its count again from there (the seats' own). */
export const CHAPTER_WEEKS_MAX = 8;
/** AUDIT CHAP3 S1: how long after its boundary a week is settled - a credit in flight across the boundary (its week
 *  stamped from its own clock) lands in its week before the Turning reads it. */
export const CHAPTER_TURNING_GRACE_S = 300;

/**
 * EVERY REGION'S CHAPTERS, `[{ faction, region }]` (npcHalls.js allRegionChapters - AUDIT CHAP3 S3: each region's row,
 * computed once a change), by region then faction.
 * @param {any} db @param {number} nowS
 */
export async function allChapters(db, nowS) {
  return (await allRegionChapters(db, nowS)).sort((a, b) => a.region - b.region || a.faction - b.faction);
}

/** AUDIT CHAP3 E1: the gate's day a Merit line's `ref` names (`gate:<day>`), or null. */
const gateDayOf = (/** @type {unknown} */ ref) => { const m = /^gate:(\d+)$/.exec(String(ref)); return m ? Number(m[1]) : null; };

/** The Turning that ends seat week `week`, in seconds. */
const turningOf = (/** @type {number} */ week) => Math.floor((seatWeekStartMs(week) + SEAT_WEEK_MS) / 1000);

/**
 * SETTLE WEEK `week`'S STRENGTH: each chapter's Strength moved by its week's Merit against the week's target
 * (npcChapterLaw.js strengthAfter), halfway back toward 50 where a Season ends with it (`zero`, the week Season 0 began,
 * or null). `open` the Chapters' switch it settles under ('dev' or 'on' - AUDIT CHAP3 S2: the first week settled 'on'
 * after a week settled 'dev' starts every chapter from 50). Answers `{ settled: true, chapters }` or `{ settled: false }`
 * - settled first by another reader, or rolled back (the next read settles it again).
 * @param {any} db @param {number} week @param {number} nowS @param {number | null} [zero] @param {string} [open]
 */
export async function settleChapterWeek(db, week, nowS, zero = null, open = 'on') {
  const turning = turningOf(week);
  const active = Number((await db.prepare('SELECT COUNT(*) AS n FROM players WHERE handle IS NOT NULL AND played_at >= ?1')
    .bind(turning - SEAT_WEEK_MS / 1000).first())?.n ?? 0);
  const target = strengthTarget(active);
  // AUDIT CHAP3 E1: a gate's Merit only in the region three of its day's claims agree on (the seats' agreedGateRegions)
  // - the region a claim names is its client's word; the other sources' lines stand as they were written
  const { results: lines = [] } = await db.prepare(`SELECT faction, region, source, ref, SUM(amount) AS n FROM npc_chapter_merit WHERE week = ?1
    GROUP BY faction, region, source, CASE WHEN source = 'gate' THEN ref ELSE '' END`).bind(week).all();
  const gateDays = [...new Set(lines.filter((r) => r.source === 'gate').map((r) => gateDayOf(r.ref)).filter((d) => d !== null))];
  const agreed = await agreedGateRegions(db, gateDays);
  const merits = lines.filter((r) => r.source !== 'gate' || agreed.get(/** @type {number} */ (gateDayOf(r.ref))) === Number(r.region));
  // AUDIT CHAP3 S2: the developers' weeks forgotten the first week the Chapters are everyone's
  const last = await db.prepare('SELECT open FROM npc_chapter_weeks WHERE week < ?1 ORDER BY week DESC LIMIT 1').bind(week).first();
  const opened = open === 'on' && last != null && last.open !== 'on';
  const { results: held = [] } = opened ? { results: [] } : await db.prepare('SELECT faction, region, strength FROM npc_chapters').all();
  /** @type {Map<string, { faction: number, region: number, prev: number, merit: number }>} */
  const all = new Map();
  const at = (/** @type {number} */ f, /** @type {number} */ g) => {
    const k = `${f}|${g}`;
    if (!all.has(k)) all.set(k, { faction: f, region: g, prev: STRENGTH_START, merit: 0 });
    return /** @type {{ faction: number, region: number, prev: number, merit: number }} */ (all.get(k));
  };
  for (const c of await allChapters(db, nowS)) at(c.faction, c.region);
  for (const r of held) at(Number(r.faction), Number(r.region)).prev = Number(r.strength);
  for (const r of merits) at(Number(r.faction), Number(r.region)).merit += Number(r.n);
  const ends = seasonEndingAt(week, zero);
  const rows = [...all.values()].map((c) => {
    const s = strengthAfter(c.prev, c.merit, target);
    return [c.faction, c.region, ends ? strengthSeasonEnd(s) : s, c.merit];
  });
  const seats = await seatsPlaced(db, week, turning, open, opened);
  try {
    await db.batch([
      db.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(week, active, target, rows.length, open, nowS),
      db.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?1, json_extract(value, '$[3]'), ?2
        FROM json_each(?3) WHERE true
        ON CONFLICT (faction, region) DO UPDATE SET strength = excluded.strength, week = excluded.week, merit = excluded.merit, at = excluded.at`)
        .bind(week, nowS, JSON.stringify(rows)),
      // CHAP4a: the seats, the whole table again; a Chronicle row a seat that moved
      db.prepare('DELETE FROM npc_chapter_seats WHERE true'),
      db.prepare(`INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'),
          json_extract(value, '$[4]'), json_extract(value, '$[5]'), ?1, ?2 FROM json_each(?3) WHERE true`)
        .bind(week, nowS, JSON.stringify(seats.rows)),
      db.prepare(`INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?1, 'seat', json_extract(value, '$[2]'),
          json_object('from', json_extract(value, '$[3]'), 'to', json_extract(value, '$[4]')), ?2 FROM json_each(?3) WHERE true`)
        .bind(week, nowS, JSON.stringify(seats.changes)),
    ]);
  } catch {
    return { settled: false };
  }
  return { settled: true, chapters: rows.length };
}

/**
 * CHAP4a: THE SEATS WEEK `week`'S TURNING PLACES (Chapters-Arc 6): every chapter's Eligible members (npcChapterLaw.js
 * seatEligibleAt, at the Turning `turning`: a member on the Roll at the seat's line, fourteen days in the guild, its account
 * seven days old, its character standing) by their Merit at it over the SEAT_MERIT_WEEKS to `week` - a gate's where its
 * day's claims agree (AUDIT CHAP3 E1), never a week settled while the Chapters were the developers' alone once they are
 * everyone's (`opened`, S2's law) - placed by chapterSeatPlan over the seats as they stand. Answers `{ rows, changes }`:
 * the table's rows `[faction, region, char, account, seat, since]` (`since` kept for a character that sat at the chapter
 * already) and the Chronicle's `[faction, region, char, from, to]`.
 * @param {any} db @param {number} week @param {number} turning @param {string} open @param {boolean} opened
 */
async function seatsPlaced(db, week, turning, open, opened) {
  // the developers' weeks: none of their Merit counts toward a seat once the Chapters are everyone's
  const dev = open === 'on' ? (await db.prepare("SELECT MAX(week) AS w FROM npc_chapter_weeks WHERE week < ?1 AND open <> 'on'").bind(week).first())?.w : null;
  const from = Math.max(week - SEAT_MERIT_WEEKS + 1, dev == null ? -Infinity : Number(dev) + 1);
  const { results: lines = [] } = await db.prepare(`SELECT faction, region, char_id, source, ref, SUM(amount) AS n FROM npc_chapter_merit
    WHERE week BETWEEN ?1 AND ?2 GROUP BY faction, region, char_id, source, CASE WHEN source = 'gate' THEN ref ELSE '' END`).bind(from, week).all();
  const gateDays = [...new Set(lines.filter((r) => r.source === 'gate').map((r) => gateDayOf(r.ref)).filter((d) => d !== null))];
  const agreed = await agreedGateRegions(db, gateDays);
  const counted = lines.filter((r) => r.source !== 'gate' || agreed.get(/** @type {number} */ (gateDayOf(r.ref))) === Number(r.region));
  const chars = [...new Set(counted.map((r) => String(r.char_id)))];
  const { results: roll = [] } = chars.length ? await db.prepare(`SELECT r.char_id, r.faction_id, r.player, r.rep, r.member, r.joined_at, p.registered_at
    FROM npc_roll r JOIN realm_characters c ON c.id = r.char_id AND c.player = r.player AND c.dead_at IS NULL JOIN players p ON p.id = r.player
    WHERE r.member = 1 AND r.char_id IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(chars)).all() : { results: [] };
  const eligible = new Map(roll.filter((r) => seatEligibleAt({ member: r.member, rep: r.rep, joinedAt: r.joined_at, registeredAt: r.registered_at }, turning))
    .map((r) => [`${r.char_id}|${r.faction_id}`, { account: String(r.player), joinedAt: Number(r.joined_at) }]));
  /** @type {Map<string, { faction: number, region: number, char: string, account: string, merit: number, joinedAt: number }>} */
  const candidates = new Map();
  for (const r of counted) {
    const e = eligible.get(`${r.char_id}|${r.faction}`);
    if (!e) continue;
    const k = `${r.faction}|${r.region}|${r.char_id}`;
    if (!candidates.has(k)) candidates.set(k, { faction: Number(r.faction), region: Number(r.region), char: String(r.char_id), ...e, merit: 0 });
    /** @type {any} */ (candidates.get(k)).merit += Number(r.n);
  }
  const { results: sat = [] } = opened ? { results: [] } : await db.prepare('SELECT faction, region, char_id, seat, since FROM npc_chapter_seats').all();
  const sitting = sat.map((s) => ({ faction: Number(s.faction), region: Number(s.region), char: String(s.char_id), seat: String(s.seat), since: Number(s.since) }));
  const since = new Map(sitting.map((s) => [`${s.faction}|${s.region}|${s.char}`, s.since]));
  const plan = chapterSeatPlan(candidates.values(), sitting);
  return {
    rows: plan.map((p) => [p.faction, p.region, p.char, p.account, p.seat, since.get(`${p.faction}|${p.region}|${p.char}`) ?? week]),
    changes: seatChangesOf(sitting, plan).map((c) => [c.faction, c.region, c.char, c.from, c.to]),
  };
}

/** CHAP4c: whether the chapters' titles are minted for this account - the Chapters open to it and CHAPTER_TITLES on. The
 *  relay must carry the three ids (RELAY_VERSION world178) before this is turned on: a token with a title the relay does
 *  not know is refused at the hello. */
export const chapterTitlesOpenFor = (/** @type {any} */ player, /** @type {any} */ env) => env?.CHAPTER_TITLES === 'on' && chaptersOpenFor(player, env);

/** CHAP4c: the first week of the Season `week` falls in - the counted Season's, or with none counted the eight-week
 *  block's (the seats' stand-in). A Former Master's title holds from its loss to the Season's end. */
const seasonStartOf = (/** @type {number} */ week, /** @type {number | null} */ zero) => seasonOf(week, zero)?.start ?? Math.floor(week / SEASON_WEEKS) * SEASON_WEEKS;

/**
 * CHAP4c: THE CHAPTERS' TITLES OF AN ACCOUNT'S STANDING CHARACTERS, `[{ char, title, ts }]` - each character's, best
 * first (npcChapterLaw.js chapterTitlesOf): its seats now, and the Masters' seats it lost this Season (the Chronicle's
 * rows from the Season's first week). `character` narrows it to one.
 * @param {any} db @param {string} playerId @param {number} nowS @param {number | null} [zero] @param {string | null} [character]
 */
export async function chapterTitlesOfAccount(db, playerId, nowS, zero = null, character = null) {
  const week = meritWeekOf(nowS);
  const who = 'JOIN realm_characters c ON c.id = x.char_id AND c.player = ?1 AND c.dead_at IS NULL WHERE (?2 IS NULL OR x.char_id = ?2)';
  const { results: seats = [] } = await db.prepare(`SELECT x.char_id, x.faction, x.region, x.seat FROM npc_chapter_seats x ${who}`).bind(playerId, character).all();
  const { results: lost = [] } = await db.prepare(`SELECT x.char_id, x.faction, x.region FROM npc_chapter_history x ${who}
    AND x.kind = 'seat' AND json_extract(x.data, '$.from') = 'master' AND x.week >= ?3`).bind(playerId, character, seasonStartOf(week, zero)).all();
  const season = seasonOf(week, zero)?.n ?? 0;
  const chars = [...new Set([...seats, ...lost].map((r) => String(r.char_id)))].sort();
  return chars.flatMap((ch) => chapterTitlesOf(
    seats.filter((r) => r.char_id === ch).map((r) => ({ f: Number(r.faction), region: Number(r.region), seat: String(r.seat) })),
    lost.filter((r) => r.char_id === ch).map((r) => ({ f: Number(r.faction), region: Number(r.region) })), season,
  ).map((t) => ({ char: ch, ...t })));
}

/** CHAP4a: A CHARACTER'S SEATS, `[{ f, region, seat, since }]` by guild then region - the Roll's answer carries them. */
export async function chapterSeatsOf(/** @type {any} */ db, /** @type {unknown} */ character) {
  if (typeof character !== 'string') return [];
  const { results = [] } = await db.prepare('SELECT faction, region, seat, since FROM npc_chapter_seats WHERE char_id = ?1 ORDER BY faction, region').bind(character).all();
  return results.map((/** @type {any} */ s) => ({ f: Number(s.faction), region: Number(s.region), seat: String(s.seat), since: Number(s.since) }));
}

/**
 * THE CHAPTERS' TURNINGS DUE: every week before this one not yet settled, oldest first - from the week after the last
 * settled (or, on a service that has settled none, the last week alone), at most CHAPTER_WEEKS_MAX back; a week that
 * fails is the first the next read settles (the seats' settleDue, AUDIT-SEATS S1). Cheap when nothing is due: one read.
 * `open` the Chapters' switch - AUDIT CHAP3 S2: none settled while it is 'off'. "This week" is the week
 * CHAPTER_TURNING_GRACE_S ago (S1).
 * @param {any} db @param {number} nowS @param {number | null} [zero] @param {unknown} [open]
 */
export async function settleChaptersDue(db, nowS, zero = null, open = 'on') {
  const sw = chaptersSwitchOf(open);
  if (sw === 'off') return 0;
  const current = meritWeekOf(nowS - CHAPTER_TURNING_GRACE_S);
  const last = (await db.prepare('SELECT MAX(week) AS w FROM npc_chapter_weeks').first())?.w;
  const from = Math.max(last == null ? current - 1 : Number(last) + 1, current - CHAPTER_WEEKS_MAX);
  let n = 0;
  for (let w = from; w < current; w++) {
    const r = await settleChapterWeek(db, w, nowS, zero, sw);
    if (!r.settled) break;
    n++;
  }
  return n;
}

/** A region's chapters' Strengths: a Map of guild faction to Strength (50 for one no Turning has settled yet). */
export async function regionStrengths(/** @type {any} */ db, /** @type {number} */ region, /** @type {number[]} */ factions) {
  const out = new Map(factions.map((f) => [f, STRENGTH_START]));
  if (!factions.length) return out;
  const { results = [] } = await db.prepare('SELECT faction, strength FROM npc_chapters WHERE region = ?1').bind(region).all();
  for (const r of results) if (out.has(Number(r.faction))) out.set(Number(r.faction), Number(r.strength));
  return out;
}

/**
 * THE CHAPTER SHEET (5.3): `{ week, chapters: [{ f, region, strength, band }] }` - every chapter confirmed now, its
 * Strength and band, after the Turnings due. The Thieves Guild's and the Dark Brotherhood's are left off: a public sheet
 * would name where the underworld keeps its halls (their members read theirs on the board). `{ error }`:
 * 'chapters-closed'.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function chapterSheet({ db, nowS }, player, env) {
  if (!chaptersOpenFor(player, env)) return { error: 'chapters-closed' };
  await settleChaptersDue(db, nowS, seasonZeroOf(env?.SEASON_ZERO_WEEK), env?.CHAPTERS_OPEN);
  const chapters = (await allChapters(db, nowS)).filter((c) => !hallHidden(c.faction));
  const { results = [] } = await db.prepare('SELECT faction, region, strength FROM npc_chapters').all();
  const held = new Map(results.map((/** @type {any} */ r) => [`${r.faction}|${r.region}`, Number(r.strength)]));
  return {
    week: meritWeekOf(nowS),
    chapters: chapters.map((c) => {
      const strength = held.get(`${c.faction}|${c.region}`) ?? STRENGTH_START;
      return { f: c.faction, region: c.region, strength, band: chapterBandOf(strength).band };
    }),
  };
}
