// @ts-check
// ARMORY (2026-10-28, the owner: "customize your character without changing your overall sprite"; bible/04-Characters/
// Aura-Armory.md sections 5-6): THE AURA ARMORY'S PASS - each worn piece drawn on its part of the body, over whatever
// body is shown: tubes round a limb or the brow, decals on the chest, cards for embers and motes, all placed at a pose's
// points (render/armoryPose.js). Added light, depth-tested and never written, fogged, drawn after the opaque world beside
// the auras. THE CARD LAW: on a sprite every point is lifted toward the eye (ARMORY_LIFT_M), so a piece lies on the card's
// near side and what stands behind the body is hidden by the card. One program a piece (the auras' AURA-SPLIT law), and
// every rate whole over the auras' clock, so nothing jumps at its wrap. Not a DFU member.
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram, compiledPass } from './glProgram.js';
import { AURA_NOISE_GLSL, auraClock, AURA_CLOCK_PERIOD, ETERNAL_RGB } from './auraRing.js';
import { AURA_PIXEL_GLSL } from './auraPixel.js';   // the levels the auras are cut to
import { ARMORY_PIECES, ARMORY_SLOTS, armoryKitPieces } from '../net/armoryLaw.js';
import { POSE_AT, poseWorld, ARM_BAND } from './armoryPose.js';
import { heraldryOf, heraldryColourOf, heraldryInk } from '../net/heraldryLaw.js';   // GUILD-SHOP: the Insignia Armlet wears its wearer's guild's arms
import { armsKey, ownGuildArms } from '../net/guild/guildArmsBook.js';
import { paintCrest, CREST_PX } from '../ui/guild/guildCrestArt.js';
import { logoImage } from '../ui/guild/guildLogoImages.js';

/** A tube's steps round and along; the most cards one draw floats; the footfall embers a wearer keeps. */
export const ARMORY_ROUND = 32;
export const ARMORY_ALONG = 6;
/** AUDIT lane 3 F7: a spur's own mesh - six sides, one step: the shader draws six facets, so a round tube's 1,152 corners
 *  were 32 times more than it shows. */
export const ARMORY_SPIKE_ROUND = 6;
export const ARMORY_CARDS = 12;
export const ARMORY_TRAIL = 8;
/** THE CARD LAW: how far toward the eye a sprite's piece is lifted (m) - off the card's plane, where it would fight it. */
export const ARMORY_LIFT_M = 0.035;
/** Past this distance from the eye a wearer's pieces draw without their embers and motes (m); past ARMORY_RANGE_M none;
 *  at most ARMORY_DRAW_MAX wearers a frame, nearest first. */
export const ARMORY_DETAIL_M = 25;
export const ARMORY_RANGE_M = 60;
export const ARMORY_DRAW_MAX = 24;
/** A footfall ember's life (s) and the stride that leaves one (m, a pose's scale of it). */
export const ARMORY_EMBER_S = 2.5;
export const ARMORY_STRIDE_M = 0.8;
/** The rates (Hz), each whole over the clock: the heart's beat, the halo's light, the sigil's, the motes' orbit. */
export const ARMORY_HZ = Object.freeze({ beat: 1, halo: 1 / 6, sigil: 1 / 8, orbit: 1 / 24, spark: 1 / 4, crest: 1 / 6, band: 1 / 4, prism: 1 / 20, glint: 1 / 5 });   // GUILD-SHOP: the armlet's sheen and its glint; THANKS-POST: the spurs' colours turning, a glint running up them
/** THE HEAD PIECES' MEASURES (m, at the body's scale), read by their build (armoryDraws), their shader's motes and their
 *  tip (armoryHeadTip): the crown's band `brow` over the head point and `band` tall, `r` round, its flames `flame` over
 *  it narrowing to `tip` across; the halo `lift` over the crown, `r` round, its axis tipped `tilt` back, its motes
 *  orbiting `orbit` times as far round, bobbing `bob`, `mote` across. */
export const ARMORY_HEAD = Object.freeze({
  burningcrown: Object.freeze({ brow: 0.015, band: 0.05, r: 0.13, flame: 0.27, tip: 0.075 }),
  eternalhalo: Object.freeze({ lift: 0.05, r: 0.165, tilt: 0.3, orbit: 1.12, bob: 0.03, mote: 0.013 }),
});
/** Every rate whole over AURA_CLOCK_PERIOD. Pure. */
export const armoryRatesWhole = () => Object.values(ARMORY_HZ).every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));

/** WOLF-KIT (2026-10-30): the slots still worn turned beast - the chest, the arms to the wrist and the legs, fitted to the wolf
 *  (armoryPose.js ARMORY_BEAST_FIT). The head's crown and halo stay off the wolf's muzzle, and its weapon piece is the
 *  claws' own glow already (systems/weaponGlow.js fistGlow). */
export const ARMORY_BEAST_SLOTS = Object.freeze(['torso', 'arms', 'legs']);

/** A draw's mesh: a tube round a segment, camera-facing cards, a decal on a surface. */
const TUBE = 0, CARDS = 1, DECAL = 2;
/** A piece's index in ARMORY_PIECES - its program's constant. */
export const ARMORY_PIECE_INDEX = Object.freeze(Object.fromEntries(ARMORY_PIECES.map((p, i) => [p.key, i])));
/** GUILD-SHOP: THE INSIGNIA ARMLET'S MEASURES (m, at the body's scale): its band `at` of the way from shoulder to elbow,
 *  `tall` along the arm and `r` round it; the crest `size` across (half), standing `off` proud of the band; the glow
 *  behind it `halo` across; the crest and glow drawn `lift` toward the eye, so an arm thicker than the pose's (the
 *  stand-in's) never buries them. The one piece drawn with its colours over what is behind it, not added to it. */
export const ARMORY_ARMLET = Object.freeze({ at: ARM_BAND.at, tall: 0.07, r: 0.066, size: 0.058, off: 0.004, halo: 0.09, lift: 0.03 });
const ARMLET = ARMORY_PIECE_INDEX.insigniaarmlet;
/** THANKS-POST (2026-10-30, the owner: "Small and varied crystallized arm spikes that rotate color gradient but not
 *  overbearing"): THE CRYSTAL SPURS - each spur a six-sided cone of crystal out of an arm: on the upper arm or the forearm
 *  (`seg`), `at` of the way down it, `len` long, `r` across at its root (m, at the body's scale), turned `turn` round the arm
 *  from straight out toward the back (radians) and leaning `lean` toward the hand. Five an arm, mirrored; `root` how far out
 *  from the arm's line its root stands. Their colour turns slowly through PRISM_RGB, root to tip, each spur its own phase. */
export const ARMORY_SPURS = Object.freeze([
  Object.freeze({ seg: 'upper', at: 0.28, len: 0.08, r: 0.018, turn: 0.1, lean: 0.7 }),
  Object.freeze({ seg: 'upper', at: 0.55, len: 0.11, r: 0.022, turn: 0.65, lean: 0.55 }),
  Object.freeze({ seg: 'upper', at: 0.8, len: 0.065, r: 0.015, turn: -0.5, lean: 0.85 }),
  Object.freeze({ seg: 'fore', at: 0.3, len: 0.095, r: 0.019, turn: 0.35, lean: 0.6 }),
  Object.freeze({ seg: 'fore', at: 0.62, len: 0.07, r: 0.016, turn: -0.3, lean: 0.8 }),
]);
export const ARMORY_SPUR_ROOT = 0.045;
/** The prism the spurs' colour turns through: amethyst, aqua, rose. RGB 0..1. */
export const PRISM_RGB = Object.freeze([Object.freeze([0.55, 0.32, 1]), Object.freeze([0.22, 0.85, 0.95]), Object.freeze([1, 0.38, 0.72])]);
/** How bright a spur is drawn at most (its added light): small and quiet beside the other pieces. */
export const ARMORY_SPUR_GAIN = 0.85;
const SPURS = ARMORY_PIECE_INDEX.crystalspurs;
const SPUR_TAN = ARMORY_SPURS.map((p) => Math.tan(p.turn));

