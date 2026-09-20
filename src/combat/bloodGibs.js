// @ts-check
// BLOOD1b - THE GIBS: what a warhammer leaves of a body.
//
// Read off the assembly (bible/05-Combat/Blood-Arc.md carries the
// decompiled shape). A death the mod marked as explosive throws TEN
// chunks from the body, each one a sprite quad on a rigidbody:
//
//   velocity      = (±15, 5..15, ±15)      - always thrown UPWARD
//   useGravity    = false, and FixedUpdate adds Physics.gravity * 3
//   drag          = 0.1, angularDrag = 0, mass = 15
//   OnCollisionEnter -> SpawnBlood(here, 20, 2, 4)
//   Destroy(rigidbody, 4) and Destroy(collider, 4)
//
// So a chunk is thrown up and out, falls at three times gravity,
// sprays blood wherever it hits, and after four seconds its physics
// and its collider are destroyed - it freezes where it lies.
//
// NO BOUNCE, and that is the engine's answer rather than a choice:
// nothing sets a PhysicMaterial, and Unity's default bounciness is
// zero. A chunk lands, it does not ricochet.
//
// THE GRAVITY IS UNITY'S, NOT THE PORT'S. `player/motor.js` carries
// GRAVITY = 20, which is DFU's own number for a walking body and has
// nothing to do with this; a chunk's arc is Unity's physics, and
// matching the FEEL means matching the number that shaped it. Three
// times 9.81 is what makes a gib fall like a wet weight instead of
// floating like a leaf, and 3 x 20 would be half again too fast.
//
// NO RENDERER, NO GL, NO COLLIDER. This module answers where a chunk
// is and where it wants to go next; the host rays the segment and
// says what it met. Same split as bloodDecals.js, for the same reason:
// every law here can then be driven on a table.

/** Ten chunks, whatever killed it. */
export const GIB_COUNT = 10;
/** Thrown sideways by up to this, and UPWARD by the band below - a
 *  chunk never starts out heading for the floor. */
export const GIB_THROW_SIDE = 15;
export const GIB_THROW_UP = Object.freeze({ min: 5, max: 15 });
/** Unity's own, which is what shaped the arc - see the header. */
export const UNITY_GRAVITY = 9.81;
export const GIB_GRAVITY_SCALE = 3;
export const GIB_GRAVITY = UNITY_GRAVITY * GIB_GRAVITY_SCALE;
/** `Rigidbody.drag`, which damps the whole velocity each step. */
export const GIB_DRAG = 0.1;
/** When the physics is destroyed and the chunk freezes where it lies. */
export const GIB_LIFE = 4;
/** What it sprays where it hits: `SpawnBlood(here, 20, 2, 4)`. Twenty
 *  is BELOW the rate ladder's bottom rung, so a chunk's splat is
 *  smaller than any blow's - which is right, it is one piece landing
 *  and not a body opening. */
export const GIB_SPLASH_RATE = 20;
/** ...at 2..4, whose midpoint is the ordinary spawn's own 3, so a
 *  chunk's splat carries exactly as far as an ordinary hit's. */
export const GIB_SPLASH_SPEED = Object.freeze({ min: 2, max: 4 });

/** How high above its landing point a chunk's splat is sprayed from.
 *  The port's own, and for a reason worth writing down: the spray
 *  looks for its surface by raying DOWN, and a ray that starts exactly
 *  on the surface it is looking for is a coin toss in any collider.
 *  A hand's breadth up is not. */
export const GIB_SPRAY_LIFT = 0.1;

/**
 * Throw a body's worth of chunks from `pos`.
 *
 * Every chunk gets its own roll, and the vertical one is a BAND that
 * never reaches zero: the assembly's `Random.Range(5f, 15f)` on y is
 * what makes a gibbing read as an upward burst rather than a pile.
 */
