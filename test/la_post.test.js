// LA-POST (2026-09-27, Mac: "a deep audit on the enhanced lighting system, look for flickering issues, performance
// improvements and just a complete detailed overhaul to make this insanely better") - THE POST CHAIN, AUDITED.
// render/airPass.js's screen-space passes, each fix pinned where it can be run: the shaders' own text through the
// GLSL evaluator (test/glsl.mjs) against synthetic frames and depths, the JS mirrors of what the shaders keep, and the
// lifecycle on a fake GL.
//   1. the bright pass reads the whole 4x4 block, each quarter thresholded before the average;
//   2. the lantern glare: thirteen soft, filtered taps, a soft veto, a size held against the 14 Hz flicker;
//   3. the bloom and the shafts in half floats where the GL renders them, held at 1 as the bytes were;
//   4. the eye in sixteen bits, and each luminance tap's log held to the encoded range;
//   5. the AO blur's depth window a share of the distance;
//   6. the contact march: the surface's own tolerance, a soft claim, one projection a march, the recentre rebased, cuts;
//   7. the renderer's glow gate asks whether the glow's shader built;
//   8. the frame's two framebuffers, no clear of an image nothing reads, no bloom for a frame that is not the world's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions } from './glsl.mjs';
import {
  AirPass, AIR_BRIGHT_TAPS, AIR_BRIGHT_THRESHOLD, AIR_GLARE_TAPS, AIR_GLARE_SLACK, AIR_GLARE_HOLD_BAND, heldGlareRange, glareKey, glareSize,
  packAdapt, unpackAdapt, adaptStepStored, lumTapLog, AIR_ADAPT_STEPS, AIR_ADAPT_LOG_RANGE, AIR_LUM_LOG_RANGE, AIR_ADAPT_MIN, AIR_ADAPT_MAX, packLog, unpackLog,
  AIR_AO_BLUR_SHARE, AIR_AO_RADIUS, AIR_AO_STORE, AIR_CONTACT_GLSL, AIR_CONTACT_SELF, AIR_CONTACT_SLOPE_MAX, AIR_CONTACT_RAMP, AIR_CONTACT_CUT, AIR_CONTACT_LENGTH,
  AIR_CONTACT_THICKNESS, AIR_CONTACT_FLOOR, AIR_CONTACT_STEPS, projInfo,
} from '../src/render/airPass.js';
import { Renderer, WORLD_FRAME } from '../src/render/renderer.js';
import { EL_LANE } from '../src/render/enhancedLighting.js';
import { perspective, lookAt, multiply } from '../src/world/mat4.js';
import { CityLightAnimator } from '../src/world/worldClock.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A GL that compiles nothing and records every call; `float` answers EXT_color_buffer_float. */
function fakeGl({ float = false } = {}) {
  const calls = [];
  let ids = 0;
  const consts = { TEXTURE0: 1000, TEXTURE1: 1001, TEXTURE2: 1002, TEXTURE3: 1003, TEXTURE4: 1004, FRAMEBUFFER: 36160, DEPTH_ATTACHMENT: 36096, COLOR_ATTACHMENT0: 36064,
    COLOR_BUFFER_BIT: 16384, DEPTH_BUFFER_BIT: 256, RGBA16F: 34842, HALF_FLOAT: 5131, RGBA8: 32856, RGBA: 6408, UNSIGNED_BYTE: 5121, FLOAT: 5126, TRIANGLE_STRIP: 5 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (k in consts) return consts[k];
      if (k === 'getExtension') return (n) => (float && n === 'EXT_color_buffer_float' ? {} : null);
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (k === 'getParameter') return () => new Float32Array(4);
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...args) => { calls.push([k, ...args.map((a) => (ArrayBuffer.isView(a) ? Array.from(a) : a))]); };
    },
  });
  return { gl, calls };
}
/** The pass on the fake GL, every program keeping its own source ({ vs, fs } for its `p`). */
function pass(opts = {}) {
  const { gl, calls } = fakeGl(opts);
  const ap = new AirPass(gl, { build: (vs, fs) => ({ vs, fs }), vs: { mesh: 'MESH_VS', bb: 'BB_VS' } });
  return { ap, gl, calls };
}
/** A recording GL for the whole renderer (a canvas of 320 x 200). */
function rendererGl() {
  const { gl, calls } = fakeGl();
  const canvas = { getContext: () => gl, clientWidth: 320, clientHeight: 200, width: 320, height: 200 };
  return { gl, calls, canvas };
}
/** A W x H image's bilinear read at a uv, CLAMP_TO_EDGE - as a GPU filters an RGBA8 texture (in its stored values). */
function bilinear(W, H, at) {
  return (uv) => {
    const x = uv[0] * W - 0.5, y = uv[1] * H - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const px = (i, j) => at(Math.min(Math.max(i, 0), W - 1), Math.min(Math.max(j, 0), H - 1));
    const a = px(x0, y0), b = px(x0 + 1, y0), c = px(x0, y0 + 1), d = px(x0 + 1, y0 + 1);
    return [0, 1, 2, 3].map((k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fy) + (c[k] * (1 - fx) + d[k] * fx) * fy);
  };
}
/** The NDC depth (0..1) a planar view distance is stored as under a projection's terms - viewDist's inverse. */
const depth01 = (dist, pi) => ((pi[3] / dist - pi[2]) + 1) / 2;
const viewDistJs = (d01, pi) => pi[3] / (d01 * 2 - 1 + pi[2]);

