// The GLSL evaluator (test/helpers/glsl.js) on small shaders whose answers
// are worked by hand here, so a test that runs a real shader's function
// through it stands on something checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions, GlslDiscard } from './glsl.mjs';

const near = (a, b, eps = 1e-9) => {
  if (Array.isArray(b)) { assert.equal(a.length, b.length); b.forEach((x, i) => near(a[i], x, eps)); return; }
  assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
};

test('a whole shader parses: #version, precision, layout, uniforms, ins, outs, comments', () => {
  const fns = glslFunctions(`#version 300 es
precision highp float;
precision highp sampler3D;
layout(location=0) in vec2 aPos;   // a vertex input
uniform float uTime, uBox;
uniform sampler3D uShape;
/* a block
   comment */
out vec4 outColor;
void main() { outColor = vec4(aPos, uTime, uBox); }`, { aPos: [1, 2], uTime: 3, uBox: 4 });
  fns.main();
  assert.deepEqual(fns.globals.outColor, [1, 2, 3, 4]);
  assert.equal(fns.globals.uShape, 'uShape');   // a sampler is its own name
});

test('built-in variables and undeclared uniforms: from bindings, or written to .globals before the first call', () => {
  const src = 'out vec4 outColor; void main() { outColor = vec4(gl_FragCoord.xy / uMapSize, uK, 1.0); }';
  const a = glslFunctions(src, { gl_FragCoord: [8, 4, 0, 1], uMapSize: [16, 16], uK: 0.5 });
  a.main();
  assert.deepEqual(a.globals.outColor, [0.5, 0.25, 0.5, 1]);
  const b = glslFunctions(src, { uMapSize: [16, 16], uK: 0 });
  b.globals.gl_FragCoord = [4, 8, 0, 1];   // set before main() first compiles, and kept
  b.main();
  assert.deepEqual(b.globals.outColor, [0.25, 0.5, 0, 1]);
});

test('swizzles: read, write, compound write, repeated read', () => {
  const fns = glslFunctions(`
vec3 read(vec4 v) { return v.xzw + v.rgb.bgr; }
vec4 write(vec4 v) { v.xz += vec2(10.0, 20.0); v.y = 7.0; v.wx = v.xw; return v; }
vec3 rep(vec2 p) { return vec3(p.xyx); }
float one(vec4 c) { return c.w + c.q; }`);
  assert.deepEqual(fns.read([1, 2, 3, 4]), [1 + 3, 3 + 2, 4 + 1]);
  // xz += (10,20) -> (11,2,23,4); y = 7 -> (11,7,23,4); wx = xw -> w = 11, x = 4
  assert.deepEqual(fns.write([1, 2, 3, 4]), [4, 7, 23, 11]);
  assert.deepEqual(fns.rep([5, 6]), [5, 6, 5]);
  assert.equal(fns.one([0, 0, 0, 2]), 4);
});

test('broadcast, constructors and conversions', () => {
  const fns = glslFunctions(`
vec3 bc(vec3 a, float s) { return a * s + 1.0 - s / a; }
vec4 mk(vec2 v) { return vec4(v.xy, 0.0, 1.0); }
vec3 splat() { return vec3(2.5); }
vec4 mixed(vec3 a) { return vec4(1.0, a.yz, float(3)); }
int toI(float x) { return int(x); }
uint toU(int x) { return uint(x); }
float toF(bool b) { return float(b) + float(7u); }
ivec2 iv(vec2 v) { return ivec2(v); }`);
  // (2,4,8)*2 + 1 - 2/(2,4,8) = (4+1-1, 8+1-0.5, 16+1-0.25)
  assert.deepEqual(fns.bc([2, 4, 8], 2), [4, 8.5, 16.75]);
  assert.deepEqual(fns.mk([3, 4]), [3, 4, 0, 1]);
  assert.deepEqual(fns.splat(), [2.5, 2.5, 2.5]);
  assert.deepEqual(fns.mixed([9, 8, 7]), [1, 8, 7, 3]);
  assert.equal(fns.toI(-2.7), -2);             // truncates toward zero
  assert.equal(fns.toU(-1), 4294967295);       // int -> uint keeps the bits
  assert.equal(fns.toF(true), 8);
  assert.deepEqual(fns.iv([1.9, -1.9]), [1, -1]);
});

