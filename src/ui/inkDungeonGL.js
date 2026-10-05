// @ts-check
// ═══════════════════════════════════════════════════════════════════
// EM3-3D, THE CLASSIC WAY (Mac, 2026-09-27: "just make it like the classic dungeon 3d map but in this drawn
// style"). DFU's 3D automap draws the dungeon's OWN geometry - every model the player has revealed, as it was
// built - and three things make it readable, all of which this keeps:
//
//   BACK FACES ARE NOT DRAWN. A Daggerfall room is a shell of one-sided faces looking inward, so the wall between
//   the eye and a room is seen from behind and simply is not there: the room lies open, its far walls stand. That
//   is the whole "the wall that hides the floor is not shown" of the classic map, and it turns with the camera for
//   free. (Each face's side is the FILE's normal, as automapFloors reads it - not the winding.)
//
//   THE SLICE. Everything above the player's feet plus SLICE_ABOVE is cut away (Automap.cs's slicing plane), so
//   ceilings and the floors overhead never cover the floor the player is on, and a wall is cut where the plane
//   crosses it.
//
//   THE REVEAL. Only revealed models are drawn - the same `revealed` set the classic map reads.
//
// It is drawn by the GPU in two passes: the faces into a normal-and-ink buffer with a depth buffer (so what is in
// front hides what is behind, exactly), and then a pass that inks every crease, cut and silhouette from the jumps
// in depth and facing, with a trembling pen, over the washes, flagstones and hatching the first pass laid. The
// result is ink with alpha - the paper under it shows through every face.
//
// The camera is automapSheet's own (makeCamera): world -> paper is affine, so it is handed in as the paper
// position of the origin and of the three unit axes, and every mark the sheet draws over it lines up.
// ═══════════════════════════════════════════════════════════════════

import { INK_RGB } from './inkMap.js';
import { slicingPositionY, DEFAULT_SLICING_BIAS_Y } from '../systems/automap.js';
import { EYE_HEIGHT } from '../player/motor.js';
import { FLOOR_NY } from '../systems/automapFloors.js';   // FIELD BUGS 2026-10-05c (RAMP-INK): the plan's floor law
import { loseGlContext, onPageGone } from '../render/glRelease.js';   // GL-LEAK: the context let go at once, and as the page goes

/** How far over the player's feet the slice cuts (metres) - the classic window's own law (automap.js
 *  slicingPositionY: the eye, plus DFU's SlicingBiasY), so both maps cut the dungeon at the same height. */
export const SLICE_ABOVE = slicingPositionY(0, EYE_HEIGHT, DEFAULT_SLICING_BIAS_Y);
/** How far under the slice (metres) a surface keeps its full ink; below that it fades to POCHE... the classic
 *  shader's "brightness falls with distance below the slice, floored at 40%", as ink. */
export const FADE_FROM = 1.5, FADE_OVER = 9, FADE_FLOOR = 0.35;
/** A standing face no taller than this (metres) is a step's RISER. Mac: "when i drag it all the way sideways the
 *  ground is black" - a Daggerfall stair is dozens of treads and risers, and at any zoom that puts several steps in
 *  a pixel every riser met every tread in a crease, so a flight was inked solid. A riser is drawn as part of the
 *  slope it climbs (a faint line where it is big enough to see), as the classic map shows a stair. */
export const RISER_MAX = 0.45;
/** The pencil the floors are shaded with: graphite, a touch cool against the brown ink. */
export const LEAD_RGB = Object.freeze([74, 74, 80]);
/** Water: a blue-grey wash over everything under a block's water level (the classic shader's _WaterLevel tint), and
 *  small waves drawn on the flat under it (Mac: "when there is water on the map add small waves to it"). */
export const WATER_RGB = Object.freeze([40, 86, 128]);
/** How far apart the waves are set (metres) and how many of the places they could go get one. */
export const WAVE_STEP = 1.6, WAVE_SHARE = 0.6;
/** FLOOR-WATER: the flagstone (metres a side), how dark its joint is inked, and the level lines on a flooded wall
 *  (metres apart). */
export const STONE = 1, JOINT_TONE = 0.24, WATER_RULE = 0.3;
/** ALL-FLOORS: how strongly a floor that is not the player's is inked when every floor is shown (the player's is 1). */
export const OTHER_FLOOR = 0.3;
/** FIELD BUGS 2026-10-05c (RAMP-INK; "where there is a steep upward incline in a hallway, never gets filled properly"):
 *  a face is inked as FLOOR - the pencil, the flagstones, a flooded floor's wash, a climbing face no storey's cut takes
 *  apart - when it leans up no further than the motor walks: the plan's own law (automapFloors.js FLOOR_NY, the motor's
 *  SLOPE_LIMIT_DEG). A literal 0.6 (53.13 degrees) inked every steeper ramp the player walks - Daggerfall's run to 55 -
 *  as a WALL: a bare wash, never the grey of ground walked, so a hallway's climb read as never visited. */
