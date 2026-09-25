// @ts-check
// WB5 (2026-09-25, Mac: "On death the boss would physically spew out per player loot and bounce (sort of how dropping a
// torch works)"): THE SPEW - each piece of a fallen boss's spoils leaves his chest on its own arc, out and up toward the
// player's side of him, and falls, bounces and comes to rest with the thrown torch's own physics
// (scenes/droppedTorches.js stepProjectile: the fixed 0.02 s step, gravity accumulating on its own vector, the
// collider's ray along each step, the flight's x/z with the gravity's y reflected off the struck face, the speed times
// the bounce, rest once a bounce leaves it under a fifth of the throw's speed). Design:
// bible/11-Multiplayer/World-Bosses.md section 7 ("The spew").
//
// PURE: a seed, where he stood and where the player stands in; each piece's launch out; a piece and a ray function in,
// the piece stepped. The pieces leave one at a time (SPEW_GAP_MS apart) so the burst reads as a burst.
//
// Not a DFU member. Ledger A (WB).
import { PROJECTILE, PROJECTILE_FIXED_DT } from '../scenes/droppedTorches.js';

/** A piece leaves this long after the one before it. */
export const SPEW_GAP_MS = 220;
/** The throw: its speed range (metres a second), how far off the player's bearing a piece may leave (radians either
 *  side), how steeply up (the launch's rise over its run), and the bounce a floor gives back. */
export const SPEW_SPEED = Object.freeze({ min: 7, max: 10.5 });
export const SPEW_SPREAD = 0.9;
export const SPEW_RISE = Object.freeze({ min: 0.9, max: 1.5 });
export const SPEW_BOUNCE = 0.5;
/** The torch's gravity drag at the Handheld Torches mod's default strength (Throwing.GravityStrength 1.0 - the thrown
 *  torch's `0.05 * throwGravity`), and its bounce is the mod's default Bounciness above: the torch's own flight. */
export const SPEW_GRAVITY_DRAG = 0.05;
/** A piece still in flight after this long is stood where it is (the floor it missed is the court's edge - it rests on
 *  the last ground it crossed). */
export const SPEW_FLIGHT_MAX_S = 6;

/**
 * Each piece's launch: when it leaves (ms after the fall), its direction (a unit vector - out toward the player's side
 * of him, spread by the seed, and up) and its speed. `bearing` is the angle from him to the player (atan2(dx, dz)).
 * @param {() => number} rolls a seeded [0,1) source (systems/wind.js seededRng) @param {number} n @param {number} bearing
 */
export function spewLaunches(rolls, n, bearing) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = bearing + (rolls() * 2 - 1) * SPEW_SPREAD;
    const rise = SPEW_RISE.min + rolls() * (SPEW_RISE.max - SPEW_RISE.min);
    const l = Math.hypot(1, rise);
    const speed = SPEW_SPEED.min + rolls() * (SPEW_SPEED.max - SPEW_SPEED.min);
    out.push({ at: i * SPEW_GAP_MS, dir: [Math.sin(a) / l, rise / l, Math.cos(a) / l], speed });
  }
  return out;
}

/** A piece in flight: where it is, the torch's own state (the throw's direction and speed, the gravity it has gathered),
 *  its clock, and whether it has come to rest. */
export function spewPiece(from, launch) {
  return { pos: [...from], dirStart: [...launch.dir], speedStart: launch.speed, speedCurrent: launch.speed, gravity: [0, 0, 0], t: 0, acc: 0, rest: false, bounces: 0 };
}

/**
 * One fixed step of the torch's flight (droppedTorches.js stepProjectile, the entity arm aside - a spoil strikes no
 * foe). `ray(from, dir, len)` answers `{ dist, normal }` for the first face along it within `len`, or null. Answers
 * 'fly', 'bounce' or 'rest' (the step it came to rest on stands it on the struck point).
 * @param {ReturnType<typeof spewPiece>} p @param {(from: number[], dir: number[], len: number) => ({dist: number, normal?: number[]}|null)} ray
 */
export function stepSpew(p, ray) {
  if (p.rest) return 'rest';
  p.t += PROJECTILE_FIXED_DT;
  p.gravity = [p.gravity[0], p.gravity[1] + PROJECTILE.gravityAccel * SPEW_GRAVITY_DRAG * PROJECTILE_FIXED_DT, p.gravity[2]];
  const step = [0, 1, 2].map((k) => p.dirStart[k] * p.speedCurrent * PROJECTILE_FIXED_DT + p.gravity[k]);
  const len = Math.hypot(step[0], step[1], step[2]);
  if (!(len > 0)) return 'fly';
  const dir = [step[0] / len, step[1] / len, step[2] / len];
  const hit = ray(p.pos, dir, len);
  if (hit && Number.isFinite(hit.dist)) {
    const point = [p.pos[0] + dir[0] * hit.dist, p.pos[1] + dir[1] * hit.dist, p.pos[2] + dir[2] * hit.dist];
    if (p.speedCurrent < p.speedStart * PROJECTILE.restFraction) { p.pos = point; p.rest = true; return 'rest'; }
    const n = hit.normal ?? [0, 1, 0];
    const v = [p.dirStart[0], p.gravity[1], p.dirStart[2]];
    const vn = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
    p.dirStart = [v[0] - 2 * vn * n[0], v[1] - 2 * vn * n[1], v[2] - 2 * vn * n[2]];
    p.speedCurrent *= SPEW_BOUNCE;
    p.gravity = [0, 0, 0];
    p.bounces++;
    p.pos = [point[0] + n[0] * 0.02, point[1] + n[1] * 0.02, point[2] + n[2] * 0.02];
    return 'bounce';
  }
  p.pos = [p.pos[0] + step[0], p.pos[1] + step[1], p.pos[2] + step[2]];
  if (p.t >= SPEW_FLIGHT_MAX_S) { p.rest = true; return 'rest'; }
  return 'fly';
}

/** Step a piece through `dt` seconds of the fixed clock; answers what happened on the way ('bounce' if it bounced,
 *  'rest' if it came to rest, else 'fly'). */
export function flySpew(p, dt, ray) {
  let what = 'fly';
  p.acc += Math.max(0, dt);
  while (p.acc >= PROJECTILE_FIXED_DT && !p.rest) {
    p.acc -= PROJECTILE_FIXED_DT;
    const r = stepSpew(p, ray);
    if (r === 'rest') what = 'rest';
    else if (r === 'bounce' && what !== 'rest') what = 'bounce';
  }
  return what;
}
