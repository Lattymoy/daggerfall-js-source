// Windfall/BillboardBatch - read back from the DXBC by tools/dxbcGlsl.py (GLSL 450: DXBC mad is fma)

// ==== pass 0 "FORWARD" LIGHTMODE=FORWARDBASE vertex keywords=['DIRECTIONAL']
// cbuffer $Globals -> cb[0] size=256
//   [6].x _UpVector dim=3
//   [7].x _WindMaskTex_TexelSize dim=4
//   [8].x _WindfallDirectionWorld dim=4
//   [9].x _WindfallStrength dim=1
//   [9].y _WindfallSwayAmplitude dim=1
//   [9].w _WindfallShiverAmplitude dim=1
//   [10].y _WindfallGustStrength dim=1
//   [10].z _WindfallGust dim=1
//   [10].w _WindfallSwayPhase dim=1
//   [11].x _WindfallShiverPhase dim=1
//   [12].x _MainTex_ST dim=4
//   [13].x _BumpMap_ST dim=4
//   [14].x _EmissionMap_ST dim=4
// cbuffer UnityPerDraw -> cb[1] size=176
//   [9].x unity_WorldTransformParams dim=4
//   [0..] MATRIX unity_ObjectToWorld rows=4
//   [4..] MATRIX unity_WorldToObject rows=4
// cbuffer UnityPerFrame -> cb[2] size=368
//   [9..] MATRIX unity_MatrixV rows=4
//   [17..] MATRIX unity_MatrixVP rows=4
// texture t0 s0 _WindMaskTex
#version 450

layout(binding = 0, std140) uniform cb15_struct
{
    vec4 _m0[15];
} cb0_0;

layout(binding = 1, std140) uniform cb10_struct
{
    vec4 _m0[10];
} cb1_0;

layout(binding = 2, std140) uniform cb21_struct
{
    vec4 _m0[21];
} cb2_0;

uniform sampler2D SPIRV_Cross_Combinedt0s0;

layout(location = 0) in vec4 v0;
layout(location = 1) in vec4 v1;
layout(location = 2) in vec3 v2;
layout(location = 3) in vec4 v3;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec2 o2;
layout(location = 3) out vec4 o3;
layout(location = 4) out vec4 o4;
layout(location = 5) out vec4 o5;
layout(location = 6) out vec4 o6;
layout(location = 7) out vec4 o7;

