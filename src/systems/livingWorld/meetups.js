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
// crowd mills. A circle says its script a line every CREW_LINE_S (the crew's own beat), the first speaker first, then
// each in turn.
//
// LW-TALK (2026-10-06, Mac: "I want to ensure everything is working with NPCs actually interacting with each other,
// talking"): A ROUND IS A MEETING. The first cut's forty-second rounds re-dealt a busy square three times a minute (76-92%
// of its people had a new partner every round, walking up to 30 m to reach them), started every circle's script at the
// round's first minute - while its people were still walking to one another (22-84% of the lines heard, by hour and
// town) - and every spot's on the same minute (ten lines in one frame, then half a minute of silence). Now a round is
// two minutes on each spot's own phase; a circle's talk waits for its people to gather (`from`, the host's: the walk from
// where the last round stood them); and it talks in EXCHANGES (`exchangeAt`): a script, a pause, another, each on the
// circle's own draws, the opener turning, never the same script twice running, each script fixed as its exchange begins
// (the hour it began; the reader's `memo` keeps the rest - a change of weather mid-script swapped it in 916 of 2000).
//
// WHERE THEY STAND (`circleStands`): each circle about a point of the spot - the circles round the spot's centre on
// the golden angle, outward as they number - its people facing in toward one another; one alone stands at a place of
// their own about the spot. LW-SPACE (2026-10-06, Mac: "I notice NPCs and walk stuck inside each other"): NONE ON
// ANOTHER - a round's circles at a spot laid together (`circlesStands`), and those alone at it each SPACE_M from every
// place taken before them (`aloneStands`).
import { CREW_LINE_S } from '../naval/crewLife.js';   // the crew's beat: one export, read here
import { lwSeed, textSeed } from './seed.js';
import { pickScript, fillLine, firstNameOf, newsScript } from './lines.js';

/** A round at a spot - a meeting - in the reader's real seconds (the host lays it on the clock). LW-TALK: two minutes
 *  (the first cut's 40 s re-dealt the square three times a minute). */
export const ROUND_S = 120;
/** LW-TALK: A MEETING'S TALK. Its people gather first - the host's walk from where the last round stood them, and
 *  GATHER_BEAT_S after (`from`) - then talk in EXCHANGES: a script a slot of SLOT_LINES lines' time (a shorter one's tail
 *  silent), the first OPEN_S into the talk and each next PAUSE_S after the last, on the circle's own draws, so the
 *  spots and the circles never speak in one breath; none begun that the round's end would cut short (CLOSE_S). A slot is
 *  spoken TALK_SHARE of the time, else a quiet spell (the first cut stood whole circles quiet a whole round). */
export const GATHER_BEAT_S = 1.5;
export const OPEN_S = Object.freeze([0, 6]);
export const PAUSE_S = Object.freeze([5, 15]);
export const SLOT_LINES = 4;
export const CLOSE_S = 3;
export const TALK_SHARE = 0.75;
/** How far apart two of a circle stand (m), and how far the circles stand out from the spot's centre (m). */
export const CIRCLE_APART = 1.25;
export const CIRCLE_OUT = 1.6;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** @typedef {{ id: string, name: string, job: string }} Talker */
/** @typedef {{ members: Talker[], seed: number, start: number, end: number, from?: number, index: number }} Circle - `from`
 *  LW-TALK the minute its talk may begin (its people gathered; the round's start where nobody walks) */

/**
 * LW-TALK: the round holding minute `t` at the spot `spotKey` - each spot's rounds on a phase of its own, drawn from
 * its key (every spot's began on one minute, and its talk with it).
 * @param {string} spotKey @param {number} t @param {number} roundMin @returns {{ round: number, start: number, end: number }}
 */
export function spotRound(spotKey, t, roundMin) {
  const phase = ((textSeed(spotKey) >>> 7) % 1000) / 1000 * roundMin;
  const round = Math.floor((t + phase) / roundMin);
  const start = round * roundMin - phase;
  return { round, start, end: start + roundMin };
}

