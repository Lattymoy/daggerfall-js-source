// @ts-check
// EL3 (2026-09-17, the Enhanced Lighting arc, tier three - DEPTH AND AIR).
//
// WHAT THIS IS. Three screen-space effects the lane adds on top of EL1's
// light and EL2's shadows, all fed by ONE depth: THE FRAME'S OWN (EL6 -
// before it, a depth image was drawn at the top of the frame by replaying
// the shadow pass's records from the camera: a third walk of the town per
// frame, one frame stale, and the emitters that bloomed off it were never
// tested against it). The images are drawn at the RESOLVE, once the world
// pass has written the frame's depth (a texture on the frame's
// framebuffer):
//
//   1. AMBIENT OCCLUSION (SSAO at half resolution): a hemisphere of
//      twelve samples about the surface normal reconstructed from the
//      depth, each projected back and tested against it, range-checked,
//      rotated per pixel by a 4x4 ORDERED pattern (EL6: a hash was grain
//      that the blur never cancelled - in the dark the grain was all a
//      texture had), then a 4x4 box blur that averages exactly one tile.
//      The RESOLVE multiplies the decoded frame by it over the world rect
//      (AIR_AO_RESOLVE of it) - EL6: the world shaders read no AO at all,
//      which is one texture fetch fewer per fragment and no sampler unit
//      to keep bound (AUDIT-EL F2/F12's cases cannot recur).
//   2. BLOOM (quarter resolution): sourced from what actually emits -
//      every window's emission map and every self-lit record (THIS frame's
//      records replayed with an emission-only program, each fragment
//      discarding when the frame's depth holds a nearer surface - EL6:
//      "all lighting sources can be seen through walls" was the emitters
//      drawing with no depth test), and a glare sprite at each lantern,
//      sized by its range, faded by the depth in world units (EL5) - then
//      a separable 9-tap gaussian, twice, added over the frame.
//   3. LIGHT SHAFTS (quarter resolution, outdoors): the sky's mask (depth
//      at the far plane) weighted toward the sun's screen position, radially
//      blurred toward it with decay - the classic screen-space god rays -
//      in the sun's colour, added over the frame when the sun is in front
//      of the camera.
//
// WHERE IT LANDS. The bloom and the shafts are composited with additive
// blending by the first screen-space draw of the frame (drawScreenQuad,
// which is where the 2D pass begins and the world pass has ended for every
// host, foreign passes included) over the world viewport.
//
// EL4 (same day, Mac: "Polished and exceptional detail. Proper darker
// dungeons. The goal isn't a half visioned system"): THE FRAME. EL3 had
// recorded a departure - the world stayed on the canvas because "six
// foreign passes restore bindFramebuffer(null)". The survey that followed
// found TWO restore sites in the tree (render/renderTarget.js's withTarget
// and finishVolume, and the clouds' blit), and both now restore the FRAME
// TARGET (renderTarget.js setFrameTarget). So:
//
//   4. THE FRAME IMAGE: with the lane on, the whole world - the renderer's
//      passes and every foreign pass alike - draws into a canvas-sized
//      image with its own depth, bound at beginFrame. The frame's first
//      screen-space draw RESOLVES it to the canvas: the frame decoded to
//      linear, the bloom and the shafts added, a vignette over the world
//      rect, a touch of contrast about mid-grey, encoded once.
//   5. EYE ADAPTATION: the resolve measures the frame's mean log
//      luminance over the world rect (a 32x32 image and its mip chain), and
//      a 1x1 image carries the adapted exposure multiplier - eased toward
//      key / luminance each frame, fast when the eye closes (into light),
//      slow when it opens (into dark), clamped to [AIR_ADAPT_MIN,
//      AIR_ADAPT_MAX]. The lane's shaders and the far ring multiply their
//      exposure by it (uAdapt, unit 11) - which is why a walk from noon
//      into a dungeon goes near-black and opens over seconds, and why the
//      dungeon stays dark once it has: the multiplier's ceiling is the
//      floor of the dark.
//   6. BLOOM FROM THE FRAME: the bright pass of the decoded frame (above
//      AIR_BRIGHT_THRESHOLD) joins the emitters and the glares in the
//      bloom source before the blur, so a sunlit wall and a flame both
//      glow, not only what carries an emission map.
//
// The frame is 8-bit and display-encoded: the lane's forward tonemap keeps
// the headroom (a torch's near field still blooms to white inside EL1's
// shoulder), and the foreign passes keep writing the display values they
// always wrote - a float frame would need every one of their shaders to
// output linear, which is the one thing this pass does not touch. EL6:
// both encodes (the lane's, the resolve's) are DITHERED at the byte
// (orderedDither.js's bayer4, zero-mean) - a lantern's falloff on a dark floor was bands.
//
// LA-POST (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look
// for flickering issues"): the chain audited, every finding measured first
// (07-Rendering/Enhanced-Lighting-Arc.md, LA-POST). The bright pass reads its
// whole block (AIR_BRIGHT_TAPS); the glare's taps are soft, filtered and off
// the flat's edge, its size held against the light's flicker (AIR_GLARE_TAPS,
// heldGlareRange); the bloom and the shafts are half floats where the GL
// renders them; the eye is sixteen bits (packAdapt); the AO blur's window is a
// share of the distance; the contact march holds a surface to its own
// tolerance, claims softly and is cut when the frame before is not this
// frame's (shiftOrigin, invalidatePrev); the frame binds one of two
// framebuffers, and nothing is drawn or cleared that nothing reads.
//
// This module imports nothing of the renderer or the lane; the renderer
// hands it its own vertex shaders and its program builder, as the shadow
// pass takes them.

import { multiply } from '../world/mat4.js';
import { setFrameTarget } from './renderTarget.js';
import { CLOUD_SHADOW_GLSL } from './cloudShadow.js';   // VC6c: a covered sun throws no shafts - the same field the ground's shadow reads
import { BAYER_GLSL, BAYER_MEAN } from './orderedDither.js';   // EL6: the port's one Bayer - the dither at the byte, the AO's rotation
import { spherePlanes, recordVisible, subMeshVisible, batchVisible, ZERO_ORIGIN } from './bounds.js';   // EL5: the emission replay culls by the records' spheres too (a leaf's import: bounds.js touches no GL)
import { billboardKey } from './billboardKey.js';   // AUDIT 68 S16-bbkey-stale-shadow-reach: re-keyed here, however the batch reached the records

/** The kill door: `?air=off` keeps EL1 and EL2 and drops the three effects. */
export function airOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('air') !== 'off';
}
/** EL8: the contact shadows' door - `?contact=off` (the air's shape). */
export function contactOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('contact') !== 'off';
}

/** The AO image's scale of the world viewport, and the bloom's and shafts'. */
export const AIR_AO_SCALE = 0.5;
export const AIR_BLOOM_SCALE = 0.25;
/** The hemisphere's radius in world units (a door is ~2 tall), the sample
 *  count, the strength (1 = a fully occluded crevice loses all ambient),
 *  and the depth bias against self-occlusion.
 *
 *  HQ1 (2026-09-23, Mac: "make some insane improvements to our lighting system"): HORIZON-BASED. EL3's occlusion
 *  scattered twelve points through a hemisphere and counted the ones the depth image put behind a surface - a
 *  coin toss per sample, so a crevice's darkness was a speckle the blur then smeared, and a flat floor beside a
 *  wall took as much as the corner itself. This is the ground-truth form (GTAO, Jimenez 2016): in each of
 *  AIR_AO_DIRECTIONS screen-space slices through the pixel, march AIR_AO_SAMPLES steps out each way along the
 *  slice to the radius, keep the HIGHEST horizon angle either side (the steepest thing that could shade this
 *  point), and integrate the cosine-weighted visibility of the arc between the two horizons - which is exactly
 *  the ambient light a hemisphere of that shape lets in. The slices turn with the ordered rotation (EL6's Bayer:
 *  the 4x4 box blur averages exactly one tile of it), and a step's distance falls off its weight so a wall
 *  beyond the radius shades nothing. The result is smooth where the surface is flat, dark where two surfaces
 *  meet, and reads the depth image no more times than EL3 did. */
export const AIR_AO_RADIUS = 0.8;
export const AIR_AO_SAMPLES = 6;       // HQ1: steps per side of a slice
export const AIR_AO_DIRECTIONS = 2;    // HQ1: slices per pixel (the blur's tile completes the turn)
export const AIR_AO_STORE = 0.5;       // AUDIT HQ1: the AO image holds a pixel's UNCLAMPED share at this scale (two slices of a grazing floor reach 1.1; one reaches 1.55)
export const AIR_AO_FALLOFF = 0.6;     // AUDIT HQ1: the share of the radius over which a step's claim eases to nothing (the reference's 0.615)
export const AIR_AO_STRENGTH = 1.0;
export const AIR_AO_BIAS = 0.02;
/** LA-POST5 (2026-09-27, Mac: "look for flickering issues"): the AO blur's depth window is a SHARE of the centre's
 *  view distance (VOL1's blur's own rule), never under AIR_AO_RADIUS. EL7's window was the radius in absolute units:
 *  the ground's view distance climbs ~d^2/(eye height) per pixel up the screen, so past ~20 units the tile's upper and
 *  lower rows fell outside it, the blur averaged only across, and the ordered rotation's pattern stood in 8-pixel
 *  stripes that swam with every step. */
export const AIR_AO_BLUR_SHARE = 0.15;
/** EL6: how much of the AO the resolve applies to the whole frame (the
 *  occlusion is read off the frame's own depth now, at the resolve, and
 *  multiplies the lit result - not the ambient alone in the world shaders). */
export const AIR_AO_RESOLVE = 0.75;
/** EL6: an emitter's own slack against the frame's depth, world units - it
 *  is IN the depth image (the same draw), so its own texel passes; a wall in
 *  front of it does not. */
export const AIR_EMIT_SLACK = 0.15;
/** The bloom's gain on the composite, and the glare sprite's size per
 *  square root of a lantern's range (range 18 -> ~1.5 units). */
export const AIR_BLOOM_STRENGTH = 0.6;
export const AIR_GLARE_SIZE = 0.25;   // EL7: a glare the size of a flame, not a ball (0.35 was a unit and a half across at a lantern's range)
/** EL5: the world-unit slack of a glare's occlusion test; EL7: it is a
 *  PRESENCE test now - the frame's depth must hold a surface within this of
 *  the light (the flame flat under it), else there is no glare: a light
 *  floating in air (the torch in the player's hand, the Light spell's
 *  candle, a lantern placed above its flat) drew a bright ball "not
 *  connected to the source". */
export const AIR_GLARE_SLACK = 0.25;   // F4 (2026-09-17, Mac: "bloom circle disconnected from light sources and still reports of light bloom balls appearing behind floors/ceilings"): a QUARTER unit, either side. At a unit the band took a ceiling 0.4 in front of a hanging lantern and a wall 0.5 behind a bare light for "a flame" - the ball through the floor above, the ball beside a light with no flat. A flame flat is a camera-facing quad THROUGH the light, so its opaque texels sit at the light's own planar depth: a quarter unit holds the flat and nothing else
/** EL8: SCREEN-SPACE CONTACT SHADOWS - for every lantern that has no caster
 *  slot (the forty-two past the six), a march from the fragment toward the
 *  light through the PREVIOUS frame's depth, reprojected by the previous
 *  frame's view-projection (the current frame's depth is being written
 *  while the world pass reads - a frame old and reprojected is the depth a
 *  forward renderer can have): the length in world units, the thickness a
 *  ray may pass behind a surface and still count it an occluder, the steps,
 *  and the floor a contact shadow darkens to (an approximation is not
 *  black). The reserved unit is the AO's old one. */
export const AIR_CONTACT_LENGTH = 0.6;
export const AIR_CONTACT_THICKNESS = 0.8;
export const AIR_CONTACT_STEPS = 4;   // F5: four over 0.6 units is a step every 15 cm under a thickness of 80 - the contact it finds, six found
export const AIR_CONTACT_FLOOR = 0.15;
export const AIR_CONTACT_UNIT = 12;
/** F5: the march runs only for a light within this share of its range of
 *  the fragment - past it the windowed falloff has the light under a tenth
 *  and a contact shadow on it is invisible; a town's forty lanterns each
 *  reached every fragment in their window with four depth taps. */
export const AIR_CONTACT_RANGE_FRACTION = 0.7;
/** LA-POST6 (2026-09-27, Mac: "look for flickering issues"): THE MARCH'S OWN TOLERANCES.
 *  - AIR_CONTACT_SELF: F3's check - the surface was in the previous frame where it stands - held its depth there to
 *    the occluder THICKNESS (0.8), so a wall revealed within 80 cm behind a pillar, a townsman or a door's edge passed
 *    it, marched through the pillar's frame-old depth and wore its shadow for the frames of the reveal. The surface's
 *    own tolerance is this, plus what one texel of the previous depth spans on this surface at this distance (the
 *    slope term, AIR_CONTACT_SLOPE_MAX the steepest grazing it credits).
 *  - AIR_CONTACT_RAMP: a step's claim is soft - it rises from 0.02 behind the previous depth to 0.02 + this, and eases
 *    out over the last quarter of the thickness - where it was all or nothing off one NEAREST texel per light.
 *  - AIR_CONTACT_CUT: an eye that moved further than this between two world frames made a cut (a teleport, a load, a
 *    door), and the next frame marches against no previous depth at all. */
export const AIR_CONTACT_SELF = 0.05;
export const AIR_CONTACT_SLOPE_MAX = 16;
/** LA-AUDIT B1 (2026-09-27, the audit before LA's merge; lens B measured it): THE LIFT IS IN THE TOLERANCE. The march
 *  starts this far off the surface along its normal, and the self-check reprojects that lifted point - which, seen
 *  along its own ray, stands about AIR_CONTACT_LIFT / cos(slope) nearer than the surface the previous depth holds there
 *  (0.12 on the ground ten units off, the eye 1.7 up). LA-POST6's tolerance had no term for it, and its texel term
 *  shrinks as the resolution grows, so at 1080p the floor's contact shadows fell out: 101 of 400 shadowed rows before a
 *  crate 4-30 units off (235 of 533 at 1440p, 19 of 269 at 720p, none at the pin's 320 x 200), and pulsed on a walk. */
export const AIR_CONTACT_LIFT = 0.02;
export const AIR_CONTACT_RAMP = 0.08;
export const AIR_CONTACT_CUT = 4;
/** EL7: a JS number as a GLSL float literal. `${1.0}` is "1" - an int to the
 *  compiler, and "'<=' : wrong operand types" on a real GPU (the probe's
 *  catch; the fake GL compiles anything). Every whole-number constant that
 *  reaches a shader goes through here. */
export const glslFloat = (v) => (Number.isInteger(v) ? `${v}.0` : String(v));
/** AUDIT-EL F11: a light with a range past this is the storm's flash (Dynamic
 *  Skies: 500..1000), not a lantern, and gets no glare. */
export const AIR_GLARE_MAX_RANGE = 120;
/** The shafts: taps along the ray, the per-tap decay, the gain, the
 *  angular reach of the sun's mask (in the shaft image's UV). */
export const AIR_SHAFT_TAPS = 32;
/** VOL1 (2026-09-23, Mac: "Continue" - the second arc's last step): THE LANTERNS' GLOW THROUGH THEIR SHADOWS.
 *  EL1's glow was one closed-form integral per lantern per FRAGMENT in every world shader, and it knew nothing of
 *  what stood between the lantern and the air: a lamp behind a pillar glowed through it. The glow is the air
 *  pass's now, at the bloom's size: per pixel, each lantern's overlap with the view ray is walked in AIR_VOL_STEPS
 *  jittered steps, each step's share of the same integrand (1 / (h^2 + s^2), elScatter's) let through by the
 *  lantern's own cube map (one tap, pointShadowOne), a lantern with no map keeping the closed form; the sum is
 *  tonemapped as elFinish tonemaps it, blurred once (the jitter), and added at the resolve. Fewer fragments walk
 *  fewer lights (a sixteenth of the pixels), and a wall casts its shadow into the air. */