const v3 = (/** @type {ReadonlyArray<number>} */ c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;
/** A rate (Hz) as GLSL multiplies by it EXACTLY - a division by its whole period (the auras' hzGlsl law). */
const hz = (/** @type {number} */ r) => { const per = Math.round(1 / r); return Math.abs(per * r - 1) < 1e-12 ? `/ ${per.toFixed(1)}` : `* ${r}`; };
const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
const SHARED = `
const float TAU = 6.283185307179586;
uniform int uPiece;
uniform int uMesh;
uniform int uPart;
uniform vec3 uA, uB, uN, uU, uVel;
uniform vec2 uR;
uniform float uTime, uSeed, uScale, uSize, uGain, uFace;
float hk(float p) { p = fract(p * 0.1031 + uSeed); p *= p + 33.33; p *= p + p; return fract(p); }
`;

/** THE CARDS' PLACES, piece by piece: card k's centre (xyz) and size (w, 0 for none), and its age, kind and light. */
const CARDS_GLSL = `
vec2 lifeOf(float k, float L) { float x = (uTime + hk(k + 1.0) * L) / L; return vec2(fract(x), mod(floor(x), ${AURA_CLOCK_PERIOD.toFixed(1)} / L)); }
vec3 ringOut(vec3 up, float ang) { vec3 n1 = normalize(uN - up * dot(uN, up)); vec3 n2 = cross(up, n1); return n1 * cos(ang) + n2 * sin(ang); }
vec4 cardAt(float k, out vec4 info) {
  info = vec4(0.0, 0.0, 1.0, 0.0);
  if (uPiece == 0 || uPiece == 5) {
    if (uPart == 1) { info = vec4(0.0, 1.0, 1.0, 0.0); return vec4(uA, uSize * (0.85 + 0.15 * sin(TAU * uTime ${hz(ARMORY_HZ.spark)}))); }   // the Origin's spark
    if (uPiece == 0) {   // embers lifting off the horns' points
      float L = 2.0 + mod(k, 3.0); vec2 lf = lifeOf(k, L);
      float ang = TAU * floor(hk(lf.y * 7.0 + k * 3.1) * 7.0) / 7.0;
      vec3 drift = (cross(uU, uN) * sin(k * 1.7 + lf.x * 3.0) + uN * cos(k * 2.3 + lf.x * 2.0)) * 0.05 * lf.x;
      info = vec4(lf.x, 0.0, 1.0 - lf.x, 0.0);
      return vec4(uA + ringOut(uU, ang) * uR.x * 0.62 + uU * (uR.y * 0.85 + lf.x * 0.32 * uScale) + drift * uScale, 0.02 * uScale * (1.0 - 0.5 * lf.x));
    }
    float ang = TAU * (k / ${ARMORY_CARDS.toFixed(1)} * 1.5 + uTime ${hz(ARMORY_HZ.orbit)});   // motes orbiting the halo
    info = vec4(0.5, 0.0, 0.6 + 0.4 * sin(TAU * (uTime ${hz(ARMORY_HZ.halo)} + k / 8.0)), 0.0);
    return vec4(uA + ringOut(uU, ang) * uR.x * ${ARMORY_HEAD.eternalhalo.orbit.toFixed(2)} + uU * ${ARMORY_HEAD.eternalhalo.bob.toFixed(2)} * uScale * sin(TAU * (uTime ${hz(ARMORY_HZ.halo)} + k / 8.0)), ${ARMORY_HEAD.eternalhalo.mote.toFixed(3)} * uScale);
  }
  if (uPiece == 1 || uPiece == 6) {
    if (uPart == 1) { info = vec4(0.0, 1.0, 1.0, 0.0); return vec4(uA, uSize); }   // the glow at the heart
    float age = fract(uTime ${hz(ARMORY_HZ.beat)} + uSeed), beat = mod(floor(uTime ${hz(ARMORY_HZ.beat)} + uSeed), ${(AURA_CLOCK_PERIOD * ARMORY_HZ.beat).toFixed(1)});
    float ang = TAU * (k / 8.0 + hk(beat + k) * 0.12);
    vec3 right = normalize(cross(uU, uN));
    vec3 dir = normalize(right * cos(ang) + uU * sin(ang) * 0.8 + uN * 0.9);
    info = vec4(age, 0.0, age < 0.7 ? (1.0 - age / 0.7) : 0.0, 0.0);
    return vec4(uA + (dir * age * 0.22 + uU * age * age * 0.06) * uScale, 0.016 * uScale * (1.0 - age));
  }
  if (uPiece == 2 || uPiece == 7) {
    float L = uPiece == 2 ? 2.0 + mod(k, 3.0) : 1.5 + 0.5 * mod(k, 2.0); vec2 lf = lifeOf(k, L);
    if (uPiece == 2) {   // ash falling off the chains
      vec3 base = mix(uA, uB, hk(lf.y * 5.3 + k * 1.9)) + ringOut(normalize(uB - uA), hk(k + lf.y) * TAU) * uR.x;
      info = vec4(lf.x, 0.0, 1.0 - lf.x, 0.0);
      return vec4(base + (vec3(0.0, -lf.x * 0.42, 0.0) + uN * 0.03 * sin(lf.x * 6.0 + k)) * uScale, 0.015 * uScale);
    }
    vec3 axis = normalize(uB - uA);   // wisps trailing the bands
    vec3 base = mix(uA, uB, 0.5) + ringOut(axis, TAU * (k / 8.0 + hk(lf.y + k))) * uR.x;
    info = vec4(lf.x, 0.0, (1.0 - lf.x) * (0.45 + 0.55 * uGain), 0.0);
    return vec4(base + (-uVel * lf.x * 0.3 + vec3(0.0, lf.x * 0.12, 0.0)) * uScale, 0.02 * uScale * (1.0 - 0.6 * lf.x));
  }
  if (uPiece == 3 && uPart == 1) {   // the footfall embers
    vec4 tr = uTrail[int(k)];
    if (tr.w < 0.0 || tr.w > 1.0) return vec4(0.0);
    info = vec4(tr.w, 2.0, 1.0 - tr.w, 0.0);
    return vec4(tr.xyz + vec3(0.0, 0.02, 0.0), 0.07 * uScale * (1.0 - 0.6 * tr.w));
  }
  if (uPiece == 3 || uPiece == 8) {   // sparks rising off the shins
    float L = 1.0 + mod(k, 2.0); vec2 lf = lifeOf(k, L);
    vec3 axis = normalize(uB - uA);
    vec3 base = mix(uA, uB, hk(lf.y * 3.7 + k) * 0.7) + ringOut(axis, hk(k * 1.3 + lf.y) * TAU) * uR.x * 1.1;
    info = vec4(lf.x, 0.0, (1.0 - lf.x) * (0.35 + 0.65 * uGain), 0.0);
    return vec4(base + vec3(0.0, lf.x * 0.36, 0.0) * uScale + uN * 0.03 * sin(k + lf.x * 5.0) * uScale, 0.013 * uScale);
  }
  return vec4(0.0);
}
`;

export const ARMORY_VS = `${HEAD}layout(location = 0) in vec2 aP;
uniform mat4 uVP;
uniform vec3 uCamPos, uCamRight, uCamUp;
uniform float uLift;
uniform vec4 uTrail[${ARMORY_TRAIL}];
out vec2 vArm;   // the surface's point; the fragment hands it on as vP
out vec3 vWorld;
out vec4 vS;
${SHARED}${CARDS_GLSL}
void main() {
  vec3 p;
  if (uMesh == ${TUBE}) {   // a tube round the segment uA..uB, its radius uR.x at uA and uR.y at uB, u = 0 toward uN
    vec3 ax = uB - uA; float L = max(length(ax), 1e-4); vec3 t = ax / L;
    vec3 n1 = uN - t * dot(uN, t);
    n1 = length(n1) > 1e-3 ? normalize(n1) : normalize(cross(t, abs(t.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 n2 = cross(t, n1);
    float a = aP.x * TAU;
    vec3 nrm = n1 * cos(a) + n2 * sin(a);
    p = uA + ax * aP.y + nrm * mix(uR.x, uR.y, aP.y);
    vArm = aP;
    vS = vec4(dot(nrm, normalize(uCamPos - p)), L, 0.0, 0.0);
  } else {
    float k = floor(aP.x * 0.5); vec2 c = vec2(aP.x - 2.0 * k, aP.y) * 2.0 - 1.0;
    vArm = c;
    if (uMesh == ${DECAL}) {   // a decal facing uN, its up uU, a half-width uSize
      vec3 right = normalize(cross(uU, uN)), up = normalize(cross(uN, right));
      p = uA + (right * c.x + up * c.y) * uSize;
      vS = vec4(0.0);
    } else {
      vec4 info; vec4 cs = cardAt(k, info);
      p = cs.xyz + (uCamRight * c.x + uCamUp * c.y) * cs.w;
      vS = info;
    }
  }
  p += normalize(uCamPos - p) * uLift;   // THE CARD LAW: a sprite's pieces on the card's near side
  vWorld = p;
  gl_Position = uVP * vec4(p, 1.0);
}
`;

/** THE PIECES' LOOKS. Each answers its part's light at the fragment: vP the tube's (round, along) or the card's and the
 *  decal's (-1..1)², vS the tube's facing and length or the card's age, kind and light. */
const LOOKS_GLSL = `
vec3 eternalRamp(float v) {
  vec3 c = mix(${v3(ETERNAL_RGB.deep)}, ${v3(ETERNAL_RGB.blue)}, smoothstep(0.08, 0.4, v));
  c = mix(c, ${v3(ETERNAL_RGB.violet)}, smoothstep(0.4, 0.65, v));
  c = mix(c, ${v3(ETERNAL_RGB.heart)}, smoothstep(0.65, 0.85, v));
  return mix(c, ${v3(ETERNAL_RGB.core)}, smoothstep(0.85, 1.0, v));
}
vec3 ramp(float v) { return uPiece < 5 ? fireRamp(v) : eternalRamp(v); }
float beatAt(float ph, float c, float w) { float d = abs(fract(ph - c + 0.5) - 0.5); return exp(-d * d / (w * w)); }
float heartBeat() { float ph = fract(uTime ${hz(ARMORY_HZ.beat)} + uSeed); return beatAt(ph, 0.08, 0.07) + 0.6 * beatAt(ph, 0.32, 0.08); }   // each wearer's heart its own beat
// a soft round card: an ember, a mote, a spark; a star for the Origin's spark
vec3 cardLight() {
  float d = length(vP);
  if (vS.y > 0.5 && vS.y < 1.5) {
    if (uPiece == 5) { float star = max(exp(-abs(vP.x) * 14.0 - abs(vP.y) * 2.6), exp(-abs(vP.y) * 14.0 - abs(vP.x) * 2.6)) + exp(-d * d * 9.0); return ramp(0.92) * star * 0.9; }
    float g = exp(-d * d * 4.0) * (1.0 - smoothstep(0.7, 1.0, d));
    float beat = uPiece == 1 ? heartBeat() : 0.6;
    return ramp(0.55 + 0.2 * beat) * g * (0.18 + 0.22 * beat) * uFace;
  }
  float e = pow(max(1.0 - d, 0.0), 2.0) * vS.z;
  if (uPiece == 2) return mix(vec3(0.1, 0.09, 0.085), fireRamp(0.62), (1.0 - smoothstep(0.2, 0.75, vS.x))) * e * 0.8;   // ash: an ember greying as it falls
  if (vS.y > 1.5) return fireRamp(0.85 - 0.55 * vS.x) * e * (0.85 + 0.15 * sin(TAU * (uTime * 2.0 + vS.x))) * 0.9;   // a footfall ember burning out
  return ramp(0.95 - 0.55 * vS.x) * e * (uPiece == 1 ? uFace : 1.0);
}
// two nearest cell distances of a periodic Voronoi lattice - the edges between its cells are where d.y - d.x is small
vec2 cellsP(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p), d = vec2(8.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y)), c = mod(i + g, per);
    float e = length(g + vec2(h21(c), h21(c + 17.3)) * 0.8 + 0.1 - f);
    d = e < d.x ? vec2(e, d.x) : vec2(d.x, min(d.y, e));
  }
  return d;
}
float lineAt(float d, float w) { return 1.0 - smoothstep(w * 0.4, w, abs(d)); }
// CROWN OF THE BURNING DOOR: a circlet of molten iron (part 0) - two rims, rivets, a glint running round - and over it
// horns of flame, tall and short by turns (part 2), with the Door itself at the brow: a pointed arch of white fire, the
// Deadlands burning through it
vec3 crownLight() {
  float u = vP.x, v = vP.y;
  float n = fbmP(vec2(u * 28.0, v * 2.5 - uTime * 2.4), vec2(28.0, 288.0));
  float uf = abs(fract(u + 0.5) - 0.5);   // 0 at the brow, 0.5 at the back
  if (uPart == 0) {
    float rims = exp(-pow((v - 0.14) / 0.08, 2.0)) + exp(-pow((v - 0.86) / 0.08, 2.0));
    float rivet = pow(max(cos(TAU * 14.0 * u), 0.0), 30.0) * exp(-pow((v - 0.5) / 0.14, 2.0)) * smoothstep(0.03, 0.06, uf);
    float gd = abs(fract(u - uTime ${hz(ARMORY_HZ.spark)} + 0.5) - 0.5), glint = exp(-gd * gd * 900.0) * (0.4 + 0.6 * rims);
    float key = exp(-pow(uf / 0.025, 2.0)) * (1.0 - smoothstep(0.6, 1.0, v));   // the Door's sill, the circlet's front
    float heat = 0.28 + 0.16 * n + 0.42 * rims + 0.5 * rivet + 0.45 * glint + 0.4 * key;
    return fireRamp(clamp(heat, 0.0, 1.0)) * (0.55 + 0.45 * (1.0 - abs(vS.x))) * (0.35 + 0.65 * smoothstep(0.25, 0.6, heat));
  }
  float circ = TAU * (0.133 - 0.058 * v), y = v * 0.27, x = uf * circ;   // metres across from the brow and up the horns
  float wob = (n - 0.5) * 0.35 * v;
  float dT = abs(fract(u * 7.0 + 0.5 + wob) - 0.5) / 7.0, dS = abs(fract(u * 7.0 + wob) - 0.5) / 7.0;   // the nearest tall horn, and short
  float hT = 0.8 + 0.2 * vnoiseP(vec2(floor(u * 7.0 + 0.5), uTime * 1.5), vec2(7.0, 180.0));
  float hS = 0.42 + 0.14 * vnoiseP(vec2(floor(u * 7.0) + 11.0, uTime * 1.5), vec2(7.0, 180.0));
  float wT = 0.034 * pow(max(1.0 - v / hT, 0.0), 0.75) + 0.002, wS = 0.026 * pow(max(1.0 - v / hS, 0.0), 0.8) + 0.002;
  float tall = (1.0 - smoothstep(wT * 0.25, wT, dT)) * step(v, hT) * smoothstep(0.05, 0.09, x);   // none where the Door stands
  float stub = (1.0 - smoothstep(wS * 0.25, wS, dS)) * step(v, hS);
  float core = max(tall * (1.0 - smoothstep(0.0, wT * 0.45, dT)), stub * (1.0 - smoothstep(0.0, wS * 0.45, dS)));
  float low = (1.0 - smoothstep(0.0, 0.32, v)) * (0.35 + 0.65 * n);
  float heat = max(max(tall * (0.82 - 0.62 * v / hT), stub * (0.72 - 0.55 * v / hS)) * (0.75 + 0.3 * n) + 0.22 * core, low * 0.6);
  // THE DOOR: straight jambs to 0.09 m, then a pointed arch to 0.17 m; its frame white-hot, the Deadlands swirling in it
  float jamb = 0.042 * (y < 0.09 ? 1.0 : pow(max(1.0 - (y - 0.09) / 0.08, 0.0), 0.6));
  float frame = lineAt(x - jamb, 0.007) * step(y, 0.17) + lineAt(y - 0.006, 0.006) * step(x, 0.042);
  float inside = step(x, jamb) * step(y, 0.17);
  float swirl = fbmP(vec2(u * 56.0 + v * 6.0, v * 5.0 - uTime * 2.4), vec2(56.0, 288.0));
  heat = max(heat * (1.0 - inside), max(frame * (0.88 + 0.12 * n), inside * (0.25 + 0.55 * swirl * swirl)));
  return fireRamp(clamp(heat, 0.0, 1.0)) * smoothstep(0.02, 0.15, heat) * 0.85;
}
// EMBER HEART: a coal crusted in plates, molten in their cracks, beating; veins of fire running out from it across the
// ribs, a pulse along them each beat, and fine capillaries off them
vec3 heartLight() {
  float r = length(vP), a = atan(vP.y, vP.x) / TAU + 0.5;
  float beat = heartBeat();
  float coal = 1.0 - smoothstep(0.08, 0.36, r);
  vec2 cd = cellsP(vec2(a * 9.0, r * 7.0), vec2(9.0, 64.0));
  float crack = 1.0 - smoothstep(0.02, 0.1, cd.y - cd.x);
  float plate = 0.32 + 0.18 * vnoiseP(vec2(a * 24.0, r * 6.0), vec2(24.0, 64.0));
  float coalHeat = mix(plate * (0.7 + 0.3 * beat), 0.72 + 0.28 * beat, crack) + 0.35 * (1.0 - smoothstep(0.0, 0.14, r)) * beat;
  float ridge = 1.0 - abs(2.0 * vnoiseP(vec2(a * 9.0, r * 4.0 + 3.0), vec2(9.0, 64.0)) - 1.0);
  float fine = 1.0 - abs(2.0 * vnoiseP(vec2(a * 23.0, r * 9.0 + 7.0), vec2(23.0, 128.0)) - 1.0);
  float reach = (1.0 - smoothstep(0.3, 0.98, r)) * smoothstep(0.14, 0.32, r);
  float veins = pow(ridge, 9.0) * reach, caps = pow(fine, 22.0) * (1.0 - smoothstep(0.35, 0.9, r)) * smoothstep(0.2, 0.4, r);
  float wave = pow(0.5 + 0.5 * cos(TAU * (r * 1.6 - uTime ${hz(ARMORY_HZ.beat)} - uSeed)), 3.0);
  float ribY = vP.y + 0.42 * vP.x * vP.x, ribs = exp(-pow((fract(ribY * 3.4) - 0.5) / 0.05, 2.0)) * smoothstep(0.32, 0.55, abs(vP.x)) * (1.0 - smoothstep(0.75, 0.95, r));
  float heat = max(coal * coalHeat, max(veins * (0.3 + 0.45 * wave + 0.25 * beat), max(caps * (0.22 + 0.4 * wave), ribs * wave * 0.32)));
  return fireRamp(heat) * smoothstep(0.03, 0.12, heat) * uFace * 0.92;
}
// ASHBOUND BRACERS: a chain of iron wound round the limb - its links by turns flat (an oval) and edge-on (a bar) -
// molten inside, a fire running along it; here and there a link gone to dull coal, and a smoulder on the limb between
vec3 chainLight() {
  float u = vP.x, v = vP.y, L = vS.y;
  float turns = max(1.0, floor(L / 0.075));
  float p = u + v * turns, across = fract(p) - 0.5, S = (u - floor(p)) * 14.0;   // across the strand in pitches; along it in links
  float le = S - 2.0 * floor(S * 0.5 + 0.5), lo = S - 1.0 - 2.0 * floor((S - 1.0) * 0.5 + 0.5);
  float ed = length(vec2(le / 1.05, across / 0.36));
  float ring = lineAt(ed - 0.8, 0.22), rim = lineAt(ed - 0.8, 0.08);
  float bar = (1.0 - smoothstep(0.06, 0.11, abs(across))) * (1.0 - smoothstep(0.7, 0.9, abs(lo)));
  float link = floor(S * 0.5 + 0.5) * 2.0 + (bar > ring ? 1.0 : 0.0);
  float cool = step(0.84, h21(vec2(link, floor(p))));
  float run = 0.5 + 0.5 * cos(TAU * (S / 28.0 - uTime / 2.0));
  float n = vnoiseP(vec2(u * 16.0, v * 8.0 - uTime * 1.5), vec2(16.0, 180.0));
  float chain = max(ring, bar);
  float heat = chain * mix(0.42 + 0.3 * run + 0.18 * n, 0.24 + 0.06 * n, cool) + 0.22 * max(rim, bar * 0.7) * (1.0 - cool) + 0.05 * n;
  return fireRamp(clamp(heat, 0.0, 1.0)) * (chain * 1.1 + 0.06 * n) * (0.6 + 0.4 * (1.0 - abs(vS.x)));
}
// CINDERSTRIDE: a ring of cracked coal at the ankle and two sheets of flame licking up the shin from it, a hot core
// in each tongue. ETERNAL GREAVES: blue-violet flame from the foot to the knee, under a lattice of light winding up the
// leg and a band at the knee with the Origin's spark at its front
vec3 legLight() {
  float u = vP.x, v = vP.y;
  bool eternal = uPiece == 8;
  float twist = eternal ? v * 0.6 : 0.0;
  float n = fbmP(vec2((u + twist) * 20.0, v * 2.0 - uTime * 2.4), vec2(20.0, 288.0));
  float n2 = fbmP(vec2((u - twist) * 13.0 + 5.0, v * 1.5 - uTime * 2.4), vec2(13.0, 288.0));
  float tongues = pow(0.5 + 0.5 * cos(TAU * ((u + twist) * 7.0 + n * 0.6)), 1.5);
  float h = (eternal ? 0.95 : 0.72) * (0.42 + 0.5 * tongues * n + 0.3 * n);
  float h2 = (eternal ? 0.7 : 0.55) * (0.4 + 0.6 * n2);   // the second sheet, lower and slower
  float edge = h - v, edge2 = h2 - v;
  float flame = smoothstep(0.0, 0.12, edge) * smoothstep(0.0, 0.14, v);   // none of it where the leg meets the ground
  float flame2 = smoothstep(0.0, 0.1, edge2) * smoothstep(0.0, 0.14, v) * 0.55;
  float core = pow(tongues, 3.0) * smoothstep(0.1, 0.4, edge) * 0.25;
  float top = eternal ? 0.68 : 0.95;   // AUDIT ARMORY: the greaves short of the Eternal's white core - their near and far sides add
  float heat = clamp(max(edge / max(h, 0.05) * (eternal ? 0.8 : 1.05) + 0.15 * n + core, edge2 / max(h2, 0.05) * 0.7), 0.0, top);
  vec3 c = ramp(heat) * max(flame, flame2) * (eternal ? 0.6 : 0.8);
  if (!eternal) {
    vec2 cd = cellsP(vec2(u * 26.0, v * 9.0), vec2(26.0, 64.0));
    float ring = exp(-pow((v - 0.17) / 0.05, 2.0)), crack = 1.0 - smoothstep(0.02, 0.09, cd.y - cd.x);
    c += fireRamp(0.3 + 0.55 * crack + 0.12 * n) * ring * (0.3 + 0.7 * crack) * 0.7;
  } else {
    float l1 = lineAt(fract(u * 3.0 + v * 2.2 + 0.5) - 0.5, 0.035), l2 = lineAt(fract(u * 3.0 - v * 2.2 + 0.5) - 0.5, 0.035);
    float lattice = max(l1, l2) * smoothstep(0.12, 0.2, v) * (1.0 - smoothstep(0.82, 0.88, v));
    float knee = lineAt(v - 0.9, 0.035), uf = abs(fract(u + 0.5) - 0.5);
    float star = exp(-pow(uf / 0.012, 2.0) - pow((v - 0.9) / 0.09, 2.0) * 0.4) + exp(-pow(uf / 0.05, 2.0) - pow((v - 0.9) / 0.02, 2.0));
    float dd = abs(fract(u * 3.0 + v * 2.2 - uTime ${hz(ARMORY_HZ.halo)} + 0.5) - 0.5);
    c += eternalRamp(0.58 + 0.2 * exp(-dd * dd * 60.0)) * lattice * 0.38 + eternalRamp(0.6) * knee * 0.45 + eternalRamp(0.85) * min(star, 1.0) * 0.5;
  }
  return c;
}
// ETERNAL HALO: a band of blue-violet fire between two bright rims, the Origin's runes round it, a comet of light running
// round with its tail. ETERNAL ARMLETS: the same band low on the arm, a chain of diamonds engraved on it, flames licking
// up off its upper rim
vec3 ringLight() {
  float u = vP.x, v = vP.y;
  bool halo = uPiece == 5;
  float n = fbmP(vec2(u * 40.0, v * 2.0 - uTime * 2.4), vec2(40.0, 288.0));
  float s = fract(u - uTime ${hz(ARMORY_HZ.halo)});
  float comet = exp(-s * 14.0) * 0.85 + exp(-pow(min(s, 1.0 - s) / 0.012, 2.0)) * 0.6;
  if (halo) {
    float rims = lineAt(v - 0.12, 0.1) + lineAt(v - 0.88, 0.1);
    float g = floor(u * 36.0), gx = fract(u * 36.0) - 0.5, gy = v - 0.5, kind = floor(h21(vec2(g, 3.0)) * 3.0);
    float rune = kind < 1.0 ? lineAt(gx, 0.09) * (1.0 - smoothstep(0.18, 0.26, abs(gy)))   // a stroke
      : kind < 2.0 ? lineAt(abs(gx) * 1.6 + abs(gy) - 0.28, 0.07)   // a diamond
      : exp(-(gx * gx + gy * gy) / 0.006);   // a point
    float heat = 0.26 + 0.2 * n + 0.32 * rims + 0.34 * rune + 0.5 * comet;
    return eternalRamp(clamp(heat, 0.0, 1.0)) * (0.45 + 0.55 * (1.0 - abs(vS.x))) * 0.85;
  }
  float bandV = v / 0.4, inBand = step(v, 0.4);
  float rims = lineAt(bandV - 0.12, 0.12) + lineAt(bandV - 0.88, 0.12);
  float dx = abs(fract(u * 16.0) - 0.5), diamond = lineAt(dx * 1.5 + abs(bandV - 0.5) - 0.32, 0.08);
  float band = inBand * (0.22 + 0.18 * n + 0.38 * rims + 0.32 * diamond + 0.42 * comet);
  float flick = smoothstep(0.36, 0.44, v) * (1.0 - smoothstep(0.44, 0.66 + 0.34 * n, v));   // flames licking up off the band
  float heat = max(band, flick * (0.3 + 0.32 * n + 0.3 * comet));
  return eternalRamp(clamp(heat, 0.0, 0.9)) * max(inBand, flick) * (0.45 + 0.55 * (1.0 - abs(vS.x))) * 0.62;
}
// ETERNAL SIGIL: the Origin's ouroboros - a dragon of light in scales biting its own tail, its eye bright - round the
// spark, a ring of runes inside it and rays turning slowly out from the spark; ticks at the rim. On the chest and the back
vec3 sigilLight() {
  float r = length(vP), a = atan(vP.y, vP.x) / TAU + 0.5;
  float ga = fract(a - 0.25 + 0.5) - 0.5;   // round from the mouth: the head just past it, the tail just before
  float head = exp(-pow((ga - 0.06) / 0.03, 2.0)), taper = (1.0 - smoothstep(-0.22, -0.02, ga)) * step(ga, 0.0) + step(0.0, ga);
  float w = 0.055 * (0.35 + 0.65 * taper + 0.7 * head) * step(0.012, abs(ga) + step(0.0, ga) * 0.02);
  float across = (r - 0.62) / max(w, 1e-3);
  float body = 1.0 - smoothstep(0.7, 1.0, abs(across));
  float t = a * 48.0, sx = fract(t) - 0.5, scale = lineAt(across - (-0.6 + 1.1 * (1.0 - 4.0 * sx * sx)), 0.2) * body;
  float edgeL = lineAt(abs(across) - 0.85, 0.2) * body;
  float eye = exp(-(pow((ga - 0.075) * 3.9 / 0.08, 2.0) + pow((across - 0.35) / 0.25, 2.0)));
  float dd = abs(fract(a - uTime ${hz(ARMORY_HZ.sigil)} + 0.5) - 0.5), run = exp(-dd * dd * 120.0);
  float ring = body * (0.32 + 0.3 * run) + scale * 0.32 + edgeL * 0.35 + eye * 1.1;
  float ticks = exp(-pow((r - 0.82) / 0.03, 2.0)) * pow(max(cos(TAU * 12.0 * a), 0.0), 24.0);
  float rg = floor(a * 24.0), rx = fract(a * 24.0) - 0.5, ry = (r - 0.44) / 0.05;
  float runes = (h21(vec2(rg, 9.0)) < 0.5 ? lineAt(rx, 0.12) * (1.0 - smoothstep(0.6, 0.9, abs(ry))) : lineAt(abs(rx) * 1.4 + abs(ry) * 0.5 - 0.3, 0.1)) * (1.0 - smoothstep(0.9, 1.3, abs(ry)));
  float ra = fract(a * 8.0 + uTime ${hz(ARMORY_HZ.orbit)}) - 0.5, rays = exp(-pow(ra / 0.02, 2.0)) * smoothstep(0.08, 0.16, r) * (1.0 - smoothstep(0.2, 0.36, r));
  float star = max(exp(-abs(vP.x) * 16.0 - abs(vP.y) * 3.5), exp(-abs(vP.y) * 16.0 - abs(vP.x) * 3.5)) * (1.0 - smoothstep(0.0, 0.5, r));
  float heat = ring + ticks * 0.6 + runes * 0.4 + rays * 0.35 + star * (0.75 + 0.25 * sin(TAU * uTime ${hz(ARMORY_HZ.spark)}));
  return eternalRamp(0.3 + 0.7 * min(heat, 1.0)) * min(heat, 1.2) * uFace * 0.85;
}
// THANKS-POST: CRYSTAL SPURS - a cone of crystal, six facets round it lit by the eye, its colour turning slowly through the
// prism from root to tip (each spur its own phase, uPart), its tip brightest, a glint running up its edges now and then
vec3 prism(float h) {
  float x = fract(h) * 3.0;
  vec3 a = ${v3(PRISM_RGB[0])}, b = ${v3(PRISM_RGB[1])}, c = ${v3(PRISM_RGB[2])};
  return x < 1.0 ? mix(a, b, smoothstep(0.0, 1.0, x)) : x < 2.0 ? mix(b, c, smoothstep(1.0, 2.0, x)) : mix(c, a, smoothstep(2.0, 3.0, x));
}
vec3 crystalLight() {
  float f = vP.x * 6.0, facet = floor(f);
  float lit = 0.3 + 0.7 * clamp(vS.x, 0.0, 1.0) * (0.75 + 0.25 * sin(facet * 2.1 + 1.3));
  float edge = lineAt(min(fract(f), 1.0 - fract(f)), 0.08);
  float h = uTime ${hz(ARMORY_HZ.prism)} + uSeed + float(uPart) * 0.17 + vP.y * 0.35;
  float tip = smoothstep(0.5, 1.0, vP.y);
  float run = fract(uTime ${hz(ARMORY_HZ.glint)} + float(uPart) * 0.29), g = (vP.y - run * 1.4 + 0.2) / 0.08, glint = exp(-g * g) * edge;   // AUDIT lane 3: never pow() of a negative
  return (prism(h) * (lit * (0.45 + 0.55 * tip) + edge * 0.25) + vec3(1.0) * glint * 0.6) * ${ARMORY_SPUR_GAIN.toFixed(2)};
}
`;

export const ARMORY_FS = `${HEAD}in vec2 vArm;
vec2 vP;   // the point every look answers (main sets it)
in vec3 vWorld;
in vec4 vS;
uniform float uKindle;
uniform sampler2D uArms;
uniform float uMirror;   // AUDIT GUILD-SHOP R3: -1 under a mirrored projection (the game's mirrorProjectionX), so the crest reads true
uniform vec3 uInk, uField;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
uniform float uPixel;   // 1 the light cut to the auras' levels - the pass sets it; 0 as drawn
uniform vec4 uClip;     // a sprite's arm piece kept where uClip.xyz . p + uClip.w >= 0 (armClip) - 0 keeps all
out vec4 o;
${FOG_FACTOR_GLSL}${AURA_NOISE_GLSL}${AURA_PIXEL_GLSL}${SHARED}${LOOKS_GLSL}
/** GUILD-SHOP: the Insignia Armlet - a gilt band with the guild's field enamelled between its rims and its ink run round
 *  the middle, the crest (the arms on a gilt shield, uArms) on the band's outer face, and a soft glow of the ink behind
 *  it. Colour over what is behind (alpha), the glow alone added (alpha 0). */
vec4 insigniaLight() {
  if (uMesh == ${TUBE}) {
    if (vS.x < -0.05) discard;   // the band's far side, behind the arm
    float shade = 0.45 + 0.55 * clamp(vS.x, 0.0, 1.0), y = vP.y;
    float rim = clamp(step(y, 0.24) + step(0.76, y), 0.0, 1.0);
    float bead = clamp(lineAt(y - 0.24, 0.05) + lineAt(y - 0.76, 0.05), 0.0, 1.0);
    float engrave = 0.5 + 0.5 * sin(vP.x * TAU * 24.0 + step(0.5, y) * 1.6);
    vec3 gold = mix(vec3(0.5, 0.32, 0.08), vec3(1.0, 0.82, 0.42), 0.65 + 0.35 * engrave);
    vec3 enamel = mix(uField, uInk, lineAt(y - 0.5, 0.06));
    vec3 c = mix(enamel, gold, max(rim, bead)) * shade;
    float glint = pow(max(0.0, sin((vP.x - uTime ${hz(ARMORY_HZ.band)} + uSeed) * TAU)), 24.0) * rim;
    return vec4(c + vec3(1.0, 0.95, 0.8) * glint * 0.8 * shade, 1.0);
  }
  if (uPart == 2) {
    float pulse = 0.75 + 0.25 * sin((uTime ${hz(ARMORY_HZ.crest)} + uSeed) * TAU);
    float g = (1.0 - smoothstep(0.35, 1.0, length(vP))) * 0.22 * pulse * uFace;
    return vec4(mix(uInk, vec3(1.0, 0.85, 0.5), 0.35) * g, 0.0);
  }
  vec2 uv = vec2(vP.x * uMirror * 0.5 + 0.5, 0.5 - vP.y * 0.5);
  vec4 t = texture(uArms, uv);
  float sheen = lineAt(fract((uv.x + uv.y) * 0.5 - uTime ${hz(ARMORY_HZ.crest)} + uSeed) - 0.5, 0.08) * 0.35;
  float seen = smoothstep(0.0, 0.25, uFace);   // AUDIT GUILD-SHOP R7: from behind the arm, none of it
  return vec4(t.rgb * (0.7 + 0.3 * uFace) + t.a * sheen * vec3(1.0, 0.95, 0.8), t.a) * seen;
}
void armoryLook() {
  vec3 c;
  if (uPiece == ${ARMLET}) {   // GUILD-SHOP
    vec4 a = insigniaLight();
    float k = uKindle * fogFactorAt(vWorld);
    o = vec4(max(a.rgb, vec3(0.0)) * k, a.a * k);
    return;
  }
  if (uMesh == ${CARDS}) c = cardLight();
  else if (uPiece == 0) c = crownLight();
  else if (uPiece == 1) c = heartLight();
  else if (uPiece == 2) c = chainLight();
  else if (uPiece == 3 || uPiece == 8) c = legLight();
  else if (uPiece == 5 || uPiece == 7) c = ringLight();
  else if (uPiece == 6) c = sigilLight();
  else if (uPiece == ${SPURS}) c = crystalLight();   // THANKS-POST
  else c = vec3(0.0);   // the weapon's pieces are the weapon glow's (systems/weaponGlow.js law 7), never drawn here
  o = vec4(max(c, vec3(0.0)) * uKindle * fogFactorAt(vWorld), 1.0);
}
// the armlet covers (its crest's colour kept, its cover cut); every other piece adds light
void main() {
  if (dot(uClip.xyz, vWorld) + uClip.w < 0.0) discard;   // past the painted arm's inner edge
  vP = vArm;
  armoryLook();
  // a piece is a hand's breadth of fine work (links, veins, facets) - snapped even to half a flat's pixel its detail was
  // noise at the body's own distance, so it takes the levels alone, dithered on the screen's
  if (uPixel > 0.5) { auraCell = floor(gl_FragCoord.xy); o = auraPixel(o, uPiece == ${ARMLET}); }
}
`;

const _programs = new Map();
/** ONE PROGRAM A PIECE - the sources with `uPiece` declared a constant, so the compiler drops every other piece's code
 *  (the auras' AURA-SPLIT law). Pure. @param {number} piece @returns {ReadonlyArray<readonly [string, string]>} */
export function armoryPrograms(piece) {
  let p = _programs.get(piece);
  if (!p) {
    const one = (/** @type {string} */ src) => { if (src.split('uniform int uPiece;').length !== 2) throw new Error('armory: uPiece not declared exactly once'); return src.replace('uniform int uPiece;', `const int uPiece = ${piece | 0};`); };
    _programs.set(piece, (p = Object.freeze([Object.freeze([one(ARMORY_VS), one(ARMORY_FS)])])));
  }
  return p;
}
/** The pieces this pass draws - every one but the weapon's (the weapon glow draws those on the weapon itself). */
export const ARMORY_BODY_PIECES = Object.freeze(ARMORY_PIECES.filter((p) => p.slot !== 'weapon').map((p) => p.key));
/** Every body piece's program - what the boot's idle starts (render/playPrograms.js). */
export const ARMORY_PROGRAMS = /** @type {ReadonlyArray<readonly [string, string]>} */ (Object.freeze(ARMORY_BODY_PIECES.flatMap((k) => armoryPrograms(ARMORY_PIECES.findIndex((p) => p.key === k)))));
const UNIFORMS = Object.freeze(['uVP', 'uCamPos', 'uCamRight', 'uCamUp', 'uLift', 'uTrail', 'uMesh', 'uPart', 'uA', 'uB', 'uN', 'uU', 'uVel', 'uR', 'uTime', 'uSeed', 'uScale', 'uSize', 'uGain', 'uFace', 'uKindle', 'uFogMode', 'uFogDensity', 'uFogRange', 'uFocus', 'uJungleHaze', 'uArms', 'uInk', 'uField', 'uMirror', 'uPixel', 'uClip']);   // GUILD-SHOP: the armlet's crest and colours

/** A tube's grid: `round` steps round by `along` along, two triangles a cell, as (round, along) pairs. Pure. */
export function armoryTubeGrid(round = ARMORY_ROUND, along = ARMORY_ALONG) {
  const out = [];
  for (let j = 0; j < along; j++) for (let i = 0; i < round; i++) {
    const u0 = i / round, u1 = (i + 1) / round, v0 = j / along, v1 = (j + 1) / along;
    out.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }
  return new Float32Array(out);
}
/** The cards: card k's six corners as (k * 2 + u, v). Pure. */
export function armoryCards(n = ARMORY_CARDS) {
  const out = [];
  for (let k = 0; k < n; k++) for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) out.push(k * 2 + u, v);
  return new Float32Array(out);
}

