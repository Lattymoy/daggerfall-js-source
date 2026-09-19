// @ts-check
// EL2 (2026-09-17, the Enhanced Lighting arc, tier two - SHADOWS).
//
// WHAT THIS IS. The renderer has no scene graph: the hosts issue every
// world draw themselves, in their own order, from their own culled lists
// (world.js's pixel loop, dungeon.js's drawList). A shadow map needs the
// same geometry drawn again from the light, so the pass here RECORDS what
// the world pass draws - each mesh with a copy of its matrix, each terrain
// surface, each billboard batch list - into a pooled list, and at the
// start of the NEXT frame replays that list depth-only from the light,
// before the frame's own clear. The maps are then current with THIS
// frame's light and camera; only the caster list is a frame old, and a
// frame-old caster list is the same list to the eye. No host changes its
// draw order or draws anything twice.
//
// TWO MAPS, ONE PER KIND OF SCENE, chosen per frame off the lighting the
// host already set: outdoors (a sun with height) a two-cascade
// orthographic map centred on the eye - 40 units at 2048^2 for the street
// the player stands in, 240 for the town around it - indoors (no sun) a
// cube map from the nearest scene light, six faces of 512^2. The lane's
// fragment shaders (render/enhancedLighting.js) read them through
// SHADOW_GLSL: the sun's on the sun term, the cube's on the one lantern
// it belongs to (uShadowIndex), hardware-compared and PCF-softened, with a
// normal offset and a small constant bias against acne.
//
// KNOWN LIMITS, recorded: a caster the frame did not draw casts nothing -
// the hosts' frustum culling (EV3) means a tower behind the camera throws
// no shadow into the view; the character rigs (the Morrowind body, the
// peers, the first-person arm) cast none; the water surface receives none.
// Later tiers own those.
//
// The depth programs are the renderer's OWN vertex shaders (handed over
// at construction - this module imports nothing of the renderer, so a
// classic page never loads a shadow program) over two tiny fragment
// shaders: nothing at all for a solid, the 0.5 cutout for a flat.
//
// EL5 (2026-09-17, THE FIELD - the first report from the game): "the lights
// from inside the city are all bleeding through, tanking my framerate too"
// (a town gate at night). Two of this file's own laws were the cause.
//   - EVERY REPLAY DREW EVERY RECORD. Six faces of the cube map, two
//     cascades, the camera's depth image and the emitters' image each
//     walked the whole record list - ten draws of the town for one frame
//     of it. Every record now carries a world-space bounding sphere
//     (renderer.createMesh computes one per mesh AND per sub-mesh - a
//     static batch is a whole block in one mesh, so the batch's sphere is
//     the block's and its sub-meshes' are the walls' - the terrain and the
//     billboard batches theirs), and every replay culls against its own
//     frustum (frustumPlanes/sphereInPlanes): a cube face draws what is in
//     the lantern's range and in front of that face, the near cascade the
//     street, the camera's depth image what the eye sees.
//   - ONE LANTERN CAST. The other twenty lit the gate's inner walls through
//     the stone. Up to SHADOW_POINT_CASTERS lanterns cast now, the nearest
//     to the eye, each into six layers of ONE depth array
//     (sampler2DArrayShadow - the cube's face selection is done by hand in
//     pointShadowAt, so any number of casters costs one texture unit);
//     the culling above is what makes 24 face replays cheap.

import { lookAt, multiply, ortho, perspective } from '../world/mat4.js';
import { spherePlanes, transformSphere, recordVisible, subMeshVisible, batchVisible } from './bounds.js';   // EL5: the cull

/** The sun map: two cascades of this size, as a depth texture array. */
export const SHADOW_SUN_SIZE = 2048;
/** A caster's face size (six layers of the point depth array per caster). */
export const SHADOW_POINT_SIZE = 512;
/** EL5: how many lanterns cast at once - the nearest to the eye. */
export const SHADOW_POINT_CASTERS = 6;   // EL6: six - a gate passage has that many lanterns in reach
/** EL8: the caster-slot table's size - one int per light slot the lane can
 *  hold (enhancedLighting.js EL_MAX_LIGHTS, pinned equal): a light's slot in
 *  one lookup, not a search over the casters per light per fragment. */
export const SHADOW_CASTER_TABLE = 48;
/** EL8: THE CADENCE. The far cascade (the town) is drawn every other frame;
 *  casters past the first two (the nearest lanterns) every third, staggered,
 *  unless the slot's light changed - then at once. A shadow a frame or two
 *  old is the same shadow to the eye; a map that does not match its light is
 *  not. */
export const SHADOW_FAR_CASCADE_EVERY = 2;
export const SHADOW_FAR_CASTER_EVERY = 3;
/**
 * PERF-FLICKER (2026-09-19, Mac: "Online mode needs further performance
 * improvements", 51 fps with script at 23.3 ms): THE FLICKER WAS
 * REBUILDING EVERY SHADOW CUBE, EVERY FRAME.
 *
 * EL8 spends the point casters carefully: the nearest SHADOW_NEAR_CASTERS
 * redraw their six faces every frame, the rest every
 * SHADOW_FAR_CASTER_EVERY - about twenty face replays a frame out of
 * thirty-six. A slot also redraws when its light CHANGED, which is right:
 * a new lantern in the slot needs its own map.
 *
 * But a lantern's range is ANIMATED. CityLightAnimator (world/worldClock.js)
 * wanders every light's range inside a one-unit band at fourteen steps a
 * second - the flicker - and that range is the `w` the shadow pass compares.
 * So `changed` was true for every caster on almost every frame, every slot
 * redrew all six faces, and EL8's whole schedule was dead: thirty-six face
 * replays a frame instead of twenty, each one a full replay of the casters
 * in that light's reach. The saving was designed, measured and then quietly
 * given back by an animation in another file.
 *
 * The shadow's far plane is ROUNDED UP to this quantum, and the rounded
 * value is what the matrices, the change test and `pointParams` all use -
 * so the map and the shader agree exactly, as they must (the fragment
 * stage reconstructs depth from `P.w`). Rounding UP means the cube's far
 * plane is never inside the lantern's reach, so no shadow is ever clipped
 * short; the only cost is depth spread over a slightly longer range, which
 * at 512 square and a 24-bit depth buffer is nothing. A quantum of 4
 * swallows the whole one-unit wobble of an 18-unit lantern.
 */
