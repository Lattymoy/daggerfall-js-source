// ═══════════════════════════════════════════════════════════════════
// WM1 — THE WINDMILL'S TURN: what makes the blades go round.
//
// Classic Daggerfall's farm blocks stand a windmill on the ground and
// it never moves. Turning it is an ENHANCED-ONLY DEPARTURE (Ledger A),
// the same shape as the roads: the 1:1 lane sees the static model the
// game shipped, and with the enhanced skin off not one byte of this
// module is reached.
//
// ── WHAT THIS OWES KAMER, AND WHAT IT TOOK ───────────────────────
//
// "Windmills of Daggerfall" (Kamer, DFU mod, v2.0). WM1 shipped this
// module treating the mod as a reference only, on the roads' precedent
// ("instead of taking their mod, I want us to develop our own and
// better") - and that was the wrong call to keep once Mac confirmed
// THE AUTHOR HAD GIVEN PERMISSION. An invitation is not a lift.
//
// So WM2a vendors his ROTOR GEOMETRY, and only that:
// vendor/windmills-kamer/Blade.dae, baked by scripts/bakeWindmill.mjs
// into world/windmillMesh.js. It is the piece the port could not
// derive - a sail separated from its tower - and it makes the mesh
// question WM1 flagged moot, because the split was made by the art.
//
// His .PNG textures did NOT come across, and that is not about him:
// they are Daggerfall's art exported to PNG, the doctrine's second
// non-negotiable ("a render of game data IS game data") is Bethesda's
// to waive rather than the modder's, and they are unnecessary anyway -
// the mesh names the classic textures it wants and the port loads
// those from the player's own ARENA2 like every other model.
//
// The BEHAVIOUR below is still ours, and it is still the reason this
// module exists: what we took from his code is a reading, credited -
// the blade assembly turns about the model's local Z, at 13 degrees a
// second.
//
// That 13 is the number a Daggerfall player's eye already knows, so
// it is the one thing here that is not invented - it is the anchor.
// Where the mod turns at 13 always, in a gale and in a dead calm
// alike, our rotor turns at 13 IN FAIR WEATHER and takes the rest
// from the wind. Which brings us to the reason this module exists at
// all:
//
// ── THE WIND IS ALREADY IN THE PORT, WITH ONE HOME ───────────────
//
// ES1c gave the enhanced sky a per-weather wind vector (dome units a
// second) and, because nothing about a sky changes in a frame, an
// EASED one: the controller keeps a row and walks it toward the row
// the sim asks for over WEATHER_EASE_SECONDS. That row is the port's
// only answer to "how hard is it blowing right now", so this module
// imports WEATHER_SKY rather than restating a single number of it,
// and takes the EASED row - the same object the shader is drawing the
// clouds with - as its input.
//
// The property that buys is the one worth having: THE BLADES AND THE
// CLOUDS ARE DRIVEN BY THE SAME WIND. A storm rolls in, the sky's
// deck picks up over fourteen seconds, and the mill in the field
// below picks up with it on the same curve, because it is the same
// number. Nothing is synchronised and nothing needs to be.
//
// ── THIS MODULE IS PURE ──────────────────────────────────────────
//
// Numbers in, numbers and matrices out - no DOM, no GL, no game data,
// no clock of its own. It does not know what a mesh is: a host hands
// it a rotor's hub and gets back the transform that turns it. The
// laws below are therefore held by node pins with synthetic wind,
// exactly as systems/roads.js is held with synthetic terrain.
// ═══════════════════════════════════════════════════════════════════

import { WEATHER_SKY } from '../render/enhancedSky.js';
import { multiply, trs } from './mat4.js';

