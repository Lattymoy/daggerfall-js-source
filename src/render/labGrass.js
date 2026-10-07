// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GR1 (Mac: integrate the grass BYTE-EXACT with the proto's max range and
// max blades, no exceptions; height 54; none on roads, pathways, water,
// or in winter).
//
// THE SHADERS ARE THE LAB'S, VERBATIM. Both stages are sliced out of
// grass-proto.html by the pin at test time and compared as strings.
// One thing differs, and it is declared here in the open: the lab's
// prelude defines `terrain(p)` as the lab's own noise ground; the game's
// prelude defines `terrain(p)` as the root height the placer baked from
// the real heightmap, carried on a THIRD instance attribute the vertex
// text never has to mention. The vertex stage's text is identical.
//
// THE PLACER IS THE LAB'S LAW: the same xorshift seed, the same span of
// 210m either side, the same clustering (a centre, an angle, a radius
// of rnd*rnd*0.55), the same height law (0.22 + rnd*0.42) * (height/34),
// the same lean, tint and width. The game adds only WHERE a blade may
// stand: on a tile the archive says is grass, not on a road record,
// not on water, and not at all in winter. The scatter walks the lab's
// full 1,200,000 candidates around the eye and keeps the ones that land
// on grass, so the density on a lawn is the lab's density.
//
// The field the lab's grass reads - snow, water, trodden - is a 1x1
// zero texture here: the shader's snow and wet terms are then exactly
// zero, and the text stays the lab's.

import { frustumPlanes, aabbOutside } from './frustum.js';   // PERF2: the field draws only the cells in view
import { smoothstep } from '../systems/mathf.js';   // GRASS2: the host's blade budget is a bound on the shader's fade, so the two must be the SAME curve
import { buildTuftMips, buildTuftSheet, pixelGrass, PX_RAMP_STEPS, PX_TINT_BANDS, PX_BLADES_PER_TUFT } from './grassPixelArt.js';   // GRASS-PX: the tuft sheet and the pixel style's numbers
import { meadowGrass, buildMeadowMips, meadowCardCorners, meadowCardIndices, MEADOW_SLOTS, MEADOW_CARDS, MEADOW_CARDS_FAR, MEADOW_NEAR_AT, MEADOW_BLADES_PER_TUFT, MEADOW_VARIANTS, MEADOW_LUSH, MEADOW_SHARES, MEADOW_PATCH_SCALE,
  MEADOW_FACE, meadowArtGround, MEADOW_SHIFT, MEADOW_GREEN_EDGE, MEADOW_TOP, MEADOW_REACH, MEADOW_WIND_REACH, MEADOW_BOXES, MEADOW_SEED, MEADOW_NEAR_BAND, MEADOW_SLOPE_FLOOR, MEADOW_CELL, MEADOW_BUSH, MEADOW_FLOWERS, MEADOW_DRY, MEADOW_SHORT, MEADOW_TALL } from './grassMeadow.js';   // MEADOW1: the owner's sprites on crossed cards
import { buildProgram } from './glProgram.js';   // AUDIT 68 S17-gl-program-dup: the one compile and link
import { FOG_GLSL } from './fogGlsl.js';   // AUDIT 68 S17-fog-glsl-dup: fogFactorAt's one home - the terrain's own text, not a tenth copy
import { CLOUD_SHADOW_GLSL } from './cloudShadow.js';   // GRASS-LIT: the deck's shadow, the reader the terrain takes
import { SHADOW_GLSL, SHADOW_SUN_UNIT, SHADOW_POINT_UNIT, SHADOW_LO_UNIT, SHADOW_POINT_CASTERS, SHADOW_CASTER_TABLE } from './shadowPass.js';   // GRASS-LIT: the sun map, the receiver the terrain takes
import { AIR_ADAPT_GLSL } from './airPass.js';   // GRASS-LIT: the eye's adaptation, as every lane program exposes by it
import { EL_CODEC_GLSL, EL_TONEMAP_GLSL, EL_ATTEN_GLSL, EL_MAX_LIGHTS, elDecode, elEncode, elTonemapRGB, elAttenuation, EL_EXPOSURE } from './enhancedLighting.js';   // GRASS-LIT: the lane's codec and curve, and their JS twins for grassLit; GRASS-LIT2: and its lantern falloff

/**
 * GRASS2: THE DEPARTURES FROM THE LAB, AS DATA.
 *
 * GR1's law was that the shaders are the lab's text byte for byte, and
 * the pin enforced it by slicing `grass-proto.html` at test time. That
 * law has been broken deliberately, three times, and the honest way to
 * break it is to say exactly where rather than to loosen the pin: the
 * lab's text plus THESE edits, and nothing else, is what the game
 * compiles. Any other drift still fails the pin, which is the whole
 * value of having had it.
 *
 * Each entry is the lab's own text and what the game puts in its place.
 * The reasons are on the code itself, at the site of each change.
 */
export const GRASS2_VS_EDITS = Object.freeze([
  Object.freeze({
    why: 'uSlotN: the shader is told how many blades the cell holds, so an index can be a fraction of it',
    from: 'uniform float uSnowFull;           // PROTO-22: the SAME line the ground draws\n',
    to: 'uniform float uSnowFull;           // PROTO-22: the SAME line the ground draws\n'
      + 'uniform float uSlotN;              // GRASS2: how many blades this slot holds, so the index can be a fraction\n'
      + 'uniform vec4 uCellFrame;           // GRASS5: the cell\'s origin.xz, its ground\'s floor and its span\n'
      + 'uniform vec4 uBladeScale;          // GRASS5: the height law\'s floor/span, then the width\'s\n'
      + 'uniform float uCellSize;           // GRASS5: how wide a cell is, so a 0..1 lane is metres\n',
  }),
  Object.freeze({
    why: 'the fade threshold is the blade INDEX, not a hash of its phase - so the host can decline the blades that will fail it',
    from: '  if (vFade <= 0.001 || fract(aInst.w * 91.7) > vFade * 1.15) { gl_Position = vec4(2,2,2,1); return; }',
    to: '  float u = uSlotN > 0.5 ? float(gl_InstanceID) / uSlotN : 0.0;\n  if (vFade <= 0.001 || u > vFade * 1.15) { gl_Position = vec4(2,2,2,1); return; }',
  }),
  Object.freeze({
    why: 'GRASS5: the three instance lanes are PACKED integers, not twelve floats - a blade is 16 bytes on the GPU instead of 48',
    from: 'layout(location=1) in vec4 aInst;        // xz, height, phase\n'
      + 'layout(location=2) in vec4 aInst2;       // lean.xz, tint, width\n'
      + 'layout(location=4) in vec3 aGround;      // GR4: the ground\'s own colour under this blade, baked by the placer',
    to: 'layout(location=1) in vec4 aPA;          // GRASS5: u16 x, z, rootY, height - all cell-local, all normalized\n'
      + 'layout(location=2) in vec4 aPB;          // GRASS5: u8 lean.x, lean.z, tint, width\n'
      + 'layout(location=4) in vec4 aPC;          // GRASS5: u8 ground.rgb, phase',
  }),
  Object.freeze({
    why: 'GRASS5: and they are unpacked into the lab\'s own names at the top of main, so every line of the body below is untouched',
    from: 'void main(){\n  vec2 root = aInst.xy;',
    to: 'void main(){\n'
      + '  // GRASS5: UNPACK. The GPU has already turned the integer lanes into\n'
      + '  // 0..1 floats; this is two multiply-adds and a cell origin, and it\n'
      + '  // rebuilds exactly the four values the lab\'s body reads. The names\n'
      + '  // below are the lab\'s own, so nothing after this line had to change.\n'
      + '  vec4 aInst = vec4(uCellFrame.xy + aPA.xy * uCellSize,\n'
      + '                    uBladeScale.x + aPA.w * uBladeScale.y,\n'
      + '                    aPC.a * 6.283185307179586);\n'
      + '  vec4 aInst2 = vec4(aPB.xy * 0.5 - 0.25, aPB.z, uBladeScale.z + aPB.w * uBladeScale.w);\n'
      + '  vec3 aGround = aPC.rgb;\n'
      + '  gRootY = uCellFrame.z + aPA.z * uCellFrame.w;\n'
      + '  vec2 root = aInst.xy;',
  }),
  // GRASS6 (2026-09-21): the FIFTH edit - the tint pulled toward a
  // low-frequency world-space noise, so the field has patches - is gone
  // from the shader and lives in the placer (`bakedTint`). The clump is
  // a function of the blade's world position and nothing else, so it was
  // being evaluated thirty times a blade a frame (two value noises, eight
  // hashes) for a value that never changed. The lab's own line,
  // `vTint = aInst2.z;`, is what compiles again; the lane carries the
  // patched tint from the placer.
]);

export const LAB_GRASS_HEAD = `#version 300 es
precision highp float;
`;
/** the game's prelude: hash/vnoise as the lab has them (the shader body
 *  does not call them, but the prelude is the lab's shape), and
 *  terrain() as the baked root height */
export const GAME_GRASS_FIELD = `
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
// GRASS5: the root height is no longer an attribute of its own - it
// rides the packed A lane and is decoded in main(), so terrain() reads
// a global the decode fills. The port's prelude was always its own
// (GR1's one declared difference), so this costs the lab nothing.
float gRootY;
float terrain(vec2 p){ return gRootY; }`;
export const LAB_GRASS_VS = `layout(location=0) in vec2 aCorner;      // one blade quad, 0..1
layout(location=1) in vec4 aPA;          // GRASS5: u16 x, z, rootY, height - all cell-local, all normalized
layout(location=2) in vec4 aPB;          // GRASS5: u8 lean.x, lean.z, tint, width
layout(location=4) in vec4 aPC;          // GRASS5: u8 ground.rgb, phase
uniform mat4 uVP; uniform float uTime, uWind, uRange; uniform vec3 uEye, uSunDir, uMoonDir;   // WIND4: the moon lights the field at night, as it lights the ground under it
uniform vec2 uWindDir;
uniform float uSnowFull;           // PROTO-22: the SAME line the ground draws
uniform float uSlotN;              // GRASS2: how many blades this slot holds, so the index can be a fraction
uniform vec4 uCellFrame;           // GRASS5: the cell's origin.xz, its ground's floor and its span
uniform vec4 uBladeScale;          // GRASS5: the height law's floor/span, then the width's
uniform float uCellSize;           // GRASS5: how wide a cell is, so a 0..1 lane is metres
uniform sampler2D uGField; uniform vec2 uGFieldOrigin; uniform float uGFieldM, uSnowGlobal; uniform vec2 uWindV;
out float vT; out float vTint; out float vFade; out float vLam; out float vSnow; out float vWet;
out vec3 vGround;                       // GR4
out float vMoonLam;                     // WIND4: the moon's lambert, beside the sun's
void main(){
  // GRASS5: UNPACK. The GPU has already turned the integer lanes into
  // 0..1 floats; this is two multiply-adds and a cell origin, and it
  // rebuilds exactly the four values the lab's body reads. The names
  // below are the lab's own, so nothing after this line had to change.
  vec4 aInst = vec4(uCellFrame.xy + aPA.xy * uCellSize,
                    uBladeScale.x + aPA.w * uBladeScale.y,
                    aPC.a * 6.283185307179586);
  vec4 aInst2 = vec4(aPB.xy * 0.5 - 0.25, aPB.z, uBladeScale.z + aPB.w * uBladeScale.w);
  vec3 aGround = aPC.rgb;
  gRootY = uCellFrame.z + aPA.z * uCellFrame.w;
  vec2 root = aInst.xy;
  float d = distance(root, uEye.xz);
  vFade = 1.0 - smoothstep(uRange*0.55, uRange, d);
  // PROTO-18: the fade thins the FIELD, it does not shrink the blades.
  // A threshold drops whole blades with distance, so the count falls
  // away and every blade that remains is its true size.
  //
  // GRASS2: THE THRESHOLD IS THE BLADE'S INDEX, not a hash of its phase.
  // Same law, same distribution - the placer already emits a cell's
  // blades in random order, so the first k of them are a uniform random
  // k, exactly as a hash of the phase was. What the index buys is that
  // the HOST CAN KNOW which blades will fail: a hash is only knowable
  // after the vertex shader has run, so the old field paid thirty vertex
  // invocations for every blade the fade then threw away - and the band
  // where that happens is 70% of the field's area. Measured at range
  // 200: 8.45M vertex invocations a frame, of which the band's were 61%,
  // for 2% more grass on the screen (tools/grassFieldProbe.mjs). With
  // the index, the host submits the prefix that can survive and no more.
  float u = uSlotN > 0.5 ? float(gl_InstanceID) / uSlotN : 0.0;
  if (vFade <= 0.001 || u > vFade * 1.15) { gl_Position = vec4(2,2,2,1); return; }
  // PROTO-14 (3): THE GRASS KNOWS ABOUT THE GROUND IT STANDS IN.
  // Blades stood up through snow that was supposedly burying them and
  // stayed green in standing water. Snow BURIES them - the depth eats
  // the height, and what is left is bent over and pale; water DROWNS
  // them; and a footfall PUSHES them over, because the field already
  // records where a foot went.
  // PROTO-16 (1, Mac: the grass pops out of the snow when moving).
  // The field is 64m across and the grass is drawn to 90m and beyond,
  // so most blades stand OUTSIDE the window. Their UV clamped to the
  // edge texel, and when the window jumped its 4m block the blades at
  // the boundary flipped between buried and bare in one frame - the
  // pop. Two things fix it, and both are needed: blades outside the
  // window fall back to the GLOBAL snow depth, because snow falls on
  // the whole world and not only on the part being simulated; and the
  // handover is FADED over the last few metres, so no blade changes
  // state in a single step.
  vec2 fuv = (root - uGFieldOrigin) / uGFieldM;
  vec4 fld = texture(uGField, clamp(fuv, 0.0, 1.0));
  vec2 edge = min(fuv, 1.0 - fuv);
  float inWin = smoothstep(0.0, 0.06, min(edge.x, edge.y));
  fld = mix(vec4(0.0, uSnowGlobal, 0.0, 0.0), fld, inWin);
  float snowD = fld.g * (1.0 - fld.b * 0.55);
  float drown = smoothstep(0.10, 0.40, fld.r);
  vSnow = smoothstep(0.02, 0.22, snowD);
  vWet = smoothstep(0.0, 0.35, fld.r) + fld.a * 0.5;
  // PROTO-18 (Mac: grass pops THROUGH THE SNOW during movement, and
  // the snow itself is fine).
  //
  // THE HEIGHT WAS SCALED BY THE DISTANCE FADE. A blade far off stood
  // at 55% of its height and grew to 100% as you approached - which is
  // invisible on bare ground, and on snow is the whole bug: the snow
  // surface is a FIXED line, so a blade that was under it grows up
  // through it as you walk toward it. Every blade in the field does it,
  // continuously, which is exactly "popping through when moving".
  //
  // BURIAL IS GEOMETRIC NOW, not a multiplier. The snow has a real
  // surface height; a blade's true height is fixed and never changes
  // with distance; what shows is simply the part standing ABOVE that
  // surface, and the root is planted ON the snow rather than under it.
  // A blade shorter than the snow is gone because it is buried, not
  // because a factor shrank it - and walking toward it changes
  // nothing, because nothing in this depends on the camera any more.
  float snowSurf = snowD * uSnowFull;             // the SAME line the ground displaces to
  float trueH = aInst.z * (1.0 - drown * 0.9);
  float h = max(0.0, trueH - snowSurf);
  vT = aCorner.y;
  // the tip travels, the root does not: the offset is weighted by
  // height along the blade, squared, which is what a stalk does
  // AUDIT 39 F1: THE GRASS BENDS THE WAY THE WIND BLOWS. The sway was
  // on a fixed axis with a fixed 0.6 cross-term, so the field always
  // leaned the same way however the wind slider was set - and once the
  // rain took a direction, the grass and the rain disagreed in plain
  // sight. Now the lean is the wind VECTOR: a steady push plus a gust
  // that travels ACROSS the field as a wave (the phase carries the
  // blade's position along the wind), which is what makes a gust look
  // like one thing moving rather than every blade wobbling alone.
  vec2 wdir = length(uWindV) > 1e-4 ? normalize(uWindV) : vec2(1.0, 0.0);
  float along = dot(root, wdir);
  float gust = sin(uTime*1.7 - along*0.35 + aInst.w*0.6) * 0.5 + 0.5;
  float push = length(uWindV) * (0.55 + gust * 0.75);
  vec2 lean = aInst2.xy + wdir * push * 0.055;
  vec3 p;
  p.xz = root + lean * (vT*vT) * h;
  // GR2 (Mac: from the side the blades are completely flat). A blade's
  // width ran along world X, so it was a full quad seen along Z and an
  // edge seen along X. The width now runs ACROSS the line to the eye -
  // a per-blade billboard about Y - so a blade is a blade from any side.
  vec2 toEye = uEye.xz - root;
  vec2 side = length(toEye) > 1e-4 ? normalize(vec2(-toEye.y, toEye.x)) : vec2(1.0, 0.0);
  p.xz += side * (aCorner.x-0.5) * aInst2.w * (1.0 - vT*0.75);
  // planted on the snow's own surface, so the burial line is the one
  // the ground draws and not an approximation of it
  p.y = terrain(root) + snowSurf + vT * h;
  vTint = aInst2.z;
  vGround = aGround;                      // GR4: carried to the root
  // MAC'S NOTE: the blades take the TIME OF DAY. A blade's normal is
  // roughly its own lean crossed with up, so a leaning blade catches
  // a low sun on one side and goes dark on the other - which is what
  // makes a dawn field glow along one edge.
  vec3 nrm = normalize(vec3(-lean.y, 0.35, lean.x) + vec3(0.0, 0.25, 0.0));
  vLam = max(dot(nrm, normalize(uSunDir)), 0.0);
  vMoonLam = max(dot(nrm, normalize(uMoonDir)), 0.0);   // WIND4
  gl_Position = uVP * vec4(p,1.0);
}`;
/** WIND4: the fallbacks the upload uses when a host hands no moon -
 *  straight up and white, with a scale of zero, which is "no moon". */
const UP = new Float32Array([0, 1, 0]);
const WHITE = new Float32Array([1, 1, 1]);
const NO_FOG_RANGE = new Float32Array([0, 1]);   // DISC20-A: a range for the unfogged draw (mode 0 never reads it)
const NO_WATER_FOG = new Float32Array(20);   // DW-C: uDwFog off ([0].x 0)
const NO_DECK = new Float32Array(4);   // GRASS-LIT: a vec4 of zeros - no deck, no sun map, no player's light
const NO_CASTERS = new Int32Array(SHADOW_CASTER_TABLE).fill(-1);   // AUDIT GRASS-LIT2 A2: every light without a map
const NO_CASTER_PARAMS = new Float32Array(SHADOW_POINT_CASTERS * 4);   // AUDIT GRASS-LIT2 A2: and every slot off (far 0)
const ZERO3 = new Float32Array(3);
const NO_WIND = Object.freeze([0, 0]);   // AUDIT MEADOW1: the wind a field the trees' switch holds still takes
/** GRASS-LIT: the eye's adaptation rides the far ring's unit (render/farRing.js), the deck the renderer's reserved one
 *  (renderer.js CLOUD_SHADOW_UNIT - the same map it binds there) */
export const GRASS_ADAPT_UNIT = 11;
export const GRASS_CLOUD_UNIT = 15;