export const SHADOW_FAR_QUANTUM = 4;
/** PERF-FLICKER: the far plane a cube map is built for - the light's own
 *  range, rounded UP so a flicker cannot move it. */
export const shadowFarFor = (far) => Math.ceil(far / SHADOW_FAR_QUANTUM) * SHADOW_FAR_QUANTUM;
export const SHADOW_NEAR_CASTERS = 2;
/** The cascades' radii around the eye, world units (a terrain tile is 6.4,
 *  an RMB block 102.4): EL7 - the room the player stands in (a texel of
 *  1.2 cm at 2048: the hairline at an eave's contact is four times thinner
 *  than EL2's 40-unit cascade left it), the street, and the town. */
export const SHADOW_CASCADES = Object.freeze([12, 48, 240]);
/**
 * PERF-SUN (2026-09-19, Mac: "exterior shadows at a distance ... over 1000
 * calls and looking up in the sky restores frame rate"): HOW MANY OF THE
 * NEAREST CASCADES TAKE THE 3x3 KERNEL.
 *
 * `sunShadowAt` filtered 3x3 in EVERY cascade - nine samples per lit
 * fragment, over the whole visible ground, which outdoors is nearly the
 * whole screen. That is why looking up gives the frame back: it is not a
 * draw-call cost at all, it is a per-FRAGMENT one, and the sky has no
 * fragments to pay it.
 *
 * AND EACH OF THOSE NINE IS ALREADY A 2x2. The sun map is
 * COMPARE_REF_TO_TEXTURE with LINEAR filtering (see the sampler below), so
 * one `texture()` on it is a hardware bilinear PCF over four texels - the
 * 3x3 loop is an effective 4x4 filter, not a 3x3.
 *
 * That filter is worth it where the texel is coarse against the pixel.
 * Cascade 0 is 12 units over 2048, a texel of 1.2 cm - EL7's contact
 * hairline, and the whole reason the near cascade exists. The FAR cascade
 * is 240 units: a 23 cm texel, which at a hundred metres and a 60-degree
 * field is about two pixels across. One hardware tap there is already a
 * 2x2 over a two-pixel texel, and the eight extra samples buy a softening
 * nobody can see at that range - while covering most of an outdoor screen,
 * because cascade 2 is everything past 43 units.
 *
 * So: the nearest two cascades keep the kernel, the far one takes the one
 * tap.
 *
 * AUDIT F2: the test is `c >= SHADOW_PCF_CASCADES`, so EVERY cascade from
 * this index outward takes the cheap tap - not just the last. The comment
 * first written here claimed the opposite ("a cascade count this does not
 * cover keeps the kernel"), which is false, and a false claim about the
 * safe direction is exactly what this slice's own lesson was about. The
 * behaviour the code actually has is the right one: cascades are ordered
 * by radius, so a further one is always coarser than the one before it and
 * can only want the tap less. A fourth cascade would be cheap, and should be.
 */
export const SHADOW_PCF_CASCADES = 2;
/** The ortho box's half-depth along the light: enough to take a mountain
 *  pixel's height above or below the eye. */
export const SHADOW_SUN_DEPTH = 600;
/** Below this sun height the sun map is not drawn (a horizontal sun's
 *  shadows are a smear the map cannot hold) and no shadow is cast. */
export const SHADOW_MIN_SUN_Y = 0.05;
/** The cube map's near plane, and the distance under which a light is
 *  the eye's own (the Light effect's candle at the camera) and never the
 *  caster - its shadows would be hidden by their own occluders anyway. */
export const SHADOW_POINT_NEAR = 0.1;
export const SHADOW_CASTER_MIN_DISTANCE = 1.5;   // F3 (2026-09-17, Mac: "when you peak around corners, a large shadow moves around ... when the torch is equipped"): THE LIGHT IN THE HAND CASTS NOTHING - Handheld Torches puts the flame 0.34 left, 0.7 below and 0.25 ahead of the eye (0.8 away), and at 0.25 it was the NEAREST caster every frame: a 512^2 cube map from a light a hand's width from the wall, its edges a metre wide and swimming with the bob. DFU's PlayerTorch is a Unity light that casts no shadows at all. A unit and a half is the glare's own hand distance (AIR_GLARE_MIN_DISTANCE); the same law skips the contact march for such a light (enhancedLighting.js)
/** AUDIT-EL F11: a light with a range past this is the storm's flash (Dynamic
 *  Skies: 500..1000 over the player, for a fifth of a second), never the
 *  caster - six 512^2 replays of the whole town to a far plane of a
 *  thousand, for a frame, were a hitch and nothing else. */
export const SHADOW_CASTER_MAX_RANGE = 120;
/** F2 (2026-09-17, Mac: "objects on the ground can sometimes have standing
 *  shadows"): a flat is a standing card, and the sun drew a loot pile, a
 *  dropped bottle or a coin heap as a card standing on its point - a
 *  standing shadow off a thing lying on the ground. The treasure archive
 *  (216, every loot pile) casts nothing, a batch a host marks `noShadow`
 *  (dropped items, droppedLoot.js) casts nothing, and a flat shorter than
 *  SHADOW_FLAT_MIN_HEIGHT (a key, a potion, a heap) casts nothing - its
 *  shadow was a sliver anyway and a wrong one. */
