// @ts-check
// AMBIENT-LIFE: the birds. Lone birds cross the sky, and some come down onto the roofs; birds on the roofs leave as the
// player comes near, and their neighbours follow a moment after. Flocks gather out of scattered birds, wheel, come
// down to feed and burst up when startled. Soarers circle high by day and bats hunt low at night.
import { AL_KINDS, AL_FLOCK_SIZE } from './ambientCast.js';
import { makeBody, faceVelocity, offsetBody, ringPoint, steer } from './ambientBody.js';

/** @typedef {import('./ambientBody.js').AmbientBody} AmbientBody */
/** @typedef {import('./ambientCast.js').AmbientCast} AmbientCast */
/** @typedef {import('./ambientLife.js').AmbientWorld} AmbientWorld */

const TAU = Math.PI * 2;
/** Distances in metres, times in seconds. */
export const AL_FLIGHT = Object.freeze({
  wanderRing: [35, 60], wanderAlt: [8, 28], townLift: 6, wanderLeave: 95, fleeLeave: 85,
  perchRing: [6, 75], perchKeep: 100, sitesMax: 28, siteGap: 1.0, siteTall: 2.5, siteRest: [20, 45], perchSpawnFrom: 30,
  flushNeighbour: 6, flushDelay: [0.08, 0.6], roostFlush: 0.6, fastFlush: 1.6,
  soarAlt: [45, 95], soarRadius: [25, 65], soarDrift: 120,
  batRing: 26, batAlt: [3, 16],
  flockRing: [70, 110], flockAlt: [25, 48], flockScatter: 35, flockLife: [70, 140], flockForm: 10,
  flockLandRing: [28, 60], flockGroundFor: [15, 35], flockStartle: 16, flockLeave: 220,
  fadeIn: 0.8, boxesEvery: 2, avoidEvery: 0.5, perchCheck: 1,
});
const F = AL_FLIGHT;
/** A bird's state. `pending` is still on its roof, about to go. */
export const BIRD = Object.freeze({ wander: 0, approach: 1, perch: 2, flee: 3, soar: 4, bat: 5, pending: 6 });
/** A flock's. */
export const FLOCK = Object.freeze({ sky: 0, land: 1, ground: 2, leave: 3 });

const between = (r, R) => r[0] + (r[1] - r[0]) * R();
/** The climb to a ridge: coarse steps first, then finer (metres). */
const CLIMB = Object.freeze([1, 1, 1, 0.5, 0.5, 0.25, 0.25]);
const SMALL = new Set(['sparrow', 'starling', 'parrot', 'butterfly']);

export class Flight {
  /** @param {AmbientWorld} world @param {() => number} random */
  constructor(world, random) {
    this.world = world; this.R = random;
    /** @type {AmbientBody[]} */ this.birds = [];
    /** @type {Flock[]} */ this.flocks = [];
    /** @type {{ x: number, y: number, z: number, yaw: number, bird: AmbientBody|null, rest: number }[]} */ this.sites = [];
    /** @type {{ min: ArrayLike<number>, max: ArrayLike<number> }[]} */ this.boxes = [];
    this.boxesAt = -Infinity; this.clock = 0; this.flockWait = 3; this.perchWait = 0; this.leaveWait = 0;
    this._xz = [0, 0];
  }

  /** The ground's height, the player's feet where the world has none built. */
  groundAt(x, z, feet) { const g = this.world.ground(x, z); return Number.isFinite(g) ? g : feet[1]; }

  /** A frame. `ctx.fast` the player is running; `ctx.town` buildings stand round them. @param {AmbientCast} cast */
  step(dt, feet, cast, ctx) {
    this.clock += dt;
    if (this.clock - this.boxesAt >= F.boxesEvery) this.refreshBoxes(feet);
    this.findSite(feet);
    this.keep(dt, feet, cast, ctx);
    for (const b of this.birds) {
      b.fade = Math.min(1, b.fade + dt / F.fadeIn);
      switch (b.state) {
        case BIRD.wander: this.wander(b, dt, feet, ctx); break;
        case BIRD.approach: this.approach(b, dt, feet, cast, ctx); break;
        case BIRD.perch: this.perch(b, dt, feet, cast, ctx); break;
        case BIRD.pending: if ((b.delay -= dt) <= 0) this.takeOff(b, feet); break;
        case BIRD.flee: this.flee(b, dt, feet); break;
        case BIRD.soar: this.soar(b, dt, feet); break;
        case BIRD.bat: this.bat(b, dt, feet); break;
        default: break;
      }
    }
    for (const fl of this.flocks) fl.step(dt, feet, ctx);
    if (this.birds.some((b) => b.gone)) this.birds = this.birds.filter((b) => !b.gone);
    if (this.flocks.some((f) => f.gone)) this.flocks = this.flocks.filter((f) => !f.gone);
  }

