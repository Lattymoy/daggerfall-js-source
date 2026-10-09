// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP3b (2026-10-08, Mac: "Continue", on "Keep going with the arc/
// slices") — STRENGTH AND THE CHAPTER SHEET: each chapter's Strength moved
// at the week's Turning toward its members' Merit (Chapters-Arc 5.2), and
// every chapter's state published (5.3). The law is
// src/net/npcChapterLaw.js; the record is migration 0099_npc_chapters.
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
import { REALM_ID_RE } from './realm.js';   // CHAP4d: a Master's character, as the Roll names one
import { regionOk } from '../../src/net/nodeLaw.js';
import { allRegionChapters } from './npcHalls.js';
import { agreedGateRegions } from './seatInfluence.js';   // AUDIT CHAP3 E1: a gate's region, as three of the day's claims agree on it
import { seatWeekStartMs, SEAT_WEEK_MS, seasonEndingAt, seasonZeroOf, seasonOf, SEASON_WEEKS } from '../../src/net/townSeatLaw.js';
import {
  STRENGTH_START, strengthAfter, strengthTarget, strengthSeasonEnd, chapterBandOf, meritWeekOf, hallHidden, chaptersSwitchOf,
  SEAT_MERIT_WEEKS, seatEligibleAt, chapterSeatPlan, seatChangesOf, chapterTitlesOf, chapterFocusOk, HIDDEN_HALL_FACTIONS,
  chapterEventWeights, chapterEventOf, chapterEventOk, chapterRivalsOf, chapterRivalPick, declineAfter, rivalryEnd, crackdownShuts,
  schismDoctrinesOf, schismWinner, successionHeir, chapterBackOk, chapterDoctrineOk, SUCCESSION_TURNING,
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
  // AUDIT CHAP3 S2: the developers' weeks forgotten the first week the Chapters are everyone's - AUDIT CHAP4 S2: the
  // last week the Chapters were open at all ('dev' or 'on'), the weeks they were shut ('off') no week of either
  const last = await db.prepare("SELECT open FROM npc_chapter_weeks WHERE week < ?1 AND open <> 'off' ORDER BY week DESC LIMIT 1").bind(week).first();
  const opened = open === 'on' && last?.open === 'dev';
  const { results: held = [] } = opened ? { results: [] } : await db.prepare('SELECT faction, region, strength, event, event_season, event_data, shut_season, doctrine, doctrine_season FROM npc_chapters').all();
  /** @type {Map<string, Chapter>} */
  const all = new Map();
  const at = (/** @type {number} */ f, /** @type {number} */ g) => {
    const k = `${f}|${g}`;
    if (!all.has(k)) all.set(k, { faction: f, region: g, prev: STRENGTH_START, merit: 0, s: STRENGTH_START, event: null, eventSeason: null, data: {}, shut: null, doctrine: null, doctrineSeason: null });
    return /** @type {Chapter} */ (all.get(k));
  };
  const confirmed = await allChapters(db, nowS);
  for (const c of confirmed) at(c.faction, c.region);
  for (const r of held) Object.assign(at(Number(r.faction), Number(r.region)), heldEvent(r), { prev: Number(r.strength) });
  for (const r of merits) at(Number(r.faction), Number(r.region)).merit += Number(r.n);
  const ends = seasonEndingAt(week, zero);
  const keys = new Set(confirmed.map((c) => `${c.faction}|${c.region}`));
  // CHAP6a: the week's step, and a Decline's 2 more where the Season's event is one (Chapters-Arc 7)
  const season = seasonOf(week, zero);
  const live = (/** @type {Chapter} */ c) => (season && c.eventSeason === season.n ? c.event : null);
  for (const c of all.values()) {
    c.s = strengthAfter(c.prev, c.merit, target);
    if (live(c) === 'decline') {
      const d = declineAfter(c.s, c.merit, target);
      c.data = { ...c.data, fell: Number(c.data.fell ?? 0) + (c.s - d) };
      c.s = d;
    }
  }
  // CHAP6b: a Succession named at the Season's third Turning (or the first after it a sleeping service settles)
  if (season && week >= season.start + SUCCESSION_TURNING - 1) await successionNamed(db, season, week, all, live);
  /** @type {any[]} */
  const seasonRows = ends ? await seasonEnded(db, /** @type {{ n: number, start: number }} */ (season), week, all, keys, live, opened) : [];
  const next = seasonOf(week + 1, zero);
  if (next && next.start === week + 1) await seasonDrawn(db, next.n, week, season, all, keys);
  const rows = [...all.values()].map((c) => [c.faction, c.region, ends ? strengthSeasonEnd(c.s) : c.s, c.merit, c.event, c.eventSeason, JSON.stringify(c.data), c.shut, c.doctrine, c.doctrineSeason]);
  const seats = await seatsPlaced(db, week, turning, open, opened, keys);
  try {
    await db.batch([
      db.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(week, active, target, rows.length, open, nowS),
      // AUDIT CHAP4 S6: the opening week starts EVERY chapter from 50 - a chapter this week names no more than one it does not
      // (a developers' trial chapter whose town is confirmed again later read its trial Strength)
      // CHAP6a: and no developers' event, nor a shut hall, past the opening
      ...(opened ? [db.prepare("UPDATE npc_chapters SET strength = ?1, event = NULL, event_season = NULL, event_data = '{}', shut_season = NULL, doctrine = NULL, doctrine_season = NULL WHERE true").bind(STRENGTH_START)] : []),
      db.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at, event, event_season, event_data, shut_season, doctrine, doctrine_season)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?1, json_extract(value, '$[3]'), ?2,
          json_extract(value, '$[4]'), json_extract(value, '$[5]'), json_extract(value, '$[6]'), json_extract(value, '$[7]'),
          json_extract(value, '$[8]'), json_extract(value, '$[9]')
        FROM json_each(?3) WHERE true
        ON CONFLICT (faction, region) DO UPDATE SET strength = excluded.strength, week = excluded.week, merit = excluded.merit, at = excluded.at,
          event = excluded.event, event_season = excluded.event_season, event_data = excluded.event_data, shut_season = excluded.shut_season,
          doctrine = excluded.doctrine, doctrine_season = excluded.doctrine_season`)
        .bind(week, nowS, JSON.stringify(rows)),
      // CHAP4a: the seats, the whole table again; a Chronicle row a seat that moved
      db.prepare('DELETE FROM npc_chapter_seats WHERE true'),
      db.prepare(`INSERT INTO npc_chapter_seats (faction, region, char_id, account, seat, since, week, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), json_extract(value, '$[3]'),
          json_extract(value, '$[4]'), json_extract(value, '$[5]'), ?1, ?2 FROM json_each(?3)
          WHERE EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = json_extract(value, '$[2]'))`)   // AUDIT CHAP4 S5: one deleted meanwhile never sits
        .bind(week, nowS, JSON.stringify(seats.rows)),
      db.prepare(`INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?1, 'seat', json_extract(value, '$[2]'),
          json_object('from', json_extract(value, '$[3]'), 'to', json_extract(value, '$[4]')), ?2 FROM json_each(?3)
          WHERE json_extract(value, '$[4]') IS NULL OR EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = json_extract(value, '$[2]'))`)   // S5: nor is said to take one
        .bind(week, nowS, JSON.stringify(seats.changes)),
      // CHAP6a: the Season's own lines - each event's ending, and each Master who held the seat the whole of it
      db.prepare(`INSERT INTO npc_chapter_history (faction, region, week, kind, char_id, data, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?1, json_extract(value, '$[2]'), json_extract(value, '$[3]'), json_extract(value, '$[4]'), ?2
        FROM json_each(?3) WHERE json_extract(value, '$[3]') = '' OR EXISTS (SELECT 1 FROM realm_characters c WHERE c.id = json_extract(value, '$[3]'))`)
        .bind(week, nowS, JSON.stringify(seasonRows)),
    ]);
  } catch {
    return { settled: false };
  }
  return { settled: true, chapters: rows.length };
}

/** @typedef {{ faction: number, region: number, prev: number, merit: number, s: number, event: string | null, eventSeason: number | null, data: any, shut: number | null, doctrine: string | null, doctrineSeason: number | null }} Chapter */

/** CHAP6a: a held row's event, as the Turning carries it. */
function heldEvent(/** @type {any} */ r) {
  let data = {};
  try { data = JSON.parse(r.event_data ?? '{}') ?? {}; } catch { /* a state nobody can read is no state */ }
  return {
    event: chapterEventOk(r.event) ? String(r.event) : null, eventSeason: r.event_season == null ? null : Number(r.event_season),
    data: typeof data === 'object' && !Array.isArray(data) ? data : {}, shut: r.shut_season == null ? null : Number(r.shut_season),
    // CHAP6b: the doctrine a Schism carried, and the Season it holds for
    doctrine: chapterDoctrineOk(r.doctrine) ? String(r.doctrine) : null, doctrineSeason: r.doctrine_season == null ? null : Number(r.doctrine_season),
  };
}

/**
 * CHAP6b: EVERY ACCOUNT'S MERIT at every chapter from week `from` to week `to`, a Map of `faction|region|account` to its
 * sum - a gate's where its day's claims agree (AUDIT CHAP3 E1), as every sum.
 * @param {any} db @param {number} from @param {number} to
 */
async function accountMeritBetween(db, from, to) {
  const { results: lines = [] } = await db.prepare(`SELECT faction, region, account, source, ref, SUM(amount) AS n FROM npc_chapter_merit WHERE week BETWEEN ?1 AND ?2
    GROUP BY faction, region, account, source, CASE WHEN source = 'gate' THEN ref ELSE '' END`).bind(from, to).all();
  const gateDays = [...new Set(lines.filter((r) => r.source === 'gate').map((r) => gateDayOf(r.ref)).filter((d) => d !== null))];
  const agreed = await agreedGateRegions(db, gateDays);
  /** @type {Map<string, number>} */
  const out = new Map();
  for (const r of lines) {
    if (r.source === 'gate' && agreed.get(/** @type {number} */ (gateDayOf(r.ref))) !== Number(r.region)) continue;
    const k = `${r.faction}|${r.region}|${r.account}`;
    out.set(k, (out.get(k) ?? 0) + Number(r.n));
  }
  return out;
}

/**
 * CHAP6b: A SEASON'S BACKING at every chapter whose event it decides - `{ backs, masters, merit }`: each chapter's
 * backings `[{ account, char, side }]` (`faction|region` keyed), the character in each chapter's Master's seat as the
 * seats stand before this Turning's placing, and every account's Merit there from the Season's first week to `week`.
 * @param {any} db @param {{ n: number, start: number }} season @param {number} week
 */
async function seasonBacking(db, season, week) {
  const { results = [] } = await db.prepare('SELECT faction, region, account, char_id, side FROM npc_chapter_backing WHERE season = ?1 ORDER BY account')
    .bind(season.n).all();
  /** @type {Map<string, { account: string, char: string, side: number }[]>} */
  const backs = new Map();
  for (const r of results) {
    const k = `${r.faction}|${r.region}`;
    if (!backs.has(k)) backs.set(k, []);
    backs.get(k)?.push({ account: String(r.account), char: String(r.char_id), side: Number(r.side) });
  }
  const { results: seated = [] } = await db.prepare("SELECT faction, region, char_id FROM npc_chapter_seats WHERE seat = 'master'").all();
  const masters = new Map(seated.map((m) => [`${m.faction}|${m.region}`, String(m.char_id)]));
  return { backs, masters, merit: backs.size ? await accountMeritBetween(db, season.start, week) : new Map() };
}

/**
 * CHAP6b: A SUCCESSION NAMED (Chapters-Arc 7) at its Season's third Turning - each chapter whose Season's Succession has no
 * heir yet: the Master's naming (the backing of the character in its Master's seat), else the choice of the backer whose
 * account earned the chapter the most Merit this Season (the lower account at a tie), else the hall's own first
 * (successionHeir). The heir and who named it kept in the chapter's state.
 * @param {any} db @param {{ n: number, start: number }} season @param {number} week @param {Map<string, Chapter>} all @param {(c: Chapter) => string | null} live
 */
async function successionNamed(db, season, week, all, live) {
  const due = [...all.values()].filter((c) => live(c) === 'succession' && !Number.isSafeInteger(c.data.heir));
  if (!due.length) return;
  const { backs, masters, merit } = await seasonBacking(db, season, week);
  for (const c of due) {
    const k = `${c.faction}|${c.region}`;
    const list = (backs.get(k) ?? []).filter((b) => chapterBackOk('succession', b.side));
    const master = list.find((b) => b.char === masters.get(k))?.side ?? null;
    const top = list.reduce((/** @type {{ account: string, side: number, n: number } | null} */ best, b) => {
      const n = merit.get(`${k}|${b.account}`) ?? 0;
      return n > 0 && (!best || n > best.n) ? { account: b.account, side: b.side, n } : best;
    }, null);
    const heir = successionHeir(master, top?.side ?? null);
    c.data = { ...c.data, heir, named: master !== null ? 'master' : top ? 'member' : 'hall' };
  }
}

/**
 * CHAP6a: EVERY CHAPTER'S MERIT from week `from` to week `to`, a Map of `faction|region` to its sum - a gate's where its
 * day's claims agree (AUDIT CHAP3 E1, as the week's own sums).
 * @param {any} db @param {number} from @param {number} to
 */
async function chapterMeritBetween(db, from, to) {
  const { results: lines = [] } = await db.prepare(`SELECT faction, region, source, ref, SUM(amount) AS n FROM npc_chapter_merit WHERE week BETWEEN ?1 AND ?2
    GROUP BY faction, region, source, CASE WHEN source = 'gate' THEN ref ELSE '' END`).bind(from, to).all();
  const gateDays = [...new Set(lines.filter((r) => r.source === 'gate').map((r) => gateDayOf(r.ref)).filter((d) => d !== null))];
  const agreed = await agreedGateRegions(db, gateDays);
  /** @type {Map<string, number>} */
  const out = new Map();
  for (const r of lines) {
    if (r.source === 'gate' && agreed.get(/** @type {number} */ (gateDayOf(r.ref))) !== Number(r.region)) continue;
    const k = `${r.faction}|${r.region}`;
    out.set(k, (out.get(k) ?? 0) + Number(r.n));
  }
  return out;
}

/**
 * CHAP6a: A SEASON'S END (Chapters-Arc 7: "the event resolves"), before its halving - each Rivalry raced on the Season's
 * Merit and its winner given 10 of the loser's Strength (a pair that drew each other raced once), each Crackdown's
 * chapter under 30 shut for the next Season. Answers the Chronicle's rows `[faction, region, kind, char, data]`: an
 * 'event' row a chapter whose event was no Calm, and a 'season' row each Master who held the seat the whole Season
 * (placed at or before the Turning that opened it, sitting still - never Season 0's, which crowns no one, as the seats'
 * own; never at the Chapters' opening, whose seats are none).
 * @param {any} db @param {{ n: number, start: number }} season @param {number} week @param {Map<string, Chapter>} all
 * @param {Set<string>} keys @param {(c: Chapter) => string | null} live @param {boolean} opened
 */
async function seasonEnded(db, season, week, all, keys, live, opened) {
  const merit = await chapterMeritBetween(db, season.start, week);
  /** @type {Map<string, string | null>} */
  const raced = new Map();
  for (const c of all.values()) {
    if (live(c) !== 'rivalry') continue;
    const k = `${c.faction}|${c.region}`, rk = `${c.data.rival}|${c.region}`;
    const r = keys.has(rk) ? all.get(rk) : undefined;
    if (!r) { c.data = { ...c.data, won: null }; continue; }   // its rival's chapter gone: no race to win
    const pair = [k, rk].sort().join('&');
    if (!raced.has(pair)) {
      const end = rivalryEnd([c.s, r.s], [merit.get(k) ?? 0, merit.get(rk) ?? 0]);
      c.s = end.a; r.s = end.b;
      raced.set(pair, end.won === null ? null : end.won === 'a' ? k : rk);
    }
    const winner = raced.get(pair);
    c.data = { ...c.data, won: winner == null ? null : winner === k };
  }
  // CHAP6b: each Schism decided - its sides' backers' Merit this Season, a tie the Master's side, the winner's doctrine
  // the next Season's
  if ([...all.values()].some((c) => live(c) === 'schism')) {
    const { backs, masters, merit: by } = await seasonBacking(db, season, week);
    for (const c of all.values()) {
      if (live(c) !== 'schism') continue;
      const k = `${c.faction}|${c.region}`;
      const list = (backs.get(k) ?? []).filter((b) => chapterBackOk('schism', b.side));
      /** @type {[number, number]} */
      const sums = [0, 0];
      for (const b of list) sums[b.side] += by.get(`${k}|${b.account}`) ?? 0;
      const won = schismWinner(sums, list.find((b) => b.char === masters.get(k))?.side ?? null);
      const doctrine = won === null ? null : schismDoctrinesOf(season.n, c.faction, c.region)[won];
      if (doctrine) { c.doctrine = doctrine; c.doctrineSeason = season.n + 1; }
      c.data = { ...c.data, sums, doctrine };
    }
  }
  /** @type {any[]} */
  const out = [];
  for (const c of all.values()) {
    const e = live(c);
    if (e === 'crackdown') {
      const shut = crackdownShuts(c.s);
      if (shut) c.shut = season.n + 1;
      c.data = { ...c.data, shut };
    }
    if (e && e !== 'calm') out.push([c.faction, c.region, 'event', '', JSON.stringify({ ...c.data, season: season.n, event: e })]);
  }
  if (season.n > 0 && !opened) {
    const { results: masters = [] } = await db.prepare("SELECT faction, region, char_id FROM npc_chapter_seats WHERE seat = 'master' AND since <= ?1 ORDER BY faction, region")
      .bind(season.start - 1).all();
    for (const m of masters) {
      if (keys.has(`${m.faction}|${m.region}`)) out.push([Number(m.faction), Number(m.region), 'season', String(m.char_id), JSON.stringify({ season: season.n })]);
    }
  }
  return out;
}

/**
 * CHAP6a: A SEASON'S DRAW (Chapters-Arc 7) at the Turning that opens Season `n` (`week` its last week before, `ended`
 * the Season that week closed, or null): every confirmed chapter's event over the weights its last Season moved - its
 * band as that Season ended, the hands its Master's seat changed into in it, its strongest rival in the region (the
 * Rivalry's to race), whether a seat of the region has the Curfew as law. A chapter no longer confirmed draws none.
 * @param {any} db @param {number} n @param {number} week @param {{ start: number } | null} ended @param {Map<string, Chapter>} all @param {Set<string>} keys
 */
async function seasonDrawn(db, n, week, ended, all, keys) {
  /** @type {Map<string, number>} */
  const masters = new Map();
  if (ended) {
    const { results = [] } = await db.prepare(`SELECT faction, region, COUNT(*) AS n FROM npc_chapter_history WHERE kind = 'seat' AND week BETWEEN ?1 AND ?2
      AND json_extract(data, '$.to') = 'master' GROUP BY faction, region`).bind(ended.start - 1, week - 1).all();
    for (const r of results) masters.set(`${r.faction}|${r.region}`, Number(r.n));
  }
  const { results: curfews = [] } = await db.prepare(`SELECT DISTINCT h.region FROM town_seat_edicts e JOIN town_seat_holds h ON h.key = e.key
    WHERE e.week = ?1 AND e.state = 'law' AND e.edict = 'curfew'`).bind(week).all();
  const curfew = new Set(curfews.map((r) => Number(r.region)));
  for (const c of all.values()) {
    const k = `${c.faction}|${c.region}`;
    if (!keys.has(k)) continue;
    const rivals = chapterRivalsOf(c.faction).map((f) => all.get(`${f}|${c.region}`)).filter((r) => r && keys.has(`${r.faction}|${r.region}`))
      .map((r) => ({ faction: /** @type {Chapter} */ (r).faction, strength: /** @type {Chapter} */ (r).s }));
    const rival = chapterRivalPick(rivals);
    const weights = chapterEventWeights({
      faction: c.faction, band: chapterBandOf(c.s).band, masters: masters.get(k) ?? 0,
      rivalBand: rival === null ? null : chapterBandOf(/** @type {Chapter} */ (all.get(`${rival}|${c.region}`)).s).band, curfew: curfew.has(c.region),
    });
    c.event = chapterEventOf(n, c.faction, c.region, weights);
    c.eventSeason = n;
    c.data = c.event === 'rivalry' ? { rival } : {};
  }
}

/**
 * CHAP4a: THE SEATS WEEK `week`'S TURNING PLACES (Chapters-Arc 6): every chapter's Eligible members (npcChapterLaw.js
 * seatEligibleAt, at the Turning `turning`: a member on the Roll at the seat's line, fourteen days in the guild, its account
 * seven days old, its character standing) by their Merit at it over the SEAT_MERIT_WEEKS to `week` - a gate's where its
 * day's claims agree (AUDIT CHAP3 E1), never a week settled while the Chapters were the developers' alone once they are
 * everyone's (`opened`, S2's law) - placed by chapterSeatPlan over the seats as they stand. Answers `{ rows, changes }`:
 * the table's rows `[faction, region, char, account, seat, since]` (`since` kept for a character that sat at the chapter
 * already) and the Chronicle's `[faction, region, char, from, to]`. AUDIT CHAP4 E3: seats only at a chapter confirmed now
 * (`chapters`, the week's own `faction|region` keys) - a struck chapter's holders sit nowhere.
 * @param {any} db @param {number} week @param {number} turning @param {string} open @param {boolean} opened @param {Set<string>} chapters
 */
async function seatsPlaced(db, week, turning, open, opened, chapters) {
  // the developers' weeks: none of their Merit counts toward a seat once the Chapters are everyone's
  const dev = open === 'on' ? (await db.prepare("SELECT MAX(week) AS w FROM npc_chapter_weeks WHERE week < ?1 AND open = 'dev'").bind(week).first())?.w : null;
  // AUDIT CHAP4 S2: the four weeks are the last four the Chapters were open - a week they were shut ('off') is no week of
  // the window, so the Turning after the switch is on again reads its holders' Merit from before it went off
  const { results: opens = [] } = await db.prepare("SELECT week FROM npc_chapter_weeks WHERE week < ?1 AND open <> 'off' ORDER BY week DESC LIMIT ?2")
    .bind(week, SEAT_MERIT_WEEKS - 1).all();
  const from = Math.max(Math.min(week - SEAT_MERIT_WEEKS + 1, ...opens.map((/** @type {any} */ r) => Number(r.week))), dev == null ? -Infinity : Number(dev) + 1);
  const { results: lines = [] } = await db.prepare(`SELECT faction, region, char_id, source, ref, SUM(amount) AS n FROM npc_chapter_merit
    WHERE week BETWEEN ?1 AND ?2 GROUP BY faction, region, char_id, source, CASE WHEN source = 'gate' THEN ref ELSE '' END`).bind(from, week).all();
  const gateDays = [...new Set(lines.filter((r) => r.source === 'gate').map((r) => gateDayOf(r.ref)).filter((d) => d !== null))];
  const agreed = await agreedGateRegions(db, gateDays);
  const counted = lines.filter((r) => r.source !== 'gate' || agreed.get(/** @type {number} */ (gateDayOf(r.ref))) === Number(r.region));
  const chars = [...new Set(counted.map((r) => String(r.char_id)))];
  const { results: roll = [] } = chars.length ? await db.prepare(`SELECT r.char_id, r.faction_id, r.player, r.rep, r.member, r.joined_at, p.registered_at
    FROM npc_roll r JOIN realm_characters c ON c.id = r.char_id AND c.player = r.player AND c.dead_at IS NULL JOIN players p ON p.id = r.player
    WHERE r.member = 1 AND r.dormant = 0 AND r.char_id IN (SELECT value FROM json_each(?1))`).bind(JSON.stringify(chars)).all() : { results: [] };   // AUDIT CHAP4 D1: an active membership
  const eligible = new Map(roll.filter((r) => seatEligibleAt({ member: r.member, rep: r.rep, joinedAt: r.joined_at, registeredAt: r.registered_at }, turning))
    .map((r) => [`${r.char_id}|${r.faction_id}`, { account: String(r.player), joinedAt: Number(r.joined_at) }]));
  /** @type {Map<string, { faction: number, region: number, char: string, account: string, merit: number, joinedAt: number }>} */
  const candidates = new Map();
  for (const r of counted) {
    const e = eligible.get(`${r.char_id}|${r.faction}`);
    if (!e || !chapters.has(`${r.faction}|${r.region}`)) continue;   // AUDIT CHAP4 E3
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
 *  relay must carry the three ids (RELAY_VERSION world182) before this is turned on: a token with a title the relay does
 *  not know is refused at the hello. */
export const chapterTitlesOpenFor = (/** @type {any} */ player, /** @type {any} */ env) => env?.CHAPTER_TITLES === 'on' && chaptersOpenFor(player, env);

/** CHAP4c: the first week of the Season `week` falls in - the counted Season's, or with none counted the eight-week
 *  block's (the seats' stand-in). A Former Master's title holds from its loss to the Season's end. */
const seasonStartOf = (/** @type {number} */ week, /** @type {number | null} */ zero) => seasonOf(week, zero)?.start ?? Math.floor(week / SEASON_WEEKS) * SEASON_WEEKS;

/**
 * CHAP4c: THE CHAPTERS' TITLES OF AN ACCOUNT'S STANDING CHARACTERS, `[{ char, title, ts }]` - each character's, best
 * first (npcChapterLaw.js chapterTitlesOf): its seats now, and the Masters' seats it lost this Season (the Chronicle's
 * rows from the Season's first week). `character` narrows it to one. AUDIT CHAP4 E3: only a chapter confirmed now - a
 * struck chapter's seats and its Masters' loss title nobody.
 * @param {any} db @param {string} playerId @param {number} nowS @param {number | null} [zero] @param {string | null} [character]
 */
export async function chapterTitlesOfAccount(db, playerId, nowS, zero = null, character = null) {
  const week = meritWeekOf(nowS);
  const who = 'JOIN realm_characters c ON c.id = x.char_id AND c.player = ?1 AND c.dead_at IS NULL WHERE (?2 IS NULL OR x.char_id = ?2)';
  const { results: seats = [] } = await db.prepare(`SELECT x.char_id, x.faction, x.region, x.seat FROM npc_chapter_seats x ${who}`).bind(playerId, character).all();
  const { results: lost = [] } = await db.prepare(`SELECT x.char_id, x.faction, x.region FROM npc_chapter_history x ${who}
    AND x.kind = 'seat' AND json_extract(x.data, '$.from') = 'master' AND x.week >= ?3`).bind(playerId, character, seasonStartOf(week, zero)).all();
  const season = seasonOf(week, zero)?.n ?? 0;
  if (!seats.length && !lost.length) return [];
  const confirmed = new Set((await allChapters(db, nowS)).map((c) => `${c.faction}|${c.region}`));
  const kept = (/** @type {any[]} */ rows) => rows.filter((r) => confirmed.has(`${r.faction}|${r.region}`));
  const seatsHere = kept(seats), lostHere = kept(lost);
  const chars = [...new Set([...seatsHere, ...lostHere].map((r) => String(r.char_id)))].sort();
  return chars.flatMap((ch) => chapterTitlesOf(
    seatsHere.filter((r) => r.char_id === ch).map((r) => ({ f: Number(r.faction), region: Number(r.region), seat: String(r.seat) })),
    lostHere.filter((r) => r.char_id === ch).map((r) => ({ f: Number(r.faction), region: Number(r.region) })), season,
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
 * CHAPTER_TURNING_GRACE_S ago (S1). AUDIT CHAP4 S2: while it is 'off' the weeks due are RECORDED shut ('off', nothing
 * moved - no Merit could be earned in them) on a service that has settled one, so the Turnings once it is on again start
 * past them: their -3, a Season's halving and an empty seat window never came all at once at the reopening.
 * @param {any} db @param {number} nowS @param {number | null} [zero] @param {unknown} [open]
 */
export async function settleChaptersDue(db, nowS, zero = null, open = 'on') {
  const sw = chaptersSwitchOf(open);
  const current = meritWeekOf(nowS - CHAPTER_TURNING_GRACE_S);
  const last = (await db.prepare('SELECT MAX(week) AS w FROM npc_chapter_weeks').first())?.w;
  if (sw === 'off') {
    if (last == null || Number(last) + 1 >= current) return 0;
    const weeks = [];
    for (let w = Math.max(Number(last) + 1, current - CHAPTER_WEEKS_MAX); w < current; w++) weeks.push(w);
    await db.prepare(`INSERT OR IGNORE INTO npc_chapter_weeks (week, active, target, chapters, open, at)
      SELECT value, 0, 0, 0, 'off', ?1 FROM json_each(?2)`).bind(nowS, JSON.stringify(weeks)).run();
    return 0;
  }
  const from = Math.max(last == null ? current - 1 : Number(last) + 1, current - CHAPTER_WEEKS_MAX);
  let n = 0;
  for (let w = from; w < current; w++) {
    const r = await settleChapterWeek(db, w, nowS, zero, sw);
    if (!r.settled) break;
    n++;
  }
  return n;
}

/** CHAP6a: the Season `nowS` is in (its number), or null with none counted - the week a chapter's event and shut halls
 *  are read against. */
export const seasonNumberAt = (/** @type {number} */ nowS, /** @type {number | null} */ zero) => seasonOf(meritWeekOf(nowS), zero)?.n ?? null;

/** CHAP6a: a chapter's event this Season as a reader is told it - `{ event, rival?, shut? }` (`event` null where none was
 *  drawn for it) - or null where it has neither; `named` whether a rival guild may be named to this reader. */
function eventView(/** @type {any} */ r, /** @type {number | null} */ n, /** @type {(f: number) => boolean} */ named) {
  if (n == null) return null;
  const e = heldEvent(r);
  const event = e.eventSeason === n ? e.event : null;
  const shut = e.shut === n;
  const doctrine = e.doctrineSeason === n ? e.doctrine : null;   // CHAP6b: the doctrine last Season's Schism carried
  if (!event && !shut && !doctrine) return null;
  const rival = event === 'rivalry' && Number.isSafeInteger(e.data.rival) && named(e.data.rival) ? e.data.rival : null;
  return {
    event, ...(rival !== null ? { rival } : {}), ...(shut ? { shut: true } : {}), ...(doctrine ? { doctrine } : {}),
    // CHAP6b: a Schism's two doctrines (side 0's, side 1's), a Succession's heir once named
    ...(event === 'schism' ? { sides: schismDoctrinesOf(n, Number(r.faction), Number(r.region)) } : {}),
    ...(event === 'succession' && Number.isSafeInteger(e.data.heir) ? { heir: e.data.heir } : {}),
  };
}

/**
 * CHAP6a: A REGION'S CHAPTERS' EVENTS this Season `n` (null: none counted) - a Map of guild faction to eventView's
 * `{ event, rival?, shut?, doctrine?, sides?, heir? }`, for each chapter with an event drawn for this Season, its halls
 * shut for it, or (CHAP6b) a doctrine holding in it. `named`
 * whether a rival guild may be named (a hidden one only to its members).
 * @param {any} db @param {number} region @param {number | null} n @param {(f: number) => boolean} [named]
 */
export async function regionEvents(db, region, n, named = (f) => !hallHidden(f)) {
  /** @type {Map<number, { event: string | null, rival?: number, shut?: boolean }>} */
  const out = new Map();
  if (n == null) return out;
  const { results = [] } = await db.prepare('SELECT faction, region, event, event_season, event_data, shut_season, doctrine, doctrine_season FROM npc_chapters WHERE region = ?1').bind(region).all();
  for (const r of results) {
    const v = eventView(r, n, named);
    if (v) out.set(Number(r.faction), v);
  }
  return out;
}

/** CHAP6b: an account's backings this Season `n` in a region's chapters - a Map of guild faction to the side it backs. */
export async function regionBackings(/** @type {any} */ db, /** @type {number} */ region, /** @type {number | null} */ n, /** @type {string} */ account) {
  if (n == null) return new Map();
  const { results = [] } = await db.prepare('SELECT faction, side FROM npc_chapter_backing WHERE region = ?1 AND season = ?2 AND account = ?3').bind(region, n, account).all();
  return new Map(results.map((/** @type {any} */ r) => [Number(r.faction), Number(r.side)]));
}

/**
 * CHAP6b: A MEMBER'S BACKING (Chapters-Arc 7): `{ character, faction, region, side }` - the account's standing character,
 * an active member of the guild on its Roll, backs side `side` of its chapter's Schism (0 or 1) or names candidate `side`
 * of its Succession (0 to 2); a Master's naming is the backing of the character in its Master's seat. One backing an
 * account a chapter a Season, changed until the event is decided. Answers `{ ok: true, event, side }` or `{ error }`:
 * 'body'; 'no-event' (no Season counted, or the chapter's Season holds no Schism nor Succession); 'no-side'; 'closed' (a
 * Succession named, or past its third Turning); 'not-member' (no active membership of the guild on that character,
 * another account's character, or a dead one). The Turnings due settled first; the event and the membership asked
 * inside the write.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string }} player @param {any} env @param {any} body
 */
export async function backChapter({ db, nowS }, player, env, { character, faction, region, side } = {}) {
  if (typeof character !== 'string' || !REALM_ID_RE.test(character) || !Number.isSafeInteger(faction) || !regionOk(region) || !Number.isSafeInteger(side)) return { error: 'body' };
  const zero = seasonZeroOf(env?.SEASON_ZERO_WEEK);
  await settleChaptersDue(db, nowS, zero, env?.CHAPTERS_OPEN);
  const week = meritWeekOf(nowS);
  const season = seasonOf(week, zero);
  if (!season) return { error: 'no-event' };
  const row = await db.prepare('SELECT event, event_season, event_data FROM npc_chapters WHERE faction = ?1 AND region = ?2').bind(faction, region).first();
  const e = row ? heldEvent(row) : null;
  const event = e && e.eventSeason === season.n ? e.event : null;
  if (!e || (event !== 'schism' && event !== 'succession')) return { error: 'no-event' };
  if (!chapterBackOk(event, side)) return { error: 'no-side' };
  if (event === 'succession' && (Number.isSafeInteger(e.data.heir) || week >= season.start + SUCCESSION_TURNING)) return { error: 'closed' };
  const r = await db.prepare(`INSERT INTO npc_chapter_backing (faction, region, season, account, char_id, side, at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7
    WHERE EXISTS (SELECT 1 FROM npc_roll WHERE char_id = ?5 AND player = ?4 AND faction_id = ?1 AND member = 1 AND dormant = 0)
      AND EXISTS (SELECT 1 FROM realm_characters WHERE id = ?5 AND player = ?4 AND dead_at IS NULL)
      AND EXISTS (SELECT 1 FROM npc_chapters WHERE faction = ?1 AND region = ?2 AND event = ?8 AND event_season = ?3)
    ON CONFLICT (faction, region, season, account) DO UPDATE SET char_id = excluded.char_id, side = excluded.side, at = excluded.at`)
    .bind(faction, region, season.n, player.id, character, side, nowS, event).run();
  return Number(r?.meta?.changes ?? 0) > 0 ? { ok: true, event, side } : { error: 'not-member' };
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
 * THE CHAPTER SHEET (5.3): `{ week, chapters: [{ f, region, strength, band, seats, event?, rival?, shut? }] }` - every
 * chapter confirmed now, its Strength and band, after the Turnings due, (CHAP5a) its seats' holders `[{ seat, name }]`,
 * the Master's first, and (CHAP6a) its Season's event, a Rivalry's public rival, and whether its halls are shut. The Thieves Guild's and the Dark Brotherhood's are left off: a public sheet
 * would name where the underworld keeps its halls (their members read theirs on the board). `{ error }`:
 * 'chapters-closed'.
 * @param {{ db: any, nowS: number }} ctx @param {any} player @param {any} env
 */
export async function chapterSheet({ db, nowS }, player, env) {
  if (!chaptersOpenFor(player, env)) return { error: 'chapters-closed' };
  await settleChaptersDue(db, nowS, seasonZeroOf(env?.SEASON_ZERO_WEEK), env?.CHAPTERS_OPEN);
  const chapters = (await allChapters(db, nowS)).filter((c) => !hallHidden(c.faction));
  const { results = [] } = await db.prepare('SELECT faction, region, strength, event, event_season, event_data, shut_season, doctrine, doctrine_season FROM npc_chapters').all();
  const held = new Map(results.map((/** @type {any} */ r) => [`${r.faction}|${r.region}`, Number(r.strength)]));
  // CHAP6a: and each chapter's Season's event - its rival named where the rival is public, as the sheet itself is
  const n = seasonNumberAt(nowS, seasonZeroOf(env?.SEASON_ZERO_WEEK));
  const events = new Map(results.map((/** @type {any} */ r) => [`${r.faction}|${r.region}`, eventView(r, n, (f) => !hallHidden(f))]));
  // CHAP5a (Chapters-Arc 5.3, 9): and each chapter's seats' holders, by the names their characters carry now - the
  // Master's first, then its officers by their tenure (the hall's roll); a hidden guild's chapters are not on the sheet
  const { results: seatRows = [] } = await db.prepare(`SELECT s.faction, s.region, s.seat, c.name FROM npc_chapter_seats s
    JOIN realm_characters c ON c.id = s.char_id ORDER BY s.seat = 'master' DESC, s.since, s.char_id`).all();
  /** @type {Map<string, { seat: string, name: string }[]>} */
  const seats = new Map();
  for (const r of seatRows) {
    const k = `${r.faction}|${r.region}`;
    if (!seats.has(k)) seats.set(k, []);
    seats.get(k)?.push({ seat: String(r.seat), name: String(r.name) });
  }
  return {
    week: meritWeekOf(nowS),
    chapters: chapters.map((c) => {
      const strength = held.get(`${c.faction}|${c.region}`) ?? STRENGTH_START;
      return { f: c.faction, region: c.region, strength, band: chapterBandOf(strength).band, seats: seats.get(`${c.faction}|${c.region}`) ?? [], ...events.get(`${c.faction}|${c.region}`) };
    }),
  };
}

// ─── CHAP4d: THE FOCUS AND THE CHRONICLE ────────────────────────────

/**
 * THE MASTER'S FOCUS: `{ character, faction, region, focus }` - the account's standing character, the Master of that
 * chapter, names the material family its hall writs ask more of this week (npcChapterLaw.js chapterFocusOk - its guild's
 * own, where it has more than one). One write, the seat asked inside it. Answers `{ ok: true, focus, week }`, or `{ error }`:
 * 'body', 'no-focus' (none of its guild's), 'not-master' (no Master's seat of that chapter on that character). AUDIT CHAP4
 * S4: the Turnings due settled first, and the seat the one LAST week's Turning placed - between a week's boundary and its
 * Turning the Master about to be unseated set the new week's Focus.
 * @param {{ db: any, nowS: number }} ctx @param {{ id: string }} player @param {any} env @param {any} body
 */
export async function setChapterFocus({ db, nowS }, player, env, { character, faction, region, focus } = {}) {
  if (typeof character !== 'string' || !REALM_ID_RE.test(character) || !Number.isSafeInteger(faction) || !regionOk(region)) return { error: 'body' };
  if (!chapterFocusOk(faction, focus)) return { error: 'no-focus' };
  await settleChaptersDue(db, nowS, seasonZeroOf(env?.SEASON_ZERO_WEEK), env?.CHAPTERS_OPEN);
  const week = meritWeekOf(nowS);
  const r = await db.prepare(`UPDATE npc_chapters SET focus = ?1, focus_week = ?2 WHERE faction = ?3 AND region = ?4
    AND EXISTS (SELECT 1 FROM npc_chapter_seats s JOIN realm_characters c ON c.id = s.char_id AND c.player = ?6 AND c.dead_at IS NULL
      WHERE s.faction = ?3 AND s.region = ?4 AND s.char_id = ?5 AND s.seat = 'master' AND s.week = ?7)`).bind(focus, week, faction, region, character, player.id, week - 1).run();
  return Number(r?.meta?.changes ?? 0) > 0 ? { ok: true, focus, week } : { error: 'not-master' };
}

/** CHAP4d: a region's chapters' Focuses this week - a Map of guild faction to family (the hall writs' draw reads it). */
export async function regionFocuses(/** @type {any} */ db, /** @type {number} */ region, /** @type {number} */ week) {
  const { results = [] } = await db.prepare('SELECT faction, focus FROM npc_chapters WHERE region = ?1 AND focus_week = ?2 AND focus IS NOT NULL').bind(region, week).all();
  return new Map(results.filter((/** @type {any} */ r) => chapterFocusOk(Number(r.faction), r.focus)).map((/** @type {any} */ r) => [Number(r.faction), String(r.focus)]));
}

/** CHAP4d: the chapters a character is the Master of in a region - a Set of guild factions (the board offers the Focus).
 *  AUDIT CHAP4 S4: by the seats LAST week's Turning placed (`week` this one), as the Focus's write asks. */
export async function masterSeatsIn(/** @type {any} */ db, /** @type {unknown} */ character, /** @type {number} */ region, /** @type {number} */ week) {
  if (typeof character !== 'string') return new Set();
  const { results = [] } = await db.prepare("SELECT faction FROM npc_chapter_seats WHERE char_id = ?1 AND region = ?2 AND seat = 'master' AND week = ?3").bind(character, region, week - 1).all();
  return new Set(results.map((/** @type {any} */ r) => Number(r.faction)));
}

/** The most of a region's Chronicle the Hall of Records reads - its newest rows. */
export const CHAPTER_CHRONICLE_ROWS = 60;
/**
 * CHAP4d: A REGION'S CHAPTERS' CHRONICLE, `{ rows: [{ faction, week, kind, data, name }], zero }` - its newest
 * CHAPTER_CHRONICLE_ROWS, oldest first (the book's order), each character named as it is now (null for one gone since);
 * never a hidden guild's (their seats are their members' alone) - AUDIT CHAP4 S3: left out BEFORE the newest are counted,
 * so the underworld's moves neither shorten the book nor show in its count.
 * @param {{ db: any }} ctx @param {any} _player @param {any} env @param {any} body
 */
export async function chapterChronicle({ db }, _player, env, { region } = {}) {
  if (!regionOk(region)) return { error: 'body' };
  const { results = [] } = await db.prepare(`SELECT h.faction, h.week, h.kind, h.data, c.name FROM npc_chapter_history h
    LEFT JOIN realm_characters c ON c.id = h.char_id WHERE h.region = ?1 AND h.faction NOT IN (SELECT value FROM json_each(?3))
    ORDER BY h.seq DESC LIMIT ?2`).bind(region, CHAPTER_CHRONICLE_ROWS, JSON.stringify(HIDDEN_HALL_FACTIONS)).all();
  const rows = results.reverse().map((/** @type {any} */ r) => {
    let data = {};
    try { data = JSON.parse(r.data); } catch { /* a row the Chronicle has no words for */ }
    return { faction: Number(r.faction), week: Number(r.week), kind: String(r.kind), data, name: r.name ?? null };
  });
  return { rows, zero: seasonZeroOf(env?.SEASON_ZERO_WEEK) };
}
