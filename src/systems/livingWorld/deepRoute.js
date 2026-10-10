// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW14 (2026-10-09, bible/06-Systems/Living-World-II.md "LW14"): THE DIVE'S ROUTE - where a company is inside the
// dungeon it went down into, minute by minute, and what it leaves behind. Mac: "smarter and more dungeon diving npcs".
// Pure over the dungeon's own data (its blocks' markers, as the dungeon's build reads them - so only while the player is
// in it; the trips need none of it) and the dive (trips.js diveTrip): every reader's company works the same rooms in
// the same order at the same minutes.
//
//  - THE STOPS (`stopsOf`): the dungeon's random foe markers (editor record 15) and random treasure markers (19) -
//    never a fixed foe (16), a quest's marker (11, 18) or fixed treasure (archive 216) - in the order a company works
//    them: from the start marker's block, the blocks breadth first by their grid (a block joins its four neighbours),
//    within each block nearest first from where they came in.
//  - THE TIMELINE (`routeOf`): the dive's hours inside spent at the stops - a foe's DEEP_FOE_MIN by its seed, a
//    treasure's DEEP_TREASURE_MIN - the walk between them DEEP_DETOUR times the floor distance at DEEP_WALK_M a minute;
//    the stops left by the dive's middle are its REACH; then THE WAY OUT, the same stops back to the start by the
//    dive's end. DEEP_RISK of dives meet a fight of the deep's at a stop of the seed's (`deepFightOf`) - always won,
//    only the fated die (the lives' law) - its DEEP_FIGHT_MIN that stop's own.
//  - WHERE THEY ARE (`stopAt`): at a stop (fighting at a foe's), between two, on the way out, or gone.
//  - WHAT THEY LEAVE (`clearedOf`): the stops a dive left within DIVE_CLEAR_MIN before a minute - its foes built dead
//    and emptied, its treasure built empty (decision 3).
import { lwSeed, lwRng, textSeed, rollInt } from './seed.js';
import { DAY_MIN } from './dayPlan.js';

/** The markers that are stops: the editor's random foe and random treasure (archive 199's records). */
export const STOP_FOE = 15;
export const STOP_TREASURE = 19;
/** Minutes at a stop: a foe's (by its seed), a treasure's. */
export const DEEP_FOE_MIN = Object.freeze([25, 40]);
export const DEEP_TREASURE_MIN = 10;
/** The walk inside: the floor distance times DEEP_DETOUR (corridors are not straight), at DEEP_WALK_M a minute. */
export const DEEP_DETOUR = 1.6;
export const DEEP_WALK_M = 30;
/** Of the dives with no fated death, the share that meet a fight of the deep's at a stop - and its minutes. */
export const DEEP_RISK = 0.5;
export const DEEP_FIGHT_MIN = 20;
/** What a dive passed stands cleared this long after (a day of the clock). */
export const DIVE_CLEAR_MIN = DAY_MIN;
const DEEP = 0x64656570;   // 'deep'

/**
 * @typedef {{ key: string, kind: 'foe'|'treasure', x: number, y: number, z: number, block: number, loadID: number }} Stop -
 *   the dungeon's frame; `key` `<block>:<marker position>`, `loadID` the marker's own (a foe's identity)
 * @typedef {{ stop: Stop, tIn: number, tOut: number, fight: boolean }} Leg
 * @typedef {{ legs: Leg[], entry: { x: number, z: number }, out: { t0: number, t1: number, path: { x: number, z: number, y?: number }[] }, t0: number }} Route
 */

/**
 * THE STOPS of a dungeon in the order a company works them. `blocks` the dungeon's (`{ originX, originZ, layout: {
 * markers } }`), `side` a block's side (the grid), `entry` the start marker (the dungeon's frame; none: the first block's).
 * @param {{ originX: number, originZ: number, layout: { markers: any[] } }[]} blocks @param {number} side
 * @param {{ x: number, z: number } | null} [entry]
 * @returns {Stop[]}
 */