test('int arithmetic is 32-bit signed and / truncates', () => {
  const fns = glslFunctions(`
int div(int a, int b) { return a / b; }
int rem(int a, int b) { return a % b; }
int wrap(int a) { return a + 1; }
int mul(int a, int b) { return a * b; }
int bits(int a) { return (a << 4) | (a >> 1) ^ ~a & 255; }`);
  assert.equal(fns.div(7, 2), 3);
  assert.equal(fns.div(-7, 2), -3);
  assert.equal(fns.rem(7, 3), 1);
  assert.equal(fns.wrap(2147483647), -2147483648);
  assert.equal(fns.mul(65536, 65536), 0);
  // precedence: (a<<4) | ((a>>1) ^ (~a & 255)); a = 6: 96 | (3 ^ 249) = 96 | 250 = 250
  assert.equal(fns.bits(6), 250);
});

test('uint wraps like the GPU: a PCG hash against BigInt arithmetic', () => {
  const fns = glslFunctions(`
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
uint sub(uint a, uint b) { return a - b; }
uint lit() { return 0x7fffffffu + 1u; }
uint mask(uint a) { return ~a & 0xffu; }`);
  const M = 2n ** 32n;
  const pcg = (v) => {
    const state = (BigInt(v) * 747796405n + 2891336453n) % M;
    const word = (((state >> ((state >> 28n) + 4n)) ^ state) * 277803737n) % M;
    return Number((word >> 22n) ^ word);
  };
  for (const v of [0, 1, 12345, 4294967295, 2654435769]) assert.equal(fns.pcg(v), pcg(v), `pcg(${v})`);
  assert.equal(fns.sub(0, 1), 4294967295);
  assert.equal(fns.lit(), 2147483648);
  assert.equal(fns.mask(0xf0), 0x0f);
});

test('float literals: 1., .5, 1e-3, 2.5e2', () => {
  const fns = glslFunctions('float f() { return 1. + .5 + 1e-3 + 2.5e2; }');
  near(fns.f(), 251.501, 1e-12);
});

test('operator precedence and ternary', () => {
  const fns = glslFunctions(`
float p(float a) { return 1.0 + 2.0 * a - 6.0 / 3.0 * -a; }
bool b(float x) { return x > 1.0 && x < 3.0 || x == 10.0; }
float t(float x) { return x < 0.0 ? -1.0 : x > 0.0 ? 1.0 : 0.0; }
bool n(bool x) { return !x; }`);
  assert.equal(fns.p(3), 1 + 6 + 6);
  assert.deepEqual([0, 2, 5, 10].map((x) => fns.b(x)), [false, true, false, true]);
  assert.deepEqual([-4, 0, 9].map((x) => fns.t(x)), [-1, 0, 1]);
  assert.equal(fns.n(false), true);
});

test('compound assignment, ++ and --', () => {
  const fns = glslFunctions(`
float c(float x) { x += 2.0; x *= 3.0; x -= 1.0; x /= 2.0; return x; }
int u(int i) { int a = i++; int b = ++i; i--; return a * 100 + b * 10 + i; }
uint s(uint v) { v <<= 3u; v |= 1u; v ^= 2u; v >>= 1u; v &= 7u; return v; }
vec2 v(vec2 a) { a *= 2.0; a += vec2(1.0, 2.0); a++; return a; }`);
  assert.equal(fns.c(1), 4);   // ((1+2)*3 - 1) / 2
  // i=1: a=1, i=2; b=++i=3; i-- -> 2
  assert.equal(fns.u(1), 132);
  // 5<<3 = 40; |1 = 41; ^2 = 43; >>1 = 21; &7 = 5
  assert.equal(fns.s(5), 5);
  assert.deepEqual(fns.v([1, 1]), [4, 5]);
});

