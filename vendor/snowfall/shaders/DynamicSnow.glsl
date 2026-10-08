// Daggerfall/Mods/DynamicSnow - read back from the DXBC by tools/dxbcGlsl.py (GLSL 450: DXBC mad is fma)

// ==== pass 0 "FORWARD" LIGHTMODE=FORWARDBASE vertex keywords=['DIRECTIONAL']
// cbuffer $Globals -> cb[0] size=320
//   [4].x _DynamicMask_TexelSize dim=4
//   [5].x _DynamicMaskMapping dim=4
//   [6].x _DynamicDepthEnabled dim=1
//   [7].x _StaticMaskMapping dim=4
//   [8].x _BaseSnowDepth dim=1
//   [8].y _SettlementSnowDepth dim=1
//   [8].z _LocationMaximumSnowDepth dim=1
//   [8].w _PathMaximumSnowDepth dim=1
//   [9].x _RoadBermRise dim=1
//   [9].y _WildernessMaximumDepth dim=1
//   [9].z _SettlementMaximumDepth dim=1
//   [9].w _CorpseRemainingDepth dim=1
//   [10].x _BlanketSurface dim=1
//   [10].y _MorphToBlanket dim=1
//   [12].x _SnowRadius dim=1
//   [12].y _EdgeFadeWidth dim=1
//   [12].z _SurfaceOffset dim=1
//   [13].y _TrackImpressionStrength dim=1
//   [15].x _InnerFadeCenter dim=4
//   [16].x _InnerFadeStart dim=1
//   [16].y _InnerFadeEnd dim=1
//   [17].x _OuterClipCenter dim=4
//   [18].x _OuterClipStart dim=1
//   [18].y _OuterClipEnd dim=1
//   [18].z _BoundaryDepthFade dim=1
//   [19].x _MainTex_ST dim=4
// cbuffer UnityPerDraw -> cb[1] size=176
//   [0..] MATRIX unity_ObjectToWorld rows=4
//   [4..] MATRIX unity_WorldToObject rows=4
// cbuffer UnityPerFrame -> cb[2] size=368
//   [17..] MATRIX unity_MatrixVP rows=4
// texture t0 s0 _DynamicMask
// texture t1 s1 _StaticMask
// texture t2 s2 _ContextMask
#version 450

layout(binding = 0, std140) uniform cb20_struct
{
    vec4 _m0[20];
} cb0_0;