export const AIR_VOL_STEPS = 8;
export const AIR_VOL_BLUR_SHARE = 0.15;   // VOL1: a blur tap counts while its view distance is within this share of the centre's
export const AIR_SHAFT_DECAY = 0.96;
export const AIR_SHAFT_STRENGTH = 0.35;
export const AIR_SHAFT_REACH = 0.35;
/** VC7b (2026-09-23, Mac: "improve the volumetric cloud system to be more immersive" - light shafts): THE SUN IN THE
 *  HAZE. The air under a broken deck is lit where the sun reaches it and not where a bank shades it, and that is seen
 *  from any direction, not only toward the sun. Per shaft pixel the view ray is walked AIR_HAZE_STEPS jittered steps
 *  out to AIR_HAZE_REACH metres; each step's sunlight is the cloud shadow map read where its sun ray meets the ground
 *  (the map holds the slab's transmittance up the sun's ray from y = 0, and a point below the slab lies on that ray),
 *  weighted by the fog's own extinction and a forward-scattering phase (Henyey-Greenstein, AIR_HAZE_G, mixed with
 *  AIR_HAZE_ISO of isotropic so the anti-sun side is not black). AIR_HAZE_GAIN is the share of the KEY light (the
 *  sun's colour at the frame's sunScale - AUDIT-VC7 B6: it was the colour alone, so the haze kept the tune's key at
 *  dawn and under a storm, 10x the ground's at 06:30) the haze gives back. Tuned on tools/vc7bHazeProbe.mjs, under
 *  a key of AIR_HAZE_PROBE_KEY and the clear day's own fog (linear to 2400), as a share of the colour: 0.5 left lanes of
 *  shade across the view all but invisible; 3 blew the sky toward a low sun to white; 1.5 read the lanes and
 *  over-brightened toward the sun, where the dome's own glow and EL3's beams already are. It is additive, so the
 *  contrast between lit and shaded air can never exceed what a fully lit day adds - a forward glow about the sun,
 *  an aureole, not a re-colouring. The ground near the eye takes little of it by construction (a short ray through
 *  thin haze scatters little), as the world fog leaves near ground clear. */
export const AIR_HAZE_STEPS = 12;
export const AIR_HAZE_REACH = 3000;
export const AIR_HAZE_G = 0.6;
export const AIR_HAZE_ISO = 0.3;
/** AUDIT-VC7 (B6): the key light's scale the haze was tuned under - the probe's own; the gain holds the tuned look there. */
export const AIR_HAZE_PROBE_KEY = 0.9;
export const AIR_HAZE_GAIN = 1 / AIR_HAZE_PROBE_KEY;
/** EL4: the adapted-exposure image's unit, below the AO's. */
export const AIR_ADAPT_UNIT = 11;
/** EL4: the luminance image's side (its mip chain's top is the mean). */
export const AIR_LUM_SIZE = 32;
/** EL4: the adaptation - the mid-grey the eye aims the mean luminance at,
 *  the multiplier's floor and ceiling (the ceiling is what keeps a dark
 *  dungeon dark once the eye has opened), the rates per second toward a
 *  brighter multiplier (opening, into dark) and a dimmer one (closing,
 *  into light - the eye closes faster than it opens). */
export const AIR_ADAPT_KEY = 0.18;
export const AIR_ADAPT_MIN = 0.7;
export const AIR_ADAPT_MAX = 1.8;
export const AIR_ADAPT_OPEN = 0.6;
export const AIR_ADAPT_CLOSE = 3.0;
/** EL4: the 8-bit encodings - log2 luminance over [-12, 4] stops, log2
 *  multiplier over [-2, 2]. */
export const AIR_LUM_LOG_RANGE = Object.freeze([-12, 4]);
export const AIR_ADAPT_LOG_RANGE = Object.freeze([-2, 2]);
/** EL4: the bright pass's threshold on the decoded frame, the vignette's
 *  strength at the corners of the world rect, the contrast about mid-grey. */
export const AIR_BRIGHT_THRESHOLD = 0.85;
export const AIR_VIGNETTE = 0.28;
export const AIR_CONTRAST = 1.04;
/** EL4: the longest step the adaptation integrates (a hitch is not a second). */
export const AIR_ADAPT_MAX_DT = 0.1;
/** LA-POST4 (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look for flickering issues"): THE EYE IN
 *  SIXTEEN BITS. The adapted multiplier lived in ONE byte of log2 over AIR_ADAPT_LOG_RANGE - 4/255 of a stop a step -
 *  and a frame's step under half of one rounded back to where it stood. Opening (0.6/s) at 60 Hz moves 1% of the gap a
 *  frame, so the eye stopped dead unless the target stood 55% away; at 144 Hz (0.4% a frame) it never opened at all, and
 *  a spike (a muzzle flash, the storm's flash) closed it by whole bytes with nothing small enough to bring it back. The
 *  state is sixteen bits now - the high byte in R, the low in G of the same RGBA8 1x1 image (renderable on every GL, no
 *  extension) - a step of 6e-5 of a stop; `airAdaptLog2` decodes it wherever the eye is read. */
export const AIR_ADAPT_STEPS = 65535;

/** EL4: the log encodings, JS of the shaders' - term for term (the luminance image's bytes; LA-POST4: the eye's
 *  sixteen bits are packAdapt / unpackAdapt below). */
export function packLog(x, range) {
  const v = (Math.log2(Math.max(x, 1e-9)) - range[0]) / (range[1] - range[0]);
  return Math.min(Math.max(v, 0), 1);
}
export function unpackLog(v, range) {
  return Math.pow(2, range[0] + v * (range[1] - range[0]));
}
/** LA-POST4: the eye's multiplier as the two bytes its image holds - [high, low] of the log encoding at sixteen bits,
 *  ADAPT_FS's encode term for term (round to the nearest step, the high byte, the rest). */
export function packAdapt(m) {
  const q = Math.floor(packLog(m, AIR_ADAPT_LOG_RANGE) * AIR_ADAPT_STEPS + 0.5);
  const hi = Math.floor(q / 256);
  return [hi, q - hi * 256];
}
/** LA-POST4: the multiplier two bytes hold - `airAdaptLog2`'s decode (a byte b reads b / 255, so R * 65280 + G * 255 is
 *  the sixteen-bit step). R = G = b decodes to b / 255: the bare images holding [128, 128, 128] read as they always did. */
export function unpackAdapt(hi, lo) {
  return unpackLog((hi * 256 + lo) / AIR_ADAPT_STEPS, AIR_ADAPT_LOG_RANGE);
}
/** LA-POST4: one frame of the eye AS THE GPU KEEPS IT - the stored bytes decoded, adaptStep, encoded again. With the
 *  old single byte (`bits` 8) a small step rounds back to the byte it started on; at sixteen it moves. */
export function adaptStepStored(bytes, lum, dt, bits = 16) {
  if (bits === 8) {
    const next = adaptStep(unpackLog(bytes[0] / 255, AIR_ADAPT_LOG_RANGE), lum, dt);
    return [Math.round(packLog(next, AIR_ADAPT_LOG_RANGE) * 255), 0];
  }
  return packAdapt(adaptStep(unpackAdapt(bytes[0], bytes[1]), lum, dt));
}
/** LA-POST4: one luminance tap's log, as LUM_FS scores it - clamped to the encoded range. A black tap was log2(1e-9),
 *  -29.9 stops, eighteen below the range's floor: a frame one-fifth black read 3.6 stops darker than its lit four
 *  fifths, and a dark floor dithered between the bytes 0 and 1 swung the mean with the dither. */
export function lumTapLog(l, prev = 1) {
  return Math.min(Math.max(Math.log2(Math.max(l / prev, 1e-9)), AIR_LUM_LOG_RANGE[0]), AIR_LUM_LOG_RANGE[1]);
}
/** EL4: one adaptation step - the JS of ADAPT_FS. `prev` and the result are
 *  multipliers, `lum` the frame's mean luminance (linear), `dt` seconds. */
export function adaptStep(prev, lum, dt) {
  const target = Math.min(Math.max(AIR_ADAPT_KEY / Math.max(lum, 1e-6), AIR_ADAPT_MIN), AIR_ADAPT_MAX);
  const rate = target > prev ? AIR_ADAPT_OPEN : AIR_ADAPT_CLOSE;
  const t = 1 - Math.exp(-Math.min(Math.max(dt, 0), AIR_ADAPT_MAX_DT) * rate);
  return prev + (target - prev) * t;
}

/** The four numbers a shader needs to undo the renderer's perspective
 *  (world/mat4.js's `perspective`, mirrored or not): [0] and [5] the focal
 *  terms, [10] and [14] the depth terms. */
export function projInfo(proj, out = new Float32Array(4)) {
  out[0] = proj[0]; out[1] = proj[5]; out[2] = proj[10]; out[3] = proj[14];
  return out;
}

/** View-space depth (negative, the camera looks down -z) from an NDC depth
 *  z in [-1, 1] - the JS of the shader's reconstruction, term for term. */
export function viewDepth(zNdc, p10, p14) {
  return -p14 / (zNdc + p10);
}

/** The sun's position on screen as [u, v] in [0, 1] of the viewport, or
 *  null when it is behind the camera. `lightDir` is the direction TOWARD
 *  the sun; a directional light projects as a point at infinity (w = 0). */
export function sunScreenUV(proj, view, lightDir) {
  const vx = view[0] * lightDir[0] + view[4] * lightDir[1] + view[8] * lightDir[2];
  const vy = view[1] * lightDir[0] + view[5] * lightDir[1] + view[9] * lightDir[2];
  const vz = view[2] * lightDir[0] + view[6] * lightDir[1] + view[10] * lightDir[2];
  const cx = proj[0] * vx + proj[4] * vy + proj[8] * vz;
  const cy = proj[1] * vx + proj[5] * vy + proj[9] * vz;
  const cw = proj[3] * vx + proj[7] * vy + proj[11] * vz;
  if (!(cw > 1e-6)) return null;
  return [cx / cw * 0.5 + 0.5, cy / cw * 0.5 + 0.5];
}


/** A lantern's glare sprite size, world units, from its range. */
export function glareSize(range) {
  return AIR_GLARE_SIZE * Math.sqrt(Math.max(range, 0));
}

/** LA-POST2 (2026-09-27, Mac: "look for flickering issues"): THE GLARE'S TAPS, in half-sizes of the glare about the
 *  light (view space, x right, y up). EL7's seven - the centre, one and two half-sizes above and below (a city light
 *  sits at the TOP of its flat, a dungeon light at its base), one either side - were each a binary answer off one
 *  NEAREST texel, so the glare moved in sevenths. Worse, three of them stood ON THE LIGHT'S OWN ROW, which is exactly
 *  the flat's top edge (or its base): the texels there change hands with every sub-pixel step of the eye, and those
 *  three changed together - three sevenths of the glare blinking with the head's bob. The footprint is EL7's still
 *  (the vertical arm two half-sizes either way, the horizontal one either side - the glare keeps the level Mac's eye
 *  set on it), sampled by twenty-eight taps that stand OFF the light's row (three tenths of a half-size at least) and
 *  each on a row and a column of its own, so no two cross a texel edge at once and one that does is a 28th of the
 *  glare; every tap is a soft, filtered answer (GLARE_VS). The vertical arm: ten heights from 0.3 to 1.92 half-sizes,
 *  above and below, each a hair across (alternately); the horizontal arm: a quarter to one half-size either side,
 *  each 0.4 to 0.55 above or below the light's row (alternately, so both halves of a flat's width are read). */
export const AIR_GLARE_TAPS = Object.freeze((() => {
  const taps = [];
  for (let k = 0; k < 10; k++) {
    const y = +(0.3 + 0.18 * k).toFixed(2), x = +(0.012 * (k + 1) * (k % 2 ? -1 : 1)).toFixed(3);
    taps.push([x, y], [-x, -y]);
  }
  for (let k = 0; k < 4; k++) {
    const x = 0.25 * (k + 1), y = +((0.4 + 0.05 * k) * (k % 2 ? 1 : -1)).toFixed(2);
    taps.push([x, y], [-x, -y]);
  }
  return taps.map((t) => Object.freeze(t));
})());
/** LA-POST2: THE GLARE DOES NOT FOLLOW THE FLICKER. The size - and with it every tap's place - came from the LIVE
 *  range, which CityLightAnimator walks 0.4 at a time, 14 times a second, over [start - 1.4, start + 0.4]: the taps
 *  breathed with it and a still lamp's glare blinked. A light's glare is sized by a range HELD per light (by its place,
 *  glareKey): a rise is taken at once, a fall only once it passes this band - wider than the animator's 1.8, so the
 *  held range settles on the flicker's top within a second and stays; a light whose range really changes follows. */
export const AIR_GLARE_HOLD_BAND = 2;
export function heldGlareRange(held, live) {
  return !(held > 0) || live > held || live < held - AIR_GLARE_HOLD_BAND ? live : held;
}
/** LA-POST2: a light's place as one number - an eighth of a unit a step, 2^17 steps an axis (wrapping), so the key is
 *  an exact double and a static light, whose position is the same float every frame, finds its own held range. */
const GLARE_KEY_SPAN = 131072;
export function glareKey(x, y, z) {
  const q = (v) => ((Math.round(v * 8) % GLARE_KEY_SPAN) + GLARE_KEY_SPAN) % GLARE_KEY_SPAN;
  return (q(x) * GLARE_KEY_SPAN + q(y)) * GLARE_KEY_SPAN + q(z);
}

/** LA-POST1 (2026-09-27, Mac: "look for flickering issues"): THE BRIGHT PASS'S TAPS, in full-resolution pixels off a
 *  bloom texel's centre. The bloom image is a quarter of the frame each way, so its texel's centre is the CORNER where
 *  the middle four pixels of a 4x4 block meet, and one bilinear read there averaged those four alone: twelve pixels in
 *  sixteen were never read, and a flame, a glint or a window under ~4 pixels bloomed only while it stood on the middle
 *  four - its halo popped with every sub-pixel step and every frame of the flame's animation. Four reads at the four
 *  corners one pixel out each average one 2x2 quarter of the block: together, every pixel once, a sixteenth each. */
export const AIR_BRIGHT_TAPS = Object.freeze([[-1, -1], [1, -1], [-1, 1], [1, 1]].map((t) => Object.freeze(t)));

/** EL6: THE DEPTH BLOCK, for every pass that reads the frame's depth: the
 *  texel's view distance and the sample at a world-rect uv (the frame is
 *  canvas-sized; the images are the world rect's). */
const DEPTH_GLSL = `
uniform highp sampler2D uDepth;   // AUDIT-VC7 (G2): a fragment shader's samplers are lowp unless told - a depth read at lowp is not a depth
uniform vec4 uProjInfo;   // proj[0], proj[5], proj[10], proj[14]
uniform vec4 uRect;       // the world rect in canvas pixels
uniform vec2 uCanvas;
float viewDist(float d01) {
  float z = d01 * 2.0 - 1.0;
  return uProjInfo.w / (z + uProjInfo.z);   // -viewZ: positive, along the eye's -z
}
float depthAt(vec2 wuv) {   // AUDIT-VC7 (G3): level 0 by name - a depth image has no others, and a loop's branch has no derivatives to choose one by
  return textureLod(uDepth, (uRect.xy + wuv * uRect.zw) / uCanvas, 0.0).r;
}
`;



/** DISC7: the rect the previous frame's depth was written under, as the contact block samples it - the world
 *  viewport in pixels (GL's bottom-left origin, `rect`) over the canvas it sits in (`canvas`, [W, H]). */
export function holdPrevRect(out, rect, canvas) {
  const W = canvas[0] > 0 ? canvas[0] : 1, H = canvas[1] > 0 ? canvas[1] : 1;
  out[0] = rect[0] / W; out[1] = rect[1] / H; out[2] = rect[2] / W; out[3] = rect[3] / H;
  return out;
}

/** EL8: THE CONTACT BLOCK, for the lit lane shaders (a solid's, the terrain's,
 *  a rig's - not a flat's): light i without a caster slot takes a contact
 *  shadow off the previous frame's depth. `toLight` is the unit direction,
 *  `dist` the distance; the march covers min(dist, AIR_CONTACT_LENGTH).
 *  LA-POST6: it reads the host shader's `uCamPos` (every lane shader that
 *  takes the block declares it first) for the surface's slope to the eye. */