test('loops with break and continue; while and do-while', () => {
  const fns = glslFunctions(`
int sumOdd(int n) {
  int s = 0;
  for (int i = 0; i < 100; i++) {
    if (i >= n) break;
    if (i % 2 == 0) continue;
    s += i;
  }
  return s;
}
int nested() { int c = 0; for (int i = 0; i < 3; i++) for (int j = 0; j < 3; j++) { if (j == i) continue; c++; } return c; }
int w(int n) { int k = 0; while (n > 1) { n /= 2; k++; } return k; }
int d() { int k = 0; do { k++; } while (false); return k; }
float early(float x) { for (int i = 0; i < 10; i++) { if (float(i) > x) return float(i); } return -1.0; }`);
  assert.equal(fns.sumOdd(8), 1 + 3 + 5 + 7);
  assert.equal(fns.nested(), 6);
  assert.equal(fns.w(40), 5);
  assert.equal(fns.d(), 1);
  assert.equal(fns.early(3.5), 4);
  assert.equal(fns.early(20), -1);
});

test('out and inout parameters write back to variables, swizzles, array elements', () => {
  const fns = glslFunctions(`
void split(vec3 v, out float a, out vec2 b) { a = v.x; b = v.yz; }
void bump(inout float x) { x += 1.0; }
vec4 caller(vec3 v) {
  float a; vec2 b;
  split(v, a, b);
  bump(a);
  vec4 r = vec4(0.0);
  split(v, r.w, r.xy);
  float arr[2] = float[2](10.0, 20.0);
  bump(arr[1]);
  return vec4(a + b.x + b.y, r.x + r.y + r.w, arr[1], 0.0);
}`);
  // v = (1,2,3): a = 1+1, b = (2,3) -> 7; r.w = 1, r.xy = (2,3) -> 6; arr[1] = 21
  assert.deepEqual(fns.caller([1, 2, 3]), [7, 6, 21, 0]);
  const a = {}, b = {};
  fns.split([4, 5, 6], a, b);
  assert.deepEqual([a.value, b.value], [4, [5, 6]]);
  const x = { value: 1.5 };
  fns.bump(x);
  assert.equal(x.value, 2.5);
});

