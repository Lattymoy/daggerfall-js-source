// Daggerfall/Mods/HeatHaze - read back from the DXBC by tools/dxbcGlsl.py (GLSL 450: DXBC mad is fma)

// ==== pass 1 "" LIGHTMODE=- vertex keywords=[]
// cbuffer UnityPerDraw -> cb[0] size=176
//   [0..] MATRIX unity_ObjectToWorld rows=4
// cbuffer UnityPerFrame -> cb[1] size=368
//   [17..] MATRIX unity_MatrixVP rows=4
#version 450

layout(binding = 0, std140) uniform cb4_struct
{
    vec4 _m0[4];
} cb0_0;

layout(binding = 1, std140) uniform cb21_struct
{
    vec4 _m0[21];
} cb1_0;

layout(location = 0) in vec4 v0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;

void main()
{
    vec4 r0 = v0.yyyy * cb0_0._m0[1u];
    r0 = fma(cb0_0._m0[0u], v0.xxxx, r0);
    r0 = fma(cb0_0._m0[2u], v0.zzzz, r0);
    vec4 r1 = r0 + cb0_0._m0[3u];
    vec3 _62 = fma(cb0_0._m0[3u].xyz, v0.www, r0.xyz);
    o2 = vec4(_62.x, _62.y, _62.z, o2.w);
    r0 = r1.yyyy * cb1_0._m0[18u];
    r0 = fma(cb1_0._m0[17u], r1.xxxx, r0);
    r0 = fma(cb1_0._m0[19u], r1.zzzz, r0);
    r0 = fma(cb1_0._m0[20u], r1.wwww, r0);
    gl_Position = r0;
    vec3 _97 = r0.xwy * vec3(0.5, 0.5, -0.5);
    r1 = vec4(_97.x, _97.y, _97.z, r1.w);
    o1 = vec4(o1.x, o1.y, r0.z, r0.w);
    vec2 _108 = r1.yy + r1.xz;
    o1 = vec4(_108.x, _108.y, o1.z, o1.w);
    o2.w = v0.y;
}

// ==== pass 1 "" LIGHTMODE=- fragment keywords=[]
// cbuffer $Globals -> cb[0] size=48
//   [2].x _IntensityPixels dim=1
//   [2].y _NoiseScale dim=1
//   [2].z _AnimationSpeed dim=1
// cbuffer UnityPerCamera -> cb[1] size=144
//   [0].x _Time dim=4
//   [6].x _ScreenParams dim=4
// texture t0 s1 _NoiseTex
// texture t1 s0 _HeatHazeGrabTexture
#version 450

layout(binding = 0, std140) uniform cb3_struct
{
    vec4 _m0[3];
} cb0_0;

layout(binding = 1, std140) uniform cb7_struct
{
    vec4 _m0[7];
} cb1_0;

uniform sampler2D SPIRV_Cross_Combinedt0s1;
uniform sampler2D SPIRV_Cross_Combinedt1s0;

layout(location = 1) in vec4 v1;
layout(location = 2) in vec4 v2;
layout(location = 0) out vec4 o0;

void main()
{
    vec4 r0;
    r0.x = abs(v2.w) + (-25.0);
    float _48 = r0.x * 0.02222222276031970977783203125;
    float _255 = isnan(0.0) ? _48 : (isnan(_48) ? 0.0 : max(_48, 0.0));
    r0.x = isnan(1.0) ? _255 : (isnan(_255) ? 1.0 : min(_255, 1.0));
    r0.y = fma(r0.x, -2.0, 3.0);
    r0.x *= r0.x;
    vec2 _74 = fma(-r0.yy, r0.xx, vec2(1.0, 0.99989998340606689453125));
    r0 = vec4(_74.x, _74.y, r0.z, r0.w);
    r0.y = uintBitsToFloat((r0.y < 0.0) ? 4294967295u : 0u);
    r0.x *= cb0_0._m0[2u].x;
    if (floatBitsToUint(r0.y) != 0u)
    {
        discard;
    }
    vec4 r1;
    r1.x = dot(v2.xz, vec2(0.92390000820159912109375, 0.3826999962329864501953125));
    r1.z = dot(v2.xz, vec2(-0.4226000010967254638671875, 0.906300008296966552734375));
    r0.y = cb0_0._m0[2u].y * 0.002199999988079071044921875;
    vec2 _125 = v2.yy * vec2(1.5);
    r1 = vec4(r1.x, _125.x, r1.z, _125.y);
    r1 = r0.yyyy * r1;
    r0.y = cb0_0._m0[2u].z * cb1_0._m0[0u].y;
    vec4 r2 = r0.yyyy * vec4(0.026000000536441802978515625, -0.300000011920928955078125, -0.0430000014603137969970703125, -0.4799999892711639404296875);
    r1 = fma(r1, vec4(3.599999904632568359375, 3.599999904632568359375, 7.19999980926513671875, 7.19999980926513671875), r2);
    r2 = texture(SPIRV_Cross_Combinedt0s1, r1.zwzz.xy);
    r1 = texture(SPIRV_Cross_Combinedt0s1, r1.xyxx.xy);
    vec2 _171 = r1.xy + vec2(-0.5);
    r0 = vec4(r0.x, _171.x, _171.y, r0.w);
    vec2 _176 = r2.yx + vec2(-0.5);
    r1 = vec4(_176.x, _176.y, r1.z, r1.w);
    vec2 _183 = r1.xy * vec2(0.85000002384185791015625);
    r1 = vec4(_183.x, _183.y, r1.z, r1.w);
    vec2 _192 = fma(r0.yz, vec2(1.14999997615814208984375), r1.xy);
    r0 = vec4(r0.x, _192.x, _192.y, r0.w);
    vec2 _199 = r0.yz * vec2(0.300000011920928955078125, 1.0);
    r0 = vec4(r0.x, _199.x, _199.y, r0.w);
    vec2 _206 = r0.xx * r0.yz;
    r0 = vec4(_206.x, _206.y, r0.z, r0.w);
    vec2 _214 = mix(mix(max(cb1_0._m0[6u].xy, vec2(1.0)), vec2(1.0), isnan(cb1_0._m0[6u].xy)), cb1_0._m0[6u].xy, isnan(vec2(1.0)));
    r0 = vec4(r0.x, r0.y, _214.x, _214.y);
    vec2 _219 = vec2(1.0) / r0.zw;
    r0 = vec4(r0.x, r0.y, _219.x, _219.y);
    vec2 _226 = r0.zw * r0.xy;
    r0 = vec4(_226.x, _226.y, r0.z, r0.w);
    vec2 _235 = fma(r0.xy, v1.ww, v1.xy);
    r0 = vec4(_235.x, _235.y, r0.z, r0.w);
    vec2 _242 = r0.xy / v1.ww;
    r0 = vec4(_242.x, _242.y, r0.z, r0.w);
    o0 = texture(SPIRV_Cross_Combinedt1s0, r0.xyxx.xy);
}