  // ---- the roofs ----------------------------------------------------------------------------------------------------
  refreshBoxes(feet) {
    this.boxesAt = this.clock;
    const all = this.world.boxes?.() ?? [];
    this.boxes = [];
    for (let i = 0; i < all.length; i++) {
      const b = all[i], cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
      if (b.max[1] - b.min[1] >= 3 && Math.hypot(cx - feet[0], cz - feet[2]) < F.perchKeep - 15) this.boxes.push(b);
    }
  }

  /** One look a frame for a perch: down onto a building's top (or anywhere in the ring), kept where the surface stands
   *  `siteTall` over the ground, then walked up to the ridge or peak (the highest of its neighbours, CLIMB's steps). */
  findSite(feet) {
    const sites = this.sites;
    for (let i = sites.length - 1; i >= 0; i--) {
      const s = sites[i];
      if (Math.hypot(s.x - feet[0], s.z - feet[2]) <= F.perchKeep) continue;
      if (s.bird && (s.bird.state === BIRD.perch || s.bird.state === BIRD.pending)) s.bird.gone = true;
      else if (s.bird) s.bird.site = null;
      sites.splice(i, 1);
    }
    if (sites.length >= F.sitesMax) return;
    const R = this.R, roof = this.world.roof;
    let x, z, top;
    if (this.boxes.length && R() < 0.8) {
      const b = this.boxes[Math.floor(R() * this.boxes.length) % this.boxes.length];
      x = b.min[0] + (0.15 + 0.7 * R()) * (b.max[0] - b.min[0]);
      z = b.min[2] + (0.15 + 0.7 * R()) * (b.max[2] - b.min[2]);
      top = b.max[1] + 1;
    } else {
      ringPoint(feet, F.perchRing[0], F.perchRing[1], R, this._xz);
      x = this._xz[0]; z = this._xz[1]; top = feet[1] + 60;
    }
    let h = roof(x, z, top);
    const g = this.world.ground(x, z);
    if (!Number.isFinite(h) || !Number.isFinite(g) || h - g < F.siteTall) return;
    let yaw = R() * TAU;
    for (const step of CLIMB) {
      const e = roof(x + step, z, top), w = roof(x - step, z, top), n = roof(x, z + step, top), s = roof(x, z - step, top);
      const best = Math.max(e, w, n, s);
      if (!(best > h + 0.01)) {
        // astride the ridge: a roof that falls away east and west runs north to south, and the bird faces across it
        if (Number.isFinite(e + w + n + s)) yaw = (Math.abs(e - w) > Math.abs(n - s) ? Math.PI / 2 : 0) + (R() < 0.5 ? 0 : Math.PI);
        continue;
      }
      if (best === e) x += step; else if (best === w) x -= step; else if (best === n) z += step; else z -= step;
      h = best;
    }
    for (const s of sites) if (Math.hypot(s.x - x, s.y - h, s.z - z) < F.siteGap) return;
    sites.push({ x, y: h, z, yaw, bird: null, rest: 0 });
  }