export const SHADOW_NO_CAST_ARCHIVES = Object.freeze(new Set([216]));
export const SHADOW_FLAT_MIN_HEIGHT = 0.5;
/** F5: a caster smaller than this many of a cascade's texels is not
 *  replayed into it - the far cascade's texel is 23 cm, and a rock or a
 *  weed half a metre across shadows two texels of it for a replay each. */
export const SHADOW_CASCADE_MIN_RADIUS_TEXELS = 2;
/** AUDIT-EL F15: the biases, in the space they mean - the sun's in the
 *  ortho box's [0,1] depth (600 units of half-depth: 5e-5 is 0.06 units),
 *  the lantern's in WORLD units off the major axis (the cube's depth is
 *  hyperbolic; a constant in it is a bias that grows with distance). */
export const SHADOW_SUN_BIAS = 0.00005;
export const SHADOW_POINT_BIAS = 0.04;
/** The reserved texture units (CLOUD_SHADOW_UNIT is 15). */
export const SHADOW_SUN_UNIT = 13;
export const SHADOW_POINT_UNIT = 14;
/** EL6: Daggerfall's lights archive (world/cityLights.js LIGHTS_ARCHIVE) - the
 *  torch, campfire, candle and lantern flats. THEY ARE THE LANTERNS: a flame
 *  flat drawn from its own light's position is the nearest occluder in every
 *  direction and shadowed a wedge of the room ("some shadows, like the
 *  campfire, are wonky"). A flame casts from the sun, never from a lantern. */
export const SHADOW_LIGHT_FLATS = 210;
/** The record pool's ceiling - a city frame draws ~1000 meshes. Past it a
 *  frame's casters are truncated, never reallocated. */
export const SHADOW_RECORD_MAX = 6000;

const Y_UP = [0, 1, 0];
const Z_UP = [0, 0, 1];

/** The two cascades' view-projections for a sun at `lightDir` (the
 *  direction TOWARD the light) around `eye`, texel-snapped so the shadow
 *  edge does not shimmer as the camera walks. `out` is two Float32Array(16). */
export function sunCascadeMatrices(eye, lightDir, out) {
  const up = Math.abs(lightDir[1]) > 0.99 ? Z_UP : Y_UP;
  for (let c = 0; c < SHADOW_CASCADES.length; c++) {
    const r = SHADOW_CASCADES[c];
    const le = [eye[0] + lightDir[0] * SHADOW_SUN_DEPTH, eye[1] + lightDir[1] * SHADOW_SUN_DEPTH, eye[2] + lightDir[2] * SHADOW_SUN_DEPTH];
    const view = lookAt(le, eye, up);
    const proj = ortho(r, r, 0, 2 * SHADOW_SUN_DEPTH);
    const vp = multiply(proj, view, out[c]);
    // the snap: the world origin's map texel is rounded, and the box is
    // moved by the remainder, so every world point lands on the same
    // texel whatever the eye did between frames
    const half = SHADOW_SUN_SIZE / 2;
    const ox = vp[12] * half, oy = vp[13] * half;
    vp[12] += (Math.round(ox) - ox) / half;
    vp[13] += (Math.round(oy) - oy) / half;
  }
  return out;
}

/** The world-space size of one texel of cascade `c`. */
export function sunTexelWorld(c) {
  return 2 * SHADOW_CASCADES[c] / SHADOW_SUN_SIZE;
}

// The cube's six faces in GL's own order (+X -X +Y -Y +Z -Z) with the
// up vectors the cube convention wants, so a lookup by direction lands
// on the face that was drawn looking that way.
const CUBE_FACES = Object.freeze([
  [[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]],
  [[0, 1, 0], [0, 0, 1]], [[0, -1, 0], [0, 0, -1]],
  [[0, 0, 1], [0, -1, 0]], [[0, 0, -1], [0, -1, 0]],
]);

/** The six face view-projections of a point light at `pos` reaching `far`.
 *  `out` is six Float32Array(16). */
export function pointFaceMatrices(pos, far, out) {
  const proj = perspective(Math.PI / 2, 1, SHADOW_POINT_NEAR, far);
  for (let f = 0; f < 6; f++) {
    const [d, up] = CUBE_FACES[f];
    const view = lookAt(pos, [pos[0] + d[0], pos[1] + d[1], pos[2] + d[2]], up);
    multiply(proj, view, out[f]);
  }
  return out;
}

/** The depth the cube map holds for a point at `(dx, dy, dz)` from the
 *  light: the major axis is the face's view depth, and this is that depth
 *  through the face's projection, in [0, 1] - the JS of the shader's
 *  cubeDepthRef, term for term. */
export function cubeDepthRef(dx, dy, dz, far, near = SHADOW_POINT_NEAR) {
  return cubeDepthOfM(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)), far, near);
}
/** The same, off the major-axis distance itself (the shader's cubeDepthOfM). */
export function cubeDepthOfM(m, far, near = SHADOW_POINT_NEAR) {
  m = Math.max(m, near);
  const ndc = (far + near) / (far - near) - (2 * far * near) / ((far - near) * m);
  return ndc * 0.5 + 0.5;
}

/** EL5: a face's view basis - the x and y axes lookAt builds for CUBE_FACES[f]
 *  (z is -dir). The shader's face selection projects a light-relative
 *  vector d onto these: uv = (x.d, y.d) / major-axis * 0.5 + 0.5. */
export function faceBasis(f) {
  const [d, up] = CUBE_FACES[f];
  const z = [-d[0], -d[1], -d[2]];
  const x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return { x, y };
}