// ═══ 1. THE BRIGHT PASS ══════════════════════════════════════════════════════════════════════════════════════════
test('LA-POST1: the bright pass reads its whole 4x4 block - four bilinear reads at the inner corners, every pixel once at a sixteenth (the old one read the middle four) - and thresholds each quarter before the average, so a 3x3 flame blooms the same at all sixteen places in a block where the old read bloomed it whole at four and not at all at twelve; the glow still blooms (mutants: one read at the centre; the threshold after the average; the taps half a pixel out; the glow dropped)', () => {
  // the footprint, in JS: a bloom texel's centre is the corner (2, 2) of its block; a bilinear read at a pixel corner
  // (cx, cy) weighs the four pixels about it a quarter each
  const footprint = (taps) => {
    const w = new Map();
    for (const [dx, dy] of taps) {
      const cx = 2 + dx, cy = 2 + dy;
      for (const [i, j] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) w.set(`${i},${j}`, (w.get(`${i},${j}`) ?? 0) + 0.25 / taps.length);
    }
    return w;
  };
  const now = footprint(AIR_BRIGHT_TAPS);
  assert.equal(now.size, 16, 'the four reads reach sixteen pixels');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) assert.equal(now.get(`${i},${j}`), 1 / 16, `pixel ${i},${j} of the block, once, a sixteenth`);
  const old = footprint([[0, 0]]);
  assert.deepEqual([...old.keys()].sort(), ['1,1', '1,2', '2,1', '2,2'], 'the old single read: the middle four pixels, twelve never read');
  // the shader itself, run on a 16 x 16 frame (a 4 x 4 bloom image) through bilinear reads of the stored bytes
  const { ap } = pass();
  const fs1 = ap.programs.bright[1].p.fs, fs0 = ap.programs.bright[0].p.fs;
  assert.equal(fs0, fs1.replace(' + airDecode(texture(uVol, vUV).rgb)', ''), 'PERF-EXT31: the variant without the glow is the full pass less that read');
  const W = 16, H = 16;
  const run = (src, frameAt, volAt = () => [0, 0, 0, 1]) => {
    const tex = bilinear(W, H, frameAt);
    const f = glslFunctions(src, { uRect: [0, 0, W, H], uCanvas: [W, H], uThreshold: AIR_BRIGHT_THRESHOLD, uBloomSize: [4, 4], vUV: [0, 0], gl_FragCoord: [0.5, 0.5, 0.5, 1],
      texture: (name, uv) => (name === 'uFrame' ? tex(uv) : volAt(uv)) }, { fp32: true });
    let energy = 0;
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        f.globals.vUV = [(i + 0.5) / 4, (j + 0.5) / 4];
        f.globals.gl_FragCoord = [i + 0.5, j + 0.5, 0.5, 1];   // LA-AUDIT B3: the block is placed by the texel's own
        f.main();
        energy += f.globals.outColor[0];
      }
    }
    return energy;
  };
  // "the base": the pass as it stood - one read at the texel's centre, thresholded
  const OLD = fs0.slice(0, fs0.indexOf('// LA-POST1: one quarter')) + `void main() {
  vec2 uv = (uRect.xy + vUV * uRect.zw) / uCanvas;
  vec3 c = airDecode(texture(uFrame, uv).rgb);
  float k = smoothstep(uThreshold, 1.0, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  outColor = vec4(c * k, 1.0);
}`;
  const flame = (ox, oy) => (x, y) => (x >= 4 + ox && x < 7 + ox && y >= 4 + oy && y < 7 + oy ? [1, 1, 1, 1] : [0, 0, 0, 1]);
  const nowE = [], oldE = [];
  for (let oy = 0; oy < 4; oy++) for (let ox = 0; ox < 4; ox++) { nowE.push(run(fs0, flame(ox, oy))); oldE.push(run(OLD, flame(ox, oy))); }
  for (const e of nowE) assert.ok(Math.abs(e - 0.25) < 1e-6, `a 3x3 flame's bloom energy is a quarter of its block's at every place (${e})`);
  assert.deepEqual(oldE.map((e) => Math.round(e * 1e6) / 1e6).sort(), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1], 'the base: whole at four places of sixteen, nothing at the rest - the pop');
  // a big bright field blooms as before: the four quarters of a lit block are the old read's average
  const lit = () => [1, 1, 1, 1];
  assert.ok(Math.abs(run(fs0, lit) - run(OLD, lit)) < 1e-6, 'a lit field: the same bloom');
  // the glow joins every quarter before its threshold: a black frame under a bright glow blooms, and the variant without the read does not
  assert.ok(Math.abs(run(fs1, () => [0, 0, 0, 1], () => [1, 1, 1, 1]) - 16) < 1e-4, 'the glow\'s core blooms (VOL1)');
  assert.equal(run(fs0, () => [0, 0, 0, 1], () => [1, 1, 1, 1]), 0, 'the pass built without the glow reads none');
});

// ═══ 2. THE LANTERN GLARE ════════════════════════════════════════════════════════════════════════════════════════
/** The glare's scene on a 320 x 200 canvas: a flame flat at view distance D (x in [-hw, hw], y in [-1, 0] - the light
 *  at its top, a city light's), a wall 20 behind it, and `beam` (a surface one unit nearer, over x in [beam[0],
 *  beam[1]] and y in [-0.2, 0.2], or null) - the eye at (tx, ty, 0) looking down -z, the light at (lx, 0, -D). */
function glareScene({ tx = 0, ty = 0, D = 10, hw = 0.25, beam = null, flatOff = 0 }) {
  const W = 320, H = 200, proj = perspective(Math.PI / 3, W / H, 0.2, 6000), pi = projInfo(proj);
  const F = D + flatOff;   // the flat's own distance (the light's is D)
  const at = (px, py) => {   // the depth image's texel (px, py): what its centre's ray meets first
    const nx = (px + 0.5) / W * 2 - 1, ny = (py + 0.5) / H * 2 - 1;
    const hit = (z) => [tx + z * nx / proj[0], ty + z * ny / proj[5]];   // the ray at view distance z (the eye unrotated)
    if (beam) { const [x, y] = hit(D - 1); if (x >= beam[0] && x <= beam[1] && y >= -0.2 && y <= 0.2) return D - 1; }
    const [x, y] = hit(F);
    return x >= -hw && x <= hw && y >= -1 && y <= 0 ? F : D + 20;
  };
  return { W, H, proj, pi, at };
}
/** The glare's vertex shader run on the scene (a glare of size 1 - half-size 0.5): its vVis and gl_Position, and the
 *  evaluator (its functions callable). */
function glareRun(vs, o = {}) {
  const { W, H, proj, pi, at } = glareScene(o);
  const f = glslFunctions(vs, {
    uProj: Array.from(proj), uView: Array.from(lookAt([o.tx ?? 0, o.ty ?? 0, 0], [o.tx ?? 0, o.ty ?? 0, -1], [0, 1, 0])), uCenter: [o.lx ?? 0, 0, -(o.D ?? 10)], uSize: 1,
    uProjInfo: Array.from(pi), uRect: [0, 0, W, H], uCanvas: [W, H], aCorner: [0.5, 0.5],
    textureLod: (name, uv) => [depth01(at(Math.min(Math.max(Math.floor(uv[0] * W), 0), W - 1), Math.min(Math.max(Math.floor(uv[1] * H), 0), H - 1)), pi), 0, 0, 1],
  });
  f.main();
  return { vis: f.globals.vVis, pos: f.globals.gl_Position, f };
}
/** "The base": EL7's seven binary NEAREST taps and JAN1's hard veto, term for term, on the same scene. */
function glareOld(o = {}) {
  const { W, H, proj, pi, at } = glareScene(o);
  const D = o.D ?? 10, s = 0.5, cx = -(o.tx ?? 0), cy = -(o.ty ?? 0);   // the light's view position
  const tap = (vx, vy) => viewDistJs(depth01(at(Math.floor((proj[0] * vx / D * 0.5 + 0.5) * W), Math.floor((proj[5] * vy / D * 0.5 + 0.5) * H)), pi), pi);
  let vis = 0;
  for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, -1], [0, -2], [1, 0], [-1, 0]]) vis += Math.abs(tap(cx + dx * s, cy + dy * s) - D) <= AIR_GLARE_SLACK ? 1 : 0;
  vis /= 7;
  if (tap(cx, cy) < D - AIR_GLARE_SLACK) vis = 0;
  return vis;
}
/** The largest change of a glare's visibility between two frames of the eye sliding along `axis` - a twentieth of a
 *  pixel a frame, over five pixels. */
function largestStep(fn, o, axis) {
  const px = 2 / 320 / perspective(Math.PI / 3, 1.6, 0.2, 6000)[0] * (o.D ?? 10);
  let prev = null, most = 0;
  for (let k = 0; k <= 100; k++) {
    const v = fn({ ...o, [axis]: k * px / 20 });
    if (prev !== null) most = Math.max(most, Math.abs(v - prev));
    prev = v;
  }
  return most;
}

