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
import { spherePlanes, transformSphere, matrixScale, transformSphereScaled, recordVisible, subMeshVisible, batchVisible, sphereInPlanes, batchSphere, ZERO_ORIGIN, placementRadius, placedHalfDiagonal, placementsInCube, placementsInVolume } from './bounds.js';   // EL5: the cull; PERF-EXT1: and a batch's placements
import { billboardKey } from './billboardKey.js';   // AUDIT 68 S16-bbkey-stale-shadow-reach: re-keyed here, however the batch reached the records
import { aabbOutside } from './frustum.js';   // SHADOW-REACH: a host's box against the cascades
import { getPref } from '../systems/uiPrefs.js';
import { AIR_TUNING } from './airPass.js';   // FLICKER-FIX: the calmer eye
import { pageParam } from '../systems/pageQuery.js';   // PERF-URL: the page's query, parsed once a search
import { BAYER_GLSL, DISSOLVE_GLSL } from './orderedDither.js';   // AUDIT BAY A12: a fading ship's shadow dissolves with her

/** The sun map: two cascades of this size, as a depth texture array. */
export const SHADOW_SUN_SIZE = 2048;
/** A caster's face size (six layers of the point depth array per caster). */
export const SHADOW_POINT_SIZE = 512;
/** EL5: how many lanterns cast at once - the nearest to the eye. */
export const SHADOW_POINT_CASTERS = 12;   // FLICKER-FIX (2026-10-02): twelve, not eight - a lamp past the eight read the lo map (static casters only), so the player's and the townsfolk's shadows vanished for it and came back when it swapped in (+48 MB of depth layers). EL6: six; HQ1: eight - SC1's cache made a still caster nearly free.
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
/**
 * LA-SHADOW4 (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look for flickering issues, performance
 * improvements"): THE SHADOW'S FAR IS HELD ACROSS THE FLICKER, not re-rounded every frame. PERF-FLICKER's quantum
 * swallows a lantern's wobble only when the wobble stays inside one quantum - true of the town's 18 (AnimateLight
 * wanders 16.6 to 18.4, all rounding to 20), false of a dungeon, where every light flickers about its own
 * radius-derived range: a range of 12.3 wanders 10.9 to 12.7 and its far flipped 12 <-> 16 as often as the flicker
 * crossed 12 - every such lamp among the eight rebuilt its six static faces at each crossing, a lo map (DISC15) the
 * same, unbudgeted. A slot now keeps the far its map was drawn to while the range stays within it and less than
 * SHADOW_FAR_HOLD short of it; a range past it, or one that has shrunk well inside, takes a fresh one. The far is
 * still never inside the lamp's reach.
 */
export const SHADOW_FAR_HOLD = 2 * SHADOW_FAR_QUANTUM;
/** LA-SHADOW4: the far a slot whose map was drawn to `held` (NaN: none) takes for a light of range `range`. */
export const heldShadowFar = (held, range) => (held >= range && held - range < SHADOW_FAR_HOLD ? held : shadowFarFor(range));
/** LA-SHADOW4: THE CASTER TABLE'S WORD - the slot in its low byte and, for a lo slot, the far its map was drawn to
 *  above it in quanta: the shader can no longer derive a lo map's far from the live range (DISC15's loFarOf), so the
 *  table carries it. A 512 slot's far is its own uPointShadowParams. */
export const SHADOW_CASTER_FAR_SHIFT = 8;
export const casterWord = (slot, far) => slot | ((far / SHADOW_FAR_QUANTUM) << SHADOW_CASTER_FAR_SHIFT);
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
/** AUDIT FLICKER S1: how many texels up its own card a flat's soft sun read reaches (the 4x4 kernel's two, and half a
 *  texel of the bilinear tap) - the height its own-card bias covers. */
export const SUN_FLAT_REACH_TEXELS = 2.5;
/** LA-SHADOW2: the fraction of a cascade's radius, below its handover at 0.9, over which the next cascade is mixed
 *  in (the far cascade: faded to lit) - 12 units' cascade from 8.4 to 10.8, 48's from 33.6 to 43.2, 240's from 168
 *  to 216. */
export const SUN_CASCADE_BAND = 0.2;
/** The ortho box's half-depth along the light: enough to take a mountain
 *  pixel's height above or below the eye. */
export const SHADOW_SUN_DEPTH = 600;
/** AUDIT DEEP R-3 (the travel view, bible/06-Systems/Travel-View.md): the cascades' SCALE while the view looks down on
 *  the traveller - radii and depth both. At the ground's radii (12/48/240 m) the shadows stopped in a circle 216 m about
 *  the traveller while the picture reached half a kilometre past them, and the two near maps spent centimetre texels
 *  where a pixel covers a metre. Four times: 48/192/960 m, the far texel under a metre. */
export const SHADOW_VIEW_SCALE = 4;
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
/** FLICKER-FIX (2026-10-02): STEADY SHADOWS. The cadences above (far cascade every 2nd frame, far lanterns every 3rd,
 *  sway every 4th) show up on screen as shadows popping on and off from frame to frame. With this on, every map is
 *  redrawn every frame. It also (a) makes the caster hold much stickier, so two lamps at nearly the same distance never swap a full
 *  shadow map (with dynamic shadows) for the lo map (static only) from one frame to the next, and (b) lifts the lo
 *  tier's rebuild budget. Costs GPU time; turn off Settings > Features > Steady shadows (or from the console,
 *  window.__DF_SHADOW_TUNING.override = false; null hands it back to the row) to get EL8's schedule back. */
export const SHADOW_TUNING = { steady: true, override: null, debug: false, debugForce: null, selfLamps: null, calmForce: null, facePrepass: true };
// PERF-SHADOW1: `facePrepass` false walks every lantern face and dynamic scan over every record, as before the pre-pass
// (_casterCandidates) - the pins' oracle and an A/B's off arm (console: window.__DF_SHADOW_TUNING.facePrepass = false).
// AUDIT 637 B8: declared here, where the console finds it.
/** STEADY-BALANCE (2026-10-04, Discord: "shadows too dark and too light where they should be normal ... light of candles too
 *  bright ... it fixed the flickering tho"): THE PLAYER'S OWN CARD CASTS INTO THE TWO LAMPS NEAREST IT AGAIN, steady or not.
 *  FLICKER-FIX had cast it into EVERY lamp with a full map under Steady shadows (twelve): in first person the card
 *  ("Shadows Only", the default) stands a pace before the eye, so every lamp BEHIND the player threw a silhouette right
 *  where the player was looking - a tavern's dozen lamps stacked a dozen into one black mass at the crosshair, and a
 *  candle below the card threw it across the ceiling. The darker screen then opened the eye (EL4's adaptation, toward
 *  AIR_ADAPT_MAX) and every lamp's hot spot blew out to white: the "too dark" and the "too bright" were one fault.
 *  The hop FLICKER-FIX wanted gone is AUDIT FLICKER P2's hold (the card's two lamps kept by place), and under Steady
 *  shadows those two maps are redrawn every frame like the rest, so there is no cadence lag left to hop on.
 *  `selfLamps` (console: window.__DF_SHADOW_TUNING.selfLamps = 12) puts FLICKER-FIX's every-lamp card back to compare;
 *  null is SHADOW_SELF_LAMPS. */
export const SHADOW_SELF_LAMPS = 2;
if (typeof window !== 'undefined') /** @type {any} */ (window).__DF_SHADOW_TUNING = SHADOW_TUNING;   // FLICKER-FIX: set `override` live to compare
/** WIND3's lean at a flat's crown, world units: the shader's push at top = 1 and the gust's peak (renderer.js BB_VS). */
export const swayLean = (wl, sway, h) => wl * 1.3 * 0.0015 * sway * h;
/** PERF-EXT1: the radius that bounds each quad of batch `b` in a record whose wind's rate is `wl` - bounds.js's
 *  placementRadius over WIND3's lean, which BB_VS applies only while uSway > 0 and scales by the quad's height
 *  whichever way it hangs (an upside-down flame's h is negative). The review: the half-diagonal once a size
 *  (placedHalfDiagonal), not a Math.hypot at every ask. */