export const FLOOR_FACE_NY = FLOOR_NY;
/** The ink a face takes by its normal's lean (`ny`), as FS_A chooses it: a floor, a ceiling (looking down past 0.6), or a
 *  wall. */
export const faceInkOf = (ny) => (ny > FLOOR_FACE_NY ? 'floor' : ny < -0.6 ? 'ceiling' : 'wall');
/** The floor's lean as FS_A's literal. */
const FNY = FLOOR_FACE_NY.toFixed(6);

const VS_A = `#version 300 es
in vec3 aPos; in vec4 aNrm; in float aWater; in float aRowY;
uniform mat4 uM;
out vec3 vW; flat out vec4 vN; flat out float vWater; flat out float vRowY;
void main() { vW = aPos; vN = aNrm; vWater = aWater; vRowY = aRowY; gl_Position = uM * vec4(aPos, 1.0); }`;

const FS_A = `#version 300 es
precision highp float;
in vec3 vW; flat in vec4 vN; flat in float vWater; flat in float vRowY;
uniform float uClipY; uniform float uWaveStep; uniform float uWaveShare; uniform vec3 uEye; uniform vec3 uLight;
uniform float uFadeFrom; uniform float uFadeOver; uniform float uFadeFloor;
uniform float uStone; uniform float uJoint; uniform float uRule;
uniform float uAll; uniform int uStoreyN; uniform float uStoreys[32]; uniform float uSliceAbove; uniform float uFocus; uniform float uOther;
layout(location = 0) out vec4 o0;   // facing (xyz), tone
layout(location = 1) out vec4 o1;   // fade, kind (0 surface, 1 cut rock), -, 1 = something drawn
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
// FLOOR-WATER: one course of paving of stone size S (metres), running bond: the joint (a pixel-wide line, 0..1),
// the far-edge shade, and the stone's cell (for its own tone)
void stoneJoint(vec2 xz, float S, out float joint, out float bevel, out vec2 cell) {
  vec2 q = vec2(xz.x / S + 0.5 * mod(floor(xz.y / S), 2.0), xz.y / S);
  cell = floor(q);
  vec2 f = fract(q);
  vec2 fw = max(fwidth(q), vec2(1e-5));
  vec2 e = min(f, 1.0 - f) / fw;
  joint = 1.0 - smoothstep(0.5, 1.35, min(e.x, e.y));
  vec2 far = (1.0 - f) / fw;
  bevel = 1.0 - smoothstep(1.2, 2.6, min(far.x, far.y));
}
void main() {
  if (vW.y > uClipY) discard;
  vec3 n = normalize(vN.xyz);
  // ALL-FLOORS: every storey cut at its OWN slice - the storey under a point, plus the classic slice height - so each
  // floor walked lies open with its ceiling and the rock over it gone, and the floors above lie over the ones under.
  // A ramp (a sloped floor) and a flight's treads climb between storeys and are never cut.
  float clipHere = uClipY;
  float dim = 1.0;   // ALL-FLOORS: the player's own floor at full ink, every other floor at uOther
  if (uAll > 0.5 && uStoreyN > 0) {
    // ALL-FLOORS, by ROW (Mac: make it look like the floor's own view when pressing All): each model is cut at the
    // slice of the storey it STANDS ON (its lowest point), not of the height a pixel happens to be at - so a tall
    // room is cut once, exactly as on its own floor's view, instead of in bands at every storey its walls pass
    float base = uStoreys[0];
    for (int i = 0; i < 32; i++) { if (i >= uStoreyN) break; if (uStoreys[i] <= vRowY + 0.75) base = max(base, uStoreys[i]); }
    clipHere = min(uClipY, base + uSliceAbove);
    bool climbs = (n.y > ${FNY} && n.y < 0.97) || (vN.w > 1.2 && vN.w < 1.5);
    if (vW.y > clipHere && !climbs) discard;
    // the player's storey in full, the others faint
    if (abs(base - uFocus) > 0.75) dim = uOther;
  }
  // the game's culling: a face whose wound normal looks away from the eye is not drawn (rowMesh)
  if (dot(n, uEye) < 0.0) discard;
  float kind = 0.0;
  if (vN.w > 1.5) {
    // a riser: part of the flight's slope - it creases with nothing, and carries only a faint line
    o0 = vec4(0.5, 1.0, 0.5, 0.15);
    o1 = vec4(dim * mix(1.0, uFadeFloor, clamp((clipHere - vW.y - uFadeFrom) / uFadeOver, 0.0, 1.0)), 0.0, 1.0, 1.0);
    return;
  }
  float fade = dim * mix(1.0, uFadeFloor, clamp((clipHere - vW.y - uFadeFrom) / uFadeOver, 0.0, 1.0));
  float tone, pencil = 0.0;
  // FLOOR-WATER: every line below is drawn a PIXEL wide wherever the camera puts it (fwidth), not a share of a stone,
  // and fades out before the stones get too small to draw - so the floor reads sharp at every zoom and tilt and
  // never shimmers into moire.
  bool wet = vW.y <= vWater;
  float stones = 0.0;   // how much of the flagstone pattern is laid (0 = none: too small to draw, or not a floor)
  float joint = 0.0, bevel = 0.0; vec2 cell = vec2(0.0);
  if (n.y > ${FNY}) {
    // FLAGSTONES (Mac: "make the blocky floor a bit more visible"): courses a stone deep, each course set half a
    // stone over, every stone a little its own shade, its joint a crisp pen line and its far edges a touch shaded,
    // as a draughtsman shades a paving
    // A LEVEL OF DETAIL, so the paving is there at every zoom: the stones where they are 10 px or more, and where
    // they would be smaller, courses of two, four... stones laid as larger slabs - blended by the zoom, never a pop
    float base = max(max(fwidth(vW.x), fwidth(vW.z)) / uStone, 1e-5);   // stones per pixel at the true size
    float lvl = max(0.0, log2(base / 0.1));
    float k0 = floor(lvl), t = fract(lvl);
    float ja = 0.0, jb = 0.0, ba = 0.0, bb = 0.0;
    stoneJoint(vW.xz, uStone * exp2(k0), ja, ba, cell);
    vec2 cellB; stoneJoint(vW.xz, uStone * exp2(k0 + 1.0), jb, bb, cellB);
    float weak = 1.0 / (1.0 + 0.45 * k0);          // a slab's joint is drawn lighter than a stone's
    joint = mix(ja * weak, jb / (1.0 + 0.45 * (k0 + 1.0)), t);
    bevel = mix(ba, bb, t) * (k0 < 0.5 ? 1.0 - t : 0.0);
    stones = 1.0;
  }
  if (n.y > ${FNY}) {
    // floor (Mac: "the ground has to be very slightly grey like youve done it with a pencil"): a light graphite
    // shading in close diagonal strokes that wander a little, with the flagstones in it
    float grain = 0.5 + 0.5 * sin((vW.x - vW.z) * 23.0 + h(floor(vec2(vW.x + vW.z, vW.y) * 1.3)) * 6.0);
    float grainAA = 1.0 - smoothstep(0.35, 0.9, fwidth((vW.x - vW.z) * 23.0) / 6.2832);   // the grain, only where it resolves
    tone = 0.105 + 0.04 * grain * grainAA + (0.045 * h(cell + 3.0) - 0.018) * stones + 0.03 * bevel + uJoint * joint;   // a touch lighter
    pencil = 1.0;
  } else if (n.y < -0.6) {
    tone = 0.18;
  } else {
    // a wall's face: a light wash by the light, and a few upright strokes on the shaded side only
    float lit = clamp(dot(n, uLight) * 0.5 + 0.5, 0.0, 1.0);
    vec2 along = normalize(vec2(-n.z, n.x) + 1e-5);
    float u = dot(vW.xz, along) * 4.0 + h(floor(vec2(vW.y * 2.0, dot(vW.xz, along) * 4.0))) * 0.25;
    float hatch = (1.0 - smoothstep(0.06, 0.16, abs(fract(u) - 0.5) * 2.0 - 0.78)) * smoothstep(0.55, 0.2, lit);
    tone = 0.06 + 0.1 * (1.0 - lit) + hatch * 0.16;
  }
  // UNDER WATER (FLOOR-WATER, Mac: "adjust the water to look better"): the classic map tints everything below its
  // block's water level; here the water is a wash that deepens with the depth over it, the floor's stones faintly
  // seen through it, and on top small waves in loose courses. On a wall the water is ruled in level lines, as an
  // engraver draws water, under a crisp WATERLINE - so a flooded room reads from the side as well as from above.
  if (wet) {
    pencil = 0.5;
    float deep = clamp((vWater - vW.y) / 2.5, 0.0, 1.0);
    if (n.y > ${FNY}) {
      // the wash: deeper is darker, and it clouds a little, as a watercolour wash dries - the stones faint under it
      float cloud = vn(vW.xz * 0.45) * 0.6 + vn(vW.xz * 1.3 + 17.0) * 0.4;
      tone = 0.2 + 0.12 * deep + 0.07 * (cloud - 0.5) + 0.05 * joint;
      vec2 q = vW.xz / uWaveStep;
      q.x += 0.5 * mod(floor(q.y), 2.0);
      vec2 wc = floor(q), f = fract(q);
      if (h(wc + 11.0) < uWaveShare) {
        vec2 j = (vec2(h(wc + 3.0), h(wc + 5.0)) - 0.5) * 0.3;
        float len = 0.3 + 0.12 * h(wc + 9.0);
        float u = (f.x - 0.5 - j.x) / len;                        // along the wave, -1..1
        // a tilde: one gentle swell, its rise a little shorter than its fall, like a pen's quick wave
        float crest = 0.5 + j.y + 0.045 * sin(u * 3.1416 + 0.35 * sin(u * 3.1416));
        float dPx = abs(f.y - crest) / max(fwidth(f.y), 1e-5);    // off the stroke, in pixels
        float taper = 1.0 - smoothstep(0.7, 1.0, abs(u));
        float stroke = (1.0 - smoothstep(0.45 + 0.5 * taper, 1.2 + 0.5 * taper, dPx)) * step(abs(u), 1.0);
        float small = 1.0 - smoothstep(0.35, 0.8, fwidth(q.x));  // no waves smaller than a few pixels
        tone = max(tone, (0.62 + 0.2 * taper) * stroke * small);
      }
    } else if (n.y >= -0.6) {
      // a wall under water: level lines every WATER_RULE metres, and the waterline over them
      float ry = vW.y / uRule;
      float rPx = min(fract(ry), 1.0 - fract(ry)) / max(fwidth(ry), 1e-5);
      float rule = (1.0 - smoothstep(0.4, 1.2, rPx)) * (1.0 - smoothstep(0.25, 0.6, fwidth(ry)));
      tone = 0.16 + 0.1 * deep + 0.28 * rule;
    }
  }
  // the WATERLINE itself, on any upright face the water meets (just above the level as well as under it)
  if (vWater > -1e8 && n.y <= ${FNY} && n.y >= -0.6) {
    float wPx = abs(vW.y - vWater) / max(fwidth(vW.y), 1e-5);
    float line = 1.0 - smoothstep(0.7, 1.7, wPx);
    if (line > 0.0) { pencil = 0.5; tone = max(tone, 0.9 * line); }
  }
  o0 = vec4(n * 0.5 + 0.5, clamp(tone, 0.02, 1.0));
  o1 = vec4(fade, kind, pencil, 1.0);
}`;