// The model ids that carry a turning rotor.
//
// 41600 is now settled from the other side: the vendored sail's own
// geometry is named `model41600_001-mesh`, so the mod's author built
// that rotor FOR model 41600 and the id is his, not an inference.
//
// FLAGGED, still awaiting real data: 41601 and the watermill 21411 are
// read off the mod's manifest and LoadWindmill.cs and are NOT confirmed
// against a real ARCH3D.BSA - the container this was written in has no
// ARENA2 - and no vendored geometry names them. A model id here that is
// not a mill turns something that should stand still, so the wiring
// slice confirms those two against the real mesh before spinning them.
//
// The instrument for that exists and needs no work first:
//
//   ARENA2_PATH=/path/to/ARENA2 node tools/windmillProbe.mjs
//
// prints each model's submeshes and its CONNECTED COMPONENTS - if the
// sail is its own island of geometry, or carries its own texture
// record, the rotor/tower split WM2 needs is already made by the art -
// and draws every component in its own colour from three sides,
// because "that part is the sail" is a claim only an eye settles.
// `--selftest` runs it against a synthetic windmill with no ARENA2.
export const WINDMILL_MODELS = Object.freeze({
  41600: 'windmill',       // the farm windmill, the mod's own target
  41601: 'windmill',       // its second dressing
  21411: 'watermill',      // the mod spins this one too (LoadWindmill.cs)
});

/** The rotor turns about the model's LOCAL Z, negative-ward - Kamer's
 *  `transform.Rotate(0f, 0f, -13 * Time.deltaTime, Space.Self)`. The
 *  sign lives here rather than in the angle so that "how fast" and
 *  "which way round" stay separable: a rate is never negative. */
export const ROTOR_AXIS = 'z';
export const ROTOR_SIGN = -1;

/** Fair weather turns at the classic rate (see the header). */
export const CALM_ROTOR_DEG_PER_SEC = 13;

/** SKIN, tuned by eye and stated as such - classic has no turning mill
 *  to be faithful to, so these are named constants with an intent, and
 *  the pins below assert STRUCTURE (still in a calm, faster in a storm,
 *  never past the furl) rather than asserting these numbers back.
 *
 *  STALL_WIND: a real mill needs enough wind to break friction, so the
 *  rate is measured from a floor rather than scaled from zero. NO
 *  SHIPPED SKY ROW IS BELOW IT - fog is the calmest at |wind| 0.0063
 *  and crawls at about three degrees a second, which is the intent:
 *  the floor is what makes fog a CRAWL instead of a proportional
 *  fifth-speed, and it stops a becalmed row dead if one is ever tuned.
 *
 *  FURL_DEG_PER_SEC: a miller furls the sails in a gale rather than
 *  let the mill tear itself apart. Without a cap, thunder drives the
 *  blades to a blur that reads as a bug. */
export const STALL_WIND = 0.005;
export const FURL_DEG_PER_SEC = 40;

/** The magnitude of a sky wind row, and the ONE home of that reading:
 *  the row is a 2-vector of dome units a second and its LENGTH is the
 *  wind speed, not either component. */
export function windSpeed(wind) {
  if (!wind) return 0;
  return Math.hypot(wind[0], wind[1]);
}

/** Degrees a second per unit of wind ABOVE the stall, chosen so that
 *  the fair-weather row turns at exactly CALM_ROTOR_DEG_PER_SEC.
 *
 *  Derived, never typed: the day someone re-tunes WEATHER_SKY.sunny -
 *  and ES1's rows have been re-tuned once already - a written-down
 *  gain would quietly stop meaning "13 in fair weather", which is the
 *  only thing it is for. */
export const ROTOR_GAIN =
  CALM_ROTOR_DEG_PER_SEC / (windSpeed(WEATHER_SKY.sunny.wind) - STALL_WIND);

/** Degrees a second, from the eased sky wind. Monotone in the speed,
 *  zero at and below the stall, never past the furl. */
export function rotorRate(wind) {
  const over = windSpeed(wind) - STALL_WIND;
  if (over <= 0) return 0;
  return Math.min(over * ROTOR_GAIN, FURL_DEG_PER_SEC);
}

/** A per-site phase in degrees, so a farm's mills are not a chorus
 *  line. Deterministic in the site's own map position - the same mill
 *  is at the same phase every time the player walks up to it, which a
 *  random would not give, and two mills a block apart are nowhere near
 *  each other. */
export function rotorPhase(x, z) {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * 360;
}

/**
 * Advance a rotor by one frame.
 *
 * THE ANGLE IS INTEGRATED, NOT COMPUTED. `angle = rate * elapsed` is
 * the obvious spelling and it is wrong the moment the rate changes:
 * the whole history gets re-priced at the new rate, so a mill that has
 * been turning for ten minutes JUMPS through a third of a revolution
 * the instant the weather does. Blades that teleport when it starts
 * raining are the one artefact this module could plausibly ship, so
 * the state carries the angle and the rate only ever moves it on.
 *
 * @param {{angle: number}} state - mutated in place, degrees
 * @param {number} dt - seconds since the last frame
 * @param {number[]} wind - the host's EASED sky wind row
 * @returns {number} the new angle, degrees, wrapped to [0, 360)
 */