const quadRadius = (wl, b) => { const h = b.size.h; return placementRadius(placedHalfDiagonal(b), b.sway > 0 ? swayLean(wl, b.sway, h < 0 ? -h : h) : 0); };
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
/** FLICKER-FIX: the lo tier's rebuilds a frame under Steady shadows - a stale lo map settles in a third of the frames. */
export const SHADOW_LO_REBUILDS_STEADY = 6;
/** SC1: the door - `?shadowcache=off` replays every caster at the cadence, as before. */
export function shadowCacheOn(search = globalThis.location?.search ?? '') {
  return pageParam('shadowcache', search) !== 'off';   // PERF-URL
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
const ORIGIN = Object.freeze([0, 0, 0]);
/** Each cascade's orthographic box - its radius across, SHADOW_SUN_DEPTH either side of the eye along the light. */
const SUN_BOXES = SHADOW_CASCADES.map((r) => ortho(r, r, 0, 2 * SHADOW_SUN_DEPTH));
/** AUDIT DEEP R-3: the boxes at a scale, made once each. */
const SUN_BOXES_AT = new Map([[1, SUN_BOXES]]);
function sunBoxesAt(scale) {
  let b = SUN_BOXES_AT.get(scale);
  if (!b) { b = SHADOW_CASCADES.map((r) => ortho(r * scale, r * scale, 0, 2 * SHADOW_SUN_DEPTH * scale)); SUN_BOXES_AT.set(scale, b); }
  return b;
}

/**
 * LA-SHADOW1 (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look for flickering issues"): THE
 * SUN'S TEXEL GRID IS SNAPPED AT A POINT BESIDE THE EYE, NOT AT THE WORLD'S ORIGIN.
 *
 * The snap below makes one world point land on a whole texel, and every other point sits at its offset from that
 * one - under a pure TRANSLATION of the eye each moves by whole texels and nothing on the map changes. But the sun
 * TURNS: sunDirection(minute) moves every frame (a game minute is five real seconds), and a turn moves a point's
 * texel phase by its distance from the snapped point times the angle. The snapped point was the world origin, and the
 * floating origin (world.js) recentres only every 819 units, so the ground under the player sat up to four hundred
 * units off it: at 60 fps its phase slid up to half a cascade-0 texel a frame (an eighth of a cascade-1 one), and
 * every shadow edge near a standing player crawled - the trees at their base worst of all (a flat reads one value at
 * its foot). Snapped at an ANCHOR beside the eye the lever is a tenth as long or less and the slide is under a texel a
 * second. The anchor is the eye rounded to SUN_ANCHOR_STEP, held until the eye is SUN_ANCHOR_HOLD from it (a
 * re-anchor shifts the grid's phase once, by under a texel - while walking, never while standing or turning), and it
 * follows the floating origin (ShadowPass.shiftOrigin) so a recentre moves nothing.
 *
 * And the basis's UP is the world's Z: the sun's path lies in the XY plane (worldClock.js sunDirection: x = cos, y =
 * sin, z = 0), so Z is never along it. The old up flipped from Y to Z as the sun passed within eight degrees of the
 * zenith - at about 11:28 and 12:32 the whole grid turned ninety degrees in one frame.
 */
export const SUN_ANCHOR_STEP = 8;
export const SUN_ANCHOR_HOLD = 24;
/** LA-SHADOW1: re-anchor `anchor` (a world point, or NaN for none) at the eye when the eye has left its hold.
 *  Answers whether it moved.
 *  @param {ArrayLike<number>} eye @param {{[i: number]: number}} anchor @returns {boolean} */
export function sunAnchorFor(eye, anchor, lightDir = null, texel = 0) {
  const dx = eye[0] - anchor[0], dy = eye[1] - anchor[1], dz = eye[2] - anchor[2];
  if (dx * dx + dy * dy + dz * dz <= SUN_ANCHOR_HOLD * SUN_ANCHOR_HOLD) return false;   // NaN compares false: a fresh anchor is taken
  if (lightDir && texel > 0 && Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(dz)) {
    // AUDIT FLICKER S2: A RE-ANCHOR KEEPS THE GRID. A fresh anchor's phase on the grid it replaces is arbitrary, and
    // the snap puts it on a whole texel - every cascade's grid jumped up to half a texel in one frame, every 24-31 m
    // walked (and mid-turn in third person, the eye circling). So the anchor moves from the old one by WHOLE texels of
    // the far cascade across the light (`texel`: the cascades are 1 : 4 : 20, so a far texel is whole in all three)
    // and freely along it, where no texel lies: the grid the maps are drawn on does not move.
    const up = Math.abs(lightDir[2]) < 0.9 ? Z_UP : Y_UP;   // sunCascadeMatrices' own basis
    const zl = Math.hypot(lightDir[0], lightDir[1], lightDir[2]) || 1;
    const z0 = lightDir[0] / zl, z1 = lightDir[1] / zl, z2 = lightDir[2] / zl;
    let x0 = up[1] * z2 - up[2] * z1, x1 = up[2] * z0 - up[0] * z2, x2 = up[0] * z1 - up[1] * z0;
    const xl = Math.hypot(x0, x1, x2) || 1; x0 /= xl; x1 /= xl; x2 /= xl;
    const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    const ax = Math.round((dx * x0 + dy * x1 + dz * x2) / texel) * texel, ay = Math.round((dx * y0 + dy * y1 + dz * y2) / texel) * texel, az = dx * z0 + dy * z1 + dz * z2;
    anchor[0] += x0 * ax + y0 * ay + z0 * az;
    anchor[1] += x1 * ax + y1 * ay + z1 * az;
    anchor[2] += x2 * ax + y2 * ay + z2 * az;
    return true;
  }
  anchor[0] = Math.round(eye[0] / SUN_ANCHOR_STEP) * SUN_ANCHOR_STEP;
  anchor[1] = Math.round(eye[1] / SUN_ANCHOR_STEP) * SUN_ANCHOR_STEP;
  anchor[2] = Math.round(eye[2] / SUN_ANCHOR_STEP) * SUN_ANCHOR_STEP;
  return true;
}

/** The cascades' view-projections for a sun at `lightDir` (the direction TOWARD the light) around `eye`,
 *  texel-snapped at `anchor` (LA-SHADOW1: a world point near the eye; the origin by default) so the shadow edge
 *  does not shimmer as the camera walks or the sun turns. `out` is one Float32Array(16) per cascade.
 *  AUDIT DEEP R-3: `scale` grows every box and its depth (SHADOW_VIEW_SCALE under the travel view; 1 otherwise).
 *  @param {any} eye @param {any} lightDir @param {any} out @param {ArrayLike<number>} [anchor] @param {number} [scale] */
export function sunCascadeMatrices(eye, lightDir, out, anchor = ORIGIN, scale = 1) {
  const boxes = sunBoxesAt(scale);
  const depth = SHADOW_SUN_DEPTH * scale;
  const up = Math.abs(lightDir[2]) < 0.9 ? Z_UP : Y_UP;   // LA-SHADOW1: never along the sun's path
  // LA-SHADOW1: one view for every cascade (the same eye, light and up), and each cascade's box made once
  const le = [eye[0] + lightDir[0] * depth, eye[1] + lightDir[1] * depth, eye[2] + lightDir[2] * depth];
  const view = lookAt(le, eye, up);
  for (let c = 0; c < SHADOW_CASCADES.length; c++) {
    const vp = multiply(boxes[c], view, out[c]);
    // the snap: the anchor's map texel is rounded, and the box is moved by the remainder, so every world point lands
    // on the same texel whatever the eye did between frames (an orthographic box: w is 1)
    const half = SHADOW_SUN_SIZE / 2;
    const ax = (vp[0] * anchor[0] + vp[4] * anchor[1] + vp[8] * anchor[2] + vp[12]) * half;
    const ay = (vp[1] * anchor[0] + vp[5] * anchor[1] + vp[9] * anchor[2] + vp[13]) * half;
    vp[12] += (Math.round(ax) - ax) / half;
    vp[13] += (Math.round(ay) - ay) / half;
  }
  return out;
}

/** The world-space size of one texel of cascade `c` (at the cascades' `scale`, AUDIT DEEP R-3). */
export function sunTexelWorld(c, scale = 1) {
  return 2 * SHADOW_CASCADES[c] * scale / SHADOW_SUN_SIZE;
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
/** FLICKER-FIX: the keep ratio under SHADOW_TUNING.steady - a newcomer must be a third nearer to take a held map. */
export const CASTER_KEEP_RATIO_STEADY = 0.65;
/** Was the light at `lights[i]` a caster last frame? `held` is the flat [x, y, z, _] list the pass kept, by
 *  POSITION (the hosts re-sort their lights every frame, so an index is no name - SC1's own matching). */
function heldAt(held, heldN, lights, i) {
  for (let k = 0; k < heldN; k++) if (samePlace(held, k * 4, lights, i * 4)) return true;
  return false;
}
/** AUDIT FLICKER P3: two lights' places the same, within SHADOW_STILL_EPS. The kept copies (DISC6's hold, SC1's
 *  sticky slots, DISC15's lo slots, the card's pair) and the host's lights take a floating-origin shift's offset in
 *  different precisions (a Float32 slot, a Float64 hold, the host's own doubles written to the frame's list), and an
 *  exact match lost them all on the crossing frame: 125 of 300 recentres in a lantern-lit street swapped a lantern in
 *  or out of the eight - one lighting through walls for a frame - and every static cache rebuilt at once. */
export const samePlace = (a, ai, b, bi) => Math.abs(a[ai] - b[bi]) <= SHADOW_STILL_EPS && Math.abs(a[ai + 1] - b[bi + 1]) <= SHADOW_STILL_EPS && Math.abs(a[ai + 2] - b[bi + 2]) <= SHADOW_STILL_EPS;
/** AUDIT DISC7 C6: where the caster at `rank` stands among the frame's casters by TRUE distance to the eye. The pick's
 *  order carries DISC6's keep margin (a held caster is measured at CASTER_KEEP_RATIO), which decides who HOLDS a map;
 *  which two maps are redrawn every frame is about who is nearest, and a held caster a little farther must not take
 *  that redraw from a nearer one. Ties go to the earlier rank. At most SHADOW_POINT_CASTERS squared compares. */
export function nearestRank(casters, lights, eye, rank, held = null, heldN = 0) {
  const keep = CASTER_KEEP_RATIO * CASTER_KEEP_RATIO;   // AUDIT FLICKER P2: a held light (`held`, by place) at the keep ratio of its distance
  const d2 = (i) => { const dx = lights[i * 4] - eye[0], dy = lights[i * 4 + 1] - eye[1], dz = lights[i * 4 + 2] - eye[2]; const d = dx * dx + dy * dy + dz * dz; return held && heldAt(held, heldN, lights, i) ? d * keep : d; };
  const mine = d2(casters[rank]);
  let n = 0;
  for (let r = 0; r < casters.length; r++) if (r !== rank) { const d = d2(casters[r]); if (d < mine || (d === mine && r < rank)) n++; }
  return n;
}
/** AUDIT PRE-MERGE 0929 E3: THE CARD'S LAMPS ARE CASTERS. DISC29-E cast the player's own card into the two lamps nearest
 *  IT - ranked among the casters, which are the lamps nearest the EYE: with the camera 4 m or more away (the setting
 *  runs to 10), the lamps nearest a still player were often not among them, and his silhouette still hopped from lamp
 *  to lamp as the camera circled (MAGEAA00: 12 of 39 spots, 33 hops, an orbit at 6 m). So the `n` casting lights nearest
 *  `self` - by the pick's own measure, DISC6's hold and all - are made casters, each in place of the eye's farthest pick
 *  that is not one of them, or beside the picks while there is room. `casters` is the pick's own array; without a card
 *  it is answered untouched. */
export function reserveSelfCasters(casters, lights, self, n, max, carried = null, held = null, heldN = 0) {
  if (!self || !n) return casters;
  const mine = pickShadowCasters(lights, self, n, carried, held, heldN);
  for (const i of mine) {
    if (casters.includes(i)) continue;
    if (casters.length < max) { casters.push(i); continue; }
    for (let r = casters.length - 1; r >= 0; r--) if (!mine.includes(casters[r])) { casters[r] = i; break; }
  }
  return casters;
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
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) * (held && heldAt(held, heldN, lights, i) ? (SHADOW_TUNING.steady ? CASTER_KEEP_RATIO_STEADY : CASTER_KEEP_RATIO) : 1);
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
uniform vec4 uSunOrigin;          // TV1: xyz the point the cascades were rendered about, w 1 = set (0: uCamPos, the old law)
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
// LA-SHADOW2: cascade c's lookup at wp - the whole of what sunShadowTap did for the one cascade it picked
float sunCascadeTap(int c, vec3 wp, vec3 n, bool soft, float h) {
  float texel = c == 0 ? uSunTexel.x : c == 1 ? uSunTexel.y : uSunTexel.z;
  mat4 vp = c == 0 ? uSunVP[0] : c == 1 ? uSunVP[1] : uSunVP[2];
  vec4 lp = vp * vec4(wp + n * texel * 1.5, 1.0);
  vec3 p = lp.xyz / lp.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float ref = p.z - ${SHADOW_SUN_BIAS};   // AUDIT-EL F15: ~0.06 world units over the 1200-unit box (0.0004 was half a unit - feet floated off their shadows)
  // AUDIT FLICKER S1: A FLAT'S OWN CARD. The sun replay draws each flat as an upright card through the very base it
  // reads at (EL2), and the sun is not level: the card above the read point stands nearer the light by tan(elevation)
  // a unit up, and the kernel reaches ${SUN_FLAT_REACH_TEXELS} texels up it - past the constant bias once that reach
  // times tan(e) passes it, by a share the sun's turn slides texel by texel (a tree stepped a third of its sun in one
  // frame, and chattered on the far cascade's redraws). A flat's read is lowered by what its own card could hold over
  // it: the kernel's reach up the card (tan(e) a texel), never more than the card above the point holds (h, the
  // flat's height: sin(e) a unit up it).
  if (soft && h > 0.0) {
    vec3 zr = vec3(vp[0][2], vp[1][2], vp[2][2]);
    float zl = length(zr);
    vec3 toSun = -zr / max(zl, 1e-6);
    float sinE = max(toSun.y, 0.0);
    ref -= min(${SUN_FLAT_REACH_TEXELS} * texel * sinE / max(length(toSun.xz), 1e-3), max(h - 0.5, 0.0) * sinE) * 0.5 * zl;
  }
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
  // PERF-EXT5 (2026-09-25, the players' "fps issues in the exterior but
  // fine in the interior" and "me too my friend.. don't know why. I got a
  // RX6600"): THE 3x3 KERNEL IN FOUR TAPS, THE SAME WEIGHTS. It was nine
  // hardware 2x2s one texel apart. Per axis they weigh the four texels
  // under them [1-f, 1, 1, f] (f the sample's fraction past a texel
  // centre), and two bilinear taps give exactly that: one over the first
  // pair at weight 2-f, set 1/(2-f) of the way into it, and one over the
  // last pair at weight 1+f, set f/(1+f) in. The kernel is separable, so
  // four taps are the nine - the same texels, the same weights, equal in
  // exact arithmetic. What moves: the hardware quantises each tap's
  // sub-texel fraction (8 bits on the players' D3D11-class cards), and the
  // four taps quantise other fractions than the nine did - under a 255th
  // of the sun's light, in a penumbra only (0.93 of one at worst over the
  // provers' random maps; test/perfexta.test.js's twin holds it under
  // one), 2 of 518,400 pixels by one step on SwiftShader.
  // Five fetches a fragment gone: every flat by day, and every lit
  // fragment of the near cascades.
  vec2 st = p.xy * ${SHADOW_SUN_SIZE}.0 - 0.5;
  vec2 b = floor(st), f = st - b;
  vec2 wA = 2.0 - f, wB = 1.0 + f;
  vec2 tA = (b - 0.5 + 1.0 / wA) * texelUv, tB = (b + 1.5 + f / wB) * texelUv;
  float lc = float(c);
  float lit = wA.x * wA.y * texture(uSunShadow, vec4(tA.x, tA.y, lc, ref)) + wB.x * wA.y * texture(uSunShadow, vec4(tB.x, tA.y, lc, ref))
    + wA.x * wB.y * texture(uSunShadow, vec4(tA.x, tB.y, lc, ref)) + wB.x * wB.y * texture(uSunShadow, vec4(tB.x, tB.y, lc, ref));
  return lit / 9.0;
}
// LA-SHADOW2 (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look for flickering issues"): THE
// CASCADES HAND OVER IN A BAND, AND THE LAST ONE FADES OUT. The pick was a hard line at nine tenths of each radius:
// a shadow crossing it changed its texel four- or fivefold, its normal offset with it (the edge stepped sideways by
// centimetres) and, at the far line, its kernel - a ring about the player that popped every shadow it swept over as
// they walked, and a tree's whole sprite with it (a flat reads one value at its foot). Past the far box the shadows
// stopped at its square edge, a line that turned with the sun. Now the last SUN_CASCADE_BAND of each cascade's reach
// mixes in the next one, which covers it whole, and the far cascade's last stretch fades to lit by distance - a
// circle, not the box's turning square. Two lookups only in the band.
float sunShadowTap(vec3 wp, vec3 n, bool soft, float h) {
  if (uSunShadowParams.w <= 0.0) return 1.0;
  float d = length(wp - (uSunOrigin.w > 0.5 ? uSunOrigin.xyz : uCamPos));   // TV1: picked about the point the cascades stand on - the travel view's traveller, else the eye
  int c = d < uSunShadowParams.x * 0.9 ? 0 : d < uSunShadowParams.y * 0.9 ? 1 : 2;
  float r = c == 0 ? uSunShadowParams.x : c == 1 ? uSunShadowParams.y : uSunShadowParams.z;
  float t = smoothstep(r * ${(0.9 - SUN_CASCADE_BAND).toFixed(2)}, r * 0.9, d);   // 0 short of the band, 1 at the handover
  if (c == 2) return t >= 1.0 ? 1.0 : mix(sunCascadeTap(2, wp, n, soft, h), 1.0, t);
  float lit = sunCascadeTap(c, wp, n, soft, h);
  return t > 0.0 ? mix(lit, sunCascadeTap(c + 1, wp, n, soft, h), t) : lit;
}
/** A surface that shades per fragment: the cheap tap past SHADOW_PCF_CASCADES. */
float sunShadowAt(vec3 wp, vec3 n) { return sunShadowTap(wp, n, false, 0.0); }
/** A FLAT, which reads once for a whole sprite: the kernel at every distance (TREES1). AUDIT FLICKER S1: h its
 *  height, whose own card the read is kept off. */
float sunShadowSoftAt(vec3 wp, vec3 n, float h) { return sunShadowTap(wp, n, true, h); }
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
// DISC15: light L's shadow from its lo map j, drawn to far (LA-SHADOW4: the caster table's word carries it) -
// pointShadowAt's face and uv on the lo array, the normal offset and the bias held to a texel of it (a 256 face's
// texel is twice a 512's)
float pointShadowLoAt(int j, float far, vec4 L, vec3 wp, vec3 n) {
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
float pointShadowLoOne(int j, float far, vec4 L, vec3 wp) {
  vec3 d = wp - L.xyz;
  int face; float m;
  vec2 uv = cubeFaceUv(d, face, m);
  float texel = 2.0 * m / ${SHADOW_LO_SIZE}.0;
  return texture(uPointShadowLo, vec4(uv, float(j * 6 + face), cubeDepthOfM(m - max(${SHADOW_POINT_BIAS}, texel), far)));
}
// DISC15: caster k of the light at L (uCasterOf's word): a 512 slot below SHADOW_POINT_CASTERS, a lo slot past it;
// LA-SHADOW4: the slot is the word's low byte, and a lo map's far the quanta above it (casterWord)
float casterShadowAt(int k, vec4 L, vec3 wp, vec3 n) {
  int s = k & 255;
  return s < ${SHADOW_POINT_CASTERS} ? pointShadowAt(s, wp, n) : pointShadowLoAt(s - ${SHADOW_POINT_CASTERS}, float(k >> ${SHADOW_CASTER_FAR_SHIFT}) * ${SHADOW_FAR_QUANTUM}.0, L, wp, n);
}
float casterShadowOne(int k, vec4 L, vec3 wp) {
  int s = k & 255;
  return s < ${SHADOW_POINT_CASTERS} ? pointShadowOne(s, wp) : pointShadowLoOne(s - ${SHADOW_POINT_CASTERS}, float(k >> ${SHADOW_CASTER_FAR_SHIFT}) * ${SHADOW_FAR_QUANTUM}.0, L, wp);
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
/** AUDIT BAY A12: a fading ship's depth (SHIP-FADE) - her share of it kept by the lit pass's own dissolve, over
 *  the map's texels (the filter reads the kept share as the shadow's strength): she cast a whole shadow from a hull
 *  half gone, and on as she was gone. Only a record with a cut is drawn with it (recordMesh's `cut`). */
export const DEPTH_CUT_FS = `#version 300 es
precision highp float;
${BAYER_GLSL}
${DISSOLVE_GLSL}
void main() { dissolveCut(); }`;
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
const REPLAY_ALL = 0, REPLAY_STATIC = 1, REPLAY_DYNAMIC = 2, REPLAY_LO = 3;   // SC1: what a replay draws; DISC29-E: the lo tier's - the still, and a flat that only animates where it stands
/** PERF-SHADOW1 (2026-10-06): how far past a lantern's shadow `far` the centre of a sphere of radius r may stand, on any
 *  axis, and still be taken by one of its cube's six faces - in units of r. Each face is a 90-degree perspective
 *  (pointFaceMatrices): its far plane takes a centre to far + r along the face's axis, and its four sides - planes
 *  through the light at 45 degrees - take one to (along) + r sqrt 2 <= far + r (1 + sqrt 2) across it; the near plane
 *  bounds only from behind. A sphere past far + r (1 + sqrt 2) on some axis is taken by NO face's sphereInPlanes. */
export const CUBE_REACH = 1 + Math.SQRT2;
/** PERF-SHADOW1: the reach CUBE_REACH grants a sphere of radius r past the far. AUDIT 637 B6: a radius below zero - a
 *  sphere the planes take only well inside them - reaches far + r along a face's axis, which is the farther of its far
 *  plane's bound and its sides' (r (1 + sqrt 2) is the nearer for a negative r). One home for the cube's reach: the
 *  sphere walk and a placed batch's quads (_candidateQuads) both take it. */
export const cubeReach = (r) => (r > 0 ? r * CUBE_REACH : r);
/** AUDIT 637 B1: the far plane's float32 rounding, per world unit of far and of the light's place. A face's far plane is
 *  row 3 less row 2 of its float32 view-projection (frustumPlanes): two entries near 1 whose difference is the plane's
 *  normal, 2 near / (far - near). spherePlanes divides by that normal, so a rounding of an entry (2^-24) moves the
 *  plane by (far - near) / (2 near) of it - at the far plane, and over the light's own place. Three such roundings
 *  (the product's, the subtraction's, the normal's) and a margin: 4 x 2^-24 / near. */
export const CUBE_F32_FAR = (4 * 2 ** -24) / SHADOW_POINT_NEAR;
/** PERF-SHADOW1: the slack the cube keeps over that bound - the faces' planes are float32 and the light is a world
 *  place, so a margin over the rounding of both (a pre-pass that is ever the narrower test would drop a draw). Measured
 *  with the real planes: past the exact bound by up to 1.3e-3 for a lantern 30 km from the origin.
 *  AUDIT 637 B1: that was the side planes', for fars to 36 - the far plane's grows with far x (far + the place)
 *  (CUBE_F32_FAR): 2.75e-3 past the bound for a lantern of far 96 at the origin, where this gave 2e-3, and the pre-pass
 *  dropped a draw a face made. Lights reach to SHADOW_CASTER_MAX_RANGE. */
export const cubeSlack = (px, py, pz, far) => {
  const s = Math.abs(px) + Math.abs(py) + Math.abs(pz) + far;
  return 1e-3 + 1e-5 * s + CUBE_F32_FAR * far * s;
};
/** PERF-SHADOW1: can a sphere [x, y, z, r] reach the cube of lantern `k` in `lim` (x, y, z, far, slack a lantern)? A
 *  NaN anywhere answers yes, as the faces' sphereInPlanes does (a NaN in any term of a plane's sum compares false, so
 *  no plane culls it): Math.max carries a NaN on any axis into the one compare, where a test axis by axis would cull
 *  a sphere NaN on one axis by another. AUDIT 637 B5: and so does a centre off at infinity - a face's plane meets it as
 *  0 x Infinity or Infinity - Infinity, a NaN, and culls nothing with that plane - so it is kept, as some face takes it. */
export const cubeKeeps = (lim, k, x, y, z, r) => {
  const o = k * 5, R = lim[o + 3] + cubeReach(r) + lim[o + 4];
  const d = Math.max(Math.abs(x - lim[o]), Math.abs(y - lim[o + 1]), Math.abs(z - lim[o + 2]));
  return !(d > R) || d === Infinity;
};

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
    const meshCut = opts.build(opts.vs.mesh, DEPTH_CUT_FS);   // AUDIT BAY A12
    this.programs = {
      mesh: { p: mesh, proj: u(mesh, 'uProj'), view: u(mesh, 'uView'), model: u(mesh, 'uModel') },
      meshCut: { p: meshCut, proj: u(meshCut, 'uProj'), view: u(meshCut, 'uView'), model: u(meshCut, 'uModel'), cut: u(meshCut, 'uDissolveCut') },
      char: char ? { p: char, proj: u(char, 'uProj'), view: u(char, 'uView'), model: u(char, 'uModel') } : null,
      terrain: { p: terrain, proj: u(terrain, 'uProj'), view: u(terrain, 'uView'), model: u(terrain, 'uModel') },
      bb: {
        p: bb, proj: u(bb, 'uProj'), view: u(bb, 'uView'), right: u(bb, 'uRight'), up: u(bb, 'uUp'), origin: u(bb, 'uOrigin'),
        size: u(bb, 'uSize'), tex: u(bb, 'uTex'), flatWind: u(bb, 'uFlatWind'), sway: u(bb, 'uSway'),
        face: u(bb, 'uFacePoint'),   // DISC29-E: the lamp each flat turns to face, per vertex (renderer.js BB_VS)
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
    this._slotSelf = new Uint8Array(SHADOW_POINT_CASTERS);        // DISC24-C: the live layers carry the player's own card
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
    /** @type {Array<{kind:number, mesh:any, matrix:Float32Array, texRemap:any, surface:any, arrayTex:any, tilemapTex:any, tileSize:number, batches:any, flatWind:Float32Array, right:Float32Array, up:Float32Array, bounded:boolean, sphere:Float32Array, subSpheres:Float32Array, cellSpheres:Float32Array, dynamic:boolean, cut:number}>} */
    this.records = [];
    this.count = 0;
    this.recording = true;
    this.sunVP = SHADOW_CASCADES.map(() => new Float32Array(16));
    this.faceVP = [0, 1, 2, 3, 4, 5].map(() => new Float32Array(16));
    this.sunParams = new Float32Array(4);
    this.sunTexel = new Float32Array(4);   // EL7
    this.sunOrigin = new Float32Array(4);   // TV1: the eye the cascades were rendered about, w 1 once a sun map stands
    this.pointParams = new Float32Array(4 * SHADOW_POINT_CASTERS);   // EL5: one vec4 per caster
    this.shadowIndex = new Int32Array(SHADOW_POINT_CASTERS).fill(-1);
    this.casterOf = new Int32Array(SHADOW_CASTER_TABLE).fill(-1);   // EL8
    this.casters = 0;
    this.frameNo = 0;   // EL8: the cadence's clock
    this._slotLight = new Float32Array(4 * SHADOW_POINT_CASTERS).fill(NaN);   // EL8: the light each slot's layers were last drawn from
    this._sunVPNew = SHADOW_CASCADES.map(() => new Float32Array(16));
    this._sunDrawn = new Uint8Array(SHADOW_CASCADES.length);
    this._sunAnchor = new Float64Array([NaN, NaN, NaN]);   // LA-SHADOW1: the texel grid's snapped point (none yet)
    this._sunScaleK = 1;   // AUDIT DEEP R-3: the cascades' scale the maps were last drawn at
    this.kind = null;
    /** per-frame counts, for a probe */
    this.stats = { records: 0, sunDraws: 0, pointDraws: 0, culled: 0, cascadesDrawn: 0, facesDrawn: 0, staticFaces: 0, dynFaces: 0, blits: 0, cachedSlots: 0, loSlots: 0, loFaces: 0, selfLamps: 0 };   // SC1: the faces split, the blits, the slots served from the cache; DISC15: the lo tier's slots and faces
    // AUDIT 637 B7: `culled` counts what a replay's own tests culled. A lantern face walks its candidates alone (PERF-SHADOW1),
    // so what it cannot reach it never asks - and never counts: the perf meter's `culled` is the sun's, the air's and the
    // faces' own culls of what the cube kept, smaller than it read before the pre-pass for the same frame.
    this._planes = new Float32Array(24);   // EL5: the replay's frustum
    this._bSphere = new Float64Array(4);   // AUDIT 68 S16-batch-sphere-dup: batchSphere's scratch for the SC1 scans
    this._selfAt = new Float64Array(3);    // DISC29-E: where the player's own card stands this frame (_selfCardAt)
    this._selfCard = null;                 // AUDIT PRE-MERGE 0929 E2: the card, noted as recordBillboards meets it (cleared by discard)
    this._slotOfScratch = new Int32Array(SHADOW_POINT_CASTERS);   // SC1: rank -> slot
    this._heldCasters = new Float64Array(4 * SHADOW_POINT_CASTERS);   // DISC6: last frame's casters, by position (Float64: an exact copy of whatever the host sent, so the match by position holds)
    this._heldCasterN = 0;
    /** AUDIT FLICKER P2: the card's lamps last frame (x, y, z, _), by place, and this frame's as they are found */
    this._selfHeld = new Float64Array(4 * SHADOW_POINT_CASTERS); this._selfHeldN = 0;
    this._selfNext = new Float64Array(4 * SHADOW_POINT_CASTERS);
    this._slotTakenScratch = new Uint8Array(SHADOW_POINT_CASTERS);
    // PERF-EXT3: the static signatures' inputs and answers - (x, y, z, far) and (hash, count) per ranked caster, one
    // walk filling all of them (_staticSignatures); and one light's, for DISC15's lo tier (_staticSignature)
    this._sigCasters = new Float64Array(4 * SHADOW_POINT_CASTERS);
    this._sigOut = new Int32Array(2 * SHADOW_POINT_CASTERS);
    this._farOf = new Float64Array(SHADOW_POINT_CASTERS);   // LA-SHADOW4: each rank's far this frame
    this._sigOne = new Float64Array(4);
    this._sigOneOut = new Int32Array(2);
    // PERF-SHADOW1: each ranked lantern's candidates this frame (_casterCandidates) - the records that can reach its
    // cube (indices, in record order) and, of a billboard list, the flats that can (`bb`, a list a candidate) - with the
    // lanterns' (x, y, z, far, slack), per lantern the slot the record in hand holds in its list (-1: none yet), and
    // per lantern 1 while its lists hold a placed batch its quads have not been asked of (_candidateQuads)
    this._cands = Array.from({ length: SHADOW_POINT_CASTERS }, () => ({ n: 0, hw: 0, rec: new Int32Array(64), bb: [] }));   // AUDIT 637 B4: `hw` the most slots filled since discard
    this._candOf = new Array(SHADOW_POINT_CASTERS).fill(null);
    this._candLim = new Float64Array(5 * SHADOW_POINT_CASTERS);
    this._candOpen = new Int32Array(SHADOW_POINT_CASTERS);
    this._candQuads = new Uint8Array(SHADOW_POINT_CASTERS);
    this._candWalked = false;   // AUDIT 637 B3: this frame's walk made (render clears it; _candFor makes it on the first ask)
    this._sunPlanes = SHADOW_CASCADES.map(() => new Float32Array(24));   // SHADOW-REACH: the cascades' frusta, for the hosts' reach test
    this._sunPlanesFrame = -1;
    this._shiftGen = 0;                 // AUDIT SC1: the floating origin's generation (shiftOrigin)
    this._shiftNow = [0, 0, 0];         // ...and its cumulative offset now - AUDIT OW5 R4: each object keeps its own copy
                                        // (`_shAx`/`_shAy`/`_shAz`, doubles born NaN on a batch - PERF-EXT10's law), where
                                        // the pass kept one per generation for the session (a crossing every second or so
                                        // on an Overworld journey: thousands an hour, never let go)
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
        if (!taken[j] && samePlace(sl, j * 4, L, i * 4)) { slotOf[i] = j; taken[j] = 1; break; }   // AUDIT FLICKER P3
      }
    }
    for (let i = 0; i < n; i++) {
      if (slotOf[i] >= 0 || !ShadowPass._castsAt(L, f.carried, i)) continue;
      for (let j = 0; j < cap; j++) if (!taken[j]) { slotOf[i] = j; taken[j] = 1; break; }
    }
    for (let j = 0; j < cap; j++) if (!taken[j]) { sl[j * 4] = NaN; this._loBuilt[j] = 0; }   // a light gone: its slot is drawn afresh for the next
    let rebuilds = SHADOW_TUNING.steady ? SHADOW_LO_REBUILDS_STEADY : SHADOW_LO_REBUILDS;   // FLICKER-FIX: more per frame, never all at once (a door in a twenty-lamp room is a hitch)
    for (let i = 0; i < n; i++) {
      const j = slotOf[i];
      if (j < 0) continue;
      const o = j * 4;
      const pos = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]];
      const same = this._loBuilt[j] && sl[o] === pos[0] && sl[o + 1] === pos[1] && sl[o + 2] === pos[2];
      const far = same ? heldShadowFar(sl[o + 3], L[i * 4 + 3]) : shadowFarFor(L[i * 4 + 3]);   // LA-SHADOW4: held across the flicker
      const fresh = !same || sl[o + 3] !== far;
      let sig = null, draw = fresh;
      if (!fresh && rebuilds > 0) {
        sig = this._staticSignature(pos, far);
        if (this._loSlotSig[j * 2] !== sig[0] || this._loSlotSig[j * 2 + 1] !== sig[1]) { draw = true; rebuilds--; }
      }
      if (draw) {
        if (!sig) sig = this._staticSignature(pos, far);
        this._loSlotSig[j * 2] = sig[0]; this._loSlotSig[j * 2 + 1] = sig[1];
        pointFaceMatrices(pos, far, this.faceVP);
        for (let face = 0; face < 6; face++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, this._loFbos[j * 6 + face]);
          gl.viewport(0, 0, SHADOW_LO_SIZE, SHADOW_LO_SIZE);
          gl.clear(gl.DEPTH_BUFFER_BIT);
          this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_LO);   // DISC29-E: the still, and the flats animating in place
        }
        this.stats.loFaces += 6;
        this._loBuilt[j] = 1;
        sl[o] = pos[0]; sl[o + 1] = pos[1]; sl[o + 2] = pos[2]; sl[o + 3] = far;
      }
      this.stats.loSlots++;
      if (this.casterOf[i] === -1) this.casterOf[i] = casterWord(SHADOW_POINT_CASTERS + j, far);   // LA-SHADOW4: the map's far with it
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
        bounded: false, sphere: new Float32Array(4), subSpheres: new Float32Array(0), cellSpheres: new Float32Array(0), dynamic: false, cut: 0 };   // EL5: the world-space spheres, the record's and its sub-meshes'; LA-AUDIT A1: and its shadow cells'; SC1: moved since last frame
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
    const a = this._shiftNow;
    a[0] += offset[0]; a[1] += offset[1]; a[2] += offset[2];
    this._shiftGen++;
    this._sunDrawn.fill(0);   // AUDIT 68 S17-far-cascade-shift: the held far map and its matrix are the old origin's - drawn afresh next frame (EL8's never-drawn rule)
    this._sunAnchor[0] += offset[0]; this._sunAnchor[1] += offset[1]; this._sunAnchor[2] += offset[2];   // LA-SHADOW1: the same world point, so the grid does not move
    // AUDIT FLICKER P3: the lights KEPT by place follow too - DISC6's hold, SC1's sticky slots, DISC15's lo slots and the
    // card's pair (NaN, an empty slot, stays NaN) - so the crossing frame keeps its casters and its maps
    const move = (a, n) => { for (let k = 0; k < n; k++) { a[k * 4] += offset[0]; a[k * 4 + 1] += offset[1]; a[k * 4 + 2] += offset[2]; } };
    move(this._heldCasters, this._heldCasterN);
    move(this._selfHeld, this._selfHeldN);
    move(this._slotLight, this._slotLight.length >> 2);
    move(this._loSlotLight, this._loSlotLight.length >> 2);
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
      for (let j = 0; j + 3 < r.cellSpheres.length; j += 4) { r.cellSpheres[j] += offset[0]; r.cellSpheres[j + 1] += offset[1]; r.cellSpheres[j + 2] += offset[2]; }   // LA-AUDIT A1
    }
  }
  /** the offset from the origin an object last saw (its `_shA*`; never seen: the first) to the current one */
  _shiftDelta(o) {
    const to = this._shiftNow, d = this._shiftD;
    const seen = Number.isFinite(o._shAx);
    d[0] = to[0] - (seen ? o._shAx : 0); d[1] = to[1] - (seen ? o._shAy : 0); d[2] = to[2] - (seen ? o._shAz : 0);
    return d;
  }
  /** AUDIT OW5 R4: an object's own copy of the origin it has now seen - three doubles written in place, no allocation */
  _shiftSeen(o) {
    const n = this._shiftNow;
    o._shAx = n[0]; o._shAy = n[1]; o._shAz = n[2];
    o._shGen = this._shiftGen;
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
    if (!inst) { inst = o._shInst = []; this._shiftSeen(o); }
    else if (o._shGen !== this._shiftGen) {
      const d = this._shiftDelta(o);
      for (const s of inst) { s.m[12] += d[0]; s.m[13] += d[1]; s.m[14] += d[2]; }
      this._shiftSeen(o);
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
  /** AUDIT PRE-MERGE 0928 R1: its vertex generation (updateMeshVertices, a sail's bake; 0 before one) changed since the
   *  pass last saw it, now or within the hold - _moved's law for the mesh's own geometry; a first sight is still. */
  _reshaped(mesh) {
    const g = mesh._vertGen ?? 0;
    if (mesh._vertSeen === undefined) { mesh._vertSeen = g; return false; }
    if (mesh._vertSeen !== g) { mesh._vertSeen = g; mesh._vertMovedAt = this.frameNo; }
    return mesh._vertMovedAt !== undefined && this.frameNo - mesh._vertMovedAt < SHADOW_DYNAMIC_HOLD;
  }
  /** A solid's draw recorded for the maps - `cut` (AUDIT BAY A12) the share of it a fading ship's dissolve cuts
   *  (renderer.js setDissolve; 0 whole): drawn with DEPTH_CUT_FS, and never a cache's (a fading thing is no still one). */
  recordMesh(mesh, matrix, texRemap, cut = 0) {
    const r = this._rec(); if (!r) return;
    r.kind = REC_MESH; r.mesh = mesh; r.matrix.set(matrix); r.texRemap = texRemap;
    r.cut = cut;
    const moved = this._moved(mesh, matrix), reshaped = this._reshaped(mesh);   // AUDIT PRE-MERGE 0928 R1: both asked every record - each keeps its own memory
    r.dynamic = moved || reshaped || r.cut > 0;   // SC1
    // EL5: the spheres, in the world, once per record (a mesh without bounds is drawn by every replay)
    r.bounded = !!mesh.bounds;
    if (r.bounded) {
      const sc = matrixScale(matrix);   // PERF-EXT4: the matrix's scale once, for the mesh's sphere and every sub-mesh's
      transformSphereScaled(matrix, mesh.bounds, sc, r.sphere);
      const subs = mesh.subMeshes;
      if (r.subSpheres.length < subs.length * 4) r.subSpheres = new Float32Array(subs.length * 4);
      for (let i = 0; i < subs.length; i++) {
        const b = subs[i]._bounds;
        if (b) transformSphereScaled(matrix, b, sc, r.subSpheres, i * 4); else r.subSpheres[i * 4 + 3] = -1;   // -1: unbounded, always drawn
      }
      const cells = mesh.shadowCells;   // LA-AUDIT A1: a static batch's shadow cells, each measured at upload
      if (cells) {
        if (r.cellSpheres.length < cells.length * 4) r.cellSpheres = new Float32Array(cells.length * 4);
        for (let i = 0; i < cells.length; i++) transformSphereScaled(matrix, cells[i]._bounds, sc, r.cellSpheres, i * 4);
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
      if (b._shSeen === true && b._shGen !== this._shiftGen) { const d = this._shiftDelta(b); b._shOx += d[0]; b._shOy += d[1]; b._shOz += d[2]; }
      if (b._shGen !== this._shiftGen) this._shiftSeen(b);
      const placeChanged = b._shSeen === true && !(Math.abs(b._shOx - ox) <= SHADOW_STILL_EPS && Math.abs(b._shOy - oy) <= SHADOW_STILL_EPS && Math.abs(b._shOz - oz) <= SHADOW_STILL_EPS);
      const lookChanged = b._shSeen === true && !(b._shFrame === fr && b._shRec === rec && b._shFlip === flip);
      if (placeChanged || lookChanged) b._shMovedAt = this.frameNo;
      const moving = b._dyn === true || b.selfCard === true || (b._shMovedAt != null && this.frameNo - b._shMovedAt < SHADOW_DYNAMIC_HOLD);   // built dynamic, the player's own card (DISC24-C), moved now, or within the hold
      const dyn = moving || swaying;
      // DISC29-E: ANIMATING IN PLACE - a mover only because its silhouette changes where it stands (an idling mage, a
      // 211 prop): never built dynamic, never the player's card, never swaying. The lo tier keeps it (REPLAY_LO) - the
      // eight 512 maps redraw it as a mover, and a lamp that leaves them kept nothing of it, so its silhouette vanished
      // as the camera turned (worst in a Mages Guild: nine people a hall, half of them idling).
      // AUDIT PRE-MERGE 0929 E1: AND A FLAT THAT CANNOT WALK - its centre baked into its vertices, no origin. It was one
      // whose place had been still for the hold, which let in every flat an origin places: a dungeon foe, a peer, the
      // Warden, the moment they stood a second. The lo tier's maps are rebuilt two faces a frame, nearest the eye first,
      // so each time one of those walked on, the lamps outside the eight - the maps they read - kept its silhouette
      // where it had stood (a ghost on half the frames of a torchlit fight of six), and every stop and start rebuilt
      // every lo map in its reach. A flat an origin places stays the eight's, as it was before DISC29-E.
      const anim = moving && !swaying && b._dyn !== true && b.selfCard !== true && o == null;
      b._shSeen = true; b._shOx = ox; b._shOy = oy; b._shOz = oz; b._shFrame = fr; b._shRec = rec; b._shFlip = flip; b._shDyn = dyn; b._shSway = swaying && !moving; b._shAnim = anim;   // sway alone: the slow cadence
      if (dyn) anyDyn = true;
      if (b.selfCard === true) this._selfCard = b;   // AUDIT PRE-MERGE 0929 E2: met here, where every batch is met already
    }
    r.dynamic = anyDyn;   // the record carries a dynamic batch (the replay reads each batch's own word)
  }
  discard() {
    for (let i = 0; i < this.count; i++) { const r = this.records[i]; r.mesh = null; r.surface = null; r.batches = null; r.texRemap = null; }
    this.count = 0;
    this._selfCard = null;
    // AUDIT 637 B4: and the lanterns' candidate lists, as far as they were ever filled - a list holds batches, and one
    // kept past the frame kept a destroyed batch's placement grid (or a dungeon's, into the daylight) with it
    for (const c of this._cands) { for (let j = 0; j < c.hw; j++) { const l = c.bb[j]; if (l) l.length = 0; } c.n = 0; c.hw = 0; }
  }


  render(f) {
    const gl = this.gl;
    this.stats.records = this.count; this.stats.sunDraws = 0; this.stats.pointDraws = 0; this.stats.culled = 0;
    SHADOW_TUNING.steady = SHADOW_TUNING.override ?? !!getPref('steadyShadows');
    SHADOW_TUNING.debug = SHADOW_TUNING.debugForce ?? !!getPref('shadowDebug');   // FLICKER-FIX: the Shadow debug log chip (debugForce: the console's)
    // STEADY-BALANCE: the calmer eye is its OWN chip now (prefs 'calmEye', off by default), no longer ridden on Steady
    // shadows - at a third of the rate the eye took ten seconds to open into a dark room and held a candle's glare
    // as long; with the card's stacked silhouettes gone (SHADOW_SELF_LAMPS) there is little left for it to calm
    AIR_TUNING.calm = SHADOW_TUNING.calmForce ?? !!getPref('calmEye');
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
      // AUDIT DEEP R-3: the travel view's scale - a far map drawn at the other scale is never kept (EL8's every-other-frame)
      const k = f.cascadeScale > 1 ? f.cascadeScale : 1;
      if (k !== this._sunScaleK) { this._sunScaleK = k; this._sunDrawn.fill(0); }
      sunAnchorFor(f.eye, this._sunAnchor, f.lightDir, sunTexelWorld(SHADOW_CASCADES.length - 1, k));   // LA-SHADOW1; AUDIT FLICKER S2: on the grid it had
      sunCascadeMatrices(f.eye, f.lightDir, this._sunVPNew, this._sunAnchor, k);
      const ld = f.lightDir;
      const rl = Math.hypot(ld[2], ld[0]) || 1;
      this._right[0] = ld[2] / rl; this._right[1] = 0; this._right[2] = -ld[0] / rl;
      const last = SHADOW_CASCADES.length - 1;
      for (let c = 0; c < SHADOW_CASCADES.length; c++) {
        // EL8: the far cascade every other frame (its map keeps its matrix until it is drawn again); a cascade never drawn is drawn now
        if (c === last && this._sunDrawn[c] && !SHADOW_TUNING.steady && this.frameNo % SHADOW_FAR_CASCADE_EVERY !== 0) continue;
        this.sunVP[c].set(this._sunVPNew[c]);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sunFbos[c]);
        gl.viewport(0, 0, SHADOW_SUN_SIZE, SHADOW_SUN_SIZE);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        this.stats.sunDraws += this.replay(f, this.sunVP[c], null, false, SHADOW_CASCADE_MIN_RADIUS_TEXELS * sunTexelWorld(c, k), sunTexelWorld(c, k));   // F5: the small solids; WEEDS1: and the small SPRITES, which F5's sphere test cannot see casters skipped by the cascade's texel
        this._sunDrawn[c] = 1; this.stats.cascadesDrawn++;
      }
      for (let c = 0; c < SHADOW_CASCADES.length; c++) { this.sunParams[c] = SHADOW_CASCADES[c] * k; this.sunTexel[c] = sunTexelWorld(c, k); this._sunVPFlat.set(this.sunVP[c], c * 16); }
      this.sunParams[3] = 1;
      this.sunOrigin[0] = f.eye[0]; this.sunOrigin[1] = f.eye[1]; this.sunOrigin[2] = f.eye[2]; this.sunOrigin[3] = 1;   // TV1
    } else this._sunDrawn.fill(0);   // AUDIT 68 S17-far-cascade-shift: a returning sun never reuses a map drawn at another place and time
    // EL5: THE LANTERNS CAST TOO, sun or no sun - the nearest SHADOW_POINT_CASTERS
    // of them, each into its six layers; the replays are culled to the
    // lantern's range and the face's frustum, so a caster costs what it lights
    const selfAt = f.pointLights?.length ? this._selfCardAt(this._selfAt) : null;   // DISC29-E: the player's own card's place, or null (none drawn)
    const selfLamps = Math.max(0, Math.min(SHADOW_POINT_CASTERS, SHADOW_TUNING.selfLamps ?? SHADOW_SELF_LAMPS));   // STEADY-BALANCE
    const casters = reserveSelfCasters(pickShadowCasters(f.pointLights, f.eye, SHADOW_POINT_CASTERS, f.carried, this._heldCasters, this._heldCasterN),   // MAC-T1; LIGHT-NEAR1; DISC6: last frame's casters keep their maps on a tie
      f.pointLights, selfAt, selfLamps, SHADOW_POINT_CASTERS, f.carried, this._heldCasters, this._heldCasterN);   // AUDIT PRE-MERGE 0929 E3
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
        if (!taken[k] && samePlace(sl, k * 4, L, i * 4)) { slotOf[rank] = k; taken[k] = 1; break; }   // AUDIT FLICKER P3: within the still epsilon
      }
    }
    for (let rank = 0; rank < casters.length; rank++) {
      if (slotOf[rank] >= 0) continue;
      for (let k = 0; k < SHADOW_POINT_CASTERS; k++) if (!taken[k]) { slotOf[rank] = k; taken[k] = 1; break; }
    }
    // LA-SHADOW4: each rank's far - the one its slot's map was drawn to, held across the flicker, when the slot is its own
    const farOf = this._farOf;
    for (let rank = 0; rank < casters.length; rank++) {
      const i = casters[rank], o = slotOf[rank] * 4;
      const same = samePlace(sl, o, L, i * 4);   // AUDIT FLICKER P3
      farOf[rank] = same ? heldShadowFar(sl[o + 3], L[i * 4 + 3]) : shadowFarFor(L[i * 4 + 3]);
    }
    // PERF-SHADOW1: one walk, every lantern's six faces (_candFor). AUDIT 637 B3: made by the first lantern that walks
    // this frame - a face it draws, or its dynamic scan in a frame with a dynamic record - never up front: a still town
    // whose maps were all cached walked every record and flat against every lantern for lists nobody read (0.31 -> 0.78
    // ms a frame, twelve lanterns over 2,000 flats). And with no dynamic record in the frame no lantern's dynamic scan
    // can answer anything but none (each of its arms asks a record's `dynamic` first), so none is asked.
    this._candWalked = false;
    let anyDyn = false;
    for (let i = 0; i < this.count; i++) if (this.records[i].dynamic) { anyDyn = true; break; }
    if (this.cacheOn && casters.length) {
      // PERF-EXT3: every ranked caster's static signature in ONE walk, before the loop that reads them - with the
      // pos and the shadow's far the loop takes (below), so a signature is the one its own walk would have folded
      const cp = this._sigCasters;
      for (let rank = 0; rank < casters.length; rank++) {
        const i = casters[rank];
        cp[rank * 4] = L[i * 4]; cp[rank * 4 + 1] = L[i * 4 + 1]; cp[rank * 4 + 2] = L[i * 4 + 2]; cp[rank * 4 + 3] = farOf[rank];
      }
      this._staticSignatures(cp, casters.length, this._sigOut, !f.everyLight);   // the review: a room drawn whole by the sphere
    }
    let selfN = 0;   // AUDIT FLICKER P2: the card's lamps this frame, held for the next
    for (let rank = 0; rank < casters.length; rank++) {
      const i = casters[rank], k = slotOf[rank];
      const pos = [L[i * 4], L[i * 4 + 1], L[i * 4 + 2]];
      // PERF-FLICKER: the SHADOW's far, not the lantern's live one - the
      // flicker must not count as "this light changed" and rebuild six
      // faces. Everything below takes this value (the face matrices, the
      // change test and pointParams), so the map and the shader agree.
      // LA-SHADOW4: held across the flicker (farOf, above).
      const far = farOf[rank];
      // EL8: the slot's layers are drawn again when its light changed (position or range), every frame for the nearest lights, every third otherwise
      const o = k * 4;
      const changed = !(samePlace(sl, o, pos, 0) && sl[o + 3] === far);   // AUDIT FLICKER P3: a floating-origin shift is no change
      const near = nearestRank(casters, L, f.eye, rank) < SHADOW_NEAR_CASTERS;   // SC1: by the light's RANK - the nearest two, whatever slot they hold; AUDIT DISC7 C6: its TRUE rank, not the keep margin's
      // DISC24-C: the player's own card casts only into a map redrawn EVERY frame (see SELF CARD above replay), and a
      // slot whose live layers disagree with that is redrawn now - never left holding the card a frame after its rank
      // fell (a rise is `due` already).
      // DISC29-E: ...into the two lamps nearest THE CARD, not the eye. In third person the eye circles the player, so a
      // camera turning round a player standing still moved the silhouette from lamp to lamp (twice in half a turn in
      // the Daggerfall Mages Guild); the card's own place moves only when the player does. Those lamps are redrawn
      // every frame too (`due`); the eye's two keep the cadence they had.
      // AUDIT FLICKER P2: with DISC6's hold - last frame's two by place, at the keep ratio. In first person the card stands
      // a pace before the eye and circles the feet as the player turns, so turning in place hopped the player's
      // shadow from lamp to lamp (a hall of ten lamps: 506 hops over 833 spots in one turn each, two on successive frames)
      // STEADY-BALANCE: the card's own lamps (SHADOW_SELF_LAMPS, two) steady or not - FLICKER-FIX's every lamp stacked a
      // silhouette per lamp behind the player at the crosshair; `due` below still redraws them every frame
      const selfNear = selfAt ? (nearestRank(casters, L, selfAt, rank, this._selfHeld, this._selfHeldN) < selfLamps) : near;
      if (selfAt && selfNear && selfN < SHADOW_POINT_CASTERS) { this._selfNext[selfN * 4] = pos[0]; this._selfNext[selfN * 4 + 1] = pos[1]; this._selfNext[selfN * 4 + 2] = pos[2]; selfN++; }
      const selfWant = selfNear ? 1 : 0;
      const selfMoved = this._slotSelf[k] !== selfWant;
      const due = SHADOW_TUNING.steady || near || selfNear || (this.frameNo + k) % SHADOW_FAR_CASTER_EVERY === 0;
      if (!this.cacheOn) {
        // the old path whole: every caster in range, static or not, into the live layers at the cadence
        if (changed || due || selfMoved) {
          const cand = this._candFor(rank, L, casters, farOf);   // PERF-SHADOW1: this lantern's candidates (null: its faces walk everything)
          if (cand) this._candidateQuads(rank);   // PERF-SHADOW1: the quads asked by a lantern that draws, once a frame
          pointFaceMatrices(pos, far, this.faceVP);
          for (let face = 0; face < 6; face++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFbos[k * 6 + face]);
            gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_ALL, selfNear, cand);
          }
          this.stats.facesDrawn += 6;
          this._slotSelf[k] = selfWant;
        }
        this._slotCached[k] = 0; this._slotLiveDyn[k] = 0;
      } else {
        // SC1: the static cache, drawn only when the light or the static set in its reach changed
        const sigHash = this._sigOut[rank * 2], sigCount = this._sigOut[rank * 2 + 1];   // PERF-EXT3: folded above
        const staticStale = changed || !this._slotCached[k] || this._slotSig[k * 2] !== sigHash || this._slotSig[k * 2 + 1] !== sigCount;
        let matrices = false;
        if (staticStale) {
          const cand = this._candFor(rank, L, casters, farOf);
          if (cand) this._candidateQuads(rank);   // PERF-SHADOW1
          pointFaceMatrices(pos, far, this.faceVP); matrices = true;
          for (let face = 0; face < 6; face++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.cacheFbos[k * 6 + face]);
            gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
            gl.clear(gl.DEPTH_BUFFER_BIT);
            this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_STATIC, true, cand);
          }
          this.stats.facesDrawn += 6; this.stats.staticFaces += 6;
          this._slotCached[k] = 1; this._slotSig[k * 2] = sigHash; this._slotSig[k * 2 + 1] = sigCount;
        } else this.stats.cachedSlots++;
        // the dynamics on top: the cache blitted into the live layers, then the moving casters alone, at the cadence
        const dynNear = anyDyn ? this._dynamicNear(pos, far, f.isSpectral, selfNear, this._candFor(rank, L, casters, farOf)) : DYN_NONE;   // 0 none, 1 sway alone, 2 a mover
        const dueDyn = dynNear === DYN_SWAY ? (SHADOW_TUNING.steady || (this.frameNo + k) % SHADOW_SWAY_EVERY === 0) : due;   // AUDIT REACH: a swaying wood redraws on the sway's own cadence
        if (dynNear && (dueDyn || staticStale || !this._slotLiveDyn[k] || selfMoved)) {
          const cand = this._candFor(rank, L, casters, farOf);
          if (cand) this._candidateQuads(rank);   // PERF-SHADOW1 (a no-op when the static faces asked it above)
          this._blitSlot(k);
          if (!matrices) pointFaceMatrices(pos, far, this.faceVP);
          for (let face = 0; face < 6; face++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pointFbos[k * 6 + face]);
            gl.viewport(0, 0, SHADOW_POINT_SIZE, SHADOW_POINT_SIZE);
            this.stats.pointDraws += this.replay(f, this.faceVP[face], pos, false, 0, 0, REPLAY_DYNAMIC, selfNear, cand);
          }
          this.stats.facesDrawn += 6; this.stats.dynFaces += 6;
          this._slotLiveDyn[k] = 1; this._slotSelf[k] = selfWant;
        } else if (staticStale || (!dynNear && this._slotLiveDyn[k])) {
          // a fresh cache, or the last walker gone: the live layers are the cache again
          this._blitSlot(k);
          this._slotLiveDyn[k] = 0; this._slotSelf[k] = 0;
        }
      }
      sl[o] = pos[0]; sl[o + 1] = pos[1]; sl[o + 2] = pos[2]; sl[o + 3] = far;
      this.pointParams[k * 4] = pos[0]; this.pointParams[k * 4 + 1] = pos[1]; this.pointParams[k * 4 + 2] = pos[2]; this.pointParams[k * 4 + 3] = far;
      this.shadowIndex[k] = i;
      if (i < SHADOW_CASTER_TABLE) this.casterOf[i] = k;
    }
    for (let k = 0; k < SHADOW_POINT_CASTERS; k++) if (!taken[k]) { this._slotLight[k * 4] = NaN; this._slotCached[k] = 0; this._slotLiveDyn[k] = 0; this._slotSelf[k] = 0; }   // an emptied slot is drawn afresh when it is filled
    this._selfHeld.set(this._selfNext); this._selfHeldN = selfN;   // AUDIT FLICKER P2
    this.stats.selfLamps = selfN;   // STEADY-BALANCE: how many lamps the card cast into, for the debug log
    if (f.everyLight) this._renderLo(f, L);   // DISC15: a room drawn whole - every other light reads its lo map
    this.casters = casters.length;
    if (SHADOW_TUNING.debug) this._debugLog(f, L, casters);   // FLICKER-FIX: __DF_SHADOW_TUNING.debugForce = true
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.colorMask(true, true, true, true);
    gl.enable(gl.CULL_FACE);
  }

  /** FLICKER-FIX: the debug log. With `__DF_SHADOW_TUNING.debugForce = true` the console says, on every frame where the
   *  shadow set CHANGED, what changed: which lamps gained or lost a full shadow map (by place), how many lamps fell back
   *  to the lo map, and what was redrawn. A flicker that lines up with these lines is a slot swap; one that does not
   *  is something else (the shader, the exposure). */
  _debugLog(f, L, casters) {
    const key = (i) => `${L[i * 4].toFixed(1)},${L[i * 4 + 1].toFixed(1)},${L[i * 4 + 2].toFixed(1)}`;
    const now = new Set(casters.map(key));
    const prev = this._dbgSet ?? new Set();
    const gained = [...now].filter((k) => !prev.has(k)), lost = [...prev].filter((k) => !now.has(k));
    const st = this.stats;
    if (gained.length || lost.length || st.staticFaces > 0 || st.loFaces > 0) {
      console.log(`[shadow] f${this.frameNo} steady=${SHADOW_TUNING.steady} casters=${casters.length} lights=${L.length >> 2}`
        + ` +${gained.join(' | ') || '-'} -${lost.join(' | ') || '-'} staticFaces=${st.staticFaces} dynFaces=${st.dynFaces} loFaces=${st.loFaces} cascades=${st.cascadesDrawn}`
        + ` selfLamps=${st.selfLamps} calmEye=${AIR_TUNING.calm}`);   // STEADY-BALANCE
    }
    this._dbgSet = now;
  }
  /** SC1: the static signature of a lantern's reach - every static record (and static batch) whose sphere touches
   *  the light's, folded by identity and position, order-free. An unbounded record touches everything.
   *
   *  PERF-EXT3 (2026-09-25, the players' "fps issues in the exterior but fine in the interior"): EVERY CASTER'S IN ONE
   *  WALK. The rank loop asked this once a caster, and each ask walked every record and every batch of the frame -
   *  the filter chain, the archive Set, batchSphere, the touch, the fold - even when every cache was valid and nothing
   *  was drawn: eight lanterns in a town at night were eight whole walks a frame, 0.2 ms of the harness town's frame
   *  (the cpu lens's `townFrame.mjs --night`; 0.74 ms before PERF-EXT10's one shape). Now each item is filtered and
   *  its sphere taken ONCE, then tested against each of the `nC` casters in `cp` (x, y, z, far), and folded into
   *  that caster's (hash, count) in `out` on a touch - the same items into the same folds, so the same answers:
   *  foldSignature is a sum, blind to the order, and nothing here is read that the replays between two ranks could
   *  change. An item's id is minted on its first touch of ANY caster, item by item where the walks minted caster by
   *  caster; an id is a name, held for the item's life, and a cache compares only its own last answer.
   *
   *  PERF-EXT (2026-09-25, the review of the shadows): `quads` - a pixel-wide batch asked by its QUADS (PERF-EXT1), or
   *  by its sphere alone as the base asked. A ROOM DRAWN WHOLE (DISC15's everyLightCasts, `f.everyLight`) asks by the
   *  sphere: there the host culls nothing by view and streams nothing, so a room's static set moves only when a thing
   *  in it does, and the quads could only spare a rebuild on that rare frame - while DISC15's lo tier asks EVERY lamp
   *  EVERY frame (a still room never spends SHADOW_LO_REBUILDS), and PERF-EXT1's first cut paid a cube query a lamp a
   *  batch for it: the reviewer's 40-lamp room, 40 batches of six flats, 0.240 -> 0.558 ms of beginFrame a frame - in
   *  the half of "fps issues in the exterior but fine in the interior" that was fine. By the sphere a signature folds a SUPERSET of what the quads fold, so a
   *  cache it keeps is never stale - a change of what a face draws is a change of the superset - and at worst it
   *  rebuilds for a flat that draws nothing into it, as the base did. A cache compares only its own last answer, so
   *  the question changing at a door is one rebuild, on the frame every cache rebuilds for the room's new records. */
  _staticSignatures(cp, nC, out, quads, anim = false) {
    for (let k = 0; k < nC; k++) { out[k * 2] = 0; out[k * 2 + 1] = 0; }
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind === REC_BB) {
        const wl = Math.hypot(r.flatWind[0], r.flatWind[1]);
        for (const b of r.batches) {
          if (!b?.vao || b._dead || (b._shDyn && !(anim && b._shAnim)) || b.noShadow || b.conceal || b.archive === SHADOW_LIGHT_FLATS || SHADOW_NO_CAST_ARCHIVES.has(b.archive)) continue;   // DISC29-E: `anim` - the lo tier's walk folds a flat animating in place too, by its id and place (a new frame is no rebuild)
          const c = batchSphere(b, this._bSphere);   // AUDIT 68 S16-batch-sphere-dup: the replays' own sphere
          let id = 0, at = 0, rad = -1;
          for (let k = 0; k < nC; k++) {
            const x = cp[k * 4], y = cp[k * 4 + 1], z = cp[k * 4 + 2], far = cp[k * 4 + 3];
            if (c && !spheresTouch(c[0], c[1], c[2], c[3], x, y, z, far)) continue;
            // PERF-EXT1: ...and a pixel-wide batch by its QUADS, in the cube its six faces tile. One with none in it puts
            // nothing in this cache, so whatever it does is no reason to rebuild it.
            if (quads && b._place) { if (rad < 0) rad = quadRadius(wl, b); if (!placementsInCube(b, rad, x, y, z, far)) continue; }
            if (id === 0) { id = shId(b); at = Math.round(b._shOx * 64) + Math.round(b._shOz * 64) * 7919; }
            out[k * 2] = foldSignature(foldSignature(out[k * 2], id), at); out[k * 2 + 1]++;
          }
        }
        continue;
      }
      if (r.dynamic) continue;
      const m = r.kind === REC_TERRAIN ? r.surface : r.mesh;
      if (!m?.vao || m._dead) continue;
      let id = 0, at = 0;
      for (let k = 0; k < nC; k++) {
        if (r.bounded && !spheresTouch(r.sphere[0], r.sphere[1], r.sphere[2], r.sphere[3], cp[k * 4], cp[k * 4 + 1], cp[k * 4 + 2], cp[k * 4 + 3])) continue;
        if (id === 0) { id = shId(m); at = Math.round(r.matrix[12] * 64) + Math.round(r.matrix[14] * 64) * 7919 + Math.round(r.matrix[13] * 64) * 104729; }
        out[k * 2] = foldSignature(foldSignature(out[k * 2], id), at); out[k * 2 + 1]++;
      }
    }
  }
  /** DISC15: one light's signature, (hash, count), for the lo tier - which asks light by light, EVERY light that is
   *  not fresh every frame while SHADOW_LO_REBUILDS lasts, and a still room never spends it (the review); the walk is
   *  _staticSignatures', by the sphere alone, because the lo tier runs only in a room drawn whole. */
  _staticSignature(pos, far) {
    const cp = this._sigOne;
    cp[0] = pos[0]; cp[1] = pos[1]; cp[2] = pos[2]; cp[3] = far;
    this._staticSignatures(cp, 1, this._sigOneOut, false, true);   // DISC29-E: with the flats animating in place, as REPLAY_LO draws them
    return this._sigOneOut;
  }
  /** DISC29-E: where the player's own card (DISC24-C's SELF CARD) stands this frame - its sphere's centre into `out` -
   *  or null when none is drawn. The lamps it casts into are ranked from here.
   *  AUDIT PRE-MERGE 0929 E2: the card recordBillboards met this frame - this walked every batch of every record, every
   *  frame, lamp or none (5.7 us of the pass's 7.6 over two thousand batches), for the one it had already passed. */
  _selfCardAt(out) {
    const b = this._selfCard;
    if (!b || !b.vao || b._dead || b.conceal) return null;
    const c = batchSphere(b, this._bSphere);
    if (!c) return null;
    out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    return out;
  }
  /**
   * PERF-SHADOW1 (2026-10-06, Mac: "I wanna look into how we can continue to improve performance, including for
   * online"): A LANTERN'S SIX FACES SHARE ONE WALK. Every face replay walked every record and every flat of the frame -
   * the filter chain, batchSphere, the planes, and a pixel-wide wood's placements - and so did _dynamicNear, once a
   * lantern: under Steady shadows (FLICKER-FIX, on by default) every lantern with a mover or a swaying tree near it
   * redraws its six dynamic faces EVERY frame, so a windy town of twelve lanterns walked the whole record list some
   * eighty times a frame to draw what stood within a few metres of each (measured in the real game, Knightstale at
   * 15:00 on this container's CPU: the shadow pass 7.2 ms of the world host's 16.1 ms of JavaScript a frame, 5.3 of it
   * the replays and the dynamic scans).
   *
   * Now ONE walk a frame finds, for every ranked lantern, the records - and of a billboard list the flats - whose
   * sphere CAN reach its cube: a sphere taken by none of the six faces is past far + r (1 + sqrt 2) on some axis
   * (CUBE_REACH). A lantern about to draw then asks its placed batches of their quads, once (_candidateQuads). The
   * faces and _dynamicNear walk only the candidates, in the records' own order, and each still asks every question it
   * asked before - so a face draws exactly what it drew: the candidates are a superset of what any face takes, nothing
   * else is skipped, and the order of what is drawn is the order it was drawn in. The walk reads no batch's placements
   * (the PERF-EXT review: a still room drawn whole asks none a frame). A lantern whose place or far is not a finite
   * number gets no candidates (null: its faces walk everything, as before), and neither does a pass with
   * SHADOW_TUNING.facePrepass false. Fills this._candOf[rank] for each ranked caster and answers it.
   * @param {ArrayLike<number>} L @param {ArrayLike<number>} casters @param {ArrayLike<number>} farOf
   */
  _casterCandidates(L, casters, farOf) {
    this._candWalked = true;
    const out = this._candOf, lim = this._candLim, open = this._candOpen, quads = this._candQuads;
    const nC = casters.length;
    let live = 0;
    for (let k = 0; k < nC; k++) {
      const i = casters[k], x = L[i * 4], y = L[i * 4 + 1], z = L[i * 4 + 2], far = farOf[k];
      const o = k * 5;
      lim[o] = x; lim[o + 1] = y; lim[o + 2] = z; lim[o + 3] = far; lim[o + 4] = cubeSlack(x, y, z, far);
      const ok = SHADOW_TUNING.facePrepass !== false && Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) && Number.isFinite(far);
      out[k] = ok ? this._cands[k] : null;
      quads[k] = 0;
      if (ok) { this._cands[k].n = 0; live++; }
    }
    for (let k = nC; k < out.length; k++) out[k] = null;
    if (!live) return out;
    const add = (k, i) => {
      const c = out[k];
      if (c.n === c.rec.length) { const g = new Int32Array(c.rec.length * 2); g.set(c.rec); c.rec = g; }
      c.rec[c.n] = i;
      return c.n++;
    };
    const sp = this._bSphere;
    for (let i = 0; i < this.count; i++) {
      const r = this.records[i];
      if (r.kind !== REC_BB) {
        const sx = r.sphere[0], sy = r.sphere[1], sz = r.sphere[2], sr = r.sphere[3];
        for (let k = 0; k < nC; k++) if (out[k] && (!r.bounded || cubeKeeps(lim, k, sx, sy, sz, sr))) add(k, i);
        continue;
      }
      for (let k = 0; k < nC; k++) open[k] = -1;
      for (const b of r.batches) {
        if (!b) continue;   // the replay's first question drops it too
        const c = batchSphere(b, sp);   // none: every face takes it (and one with a NaN in it cubeKeeps keeps)
        for (let k = 0; k < nC; k++) {
          if (!out[k] || (c && !cubeKeeps(lim, k, c[0], c[1], c[2], c[3]))) continue;
          if (b._place) quads[k] = 1;   // its quads asked if this lantern draws (_candidateQuads)
          let j = open[k];
          if (j < 0) { j = add(k, i); open[k] = j; const bb = out[k].bb; if (bb[j]) bb[j].length = 0; else bb[j] = []; }
          out[k].bb[j].push(b);
        }
      }
    }
    for (let k = 0; k < nC; k++) { const c = out[k]; if (c && c.n > c.hw) c.hw = c.n; }   // AUDIT 637 B4: as far as discard() must empty
    return out;
  }
  /** AUDIT 637 B3: lantern `rank`'s candidates - the walk (_casterCandidates) made by the first lantern that asks this
   *  frame, for all of them; null when its faces walk everything. */
  _candFor(rank, L, casters, farOf) {
    if (!this._candWalked) this._casterCandidates(L, casters, farOf);
    return this._candOf[rank];
  }
  /**
   * PERF-SHADOW1: a lantern's placed batches asked of their QUADS - once a frame, and only by a lantern about to draw
   * a face. A placed batch (PERF-EXT1's pixel-wide wood) passes the sphere walk for every lantern in its pixel; one of
   * whose quads (radius `rad`) none stands within far + cubeReach(rad) of the light on every axis - placementsInCube's
   * own box (far + rad) grown to the cube's reach and the slack - is taken by no face, and leaves this lantern's lists (a
   * record left with no flat leaves them too, its order kept). One whose sphere or radius is not a number stays, as no
   * face's planes cull it. A lantern that draws nothing this frame asks nothing (a still room drawn whole reads no
   * placement), and one whose lists hold no placed batch has nothing to ask.
   * @param {number} rank
   */
  _candidateQuads(rank) {
    const cand = this._candOf[rank];
    if (!cand || !this._candQuads[rank]) return;
    this._candQuads[rank] = 0;
    const lim = this._candLim, o = rank * 5, sp = this._bSphere;
    const rec = cand.rec, bb = cand.bb;
    let w = 0;
    for (let j = 0; j < cand.n; j++) {
      const r = this.records[rec[j]];
      if (r.kind === REC_BB) {
        const list = bb[j];
        const wl = Math.hypot(r.flatWind[0], r.flatWind[1]);   // the record's wind, for its quads' lean (quadRadius)
        let m = 0;
        for (let t = 0; t < list.length; t++) {
          const b = list[t];
          if (b._place) {
            const c = batchSphere(b, sp);
            if (c && c[0] === c[0] && c[1] === c[1] && c[2] === c[2] && c[3] === c[3]) {
              const rad = quadRadius(wl, b);
              if (rad === rad && !placementsInCube(b, rad, lim[o], lim[o + 1], lim[o + 2], lim[o + 3] + cubeReach(rad) - rad + lim[o + 4])) continue;   // AUDIT 637: the cube's own reach (placementsInCube adds the radius itself)
            }
          }
          list[m++] = b;
        }
        list.length = m;
        if (m === 0) continue;
      }
      if (w !== j) { rec[w] = rec[j]; const t = bb[w]; bb[w] = bb[j]; bb[j] = t; }   // a swap: every slot keeps a list of its own
      w++;
    }
    cand.n = w;
  }
  /** SC1: is any dynamic caster in the lantern's reach.
   *  AUDIT SC1: a dynamic the replay would not DRAW is no reason to replay - the first cut counted a moving flame
   *  (SHADOW_LIGHT_FLATS), a no-cast archive, a flat under SHADOW_FLAT_MIN_HEIGHT and a ghost, and paid the blit and six
   *  faces at the cadence to draw nothing; the skips are the replay's own (its point-light arm, texel 0). */
  _dynamicNear(pos, far, isSpectral, self = true, cand = null) {
    let near = DYN_NONE;   // AUDIT REACH: a swaying flat alone is DYN_SWAY - the slow cadence; any mover is DYN_MOVER
    // PERF-SHADOW1: the lantern's candidates when it has them - a superset of every item this scan takes (a sphere
    // touching the far sphere is inside the grown cube, a quad in placementsInCube's cube is in the grown one), and
    // the answer is the set's (a mover anywhere in it, else a sway), whatever order it is met in
    const nRec = cand ? cand.n : this.count;
    for (let j = 0; j < nRec; j++) {
      const r = this.records[cand ? cand.rec[j] : j];
      if (r.kind === REC_BB) {
        if (!r.dynamic) continue;
        const wl = Math.hypot(r.flatWind[0], r.flatWind[1]);
        for (const b of (cand ? cand.bb[j] : r.batches)) {
          if (!b?._shDyn || !b.vao || b._dead || b.noShadow || b.conceal) continue;
          if (b.selfCard && !self) continue;   // DISC24-C: the player's own card is no reason to redraw a map it will not be drawn into
          if (b.archive === SHADOW_LIGHT_FLATS || SHADOW_NO_CAST_ARCHIVES.has(b.archive) || (b.size && b.size.h < SHADOW_FLAT_MIN_HEIGHT) || isSpectral(b.archive)) continue;
          if (b._shSway && near === DYN_SWAY) continue;
          const c = batchSphere(b, this._bSphere);   // AUDIT 68 S16-batch-sphere-dup
          if (c && !spheresTouch(c[0], c[1], c[2], c[3], pos[0], pos[1], pos[2], far)) continue;
          // PERF-EXT1: a pixel-wide wood's sphere touches every lantern in its pixel, so it held every one on the sway's
          // beat (six faces blitted and replayed every fourth frame) - asked of its trees, it holds only a lantern
          // one of them stands by. The CUBE, not the far sphere: a face draws into its corners (pins: a quad at
          // 22.3 of a 20 far, 17 along +X, still redraws the slot).
          if (b._place && !placementsInCube(b, quadRadius(wl, b), pos[0], pos[1], pos[2], far)) continue;
          if (!b._shSway) return DYN_MOVER;
          near = DYN_SWAY;
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

  /**
   * DISC24-C (icebreyker on Discord, 2026-09-24, "Lights/shadows are still bugged": "i am still getting this problem
   * with Enhanced Lighting" - the flicker of DISC13-A, in a lit interior, the player's whole silhouette thrown on the
   * wall): THE SELF CARD. The player's own sprite body (player/eotbBody.js - "Shadows Only" in first person, the body
   * itself in third) is the one caster that moves WITH the view, and three of the lamps' laws were wrong for it:
   *  - it was judged still whenever the player stopped (the origin test above), so a pause baked it into the static
   *    cache of every lamp in reach and the next step or turn threw it out again - every cache rebuilt at once and its
   *    shadow jumped between two cadences. It is always a mover now (recordBillboards).
   *  - a lamp past the nearest SHADOW_NEAR_CASTERS redraws every third frame, so there the silhouette trailed the
   *    player by up to two frames and caught up in a jerk - the flicker. It casts only into a map redrawn EVERY frame
   *    (`self`), and a slot is redrawn the frame that changes.
   *  - it was turned to FACE each lamp, which the mod's card never does: Unity renders a ShadowsOnly renderer's shadow
   *    in its own transform (the billboard's turn to the camera - Eye_Of_The_Beholder.il IL_4e42 sets
   *    shadowCastingMode 2), so walking round a lamp swung the silhouette through a half turn. It casts in the basis it
   *    was drawn with.
   */
  replay(f, vp, lightPos, recordBasis = false, minRadius = 0, texel = 0, filter = REPLAY_ALL, self = true, cand = null) {
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
    // PERF-SHADOW1: a lantern's face walks its candidates (_casterCandidates) - every record, and every flat of a list,
    // that this face could take, in their own order - and asks each the questions below exactly as before
    const nRec = cand ? cand.n : this.count;
    for (let j = 0; j < nRec; j++) {
      const r = this.records[cand ? cand.rec[j] : j];
      if (filter !== REPLAY_ALL && r.kind !== REC_BB && (filter === REPLAY_STATIC || filter === REPLAY_LO) === r.dynamic) continue;   // SC1: the static replay skips the movers, the dynamic one the still (DISC29-E: the lo tier's is a static one)
      if (r.kind !== REC_BB && !recordVisible(planes, r)) { this.stats.culled++; continue; }
      if (minRadius > 0 && r.kind !== REC_BB && r.kind !== REC_CHAR && r.bounded && r.sphere && r.sphere[3] < minRadius) { this.stats.culled++; continue; }   // F5: a small solid or terrain piece; a rig is a person
      if (r.kind === REC_MESH) {
        const mesh = r.mesh;
        if (!mesh?.vao || mesh._dead || !mesh.subMeshes?.length) continue;
        let vaoBound = false;
        // LA-AUDIT A1: a static batch with shadow cells replays its cells, not its sub-meshes - the same triangles in
        // the cells' own buffer (staticBatch.js shadowCells), each culled by its own sphere
        const cells = r.bounded ? mesh.shadowCells : null;
        const subs = cells ?? mesh.subMeshes;
        const vao = cells ? mesh.shadowVao : mesh.vao;
        // PERF-EXT2 (2026-09-25, the players' "fps issues in the exterior
        // but fine in the interior"): A RUN OF SUB-MESHES IS ONE DEPTH DRAW.
        // PERF4's static batch is one sub-mesh per texture, laid end to end
        // from index 0 (StaticBatchBuilder.finish), each spanning the whole
        // pixel - so nearly all of them pass every cascade and face, and a
        // replay drew a 40-texture city pixel as 40 draws. One draw per
        // texture is the LIT pass's minimum; a depth replay binds nothing
        // between two sub-meshes (DEPTH_FS reads nothing, the model and the
        // VAO are the record's), so a run of visible sub-meshes whose ranges
        // meet is the same triangles in one drawElements, and depth is a
        // per-texel minimum that no draw order can change. A culled one
        // breaks the run by itself: the next visible starts past runEnd.
        let runAt = -1, runEnd = -1;
        for (let k = 0; k < subs.length; k++) {
          if (cells ? !sphereInPlanes(planes, r.cellSpheres[k * 4], r.cellSpheres[k * 4 + 1], r.cellSpheres[k * 4 + 2], r.cellSpheres[k * 4 + 3]) : !subMeshVisible(planes, r, k)) { this.stats.culled++; continue; }
          if (!vaoBound) {
            const prog = r.cut > 0 ? P.meshCut : P.mesh;   // AUDIT BAY A12: a fading ship's share of her depth
            use(prog); gl.uniformMatrix4fv(prog.model, false, r.matrix);
            if (r.cut > 0) gl.uniform1f(prog.cut, r.cut);
            f.bindVao(vao); vaoBound = true;
          }
          const sm = subs[k], n = sm.primitiveCount * 3;
          if (sm.startIndex === runEnd) { runEnd += n; continue; }
          if (runAt >= 0) { gl.drawElements(gl.TRIANGLES, runEnd - runAt, gl.UNSIGNED_INT, runAt * 4); draws++; }
          runAt = sm.startIndex; runEnd = runAt + n;
        }
        if (runAt >= 0) { gl.drawElements(gl.TRIANGLES, runEnd - runAt, gl.UNSIGNED_INT, runAt * 4); draws++; }
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
        let faced = null;   // DISC29-E: the face uniform's state for this record (set at its first flat)
        // PERF-EXT11 (2026-09-25, the players' "fps issues in the exterior
        // but fine in the interior"): and the origin and the size skip
        // theirs. A record is one host call's list in pixel order, and a
        // pixel's batches share ONE origin array (world.js: `b.origin = t`),
        // so the origin changed about one flat in five on the harness town
        // (234 uploads a sun replay, 44 after). Exact for the reason the
        // sway's skip is: P.bb is bound once for the record and nothing in
        // this loop binds another, and only this loop writes these two.
        // Reset per record, beside the sway's and the texture's.
        let lastW = NaN, lastH = NaN, lastOx = NaN, lastOy = NaN, lastOz = NaN;
        const wl = Math.hypot(r.flatWind[0], r.flatWind[1]);   // PERF-EXT1: the record's wind, for its quads' lean
        for (const b of (cand ? cand.bb[j] : r.batches)) {
          if (!b?.vao || b._dead || b.conceal || f.isSpectral(b.archive)) continue;   // a concealed foe and a ghost cast nothing
          if (filter === REPLAY_LO ? (b._shDyn && !b._shAnim) : (filter !== REPLAY_ALL && (filter === REPLAY_STATIC) === !!b._shDyn)) continue;   // SC1: by the batch's own word; DISC29-E: the lo tier takes a flat that animates in place
          if (lightPos && b.archive === SHADOW_LIGHT_FLATS) continue;   // EL6: a flame is the lantern, not its occluder
          if (lightPos && b.selfCard && !self) continue;   // DISC24-C: the player's own card, only where it is redrawn every frame
          if (b.noShadow || SHADOW_NO_CAST_ARCHIVES.has(b.archive) || (b.size && b.size.h < minFlatH)) { this.stats.culled++; continue; }   // F2: a thing on the ground is no standing card   // WEEDS1: ...and nothing under four texels of THIS cascade
          if (!batchVisible(planes, b)) { this.stats.culled++; continue; }   // EL5
          // PERF-EXT1: a pixel-wide batch passes the sphere test in every cascade and face of its pixel; asked of its
          // quads it is drawn only where one of them stands (the census's noon city: cascade 0 drew 123 flat batches a
          // frame for 7 with a tree in it, cascade 1 144 for 79). A skip here is a batch that rasterises nothing.
          if (b._place && !placementsInVolume(b, quadRadius(wl, b), planes)) { this.stats.culled++; continue; }
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
          // DISC29-E: a lamp's replay turns each flat to face it from the flat's OWN centre, in the vertex shader
          // (uFacePoint) - the per-batch `right` below faced it from the batch's origin, which a batch with its centres
          // in its vertices does not have (ZERO_ORIGIN: the world's). The player's own card never turns (DISC24-C), and
          // a sun or the camera's replay turns nothing. The per-batch right stays, for a lamp straight overhead.
          const face = perBatchRight && !b.selfCard;
          if (face !== faced) {
            if (face) gl.uniform4f(P.bb.face, lightPos[0], lightPos[1], lightPos[2], 1);
            else gl.uniform4f(P.bb.face, 0, 0, 0, 0);
            faced = face;
          }
          // AUDIT-EL F13: the CAMERA's depth image (the air pass) draws a flat
          // with the basis it was drawn with, off the record - the sun's basis
          // drew every tree edge-on, a sliver the AO and the glares saw through.
          // PERF-BASIS: which is why `recordBasis` still wins here; it is
          // just hoisted, because it cannot change between two flats.
          if (perBatchRight && b.selfCard) {
            gl.uniform3fv(P.bb.right, r.right);   // DISC24-C: the player's own card casts as it is drawn, never turned to the lamp
          } else if (perBatchRight) {
            // face the lantern: right = up x (light - flat)
            const dx = lightPos[0] - o[0], dz = lightPos[2] - o[2];
            const l = Math.hypot(dx, dz) || 1;
            this._right[0] = dz / l; this._right[1] = 0; this._right[2] = -dx / l;
            gl.uniform3fv(P.bb.right, this._right);
          }
          if (o[0] !== lastOx || o[1] !== lastOy || o[2] !== lastOz) { gl.uniform3f(P.bb.origin, o[0], o[1], o[2]); lastOx = o[0]; lastOy = o[1]; lastOz = o[2]; }   // PERF-EXT11
          const w = b.size.w, h = b.size.h;
          if (w !== lastW || h !== lastH) { gl.uniform2f(P.bb.size, w, h); lastW = w; lastH = h; }   // PERF-EXT11
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
    if (loc.sunOrigin) gl.uniform4fv(loc.sunOrigin, this.sunOrigin);   // TV1: the receivers pick their cascade about it
    gl.uniform4fv(loc.pointParams, this.pointParams);   // EL5: all the casters' vec4s at once
    gl.uniform1iv(loc.shadowIndex, this.shadowIndex);
    gl.uniform1iv(loc.casterOf, this.casterOf);   // EL8
  }

}
