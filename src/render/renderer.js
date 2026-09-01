// WebGL2 renderer for world geometry. Presentation layer - ours, not DFU's
// (Port-Doctrine). Semantics it must honor from the data side:
//   - UVs can be negative or > 1 (DFU relies on REPEAT wrapping).
//   - Textures arrive from TextureFile.getColor32 already bottom-up, which is
//     GL's native texel order; upload as-is with flipY off.
//   - Indexed color means hard pixels: NEAREST filtering.
//   - Alpha 0 texels are palette-index cutouts; the shader discards them.

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

const FS = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec2 vUV;
in vec3 vWorldPos;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform float uSunScale;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;    // EV5: the second directional term - the masser
uniform float uMoonScale; // 0 = no moon (classic, indoors, daytime)
uniform vec3 uMoonColor;
uniform vec3 uEmissionColor;
uniform int uPointCount;
uniform vec4 uPointLights[16]; // xyz scene-space, w range
uniform vec3 uPointColors[16]; // LT1: per-light colour x intensity (AddLight's second switch)
uniform vec4 uIndirect;       // R12: xyz player pos, w range (0 = off)
uniform vec3 uIndirectColor;  // color x intensity x daylight scale
uniform vec3 uFogColor;
uniform int uFogMode; // 0 off, 1 linear, 2 exp
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
uniform vec4 uAutomapWaterColor;    // _WaterColor: the (0,0.3,0.5,0.4) property default
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
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
  if (tex.a < 0.5) discard;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
  float mdiff = max(dot(n, uMoonDir), 0.0);
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
  vec3 lit = albedo * (uAmbient + uSunColor * (uSunScale * diff) + uMoonColor * (uMoonScale * mdiff));
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
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vColor;
out vec3 vNormal;
out vec3 vWorldPos;
out vec2 vUV;
void main() {
  vColor = aColor;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = uProj * uView * world;
}`;

// Character fragment: the mesh path's lighting + fog verbatim, sampling
// the rig's vertex color instead of a texture (C4b - no emission, no
// alpha cutout: rig faces are opaque solids).
const CHAR_FS = `#version 300 es
precision highp float;
in vec3 vColor;
in vec3 vNormal;
in vec3 vWorldPos;
in vec2 vUV;
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
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
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
out vec2 vUV;
out vec3 vBBWorld;
void main() {
  // Bottom-anchored: centre sits half a height above the placement base.
  vec3 world = aCenter + uOrigin
    + uRight * (aCorner.x * uSize.x)
    + uUp * ((aCorner.y + 0.5) * uSize.y);
  vBBWorld = world;
  // Textures are bottom-up (v=0 = image bottom), so the quad top
  // (aCorner.y = +0.5) samples v = 1 - matching the mesh path's negated-V
  // convention. The previous 0.5 - aCorner.y flipped every billboard.
  vUV = vec2(aCorner.x + 0.5, aCorner.y + 0.5);
  gl_Position = uProj * uView * vec4(world, 1.0);
}`;

const BB_FS = `#version 300 es
precision highp float;
in vec2 vUV;
in vec3 vBBWorld;
uniform sampler2D uTex;
uniform sampler2D uEmissionTex;
uniform int uSpectral;
uniform vec3 uTint; // time-of-day: ambient + sunColor * sunScale * 0.5
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
out vec4 outColor;
float fogFactorAt(vec3 worldPos) {
  if (uFogMode == 0) return 1.0;
  float d = length(worldPos - uCamPos);
  if (uFogMode == 1) {
    return clamp((uFogRange.y - d) / max(uFogRange.y - uFogRange.x, 1e-4), 0.0, 1.0);
  }
  return exp(-uFogDensity * d);
}
void main() {
  vec4 tex = texture(uTex, vUV);
  // Spectral flats keep their 180-alpha translucency (blended pass);
  // opaque flats keep the classic 0.5 cutout.
  if (tex.a < (uSpectral == 1 ? 0.1 : 0.5)) discard;
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
  vec3 emission = texture(uEmissionTex, vUV).rgb;
  vec3 albedo = max(tex.rgb - emission, vec3(0.0));
  // R12: the indirect term, attenuation-only like the lantern term
  // (billboards have no normal).
  float iD = length(uIndirect.xyz - vBBWorld);
  float iAtt = clamp(1.0 - iD / max(uIndirect.w, 1e-4), 0.0, 1.0);
  vec3 lit = albedo * (uTint + pointAcc + iAtt * iAtt * uIndirectColor) + emission;
  outColor = vec4(mix(uFogColor, lit, fogFactorAt(vBBWorld)), uSpectral == 1 ? tex.a : 1.0);
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
  vec3 tex = texture(uTileArr, vec3(tuv, float(layer))).rgb;
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLightDir), 0.0);
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

