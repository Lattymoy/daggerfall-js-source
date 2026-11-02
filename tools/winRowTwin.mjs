// AUDIT LIGHT-REACH R2 (2026-10-30): THE SHADER'S ROW WALK AGAINST ITS TWIN. Compiles windowLightGlsl's winRow in
// headless Chromium (WebGL2 over SwiftShader) and sums every row's light at 4096 points - real rows off the pass's own
// _cellTiles/_rowRecord on a turned front, lit, dark and curtained tiles - against windowRowAt, by an all-glass mask (exact)
// and a ramp (the u/v lookup, judged where no read is in the border band a mip's filter clamps), at the origin and 3 km
// out. Exits 1 on a compile error or a point off by more than 2%.
// test/render/audit_lightreach.test.js holds winRow's text to what this proved: a change runs this, then moves that pin.
//
// Usage: node tools/winRowTwin.mjs    (CHROMIUM names a browser to launch)
import { chromium } from 'playwright';
import {
  WindowLightPass,
  windowAperturesOf,
  windowRowAt,
  windowLightGlsl,
  WL_VEC4,
  WL_FAR_MAX,
  WL_MAX_LIGHTS,
  WL_KIND,
} from '../src/render/windowLight.js';
import { identity } from '../src/world/mat4.js';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const fakeGl = () =>
  new Proxy({}, { get: (o, k) => (typeof k === 'string' && k.toUpperCase() === k ? k : () => ({})) });
const atten = (d, r) => {
  const a = Math.max(0, Math.min(1, 1 - d / r));
  return a * a;
};
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The rows of a 14-tile, two-storey front turned by `yaw` and moved to `at` - and the placement's transform. */
function rowsAt(at, yaw) {
  const pass = new WindowLightPass(fakeGl(), { activeTexture: () => {} });
  pass.addMask('m', { width: 16, height: 16, colors: new Uint8ClampedArray(16 * 16 * 4).fill(255) });
  const mask = pass.masks.get('m'),
    P = [],
    N = [],
    UV = [];
  mask.layer = 0;
  for (const [a, b] of [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]) {
    P.push(-17.5 + 35 * a, 6 * b, -10);
    N.push(0, 0, 1);
    UV.push(14 * a, 2 * b);
  }
  const set = windowAperturesOf(
    new Float32Array(P),
    new Float32Array(N),
    new Float32Array(UV),
    new Uint32Array([0, 1, 2, 0, 2, 3]),
    0,
    6,
  );
  const sub = { key: 'm', ap: set.recs, cells: set.cells },
    m = identity(),
    c = Math.cos(yaw),
    s = Math.sin(yaw);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  m[12] = at[0];
  m[13] = at[1];
  m[14] = at[2];
  const pl = { m: Float32Array.from(m), remap: null, seen: 0, subs: null },
    recs = [];
  for (let ci = 0; ci < sub.cells.length / 6; ci++) {
    const t = pass._cellTiles(pl, sub, ci);
    for (const row of t.rows)
      if (row.lit && pass._rowRecord({ row, s: pl, sub, ci, t, mask })) {
        const r = Float32Array.from(row.rec);
        r[23] = 256 * WL_KIND.row;
        recs.push(r);
      }
  }
  return { recs, xf: (x, y, z) => [m[0] * x + m[8] * z + m[12], y + m[13], m[2] * x + m[10] * z + m[14]] };
}