export function advanceRotor(state, dt, wind) {
  const step = rotorRate(wind) * Math.max(0, dt || 0);
  const next = (state.angle + step) % 360;
  state.angle = next < 0 ? next + 360 : next;
  return state.angle;
}

/** WHERE THE SAIL HANGS on model 41600, in that model's own local
 *  space. Sourced, not guessed: Kamer's prefab REPLACES model 41600, so
 *  its root is that model's origin, and its Blades child sits at this
 *  local position with an identity rotation
 *  (`Models/Finished/41600.prefab`). Against his own tower body - which
 *  he authored to stand in for the classic one - it puts the hub just
 *  past the +X face, high up (the body tops out at y 10.84), at the
 *  front in Z. The import applies no scale (`globalScale: 1`,
 *  `useFileScale: 1`), so these are the port's world units already.
 *
 *  THE RESIDUAL RISK IS THE CLASSIC TOWER, not this number: the offset
 *  is exact in HIS body's frame, and it lands correctly on the classic
 *  41600 only insofar as he built his replacement to match it. A sail
 *  floating beside a mill rather than mounted on it is what that looks
 *  like, and it is a one-look question nobody in this container can
 *  answer. */
export const ROTOR_HUB = Object.freeze([3.96, 6.01, -5.5]);

/**
 * MOUNT a rotor whose geometry is centred on its own origin, and turn it.
 *
 * `model * T(hub) * R` - carry the sail out to the hub, then spin it
 * about its own centre there. This is the one the wiring uses, because
 * the vendored `windmillMesh.ROTOR` is modelled centred on the origin
 * with its placement supplied separately (see ROTOR_HUB).
 *
 * DO NOT reach for rotorMatrix below for this. That one CONJUGATES
 * (`T(hub) R T(-hub)`), which is right for geometry already sitting at
 * the hub inside the model - a sail split out of a classic mesh in
 * place - and wrong here in a way that looks like a bug rather than
 * reading as one: origin-centred geometry conjugated about an offset
 * hub does not spin, it ORBITS the hub at the hub's own radius. The
 * pins hold both, and hold them apart.
 */
export function mountRotor(modelMatrix, hub, angleDeg, axis = ROTOR_AXIS) {
  const a = ROTOR_SIGN * angleDeg;
  const rot = axis === 'x' ? trs(0, 0, 0, a, 0, 0)
    : axis === 'y' ? trs(0, 0, 0, 0, a, 0)
      : trs(0, 0, 0, 0, 0, a);
  return multiply(modelMatrix, multiply(trs(hub[0], hub[1], hub[2], 0, 0, 0), rot));
}

/**
 * The transform that turns a rotor ALREADY POSITIONED at its hub in
 * MODEL space.
 *
 * The hub is a point on the model, not the origin, so the spin is the
 * classic conjugation - out to the hub, turn, back again - and it is
 * composed INSIDE the model matrix (`model * spin`), never outside:
 * outside would turn the mill about the world's axis and walk it
 * across the field.
 *
 * @param {Float32Array} modelMatrix - the layout's placement
 * @param {number[]} hub - [x, y, z] in model space
 * @param {number} angleDeg - from advanceRotor
 * @param {string} [axis] - ROTOR_AXIS; 'x' for the mod's roller
 */
export function rotorMatrix(modelMatrix, hub, angleDeg, axis = ROTOR_AXIS) {
  const a = ROTOR_SIGN * angleDeg;
  const rot = axis === 'x' ? trs(0, 0, 0, a, 0, 0)
    : axis === 'y' ? trs(0, 0, 0, 0, a, 0)
      : trs(0, 0, 0, 0, 0, a);
  const [hx, hy, hz] = hub;
  const spin = multiply(trs(hx, hy, hz, 0, 0, 0),
    multiply(rot, trs(-hx, -hy, -hz, 0, 0, 0)));
  return multiply(modelMatrix, spin);
}
