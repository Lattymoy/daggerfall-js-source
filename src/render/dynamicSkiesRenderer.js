// DYNAMIC SKIES - THE PASS (DS1). BLB/SkyBox/BLBProceduralSkybox
// (vendor/dynamic-skies/Shaders/BLBProceduralSkybox.shader, with
// Includes/Scattering.cginc and Includes/MoonFunctions.cginc) as one
// GLSL ES 3.00 fullscreen pass, translated line for line. The shader's
// property names are the uniform names, so the two can be read side by
// side.
//
// THREE TRANSLATIONS, said out loud:
//   1. Unity draws a skybox as a tessellated mesh and runs `vert` per
//      vertex, interpolating skyColor/sunColor/fogColor across each
//      triangle; here `vert` runs per PIXEL on the same eye ray ABOVE
//      the horizon, which is the limit of the tessellation. BELOW it
//      the limit is wrong: the ground arm's `far = -kCameraHeight /
//      min(-0.001, y)` is at its 0.1 maximum for rays a hair under the
//      horizon, where no mesh vertex ever sits (a vertex at y = 0 takes
//      the sky arm), so a per-pixel `vert` painted a bright rim along
//      the whole horizon that the shipped mod does not draw (the review
//      of DS1 measured it: a full-white row under the horizon at dawn).
//      So below the horizon the pass does what the mesh does: it
//      evaluates `vert` at the two vertex rows the ray falls between
//      (MESH_ROW apart, the first at y = 0) and interpolates. Unity's
//      own skybox mesh is not in the tree; MESH_ROW is a sixteen-row
//      hemisphere, recorded as the equivalence.
//   2. Colour space. DFU renders LINEAR (ProjectSettings
//      m_ActiveColorSpace 1): sRGB textures are linearised on sample
//      (SRGB8_ALPHA8 here - the GPU's own decode, before filtering, as
//      Unity's), Material.SetColor values are linearised at upload
//      (dynamicSkies.srgbToLinear), the shader works in linear and the
//      backbuffer encodes. The port's framebuffer is not sRGB, so the
//      pass encodes its own output: outColor = linearToSrgb(col).
//      UNITY_COLORSPACE_GAMMA is therefore NOT defined: no sqrt on the
//      colours, COLOR_2_GAMMA is the pow(1/2.2) arm (unused - the mod
//      feeds tintedSky, not kSkyTintInGammaSpace, to the wavelengths).
//   3. Keywords are the material's, baked: REDUCE_COLOR on,
//      _SUNDISK_HIGH_QUALITY, _MOONSPINOPTION_TIDAL_LOCK and
//      _SECUNDASPINOPTION_TIDAL_LOCK. PHASE_LIGHT is off and its arm is
//      commented out in the source anyway.
//
// HLSL -> GLSL notes at the lines they touch: `saturate` is clamp 0..1;
// `smoothstep` is spelled out as HLSL's (GLSL's is undefined for
// edge0 >= edge1 - not that any preset does it); `mul(M, v)` on a
// float3x3 built from ROWS is rows dot v, which is `v * mat3(rows)` in
// GLSL; `tex2D` is texture(); `frac` is fract(); `atan2(y, x)` is
// atan(y, x); UnpackNormal is UnpackNormalmapRGorAG (desktop: x = R*A,
// no DXT5nm keyword) and the vendored CdMCloudsNormal.png IS Unity's
// converted normal map (R = 1, A = x), so the formula is exact;
// BlendNormals is UnityStandardUtils' normalize(n1.xy + n2.xy, n1.z*n2.z);
// UNITY_CALC_FOG_FACTOR_RAW computes a factor the fragment never
// reads, and is left out.
//
// The contract is EnhancedSkyRenderer's: draw(yaw, pitch, fovY, aspect)
// after beginFrame, fogMix / fogColor written by the host, clearColor /
// fillColor read by it. The mod does no retro pass of its own kind
// (REDUCE_COLOR is its posterise), so the port's retro snap is not
// applied over it.

import { MATERIAL_DEFAULTS, TEXTURE_SLOTS, TEXTURE_IMPORTS, SLOT_DEFAULT_TEXEL, srgbToLinear } from '../systems/dynamicSkies.js';

/** Which material properties are COLOURS (SetColor -> linearised at
 *  upload under linear colour space). Every other vec4 is SetVector. */
export const COLOR_PROPERTIES = Object.freeze([
  '_SkyTint', '_GroundColor', '_FogColor', '_FogDayColor', '_FogNightColor', '_MoonNightColor',
  '_CloudTopColor', '_CloudTopNightColor', '_CloudTopSunColor',
  '_CloudColor', '_CloudNightColor', '_CloudSunColor',
  '_MoonColor', '_SecundaColor',
]);
const VEC3_COLOR = new Set(['_SkyTint', '_GroundColor', '_FogColor', '_FogDayColor', '_FogNightColor',
  '_CloudTopColor', '_CloudTopNightColor', '_CloudTopSunColor', '_CloudColor', '_CloudNightColor', '_CloudSunColor']);
const VEC4_COLOR = new Set(['_MoonNightColor', '_MoonColor', '_SecundaColor']);
const VEC4_RAW = new Set(['_MoonOrbitAngle', '_SecundaOrbitAngle']);
const VEC3_RAW = new Set(['_MoonTidalAngle', '_SecundaTidalAngle', '_MoonSpinSpeed', '_SecundaSpinSpeed', '_MoonPhase', '_SecundaPhase']);
export const FLOAT_PROPERTIES = Object.freeze([
  '_Exposure', '_SunSize', '_SunSizeConvergence', '_AtmosphereLerpDuration', '_AtmosphereNormalThickness',
  '_AtmosphereDawnDuskThickness', '_AtmosphereLerp', '_NightStartHeight', '_NightEndHeight', '_SkyFadeStart', '_SkyFadeEnd',
  '_stepSize', '_FogDistance', '_WorldTime', '_CloudFadeHeight',
  '_CloudTopNormalEffect', '_CloudTopOpacity', '_CloudTopAlphaMax', '_CloudTopAlphaCutoff', '_CloudTopBending',
  '_CloudTopSunScale', '_CloudTopSunLerpScale',
  '_CloudSpeed', '_CloudColorBoost', '_CloudBlendSpeed', '_CloudNormalEffect', '_CloudOpacity', '_CloudAlphaMax',
  '_CloudAlphaCutoff', '_CloudBending', '_CloudDirection', '_CloudBlendScale', '_CloudBlendLB', '_CloudBlendUB',
  '_CloudNormalSpeed', '_CloudSunScale', '_CloudSunLerpScale',
  '_StarBending', '_TwinkleBoost', '_TwinkleSpeed',
  '_MoonMaxSize', '_MoonMinSize', '_MoonOrbitSpeed', '_MoonOrbitOffset', '_MoonSemiMajAxis', '_MoonSemiMinAxis',
  '_SecundaMaxSize', '_SecundaMinSize', '_SecundaOrbitSpeed', '_SecundaOrbitOffset', '_SecundaSemiMajAxis', '_SecundaSemiMinAxis',
]);
const ST_PROPERTIES = TEXTURE_SLOTS.map((s) => s + '_ST');
/** Every uniform the pass fetches a location for - which must be every
 *  uniform the GLSL declares (the DS1 review found `_CloudTopColorBoost`
 *  read by the shader and fetched by nobody, so its upload was a silent
 *  no-op and the mod's red-only boost never happened). Pinned against
 *  the FS's own declarations in test/dynamicSkies.test.js. */