/** The lantern the cube map belongs to: the nearest to the eye of the
 *  frame's point lights (vec4s: xyz, range) that is at least `minDist`
 *  away and has a range; -1 for none. */
export function pickShadowCaster(lights, eye, minDist = SHADOW_CASTER_MIN_DISTANCE, carried = null) {
  return pickShadowCasters(lights, eye, 1, minDist, carried)[0] ?? -1;
}

/** EL5: up to `max` casters - the lights nearest the eye that are a
 *  lantern (F11's range cap) and not the eye's own candle, nearest first. */
export function pickShadowCasters(lights, eye, max = SHADOW_POINT_CASTERS, minDist = SHADOW_CASTER_MIN_DISTANCE, carried = null) {
  const n = lights.length >> 2;
  const picked = [];   // [index, distance], kept sorted, at most `max`
  for (let i = 0; i < n; i++) {
    if (carried && carried[i]) continue;   // MAC-T1: the light in the player's hand takes no caster slot in ANY camera (F3's law by name; the distance below lapses in third person)
    const dx = lights[i * 4] - eye[0], dy = lights[i * 4 + 1] - eye[1], dz = lights[i * 4 + 2] - eye[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < minDist || !(lights[i * 4 + 3] > 0) || lights[i * 4 + 3] > SHADOW_CASTER_MAX_RANGE) continue;   // AUDIT-EL F11
    if (picked.length === max && d >= picked[max - 1][1]) continue;
    let at = picked.length;
    while (at > 0 && picked[at - 1][1] > d) at--;
    picked.splice(at, 0, [i, d]);
    if (picked.length > max) picked.pop();
  }
  return picked.map((p) => p[0]);
}

/** The frame's shadow kind off the lighting the host set: the sun map
 *  when there is a sun with height, else the cube map. */
export function shadowKind(sunScale, lightDir) {
  return sunScale > 0.01 && lightDir && lightDir[1] > SHADOW_MIN_SUN_Y ? 'sun' : 'point';
}

/** THE RECEIVER BLOCK, interpolated into every lane shader that lights by
 *  the sun or a lantern. sunShadowAt: the sun term's visibility at a world
 *  point with normal n (1 = lit); pointShadowAt: the same for the one
 *  shadowed lantern. Both 1.0 while their map is off (params.w). */
/** EL5: the shader's face bases, generated from CUBE_FACES so the receiver
 *  and pointFaceMatrices can never disagree. */
function faceBasisGlsl() {
  const v = (a) => `vec3(${a.map((x) => x.toFixed(1)).join(', ')})`;
  const xs = [], ys = [];
  for (let f = 0; f < 6; f++) { const b = faceBasis(f); xs.push(v(b.x)); ys.push(v(b.y)); }
  return `const vec3 FACE_X[6] = vec3[6](${xs.join(', ')});\nconst vec3 FACE_Y[6] = vec3[6](${ys.join(', ')});`;
}