test('vector math built-ins', () => {
  const fns = glslFunctions(`
float l(vec3 v) { return length(v); }
float d(vec2 a, vec2 b) { return distance(a, b) + dot(a, b); }
vec3 c(vec3 a, vec3 b) { return cross(a, b); }
vec3 n(vec3 v) { return normalize(v); }
vec3 r(vec3 i, vec3 nn) { return reflect(i, nn); }
vec3 cw(vec3 v) { return clamp(v, 0.0, 1.0) + step(0.5, v) + abs(v) + floor(v) + fract(v); }
vec3 mx(vec3 a, vec3 b) { return mix(a, b, 0.25) + mix(a, b, vec3(0.0, 1.0, 0.5)); }
float mo(float x) { return mod(x, 3.0); }
float ss(float x) { return smoothstep(0.0, 2.0, x); }
float at(float y, float x) { return atan(y, x) + atan(1.0); }
vec2 mm(vec2 a) { return min(a, 1.0) + max(a, vec2(2.0, 0.0)); }
float pw() { return pow(2.0, 10.0) + exp2(3.0) + log2(8.0) + inversesqrt(4.0) + sqrt(9.0); }`);
  assert.equal(fns.l([3, 4, 12]), 13);
  assert.equal(fns.d([0, 0], [3, 4]), 5);
  assert.deepEqual(fns.c([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  near(fns.n([0, 3, 4]), [0, 0.6, 0.8]);
  assert.deepEqual(fns.r([1, -1, 0], [0, 1, 0]), [1, 1, 0]);
  // v = (-0.5, 0.75, 2): clamp (0, .75, 1) + step (0, 1, 1) + abs (.5, .75, 2) + floor (-1, 0, 2) + fract (.5, .75, 0)
  assert.deepEqual(fns.cw([-0.5, 0.75, 2]), [0, 3.25, 6]);
  // a = (0,0,0), b = (4,8,12): 0.25 mix (1,2,3) + component mix (0,8,6)
  assert.deepEqual(fns.mx([0, 0, 0], [4, 8, 12]), [1, 10, 9]);
  assert.equal(fns.mo(-1), 2);   // x - y * floor(x / y), not JS's %
  assert.equal(fns.ss(1), 0.5);
  near(fns.at(1, 0), Math.PI / 2 + Math.PI / 4);
  assert.deepEqual(fns.mm([0.5, 3]), [0.5 + 2, 1 + 3]);
  assert.equal(fns.pw(), 1024 + 8 + 3 + 0.5 + 3);
});

test('mat3: constructors, mat*vec is column-major, vec*mat, mat*mat, columns', () => {
  const fns = glslFunctions(`
vec3 mv(vec3 v) { mat3 m = mat3(1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0); return m * v; }
vec3 vm(vec3 v) { mat3 m = mat3(1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0); return v * m; }
vec3 cols(vec3 a, vec3 b, vec3 c) { mat3 m = mat3(a, b, c); return m[1] + vec3(m[2][0]); }
vec3 id(vec3 v) { return mat3(1.0) * v; }
vec3 mm(vec3 v) { mat3 a = mat3(2.0); mat3 b = mat3(0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0); return (a * b) * v; }
uniform mat3 uRot;
vec3 rot(vec3 v) { return uRot * v; }`, { uRot: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]] });
  assert.deepEqual(fns.mv([1, 0, 0]), [1, 2, 3]);     // the first column
  assert.deepEqual(fns.mv([0, 1, 0]), [4, 5, 6]);
  assert.deepEqual(fns.vm([1, 0, 0]), [1, 4, 7]);     // v dotted with each column
  assert.deepEqual(fns.cols([1, 2, 3], [4, 5, 6], [7, 8, 9]), [11, 12, 13]);
  assert.deepEqual(fns.id([5, 6, 7]), [5, 6, 7]);
  assert.deepEqual(fns.mm([1, 2, 3]), [4, 2, 6]);     // swap x and y, then double
  assert.deepEqual(fns.rot([1, 0, 0]), [0, 1, 0]);    // columns given as arrays: x turns to y
});

test('const globals, bindings overriding them, uniform arrays of vectors', () => {
  const src = `
const float PI = 3.14159265;
const float TAU = PI * 2.0;
const int N = 3;
uniform vec4 uCell[N];
uniform int uCount;
float tau() { return TAU; }
float sumZ() { float s = 0.0; for (int i = 0; i < N; i++) { if (i >= uCount) break; s += uCell[i].z; } return s; }`;
  const cells = [[0, 0, 1, 0], [0, 0, 10, 0], [0, 0, 100, 0]];
  const fns = glslFunctions(src, { uCell: cells, uCount: 2 });
  near(fns.tau(), 6.2831853);
  assert.equal(fns.sumZ(), 11);
  assert.equal(glslFunctions(src, { uCell: cells, uCount: 3, TAU: 1 }).tau(), 1);
  assert.throws(() => glslFunctions(src, { uCell: cells.slice(0, 2) }), /uCell must be a vec4\[3\]/);
});

test('mutable globals persist between calls and are readable after them', () => {
  const fns = glslFunctions(`
float fSkip;
float fReach = 0.0;
float fA = 1.0, fB = 2.0;
vec3 fTint;
void touch(float x) { fSkip = x * 2.0; fReach += 1.0; fTint = vec3(x); fA = fB; }
float read() { return fSkip + fReach; }`);
  assert.equal(fns.globals.fSkip, 0);
  fns.touch(3);
  fns.touch(4);
  assert.equal(fns.globals.fSkip, 8);
  assert.equal(fns.globals.fReach, 2);
  assert.deepEqual(fns.globals.fTint, [4, 4, 4]);
  assert.equal(fns.globals.fA, 2);
  assert.equal(fns.read(), 10);
  fns.globals.fReach = 100;   // a test can set state directly
  assert.equal(fns.read(), 108);
});

test('a function calls another, including one defined after it through a prototype', () => {
  const fns = glslFunctions(`
float sq(float x);
float hyp(float a, float b) { return sqrt(sq(a) + sq(b)); }
float sq(float x) { return x * x; }
void noop() { return; }`);
  assert.equal(fns.hyp(3, 4), 5);
  assert.equal(fns.noop(), undefined);
});

test('local arrays, .length(), float bits, bool vectors', () => {
  const fns = glslFunctions(`
float bayer(int i) { float m[4] = float[4](0.0, 8.0, 2.0, 10.0); return m[i] / 16.0 + float(m.length()); }
uint fb(float x) { return floatBitsToUint(x); }
float ub(uint x) { return uintBitsToFloat(x); }
bool anyLess(vec3 a, vec3 b) { return any(lessThan(a, b)); }
bool allLess(vec3 a, vec3 b) { return all(lessThan(a, b)); }`);
  assert.equal(fns.bayer(3), 10 / 16 + 4);
  assert.throws(() => fns.bayer(4), RangeError);
  assert.equal(fns.fb(1), 0x3f800000);
  assert.equal(fns.fb(-2), 0xc0000000);
  assert.equal(fns.ub(0x40490fdb), Math.fround(Math.PI));
  assert.equal(fns.anyLess([1, 5, 5], [2, 0, 0]), true);
  assert.equal(fns.allLess([1, 5, 5], [2, 0, 0]), false);
});

test('texture built-ins go to the bindings, with the sampler by name', () => {
  const calls = [];
  const src = `
uniform sampler3D uShape;
uniform sampler2D uDepth;
float sample(vec3 q) { return textureLod(uShape, q, 1.0).g + texture(uDepth, q.xy).r; }`;
  const fns = glslFunctions(src, {
    textureLod: (s, c, lod) => { calls.push([s, c, lod]); return [0, c[0] + lod, 0, 1]; },
    texture: (s, c) => { calls.push([s, c]); return [c[1], 0, 0, 1]; },
  });
  assert.equal(fns.sample([2, 3, 4]), 3 + 3);
  assert.deepEqual(calls, [['uShape', [2, 3, 4], 1], ['uDepth', [2, 3]]]);
  assert.throws(() => glslFunctions(src).sample([0, 0, 0]), /bindings\.textureLod is not a function/);
});

test('discard throws GlslDiscard', () => {
  const fns = glslFunctions('float f(float a) { if (a < 0.5) discard; return a; }');
  assert.equal(fns.f(1), 1);
  assert.throws(() => fns.f(0), GlslDiscard);
});

test('fp32 rounds every float result; the default is float64', () => {
  const src = 'float f(float a, float b) { return a + b; } vec2 g(vec2 v) { return v * 3.0; }';
  assert.equal(glslFunctions(src).f(0.1, 0.2), 0.1 + 0.2);
  const f32 = glslFunctions(src, {}, { fp32: true });
  assert.equal(f32.f(0.1, 0.2), Math.fround(Math.fround(0.1) + Math.fround(0.2)));
  assert.deepEqual(f32.g([0.1, 1 / 3]), [Math.fround(Math.fround(0.1) * 3), Math.fround(Math.fround(1 / 3) * 3)]);
});

test('errors: duplicate names, type errors GLSL would reject, bad arguments', () => {
  assert.throws(() => glslFunctions('float f() { return 1.0; } float f() { return 2.0; }'), /defined twice/);
  assert.throws(() => glslFunctions('float f() { float x = 1; return x; }').f(), /cannot initialize float x with a int/);
  assert.throws(() => glslFunctions('float f(vec2 v) { return v * 2; }').f([1, 2]), /cannot combine vec2 and int/);
  assert.throws(() => glslFunctions('float f() { return q; }').f(), /'q' is not declared/);
  assert.throws(() => glslFunctions('uniform float u; void f() { u = 1.0; }').f(), /read-only/);
  assert.throws(() => glslFunctions('float f(vec3 v) { return v.x; }').f([1, 2]), /must be a vec3/);
  assert.throws(() => glslFunctions('#define X 1\nfloat f() { return 1.0; }'), /#define is not supported/);
  assert.throws(() => glslFunctions('struct S { float a; };'), /struct is not supported/);
});