void main()
{
    vec2 _60 = v0.yy * cb1_0._m0[1u].xz;
    vec4 r0;
    r0 = vec4(_60.x, _60.y, r0.z, r0.w);
    vec2 _71 = fma(cb1_0._m0[0u].xz, v0.xx, r0.xy);
    r0 = vec4(_71.x, _71.y, r0.z, r0.w);
    vec2 _82 = fma(cb1_0._m0[2u].xz, v0.zz, r0.xy);
    r0 = vec4(_82.x, _82.y, r0.z, r0.w);
    vec2 _93 = fma(cb1_0._m0[3u].xz, v0.ww, r0.xy);
    r0 = vec4(_93.x, _93.y, r0.z, r0.w);
    r0.z = dot(r0.xy, vec2(12.98980045318603515625, 78.233001708984375));
    r0.z = sin(r0.z);
    r0.z *= 43758.546875;
    vec2 _117 = r0.xy * vec2(0.083333335816860198974609375);
    vec4 r1;
    r1 = vec4(_117.x, _117.y, r1.z, r1.w);
    vec2 _124 = r0.yx + vec2(41.729999542236328125);
    r0 = vec4(_124.x, _124.y, r0.z, r0.w);
    r0.x = dot(r0.xy, vec2(12.98980045318603515625, 78.233001708984375));
    r0.x = sin(r0.x);
    r0.x *= 43758.546875;
    vec2 _141 = floor(r1.xy);
    r0 = vec4(r0.x, _141.x, r0.z, _141.y);
    vec2 _148 = r0.yw * vec2(12.0);
    r0 = vec4(r0.x, _148.x, r0.z, _148.y);
    r0.y = dot(r0.yw, vec2(12.98980045318603515625, 78.233001708984375));
    r0.y = sin(r0.y);
    r0.y *= 43758.546875;
    vec3 _165 = fract(r0.xyz);
    r0 = vec4(_165.x, _165.y, _165.z, r0.w);
    r0.z = (-r0.y) + r0.z;
    r0.y = fma(r0.z, 0.20000000298023223876953125, r0.y);
    r0.y = fma(r0.y, 6.283185482025146484375, cb0_0._m0[10u].w);
    r0.z = fma(r0.x, 6.283185482025146484375, cb0_0._m0[11u].x);
    r0.x = fma(r0.x, 0.400000035762786865234375, 0.800000011920928955078125);
    vec2 _207 = sin(r0.yz);
    r0 = vec4(r0.x, _207.x, _207.y, r0.w);
    r0.w = fma(cb0_0._m0[10u].z, cb0_0._m0[10u].y, 1.0);
    vec2 _225 = r0.zw * cb0_0._m0[9u].wx;
    r0 = vec4(r0.x, r0.y, _225.x, _225.y);
    r0.w = isnan(2.0) ? r0.w : (isnan(r0.w) ? 2.0 : min(r0.w, 2.0));
    float _780 = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : max(r0.w, 0.0));
    r1.x = isnan(1.0) ? _780 : (isnan(_780) ? 1.0 : min(_780, 1.0));
    r0.z *= r1.x;
    r0.y = fma(cb0_0._m0[9u].y, r0.y, r0.z);
    vec3 _261 = cb0_0._m0[8u].yyy * cb1_0._m0[5u].xyz;
    r1 = vec4(_261.x, _261.y, _261.z, r1.w);
    vec3 _273 = fma(cb1_0._m0[4u].xyz, cb0_0._m0[8u].xxx, r1.xyz);
    r1 = vec4(_273.x, _273.y, _273.z, r1.w);
    vec3 _285 = fma(cb1_0._m0[6u].xyz, cb0_0._m0[8u].zzz, r1.xyz);
    r1 = vec4(_285.x, _285.y, _285.z, r1.w);
    r0.z = dot(r1.xyz, r1.xyz);
    r0.z = inversesqrt(r0.z);
    vec3 _302 = r0.zzz * r1.xyz;
    r1 = vec4(_302.x, _302.y, _302.z, r1.w);
    vec3 _311 = cb0_0._m0[6u].yzx * cb2_0._m0[11u].zxy;
    vec4 r2;
    r2 = vec4(_311.x, _311.y, _311.z, r2.w);
    vec3 _323 = fma(cb2_0._m0[11u].yzx, cb0_0._m0[6u].zxy, -r2.xyz);
    r2 = vec4(_323.x, _323.y, _323.z, r2.w);
    r0.z = dot(r2.xyz, r2.xyz);
    r0.z = inversesqrt(r0.z);
    vec3 _340 = r0.zzz * r2.xyz;
    r2 = vec4(_340.x, _340.y, _340.z, r2.w);
    r0.z = dot(r1.xyz, r2.xyz);
    vec3 _353 = r0.zzz * r2.xyz;
    vec4 r3;
    r3 = vec4(_353.x, _353.y, _353.z, r3.w);
    vec3 _360 = r3.xyz * vec3(0.85000002384185791015625);
    r3 = vec4(_360.x, _360.y, _360.z, r3.w);
    vec3 _369 = fma(r1.xyz, vec3(0.1500000059604644775390625), r3.xyz);
    r1 = vec4(_369.x, _369.y, _369.z, r1.w);
    vec3 _376 = r0.yyy * r1.xyz;
    r1 = vec4(_376.x, _376.y, _376.z, r1.w);
    vec3 _383 = r0.www * r1.xyz;
    r0 = vec4(r0.x, _383.x, _383.y, _383.z);
    vec2 _398 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), lessThan(vec2(0.5), v1.zw)));
    r1 = vec4(_398.x, _398.y, r1.z, r1.w);
    vec2 _409 = mix(vec2(0.75), vec2(-0.75), notEqual(floatBitsToUint(r1.xy), uvec2(0u)));
    r1 = vec4(_409.x, _409.y, r1.z, r1.w);
    vec2 _420 = fma(r1.xy, cb0_0._m0[7u].xy, v3.xy);
    r1 = vec4(_420.x, _420.y, r1.z, r1.w);
    r1 = textureLod(SPIRV_Cross_Combinedt0s0, r1.xyxx.xy, 0.0);
    vec3 _434 = r0.yzw * r1.www;
    r0 = vec4(r0.x, _434.x, _434.y, _434.z);
    vec3 _441 = r0.xxx * r0.yzw;
    r0 = vec4(_441.x, _441.y, _441.z, r0.w);
    vec3 _448 = r0.xyz * v1.yyy;
    r0 = vec4(_448.x, _448.y, _448.z, r0.w);
    vec2 _455 = v1.zw + vec2(-0.5);
    r1 = vec4(_455.x, _455.y, r1.z, r1.w);
    vec3 _462 = r1.xxx * r2.xyz;
    r1 = vec4(_462.x, r1.y, _462.y, _462.z);
    vec3 _470 = r1.yyy * cb0_0._m0[6u].xyz;
    r2 = vec4(_470.x, _470.y, _470.z, r2.w);
    vec3 _479 = fma(r1.xzw, v1.xxx, v0.xyz);
    r1 = vec4(_479.x, _479.y, _479.z, r1.w);
    vec3 _488 = fma(r2.xyz, v1.yyy, r1.xyz);
    r1 = vec4(_488.x, _488.y, _488.z, r1.w);
    vec3 _497 = fma(r0.xyz, v1.www, r1.xyz);
    r0 = vec4(_497.x, _497.y, _497.z, r0.w);
    r1 = r0.yyyy * cb1_0._m0[1u];
    r1 = fma(cb1_0._m0[0u], r0.xxxx, r1);
    r0 = fma(cb1_0._m0[2u], r0.zzzz, r1);
    r1 = r0 + cb1_0._m0[3u];
    vec3 _528 = fma(cb1_0._m0[3u].xyz, v0.www, r0.xyz);
    r0 = vec4(_528.x, _528.y, _528.z, r0.w);
    r2 = r1.yyyy * cb2_0._m0[18u];
    r2 = fma(cb2_0._m0[17u], r1.xxxx, r2);
    r2 = fma(cb2_0._m0[19u], r1.zzzz, r2);
    gl_Position = fma(cb2_0._m0[20u], r1.wwww, r2);
    vec2 _567 = fma(v3.xy, cb0_0._m0[12u].xy, cb0_0._m0[12u].zw);
    o1 = vec4(_567.x, _567.y, o1.z, o1.w);
    vec2 _579 = fma(v3.xy, cb0_0._m0[13u].xy, cb0_0._m0[13u].zw);
    o1 = vec4(o1.x, o1.y, _579.x, _579.y);
    o2 = fma(v3.xy, cb0_0._m0[14u].xy, cb0_0._m0[14u].zw);
    o3.w = r0.x;
    vec3 _601 = v2.yyy * cb2_0._m0[10u].xyz;
    r1 = vec4(_601.x, _601.y, _601.z, r1.w);
    vec3 _611 = fma(cb2_0._m0[9u].xyz, v2.xxx, r1.xyz);
    r1 = vec4(_611.x, _611.y, _611.z, r1.w);
    vec3 _621 = fma(cb2_0._m0[11u].xyz, v2.zzz, r1.xyz);
    r1 = vec4(_621.x, _621.y, _621.z, r1.w);
    r2.y = dot(r1.xyz, cb1_0._m0[4u].xyz);
    r2.z = dot(r1.xyz, cb1_0._m0[5u].xyz);
    r2.x = dot(r1.xyz, cb1_0._m0[6u].xyz);
    r0.x = dot(r2.xyz, r2.xyz);
    r0.x = inversesqrt(r0.x);
    vec3 _659 = r0.xxx * r2.xyz;
    r1 = vec4(_659.x, _659.y, _659.z, r1.w);
    vec3 _667 = v1.yyy * cb1_0._m0[1u].yzx;
    r2 = vec4(_667.x, _667.y, _667.z, r2.w);
    vec3 _677 = fma(cb1_0._m0[0u].yzx, v1.xxx, r2.xyz);
    r2 = vec4(_677.x, _677.y, _677.z, r2.w);
    vec3 _687 = fma(cb1_0._m0[2u].yzx, v1.zzz, r2.xyz);
    r2 = vec4(_687.x, _687.y, _687.z, r2.w);
    r0.x = dot(r2.xyz, r2.xyz);
    r0.x = inversesqrt(r0.x);
    vec3 _704 = r0.xxx * r2.xyz;
    r2 = vec4(_704.x, _704.y, _704.z, r2.w);
    vec3 _711 = r1.xyz * r2.xyz;
    r3 = vec4(_711.x, _711.y, _711.z, r3.w);
    vec3 _721 = fma(r1.zxy, r2.yzx, -r3.xyz);
    r3 = vec4(_721.x, _721.y, _721.z, r3.w);
    r0.x = v1.w * cb1_0._m0[9u].w;
    vec3 _736 = r0.xxx * r3.xyz;
    r3 = vec4(_736.x, _736.y, _736.z, r3.w);
    o3.y = r3.x;
    o3.z = r1.y;
    o3.x = r2.z;
    o4.w = r0.y;
    o5.w = r0.z;
    o4.z = r1.z;
    o5.z = r1.x;
    o4.x = r2.x;
    o5.x = r2.y;
    o4.y = r3.y;
    o5.y = r3.z;
    o6 = vec4(0.0);
    o7 = vec4(0.0);
}

