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
import { spherePlanes, transformSphere, recordVisible, subMeshVisible, batchVisible, sphereInPlanes, batchSphere, ZERO_ORIGIN } from './bounds.js';   // EL5: the cull
import { billboardKey } from './billboardKey.js';   // AUDIT 68 S16-bbkey-stale-shadow-reach: re-keyed here, however the batch reached the records
import { aabbOutside } from './frustum.js';   // SHADOW-REACH: a host's box against the cascades

/** The sun map: two cascades of this size, as a depth texture array. */
export const SHADOW_SUN_SIZE = 2048;
/** A caster's face size (six layers of the point depth array per caster). */
export const SHADOW_POINT_SIZE = 512;
/** EL5: how many lanterns cast at once - the nearest to the eye. */
export const SHADOW_POINT_CASTERS = 8;   // EL6: six - a gate passage has that many lanterns in reach; HQ1: eight - SC1's cache made a still caster nearly free, so a tavern's every lamp throws its shadow
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
/** The cube map's near plane. */
export const SHADOW_POINT_NEAR = 0.1;
// LIGHT-NEAR1 (2026-09-23, kurkku on Discord, with video: "shadows disappear seemingly when you're too close to the
// light source" - a tavern lamp at head height, the shadows gone as the player walks under it): THERE IS NO
// CAMERA-DISTANCE RULE ANY MORE. F3 (2026-09-17) kept the light in the hand out of the caster slots by the proxy
// "within 1.5 of the eye" (SHADOW_CASTER_MIN_DISTANCE), and MAC-T1 replaced that proxy with the fact BY NAME - the
// torch and candle records say `carried`, every host composes them through withPlayerLights, and the pick, the
// contact march (-2 in the caster table) and the glare skip a carried light in any camera. The proxy stayed
// beside the flag, and it was never the hand's alone: a hanging lantern is 2.6-3.2 up and the eye is 1.7, so
// the moment the player stood within a unit of it the nearest, brightest light in the room lost its map AND its
// contact march (enhancedLighting.js read the same number) and its glare (airPass.js) in the same step. A scene
// light's distance to the eye is not a reason to drop its shadow; the hand's light is excluded by its flag.
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
/**
 * WEEDS1 (2026-09-19, Mac: "its better, what else can we do?"): HOW MANY
 * TEXELS OF A CASCADE A SPRITE MUST BE TALL TO CAST INTO IT.
 *
 * F5 already culls a caster too small to shadow a texel - but it measures
 * the BATCH'S SPHERE, and a billboard batch is every flat of one
 * (archive, record) across a whole streamed pixel. A pixel is 128 tiles at
 * 6.4 units: 819 across. So a batch of ankle-high weeds scattered over it
 * has a bounding sphere of several hundred units and sails through a test
 * meant to catch small things, while each sprite in it is thirty
 * centimetres. Every weed, flower, pebble and ground prop in the world
 * was replayed into the 240-unit cascade, where its shadow is one texel.
 *
 * The right measure for a flat is the SPRITE, which the batch carries as
 * `size`. This is MAC1's argument - "all the billboards in the distance
 * ESPECIALLY ALL THE SMALL ONES" - applied to the pass that never got it.
 *
 * FOUR TEXELS, and the number matters because it is what keeps this
 * confined to the far cascade. Against each cascade's texel:
 *
 *   cascade 0 (12 units, 1.2 cm texel)  -> 4.7 cm, under the flat floor
 *   cascade 1 (48 units, 4.7 cm texel)  -> 19 cm,  under the flat floor
 *   cascade 2 (240 units, 23 cm texel)  -> 94 cm
 *
 * so the near two are untouched by construction (the existing
 * SHADOW_FLAT_MIN_HEIGHT of 0.5 is higher than either) and the far one
 * stops carrying anything under about a metre. A metre-tall plant at a
 * hundred metres shadows two screen pixels; a tree, a person and a fence
 * post all clear it comfortably.
 *
 * The LANTERN replays pass no texel and are unaffected, which is right: a
 * cube face is 512 over a range of about eighteen units, so its texel is
 * three centimetres and a small prop beside a lantern casts a shadow you
 * can actually see.
 */
export const SHADOW_FLAT_MIN_TEXELS = 4;
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
// SC1 (2026-09-23, Mac: "make some insane improvements to our lighting system ... while also improving
// performance"; the second step): THE STATIC CASTERS ARE DRAWN ONCE. A lantern's cube map was replayed - six
// faces of everything in its range - every frame for the two nearest slots and every third for the rest, whether
// or not anything in that range had moved. In a tavern nothing has: the walls, the tables and the beams stand
// where they stood, and the only thing that ever changes a lantern's shadow is the light itself, a door on its
// swing, a rig walking through, a foe. So every record is CLASSIFIED as it is recorded - a mesh whose matrix is
// the one it was drawn with last frame is static, one that moved is dynamic, a rig is always dynamic, a flat is
// dynamic while its origin moves - and each caster slot keeps a CACHE of its static casters (six layers of a
// second depth array) that is drawn only when the light itself or the SET of static casters in its range changes
// (a signature over the records' identities and positions, folded once a frame). The live map is then the cache
// BLITTED (a depth blit, six faces, no rasterisation) with the dynamics drawn on top at EL8's own cadence - and
// nothing at all when no dynamic is near: a still room costs zero shadow draws a frame. Slots are STICKY - a
// light keeps the slot it had while it stays among the picked, matched by its position and not its index (the
// hosts re-sort their lights by distance every frame) - so a walk past a lamp does not throw its cache away.
// `?shadowcache=off` is the old path whole, for a comparison on a real GPU (tools/shadowCacheProbe.mjs).
/** SC1: how many recorded frames a caster stays DYNAMIC after it last moved. A door that swings and stops, a
 *  walker who pauses, a crate that is nudged: each would flip back to static the frame it stood still and
 *  redraw every cache in reach for its new place - and flip again on its next step. Held dynamic for this
 *  many frames it rides the cheap path (drawn alone on top) until it has been still for a second, and only
 *  then joins the cache once. */
export const SHADOW_DYNAMIC_HOLD = 60;
/** AUDIT SC1: how many placements of ONE mesh the pass remembers (a dungeon's doors share a model), and how far a
 *  draw may sit from a remembered placement and still be that placement's (a door swings a hand's breadth a frame). */
export const SHADOW_INSTANCE_MAX = 128;   // AUDIT REACH: and a placement not drawn for a hold is evicted for a new one (a mesh cache is never destroyed - the doors of every dungeon of a session would fill it)
export const SHADOW_INSTANCE_REACH = 2;
/** AUDIT REACH (the sway): a flora batch leaning less than this at its crown is still - half a cube texel at a lantern's
 *  typical reach - and a batch leaning more is a dynamic on ITS OWN cadence, SHADOW_SWAY_EVERY frames: the sway is slow,
 *  and every frame for every flora batch of a pixel handed SC1's whole saving back in a town with trees. */
export const SHADOW_SWAY_STILL = 0.02;
export const SHADOW_SWAY_EVERY = 4;
/** WIND3's lean at a flat's crown, world units: the shader's push at top = 1 and the gust's peak (renderer.js BB_VS). */
export const swayLean = (wl, sway, h) => wl * 1.3 * 0.0015 * sway * h;
/** AUDIT SC1: a remembered placement matches to this - a floating-origin rebase adds the offset in a different order
 *  than the host did, and the last bit of a float is no motion. */