export const AIR_CONTACT_GLSL = `
uniform highp sampler2D uPrevDepth;   // AUDIT-VC7 (G2): a depth, at a depth's precision
uniform mat4 uPrevVP;
uniform vec4 uPrevProjInfo;   // the previous frame's projection terms (viewDist)
uniform vec4 uContactParams;  // x length, y thickness, z floor, w 1 = on
// DISC7: the previous frame's WORLD RECT in the canvas, normalised (x, y, w, h). uPrevVP's clip space covers the
// world viewport, and the depth it was written under is the whole canvas - a docked large HUD takes the bottom of it.
// Every other screen pass maps through its rect (DEPTH_GLSL's depthAt); this block read the canvas as if the rect
// were all of it, so under the docked bar every sample came from the wrong row and near the bottom from the bar's
// cleared strip. The bounds tests stay in the rect's own [0,1].
uniform vec4 uPrevRect;
vec2 prevDepthUV(vec2 wuv) { return uPrevRect.xy + wuv * uPrevRect.zw; }
float contactShadow(vec3 wp, vec3 n, vec3 toLight, float dist) {
  if (uContactParams.w <= 0.0) return 1.0;
  float len = min(dist, uContactParams.x);
  vec3 start = wp + n * ${glslFloat(AIR_CONTACT_LIFT)};
  // F3: THE SURFACE MUST HAVE BEEN THERE. The march reads LAST frame's depth,
  // and a wall just revealed round a corner was not in it: its pixels
  // reproject onto the corner's near face, every sample lands "behind" it,
  // and the whole wall wore a shadow that swam with the turn. So the point
  // itself is reprojected first, and only a point the previous frame saw
  // where it stands is marched.
  vec4 c0 = uPrevVP * vec4(start, 1.0);
  if (c0.w <= 0.0) return 1.0;
  vec2 uv0 = c0.xy / c0.w * 0.5 + 0.5;
  if (uv0.x < 0.0 || uv0.x > 1.0 || uv0.y < 0.0 || uv0.y > 1.0) return 1.0;
  float z0 = texture(uPrevDepth, prevDepthUV(uv0)).r * 2.0 - 1.0;
  // LA-POST6: "where it stands" is the surface's own tolerance, not the occluder thickness (0.8 let a wall revealed
  // within 80 cm behind a pillar through, into the pillar's shadow): AIR_CONTACT_SELF, plus the depth one texel of the
  // previous image spans on this surface - its view distance times the texel's tangent (the rect's rows through the
  // projection's focal term) times the tangent of its slope to the eye, capped at AIR_CONTACT_SLOPE_MAX; LA-AUDIT B1: and
  // the lift the start stands off the surface, seen along the ray
  float ct = max(abs(dot(n, normalize(uCamPos - wp))), ${glslFloat(1 / AIR_CONTACT_SLOPE_MAX)});
  float texelTan = 2.0 / (abs(uPrevProjInfo.y) * uPrevRect.w * float(textureSize(uPrevDepth, 0).y));
  float tol = ${glslFloat(AIR_CONTACT_SELF)} + ${glslFloat(AIR_CONTACT_LIFT)} / ct + c0.w * texelTan * sqrt(1.0 - ct * ct) / ct;
  if (abs(c0.w - uPrevProjInfo.w / (z0 + uPrevProjInfo.z)) > tol) return 1.0;
  // LA-POST6: the steps are start + toLight * (len * i / steps) and a projection is linear in its point, so step i's
  // clip position is c0 + i * dc - one product for the march where there was one a step
  vec4 dc = uPrevVP * vec4(toLight * (len / ${glslFloat(AIR_CONTACT_STEPS)}), 0.0);
  float occ = 0.0;
  for (int i = 1; i <= ${AIR_CONTACT_STEPS}; i++) {
    vec4 c = c0 + dc * float(i);
    if (c.w <= 0.0) break;
    vec2 uv = c.xy / c.w * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
    float z = texture(uPrevDepth, prevDepthUV(uv)).r * 2.0 - 1.0;
    float sceneDist = uPrevProjInfo.w / (z + uPrevProjInfo.z);
    float behind = c.w - sceneDist;   // c.w is the point's view distance under that projection
    // LA-POST6: A CLAIM, NOT A VERDICT. Each step was all or nothing off one NEAREST texel - the floor at 0.02 behind,
    // nothing at 0.019 or past the thickness - so a contact shadow's edge flipped whole as the texels under the steps
    // changed. A step claims a share now: rising over AIR_CONTACT_RAMP past the 0.02, easing out over the thickness's
    // last quarter; the strongest claim darkens toward the floor
    occ = max(occ, smoothstep(0.02, ${glslFloat(0.02 + AIR_CONTACT_RAMP)}, behind) * (1.0 - smoothstep(uContactParams.y * 0.75, uContactParams.y, behind)));
  }
  return mix(1.0, uContactParams.z, occ);
}
`;

/** LA-POST4: the eye's image decoded - its log2 multiplier from the texel's R (the high byte) and G (the low): a byte b
 *  reads b / 255, so R * 256 + G, each read back to its byte, is the sixteen-bit step (unpackAdapt, term for term).
 *  LA-AUDIT B5 (lens B measured it): EACH BYTE ROUNDED FIRST. The samplers were lowp (a fragment shader's are, unless
 *  told - AUDIT-VC7 G2), and a GPU that fetches them at half precision returns b / 255 to 1 part in 2048: times 65280,
 *  the stored state came back up to 15.7 steps off, every frame of the read-modify-write loop, and at 144 Hz the eye
 *  settled 0.06 stops short. Rounded, any fetch finer than half a byte reads the state exactly; the samplers are highp
 *  besides. */
const ADAPT_CODEC_GLSL = `
float airAdaptLog2(vec4 t) {
  return (floor(t.r * 255.0 + 0.5) * 256.0 + floor(t.g * 255.0 + 0.5)) / ${glslFloat(AIR_ADAPT_STEPS)} * ${glslFloat(AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0])} + (${glslFloat(AIR_ADAPT_LOG_RANGE[0])});
}
`;

/** EL4: THE ADAPTATION BLOCK, for every shader that exposes: the 1x1
 *  image's multiplier, decoded from its log encoding (LA-POST4: sixteen bits). */
export const AIR_ADAPT_GLSL = `
uniform highp sampler2D uAdapt;   // LA-AUDIT B5: sixteen bits, at a precision that holds them
${ADAPT_CODEC_GLSL}
float elAdapt() {
  return exp2(airAdaptLog2(texture(uAdapt, vec2(0.5))));
}
`;

const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUV;
void main() {
  vUV = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

// the sRGB codec, the lane's (enhancedLighting.js elDecode / elEncode) restated - this module imports nothing of the lane
const CODEC_GLSL = `
vec3 airDecode(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(hi, lo, step(c, vec3(0.04045)));
}
vec3 airEncode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(hi, lo, step(c, vec3(0.0031308)));
}
`;

/** EL4: the frame's log luminance over the world rect, into the 32x32 image. */
const LUM_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFrame;
uniform highp sampler2D uPrev;   // AUDIT-EL F16: the eye's own multiplier, divided out - the frame is the ADAPTED image; LA-AUDIT B5: highp
uniform vec4 uRect;     // the world rect in canvas pixels
uniform vec2 uCanvas;
uniform sampler2D uVol;    // AUDIT VOL1: the glow the resolve will add - the eye adapts to the frame it will see
${CODEC_GLSL}
${ADAPT_CODEC_GLSL}
out vec4 outColor;
void main() {
  // AUDIT-EL F16: sixteen taps over this texel's cell of the world rect, not
  // one - a torch crossing a single tap moved the mean a stop as the camera
  // panned; and the luminance is the SCENE's, the eye divided out, so the
  // step aims at the unadapted world and not at its own output
  float prev = exp2(airAdaptLog2(texture(uPrev, vec2(0.5))));   // LA-POST4: the eye's sixteen bits
  vec2 cell = 1.0 / vec2(${AIR_LUM_SIZE}.0);
  float acc = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 t = vUV + (vec2(float(x), float(y)) + 0.5) * cell * 0.25 - cell * 0.5;
      vec2 uv = (uRect.xy + t * uRect.zw) / uCanvas;
      vec3 c = airDecode(texture(uFrame, uv).rgb) + airDecode(texture(uVol, t).rgb);   // AUDIT VOL1
      // LA-POST4: each tap's log clamped to the range the image encodes (lumTapLog) - a black tap scored -29.9 stops
      acc += clamp(log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)) / prev, 1e-9)), ${glslFloat(AIR_LUM_LOG_RANGE[0])}, ${glslFloat(AIR_LUM_LOG_RANGE[1])});
    }
  }
  float v = (acc / 16.0 - (${AIR_LUM_LOG_RANGE[0]}.0)) / ${AIR_LUM_LOG_RANGE[1] - AIR_LUM_LOG_RANGE[0]}.0;
  outColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}`;

/** EL4: one adaptation step (adaptStep, term for term) from the previous
 *  1x1 image and the luminance image's top mip. LA-POST4: the state read and
 *  written at sixteen bits (packAdapt's encode, airAdaptLog2's decode). */
const ADAPT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform highp sampler2D uPrev;   // LA-AUDIT B5
uniform sampler2D uLum;
uniform vec4 uAdaptParams;   // dt, key, min, max
uniform vec2 uAdaptRates;    // open, close
${ADAPT_CODEC_GLSL}
out vec4 outColor;
void main() {
  float prev = exp2(airAdaptLog2(texture(uPrev, vec2(0.5))));
  float lv = textureLod(uLum, vec2(0.5), ${Math.log2(AIR_LUM_SIZE)}.0).r;
  float lum = exp2(lv * ${AIR_LUM_LOG_RANGE[1] - AIR_LUM_LOG_RANGE[0]}.0 + (${AIR_LUM_LOG_RANGE[0]}.0));
  float target = clamp(uAdaptParams.y / max(lum, 1e-6), uAdaptParams.z, uAdaptParams.w);
  float rate = target > prev ? uAdaptRates.x : uAdaptRates.y;
  float t = 1.0 - exp(-uAdaptParams.x * rate);
  float next = prev + (target - prev) * t;
  float v = clamp((log2(next) - (${AIR_ADAPT_LOG_RANGE[0]}.0)) / ${AIR_ADAPT_LOG_RANGE[1] - AIR_ADAPT_LOG_RANGE[0]}.0, 0.0, 1.0);
  // LA-POST4: sixteen bits - the nearest step, its high byte in R and the rest in G (each an exact byte / 255)
  float q = floor(v * ${glslFloat(AIR_ADAPT_STEPS)} + 0.5);
  float hi = floor(q / 256.0);
  outColor = vec4(hi / 255.0, (q - hi * 256.0) / 255.0, 0.0, 1.0);
}`;

/** EL4: the bright pass - what the decoded frame holds above the threshold, over the world rect. PERF-EXT31: built
 *  with the glow's read and without it, as the resolve is (resolveFs says why).
 *
 *  LA-POST1 (2026-09-27, Mac: "look for flickering issues"): THE WHOLE BLOCK, EACH QUARTER THRESHOLDED. The one read
 *  at the texel's centre averaged the middle four pixels of its 4x4 block and nothing else (AIR_BRIGHT_TAPS says why
 *  that popped). Four bilinear reads at the block's four inner corners average its four 2x2 quarters - every pixel
 *  once, a sixteenth each - and each quarter is thresholded BEFORE the four are averaged, so a highlight that fills a
 *  quarter blooms the same wherever in the block it stands (a 3x3 flame always fills exactly one quarter; the old read
 *  took it whole at a quarter of its places and not at all at the rest). No Karis weight: the frame is display-encoded,
 *  a pixel decodes to 1 at most (2 with the glow), so there are no HDR fireflies for it to tame - and a weight by
 *  luminance would make a lone highlight's share depend on what shares its block, which is the dependence this ends. */
const brightFs = (glow) => `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFrame;
uniform vec4 uRect;
uniform vec2 uCanvas;
uniform float uThreshold;
uniform vec2 uBloomSize;  // LA-AUDIT B3: the image's own texels
uniform sampler2D uVol;   // AUDIT VOL1: a halo's core is bright enough to bloom
${CODEC_GLSL}
out vec4 outColor;
// LA-POST1: one quarter of the block - a bilinear read at a pixel corner, the 2x2 about it - with the glow, thresholded
vec3 brightTap(vec2 uv, vec3 glow) {
  vec3 c = airDecode(texture(uFrame, uv).rgb) + glow;
  return c * smoothstep(uThreshold, 1.0, dot(c, vec3(0.2126, 0.7152, 0.0722)));
}
void main() {
  // the block's centre - the corner of its middle four pixels. LA-AUDIT B3 (lens B measured it): ON A GRID OF FOUR.
  // A rect whose side is not four times the image's (1366 wide, a docked HUD's height, a dpr-scaled window) spread
  // the blocks a fraction apart, the centres fell between corners and the taps read single pixels: a 3x3 flame's
  // energy ran 0.25 to 0.5 over its 16 places at 94 of 1366 columns. Snapping each centre to its corner left the
  // fraction to gather into a column read twice (0.5) or a row read by no block (0). So the blocks are whole 4x4s on
  // one grid, centred on the rect: at most a pixel from where the image maps them, and only the grid's two edge blocks,
  // held inside the rect, read a column twice.
  vec2 grid = floor((uRect.zw - 4.0 * uBloomSize) * 0.5 + 0.5);
  vec2 uv = min(max(uRect.xy + grid + 4.0 * floor(gl_FragCoord.xy) + 2.0, uRect.xy + 2.0), uRect.xy + uRect.zw - 2.0) / uCanvas;
  vec2 px = 1.0 / uCanvas;                            // one full-resolution pixel
  vec3 glow = vec3(0.0)${glow ? ' + airDecode(texture(uVol, vUV).rgb)' : ''};
  vec3 acc = brightTap(uv + vec2(${glslFloat(AIR_BRIGHT_TAPS[0][0])}, ${glslFloat(AIR_BRIGHT_TAPS[0][1])}) * px, glow) + brightTap(uv + vec2(${glslFloat(AIR_BRIGHT_TAPS[1][0])}, ${glslFloat(AIR_BRIGHT_TAPS[1][1])}) * px, glow)
           + brightTap(uv + vec2(${glslFloat(AIR_BRIGHT_TAPS[2][0])}, ${glslFloat(AIR_BRIGHT_TAPS[2][1])}) * px, glow) + brightTap(uv + vec2(${glslFloat(AIR_BRIGHT_TAPS[3][0])}, ${glslFloat(AIR_BRIGHT_TAPS[3][1])}) * px, glow);
  outColor = vec4(acc * 0.25, 1.0);
}`;

/** EL4: THE RESOLVE - the frame to the canvas: decoded, the bloom and the
 *  shafts added over the world rect, the vignette, the contrast, encoded.
 *
 *  PERF-EXT31 (2026-09-25; two players via Mac, "fps issues in the exterior but fine in the interior" and "me too my
 *  friend.. don't know why. I got a RX6600"): BUILT FOR WHAT THE FRAME DREW. The glow is cleared black on every frame
 *  it was not marched (no lantern lit - every day outside without a torch - the door shut, a frame the pass was not
 *  prepared for), and the shafts on every frame with neither the beams nor the haze (every night). A black read adds
 *  exactly nothing - airDecode(0) is 0, and 0 * uGrade.y is 0 - yet every world pixel paid a tap and a decode (three
 *  pows) for the glow and a tap for the shafts. So the pass is built with each read and without it, and composite()
 *  takes the one for the images the frame holds; with both (glow 1, shafts 1) it is the text it always was. NOT a
 *  uniform `if`: measured on SwiftShader a gate that small is flattened and the read paid anyway (the resolve 4% faster
 *  gated, 16% with the read compiled out), and a GPU's compiler is as free to flatten it. */