layout(binding = 1, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb1_0;

layout(binding = 2, std140) uniform cb21_struct
{
    vec4 _m0[21];
} cb2_0;

uniform sampler2D SPIRV_Cross_Combinedt0s0;
uniform sampler2D SPIRV_Cross_Combinedt1s1;
uniform sampler2D SPIRV_Cross_Combinedt2s2;

layout(location = 0) in vec4 v0;
layout(location = 1) in vec4 v1;
layout(location = 2) in vec3 v2;
layout(location = 3) in vec4 v3;
layout(location = 4) in vec4 v4;
layout(location = 5) in vec4 v5;
layout(location = 6) in vec4 v6;
layout(location = 7) in vec4 v7;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec3 o2;
layout(location = 3) out vec3 o3;
layout(location = 4) out vec4 o4;
layout(location = 5) out vec4 o5;

void main()
{
    vec4 r0;
    r0.x = uintBitsToFloat((v4.x >= 0.0) ? 4294967295u : 0u);
    r0.y = (-cb0_0._m0[8u].x) + cb0_0._m0[8u].y;
    r0.z = fma(v4.x, r0.y, cb0_0._m0[8u].x);
    r0.w = (-cb0_0._m0[9u].y) + cb0_0._m0[9u].z;
    vec4 r1;
    r1.x = fma(v4.x, r0.w, cb0_0._m0[9u].y);
    r1.x = (-r0.z) + r1.x;
    r1.x = isnan(0.0) ? r1.x : (isnan(r1.x) ? 0.0 : max(r1.x, 0.0));
    r1.y = v4.w * cb0_0._m0[9u].x;
    r1.x = isnan(r1.x) ? r1.y : (isnan(r1.y) ? r1.x : min(r1.y, r1.x));
    r0.z += r1.x;
    vec2 _155 = mix(mix(min(r0.zz, cb0_0._m0[8u].zw), cb0_0._m0[8u].zw, isnan(r0.zz)), r0.zz, isnan(cb0_0._m0[8u].zw));
    r1 = vec4(_155.x, _155.y, r1.z, r1.w);
    vec2 _163 = (-r0.zz) + r1.xy;
    r1 = vec4(_163.x, _163.y, r1.z, r1.w);
    vec2 _172 = fma(v4.yz, r1.xy, r0.zz);
    r1 = vec4(_172.x, _172.y, r1.z, r1.w);
    r1.x = isnan(r1.x) ? r1.y : (isnan(r1.y) ? r1.x : min(r1.y, r1.x));
    r0.z = isnan(r1.x) ? r0.z : (isnan(r0.z) ? r1.x : min(r0.z, r1.x));
    r1.z = uintBitsToFloat(floatBitsToUint(r0.z) & floatBitsToUint(r0.x));
    r0.x = uintBitsToFloat((cb0_0._m0[10u].y >= 0.5) ? 4294967295u : 0u);
    vec4 r2;
    vec4 r3;
    if (floatBitsToUint(r0.x) != 0u)
    {
        r0.x = (-v5.z) + 1.0;
        r2.z = r0.x + (-v5.w);
        r0.x = uintBitsToFloat((v6.x >= 0.0) ? 4294967295u : 0u);
        r0.z = fma(v6.x, r0.y, cb0_0._m0[8u].x);
        r2.w = fma(v6.x, r0.w, cb0_0._m0[9u].y);
        r2.w = (-r0.z) + r2.w;
        r2.w = isnan(0.0) ? r2.w : (isnan(r2.w) ? 0.0 : max(r2.w, 0.0));
        r3.x = v6.w * cb0_0._m0[9u].x;
        r2.w = isnan(r3.x) ? r2.w : (isnan(r2.w) ? r3.x : min(r2.w, r3.x));
        r0.z += r2.w;
        vec2 _283 = mix(mix(min(r0.zz, cb0_0._m0[8u].zw), cb0_0._m0[8u].zw, isnan(r0.zz)), r0.zz, isnan(cb0_0._m0[8u].zw));
        r3 = vec4(_283.x, _283.y, r3.z, r3.w);
        vec2 _291 = (-r0.zz) + r3.xy;
        r3 = vec4(_291.x, _291.y, r3.z, r3.w);
        vec2 _300 = fma(v6.yz, r3.xy, r0.zz);
        r3 = vec4(_300.x, _300.y, r3.z, r3.w);
        r2.w = isnan(r3.x) ? r3.y : (isnan(r3.y) ? r3.x : min(r3.y, r3.x));
        r0.z = isnan(r2.w) ? r0.z : (isnan(r0.z) ? r2.w : min(r0.z, r2.w));
        r1.x = uintBitsToFloat(floatBitsToUint(r0.z) & floatBitsToUint(r0.x));
        r0.x = uintBitsToFloat((v7.x >= 0.0) ? 4294967295u : 0u);
        r0.z = fma(v7.x, r0.y, cb0_0._m0[8u].x);
        r2.w = fma(v7.x, r0.w, cb0_0._m0[9u].y);
        r2.w = (-r0.z) + r2.w;
        r2.w = isnan(0.0) ? r2.w : (isnan(r2.w) ? 0.0 : max(r2.w, 0.0));
        r3.x = v7.w * cb0_0._m0[9u].x;
        r2.w = isnan(r3.x) ? r2.w : (isnan(r2.w) ? r3.x : min(r2.w, r3.x));
        r0.z += r2.w;
        vec2 _383 = mix(mix(min(r0.zz, cb0_0._m0[8u].zw), cb0_0._m0[8u].zw, isnan(r0.zz)), r0.zz, isnan(cb0_0._m0[8u].zw));
        r3 = vec4(_383.x, _383.y, r3.z, r3.w);
        vec2 _391 = (-r0.zz) + r3.xy;
        r3 = vec4(_391.x, _391.y, r3.z, r3.w);
        vec2 _400 = fma(v7.yz, r3.xy, r0.zz);
        r3 = vec4(_400.x, _400.y, r3.z, r3.w);
        r2.w = isnan(r3.x) ? r3.y : (isnan(r3.y) ? r3.x : min(r3.y, r3.x));
        r0.z = isnan(r2.w) ? r0.z : (isnan(r0.z) ? r2.w : min(r0.z, r2.w));
        r1.y = uintBitsToFloat(floatBitsToUint(r0.z) & floatBitsToUint(r0.x));
        r2 = vec4(v5.z, v5.w, r2.z, r2.w);
        r1.z = dot(r2.yzx, r1.xyz);
    }
    float _2090 = isnan(0.0) ? v4.z : (isnan(v4.z) ? 0.0 : max(v4.z, 0.0));
    r0.x = isnan(1.0) ? _2090 : (isnan(_2090) ? 1.0 : min(_2090, 1.0));
    vec2 _447 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), lessThan(vec2(0.5), cb0_0._m0[10u].yx)));
    r2 = vec4(_447.x, _447.y, r2.z, r2.w);
    r0.z = (-v5.z) + 1.0;
    r3.z = r0.z + (-v5.w);
    r3 = vec4(v5.z, v5.w, r3.z, r3.w);
    vec4 r4;
    r4.x = v4.z;
    r4.y = v6.z;
    r4.z = v7.z;
    float _478 = dot(r3.xyz, r4.xyz);
    float _2101 = isnan(0.0) ? _478 : (isnan(_478) ? 0.0 : max(_478, 0.0));
    r0.z = isnan(1.0) ? _2101 : (isnan(_2101) ? 1.0 : min(_2101, 1.0));
    r1.w = (floatBitsToUint(r2.x) != 0u) ? r0.z : r0.x;
    vec2 _496 = v0.yy * cb1_0._m0[1u].xz;
    r0 = vec4(_496.x, r0.y, _496.y, r0.w);
    vec2 _506 = fma(cb1_0._m0[0u].xz, v0.xx, r0.xz);
    r0 = vec4(_506.x, r0.y, _506.y, r0.w);
    vec2 _516 = fma(cb1_0._m0[2u].xz, v0.zz, r0.xz);
    r0 = vec4(_516.x, r0.y, _516.y, r0.w);
    vec2 _526 = fma(cb1_0._m0[3u].xz, v0.ww, r0.xz);
    r0 = vec4(_526.x, r0.y, _526.y, r0.w);
    vec2 _536 = r0.xz + (-cb0_0._m0[5u].xy);
    r2 = vec4(r2.x, r2.y, _536.x, _536.y);
    vec2 _544 = r2.zw * cb0_0._m0[5u].zz;
    r3 = vec4(_544.x, _544.y, r3.z, r3.w);
    vec2 _553 = r0.xz + (-cb0_0._m0[7u].xy);
    r3 = vec4(r3.x, r3.y, _553.x, _553.y);
    vec2 _561 = r3.zw * cb0_0._m0[7u].zz;
    r3 = vec4(r3.x, r3.y, _561.x, _561.y);
    r4 = textureLod(SPIRV_Cross_Combinedt0s0, r3.xyxx.xy, 0.0);
    vec2 _576 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(r3.xy, vec2(0.0))));
    r4 = vec4(r4.x, r4.y, _576.x, _576.y);
    vec2 _585 = uintBitsToFloat(floatBitsToUint(r4.zw) & uvec2(1065353216u));
    r4 = vec4(r4.x, r4.y, _585.x, _585.y);
    vec2 _593 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(vec2(1.0), r3.xy)));
    vec4 r5;
    r5 = vec4(_593.x, _593.y, r5.z, r5.w);
    vec2 _600 = uintBitsToFloat(floatBitsToUint(r5.xy) & uvec2(1065353216u));
    r5 = vec4(_600.x, _600.y, r5.z, r5.w);
    r4.z *= r5.x;
    r4.z = r4.w * r4.z;
    r4.z = r5.y * r4.z;
    vec2 _625 = r4.xy + vec2(-1.0);
    r5 = vec4(_625.x, _625.y, r5.z, r5.w);
    vec2 _632 = fma(r4.zz, r5.xy, vec2(1.0));
    r4 = vec4(r4.x, r4.y, _632.x, _632.y);
    r5.x = uintBitsToFloat((cb0_0._m0[5u].w >= 0.5) ? 4294967295u : 0u);
    r5.x = uintBitsToFloat(floatBitsToUint(r5.x) & 1065353216u);
    vec2 _653 = (-r4.xy) + r4.zw;
    r4 = vec4(r4.x, r4.y, _653.x, _653.y);
    vec2 _662 = fma(r5.xx, r4.zw, r4.xy);
    r4 = vec4(_662.x, _662.y, r4.z, r4.w);
    r4.z = uintBitsToFloat((cb0_0._m0[6u].x >= 0.5) ? 4294967295u : 0u);
    vec4 r6;
    vec4 r7;
    if (floatBitsToUint(r4.z) != 0u)
    {
        vec2 _688 = fma(r2.zw, cb0_0._m0[5u].zz, cb0_0._m0[4u].xy);
        r4 = vec4(r4.x, r4.y, _688.x, _688.y);
        r6 = textureLod(SPIRV_Cross_Combinedt0s0, r4.zwzz.xy, 0.0);
        vec2 _701 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(r4.zw, vec2(0.0))));
        r5 = vec4(r5.x, _701.x, _701.y, r5.w);
        vec2 _708 = uintBitsToFloat(floatBitsToUint(r5.yz) & uvec2(1065353216u));
        r5 = vec4(r5.x, _708.x, _708.y, r5.w);
        vec2 _715 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(vec2(1.0), r4.zw)));
        r4 = vec4(r4.x, r4.y, _715.x, _715.y);
        vec2 _722 = uintBitsToFloat(floatBitsToUint(r4.zw) & uvec2(1065353216u));
        r4 = vec4(r4.x, r4.y, _722.x, _722.y);
        r4.z *= r5.y;
        r4.z = r5.z * r4.z;
        r4.z = r4.w * r4.z;
        vec2 _745 = r6.xy + vec2(-1.0);
        r5 = vec4(r5.x, _745.x, _745.y, r5.w);
        vec2 _752 = fma(r4.zz, r5.yz, vec2(1.0));
        r4 = vec4(r4.x, r4.y, _752.x, _752.y);
        vec2 _760 = (-r6.xy) + r4.zw;
        r4 = vec4(r4.x, r4.y, _760.x, _760.y);
        vec2 _769 = fma(r5.xx, r4.zw, r6.xy);
        r4 = vec4(r4.x, r4.y, _769.x, _769.y);
        vec2 _776 = mix(mix(min(r4.zw, r4.xy), r4.xy, isnan(r4.zw)), r4.zw, isnan(r4.xy));
        r4 = vec4(r4.x, r4.y, _776.x, _776.y);
        r6 = fma(cb0_0._m0[4u].xyxy, vec4(1.0, -1.0, -1.0, 1.0), r3.xyxy);
        r7 = textureLod(SPIRV_Cross_Combinedt0s0, r6.xyxx.xy, 0.0);
        vec4 r8 = uintBitsToFloat(mix(uvec4(0u), uvec4(4294967295u), greaterThanEqual(r6, vec4(0.0))));
        r8 = uintBitsToFloat(floatBitsToUint(r8) & uvec4(1065353216u));
        vec4 r9 = uintBitsToFloat(mix(uvec4(0u), uvec4(4294967295u), greaterThanEqual(vec4(1.0), r6)));
        r9 = uintBitsToFloat(floatBitsToUint(r9) & uvec4(1065353216u));
        vec2 _819 = r8.xz * r9.xz;
        r3 = vec4(_819.x, _819.y, r3.z, r3.w);
        vec2 _826 = r8.yw * r3.xy;
        r3 = vec4(_826.x, _826.y, r3.z, r3.w);
        vec2 _833 = r9.yw * r3.xy;
        r3 = vec4(_833.x, _833.y, r3.z, r3.w);
        vec2 _838 = r7.xy + vec2(-1.0);
        r5 = vec4(r5.x, _838.x, _838.y, r5.w);
        vec2 _845 = fma(r3.xx, r5.yz, vec2(1.0));
        r5 = vec4(r5.x, _845.x, _845.y, r5.w);
        vec2 _853 = (-r7.xy) + r5.yz;
        r5 = vec4(r5.x, _853.x, _853.y, r5.w);
        vec2 _862 = fma(r5.xx, r5.yz, r7.xy);
        r5 = vec4(r5.x, _862.x, _862.y, r5.w);
        vec2 _869 = mix(mix(min(r4.zw, r5.yz), r5.yz, isnan(r4.zw)), r4.zw, isnan(r5.yz));
        r4 = vec4(r4.x, r4.y, _869.x, _869.y);
        r6 = textureLod(SPIRV_Cross_Combinedt0s0, r6.zwzz.xy, 0.0);
        vec2 _880 = r6.xy + vec2(-1.0);
        r5 = vec4(r5.x, _880.x, _880.y, r5.w);
        vec2 _887 = fma(r3.yy, r5.yz, vec2(1.0));
        r3 = vec4(_887.x, _887.y, r3.z, r3.w);
        vec2 _895 = (-r6.xy) + r3.xy;
        r3 = vec4(_895.x, _895.y, r3.z, r3.w);
        vec2 _904 = fma(r5.xx, r3.xy, r6.xy);
        r3 = vec4(_904.x, _904.y, r3.z, r3.w);
        vec2 _911 = mix(mix(min(r3.xy, r4.zw), r4.zw, isnan(r3.xy)), r3.xy, isnan(r4.zw));
        r3 = vec4(_911.x, _911.y, r3.z, r3.w);
        vec2 _923 = fma(r2.zw, cb0_0._m0[5u].zz, -cb0_0._m0[4u].xy);
        r2 = vec4(r2.x, r2.y, _923.x, _923.y);
        r6 = textureLod(SPIRV_Cross_Combinedt0s0, r2.zwzz.xy, 0.0);
        vec2 _936 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(r2.zw, vec2(0.0))));
        r4 = vec4(r4.x, r4.y, _936.x, _936.y);
        vec2 _943 = uintBitsToFloat(floatBitsToUint(r4.zw) & uvec2(1065353216u));
        r4 = vec4(r4.x, r4.y, _943.x, _943.y);
        vec2 _950 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(vec2(1.0), r2.zw)));
        r2 = vec4(r2.x, r2.y, _950.x, _950.y);
        vec2 _957 = uintBitsToFloat(floatBitsToUint(r2.zw) & uvec2(1065353216u));
        r2 = vec4(r2.x, r2.y, _957.x, _957.y);
        r2.z *= r4.z;
        r2.z = r4.w * r2.z;
        r2.z = r2.w * r2.z;
        vec2 _980 = r6.xy + vec2(-1.0);
        r4 = vec4(r4.x, r4.y, _980.x, _980.y);
        vec2 _987 = fma(r2.zz, r4.zw, vec2(1.0));
        r2 = vec4(r2.x, r2.y, _987.x, _987.y);
        vec2 _995 = (-r6.xy) + r2.zw;
        r2 = vec4(r2.x, r2.y, _995.x, _995.y);
        vec2 _1004 = fma(r5.xx, r2.zw, r6.xy);
        r2 = vec4(r2.x, r2.y, _1004.x, _1004.y);
        vec2 _1011 = mix(mix(min(r2.zw, r3.xy), r3.xy, isnan(r2.zw)), r2.zw, isnan(r3.xy));
        r4 = vec4(_1011.x, _1011.y, r4.z, r4.w);
    }
    r5 = textureLod(SPIRV_Cross_Combinedt1s1, r3.zwzz.xy, 0.0).yxzw;
    r2.z = uintBitsToFloat((cb0_0._m0[10u].x < 0.5) ? 4294967295u : 0u);
    r2.w = uintBitsToFloat((r5.z == 0.0) ? 4294967295u : 0u);
    r2.z = uintBitsToFloat(floatBitsToUint(r2.w) | floatBitsToUint(r2.z));
    if (floatBitsToUint(r2.z) == 0u)
    {
        r2.z = fma(r5.z, 255.0, 0.5);
        r2.z = floor(r2.z);
        r2.w = r2.z * 0.25;
        r2.w = floor(r2.w);
        r2.z = fma(-r2.w, 4.0, r2.z);
        vec2 _1079 = r3.zw * vec2(128.0);
        r3 = vec4(_1079.x, _1079.y, r3.z, r3.w);
        vec2 _1084 = mix(mix(max(r3.xy, vec2(0.0)), vec2(0.0), isnan(r3.xy)), r3.xy, isnan(vec2(0.0)));
        r3 = vec4(_1084.x, _1084.y, r3.z, r3.w);
        vec2 _1091 = mix(mix(min(r3.xy, vec2(127.99999237060546875)), vec2(127.99999237060546875), isnan(r3.xy)), r3.xy, isnan(vec2(127.99999237060546875)));
        r3 = vec4(_1091.x, _1091.y, r3.z, r3.w);
        vec2 _1096 = fract(r3.xy);
        r6 = vec4(_1096.x, _1096.y, r6.z, r6.w);
        vec2 _1102 = (-r6.yx) + vec2(1.0);
        r3 = vec4(_1102.x, _1102.y, r3.z, r3.w);
        vec3 _1116 = uintBitsToFloat(mix(uvec3(0u), uvec3(4294967295u), equal(r2.zzz, vec3(1.0, 2.0, 3.0))));
        r7 = vec4(_1116.x, _1116.y, _1116.z, r7.w);
        vec2 _1122 = (-r6.yx) + vec2(1.0);
        r6 = vec4(r6.x, r6.y, _1122.x, _1122.y);
        vec2 _1133 = mix(r6.yx, r6.xz, notEqual(floatBitsToUint(r7.zz), uvec2(0u)));
        r4 = vec4(r4.x, r4.y, _1133.x, _1133.y);
        vec2 _1144 = mix(r4.zw, r3.xy, notEqual(floatBitsToUint(r7.yy), uvec2(0u)));
        r3 = vec4(_1144.x, _1144.y, r3.z, r3.w);
        vec2 _1155 = mix(r3.xy, r6.wy, notEqual(floatBitsToUint(r7.xx), uvec2(0u)));
        r3 = vec4(_1155.x, _1155.y, r3.z, r3.w);
        r6 = uintBitsToFloat(mix(uvec4(0u), uvec4(4294967295u), equal(r2.wwww, vec4(11.0, 26.0, 10.0, 25.0))));
        r2.z = (-r3.y) + 0.5;
        vec2 _1180 = uintBitsToFloat(floatBitsToUint(r6.yw) | floatBitsToUint(r6.xz));
        r4 = vec4(r4.x, r4.y, _1180.x, _1180.y);
        vec2 _1188 = (-r3.yx) + r3.xy;
        r3 = vec4(_1188.x, _1188.y, r3.z, r3.w);
        r6 = uintBitsToFloat(mix(uvec4(0u), uvec4(4294967295u), equal(r2.wwww, vec4(12.0, 27.0, 51.0, 52.0))));
        vec2 _1205 = r3.xx + vec2(-0.5, 0.5);
        r7 = vec4(_1205.x, _1205.y, r7.z, r7.w);
        vec2 _1215 = uintBitsToFloat(floatBitsToUint(r6.yw) | floatBitsToUint(r6.xz));
        r6 = vec4(_1215.x, _1215.y, r6.z, r6.w);
        r2.w = abs(r3.y) + (-0.5);
        r2.w = (floatBitsToUint(r6.y) != 0u) ? r2.w : 1.0;
        r2.w = (floatBitsToUint(r6.x) != 0u) ? r7.y : r2.w;
        r2.w = (floatBitsToUint(r4.w) != 0u) ? r7.x : r2.w;
        r2.z = (floatBitsToUint(r4.z) != 0u) ? r2.z : r2.w;
        r2.z = uintBitsToFloat((0.0 >= r2.z) ? 4294967295u : 0u);
        r2.z = uintBitsToFloat(floatBitsToUint(r2.z) & 1065353216u);
        r5.x = isnan(r5.x) ? r2.z : (isnan(r2.z) ? r5.x : max(r2.z, r5.x));
    }
    r3 = textureLod(SPIRV_Cross_Combinedt2s2, r3.zwzz.xy, 0.0);
    r2.z = uintBitsToFloat((r3.x >= 0.0) ? 4294967295u : 0u);
    r0.y = fma(r3.x, r0.y, cb0_0._m0[8u].x);
    r0.w = fma(r3.x, r0.w, cb0_0._m0[9u].y);
    r0.w = (-r0.y) + r0.w;
    r0.w = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : max(r0.w, 0.0));
    r2.w = r3.w * cb0_0._m0[9u].x;
    r0.w = isnan(r2.w) ? r0.w : (isnan(r0.w) ? r2.w : min(r0.w, r2.w));
    r0.y = r0.w + r0.y;
    vec2 _1344 = mix(mix(min(r0.yy, cb0_0._m0[8u].zw), cb0_0._m0[8u].zw, isnan(r0.yy)), r0.yy, isnan(cb0_0._m0[8u].zw));
    r3 = vec4(_1344.x, r3.y, r3.z, _1344.y);
    vec2 _1352 = (-r0.yy) + r3.xw;
    r3 = vec4(_1352.x, r3.y, r3.z, _1352.y);
    vec2 _1361 = fma(r3.yz, r3.xw, r0.yy);
    r3 = vec4(_1361.x, _1361.y, r3.z, r3.w);
    r0.w = isnan(r3.x) ? r3.y : (isnan(r3.y) ? r3.x : min(r3.y, r3.x));
    r0.y = isnan(r0.y) ? r0.w : (isnan(r0.w) ? r0.y : min(r0.w, r0.y));
    r0.y = uintBitsToFloat(floatBitsToUint(r0.y) & floatBitsToUint(r2.z));
    r0.w = isnan(9.9999997473787516355514526367188e-05) ? r0.y : (isnan(r0.y) ? 9.9999997473787516355514526367188e-05 : max(r0.y, 9.9999997473787516355514526367188e-05));
    float _1395 = cb0_0._m0[9u].w / r0.w;
    float _2177 = isnan(0.0) ? _1395 : (isnan(_1395) ? 0.0 : max(_1395, 0.0));
    r0.w = isnan(1.0) ? _2177 : (isnan(_2177) ? 1.0 : min(_2177, 1.0));
    r2.z = (-r0.w) + 1.0;
    r0.w = fma(r4.y, r2.z, r0.w);
    float _2188 = isnan(0.0) ? r4.x : (isnan(r4.x) ? 0.0 : max(r4.x, 0.0));
    r4.x = isnan(1.0) ? _2188 : (isnan(_2188) ? 1.0 : min(_2188, 1.0));
    r2.z = (-r4.x) + 1.0;
    r2.z = dot(r2.zz, r2.zz);
    r2.z = isnan(1.0) ? r2.z : (isnan(r2.z) ? 1.0 : min(r2.z, 1.0));
    r2.z = (-r2.z) + (-r4.x);
    float _2204 = isnan(0.0) ? cb0_0._m0[13u].y : (isnan(cb0_0._m0[13u].y) ? 0.0 : max(cb0_0._m0[13u].y, 0.0));
    r2.w = isnan(1.0) ? _2204 : (isnan(_2204) ? 1.0 : min(_2204, 1.0));
    r2.z += 1.0;
    r2.z = fma(r2.w, r2.z, r4.x);
    r0.w = isnan(r2.z) ? r0.w : (isnan(r0.w) ? r2.z : min(r0.w, r2.z));
    float _1466 = r5.y + r5.y;
    float _2220 = isnan(0.0) ? _1466 : (isnan(_1466) ? 0.0 : max(_1466, 0.0));
    r2.z = isnan(1.0) ? _2220 : (isnan(_2220) ? 1.0 : min(_2220, 1.0));
    r2.w = uintBitsToFloat((0.0 < cb0_0._m0[12u].y) ? 4294967295u : 0u);
    vec2 _1480 = (-v3.xy) + vec2(1.0);
    r3 = vec4(_1480.x, _1480.y, r3.z, r3.w);
    vec2 _1487 = mix(mix(min(r3.xy, v3.xy), v3.xy, isnan(r3.xy)), r3.xy, isnan(v3.xy));
    r3 = vec4(_1487.x, _1487.y, r3.z, r3.w);
    r3.x = isnan(r3.x) ? r3.y : (isnan(r3.y) ? r3.x : min(r3.y, r3.x));
    r3.x = dot(cb0_0._m0[12u].xx, r3.xx);
    r3.y = 1.0 / cb0_0._m0[12u].y;
    float _1512 = r3.y * r3.x;
    float _2241 = isnan(0.0) ? _1512 : (isnan(_1512) ? 0.0 : max(_1512, 0.0));
    r3.x = isnan(1.0) ? _2241 : (isnan(_2241) ? 1.0 : min(_2241, 1.0));
    r3.y = fma(r3.x, -2.0, 3.0);
    r3.x *= r3.x;
    r3.x *= r3.y;
    r2.w = (floatBitsToUint(r2.w) != 0u) ? r3.x : 1.0;
    r3.x = uintBitsToFloat((cb0_0._m0[16u].x < cb0_0._m0[16u].y) ? 4294967295u : 0u);
    vec2 _1558 = r0.xz + (-cb0_0._m0[15u].xy);
    r3 = vec4(r3.x, _1558.x, _1558.y, r3.w);
    float _1563 = abs(r3.z);
    float _1566 = abs(r3.y);
    r3.y = isnan(_1566) ? _1563 : (isnan(_1563) ? _1566 : max(_1563, _1566));
    r3.z = (-cb0_0._m0[16u].x) + cb0_0._m0[16u].y;
    r3.y += (-cb0_0._m0[16u].x);
    r3.z = 1.0 / r3.z;
    float _1594 = r3.z * r3.y;
    float _2257 = isnan(0.0) ? _1594 : (isnan(_1594) ? 0.0 : max(_1594, 0.0));
    r3.y = isnan(1.0) ? _2257 : (isnan(_2257) ? 1.0 : min(_2257, 1.0));
    r3.z = fma(r3.y, -2.0, 3.0);
    r3.y *= r3.y;
    r3.y *= r3.z;
    r3.x = (floatBitsToUint(r3.x) != 0u) ? r3.y : 1.0;
    r2.w *= r3.x;
    r3.x = uintBitsToFloat((cb0_0._m0[18u].x < cb0_0._m0[18u].y) ? 4294967295u : 0u);
    vec2 _1645 = r0.xz + (-cb0_0._m0[17u].xy);
    r0 = vec4(_1645.x, r0.y, _1645.y, r0.w);
    float _1650 = abs(r0.z);
    float _1653 = abs(r0.x);
    r0.x = isnan(_1653) ? _1650 : (isnan(_1650) ? _1653 : max(_1650, _1653));
    r0.z = (-cb0_0._m0[18u].x) + cb0_0._m0[18u].y;
    r0.x += (-cb0_0._m0[18u].x);
    r3.y = 1.0 / r0.z;
    float _1681 = r0.x * r3.y;
    float _2273 = isnan(0.0) ? _1681 : (isnan(_1681) ? 0.0 : max(_1681, 0.0));
    r3.y = isnan(1.0) ? _2273 : (isnan(_2273) ? 1.0 : min(_2273, 1.0));
    r3.z = fma(r3.y, -2.0, 3.0);
    r3.y *= r3.y;
    r3.y = fma(-r3.z, r3.y, 1.0);
    r3.x = (floatBitsToUint(r3.x) != 0u) ? r3.y : 1.0;
    r2.w = fma(r2.w, r3.x, -1.0);
    r2.w = fma(cb0_0._m0[18u].z, r2.w, 1.0);
    r0.w += (-1.0);
    r0.w = fma(cb0_0._m0[6u].x, r0.w, 1.0);
    r0.y *= r2.z;
    r0.y = r0.w * r0.y;
    r0.w = r2.w * r0.y;
    r2.z = r5.x * cb0_0._m0[12u].z;
    r2.z = r5.w * r2.z;
    r0.w = fma(r2.z, r2.w, r0.w);
    r0.w += v0.y;
    r0.y = fma(-r0.y, r2.w, r1.z);
    r0.y += r0.w;
    r3.x = (floatBitsToUint(r2.y) != 0u) ? r0.y : r0.w;
    r0.y = r0.z + (-8.0);
    r0.y = 1.0 / r0.y;
    float _1816 = r0.y * r0.x;
    float _2284 = isnan(0.0) ? _1816 : (isnan(_1816) ? 0.0 : max(_1816, 0.0));
    r0.x = isnan(1.0) ? _2284 : (isnan(_2284) ? 1.0 : min(_2284, 1.0));
    r0.y = fma(r0.x, -2.0, 3.0);
    r0.x *= r0.x;
    r0.x *= r0.y;
    r0.y = r1.z + v5.x;
    r0.y += v5.y;
    r0.y += 0.00200000009499490261077880859375;
    r0.y = (-r3.x) + r0.y;
    r4.x = fma(r0.x, r0.y, r3.x);
    vec3 _1871 = v1.xyz + (-v2);
    r0 = vec4(r0.x, _1871.x, _1871.y, _1871.z);
    vec3 _1879 = fma(r0.xxx, r0.yzw, v2);
    r0 = vec4(_1879.x, _1879.y, _1879.z, r0.w);
    r0.w = dot(r0.xyz, r0.xyz);
    r0.w = inversesqrt(r0.w);
    vec3 _1896 = r0.www * r0.xyz;
    r4 = vec4(r4.x, _1896.x, _1896.y, _1896.z);
    r3 = vec4(r3.x, v2.x, v2.y, v2.z);
    r0 = mix(r3, r4, notEqual(floatBitsToUint(r2.xxxx), uvec4(0u)));
    r2 = r0.xxxx * cb1_0._m0[1u];
    r2 = fma(cb1_0._m0[0u], v0.xxxx, r2);
    r2 = fma(cb1_0._m0[2u], v0.zzzz, r2);
    r3 = r2 + cb1_0._m0[3u];
    r4 = r3.yyyy * cb2_0._m0[18u];
    r4 = fma(cb2_0._m0[17u], r3.xxxx, r4);
    r4 = fma(cb2_0._m0[19u], r3.zzzz, r4);
    gl_Position = fma(cb2_0._m0[20u], r3.wwww, r4);
    vec2 _1962 = fma(v3.xy, cb0_0._m0[19u].xy, cb0_0._m0[19u].zw);
    r1 = vec4(_1962.x, _1962.y, r1.z, r1.w);
    o3 = fma(cb1_0._m0[3u].xyz, v0.www, r2.xyz);
    r2.x = dot(r0.yzw, cb1_0._m0[4u].xyz);
    r2.y = dot(r0.yzw, cb1_0._m0[5u].xyz);
    r2.z = dot(r0.yzw, cb1_0._m0[6u].xyz);
    r0.x = dot(r2.xyz, r2.xyz);
    r0.x = inversesqrt(r0.x);
    o2 = r0.xxx * r2.xyz;
    o1 = r1;
    o4 = vec4(0.0);
    o5 = vec4(0.0);
}