export const UNIFORM_NAMES = Object.freeze(['uYaw', 'uPitch', 'uTanHalfFov', 'uAspect', '_WorldSpaceLightPos0', '_LightColor0', 'uFogColor', 'uFogMix',
  '_CloudTopColorBoost',   // the float3-fed-by-a-float quirk, uploaded apart from the float list
  ...FLOAT_PROPERTIES, ...COLOR_PROPERTIES, ...VEC4_RAW, ...VEC3_RAW, ...TEXTURE_SLOTS, ...ST_PROPERTIES]);

const VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.9999, 1.0); }`;

export const FS = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vNdc;
out vec4 outColor;

// the host's view (the same ray the enhanced sky builds)
uniform float uYaw, uPitch, uTanHalfFov, uAspect;
// Unity's per-frame light globals for the skybox pass
uniform vec3 _WorldSpaceLightPos0;   // toward the sun (SunlightManager's rotation, unclamped)
uniform vec3 _LightColor0;           // SunLight colour x intensity, linear
// the host's fog over the dome (post-process fog with excludeSkybox false)
uniform vec3 uFogColor;
uniform float uFogMix;

// ── Properties, as the shader declares them ──────────────────────
uniform float _Exposure;
uniform vec3 _GroundColor;
uniform float _SunSize;
uniform float _SunSizeConvergence;
uniform vec3 _SkyTint;
uniform float _AtmosphereLerpDuration;
uniform float _AtmosphereNormalThickness;
uniform float _AtmosphereLerp;
uniform float _AtmosphereDawnDuskThickness;
uniform float _NightStartHeight, _NightEndHeight;
uniform float _SkyFadeStart, _SkyFadeEnd;
uniform float _stepSize;

uniform vec3 _FogColor;
uniform vec3 _FogDayColor;
uniform vec3 _FogNightColor;
uniform float _FogDistance;
uniform vec4 _MoonNightColor;

uniform float _WorldTime;

uniform float _CloudFadeHeight;

uniform sampler2D _CloudTopDiffuse, _CloudTopNormal;
uniform vec4 _CloudTopDiffuse_ST, _CloudTopNormal_ST;
uniform vec3 _CloudTopColorBoost, _CloudTopColor, _CloudTopNightColor;   // QUIRK: float3 fed by a float - (boost, 0, 0)
uniform float _CloudTopNormalEffect, _CloudTopOpacity;
uniform float _CloudTopAlphaMax, _CloudTopAlphaCutoff;
uniform float _CloudTopBending, _CloudTopSunScale, _CloudTopSunLerpScale;
uniform vec3 _CloudTopSunColor;

uniform sampler2D _CloudDiffuse, _CloudNormal;
uniform vec4 _CloudDiffuse_ST, _CloudNormal_ST;
uniform float _CloudSpeed, _CloudColorBoost, _CloudBlendSpeed;
uniform vec3 _CloudColor, _CloudNightColor;
uniform float _CloudNormalEffect, _CloudOpacity;
uniform float _CloudAlphaMax, _CloudAlphaCutoff;
uniform float _CloudBending;
uniform float _CloudDirection, _CloudBlendScale, _CloudBlendLB, _CloudBlendUB, _CloudNormalSpeed;
uniform float _CloudSunScale, _CloudSunLerpScale;
uniform vec3 _CloudSunColor;

uniform sampler2D _StarTex, _StarTwinkleTex, _TwinkleTex;
uniform vec4 _StarTex_ST, _StarTwinkleTex_ST, _TwinkleTex_ST;
uniform float _StarBending;
uniform float _TwinkleBoost, _TwinkleSpeed;

uniform sampler2D _MoonTex;
uniform vec4 _MoonTex_ST;
uniform vec4 _MoonColor;
uniform vec4 _MoonOrbitAngle;
uniform float _MoonMaxSize, _MoonMinSize;
uniform float _MoonOrbitSpeed, _MoonOrbitOffset, _MoonSemiMajAxis, _MoonSemiMinAxis;
uniform vec3 _MoonSpinSpeed, _MoonTidalAngle;
uniform vec3 _MoonPhase;

uniform sampler2D _SecundaTex;
uniform vec4 _SecundaTex_ST;
uniform vec4 _SecundaColor;
uniform vec4 _SecundaOrbitAngle;
uniform float _SecundaMaxSize, _SecundaMinSize;
uniform float _SecundaOrbitSpeed, _SecundaOrbitOffset, _SecundaSemiMajAxis, _SecundaSemiMinAxis;
uniform vec3 _SecundaSpinSpeed, _SecundaTidalAngle;
uniform vec3 _SecundaPhase;

// ── HLSL intrinsics ──────────────────────────────────────────────
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
// HLSL smoothstep: saturate((x - a) / (b - a)), then the cubic
float hsmoothstep(float a, float b, float x) { float t = saturate((x - a) / (b - a)); return t * t * (3.0 - 2.0 * t); }
#define UNITY_PI 3.14159265359
#define UNITY_TWO_PI 6.28318530718
float radiansOf(float deg) { return deg * 0.01745329252; }

// UnityCG UnpackNormal, the desktop (DXT5nm-style) arm: x rides R * A.
vec3 UnpackNormal(vec4 packednormal) {
  packednormal.x *= packednormal.w;
  vec3 n;
  n.xy = packednormal.xy * 2.0 - 1.0;
  n.z = sqrt(1.0 - saturate(dot(n.xy, n.xy)));
  return n;
}
// UnityStandardUtils BlendNormals
vec3 BlendNormals(vec3 n1, vec3 n2) { return normalize(vec3(n1.xy + n2.xy, n1.z * n2.z)); }

// ── Includes/MoonFunctions.cginc ─────────────────────────────────
// float3x3 written in rows; mul(rotMat, position) = rows dot position
vec3 RotateWorldPosition(vec3 position, vec3 axis) {
  vec3 rot = axis;
  vec3 r0 = vec3(cos(rot.y) * cos(rot.z), -cos(rot.y) * sin(rot.z), sin(rot.y));
  vec3 r1 = vec3((cos(rot.x) * sin(rot.z)) + (sin(rot.x) * sin(rot.y) * cos(rot.z)), (cos(rot.x) * cos(rot.z)) - (sin(rot.x) * sin(rot.y) * sin(rot.z)), -sin(rot.x) * cos(rot.y));
  vec3 r2 = vec3((sin(rot.x) * sin(rot.z)) - (cos(rot.x) * sin(rot.y) * cos(rot.z)), (sin(rot.x) * cos(rot.z)) + (cos(rot.x) * sin(rot.y) * sin(rot.z)), cos(rot.x) * cos(rot.y));
  return vec3(dot(r0, position), dot(r1, position), dot(r2, position));
}
vec3 ElipsePosition(vec2 MajMinAxis, float angle) {
  vec3 orbitPos;
  orbitPos.x = (MajMinAxis.x * cos(angle));
  orbitPos.y = 0.0;
  orbitPos.z = (MajMinAxis.y * sin(angle));
  return normalize(orbitPos);
}
vec3 GetOrbitPosition(vec3 orbitOffsetAngles, vec2 MajMinAxis, float angle) {
  vec3 p = ElipsePosition(MajMinAxis, angle);
  p = RotateWorldPosition(p, vec3(radiansOf(orbitOffsetAngles.x), radiansOf(orbitOffsetAngles.y), radiansOf(orbitOffsetAngles.z)));
  return p;
}
float GetMoonDistance(float Min, float Max, vec2 MajMinAxis, float angle) {
  vec3 pos = ElipsePosition(MajMinAxis, angle);
  float lerpFactor = abs(dot(pos, vec3(0.0, 0.0, 1.0)));
  float dist = mix(Min, Max, hsmoothstep(0.0, 1.0, lerpFactor));
  return dist;
}
float SphereIntersect(vec3 rayOrigin, vec3 rayDirection, vec3 spherePos, float sphereRadius) {
  vec3 originToCenter = rayOrigin - spherePos;
  float b = dot(originToCenter, rayDirection);
  float c = dot(originToCenter, originToCenter) - sphereRadius * sphereRadius;
  float h = b * b - c;
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  return -b - h;
}
vec3 RotateArbitraryAxis(vec3 v, float angle, vec3 axis) {
  float rads = radiansOf(angle);
  vec3 r0 = vec3(cos(rads) + dot(axis.x, axis.x) * (1.0 - cos(rads)), axis.x * axis.y * (1.0 - cos(rads)) - axis.z * sin(rads), axis.x * axis.z * (1.0 - cos(rads)) + axis.y * sin(rads));
  vec3 r1 = vec3(axis.y * axis.x * (1.0 - cos(rads)) + axis.z * sin(rads), cos(rads) + dot(axis.y, axis.y) * (1.0 - cos(rads)), axis.y * axis.z * (1.0 - cos(rads)) - axis.x * sin(rads));
  vec3 r2 = vec3(axis.z * axis.x * (1.0 - cos(rads)) - axis.y * sin(rads), axis.z * axis.y * (1.0 - cos(rads)) + axis.x * sin(rads), cos(rads) + dot(axis.z, axis.z) * (1.0 - cos(rads)));
  return vec3(dot(r0, v), dot(r1, v), dot(r2, v));
}

// ── Includes/Scattering.cginc (linear colour space arm) ──────────
const vec3 kDefaultScatteringWavelength = vec3(.65, .57, .475);
const vec3 kVariableRangeForScatteringWavelength = vec3(.15, .15, .15);
#define OUTER_RADIUS 1.025
const float kOuterRadius = OUTER_RADIUS;
const float kOuterRadius2 = OUTER_RADIUS * OUTER_RADIUS;
const float kInnerRadius = 1.0;
const float kInnerRadius2 = 1.0;
const float kCameraHeight = 0.0001;
#define kMIE 0.0010
#define kSUN_BRIGHTNESS 20.0
#define kMAX_SCATTER 50.0
const float kHDSundiskIntensityFactor = 15.0;
const float kSimpleSundiskIntensityFactor = 27.0;
const float kSunScale = 400.0 * kSUN_BRIGHTNESS;
const float kKmESun = kMIE * kSUN_BRIGHTNESS;
const float kKm4PI = kMIE * 4.0 * 3.14159265;
const float kScale = 1.0 / (OUTER_RADIUS - 1.0);
const float kScaleDepth = 0.25;
const float kScaleOverScaleDepth = (1.0 / (OUTER_RADIUS - 1.0)) / 0.25;
const float kSamples = 2.0;
#define MIE_G (-0.990)
#define MIE_G2 0.9801
#define SKY_GROUND_THRESHOLD 0.01

float getRayleighPhase(float eyeCos2) { return 0.75 + 0.75 * eyeCos2; }
float getRayleighPhase(vec3 light, vec3 ray) { float eyeCos = dot(light, ray); return getRayleighPhase(eyeCos * eyeCos); }
float scale(float inCos) {
  float x = 1.0 - inCos;
  return 0.25 * exp(-0.00287 + x * (0.459 + x * (3.83 + x * (-6.80 + x * 5.25))));
}
float getMiePhase(float eyeCos, float eyeCos2, float SunSize) {
  float temp = 1.0 + MIE_G2 - 2.0 * MIE_G * eyeCos;
  temp = pow(temp, pow(SunSize, 0.65) * 10.0);
  temp = max(temp, 1.0e-4);
  temp = 1.5 * ((1.0 - MIE_G2) / (2.0 + MIE_G2)) * (1.0 + eyeCos2) / temp;
  return temp;
}
// SKYBOX_SUNDISK_HQ
float calcSunAttenuation(vec3 lightPos, vec3 ray, float SunSize, float SunSizeConvergence) {
  float focusedEyeCos = pow(saturate(dot(lightPos, ray)), SunSizeConvergence);
  return getMiePhase(-focusedEyeCos, focusedEyeCos * focusedEyeCos, SunSize);
}

float Remap(float In, vec2 InMinMax, vec2 OutMinMax) {
  return OutMinMax.x + (In - InMinMax.x) * (OutMinMax.y - OutMinMax.x) / (InMinMax.y - InMinMax.x);
}

// ── vert, per pixel ──────────────────────────────────────────────
struct V2F { vec3 vertex; vec3 groundColor; vec3 skyColor; vec3 sunColor; vec3 fogColor; };

V2F vert(vec3 eyeRay) {
  V2F OUT;
  vec3 normalSunPos = normalize(_WorldSpaceLightPos0.xyz);
  float lerpScale = saturate(hsmoothstep(-_AtmosphereLerpDuration, 0.0, -normalSunPos.y) / _AtmosphereLerp);
  float _AtmosphereThickness = mix(_AtmosphereNormalThickness, _AtmosphereDawnDuskThickness, lerpScale);
  float kRAYLEIGH = mix(0.0, 0.0025, pow(_AtmosphereThickness, 2.5));

  vec3 tintedSky = mix(_SkyTint, vec3(1.0, 1.0, 1.0), saturate(sqrt(lerpScale)));
  // kSkyTintInGammaSpace = COLOR_2_GAMMA(tintedSky) is computed and unused

  vec3 kScatteringWavelength = mix(
    kDefaultScatteringWavelength - kVariableRangeForScatteringWavelength,
    kDefaultScatteringWavelength + kVariableRangeForScatteringWavelength,
    vec3(1.0, 1.0, 1.0) - tintedSky);
  vec3 kInvWavelength = 1.0 / pow(kScatteringWavelength, vec3(4.0));

  float kKrESun = kRAYLEIGH * kSUN_BRIGHTNESS;
  float kKr4PI = kRAYLEIGH * 4.0 * 3.14159265;

  vec3 cameraPos = vec3(0.0, kInnerRadius + kCameraHeight, 0.0);

  float far = 0.0;
  vec3 cIn, cOut;

  if (eyeRay.y >= 0.0) {
    far = 0.5 * (sqrt(kOuterRadius2 + kInnerRadius2 * eyeRay.y * eyeRay.y - kInnerRadius2) - kInnerRadius * eyeRay.y);
    float height = kInnerRadius + kCameraHeight;
    float depth = exp(kScaleOverScaleDepth * (-kCameraHeight));
    float startAngle = dot(eyeRay, cameraPos) / height;
    float startOffset = depth * scale(startAngle);

    float sampleLength = far / kSamples;
    float scaledLength = sampleLength * kScale;
    vec3 sampleRay = eyeRay * sampleLength;
    vec3 samplePoint = cameraPos + sampleRay * 0.5;

    vec3 frontColor = vec3(0.0, 0.0, 0.0);
    {
      float height2 = length(samplePoint);
      float depth2 = exp(kScaleOverScaleDepth * (kInnerRadius - height2));
      float lightAngle = dot(_WorldSpaceLightPos0.xyz, samplePoint) / height2;
      float cameraAngle = dot(eyeRay, samplePoint) / height2;
      float scatter = (startOffset + depth2 * (scale(lightAngle) - scale(cameraAngle)));
      vec3 attenuate = exp(-clamp(scatter, 0.0, kMAX_SCATTER) * (kInvWavelength * kKr4PI + kKm4PI));
      frontColor += attenuate * (depth2 * scaledLength);
      samplePoint += sampleRay;
    }
    {
      float height2 = length(samplePoint);
      float depth2 = exp(kScaleOverScaleDepth * (kInnerRadius - height2));
      float lightAngle = dot(_WorldSpaceLightPos0.xyz, samplePoint) / height2;
      float cameraAngle = dot(eyeRay, samplePoint) / height2;
      float scatter = (startOffset + depth2 * (scale(lightAngle) - scale(cameraAngle)));
      vec3 attenuate = exp(-clamp(scatter, 0.0, kMAX_SCATTER) * (kInvWavelength * kKr4PI + kKm4PI));
      frontColor += attenuate * (depth2 * scaledLength);
      samplePoint += sampleRay;
    }
    cIn = frontColor * (kInvWavelength * kKrESun);
    cOut = frontColor * kKmESun;
  } else {
    far = (-kCameraHeight) / (min(-0.001, eyeRay.y));
    vec3 pos = cameraPos + far * eyeRay;
    float depth = exp((-kCameraHeight) * (1.0 / kScaleDepth));
    float cameraAngle = dot(-eyeRay, pos);
    float lightAngle = dot(_WorldSpaceLightPos0.xyz, pos);
    float cameraScale = scale(cameraAngle);
    float lightScale = scale(lightAngle);
    float cameraOffset = depth * cameraScale;
    float temp = (lightScale + cameraScale);

    float sampleLength = far / kSamples;
    float scaledLength = .9 * sampleLength * kScale;
    vec3 sampleRay = 1.5 * eyeRay * sampleLength;
    vec3 samplePoint = cameraPos + sampleRay * 0.5;

    vec3 frontColor = vec3(0.0, 0.0, 0.0);
    vec3 attenuate;
    {
      float height2 = length(samplePoint);
      float depth2 = exp(kScaleOverScaleDepth * (kInnerRadius - height2));
      float scatter = depth2 * temp - cameraOffset;
      attenuate = exp(-clamp(scatter, 0.0, kMAX_SCATTER) * (kInvWavelength * kKr4PI + kKm4PI));
      frontColor += attenuate * (depth2 * scaledLength);
      samplePoint += sampleRay;
    }
    cIn = frontColor * (kInvWavelength * kKrESun + kKmESun);
    cOut = clamp(attenuate, 0.0, 1.0);
  }

  OUT.vertex = -eyeRay;
  OUT.groundColor = _FogColor;
  OUT.fogColor = (cIn * .1) + _FogColor;
  OUT.skyColor = _Exposure * (cIn * getRayleighPhase(_WorldSpaceLightPos0.xyz, -eyeRay));

  float lightColorIntensity = clamp(length(_LightColor0.xyz), 0.25, 1.0);
  OUT.sunColor = kHDSundiskIntensityFactor * saturate(cOut) * _LightColor0.xyz / lightColorIntensity;
  return OUT;
}

// ── the mesh's vertex rows below the horizon (translation 1) ────
#define MESH_ROW 0.0625
vec3 rayAtHeight(vec3 dir, float y) {
  float h = sqrt(max(1.0 - y * y, 0.0));
  float l = length(dir.xz);
  vec2 xz = l > 1e-6 ? dir.xz / l * h : vec2(h, 0.0);
  return vec3(xz.x, y, xz.y);
}
V2F vertAsMesh(vec3 dir) {
  if (dir.y >= 0.0) return vert(dir);
  float t = -dir.y / MESH_ROW;
  float rowHi = floor(t);
  float f = t - rowHi;
  V2F a = vert(rayAtHeight(dir, -rowHi * MESH_ROW));          // the row above the ray (y = 0 is the sky arm)
  V2F b = vert(rayAtHeight(dir, -(rowHi + 1.0) * MESH_ROW));  // the row below
  V2F o;
  o.vertex = -dir;
  o.groundColor = mix(a.groundColor, b.groundColor, f);
  o.skyColor = mix(a.skyColor, b.skyColor, f);
  o.sunColor = mix(a.sunColor, b.sunColor, f);
  o.fogColor = mix(a.fogColor, b.fogColor, f);
  return o;
}

// ── frag ─────────────────────────────────────────────────────────
float linearToSrgb(float c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }

void main() {
  // the host's ray: the enhanced sky's own construction, so both passes
  // agree with the same yaw and pitch
  vec3 ray0 = normalize(vec3(vNdc.x * uTanHalfFov * uAspect, vNdc.y * uTanHalfFov, 1.0));
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 r1 = vec3(ray0.x, ray0.y * cp + ray0.z * sp, -ray0.y * sp + ray0.z * cp);
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 worldPos = normalize(vec3(r1.x * cy + r1.z * sy, r1.y, -r1.x * sy + r1.z * cy));

  V2F IN = vertAsMesh(worldPos);

  vec4 col = vec4(0.0, 0.0, 0.0, 0.0);

  vec3 normWorldPos = normalize(worldPos);

  float dotWorldPos = dot(normWorldPos, vec3(0.0, 1.0, 0.0));
  float horizonValue = 1.0 - saturate(Remap(dotWorldPos, vec2(_SkyFadeStart, _SkyFadeEnd), vec2(0.0, 1.0)));

  vec3 sunPos = _WorldSpaceLightPos0.xyz;
  vec3 normSunWorldPos = normalize(sunPos);
  float lerpScale;

  if (normSunWorldPos.y >= -0.333) {
    if (normSunWorldPos.y <= 0.333) {
      col.rgb = mix(col.rgb, vec3(0.2), 0.5);   // (0.2, 0.2, 0.2) is a comma expression: the scalar 0.2
    }
  }
  float sunDotUp = dot(sunPos, vec3(0.0, 1.0, 0.0));
  float night = saturate(Remap(sunDotUp, vec2(_NightStartHeight, _NightEndHeight), vec2(0.0, 1.0)));
  float night_clamp = clamp(night, 0.0, 0.5);
  float day = saturate(Remap(sunDotUp, vec2(_NightEndHeight, _NightStartHeight), vec2(0.0, 1.0)));
  float day_clamp = clamp(day, 0.0, 0.6);

  // Moons
  float orbitAngle = _WorldTime * _MoonOrbitSpeed;
  float SecundaOrbitAngle = _WorldTime * _SecundaOrbitSpeed;

  vec2 MajMinAxis = vec2(_MoonSemiMajAxis, _MoonSemiMinAxis);
  vec2 SecundaMajMinAxis = vec2(_SecundaSemiMajAxis, _SecundaSemiMinAxis);

  vec3 currentMoonPos = GetOrbitPosition(_MoonOrbitAngle.xyz, MajMinAxis, orbitAngle);
  vec3 SecundaCurrentMoonPos = GetOrbitPosition(_SecundaOrbitAngle.xyz, SecundaMajMinAxis, SecundaOrbitAngle);

  vec3 prevMoonPos = GetOrbitPosition(_MoonOrbitAngle.xyz, MajMinAxis, orbitAngle - 1.0);
  vec3 moonUp = normalize(cross(currentMoonPos, prevMoonPos));
  vec3 SecundaPrevMoonPos = GetOrbitPosition(_SecundaOrbitAngle.xyz, SecundaMajMinAxis, SecundaOrbitAngle - 1.0);
  vec3 SecundaMoonUp = normalize(cross(SecundaCurrentMoonPos, SecundaPrevMoonPos));

  currentMoonPos = RotateArbitraryAxis(currentMoonPos, _MoonOrbitOffset, moonUp);
  SecundaCurrentMoonPos = RotateArbitraryAxis(SecundaCurrentMoonPos, _SecundaOrbitOffset, SecundaMoonUp);

  float radius = GetMoonDistance(_MoonMinSize, _MoonMaxSize, MajMinAxis, orbitAngle);
  float sphere = SphereIntersect(vec3(0.0, 0.0, 0.0), normWorldPos, currentMoonPos, radius);
  float SecundaRadius = GetMoonDistance(_SecundaMinSize, _SecundaMaxSize, SecundaMajMinAxis, SecundaOrbitAngle);
  float SecundaSphere = SphereIntersect(vec3(0.0, 0.0, 0.0), normWorldPos, SecundaCurrentMoonPos, SecundaRadius);

  vec3 moonFragPos = normWorldPos * sphere + vec3(0.0, 0.0, 0.0);
  vec3 moonFragNormal = normalize(moonFragPos - currentMoonPos);
  vec3 SecundaMoonFragPos = normWorldPos * SecundaSphere + vec3(0.0, 0.0, 0.0);
  vec3 SecundaMoonFragNormal = normalize(SecundaMoonFragPos - SecundaCurrentMoonPos);

  vec3 moonForward = normalize(-currentMoonPos);
  vec3 moonTangent = cross(moonForward, moonUp);
  vec3 SecundaMoonForward = normalize(-SecundaCurrentMoonPos);
  vec3 SecundaMoonTangent = cross(SecundaMoonForward, SecundaMoonUp);

  // float3x3 worldToObject = float3x3(moonTangent, moonUp, moonForward): rows
  vec3 phaseNormal = vec3(dot(moonTangent, moonFragNormal), dot(moonUp, moonFragNormal), dot(moonForward, moonFragNormal));
  vec3 SecundaPhaseNormal = vec3(dot(SecundaMoonTangent, SecundaMoonFragNormal), dot(SecundaMoonUp, SecundaMoonFragNormal), dot(SecundaMoonForward, SecundaMoonFragNormal));

  float NDotL = dot(sunPos, moonFragNormal);
  float SecundaNDotL = dot(sunPos, SecundaMoonFragNormal);

  float moonBlocking = max(sphere * saturate(NDotL), SecundaSphere * saturate(SecundaNDotL));

  // Start of Unity code (SKYBOX_SUNDISK_HQ)
  vec3 ray = normalize(IN.vertex.xyz);
  float y = ray.y / SKY_GROUND_THRESHOLD;

  vec3 tmp = mix(IN.fogColor, _FogNightColor, night);
  col.rgb = mix(IN.skyColor, tmp, saturate(y));

  float sunAttenuation = 0.0;
  if (y <= 1.0) {
    sunAttenuation = calcSunAttenuation(sunPos, -ray, _SunSize, _SunSizeConvergence);
    if (moonBlocking <= 0.0) {
      col.rgb += IN.sunColor * sunAttenuation;
    }
  }
  // (UNITY_COLORSPACE_GAMMA is not defined: no LINEAR_2_OUTPUT here)
  // End of Unity Code

  // Stars
  vec2 starsUV = normWorldPos.xz / (normWorldPos.y + _StarBending);
  vec3 stars = texture(_StarTex, starsUV * _StarTex_ST.xy + _StarTex_ST.zw).rgb;
  float starsAlpha = texture(_StarTwinkleTex, (starsUV * _StarTwinkleTex_ST.xy) + _StarTwinkleTex_ST.zw).r;

  float twinkle = texture(_TwinkleTex, (starsUV * _TwinkleTex_ST.xy) + _TwinkleTex_ST.zw + vec2(1.0, 0.0) * _WorldTime * _TwinkleSpeed).r;
  twinkle *= starsAlpha;
  twinkle *= _TwinkleBoost;
  stars.rgb -= twinkle;
  stars = saturate(stars);

  vec3 finalStarsColor;
  if (normWorldPos.y > 0.0) {
    finalStarsColor = mix(col.rgb, stars, night * horizonValue);
    finalStarsColor.rgb = max(finalStarsColor.rgb, _MoonNightColor.rgb);
  } else {
    finalStarsColor = mix(col.rgb, stars, night * horizonValue);
  }
  col.rgb = finalStarsColor;
  // End of Stars

  // _MOONSPINOPTION_TIDAL_LOCK
  moonFragNormal = phaseNormal;
  moonFragNormal = RotateWorldPosition(moonFragNormal, vec3(radiansOf(_MoonTidalAngle.x), radiansOf(_MoonTidalAngle.y), radiansOf(_MoonTidalAngle.z)));
  // _SECUNDASPINOPTION_TIDAL_LOCK
  SecundaMoonFragNormal = SecundaPhaseNormal;
  SecundaMoonFragNormal = RotateWorldPosition(SecundaMoonFragNormal, vec3(radiansOf(_SecundaTidalAngle.x), radiansOf(_SecundaTidalAngle.y), radiansOf(_SecundaTidalAngle.z)));

  float u = atan(moonFragNormal.z, moonFragNormal.x) / UNITY_TWO_PI;
  float fracU = fract(u);
  vec2 moonUV = vec2(
    fwidth(u) < fwidth(fracU) - 0.001 ? u : fracU,
    acos(-moonFragNormal.y) / UNITY_PI
  );

  float SecundaU = atan(SecundaMoonFragNormal.z, SecundaMoonFragNormal.x) / UNITY_TWO_PI;
  float SecundaFracU = fract(SecundaU);
  vec2 SecundaMoonUV = vec2(
    fwidth(SecundaU) < fwidth(SecundaFracU) - 0.001 ? SecundaU : SecundaFracU,
    acos(-SecundaMoonFragNormal.y) / UNITY_PI
  );

  vec3 SecundaMoonTex;
  vec3 tmpCol = vec3(0.0);   // (0.0, 0.0, 0.0) is a comma expression: the scalar 0.0
  float NDotScale = 1.0;

  if (normWorldPos.y > 0.0) {
    if (SecundaSphere >= 0.0) {
      SecundaMoonTex = texture(_SecundaTex, SecundaMoonUV).rgb * _SecundaColor.rgb;
      vec3 minColor = _MoonNightColor.rgb;
      tmpCol = day * 0.99 * IN.skyColor.rgb;
      tmpCol = max(tmpCol, minColor);
      SecundaMoonTex = mix(tmpCol, SecundaMoonTex, max(0.0, saturate(SecundaNDotL * NDotScale) - 0.0));
      col.rgb = SecundaMoonTex;
    } else if (sphere >= 0.0) {
      vec3 moonTex = texture(_MoonTex, moonUV).rgb * _MoonColor.rgb;
      vec3 minColor = _MoonNightColor.rgb;
      tmpCol = day * 0.99 * IN.skyColor.rgb;
      tmpCol = max(tmpCol, minColor);
      moonTex = mix(tmpCol, moonTex, max(0.0, saturate(NDotL * NDotScale) - 0.0));
      col.rgb = moonTex;
    }
  }
  // End of moons

  // Clouds
  vec2 cloudDir = vec2(1.0, 1.0);
  cloudDir.x = cloudDir.x * cos(radiansOf(_CloudDirection));
  cloudDir.y = cloudDir.y * sin(radiansOf(_CloudDirection));

  float cloudSpeedMultiplier = 0.75;
  vec2 cloudTopUV = normWorldPos.xz / (normWorldPos.y + _CloudTopBending);

  float newFadeStart = _CloudFadeHeight;
  float newFadeEnd = -0.01;
  float cloudFadeHeight = 1.0 - saturate(Remap(dotWorldPos, vec2(newFadeStart, newFadeEnd), vec2(0.0, 1.0)));

  float cloudTop1 = texture(_CloudTopDiffuse, cloudTopUV * _CloudTopDiffuse_ST.xy + _CloudTopDiffuse_ST.zw + _WorldTime * (_CloudSpeed * cloudSpeedMultiplier) * cloudDir).x * cloudFadeHeight;
  float cloudTop2 = texture(_CloudTopDiffuse, cloudTopUV * _CloudTopDiffuse_ST.xy * _CloudBlendScale + _CloudTopDiffuse_ST.zw - _WorldTime * (_CloudBlendSpeed * cloudSpeedMultiplier) * cloudDir + vec2(.373, .47)).x * cloudFadeHeight;

  cloudTop2 = Remap(cloudTop2, vec2(0.0, 1.0), vec2(_CloudBlendLB, _CloudBlendUB));
  float cloudsTop = cloudTop1 - cloudTop2;

  cloudsTop = hsmoothstep(_CloudTopAlphaCutoff, _CloudTopAlphaMax, cloudsTop);

  vec3 cloudTopNormal1 = UnpackNormal(texture(_CloudTopNormal, cloudTopUV * _CloudTopDiffuse_ST.xy + _CloudTopDiffuse_ST.zw + _WorldTime * (_CloudSpeed * cloudSpeedMultiplier) * cloudDir));
  vec3 cloudTopNormal2 = UnpackNormal(texture(_CloudTopNormal, cloudTopUV * _CloudTopDiffuse_ST.xy * _CloudBlendScale + _CloudTopDiffuse_ST.zw - _WorldTime * _CloudBlendSpeed * _CloudNormalSpeed * cloudDir + vec2(.373, .47)));

  vec3 cloudTopNormal = BlendNormals(cloudTopNormal1, cloudTopNormal2);

  float NdotUpTop = dot(cloudTopNormal, vec3(0.0, 1.0, 0.0));

  vec3 cloudTopColor = mix(_CloudTopColor, _CloudTopNightColor, night);

  cloudTopColor = saturate(cloudTopColor / (1.0 - _CloudTopColorBoost));

  NdotUpTop = Remap(NdotUpTop, vec2(-1.0, 1.0), vec2(1.0 - _CloudTopNormalEffect, 1.0));

  float cloudThickness;
  float pos;
  float cloudLerpValue;
  if (normWorldPos.y > _SkyFadeEnd) {
    if (cloudsTop > 0.0) {
      vec3 normalSunPos = normalize(_WorldSpaceLightPos0.xyz);
      float lerpScale2 = saturate(hsmoothstep(-_AtmosphereLerpDuration, 0.0, -normalSunPos.y) / _AtmosphereLerp);
      cloudThickness = cloudsTop * (1.0 - night);
      pos = saturate(1.0 + normSunWorldPos.y);
      cloudLerpValue = sqrt(lerpScale2) * pos;
      cloudTopColor = mix(cloudTopColor, (IN.sunColor + _CloudTopSunColor) * (_CloudTopSunScale * NdotUpTop), cloudLerpValue * _CloudTopSunLerpScale);
    }
  }

  cloudTopColor = cloudTopColor * NdotUpTop;

  col.rgb = mix(col.rgb, cloudTopColor, cloudsTop * _CloudTopOpacity);

  vec2 cloudUV = normWorldPos.xz / (normWorldPos.y + _CloudBending);

  float cloud1 = texture(_CloudDiffuse, cloudUV * _CloudDiffuse_ST.xy + _CloudDiffuse_ST.zw + _WorldTime * _CloudSpeed * cloudDir).x * cloudFadeHeight;
  float cloud2 = texture(_CloudDiffuse, cloudUV * _CloudDiffuse_ST.xy * _CloudBlendScale + _CloudDiffuse_ST.zw - _WorldTime * _CloudBlendSpeed * cloudDir + vec2(.373, .47)).x * cloudFadeHeight;

  cloud2 = Remap(cloud2, vec2(0.0, 1.0), vec2(_CloudBlendLB, _CloudBlendUB));

  float clouds = cloud1 - cloud2;

  clouds = hsmoothstep(_CloudAlphaCutoff, _CloudAlphaMax, clouds);

  vec3 cloudNormal1 = UnpackNormal(texture(_CloudNormal, cloudUV * _CloudDiffuse_ST.xy + _CloudDiffuse_ST.zw + _WorldTime * _CloudSpeed * cloudDir));
  vec3 cloudNormal2 = UnpackNormal(texture(_CloudNormal, cloudUV * _CloudDiffuse_ST.xy * _CloudBlendScale + _CloudDiffuse_ST.zw - _WorldTime * _CloudBlendSpeed * _CloudNormalSpeed * cloudDir + vec2(.373, .47)));

  vec3 cloudNormal = BlendNormals(cloudNormal1, cloudNormal2);

  float NdotUp = dot(cloudNormal, vec3(0.0, 1.0, 0.0));
  NdotUp = Remap(NdotUp, vec2(-1.0, 1.0), vec2(1.0 - _CloudNormalEffect, 1.0));
  vec3 cloudColor = mix(_CloudColor, _CloudNightColor, night);

  cloudColor = saturate(cloudColor / (1.0 - _CloudColorBoost));

  if (normWorldPos.y > _SkyFadeEnd) {
    if (clouds > 0.0) {
      vec3 normalSunPos = normalize(_WorldSpaceLightPos0.xyz);
      float lerpScale3 = saturate(hsmoothstep(-_AtmosphereLerpDuration, 0.0, -normalSunPos.y) / _AtmosphereLerp);
      cloudThickness = clouds * (1.0 - night);
      pos = saturate(1.0 - normSunWorldPos.y);
      cloudLerpValue = sqrt(sqrt(sqrt(lerpScale3))) * pos;
      cloudColor = mix(cloudColor, (IN.sunColor + _CloudSunColor) * (_CloudSunScale * NdotUp), cloudLerpValue * _CloudSunLerpScale);
    }
  }

  cloudColor = cloudColor * NdotUp;

  col.rgb = mix(col.rgb, cloudColor, clouds * _CloudOpacity);

  // REDUCE_COLOR
  {
    vec3 normalSunPos = normalize(_WorldSpaceLightPos0.xyz);
    lerpScale = saturate(hsmoothstep(-_AtmosphereLerpDuration, 0.0, -normalSunPos.y) / _AtmosphereLerp);
    float lerpScale_pow = pow(lerpScale, 5.0);

    col.r = (ceil(col.r / (_stepSize - (lerpScale_pow * _stepSize) + 0.001)) * (_stepSize - (lerpScale_pow * _stepSize) + 0.001));
    col.g = (ceil(col.g / (_stepSize - (lerpScale_pow * _stepSize) + 0.001)) * (_stepSize - (lerpScale_pow * _stepSize) + 0.001));
    col.b = (ceil(col.b / (_stepSize - (lerpScale_pow * _stepSize) + 0.001)) * (_stepSize - (lerpScale_pow * _stepSize) + 0.001));
  }

  // The host's fog over the dome (DFU's post-process fog with
  // excludeSkybox false - heavy fog), in the world's own colour.
  vec3 lin = clamp(col.rgb, 0.0, 1.0);
  vec3 enc = vec3(linearToSrgb(lin.r), linearToSrgb(lin.g), linearToSrgb(lin.b));
  enc = mix(enc, uFogColor, uFogMix);
  outColor = vec4(enc, 1.0);
}`;

