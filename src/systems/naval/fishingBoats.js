// @ts-check
// FISH-BOATS (2026-10-27; bible/03-World/Naval-Combat.md FISH-BOATS) - A PORT'S FISHING BOATS. Pure: a harbour's day's
// fleet, the water each lies and works in, her day's errand and her catch; scenes/naval/fishingFleet.js stands them.
// The boats are Come Sail Away's Rowboat pulled by two (a Fishing Skiff) and its Large Boat under sail (a Fishing Smack).
// The fleet is drawn off the harbour's key and the day, so every player in the port sees the same boats. Each lies at
// ANCHOR in the roads inside the mouth and works her GROUND off it. She puts out when the town's lanterns go out and
// comes home when they are lit. Not a DFU member: Daggerfall has no sea traffic. Ledger A (FISH-BOATS).
import { hash32 } from '../../world/spawnedDungeons.js';
import { mulberry32 } from '../../combat/blood/bloodArt.js';
import { keyHash } from './quays.js';
import { footprintClear, berthSize, REACH_M, ringOver } from './shipLife.js';
import { SWEEP_WAY } from './navalAI.js'; // her sweeps out on the way, as a merchantman's into a harbour

/** A harbour's boats a day (a draw in the range, never more than its anchorages hold). */
export const FISH_ROLL = Object.freeze([2, 4]);
export const FISH_SALT = 0xf15b;
/** The share of a port's boats that are smacks (the rest skiffs), each her seed's draw. */
export const FISH_SMACK_SHARE = 0.45;
/** The roads: an anchorage this share of the berths' depth in from the mouth (each tried in turn), and the next one of a
 *  side this far on (m). */
export const FISH_ROADS_IN = Object.freeze([0.75, 0.5, 1, 0.25]);
export const FISH_SPACING = 30;
/** An anchorage keeps this clear (m) of every berth's ship and of her way in from its approach - a ship coming in is
 *  never met by a boat lying in her lane. */
export const FISH_BERTH_CLEAR = 25;
/** Her ground (m) off the mouth, within this of the harbour's outward bearing (rad), tried this many times. */
export const FISH_GROUND_M = Object.freeze([450, 900]);
export const FISH_GROUND_SPREAD = Math.PI * 0.4;
export const FISH_TRIES = 10;
/** A ground is worked on a ring this wide (m), at this share of her way (the nets out). */
export const FISH_RING = 45;
export const FISH_STROKE = 0.4;
/** She is home within this of her anchorage (m), and moved off it past twice it. */
export const FISH_ANCHOR_M = 20;
/** Her catch, by class: the fish in her hold, a draw in the range. */
export const FISH_CATCH = Object.freeze({ fishingSkiff: Object.freeze([2, 6]), fishingSmack: Object.freeze([5, 12]) });
export const FISH_KINDS = Object.freeze(['anchor', 'fish', 'home']);