export function stopsOf(blocks, side, entry = null) {
  const grid = blocks.map((b) => ({ gx: Math.round(b.originX / side), gz: Math.round(b.originZ / side) }));
  const inBlock = blocks.map((b, bi) => (b.layout?.markers ?? [])
    .filter((m) => !m.archive && (m.record === STOP_FOE || m.record === STOP_TREASURE))
    .map((m) => /** @type {Stop} */ ({ key: `${bi}:${m.position}`, kind: m.record === STOP_FOE ? 'foe' : 'treasure', x: m.x + b.originX, y: m.y, z: m.z + b.originZ, block: bi, loadID: m.loadID ?? 0 })));
  if (!blocks.length) return [];
  const from = entry ?? { x: blocks[0].originX + side / 2, z: blocks[0].originZ + side / 2 };
  let first = blocks.findIndex((b) => from.x >= b.originX && from.x < b.originX + side && from.z >= b.originZ && from.z < b.originZ + side);
  if (first < 0) first = 0;
  // the blocks breadth first by the grid, a block's neighbours east, west, south, north
  const order = [first];
  const seen = new Set(order);
  for (let i = 0; i < order.length; i++) {
    const g = grid[order[i]];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = grid.findIndex((q, k) => !seen.has(k) && q.gx === g.gx + dx && q.gz === g.gz + dz);
      if (j >= 0) { seen.add(j); order.push(j); }
    }
  }
  for (let k = 0; k < blocks.length; k++) if (!seen.has(k)) order.push(k);   // a block the grid does not join, last
  /** @type {Stop[]} */
  const out = [];
  let at = from;
  for (const bi of order) {
    const left = [...inBlock[bi]];
    while (left.length) {
      let best = 0;
      for (let i = 1; i < left.length; i++) {
        const d = Math.hypot(left[i].x - at.x, left[i].z - at.z) - Math.hypot(left[best].x - at.x, left[best].z - at.z);
        if (d < -1e-9 || (Math.abs(d) <= 1e-9 && left[i].key < left[best].key)) best = i;
      }
      const s = left.splice(best, 1)[0];
      out.push(s);
      at = s;
    }
  }
  return out;
}

/** The deep's fight of a dive with no fated death: the index among its foe stops' reach fraction, or null (none).
 *  @param {any} trip */
export function deepFightOf(trip) {
  if (trip.enc) return null;   // a fated trouble is the dive's own (trouble.js diveTrouble)
  const rng = lwRng(textSeed(trip.id), DEEP);
  return rng() < DEEP_RISK ? rng() : null;
}

/** A stop's minutes: a foe's by its seed, a treasure's. @param {Stop} s */
export const stopDwellOf = (s) => (s.kind === 'foe' ? rollInt(lwRng(textSeed(s.key), DEEP), DEEP_FOE_MIN[0], DEEP_FOE_MIN[1]) : DEEP_TREASURE_MIN);
const walkMin = (a, b) => (Math.hypot(a.x - b.x, a.z - b.z) * DEEP_DETOUR) / DEEP_WALK_M;

/**
 * THE TIMELINE of a dive over a dungeon's stops: its reach (each stop's minute in and out, the deep's fight's stop
 * the longer) and its way out. `trip.dive` its hours inside.
 * @param {Stop[]} stops @param {{ x: number, z: number }} entry @param {any} trip @returns {Route | null}
 */
export function routeOf(stops, entry, trip) {
  const dive = trip?.dive;
  if (!dive) return null;
  const mid = dive.t0 + (dive.t1 - dive.t0) / 2;
  const fightAt = deepFightOf(trip);
  /** @type {Leg[]} */
  const legs = [];
  let t = dive.t0, at = entry;
  for (const s of stops) {
    const tIn = t + walkMin(at, s);
    if (tIn > mid) break;
    const tOut = tIn + stopDwellOf(s);
    if (tOut > mid) break;
    legs.push({ stop: s, tIn, tOut, fight: s.kind === 'foe' });
    t = tOut; at = s;
  }
  // the deep's fight: a foe stop of the reach, by the seed - its minutes that stop's own, the rest of the reach after it
  if (fightAt != null) {
    const foes = legs.map((l, i) => (l.stop.kind === 'foe' ? i : -1)).filter((i) => i >= 0);
    if (foes.length) {
      const i = foes[Math.min(foes.length - 1, Math.floor(fightAt * foes.length))];
      legs[i].tOut += DEEP_FIGHT_MIN;
      for (let j = i + 1; j < legs.length; j++) { legs[j].tIn += DEEP_FIGHT_MIN; legs[j].tOut += DEEP_FIGHT_MIN; }
      while (legs.length && legs[legs.length - 1].tOut > mid + DEEP_FIGHT_MIN) legs.pop();
    }
  }
  const yOf = (/** @type {any} */ o) => (Number.isFinite(o?.y) ? { y: o.y } : {});   // AUDIT LW-II D7: each point its floor, where known
  const path = [...legs.map((l) => ({ x: l.stop.x, z: l.stop.z, ...yOf(l.stop) })).reverse(), { x: entry.x, z: entry.z, ...yOf(entry) }];
  let back = 0;
  for (let i = 1; i < path.length; i++) back += walkMin(path[i - 1], path[i]);
  const last = legs.length ? legs[legs.length - 1].tOut : dive.t0;
  const outT0 = Math.min(Math.max(last, dive.t1 - back), dive.t1);
  return { legs, entry: { x: entry.x, z: entry.z }, out: { t0: outT0, t1: dive.t1, path }, t0: dive.t0 };
}