export const LAB_GRASS_FS = `in float vT; in float vTint; in float vFade; in float vLam; in float vSnow; in float vWet; in vec3 vGround; in float vMoonLam;   // WIND4: appended, so the lab's own locator still finds this line
uniform vec3 uAmb, uSunCol, uMoonCol; uniform float uDim, uSunScale, uMoonScale;   // WIND4: the sun's SCALE and the moon, the two terms the ground has and the grass did not
out vec4 o;
void main(){
  // PROTO-2: the blade is LIT along its length - dark at the root
  // where the sward shades it, bright at the tip where the sky does -
  // and the very tip catches a rim, which is what makes a field of
  // blades read as depth instead of a green haze.
  // PROTO-7 (Mac: reduce the bright colour): the sward is olive, not
  // emerald - a Daggerfall field, not a golf course.
  // GR4 (RedRoryOTheGlen, via Mac: the base of the grass blending into
  // the ground and all you can make out are the tips through a
  // gradient - how the older Novalogic games did it). THE ROOT IS THE
  // GROUND. A fixed olive root drew a hard line at every base where a
  // blade met a tile of another shade - the one tell that makes a
  // field read as quads stuck on. The root takes the colour of the
  // ground it stands on, darkened as a sward's shade would, and the
  // olive only arrives by the mid.
  vec3 root = vGround * 0.62;
  vec3 mid  = vec3(0.13,0.20,0.07);
  vec3 tip  = vec3(0.24,0.32,0.12);
  vec3 c = mix(root, mid, smoothstep(0.0,0.55,vT));
  c = mix(c, tip, smoothstep(0.5,1.0,vT));
  c *= 0.80 + vTint*0.42;
  // wet grass is DARKER; snow-laden grass is pale and cold
  c *= mix(1.0, 0.72, clamp(vWet, 0.0, 1.0));
  c = mix(c, vec3(0.74,0.78,0.86), vSnow * 0.75);
  // lit by the same sky and sun the ground is, so a blade at dusk is
  // the colour of dusk and not a green cut-out on an orange field.
  //
  // WIND4 (2026-09-15, Mac: "grass doesnt get darker at night"). That
  // sentence was the INTENT and not the code: every other surface in
  // the world lights as ambient, plus the sun's colour times its SCALE
  // times the lambert, plus the moon's the same way (render/renderer.js,
  // farRing, waterSurface - one formula, four programs; the uniforms are
  // not named here because the tree's own shader audit reads a comment
  // as code and would count them as used), and this one dropped
  // BOTH the sun's scale and the moon. uSunScale is the term that goes
  // to zero when the sun sets, so at midnight the ground went dark and
  // the sward stayed lit by a sun that was not there - a glowing field
  // under a black sky. The scale rides the sun here now, and the moon
  // lights the blades as it lights the tile they stand in.
  c *= (uAmb * 1.25 * (0.42 + 0.58*vT) + uSunCol * (uSunScale * 1.15 * vLam) + uMoonCol * (uMoonScale * 1.15 * vMoonLam));
  c *= uDim;
  // the rim is the SUN's colour, and only where the sun can reach - so
  // it goes out with the sun (WIND4: the scale, again)
  c += uSunCol * (uSunScale * 0.20) * smoothstep(0.86,1.0,vT) * vLam;
  // GR4: ...and the base fades IN, so what reads as a blade is its upper
  // part - the tips through a gradient - rather than a planted line.
  o = vec4(c, vFade * smoothstep(0.0, 0.30, vT));
}`;

/**
 * GRASS-PX: THE PIXEL STYLE, AS DECLARED EDITS ON THE LAB'S TEXT.
 *
 * The lab's two stages above stay what the pin says they are: the lab's
 * own text (plus GRASS2's five). The pixel style is a SECOND list of
 * edits laid on top of them, and what the game compiles is
 * `GAME_GRASS_VS` / `GAME_GRASS_FS` = the lab's text with both lists
 * applied. The pin in test/grasspx.test.js re-applies the list and
 * compares, and holds that every `from` is found exactly once - so a
 * lab line that moved cannot turn an edit into a silent no-op, and a
 * change to the compiled text that is not on a list still fails.
 *
 * Both styles live in ONE program and a float uniform picks between
 * them, so a player flipping the row in Settings changes a uniform and
 * not a program: no recompile, no second set of buffers, no second
 * field. Every pixel term is `mix(lab, pixel, uPixel)` or a branch on
 * it, and with the uniform at zero the arithmetic is the lab's to the
 * last operation.
 */
export const GRASSPX_VS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the pixel style\'s numbers: the switch, the sway\'s frame rate, the lean\'s steps, the sheet\'s tuft count',
    from: 'uniform float uCellSize;           // GRASS5: how wide a cell is, so a 0..1 lane is metres\n',
    to: 'uniform float uCellSize;           // GRASS5: how wide a cell is, so a 0..1 lane is metres\n'
      + 'uniform float uPixel, uPxVariants;   // GRASS-PX: 0 is the lab\'s blade, 1 the tuft sprite\n',
  }),
  Object.freeze({
    why: 'the fragment stage needs the quad\'s own texel and which tuft this blade wears - the tuft is flat, so one blade is one sprite',
    from: 'out float vMoonLam;                     // WIND4: the moon\'s lambert, beside the sun\'s\n',
    to: 'out float vMoonLam;                     // WIND4: the moon\'s lambert, beside the sun\'s\n'
      + 'out vec2 vUV; flat out float vVar;      // GRASS-PX: the tuft\'s texel, and which tuft\n',
  }),
  // GRASS-PX3 (2026-09-21, Mac: "I miss the way the grass flowed with
  // the wind smoothly"): the pixel style's two SWAY edits are gone - the
  // clock stepped at 8 Hz and the lean snapped to 24 poses. A tuft is a
  // sprite; how it MOVES is the lab's, in both styles, because the wind
  // is the one thing in the field that should never look drawn frame by
  // frame. The sway law is untouched above this list: uTime, the gust
  // wave, the lean, exactly as the lab has them.
  Object.freeze({
    why: 'the pixel quad is not tapered - the sprite carries the shape - and it is HALF ITS DRAWN HEIGHT wide, so a 2:1 tuft (16x32 then, 8x16 since GRASS-PX4) is square texels on every blade, buried or not',
    from: '  p.xz += side * (aCorner.x-0.5) * aInst2.w * (1.0 - vT*0.75);',
    to: '  p.xz += side * (aCorner.x-0.5) * mix(aInst2.w * (1.0 - vT*0.75), h * 0.5, uPixel);   // GRASS-PX; GRASS AUDIT 1: the width is the height\'s, per blade',
  }),
  Object.freeze({
    why: 'the texel is the corner, and the tuft is chosen by a hash of the root - NOT the phase, which is the gust\'s, or every tuft of one sprite would hop in unison; AUDIT MEADOW1: of the root\'s place in its CELL, which no shift of the floating origin moves',
    from: '  vGround = aGround;                      // GR4: carried to the root',
    to: '  vGround = aGround;                      // GR4: carried to the root\n'
      + '  vUV = aCorner;                          // GRASS-PX\n'
      + '  vVar = min(floor(hash(aPA.xy * 64.0) * uPxVariants), uPxVariants - 1.0);   // GRASS AUDIT 1: the prelude\'s hash, its float32 fract honest; AUDIT MEADOW1: of the cell\'s lane, not the scene\'s root - every tuft re-rolled at each map pixel crossed',
  }),
]);

export const GRASSPX_FS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the two varyings the vertex stage now sends',
    from: 'in vec3 vGround; in float vMoonLam;   // WIND4: appended, so the lab\'s own locator still finds this line\n',
    to: 'in vec3 vGround; in float vMoonLam;   // WIND4: appended, so the lab\'s own locator still finds this line\n'
      + 'in vec2 vUV; flat in float vVar;   // GRASS-PX\n',
  }),
  Object.freeze({
    why: 'the sheet, the switch, the ramp\'s steps, the tuft count, and the tint\'s bands; then the ordered dither and the sample itself at the top of main',
    from: 'out vec4 o;\nvoid main(){',
    to: 'uniform float uPixel, uPxSteps, uPxVariants, uPxTintBands; uniform sampler2D uPxSheet;   // GRASS-PX\n'
      + 'out vec4 o;\n'
      + '// GRASS-PX: the 4x4 Bayer matrix as bit arithmetic - a const array\n'
      + '// indexed at runtime is the kind of thing a driver gets wrong, and\n'
      + '// the closed form is four operations. (x xor y, y) bit-interleaved and\n'
      + '// reversed is the classic matrix: 0 8 2 10 / 12 4 14 6 / 3 11 1 9 / 15 7 13 5.\n'
      + 'float bayer4(vec2 fc){\n'
      + '  ivec2 q = ivec2(fc) & 3; int x = q.x ^ q.y;\n'
      + '  int m = ((x & 1) << 3) | ((q.y & 1) << 2) | (x & 2) | ((q.y & 2) >> 1);\n'
      + '  return (float(m) + 0.5) / 16.0;\n'
      + '}\n'
      + 'void main(){\n'
      + '  // GRASS-PX: THE TUFT. The quad wears one of the sheet\'s tufts; a\n'
      + '  // texel that is air is discarded outright (no soft edge, ever), and\n'
      + '  // the distance fade is an ORDERED DITHER against the screen rather\n'
      + '  // than a transparency - the way a paletted screen faded anything.\n'
      + '  // What the texel carries stands in for the lab\'s own terms below:\n'
      + '  // its tone picks the flat colour, its height along its own blade is\n'
      + '  // what the root-to-tip light reads, and its blade ordinal shades\n'
      + '  // the tuft\'s blades apart.\n'
      + '  float t = vT; float pxTone = 0.0; float pxBlade = 0.0;\n'
      + '  if (uPixel > 0.5) {\n'
      + '    vec4 px = texture(uPxSheet, vec2((vVar + vUV.x) / uPxVariants, vUV.y));\n'
      + '    if (px.a < 0.5 || vFade < bayer4(gl_FragCoord.xy)) discard;\n'
      + '    pxTone = floor(px.r * 4.0 + 0.5); t = px.g; pxBlade = px.b;\n'
      + '  }',
  }),
  Object.freeze({
    why: 'the gradient runs along the drawn stalk; in the pixel style the colour is one of three flat tones, and the patch tint is banded',
    from: '  vec3 c = mix(root, mid, smoothstep(0.0,0.55,vT));\n  c = mix(c, tip, smoothstep(0.5,1.0,vT));\n  c *= 0.80 + vTint*0.42;',
    to: '  vec3 c = mix(root, mid, smoothstep(0.0,0.55,t));\n  c = mix(c, tip, smoothstep(0.5,1.0,t));\n'
      + '  if (uPixel > 0.5) c = (pxTone < 1.5 ? root : (pxTone < 2.5 ? mid : tip)) * (0.92 + pxBlade * 0.16);   // GRASS-PX: three flat tones, and the tuft\'s blades a shade apart\n'
      + '  c *= 0.80 + mix(vTint, floor(vTint * (uPxTintBands - 1.0) + 0.5) / (uPxTintBands - 1.0), uPixel) * 0.42;   // GRASS-PX: the patch tint in bands; GRASS AUDIT 1: rounded to band CENTRES, so the mean holds and the top band is 1',
  }),
  Object.freeze({
    why: 'the sward\'s shade climbs the drawn stalk, not the quad',
    from: '  c *= (uAmb * 1.25 * (0.42 + 0.58*vT) + uSunCol',
    to: '  c *= (uAmb * 1.25 * (0.42 + 0.58*t) + uSunCol',
  }),
  Object.freeze({
    why: 'the rim lands on the one highlight texel in the pixel style - a whole step of sun on one pixel, which is what a hand-set highlight is',
    from: '  c += uSunCol * (uSunScale * 0.20) * smoothstep(0.86,1.0,vT) * vLam;',
    to: '  c += uSunCol * (uSunScale * 0.20) * mix(smoothstep(0.86,1.0,t), step(3.5, pxTone), uPixel) * vLam;   // GRASS-PX',
  }),
  Object.freeze({
    why: 'the lit colour is snapped to a short luminance ramp (the hue is kept, so a dusk field is still the colour of dusk), and the alpha is hard',
    from: '  o = vec4(c, vFade * smoothstep(0.0, 0.30, vT));',
    to: '  // GRASS AUDIT 1: the ramp is PERCEPTUAL and its first rung is never zero.\n'
      + '  // Eight linear steps put the first boundary at a luminance of 1/16, and\n'
      + '  // a lit blade lives under 0.4 in daylight and under 0.05 at night or in\n'
      + '  // rain - so the mid and root tones, three quarters of every tuft, went\n'
      + '  // to exact black after dark and a moonlit midnight was as bright as\n'
      + '  // noon for what was left. The steps are taken in gamma space, where\n'
      + '  // the eye takes them, and the lowest rung is the first step, not zero.\n'
      + '  if (uPixel > 0.5) { float l = max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4); float g = max(1.0, floor(pow(l, 1.0 / 2.2) * uPxSteps + 0.5)) / uPxSteps; c *= pow(g, 2.2) / l; }   // GRASS-PX: the ramp\n'
      + '  o = vec4(c, mix(vFade * smoothstep(0.0, 0.30, vT), 1.0, uPixel));',
  }),
]);

/** apply a list of `{from, to}` edits to a text, each `from` found
 *  EXACTLY once - zero is a lab that moved, two is an edit that would
 *  land twice, and either is an error and not a shrug */
export function applyGrassEdits(text, edits) {
  let out = text;
  for (const e of edits) {
    const at = out.indexOf(e.from);
    if (at < 0) throw new Error(`grass edit not found: ${e.why}`);
    if (out.indexOf(e.from, at + 1) >= 0) throw new Error(`grass edit lands twice: ${e.why}`);
    out = out.slice(0, at) + e.to + out.slice(at + e.from.length);
  }
  return out;
}
/** DISC20-A (2026-09-24, Mac: "Grass isnt affected by fog"): THE GROUND'S FOG, ON THE BLADES. The lab's grass
 *  program had no fog term, GR1 carried it byte for byte, and the renderer's fog reaches only its own programs - so
 *  every row the ground takes (a clear day's linear 2400, the rain's exp 0.003, the heavy fog's exp 0.05, the
 *  sandstorm's exp 0.09, Dynamic Skies' exp2 and colour) left the field drawn to its 300 m fade, dimmed by LAB_DIM
 *  and never fogged: in heavy fog the ground is the fog's colour past 60 m and the grass stood out of it to 165. These
 *  edits hand the fragment its world point and blend it to the fog colour by the terrain's own fogFactorAt
 *  (render/fogGlsl.js, the text TERRAIN_FS interpolates), over the fog the renderer set for the frame (LabGrassRenderer.draw's
 *  `light.fog`). They land AFTER the pixel style's, so the fog is not snapped to a ramp rung (the style's default). */
export const FOG_FACTOR_GLSL = FOG_GLSL + '\n';   // AUDIT 68 (the merge): fogGlsl.js's text, which every renderer.js program interpolates
export const GRASSFOG_VS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the blade hands the fragment its world point, which the fog measures its distance from',
    from: 'out vec3 vGround;                       // GR4\n',
    to: 'out vec3 vGround;                       // GR4\nout vec3 vWorld;                        // DISC20-A: where the fog measures from\n',
  }),
  Object.freeze({
    why: 'the world point is where the blade vertex stands, the point the view projects',
    from: '  gl_Position = uVP * vec4(p,1.0);',
    to: '  vWorld = p;   // DISC20-A\n  gl_Position = uVP * vec4(p,1.0);',
  }),
]);
export const GRASSFOG_FS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the terrain\'s five fog uniforms and its fogFactorAt, verbatim, so a blade fogs as the ground under it does',
    from: 'out vec4 o;\n',
    to: 'in vec3 vWorld;\nuniform vec3 uFogColor; uniform int uFogMode; uniform float uFogDensity; uniform vec2 uFogRange; uniform vec3 uCamPos;   // DISC20-A: the terrain\'s fog\n'
      + FOG_FACTOR_GLSL + 'out vec4 o;\n',
  }),
  Object.freeze({
    why: 'the lit and stepped colour blended to the fog colour at the blade\'s distance, as the terrain\'s last line does',
    from: '  o = vec4(c, mix(vFade * smoothstep(0.0, 0.30, vT), 1.0, uPixel));',
    to: '  c = mix(uFogColor, c, fogFactorAt(vWorld));   // DISC20-A\n  c = dwWaterFog(c, vWorld);   // DW-C: and the carved sea\'s distance fog, as the terrain\'s last line takes it\n  o = vec4(c, mix(vFade * smoothstep(0.0, 0.30, vT), 1.0, uPixel));',
  }),
]);
// ═══════════════════════════════════════════════════════════════════
// GRASS-LIT (2026-10-01, Mac: "drastically improve the grass texture
// that isn't super dark and blends well into the terrain"): THE GROUND'S
// COLOUR, AND THE GROUND'S LIGHT.
//
// WHAT WAS WRONG, measured on the real tiles (TEXTURE.302 and its
// climates, read 2026-10-01) and the real light (world/worldClock.js) -
// `node tools/grassLightProbe.mjs` prints it:
//   1. THE BLADE WAS PAINTED A FIXED OLIVE THE GROUND IS NOT. The
//      temperate grass tile averages (52, 76, 42); the blade's middle
//      was (33, 51, 18) - two thirds as bright and twice as yellow - and
//      its root the tile at 0.62, then shaded again by 0.42 of the
//      ambient. Three quarters of every tuft (its root and mid tones)
//      drew darker than the ground under it, and the tip a yellow the
//      tile has nowhere in it: "super dark", and a field that never
//      blends.
//   2. IT WAS DIMMED FOR THE WEATHER TWICE. The lab's weather dim
//      (LAB_DIM: rain 0.60, a storm 0.46) rode on a light the host had
//      already weathered (exteriorAmbient takes the weather's scale
//      squared and the sun takes it once) - a rainy field was a third
//      darker than the ground it stood in.
//   3. IT IGNORED THE LIGHTING LANE. Under Enhanced Lighting (the
//      enhanced skin's default) the ground is decoded, lit in linear,
//      exposed (EL_EXPOSURE x the eye's adaptation), tonemapped and
//      encoded; the grass was lit in display space with none of it, so
//      the two drifted apart every hour of the day.
//   4. IT STOOD IN LIGHT THE GROUND DID NOT GET. The cloud deck's shadow
//      and the sun map (EL2) darken the ground under a cloud or a tree;
//      the blades on that ground stayed in full sun - a lit lawn in a
//      wood's shade. And the light that follows the player (R12) lit
//      the ground at their feet and not the grass on it.
//
// WHAT IT IS NOW. A tuft is painted from THE TILE'S OWN PALETTE: its
// root in the tile's dark third, its middle the tile's mean (the colour
// the placer already bakes per blade, GR4), its tip the light third and
// the highlight the brightest tenth - each a measured ratio of the mean
// (GRASS_PALETTE, the five grass climates' bases averaged), so a field
// is the ground's own colours stood up, in every climate and season.
// It is LIT as the ground is: the ambient, the sun by its scale through
// the deck and the sun map at the root, the moon, the player's light -
// and under Enhanced Lighting through the lane's own decode, exposure,
// adaptation, curve and encode. A soft sward shade (0.86 at the root)
// stays, the rim catches only where the sun does, and past a third of
// the range the colour gives way to the ground's mean, so the far field
// melts into the tile under it instead of drawing a band. The light
// comes from the frame (`light` in LabGrassRenderer.draw); a host that
// hands none of the new terms draws the classic lane's light, in sun.
//
// The lab's text is still what the pins hold; this is the fourth list
// of declared edits laid over it, after the fog's.
// ═══════════════════════════════════════════════════════════════════

/** the tuft's tones as ratios of the tile's mean, per channel: the dark third, the light third, the brightest tenth
 *  of the grass base's texels, luminance-sorted - averaged over the five grass climates (TEXTURE.102, 104, 302, 304,
 *  402), measured 2026-10-01. The ground's texture is low-contrast, and so is the field. */
export const GRASS_PALETTE = Object.freeze({
  root: Object.freeze([0.852, 0.844, 0.953]),
  tip: Object.freeze([1.135, 1.166, 1.089]),
  top: Object.freeze([1.241, 1.275, 1.231]),
});
/** the grass base's mean of each grass climate (0..1), measured with GRASS_PALETTE - the probe's ground, not read at
 *  runtime (the host takes every record's own mean off the tile it draws, GR4) */
export const GRASS_TILE_MEANS = Object.freeze({
  mountain: Object.freeze([59 / 255, 67 / 255, 46 / 255]),
  woodland: Object.freeze([52 / 255, 76 / 255, 42 / 255]),
  'wood-rain': Object.freeze([46 / 255, 69 / 255, 40 / 255]),
  swamp: Object.freeze([44 / 255, 63 / 255, 38 / 255]),
  'mtn-rain': Object.freeze([46 / 255, 53 / 255, 40 / 255]),
});
/** the sward's shade: the ambient a blade's root takes, rising to 1 at its tip */
export const GRASS_SWARD = 0.9;
/** where up the blade its sun is read (m): above the ground's own depth in the sun map, where the ground under a
 *  blade would shadow it by its own bias on a slope - a tree's or a wall's shade is metres tall and still falls on it */
export const GRASS_SUN_LIFT = 0.2;
/** where the colour gives way to the ground's mean: from this share of the range to the next */
export const GRASS_FAR_BLEND = Object.freeze([0.12, 0.6]);
/** the tuft's four tones, as ratios of the ground's mean under each blade (uGrassTone): the ROOT in the tile's own
 *  dark third, so a base melts into the ground it stands in; the MIDDLE in its light third; the TIP and the
 *  HIGHLIGHT past the tile's brightest tenth and a shade greener - a blade in the sun is lighter than the soil
 *  under it, and the eye reads a field by that and nothing else */
export const GRASS_TONES = Object.freeze([
  Object.freeze([0.92, 0.92, 0.97]),
  Object.freeze([1.18, 1.24, 1.08]),
  Object.freeze([1.38, 1.50, 1.14]),
  Object.freeze([1.56, 1.70, 1.25]),
]);
/** GRASS-LIT2: the same four tones for the CLASSIC lane, which lights in display space with no curve and no eye -
 *  CALIBRATED BY PHOTOGRAPH against the default lane at noon (tools/grassLookProbe.mjs, four palettes from one boot on
 *  the real game; the near field's pixels counted by how far they stand over the ground beside them). The share
 *  standing over 1.2x and over 1.3x: the default lane 6.4% and 4.9%; GRASS_TONES on the classic lane 9.9% and 7.2% -
 *  the brighter, limer field; GRASS_TONES as the default lane's mean colours show them (a per-channel match) still
 *  9.1% and 6.3%, because the lane's eye and curve press the middle tones harder than its mean says; these 7.8% and
 *  4.9%, with the tufts' colour over their ground a shade less green than the default lane's. The highlight keeps
 *  the per-channel match. */
