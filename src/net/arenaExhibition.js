// @ts-check
// ARENA4b (2026-10-03, the audit of ARENA4 against bible/11-Multiplayer/Arena.md 2 - "Exhibition - online: yes - the
// relay runs it, every client sees one bout"; the ARENA2 record - "ARENA4's relay runs the schedule on the shared
// clock"): THE HOUR'S EXHIBITION AS LAW - the one home of the schedule the game runs offline (systems/arenaLadder.js
// re-exports it, so every reader there reads it as it always did) and the relay runs online (net/arenaBrain.js openBout,
// server/src/index.js `arena:x<hour>`): the hours, the window, the draw of the hour's pair, the bout's id.
//
//   THE SCHEDULE  a bout on each hour of the gates' hours (08:00-21:00), its call at the hour's minute 0, open (may still
//                 begin) for its first EXHIBITION_START_MINUTES; the pair drawn from the hour (`exhibitionFor`) - the same
//                 hour is the same bout on every screen and on the relay.
//   THE ROOM      `arena:x<hour>` (net/arenaLaw.js arenaExhibitionRoom) - opened by its first watcher inside the window
//                 (`exhibitionOpening`), its bout's id the hour's seed and the hour (`exhibitionBoutId`), so the relay's
//                 fighters are named on every screen by the seed the offline bout names them by.
//
// PURE - the clock (game minutes) handed in. It imports the ladder's table (net/arenaLaw.js - the game's own ladder is
// pinned to it row for row) and the port's one seeded die (systems/wind.js seededRng); both import nothing.
//
// Not a DFU member. Ledger A (ARENA).
import { seededRng } from '../systems/wind.js';   // the port's one seeded die (mulberry32) - one home
import { ARENA_LADDER_SPEC, ARENA_BEAST_TIER, ARENA_TIER_BOUTS } from './arenaLaw.js';

/** The schedule: a bout on each hour of the game's clock, its call at the hour's minute 0, and the last minute of the
 *  hour by which it may still begin (a player who comes later waits for the next hour). */
export const EXHIBITION_START_MINUTES = 20;
/** The hours an exhibition is fought (Daggerfall's day: the gates shut at night - from 22:00 to 08:00 nothing). */
export const EXHIBITION_HOURS = Object.freeze([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
/** The schedule's seed - one constant, so the relay's schedule is the client's. */
export const ARENA_SEED = 0x41524e32;

/** A 32-bit mix (the market's xorshift family, systems/arenaMove.js) of a number and a salt. Pure. */
export function arenaHash(n, salt = 0) {
  let s = (Math.imul((n | 0) ^ ARENA_SEED, 0x9e3779b1) + Math.imul((salt | 0) + 1, 0x85ebca6b)) >>> 0 || 1;
  for (let i = 0; i < 4; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; }
  return s >>> 0;
}

/** The game hour an absolute game minute falls in (hour index since the epoch) and its minute of the day. */
export const hourIndexOf = (gameMinutes) => Math.floor(Math.max(0, Number(gameMinutes) || 0) / 60);
/**
 * THE EXHIBITION of the hour holding `gameMinutes` - `{ hour, seed, tier, opponents, startsAt, open }` - or null for an
 * hour the gates are shut. Two fighters out of one tier's roster (a beast against a beast in the beast tier) -
 * `{ mobile, level }` each, the ladder's table's (ARENA_LADDER_SPEC: systems/arenaLadder.js LADDER_TIERS row for row);
 * `open` whether it may still begin (its minute under EXHIBITION_START_MINUTES).
 */
export function exhibitionFor(gameMinutes) {
  const hour = hourIndexOf(gameMinutes);
  const hod = hour % 24;
  if (!EXHIBITION_HOURS.includes(hod)) return null;
  const seed = arenaHash(hour, 1);
  const rng = seededRng(seed);
  const tier = Math.floor(rng() * 8);   // the eight tiers whose bouts are one against one
  const pool = ARENA_LADDER_SPEC[tier].slice(0, ARENA_TIER_BOUTS).map((b) => ({ mobile: b[0][0], level: b[0][1] }));
  const i = Math.floor(rng() * pool.length);
  let j = Math.floor(rng() * (pool.length - 1));
  if (j >= i) j++;
  const minute = (Math.max(0, Number(gameMinutes) || 0)) - hour * 60;
  return { hour, seed, tier, opponents: [pool[i], pool[j]], startsAt: hour * 60, open: minute < EXHIBITION_START_MINUTES, beasts: tier === ARENA_BEAST_TIER };
}

/** ARENA4b: THE EXHIBITION'S BOUT ID on the relay - the hour's seed and the hour, eight hex each, so its seed
 *  (net/arenaBrain.js arenaBoutSeed - its first eight) is the seed the offline bout names its fighters by. Pure. */
export const exhibitionBoutId = (hour) => arenaHash(hour, 1).toString(16).padStart(8, '0') + ((Math.floor(Number(hour) || 0) >>> 0).toString(16).padStart(8, '0'));
/**
 * ARENA4b: THE EXHIBITION THE RELAY MAY OPEN for the room of `hour` at the shared clock's `nowMinutes` (net/wire.js
 * sharedClassicMinutes): the hour's own (the clock in it), the gates open (one of EXHIBITION_HOURS), and still open
 * (its first EXHIBITION_START_MINUTES) - else null: no watcher opens an hour that is not now, nor one past its window.
 * Pure.
 */
export function exhibitionOpening(hour, nowMinutes) {
  if (!Number.isSafeInteger(hour) || hourIndexOf(nowMinutes) !== hour) return null;
  const ex = exhibitionFor(nowMinutes);
  return ex && ex.open ? ex : null;
}
/** ARENA4b: the hours a room of the exhibition stands for on the Worker's door - the hour now, the one before (a bout
 *  that runs past its hour) and, for its kept verdict, the game day before that (net/arenaLaw.js ARENA_EX_KEEP_MS); one
 *  hour ahead for a clock a breath fast. Pure. */
export const EXHIBITION_KEPT_HOURS = 24;
export const exhibitionAdmits = (hour, nowMinutes) => { const now = hourIndexOf(nowMinutes); return Number.isSafeInteger(hour) && hour >= now - EXHIBITION_KEPT_HOURS - 1 && hour <= now + 1; };