export const SHADOW_GLSL = `
precision highp sampler2DArrayShadow;
uniform sampler2DArrayShadow uSunShadow;
uniform mat4 uSunVP[3];
uniform vec4 uSunShadowParams;    // x y z the three cascades' radii, w 1 = on (EL7: three)
uniform vec4 uSunTexel;           // x y z the cascades' texel size (world)
uniform sampler2DArrayShadow uPointShadow;   // EL5: six face layers per caster
uniform vec4 uPointShadowParams[${SHADOW_POINT_CASTERS}];  // xyz the light, w its far plane (0 = off)
uniform int uShadowIndex[${SHADOW_POINT_CASTERS}];         // the lantern each caster's layers belong to, -1 for none
uniform int uCasterOf[${SHADOW_CASTER_TABLE}];              // EL8: light i's caster slot, -1 for none - one lookup
${faceBasisGlsl()}
float sunShadowTap(vec3 wp, vec3 n, bool soft) {
  if (uSunShadowParams.w <= 0.0) return 1.0;
  float d = length(wp - uCamPos);
  int c = d < uSunShadowParams.x * 0.9 ? 0 : d < uSunShadowParams.y * 0.9 ? 1 : 2;
  float texel = c == 0 ? uSunTexel.x : c == 1 ? uSunTexel.y : uSunTexel.z;
  mat4 vp = c == 0 ? uSunVP[0] : c == 1 ? uSunVP[1] : uSunVP[2];
  vec4 lp = vp * vec4(wp + n * texel * 1.5, 1.0);
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float ref = p.z - ${SHADOW_SUN_BIAS};   // AUDIT-EL F15: ~0.06 world units over the 1200-unit box (0.0004 was half a unit - feet floated off their shadows)
  float texelUv = 1.0 / ${SHADOW_SUN_SIZE}.0;   // AUDIT-EL F17: not 'step' - a built-in's name
  // PERF-SUN: the far cascade takes ONE tap, which the sampler already
  // makes a hardware 2x2 (COMPARE_REF_TO_TEXTURE + LINEAR). Its texel is
  // 23 cm - about two pixels at a hundred metres - so the eight extra
  // samples soften nothing the eye can resolve, over most of an outdoor
  // screen. The near cascades keep the kernel: that is EL7's contact
  // hairline, at a texel of 1.2 cm.
  //
  // TREES1 (2026-09-19, Mac: "there's this weird darkening effect
  // happening to trees"): UNLESS THE CALLER IS A FLAT. The trade above
  // is an ANTIALIASING one, and it only holds for a surface that shades
  // PER FRAGMENT - the terrain and the meshes, where neighbouring pixels
  // smooth a coarse filter whatever this returns. A flat is not like
  // that. It reads ONE value at its base and wears it over the whole
  // sprite (EL2: a sprite sampled at its own fragment would shadow
  // itself), so the kernel is not softening an edge there - it is the
  // only gradation the tree has. With one tap a tree whose foot sits
  // near a shadow edge flips between fully lit and fully dark, and jumps
  // again at the cascade boundary as you walk toward it. Flats keep the
  // kernel at every distance, and they are a thin slice of the frame's
  // fragments beside the ground, so nearly all of the saving stands.
  if (!soft && c >= ${SHADOW_PCF_CASCADES}) return texture(uSunShadow, vec4(p.xy, float(c), ref));
  float lit = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      lit += texture(uSunShadow, vec4(p.xy + vec2(float(x), float(y)) * texelUv, float(c), ref));
    }
  }
  return lit / 9.0;
}
/** A surface that shades per fragment: the cheap tap past SHADOW_PCF_CASCADES. */
float sunShadowAt(vec3 wp, vec3 n) { return sunShadowTap(wp, n, false); }
/** A FLAT, which reads once for a whole sprite: the kernel at every distance (TREES1). */
float sunShadowSoftAt(vec3 wp, vec3 n) { return sunShadowTap(wp, n, true); }
// the face's depth of a point whose major-axis distance is m (cubeDepthRef in shadowPass.js)
float cubeDepthOfM(float m, float far) {
  float near = ${SHADOW_POINT_NEAR};
  m = max(m, near);
  float ndc = (far + near) / (far - near) - (2.0 * far * near) / ((far - near) * m);
  return ndc * 0.5 + 0.5;
}
// EL5: caster k's shadow at wp - the cube's face by the major axis, the face's
// uv by its basis (pointFaceMatrices' own lookAt axes), the layer k * 6 + face
float pointShadowAt(int k, vec3 wp, vec3 n) {
  vec4 P = uPointShadowParams[k];
  float far = P.w;
  if (far <= 0.0) return 1.0;
  vec3 d = (wp + n * 0.05) - P.xyz;
  vec3 a = abs(d);
  int face; float m;
  if (a.x >= a.y && a.x >= a.z) { face = d.x > 0.0 ? 0 : 1; m = a.x; }
  else if (a.y >= a.z) { face = d.y > 0.0 ? 2 : 3; m = a.y; }
  else { face = d.z > 0.0 ? 4 : 5; m = a.z; }
  vec2 uv = vec2(dot(FACE_X[face], d), dot(FACE_Y[face], d)) / max(m, 1e-4) * 0.5 + 0.5;
  float layer = float(k * 6 + face);
  // AUDIT-EL F15: THE BIAS IS IN WORLD UNITS - the depth is hyperbolic, and a
  // constant 0.002 off it was half a unit at five units and four at fifteen:
  // an occluder within four units of a wall cast nothing near a lantern's range
  float ref = cubeDepthOfM(m - ${SHADOW_POINT_BIAS}, far);
  float t = 1.5 / ${SHADOW_POINT_SIZE}.0;
  float lit = texture(uPointShadow, vec4(uv, layer, ref));
  lit += texture(uPointShadow, vec4(uv + vec2(t, 0.0), layer, ref)) + texture(uPointShadow, vec4(uv - vec2(t, 0.0), layer, ref))
       + texture(uPointShadow, vec4(uv + vec2(0.0, t), layer, ref)) + texture(uPointShadow, vec4(uv - vec2(0.0, t), layer, ref));
  return lit / 5.0;
}
// EL5: light i's shadow - its caster's, if it has one this frame (EL8: by the table, one lookup)
float shadowOfLight(int i, vec3 wp, vec3 n) {
  int k = uCasterOf[i];
  return k >= 0 ? pointShadowAt(k, wp, n) : 1.0;
}
`;

/** The depth-only fragment shaders: a solid writes depth and nothing else;
 *  a flat keeps the classic 0.5 cutout so a tree's shadow is its silhouette. */