test('LA-POST2: the glare\'s visibility steps by at most one of twenty-eight soft, filtered taps that stand off the light\'s row - an eye sliding over five pixels across a flame or bobbing over one moves it by a 28th at most where the base flipped a seventh across and three sevenths on the bob; a beam crossing the light fades it over the texels about the light instead of cutting it (mutants: a tap binary; a tap unfiltered; the taps back on the row; the veto hard; the quad never collapsed)', () => {
  const T = AIR_GLARE_TAPS;
  assert.equal(T.length, 28);
  assert.equal(new Set(T.map((t) => t[1])).size, 28, 'each tap on a row of its own - no two cross a texel\'s edge at the same step');
  assert.equal(new Set(T.map((t) => t[0])).size, 28, 'and a column of its own');
  assert.ok(T.every(([, y]) => Math.abs(y) >= 0.3), 'none on or by the light\'s own row - the flat\'s top edge (a city light) or its base (a dungeon light)');
  assert.ok(T.every(([x, y]) => (Math.abs(x) <= 0.12 && Math.abs(y) <= 2) || (Math.abs(x) <= 1 && Math.abs(y) <= 0.55)), 'EL7\'s footprint: the vertical arm two half-sizes either way, the horizontal one either side');
  assert.ok(T.every(([x, y]) => T.some((u) => u[0] === -x && u[1] === -y)), 'symmetric about the light - above and below read alike');
  const { ap } = pass();
  const vs = ap.programs.glare.p.vs;
  // a flame in full view glares; a light with no flame under it (the flame five units aside) does not, and its quad leaves the clip volume
  const lit = glareRun(vs);
  assert.ok(lit.vis > 0.3 && lit.vis < 0.6, `a flame flat under the light: a glare (${lit.vis.toFixed(3)})`);
  assert.notDeepEqual(lit.pos, [2, 2, 2, 1]);
  const noFlame = glareRun(vs, { lx: 5 });
  assert.equal(noFlame.vis, 0, 'a light with no flame under it glares nothing');
  assert.deepEqual(noFlame.pos, [2, 2, 2, 1], 'and its quad leaves the clip volume whole - no fragment of it is shaded');
  // THE SLIDES: across a narrow flame and up (the head's bob), near and far; and up past a wide one, where EL7's
  // three taps on the light's row - the flat's top edge - changed hands together
  const now = (o) => glareRun(vs, o).vis;
  const one = 1 / 28 + 1e-3;
  for (const [o, axis] of [[{ D: 10 }, 'tx'], [{ D: 10 }, 'ty'], [{ D: 30 }, 'tx'], [{ D: 30 }, 'ty'], [{ D: 10, hw: 0.75 }, 'ty'], [{ D: 30, hw: 0.75 }, 'ty']]) {
    const step = largestStep(now, o, axis);
    assert.ok(step <= one, `${JSON.stringify(o)} along ${axis}: the largest step is ${step.toFixed(4)} - one tap's share at most`);
  }
  assert.ok(largestStep(glareOld, { D: 10 }, 'ty') >= 1 / 7 - 1e-9, 'the base: a seventh at a step on a narrow flame');
  assert.ok(largestStep(glareOld, { D: 10, hw: 0.75 }, 'ty') >= 3 / 7 - 1e-9, 'and three sevenths on a wide one - the row\'s three taps at once');
  // THE VETO (JAN1's law): a beam a unit nearer than the light sliding off the light's pixel fades the glare back in
  // over the texels about it; the base's one texel cut it whole
  const beamSlide = (fn) => {
    let prev = null, most = 0, first = null, last = null, moves = 0;
    for (let k = 0; k <= 60; k++) {
      const v = fn({ beam: [-3, 0.3 - k * 0.01] });   // the beam's right edge slides from right of the light to well left of it
      if (first === null) first = v;
      last = v;
      if (prev !== null) { most = Math.max(most, Math.abs(v - prev)); if (Math.abs(v - prev) > 1e-9) moves++; }
      prev = v;
    }
    return { first, last, most, moves };
  };
  const nb = beamSlide(now), ob = beamSlide(glareOld);
  assert.ok(nb.first === 0 && nb.last > 0.3, `hidden while the beam covers the light's pixel, seen once it has passed (${nb.first}, ${nb.last.toFixed(3)})`);
  assert.ok(nb.most <= 0.55 * nb.last && nb.moves >= 3, `and back over several frames - a column of the four texels at a time at most (largest step ${nb.most.toFixed(3)} of ${nb.last.toFixed(3)}, ${nb.moves} frames moving)`);
  assert.ok(ob.first === 0 && ob.most === ob.last && ob.moves === 1, 'the base: back in one step, whole');
  // SOFT IN DEPTH: a flat a little behind its light (a lantern hung before it) - as it stands further back the glare
  // eases out over the slack's outer half, where the base kept it whole to the slack and dropped it there
  let prevD = null, mostD = 0;
  const lastD = glareRun(vs, { flatOff: 0.3 }).vis;
  for (let k = 0; k <= 30; k++) {
    const v = glareRun(vs, { flatOff: k * 0.01 }).vis;
    if (prevD !== null) mostD = Math.max(mostD, Math.abs(v - prevD));
    prevD = v;
  }
  assert.equal(lastD, 0, 'past the slack: no flame');
  assert.ok(mostD < 0.25 * lit.vis, `eased out a little at a time (largest step ${mostD.toFixed(3)} of ${lit.vis.toFixed(3)})`);
  assert.ok(Math.abs(glareRun(vs, { flatOff: 0.1 }).vis - lit.vis) < 1e-9, 'within half the slack, whole');
  // FILTERED: a tap between two texel centres - one on the flame, one past its edge - answers a half, where one
  // NEAREST texel answered all or nothing
  const g = glareRun(vs).f;
  assert.ok(Math.abs(g.filtered([164 / 320, 91.5 / 200], 10, false) - 0.5) < 1e-9, 'half on the flame, half off: a half');
  assert.equal(g.filtered([163.5 / 320, 91.5 / 200], 10, false), 1, 'on a flame texel\'s centre: whole');
  assert.equal(g.filtered([164.5 / 320, 91.5 / 200], 10, false), 0, 'on the wall\'s: none');
  // by source: the soft depth test and the filtered read, both halves
  assert.match(vs, /return hide \? smoothstep\(0\.25, 0\.5, lantern - d\)\n\s+: 1\.0 - smoothstep\(0\.125, 0\.25, abs\(d - lantern\)\);/);
  assert.match(vs, /return mix\(mix\(depthTest\(distPx\(b\), lantern, hide\), depthTest\(distPx\(b \+ vec2\(1\.0, 0\.0\)\), lantern, hide\), f\.x\),\n\s+mix\(depthTest\(distPx\(b \+ vec2\(0\.0, 1\.0\)\), lantern, hide\), depthTest\(distPx\(b \+ vec2\(1\.0\)\), lantern, hide\), f\.x\), f\.y\);/);
});

