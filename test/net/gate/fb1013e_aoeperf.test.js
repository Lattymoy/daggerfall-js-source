// FIELD BUGS 2026-10-13e AOE-PERF (HellRay, Discord: "massive FPS drops when the boss performs AoE attacks and circles
// appear on the ground"): THE BOSS'S CIRCLES SHADED GROUND THEY NEVER DRAW ON. Every telegraph shape is its own blended
// pass over its own quad, and an AoE frame at a fighter's eye rasterised 3.3 to 3.7 screens of the telegraph's fragment
// stage (tools/fb1013ePerfProbe.mjs; bible/07-Rendering/Performance-Rig.md AOE-PERF). Most quads are TELEGRAPH_REACH
// past their shape because the shape draws there - its glow, its keyline and its shockwave reach as far as the pixel is
// large - but two kinds draw nothing past their own ground at any pixel's size: HIS MARK (a ring, the floor inside it,
// a chevron; every frame of the fight) and HIS HOST'S PATHS AND TETHERS (the lane alone - dashes flowing to him), whose
// box about a Sapper's whole run from the rim was a fifth of the screen. Their quads are their own ground now. The
// fragment stage is untouched. Pinned on the code the GPU runs (test/glsl.mjs) and over a recording GL:
//   a. his mark's quad holds every fragment the shader draws for it - at every pixel's size, under every term of its
//      reach - and is a third of the box it was;
//   b. a path's or a tether's quad is its own strip - the vertex stage lays the walkways' quad along it, holding every
//      fragment the shader draws for it at any pixel's size, and the state is put back for the next shape;
//   c. every other shape keeps the quad its glow needs (TELEGRAPH_REACH past it);
//   d. THE COUNT at a fighter's eye: an AoE frame of his blow, his ground, his mark and his host's rasterises two fifths
//      less of the telegraph, his mark alone a third of what it did.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import {
  GateTelegraphRenderer, TELEGRAPH_FS, TELEGRAPH_VS, TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_POINTS_MAX, TELEGRAPH_REACH, TELEGRAPH_EDGE, TELEGRAPH_LIFT,
  TELEGRAPH_WALK_QUAD, TELEGRAPH_MARK_RING, telegraphShape, markShape, poolShapes, telegraphBounds, telegraphQuadOver, telegraphStrip, telegraphMarkReach,
} from '../../../src/render/gate/gateTelegraph.js';
import { ATTACKS, COURTS, COURT_R, COURT_CENTRE, BASE_PROFILE, POOLS, HOST, BOSS_R, windupOf, fightProfile } from '../../../src/net/gate/gateBrain.js';
import { hostShapes } from '../../../src/scenes/gate/gateHost.js';
import { lookAt, perspective, mirrorProjectionX, multiply } from '../../../src/world/mat4.js';

const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** A GL that records every call, its typed arrays copied as they were sent; its vertex arrays numbered as made. */
function recordingGl() {
  const calls = [];
  const consts = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8, BLEND: 9, ONE: 10, CULL_FACE: 11, POLYGON_OFFSET_FILL: 12, ONE_MINUS_SRC_ALPHA: 13, ZERO: 14, drawingBufferHeight: 900 };
  let vaos = 0;
  const gl = new Proxy(consts, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createVertexArray') return () => ({ vao: ++vaos });
      return (...a) => { calls.push([k, ...a.map((x) => (ArrayBuffer.isView(x) ? Array.from(x) : x))]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; };
    },
  });
  return { gl, calls };
}
const lastUniform = (calls, name) => calls.filter((c) => c[0].startsWith('uniform') && c[1] === name).at(-1)?.slice(2);

// ── the producers' shapes: an AoE frame of the Burning Court (render/gate/gateTelegraph.js, scenes/gate/gateHost.js) ─────────────
const P = BASE_PROFILE, NOW = 1_000_000;
const FIGHTERS = [[3, 8], [-6, 6], [8, -2], [-9, -5], [1, -11], [12, 6], [-13, 2], [5, 14], [-4, -15], [10, -10]];
const atkOf = (key, phase, share, over = {}) => { const A = ATTACKS[key]; const w = windupOf(A, phase); return { i: 1, a: A.id, at: NOW + w * (1 - share), x: 0, z: 0, yw: 0, tg: [], ...over }; };
const blow = (key, phase, share = 0.6, over = {}) => telegraphShape(atkOf(key, phase, share, over), phase, NOW, P);
const mark = (at = [0, 0], yaw = 0, body = BOSS_R) => { const s = markShape(at, yaw, [1, 0.5, 0.1], body); s.court = 0; return s; };
const pools = () => poolShapes([...FIGHTERS.map(([x, z]) => ({ x, z, r: POOLS.hellfire.r })), ...FIGHTERS.slice(0, 3).map(([x, z]) => ({ x: x * 0.7, z: z * 0.7, r: POOLS.meteor.r }))]
  .map((p) => ({ ...p, from: NOW - 2000, until: NOW + 4000 })), NOW, [1, 0.4, 0.1]);