/**
 * The circles at one spot for the round holding minute `t`. `present` - those standing at the spot, each with the stay
 * that holds them there (`t0`, `t1`, the clock's minutes); `roundMin` the round on the clock. Each circle's talk may
 * begin GATHER_BEAT_S into the round (`from`) - the host moves it on by its people's walk to their places.
 * @template {Talker} T
 * @param {string} spotKey @param {readonly { who: T, t0: number, t1: number }[]} present @param {number} t @param {number} roundMin
 * @returns {Circle[]}
 */
export function spotCircles(spotKey, present, t, roundMin) {
  if (!(roundMin > 0)) return [];
  const { round, start, end } = spotRound(spotKey, t, roundMin);
  return dealCircles(spotKey, present.filter((p) => p.t0 <= start && p.t1 >= end).map((p) => p.who), round, start, end, GATHER_BEAT_S * roundMin / ROUND_S);
}

/**
 * The DEAL: `who` paired off for a round in an order drawn from the key, the round and each one's id - two by two, the
 * odd three together, one alone none. LW-TALK: the rooms deal their tables on it (scenes/livingIndoors.js).
 * @template {Talker} T
 * @param {string} key @param {readonly T[]} who @param {number} round @param {number} start @param {number} end @param {number} beatMin - `from` after `start`
 * @returns {Circle[]}
 */
export function dealCircles(key, who, round, start, end, beatMin) {
  const spot = textSeed(key);
  const here = who.map((w) => ({ w, k: lwSeed(spot, round, textSeed(w.id)) }))
    .sort((a, b) => a.k - b.k || (a.w.id < b.w.id ? -1 : 1))
    .map((e) => e.w);
  /** @type {Circle[]} */
  const out = [];
  let i = 0;
  while (here.length - i >= 2) {
    const n = here.length - i === 3 ? 3 : 2;
    const members = here.slice(i, i + n);
    i += n;
    const seed = lwSeed(spot, round, ...members.map((m) => textSeed(m.id)));
    out.push({ members, seed, start, end, from: start + beatMin, index: out.length });
  }
  return out;
}

/** LW-TALK: a draw of the circle's own in the span [lo, hi). @param {number} seed @param {readonly number[]} span @param {...number} salt */
const drawIn = (seed, [lo, hi], ...salt) => lo + (lwSeed(seed, ...salt) % 1000) / 1000 * (hi - lo);
/** LW-TALK: each circle's slots, kept while it is (a circle is the round's, read every line). */
const slotsKept = new WeakMap();

/**
 * LW-TALK: A CIRCLE'S EXCHANGES - when each slot begins, from its talk's `from` (its people gathered): the first OPEN_S
 * in, each next a slot and PAUSE_S after the last, while one fits before the round's end and CLOSE_S. Pure: the
 * circle's seed lays them. @param {Circle} circle @param {number} lineMin @returns {readonly number[]}
 */
export function circleSlots(circle, lineMin) {
  const kept = slotsKept.get(circle);
  if (kept && kept.lineMin === lineMin) return kept.slots;
  const perS = lineMin / CREW_LINE_S, slot = SLOT_LINES * lineMin, close = circle.end - CLOSE_S * perS;
  const slots = [];
  for (let s = (circle.from ?? circle.start) + drawIn(circle.seed, OPEN_S, 0x6f70656e) * perS; s + slot <= close; s += slot + drawIn(circle.seed, PAUSE_S, 0x70617573, slots.length) * perS) slots.push(s);   // 'open', 'paus'
  slotsKept.set(circle, { lineMin, slots });
  return slots;
}

/**
 * LW-TALK: the exchange a circle is in at minute `t` - its slot and the minute it began - or null: gathering, between
 * two, or past the last the round holds. @param {Circle} circle @param {number} t @param {number} lineMin
 * @returns {{ k: number, s: number } | null}
 */
