// ═══════════════════════════════════════════════════════════════════
// WM1 — THE WINDMILL'S TURN: what makes the blades go round.
//
// Classic Daggerfall's farm blocks stand a windmill on the ground and
// it never moves. Turning it is an ENHANCED-ONLY DEPARTURE (Ledger A),
// the 1:1 lane sees Daggerfall's own farms, and with the enhanced skin
// off not one byte of this module is reached. (The roads were the same
// shape and set the precedent; they were removed whole on 2026-08-29,
// which is why this is now the only departure of its kind.)
//
// ── WHAT THIS OWES KAMER, AND WHAT IT TOOK ───────────────────────
//
// "Windmills of Daggerfall" (Kamer, DFU mod, v2.0). WM1 shipped this
// module treating the mod as a reference only, on the roads' precedent
// (that arc is gone now; the reasoning it set is what mattered here)
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
// with synthetic wind, no ARENA2 and no GL.
// ═══════════════════════════════════════════════════════════════════

import { BODY, CLIMATE_SKINS, SKIN_SLOTS } from './windmillMesh.js';
import { WEATHER_SKY } from '../render/enhancedSky.js';
import { multiply, trs, quatToMat4, transformPoint } from './mat4.js';
import { SOUND } from '../systems/soundClips.js';

// WM2d RETIRED `WINDMILL_MODELS`, the table of "which classic model id
// carries a rotor", along with the FLAGGED note asking for the two it
// could not confirm. The table rested on WM2a's reading that model
// 41600 stands in Daggerfall's farm blocks, and that reading was
// backwards: the 41600 was in KAMER'S WorldData overrides, which
// REPLACE a block - FARMAA01's declares one subrecord and carries two,
// FARMAA00's puts the mill in subrecord 7 of a seven-record block. The
// extra subrecord in each is the mill he adds.
//
// Classic Daggerfall stands no windmill at all, so there was never a
// model id to match on, and the hosts matched on one for a whole slice
// while nothing appeared. The port places its own mills now
// (world/rmbLayout.js, from vendor/windmills-kamer/placements.json) and
// a table of classic ids has nothing left to answer.

/** The rotor turns about the model's LOCAL Z - Kamer's
 *  `transform.Rotate(0f, 0f, -13 * Time.deltaTime, Space.Self)`. The
 *  sign lives here rather than in the angle so that "how fast" and
 *  "which way round" stay separable: a rate is never negative.
 *
 *  HIS SIGN IS NEGATIVE AND SO IS OURS (WM4b). WM2e set this to +1 on
 *  the argument that the bake's X-mirror reverses the sense of a
 *  rotation about an axis in its plane (`M R(t) M-1 = R(-t)`), and that
 *  identity is true and does not apply: it describes rotating in DAE
 *  space and THEN mirroring. The port does what Unity does - mirrors
 *  the vertices once, at import, and applies the rotation AFTER, in
 *  the same left-handed space his numbers are written in:
 *  `W * T(hub) * R(t) * (M v)` on both sides, the same matrices, so the
 *  same t. And mat4's handedness law (H1) means the port's picture of
 *  that space is DFU's picture of it, not its mirror - so the same t
 *  is the same way round on screen. Two flips were counted for one
 *  mirror, and the sails ran backwards. */
export const ROTOR_AXIS = 'z';
export const ROTOR_SIGN = -1;

/** WM4c: THE MILL HUMS. Kamer's Spin_Up.Start adds a DaggerfallAudioSource
 *  and calls `SetSound(SoundClips.ArenaFireDaemon, AudioPresets.LoopOnAwake)`
 *  - spatialBlend 1 by the default argument, everything else Unity's
 *  fresh-AudioSource defaults: logarithmic rolloff, minDistance 1,
 *  maxDistance 500, and the volume set to Settings.SoundVolume at play
 *  (DaggerfallAudioSource.cs Apply, the LoopOnAwake arm). No player
 *  check, no random play: it loops from the moment it exists, wherever
 *  the player is, and the rolloff does the rest.
 *
 *  The source sits on the GameObject that carries Spin_Up: the SAIL
 *  (the prefab's Blade child, at ROTOR_HUB) outside, and the PLANK GEAR
 *  inside. Volume 1 here because the port's master bus IS SoundVolume
 *  (U29). 'inverse' is WebAudio's logarithmic (audio.js play3d). */
export const MILL_SOUND = Object.freeze({
  clip: SOUND.ArenaFireDaemon,
  volume: 1,
  refDistance: 1,
  maxDistance: 500,
  distanceModel: 'inverse',
});