test('LA-POST2: the glare is sized by a range HELD per light - a lamp whose range CityLightAnimator walks 14 times a second uploads one size for ten seconds, a light whose range really falls is followed at once, the hold is found by the light\'s place and let go when the light is gone (mutants: the live range; the hold never falling; the key by index; the sweep dropped)', () => {
  // the rule
  assert.equal(heldGlareRange(0, 17.2), 17.2, 'a first sight holds what it sees');
  assert.equal(heldGlareRange(17.2, 18), 18, 'a rise at once');
  assert.equal(heldGlareRange(18, 16.6), 18, 'a fall within the band is the flicker');
  assert.equal(heldGlareRange(18, 18 - AIR_GLARE_HOLD_BAND - 0.1), 18 - AIR_GLARE_HOLD_BAND - 0.1, 'a fall past it is real');
  assert.ok(AIR_GLARE_HOLD_BAND > 1.4 + 0.4, 'wider than the animator\'s walk: 1.4 under its start to 0.4 over');
  // the key: a static light's place is one number every frame; places an eighth apart are two
  assert.equal(glareKey(12.5, 3.25, -40.125), glareKey(12.5, 3.25, -40.125));
  assert.notEqual(glareKey(12.5, 3.25, -40.125), glareKey(12.625, 3.25, -40.125));
  assert.notEqual(glareKey(0, 1, 0), glareKey(1, 0, 0));
  assert.ok(Number.isSafeInteger(glareKey(-5000.3, 700.9, 8190.4)), 'an exact double');
  // the pass: a lamp walked by the real animator, ten seconds at 60 frames a second
  const anim = new CityLightAnimator(1, 18);
  const { ap, calls } = pass();
  const L = new Float32Array([2, 3, -10, 18]);
  const f = { pointLights: L, pointColors: null, carried: null, proj: I, view: I };
  const sizeNow = () => { calls.length = 0; ap._glares(f, () => {}); return calls.find((c) => c[0] === 'uniform1f' && c[1] === 'uSize')?.[2]; };
  const held = [], live = [];
  for (let frame = 0; frame < 600; frame++) {
    anim.tick(1 / 60);
    L[3] = anim.ranges[0];
    held.push(sizeNow()); live.push(glareSize(anim.ranges[0]));
  }
  const spread = (a) => Math.max(...a) - Math.min(...a);
  assert.ok(spread(live) > 0.03, `the live range walked (its size over ${spread(live).toFixed(3)} - every tap sliding with it)`);
  assert.ok(spread(held) < 1e-4, `the uploaded size stood still (${spread(held)})`);
  // a range that really falls
  L[3] = 8;
  assert.equal(sizeNow(), glareSize(8), 'followed at once');
  // the hold is the light's own, by place: a second light beside it holds its own
  const two = new Float32Array([2, 3, -10, 8, 6, 3, -10, 18]);
  f.pointLights = two;
  calls.length = 0; ap._glares(f, () => {});
  assert.deepEqual(calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uSize').map((c) => c[2]), [glareSize(8), glareSize(18)]);
  // gone lights are let go: two hundred passes of the second light alone
  f.pointLights = new Float32Array([6, 3, -10, 18]);
  for (let k = 0; k < 200; k++) ap._glares(f, () => {});
  assert.equal(ap._glareHold.has(glareKey(2, 3, -10)), false, 'the first light\'s hold is gone');
  assert.equal(ap._glareHold.has(glareKey(6, 3, -10)), true, 'the second\'s stands');
  // the storm's flash and the hand's light are still no lanterns (F11, MAC-T1)
  f.pointLights = new Float32Array([0, 50, 0, 800, 1, 1, 1, 8]); f.carried = new Uint8Array([0, 1]);
  calls.length = 0; ap._glares(f, () => {});
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').length, 0);
});

// ═══ 3. THE BLOOM AND THE SHAFTS IN HALF FLOATS ══════════════════════════════════════════════════════════════════
test('LA-POST3: the bloom\'s and the shafts\' images are half floats where the GL renders them (the AO keeps its bytes; with no float target every image is bytes, as before), the gaussians hold their reads at 1 so the source saturates exactly as the byte image did, and a halo\'s tail the byte image rounded to a ring survives; the probes read either through readTarget (mutants: the bloom in bytes; the shafts in bytes; the hold dropped; a float read as bytes)', () => {
  for (const float of [true, false]) {
    const { ap, calls } = pass({ float });
    ap.resize(320, 200);
    const T = ap.targets;
    for (const k of ['bloom', 'bloomB', 'shaft', 'shaftRaw', 'vol', 'volB']) assert.equal(T[k].float, float, `${k}: ${float ? 'a half float' : 'bytes'}`);
    for (const k of ['ao', 'aoBlur', 'volOut']) assert.equal(T[k].float, false, `${k}: bytes - a share, or the tonemapped glow`);
    assert.equal(calls.filter((c) => c[0] === 'texImage2D' && c[3] === 34842 && c[8] === 5131).length, float ? 6 : 0, 'RGBA16F / HALF_FLOAT: the bloom\'s two, the shafts\' two, the glow\'s two');
    // the probes' read: a float image as FLOAT, a byte image as bytes
    calls.length = 0;
    const b = ap.readTarget('bloom'), a = ap.readTarget('ao');
    const reads = calls.filter((c) => c[0] === 'readPixels');
    assert.deepEqual(reads.map((c) => c[6]), [float ? 5126 : 5121, 5121], 'the bloom read as its storage, the AO as bytes');
    assert.equal(b.px.length, T.bloom.w * T.bloom.h * 4); assert.ok(b.px instanceof Uint8Array && a.px instanceof Uint8Array);
    assert.equal(ap.readTarget('nothing'), null);
  }
  // the gaussian: a source the writers summed past 1 (a flame's own emitter, glare and bright pass together) is held
  // at 1 - the byte image's own answer - and a source under 1 is read as it is
  const { ap } = pass({ float: true });
  const gauss = (src) => { const f = glslFunctions(ap.programs.gauss.p.fs, { uDir: [0.01, 0], vUV: [0.5, 0.5], texture: () => [src, src, src, 1] }); f.main(); return f.globals.outColor[0]; };
  assert.ok(Math.abs(gauss(3) - gauss(1)) < 1e-9 && Math.abs(gauss(1) - 1) < 1e-5, 'a sum of three reads as one - the level Mac\'s gain was tuned on');
  assert.ok(Math.abs(gauss(0.25) - 0.25) < 1e-5, 'under one, untouched');
  // the tail: a halo's linear light under half a byte step - four display levels once the resolve adds it at the
  // bloom's gain over black and encodes - was 0 in the byte image: the ring
  const tail = 0.0018, gain = 0.6;
  const shown = (lin) => Math.round((lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055) * 255);
  assert.equal(Math.round(tail * 255) / 255, 0, 'the byte image held nothing of it');
  assert.ok(shown(tail * gain) >= 3, `the half float holds it: ${shown(tail * gain)} display levels where the byte image showed 0`);
  // by source: the four targets on the one test the glow already takes
  assert.match(read('src/render/airPass.js'), /bloom: color\(bw, bh, f16\), bloomB: color\(bw, bh, f16\),\n\s+shaft: color\(bw, bh, f16\), shaftRaw: color\(bw, bh, f16\),/);
});

// ═══ 4. THE EYE IN SIXTEEN BITS ══════════════════════════════════════════════════════════════════════════════════
test('LA-POST4: the eye\'s state is sixteen bits (the high byte in R, the low in G) - the codec round-trips to 6e-5 of a stop and reads the bare [128, 128] images as it always did; at 144 Hz a dark frame that the byte eye never opened to is reached, and after a flash the eye comes back where the byte eye stayed closed; ADAPT_FS is packAdapt(adaptStep(unpackAdapt)) term for term, and LUM_FS holds each tap\'s log to the encoded range (mutants: one byte; the low byte dropped; a black tap scored at -29.9)', () => {
  const R = AIR_ADAPT_LOG_RANGE;
  assert.equal(AIR_ADAPT_STEPS, 65535);
  let worst = 0;
  for (let m = AIR_ADAPT_MIN * 0.5; m <= AIR_ADAPT_MAX * 2; m *= 1.0137) {
    const [hi, lo] = packAdapt(m);
    assert.ok(Number.isInteger(hi) && Number.isInteger(lo) && hi >= 0 && hi <= 255 && lo >= 0 && lo <= 255, `two bytes for ${m}`);
    worst = Math.max(worst, Math.abs(Math.log2(unpackAdapt(hi, lo) / m)));
  }
  assert.ok(worst <= (R[1] - R[0]) / AIR_ADAPT_STEPS / 2 + 1e-12, `the round trip within half a step: ${worst.toExponential(2)} of a stop`);
  assert.deepEqual(packAdapt(1), [128, 0], 'the multiplier 1: the images start there');
  assert.ok(Math.abs(unpackAdapt(128, 128) - unpackLog(128 / 255, R)) < 1e-12, 'R = G = b reads b / 255 - the renderer\'s and the ring\'s bare [128, 128, 128] images read as ever');
  // the dead band: a frame whose target is 10% open, at 144 Hz for five seconds
  const byteOne = [Math.round(packLog(1, R) * 255), 0];
  const lumFor = (target) => 0.18 / target;   // key / luminance is the target (inside the clamps)
  let m8 = byteOne, m16 = packAdapt(1);
  for (let i = 0; i < 144 * 5; i++) { m8 = adaptStepStored(m8, lumFor(1.1), 1 / 144, 8); m16 = adaptStepStored(m16, lumFor(1.1), 1 / 144); }
  assert.deepEqual(m8, byteOne, 'the byte eye: five seconds at 144 Hz and not one step - a step under half a byte rounds back');
  assert.ok(Math.abs(unpackAdapt(...m16) - 1.1) < 0.1 * 0.1, `sixteen bits: opened to ${unpackAdapt(...m16).toFixed(4)} of 1.1`);
  // at 60 Hz the byte eye stops a third short of a target 1.5 away; sixteen bits arrive
  m8 = byteOne; m16 = packAdapt(1);
  for (let i = 0; i < 60 * 20; i++) { m8 = adaptStepStored(m8, lumFor(1.5), 1 / 60, 8); m16 = adaptStepStored(m16, lumFor(1.5), 1 / 60); }
  assert.ok(unpackLog(m8[0] / 255, R) < 1.2, `the byte eye stuck at ${unpackLog(m8[0] / 255, R).toFixed(3)} after twenty seconds`);
  assert.ok(Math.abs(unpackAdapt(...m16) - 1.5) < 0.005, `sixteen bits at ${unpackAdapt(...m16).toFixed(4)}`);
  // a flash (a muzzle, the storm) closes the eye in a few frames; a mid-grey world after it
  m8 = byteOne; m16 = packAdapt(1);
  for (let i = 0; i < 8; i++) { m8 = adaptStepStored(m8, 50, 1 / 144, 8); m16 = adaptStepStored(m16, 50, 1 / 144); }
  const shut = unpackAdapt(...m16);
  assert.ok(shut < 0.97, `the flash closed the eye (${shut.toFixed(3)})`);
  for (let i = 0; i < 144 * 10; i++) { m8 = adaptStepStored(m8, lumFor(1), 1 / 144, 8); m16 = adaptStepStored(m16, lumFor(1), 1 / 144); }
  assert.ok(unpackLog(m8[0] / 255, R) < 0.98, `the byte eye stays closed ten seconds on (${unpackLog(m8[0] / 255, R).toFixed(3)})`);
  assert.ok(Math.abs(unpackAdapt(...m16) - 1) < 0.01, `sixteen bits come back (${unpackAdapt(...m16).toFixed(4)})`);
  // ADAPT_FS itself: the previous image's two bytes in, the step, two bytes out - adaptStepStored's
  const { ap } = pass();
  for (const [prev, lum, dt] of [[packAdapt(1), lumFor(1.1), 1 / 144], [packAdapt(1.7), 2, 1 / 60], [packAdapt(0.72), 0.01, 0.1], [[128, 128], 0.18, 1 / 30]]) {
    const f = glslFunctions(ap.programs.adapt.p.fs, {
      vUV: [0.5, 0.5], uAdaptParams: [dt, 0.18, AIR_ADAPT_MIN, AIR_ADAPT_MAX], uAdaptRates: [0.6, 3],
      texture: () => [prev[0] / 255, prev[1] / 255, 0, 1], textureLod: () => [packLog(lum, AIR_LUM_LOG_RANGE), 0, 0, 1],
    });
    f.main();
    const out = f.globals.outColor;
    assert.deepEqual([out[0] * 255, out[1] * 255].map((v) => Math.round(v)), adaptStepStored(prev, unpackLog(packLog(lum, AIR_LUM_LOG_RANGE), AIR_LUM_LOG_RANGE), dt), `the shader's step from ${prev} at ${lum}`);
    assert.ok([out[0] * 255, out[1] * 255].every((v) => Math.abs(v - Math.round(v)) < 1e-6), 'each an exact byte');
  }
  // LUM_FS: a quarter of the cell black, the rest a grey - each tap's log held to the range
  const grey = 0.5, greyLin = ((grey + 0.055) / 1.055) ** 2.4, L = greyLin * 0.7152 + greyLin * 0.2126 + greyLin * 0.0722;
  const lumRun = (src) => {
    const f = glslFunctions(src, { vUV: [0.5 / 32, 0.5 / 32], uRect: [0, 0, 320, 200], uCanvas: [320, 200],
      texture: (name, uv) => (name === 'uPrev' ? [128 / 255, 0, 0, 1] : name === 'uVol' ? [0, 0, 0, 1] : uv[0] * 32 * 320 / 320 < 0.25 ? [0, 0, 0, 1] : [grey, grey, grey, 1]) });
    f.main();
    return f.globals.outColor[0] * 16 - 12;   // back to the mean log
  };
  const prev1 = unpackAdapt(128, 0);
  const want = 0.25 * AIR_LUM_LOG_RANGE[0] + 0.75 * Math.log2(L / prev1);
  const got = lumRun(ap.programs.lum.p.fs);
  assert.ok(Math.abs(got - want) < 1e-4, `the mean log over the cell: ${got.toFixed(4)} (a black tap counted at the range's floor, -12)`);
  assert.equal(lumTapLog(0), AIR_LUM_LOG_RANGE[0]); assert.equal(lumTapLog(1e9), AIR_LUM_LOG_RANGE[1]); assert.ok(Math.abs(lumTapLog(L, prev1) - Math.log2(L / prev1)) < 1e-12);
  const oldMean = 0.25 * Math.log2(1e-9) + 0.75 * Math.log2(L / prev1);
  assert.ok(want - oldMean > 4, `the base scored the same cell ${(want - oldMean).toFixed(1)} stops darker - four black taps outweighing twelve lit`);
});

// ═══ 5. THE AO BLUR'S WINDOW ═════════════════════════════════════════════════════════════════════════════════════
test('LA-POST5: the AO blur keeps the whole tile on far ground - its depth window is a share of the distance with the radius its floor - where the absolute radius dropped the ground\'s far and near rows past ~20 units (the rotation\'s stripes); the sky beside a wall is still no neighbour (mutants: the absolute window back; the share applied as a ceiling)', () => {
  assert.equal(AIR_AO_BLUR_SHARE, 0.15); assert.equal(AIR_AO_RADIUS, 0.8);
  // the ground from an eye 1.7 up looking level, at 1080p: an AO texel is two canvas rows
  const W = 1920, H = 1080, proj = perspective(Math.PI / 3, W / H, 0.2, 6000), pi = projInfo(proj);
  const eyeY = 1.7;
  const groundAt = (py) => { const ny = (py + 0.5) / H * 2 - 1; return ny < 0 ? eyeY * proj[5] / -ny : 6000; };   // a row's planar distance to the ground (or the far plane)
  const { ap } = pass();
  const box = ap.programs.box.p.fs;
  // "the base": EL7's window about the centre (LA-AUDIT B6 moved the window onto the surface's own run)
  const OLD = box.replace('float w = abs(viewDist(depthAt(uv)) - (here + rise)) <= win ? 1.0 : 0.0;', 'float w = abs(viewDist(depthAt(uv)) - here) <= uBlurRange ? 1.0 : 0.0;');
  assert.notEqual(OLD, box, 'the base built');
  // the AO image's taps tagged by row: the outer rows (+-1.5 texels) carry an unoccluded 1, the inner two a 0 - the
  // blurred value says how many outer rows the window let in (all 16 taps: 0.5; the inner eight alone: 0)
  const run = (src, dist, depthRow = groundAt) => {
    const ny = -eyeY * proj[5] / dist, py = Math.floor((ny + 1) / 2 * H);
    const cUV = [0.5, (py + 0.5) / H];
    const f = glslFunctions(src, { vUV: cUV, uTexel: [2 / W, 2 / H], uBlurRange: AIR_AO_RADIUS, uStrength: 1, uProjInfo: Array.from(pi), uRect: [0, 0, W, H], uCanvas: [W, H],
      textureLod: (name, uv) => [depth01(depthRow(Math.min(Math.max(Math.floor(uv[1] * H), 0), H - 1)), pi), 0, 0, 1],
      texture: (name, uv) => { const row = Math.round((uv[1] - cUV[1]) / (2 / H) - 0.5); return [row === -2 || row === 1 ? AIR_AO_STORE : 0, 0, 0, 1]; } });
    f.main();
    return f.globals.outColor[0];
  };
  for (const d of [8, 20, 30, 45, 90, 150]) assert.ok(Math.abs(run(box, d) - 0.5) < 1e-6, `ground at ${d}: every row of the tile counts (${run(box, d).toFixed(3)})`);
  assert.ok(Math.abs(run(OLD, 8) - 0.5) < 1e-6, 'the base: near ground whole');
  assert.equal(run(OLD, 30), 0, 'the base: at 30 the outer rows fell out - the tile averaged across alone, the rotation\'s stripes');
  assert.equal(run(OLD, 45), 1, 'and at 45 not one tap - no neighbour, so no occlusion at all');
  // EL7's law stands: a wall's pixel with the sky above it takes none of the sky
  const wallThenSky = (py) => (py > 540 + 1 ? 6000 : 10);
  const f = glslFunctions(box, { vUV: [0.5, 541 / H], uTexel: [2 / W, 2 / H], uBlurRange: AIR_AO_RADIUS, uStrength: 1, uProjInfo: Array.from(pi), uRect: [0, 0, W, H], uCanvas: [W, H],
    textureLod: (name, uv) => [depth01(wallThenSky(Math.floor(uv[1] * H)), pi), 0, 0, 1], texture: (name, uv) => [uv[1] * H > 542 ? 0 : AIR_AO_STORE, 0, 0, 1] });
  f.main();
  assert.equal(f.globals.outColor[0], 1, 'the sky\'s taps (occlusion 0 here) are no neighbours of the wall');
});

// ═══ 6. THE CONTACT MARCH ════════════════════════════════════════════════════════════════════════════════════════
/** The previous frame, ray-cast: the eye at (0, 1.7, 0) looking down -z on a 320 x 200 canvas, a floor at y = 0, a
 *  wall at z = -wallZ, a pillar (x 1..2, y 0..3, z -9.7..-9.2). Returns the contact block's bindings for it. */
function prevFrame({ wallZ = 10, camPos = [0, 1.7, 0.5] } = {}) {
  const W = 320, H = 200, proj = perspective(Math.PI / 3, W / H, 0.2, 6000), pi = projInfo(proj);
  const eye = [0, 1.7, 0], view = lookAt(eye, [0, 1.7, -1], [0, 1, 0]);
  const cast = (px, py) => {   // the planar distance the texel's ray meets first (its direction's view z is -1)
    const d = [((px + 0.5) / W * 2 - 1) / proj[0], ((py + 0.5) / H * 2 - 1) / proj[5], -1];
    let t = wallZ;
    if (d[1] < 0) t = Math.min(t, eye[1] / -d[1]);
    let t0 = 9.2, t1 = 9.7;   // the pillar's slab in z, then x and y
    for (const [o, dd, lo, hi] of [[eye[0], d[0], 1, 2], [eye[1], d[1], 0, 3]]) {
      if (Math.abs(dd) < 1e-12) { if (o < lo || o > hi) t0 = Infinity; continue; }
      const a = (lo - o) / dd, b = (hi - o) / dd;
      t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 <= t1) t = Math.min(t, t0);
    return t;
  };
  return {
    uPrevVP: Array.from(multiply(proj, view)), uPrevProjInfo: Array.from(pi), uContactParams: [AIR_CONTACT_LENGTH, AIR_CONTACT_THICKNESS, AIR_CONTACT_FLOOR, 1],
    uPrevRect: [0, 0, 1, 1], uCamPos: camPos, textureSize: () => [W, H],
    texture: (name, uv) => [depth01(cast(Math.min(Math.max(Math.floor(uv[0] * W), 0), W - 1), Math.min(Math.max(Math.floor(uv[1] * H), 0), H - 1)), pi), 0, 0, 1],
  };
}
const norm = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
/** "The base": the block as it stood - the self-check held to the thickness, each step all or nothing. */
const OLD_CONTACT = AIR_CONTACT_GLSL.replace('> tol) return 1.0;', '> uContactParams.y) return 1.0;')
  .replace(/occ = max\(occ, smoothstep[^\n]*\n/, 'if (behind > 0.02 && behind < uContactParams.y) occ = 1.0;\n');

test('LA-POST6: the contact march holds a surface to its own tolerance - a wall revealed behind a pillar is no longer marched through the pillar\'s frame-old depth into its shadow, while a real contact (the floor at a wall\'s foot, a lantern behind it) still darkens; each step\'s claim is soft, so an occluder easing past the thresholds eases the shadow; one projection a march (mutants: the thickness as the tolerance; the slope term dropped; the claim hard; the thickness fade dropped; the stride wrong)', () => {
  assert.equal(AIR_CONTACT_SELF, 0.05); assert.equal(AIR_CONTACT_SLOPE_MAX, 16); assert.equal(AIR_CONTACT_RAMP, 0.08); assert.equal(AIR_CONTACT_STEPS, 4);
  assert.notEqual(OLD_CONTACT, AIR_CONTACT_GLSL); assert.ok(OLD_CONTACT.includes('occ = 1.0;') && OLD_CONTACT.includes('> uContactParams.y) return 1.0;'), 'the base built');
  const march = (src, b, [wp, n, light]) => {
    const L = light.map((v, i) => v - wp[i]), d = Math.hypot(...L);
    return glslFunctions(src, b).contactShadow(wp, n, L.map((v) => v / d), d);
  };
  // THE REVEAL: a wall point the pillar hid last frame (its depth there the pillar's, 0.78 nearer), a lantern in front
  const reveal = [[1.3, 1.0, -10], [0, 0, 1], [1.3, 1.0, -8]];
  const eyeNow = [3, 1.7, 0];
  assert.equal(march(OLD_CONTACT, prevFrame({ camPos: eyeNow }), reveal), AIR_CONTACT_FLOOR, 'the base: marched through the pillar\'s depth - the revealed wall wore its shadow');
  assert.equal(march(AIR_CONTACT_GLSL, prevFrame({ camPos: eyeNow }), reveal), 1, 'now: the wall was not where the previous frame saw - not marched, lit');
  // THE CONTACT: the floor at the wall's foot, a lantern two units behind the wall - both darken it to the floor
  const contact = [[0, 0, -9.8], [0, 1, 0], [0, 1, -12]];
  assert.equal(march(OLD_CONTACT, prevFrame(), contact), AIR_CONTACT_FLOOR);
  assert.ok(Math.abs(march(AIR_CONTACT_GLSL, prevFrame(), contact) - AIR_CONTACT_FLOOR) < 1e-9, 'now: the same contact shadow - a grazing floor at ten units passes its slope-widened check');
  // THE CLAIM: the wall eased forward a four-hundredth at a time past the last step (10.35 away): its "behind" crosses
  // 0.02 and the ramp - the base's answer drops from lit to the floor at once, the claim's in small steps
  const ease = (src) => {
    let prev = null, most = 0, lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 80; k++) {
      const v = march(src, prevFrame({ wallZ: 10.45 - k * 0.0025 }), contact);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
      if (prev !== null) most = Math.max(most, Math.abs(v - prev));
      prev = v;
    }
    return { most, lo, hi };
  };
  const eNow = ease(AIR_CONTACT_GLSL), eOld = ease(OLD_CONTACT);
  assert.ok(eOld.most >= 1 - AIR_CONTACT_FLOOR - 1e-9, `the base: all or nothing (${eOld.most.toFixed(3)})`);
  assert.ok(eNow.hi - eNow.lo > 0.5 && eNow.most < 0.1, `now: the same span (${eNow.lo.toFixed(3)} to ${eNow.hi.toFixed(3)}) in steps under a tenth (${eNow.most.toFixed(3)})`);
  // ONE PROJECTION A MARCH: the steps' clip positions are c0 + i * dc, exactly the product at each step (linear in p)
  const M = multiply(perspective(1.1, 1.7, 0.2, 6000), lookAt([3, 2, 5], [0, 1, -4], [0, 1, 0]));
  const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
  const start = [0.4, 0.02, -3.3], dir = norm([0.2, 0.9, -0.4]), len = 0.6;
  const c0 = mul(M, [...start, 1]), dc = mul(M, [...dir.map((v) => v * len / 4), 0]);
  for (let i = 1; i <= 4; i++) {
    const direct = mul(M, [...start.map((v, k) => v + dir[k] * len * i / 4), 1]);
    direct.forEach((v, k) => assert.ok(Math.abs(v - (c0[k] + i * dc[k])) <= 1e-9 * Math.max(1, Math.abs(v)), `step ${i}, component ${k}`));
  }
  const loop = AIR_CONTACT_GLSL.slice(AIR_CONTACT_GLSL.indexOf('for (int i = 1;'));
  assert.ok(!/uPrevVP \*/.test(loop), 'no projection inside the loop');
  assert.equal((AIR_CONTACT_GLSL.match(/uPrevVP \*/g) ?? []).length, 2, 'the start and the stride');
});

test('LA-POST6: the march\'s previous frame is a frame this one follows - the floating origin\'s recentre rebases the held view-projections (no cut), and a door either way, the air back on, an eye that jumps past AIR_CONTACT_CUT and a menu\'s frame in between each leave the next world frame no previous depth to march (mutants: the shift a no-op; the rebase the wrong sign; the door not a cut; the jump not seen; the release kept; a menu\'s depth taken)', () => {
  // the rebase, by execution: the moved point lands where the unmoved one did, under both held matrices
  const { ap } = pass();
  const M = multiply(perspective(1, 1.6, 0.2, 6000), lookAt([10, 2, 30], [12, 1, 0], [0, 1, 0]));
  ap.prevVP.set(M); ap._vp.set(M);
  const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
  const p = [11, 1.5, 4], o = [-819.2, 0, 409.6];
  const before = mul(M, [...p, 1]);
  ap._prevEye.set([1, 2, 3]); ap._glareHold.set(glareKey(5, 6, 7), { x: 5, y: 6, z: 7, range: 18, seen: 0 });
  ap.shiftOrigin(o);
  for (const m of [ap.prevVP, ap._vp]) mul(m, [p[0] + o[0], p[1] + o[1], p[2] + o[2], 1]).forEach((v, k) => assert.ok(Math.abs(v - before[k]) < 2e-3 * Math.max(1, Math.abs(before[k])), `clip ${k}: ${v} vs ${before[k]}`));
  assert.deepEqual([...ap._prevEye], [1 - 819.2, 2, 3 + 409.6].map(Math.fround), 'the held eye moved with the world');
  assert.equal(ap._glareHold.get(glareKey(5 - 819.2, 6, 7 + 409.6))?.range, 18, 'the held glare range filed under its moved place');
  // the renderer, frame by frame: an eye walking down a street, the lane and the air on
  const { calls, canvas } = rendererGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  const proj = perspective(Math.PI / 3, 1.6, 0.2, 6000), sun = new Float32Array([0.3, 0.8, 0.2]);
  let at = [0, 1.7, 0];
  const frame = (eye = at, kind = WORLD_FRAME) => {
    at = eye;
    r.beginFrame(proj, lookAt(eye, [eye[0], eye[1], eye[2] - 1], [0, 1, 0]), sun, kind);
    const valid = r.air.prevValid;
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return valid;
  };
  const walk = () => frame([at[0], at[1], at[2] - 0.1]);
  assert.equal(frame(), false, 'the first frame: nothing before it');
  assert.equal(walk(), true); assert.equal(walk(), true, 'a walk: each frame follows the last');
  // THE RECENTRE: the host moves the world (and the eye) by the offset and tells the renderer - no cut
  let told = null;
  const shift = r.air.shiftOrigin.bind(r.air);
  r.air.shiftOrigin = (off) => { told = off; shift(off); };
  r.shadowOriginShift([819.2, 0, 0]);
  assert.deepEqual(told, [819.2, 0, 0], 'shadowOriginShift tells the air');
  assert.equal(frame([at[0] + 819.2, at[1], at[2] - 0.1]), true, 'the recentre\'s frame follows the one before it');
  // THE JUMP: a teleport
  assert.equal(frame([at[0] + 50, at[1], at[2]]), false, `an eye ${50} units on: a cut (AIR_CONTACT_CUT ${AIR_CONTACT_CUT})`);
  assert.equal(walk(), true);
  assert.equal(frame([at[0] + AIR_CONTACT_CUT * 0.9, at[1], at[2]]), true, 'a stride under the cut is a frame that follows');
  // THE DOOR: a building's first frame (everyLightCasts, DISC15's edge), and the street's first after it
  r.everyLightCasts(); assert.equal(frame(), false, 'into a room: a cut');
  r.everyLightCasts(); assert.equal(frame(), true, 'the room\'s next frame follows it');
  assert.equal(frame(), false, 'out of the room: a cut');
  assert.equal(walk(), true);
  // THE DOOR SHUT AND OPENED: the air off and on
  r.setAir(false); r.setAir(true);
  assert.equal(walk(), false, 'the air back on: its depth is from before the door shut');
  assert.equal(walk(), true);
  // A MENU'S FRAME between two world frames: its depth is no world's
  frame(at, 0);
  assert.equal(walk(), false, 'the frame after a menu\'s: no previous depth to march');
  assert.equal(walk(), true);
  // by source: the wiring where the renderer knows
  const rs = read('src/render/renderer.js');
  assert.match(rs, /shadowOriginShift\(offset\) \{ this\._shadowPass\?\.shiftOrigin\(offset\); this\._air\?\.shiftOrigin\(offset\); this\._frameStamp\+\+; \}/);   // LA-AUDIT C1: and the stamp
  assert.match(rs, /if \(this\._everyLightNow && !this\._everyLightPrev\) sp\.discard\(\);\n\s+if \(this\._everyLightNow !== this\._everyLightPrev\) \{ this\._air\?\.invalidatePrev\(\); \} this\._everyLightPrev = this\._everyLightNow;/, 'the door, both ways, before the edge is spent');
  assert.ok(calls.length > 0);
});

// ═══ 7. THE GLOW'S GATE ══════════════════════════════════════════════════════════════════════════════════════════
test('LA-POST7: the renderer hands the lanterns\' glow to the air pass only where the glow\'s shader BUILT - a GL that refused it (`vol: null`) marches nothing, and the lane keeps its own analytic glow instead of zeroing it and leaving none (mutant: the build unasked)', () => {
  const { calls, canvas } = rendererGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.textures.set('1_1', { id: 't' });
  r.setLighting(new Float32Array([0.1, 0.1, 0.1]), 0, new Float32Array([1, 1, 1]));
  r.setFog('exp', 0.03, 60, 180, new Float32Array([0.02, 0.02, 0.03]));
  const mesh = { vao: { id: 'vao' }, buffers: [], bounds: new Float32Array([0, 1, 0, 4]), subMeshes: [{ textureArchive: 1, textureRecord: 1, startIndex: 0, primitiveCount: 2 }] };
  const scatter = () => {
    r.setPointLights(new Float32Array([0, 2, -3, 12]), new Float32Array([1, 0.8, 0.5]));
    calls.length = 0;
    r.beginFrame(I, I, new Float32Array([0, 1, 0]), WORLD_FRAME);
    const glows = r._airGlows();
    r.drawMesh(mesh, I, null);
    const up = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uELScatter').map((c) => c[2]);
    r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 });
    return { glows, up, marched: r.air.stats.vol };
  };
  assert.ok(r.air.programs.vol, 'built on this GL');
  scatter();
  const built = scatter();
  assert.equal(built.glows, true); assert.equal(built.marched, true);
  assert.ok(built.up.length > 0 && built.up.every((v) => v === 0), 'the air pass glows: the lane\'s own glow is 0');
  const vol = r.air.programs.vol;
  r.air.programs.vol = null;   // a GL that refused the glow's shader (AUDIT VOL1's guarded build)
  const refused = scatter();
  assert.equal(refused.glows, false, 'no shader, no hand-off');
  assert.equal(refused.marched, false, 'nothing marched');
  assert.ok(refused.up.length > 0 && refused.up.every((v) => v > 0), `the lane glows for itself (${refused.up[0]})`);
  r.air.programs.vol = vol;
});