export function exchangeAt(circle, t, lineMin) {
  if (!circle || !(lineMin > 0) || t < (circle.from ?? circle.start) || t >= circle.end) return null;
  const slots = circleSlots(circle, lineMin), slot = SLOT_LINES * lineMin;
  for (let k = 0; k < slots.length && slots[k] <= t; k++) if (t < slots[k] + slot) return { k, s: slots[k] };
  return null;
}

/** LW-TALK: whether a circle's slot `k` is spoken (TALK_SHARE), else a quiet spell. @param {Circle} circle @param {number} k */
export const slotSpoken = (circle, k) => (lwSeed(circle.seed, k, 0x73706b6e) % 1000) / 1000 < TALK_SHARE;   // 'spkn'

/**
 * The line a circle is saying at minute `t`: the exchange's script (`exchangeScript`) a line every `lineMin` of the clock
 * from the exchange's start - LW-TALK: a dialogue, its opener (the slot's, turning: the `k`-th of them) saying its even
 * lines and the others answering in turn (lines.js: a third line is the opener's); in a gathering, a pause, a quiet
 * spell or past the script's last line, nothing.
 * @param {Circle} circle @param {number} t @param {number} lineMin
 * @param {{ town?: string, region?: string, place?: string, places?: readonly string[] | null, weather?: string|null, hour?: number, road?: 'walk'|'camp'|null,
 *   news?: readonly { kind: string, who: string, foe: string, place: string }[] | null, player?: string, room?: string|null }} [ctx] - LW7 `player` the
 *   character's name (a deed's news names them); LW8b `room` the building's kind, inside (lines.js roomKindOf); LW-TALK
 *   `places` the towns of the town's road ({place})
 * @param {Map<string, any> | null} [memo] - LW-TALK: the reader's own keep of each exchange's script
 * @returns {{ who: Talker, text: string, index: number, k: number } | null}
 */
export function circleLine(circle, t, lineMin, ctx = {}, memo = null) {
  const at = exchangeAt(circle, t, lineMin);
  if (!at || !slotSpoken(circle, at.k)) return null;
  const index = Math.floor((t - at.s) / lineMin);
  const { script, told } = exchangeScript(circle, at.k, lineMin, ctx, memo);
  if (index >= script.length) return null;
  const n = circle.members.length;
  const who = circle.members[(at.k + (index % 2 ? 1 + ((index - 1) >> 1) % (n - 1) : 0)) % n];
  const text = fillLine(script[index], {
    town: ctx.town, region: ctx.region, place: told ? told.item.place : placeOf(circle, at.k, ctx),
    a: firstNameOf(circle.members[at.k % n].name), b: firstNameOf(circle.members[(at.k + 1) % n].name),
    who: told ? firstNameOf(told.item.who) : null, foe: told ? told.item.foe : null, player: ctx.player,   // LW7: a deed's, a fight's turner
  });
  return { who, text, index, k: at.k };
}

/** LW-TALK: {place} - a town of the town's road, the exchange's draw (`ctx.places`), else the caller's own (`ctx.place`).
 *  The first cut never filled it in a town or a room: eight scripts always said "the next town". */
const placeOf = (/** @type {Circle} */ circle, /** @type {number} */ k, /** @type {any} */ ctx) => (ctx.places?.length ? ctx.places[lwSeed(circle.seed, k, 0x706c6163) % ctx.places.length] : ctx.place);   // 'plac'

/**
 * LW-TALK: THE EXCHANGE'S SCRIPT - drawn as it begins, and kept (`memo`) to its end: LW4's news of the road told now and
 * then (lines.js newsScript), else the meeting's own talk (pickScript: the opener's trade first, the reader's weather, the
 * hour the exchange began, the road's or the room's own); never the script the circle said last.
 * @param {Circle} circle @param {number} k @param {number} lineMin @param {any} ctx @param {Map<string, any> | null} memo
 * @returns {{ script: readonly string[], told: { item: any, script: readonly string[] } | null }}
 */
