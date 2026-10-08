// Windfall/Particles - read back from the DXBC by tools/dxbcGlsl.py (GLSL 450: DXBC mad is fma)

// ==== pass 0 "FORWARD" LIGHTMODE=FORWARDBASE vertex keywords=['DIRECTIONAL']
// cbuffer $Globals -> cb[0] size=112
//   [5].x _MainTex_ST dim=4
// cbuffer UnityPerDraw -> cb[1] size=176
//   [0..] MATRIX unity_ObjectToWorld rows=4
//   [4..] MATRIX unity_WorldToObject rows=4
// cbuffer UnityPerFrame -> cb[2] size=368
//   [17..] MATRIX unity_MatrixVP rows=4
#version 450

layout(binding = 0, std140) uniform cb6_struct
{
    vec4 _m0[6];
} cb0_0;

layout(binding = 1, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb1_0;

layout(binding = 2, std140) uniform cb21_struct
{
    vec4 _m0[21];
} cb2_0;

layout(location = 0) in vec4 v0;
layout(location = 2) in vec3 v2;
layout(location = 3) in vec4 v3;
layout(location = 7) in vec4 v7;
layout(location = 1) out vec2 o1;
layout(location = 2) out vec3 o2;
layout(location = 3) out vec3 o3;
layout(location = 4) out vec4 o4;
layout(location = 5) out vec4 o5;
layout(location = 6) out vec4 o6;

void main()
{
    vec4 r0 = v0.yyyy * cb1_0._m0[1u];
    r0 = fma(cb1_0._m0[0u], v0.xxxx, r0);
    r0 = fma(cb1_0._m0[2u], v0.zzzz, r0);
    vec4 r1 = r0 + cb1_0._m0[3u];
    o3 = fma(cb1_0._m0[3u].xyz, v0.www, r0.xyz);
    r0 = r1.yyyy * cb2_0._m0[18u];
    r0 = fma(cb2_0._m0[17u], r1.xxxx, r0);
    r0 = fma(cb2_0._m0[19u], r1.zzzz, r0);
    gl_Position = fma(cb2_0._m0[20u], r1.wwww, r0);
    o1 = fma(v3.xy, cb0_0._m0[5u].xy, cb0_0._m0[5u].zw);
    r0.x = dot(v2, cb1_0._m0[4u].xyz);
    r0.y = dot(v2, cb1_0._m0[5u].xyz);
    r0.z = dot(v2, cb1_0._m0[6u].xyz);
    r0.w = dot(r0.xyz, r0.xyz);
    r0.w = inversesqrt(r0.w);
    o2 = r0.www * r0.xyz;
    o4 = v7;
    o5 = vec4(0.0);
    o6 = vec4(0.0);
}

// ==== pass 0 "FORWARD" LIGHTMODE=FORWARDBASE fragment keywords=['DIRECTIONAL']
// cbuffer $Globals -> cb[0] size=112
//   [2].x _LightColor0 dim=4
//   [4].x _TintColor dim=4
//   [6].x _Cutoff dim=1
// cbuffer UnityLighting -> cb[1] size=768
//   [0].x _WorldSpaceLightPos0 dim=4
//   [46].x unity_OcclusionMaskSelector dim=4
// cbuffer UnityProbeVolume -> cb[2] size=112
//   [0].x unity_ProbeVolumeParams dim=4
//   [5].x unity_ProbeVolumeSizeInv dim=3
//   [6].x unity_ProbeVolumeMin dim=3
//   [1..] MATRIX unity_ProbeVolumeWorldToObject rows=4
// texture t0 s1 _MainTex
// texture t1 s0 unity_ProbeVolumeSH
#version 450

layout(binding = 0, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb0_0;

layout(binding = 1, std140) uniform cb47_struct
{
    vec4 _m0[47];
} cb1_0;

layout(binding = 2, std140) uniform cb2_0
{
    vec4 _m0[7];
} cb2_0_1;

uniform sampler2D SPIRV_Cross_Combinedt0s1;
uniform sampler3D SPIRV_Cross_Combinedt1s0;

layout(location = 1) in vec2 v1;
layout(location = 2) in vec3 v2;
layout(location = 3) in vec3 v3;
layout(location = 4) in vec4 v4;
layout(location = 0) out vec4 o0;

void main()
{
    vec4 r0 = texture(SPIRV_Cross_Combinedt0s1, v1.xyxx.xy);
    r0 *= v4;
    vec4 r1 = r0 * cb0_0._m0[4u];
    r0.x = fma(r0.w, cb0_0._m0[4u].w, -cb0_0._m0[6u].x);
    r0.x = uintBitsToFloat((r0.x < 0.0) ? 4294967295u : 0u);
    if (floatBitsToUint(r0.x) != 0u)
    {
        discard;
    }
    r0.x = uintBitsToFloat((cb2_0_1._m0[0u].x == 1.0) ? 4294967295u : 0u);
    if (floatBitsToUint(r0.x) != 0u)
    {
        r0.x = uintBitsToFloat((cb2_0_1._m0[0u].y == 1.0) ? 4294967295u : 0u);
        vec3 _123 = v3.yyy * cb2_0_1._m0[2u].xyz;
        r0 = vec4(r0.x, _123.x, _123.y, _123.z);
        vec3 _133 = fma(cb2_0_1._m0[1u].xyz, v3.xxx, r0.yzw);
        r0 = vec4(r0.x, _133.x, _133.y, _133.z);
        vec3 _143 = fma(cb2_0_1._m0[3u].xyz, v3.zzz, r0.yzw);
        r0 = vec4(r0.x, _143.x, _143.y, _143.z);
        vec3 _151 = r0.yzw + cb2_0_1._m0[4u].xyz;
        r0 = vec4(r0.x, _151.x, _151.y, _151.z);
        vec3 _164 = mix(v3, r0.yzw, notEqual(floatBitsToUint(r0.xxx), uvec3(0u)));
        r0 = vec4(_164.x, _164.y, _164.z, r0.w);
        vec3 _173 = r0.xyz + (-cb2_0_1._m0[6u].xyz);
        r0 = vec4(_173.x, _173.y, _173.z, r0.w);
        vec3 _182 = r0.xyz * cb2_0_1._m0[5u].xyz;
        r0 = vec4(r0.x, _182.x, _182.y, _182.z);
        r0.y = fma(r0.y, 0.25, 0.75);
        vec4 r2;
        r2.x = fma(cb2_0_1._m0[0u].z, 0.5, 0.75);
        r0.x = isnan(r2.x) ? r0.y : (isnan(r0.y) ? r2.x : max(r0.y, r2.x));
        r0 = texture(SPIRV_Cross_Combinedt1s0, r0.xzwx.xyz);
    }
    else
    {
        r0 = vec4(1.0);
    }
    float _216 = dot(r0, cb1_0._m0[46u]);
    float _264 = isnan(0.0) ? _216 : (isnan(_216) ? 0.0 : max(_216, 0.0));
    r0.x = isnan(1.0) ? _264 : (isnan(_264) ? 1.0 : min(_264, 1.0));
    vec3 _224 = r0.xxx * cb0_0._m0[2u].xyz;
    r0 = vec4(_224.x, _224.y, _224.z, r0.w);
    r0.w = dot(v2, cb1_0._m0[0u].xyz);
    r0.w = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : max(r0.w, 0.0));
    vec3 _241 = r0.xyz * r1.xyz;
    r0 = vec4(_241.x, _241.y, _241.z, r0.w);
    vec3 _248 = r0.www * r0.xyz;
    o0 = vec4(_248.x, _248.y, _248.z, o0.w);
    o0.w = r1.w;
}

