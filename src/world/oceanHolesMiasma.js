// ═══════════════════════════════════════════════════════════════════
// OH-C (2026-09-26): THE ABYSS MIASMA - OceanHoles.CreateSurfaceMiasma's
// ParticleSystem, simulated. What the C# configures, and what a Unity
// ParticleSystem does with it:
//
//   main: loop, prewarm, startLifetime 30 s, startSpeed 0, startSize a
//     random 3..6 (two constants), startRotation a random 0..2pi,
//     maxParticles the slider's count (72 at the midpoint, at least 1),
//     local simulation space; its duration is Unity's default 5 s, and
//     PREWARM starts the system as though that one loop had already run;
//   emission: rateOverTime 2 x count / 72 a second (Unity's accumulator:
//     each frame's share added, a particle born for every whole one), none
//     past maxParticles;
//   shape: a Circle of radius (surface hole radius - 1), radiusThickness 1
//     (the whole disc, uniform by area), turned (90, 0, 0) to lie on the
//     sea; startSpeed 0, so no velocity from the shape;
//   velocityOverLifetime: x and z a random -0.12..0.12, y a random 0.85v..v
//     with v = plume height / 30 - each particle's own constants;
//   sizeOverLifetime: a curve up to full by 2% of the life, full to 90%,
//     down to nothing at the end - four keys with zero tangents, so each
//     span is Unity's Hermite with flat ends (a smoothstep).
//
// Unity's particle RNG is its own and unseeded; these are the player's
// look (the sliders are theirs online), so the draws are Math.random's.
// ═══════════════════════════════════════════════════════════════════

import { SURFACE_MIASMA_LIFETIME, SURFACE_MIASMA_MAX_PARTICLES, SURFACE_MIASMA_EMISSION_RATE } from './oceanHoles.js';

const f32 = Math.fround;
/** ParticleSystem.MainModule.duration's default (the loop PREWARM runs once). */
export const DEFAULT_DURATION = 5;
/** startSize's upper constant (MinMaxCurve(3, 6)). */
export const START_SIZE_MAX = 6;
/** velocityOverLifetime's x and z reach: a random -0.12..0.12 m/s. */
export const DRIFT = 0.12;
/** The size-over-lifetime curve's keys. */
export const SIZE_KEYS = Object.freeze([
  [0, 0],
  [0.02, 1],
  [0.9, 1],
  [1, 0],
]);

/** AnimationCurve.Evaluate over keys with zero tangents: each span a flat-ended Hermite. */
export function evaluateSizeCurve(t) {
  if (t <= SIZE_KEYS[0][0]) return SIZE_KEYS[0][1];
  for (let i = 1; i < SIZE_KEYS.length; i++) {
    const [t1, v1] = SIZE_KEYS[i];
    if (t <= t1) {
      const [t0, v0] = SIZE_KEYS[i - 1];
      const u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (u * u * (3 - 2 * u));
    }
  }
  return SIZE_KEYS[SIZE_KEYS.length - 1][1];
}

/**
 * One pit's miasma. Positions are the system's own (local) space: the
 * disc's centre at the origin, y up.
 * @param {{count: number, height: number, radius: number, roll?: () => number}} o
 */
export function createMiasma({ count, height, radius, roll = Math.random }) {
  const max = Math.max(1, count);
  const rate = f32(f32(SURFACE_MIASMA_EMISSION_RATE * count) / SURFACE_MIASMA_MAX_PARTICLES);
  const v = f32(height / SURFACE_MIASMA_LIFETIME);
  const particles = [];
  let accum = 0;
  const range = (a, b) => a + (b - a) * roll();
  function emit() {
    const a = roll() * Math.PI * 2,
      r = radius * Math.sqrt(roll());
    particles.push({
      p: [Math.cos(a) * r, 0, Math.sin(a) * r],
      v: [range(-DRIFT, DRIFT), range(f32(v * 0.85), v), range(-DRIFT, DRIFT)],
      size: range(3, START_SIZE_MAX),
      rot: range(0, Math.PI * 2),
      age: 0,
      life: SURFACE_MIASMA_LIFETIME,
    });
  }
  function step(dt) {
    if (!(dt > 0)) return;
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.age += dt;
      if (q.age >= q.life) {
        particles.splice(i, 1);
        continue;
      }
      q.p[0] += q.v[0] * dt;
      q.p[1] += q.v[1] * dt;
      q.p[2] += q.v[2] * dt;
    }
    accum += rate * dt;
    while (accum >= 1) {
      accum -= 1;
      if (particles.length < max) emit();
    }
  }
  // PREWARM: one loop's worth, in steps a frame long
  for (let t = 0; t < DEFAULT_DURATION; t += 1 / 60) step(1 / 60);
  return {
    particles,
    step,
    rate,
    max,
    /** The size a particle draws at now (its start size through the curve). */
    sizeOf: (q) => q.size * evaluateSizeCurve(q.age / q.life),
  };
}

/** AUDIT OH-F A2: the plume's reach from its emitter, local [minX, minY, minZ, maxX, maxY, maxZ] - what Unity's
 *  renderer culls it by (its particles' own bounds): the disc and a life's drift out, the whole rise (v at most
 *  height / 30 for 30 s) up, and the largest puff's half all round. */
export function miasmaReach({ height, radius }) {
  const half = START_SIZE_MAX / 2,
    out = radius + DRIFT * SURFACE_MIASMA_LIFETIME + half;
  return [-out, -half, -out, out, height + half, out];
}