// ==== pass 0 "FORWARD" LIGHTMODE=FORWARDBASE fragment keywords=['DIRECTIONAL']
// cbuffer $Globals -> cb[0] size=256
//   [2].x _LightColor0 dim=4
//   [4].x _Color dim=4
//   [5].x _EmissionColor dim=4
//   [15].x _Cutoff dim=1
// cbuffer UnityLighting -> cb[1] size=768
//   [0].x _WorldSpaceLightPos0 dim=4
//   [46].x unity_OcclusionMaskSelector dim=4
// cbuffer UnityProbeVolume -> cb[2] size=112
//   [0].x unity_ProbeVolumeParams dim=4
//   [5].x unity_ProbeVolumeSizeInv dim=3
//   [6].x unity_ProbeVolumeMin dim=3
//   [1..] MATRIX unity_ProbeVolumeWorldToObject rows=4
// texture t0 s1 _MainTex
// texture t1 s3 _EmissionMap
// texture t2 s2 _BumpMap
// texture t3 s0 unity_ProbeVolumeSH
#version 450

layout(binding = 0, std140) uniform cb16_struct
{
    vec4 _m0[16];
} cb0_0;

layout(binding = 1, std140) uniform cb47_struct
{
    vec4 _m0[47];
} cb1_0;

layout(binding = 2, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb2_0;

uniform sampler2D SPIRV_Cross_Combinedt0s1;
uniform sampler2D SPIRV_Cross_Combinedt1s3;
uniform sampler2D SPIRV_Cross_Combinedt2s2;
uniform sampler3D SPIRV_Cross_Combinedt3s0;

layout(location = 1) in vec4 v1;
layout(location = 2) in vec2 v2;
layout(location = 3) in vec4 v3;
layout(location = 4) in vec4 v4;
layout(location = 5) in vec4 v5;
layout(location = 0) out vec4 o0;

void main()
{
    vec4 r0 = texture(SPIRV_Cross_Combinedt0s1, v1.xyxx.xy);
    vec4 r1;
    r1.x = r0.w * cb0_0._m0[4u].w;
    vec4 r2 = texture(SPIRV_Cross_Combinedt1s3, v2.xyxx.xy);
    vec3 _86 = r2.xyz * cb0_0._m0[5u].xyz;
    r1 = vec4(r1.x, _86.x, _86.y, _86.z);
    vec3 _98 = fma(r0.xyz, cb0_0._m0[4u].xyz, -r1.yzw);
    r0 = vec4(_98.x, _98.y, _98.z, r0.w);
    r2 = texture(SPIRV_Cross_Combinedt2s2, v1.zwzz.xy);
    r2.x = r2.w * r2.x;
    vec2 _119 = fma(r2.xy, vec2(2.0), vec2(-1.0));
    r2 = vec4(_119.x, _119.y, r2.z, r2.w);
    r2.w = dot(r2.xy, r2.xy);
    r2.w = isnan(1.0) ? r2.w : (isnan(r2.w) ? 1.0 : min(r2.w, 1.0));
    r2.w = (-r2.w) + 1.0;
    r2.z = sqrt(r2.w);
    r0.w = fma(r0.w, cb0_0._m0[4u].w, -cb0_0._m0[15u].x);
    r0.w = uintBitsToFloat((r0.w < 0.0) ? 4294967295u : 0u);
    if (floatBitsToUint(r0.w) != 0u)
    {
        discard;
    }
    r0.w = uintBitsToFloat((cb2_0._m0[0u].x == 1.0) ? 4294967295u : 0u);
    vec4 r3;
    if (floatBitsToUint(r0.w) != 0u)
    {
        r0.w = uintBitsToFloat((cb2_0._m0[0u].y == 1.0) ? 4294967295u : 0u);
        vec3 _196 = v4.www * cb2_0._m0[2u].xyz;
        r3 = vec4(_196.x, _196.y, _196.z, r3.w);
        vec3 _206 = fma(cb2_0._m0[1u].xyz, v3.www, r3.xyz);
        r3 = vec4(_206.x, _206.y, _206.z, r3.w);
        vec3 _216 = fma(cb2_0._m0[3u].xyz, v5.www, r3.xyz);
        r3 = vec4(_216.x, _216.y, _216.z, r3.w);
        vec3 _224 = r3.xyz + cb2_0._m0[4u].xyz;
        r3 = vec4(_224.x, _224.y, _224.z, r3.w);
        vec4 r4;
        r4.y = v3.w;
        r4.z = v4.w;
        r4.w = v5.w;
        vec3 _248 = mix(r4.yzw, r3.xyz, notEqual(floatBitsToUint(r0.www), uvec3(0u)));
        r3 = vec4(_248.x, _248.y, _248.z, r3.w);
        vec3 _258 = r3.xyz + (-cb2_0._m0[6u].xyz);
        r3 = vec4(_258.x, _258.y, _258.z, r3.w);
        vec3 _266 = r3.xyz * cb2_0._m0[5u].xyz;
        r3 = vec4(r3.x, _266.x, _266.y, _266.z);
        r0.w = fma(r3.y, 0.25, 0.75);
        r2.w = fma(cb2_0._m0[0u].z, 0.5, 0.75);
        r3.x = isnan(r2.w) ? r0.w : (isnan(r0.w) ? r2.w : max(r0.w, r2.w));
        r3 = texture(SPIRV_Cross_Combinedt3s0, r3.xzwx.xyz);
    }
    else
    {
        r3 = vec4(1.0);
    }
    float _300 = dot(r3, cb1_0._m0[46u]);
    float _395 = isnan(0.0) ? _300 : (isnan(_300) ? 0.0 : max(_300, 0.0));
    r0.w = isnan(1.0) ? _395 : (isnan(_395) ? 1.0 : min(_395, 1.0));
    r3.x = dot(v3.xyz, r2.xyz);
    r3.y = dot(v4.xyz, r2.xyz);
    r3.z = dot(v5.xyz, r2.xyz);
    r2.x = dot(r3.xyz, r3.xyz);
    r2.x = inversesqrt(r2.x);
    vec3 _335 = r2.xxx * r3.xyz;
    r2 = vec4(_335.x, _335.y, _335.z, r2.w);
    vec3 _343 = r0.www * cb0_0._m0[2u].xyz;
    r3 = vec4(_343.x, _343.y, _343.z, r3.w);
    r0.w = dot(r2.xyz, cb1_0._m0[0u].xyz);
    r0.w = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : max(r0.w, 0.0));
    vec3 _361 = r0.xyz * r3.xyz;
    r0 = vec4(_361.x, _361.y, _361.z, r0.w);
    vec3 _370 = fma(r0.xyz, r0.www, r1.yzw);
    o0 = vec4(_370.x, _370.y, _370.z, o0.w);
    o0.w = r1.x;
}

