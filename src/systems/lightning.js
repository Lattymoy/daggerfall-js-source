// @ts-check
// BOLT (2026-09-24, Mac: "Can we do detailed cloud and cloud to ground
// lighting? Not just when in storms but also being able to be seen far
// away?"): THE LIGHTNING ITSELF.
//
// Until now a storm's lightning was only light: the storm overhead
// strobed the sun (DFU's LightningPlayer, world/weather.js) and a storm at
// a distance lit its own cloud (WEATHER3d, systems/distantStorms.js). No
// channel was ever drawn. This is the flash as it is seen:
// - A STRIKE is cloud-to-ground (a channel from the cloud's base to the
//   land, CG_SHARE of them, as in a real storm) or in-cloud (the cloud
//   lit from inside, no channel below it).
// - Its LIGHT is a train of return strokes: a CG strike re-fires down the
//   same channel two to four times tens of milliseconds apart, each stroke
//   a sharp peak with a short glow after it; an in-cloud flash is a softer
//   train of pulses spread over most of a second. `flickerAt` is that
//   brightness, and the channel, the cloud and the ground all read it.
// - Its CHANNEL is a stepped leader: short steps down from the base with
//   a sideways kink at each, branches that split off and die out before the
//   ground, the main channel alone reaching it (`boltPath`).
// Every strike is a function of a seed, so a storm's strikes (seeded by
// the storm and the minute, distantStorms.js) are the same channel, the
// same flicker, for everyone who sees them.
//
// PURE. `createBoltField` is the hosts' small store of the strikes
// burning now.

import { seededRng } from './wind.js';

/** The share of strikes that reach the ground - a storm's flashes are
 *  mostly in the cloud (roughly three in ten reach the ground). */
export const CG_SHARE = 0.3;
/** Real seconds a strike can burn: its last stroke's glow is gone by then. */
export const BOLT_LIFE_S = 1.0;
/** A return stroke's peak falls away over this (seconds)... */
export const STROKE_DECAY_S = 0.035;
/** ...and the channel glows on after it over this, at GLOW_SHARE of the peak. */
export const GLOW_DECAY_S = 0.18;
export const GLOW_SHARE = 0.18;
/** A leader's step, metres - the length between the channel's kinks. */
export const LEADER_STEP_M = 30;
/** How far a step may kink sideways, as a share of its length. */
export const LEADER_KINK = 0.55;
/** A branch splits off a step of the main channel at this chance. */
export const BRANCH_CHANCE = 0.14;

/**
 * A strike's kind and the train of strokes it fires, from its seed. CG:
 * two to four strokes, the first the brightest, 40-110 ms apart. IC: two
 * to five softer pulses over up to 0.8 s. `force` sets the kind
 * (a host's own strike that knows it). Pure.
 * @param {number} seed
 * @param {'cg'|'ic'} [force]
 */
export function strikeOf(seed, force) {
  const r = seededRng(seed >>> 0);
  const kind = force ?? (r() < CG_SHARE ? 'cg' : 'ic');
  const strokes = [];
  if (kind === 'cg') {
    const n = 2 + Math.floor(r() * 3);
    let t = 0;
    for (let i = 0; i < n; i++) {
      strokes.push({ t, peak: i === 0 ? 1 : 0.45 + 0.4 * r() });
      t += 0.04 + 0.07 * r();
    }
  } else {
    const n = 2 + Math.floor(r() * 4);
    let t = 0;
    for (let i = 0; i < n; i++) {
      strokes.push({ t, peak: 0.35 + 0.45 * r() });
      t += 0.06 + 0.18 * r();
    }
  }
  return { kind, strokes, seed: seed >>> 0 };
}

/** A strike's brightness `age` seconds after it fired, 0..1: each stroke a
 *  sharp peak that falls away over STROKE_DECAY_S with a glow over
 *  GLOW_DECAY_S after it; dark before the first and past BOLT_LIFE_S. */
export function flickerAt(strike, age) {
  if (!(age >= 0) || age >= BOLT_LIFE_S) return 0;
  let b = 0;
  for (const s of strike.strokes) {
    const a = age - s.t;
    if (a < 0) continue;
    b += s.peak * (Math.exp(-a / STROKE_DECAY_S) + GLOW_SHARE * Math.exp(-a / GLOW_DECAY_S));
  }
  return Math.min(1, b);
}

/**
 * A cloud-to-ground channel from `top` ([x, y, z], the cloud's base) down
 * to the ground at `groundY`: a stepped leader of LEADER_STEP_M steps,
 * each kinked sideways (the kink carries a little of the last one's
 * heading, so the channel wanders rather than jitters), with branches that
 * split off, fork again, thin and die before the ground. Answers the
 * segments as a flat Float32Array of [x0, y0, z0, x1, y1, z1, weight] -
 * weight 1 the main channel, less for a branch and less again along it.
 * The main channel ends on the ground exactly. Pure.
 */