export const SHADOW_STILL_EPS = 1e-3;
/**
 * DISC15 (2026-09-24, Mac: "Constant reports of interior light flickering ... Its not solved"): EVERY LIGHT IN A ROOM
 * CASTS.
 *
 * DISC6 held the eight caster maps against ties, and the flicker stayed, because the tie was never the cause. A
 * tavern has twenty lamps of range 15-18 over a building 25 x 18 - every lamp reaches nearly every surface, the
 * upstairs lamps included - and eight maps. The other twelve had NO map: a lamp without one lights through walls,
 * floors and ceilings at full strength, and the only shadow it had was EL8's contact march over last frame's depth.
 * So every walk across a room swapped real lamps in and out of the eight (DISC6's margin only moved WHERE the swap
 * happened), and each swap lit or unlit the ground floor through the ceiling: measured on the real TVRNGM03 on
 * SwiftShader, a caster change moved 30-98% of the screen by 12+ levels in one frame. The contact march made the
 * rest - a one-frame dark flash over 40% of the screen on the first frame the eye moved (a grazing wall marched
 * through a frame-old depth), gone with `?contact=off`.
 *
 * THE LO TIER: in a room its host draws WHOLE (renderer.everyLightCasts - a building's interior, where nothing is
 * view-culled, so every static caster is in the records), EVERY light the caster table can name keeps its own
 * cube map of the room's STATIC casters at SHADOW_LO_SIZE: six layers of a second depth array, sticky by position
 * like SC1's slots, drawn once when the light arrives and again only when its static set changes (SC1's signature,
 * SHADOW_LO_REBUILDS a frame - the old map stands meanwhile, the same light's). The eight nearest keep their 512
 * maps with the movers on top, as before; every other light reads its lo map, so a lamp is never unshadowed and a
 * change of the eight changes a shadow's resolution, never whether the ceiling is there. The contact march has no
 * light left to run for indoors. `uCasterOf[i]` carries the lo slot as SHADOW_POINT_CASTERS + j; the lo map's light
 * and far are the light's own (uPointLights[i], shadowFarFor of its range, the same float arithmetic in JS and GLSL).
 */
export const SHADOW_LO_SIZE = 256;
/** DISC15: the lo array's texture unit - below the grid's (9, 10); nothing else binds 8. */
export const SHADOW_LO_UNIT = 8;
/** DISC15: the lo array grows in this many slots (a shop's four lamps take eight, a tavern's twenty-one twenty-four). */
export const SHADOW_LO_STEP = 8;
/** DISC15: every light the caster table can name. */
export const SHADOW_LO_MAX = SHADOW_CASTER_TABLE;
/** DISC15: how many lo maps a frame redraws for a changed static set (a door that came to rest) - a new light's map
 *  is drawn at once, whatever this says. */
export const SHADOW_LO_REBUILDS = 2;
/** SC1: the door - `?shadowcache=off` replays every caster at the cadence, as before. */
export function shadowCacheOn(search = globalThis.location?.search ?? '') {
  return new URLSearchParams(search).get('shadowcache') !== 'off';
}
/** SC1: are two spheres touching - a record's against a lantern's reach. */
export function spheresTouch(ax, ay, az, ar, bx, by, bz, br) {
  const dx = ax - bx, dy = ay - by, dz = az - bz, r = ar + br;
  return dx * dx + dy * dy + dz * dz <= r * r;
}
/** SC1: a 32-bit fold for the static signature - order-independent (a sum and a rotate-xor), so the hosts' draw
 *  order, which the culling shuffles, cannot change it. */
export function foldSignature(h, v) {
  const x = (v | 0) * 0x9e3779b1 | 0;
  return (h + ((x << 13) | (x >>> 19))) | 0;
}
let _shId = 0;
/** SC1: a stable identity for a mesh, a surface or a batch, minted on first sight. */
const shId = (o) => (o._shId ??= ++_shId);

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
export function pickShadowCaster(lights, eye, carried = null) {
  return pickShadowCasters(lights, eye, 1, carried)[0] ?? -1;
}

/**
 * DISC6 (Discord, 2026-09-23: "in shops and taverns the point lights in ceilings make everything flash/flickering",
 * "the light flashes when I move around, similar thing inside mages' guild"): A CASTER KEEPS ITS MAP. Only the
 * SHADOW_POINT_CASTERS lamps nearest the eye get a shadow map, and a lamp without one lights THROUGH walls and floors
 * (only the short contact march is left to it). The pick was a bare nearest-N sort, so two lamps at nearly the same
 * distance - an interior has a dozen in reach (lanterns of range 15-20 through a whole tavern, the rooms upstairs
 * included) - swapped places on every step and every bob of the head: the one that lost its map flashed through the
 * ceiling for a frame and was gone. A lamp that cast LAST frame is measured at CASTER_KEEP_RATIO of its distance, so a
 * newcomer must be clearly nearer to take its place; the set changes when the player really moves, never on a tie.
 */
export const CASTER_KEEP_RATIO = 0.8;
/** Was the light at `lights[i]` a caster last frame? `held` is the flat [x, y, z, _] list the pass kept, by
 *  POSITION (the hosts re-sort their lights every frame, so an index is no name - SC1's own matching). */
function heldAt(held, heldN, lights, i) {
  for (let k = 0; k < heldN; k++) if (held[k * 4] === lights[i * 4] && held[k * 4 + 1] === lights[i * 4 + 1] && held[k * 4 + 2] === lights[i * 4 + 2]) return true;
  return false;
}
/** AUDIT DISC7 C6: where the caster at `rank` stands among the frame's casters by TRUE distance to the eye. The pick's
 *  order carries DISC6's keep margin (a held caster is measured at CASTER_KEEP_RATIO), which decides who HOLDS a map;
 *  which two maps are redrawn every frame is about who is nearest, and a held caster a little farther must not take
 *  that redraw from a nearer one. Ties go to the earlier rank. At most SHADOW_POINT_CASTERS squared compares. */
export function nearestRank(casters, lights, eye, rank) {
  const d2 = (i) => { const dx = lights[i * 4] - eye[0], dy = lights[i * 4 + 1] - eye[1], dz = lights[i * 4 + 2] - eye[2]; return dx * dx + dy * dy + dz * dz; };
  const mine = d2(casters[rank]);
  let n = 0;
  for (let r = 0; r < casters.length; r++) if (r !== rank) { const d = d2(casters[r]); if (d < mine || (d === mine && r < rank)) n++; }
  return n;
}
/** DISC6: remember this frame's casters for the next pick - their positions into `held`, the count returned. */
export function holdCasters(held, lights, casters) {
  for (let r = 0; r < casters.length; r++) { const i = casters[r]; held[r * 4] = lights[i * 4]; held[r * 4 + 1] = lights[i * 4 + 1]; held[r * 4 + 2] = lights[i * 4 + 2]; }
  return casters.length;
}

/** EL5: up to `max` casters - the lights nearest the eye that are a
 *  lantern (F11's range cap) and not carried in the player's hand (MAC-T1's
 *  mask; LIGHT-NEAR1: and nothing about their distance to the eye), nearest first
 *  (DISC6: last frame's casters at CASTER_KEEP_RATIO of their distance). */
