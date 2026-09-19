// @ts-check
// WebGL2 renderer for world geometry. Presentation layer - ours, not DFU's
// (Port-Doctrine). Semantics it must honor from the data side:
//   - UVs can be negative or > 1 (DFU relies on REPEAT wrapping).
//   - Textures arrive from TextureFile.getColor32 already bottom-up, which is
//     GL's native texel order; upload as-is with flipY off.
//   - Indexed color means hard pixels: NEAREST filtering.
//   - Alpha 0 texels are palette-index cutouts; the shader discards them.

import { CLOUD_SHADOW_GLSL } from './cloudShadow.js';   // EE5 / VC4: the cloud shadow's reader - VC6c's one home, shared with the air pass's shafts
// ABOVE the first shader text on purpose: every template below is built
// at module scope, and a block a shader interpolates has to be in hand by
// then. The import hoists and the leaf has no imports of its own, so this
// is already guaranteed - the line stands where it reads as the rule.

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec2 vUV;
out vec3 vWorldPos;
void main() {
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = uProj * uView * world;
}`;

// EE5 / VC4: THE CLOUD SHADOW, one block for every program that lights by
// the sun - declared INSIDE each shader that interpolates it (a GLSL
// declaration is visible only to its own compilation unit; the first
// attempt put it outside every shader and the renderer threw on boot).
// VC6c moved the text itself to render/cloudShadow.js, because the air
// pass's shafts read the same field and cannot import from here.

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform vec3 uAmbientSky;     // BA1: Unity's AmbientMode.Trilight - sky for a normal facing up, ground facing down,
uniform vec3 uAmbientGround;  //      uAmbient (the equator) sideways, blended by n.y; uTrilight 0 is the flat ambient
uniform float uTrilight;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;    // EV5: the second directional term - the masser
uniform float uMoonScale; // 0 = no moon (classic, indoors, daytime)
uniform vec3 uMoonColor;
// ROAD-C c2: the THIRD directional term, and the only pass in the game
// that lights it - DFU's automap beacons take THREE directional lights
// (CreateLightsForAutomapGeometry, Automap.cs:2025-2076) where the world
// has two. 0 = off, which is every other pass.
uniform vec3 uLight3Dir;
uniform float uLight3Scale;
uniform vec3 uLight3Color;
uniform vec3 uEmissionColor;
uniform int uPointCount;
uniform vec4 uPointLights[16]; // xyz scene-space, w range
uniform vec3 uPointColors[16]; // LT1: per-light colour x intensity (AddLight's second switch)
uniform vec4 uIndirect;       // R12: xyz player pos, w range (0 = off)
uniform vec3 uIndirectColor;  // color x intensity x daylight scale
uniform vec3 uFogColor;
uniform int uFogMode; // 0 off, 1 linear, 2 exp, 3 exp2 (DS1: Unity's ExponentialSquared, which Dynamic Skies' fog presets use)
uniform float uFogDensity;
uniform vec2 uFogRange; // start, end
uniform vec3 uCamPos;
uniform float uClipY;  // A1: the automap slice plane (_SclicingPositionY's law) - fragments above it discard; 1e9 = off
// A2 + ROAD-C c2/S6: the SIX automap presentations, which are DFU's two
// SubShader passes crossed with RENDER_IN_GRAYSCALE
// (Assets/Shaders/DaggerfallAutomap.shader):
//   0            off - the world
//   1 / 2        BELOW the slice, colour / grayscale        (pass 1)
//   3 / 4        ABOVE the slice, TRANSPARENT (alpha 0.75)  (pass 2)
//   5 / 6        ABOVE the slice, WIREFRAME constant colour (pass 2)
// Cutout is not a mode: DFU's #else clip(-1.0) arm means "draw the
// above-slice group not at all", and the port simply does not issue it.
// The EVEN modes are the grayscale halves, which is why the tests below
// read amMode % 2 == 0.
uniform float uAutomapMode;
uniform float uAutomapWaterLevel;   // _WaterLevel: AddWater's per-block level (:1982-2001); the shader's own default is -10000
uniform vec4 uAutomapWaterColor;    // _WaterColor: UnderwaterFog.waterMapColor, which Automap.cs:2590 injects into the one automap material
${CLOUD_SHADOW_GLSL}
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
void main() {
  int amMode = int(uAutomapMode + 0.5);
  // A1: the ceiling cut (Automap.cs UpdateSlicingPositionY). c2/S6: the
  // above-slice pass INVERTS it - DFU's second pass keeps exactly the
  // fragments the first one threw away (if worldPos.y > slice {...}
  // else discard), so the two passes are a partition of the geometry
  // and never draw the same fragment twice.
  if (amMode >= 3) { if (vWorldPos.y <= uClipY) discard; }
  else if (vWorldPos.y > uClipY) discard;
  vec4 tex = texture(uTex, vUV);
  // INCIDENT 2026-09-04: no alpha clip here - DaggerfallDefault.shader is
  // RenderType Opaque with no clip(); the mortar runs of a wall texture
  // are palette index 0 and were being discarded as cutouts.
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  diff *= cloudShadowAt(vWorldPos);   // VC4: the cloud's shadow on the sun term
  float mdiff = max(dot(n, uMoonDir), 0.0);
  float l3diff = max(dot(n, uLight3Dir), 0.0);
  // AUDIT 39r R17: DaggerfallDefault.shader:83-85 - "Emission cancels out
  // other lights". The lit term runs on albedo.rgb - emission, NOT on
  // the raw albedo, so an auto-emissive record (whose mask IS its albedo,
  // TextureReader.cs:301-308, worn at EmissionColor = Color.white) lands
  // at exactly its albedo whatever the scene light is. Adding on top of
  // full lighting put a lantern at ~2.3x albedo outdoors. The clamp is
  // ours: a window mask can be brighter than the glass texel under it,
  // and a negative albedo has no honest meaning here.
  vec3 emission = texture(uEmissionTex, vUV).rgb * uEmissionColor;
  vec3 albedo = max(tex.rgb - emission, vec3(0.0));
  vec3 ambient = uTrilight > 0.5 ? (n.y >= 0.0 ? mix(uAmbient, uAmbientSky, n.y) : mix(uAmbient, uAmbientGround, -n.y)) : uAmbient;   // BA1: Trilight
  vec3 lit = albedo * (ambient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff)
    + uLight3Color * (uLight3Scale * l3diff));
  // Point lights (city lanterns): N.L with a squared linear falloff to the
  // range - documented equivalence to the Unity point light this replaces.
  vec3 pointAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointAcc += att * att * max(dot(n, L / max(d, 1e-4)), 0.0) * uPointColors[i];
  }
  lit += albedo * pointAcc;
  // R12: the player-following indirect point light (SunlightRig's
  // IndirectLight) - same falloff shape as the lantern lights; the
  // zeroed default color makes this a no-op in unlit scenes.
  vec3 iL = uIndirect.xyz - vWorldPos;
  float iD = length(iL);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  lit += albedo * (iAtt * iAtt * max(dot(n, iL / max(iD, 1e-4)), 0.0)) * uIndirectColor;
  // The emission (window style from getWindowColors32, or an auto-emissive
  // record's own albedo at Color.white) goes back on top of the lighting
  // its subtraction above paid for - o.Emission = emission.
  outColor = vec4(mix(uFogColor, lit + emission, fogFactorAt(vWorldPos)), 1.0);
  // A2: the Daggerfall/Automap shader's presentation, verbatim
  // (DaggerfallAutomap.shader:102-110): brightness falls with vertical
  // distance from the slice plane (floored at 40%), then the
  // RENDER_IN_GRAYSCALE variant collapses to the 0.3/0.59/0.11
  // luminance. A maxed-out slice (1e9) dims everything to the 40%
  // floor - DFU's own AlwaysMaxOutSliceLevel behavior, bug for bug.
  if (amMode > 0) {
    // c2/S6: THE WATER TINT, which both DFU passes carry and the port
    // omitted. It lands BEFORE the dim and before the mode's own
    // colour decision, so wireframe's constant overwrites it exactly as
    // the C# does (the tint is only ever visible above the slice in
    // TRANSPARENT mode - that is DFU, not an omission).
    if (vWorldPos.y <= uAutomapWaterLevel) {
      outColor.rgb = mix(outColor.rgb, uAutomapWaterColor.rgb, uAutomapWaterColor.a);
    }
    // the above-slice arms, in the C#'s own order: WIREFRAME replaces
    // the fragment outright, TRANSPARENT only rewrites the alpha.
    if (amMode >= 5) outColor = (amMode >= 6) ? vec4(0.25, 0.25, 0.25, 0.6) : vec4(0.9, 0.9, 0.7, 0.6);
    else if (amMode >= 3) outColor.a = 0.75;
    // THE ABOVE-SLICE PASS NEVER DIMS, and this expression is why:
    // DFU's second pass writes distance(min(worldPos.y, slice),
    // slice), which is IDENTICALLY ZERO for every fragment it keeps
    // (they are all above the slice, so the min IS the slice). Below
    // the slice min(y, slice) == y and this is the first pass's
    // distance(worldPos.y, slice) unchanged. One expression, both
    // passes, bug for bug - a port that dims the above-slice group is
    // wrong.
    float sliceDist = distance(min(vWorldPos.y, uClipY), uClipY);
    outColor.rgb *= 1.0 - clamp(sliceDist / 20.0, 0.0, 0.6);
    if (amMode % 2 == 0) {
      float grayValue = dot(outColor.rgb, vec3(0.3, 0.59, 0.11));
      outColor.rgb = vec3(grayValue);
    }
  }
}`;

const CHAR_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
layout(location=2) in vec3 aNormal;
// MW-D11: the OPTIONAL fourth channel. A VAO that never enables it reads
// the constant attribute, so every voxel caller draws exactly what it
// drew before - the layout is additive, not a variant.
layout(location=3) in vec2 aUV;
// MWT2: the OPTIONAL fifth channel, additive exactly as aUV is - a VAO
// that never enables it reads the constant attribute, which is zero, and
// zero emission is what every caller before this one had.
layout(location=4) in vec3 aEmissive;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vUV;
out vec3 vEmissive;
void main() {
  vColor = aColor;
  vEmissive = aEmissive;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = uProj * uView * world;
}`;

// MAC-Q (2026-09-17): THE PARTICLE QUAD, osgParticle's own (ParticleSystem
// .cpp:360-403): a camera-facing quad of half-extent `size` on the view's
// x and y axes, textured, times the particle's colour with its alpha. The
// billboard is built HERE, off the rows of the model-view rotation, so the
// stream a rig packs is view-independent and the same buffer serves the
// first-person pass and the third-person body. Unlit by construction: a
// Morrowind flame is a LightMode_Emissive material, and the reference's
// emissive arm leaves nothing but the emission (MWT2's own note) - the
// colour is the light.
const PARTICLE_VS = `#version 300 es
layout(location=0) in vec3 aCenter;
layout(location=1) in vec2 aCorner;
layout(location=2) in vec2 aUV;
layout(location=3) in vec4 aColor;
layout(location=4) in float aSize;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec2 vUV;
out vec4 vColor;
void main() {
  mat3 mv = mat3(uView * uModel);
  // the view's x and y axes, expressed in the model's space: the ROWS of the model-view rotation
  vec3 right = normalize(vec3(mv[0][0], mv[1][0], mv[2][0]));
  vec3 up = normalize(vec3(mv[0][1], mv[1][1], mv[2][1]));
  vec3 p = aCenter + (right * aCorner.x + up * aCorner.y) * aSize;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uProj * uView * uModel * vec4(p, 1.0);
}`;
const PARTICLE_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec4 vColor;
uniform sampler2D uTex;
uniform float uUseTex;
uniform float uAlphaCut;
out vec4 outColor;
void main() {
  vec4 texel = uUseTex > 0.5 ? texture(uTex, vUV) : vec4(1.0);
  vec4 c = texel * vColor;
  if (uAlphaCut > 0.0 && c.a < uAlphaCut) discard;
  outColor = c;
}`;

/** NiAlphaProperty's blend-mode index to GL (nifloader.cpp getBlendMode,
 *  :1899-1929) - the reference's table, one for one, with its own
 *  fallback of SRC_ALPHA for an index it does not know. */
export const NIF_BLEND_MODES = Object.freeze([
  'ONE', 'ZERO', 'SRC_COLOR', 'ONE_MINUS_SRC_COLOR', 'DST_COLOR', 'ONE_MINUS_DST_COLOR',
  'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'DST_ALPHA', 'ONE_MINUS_DST_ALPHA', 'SRC_ALPHA_SATURATE',
]);
export const nifBlendMode = (mode) => NIF_BLEND_MODES[mode] ?? 'SRC_ALPHA';

// Character fragment: the mesh path's lighting + fog verbatim, sampling
// the rig's vertex color instead of a texture (C4b - no alpha cutout: rig
// faces are opaque solids).
//
// MWT2 (2026-09-17, Mac: the Morrowind model's torch "isnt lit"): C4b's
// "no emission" was true of the VOXEL rigs this program was written for
// and stopped being true at MW-D11, which brought real Morrowind meshes
// through it. The reference resolves an emission per material and adds it
// INTO the lighting sum, which the texture is then multiplied by
// (lighting.glsl `... + getEmissionColor()`, objects.frag
// `gl_FragData[0].xyz *= lighting`) - and its LightMode_Emissive arm
// forces the DIFFUSE and the AMBIENT to black, so a self-illuminated
// surface has NOTHING BUT that term. Dropping it drew those surfaces
// black: a torch with a black flame, which is a stick.
const CHAR_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vUV;
in vec3 vEmissive;
uniform sampler2D uTex;
uniform float uUseTex;      // MW-D11: 0 for the voxel rigs, 1 for a textured mesh
uniform float uAlphaCut;    // 0 = opaque; above it, discard below this alpha
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;    // EV5: the second directional term - the masser
uniform float uMoonScale; // 0 = no moon (classic, indoors, daytime)
uniform vec3 uMoonColor;
uniform int uPointCount;
uniform vec4 uPointLights[16];
uniform vec3 uPointColors[16]; // LT1: per-light colour x intensity (AddLight's second switch)
uniform vec4 uIndirect;       // R12: xyz player pos, w range (0 = off)
uniform vec3 uIndirectColor;  // color x intensity x daylight scale
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${CLOUD_SHADOW_GLSL}
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
void main() {
  vec3 n = normalize(vNormal);
  // MW-D11: the texture MULTIPLIES the vertex colour, which is how a
  // Morrowind body part gets its skin - the pack writes white there for
  // a textured piece, so the product is the texel.
  vec4 texel = uUseTex > 0.5 ? texture(uTex, vUV) : vec4(1.0);
  if (uAlphaCut > 0.0 && texel.a < uAlphaCut) discard;
  vec3 albedo = vColor * texel.rgb;
  float diff = max(dot(n, uLightDir), 0.0);
  diff *= cloudShadowAt(vWorldPos);   // VC4: the cloud's shadow on the sun term
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = albedo * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff));
  vec3 pointAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointAcc += att * att * max(dot(n, L / max(d, 1e-4)), 0.0) * uPointColors[i];
  }
  lit += albedo * pointAcc;
  // R12: the player-following indirect light (see the mesh FS).
  vec3 iL = uIndirect.xyz - vWorldPos;
  float iD = length(iL);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  lit += albedo * (iAtt * iAtt * max(dot(n, iL / max(iD, 1e-4)), 0.0)) * uIndirectColor;
  // MWT2: the EMISSION, times the texel and nothing else. The reference
  // adds it into the lighting sum before the texture multiply, so an
  // emissive surface keeps its picture and owes the room nothing - which
  // is the whole of what "self-illuminated" means. It is the one term
  // above that the vertex colour does NOT gate: LightMode_Emissive has
  // already forced that colour to black.
  lit += vEmissive * texel.rgb;
  outColor = vec4(mix(uFogColor, lit, fogFactorAt(vWorldPos)), 1.0);
}`;

const BB_VS = `#version 300 es
layout(location=0) in vec3 aCenter;
layout(location=1) in vec2 aCorner;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uOrigin;
uniform vec2 uSize;
uniform vec4 uFlatWind;   // WIND3: the wind's rate x, z (m/s, the lab's rate from systems/windDrive.js), the clock, the gust
uniform float uSway;      // WIND3: this batch's share of the lean (0 = stands still)
out vec2 vUV;
out vec3 vBBWorld;
out vec3 vBBBase;   // EL2: the flat's placement base, where the lane's shadow is read for the whole sprite (the classic FS declares it not, which GLSL allows)
void main() {
  // Bottom-anchored: centre sits half a height above the placement base.
  vBBBase = aCenter + uOrigin;
  vec3 world = aCenter + uOrigin
    + uRight * (aCorner.x * uSize.x)
    + uUp * ((aCorner.y + 0.5) * uSize.y);
  // WIND3: THE FLATS LEAN WITH THE WIND. The lab's grass law (labGrass.js:
  // a steady push plus a gust that travels ACROSS the field as a wave, the
  // phase carrying the position along the wind), on the crown: the offset
  // is weighted by the height up the quad, squared, so the root stands and
  // the crown moves, and the per-flat phase keeps a wood from moving as a
  // sheet. A tree's lean is a few percent of its height at most - the
  // grass's 0.055 scaled to a trunk - and uSway is 0 for every batch that
  // is not the climate's flora, which is the shader's off switch.
  if (uSway > 0.0) {
    vec2 wv = uFlatWind.xy;
    float wl = length(wv);
    vec2 wdir = wl > 1e-4 ? wv / wl : vec2(1.0, 0.0);
    vec3 root = aCenter + uOrigin;
    float along = dot(root.xz, wdir);
    float ph = fract(root.x * 0.37 + root.z * 0.91) * 6.2832;
    float gust = sin(uFlatWind.z * 1.7 - along * 0.35 + ph) * 0.5 + 0.5;
    float push = wl * (0.55 + gust * 0.75) * 0.0015 * uSway;
    float top = aCorner.y + 0.5;
    world.xz += wdir * push * top * top * uSize.y;
  }
  vBBWorld = world;
  // Textures are bottom-up (v=0 = image bottom), so the quad top
  // (aCorner.y = +0.5) samples v = 1 - matching the mesh path's negated-V
  // convention. The previous 0.5 - aCorner.y flipped every billboard.
  vUV = vec2(aCorner.x + 0.5, aCorner.y + 0.5);
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

import { ShadowPass, SHADOW_GLSL } from './shadowPass.js';   // EL7: the receiver block, for the water surface's lane program
import { boundsOf, sphereInPlanes } from './bounds.js';
import { getPref } from '../systems/uiPrefs.js';   // GRAIN2: the ground-sharpness dial, read where the tile array is built

/**
 * GRAIN2 (2026-09-19, Mac: "Why dont we crank it to 16?"): the
 * ground-sharpness tier as a max-anisotropy value, against what the
 * driver actually allows.
 *
 * The honest answer to the question is that 4 was a conservative guess.
 * Anisotropy is paid in fill rate on the pass that covers the most
 * screen, and this session cannot measure that - its only GL is
 * SwiftShader, a software rasteriser whose cost profile is nothing like
 * a GPU's, and the "16" it reports is its own. So the number is a DIAL
 * and the default is the safe end of it, not a claim.
 *
 * `1` is the extension's own word for no anisotropy, which is why `off`
 * answers it rather than 0; an unknown tier is the default, so a stored
 * pref from a future build cannot turn the ground to mush.
 */
export function anisotropyFor(tier, driverMax = 1) {
  const cap = Math.max(1, driverMax || 1);
  if (tier === 'off') return 1;
  if (tier === 'max') return cap;
  return Math.min(4, cap);
}
import { frustumPlanes, cullDisabled } from './frustum.js';   // PERF-CROWD2: the billboard pass culls for every host, so no host can forget to
import { multiply as mat4Multiply } from '../world/mat4.js';   // PERF-CROWD2: proj * view, for this call's planes
import { PerfMeter, perfOn, perfZones, perfCpu, setMeter } from './perfMeter.js';   // EL8: `?perf`   // EL5: the bounds every bundle carries for the replays' culling   // EL2: the lane's shadow maps - a leaf that compiles nothing until a lane asks
import { AirPass, AIR_ADAPT_UNIT as ADAPT_UNIT, AIR_CONTACT_UNIT as CONTACT_UNIT } from './airPass.js';   // EL3: the ambient occlusion, the bloom and the shafts - the same kind of leaf; EL4: the eye's unit; EL6: all of it off the frame's own depth, at the resolve
import { SHADE_DARK } from '../systems/concealDraw.js';   // ECV1 / AUDIT 65 PN-3: the shade's pull toward black, interpolated into BB_FS below - the shader restated 0.12 as a second literal. The LEAF, not systems/combatVisuals.js, which re-exports it: that module's graph would take this file's closure from 13 modules to 69

const BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vBBWorld;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform int uSpectral;
uniform vec4 uConceal;  // ECV1: x mode (0 plain, 1 chameleon, 2 shade, 3 hit reveal), y opacity, z seconds, w phase
uniform vec3 uTint; // time-of-day: ambient (+ the moon's half); VC4: the sun's half rides uBBSun so a cloud's shadow can take it
uniform vec3 uBBSun;
uniform int uPointCount;
uniform vec4 uPointLights[16]; // xyz scene-space, w range
uniform vec3 uPointColors[16]; // LT1: per-light colour x intensity (AddLight's second switch)
uniform vec4 uIndirect;       // R12: xyz player pos, w range (0 = off)
uniform vec3 uIndirectColor;  // color x intensity x daylight scale
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
${CLOUD_SHADOW_GLSL}
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
void main() {
  // ECV1: a chameleoned foe ripples - a slow horizontal wobble across
  // the sprite, phased per foe - so it reads as blending in, not as a
  // faded sprite.
  vec2 uv = vUV;
  if (uConceal.x == 1.0) {
    uv.x += sin(vUV.y * 28.0 + uConceal.z * 7.0 + uConceal.w) * 0.008;
    if (uv.x < 0.0 || uv.x > 1.0) discard;   // the texture wraps REPEAT: never pull the far edge onto this one
  }
  vec4 tex = texture(uTex, uv);
  // Spectral flats keep their 180-alpha translucency (blended pass);
  // opaque flats keep the classic 0.5 cutout. ECV1's concealed pass is
  // blended too and takes the spectral threshold.
  if (tex.a < ((uSpectral == 1 || uConceal.x > 0.0) ? 0.1 : 0.5)) discard;
  // Point lights on flats: billboards have no normal, so the term is
  // attenuation-only (squared linear falloff) - documented equivalence
  // to Unity's vertex-lit billboards.
  vec3 pointAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    float d = length(uPointLights[i].xyz - vBBWorld);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointAcc += att * att * uPointColors[i];
  }
  // spectral eyes/body glow, or an auto-emissive flat's own albedo (black
  // tex otherwise). AUDIT 39r R17: DaggerfallBillboard.shader:56-58 lights
  // albedo.rgb - emission and adds the emission back - "Emission cancels
  // out other lights" - so a self-lit flat draws at exactly its albedo in
  // any light. Adding it on top of the exterior tint (~1.31 at noon) put
  // every missile, impact flash and fire daedra at ~2.3x albedo, clipped
  // to white. The clamp is ours; a negative albedo has no meaning here.
  vec3 emission = texture(uEmissionTex, uv).rgb;
  vec3 albedo = max(tex.rgb - emission, vec3(0.0));
  // R12: the indirect term, attenuation-only like the lantern term
  // (billboards have no normal).
  float iD = length(uIndirect.xyz - vBBWorld);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  vec3 lit = albedo * (uTint + uBBSun * cloudShadowAt(vBBWorld) + pointAcc + iAtt * iAtt * uIndirectColor) + emission;   // VC4
  // ECV1: a shade is its silhouette - the lit colour pulled to black;
  // every concealed draw takes the visual's opacity over the texel's.
  // AUDIT 65 PN-3: SHADE_DARK itself (keep it a decimal - GLSL will not
  // multiply a vec3 by an int literal).
  if (uConceal.x == 2.0) lit *= ${SHADE_DARK};
  if (uConceal.x == 4.0) lit = vec3(0.0);   // EOTB-IL: Eye Of The Beholder's shade - Color.black at the batch's alpha (UpdateMaterial, IL_4f69)
  float alpha = uSpectral == 1 ? tex.a : 1.0;
  if (uConceal.x > 0.0) alpha = tex.a * uConceal.y;
  outColor = vec4(mix(uFogColor, lit, fogFactorAt(vBBWorld)), alpha);
}`;

// Dungeon water: one horizontal quad per watered RDB block, drawn after
// opaque geometry with alpha blending and no depth writes. The surface
// color is a presentation choice (DFU uses a modern water prefab; classic
// used a palette-animated surface) - a classic-texture upgrade is queued.
const WATER_VS = `#version 300 es
layout(location=0) in vec2 aXZ; // unit quad 0..1
uniform mat4 uProj;
uniform mat4 uView;
uniform vec4 uRect; // x0, z0, size, y
out vec2 vWaterXZ;
out vec3 vWaterWorld;
void main() {
  vec3 world = vec3(uRect.x + aXZ.x * uRect.z, uRect.w, uRect.y + aXZ.y * uRect.z);
  vWaterXZ = world.xz;
  vWaterWorld = world;
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const WATER_FS = `#version 300 es
precision highp float;
in vec2 vWaterXZ;
in vec3 vWaterWorld;
uniform vec4 uWaterColor; // rgb tint (1,1,1 for plain classic), a = blend
uniform sampler2D uWaterTex; // classic water tile (ground record 0)
uniform float uWaterScroll; // slow classic flow, in tiles
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
void main() {
  // World xz -> classic tile UVs: 6.4 units per 64px tile, REPEAT wrap,
  // scrolled diagonally.
  vec2 uv = vWaterXZ / 6.4 + vec2(uWaterScroll);
  vec3 tex = texture(uWaterTex, uv).rgb;
  outColor = vec4(mix(uFogColor, tex * uWaterColor.rgb, fogFactorAt(vWaterWorld)), uWaterColor.a);
}`;

// Terrain tilemap pass (R9): verbatim Daggerfall/TilemapTextureArray
// decode - tileIndex = data >> 2, transform = data & 3 with the shader's
// rotation/translation tables (flip rides as 180 degrees, as shipped).
// Sampling is NEAREST without mips (repo texel convention; DFU's mip
// bias is presentation-side). Lighting matches the solid program minus
// window emission.
const TERRAIN_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vLocalXZ;
void main() {
  vNormal = mat3(uModel) * aNormal;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  vLocalXZ = aPos.xz;
  gl_Position = uProj * uView * world;
}`;

// EE5: CLOUD SHADOWS - the sky's own deck, read by the ground. The
// hash, the value noise and the fbm are the sky's TERM FOR TERM (the
// same per-octave (17.1, 9.7) offsets), so the ground reads the field
// the sky drew and not a lookalike of it. Interpolated INSIDE the
// terrain fragment shader below: the first attempt put these outside
// every shader, the terrain shader used uniforms it never declared,
// and the renderer's constructor threw on boot. A GLSL declaration is
// visible only to the compilation unit that contains it.


const TERRAIN_FS = `#version 300 es
precision highp float;
precision highp usampler2D;
precision highp sampler2DArray;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vLocalXZ;
uniform sampler2DArray uTileArr;
uniform usampler2D uTilemap;
uniform float uTileSize; // world units per tile (6.4)
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;    // EV5: the second directional term - the masser
uniform float uMoonScale; // 0 = no moon (classic, indoors, daytime)
uniform vec3 uMoonColor;
${CLOUD_SHADOW_GLSL}
uniform int uPointCount;
uniform vec4 uPointLights[16];
uniform vec3 uPointColors[16]; // LT1: per-light colour x intensity (AddLight's second switch)
uniform vec4 uIndirect;       // R12: xyz player pos, w range (0 = off)
uniform vec3 uIndirectColor;  // color x intensity x daylight scale
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
// DFU's HLSL float2x2 initializers are row-major; GLSL mat2 is
// column-major, so these are the TRANSPOSES of the shader source
// (caught in R9 build: rotated tiles sampled the wrong direction).
const mat2 ROT[4] = mat2[4](
  mat2(1.0, 0.0, 0.0, 1.0),
  mat2(0.0, -1.0, 1.0, 0.0),
  mat2(-1.0, 0.0, 0.0, -1.0),
  mat2(0.0, 1.0, -1.0, 0.0));
const vec2 TRANS[4] = vec2[4](
  vec2(0.0, 0.0), vec2(0.0, 1.0), vec2(1.0, 1.0), vec2(1.0, 0.0));
void main() {
  vec2 unwrapped = vLocalXZ / uTileSize;
  ivec2 cell = clamp(ivec2(floor(unwrapped)), ivec2(0), ivec2(127));
  uint data = texelFetch(uTilemap, cell, 0).r;
  int layer = int(data >> 2u);
  int t = int(data & 3u);
  vec2 tileUV = fract(unwrapped);
  vec2 tuv = ROT[t] * tileUV + TRANS[t];
  // GRAIN1 (2026-09-19, Mac: "distance terrian has a weird grain look"):
  // THE TILE ARRAY IS MIPMAPPED, AND THE GRADIENT IS THE UNWRAPPED ONE.
  //
  // The grain is minification aliasing: past a few tiles out a screen
  // pixel covers many texels and NEAREST picks one of them, so the ground
  // boils as the camera moves. The cure is a mipmap - and the reason
  // there was none is right here. tileUV is fract(unwrapped), so it
  // jumps 1 -> 0 at every tile edge, and texture() picks its mip from
  // the screen-space derivative of the coordinate it is handed: at each
  // of those jumps the derivative is a whole tile wide, the hardware
  // reads that as "this pixel covers the entire texture", and it samples
  // the coarsest mip. That is a blurred line drawn around all 16,384
  // tiles of every pixel - far worse than the grain.
  //
  // unwrapped does not jump. Its derivative is the true footprint, and
  // ROT[t] is constant across the fragment, so rotating it gives the
  // footprint in the rotated tile's own frame. textureGrad takes that
  // directly and the seams cannot happen. One sample either way.
  vec2 gx = ROT[t] * dFdx(unwrapped);
  vec2 gy = ROT[t] * dFdy(unwrapped);
  vec3 tex = textureGrad(uTileArr, vec3(tuv, float(layer)), gx, gy).rgb;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  // EE5: the deck's field, sampled where this ground's ray to the sun
  // crosses the cloud plane - so a bank overhead drags its shadow across
  // the land, and the shadow and the cloud that casts it are ONE field.
  // A cloud dims the SUN and leaves the ambient alone, which is what a
  // cloud does; the shadow moves with the weather (the one drift
  // integral) and with the bank overhead, which VC4 made one field.
  // uCloudShadowRect.w is 0 for the classic skin and every interior: the
  // branch does not run and classic draws exactly what it drew. VC4: the
  // shadow is the slab's own transmittance off the map, not a noise.
  diff *= cloudShadowAt(vWorldPos);
  float mdiff = max(dot(n, uMoonDir), 0.0);
  vec3 lit = tex * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff));
  vec3 pointAcc = vec3(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 L = uPointLights[i].xyz - vWorldPos;
    float d = length(L);
    float att = clamp(1.0 - d / uPointLights[i].w, 0.0, 1.0);
    pointAcc += att * att * max(dot(n, L / max(d, 1e-4)), 0.0) * uPointColors[i];
  }
  lit += tex * pointAcc;
  // R12: the player-following indirect light (see the mesh FS).
  vec3 iL = uIndirect.xyz - vWorldPos;
  float iD = length(iL);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  lit += tex * (iAtt * iAtt * max(dot(n, iL / max(iD, 1e-4)), 0.0)) * uIndirectColor;
  outColor = vec4(mix(uFogColor, lit, fogFactorAt(vWorldPos)), 1.0);
}`;

const ZERO_CONTACT = new Float32Array(4);   // EL8: the contact params with the air off
const ZERO_ORIGIN = [0, 0, 0];
/** AUDIT-EL F5: what a WORLD host passes beginFrame - the lane replays its records for this frame and not for a map's, a video's or a menu's. */
export const WORLD_FRAME = Object.freeze({ world: true });
/** The classic world programs' point-light cap (uPointLights[16] in every shader above); a lane brings its own. */
const CLASSIC_MAX_LIGHTS = 16;
const ZERO_FLAT_WIND = new Float32Array(4);   // WIND3: a bare prototype (the crash-report tests) has no wind
// MaterialReader.cs:448-453: the auto-emissive arm's EmissionColor.
const EMISSION_WHITE = new Float32Array([1, 1, 1]);

/** THE CHARACTER PIXELIZE STANDARD (Mac): characters and everything
 *  character-side render at this pixel size; the WORLD is excluded.
 *  9 -> 7 per Mac (2026-07-06). Single source - the engine character
 *  pass and the viewer default both read this value. */
import { TextureFile } from '../formats/textureFile.js';
const isSpectralArchive = TextureFile.isSpectralArchive;   // single source (the formats layer owns the archive list)

export const CHAR_PIXEL = 9;

/** The shared character-sprite render target's fixed edge (the pass
 *  clamps pw/ph to this; sprites render into a viewport sub-rect). */
/** PX23: THE STUDIO. The light state a UI read-back of a character or
 *  an item is drawn under - a bright even ambient and a key light that
 *  sits AT the eye (the shader takes uLightDir as the direction TOWARD
 *  the light; a view matrix's third row is the camera's back vector in
 *  world space, i.e. toward the eye). No point lights, no indirect:
 *  nothing from the world the panel happens to be open in. Tunable by
 *  eye - AMBIENT and KEY are the two dials. */
export const STUDIO_AMBIENT = 0.6;
export const STUDIO_KEY = 0.7;
export function studioLight(view) {
  const back = [view[2], view[6], view[10]];
  const bl = Math.hypot(back[0], back[1], back[2]) || 1;
  return {
    lightDir: new Float32Array([back[0] / bl, back[1] / bl, back[2] / bl]),
    ambient: new Float32Array([STUDIO_AMBIENT, STUDIO_AMBIENT, STUDIO_AMBIENT]),
    sunScale: STUDIO_KEY,
    sunColor: new Float32Array([1, 1, 1]),
    pointLights: new Float32Array(0),
    indirect: new Float32Array([0, 0, 0, 0]),
  };
}
export const CHAR_SPRITE_RT_SIZE = 1024;   // raised for the FP viewmodel frame (E3d), and again at MW-D43 for MW_ARM_PIXEL

/** MW-D43 (Mac: the first person and third person views are extremely
 *  pixelized): THE MORROWIND ARM IS NOT A SPRITE, and CHAR_PIXEL is
 *  the SPRITE standard. Nine is Mac's locked look for Daggerfall's 2D
 *  characters, whose source art is already chunky - running a
 *  Morrowind MESH through the same dial throws away detail that was
 *  there, which is what "extremely pixelized" is. Its own dial, so the
 *  sprite standard stays exactly where he put it (9 -> 12 -> 9 over
 *  three revisions; the comment above CHAR_PIXEL still describes the
 *  first of those and is stale, left alone here rather than edited on
 *  the way past). TUNABLE BY EYE, like STUDIO_AMBIENT and STUDIO_KEY -
 *  raise it toward 9 for chunkier arms, drop it toward 1 for none. */
export const MW_ARM_PIXEL = 3;

/**
 * AUDIT 19 F6: the smooth/blend opt-ins used to be pinned by SOURCE REGEX,
 * which cannot see whether a computed value is USED - and a regex pin let a
 * completely dead memo ship in music.js the same day. The DECISIONS are pure,
 * so they live here and are pinned behaviourally; the GL calls that consume
 * them are the only part the suite cannot reach.
 *
 * REPEAT/NEAREST is the law for GAME art: classic textures tile, and NEAREST
 * keeps a 320x200 IMG pixel-exact at the integer scales nativePanel picks.
 * { smooth: true } is for art authored outside that world - a high-resolution
 * banner at a NON-integer scale, where NEAREST aliases and REPEAT lets a
 * linear tap at the border sample the opposite edge.
 */
/** A typed array as the BYTES it actually spans - offset and length
 *  respected. `new Uint8Array(view.buffer)` silently ignores both. */
export function asBytes(view) {
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

/** WW3 (2026-09-14, Mac's live crash): the upload path's ONE contract,
 *  said out loud. Every image that reaches the GL here is in the port's
 *  color32 shape - `{ width, height, colors }` (formats/color32Order.js
 *  toColor32) - and a door that hands a decoded PNG's `{ width, height,
 *  data }` instead used to die three frames down inside `asBytes` with
 *  `can't access property "buffer"`, naming neither the caller nor the
 *  texture. It throws HERE now, with the key and the cure in the
 *  sentence; the behaviour is unchanged (it threw before and it throws
 *  now), only what the console says. */
