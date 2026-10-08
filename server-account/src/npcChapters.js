// @ts-check
// ═══════════════════════════════════════════════════════════════════
// CHAP3b (2026-10-08, Mac: "Continue", on "Keep going with the arc/
// slices") — STRENGTH AND THE CHAPTER SHEET: each chapter's Strength moved
// at the week's Turning toward its members' Merit (Chapters-Arc 5.2), and
// every chapter's state published (5.3). The law is
// src/net/npcChapterLaw.js; the record is migration 0095_npc_chapters.
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
// ═══════════════════════════════════════════════════════════════════

import { chaptersOpenFor } from './npcRoll.js';
import { hallFacts } from './npcHalls.js';
import { factConfirmed } from '../../src/net/nodeLaw.js';
import { seatWeekStartMs, SEAT_WEEK_MS, seasonEndingAt, seasonZeroOf } from '../../src/net/townSeatLaw.js';
import {
  HALL_WITNESS_KIND, HALL_REPORT_V, STRENGTH_START, strengthAfter, strengthTarget, strengthSeasonEnd, chapterBandOf, meritWeekOf, hallHidden,
} from '../../src/net/npcChapterLaw.js';

/** The most weeks one read settles - a service asleep for longer starts its count again from there (the seats' own). */
export const CHAPTER_WEEKS_MAX = 8;
/** Every region's chapters, kept by an isolate this long (npcHalls.js CHAPTERS_KEPT_MS's minute). */
export const ALL_CHAPTERS_KEPT_MS = 60_000;
/** @type {{ at: number, chapters: { faction: number, region: number }[] } | null} */
let _all = null;
/** For tests: forget the isolate's kept chapters. */
export const forgetAllChapters = () => { _all = null; };

/**
 * EVERY REGION'S CHAPTERS, `[{ faction, region }]`: one read of every hall report, each region's towns read as
 * npcHalls.js regionChapters reads them - every report of each town any report names the region for, its ignored
 * accounts left out, a town confirmed for this region. Kept by the isolate a minute.
 * @param {any} db @param {number} nowS
 */
export async function allChapters(db, nowS) {
  if (_all && nowS * 1000 - _all.at < ALL_CHAPTERS_KEPT_MS) return _all.chapters;
  const { results = [] } = await db.prepare(`SELECT key, account, report, region, at FROM world_witness WHERE kind = '${HALL_WITNESS_KIND}' AND key LIKE ?`)
    .bind(`${HALL_REPORT_V}:%`).all();
  /** @type {Map<string, { key: string, account: string, report: string, at: number }[]>} */
  const byKey = new Map();
  /** @type {Map<number, Set<string>>} */
  const keysOf = new Map();
  for (const r of results) {
    const row = { key: String(r.key), account: String(r.account), report: String(r.report), at: Number(r.at) };
    const list = byKey.get(row.key) ?? [];
    list.push(row);
    byKey.set(row.key, list);
    const g = Number(r.region);
    const keys = keysOf.get(g) ?? new Set();
    keys.add(row.key);
    keysOf.set(g, keys);
  }
  const out = [];
  for (const [g, keys] of keysOf) {
    const rows = [...keys].flatMap((k) => byKey.get(k) ?? []);
    const factions = new Set();
    for (const t of hallFacts(rows, nowS).towns) if (factConfirmed(t.fact) && t.fact.region === g) for (const f of t.fact.factions) factions.add(f);
    for (const f of factions) out.push({ faction: f, region: g });
  }
  out.sort((a, b) => a.region - b.region || a.faction - b.faction);
  _all = { at: nowS * 1000, chapters: out };
  return out;
}

/** The Turning that ends seat week `week`, in seconds. */
const turningOf = (/** @type {number} */ week) => Math.floor((seatWeekStartMs(week) + SEAT_WEEK_MS) / 1000);

/**
 * SETTLE WEEK `week`'S STRENGTH: each chapter's Strength moved by its week's Merit against the week's target
 * (npcChapterLaw.js strengthAfter), halfway back toward 50 where a Season ends with it (`zero`, the week Season 0 began,
 * or null). Answers `{ settled: true, chapters }` or `{ settled: false }` - settled first by another reader, or rolled
 * back (the next read settles it again).
 * @param {any} db @param {number} week @param {number} nowS @param {number | null} [zero]
 */
export async function settleChapterWeek(db, week, nowS, zero = null) {
  const turning = turningOf(week);
  const active = Number((await db.prepare('SELECT COUNT(*) AS n FROM players WHERE handle IS NOT NULL AND played_at >= ?1')
    .bind(turning - SEAT_WEEK_MS / 1000).first())?.n ?? 0);
  const target = strengthTarget(active);
  const { results: merits = [] } = await db.prepare('SELECT faction, region, SUM(amount) AS n FROM npc_chapter_merit WHERE week = ?1 GROUP BY faction, region')
    .bind(week).all();
  const { results: held = [] } = await db.prepare('SELECT faction, region, strength FROM npc_chapters').all();
  /** @type {Map<string, { faction: number, region: number, prev: number, merit: number }>} */
  const all = new Map();
  const at = (/** @type {number} */ f, /** @type {number} */ g) => {
    const k = `${f}|${g}`;
    if (!all.has(k)) all.set(k, { faction: f, region: g, prev: STRENGTH_START, merit: 0 });
    return /** @type {{ faction: number, region: number, prev: number, merit: number }} */ (all.get(k));
  };
  for (const c of await allChapters(db, nowS)) at(c.faction, c.region);
  for (const r of held) at(Number(r.faction), Number(r.region)).prev = Number(r.strength);
  for (const r of merits) at(Number(r.faction), Number(r.region)).merit = Number(r.n);
  const ends = seasonEndingAt(week, zero);
  const rows = [...all.values()].map((c) => {
    const s = strengthAfter(c.prev, c.merit, target);
    return [c.faction, c.region, ends ? strengthSeasonEnd(s) : s, c.merit];
  });
  try {
    await db.batch([
      db.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(week, active, target, rows.length, nowS),
      db.prepare(`INSERT INTO npc_chapters (faction, region, strength, week, merit, at)
        SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'), ?1, json_extract(value, '$[3]'), ?2
        FROM json_each(?3) WHERE true
        ON CONFLICT (faction, region) DO UPDATE SET strength = excluded.strength, week = excluded.week, merit = excluded.merit, at = excluded.at`)
        .bind(week, nowS, JSON.stringify(rows)),
    ]);
  } catch {
    return { settled: false };
  }
  return { settled: true, chapters: rows.length };
}

/**
 * THE CHAPTERS' TURNINGS DUE: every week before this one not yet settled, oldest first - from the week after the last
 * settled (or, on a service that has settled none, the last week alone), at most CHAPTER_WEEKS_MAX back; a week that
 * fails is the first the next read settles (the seats' settleDue, AUDIT-SEATS S1). Cheap when nothing is due: one read.
 * @param {any} db @param {number} nowS @param {number | null} [zero]
 */
export async function settleChaptersDue(db, nowS, zero = null) {
  const current = meritWeekOf(nowS);
  const last = (await db.prepare('SELECT MAX(week) AS w FROM npc_chapter_weeks').first())?.w;
  const from = Math.max(last == null ? current - 1 : Number(last) + 1, current - CHAPTER_WEEKS_MAX);
  let n = 0;
  for (let w = from; w < current; w++) {
    const r = await settleChapterWeek(db, w, nowS, zero);
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
  await settleChaptersDue(db, nowS, seasonZeroOf(env?.SEASON_ZERO_WEEK));
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