/** Where the sail's source sits in the world: the hub, under the mill's
 *  placement. The machinery's is the gear's own position under its
 *  parent - the same shape, a different offset (see machineryChildPos). */
export function millSoundPosition(modelMatrix) {
  return transformPoint(modelMatrix, ROTOR_HUB[0], ROTOR_HUB[1], ROTOR_HUB[2]);
}

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

/**
 * WM4b: A MOVING PART OF THE MACHINERY, mounted and turned.
 *
 * Kamer's 41601 prefab is a root drawing the machinery with two
 * children - Plank_Gear and Roller - each drawing its own mesh under
 * its own transform and turned by its own script about its OWN axis
 * (`Space.Self`). That is `parent * T(position) * R(rotation) *
 * R_axis(angle)`: carry the part to its place in the machinery, stand
 * it the way the prefab stands it, then spin it about the axis it now
 * owns. The angle is SIGNED BY HIS RATE - Spin_Up's -13 about Z, the
 * roller's +13 about X - applied verbatim (see ROTOR_SIGN for why
 * verbatim is right).
 *
 * @param {Float32Array} parentMatrix - the machinery's placement
 * @param {{position: number[], rotation: number[], axis: string}} child
 * @param {number} angleDeg - signed, from advanceMachinery
 */
export function mountMachineryChild(parentMatrix, child, angleDeg) {
  const [px, py, pz] = child.position;
  const rot = child.axis === 'x' ? trs(0, 0, 0, angleDeg, 0, 0)
    : child.axis === 'y' ? trs(0, 0, 0, 0, angleDeg, 0)
      : trs(0, 0, 0, 0, 0, angleDeg);
  const stand = quatToMat4(child.rotation);
  stand[12] = px; stand[13] = py; stand[14] = pz;
  return multiply(parentMatrix, multiply(stand, rot));
}

/** A child's own origin under its parent - where its AudioSource sits. */
export function machineryChildPos(parentMatrix, child) {
  return transformPoint(parentMatrix, child.position[0], child.position[1], child.position[2]);
}

/**
 * The machinery turns at HIS rate, always - `13 * Time.deltaTime` in
 * both scripts, signed per part. No wind reaches the inside of a mill
 * (shared.wind is the exterior hosts' door onto the sky, and there is
 * no sky in here), so this is the one rotor in the port that keeps the
 * mod's constant, and it is integrated the same way advanceRotor is:
 * the state carries the angle, the rate only moves it on.
 *
 * @param {{angle: number}} state - mutated in place, degrees
 * @param {number} dt - seconds
 * @param {{degPerSec: number}} child
 */
export function advanceMachinery(state, dt, child) {
  state.angle = ((state.angle + child.degPerSec * dt) % 360 + 360) % 360;
  return state.angle;
}

/**
 * WM2e: THE MILL, SKINNED FOR ITS CLIMATE AND SEASON.
 *
 * Kamer ships seventeen variant prefabs and only two of the body's five
 * texture groups ever differ between them: the WALLS and the ROOF. So
 * this substitutes those two and shares everything else - the vertex
 * data is the same buffer for every climate, and only the tiny
 * subMeshes array is rebuilt.
 *
 * NOT through the location's texRemap, which would have been the
 * obvious door: that map is keyed by "archive_record" over the WHOLE
 * scene, and the mill's walls are 364_2 - a key other buildings can
 * carry. Remapping it for the mill would re-skin them too. The mill
 * owns its own upload instead, which is why the pipeline caches a mesh
 * per climate.
 *
 * An unknown climate base keeps the mill as authored (temperate),
 * rather than dropping its textures and drawing it untextured.
 *
 * @param {number} climateBase - 0/100/300/400, the API ClimateBaseType
 * @param {boolean} isWinter
 */
export function skinnedBody(climateBase, isWinter) {
  const skin = CLIMATE_SKINS.get(climateBase);
  if (!skin) return BODY;
  const walls = isWinter ? skin.winterWalls : skin.walls;
  const roof = isWinter ? skin.winterRoof : skin.roof;
  const subMeshes = BODY.subMeshes.map((sm, i) => {
    const swap = i === SKIN_SLOTS.walls ? walls : i === SKIN_SLOTS.roof ? roof : null;
    return swap ? { ...sm, textureArchive: swap[0], textureRecord: swap[1] } : sm;
  });
  return { ...BODY, subMeshes };
}