export function color32Bytes(color32, where) {
  if (!color32?.colors) {
    const shape = color32 ? `{ ${Object.keys(color32).map((k) => (k === 'colors' ? 'colors: undefined' : k)).join(', ')} }` : String(color32);
    throw new Error(`${where}: the image carries no \`colors\` (got ${shape}) - a decoded PNG's { width, height, data } crosses toColor32 (formats/color32Order.js) on the way in`);
  }
  return asBytes(color32.colors);
}

/** The two clear colours: the sky behind an exterior frame, and
 *  CameraClearManager's black behind an interior one. */
/** MAC-I: the floor under `flatLightAt`. A flat in a black room goes
 *  black and the player reads that as the room; a HAND that goes black
 *  is a hole in the middle of the screen, and the player cannot tell a
 *  drawn weapon from a sheathed one. DFU never faces this because it
 *  never tints the viewmodel at all - so the number is the port's, and
 *  it is written here rather than inline: a quarter of the sprite's own
 *  albedo, which is dark enough to read as unlit and bright enough to
 *  keep a silhouette.
 */
export const FLAT_LIGHT_FLOOR = 0.25;

export const SKY_CLEAR = Object.freeze([0.53, 0.7, 0.92, 1.0]);
export const INTERIOR_CLEAR = Object.freeze([0, 0, 0, 1.0]);

/** AUDIT 65 RS-3: the texture unit the cloud-shadow map is RESERVED on
 *  (_uploadCloudShadow). It used to be 7, which is also where the
 *  Dynamic Skies pass lands `_MoonTex`: that mod binds its nine
 *  TEXTURE_SLOTS as `TEXTURE0 + i` (dynamicSkiesRenderer.js:865-872,
 *  over systems/dynamicSkies.js:432-435's nine names),
 *  so unit 7 was written by a foreign pass while the renderer's
 *  per-program stamp still said the shadow map was there. 15 sits
 *  above the mod's nine and above every other pass in the tree (none
 *  goes past unit 3), and WebGL2 guarantees
 *  MAX_TEXTURE_IMAGE_UNITS >= 16, so 15 always exists. The shaders
 *  bind it by uniform name, so the number lives only here. */
export const CLOUD_SHADOW_UNIT = 15;

export function textureParams(gl, opts = {}) {
  return opts.smooth
    ? { wrap: gl.CLAMP_TO_EDGE, filter: gl.LINEAR }
    : { wrap: gl.REPEAT, filter: gl.NEAREST };
}

/**
 * Does this screen quad blend? A SOLID quad blends when it carries alpha
 * (U10: sixteen translucent UI panels were drawing opaque). A TEXTURED quad
 * takes the 1-bit cutout unless the caller opts in - classic art IS a 1-bit
 * cutout, and only ui/titleScreen.js asks for anything else.
 */
export function screenQuadBlends(tex, color, opts = {}) {
  return (!tex && color[3] < 1) || Boolean(tex && opts.blend);
}

/** setFog takes a STRING mode and shadows an int; the panel bracket
 *  has to spell the round trip. */
const FOG_MODE_NAMES = ['off', 'linear', 'exp', 'exp2'];   // DS1: 3 = Unity's ExponentialSquared

/**
 * ROAD-C c2/S2: Unity's DEFAULT camera background, which is what
 * `cameraAutomap` clears to - `clearFlags = SolidColor`
 * (Automap.cs:2012) with `backgroundColor` never assigned anywhere in
 * the file. (49, 77, 121, 5) / 255. The ALPHA IS THE POINT: at 5/255
 * the automap's render texture is ~98% transparent over empty map
 * space, which is how AMAP00I0's map-area art and the three
 * alternative backgrounds show through. Clear this to opaque black
 * and that whole feature disappears with no error anywhere.
 */
export const PANEL_CLEAR_RGBA = Object.freeze([49 / 255, 77 / 255, 121 / 255, 5 / 255]);

// c2/S6: the automap's water tint is UnderwaterFog's, not the shader's -
// see AUTOMAP_WATER_COLOR below for the seam DFU reads it across.
import { WATER_MAP_COLOR } from './underwaterFog.js';
import { WATER_SURFACE_VS, waterSurfaceFs } from './waterSurface.js';   // WATER1: the enhanced water pass over the terrain grid
import { packWaterMask, WATER_DRAW_MASK_TABLE } from '../world/waterCorners.js';   // MAC2: the corner table's one home; WATER-DRAW1: the PASS takes the draw's table, not the feet's

/** The automap render panel, DFU's own rect on the 320x200 native
 *  screen (DaggerfallAutomapWindow's dummyPanelRenderAutomap /
 *  ExteriorAutomap's panelRenderAutomap: 1, 1, 318, 169). */
export const AUTOMAP_PANEL_NATIVE_RECT = Object.freeze({ x: 1, y: 1, w: 318, h: 169 });

/**
 * ROAD-C c2/S6: THE SIX AUTOMAP PRESENTATIONS, which are DFU's two
 * SubShader passes crossed with the RENDER_IN_GRAYSCALE keyword
 * (Assets/Shaders/DaggerfallAutomap.shader). `Cutout` is deliberately
 * NOT a mode: DFU's cutout arm is `clip(-1.0)` in the second pass -
 * i.e. "draw the above-slice group not at all" - so the port answers it
 * by not issuing that group.
 */
export const AUTOMAP_MODE = Object.freeze({
  OFF: 0,
  BELOW_COLOUR: 1,
  BELOW_GRAY: 2,
  ABOVE_TRANSPARENT_COLOUR: 3,
  ABOVE_TRANSPARENT_GRAY: 4,
  ABOVE_WIREFRAME_COLOUR: 5,
  ABOVE_WIREFRAME_GRAY: 6,
});

/** `_WaterLevel`'s property default (the shader's own): a level no
 *  dungeon floor reaches, so a dry block tints nothing. AddWater
 *  (Automap.cs:1982-1988) returns without touching a renderer when the
 *  native level is 10000, which leaves exactly this value in place. */
export const AUTOMAP_NO_WATER = -10000;
/** `_WaterColor` AS THE AUTOMAP MATERIAL ACTUALLY CARRIES IT, which is
 *  NOT the shader's property default. DaggerfallAutomap.shader:27
 *  declares `_WaterColor = (0.0,0.3,0.5,0.4)`, but that value is dead:
 *  Automap.cs:2589-2590 mints the ONE automap material and immediately
 *  does `automapMaterial.SetColor("_WaterColor",
 *  PlayerEnterExit.UnderwaterFog.waterMapColor)` before the injection
 *  event is raised, and AutomapModel.cs:83 `Instantiate(automapMaterial)`
 *  copies that material onto every automap submesh - so every flooded
 *  fragment in the game lerps toward waterMapColor. AddWater
 *  (:1982-2001) sets only `_WaterLevel` and never touches the colour.
 *  ONE SOURCE OF TRUTH: the number lives in underwaterFog.js, where DFU
 *  keeps it (UnderwaterFog.cs:28, its only assignment in the tree), and
 *  the automap reads it off that object rather than re-declaring it. */
export const AUTOMAP_WATER_COLOR = WATER_MAP_COLOR;

/**
 * ROAD-C c2/S6: TRIANGLE INDICES -> LINE INDICES, the pure half of the
 * wireframe substitution (see the drawMeshWire header for what it
 * stands in for and what the loss is).
 *
 * THREE EDGES PER TRIANGLE, and a shared edge therefore appears TWICE -
 * which is not waste, it is the fidelity: DFU's geometry shader computes
 * per-triangle barycentrics, so it too draws every triangle's own three
 * edges independently and shows the quad diagonals. De-duplicating
 * edges would make the port's wireframe *cleaner than the original*.
 *
 * The ranges come out per sub-mesh, in the sub-mesh order, so the line
 * draw can bind exactly the textures the triangle draw does (and so the
 * albedo alpha cutout that gates every fragment of this shader gates
 * the lines identically).
 */
export function buildWireIndices(triIndices, subMeshes) {
  let total = 0;
  for (const sm of subMeshes) total += sm.primitiveCount * 6;
  const indices = new Uint32Array(total);
  const ranges = [];
  let w = 0;
  for (const sm of subMeshes) {
    const start = w;
    for (let t = 0; t < sm.primitiveCount; t++) {
      const b = sm.startIndex + t * 3;
      const i0 = triIndices[b], i1 = triIndices[b + 1], i2 = triIndices[b + 2];
      indices[w++] = i0; indices[w++] = i1;
      indices[w++] = i1; indices[w++] = i2;
      indices[w++] = i2; indices[w++] = i0;
    }
    ranges.push({ start, count: w - start });
  }
  return { indices, ranges };
}

