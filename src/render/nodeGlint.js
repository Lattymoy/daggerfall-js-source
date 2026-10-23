// @ts-check
// NODE-GLINT (2026-10-20, the owner: "Lets just bring the glint back but better", of NODE-OUTLINE's ring - which players
// found unimmersive): A NODE'S GLINT - every gathering node standing near the player (a herb patch, a vein, a boulder, a
// school, a tree - its flat or its 3D tree) catching the light ON ITS OWN PICTURE: sparkles that flash on the picture
// and go dark, and a soft sheen that crosses it now and then - in a warm light with a hint of its profession's colour
// (ui/nodeMarks.js, the colour its compass mark wears), never a line drawn round it.
// It takes the place of NODE-OUTLINE's ring (2026-10-19), and before it of NODE-MARKS' glow card (render/nodeGlow.js: a
// halo, a shimmer and motes on a card before the node - a sparkle NEAR the node, a tree's a patch at its root under its
// crown) wherever the node has a picture; a node with none (a body drawn as a 3D character) keeps the glow.
//
// HOW - A SILHOUETTE, THEN ITS LIGHT:
//   1. THE MASK (NODE-OUTLINE's, unchanged). Each node's pictures are drawn again, unmoved, by the billboard program's own
//      vertex stage (renderer.js bbVertexShader - so a flat stands, sways and gives way to its 3D tree exactly as the world
//      drew it, and a 3D tree is turned, scaled and swayed as its door drew it), cut where the picture is cut, into a tile
//      of a depth-only atlas (GLINT_TILE square, GLINT_GRID x GLINT_GRID of them): the node's own rectangle on screen
//      fitted into its tile. The tile holds the node's silhouette, and at each of its texels the depth of the node there.
//   2. THE LIGHT. Over the node's rectangle on screen, one quad, added onto the frame (ONE, ONE - it only ever brightens):
//      - THE GLINTS: GLINT_COUNT sparkles, each living its own short life (GLINT_RATE, a step faster each) - born, at its
//        brightest mid-life, gone dark - at a spot of the picture chosen afresh each life, once for the node in the
//        vertex stage: the first of GLINT_TRIES points of the node's own pictures (GLINT_ANCHORS - a flat, a 3D tree's
//        crown) in the plane each stands in, so it moves with the picture as the eye moves; a flat's judged by its own
//        picture at its own texel, a crown's by the silhouette GLINT_HOLD_PX round; none, and that life is dark: a
//        white-hot core in a soft bloom, and four thin rays, a little turned, GLINT_PX long at most at GLINT_REF_ROWS
//        rows, shorter on a small picture.
//      - THE SHEEN: a soft band of light crossing the silhouette, rising, once each 1 / GLINT_SHEEN_HZ seconds - the
//        picture's own shape lit, only inside it; faded out as the node comes near (GLINT_SHEEN_NEAR_M to
//        GLINT_SHEEN_FULL_M).
//      Each at the depth of the picture where it stands, GLINT_PULL toward the eye, against the world's depth - so whatever
//      stands before the node (a wall, a rock) hides it, and the node itself never does. The node an act works is quiet
//      (AUDIT NODE-GLINT: the act's own glint is the one to watch - scenes/gatherHost.js marks' `quiet`, nodeGlows' law).
// One draw a picture into the mask and one quad a node on screen; the frame's target, its viewport and the world's GL
// baseline handed back as they were. Each node's light is nodeGlow.js's law (`nodeGlows`): it kindles as it first stands
// near and fades out from NODE_GLOW_FADE_M to NODE_GLOW_M; under reduced motion the glints hold still at their places and
// no sheen crosses; the fog and the jungle's haze fade it as they fade the node; and it is as bright as the light where
// the node stands, never under the flats' own floor, its sheen out in the dark (GLINT-LIGHT). Not a DFU member.
import { bbVertexShader, FLAT_LIGHT_FLOOR } from './renderer.js';
import { buildProgram, startPrograms } from './glProgram.js';
import { BAYER_GLSL } from './orderedDither.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { billboardKey } from './billboardKey.js';
import { windfallLawOn, swayShare } from './windfallSway.js';
import { nodeGlows, createNodeGlowState, createNodeGlowPass, NODE_GLOW_MAX } from './nodeGlow.js';
import { LPT_INSTANCE_FLOATS } from '../world/lowPolyTrees.js';

/** The mask's atlas: GLINT_GRID x GLINT_GRID tiles of GLINT_TILE texels - a node a tile, its rectangle on screen fitted in
 *  at a texel a pixel where it fits (a tree filling the screen at fewer). */
export const GLINT_TILE = 256;
export const GLINT_GRID = 4;
/** The most nodes one frame lights: the atlas's tiles - the glow's own budget. */
export const GLINT_MAX = GLINT_GRID * GLINT_GRID;
/** How far round a 3D tree's root its crown is taken to reach, in its picture's widths (its far picture is drawn from one
 *  side; turned, a crown may reach past half of it). */
export const GLINT_TREE_REACH = 0.75;
/** A flat's six indices (u32) in its batch's index range - renderer.js BB_QUAD_INDEX_BYTES. */
export const GLINT_QUAD_INDEX_BYTES = 24;
/** The glints a node has, and the spots each life tries before it is dark (the first the silhouette holds round it). */
export const GLINT_COUNT = 6;
export const GLINT_TRIES = 6;
/** AUDIT NODE-GLINT: how far inside the silhouette a glint's spot stands on every side, in the drawn image's pixels (its
 *  tile's texels where the tile holds the node a texel a pixel; one texel at the least) - so a picture swaying or the eye
 *  moving a pixel never takes a glint off a leaf's edge mid-flash. */
export const GLINT_HOLD_PX = 1.5;
/** AUDIT NODE-GLINT: the most of a node's pictures its glints stand on - each flat, at its own base, width and height,
 *  or a 3D tree's crown about its root - a life's spot a point of one of them, in the plane its picture stands in, so it
 *  moves with the picture as the eye moves (a spot at a share of the screen's box was a different point of the picture
 *  each frame, and came and went at a leaf's edge as the player walked). */
export const GLINT_ANCHORS = 8;
/** A glint's lives a second: the first's, and each next one's step over it (whole over the glow's 60 s clock). */
export const GLINT_RATE = 0.35;
export const GLINT_RATE_STEP = 0.05;
/** A life's flash: its light sin(pi x life) to this power - born and gone dark, brief at its brightest. Under reduced
 *  motion every glint stands at GLINT_STILL, at its first life's place. */
export const GLINT_FLASH = 3;
export const GLINT_STILL = 0.6;
/** A glint's reach (its rays' half length) in the drawn image's pixels at GLINT_REF_ROWS rows: GLINT_SHARE of the
 *  picture's longer side on screen, between GLINT_PX_MIN and GLINT_PX (scaled with the image), never under GLINT_PX_FLOOR
 *  (a retro image's pixels are large). */
export const GLINT_PX = 14;
export const GLINT_PX_MIN = 4;
export const GLINT_PX_FLOOR = 1.5;
export const GLINT_REF_ROWS = 1080;
export const GLINT_SHARE = 0.35;
/** The light each part adds at its brightest: a glint's core, its rays, the soft bloom about its core, the sheen's band. */
export const GLINT_GAIN = Object.freeze({ core: 0.9, ray: 0.5, bloom: 0.3, sheen: 0.14 });
/** The light's own colour (a warm daylight), the share of the profession's colour it carries, and how much whiter than
 *  that a glint's core burns. */