// ==== pass 0 "FORWARD" LIGHTMODE=FORWARDBASE fragment keywords=['DIRECTIONAL']
// cbuffer $Globals -> cb[0] size=320
//   [2].x _LightColor0 dim=4
//   [5].x _DynamicMaskMapping dim=4
//   [7].x _StaticMaskMapping dim=4
//   [8].x _BaseSnowDepth dim=1
//   [8].y _SettlementSnowDepth dim=1
//   [8].z _LocationMaximumSnowDepth dim=1
//   [8].w _PathMaximumSnowDepth dim=1
//   [9].x _RoadBermRise dim=1
//   [9].y _WildernessMaximumDepth dim=1
//   [9].z _SettlementMaximumDepth dim=1
//   [9].w _CorpseRemainingDepth dim=1
//   [10].x _BlanketSurface dim=1
//   [10].y _MorphToBlanket dim=1
//   [11].x _FarTrackMapping dim=4
//   [12].x _SnowRadius dim=1
//   [12].y _EdgeFadeWidth dim=1
//   [12].w _TextureWorldSize dim=1
//   [13].x _CompressionDarkening dim=1
//   [13].y _TrackImpressionStrength dim=1
//   [14].x _TerrainAmbientLight dim=4
//   [15].x _InnerFadeCenter dim=4
//   [16].x _InnerFadeStart dim=1
//   [16].y _InnerFadeEnd dim=1
//   [17].x _OuterClipCenter dim=4
//   [18].x _OuterClipStart dim=1
//   [18].y _OuterClipEnd dim=1
// cbuffer UnityLighting -> cb[1] size=768
//   [0].x _WorldSpaceLightPos0 dim=4
//   [46].x unity_OcclusionMaskSelector dim=4
// cbuffer UnityProbeVolume -> cb[2] size=112
//   [0].x unity_ProbeVolumeParams dim=4
//   [5].x unity_ProbeVolumeSizeInv dim=3
//   [6].x unity_ProbeVolumeMin dim=3
//   [1..] MATRIX unity_ProbeVolumeWorldToObject rows=4
// texture t0 s3 _StaticMask
// texture t1 s4 _ContextMask
// texture t2 s2 _DynamicMask
// texture t3 s5 _FarTrackMask
// texture t4 s1 _MainTex
// texture t5 s0 unity_ProbeVolumeSH
#version 450