export function exchangeScript(circle, k, lineMin, ctx, memo) {
  const key = `${circle.seed}:${k}`;
  const kept = memo?.get(key);
  if (kept) return kept;
  const slots = circleSlots(circle, lineMin);
  const s = slots[k] ?? (circle.from ?? circle.start);
  const hour = Math.floor((((s % 1440) + 1440) % 1440) / 60);
  const n = circle.members.length;
  const jobs = circle.members.map((_, i) => circle.members[(k + i) % n].job);
  let j = k - 1;
  while (j >= 0 && !slotSpoken(circle, j)) j--;   // the last exchange said - a quiet spell between is no new start
  const last = j >= 0 ? exchangeScript(circle, j, lineMin, ctx, memo).script : null;
  /** @type {{ script: readonly string[], told: any }} */
  let got = { script: [], told: null };
  for (let i = 0; i < 4; i++) {
    const seed = lwSeed(circle.seed, k, i);
    const told = ctx.road ? null : newsScript(seed, ctx.news);
    got = { script: told ? told.script : pickScript(seed, { jobs, weather: ctx.weather ?? null, hour, road: ctx.road ?? null, room: ctx.room ?? null }), told };   // LW8b: a room's own talk
    if (got.script !== last) break;
  }
  memo?.set(key, got);
  return got;
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

/** LW-SPACE: how far apart two people standing at a spot keep (m) - a body's breadth (places.js STAND_REACH_M either side
 *  of its middle) and a hand more; a circle's own stand CIRCLE_APART apart. */
export const SPACE_M = 0.9;
/** LW-SPACE: the steps one alone's place is looked for in about the spot when their own is taken (m out or in, and m of
 *  arc), and the farthest out it is looked for (m). */
export const SPACE_STEP_M = 0.45;
export const SPACE_FAR_M = 12;

/**
 * LW-SPACE: THE PLACES OF THOSE ALONE AT A SPOT, none on another nor on a circle - each one's own place (`aloneStand`)
 * where it keeps SPACE_M from every place already taken (`taken`: the circles' people, and those alone before them in
 * `ids`' order - the earliest come first, so one already standing keeps their place as others come); else the nearest
 * place about the spot that does - at their own distance out and then a step nearer and farther by turns, on their own
 * bearing and then a step of arc either way by turns - held by the street and seen from the spot (`street.clear` from
 * it, as every stand at a spot is). The many alone at a busy spot stood on one another at their own places (drawn by
 * geometry, a bearing and a distance off their id: the birthday problem), and on the circles about it. None keeps the
 * space within SPACE_FAR_M: their own place. Pure: the spot, the street and who stands there - every reader alike.
 * @param {{ x: number, z: number, key?: string }} spot @param {readonly string[]} ids
 * @param {readonly { x: number, z: number }[]} taken @param {import('./places.js').Street} street
 * @returns {Map<string, { x: number, z: number, yaw: number }>}
 */
export function aloneStands(spot, ids, taken, street) {
  /** @type {Map<string, { x: number, z: number, yaw: number }>} */
  const out = new Map();
  const placed = [...taken];
  const free = (/** @type {number} */ x, /** @type {number} */ z) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= SPACE_M - 1e-6);
  for (const id of ids) {
    const own = aloneStand(spot, id, street);
    let got = free(own.x, own.z) ? own : null;
    const r0 = Math.hypot(own.x - spot.x, own.z - spot.z), b0 = Math.atan2(own.x - spot.x, own.z - spot.z);
    for (let k = 0; !got && k <= 2 * SPACE_FAR_M / SPACE_STEP_M; k++) {
      const r = r0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * SPACE_STEP_M;
      if (r < ALONE_NEED_M || r > SPACE_FAR_M) continue;
      const turns = Math.floor(Math.PI * r / SPACE_STEP_M);
      for (let j = 0; !got && j <= 2 * turns; j++) {
        const b = b0 + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * (SPACE_STEP_M / r);
        const x = spot.x + Math.sin(b) * r, z = spot.z + Math.cos(b) * r;
        if (free(x, z) && street.clear(spot.x, spot.z, x, z)) got = { x, z, yaw: b + Math.PI };
      }
    }
    got ??= own;
    out.set(id, got);
    placed.push(got);
  }
  return out;
}