export const GRASS_TONES_CLASSIC = Object.freeze([
  Object.freeze([0.93, 0.93, 0.98]),
  Object.freeze([1.06, 1.10, 1.01]),
  Object.freeze([1.24, 1.33, 1.05]),
  Object.freeze([1.45, 1.57, 1.16]),
]);
/** GRASS-LIT2: the ground's slope rides the height lane - its x and z, five bits each (codes 0..30, 15 the level), over
 *  +/- this; a normal leaning further (a slope past 48.6 degrees) is held to it */
export const GRASS_SLOPE_SPAN = 0.75;
/** GRASS-LIT2: the slope's steps either side of level - a step is GRASS_SLOPE_SPAN / this (0.05, under three degrees) */
export const GRASS_SLOPE_STEPS = 15;
/** GRASS-LIT2: the height's share of its lane - the high six bits (7 mm steps over the 0.47 m span, which GRASS5 held
 *  needed eight) */
export const GRASS_HEIGHT_BITS = 6;
/** GRASS-LIT2: the lanterns the vertex stage can be handed - the lane's own cap, so every light the ground takes the grass takes */
export const GRASS_MAX_LIGHTS = EL_MAX_LIGHTS;
/** AUDIT GRASS-LIT2 A1: the lanterns ONE CELL walks - the lights whose reach meets the cell's box, nearest first. The
 *  stage walked all 48 for every triangle of every blade (a third of each warp pays a branch's loop); a 30 m cell under
 *  a lantern's 18 m reach meets one or two, and an open field none */
export const GRASS_CELL_LIGHTS = 8;

export const GRASSLIT_VS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the ground\'s light terms, read where the blade stands: the deck\'s shadow and the sun map (the terrain\'s own readers), the player\'s light, and what the fragment is handed of them',
    from: 'out vec2 vUV; flat out float vVar;      // GRASS-PX: the tuft\'s texel, and which tuft\n',
    to: 'out vec2 vUV; flat out float vVar;      // GRASS-PX: the tuft\'s texel, and which tuft\n'
      + '// GRASS-LIT: the ground\'s light, read once at the root\n'
      + 'uniform float uSunScale;           // GRASS-LIT: the fragment\'s own, here too - the sun\'s reach is asked only while it is up\n'
      + 'uniform vec3 uCamPos;              // GRASS-LIT: the fragment\'s own, here too - the cascades are picked about the eye\n'
      + 'uniform vec4 uIndirect; uniform vec3 uIndirectColor;   // GRASS-LIT: R12, the light that follows the player\n'
      + CLOUD_SHADOW_GLSL + SHADOW_GLSL
      + 'flat out float vSun;                    // GRASS-LIT: the sun that reaches the root - the deck\'s and the map\'s, one value a triangle\n'
      + 'out vec3 vNear;                         // GRASS-LIT: the player\'s light at the root\n'
      + 'out float vFar;                         // GRASS-LIT: how far into the range - the colour gives way to the ground\'s\n'
      + 'uniform float uLane;               // GRASS-LIT2: the fragment\'s own, here too - the lane\'s lantern falloff or the classic one\n'
      + 'uniform int uPointCount;           // GRASS-LIT2: the frame\'s lanterns, torches and candles - the list the ground takes - AUDIT A1: as many of them as meet THIS cell\n'
      + `uniform int uPointIdx[${GRASS_CELL_LIGHTS}];        // AUDIT GRASS-LIT2 A1: which - indices into the frame\'s list (uCasterOf reads the same index)\n`
      + `uniform vec4 uPointLights[${GRASS_MAX_LIGHTS}];     // GRASS-LIT2: xyz the light, w its range\n`
      + `uniform vec3 uPointColors[${GRASS_MAX_LIGHTS}];     // GRASS-LIT2: colour x intensity - linear under the lane, as the ground's\n`
      + EL_ATTEN_GLSL + '\n'
      + 'flat out vec3 vPoint;                   // GRASS-LIT2: the lanterns at the root - one value a triangle, as the sun\n',
  }),
  Object.freeze({
    why: 'AUDIT GRASS-LIT2 A6: the lane\'s own word says what it carries now',
    from: '// GRASS5: u16 x, z, rootY, height - all cell-local, all normalized\n',
    to: '// GRASS5: u16 x, z, rootY, height - all cell-local, all normalized; GRASS-LIT2: the height\'s word is its six bits and the slope\'s ten\n',
  }),
  Object.freeze({
    why: 'GRASS-LIT2: the height lane carries the ground\'s slope - the height in its high six bits, the normal\'s x and z in five each (writeSlot) - so a blade is lit by the hillside it stands on',
    from: '                    uBladeScale.x + aPA.w * uBladeScale.y,\n',
    to: `                    uBladeScale.x + float(hw >> ${16 - GRASS_HEIGHT_BITS}u) / ${(2 ** GRASS_HEIGHT_BITS - 1).toFixed(1)} * uBladeScale.y,   // GRASS-LIT2\n`,
  }),
  Object.freeze({
    why: 'GRASS-LIT2: the lane unpacked ahead of the blade it builds, and the ground\'s normal rebuilt from its x and z',
    from: '  vec4 aInst = vec4(uCellFrame.xy + aPA.xy * uCellSize,\n',
    to: '  // GRASS-LIT2: THE HEIGHT LANE\'S SIXTEEN BITS - the height\'s high six, then the ground normal\'s x and z, five each\n'
      + '  // (codes 0..30, 15 the level, stored XOR 15 so a zero word - a pad, a cleared slot - is level; writeSlot): the terrain\'s\n'
      + '  // own normal under the root (world/terrainSurface.js surfaceNormalAt)\n'
      + '  uint hw = uint(aPA.w * 65535.0 + 0.5);\n'
      + `  vec2 slope = (vec2(float(((hw >> 5u) & 31u) ^ ${GRASS_SLOPE_STEPS}u), float((hw & 31u) ^ ${GRASS_SLOPE_STEPS}u)) - ${GRASS_SLOPE_STEPS.toFixed(1)}) * ${GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS};   // AUDIT A3: stored ^ 15, so a zero word is level\n`
      + '  vec3 gN = vec3(slope.x, sqrt(max(1.0 - dot(slope, slope), 0.0)), slope.y);\n'
      + '  vec4 aInst = vec4(uCellFrame.xy + aPA.xy * uCellSize,\n',
  }),
  Object.freeze({
    why: 'the blade\'s normal stands nearer the ground\'s - it still leans into a low sun, but a field at noon is lit as the tile under it is, not a third darker',
    from: '  vec3 nrm = normalize(vec3(-lean.y, 0.35, lean.x) + vec3(0.0, 0.25, 0.0));',
    to: '  vec3 nrm = normalize(vec3(-lean.y, 0.0, lean.x) + 1.2 * gN);   // GRASS-LIT; GRASS-LIT2: about the ground\'s own normal - level ground\'s is the up the blade stood about',
  }),
  Object.freeze({
    why: 'the root\'s sun (the deck x the sun map, only while the sun is up), the player\'s light by the ground\'s own falloff, and the distance the colour blends by',
    from: '  vMoonLam = max(dot(nrm, normalize(uMoonDir)), 0.0);   // WIND4\n',
    to: '  vMoonLam = max(dot(nrm, normalize(uMoonDir)), 0.0);   // WIND4\n'
      + '  // GRASS-LIT: THE GROUND\'S LIGHT AT THE ROOT - one read a vertex, the flats\' law (a sprite reads its sun once,\n'
      + '  // at its foot): the deck\'s shadow and the sun map as the terrain under it takes them, the player\'s light by the\n'
      + '  // terrain\'s own falloff, and how far into the range the blade stands\n'
      + '  vec3 rootW = vec3(root.x, gRootY + snowSurf, root.y);\n'
      + '  // read in each triangle\'s PROVOKING vertex alone (the last - GL\'s, and WebGL\'s, convention) and handed down flat:\n'
      + '  // the root\'s sun is one value a blade, so the other two vertices of a triangle need not pay the map\'s taps\n'
      + `  vSun = (gl_VertexID % 3 == 2 && uSunScale > 0.0) ? cloudShadowAt(rootW) * sunShadowAt(rootW + vec3(0.0, ${GRASS_SUN_LIFT}, 0.0), vec3(0.0, 1.0, 0.0)) : 0.0;   // off the ground's own depth: a tree's shade, never the ground's acne\n`
      + '  vec3 iL = uIndirect.xyz - rootW; float iD = length(iL);\n'
      + '  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);\n'
      + '  vNear = iAtt * iAtt * max(dot(nrm, iL / max(iD, 1e-4)), 0.0) * uIndirectColor;\n'
      + `  vFar = smoothstep(uRange * ${GRASS_FAR_BLEND[0]}, uRange * ${GRASS_FAR_BLEND[1]}, d);\n`
      + '  // GRASS-LIT2: THE LANTERNS AT THE ROOT - the ground\'s own list and falloff (TERRAIN_FS\'s (1 - d/r)^2, the lane\'s\n'
      + '  // elAttenuation), each light\'s map where it has one (shadowOfLight, the flats\' reader), lifted off the ground as the\n'
      + '  // sun\'s is; read in the provoking vertex alone, as the sun\n'
      + '  vPoint = vec3(0.0);\n'
      + `  if (gl_VertexID % 3 == 2) for (int j = 0; j < ${GRASS_CELL_LIGHTS}; j++) {   // AUDIT A1: the cell's lights, not the frame's\n`
      + '    if (j >= uPointCount) break;\n'
      + '    int i = uPointIdx[j];\n'
      + '    vec3 pL = uPointLights[i].xyz - rootW; float pd = length(pL);\n'
      + '    if (pd >= uPointLights[i].w) continue;\n'
      + '    float pc = clamp(1.0 - pd / uPointLights[i].w, 0.0, 1.0);\n'
      + '    float pa = uLane > 0.5 ? elAttenuation(pd, uPointLights[i].w) : pc * pc;\n'
      + `    vPoint += pa * shadowOfLight(i, uPointLights[i], rootW + vec3(0.0, ${GRASS_SUN_LIFT}, 0.0), vec3(0.0)) * max(dot(nrm, pL / max(pd, 1e-4)), 0.0) * uPointColors[i];\n`
      + '  }\n',
  }),
]);

export const GRASSLIT_FS_EDITS = Object.freeze([
  Object.freeze({
    why: 'what the vertex stage reads at the root, the lane\'s switch and exposure, the eye\'s adaptation, and the lane\'s codec and curve',
    from: 'uniform float uPixel, uPxSteps, uPxVariants, uPxTintBands; uniform sampler2D uPxSheet;   // GRASS-PX\n',
    to: 'uniform float uPixel, uPxSteps, uPxVariants, uPxTintBands; uniform sampler2D uPxSheet;   // GRASS-PX\n'
      + 'flat in float vSun; in vec3 vNear; in float vFar;   // GRASS-LIT\n'
      + 'flat in vec3 vPoint;   // GRASS-LIT2: the lanterns at the root\n'
      + 'uniform float uLane, uELExposure;   // GRASS-LIT: 1 under Enhanced Lighting, and the lane\'s exposure\n'
      + 'uniform vec3 uGrassTone[4];   // GRASS-LIT: the tuft\'s four tones as ratios of the ground\'s mean - root, middle, tip, highlight (GRASS_TONES)\n'
      + AIR_ADAPT_GLSL + EL_CODEC_GLSL + '\n' + EL_TONEMAP_GLSL,
  }),
  Object.freeze({
    why: 'the tuft is painted from the tile\'s own palette: its dark third, its mean, its light third and its brightest tenth',
    from: '  vec3 root = vGround * 0.62;\n  vec3 mid  = vec3(0.13,0.20,0.07);\n  vec3 tip  = vec3(0.24,0.32,0.12);',
    to: '  vec3 root = vGround * uGrassTone[0];   // GRASS-LIT: the ground\'s colour, in the shade of the sward\n'
      + '  vec3 mid  = vGround * uGrassTone[1];   // GRASS-LIT\n'
      + '  vec3 tip  = vGround * uGrassTone[2];   // GRASS-LIT\n'
      + '  vec3 top  = vGround * uGrassTone[3];   // GRASS-LIT: the highlight texel',
  }),
  Object.freeze({
    why: 'the pixel style\'s fourth tone is the highlight texel, and the tuft\'s blades stand a little nearer one another',
    from: '  if (uPixel > 0.5) c = (pxTone < 1.5 ? root : (pxTone < 2.5 ? mid : tip)) * (0.92 + pxBlade * 0.16);',
    to: '  if (uPixel > 0.5) c = (pxTone < 1.5 ? root : (pxTone < 2.5 ? mid : (pxTone < 3.5 ? tip : top))) * (0.95 + pxBlade * 0.10);   // GRASS-LIT: the highlight is the tile\'s brightest tenth',
  }),
  // the patch tint keeps its mean and loses its extremes (0.88..1.12) - a field of the ground's colours, varied as the
  // tile is. Two edits on its two numbers, never the pixel style's band formula between them (MUT-AIM: an edit that
  // repeats a line gives another list's mutant anchor a second site)
  Object.freeze({
    why: 'the patch tint\'s floor',
    from: '  c *= 0.80 + mix(vTint, ',
    to: '  c *= 0.88 + mix(vTint, ',
  }),
  Object.freeze({
    why: 'the patch tint\'s span',
    from: ', uPixel) * 0.42;',
    to: ', uPixel) * 0.24;',
  }),
  Object.freeze({
    why: 'the far field gives way to the ground\'s mean, before the wet and the snow (which are the ground\'s too)',
    from: '  // wet grass is DARKER; snow-laden grass is pale and cold\n',
    to: '  c = mix(c, vGround, vFar);   // GRASS-LIT: the far field is the ground\'s colour\n'
      + '  // wet grass is DARKER; snow-laden grass is pale and cold\n',
  }),
  Object.freeze({
    why: 'lit as the ground is - the ambient under a soft sward shade, the sun through the deck and the map, the moon, the player\'s light - and under Enhanced Lighting through the lane\'s own decode, exposure, curve and encode',
    from: '  c *= (uAmb * 1.25 * (0.42 + 0.58*t) + uSunCol * (uSunScale * 1.15 * vLam) + uMoonCol * (uMoonScale * 1.15 * vMoonLam));',
    to: `  vec3 light = uAmb * (${GRASS_SWARD} + ${(1 - GRASS_SWARD).toFixed(2)}*t) + uSunCol * (uSunScale * vLam * vSun) + uMoonCol * (uMoonScale * vMoonLam) + vNear + vPoint;   // GRASS-LIT; GRASS-LIT2: and the lanterns\n`
      + '  c = uLane > 0.5 ? elEncode(elTonemapRGB(elDecode(c) * light * (uELExposure * elAdapt()))) : c * light;   // GRASS-LIT: the lane\'s pipeline, as EL_TERRAIN_FS runs it',
  }),
  Object.freeze({
    why: 'the rim catches only where the sun reaches the root, and softer - a highlight, not a glow',
    from: '  c += uSunCol * (uSunScale * 0.20) * mix(smoothstep(0.86,1.0,t), step(3.5, pxTone), uPixel) * vLam;   // GRASS-PX',
    to: '  c += uSunCol * (uSunScale * 0.12) * mix(smoothstep(0.86,1.0,t), step(3.5, pxTone), uPixel) * vLam * vSun;   // GRASS-PX; GRASS-LIT: under the deck and the map',
  }),
]);

// ═══════════════════════════════════════════════════════════════════
// MEADOW1 (2026-10-06, Mac: "These are 4 textures I want to blend into our grass system, all with varying sizes so its
// not monotonous everywhere" - and a bush - "instead of billboarding, these should have a sort of low poly look to
// them, like the trees"): THE OWNER'S SPRITES ON CROSSED CARDS, the fifth list of declared edits, laid last. The
// meadow is a pixel style (uPixel 1: a hard alpha, the dithered fade, a share of each cell) that wears the owner's
// atlas on the sheet's unit, and three things in it are its own, behind `uArt`: which sprite a blade wears and how big
// its card is, the cards themselves - fixed in the world at the tuft's own yaw, each lit by its own face - and the
// texel being the colour. The law and its numbers are render/grassMeadow.js's; the GLSL below is written from them.
// ═══════════════════════════════════════════════════════════════════