const VS_B = `#version 300 es
in vec2 aXY; out vec2 vUV;
void main() { vUV = aXY * 0.5 + 0.5; gl_Position = vec4(aXY, 0.0, 1.0); }`;

const FS_B = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uN; uniform sampler2D uK; uniform sampler2D uD; uniform vec2 uPx; uniform float uDepthK; uniform vec3 uInk; uniform float uWob; uniform float uLine; uniform vec3 uLead; uniform vec3 uWater;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // the pen trembles: every sample is taken a little off where it is drawn, the same way for the same place
  vec2 px = vUV / uPx;
  vec2 w = (vec2(n2(px * 0.045), n2(px * 0.045 + 31.7)) - 0.5) * uWob * uPx;
  vec2 uv = vUV + w;
  vec4 c = texture(uN, uv), k = texture(uK, uv); float d = texture(uD, uv).r;
  bool here = k.a > 0.0;
  float edge = 0.0, fadeE = here ? k.r : 0.0;
  for (int i = 0; i < 8; i++) {
    float r = i < 4 ? 1.0 : uLine;
    int j = i - (i / 4) * 4;
    vec2 off = (j == 0 ? vec2(uPx.x, 0) : j == 1 ? vec2(-uPx.x, 0) : j == 2 ? vec2(0, uPx.y) : vec2(0, -uPx.y)) * r;
    vec4 cn = texture(uN, uv + off), kn = texture(uK, uv + off); float dn = texture(uD, uv + off).r;
    bool there = kn.a > 0.0;
    if (here != there) { edge = 1.0; fadeE = max(fadeE, there ? kn.r : 0.0); continue; }   // the outline
    if (!here) continue;
    if (abs(kn.g - k.g) > 0.5) edge = 1.0;                                // where the section meets a face
    vec3 a = c.rgb * 2.0 - 1.0, b = cn.rgb * 2.0 - 1.0;
    if (dot(a, b) < 0.8) edge = max(edge, 0.85);                          // a crease: floor meets wall, wall turns
  }
  // A JUMP IN DEPTH (a cut, a drop, a wall standing in front), read as the depth's CURVATURE across the pixel,
  // not its slope (Mac: "when i drag it all the way sideways the ground is black"): a floor seen nearly edge-on
  // falls away fast from pixel to pixel, and a slope test inked every pixel of it. A plane has no curvature
  // however steep it lies; a step or a silhouette has a great deal. Inked on the near side, so it is one line.
  if (here) {
    for (int i = 0; i < 2; i++) {
      vec2 sx = vec2(uPx.x, 0.0) * (i == 0 ? 1.0 : uLine), sy = vec2(0.0, uPx.y) * (i == 0 ? 1.0 : uLine);
      float l = texture(uD, uv - sx).r, r = texture(uD, uv + sx).r, t = texture(uD, uv - sy).r, b = texture(uD, uv + sy).r;
      bool lh = texture(uK, uv - sx).a > 0.0 && texture(uK, uv + sx).a > 0.0;
      bool vh = texture(uK, uv - sy).a > 0.0 && texture(uK, uv + sy).a > 0.0;
      float lap = max(lh ? (l + r - 2.0 * d) : 0.0, vh ? (t + b - 2.0 * d) : 0.0);
      if (lap * uDepthK > 0.3) edge = 1.0;
    }
  }
  float tone = here ? c.a * k.r : 0.0;
  // the pen over the shading: ink for every line, and for a face's wash its own lead - graphite on the floors
  float ea = edge * 0.92 * max(fadeE, 0.35);
  float kb = here ? k.b : 0.0;
  vec3 surf = abs(kb - 0.5) < 0.2 ? uWater : mix(uInk, uLead, kb);
  float a = ea + tone * (1.0 - ea);
  o = vec4(uInk * ea + surf * tone * (1.0 - ea), a);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
  return s;
}
function program(gl, vs, fs) {
  const p = gl.createProgram();
  const v = compile(gl, gl.VERTEX_SHADER, vs), f = compile(gl, gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.deleteShader(v); gl.deleteShader(f);   // GL-LEAK: flagged now, freed with the program they are attached to
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); throw new Error(gl.getProgramInfoLog(p) ?? 'link'); }
  return p;
}