const resolveFs = (glow, shafts) => `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uFrame;
uniform sampler2D uBloom;
uniform sampler2D uShaft;
uniform vec4 uRect;      // the world rect in canvas pixels
uniform vec2 uCanvas;
uniform vec4 uGrade;     // bloom gain, shaft gain, vignette, contrast
uniform sampler2D uAO;   // EL6: the occlusion off the frame's own depth
uniform float uAOMix;
uniform sampler2D uVol;  // VOL1: the lanterns' glow, tonemapped, through their shadows
${CODEC_GLSL}
${BAYER_GLSL}
out vec4 outColor;
void main() {
  vec3 c = airDecode(texture(uFrame, vUV).rgb);
  vec2 wuv = (vUV * uCanvas - uRect.xy) / uRect.zw;
  if (wuv.x >= 0.0 && wuv.x <= 1.0 && wuv.y >= 0.0 && wuv.y <= 1.0) {
    c *= mix(1.0, texture(uAO, wuv).r, uAOMix);   // EL6: the crevice loses its light here, once, whole
    c += texture(uBloom, wuv).rgb * uGrade.x${shafts ? ' + texture(uShaft, wuv).rgb * uGrade.y' : ''};
${glow ? '    c += airDecode(texture(uVol, wuv).rgb);   // VOL1: what elFinish added per fragment, once per pixel and shadowed\n' : ''}    float r = length((wuv - 0.5) * 2.0);
    c *= 1.0 - uGrade.z * smoothstep(0.55, 1.35, r);
  }
  // EL5: THE CONTRAST IS IN DISPLAY SPACE. Around 0.18 in linear light it sent
  // everything under 0.007 linear (byte 18) to black - most of a dungeon, all
  // of a night street: the frame came back with six pixels in ten pure black.
  // Around mid-grey of the encoded value the same 1.04 is a grade, not a gate.
  vec3 e = airEncode(max(c, vec3(0.0)));
  e = (e - 0.5) * uGrade.w + 0.5;
  e += (bayer4(gl_FragCoord.xy) - ${BAYER_MEAN}) / 255.0;   // EL6: the dither, at the byte, zero-mean
  outColor = vec4(clamp(e, 0.0, 1.0), 1.0);
}`;

const AO_FS = `#version 300 es
precision highp float;
in vec2 vUV;
${DEPTH_GLSL}
${BAYER_GLSL}
uniform vec4 uAOParams;     // radius, strength, bias, unused
out vec4 outColor;
// AUDIT HQ1: THE POINT IS THE TEXEL'S. A depth read lands on a whole texel of the frame's depth image, but the
// position was reconstructed at the SAMPLE's own screen coordinate - a texel's depth paired with a point up to
// half a texel away from it - so a flat floor came back a hair above and below its own plane, texel by texel,
// and more so with distance (the depth slope per texel grows): the far floor of the probe read 0.73 with nothing
// near it. The uv is snapped to the texel's centre first, in the canvas's own pixels (the depth image is the
// canvas's; the world rect maps into it), so a surface point IS a point of the surface.
vec2 texelUV(vec2 wuv) {
  vec2 px = floor(uRect.xy + wuv * uRect.zw) + 0.5;
  return (px - uRect.xy) / uRect.zw;
}
vec3 posAt(vec2 uvIn) {
  vec2 uv = texelUV(uvIn);
  float z = depthAt(uv) * 2.0 - 1.0;
  float vz = -uProjInfo.w / (z + uProjInfo.z);
  vec2 ndc = uv * 2.0 - 1.0;
  return vec3(ndc.x * (-vz) / uProjInfo.x, ndc.y * (-vz) / uProjInfo.y, vz);
}
// HQ1: the horizon along one side of a slice - the highest angle (as a cosine against the view vector) any step
// reaches, each step's claim weighted down by its distance so the radius is a soft edge and not a cliff
float horizonAt(vec3 p, vec3 n, vec3 v, vec2 uv, vec2 dir, float radiusPx, float bias) {
  float h = -1.0;
  for (int i = 1; i <= ${AIR_AO_SAMPLES}; i++) {
    float t = (float(i) - 0.5) / ${AIR_AO_SAMPLES}.0;
    vec2 suv = uv + dir * t * radiusPx;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) break;
    vec3 s = posAt(suv) - p;
    float d = length(s);
    float c = dot(s, v) / max(d, 1e-5);
    float w = clamp((uAOParams.x - d) / (uAOParams.x * ${AIR_AO_FALLOFF}), 0.0, 1.0);   // a step's claim is whole to 1 - AIR_AO_FALLOFF of the radius, then eases to nothing at it (the reference's own shape)
    c = mix(-1.0, c, w);
    // AUDIT HQ1: a step must RISE above the surface's own plane by the bias to be a horizon - a flat floor read off
    // a half-size depth image lands a hair above and below its own plane texel by texel, and without this every
    // flat surface shaded itself a fifth (the crate top read 0.81 on the probe)
    if (dot(s, n) > bias) h = max(h, c);
  }
  return h;
}
void main() {
  float d0 = depthAt(vUV);
  if (d0 >= 0.99999) { outColor = vec4(1.0); return; }
  vec3 p = posAt(vUV);
  // AUDIT HQ1: the quad's derivative stands. A normal from the nearer neighbour each way (the silhouette-edge
  // mitigation) was tried and read WORSE on SwiftShader (the crate's two flanks 0.71 / 0.95 against 0.95 / 0.96
  // here); the depth-aware blur keeps an edge quad's normal from smearing past its edge.
  vec3 n = normalize(cross(dFdx(p), dFdy(p)));
  if (dot(n, -p) < 0.0) n = -n;   // a normal faces the eye whatever the projection's handedness did to the derivatives
  vec3 v = normalize(-p);
  // the radius on screen, in the AO image's uv: the world radius over the view distance, through the focal term
  // (AUDIT HQ1: its magnitude - the hosts' projection is x-mirrored, so proj[0] is negative)
  float radiusPx = uAOParams.x * abs(uProjInfo.x) / max(-p.z, 1e-3) * 0.5;
  // EL6: the slices' rotation is a 4x4 ORDERED pattern, not a hash - the 4x4
  // box blur after it averages exactly one tile, so the pattern cancels; a
  // hash was grain that never cancelled, and in the dark the grain was all
  // a texture had ("textures in the dark look weird")
  // AUDIT HQ1: a quarter turn, not a whole one - a slice is a LINE through the pixel and the second slice is the
  // first's perpendicular, so orientations repeat every quarter turn; sixteen levels over a whole turn were four
  // orientations said four times, which the 4x4 blur tile could not tell apart (rows paired up on the probe)
  float ang = bayer4(gl_FragCoord.xy) * 1.5707963;
  float vis = 0.0;
  for (int k = 0; k < ${AIR_AO_DIRECTIONS}; k++) {
    float a = ang + float(k) * ${(Math.PI / 2).toFixed(7)};   // HQ1: the slices a quarter turn apart
    // AUDIT HQ1: the march is a CIRCLE IN VIEW SPACE. A uv step (du, dv) is a view step (du / proj[0], dv / proj[5])
    // times the depth, so a view-space circle of radius r is the uv ellipse (cos a, sin a * |proj[5] / proj[0]|) *
    // r * |proj[0]| / (2 depth) - the y term carries the ASPECT, |proj[5] / proj[0]| (1.6 at 16:9). The first cut
    // had the ratio upside down, so the vertical marches reached a third of the radius and a floor's own plane read
    // as a horizon where the too-short slice met its neighbour's.
    vec2 dir = vec2(cos(a), sin(a) * abs(uProjInfo.y / uProjInfo.x));
    // the slice's plane: the view vector and the marched direction IN VIEW SPACE - the unscaled circle, with screen
    // +x being view -x under the hosts' mirrored projection (proj[0] < 0) - so the marched side and the projected
    // normal's side agree, or the horizons' clamps land on the wrong sides
    vec3 sliceDir = normalize(vec3(dir.x / uProjInfo.x, dir.y / uProjInfo.y, 0.0));   // AUDIT HQ1: exactly the view step a uv step of dir is (posAt divides by the same terms) - the sign and the aspect fall out of it
    vec3 axis = normalize(cross(sliceDir, v));
    vec3 np = n - axis * dot(n, axis);
    float npl = length(np);
    if (npl < 1e-4) continue;   // AUDIT HQ1: a slice the normal has no part in weighs nothing (the sum is weighted by the projected normal's length, and averages to one over the slices)
    np /= npl;
    float gamma = sign(dot(np, sliceDir)) * acos(clamp(dot(np, v), -1.0, 1.0));   // the projected normal's angle off the view vector, signed toward the slice
    float h1 = acos(clamp(horizonAt(p, n, v, vUV, -dir, radiusPx, uAOParams.z), -1.0, 1.0));   // the horizon angles either side, from the view vector: h1 the -dir side
    float h2 = acos(clamp(horizonAt(p, n, v, vUV, dir, radiusPx, uAOParams.z), -1.0, 1.0));    // h2 the +dir side (gamma is signed toward +dir)
    // the arc the projected normal lets in: clamp each horizon to the hemisphere about it
    h1 = gamma + max(-h1 - gamma, -1.5707963);
    h2 = gamma + min(h2 - gamma, 1.5707963);
    // the cosine-weighted visibility of the arc [h1, h2] about gamma (GTAO's inner integral, closed form)
    float a1 = 0.25 * (-cos(2.0 * h1 - gamma) + cos(gamma) + 2.0 * h1 * sin(gamma));
    float a2 = 0.25 * (-cos(2.0 * h2 - gamma) + cos(gamma) + 2.0 * h2 * sin(gamma));
    vis += npl * (a1 + a2);
  }
  // AUDIT HQ1: NOT CLAMPED HERE. A slice's unoccluded visibility is |np| (cos gamma + gamma sin gamma), which is
  // one only AVERAGED over every slice direction (0.2 to 1.55 for one slice of a floor seen at a grazing angle) -
  // so two slices of one pixel read 0.87 to 1.09 by the pixel's rotation, and clamping each pixel to one before
  // the blur averaged the losses and kept none of the gains: a flat floor read 0.85 at some rotations and 0.97 blurred.
  // The pixel stores its share at half scale (the byte holds to 2.0) and the blur, which averages exactly one tile
  // of rotations, is where one is one again - and where the strength and the clamp are applied.
  outColor = vec4(vec3(vis / ${AIR_AO_DIRECTIONS}.0 * ${AIR_AO_STORE}), 1.0);
}`;

/** VOL1: the march - built with the lane's curve and integral and the shadow block handed in (this file is a leaf).
 *  AUDIT VOL1: with a float target (`linear`) the pixel stores its LINEAR estimate and the tile's blur averages light;
 *  the tone pass (volToneFs) then tonemaps the average once. Tonemapping each pixel's eight-step estimate before the
 *  blur dimmed a halo's core by a quarter at a lantern's range of 14 (Jensen: the mean of a concave curve's values is
 *  under the curve of the mean), and a lantern's core changed brightness as it took or lost a caster slot. Without a
 *  float target the old path stands, documented: tonemapped and encoded per pixel, blurred so. */
const volFs = ({ shadow, tonemap, scatter }, maxLights, linear) => `#version 300 es
precision highp float;
in vec2 vUV;
${DEPTH_GLSL}
${BAYER_GLSL}
${CODEC_GLSL}
${AIR_ADAPT_GLSL}
uniform vec3 uCamPos;
uniform mat3 uViewRot;              // world from view: the view's rotation, transposed
uniform vec4 uPointLights[${maxLights}];
uniform vec3 uPointColors[${maxLights}];
uniform int uPointCount;
uniform float uScatter;             // the lane's gain x the fog's density (uELScatter's own value)
uniform float uExposure;
${shadow}
${tonemap}
${scatter}
out vec4 outColor;
void main() {
  vec2 ndc = vUV * 2.0 - 1.0;
  vec3 vd = vec3(ndc.x / uProjInfo.x, ndc.y / uProjInfo.y, -1.0);   // the view ray through this pixel (posAt's own terms)
  float vlen = length(vd);
  vec3 dir = uViewRot * (vd / vlen);
  float dist = viewDist(depthAt(vUV)) * vlen;   // the surface's distance along the ray; the sky's is the far plane's
  float jitter = bayer4(gl_FragCoord.xy);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${maxLights}; i++) {
    if (i >= uPointCount) break;
    vec4 Lr = uPointLights[i];
    vec3 rel = Lr.xyz - uCamPos;
    float range = Lr.w;
    if (length(rel) > dist + range) continue;   // EL6: a lantern farther than the ray reaches plus its range glows on no part of it
    int k = uCasterOf[i];
    if (k < 0) { acc += elScatter(rel, range, dir, dist) * uPointColors[i]; continue; }   // no map (the hand's light, a far lantern): the closed form, as before
    // the march: the same integrand as elScatter's, at AIR_VOL_STEPS points across the ray's CHORD through the
    // sphere (AUDIT VOL1: a ray that misses the sphere walks nothing), each let through by the caster's cube - the
    // jitter spreads the steps over the 4x4 tile the blur averages
    float t0 = dot(rel, dir);
    vec3 hv = rel - dir * t0;
    float hraw = dot(hv, hv);
    float chord = range * range - hraw;
    if (chord <= 0.0) continue;
    chord = sqrt(chord);
    float h2 = max(hraw, 0.0625);
    float ta = max(0.0, t0 - chord), tb = min(dist, t0 + chord);
    if (tb <= ta) continue;
    float dt = (tb - ta) / ${AIR_VOL_STEPS}.0;
    float sum = 0.0;
    for (int s = 0; s < ${AIR_VOL_STEPS}; s++) {
      float t = ta + (float(s) + jitter) * dt;
      float ds = t - t0;
      sum += casterShadowOne(k, Lr, uCamPos + dir * t) / (h2 + ds * ds);   // DISC15: a 512 slot or a lo one
    }
    acc += sum * dt * uPointColors[i];
  }
  ${linear
    ? 'outColor = vec4(acc, 1.0);   // linear light, unclamped: the blur averages it and the tone pass curves the average'
    : 'outColor = vec4(airEncode(elTonemapRGB(acc * uScatter * uExposure * elAdapt())), 1.0);   // no float target: tonemapped here, as elFinish tonemaps the glow it adds'}
}`;

/** AUDIT VOL1: the tone pass - the blurred linear glow through the lane's curve, once, into the byte image the eye,
 *  the bloom and the resolve read (as elFinish tonemaps the glow it adds). Only with a float target. */
const volToneFs = ({ tonemap }) => `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform float uScatter;
uniform float uExposure;
${CODEC_GLSL}
${AIR_ADAPT_GLSL}
${tonemap}
out vec4 outColor;
void main() {
  outColor = vec4(airEncode(elTonemapRGB(texture(uSrc, vUV).rgb * uScatter * uExposure * elAdapt())), 1.0);
}`;