export const DEPTH_FS = `#version 300 es
precision highp float;
void main() {}`;
export const DEPTH_BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
void main() {
  if (texture(uTex, vUV).a < 0.5) discard;
}`;

const REC_MESH = 0, REC_TERRAIN = 1, REC_BB = 2, REC_CHAR = 3;   // EL7: the character rigs cast

/**
 * The pass: the maps, the depth programs, the record pool, the replay.
 * `opts.build(vs, fs)` compiles a program (the renderer's _buildProgram);
 * `opts.vs` is { mesh, bb, terrain } - the renderer's own vertex shaders.
 */
export class ShadowPass {
  constructor(gl, opts) {
    this.gl = gl;
    const u = (p, n) => gl.getUniformLocation(p, n);
    const mesh = opts.build(opts.vs.mesh, DEPTH_FS);
    const terrain = opts.build(opts.vs.terrain, DEPTH_FS);
    const bb = opts.build(opts.vs.bb, DEPTH_BB_FS);
    const char = opts.vs.char ? opts.build(opts.vs.char, DEPTH_FS) : null;   // EL7: the rigs' own vertex layout
    this.programs = {
      mesh: { p: mesh, proj: u(mesh, 'uProj'), view: u(mesh, 'uView'), model: u(mesh, 'uModel') },
      char: char ? { p: char, proj: u(char, 'uProj'), view: u(char, 'uView'), model: u(char, 'uModel') } : null,
      terrain: { p: terrain, proj: u(terrain, 'uProj'), view: u(terrain, 'uView'), model: u(terrain, 'uModel') },
      bb: {
        p: bb, proj: u(bb, 'uProj'), view: u(bb, 'uView'), right: u(bb, 'uRight'), up: u(bb, 'uUp'), origin: u(bb, 'uOrigin'),
        size: u(bb, 'uSize'), tex: u(bb, 'uTex'), flatWind: u(bb, 'uFlatWind'), sway: u(bb, 'uSway'),
      },
    };
    // the sun map: a depth array of two layers, one framebuffer per layer
    const sun = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, sun);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, SHADOW_SUN_SIZE, SHADOW_SUN_SIZE, SHADOW_CASCADES.length);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.sunTex = sun;
    this.sunFbos = [];
    for (let c = 0; c < SHADOW_CASCADES.length; c++) {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, sun, 0, c);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.sunFbos.push(fbo);
    }
    // the cube map: six depth faces, one framebuffer per face
    // EL5: the point maps - six layers per caster in ONE depth array
    const point = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, point);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE, 6 * SHADOW_POINT_CASTERS);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.pointTex = point;
    this.pointFbos = [];
    for (let l = 0; l < 6 * SHADOW_POINT_CASTERS; l++) {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, point, 0, l);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      this.pointFbos.push(fbo);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    // the pool: records are minted once and reused by index
    /** @type {Array<{kind:number, mesh:any, matrix:Float32Array, texRemap:any, surface:any, arrayTex:any, tilemapTex:any, tileSize:number, batches:any, flatWind:Float32Array, right:Float32Array, up:Float32Array, bounded:boolean, sphere:Float32Array, subSpheres:Float32Array}>} */
    this.records = [];
    this.count = 0;
    this.recording = true;
    this.sunVP = SHADOW_CASCADES.map(() => new Float32Array(16));
    this.faceVP = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(16));
    this.sunParams = new Float32Array(4);
    this.sunTexel = new Float32Array(4);   // EL7
    this.pointParams = new Float32Array(4 * SHADOW_POINT_CASTERS);   // EL5: one vec4 per caster
    this.shadowIndex = new Int32Array(SHADOW_POINT_CASTERS).fill(-1);
    this.casterOf = new Int32Array(SHADOW_CASTER_TABLE).fill(-1);   // EL8
    this.casters = 0;
    this.frameNo = 0;   // EL8: the cadence's clock
    this._slotLight = new Float32Array(4 * SHADOW_POINT_CASTERS).fill(NaN);   // EL8: the light each slot's layers were last drawn from
    this._sunVPNew = SHADOW_CASCADES.map(() => new Float32Array(16));
    this._sunDrawn = new Uint8Array(SHADOW_CASCADES.length);
    this.kind = null;
    /** per-frame counts, for a probe */
    this.stats = { records: 0, sunDraws: 0, pointDraws: 0, culled: 0, cascadesDrawn: 0, facesDrawn: 0 };
    this._planes = new Float32Array(24);   // EL5: the replay's frustum
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._right = new Float32Array(3); this._up = new Float32Array([0, 1, 0]);
    this._zeroWind = new Float32Array(4);
    this._sunVPFlat = new Float32Array(16 * SHADOW_CASCADES.length);
  }

  _rec() {
    if (this.count >= SHADOW_RECORD_MAX) return null;
    let r = this.records[this.count];
    if (!r) {
      r = { kind: 0, mesh: null, matrix: new Float32Array(16), texRemap: null, surface: null, arrayTex: null, tilemapTex: null, tileSize: 0, batches: null, flatWind: new Float32Array(4), right: new Float32Array(3), up: new Float32Array(3),
        bounded: false, sphere: new Float32Array(4), subSpheres: new Float32Array(0) };   // EL5: the world-space spheres, the record's and its sub-meshes'
      this.records[this.count] = r;
    }
    this.count++;
    return r;
  }
  recordMesh(mesh, matrix, texRemap) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_MESH; r.mesh = mesh; r.matrix.set(matrix); r.texRemap = texRemap;
    // EL5: the spheres, in the world, once per record (a mesh without bounds is drawn by every replay)
    r.bounded = !!mesh.bounds;
    if (r.bounded) {
      transformSphere(matrix, mesh.bounds, r.sphere);
      const subs = mesh.subMeshes;
      if (r.subSpheres.length < subs.length * 4) r.subSpheres = new Float32Array(subs.length * 4);
      for (let i = 0; i < subs.length; i++) {
        const b = subs[i]._bounds;
        if (b) transformSphere(matrix, b, r.subSpheres, i * 4); else r.subSpheres[i * 4 + 3] = -1;   // -1: unbounded, always drawn
      }
    }
  }
  recordTerrain(surface, matrix, arrayTex, tilemapTex, tileSize) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_TERRAIN; r.surface = surface; r.matrix.set(matrix); r.arrayTex = arrayTex; r.tilemapTex = tilemapTex; r.tileSize = tileSize;
    r.bounded = !!surface.bounds;
    if (r.bounded) transformSphere(matrix, surface.bounds, r.sphere);
  }
  /** EL7: a character rig (createCharacterMesh's bundle: vao, count, ranges) casts too. */
  recordCharacter(mesh, matrix) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_CHAR; r.mesh = mesh; r.matrix.set(matrix);
    r.bounded = !!mesh.bounds;
    if (r.bounded) transformSphere(matrix, mesh.bounds, r.sphere);
  }
  recordBillboards(batches, flatWind, camRight, camUp) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_BB; r.batches = batches; r.flatWind.set(flatWind ?? this._zeroWind);
    r.right.set(camRight); r.up.set(camUp);   // EL3: the basis the batch was drawn with, for the emission replay
    r.bounded = false;   // a batch list is culled batch by batch (each has its own bounds about its origin)
  }
  discard() {
    for (let i = 0; i < this.count; i++) { const r = this.records[i]; r.mesh = null; r.surface = null; r.batches = null; r.texRemap = null; }
    this.count = 0;
  }


  render(f) {
    const gl = this.gl;
    this.stats.records = this.count; this.stats.sunDraws = 0; this.stats.pointDraws = 0; this.stats.culled = 0;
    this.kind = shadowKind(f.sunScale, f.lightDir);
    this.frameNo++;
    this.stats.cascadesDrawn = 0; this.stats.facesDrawn = 0;
    this.sunParams[3] = 0; this.pointParams.fill(0); this.shadowIndex.fill(-1); this.casterOf.fill(-1); this.casters = 0;
    if (this.count === 0) { this.kind = null; this._slotLight.fill(NaN); return; }
    gl.disable(gl.CULL_FACE);   // the light's projection is not the mirrored one: winding is not the world's, and both faces of an open model must cast
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    if (this.kind === 'sun') {
      sunCascadeMatrices(f.eye, f.lightDir, this._sunVPNew);
      const ld = f.lightDir;
      const rl = Math.hypot(ld[2], ld[0]) || 1;
      this._right[0] = ld[2] / rl; this._right[1] = 0; this._right[2] = -ld[0] / rl;
      const last = SHADOW_CASCADES.length - 1;
      for (let c = 0; c < SHADOW_CASCADES.length; c++) {
        // EL8: the far cascade every other frame (its map keeps its matrix until it is drawn again); a cascade never drawn is drawn now
        if (c === last && this._sunDrawn[c] && this.frameNo % SHADOW_FAR_CASCADE_EVERY !== 0) continue;
        this.sunVP[c].set(this._sunVPNew[c]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sunFbos[c]);
        gl.viewport(0, 0, SHADOW_SUN_SIZE, SHADOW_SUN_SIZE);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.stats.sunDraws += this.replay(f, this.sunVP[c], null, false, SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(c));   // F5: the small casters skipped by the cascade's texel
        this._sunDrawn[c] = 1; this.stats.cascadesDrawn++;
      }
      for (let c = 0; c < SHADOW_CASCADES.length; c++) { this.sunParams[c] = SHADOW_CASCADES[c]; this.sunTexel[c] = sunTexelWorld(c); this._sunVPFlat.set(this.sunVP[c], c * 16); }
      this.sunParams[3] = 1;
    }
    // EL5: THE LANTERNS CAST TOO, sun or no sun - the nearest SHADOW_POINT_CASTERS
    // of them, each into its six layers; the replays are culled to the
    // lantern's range and the face's frustum, so a caster costs what it lights
    const casters = pickShadowCasters(f.pointLights, f.eye, SHADOW_POINT_CASTERS, SHADOW_CASTER_MIN_DISTANCE, f.carried);   // MAC-T1
    const L = f.pointLights;
    // MAC-T1: the hand's light is -2 in the caster table - no slot, and no contact march either (enhancedLighting reads
    // the same table): F3's "never for the light in the hand", said by name rather than by distance from the camera
    if (f.carried) for (let i = 0, m = Math.min(L.length >> 2, SHADOW_CASTER_TABLE); i < m; i++) if (f.carried[i]) this.casterOf[i] = -2;
    for (let k = 0; k < casters.length; k++) {
      const i = casters[k];
      const pos = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]];
      // PERF-FLICKER: the SHADOW's far, not the lantern's live one - the
      // flicker must not count as "this light changed" and rebuild six
      // faces. Everything below takes this value (the face matrices, the
      // change test and pointParams), so the map and the shader agree.
      const far = shadowFarFor(L[i * 4 + 3]);
      // EL8: the slot's layers are drawn again when its light changed (position or range), every frame for the nearest slots, every third otherwise
      const sl = this._slotLight, o = k * 4;
      const changed = !(sl[o] === pos[0] && sl[o + 1] === pos[1] && sl[o + 2] === pos[2] && sl[o + 3] === far);
      const due = k < SHADOW_NEAR_CASTERS || (this.frameNo + k) % SHADOW_FAR_CASTER_EVERY === 0;
      if (changed || due) {
        pointFaceMatrices(pos, far, this.faceVP);
        for (let face = 0; face < 6; face++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFbos[k * 6 + face]);
          gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          this.stats.pointDraws += this.replay(f, this.faceVP[face], pos);
        }
        sl[o] = pos[0]; sl[o + 1] = pos[1]; sl[o + 2] = pos[2]; sl[o + 3] = far;
        this.stats.facesDrawn += 6;
      }
      this.pointParams[k * 4] = pos[0]; this.pointParams[k * 4 + 1] = pos[1]; this.pointParams[k * 4 + 2] = pos[2]; this.pointParams[k * 4 + 3] = far;
      this.shadowIndex[k] = i;
      if (i < SHADOW_CASTER_TABLE) this.casterOf[i] = k;
    }
    for (let k = casters.length; k < SHADOW_POINT_CASTERS; k++) this._slotLight[k * 4] = NaN;   // an emptied slot is drawn afresh when it is filled
    this.casters = casters.length;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.CULL_FACE);
  }

  replay(f, vp, lightPos, recordBasis = false, minRadius = 0) {
    const gl = this.gl;
    const P = this.programs;
    const planes = spherePlanes(vp, this._planes);   // EL5: this replay's frustum - a record outside it is not drawn
    let draws = 0;
    let bound = null;
    const use = (prog) => { if (bound !== prog) { gl.useProgram(prog.p); gl.uniformMatrix4fv(prog.proj, false, vp); gl.uniformMatrix4fv(prog.view, false, this._identityView); bound = prog; } };
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind !== REC_BB && !recordVisible(planes, r)) { this.stats.culled++; continue; }
      if (minRadius > 0 && r.kind !== REC_BB && r.kind !== REC_CHAR && r.bounded && r.sphere && r.sphere[3] < minRadius) { this.stats.culled++; continue; }   // F5: a small solid or terrain piece; a rig is a person
      if (r.kind === REC_MESH) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        let vaoBound = false;
        const subs = mesh.subMeshes;
        for (let k = 0; k < subs.length; k++) {
          if (!subMeshVisible(planes, r, k)) { this.stats.culled++; continue; }
          if (!vaoBound) { use(P.mesh); gl.uniformMatrix4fv(P.mesh.model, false, r.matrix); f.bindVao(mesh.vao); vaoBound = true; }
          const sm = subs[k];
          gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
          draws++;
        }
      } else if (r.kind === REC_CHAR) {
        const mesh = r.mesh;
        if (!P.char || !mesh?.vao || mesh._dead) continue;
        use(P.char);
        gl.uniformMatrix4fv(P.char.model, false, r.matrix);
        f.bindVao(mesh.vao);
        if (mesh.ranges && mesh.ranges.length) {
          for (const rg of mesh.ranges) { if (rg.hidden) continue; gl.drawArrays(gl.TRIANGLES, rg.first, rg.count); draws++; }
        } else { gl.drawArrays(gl.TRIANGLES, 0, mesh.count); draws++; }
      } else if (r.kind === REC_TERRAIN) {
        const s = r.surface;
        if (!s?.vao || s._dead) continue;
        use(P.terrain);
        gl.uniformMatrix4fv(P.terrain.model, false, r.matrix);
        f.bindVao(s.vao);
        gl.drawElements(gl.TRIANGLES, s.indexCount, gl.UNSIGNED_INT, 0);
        draws++;
      } else {
        use(P.bb);
        gl.uniform1i(P.bb.tex, 0);
        gl.uniform4fv(P.bb.flatWind, r.flatWind);
        gl.activeTexture(gl.TEXTURE0);
        let lastSway = null;
        // PERF-BASIS (2026-09-19): THE BASIS IS UPLOADED ONCE, NOT ONCE A
        // FLAT. Both vectors went up twice per batch per replay, and only
        // ONE of the four cases varies: `up` is the constant [0,1,0] (or
        // the record's, fixed for the record), and `right` is the frame's
        // sun basis - set once in frame() before the cascade loop - unless
        // this is a LANTERN's replay, where each flat turns to face it
        // (below). So a sun cascade was paying two uniform uploads a flat
        // for two numbers that could not change, three cascades deep,
        // every frame. On a frame that is script-bound, a GL call that
        // cannot change anything is the purest kind of waste there is.
        const perBatchRight = !recordBasis && !!lightPos;
        gl.uniform3fv(P.bb.up, recordBasis ? r.up : this._up);
        if (!perBatchRight) gl.uniform3fv(P.bb.right, recordBasis ? r.right : this._right);
        // PERF-BASIS: and the texture bind skips its repeats, as the main
        // pass's has since PERF3 - a run of flats sharing a record bound
        // the same texture once apiece.
        let lastTex = null;
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b.conceal || f.isSpectral(b.archive)) continue;   // a concealed foe and a ghost cast nothing
          if (lightPos && b.archive === SHADOW_LIGHT_FLATS) continue;   // EL6: a flame is the lantern, not its occluder
          if (b.noShadow || SHADOW_NO_CAST_ARCHIVES.has(b.archive) || (b.size && b.size.h < SHADOW_FLAT_MIN_HEIGHT)) { this.stats.culled++; continue; }   // F2: a thing on the ground is no standing card
          if (!batchVisible(planes, b)) { this.stats.culled++; continue; }   // EL5
          if (minRadius > 0 && b.bounds && b.bounds[3] < minRadius) { this.stats.culled++; continue; }   // F5
          const key = b._bbKey ?? (b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`);
          const tex = f.textures.get(key);
          if (!tex) continue;
          const o = b.origin || [0, 0, 0];
          // AUDIT-EL F13: the CAMERA's depth image (the air pass) draws a flat
          // with the basis it was drawn with, off the record - the sun's basis
          // drew every tree edge-on, a sliver the AO and the glares saw through.
          // PERF-BASIS: which is why `recordBasis` still wins here; it is
          // just hoisted, because it cannot change between two flats.
          if (perBatchRight) {
            // face the lantern: right = up x (light - flat)
            const dx = lightPos[0] - o[0], dz = lightPos[2] - o[2];
            const l = Math.hypot(dx, dz) || 1;
            this._right[0] = dz / l; this._right[1] = 0; this._right[2] = -dx / l;
            gl.uniform3fv(P.bb.right, this._right);
          }
          gl.uniform3f(P.bb.origin, o[0], o[1], o[2]);
          gl.uniform2f(P.bb.size, b.size.w, b.size.h);
          const sw = b.sway || 0;
          if (sw !== lastSway) { gl.uniform1f(P.bb.sway, sw); lastSway = sw; }
          if (tex !== lastTex) { gl.bindTexture(gl.TEXTURE_2D, tex); lastTex = tex; }   // PERF-BASIS
          f.bindVao(b.vao);
          gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
          draws++;
        }
      }
    }
    return draws;
  }

  /** Bind the maps on their reserved units and upload the receiver
   *  uniforms for one program (`loc` from the renderer's lookup: sunShadow,
   *  sunVP, sunParams, pointShadow, pointParams, shadowIndex). */
  upload(loc) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + SHADOW_SUN_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.sunTex);
    gl.activeTexture(gl.TEXTURE0 + SHADOW_POINT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.pointTex);   // EL5: the casters' layers
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.sunShadow, SHADOW_SUN_UNIT);
    gl.uniform1i(loc.pointShadow, SHADOW_POINT_UNIT);
    gl.uniformMatrix4fv(loc.sunVP, false, this._sunVPFlat);
    gl.uniform4fv(loc.sunParams, this.sunParams);
    gl.uniform4fv(loc.sunTexel, this.sunTexel);   // EL7
    gl.uniform4fv(loc.pointParams, this.pointParams);   // EL5: all the casters' vec4s at once
    gl.uniform1iv(loc.shadowIndex, this.shadowIndex);
    gl.uniform1iv(loc.casterOf, this.casterOf);   // EL8
  }

}
