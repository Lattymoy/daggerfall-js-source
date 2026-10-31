// @ts-check
// AMBIENT-LIFE: one creature's body as the pass draws it - where it stands, which way it faces, its wings - and the
// floats an instance carries, in the order render/ambientLifePass.js reads them.

/** Floats an instance carries: x, y, z, scale | yaw, pitch, bank, phase | spread, amp, kind, glow | r, g, b, lift. */
export const AL_INSTANCE_FLOATS = 16;
/** The most the pass draws at once. */
export const AL_MAX_INSTANCES = 320;
const TAU = Math.PI * 2;

/** @typedef {import('./ambientCast.js').AmbientKind} AmbientKind */

/** A creature. `state` and the timers are its group's (ambientFlight.js, ambientGround.js). */
export function makeBody(/** @type {AmbientKind} */ kind, /** @type {() => number} */ random) {
  const c = kind.colors[Math.floor(random() * kind.colors.length) % kind.colors.length];
  const shade = 0.9 + random() * 0.2;
  return {
    kind, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: random() * TAU, pitch: 0, bank: 0,
    phase: random() * TAU, flapHz: kind.flapHz * (0.85 + random() * 0.3), spread: 1, amp: 0.9, scale: 0.9 + random() * 0.25,
    r: c[0] * shade, g: c[1] * shade, b: c[2] * shade, lift: kind.lift, glow: 0, fade: 0,
    state: 0, t: 0, t2: 0, tx: 0, ty: 0, tz: 0, delay: 0, gone: false, /** @type {any} */ site: null,
    cx: 0, cz: 0, ang: 0, rad: 0, held: false, look: 0,
  };
}
/** @typedef {ReturnType<typeof makeBody>} AmbientBody */

/** The angle `a` turned toward `b` by at most `step`, the short way. */
export function turnToward(a, b, step) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return a + Math.max(-step, Math.min(step, d));
}

/** Face along the body's velocity: the yaw turned toward it, the nose to the climb, and a bank into the turn (the wing
 *  on the turn's side down). `rate` radians a second. @param {AmbientBody} b */
export function faceVelocity(b, dt, rate = 4) {
  const h = Math.hypot(b.vx, b.vz);
  if (h < 0.05) return;
  const was = b.yaw;
  b.yaw = turnToward(b.yaw, Math.atan2(b.vx, b.vz), rate * dt);
  const turn = dt > 0 ? (b.yaw - was) / dt : 0;
  b.pitch += (Math.atan2(b.vy, h) * 0.8 - b.pitch) * Math.min(1, dt * 4);
  b.bank += (Math.max(-0.9, Math.min(0.9, -turn * 0.35)) - b.bank) * Math.min(1, dt * 5);
}

/** The body's sixteen floats at instance `i` of `out`. @param {AmbientBody} b @param {Float32Array} out */
export function writeBody(b, out, i) {
  const o = i * AL_INSTANCE_FLOATS;
  out[o] = b.x; out[o + 1] = b.y; out[o + 2] = b.z; out[o + 3] = b.scale * b.fade;
  out[o + 4] = b.yaw; out[o + 5] = b.pitch; out[o + 6] = b.bank; out[o + 7] = b.phase;
  out[o + 8] = b.spread; out[o + 9] = b.amp; out[o + 10] = b.kind.id; out[o + 11] = b.glow;
  out[o + 12] = b.r; out[o + 13] = b.g; out[o + 14] = b.b; out[o + 15] = b.lift;
}

/** A body moved with the floating origin. @param {AmbientBody} b */
export function offsetBody(b, o) {
  b.x += o[0]; b.y += o[1]; b.z += o[2];
  b.tx += o[0]; b.ty += o[1]; b.tz += o[2];
  b.cx += o[0]; b.cz += o[2];
}

/** Steer toward a point at `speed`, the velocity eased toward it by `agility` a second, and move. @param {AmbientBody} b */
export function steer(b, dt, tx, ty, tz, speed, agility) {
  const dx = tx - b.x, dy = ty - b.y, dz = tz - b.z, d = Math.hypot(dx, dy, dz) || 1, k = Math.min(1, dt * agility);
  b.vx += ((dx / d) * speed - b.vx) * k; b.vy += ((dy / d) * speed - b.vy) * k; b.vz += ((dz / d) * speed - b.vz) * k;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  return d;
}

/** A point in the ring `r0..r1` metres round `c` ([x, z] written to `out`). */
export function ringPoint(c, r0, r1, random, out) {
  const a = random() * TAU, r = r0 + (r1 - r0) * Math.sqrt(random());
  out[0] = c[0] + Math.sin(a) * r; out[1] = c[2] + Math.cos(a) * r;
  return out;
}
