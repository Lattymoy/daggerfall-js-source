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
 * the circle's middle). LW-STAND: with `street` (places.js streetGeometry), on the street - AUDIT LW-STAND: the
 * circle's middle on an open bearing of the spot with room for the circle (`circleMiddle`), and the circle turned
 * about it, a twelfth of a half-turn at a time, till every place in it is held and seen from the spot (before, each
 * place was pulled in along its own line, and two of a circle stood on one another, on its middle, facing north);
 * nowhere about it, its people along the way out to it, facing in. At a spot open all round, as drawn. Read-only: kept
 * per spot and circle (the street never changes under a town).
 * @param {{ x: number, z: number, key?: string }} spot @param {{ index: number, members: readonly any[] }} circle
 * @param {import('./places.js').Street|null} [street]
 * @returns {readonly { x: number, z: number, yaw: number }[]}
 */
export function circleStands(spot, circle, street = null) {
  const n = circle.members.length;
  const a = circle.index * GOLDEN;
  if (!street) {
    const c = circleMiddle(spot, circle);
    return circle.members.map((_, i) => {
      const b = a + (i / n) * Math.PI * 2;
      const x = c.x + Math.sin(b) * (CIRCLE_APART / 2), z = c.z + Math.cos(b) * (CIRCLE_APART / 2);
      return { x, z, yaw: Math.atan2(c.x - x, c.z - z) };
    });
  }
  const kept = keptOf(street).stands;
  const key = `${spotKeyOf(spot)}|c${circle.index}|${n}`;
  const known = kept.get(key);
  if (known) return known;
  const { b, rc, hold } = middleOf(spot, circle, street);
  const c = { x: spot.x + Math.sin(b) * rc, z: spot.z + Math.cos(b) * rc };
  /** @type {{ x: number, z: number, yaw: number }[] | null} */
  let got = null;
  for (let t = 0; t < 24 && !got; t++) {
    const turn = (t % 2 ? -1 : 1) * Math.ceil(t / 2) * (Math.PI / 12);
    const places = [];
    for (let i = 0; i < n; i++) {
      const bb = a + (b - a) + (i / n) * Math.PI * 2 + turn;
      const x = c.x + Math.sin(bb) * (CIRCLE_APART / 2), z = c.z + Math.cos(bb) * (CIRCLE_APART / 2);
      if (!street.clear(spot.x, spot.z, x, z)) break;
      places.push({ x, z, yaw: Math.atan2(c.x - x, c.z - z) });
    }
    if (places.length === n) got = places;
  }
  // nowhere about its middle: along the way out to it, a pace apart, each facing the middle (the one on it, the spot)
  got ??= circle.members.map((_, i) => {
    const d = Math.max(0, Math.min(hold - STAND_MARGIN_M, rc + (i - (n - 1) / 2) * CIRCLE_APART));
    return { x: spot.x + Math.sin(b) * d, z: spot.z + Math.cos(b) * d, yaw: d < rc ? b : b + Math.PI };
  });
  kept.set(key, got);
  return got;
}

/**
 * The middle of a circle, the point its people face in to: out from the spot's centre on the golden angle, further as
 * the circles number. LW-STAND: with `street`, on an open bearing of the spot that holds the circle (`openBearing`), as
 * far out as it holds it - a circle by a wall faces in to the street, never into the wall.
 * @param {{ x: number, z: number, key?: string }} spot @param {{ index: number }} circle
 * @param {import('./places.js').Street|null} [street]
 * @returns {{ x: number, z: number }}
 */
export function circleMiddle(spot, circle, street = null) {
  const a = circle.index * GOLDEN;
  if (!street) { const r = CIRCLE_OUT + 0.9 * circle.index; return { x: spot.x + Math.sin(a) * r, z: spot.z + Math.cos(a) * r }; }
  const { b, rc } = middleOf(spot, circle, street);
  return { x: spot.x + Math.sin(b) * rc, z: spot.z + Math.cos(b) * rc };
}

/** A circle's middle with a street: its bearing, how far out, and what that bearing holds. */
function middleOf(/** @type {{ x: number, z: number, key?: string }} */ spot, /** @type {{ index: number }} */ circle, /** @type {import('./places.js').Street} */ street) {
  const a = circle.index * GOLDEN;
  const r = CIRCLE_OUT + 0.9 * circle.index;
  const { b, hold } = openBearing(spot, street, a, CIRCLE_OUT + CIRCLE_APART);
  const rc = hold >= r + CIRCLE_APART / 2 ? r : Math.max(0, hold - CIRCLE_APART / 2 - STAND_MARGIN_M);
  return { b, rc, hold };
}

/**
 * Where one alone stands about the spot (their own place, from their id), facing it. LW-STAND: with `street`, on an open
 * bearing of the spot (`openBearing`, their share of the circle kept), as far out as their own and the bearing holds -
 * AUDIT LW-STAND: before, pulled in along their own line, and those whose lines met a wall stood on one another by the
 * spot. At a spot open all round, as drawn. Read-only: kept per spot and person.
 * @param {{ x: number, z: number, key?: string }} spot @param {string} id @param {import('./places.js').Street|null} [street]
 * @returns {{ x: number, z: number, yaw: number }}
 */