export const GLINT_LIGHT = Object.freeze([1, 0.95, 0.84]);
export const GLINT_TINT = 0.35;
export const GLINT_CORE_WHITE = 0.6;
/** How far toward the eye the light stands off the picture it lies on (m): never behind the node's own surface, where a
 *  fitted tile's texel and the screen's pixel part (a tree nearer than its tile holds whole). */
export const GLINT_PULL = 0.3;
/** The sheen's crossings a second (whole over the clock), the share of each period it spends crossing (the rest dark),
 *  and the distances it fades in over (m): none within GLINT_SHEEN_NEAR_M, whole from GLINT_SHEEN_FULL_M. */
export const GLINT_SHEEN_HZ = 0.15;
export const GLINT_SHEEN_SHARE = 0.5;
export const GLINT_SHEEN_NEAR_M = 6;
export const GLINT_SHEEN_FULL_M = 18;
/** GLINT-LIGHT (the owner, 2026-10-20, at night and underground: "Follow the light"): the light levels (glintLightLevel of
 *  the light a node's flat takes) the sheen goes out over - none at GLINT_SHEEN_DARK and under: every night (a moonless
 *  one 0.25, both moons full 0.39), a storm's noon (0.35 - "a storming noon reads near-night", world/worldClock.js
 *  exteriorAmbient), a mine with no lamp near; whole from GLINT_SHEEN_LIT: a clear day's from its first hour (0.59), an
 *  overcast noon (0.66); a rainy noon (0.48) between. */
export const GLINT_SHEEN_DARK = 0.4;
export const GLINT_SHEEN_LIT = 0.55;

/** AUDIT NODE-GLINT: the clip w a box's corner must stand past to be before the eye - a node wholly behind it is none, and
 *  one across its plane is bounded where its edges cross it; and the most of the screen beyond its edge a picture's own box
 *  is kept to (NDC), so its glints' shares hold as it slides off the screen. */
export const GLINT_NEAR_W = 1e-3;
export const GLINT_OVERHANG = 2;

if (GLINT_MAX !== NODE_GLOW_MAX) throw new Error('NODE-GLINT: the atlas holds the glow\'s budget');

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A glint's reach in pixels, in an image `rows` tall, on a picture whose longer side stands `sidePx` on screen. Pure. */
export const glintPx = (rows, sidePx) => {
  const scale = rows / GLINT_REF_ROWS;
  return Math.max(GLINT_PX_FLOOR, Math.min(GLINT_PX * scale, Math.max(GLINT_PX_MIN * scale, GLINT_SHARE * sidePx)));
};
/** The most a glint reaches in an image `rows` tall - the rectangle's room round its picture. Pure. */
export const glintPxMax = (rows) => Math.max(GLINT_PX_FLOOR, (GLINT_PX * rows) / GLINT_REF_ROWS);
/** The light a node's glints are lit in: the warm light with GLINT_TINT of its profession's `rgb`, written into `out`.
 *  Pure but for `out`. @param {ArrayLike<number>} rgb @param {number[]} out */
export const glintTint = (rgb, out) => {
  for (let i = 0; i < 3; i++) out[i] = GLINT_LIGHT[i] + (rgb[i] - GLINT_LIGHT[i]) * GLINT_TINT;
  return out;
};
/** The sheen's gain for a node `d` metres from the eye: none near, GLINT_GAIN.sheen from GLINT_SHEEN_FULL_M. Pure. */
export const glintSheen = (d) => GLINT_GAIN.sheen * smooth(GLINT_SHEEN_NEAR_M, GLINT_SHEEN_FULL_M, d);
/** GLINT-LIGHT: how bright a light `rgb` is - its luma by the 601 weights (0.299, 0.587, 0.114), in the display space
 *  renderer.flatLightAt answers in (the frame's own: the lane encodes each fragment back to it, enhancedLighting.js
 *  elFinish); written about its green so a grey light's level is that grey exactly (white 1, the floor the floor). Pure. */
export const glintLightLevel = (rgb) => rgb[1] + 0.299 * (rgb[0] - rgb[1]) + 0.114 * (rgb[2] - rgb[1]);
/** GLINT-LIGHT: the sheen's share at a light `level`: none in the dark, whole in a lit hour. Pure. */
export const glintSheenLight = (level) => smooth(GLINT_SHEEN_DARK, GLINT_SHEEN_LIT, level);
/** Every rate is whole over the glow's 60 s clock - the last glint's and the sheen's included. Pure. */
export const glintRatesWhole = () => [GLINT_SHEEN_HZ, ...Array.from({ length: GLINT_COUNT }, (_, i) => GLINT_RATE + i * GLINT_RATE_STEP)]
  .every((r) => Math.abs(r * 60 - Math.round(r * 60)) < 1e-9);

/** THE MASK'S VERTEX STAGE: the billboard program's own, and after it places the vertex, the node's rectangle on screen
 *  (uMaskRect: its NDC centre, and one over its half size) stretched over the tile the viewport is. A vertex given way
 *  (`gone`, a far picture inside its 3D tree's radius) stays off the clip volume. */
export const NODE_MASK_VS = bbVertexShader({
  head: 'uniform vec4 uMaskRect;   // NODE-OUTLINE: the node\'s rectangle in NDC - its centre (xy), one over its half size (zw)',
  main: '  if (!gone) gl_Position.xy = (gl_Position.xy - uMaskRect.xy * gl_Position.w) * uMaskRect.zw;   // NODE-OUTLINE (render/nodeGlint.js): the rectangle over the tile',
});

/** THE MASK'S FRAGMENT STAGE: the picture's own cut and nothing else (the atlas is depth alone) - a flat's texel at its
 *  0.5, its quad's margin clear; a 3D tree's by its material and its handover's screen-door (render/lowPolyTreesGlsl.js
 *  LPT_FS_TEXEL, term for term). */