/** a JS number as a GLSL float literal - a whole number keeps its point */
const glf = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** a per-variant value chosen by `mVar`, as a ternary ladder (a const array indexed at runtime is the kind of thing a
 *  driver gets wrong - GRASS-PX's bayer4 says why) */
const byVariant = (key) => MEADOW_VARIANTS.slice(0, -1).map((v, i) => `mVar < ${glf(i + 0.5)} ? ${glf(v[key])} : `).join('') + glf(MEADOW_VARIANTS.at(-1)[key]);
const share = (pair) => `mix(${glf(pair[0])}, ${glf(pair[1])}, mLush)`;
/** AUDIT MEADOW1: the sprite's drawn box by `mVar` - u0, u1, v0, v1 (render/grassMeadow.js MEADOW_BOXES) */
const box4 = (b) => `vec4(${glf(b.u0)}, ${glf(b.u1)}, ${glf(b.v0)}, ${glf(b.v1)})`;
const byBox = () => MEADOW_BOXES.slice(0, -1).map((b, i) => `mVar < ${glf(i + 0.5)} ? ${box4(b)} : `).join('') + box4(MEADOW_BOXES.at(-1));
export const GRASSMEADOW_VS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the card a vertex stands on - the meadow\'s corner arrays carry its turn; the blade arrays leave the attribute unset, which reads 0',
    from: '// GRASS5: u8 ground.rgb, phase\n',
    to: '// GRASS5: u8 ground.rgb, phase\n'
      + 'layout(location=3) in float aCard;       // MEADOW1: the card\'s turn, a share of a half-turn, +1 when mirrored (render/grassMeadow.js meadowCardCorners)\n',
  }),
  Object.freeze({
    why: 'the switch: the owner\'s art on crossed cards',
    from: 'uniform float uPixel, uPxVariants;',
    to: 'uniform float uArt;                  // MEADOW1: 1 in the meadow - the owner\'s sprites on crossed cards\n'
      + 'uniform float uPixel, uPxVariants;',
  }),
  Object.freeze({
    why: 'which sprite, how big its card, and which way its cards face - before the sway, the quad and the root read the height',
    from: '  float h = max(0.0, trueH - snowSurf);\n',
    to: '  float h = max(0.0, trueH - snowSurf);\n'
      + '  // MEADOW1: WHICH SPRITE, HOW BIG, AND WHICH WAY. The width byte is a uniform random the sprite styles never draw a\n'
      + '  // width with (their quad is the sprite\'s); the patch is the tint GRASS6 bakes. The card\'s side is the blade\'s height\n'
      + '  // times its sprite\'s scale and the patch\'s, and everything below that reads the height reads the card\'s.\n'
      + '  float mVar = 0.0, mStiff = 1.0, mSway = 1.0; vec2 mC = aCorner, mDir = vec2(1.0, 0.0), mLean = vec2(0.0);\n'
      + '  if (uArt > 0.5) {\n'
      + `    float mLush = smoothstep(${glf(MEADOW_LUSH[0])}, ${glf(MEADOW_LUSH[1])}, aInst2.z);\n`
      + `    float mB = ${share(MEADOW_SHARES.bush)}, mF = ${share(MEADOW_SHARES.flowers)}, mD = ${share(MEADOW_SHARES.dry)};\n`
      + '    float mR = aPB.w;\n'
      + `    mVar = mR < mB ? ${glf(MEADOW_BUSH)} : (mR < mB + mF ? ${glf(MEADOW_FLOWERS)} : (mR < mB + mF + mD ? ${glf(MEADOW_DRY)}`
      + ` : ((mR - mB - mF - mD) / (1.0 - mB - mF - mD) < ${share(MEADOW_SHARES.short)} ? ${glf(MEADOW_SHORT)} : ${glf(MEADOW_TALL)})));\n`
      + `    h *= (${byVariant('scale')}) * mix(${glf(MEADOW_PATCH_SCALE[0])}, ${glf(MEADOW_PATCH_SCALE[1])}, mLush);\n`
      + `    mStiff = ${byVariant('stiff')};\n`
      + `    mSway = ${byVariant('sway')};   // AUDIT MEADOW1: its share of the wind - the trees' own\n`
      + `    vec4 mBox = ${byBox()};   // AUDIT MEADOW1: its sprite's drawn box (MEADOW_BOXES) - the card is cut to it\n`
      + '    mC = mix(mBox.xz, mBox.yw, aCorner);\n'
      + `    float mYaw = hash(aPA.xy * ${glf(MEADOW_SEED)});   // the tuft's own turn, fixed in the world - AUDIT MEADOW1: off its place in its cell, which no shift of the origin moves\n`
      + '    float mA = (mYaw + fract(aCard)) * 3.141592653589793;   // the card\'s turn off the tuft\'s\n'
      + '    mDir = vec2(cos(mA), sin(mA));\n'
      + '    if ((fract(mYaw * 8.0) >= 0.5) != (aCard >= 1.0)) mDir = -mDir;   // mirrored, by tuft and by every other card - AUDIT MEADOW1: the card turned, so its box holds\n'
      + `    if (fract(aCard) > 0.5 && d > uRange * (${glf(MEADOW_NEAR_AT)} + ${glf(MEADOW_NEAR_BAND)} * fract(mYaw * 64.0))) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // AUDIT MEADOW1: the third card goes tuft by tuft across the band\n`
      + '  }\n',
  }),
  Object.freeze({
    why: 'the card: square (the sprite\'s texels are), at the tuft\'s own yaw and fixed in the world - no billboard - cut to its sprite, leaning its own share of the lab\'s lean and swaying its share of the wind',
    from: ', h * 0.5, uPixel);   // GRASS-PX; GRASS AUDIT 1: the width is the height\'s, per blade\n',
    to: ', h * 0.5, uPixel);   // GRASS-PX; GRASS AUDIT 1: the width is the height\'s, per blade\n'
      + '  if (uArt > 0.5) { vT = mC.y; mLean = aInst2.xy * mStiff + (lean - aInst2.xy) * mSway; p.xz = root + mLean * (vT*vT) * h + mDir * (mC.x - 0.5) * h; }   // MEADOW1: the card\n',
  }),
  Object.freeze({
    why: 'AUDIT MEADOW1: the card\'s foot on the ground\'s own slope - a level foot hung the downhill end of a bush a quarter-metre over a hillside',
    from: '  p.y = terrain(root) + snowSurf + vT * h;\n',
    to: '  p.y = terrain(root) + snowSurf + vT * h;\n'
      + `  if (uArt > 0.5) p.y += dot(p.xz - root, -gN.xz) / max(gN.y, ${glf(MEADOW_SLOPE_FLOOR)});   // AUDIT MEADOW1: sheared to the ground under it\n`,
  }),
  Object.freeze({
    why: 'the sprite the law picked, and the texel its cut corner stands on',
    from: 'every tuft re-rolled at each map pixel crossed\n',
    to: 'every tuft re-rolled at each map pixel crossed\n'
      + '  if (uArt > 0.5) { vVar = mVar; vUV = mC; }   // MEADOW1\n',
  }),
  Object.freeze({
    why: 'AUDIT MEADOW1: the card is lit by the lean it stands at - its own share of the standing lean and of the wind - so a meadow the trees\' switch holds still is lit still',
    from: 'level ground\'s is the up the blade stood about\n',
    to: 'level ground\'s is the up the blade stood about\n'
      + '  if (uArt > 0.5) nrm = normalize(vec3(-mLean.y, 0.0, mLean.x) + 1.2 * gN);   // AUDIT MEADOW1: its own lean\n',
  }),
  Object.freeze({
    why: 'each card shaded by its own face - the side the eye sees - by the low-poly trees\' own face law, on the sun\'s light and the moon\'s: a low sun picks the facets out',
    from: 'vMoonLam = max(dot(nrm, normalize(uMoonDir)), 0.0);   // WIND4\n',
    to: 'vMoonLam = max(dot(nrm, normalize(uMoonDir)), 0.0);   // WIND4\n'
      + '  if (uArt > 0.5) {   // MEADOW1: THE CARD\'S FACE, as a low-poly tree\'s (render/renderer.js BB_VS): its light times a shade of\n'
      + '    // its face against the light, never under half - the blade\'s own lambert about the ground stays under it\n'
      + '    // AUDIT MEADOW1: by the light\'s HEIGHT - every card is upright, so the trees\' law alone took 0.28 off the whole\n'
      + '    // meadow at noon (a tree\'s up-turned faces take it whole); a light overhead lights the cards as their ground\n'
      + '    vec2 mN = vec2(-mDir.y, mDir.x); if (dot(mN, uEye.xz - root) < 0.0) mN = -mN;\n'
      + '    vec3 mSun = normalize(uSunDir), mMoon = normalize(uMoonDir);\n'
      + `    vLam *= mix(1.0, clamp(${glf(MEADOW_FACE.base)} + ${glf(MEADOW_FACE.span)} * dot(vec3(mN.x, 0.0, mN.y), mSun), ${glf(MEADOW_FACE.floor)}, 1.0), length(mSun.xz));\n`
      + `    vMoonLam *= mix(1.0, clamp(${glf(MEADOW_FACE.base)} + ${glf(MEADOW_FACE.span)} * dot(vec3(mN.x, 0.0, mN.y), mMoon), ${glf(MEADOW_FACE.floor)}, 1.0), length(mMoon.xz));\n`
      + '  }\n',
  }),
]);
export const GRASSMEADOW_FS_EDITS = Object.freeze([
  Object.freeze({
    why: 'the switch, and the ground the owner\'s colours were drawn for',
    from: 'uniform vec3 uGrassTone[4];',
    to: 'uniform float uArt; uniform vec3 uArtGround;   // MEADOW1: the owner\'s art, and the ground its colours are drawn for (meadowArtGround)\n'
      + 'uniform vec3 uGrassTone[4];',
  }),
  Object.freeze({
    why: 'the sprite\'s own colour, kept from the sample',
    from: '  float t = vT; float pxTone = 0.0; float pxBlade = 0.0;\n',
    to: '  float t = vT; float pxTone = 0.0; float pxBlade = 0.0;\n'
      + '  vec3 art = vec3(0.0);   // MEADOW1: the owner\'s colour\n',
  }),
  Object.freeze({
    why: 'AUDIT MEADOW1: a card\'s mip level by its HEIGHT on screen - an upright card turned edge-on is squeezed across, and the GPU\'s level by the squeezed axis filled it to a solid needle',
    from: '    vec4 px = texture(uPxSheet, vec2((vVar + vUV.x) / uPxVariants, vUV.y));\n',
    to: '    vec2 pxUv = vec2((vVar + vUV.x) / uPxVariants, vUV.y);\n'
      + '    vec4 px;\n'
      + `    if (uArt > 0.5) { float mLod = log2(max(max(abs(dFdx(vUV.y)), abs(dFdy(vUV.y))) * ${glf(MEADOW_CELL)}, 1.0)); px = textureLod(uPxSheet, pxUv, mLod); }   // MEADOW1: the cell's texels down a pixel - the switch a uniform, so the derivatives stand in uniform control\n`
      + '    else px = texture(uPxSheet, pxUv);\n',
  }),
  Object.freeze({
    why: 'in the meadow the texel IS the colour, and the sward\'s shade climbs the card',
    from: 't = px.g; pxBlade = px.b;\n',
    to: 't = px.g; pxBlade = px.b;\n'
      + '    if (uArt > 0.5) { art = px.rgb; t = vUV.y; pxTone = 0.0; }   // MEADOW1: no tone, so no rim texel\n',
  }),
  Object.freeze({
    why: 'the owner\'s colours, moved by the ground they stand on - the tile\'s mean over the ground they are drawn for (his green at the lane\'s middle tone), per channel, held to a span; a texel takes that hue as far as it is green, and a petal or a dry stalk only its brightness',
    from: 'three flat tones, and the tuft\'s blades a shade apart\n',
    to: 'three flat tones, and the tuft\'s blades a shade apart\n'
      + `  if (uArt > 0.5) { vec3 mS = clamp(vGround / uArtGround, ${glf(MEADOW_SHIFT[0])}, ${glf(MEADOW_SHIFT[1])}); `
      + `c = art * mix(vec3(dot(mS, vec3(0.299, 0.587, 0.114))), mS, clamp((art.g - max(art.r, art.b)) * ${glf(MEADOW_GREEN_EDGE)}, 0.0, 1.0)); }   // MEADOW1: his green, the tile's own; his petals his own\n`,
  }),
  Object.freeze({
    why: 'AUDIT MEADOW1: no ramp in the meadow - its palette is the owner\'s own shading, and banding its light folded his shades a rung apart into one (and cost two pow a fragment)',
    from: '  if (uPixel > 0.5) { float l = max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4);',
    to: '  if (uPixel > 0.5 && uArt < 0.5) { float l = max(dot(c, vec3(0.299, 0.587, 0.114)), 1e-4);',
  }),
]);

/** what the game compiles: the lab's stages under the pixel style's edits, then the fog's (DISC20-A), then the
 *  ground's colour and light (GRASS-LIT), then the meadow's (MEADOW1) */
export const GAME_GRASS_VS = applyGrassEdits(applyGrassEdits(applyGrassEdits(applyGrassEdits(LAB_GRASS_VS, GRASSPX_VS_EDITS), GRASSFOG_VS_EDITS), GRASSLIT_VS_EDITS), GRASSMEADOW_VS_EDITS);
export const GAME_GRASS_FS = applyGrassEdits(applyGrassEdits(applyGrassEdits(applyGrassEdits(LAB_GRASS_FS, GRASSPX_FS_EDITS), GRASSFOG_FS_EDITS), GRASSLIT_FS_EDITS), GRASSMEADOW_FS_EDITS);

/**
 * GRASS-LIT: THE FRAGMENT'S COLOUR IN JS, term for term (the smooth style, at a blade's height `t`, no patch tint,
 * no rim, the sun unshadowed, the blade at rest) - so the probe and the pins can hold the arithmetic the GPU runs
 * against the ground's (tools/grassLightProbe.mjs). `ground` the tile's mean (0..1, display), `light` the frame's
 * `{ amb, sunCol, sunScale, sunDir, moonCol?, moonScale?, moonDir? }` (display colours), `lane` true for
 * Enhanced Lighting (exposure EL_EXPOSURE, the eye's `adapt`). GRASS-LIT2: each lane's own tones; `light.normal` the
 * ground's (level when absent); `light.points` the lanterns `[{ at, range, color }]` (display colours, unshadowed)
 * read at `light.root`. AUDIT GRASS-LIT2: `tones` paints with other tones than the lane's own - the probe's
 * blade from before GRASS-LIT2, whose classic lane drew in GRASS_TONES.
 */
