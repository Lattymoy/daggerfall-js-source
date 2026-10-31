// @ts-check
// AMBIENT-LIFE: what lives on the ground and just over it. Runners (a rat, a lizard, a squirrel, a crab) sit still, dart
// a few metres in bursts and bolt from the player; butterflies flutter about a patch of ground by day, and fireflies
// drift and blink over it at night. Nothing stands on water, under a roof or on a slope too steep to keep to.
import { AL_KINDS } from './ambientCast.js';
import { makeBody, offsetBody, ringPoint, turnToward } from './ambientBody.js';

/** @typedef {import('./ambientBody.js').AmbientBody} AmbientBody */
/** @typedef {import('./ambientCast.js').AmbientCast} AmbientCast */
/** @typedef {import('./ambientLife.js').AmbientWorld} AmbientWorld */

const TAU = Math.PI * 2;
/** Distances in metres, times in seconds. */
export const AL_GROUND = Object.freeze({
  runnerRing: [9, 30], runnerLeave: 42, idle: [0.4, 2.5], dart: [0.8, 4], fleeRun: [6, 9], burrow: 0.5, slope: 0.35, fadeIn: 0.35,
  butterflyRing: [3, 18], butterflyLeave: 30, butterflyHome: 4, butterflyAlt: [0.4, 1.8],
  fireflyRing: [2, 22], fireflyLeave: 30, fireflyAlt: [0.3, 2.8],
});
const G = AL_GROUND;
/** A runner's state. */
export const RUNNER = Object.freeze({ idle: 0, dart: 1, flee: 2, burrow: 3 });
const between = (r, R) => r[0] + (r[1] - r[0]) * R();

export class Ground {
  /** @param {AmbientWorld} world @param {() => number} random */
  constructor(world, random) {
    this.world = world; this.R = random;
    /** @type {AmbientBody[]} */ this.runners = [];
    /** @type {AmbientBody[]} */ this.butterflies = [];
    /** @type {AmbientBody[]} */ this.fireflies = [];
    this.clock = 0;
    this._xz = [0, 0];
  }

  /** Ground a runner may stand on: built, dry, under no roof and not too steep. Answers its height, or NaN. */
  standable(x, z) {
    const w = this.world, g = w.ground(x, z);
    if (!Number.isFinite(g) || w.wet(x, z)) return NaN;
    if (Math.abs(w.ground(x + 0.4, z) - g) > G.slope || Math.abs(w.ground(x, z + 0.4) - g) > G.slope) return NaN;
    const h = w.roof(x, z, g + 25);
    return Number.isFinite(h) && h > g + 0.3 ? NaN : g;
  }

  /** A frame. `ctx.fast` the player is running. @param {AmbientCast} cast */
  step(dt, feet, cast, ctx) {
    this.clock += dt;
    this.keep(feet, cast);
    for (const b of this.runners) this.run(b, dt, feet, ctx);
    for (const b of this.butterflies) this.flutter(b, dt, feet);
    for (const b of this.fireflies) this.drift(b, dt, feet);
    if (this.runners.some((b) => b.gone)) this.runners = this.runners.filter((b) => !b.gone);
    if (this.butterflies.some((b) => b.gone)) this.butterflies = this.butterflies.filter((b) => !b.gone);
    if (this.fireflies.some((b) => b.gone)) this.fireflies = this.fireflies.filter((b) => !b.gone);
  }