const ZERO_ORIGIN = [0, 0, 0];
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
const FOG_MODE_NAMES = ['off', 'linear', 'exp'];

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
/** `_WaterColor`'s property default: (0.0, 0.3, 0.5, 0.4). */
export const AUTOMAP_WATER_COLOR = Object.freeze([0.0, 0.3, 0.5, 0.4]);

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
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false });
    if (!gl) throw new Error('WebGL2 required');
    this.gl = gl;

    this.program = this._buildProgram(VS, FS);
    this.uProj = gl.getUniformLocation(this.program, 'uProj');
    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uLightDir = gl.getUniformLocation(this.program, 'uLightDir');
    this.uAmbient = gl.getUniformLocation(this.program, 'uAmbient');
    this.uSunScale = gl.getUniformLocation(this.program, 'uSunScale');
    this.uSunColor = gl.getUniformLocation(this.program, 'uSunColor');
    this.uMoonDir = gl.getUniformLocation(this.program, 'uMoonDir');
    this.uMoonScale = gl.getUniformLocation(this.program, 'uMoonScale');
    this.uMoonColor = gl.getUniformLocation(this.program, 'uMoonColor');
    this.uTex = gl.getUniformLocation(this.program, 'uTex');
    this.uEmissionTex = gl.getUniformLocation(this.program, 'uEmissionTex');
    this.uEmissionColor = gl.getUniformLocation(this.program, 'uEmissionColor');
    this.uPointCount = gl.getUniformLocation(this.program, 'uPointCount');
    this.uPointLights = gl.getUniformLocation(this.program, 'uPointLights');
    this.uPointColors = gl.getUniformLocation(this.program, 'uPointColors');
    this.uIndirect = gl.getUniformLocation(this.program, 'uIndirect');
    this.uIndirectColor = gl.getUniformLocation(this.program, 'uIndirectColor');

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
    this.stats = { draws: 0, programBinds: 0, vaoBinds: 0, texBinds: 0 };
    this._windowEmission = new Float32Array([0, 0, 0]);
    this._pointLights = new Float32Array(0); // vec4 per light [x,y,z,range]
    this._pointColor = new Float32Array([1, 1, 1]);
    // LT1: per-light colour x intensity (vec3 per light). null = every
    // light wears the shared _pointColor - the exterior lantern path,
    // bit-identical to the pre-LT1 scalar channel.
    this._pointColors = null;
    this._pointColorScratch = new Float32Array(16 * 3);
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
    // c2/S6: the automap water tint. The shader property defaults are
    // DFU's own (DaggerfallAutomap.shader Properties): _WaterLevel
    // -10000.0 (below every dungeon floor, so a dry block tints
    // nothing) and _WaterColor (0, 0.3, 0.5, 0.4).
    this._automapWaterLevel = AUTOMAP_NO_WATER;
    this._automapWaterColor = new Float32Array(AUTOMAP_WATER_COLOR);
    const fogLocs = (program) => ({
      fogColor: gl.getUniformLocation(program, 'uFogColor'),
      fogMode: gl.getUniformLocation(program, 'uFogMode'),
      clipY: gl.getUniformLocation(program, 'uClipY'),
      amMode: gl.getUniformLocation(program, 'uAutomapMode'),
      amWaterLevel: gl.getUniformLocation(program, 'uAutomapWaterLevel'),
      amWaterColor: gl.getUniformLocation(program, 'uAutomapWaterColor'),
      fogDensity: gl.getUniformLocation(program, 'uFogDensity'),
      fogRange: gl.getUniformLocation(program, 'uFogRange'),
      camPos: gl.getUniformLocation(program, 'uCamPos'),
    });
    this._solidFog = fogLocs(this.program);
    // Character program (C4b): rig vertex-color path, same scene
    // lighting/fog model as the mesh program.
    this.charProgram = this._buildProgram(CHAR_VS, CHAR_FS);
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
    this._charFog = fogLocs(cp);
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
    // Billboards stay full-bright until a scene installs the clock via
    // setLighting - the solid defaults above reproduce the pre-R5 solid
    // shading, but 0.45 + 0.55 * 0.5 would silently dim flats to 72.5%
    // in the clockless scenes (caught in the R5 audit: dungeon vine).
    this._clockLit = false;
    // 1x1 black bound for every non-window submesh (branchless shader).
    this._blackTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._blackTex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    this.bbProgram = this._buildProgram(BB_VS, BB_FS);
    this.terrainProgram = this._buildProgram(TERRAIN_VS, TERRAIN_FS);
    this.tUProj = gl.getUniformLocation(this.terrainProgram, 'uProj');
    this.tUView = gl.getUniformLocation(this.terrainProgram, 'uView');
    this.tUModel = gl.getUniformLocation(this.terrainProgram, 'uModel');
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
    this.tileArrays = new Map(); // archive -> TEXTURE_2D_ARRAY
    // EV4: one shared index buffer PER INDEX SET, keyed by the array's
    // identity - the world host shares one full-grid array across every
    // pixel and one strided far-ring array across the LOD ring. The old
    // single-buffer cache silently drew every later surface with the
    // FIRST set ever uploaded, which was invisibly correct only while
    // exactly one set existed.
    this._terrainIndexSets = new Map(); // indices array -> { buffer, count }

    this.waterProgram = this._buildProgram(WATER_VS, WATER_FS);
    this._bbFog = {
      fogColor: gl.getUniformLocation(this.bbProgram, 'uFogColor'),
      fogMode: gl.getUniformLocation(this.bbProgram, 'uFogMode'),
      fogDensity: gl.getUniformLocation(this.bbProgram, 'uFogDensity'),
      fogRange: gl.getUniformLocation(this.bbProgram, 'uFogRange'),
      camPos: gl.getUniformLocation(this.bbProgram, 'uCamPos'),
    };
    this._terrainFog = {
      fogColor: gl.getUniformLocation(this.terrainProgram, 'uFogColor'),
      fogMode: gl.getUniformLocation(this.terrainProgram, 'uFogMode'),
      fogDensity: gl.getUniformLocation(this.terrainProgram, 'uFogDensity'),
      fogRange: gl.getUniformLocation(this.terrainProgram, 'uFogRange'),
      camPos: gl.getUniformLocation(this.terrainProgram, 'uCamPos'),
    };
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
    this.bbUProj = gl.getUniformLocation(this.bbProgram, 'uProj');
    this.bbUView = gl.getUniformLocation(this.bbProgram, 'uView');
    this.bbURight = gl.getUniformLocation(this.bbProgram, 'uRight');
    this.bbUUp = gl.getUniformLocation(this.bbProgram, 'uUp');
    this.bbUSize = gl.getUniformLocation(this.bbProgram, 'uSize');
    this.bbUOrigin = gl.getUniformLocation(this.bbProgram, 'uOrigin');
    this.bbUTex = gl.getUniformLocation(this.bbProgram, 'uTex');
    this.bbUEmissionTex = gl.getUniformLocation(this.bbProgram, 'uEmissionTex');
    this.bbUSpectral = gl.getUniformLocation(this.bbProgram, 'uSpectral');
    this.bbUTint = gl.getUniformLocation(this.bbProgram, 'uTint');
    this.bbUPointCount = gl.getUniformLocation(this.bbProgram, 'uPointCount');
    this.bbUPointLights = gl.getUniformLocation(this.bbProgram, 'uPointLights');
    this.bbUPointColors = gl.getUniformLocation(this.bbProgram, 'uPointColors');
    this.bbUIndirect = gl.getUniformLocation(this.bbProgram, 'uIndirect');
    this.bbUIndirectColor = gl.getUniformLocation(this.bbProgram, 'uIndirectColor');
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
    // precipitation, and the overworld map since AUDIT 39 F55 - the R9
    // law's other half: an entry point may only trust a binding it can
    // account for).
    this._lastProgram = null;
    this._lastVao = null;
  }

  /** EV6: bind `program` unless the shadow says it already is. */
  _use(program) {
    if (this._lastProgram === program) return;
    this.gl.useProgram(program);
    this._lastProgram = program;
    this.stats.programBinds++;
  }

  /** EV6: bind `vao` (or null) unless the shadow says it already is. */
  _bindVao(vao) {
    if (this._lastVao === vao) return;
    this.gl.bindVertexArray(vao);
    this._lastVao = vao;
    if (vao) this.stats.vaoBinds++;
  }

  /** EV6: a pass outside this renderer (the skies, precipitation) has
   *  changed program/VAO state behind the shadows' back - forget them
   *  and unbind the VAO for real, so the next entry point rebinds. */
  markForeignPass() {
    this.gl.bindVertexArray(null);
    this._lastProgram = null;
    this._lastVao = null;
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
    const floats = uv ? 11 : 9;
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
    this._bindVao(null);
    return { vao, count: packed.length / floats, buffers: [vbo], vbo, floats };
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
    return tex;
  }

  /** Re-upload a character mesh's vertex stream in place (per-frame
   *  animation). `packed` must match the original layout/length. */
  updateCharacterMesh(mesh, packed) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed);
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
    const gl = this.gl;
    const c = this._char;
    this._use(this.charProgram);
    gl.uniformMatrix4fv(c.proj, false, this._proj);
    gl.uniformMatrix4fv(c.view, false, this._view);
    gl.uniformMatrix4fv(c.model, false, modelMatrix);
    gl.uniform3fv(c.lightDir, this._lightDir);
    gl.uniform3fv(c.ambient, this._ambient);
    gl.uniform1f(c.sunScale, this._sunScale);
    gl.uniform3fv(c.sunColor, this._sunColor);
    gl.uniform3fv(c.moonDir, this._moonDir);
    gl.uniform1f(c.moonScale, this._moonScale);
    gl.uniform3fv(c.moonColor, this._moonColor);
    const count = this._pointLights.length / 4;
    gl.uniform1i(c.pointCount, count);
    if (count > 0) gl.uniform4fv(c.pointLights, this._pointLights);
    if (count > 0) gl.uniform3fv(c.pointColors, this._pointColorData(count));
    gl.uniform4fv(c.indirect, this._indirect);
    gl.uniform3fv(c.indirectColor, this._indirectColor);
    this._uploadFog(this._charFog);
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
    gl.activeTexture(gl.TEXTURE0);
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
        gl.drawArrays(gl.TRIANGLES, r.first, r.count);
        this.stats.texBinds++; this.stats.draws++;
      }
    } else {
      gl.uniform1f(c.useTex, 0);
      gl.uniform1f(c.alphaCut, 0);
      gl.bindTexture(gl.TEXTURE_2D, this._blackTex);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      this.stats.texBinds++; this.stats.draws++;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.uniform1f(c.useTex, 0);
    gl.uniform1f(c.alphaCut, 0);
    this._bindVao(null);
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
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      cs = this._csRT = { fbo, tex, rb };
    }
    return cs;
  }

  /** Render a character mesh into the sprite target under a fitted
   *  ortho camera (frame lighting; the frame camera caches are
   *  swapped and restored - drawCharacter reads them). */
  renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph) {
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
    // the full 512x512 target - the quad only ever samples that
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
    const sp = this._proj, sv = this._view, sf = this._fogMode;
    this._proj = proj; this._view = view; this._fogMode = 0;
    this.drawCharacter(mesh, modelMatrix);
    this._proj = sp; this._view = sv; this._fogMode = sf;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const cc = this._clearColor;
    gl.clearColor(cc[0], cc[1], cc[2], cc[3]);
    return cs.tex;
  }

  /** MW-D36: the same sprite render, READ BACK as pixels - the enhanced
   *  inventory's figure panel is DOM, not a world quad, so the body has
   *  to leave the GPU as an image. Y is flipped on the way out (GL rows
   *  run bottom-up); the RT is borrowed and returned exactly as above. */
  renderCharacterSpriteImage(mesh, modelMatrix, proj, view, pw, ph, { studio = true } = {}) {
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
    } : null;
    if (studio) {
      const st = studioLight(view);
      this._lightDir = st.lightDir; this._ambient = st.ambient; this._sunScale = st.sunScale;
      this._sunColor = st.sunColor; this._pointLights = st.pointLights; this._indirect = st.indirect;
      this._moonScale = 0;
    }
    try {
      this.renderCharacterSprite(mesh, modelMatrix, proj, view, pw, ph);
    } finally {
      if (saved) {
        this._lightDir = saved.lightDir; this._ambient = saved.ambient; this._sunScale = saved.sunScale;
        this._sunColor = saved.sunColor; this._pointLights = saved.pointLights; this._indirect = saved.indirect;
        this._moonScale = saved.moonScale;
      }
    }
    const cs = this._charSpriteRT();
    gl.bindFramebuffer(gl.FRAMEBUFFER, cs.fbo);
    const raw = new Uint8Array(pw * ph * 4);
    gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const out = new Uint8ClampedArray(pw * ph * 4);
    for (let y = 0; y < ph; y++) out.set(raw.subarray(y * pw * 4, (y + 1) * pw * 4), (ph - 1 - y) * pw * 4);
    return { width: pw, height: ph, data: out };
  }

  /** Composite the sprite into the world: camera-facing quad at the
   *  character's position, alpha-cut, fogged, depth-tested. */
  drawCharacterSpriteQuad(tex, center, halfW, halfH, right, u1 = 1, v1 = 1) {
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
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

  drawScreenQuad(tex, dst, src = { u0: 0, v0: 0, u1: 1, v1: 1 }, color = [1, 1, 1, 1], opts = {}) {
    const gl = this.gl;
    if (!this.screenQuadProgram) {
      const vs = `#version 300 es
layout(location=0) in vec2 aPos;
uniform vec4 uDst;      // x, y, w, h in pixels (top-left origin)
uniform vec2 uCanvas;
uniform vec4 uSrc;      // u0, v0, u1, v1
out vec2 vUV;
void main() {
  vec2 p = aPos * 0.5 + 0.5;                     // 0..1
  vUV = mix(uSrc.xy, uSrc.zw, vec2(p.x, p.y));
  vec2 px = uDst.xy + p * uDst.zw;
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
      this._bindVao(null);
      this._screenQuadVao = vao;
    }
    this._use(this.screenQuadProgram);
    this._bindVao(this._screenQuadVao);
    gl.disable(gl.DEPTH_TEST);
    // HANDEDNESS REGRESSION (2026-08-23, "the sky-blue screen"): a 2D
    // blit has no facing, but with CULL_FACE left ON the global
    // frontFace(CW) swap culled EVERY screen quad - the whole UI
    // layer, title screen to fonts - leaving only the clear color.
    // tools/cullProbe.mjs is the real-GL repro; the bracket is the
    // overlay pass's own idiom.
    gl.disable(gl.CULL_FACE);
    const ox = this._screenOffset?.[0] ?? 0, oy = this._screenOffset?.[1] ?? 0;
    gl.uniform4f(this._screenQuad.dst, dst.x + ox, dst.y + oy, dst.w, dst.h);
    gl.uniform2f(this._screenQuad.canvas, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform4f(this._screenQuad.src, src.u0, src.v0, src.u1, src.v1);
    gl.uniform4f(this._screenQuad.color, color[0], color[1], color[2], color[3]);
    gl.uniform1i(this._screenQuad.useTex, tex ? 1 : 0);
    gl.uniform1i(this._screenQuad.blendTex, tex && opts.blend ? 1 : 0);
    if (tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(this._screenQuad.tex, 0); this.stats.texBinds++; }
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
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    this._bindVao(null);
  }

    drawScreenOverlayQuad(tex, u1, v1) {
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
    this._use(this.overlayProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(this._overlay.tex, 0);
    gl.uniform2f(this._overlay.uv1, u1, v1);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this._bindVao(this._overlayVAO);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    this.stats.texBinds++; this.stats.draws++;
    this._bindVao(null);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }

  /** Upload a getColor32 result as a REPEAT/NEAREST texture, keyed and cached.
   *
   *  REPEAT/NEAREST is the law for GAME art and stays the default: classic
   *  textures tile, and NEAREST is what keeps a 320x200 IMG pixel-exact at
   *  the integer scales nativePanel picks. U21c adds an opt-in for art
   *  authored outside that world - our logo is a high-resolution banner
   *  drawn at a NON-integer scale, where NEAREST aliases the serifs and
   *  REPEAT lets a LINEAR tap at the border sample the opposite edge.
   *  { smooth: true } gives it LINEAR/CLAMP_TO_EDGE instead. */
  uploadTexture(archive, record, color32, opts = {}) {
    // (see textureParams below - the decision is pure and pinned there)
    // AUDIT 19 F10: the SAMPLING MODE is part of the key. The cache is
    // keyed by archive/record and returns early on a hit, so asking for
    // { smooth: true } under a key already uploaded NEAREST/REPEAT used to
    // hand back the wrong sampling silently. Only the logo asks for smooth
    // today and its key is unique, so nothing was broken - but a cache
    // that quietly ignores an argument is a trap, not a cache.
    const key = `${archive}_${record}${opts.smooth ? '#smooth' : ''}`;
    if (this.textures.has(key)) return this.textures.get(key);
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
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
      gl.RGBA, gl.UNSIGNED_BYTE, asBytes(color32.colors)
    );
    const { wrap, filter } = textureParams(gl, opts);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
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
    for (const key of [base, `${base}#smooth`]) {
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
    return { vao, subMeshes: model.subMeshes.map((sm) => ({ ...sm })), buffers, triIndices: model.indices };
  }

  beginFrame(proj, view, lightDir) {
    const s = this.stats;
    s.draws = 0; s.programBinds = 0; s.vaoBinds = 0; s.texBinds = 0;
    // EV6: the shadows reset with the counters - whatever ran between
    // frames (UI passes, another context's work) is not trusted.
    this._lastProgram = null;
    this._lastVao = null;
    const gl = this.gl;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this._use(this.program);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform3fv(this.uLightDir, lightDir);
    this._lightDir = lightDir;
    gl.uniform3fv(this.uAmbient, this._ambient);
    gl.uniform1f(this.uSunScale, this._sunScale);
    gl.uniform3fv(this.uSunColor, this._sunColor);
    gl.uniform3fv(this.uMoonDir, this._moonDir);
    gl.uniform1f(this.uMoonScale, this._moonScale);
    gl.uniform3fv(this.uMoonColor, this._moonColor);
    gl.uniform1i(this.uTex, 0);
    gl.uniform1i(this.uEmissionTex, 1);
    gl.uniform3fv(this.uEmissionColor, this._windowEmission);
    this._emissionColorUp = this._windowEmission;   // F49: the per-sub-mesh shadow starts the frame true
    const count = this._pointLights.length / 4;
    gl.uniform1i(this.uPointCount, count);
    if (count > 0) gl.uniform4fv(this.uPointLights, this._pointLights);
    if (count > 0) gl.uniform3fv(this.uPointColors, this._pointColorData(count));
    gl.uniform4fv(this.uIndirect, this._indirect);
    gl.uniform3fv(this.uIndirectColor, this._indirectColor);
    // Camera position from the view matrix (view = R^T * T(-eye)).
    const v = view;
    this._camPos[0] = -(v[0] * v[12] + v[1] * v[13] + v[2] * v[14]);
    this._camPos[1] = -(v[4] * v[12] + v[5] * v[13] + v[6] * v[14]);
    this._camPos[2] = -(v[8] * v[12] + v[9] * v[13] + v[10] * v[14]);
    this._uploadFog(this._solidFog);
    gl.activeTexture(gl.TEXTURE0);
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
    const s = this._panelSaved;
    if (!s) return;
    this._panelSaved = null;
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
    this.setWindowEmission(s.windowEmission);
    this.setPointLights(s.pointLights, s.pointColor, s.pointColors);
    this.setIndirectLight([s.indirect[0], s.indirect[1], s.indirect[2]], s.indirect[3], s.indirectColor);
    this._proj = s.proj; this._view = s.view; this._lightDir = s.lightDir;
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
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
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

  /** Time-of-day lighting: ambient color, sun scale, sun color. */
  setLighting(ambient, sunScale, sunColor) {
    this._ambient = ambient;
    this._sunScale = sunScale;
    if (sunColor) this._sunColor = sunColor;
    this._clockLit = true;
  }

  /** Distance fog for every world pass. mode 'off'|'linear'|'exp'. */
  setFog(mode, density, start, end, color) {
    this._fogMode = mode === 'linear' ? 1 : mode === 'exp' ? 2 : 0;
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
    this._pointLights = data.subarray ? data.subarray(0, 16 * 4) : data;
    if (color) this._pointColor = color;
    this._pointColors = colors ? (colors.subarray ? colors.subarray(0, 16 * 3) : colors) : null;
  }

  /** LT1: the vec3 array a frame uploads - the host's per-light colours
   *  when given, else the shared colour splatted across the count. */
  _pointColorData(count) {
    if (this._pointColors) return this._pointColors;
    const s = this._pointColorScratch;
    for (let i = 0; i < count * 3; i += 3) {
      s[i] = this._pointColor[0]; s[i + 1] = this._pointColor[1]; s[i + 2] = this._pointColor[2];
    }
    return s.subarray(0, count * 3);
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
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, color32.width, color32.height, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, asBytes(color32.colors)   // AUDIT 19 F7: the view, not its buffer
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    this.emissionTextures.set(key, tex);
    this._texGen++;   // EV2: cached sub-mesh lookups refresh
    return tex;
  }

  /**
   * One batch = all billboards of one (archive, record): 4 verts per flat
   * (center xyz + corner offsets in -0.5..0.5), indexed quads. Positions are
   * the billboard BASE; the shader lifts by half height (AlignToBase).
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
    return { vao, indexCount: count * 6, archive, record, size, buffers: [vb, ib], origin: null, frame: null };
  }

  /** Free one billboard batch's GL objects (S2 pickup removes piles;
   *  the optional-chained call it replaced would have leaked). */
  destroyBillboardBatch(batch) {
    const gl = this.gl;
    if (!batch) return;
    if (batch.vao) gl.deleteVertexArray(batch.vao);
    for (const b of batch.buffers || []) gl.deleteBuffer(b);
    batch.vao = null;
    batch.buffers = [];
  }

  /** Release a createMesh bundle's GPU resources. */
  destroyMesh(mesh) {
    const gl = this.gl;
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
    return { vao, buffers, indexCount: indexSet.count };
  }

  /** Upload a 128x128 tilemap byte texture (R8UI, NEAREST). */
  uploadTilemapTexture(bytes, dim) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
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
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // DFU's terrain texture array wraps Clamp (TextureReader) - keeps
    // the far edge texel at transformed-uv 1.0 boundary ties.
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tileArrays.set(archive, tex);
    return tex;
  }

  /** Draw one terrain surface with its tilemap + tile array. */
  drawTerrain(surface, modelMatrix, arrayTex, tilemapTex, tileSize) {
    const gl = this.gl;
    this._use(this.terrainProgram);
    gl.uniformMatrix4fv(this.tUProj, false, this._proj);
    gl.uniformMatrix4fv(this.tUView, false, this._view);
    gl.uniformMatrix4fv(this.tUModel, false, modelMatrix);
    gl.uniform1f(this.tUTileSize, tileSize);
    this._uploadFog(this._terrainFog);
    gl.uniform3fv(this.tULightDir, this._lightDir);
    gl.uniform3fv(this.tUAmbient, this._ambient);
    gl.uniform1f(this.tUSunScale, this._sunScale);
    gl.uniform3fv(this.tUSunColor, this._sunColor);
    gl.uniform3fv(this.tUMoonDir, this._moonDir);
    gl.uniform1f(this.tUMoonScale, this._moonScale);
    gl.uniform3fv(this.tUMoonColor, this._moonColor);
    const count = this._pointLights.length / 4;
    gl.uniform1i(this.tUPointCount, count);
    if (count > 0) gl.uniform4fv(this.tUPointLights, this._pointLights);
    if (count > 0) gl.uniform3fv(this.tUPointColors, this._pointColorData(count));
    gl.uniform4fv(this.tUIndirect, this._indirect);
    gl.uniform3fv(this.tUIndirectColor, this._indirectColor);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrayTex);
    gl.uniform1i(this.tUTileArr, 0);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tilemapTex);
    gl.uniform1i(this.tUTilemap, 2);
    gl.activeTexture(gl.TEXTURE0);
    this._bindVao(surface.vao);
    gl.drawElements(gl.TRIANGLES, surface.indexCount, gl.UNSIGNED_INT, 0);
    this.stats.texBinds += 2; this.stats.draws++;
    this._bindVao(null);
  }

  /**
   * Draw dungeon water planes. Call after all opaque geometry: alpha
   * blended, depth tested against the world but not written.
   * @param {Array<{x:number,z:number,size:number,y:number}>} quads
   * @param {number[]} color - rgba
   */
  drawWater(quads, color, waterTex, scrollTiles = 0) {
    if (!quads.length) return;
    const gl = this.gl;
    this._use(this.waterProgram);
    gl.uniformMatrix4fv(this.waterUProj, false, this._proj);
    gl.uniformMatrix4fv(this.waterUView, false, this._view);
    gl.uniform4fv(this.waterUColor, color);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, waterTex);
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

  /** Draw billboard batches facing the camera. Call after solid geometry. */
  drawBillboards(batches, camRight, camUp) {
    const gl = this.gl;
    this._use(this.bbProgram);
    gl.uniformMatrix4fv(this.bbUProj, false, this._proj);
    gl.uniformMatrix4fv(this.bbUView, false, this._view);
    gl.uniform3fv(this.bbURight, camRight);
    gl.uniform3fv(this.bbUUp, camUp);
    gl.uniform1i(this.bbUTex, 0);
    this._uploadFog(this._bbFog);
    // Billboards take the scene's time-of-day light (DFU's ambient-lit
    // billboards): ambient plus the Lambert-average half of the sun term.
    // Clockless scenes keep the pre-R5 full-bright flats.
    if (this._clockLit) {
      // EV5: the flats have no normals, so the moon takes the same
      // Lambert-average half the sun does - a scalar on the tint.
      gl.uniform3f(
        this.bbUTint,
        this._ambient[0] + this._sunColor[0] * this._sunScale * 0.5 + this._moonColor[0] * this._moonScale * 0.5,
        this._ambient[1] + this._sunColor[1] * this._sunScale * 0.5 + this._moonColor[1] * this._moonScale * 0.5,
        this._ambient[2] + this._sunColor[2] * this._sunScale * 0.5 + this._moonColor[2] * this._moonScale * 0.5
      );
    } else {
      gl.uniform3f(this.bbUTint, 1, 1, 1);
    }
    const bbCount = this._pointLights.length >> 2;
    gl.uniform1i(this.bbUPointCount, bbCount);
    if (bbCount > 0) gl.uniform4fv(this.bbUPointLights, this._pointLights);
    if (bbCount > 0) gl.uniform3fv(this.bbUPointColors, this._pointColorData(bbCount));
    gl.uniform4fv(this.bbUIndirect, this._indirect);
    gl.uniform3fv(this.bbUIndirectColor, this._indirectColor);
    gl.uniform1i(this.bbUEmissionTex, 1);
    gl.disable(gl.CULL_FACE);
    // Two phases: opaque flats first (classic cutout), then SPECTRAL
    // batches blended with depth-writes off - ghosts keep their 180
    // alpha (~70% visible) and their emission map (red eyes + the
    // V^1.9 body glow). Rendering's last queue row, classic-visuals
    // direction (Mac).
    const drawOne = (b) => {
      // FA1: an animated flat's frames are uploaded under `record#frame`
      // (the key uploadRecordFrame already mints for enemy sprites);
      // a still flat is `record` alone, as before.
      const key = b.frame == null ? `${b.archive}_${b.record}` : `${b.archive}_${b.record}#${b.frame}`;
      const tex = this.textures.get(key);
      if (!tex) return;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.emissionTextures.get(key) || this._blackTex);
      gl.uniform2f(this.bbUSize, b.size.w, b.size.h);
      const o = b.origin || ZERO_ORIGIN;
      gl.uniform3f(this.bbUOrigin, o[0], o[1], o[2]);
      this._bindVao(b.vao);
      gl.drawElements(gl.TRIANGLES, b.indexCount, gl.UNSIGNED_INT, 0);
      this.stats.texBinds += 2; this.stats.draws++;
    };
    gl.uniform1i(this.bbUSpectral, 0);
    for (const b of batches) if (!isSpectralArchive(b.archive)) drawOne(b);
    let anySpectral = false;
    for (const b of batches) if (isSpectralArchive(b.archive)) { anySpectral = true; break; }
    if (anySpectral) {
      gl.uniform1i(this.bbUSpectral, 1);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const b of batches) if (isSpectralArchive(b.archive)) drawOne(b);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    gl.activeTexture(gl.TEXTURE0);
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
    this._drawMeshBundle(mesh, modelMatrix, texRemap, false);
  }

  _drawMeshBundle(mesh, modelMatrix, texRemap, wire) {
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
    gl.uniformMatrix4fv(this.uModel, false, modelMatrix);
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
        tex = this.textures.get(resolved);
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
        gl.uniform3fv(this.uEmissionColor, emisColor);
        this._emissionColorUp = emisColor;
      }
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, sm._evEmis);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      this.stats.texBinds += 2;
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