// ==== pass 5 "ShadowCaster" LIGHTMODE=SHADOWCASTER vertex keywords=['SHADOWS_DEPTH']
// cbuffer $Globals -> cb[0] size=224
//   [6].x _UpVector dim=3
//   [7].x _WindMaskTex_TexelSize dim=4
//   [8].x _WindfallDirectionWorld dim=4
//   [9].x _WindfallStrength dim=1
//   [9].y _WindfallSwayAmplitude dim=1
//   [9].w _WindfallShiverAmplitude dim=1
//   [10].y _WindfallGustStrength dim=1
//   [10].z _WindfallGust dim=1
//   [10].w _WindfallSwayPhase dim=1
//   [11].x _WindfallShiverPhase dim=1
//   [12].x _MainTex_ST dim=4
// cbuffer UnityLighting -> cb[1] size=768
//   [0].x _WorldSpaceLightPos0 dim=4
// cbuffer UnityShadows -> cb[2] size=416
//   [5].x unity_LightShadowBias dim=4
// cbuffer UnityPerDraw -> cb[3] size=176
//   [0..] MATRIX unity_ObjectToWorld rows=4
//   [4..] MATRIX unity_WorldToObject rows=4
// cbuffer UnityPerFrame -> cb[4] size=368
//   [9..] MATRIX unity_MatrixV rows=4
//   [17..] MATRIX unity_MatrixVP rows=4
// texture t0 s0 _WindMaskTex
#version 450