// VOL1: THE GLOW'S BLUR IS DEPTH-AWARE TOO. A ray to a near wall glows little (short, far from the lantern) and the ray
// past the wall's edge glows much; a plain blur put the second on the first - the lantern's light bleeding onto the
// wall that hides it (the lighting probe read the wall a third brighter). One 4x4 tile of the ordered jitter, a tap
// counting only while its view distance is within AIR_VOL_BLUR_SHARE of the centre's own (a share, not a range: the
// glow is a ray's, and rays to the same surface differ in length by little whatever their length).
const VOLBLUR_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
${DEPTH_GLSL}
out vec4 outColor;
void main() {
  float here = viewDist(depthAt(vUV));
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int y = -2; y < 2; y++) {
    for (int x = -2; x < 2; x++) {
      vec2 uv = vUV + (vec2(float(x), float(y)) + 0.5) * uTexel;
      float w = abs(viewDist(depthAt(uv)) - here) <= here * ${AIR_VOL_BLUR_SHARE} ? 1.0 : 0.0;
      acc += texture(uSrc, uv).rgb * w;
      wsum += w;
    }
  }
  outColor = vec4(wsum > 0.0 ? acc / wsum : texture(uSrc, vUV).rgb, 1.0);
}`;

// EL7: THE BLUR IS DEPTH-AWARE. A plain box averaged a wall's occlusion into
// the sky beside it and a pillar's into the floor behind it - a halo at every
// edge. A tap counts only while its view distance is within uBlurRange of
// the centre's (the AO radius: what could have occluded it at all).
// LA-POST5: or within AIR_AO_BLUR_SHARE of the centre's distance, whichever is
// wider - the ground far off climbs past the radius from one row to the next,
// and a tile blurred across alone left the rotation's pattern in stripes.
// LA-AUDIT B6 (lens B measured it): WITHIN THE RADIUS OF THE SURFACE, NOT OF
// THE CENTRE. The share let EL7's halo back: a pillar a metre before a wall,
// ten units off, sat inside 15% of the wall's distance, and the wall's texel
// at the silhouette took the pillar's occlusion (0.737 where the base kept
// 1.000). A tap now counts while its distance is within the radius of where
// the centre's own surface runs to it: per axis, the parabola through the
// centre and its two neighbours when the three are one surface (their steps
// one way and alike), the gentler side's line past an edge, and no line at a
// ridge. The ground far off is such a surface - its rows climb, but smoothly -
// so its tile stays whole; a pillar before a wall is an edge, and the wall's
// line runs flat past it. The share stays, on the step the parabola takes: a
// hyperbola's next terms, small against it until the ground meets the sky.
const AO_AXIS_GLSL = `
vec2 aoAxis(float m, float c, float p) {   // the run through c along one axis: (slope, curvature) a texel
  float a = c - m, b = p - c;
  if (a * b >= 0.0 && abs(a - b) <= max(abs(a), abs(b)) * 0.5 + uBlurRange * 0.25) return vec2((a + b) * 0.5, (b - a) * 0.5);
  if (abs(a) <= 0.5 * abs(b)) return vec2(a, 0.0);
  if (abs(b) <= 0.5 * abs(a)) return vec2(b, 0.0);
  return vec2(0.0);
}
`;
const BOX_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uBlurRange;
uniform float uStrength;   // AUDIT HQ1: the strength on the occlusion, after the tile's average
${DEPTH_GLSL}
${AO_AXIS_GLSL}
out vec4 outColor;
void main() {
  float here = viewDist(depthAt(vUV));
  vec2 tx = vec2(uTexel.x, 0.0), ty = vec2(0.0, uTexel.y);
  vec2 ax = aoAxis(viewDist(depthAt(vUV - tx)), here, viewDist(depthAt(vUV + tx)));   // LA-AUDIT B6: the surface's run
  vec2 ay = aoAxis(viewDist(depthAt(vUV - ty)), here, viewDist(depthAt(vUV + ty)));
  float acc = 0.0, wsum = 0.0;
  for (int y = -2; y < 2; y++) {
    for (int x = -2; x < 2; x++) {
      vec2 o = vec2(float(x), float(y)) + 0.5;
      vec2 uv = vUV + o * uTexel;
      float rise = ax.x * o.x + ax.y * o.x * o.x + ay.x * o.y + ay.y * o.y * o.y;   // AUDIT-EL F17: no variable named for a built-in
      float win = max(uBlurRange, abs(rise) * ${glslFloat(AIR_AO_BLUR_SHARE)});   // LA-POST5's share, on the surface's own rise
      float w = abs(viewDist(depthAt(uv)) - (here + rise)) <= win ? 1.0 : 0.0;
      acc += texture(uSrc, uv).r * w;
      wsum += w;
    }
  }
  float ao = clamp(wsum > 0.0 ? acc / wsum / ${AIR_AO_STORE} : 1.0, 0.0, 1.0);   // AUDIT HQ1: the tile's average, unscaled, is where the clamp belongs
  ao = 1.0 - (1.0 - ao) * uStrength;
  outColor = vec4(vec3(ao), 1.0);
}`;

