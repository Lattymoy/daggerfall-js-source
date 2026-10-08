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
import { seatWeekStartMs, SEAT_WEEK_MS, seasonEndingAt, seasonZeroOf } from '../../src/net/townSeatLaw.js';
import {
  STRENGTH_START, strengthAfter, strengthTarget, strengthSeasonEnd, chapterBandOf, meritWeekOf, hallHidden, chaptersSwitchOf,
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
  try {
    await db.batch([
      db.prepare('INSERT INTO npc_chapter_weeks (week, active, target, chapters, open, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)').bind(week, active, target, rows.length, open, nowS),
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