layout(binding = 0, std140) uniform cb13_struct
{
    vec4 _m0[13];
} cb0_0;

layout(binding = 1, std140) uniform cb1_struct
{
    vec4 _m0[1];
} cb1_0;

layout(binding = 2, std140) uniform cb6_struct
{
    vec4 _m0[6];
} cb2_0;

layout(binding = 3, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb3_0;

layout(binding = 4, std140) uniform cb21_struct
{
    vec4 _m0[21];
} cb4_0;

uniform sampler2D SPIRV_Cross_Combinedt0s0;

layout(location = 0) in vec4 v0;
layout(location = 1) in vec4 v1;
layout(location = 2) in vec3 v2;
layout(location = 3) in vec4 v3;
layout(location = 1) out vec2 o1;
layout(location = 2) out vec3 o2;

void main()
{
    vec2 _66 = v0.yy * cb3_0._m0[1u].xz;
    vec4 r0;
    r0 = vec4(_66.x, _66.y, r0.z, r0.w);
    vec2 _77 = fma(cb3_0._m0[0u].xz, v0.xx, r0.xy);
    r0 = vec4(_77.x, _77.y, r0.z, r0.w);
    vec2 _88 = fma(cb3_0._m0[2u].xz, v0.zz, r0.xy);
    r0 = vec4(_88.x, _88.y, r0.z, r0.w);
    vec2 _99 = fma(cb3_0._m0[3u].xz, v0.ww, r0.xy);
    r0 = vec4(_99.x, _99.y, r0.z, r0.w);
    r0.z = dot(r0.xy, vec2(12.98980045318603515625, 78.233001708984375));
    r0.z = sin(r0.z);
    r0.z *= 43758.546875;
    vec2 _123 = r0.xy * vec2(0.083333335816860198974609375);
    vec4 r1;
    r1 = vec4(_123.x, _123.y, r1.z, r1.w);
    vec2 _130 = r0.yx + vec2(41.729999542236328125);
    r0 = vec4(_130.x, _130.y, r0.z, r0.w);
    r0.x = dot(r0.xy, vec2(12.98980045318603515625, 78.233001708984375));
    r0.x = sin(r0.x);
    r0.x *= 43758.546875;
    vec2 _147 = floor(r1.xy);
    r0 = vec4(r0.x, _147.x, r0.z, _147.y);
    vec2 _154 = r0.yw * vec2(12.0);
    r0 = vec4(r0.x, _154.x, r0.z, _154.y);
    r0.y = dot(r0.yw, vec2(12.98980045318603515625, 78.233001708984375));
    r0.y = sin(r0.y);
    r0.y *= 43758.546875;
    vec3 _171 = fract(r0.xyz);
    r0 = vec4(_171.x, _171.y, _171.z, r0.w);
    r0.z = (-r0.y) + r0.z;
    r0.y = fma(r0.z, 0.20000000298023223876953125, r0.y);
    r0.y = fma(r0.y, 6.283185482025146484375, cb0_0._m0[10u].w);
    r0.z = fma(r0.x, 6.283185482025146484375, cb0_0._m0[11u].x);
    r0.x = fma(r0.x, 0.400000035762786865234375, 0.800000011920928955078125);
    vec2 _214 = sin(r0.yz);
    r0 = vec4(r0.x, _214.x, _214.y, r0.w);
    r0.w = fma(cb0_0._m0[10u].z, cb0_0._m0[10u].y, 1.0);
    vec2 _232 = r0.zw * cb0_0._m0[9u].wx;
    r0 = vec4(r0.x, r0.y, _232.x, _232.y);
    r0.w = isnan(2.0) ? r0.w : (isnan(r0.w) ? 2.0 : min(r0.w, 2.0));
    float _806 = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : max(r0.w, 0.0));
    r1.x = isnan(1.0) ? _806 : (isnan(_806) ? 1.0 : min(_806, 1.0));
    r0.z *= r1.x;
    r0.y = fma(cb0_0._m0[9u].y, r0.y, r0.z);
    vec3 _268 = cb0_0._m0[8u].yyy * cb3_0._m0[5u].xyz;
    r1 = vec4(_268.x, _268.y, _268.z, r1.w);
    vec3 _280 = fma(cb3_0._m0[4u].xyz, cb0_0._m0[8u].xxx, r1.xyz);
    r1 = vec4(_280.x, _280.y, _280.z, r1.w);
    vec3 _291 = fma(cb3_0._m0[6u].xyz, cb0_0._m0[8u].zzz, r1.xyz);
    r1 = vec4(_291.x, _291.y, _291.z, r1.w);
    r0.z = dot(r1.xyz, r1.xyz);
    r0.z = inversesqrt(r0.z);
    vec3 _308 = r0.zzz * r1.xyz;
    r1 = vec4(_308.x, _308.y, _308.z, r1.w);
    vec3 _317 = cb0_0._m0[6u].yzx * cb4_0._m0[11u].zxy;
    vec4 r2;
    r2 = vec4(_317.x, _317.y, _317.z, r2.w);
    vec3 _329 = fma(cb4_0._m0[11u].yzx, cb0_0._m0[6u].zxy, -r2.xyz);
    r2 = vec4(_329.x, _329.y, _329.z, r2.w);
    r0.z = dot(r2.xyz, r2.xyz);
    r0.z = inversesqrt(r0.z);
    vec3 _346 = r0.zzz * r2.xyz;
    r2 = vec4(_346.x, _346.y, _346.z, r2.w);
    r0.z = dot(r1.xyz, r2.xyz);
    vec3 _359 = r0.zzz * r2.xyz;
    vec4 r3;
    r3 = vec4(_359.x, _359.y, _359.z, r3.w);
    vec3 _366 = r3.xyz * vec3(0.85000002384185791015625);
    r3 = vec4(_366.x, _366.y, _366.z, r3.w);
    vec3 _375 = fma(r1.xyz, vec3(0.1500000059604644775390625), r3.xyz);
    r1 = vec4(_375.x, _375.y, _375.z, r1.w);
    vec3 _382 = r0.yyy * r1.xyz;
    r1 = vec4(_382.x, _382.y, _382.z, r1.w);
    vec3 _389 = r0.www * r1.xyz;
    r0 = vec4(r0.x, _389.x, _389.y, _389.z);
    vec2 _404 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), lessThan(vec2(0.5), v1.zw)));
    r1 = vec4(_404.x, _404.y, r1.z, r1.w);
    vec2 _415 = mix(vec2(0.75), vec2(-0.75), notEqual(floatBitsToUint(r1.xy), uvec2(0u)));
    r1 = vec4(_415.x, _415.y, r1.z, r1.w);
    vec2 _425 = fma(r1.xy, cb0_0._m0[7u].xy, v3.xy);
    r1 = vec4(_425.x, _425.y, r1.z, r1.w);
    r1 = textureLod(SPIRV_Cross_Combinedt0s0, r1.xyxx.xy, 0.0);
    vec3 _439 = r0.yzw * r1.www;
    r0 = vec4(r0.x, _439.x, _439.y, _439.z);
    vec3 _446 = r0.xxx * r0.yzw;
    r0 = vec4(_446.x, _446.y, _446.z, r0.w);
    vec3 _453 = r0.xyz * v1.yyy;
    r0 = vec4(_453.x, _453.y, _453.z, r0.w);
    vec2 _460 = v1.zw + vec2(-0.5);
    r1 = vec4(_460.x, _460.y, r1.z, r1.w);
    vec3 _467 = r1.xxx * r2.xyz;
    r1 = vec4(_467.x, r1.y, _467.y, _467.z);
    vec3 _475 = r1.yyy * cb0_0._m0[6u].xyz;
    r2 = vec4(_475.x, _475.y, _475.z, r2.w);
    vec3 _484 = fma(r1.xzw, v1.xxx, v0.xyz);
    r1 = vec4(_484.x, _484.y, _484.z, r1.w);
    vec3 _493 = fma(r2.xyz, v1.yyy, r1.xyz);
    r1 = vec4(_493.x, _493.y, _493.z, r1.w);
    vec3 _502 = fma(r0.xyz, v1.www, r1.xyz);
    r0 = vec4(_502.x, _502.y, _502.z, r0.w);
    r1 = r0.yyyy * cb3_0._m0[1u];
    r1 = fma(cb3_0._m0[0u], r0.xxxx, r1);
    r1 = fma(cb3_0._m0[2u], r0.zzzz, r1);
    r1 = fma(cb3_0._m0[3u], v0.wwww, r1);
    vec3 _537 = fma(-r1.xyz, cb1_0._m0[0u].www, cb1_0._m0[0u].xyz);
    r2 = vec4(_537.x, _537.y, _537.z, r2.w);
    r0.w = dot(r2.xyz, r2.xyz);
    r0.w = inversesqrt(r0.w);
    vec3 _554 = r0.www * r2.xyz;
    r2 = vec4(_554.x, _554.y, _554.z, r2.w);
    vec3 _562 = v2.yyy * cb4_0._m0[10u].xyz;
    r3 = vec4(_562.x, _562.y, _562.z, r3.w);
    vec3 _572 = fma(cb4_0._m0[9u].xyz, v2.xxx, r3.xyz);
    r3 = vec4(_572.x, _572.y, _572.z, r3.w);
    vec3 _582 = fma(cb4_0._m0[11u].xyz, v2.zzz, r3.xyz);
    r3 = vec4(_582.x, _582.y, _582.z, r3.w);
    vec4 r4;
    r4.x = dot(r3.xyz, cb3_0._m0[4u].xyz);
    r4.y = dot(r3.xyz, cb3_0._m0[5u].xyz);
    r4.z = dot(r3.xyz, cb3_0._m0[6u].xyz);
    r0.w = dot(r4.xyz, r4.xyz);
    r0.w = inversesqrt(r0.w);
    vec3 _620 = r0.www * r4.xyz;
    r3 = vec4(_620.x, _620.y, _620.z, r3.w);
    r0.w = dot(r3.xyz, r2.xyz);
    r0.w = fma(-r0.w, r0.w, 1.0);
    r0.w = sqrt(r0.w);
    r0.w *= cb2_0._m0[5u].z;
    vec3 _654 = fma(-r3.xyz, r0.www, r1.xyz);
    r2 = vec4(_654.x, _654.y, _654.z, r2.w);
    r0.w = uintBitsToFloat((cb2_0._m0[5u].z != 0.0) ? 4294967295u : 0u);
    vec3 _675 = mix(r1.xyz, r2.xyz, notEqual(floatBitsToUint(r0.www), uvec3(0u)));
    r1 = vec4(_675.x, _675.y, _675.z, r1.w);
    r2 = r1.yyyy * cb4_0._m0[18u];
    r2 = fma(cb4_0._m0[17u], r1.xxxx, r2);
    r2 = fma(cb4_0._m0[19u], r1.zzzz, r2);
    r1 = fma(cb4_0._m0[20u], r1.wwww, r2);
    r0.w = cb2_0._m0[5u].x / r1.w;
    r0.w = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : min(r0.w, 0.0));
    r0.w = isnan(-1.0) ? r0.w : (isnan(r0.w) ? (-1.0) : max(r0.w, -1.0));
    r0.w += r1.z;
    r1.z = isnan(r0.w) ? r1.w : (isnan(r1.w) ? r0.w : min(r1.w, r0.w));
    gl_Position = vec4(r1.x, r1.y, gl_Position.z, r1.w);
    r1.x = (-r0.w) + r1.z;
    gl_Position.z = fma(cb2_0._m0[5u].y, r1.x, r0.w);
    o1 = fma(v3.xy, cb0_0._m0[12u].xy, cb0_0._m0[12u].zw);
    vec3 _768 = r0.yyy * cb3_0._m0[1u].xyz;
    r1 = vec4(_768.x, _768.y, _768.z, r1.w);
    vec3 _778 = fma(cb3_0._m0[0u].xyz, r0.xxx, r1.xyz);
    r0 = vec4(_778.x, _778.y, r0.z, _778.z);
    vec3 _788 = fma(cb3_0._m0[2u].xyz, r0.zzz, r0.xyw);
    r0 = vec4(_788.x, _788.y, _788.z, r0.w);
    o2 = fma(cb3_0._m0[3u].xyz, v0.www, r0.xyz);
}

// ==== pass 5 "ShadowCaster" LIGHTMODE=SHADOWCASTER fragment keywords=['SHADOWS_DEPTH']
// cbuffer $Globals -> cb[0] size=224
//   [4].x _Color dim=4
//   [13].x _Cutoff dim=1
// texture t0 s0 _MainTex
#version 450

layout(binding = 0, std140) uniform cb14_struct
{
    vec4 _m0[14];
} cb0_0;

uniform sampler2D SPIRV_Cross_Combinedt0s0;

layout(location = 1) in vec2 v1;
layout(location = 0) out vec4 o0;

void main()
{
    vec4 r0 = texture(SPIRV_Cross_Combinedt0s0, v1.xyxx.xy);
    r0.x = fma(r0.w, cb0_0._m0[4u].w, -cb0_0._m0[13u].x);
    r0.x = uintBitsToFloat((r0.x < 0.0) ? 4294967295u : 0u);
    if (floatBitsToUint(r0.x) != 0u)
    {
        discard;
    }
    o0 = vec4(0.0);
}