// LA-POST3: the reads are held at 1 a channel. The bloom source is a float image where the GL has one (resize says
// why), and the emitters, the glares and the bright pass ADD into it - a flame's own three pass 1 together, and the
// byte image the gain was tuned on saturated there. Held at the first pass's read, the source is exactly what the
// byte image held (for writers that add, min(1, sum) is the byte image's answer); every later pass reads a blur of
// values under 1 (the weights sum to 1), where the hold is a no-op. The float target changes the halo's precision, not
// its level.
const GAUSS_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uSrc;
uniform vec2 uDir;   // the texel step along the axis blurred
out vec4 outColor;
const float W[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
vec3 src(vec2 uv) { return min(texture(uSrc, uv).rgb, vec3(1.0)); }
void main() {
  vec3 acc = src(vUV) * W[0];
  for (int i = 1; i < 5; i++) {
    acc += src(vUV + uDir * float(i)) * W[i];
    acc += src(vUV - uDir * float(i)) * W[i];
  }
  outColor = vec4(acc, 1.0);
}`;

// VC6c (2026-09-18, Mac: "when the sun is covered by clouds, there
// shouldnt be sky rays or sky rays coming through trees/flora"). The
// mask was SKY DEPTH ALONE - anything at the far plane near the sun's
// screen position was a light source - so a sun standing behind a bank
// still threw full-strength rays, and the ones through a tree's canopy
// were the ones that showed it worst: the leaves cut a hard silhouette
// out of a beam that should not have been there.
//
// A shaft is scattered DIRECT sunlight, so its brightness follows the
// direct sun's, which is exactly what the cloud shadow map holds at the
// player's own feet - the transmittance along the sun's ray from where
// they stand. Reading it here means the rays, the light on the ground
// and the sky the player is looking at cannot disagree: one field,
// three consumers. Squared, because a shaft needs a BEAM: half the sun
// through thin cloud is a quarter of the rays, and a bank takes them
// away rather than dimming them politely.
//
// Off the enhanced lane, and inside every building, uCloudShadowRect.w
// is 0 and cloudShadowAt answers 1 - the pass is exactly what it was.
//
// VC7b: THE BEAMS HAVE THE CLOUDS IN THEM, AND THE HAZE HAS THEIR SHADOWS.
// Two terms, one image. (1) The mask was sky or not sky; it now carries
// the sky map's own transmittance in the tap's direction, so a bank
// beside the sun cuts its beams into spokes and a gap lets them through.
// VC6c's gate stays exactly as Mac asked it: a covered sun throws none.
// (2) The haze march (AIR_HAZE_*): the sunlit air and the air a bank
// shades, seen in every direction. Both need a deck; with none (the
// classic skin, every interior, `?clouds=off`) uCloudSkyOn and the
// haze's density are 0 and the image is EL3's shafts, as before.
export const SHAFT_FS = `#version 300 es
precision highp float;
in vec2 vUV;
${DEPTH_GLSL}
${BAYER_GLSL}
${CLOUD_SHADOW_GLSL}
uniform vec2 uSun;          // the sun's screen position, uv
uniform vec4 uShaftParams;  // decay, strength, reach, aspect
uniform vec3 uSunColor;
uniform vec3 uEye;          // VC6c: the camera's world position - where the cloud shadow is read
uniform float uSunOn;       // VC7b: 1 when the sun is up and in front of the camera - the screen-space beams
uniform mat3 uViewRot;      // VC7b: world from view - a pixel's direction, for the sky map and the haze
uniform sampler2D uCloudSky;   // VC7b: the sky map - alpha the transmittance of the slab, the curtains and the ice (VC7c, VC7d) along each world direction
uniform float uCloudSkyOn;     // VC7b: 0 with no deck - the mask is sky or not sky, as before
uniform vec3 uLightDir;     // VC7b: toward the sun, world
uniform vec4 uHaze;         // VC7b: the fog's extinction per metre, the gain, the reach, AUDIT-VC7 (B6) the key light's scale
out vec4 outColor;
const float PI = 3.14159265;
vec3 worldDir(vec2 uv) {   // the view ray through this uv, in world space (VOL1's terms)
  vec2 ndc = uv * 2.0 - 1.0;
  return normalize(uViewRot * vec3(ndc.x / uProjInfo.x, ndc.y / uProjInfo.y, -1.0));
}
// VC7b: how much of the sky behind the slab shows in this direction - the composite's own parametrisation
float skyThrough(vec2 uv) {
  if (uCloudSkyOn <= 0.0) return 1.0;
  vec3 d = worldDir(uv);
  float el = asin(clamp(d.y, -1.0, 1.0));
  return textureLod(uCloudSky, vec2(atan(d.x, d.z) / (2.0 * PI), max(el, 0.0) / (0.5 * PI)), 0.0).a;   // AUDIT-VC7 (G3): read in the mask's loop
}
float mask(vec2 uv) {
  float sky = depthAt(uv) >= 0.99999 ? 1.0 : 0.0;
  vec2 d = (uv - uSun) * vec2(uShaftParams.w, 1.0);
  float near = smoothstep(uShaftParams.z, 0.0, length(d));
  return sky * near > 0.0 ? sky * near * skyThrough(uv) : 0.0;   // VC7b: the sky map read only where the tap can count
}
vec3 beams() {
  float through = cloudShadowAt(uEye);   // VC6c: how much sun reaches the player at all
  vec2 ray = (uSun - vUV) / ${AIR_SHAFT_TAPS}.0;   // AUDIT-EL F17: not 'step' - a built-in's name
  vec2 uv = vUV;
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < ${AIR_SHAFT_TAPS}; i++) {
    acc += mask(uv) * w;
    w *= uShaftParams.x;
    uv += ray;
  }
  return uSunColor * (acc / ${AIR_SHAFT_TAPS}.0 * uShaftParams.y * through * through);
}
// VC7b: the haze's phase at the cosine c between the view ray and the sun - Henyey-Greenstein, a share of it
// isotropic, over the whole sphere one
float hazePhase(float c) {
  float g2 = ${glslFloat(AIR_HAZE_G)} * ${glslFloat(AIR_HAZE_G)};
  float hg = (1.0 - g2) / pow(1.0 + g2 - 2.0 * ${glslFloat(AIR_HAZE_G)} * c, 1.5);
  return mix(hg, 1.0, ${glslFloat(AIR_HAZE_ISO)}) / (4.0 * PI);
}
// VC7b: the sun in the haze, walked through the cloud shadow
vec3 haze() {
  float sigma = uHaze.x;
  if (sigma <= 0.0 || uLightDir.y <= 0.05 || uCloudShadowRect.w <= 0.0) return vec3(0.0);
  vec2 ndc = vUV * 2.0 - 1.0;
  vec3 vd = vec3(ndc.x / uProjInfo.x, ndc.y / uProjInfo.y, -1.0);
  float vlen = length(vd);
  vec3 dir = uViewRot * (vd / vlen);
  float reach = min(viewDist(depthAt(vUV)) * vlen, uHaze.z);
  float dt = reach / ${AIR_HAZE_STEPS}.0;
  float t = dt * bayer4(gl_FragCoord.xy);
  float lit = 0.0;
  // the square the shadow map holds
  vec2 lo = uCloudShadowRect.xy, hi = uCloudShadowRect.xy + vec2(1.0 / uCloudShadowRect.z);
  for (int i = 0; i < ${AIR_HAZE_STEPS}; i++) {
    vec3 p = uEye + dir * t;
    // where this point's sun ray meets the map's ground: the maps are drawn with the eye at their y = 0 (the sky map's
    // camera, the shadow map's ground) - AUDIT-VC7 (R2): so the height is above the eye, not the world's own y, which
    // moves the lanes with the eye's height and jumps at a vertical recenter
    float h = max(p.y - uEye.y, 0.0);
    vec2 g = p.xz - uLightDir.xz * (h / uLightDir.y);
    // AUDIT-VC7 (B7): a low sun's ray meets the ground kilometres off, past the square; there the map knows nothing,
    // and nothing is not full sun - the nearest the map does know is its edge
    g = clamp(g, lo, hi);
    lit += cloudShadowAt(vec3(g.x, 0.0, g.y)) * exp(-sigma * t);
    t += dt;
  }
  float phase = hazePhase(dot(dir, uLightDir));
  return uSunColor * (lit * sigma * dt * phase * uHaze.y * uHaze.w);   // AUDIT-VC7 (B6): the KEY light - the sun's colour at its scale, a storm's dimming in it
}
void main() {
  vec3 c = haze();
  if (uSunOn > 0.0) c += beams();
  // LA-AUDIT B2 (lens B measured it): HELD AT 1, AS THE BYTES HELD IT. LA-POST3 put the shafts in half floats and
  // said the target changes precision, not level - true of the bloom, whose gaussian holds its reads at 1, but the
  // shafts never pass through it: in dense fog the jittered march writes over 1 a pixel, a byte clamped that, and a
  // half float kept it for VOLBLUR and the resolve to add. Heavy fog's haze toward the sun came out 2.46x as bright,
  // a sandstorm's 2.80x.
  outColor = vec4(min(c, vec3(1.0)), 1.0);
}`;

/** The emission-only fragment shaders for the bloom source: a solid's
 *  emission map in its colour (the window style, or white for a self-lit
 *  record); a flat's emission map behind its cutout. */
// EL6: AN EMITTER BEHIND A WALL DOES NOT BLOOM. The bloom source has no depth
// of its own (a quarter-res colour target), so every emitter used to draw
// whatever stood in front of it - a torch two rooms away bloomed through
// the stone ("all lighting sources can be seen through walls"). Each
// fragment now asks the frame's depth at its own screen position and
// discards when a nearer surface is there, with its own slack (it IS in
// that image).
const EMIT_OCCLUSION_GLSL = `
uniform vec2 uBloomSize;
bool occluded() {
  vec2 wuv = gl_FragCoord.xy / uBloomSize;
  return viewDist(gl_FragCoord.z) > viewDist(depthAt(wuv)) + ${glslFloat(AIR_EMIT_SLACK)};
}
`;
export const EMIT_MESH_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uEmissionTex;
uniform vec3 uEmissionColor;
${CODEC_GLSL}
${DEPTH_GLSL}
${EMIT_OCCLUSION_GLSL}
out vec4 outColor;
void main() {
  if (occluded()) discard;   // EL6
  outColor = vec4(airDecode(texture(uEmissionTex, vUV).rgb * uEmissionColor), 1.0);   // AUDIT-EL F20: linear, like the glares and the bright pass beside it
}`;
export const EMIT_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
${CODEC_GLSL}
${DEPTH_GLSL}
${EMIT_OCCLUSION_GLSL}
out vec4 outColor;
void main() {
  if (texture(uTex, vUV).a < 0.5) discard;
  if (occluded()) discard;   // EL6
  outColor = vec4(airDecode(texture(uEmissionTex, vUV).rgb), 1.0);   // AUDIT-EL F20
}`;

/** The lantern glare: a camera-facing quad at the light, collapsed to
 *  nothing when the depth image shows no flame there or a surface in front of
 *  it (LA-POST2: the collapse is real now - the quad leaves the clip volume). */
const GLARE_VS = `#version 300 es
layout(location=0) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uCenter;
uniform float uSize;
${DEPTH_GLSL}
out vec2 vUV;
out float vVis;
// EL5: THE OCCLUSION IS IN WORLD UNITS. The depth image is hyperbolic: a
// constant 0.002 off it hid nothing past twenty units, and a town's lanterns
// glared through its walls (the first field report).
// EL7: AND A GLARE NEEDS A FLAME UNDER IT. The test is presence, not
// "nothing nearer": the frame's depth at the tap must hold a surface within
// AIR_GLARE_SLACK of the light's own distance - the flame flat. A light in
// open air draws nothing; a light behind a wall draws nothing; taps over the
// glare's footprint (up to two half-sizes above and below it - a city light
// sits at the TOP of its flat, a dungeon light at its BASE, and a flat stands
// on its point - and one either side), so a flame half behind a post is half
// a glare.
// LA-POST2: THE TAPS STAND OFF THE EDGES, AND EACH IS SOFT AND FILTERED. Each
// of the seven was one NEAREST texel tested yes or no, three of them on the
// light's own row - the flat's top edge - so a sub-pixel step of the eye
// flipped three sevenths of a city lamp's glare at once, and its range's
// flicker slid every tap 14 times a second (glareKey holds the size still
// now). Twenty-eight taps (AIR_GLARE_TAPS) stand off the light's row, each
// on a row and a column of its own; a tap's answer is soft in depth
// (whole within half the slack, none past it) and read over the four texels
// about the point, weighted by where it sits among them (bilinear,
// percentage-closer) - a tap within a texel of an edge changes by its share
// of the four, never whole, and no two change at the same step.
const vec2 GLARE_TAP[${AIR_GLARE_TAPS.length}] = vec2[${AIR_GLARE_TAPS.length}](${AIR_GLARE_TAPS.map(([x, y]) => `vec2(${glslFloat(x)}, ${glslFloat(y)})`).join(', ')});
float distPx(vec2 px) { return viewDist(textureLod(uDepth, (px + 0.5) / uCanvas, 0.0).r); }   // the depth's texel at a canvas pixel, by index
// a flame's presence (hide false): whole within half the slack of the light's distance, none past the slack; JAN1's
// occluder (hide true): a surface nearer than the light by past the slack hides it, whole by twice the slack
float depthTest(float d, float lantern, bool hide) {
  return hide ? smoothstep(${glslFloat(AIR_GLARE_SLACK)}, ${glslFloat(2 * AIR_GLARE_SLACK)}, lantern - d)
    : 1.0 - smoothstep(${glslFloat(AIR_GLARE_SLACK / 2)}, ${glslFloat(AIR_GLARE_SLACK)}, abs(d - lantern));
}
// the test over the four texels about a world-rect uv, weighted bilinearly by the point's place among their centres
float filtered(vec2 wuv, float lantern, bool hide) {
  vec2 p = uRect.xy + wuv * uRect.zw - 0.5;
  vec2 b = floor(p), f = p - b;
  return mix(mix(depthTest(distPx(b), lantern, hide), depthTest(distPx(b + vec2(1.0, 0.0)), lantern, hide), f.x),
             mix(depthTest(distPx(b + vec2(0.0, 1.0)), lantern, hide), depthTest(distPx(b + vec2(1.0)), lantern, hide), f.x), f.y);
}
float flame(vec4 vc, float lantern) {
  vec4 clip = uProj * vc;
  if (clip.w <= 0.0) return 0.0;
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return filtered(uv, lantern, false);
}
void main() {
  vec4 vc = uView * vec4(uCenter, 1.0);
  vec4 clip = uProj * vc;
  float vis = 0.0;
  if (clip.w > 0.0) {
    vec3 ndc = clip.xyz / clip.w;
    if (abs(ndc.x) < 1.2 && abs(ndc.y) < 1.2) {
      float lantern = -vc.z;
      float s = uSize * 0.5;
      float sum = 0.0;
      for (int k = 0; k < ${AIR_GLARE_TAPS.length}; k++) sum += flame(vc + vec4(GLARE_TAP[k] * s, 0.0, 0.0), lantern);
      vis = sum / ${glslFloat(AIR_GLARE_TAPS.length)};
      // JAN1 (2026-09-18, Janome: "lights still shining thru attics at certain angles" - BUGS-5 F4's remainder).
      // Presence alone takes a FLOOR for the flame: an oblique surface sweeps a wide range of depths across the
      // footprint's taps, and at some pitches one tap lands within the slack of the light's own depth - a halo painted
      // on the floor above a lamp in the room below. The other half of the law: a surface NEARER than the light at
      // the light's OWN pixel is an occluder, whatever the footprint found. A flame flat is a camera-facing quad
      // through the light and sits at its exact depth, so it never trips this; a city light at the top of its flat
      // shows the flat or the wall behind, both at or past the depth; an open-air light's centre is sky.
      // LA-POST2: soft and filtered as the taps are - one NEAREST texel zeroed the glare whole, so a lamp at a beam's
      // edge blinked as the texel under its centre changed hands
      vec2 cuv = ndc.xy * 0.5 + 0.5;
      if (cuv == clamp(cuv, vec2(0.0), vec2(1.0))) vis *= 1.0 - filtered(cuv, lantern, true);
    }
  }
  vVis = vis;
  vUV = aCorner;
  // LA-POST2: a glare with nothing to show leaves the clip volume whole - no fragment of it is shaded
  gl_Position = vis > 0.0 ? uProj * (vc + vec4(aCorner * uSize, 0.0, 0.0)) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const GLARE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in float vVis;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  float r = length(vUV) * 2.0;
  float a = max(0.0, 1.0 - r * r);
  outColor = vec4(uColor * a * a * vVis, 1.0);
}`;

/**
 * The pass. `opts.build(vs, fs)` compiles; `opts.vs` is { mesh, bb } - the
 * renderer's own vertex shaders for the emission replay.
 */
export class AirPass {
  constructor(gl, opts) {
    this.gl = gl;
    const u = (p, n) => gl.getUniformLocation(p, n);
    const P = (vs, fs, names) => { const p = opts.build(vs, fs); const o = { p }; for (const n of names) o[n] = u(p, n); return o; };
    this.programs = {
      ao: P(QUAD_VS, AO_FS, ['uDepth', 'uProjInfo', 'uAOParams', 'uRect', 'uCanvas']),   // HQ1: no kernel - the horizons march the slices
      box: P(QUAD_VS, BOX_FS, ['uSrc', 'uTexel', 'uBlurRange', 'uStrength', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas']),
      gauss: P(QUAD_VS, GAUSS_FS, ['uSrc', 'uDir']),
      shaft: P(QUAD_VS, SHAFT_FS, ['uDepth', 'uSun', 'uShaftParams', 'uSunColor', 'uProjInfo', 'uRect', 'uCanvas', 'uEye', 'uCloudShadowMap', 'uCloudShadowRect', 'uSunOn', 'uViewRot', 'uCloudSky', 'uCloudSkyOn', 'uLightDir', 'uHaze']),   // VC6c: the cloud in front of the sun; VC7b: the sky map's gaps and the haze
      emitMesh: P(opts.vs.mesh, EMIT_MESH_FS, ['uProj', 'uView', 'uModel', 'uEmissionTex', 'uEmissionColor', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uBloomSize']),
      emitBb: P(opts.vs.bb, EMIT_BB_FS, ['uProj', 'uView', 'uRight', 'uUp', 'uOrigin', 'uSize', 'uTex', 'uEmissionTex', 'uFlatWind', 'uSway', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uBloomSize']),
      glare: P(GLARE_VS, GLARE_FS, ['uProj', 'uView', 'uCenter', 'uSize', 'uDepth', 'uColor', 'uProjInfo', 'uRect', 'uCanvas']),
      // EL4
      lum: P(QUAD_VS, LUM_FS, ['uFrame', 'uPrev', 'uRect', 'uCanvas', 'uVol']),   // AUDIT VOL1: the eye sees the glow
      adapt: P(QUAD_VS, ADAPT_FS, ['uPrev', 'uLum', 'uAdaptParams', 'uAdaptRates']),
      // PERF-EXT31: by what the frame drew - bright[glow], resolve[glow][shafts]; bright[1] and resolve[1][1] read it all
      bright: [0, 1].map((glow) => P(QUAD_VS, brightFs(glow), ['uFrame', 'uRect', 'uCanvas', 'uThreshold', 'uBloomSize', 'uVol'])),   // AUDIT VOL1: the glow's core blooms
      resolve: [0, 1].map((glow) => [0, 1].map((shafts) => P(QUAD_VS, resolveFs(glow, shafts), ['uFrame', 'uBloom', 'uShaft', 'uRect', 'uCanvas', 'uGrade', 'uAO', 'uAOMix', 'uVol']))),   // VOL1
      volBlur: P(QUAD_VS, VOLBLUR_FS, ['uSrc', 'uTexel', 'uDepth', 'uProjInfo', 'uRect', 'uCanvas']),   // VOL1: the tile's average, by depth
      vol: null, volTone: null,   // VOL1: built below, only with the lane's GLSL in hand
    };
    // the fullscreen quad and the glare's corner quad
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.glareVao = gl.createVertexArray();
    gl.bindVertexArray(this.glareVao);
    const gb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.projInfo = new Float32Array(4);
    this.aoParams = new Float32Array([AIR_AO_RADIUS, AIR_AO_STRENGTH, AIR_AO_BIAS, 0]);
    // VOL1: the glow's programs, with the lane's blocks in hand. AUDIT VOL1: a float target where the GL has one (the
    // linear path); and a shader the GL refuses (a link past its uniform budget) costs the glow alone, not the air pass
    this.volLinear = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    if (opts.glsl) {
      try {
        const vol = P(QUAD_VS, volFs(opts.glsl, opts.maxLights ?? 48, this.volLinear), ['uDepth', 'uProjInfo', 'uRect', 'uCanvas', 'uCamPos', 'uViewRot', 'uPointLights', 'uPointColors', 'uPointCount', 'uScatter', 'uExposure', 'uAdapt']);
        if (this.volLinear) this.programs.volTone = P(QUAD_VS, volToneFs(opts.glsl), ['uSrc', 'uScatter', 'uExposure', 'uAdapt']);
        const p = vol.p;
        // the march's shadow block, the names ShadowPass.upload binds by (the sun's are null here - the shader declares them and reads none)
        this.programs.vol = vol;
        vol.shadow = {
          sunShadow: u(p, 'uSunShadow'), sunVP: u(p, 'uSunVP'), sunParams: u(p, 'uSunShadowParams'), sunTexel: u(p, 'uSunTexel'),
          pointShadow: u(p, 'uPointShadow'), pointParams: u(p, 'uPointShadowParams'), shadowIndex: u(p, 'uShadowIndex'), casterOf: u(p, 'uCasterOf'), pointShadowLo: u(p, 'uPointShadowLo'),
        };
      } catch (e) {
        this.programs.vol = null; this.programs.volTone = null;
        console.warn('VOL1: the glow\'s shader did not build - the lane glows for itself', e);
      }
    }
    this.fresh = false;   // AUDIT VOL1: prepared for a world frame and not yet resolved - the images are drawn for such a frame alone
    this.volOn = true;                   // VOL1: the door (renderer.setVolumetrics)
    this.hazeOn = true;                  // VC7b: the door (renderer.setHaze)
    this._viewRot = new Float32Array(9);
    this._ones = new Float32Array(3 * (opts.maxLights ?? 48)).fill(1);
    this.shaftParams = new Float32Array([AIR_SHAFT_DECAY, AIR_SHAFT_STRENGTH, AIR_SHAFT_REACH, 1]);
    this._noDeck = new Float32Array([0, 0, 0, 0]);   // VC6c: no cloud field - amount 0, full sun
    this._haze = new Float32Array([0, AIR_HAZE_GAIN, AIR_HAZE_REACH, 0]);   // AUDIT-VC7 (B6): w the key light's scale, the frame's   // VC7b: the fog's extinction is the frame's
    this.cloudShadow = null;   // VC6c: the frame's deck, set at the resolve
    this.f = null;   // EL6: the frame's inputs, from prepare() to composite()
    // EL8: the previous frame's view-projection and projection terms, for the contact march; valid once a frame has been prepared
    this.prevVP = new Float32Array(16); this.prevProjInfo = new Float32Array(4); this.prevValid = false;
    this.prevRect = new Float32Array([0, 0, 1, 1]);   // DISC7: the previous frame's world rect in the canvas, normalised
    this._cut = false;   // LA-POST6: the next prepare has no previous frame (invalidatePrev, release)
    this._prevEye = new Float32Array(3); this._prevEyeSet = false;   // LA-POST6: the last prepared frame's eye - a jump past AIR_CONTACT_CUT is a cut
    this._glareHold = new Map(); this._glareFrame = 0;   // LA-POST2: each light's held range by its place (glareKey), and the glare pass's count
    this.contactParams = new Float32Array([AIR_CONTACT_LENGTH, AIR_CONTACT_THICKNESS, AIR_CONTACT_FLOOR, 0]);
    this.pending = false;   // a resolve is owed to the frame
    this.width = 0; this.height = 0;
    this.targets = null;
    // EL4: the frame image (canvas-sized), the luminance image and the two adaptation images
    this.frame = null;
    // RETRO1: the frame images by slot - the canvas's, and a retro world frame's (render/retroPass.js), which is
    // the retro image's size. A retro world frame and a full-size one (a video or a map over the world) can
    // alternate inside one presented frame; each keeps its own image rather than reallocating the other's
    this._frames = { canvas: null, retro: null };
    this.resolveTo = null;   // RETRO1: { fbo, w, h } - where the resolve writes instead of the canvas (the retro image)
    this.lum = null;
    this.adapt = null;      // [a, b], this.adaptIndex the current
    this.adaptIndex = 0;
    this.grade = new Float32Array([AIR_BLOOM_STRENGTH, 1, AIR_VIGNETTE, AIR_CONTRAST]);
    this.adaptParams = new Float32Array([0, AIR_ADAPT_KEY, AIR_ADAPT_MIN, AIR_ADAPT_MAX]);
    this.adaptRates = new Float32Array([AIR_ADAPT_OPEN, AIR_ADAPT_CLOSE]);
    this.canvas = new Float32Array(2);
    this.rect = new Float32Array(4);
    this._fullRect = new Float32Array(4);   // AUDIT RETRO1 B4: an unprepared frame's rect - its whole image
    this._lastResolve = 0;
    this.measured = false;   // AUDIT-EL F10
    this._now = opts.now ?? (() => (globalThis.performance?.now?.() ?? Date.now()));
    this.stats = { emitDraws: 0, glares: 0, shafts: false, haze: false, vol: false };   // VC7b: whether the haze was marched   // VOL1: whether the glow was marched this frame
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._planes = new Float32Array(24);   // EL5: the emission replay's frustum
    this._white = new Float32Array([1, 1, 1]);
    this._vp = new Float32Array(16);
  }

  /** (Re)allocate the images for a world viewport of w x h pixels. */
  resize(w, h) {
    if (this.targets && this.width === w && this.height === h) return;
    const gl = this.gl;
    if (this.targets) this._free();
    this.width = w; this.height = h;
    const color = (cw, ch, linear = false) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (linear) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, cw, ch, 0, gl.RGBA, gl.HALF_FLOAT, null);   // AUDIT VOL1: the glow's linear light (EXT_color_buffer_float / _half_float)
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, ch, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w: cw, h: ch, float: !!linear };
    };
    // EL6: no depth image of its own - the frame's depth is the one every pass reads
    const aw = Math.max(1, Math.round(w * AIR_AO_SCALE)), ah = Math.max(1, Math.round(h * AIR_AO_SCALE));
    const bw = Math.max(1, Math.round(w * AIR_BLOOM_SCALE)), bh = Math.max(1, Math.round(h * AIR_BLOOM_SCALE));
    // LA-POST3 (2026-09-27, Mac: "look for flickering issues"): THE BLOOM AND THE SHAFTS IN HALF FLOATS, where the GL
    // renders to them (the glow's own test, volLinear). They hold LINEAR light, and a byte of linear light is coarsest
    // exactly where the eye is finest: a halo's tail fell to 0 below half a step (about 0.002 - four display levels
    // once the resolve adds it at 0.6 and encodes), so every halo in the dark ended in a hard ring, and the ring jumped
    // as the flame under it flickered; one byte of the haze over a black ground is thirteen display levels. The writers
    // (the emitters and the glares adding, the bright pass adding, the gaussians, the shafts and their tile) all write
    // linear light and every reader (the gaussians, the resolve) reads it as such; the gaussians hold the sum at 1 as
    // the byte image did (GAUSS_FS). Without a float target the bytes stand, as before. The AO keeps its byte - a
    // share, not light.
    const f16 = this.volLinear;
    this.targets = {
      ao: color(aw, ah), aoBlur: color(aw, ah),
      bloom: color(bw, bh, f16), bloomB: color(bw, bh, f16),
      shaft: color(bw, bh, f16), shaftRaw: color(bw, bh, f16),   // VC7b: the haze march's jittered image, averaged into `shaft` by VOL1's depth-aware tile
      vol: color(bw, bh, this.volLinear), volB: color(bw, bh, this.volLinear),   // VOL1: the glow and its blur, at the bloom's size (AUDIT VOL1: linear light in a float target where there is one)
    };
    this.targets.volOut = this.volLinear ? color(bw, bh) : this.targets.volB;   // the byte image the eye, the bloom and the resolve read: the tone pass's, or the blurred tonemapped glow itself
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  _free() {
    const gl = this.gl, t = this.targets;
    for (const x of new Set(Object.values(t))) { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fbo); }   // AUDIT VOL1: volOut may alias volB - once each
    this.targets = null;
  }

  /** EL4: the frame image for a canvas of W x H - RGBA8 with a 24-bit depth
   *  TEXTURE (EL6: the AO, the glares, the emitters and the shafts read it
   *  at the resolve - the frame's own depth, no replay), (re)allocated when
   *  the canvas changes size. */
  _ensureFrame(W, H, slot = 'canvas') {
    const gl = this.gl;
    const kept = this._frames[slot];
    if (kept && kept.w === W && kept.h === H) {
      if (this.frame !== kept) { this.frame = kept; this.prevValid = false; }   // RETRO1: the other slot's image - its previous depth is not this frame's previous
      return kept;
    }
    if (kept) this._deleteFrame(kept);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // EL8: TWO depth textures the frames ping-pong between - the one being
    // written, and the previous frame's for the contact march; each cleared to
    // the far plane at birth through its own framebuffer
    // LA-POST8: and TWO framebuffers, the colour image with each depth - the
    // frame binds the one it writes; it re-attached its depth every frame, and
    // a changed attachment is a framebuffer the driver checks whole again
    const depths = [], fbos = [];
    for (let k = 0; k < 2; k++) {
      const depth = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, W, H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);   // the depth alone - the colour is the frame's own clear's
      depths.push(depth); fbos.push(fb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.frame = this._frames[slot] = { tex, depths, fbos, depthIndex: 0, depth: depths[0], prevDepth: depths[1], fbo: fbos[0], w: W, h: H, worldDepth: false };
    this.prevValid = false;   // a new frame image: the previous depth is the far plane
    if (!this.lum) this._ensureAdapt();
    return this.frame;
  }
  /** A frame image's texture, its two depths and their two framebuffers, deleted. */
  _deleteFrame(k) {
    const gl = this.gl;
    gl.deleteTexture(k.tex); for (const d of k.depths) gl.deleteTexture(d); for (const f of k.fbos) gl.deleteFramebuffer(f);
  }
  /** PERF-SCALE (the review): free a slot's frame image - the world stopped drawing into an image of its own (retro
   *  off, the render scale back at 100%; Renderer._dropWorldImage), so the image-sized frame is not held for the rest
   *  of the session. The frame it was is no frame now: its previous depth is nothing's previous. */
  dropFrame(slot) {
    const kept = this._frames[slot];
    if (!kept) return;
    this._deleteFrame(kept);
    this._frames[slot] = null;
    if (this.frame === kept) { this.frame = null; this.prevValid = false; }
  }
  /** EL4: the luminance image with its mip chain and the two 1x1
   *  adaptation images, the current one starting at a multiplier of 1. */
  _ensureAdapt() {
    const gl = this.gl;
    const lumTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lumTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AIR_LUM_SIZE, AIR_LUM_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const lumFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, lumFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, lumTex, 0);
    this.lum = { tex: lumTex, fbo: lumFbo, w: AIR_LUM_SIZE, h: AIR_LUM_SIZE };
    const [hi, lo] = packAdapt(1);   // LA-POST4: the multiplier 1 at sixteen bits - [128, 0]
    this.adapt = [0, 1].map(() => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([hi, lo, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fbo, w: 1, h: 1 };
    });
    this.adaptIndex = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  /** EL4: the current adaptation image - what the lane's shaders and the far ring read. */
  get adaptTexture() { return this.adapt ? this.adapt[this.adaptIndex].tex : null; }

  /** EL4: bind the frame image for the world pass of a W x H canvas, and
   *  make it the frame target every pass restores to. Returns its fbo.
   *  RETRO1: `slot` 'retro' for a retro world frame, whose W x H is the
   *  retro image's. */
  beginFrameTarget(W, H, slot = 'canvas') {
    if (!(W > 0 && H > 0)) return null;   // AUDIT-EL F18
    const f = this._ensureFrame(W, H, slot);
    const gl = this.gl;
    // EL8: this frame writes the other depth; the one just written is the previous
    f.depthIndex ^= 1;
    f.depth = f.depths[f.depthIndex]; f.prevDepth = f.depths[f.depthIndex ^ 1];
    // LA-POST6: and the previous depth is a WORLD frame's, or there is none - a menu's or a video's frame binds this
    // image too (it is not prepared: `fresh` is prepare's), and its depth under last world frame's matrix is noise
    if (!f.worldDepth) this.prevValid = false;
    f.worldDepth = this.fresh;
    f.fbo = f.fbos[f.depthIndex];   // LA-POST8: the framebuffer with this frame's depth - bound, not re-attached
    gl.bindFramebuffer(gl.FRAMEBUFFER, f.fbo);
    setFrameTarget(f.fbo);
    this.canvas[0] = W; this.canvas[1] = H;
    this.pending = true;   // AUDIT-EL F5: a bound frame is a resolve owed, whether or not the passes ran for it
    return f.fbo;
  }

  /**
   * EL6: TAKE THE FRAME'S INPUTS, at the top of a world frame - nothing is
   * drawn here. `f`: { proj, view, lightDir, sunScale, sunColor,
   * pointLights, pointColors (decoded vec3s), viewport [x,y,w,h], shadows
   * (the ShadowPass: its records and its depth programs), textures,
   * emissionTextures, blackTex, windowEmission, isSpectral, bindVao,
   * clearColor }. The cloud deck is NOT among them - it is set later, by
   * `setCloudShadow`, because the host only hands it to the renderer
   * AFTER beginFrame (VC6c). The images are drawn at the resolve, off the frame's own
   * depth: the AO, the bloom source (the emitters and the glares, both
   * occluded by that depth), the shafts. Before EL6 they were drawn HERE,
   * off a depth image the records were replayed into - a third walk of the
   * town per frame, one frame stale, and the emitters drew through walls.
   */
  prepare(f) {
    const [, , w, h] = f.viewport;
    if (!(w > 0 && h > 0)) { this.f = null; this.prevValid = false; return; }   // AUDIT-EL F18: a hidden canvas has no images to draw (texStorage2D refuses 0); AUDIT DISC7 C7: and the next frame has no previous one - its held matrices and rect would be two frames old against last frame's depth
    this.resize(w, h);
    // EL8: the frame just resolved becomes the previous - its view-projection and terms, for the contact march.
    // LA-POST6: unless this frame does not follow it - the march was never invalidated, so the frame after a door, a
    // teleport or the air back on reprojected a depth of somewhere else: a cut the host named (invalidatePrev, the
    // air's release) or an eye that jumped past AIR_CONTACT_CUT since the last world frame (a recentre moves the held
    // eye with the world, shiftOrigin, so it is no jump)
    const e = f.eye, pe = this._prevEye;
    const jumped = !!e && this._prevEyeSet && Math.hypot(e[0] - pe[0], e[1] - pe[1], e[2] - pe[2]) > AIR_CONTACT_CUT;
    if (this.f) { this.prevVP.set(this._vp); this.prevProjInfo.set(this.projInfo); this.prevValid = !!this.frame && !this._cut && !jumped; holdPrevRect(this.prevRect, this.rect, this.canvas); }
    this._cut = false;
    this._prevEyeSet = !!e;
    if (e) { pe[0] = e[0]; pe[1] = e[1]; pe[2] = e[2]; }
    this.f = f;
    this.fresh = true;   // AUDIT VOL1: a world frame's inputs, for this resolve alone
    this.rect.set(f.viewport);
    projInfo(f.proj, this.projInfo);
    multiply(f.proj, f.view, this._vp);
    this.measured = false;   // AUDIT-EL F10: set at the resolve, by whether the world drew
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false; this.stats.haze = false; this.stats.vol = false;   // this frame's, counted at the resolve
  }

  /**
   * VC6c: THE FRAME'S CLOUD DECK, and why it is not a `prepare` input.
   * `prepare` runs inside beginFrame, and beginFrame has just CLEARED the
   * deck a moment before - a deck is a frame's, not the renderer's, so an
   * interior never inherits the last exterior's map. The host sets this
   * frame's deck AFTER beginFrame returns (world.js, exterior.js). So the
   * shafts read it at the RESOLVE, where the frame's own deck is in hand.
   * The first cut of VC6c took it at prepare and was handed null every
   * frame of the real game: the gate could never have fired, the pins
   * could not see it (they drive no frame), and only the field probe did.
   */
  setCloudShadow(deck) { this.cloudShadow = deck ?? null; }

  /** LA-POST6 (2026-09-27, Mac: "look for flickering issues"): THE FLOATING ORIGIN MOVED by `offset` - the host's
   *  recentre, every world position p now p + offset (ShadowPass.shiftOrigin's convention: a record's matrix[12] +=
   *  offset[0]). The view-projections the contact march reprojects by map the OLD world, so each is rebased:
   *  VP' = VP * translate(-offset) - its fourth column less offset[0..2] times its first three - which maps a moved
   *  point where the unmoved one went. `prevVP` for a frame already prepared; `_vp`, the frame the next prepare takes
   *  as the previous (and the emitter replay, when a resolve is still owed, replays the pass's records, which the
   *  shadow pass has moved). The held eye moves with them, so a recentre is no cut. And each light's held glare range
   *  is filed again under its moved place. */
  shiftOrigin(offset) {
    const [ox, oy, oz] = offset;
    for (const m of [this.prevVP, this._vp]) {
      for (let r = 0; r < 4; r++) m[12 + r] -= ox * m[r] + oy * m[4 + r] + oz * m[8 + r];
    }
    this._prevEye[0] += ox; this._prevEye[1] += oy; this._prevEye[2] += oz;
    if (this._glareHold.size) {
      const held = [...this._glareHold.values()];
      this._glareHold.clear();
      for (const h of held) { h.x += ox; h.y += oy; h.z += oz; this._glareHold.set(glareKey(h.x, h.y, h.z), h); }
    }
  }
  /** LA-POST6: the next prepared frame follows no previous one - the contact march reads no previous depth for it (the
   *  host crossed into another scene: renderer.js, the first frame of a room drawn whole). */
  invalidatePrev() { this._cut = true; }

  /** EL6: the images, at the resolve, off the frame's depth. */
  _images() {
    const gl = this.gl, f = this.f, sp = f.shadows, T = this.targets, F = this.frame;
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false; this.stats.haze = false; this.stats.vol = false;
    this.measured = !!(sp && sp.count > 0);   // AUDIT-EL F10: a frame with no world in it (a video, a menu) is not one the eye adapts to
    const vp = this._vp;   // prepare's product - LA-POST6: rebased by a recentre since, as the records it replays were
    const quad = (prog, target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(prog.p);
      gl.bindVertexArray(this.quadVao);
    };
    const depthOn = (prog) => {   // the depth block's four uniforms, the depth on unit 0
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, F.depth);
      gl.uniform1i(prog.uDepth, 0);
      gl.uniform4fv(prog.uProjInfo, this.projInfo);
      gl.uniform4fv(prog.uRect, this.rect);
      gl.uniform2fv(prog.uCanvas, this.canvas);
    };
    // 1. the ambient occlusion, then its box blur (exactly one tile of the ordered rotation)
    quad(this.programs.ao, T.ao);
    depthOn(this.programs.ao);
    gl.uniform4fv(this.programs.ao.uAOParams, this.aoParams);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    quad(this.programs.box, T.aoBlur);
    depthOn(this.programs.box);   // EL7: the blur reads the depth too - on unit 0; the AO on unit 1
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.ao.tex); gl.uniform1i(this.programs.box.uSrc, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(this.programs.box.uTexel, 1 / T.ao.w, 1 / T.ao.h);
    gl.uniform1f(this.programs.box.uBlurRange, AIR_AO_RADIUS);
    gl.uniform1f(this.programs.box.uStrength, this.aoParams[1]);   // AUDIT HQ1
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // 1b. VOL1: the lanterns' glow, marched through their shadows, then blurred (the jitter's tile)
    this._volumetrics(f, sp, quad, depthOn);
    // 2. the bloom source: the emitters (this frame's records, culled, occluded), and a glare per lantern
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.bloom.fbo);
    gl.viewport(0, 0, T.bloom.w, T.bloom.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);   // the emitters and the glares add; the target has no depth - both hide by the frame's depth themselves
    gl.blendFunc(gl.ONE, gl.ONE);
    if (sp && sp.count > 0) this._replayEmission(f, sp, vp, depthOn);
    this._glares(f, depthOn);
    gl.disable(gl.BLEND);
    // EL4: the bright pass joins them, and the blur runs, once the frame is whole
    // 3. the shafts, when the sun is up and in front of the camera; VC7b: and the sun in the haze, when a deck
    //    shades it - which needs the sun up, not on screen
    const up = f.sunScale > 0.01 && f.lightDir && f.lightDir[1] > 0;
    const sun = up ? sunScreenUV(f.proj, f.view, f.lightDir) : null;
    const deck = this.cloudShadow;
    const haze = this.hazeOn && up && deck?.rect && deck.rect[3] > 0 && f.lightDir[1] > 0.05 && f.haze > 0;
    if (sun || haze) {
      const S = this.programs.shaft;
      quad(S, haze ? T.shaftRaw : T.shaft);   // VC7b: the march's jitter wants the tile's average; the beams alone do not
      depthOn(S);
      gl.uniform1f(S.uSunOn, sun ? 1 : 0);
      if (sun) gl.uniform2f(S.uSun, sun[0], sun[1]);
      this.shaftParams[3] = T.shaft.w / T.shaft.h;
      gl.uniform4fv(S.uShaftParams, this.shaftParams);
      gl.uniform3fv(S.uSunColor, f.sunColor);
      // VC6c: the cloud shadow at the player's feet. No deck (the classic
      // skin, every interior, `?clouds=off`) means an amount of 0, which
      // is what makes cloudShadowAt answer full sun without a branch here.
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, deck?.map ?? f.blackTex ?? null);
      gl.uniform1i(S.uCloudShadowMap, 1);
      gl.uniform4fv(S.uCloudShadowRect, deck?.rect ?? this._noDeck);
      gl.uniform3fv(S.uEye, f.eye);
      // VC7b: the sky map (its alpha the slab's, the curtains' and the ice's transmittance by direction), the view's rotation, the sun, the haze
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, deck?.sky ?? f.blackTex ?? null);
      gl.uniform1i(S.uCloudSky, 2);
      gl.uniform1f(S.uCloudSkyOn, deck?.sky ? 1 : 0);
      const v = f.view, R = this._viewRot;   // the view's rotation transposed, as VOL1 hands it
      R[0] = v[0]; R[1] = v[4]; R[2] = v[8]; R[3] = v[1]; R[4] = v[5]; R[5] = v[9]; R[6] = v[2]; R[7] = v[6]; R[8] = v[10];
      gl.uniformMatrix3fv(S.uViewRot, false, R);
      gl.uniform3fv(S.uLightDir, f.lightDir ?? this._noDeck.subarray(0, 3));
      this._haze[0] = haze ? f.haze : 0;
      this._haze[3] = f.sunScale ?? 0;
      gl.uniform4fv(S.uHaze, this._haze);
      gl.activeTexture(gl.TEXTURE0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (haze) {   // VC7b: one 4x4 tile of the march's jitter, by depth (VOL1's blur) - the shafts' image the resolve adds
        const B = this.programs.volBlur;
        quad(B, T.shaft);
        depthOn(B);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.shaftRaw.tex); gl.uniform1i(B.uSrc, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform2f(B.uTexel, 1 / T.shaftRaw.w, 1 / T.shaftRaw.h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      this.stats.shafts = !!sun;
      this.stats.haze = !!haze;
    }
    // LA-POST8: with neither, the shafts' image is not cleared - nothing reads it: the resolve is built without its read
    // for such a frame (PERF-EXT31, stats.shafts and stats.haze both false), and a frame that draws them writes it whole
    gl.clearColor(f.clearColor[0], f.clearColor[1], f.clearColor[2], f.clearColor[3]);
  }

  /** AUDIT VOL1: the images a frame the pass was not prepared for gets - black, so the resolve adds nothing of a
   *  frame gone by (and composite() uploads the AO's mix as 0 for it). */
  _blank(quad) {
    const gl = this.gl, T = this.targets;
    this.stats.emitDraws = 0; this.stats.glares = 0; this.stats.shafts = false; this.stats.haze = false; this.stats.vol = false;   // nothing drawn for it
    gl.clearColor(0, 0, 0, 1);
    for (const t of [T.bloom, T.shaft, T.volOut]) { quad(this.programs.box, t); gl.clear(gl.COLOR_BUFFER_BIT); }
    if (this.f) gl.clearColor(this.f.clearColor[0], this.f.clearColor[1], this.f.clearColor[2], this.f.clearColor[3]);
  }

  /** VOL1: the glow image - the march for every lantern in the frame when the door is open and the fog gives the air a
   *  density, black otherwise (the resolve adds it either way). AUDIT VOL1: the march writes linear light into the float
   *  target, the tile's blur averages it, the tone pass curves the average into volOut - or, with no float target, the
   *  march tonemaps per pixel and the blur's image is volOut itself. */
  _volumetrics(f, sp, quad, depthOn) {
    const gl = this.gl, P = this.programs, T = this.targets;
    const L = f.pointLights, n = L ? L.length >> 2 : 0;
    const on = !!P.vol && this.volOn && n > 0 && f.scatter > 0 && !!sp;
    this.stats.vol = on;
    if (!on) { quad(P.box, T.volOut); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.clearColor(f.clearColor[0], f.clearColor[1], f.clearColor[2], f.clearColor[3]); return; }   // shut: the image the resolve reads, black
    quad(P.vol, T.vol);
    depthOn(P.vol);
    gl.uniform3fv(P.vol.uCamPos, f.eye);
    const v = f.view, R = this._viewRot;   // the view's rotation transposed: column j of the inverse is row j of the view
    R[0] = v[0]; R[1] = v[4]; R[2] = v[8]; R[3] = v[1]; R[4] = v[5]; R[5] = v[9]; R[6] = v[2]; R[7] = v[6]; R[8] = v[10];
    gl.uniformMatrix3fv(P.vol.uViewRot, false, R);
    gl.uniform4fv(P.vol.uPointLights, L);
    gl.uniform3fv(P.vol.uPointColors, f.pointColors ?? this._ones.subarray(0, n * 3));
    gl.uniform1i(P.vol.uPointCount, n);
    gl.uniform1f(P.vol.uScatter, f.scatter);
    gl.uniform1f(P.vol.uExposure, f.exposure ?? 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.adapt[this.adaptIndex].tex); gl.uniform1i(P.vol.uAdapt, 1);   // the eye, a frame old (as the world shaders read it)
    gl.activeTexture(gl.TEXTURE0);
    sp.upload(P.vol.shadow);   // the cube maps and the caster table, on their own units
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // the blur: the jitter spread the steps over the ordered tile; the tile's average, by depth, gathers it (into volB)
    quad(P.volBlur, T.volB);
    depthOn(P.volBlur);   // the depth on unit 0; the glow on unit 1
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.vol.tex); gl.uniform1i(P.volBlur.uSrc, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(P.volBlur.uTexel, 1 / T.vol.w, 1 / T.vol.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!P.volTone) return;   // no float target: volB is the tonemapped image the readers take
    // the tone pass: the blurred linear light through the lane's curve, once
    quad(P.volTone, T.volOut);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.volB.tex); gl.uniform1i(P.volTone.uSrc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.adapt[this.adaptIndex].tex); gl.uniform1i(P.volTone.uAdapt, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(P.volTone.uScatter, f.scatter);
    gl.uniform1f(P.volTone.uExposure, f.exposure ?? 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _replayEmission(f, sp, vp, depthOn) {
    const gl = this.gl, P = this.programs, T = this.targets;
    const planes = spherePlanes(vp, this._planes);   // EL5: the eye's frustum - what it cannot see cannot bloom
    let bound = null;
    for (let i = 0; i < sp.count; i++) {
      const r = sp.records[i];
      if (r.kind !== 2 && !recordVisible(planes, r)) continue;
      if (r.kind === 0) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        let vaoBound = false;
        for (let k = 0; k < mesh.subMeshes.length; k++) {
          const sm = mesh.subMeshes[k];
          const emis = sm._evEmis;
          if (!emis || emis === f.blackTex) continue;   // nothing to bloom: the main pass resolved no mask, or the black one
          if (!subMeshVisible(planes, r, k)) continue;   // EL5
          if (bound !== P.emitMesh) { bound = P.emitMesh; gl.useProgram(bound.p); gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView); gl.uniform1i(bound.uEmissionTex, 1); this._emitDepth(bound, depthOn, T); }
          if (!vaoBound) { gl.uniformMatrix4fv(P.emitMesh.uModel, false, r.matrix); f.bindVao(mesh.vao); vaoBound = true; }
          gl.uniform3fv(P.emitMesh.uEmissionColor, sm._evEmisWhite ? this._white : f.windowEmission);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, emis);
          gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
          this.stats.emitDraws++;
        }
      } else if (r.kind === 2) {
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b.conceal) continue;
          if (!batchVisible(planes, b)) continue;   // EL5
          const key = billboardKey(b);
          const emis = f.emissionTextures.get(key);
          const tex = f.textures.get(key);
          if (!emis || !tex) continue;
          if (bound !== P.emitBb) {
            bound = P.emitBb; gl.useProgram(bound.p);
            gl.uniformMatrix4fv(bound.uProj, false, vp); gl.uniformMatrix4fv(bound.uView, false, this._identityView);
            gl.uniform1i(bound.uTex, 0); gl.uniform1i(bound.uEmissionTex, 1);
            gl.uniform4fv(bound.uFlatWind, r.flatWind);
            this._emitDepth(bound, depthOn, T);
          }
          gl.uniform3fv(P.emitBb.uRight, r.right); gl.uniform3fv(P.emitBb.uUp, r.up);   // the camera basis the batch was drawn with
          const o = b.origin || ZERO_ORIGIN;   // AUDIT 68 S16-v-replay-origin-alloc
          gl.uniform3f(P.emitBb.uOrigin, o[0], o[1], o[2]);
          gl.uniform2f(P.emitBb.uSize, b.size.w, b.size.h);
          gl.uniform1f(P.emitBb.uSway, b.sway || 0);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, emis);
          f.bindVao(b.vao);
          gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
          this.stats.emitDraws++;
        }
      }
    }
    gl.activeTexture(gl.TEXTURE0);
  }
  /** EL8: the contact block's uniforms for one lane program - the previous
   *  frame's depth on its unit, its view-projection and terms, the params
   *  (off when no previous frame exists or the caller says so). */
  uploadContact(loc, on = true) {
    const gl = this.gl;
    const live = on && this.prevValid && this.frame;
    gl.activeTexture(gl.TEXTURE0 + AIR_CONTACT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.frame ? this.frame.prevDepth : null);   // AUDIT 68 S16-air-dead-fields: bound on or off - `live` only flags the march (both arms of the old ternary bound this)
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.prevDepth, AIR_CONTACT_UNIT);
    gl.uniformMatrix4fv(loc.prevVP, false, this.prevVP);
    gl.uniform4fv(loc.prevProjInfo, this.prevProjInfo);
    gl.uniform4fv(loc.prevRect, this.prevRect);   // DISC7
    this.contactParams[3] = live ? 1 : 0;
    gl.uniform4fv(loc.contactParams, this.contactParams);
  }

  /** EL6: the frame's depth for an emitter program - on unit 2 (0 and 1 are its own textures). */
  _emitDepth(prog, depthOn, T) {
    const gl = this.gl;
    depthOn(prog);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.frame.depth);
    gl.uniform1i(prog.uDepth, 2);
    gl.uniform2f(prog.uBloomSize, T.bloom.w, T.bloom.h);
    gl.activeTexture(gl.TEXTURE0);
  }

  _glares(f, depthOn) {
    const gl = this.gl, P = this.programs.glare, L = f.pointLights, C = f.pointColors;
    const n = L.length >> 2;
    if (n === 0) return;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.uProj, false, f.proj);
    gl.uniformMatrix4fv(P.uView, false, f.view);
    depthOn(P);   // EL5/EL6: the depth's reconstruction, off the frame's own
    gl.bindVertexArray(this.glareVao);
    const hold = this._glareHold, now = ++this._glareFrame;
    for (let i = 0; i < n; i++) {
      const range = L[i * 4 + 3];
      if (!(range > 0) || range > AIR_GLARE_MAX_RANGE) continue;   // AUDIT-EL F11: the lightning flash (range 500..1000 over the player) is no lantern
      if (f.carried && f.carried[i]) continue;   // MAC-T1: the light in the player's hand, BY NAME - DFU's PlayerTorch is a bare point light with no flare in any camera; the distance above lapses in third person (2.7 behind the hand) and the body billboard passed for a flame flat
      const x = L[i * 4], y = L[i * 4 + 1], z = L[i * 4 + 2];
      // LA-POST2: the size by the light's HELD range (heldGlareRange), found by its place - never the flicker's
      const key = glareKey(x, y, z);
      let h = hold.get(key);
      if (h) { h.range = heldGlareRange(h.range, range); h.seen = now; }
      else hold.set(key, h = { x, y, z, range, seen: now });
      gl.uniform3f(P.uCenter, x, y, z);
      gl.uniform1f(P.uSize, glareSize(h.range));
      gl.uniform3f(P.uColor, C ? C[i * 3] : 1, C ? C[i * 3 + 1] : 1, C ? C[i * 3 + 2] : 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      this.stats.glares++;
    }
    // LA-POST2: a place not lit for two seconds' worth of glare passes lets its held range go (a light that moves
    // leaves one behind a pass)
    if ((now & 63) === 0) for (const [k, v] of hold) if (now - v.seen > 120) hold.delete(k);
  }


  /** EL4: THE RESOLVE. Called by the frame's first screen-space draw; a
   *  no-op until a render is owed. Measures the frame (the luminance image,
   *  the adaptation step), finishes the bloom (the bright pass, the blur),
   *  then draws the frame to the canvas through resolveFs and releases the
   *  frame target. Leaves the canvas bound at the full canvas viewport. */
  composite() {
    if (!this.pending || !this.targets || !this.frame) return;
    this.pending = false;
    const gl = this.gl, P = this.programs, T = this.targets, F = this.frame;
    const now = this._now();
    const dt = this._lastResolve ? Math.min(Math.max((now - this._lastResolve) / 1000, 0), AIR_ADAPT_MAX_DT) : 0;
    this._lastResolve = now;
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadVao);
    const quad = (prog, target) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
      gl.useProgram(prog.p);
    };
    gl.activeTexture(gl.TEXTURE0);
    // 0. EL6: the images, off the frame's depth (the frame is whole now). AUDIT VOL1: for a frame the pass was PREPARED
    // for - a world frame - and not otherwise: a menu's or a video's frame binds the frame target too, and its resolve
    // used to paint the last world frame's glares, shafts and glow over it (the glow was the first to show); such a
    // frame gets black images and no measure
    // AUDIT 68 S16-air-stale-ao-unprepared: and the AO's mix with them - `this.f` outlives the world frame it was set
    // for, and an unprepared frame multiplied in the last world frame's crevices
    const prepared = !!this.f && this.fresh;
    if (prepared) this._images();
    else { this._blank(quad); this.measured = false; }
    this.fresh = false;
    // PERF-EXT31: the passes built for what the images hold, final now that _images or _blank has run - the glow marched
    // or cleared black, the shafts drawn (the beams or the haze) or cleared black (resolveFs says why). The luminance
    // image reads the glow either way: sixteen taps a texel of a 32x32 image is 16,384 a frame, nothing to save.
    const glow = this.stats.vol ? 1 : 0, shafts = this.stats.shafts || this.stats.haze ? 1 : 0;
    const PB = P.bright[glow], PR = P.resolve[glow][shafts];
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadVao);
    // AUDIT RETRO1 B4: and an unprepared frame is its WHOLE image - `this.rect` is the last world frame's, which under
    // retro mode is 320x200 of a 1280x720 menu frame, and the resolve's vignette reads it (LA-POST8: the bright pass
    // no longer runs for such a frame)
    if (!prepared) { this._fullRect[2] = F.w; this._fullRect[3] = F.h; }
    const rect = prepared ? this.rect : this._fullRect;
    // 1. the luminance image and its mean - AUDIT-EL F10: not off a frame the
    // world never drew (the passes saw no records): the eye would adapt to
    // the clear colour behind a video or a menu and swing back on return
    if (this.measured) {
    quad(P.lum, this.lum);
    gl.bindTexture(gl.TEXTURE_2D, F.tex);
    gl.uniform1i(P.lum.uFrame, 0);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.volOut.tex); gl.uniform1i(P.lum.uVol, 2); gl.activeTexture(gl.TEXTURE0);   // AUDIT VOL1: the eye adapts to the glow it will see
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.adapt[this.adaptIndex].tex); gl.uniform1i(P.lum.uPrev, 1);   // AUDIT-EL F16
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(P.lum.uRect, rect);
    gl.uniform2fv(P.lum.uCanvas, this.canvas);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindTexture(gl.TEXTURE_2D, this.lum.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    // 2. the adaptation step, into the other 1x1 image
    const prev = this.adapt[this.adaptIndex], next = this.adapt[1 - this.adaptIndex];
    quad(P.adapt, next);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prev.tex); gl.uniform1i(P.adapt.uPrev, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.lum.tex); gl.uniform1i(P.adapt.uLum, 1);
    gl.activeTexture(gl.TEXTURE0);
    this.adaptParams[0] = dt;
    gl.uniform4fv(P.adapt.uAdaptParams, this.adaptParams);
    gl.uniform2fv(P.adapt.uAdaptRates, this.adaptRates);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.adaptIndex = 1 - this.adaptIndex;
    }
    // 3. the bright pass joins the emitters and the glares, then the blur, twice. LA-POST8: on a world frame - a
    // menu's or a video's frame is resolved at its first screen quad, before anything is drawn over its clear, and
    // its bloom is the black _blank left (five passes of the frame's pixels for nothing)
    if (prepared) {
      quad(PB, T.bloom);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindTexture(gl.TEXTURE_2D, F.tex);
      gl.uniform1i(PB.uFrame, 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.volOut.tex); gl.uniform1i(PB.uVol, 2); gl.activeTexture(gl.TEXTURE0);   // AUDIT VOL1: a halo's core blooms
      gl.uniform4fv(PB.uRect, rect);
      gl.uniform2fv(PB.uCanvas, this.canvas);
      gl.uniform1f(PB.uThreshold, AIR_BRIGHT_THRESHOLD);
      gl.uniform2f(PB.uBloomSize, T.bloom.w, T.bloom.h);   // LA-AUDIT B3
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.BLEND);
      for (let pass = 0; pass < 2; pass++) {
        quad(P.gauss, T.bloomB);
        gl.bindTexture(gl.TEXTURE_2D, T.bloom.tex);
        gl.uniform1i(P.gauss.uSrc, 0);
        gl.uniform2f(P.gauss.uDir, 1 / T.bloom.w, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        quad(P.gauss, T.bloom);
        gl.bindTexture(gl.TEXTURE_2D, T.bloomB.tex);
        gl.uniform2f(P.gauss.uDir, 0, 1 / T.bloom.h);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    // 4. the frame to the canvas - RETRO1: or into the retro image, the frame's own size, which the renderer presents next
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resolveTo?.fbo ?? null);
    setFrameTarget(null);
    gl.viewport(0, 0, F.w, F.h);
    gl.useProgram(PR.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, F.tex); gl.uniform1i(PR.uFrame, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.bloom.tex); gl.uniform1i(PR.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.shaft.tex); gl.uniform1i(PR.uShaft, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.aoBlur.tex); gl.uniform1i(PR.uAO, 3);   // EL6
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, T.volOut.tex); gl.uniform1i(PR.uVol, 4);   // VOL1: the blurred, tonemapped glow
    gl.uniform1f(PR.uAOMix, prepared ? AIR_AO_RESOLVE : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4fv(PR.uRect, rect);
    gl.uniform2fv(PR.uCanvas, this.canvas);
    gl.uniform4fv(PR.uGrade, this.grade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }

  /** EL4: drop the frame target without resolving (the door closed, the lane left mid-frame). */
  release() {
    if (this.frame) setFrameTarget(null);
    this.pending = false;
    this.fresh = false;   // AUDIT 68 S16-air-stale-ao-unprepared: a prepare the resolve never took is no frame's when the door reopens
    this._cut = true;   // LA-POST6: and the frame the reopened door draws follows none - the depth it would march is from before the door shut
  }

  /** LA-POST3: a target read back as bytes, however it is stored - a probe's read (a half-float image refuses an
   *  UNSIGNED_BYTE readPixels and reads as FLOAT; its values are clamped and scaled as the byte image held them). */
  readTarget(name) {
    const gl = this.gl, T = this.targets?.[name];
    if (!T) return null;
    const n = T.w * T.h * 4, px = new Uint8Array(n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
    if (T.float) {
      const v = new Float32Array(n);
      gl.readPixels(0, 0, T.w, T.h, gl.RGBA, gl.FLOAT, v);
      for (let i = 0; i < n; i++) px[i] = Math.round(Math.min(Math.max(v[i], 0), 1) * 255);
    } else gl.readPixels(0, 0, T.w, T.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { w: T.w, h: T.h, px };
  }
}