// ═══ 8. THE FRAME'S FRAMEBUFFERS, THE IMAGES NOTHING READS ═══════════════════════════════════════════════════════
test('LA-POST8: the frame binds one of two framebuffers - each the colour image with one depth - and attaches nothing per frame; a night frame (no beams, no haze) leaves the shafts\' image alone because its resolve reads none; a menu\'s frame runs no bright pass and no gaussians (mutants: the depth re-attached; the framebuffers swapped; the shafts cleared; the bloom for a menu)', () => {
  const { calls, canvas } = rendererGl();
  const r = new Renderer(canvas);
  r.setLightingLane(EL_LANE); r.setAir(true);
  r.setLighting(new Float32Array([0.3, 0.3, 0.3]), 0, new Float32Array([1, 1, 1]));   // a night: no sun
  const frame = (kind = WORLD_FRAME) => { calls.length = 0; r.beginFrame(I, I, new Float32Array([0, 1, 0]), kind); const mid = calls.length; r.drawScreenQuad({ id: 'ui' }, { x: 0, y: 0, w: 10, h: 10 }); return { begin: calls.slice(0, mid), resolve: calls.slice(mid) }; };
  const first = frame();
  const F = r.air.frame;
  assert.equal(F.fbos.length, 2);
  // the birth: each framebuffer takes the colour image and its own depth
  const attach = new Map();
  let bound = null;
  for (const c of first.begin) {
    if (c[0] === 'bindFramebuffer') bound = c[2];
    if (c[0] === 'framebufferTexture2D' && F.fbos.includes(bound)) attach.set(bound, [...(attach.get(bound) ?? []), [c[2], c[4]]]);
  }
  F.fbos.forEach((fb, k) => assert.deepEqual(attach.get(fb), [[36064, F.tex], [36096, F.depths[k]]], `framebuffer ${k}: the colour image and depth ${k}`));
  for (let n = 0; n < 4; n++) {
    const { begin } = frame();
    assert.equal(r.air.frame.fbo, F.fbos[F.depthIndex], 'the framebuffer bound is the one with this frame\'s depth');
    assert.equal(F.depths[F.depthIndex], F.depth);
    assert.ok(begin.some((c) => c[0] === 'bindFramebuffer' && c[2] === F.fbo), 'bound');
    assert.ok(!begin.some((c) => c[0] === 'framebufferTexture2D'), 'nothing attached');
  }
  // the night's resolve: the shafts' image untouched (no clear through its framebuffer), and not read
  const night = frame().resolve;
  assert.equal(r.air.stats.shafts || r.air.stats.haze, false, 'a night: no beams, no haze');
  const T = r.air.targets;
  let at = null;
  const clearedShaft = night.some((c) => { if (c[0] === 'bindFramebuffer') at = c[2]; return c[0] === 'clear' && at === T.shaft.fbo; });
  assert.equal(clearedShaft, false, 'the shafts\' image is not cleared');
  assert.ok(night.some((c) => c[0] === 'useProgram' && c[1] === r.air.programs.resolve[0][0].p), 'the resolve built without the shafts\' read');
  assert.ok(night.filter((c) => c[0] === 'uniform2f' && c[1] === 'uDir').length === 4 && night.some((c) => c[0] === 'uniform1f' && c[1] === 'uThreshold'), 'a world frame: the bright pass and the four gaussians');
  // a menu's frame: resolved before anything is drawn over its clear - no bloom work
  const menu = frame(0).resolve;
  assert.ok(menu.some((c) => c[0] === 'uniform4fv' && c[1] === 'uGrade'), 'resolved');
  assert.equal(menu.filter((c) => c[0] === 'uniform2f' && c[1] === 'uDir').length, 0, 'no gaussians');
  assert.ok(!menu.some((c) => c[0] === 'uniform1f' && c[1] === 'uThreshold'), 'no bright pass');
  at = null;
  assert.ok(menu.some((c) => { if (c[0] === 'bindFramebuffer') at = c[2]; return c[0] === 'clear' && at === T.bloom.fbo; }), 'its bloom cleared black - what the resolve adds');
});