const FS = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DArray; precision highp usampler2D;
${windowLightGlsl({ atten: 'wlTwinAtten(rl, r)', clusters: true }).replace('vec3 winRow(', 'float wlTwinAtten(float d, float r) { float a = clamp(1.0 - d / r, 0.0, 1.0); return a * a; }\nvec3 winRow(')}
uniform highp sampler2D uPts;
uniform int uRows;
out vec4 o;
void main() {
  int i = int(gl_FragCoord.x) + int(gl_FragCoord.y) * 64;
  vec3 wp = texelFetch(uPts, ivec2(2 * (i % 32), i / 32), 0).xyz, n = texelFetch(uPts, ivec2(2 * (i % 32) + 1, i / 32), 0).xyz;
  vec3 acc = vec3(0.0);
  for (int r = 0; r < 64; r++) { if (r >= uRows) break; acc += winRow(r, wp, n, 0.0); }
  o = vec4(acc, 0.0);
}`;

/** The shader's sums at the case's points, read back as floats. */
const shade = (page, d) =>
  page.evaluate(
    ({ FS, d, nearLen, farLen, farAt }) => {
      const cv = document.createElement('canvas'),
        gl = cv.getContext('webgl2');
      if (!gl.getExtension('EXT_color_buffer_float')) return { err: 'no float target' };
      const sh = (t, s) => {
        const x = gl.createShader(t);
        gl.shaderSource(x, s);
        gl.compileShader(x);
        return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : gl.getShaderInfoLog(x);
      };
      const vs = sh(
          gl.VERTEX_SHADER,
          '#version 300 es\nvoid main() { vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0); }',
        ),
        fs = sh(gl.FRAGMENT_SHADER, FS);
      if (typeof fs === 'string') return { err: fs };
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return { err: gl.getProgramInfoLog(p) };
      gl.useProgram(p);
      const ub = (name, bind, data) => {
        const bi = gl.getUniformBlockIndex(p, name);
        if (bi !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, bi, bind);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, b);
        gl.bufferData(gl.UNIFORM_BUFFER, data, gl.STATIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, bind, b);
      };
      const far = new Float32Array(farLen);
      d.recs.forEach((r, i) => far.set(r, i * 28));
      far.set(d.frame, farAt);
      ub('WinLights', 3, new Float32Array(nearLen));
      ub('WinFar', 4, far);
      const tex = (unit, target, fill) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        const t = gl.createTexture();
        gl.bindTexture(target, t);
        fill();
        gl.texParameteri(
          target,
          gl.TEXTURE_MIN_FILTER,
          target === gl.TEXTURE_2D_ARRAY ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST,
        );
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, target === gl.TEXTURE_2D_ARRAY ? gl.LINEAR : gl.NEAREST);
      };
      tex(1, gl.TEXTURE_2D, () =>
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 64, 128, 0, gl.RGBA, gl.FLOAT, new Float32Array(d.pts)),
      );
      gl.uniform1i(gl.getUniformLocation(p, 'uPts'), 1);
      tex(2, gl.TEXTURE_2D_ARRAY, () => {
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 8, gl.R8, 128, 128, 1);
        const bytes = new Uint8Array(128 * 128);
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 128; x++)
            bytes[y * 128 + x] = d.ramp
              ? Math.round(255 * (0.2 + (0.3 * (x + 0.5)) / 128 + (0.5 * (y + 0.5)) / 128))
              : 255;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 128, 128, 1, gl.RED, gl.UNSIGNED_BYTE, bytes);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      });
      gl.uniform1i(gl.getUniformLocation(p, 'uWinMask'), 2);
      for (const [name, unit, f, fmt, type] of [
        ['uClusterGrid', 3, gl.RG16UI, gl.RG_INTEGER, gl.UNSIGNED_SHORT],
        ['uClusterList', 4, gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE],
      ]) {
        tex(unit, gl.TEXTURE_2D, () => gl.texImage2D(gl.TEXTURE_2D, 0, f, 1, 1, 0, fmt, type, null));
        const loc = gl.getUniformLocation(p, name);
        if (loc) gl.uniform1i(loc, unit);
      }
      gl.uniform1i(gl.getUniformLocation(p, 'uRows'), d.recs.length);
      const fb = gl.createFramebuffer();
      tex(5, gl.TEXTURE_2D, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 64, 64, 0, gl.RGBA, gl.FLOAT, null));
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        gl.getParameter(gl.TEXTURE_BINDING_2D),
        0,
      );
      gl.viewport(0, 0, 64, 64);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const out = new Float32Array(64 * 64 * 4);
      gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.FLOAT, out);
      return { got: Array.from(out).filter((_, k) => k % 4 === 0), glError: gl.getError() };
    },
    {
      FS,
      d,
      nearLen: WL_MAX_LIGHTS * WL_VEC4 * 4,
      farLen: (WL_FAR_MAX * WL_VEC4 + 2) * 4,
      farAt: WL_FAR_MAX * WL_VEC4 * 4,
    },
  );

const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
let bad = 0;
for (const [name, at, yaw, ramp] of [
  ['origin, glass', [0, 0, 0], 0.7, false],
  ['origin, ramp', [0, 0, 0], 0.7, true],
  ['3 km out, glass', [3000, 40, -2500], -2.2, false],
  ['3 km out, ramp', [3000, 40, -2500], -2.2, true],
]) {
  const { recs, xf } = rowsAt(at, yaw),
    R = rng(17),
    eye = xf(3, 1.7, 30),
    frame = [...eye, 45, 1.1, 0.9, 0.6, 48];
  let edge = false;
  const maskAt = ramp
    ? (u, v) => {
        if (u < 0.05 || u > 0.95 || v < 0.05 || v > 0.95) edge = true;
        return 0.2 + 0.3 * u + 0.5 * v;
      }
    : () => 1;
  const pts = new Float32Array(4096 * 8),
    want = [],
    border = [];
  for (let i = 0; i < 4096; i++) {
    pts.set(
      [...xf((R() - 0.5) * 40, R() * 3, 0.05 + R() * 11 - 10), 1, ...norm([R() - 0.5, 0.2 + R(), R() - 0.5]), 0],
      i * 8,
    );
    const wp = [pts[i * 8], pts[i * 8 + 1], pts[i * 8 + 2]],
      n = [pts[i * 8 + 4], pts[i * 8 + 5], pts[i * 8 + 6]];
    edge = false;
    want.push(recs.reduce((s, r) => s + windowRowAt(r, frame, wp, n, maskAt, atten)[0], 0));
    border.push(edge);
  }
  const r = await shade(page, { recs: recs.map((x) => Array.from(x)), frame, pts: Array.from(pts), ramp });
  if (r.err) {
    bad++;
    console.error(`${name}: ${r.err}`);
    continue;
  }
  let off = 0,
    lit = 0;
  for (let i = 0; i < 4096; i++) {
    if (border[i]) continue;
    if (r.got[i] > 0 || want[i] > 0) lit++;
    if (Math.abs(r.got[i] - want[i]) > Math.max(1e-3, 0.02 * Math.max(r.got[i], want[i]))) off++;
  }
  if (off || lit < 500 || r.glError) bad++;
  console.log(`${name}: ${recs.length} rows, ${lit} lit points, ${off} off by more than 2%, GL error ${r.glError}`);
}
await browser.close();
if (bad) {
  console.error(`FAIL - ${bad} case(s): winRow is not its twin`);
  process.exit(1);
}
console.log('winRow is windowRowAt');
