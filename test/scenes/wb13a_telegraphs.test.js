// WB13a (2026-10-01, Mac: "continue to improve the boss, hone in telegraphs, and just overall bring more AAA grade
// polish to what is already developed"): THE TELEGRAPHS, HONED - bible/11-Multiplayer/World-Bosses.md section 20, T1-T14.
// Every shape read in Chromium at a fighter's eye and from above before this; here, the laws the reading found broken,
// held on the code the GPU runs (test/glsl.mjs) and on the court's own driver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glslFunctions, GlslDiscard } from '../glsl.mjs';
import {
  telegraphShape, telegraphField, telegraphBounds, telegraphQuadOver, poolShapes, telegraphEdge, telegraphLineW, rimDist,
  GateTelegraphRenderer, TELEGRAPH_FS, TELEGRAPH_KIND, TELEGRAPH_POINTS_MAX, TELEGRAPH_EDGE, TELEGRAPH_EDGE_DAGON, TELEGRAPH_EDGE_SAFE, TORMENT_EDGE, TORMENT_COLOR,
  TELEGRAPH_POOL, TELEGRAPH_REACH, TELEGRAPH_MARGIN, TELEGRAPH_THROB_MAX_HZ, TELEGRAPH_LINE_W_MAX,
} from '../../src/render/gate/gateTelegraph.js';
import { ATTACKS, ATTACK_BY_ID, COURT_R, COURTS, BOSS_REACH_R, HOST, HOST_BLOWS, BASE_PROFILE, fightProfile, windupOf, isDagons } from '../../src/net/gate/gateBrain.js';
import { inAttack } from '../../src/net/gate/gateStrike.js';
import { attackColor } from '../../src/world/gate/gateBoss.js';
import { hostShapes } from '../../src/scenes/gate/gateHost.js';
import { perilAt, wayOut, screenBearing, PERIL_RIM_M } from '../../src/scenes/gate/gateCourt.js';
import { groundViewModel, GROUND_VIEW_TEXT, PERIL_EDGE, PERIL_EDGE_NOW, PERIL_ARROW_STEP } from '../../src/ui/gate/gateGroundView.js';

const W = (key, over = {}) => ({ i: 1, a: ATTACKS[key].id, at: 10000, x: 0, z: 0, yw: 0, tg: [], ...over });
/** A fighter's run, m/s (net/gate/gateBrain.js's escape law). */
const RUN = 7.6;

/** The fragment stage at one point of the floor (court 0, top-down), with every derivative `fw` - answers [r, g, b, a]
 *  premultiplied, or null where it discards. */