  /** One arrival a group a frame toward the cast; past it, the furthest goes. @param {AmbientCast} cast */
  keep(feet, cast) {
    const R = this.R;
    const live = (list) => list.filter((b) => b.state !== RUNNER.burrow).length;
    if (live(this.runners) < cast.runners) {
      ringPoint(feet, G.runnerRing[0], G.runnerRing[1], R, this._xz);
      const g = this.standable(this._xz[0], this._xz[1]);
      if (Number.isFinite(g)) {
        const b = makeBody(AL_KINDS[cast.runnerKind] ?? AL_KINDS.rat, R);
        b.x = this._xz[0]; b.z = this._xz[1]; b.y = g; b.state = RUNNER.idle; b.t = between(G.idle, R); b.fade = 0;
        this.runners.push(b);
      }
    } else if (live(this.runners) > cast.runners) this.farthest(this.runners, feet).state = RUNNER.burrow;
    if (this.butterflies.length < cast.butterflies) this.spawnFlier(this.butterflies, AL_KINDS.butterfly, feet, G.butterflyRing, G.butterflyAlt);
    else if (this.butterflies.length > cast.butterflies) this.farthest(this.butterflies, feet).gone = true;
    if (this.fireflies.length < cast.fireflies) this.spawnFlier(this.fireflies, AL_KINDS.firefly, feet, G.fireflyRing, G.fireflyAlt);
    else if (this.fireflies.length > cast.fireflies) this.farthest(this.fireflies, feet).gone = true;
  }

  farthest(list, feet) {
    let best = list[0], bd = -1;
    for (const b of list) { const d = Math.hypot(b.x - feet[0], b.z - feet[2]); if (d > bd && !b.gone) { bd = d; best = b; } }
    return best;
  }

  spawnFlier(list, kind, feet, ring, alt) {
    const R = this.R;
    ringPoint(feet, ring[0], ring[1], R, this._xz);
    const g = this.world.ground(this._xz[0], this._xz[1]);
    if (!Number.isFinite(g) || this.world.wet(this._xz[0], this._xz[1])) return;
    const b = makeBody(kind, R);
    b.x = b.cx = this._xz[0]; b.z = b.cz = this._xz[1]; b.y = g + between(alt, R); b.fade = 0;
    b.rad = 2 + R() * 4; b.t2 = R() * 5;   // a firefly's blink: its period, and where in it
    list.push(b);
  }

  // ---- runners ------------------------------------------------------------------------------------------------------
  /** A point `r` metres from the runner along `a` it may run to, turning up to two eighths either way; null. */
  runTo(b, a, r) {
    for (const turn of [0, 0.8, -0.8, 1.6, -1.6]) {
      const x = b.x + Math.sin(a + turn) * r, z = b.z + Math.cos(a + turn) * r;
      const g = this.standable(x, z);
      if (!Number.isFinite(g) || !Number.isFinite(this.standable((x + b.x) / 2, (z + b.z) / 2))) continue;
      b.tx = x; b.tz = z; b.ty = g;
      return true;
    }
    return false;
  }

  run(b, dt, feet, ctx) {
    const R = this.R, k = b.kind, d = Math.hypot(b.x - feet[0], b.z - feet[2]);
    b.fade = b.state === RUNNER.burrow ? Math.max(0, b.fade - dt / G.burrow) : Math.min(1, b.fade + dt / G.fadeIn);
    if (b.state === RUNNER.burrow) { if (b.fade <= 0) b.gone = true; return; }
    if (d > G.runnerLeave) { b.gone = true; return; }
    const away = Math.atan2(b.x - feet[0], b.z - feet[2]);
    if (b.state !== RUNNER.flee && d < k.flush * (ctx.fast ? 1.6 : 1) && feet[1] - b.y < 3) {
      if (this.runTo(b, away + (R() - 0.5) * 0.6, between(G.fleeRun, R))) { b.state = RUNNER.flee; b.t = 4; }
      else { b.state = RUNNER.burrow; return; }   // cornered: it slips into a crack
    }
    if (b.state === RUNNER.idle) {
      b.amp = 0;
      if ((b.t -= dt) <= 0) {
        // near the player a dart leads away from them
        const a = d < 10 ? away + (R() - 0.5) * 2 : R() * TAU;
        if (this.runTo(b, a, between(G.dart, R))) { b.state = RUNNER.dart; b.t = 3; } else b.t = between(G.idle, R);
      } else if (R() < dt * 0.8) b.yaw += (R() - 0.5) * 0.8;   // a sniff about
      return;
    }
    const speed = k.speed * (b.state === RUNNER.flee ? 1.6 : 1), dx = b.tx - b.x, dz = b.tz - b.z, l = Math.hypot(dx, dz);
    if (l < 0.15 || (b.t -= dt) <= 0) {
      b.state = RUNNER.idle; b.t = between(G.idle, R); b.amp = 0;
      if (d < k.flush * 1.4 && R() < 0.5) b.state = RUNNER.burrow;
      return;
    }
    const s = Math.min(l, speed * dt);
    b.x += (dx / l) * s; b.z += (dz / l) * s;
    const g = this.world.ground(b.x, b.z);
    if (Number.isFinite(g)) b.y = g;
    // a crab goes sideways
    b.yaw = turnToward(b.yaw, Math.atan2(dx, dz) + (k.b[3] ? Math.PI / 2 : 0), 14 * dt);
    b.phase += dt * speed * 14; b.amp = 1;
  }