layout(binding = 0, std140) uniform cb19_struct
{
    vec4 _m0[19];
} cb0_0;

layout(binding = 1, std140) uniform cb47_struct
{
    vec4 _m0[47];
} cb1_0;

layout(binding = 2, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb2_0;

uniform sampler2D SPIRV_Cross_Combinedt0s3;
uniform sampler2D SPIRV_Cross_Combinedt1s4;
uniform sampler2D SPIRV_Cross_Combinedt2s2;
uniform sampler2D SPIRV_Cross_Combinedt3s5;
uniform sampler2D SPIRV_Cross_Combinedt4s1;
uniform sampler3D SPIRV_Cross_Combinedt5s0;

layout(location = 1) in vec4 v1;
layout(location = 2) in vec3 v2;
layout(location = 3) in vec3 v3;
layout(location = 0) out vec4 o0;

void main()
{
    vec4 r0;
    r0.x = uintBitsToFloat((0.0 < cb0_0._m0[12u].y) ? 4294967295u : 0u);
    vec2 _77 = (-v1.xy) + vec2(1.0);
    r0 = vec4(r0.x, _77.x, _77.y, r0.w);
    vec2 _85 = mix(mix(min(r0.yz, v1.xy), v1.xy, isnan(r0.yz)), r0.yz, isnan(v1.xy));
    r0 = vec4(r0.x, _85.x, _85.y, r0.w);
    r0.y = isnan(r0.y) ? r0.z : (isnan(r0.z) ? r0.y : min(r0.z, r0.y));
    r0.y = dot(cb0_0._m0[12u].xx, r0.yy);
    r0.z = 1.0 / cb0_0._m0[12u].y;
    float _111 = r0.z * r0.y;
    float _1509 = isnan(0.0) ? _111 : (isnan(_111) ? 0.0 : max(_111, 0.0));
    r0.y = isnan(1.0) ? _1509 : (isnan(_1509) ? 1.0 : min(_1509, 1.0));
    r0.z = fma(r0.y, -2.0, 3.0);
    r0.y *= r0.y;
    r0.w = uintBitsToFloat((cb0_0._m0[16u].x < cb0_0._m0[16u].y) ? 4294967295u : 0u);
    vec2 _145 = v3.xz + (-cb0_0._m0[15u].xy);
    vec4 r1;
    r1 = vec4(_145.x, _145.y, r1.z, r1.w);
    float _150 = abs(r1.y);
    float _153 = abs(r1.x);
    r1.x = isnan(_153) ? _150 : (isnan(_150) ? _153 : max(_150, _153));
    r1.y = (-cb0_0._m0[16u].x) + cb0_0._m0[16u].y;
    r1.x += (-cb0_0._m0[16u].x);
    r1.y = 1.0 / r1.y;
    float _181 = r1.y * r1.x;
    float _1525 = isnan(0.0) ? _181 : (isnan(_181) ? 0.0 : max(_181, 0.0));
    r1.x = isnan(1.0) ? _1525 : (isnan(_1525) ? 1.0 : min(_1525, 1.0));
    r1.y = fma(r1.x, -2.0, 3.0);
    r1.x *= r1.x;
    r1.z = uintBitsToFloat((cb0_0._m0[18u].x < cb0_0._m0[18u].y) ? 4294967295u : 0u);
    vec2 _212 = v3.xz + (-cb0_0._m0[17u].xy);
    vec4 r2;
    r2 = vec4(_212.x, _212.y, r2.z, r2.w);
    float _217 = abs(r2.y);
    float _220 = abs(r2.x);
    r1.w = isnan(_220) ? _217 : (isnan(_217) ? _220 : max(_217, _220));
    r2.x = (-cb0_0._m0[18u].x) + cb0_0._m0[18u].y;
    r1.w += (-cb0_0._m0[18u].x);
    r2.y = 1.0 / r2.x;
    float _248 = r1.w * r2.y;
    float _1541 = isnan(0.0) ? _248 : (isnan(_248) ? 0.0 : max(_248, 0.0));
    r2.y = isnan(1.0) ? _1541 : (isnan(_1541) ? 1.0 : min(_1541, 1.0));
    r2.z = fma(r2.y, -2.0, 3.0);
    r2.y *= r2.y;
    r0.y = fma(r0.z, r0.y, -0.001000000047497451305389404296875);
    r0.y = uintBitsToFloat((r0.y < 0.0) ? 4294967295u : 0u);
    r0.x = uintBitsToFloat(floatBitsToUint(r0.y) & floatBitsToUint(r0.x));
    if (floatBitsToUint(r0.x) != 0u)
    {
        discard;
    }
    r0.x = fma(r1.y, r1.x, -9.9999997473787516355514526367188e-06);
    r0.x = uintBitsToFloat((r0.x < 0.0) ? 4294967295u : 0u);
    r0.x = uintBitsToFloat(floatBitsToUint(r0.x) & floatBitsToUint(r0.w));
    if (floatBitsToUint(r0.x) != 0u)
    {
        discard;
    }
    r0.x = fma(-r2.z, r2.y, 0.999989986419677734375);
    r0.x = uintBitsToFloat((r0.x < 0.0) ? 4294967295u : 0u);
    r0.x = uintBitsToFloat(floatBitsToUint(r0.x) & floatBitsToUint(r1.z));
    if (floatBitsToUint(r0.x) != 0u)
    {
        discard;
    }
    vec2 _353 = v3.xz + (-cb0_0._m0[5u].xy);
    r0 = vec4(_353.x, _353.y, r0.z, r0.w);
    vec2 _361 = r0.xy * cb0_0._m0[5u].zz;
    r0 = vec4(_361.x, _361.y, r0.z, r0.w);
    vec2 _370 = v3.xz + (-cb0_0._m0[7u].xy);
    r0 = vec4(r0.x, r0.y, _370.x, _370.y);
    vec2 _378 = r0.zw * cb0_0._m0[7u].zz;
    r0 = vec4(r0.x, r0.y, _378.x, _378.y);
    vec4 r3 = texture(SPIRV_Cross_Combinedt0s3, r0.zwzz.xy).yxzw;
    r1.x = uintBitsToFloat((cb0_0._m0[10u].x < 0.5) ? 4294967295u : 0u);
    r1.y = uintBitsToFloat((r3.z == 0.0) ? 4294967295u : 0u);
    r1.x = uintBitsToFloat(floatBitsToUint(r1.y) | floatBitsToUint(r1.x));
    vec4 r4;
    if (floatBitsToUint(r1.x) == 0u)
    {
        r1.x = fma(r3.z, 255.0, 0.5);
        r1.x = floor(r1.x);
        r1.y = r1.x * 0.25;
        r1.y = floor(r1.y);
        r1.x = fma(-r1.y, 4.0, r1.x);
        vec2 _449 = r0.zw * vec2(128.0);
        r2 = vec4(r2.x, _449.x, _449.y, r2.w);
        vec2 _455 = mix(mix(max(r2.yz, vec2(0.0)), vec2(0.0), isnan(r2.yz)), r2.yz, isnan(vec2(0.0)));
        r2 = vec4(r2.x, _455.x, _455.y, r2.w);
        vec2 _462 = mix(mix(min(r2.yz, vec2(127.99999237060546875)), vec2(127.99999237060546875), isnan(r2.yz)), r2.yz, isnan(vec2(127.99999237060546875)));
        r2 = vec4(r2.x, _462.x, _462.y, r2.w);
        vec2 _467 = fract(r2.yz);
        r4 = vec4(_467.x, _467.y, r4.z, r4.w);
        vec2 _473 = (-r4.yx) + vec2(1.0);
        r2 = vec4(r2.x, _473.x, _473.y, r2.w);
        vec3 _486 = uintBitsToFloat(mix(uvec3(0u), uvec3(4294967295u), equal(r1.xxx, vec3(1.0, 2.0, 3.0))));
        r3 = vec4(r3.x, _486.x, _486.y, _486.z);
        vec2 _492 = (-r4.yx) + vec2(1.0);
        r4 = vec4(r4.x, r4.y, _492.x, _492.y);
        vec2 _506 = mix(r4.yx, r4.xz, notEqual(floatBitsToUint(r3.ww), uvec2(0u)));
        r1 = vec4(_506.x, r1.y, _506.y, r1.w);
        vec2 _517 = mix(r1.xz, r2.yz, notEqual(floatBitsToUint(r3.zz), uvec2(0u)));
        r1 = vec4(_517.x, r1.y, _517.y, r1.w);
        vec2 _528 = mix(r1.xz, r4.wy, notEqual(floatBitsToUint(r3.yy), uvec2(0u)));
        r1 = vec4(_528.x, r1.y, _528.y, r1.w);
        r4 = uintBitsToFloat(mix(uvec4(0u), uvec4(4294967295u), equal(r1.yyyy, vec4(11.0, 26.0, 10.0, 25.0))));
        r2.y = (-r1.z) + 0.5;
        vec2 _557 = uintBitsToFloat(floatBitsToUint(r4.yw) | floatBitsToUint(r4.xz));
        r2 = vec4(r2.x, r2.y, _557.x, _557.y);
        vec2 _565 = (-r1.zx) + r1.xz;
        r1 = vec4(_565.x, r1.y, _565.y, r1.w);
        r4 = uintBitsToFloat(mix(uvec4(0u), uvec4(4294967295u), equal(r1.yyyy, vec4(12.0, 27.0, 51.0, 52.0))));
        vec2 _582 = r1.xx + vec2(-0.5, 0.5);
        r1 = vec4(_582.x, _582.y, r1.z, r1.w);
        vec2 _592 = uintBitsToFloat(floatBitsToUint(r4.yw) | floatBitsToUint(r4.xz));
        r3 = vec4(r3.x, _592.x, _592.y, r3.w);
        r1.z = abs(r1.z) + (-0.5);
        r1.z = (floatBitsToUint(r3.z) != 0u) ? r1.z : 1.0;
        r1.y = (floatBitsToUint(r3.y) != 0u) ? r1.y : r1.z;
        r1.x = (floatBitsToUint(r2.w) != 0u) ? r1.x : r1.y;
        r1.x = (floatBitsToUint(r2.z) != 0u) ? r2.y : r1.x;
        r1.x = uintBitsToFloat((0.0 >= r1.x) ? 4294967295u : 0u);
        r1.x = uintBitsToFloat(floatBitsToUint(r1.x) & 1065353216u);
        r3.x = isnan(r3.x) ? r1.x : (isnan(r1.x) ? r3.x : max(r1.x, r3.x));
    }
    r4 = texture(SPIRV_Cross_Combinedt1s4, r0.zwzz.xy);
    vec2 _670 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), lessThan(vec2(0.5), cb0_0._m0[10u].xy)));
    r0 = vec4(r0.x, r0.y, _670.x, _670.y);
    r1.x = (floatBitsToUint(r0.z) != 0u) ? v1.w : r4.z;
    r1.y = uintBitsToFloat((r4.x >= 0.0) ? 4294967295u : 0u);
    r1.z = (-cb0_0._m0[8u].x) + cb0_0._m0[8u].y;
    r1.z = fma(r4.x, r1.z, cb0_0._m0[8u].x);
    r2.y = (-cb0_0._m0[9u].y) + cb0_0._m0[9u].z;
    r2.y = fma(r4.x, r2.y, cb0_0._m0[9u].y);
    r2.y = (-r1.z) + r2.y;
    r2.y = isnan(0.0) ? r2.y : (isnan(r2.y) ? 0.0 : max(r2.y, 0.0));
    r2.z = r4.w * cb0_0._m0[9u].x;
    r2.y = isnan(r2.y) ? r2.z : (isnan(r2.z) ? r2.y : min(r2.z, r2.y));
    r1.z += r2.y;
    vec2 _763 = mix(mix(min(r1.zz, cb0_0._m0[8u].zw), cb0_0._m0[8u].zw, isnan(r1.zz)), r1.zz, isnan(cb0_0._m0[8u].zw));
    r2 = vec4(r2.x, _763.x, _763.y, r2.w);
    vec2 _771 = (-r1.zz) + r2.yz;
    r2 = vec4(r2.x, _771.x, _771.y, r2.w);
    vec2 _780 = fma(r4.yz, r2.yz, r1.zz);
    r2 = vec4(r2.x, _780.x, _780.y, r2.w);
    r2.y = isnan(r2.y) ? r2.z : (isnan(r2.z) ? r2.y : min(r2.z, r2.y));
    r1.z = isnan(r2.y) ? r1.z : (isnan(r1.z) ? r2.y : min(r1.z, r2.y));
    r1.y = uintBitsToFloat(floatBitsToUint(r1.z) & floatBitsToUint(r1.y));
    r0.z = (floatBitsToUint(r0.z) != 0u) ? v1.z : r1.y;
    r1.y = r3.x + (-0.004999999888241291046142578125);
    r1.y = uintBitsToFloat((r1.y < 0.0) ? 4294967295u : 0u);
    if (floatBitsToUint(r1.y) != 0u)
    {
        discard;
    }
    r3 = texture(SPIRV_Cross_Combinedt2s2, r0.xyxx.xy);
    vec2 _841 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(r0.xy, vec2(0.0))));
    r1 = vec4(r1.x, _841.x, _841.y, r1.w);
    vec2 _849 = uintBitsToFloat(floatBitsToUint(r1.yz) & uvec2(1065353216u));
    r1 = vec4(r1.x, _849.x, _849.y, r1.w);
    vec2 _856 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(vec2(1.0), r0.xy)));
    r0 = vec4(_856.x, _856.y, r0.z, r0.w);
    vec2 _863 = uintBitsToFloat(floatBitsToUint(r0.xy) & uvec2(1065353216u));
    r0 = vec4(_863.x, _863.y, r0.z, r0.w);
    r0.x *= r1.y;
    r0.x = r1.z * r0.x;
    r0.x = r0.y * r0.x;
    vec2 _888 = r3.xy + vec2(-1.0);
    r1 = vec4(r1.x, _888.x, _888.y, r1.w);
    vec2 _895 = fma(r0.xx, r1.yz, vec2(1.0));
    r0 = vec4(_895.x, _895.y, r0.z, r0.w);
    r1.y = uintBitsToFloat((cb0_0._m0[5u].w >= 0.5) ? 4294967295u : 0u);
    r1.y = uintBitsToFloat(floatBitsToUint(r1.y) & 1065353216u);
    vec2 _916 = (-r3.xy) + r0.xy;
    r0 = vec4(_916.x, _916.y, r0.z, r0.w);
    vec2 _925 = fma(r1.yy, r0.xy, r3.xy);
    r0 = vec4(_925.x, _925.y, r0.z, r0.w);
    r1.y = isnan(9.9999997473787516355514526367188e-05) ? r0.z : (isnan(r0.z) ? 9.9999997473787516355514526367188e-05 : max(r0.z, 9.9999997473787516355514526367188e-05));
    float _938 = cb0_0._m0[9u].w / r1.y;
    float _1597 = isnan(0.0) ? _938 : (isnan(_938) ? 0.0 : max(_938, 0.0));
    r1.y = isnan(1.0) ? _1597 : (isnan(_1597) ? 1.0 : min(_1597, 1.0));
    r1.z = (-r1.y) + 1.0;
    r0.y = fma(r0.y, r1.z, r1.y);
    float _1608 = isnan(0.0) ? r0.x : (isnan(r0.x) ? 0.0 : max(r0.x, 0.0));
    r0.x = isnan(1.0) ? _1608 : (isnan(_1608) ? 1.0 : min(_1608, 1.0));
    r1.y = (-r0.x) + 1.0;
    r1.y = dot(r1.yy, r1.yy);
    r1.y = isnan(1.0) ? r1.y : (isnan(r1.y) ? 1.0 : min(r1.y, 1.0));
    r1.y = (-r1.y) + 1.0;
    float _1624 = isnan(0.0) ? cb0_0._m0[13u].y : (isnan(cb0_0._m0[13u].y) ? 0.0 : max(cb0_0._m0[13u].y, 0.0));
    r1.z = isnan(1.0) ? _1624 : (isnan(_1624) ? 1.0 : min(_1624, 1.0));
    r1.y = (-r0.x) + r1.y;
    r0.x = fma(r1.z, r1.y, r0.x);
    r0.x = isnan(r0.x) ? r0.y : (isnan(r0.y) ? r0.x : min(r0.y, r0.x));
    r0.y = isnan(0.001000000047497451305389404296875) ? cb0_0._m0[12u].w : (isnan(cb0_0._m0[12u].w) ? 0.001000000047497451305389404296875 : max(cb0_0._m0[12u].w, 0.001000000047497451305389404296875));
    vec2 _1015 = v3.xz / r0.yy;
    r2 = vec4(r2.x, _1015.x, _1015.y, r2.w);
    if (floatBitsToUint(r0.w) != 0u)
    {
        r0.y = r2.x + (-8.0);
        r0.y = 1.0 / r0.y;
        float _1037 = r0.y * r1.w;
        float _1645 = isnan(0.0) ? _1037 : (isnan(_1037) ? 0.0 : max(_1037, 0.0));
        r0.y = isnan(1.0) ? _1645 : (isnan(_1645) ? 1.0 : min(_1645, 1.0));
        r0.w = fma(r0.y, -2.0, 3.0);
        r0.y *= r0.y;
        r0.y *= r0.w;
        vec2 _1063 = v3.xz + (-cb0_0._m0[11u].xy);
        r1 = vec4(r1.x, _1063.x, r1.z, _1063.y);
        vec2 _1071 = r1.yw * cb0_0._m0[11u].zz;
        r1 = vec4(r1.x, _1071.x, r1.z, _1071.y);
        vec2 _1078 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(r1.yw, vec2(0.0))));
        r2 = vec4(_1078.x, r2.y, r2.z, _1078.y);
        vec2 _1085 = uintBitsToFloat(floatBitsToUint(r2.xw) & uvec2(1065353216u));
        r2 = vec4(_1085.x, r2.y, r2.z, _1085.y);
        vec2 _1092 = uintBitsToFloat(mix(uvec2(0u), uvec2(4294967295u), greaterThanEqual(vec2(1.0), r1.yw)));
        r3 = vec4(_1092.x, _1092.y, r3.z, r3.w);
        vec2 _1099 = uintBitsToFloat(floatBitsToUint(r3.xy) & uvec2(1065353216u));
        r3 = vec4(_1099.x, _1099.y, r3.z, r3.w);
        r0.w = r2.x * r3.x;
        r0.w = r2.w * r0.w;
        r0.w = r3.y * r0.w;
        r3 = texture(SPIRV_Cross_Combinedt3s5, r1.ywyy.xy);
        vec2 _1128 = r3.xy + vec2(-1.0);
        r1 = vec4(r1.x, _1128.x, r1.z, _1128.y);
        vec2 _1135 = fma(r0.ww, r1.yw, vec2(1.0));
        r1 = vec4(r1.x, _1135.x, r1.z, _1135.y);
        r0.w = isnan(9.9999997473787516355514526367188e-05) ? v1.z : (isnan(v1.z) ? 9.9999997473787516355514526367188e-05 : max(v1.z, 9.9999997473787516355514526367188e-05));
        float _1147 = cb0_0._m0[9u].w / r0.w;
        float _1661 = isnan(0.0) ? _1147 : (isnan(_1147) ? 0.0 : max(_1147, 0.0));
        r0.w = isnan(1.0) ? _1661 : (isnan(_1661) ? 1.0 : min(_1661, 1.0));
        r2.x = (-r0.w) + 1.0;
        r0.w = fma(r1.w, r2.x, r0.w);
        float _1672 = isnan(0.0) ? r1.y : (isnan(r1.y) ? 0.0 : max(r1.y, 0.0));
        r1.y = isnan(1.0) ? _1672 : (isnan(_1672) ? 1.0 : min(_1672, 1.0));
        r1.w = (-r1.y) + 1.0;
        r1.w = dot(r1.ww, r1.ww);
        r1.w = isnan(1.0) ? r1.w : (isnan(r1.w) ? 1.0 : min(r1.w, 1.0));
        r1.w = (-r1.w) + 1.0;
        r1.w = (-r1.y) + r1.w;
        r1.y = fma(r1.z, r1.w, r1.y);
        r0.w = isnan(r1.y) ? r0.w : (isnan(r0.w) ? r1.y : min(r0.w, r1.y));
        r0.w = (-r0.x) + r0.w;
        r0.x = fma(r0.y, r0.w, r0.x);
        r0.w = (-r0.z) + v1.z;
        r0.z = fma(r0.y, r0.w, r0.z);
        r0.w = (-r1.x) + v1.w;
        r1.x = fma(r0.y, r0.w, r1.x);
    }
    r2 = texture(SPIRV_Cross_Combinedt4s1, r2.yzyy.xy);
    float _1693 = isnan(0.0) ? r1.x : (isnan(r1.x) ? 0.0 : max(r1.x, 0.0));
    r1.x = isnan(1.0) ? _1693 : (isnan(_1693) ? 1.0 : min(_1693, 1.0));
    r0.y = fma(-r1.x, 0.02999999932944774627685546875, 1.0);
    vec3 _1273 = r0.yyy * r2.xyz;
    r1 = vec4(_1273.x, _1273.y, _1273.z, r1.w);
    float _1279 = r0.z * 1.33333337306976318359375;
    float _1704 = isnan(0.0) ? _1279 : (isnan(_1279) ? 0.0 : max(_1279, 0.0));
    r0.y = isnan(1.0) ? _1704 : (isnan(_1704) ? 1.0 : min(_1704, 1.0));
    r0.z = sqrt(r0.y);
    r0.z = (-r0.y) + r0.z;
    r0.y = fma(r0.z, 0.25, r0.y);
    r0.y *= cb0_0._m0[13u].x;
    r0.x = (-r0.x) + 1.0;
    r0.x = fma(-r0.y, r0.x, 1.0);
    vec3 _1322 = r0.xxx * r1.xyz;
    r0 = vec4(_1322.x, _1322.y, _1322.z, r0.w);
    vec3 _1331 = r0.xyz * cb0_0._m0[14u].xyz;
    r1 = vec4(_1331.x, _1331.y, _1331.z, r1.w);
    r0.w = uintBitsToFloat((cb2_0._m0[0u].x == 1.0) ? 4294967295u : 0u);
    if (floatBitsToUint(r0.w) != 0u)
    {
        r0.w = uintBitsToFloat((cb2_0._m0[0u].y == 1.0) ? 4294967295u : 0u);
        vec3 _1359 = v3.yyy * cb2_0._m0[2u].xyz;
        r2 = vec4(_1359.x, _1359.y, _1359.z, r2.w);
        vec3 _1369 = fma(cb2_0._m0[1u].xyz, v3.xxx, r2.xyz);
        r2 = vec4(_1369.x, _1369.y, _1369.z, r2.w);
        vec3 _1379 = fma(cb2_0._m0[3u].xyz, v3.zzz, r2.xyz);
        r2 = vec4(_1379.x, _1379.y, _1379.z, r2.w);
        vec3 _1388 = r2.xyz + cb2_0._m0[4u].xyz;
        r2 = vec4(_1388.x, _1388.y, _1388.z, r2.w);
        vec3 _1398 = mix(v3, r2.xyz, notEqual(floatBitsToUint(r0.www), uvec3(0u)));
        r2 = vec4(_1398.x, _1398.y, _1398.z, r2.w);
        vec3 _1408 = r2.xyz + (-cb2_0._m0[6u].xyz);
        r2 = vec4(_1408.x, _1408.y, _1408.z, r2.w);
        vec3 _1416 = r2.xyz * cb2_0._m0[5u].xyz;
        r2 = vec4(r2.x, _1416.x, _1416.y, _1416.z);
        r0.w = fma(r2.y, 0.25, 0.75);
        r1.w = fma(cb2_0._m0[0u].z, 0.5, 0.75);
        r2.x = isnan(r1.w) ? r0.w : (isnan(r0.w) ? r1.w : max(r0.w, r1.w));
        r2 = texture(SPIRV_Cross_Combinedt5s0, r2.xzwx.xyz);
    }
    else
    {
        r2 = vec4(1.0);
    }
    float _1448 = dot(r2, cb1_0._m0[46u]);
    float _1720 = isnan(0.0) ? _1448 : (isnan(_1448) ? 0.0 : max(_1448, 0.0));
    r0.w = isnan(1.0) ? _1720 : (isnan(_1720) ? 1.0 : min(_1720, 1.0));
    vec3 _1456 = r0.www * cb0_0._m0[2u].xyz;
    r2 = vec4(_1456.x, _1456.y, _1456.z, r2.w);
    r0.w = dot(v2, cb1_0._m0[0u].xyz);
    r0.w = isnan(0.0) ? r0.w : (isnan(r0.w) ? 0.0 : max(r0.w, 0.0));
    vec3 _1473 = r0.xyz * r2.xyz;
    r0 = vec4(_1473.x, _1473.y, _1473.z, r0.w);
    vec3 _1482 = fma(r0.xyz, r0.www, r1.xyz);
    o0 = vec4(_1482.x, _1482.y, _1482.z, o0.w);
    o0.w = 1.0;
}