const ADS = [
  { i: 1, k: HOST.harrier, x: 4, z: 7, yaw: 0, atk: { at: NOW + 300, x: 4, z: 7 } }, { i: 2, k: HOST.harrier, x: -7, z: 4, yaw: 0, atk: { at: NOW + 400, x: -7, z: 4 } },
  { i: 3, k: HOST.bearer, x: 9, z: -6, yaw: 0, atk: { at: NOW + 500, x: 9, z: -6 } }, { i: 4, k: HOST.bearer, x: -10, z: -8, yaw: 0, atk: { at: NOW + 600, x: -10, z: -8 } },
  { i: 5, k: HOST.sapper, x: 15, z: 10, yaw: 0, mv: { x: 15, z: 10, tx: 0, tz: 0, v: 2, at: NOW - 500 } }, { i: 6, k: HOST.sapper, x: -16, z: 9, yaw: 0, mv: { x: -16, z: 9, tx: 0, tz: 0, v: 2, at: NOW - 500 } },
];
const host = () => hostShapes({ x: 0, z: 0, yaw: 0, atk: null, fell: false, wrath: null, shieldUntil: NOW + 5000, lg: { ads: ADS } }, NOW, P, []).map((s) => ({ ...s, origin: [...s.origin], end: [...s.end] }));

// ── the fragment stage, on the code the GPU runs ─────────────────────────────────────────────────────────────────────
/** The fragment stage for shape `sh` (court 0, top-down), every derivative `fw`: answers (x, z) => [r, g, b, a], or null
 *  where it discards. */
function fragOf(sh, fw) {
  const fns = glslFunctions(TELEGRAPH_FS, {
    uKind: sh.kind, uOrigin: sh.origin, uYaw: sh.yaw, uR: sh.r, uHalfArc: sh.halfArc, uBody: sh.body, uEnd: sh.end, uHalfW: sh.halfW, uR0: sh.r0, uR1: sh.r1,
    uPts: Array.from({ length: TELEGRAPH_POINTS_MAX }, (_, i) => sh.points?.[i] ?? [0, 0]), uCount: sh.kind === TELEGRAPH_KIND.spokes ? sh.n : sh.points.length,
    uT: sh.t, uFlash: sh.flash, uAlpha: Math.min(1, sh.alpha), uColor: [...sh.color], uEdgeCol: [...(sh.edge ?? TELEGRAPH_EDGE)], uCourt: [...COURTS[0]], uFloorR: COURT_R,
    uStyle: sh.style ?? 0, uSince: sh.since ?? 0, uSpan: sh.span ?? 1, uAfter: sh.after ?? -1, uPool: sh.pool | 0, uRunS: sh.runS ?? 0, uLineW: 1.6,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0],
    vCourt: [0, 0], vWorld: [0, 0.05, 0], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => fw) : fw),
  });
  const G = fns.globals;
  return (x, z) => { G.vCourt = [x, z]; G.vWorld = [x, 0.05, z]; try { fns.main(); return [...G.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; } };
}
/** Whether a fragment changes the frame: drawn, and not the premultiplied nothing (ONE, ONE_MINUS_SRC_ALPHA of 0, 0). */
const writes = (o) => !!o && (o[0] !== 0 || o[1] !== 0 || o[2] !== 0 || o[3] !== 0);
/** The points of a box at `step`. */
function* grid(q, step) { for (let x = q[0]; x <= q[2] + 1e-9; x += step) for (let z = q[1]; z <= q[3] + 1e-9; z += step) yield [x, z]; }
const inBox = (q, [x, z]) => x >= q[0] && x <= q[2] && z >= q[1] && z <= q[3];
/** The pixel sizes the fragment stage is read at: a near floor's to a far rim's at a grazing look, and past it. */
const PIXELS = [0.002, 0.05, 0.6, 4];

