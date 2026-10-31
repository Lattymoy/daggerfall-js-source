// @ts-check
// AMBIENT-LIFE (bible/07-Rendering/Ambient-Life.md): the creatures round the player, run on the CPU a frame at a time
// and handed to the pass as instances - the birds (ambientFlight.js) and what lives on the ground (ambientGround.js),
// at the counts the cast asks (ambientCast.js). It reads the world only through the host's AmbientWorld, so it stands
// wherever a host can say where the ground, the water and the roofs are.
import { Flight } from './ambientFlight.js';
import { Ground } from './ambientGround.js';
import { writeBody, AL_MAX_INSTANCES } from './ambientBody.js';
import { AL_SHAPE } from './ambientCast.js';

/** What the host lends the creatures, in scene metres, y up: `ground` the drawn ground's height (-Infinity off the built
 *  world), `wet` water there, `roof(x, z, top)` the first solid surface a ray down from `top` meets (the collider's
 *  meshes, not the terrain; -Infinity none), `boxes` the buildings' boxes, where perches are looked for first.
 *  @typedef {{ ground: (x: number, z: number) => number, wet: (x: number, z: number) => boolean,
 *    roof: (x: number, z: number, top: number) => number,
 *    boxes?: () => ArrayLike<{ min: ArrayLike<number>, max: ArrayLike<number> }> }} AmbientWorld */

/** A jump further than this between two frames (a door, a travel, a load) starts the creatures afresh. */
export const AL_JUMP_M = 150;
/** The player runs from this speed (m/s): the creatures go sooner. */
export const AL_FAST = 4.5;
/** Faster than this (m/s) the player was set down somewhere, not run there. */
export const AL_RUN_MAX = 30;
/** Water within this many metres makes a coast (the gulls). */
const COAST_LOOK = [25, 60];

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

  /** Buildings stand round the player. */
  get town() { return this.flight.boxes.length >= 3; }

  /** Water near the player, looked for every two seconds on two rings of eight points. */
  lookForCoast(feet) {
    if (this.clock - this.coastAt < 2) return;
    this.coastAt = this.clock;
    this.coast = false;
    for (const r of COAST_LOOK) {
      for (let k = 0; k < 8 && !this.coast; k++) {
        const a = (k / 8) * Math.PI * 2;
        this.coast = this.world.wet(feet[0] + Math.sin(a) * r, feet[2] + Math.cos(a) * r);
      }
    }
  }

  /** A frame: `dt` the game's seconds, `feet` the player's, `cast` who stands (ambientCast). */
  step(dt, feet, cast) {
    const d = Math.min(0.1, Math.max(0, Number(dt) || 0));
    if (this.last) {
      const moved = Math.hypot(feet[0] - this.last[0], feet[1] - this.last[1], feet[2] - this.last[2]);
      if (moved > AL_JUMP_M) this.clear();
      else if (d > 0 && moved / d < AL_RUN_MAX) this.speed += (moved / d - this.speed) * Math.min(1, d * 4);   // past a gallop it was set down, not run
    }
    if (this.last) { this.last[0] = feet[0]; this.last[1] = feet[1]; this.last[2] = feet[2]; } else this.last = [feet[0], feet[1], feet[2]];
    if (d <= 0) return;
    this.clock += d;
    this.lookForCoast(feet);
    const ctx = this.ctx;
    ctx.fast = this.speed > AL_FAST; ctx.town = this.town;
    this.flight.step(d, feet, cast, ctx);
    this.ground.step(d, feet, cast, ctx);
  }

  /** Every creature's instance into `out`: the bodies first, then the fireflies' lights.
   *  @param {Float32Array} out @returns {{ solid: number, glow: number }} */
  write(out) {
    let n = 0;
    const put = (b) => { if (n < AL_MAX_INSTANCES && b.fade > 0 && !b.gone) writeBody(b, out, n++); };
    for (const b of this.flight.bodies()) put(b);
    for (const b of this.ground.runners) put(b);
    for (const b of this.ground.butterflies) put(b);
    const solid = n;
    for (const b of this.ground.fireflies) if (b.glow > 0.01 && b.kind.shape === AL_SHAPE.glow) put(b);
    return { solid, glow: n - solid };
  }

  /** The player struck, shot or cast at `at`: what is near enough takes fright. */
  scare(at, radius = 18) { this.flight.scare(at, radius); this.ground.scare(at, radius * 0.6); }

  /** The floating origin moved the scene by `o`: every creature stands where it was on the land. */
  offset(o) {
    this.flight.offset(o); this.ground.offset(o);
    if (this.last) { this.last[0] += o[0]; this.last[1] += o[1]; this.last[2] += o[2]; }
  }

  clear() { this.flight.clear(); this.ground.clear(); this.last = null; this.speed = 0; this.coastAt = -Infinity; }

  /** How many stand. */
  get live() {
    let n = this.ground.runners.length + this.ground.butterflies.length + this.ground.fireflies.length;
    for (const b of this.flight.bodies()) if (b) n++;
    return n;
  }
}