export function aloneStand(spot, id, street = null) {
  const k = textSeed(id);
  const a = (k % 3600) / 3600 * Math.PI * 2, r = ALONE_NEED_M + ((k >>> 12) % 1000) / 1000 * (ALONE_FAR_M - ALONE_NEED_M);
  if (!street) return { x: spot.x + Math.sin(a) * r, z: spot.z + Math.cos(a) * r, yaw: a + Math.PI };
  const kept = keptOf(street).stands;
  const key = `${spotKeyOf(spot)}|${id}`;
  const known = kept.get(key);
  if (known) return /** @type {{ x: number, z: number, yaw: number }} */ (known);
  // their own distance kept, on the bearings that hold it (to the half-metre over): drawn in along a bearing that held
  // less, the many whose bearings met the same wall stood on one another at its foot
  const { b, hold } = openBearing(spot, street, a, Math.ceil(r * 2) / 2);
  const rr = hold >= r ? r : Math.max(0, hold - STAND_MARGIN_M);
  const got = { x: spot.x + Math.sin(b) * rr, z: spot.z + Math.cos(b) * rr, yaw: b + Math.PI };
  kept.set(key, got);
  return got;
}

/** AUDIT LW-STAND: the bearings a spot's open ground is sounded along, the farthest it is sounded (m), how short of
 *  where its bearing stops a stand is kept (m), and the least a bearing holds for one alone to stand on it (m, their
 *  nearest - the circles', their middle out and a place beyond it). */
export const STAND_BEARINGS = 64;
export const STAND_SOUND_M = 16;
export const STAND_MARGIN_M = 0.05;
export const ALONE_NEED_M = 1;
/** The farthest one alone stands from their spot (m): their own place, 1 to 3.5 m out. */
export const ALONE_FAR_M = 3.5;

/** @type {WeakMap<object, { profiles: Map<string, { reach: Float64Array, open: Map<number, number[]> }>, stands: Map<string, any> }>} */
const keptBy = new WeakMap();
const keptOf = (/** @type {object} */ street) => { let k = keptBy.get(street); if (!k) keptBy.set(street, k = { profiles: new Map(), stands: new Map() }); return k; };
const spotKeyOf = (/** @type {{ x: number, z: number, key?: string }} */ spot) => spot.key ?? `${spot.x},${spot.z}`;

/**
 * AUDIT LW-STAND: THE OPEN GROUND ABOUT A SPOT. Its reach along each of STAND_BEARINGS bearings (the street's own,
 * places.js streetGeometry - how far out a body stands on it, to STAND_SOUND_M), sounded once a spot. A stand drawn at
 * bearing `a` stands on the bearings that hold at least `need`, its share of the whole circle kept - so the people
 * about a spot by a wall spread over its open half as they would over the whole circle - within its bearing's sector
 * all the way to the next when that one is open too, else toward the sector's middle; and what that bearing holds.
 * None holding `need`: the one that holds most. Open all round: `a` itself.
 * @param {{ x: number, z: number, key?: string }} spot @param {import('./places.js').Street} street @param {number} a @param {number} need
 * @returns {{ b: number, hold: number }}
 */
export function openBearing(spot, street, a, need) {
  const kept = keptOf(street).profiles;
  const sk = spotKeyOf(spot);
  let prof = kept.get(sk);
  if (!prof) {
    const reach = new Float64Array(STAND_BEARINGS);
    for (let i = 0; i < STAND_BEARINGS; i++) {
      const b = (i / STAND_BEARINGS) * Math.PI * 2;
      reach[i] = street.reach(spot.x, spot.z, spot.x + Math.sin(b) * STAND_SOUND_M, spot.z + Math.cos(b) * STAND_SOUND_M);
    }
    kept.set(sk, prof = { reach, open: new Map() });
  }
  let open = prof.open.get(need);
  if (!open) {
    open = [];
    for (let i = 0; i < STAND_BEARINGS; i++) if (prof.reach[i] >= need) open.push(i);
    if (!open.length) { let best = 0; for (let i = 1; i < STAND_BEARINGS; i++) if (prof.reach[i] > prof.reach[best]) best = i; open.push(best); }
    prof.open.set(need, open);
  }
  let b = a;
  if (open.length < STAND_BEARINGS) {
    const u = a / (Math.PI * 2) - Math.floor(a / (Math.PI * 2));
    const f = u * open.length, j = Math.min(open.length - 1, Math.floor(f));
    const i = open[j];
    const next = open[(j + 1) % open.length] === (i + 1) % STAND_BEARINGS;
    b = ((i + (f - j) * (next ? 1 : 0.5)) / STAND_BEARINGS) * Math.PI * 2;
  }
  const hold = street.reach(spot.x, spot.z, spot.x + Math.sin(b) * STAND_SOUND_M, spot.z + Math.cos(b) * STAND_SOUND_M);
  return { b, hold };
}