test('AOE-PERF a: HIS MARK\'S QUAD IS ITS OWN GROUND - it holds every fragment the shader draws for it, at every pixel\'s size and under each term of its reach (the ring, the chevron\'s base, its tip), and is a third of the box it was (mutants: the reach back to the glow\'s; each term dropped)', () => {
  const real = mark([2, -3], 0.7);
  assert.equal(real.kind, TELEGRAPH_KIND.mark);
  const cases = [
    ['his mark', real],
    ['a Colossal Warden\'s', mark([-4, 5], 2.2, fightProfile(['colossal']).bossR)],
    ['the ring alone (a chevron of nothing)', { ...mark([1, 1], 0), r1: 1e-3, halfW: 0 }],
    ['a chevron wider than it is long', { ...mark([0, 2], 4), r1: 0.05, halfW: 2.5 }],
  ];
  for (const [label, sh] of cases) {
    const R = telegraphMarkReach(sh);
    const q = telegraphQuadOver(sh, 0);
    assert.deepEqual(q, [sh.origin[0] - R, sh.origin[1] - R, sh.origin[0] + R, sh.origin[1] + R], `${label}: its quad`);
    // the box it was: TELEGRAPH_REACH past the chevron's tip
    const wide = sh.r + sh.r1 + TELEGRAPH_REACH, was = [sh.origin[0] - wide, sh.origin[1] - wide, sh.origin[0] + wide, sh.origin[1] + wide];
    let drawn = 0;
    for (const fw of PIXELS) {
      const frag = fragOf(sh, fw);
      for (const p of grid(was, 0.17)) {
        if (!writes(frag(p[0], p[1]))) continue;
        drawn++;
        assert.ok(inBox(q, p), `${label}: drawn at ${p} (a pixel ${fw} m) - inside its quad`);
      }
    }
    assert.ok(drawn > 50, `${label}: drawn (${drawn})`);
  }
  const R = telegraphMarkReach(real), wide = real.r + real.r1 + TELEGRAPH_REACH;
  assert.ok((R / wide) ** 2 < 0.35, `a third of the ground it was (${((R / wide) ** 2).toFixed(2)})`);
  assert.match(TELEGRAPH_FS, new RegExp(`float ring = 1\\.0 - smoothstep\\(0\\.04, ${TELEGRAPH_MARK_RING.toFixed(1).replace('.', '\\.')}, abs\\(d - uR\\)\\);`), 'the shader reads the ring\'s reach from the one constant');
});