// ── THE RECIPES: what each worn piece draws on a pose ─────────────────

const sub = (/** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>} */ b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (/** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>} */ b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = (/** @type {ArrayLike<number>} */ a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (/** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>} */ b, /** @type {number} */ t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const UP = Object.freeze([0, 1, 0]);

/**
 * THE HEAD PIECE'S TIP on wearer `w` (armoryDraws' wearer, its kit `w.kit`): the world height of the highest thing its
 * head piece keeps drawn - the crown's flames, the halo's ring and its motes (the embers that drift up off the crown and
 * fade are left out) - or null with no head piece. A plate over the head stands clear of it (ui/characterSlots.js, the
 * world's names: scenes/auraHost.js nameTopOf). A sprite's points move across its card, never up it. Pure.
 * @param {any} w
 */
export function armoryHeadTip(w) {
  const key = armoryKitPieces(w?.kit).head, pose = w?.pose;
  if (!key || !pose) return null;
  const s = pose.scale > 0 ? pose.scale : 1, at = w.at ?? [0, 0, 0], yaw = Number.isFinite(w.yaw) ? w.yaw : 0;
  const pt = (/** @type {string} */ n) => /** @type {number[]} */ (poseWorld(pose, n, at, yaw, [0, 0, 0]));
  const head = pt('head'), up = unit(sub(head, pt('neck'))), across = Math.sqrt(Math.max(0, 1 - up[1] * up[1]));
  if (key === 'burningcrown') { const C = ARMORY_HEAD.burningcrown; return head[1] + up[1] * (C.brow + C.band + C.flame) * s + C.tip * across * s; }
  if (key === 'eternalhalo') {
    const H = ARMORY_HEAD.eternalhalo, axis = unit(add(up, [Math.sin(yaw), 0, Math.cos(yaw)], -H.tilt));
    const c = add(pt('crown'), up, H.lift * s);
    return c[1] + (H.orbit * H.r * Math.sqrt(Math.max(0, 1 - axis[1] * axis[1])) + H.bob + H.mote) * s;
  }
  return null;
}

/**
 * GUILD-SHOP: THE SIDE OF THE POSE A BODY'S ARM IS (`arm` 'left' or 'right'). A rig's `L` points are its left bones; a
 * sprite's are the picture's left as seen, so its left arm is the picture's right from before the chest. ARMORY-MIRROR:
 * a side view's arms are the body's own sides, as a rig's. From behind and to the other side, or from the other side,
 * every picture hides that arm: null. Pure. @param {any} pose @param {number[]} fwd @param {number[]} chest
 * @param {ArrayLike<number>} eye @param {'left'|'right'} [arm] @returns {'L'|'R'|null}
 */
export function armSide(pose, fwd, chest, eye, arm = 'left') {
  const own = arm === 'left' ? 'L' : 'R';
  if (!pose?.card) return own;
  const ex = eye[0] - chest[0], ez = eye[2] - chest[2], l = Math.hypot(ex, ez) || 1;
  const ahead = (ex * fwd[0] + ez * fwd[2]) / l, away = (arm === 'left' ? 1 : -1) * (ex * fwd[2] - ez * fwd[0]) / l;   // toward the body's other side
  if (away > ARM_HIDDEN_SIN && (ahead < 0 || (pose.armsTurned && ahead < ARM_HIDDEN_SIN))) return null;   // and from that side: its glow past the back
  if (pose.armsTurned) return own;
  return (ahead > 0) === (arm === 'left') ? 'R' : 'L';
}
/** THE SIDE A PIECE IS WORN ON, or null - armSide's, and on a card none on an arm never read clear
 *  of the body (no band) while the eye stands to the body's other side: that arm is the one the picture hides behind the
 *  torso, and its trace runs on the torso's edge. Pure. @param {any} pose @param {number[]} fwd @param {number[]} chest
 *  @param {ArrayLike<number>} eye @param {'left'|'right'} [arm] */
export function armWornSide(pose, fwd, chest, eye, arm = 'left') {
  const side = armSide(pose, fwd, chest, eye, arm);
  if (!side || !pose?.card || pose.armsTurned || pose.bands?.[side]) return side;
  const toEyeX = eye[0] - chest[0], toEyeZ = eye[2] - chest[2], reach = Math.hypot(toEyeX, toEyeZ) || 1;
  return (arm === 'left' ? 1 : -1) * (toEyeX * fwd[2] - toEyeZ * fwd[0]) / reach > ARM_HIDDEN_SIN ? null : side;
}
/** The Insignia Armlet's arm, the wearer's left. Pure. */
export const armletSide = (/** @type {any} */ pose, /** @type {number[]} */ fwd, /** @type {number[]} */ chest, /** @type {ArrayLike<number>} */ eye) => armSide(pose, fwd, chest, eye, 'left');
/** A SPRITE'S ARM PIECE STOPS AT ITS ARM'S INNER EDGE. A piece lies on the card's near side, so where an arm passes
 *  behind the painted torso the card hides nothing. Its draws keep the arm's side of the line its inner edge runs along -
 *  `half` in from `shoulder`..`elbow` toward the chest on the card - seen from the eye: [n, d], kept where n.p + d >= 0, or null
 *  with the eye on that line. Along the arm, so a slanting arm's own outline stays; off the chest on the card, since the
 *  chest lifted before it shifts across at a three-quarter. Pure. @param {number[]} shoulder @param {number[]} elbow
 *  @param {number} half @param {number[]} chest @param {ArrayLike<number>} right @param {ArrayLike<number>} eye */
export function armClip(shoulder, elbow, half, chest, right, eye) {
  const mid = mix(shoulder, elbow, 0.5), way = Math.sign((chest[0] - mid[0]) * right[0] + (chest[2] - mid[2]) * right[2]) || 1;
  const edge = [shoulder[0] + right[0] * way * half, shoulder[1], shoulder[2] + right[2] * way * half], down = sub(elbow, shoulder), toEdge = sub(edge, /** @type {any} */ (eye));
  let n = [down[1] * toEdge[2] - down[2] * toEdge[1], down[2] * toEdge[0] - down[0] * toEdge[2], down[0] * toEdge[1] - down[1] * toEdge[0]];
  const len = Math.hypot(n[0], n[1], n[2]);
  if (!(len > 1e-9)) return null;
  const toMid = sub(mid, /** @type {any} */ (eye)), side = n[0] * toMid[0] + n[1] * toMid[1] + n[2] * toMid[2] >= 0 ? 1 / len : -1 / len;
  n = n.map((axis) => axis * side);
  return [n[0], n[1], n[2], -(n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2])];
}
/** ARMORY-MIRROR: half an eighth of a turn's sine - past it, off the line straight behind, the picture is a three-quarter
 *  back view's (eotbBillboard.js RECORD_OFFSETS 3). */
export const ARM_HIDDEN_SIN = Math.sin(Math.PI / 8);

/**
 * WHAT A PIECE DRAWS on wearer `w` this frame - its draws `{ mesh, part, A, B, N, U, r, size, count, face, gain }` in the
 * world (`w.at`, `w.yaw`, `w.pose` - armoryPose.js), `eye` the camera, `near` whether its embers and motes are drawn. A
 * sprite's forearm and weapon are not (its pose's `limbs` 'upper'), nor a rider's legs, nor anything but the head on a body
 * sunk to its neck; the weapon's pieces draw nothing here (systems/weaponGlow.js law 7). `right` the billboard's right - a sprite's points stand off it where its picture draws them. Pure.
 * @param {string} key @param {any} w @param {ArrayLike<number>} eye @param {boolean} near @param {ArrayLike<number>|null} [right]
 */
export function armoryDraws(key, w, eye, near, right = null) {
  const pose = w.pose, s = pose.scale > 0 ? pose.scale : 1, at = w.at, yaw = Number.isFinite(w.yaw) ? w.yaw : 0;
  const pt = (/** @type {string} */ n) => /** @type {number[]} */ (poseWorld(pose, n, at, yaw, [0, 0, 0], 0, pose.card ? right : null));
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const floor = pose.card ? 0 : 0.35;   // on a card a decal seen edge on is gone - its picture has no face there
  const facing = (/** @type {number[]} */ p, /** @type {number[]} */ n) => { const e = unit(sub(/** @type {any} */ (eye), p)); return Math.max(0, Math.min(1, (n[0] * e[0] + n[1] * e[1] + n[2] * e[2]) * 1.6 + floor)); };
  const out = [];
  const tube = (part, A, B, r0, r1, N = fwd, spike = false) => out.push({ mesh: TUBE, part, A, B, N, U: UP, r: [r0 * s, r1 * s], size: 0, count: 0, face: 1, gain: 1, ...(spike ? { spike: true } : {}) });
  // embers and motes only near; a glow or the Origin's spark (`always`) at any distance the piece is drawn
  const cards = (part, count, A, B, U, r = [0, 0], size = 0, face = 1, gain = 1, always = false) => { if (near || always) out.push({ mesh: CARDS, part, A, B, N: fwd, U, r, size, count, face, gain }); };
  const decal = (part, A, N, size, face) => out.push({ mesh: DECAL, part, A, B: A, N, U: UP, r: [0, 0], size, count: 0, face, gain: 1 });
  const slot = ARMORY_PIECES[ARMORY_PIECE_INDEX[key]]?.slot;
  if (pose.sunk && slot !== 'head') return out;
  if (w.mounted && slot === 'legs') return out;
  const full = pose.limbs === 'full', speed = Math.min(1, Math.hypot(w.vel?.[0] ?? 0, w.vel?.[2] ?? 0) / 4);
  const head = pt('head'), up = unit(sub(head, pt('neck')));
  /** ARMORY-MIRROR: a body arm's upper arm as its picture paints it - null where the picture hides it (armSide). On its
   *  band (where it stands clear of the body) the shoulder and elbow are moved across onto it, `mid` the band and `k` its
   *  painted width over a piece `r0` round; a side view's onto the arm at the body's back edge, along the eye's line.
   *  `along(t)` its point `t` of the way from the shoulder to the elbow. */
  const upperArm = (/** @type {'left'|'right'} */ arm, /** @type {number} */ r0) => {
    const side = armWornSide(pose, fwd, pt('chest'), eye, arm);   // a far arm never read clear wears none
    if (!side) return null;
    const sh0 = pt(`sh${side}`), el0 = pt(`el${side}`);
    let sh = sh0, el = el0, mid = null, onArm = (/** @type {number[]} */ p) => p;
    const band = pose.card && right ? pose.bands?.[side] : null, flank = pose.card && pose.armsTurned && right ? pose.flank : null;
    if (band && right) {
      mid = [at[0] + right[0] * band.dx, at[1] + band.y, at[2] + right[2] * band.dx];
      const on = mix(sh, el, (mid[1] - sh[1]) / ((el[1] - sh[1]) || 1)), off = [mid[0] - on[0], 0, mid[2] - on[2]];
      sh = add(sh, off); el = add(el, off);
    } else if (flank && right) {   // toward the eye as far as that arm stands, so it stays on the painted arm
      const back = fwd[0] * right[0] + fwd[2] * right[2] < 0 ? flank.hi : flank.lo;
      onArm = (p) => { const card = [at[0] + right[0] * back, p[1], at[2] + right[2] * back], e = unit(sub(/** @type {any} */ (eye), card)); return add(card, e, (p[0] - at[0]) * e[0] + (p[2] - at[2]) * e[2]); };
      sh = onArm(sh0); el = onArm(el0);
    }
    const along = (/** @type {number} */ t) => (flank && !band ? onArm(mix(sh0, el0, t)) : mix(sh, el, t));
    const k = band ? band.w / (2 * r0 * s) : 1, chestOn = add(pt('chest'), fwd, -pose.pts[POSE_AT.chest + 2]);   // the chest on the card
    return { side, sh, el, mid, along, k, clip: pose.card && right ? armClip(sh, el, k * r0 * s, chestOn, right, eye) : null };
  };
  /** An arm's draws pushed since `from` take its clip (upperArm's) - none over the body. */
  const clipped = (/** @type {number} */ from, /** @type {number[]|null} */ clip) => { if (clip) for (let i = from; i < out.length; i++) out[i].clip = clip; };
  if (key === 'burningcrown') {
    const C = ARMORY_HEAD.burningcrown, brow = add(head, up, C.brow * s), r = C.r * s, top = add(brow, up, C.band * s);
    tube(0, brow, top, C.r, 0.133);
    tube(2, add(top, up, -0.005 * s), add(top, up, C.flame * s), 0.133, C.tip);
    cards(2, 10, top, top, up, [r, C.flame * s]);
  } else if (key === 'eternalhalo') {
    const H = ARMORY_HEAD.eternalhalo, axis = unit(add(up, fwd, -H.tilt)), c = add(pt('crown'), up, H.lift * s), r = H.r * s;
    tube(0, add(c, axis, -0.012 * s), add(c, axis, 0.012 * s), H.r, H.r);
    cards(1, 1, add(c, fwd, r), c, axis, [r, 0], 0.075 * s, 1, 1, true);
    cards(2, 8, c, c, axis, [r, 0]);
  } else if (key === 'emberheart' || key === 'eternalsigil') {
    // on a card a depth along the facing is laid on the eye's line through the picture's chest, so it never slides across
    // the picture as the eye goes round (laid along the facing, it slid 13 to 23 px off at a three-quarter)
    const chestZ = pose.pts[POSE_AT.chest + 2], onCard = (/** @type {number} */ z) => { const painted = add(pt('chest'), fwd, -chestZ), e = unit(sub(/** @type {any} */ (eye), painted)); return add(painted, e, z * (fwd[0] * e[0] + fwd[2] * e[2])); };
    const chest = pose.card ? onCard(chestZ) : pt('chest'), f = facing(chest, fwd);
    // from behind, the run at the chest's rows takes in the near arm hanging over the back - the Sigil's
    // back stands mid-way between the far edge and that arm's inner edge, never on the arm
    const backOnCard = (/** @type {number[]} */ point) => {
      const span = pose.chestSpan, worn = /** @type {const} */ (['left', 'right']).map((a) => armWornSide(pose, fwd, pt('chest'), eye, a)).filter(Boolean);
      if (!span || !right || worn.length !== 1) return point;
      const wornOn = worn[0], chestDx = pose.dx[POSE_AT.chest / 3], b = pose.bands?.[wornOn], arm = b ? b.dx : (pose.dx[POSE_AT[`sh${wornOn}`] / 3] + pose.dx[POSE_AT[`el${wornOn}`] / 3]) / 2;
      const half = b ? b.w / 2 : 0.06 * s, way = Math.sign(chestDx - arm) || 1, inner = Math.max(span[0], Math.min(span[1], arm + way * half));
      const shift = ((way > 0 ? span[1] : span[0]) + inner) / 2 - chestDx;
      return add(point, right, shift);
    };
    decal(0, chest, fwd, (key === 'emberheart' ? 0.14 : 0.12) * s, f);
    cards(1, 1, chest, chest, UP, [0, 0], (key === 'emberheart' ? 0.3 : 0.2) * s, f, 1, true);
    if (key === 'emberheart') cards(2, 8, chest, chest, UP, [0, 0], 0, f);
    else { const back = pose.card ? backOnCard(onCard(chestZ - 0.24 * s)) : add(chest, fwd, -(pose.back > 0 ? pose.back : 0.27 * s)), nb = [-fwd[0], 0, -fwd[2]]; decal(0, back, nb, 0.13 * s, facing(back, nb)); }   // AUDIT ARMORY: a rig's back clear of its torso - a Morrowind body's back stands about 0.22 m behind its chest's face (WOLF-KIT: the wolf's its pose's `back`)
  } else if (key === 'ashbound' || key === 'eternalarmlets') {
    for (const arm of /** @type {const} */ (['left', 'right'])) {
      const u = upperArm(arm, key === 'ashbound' ? 0.06 : 0.064), from = out.length;
      if (!u) continue;   // ARMORY-MIRROR: an arm the picture hides behind the body
      const a = pose.arm > 0 ? pose.arm : 1;   // WOLF-KIT: the wolf's arms wider
      const { sh, el } = u, k = u.k * a, wa = pt(`wa${u.side}`);
      if (key === 'ashbound') {
        tube(0, sh, el, 0.065 * k, 0.056 * k);
        if (full) tube(0, el, wa, 0.054 * a, 0.046 * a);
        cards(1, 8, sh, full ? wa : el, UP, [0.06 * s * k, 0]);
      } else {
        // a band's flames rise off it: each tube runs from its lower edge up the arm
        const d = unit(sub(el, sh)), mid = u.mid ?? u.along(0.45);
        tube(0, add(mid, d, 0.03 * k * s), add(mid, d, -0.08 * k * s), 0.062 * k, 0.066 * k);
        cards(1, 8, add(mid, d, 0.03 * k * s), add(mid, d, -0.03 * k * s), d, [0.07 * k * s, 0], 0, 1, speed);
        if (full) { const dw = unit(sub(wa, el)), cuff = mix(el, wa, 0.82); tube(0, add(cuff, dw, 0.025 * s), add(cuff, dw, -0.06 * s), 0.056 * a, 0.06 * a); }
      }
      clipped(from, u.clip);
    }
  } else if (key === 'cinderstride' || key === 'eternalgreaves') {
    for (const side of ['L', 'R']) {
      // WOLF-KIT: a wolf stands on its toes - its greaves on the long shank from the hock down, not over the hock
      const hock = pt(`ft${side}`), ft = pose.hock ? [hock[0], at[1] + 0.1 * s, hock[2]] : add(hock, UP, -0.06 * s), kn = pose.hock ? hock : pt(`kn${side}`);
      tube(0, ft, kn, 0.088, 0.07);
      cards(key === 'cinderstride' ? 2 : 1, 8, ft, kn, UP, [0.08 * s, 0], 0, 1, key === 'cinderstride' ? 0.4 + 0.6 * speed : speed);
    }
    if (key === 'cinderstride') cards(1, ARMORY_TRAIL, at, at, UP);
  } else if (key === 'crystalspurs') {
    // THANKS-POST: the spurs on both arms - out from the body's side, turned round the arm and leaning toward the hand
    const chest = pt('chest');
    for (const arm of /** @type {const} */ (['left', 'right'])) {
      const u = upperArm(arm, ARMORY_SPUR_ROOT), from = out.length;
      if (!u) continue;   // ARMORY-MIRROR: an arm the picture hides behind the body
      const { sh, el } = u, wa = pt(`wa${u.side}`), lat = sub(sh, chest);
      ARMORY_SPURS.forEach((p, k) => {
        if (p.seg === 'fore' && !full) return;
        const upper = p.seg === 'upper', [a, b] = upper ? [sh, el] : [el, wa], d = unit(sub(b, a)), on = upper ? u.along(p.at) : mix(a, b, p.at);
        const flat = [lat[0], 0, lat[2]], along = flat[0] * d[0] + flat[2] * d[2];
        const outward = unit(sub(flat, [d[0] * along, d[1] * along, d[2] * along])), back = [-fwd[0], 0, -fwd[2]];
        const dir = unit(add(add(outward, back, SPUR_TAN[k]), d, p.lean));
        const root = add(on, dir, ARMORY_SPUR_ROOT * (upper ? u.k : 1) * s);   // on the painted arm's skin
        tube(k, root, add(root, dir, p.len * s), p.r, 0.0015, fwd, true);
      });
      clipped(from, u.clip);
    }
  } else if (key === 'insigniaarmlet') {
    // GUILD-SHOP (the owner: "shows your guild insigia in a detailed format on one of the upper arms. Just one side"): the
    // wearer's left arm. A sprite's points are the picture's sides, so seen from the front its left arm is the right one
    const A = ARMORY_ARMLET, u = upperArm('left', A.r);
    if (!u) return out;   // ARMORY-MIRROR: the left arm behind the body
    const { sh, el, k } = u, d = unit(sub(el, sh)), up = [-d[0], -d[1], -d[2]], mid = u.mid ?? u.along(A.at);
    tube(0, add(mid, d, (A.tall * k / 2) * s), add(mid, d, (-A.tall * k / 2) * s), A.r * k, A.r * k * 1.04);
    // out from the body: its own left (the facing turned a quarter), toward whichever side this shoulder stands, square to the arm
    const lat = sub(sh, pt('chest')), left = [-fwd[2], 0, fwd[0]], way = Math.sign(lat[0] * left[0] + lat[2] * left[2]) || 1;
    const side0 = [left[0] * way, 0, left[2] * way], along = side0[0] * d[0] + side0[2] * d[2];
    const outward = unit(sub(side0, [d[0] * along, d[1] * along, d[2] * along]));
    const toEye = unit(sub(/** @type {any} */ (eye), mid));
    const N = pose.card ? toEye : unit(add(outward, fwd, 0.35));   // a sprite's on its arm, facing the eye
    const on = add(mid, N, A.r * k * s), f = facing(on, N);
    out.push({ mesh: DECAL, part: 2, A: add(on, N, (A.off / 2) * s), B: on, N, U: up, r: [0, 0], size: A.halo * k * s, count: 0, face: f, gain: 1 });
    out.push({ mesh: DECAL, part: 1, A: add(on, N, A.off * s), B: on, N, U: up, r: [0, 0], size: A.size * k * s, count: 0, face: f, gain: 1 });
    clipped(0, u.clip);
  }   // the weapon's pieces are drawn on the weapon itself, by the weapon glow (systems/weaponGlow.js law 7)
  return out;
}

// ── THE PASS ─────────────────────────────────────────────────────────

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const NO_HAZE = new Float32Array(8);
const NO_CLIP = new Float32Array(4);   // keeps every fragment
function mat4Multiply(/** @type {Float32Array} */ out, /** @type {ArrayLike<number>} */ a, /** @type {ArrayLike<number>} */ b) {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    out[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
  }
  return out;
}

/** THE WEARERS DRAWN this frame, written into `out`: those wearing a kit, within ARMORY_RANGE_M of the eye, nearest first,
 *  at most ARMORY_DRAW_MAX. Pure but for `out`. */
export function armoryWearers(/** @type {any[]} */ list, /** @type {ArrayLike<number>} */ eye, /** @type {any[]} */ out) {
  out.length = 0;
  for (const w of list) {
    if (!w || !w.kit || !Array.isArray(w.at) || !w.pose) continue;
    w._d = Math.hypot(w.at[0] - eye[0], w.at[1] - eye[1], w.at[2] - eye[2]);
    if (w._d <= ARMORY_RANGE_M) out.push(w);
  }
  out.sort((a, b) => a._d - b._d);
  if (out.length > ARMORY_DRAW_MAX) out.length = ARMORY_DRAW_MAX;
  return out;
}

/** Whether `eye` stands at the wearer's head - their own first person, where no body piece is drawn. Pure. */
export function armoryEyeAtHead(/** @type {any} */ w, /** @type {ArrayLike<number>} */ eye) {
  const h = /** @type {number[]} */ (poseWorld(w.pose, 'head', w.at, Number.isFinite(w.yaw) ? w.yaw : 0, [0, 0, 0]));
  return Math.hypot(h[0] - eye[0], h[1] - eye[1], h[2] - eye[2]) < 0.45 * (w.pose.scale > 0 ? w.pose.scale : 1);
}

/**
 * A WEARER'S MOTION, each frame: their velocity smoothed (`w.vel`, what wisps trail and sparks answer) and, for the
 * Cinderstride, an ember left at the leading foot every stride walked (`w.trail`, ARMORY_TRAIL of [x, y, z, born]). A
 * jump past a run's reach is a placement, never a stride. `right` the view's right: a sprite's feet stand off its card's
 * middle along it, as armoryDraws draws them. Writes `w`; pure but for it.
 */
export function armoryMotionStep(/** @type {any} */ w, /** @type {number} */ t, /** @type {ArrayLike<number>|null} */ right = null) {
  const m = w.motion ?? (w.motion = { t: null, at: [0, 0, 0], walked: 0, foot: 0 });
  const vel = w.vel ?? (w.vel = [0, 0, 0]);
  const trail = w.trail ?? (w.trail = new Float32Array(ARMORY_TRAIL * 4).fill(-1));
  const dt = m.t === null ? 0 : t - m.t;
  if (m.t !== null && dt > 0 && dt < 0.5) {
    const dx = w.at[0] - m.at[0], dy = w.at[1] - m.at[1], dz = w.at[2] - m.at[2], step = Math.hypot(dx, dz);
    if (step < Math.max(0.5, 30 * dt)) {
      const a = 1 - Math.exp(-dt / 0.15);
      vel[0] += (dx / dt - vel[0]) * a; vel[1] += (dy / dt - vel[1]) * a; vel[2] += (dz / dt - vel[2]) * a;
      m.walked += Math.abs(dy) < 0.3 ? step : 0;
      const stride = ARMORY_STRIDE_M * (w.pose?.scale > 0 ? w.pose.scale : 1);
      if (m.walked >= stride && w.pose && !w.mounted) {
        m.walked -= stride;
        m.foot = 1 - m.foot;
        const p = /** @type {number[]} */ (poseWorld(w.pose, m.foot ? 'ftR' : 'ftL', w.at, Number.isFinite(w.yaw) ? w.yaw : 0, [0, 0, 0], 0, w.pose.card ? right : null));
        let slot = 0;
        for (let i = 1; i < ARMORY_TRAIL; i++) if (trail[i * 4 + 3] < trail[slot * 4 + 3]) slot = i;
        trail[slot * 4] = p[0]; trail[slot * 4 + 1] = w.at[1]; trail[slot * 4 + 2] = p[2]; trail[slot * 4 + 3] = t;
      }
      if (m.walked > 3) m.walked = 0;
    }
  } else if (m.t === null || dt >= 0.5 || dt < 0) { vel.fill(0); m.walked = 0; }
  m.t = t; m.at[0] = w.at[0]; m.at[1] = w.at[1]; m.at[2] = w.at[2];
  return w;
}

/** GUILD-SHOP: a crest texture let go after this long unused (s), as a banner's is (render/bannerPass.js). */
export const ARMORY_CREST_IDLE_S = 120;
/** GUILD-SHOP: a pair of arms' two colours for the armlet's enamel - the field and the device's ink, as 0..1 RGB. Pure. */
export function armletColours(/** @type {any} */ arms) {
  const h = heraldryOf(arms?.heraldry);
  const rgb = (/** @type {string|undefined} */ hex, /** @type {number[]} */ dflt) => (hex ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) : dflt);
  return { field: rgb(h ? heraldryColourOf(h.field)?.hex : undefined, [0.9, 0.9, 0.9]), ink: rgb(h ? heraldryColourOf(heraldryInk(h))?.hex : undefined, [0.54, 0.54, 0.54]) };
}
/** AUDIT GUILD-SHOP R3: whether a view-projection mirrors the screen - its linear part's determinant turned positive
 *  (a plain perspective or orthographic one's is negative; the game's mirrorProjectionX flips it). */
export function mirroredVp(/** @type {ArrayLike<number>} */ m) {
  const det = m[0] * (m[5] * m[10] - m[9] * m[6]) - m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
  return det > 0;
}
/** ARMORY-MIRROR (2026-10-30, the owner: "Head aura doesnt allign on the sprite"): the right a sprite's card is drawn
 *  along, the billboards' camRight. The view's first row is the screen's right under a plain lens (the profile's stage)
 *  and its LEFT under the world's mirrorProjectionX, so a sprite's head and arms were placed mirrored across the card. */
export function cardRightOf(/** @type {ArrayLike<number>} */ proj, /** @type {ArrayLike<number>} */ view) {
  const k = proj && mirroredVp(proj) ? -1 : 1;
  return [view[0] * k, view[4] * k, view[8] * k];
}
/** GUILD-SHOP: the crest's picture for `arms` on a canvas of this page's - null where no canvas can be made (a pin's
 *  node), and the armlet then draws its band and glow alone. */
function paintCrestCanvas(/** @type {any} */ arms) {
  const doc = /** @type {any} */ (globalThis).document;
  const c = doc?.createElement?.('canvas');
  const ctx = c?.getContext?.('2d');
  if (!ctx) return null;
  c.width = CREST_PX; c.height = CREST_PX;
  return paintCrest(ctx, arms, logoImage(arms?.logo)) ? c : null;
}

export class ArmoryRenderer {
  constructor(/** @type {WebGL2RenderingContext} */ gl, { crest = paintCrestCanvas } = {}) {
    this.gl = gl;
    /** GUILD-SHOP: each pair of arms' crest texture, by its key, and when it was last drawn */
    this._crests = new Map();
    this._crestPaint = crest;
    this._doors = new Map();
    this._frame = 0;
    this.tubeVao = gl.createVertexArray();
    gl.bindVertexArray(this.tubeVao);
    this.tubeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.tubeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, armoryTubeGrid(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.spikeVao = gl.createVertexArray();
    gl.bindVertexArray(this.spikeVao);
    this.spikeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.spikeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, armoryTubeGrid(ARMORY_SPIKE_ROUND, 1), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.cardVao = gl.createVertexArray();
    gl.bindVertexArray(this.cardVao);
    this.cardBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.cardBuf);
    gl.bufferData(gl.ARRAY_BUFFER, armoryCards(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    this._trail = new Float32Array(ARMORY_TRAIL * 4);
    /** the pieces the last draw drew, for the stats and the tests */
    this.drawn = 0;
    /** false draws every piece as it was, its light uncut (the probes read the designs so) - the game never sets it */
    this.pixel = true;
  }

  /** A piece's program, built at its door once the driver says it is compiled (the auras' law) - null while it compiles,
   *  and for good once it would not build (told once). `need` builds it now (the probe's). */
  programOf(/** @type {number} */ piece, need = false) {
    let door = this._doors.get(piece);
    if (!door) {
      const gl = this.gl;
      door = compiledPass(gl, armoryPrograms(piece), () => {
        const [[vs, fs]] = armoryPrograms(piece);
        const prog = buildProgram(gl, vs, fs, 'armory');
        /** @type {Record<string, any>} */ const u = {};
        for (const n of UNIFORMS) u[n] = gl.getUniformLocation(prog, n);
        return { prog, u, frame: -1 };
      }, (/** @type {any} */ e) => console.warn(`[armory] piece ${piece} would not build`, e?.message ?? e));
      this._doors.set(piece, door);
    }
    return door(need);
  }

  /**
   * Draw the frame's pieces - `list` the wearers already picked (armoryWearers): `{ at, yaw, kit, pose, seed, kindle,
   * mounted, vel, trail, blades }` - under the frame's camera, its clock (`seconds`) and fog. Piece by piece, so each
   * program is bound once a draw; added light, so the order is nothing to the picture. Nothing to draw, nothing touched.
   */
  draw(/** @type {any[]} */ list, /** @type {ArrayLike<number>} */ proj, /** @type {ArrayLike<number>} */ view, /** @type {ArrayLike<number>} */ eye, /** @type {number} */ seconds, /** @type {any} */ fog = null, need = false) {
    this.drawn = 0;
    if (!Array.isArray(list) || !list.length) return;
    const gl = this.gl;
    mat4Multiply(this._vp, proj, view);
    this._frame++;
    const right = cardRightOf(proj, view), up = [view[1], view[5], view[9]];   // ARMORY-MIRROR: the card's right, not the view's first row
    const t = auraClock(seconds);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    try {
      for (const w of list) w._pieces = armoryKitPieces(w.kit);
      for (let pi = 0; pi < ARMORY_PIECES.length; pi++) {
        const key = ARMORY_PIECES[pi].key, slot = ARMORY_PIECES[pi].slot;
        if (slot === 'weapon') continue;   // the weapon glow's (systems/weaponGlow.js law 7)
        let P0 = null;
        for (const w of list) {
          if (w._pieces[slot] !== key) continue;
          const kindle = Math.max(0, Math.min(1, Number.isFinite(w.kindle) ? w.kindle : 1)) * (w.torn >= 0 && (w.pose?.card || !ARMORY_BEAST_SLOTS.includes(slot)) ? 0 : 1);   // WOLF-KIT: turned beast, the body's pieces stay on the 3D wolf - never on the paperdoll's
          if (!(kindle > 0) || w.atHead) continue;
          const draws = armoryDraws(key, w, eye, !(w._d > ARMORY_DETAIL_M), right);
          if (!draws.length) continue;
          if (!P0) {
            P0 = this.programOf(pi, need);
            if (!P0) break;
            gl.useProgram(P0.prog);
            if (P0.frame !== this._frame) this._bind(P0, right, up, t, eye, fog);
            if (key === 'insigniaarmlet') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // GUILD-SHOP: its colours over what is behind
          }
          const U = P0.u;
          const crest = key === 'insigniaarmlet' ? this._armletOf(U, w, seconds) : null;
          gl.uniform1f(U.uSeed, Number.isFinite(w.seed) ? w.seed : 0);
          gl.uniform1f(U.uKindle, kindle);
          gl.uniform1f(U.uLift, w.pose.card ? ARMORY_LIFT_M * (w.pose.scale > 0 ? w.pose.scale : 1) : 0);
          gl.uniform1f(U.uScale, w.pose.scale > 0 ? w.pose.scale : 1);
          gl.uniform3f(U.uVel, w.vel?.[0] ?? 0, w.vel?.[1] ?? 0, w.vel?.[2] ?? 0);
          if (key === 'cinderstride') gl.uniform4fv(U.uTrail, this._trailOf(w, seconds));
          for (const d of draws) {
            if (key === 'insigniaarmlet' && d.mesh === DECAL && d.part === 1 && !crest) continue;   // no crest painted: the band and its glow
            gl.uniform1i(U.uMesh, d.mesh); gl.uniform1i(U.uPart, d.part);
            gl.uniform3fv(U.uA, d.A); gl.uniform3fv(U.uB, d.B); gl.uniform3fv(U.uN, d.N); gl.uniform3fv(U.uU, d.U);
            gl.uniform2fv(U.uR, d.r); gl.uniform1f(U.uSize, d.size); gl.uniform1f(U.uFace, d.face); gl.uniform1f(U.uGain, d.gain);
            if (U.uClip) gl.uniform4fv(U.uClip, d.clip ?? NO_CLIP);
            if (key === 'insigniaarmlet') gl.uniform1f(U.uLift, ((w.pose.card ? ARMORY_LIFT_M : 0) + (d.mesh === DECAL ? ARMORY_ARMLET.lift : 0)) * (w.pose.scale > 0 ? w.pose.scale : 1));   // GUILD-SHOP
            if (d.mesh === TUBE) { gl.bindVertexArray(d.spike ? this.spikeVao : this.tubeVao); gl.drawArrays(gl.TRIANGLES, 0, (d.spike ? ARMORY_SPIKE_ROUND : ARMORY_ROUND * ARMORY_ALONG) * 6); }
            else { gl.bindVertexArray(this.cardVao); gl.drawArrays(gl.TRIANGLES, 0, (d.mesh === DECAL ? 1 : Math.min(d.count, ARMORY_CARDS)) * 6); }
          }
          this.drawn++;
        }
        if (P0 && key === 'insigniaarmlet') gl.blendFunc(gl.ONE, gl.ONE);
      }
      this._pruneCrests(seconds);
    } finally {   // the frame's state handed back whatever a piece did mid-pass
      gl.bindVertexArray(null);
      if (this._crestBound) { gl.bindTexture(gl.TEXTURE_2D, null); this._crestBound = false; }   // GUILD-SHOP: a crest's texture let go
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.BLEND);
    }
  }

  /** GUILD-SHOP: the armlet's colours and crest for wearer `w` - its own arms (`w.arms`; my own guild's where the wearer
   *  names none - the stage, the shop's figure) - bound to its program. Answers the crest texture, or null for none. */
  _armletOf(/** @type {any} */ U, /** @type {any} */ w, /** @type {number} */ seconds) {
    const gl = this.gl, arms = w.arms !== undefined ? w.arms : ownGuildArms();
    const { field, ink } = armletColours(arms);
    gl.uniform3fv(U.uField, field); gl.uniform3fv(U.uInk, ink);
    const key = `${armsKey(arms)}|${arms?.logo && logoImage(arms.logo) ? 1 : 0}`;
    let e = this._crests.get(key);
    if (!e) {
      const pic = this._crestPaint(arms);
      let tex = null;
      if (pic) {
        tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pic);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      this._crests.set(key, (e = { tex, at: seconds }));
    }
    e.at = seconds;
    if (!e.tex) return null;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    gl.uniform1i(U.uArms, 0);
    this._crestBound = true;
    return e.tex;
  }
  /** GUILD-SHOP: EVERY ALLOCATION HAS AN OWNER - a crest no wearer drew for ARMORY_CREST_IDLE_S let go. */
  _pruneCrests(/** @type {number} */ seconds) {
    for (const [k, e] of this._crests) if (seconds - e.at > ARMORY_CREST_IDLE_S) { if (e.tex) this.gl.deleteTexture(e.tex); this._crests.delete(k); }
  }

  /** A piece's program handed the draw's camera, clock and fog, once a draw. */
  _bind(/** @type {any} */ P0, /** @type {number[]} */ right, /** @type {number[]} */ up, /** @type {number} */ t, /** @type {ArrayLike<number>} */ eye, /** @type {any} */ fog) {
    const gl = this.gl, U = P0.u;
    P0.frame = this._frame;
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    if (U.uMirror) gl.uniform1f(U.uMirror, mirroredVp(this._vp) ? -1 : 1);   // AUDIT GUILD-SHOP R3
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    gl.uniform3f(U.uCamRight, right[0], right[1], right[2]); gl.uniform3f(U.uCamUp, up[0], up[1], up[2]);
    gl.uniform1f(U.uTime, t);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    if (U.uJungleHaze) gl.uniform4fv(U.uJungleHaze, fog?.haze ?? NO_HAZE);
    if (U.uPixel) gl.uniform1f(U.uPixel, this.pixel === false ? 0 : 1);   // the pieces' light cut to the auras' levels
  }

  /** The wearer's footfall embers as the shader reads them: [x, y, z, age 0..1], -1 for none or burned out. */
  _trailOf(/** @type {any} */ w, /** @type {number} */ seconds) {
    const out = this._trail;
    out.fill(-1);
    const tr = w.trail;
    if (!tr) return out;
    for (let i = 0; i < ARMORY_TRAIL; i++) {
      const born = tr[i * 4 + 3];
      const age = born < 0 ? -1 : (seconds - born) / ARMORY_EMBER_S;
      if (age < 0 || age > 1) continue;
      out[i * 4] = tr[i * 4]; out[i * 4 + 1] = tr[i * 4 + 1]; out[i * 4 + 2] = tr[i * 4 + 2]; out[i * 4 + 3] = age;
    }
    return out;
  }

  /** EVERY ALLOCATION HAS AN OWNER: the pass's buffers and arrays. */
  dispose() {
    const gl = this.gl;
    gl.deleteBuffer(this.tubeBuf); gl.deleteBuffer(this.cardBuf); gl.deleteBuffer(this.spikeBuf);
    gl.deleteVertexArray(this.tubeVao); gl.deleteVertexArray(this.cardVao); gl.deleteVertexArray(this.spikeVao);
    for (const e of this._crests.values()) if (e.tex) gl.deleteTexture(e.tex);   // GUILD-SHOP: the crests
    this._crests.clear();
  }
}

/** The slots a kit's pieces sit in, in the kit's order (ARMORY_SLOTS) - for a face that lists them. Pure. */
export const armoryKitSlots = (/** @type {unknown} */ kit) => ARMORY_SLOTS.filter((s) => armoryKitPieces(kit)[s]);
