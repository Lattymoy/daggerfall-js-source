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
// WB9f (2026-09-30, Mac: "Improve the loot drops that emit on his death and have them spread out more"): THE SPREAD. WB5
// threw every piece inside 0.9 radians of the player's bearing at 7-10.5 m/s, each bearing its own roll, so five pieces
// could leave on one line and land in one heap. Now each piece takes its OWN SLOT across a fan twice as wide (the slots
// dealt out in a seeded order, each jittered inside its own, `spewLaunches`), thrown harder; and so a throw that hard
// never carries a piece off the court's edge into the fire, each launch is flown ahead over the court's floor and thrown
// softer until it comes to rest inside it (`keepLaunch`).
//
// Not a DFU member. Ledger A (WB).
import { PROJECTILE, PROJECTILE_FIXED_DT } from '../../scenes/droppedTorches.js';

/** A piece leaves this long after the one before it. */
export const SPEW_GAP_MS = 220;
/** The throw: its speed range (metres a second), how far off the player's bearing a piece may leave (radians either
 *  side), how steeply up (the launch's rise over its run), and the bounce a floor gives back. WB9f: harder (7-10.5
 *  before) and wider (0.9 before) - a half-disc of the floor toward the player, a slot a piece. */
export const SPEW_SPEED = Object.freeze({ min: 8, max: 13 });
export const SPEW_SPREAD = 1.6;
/** WB9f: a piece's bearing stands this share of its slot's width in from either edge of it (so two neighbours never
 *  leave on one line). */
export const SPEW_SLOT_MARGIN = 0.15;
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
 * @param {() => number} rolls a seeded [0,1) source (systems/wind/wind.js seededRng) @param {number} n @param {number} bearing
 */
export function spewLaunches(rolls, n, bearing) {
  const out = [];
  // WB9f: THE SLOTS - the fan cut in n, dealt out in the seed's order (the first piece to leave is not always the
  // leftmost), each piece jittered inside its own slot and never within SPEW_SLOT_MARGIN of its edges; a lone piece
  // anywhere in the fan, as WB5 threw it
  const slots = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rolls() * (i + 1)); const t = slots[i]; slots[i] = slots[j]; slots[j] = t; }
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? (slots[i] + SPEW_SLOT_MARGIN + rolls() * (1 - 2 * SPEW_SLOT_MARGIN)) / n : rolls();
    const a = bearing + (u * 2 - 1) * SPEW_SPREAD;
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

/** WB9f: a floor at height `y` as a ray function (stepSpew's `ray`) - the court's floor is one plane, so a throw can be
 *  flown ahead over it without the collider. */
export const floorRayAt = (y) => (from, dir, len) => {
  if (!(dir[1] < 0)) return null;
  const d = (from[1] - y) / -dir[1];
  return d >= 0 && d <= len ? { dist: d, normal: [0, 1, 0] } : null;
};
/** WB9f: where a launch from `from` comes to rest over a floor at height `floorY` - the torch's own flight, flown ahead
 *  (at most its flight's time). Pure. */
export function restOf(from, launch, floorY) {
  const p = spewPiece(from, launch), ray = floorRayAt(floorY);
  for (let k = 0; k <= Math.ceil(SPEW_FLIGHT_MAX_S / PROJECTILE_FIXED_DT) && !p.rest; k++) stepSpew(p, ray);
  return p.pos;
}
/** WB9f: THE COURT KEEPS ITS SPOILS - how many softer throws a launch is given, and how much softer each. */
export const SPEW_KEEP_TRIES = 10;
export const SPEW_KEEP_EASE = 0.84;
/**
 * WB9f: A LAUNCH KEPT ON THE FLOOR. `keep` is `{ centre: [x, y, z], r, floorY }` - the court's centre, how far from it a
 * piece may rest, and its floor's height (all in the dungeon's frame). A launch whose piece would rest within `r` of the
 * centre is answered as it is; else it is thrown softer (SPEW_KEEP_EASE a try, its direction kept) until it would, and
 * past SPEW_KEEP_TRIES it is turned toward the centre at the softest throw. Pure: the same launch, the same answer.
 * @param {number[]} from @param {{ at: number, dir: number[], speed: number }} launch
 * @param {{ centre: number[], r: number, floorY: number }|null} keep
 */
export function keepLaunch(from, launch, keep) {
  if (!keep || !Array.isArray(keep.centre) || !(keep.r > 0) || !Number.isFinite(keep.floorY)) return launch;
  const inside = (l) => { const p = restOf(from, l, keep.floorY); return Math.hypot(p[0] - keep.centre[0], p[2] - keep.centre[2]) <= keep.r; };
  if (inside(launch)) return launch;
  let speed = launch.speed;
  for (let k = 0; k < SPEW_KEEP_TRIES; k++) {
    speed *= SPEW_KEEP_EASE;
    const l = { at: launch.at, dir: launch.dir, speed };
    if (inside(l)) return l;
  }
  // still off the floor at the softest: toward the centre, as steeply as it left
  const dx = keep.centre[0] - from[0], dz = keep.centre[2] - from[2], h = Math.hypot(dx, dz), run = Math.hypot(launch.dir[0], launch.dir[2]);
  if (!(h > 1e-6)) return { at: launch.at, dir: launch.dir, speed };
  return { at: launch.at, dir: [(dx / h) * run, launch.dir[1], (dz / h) * run], speed };
}
