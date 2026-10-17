// @ts-check
// EG-ZO (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 7, 25.1 and 25.8 -
// "the full fall through the void, past the Spire's broken underside"): THE SPIRE'S UNDERSIDE AND THE FALL PAST IT, as
// law - pure, so a test holds every number and the stair's pass only draws it (render/eliteGates/egStairPass.js, on the veil's own
// canvas - ui/gate/gateVeil.js):
//   THE UNDERSIDE (`buildEgUndersideModel`, `egUndersideParts`) - the torn academy the halls fell from, modelled with the
//     arc's one mesh kit (world/eliteGates/meshKit.js) in the band's own dress (world/eliteGates/egBandArt.js - the band the step falls into):
//     the torn floor (its flags on top, the walls' ashlar on its broken edge); the rock it was torn up with, hanging under
//     it like a cake cut through (the undersides' record, its strata by depth: the torn lip, the courses, the works, the
//     haze at the tip); the spires of rock hanging round it; the galleries' broken floors jutting from its flanks; the
//     colonnade of the hall above, torn through and hanging upside down under the rim; and girders of the band's metal
//     welded through the rock. One plan for every band (the Spire is one), seeded: the same on every screen;
//   THE FALL (`egFallDepth`, `egFallEye`, `egFallPitch`, `egFallCamera`) - a camera stepped off the torn floor's rim,
//     falling from rest toward a terminal speed past the underside's flank and its spires, drifting out from it as it
//     falls, and raising its eyes from the void opening under it to the underside climbing away overhead. Its look eases
//     over the stair's own clock (world/eliteGates/egLights.js EG_STAIR_VEIL: 0.8 s in, the fall's least hold 1.2 s, 0.8 s out), so
//     the company is among the spires as the veil shuts and below the last tip as the least hold ends, and the underside
//     stays in view through the longest hold the veil allows (render/gate/gateVeil.js VEIL_HOLD_MAX_S). Nothing turns but the
//     eyes' one slow raise, from rest and back to rest: a company sees the fall at every band, and it must never be the
//     thing that makes them sick (section 7).
//
// THE SLICES: the model and its four pictures are made a slice at a time (`egUndersideParts(band).step()`), so the veil
// makes them across the closing's first frames and never in the frame the swap lands in (section 7's "time-sliced",
// THE SWAP's own rule). The model is packed once, in renderer.createMesh's shape: Uint32 indices, a sub-mesh a record.
//
// Not a DFU member. Ledger A (ELITE-GATES).
import { EG_STAIR_VEIL } from './egLights.js';
// EG-LOOK: the model is world/eliteGates/egUndersideModel.js's (the swap's worker builds it for THE WRECK, world/eliteGates/egVista.js, and
// never loads the stair's clock); every name it had here is still here.
export * from './egUndersideModel.js';

// ── THE FALL ───────────────────────────────────────────────────────────────────────────────────────────────────
/** THE FALL (the underside's frame, m, s, rad): where the eye starts - `d0` from the axis, off the torn floor's rim, and
 *  `y0` over the floor, an eye's height; the fall's terminal speed `v` and its time constant `tau` (from rest, at v/tau to
 *  start - the stair's own fall, faster than a body's, so the underside is passed inside the veil's least hold); how far
 *  the eye drifts out for each metre fallen (a straight glide, the underside kept in view: its axis at atan(1/drift) over
 *  the eye's level however far it falls); the eyes' pitch at the start (into the void opening under it) and at the end
 *  (up at the underside climbing away), facing the axis; the lens' vertical field and its near and far planes. */
export const EG_FALL = Object.freeze({ d0: 58, y0: 1.6, v: 44, tau: 0.7, drift: 0.8, pitch0: -0.2, pitch1: 0.42, fov: Math.PI / 3, near: 0.5, far: 3000 });
/** The stair's own clock the eyes' raise eases over (s): the fall's close, its least hold and its open (world/eliteGates/egLights.js
 *  EG_STAIR_VEIL - 2.8 s). Past it the eyes hold still. */
export const EG_FALL_SPAN = EG_STAIR_VEIL.close + EG_STAIR_VEIL.fallHold + EG_STAIR_VEIL.open;
/** How far the eye has fallen after `t` seconds (m): from rest toward EG_FALL.v - a body falling against the void's drag,
 *  v (t - tau (1 - e^(-t / tau))). Never negative, never rising. */
export const egFallDepth = (t) => { const s = Math.max(0, t); return EG_FALL.v * (s - EG_FALL.tau * (1 - Math.exp(-s / EG_FALL.tau))); };
/** The eyes' pitch after `t` seconds (rad, up positive): from EG_FALL.pitch0 to pitch1 over EG_FALL_SPAN, eased in and out
 *  (smoothstep - still at both ends), held past it. */
export const egFallPitch = (t) => { const u = Math.max(0, Math.min(1, t / EG_FALL_SPAN)); return EG_FALL.pitch0 + (EG_FALL.pitch1 - EG_FALL.pitch0) * u * u * (3 - 2 * u); };
/** Where the eye is after `t` seconds, into `out` ([x, y, z], the underside's frame): off the rim on +x, falling, drifting
 *  out.
 *  @template {number[] | Float32Array} T @param {number} t @param {T} [out] @returns {T} */
export function egFallEye(t, out = /** @type {T} */ ([0, 0, 0])) {
  const d = egFallDepth(t);
  out[0] = EG_FALL.d0 + EG_FALL.drift * d; out[1] = EG_FALL.y0 - d; out[2] = 0;
  return out;
}
/**
 * THE FALLING CAMERA after `t` seconds on a screen of `aspect` (width over height), into `cam`'s own arrays (nothing
 * made): `eye`, `view` (column-major, the eye facing the axis - toward -x - at egFallPitch, its up the world's) and `proj`
 * (a perspective of EG_FALL's lens). Pure.
 * @param {number} t @param {number} aspect
 * @param {{ eye: Float32Array, view: Float32Array, proj: Float32Array }} cam
 */
export function egFallCamera(t, aspect, cam) {
  const e = egFallEye(t, cam.eye), p = egFallPitch(t), cp = Math.cos(p), sp = Math.sin(p), V = cam.view;
  // the eye's axes: right (0, 0, -1), up (sin p, cos p, 0), back (cos p, -sin p, 0) - it looks along (-cos p, sin p, 0)
  V[0] = 0; V[1] = sp; V[2] = cp; V[3] = 0;
  V[4] = 0; V[5] = cp; V[6] = -sp; V[7] = 0;
  V[8] = -1; V[9] = 0; V[10] = 0; V[11] = 0;
  V[12] = e[2]; V[13] = -(sp * e[0] + cp * e[1]); V[14] = -(cp * e[0] - sp * e[1]); V[15] = 1;
  const f = 1 / Math.tan(EG_FALL.fov / 2), P = cam.proj, n = EG_FALL.near, fa = EG_FALL.far;
  P.fill(0);
  P[0] = f / (aspect > 0 ? aspect : 1); P[5] = f; P[10] = (fa + n) / (n - fa); P[11] = -1; P[14] = (2 * fa * n) / (n - fa);
  return cam;
}