export function throwGibs(pos, rng = Math.random, count = GIB_COUNT) {
  const out = [];
  if (!pos || !(count > 0)) return out;
  for (let i = 0; i < count; i++) {
    out.push({
      pos: [pos[0], pos[1], pos[2]],
      vel: [
        (rng() * 2 - 1) * GIB_THROW_SIDE,
        GIB_THROW_UP.min + rng() * (GIB_THROW_UP.max - GIB_THROW_UP.min),
        (rng() * 2 - 1) * GIB_THROW_SIDE,
      ],
      age: 0,
      still: false,
    });
  }
  return out;
}

/**
 * Advance one chunk by `dt` and answer the SEGMENT it wants to travel.
 * Nothing is committed: the host rays the segment and then calls
 * `gibFly` to let it through or `gibLand` to stop it where it met
 * something. A chunk already still, or one whose four seconds are up,
 * answers null.
 */
export function gibStep(g, dt) {
  if (!g || g.still || !(dt > 0)) return null;
  g.age += dt;
  if (g.age >= GIB_LIFE) { g.still = true; return null; }   // the physics is destroyed and it freezes where it lies
  // Unity's `Rigidbody.drag` damps the WHOLE velocity, gravity is
  // added as an acceleration, and both land before the move.
  const damp = Math.max(0, 1 - GIB_DRAG * dt);
  g.vel[0] *= damp; g.vel[1] *= damp; g.vel[2] *= damp;
  g.vel[1] -= GIB_GRAVITY * dt;
  const dx = g.vel[0] * dt, dy = g.vel[1] * dt, dz = g.vel[2] * dt;
  const dist = Math.hypot(dx, dy, dz);
  if (!(dist > 0)) return null;
  return {
    from: [g.pos[0], g.pos[1], g.pos[2]],
    dir: [dx / dist, dy / dist, dz / dist],
    dist,
    to: [g.pos[0] + dx, g.pos[1] + dy, g.pos[2] + dz],
  };
}

/** Nothing in the way: the chunk goes where it wanted to. */
export function gibFly(g, step) {
  if (!g || !step) return false;
  g.pos[0] = step.to[0]; g.pos[1] = step.to[1]; g.pos[2] = step.to[2];
  return true;
}

/** Something was: the chunk stops there, for good. */
export function gibLand(g, point) {
  if (!g) return false;
  if (point) { g.pos[0] = point[0]; g.pos[1] = point[1]; g.pos[2] = point[2]; }
  g.still = true;
  return true;
}

/** Where a chunk's splat is sprayed from - see GIB_SPRAY_LIFT. */
export const gibSprayOrigin = (g) => [g.pos[0], g.pos[1] + GIB_SPRAY_LIFT, g.pos[2]];

/**
 * BLOOD1b - A DRIP: blood that stuck to a ceiling and let go.
 *
 * It is a chunk with no throw at all. Everything after the first
 * frame - three times gravity, the drag, the four-second freeze, the
 * splat where it lands - is a chunk's, because a falling drop and a
 * falling piece fall the same way and a second integrator would be a
 * second thing to get wrong.
 *
 * What it does NOT get is a quad. A chunk is a piece of a body and
 * reads at 28cm; a drip at that size is a water balloon. It falls
 * unseen and what a player sees is the floor beneath a ceiling stain
 * darkening a moment later, which is the whole of the effect.
 */
export function dripFrom(point) {
  if (!point) return null;
  return { pos: [point[0], point[1], point[2]], vel: [0, 0, 0], age: 0, still: false };
}

/** What a drip leaves where it lands: ONE mark. A chunk carries a
 *  body's worth and sprays twenty; a drop carries a drop. */
export const DRIP_SPLASH_RATE = 1;

/** THE STREAMING WORLD MOVES THEM TOO. A chunk mid-flight is in world
 *  space like every mark, so a recentre takes it along - one that
 *  stayed behind would land its splat 819.2 units away. */
export function shiftGibs(gibs, delta) {
  if (!gibs || !delta) return 0;
  let n = 0;
  for (const g of gibs) { g.pos[0] += delta[0]; g.pos[1] += delta[1]; g.pos[2] += delta[2]; n++; }
  return n;
}