export function pickShadowCasters(lights, eye, max = SHADOW_POINT_CASTERS, carried = null, held = null, heldN = 0) {
  const n = lights.length >> 2;
  const picked = [];   // [index, distance], kept sorted, at most `max`
  for (let i = 0; i < n; i++) {
    if (carried && carried[i]) continue;   // MAC-T1: the light in the player's hand takes no caster slot in ANY camera (F3's law by name)
    const dx = lights[i * 4] - eye[0], dy = lights[i * 4 + 1] - eye[1], dz = lights[i * 4 + 2] - eye[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) * (held && heldAt(held, heldN, lights, i) ? CASTER_KEEP_RATIO : 1);
    if (!(lights[i * 4 + 3] > 0) || lights[i * 4 + 3] > SHADOW_CASTER_MAX_RANGE) continue;   // AUDIT-EL F11; LIGHT-NEAR1: no lower bound on `d` - the lamp overhead casts
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
uniform int uCasterOf[${SHADOW_CASTER_TABLE}];              // EL8: light i's caster slot, -1 for none - one lookup (DISC15: SHADOW_POINT_CASTERS + j for lo slot j)
uniform sampler2DArrayShadow uPointShadowLo;                 // DISC15: the lo tier - six layers per slot, the room's static casters
${faceBasisGlsl()}
// EL5: the cube's face of direction d by its major axis (m, the distance along it), and d's uv on that face by the
// face's basis (pointFaceMatrices' own lookAt axes). AUDIT 68 S17-shadowpass-layer-dup: the four readers' one pick.
vec2 cubeFaceUv(vec3 d, out int face, out float m) {
  vec3 a = abs(d);
  if (a.x >= a.y && a.x >= a.z) { face = d.x > 0.0 ? 0 : 1; m = a.x; }
  else if (a.y >= a.z) { face = d.y > 0.0 ? 2 : 3; m = a.y; }
  else { face = d.z > 0.0 ? 4 : 5; m = a.z; }
  return vec2(dot(FACE_X[face], d), dot(FACE_Y[face], d)) / max(m, 1e-4) * 0.5 + 0.5;
}
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
  int face; float m;
  vec2 uv = cubeFaceUv(d, face, m);
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
// VOL1: caster k's shadow at a point IN THE AIR - one tap, no normal (a march has no surface to bias against, and
// the blur after it smooths what the kernel would); the face and its uv exactly as pointShadowAt finds them
float pointShadowOne(int k, vec3 wp) {
  vec4 P = uPointShadowParams[k];
  float far = P.w;
  if (far <= 0.0) return 1.0;
  vec3 d = wp - P.xyz;
  int face; float m;
  vec2 uv = cubeFaceUv(d, face, m);
  return texture(uPointShadow, vec4(uv, float(k * 6 + face), cubeDepthOfM(m - ${SHADOW_POINT_BIAS}, far)));
}
// DISC15: the far a lo map is drawn to - shadowFarFor, term for term (a division by four is exact in binary, so the
// JS and the GLSL round the same float to the same plane)
float loFarOf(float range) { return ceil(range / ${SHADOW_FAR_QUANTUM}.0) * ${SHADOW_FAR_QUANTUM}.0; }
// DISC15: light L's shadow from its lo map j - pointShadowAt's face and uv on the lo array, the normal offset and the
// bias held to a texel of it (a 256 face's texel is twice a 512's)
float pointShadowLoAt(int j, vec4 L, vec3 wp, vec3 n) {
  float far = loFarOf(L.w);
  vec3 d0 = wp - L.xyz;
  float texel = 2.0 * max(max(abs(d0.x), abs(d0.y)), abs(d0.z)) / ${SHADOW_LO_SIZE}.0;
  vec3 d = d0 + n * max(0.05, 1.5 * texel);
  int face; float m;
  vec2 uv = cubeFaceUv(d, face, m);
  float layer = float(j * 6 + face);
  float ref = cubeDepthOfM(m - max(${SHADOW_POINT_BIAS}, texel), far);
  float t = 1.5 / ${SHADOW_LO_SIZE}.0;
  float lit = texture(uPointShadowLo, vec4(uv, layer, ref));
  lit += texture(uPointShadowLo, vec4(uv + vec2(t, 0.0), layer, ref)) + texture(uPointShadowLo, vec4(uv - vec2(t, 0.0), layer, ref))
       + texture(uPointShadowLo, vec4(uv + vec2(0.0, t), layer, ref)) + texture(uPointShadowLo, vec4(uv - vec2(0.0, t), layer, ref));
  return lit / 5.0;
}
// DISC15: the same IN THE AIR - one tap, no normal (pointShadowOne's shape)
float pointShadowLoOne(int j, vec4 L, vec3 wp) {
  float far = loFarOf(L.w);
  vec3 d = wp - L.xyz;
  int face; float m;
  vec2 uv = cubeFaceUv(d, face, m);
  float texel = 2.0 * m / ${SHADOW_LO_SIZE}.0;
  return texture(uPointShadowLo, vec4(uv, float(j * 6 + face), cubeDepthOfM(m - max(${SHADOW_POINT_BIAS}, texel), far)));
}
// DISC15: caster k of the light at L (uCasterOf's word): a 512 slot below SHADOW_POINT_CASTERS, a lo slot past it
float casterShadowAt(int k, vec4 L, vec3 wp, vec3 n) {
  return k < ${SHADOW_POINT_CASTERS} ? pointShadowAt(k, wp, n) : pointShadowLoAt(k - ${SHADOW_POINT_CASTERS}, L, wp, n);
}
float casterShadowOne(int k, vec4 L, vec3 wp) {
  return k < ${SHADOW_POINT_CASTERS} ? pointShadowOne(k, wp) : pointShadowLoOne(k - ${SHADOW_POINT_CASTERS}, L, wp);
}
// EL5: light i's shadow - its caster's, if it has one this frame (EL8: by the table, one lookup; DISC15: either tier)
float shadowOfLight(int i, vec4 L, vec3 wp, vec3 n) {
  int k = uCasterOf[i];
  return k >= 0 ? casterShadowAt(k, L, wp, n) : 1.0;
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

/** AUDIT REACH: what _dynamicNear answers - nothing near, a swaying flat alone (the slow cadence), a mover. */
const DYN_NONE = 0, DYN_SWAY = 1, DYN_MOVER = 2;
const REC_MESH = 0, REC_TERRAIN = 1, REC_BB = 2, REC_CHAR = 3;   // EL7: the character rigs cast
const REPLAY_ALL = 0, REPLAY_STATIC = 1, REPLAY_DYNAMIC = 2;   // SC1: what a replay draws

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
    // the sun map: a depth array of one layer per cascade, one framebuffer per layer
    // (AUDIT 68 S17-shadowpass-layer-dup: the sun, the point and the lo tier are each a _depthArray, and all four arrays take _layerFbos)
    this.sunTex = this._depthArray(SHADOW_SUN_SIZE, SHADOW_CASCADES.length, gl.LINEAR);
    this.sunFbos = this._layerFbos(this.sunTex, SHADOW_CASCADES.length);
    // EL5: the point maps - six layers per caster in ONE depth array, one framebuffer per face
    this.pointTex = this._depthArray(SHADOW_POINT_SIZE, 6 * SHADOW_POINT_CASTERS, gl.LINEAR);
    this.pointFbos = this._layerFbos(this.pointTex, 6 * SHADOW_POINT_CASTERS);
    // SC1: THE STATIC CACHE - the same shape again, one set of six layers per slot, blitted into the live array;
    // AUDIT SC1: made on the first frame that wants it (_ensureCache), not here - fifty megabytes of depth that
    // `?shadowcache=off` never reads were allocated all the same
    this.cacheTex = null;
    this.cacheFbos = [];
    this.cacheOn = true;                                          // SC1: the door (renderer.setShadowCache)
    this._slotSig = new Int32Array(2 * SHADOW_POINT_CASTERS);     // SC1: per slot, the static signature's (hash, count) the cache was drawn from
    this._slotCached = new Uint8Array(SHADOW_POINT_CASTERS);      // SC1: the cache holds this slot's light's statics
    this._slotLiveDyn = new Uint8Array(SHADOW_POINT_CASTERS);     // SC1: the live layers carry dynamics over the cache
    // DISC15: THE LO TIER - allocated on the first room that asks (_ensureLo), grown by SHADOW_LO_STEP. Until then a
    // one-texel array stands on SHADOW_LO_UNIT: every lane program declares the sampler, and a shadow sampler must
    // always have a depth array with its compare mode under it (an empty unit is a sampler-type clash at draw)
    this.loTex = this._depthArray(1, 6, gl.LINEAR);
    this._loFbos = [];
    this._loCap = 0;
    this._loSlotLight = new Float32Array(0);   // per lo slot, the light (x, y, z, far) its map was drawn from
    this._loSlotSig = new Int32Array(0);       // ...and the static signature's (hash, count) it was drawn with
    this._loBuilt = new Uint8Array(0);
    this._loSlotOf = new Int32Array(SHADOW_CASTER_TABLE);
    this._loTaken = new Uint8Array(0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    // the pool: records are minted once and reused by index
    /** @type {Array<{kind:number, mesh:any, matrix:Float32Array, texRemap:any, surface:any, arrayTex:any, tilemapTex:any, tileSize:number, batches:any, flatWind:Float32Array, right:Float32Array, up:Float32Array, bounded:boolean, sphere:Float32Array, subSpheres:Float32Array, dynamic:boolean}>} */
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
    this.stats = { records: 0, sunDraws: 0, pointDraws: 0, culled: 0, cascadesDrawn: 0, facesDrawn: 0, staticFaces: 0, dynFaces: 0, blits: 0, cachedSlots: 0, loSlots: 0, loFaces: 0 };   // SC1: the faces split, the blits, the slots served from the cache; DISC15: the lo tier's slots and faces
    this._planes = new Float32Array(24);   // EL5: the replay's frustum
    this._bSphere = new Float64Array(4);   // AUDIT 68 S16-batch-sphere-dup: batchSphere's scratch for the SC1 scans
    this._slotOfScratch = new Int32Array(SHADOW_POINT_CASTERS);   // SC1: rank -> slot
    this._heldCasters = new Float64Array(4 * SHADOW_POINT_CASTERS);   // DISC6: last frame's casters, by position (Float64: an exact copy of whatever the host sent, so the match by position holds)
    this._heldCasterN = 0;
    this._slotTakenScratch = new Uint8Array(SHADOW_POINT_CASTERS);
    this._sig = { hash: 0, count: 0 };
    this._sunPlanes = SHADOW_CASCADES.map(() => new Float32Array(24));   // SHADOW-REACH: the cascades' frusta, for the hosts' reach test
    this._sunPlanesFrame = -1;
    this._shiftGen = 0;                 // AUDIT SC1: the floating origin's generation (shiftOrigin)
    this._shiftAcc = [[0, 0, 0]];       // ...and the origin's cumulative offset at each generation
    this._shiftD = [0, 0, 0];
    this._identityView = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this._right = new Float32Array(3); this._up = new Float32Array([0, 1, 0]);
    this._zeroWind = new Float32Array(4);
    this._sunVPFlat = new Float32Array(16 * SHADOW_CASCADES.length);
  }

  /** DISC15: a depth array of `layers` layers of `size` square, compared (a shadow sampler's), clamped. */
  _depthArray(size, layers, filter) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, size, size, layers);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
    return tex;
  }
  /** One depth-only framebuffer per layer of the array `tex` - the sun's, the point's, the lo tier's and the cache's. */
  _layerFbos(tex, layers) {
    const gl = this.gl, fbos = [];
    for (let l = 0; l < layers; l++) {
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, tex, 0, l);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      fbos.push(fbo);
    }
    return fbos;
  }
  /** DISC15: room for `slots` lo maps - the array grown by SHADOW_LO_STEP (texStorage is immutable: a new array, and
   *  every slot drawn afresh), never shrunk (the next room of the session reuses it). */
  _ensureLo(slots) {
    const want = Math.min(SHADOW_LO_MAX, Math.ceil(slots / SHADOW_LO_STEP) * SHADOW_LO_STEP);
    if (want <= this._loCap) return;
    const gl = this.gl;
    gl.deleteTexture(this.loTex);
    for (const fb of this._loFbos) gl.deleteFramebuffer(fb);
    this.loTex = this._depthArray(SHADOW_LO_SIZE, 6 * want, gl.LINEAR);
    this._loFbos = this._layerFbos(this.loTex, 6 * want);
    this._loCap = want;
    this._loSlotLight = new Float32Array(4 * want).fill(NaN);
    this._loSlotSig = new Int32Array(2 * want);
    this._loBuilt = new Uint8Array(want);
    this._loTaken = new Uint8Array(want);
  }
  /** DISC15: may light i of `L` take a map at all - F11's range cap and MAC-T1's hand, the pick's own two laws. */
  static _castsAt(L, carried, i) {
    const w = L[i * 4 + 3];
    return !(carried && carried[i]) && w > 0 && w <= SHADOW_CASTER_MAX_RANGE;
  }
  /**
   * DISC15: THE LO TIER'S FRAME - every light that may cast keeps a lo slot (sticky by position, as SC1's slots), its
   * map of the room's static casters drawn when the light arrives or moves and redrawn for a changed static set
   * SHADOW_LO_REBUILDS a frame; a light with no 512 map this frame reads its lo map (uCasterOf = SHADOW_POINT_CASTERS + j).
   * The eight keep their lo maps too, so a light that leaves the eight has its map already.
   */
  _renderLo(f, L) {
    const gl = this.gl, n = Math.min(L.length >> 2, SHADOW_CASTER_TABLE);
    let want = 0;
    for (let i = 0; i < n; i++) if (ShadowPass._castsAt(L, f.carried, i)) want++;
    if (want === 0) return;
    this._ensureLo(want);
    const cap = this._loCap, sl = this._loSlotLight, slotOf = this._loSlotOf, taken = this._loTaken;
    slotOf.fill(-1); taken.fill(0);
    for (let i = 0; i < n; i++) {
      if (!ShadowPass._castsAt(L, f.carried, i)) continue;
      for (let j = 0; j < cap; j++) {
        if (!taken[j] && sl[j * 4] === L[i * 4] && sl[j * 4 + 1] === L[i * 4 + 1] && sl[j * 4 + 2] === L[i * 4 + 2]) { slotOf[i] = j; taken[j] = 1; break; }
      }
    }
    for (let i = 0; i < n; i++) {
      if (slotOf[i] >= 0 || !ShadowPass._castsAt(L, f.carried, i)) continue;
      for (let j = 0; j < cap; j++) if (!taken[j]) { slotOf[i] = j; taken[j] = 1; break; }
    }
    for (let j = 0; j < cap; j++) if (!taken[j]) { sl[j * 4] = NaN; this._loBuilt[j] = 0; }   // a light gone: its slot is drawn afresh for the next
    let rebuilds = SHADOW_LO_REBUILDS;
    for (let i = 0; i < n; i++) {
      const j = slotOf[i];
      if (j < 0) continue;
      const o = j * 4, far = shadowFarFor(L[i * 4 + 3]);
      const pos = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]];
      const fresh = !this._loBuilt[j] || !(sl[o] === pos[0] && sl[o + 1] === pos[1] && sl[o + 2] === pos[2] && sl[o + 3] === far);
      let sig = null, draw = fresh;
      if (!fresh && rebuilds > 0) {
        sig = this._staticSignature(pos, far);
        if (this._loSlotSig[j * 2] !== sig.hash || this._loSlotSig[j * 2 + 1] !== sig.count) { draw = true; rebuilds--; }
      }
      if (draw) {
        if (!sig) sig = this._staticSignature(pos, far);
        this._loSlotSig[j * 2] = sig.hash; this._loSlotSig[j * 2 + 1] = sig.count;
        pointFaceMatrices(pos, far, this.faceVP);
        for (let face = 0; face < 6; face++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, this._loFbos[j * 6 + face]);
          gl.viewport(0, 0, SHADOW_LO_SIZE, SHADOW_LO_SIZE);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_STATIC);
        }
        this.stats.loFaces += 6;
        this._loBuilt[j] = 1;
        sl[o] = pos[0]; sl[o + 1] = pos[1]; sl[o + 2] = pos[2]; sl[o + 3] = far;
      }
      this.stats.loSlots++;
      if (this.casterOf[i] === -1) this.casterOf[i] = SHADOW_POINT_CASTERS + j;
    }
  }
  /** AUDIT SC1: the static cache's array and framebuffers, once, on the first frame the door is open. */
  _ensureCache() {
    if (this.cacheTex) return;
    const gl = this.gl;
    const cache = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, cache);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.DEPTH_COMPONENT24, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE, 6 * SHADOW_POINT_CASTERS);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.cacheTex = cache;
    this.cacheFbos = this._layerFbos(cache, 6 * SHADOW_POINT_CASTERS);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
  }
  _rec() {
    if (this.count >= SHADOW_RECORD_MAX) return null;
    let r = this.records[this.count];
    if (!r) {
      r = { kind: 0, mesh: null, matrix: new Float32Array(16), texRemap: null, surface: null, arrayTex: null, tilemapTex: null, tileSize: 0, batches: null, flatWind: new Float32Array(4), right: new Float32Array(3), up: new Float32Array(3),
        bounded: false, sphere: new Float32Array(4), subSpheres: new Float32Array(0), dynamic: false };   // EL5: the world-space spheres, the record's and its sub-meshes'; SC1: moved since last frame
      this.records[this.count] = r;
    }
    this.count++;
    return r;
  }
  /** SHADOW-REACH (2026-09-23, Mac: "Can you tackle the 2 limitations"): WOULD A CASTER HERE CAST INTO THIS FRAME'S
   *  MAPS. The hosts cull what they draw to the VIEW frustum, and the maps are replayed from what they drew - so a
   *  tree behind the camera cast no sun shadow into the view, a wall just off screen cast none from the lantern
   *  beside it, and SC1's caches churned as the camera turned (the still set in a lantern's reach changed with the
   *  view). A host asks this for a box its view cull rejected and records the caster (recordShadow* on the renderer)
   *  when it is inside a sun cascade's frustum (the cascade is an orthographic box about the eye reaching
   *  SHADOW_SUN_DEPTH toward the light) or within a point caster's range - THIS frame's casters, picked by render()
   *  from this frame's lights: the records are a frame old by design (EL2), and so is the reach. */
  reaches(box, ox = 0, oy = 0, oz = 0) {
    const pp = this.pointParams;
    // AUDIT REACH: against a lantern the box's ENCLOSING SPHERE, not the box - the cache's signature counts a record by
    // its bounding sphere (larger than the box), so a caster whose sphere touched the range and whose box did not was
    // recorded on screen and dropped off it: the signature flipped with the view and the cache was rebuilt for a
    // caster that put nothing in it - exactly the churn this test exists to end. The enclosing sphere is a superset.
    const cx = (box[0] + box[3]) * 0.5 + ox, cy = (box[1] + box[4]) * 0.5 + oy, cz = (box[2] + box[5]) * 0.5 + oz;
    const r = Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) * 0.5;
    for (let k = 0; k < SHADOW_POINT_CASTERS; k++) {
      const far = pp[k * 4 + 3];
      if (far > 0 && spheresTouch(cx, cy, cz, r, pp[k * 4], pp[k * 4 + 1], pp[k * 4 + 2], far)) return true;
    }
    if (this.sunParams[3] > 0) {
      this._ensureSunPlanes();
      for (let c = 0; c < SHADOW_CASCADES.length; c++) if (!aabbOutside(this._sunPlanes[c], box, ox, oy, oz)) return true;
    }
    return false;
  }
  /** SHADOW-REACH: the same question for a sphere (a flat batch's, as batchVisible builds it). */
  reachesSphere(x, y, z, r) {
    const pp = this.pointParams;
    for (let k = 0; k < SHADOW_POINT_CASTERS; k++) if (pp[k * 4 + 3] > 0 && spheresTouch(x, y, z, r, pp[k * 4], pp[k * 4 + 1], pp[k * 4 + 2], pp[k * 4 + 3])) return true;
    if (this.sunParams[3] > 0) {
      this._ensureSunPlanes();
      for (let c = 0; c < SHADOW_CASCADES.length; c++) if (sphereInPlanes(this._sunPlanes[c], x, y, z, r)) return true;
    }
    return false;
  }
  _ensureSunPlanes() {
    if (this._sunPlanesFrame === this.frameNo) return;
    for (let c = 0; c < SHADOW_CASCADES.length; c++) spherePlanes(this.sunVP[c], this._sunPlanes[c]);
    this._sunPlanesFrame = this.frameNo;
  }
  /** AUDIT SC1: THE HOST'S FLOATING ORIGIN MOVED by `offset` (world.js recentres every 819 units). Every placement the
   *  pass remembers was seen from the old origin; rather than walk objects it holds no list of, the pass counts a
   *  generation and each object is rebased on its next draw by the offsets between its generation and this one.
   *  Without it every still caster read as moved for SHADOW_DYNAMIC_HOLD frames after a crossing - a near-empty
   *  cache rebuilt per slot, then the whole town replayed as dynamic at the cadence for a second, then rebuilt again. */
  shiftOrigin(offset) {
    const a = this._shiftAcc[this._shiftGen];
    this._shiftAcc.push([a[0] + offset[0], a[1] + offset[1], a[2] + offset[2]]);
    this._shiftGen++;
    this._sunDrawn.fill(0);   // AUDIT 68 S17-far-cascade-shift: the held far map and its matrix are the old origin's - drawn afresh next frame (EL8's never-drawn rule)
    // AUDIT REACH: and the records IN HAND follow too - the frame's records are replayed at the next beginFrame
    // against the next frame's lights and eye (EL2), which the host has already moved; left behind, the crossing's
    // frame had no shadow at all and every cache was built twice (once empty). A batch's origin is the host's own
    // object, which the host moved; a mesh's and a tile's matrix and spheres are the pass's copies.
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind === REC_BB) continue;
      r.matrix[12] += offset[0]; r.matrix[13] += offset[1]; r.matrix[14] += offset[2];
      if (!r.bounded) continue;
      r.sphere[0] += offset[0]; r.sphere[1] += offset[1]; r.sphere[2] += offset[2];
      for (let j = 0; j + 3 < r.subSpheres.length; j += 4) if (r.subSpheres[j + 3] >= 0) { r.subSpheres[j] += offset[0]; r.subSpheres[j + 1] += offset[1]; r.subSpheres[j + 2] += offset[2]; }
    }
  }
  /** the offset from generation `gen`'s origin to the current one */
  _shiftDelta(gen) {
    const from = this._shiftAcc[gen], to = this._shiftAcc[this._shiftGen], d = this._shiftD;
    d[0] = to[0] - from[0]; d[1] = to[1] - from[1]; d[2] = to[2] - from[2];
    return d;
  }
  /** SC1: is this object's placement the one it had when last recorded - and remember this one. A first sight is
   *  static (a new caster changes the signature by itself).
   *
   *  AUDIT SC1: the memory is PER PLACEMENT, not per mesh. The hosts draw one GPU mesh at many matrices - a
   *  dungeon's action doors share a model, the windmills, the city gates, a model too odd to batch - and the first
   *  cut kept one matrix per mesh, so two doors of one model read as moved on EVERY draw (each saw the other's
   *  matrix) and every lantern near them paid the dynamic replay forever. A draw is matched to the remembered
   *  placement nearest its own translation within SHADOW_INSTANCE_REACH (two doors of one model stand rooms apart;
   *  a swinging door moves a hand's breadth a frame), and a placement past SHADOW_INSTANCE_MAX is dynamic - never a
   *  wrong shadow, only a dearer one. */
  _moved(o, matrix) {
    let inst = o._shInst;
    if (!inst) { inst = o._shInst = []; o._shGen = this._shiftGen; }
    else if (o._shGen !== this._shiftGen) {
      const d = this._shiftDelta(o._shGen);
      for (const s of inst) { s.m[12] += d[0]; s.m[13] += d[1]; s.m[14] += d[2]; }
      o._shGen = this._shiftGen;
    }
    const x = matrix[12], y = matrix[13], z = matrix[14];
    // AUDIT REACH: THE PLACEMENT ITSELF FIRST. The first cut matched the NEAREST remembered placement within the reach,
    // so two still placements of one mesh closer than that (double doors, an arrow in the wall beside another)
    // overwrote each other every draw and read as moved for ever. A draw at a remembered placement (within the
    // epsilon) is that placement, still; only a draw at none is matched to the nearest within reach - a mover's own
    // last placement, a step behind it - and a draw past every reach is a new placement. A placement not drawn for
    // a hold is the one a new placement evicts when the memory is full.
    let exact = null, best = null, bestD = SHADOW_INSTANCE_REACH * SHADOW_INSTANCE_REACH, oldest = null;
    const eps2 = SHADOW_STILL_EPS * SHADOW_STILL_EPS;
    for (let i = 0; i < inst.length; i++) {
      const s = inst[i], m = s.m, d = (m[12] - x) * (m[12] - x) + (m[13] - y) * (m[13] - y) + (m[14] - z) * (m[14] - z);
      if (d <= eps2) { exact = s; break; }
      if (d < bestD && s.seen !== this.frameNo) { bestD = d; best = s; }   // a placement already claimed by a draw this frame is another instance's, not this draw's last step
      if (oldest === null || s.seen < oldest.seen) oldest = s;
    }
    let s = exact ?? best;
    if (!s) {
      if (inst.length >= SHADOW_INSTANCE_MAX) {
        if (!oldest || this.frameNo - oldest.seen < SHADOW_DYNAMIC_HOLD) return true;   // every placement live: dynamic, never wrong
        s = oldest; s.m.set(matrix); s.at = null; s.seen = this.frameNo;   // a placement not drawn for a hold: this one's now
        return false;
      }
      inst.push({ m: new Float32Array(matrix), at: null, seen: this.frameNo });
      return false;
    }
    s.seen = this.frameNo;
    const m = s.m;
    let same = true;
    for (let i = 0; i < 16; i++) if (Math.abs(m[i] - matrix[i]) > SHADOW_STILL_EPS) { same = false; break; }
    if (!same) { m.set(matrix); s.at = this.frameNo; }
    return s.at != null && this.frameNo - s.at < SHADOW_DYNAMIC_HOLD;   // moved now, or within the hold
  }
  recordMesh(mesh, matrix, texRemap) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_MESH; r.mesh = mesh; r.matrix.set(matrix); r.texRemap = texRemap;
    r.dynamic = this._moved(mesh, matrix);   // SC1
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
    r.dynamic = this._moved(surface, matrix);   // SC1: a streamed tile stands still; one that moved (never, today) would say so
    r.bounded = !!surface.bounds;
    if (r.bounded) transformSphere(matrix, surface.bounds, r.sphere);
  }
  /** EL7: a character rig (createCharacterMesh's bundle: vao, count, ranges) casts too. */
  recordCharacter(mesh, matrix) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_CHAR; r.mesh = mesh; r.matrix.set(matrix);
    r.dynamic = true;   // SC1: a rig is never still
    r.bounded = !!mesh.bounds;
    if (r.bounded) transformSphere(matrix, mesh.bounds, r.sphere);
  }
  recordBillboards(batches, flatWind, camRight, camUp) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_BB; r.batches = batches; r.flatWind.set(flatWind ?? this._zeroWind);
    r.right.set(camRight); r.up.set(camUp);   // EL3: the basis the batch was drawn with, for the emission replay
    r.bounded = false;   // a batch list is culled batch by batch (each has its own bounds about its origin)
    // SC1: a flat is dynamic while its origin moves (a walker, a missile, a thrown torch) - per batch, remembered on the batch
    // SHADOW-REACH (the sway): a flora batch LEANS with the wind (WIND3: the crown moves by the wind's rate times the
    // batch's `sway`, on a clock that runs every frame), so while a wind blows its silhouette is never twice the
    // same - a dynamic for as long as the wind lasts, and still the moment it drops. The audit had left this as
    // "a lantern's shadow of a swaying tree holds one phase".
    const fw = r.flatWind, wl = Math.hypot(fw[0], fw[1]);
    // AUDIT SC1: ...and while its FRAME changes (an animated flat's silhouette is the frame's - a townsman's idle,
    // a 211 prop - and the cache would have held the build frame's until an unrelated rebuild), and always for a
    // batch built dynamic (`_dyn`: moveBillboardBatch rewrites its vertices with the origin left null, so the
    // origin test never saw a gib fly). The origin follows the floating origin as a mesh's placement does.
    let anyDyn = false;
    for (const b of batches) {
      if (!b) continue;
      const o = b.origin, ox = o ? o[0] : 0, oy = o ? o[1] : 0, oz = o ? o[2] : 0;
      // AUDIT REACH: the silhouette is the RECORD's (a townsman's idle, a foe's swing rewrite `record`; `frame` is a
      // 211 prop's) and its FLIP's (a turn is the sign of size.w) - the first cut watched `frame` alone
      const fr = b.frame ?? -1, rec = b.record, flip = !!(b.size && b.size.w < 0);
      const swaying = b.sway > 0 && b.size && swayLean(wl, b.sway, b.size.h) > SHADOW_SWAY_STILL;   // leaning past half a texel: moving, on the sway's own cadence
      if (b._shSeen === true && b._shGen !== this._shiftGen) { const d = this._shiftDelta(b._shGen ?? 0); b._shOx += d[0]; b._shOy += d[1]; b._shOz += d[2]; }
      b._shGen = this._shiftGen;
      if (b._shSeen === true && !(Math.abs(b._shOx - ox) <= SHADOW_STILL_EPS && Math.abs(b._shOy - oy) <= SHADOW_STILL_EPS && Math.abs(b._shOz - oz) <= SHADOW_STILL_EPS && b._shFrame === fr && b._shRec === rec && b._shFlip === flip)) b._shMovedAt = this.frameNo;
      const moving = b._dyn === true || (b._shMovedAt != null && this.frameNo - b._shMovedAt < SHADOW_DYNAMIC_HOLD);   // built dynamic, moved now, or within the hold
      const dyn = moving || swaying;
      b._shSeen = true; b._shOx = ox; b._shOy = oy; b._shOz = oz; b._shFrame = fr; b._shRec = rec; b._shFlip = flip; b._shDyn = dyn; b._shSway = swaying && !moving;   // sway alone: the slow cadence
      if (dyn) anyDyn = true;
    }
    r.dynamic = anyDyn;   // the record carries a dynamic batch (the replay reads each batch's own word)
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
    this.stats.cascadesDrawn = 0; this.stats.facesDrawn = 0; this.stats.staticFaces = 0; this.stats.dynFaces = 0; this.stats.blits = 0; this.stats.cachedSlots = 0;   // SC1
    this.stats.loSlots = 0; this.stats.loFaces = 0;   // DISC15
    this.sunParams[3] = 0; this.pointParams.fill(0); this.shadowIndex.fill(-1); this.casterOf.fill(-1); this.casters = 0;
    if (this.count === 0) { this.kind = null; this._slotLight.fill(NaN); this._sunDrawn.fill(0); return; }   // AUDIT 68 S17-far-cascade-shift: no sun map is held past a frame that drew none
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
        this.stats.sunDraws += this.replay(f, this.sunVP[c], null, false, SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(c), sunTexelWorld(c));   // F5: the small solids; WEEDS1: and the small SPRITES, which F5's sphere test cannot see casters skipped by the cascade's texel
        this._sunDrawn[c] = 1; this.stats.cascadesDrawn++;
      }
      for (let c = 0; c < SHADOW_CASCADES.length; c++) { this.sunParams[c] = SHADOW_CASCADES[c]; this.sunTexel[c] = sunTexelWorld(c); this._sunVPFlat.set(this.sunVP[c], c * 16); }
      this.sunParams[3] = 1;
    } else this._sunDrawn.fill(0);   // AUDIT 68 S17-far-cascade-shift: a returning sun never reuses a map drawn at another place and time
    // EL5: THE LANTERNS CAST TOO, sun or no sun - the nearest SHADOW_POINT_CASTERS
    // of them, each into its six layers; the replays are culled to the
    // lantern's range and the face's frustum, so a caster costs what it lights
    const casters = pickShadowCasters(f.pointLights, f.eye, SHADOW_POINT_CASTERS, f.carried, this._heldCasters, this._heldCasterN);   // MAC-T1; LIGHT-NEAR1; DISC6: last frame's casters keep their maps on a tie
    this._heldCasterN = holdCasters(this._heldCasters, f.pointLights, casters);
    if (this.cacheOn && casters.length) this._ensureCache();   // AUDIT SC1
    const L = f.pointLights;
    // MAC-T1: the hand's light is -2 in the caster table - no slot, and no contact march either (enhancedLighting reads
    // the same table): F3's "never for the light in the hand", said by name rather than by distance from the camera
    if (f.carried) for (let i = 0, m = Math.min(L.length >> 2, SHADOW_CASTER_TABLE); i < m; i++) if (f.carried[i]) this.casterOf[i] = -2;
    // SC1: STICKY SLOTS - a picked light keeps the slot whose cache is its own (matched by POSITION: the hosts re-sort
    // their lights by distance every frame, so an index is no name), and the rest take the free slots nearest-first
    const slotOf = this._slotOfScratch; slotOf.fill(-1);
    const taken = this._slotTakenScratch; taken.fill(0);
    const sl = this._slotLight;
    for (let rank = 0; rank < casters.length; rank++) {
      const i = casters[rank];
      for (let k = 0; k < SHADOW_POINT_CASTERS; k++) {
        if (!taken[k] && sl[k * 4] === L[i * 4] && sl[k * 4 + 1] === L[i * 4 + 1] && sl[k * 4 + 2] === L[i * 4 + 2]) { slotOf[rank] = k; taken[k] = 1; break; }
      }
    }
    for (let rank = 0; rank < casters.length; rank++) {
      if (slotOf[rank] >= 0) continue;
      for (let k = 0; k < SHADOW_POINT_CASTERS; k++) if (!taken[k]) { slotOf[rank] = k; taken[k] = 1; break; }
    }
    for (let rank = 0; rank < casters.length; rank++) {
      const i = casters[rank], k = slotOf[rank];
      const pos = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]];
      // PERF-FLICKER: the SHADOW's far, not the lantern's live one - the
      // flicker must not count as "this light changed" and rebuild six
      // faces. Everything below takes this value (the face matrices, the
      // change test and pointParams), so the map and the shader agree.
      const far = shadowFarFor(L[i * 4 + 3]);
      // EL8: the slot's layers are drawn again when its light changed (position or range), every frame for the nearest lights, every third otherwise
      const o = k * 4;
      const changed = !(sl[o] === pos[0] && sl[o + 1] === pos[1] && sl[o + 2] === pos[2] && sl[o + 3] === far);
      const due = nearestRank(casters, L, f.eye, rank) < SHADOW_NEAR_CASTERS || (this.frameNo + k) % SHADOW_FAR_CASTER_EVERY === 0;   // SC1: by the light's RANK - the nearest two, whatever slot they hold; AUDIT DISC7 C6: its TRUE rank, not the keep margin's
      if (!this.cacheOn) {
        // the old path whole: every caster in range, static or not, into the live layers at the cadence
        if (changed || due) {
          pointFaceMatrices(pos, far, this.faceVP);
          for (let face = 0; face < 6; face++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFbos[k * 6 + face]);
            gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this.stats.pointDraws += this.replay(f, this.faceVP[face], pos);
          }
          this.stats.facesDrawn += 6;
        }
        this._slotCached[k] = 0; this._slotLiveDyn[k] = 0;
      } else {
        // SC1: the static cache, drawn only when the light or the static set in its reach changed
        const sig = this._staticSignature(pos, far);
        const staticStale = changed || !this._slotCached[k] || this._slotSig[k * 2] !== sig.hash || this._slotSig[k * 2 + 1] !== sig.count;
        let matrices = false;
        if (staticStale) {
          pointFaceMatrices(pos, far, this.faceVP); matrices = true;
          for (let face = 0; face < 6; face++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.cacheFbos[k * 6 + face]);
            gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_STATIC);
          }
          this.stats.facesDrawn += 6; this.stats.staticFaces += 6;
          this._slotCached[k] = 1; this._slotSig[k * 2] = sig.hash; this._slotSig[k * 2 + 1] = sig.count;
        } else this.stats.cachedSlots++;
        // the dynamics on top: the cache blitted into the live layers, then the moving casters alone, at the cadence
        const dynNear = this._dynamicNear(pos, far, f.isSpectral);   // 0 none, 1 sway alone, 2 a mover
        const dueDyn = dynNear === DYN_SWAY ? (this.frameNo + k) % SHADOW_SWAY_EVERY === 0 : due;   // AUDIT REACH: a swaying wood redraws on the sway's own cadence
        if (dynNear && (dueDyn || staticStale || !this._slotLiveDyn[k])) {
          this._blitSlot(k);
          if (!matrices) pointFaceMatrices(pos, far, this.faceVP);
          for (let face = 0; face < 6; face++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFbos[k * 6 + face]);
            gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
            this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_DYNAMIC);
          }
          this.stats.facesDrawn += 6; this.stats.dynFaces += 6;
          this._slotLiveDyn[k] = 1;
        } else if (staticStale || (!dynNear && this._slotLiveDyn[k])) {
          // a fresh cache, or the last walker gone: the live layers are the cache again
          this._blitSlot(k);
          this._slotLiveDyn[k] = 0;
        }
      }
      sl[o] = pos[0]; sl[o + 1] = pos[1]; sl[o + 2] = pos[2]; sl[o + 3] = far;
      this.pointParams[k * 4] = pos[0]; this.pointParams[k * 4 + 1] = pos[1]; this.pointParams[k * 4 + 2] = pos[2]; this.pointParams[k * 4 + 3] = far;
      this.shadowIndex[k] = i;
      if (i < SHADOW_CASTER_TABLE) this.casterOf[i] = k;
    }
    for (let k = 0; k < SHADOW_POINT_CASTERS; k++) if (!taken[k]) { this._slotLight[k * 4] = NaN; this._slotCached[k] = 0; this._slotLiveDyn[k] = 0; }   // an emptied slot is drawn afresh when it is filled
    if (f.everyLight) this._renderLo(f, L);   // DISC15: a room drawn whole - every other light reads its lo map
    this.casters = casters.length;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.CULL_FACE);
  }

  /** SC1: the static signature of a lantern's reach - every static record (and static batch) whose sphere touches
   *  the light's, folded by identity and position, order-free. An unbounded record touches everything. */
  _staticSignature(pos, far) {
    let h = 0, n = 0;
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind === REC_BB) {
        for (const b of r.batches) {
          if (!b?.vao || b._dead || b._shDyn || b.noShadow || b.conceal || b.archive === SHADOW_LIGHT_FLATS || SHADOW_NO_CAST_ARCHIVES.has(b.archive)) continue;
          const c = batchSphere(b, this._bSphere);   // AUDIT 68 S16-batch-sphere-dup: the replays' own sphere
          if (c && !spheresTouch(c[0], c[1], c[2], c[3], pos[0], pos[1], pos[2], far)) continue;
          h = foldSignature(h, shId(b)); h = foldSignature(h, Math.round(b._shOx * 64) + Math.round(b._shOz * 64) * 7919); n++;
        }
        continue;
      }
      if (r.dynamic) continue;
      const m = r.kind === REC_TERRAIN ? r.surface : r.mesh;
      if (!m?.vao || m._dead) continue;
      if (r.bounded && !spheresTouch(r.sphere[0], r.sphere[1], r.sphere[2], r.sphere[3], pos[0], pos[1], pos[2], far)) continue;
      h = foldSignature(h, shId(m)); h = foldSignature(h, Math.round(r.matrix[12] * 64) + Math.round(r.matrix[14] * 64) * 7919 + Math.round(r.matrix[13] * 64) * 104729); n++;
    }
    this._sig.hash = h; this._sig.count = n;
    return this._sig;
  }
  /** SC1: is any dynamic caster in the lantern's reach.
   *  AUDIT SC1: a dynamic the replay would not DRAW is no reason to replay - the first cut counted a moving flame
   *  (SHADOW_LIGHT_FLATS), a no-cast archive, a flat under SHADOW_FLAT_MIN_HEIGHT and a ghost, and paid the blit and six
   *  faces at the cadence to draw nothing; the skips are the replay's own (its point-light arm, texel 0). */
  _dynamicNear(pos, far, isSpectral) {
    let near = DYN_NONE;   // AUDIT REACH: a swaying flat alone is DYN_SWAY - the slow cadence; any mover is DYN_MOVER
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind === REC_BB) {
        if (!r.dynamic) continue;
        for (const b of r.batches) {
          if (!b?._shDyn || !b.vao || b._dead || b.noShadow || b.conceal) continue;
          if (b.archive === SHADOW_LIGHT_FLATS || SHADOW_NO_CAST_ARCHIVES.has(b.archive) || (b.size && b.size.h < SHADOW_FLAT_MIN_HEIGHT) || isSpectral(b.archive)) continue;
          if (b._shSway && near === DYN_SWAY) continue;
          const c = batchSphere(b, this._bSphere);   // AUDIT 68 S16-batch-sphere-dup
          if (!c || spheresTouch(c[0], c[1], c[2], c[3], pos[0], pos[1], pos[2], far)) { if (!b._shSway) return DYN_MOVER; near = DYN_SWAY; }
        }
        continue;
      }
      if (!r.dynamic) continue;
      const m = r.kind === REC_TERRAIN ? r.surface : r.mesh;
      if (!m?.vao || m._dead) continue;
      if (!r.bounded || spheresTouch(r.sphere[0], r.sphere[1], r.sphere[2], r.sphere[3], pos[0], pos[1], pos[2], far)) return DYN_MOVER;
    }
    return near;
  }
  /** SC1: the cache's six layers into the live ones - a depth blit, no rasterisation. */
  _blitSlot(k) {
    const gl = this.gl, S = SHADOW_POINT_SIZE;
    for (let face = 0; face < 6; face++) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.cacheFbos[k * 6 + face]);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.pointFbos[k * 6 + face]);
      gl.blitFramebuffer(0, 0, S, S, 0, 0, S, S, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    }
    this.stats.blits += 6;
  }

  replay(f, vp, lightPos, recordBasis = false, minRadius = 0, texel = 0, filter = REPLAY_ALL) {
    // WEEDS1: the height a FLAT must have to cast into this replay - the
    // global floor, or four of this cascade's texels, whichever is more.
    // A replay with no texel (the lanterns, the camera's depth image) gets
    // the floor alone, exactly as before.
    const minFlatH = texel > 0 ? Math.max(SHADOW_FLAT_MIN_HEIGHT, texel * SHADOW_FLAT_MIN_TEXELS) : SHADOW_FLAT_MIN_HEIGHT;
    const gl = this.gl;
    const P = this.programs;
    const planes = spherePlanes(vp, this._planes);   // EL5: this replay's frustum - a record outside it is not drawn
    let draws = 0;
    let bound = null;
    const use = (prog) => { if (bound !== prog) { gl.useProgram(prog.p); gl.uniformMatrix4fv(prog.proj, false, vp); gl.uniformMatrix4fv(prog.view, false, this._identityView); bound = prog; } };
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (filter !== REPLAY_ALL && r.kind !== REC_BB && (filter === REPLAY_STATIC) === r.dynamic) continue;   // SC1: the static replay skips the movers, the dynamic one the still
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
          if (filter !== REPLAY_ALL && (filter === REPLAY_STATIC) === !!b._shDyn) continue;   // SC1: by the batch's own word
          if (lightPos && b.archive === SHADOW_LIGHT_FLATS) continue;   // EL6: a flame is the lantern, not its occluder
          if (b.noShadow || SHADOW_NO_CAST_ARCHIVES.has(b.archive) || (b.size && b.size.h < minFlatH)) { this.stats.culled++; continue; }   // F2: a thing on the ground is no standing card   // WEEDS1: ...and nothing under four texels of THIS cascade
          if (!batchVisible(planes, b)) { this.stats.culled++; continue; }   // EL5
          // WEEDS1: F5's sphere test used to sit here and is GONE, because
          // it can no longer decide anything. A single-flat batch's radius
          // is hypot(w, h) / 2, so F5 fired only when hypot(w, h) < 4 texels
          // - and that implies h < 4 texels, which is the sprite test two
          // lines up. A multi-flat batch's sphere spans its pixel and F5
          // never fired on it at all. Its behavioural pin passed after
          // WEEDS1 landed for the wrong reason (the same flat was already
          // culled) and its mutant survived, which is what said so. F5's
          // test over MESHES and terrain, at the top of this loop, is
          // untouched and still live.
          const key = billboardKey(b);
          const tex = f.textures.get(key);
          if (!tex) continue;
          const o = b.origin || ZERO_ORIGIN;   // AUDIT 68 S16-v-replay-origin-alloc
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
    gl.activeTexture(gl.TEXTURE0 + SHADOW_LO_UNIT);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.loTex);   // DISC15: the lo tier (the one-texel stand-in before a room asks)
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.sunShadow, SHADOW_SUN_UNIT);
    gl.uniform1i(loc.pointShadow, SHADOW_POINT_UNIT);
    if (loc.pointShadowLo) gl.uniform1i(loc.pointShadowLo, SHADOW_LO_UNIT);   // DISC15
    gl.uniformMatrix4fv(loc.sunVP, false, this._sunVPFlat);
    gl.uniform4fv(loc.sunParams, this.sunParams);
    gl.uniform4fv(loc.sunTexel, this.sunTexel);   // EL7
    gl.uniform4fv(loc.pointParams, this.pointParams);   // EL5: all the casters' vec4s at once
    gl.uniform1iv(loc.shadowIndex, this.shadowIndex);
    gl.uniform1iv(loc.casterOf, this.casterOf);   // EL8
  }

}
