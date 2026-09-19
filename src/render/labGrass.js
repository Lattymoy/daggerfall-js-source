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
  Object.freeze({
    why: 'the tint is pulled toward a low-frequency world-space noise, so the field has patches instead of reading as one flat carpet',
    from: '  vTint = aInst2.z;',
    to: '  float clump = vnoise(root * 0.055) * 0.66 + vnoise(root * 0.017) * 0.34;\n  vTint = clamp(mix(aInst2.z, clump, 0.55), 0.0, 1.0);',
  }),
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
  // GRASS2: THE FIELD HAS PATCHES. aInst2.z is one uniform random per
  // blade and nothing more, so neighbouring blades were as different as
  // distant ones and the sward read as a flat carpet of noise at any
  // distance past a few metres - the eye needs correlation to see a
  // field rather than a texture. A low-frequency value noise in WORLD
  // space (so a patch belongs to the ground, not to the camera) pulls
  // the per-blade tint toward its neighbours' without narrowing the
  // range: the mean is unchanged and the variance is redistributed from
  // blade-to-blade to patch-to-patch. Two octaves, tens of metres
  // across - larger than a blade, smaller than the draw range.
  //
  // NOT named "patch": that is a RESERVED WORD in GLSL ES 3.00 (the
  // tessellation qualifier), and a reserved word used as an identifier
  // fails the whole program to compile - which takes the entire field
  // down, not one line of it. The same trap took the sky down at VC6
  // under the name "flat". The probe below is what catches it; no pin
  // can, because the pins compile nothing.
  float clump = vnoise(root * 0.055) * 0.66 + vnoise(root * 0.017) * 0.34;
  vTint = clamp(mix(aInst2.z, clump, 0.55), 0.0, 1.0);
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
 *  Pure, so a pin can hold it against the fill loop. */