export const NODE_MASK_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vShade;
in float vAlpha;
in float vFade;
uniform sampler2D uTex;
out vec4 o;
${BAYER_GLSL}
void main() {
  vec4 tex = texture(uTex, vUV);   // sampled before any branch (SPRITE-GRAD's law)
  float a = tex.a;
  if (vFade < 1.5 && (vUV.x < 0.0 || vUV.x > 1.0 || vUV.y < 0.0 || vUV.y > 1.0)) a = 0.0;   // a flat's margin clear; a tree's uv wraps
  a = vAlpha > 0.0 ? a * vAlpha : 1.0;
  if (vFade < 1.0 ? bayer4(gl_FragCoord.xy) + 0.03125 >= vFade : (vFade > 1.5 && vFade < 3.0 && bayer4(gl_FragCoord.xy) + 0.03125 < 3.0 - vFade)) discard;
  if (a < 0.5) discard;
  o = vec4(0.0);
}`;

/** Each glint's index, for the stages written out a glint at a time (an output array indexed in a loop is no law every
 *  translator keeps). */
const GLINT_SLOTS = Array.from({ length: GLINT_COUNT }, (_, i) => i);
const f = (x) => x.toFixed(4);
/** The hash both stages read: a node's seed, a glint's phase and its life's spot and turn. */
const GLINT_HASH_GLSL = `uint glintHash(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float glintRand(uint x) { return float(glintHash(x) >> 8) * (1.0 / 16777216.0); }
float maskAt(vec2 at, ivec2 lo, ivec2 hi) { return texelFetch(uMask, clamp(ivec2(floor(at)), lo, hi), 0).r; }`;

/** THE LIGHT'S VERTEX STAGE: the node's rectangle on screen (uRect: NDC centre, half size), its depth the fragment's - and,
 *  once for the node (AUDIT NODE-GLINT: every fragment of the rectangle found them again), each glint this life: its life
 *  numbered on the clock's own wrap (a glint's lives are whole over the 60 s period, so the life at the wrap is the one at
 *  zero), its light, and the first of its tries the silhouette holds `uHold` texels round on every side: a point of one
 *  of the node's pictures (`uAnchor` - a flat's base, width and height, or a 3D tree's crown about its root) in the
 *  plane it stands in (the frame's billboard basis), so the spot is a point of the picture and moves with it as the eye
 *  moves; on the screen, before the eye; none, a dark life. Handed to the fragment stage flat: its spot (the rectangle's
 *  shares), the picture's depth there, its light; and its turn. */
export const NODE_GLINT_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location = 0) in vec2 aP;
uniform highp sampler2D uMask;   // the atlas (depth)
uniform vec4 uRect;              // the rectangle's NDC centre (xy) and half size (zw)
uniform vec4 uTile;              // its tile in the atlas: the corner (xy) and the size (zw), in texels
uniform float uHold;             // how far inside the silhouette a spot must stand, in the tile's texels
uniform float uSeed;             // the node's own (0..1)
uniform float uTime;             // the glow's wrapped clock (s)
uniform float uStill;            // 1 under reduced motion: every glint at its first life, steady
uniform mat4 uVP;
uniform vec3 uRight;             // the frame's billboard basis - the plane a picture stands in
uniform vec3 uUp;
uniform vec4 uAnchor[${2 * GLINT_ANCHORS}];   // each picture a glint may stand on: its base (xyz) and width (w); its height (x), and 1 (y) a flat its own picture judges
uniform int uAnchors;
uniform sampler2D uFlatTex;      // the node's flats' own picture (its first batch's)
${GLINT_SLOTS.map((i) => `flat out vec4 vGlint${i};\nflat out float vTurn${i};`).join('\n')}
const float PI = 3.141592653589793;
${GLINT_HASH_GLSL}
// a point of a flat its own picture holds - judged at the flat's own texel, so it holds as the eye moves (the mask's
// pixels came and went under it a frame at a time)
bool opaque(vec2 uv) { return textureLod(uFlatTex, uv, 0.0).a >= 0.5; }
bool holds(vec2 at, ivec2 lo, ivec2 hi) {
  return maskAt(at + vec2(uHold, 0.0), lo, hi) < 1.0 && maskAt(at - vec2(uHold, 0.0), lo, hi) < 1.0
    && maskAt(at + vec2(0.0, uHold), lo, hi) < 1.0 && maskAt(at - vec2(0.0, uHold), lo, hi) < 1.0;
}
vec4 glintOf(int i, uint seed, float tm, out float turn) {
  uint ui = uint(i);
  float lives = ${f(GLINT_RATE * 60)} + float(i) * ${f(GLINT_RATE_STEP * 60)};   // a glint's lives a period - whole
  float cyc = tm * lives / 60.0 + glintRand(seed ^ (ui * 0x9e3779b9u));
  float c = mod(floor(cyc), lives);
  float env = uStill > 0.5 ? ${f(GLINT_STILL)} : pow(max(sin(PI * fract(cyc)), 0.0), ${f(GLINT_FLASH)});
  turn = 0.0;
  if (env < 0.004) return vec4(0.0, 0.0, 1.0, 0.0);
  if (uAnchors < 1) return vec4(0.0, 0.0, 1.0, 0.0);   // no picture to stand on
  uint life = glintHash(seed + ui * 0x85ebca6bu + uint(c) * 0xc2b2ae35u);
  turn = (glintRand(life ^ 0x5bd1e995u) - 0.5) * 0.6;
  ivec2 lo = ivec2(uTile.xy), hi = ivec2(uTile.xy + uTile.zw) - 1;
  for (int j = 0; j < ${GLINT_TRIES}; j++) {
    uint h = glintHash(life + uint(j) * 0x27d4eb2fu), g = glintHash(h ^ 0x68e31da4u);
    int k = int(h % uint(max(uAnchors, 1)));
    vec4 a = uAnchor[2 * k], b = uAnchor[2 * k + 1];
    vec2 uv = vec2(float(g & 0xffffu), float(g >> 16)) / 65535.0;   // a point of the picture, its own
    vec4 cp = uVP * vec4(a.xyz + uRight * ((uv.x - 0.5) * a.w) + uUp * (uv.y * b.x), 1.0);
    if (cp.w <= ${f(GLINT_NEAR_W)}) continue;   // behind the eye
    vec2 spot = (cp.xy / cp.w - uRect.xy) / uRect.zw * 0.5 + 0.5;   // the rectangle's shares
    if (spot.x < 0.0 || spot.y < 0.0 || spot.x > 1.0 || spot.y > 1.0) continue;   // off the screen
    if (b.y > 0.5) {   // a flat: its own picture judges the point, and its depth is the point's own
      if (opaque(uv)) return vec4(spot, cp.z / cp.w * 0.5 + 0.5, env);
      continue;
    }
    vec2 at = uTile.xy + spot * uTile.zw;   // a 3D tree's crown: the silhouette judges it
    float d = maskAt(at, lo, hi);
    if (d < 1.0 && holds(at, lo, hi)) return vec4(spot, d, env);
  }
  return vec4(0.0, 0.0, 1.0, 0.0);   // no try held: this life is dark
}
void main() {
  gl_Position = vec4(uRect.xy + aP * uRect.zw, 0.0, 1.0);
  float tm = uTime * (1.0 - uStill);
  uint seed = uint(uSeed * 1009.0 + 0.5) * 2654435761u;   // each node its own glints
${GLINT_SLOTS.map((i) => `  vGlint${i} = glintOf(${i}, seed, tm, vTurn${i});`).join('\n')}
}`;

/** THE LIGHT'S FRAGMENT STAGE: where the fragment falls in the node's rectangle and its tile; the sheen where the
 *  silhouette holds it; each glint's star about its spot (the vertex stage's); nothing lit, nothing drawn; else the light
 *  at the nearer of the picture under the fragment and under its strongest glint (a 3D tree's front card never hides
 *  its own light), pulled toward the eye, faded by the fog, the haze and the sea's murk where that depth stands in the
 *  world (uInvVP). */
export const NODE_GLINT_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uMask;   // the atlas (depth)
uniform vec4 uRect;              // the rectangle's NDC centre (xy) and half size (zw)
uniform vec4 uTile;              // its tile in the atlas: the corner (xy) and the size (zw), in texels
uniform vec4 uInner;             // the picture's own box in the rectangle, as its shares: x0, y0, x1, y1
uniform vec4 uViewport;          // the frame's viewport, in pixels
uniform float uGlint;            // a glint's reach, in pixels
uniform vec3 uColor;             // the light (glintTint)
uniform float uAlpha;            // its kindling, its distance's fade and the light where it stands (GLINT-LIGHT)
uniform float uSeed;             // the node's own (0..1)
uniform float uSheen;            // the sheen's gain (glintSheen - none near; glintSheenLight - none in the dark)
uniform float uTime;             // the glow's wrapped clock (s)
uniform float uStill;            // 1 under reduced motion: the glints held, no sheen
uniform mat4 uInvVP;
uniform mat4 uVP;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${GLINT_SLOTS.map((i) => `flat in vec4 vGlint${i};\nflat in float vTurn${i};`).join('\n')}
out vec4 o;
${FOG_FACTOR_GLSL}
float maskAt(vec2 at, ivec2 lo, ivec2 hi) { return texelFetch(uMask, clamp(ivec2(floor(at)), lo, hi), 0).r; }
// a glint's star about its spot: a white-hot core in a soft bloom, and four thin rays turned by its own turn
void glintAt(vec4 g, float th, vec2 q, vec2 rectPx, inout vec3 parts, inout float best, inout float bestDepth) {
  if (g.w <= 0.0) return;   // a dark life
  vec2 off = (q - g.xy) * rectPx;
  if (dot(off, off) > uGlint * uGlint) return;
  off = mat2(cos(th), sin(th), -sin(th), cos(th)) * off;
  float w = max(0.75, 0.08 * uGlint), cr = max(1.0, 0.22 * uGlint), br = max(1.5, 0.4 * uGlint);
  vec2 a = max(1.0 - abs(off) / uGlint, 0.0);
  float co = exp(-dot(off, off) / (cr * cr)) * g.w;
  float ry = (exp(-off.y * off.y / (w * w)) * a.x * a.x + exp(-off.x * off.x / (w * w)) * a.y * a.y) * g.w;
  float bl = exp(-dot(off, off) / (br * br)) * g.w;
  parts += vec3(co, ry, bl);
  if (co + ry + bl > best) { best = co + ry + bl; bestDepth = g.z; }
}
void main() {
  vec2 ndc = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw * 2.0 - 1.0;
  vec2 q = (ndc - uRect.xy) / uRect.zw * 0.5 + 0.5;
  ivec2 lo = ivec2(uTile.xy), hi = ivec2(uTile.xy + uTile.zw) - 1;
  vec2 rectPx = uRect.zw * uViewport.zw;
  float tm = uTime * (1.0 - uStill);
  float here = maskAt(uTile.xy + q * uTile.zw, lo, hi);
  // THE SHEEN: a soft band rising across the picture's own box, lit only where the silhouette is
  float sheen = 0.0;
  if (here < 1.0 && uStill < 0.5) {
    vec2 qi = (q - uInner.xy) / max(uInner.zw - uInner.xy, vec2(1e-4));
    float pos = mix(-0.4, 1.4, fract(tm * ${f(GLINT_SHEEN_HZ)} + uSeed) / ${f(GLINT_SHEEN_SHARE)});   // from below the picture to past its crown, then dark
    float k = (qi.y * 0.8 + qi.x * 0.2 - pos) * 6.0;
    sheen = exp(-k * k) * uSheen;
  }
  // THE GLINTS: each its star about the spot its life stands at
  vec3 parts = vec3(0.0);   // core, rays, bloom
  float best = 0.0, bestDepth = 1.0;
${GLINT_SLOTS.map((i) => `  glintAt(vGlint${i}, vTurn${i}, q, rectPx, parts, best, bestDepth);`).join('\n')}
  float lit = sheen + ${f(GLINT_GAIN.ray)} * parts.y + ${f(GLINT_GAIN.bloom)} * parts.z + ${f(GLINT_GAIN.core)} * parts.x;
  if (lit * uAlpha < 0.002) discard;   // nothing lit here
  float dep = min(here, bestDepth);   // the nearer picture: the fragment's own, or its strongest glint's
  vec4 wp = uInvVP * vec4(ndc, dep * 2.0 - 1.0, 1.0);
  vec3 at3 = wp.xyz / wp.w;
  vec3 away = at3 - uCamPos;
  float far = length(away);
  vec4 cp = uVP * vec4(at3 - away * (min(${f(GLINT_PULL)}, 0.5 * far) / max(far, 1e-4)), 1.0);   // stood toward the eye, never past half its way
  gl_FragDepth = clamp(cp.z / cp.w * 0.5 + 0.5, 0.0, 1.0);
  vec3 light = uColor * (sheen + ${f(GLINT_GAIN.ray)} * parts.y + ${f(GLINT_GAIN.bloom)} * parts.z) + mix(uColor, vec3(1.0), ${f(GLINT_CORE_WHITE)}) * ${f(GLINT_GAIN.core)} * parts.x;
  o = vec4(dwWaterFogAdd(light * uAlpha * fogFactorAt(at3), at3), 1.0);   // AUDIT NODE-GLINT: and the sea's murk, as an added light takes it (render/duelWall.js)
}`;

const MASK_UNIFORMS = ['uProj', 'uView', 'uRight', 'uUp', 'uOrigin', 'uSize', 'uFlatWind', 'uSway', 'uWindfallSway', 'uWindfallAxis', 'uTip',
  'uFacePoint', 'uElitePad', 'uTex', 'uMesh', 'uMeshScale', 'uMeshColor', 'uMeshAlpha', 'uLptCut', 'uLptBand', 'uLptSun', 'uMaskRect'];
const GLINT_UNIFORMS = ['uMask', 'uRect', 'uTile', 'uInner', 'uHold', 'uRight', 'uUp', 'uAnchor', 'uAnchors', 'uFlatTex', 'uViewport', 'uGlint', 'uColor', 'uAlpha', 'uSeed', 'uSheen', 'uTime', 'uStill',
  'uInvVP', 'uVP', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uJungleHaze', 'uDwFog'];
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_WATER_FOG = new Float32Array(20);   // DW-C: uDwFog off ([0].x 0)
const ZERO4 = new Float32Array(4);
const ZERO_ORIGIN = Object.freeze([0, 0, 0]);
const isVec3 = (v) => v != null && typeof v === 'object' && v.length >= 3;

/**
 * A NODE'S PICTURES, as the glint draws them: `{ batch, first, count, centers }` - `count` flats of `batch` from its
 * `first`, and their centres (as the batch was made with them, about its origin) - and for a tree, `center` (the forest
 * flat's centre, the very array its pixel's 3D tree set holds) and `entry` (its pixel). The gathering host's marks carry
 * them (scenes/gatherHost.js `pictures`).
 * @typedef {{ batch: any, first: number, count: number, centers?: number[][]|null, center?: number[]|null, entry?: any }} NodePicture
 */

/** A tree's 3D instance this frame: the frame of the renderer's that drew its handle, the run it was drawn in, and its
 *  instance row `[x, y, z, yaw, scale]` (scene) written into `out` - or null. `frames` the renderer's drawn tree frames
 *  (lptDrawnFrames). Pure but for `rows` (a set's centre -> its row, made the first time a set is asked) and `out`.
 *  @param {NodePicture} pic @param {ReadonlyArray<any>} frames @param {WeakMap<any[], Map<any, number>>} rows @param {Float32Array} out */
export function treeInstanceOf(pic, frames, rows, out) {
  if (!pic.center || !pic.entry) return null;
  for (const set of [pic.entry.lowPolyTrees, pic.entry.jungleTrees]) {
    if (!set?.trees || !set.centers) continue;
    let byCenter = rows.get(set.centers);
    if (!byCenter) { byCenter = new Map(); for (let k = 0; k < set.centers.length; k++) byCenter.set(set.centers[k], k); rows.set(set.centers, byCenter); }
    const k = byCenter.get(pic.center);
    if (k === undefined) continue;
    const o = k * 6, handle = set.handles[set.trees[o]];
    for (const f of frames) {
      if (!f?.cut?.has(handle)) continue;
      const run = f.runs.find((r) => r.run.handle === handle);
      if (!run) return null;
      out[0] = set.trees[o + 1] + set.ox; out[1] = set.trees[o + 2] + set.oy; out[2] = set.trees[o + 3] + set.oz; out[3] = set.trees[o + 5]; out[4] = set.trees[o + 4];
      return { frame: f, run };
    }
    return null;
  }
  return null;
}

/** A box's corners' clip x, y and w (8 x 3), filled a box at a time. */
const _clip = new Float64Array(24);
/** A box's twelve edges, as the corners they join (a corner's bits: x 1, y 2, z 4). */
const BOX_EDGES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7].flatMap((c) => [1, 2, 4].filter((b) => !(c & b)).map((b) => [c, c | b])));

/**
 * THE NODE'S PICTURE ON SCREEN: the first `count` of `boxes` (each [x0, y0, z0, x1, y1, z1], scene) through `vp`
 * (proj x view), as `[cx, cy, hx, hy]` in NDC, kept within GLINT_OVERHANG of the screen (not held to it - its glints'
 * shares stand as it slides off), written into `out`; null off the screen. AUDIT NODE-GLINT: a box wholly behind the eye
 * is none (it was the whole screen - every node behind the player a full-screen pass), and one across the eye's plane is
 * bounded by its corners before the eye and where its edges cross GLINT_NEAR_W. Pure but for `out`.
 * @param {ReadonlyArray<ArrayLike<number>>} boxes @param {number} count @param {ArrayLike<number>} vp @param {number[]} out
 */
export function screenRect(boxes, count, vp, out) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x, y, w) => {
    const px = x / w, py = y / w;
    if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
  };
  for (let i = 0; i < count; i++) {
    const b = boxes[i];
    for (let c = 0; c < 8; c++) {
      const x = c & 1 ? b[3] : b[0], y = c & 2 ? b[4] : b[1], z = c & 4 ? b[5] : b[2];
      _clip[c * 3] = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
      _clip[c * 3 + 1] = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
      _clip[c * 3 + 2] = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (_clip[c * 3 + 2] > GLINT_NEAR_W) take(_clip[c * 3], _clip[c * 3 + 1], _clip[c * 3 + 2]);
    }
    for (const [a, e] of BOX_EDGES) {
      const wa = _clip[a * 3 + 2], we = _clip[e * 3 + 2];
      if ((wa > GLINT_NEAR_W) === (we > GLINT_NEAR_W)) continue;   // both before the eye, or both behind it
      const t = (GLINT_NEAR_W - wa) / (we - wa);
      take(_clip[a * 3] + t * (_clip[e * 3] - _clip[a * 3]), _clip[a * 3 + 1] + t * (_clip[e * 3 + 1] - _clip[a * 3 + 1]), GLINT_NEAR_W);
    }
  }
  if (!(x1 > -1 && x0 < 1 && y1 > -1 && y0 < 1)) return null;   // behind the eye (nothing taken), or off the screen
  x0 = Math.max(-GLINT_OVERHANG, x0); y0 = Math.max(-GLINT_OVERHANG, y0); x1 = Math.min(GLINT_OVERHANG, x1); y1 = Math.min(GLINT_OVERHANG, y1);
  out[0] = (x0 + x1) / 2; out[1] = (y0 + y1) / 2; out[2] = (x1 - x0) / 2; out[3] = (y1 - y0) / 2;
  return out;
}

/** A rectangle `rect` `[cx, cy, hx, hy]` (NDC) widened by `pad` (NDC, x and y) and held to the screen, written into `out`
 *  - the room a glint's rays reach into round its picture. Pure but for `out`. */
export function widenRect(rect, pad, out) {
  const x0 = Math.max(-1, rect[0] - rect[2] - pad[0]), x1 = Math.min(1, rect[0] + rect[2] + pad[0]);
  const y0 = Math.max(-1, rect[1] - rect[3] - pad[1]), y1 = Math.min(1, rect[1] + rect[3] + pad[1]);
  out[0] = (x0 + x1) / 2; out[1] = (y0 + y1) / 2; out[2] = (x1 - x0) / 2; out[3] = (y1 - y0) / 2;
  return out;
}

/** A rectangle `[cx, cy, hx, hy]` (NDC) widened to whole pixels of a `vw` x `vh` viewport, in place. Pure but for
 *  `rect`. */
export function snapRect(rect, vw, vh) {
  const x0 = Math.floor((rect[0] - rect[2] + 1) * 0.5 * vw), x1 = Math.ceil((rect[0] + rect[2] + 1) * 0.5 * vw);
  const y0 = Math.floor((rect[1] - rect[3] + 1) * 0.5 * vh), y1 = Math.ceil((rect[1] + rect[3] + 1) * 0.5 * vh);
  rect[0] = ((x0 + x1) / vw) - 1; rect[2] = (x1 - x0) / vw;
  rect[1] = ((y0 + y1) / vh) - 1; rect[3] = (y1 - y0) / vh;
  return rect;
}

/** The picture's own box `inner` as its shares of the rectangle `rect` it stands in (both `[cx, cy, hx, hy]`, NDC):
 *  `[x0, y0, x1, y1]`, each 0..1, written into `out` - where the shader's glints may stand. Pure but for `out`. */
export function innerShare(inner, rect, out) {
  const rx0 = rect[0] - rect[2], ry0 = rect[1] - rect[3], rw = 2 * rect[2], rh = 2 * rect[3];
  out[0] = (inner[0] - inner[2] - rx0) / rw; out[1] = (inner[1] - inner[3] - ry0) / rh;
  out[2] = (inner[0] + inner[2] - rx0) / rw; out[3] = (inner[1] + inner[3] - ry0) / rh;
  return out;
}

function invert4(m, out) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return null;
  const id = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * id; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * id;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * id; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * id;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * id; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * id;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * id; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * id;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * id; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * id;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * id; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * id;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * id; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * id;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * id; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * id;
  return out;
}
function mul4(a, b, out) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** SHADER-STALL: the pass's two programs, the mask's and the light's, as its constructor builds them - what the host
 *  starts ahead of the build (createNodeGlintPass; render/glProgram.js startPrograms). */
export const NODE_GLINT_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze([[NODE_MASK_VS, NODE_MASK_FS], [NODE_GLINT_VS, NODE_GLINT_FS]]));

export class NodeGlintRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    const [mask, light] = NODE_GLINT_PROGRAMS;
    this.mask = buildProgram(gl, mask[0], mask[1], 'node glint mask');
    this.light = buildProgram(gl, light[0], light[1], 'node glint light');
    /** @type {Record<string, WebGLUniformLocation|null>} */
    this.um = {};
    for (const n of MASK_UNIFORMS) this.um[n] = gl.getUniformLocation(this.mask, n);
    /** @type {Record<string, WebGLUniformLocation|null>} */
    this.ul = {};
    for (const n of GLINT_UNIFORMS) this.ul[n] = gl.getUniformLocation(this.light, n);
    const size = GLINT_TILE * GLINT_GRID;
    this.atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.atlas, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    this.quadVb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    /** one tree's instance row */
    this.inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, LPT_INSTANCE_FLOATS * 4, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._row = new Float32Array(LPT_INSTANCE_FLOATS);
    /** @type {WeakMap<any, WebGLVertexArrayObject>} a tree door's buffers under this pass's instance (its gpu -> a VAO) */
    this._vaos = new WeakMap();
    /** @type {WebGLVertexArrayObject[]} every VAO made, freed with the pass */
    this._made = [];
    /** @type {WeakMap<any[], Map<any, number>>} */
    this._rows = new WeakMap();
    // the frame's scratch: each node's picture's box and its rectangle on screen, its tile, its glint's reach, its
    // picture's share of the rectangle, its boxes; the matrices; the light's colour
    this._nodes = Array.from({ length: GLINT_MAX }, () => ({ g: null, inner: [0, 0, 0, 0], rect: [0, 0, 0, 0], tile: [0, 0, 0, 0], share: [0, 0, 0, 0], glint: 1, hold: 1, boxes: /** @type {number[][]} */ ([]), spans: /** @type {number[][]} */ ([]), anchors: new Float32Array(GLINT_ANCHORS * 8), anchorN: 0, flatTex: null }));
    this._vp = new Float32Array(16);
    this._inv = new Float32Array(16);
    this._pad = /** @type {[number, number]} */ ([0, 0]);
    this._tint = [0, 0, 0];
    this._lit = [1, 1, 1];   // GLINT-LIGHT: the light where the node stands, asked a node at a time
    /** how many nodes the last draw lit, and how many of their pictures were 3D trees - for the stats and the tests */
    this.drawn = 0;
    this.trees = 0;
  }

  /** The tree door's buffers (its vertices and indices) with this pass's one instance row. */
  _vaoFor(gpu) {
    let vao = this._vaos.get(gpu);
    if (vao) return vao;
    const gl = this.gl;
    vao = /** @type {WebGLVertexArrayObject} */ (gl.createVertexArray());
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.vb);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.ib);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    const stride = LPT_INSTANCE_FLOATS * 4;
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(3, 1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 16); gl.vertexAttribDivisor(4, 1);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._vaos.set(gpu, vao);
    this._made.push(vao);
    return vao;
  }

  /** A picture's span a slot of `spans` (grown as needed), written: its base, its width and its height. */
  static _span(spans, i, x, y, z, w, h, own) {
    const p = spans[i] ??= [0, 0, 0, 0, 0, 0];
    p[0] = x; p[1] = y; p[2] = z; p[3] = w; p[4] = h; p[5] = own;
  }

  /** A box a slot of `boxes` (grown as needed), written. */
  static _box(boxes, i, x0, y0, z0, x1, y1, z1) {
    const b = boxes[i] ??= [0, 0, 0, 0, 0, 0];
    b[0] = x0; b[1] = y0; b[2] = z0; b[3] = x1; b[4] = y1; b[5] = z1;
  }

  /**
   * LIGHT the frame's nodes - `list` nodeGlows' records whose marks carry their `pictures` - under the renderer's frame:
   * its camera, its billboard basis, its wind, the 3D trees it drew and its fog (`r` the renderer; `seconds` the glow's
   * wrapped clock; `still` reduced motion). Hands back the frame's target and viewport, and the world's baseline: blend
   * off, depth LESS and written, faces culled. Answers how many nodes it lit.
   * @param {ReadonlyArray<any>} list @param {any} r @param {number} seconds @param {boolean} [still]
   */
  draw(list, r, seconds, still = false) {
    this.drawn = 0; this.trees = 0;
    const gl = this.gl;
    if (!list.length || !r._proj || !r._view || !isVec3(r._camPos)) return 0;
    const vpm = mul4(r._proj, r._view, this._vp);
    const view = gl.getParameter(gl.VIEWPORT), target = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const vw = Math.max(1, view[2]), vh = Math.max(1, view[3]);
    const roomPx = glintPxMax(vh) + 2;
    this._pad[0] = (2 * roomPx) / vw; this._pad[1] = (2 * roomPx) / vh;
    const frames = r.lptDrawnFrames?.() ?? [];
    // THE NODES' RECTANGLES: each picture's box - a flat's quad about each centre (its batch's size at the flat's own scale),
    // a 3D tree's crown about its root - through the frame's camera, and the room a glint's rays reach into round it
    let n = 0;
    for (const g of list) {
      if (n >= GLINT_MAX) break;
      const pics = g.mark?.pictures;
      if (!pics?.length || !(g.alpha > 0.001)) continue;
      const s = this._nodes[n];
      let k = 0;
      s.flatTex = null;
      for (const pic of /** @type {NodePicture[]} */ (pics)) {
        const b = pic.batch;
        const t = pic.center ? treeInstanceOf(pic, frames, this._rows, this._row) : null;
        // AUDIT NODE-GLINT: the node's flats' own picture, its first batch's that has one - a flat of it is judged there
        const tex = !t && b?.vao && !b._dead && pic.count > 0 ? r.textures?.get(billboardKey(b)) ?? null : null;
        if (tex && !s.flatTex) s.flatTex = tex;
        const own = tex && tex === s.flatTex ? 1 : 0;
        // AUDIT NODE-GLINT: a far flat's own scale (a Low Poly Trees' or the jungle's batch is sized for its tallest tree - a
        // small tree's glints fell outside it), none where its 3D tree stands (the flat has given way), and a batch the
        // world's walk has not placed yet stands where its mark says (it stood pixel-local - a glint 800 m off)
        if (!t && b?.size && pic.centers?.length) {
          const o = b.origin || g.mark.origin || ZERO_ORIGIN;
          for (let j = 0; j < pic.centers.length; j++) {
            const c = pic.centers[j], fs = b._scales?.[pic.first + j] ?? 1, hw = b.size.w * 0.5 * fs, h = b.size.h * fs;
            NodeGlintRenderer._span(s.spans, k, c[0] + o[0], c[1] + o[1], c[2] + o[2], 2 * hw, h, own);   // AUDIT NODE-GLINT: the flat its glints stand on
            NodeGlintRenderer._box(s.boxes, k++, c[0] + o[0] - hw, c[1] + o[1], c[2] + o[2] - hw, c[0] + o[0] + hw, c[1] + o[1] + h, c[2] + o[2] + hw);
          }
        }
        if (t) {
          const row = this._row, reach = t.run.size[0] * GLINT_TREE_REACH * row[4], h = t.run.size[1] * row[4] * t.run.scale[1];
          NodeGlintRenderer._span(s.spans, k, row[0], row[1], row[2], 2 * reach, h, 0);   // AUDIT NODE-GLINT: its crown, about its root
          NodeGlintRenderer._box(s.boxes, k++, row[0] - reach, row[1], row[2] - reach, row[0] + reach, row[1] + h, row[2] + reach);
        }
      }
      if (!k || !screenRect(s.boxes, k, vpm, s.inner)) continue;
      // AUDIT NODE-GLINT: the pictures its glints stand on - GLINT_ANCHORS at most, taken evenly (base xyz, width; height)
      s.anchorN = Math.min(k, GLINT_ANCHORS);
      for (let i = 0; i < s.anchorN; i++) {
        const sp = s.spans[Math.floor((i * k) / s.anchorN)], o = i * 8;
        s.anchors[o] = sp[0]; s.anchors[o + 1] = sp[1]; s.anchors[o + 2] = sp[2]; s.anchors[o + 3] = sp[3]; s.anchors[o + 4] = sp[4]; s.anchors[o + 5] = sp[5];
      }
      snapRect(widenRect(s.inner, this._pad, s.rect), vw, vh);   // whole pixels: a tile that holds the node whole holds it a texel a pixel
      innerShare(s.inner, s.rect, s.share);
      s.glint = glintPx(vh, Math.max(s.inner[2] * vw, s.inner[3] * vh));
      const wPx = Math.round(s.rect[2] * vw), hPx = Math.round(s.rect[3] * vh), fit = Math.min(1, GLINT_TILE / Math.max(wPx, hPx));   // AUDIT NODE-GLINT: whole pixels, never one over
      s.tile[0] = (n % GLINT_GRID) * GLINT_TILE; s.tile[1] = Math.floor(n / GLINT_GRID) * GLINT_TILE;
      s.tile[2] = Math.max(1, Math.min(GLINT_TILE, Math.ceil(wPx * fit))); s.tile[3] = Math.max(1, Math.min(GLINT_TILE, Math.ceil(hPx * fit)));
      s.hold = Math.max(1, GLINT_HOLD_PX * fit);
      s.g = g;
      n++;
    }
    if (!n) return 0;
    // 1. THE MASKS, a tile each
    const U = this.um;
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);   // a world frame keeps none; a UI scissor would cut the atlas
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb);
    gl.viewport(0, 0, GLINT_TILE * GLINT_GRID, GLINT_TILE * GLINT_GRID);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true);
    gl.disable(gl.CULL_FACE);
    gl.clearDepth(1);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.mask);
    gl.uniformMatrix4fv(U.uProj, false, r._proj);
    gl.uniformMatrix4fv(U.uView, false, r._view);
    gl.uniform3fv(U.uRight, r._bbRight);
    gl.uniform3fv(U.uUp, r._bbUp);
    gl.uniform4fv(U.uFlatWind, r._flatWind ?? ZERO4);
    if (U.uWindfallAxis) { gl.uniform4fv(U.uWindfallSway, r._windfallSway ?? ZERO4); gl.uniform4fv(U.uWindfallAxis, r._windfallAxis ?? ZERO4); }
    gl.uniform4f(U.uFacePoint, 0, 0, 0, 0);
    gl.uniform4f(U.uElitePad, 0, 0, 0, 0);
    gl.uniform1i(U.uTex, 0);
    gl.uniform3f(U.uMeshColor, 1, 1, 1);
    gl.uniform4f(U.uLptSun, 0, 1, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    const wfLaw = windfallLawOn(r._windfall);
    let lptOn;
    const sendCut = (f) => {
      if (f === lptOn) return;
      lptOn = f;
      gl.uniform4f(U.uLptCut, f ? f.eye[0] : 0, f ? f.eye[1] : 0, f ? f.eye[2] : 0, f ? f.radius : 0);
      gl.uniform1f(U.uLptBand, f ? f.band : 0);
    };
    for (let i = 0; i < n; i++) {
      const s = this._nodes[i];
      gl.viewport(s.tile[0], s.tile[1], s.tile[2], s.tile[3]);
      gl.uniform4f(U.uMaskRect, s.rect[0], s.rect[1], 1 / s.rect[2], 1 / s.rect[3]);
      for (const pic of /** @type {NodePicture[]} */ (s.g.mark.pictures)) {
        const b = pic.batch;
        // THE FLAT: its own six indices a flat (its far picture's handover by the frame that drew its 3D tree - a far
        // picture inside the radius draws none)
        const tex = b?.vao && !b._dead && pic.count > 0 ? r.textures?.get(billboardKey(b)) ?? null : null;
        if (tex) {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.uniform1f(U.uMesh, 0);
          gl.uniform2f(U.uSize, b.size.w, b.size.h);
          const o = b.origin || s.g.mark.origin || ZERO_ORIGIN;   // AUDIT NODE-GLINT: as its box stood
          gl.uniform3f(U.uOrigin, o[0], o[1], o[2]);
          gl.uniform1f(U.uSway, swayShare(b, wfLaw));
          const tp = b.tip;
          gl.uniform3f(U.uTip, tp ? tp[0] : 0, tp ? tp[1] : 0, tp ? tp[2] : 0);
          sendCut(b.lptProto ? frames.find((f) => f?.cut?.has(b.lptProto)) ?? null : null);
          gl.bindVertexArray(b.vao);
          gl.drawElements(gl.TRIANGLES, 6 * pic.count, gl.UNSIGNED_INT, (b._ibOff | 0) + pic.first * GLINT_QUAD_INDEX_BYTES);
        }
        // THE 3D TREE the flat gives way to near the eye: its door's buffers, this pass's one instance row
        const t = pic.center ? treeInstanceOf(pic, frames, this._rows, this._row) : null;
        if (!t) continue;
        const { frame: f, run } = t;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this._row);
        gl.bindVertexArray(this._vaoFor(f.gpu));
        gl.uniform1f(U.uMesh, 1);
        gl.uniform3f(U.uTip, 0, 0, 0);
        gl.uniform3f(U.uOrigin, 0, 0, 0);
        gl.uniform3f(U.uMeshScale, run.scale[0], run.scale[1], run.scale[2]);
        gl.uniform2f(U.uSize, run.size[0], run.size[1]);
        gl.uniform1f(U.uSway, swayShare(run, wfLaw));
        sendCut(f);
        for (const sub of run.subs) {
          if (!sub.tex) continue;
          gl.bindTexture(gl.TEXTURE_2D, sub.tex);
          gl.uniform1f(U.uMeshAlpha, sub.alpha);
          gl.drawElementsInstanced(gl.TRIANGLES, sub.count, gl.UNSIGNED_INT, sub.offset, 1);
        }
        this.trees++;
      }
    }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.uniform1f(U.uMesh, 0);
    // 2. THE LIGHT, on the frame's own target, added onto it against its depth
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(view[0], view[1], view[2], view[3]);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
    const L = this.ul;
    gl.useProgram(this.light);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(L.uMask, 0);
    gl.uniform1i(L.uFlatTex, 1);   // AUDIT NODE-GLINT: each node's flats' own picture, on unit 1
    gl.uniform4f(L.uViewport, view[0], view[1], vw, vh);
    gl.uniformMatrix4fv(L.uInvVP, false, invert4(vpm, this._inv) ?? this._inv);
    gl.uniformMatrix4fv(L.uVP, false, vpm);
    gl.uniform3fv(L.uRight, r._bbRight);   // AUDIT NODE-GLINT: the plane each picture stands in, as the flats' call stood them
    gl.uniform3fv(L.uUp, r._bbUp);
    gl.uniform1f(L.uTime, seconds);
    gl.uniform1f(L.uStill, still ? 1 : 0);
    gl.uniform1i(L.uFogMode, r._fogMode ?? 0);
    gl.uniform1f(L.uFogDensity, r._fogDensity ?? 0);
    gl.uniform2fv(L.uFogRange, r._fogRange ?? NO_FOG_RANGE);
    gl.uniform3fv(L.uCamPos, r._camPos);
    if (L.uFocus) gl.uniform4fv(L.uFocus, r._focus ?? NO_FOCUS);
    if (L.uJungleHaze) gl.uniform4fv(L.uJungleHaze, r._haze);   // BANTHA1: the jungle's haze, the frame's (renderer.setJungleHaze), as every fogged pass
    if (L.uDwFog) gl.uniform4fv(L.uDwFog, r._dwFog ?? NO_WATER_FOG);   // AUDIT NODE-GLINT (DW-C): the sea's murk, the frame's (renderer.setWaterFog); none, off
    gl.bindVertexArray(this.quad);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    const eye = r._camPos;
    for (let i = 0; i < n; i++) {
      const s = this._nodes[i], g = s.g;
      gl.uniform4f(L.uRect, s.rect[0], s.rect[1], s.rect[2], s.rect[3]);
      gl.uniform4f(L.uTile, s.tile[0], s.tile[1], s.tile[2], s.tile[3]);
      gl.uniform4f(L.uInner, s.share[0], s.share[1], s.share[2], s.share[3]);
      gl.uniform1f(L.uHold, s.hold);
      gl.uniform4fv(L.uAnchor, s.anchors, 0, s.anchorN * 8);   // AUDIT NODE-GLINT: the pictures its glints stand on
      gl.uniform1i(L.uAnchors, s.anchorN);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, s.flatTex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform1f(L.uGlint, s.glint);
      const tint = glintTint(g.rgb, this._tint);
      gl.uniform3f(L.uColor, tint[0], tint[1], tint[2]);
      // GLINT-LIGHT: the light the node's own flat takes where it stands (the sun's half, the moons', the lamps', the
      // ambient), under the floor that keeps a picture readable in a black room - so a node stays findable at night and
      // underground, its glints as bright as that light, its sheen out in the dark. A renderer that answers none: day.
      const level = r.flatLightAt ? glintLightLevel(r.flatLightAt(isVec3(g.at) ? g.at : null, FLAT_LIGHT_FLOOR, this._lit)) : 1;
      gl.uniform1f(L.uAlpha, Math.min(1, g.alpha) * level);
      gl.uniform1f(L.uSeed, Number.isFinite(g.seed) ? g.seed : 0);
      gl.uniform1f(L.uSheen, isVec3(g.at) ? glintSheen(Math.hypot(g.at[0] - eye[0], g.at[1] - eye[1], g.at[2] - eye[2])) * glintSheenLight(level) : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      s.g = null;
    }
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    this.drawn = n;
    return n;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the programs, the atlas and its framebuffer, the buffers and every VAO it made. */
  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.mask); gl.deleteProgram(this.light);
    gl.deleteFramebuffer(this.fb); gl.deleteTexture(this.atlas);
    gl.deleteVertexArray(this.quad); gl.deleteBuffer(this.quadVb); gl.deleteBuffer(this.inst);
    for (const v of this._made) gl.deleteVertexArray(v);
    this._made.length = 0;
    this.mask = null; this.light = null; this.fb = null; this.atlas = null; this.quad = null; this.quadVb = null; this.inst = null;
  }
}

/** AUDIT NODE-MARKS: the system's reduced motion, asked once a second at most (nodeGlow.js's own reading). */
function reducedMotionReader() {
  let at = -Infinity, reduced = false;
  return (nowS) => {
    if (nowS - at > 1) { at = nowS; try { reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { reduced = false; } }
    return reduced;
  };
}
/** PERF-WARM's idle wait (render/warmPrograms.js). */
const idleCall = (fn) => (globalThis.requestIdleCallback ? globalThis.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));

/**
 * THE WORLD HOST'S PASS: the gathering host's marks each frame - a mark with its pictures lit by its glints, a mark with
 * none lit by the glow (`glow`, nodeGlow.js's pass - a body drawn as a 3D character; the pass builds its own, so the host
 * wires one pass and bootWorld holds no glow of its own - HOST-SPLIT), each kindling as it first stands near
 * (nodeGlows). The programs are STARTED once a node is first lit, and the pass built at IDLE once the driver says they
 * are done (`start`, SHADER-STALL: render/glProgram.js startPrograms - PERF-WARM's idle alone held a frame for the whole
 * compile, 5.65 s of a player's) - nothing is lit until they stand; a glint that will not build costs the glint, never the game (its marks go to the glow). A pass that ran is a
 * foreign pass. `draw(marks)` answers how many it lit; `marks` null forgets every node.
 * @param {any} renderer
 * @param {{ glow?: { draw: (marks: any) => number, dispose?: () => void } | null, now?: () => number, build?: (gl: any) => NodeGlintRenderer,
 *   start?: (gl: any) => () => boolean, idle?: (fn: () => void) => void, reduced?: (nowS: number) => boolean }} [o]
 */
export function createNodeGlintPass(renderer, { glow: handed, now = () => performance.now() / 1000, build = (gl) => new NodeGlintRenderer(gl), start = (gl) => startPrograms(gl, NODE_GLINT_PROGRAMS), idle = idleCall, reduced = reducedMotionReader() } = {}) {
  const glow = handed === undefined ? createNodeGlowPass(renderer) : handed;   // the glow its own when the host hands none - and freed with it (AUDIT NODE-GLINT)
  const state = createNodeGlowState(), list = /** @type {any[]} */ ([]), bare = /** @type {any[]} */ ([]), pictured = /** @type {any[]} */ ([]);
  let pass = /** @type {NodeGlintRenderer|null} */ (null), asked = false, dead = false, failed = false, ready = /** @type {(() => boolean)|null} */ (null);
  const make = () => {
    if (dead) return;
    try { pass = build(renderer.gl); } catch (e) { failed = true; console.warn('[prof] the nodes\' glint would not build', e?.message ?? e); pass = null; }
  };
  return {
    /** @param {ReadonlyArray<any>|null|undefined} marks */
    draw(marks) {
      bare.length = 0; pictured.length = 0;
      if (marks) for (const m of marks) (failed || !m?.pictures?.length ? bare : pictured).push(m);
      glow?.draw(marks ? bare : null);   // a node with no picture to light keeps its glow
      const t = now();
      if (!asked && pictured.length && (ready ??= start(renderer.gl))()) { asked = true; idle(make); }   // the first node lit: the compile started; the build at idle once it is done
      if (!nodeGlows(marks ? pictured : null, renderer._camPos, t, state, list).length || !pass) return 0;
      const n = pass.draw(list, renderer, t % 60, reduced(t));
      renderer.markForeignPass();
      return n;
    },
    /** The pass's end - its programs and its atlas freed, and never built again. */
    dispose() { dead = true; asked = true; pass?.dispose(); pass = null; if (handed === undefined) glow?.dispose?.(); },
    /** For the tests and the probes. */
    get pass() { return pass; },
  };
}