  /** A free perch at least `from` metres from the player, the nearest to `near` (any, without). */
  freeSite(feet, from, near = null) {
    let best = null, bd = Infinity;
    for (const s of this.sites) {
      if (s.bird || s.rest > this.clock || Math.hypot(s.x - feet[0], s.z - feet[2]) < from) continue;
      const d = near ? Math.hypot(s.x - near.x, s.z - near.z) : this.R();
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ---- the counts ---------------------------------------------------------------------------------------------------
  /** One arrival or departure a group a frame, toward the cast. @param {AmbientCast} cast */
  keep(dt, feet, cast, ctx) {
    const R = this.R;
    let wander = 0, perched = 0, soar = 0, bats = 0;
    for (const b of this.birds) {
      if (b.state === BIRD.wander) wander++;
      else if (b.state === BIRD.perch || b.state === BIRD.approach || b.state === BIRD.pending) perched++;
      else if (b.state === BIRD.soar) soar++;
      else if (b.state === BIRD.bat) bats++;
    }
    if (wander < cast.wanderers) this.spawnWanderer(feet, AL_KINDS[cast.wanderKind] ?? AL_KINDS.sparrow, ctx);
    else if (wander > cast.wanderers) {
      const b = this.birds.find((q) => q.state === BIRD.wander);
      const s = b && perched < cast.perched ? this.freeSite(feet, flushRadius(b, cast, ctx) * 1.5, b) : null;
      if (b && s) this.land(b, s); else if (b) this.leave(b, feet);
    }
    this.perchWait -= dt;
    if (perched < cast.perched && this.perchWait <= 0) {
      this.perchWait = 0.3 + R() * 1.2;
      const lone = this.birds.find((q) => q.state === BIRD.wander && R() < 0.5);
      const s = this.freeSite(feet, lone ? 10 : F.perchSpawnFrom, lone);
      if (s && lone) this.land(lone, s);
      else if (s) this.spawnPerched(s, AL_KINDS[cast.perchKind] ?? AL_KINDS.pigeon);
    }
    this.leaveWait -= dt;
    if (perched > cast.perched + 1 && this.leaveWait <= 0) {
      this.leaveWait = 5;
      const b = this.birds.find((q) => q.state === BIRD.perch && Math.hypot(q.x - feet[0], q.z - feet[2]) > 25);
      if (b) this.flush(b, feet, false);
    }
    if (soar < cast.soarers && cast.soarKind) this.spawnSoarer(feet, AL_KINDS[cast.soarKind] ?? AL_KINDS.hawk);
    else if (soar > cast.soarers) { const b = this.birds.find((q) => q.state === BIRD.soar); if (b) this.leave(b, feet); }
    if (bats < cast.bats) this.spawnBat(feet);
    else if (bats > cast.bats) { const b = this.birds.find((q) => q.state === BIRD.bat); if (b) this.leave(b, feet); }
    this.flockWait -= dt;
    const flying = this.flocks.filter((f) => f.mode !== FLOCK.leave).length;
    if (flying < cast.flocks && cast.flockKind && this.flockWait <= 0) {
      this.flockWait = 20 + R() * 40;
      this.flocks.push(new Flock(this, AL_KINDS[cast.flockKind] ?? AL_KINDS.starling, feet));
    } else if (flying > cast.flocks) { const f = this.flocks.find((q) => q.mode !== FLOCK.leave); f?.leave(feet); }
  }

  spawnWanderer(feet, kind, ctx) {
    const b = makeBody(kind, this.R);
    ringPoint(feet, F.wanderRing[0], F.wanderRing[1], this.R, this._xz);
    b.x = this._xz[0]; b.z = this._xz[1];
    b.y = this.groundAt(b.x, b.z, feet) + between(F.wanderAlt, this.R) + (ctx.town ? F.townLift : 0);
    b.state = BIRD.wander;
    this.waypoint(b, feet, ctx);
    b.vx = (b.tx - b.x) * 0.1; b.vz = (b.tz - b.z) * 0.1;
    this.birds.push(b);
  }
  spawnPerched(site, kind) {
    const b = makeBody(kind, this.R);
    b.x = site.x; b.y = site.y; b.z = site.z; b.yaw = site.yaw; b.ang = 0; b.spread = 0; b.amp = 0;
    b.state = BIRD.perch; b.site = site; b.t = 1 + this.R() * 3;
    site.bird = b;
    this.birds.push(b);
  }
  spawnSoarer(feet, kind) {
    const b = makeBody(kind, this.R), R = this.R;
    ringPoint(feet, 0, 40, R, this._xz);
    b.cx = this._xz[0]; b.cz = this._xz[1];
    b.rad = between(F.soarRadius, R) * (R() < 0.5 ? -1 : 1); b.ang = R() * TAU;
    b.ty = this.groundAt(b.cx, b.cz, feet) + between(F.soarAlt, R) * (kind === AL_KINDS.gull ? 0.6 : 1);
    b.x = b.cx + Math.sin(b.ang) * Math.abs(b.rad); b.z = b.cz + Math.cos(b.ang) * Math.abs(b.rad); b.y = b.ty;
    b.state = BIRD.soar; b.fade = 0;
    this.birds.push(b);
  }
  spawnBat(feet) {
    const b = makeBody(AL_KINDS.bat, this.R);
    ringPoint(feet, 15, F.batRing + 6, this.R, this._xz);
    b.x = this._xz[0]; b.z = this._xz[1]; b.y = this.groundAt(b.x, b.z, feet) + between(F.batAlt, this.R);
    b.state = BIRD.bat; b.amp = 1.1;
    this.birds.push(b);
  }

  // ---- the states ---------------------------------------------------------------------------------------------------
  /** A lone bird's next point: on ahead of it while it is near the player, back toward them once it strays. */
  waypoint(b, feet, ctx) {
    const R = this.R, away = Math.hypot(b.x - feet[0], b.z - feet[2]);
    if (away > 50 || R() < 0.3) { ringPoint(feet, 10, 55, R, this._xz); b.tx = this._xz[0]; b.tz = this._xz[1]; }
    else { const a = b.yaw + (R() - 0.5) * 2, r = 15 + R() * 20; b.tx = b.x + Math.sin(a) * r; b.tz = b.z + Math.cos(a) * r; }
    b.ty = this.groundAt(b.tx, b.tz, feet) + between(F.wanderAlt, R) + (ctx.town ? F.townLift : 0);
    b.t = 4 + R() * 6;
  }

  /** The beat: small birds bound (a burst of wingbeats, then wings shut); big ones flap and hold their wings to glide. */
  beat(b, dt, flapFor, glideFor) {
    if ((b.t2 -= dt) <= 0) { b.held = !b.held; b.t2 = b.held ? glideFor * (0.6 + this.R() * 0.8) : flapFor * (0.6 + this.R() * 0.8); }
    const small = SMALL.has(b.kind.name);
    const spread = b.held && small ? 0.15 : 1, amp = b.held ? (small ? 0.4 : 0.04) : 0.95;
    b.spread += (spread - b.spread) * Math.min(1, dt * 12); b.amp += (amp - b.amp) * Math.min(1, dt * 6);
    if (!b.held || small) b.phase += dt * b.flapHz * TAU;
    else b.phase += (Math.round(b.phase / TAU) * TAU + 0.3 - b.phase) * Math.min(1, dt * 3);   // the wings eased level
  }

  /** A body heading into a wall, a roof or a hillside climbs over it (one ray down ahead of it and the ground there,
   *  every `avoidEvery` seconds). */
  clearAhead(b, dt) {
    if ((b.look -= dt) > 0) return;
    b.look = F.avoidEvery;
    const x = b.x + b.vx * 1.5, z = b.z + b.vz * 1.5, g = this.world.ground(x, z);
    const h = Math.max(this.world.roof(x, z, b.y + 3), Number.isFinite(g) ? g + 1.5 : -Infinity);
    if (h > b.y - 1.5) { b.vy = Math.max(b.vy, 4); b.ty = Math.max(b.ty, h + 4); }
  }

  wander(b, dt, feet, ctx) {
    if ((b.t -= dt) <= 0 || Math.hypot(b.tx - b.x, b.tz - b.z) < 4) this.waypoint(b, feet, ctx);
    const big = !SMALL.has(b.kind.name);
    this.beat(b, dt, big ? 1.6 : 0.5, big ? 2 : 0.3);
    this.clearAhead(b, dt);
    steer(b, dt, b.tx, b.ty, b.tz, b.kind.speed, 1.4);
    faceVelocity(b, dt, 3);
    if (Math.hypot(b.x - feet[0], b.z - feet[2]) > F.wanderLeave) b.gone = true;
  }

  /** A lone bird sent to a perch. */
  land(b, site) { b.state = BIRD.approach; b.site = site; site.bird = b; b.t = 25; }

  approach(b, dt, feet, cast, ctx) {
    const s = b.site;
    if (!s || s.bird !== b || (b.t -= dt) <= 0 || Math.hypot(s.x - feet[0], s.y - feet[1] - 1, s.z - feet[2]) < flushRadius(b, cast, ctx)) {
      if (s?.bird === b) s.bird = null;
      b.site = null; b.state = BIRD.wander; this.waypoint(b, feet, ctx);
      return;
    }
    const h = Math.hypot(s.x - b.x, s.z - b.z);
    if (h > 5) {
      // the run-in: above and short of the perch, then down onto it
      const k = 3 / h;
      this.beat(b, dt, 0.8, 0.6);
      steer(b, dt, s.x - (s.x - b.x) * k, s.y + 2.5, s.z - (s.z - b.z) * k, b.kind.speed, 2);
      faceVelocity(b, dt, 4);
      return;
    }
    const d = Math.hypot(h, s.y - b.y);
    b.spread += (1 - b.spread) * Math.min(1, dt * 8); b.amp = 0.6; b.phase += dt * b.flapHz * 1.3 * TAU;
    steer(b, dt, s.x, s.y, s.z, Math.max(1.2, Math.min(6, d * 1.4)), 4);
    faceVelocity(b, dt, 5);
    b.pitch += (0.55 - b.pitch) * Math.min(1, dt * 6);   // the flare
    if (d < 0.3) {
      b.x = s.x; b.y = s.y; b.z = s.z; b.vx = b.vy = b.vz = 0; b.bank = 0;
      b.yaw = s.yaw; b.ang = 0; b.state = BIRD.perch; b.t = 1 + this.R() * 3; b.t2 = 0;
    }
  }

  perch(b, dt, feet, cast, ctx) {
    const s = b.site;
    if (Math.hypot(b.x - feet[0], b.y - feet[1] - 1, b.z - feet[2]) < flushRadius(b, cast, ctx)) { this.flush(b, feet, true); return; }
    // what it sits on is looked at once a second: a ship that sails, a town rebuilt, and the perch is gone with it
    if (s && (b.look -= dt) <= 0) {
      b.look = F.perchCheck;
      if (!(Math.abs(this.world.roof(s.x, s.z, s.y + 1.5) - s.y) < 0.3)) {
        this.sites.splice(this.sites.indexOf(s), 1); s.bird = null; b.site = null;
        this.flush(b, feet, false);
        return;
      }
    }
    let spread = 0, y = s ? s.y : b.y;
    if (b.t2 > 0) {   // a hop or a shake of the wings
      b.t2 -= dt;
      if (b.held) y += Math.sin(Math.PI * Math.max(0, b.t2) / 0.25) * 0.12; else spread = 0.6;
    } else if ((b.t -= dt) <= 0) {
      const r = this.R();
      b.t = 1.5 + this.R() * 4;
      // a look about stays near the way the perch faces (`ang` which of its two sides); an about-turn hops
      const face = (s ? s.yaw : b.yaw) + b.ang;
      if (r < 0.5) b.yaw = face + (this.R() - 0.5) * 1.2;
      else if (r < 0.65) { b.ang = Math.PI - b.ang; b.yaw = face + Math.PI; b.held = true; b.t2 = 0.25; }
      else if (r < 0.85) { b.held = false; b.t2 = 0.3; }
    }
    b.y = y;
    b.spread += (spread - b.spread) * Math.min(1, dt * 14); b.amp = 0.5; b.phase += dt * 20;
    b.pitch += (0.15 - b.pitch) * Math.min(1, dt * 6); b.bank = 0;
  }

  /** The bird on its roof leaves, and its neighbours on the roofs go a moment after it (`spread` false: it alone). */
  flush(b, feet, spread) {
    b.state = BIRD.pending; b.delay = this.R() * 0.12;
    if (!spread) return;
    for (const q of this.birds) {
      if (q === b || q.state !== BIRD.perch || Math.hypot(q.x - b.x, q.y - b.y, q.z - b.z) > F.flushNeighbour) continue;
      q.state = BIRD.pending; q.delay = between(F.flushDelay, this.R);
    }
  }

  takeOff(b, feet) {
    const R = this.R;
    if (b.site) { if (b.site.bird === b) { b.site.bird = null; b.site.rest = this.clock + between(F.siteRest, R); } b.site = null; }
    let ax = b.x - feet[0], az = b.z - feet[2];
    const l = Math.hypot(ax, az);
    if (l < 0.01) { const a = R() * TAU; ax = Math.sin(a); az = Math.cos(a); } else { ax /= l; az /= l; }
    const j = (R() - 0.5) * 1.6, c = Math.cos(j), s = Math.sin(j);
    [ax, az] = [ax * c - az * s, ax * s + az * c];
    b.vx = ax * 3.5; b.vz = az * 3.5; b.vy = 4.5 + R() * 2;
    b.tx = b.x + ax * 120; b.ty = b.y + 20 + R() * 15; b.tz = b.z + az * 120;
    b.state = BIRD.flee; b.spread = 1; b.amp = 1.1; b.held = false; b.t2 = 2 + R(); b.flapHz *= 1.2;
  }

  /** Off and away: past `fleeLeave` it is gone. */
  leave(b, feet) {
    if (b.site?.bird === b) b.site.bird = null;
    b.site = null;
    const a = Math.atan2(b.x - feet[0], b.z - feet[2]) + (this.R() - 0.5);
    b.tx = feet[0] + Math.sin(a) * 160; b.tz = feet[2] + Math.cos(a) * 160; b.ty = b.y + 25;
    b.state = BIRD.flee; b.t2 = 0;
  }

  flee(b, dt, feet) {
    this.beat(b, dt, 2, SMALL.has(b.kind.name) ? 0.25 : 1);
    this.clearAhead(b, dt);
    steer(b, dt, b.tx, b.ty, b.tz, b.kind.speed * 1.25, 1.1);
    faceVelocity(b, dt, 3.5);
    if (Math.hypot(b.x - feet[0], b.z - feet[2]) > F.fleeLeave) b.gone = true;
  }

  soar(b, dt, feet) {
    const R = this.R, r = Math.abs(b.rad), dir = Math.sign(b.rad) || 1, v = b.kind.speed;
    if (Math.hypot(b.cx - feet[0], b.cz - feet[2]) > F.soarDrift) {
      const a = Math.atan2(feet[0] - b.cx, feet[2] - b.cz);
      b.cx += Math.sin(a) * 4 * dt; b.cz += Math.cos(a) * 4 * dt;
    }
    b.ang += (v / r) * dt * dir;
    const nx = b.cx + Math.sin(b.ang) * r, nz = b.cz + Math.cos(b.ang) * r, ny = b.ty + Math.sin(this.clock * 0.15 + b.phase) * 5;
    b.vx = (nx - b.x) / Math.max(dt, 1e-3); b.vy = (ny - b.y) / Math.max(dt, 1e-3); b.vz = (nz - b.z) / Math.max(dt, 1e-3);
    b.x = nx; b.y = ny; b.z = nz;
    faceVelocity(b, dt, 6);
    b.bank = -dir * 0.35;
    // a few wingbeats now and then, the rest held out on the air
    if ((b.t2 -= dt) <= 0) { b.held = !b.held; b.t2 = b.held ? 6 + R() * 8 : 1 + R(); }
    b.amp += ((b.held ? 0.03 : 0.6) - b.amp) * Math.min(1, dt * 4); b.spread = 1;
    if (!b.held) b.phase += dt * b.flapHz * TAU;
  }

  bat(b, dt, feet) {
    const R = this.R;
    if ((b.t -= dt) <= 0) {
      ringPoint(feet, 3, F.batRing, R, this._xz);
      b.tx = this._xz[0]; b.tz = this._xz[1]; b.ty = this.groundAt(b.tx, b.tz, feet) + between(F.batAlt, R);
      b.t = 0.25 + R() * 0.7;
    }
    this.clearAhead(b, dt);
    steer(b, dt, b.tx, b.ty, b.tz, b.kind.speed, 5);
    faceVelocity(b, dt, 9);
    b.phase += dt * b.flapHz * TAU; b.spread = 1;
  }

  /** Startled where the player struck or cast: the roofs within `radius` empty, the flocks there take off. */
  scare(at, radius) {
    for (const b of this.birds) if (b.state === BIRD.perch && Math.hypot(b.x - at[0], b.y - at[1], b.z - at[2]) < radius) this.flush(b, at, false);
    for (const f of this.flocks) if (f.mode === FLOCK.ground && f.near(at, radius)) f.takeOff(at);
  }

  offset(o) {
    for (const b of this.birds) offsetBody(b, o);
    for (const f of this.flocks) f.offset(o);
    for (const s of this.sites) { s.x += o[0]; s.y += o[1]; s.z += o[2]; }
    this.boxes = []; this.boxesAt = -Infinity;   // the host's boxes are read again in the new frame
  }
  clear() { this.birds = []; this.flocks = []; this.sites = []; this.boxes = []; this.boxesAt = -Infinity; this.flockWait = 3; }
  /** Every bird drawn. */
  *bodies() { yield* this.birds; for (const f of this.flocks) yield* f.members; }
}

/** How near the player comes before a bird goes: its kind's, nearer at night (a roost), further from a runner. */
export function flushRadius(b, cast, ctx) {
  return b.kind.flush * (cast.roost ? F.roostFlush : 1) * (ctx.fast ? F.fastFlush : 1);
}

/** A flock: scattered birds that gather on an anchor that wanders the sky, come down to feed, and burst up. */
export class Flock {
  /** @param {Flight} flight @param {import('./ambientCast.js').AmbientKind} kind */
  constructor(flight, kind, feet) {
    const R = flight.R, size = /** @type {Record<string, readonly number[]>} */ (AL_FLOCK_SIZE)[kind.name] ?? [10, 20], n = Math.round(size[0] + (size[1] - size[0]) * R());
    this.flight = flight; this.kind = kind; this.gone = false;
    /** @type {number} */ this.mode = FLOCK.sky;
    this.age = 0; this.life = between(F.flockLife, R); this.formed = 0; this.t = 0; this.groundFor = 0; this.landed = -Infinity;
    const p = ringPoint(feet, F.flockRing[0], F.flockRing[1], R, [0, 0]);
    this.ax = p[0]; this.az = p[1]; this.ay = flight.groundAt(p[0], p[1], feet) + between(F.flockAlt, R);
    this.gx = this.ax; this.gy = this.ay; this.gz = this.az;   // where the anchor heads
    /** @type {AmbientBody[]} */ this.members = [];
    for (let i = 0; i < n; i++) {
      const b = makeBody(kind, R), a = R() * TAU, r = F.flockScatter * Math.sqrt(R());
      b.x = this.ax + Math.sin(a) * r; b.z = this.az + Math.cos(a) * r; b.y = this.ay + (R() - 0.5) * 16;
      const h = R() * TAU; b.vx = Math.sin(h) * kind.speed; b.vz = Math.cos(h) * kind.speed;
      b.state = 0; b.fade = 0;
      this.members.push(b);
    }
    this.retarget(feet);
  }

  retarget(feet) {
    const R = this.flight.R, xz = [0, 0];
    this.t = 5 + R() * 5;
    if (R() < 0.25) {   // a wheel: across to the far side of the player
      const a = Math.atan2(feet[0] - this.ax, feet[2] - this.az), r = 40 + R() * 40;
      xz[0] = feet[0] + Math.sin(a) * r; xz[1] = feet[2] + Math.cos(a) * r;
    } else ringPoint(feet, 30, 90, R, xz);
    this.gx = xz[0]; this.gz = xz[1]; this.gy = this.flight.groundAt(xz[0], xz[1], feet) + between(F.flockAlt, R);
  }

  /** Open ground to feed on: dry, under no roof, not too near the player. */
  feedingGround(feet) {
    const w = this.flight.world, xz = [0, 0];
    for (let k = 0; k < 4; k++) {
      ringPoint(feet, F.flockLandRing[0], F.flockLandRing[1], this.flight.R, xz);
      const g = w.ground(xz[0], xz[1]);
      if (!Number.isFinite(g) || w.wet(xz[0], xz[1])) continue;
      const h = w.roof(xz[0], xz[1], g + 40);
      if (Number.isFinite(h) && h > g + 0.3) continue;
      return [xz[0], g, xz[1]];
    }
    return null;
  }

  near(at, r) { return this.members.some((b) => Math.hypot(b.x - at[0], b.y - at[1], b.z - at[2]) < r); }

  leave(feet) {
    const a = Math.atan2(this.ax - feet[0], this.az - feet[2]);
    if (this.mode === FLOCK.ground || this.mode === FLOCK.land) this.takeOff(feet);
    this.mode = FLOCK.leave;
    this.gx = feet[0] + Math.sin(a) * 400; this.gz = feet[2] + Math.cos(a) * 400; this.gy = this.ay + 40;
  }

  /** Up all at once, the nearest to the player first, away from them. */
  takeOff(feet) {
    const R = this.flight.R;
    let near = Infinity;
    for (const b of this.members) near = Math.min(near, Math.hypot(b.x - feet[0], b.z - feet[2]));
    for (const b of this.members) {
      if (b.state === 0) continue;
      b.state = 3; b.delay = R() * 0.35 + (Math.hypot(b.x - feet[0], b.z - feet[2]) - near) * 0.03;
    }
    const a = Math.atan2(this.ax - feet[0], this.az - feet[2]);
    this.gx = this.ax + Math.sin(a) * 40; this.gz = this.az + Math.cos(a) * 40; this.gy = this.ay + 25;
    this.mode = FLOCK.sky; this.t = 6; this.formed = Math.min(this.formed, 0.3 * F.flockForm); this.landed = this.age;
  }

  step(dt, feet, ctx) {
    const fl = this.flight, R = fl.R, m = this.members, n = m.length;
    this.age += dt; this.formed += dt;
    if (this.mode !== FLOCK.leave && this.age > this.life) this.leave(feet);
    if (this.mode === FLOCK.sky && (this.t -= dt) <= 0) {
      const spot = this.formed > F.flockForm && this.age - this.landed > 30 && R() < 0.3 ? this.feedingGround(feet) : null;
      if (spot) {
        this.mode = FLOCK.land; this.ax = spot[0]; this.ay = spot[1]; this.az = spot[2]; this.t = 25;
        for (const b of m) {   // each its own patch of the ground
          const a = R() * TAU, r = 1 + R() * 5;
          b.tx = spot[0] + Math.sin(a) * r; b.tz = spot[2] + Math.cos(a) * r;
          const g = fl.world.ground(b.tx, b.tz); b.ty = Number.isFinite(g) ? g : spot[1];
        }
      } else this.retarget(feet);
    }
    if (this.mode === FLOCK.sky || this.mode === FLOCK.leave) {
      const dx = this.gx - this.ax, dy = this.gy - this.ay, dz = this.gz - this.az, d = Math.hypot(dx, dy, dz);
      if (d > 0.5) { const k = Math.min(d, (this.mode === FLOCK.leave ? 12 : 9) * dt) / d; this.ax += dx * k; this.ay += dy * k; this.az += dz * k; }
    }
    // the flying members' centre
    let cx = 0, cy = 0, cz = 0, cn = 0;
    for (const b of m) if (b.state === 0) { cx += b.x; cy += b.y; cz += b.z; cn++; }
    if (cn) { cx /= cn; cy /= cn; cz /= cn; }
    const floor = fl.groundAt(cn ? cx : this.ax, cn ? cz : this.az, feet) + 8;
    const coh = Math.min(1, 0.1 + this.formed / F.flockForm);
    let grounded = 0, startled = false;
    const startle = F.flockStartle * (ctx.fast ? F.fastFlush : 1);
    for (let i = 0; i < n; i++) {
      const b = m[i];
      b.fade = Math.min(1, b.fade + dt / 1.5);
      if (b.state === 0) this.fly(b, i, dt, cx, cy, cz, coh, floor);
      else if (b.state === 2) { grounded++; this.feed(b, dt); }
      else if (b.state === 3 && (b.delay -= dt) <= 0) {
        const a = Math.atan2(b.x - feet[0], b.z - feet[2]) + (R() - 0.5);
        b.vx = Math.sin(a) * 3; b.vz = Math.cos(a) * 3; b.vy = 5 + R() * 2; b.state = 0; b.spread = 1;
      }
      if (b.state === 2 && Math.hypot(b.x - feet[0], b.z - feet[2]) < startle) startled = true;
    }
    if (this.mode === FLOCK.land) {
      this.t -= dt;
      if (grounded === n || this.t <= 0) { this.mode = FLOCK.ground; this.groundFor = between(F.flockGroundFor, R); }
    } else if (this.mode === FLOCK.ground && ((this.groundFor -= dt) <= 0 || grounded === 0)) this.takeOff(feet);
    if (startled && (this.mode === FLOCK.ground || this.mode === FLOCK.land)) this.takeOff(feet);
    if (this.mode === FLOCK.leave && Math.hypot(this.ax - feet[0], this.az - feet[2]) > F.flockLeave
      && (!cn || Math.hypot(cx - feet[0], cz - feet[2]) > F.flockLeave)) this.gone = true;
  }

  /** Separation, alignment, cohesion and the anchor's pull (Reynolds' boids), held over the ground. */
  fly(b, i, dt, cx, cy, cz, coh, floor) {
    const m = this.members, k = this.kind;
    let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, an = 0;
    for (let j = 0; j < m.length; j++) {
      const q = m[j];
      if (j === i || q.state !== 0) continue;
      const dx = b.x - q.x, dy = b.y - q.y, dz = b.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 3.2) { const w = 1 / (d2 + 0.05); sx += dx * w; sy += dy * w; sz += dz * w; }
      if (d2 < 64) { ax += q.vx; ay += q.vy; az += q.vz; an++; }
    }
    // the anchor: the sky's wandering point, or each bird's own patch of the ground on the way down
    const landing = this.mode === FLOCK.land || this.mode === FLOCK.ground;
    const gx = (landing ? b.tx : this.ax) - b.x, gy = (landing ? b.ty : this.ay) - b.y, gz = (landing ? b.tz : this.az) - b.z;
    const gl = Math.hypot(gx, gy, gz) || 1;
    b.spread = 1; b.amp = 0.9; b.phase += dt * b.flapHz * TAU;
    if (landing) {
      // the way down is each bird's own: straight at its patch, slowing as it nears, only kept off its neighbours
      const want = Math.max(1.2, Math.min(k.speed, gl * 1.1)), e = Math.min(1, dt * 3);
      b.vx += ((gx / gl) * want + sx * 0.4 - b.vx) * e; b.vy += ((gy / gl) * want - b.vy) * e; b.vz += ((gz / gl) * want + sz * 0.4 - b.vz) * e;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      faceVelocity(b, dt, 6);
      b.pitch += (0.4 - b.pitch) * Math.min(1, dt * 4);
      if (gl < 0.6) { b.x = b.tx; b.y = b.ty; b.z = b.tz; b.vx = b.vy = b.vz = 0; b.state = 2; b.t = this.flight.R() * 2; b.bank = 0; }
      return;
    }
    const pull = 4 * Math.min(1, gl / 15);
    let ux = 0, uy = 0, uz = 0;
    if (an) { ux += (ax / an - b.vx) * 0.9; uy += (ay / an - b.vy) * 0.9; uz += (az / an - b.vz) * 0.9; }
    const tx = cx - b.x, ty = cy - b.y, tz = cz - b.z, tl = Math.hypot(tx, ty, tz) || 1;
    ux += (tx / tl) * coh * 3; uy += (ty / tl) * coh * 3; uz += (tz / tl) * coh * 3;
    ux += (gx / gl) * pull; uy += (gy / gl) * pull; uz += (gz / gl) * pull;
    ux += sx * 1.4; uy += sy * 1.4; uz += sz * 1.4;
    if (b.y < floor) uy += (floor - b.y) * 0.8;
    const ease = Math.min(1, dt * 2.2);
    b.vx += ux * ease; b.vy += uy * ease; b.vz += uz * ease;
    const sp = Math.hypot(b.vx, b.vy, b.vz) || 1, want = Math.max(k.speed * 0.65, Math.min(k.speed * 1.35, sp));
    b.vx *= want / sp; b.vy *= want / sp; b.vz *= want / sp;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    faceVelocity(b, dt, 5);
  }

  /** A bird on the ground: a hop now and then, and pecks. */
  feed(b, dt) {
    const R = this.flight.R;
    b.spread += (0 - b.spread) * Math.min(1, dt * 10); b.amp = 0.4; b.phase += dt * 12;
    if ((b.t -= dt) <= 0) {
      b.t = 0.6 + R() * 2;
      b.t2 = 0.25; b.yaw += (R() - 0.5) * 2.4;
      const x = b.x + Math.sin(b.yaw) * 0.4, z = b.z + Math.cos(b.yaw) * 0.4, g = this.flight.world.ground(x, z);
      if (Number.isFinite(g) && !this.flight.world.wet(x, z)) { b.tx = x; b.tz = z; b.ty = g; } else { b.tx = b.x; b.tz = b.z; }
    }
    if (b.t2 > 0) {
      const k = Math.min(1, dt / b.t2);
      b.t2 -= dt;
      b.x += (b.tx - b.x) * k; b.z += (b.tz - b.z) * k; b.y = b.ty + Math.sin(Math.PI * Math.max(0, b.t2) / 0.25) * 0.1;
      b.pitch = 0.1;
    } else b.pitch = Math.sin(this.age * 7 + b.phase) > 0.6 ? -0.6 : 0.05;   // a peck
  }

  offset(o) {
    for (const b of this.members) offsetBody(b, o);
    this.ax += o[0]; this.ay += o[1]; this.az += o[2]; this.gx += o[0]; this.gy += o[1]; this.gz += o[2];
  }
}