export function boltPath(seed, top, groundY) {
  const r = seededRng((seed ^ 0x5bd1e995) >>> 0);
  const out = [];
  const height = Math.max(1, top[1] - groundY);
  const n = Math.max(6, Math.min(80, Math.round(height / LEADER_STEP_M)));
  const dy = height / n;
  let x = top[0], y = top[1], z = top[2], hx = 0, hz = 0;
  const kink = () => (r() - 0.5) * 2 * LEADER_KINK * dy;
  for (let i = 0; i < n; i++) {
    hx = 0.45 * hx + kink(); hz = 0.45 * hz + kink();
    // each step takes its share of the height still to fall, give or take a quarter, the last all of it
    const ey = i === n - 1 ? groundY : Math.max(groundY, y - ((y - groundY) / (n - i)) * (0.75 + 0.5 * r()));
    const nx = x + hx, nz = z + hz;
    out.push(x, y, z, nx, ey, nz, 1);
    // a branch off this step, never off the last fifth - a branch reaching the ground is another channel
    if (i < n * 0.8 && r() < BRANCH_CHANCE) branch(nx, ey, nz, hx, hz, Math.round((n - i) * (0.2 + 0.4 * r())), 0.55, 1);
    x = nx; y = ey; z = nz;
    if (y <= groundY) break;
  }
  function branch(bx, by, bz, px, pz, steps, w, depth) {
    // out to the side the parent leans, a little further each step, falling slower than the main channel
    const ox = (r() - 0.5) * 2, oz = (r() - 0.5) * 2, l = Math.hypot(ox, oz) || 1;
    let ax = px * 0.5 + (ox / l) * dy * 0.6, az = pz * 0.5 + (oz / l) * dy * 0.6;
    for (let k = 0; k < steps; k++) {
      ax = 0.5 * ax + kink(); az = 0.5 * az + kink();
      const cx = bx + ax, cz = bz + az, cy = Math.max(groundY + dy, by - dy * (0.4 + 0.5 * r()));
      const wk = w * (1 - k / Math.max(1, steps));
      out.push(bx, by, bz, cx, cy, cz, wk);
      if (depth < 2 && r() < BRANCH_CHANCE * 0.6) branch(cx, cy, cz, ax, az, Math.round((steps - k) * 0.5), wk * 0.6, depth + 1);
      bx = cx; by = cy; bz = cz;
    }
  }
  return new Float32Array(out);
}

/**
 * The hosts' store of the strikes burning now. `add({ x, z, groundY, baseY,
 * seed, strength, kind?, at })` - a strike at (x, z) in host metres, its
 * cloud's base `baseY` and the ground `groundY` there, `strength` 0..1 (a
 * storm's envelope), fired at real second `at`. `tick(seconds, eye)`
 * answers `{ bolts, flash }`: the channels to draw (`{ segs, bright }`,
 * CG strikes only - an in-cloud flash has no channel below its cloud) and
 * the light the nearest burning ground strike throws on the land (a
 * renderer flash light `{ x, y, z, range, color }`, or null) - near
 * enough to light it (FLASH_REACH_M), by its own flicker and distance.
 * The light stands where the land around the player is lit FROM the
 * strike's side - FLASH_TOWARD_M toward it and FLASH_UP_M up, reaching
 * FLASH_RANGE_M - as Dynamic Skies' own flash stands over the player: the
 * lane's lights are clustered and fall off over their range, and a light
 * at the strike's foot kilometres off lights nothing the player can see.
 */
export const FLASH_TOWARD_M = 300;
export const FLASH_UP_M = 250;
export const FLASH_RANGE_M = 900;
export const FLASH_REACH_M = 3500;
export const FLASH_COLOR = Object.freeze([0.78, 0.84, 1.0]);
export function createBoltField() {
  const live = [];
  return {
    add(s) {
      if (s.tag) for (let i = live.length - 1; i >= 0; i--) if (live[i].tag === s.tag) live.splice(i, 1);   // a tagged strike replaces its own
      const strike = strikeOf(s.seed, s.kind);
      const segs = strike.kind === 'cg' ? boltPath(strike.seed, [s.x, s.baseY, s.z], s.groundY) : null;
      live.push({ ...s, strike, segs });
      if (live.length > 16) live.shift();
      return strike;
    },
    tick(seconds, eye) {
      for (let i = live.length - 1; i >= 0; i--) if (seconds - live[i].at >= BOLT_LIFE_S || seconds < live[i].at - 1) live.splice(i, 1);
      const bolts = [];
      let flash = null, best = 0;
      for (const b of live) {
        const bright = flickerAt(b.strike, seconds - b.at) * (b.strength ?? 1);
        if (bright <= 0) continue;
        if (b.segs) bolts.push({ segs: b.segs, bright });
        if (b.strike.kind !== 'cg' || !eye) continue;
        const d = Math.hypot(b.x - eye[0], b.z - eye[2]);
        const reach = bright * (1 - d / FLASH_REACH_M);
        if (reach > best) {
          best = reach;
          const k = 3 * reach, t = Math.min(d, FLASH_TOWARD_M) / Math.max(d, 1e-6);
          flash = { x: eye[0] + (b.x - eye[0]) * t, y: eye[1] + FLASH_UP_M, z: eye[2] + (b.z - eye[2]) * t, range: FLASH_RANGE_M, color: [FLASH_COLOR[0] * k, FLASH_COLOR[1] * k, FLASH_COLOR[2] * k] };
        }
      }
      return { bolts, flash };
    },
    /** The strikes burning (tests, and a jump). */
    count() { return live.length; },
    reset() { live.length = 0; },
  };
}