/**
 * WHERE THEY ARE at minute `t`: `{ at, fighting }` at a stop (fighting at a foe's), `{ between: [a, b], f }` walking
 * (`f` the share walked), `{ out: { x, z } }` on the way out, or null (not inside).
 * @param {Route | null} route @param {number} t
 */
export function stopAt(route, t) {
  if (!route || t < route.t0 || t >= route.out.t1) return null;
  let prev = /** @type {{ x: number, z: number }} */ (route.entry), prevT = route.t0;
  for (const l of route.legs) {
    if (t < l.tIn) return { between: [prev, l.stop], f: (t - prevT) / Math.max(1e-9, l.tIn - prevT) };
    if (t < l.tOut) return { at: l.stop, fighting: l.fight };
    prev = l.stop; prevT = l.tOut;
  }
  if (t < route.out.t0) return { at: route.legs.length ? route.legs[route.legs.length - 1].stop : null, fighting: false, resting: true };
  // the way out: along the path at the share of its minutes walked
  const p = route.out.path;
  const seg = [];
  let total = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); seg.push(d); total += d; }
  let goal = total * ((t - route.out.t0) / Math.max(1e-9, route.out.t1 - route.out.t0));
  for (let i = 0; i < seg.length; i++) {
    if (goal <= seg[i]) { const f = seg[i] ? goal / seg[i] : 0, y = p[i + 1].y ?? p[i].y; return { out: { x: p[i].x + (p[i + 1].x - p[i].x) * f, z: p[i].z + (p[i + 1].z - p[i].z) * f, ...(y != null ? { y } : {}) } }; }
    goal -= seg[i];
  }
  const last = p[p.length - 1];
  return { out: { x: last.x, z: last.z, ...(last.y != null ? { y: last.y } : {}) } };
}

/** A route's point at `t` (the dungeon's frame), or null. @param {Route | null} route @param {number} t */
export function pointAt(route, t) {
  const s = stopAt(route, t);
  if (!s) return null;
  if (s.at) return { x: s.at.x, z: s.at.z, y: s.at.y };
  if (s.between) { const [a, b] = s.between; return { x: a.x + (b.x - a.x) * s.f, z: a.z + (b.z - a.z) * s.f, y: /** @type {any} */ (b).y }; }
  return s.out ? { x: s.out.x, z: s.out.z, y: s.out.y } : null;
}

/**
 * WHAT THEY LEFT: the stops the dives (each its route) left within DIVE_CLEAR_MIN before minute `t` - the foes built
 * dead and emptied, the treasure built empty. A stop a company is at now is being fought, not cleared.
 * @param {(Route | null)[]} routes @param {number} t @returns {Set<string>}
 */
export function clearedOf(routes, t) {
  const out = new Set();
  for (const r of routes) for (const l of r?.legs ?? []) if (l.tOut <= t && t - l.tOut < DIVE_CLEAR_MIN) out.add(l.stop.key);
  return out;
}

/**
 * THE DICE'S END, WHERE IT FELL: the stop a dive's fated trouble (its `enc.t0`) falls at - the one they are at, or the
 * nearer of the two they walk between; null with no route or no stop.
 * @param {Route | null} route @param {number} t @returns {Stop | null}
 */
export function stopOfMinute(route, t) {
  const s = stopAt(route, t);
  if (!s) return route?.legs.length ? route.legs[route.legs.length - 1].stop : null;
  if (s.at) return s.at;
  if (s.between) { const b = /** @type {any} */ (s.between[1]); const a = /** @type {any} */ (s.between[0]); return s.f >= 0.5 || !a.key ? b : a; }
  return route?.legs.length ? route.legs[route.legs.length - 1].stop : null;
}

/** A seed for a company's sound at a stop (a beat of its own). @param {string} id */
export const fightBeat = (id) => (lwSeed(textSeed(id), DEEP) % 1000) / 1000;
