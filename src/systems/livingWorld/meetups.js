// @ts-check
// LW1 (2026-10-04, bible/06-Systems/Living-World.md): THE MEETINGS - who talks with whom where the town gathers, and
// the line being said this moment, so every reader of a minute sees the same two heads together and the same words over
// them (LW0 decision 2).
//
// ROUNDS. Time at a spot runs in rounds of ROUND_S of the reader's real seconds, laid on the clock (`roundMin`, the
// clock's minutes in a round - the host's conversion); the residents standing at the spot for the WHOLE of a round
// (their outdoor stays, dayPlan.js) pair off for it in an order drawn from the spot, the round and each one's id - two
// by two, the odd three together, one alone keeps their own counsel. So the same faces meet again and again (a
// resident keeps to their two favourite spots, dayPlan.js `favourites`) and the pairs change round by round, as a
// crowd mills. Not every circle talks every round (TALK_SHARE). A talking circle says its script a line every
// CREW_LINE_S (the crew's own beat), the first speaker first, then each in turn; the script's last line said, it is
// quiet till the next round.
//
// WHERE THEY STAND (`circleStands`): each circle about a point of the spot - the circles round the spot's centre on
// the golden angle, outward as they number - its people facing in toward one another; one alone stands at a place of
// their own about the spot.
import { CREW_LINE_S } from '../naval/crewLife.js';   // the crew's beat: one export, read here
import { lwSeed, textSeed } from './seed.js';
import { pickScript, fillLine, firstNameOf, newsScript } from './lines.js';

/** A round at a spot, in the reader's real seconds (the host lays it on the clock). */
export const ROUND_S = 40;
/** The share of circles that talk in a round (the rest stand together quiet). */
export const TALK_SHARE = 0.7;
/** How far apart two of a circle stand (m), and how far the circles stand out from the spot's centre (m). */
export const CIRCLE_APART = 1.25;
export const CIRCLE_OUT = 1.6;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** @typedef {{ id: string, name: string, job: string }} Talker */
/** @typedef {{ members: Talker[], seed: number, start: number, end: number, talks: boolean, index: number }} Circle */

/**
 * The circles at one spot for the round holding minute `t`. `present` - those standing at the spot, each with the stay
 * that holds them there (`t0`, `t1`, the clock's minutes); `roundMin` the round on the clock.
 * @template {Talker} T
 * @param {string} spotKey @param {readonly { who: T, t0: number, t1: number }[]} present @param {number} t @param {number} roundMin
 * @returns {Circle[]}
 */
export function spotCircles(spotKey, present, t, roundMin) {
  if (!(roundMin > 0)) return [];
  const round = Math.floor(t / roundMin);
  const start = round * roundMin, end = start + roundMin;
  const spot = textSeed(spotKey);
  const here = present.filter((p) => p.t0 <= start && p.t1 >= end)
    .map((p) => ({ p, k: lwSeed(spot, round, textSeed(p.who.id)) }))
    .sort((a, b) => a.k - b.k || (a.p.who.id < b.p.who.id ? -1 : 1))
    .map((e) => e.p.who);
  /** @type {Circle[]} */
  const out = [];
  let i = 0;
  while (here.length - i >= 2) {
    const n = here.length - i === 3 ? 3 : 2;
    const members = here.slice(i, i + n);
    i += n;
    const seed = lwSeed(spot, round, ...members.map((m) => textSeed(m.id)));
    out.push({ members, seed, start, end, talks: (seed % 1000) / 1000 < TALK_SHARE, index: out.length });
  }
  return out;
}

/**
 * The line a circle is saying at minute `t`: its script (lines.js pickScript on the circle's seed, the speakers'
 * trades, the reader's weather and hour) a line every `lineMin` of the clock from the round's start, the first member
 * first and each in turn; between lines and after the last, nothing. LW4: a town meeting with `news` of the road to
 * tell (trips.js newsOf - `{ kind, who, foe, place }`, the foe a word) tells it NEWS_SHARE of the time instead.
 * @param {Circle} circle @param {number} t @param {number} lineMin
 * @param {{ town?: string, region?: string, place?: string, weather?: string|null, hour?: number, road?: 'walk'|'camp'|null,
 *   news?: readonly { kind: string, who: string, foe: string, place: string }[] | null, player?: string, room?: string|null }} [ctx] - LW7 `player` the
 *   character's name (a deed's news names them); LW8b `room` the building's kind, inside (lines.js roomKindOf)
 * @returns {{ who: Talker, text: string, index: number } | null}
 */
export function circleLine(circle, t, lineMin, ctx = {}) {
  if (!circle?.talks || !(lineMin > 0) || t < circle.start || t >= circle.end) return null;
  const index = Math.floor((t - circle.start) / lineMin);
  // LW4: the town's news of the road, told now and then (lines.js newsScript) - else the meeting's own talk
  const told = ctx.road ? null : newsScript(circle.seed, ctx.news);
  const script = told ? told.script : pickScript(circle.seed, { jobs: circle.members.map((m) => m.job), weather: ctx.weather ?? null, hour: ctx.hour ?? 12, road: ctx.road ?? null, room: ctx.room ?? null });   // LW8b: a room's own talk
  if (index >= script.length) return null;
  const who = circle.members[index % circle.members.length];
  const other = circle.members[(index + 1) % circle.members.length];
  const text = fillLine(script[index], {
    town: ctx.town, region: ctx.region, place: told ? told.item.place : ctx.place,
    a: firstNameOf(circle.members[0].name), b: firstNameOf(circle.members[1]?.name ?? other.name),
    who: told ? firstNameOf(told.item.who) : null, foe: told ? told.item.foe : null, player: ctx.player,   // LW7: a deed's, a fight's turner
  });
  return { who, text, index };
}

/** The clock's minutes in a span of the reader's real seconds, at `minutesPerSecond` (the clock's rate). */
export const clockMinutes = (seconds, minutesPerSecond) => seconds * minutesPerSecond;
/** The line's beat on the clock. @param {number} minutesPerSecond */
export const lineMinutes = (minutesPerSecond) => clockMinutes(CREW_LINE_S, minutesPerSecond);

/**
 * Where each of a circle stands about the spot's centre (`x`, `z`), and the way each faces (a world yaw, in toward
 * the circle).
 * @param {{ x: number, z: number }} spot @param {Circle} circle
 * @returns {{ x: number, z: number, yaw: number }[]}
 */
export function circleStands(spot, circle) {
  const a = circle.index * GOLDEN;
  const r = CIRCLE_OUT + 0.9 * circle.index;
  const cx = spot.x + Math.sin(a) * r, cz = spot.z + Math.cos(a) * r;
  const n = circle.members.length;
  return circle.members.map((_, i) => {
    const b = a + (i / n) * Math.PI * 2;
    const x = cx + Math.sin(b) * (CIRCLE_APART / 2), z = cz + Math.cos(b) * (CIRCLE_APART / 2);
    return { x, z, yaw: Math.atan2(cx - x, cz - z) };
  });
}

/** Where one alone stands about the spot (their own place, from their id). @param {{ x: number, z: number }} spot @param {string} id */
export function aloneStand(spot, id) {
  const k = textSeed(id);
  const a = (k % 3600) / 3600 * Math.PI * 2, r = 1 + ((k >>> 12) % 1000) / 1000 * 2.5;
  return { x: spot.x + Math.sin(a) * r, z: spot.z + Math.cos(a) * r, yaw: a + Math.PI };
}