/** Metres - the Earth's mean radius, for how far a distant strike's foot has dropped below the eye's level. */
export const EARTH_R = 6371000;
/**
 * The column a strike at (x, z) stands in, seen from `eye` ([x, y, z], host metres): its cloud's base
 * `baseAbove` metres above the eye (the sky march's own frame: a cell's base is metres above the eye) and its ground
 * `eyeHeight` below it, both dropped by the Earth's curve at that distance (d^2 / 2R - seventy metres at thirty
 * kilometres, so a far strike's foot goes down behind the horizon as it should). Pure.
 */
export function strikeColumn(eye, x, z, baseAbove, eyeHeight) {
  const d = Math.hypot(x - eye[0], z - eye[2]);
  const drop = (d * d) / (2 * EARTH_R);
  return { baseY: eye[1] + baseAbove - drop, groundY: eye[1] - eyeHeight - drop };
}

/**
 * THE STORM OVERHEAD'S OWN STRIKES. DFU's LightningPlayer (world/weather.js) keeps the storm's schedule - its
 * clip class and its flash budget - and the port's sun strobe rides it. Each of its strikes now also lands
 * somewhere: from its seed, a bearing and a distance - a crack ('short', 'thunder') close, 600 m to 4 km, a
 * roll far, 2.5 to 8 km - and a kind: a crack reaches the ground more often than not (LOCAL_CG_SHARE), a roll is
 * mostly in the cloud. Pure.
 */
export const LOCAL_CG_SHARE = 0.6;
export function localStrike(seed, clipClass) {
  const r = seededRng((seed ^ 0x2545f491) >>> 0);
  const far = clipClass === 'roll';
  const distance = far ? 2500 + 5500 * r() : 600 + 3400 * r();
  const bearing = r() * 2 * Math.PI;
  const kind = r() < (far ? CG_SHARE * 0.5 : LOCAL_CG_SHARE) ? 'cg' : 'ic';
  return { dx: Math.sin(bearing) * distance, dz: Math.cos(bearing) * distance, distance, kind };
}

/** The base of a thunderstorm's cloud above the eye, metres - the sky's own thunder profile (volumetricClouds.js
 *  VC_PROFILE.thunder.base); the channel starts where the cloud is seen to end. */
export const STORM_BASE_M = 500;
/**
 * The hosts' one call a frame: the strikes to add and the light to draw. `frame({ seconds, eye, eyeHeight,
 * distant, player, shown })` - `distant` the distant storms' strikes fired this frame in HOST metres
 * (`[{ x, z, seed, kind, strength }]`, distantStorms.js's `strikes` moved into the host's frame), `player` the
 * storm overhead's LightningPlayer and `shown` whether its storm is the one shown (a strike it throws while it is
 * not is not seen - its count is still followed, so one shown later does not fire the backlog). `test` (the
 * `?bolttest=<metres>` door, for shots): one ground strike that far east of the eye, held at its first stroke's
 * peak on every frame, so a screenshot at any frame rate sees it. Answers the bolt field's `{ bolts, flash }`.
 */
export function createStormLights() {
  const field = createBoltField();
  let seen = null;
  return {
    frame({ seconds, eye, eyeHeight = 1.7, distant = [], player = null, shown = false, test = 0 }) {
      if (test > 0) {
        const x = eye[0] + test, z = eye[2];
        field.add({ x, z, ...strikeColumn(eye, x, z, STORM_BASE_M, eyeHeight), seed: 0x51f15eed, kind: 'cg', strength: 1, at: seconds, tag: 'test' });
      }
      for (const s of distant) {
        const c = strikeColumn(eye, s.x, s.z, STORM_BASE_M, eyeHeight);
        field.add({ x: s.x, z: s.z, ...c, seed: s.seed, kind: s.kind, strength: s.strength ?? 1, at: seconds });
      }
      const count = player?.strikes ?? null;
      if (count !== null && seen !== null && count !== seen && shown) {
        const seed = (Math.imul(count, 0x9e3779b1) ^ Math.floor(seconds * 1000)) >>> 0;
        const l = localStrike(seed, player.lastClipClass);
        const x = eye[0] + l.dx, z = eye[2] + l.dz;
        field.add({ x, z, ...strikeColumn(eye, x, z, STORM_BASE_M, eyeHeight), seed, kind: l.kind, strength: 1, at: seconds });
      }
      seen = count;
      return field.tick(seconds, eye);
    },
    reset() { field.reset(); seen = null; },
  };
}