  // ---- fliers -------------------------------------------------------------------------------------------------------
  flutter(b, dt, feet) {
    const R = this.R;
    b.fade = Math.min(1, b.fade + dt);
    if (Math.hypot(b.x - feet[0], b.z - feet[2]) > G.butterflyLeave) { b.gone = true; return; }
    if ((b.t -= dt) <= 0) {
      b.t = 0.25 + R() * 0.55;
      let a = R() * TAU;
      if (Math.hypot(b.x - b.cx, b.z - b.cz) > G.butterflyHome) a = Math.atan2(b.cx - b.x, b.cz - b.z) + (R() - 0.5);
      if (Math.hypot(b.x - feet[0], b.z - feet[2]) < 1.2) a = Math.atan2(b.x - feet[0], b.z - feet[2]);
      const v = 0.6 + R();
      b.vx = Math.sin(a) * v; b.vz = Math.cos(a) * v; b.vy = (R() - 0.45) * 1.2;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const g = this.world.ground(b.x, b.z);
    if (Number.isFinite(g)) {
      if (b.y < g + 0.25) { b.y = g + 0.25; b.vy = Math.abs(b.vy); } else if (b.y > g + 2.6) b.vy = -Math.abs(b.vy);
    }
    b.yaw = turnToward(b.yaw, Math.atan2(b.vx, b.vz), 8 * dt); b.pitch = 0.2; b.bank = 0;
    b.phase += dt * b.flapHz * TAU * (0.6 + 0.8 * Math.abs(Math.sin(this.clock * 3 + b.cx)));
    b.spread = 1; b.amp = 1.2;
  }

  drift(b, dt, feet) {
    const R = this.R;
    b.fade = Math.min(1, b.fade + dt);
    if (Math.hypot(b.x - feet[0], b.z - feet[2]) > G.fireflyLeave) { b.gone = true; return; }
    if ((b.t -= dt) <= 0) {
      b.t = 1 + R() * 2;
      const a = R() * TAU, v = 0.2 + R() * 0.3;
      b.vx = Math.sin(a) * v; b.vz = Math.cos(a) * v; b.vy = (R() - 0.5) * 0.3;
    }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const g = this.world.ground(b.x, b.z);
    if (Number.isFinite(g)) b.y = Math.max(g + 0.25, Math.min(g + 3, b.y));
    // a blink: dark most of its period, then a swell and a fade
    b.t2 = (b.t2 + dt) % b.rad;
    const u = b.t2 / Math.min(1.2, b.rad * 0.3);
    b.glow = u < 1 ? Math.sin(Math.PI * u) * b.fade : 0;
  }

  /** Startled where the player struck or cast: the runners within `radius` bolt. */
  scare(at, radius) {
    for (const b of this.runners) {
      if (b.state === RUNNER.burrow || Math.hypot(b.x - at[0], b.z - at[2]) > radius) continue;
      if (this.runTo(b, Math.atan2(b.x - at[0], b.z - at[2]), between(G.fleeRun, this.R))) { b.state = RUNNER.flee; b.t = 4; }
    }
  }

  offset(o) {
    for (const list of [this.runners, this.butterflies, this.fireflies]) for (const b of list) offsetBody(b, o);
  }
  clear() { this.runners = []; this.butterflies = []; this.fireflies = []; }
}