function frag(sh, p, extra = {}, fw = 0.04) {
  const fns = glslFunctions(TELEGRAPH_FS, {
    uKind: sh.kind, uOrigin: sh.origin, uYaw: sh.yaw, uR: sh.r, uHalfArc: sh.halfArc, uBody: sh.body, uEnd: sh.end, uHalfW: sh.halfW,
    uR0: sh.r0, uR1: sh.r1, uPts: Array.from({ length: TELEGRAPH_POINTS_MAX }, (_, i) => sh.points?.[i] ?? [0, 0]), uCount: sh.kind === TELEGRAPH_KIND.spokes ? sh.n : (sh.points?.length ?? 0),
    uT: sh.t, uFlash: sh.flash, uAlpha: 1, uColor: [...sh.color], uEdgeCol: [...(sh.edge ?? TELEGRAPH_EDGE)], uCourt: [0, 0], uFloorR: COURT_R,
    uStyle: 0, uSince: sh.since, uSpan: sh.span, uAfter: sh.after, uPool: sh.pool | 0, uRunS: sh.runS ?? 0, uLineW: 1,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0],
    vCourt: p, vWorld: [p[0], 0.05, p[1]], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => fw) : fw), ...extra,
  });
  try { fns.main(); return [...fns.globals.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
}
const lum = (o) => (o ? o[0] + o[1] + o[2] : 0);

// ═══ T1: EVERY LIVE POOL DRAWN ═══════════════════════════════════════════════════════════════════════════════════════

test('WB13a T1: every live pool is drawn - a full group starts another (two phase-three Hellfires on five fighters left the newest ten unseen, and still biting); each group at most TELEGRAPH_POINTS_MAX, each court and radius its own (mutants: a full group dropping the rest)', () => {
  const pools = [];
  for (let i = 0; i < 20; i++) pools.push({ x: -10 + i, z: (i % 5) - 2, r: 3.5, from: i < 10 ? 0 : 3100, until: 9000, pct: 0.1, base: 1, el: 'fire' });
  pools.push({ x: 4, z: 4, r: 3, from: 3100, until: 9000, pct: 0.1, base: 1, el: 'fire' });   // Scarring's slam - its own radius
  const shapes = poolShapes(pools, 3200, [1, 0.4, 0.1]);
  const drawn = shapes.flatMap((s) => s.points.map((p) => `${p[0]},${p[1]},${s.r}`));
  for (const p of pools) assert.ok(drawn.includes(`${p.x},${p.z},${p.r}`), `the pool at ${p.x},${p.z} is drawn`);
  assert.ok(shapes.every((s) => s.points.length <= TELEGRAPH_POINTS_MAX && s.pool === TELEGRAPH_POOL.ground));
  assert.equal(shapes.filter((s) => s.r === 3.5).length, 2, 'twenty pools of one radius: two groups');
  assert.equal(shapes.filter((s) => s.r === 3).length, 1);
});

// ═══ T2: THE NOVA ESCAPED FROM EVERY POINT OF THE FLOOR ═══════════════════════════════════════════════════════════════

/** The longest way out of a ring (r0..r1 about B) for any point of court 0's floor inside it: inward to his feet (a
 *  straight line - the floor is round), or outward to r1 where that point is on the floor. */
function worstRingRun(B, r0, r1) {
  let worst = 0, at = null;
  for (let x = -COURT_R; x <= COURT_R; x += 0.25) {
    for (let z = -COURT_R; z <= COURT_R; z += 0.25) {
      if (Math.hypot(x, z) > COURT_R) continue;
      const d = Math.hypot(x - B[0], z - B[1]);
      if (d < r0 || d > r1) continue;
      const qx = B[0] + ((x - B[0]) / d) * r1, qz = B[1] + ((z - B[1]) / d) * r1;
      const out = Math.hypot(qx, qz) <= COURT_R ? r1 - d : Infinity;
      const run = Math.min(d - r0, out);
      if (run > worst) { worst = run; at = [x, z]; }
    }
  }
  return { worst, at };
}

test('WB13a T2: THE FLAME NOVA IS ESCAPED FROM EVERY POINT OF THE FLOOR - wherever he stands (within BOSS_REACH_R of the heart), the longest run out of its ring over the floor is within phase three\'s wind-up at 7.6 m/s; its ring ran 4-30 m on a floor of 24, and from his heart a fighter at the rim had 20 m to run (mutants: the ring back to 30)', () => {
  const A = ATTACKS.nova, budget = (RUN * windupOf(A, 3)) / 1000;
  assert.equal(A.r1, 16); assert.equal(A.r0, 4);
  const spots = [[0, 0], [BOSS_REACH_R / 2, 0], [0, -BOSS_REACH_R], [BOSS_REACH_R * 0.7, BOSS_REACH_R * 0.7]];
  for (const B of spots) {
    const { worst, at } = worstRingRun(B, A.r0, A.r1);
    assert.ok(worst <= budget, `him at ${B}: ${worst.toFixed(2)} m to run from ${at} - ${budget.toFixed(2)} m in the wind-up`);
  }
  assert.equal(worstRingRun([0, 0], A.r0, A.r1).worst, (A.r1 - A.r0) / 2, 'from the heart: half the ring');
  assert.ok(worstRingRun([0, 0], 4, 30).worst > budget, 'the old ring: out of reach from the rim');
  // every point the law calls inside is inside the strike's own ring
  for (const B of spots) for (const d of [3.9, 4.1, 15.9, 16.1]) assert.equal(inAttack(W('nova', { x: B[0], z: B[1] }), B[0] + d, B[1]), d >= 4 && d <= 16);
});

// ═══ T3: THE FILL MEETS THE RIM IT IS SEEN AT ═══════════════════════════════════════════════════════════════════════

test('WB13a T3: the fill reaches the edge a fighter can see as it lands - the Nova\'s and the Spokes\' far edge is the floor\'s rim where they reach past it (the Spokes ran 30 m on a floor of 24; with him off the heart the near spoke filled at half its wind-up) (mutants: the spoke filled to its length)', () => {
  // the Nova off the heart: toward the near rim the fill ends at the rim, the far way at its own ring
  const nova = telegraphShape(W('nova', { x: 12, z: 0 }), 2, 9000);
  assert.ok(Math.abs(telegraphField(nova, 24 - 0.001, 0).s - 1) < 1e-3, 'toward the near rim: full at the rim (12 m out)');
  assert.ok(Math.abs(telegraphField(nova, 12 - 16, 0).s - 1) < 1e-9, 'the far way: full at its own edge');
  // the Spokes from the heart reach the rim at 24 m, not their 30
  const sp = telegraphShape(W('spokes', { x: 0, z: 0, yw: 0 }), 3, 9000);
  assert.ok(Math.abs(telegraphField(sp, 0, 24).s - 1) < 1e-9 && Math.abs(telegraphField(sp, 0, 12).s - 0.5) < 1e-9);
  // the shader's own reading: the same coordinate (half way from its safe heart to the near rim, under the Nova)
  assert.ok(Math.abs(telegraphField(nova, 20, 0).s - 0.5) < 1e-9);
  const o = frag(nova, [20, 0], { uT: 0.45 }), o2 = frag(nova, [20, 0], { uT: 0.55 });
  assert.ok(lum(o2) > lum(o) + 0.3, 'the fill passes the half-way point at half its wind-up');
  assert.ok(Math.abs(rimDist(12, 0, 1, 0, 0, 0) - 12) < 1e-9 && Math.abs(rimDist(0, 0, 0, 1, 0, 0) - COURT_R) < 1e-9);
});

// ═══ T4, T5: THE LINE, THE FILL, THE LANDING ═════════════════════════════════════════════════════════════════════════

test('WB13a T4/T5: the line stands whole from the first frame - the brightest thing in the shape - while the inside comes up behind it; the last moments brighten the line alone; the landing is white-hot at once and decays to a dark scorch (mutants: the line faded in; the last moment flooding the shape; the landing held flat)', () => {
  const slam = W('slam'), w = ATTACKS.slam.windup;
  const at = (ms) => telegraphShape(slam, 1, ms);
  const edgeP = [7, 0], inP = [3.5, 0];
  const first = at(10000 - w + 16);
  assert.ok(lum(frag(first, edgeP)) > 2, `the line at the first frame (${lum(frag(first, edgeP)).toFixed(2)})`);
  assert.ok(lum(frag(first, inP)) < 0.15, 'the inside not yet up');
  const half = at(10000 - w / 2);
  assert.ok(lum(frag(half, edgeP)) > lum(frag(half, [1.5, 0])) * 1.3, 'the line brighter than the fill behind it at half its wind-up');
  // the last moment: the line brightens and the inside stays as it was a moment before
  const before = at(10000 - 400), last = at(10000 - 60);
  assert.ok(lum(frag(last, edgeP)) > lum(frag(before, edgeP)) * 1.2, 'the line flares in its last moment');
  assert.ok(lum(frag(last, inP)) < lum(frag(before, inP)) * 1.4, 'the inside does not flood');
  // the landing: white-hot, then a scorch that darkens the floor
  const hot = frag(at(10030), inP), cool = frag(at(10000 + 340), inP);
  assert.ok(lum(hot) > 2.2 && hot[1] > hot[0] * 0.6 && hot[2] > hot[0] * 0.4, `white-hot at the landing (${hot.map((v) => v.toFixed(2))})`);
  assert.ok(lum(cool) < lum(hot) / 3 && cool[3] > 0.25, 'a scorch: dim, and the floor darkened under it');
  assert.ok(lum(frag(at(10030), inP)) > lum(frag(last, inP)) * 2, 'the landing reads: far brighter than the moment before it');
});

test('WB13a T5: the Charge\'s landing follows his head down the lane - lit ahead of him, spent behind him', () => {
  const charge = W('charge', { x: 0, z: -10, yw: 0, tg: [[0, 12]] });
  const mid = telegraphShape(charge, 1, 10000 + ATTACKS.charge.active / 2);   // his head half way down
  assert.ok(mid.runS > 0);
  const ahead = frag(mid, [0, 8]), behind = frag(mid, [0, -8]);
  assert.ok(lum(ahead) > lum(behind) * 1.5, `ahead ${lum(ahead).toFixed(2)}, behind ${lum(behind).toFixed(2)}`);
});

// ═══ T8, T9: ONE DANGER EDGE; THE NOVA'S HEART COOL ═════════════════════════════════════════════════════════════════

test('WB13a T8: every pending outline wears ONE danger edge whatever it carries - Dagon\'s crimson for the Wrath and the Reckoning - and the element stays in the fill (the bar\'s callout colours untouched); his host\'s blows the same edge (mutants: the edge his aspect\'s)', () => {
  for (const md of [null, ['rime'], ['storm'], ['venom']]) {
    const P = fightProfile(md);
    for (const A of Object.values(ATTACKS)) {
      const sh = telegraphShape(W(A.key, { tg: [[3, 3]] }), 2, 9500, P);
      if (A === ATTACKS.gaze) { assert.equal(sh, null, 'WB14a: the Gaze lands on a view, never on the ground'); continue; }
      if (A === ATTACKS.torment) { assert.deepEqual([sh.edge, sh.color], [TORMENT_EDGE, TORMENT_COLOR], 'WB14a: a ring to gather in, in gold'); continue; }
      assert.deepEqual(sh.edge, isDagons(A) ? TELEGRAPH_EDGE_DAGON : TELEGRAPH_EDGE, `${A.key} under ${md}`);
      assert.deepEqual(sh.color, attackColor(A, P), `${A.key}: its element in the fill`);
    }
  }
  assert.equal(telegraphEdge(ATTACKS.wrath), TELEGRAPH_EDGE_DAGON);
  const s = { day: 1, phase: 1, shieldUntil: 0, fell: null, wrath: null, x: 0, z: 0, yaw: 0, mv: null, lg: { ads: [{ i: 1, k: HOST.harrier, x: 2, z: 2, atk: { at: 10000, x: 2, z: 2 } }] } };
  for (const sh of hostShapes(s, 9800, BASE_PROFILE)) if (sh.pool === TELEGRAPH_POOL.blow) assert.deepEqual(sh.edge, TELEGRAPH_EDGE);
  // the shader: a Rime Hellfire's line is the danger edge's colour, not frost's
  const P = fightProfile(['rime']);
  const hf = telegraphShape(W('hellfire', { tg: [[0, 0]] }), 2, 9500, P);
  const o = frag(hf, [3.5, 0]);
  assert.ok(o[0] > o[2] * 1.5, `the line reads danger, not frost (${o.map((v) => v.toFixed(2))})`);
});

test('WB13a T9: the Nova\'s safe heart has a cool edge, its danger field a hot one, and the field darkened within its first TELEGRAPH_FILL_IN_MS', () => {
  const nova = telegraphShape(W('nova'), 2, 10000 - ATTACKS.nova.windup + 30);
  const heart = frag(nova, [ATTACKS.nova.r0 - 0.02, 0]), outer = frag(nova, [ATTACKS.nova.r1 + 0.02, 0]);
  assert.ok(heart[2] > heart[0], `the heart's edge cool (${heart.map((v) => v.toFixed(2))})`);
  assert.ok(outer[0] > outer[2] * 2, 'the outer edge hot');
  assert.deepEqual([...TELEGRAPH_EDGE_SAFE].map((v) => v > 0.7), [true, true, true]);
  const field = frag(telegraphShape(W('nova'), 2, 10000 - ATTACKS.nova.windup + 150), [10, 0]);
  assert.ok(field && field[3] > 0.15, 'the field darkened at once');
});

// ═══ T11, T12: NO FLASHING; THE WAVE SIZED ════════════════════════════════════════════════════════════════════════

test('WB13a T11/T12: nothing flashes past three times a second - the throb on the line (AUDIT WB9 F3 counts it), Storm\'s crackle four times a second; the shockwave runs half its shape\'s size (1 to 3.5 m) and never into a safe heart (mutants: the crackle at twelve; the wave unsized)', () => {
  assert.equal(TELEGRAPH_THROB_MAX_HZ, 3);
  assert.match(TELEGRAPH_FS, /vnoise\(p \* 1\.3 \+ vec2\(floor\(t \* 4\.0\) \* 3\.1\)\)/, 'the crackle jumps four times a second');
  // a Bite (r 2): its wave reaches 1 m past its edge and no further; the Slam's 3.5
  const bite = { kind: TELEGRAPH_KIND.disc, origin: [0, 0], yaw: 0, r: HOST_BLOWS[HOST.harrier].r, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0,
    t: 1, flash: 1, alpha: 1, color: [1, 0.5, 0.2], edge: TELEGRAPH_EDGE, since: 2, span: 1, after: 0.2, runS: 0, pool: 0 };
  const r = bite.r;
  assert.ok(lum(frag(bite, [r + 1, 0])) > 0.2, 'the Bite\'s wave at a metre');
  assert.ok(lum(frag(bite, [r + 3, 0])) < 0.05, 'and not at three');
  const slam = telegraphShape(W('slam'), 1, 10000 + 200);
  assert.ok(lum(frag(slam, [7 + 3.5, 0])) > 0.2, 'the Slam\'s at 3.5 m');
  const nova = telegraphShape(W('nova'), 2, 10000 + 100);
  assert.ok(lum(frag(nova, [1.5, 0])) < 0.05, 'none into the Nova\'s heart');
});

// ═══ T6, T7: TERRAIN, PATHS, HIS MARK ═════════════════════════════════════════════════════════════════════════════

test('WB13a T6/T7: burning ground is terrain - the floor darkened under it, dim, its rim broken - never brighter than a blow still to come; a path or a tether is dashes flowing to him; his mark dashed and dim (mutants: the ground lit as a blow)', () => {
  const pool = poolShapes([{ x: 0, z: 0, r: 3.5, from: 0, until: 9000, pct: 0.1, base: 1, el: 'fire' }], 2000, [1, 0.45, 0.1])[0];
  const inPool = frag(pool, [1, 0]);
  const hf = telegraphShape(W('hellfire', { tg: [[0, 0]] }), 2, 10000 - 900);
  assert.ok(lum(inPool) < lum(frag(hf, [1, 0])), 'the ground dimmer than a Hellfire to come over the same floor');
  assert.ok(inPool[3] > 0.3, 'the floor darkened under it');
  // its rim broken: some of the rim lit, some not
  const rim = Array.from({ length: 64 }, (_, i) => { const a = (i / 64) * Math.PI * 2; return lum(frag(pool, [Math.sin(a) * 3.5, Math.cos(a) * 3.5])); });
  assert.ok(Math.max(...rim) > 0.15 && Math.min(...rim) < Math.max(...rim) * 0.5, 'a dashed rim');
  // a path: dashes moving along it toward its end (him)
  const path = { kind: TELEGRAPH_KIND.lane, origin: [0, -10], yaw: 0, r: 0, halfArc: 0, body: 0, end: [0, 10], halfW: 0.35, r0: 0, r1: 0, points: [], n: 0,
    t: 1, flash: 0, alpha: 1, color: [1, 0.5, 0.2], edge: TELEGRAPH_EDGE, since: 0, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.path };
  const lit = (z, since) => lum(frag({ ...path, since }, [0, z])) > 0.2;
  const front = (since) => { let z = -9.9; while (z < 9.9 && lit(z, since)) z += 0.01; while (z < 9.9 && !lit(z, since)) z += 0.01; return z; };   // the first dash's leading edge
  const f0 = front(0), f1 = front(0.1);
  assert.ok(f1 > f0 && f1 - f0 < 0.5, `the dashes run toward him (the first dash's front ${f0.toFixed(2)} -> ${f1.toFixed(2)})`);
  assert.equal(frag(path, [0, 0])[3], 0, 'a path darkens nothing');
  const warded = { day: 1, phase: 2, shieldUntil: 20000, fell: null, wrath: null, x: 0, z: 0, yaw: 0, mv: null, lg: { ads: [{ i: 2, k: HOST.bearer, x: 3, z: 3 }] } };
  const tethers = hostShapes(warded, 10000, BASE_PROFILE).filter((x) => x.kind === TELEGRAPH_KIND.lane);
  assert.ok(tethers.length && tethers.every((x) => x.pool === TELEGRAPH_POOL.path), 'a Ward-Bearer\'s tether is a path, never burning ground');
  // his mark: the ring dashed and dimmer than a blow's line
  assert.match(TELEGRAPH_FS, /float mark = 0\.4 \* ring \* dash \+ 0\.65 \* chev/);
});

// ═══ T10, T14: THE LINE'S WIDTH; A QUAD PER SHAPE ═══════════════════════════════════════════════════════════════════

test('WB13a T10/T14: the line\'s width is read off the edge\'s own derivative (wider on a short screen, up to TELEGRAPH_LINE_W_MAX); a shape\'s quad covers its own ground and every point it holds - the Nova\'s, the Spokes\' and the whole floor\'s their court (mutants: a quad short of its shape)', () => {
  assert.match(TELEGRAPH_FS, /float aa = max\(fwidth\(edge\), 1e-4\) \* uLineW;/);
  assert.equal(telegraphLineW(1080), 1); assert.equal(telegraphLineW(540), 1); assert.equal(telegraphLineW(390), Math.min(TELEGRAPH_LINE_W_MAX, 540 / 390)); assert.equal(telegraphLineW(200), TELEGRAPH_LINE_W_MAX);
  const cases = [W('cleave', { x: 3, z: -2, yw: 2.1 }), W('slam', { x: -5, z: 4 }), W('charge', { x: -8, z: -8, yw: 0.8, tg: [[9, 10]] }),
    W('hellfire', { tg: [[5, 5], [-9, 2], [0, -12]] }), W('leap', { tg: [[-6, 11]] }), W('meteor', { tg: [[10, -10]] })];
  for (const atk of cases) {
    const sh = telegraphShape(atk, 2, 9500), B = telegraphBounds(sh);
    assert.ok(B, `${ATTACK_BY_ID[atk.a].key} has its own bounds`);
    for (let x = -COURT_R; x <= COURT_R; x += 0.5) for (let z = -COURT_R; z <= COURT_R; z += 0.5) {
      if (Math.hypot(x, z) > COURT_R || !telegraphField(sh, x, z).inside) continue;
      assert.ok(x >= B[0] + TELEGRAPH_REACH - 0.01 && x <= B[2] - TELEGRAPH_REACH + 0.01 && z >= B[1] + TELEGRAPH_REACH - 0.01 && z <= B[3] - TELEGRAPH_REACH + 0.01, `${ATTACK_BY_ID[atk.a].key}: ${x},${z} inside its quad, its reach to spare`);
    }
  }
  for (const k of ['nova', 'spokes', 'wrath', 'reckon']) assert.equal(telegraphBounds(telegraphShape(W(k), 2, 9500)), null, `${k}: its whole court`);
  const half = COURT_R + TELEGRAPH_MARGIN;
  assert.deepEqual(telegraphQuadOver(telegraphShape(W('nova'), 2, 9500), 0), [-half, -half, half, half]);
  const bite = telegraphQuadOver({ kind: TELEGRAPH_KIND.disc, origin: [4, 4], r: 2 }, 0);
  assert.ok((bite[2] - bite[0]) * (bite[3] - bite[1]) < (2 * half) ** 2 / 15, 'a Bite\'s quad a sliver of the court\'s');
  assert.equal(telegraphQuadOver({ kind: TELEGRAPH_KIND.disc, origin: [4, 4], r: 2 }, 2), null, 'and nothing over a court it is not in');
  // the pass draws each shape once, over its own ground
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const pass = new GateTelegraphRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  pass.draw(telegraphShape(cases[1], 1, 9500), I, I, [0, 0, 0], 1);
  const lo = calls.find((c) => c[1] === 'uLo'), hi = calls.find((c) => c[1] === 'uHi');
  assert.deepEqual([lo[2], lo[3], hi[2], hi[3]], telegraphQuadOver(telegraphShape(cases[1], 1, 9500), 0));
  assert.equal(pass.drawn, 1);
});

// ═══ T13: IN IT ══════════════════════════════════════════════════════════════════════════════════════════════════

const STATE = (atk, extra = {}) => ({ day: 1, phase: 2, fell: null, wrath: null, atk, x: 0, z: 0, yaw: 0, shieldUntil: 0, lg: null, ...extra });

test('WB13a T13: A BLOW STILL TO COME ON MY FEET - his Cleave\'s shape is none of the frame at sword reach: while my feet stand in a blow to come (his, or his host\'s - the one landing soonest), its name, its wind-up, its line\'s colour and the nearest way out, turned as the screen is; never the whole floor\'s, never once it has landed (mutants: the peril never said; the way out turned the wrong way)', () => {
  const cleave = W('cleave', { x: 0, z: 0, yw: 0 });   // facing +z
  const t = 10000 - 700;
  const p = perilAt(STATE(cleave), t, BASE_PROFILE, 0, 3, 0);
  assert.ok(p, 'in the cone');
  assert.equal(p.name, 'Cleave'); assert.deepEqual(p.color, TELEGRAPH_EDGE); assert.ok(Math.abs(p.t - 0.5) < 1e-9); assert.equal(p.now, false);
  assert.ok(p.way && p.way.m <= 4.5, `a way out within a few steps (${p.way?.m} m)`);
  const out = [p.way.dir[0] * (p.way.m + 0.05), 3 + p.way.dir[1] * (p.way.m + 0.05)];
  assert.ok(!inAttack(cleave, out[0], out[1]), 'and it leads out of the cone');
  assert.equal(perilAt(STATE(cleave), t, BASE_PROFILE, 0, -3, 0), null, 'behind him: nothing');
  assert.equal(perilAt(STATE(cleave), 10000, BASE_PROFILE, 0, 3, 0), null, 'landed: nothing to flee');
  assert.equal(perilAt(STATE(cleave), 10000 - 100, BASE_PROFILE, 0, 3, 0).now, true, 'its last moment');
  assert.equal(perilAt(STATE(W('wrath')), 9000, BASE_PROFILE, 0, 3, 0), null, 'no step escapes the Wrath - never said');
  assert.equal(perilAt(STATE(cleave, { fell: { at: 1 } }), t, BASE_PROFILE, 0, 3, 0), null);
  assert.equal(perilAt(STATE(cleave), t, BASE_PROFILE, 0, 3, null).arrow, null, 'no camera, no arrow');
  // the screen's turn: ahead is 0, his right is 90 (scenes/world.js: ahead [sin, cos], right [cos, -sin])
  assert.ok(Math.abs(screenBearing([0, 1], 0)) < 1e-9 && Math.abs(screenBearing([1, 0], 0) - 90) < 1e-9 && Math.abs(Math.abs(screenBearing([0, -1], 0)) - 180) < 1e-9);
  assert.ok(Math.abs(screenBearing([1, 0], Math.PI / 2)) < 1e-9, 'facing +x, +x is ahead');
  // the charge's run: the lane ahead of his head, never behind him
  const charge = W('charge', { x: 0, z: -10, tg: [[0, 12]] });
  const run = 10000 + ATTACKS.charge.active / 2;
  assert.ok(perilAt(STATE(charge), run, BASE_PROFILE, 0, 8, 0), 'ahead of his head');
  assert.equal(perilAt(STATE(charge), run, BASE_PROFILE, 0, -8, 0), null, 'behind him');
  // his host's: a Bite to come on me, by name
  const B = HOST_BLOWS[HOST.harrier];
  const s = STATE(null, { lg: { ads: [{ i: 3, k: HOST.harrier, x: 5, z: 5, atk: { at: 10000, x: 5, z: 5 } }] } });
  const bite = perilAt(s, 10000 - B.windup / 2, BASE_PROFILE, 5.5, 5, 0);
  assert.equal(bite?.name, 'Bite');
  assert.ok(bite.way.m <= B.r + 0.5);
  // the one landing soonest - his host's before his own, and his own before his host's
  const both = STATE(W('slam', { at: 12000 }), { lg: s.lg });
  assert.equal(perilAt(both, 10000 - B.windup / 2, BASE_PROFILE, 5.5, 5, 0).name, 'Bite');
  const first = STATE(W('slam', { at: 10000 }), { lg: { ads: [{ i: 3, k: HOST.harrier, x: 4, z: 4, atk: { at: 10500, x: 4, z: 4 } }] } });
  assert.ok(inAttack(W('slam'), 4.5, 4), 'my feet in his Slam and the Bite both');
  const tt = Math.max(10500 - B.windup, 10000 - ATTACKS.slam.windup) + 10;
  assert.ok(tt < 10000, 'both winding up');
  assert.equal(perilAt(first, tt, BASE_PROFILE, 4.5, 4, 0).name, 'Ground Slam');
  // the way out stays on the floor
  const w = wayOut((x, z) => Math.hypot(x - 23, z) < 30, 22, 0, 0);
  assert.equal(w, null, 'no way out inside the floor: none said');
  const rimWay = wayOut((x, z) => Math.hypot(x - 20, z) < 3, 20, 0, 0);
  assert.ok(Math.hypot(20 + rimWay.dir[0] * rimWay.m, rimWay.dir[1] * rimWay.m) <= COURT_R - PERIL_RIM_M);
  // a nearer way out past the rim is none: the strip's far side (2.5 m on) is off the floor, its near side 7 m back
  const strip = wayOut((x) => x > 15 && x < 24.5, 22, 0, 0);
  assert.ok(strip && strip.dir[0] < -0.99 && Math.abs(strip.m - 7) <= 0.25, `back across the floor (${strip?.m} m)`);
});

test('WB13a T13: the rim and the warning for a blow to come - "Cleave - move!", the rim rising in the danger edge\'s colour as it winds up and at its height in its last moment, over the ground\'s warning; the arrow turned in steps (mutants: the ground\'s warning over a blow\'s)', () => {
  const peril = (t, now = false, arrow = 37) => ({ name: 'Cleave', t, now, color: TELEGRAPH_EDGE, arrow });
  const m0 = groundViewModel({ now: 0, peril: peril(0) }), m1 = groundViewModel({ now: 0, peril: peril(1) }), mn = groundViewModel({ now: 0, peril: peril(0.9, true) });
  assert.equal(m0.warn, GROUND_VIEW_TEXT.peril('Cleave')); assert.equal(m0.warn, 'Cleave - move!');
  assert.ok(Math.abs(m0.edge - PERIL_EDGE[0]) < 0.011 && Math.abs(m1.edge - PERIL_EDGE[1]) < 0.011 && Math.abs(mn.edge - PERIL_EDGE_NOW) < 0.011);
  assert.equal(m0.rgb, `${Math.round(TELEGRAPH_EDGE[0] * 255)}, ${Math.round(TELEGRAPH_EDGE[1] * 255)}, ${Math.round(TELEGRAPH_EDGE[2] * 255)}`);
  assert.equal(m0.arrow % PERIL_ARROW_STEP, 0); assert.ok(Math.abs(m0.arrow - 37) <= PERIL_ARROW_STEP / 2);
  const both = groundViewModel({ now: 0, inside: true, ground: 'Burning ground', peril: peril(0.5) });
  assert.equal(both.warn, 'Cleave - move!', 'a blow to come over the ground I stand in');
  assert.equal(groundViewModel({ now: 0, inside: true, ground: 'Rime' }).warn, 'Rime - step out!', 'the ground\'s own, alone');
  assert.equal(groundViewModel({ now: 0, peril: peril(0.5, false, null) }).arrow, null);
});

test('WB13a: the court feeds the warning every frame from my feet and the camera\'s yaw (scenes/world.js cam.yaw)', async () => {
  const { readFileSync } = await import('node:fs');
  const gc = readFileSync(new URL('../../src/scenes/gate/gateCourt.js', import.meta.url), 'utf8');
  assert.match(gc, /const peril = alive \? perilAt\(s, t, P, fp\[0\] - COURT_CENTRE\[0\], fp\[2\] - COURT_CENTRE\[2\], yaw\(\)\) : null;/);
  assert.match(readFileSync(new URL('../../src/scenes/world.js', import.meta.url), 'utf8'), /yaw: \(\) => cam\.yaw,   \/\/ WB13a/);
  assert.ok(COURTS.length === 6, 'WB14b: his three courts and the portents\' three floors');
});
