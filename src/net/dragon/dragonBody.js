// @ts-check
// DRAGON2 (bible/11-Multiplayer/Dwarven-Dragon.md sections 3 and 5): THE DRAGON'S BODY - a path, not a physics (the
// serpent's law, net/serpent/serpentBody.js). Its place at any moment is its plan's: the leg standing at that moment, a line
// from one point to another over a span, or an orbit about a centre. The relay says the plan once and every screen walks
// it, so the dragon stands in one place on all of them and the relay judges blows where every screen drew it.
//
// Metres in its site's frame (x east, z north, the site at the origin, a facing atan2(dx, dz)); `a` its height over the
// ground under it, which each screen reads off its own land. Pure, and the relay's. Not a DFU member. Ledger A (DRAGON).
import { dragonRoll, dragonTimes } from './dragonLaw.js';

/** Its body about its centre, metres - the reach a blow, a shaft and a spell meet - and its height standing. */
export const DRAGON_BODY_R = 4.5;
export const DRAGON_BODY_H = 6;
/** How it flies: roosting before the fight, circling in it, and its pace in the air and on the ground (m/s). */
export const ROOST_ALT = 70;
export const ROOST_R = 90;
export const CIRCLE_ALT = 30;
export const FLY_V = 18;
export const WALK_V = 3.4;
/** It never strays past this far from its site (the fight's ground), metres. */
export const DRAGON_ARENA_R = 140;
/** Its death's fall from the air: gravity, and the least the fall takes, ms. */
export const FALL_G = 9.8;
export const FALL_MIN_MS = 600;
/** How high its climb away takes it before it is gone from sight, metres. */
export const CLIMB_ALT = 400;

/** The legs' kinds on the wire. */
export const DRAGON_LEG = Object.freeze({ line: 0, orbit: 1 });
/** A line leg's ease: smooth at both ends, or a fall's (from rest, faster to the ground). */
export const EASE = Object.freeze({ smooth: 0, fall: 1 });

const TAU = 2 * Math.PI;
const wrap = (a) => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};
const r2 = (v) => Math.round(v * 100) / 100;
const smooth = (u) => u * u * (3 - 2 * u);

/**
 * A line leg: from (x, z, a) at `at` to (tx, tz, ta) at `at + ms`; `yw` its facing while it does not travel (a hover, a
 * stand). Rounded to the centimetre, the wire's.
 * @param {number} at @param {number} ms @param {number[]} from [x, z, a] @param {number[]} to [x, z, a] @param {number} yw
 * @param {number} [e] EASE
 */
export const lineLeg = (at, ms, from, to, yw, e = EASE.smooth) => ({
  k: DRAGON_LEG.line,
  at: Math.round(at),
  ms: Math.max(0, Math.round(ms)),
  x: r2(from[0]),
  z: r2(from[1]),
  a: r2(from[2]),
  tx: r2(to[0]),
  tz: r2(to[1]),
  ta: r2(to[2]),
  yw: Math.round(wrap(yw) * 1000) / 1000,
  e,
});
/**
 * An orbit leg: about (cx, cz), radius `r`, at angle `a0` (atan2's, from the centre) at `at`, turning `sd` (+1 sunwise,
 * -1 against) at FLY_V; its height `a`, eased to `ta` over `ams` when it climbs or comes down.
 */
export const orbitLeg = (at, cx, cz, r, a0, sd, a, ta = a, ams = 0) => ({
  k: DRAGON_LEG.orbit,
  at: Math.round(at),
  cx: r2(cx),
  cz: r2(cz),
  r: r2(Math.max(5, r)),
  a0: Math.round(wrap(a0) * 1000) / 1000,
  sd: sd < 0 ? -1 : 1,
  a: r2(a),
  ta: r2(ta),
  ams: Math.max(0, Math.round(ams)),
});

/** Where leg `l` holds the dragon at `t`: `{x, z, a, yw}`. Before the leg's start, its start. */
export function dragonLegAt(l, t) {
  const dt = Math.max(0, t - l.at);
  if (l.k === DRAGON_LEG.orbit) {
    const ang = l.a0 + l.sd * (FLY_V / l.r) * (dt / 1000);
    const u = l.ams > 0 ? Math.min(1, dt / l.ams) : 1;
    return {
      x: l.cx + Math.sin(ang) * l.r,
      z: l.cz + Math.cos(ang) * l.r,
      a: l.a + (l.ta - l.a) * smooth(u),
      yw: wrap(ang + (l.sd * Math.PI) / 2),
    };
  }
  const u = l.ms > 0 ? Math.min(1, dt / l.ms) : 1,
    k = l.e === EASE.fall ? u * u : smooth(u);
  const dx = l.tx - l.x,
    dz = l.tz - l.z,
    moving = Math.hypot(dx, dz) > 0.5;
  return { x: l.x + dx * k, z: l.z + dz * k, a: l.a + (l.ta - l.a) * k, yw: moving ? Math.atan2(dx, dz) : l.yw };
}
/** The leg of a plan standing at `t`: the latest begun, else the first. @param {any[]} legs @param {number} t */
export function legOf(legs, t) {
  let best = legs[0] ?? null;
  for (const l of legs)
    if (l.at <= t) best = l;
    else break;
  return best;
}
/** Where a plan holds the dragon at `t`, or null for none. @param {any[]} legs @param {number} t */
export const planAt = (legs, t) => {
  const l = legOf(legs ?? [], t);
  return l ? dragonLegAt(l, t) : null;
};
/** When a plan's last leg ends (an orbit never does: Infinity). @param {any[]} legs */
export const planEnd = (legs) => {
  const l = legs?.[legs.length - 1];
  return !l ? -Infinity : l.k === DRAGON_LEG.orbit ? Infinity : l.at + l.ms;
};

/** An omen's roost before its fight: an orbit about its site, high, from its landing. @param {{w: number, s: number}} o */
export function roostLeg(o) {
  return orbitLeg(
    dragonTimes(o).landAt,
    0,
    0,
    ROOST_R,
    (dragonRoll(o, 3) / 4294967296) * TAU,
    dragonRoll(o, 4) & 1 ? 1 : -1,
    ROOST_ALT,
  );
}
/** An orbit that takes up from where `p` stands at `at`: about a centre ORBIT_R toward the site (kept inside its ground),
 *  so it flies on with no jump; climbing to `ta` over `ams`. */
export function orbitFrom(p, at, r, sd, ta = p.a, ams = 0) {
  const d = Math.hypot(p.x, p.z) || 1;
  const cx = p.x - (p.x / d) * Math.min(r, d),
    cz = p.z - (p.z / d) * Math.min(r, d),
    rr = Math.max(5, Math.hypot(p.x - cx, p.z - cz) || r);
  const ux = p.x - cx || 0,
    uz = p.z - cz || rr;
  return orbitLeg(at, cx, cz, rr, Math.atan2(ux, uz), sd, p.a, ta, ams);
}
/** Its death's fall from where `p` stood at `at`: straight down to the ground under it. */
export function fallLeg(p, at) {
  const ms = Math.max(FALL_MIN_MS, Math.sqrt((2 * Math.max(0, p.a)) / FALL_G) * 1000);
  return lineLeg(at, ms, [p.x, p.z, p.a], [p.x, p.z, 0], p.yw, EASE.fall);
}
/** Its climb away, unslain: an orbit from where it stands, rising out of sight over `ms`. */
export const climbLeg = (p, at, ms) => orbitFrom(p, at, 60, 1, CLIMB_ALT, ms);