const _rowMesh = new WeakMap();   // row -> { pos: Float32Array, nrm: Float32Array } in world space, per vertex
/**
 * One row's faces, un-indexed, in world space, each vertex carrying its face's WOUND normal: (B - A) x (C - A).
 *
 * THE GAME'S OWN CULLING LAW, derived from its matrices and not guessed (Mac: "it shows the outside the wall to
 * the viewer"): the world pass projects through mat4's right-handed lookAt and perspective with the NDC x row
 * mirrored (mirrorProjectionX), and culls with frontFace(CW) - so a face is DRAWN exactly when its wound normal
 * points at the eye (test/em3_3d_dungeon.test.js proves it through those very functions). The classic automap
 * draws the dungeon through that same pass. The file's own normals are NOT used for this: the earlier cut trusted
 * them, and they are not what the game draws by.
 */
export function rowMesh(r) {
  let m = _rowMesh.get(r);
  if (m) return m;
  const p = r?.positions, idx = r?.indices, M = r?.matrix ?? null;
  const n = idx ? idx.length - (idx.length % 3) : 0;
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 4);
  const water = new Float32Array(n).fill(Number.isFinite(r?.waterLevel) ? r.waterLevel : -1e9);
  const tx = (i, o) => {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    if (!M) { pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; return; }
    pos[o] = M[0] * x + M[4] * y + M[8] * z + M[12];
    pos[o + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
    pos[o + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
  };
  // a placement that mirrors (negative determinant) turns every face's winding over; the game's pass does not
  // correct for that, so neither does this - the wound normal is taken AFTER the placement, as the GPU sees it
  for (let t = 0, k = 0; t < n; t += 3, k += 3) {
    tx(idx[t] * 3, k * 3); tx(idx[t + 1] * 3, k * 3 + 3); tx(idx[t + 2] * 3, k * 3 + 6);
    const ax = pos[k * 3], ay = pos[k * 3 + 1], az = pos[k * 3 + 2];
    const ux = pos[k * 3 + 3] - ax, uy = pos[k * 3 + 4] - ay, uz = pos[k * 3 + 5] - az;
    const vx = pos[k * 3 + 6] - ax, vy = pos[k * 3 + 7] - ay, vz = pos[k * 3 + 8] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    const rise = Math.max(ay, ay + uy, ay + vy) - Math.min(ay, ay + uy, ay + vy);
    const riser = Math.abs(ny / L) < 0.35 && rise <= RISER_MAX ? 2 : 1;
    for (let v = 0; v < 3; v++) { const o = (k + v) * 4; nrm[o] = nx / L; nrm[o + 1] = ny / L; nrm[o + 2] = nz / L; nrm[o + 3] = riser; }
  }
  // ALL-FLOORS: a row with a flight in it (several risers) is a STAIR - its flat treads are marked (1.4) so the
  // per-storey cut never takes a flight apart between two floors
  let risers = 0;
  for (let k = 0; k < n; k += 3) if (nrm[k * 4 + 3] > 1.5) risers++;
  if (risers >= 4 * 2) for (let k = 0; k < n; k += 3) if (nrm[k * 4 + 3] < 1.5 && nrm[k * 4 + 1] > FLOOR_FACE_NY) for (let v = 0; v < 3; v++) nrm[(k + v) * 4 + 3] = 1.4;
  // ALL-FLOORS: the storey a row stands on is read off ITS FLOOR - the height where most of its up-facing area lies
  // (Mac: "when i press all it should still highlight my floor"): the lowest point was the bottom of the rock under
  // a room, or a slab's underside, a storey too low - so the player's own rooms were drawn as another floor, faint.
  // A row with no floor in it (a wall, a pillar) falls back to its lowest point.
  const area = new Map();
  for (let k = 0; k < n; k += 3) {
    const ny = nrm[k * 4 + 1];
    if (Math.abs(ny) <= 0.6 || nrm[k * 4 + 3] > 1.5) continue;   // level faces only, not a stair's risers
    const o = k * 3;
    const ux = pos[o + 3] - pos[o], uz = pos[o + 5] - pos[o + 2], vx = pos[o + 6] - pos[o], vz = pos[o + 8] - pos[o + 2];
    const a = Math.abs(ux * vz - uz * vx) / 2;
    const y = (pos[o + 1] + pos[o + 4] + pos[o + 7]) / 3;
    const key = Math.round(y * 4) / 4;
    area.set(key, (area.get(key) ?? 0) + a);
  }
  let rowY = Infinity, most = 0;
  for (const [y, a] of area) if (a > most * 1.0001 || (Math.abs(a - most) <= most * 1e-4 && y < rowY)) { most = a; rowY = y; }
  if (!Number.isFinite(rowY)) for (let i = 1; i < pos.length; i += 3) if (pos[i] < rowY) rowY = pos[i];
  const rowYs = new Float32Array(n).fill(Number.isFinite(rowY) ? rowY : 0);
  m = { pos, nrm, water, rowY: rowYs, count: n };
  _rowMesh.set(r, m);
  return m;
}

/**
 * The GL ink for one page. `doc` is the page the paper lives in (the sheet reaches for no global DOM); null where
 * WebGL2 is not to be had, and the caller draws the way it did before.
 * @param {Document|null} doc
 */
export function createDungeonInk(doc) {
  const canvas = doc?.createElement?.('canvas');
  const gl = /** @type {WebGL2RenderingContext|null} */ (canvas?.getContext?.('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: true, preserveDrawingBuffer: true }) ?? null);
  if (!gl) return null;
  let pA, pB;
  try { pA = program(gl, VS_A, FS_A); pB = program(gl, VS_B, FS_B); } catch { loseGlContext(gl); return null; }   // GL-LEAK: a context that failed is let go, not left for the collector
  const buf = { pos: gl.createBuffer(), nrm: gl.createBuffer(), water: gl.createBuffer(), rowY: gl.createBuffer(), quad: gl.createBuffer() };
  gl.bindBuffer(gl.ARRAY_BUFFER, buf.quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const fbo = gl.createFramebuffer(), tN = gl.createTexture(), tK = gl.createTexture(), tD = gl.createTexture();
  let fw = 0, fh = 0, meshKey = null, meshOwner = null, count = 0, lo = [0, 0, 0], hi = [0, 0, 0];

  function sizeTo(W, H) {
    if (W === fw && H === fh) return;
    fw = W; fh = H; canvas.width = W; canvas.height = H;
    for (const t of [tN, tK]) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); }
    for (const t of [tN, tK, tD]) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (t === tD) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, W, H, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tN, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, tK, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tD, 0);
  }

  return {
    canvas,
    /** GL-LEAK: the context is gone (the browser took it back) - the page's ink is built anew. */
    lost: () => !!gl.isContextLost?.(),
    /** The revealed rows, uploaded once per reveal. GL-LEAK: the ink is the PAGE's, so the key is the sheet's own -
     *  `owner` - as well as its reveal: another sheet's rows that happen to count the same are never taken for these. */
    setMesh(key, rows, owner = null) {
      if (key === meshKey && owner === meshOwner) return;
      meshKey = key; meshOwner = owner;
      let n = 0;
      const parts = rows.map(rowMesh);
      for (const m of parts) n += m.count;
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 4), water = new Float32Array(n), rowY = new Float32Array(n);
      let o = 0;
      lo = [Infinity, Infinity, Infinity]; hi = [-Infinity, -Infinity, -Infinity];
      for (const m of parts) {
        pos.set(m.pos, o * 3); nrm.set(m.nrm, o * 4); water.set(m.water, o); rowY.set(m.rowY, o); o += m.count;
      }
      for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { const v = pos[i + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
      count = n;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.nrm); gl.bufferData(gl.ARRAY_BUFFER, nrm, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.water); gl.bufferData(gl.ARRAY_BUFFER, water, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.rowY); gl.bufferData(gl.ARRAY_BUFFER, rowY, gl.STATIC_DRAW);
    },
    /**
     * Draw. `paper(x, y, z)` is the world -> paper-pixel map (affine), `depth(x, y, z)` grows toward the eye;
     * `clipY` the slice; W, H the canvas in device pixels, `dpr` the paper's.
     */
    render({ paper, depth, clipY, W, H, dpr = 1, scale = 1, storeys = null, focusY = 0 }) {
      sizeTo(W, H);
      // world -> clip, from the affine maps' values at the origin and the unit axes
      const P0 = paper(0, 0, 0), Px = paper(1, 0, 0), Py = paper(0, 1, 0), Pz = paper(0, 0, 1);
      const d0 = depth(0, 0, 0), dx = depth(1, 0, 0) - d0, dy = depth(0, 1, 0) - d0, dz = depth(0, 0, 1) - d0;
      // the depth range the level can take, so the buffer's precision is spent on it
      let dmin = Infinity, dmax = -Infinity;
      for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
        const v = d0 + dx * x + dy * y + dz * z; if (v < dmin) dmin = v; if (v > dmax) dmax = v;
      }
      if (!(dmax > dmin)) { dmin = -1; dmax = 1; }
      const span = dmax - dmin + 2, mid = (dmax + dmin) / 2;
      const sx = (2 * dpr) / W, sy = (-2 * dpr) / H, sz = -2 / span;   // clip z: nearer is smaller
      // column-major mat4
      const M = new Float32Array([
        (Px[0] - P0[0]) * sx, (Px[1] - P0[1]) * sy, dx * sz, 0,
        (Py[0] - P0[0]) * sx, (Py[1] - P0[1]) * sy, dy * sz, 0,
        (Pz[0] - P0[0]) * sx, (Pz[1] - P0[1]) * sy, dz * sz, 0,
        P0[0] * sx - 1, P0[1] * sy + 1, (d0 - mid) * sz, 1,
      ]);
      const eL = Math.hypot(dx, dy, dz) || 1;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (count) {
        gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
        gl.useProgram(pA);
        gl.uniformMatrix4fv(gl.getUniformLocation(pA, 'uM'), false, M);
        gl.uniform1f(gl.getUniformLocation(pA, 'uClipY'), clipY);
        gl.uniform1f(gl.getUniformLocation(pA, 'uFadeFrom'), FADE_FROM);
        gl.uniform1f(gl.getUniformLocation(pA, 'uFadeOver'), FADE_OVER);
        gl.uniform1f(gl.getUniformLocation(pA, 'uFadeFloor'), FADE_FLOOR);
        gl.uniform3f(gl.getUniformLocation(pA, 'uEye'), dx / eL, dy / eL, dz / eL);
        // the light from the page's upper left, whichever way the sheet is turned (a draughtsman shades so)
        const lx = -(Px[0] - P0[0]), lz = -(Pz[0] - P0[0]), ll = Math.hypot(lx, lz) || 1;
        gl.uniform3f(gl.getUniformLocation(pA, 'uLight'), (lx / ll) * 0.6 - 0.3, 0.5, (lz / ll) * 0.6);
        const aP = gl.getAttribLocation(pA, 'aPos'), aN = gl.getAttribLocation(pA, 'aNrm'), aW = gl.getAttribLocation(pA, 'aWater'), aR = gl.getAttribLocation(pA, 'aRowY');
        gl.uniform1f(gl.getUniformLocation(pA, 'uWaveStep'), WAVE_STEP);
        gl.uniform1f(gl.getUniformLocation(pA, 'uWaveShare'), WAVE_SHARE);
        gl.uniform1f(gl.getUniformLocation(pA, 'uStone'), STONE);
        gl.uniform1f(gl.getUniformLocation(pA, 'uJoint'), JOINT_TONE);
        gl.uniform1f(gl.getUniformLocation(pA, 'uRule'), WATER_RULE);
        // ALL-FLOORS: the storeys each cut at their own slice (null: the one slice, as the classic map)
        const st = storeys ? storeys.filter(Number.isFinite).slice(0, 32) : [];
        gl.uniform1f(gl.getUniformLocation(pA, 'uAll'), st.length ? 1 : 0);
        gl.uniform1i(gl.getUniformLocation(pA, 'uStoreyN'), st.length);
        if (st.length) gl.uniform1fv(gl.getUniformLocation(pA, 'uStoreys'), new Float32Array([...st, ...new Array(32 - st.length).fill(0)]));
        gl.uniform1f(gl.getUniformLocation(pA, 'uSliceAbove'), SLICE_ABOVE);
        // the storey inked in full (the player's); the others at OTHER_FLOOR
        let focus = st.length ? st[0] : 0;
        for (const y of st) if (Math.abs(y - focusY) < Math.abs(focus - focusY)) focus = y;
        gl.uniform1f(gl.getUniformLocation(pA, 'uFocus'), focus);
        gl.uniform1f(gl.getUniformLocation(pA, 'uOther'), OTHER_FLOOR);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.nrm); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 4, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.water); gl.enableVertexAttribArray(aW); gl.vertexAttribPointer(aW, 1, gl.FLOAT, false, 0, 0);
        if (aR >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, buf.rowY); gl.enableVertexAttribArray(aR); gl.vertexAttribPointer(aR, 1, gl.FLOAT, false, 0, 0); }
        gl.drawArrays(gl.TRIANGLES, 0, count);
        gl.disableVertexAttribArray(aP); gl.disableVertexAttribArray(aN); gl.disableVertexAttribArray(aW); if (aR >= 0) gl.disableVertexAttribArray(aR);
      }
      // pass B: the ink, onto the canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pB);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tN); gl.uniform1i(gl.getUniformLocation(pB, 'uN'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tD); gl.uniform1i(gl.getUniformLocation(pB, 'uD'), 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tK); gl.uniform1i(gl.getUniformLocation(pB, 'uK'), 2);
      gl.uniform2f(gl.getUniformLocation(pB, 'uPx'), 1 / W, 1 / H);
      gl.uniform1f(gl.getUniformLocation(pB, 'uDepthK'), span);   // depth-buffer units back to metres
      gl.uniform3f(gl.getUniformLocation(pB, 'uInk'), INK_RGB[0] / 255, INK_RGB[1] / 255, INK_RGB[2] / 255);
      gl.uniform3f(gl.getUniformLocation(pB, 'uLead'), LEAD_RGB[0] / 255, LEAD_RGB[1] / 255, LEAD_RGB[2] / 255);
      gl.uniform3f(gl.getUniformLocation(pB, 'uWater'), WATER_RGB[0] / 255, WATER_RGB[1] / 255, WATER_RGB[2] / 255);
      gl.uniform1f(gl.getUniformLocation(pB, 'uWob'), Math.max(0.6, Math.min(2.2, scale * 0.12)) * dpr);
      gl.uniform1f(gl.getUniformLocation(pB, 'uLine'), Math.max(1, Math.round(Math.min(2.5, 0.6 + scale * 0.1) * dpr)));
      const aXY = gl.getAttribLocation(pB, 'aXY');
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.quad); gl.enableVertexAttribArray(aXY); gl.vertexAttribPointer(aXY, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disableVertexAttribArray(aXY);
      gl.activeTexture(gl.TEXTURE0);
      return canvas;
    },
    /** GL-LEAK: every object this ink made, deleted, and the context let go at once (a canvas off the page is
     *  otherwise freed only when the collector runs, which no GPU memory pressure ever asks for). */
    dispose() {
      for (const b of Object.values(buf)) gl.deleteBuffer(b);
      gl.deleteFramebuffer(fbo);
      for (const t of [tN, tK, tD]) gl.deleteTexture(t);
      gl.deleteProgram(pA); gl.deleteProgram(pB);
      meshKey = null; meshOwner = null; count = 0;
      loseGlContext(gl);
      canvas.width = 0; canvas.height = 0;
    },
  };
}

