// @ts-check
// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures round the player, run on the CPU a frame at a time
// and handed to the pass as instances - the birds (ambientFlight.js) and what lives on the ground (ambientGround.js),
// at the counts the cast asks (ambientCast.js). It reads the world only through the host's AmbientWorld, so it stands
// wherever a host can say where the ground, the water and the roofs are.
import { Flight } from './ambientFlight.js';
import { Ground } from './ambientGround.js';
import { writeBody, reachShare, AL_MAX_INSTANCES } from './ambientBody.js';
import { AL_SHAPE } from './ambientCast.js';

/** What the host lends the creatures, in scene metres, y up: `ground` the drawn ground's height (-Infinity off the built
 *  world), `wet` water there, `roof(x, z, top)` the first solid surface a ray down from `top` meets (the collider's
 *  meshes, not the terrain; -Infinity none), `boxes` the buildings' boxes, where perches are looked for first.
 *  @typedef {{ ground: (x: number, z: number) => number, wet: (x: number, z: number) => boolean,
 *    roof: (x: number, z: number, top: number) => number,
 *    boxes?: () => ArrayLike<{ min: ArrayLike<number>, max: ArrayLike<number> }> }} AmbientWorld */

/** A jump further than this between two outdoor frames (a travel, a load, a teleport) starts the creatures afresh. */
export const AL_JUMP_M = 150;
/** The player runs from this speed (m/s), between the fastest walk (6.33, SPD 100) and the slowest run (6.84):
 *  the creatures go sooner. A horse is faster still. */
export const AL_FAST = 6.6;
/** Faster than this (m/s) the player was set down somewhere, not run there. */
export const AL_RUN_MAX = 30;
/** Built, dry-or-wet ground this many metres round the player is looked at for water (the gulls), eight points a ring. */
export const AL_COAST_RINGS = Object.freeze([15, 30, 45, 60]);
/** Seconds between two looks for water. */
export const AL_COAST_EVERY = 2;

export class AmbientLife {
  /** @param {AmbientWorld} world @param {{ random?: () => number }} [opts] */
  constructor(world, { random = Math.random } = {}) {
    this.world = world; this.R = random;
    this.flight = new Flight(world, random);
    this.ground = new Ground(world, random);
    /** @type {number[]|null} */ this.last = null;
    this.speed = 0; this.coastAt = -Infinity; this.coast = false; this.clock = 0;
    this.ctx = { fast: false, town: false };   // the frame's word to the groups, refilled in place
  }

  /** Buildings stand round the player (three boxes 3 m tall or more within 85 m). */
  get town() { return this.flight.town; }

  /** The buildings and the water round the player, each read when it is due: the host calls it before the cast, so a
   *  town and a coast are known on the frame that needs them. */
  survey(feet) { this.flight.survey(feet); this.lookForCoast(feet); }

  /** Water near the player: a point counts only on built ground, so a pixel still streaming is no coast. */
  lookForCoast(feet) {
    if (this.clock - this.coastAt < AL_COAST_EVERY) return;
    this.coastAt = this.clock;
    this.coast = false;
    const w = this.world;
    for (const r of AL_COAST_RINGS) {
      for (let k = 0; k < 8 && !this.coast; k++) {
        const a = (k / 8) * Math.PI * 2, x = feet[0] + Math.sin(a) * r, z = feet[2] + Math.cos(a) * r;
        this.coast = Number.isFinite(w.ground(x, z)) && w.wet(x, z);
      }
    }
  }

  /** A frame: `dt` the game's seconds, `feet` the player's, `cast` who stands (ambientCast). */
  step(dt, feet, cast) {
    const raw = Math.max(0, Number(dt) || 0), d = Math.min(0.1, raw);
    if (this.last) {
      const moved = Math.hypot(feet[0] - this.last[0], feet[1] - this.last[1], feet[2] - this.last[2]);
      // the speed on the frame's own time: a long frame is not a sprint, and past a gallop it was set down, not run
      if (moved > AL_JUMP_M) this.clear();
      else if (raw > 0 && moved / raw < AL_RUN_MAX) this.speed += (moved / raw - this.speed) * Math.min(1, raw * 4);
    }
    if (this.last) { this.last[0] = feet[0]; this.last[1] = feet[1]; this.last[2] = feet[2]; } else this.last = [feet[0], feet[1], feet[2]];
    if (d <= 0) return;
    this.clock += d;
    this.survey(feet);
    const ctx = this.ctx;
    ctx.fast = this.speed > AL_FAST; ctx.town = this.town;
    this.flight.step(d, feet, cast, ctx);
    this.ground.step(d, feet, cast, ctx);
  }

  /** Every creature's instance into `out`: the bodies first, then the fireflies' lights; each faded toward its reach.
   *  @param {Float32Array} out @returns {{ solid: number, glow: number }} */
  write(out) {
    const f = this.last ?? [0, 0, 0];
    let n = put(this.flight.birds, out, 0, f);
    for (const fl of this.flight.flocks) n = put(fl.members, out, n, f);
    n = put(this.ground.runners, out, n, f);
    n = put(this.ground.butterflies, out, n, f);
    const solid = n;
    n = put(this.ground.fireflies, out, n, f, true);
    return { solid, glow: n - solid };
  }

  /** The player struck, shot or cast at `at`: what is near enough takes fright. */
  scare(at, radius = 18) { this.flight.scare(at, radius); this.ground.scare(at, radius * 0.6); }

  /** The floating origin moved the scene by `o`: every creature stands where it was on the land. */
  offset(o) {
    this.flight.offset(o); this.ground.offset(o);
    if (this.last) { this.last[0] += o[0]; this.last[1] += o[1]; this.last[2] += o[2]; }
  }

  clear() {
    this.flight.clear(); this.ground.clear();
    this.last = null; this.speed = 0; this.coastAt = -Infinity; this.coast = false;
  }

  /** How many stand. */
  get live() {
    let n = this.flight.birds.length + this.ground.runners.length + this.ground.butterflies.length + this.ground.fireflies.length;
    for (const fl of this.flight.flocks) n += fl.members.length;
    return n;
  }
}

/** `list`'s showing bodies into `out` from instance `n` (a light only while it glows); answers the next instance. */
function put(list, out, n, feet, lights = false) {
  for (let i = 0; i < list.length && n < AL_MAX_INSTANCES; i++) {
    const b = list[i];
    if (b.gone || !(b.fade > 0) || (lights && !(b.glow > 0.01 && b.kind.shape === AL_SHAPE.glow))) continue;
    const share = reachShare(b, Math.hypot(b.x - feet[0], b.z - feet[2]));
    if (share > 0) writeBody(b, out, n++, share);
  }
  return n;
}