const TAU = Math.PI * 2;
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** A point's distance (m) from the segment `a`-`b`. */
function offSegment(p, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
/** Whether a point lies FISH_BERTH_CLEAR off every berth's ship (her length along her berth, the template's) and off
 *  her way in from its approach. */
export function clearOfBerths(p, harbour, length) {
  return harbour.berths.every((b) => {
    const fx = (Math.sin(b.yaw) * length) / 2,
      fz = (Math.cos(b.yaw) * length) / 2;
    return (
      offSegment(p, [b.pos[0] - fx, b.pos[1] - fz], [b.pos[0] + fx, b.pos[1] + fz]) >= FISH_BERTH_CLEAR &&
      offSegment(p, b.approach, b.pos) >= FISH_BERTH_CLEAR
    );
  });
}

/** Her own stream: her seed's, apart from her captain's and her errand's. */
const fishRng = (seed) => mulberry32(hash32(seed >>> 0, FISH_SALT));

/**
 * THE DAY'S FLEET of a harbour: `[{ i, seed, classId }]`, the same for every player in it - FISH_ROLL boats, each a smack
 * on FISH_SMACK_SHARE of her seed's draw, else a skiff.
 * @param {string} key @param {number} day
 */
export function fishersOf(key, day) {
  const r = mulberry32(hash32(keyHash(key), day >>> 0, FISH_SALT));
  const n = FISH_ROLL[0] + Math.floor(r() * (FISH_ROLL[1] - FISH_ROLL[0] + 1));
  const out = [];
  for (let i = 0; i < n; i++) {
    const seed = hash32(keyHash(key), day >>> 0, i, FISH_SALT);
    out.push({ i, seed, classId: fishRng(seed)() < FISH_SMACK_SHARE ? 'fishingSmack' : 'fishingSkiff' });
  }
  return out;
}

/** The harbour's outward bearing at its mouth: from its berths' middle to the mouth ([x, z], unit), else its first
 *  berth's own normal. */
export function harbourOutwardOf(harbour) {
  let x = 0,
    z = 0;
  for (const b of harbour.berths) {
    x += b.pos[0];
    z += b.pos[1];
  }
  x /= harbour.berths.length;
  z /= harbour.berths.length;
  const dx = harbour.mouth[0] - x,
    dz = harbour.mouth[1] - z,
    d = Math.hypot(dx, dz);
  return d > 1 ? [dx / d, dz / d] : [...harbour.berths[0].normal];
}

/** The berths' reach along the shore from the mouth (`u` the shore's way, unit): the least and the most of every berth's
 *  ship's ends and her approach, and how far in from the mouth her berth lies on the mean (`n` outward). */
export function berthSpan(harbour, n, u, length) {
  const m = harbour.mouth;
  const on = (p, w) => (p[0] - m[0]) * w[0] + (p[1] - m[1]) * w[1];
  let lo = Infinity,
    hi = -Infinity,
    depth = 0;
  for (const b of harbour.berths) {
    const fx = (Math.sin(b.yaw) * length) / 2,
      fz = (Math.cos(b.yaw) * length) / 2;
    for (const p of [[b.pos[0] - fx, b.pos[1] - fz], [b.pos[0] + fx, b.pos[1] + fz], b.approach]) {
      const a = on(p, u);
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    depth -= on(b.pos, n);
  }
  return { lo, hi, depth: depth / harbour.berths.length };
}

/**
 * THE WATER SHE KEEPS: her ANCHORAGE past the berths' ends along the shore (slot `i`, a side each, FISH_SPACING on),
 * FISH_BERTH_CLEAR off every berth and its lane, at the depths FISH_ROADS_IN tries, afloat and reached from the mouth
 * (`grid.path`); and her GROUND off the mouth within FISH_GROUND_SPREAD of its outward bearing, open water to it
 * (`grid.clear`). `{ anchor: [x, z], yaw, ground: [x, z] }`, or null where the harbour keeps no room.
 * @param {{ harbour: any, i: number, seed: number, hull: number, isWater: (x: number, z: number, hull: number) => boolean,
 *   grid: { clear: (a: number[], b: number[]) => boolean, path: (a: number[], b: number[]) => any } }} q
 */
export function fishingWaters({ harbour, i, seed, hull, isWater, grid }) {
  if (!harbour?.mouth || !harbour.berths?.length) return null;
  const m = harbour.mouth,
    n = harbourOutwardOf(harbour),
    u = [n[1], -n[0]],
    side = i % 2 ? -1 : 1,
    k = Math.floor(i / 2);
  const along = Math.atan2(u[0], u[1]); // she lies along the shore, as the berths' ships do
  const water = (x, z) => !!isWater(x, z, hull);
  const length = (() => {
    const b = berthSize(harbour.hull ?? 4);
    return b.bowZ - b.aftZ;
  })();
  const span = berthSpan(harbour, n, u, length);
  const a = side > 0 ? span.hi + FISH_BERTH_CLEAR + k * FISH_SPACING : span.lo - FISH_BERTH_CLEAR - k * FISH_SPACING;
  let anchor = null;
  for (const share of FISH_ROADS_IN) {
    const d = span.depth * share;
    const p = [m[0] - n[0] * d + u[0] * a, m[1] - n[1] * d + u[1] * a];
    if (footprintClear(p, along, hull, isWater) && clearOfBerths(p, harbour, length) && grid.path(m, p)) {
      anchor = p;
      break;
    }
  }
  if (!anchor) return null;
  const r = fishRng(seed);
  r(); // the class's draw (fishersOf)
  let ground = null;
  for (let t = 0; t < FISH_TRIES && !ground; t++) {
    const a = Math.atan2(n[0], n[1]) + (r() * 2 - 1) * FISH_GROUND_SPREAD,
      d = FISH_GROUND_M[0] + r() * (FISH_GROUND_M[1] - FISH_GROUND_M[0]);
    const q = [m[0] + Math.sin(a) * d, m[1] + Math.cos(a) * d];
    if (water(q[0], q[1]) && grid.clear(m, q)) ground = q;
  }
  return ground ? { anchor, yaw: along, ground } : null;
}

/**
 * Her errand where the day finds her (`lights`: the lanterns lit) - at anchor in the lanterns' hours, else working her
 * ground - and where she stands to begin it. `{ errand, pos: [x, z], yaw }`.
 * @param {{ key: string, waters: { anchor: number[], yaw: number, ground: number[] }, lights: boolean }} q
 */
export function fishingErrand({ key, waters, lights }) {
  const errand = {
    kind: lights ? 'anchor' : 'fish',
    harbour: key,
    to: [...waters.anchor],
    at: [...waters.ground],
    yaw: waters.yaw,
    path: null,
    i: 0,
    ringing: false,
  };
  return lights
    ? { errand, pos: [...waters.anchor], yaw: waters.yaw }
    : { errand, pos: [...waters.ground], yaw: waters.yaw + Math.PI };
}

/** Whether her errand holds her where she is - at anchor, or working her ground's ring: no stall is a stall then
 *  (shipLife.js stepErrand's detours are a voyage's). */
export const fishingHeld = (e) => e?.kind === 'anchor' || (e?.kind === 'fish' && !!e.ringing);

/**
 * HER DAY, stepped (shipLife.js stepErrand's arm for FISH_KINDS); `ctx.lights` the lanterns lit.
 *   anchor - held at her anchorage; the lanterns out, she puts out ('fish').
 *   fish   - to her ground, then round its ring at FISH_STROKE; the lanterns lit, she makes for home.
 *   home   - to her anchorage, slowing as she comes in; there, 'anchor'.
 * Out and home her sweeps are out (SWEEP_WAY), so a smack becalmed or headed rows. A way the water cannot give hands
 * the errand up (null), as every errand does.
 */
export function stepFishing(ship, dt, ctx, { here, plan, way }) {
  const e = ship.errand;
  const lit = !!ctx.lights;
  const turn = (kind) => {
    e.kind = kind;
    e.path = null;
    e.i = 0;
    e.ringing = false;
    e.stall = 0;
    e.detour = null;
  };
  if (e.kind === 'anchor') {
    if (!lit) {
      turn('fish');
      return stepFishing(ship, dt, ctx, { here, plan, way });
    }
    if (dist2(here, e.to) > FISH_ANCHOR_M * 2) {
      turn('home');
      return stepFishing(ship, dt, ctx, { here, plan, way });
    } // moved off her mooring (a fight)
    return { hold: { pos: [e.to[0], e.to[1]], yaw: e.yaw } };
  }
  if (e.kind === 'fish') {
    if (lit) {
      turn('home');
      return stepFishing(ship, dt, ctx, { here, plan, way });
    }
    if (e.ringing && !e.path) e.ringing = false; // a fight took her off it (navalAI.js lets a way go): back by the water's way
    if (!e.ringing && dist2(here, e.at) <= FISH_RING + REACH_M) {
      e.ringing = true;
      const ring = [0, 1, 2, 3].map((k) => {
        const a = (k / 4) * TAU + (ship.seed % 360) * (Math.PI / 180);
        return [e.at[0] + Math.sin(a) * FISH_RING, e.at[1] + Math.cos(a) * FISH_RING];
      });
      // AUDIT SEA PATHS AI-7: a point with her grid's room about it the water from her ground reaches, a chord it does not
      // carry her along sailed by the ground itself (shipLife.js ringOver, a patrol's law) - a point ashore held her
      // circling it all day
      const grid = ctx.grid?.(ship.hull);
      e.path = grid
        ? ringOver(
            ring.filter((q) => grid.room(q) && grid.clear(e.at, q)),
            [e.at[0], e.at[1]],
            grid.clear,
          )
        : ring;
      e.i = 0;
    }
    if (e.ringing) {
      if (dist2(here, e.path[e.i]) <= REACH_M) e.i = (e.i + 1) % e.path.length;
      // AUDIT SEA PATHS AI-7: her sweeps out on the ring as on the way out - a smack at FISH_STROKE beat for a point to
      // windward and lost it, 300 m off her ground in twenty minutes
      const p = plan(e.path[e.i], FISH_STROKE);
      return ship.hull === 0 ? p : { ...p, sweeps: SWEEP_WAY, sailable: true }; // a skiff pulls her stroke as she is
    }
    const p = way(e.at);
    return p ? { ...plan(p, 0.8), sweeps: SWEEP_WAY, sailable: true } : (ship.errand = null);
  }
  if (e.kind === 'home') {
    if (!lit) {
      turn('fish');
      return stepFishing(ship, dt, ctx, { here, plan, way });
    }
    if (dist2(here, e.to) <= FISH_ANCHOR_M) {
      turn('anchor');
      return { hold: { pos: [e.to[0], e.to[1]], yaw: e.yaw } };
    }
    const p = way(e.to);
    if (!p) return (ship.errand = null);
    const left = dist2(here, e.to);
    // the last leg, into her anchorage by the shore: no swing off the land she lies by (shipLife.js arrive's `berthing`)
    return {
      ...plan(p, left > 120 ? 0.8 : Math.max(0.3, left / 150)),
      sweeps: SWEEP_WAY,
      sailable: true,
      berthing: !!e.path && e.i === e.path.length - 1,
    };
  }
  return (ship.errand = null);
}

/** Her catch: the fish in her hold, her seed's draw in her class's range - `{ count }` (the host mints them). */
export function fisherCatch(classId, seed) {
  const range = FISH_CATCH[/** @type {keyof typeof FISH_CATCH} */ (classId)] ?? FISH_CATCH.fishingSkiff;
  const r = fishRng(seed ^ 0xca7c);
  return { count: range[0] + Math.floor(r() * (range[1] - range[0] + 1)) };
}

/** The seed's place in its harbour's fleet: `{ key, i, classId, day }` - found among `harbours`' fleets of `days`, or
 *  null. A boat taken over is known by it (her errand never rides the word). */
export function fisherPlace(seed, harbours, days) {
  for (const day of days)
    for (const h of harbours) {
      const f = fishersOf(h.key, day).find((x) => x.seed === seed >>> 0);
      if (f) return { key: h.key, i: f.i, classId: f.classId, day };
    }
  return null;
}