export class Renderer {
  // HARD3: two fields this class mints LAZILY, with `??=` at their point
  // of use, and so never declares anywhere a reader or a checker can see
  // them. Both are scratch the draw path reuses rather than reallocates;
  // declaring them costs nothing at runtime (the `??=` still does the
  // minting) and means a typo at either use site is an error instead of a
  // second, permanently-empty field.
  /** the billboard pass's reused opaque list, sorted per frame and emptied after (never a frame's allocation) */
  /** @type {Array<any>|null} */ _bbOpaque = null;
  /** _warnMissingMesh's one-warning-per-shape memory */
  /** @type {Set<string>|null} */ _missingMeshes = null;

  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl) throw new Error('WebGL2 required');
    this.gl = gl;

    // EL1: THE WORLD PROGRAM SET - mesh, character, billboard, terrain -
    // is BUILT as a unit and INSTALLED as a unit, because the Enhanced
    // Lighting lane (render/enhancedLighting.js) replaces all four
    // fragment shaders at once (setLightingLane). The classic set is
    // built here and is all a classic page ever compiles.
    this._csLoc = {};   // EE5 / VC4: the cloud shadow map's uniforms, one pair per program that lights by the sun (the water pair joins below)
    this._lane = null;       // the installed lane, or null for classic
    this._laneSet = null;    // the lane's compiled set, kept across a swap back and forth
    this._exposure = 1;      // the lane's exposure (EL1); inert on the classic set
    this._shadows = null;    // EL2: the ShadowPass while a lane that asks for shadows is installed
    this._shadowPass = null; // ...built once and kept across swaps, like the lane's programs
    this._air = null;        // EL3: the AirPass while a lane that asks for it is installed AND the page's door is open
    this._airPass = null;
    this._airWanted = false;
    this._frameFbo = null;   // EL4: the frame image the world pass draws into while the air is on (null = the canvas)
    this._spriteDepth = 0;   // AUDIT-EL F2: inside renderCharacterSprite (a foreign rect: no AO)
    this._panelLane = null;  // AUDIT-EL F7: the lane a panel bracket suspended
    this._studioDepth = 0;   // AUDIT-EL F1: inside the studio bake (a UI picture: no eye)
    this._adaptOneTex = null;
    this.maxPointLights = CLASSIC_MAX_LIGHTS;
    this._decA = new Float32Array(3); this._decB = new Float32Array(3);   // EL1: the decode scratch (two, for the billboard tint's two terms)
    this._pointColorDec = new Float32Array(CLASSIC_MAX_LIGHTS * 3);
    this._classicSet = this._buildWorldSet({ key: 'classic', meshFs: FS, bbFs: BB_FS, terrainFs: TERRAIN_FS, charFs: CHAR_FS });
    this._installWorldSet(this._classicSet);
    this._ambientTri = null;

    this.textures = new Map(); // "archive_record" -> WebGLTexture
    this.emissionTextures = new Map(); // "archive_record" -> window mask
    // AUDIT 39 F49: keys whose emission map is the AUTO-EMISSIVE albedo
    // (MaterialReader.cs:448-453 - EmissionColor = Color.white), not a
    // window mask wearing the active window style. The billboard shader
    // already reads its mask untinted, which IS white; the mesh path
    // multiplies by uEmissionColor, so it needs the distinction.
    this.emissionWhite = new Set();
    // The value last uploaded to the solid program's uEmissionColor
    // (uniforms are program state, so this survives a program switch).
    this._emissionColorUp = null;
    this._forgetTextureShadows();   // AUDIT-AIR1: nothing is bound yet, so nothing may be claimed
    // EV2: the sub-mesh texture cache's generation. drawMesh used to
    // mint a `${archive}_${record}` string per sub-mesh per frame -
    // thousands of short-lived strings a frame, the render loop's
    // single largest GC source. Sub-meshes now cache their resolved
    // textures, stamped with this generation AND the texRemap object
    // identity; any texture or emission upload bumps it, so a texture
    // that streams in later is re-looked-up rather than staying a
    // cached miss.
    this._texGen = 1;
    // EV2: per-frame draw statistics, reset in beginFrame. Integer
    // increments only - cheap enough to keep on always, so probes and
    // the __renderer surface can measure a real frame (the EV arc's
    // "land wins against numbers" doctrine).
    // AUDIT 39 F50: EVERY pass counts, not drawMesh alone - the terrain,
    // water, billboard, character, sprite-quad and screen-quad draws
    // were invisible here, which made the counter blind to exactly the
    // terrain culling it exists to measure. texBinds counts the binds a
    // DRAW pays; upload-time binds are creation cost, not frame cost.
    this.stats = { draws: 0, programBinds: 0, vaoBinds: 0, texBinds: 0, bbCulled: 0 };   // PERF-CROWD2: the billboards this frame did NOT submit
    this._perf = perfOn() ? setMeter(gl, new PerfMeter(gl, perfZones(), perfCpu())) : null;   // EL8: `?perf` - a GPU-timed line every PERF_EVERY world frames; VC6d: `?perf=zones` per pass, and the meter is findable by its context (the sky's march marks its own span); PERF-CPU: `?perf=cpu` tiles the same zones on the MAIN THREAD's clock, which is the one a script-bound frame is losing
    this._frameStamp = 0;      // PERF3: bumped by beginFrame (and the state restores) - the terrain program's frame-constant block is uploaded once per stamp
    // PERF-CROWD2 (2026-09-19): THE BILLBOARD PASS CULLS, so that no host
    // has to remember to. PERF-ON2 found the peers submitted uncut and
    // PERF-CROWD found the whole town beside them - and then the same
    // shape turned up in every other host: the dungeon's mobiles, drops
    // and spells, the interior's flats, the fixed city's townspeople, and
    // worldModes' five separate lists (blood, torches, drops, foes,
    // guards), each its own uncut call. Fixing seven call sites leaves an
    // eighth to be written next year. The test belongs here.
    /** GRAIN1: the anisotropy extension and its ceiling, fetched once -
     *  not once an archive. null when the driver has neither. */
    this._anisoExt = null;
    this._anisoMax = 0;
    this._bbPlanes = new Float32Array(24);
    this._bbPv = new Float32Array(16);
    this._bbCullOff = cullDisabled();   // the ?cull=off door, read once
    this._tFrameStamp = -1;
    this._windowEmission = new Float32Array([0, 0, 0]);
    this._pointLights = new Float32Array(0); // vec4 per light [x,y,z,range]
    this._flashLight = null;   // DS1: the storm's flash, composed in by setFlashLight
    this._flashLightScratch = new Float32Array(CLASSIC_MAX_LIGHTS * 4);
    this._flashColorScratch = new Float32Array(CLASSIC_MAX_LIGHTS * 3);
    this._flashCarriedScratch = new Uint8Array(CLASSIC_MAX_LIGHTS);   // MAC-T1: the carried mask under the flash
    this._pointCarried = null;   // MAC-T1: per-light, 1 for the light in the player's hand (withPlayerLights' mask), else null
    this._pointColor = new Float32Array([1, 1, 1]);
    // LT1: per-light colour x intensity (vec3 per light). null = every
    // light wears the shared _pointColor - the exterior lantern path,
    // bit-identical to the pre-LT1 scalar channel.
    this._pointColors = null;
    this._pointColorScratch = new Float32Array(CLASSIC_MAX_LIGHTS * 3);
    // R12: the player-following indirect light - zeroed = off (the
    // shader term contributes nothing), so unlit scenes stay exact.
    this._indirect = new Float32Array([0, 0, 0, 0]);
    this._indirectColor = new Float32Array([0, 0, 0]);
    this._fogMode = 0;
    this._fogDensity = 0;
    this._fogRange = new Float32Array([0, 1]);
    this._fogColor = new Float32Array([0, 0, 0]);
    this._camPos = new Float32Array(3);
    this._clipY = 1e9;   // A1: the automap slice, off by default
    this._automapMode = 0;   // A2/c2-S6: 0 off, 1/2 below-slice, 3/4 above-slice transparent, 5/6 above-slice wireframe
    // c2/S6: the automap water tint. _WaterLevel starts at the shader's
    // own property default, -10000.0 (below every dungeon floor, so a
    // dry block tints nothing); _WaterColor starts at the value
    // Automap.cs:2590 injects into the automap material, which is what
    // every automap fragment in DFU actually lerps toward.
    this._automapWaterLevel = AUTOMAP_NO_WATER;
    this._automapWaterColor = new Float32Array(AUTOMAP_WATER_COLOR);
    // Defaults reproduce the pre-R5 fixed lighting (0.45 + 0.55 * diff).
    this._ambient = new Float32Array([0.45, 0.45, 0.45]);
    this._sunScale = 0.55;
    this._sunColor = new Float32Array([1, 1, 1]);
    // EV5: the moon term defaults OFF - scale 0 is a no-op in every
    // shader, so classic scenes, interiors and dungeons (which never
    // call setMoonlight) keep DFU's hard-off night to the byte.
    this._moonDir = new Float32Array([0, 1, 0]);
    this._moonScale = 0;
    this._moonColor = new Float32Array([1, 1, 1]);
    // ROAD-C c2: the third directional term defaults off the same way -
    // the automap beacon group is the one pass that ever raises it.
    this._light3Dir = new Float32Array([0, 1, 0]);
    this._light3Scale = 0;
    this._light3Color = new Float32Array([1, 1, 1]);
    // Billboards stay full-bright until a scene installs the clock via
    // setLighting - the solid defaults above reproduce the pre-R5 solid
    // shading, but 0.45 + 0.55 * 0.5 would silently dim flats to 72.5%
    // in the clockless scenes (caught in the R5 audit: dungeon vine).
    this._clockLit = false;
    // 1x1 black bound for every non-window submesh (branchless shader).
    this._blackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._blackTex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    this._csStamp = 0; this._csUploaded = {}; this._csRect = new Float32Array(4);
    this.tileArrays = new Map(); // archive -> TEXTURE_2D_ARRAY
    /** EE5: the cloud deck the ground shadows under, handed over by the
     *  host from the SKY's own state. Null = no shadows, which is the
     *  classic skin and every interior. */
    this._cloudShadow = null;
    this._deckOwed = null;   // VC6c: the deck a frame still owed an image is kept across beginFrame's clear
    // EV4: one shared index buffer PER INDEX SET, keyed by the array's
    // identity - the world host shares one full-grid array across every
    // pixel and one strided far-ring array across the LOD ring. The old
    // single-buffer cache silently drew every later surface with the
    // FIRST set ever uploaded, which was invisibly correct only while
    // exactly one set existed.
    this._terrainIndexSets = new Map(); // indices array -> { buffer, count }

    this.waterProgram = this._buildProgram(WATER_VS, WATER_FS);
    // WATER1: the exterior water surface - the terrain grid drawn again,
    // lifted, every non-water texel discarded (render/waterSurface.js).
    this.waterSurfaceProgram = this._buildProgram(WATER_SURFACE_VS, waterSurfaceFs(CLOUD_SHADOW_GLSL));
    this.waterSurfaceProgramLane = null; this._wsLane = null;   // EL7: built with the lane
    this._ws = this._waterLocs(this.waterSurfaceProgram);
    this._waterSurfaceFog = this._ws.fog;
    this._csLoc.water = this._ws.cloud;
    this._waterFog = {
      fogColor: gl.getUniformLocation(this.waterProgram, 'uFogColor'),
      fogMode: gl.getUniformLocation(this.waterProgram, 'uFogMode'),
      fogDensity: gl.getUniformLocation(this.waterProgram, 'uFogDensity'),
      fogRange: gl.getUniformLocation(this.waterProgram, 'uFogRange'),
      camPos: gl.getUniformLocation(this.waterProgram, 'uCamPos'),
    };
    this.waterUProj = gl.getUniformLocation(this.waterProgram, 'uProj');
    this.waterUView = gl.getUniformLocation(this.waterProgram, 'uView');
    this.waterURect = gl.getUniformLocation(this.waterProgram, 'uRect');
    this.waterUTex = gl.getUniformLocation(this.waterProgram, 'uWaterTex');
    this.waterUScroll = gl.getUniformLocation(this.waterProgram, 'uWaterScroll');
    this.waterUColor = gl.getUniformLocation(this.waterProgram, 'uWaterColor');
    {
      // Shared unit XZ quad for water planes.
      this.waterVao = gl.createVertexArray();
      this._bindVao(this.waterVao);
      const vb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      this._bindVao(null);
    }
    this._flatWind = new Float32Array(4);   // WIND3: rate x, z, clock, gust - zero until an exterior host sets it, and zero is still
    this._proj = null;
    this._view = null;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    // HANDEDNESS (mat4's law): the projection mirrors NDC x, which
    // flips every triangle's SCREEN winding - the world meshes' front
    // faces now arrive clockwise. Only the world passes (models,
    // terrain) may draw with culling ON; EVERY pass that does not ride
    // the mirrored projection MUST bracket CULL_FACE off around its
    // draw - the screen-quad (2D UI) and sky passes learned that the
    // hard way (the sky-blue-screen regression; tools/cullProbe.mjs).
    gl.frontFace(gl.CW);
    gl.clearColor(0.53, 0.7, 0.92, 1.0); // pale Iliac Bay sky
    // EV6: the JS shadow of that clear colour - the sprite pass used
    // to gl.getParameter(COLOR_CLEAR_VALUE) it back, a synchronous
    // driver query per sprite frame (the class EV2 killed in
    // precipitation). Every borrower restores what it took, so the
    // shadow stays true.
    this._clearColor = new Float32Array([0.53, 0.7, 0.92, 1.0]);
    // EV6: GL STATE SHADOWS. Every program bind and VAO bind in this
    // file funnels through _use/_bindVao, which skip the call when the
    // shadow says it is already bound - a city frame ran ~1045
    // useProgram calls for a handful of distinct programs. The shadows
    // reset at beginFrame and at markForeignPass (the four passes
    // that change programs behind the renderer's back: both skies,
    // precipitation, and the lab's grass since GR1; the overworld map's
    // went with the relief map in MAP1 - the R9
    // law's other half: an entry point may only trust a binding it can
    // account for).
    this._lastProgram = null;
    this._lastVao = null;
    // ROAD-E E5: the WORLD PASS's viewport (ViewportChanger.cs:52-67).
    // `_worldViewportPending` is the normalized rect the NEXT
    // beginFrame will take, `_worldViewportPx` the pixel rect it
    // actually set - null in both slots is the full canvas, which is
    // DFU's own `standardViewportRect = new Rect(0, 0, 1, 1)`.
    this._worldViewportPending = null;
    this._worldViewportPx = null;
  }

  /**
   * ROAD-E E5 - the docked large HUD SHRINKS the world pass instead of
   * covering it. ViewportChanger.Update (:52-67) sets the game
   * camera's rect every frame from the HUD's height; this is that
   * rect, in Unity's own normalized BOTTOM-LEFT space, which is also
   * gl.viewport's - so `{ x: 0, y: hudHeight, w: 1, h: 1 - hudHeight }`
   * ports digit for digit (ui/hudLarge.js owns the arithmetic).
   *
   * CONSUMED BY THE NEXT beginFrame, exactly as DFU recomputes the
   * rect every frame ("Check size every frame as HUD height can
   * change"). A host that does not set one gets the standard viewport,
   * so a menu, the video player or the travel map can never inherit a
   * world frame's shrunk rect - the EV6 law: the renderer owns GL
   * state, and state it owns must not leak between scenes.
   */
  setWorldViewport(rect) {
    this._worldViewportPending = rect && (rect.x !== 0 || rect.y !== 0 || rect.w !== 1 || rect.h !== 1)
      ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h } : null;
  }

  /** The pixel rect the frame's world pass is drawing into, or null
   *  for the full canvas. */
  get worldViewportPx() { return this._worldViewportPx ? [...this._worldViewportPx] : null; }

  /** gl.viewport back to whatever this frame's world pass owns - the
   *  reduced rect if one is live, the full canvas otherwise. The
   *  borrow-and-return shape the sprite RT already uses for the clear
   *  colour. */
  _restoreWorldViewport() {
    const gl = this.gl, p = this._worldViewportPx;
    if (p) gl.viewport(p[0], p[1], p[2], p[3]);
    else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  /**
   * The 2D passes need the FULL canvas back: drawScreenQuad lays out
   * in canvas pixels, so a reduced viewport would squash the HUD into
   * the strip the world just drew into. Idempotent, and called by
   * drawScreenQuad itself, so no host has to remember it - the bar,
   * the viewmodel and every window land at their own scale whatever
   * the world pass did.
   */
  endWorldPass() {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    if (!this._worldViewportPx) return;
    this._forgetTextureShadows();   // PERF-TEX: the 2D path and the post passes own the units past here, and this is the 2D pass's own door
    this._worldViewportPx = null;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** PERF-TEX: bind `tex` to unit 1 - the emission map - unless the
   *  shadow says it already is, and leave unit 0 active, which every
   *  draw path expects on entry and on exit. EV6's `_use`, for a
   *  texture unit.
   *
   *  WHY IT IS FREE. `_evEmis` is `_blackTex` for everything that is not
   *  a window or an auto-emissive record, so the mesh loop was binding
   *  the texture already on the unit for all but a handful of the
   *  scene's sub-meshes: measured over the batched static path, HALF of
   *  every bindTexture in it - 239 of 481 over 240 draws - set a unit to
   *  what it already held. Binding a texture that is already bound is a
   *  no-op by definition, so removing it cannot move a pixel; this is
   *  not a quality trade, it is deleted work. `drawBillboards` has
   *  skipped it on `lastKey` since it was written - this is the same
   *  skip, shared, so the two paths cannot disagree about the unit.
   *
   *  The shadow is cleared wherever something else may own unit 1 or
   *  leave another unit active: the frame's start, the world/2D bracket,
   *  a texture upload, and a context rebuild. */
  _bindEmission(tex) {
    if (this._tex1Bound === tex) return;
    const gl = this.gl;
    this._activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._activeTexture(gl.TEXTURE0);
    this._tex1Bound = tex;
    this.stats.texBinds++;
  }

  /** PERF-TEX3: THE UNIT THAT WAS ALREADY ACTIVE.
   *
   *  Measured over a frame of 25 loose models, 3 batched meshes and a
   *  hundred-odd HUD quads: **97% of every `activeTexture` call set the
   *  unit that was already selected** (117 of 121). It is not an
   *  accident - every path in this file that reaches for a unit above 0
   *  puts unit 0 back the moment it is done (`_bindEmission`, the
   *  contact and adapt uploads, the cloud-shadow slot, the terrain's
   *  tilemap), so unit 0 is what is active almost always, and almost
   *  every call re-selects it.
   *
   *  `activeTexture` is a pure selector - it has no effect but to say
   *  which unit the next `bindTexture` means - so this shadow cannot
   *  change a picture on its own. What it CAN do is go stale, which is
   *  why the funnel law (`test/glstate.test.js`) allows exactly one raw
   *  `gl.activeTexture` in this file, inside here. */
  _activeTexture(unit) {
    if (this._activeUnit === unit) return;
    this.gl.activeTexture(unit);
    this._activeUnit = unit;
  }

  /** PERF-TEX3: THE TEXTURE THAT WAS ALREADY ON UNIT 0 - `_bindEmission`
   *  for the unit every pass shares. 55% of the frame's `bindTexture`
   *  calls re-bound the texture already on the unit: a mesh bundle whose
   *  sub-meshes repeat an archive, and a HUD drawing ninety quads off
   *  one sheet.
   *
   *  Cleared wherever something else may own unit 0 - the same points
   *  `_tex1Bound` is cleared at, and for the same reason: a shadow that
   *  speaks for a unit it no longer owns is a WRONG TEXTURE, which is
   *  the one thing a performance change may never cost. */
  _bindTex0(tex) {
    if (this._tex0Bound === tex) return;
    this._activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this._tex0Bound = tex;
    this.stats.texBinds++;
  }

  /** EV6: bind `program` unless the shadow says it already is. */
  _use(program) {
    if (this._lastProgram === program) return;
    this.gl.useProgram(program);
    this._lastProgram = program;
    this.stats.programBinds++;
  }

  /** EV6: bind `vao` (or null) unless the shadow says it already is. */
  /**
   * PERF-CROWD2: is this billboard batch inside the frame?
   *
   * The batch's own sphere (`createBillboardBatch` stores one over the
   * placement points with the sprite's half-diagonal added), offset by
   * its live origin and LIFTED half a height - because the billboard VS
   * is bottom-anchored (`uUp * ((aCorner.y + 0.5) * uSize.y)`), so a
   * sprite stands its full height above its placement point and the
   * stored sphere does not reach the top of anything taller than it is
   * wide. A person is exactly that shape; without the lift this culls
   * heads at the top of the screen.
   *
   * A batch with no bounds is always drawn, as `batchVisible` has it.
   */
  _bbVisible(b) {
    const s = b.bounds;
    if (!s) return true;
    const o = b.origin;
    return sphereInPlanes(this._bbPlanes,
      s[0] + (o ? o[0] : 0), s[1] + (o ? o[1] : 0) + (b.size?.h ?? 0) * 0.5, s[2] + (o ? o[2] : 0), s[3]);
  }

  _bindVao(vao) {
    if (this._lastVao === vao) return;
    this.gl.bindVertexArray(vao);
    this._lastVao = vao;
    if (vao) this.stats.vaoBinds++;
  }

  /** EV6: a pass outside this renderer (the skies, precipitation) has
   *  changed program/VAO state behind the shadows' back - forget them
   *  and unbind the VAO for real, so the next entry point rebinds.
   *  AUDIT 65 RS-3: the cloud-shadow upload stamps go with them. A
   *  foreign pass may have moved any TEXTURE UNIT - the Dynamic Skies
   *  pass binds nine of them - and `_csUploaded` is the same kind of
   *  claim as `_lastProgram`: a binding this renderer can account for.
   *  Across this seam it cannot, so it forgets and re-uploads. The
   *  cost is one upload per program key per seam; no draw, program or
   *  VAO count moves. */
  markForeignPass() {
    // PERF-2D: THE ONE GAP THIS CHANGE CANNOT GUARD, MADE LOUD.
    //
    // Every path inside this file closes the 2D run before it needs the
    // baseline, and `test/glstate.test.js` reads that law out of the
    // source. The SKY, the rain, the wisps, the sand and the grass are
    // not inside this file: the hosts hand them `renderer.gl` at
    // construction and call `draw` on them directly, so nothing here can
    // stand in front of those. They assume the baseline - precipitation's
    // draw, for one, sets BLEND and depthMask and never touches
    // DEPTH_TEST, so an open run would give it rain that draws through
    // walls.
    //
    // Today they cannot collide: in both hosts every foreign pass runs in
    // the world section and the first screen quad is what ENDS it
    // (ROAD-E E5). But that is the hosts' running order, not a law, and
    // the two regressions this bracket already caused (the 2026-08-23
    // sky-blue screen; the `gl.enable(gl.CULL_FACE)` a mutation campaign
    // deleted with the whole suite still green) were both silent.
    //
    // So: a host calls this AFTER its foreign pass. If the run is still
    // open when it does, a foreign pass just drew inside one - the exact
    // bug - and it says so, once, instead of rendering wrong all session.
    if (this._2dVao && !this._warned2dForeign) {
      this._warned2dForeign = true;
      console.warn('PERF-2D: a foreign pass ran inside an open 2D run - it drew with DEPTH_TEST and CULL_FACE off. Call renderer.endUiRun() before the pass.');
    }
    this._close2D();
    this.gl.bindVertexArray(null);
    this._lastProgram = null;
    this._lastVao = null;
    this._csUploaded = {};
    // PERF-TEX: a foreign pass binds its own textures and leaves its own
    // unit active, so every texture shadow is forgotten with the rest. A
    // shadow that speaks for a unit it no longer owns is a WRONG TEXTURE,
    // which is the one thing a performance change may never cost.
    this._forgetTextureShadows();
  }

  /** EL1: compile one world program set from its four fragment shaders
   *  (the vertex shaders are the renderer's own - a lane changes how a
   *  fragment is lit, never how a vertex lands). */
  _buildWorldSet(src) {
    return {
      key: src.key,
      mesh: this._buildProgram(VS, src.meshFs),
      char: this._buildProgram(CHAR_VS, src.charFs),
      bb: this._buildProgram(BB_VS, src.bbFs),
      terrain: this._buildProgram(TERRAIN_VS, src.terrainFs),
    };
  }

  _fogLocs(program) {
    const gl = this.gl;
    return {
      fogColor: gl.getUniformLocation(program, 'uFogColor'),
      fogMode: gl.getUniformLocation(program, 'uFogMode'),
      clipY: gl.getUniformLocation(program, 'uClipY'),
      amMode: gl.getUniformLocation(program, 'uAutomapMode'),
      amWaterLevel: gl.getUniformLocation(program, 'uAutomapWaterLevel'),
      amWaterColor: gl.getUniformLocation(program, 'uAutomapWaterColor'),
      fogDensity: gl.getUniformLocation(program, 'uFogDensity'),
      fogRange: gl.getUniformLocation(program, 'uFogRange'),
      camPos: gl.getUniformLocation(program, 'uCamPos'),
    };
  }

  /** EL1: make `set` the renderer's world programs - every uniform
   *  location the draw paths read is looked up again here, and every
   *  "already uploaded" claim (the terrain's frame block, the cloud
   *  shadow stamps, the emission colour shadow, the bound-program
   *  shadow) is dropped, because they were the OLD set's. */
  _installWorldSet(set) {
    const gl = this.gl;
    this._worldSet = set;
    this.program = set.mesh;
    this.uProj = gl.getUniformLocation(this.program, 'uProj');
    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
    this.uAmbient = gl.getUniformLocation(this.program, 'uAmbient');
    this.uAmbientSky = gl.getUniformLocation(this.program, 'uAmbientSky');       // BA1
    this.uAmbientGround = gl.getUniformLocation(this.program, 'uAmbientGround');
    this.uTrilight = gl.getUniformLocation(this.program, 'uTrilight');
    this.uSunScale = gl.getUniformLocation(this.program, 'uSunScale');
    this.uSunColor = gl.getUniformLocation(this.program, 'uSunColor');
    this.uMoonDir = gl.getUniformLocation(this.program, 'uMoonDir');
    this.uMoonScale = gl.getUniformLocation(this.program, 'uMoonScale');
    this.uMoonColor = gl.getUniformLocation(this.program, 'uMoonColor');
    this.uLight3Dir = gl.getUniformLocation(this.program, 'uLight3Dir');
    this.uLight3Scale = gl.getUniformLocation(this.program, 'uLight3Scale');
    this.uLight3Color = gl.getUniformLocation(this.program, 'uLight3Color');
    this.uTex = gl.getUniformLocation(this.program, 'uTex');
    this.uEmissionTex = gl.getUniformLocation(this.program, 'uEmissionTex');
    this.uEmissionColor = gl.getUniformLocation(this.program, 'uEmissionColor');
    this.uPointCount = gl.getUniformLocation(this.program, 'uPointCount');
    this.uPointLights = gl.getUniformLocation(this.program, 'uPointLights');
    this.uPointColors = gl.getUniformLocation(this.program, 'uPointColors');
    this.uIndirect = gl.getUniformLocation(this.program, 'uIndirect');
    this.uIndirectColor = gl.getUniformLocation(this.program, 'uIndirectColor');
    this._solidFog = this._fogLocs(this.program);
    // Character program (C4b): rig vertex-color path, same scene
    // lighting/fog model as the mesh program.
    this.charProgram = set.char;
    const cp = this.charProgram;
    this._char = {
      proj: gl.getUniformLocation(cp, 'uProj'),
      view: gl.getUniformLocation(cp, 'uView'),
      model: gl.getUniformLocation(cp, 'uModel'),
      lightDir: gl.getUniformLocation(cp, 'uLightDir'),
      ambient: gl.getUniformLocation(cp, 'uAmbient'),
      sunScale: gl.getUniformLocation(cp, 'uSunScale'),
      sunColor: gl.getUniformLocation(cp, 'uSunColor'),
      moonDir: gl.getUniformLocation(cp, 'uMoonDir'),
      moonScale: gl.getUniformLocation(cp, 'uMoonScale'),
      moonColor: gl.getUniformLocation(cp, 'uMoonColor'),
      pointCount: gl.getUniformLocation(cp, 'uPointCount'),
      pointLights: gl.getUniformLocation(cp, 'uPointLights'),
      pointColors: gl.getUniformLocation(cp, 'uPointColors'),
      indirect: gl.getUniformLocation(cp, 'uIndirect'),
      indirectColor: gl.getUniformLocation(cp, 'uIndirectColor'),
      tex: gl.getUniformLocation(cp, 'uTex'),
      useTex: gl.getUniformLocation(cp, 'uUseTex'),
      alphaCut: gl.getUniformLocation(cp, 'uAlphaCut'),
    };
    this._charFog = this._fogLocs(cp);
    this.bbProgram = set.bb;
    this.terrainProgram = set.terrain;
    this.tUProj = gl.getUniformLocation(this.terrainProgram, 'uProj');
    this.tUView = gl.getUniformLocation(this.terrainProgram, 'uView');
    this.tUModel = gl.getUniformLocation(this.terrainProgram, 'uModel');
    // EE5 / VC4: the cloud shadow map's uniforms, one pair per program that lights by the sun
    this._csLoc.terrain = [gl.getUniformLocation(this.terrainProgram, 'uCloudShadowMap'), gl.getUniformLocation(this.terrainProgram, 'uCloudShadowRect')];
    this._csLoc.mesh = [gl.getUniformLocation(this.program, 'uCloudShadowMap'), gl.getUniformLocation(this.program, 'uCloudShadowRect')];
    this._csLoc.char = [gl.getUniformLocation(this.charProgram, 'uCloudShadowMap'), gl.getUniformLocation(this.charProgram, 'uCloudShadowRect')];
    this._csLoc.bb = [gl.getUniformLocation(this.bbProgram, 'uCloudShadowMap'), gl.getUniformLocation(this.bbProgram, 'uCloudShadowRect')];
    this.tUTileArr = gl.getUniformLocation(this.terrainProgram, 'uTileArr');
    this.tUTilemap = gl.getUniformLocation(this.terrainProgram, 'uTilemap');
    this.tUTileSize = gl.getUniformLocation(this.terrainProgram, 'uTileSize');
    this.tULightDir = gl.getUniformLocation(this.terrainProgram, 'uLightDir');
    this.tUAmbient = gl.getUniformLocation(this.terrainProgram, 'uAmbient');
    this.tUSunScale = gl.getUniformLocation(this.terrainProgram, 'uSunScale');
    this.tUSunColor = gl.getUniformLocation(this.terrainProgram, 'uSunColor');
    this.tUMoonDir = gl.getUniformLocation(this.terrainProgram, 'uMoonDir');
    this.tUMoonScale = gl.getUniformLocation(this.terrainProgram, 'uMoonScale');
    this.tUMoonColor = gl.getUniformLocation(this.terrainProgram, 'uMoonColor');
    this.tUPointCount = gl.getUniformLocation(this.terrainProgram, 'uPointCount');
    this.tUPointLights = gl.getUniformLocation(this.terrainProgram, 'uPointLights');
    this.tUPointColors = gl.getUniformLocation(this.terrainProgram, 'uPointColors');
    this.tUIndirect = gl.getUniformLocation(this.terrainProgram, 'uIndirect');
    this.tUIndirectColor = gl.getUniformLocation(this.terrainProgram, 'uIndirectColor');
    this._bbFog = this._fogLocs(this.bbProgram);
    this._terrainFog = this._fogLocs(this.terrainProgram);
    this.bbUProj = gl.getUniformLocation(this.bbProgram, 'uProj');
    this.bbUView = gl.getUniformLocation(this.bbProgram, 'uView');
    this.bbURight = gl.getUniformLocation(this.bbProgram, 'uRight');
    this.bbUUp = gl.getUniformLocation(this.bbProgram, 'uUp');
    this.bbUSize = gl.getUniformLocation(this.bbProgram, 'uSize');
    this.bbUOrigin = gl.getUniformLocation(this.bbProgram, 'uOrigin');
    this.bbUTex = gl.getUniformLocation(this.bbProgram, 'uTex');
    this.bbUEmissionTex = gl.getUniformLocation(this.bbProgram, 'uEmissionTex');
    this.bbUSpectral = gl.getUniformLocation(this.bbProgram, 'uSpectral');
    this.bbUConceal = gl.getUniformLocation(this.bbProgram, 'uConceal');   // ECV1
    this.bbUTint = gl.getUniformLocation(this.bbProgram, 'uTint');
    this.bbUSun = gl.getUniformLocation(this.bbProgram, 'uBBSun');   // VC4
    this.bbUPointCount = gl.getUniformLocation(this.bbProgram, 'uPointCount');
    this.bbUPointLights = gl.getUniformLocation(this.bbProgram, 'uPointLights');
    this.bbUPointColors = gl.getUniformLocation(this.bbProgram, 'uPointColors');
    this.bbUIndirect = gl.getUniformLocation(this.bbProgram, 'uIndirect');
    this.bbUIndirectColor = gl.getUniformLocation(this.bbProgram, 'uIndirectColor');
    this.bbUFlatWind = gl.getUniformLocation(this.bbProgram, 'uFlatWind');   // WIND3
    this.bbUSway = gl.getUniformLocation(this.bbProgram, 'uSway');   // WIND3
    // EL1: the lane's own uniforms, per program (null on the classic set, which never declares them)
    // EL2: the shadow receiver's six ride the same table (null on the classic set)
    const elLocs = (p) => {
      /** @type {any[] & { shadow?: object, ao?: object, contact?: object }} */
      const a = [gl.getUniformLocation(p, 'uELExposure'), gl.getUniformLocation(p, 'uELScatter')];
      a.shadow = {
        sunShadow: gl.getUniformLocation(p, 'uSunShadow'), sunVP: gl.getUniformLocation(p, 'uSunVP'), sunParams: gl.getUniformLocation(p, 'uSunShadowParams'), sunTexel: gl.getUniformLocation(p, 'uSunTexel'),
        pointShadow: gl.getUniformLocation(p, 'uPointShadow'), pointParams: gl.getUniformLocation(p, 'uPointShadowParams'), shadowIndex: gl.getUniformLocation(p, 'uShadowIndex'),
        casterOf: gl.getUniformLocation(p, 'uCasterOf'),   // EL8
      };
      a.ao = { adapt: gl.getUniformLocation(p, 'uAdapt') };   // EL4: the eye (EL6: the AO left the world shaders - the resolve applies it off the frame's depth)
      a.contact = { prevDepth: gl.getUniformLocation(p, 'uPrevDepth'), prevVP: gl.getUniformLocation(p, 'uPrevVP'), prevProjInfo: gl.getUniformLocation(p, 'uPrevProjInfo'), contactParams: gl.getUniformLocation(p, 'uContactParams') };   // EL8
      return a;
    };
    this._el = { mesh: elLocs(set.mesh), char: elLocs(set.char), bb: elLocs(set.bb), terrain: elLocs(set.terrain) };
    this._tFrameStamp = -1;
    this._csUploaded = {};
    this._emissionColorUp = null;
    this._forgetTextureShadows();   // the set is rebuilt, so every unit it bound is the new set's to claim
    this._lastProgram = null;
  }

  /**
   * EL1: INSTALL A LIGHTING LANE, or the classic set with null. A lane is
   * render/enhancedLighting.js's EL_LANE shape: four fragment shaders, a
   * light cap, a colour decode. Compiled ONCE per lane key and kept, so a
   * host that mounts with the lane, then one without, then one with
   * again pays the compile once; the classic set is never rebuilt. The
   * same lane again is a no-op.
   */
  setLightingLane(lane) {
    lane = lane ?? null;
    if (lane === this._lane) return;
    if (lane) {
      if (!this._laneSet || this._laneSet.key !== lane.key) this._laneSet = this._buildWorldSet(lane);
      this._installWorldSet(this._laneSet);
    } else {
      this._installWorldSet(this._classicSet);
    }
    this._lane = lane;
    // EL2: the shadow pass rides a lane that asks for it; built once, kept
    if (lane?.shadows) {
      this._shadows = this._shadowPass ??= new ShadowPass(this.gl, { build: (vs, fs) => this._buildProgram(vs, fs), vs: { mesh: VS, bb: BB_VS, terrain: TERRAIN_VS, char: CHAR_VS } });   // EL7: the rigs cast
      // EL7: the water surface receives the lane's sun shadow - its own program with the receiver block, built once
      if (lane.shadows && !this.waterSurfaceProgramLane) {
        this.waterSurfaceProgramLane = this._buildProgram(WATER_SURFACE_VS, waterSurfaceFs(CLOUD_SHADOW_GLSL, SHADOW_GLSL));
        this._wsLane = this._waterLocs(this.waterSurfaceProgramLane);
        const p = this.waterSurfaceProgramLane, gl = this.gl;
        this._wsLane.shadow = {
          sunShadow: gl.getUniformLocation(p, 'uSunShadow'), sunVP: gl.getUniformLocation(p, 'uSunVP'), sunParams: gl.getUniformLocation(p, 'uSunShadowParams'), sunTexel: gl.getUniformLocation(p, 'uSunTexel'),
          pointShadow: gl.getUniformLocation(p, 'uPointShadow'), pointParams: gl.getUniformLocation(p, 'uPointShadowParams'), shadowIndex: gl.getUniformLocation(p, 'uShadowIndex'),
        };
      }
    } else {
      this._shadows?.discard();
      this._shadows = null;
    }
    this._syncAir();
    this.maxPointLights = lane ? lane.maxLights : CLASSIC_MAX_LIGHTS;
    const n = this.maxPointLights;
    if (this._flashLightScratch.length < n * 4) {
      this._flashLightScratch = new Float32Array(n * 4);
      this._flashColorScratch = new Float32Array(n * 3);
      this._flashCarriedScratch = new Uint8Array(n);
      this._pointColorScratch = new Float32Array(n * 3);
      this._pointColorDec = new Float32Array(n * 3);
    }
    // a light list stored under the other cap is re-cut to this one
    if (this._pointLights.length > n * 4) this._pointLights = this._pointLights.subarray ? this._pointLights.subarray(0, n * 4) : this._pointLights.slice(0, n * 4);
    if (this._pointColors && this._pointColors.length > n * 3) this._pointColors = this._pointColors.subarray ? this._pointColors.subarray(0, n * 3) : this._pointColors.slice(0, n * 3);
  }

  /** EL1: the installed lane (EL_LANE) or null - what a host hands the far
   *  ring and reads its lantern colour by. */
  get lightingLane() { return this._lane; }
  /** EL1: the lane's exposure, for a foreign pass that lights on the lane (the far ring). */
  get exposure() { return this._exposure; }

  /** EL3: the page's air door (syncLightingLane reads `?air=off`): the
   *  AirPass rides a lane that asks for it AND this. */
  setAir(on) { this._airWanted = !!on; this._syncAir(); }
  /** EL8: the contact shadows' door (`?contact=off`); on by default. */
  setContact(on) { this._contactWanted = !!on; }
  _syncAir() {
    const want = this._airWanted && !!this._lane?.air && !!this._shadows;   // the air pass replays the shadow pass's records
    if (want) this._air = this._airPass ??= new AirPass(this.gl, { build: (vs, fs) => this._buildProgram(vs, fs), vs: { mesh: VS, bb: BB_VS } });
    else { if (this._air) { this._air.release(); this._frameFbo = null; } this._air = null; }
  }
  /** EL4: the adaptation image, for a foreign pass that exposes on the lane (the far ring). */
  get adaptTexture() { return this._air?.adaptTexture ?? null; }
  /** EL3: the AirPass or null - a probe's read. */
  get air() { return this._air; }

  /** EL1: the lane's exposure - a scene-wide gain before the tonemap.
   *  Shadowed and uploaded with the frame; inert on the classic set. */
  setExposure(v) { this._exposure = v > 0 ? v : 1; }

  /** EL1: a host colour as the installed set wants it - the classic set
   *  takes it as given, the lane takes it decoded to linear (into one of
   *  the two scratch triples; every upload copies at the call). */
  _c3(src, scratch = this._decA) {
    return this._lane ? this._lane.decode3(src, scratch) : src;
  }

  /** EL1: the lane's own uniforms for one program, when a lane is on -
   *  the exposure, and the in-scatter gain folded with the fog's density
   *  (zero with the fog off, so clear air glows nowhere). */
  _uploadEl(key) {
    const lane = this._lane;
    if (!lane) return;
    const gl = this.gl, [expLoc, scLoc] = this._el[key];
    gl.uniform1f(expLoc, this._exposure);
    gl.uniform1f(scLoc, lane.scatter * lane.scatterDensity(this._fogMode, this._fogDensity, this._fogRange[0], this._fogRange[1]));
    if (this._shadows) this._shadows.upload(this._el[key].shadow);   // EL2: the maps and the receiver's uniforms
    this._uploadAdapt(this._el[key].ao);   // EL6: the AO is the resolve's now (AUDIT-EL F2/F12's foreign-rect and unit-0 cases went with it)
    // EL8: the contact block - the previous frame's depth, for a WORLD frame's own draws alone (a sprite pass, a bake or a panel is another view: the march would read a stranger's depth)
    if (this._air) this._air.uploadContact(this._el[key].contact, this._contactWanted !== false && this._spriteDepth === 0 && this._studioDepth === 0 && !this._panelSaved);
    else this._uploadNoContact(this._el[key].contact);
  }
  /** EL8: with the air off the contact sampler still needs a texture (AUDIT-EL F1's law) and the params say off. */
  _uploadNoContact(loc) {
    if (!loc?.prevDepth) return;
    const gl = this.gl;
    this._activeTexture(gl.TEXTURE0 + CONTACT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this._adaptOne());
    this._activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.prevDepth, CONTACT_UNIT);
    gl.uniform4fv(loc.contactParams, ZERO_CONTACT);
  }

  /** AUDIT-EL F1: THE EYE'S IMAGE IS ALWAYS BOUND. Every lane shader samples
   *  uAdapt; with the air off (`?air=off`) nothing bound it, the sampler sat
   *  at unit 0 and read the diffuse texture's centre texel as an exposure -
   *  a different exposure per material. A UI picture (the icon bake, the
   *  inventory's body - `_studioDepth`) takes no adaptation either: an item
   *  baked while the eye was open in a dungeon would be a brighter icon
   *  than one baked at noon. Both read a bare 1x1 image holding 1. */
  _uploadAdapt(loc) {
    if (!loc?.adapt) return;
    const gl = this.gl;
    const tex = this._air && this._studioDepth === 0 ? this._air.adaptTexture : this._adaptOne();
    this._activeTexture(gl.TEXTURE0 + ADAPT_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._activeTexture(gl.TEXTURE0);
    gl.uniform1i(loc.adapt, ADAPT_UNIT);
  }
  /** AUDIT-EL F12: THE AO SAMPLER IS ALWAYS ON ITS UNIT. With the air off
   *  (or before its images exist) uAO sat at unit 0 - and the TERRAIN
   *  program's unit 0 is uTileArr, a sampler2DArray: two samplers of
   *  different types on one unit, INVALID_OPERATION at every terrain draw,
   *  no ground under `?air=off`. A bare image on unit 12 and a zero rect. */
  _adaptOne() {
    if (this._adaptOneTex) return this._adaptOneTex;
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));   // the log encoding's midpoint: a multiplier of 1
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    return (this._adaptOneTex = tex);
  }

  /** AUDIT-EL F5: THE LANE'S FRAME START. A WORLD frame (the six host sites
   *  pass `{ world: true }`) replays and spends the records for its maps and
   *  images. Any other beginFrame - the enhanced travel map, a video, a menu
   *  raised mid-game, a panel - is a SECOND frame in one presented frame:
   *  it resolves the frame still owed (or the world's image would be lost
   *  under a map that then never reached the canvas), keeps the world's
   *  records for the world's next frame, and draws with the maps already
   *  made. Every non-panel frame draws into a frame image, resolved by its
   *  first screen draw or by resolveFrame(). */
  _beginLane(proj, view, lightDir, world) {
    if (world && this._perf) { this._perf.begin(); this._perf.mark('shadow'); this.stats.draws = 0; }   // EL8: the frame's clock starts with its passes; VC6d: and its first span
    if (this._air?.pending && !this._panelSaved) this._compositeAir();
    this._deckOwed = null;   // VC6c: whatever was owed is drawn; this frame's deck is its host's to set
    if (this._shadows && world) this._renderPasses(proj, view, lightDir);
    // EL4: THE FRAME IMAGE - the world pass draws into it, the clear included; a panel frame keeps the canvas
    this._frameFbo = this._air && !this._panelSaved ? this._air.beginFrameTarget(this.canvas.width, this.canvas.height) : null;
  }

  /** EL2/EL3: THE PASSES BEFORE THE FRAME, at the top of beginFrame - the
   *  shadow maps (render/shadowPass.js) and then the air's images
   *  (render/airPass.js: the depth image, the AO, the bloom source, the
   *  shafts), both from the LAST frame's records under THIS frame's light,
   *  eye and viewport; then the records are dropped. A panel frame drops
   *  the records it inherited and draws nothing. The passes bind their own
   *  programs, VAOs and viewports; the world viewport comes back here and
   *  beginFrame forgets the shadows right after, as it always did. */
  _renderPasses(proj, view, lightDir) {
    const sp = this._shadows;   // AUDIT-EL F8: a panel frame never reaches here - it is no WORLD frame (F5) - so the world's records survive it (_casting keeps it from adding any)
    const v = view;
    this._camPos[0] = -(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]);
    this._camPos[1] = -(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]);
    this._camPos[2] = -(v[8] * v[12] + v[9] * v[13] + v[10] * v[14]);
    const bindVao = (vao) => this._bindVao(vao);
    sp.render({
      eye: this._camPos, lightDir, sunScale: this._sunScale, pointLights: this._pointLights, carried: this._pointCarried,   // MAC-T1
      textures: this.textures, isSpectral: isSpectralArchive, bindVao,
    });
    if (this._air) {
      const count = this._pointLights.length / 4;
      this._air.prepare({   // EL6: the inputs alone - the images are drawn at the resolve, off the frame's depth
        proj, view, lightDir, eye: this._camPos, sunScale: this._sunScale, sunColor: this._sunColor,
        pointLights: this._pointLights, pointColors: count > 0 ? this._pointColorData(count) : null, carried: this._pointCarried,   // MAC-T1
        viewport: this._worldViewportPx ?? [0, 0, this.canvas.width, this.canvas.height],
        shadows: sp, textures: this.textures, emissionTextures: this.emissionTextures, blackTex: this._blackTex,
        windowEmission: this._windowEmission, isSpectral: isSpectralArchive, bindVao, clearColor: this._clearColor,
      });
    }
    this._perf?.mark('world');   // VC6d: the passes' work is submitted; everything until the sky or the resolve is the world's own draws
    sp.discard();
    this._restoreWorldViewport();
    this.markForeignPass();   // AUDIT-EL F19: the last replayed VAO is unbound for real (a shadow set to null over a live bind is a capture waiting to happen), and the shadows forgotten
  }

  /** EL3: the frame's first screen-space draw composites the bloom and
   *  the shafts over the world (the 2D pass has begun; the world pass and
   *  every foreign pass are done), then hands the 2D pass the full canvas. */
  /** AUDIT-EL F5: resolve the frame image to the canvas NOW - for a pass
   *  that opened its own beginFrame and draws no screen quad after it (the
   *  enhanced travel map's relief). A no-op with nothing owed. */
  resolveFrame() { this._compositeAir(); }

  _compositeAir() {
    if (!this._air?.pending) return;
    // PERF-2D: AFTER the early return, and that ordering is the whole
    // saving. drawScreenQuad calls this at the head of EVERY quad, so a
    // close before the return would shut the run a hundred times a
    // frame and hand the per-quad bracket straight back. The air pass
    // only needs the baseline when it actually resolves.
    this._close2D();
    this._perf?.mark('air');   // VC6d: the AO, the bloom, the shafts and the resolve
    this._air.setCloudShadow(this._cloudShadow ?? this._deckOwed);   // VC6c: the FRAME's deck - the host sets it after beginFrame, so the shafts can only read it here
    this._air.composite();   // EL4: the resolve - the frame to the canvas
    // AUDIT-AIR1: THE RESOLVE IS A FOREIGN PASS, and this seam - alone of
    // the seven - never said so. `composite()` binds units 0..3 and
    // leaves its own unit selected, exactly what `markForeignPass`
    // exists for; the first screen quad after it found `_activeUnit`
    // still claiming TEXTURE0 and `_tex0Bound` still naming the sprite
    // it wanted, so it skipped the bind (or bound to unit 3) and sampled
    // the RESOLVED FRAME BUFFER. On an unsheathe that is the weapon
    // sprite painted with a blurred picture of the room - the "weird
    // water texture". AFTER the composite, because the composite is what
    // invalidates them. (VC6c/VC6d pin the two lines above this one as
    // adjacent, which is why the reason is written here and not there.)
    this._forgetTextureShadows();
    if (this._perf) {   // EL8: the clock stops at the resolve; the line, when it is due
      this._perf.end();
      this._perf.stop();   // VC6d: the frame's last span
      const line = this._perf.frame({ draws: this.stats.draws, shadows: this._shadows ? { ...this._shadows.stats, casters: this._shadows.casters } : null, air: { ...this._air.stats } });
      if (line) console.info(line);
    }
    this._frameFbo = null;
    this._lastProgram = null; this._lastVao = null;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** EL2: whether this draw is recorded for the shadow maps - a lane with
   *  shadows, outside a panel frame (a panel's draws are the automap's or
   *  a preview's, from its own camera, and cast nothing). */
  get _casting() { return !!this._shadows && !this._panelSaved; }   // !! - a bare prototype (the crash-report tests) has no pass at all

  /** EL2: the ShadowPass or null - a probe's read. */
  get shadows() { return this._shadows; }

  /** PERF-2D: THE BRACKET THAT WAS PER QUAD.
   *
   *  Every screen quad used to disable DEPTH_TEST and CULL_FACE, bind
   *  its VAO, draw, then re-enable both and unbind - four cap calls and
   *  two VAO binds a quad, for a HUD that draws a hundred-odd of them.
   *  Measured against a dungeon frame that is otherwise 3 batched level
   *  meshes and 25 loose models, that bracket alone was **43% of every
   *  GL call in the frame**, in every scene there is.
   *
   *  It is a RUN's state, not a quad's, so it is opened once and closed
   *  once. The renderer still OWNS it - this is not the contract change
   *  PERF-UI weighed and refused, where the world paths would have had
   *  to own their own caps. What changed is only WHEN the restore
   *  happens: on demand, at the head of everything that needs the
   *  baseline back, instead of eagerly after every quad.
   *
   *  The law, and `test/glstate.test.js` reads it out of the source:
   *  **every method in this file that issues a `gl.draw*` either is one
   *  of the three 2D primitives or calls `_close2D()` first**, and so
   *  does every seam where foreign GL can run (`beginFrame`,
   *  `endWorldPass`, `markForeignPass`, the panel frames). Miss one and
   *  a world draw runs with no depth test and no culling, which is the
   *  2026-08-23 "sky-blue screen" regression wearing the other face -
   *  so the pin is a source pin and cannot go vacuous. */
  _open2D(vao) {
    if (!this._2dVao) {
      const gl = this.gl;
      gl.disable(gl.DEPTH_TEST);
      // HANDEDNESS REGRESSION (2026-08-23, "the sky-blue screen"): a 2D
      // blit has no facing, but with CULL_FACE left ON the global
      // frontFace(CW) swap culled EVERY screen quad - the whole UI
      // layer, title screen to fonts - leaving only the clear color.
      // tools/cullProbe.mjs is the real-GL repro.
      gl.disable(gl.CULL_FACE);
    }
    // The three primitives have three different VAOs, and switching
    // between them inside one run is a bind and NOT a cap toggle.
    this._bindVao(vao);
    this._2dVao = vao;
  }

  /** PERF-2D: the host's own door onto `_close2D`, for a frame that has
   *  to run a foreign pass after a screen quad. Nothing needs it today;
   *  it exists so that the warning in `markForeignPass` names a remedy
   *  rather than a bug report. */
  endUiRun() { this._close2D(); }

  /** PERF-TEX3 / AUDIT-AIR1: FORGET EVERY TEXTURE SHADOW - ONE HOME.
   *
   *  The six fields below are a claim about what the GPU holds: which
   *  texture is on unit 0 and unit 1, which unit is SELECTED, the
   *  sampler-array and tile-size of the tilemap path, and the screen
   *  quad's uniform values. Every one of them is only true while this
   *  renderer is the only thing touching GL. The instant something else
   *  binds - a foreign pass, an upload, the air pass's resolve - the
   *  claim is a lie, and a shadow that speaks for a unit it no longer
   *  owns is a WRONG TEXTURE. That is the one thing a performance
   *  change may never cost.
   *
   *  WHY IT IS A FUNCTION (AUDIT-AIR1, 2026-09-19, Mac: "sometimes
   *  unsheathing, it spawns a weird water texture"). This block was
   *  COPIED at five seams and the sixth - `_compositeAir`, which runs
   *  the air pass and is as foreign as anything gets - was never given
   *  one. `airPass.composite()` binds units 0..3 and leaves unit 3
   *  selected, so the first screen quad after a resolve found
   *  `_activeUnit` still claiming TEXTURE0 and `_tex0Bound` still
   *  naming the sprite it wanted: it skipped the bind, or bound to unit
   *  3, and drew the RESOLVED FRAME BUFFER instead of its own art. On
   *  an unsheathe that is the weapon sprite painted with a blurred
   *  picture of the room - the "weird water texture". Six copies of a
   *  rule is five chances to miss one; this is the one home. */
  _forgetTextureShadows() {
    this._tex1Bound = null;
    this._tex0Bound = null; this._activeUnit = null;
    this._sq = {};
    this._tArrayTex = null;
    this._tTileSize = null;
  }

  /** Hand the baseline back, if a run is open. Idempotent, and cheap
   *  enough to call at the head of anything: one property read. */
  _close2D() {
    if (!this._2dVao) return;
    const gl = this.gl;
    this._bindVao(null);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    this._2dVao = null;
  }

  _buildProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(sh));
      }
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  /** PERF-WARM: the programs this renderer builds ON DEMAND, each as its
   *  own step, so a caller can pay for them while the browser is idle
   *  instead of on the frame that first needs them.
   *
   *  Five programs were compiled inside a draw call: the particle
   *  effects' (first spell), the character-sprite quad's (first classic
   *  sprite), the screen quad's, the instanced screen quad's and the
   *  overlay's. A compile and link is a DRIVER operation - it can take
   *  tens of milliseconds and there is no way to make it cheaper, only
   *  to move it. Every step is idempotent: the block each one wraps
   *  still begins with its own `if (!this.xProgram)`, so the draw path
   *  is unchanged for anyone who never warms, and a warm that has
   *  already run costs one property read.
   *
   *  Not warmed: the world, sky, billboard and terrain programs, which
   *  the constructor already builds, and the lab's programs, which
   *  render/precipitation.js owns and only the enhanced lane compiles
   *  (AUDIT 58 - warming them here would undo that). */
  warmSteps() {
    return [
      () => this._ensureScreenQuadProgram(),
      () => this._ensureScreenQuadRunProgram(),
      () => this._ensureCharQuadProgram(),
      () => this._ensureParticleProgram(),
      () => this._ensureOverlayProgram(),
    ];
  }

  /**
   * VAO from packCharacterFaces output (interleaved 9 floats/vertex).
   *
   * MW-D11: `opts.uv` takes an 11-float stream instead - the same nine
   * floats with a UV pair after them - and enables attribute 3. The
   * voxel rigs pass neither and get exactly the VAO they always got;
   * this is one extra channel, not a second path, because a second path
   * is how the two ports of one rule in MW7 drifted apart.
   */
  createCharacterMesh(packed, opts = {}) {
    const gl = this.gl;
    const uv = !!opts.uv;
    // MWT2: the emission rides with the UV - a Morrowind mesh has both or
    // neither, and the voxel rigs have neither. `floats` is what the pack
    // wrote, so it is derived here rather than guessed at.
    const emissive = uv && opts.emissive !== false;
    const floats = uv ? (emissive ? 14 : 11) : 9;
    const vao = gl.createVertexArray();
    this._bindVao(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
    const stride = floats * 4;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);
    if (uv) {
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 36);
    }
    if (emissive) {
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 44);
    }
    this._bindVao(null);
    return { vao, count: packed.length / floats, buffers: [vbo], vbo, floats, bounds: boundsOf(packed, null, 0, -1, floats) };   // EL7: the rig's sphere, for the shadow replays' cull
  }

  /**
   * MW-D11: upload one decoded texture for the character path.
   * `mips` is decodeDds's output shape ({width, height, rgba}[]), and
   * the wrap mode is the NIF's own clamp mode, mapped by the caller.
   */
  createCharacterTexture(mips, { wrapS = 0x812f, wrapT = 0x812f } = {}) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    for (let i = 0; i < mips.length; i++) {
      const m = mips[i];
      gl.texImage2D(gl.TEXTURE_2D, i, gl.RGBA, m.width, m.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.rgba);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, mips.length - 1);
    // NEAREST magnification: Morrowind's textures are small and the port
    // draws the world with the same nearest-neighbour look everywhere
    // else - a smoothed arm against a pixelated world reads as a bug.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
      mips.length > 1 ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    return tex;
  }

  /** Re-upload a character mesh's vertex stream in place (per-frame
   *  animation). `packed` must match the original layout/length. */
  /** MAC-Q: a particle EFFECT's GL objects - a VAO over PARTICLE_FLOATS
   *  (formats/mwParticles.js packParticleQuads' stream), sized for
   *  `capacity` quads and refilled each frame. Rides a character mesh's
   *  `effects` list and is drawn after its ranges. */
  createParticleEffect(capacity, state = {}) {
    const gl = this.gl;
    const floats = 12;
    const vao = gl.createVertexArray();
    this._bindVao(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, Math.max(1, capacity) * 6 * floats * 4, gl.DYNAMIC_DRAW);
    const stride = floats * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 28);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 44);
    this._bindVao(null);
    return {
      vao, vbo, capacity: Math.max(1, capacity), count: 0, floats, hidden: false,
      tex: null,
      blend: !!state.blend, srcBlend: state.srcBlend ?? 6, dstBlend: state.dstBlend ?? 7,
      alphaCut: state.alphaCut ?? 0, depthTest: state.depthTest !== false, depthWrite: state.depthWrite !== false,
    };
  }

  /** The frame's quads into the effect. `count` is in VERTICES. */
  updateParticleEffect(effect, packed, count) {
    const gl = this.gl;
    const cap = effect.capacity * 6;
    effect.count = Math.min(count, cap);
    if (!effect.count) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, effect.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed.subarray ? packed.subarray(0, effect.count * effect.floats) : packed);
  }

  releaseParticleEffect(effect) {
    const gl = this.gl;
    if (!effect) return;
    if (effect.vao) gl.deleteVertexArray(effect.vao);
    if (effect.vbo) gl.deleteBuffer(effect.vbo);
    if (effect.tex) gl.deleteTexture(effect.tex);
    effect.vao = null; effect.vbo = null; effect.tex = null; effect.count = 0;
  }

  /** The effects of a character mesh, after its ranges: the NIF's own
   *  blend function and depth flags (nifloader.cpp applyDrawableProperties
   *  over the particle drawable, :1521-1523), depth-tested against the
   *  body that was just drawn and never writing over it. State is
   *  returned to the character pass's baseline on the way out. */
  _drawParticleEffects(mesh, modelMatrix) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    const list = mesh.effects;
    if (!list || !list.length) return;
    this._ensureParticleProgram();
    let any = false;
    for (const e of list) {
      if (!e || e.hidden || !e.count) continue;
      if (!any) {
        any = true;
        this._use(this.particleProgram);
        const u = this._particle;
        gl.uniformMatrix4fv(u.proj, false, this._proj);
        gl.uniformMatrix4fv(u.view, false, this._view);
        gl.uniformMatrix4fv(u.model, false, modelMatrix);
        this._activeTexture(gl.TEXTURE0);
        gl.uniform1i(u.tex, 0);
        gl.depthMask(false);
      }
      const u = this._particle;
      gl.uniform1f(u.useTex, e.tex ? 1 : 0);
      gl.uniform1f(u.alphaCut, e.alphaCut || 0);
      gl.bindTexture(gl.TEXTURE_2D, e.tex || this._blackTex);
      this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
      if (e.blend) { gl.enable(gl.BLEND); gl.blendFunc(gl[nifBlendMode(e.srcBlend)], gl[nifBlendMode(e.dstBlend)]); }
      else gl.disable(gl.BLEND);
      if (e.depthTest) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
      if (e.depthWrite) gl.depthMask(true); else gl.depthMask(false);
      this._bindVao(e.vao);
      gl.drawArrays(gl.TRIANGLES, 0, e.count);
      this.stats.draws++;
    }
    if (any) {
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
      this._bindVao(null);
      this._use(this.charProgram);   // the pass's own program back, for the caller's next draw
    }
  }

  /** PERF-WARM: build the particle program. Was inline in
   *  _drawParticleEffects and so compiled on the frame the first spell
   *  effect drew; it is its own step now so warmSteps() can pay for it
   *  at idle. The body is the block that stood there, unchanged. */
  _ensureParticleProgram() {
    const gl = this.gl;
    if (!this.particleProgram) {
      this.particleProgram = this._buildProgram(PARTICLE_VS, PARTICLE_FS);
      const pp = this.particleProgram;
      this._particle = {
        proj: gl.getUniformLocation(pp, 'uProj'), view: gl.getUniformLocation(pp, 'uView'), model: gl.getUniformLocation(pp, 'uModel'),
        tex: gl.getUniformLocation(pp, 'uTex'), useTex: gl.getUniformLocation(pp, 'uUseTex'), alphaCut: gl.getUniformLocation(pp, 'uAlphaCut'),
      };
    }
  }

  updateCharacterMesh(mesh, packed) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed);
    if (mesh.bounds) boundsOf(packed, null, 0, -1, mesh.floats).forEach((v, i) => { mesh.bounds[i] = v; });   // EL7: an animated rig's sphere follows it
  }

  /**
   * Draw a character mesh (C4b). Owns its program binding (the R9
   * rule) AND the cull state: rig faces carry authored normals but
   * inconsistent triangle winding (built for a non-culling painter),
   * so back-face culling is disabled for the draw and restored after.
   * Frame uniforms re-upload from the beginFrame caches, mirroring
   * the water/billboard paths.
   */
  drawCharacter(mesh, modelMatrix) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    const c = this._char;
    if (this._casting && this._spriteDepth === 0 && this._studioDepth === 0) this._shadows.recordCharacter(mesh, modelMatrix);   // EL7: the rigs cast - never from the sprite target or the studio bake
    this._use(this.charProgram);
    this._uploadCloudShadow('char');   // VC4
    gl.uniformMatrix4fv(c.proj, false, this._proj);
    gl.uniformMatrix4fv(c.view, false, this._view);
    gl.uniformMatrix4fv(c.model, false, modelMatrix);
    gl.uniform3fv(c.lightDir, this._lightDir);
    gl.uniform3fv(c.ambient, this._c3(this._ambient));
    gl.uniform1f(c.sunScale, this._sunScale);
    gl.uniform3fv(c.sunColor, this._c3(this._sunColor));
    gl.uniform3fv(c.moonDir, this._moonDir);
    gl.uniform1f(c.moonScale, this._moonScale);
    gl.uniform3fv(c.moonColor, this._c3(this._moonColor));
    const count = this._pointLights.length / 4;
    gl.uniform1i(c.pointCount, count);
    if (count > 0) gl.uniform4fv(c.pointLights, this._pointLights);
    if (count > 0) gl.uniform3fv(c.pointColors, this._pointColorData(count));
    gl.uniform4fv(c.indirect, this._indirect);
    gl.uniform3fv(c.indirectColor, this._c3(this._indirectColor));
    this._uploadFog(this._charFog);
    this._uploadEl('char');   // EL1
    gl.disable(gl.CULL_FACE);
    this._bindVao(mesh.vao);
    // MW-D11: a textured mesh carries RANGES - one per piece, each with
    // its own texture - because a Morrowind arm is several meshes with
    // several textures and this path issues drawArrays. Without ranges
    // it is the one untextured draw the voxel rigs have always made.
    // A SAMPLER IS "USED" WHETHER OR NOT THE BRANCH RUNS, so unit 0 must
    // always hold a complete texture: with nothing bound, the driver drops
    // the whole draw. Measured the moment this landed - the arm's
    // offscreen target went from 203 lit texels to 0 with no error, no
    // warning and a program that links clean.
    this._activeTexture(gl.TEXTURE0);
    gl.uniform1i(c.tex, 0);
    if (mesh.ranges && mesh.ranges.length) {
      for (const r of mesh.ranges) {
        // MW-D12: a HIDDEN range still owns its vertices and its texture
        // - Morrowind's showWeapons hides the node, it does not delete it
        // (rule 57), and a sheathed weapon has to come back without a
        // repack.
        if (r.hidden) continue;
        gl.uniform1f(c.useTex, r.tex ? 1 : 0);
        gl.uniform1f(c.alphaCut, r.alphaCut || 0);
        gl.bindTexture(gl.TEXTURE_2D, r.tex || this._blackTex);
        this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
        gl.drawArrays(gl.TRIANGLES, r.first, r.count);
        this.stats.texBinds++; this.stats.draws++;
      }
    } else {
      gl.uniform1f(c.useTex, 0);
      gl.uniform1f(c.alphaCut, 0);
      gl.bindTexture(gl.TEXTURE_2D, this._blackTex);
      this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      this.stats.texBinds++; this.stats.draws++;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.uniform1f(c.useTex, 0);
    gl.uniform1f(c.alphaCut, 0);
    this._bindVao(null);
    // MAC-Q: the rig's particle effects, over the body, in the same pass -
    // never recorded for the shadows (a flame casts none in the reference
    // either: osgParticle draws in the transparent bin)
    if (mesh.effects && mesh.effects.length) this._drawParticleEffects(mesh, modelMatrix);
    gl.enable(gl.CULL_FACE);
  }

  /**
   * THE CHARACTER PIXELIZE PASS (slice 4). Characters render into a
   * low-res offscreen target (screen size / CHAR_PIXEL, NEAREST) and
   * composite into the world as a camera-facing textured quad - a
   * live sprite, chunky by construction, depth-tested like every
   * classic billboard. The world pass is untouched (the standard
   * excludes it). Lazy FBO, reallocated only when the pixel size steps.
   */
  _charSpriteRT() {
    // AUDIT FIX (engine pass): one FIXED CHAR_SPRITE_RT_SIZE^2 target,
    // allocated once. The old cache keyed on exact (pw, ph) and
    // reallocated FBO+texture+renderbuffer EVERY frame per character
    // once foes at differing distances shared it (N reallocations/
    // frame). Sprites now render into a viewport sub-rect and the
    // quad samples the scaled UV extent; the full-target clear keeps
    // out-of-rect texels transparent, so NEAREST boundary sampling
    // just discards.
    const gl = this.gl;
    let cs = this._csRT;
    if (!cs) {
      const S = CHAR_SPRITE_RT_SIZE;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, CHAR_SPRITE_RT_SIZE, CHAR_SPRITE_RT_SIZE);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameFbo ?? null);   // EL4: minted mid-frame, the frame comes back
      cs = this._csRT = { fbo, tex, rb };
    }
    return cs;
  }

  /** Render a character mesh into the sprite target under a fitted
   *  ortho camera (frame lighting; the frame camera caches are
   *  swapped and restored - drawCharacter reads them). `lensLocal`:
   *  the mesh sits at the ORIGIN of a private lens space (the FP
   *  viewmodel), not in the world - the cloud deck is borrowed off for
   *  it (VC5 review), as the studio variant does for the panels. */
  renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph, { lensLocal = false, viewmodelLight = null } = {}) {
    const gl = this.gl;
    // MAC-P (2026-09-17, Mac: "morrowind's first person view also doesn't
    // receive lighting and is consistently dark"): THE VIEWMODEL'S LIGHT.
    //
    // He is right, and the reason is the space this pass runs in. A
    // lens-local arm sits at the ORIGIN of a camera-local space while
    // `_pointLights` are in WORLD space, so every torch, lantern and
    // interior lamp in the room misses it by exactly the player's distance
    // from the world origin - the arm has only ever had the ambient and the
    // sun's N.L. In a dungeon that is a dark arm holding a lit torch.
    //
    // The answer is the STUDIO's shape (a key light at the eye, which is
    // what makes a viewmodel's form read) SCALED by the room's own light at
    // the camera - the same `flatLightAt` answer MAC-I gives the classic
    // sprites, so the two lanes darken together. At full daylight the tint
    // is [1,1,1] and this is exactly the studio the pass used to install,
    // byte for byte; it only ever takes light AWAY, where the room has
    // none to give. Borrow-and-return, the same shape the UI read-back's
    // studio has had since PX23.
    const vmSaved = viewmodelLight ? {
      lightDir: this._lightDir, ambient: this._ambient, sunScale: this._sunScale,
      sunColor: this._sunColor, pointLights: this._pointLights, indirect: this._indirect,
      moonScale: this._moonScale,
    } : null;
    if (viewmodelLight) {
      const st = studioLight(view);
      this._lightDir = st.lightDir;
      this._ambient = new Float32Array([
        STUDIO_AMBIENT * viewmodelLight[0], STUDIO_AMBIENT * viewmodelLight[1], STUDIO_AMBIENT * viewmodelLight[2]]);
      this._sunScale = STUDIO_KEY;
      this._sunColor = new Float32Array([viewmodelLight[0], viewmodelLight[1], viewmodelLight[2]]);
      this._pointLights = st.pointLights;   // world-space lights have no meaning at this origin
      this._indirect = st.indirect;
      this._moonScale = 0;
    }
    try {
      return this._renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph, { lensLocal });
    } finally {
      if (vmSaved) {
        this._lightDir = vmSaved.lightDir; this._ambient = vmSaved.ambient; this._sunScale = vmSaved.sunScale;
        this._sunColor = vmSaved.sunColor; this._pointLights = vmSaved.pointLights; this._indirect = vmSaved.indirect;
        this._moonScale = vmSaved.moonScale;
      }
    }
  }

  /** The pass itself - MAC-P's light borrow wraps it above. */
  _renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph, { lensLocal = false } = {}) {
    const gl = this.gl;
    const cs = this._charSpriteRT();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    gl.viewport(0, 0, CHAR_SPRITE_RT_SIZE, CHAR_SPRITE_RT_SIZE);
    // AUDIT 26 F034: BORROWED and returned. The clear colour is global
    // GL state, and beginFrame (:1104) clears without setting one - so
    // leaving this transparent black behind repainted EVERY later
    // frame's uncovered pixels, visible before the sky panorama loads
    // and in skyless scenes.
    // EV6: the restore now reads the JS shadow (_clearColor, kept true
    // by the constructor and every borrower) instead of a synchronous
    // gl.getParameter round-trip per sprite frame; and the clear is
    // SCISSORED to the sprite's own pw x ph corner instead of wiping
    // the full 1024x1024 target - the quad only ever samples that
    // corner.
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, pw, ph);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, pw, ph);
    // AUDIT 39 F47/F48: THE FOG IS BORROWED OFF, the same borrow-and-
    // return shape as the clear colour and the studio light. Two things
    // make an offscreen fog wrong. The composite quad
    // (drawCharacterSpriteQuad) fogs the finished sprite at the rig's
    // own world point, so fogging inside the RT too darkened a
    // character as f^2 while the wall behind it went as f. And _camPos
    // is the WORLD camera - beginFrame is its only producer - while
    // this pass takes a private camera: the callers that draw at the
    // origin in a lens-local space (the FP viewmodel, the inventory
    // figure, the item icons) were fogged by the player's absolute
    // distance from the world origin, and the icon read-back baked that
    // darkness into its cache.
    // VC5 review: THE CLOUD DECK IS BORROWED OFF for a lens-local pass,
    // for the fog's second reason - the map is world-space and this
    // geometry sits at the origin, so the FP arm read the cloud over the
    // corner of the player's pixel, up to a kilometre away, and stepped
    // in brightness at every recenter while nothing else did. The
    // world-space callers (the rig sprite box, the third-person arm)
    // keep the deck: they are characters in the world.
    const sp = this._proj, sv = this._view, sf = this._fogMode;
    const sd = lensLocal ? this._cloudShadow : null;
    if (sd) { this._cloudShadow = null; this._csStamp++; }
    this._proj = proj; this._view = view; this._fogMode = 0;
    this._spriteDepth++;   // AUDIT-EL F2
    // AUDIT 65 RS-2: EVERY borrow above is returned in ONE finally, the
    // GL state first and the JS caches after. drawCharacter dereferences
    // the mesh (`mesh.vao`, `mesh.ranges`), so it can throw, and the
    // icon path SWALLOWS the throw (fpArm.js's `catch { img = null; }`)
    // - so a restore left below this block never runs and the session
    // carries on over it: the 1024x1024 sprite FBO stays bound for the
    // rest of the frame, the world rect stays at the sprite's corner,
    // and the clear colour stays transparent black FOREVER, because
    // setClearColor (:1953) is idempotent against the `_clearColor`
    // shadow this path no longer matches - AUDIT 26 F034's bug back,
    // permanently, off one caught exception.
    try { this.drawCharacter(mesh, modelMatrix); }
    finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameFbo ?? null);   // EL4: the frame, or the canvas
      // ROAD-E E5: the viewport is BORROWED here too. This pass runs in
      // the middle of the world pass (every voxel character composites
      // through it), so returning a hardcoded full canvas would undo a
      // docked large HUD's reduced rect for every draw after the first
      // character - the same borrow-and-return the clear colour above
      // has had since AUDIT 26 F034. With no world rect live it is the
      // full drawing buffer, exactly as before.
      this._restoreWorldViewport();
      const cc = this._clearColor;
      gl.clearColor(cc[0], cc[1], cc[2], cc[3]);
      this._proj = sp; this._view = sv; this._fogMode = sf;
      this._spriteDepth--;   // AUDIT-EL F2
      if (sd) { this._cloudShadow = sd; this._csStamp++; }
    }
    return cs.tex;
  }

  /** MW-D36: the same sprite render, READ BACK as pixels - the enhanced
   *  inventory's figure panel is DOM, not a world quad, so the body has
   *  to leave the GPU as an image. Y is flipped on the way out (GL rows
   *  run bottom-up); the RT is borrowed and returned exactly as above. */
  renderCharacterSpriteImage(mesh, modelMatrix, proj, view, pw, ph, { studio = true } = {}) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    // PX23 (Mac: the new sprites and the character display are quite
    // dark in the inventory): THE IMAGE IS LIT BY A STUDIO, NOT BY THE
    // WORLD. The sprite pass reads the frame's lighting - a dungeon's
    // ambient, a night's sun - which is right for a body standing in
    // that world and wrong for a picture on a UI panel. So the UI
    // read-back borrows the frame's light state, sets a neutral studio
    // (a bright even ambient, a full key light from the camera's own
    // direction, no point lights, no indirect) and returns every value
    // afterward, the same borrow-and-return the sprite RT already does
    // for the clear colour.
    const saved = studio ? {
      lightDir: this._lightDir, ambient: this._ambient, sunScale: this._sunScale,
      sunColor: this._sunColor, pointLights: this._pointLights, indirect: this._indirect,
      moonScale: this._moonScale,   // EV5: no moonlight on a UI panel
      cloudShadow: this._cloudShadow,   // VC4: no cloud shadow on lens-local geometry
    } : null;
    if (studio) {
      if (this._cloudShadow) { this._cloudShadow = null; this._csStamp++; }   // VC4
      const st = studioLight(view);
      this._lightDir = st.lightDir; this._ambient = st.ambient; this._sunScale = st.sunScale;
      this._sunColor = st.sunColor; this._pointLights = st.pointLights; this._indirect = st.indirect;
      this._moonScale = 0;
    }
    if (studio) this._studioDepth++;   // AUDIT-EL F1: a UI picture takes no eye
    try {
      this.renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph);
    } finally {
      if (saved) {
        this._lightDir = saved.lightDir; this._ambient = saved.ambient; this._sunScale = saved.sunScale;
        this._sunColor = saved.sunColor; this._pointLights = saved.pointLights; this._indirect = saved.indirect;
        this._moonScale = saved.moonScale;
        if (saved.cloudShadow) { this._cloudShadow = saved.cloudShadow; this._csStamp++; }   // VC4: the frame's deck back
      }
      if (studio) this._studioDepth--;   // AUDIT-EL F1: the eye back after the light
    }
    const cs = this._charSpriteRT();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    const raw = new Uint8Array(pw * ph * 4);
    // AUDIT 65 RS-2: the read-back's own bind is returned in a finally
    // for the same reason the sprite pass's is - this one runs under
    // itemIcon's catch too.
    try { gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, raw); }
    finally { gl.bindFramebuffer(gl.FRAMEBUFFER, this._frameFbo ?? null); }   // EL4
    const out = new Uint8ClampedArray(pw * ph * 4);
    for (let y = 0; y < ph; y++) out.set(raw.subarray(y * pw * 4, (y + 1) * pw * 4), (ph - 1 - y) * pw * 4);
    return { width: pw, height: ph, data: out };
  }

  /** Composite the sprite into the world: camera-facing quad at the
   *  character's position, alpha-cut, fogged, depth-tested. */
  drawCharacterSpriteQuad(tex, center, halfW, halfH, right, u1 = 1, v1 = 1) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    this._ensureCharQuadProgram();
    const [cx, cy, cz] = center, [rx, , rz] = right;
    const v = new Float32Array([
      cx - rx*halfW, cy - halfH, cz - rz*halfW, 0, 0,
      cx - rx*halfW, cy + halfH, cz - rz*halfW, 0, v1,
      cx + rx*halfW, cy + halfH, cz + rz*halfW, u1, v1,
      cx + rx*halfW, cy - halfH, cz + rz*halfW, u1, 0,
    ]);
    this._use(this.charQuadProgram);
    const c = this._charQuad;
    gl.uniformMatrix4fv(c.proj, false, this._proj);
    gl.uniformMatrix4fv(c.view, false, this._view);
    this._bindTex0(tex);   // PERF-TEX3
    gl.uniform1i(c.tex, 0);
    this._uploadFog(this._charQuad);
    this._bindVao(this._charQuadVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._charQuadVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, v);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    this.stats.texBinds++; this.stats.draws++;
    gl.enable(gl.CULL_FACE);
    this._bindVao(null);
  }

  /** PERF-WARM: build the character-sprite quad's program and VAO -
   *  the block that stood at the head of drawCharacterSpriteQuad,
   *  unchanged, so the first classic sprite does not compile it. */
  _ensureCharQuadProgram() {
    const gl = this.gl;
    if (!this.charQuadProgram) {
      const vs = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
uniform mat4 uProj, uView;
out vec2 vUV; out vec3 vWorld;
void main() { vUV = aUV; vWorld = aPos; gl_Position = uProj * uView * vec4(aPos, 1.0); }`;
      const fs = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vWorld;
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  if (uFogMode == 3) { float f = uFogDensity * d; return exp(-f * f); }   // DS1: FogMode.ExponentialSquared
  return exp(-uFogDensity * d);
}
void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.5) discard;
  outColor = vec4(mix(uFogColor, t.rgb, fogFactorAt(vWorld)), 1.0);
}`;
      this.charQuadProgram = this._buildProgram(vs, fs);
      const P = this.charQuadProgram;
      this._charQuad = {
        proj: gl.getUniformLocation(P, 'uProj'),
        view: gl.getUniformLocation(P, 'uView'),
        tex: gl.getUniformLocation(P, 'uTex'),
        fogColor: gl.getUniformLocation(P, 'uFogColor'),
        fogMode: gl.getUniformLocation(P, 'uFogMode'),
        fogDensity: gl.getUniformLocation(P, 'uFogDensity'),
        fogRange: gl.getUniformLocation(P, 'uFogRange'),
        camPos: gl.getUniformLocation(P, 'uCamPos'),
      };
      const vao = gl.createVertexArray();
      this._bindVao(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, 4 * 5 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      this._bindVao(null);
      this._charQuadVAO = vao; this._charQuadVBO = vbo;
    }
  }

  /** Fullscreen overlay of a sprite-RT sub-rect: no depth, no fog,
   *  alpha-cut - the FP viewmodel composite (E3d). Classic draws the
   *  weapon over everything. */
  /** Screen-space translation applied to every drawScreenQuad dst -
   *  the overlay letterbox seam (2026-08-14): classic windows lay out
   *  on a virtual 320x200*s screen and this centers that screen on
   *  the real canvas. Set, draw, reset - never leave it on. */
  setScreenOffset(x, y) { this._screenOffset = [x, y]; }
  /** The offset screen draws are currently shifted by. A full-canvas
   *  backdrop drawn from inside an offset overlay has to subtract it,
   *  or it lands displaced by the letterbox margin (U21b). */
  get screenOffset() { return this._screenOffset ?? [0, 0]; }

  /** Positioned screen-space quad in PIXELS (origin top-left), with a
   *  source UV rect - textured (uv0/uv1) or solid color (tex null).
   *  The UI arc's primitive (U1): compass window + vitals bars. */
  /** CG1: the UI scissor bracket - DFU's MultiFormatTextLabel
   *  RestrictedRenderArea seam. Top-left-origin canvas pixels, the
   *  same space drawScreenQuad's dst lives in (the screen-shake
   *  offset applies here too, so clip and content move together).
   *  SCISSOR_TEST also gates gl.clear, so every set MUST be closed by
   *  clearScreenScissor before the bracket's caller returns. */
  setScreenScissor(x, y, w, h) {
    const gl = this.gl;
    const ox = this._screenOffset?.[0] ?? 0, oy = this._screenOffset?.[1] ?? 0;
    const yTop = Math.round(y + oy), hh = Math.max(0, Math.round(h));
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(Math.round(x + ox), gl.drawingBufferHeight - yTop - hh, Math.max(0, Math.round(w)), hh);
  }

  clearScreenScissor() { this.gl.disable(this.gl.SCISSOR_TEST); }

  /**
   * ROAD-C c2/S10: THE SCISSOR-ONLY BRACKET, and it exists for the same
   * reason beginPanelFrame does - the renderer owns GL state, and a
   * leaked SCISSOR_TEST silently blanks the next host frame's clear
   * rather than erroring (see setScreenScissor's own warning).
   *
   * The exterior automap needs a clipped region but NOT a panel frame:
   * it is a CPU composition of screen quads drawn OVER the window art
   * that is already on the canvas, so beginPanelFrame's beginFrame -
   * which resizes the canvas and clears it - would wipe the chrome it
   * is composing into. This is the narrow bracket for that case: set,
   * run, clear, in a finally, so a throwing body cannot leave the
   * scissor on.
   */
  screenScissor(rect, body) {
    this.setScreenScissor(rect.x, rect.y, rect.w, rect.h);
    try { return body(); } finally { this.clearScreenScissor(); }
  }

  drawScreenQuad(tex, dst, src = { u0: 0, v0: 0, u1: 1, v1: 1 }, color = [1, 1, 1, 1], opts = {}) {
    const gl = this.gl;
    // ROAD-E E5: THE 2D PASS ENDS THE WORLD PASS. This is the port's
    // only screen-space primitive, so the first one drawn after a
    // shrunk world pass is exactly where the full canvas has to come
    // back - the reduced rect is renderer-owned frame state, not a
    // call every host has to remember (and forget once).
    if (this._worldViewportPx) this.endWorldPass();
    this._compositeAir();   // EL3: a no-op unless a render is owed
    this._ensureScreenQuadProgram();
    this._use(this.screenQuadProgram);
    this._open2D(this._screenQuadVao);   // PERF-2D: a RUN's bracket, not a quad's
    const ox = this._screenOffset?.[0] ?? 0, oy = this._screenOffset?.[1] ?? 0;
    gl.uniform4f(this._screenQuad.dst, dst.x + ox, dst.y + oy, dst.w, dst.h);
    // PERF-UI: THE FOUR THAT ARE NOT A QUAD'S OWN. `dst` and `src` above
    // and below really do change every call; the canvas size is the
    // FRAME's, and useTex/blendTex/rotOn/colour are the same for every
    // quad of a run - a row of icons, a bar, a panel's backdrop. The HUD
    // draws a hundred-odd of these a frame in every scene there is, so
    // each was going up a hundred-odd times to say what it already said.
    // Shadowed on VALUE, so a caller that really changes one still
    // uploads: setting a uniform to what it already holds is a no-op by
    // definition, and this is only the removal of those.
    const q = this._sq;
    if (q.cw !== gl.drawingBufferWidth || q.ch !== gl.drawingBufferHeight) {
      gl.uniform2f(this._screenQuad.canvas, gl.drawingBufferWidth, gl.drawingBufferHeight);
      q.cw = gl.drawingBufferWidth; q.ch = gl.drawingBufferHeight;
    }
    gl.uniform4f(this._screenQuad.src, src.u0, src.v0, src.u1, src.v1);
    if (q.r !== color[0] || q.g !== color[1] || q.b !== color[2] || q.a !== color[3]) {
      gl.uniform4f(this._screenQuad.color, color[0], color[1], color[2], color[3]);
      q.r = color[0]; q.g = color[1]; q.b = color[2]; q.a = color[3];
    }
    const useTex = tex ? 1 : 0, blendTex = (tex && opts.blend) ? 1 : 0;
    if (q.useTex !== useTex) { gl.uniform1i(this._screenQuad.useTex, useTex); q.useTex = useTex; }
    if (q.blendTex !== blendTex) { gl.uniform1i(this._screenQuad.blendTex, blendTex); q.blendTex = blendTex; }
    // c2/S10: opts.rotate = { rad, px, py } - the pivot is in the SAME
    // space dst is (the screen offset applies to both, so a rotated
    // quad and its unrotated siblings letterbox together).
    const rot = opts.rotate ?? null;
    const rotOn = rot ? 1 : 0;
    if (q.rotOn !== rotOn) { gl.uniform1i(this._screenQuad.rotOn, rotOn); q.rotOn = rotOn; }
    if (rot) {
      gl.uniform4f(this._screenQuad.rot, Math.cos(rot.rad), Math.sin(rot.rad), rot.px + ox, rot.py + oy);
    }
    // The sampler binding went up with the program; only the texture is a
    // quad's own. (Not `_bindEmission`'s shadow: that one speaks for unit
    // 1, this is unit 0, and the 2D pass is the far side of endWorldPass.)
    if (tex) this._bindTex0(tex);   // PERF-TEX3: a HUD draws ninety quads off one sheet
    // U10: a SOLID quad's alpha was written straight out with blending
    // OFF, so every translucent UI panel in the port drew OPAQUE -
    // DaggerfallUI.ScreenDimColor (0,0,0,0.5) blacked the screen out
    // behind a modal window instead of dimming it, and the same went
    // for the talk/rest/action panels and the char-sheet backdrops.
    // Sixteen call sites had been authoring alpha that never applied.
    // Textured quads keep their existing law (discard a<0.5, opaque
    // rgb) so no art path changes - unless the CALLER opts in with
    // { blend: true }, which only ui/titleScreen.js does (U21c).
    const blend = screenQuadBlends(tex, color, opts);
    if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    this.stats.draws++;
    if (blend) gl.disable(gl.BLEND);
    // PERF-2D: the run stays open - _close2D hands the baseline back at
    // the head of whatever needs it next.
  }

  /** PERF-WARM: build the screen-quad program, its sampler binding and
   *  its VAO - the block that stood at the head of drawScreenQuad,
   *  unchanged. This is the 2D blit every UI surface goes through. */
  _ensureScreenQuadProgram() {
    const gl = this.gl;
    if (!this.screenQuadProgram) {
      const vs = `#version 300 es
layout(location=0) in vec2 aPos;
uniform vec4 uDst;      // x, y, w, h in pixels (top-left origin)
uniform vec2 uCanvas;
uniform vec4 uSrc;      // u0, v0, u1, v1
uniform vec4 uRot;      // cos, sin, pivotX, pivotY (screen pixels)
uniform int uRotOn;
out vec2 vUV;
void main() {
  vec2 p = aPos * 0.5 + 0.5;                     // 0..1
  vUV = mix(uSrc.xy, uSrc.zw, vec2(p.x, p.y));
  vec2 px = uDst.xy + p * uDst.zw;
  // ROAD-C c2/S10: the ONE new GL of the exterior automap. DFU's town
  // map is a world quad seen by an orthographic camera that is rotated
  // about -up, so its layout texture, its arrow and its stamp all draw
  // TURNED. This is that turn, in the screen-quad's own space: a plain
  // 2D rotation about a pixel pivot, applied AFTER uDst places the
  // rect. It deliberately does NOT touch mirrorProjectionX - screen
  // quads run with CULL_FACE disabled and have no facing to mirror.
  if (uRotOn == 1) {
    vec2 d = px - uRot.zw;
    px = uRot.zw + vec2(d.x * uRot.x - d.y * uRot.y, d.x * uRot.y + d.y * uRot.x);
  }
  vec2 ndc = vec2(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;
      const fs = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform int uUseTex;
uniform int uBlendTex;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  if (uUseTex == 1) {
    vec4 t = texture(uTex, vUV);
    // U21c: the opt-in arm. Classic art is a 1-BIT cutout (palette index
    // 0 transparent, every other index fully opaque), so the default
    // discards and forces alpha 1 - correct for every IMG/CIF/texture in
    // the game. Art authored OUTSIDE that palette (our logo) carries real
    // partial alpha: anti-aliased edges and a soft shadow, which the
    // threshold would turn into jagged gold and a hard silhouette.
    if (uBlendTex == 1) { outColor = vec4(t.rgb * uColor.rgb, t.a * uColor.a); }
    else { if (t.a < 0.5) discard; outColor = vec4(t.rgb, 1.0) * uColor; }
  }
  else outColor = uColor;
}`;
      this.screenQuadProgram = this._buildProgram(vs, fs);
      this._screenQuad = {
        dst: gl.getUniformLocation(this.screenQuadProgram, 'uDst'),
        canvas: gl.getUniformLocation(this.screenQuadProgram, 'uCanvas'),
        src: gl.getUniformLocation(this.screenQuadProgram, 'uSrc'),
        tex: gl.getUniformLocation(this.screenQuadProgram, 'uTex'),
        useTex: gl.getUniformLocation(this.screenQuadProgram, 'uUseTex'),
        blendTex: gl.getUniformLocation(this.screenQuadProgram, 'uBlendTex'),
        color: gl.getUniformLocation(this.screenQuadProgram, 'uColor'),
        rot: gl.getUniformLocation(this.screenQuadProgram, 'uRot'),
        rotOn: gl.getUniformLocation(this.screenQuadProgram, 'uRotOn'),
      };
      // PERF-UI: the sampler binding is a CONSTANT for the life of the
      // program - uTex is unit 0 and never anything else - so it goes up
      // once here instead of once a quad. The shadow is born empty with
      // it: an empty shadow knows nothing, so the next quad uploads the
      // lot, which is exactly what every reset point below wants.
      this._sq = {};
      this._use(this.screenQuadProgram);
      gl.uniform1i(this._screenQuad.tex, 0);
      const vao = gl.createVertexArray();
      this._bindVao(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      this._bindVao(null);
      this._screenQuadVao = vao;
    }
  }

  drawScreenQuadRun(tex, quads, color = [1, 1, 1, 1]) {
    const gl = this.gl;
    const n = quads?.length ?? 0;
    if (!tex || !n) return;
    // The same law drawScreenQuad opens with (ROAD-E E5): the first 2D
    // primitive after a shrunk world pass is where the canvas returns.
    if (this._worldViewportPx) this.endWorldPass();
    this._compositeAir();   // EL3: a no-op unless a render is owed
    this._ensureScreenQuadRunProgram();
    if (this._screenQuadRunData.length < n * 8) this._screenQuadRunData = new Float32Array(n * 8);
    const a = this._screenQuadRunData;
    const ox = this._screenOffset?.[0] ?? 0, oy = this._screenOffset?.[1] ?? 0;
    for (let i = 0; i < n; i++) {
      const { dst, src } = quads[i], o = i * 8;
      a[o] = dst.x + ox; a[o + 1] = dst.y + oy; a[o + 2] = dst.w; a[o + 3] = dst.h;
      a[o + 4] = src.u0; a[o + 5] = src.v0; a[o + 6] = src.u1; a[o + 7] = src.v1;
    }
    this._use(this.screenQuadRunProgram);
    this._open2D(this._screenQuadRunVao);   // PERF-2D
    gl.bindBuffer(gl.ARRAY_BUFFER, this._screenQuadRunVbo);
    if (this._screenQuadRunCap < n) { gl.bufferData(gl.ARRAY_BUFFER, a.byteLength, gl.STREAM_DRAW); this._screenQuadRunCap = a.length / 8; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, a, 0, n * 8);
    gl.uniform2f(this._screenQuadRun.canvas, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform4f(this._screenQuadRun.color, color[0], color[1], color[2], color[3]);
    this._bindTex0(tex); gl.uniform1i(this._screenQuadRun.tex, 0);   // PERF-TEX3
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, n);
    this.stats.draws++;
  }

  /** PERF-WARM: build the instanced screen-quad program and its two
   *  VAO streams - the block that stood at the head of
   *  drawScreenQuadRun, unchanged. */
  _ensureScreenQuadRunProgram() {
    const gl = this.gl;
    if (!this.screenQuadRunProgram) {
      const vs = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec4 aDst;   // x, y, w, h in pixels (top-left origin), per INSTANCE
layout(location=2) in vec4 aSrc;   // u0, v0, u1, v1, per INSTANCE
uniform vec2 uCanvas;
out vec2 vUV;
void main() {
  vec2 p = aPos * 0.5 + 0.5;                     // 0..1
  vUV = mix(aSrc.xy, aSrc.zw, vec2(p.x, p.y));
  vec2 px = aDst.xy + p * aDst.zw;
  vec2 ndc = vec2(px.x / uCanvas.x * 2.0 - 1.0, 1.0 - px.y / uCanvas.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;
      // The 1-BIT CUTOUT law, verbatim from the fragment stage above -
      // a run is always the default (non-blend) arm, because the only
      // caller is text and text is classic art.
      const fs = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec4 uColor;
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUV);
  if (t.a < 0.5) discard;
  outColor = vec4(t.rgb, 1.0) * uColor;
}`;
      this.screenQuadRunProgram = this._buildProgram(vs, fs);
      this._screenQuadRun = {
        canvas: gl.getUniformLocation(this.screenQuadRunProgram, 'uCanvas'),
        tex: gl.getUniformLocation(this.screenQuadRunProgram, 'uTex'),
        color: gl.getUniformLocation(this.screenQuadRunProgram, 'uColor'),
      };
      const vao = gl.createVertexArray();
      this._bindVao(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
      // the per-instance stream: eight floats a quad, grown in place
      this._screenQuadRunVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this._screenQuadRunVbo);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0);
      gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16);
      gl.vertexAttribDivisor(2, 1);
      this._bindVao(null);
      this._screenQuadRunVao = vao;
      this._screenQuadRunData = new Float32Array(0);
      this._screenQuadRunCap = 0;
    }
  }

    drawScreenOverlayQuad(tex, u1, v1) {
    const gl = this.gl;
    this._ensureOverlayProgram();
    this._use(this.overlayProgram);
    this._activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.uniform1i(this._overlay.tex, 0);
    gl.uniform2f(this._overlay.uv1, u1, v1);
    this._open2D(this._overlayVAO);   // PERF-2D
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    this.stats.texBinds++; this.stats.draws++;
  }

  /** PERF-WARM: build the full-screen overlay program and its VAO -
   *  the block that stood at the head of drawScreenOverlayQuad,
   *  unchanged. */
  _ensureOverlayProgram() {
    const gl = this.gl;
    if (!this.overlayProgram) {
      const vs = `#version 300 es
layout(location=0) in vec2 aPos;
uniform vec2 uUV1;
out vec2 vUV;
void main() { vUV = (aPos * 0.5 + 0.5) * uUV1; gl_Position = vec4(aPos, 0.0, 1.0); }`;
      const fs = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 outColor;
void main() { vec4 t = texture(uTex, vUV); if (t.a < 0.5) discard; outColor = vec4(t.rgb, 1.0); }`;
      this.overlayProgram = this._buildProgram(vs, fs);
      this._overlay = {
        tex: gl.getUniformLocation(this.overlayProgram, 'uTex'),
        uv1: gl.getUniformLocation(this.overlayProgram, 'uUV1'),
      };
      const vao = gl.createVertexArray();
      this._bindVao(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this._bindVao(null);
      this._overlayVAO = vao;
    }
  }

  /** Upload a getColor32 result as a REPEAT/NEAREST texture, keyed and cached.
   *
   *  REPEAT/NEAREST is the law for GAME art and stays the default: classic
   *  textures tile, and NEAREST is what keeps a 320x200 IMG pixel-exact at
   *  the integer scales nativePanel picks. U21c adds an opt-in for art
   *  authored outside that world - our logo is a high-resolution banner
   *  drawn at a NON-integer scale, where NEAREST aliases the serifs and
   *  REPEAT lets a LINEAR tap at the border sample the opposite edge.
   *  { smooth: true } gives it LINEAR/CLAMP_TO_EDGE instead.
   *
   *  INCIDENT 2026-09-04, reworded AUDIT 62 F27: the '#opaque' variant in
   *  the key below is OUR device, not a DFU law. DFU's material cache is
   *  keyed by (archive, record, frame) plus a key GROUP and nothing else
   *  (MaterialReader.cs:961, hit at :387-392) - alphaIndex is not in the
   *  key, and it is the FIRST requester that fixes both the alpha
   *  treatment and the shader every later asker receives (:409, :429-432).
   *  A mesh (alphaIndex -1, :352) and a non-atlas flat (alphaIndex 0,
   *  DaggerfallBillboard.cs:289-296) therefore share ONE entry there; it
   *  never shows, because GetColor32 keeps RGB and only zeroes the alpha
   *  (BaseImageFile.cs:257-260) while DaggerfallDefault.shader:24 is
   *  Opaque with no clip, and the ordinary flat rides the separate atlas
   *  key group (:553). OUR two shaders DO read that alpha differently -
   *  the billboard shader discards on it - so one GL texture cannot carry
   *  both treatments and the -1 (mesh) and 0 (flat) uploads must key
   *  apart. The '#ui' variant is the same argument for the mip chain. */
  uploadTexture(archive, record, color32, opts = {}) {
    // (see textureParams below - the decision is pure and pinned there)
    // AUDIT 19 F10: the SAMPLING MODE is part of the key. The cache is
    // keyed by archive/record and returns early on a hit, so asking for
    // { smooth: true } under a key already uploaded NEAREST/REPEAT used to
    // hand back the wrong sampling silently. Only the logo asks for smooth
    // today and its key is unique, so nothing was broken - but a cache
    // that quietly ignores an argument is a trap, not a cache.
    const key = `${archive}_${record}${opts.smooth ? '#smooth' : ''}${opts.opaque ? '#opaque' : ''}${opts.mips === false ? (opts.variant ?? '#ui') : ''}`;   // INCIDENT 2026-09-04: DFU caches materials per alphaIndex; REVIEW 2026-09-05: the un-mipped UI variant of a world archive (item icons) keys apart too; AUDIT 61: `variant: ''` keeps the plain batch key for world art uploaded without a chain (a mod atlas built mipChain:false - SIB1)
    if (this.textures.has(key)) return this.textures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      // AUDIT 19 F7: respect the VIEW, not its backing buffer. Reaching
      // through `.buffer` discards byteOffset and length, so any caller
      // handing over a subarray - the video player hands a live view onto
      // the reader's persistent frame buffer - would have uploaded the
      // whole buffer from zero. Nothing did that wrongly today; it is a
      // trap that would have gone unnoticed because the pin watching it
      // shared the same blind spot.
      gl.RGBA, gl.UNSIGNED_BYTE, color32Bytes(color32, `uploadTexture(${archive}, ${record})`)   // WW3: the shape's own error, not a TypeError three frames down
    );
    const { wrap, filter } = textureParams(gl, opts);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    // INCIDENT 2026-09-04: every classic texture DFU builds carries a mip
    // chain (TextureReader.cs:31 `mipMaps = true`, :264 Apply(true)) and
    // samples it POINT (MaterialReader.cs:104/:437, FilterMode.Point =
    // nearest texel, nearest mip). Without the chain a one-texel line
    // keeps full contrast at every distance and shimmers as the camera
    // moves; with it the line dissolves into the wall a few metres out,
    // which is what DFU shows. The smooth (UI) upload keeps LINEAR.
    // REVIEW 2026-09-05: the chain is WORLD art's - a TEXTURE.nnn archive
    // (numeric). UI art comes through ImageReader.GetTexture with
    // mipChain false (ImageReader.cs:59), the automaps and the video
    // likewise; those string-keyed uploads keep a single NEAREST level.
    const mips = !opts.smooth && (opts.mips ?? (typeof archive === 'number'));
    if (mips) gl.generateMipmap?.(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? (gl.NEAREST_MIPMAP_NEAREST ?? filter) : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    this.textures.set(key, tex);
    this._texGen++;   // EV2: cached sub-mesh lookups refresh
    return tex;
  }

  /** AUDIT 17e F27 / EVERY ALLOCATION HAS AN OWNER: release one
   *  uploaded texture. uploadTexture memoizes by key and never freed,
   *  which is right for archive/record art (finite, reused) but wrong
   *  for the paperdoll, which mints a NEW versioned key per refresh -
   *  an ~81 KB RGBA texture leaked on every equip click. */
  releaseTexture(archive, record) {
    // AUDIT 19 F10: releases BOTH sampling variants. uploadTexture now
    // folds the mode into the key, so a caller that released only the
    // plain key would leave a smooth upload permanently unreachable -
    // fixing the cache bug by creating a leak.
    const base = record === undefined ? archive : `${archive}_${record}`;
    let freed = false;
    for (const key of [base, `${base}#smooth`, `${base}#opaque`, `${base}#ui`]) {   // REVIEW 2026-09-05: every variant
      const tex = this.textures.get(key);
      if (!tex) continue;
      this.gl.deleteTexture(tex);
      this.textures.delete(key);
      freed = true;
    }
    // AUDIT 39 F51: the EV2 generation covers BOTH directions of the
    // map. A sub-mesh stamps its resolved texture and re-reads it while
    // the generation holds, so a delete that did not bump left it
    // binding a deleted WebGLTexture (INVALID_OPERATION, incomplete
    // black) until some unrelated upload happened to bump.
    if (freed) this._texGen++;
    return freed;
  }

  /** Build a VAO bundle from meshReader output. */
  createMesh(model) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    this._bindVao(vao);

    const buffers = [];
    const buf = (target, data) => {
      const b = gl.createBuffer();
      gl.bindBuffer(target, b);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      buffers.push(b);
      return b;
    };
    buf(gl.ARRAY_BUFFER, model.positions);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    buf(gl.ARRAY_BUFFER, model.normals);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    buf(gl.ARRAY_BUFFER, model.uvs);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    buf(gl.ELEMENT_ARRAY_BUFFER, model.indices);

    this._bindVao(null);
    // EL5: the bounds the shadow replays cull by - the mesh's sphere and one
    // per sub-mesh (a static batch is a whole block in one mesh; its walls
    // are its sub-meshes). Local space; the record transforms them.
    const bounds = boundsOf(model.positions);
    const subMeshes = model.subMeshes.map((sm) => ({ ...sm, _bounds: boundsOf(model.positions, model.indices, sm.startIndex, sm.primitiveCount * 3) }));
    // HOTFIX 2026-08-31 (field crash, Firefox): the sub-meshes are
    // COPIED, never shared with the model. drawMesh's EV2 texture
    // cache stamps `_evTex`/`_evGen`/... onto each sub-mesh, and the
    // windmill bake ships its sub-meshes as FROZEN module constants
    // (windmillMesh.js) - `sm._evTex = tex` on a frozen object is a
    // strict-mode TypeError, so the first mill drawn took the whole
    // frame loop down ("can't define property _evTex: Object is not
    // extensible"). The renderer may only stamp renderer-private
    // fields on objects it OWNS; a shallow copy at upload time makes
    // that true for every mesh, present and future, at build cost
    // only.
    // c2/S6: `triIndices` is a REFERENCE to the model's own index array,
    // never a copy - it is what drawMeshWire expands into edge pairs the
    // first time a mesh is drawn in the automap's wireframe mode. A
    // bundle built without it simply cannot be wireframed (drawMeshWire
    // draws nothing), which is the honest answer for a hand-built one.
    return { vao, subMeshes, buffers, triIndices: model.indices, bounds };
  }

  /** INCIDENT 2026-09-04: CameraClearManager.cs:23-25/:51-57 - inside,
   *  the camera clears to solid BLACK (cameraClearInterior =
   *  CameraClearFlags.Color, cameraClearColor = Color.black); outside
   *  it clears depth only behind the sky. The port cleared every host
   *  to the Iliac Bay's sky blue, so any crack in a dungeon read as a
   *  glowing line instead of nothing. Idempotent: the shadow decides. */
  setClearColor(rgba) {
    const cc = this._clearColor;   // a Float32Array: compare at its precision, or a 0.53 never matches itself
    if (cc[0] === Math.fround(rgba[0]) && cc[1] === Math.fround(rgba[1]) && cc[2] === Math.fround(rgba[2]) && cc[3] === Math.fround(rgba[3])) return;
    cc[0] = rgba[0]; cc[1] = rgba[1]; cc[2] = rgba[2]; cc[3] = rgba[3];
    this.gl.clearColor(rgba[0], rgba[1], rgba[2], rgba[3]);
  }

  beginFrame(proj, view, lightDir, opts = null) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const s = this.stats;
    s.draws = 0; s.programBinds = 0; s.vaoBinds = 0; s.texBinds = 0; s.bbCulled = 0;   // PERF-CROWD2
    // VC4: the cloud shadow deck is a FRAME's, not the renderer's - a host
    // that wants one sets it after this (the exterior hosts do, per
    // pixel); an interior or a dungeon, which never does, gets none, and
    // never inherits the last exterior frame's map onto its walls.
    // VC6c: `_deckOwed` keeps it one moment longer, for an image the air pass still owes this frame (airPass.setCloudShadow); `_beginLane` drops it the instant that resolve is done.
    if (this._cloudShadow) { this._deckOwed = this._cloudShadow; this._cloudShadow = null; this._csStamp++; }
    // EV6: the shadows reset with the counters - whatever ran between
    // frames (UI passes, another context's work) is not trusted. The
    // cloud-shadow upload stamps are the same kind of claim (RS-3) and
    // reset here too, not only behind the conditional deck bump above.
    this._lastProgram = null;
    this._lastVao = null;
    this._csUploaded = {};
    const gl = this.gl;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // ROAD-E E5: ...and then the docked large HUD's rect over it, if a
    // host set one for this frame. The pending slot is CONSUMED here,
    // so the next frame must ask again (ViewportChanger.Update does).
    // The gl.clear below is NOT viewport-clipped (only the scissor
    // clips a clear), so the strip the bar covers still clears - which
    // is what Unity does too, the bar simply paints over it.
    {
      const r = this._worldViewportPending;
      this._worldViewportPending = null;
      const W = this.canvas.width, H = this.canvas.height;
      this._worldViewportPx = r
        ? [Math.round(r.x * W), Math.round(r.y * H),
          Math.max(0, Math.round(r.w * W)), Math.max(0, Math.round(r.h * H))]
        : null;
      if (this._worldViewportPx) this._restoreWorldViewport();
    }
    this._beginLane(proj, view, lightDir, opts?.world === true);   // EL2/EL3/EL4: the maps, the images and the frame, before the clear
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this._use(this.program);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform3fv(this.uLightDir, lightDir);
    this._lightDir = lightDir;
    this._frameStamp++;   // PERF3
    gl.uniform3fv(this.uAmbient, this._c3(this._ambient));   // EL1: every colour goes up as the installed set wants it (_c3)
    this._uploadTrilight();
    gl.uniform1f(this.uSunScale, this._sunScale);
    gl.uniform3fv(this.uSunColor, this._c3(this._sunColor));
    gl.uniform3fv(this.uMoonDir, this._moonDir);
    gl.uniform1f(this.uMoonScale, this._moonScale);
    gl.uniform3fv(this.uMoonColor, this._c3(this._moonColor));
    gl.uniform3fv(this.uLight3Dir, this._light3Dir);
    gl.uniform1f(this.uLight3Scale, this._light3Scale);
    gl.uniform3fv(this.uLight3Color, this._c3(this._light3Color));
    gl.uniform1i(this.uTex, 0);
    gl.uniform1i(this.uEmissionTex, 1);
    gl.uniform3fv(this.uEmissionColor, this._c3(this._windowEmission));
    this._emissionColorUp = this._windowEmission;   // F49: the per-sub-mesh shadow starts the frame true
    this._forgetTextureShadows();   // PERF-TEX: a frame's; the post passes (air, clouds) own the units between frames
    const count = this._pointLights.length / 4;
    gl.uniform1i(this.uPointCount, count);
    if (count > 0) gl.uniform4fv(this.uPointLights, this._pointLights);
    if (count > 0) gl.uniform3fv(this.uPointColors, this._pointColorData(count));
    gl.uniform4fv(this.uIndirect, this._indirect);
    gl.uniform3fv(this.uIndirectColor, this._c3(this._indirectColor));
    this._uploadEl('mesh');   // EL1
    // Camera position from the view matrix (view = R^T * T(-eye)).
    const v = view;
    this._camPos[0] = -(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]);
    this._camPos[1] = -(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]);
    this._camPos[2] = -(v[8] * v[12] + v[9] * v[13] + v[10] * v[14]);
    this._uploadFog(this._solidFog);
    this._activeTexture(gl.TEXTURE0);
    this._proj = proj;
    this._view = view;
  }

  /**
   * ROAD-C c2/S2 - THE PANEL BRACKET. A second camera frame confined
   * to a rectangle of the real canvas, opened and CLOSED by the
   * renderer itself. EV6's law is that the renderer owns GL state, so
   * this lives here and not in a ui/ module holding its own
   * save/restore list one import away from a second copy: three such
   * copies already existed (both automap windows and the bank's model
   * preview) and every one of them leaked something.
   *
   * THE ORDER IS NOT FREE, and both halves of it are load-bearing:
   *  - the SCISSOR goes on BEFORE beginFrame, because SCISSOR_TEST
   *    also gates gl.clear (setScreenScissor's own warning) - the
   *    clear beginFrame issues must not escape the panel;
   *  - the VIEWPORT goes on AFTER it, because beginFrame's own
   *    gl.viewport is full-canvas (and beginFrame may resize the
   *    canvas first, which is also why the scissor is re-armed after).
   *
   * THE CLEAR IS DFU'S, not black. cameraAutomap.clearFlags is
   * SolidColor (Automap.cs:2012) and backgroundColor is never
   * assigned, so it is Unity's default (49,77,121,5)/255 - alpha
   * 5/255, TWO PERCENT - and the render texture is alpha-blended over
   * the panel. That near-transparent clear is exactly what lets
   * AMAP00I0's map-area art and the three alternative backgrounds
   * show through empty map space; an opaque black clear silently
   * deletes the feature. The port draws DIRECTLY over the background
   * already on the canvas, so the "clear" is a DEPTH-ONLY clear
   * (colorMask off across beginFrame's clear) plus a BLENDED
   * full-panel quad at that colour.
   *
   * `rect` is real canvas pixels, top-left origin - drawScreenQuad's
   * space, with the letterbox offset already applied by the caller.
   */
  beginPanelFrame(proj, view, lightDir, rect, clearRGBA = PANEL_CLEAR_RGBA, setup = null) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    if (this._panelSaved) throw new Error('beginPanelFrame: already inside a panel frame');
    const gl = this.gl;
    // EVERY global this pass can touch, saved by name. A thirteenth
    // one added to the renderer later must be added HERE - the source
    // pin in test/roadc_panelframe.test.js is what enforces it.
    this._panelSaved = {
      screenOffset: this._screenOffset ? [...this._screenOffset] : [0, 0],
      clipY: this._clipY,
      automapMode: this._automapMode,
      automapWaterLevel: this._automapWaterLevel,
      automapWaterColor: [...this._automapWaterColor],
      fogMode: this._fogMode,
      fogDensity: this._fogDensity,
      fogRange: [this._fogRange[0], this._fogRange[1]],
      fogColor: this._fogColor,
      ambient: this._ambient,
      sunScale: this._sunScale,
      sunColor: this._sunColor,
      clockLit: this._clockLit,
      moonScale: this._moonScale,
      moonDir: [...this._moonDir],
      moonColor: [...this._moonColor],
      light3Scale: this._light3Scale,
      light3Dir: [...this._light3Dir],
      light3Color: [...this._light3Color],
      windowEmission: this._windowEmission,
      pointLights: this._pointLights,
      pointColor: this._pointColor,
      pointColors: this._pointColors,
      indirect: [this._indirect[0], this._indirect[1], this._indirect[2], this._indirect[3]],
      indirectColor: this._indirectColor,
      clearColor: [this._clearColor[0], this._clearColor[1], this._clearColor[2], this._clearColor[3]],
      proj: this._proj,
      view: this._view,
      lightDir: this._lightDir,
      camPos: [this._camPos[0], this._camPos[1], this._camPos[2]],
      // ROAD-E E5: the world pass's reduced viewport is a global this
      // pass takes too. Nothing has to CLEAR it here - the beginFrame
      // below consumes an empty pending slot and nulls it, so the
      // panel's own clear quad cannot be read as "the 2D pass has
      // begun" - but it does have to come back, or a window opened
      // mid-frame would hand the host a full canvas it never asked
      // for.
      worldViewportPx: this._worldViewportPx,
      rect,
    };
    this.setScreenOffset(0, 0);
    // `setup` runs AFTER the save and BEFORE beginFrame, which is the
    // only window in which a pass can choose its own fog/lighting:
    // those setters merely shadow, and beginFrame is what uploads
    // them. A caller that sets them before entering the bracket would
    // have its own overrides saved as the "entry" state and restored
    // on the way out - the leak this bracket exists to end.
    if (setup) setup();
    // AUDIT-EL F7: THE PANEL DRAWS ON THE CLASSIC SET. The automap's unlit
    // bracket and the bank's preview are pictures, not the world: under the
    // lane they came through the tonemap and the eye's multiplier, a map
    // whose brightness drifted with the dungeon the player had just stood
    // in. The lane is suspended for the bracket and put back after it.
    this._panelLane = this._lane;
    if (this._lane) { this._lane = null; this._installWorldSet(this._classicSet); }
    this.setScreenScissor(rect.x, rect.y, rect.w, rect.h);   // BEFORE beginFrame - SCISSOR_TEST gates gl.clear
    gl.colorMask(false, false, false, false);                // ...and the colour half of that clear must not land
    this.beginFrame(proj, view, lightDir);
    gl.colorMask(true, true, true, true);
    // beginFrame may have resized the canvas; re-arm the scissor and
    // take the viewport it just set to full-canvas.
    this.setScreenScissor(rect.x, rect.y, rect.w, rect.h);
    gl.viewport(
      Math.round(rect.x), Math.round(this.canvas.height - (rect.y + rect.h)),
      Math.max(0, Math.round(rect.w)), Math.max(0, Math.round(rect.h)),
    );
    // the DFU clear, blended over whatever the panel already shows
    if (clearRGBA) {
      this.drawScreenQuad(null, { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, undefined,
        [clearRGBA[0], clearRGBA[1], clearRGBA[2], clearRGBA[3]]);
      gl.viewport(
        Math.round(rect.x), Math.round(this.canvas.height - (rect.y + rect.h)),
        Math.max(0, Math.round(rect.w)), Math.max(0, Math.round(rect.h)),
      );
    }
  }

  /** Close the bracket: every global back to its entry value, the
   *  viewport and scissor back to the host's, the draw state back to
   *  the renderer's baseline, and ONE markForeignPass - the pass ran
   *  its own programs and the shadows must not be trusted. */
  endPanelFrame() {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const s = this._panelSaved;
    if (!s) return;
    this._panelSaved = null;
    if (this._panelLane) { this._lane = this._panelLane; this._installWorldSet(this._laneSet); }   // AUDIT-EL F7: the lane back
    this._panelLane = null;
    const gl = this.gl;
    this.setClipY(s.clipY);
    this.setAutomapMode(s.automapMode);
    this.setAutomapWater(s.automapWaterLevel, s.automapWaterColor);
    this.setFog(FOG_MODE_NAMES[s.fogMode] ?? 'off', s.fogDensity, s.fogRange[0], s.fogRange[1], s.fogColor);
    this.setLighting(s.ambient, s.sunScale, s.sunColor);
    this._clockLit = s.clockLit;
    this.setMoonlight(s.moonScale ? { scale: s.moonScale, dir: s.moonDir, color: s.moonColor } : null);
    this._moonDir[0] = s.moonDir[0]; this._moonDir[1] = s.moonDir[1]; this._moonDir[2] = s.moonDir[2];
    this._moonColor[0] = s.moonColor[0]; this._moonColor[1] = s.moonColor[1]; this._moonColor[2] = s.moonColor[2];
    this.setThirdLight(s.light3Scale ? { scale: s.light3Scale, dir: s.light3Dir, color: s.light3Color } : null);
    this._light3Dir[0] = s.light3Dir[0]; this._light3Dir[1] = s.light3Dir[1]; this._light3Dir[2] = s.light3Dir[2];
    this._light3Color[0] = s.light3Color[0]; this._light3Color[1] = s.light3Color[1];
    this._light3Color[2] = s.light3Color[2];
    this.setWindowEmission(s.windowEmission);
    this.setPointLights(s.pointLights, s.pointColor, s.pointColors);
    this.setIndirectLight([s.indirect[0], s.indirect[1], s.indirect[2]], s.indirect[3], s.indirectColor);
    this._proj = s.proj; this._view = s.view; this._lightDir = s.lightDir;
    this._frameStamp++;   // PERF3: a restored state is a new frame to the terrain block
    this._camPos[0] = s.camPos[0]; this._camPos[1] = s.camPos[1]; this._camPos[2] = s.camPos[2];
    this._clearColor[0] = s.clearColor[0]; this._clearColor[1] = s.clearColor[1];
    this._clearColor[2] = s.clearColor[2]; this._clearColor[3] = s.clearColor[3];
    gl.clearColor(s.clearColor[0], s.clearColor[1], s.clearColor[2], s.clearColor[3]);
    // the draw-state baseline every entry point in this file assumes
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    this.clearScreenScissor();
    this._worldViewportPx = s.worldViewportPx;   // E5: back to the host's world rect (null = full canvas)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this._worldViewportPx) this._restoreWorldViewport();
    this.setScreenOffset(s.screenOffset[0], s.screenOffset[1]);
    this.markForeignPass();
  }

  /** The ONLY sanctioned way to run a panel pass: the return happens
   *  in a `finally`, so a throw inside the body cannot leave the
   *  session's one shared renderer holding a scissor (which silently
   *  blanks the next host frame's clear rather than erroring). */
  panelFrame({ proj, view, lightDir, rect, clear = PANEL_CLEAR_RGBA, setup = null }, body) {
    this.beginPanelFrame(proj, view, lightDir, rect, clear, setup);
    try { return body(); } finally { this.endPanelFrame(); }
  }

  /** Active window style emission (windowEmissionRGB output). */
  setWindowEmission(rgb) {
    this._windowEmission = rgb;
  }

  /** EV5: the second directional term - the masser's key light. Takes
   *  moonlightTerm's output or null; null (day, classic sky, indoors)
   *  zeroes the scale and every shader's moon term is a no-op. */
  setMoonlight(moon) {
    if (!moon) { this._moonScale = 0; return; }
    this._moonScale = moon.scale;
    this._moonDir[0] = moon.dir[0]; this._moonDir[1] = moon.dir[1]; this._moonDir[2] = moon.dir[2];
    this._moonColor[0] = moon.color[0]; this._moonColor[1] = moon.color[1]; this._moonColor[2] = moon.color[2];
  }

  /**
   * ROAD-C c2: the THIRD directional term. Takes {scale, dir, color} or
   * null (off, which is every pass but one). It exists because DFU's
   * automap beacons are lit by THREE directional lights -
   * CreateLightsForAutomapGeometry (Automap.cs:2025-2076) - where the
   * world's own lighting has two, sun and masser; collapsing the back
   * light into either of those would be a departure, and it is cheaper
   * to carry the term than to record one.
   */
  setThirdLight(light) {
    if (!light) { this._light3Scale = 0; return; }
    this._light3Scale = light.scale;
    this._light3Dir[0] = light.dir[0]; this._light3Dir[1] = light.dir[1]; this._light3Dir[2] = light.dir[2];
    this._light3Color[0] = light.color[0]; this._light3Color[1] = light.color[1];
    this._light3Color[2] = light.color[2];
  }

  /** The frame's key-light direction (the direction TOWARD the light).
   *  beginFrame takes it as an argument; this is for a pass that has to
   *  change it BETWEEN draws - see uploadLighting. */
  setLightDir(dir) {
    this._lightDir = dir;
    this._frameStamp++;   // PERF3: a pass that moves the light between draws re-uploads the terrain block too
  }

  /**
   * Push the directional lighting to the mesh program NOW. beginFrame is
   * normally the only uploader - the setters merely shadow - but the
   * automap's beacon group is LIT where the geometry group drawn just
   * before it is not (DaggerfallAutomap.shader has no light term at all;
   * the three automap lights carry `cullingMask = 1 << layerAutomap` and
   * reach only the Standard-material beacons), and both are draws inside
   * ONE panelFrame. Same immediate-upload seam setClipY and
   * setAutomapWater already have, for the same reason.
   */
  uploadLighting() {
    const gl = this.gl;
    this._use(this.program);
    gl.uniform3fv(this.uLightDir, this._lightDir);
    gl.uniform3fv(this.uAmbient, this._c3(this._ambient));
    this._uploadTrilight();
    gl.uniform1f(this.uSunScale, this._sunScale);
    gl.uniform3fv(this.uSunColor, this._c3(this._sunColor));
    gl.uniform3fv(this.uMoonDir, this._moonDir);
    gl.uniform1f(this.uMoonScale, this._moonScale);
    gl.uniform3fv(this.uMoonColor, this._c3(this._moonColor));
    gl.uniform3fv(this.uLight3Dir, this._light3Dir);
    gl.uniform1f(this.uLight3Scale, this._light3Scale);
    gl.uniform3fv(this.uLight3Color, this._c3(this._light3Color));
  }

  /** Time-of-day lighting: ambient color, sun scale, sun color. */
  setLighting(ambient, sunScale, sunColor, trilight = null) {
    this._ambient = ambient;
    this._sunScale = sunScale;
    if (sunColor) this._sunColor = sunColor;
    this._clockLit = true;
    this.setAmbientTrilight(trilight);   // BA1: every other caller's light is Flat, so a dungeon's trilight cannot outlive the dungeon
  }

  /** BA1: RenderSettings.ambientMode = Trilight with its three colours (FoggyDungeonsMod.cs:106-112), on
   *  the mesh program - walls, floors, the dungeon's models; a billboard's normal faces the camera and takes
   *  the equator, which is `setLighting`'s ambient (the caller hands the equator there). null is Flat again. */
  setAmbientTrilight(tri) {
    this._ambientTri = tri ? { sky: new Float32Array(tri.sky), ground: new Float32Array(tri.ground) } : null;
  }
  _uploadTrilight() {
    const gl = this.gl;
    const tri = this._ambientTri;
    gl.uniform1f(this.uTrilight, tri ? 1 : 0);
    if (tri) { gl.uniform3fv(this.uAmbientSky, this._c3(tri.sky)); gl.uniform3fv(this.uAmbientGround, this._c3(tri.ground)); }
  }

  /** Distance fog for every world pass. mode 'off'|'linear'|'exp'|'exp2'
   *  (DS1: 'exp2' is Unity's ExponentialSquared, exp(-(density*d)^2) -
   *  Dynamic Skies ships its overcast, rainy and snowy fog in it). */
  setFog(mode, density, start, end, color) {
    this._fogMode = mode === 'linear' ? 1 : mode === 'exp' ? 2 : mode === 'exp2' ? 3 : 0;
    this._fogDensity = density;
    this._fogRange[0] = start;
    this._fogRange[1] = end;
    if (color) this._fogColor = color;
  }

  _uploadFog(prog) {
    const gl = this.gl;
    gl.uniform3fv(prog.fogColor, this._fogColor);
    gl.uniform1i(prog.fogMode, this._fogMode);
    gl.uniform1f(prog.fogDensity, this._fogDensity);
    gl.uniform2fv(prog.fogRange, this._fogRange);
    gl.uniform3fv(prog.camPos, this._camPos);
    if (prog.clipY) gl.uniform1f(prog.clipY, this._clipY);   // A1: only the mesh shader carries the slice
    if (prog.amMode) gl.uniform1f(prog.amMode, this._automapMode);   // A2: and the automap presentation
    if (prog.amWaterLevel) gl.uniform1f(prog.amWaterLevel, this._automapWaterLevel);   // c2/S6: with its water tint
    if (prog.amWaterColor) gl.uniform4fv(prog.amWaterColor, this._automapWaterColor);
  }

  /** A1: the automap slice plane - fragments of the SOLID mesh pass
   *  above this world-space Y discard (the global _SclicingPositionY,
   *  Automap.cs:1296-1303). 1e9 = off; the automap window sets
   *  playerY + eye height + bias and restores off after its pass.
   *  Uploads IMMEDIATELY when the solid program exists: fog uniforms
   *  otherwise ride beginFrame alone, and the window must lift the
   *  slice MID-pass for the beacon draws (the arrow is never sliced,
   *  A1 review). drawMesh binds this.program per call, so touching
   *  the binding here is safe. */
  setClipY(y) {
    this._clipY = y ?? 1e9;
    if (this._solidFog?.clipY) {
      const gl = this.gl;
      this._use(this.program);
      gl.uniform1f(this._solidFog.clipY, this._clipY);
    }
  }

  /**
   * A2 + c2/S6: the automap presentation mode for the SOLID mesh pass -
   * one of AUTOMAP_MODE. Immediate upload, same reason as setClipY: the
   * automap window flips it between draw groups MID-pass.
   *
   * THE MODE IS THE QUEUE, so this setter owns the blend flip too, and
   * that is not a convenience - it is the only way the two cannot drift.
   * DaggerfallAutomap.shader puts the below-slice pass in
   * `Queue = Geometry / RenderType = Opaque` (no Blend line at all) and
   * the above-slice pass in `Queue = Transparent` under
   * `Blend SrcAlpha OneMinusSrcAlpha` with `ZWrite On` and BlendOp Add.
   * ZWrite ON with NO sorting is deliberate on DFU's part: the
   * order-dependent artifacts of the transparent map ARE the classic
   * look, not a bug for a port to fix.
   */
  setAutomapMode(m) {
    this._automapMode = m ?? 0;
    const gl = this.gl;
    if (this._solidFog?.amMode) {
      this._use(this.program);
      gl.uniform1f(this._solidFog.amMode, this._automapMode);
    }
    if (this._automapMode >= AUTOMAP_MODE.ABOVE_TRANSPARENT_COLOUR) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.depthMask(true);   // ZWrite On in BOTH passes - the transparent group still writes depth
  }

  /**
   * c2/S6: the automap water tint - `_WaterLevel` and `_WaterColor`,
   * which AddWater (Automap.cs:1982-2001) sets per BLOCK through a
   * MaterialPropertyBlock and every automap fragment reads. `level`
   * null means a dry block: the shader's own -10000 default, which
   * AddWater leaves in place when the native level is 10000.
   * Immediate upload, for setClipY's reason - the draw loop changes it
   * between blocks inside one pass.
   */
  setAutomapWater(level, rgba = null) {
    this._automapWaterLevel = level ?? AUTOMAP_NO_WATER;
    if (rgba) this._automapWaterColor.set(rgba);
    const f = this._solidFog;
    if (!f?.amWaterLevel && !f?.amWaterColor) return;
    const gl = this.gl;
    this._use(this.program);
    if (f.amWaterLevel) gl.uniform1f(f.amWaterLevel, this._automapWaterLevel);
    if (f.amWaterColor) gl.uniform4fv(f.amWaterColor, this._automapWaterColor);
  }

  /** Scene-space point lights as flat vec4s [x,y,z,range], max 16.
   *  LT1: `colors` is the optional per-light channel - flat vec3s of
   *  colour x intensity in the SAME order as `data` (AddLight's second
   *  switch, interiorLightProperties). Absent, every light wears the
   *  shared `color` - the exterior lantern path, unchanged. */
  setPointLights(data, color, colors = null) {
    const n = this.maxPointLights;   // EL1: the installed set's cap
    // MAC-T1: the carried mask is a property of the composed array, and `subarray` returns a fresh view without it -
    // so it is lifted FIRST, and cut to the same cap
    const carried = data.carried ?? null;
    this._pointCarried = carried ? carried.subarray(0, n) : null;
    this._pointLights = data.subarray ? data.subarray(0, n * 4) : data;
    if (color) this._pointColor = color;
    this._pointColors = colors ? (colors.subarray ? colors.subarray(0, n * 3) : colors) : null;
  }

  /** DS1: THE LIGHTNING FLASH - Dynamic Skies' LightningFlash point light
   *  (a Unity point light over the player, colour x intensity, range
   *  500..1000, on for a fifth of a second). Takes {x, y, z, range,
   *  color} or null (off, which is every frame the storm is quiet).
   *  Called AFTER setPointLights on the frame - it composes the flash
   *  into the arrays that call just stored, as their FIRST entry, so
   *  the host's own lanterns, candle and torch keep their order behind
   *  it under the same cap of sixteen; the next setPointLights, on this
   *  host or any modal frame, stores its own arrays and the flash is
   *  gone with them - no per-frame state outlives the frame. */
  setFlashLight(light) {
    this._flashLight = light ?? null;
    if (!light) return;
    const data = this._pointLights, colors = this._pointColors, f = light;
    const keep = Math.min(this.maxPointLights - 1, Math.floor(data.length / 4));   // EL1: one slot under the installed cap
    const out = this._flashLightScratch;
    out[0] = f.x; out[1] = f.y; out[2] = f.z; out[3] = f.range;
    out.set(data.subarray ? data.subarray(0, keep * 4) : data.slice(0, keep * 4), 4);
    this._pointLights = out.subarray(0, (keep + 1) * 4);
    // MAC-T1: the mask shifts with the arrays - the flash takes slot 0 unmarked, the hand's light keeps its bit
    if (this._pointCarried) {
      const m = this._flashCarriedScratch;
      m[0] = 0; m.set(this._pointCarried.subarray(0, keep), 1);
      this._pointCarried = m.subarray(0, keep + 1);
    }
    const c = this._flashColorScratch;
    c[0] = f.color[0]; c[1] = f.color[1]; c[2] = f.color[2];
    if (colors) {
      c.set(colors.subarray ? colors.subarray(0, keep * 3) : colors.slice(0, keep * 3), 3);
    } else {
      for (let i = 0; i < keep; i++) { c[3 + i * 3] = this._pointColor[0]; c[4 + i * 3] = this._pointColor[1]; c[5 + i * 3] = this._pointColor[2]; }
    }
    this._pointColors = c.subarray(0, (keep + 1) * 3);
  }

  /** LT1: the vec3 array a frame uploads - the host's per-light colours
   *  when given, else the shared colour splatted across the count. */
  _pointColorData(count, raw = false) {
    let out;
    if (this._pointColors) out = count * 3 < this._pointColors.length ? this._pointColors.subarray(0, count * 3) : this._pointColors;   // AUDIT-EL F3: cut to the program's slots
    else {
      const s = this._pointColorScratch;
      for (let i = 0; i < count * 3; i += 3) {
        s[i] = this._pointColor[0]; s[i + 1] = this._pointColor[1]; s[i + 2] = this._pointColor[2];
      }
      out = s.subarray(0, count * 3);
    }
    return this._lane && !raw ? this._lane.decodeN(out, this._pointColorDec, count) : out;   // EL1: linear for the lane; `raw` for a classic-space program under it (the water)
  }

  /**
   * MAC-I (2026-09-17, Mac: "The classic sprite should react to
   * lighting (first person)"): THE LIGHT A FLAT WOULD TAKE AT A POINT.
   *
   * The first-person sprites are screen quads, so nothing in the world
   * pass ever touched them - a torch hand, a weapon and a pair of
   * casting hands drew at full albedo in a pitch-black dungeon while
   * every flat in the room went dark around them. DFU has the SEAM for
   * this and leaves it white: `FPSWeapon.Tint` (FPSWeapon.cs:108) is
   * passed to the draw (:182) and nothing in DFU core ever writes it -
   * it is the First-Person Lighting mod's channel. This is the port
   * writing it, off the light the scene's own flats take.
   *
   * IT IS THE BILLBOARD SHADER'S COMPOSITION, not a second lighting
   * model: the tint (ambient plus the moon's Lambert-average half), the
   * sun's half, every point light with the SAME squared-linear falloff
   * to its range, and the indirect term - the four terms of the flat
   * program's `lit` (the `uTint + uBBSun + pointAcc + iAtt * iAtt *
   * uIndirectColor` above), with no normal, because a flat has none and
   * a screen sprite has less than none.
   *
   * TWO THINGS ARE DELIBERATELY NOT IN IT.
   *  - THE CLOUD SHADOW. `cloudShadowAt` is a shader function over a
   *    shadow map; sampling it here would mean reading a texture back.
   *    So a cloud passing over darkens the land and not the hand, and
   *    that is a recorded departure rather than an oversight.
   *  - THE LANE'S DECODE. Every uniform above goes up through `_c3`,
   *    which linearises under the enhanced-lighting lane; this answer
   *    does NOT, because a screen quad is drawn by the 2D pass AFTER
   *    the lane's composite has resolved the frame to display space
   *    (`_compositeAir` on the first screen draw). Tinting in the space
   *    the 2D pass paints in is the same choice the water's own classic
   *    -space read makes (`_pointColorData(count, true)`).
   *
   * A clockless scene (no `setLighting` yet - the test room, a probe)
   * has no light to answer with and gets white, which is exactly what
   * the flats get there.
   *
   * @param {number[]|null} pos scene-space point; the camera by default,
   *        which is where a first-person sprite is
   * @returns {number[]} [r, g, b], each at or above FLAT_LIGHT_FLOOR
   */
  flatLightAt(pos = null, floor = FLAT_LIGHT_FLOOR) {
    if (!this._clockLit) return [1, 1, 1];
    const p = pos ?? this._camPos;
    const am = this._ambient, mc = this._moonColor, sc = this._sunColor;
    const out = [
      am[0] + mc[0] * this._moonScale * 0.5 + sc[0] * this._sunScale * 0.5,
      am[1] + mc[1] * this._moonScale * 0.5 + sc[1] * this._sunScale * 0.5,
      am[2] + mc[2] * this._moonScale * 0.5 + sc[2] * this._sunScale * 0.5,
    ];
    const count = this._pointLights.length >> 2;
    if (count > 0) {
      const colors = this._pointColorData(count, true);   // EL1: the classic-space read, as the water takes
      for (let i = 0; i < count; i++) {
        const dx = this._pointLights[i * 4] - p[0];
        const dy = this._pointLights[i * 4 + 1] - p[1];
        const dz = this._pointLights[i * 4 + 2] - p[2];
        const range = this._pointLights[i * 4 + 3];
        if (!(range > 0)) continue;
        const att = Math.max(0, Math.min(1, 1 - Math.hypot(dx, dy, dz) / range));
        const a2 = att * att;
        if (a2 <= 0) continue;
        out[0] += a2 * colors[i * 3]; out[1] += a2 * colors[i * 3 + 1]; out[2] += a2 * colors[i * 3 + 2];
      }
    }
    const iRange = this._indirect[3];
    if (iRange > 0) {
      const iAtt = Math.max(0, Math.min(1, 1 - Math.hypot(
        this._indirect[0] - p[0], this._indirect[1] - p[1], this._indirect[2] - p[2]) / iRange));
      const i2 = iAtt * iAtt;
      out[0] += i2 * this._indirectColor[0];
      out[1] += i2 * this._indirectColor[1];
      out[2] += i2 * this._indirectColor[2];
    }
    for (let i = 0; i < 3; i++) out[i] = Math.max(floor, Math.min(1, out[i]));
    return out;
  }

  /** R12: the player-following indirect point light (SunlightRig's
   *  IndirectLight). scaledColor = prefab color x intensity x the
   *  daylight scale; pass zeros (or range 0) to disable. */
  setIndirectLight(pos, range, scaledColor) {
    this._indirect[0] = pos[0]; this._indirect[1] = pos[1]; this._indirect[2] = pos[2];
    this._indirect[3] = range;
    this._indirectColor = scaledColor;
  }

  /** Upload an emission mask for (archive, record): a getWindowColors32
   *  window mask, a spectral glow, or - with { white: true } - the
   *  ALBEDO of an auto-emissive record, which wears no window tint
   *  (MaterialReader.cs:448-453, EmissionColor = Color.white). */
  uploadEmissionTexture(archive, record, color32, opts = {}) {
    const key = `${archive}_${record}`;
    if (opts.white) this.emissionWhite.add(key);
    if (this.emissionTextures.has(key)) return this.emissionTextures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    this._activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._forgetTextureShadows();   // PERF-TEX: an upload owns unit 1 and leaves it ACTIVE - no shadow may speak past it (AUDIT-AIR1: through the one home, like the other six)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, color32Bytes(color32, `uploadEmissionTexture(${archive}, ${record})`)   // AUDIT 19 F7: the view, not its buffer; WW3: named when the shape is wrong
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // REVIEW 2026-09-05: the emission map carries the same chain as the
    // albedo (TextureReader.cs:316/:328/:340 new Texture2D(..., MipMaps),
    // :306 reuses the mipped albedo) and is point-sampled over it
    // (MaterialReader.cs:448/:104). The shader subtracts one from the
    // other (:108-109): both samples must come from the same mip level.
    gl.generateMipmap?.(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST ?? gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this._activeTexture(gl.TEXTURE0);
    this.emissionTextures.set(key, tex);
    this._texGen++;   // EV2: cached sub-mesh lookups refresh
    return tex;
  }

  /**
   * One batch = all billboards of one (archive, record): 4 verts per flat
   * (center xyz + corner offsets in -0.5..0.5), indexed quads. Positions are
   * the billboard BASE; the shader lifts by half height (AlignToBase).
   *
   * @param {number} archive
   * @param {number} record
   * @param {{w: number, h: number}} size
   * @param {number[][]} centers   one [x, y, z] per flat, the BASE
   * @returns {import('./contract.js').BillboardBatch}
   */
  createBillboardBatch(archive, record, size, centers) {
    const gl = this.gl;
    const count = centers.length;
    const verts = new Float32Array(count * 4 * 5);
    const indices = new Uint32Array(count * 6);
    const corners = [
      [-0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
      [0.5, -0.5],
    ];
    for (let f = 0; f < count; f++) {
      const [cx, cy, cz] = centers[f];
      for (let c = 0; c < 4; c++) {
        const o = (f * 4 + c) * 5;
        verts[o] = cx;
        verts[o + 1] = cy;
        verts[o + 2] = cz;
        verts[o + 3] = corners[c][0];
        verts[o + 4] = corners[c][1];
      }
      const b = f * 4;
      const io = f * 6;
      indices[io] = b;
      indices[io + 1] = b + 2;
      indices[io + 2] = b + 1;
      indices[io + 3] = b;
      indices[io + 4] = b + 3;
      indices[io + 5] = b + 2;
    }

    const vao = gl.createVertexArray();
    this._bindVao(vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this._bindVao(null);

    // FA1: `frame` is null for a still flat and a frame INDEX for an
    // animated one, which the draw folds into the texture key. Still
    // flats keep the exact key they have always had, so nothing that
    // uploaded through uploadRecord has to change.
    // EL5: the batch's sphere about its origin - the centres' box, plus a
    // flat's own half-diagonal (a flat is drawn about its centre, any facing)
    const bounds = boundsOf(centers.flat());
    bounds[3] += Math.hypot(size.w, size.h) * 0.5;
    return { vao, indexCount: count * 6, archive, record, size, buffers: [vb, ib], origin: null, frame: null, bounds };
  }

  /** Free one billboard batch's GL objects (S2 pickup removes piles;
   *  the optional-chained call it replaced would have leaked). */
  destroyBillboardBatch(batch) {
    const gl = this.gl;
    if (!batch) return;
    batch._dead = true;   // EL2: a shadow record from the last frame may still hold it
    if (batch.vao) gl.deleteVertexArray(batch.vao);
    for (const b of batch.buffers || []) gl.deleteBuffer(b);
    batch.vao = null;
    batch.buffers = [];
  }

  /** Release a createMesh bundle's GPU resources. */
  destroyMesh(mesh) {
    const gl = this.gl;
    mesh._dead = true;   // EL2: a shadow record from the last frame may still hold it
    for (const b of mesh.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(mesh.vao);
    // c2/S6: the wireframe cache is the mesh's, and dies with it
    if (mesh._wire) {
      gl.deleteBuffer(mesh._wire.ebo);
      gl.deleteVertexArray(mesh._wire.vao);
    }
    mesh._wire = null;
  }

  /** Release a billboard batch's GPU resources. */
  destroyBatch(batch) {
    const gl = this.gl;
    batch._dead = true;   // EL2
    for (const b of batch.buffers) gl.deleteBuffer(b);
    gl.deleteVertexArray(batch.vao);
  }

  /** Lazily create the shared 129x129 terrain index buffer. */
  _terrainIndices(indices) {
    let entry = this._terrainIndexSets.get(indices);
    if (entry) return entry;
    const gl = this.gl;
    // EV6: this element bind happens OUTSIDE any VAO of its own, and a
    // drawn VAO may still be bound (drawMesh no longer unbinds) - an
    // unguarded bind here would capture this buffer into that VAO.
    this._bindVao(null);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    entry = { buffer, count: indices.length };
    this._terrainIndexSets.set(indices, entry);
    return entry;
  }

  /** Create one pixel's terrain surface (positions + normals grid). */
  createTerrainSurface(positions, normals, indices) {
    const gl = this.gl;
    const indexSet = this._terrainIndices(indices);
    const vao = gl.createVertexArray();
    this._bindVao(vao);
    const buffers = [];
    const buf = (data, loc) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 12, 0);
      buffers.push(b);
      return b;
    };
    buf(positions, 0);
    buf(normals, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexSet.buffer);
    this._bindVao(null);
    return { vao, buffers, indexCount: indexSet.count, bounds: boundsOf(positions) };   // EL5: the replays cull by it
  }

  /** WATER-AUDIT (M4): a second surface over a terrain surface's OWN
   *  vertex buffers with an index set of its own (buildWaterIndices'
   *  water quads) - the water pass draws this, not the whole grid. Dies
   *  with the terrain it rides: destroy it before destroyMesh frees the
   *  buffers it points at. */
  createWaterSurface(terrain, indices) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    this._bindVao(vao);
    const [positions, normals] = terrain.buffers;
    gl.bindBuffer(gl.ARRAY_BUFFER, positions);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, normals);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 12, 0);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this._bindVao(null);
    return { vao, ebo, indexCount: indices.length };
  }

  destroyWaterSurface(water) {
    const gl = this.gl;
    gl.deleteBuffer(water.ebo);
    gl.deleteVertexArray(water.vao);
  }

  /** Upload a 128x128 tilemap byte texture (R8UI, NEAREST). */
  uploadTilemapTexture(bytes, dim) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, dim, dim, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, bytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    return tex;
  }
  /** Upload/cache a ground archive as a 64x64 TEXTURE_2D_ARRAY. */
  uploadTileArray(archive, layers) {
    if (this.tileArrays.has(archive)) return this.tileArrays.get(archive);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    const w = layers[0].width;
    const h = layers[0].height;
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA, w, h, layers.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (let i = 0; i < layers.length; i++) {
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(layers[i].colors.buffer, layers[i].colors.byteOffset, w * h * 4));
    }
    // GRAIN1 (2026-09-19, Mac: "distance terrian has a weird grain look"):
    // THE MIPMAP, AND WHY THE MAGNIFIER DOES NOT MOVE.
    //
    // MIN was NEAREST, so a distant pixel covering a dozen texels picked
    // ONE of them and picked a different one as the camera drifted: the
    // ground boiled. That is minification aliasing and a mipmap is its
    // only cure. The terrain shaders take textureGrad with the UNWRAPPED
    // gradient (see TERRAIN_FS), so the mip is chosen from the real
    // footprint and the fract() wrap cannot blur a line round every tile.
    //
    // MAG stays NEAREST, deliberately. Magnification is the ground under
    // the player's feet, where Daggerfall's texels are meant to be square
    // and visible; a mipmap has no say there (there is no mip above
    // level 0) and LINEAR would smear the one place the art is read at
    // full size. So this buys the distance and spends nothing on the
    // near field.
    //
    // A 2D ARRAY mipmaps each layer on its own, so no tile can bleed into
    // another the way an atlas would - which is the other reason atlases
    // ship unmipped and this need not.
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // GRAIN1: and anisotropy where the driver has it. Terrain is read at
    // a grazing angle almost everywhere, and an isotropic mip has to take
    // the WIDER of the two footprints - so it over-blurs along the view
    // and still aliases across it. This is the one filtering term that
    // buys back the sharpness the mipmap costs.
    //
    // GRAIN2: HOW MUCH OF IT IS THE MACHINE'S QUESTION. 4x was a
    // conservative guess and nothing more - it is paid in fill rate, on
    // the pass that covers the most screen, and this session cannot
    // measure that (its only GL is SwiftShader, whose cost profile is
    // nothing like a GPU's). So it is a dial rather than a number chosen
    // once for everybody: `groundSharpness` off / default / max, read
    // here, the player's own online.
    const aniso = this._anisoExt ||= (gl.getExtension('EXT_texture_filter_anisotropic') ?? null);
    if (aniso) {
      this._anisoMax ||= gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
      const want = anisotropyFor(getPref('groundSharpness'), this._anisoMax);
      if (want > 1) gl.texParameterf(gl.TEXTURE_2D_ARRAY, aniso.TEXTURE_MAX_ANISOTROPY_EXT, want);
    }
    // DFU's terrain texture array wraps Clamp (TextureReader) - keeps
    // the far edge texel at transformed-uv 1.0 boundary ties.
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tileArrays.set(archive, tex);
    return tex;
  }

  /** EE5: the deck the terrain shadows under - {cover, soft, wind, time,
   *  amount} - or null. Numbers only; it binds nothing. */
  setCloudShadow(d) { d = d ?? null; if (d !== this._cloudShadow) { this._cloudShadow = d; this._csStamp++; } }   // VC4: the stamp moves only when the deck does (the hosts hand the same object per pixel)

  /** WIND3: the wind the flats lean with, for this frame - [rate x, rate
   *  z, seconds, gust] (systems/windDrive.js's windV and gust), or null
   *  for none. Numbers only; uploaded by drawBillboards. A batch leans by
   *  this times its own `sway` (0 for everything but the climate's flora,
   *  floraSwayOf), so an interior or a dungeon that never sets it draws
   *  as before whatever the last exterior frame left here. */
  setFlatWind(v) {
    const fw = this._flatWind ??= new Float32Array(4);
    if (v) { fw[0] = v[0] || 0; fw[1] = v[1] || 0; fw[2] = v[2] || 0; fw[3] = v[3] || 0; } else fw.fill(0);
  }

  /** VC4: bind the deck's shadow map (or nothing) on the reserved unit
   *  for one program, once per setCloudShadow - a draw-path step. */
  _uploadCloudShadow(key) {
    const loc = this._csLoc?.[key];   // a bare prototype (the crash-report tests) has no programs
    if (!loc || this._csUploaded[key] === this._csStamp) return;
    this._csUploaded[key] = this._csStamp;
    const gl = this.gl, cs = this._cloudShadow, [mapLoc, rectLoc] = loc;
    this._activeTexture(gl.TEXTURE0 + CLOUD_SHADOW_UNIT);   // AUDIT 65 RS-3: reserved, above every foreign pass's slots
    gl.bindTexture(gl.TEXTURE_2D, cs?.map ?? this._blackTex);
    gl.uniform1i(mapLoc, CLOUD_SHADOW_UNIT);
    const r = cs?.map ? cs.rect : null;
    this._csRect[0] = r ? r[0] : 0; this._csRect[1] = r ? r[1] : 0; this._csRect[2] = r ? r[2] : 0; this._csRect[3] = r ? r[3] : 0;
    gl.uniform4fv(rectLoc, this._csRect);
    this._activeTexture(gl.TEXTURE0);
  }

  /** Draw one terrain surface with its tilemap + tile array. */
  drawTerrain(surface, modelMatrix, arrayTex, tilemapTex, tileSize) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    this._use(this.terrainProgram);
    if (this._casting) this._shadows.recordTerrain(surface, modelMatrix, arrayTex, tilemapTex, tileSize);   // EL2
    gl.uniformMatrix4fv(this.tUModel, false, modelMatrix);
    // PERF-TEX2: the model matrix is a pixel's own; the TILE SIZE is the
    // world's, one number for all 121 of them at the default land view.
    // PERF3 left it out of the frame-constant block as "per-pixel", and
    // it is passed per pixel - but it is the same number every time, so
    // 120 of every 121 uploads set the uniform to what it already held.
    // Shadowed rather than hoisted: a caller that really does change it
    // still uploads, so this cannot be wrong, only cheaper.
    if (this._tTileSize !== tileSize) { gl.uniform1f(this.tUTileSize, tileSize); this._tTileSize = tileSize; }
    // EE5 / VC4: the deck's shadow map, or nothing at all
    this._uploadCloudShadow('terrain');
    // PERF3: THE FRAME-CONSTANT BLOCK, ONCE A FRAME. The mesh program has
    // always taken its lights from beginFrame alone (the setters merely
    // shadow - see uploadLighting); the terrain program re-uploaded the
    // same seventeen uniforms for every streamed pixel, forty-odd draws
    // a frame on an open road. They go up on the first terrain draw after
    // beginFrame (or a state restore, or a moved light) and are skipped
    // for the rest: the same values, the same picture.
    if (this._tFrameStamp !== this._frameStamp) {
      this._tFrameStamp = this._frameStamp;
      gl.uniformMatrix4fv(this.tUProj, false, this._proj);
      gl.uniformMatrix4fv(this.tUView, false, this._view);
      this._uploadFog(this._terrainFog);
      gl.uniform3fv(this.tULightDir, this._lightDir);
      gl.uniform3fv(this.tUAmbient, this._c3(this._ambient));
      gl.uniform1f(this.tUSunScale, this._sunScale);
      gl.uniform3fv(this.tUSunColor, this._c3(this._sunColor));
      gl.uniform3fv(this.tUMoonDir, this._moonDir);
      gl.uniform1f(this.tUMoonScale, this._moonScale);
      gl.uniform3fv(this.tUMoonColor, this._c3(this._moonColor));
      const count = this._pointLights.length / 4;
      gl.uniform1i(this.tUPointCount, count);
      if (count > 0) gl.uniform4fv(this.tUPointLights, this._pointLights);
      if (count > 0) gl.uniform3fv(this.tUPointColors, this._pointColorData(count));
      gl.uniform4fv(this.tUIndirect, this._indirect);
      gl.uniform3fv(this.tUIndirectColor, this._c3(this._indirectColor));
      this._uploadEl('terrain');   // EL1
      gl.uniform1i(this.tUTileArr, 0);
      gl.uniform1i(this.tUTilemap, 2);
    }
    // PERF-TEX2: the TILEMAP is this pixel's own and always binds; the
    // tile ARRAY is the world's single atlas, the same object for every
    // pixel of the frame, so it is shadowed like unit 1's emission map.
    if (this._tArrayTex !== arrayTex) {
      this._activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrayTex);
      this._tArrayTex = arrayTex;
      this.stats.texBinds++;
    }
    this._activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tilemapTex);
    this._activeTexture(gl.TEXTURE0);
    this.stats.texBinds++;
    this._bindVao(surface.vao);
    gl.drawElements(gl.TRIANGLES, surface.indexCount, gl.UNSIGNED_INT, 0);
    this.stats.draws++;
    this._bindVao(null);
  }

  /**
   * Draw dungeon water planes. Call after all opaque geometry: alpha
   * blended, depth tested against the world but not written.
   * @param {Array<{x:number,z:number,size:number,y:number}>} quads
   * @param {number[]} color - rgba
   */
  drawWater(quads, color, waterTex, scrollTiles = 0) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    if (!quads.length) return;
    const gl = this.gl;
    this._use(this.waterProgram);
    gl.uniformMatrix4fv(this.waterUProj, false, this._proj);
    gl.uniformMatrix4fv(this.waterUView, false, this._view);
    gl.uniform4fv(this.waterUColor, color);
    this._activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, waterTex);
    this._tex0Bound = null;   // PERF-TEX3: this path owns unit 0 - the shadow may not speak for it
    gl.uniform1i(this.waterUTex, 0);
    gl.uniform1f(this.waterUScroll, scrollTiles);
    this._uploadFog(this._waterFog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    this._bindVao(this.waterVao);
    this.stats.texBinds++;
    for (const q of quads) {
      gl.uniform4f(this.waterURect, q.x, q.z, q.size, q.y);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.stats.draws++;
    }
    this._bindVao(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  /**
   * WATER1: draw one terrain surface's WATER - the same grid, lifted,
   * alpha-blended above the ground it was drawn on, depth-tested and
   * never depth-written, both faces (a river bank seen from below the
   * lift is still the surface). Call after every opaque pass of the
   * pixel and before the flats. `u` is waterUniforms' object.
   */
  /** WATER1's uniform table for one water-surface program (EL7: the classic and the lane's). */
  _waterLocs(P) {
    const gl = this.gl, u = (n) => gl.getUniformLocation(P, n);
    return {
      proj: u('uProj'), view: u('uView'), model: u('uModel'), lift: u('uLift'),
      tileArr: u('uTileArr'), tilemap: u('uTilemap'), tileSize: u('uTileSize'), tileDim: u('uTileDim'), mask: u('uWaterMask'),
      pointCount: u('uPointCount'), pointLights: u('uPointLights'), pointColors: u('uPointColors'), indirect: u('uIndirect'), indirectColor: u('uIndirectColor'),
      time: u('uTime'), windDir: u('uWindDir'), windStrength: u('uWindStrength'), rain: u('uRain'), scroll: u('uScroll'),
      lightDir: u('uLightDir'), ambient: u('uAmbient'), sunScale: u('uSunScale'), sunColor: u('uSunColor'),
      moonDir: u('uMoonDir'), moonScale: u('uMoonScale'), moonColor: u('uMoonColor'),
      zenith: u('uSkyZenith'), horizon: u('uSkyHorizon'), tint: u('uTint'), opacity: u('uOpacity'), f0: u('uF0'), shoreSoft: u('uShoreSoft'),
      fog: { fogColor: u('uFogColor'), fogMode: u('uFogMode'), fogDensity: u('uFogDensity'), fogRange: u('uFogRange'), camPos: u('uCamPos') },
      // VC4 recorded that the deck's shadow reached neither the grass nor the water; WATER1 closes the water half
      cloud: [u('uCloudShadowMap'), u('uCloudShadowRect')],
      maskUploaded: false,
    };
  }

  drawWaterSurface(surface, modelMatrix, arrayTex, tilemapTex, tileSize, u, tileDim = 128) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    const laneWater = !!(this._lane?.shadows && this.waterSurfaceProgramLane && this._shadows);   // EL7: the lane's water receives the sun map
    const L = laneWater ? this._wsLane : this._ws;
    this._use(laneWater ? this.waterSurfaceProgramLane : this.waterSurfaceProgram);
    this._csLoc.water = L.cloud; this._waterSurfaceFog = L.fog;
    if (!L.maskUploaded) { gl.uniform4uiv(L.mask, packWaterMask(WATER_DRAW_MASK_TABLE)); L.maskUploaded = true; }   // WATER-DRAW1
    gl.uniformMatrix4fv(L.proj, false, this._proj);
    gl.uniformMatrix4fv(L.view, false, this._view);
    gl.uniformMatrix4fv(L.model, false, modelMatrix);
    gl.uniform1f(L.lift, u.lift);
    gl.uniform1f(L.tileSize, tileSize);
    gl.uniform1i(L.tileDim, tileDim);
    gl.uniform1f(L.time, u.time);
    gl.uniform2f(L.windDir, u.windDir[0], u.windDir[1]);
    gl.uniform1f(L.windStrength, u.windStrength);
    gl.uniform1f(L.rain, u.rain);
    gl.uniform1f(L.scroll, u.scroll);
    gl.uniform3fv(L.zenith, u.zenith);
    gl.uniform3fv(L.horizon, u.horizon);
    gl.uniform3fv(L.tint, u.tint);
    gl.uniform1f(L.opacity, u.opacity);
    gl.uniform1f(L.f0, u.f0);
    gl.uniform1f(L.shoreSoft, u.shoreSoft);
    // the ground's own light, term for term, so the surface sits in the
    // frame the land beside it is lit in
    this._uploadCloudShadow('water');
    this._uploadFog(this._waterSurfaceFog);
    if (laneWater) this._shadows.upload(L.shadow);   // EL7: the maps and the receiver's uniforms
    gl.uniform3fv(L.lightDir, this._lightDir);
    gl.uniform3fv(L.ambient, this._ambient);
    gl.uniform1f(L.sunScale, this._sunScale);
    gl.uniform3fv(L.sunColor, this._sunColor);
    gl.uniform3fv(L.moonDir, this._moonDir);
    gl.uniform1f(L.moonScale, this._moonScale);
    gl.uniform3fv(L.moonColor, this._moonColor);
    // AUDIT-EL F3: the water surface is a CLASSIC-SPACE program with sixteen
    // slots (waterSurface.js uPointLights[16]) whatever lane is installed:
    // it takes the nearest sixteen of the lane's forty-eight, and the
    // colours as the host gave them - not decoded, which is what the lane's
    // own programs take (_pointColorData) and would have dimmed every
    // lantern's reflection on the water.
    const count = Math.min(this._pointLights.length / 4, CLASSIC_MAX_LIGHTS);
    gl.uniform1i(L.pointCount, count);
    if (count > 0) gl.uniform4fv(L.pointLights, this._pointLights.subarray ? this._pointLights.subarray(0, count * 4) : this._pointLights.slice(0, count * 4));
    if (count > 0) gl.uniform3fv(L.pointColors, this._pointColorData(count, true));
    gl.uniform4fv(L.indirect, this._indirect);
    gl.uniform3fv(L.indirectColor, this._indirectColor);
    this._activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrayTex);
    gl.uniform1i(L.tileArr, 0);
    this._activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tilemapTex);
    gl.uniform1i(L.tilemap, 2);
    this._activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    // The surface is the ground's own triangles a hand's breadth up, and
    // a world-space lift is worth less depth the farther it is: at 800
    // units a 24-bit buffer resolves about the lift itself, and the sea
    // beyond lost the test and showed the flat tile (the lab's first
    // shots: a light band at a fixed distance). A polygon offset is the
    // same nudge in WINDOW depth, slope-scaled, at every distance.
    // ...and where even that rounds to nothing (a 16-bit buffer, the far
    // sea on a 24-bit one), LEQUAL: the surface is the ground's own
    // triangles lifted, so its depth is never farther than the ground's
    // at the same pixel, and an equal depth is the surface, not the tile.
    // WATER-AUDIT (M3): the CONSTANT term only. A slope factor scales with
    // the surface's own depth slope, which at a grazing view of a lake is
    // hundreds of world units per pixel - enough to pull the water in
    // front of a boat or a far shore standing just above it. The lift
    // already carries the sloped case.
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(0, -2);
    gl.depthFunc(gl.LEQUAL);
    this._bindVao(surface.vao);
    gl.drawElements(gl.TRIANGLES, surface.indexCount, gl.UNSIGNED_INT, 0);
    this.stats.texBinds += 2; this.stats.draws++;
    this._bindVao(null);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  /** Draw billboard batches facing the camera. Call after solid geometry. */
  drawBillboards(batches, camRight, camUp) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    const gl = this.gl;
    if (this._casting) this._shadows.recordBillboards(batches, this._flatWind, camRight, camUp);   // EL2 (EL3: with the basis)
    // PERF-CROWD2: the frame's planes, once a CALL - after the shadow
    // record above, on purpose: everything still CASTS, only the drawing
    // is culled, so no shadow disappears because its caster went off
    // screen. The planes are recomputed rather than cached on the frame
    // stamp because the panel bracket swaps _proj/_view without bumping
    // it; one 4x4 multiply a call is nothing beside what it saves.
    const bbCull = !this._bbCullOff && !!this._proj && !!this._view;
    if (bbCull) frustumPlanes(mat4Multiply(this._proj, this._view, this._bbPv), this._bbPlanes);
    this._use(this.bbProgram);
    this._uploadCloudShadow('bb');   // VC4
    gl.uniformMatrix4fv(this.bbUProj, false, this._proj);
    gl.uniformMatrix4fv(this.bbUView, false, this._view);
    gl.uniform3fv(this.bbURight, camRight);
    gl.uniform3fv(this.bbUUp, camUp);
    gl.uniform1i(this.bbUTex, 0);
    if (this.bbUFlatWind) gl.uniform4fv(this.bbUFlatWind, this._flatWind ?? ZERO_FLAT_WIND);   // WIND3: one upload a call; uSway is the batch's
    this._uploadFog(this._bbFog);
    // Billboards take the scene's time-of-day light (DFU's ambient-lit
    // billboards): ambient plus the Lambert-average half of the sun term.
    // Clockless scenes keep the pre-R5 full-bright flats.
    if (this._clockLit) {
      // EV5: the flats have no normals, so the moon takes the same
      // Lambert-average half the sun does - a scalar on the tint.
      // EL1: under the lane the two terms are decoded FIRST and added in
      // linear (_c3 on each, into the two scratch triples).
      const am = this._c3(this._ambient, this._decA), mc = this._c3(this._moonColor, this._decB), sc = this._c3(this._sunColor, this._decB);
      gl.uniform3f(
        this.bbUTint,
        am[0] + mc[0] * this._moonScale * 0.5,
        am[1] + mc[1] * this._moonScale * 0.5,
        am[2] + mc[2] * this._moonScale * 0.5
      );
      gl.uniform3f(this.bbUSun, sc[0] * this._sunScale * 0.5, sc[1] * this._sunScale * 0.5, sc[2] * this._sunScale * 0.5);   // VC4: the sun's half, shadowed in the shader
    } else {
      gl.uniform3f(this.bbUTint, 1, 1, 1);
      gl.uniform3f(this.bbUSun, 0, 0, 0);
    }
    const bbCount = this._pointLights.length >> 2;
    gl.uniform1i(this.bbUPointCount, bbCount);
    if (bbCount > 0) gl.uniform4fv(this.bbUPointLights, this._pointLights);
    if (bbCount > 0) gl.uniform3fv(this.bbUPointColors, this._pointColorData(bbCount));
    gl.uniform4fv(this.bbUIndirect, this._indirect);
    gl.uniform3fv(this.bbUIndirectColor, this._c3(this._indirectColor));
    this._uploadEl('bb');   // EL1
    gl.uniform1i(this.bbUEmissionTex, 1);
    gl.disable(gl.CULL_FACE);
    // Two phases: opaque flats first (classic cutout), then SPECTRAL
    // batches blended with depth-writes off - ghosts keep their 180
    // alpha (~70% visible) and their emission map (red eyes + the
    // V^1.9 body glow). Rendering's last queue row, classic-visuals
    // direction (Mac).
    // PERF3: A BATCH'S TEXTURE KEY IS MINTED ONCE PER FRAME IT CHANGES,
    // and the two texture binds are skipped when the batch before wore
    // the same key. The cutout pass is order-free (depth written, alpha
    // discarded, no blend), so it is SORTED by key first: the same tree
    // record across forty pixels used to bind its textures forty times
    // and now binds them once. The blended pass keeps its back-to-front
    // order and only skips the repeats it happens to have.
    let lastKey = null;
    let lastSway = null;   // WIND3
    const keyOf = (b) => {
      // FA1: an animated flat's frames are uploaded under `record#frame`
      // (the key uploadRecordFrame already mints for enemy sprites);
      // a still flat is `record` alone, as before.
      // MAC4 (2026-09-11, Mac: "enemy animations are completely broken"):
      // the cache re-minted on a FRAME change only, and the mobiles -
      // every foe, guard and townsperson (exteriorFoes, dungeonContext,
      // cityGuards, the two hosts' people) - animate by writing the
      // RECORD (`record#frame`, orientation and frame folded into one)
      // and never touch `frame`: their key was minted once and they
      // stood on their first texture for the rest of the session. The
      // key follows every field it is made of.
      if (b._bbKey == null || b._bbKeyRecord !== b.record || b._bbKeyFrame !== b.frame || b._bbKeyArchive !== b.archive) {
        b._bbKeyRecord = b.record; b._bbKeyFrame = b.frame; b._bbKeyArchive = b.archive;
        b._bbKey = b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`;
      }
      return b._bbKey;
    };
    const drawOne = (b) => {
      const key = keyOf(b);
      const tex = this.textures.get(key);
      if (!tex) return;
      if (key !== lastKey) {
        this._activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        this._activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.emissionTextures.get(key) || this._blackTex);
        this._tex0Bound = null;   // PERF-TEX3: and unit 0 with it - this path binds its own and keeps its own `lastKey` skip
        this._tex1Bound = null;   // PERF-TEX: this path has skipped on `lastKey` since it was written, so it needs no shadow of its own - but it OWNS unit 1 while it runs, and the mesh loop's shadow cannot speak for it afterwards
        this.stats.texBinds += 2;
        lastKey = key;
      }
      gl.uniform2f(this.bbUSize, b.size.w, b.size.h);
      const o = b.origin || ZERO_ORIGIN;
      gl.uniform3f(this.bbUOrigin, o[0], o[1], o[2]);
      const sw = b.sway || 0;   // WIND3: the batch's share of the lean, uploaded when it changes between batches
      if (sw !== lastSway) { gl.uniform1f(this.bbUSway, sw); lastSway = sw; }
      this._bindVao(b.vao);
      gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
      this.stats.draws++;
    };
    gl.uniform1i(this.bbUSpectral, 0);
    gl.uniform4f(this.bbUConceal, 0, 0, 0, 0);   // ECV1: plain unless a batch says otherwise
    const opaque = this._bbOpaque ??= [];
    opaque.length = 0;
    // AUDIT PERF-CROWD2 F1: `keyOf` runs BEFORE the cull, and must. It is
    // not this pass's bookkeeping alone - the shadow replay
    // (shadowPass.js) and the air pass's emitters (airPass.js) both read
    // `b._bbKey`, and both take it as it stands (`?? recompute` only
    // fires when it is ABSENT, never when it is STALE). A culled batch
    // that never re-keyed would carry last-seen-on-screen's key for as
    // long as it stayed off camera - and a mobile animates by writing its
    // RECORD (MAC4), so an off-screen foe would cast the silhouette of
    // whatever frame it was on when it left the view, or none at all once
    // that texture is gone. The shadow cascades reach 240 units; off
    // screen is exactly where those casters live. Keying is a few
    // comparisons and mints a string only when something changed.
    for (const b of batches) {
      if (isSpectralArchive(b.archive) || b.conceal) continue;
      keyOf(b);
      if (bbCull && !this._bbVisible(b)) { this.stats.bbCulled++; continue; }   // PERF-CROWD2
      opaque.push(b);
    }
    opaque.sort((a, b) => (a._bbKey < b._bbKey ? -1 : a._bbKey > b._bbKey ? 1 : 0));
    for (const b of opaque) drawOne(b);
    opaque.length = 0;
    // The BLENDED phase: the spectral batches and (ECV1) the concealed
    // ones together, depth-writes off, drawn BACK TO FRONT by their
    // origin's distance from the camera so a translucent foe behind
    // another shows through it rather than over it. ECV1's batches
    // carry one uConceal each (the mode, the opacity, the host's clock,
    // the foe's phase); a spectral batch keeps its flag, which the
    // shader reads only when uConceal says plain.
    let blended = null;
    for (const b of batches) {
      if (!(b.conceal || isSpectralArchive(b.archive))) continue;
      if (bbCull && !this._bbVisible(b)) { this.stats.bbCulled++; continue; }   // PERF-CROWD2: the ghosts and the concealed too
      (blended ??= []).push(b);
    }
    if (blended) {
      const cp = this._camPos;
      const d2 = (b) => { const o = b.origin || ZERO_ORIGIN; const dx = o[0] - cp[0], dy = o[1] - cp[1], dz = o[2] - cp[2]; return dx * dx + dy * dy + dz * dz; };
      blended.sort((a, b) => d2(b) - d2(a));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const b of blended) {
        const c = b.conceal;
        gl.uniform1i(this.bbUSpectral, isSpectralArchive(b.archive) ? 1 : 0);
        gl.uniform4f(this.bbUConceal, c ? c.mode : 0, c ? c.alpha : 0, c ? c.t : 0, c ? c.phase : 0);
        drawOne(b);
      }
      gl.uniform4f(this.bbUConceal, 0, 0, 0, 0);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    this._activeTexture(gl.TEXTURE0);
    this._bindVao(null);
    gl.enable(gl.CULL_FACE);
    this._use(this.program);
  }

  /** Draw one placed mesh: bind per-submesh texture, indexed draw per range. */
  /**
   * @param {Map<string,string>|null} texRemap - optional
   *   "archive_record" -> "archive_record" texture substitution (climate
   *   swaps; UVs stay original-archive, the SetDungeonTextures pattern).
   */
  /** One warning per distinct shape, not one per frame. */
  _warnMissingMesh(mesh, modelMatrix = undefined) {
    this._missingMeshes ??= new Set();
    const why = mesh == null ? 'no mesh' : !mesh.vao ? 'no vao'
      : !mesh.subMeshes?.length ? 'no subMeshes' : 'no matrix';
    const key = `${why}:${mesh?.name ?? mesh?.modelId ?? '?'}`;
    if (this._missingMeshes.has(key)) return;
    this._missingMeshes.add(key);
    console.warn(`[renderer] drawMesh skipped a draw with ${why} - a model is missing from this scene, not from the frame loop`, mesh, modelMatrix);
  }

  /**
   * ROAD-C c2/S6: THE AUTOMAP'S WIREFRAME MODE, and a RECORDED
   * SUBSTITUTION stated at its true size.
   *
   * DFU draws wireframe with a GEOMETRY SHADER: `geom` hands each
   * fragment the triangle's barycentric distances and the fragment
   * shader keeps only `exp2(-4*d*d) >= 0.1`, writing a CONSTANT colour
   * on the kept fragments. WebGL2 has no geometry shader stage, so the
   * port draws `gl.LINES` over an edge index buffer instead.
   *
   * THE LOSS IS SMALL, and this is why: DFU's falloff is HARD-CLIPPED at
   * I < 0.1 and the kept fragments are a flat (0.9,0.9,0.7,0.6) /
   * (0.25,0.25,0.25,0.6) - there is no soft falloff to lose, only a
   * ~0.9 px hard band. The two real deltas are (a) WebGL2 caps
   * `lineWidth` at 1 px on every desktop driver, so the band is 1 px
   * rather than ~0.9, and (b) quad diagonals - which DFU's per-triangle
   * barycentrics draw as well, so they are parity, not a defect.
   * DO NOT "fix" this with a barycentric vertex variant: that needs a
   * de-indexed copy of every mesh (three unique vertices per triangle),
   * which doubles automap-eligible vertex memory for under a pixel.
   *
   * The line index buffer is built ONCE per mesh, on the first
   * wireframe draw, and freed with the mesh. It gets its OWN VAO over
   * the mesh's OWN vertex buffers - no vertex data is duplicated - and
   * that second VAO is not a nicety: a WebGL2 VAO captures its
   * ELEMENT_ARRAY_BUFFER binding, so drawing lines through the mesh's
   * VAO would have to swap the triangle EBO out and back on every
   * single draw, and one missed restore silently corrupts every later
   * triangle draw of that mesh with no error anywhere.
   */
  drawMeshWire(mesh, modelMatrix, texRemap = null) {
    this._drawMeshBundle(mesh, modelMatrix, texRemap, true);
  }

  /** Lazily expand a mesh's triangles into edge pairs, with a VAO of
   *  their own over the mesh's existing vertex buffers. Answers null
   *  for a bundle that kept no indices (nothing to line-draw). */
  _ensureWireMesh(mesh) {
    if (mesh._wire !== undefined) return mesh._wire;
    if (!mesh.triIndices || !mesh.buffers || mesh.buffers.length < 3) {
      mesh._wire = null;
      return null;
    }
    const gl = this.gl;
    const { indices, ranges } = buildWireIndices(mesh.triIndices, mesh.subMeshes);
    const vao = gl.createVertexArray();
    this._bindVao(vao);
    // the SAME three vertex buffers createMesh built, in its layout
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers[0]);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers[1]);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers[2]);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this._bindVao(null);
    mesh._wire = { vao, ebo, ranges, indexCount: indices.length };
    return mesh._wire;
  }

  drawMesh(mesh, modelMatrix, texRemap = null) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    this._drawMeshBundle(mesh, modelMatrix, texRemap, false);
  }

  _drawMeshBundle(mesh, modelMatrix, texRemap, wire) {
    this._close2D();   // PERF-2D: the baseline back, before anything that needs it
    // NEVER TRAPS. A mesh that is absent, or one whose subMeshes never
    // arrived, is game DATA missing - a model id the player's ARCH3D
    // does not carry, a record the ingest diet dropped - and the rule
    // for missing data in this port is that it costs the thing that is
    // missing, never the run. Before this, `mesh.vao` on a null threw
    // out of the frame loop, requestAnimationFrame stopped, and the
    // whole scene died for one absent model: a real player hit exactly
    // that ("drawMesh@... / re@...", Firefox, no message). Warn ONCE
    // per key so a broken data set says so without filling the console
    // sixty times a second.
    if (!mesh?.vao || !mesh.subMeshes?.length || modelMatrix == null) {
      // THE MATRIX BELONGS IN THIS GUARD TOO, and the first version of
      // it did not have it: the crash from the field was a null
      // MATRIX, not a null mesh. `uniformMatrix4fv(uModel, false,
      // null)` throws because Float32List is a non-nullable WebIDL
      // union - one statement below the mesh check, inside the same
      // function, so the minified frame is identical and the guard
      // read as though it covered the reported crash while the real
      // producer walked straight past it.
      this._warnMissingMesh(mesh, modelMatrix);
      return;
    }
    const gl = this.gl;
    const wireMesh = wire ? this._ensureWireMesh(mesh) : null;
    if (wire && !wireMesh) return;
    // Every draw entry point owns its program binding (drawTerrain /
    // drawBillboards / drawWater already do) - R9 interleaved terrain
    // draws before the model loop, which silently ran meshes on the
    // terrain program and vanished every building (caught by Mac).
    // EV6: ownership now flows through the _use shadow - the bind is
    // still this call's to account for, it just costs nothing when the
    // program is already bound.
    this._use(this.program);
    this._uploadCloudShadow('mesh');   // VC4
    gl.uniformMatrix4fv(this.uModel, false, modelMatrix);
    if (!wire && this._casting) this._shadows.recordMesh(mesh, modelMatrix, texRemap);   // EL2
    this._bindVao(wire ? wireMesh.vao : mesh.vao);
    for (let smi = 0; smi < mesh.subMeshes.length; smi++) {
      const sm = mesh.subMeshes[smi];
      // EV2: the resolved textures cache on the sub-mesh, stamped with
      // the texture generation and the remap's identity. The old body
      // built the `${archive}_${record}` key fresh here - per sub-mesh,
      // per placement, per frame - and hashed it twice; a city frame
      // minted thousands of strings for the GC. A MISS is deliberately
      // not stamped: the texture may still be streaming in, and caching
      // the miss would blank the model until the next upload bump.
      let tex;
      if (sm._evGen === this._texGen && sm._evRemap === texRemap) {
        tex = sm._evTex;
      } else {
        // AUDIT 39 F52: the key is minted ONCE per sub-mesh and kept.
        // The stamp validates the remap by IDENTITY, and the streaming
        // world mints a fresh texRemap per map pixel over GPU meshes
        // shared by every pixel - so an archetype standing in N loaded
        // pixels misses N times a frame, and the string EV2 killed was
        // being re-minted on every one of those misses.
        const key = sm._evKey ?? (sm._evKey = `${sm.textureArchive}_${sm.textureRecord}`);
        const resolved = texRemap && texRemap.has(key) ? texRemap.get(key) : key;
        tex = this.textures.get(resolved + '#opaque') ?? this.textures.get(resolved);   // the mesh material (alphaIndex -1) first
        if (tex) {
          sm._evTex = tex;
          sm._evEmis = this.emissionTextures.get(resolved) || this._blackTex;
          sm._evEmisWhite = this.emissionWhite.has(resolved);
          sm._evGen = this._texGen;
          sm._evRemap = texRemap;
        }
      }
      if (!tex) continue;
      // F49: an auto-emissive record's mask is its own albedo and wears
      // Color.white; only a window mask wears the window style.
      const emisColor = sm._evEmisWhite ? EMISSION_WHITE : this._windowEmission;
      if (this._emissionColorUp !== emisColor) {
        gl.uniform3fv(this.uEmissionColor, this._c3(emisColor));   // EL1
        this._emissionColorUp = emisColor;
      }
      this._bindEmission(sm._evEmis);   // PERF-TEX: skipped when it is already the one on the unit, which it usually is
      this._bindTex0(tex);   // PERF-TEX3: a bundle whose sub-meshes repeat an archive re-bound the same texture every time
      if (wire) {
        const range = wireMesh.ranges[smi];
        gl.drawElements(gl.LINES, range.count, gl.UNSIGNED_INT, range.start * 4);
        this.stats.draws++;   // F50: every gl.draw* site carries its own count
      } else {
        gl.drawElements(gl.TRIANGLES, sm.primitiveCount * 3, gl.UNSIGNED_INT, sm.startIndex * 4);
        this.stats.draws++;
      }
    }
    // EV6: no trailing unbind - the sorted drawLists mean the next
    // drawMesh is very often the SAME mesh, and the shadow then skips
    // the whole bind. Everything that binds a VAO or an element buffer
    // in this file goes through _bindVao (or binds its own fresh VAO
    // first), so nothing can capture state into the one left bound.
  }
}