test('AOE-PERF b: A PATH\'S OR A TETHER\'S QUAD IS ITS OWN STRIP - the vertex stage lays the walkways\' quad along it, holding every fragment the shader draws for it at any pixel\'s size; the pass draws it so and puts the court\'s quad back for the next shape (mutants: no strip; the strip too narrow; its caps dropped; the stage reading another quad; the strip left on)', () => {
  const lanes = host().filter((s) => s.pool === TELEGRAPH_POOL.path);
  assert.equal(lanes.length, 4, 'two tethers, two paths');
  assert.equal(telegraphStrip(blow('charge', 1, 0.6, { tg: [[6, -9]] })), null, 'his Charge keeps its quad (it glows)');
  assert.equal(telegraphStrip(mark()), null);
  const vs = glslFunctions(TELEGRAPH_VS, { uVP: Array.from(I), uCentre: [0, 0, 0], uLo: [0, 0], uHi: [1, 1], uLift: TELEGRAPH_LIFT, uOnWalk: 0, uStrip: 1, uWalkA: [0, 0], uWalkU: [0, 1], uWalkLen: 1, uStripW: 1, aCourt: [0, 0], vCourt: [0, 0], vWorld: [0, 0, 0] });
  for (const sh of lanes) {
    const st = telegraphStrip(sh);
    // the strip's two triangles as the vertex stage lays them
    Object.assign(vs.globals, { uWalkA: [...st.a], uWalkU: [...st.u], uWalkLen: st.len, uStripW: st.w });
    const corners = [];
    for (let i = 0; i < TELEGRAPH_WALK_QUAD.length; i += 2) { vs.globals.aCourt = [TELEGRAPH_WALK_QUAD[i], TELEGRAPH_WALK_QUAD[i + 1]]; vs.main(); corners.push([...vs.globals.vCourt]); }
    const inStrip = ([x, z]) => {
      const tri = (a, b, c) => { const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = s(a, b, [x, z]), d2 = s(b, c, [x, z]), d3 = s(c, a, [x, z]); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
      return tri(corners[0], corners[1], corners[2]) || tri(corners[3], corners[4], corners[5]);
    };
    const was = telegraphBounds(sh);
    let drawn = 0;
    for (const fw of PIXELS) {
      const frag = fragOf(sh, fw);
      for (const p of grid(was, 0.13)) {
        if (!writes(frag(p[0], p[1]))) continue;
        drawn++;
        assert.ok(inStrip(p), `a lane from ${sh.origin} drawn at ${p} (a pixel ${fw} m) - inside its strip`);
      }
    }
    assert.ok(drawn > 20, `drawn (${drawn})`);
  }
  // the pass: the strip laid on the walkways' quad, then the court's quad back
  const { gl, calls } = recordingGl();
  const pass = new GateTelegraphRenderer(gl);
  const path = lanes.at(-1), st = telegraphStrip(path);
  calls.length = 0;
  pass.draw(path, I, I, [0, 0, 0], 1);
  assert.equal(pass.drawn, 1);
  assert.deepEqual([lastUniform(calls, 'uWalkA'), lastUniform(calls, 'uWalkU'), lastUniform(calls, 'uWalkLen'), lastUniform(calls, 'uStripW')], [st.a, st.u, [st.len], [st.w]], 'its strip');
  const seq = calls.filter((c) => (c[0] === 'uniform1i' && c[1] === 'uStrip') || c[0] === 'drawArrays' || c[0] === 'bindVertexArray').map((c) => (c[0] === 'drawArrays' ? `draw${c[3]}` : c[0] === 'bindVertexArray' ? `vao${c[1]?.vao ?? 0}` : `strip${c[2]}`));
  assert.deepEqual(seq, ['vao1', 'vao2', 'strip1', `draw${TELEGRAPH_WALK_QUAD.length / 2}`, 'strip0', 'vao1', 'vao0'], 'the court\'s quad bound, the walkways\' laid along the strip, the court\'s put back');
  calls.length = 0;
  pass.draw(blow('slam', 1), I, I, [0, 0, 0], 1);
  assert.ok(!calls.some((c) => c[1] === 'uStrip' && c[2] === 1), 'the next shape lays its own quad');
});

test('AOE-PERF c: every other shape keeps the quad its glow needs - TELEGRAPH_REACH past it: its keyline, its glow and its shockwave reach as far as the pixel is large (WB13a T14\'s law, held here against this slice\'s two)', () => {
  for (const sh of [blow('slam', 1), blow('cleave', 1, 0.6, { yw: 2 }), blow('charge', 1, 0.6, { tg: [[6, -9]] }), blow('hellfire', 3, 0.6, { tg: FIGHTERS }), blow('meteor', 2, 0.6, { tg: [[4, 5]] }), ...pools(), ...host().filter((s) => s.pool !== TELEGRAPH_POOL.path)]) {
    const B = telegraphBounds(sh);
    assert.ok(B, `kind ${sh.kind}`);
    const inner = sh.kind === TELEGRAPH_KIND.lane ? sh.halfW : sh.r;
    const lo = sh.kind === TELEGRAPH_KIND.discs ? Math.min(...sh.points.map((p) => p[0])) : Math.min(sh.origin[0], sh.end[0]);
    assert.ok(Math.abs(B[0] - (lo - inner - TELEGRAPH_REACH)) < 1e-9, `kind ${sh.kind} pool ${sh.pool}: TELEGRAPH_REACH past it`);
    assert.equal(telegraphStrip(sh), null);
  }
});

test('AOE-PERF d: THE COUNT at a fighter\'s eye - an AoE frame (his ground, his mark, his Nova, his host\'s) rasterises two fifths less of the telegraph; his mark alone, every frame of the fight, a third of what it did; his host\'s a third (mutants: the mark\'s quad back; no strip)', () => {
  const C = COURT_CENTRE;
  const pxOf = (vp, W, H) => (pts) => {
    let poly = pts.map(([x, z]) => { const p = [C[0] + x, C[1] + TELEGRAPH_LIFT, C[2] + z, 1]; return [0, 1, 2, 3].map((r) => vp[r] * p[0] + vp[4 + r] * p[1] + vp[8 + r] * p[2] + vp[12 + r] * p[3]); });
    for (const [ax, sg] of [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1]]) {
      const d = (v) => v[3] + sg * v[ax], next = [];
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], da = d(a), db = d(b); if (da >= 0) next.push(a); if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); next.push(a.map((v, j) => v + (b[j] - v) * t)); } }
      poly = next;
      if (!poly.length) return 0;
    }
    const s = poly.map((v) => [(v[0] / v[3] * 0.5 + 0.5) * W, (v[1] / v[3] * 0.5 + 0.5) * H]);
    let a = 0; for (let i = 0; i < s.length; i++) { const p = s[i], n = s[(i + 1) % s.length]; a += p[0] * n[1] - n[0] * p[1]; }
    return Math.abs(a) / 2;
  };
  const box = (q) => [[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]];
  /** the fragments the pass lays for `shapes` now: each one's quad, or its strip */
  const laid = (count, shapes) => shapes.reduce((a, sh) => {
    const q = telegraphQuadOver(sh, 0), st = telegraphStrip(sh);
    if (!q) return a;
    if (!st) return a + count(box(q));
    const n = [st.u[1], -st.u[0]], e = [st.a[0] + st.u[0] * st.len, st.a[1] + st.u[1] * st.len];
    return a + count([[st.a[0] - n[0] * st.w, st.a[1] - n[1] * st.w], [e[0] - n[0] * st.w, e[1] - n[1] * st.w], [e[0] + n[0] * st.w, e[1] + n[1] * st.w], [st.a[0] + n[0] * st.w, st.a[1] + n[1] * st.w]]);
  }, 0);
  /** what it laid before: every shape's quad TELEGRAPH_REACH past it (his mark's past its chevron's tip), in its court's square */
  const before = (count, shapes) => shapes.reduce((a, sh) => {
    const q = telegraphQuadOver(sh, 0);
    if (!q) return a;
    if (sh.kind !== TELEGRAPH_KIND.mark && !telegraphStrip(sh)) return a + count(box(q));
    const half = COURT_R + 0.5, w = sh.kind === TELEGRAPH_KIND.mark ? sh.r + sh.r1 + TELEGRAPH_REACH : sh.halfW + TELEGRAPH_REACH;
    const b = sh.kind === TELEGRAPH_KIND.mark ? [sh.origin[0] - w, sh.origin[1] - w, sh.origin[0] + w, sh.origin[1] + w]
      : [Math.min(sh.origin[0], sh.end[0]) - w, Math.min(sh.origin[1], sh.end[1]) - w, Math.max(sh.origin[0], sh.end[0]) + w, Math.max(sh.origin[1], sh.end[1]) + w];
    return a + count(box([Math.max(b[0], -half), Math.max(b[1], -half), Math.min(b[2], half), Math.min(b[3], half)]));
  }, 0);
  for (const [W, H] of [[960, 540], [1920, 1080]]) {
    for (const [eye, at] of [[[C[0], C[1] + 2.6, C[2] + 11.5], [C[0], C[1] + 1.6, C[2]]], [[C[0], C[1] + 1.62, C[2] + 8], [C[0], C[1] + 1.2, C[2]]]]) {
      const vp = multiply(mirrorProjectionX(perspective(Math.PI / 3, W / H, 0.05, 500)), lookAt(eye, at, [0, 1, 0]));
      const count = pxOf(vp, W, H);
      const aoe = [...pools(), mark(), blow('nova', 2), ...host()];
      const was = before(count, aoe), now = laid(count, aoe);
      assert.ok(was > 3 * W * H, `${W}x${H}: the AoE frame rasterised ${(was / (W * H)).toFixed(2)} screens`);
      assert.ok(now < 0.65 * was, `${W}x${H}: ${(now / (W * H)).toFixed(2)} screens now (${(now / was).toFixed(2)} of it)`);
      assert.ok(laid(count, [mark()]) < 0.35 * before(count, [mark()]), 'his mark: a third');
      assert.ok(laid(count, host()) < 0.4 * before(count, host()), `his host's: ${(laid(count, host()) / before(count, host())).toFixed(2)}`);
    }
  }
});