export function discSlotCount(radius, cell = GRASS_CELL, steps = 240) {
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
 *    height   0.25..0.72 units, so 8 bits is 1.8 mm
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
 * One cell's blades, padded to `perCell` with zero-height blades so the
 * slot is always full. The laws are placeLabGrassSteps' own, per blade.
 */
export function placeLabGrassCell(cx, cz, { keep, ground = null, perCell, height = LAB_GRASS.height, seed = LAB_GRASS.seed, cell = GRASS_CELL }) {
  const inst = new Float32Array(perCell * 4); const inst2 = new Float32Array(perCell * 4);
  const rootY = new Float32Array(perCell); const groundCol = new Float32Array(perCell * 3);
  let s = grassCellSeed(cx, cz, seed);
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const ox = cx * cell, oz = cz * cell;
  let n = 0;
  for (let i = 0; i < perCell; i++) {
    const px = rnd() * cell, pz = rnd() * cell;
    const a = rnd() * 6.283, rr = rnd() * rnd() * 0.55;
    const x = ox + px + Math.cos(a) * rr, z = oz + pz + Math.sin(a) * rr;
    const h = (0.22 + rnd() * 0.42) * (height / 34);
    const phase = rnd() * 6.283;
    const lx = (rnd() - 0.5) * 0.5, lz = (rnd() - 0.5) * 0.5;
    const tint = rnd();
    const w = 0.052 + rnd() * 0.055;
    const y = keep(x, z);
    if (y === null || y === undefined) continue;
    inst[n * 4] = x; inst[n * 4 + 1] = z; inst[n * 4 + 2] = h; inst[n * 4 + 3] = phase;
    inst2[n * 4] = lx; inst2[n * 4 + 1] = lz; inst2[n * 4 + 2] = tint; inst2[n * 4 + 3] = w;
    rootY[n] = y;
    const gc = ground ? ground(x, z) : null;
    groundCol[n * 3] = gc ? gc[0] : 0.10; groundCol[n * 3 + 1] = gc ? gc[1] : 0.145; groundCol[n * 3 + 2] = gc ? gc[2] : 0.065;
    n++;
  }
  // the pad: height 0 draws nothing (the vertex stage collapses h=0)
  return { inst, inst2, rootY, ground: groundCol, count: n, perCell };
}

/**
 * The field: which cells stand around the eye, each in its own slot.
 * `update(ex, ez)` a frame: it frees cells out of range, and fills at
 * most `perFrame` new ones - a cell is a few thousand blades and a
 * few thousand keep() lookups, milliseconds, so the walk never
 * hitches and never has to be time-sliced.
 */
export function createGrassField(renderer, { keep, ground = null, span = LAB_GRASS.span, density = LAB_GRASS.density, height = LAB_GRASS.height, seed = LAB_GRASS.seed, cell = GRASS_CELL, range = LAB_GRASS.range, perFrame = 2, slots: slotsOverride = 0 }) {
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
  /** PERF10: the square distance from the eye to a cell's nearest point -
   *  _drawVisibleSlots' own test, so what is filled is what is drawn. */
  const nearSq = (cx, cz, ex, ez) => {
    const dx = Math.max(cx * cell - ex, 0, ex - (cx + 1) * cell);
    const dz = Math.max(cz * cell - ez, 0, ez - (cz + 1) * cell);
    return dx * dx + dz * dz;
  };
  return {
    perCell, slots, live,
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
    invalidate(x0, z0, x1, z1) {
      const cx0 = Math.floor(x0 / cell), cx1 = Math.floor(x1 / cell);
      const cz0 = Math.floor(z0 / cell), cz1 = Math.floor(z1 / cell);
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const key = cellKey(cx, cz);
        const held = live.get(key);
        if (!held) continue;
        renderer.clearSlot(held.slot);
        live.delete(key);
        free.push(held.slot);
      }
    },
    update(ex, ez, keepNow = keep, groundNow = ground) {
      const keepR2 = span * span;      // PERF10: held out to here
      const fillR2 = range * range;    // PERF10: placed only inside here
      const k = Math.ceil(range / cell) + 1;
      const ecx = Math.floor(ex / cell), ecz = Math.floor(ez / cell);
      // free what fell out of range. PERF10: cx/cz ride the entry, so
      // this sweep - which runs over every live cell every frame and
      // usually frees nothing - allocates nothing at all.
      for (const [key, held] of live) {
        if (nearSq(held.cx, held.cz, ex, ez) > keepR2) { renderer.clearSlot(held.slot); live.delete(key); free.push(held.slot); }
      }
      // fill what came into range, nearest first, a few a frame
      let budget = perFrame;
      /** @type {{ d:number, cx:number, cz:number, key:number }[]} */
      const want = [];   // HARD3: a NAMED shape, because a mixed [number, number, number, string] literal widens to (number|string)[] and `a[0] - b[0]` stops type-checking
      for (let cz = ecz - k; cz <= ecz + k; cz++) for (let cx = ecx - k; cx <= ecx + k; cx++) {
        const d = nearSq(cx, cz, ex, ez);
        if (d > fillR2) continue;
        const key = cellKey(cx, cz);
        if (!live.has(key)) want.push({ d, cx, cz, key });
      }
      want.sort((a, b) => a.d - b.d);
      for (const { d, cx, cz, key } of want) {
        if (budget <= 0) break;
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
        renderer.writeSlot(slot, placeLabGrassCell(cx, cz, { keep: keepNow, ground: groundNow, perCell, height, seed, cell }));
        live.set(key, { slot, cx, cz });
      }
      // AUDIT PERF10 F5: what was MISSING when this update began - not
      // what is still missing now. GR5's comment said "pending" and the
      // number never meant that; the one caller ignores it and the pin
      // reads it as "the rest wait their turn", both of which hold.
      return want.length;
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
    const tint = rnd();
    const w = 0.052 + rnd() * 0.055;
    const y = keep(x, z);
    if (y !== null && y !== undefined) {
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
  const meanOf = (l) => { let r = 0, g = 0, b = 0; const n = l.width * l.height; for (let k = 0; k < n; k++) { r += l.colors[k * 4]; g += l.colors[k * 4 + 1]; b += l.colors[k * 4 + 2]; } return [r / n, g / n, b / n]; };
  const means = [0, 1, 2, 3].map((i) => meanOf(layers[i]));
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
 * `set(placed)` uploads a scatter; `draw()` is the lab's draw, term for
 * term, with the game's light and wind in the lab's uniforms.
 */
export class LabGrassRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, LAB_GRASS_HEAD + GAME_GRASS_FIELD + LAB_GRASS_VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, LAB_GRASS_HEAD + LAB_GRASS_FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uTime', 'uWind', 'uRange', 'uEye', 'uSunDir', 'uWindDir', 'uSnowFull', 'uSlotN', 'uCellFrame', 'uBladeScale', 'uCellSize', 'uGField', 'uGFieldOrigin', 'uGFieldM', 'uSnowGlobal', 'uWindV', 'uAmb', 'uSunCol', 'uDim', 'uSunScale', 'uMoonDir', 'uMoonScale', 'uMoonCol']) this.u[n] = gl.getUniformLocation(prog, n);
    // the blade, and three instance streams the lab's layout plus the game's root height
    // GRASS2: the instance buffers are made ONCE and shared by both
    // levels of detail - only the corner buffer differs between them, so
    // a cell drops to the far blade by binding the other array. Nothing
    // is uploaded twice and nothing is kept in step by hand.
    // GRASS5: THREE buffers, not four - the root height rides in the
    // first one's spare lane now, so there is no attribute of its own.
    this.bufs = [1, 2, 4].map(() => gl.createBuffer());
    for (const b of this.bufs) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW); }
    /** one vertex array over a corner buffer of `segments` quads */
    const buildVao = (segments) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const cb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cb);
      const corners = labBladeCorners(segments);
      gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      // GRASS5: NORMALIZED integer attributes - the GPU does the unpack,
      // so the shader reads floats in 0..1 and the decode is two
      // multiply-adds rather than a fetch per field.
      for (const [i, loc, type] of [[0, 1, gl.UNSIGNED_SHORT], [1, 2, gl.UNSIGNED_BYTE], [2, 4, gl.UNSIGNED_BYTE]]) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]);
        gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, type, true, 0, 0);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.bindVertexArray(null);
      return { vao, verts: corners.length / 2, cb };
    };
    const near = buildVao(5), far = buildVao(GRASS_FAR_SEGMENTS);
    this.vao = near.vao; this.verts = near.verts;
    this.vaoFar = far.vao; this.vertsFar = far.verts;
    this._cornerBufs = [near.cb, far.cb];
    gl.bindVertexArray(null);
    // the field the lab's grass reads: nothing, so the snow and wet terms are zero
    this.zeroField = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.zeroField);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.count = 0;
    this._vp = new Float32Array(16);
    this._planes = new Float32Array(24);   // PERF2
    this.slotBox = null;                    // PERF2: per slot, the cell's world box, or null while empty
    this.slotCount = null;                  // GRASS2: per slot, the blades that actually STOOD - the rest of the slot is pad
    this.drawn = { slots: 0, blades: 0, kept: 0 };   // PERF2: what the last draw actually submitted; GRASS2: and how much of it was not pad
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
    this.slotFrame = new Float32Array(slots * 4);
    this.slotSpan = new Float32Array(slots);   // GRASS5: the cell's own xz extent, which is NOT the cell size
    this._packA = new Uint16Array(perCell * 4);   // the scratch a cell is packed through, reused
    this._packB = new Uint8Array(perCell * 4);
    this._packC = new Uint8Array(perCell * 4);
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
    for (let i = 0; i < n; i++) {
      const x = placed.inst[i * 4], z = placed.inst[i * 4 + 1], h = placed.inst[i * 4 + 2], ph = placed.inst[i * 4 + 3];
      A[i * 4] = u16((x - ox) / xSpan);
      A[i * 4 + 1] = u16((z - oz) / xSpan);
      A[i * 4 + 2] = u16((placed.rootY[i] - yBase) / ySpan);
      A[i * 4 + 3] = u16((h - hFloor) / hSpan);
      B[i * 4] = u8((placed.inst2[i * 4] + LEAN_SPAN / 2) / LEAN_SPAN);
      B[i * 4 + 1] = u8((placed.inst2[i * 4 + 1] + LEAN_SPAN / 2) / LEAN_SPAN);
      B[i * 4 + 2] = u8(placed.inst2[i * 4 + 2]);
      B[i * 4 + 3] = u8((placed.inst2[i * 4 + 3] - WIDTH_MIN) / WIDTH_SPAN);
      C[i * 4] = u8(placed.ground[i * 3]);
      C[i * 4 + 1] = u8(placed.ground[i * 3 + 1]);
      C[i * 4 + 2] = u8(placed.ground[i * 3 + 2]);
      C[i * 4 + 3] = u8(ph / 6.283185307179586);
    }
    // HARD3's lesson again: a mixed [number, TypedArray, number] literal
    // widens to (number | Uint16Array | Uint8Array)[], and then `i` is
    // not an index and `bytes` is not a number. A named shape keeps both.
    for (const w of [{ i: 0, data: A, bytes: 8 }, { i: 1, data: B, bytes: 4 }, { i: 2, data: C, bytes: 4 }]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[w.i]);
      gl.bufferSubData(gl.ARRAY_BUFFER, slot * p * w.bytes, w.data);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** GR5: a cell leaves - its heights go to zero, and h=0 draws nothing. */
  clearSlot(slot) {
    const gl = this.gl; const p = this.perCell;
    if (this.slotBox) this.slotBox[slot] = null;   // PERF2
    if (this.slotCount) this.slotCount[slot] = 0;   // GRASS2
    // GRASS5: zeroing A zeroes the packed HEIGHT, and a blade of the
    // cell's height FLOOR still draws - so a cleared slot is also
    // dropped by slotCount, which is what really keeps it off the GPU.
    if (!this._zeros || this._zeros.length !== p * 4) this._zeros = new Uint16Array(p * 4);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[0]);
    gl.bufferSubData(gl.ARRAY_BUFFER, slot * p * 8, this._zeros);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /** upload a scatter from placeLabGrass. Creates nothing, draws nothing. */
  set(placed) {
    const gl = this.gl;
    for (const [i, data] of [[0, placed.inst], [1, placed.inst2], [2, placed.rootY], [3, placed.ground]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.count = placed.count;
    this.slotBox = null;   // PERF2: a scatter is one run, drawn whole
  }

  /** the lab's draw. `light` = {sunDir, amb, sunCol, dim}; `wind` = {dir, speed, windV}. */
  draw(proj, view, eye, timeSeconds, light, wind, range = LAB_GRASS.range) {
    if (!this.count) return;
    const gl = this.gl; const u = this.u;
    // out = proj * view, column-major
    const o = this._vp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = proj[r] * view[c * 4] + proj[4 + r] * view[c * 4 + 1] + proj[8 + r] * view[c * 4 + 2] + proj[12 + r] * view[c * 4 + 3];
    gl.useProgram(this.program);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
    gl.uniform2f(u.uWindV, wind.windV[0], wind.windV[1]);
    gl.uniform1f(u.uRange, range);
    // GRASS5: the pack's decode frame. The blade scale and the cell size
    // are the same for every slot, so they go once a draw; the cell's own
    // origin and ground span go per slot, below.
    gl.uniform4f(u.uBladeScale, heightFloor(this.height), Math.max(1e-6, heightSpan(this.height)), WIDTH_MIN, WIDTH_SPAN);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uSunDir, light.sunDir);
    gl.uniform3fv(u.uAmb, light.amb);
    gl.uniform3fv(u.uSunCol, light.sunCol);
    gl.uniform1f(u.uDim, light.dim);
    // WIND4: the ground's own two terms. A host that hands neither gets
    // the old behaviour (a full sun, no moon) rather than a black field,
    // because a missing light must not read as night.
    gl.uniform1f(u.uSunScale, light.sunScale ?? 1);
    gl.uniform3fv(u.uMoonDir, light.moonDir ?? UP);
    gl.uniform1f(u.uMoonScale, light.moonScale ?? 0);
    gl.uniform3fv(u.uMoonCol, light.moonCol ?? WHITE);
    gl.bindVertexArray(this.vao);
    if (this.slotBox) this._drawVisibleSlots(o, eye, range);   // PERF2: the field, culled by cell
    else { gl.uniform1f(u.uSlotN, this.count); this._point(0); gl.drawArraysInstanced(gl.TRIANGLES, 0, this.verts, this.count); this.drawn.slots = 1; this.drawn.blades = this.count; this.drawn.kept = this.count;
      // GRASS2: every field of `drawn` is written on EVERY path, or a
      // reader gets the last cell-drawn frame's numbers for this one.
      this.drawn.verts = this.count * this.verts; this.drawn.farSlots = 0; this.drawn.slotCapacity = this.count; }   // the lab's one scatter
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
    if (culled) gl.enable(gl.CULL_FACE);
  }

  /** PERF2: point the four instance attributes at one slot's run. WebGL2
   *  has no base instance, so a slot is drawn by moving the pointers -
   *  four calls, no upload. */
  _point(slot) {
    const gl = this.gl; const p = this.perCell ?? 0;
    // GRASS5: the TYPE has to be re-stated here, not just the offset.
    // This call is what moves the pointers to a slot's run, and
    // `vertexAttribPointer` sets the format as well as the offset - so
    // pointing with the old float shape silently un-packed every
    // attribute and the draw took INVALID_OPERATION with an empty
    // frame. The probe caught it; no pin could, because the pins run on
    // a fake GL that draws nothing.
    for (const [i, loc, type, bytes] of [[0, 1, gl.UNSIGNED_SHORT, 8], [1, 2, gl.UNSIGNED_BYTE, 4], [2, 4, gl.UNSIGNED_BYTE, 4]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[i]);
      gl.vertexAttribPointer(loc, 4, type, true, 0, slot * p * bytes);
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
    let slots = 0, blades = 0, kept = 0, verts_ = 0, farSlots = 0, wasFar = false;
    gl.bindVertexArray(this.vao);   // GRASS2: the near array is the one the caller bound; the loop tracks it from here
    for (let slot = 0; slot < this.slotBox.length; slot++) {
      const box = this.slotBox[slot];
      if (!box) continue;
      const dx = Math.max(box[0] - eye[0], 0, eye[0] - box[3]);
      const dz = Math.max(box[2] - eye[2], 0, eye[2] - box[5]);
      if (dx * dx + dz * dz > range * range) continue;   // wholly past the fade
      if (aabbOutside(planes, box)) continue;
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
      const budget = Math.min(n, Math.ceil(n * fade * 1.15));
      if (budget <= 0) continue;
      gl.uniform1f(this.u.uSlotN, n);   // the fraction is over the CELL, not over the prefix
      // GRASS5: this cell's own frame - without it the packed 16-bit
      // lanes are 0..1 numbers with no idea where in the world they are
      const f = slot * 4, F = this.slotFrame;
      gl.uniform4f(this.u.uCellFrame, F[f], F[f + 1], F[f + 2], F[f + 3]);
      gl.uniform1f(this.u.uCellSize, this.slotSpan ? this.slotSpan[slot] : (this.cellSize ?? GRASS_CELL));
      // GRASS2: the far blade, past GRASS_FAR_AT of the range. Bound per
      // slot, which is why the level of detail is a CELL's and not a
      // blade's - one bind for six thousand blades rather than a branch
      // inside every one of them.
      const far = dn > range * GRASS_FAR_AT;
      if (far !== wasFar) { gl.bindVertexArray(far ? this.vaoFar : this.vao); wasFar = far; }
      const verts = far ? this.vertsFar : this.verts;
      this._point(slot);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, verts, budget);
      slots++; blades += budget; kept += n; verts_ += verts * budget; if (far) farSlots++;
    }
    this.drawn.slots = slots; this.drawn.blades = blades; this.drawn.kept = kept;
    this.drawn.slotCapacity = slots * p;   // GRASS2: what the same frame cost before the pad came off
    this.drawn.verts = verts_; this.drawn.farSlots = farSlots;   // GRASS2: the vertex work, counted rather than inferred from one blade shape
  }

  destroy() {
    const gl = this.gl;
    for (const b of this.bufs) gl.deleteBuffer(b);
    for (const b of this._cornerBufs ?? []) gl.deleteBuffer(b);
    gl.deleteVertexArray(this.vao);
    if (this.vaoFar) gl.deleteVertexArray(this.vaoFar);
    gl.deleteTexture(this.zeroField);
    gl.deleteProgram(this.program);
  }
}