export function grassLit(ground, t, light, lane = false, adapt = 1, tones = null) {
  const ss = (a, b, x) => smoothstep(a, b, x);
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const [root, mid, tip] = (tones ?? (lane ? GRASS_TONES : GRASS_TONES_CLASSIC)).slice(0, 3).map((k) => ground.map((v, i) => v * k[i]));
  let c = mix(root, mid, ss(0, 0.55, t));
  c = mix(c, tip, ss(0.5, 1, t));
  // the blade's normal at rest - the ground's own, past the lean's share (GRASSLIT_VS_EDITS: normalize(1.2 * gN))
  const n = light.normal ?? [0, 1, 0];
  const lamOf = (d) => { const l = Math.hypot(d[0], d[1], d[2]) || 1; return Math.max((n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / l, 0); };
  const lam = lamOf(light.sunDir);
  const moonLam = light.moonDir ? lamOf(light.moonDir) : 0;
  const dec = (v) => (lane ? elDecode(v) : v);
  const amb = GRASS_SWARD + (1 - GRASS_SWARD) * t;
  // GRASS-LIT2: the lanterns at the root, by the lane's falloff or the classic (1 - d/r)^2
  const pt = [0, 0, 0], at = light.root ?? [0, 0, 0];
  for (const p of light.points ?? []) {
    const L = [p.at[0] - at[0], p.at[1] - at[1], p.at[2] - at[2]], d = Math.hypot(L[0], L[1], L[2]);
    if (d >= p.range) continue;
    const a = lane ? elAttenuation(d, p.range) : (1 - d / p.range) ** 2;
    const k = a * Math.max((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / Math.max(d, 1e-4), 0);
    for (let i = 0; i < 3; i++) pt[i] += k * dec(p.color[i]);
  }
  const lit = c.map((v, i) => dec(v) * (dec(light.amb[i]) * amb + dec(light.sunCol[i]) * light.sunScale * lam
    + dec(light.moonCol?.[i] ?? 1) * (light.moonScale ?? 0) * moonLam + pt[i]));
  return lane ? elTonemapRGB(lit.map((v) => v * EL_EXPOSURE * adapt)).map(elEncode) : lit;
}

// GRASS2 (Mac: "I also want to shorten the grass length. Little too tall
// for my liking"): the height was GR1's 54 and is 38. It is the one
// number the blade law scales by - `(0.22 + rnd*0.42) * (height/34)` -
// so a blade runs 0.25..0.72 world units now against 0.35..1.02, and
// nothing else about the field moves.
//
// GRASS2 (Mac: "have it be seen at long ranges"): the range was the
// lab's 200 and is 300 - GRASS5's pack is what paid for it. `span`
// follows it, because the window has to hold the range or the window's
// edge is a visible wall, and stays a whole number of cells.
//
// WHY 300 AND NOT FURTHER, which is no longer a memory question.
//
// MEMORY IS NOT THE CAP ANY MORE. GRASS5's pack took a blade from 48
// bytes to 16, so this range holds 47 MB of buffer where the lab's own
// 200 m held 75. Even 350 m would be 61 MB. The wall that stopped
// GRASS2 at 250 is gone.
//
// WHAT STOPS IT IS THE TRADE, measured rather than assumed
// (tools/grassFieldProbe.mjs prints the curve):
//
//     200 m  3.54M verts   55,982 lit pixels
//     250 m  4.97M         56,386
//     300 m  6.80M         56,693
//     350 m  8.73M         56,763
//
// Every extra 50 m costs about a million vertices and buys a tenth of a
// per cent of grass. That is what a UNIFORM world density does: the
// field keeps the same blades a square metre at the horizon as underfoot,
// where they are sub-pixel and pile up behind each other. 300 m is the
// balance point - half again the lab's range, still a fifth under its
// vertex cost - and spending further at this density would buy nothing
// anyone can see.
//
// THE NEXT STEP IS NOT MORE RANGE, IT IS LESS DENSITY AT RANGE: a field
// whose blades-per-square-metre falls with distance so the SCREEN
// density stays constant. That is a different placer, and GRASS3 already
// proved the hard part of it - a shader can work out where the ground is
// to within a thousandth of a blade, so the blades need not be stored
// at all.
// `density` is a COUNT over `densitySpan`, not a rate - so the range and
// the span may move only if the rate is held. 1,200,000 blades over the
// lab's 420 m window is 6.80 blades a square metre, and that is the
// number the field is actually dense by; a wider window at the same
// count would be the same grass spread thinner, which is a thinning
// dressed up as a range increase.
// `span` is a WHOLE NUMBER OF CELLS either side (2 x 270 = 540 = 18 x
// GRASS_CELL). It has to be: the window is [eye - span, eye + span] and
// its two edges are floored independently, so a span that is not a
// multiple of the cell puts the edges out of phase and a step that adds
// one column at the front drops TWO at the back. The field still draws
// correctly - it just churns cells it did not need to, which is the
// hitch GR5 was built to remove. The lab's 210 was a multiple by luck
// (420 = 14 x 30); this one is by intent.
export const LAB_GRASS = Object.freeze({ density: 1200000, height: 38, range: 300, span: 315, densitySpan: 210, seed: 0x2f6e2b1 });

/**
 * GR2 (Mac: there is no wind movement). The lab's wind is a SLIDER,
 * 0..200, default 70 - and the game had mapped the sky's row wind (a
 * cloud-drift vector, 0.011 on a sunny day, 0.048 in a thunderstorm)
 * times 260, which put a sunny day at 2.8 on that slider and a storm
 * at 12: the sward barely stirred. ONE mapping now, for the grass and
 * the rain alike: a sunny day lands at the lab's own default of 70,
 * and the storm rows climb to the slider's top. The direction is the
 * row's; only the magnitude is rescaled.
 */
export function labWindSlider(w) {
  const mag = Math.hypot(w?.[0] ?? 0, w?.[1] ?? 0);
  return Math.min(200, mag * 6500);
}
/** the lab's weather dim table, for uDim */
export const LAB_DIM = Object.freeze({ sunny: 1.00, cloudy: 0.90, overcast: 0.72, fog: 0.66, rain: 0.60, thunder: 0.46, snow: 0.80, sandstorm: 0.55 });   // WEATHER2d: the port's own row, the lab's table untouched

/**
 * The lab's scatter, verbatim in its law, around `centre` (world xz):
 * returns the candidate list the lab would draw, before the game decides
 * which may stand. `keep(x, z)` answers with the ground height under a
 * candidate, or null if no blade may stand there.
 */
export function placeLabGrass(opts) {
  const it = placeLabGrassSteps(opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

/**
 * GR2 (Mac: the game hitches when walking and they load in). The same
 * scatter as a GENERATOR: it yields every `step` candidates, so the host
 * can walk a few milliseconds' worth per frame and swap the finished
 * scatter in when the walk is done. The law, the seed and the sequence
 * are identical - only the clock is shared.
 */
// ── GR5: THE FIELD IS ANCHORED TO THE WORLD, NOT TO THE EYE ─────────
//
// Mac: "it sometimes hitches and switches while walking. There's also a
// slight pop in/pop out issue." Both were one design: every blade was
// placed RELATIVE TO THE CENTRE from one seed, so when the eye moved
// 60m and the scatter rebuilt, every blade in the field moved with it
// - the switch - and the rebuild's finish uploaded all 1.2M blades in
// one call - the hitch.
//
// Now the world is cut into CELLS, each seeded from its own coordinates,
// so a patch of ground always grows the same blades whoever is looking.
// Walking adds cells at the leading edge and frees them at the trailing
// one, inside the range fade; nothing in the middle ever moves. Each
// cell owns a fixed SLOT in the buffers - padded with zero-height blades
// - so a cell arrives by one bufferSubData into its slot and leaves by
// one write of zeros: no repack, no whole-field upload, ever.
//
// The blade laws are unchanged: the same height, lean, tint, width and
// phase draws, in the same order per blade, so the field LOOKS the same
// - only where the randomness is anchored moved.
export const GRASS_CELL = 30;


/** PERF10 (2026-09-19): THE CELL'S KEY AS A NUMBER, pieceKey's law one
 *  level up. The field's `live` map was keyed by `${cx},${cz}` and the
 *  free-sweep ran `key.split(',').map(Number)` over EVERY live cell
 *  EVERY frame - four hundred odd cells, so a string split, an array and
 *  two boxed numbers apiece, a thousand allocations a frame to decide
 *  that nothing had moved. cx * 65536 + cz is injective for |cz| <
 *  32768, which a scene coordinate under a floating origin is nowhere
 *  near (the world recenters), and the sweep now reads cx/cz off the
 *  entry rather than out of its own key. */
export const cellKey = (cx, cz) => cx * 65536 + cz;

/** PERF10: HOW MANY SLOTS A DISC NEEDS. The field's window was the
 *  square [eye - span, eye + span], and the draw (PERF2) skips any cell
 *  whose nearest point is past `range` - so the square's corners, out at
 *  1.4 x range, were placed, packed and uploaded every one of them and
 *  never drew a fragment. The fill is a disc now, and this is the most
 *  cells such a disc can hold.
 *
 *  AUDIT PERF10 F1: THE COUNT IS SWEPT, AND THE SWEEP HAS TO BE FINE.
 *  The first draft swept 8x8 offsets inside a cell and answered 392 for
 *  the shipped span; a brute force at 240x240 answers 394, and the peak
 *  sits at offset (0, 6) - x exactly ON a cell boundary, where TWO
 *  columns have a nearest-edge distance of zero and the row count jumps.
 *  A coarse sweep steps straight over it. The square window this
 *  replaced was exactly tight (22 x 22 = 484 = its own slot count), so
 *  an under-count was a regression: `update` would find `free` empty,
 *  break, and leave that cell unplaced for as long as the eye stood
 *  there - a 30 m hole in the grass with nothing to recover it. The
 *  sweep is 240 now and the loop below is O(columns + rows) per offset
 *  rather than O(columns x rows), so a finer sweep costs less than the
 *  coarse one did. `update` ALSO evicts rather than breaking, so no
 *  hole survives a bound that is wrong again.
 *
 *  The distances from an eye at offset `o` to each column's nearest
 *  edge are `0` for the eye's own column, `k * cell - o` to its right
 *  and `o + j * cell` to its left; at o = 0 the two series both yield 0,
 *  which is the degenerate double column the peak lives on.
 *  Pure, so a pin can hold it against the fill loop.
 *
 *  PERF-EXT20 (2026-09-25, the players: "fps issues in the exterior
 *  but fine in the interior", "me too my friend.. don't know why. I
 *  got a RX6600"): AND IT IS SWEPT ONCE. The answer is a pure function
 *  of its three arguments - 394 for the shipped span, every time - and
 *  the sweep that finds it is 11-33 ms, paid by every createGrassField:
 *  the boot, every teleport and quickload, and until PERF-EXT21 every
 *  pixel crossing, on the crossing frame itself. The first call per
 *  (radius, cell, steps) sweeps and the rest read the memo. The memo is
 *  this module's and lives as long as it does - one entry per distinct
 *  question, and the game asks one. The world warms it at mount, behind
 *  the loading screen, so no frame pays even the first sweep. */
const _discMemo = new Map();   // PERF-EXT20: `${radius},${cell},${steps}` -> the swept count
let _discSweeps = 0;
/** PERF-EXT20: how many times the sweep has actually run - the test seam. */
export const discSweeps = () => _discSweeps;
export function discSlotCount(radius, cell = GRASS_CELL, steps = 240) {
  const key = `${radius},${cell},${steps}`;
  let n = _discMemo.get(key);
  if (n === undefined) { n = discSweep(radius, cell, steps); _discMemo.set(key, n); }
  return n;
}
/** PERF10's sweep, verbatim - discSlotCount's answer when the memo has none. */
function discSweep(radius, cell, steps) {
  _discSweeps++;
  const r2 = radius * radius;
  const axes = [];
  for (let i = 0; i < steps; i++) {
    const o = (i / steps) * cell;
    const d = [0];
    for (let k = 1; k * cell - o <= radius; k++) d.push(k * cell - o);
    for (let j = 0; o + j * cell <= radius; j++) d.push(o + j * cell);
    d.sort((p, q) => p - q);
    axes.push(d);
  }
  let max = 0;
  for (const dx of axes) {
    for (const dz of axes) {
      let n = 0, hi = dz.length - 1;
      for (const u of dx) {
        const t = r2 - u * u;
        if (t < 0) break;                       // dx ascends, so nothing past here fits either
        while (hi >= 0 && dz[hi] * dz[hi] > t) hi--;
        n += hi + 1;
      }
      if (n > max) max = n;
    }
  }
  return max;
}

/** One cell's seed, from its coordinates - the anchor. */
export function grassCellSeed(cx, cz, seed = LAB_GRASS.seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (cx * 0x85ebca6b | 0), 0xc2b2ae35) >>> 0;
  h = Math.imul(h ^ (cz * 0x27d4eb2f | 0), 0x165667b1) >>> 0;
  h ^= h >>> 15;
  return (h || 1) >>> 0;
}

/** GRASS5 (2026-09-19): THE BLADE, PACKED.
 *
 *  A blade was twelve floats on the GPU - 48 bytes - and almost none of
 *  it needed that much. The DRAW cost stopped tracking the field's area
 *  at GRASS2, but the STORAGE never did: every cell in the window holds
 *  near-field density whether it is underfoot or at the horizon, which
 *  is 106 MB of buffer at a 250 m range and 169 at 320. That, and not
 *  the frame, is what capped the range.
 *
 *  What each field actually needs, measured against what it was given:
 *
 *    x, z     cell-local, so 16 bits over 30 m is 0.46 mm
 *    rootY    cell-local over the cell's own height span, 16 bits
 *    height   0.25..0.72 units, so 8 bits is 1.8 mm (GRASS-LIT2: six of its u16, 7 mm; the slope the rest)
 *    phase    a wind phase, 8 bits is 0.025 rad
 *    lean     +/-0.25, 8 bits is 0.002
 *    tint     0..1, 8 bits
 *    width    0.052..0.107, 8 bits is 0.2 mm
 *    ground   an RGB that was averaged from 8-bit texels to begin with
 *
 *  Sixteen bytes, and every one of them is finer than the eye or the
 *  float32 it replaced can tell. Three times the field for the same
 *  memory: a 390 m range now costs less than 250 m did.
 *
 *  THE PLACER STILL WORKS IN FLOATS. Its laws - the heights, the leans,
 *  the clustering, the seed - are pinned as floats and stay that way;
 *  the packing happens at `writeSlot`, the one place where a blade
 *  crosses to the GPU. A cell's worth of float scratch is transient and
 *  reused; the buffers are what the wall was made of.
 *
 *  The cell's ORIGIN and its height base ride as per-slot uniforms, not
 *  per blade, because every blade in a cell shares them - which is the
 *  whole reason 16 bits is enough for a position. */
export const GRASS_PACK_BYTES = 16;
/**
 * GRASS-LIT2 (2026-10-02): THE HEIGHT LANE, SHARED WITH THE GROUND'S SLOPE. GRASS5 gave the height a u16 and wrote that
 * it needed eight bits; it takes the high GRASS_HEIGHT_BITS now (7 mm over its 0.47 m span), and the ground normal's x
 * and z under the root take five each - codes 0..30 over +/-GRASS_SLOPE_SPAN, 15 the level, so level ground packs
 * exactly level; each code is stored XOR 15 (AUDIT A3), so a ZERO word - a pad blade, a cleared slot - decodes to the
 * height floor on level ground, where it decoded to the steepest lean. The quantising is DITHERED by the blade's index (the R2 sequence's two axes): the placer emits a
 * cell's blades in random order, so the step a hillside's normal is rounded to lands as grain across the field and
 * never as a contour line; the mean of a patch is the slope's own. No byte more a blade.
 * @param {number} hn the height over its span, 0..1
 * @param {number} nx the ground normal's x
 * @param {number} nz the ground normal's z
 * @param {number} i the blade's index in its cell - the dither's
 * @returns {number} the lane's u16
 */
export function packHeightSlope(hn, nx, nz, i) {
  const top = 2 ** GRASS_HEIGHT_BITS - 1;
  const h = Math.max(0, Math.min(top, Math.round(hn * top)));
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) nx = nz = 0;   // AUDIT GRASS-LIT2 A4: a normal that is not one is level - NaN shifted to code 0, the steepest lean
  const l = Math.hypot(nx, nz), k = l > GRASS_SLOPE_SPAN ? GRASS_SLOPE_SPAN / l : 1;   // a normal past the span is held to it, its heading kept
  const q = (v, r) => Math.max(0, Math.min(2 * GRASS_SLOPE_STEPS, Math.round(GRASS_SLOPE_STEPS + v * k * GRASS_SLOPE_STEPS / GRASS_SLOPE_SPAN + r)));
  const dx = ((0.5 + i * 0.7548776662466927) % 1) - 0.5, dz = ((0.5 + i * 0.5698402909980532) % 1) - 0.5;   // R2, centred: -0.5..0.5
  return (h << 10) | ((q(nx, dx) ^ GRASS_SLOPE_STEPS) << 5) | (q(nz, dz) ^ GRASS_SLOPE_STEPS);   // AUDIT A3: stored XOR 15 - a zero word is level
}
/** GRASS-LIT2: the lane back - the vertex stage's arithmetic, for the pins and the probe: { hn, nx, nz } */
export function unpackHeightSlope(w) {
  const top = 2 ** GRASS_HEIGHT_BITS - 1, step = GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS;
  return { hn: (w >> 10) / top, nx: ((((w >> 5) & 31) ^ GRASS_SLOPE_STEPS) - GRASS_SLOPE_STEPS) * step, nz: (((w & 31) ^ GRASS_SLOPE_STEPS) - GRASS_SLOPE_STEPS) * step };
}

/** The lean's half-range: the placer draws (rnd - 0.5) * 0.5. */
export const LEAN_SPAN = 0.5;
/** The width's floor and span: the placer draws 0.052 + rnd * 0.055. */
export const WIDTH_MIN = 0.052;
export const WIDTH_SPAN = 0.055;
/** A blade's height floor and span for a given `height` setting - the
 *  placer's own (0.22 + rnd * 0.42) * (height / 34). */
export const heightFloor = (height = LAB_GRASS.height) => 0.22 * (height / 34);
export const heightSpan = (height = LAB_GRASS.height) => 0.42 * (height / 34);

/** GRASS4: the map pixel's key as a NUMBER, not a string.
 *
 *  `pieceIndex` is asked once per blade candidate - six thousand a cell,
 *  two cells a frame while the eye walks - and it was building a fresh
 *  template string for every one of them. Twelve thousand strings a
 *  frame, each one hashed, looked up and thrown away: the allocation is
 *  the work, and the answer never needed it. Measured on the placer,
 *  the key alone was 0.42 ms of its 1.83 ms a cell.
 *
 *  px * 65536 + py is injective for any integer px and |py| < 32768,
 *  which the Daggerfall map (1000 x 500 pixels) is nowhere near, and it
 *  is one multiply and one add with nothing left behind. */
export const pieceKey = (px, py) => px * 65536 + py;

/** PERF8: THE PIECE UNDER A POINT, BY ARITHMETIC. The placer asks
 *  `keep(x, z)` and `ground(x, z)` once per blade - six thousand a
 *  cell, two cells a frame while the eye walks - and each answered by
 *  scanning every streamed pixel for the one whose square holds the
 *  point: fifty pixels, three hundred thousand bounds tests a cell. The
 *  pixels are a grid: every translation is a whole number of
 *  TERRAIN_SIZE from every other (streamingWorld.pixelTranslation adds
 *  one shared compensation to `(px - origin) * TERRAIN_SIZE`), so the
 *  pixel under a point is one floor away from any reference piece.
 *  Same answer as the scan - the squares do not overlap and a point
 *  outside every piece is null either way - at one Map read.
 *  @param {Array<{p:{px:number,py:number}, t:number[]}>} pieces the near pixels with their translations
 *  @param {number} size TERRAIN_SIZE
 *  @returns {(x:number, z:number) => object|null} the piece holding (x, z), or null */
export function pieceIndex(pieces, size) {
  if (!pieces.length) return () => null;
  const ref = pieces[0];
  const byKey = new Map();
  for (const piece of pieces) byKey.set(pieceKey(piece.p.px, piece.p.py), piece);
  return (x, z) => {
    const px = ref.p.px + Math.floor((x - ref.t[0]) / size);
    const py = ref.p.py - Math.floor((z - ref.t[2]) / size);   // z runs the other way: t[2] = -(py - origin) * size + c
    return byKey.get(pieceKey(px, py)) ?? null;
  };
}

/** How many blades a cell holds, from the lab's density over the span
 *  that density was MEASURED over - never over the window in force. The
 *  two were one number until GRASS2 pushed the range out, and using the
 *  live span here would have quietly thinned the field by the square of
 *  the range increase: 6.80 blades a square metre became 2.75 and the
 *  grass looked worse at every distance, including under the player's
 *  feet, which is not what "seen at long ranges" asks for. */
export const grassPerCell = (density = LAB_GRASS.density, span = LAB_GRASS.densitySpan, cell = GRASS_CELL) =>
  Math.max(1, Math.round(density * (cell * cell) / ((span * 2) * (span * 2))));

/**
 * GRASS6: THE FIELD HAS PATCHES, AND THE PATCH IS BAKED. The lab's tint
 * (aInst2.z) is one uniform random per blade and nothing more, so
 * neighbouring blades were as different as distant ones and the sward
 * read as a flat carpet of noise past a few metres - the eye needs
 * correlation to see a field rather than a texture. GRASS2 pulled the
 * tint toward a low-frequency value noise in the FIELD's frame (GRASS
 * AUDIT 1 corrected the word "world" here, and PERF-EXT21 the word
 * "scene": the field's frame is the scene's as it stood when the field
 * was made, and the field keeps it across every floating-origin shift
 * since, so a patch belongs to the ground for the field's whole life -
 * it re-anchored at every pixel crossing while the crossing rebuilt the
 * field), two octaves, tens of metres across: the mean unchanged, the
 * variance moved from blade-to-blade to patch-to-patch.
 *
 * GRASS2 did it in the vertex stage, and that was the wrong stage. The
 * clump is a function of the root's world position and nothing else; a
 * blade's root never moves; so the shader was evaluating two value
 * noises - eight hashes and their blends - on every one of a blade's
 * thirty vertices, every frame, for a number that was the same number
 * every time. It is evaluated ONCE here, when the blade is placed, and
 * rides the tint lane the pack already has (8 bits, which is more than
 * the shade the tint buys).
 *
 * The noise is the prelude's own (GAME_GRASS_FIELD's hash/vnoise), term
 * for term, in doubles rather than the GPU's floats - so the patches are
 * the same SHAPE at the same scales, and not the same bits. Nothing
 * depended on the bits: no pin held the noise's value, only that a
 * patch exists.
 */
/** GLSL's fract: x - floor(x), so a negative input folds UP into [0,1) - `%` would not */
const fract = (v) => v - Math.floor(v);
export function grassHash(x, z) {
  let px = fract(x * 123.34), pz = fract(z * 456.21);
  const d = px * (px + 45.32) + pz * (pz + 45.32);
  px += d; pz += d;
  return fract(px * pz);
}
export function grassVnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = grassHash(ix, iz), b = grassHash(ix + 1, iz), c = grassHash(ix, iz + 1), d = grassHash(ix + 1, iz + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}
/** the patch at a position: two octaves, ~18 m and ~59 m across.
 *  GRASS AUDIT 1: sampled OFF the lattice corner - hash(0,0) is exactly
 *  0 in the prelude and here alike, so both octaves bottomed out at the
 *  scene origin and a patch 25 m across sat 11% darker at a corner of
 *  whatever map pixel the player was in (GRASS2 had it too; the GPU
 *  hash is 0 there as well). The offsets are arbitrary fractions of a
 *  lattice cell, so no lattice corner of either octave lands on 0. */
export const grassClump = (x, z) => grassVnoise(x * 0.055 + 0.317, z * 0.055 + 0.713) * 0.66 + grassVnoise(x * 0.017 + 0.531, z * 0.017 + 0.279) * 0.34;
/** the lane's tint: the lab's per-blade random, pulled 0.55 of the way to its patch */
export const bakedTint = (rnd, x, z) => Math.max(0, Math.min(1, rnd + (grassClump(x, z) - rnd) * 0.55));

/**
 * One cell's blades, padded to `perCell` with zero-height blades so the
 * slot is always full. The laws are placeLabGrassSteps' own, per blade.
 *
 * PERF-EXT21: `originX`/`originZ` are where the field's cell (0, 0)
 * stands in the scene - 0 until the floating origin first moves under a
 * field, and at 0 every lane is byte for byte what it was. A blade is
 * placed in the FIELD's frame exactly as before (the same doubles, so
 * the same GRASS6 tint), and only its scene position - what keep() and
 * ground() are asked about, and what the slot stores - adds the origin.
 *
 * PERF-EXT22: it is beginGrassCell and stepGrassCell below, run end to
 * end - the one loop, which a field on the move runs a slice at a time.
 */
export function placeLabGrassCell(cx, cz, opts) {
  const st = beginGrassCell(cx, cz, opts);
  stepGrassCell(st, st.perCell, opts);
  return { inst: st.inst, inst2: st.inst2, rootY: st.rootY, ground: st.ground, slope: st.slope, count: st.count, perCell: st.perCell };
}

/**
 * PERF-EXT22 (2026-09-25, the players: "fps issues in the exterior but
 * fine in the interior", "me too my friend.. don't know why. I got a
 * RX6600"): A CELL CAN BE PLACED IN SLICES. A cell is 6,122 candidate
 * blades - ~1.6-2 ms of keep() and ground() and noise - and a walking
 * eye brings one in on 5-9% of frames (17% at 15 m/s), each a spike of
 * 4-8 ms on the frame that pays it. The placer's whole state between two
 * candidates is the xorshift word, the candidate index and the count of
 * blades kept, so the loop can stop after any candidate and go on later
 * with nothing lost: `beginGrassCell` is everything before the loop,
 * `stepGrassCell` runs `budget` more candidates of it - the body word
 * for word - and says when the cell is done. However the loop is cut,
 * the lanes are the same bytes (pinned at 1, 1,500 and the whole cell).
 * The arrays are the cell's own, handed to writeSlot when it is done,
 * exactly as placeLabGrassCell's were.
 */
export function beginGrassCell(cx, cz, { perCell, seed = LAB_GRASS.seed, cell = GRASS_CELL, originX = 0, originZ = 0 }) {
  return {
    cx, cz, cell, originX, originZ, perCell,
    s: grassCellSeed(cx, cz, seed),   // the xorshift word
    i: 0,                             // the next candidate
    n: 0,                             // the blades that stood so far
    count: 0,                         // writeSlot's name for n
    inst: new Float32Array(perCell * 4), inst2: new Float32Array(perCell * 4),
    rootY: new Float32Array(perCell), ground: new Float32Array(perCell * 3),
    slope: new Float32Array(perCell * 2),   // GRASS-LIT2: the ground normal's x and z under each root (0, 0: level)
  };
}

/** PERF-EXT22: `budget` more candidates of a begun cell; true once the
 *  last one is placed. `keep`/`ground` are this frame's - a slice asks
 *  the world as it stands when the slice runs. */
export function stepGrassCell(st, budget, { keep, ground = null, slope = null, height = LAB_GRASS.height }) {
  const { inst, inst2, rootY, cell, originX, originZ } = st;
  const groundCol = st.ground;
  let s = st.s;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const ox = st.cx * cell, oz = st.cz * cell;
  let n = st.n;
  const end = Math.min(st.perCell, st.i + budget);
  for (let i = st.i; i < end; i++) {
    const px = rnd() * cell, pz = rnd() * cell;
    const a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
    const fx = ox + px + Math.cos(a) * rr, fz = oz + pz + Math.sin(a) * rr;   // PERF-EXT21: in the field's frame
    const x = fx + originX, z = fz + originZ;   // PERF-EXT21: in the scene's
    const h = (0.22 + rnd() * 0.42) * (height / 34);
    const phase = rnd() * 6.283;
    const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5;
    const tRnd = rnd();   // GRASS6: the lab's tint random, drawn HERE so the stream is the lab's
    const w = 0.052 + rnd() * 0.055;
    const y = keep(x, z);
    if (y === null || y === undefined) continue;
    const tint = bakedTint(tRnd, fx, fz);   // GRASS6: pulled toward the patch it stands in; GRASS AUDIT 1: only for a blade that STANDS - the noise is 0.43 ms a cell and a road cell refuses most of its candidates; PERF-EXT21: the FIELD's patch, which no shift moves
    inst[n * 4] = x; inst[n * 4 + 1] = z; inst[n * 4 + 2] = h; inst[n * 4 + 3] = phase;
    inst2[n * 4] = lx; inst2[n * 4 + 1] = lz; inst2[n * 4 + 2] = tint; inst2[n * 4 + 3] = w;
    rootY[n] = y;
    const gc = ground ? ground(x, z) : null;
    groundCol[n * 3] = gc ? gc[0] : 0.10; groundCol[n * 3 + 1] = gc ? gc[1] : 0.145; groundCol[n * 3 + 2] = gc ? gc[2] : 0.065;
    const gn = slope ? slope(x, z) : null;   // GRASS-LIT2: the ground's normal under the root, from the host that knows the surface
    st.slope[n * 2] = gn ? gn[0] : 0; st.slope[n * 2 + 1] = gn ? gn[2] : 0;
    n++;
  }
  st.s = s; st.i = end; st.n = n; st.count = n;
  // the pad: height 0 draws nothing (the vertex stage collapses h=0)
  return end >= st.perCell;
}

/** PERF-EXT22: how many candidate blades a rim cell places a frame -
 *  ~0.3-0.5 ms, a quarter of a cell. */
export const GRASS_SLICE = 1500;
/** PERF-EXT22: the fraction of the range inside which a cell is always
 *  placed WHOLE - the shader's own fade start (`smoothstep(uRange*0.55,
 *  uRange, d)`, the lab's), inside which every blade of a cell draws. */
export const GRASS_WHOLE_AT = 0.55;
/** PERF-EXT22: more cells than this waiting and the field is catching up
 *  (a boot, a teleport, a pixel re-read under the eye), and fills whole
 *  cells at the pace it always did; this many or fewer, and it is a walk.
 *  Eight holds a 15 m/s ride to slices (four did not - `grassWalkKeep.mjs`),
 *  and costs a boot the last eight rim cells a slice at a time, at 300 m. */
export const GRASS_CATCH_UP = 8;

/**
 * The field: which cells stand around the eye, each in its own slot.
 * `update(ex, ez)` a frame: it frees cells out of range, and fills at
 * most `perFrame` new ones - a cell is a few thousand blades and a
 * few thousand keep() lookups, milliseconds. PERF-EXT22: and on a walk
 * that is the spike - a rim cell is placed a slice a frame (see update).
 */
export function createGrassField(renderer, { keep, ground = null, slope = null, span = LAB_GRASS.span, density = LAB_GRASS.density, height = LAB_GRASS.height, seed = LAB_GRASS.seed, cell = GRASS_CELL, range = LAB_GRASS.range, perFrame = 2, slots: slotsOverride = 0 }) {
  const perCell = grassPerCell(density);   // GRASS2: the RATE, off the lab's own span - `span` below is the window, and the two are not the same question
  // PERF10 (2026-09-19, Mac: "when youre further out in the wilderniss
  // it loaded many chunks and grass the performance still degrades"):
  // THE WINDOW IS A DISC, and its two radii are the ones the field
  // already had a name for. `span` was the half-side of a SQUARE, so the
  // field held 484 cells of which the corners - out at 445m, half again
  // the 300m _drawVisibleSlots fades to - were placed (6,122 keep()
  // lookups apiece), packed, uploaded and then skipped every frame of
  // their life.
  //
  // A cell is FILLED when its nearest point is inside `range` - the
  // draw's own cull, so nothing is placed that cannot be drawn - and
  // FREED only when its nearest point passes `span`. The gap between
  // the two is the hysteresis the square had along its axes (its
  // farthest axis cell had its near edge at 300 and its far edge at
  // 315), so a cell at the rim does not churn while the eye stands
  // still, and it is what bounds the slots: 392 rather than 484, 19%
  // fewer, 8.6 MB less held on the GPU, and the world's first fill is
  // 360 cells rather than 484. Not one blade changes where it stands.
  // AUDIT PERF10 F1: `slots` is a TEST SEAM and nothing else - the game
  // never passes it. The eviction path below cannot be reached through
  // the public API once the bound is right, and a guarantee no pin can
  // starve is a sentence rather than a law, so the pin starves it here.
  const slots = slotsOverride > 0 ? slotsOverride : discSlotCount(span, cell);
  renderer.allocSlots(perCell, slots, cell, height);   // GRASS5: the pack's frame
  const live = new Map();     // cellKey -> { slot, cx, cz }
  const free = [];
  for (let i = 0; i < slots; i++) free.push(i);
  // PERF-EXT21 (2026-09-25, the players: "fps issues in the exterior
  // but fine in the interior", "me too my friend.. don't know why. I got
  // a RX6600"): THE FIELD HAS AN ORIGIN OF ITS OWN. The host threw the
  // field away at every floating-origin shift - every map-pixel crossing
  // - because its cells were keyed on SCENE coordinates, and 819.2 is not
  // a whole number of 30 m cells. So every crossing re-specified the
  // three buffers (38.6 MB), drew 2 slots of 357 on the crossing frame,
  // and re-placed, re-packed and re-uploaded ~355 cells over the next
  // ~176 frames: 0.9-1.35 s of main thread on the prover's Xeon, +5-7.5
  // ms a frame for three seconds, the grass visibly vanishing and
  // regrowing nearest-first, every blade reshuffled (0 of 352 slots came
  // back where they were). Once every ~3 minutes on foot and oftener on
  // a horse, outdoors only, which is the report exactly.
  //
  // (gx, gz) is where the field's cell (0, 0) stands in the scene. It
  // starts at the scene's own 0 and moves with the scene at a shift, so
  // a cell's key, its seed and its blades are the field's for as long
  // as the field lives, and the scene is only ever the frame the
  // questions arrive in. Doubles, and only these two grow: the slots
  // store scene positions that stay scene-bounded, shifted in place.
  let gx = 0, gz = 0;
  /** PERF-EXT22: the rim cell being placed a slice a frame - { d, cx,
   *  cz, key, st } - or null. Not live and holding no slot until done. */
  let pending = null;
  /** PERF10: the square distance from the eye to a cell's nearest point -
   *  _drawVisibleSlots' own test, so what is filled is what is drawn.
   *  PERF-EXT21: the cell's edges stood in the field's frame, the eye
   *  in the scene's. */
  const nearSq = (cx, cz, ex, ez) => {
    const dx = Math.max(cx * cell + gx - ex, 0, ex - ((cx + 1) * cell + gx));
    const dz = Math.max(cz * cell + gz - ez, 0, ez - ((cz + 1) * cell + gz));
    return dx * dx + dz * dz;
  };
  return {
    perCell, slots, live,
    /** PERF-EXT21: the floating origin moved by `offset` (streamingWorld's
     *  [dx, dy, dz], the one every other scene position in the host rides).
     *  The field's cell grid moves with it and every standing slot's frame
     *  and box are moved in place - O(slots), no placement, no upload: the
     *  packed lanes are cell-local and never knew where the scene was. */
    shiftOrigin(offset) {
      gx += offset[0]; gz += offset[2];
      renderer.shiftSlots(offset);
      pending = null;   // PERF-EXT22: a half-placed cell holds scene positions of the old frame - it starts again in the new one
    },
    /** PERF-EXT22: the rim cell in progress, for a probe or a pin. */
    get pending() { return pending; },
    // GRASS-STALE1 (2026-09-19, Discord: "grass is flying and not on the
    // ground" around graveyards and other POIs): a cell, once placed, is
    // never rebuilt unless it leaves render range entirely (the loop
    // below only queues a key that is NOT already in `live`) - by
    // design, cheap, and correct AS LONG AS `keep`/`ground`'s answer for
    // a given (x,z) never changes after a cell first reads it.
    //
    // It does change, right where this bug lives: the world streams
    // nearest-first, so a cell can be placed from a location pixel's
    // PRE-blend height (or its not-yet-built neighbour) before
    // blendLocationTerrain (terrainGen.js) has flattened that pixel's
    // samples toward the location's own avgY - the same flat height its
    // buildings sit at. The cell was placed correctly for the data it
    // had; the data changed under it, and nothing told the cell.
    // `invalidate` is that missing telling: drop a cell from `live`
    // without waiting for it to leave range, so the very next update()
    // sees it as unplaced and re-reads `keep`/`ground` fresh. The
    // world.js caller runs it the moment a location pixel finishes
    // building, over that pixel's own bounds.
    //
    // This is NOT GRASS3's question. GRASS3 put a blade on the surface
    // that is DRAWN rather than on a bilinear guess, which is about
    // WHICH height a cell reads; this is about WHEN, and a cell that
    // read the right surface at the wrong moment is wrong either way.
    invalidate(x0, z0, x1, z1) {   // PERF-EXT21: a SCENE rect, asked of the field's grid
      const cx0 = Math.floor((x0 - gx) / cell), cx1 = Math.floor((x1 - gx) / cell);
      const cz0 = Math.floor((z0 - gz) / cell), cz1 = Math.floor((z1 - gz) / cell);
      // PERF-EXT22: a cell half placed from the data this rect replaces starts again
      if (pending && pending.cx >= cx0 && pending.cx <= cx1 && pending.cz >= cz0 && pending.cz <= cz1) pending = null;
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const key = cellKey(cx, cz);
        const held = live.get(key);
        if (!held) continue;
        renderer.clearSlot(held.slot);
        live.delete(key);
        free.push(held.slot);
      }
    },
    update(ex, ez, keepNow = keep, groundNow = ground, slopeNow = slope) {
      const keepR2 = span * span;      // PERF10: held out to here
      const fillR2 = range * range;    // PERF10: placed only inside here
      const k = Math.ceil(range / cell) + 1;
      const ecx = Math.floor((ex - gx) / cell), ecz = Math.floor((ez - gz) / cell);   // PERF-EXT21: the eye's cell on the field's grid
      // free what fell out of range. PERF10: cx/cz ride the entry, so
      // this sweep - which runs over every live cell every frame and
      // usually frees nothing - allocates nothing at all.
      for (const [key, held] of live) {
        if (nearSq(held.cx, held.cz, ex, ez) > keepR2) { renderer.clearSlot(held.slot); live.delete(key); free.push(held.slot); }
      }
      if (pending && nearSq(pending.cx, pending.cz, ex, ez) > fillR2) pending = null;   // PERF-EXT22: walked out of reach before it was done - it would not be begun now either
      // fill what came into range, nearest first, a few a frame
      let budget = perFrame;
      /** @type {{ d:number, cx:number, cz:number, key:number, st?:object }[]} */
      const want = [];   // HARD3: a NAMED shape, because a mixed [number, number, number, string] literal widens to (number|string)[] and `a[0] - b[0]` stops type-checking
      for (let cz = ecz - k; cz <= ecz + k; cz++) for (let cx = ecx - k; cx <= ecx + k; cx++) {
        const d = nearSq(cx, cz, ex, ez);
        if (d > fillR2) continue;
        const key = cellKey(cx, cz);
        if (!live.has(key) && key !== pending?.key) want.push({ d, cx, cz, key });
      }
      want.sort((a, b) => a.d - b.d);
      const missing = want.length + (pending ? 1 : 0);
      // PERF-EXT22: A WALK PLACES ITS RIM A SLICE A FRAME. A walking eye
      // brings cells in at the rim - their nearest point just inside the
      // 300 m range, where the draw keeps 0-2% of a cell's blades - one
      // every ~11 frames at a run, and each was a whole cell on the frame
      // it arrived: a 4-8 ms spike on 5-17% of frames. With a few cells
      // waiting, a rim cell (past GRASS_WHOLE_AT of the range, where the
      // fade begins) is begun and placed GRASS_SLICE candidates a frame,
      // written the frame it is done; it lands ~4 frames later, a metre
      // at a gallop, 300 m out. A cell inside the fade's start still
      // comes whole, and with more than GRASS_CATCH_UP waiting - a boot,
      // a teleport, a near pixel re-read - every cell does, two a frame,
      // at the pace the field always filled at.
      const catchUp = missing > GRASS_CATCH_UP;
      const wholeR2 = (range * GRASS_WHOLE_AT) * (range * GRASS_WHOLE_AT);
      const ask = { keep: keepNow, ground: groundNow, slope: slopeNow, height };
      let sliced = false;
      if (pending) {
        sliced = !catchUp;
        if (stepGrassCell(pending.st, catchUp ? perCell : GRASS_SLICE, ask)) {
          want.unshift({ ...pending, d: nearSq(pending.cx, pending.cz, ex, ez) });   // done: it takes its slot below, first
          pending = null;
        }
      }
      for (const item of want) {
        const { d, cx, cz, key } = item;
        if (budget <= 0) break;
        if (!item.st && !catchUp && d > wholeR2) {   // PERF-EXT22: a rim cell on a walk
          if (pending || sliced) continue;           // one slice a frame
          const st = beginGrassCell(cx, cz, { perCell, seed, cell, originX: gx, originZ: gz });
          sliced = true;
          if (!stepGrassCell(st, GRASS_SLICE, ask)) { pending = { d, cx, cz, key, st }; continue; }
          item.st = st;   // a cell no bigger than a slice is done in one
        }
        let slot = free.pop();
        if (slot === undefined) {
          // AUDIT PERF10 F1: A BOUND CAN BE WRONG; A HOLE MUST NOT BE
          // ABLE TO SURVIVE IT. `slots` is discSlotCount's swept answer,
          // and the first draft of that sweep was two cells short - at
          // which point this loop simply broke and the cell stayed
          // unplaced for as long as the eye stood there. `want` is
          // sorted nearest-first, so the nearest waiting cell takes the
          // farthest standing one's slot; when every slot already holds
          // something nearer there is nothing to gain and the walk
          // stops. The invariant is not "the bound is right" but THE
          // FIELD HOLDS THE NEAREST `slots` CELLS, which no bound can
          // break.
          let far = null, farKey = 0, farD = d;
          for (const [k, held] of live) {
            const hd = nearSq(held.cx, held.cz, ex, ez);
            if (hd > farD) { farD = hd; far = held; farKey = k; }
          }
          if (!far) break;
          renderer.clearSlot(far.slot); live.delete(farKey); slot = far.slot;
        }
        budget--;
        renderer.writeSlot(slot, item.st ?? placeLabGrassCell(cx, cz, { keep: keepNow, ground: groundNow, slope: slopeNow, perCell, height, seed, cell, originX: gx, originZ: gz }));   // PERF-EXT21; PERF-EXT22: or the rim cell its slices finished
        live.set(key, { slot, cx, cz });
      }
      // AUDIT PERF10 F5: what was MISSING when this update began - not
      // what is still missing now. GR5's comment said "pending" and the
      // number never meant that; the one caller ignores it and the pin
      // reads it as "the rest wait their turn", both of which hold.
      // PERF-EXT22: a cell half placed is missing too.
      return missing;
    },
  };
}

export function* placeLabGrassSteps({ centre, keep, ground = null, density = LAB_GRASS.density, height = LAB_GRASS.height, span = LAB_GRASS.span, seed = LAB_GRASS.seed, step = 60000 }) {
  const N = density | 0;
  const inst = new Float32Array(N * 4); const inst2 = new Float32Array(N * 4); const rootY = new Float32Array(N);
  const groundCol = new Float32Array(N * 3);   // GR4: the ground's colour under each blade
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  let n = 0;
  for (let i = 0; i < N; i++) {
    const cx = (rnd() - 0.5) * span * 2, cz = (rnd() - 0.5) * span * 2;
    const a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
    const x = centre[0] + cx + Math.cos(a) * rr, z = centre[1] + cz + Math.sin(a) * rr;
    const h = (0.22 + rnd() * 0.42) * (height / 34);
    const phase = rnd() * 6.283;
    const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5;
    const tRnd = rnd();   // GRASS6
    const w = 0.052 + rnd() * 0.055;
    const y = keep(x, z);
    if (y !== null && y !== undefined) {
      const tint = bakedTint(tRnd, x, z);   // GRASS6; GRASS AUDIT 1: after keep(), for the blades that stand
      inst[n * 4] = x; inst[n * 4 + 1] = z; inst[n * 4 + 2] = h; inst[n * 4 + 3] = phase;
      inst2[n * 4] = lx; inst2[n * 4 + 1] = lz; inst2[n * 4 + 2] = tint; inst2[n * 4 + 3] = w;
      rootY[n] = y;
      // GR4: the ground's own colour under this root, from the host that
      // knows which tile it stands on. Absent, the olive the lab's root
      // used to be, so a host without one draws GR2's grass unchanged.
      const gc = ground ? ground(x, z) : null;
      groundCol[n * 3] = gc ? gc[0] : 0.10; groundCol[n * 3 + 1] = gc ? gc[1] : 0.145; groundCol[n * 3 + 2] = gc ? gc[2] : 0.065;
      n++;
    }
    if ((i + 1) % step === 0) yield null;
  }
  return { inst: inst.subarray(0, n * 4), inst2: inst2.subarray(0, n * 4), rootY: rootY.subarray(0, n),
    ground: groundCol.subarray(0, n * 3), count: n };
}

/** the lab's blade: five stacked quads */
export function labBladeCorners(segments = 5) {
  const corners = [];
  for (let seg = 0; seg < segments; seg++) {
    const a = seg / segments, b = (seg + 1) / segments;
    corners.push(0, a, 1, a, 1, b, 0, a, 1, b, 0, b);
  }
  return new Float32Array(corners);
}

/** GRASS2: THE FAR BLADE IS ONE QUAD. The lab's blade is five stacked
 *  quads so that it can CURVE - the sway is weighted by height squared
 *  along the stalk, and a straight blade cannot bend. Past a certain
 *  distance a blade is a couple of pixels tall and its curve is not a
 *  thing any eye can resolve, so the four extra segments are four
 *  extra quads' worth of vertex work spent on a shape nobody sees.
 *  One segment is the same silhouette, at a fifth of the vertices.
 *
 *  It is the same shader, the same instance data and the same draw -
 *  only the corner buffer differs, so a cell changes level of detail
 *  by which vertex array is bound and nothing else. */
export const GRASS_FAR_SEGMENTS = 1;
/** Where the far blade takes over, as a fraction of the draw range.
 *
 *  THE REASON IS THE PIXEL, not the fade. At half of a 250 m range a
 *  blade stands 125 m off, which is 2 to 6 pixels tall at 1080p - and
 *  it is 0.66 of a pixel WIDE, so the bend the four extra segments
 *  exist to draw is a fraction of a pixel of sideways travel. There is
 *  nothing there to see, whatever the fade is doing.
 *
 *  (An earlier note here claimed 0.5 sat inside the fade's own start of
 *  0.55 so that a blade was "already thinning by the time its curve
 *  goes". That is backwards - 0.5 is BEFORE 0.55, so the curve goes
 *  first - and it was never the argument anyway.) */
export const GRASS_FAR_AT = 0.5;

/** A color32 tile's (`BaseImageFile.getColor32`'s `{colors, width,
 *  height}`) mean RGB, 0..255 - the one average the grass reads: the
 *  bases grassRecordsOf classifies against, and the root's colour. */
/** GRASS-LIT2: the most texels a mean reads - a texture mod's tile (GROUND1) can be 1024 square, 56 of them an archive;
 *  past this a mean reads every k-th texel, k ODD, so no power-of-two period (a texel grid, an ordered dither, the
 *  row's own width) lines up with the step and is read on one phase only. A classic tile (64 x 64) is read whole. */
export const GRASS_MEAN_SAMPLES = 65536;
/** the step a mean of `n` texels reads at: 1 up to the cap, past it the least ODD step that keeps the reads under it
 *  (AUDIT GRASS-LIT2 A5: ceil - floor read every texel of a tile up to twice the cap) */
export const grassMeanStep = (n) => Math.max(1, Math.ceil(n / GRASS_MEAN_SAMPLES)) | 1;
function meanRgb(l) {
  let r = 0, g = 0, b = 0, m = 0;
  const n = l.width * l.height;
  const step = grassMeanStep(n);
  for (let k = 0; k < n; k += step) { r += l.colors[k * 4]; g += l.colors[k * 4 + 1]; b += l.colors[k * 4 + 2]; m++; }
  return [r / m, g / m, b / m];
}

/** GR4: the colour a blade's root takes off the tile it stands on - the
 *  tile's mean, 0..1. AUDIT 68 S17: the host averaged the color32 as if
 *  it were its byte array (`.length` of an object), so every tile of
 *  every climate answered the olive an EMPTY tile falls back to. */
export function tileMeanColour(l) {
  if (!(l.width * l.height)) return [0.10, 0.145, 0.065];
  const m = meanRgb(l);
  return [m[0] / 255, m[1] / 255, m[2] / 255];
}

/**
 * Which records of a ground archive are GRASS, from the archive's own
 * texels: the four bases are identified by their mean colour (base 0 is
 * water everywhere; a green-dominant base is grass; in winter no base
 * is green, so nothing is grass), and every record's texels are
 * classified to the nearest base. A record is grass when more than half
 * of it is. Roads are excluded by record regardless.
 */
export function grassRecordsOf(layers, { roadRecords = new Set([46, 47, 55]) } = {}) {
  if (!layers || layers.length < 4) return new Set();
  const means = [0, 1, 2, 3].map((i) => meanRgb(layers[i]));
  const isGrass = (m) => m[1] >= m[0] && m[1] > m[2] * 1.1 && !(m[2] > m[0] * 1.25 && m[2] > m[1] * 1.1);
  const grassBase = means.map(isGrass);
  if (!grassBase.some(Boolean)) return new Set();
  const out = new Set();
  for (let rec = 0; rec < layers.length; rec++) {
    if (roadRecords.has(rec)) continue;
    const l = layers[rec]; const n = l.width * l.height; let g = 0;
    for (let k = 0; k < n; k++) {
      const r = l.colors[k * 4], gg = l.colors[k * 4 + 1], b = l.colors[k * 4 + 2];
      let best = 0, bd = Infinity;
      for (let i = 0; i < 4; i++) { const d = (r - means[i][0]) ** 2 + (gg - means[i][1]) ** 2 + (b - means[i][2]) ** 2; if (d < bd) { bd = d; best = i; } }
      if (grassBase[best] && bd < 42 * 42) g++;
    }
    if (g / n > 0.5) out.add(rec);
  }
  return out;
}

/**
 * GR1: the lab's grass pass, as a renderer of its own beside the world
 * renderer - the same shape as PrecipitationRenderer. Owns its program,
 * its blade quad, its instance buffers and a 1x1 zero field texture.
 * `allocSlots` sizes the field's slots and `writeSlot` packs a cell into
 * one (createGrassField drives both); `draw()` is the lab's draw, term
 * for term, with the game's light and wind in the lab's uniforms.
 */
export class LabGrassRenderer {
  /** `stages` (GRASS AUDIT 1): the two stage bodies to compile, the
   *  game's by default. The probe hands the LAB's pair to draw the same
   *  field through the lab's own text and hold the smooth style
   *  byte-identical to it - the executed form of "with the switch at
   *  zero the arithmetic is the lab's". AUDIT GRASS-LIT2 A6: that held
   *  until GRASS-LIT painted the game's field in the ground's colours;
   *  and the lab's text reads the height lane as GRASS5 packed it (a
   *  u16 height), so since GRASS-LIT2 its blades stand up to 7 mm off
   *  the game's - the lab's pair draws the lab's look, not the game's. */
  constructor(gl, { stages = { vs: GAME_GRASS_VS, fs: GAME_GRASS_FS }, tuft = null } = {}) {   // GRASS-PX4: `tuft` ({ w, h }) lays the sheet at another size - the probe photographs the old 16x32 beside the shipped 8x16 through it
    this.gl = gl;
    const prog = buildProgram(gl, LAB_GRASS_HEAD + GAME_GRASS_FIELD + stages.vs, LAB_GRASS_HEAD + stages.fs);   // GRASS-PX: the lab's text under the declared edits
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uTime', 'uWind', 'uRange', 'uEye', 'uSunDir', 'uWindDir', 'uSnowFull', 'uSlotN', 'uCellFrame', 'uBladeScale', 'uCellSize', 'uGField', 'uGFieldOrigin', 'uGFieldM', 'uSnowGlobal', 'uWindV', 'uAmb', 'uSunCol', 'uDim', 'uSunScale', 'uMoonDir', 'uMoonScale', 'uMoonCol',
      'uPixel', 'uPxVariants', 'uPxSteps', 'uPxTintBands', 'uPxSheet',   // GRASS-PX: the pixel style's five (GRASS-PX3 took the sway's two)
      'uArt', 'uArtGround',   // MEADOW1: the meadow's switch and the ground its art was drawn for
      'uFogColor', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uDwFog',   // DISC20-A: the terrain's fog; DW-C: and the sea's
      'uLane', 'uELExposure', 'uAdapt', 'uIndirect', 'uIndirectColor', 'uCloudShadowMap', 'uCloudShadowRect', 'uGrassTone',   // GRASS-LIT: the lane, the eye, the player's light, the deck
      'uPointCount', 'uPointLights', 'uPointColors', 'uPointIdx']) this.u[n] = gl.getUniformLocation(prog, n);   // GRASS-LIT2: the lanterns; AUDIT A1: a cell's
    // GRASS-LIT: the sun map's block, by the names ShadowPass.upload binds (the receiver the terrain takes)
    const ul = (n) => gl.getUniformLocation(prog, n);
    this.shadowLoc = {
      sunShadow: ul('uSunShadow'), sunVP: ul('uSunVP'), sunParams: ul('uSunShadowParams'), sunTexel: ul('uSunTexel'), sunOrigin: ul('uSunOrigin'),
      pointShadow: ul('uPointShadow'), pointParams: ul('uPointShadowParams'), shadowIndex: ul('uShadowIndex'), casterOf: ul('uCasterOf'), pointShadowLo: ul('uPointShadowLo'),
    };
    this._dec = { amb: new Float32Array(3), sun: new Float32Array(3), moon: new Float32Array(3), near: new Float32Array(3), points: new Float32Array(GRASS_MAX_LIGHTS * 3) };   // GRASS-LIT: the lane's linear colours, kept; GRASS-LIT2: the lanterns' too
    /** GRASS-LIT: the four tones the field is painted with (GRASS_TONES, flat) - a probe may hand others */
    this.tones = new Float32Array(GRASS_TONES.flat());
    /** GRASS-LIT2: and on the classic lane (GRASS_TONES_CLASSIC) */
    this.tonesClassic = new Float32Array(GRASS_TONES_CLASSIC.flat());
    /** MEADOW1: the ground the owner's art is drawn for on each lane - his green at the lane's middle tone */
    this.artGround = new Float32Array(meadowArtGround(GRASS_TONES[1]));
    this.artGroundClassic = new Float32Array(meadowArtGround(GRASS_TONES_CLASSIC[1]));
    // AUDIT GRASS-LIT2 A1: a cell's lantern list, its distances, and the list last uploaded
    this._cellIdx = new Int32Array(GRASS_CELL_LIGHTS); this._cellDist = new Float64Array(GRASS_CELL_LIGHTS);
    this._cellLast = new Int32Array(GRASS_CELL_LIGHTS); this._cellN = -1; this._pn = 0; this._pts = null;
    // the blade, and three instance streams the lab's layout plus the game's root height
    // GRASS2: the instance buffers are made ONCE and shared by both
    // levels of detail - only the corner buffer differs between them, so
    // a cell drops to the far blade by binding the other array. Nothing
    // is uploaded twice and nothing is kept in step by hand.
    // GRASS5: THREE buffers, not four - the root height rides in the
    // first one's spare lane now, so there is no attribute of its own.
    this.bufs = [1, 2, 4].map(() => gl.createBuffer());
    for (const b of this.bufs) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW); }
    // AUDIT 68 S16-grass-point-alloc: THE LANES, once - buffer k feeds attribute `loc` as `type`, `bytes` a blade. The
    // VAOs, writeSlot and _point read this one table; _point runs per drawn slot per frame and built four arrays a
    // call from a literal of it.
    this._lanes = Object.freeze([
      Object.freeze({ loc: 1, type: gl.UNSIGNED_SHORT, bytes: 8 }),
      Object.freeze({ loc: 2, type: gl.UNSIGNED_BYTE, bytes: 4 }),
      Object.freeze({ loc: 4, type: gl.UNSIGNED_BYTE, bytes: 4 }),
    ]);
    /** one vertex array over a corner buffer - labBladeCorners' quads, two floats a vertex; MEADOW1: or the meadow's
     *  cards, three floats a vertex, the third the card's turn on attribute 3 - AUDIT MEADOW1: drawn through their
     *  `indices` (meadowCardIndices), so `verts` is what a tuft SHADES (each corner once) and `count` what it submits */
    const buildVao = (corners, indices = null) => {
      const cards = !!indices;
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
      gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
      const stride = cards ? 12 : 0;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
      if (cards) { gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 8); }
      const ib = cards ? gl.createBuffer() : null;   // AUDIT MEADOW1: the index buffer is the array's own state
      if (ib) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW); }
      // GRASS5: NORMALIZED integer attributes - the GPU does the unpack,
      // so the shader reads floats in 0..1 and the decode is two
      // multiply-adds rather than a fetch per field.
      for (let k = 0; k < this._lanes.length; k++) {
        const L = this._lanes[k];
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[k]);
        gl.enableVertexAttribArray(L.loc); gl.vertexAttribPointer(L.loc, 4, L.type, true, 0, 0);
        gl.vertexAttribDivisor(L.loc, 1);
      }
      gl.bindVertexArray(null);
      return { vao, verts: cards ? new Set(indices).size : corners.length / 2, count: cards ? indices.length : corners.length / 2, cb, ib };
    };
    const near = buildVao(labBladeCorners(5)), far = buildVao(labBladeCorners(GRASS_FAR_SEGMENTS));
    const cards = buildVao(meadowCardCorners(MEADOW_CARDS), meadowCardIndices(MEADOW_CARDS));   // MEADOW1: the tuft's cards, near and far
    const cardsFar = buildVao(meadowCardCorners(MEADOW_CARDS_FAR, MEADOW_CARDS), meadowCardIndices(MEADOW_CARDS_FAR));   // AUDIT MEADOW1: the near set's first two, so nothing turns at the handover
    this.vao = near.vao; this.verts = near.verts;
    this.vaoFar = far.vao; this.vertsFar = far.verts;
    this.vaoCards = cards.vao; this.vertsCards = cards.verts; this.countCards = cards.count;   // MEADOW1; AUDIT MEADOW1: shaded, and submitted
    this.vaoCardsFar = cardsFar.vao; this.vertsCardsFar = cardsFar.verts; this.countCardsFar = cardsFar.count;
    this._cornerBufs = [near.cb, far.cb, cards.cb, cardsFar.cb, cards.ib, cardsFar.ib];
    gl.bindVertexArray(null);
    // the field the lab's grass reads: nothing, so the snow and wet terms are zero
    this.zeroField = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.zeroField);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    // GRASS-PX: THE TUFT SHEET, with its coverage mip chain, every level
    // uploaded by hand (generateMipmap would AVERAGE, and an averaged
    // sprite fails the alpha test a few cells out). NEAREST both ways -
    // a pixel sprite is never filtered - and the level is the GPU's
    // pick among the ones built here. Unit 4: the renderer's own passes
    // stop at 3 and its reserved units start at 11, and the host marks
    // the grass a foreign pass after every draw, so nothing counts on 4
    // holding across it.
    const mips = buildTuftMips(tuft ? buildTuftSheet({ w: tuft.w, h: tuft.h }) : undefined);   // GRASS-PX4
    this.pxVariants = mips[0].variants;
    this.pxSheet = this._sheet(mips);
    // MEADOW1: THE OWNER'S ATLAS, up the same way - its own coverage chain (render/grassMeadow.js buildMeadowMips),
    // bound on the sheet's unit when the meadow draws
    this.meadowSheet = this._sheet(buildMeadowMips());
    this.count = 0;
    this._vp = new Float32Array(16);
    this._planes = new Float32Array(24);   // PERF2
    this._cardBox = new Float64Array(6);   // AUDIT MEADOW1: the meadow's widened box, asked of the frustum - one, reused every slot
    this._cardReach = MEADOW_REACH;        // AUDIT MEADOW1: the cards' reach over a blade's height, this frame's (draw)
    this.slotBox = null;                    // PERF2: per slot, the cell's world box, or null while empty
    this.slotCount = null;                  // GRASS2: per slot, the blades that actually STOOD - the rest of the slot is pad
    this.drawn = { slots: 0, blades: 0, kept: 0 };   // PERF2: what the last draw actually submitted; GRASS2: and how much of it was not pad
  }

  /** AUDIT MEADOW1: a palette for the field (tools/grassLookProbe.mjs, through world.js __grassTones) - the four tones of
   *  a lane, and the ground the meadow's art is drawn for, which is anchored to the middle one (meadowArtGround): a
   *  palette study that moved the tones alone left the meadow on the shipped middle tone */
  setTones(tones, classic = false) {
    this[classic ? 'tonesClassic' : 'tones'] = new Float32Array(tones.flat());
    this[classic ? 'artGroundClassic' : 'artGround'] = new Float32Array(meadowArtGround(tones[1]));
  }

  /** GRASS-PX: a sheet and its hand-built chain on a texture of its own - every level uploaded, NEAREST both ways,
   *  clamped (the constructor says why). MEADOW1: the meadow's atlas goes up through the same door. */
  _sheet(mips) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    for (let i = 0; i < mips.length; i++) gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, mips[i].width, mips[i].height, 0, gl.RGBA, gl.UNSIGNED_BYTE, mips[i].data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /** GR5: size the buffers for `slots` cells of `perCell` blades each,
   *  all zero - a slot draws nothing until a cell is written into it. */
  allocSlots(perCell, slots, cell = GRASS_CELL, height = LAB_GRASS.height) {
    const gl = this.gl;
    this.perCell = perCell; this.slots = slots;
    // GRASS5: the two the pack is measured against - a cell's width and
    // the height law's own scale. The field knows both; the renderer did
    // not have to until a blade became sixteen bytes.
    this.cellSize = cell; this.height = height;
    // GRASS5: 8 bytes of u16 and two lots of 4 bytes of u8 - sixteen a
    // blade, where twelve floats were forty-eight.
    const sizes = [slots * perCell * 8, slots * perCell * 4, slots * perCell * 4];
    for (let i = 0; i < 3; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]);
      gl.bufferData(gl.ARRAY_BUFFER, sizes[i], gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.count = slots * perCell;
    this.slotBox = new Array(slots).fill(null);   // PERF2
    this.slotCount = new Int32Array(slots);       // GRASS2: every slot starts empty, so every slot starts at zero blades
    // GRASS5: the per-slot frame a packed blade is decoded against -
    // origin x, origin z, the cell's height floor and its height span.
    // PERF-EXT21: doubles, so a frame moved by shiftSlots is moved
    // exactly and rounds to float32 once, at the upload - where every
    // frame rounded before. Written unshifted, it uploads the same bits.
    this.slotFrame = new Float64Array(slots * 4);
    this.slotSpan = new Float32Array(slots);   // GRASS5: the cell's own xz extent, which is NOT the cell size
    this.slotCardH = new Float64Array(slots);      // AUDIT MEADOW1: the tallest blade the meadow stands a card on (writeSlot)
    this.slotCardRise = new Float64Array(slots);   // AUDIT MEADOW1: how far its tallest card's top stands over the box's
    this.slotCardTilt = new Float64Array(slots);   // AUDIT MEADOW1: the steepest slope (rise over run) a card of it is sheared to
    this._packA = new Uint16Array(perCell * 4);   // the scratch a cell is packed through, reused
    this._packB = new Uint8Array(perCell * 4);
    this._packC = new Uint8Array(perCell * 4);
    this._packs = [this._packA, this._packB, this._packC];   // AUDIT 68 S16-grass-point-alloc: lane k's scratch
  }

  /** GR5: one cell into its slot - one bufferSubData per buffer, no repack. */
  writeSlot(slot, placed) {
    const gl = this.gl; const p = this.perCell;
    // PERF2: the cell's box, from the blades themselves - x/z off the
    // roots, y from the lowest root to the tallest tip (a leaning blade
    // reaches no higher than its height, so height is the bound).
    let x0 = Infinity, z0 = Infinity, y0 = Infinity, x1 = -Infinity, z1 = -Infinity, y1 = -Infinity;
    const n = Math.min(placed.count ?? p, p);
    for (let i = 0; i < n; i++) {
      const x = placed.inst[i * 4], z = placed.inst[i * 4 + 1], h = placed.inst[i * 4 + 2], y = placed.rootY[i];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (y < y0) y0 = y; if (y + h > y1) y1 = y + h;
    }
    if (this.slotBox) this.slotBox[slot] = n > 0 ? [x0, y0, z0, x1, y1, z1] : null;
    if (this.slotCount) this.slotCount[slot] = n;   // GRASS2: what this cell actually grew

    // GRASS5: THE PACK, and the only place a blade crosses to the GPU.
    // The cell's own frame - where it starts and how tall its ground
    // runs - is what makes sixteen bits enough for a position, so it is
    // measured from the blades themselves and uploaded once per slot.
    // THE FRAME IS THE DATA'S OWN BOUNDS, not the cell's coordinates.
    // A blade does not stay inside its cell: the placer clusters each
    // one about a centre with a radius of up to 0.55, so the lowest
    // blade can sit just past the boundary - and deriving the origin
    // with floor(minX / cell) then names the cell NEXT DOOR and puts
    // every blade in the slot 30 m out. (It did, and the probe found
    // it: the field drew 79 lit pixels instead of 56,000.) The bounds
    // are already measured above for the culling box; a square frame
    // over the wider of the two axes keeps the decode to one span.
    const xSpan = n > 0 ? Math.max(1e-3, Math.max(x1 - x0, z1 - z0)) : 1;
    const ox = n > 0 ? x0 : 0;
    const oz = n > 0 ? z0 : 0;
    const yBase = n > 0 ? y0 : 0;
    const ySpan = n > 0 ? Math.max(1e-3, y1 - y0) : 1;
    if (this.slotFrame) this.slotFrame.set([ox, oz, yBase, ySpan], slot * 4);
    if (this.slotSpan) this.slotSpan[slot] = xSpan;
    const hFloor = heightFloor(this.height), hSpan = Math.max(1e-6, heightSpan(this.height));
    const A = this._packA, B = this._packB, C = this._packC;
    A.fill(0); B.fill(0); C.fill(0);
    const u16 = (v) => Math.max(0, Math.min(65535, Math.round(v * 65535)));
    const u8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    // AUDIT MEADOW1: THE MEADOW'S CARDS, which stand taller and reach wider than any blade: the tallest blade of the run
    // the meadow draws (its first MEADOW_BLADES_PER_TUFT-th) and the top of its tallest card, on the height the vertex
    // stage DECODES off the word below - not on the placer's, which the lane holds to the law's own span. The culling
    // box above is the blades' own again, so the pixel and smooth styles cull as they did; _drawVisibleSlots widens it
    // for the meadow alone, by these and by the frame's wind.
    const tufts = Math.ceil(n / MEADOW_BLADES_PER_TUFT), hTop = 2 ** GRASS_HEIGHT_BITS - 1, slopeStep = GRASS_SLOPE_SPAN / GRASS_SLOPE_STEPS;
    let cardH = 0, cardTop = -Infinity, cardTilt = 0;
    for (let i = 0; i < n; i++) {
      const x = placed.inst[i * 4], z = placed.inst[i * 4 + 1], h = placed.inst[i * 4 + 2], ph = placed.inst[i * 4 + 3];
      A[i * 4] = u16((x - ox) / xSpan);
      A[i * 4 + 1] = u16((z - oz) / xSpan);
      A[i * 4 + 2] = u16((placed.rootY[i] - yBase) / ySpan);
      A[i * 4 + 3] = packHeightSlope((h - hFloor) / hSpan, placed.slope ? placed.slope[i * 2] : 0, placed.slope ? placed.slope[i * 2 + 1] : 0, i);   // GRASS-LIT2
      if (i < tufts) {
        const hd = hFloor + (A[i * 4 + 3] >> 10) / hTop * hSpan;
        if (hd > cardH) cardH = hd;
        if (placed.rootY[i] + hd * MEADOW_TOP > cardTop) cardTop = placed.rootY[i] + hd * MEADOW_TOP;
        const w = A[i * 4 + 3];   // the normal the stage decodes off this word (unpackHeightSlope's law, unrolled: no object a blade)
        const gx = ((((w >> 5) & 31) ^ GRASS_SLOPE_STEPS) - GRASS_SLOPE_STEPS) * slopeStep, gz = (((w & 31) ^ GRASS_SLOPE_STEPS) - GRASS_SLOPE_STEPS) * slopeStep;
        const tilt = Math.hypot(gx, gz) / Math.max(Math.sqrt(Math.max(1 - gx * gx - gz * gz, 0)), MEADOW_SLOPE_FLOOR);
        if (tilt > cardTilt) cardTilt = tilt;
      }
      B[i * 4] = u8((placed.inst2[i * 4] + LEAN_SPAN / 2) / LEAN_SPAN);
      B[i * 4 + 1] = u8((placed.inst2[i * 4 + 1] + LEAN_SPAN / 2) / LEAN_SPAN);
      B[i * 4 + 2] = u8(placed.inst2[i * 4 + 2]);
      B[i * 4 + 3] = u8((placed.inst2[i * 4 + 3] - WIDTH_MIN) / WIDTH_SPAN);
      C[i * 4] = u8(placed.ground[i * 3]);
      C[i * 4 + 1] = u8(placed.ground[i * 3 + 1]);
      C[i * 4 + 2] = u8(placed.ground[i * 3 + 2]);
      C[i * 4 + 3] = u8(ph / 6.283185307179586);
    }
    if (this.slotCardH) { this.slotCardH[slot] = cardH; this.slotCardRise[slot] = n > 0 ? Math.max(0, cardTop - y1) : 0; this.slotCardTilt[slot] = cardTilt; }   // AUDIT MEADOW1: over the box's own top, so a shift moves nothing here; and the steepest ground a card of it is sheared to
    for (let k = 0; k < this._lanes.length; k++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[k]);
      gl.bufferSubData(gl.ARRAY_BUFFER, slot * p * this._lanes[k].bytes, this._packs[k]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** PERF-EXT21: the floating origin moved by `offset` - every standing
   *  slot's decode frame and culling box move with it, in place. The
   *  packed lanes are cell-local and are not touched, so nothing is
   *  uploaded; a cleared slot's frame moves too and is never read. */
  shiftSlots(offset) {
    if (!this.slotFrame) return;
    const dx = offset[0], dy = offset[1], dz = offset[2];
    const F = this.slotFrame;
    for (let s = 0; s < this.slots; s++) {
      F[s * 4] += dx; F[s * 4 + 1] += dz; F[s * 4 + 2] += dy;
      const b = this.slotBox[s];
      if (b) { b[0] += dx; b[1] += dy; b[2] += dz; b[3] += dx; b[4] += dy; b[5] += dz; }
    }
  }

  /** GR5: a cell leaves - its heights go to zero, and h=0 draws nothing. */
  clearSlot(slot) {
    const gl = this.gl; const p = this.perCell;
    if (this.slotBox) this.slotBox[slot] = null;   // PERF2
    if (this.slotCount) this.slotCount[slot] = 0;   // GRASS2
    // GRASS5: zeroing A zeroes the packed HEIGHT, and a blade of the
    // cell's height FLOOR still draws - so a cleared slot is also
    // dropped by slotCount, which is what really keeps it off the GPU.
    // AUDIT GRASS-LIT2 A3: and the zero word's slope is level (stored XOR 15).
    if (!this._zeros || this._zeros.length !== p * 4) this._zeros = new Uint16Array(p * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[0]);
    gl.bufferSubData(gl.ARRAY_BUFFER, slot * p * 8, this._zeros);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** the lab's draw. `light` = {sunDir, amb, sunCol, dim}; `wind` = {dir, speed, windV, sway} (AUDIT MEADOW1: `sway`
   *  false holds the field still - the trees' switch);
   *  `style` (GRASS-PX) is the grass-style row's word - 'smooth' is the
   *  lab's blade, anything else the tuft sprite. */
  draw(proj, view, eye, timeSeconds, light, wind, range = LAB_GRASS.range, style = 'smooth') {
    if (!this.count || !this.slotBox) return;   // AUDIT 68 S16-grass-set-broken-dead: the field's slots are the one thing it draws
    const gl = this.gl; const u = this.u;
    // out = proj * view, column-major
    const o = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.program);
    // AUDIT MEADOW1: blended in the smooth style alone - a sprite style's every kept fragment has an alpha of exactly 1
    // (the fragment stage's mix(.., 1.0, uPixel)), so blending it was the same picture for a read of the target a pixel
    const pixel = pixelGrass(style);
    if (!pixel) gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // AUDIT 49 F1: the lab never enables CULL_FACE - a blade is one quad
    // seen from both sides - and the world renderer enables it at every
    // frame. Drawn with culling on, every blade whose winding faced away
    // vanished, which is grass that "disappears" as the eye turns. Off
    // for the grass, back on after, as the renderer left it.
    const culled = gl.isEnabled(gl.CULL_FACE);
    if (culled) gl.disable(gl.CULL_FACE);
    gl.uniformMatrix4fv(u.uVP, false, o);
    gl.uniform1f(u.uTime, timeSeconds);
    gl.uniform1f(u.uWind, wind.speed);
    gl.uniform2f(u.uWindDir, wind.dir[0], wind.dir[1]);
    gl.uniform2f(u.uGFieldOrigin, 0, 0);
    gl.uniform1f(u.uGFieldM, 1);
    gl.uniform1f(u.uSnowGlobal, 0);
    gl.uniform1f(u.uSnowFull, 1.1);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.zeroField);
    gl.uniform1i(u.uGField, 3);
    gl.activeTexture(gl.TEXTURE0);
    // AUDIT MEADOW1 (Mac: "have the wind sway effect the new foilage, like it does the trees"): THE FIELD SWAYS WHILE
    // THE TREES DO - the host hands the trees' own switch (floraSwayOn and a sky with a wind, as setFlatWind takes it),
    // and a field it holds still takes no wind at all: its standing lean only, as a tree's crown. A host that hands none
    // sways. The wind is the lean's alone in the vertex stage (uWind and uWindDir are the lab's, and read nowhere)
    const windV = wind.sway === false ? NO_WIND : wind.windV;
    gl.uniform2f(u.uWindV, windV[0], windV[1]);
    gl.uniform1f(u.uRange, range);
    // GRASS-PX: the style is a uniform, so the row flips live and the
    // program never recompiles; the sheet rides unit 4 (see the constructor)
    gl.uniform1f(u.uPixel, pixel ? 1 : 0);
    // MEADOW1: the meadow is a pixel style - a hard alpha, the dithered fade, a share of each cell - wearing the owner's
    // atlas, and the switch for what is its own (the law, the cards, the colour) is a uniform too: the row flips live
    const meadow = meadowGrass(style);
    gl.uniform1f(u.uArt, meadow ? 1 : 0);
    // AUDIT MEADOW1: the cards a cell's box must hold lean as far as this frame's wind carries them (MEADOW_WIND_REACH)
    this._cardReach = MEADOW_REACH + MEADOW_WIND_REACH * Math.hypot(windV[0], windV[1]);
    // GRASS-PX2: THE TUFT IS ONE QUAD. The lab's near blade is five
    // stacked quads so that it can CURVE; the sprite carries its own
    // curve, so in the pixel style every cell draws the one-quad blade
    // the far cells already use - a fifth of the vertices on the near
    // cells, which hold most of the blades that survive the fade.
    this._oneQuad = pixel;
    this._meadow = meadow;   // MEADOW1: ...and the meadow draws its cards in the quad's place (_drawVisibleSlots)
    // The numbers go up in EVERY style: a step count of zero is a divide
    // by zero in the pixel arm of a mix(), and mix(lab, NaN, 0.0) is NaN
    // - the whole field vanished the moment these were gated (GRASS
    // AUDIT 1 found that by drawing it). Only the sheet's bind is the
    // pixel style's own, so the smooth style never touches unit 4.
    // MEADOW1: the meadow's atlas has MEADOW_SLOTS cells (and AUDIT MEADOW1: no ramp - the fragment stage skips it)
    gl.uniform1f(u.uPxVariants, meadow ? MEADOW_SLOTS : this.pxVariants);
    gl.uniform1f(u.uPxSteps, PX_RAMP_STEPS);
    gl.uniform1f(u.uPxTintBands, PX_TINT_BANDS);
    if (pixel) {
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, meadow ? this.meadowSheet : this.pxSheet);
      gl.uniform1i(u.uPxSheet, 4);
      gl.activeTexture(gl.TEXTURE0);
    } else gl.uniform1i(u.uPxSheet, 4);   // AUDIT RETRO1 B1: the smooth style reads the sampler too (the mix at 0) - left on unit 0 it read whatever was bound there, and a frame image still bound there is a WebGL feedback loop; unit 4, which this style never binds
    // GRASS5: the pack's decode frame. The blade scale and the cell size
    // are the same for every slot, so they go once a draw; the cell's own
    // origin and ground span go per slot, below.
    gl.uniform4f(u.uBladeScale, heightFloor(this.height), Math.max(1e-6, heightSpan(this.height)), WIDTH_MIN, WIDTH_SPAN);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uSunDir, light.sunDir);
    // GRASS-LIT: UNDER ENHANCED LIGHTING THE COLOURS GO UP LINEAR, as the renderer's own programs take them (its _c3) and
    // the far ring's - `light.lane` is the installed lane (renderer.lightingLane), null on the classic one
    const lane = light.lane ?? null;
    const c3 = (c, out) => (lane && c ? lane.decode3(c, out) : c);
    gl.uniform3fv(u.uAmb, c3(light.amb, this._dec.amb));
    gl.uniform3fv(u.uSunCol, c3(light.sunCol, this._dec.sun));
    gl.uniform1f(u.uDim, light.dim ?? 1);
    gl.uniform1f(u.uLane, lane ? 1 : 0);
    gl.uniform3fv(u.uGrassTone, lane ? this.tones : this.tonesClassic);   // GRASS-LIT2: each lane its own
    gl.uniform3fv(u.uArtGround, lane ? this.artGround : this.artGroundClassic);   // MEADOW1: and the meadow's art its own ground
    gl.uniform1f(u.uELExposure, light.exposure ?? EL_EXPOSURE);
    gl.activeTexture(gl.TEXTURE0 + GRASS_ADAPT_UNIT);   // the far ring's unit for the eye; a frame with no air pass reads a 1
    gl.bindTexture(gl.TEXTURE_2D, light.adaptTex ?? this._adaptOne());
    gl.uniform1i(u.uAdapt, GRASS_ADAPT_UNIT);
    // GRASS-LIT: the deck's shadow on the renderer's reserved unit (the same map it binds there, or none - amount 0)
    const cs = light.cloud?.map ? light.cloud : null;
    if (cs) { gl.activeTexture(gl.TEXTURE0 + GRASS_CLOUD_UNIT); gl.bindTexture(gl.TEXTURE_2D, cs.map); }
    gl.uniform1i(u.uCloudShadowMap, GRASS_CLOUD_UNIT);
    gl.uniform4fv(u.uCloudShadowRect, cs ? cs.rect : NO_DECK);
    // GRASS-LIT: the sun map - the frame's ShadowPass binds its own units and matrices; without one (the classic lane,
    // the map off) the block answers full sun, and its samplers still name their own units (two sampler types on one
    // unit is an invalid draw in WebGL2)
    gl.activeTexture(gl.TEXTURE0);
    if (light.shadows) light.shadows.upload(this.shadowLoc);
    else {
      const L = this.shadowLoc;
      gl.uniform1i(L.sunShadow, SHADOW_SUN_UNIT); gl.uniform1i(L.pointShadow, SHADOW_POINT_UNIT);
      if (L.pointShadowLo) gl.uniform1i(L.pointShadowLo, SHADOW_LO_UNIT);
      gl.uniform4fv(L.sunParams, NO_DECK);
      // AUDIT GRASS-LIT2 A2: and NO CASTER - the lanterns read uCasterOf now, and a program's uniforms outlive the frame
      // that set them: a frame with shadows and then one without read the last frame's caster slots off its maps
      gl.uniform1iv(L.casterOf, NO_CASTERS);
      gl.uniform4fv(L.pointParams, NO_CASTER_PARAMS);
    }
    // GRASS-LIT: the player's light (R12), as the ground takes it; none handed is out of range everywhere
    gl.uniform4fv(u.uIndirect, light.indirect ?? NO_DECK);
    gl.uniform3fv(u.uIndirectColor, c3(light.indirectColor ?? ZERO3, this._dec.near));
    // GRASS-LIT2: the frame's lanterns, torches and candles - the list the ground took (renderer._pointLights) and their
    // display colours, linear under the lane as the ground's; cut to the program's slots, and none handed is none
    const pts = light.points ?? null, pcs = light.pointColors ?? null;
    const pn = pts && pcs ? Math.min(pts.length >> 2, Math.floor(pcs.length / 3), GRASS_MAX_LIGHTS) : 0;
    // AUDIT GRASS-LIT2 A1: the frame's list goes up whole, once; each cell is handed which of them meet it
    // (_cellLights, in _drawVisibleSlots) - the count is the cell's, uploaded when it changes
    this._pts = pn > 0 ? pts : null; this._pn = pn; this._cellN = -1;
    gl.uniform1i(u.uPointCount, 0);
    if (pn > 0) {
      gl.uniform4fv(u.uPointLights, pts.subarray ? pts.subarray(0, pn * 4) : pts.slice(0, pn * 4));
      gl.uniform3fv(u.uPointColors, lane ? lane.decodeN(pcs, this._dec.points, pn) : (pcs.subarray ? pcs.subarray(0, pn * 3) : pcs.slice(0, pn * 3)));
    }
    // WIND4: the ground's own two terms. A host that hands neither gets
    // the old behaviour (a full sun, no moon) rather than a black field,
    // because a missing light must not read as night.
    gl.uniform1f(u.uSunScale, light.sunScale ?? 1);
    gl.uniform3fv(u.uMoonDir, light.moonDir ?? UP);
    gl.uniform1f(u.uMoonScale, light.moonScale ?? 0);
    gl.uniform3fv(u.uMoonCol, c3(light.moonCol ?? WHITE, this._dec.moon));   // GRASS-LIT: linear under the lane
    // DISC20-A: the frame's fog as the terrain takes it (renderer.setFog's state, measured from the view's eye). A
    // host that hands none draws the field unfogged - mode 0 is a factor of exactly 1, the lab's own picture.
    const fog = light.fog;
    gl.uniform1i(u.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(u.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(u.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(u.uFogColor, fog?.color ?? WHITE);
    gl.uniform3fv(u.uCamPos, fog?.camPos ?? eye);
    if (u.uDwFog) gl.uniform4fv(u.uDwFog, fog?.dw ?? NO_WATER_FOG);   // DW-C: the frame's (renderer.setWaterFog); none handed, off
    gl.bindVertexArray(this.vao);
    this._drawVisibleSlots(o, eye, range);   // PERF2: the field, culled by cell
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    if (culled) gl.enable(gl.CULL_FACE);
  }

  /** PERF2: point the instance attributes at one slot's run. WebGL2
   *  has no base instance, so a slot is drawn by moving the pointers -
   *  one call a lane, no upload. */
  _point(slot) {
    const gl = this.gl; const p = this.perCell ?? 0;
    // GRASS5: the TYPE has to be re-stated here, not just the offset.
    // This call is what moves the pointers to a slot's run, and
    // `vertexAttribPointer` sets the format as well as the offset - so
    // pointing with the old float shape silently un-packed every
    // attribute and the draw took INVALID_OPERATION with an empty
    // frame. The probe caught it; no pin could, because the pins run on
    // a fake GL that draws nothing.
    for (let k = 0; k < this._lanes.length; k++) {   // AUDIT 68 S16-grass-point-alloc: the constructor's table, no literal per call
      const L = this._lanes[k];
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[k]);
      gl.vertexAttribPointer(L.loc, 4, L.type, true, 0, slot * p * L.bytes);
    }
  }

  /** PERF2: THE FIELD DRAWS ONLY WHAT CAN BE SEEN. Before this every
   *  slot went to the GPU every frame - the whole 420 m window, the
   *  cells behind the eye and the corners past uRange that the shader
   *  faded to nothing (vFade is 0 beyond uRange, and the window's
   *  corners are 1.4 x uRange out). A cell is skipped when its box is
   *  outside the frustum, or when its nearest point is past the range.
   *  Same picture: a skipped cell drew no fragment that survived. */
  _drawVisibleSlots(vp, eye, range) {
    const gl = this.gl; const p = this.perCell;
    const planes = frustumPlanes(vp, this._planes);
    let slots = 0, blades = 0, kept = 0, verts_ = 0, farSlots = 0, cardSlots = 0, cardsFarSlots = 0;
    gl.bindVertexArray(this.vao);   // GRASS2: the near array is the one the caller bound; the loop tracks it from here
    let wasVao = this.vao;   // MEADOW1: which array is bound - the blade's, the far blade's, or the meadow's near or far cards
    for (let slot = 0; slot < this.slotBox.length; slot++) {
      const box = this.slotBox[slot];
      if (!box) continue;
      const dx = Math.max(box[0] - eye[0], 0, eye[0] - box[3]);
      const dz = Math.max(box[2] - eye[2], 0, eye[2] - box[5]);
      if (dx * dx + dz * dz > range * range) continue;   // wholly past the fade
      // AUDIT MEADOW1: the frustum is asked of what the cell DRAWS - the blades' own box, or in the meadow that box
      // widened by its cards' reach in this frame's wind and raised to its tallest card's top (writeSlot). The fade and
      // the range above stay the roots', which is what the vertex stage measures them by.
      let seen = box;
      if (this._meadow) {
        const r = this.slotCardH[slot] * this._cardReach, cb = this._cardBox;
        const t = r * this.slotCardTilt[slot];   // a card sheared to its slope stands that much under its root or over its top
        cb[0] = box[0] - r; cb[1] = box[1] - t; cb[2] = box[2] - r; cb[3] = box[3] + r; cb[4] = box[4] + this.slotCardRise[slot] + t; cb[5] = box[5] + r;
        seen = cb;
      }
      if (aabbOutside(planes, seen)) continue;
      // GRASS2: A SLOT IS NOT A CELL. `perCell` is the slot's SIZE; the
      // blades that actually stood in it is `slotCount` - every candidate
      // the placer dropped for standing on a road, in water, off grass or
      // below the sea line left a zero-height pad blade behind it. A pad
      // blade draws nothing, but it is still thirty vertex shader
      // invocations, and a cell crossing a highway or a shoreline can be
      // mostly pad. Instancing the count instead of the slot is the same
      // picture for less work - the kept blades are the run's FRONT,
      // because the placer appends and the pad is what is left over.
      const n = this.slotCount ? this.slotCount[slot] : p;
      if (n <= 0) continue;
      // GRASS2: THE PREFIX THAT CAN SURVIVE. The shader keeps a blade
      // when its index fraction is under `vFade * 1.15`, and vFade only
      // ever FALLS with distance - so no blade in this cell can beat the
      // fade at the cell's NEAREST corner. Everything past that index
      // would be thrown away by the shader after a full transform, so it
      // is not submitted at all. Using the nearest corner (rather than
      // the centre) is what makes the bound SAFE: it is the most
      // generous any blade in the cell could claim, so no blade the
      // shader wanted is ever cut by the host.
      //
      // WHAT THIS DOES AND DOES NOT PRESERVE, exactly. Against the index
      // law above it is lossless - every blade the shader would keep is
      // submitted. Against the OLD hash law it is not blade-for-blade:
      // a hash of the phase and a prefix of the index are both uniform
      // random subsets of the same SIZE, so the field has the same
      // density, the same look and the same statistics, but a different
      // individual blade here and there. The probe measures that: the
      // lit pixel count moved by 8 in 67,800.
      const dn = Math.sqrt(dx * dx + dz * dz);
      const fade = 1 - smoothstep(range * 0.55, range, dn);
      // GRASS AUDIT 1: a tuft stands in for two of the lab's blades, so
      // the pixel style submits HALF the cell - the placer's order is
      // random, so the first half is a uniform half - and the fade law
      // runs over that half, the way it ran over the whole. MEADOW1: a
      // meadow sprite is a whole tuft, and stands for MEADOW_BLADES_PER_TUFT.
      const m = this._oneQuad ? Math.ceil(n / (this._meadow ? MEADOW_BLADES_PER_TUFT : PX_BLADES_PER_TUFT)) : n;
      const budget = Math.min(m, Math.ceil(m * fade * 1.15));
      if (budget <= 0) continue;
      gl.uniform1f(this.u.uSlotN, m);   // the fraction is over the CELL (or its half), not over the prefix
      // GRASS5: this cell's own frame - without it the packed 16-bit
      // lanes are 0..1 numbers with no idea where in the world they are
      const f = slot * 4, F = this.slotFrame;
      gl.uniform4f(this.u.uCellFrame, F[f], F[f + 1], F[f + 2], F[f + 3]);
      gl.uniform1f(this.u.uCellSize, this.slotSpan ? this.slotSpan[slot] : (this.cellSize ?? GRASS_CELL));
      // GRASS2: the far blade, past GRASS_FAR_AT of the range. Bound per
      // slot, which is why the level of detail is a CELL's and not a
      // blade's - one bind for six thousand blades rather than a branch
      // inside every one of them.
      const far = this._oneQuad || dn > range * GRASS_FAR_AT;   // GRASS-PX2: the pixel style is one quad everywhere
      // MEADOW1: the meadow's cards at every distance - three near, two past MEADOW_NEAR_AT of the range, the far
      // blade's law one level up: a cell's, by its nearest point
      const cardsFar = dn > range * (MEADOW_NEAR_AT + MEADOW_NEAR_BAND);   // AUDIT MEADOW1: past the band, where no tuft keeps its third card
      const vao = this._meadow ? (cardsFar ? this.vaoCardsFar : this.vaoCards) : (far ? this.vaoFar : this.vao);
      if (vao !== wasVao) { gl.bindVertexArray(vao); wasVao = vao; }
      const verts = this._meadow ? (cardsFar ? this.vertsCardsFar : this.vertsCards) : (far ? this.vertsFar : this.verts);
      if (this._pn > 0) this._cellLights(box);   // AUDIT GRASS-LIT2 A1
      this._point(slot);
      if (this._meadow) gl.drawElementsInstanced(gl.TRIANGLES, cardsFar ? this.countCardsFar : this.countCards, gl.UNSIGNED_SHORT, 0, budget);   // AUDIT MEADOW1: indexed - each corner shaded once
      else gl.drawArraysInstanced(gl.TRIANGLES, 0, verts, budget);
      slots++; blades += budget; kept += n; verts_ += verts * budget;
      if (this._meadow) { cardSlots++; if (cardsFar) cardsFarSlots++; } else if (far) farSlots++;
    }
    this.drawn.slots = slots; this.drawn.blades = blades; this.drawn.kept = kept;
    this.drawn.slotCapacity = slots * p;   // GRASS2: what the same frame cost before the pad came off
    this.drawn.verts = verts_; this.drawn.farSlots = farSlots;   // GRASS2: the vertex work, counted rather than inferred from one blade shape
    this.drawn.cardSlots = cardSlots; this.drawn.cardsFarSlots = cardsFarSlots;   // MEADOW1: the slots drawn on the meadow's cards, and of them on its far two
  }

  /** AUDIT GRASS-LIT2 A1: THE CELL'S LANTERNS. The frame's lights whose reach meets the cell's box (its roots' lowest to
   *  its tallest tip), nearest first, at most GRASS_CELL_LIGHTS; uploaded only when they differ from the last cell's - an
   *  open field's cells are all the same empty list, one upload a frame. */
  _cellLights(box) {
    const P = this._pts, idx = this._cellIdx, dist = this._cellDist, cap = GRASS_CELL_LIGHTS;
    let n = 0;
    for (let i = 0; i < this._pn; i++) {
      const x = P[i * 4], y = P[i * 4 + 1], z = P[i * 4 + 2], r = P[i * 4 + 3];
      const dx = Math.max(box[0] - x, 0, x - box[3]), dy = Math.max(box[1] - y, 0, y - box[4]), dz = Math.max(box[2] - z, 0, z - box[5]);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (!(d2 < r * r)) continue;   // its reach misses the cell (the shader's own `pd >= w` cut, at the box)
      if (n === cap && d2 >= dist[cap - 1]) continue;   // full, and no nearer than any kept: it falls off
      let k = n < cap ? n++ : cap - 1;   // the slot it takes - the farthest's, when full
      while (k > 0 && dist[k - 1] > d2) { dist[k] = dist[k - 1]; idx[k] = idx[k - 1]; k--; }   // nearest first; a tie keeps the earlier light
      dist[k] = d2; idx[k] = i;
    }
    let same = n === this._cellN;
    for (let k = 0; same && k < n; k++) same = idx[k] === this._cellLast[k];
    if (same) return;
    this.gl.uniform1i(this.u.uPointCount, n);
    if (n > 0) this.gl.uniform1iv(this.u.uPointIdx, idx);
    this._cellN = n; this._cellLast.set(idx);
  }

  /** GRASS-LIT: a 1x1 adaptation image holding the multiplier 1 (the log encoding's midpoint) - the far ring's own,
   *  for a lane frame with no air pass */
  _adaptOne() {
    if (this._one) return this._one;
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return (this._one = tex);
  }

  destroy() {
    const gl = this.gl;
    if (this._one) gl.deleteTexture(this._one);   // GRASS-LIT
    for (const b of this.bufs) gl.deleteBuffer(b);
    for (const b of this._cornerBufs ?? []) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vao);
    if (this.vaoFar) gl.deleteVertexArray(this.vaoFar);
    if (this.vaoCards) gl.deleteVertexArray(this.vaoCards);   // MEADOW1 (their corner and index buffers are the last four of _cornerBufs)
    if (this.vaoCardsFar) gl.deleteVertexArray(this.vaoCardsFar);
    gl.deleteTexture(this.zeroField);
    gl.deleteTexture(this.pxSheet);   // GRASS-PX
    gl.deleteTexture(this.meadowSheet);   // MEADOW1
    gl.deleteProgram(this.program);
  }
}