/** LW-SPACE: the turns a circle moved off its own middle tries about the new one (a twelfth of a half-turn at a time,
 *  either way by turns, as `circleStands` turns it to fit). */
const SPACE_TURNS = Object.freeze([0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6].map((k) => k * Math.PI / 12));

/**
 * LW-SPACE: THE CIRCLES OF A ROUND AT A SPOT, none on another - each circle at its own places (`circleStands`) where
 * every one of them keeps SPACE_M from every place a circle before it in the deal's order took; else about the nearest
 * middle whose places do - from its own middle a step out or in and a step of arc either way by turns, each tried turned
 * about it as `circleStands` turns one to fit - every place on the street and seen from the spot, its people a pace
 * apart facing their middle. Drawn one by one off the spot's bearings, two circles in a lane (whose few open bearings
 * every circle there is turned onto) stood inside each other. None found within SPACE_FAR_M, its own. Read-only: kept
 * per spot and the round's circles' sizes (where a circle stands is its index and its size alone). Pure.
 * @param {{ x: number, z: number, key?: string }} spot @param {readonly { index: number, members: readonly any[] }[]} circles
 * @param {import('./places.js').Street} street
 * @returns {readonly (readonly { x: number, z: number, yaw: number }[])[]}
 */
export function circlesStands(spot, circles, street) {
  const kept = keptOf(street).stands;
  const key = `${spotKeyOf(spot)}|L${circles.map((c) => `${c.index}.${c.members.length}`).join(',')}`;
  const known = kept.get(key);
  if (known) return known;
  /** @type {{ x: number, z: number }[]} */
  const placed = [];
  const free = (/** @type {number} */ x, /** @type {number} */ z) => placed.every((p) => Math.hypot(p.x - x, p.z - z) >= SPACE_M - 1e-6);
  const out = circles.map((c) => {
    let got = /** @type {readonly { x: number, z: number, yaw: number }[] | null} */ (circleStands(spot, c, street));
    if (!got.every((p) => free(p.x, p.z))) {
      const own = got, mid = circleMiddle(spot, c, street), n = c.members.length, half = CIRCLE_APART / 2;
      const r0 = Math.hypot(mid.x - spot.x, mid.z - spot.z), b0 = Math.atan2(mid.x - spot.x, mid.z - spot.z);
      got = null;
      for (let k = 0; !got && k <= 2 * SPACE_FAR_M / SPACE_STEP_M; k++) {
        const r = r0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * SPACE_STEP_M;
        if (r < half + ALONE_NEED_M || r > SPACE_FAR_M) continue;
        const arcs = Math.floor(Math.PI * r / SPACE_STEP_M);
        for (let j = 0; !got && j <= 2 * arcs; j++) {
          const b = b0 + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * (SPACE_STEP_M / r);
          const cx = spot.x + Math.sin(b) * r, cz = spot.z + Math.cos(b) * r;
          for (const turn of SPACE_TURNS) {
            const places = [];
            for (let i = 0; i < n; i++) {
              const bb = b + (i / n) * Math.PI * 2 + turn;
              const x = cx + Math.sin(bb) * half, z = cz + Math.cos(bb) * half;
              if (!free(x, z) || !street.clear(spot.x, spot.z, x, z)) break;
              places.push({ x, z, yaw: Math.atan2(cx - x, cz - z) });
            }
            if (places.length === n) { got = places; break; }
          }
        }
      }
      got ??= own;
    }
    placed.push(...got);
    return got;
  });
  kept.set(key, out);
  return out;
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