/**
 * GL-LEAK (FIELD BUGS 2026-10-03, Swololo: "After long plays there are consistent GPU memory leaks that do not lower
 * down even after closing the tab ... Might be related to some GL instances not being cleared through webgl"): ONE INK
 * A PAGE. The held map builds a sheet per open, and each sheet built its own ink - a WebGL2 context of its own with a
 * full-size framebuffer, a depth buffer and three paper-sized textures (30-40 MB at 1080p, past 150 at 4K) - on every M
 * in a dungeon or a building, never deleted and never lost; its canvas off the page, it lived until a collection no GPU
 * pressure asks for. One map is ever open, so the page keeps one ink and every sheet draws with it (its rows keyed by
 * the sheet, setMesh's `owner`). A lost one (the browser's to take back) is built anew; none (no WebGL2) is asked
 * again at the next open, as each sheet asked before.
 * @param {Document|null} doc
 */
let _shared = null;   // { doc, ink, unseat }
export function dungeonInkFor(doc) {
  if (!doc) return null;
  if (_shared && _shared.doc === doc && !_shared.ink.lost()) return _shared.ink;
  disposeDungeonInk();
  const ink = createDungeonInk(doc);
  if (ink) _shared = { doc, ink, unseat: onPageGone(disposeDungeonInk) };
  return ink;
}

/** GL-LEAK: the shared ink let go - a lost one replaced, or the page going (render/glRelease.js). */
export function disposeDungeonInk() {
  if (!_shared) return;
  const { ink, unseat } = _shared;
  _shared = null;
  unseat();
  ink.dispose();
}