/** The pass. Textures arrive through `setTexture(name, image)` as the
 *  vendored files load; until one lands its slot shows the shader's own
 *  default ("black", "bump", "white"). */
export class DynamicSkiesRenderer {
  constructor(gl) {
    this.gl = gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.program = prog;
    this.u = {};
    for (const name of UNIFORM_NAMES) this.u[name] = gl.getUniformLocation(prog, name);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    // the slot defaults, one 1x1 texture each
    this.defaults = {};
    for (const slot of TEXTURE_SLOTS) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(SLOT_DEFAULT_TEXEL[slot]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.defaults[slot] = t;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    /** the vendored textures by file name, once uploaded */
    this.textures = new Map();
    this.fogMix = 0;
    this.fogColor = new Float32Array([0.5, 0.5, 0.5]);
    this.clearColor = new Float32Array([0.4667, 0.5137, 0.7176]);   // FogSunny's day colour until the first state
    this.fillColor = new Float32Array([0.4667, 0.5137, 0.7176]);
    this.state = null;
    this._c3 = new Float32Array(3);
    this._c4 = new Float32Array(4);
  }

  /** One vendored file, uploaded with its Unity import settings:
   *  Point -> NEAREST (with NEAREST_MIPMAP_NEAREST when it has mips),
   *  Bilinear -> LINEAR (LINEAR_MIPMAP_NEAREST with mips), Repeat, and
   *  SRGB8_ALPHA8 for the sRGB-flagged files so the sample is
   *  linearised before filtering, as Unity's is. Unity's v = 0 is the
   *  image's bottom row, hence the flip. */
  setTexture(name, image) {
    const gl = this.gl;
    const imp = TEXTURE_IMPORTS[name] ?? { filter: 'point', mips: true, srgb: true };
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, imp.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const linear = imp.filter === 'bilinear';
    if (imp.mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR_MIPMAP_NEAREST : gl.NEAREST_MIPMAP_NEAREST);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const old = this.textures.get(name);
    if (old) gl.deleteTexture(old);
    this.textures.set(name, t);
  }

  /** The frame's state: { mat, sunDir, lightColor, fogColorSrgb,
   *  clearColor } from dynamicSkiesState. Cheap: a reference. */
  setState(state) {
    this.state = state;
    if (state.clearColor) {
      this.clearColor[0] = state.clearColor[0]; this.clearColor[1] = state.clearColor[1]; this.clearColor[2] = state.clearColor[2];
      this.fillColor.set(this.clearColor);
    }
  }

  _color3(loc, c) {
    const o = this._c3;
    o[0] = srgbToLinear(c[0]); o[1] = srgbToLinear(c[1]); o[2] = srgbToLinear(c[2]);
    this.gl.uniform3fv(loc, o);
  }
  _color4(loc, c) {
    const o = this._c4;
    o[0] = srgbToLinear(c[0]); o[1] = srgbToLinear(c[1]); o[2] = srgbToLinear(c[2]); o[3] = c[3] ?? 1;
    this.gl.uniform4fv(loc, o);
  }

  draw(yaw, pitch, fovY, aspect) {
    const s = this.state;
    if (!s) return;
    const gl = this.gl, u = this.u, mat = s.mat;
    gl.useProgram(this.program);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform1f(u.uYaw, yaw); gl.uniform1f(u.uPitch, pitch);
    gl.uniform1f(u.uTanHalfFov, Math.tan(fovY / 2)); gl.uniform1f(u.uAspect, aspect);
    gl.uniform3f(u._WorldSpaceLightPos0, s.sunDir[0], s.sunDir[1], s.sunDir[2]);
    gl.uniform3f(u._LightColor0, s.lightColor[0], s.lightColor[1], s.lightColor[2]);
    gl.uniform3fv(u.uFogColor, this.fogColor);
    gl.uniform1f(u.uFogMix, this.fogMix);
    for (const name of FLOAT_PROPERTIES) gl.uniform1f(u[name], mat[name] ?? MATERIAL_DEFAULTS[name] ?? 0);
    for (const name of COLOR_PROPERTIES) {
      const c = mat[name] ?? MATERIAL_DEFAULTS[name];
      if (VEC3_COLOR.has(name)) this._color3(u[name], c);
      else if (VEC4_COLOR.has(name)) this._color4(u[name], c);
    }
    for (const name of VEC4_RAW) { const v = mat[name] ?? MATERIAL_DEFAULTS[name]; gl.uniform4f(u[name], v[0], v[1], v[2], v[3] ?? 0); }
    for (const name of VEC3_RAW) { const v = mat[name] ?? MATERIAL_DEFAULTS[name]; gl.uniform3f(u[name], v[0], v[1], v[2]); }
    // QUIRK: _CloudTopColorBoost is a float3 in the shader fed by SetFloat -
    // the value lands in x and y, z are 0, so only red is boosted (the
    // mod's readme: "broken on the top layer for some reason")
    gl.uniform3f(u._CloudTopColorBoost, mat._CloudTopColorBoost ?? MATERIAL_DEFAULTS._CloudTopColorBoost, 0, 0);
    for (let i = 0; i < TEXTURE_SLOTS.length; i++) {
      const slot = TEXTURE_SLOTS[i];
      const st = mat[slot + '_ST'] ?? MATERIAL_DEFAULTS[slot + '_ST'];
      gl.uniform4f(u[slot + '_ST'], st[0], st[1], st[2], st[3]);
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.textures.get(mat[slot]) ?? this.defaults[slot]);
      gl.uniform1i(u[slot], i);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }
}
