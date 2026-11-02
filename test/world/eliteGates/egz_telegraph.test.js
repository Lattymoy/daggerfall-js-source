// EG-ZG (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md sections 11.7, 25.2, 25.4, 25.5,
// 25.6 and 25.8 - EG6b, and what EG-G2, EG-G1 and EG-H1 left): THE TELEGRAPHS AS WRITTEN (world/eliteGates/egTelegraph.js the law;
// render/gate/gateTelegraph.js the Spire's stages and drawFloors; scenes/eliteGates/egFight.js; ui/eliteGates/egSpireHud.js; the quiet company in
// scenes/hostMagic.js, scenes/mwMagicFx.js, render/vfxGpu.js and scenes/hitEffects.js; scenes/eliteGates/egSpan.js and the dungeon
// arm). Each shape on every fight floor it covers, clipped to it at its own height, at most 32 draws a frame in THE
// TELEGRAPH BUDGET's order, the gate's own draw byte for byte; the peril arrow over the fight floor, never across an edge;
// the two tether grammars, a Spire pool, a Vestige aura's ring and the Eclipse's dark in the Spire's stage; the marks as
// sigils; the Shade's rim light; the heavy blows' shakes, allies' hits at 0.4, a Drop's thud and dust; allies' spells at
// 60% with no light of their own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import {
  egFightFloors, egClipTris, egFloorPlan, egPerilOf, egOnFloorAt, egTetherKind, egTetherBreak, egPullLook, egChainLook, egChainWords, egPoolRgb,
  egEclipseAt, egEclipseChip, egEclipseDark, egSigilsOf, egScreenAt, egViewYaw, egAuraHolders, egRimOf, egHeavyShake, egShakeMotion, egBodyFlash, egDropUnder, egOverDrop,
  EG_FLOOR_DRAWS_MAX, EG_PERIL, EG_CHECK_ORDER, EG_TETHER, EG_POOL_RAMP, EG_ECLIPSE_LOOK, EG_SIGILS, EG_SIGIL_RIM, EG_SIGIL_UP_M, EG_AURA_RING, EG_SHADE_RIM, EG_SHADE_BAND, EG_HEAVY_SHAKE, EG_MINE_ECHO_MS, EG_DROP_THUD,
} from '../../../src/world/eliteGates/egTelegraph.js';
import {
  GateTelegraphRenderer, TELEGRAPH_VS, TELEGRAPH_VS_SPIRE, TELEGRAPH_FS, TELEGRAPH_FS_SPIRE, TELEGRAPH_KIND, TELEGRAPH_POOL, TELEGRAPH_POOL_SPIRE, TELEGRAPH_POOL_HAVEN, TELEGRAPH_LIFT,
  TELEGRAPH_EDGE_DAGON, TELEGRAPH_THROB_MAX_HZ, spireTelegraphVs, spireTelegraphFs,
} from '../../../src/render/gate/gateTelegraph.js';
import { egCircleSpecs, egHallOf, egOnFight } from '../../../src/net/eliteGates/egLaw.js';
import { egGive8 } from '../../egGive8.mjs';   // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9): a law 8 circle given
import { EG_HAZARDS } from '../../../src/net/eliteGates/egFragLaw.js';
import { EG_FL, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_FIGHT_EMPTY, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { egHallCentre } from '../../../src/world/eliteGates/egHall.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { EG_BAND_RAMPS } from '../../../src/world/eliteGates/egBandArt.js';
import { gateHitFlash, GATE_FLASH_COURT } from '../../../src/world/gate/gateBoss.js';
import { createEgFight, egLookShapes } from '../../../src/scenes/eliteGates/egFight.js';
import { PERIL_BEARINGS, PERIL_STEP_M, PERIL_REACH_M, PERIL_RIM_M } from '../../../src/scenes/gate/gateCourt.js';
import { createEgSpan } from '../../../src/scenes/eliteGates/egSpan.js';
import { egSpireHudModel, drawEgSpireHud, drawEgSigils, egSigilHtml, EG_SIGIL_PATHS } from '../../../src/ui/eliteGates/egSpireHud.js';
import { egAllyLook, egAllyLookSet, EG_DANGER_PALETTES } from '../../../src/ui/eliteGates/egAccess.js';
import { egQuietCompany } from '../../../src/world/eliteGates/egLook.js';
import { vfxFade, VFX_VERTEX_FLOATS, VFX_COLOR_AT } from '../../../src/render/vfxGpu.js';
import { createHitEffects } from '../../../src/scenes/hitEffects.js';
import { lookAt, perspective, multiply, mirrorProjectionX, UP_Y } from '../../../src/world/mat4.js';
import { setPref } from '../../../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
/** The first circle (seeds 1-120, circles 1-20) one of whose specs `want` takes. PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 -
 *  2026-10-16): of spec law 8's halls, its circle given (test/egGive8.mjs) - the telegraph's pins were written on law 8's ground
 *  (a code-built court and its balcony, a Drop's wall, a Rift-Yard's floor); LAW 9's storeys are test/net/eliteGates/law9_height.test.js's */
function findSpec(want) {
  for (let seed = 1; seed <= 120; seed++) for (let c = 1; c <= 20; c++) for (const s8 of egCircleSpecs(seed, c, 0, 8)) if (want(s8)) { egGive8(seed, [c]); return { seed, c, s: egHallOf(seed, s8.h, 0) }; }
  throw new Error('no such hall');
}
/** A code-built Rift-Yard whose fight floors stand at two heights (its disc court and a balcony). PIN MOVED (AUDIT EG IV, the
 *  Fallen Stacks laid since): the first hall with two heights is now a hero's, whose floors are polygons (test/net/eliteGates/eghero_lay.test.js
 *  pins those), and the next a Deepway's, whose lanes run under its court. */
const twoFloors = (q) => !q.heroes && q.kind === 'yard' && q.fight && new Set((q.fl ?? []).map((f) => f.y)).size >= 2;
const triArea = (t, i) => Math.abs((t[i + 2] - t[i]) * (t[i + 5] - t[i + 1]) - (t[i + 4] - t[i]) * (t[i + 3] - t[i + 1])) / 2;
const areaOf = (t, n = t.length) => { let a = 0; for (let i = 0; i + 5 < n; i += 6) a += triArea(t, i); return a; };
/** A shape as the pass takes it (render/gate/gateTelegraph.js's own fields). */
const shapeOf = (o) => ({ kind: TELEGRAPH_KIND.disc, origin: [0, 0], yaw: 0, r: 3, halfArc: 0, body: 0, end: [0, 0], halfW: 0, r0: 0, r1: 0, points: [], n: 0, t: 0.5, flash: 0, alpha: 1,
  color: [1, 0.4, 0.1], edge: TELEGRAPH_EDGE_DAGON, court: 0, style: 0, since: 0.5, span: 1, after: -1, runS: 0, pool: TELEGRAPH_POOL.blow, mine: false, y: NaN, order: Infinity, ...o });
/** The gate's and the Spire's fragment stage at one point, the shape's uniforms as `u` says. */
function frag(src, p, u = {}, fw = 0.04) {
  const fns = glslFunctions(src, {
    uKind: TELEGRAPH_KIND.disc, uOrigin: [0, 0], uYaw: 0, uR: 4, uHalfArc: 0, uBody: 0, uEnd: [0, 0], uHalfW: 0, uR0: 0, uR1: 0, uPts: Array.from({ length: 10 }, () => [0, 0]), uCount: 0,
    uT: 0.6, uFlash: 0, uAlpha: 1, uColor: [1, 0.4, 0.1], uEdgeCol: [...TELEGRAPH_EDGE_DAGON], uCourt: [0, 0], uFloorR: 40, uStyle: 0, uSince: 1, uSpan: 2, uAfter: -1, uPool: 0, uRunS: 0, uLineW: 1,
    uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 20, 20], uFocus: [0, 0, 0, 0], uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0],
    uFogFloor: [0, 0, 1], uFillK: 1, uLook: 0, vCourt: p, vWorld: [p[0], 0.05, p[1]], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => fw) : fw), ...u,
  });
  try { fns.main(); return [...fns.globals.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
}
const lum = (o) => (o ? o[0] + o[1] + o[2] : 0);
/** A GL that records every call (the telegraph pass's tests' own - test/scenes/wb13a_telegraphs.test.js). */
function recordingGl() {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4, ARRAY_BUFFER: 1, FLOAT: 5, DYNAMIC_DRAW: 6, drawingBufferHeight: 720 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  return { gl, calls };
}
const I4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

test('EG-ZG THE SPIRE\'S STAGES (section 11.7; EG-G2\'s asserted swaps): the gate\'s vertex and fragment text never moved; the Spire\'s vertex stage made from the gate\'s with every needle found - with nothing set it lays the gate\'s quad where the gate does, on a floor it reads the floor\'s own triangle at the floor\'s height plus the lift; a lost needle is said (mutants: the floor\'s height dropped; the floor\'s triangle read as the quad)', () => {
  assert.ok(TELEGRAPH_VS_SPIRE !== TELEGRAPH_VS && !TELEGRAPH_VS.includes('uOnFloor') && !TELEGRAPH_FS.includes('uPool == 5'), 'the gate\'s own text carries none of the Spire\'s');
  assert.throws(() => spireTelegraphVs(TELEGRAPH_VS.replace('uniform float uLift;', 'uniform float uLiftM;')), /lost/);
  assert.throws(() => spireTelegraphFs(TELEGRAPH_FS.replace('  if (uPool == 1) {', '  if (uPool==1) {')), /lost/, 'the pools\' needle, asserted');
  const vs = (src, u) => { const f = glslFunctions(src, { uVP: I4, uCentre: [10, 2, -5], uLo: [-4, -3], uHi: [4, 5], uLift: TELEGRAPH_LIFT, uOnWalk: 0, uWalkA: [0, 0], uWalkU: [0, 1], uWalkLen: 0, aCourt: [0.25, 0.75], vCourt: [0, 0], vWorld: [0, 0, 0], gl_Position: [0, 0, 0, 0], ...u }); f.main(); return { c: [...f.globals.vCourt], w: [...f.globals.vWorld] }; };
  const gate = vs(TELEGRAPH_VS, {}), plain = vs(TELEGRAPH_VS_SPIRE, { uOnFloor: 0, uFloorY: 0 });
  assert.deepEqual(plain, gate, 'nothing set: the gate\'s quad, where the gate lays it');
  const on = vs(TELEGRAPH_VS_SPIRE, { uOnFloor: 1, uFloorY: 3.6, aCourt: [24.5, 31] });
  assert.deepEqual(on.c, [24.5, 31], 'a floor\'s triangle is already in the court\'s frame');
  assert.ok(Math.abs(on.w[1] - (2 + 3.6 + TELEGRAPH_LIFT)) < 1e-9 && Math.abs(on.w[0] - 34.5) < 1e-9 && Math.abs(on.w[2] - 26) < 1e-9, 'at the floor\'s height and the lift');
  const own = vs(TELEGRAPH_VS_SPIRE, { uOnFloor: 0, uFloorY: -4.5 });
  assert.ok(Math.abs(own.w[1] - (2 - 4.5 + TELEGRAPH_LIFT)) < 1e-9 && Math.abs(own.c[0] - gate.c[0]) < 1e-9, 'a shape\'s own surface: the gate\'s quad at its height');
  // the gate's own pass never asks for the floors' uniforms; the Spire's does
  const g = recordingGl(), s = recordingGl();
  new GateTelegraphRenderer(g.gl); new GateTelegraphRenderer(s.gl, { spire: true });
  assert.ok(!g.calls.some((c) => c[0] === 'getUniformLocation' && c[2] === 'uOnFloor') && s.calls.some((c) => c[0] === 'getUniformLocation' && c[2] === 'uOnFloor'));
});

test('EG-ZG EACH FIGHT FLOOR, TRIANGULATED ONCE (section 11.7): a court\'s disc its drawn rim\'s 48 sides, a lane its rectangle and two round ends (the floor test\'s own capsule), every triangle on its floor at its height; clipped to a box, exactly the box\'s share of it and nothing past it (mutants: a side lost; a clip that keeps what lies past its edge; a cut point off the box\'s line)', () => {
  const { s } = findSpec((q) => (q.fl ?? []).some((f) => f.t === 'l') && (q.fl ?? []).some((f) => f.t === 'd'));
  const floors = egFightFloors(s);
  assert.equal(floors.length, s.fl.length);
  for (const f of floors) {
    const P = f.piece, want = P.t === 'd' ? 0.5 * 48 * P.r * P.r * Math.sin((2 * Math.PI) / 48) : 2 * P.hw * Math.hypot(P.bx - P.ax, P.bz - P.az) + 2 * 0.5 * 12 * P.hw * P.hw * Math.sin(Math.PI / 12);
    assert.ok(Math.abs(areaOf(f.tris) - want) < 1e-3 * want, `${P.t}: its whole plan (${areaOf(f.tris).toFixed(2)} of ${want.toFixed(2)})`);
    if (P.t === 'd') assert.equal(f.tris.length, 48 * 6, 'the rim\'s own 48 sides');
    for (let i = 0; i + 5 < f.tris.length; i += 6) {
      const cx = (f.tris[i] + f.tris[i + 2] + f.tris[i + 4]) / 3, cz = (f.tris[i + 1] + f.tris[i + 3] + f.tris[i + 5]) / 3;
      assert.ok(egOnFloorAt(s, cx, cz, f.y), 'every triangle on its floor, at its height');
    }
    assert.ok(f.box[0] <= f.cx - (P.t === 'd' ? P.r : 0) + 1e-9 && f.R >= (P.t === 'd' ? P.r : P.hw));
  }
  // the clip: a box inside a court - exactly the box; a box over its rim - the disc's share; nothing past it
  const court = floors.find((f) => f.piece.t === 'd'), out = new Float32Array(20000);
  const inBox = [court.cx - 2, court.cz - 1, court.cx + 3, court.cz + 2];
  const n1 = egClipTris(court.tris, inBox, out, 0);
  assert.ok(Math.abs(areaOf(out, n1) - 15) < 1e-6, 'a box inside: the box');
  const R = court.piece.r, rim = [court.cx + R - 3, court.cz - 4, court.cx + R + 6, court.cz + 4];
  const n2 = egClipTris(court.tris, rim, out, 0);
  let grid = 0; for (let x = rim[0]; x < rim[2]; x += 0.02) for (let z = rim[1]; z < rim[3]; z += 0.02) if (egOnFight({ fl: [court.piece] }, x + 0.01, z + 0.01)) grid += 0.0004;
  assert.ok(Math.abs(areaOf(out, n2) - grid) < 0.05 * grid, `over the rim: the disc's share (${areaOf(out, n2).toFixed(2)} ~ ${grid.toFixed(2)})`);
  for (let i = 0; i < n2; i += 2) assert.ok(out[i] >= rim[0] - 1e-6 && out[i] <= rim[2] + 1e-6 && out[i + 1] >= rim[1] - 1e-6 && out[i + 1] <= rim[3] + 1e-6, 'nothing past the box');
  assert.equal(egClipTris(court.tris, [court.cx + R + 1, court.cz, court.cx + R + 5, court.cz + 1], out, 0), 0, 'a box off the floor: nothing');
  assert.equal(egClipTris(court.tris, null, out, 0), court.tris.length, 'no box: the whole floor');
  assert.equal(egFightFloors({ fl: [] }).length, 0);
});

test('EG-ZG THE FLOOR BUDGET (sections 11.7 and 25.4): a blow on the court drawn on the court alone - never the balcony 3.6 m over it, whatever its bounds cover; a balcony\'s on the balcony; the whole floor\'s on every floor; at most 32 shape-floor draws, what holds my feet and the budget\'s first blows always among them, mine drawn last; a shape with its own surface one quad at its height; a hall with no fight floor every shape its quad (mutants: the budget past 32; my shapes first; a court blow on the balcony; the rank ignored)', () => {
  const { s } = findSpec(twoFloors);
  const floors = egFightFloors(s), court = s.fl.find((f) => f.t === 'd' && f.y === 0), bal = s.fl.find((f) => f.y > 0);
  const onCourt = shapeOf({ origin: [bal.x - Math.sign(bal.x) * (bal.r + 1.5), bal.z], r: 4 });   // its bounds reach over the balcony
  const p1 = egFloorPlan([onCourt], floors, null, null);
  assert.ok(p1.draws.length >= 1 && p1.draws.every((d) => d.f.y === 0), 'the court\'s blow on the court alone');
  // PIN MOVED (AUDIT EG V, e: egShapeYs retired - once the floor plan read a shape's heights in place, L6-4, no producer
  // read it; the plan's own draws, above and below, pin the heights it lands at)
  const onBal = shapeOf({ origin: [bal.x, bal.z], r: 2 });
  assert.ok(egFloorPlan([onBal], floors, null, null).draws.every((d) => d.f.y === bal.y), 'a balcony\'s on its balcony');
  const all = shapeOf({ kind: TELEGRAPH_KIND.all });
  assert.equal(egFloorPlan([all], floors, null, null).draws.length, floors.length, 'the whole floor\'s on every floor');
  for (const d of egFloorPlan([all], floors, null, null).draws) assert.equal(d.count * 2, d.f.tris.length, 'its floor whole');
  // the budget
  const me = [court.x, court.z], many = [];
  for (let i = 0; i < 40; i++) many.push(shapeOf({ origin: [court.x + 12 + (i % 5), court.z - 10 + i * 0.4], r: 1, order: 40 - i }));   // many[39] the budget's first
  const onMe = shapeOf({ origin: [...me], r: 2 }), mine = shapeOf({ origin: [court.x + 5, court.z], r: 2, mine: true });
  const plan = egFloorPlan([...many, onMe, mine], floors, me, null);
  assert.equal(EG_FLOOR_DRAWS_MAX, 32);
  assert.equal(plan.draws.length, 32, 'thirty-two draws, no more');
  const drawnSet = new Set(plan.draws.map((d) => d.sh));
  assert.ok(drawnSet.has(onMe) && drawnSet.has(mine), 'what holds my feet and what is aimed at me, always - before any ranked blow');
  for (let i = 10; i < 40; i++) assert.ok(drawnSet.has(many[i]), `the budget's thirty first-ranked blows drawn (${40 - i})`);
  for (let i = 0; i < 10; i++) assert.ok(!drawnSet.has(many[i]), `the last-ranked cut (${40 - i})`);
  assert.equal(plan.draws.at(-1).sh, mine, 'mine drawn last, on top');
  assert.ok(plan.n <= plan.buf.length && plan.draws.every((d) => d.first * 2 + d.count * 2 <= plan.n));
  // a shape's own surface; a hall with no fight floor
  const own = shapeOf({ origin: [3, 4], r: 1.2, y: -4.5 }), p2 = egFloorPlan([own], floors, null, null);
  assert.equal(p2.draws.length, 1); assert.equal(p2.draws[0].f, null); assert.ok(p2.draws[0].over.r > 1.2 && Math.abs(p2.draws[0].over.courts[0][0] - 3) < 1e-9 && Math.abs(p2.draws[0].over.courts[0][1] - 4) < 1e-9, 'one quad at its height, over its own circle');
  assert.deepEqual(egFloorPlan([onCourt, all], [], null, null).draws.map((d) => [d.f, d.over]), [[null, null], [null, null]], 'no fight floor: the hall\'s court, as before');
  assert.equal(egFloorPlan([shapeOf({ alpha: 0 })], floors, null, null).draws.length, 0, 'nothing for a shape faded out');
});

test('EG-ZG THE FLOORS\' DRAWS THROUGH THE PASS (render/gate/gateTelegraph.js drawFloors): the frame\'s triangles uploaded once, each floor\'s draw the gate\'s own draw over that floor\'s triangles - its count, its height, its circle the court - and a shape\'s own surface the gate\'s quad at its height; the pass\'s quad and the floors\' uniforms put back after; the gate\'s own pass draws nothing by it (mutants: the floor\'s height never set; the quad not given back)', () => {
  const { s } = findSpec(twoFloors);
  const floors = egFightFloors(s), court = s.fl.find((f) => f.t === 'd' && f.y === 0), bal = s.fl.find((f) => f.y > 0);
  const plan = egFloorPlan([shapeOf({ origin: [1, 2], r: 1, y: -4.5 }), shapeOf({ origin: [court.x, court.z], r: 3 }), shapeOf({ origin: [bal.x, bal.z], r: 2 })], floors, null, null);
  const { gl, calls } = recordingGl();
  const pass = new GateTelegraphRenderer(gl, { spire: true }), vao = pass.vao, count = pass.count;
  calls.length = 0;
  pass.drawFloors(plan, I4, I4, [0, 0, 0], 1, null, [0, 0, 0]);
  assert.equal(calls.filter((c) => c[0] === 'bufferSubData').length, 1, 'uploaded once');
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.deepEqual(draws.map((c) => c[3]), [6, ...plan.draws.filter((d) => d.f).map((d) => d.count)], 'the quad, then each floor\'s triangles');
  const ys = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uFloorY').map((c) => c[2]);
  assert.deepEqual(ys, [-4.5, 0, bal.y, 0], 'each at its height, and the hall\'s floor again after');
  const on = calls.filter((c) => c[0] === 'uniform1i' && c[1] === 'uOnFloor').map((c) => c[2]);
  assert.deepEqual(on, [0, 1, 1, 0], 'the quad, the floors\' triangles, and the quad again after');
  const courtR = calls.filter((c) => c[0] === 'uniform1f' && c[1] === 'uFloorR').map((c) => c[2]);
  assert.deepEqual(courtR.slice(1, 3), [court.r, bal.r], 'each floor\'s own circle is its court');
  assert.equal(pass.vao, vao); assert.equal(pass.count, count, 'the quad given back');
  assert.equal(pass.floorDraws, 3);
  // AOE-PERF, at the merge of main: a path's own strip is the gate's quad's, never a floor's - over a fight floor its
  // triangles are its ground, and the strip's walkway quad read as a floor's triangle (uOnFloor) lies at the court's origin
  const path = shapeOf({ kind: TELEGRAPH_KIND.lane, pool: TELEGRAPH_POOL.path, origin: [court.x - 2, court.z], end: [court.x + 2, court.z], halfW: 0.6 });
  const pp = egFloorPlan([path], floors, null, null);
  assert.ok(pp.draws.length > 0 && pp.draws.every((d) => d.f), 'the path lies on a fight floor');
  calls.length = 0;
  pass.drawFloors(pp, I4, I4, [0, 0, 0], 1, null, [0, 0, 0]);
  assert.ok(!calls.some((c) => c[0] === 'uniform1i' && c[1] === 'uStrip' && c[2] === 1), 'no strip over a floor\'s triangles');
  assert.deepEqual(calls.filter((c) => c[0] === 'drawArrays').map((c) => c[3]), pp.draws.map((d) => d.count), 'each floor\'s own triangles');
  const g = recordingGl(), gate = new GateTelegraphRenderer(g.gl);
  g.calls.length = 0; gate.drawFloors(plan, I4, I4, [0, 0, 0], 1);
  assert.equal(g.calls.length, 0, 'the gate\'s own pass: nothing');
});

test('EG-ZG THE GRAMMARS\' POOLS (sections 25.2, 25.4 and 25.5) in the Spire\'s stage: a Spire pool lit in its colour with a DASHED danger rim and the floor darkened; a pull-apart tether\'s chevrons pointing out from its middle and flowing outward, its tick at the break; a stay-close tether\'s links, dim when slack and bright and throbbing under three beats a second when taut - never the pull\'s pattern; a Vestige aura one thin blue line at 0.6 m; the Eclipse\'s dark everywhere but the moon-shafts (mutants: the rim solid; the chevrons pointing in; the links never taut; the ring filled; the havens darkened)', () => {
  // A SPIRE POOL
  const pool = [0.45, 0.19, 0.05], P = (p, u = {}) => frag(TELEGRAPH_FS_SPIRE, p, { uPool: TELEGRAPH_POOL_SPIRE.pool, uColor: pool, ...u });
  const inside = P([1, 0]);
  assert.ok(inside[3] > 0.3, 'the floor darkened under it');
  assert.ok(Math.abs(inside[0] / inside[1] - pool[0] / pool[1]) < 0.05, 'in its own colour, never the burning ground\'s orange');
  const rim = []; for (let a = 0; a < Math.PI * 2; a += Math.PI / 60) rim.push(lum(P([Math.sin(a) * 4, Math.cos(a) * 4])));
  assert.ok(Math.max(...rim) > 0.4 && Math.min(...rim) < Math.max(...rim) * 0.4, 'its rim dashed');
  const dash = []; for (let a = 0; a < Math.PI * 2; a += Math.PI / 60) { const o = P([Math.sin(a) * 4, Math.cos(a) * 4]); if (lum(o) > 0.8) dash.push(o); }
  assert.ok(dash.length && dash.every((o) => o[0] > 2.5 * o[1] && o[2] > 0.8 * o[1]), 'its dashes in the danger edge (crimson), never the pool\'s own brown');
  // A PULL-APART TETHER: from (-L/2, 0) to (L/2, 0) along x, the pair 3 m each side of the middle, the break 4.5 m each side
  const T = (p, u = {}) => frag(TELEGRAPH_FS_SPIRE, p, { uKind: TELEGRAPH_KIND.lane, uOrigin: [-5.1, 0], uEnd: [5.1, 0], uHalfW: 0.3, uR: 3, uR1: 4.5, uPool: TELEGRAPH_POOL_SPIRE.pull, uSince: 0, ...u });
  const along = (ld, since = 0) => { const row = []; for (let x = 0.05; x < 3; x += 0.05) row.push(lum(T([x, ld], { uSince: since }))); return row; };
  /** the shift (in 0.05 m samples, mod its 1.2 m period) that lays row `b` on row `a`: b[i] ~ a[i + k] */
  const shiftOf = (a, b) => { let best = 0, score = -1; for (let k = 0; k < 24; k++) { let n = 0; for (let i = 0; i + k < a.length; i++) if ((a[i + k] > 0.5) === (b[i] > 0.5)) n++; if (n > score) { score = n; best = k; } } return best; };
  const c0 = along(0), c1 = along(0.15);
  assert.ok(c0.some((v) => v > 0.5) && c0.some((v) => v < 0.5), 'chevrons along it');
  const k1 = shiftOf(c0, c1);
  assert.ok(k1 >= 3 && k1 <= 7, `off its line the pattern stands ~0.24 m nearer the middle - each apex points OUT (${k1} samples)`);
  const later = along(0, 0.2), k2 = shiftOf(c0, later);
  assert.ok(k2 >= 16 && k2 <= 20, `flowing outward, away from the middle (${k2} samples)`);
  assert.ok(lum(T([4.5, 0])) > 0.8 && lum(T([4.5, 0.5])) > 0.3, 'a tick across it at the break');
  assert.ok(lum(T([3.7, 0])) < 0.05, 'nothing past the pair but the tick');
  assert.ok(lum(T([-2, 0.1])) > 0 || lum(T([-2.6, 0.1])) > 0, 'both halves');
  // A STAY-CLOSE TETHER: the same lane, its links
  const C = (p, u = {}) => frag(TELEGRAPH_FS_SPIRE, p, { uKind: TELEGRAPH_KIND.lane, uOrigin: [-3, 0], uEnd: [3, 0], uHalfW: 0.3, uR: 3, uPool: TELEGRAPH_POOL_SPIRE.chain, uSince: 0, uT: 0, ...u });
  const links = []; for (let x = -2.95; x < 2.95; x += 0.05) links.push(lum(C([x, 0.2])));
  assert.ok(Math.max(...links) > 0.1 && Math.min(...links) < Math.max(...links) * 0.3, 'links, and between them nothing');
  const slack = Math.max(...links), taut = []; for (let x = -2.95; x < 2.95; x += 0.05) taut.push(lum(C([x, 0.2], { uT: 1 })));
  assert.ok(Math.max(...taut) > slack * 1.8, 'taut: bright');
  const throb = []; for (let ts = 0; ts < 2; ts += 0.01) throb.push(lum(C([taut.indexOf(Math.max(...taut)) * 0.05 - 2.95, 0.2], { uT: 1, uSince: ts })));
  let peaks = 0; for (let i = 1; i + 1 < throb.length; i++) if (throb[i] > throb[i - 1] && throb[i] >= throb[i + 1]) peaks++;
  assert.ok(peaks >= 2 && peaks <= 2 * TELEGRAPH_THROB_MAX_HZ, `throbbing, never past three beats a second (${peaks / 2} Hz)`);
  // never the pull's pattern: across the same ground the two disagree almost everywhere one is lit
  let both = 0, either = 0;
  for (let x = -2.9; x < 2.9; x += 0.1) for (let z = 0; z < 0.3; z += 0.05) { const a = lum(T([x, z], { uOrigin: [-3, 0], uEnd: [3, 0], uR: 3, uR1: 4.5 })) > 0.3, b = lum(C([x, z], { uT: 1 })) > 0.15; if (a || b) either++; if (a && b) both++; }
  assert.ok(either > 20 && both / either < 0.5, `the two never share a pattern (${both} of ${either})`);
  // A VESTIGE AURA
  const blue = [...EG_AURA_RING.color], Rg = (p) => frag(TELEGRAPH_FS_SPIRE, p, { uR: EG_AURA_RING.r, uPool: TELEGRAPH_POOL_SPIRE.ring, uColor: blue, uEdgeCol: blue }, 0.004);
  const line = Rg([0.6, 0]);
  assert.ok(line && line[2] > line[0] && lum(line) > 0.5, 'its line, blue');
  assert.ok(lum(Rg([0.3, 0])) < 0.01 && line[3] === 0, 'nothing within it, the floor never darkened - a ring, never a cloud');
  // THE ECLIPSE'S DARK
  const pts = Array.from({ length: 10 }, (_, i) => (i < 2 ? [i * 10, 0] : [0, 0]));
  const D = (p, uT) => frag(TELEGRAPH_FS_SPIRE, p, { uKind: TELEGRAPH_KIND.all, uPool: TELEGRAPH_POOL_SPIRE.dark, uPts: pts, uCount: 2, uR: 3, uT });
  assert.ok(Math.abs(D([5, 5], 0.6)[3] - 0.6) < 1e-6 && lum(D([5, 5], 0.6)) === 0, 'the floor darkened by its share');
  assert.ok(D([10, 1], 0.6)[3] < 0.01 && D([0, 0], 0.6)[3] < 0.01, 'every moon-shaft kept');
  assert.ok(D([5, 5], 0)[3] === 0, 'none before its last seconds');
  // the haven and the gate's own blow untouched by the pools
  assert.ok(lum(frag(TELEGRAPH_FS_SPIRE, [1, 0], { uPool: TELEGRAPH_POOL_HAVEN })) > 0 && Math.abs(lum(frag(TELEGRAPH_FS, [1, 0])) - lum(frag(TELEGRAPH_FS_SPIRE, [1, 0]))) < 1e-9);
});

test('EG-ZG THE PERIL ARROW (section 25.5): the soonest blow on my feet, its way out searched over MY fight floor - out of the shape, never across an open edge or onto another floor - preferring a bearing that also clears every other pending shape; a CHECK\'s way into the light, and with none in reach its order; nothing on traversal ground or under the whole floor\'s (mutants: the edge crossed; the clear bearing ignored; the CHECK\'s order never said; a landed blow fled)', () => {
  const { s } = findSpec(twoFloors);
  const court = s.fl.find((f) => f.t === 'd' && f.y === 0), t = 10_000;
  const blow = (stamp, o = {}) => ({ s: [stamp], at: t + 800, wu: 1500, nm: 'Smash', ch: 0, ...o });
  // at the court's middle under a disc of r 3: out in 3 m, any bearing
  const me = [court.x, court.z], p = egPerilOf([blow(['d', court.x, court.z, 3])], me, 0, s, t);
  assert.ok(p && p.name === 'Smash' && p.dir && Math.abs(p.m - 3.25) < 0.26, `out in a few steps (${p?.m})`);
  assert.ok(Math.abs(p.t - (700 / 1500)) < 1e-9 && p.now === false && p.check === false);
  // at the rim, the blow's centre inward: the way out never runs off the edge - it runs round, inward or along the rim
  const rimMe = [court.x + court.r - 1, court.z], q = egPerilOf([blow(['d', court.x + court.r - 3, court.z, 4])], rimMe, 0, s, t);
  assert.ok(q && q.dir, 'a way out on the floor');
  for (let m = EG_PERIL.step; m <= q.m; m += EG_PERIL.step) assert.ok(egOnFloorAt(s, rimMe[0] + q.dir[0] * m, rimMe[1] + q.dir[1] * m, 0, EG_PERIL.rim), 'never across the open edge');
  // two blows: the nearer way out lies in the second; the arrow takes the one that clears both
  const two = [blow(['d', court.x - 1, court.z, 3]), blow(['d', court.x + 3.5, court.z, 2.5], { at: t + 1200 })];   // the nearest way out (+x, 2.25 m) runs into the second
  const alone = egPerilOf([two[0]], me, 0, s, t), aEnd = [me[0] + alone.dir[0] * alone.m, me[1] + alone.dir[1] * alone.m];
  assert.ok(alone.dir[0] > 0.5 && Math.hypot(aEnd[0] - court.x - 3.5, aEnd[1] - court.z) < 2.5, 'alone, the nearest way out runs into the second');
  const w = egPerilOf(two, me, 0, s, t);
  const end = [me[0] + w.dir[0] * w.m, me[1] + w.dir[1] * w.m];
  assert.ok(Math.hypot(end[0] - court.x - 3.5, end[1] - court.z) > 2.5 && Math.hypot(end[0] - court.x + 1, end[1] - court.z) > 3, `a bearing that clears every pending shape (${w.dir.map((v) => v.toFixed(2))})`);
  // a CHECK: the light in reach - its way; none - its order
  const lit = egPerilOf([blow(['h', court.x + 6, court.z, 3], { ch: 1, nm: 'The Eclipse' })], me, 0, s, t);
  assert.ok(lit.check && lit.dir && lit.dir[0] > 0.9, 'into the light');
  const dark = egPerilOf([blow(['h', court.x + 60, court.z, 3], { ch: 1, nm: 'The Eclipse' })], me, 0, s, t);
  assert.ok(dark.check && dark.dir === null, 'no light in reach: no arrow - its order instead');
  assert.equal(EG_CHECK_ORDER, 'Stand in the light!');
  assert.deepEqual([EG_PERIL.bearings, EG_PERIL.step, EG_PERIL.reach, EG_PERIL.rim], [PERIL_BEARINGS, PERIL_STEP_M, PERIL_REACH_M, PERIL_RIM_M], 'the gate\'s own search');
  // never: the whole floor's, a landed blow, a blow not on me, traversal ground
  assert.equal(egPerilOf([blow(['a'])], me, 0, s, t), null, 'no step escapes the whole floor\'s');
  assert.equal(egPerilOf([blow(['d', court.x, court.z, 3], { at: t - 1 })], me, 0, s, t), null, 'landed: nothing to flee');
  assert.equal(egPerilOf([blow(['d', court.x + 10, court.z, 3])], me, 0, s, t), null);
  assert.equal(egPerilOf([blow(['d', court.x, court.z, 3])], me, 9, s, t), null, 'off every fight floor (in the air over it): none');
  assert.equal(egPerilOf([blow(['d', court.x, court.z, 3])], [court.x + court.r + 8, court.z], 0, s, t), null, 'traversal ground: none');
  assert.ok(egPerilOf([blow(['d', court.x, court.z, 3], { at: t + 100 })], me, 0, s, t).now, 'its last moment');
});

test('EG-ZG THE TETHERS\' LAW, A SPIRE POOL\'S COLOUR AND THE ECLIPSE (sections 25.2 and 25.5): a drain and a Blood Tether pull apart, a chain stays close; the drain\'s break unpacked from its reach; a pull-apart thins toward its break, its lane reaching its tick; a chain slack under 6 m, taut at 8, its chip; a pool the band\'s ramp darkened, never the burning orange, never blue; the Eclipse\'s chip while it is told, its dark over the last 2 s (mutants: the chain read as a pull; the drain\'s break its reach; the pool undarkened; the dark from the first second)', () => {
  assert.deepEqual([egTetherKind([1, 'a', 0, 810]), egTetherKind(['a', 'b', 1, 450]), egTetherKind(['a', 'b', 2, 800])], ['pull', 'pull', 'close']);
  assert.deepEqual([egTetherBreak([1, 'a', 0, 810]), egTetherBreak(['a', 'b', 1, 450]), egTetherBreak(['a', 'b', 2, 800])], [10, 4.5, 8]);
  const near = egPullLook([0, 0], [2, 0], 10), far = egPullLook([0, 0], [9, 0], 10);
  assert.ok(near.halfW > far.halfW && far.halfW >= EG_TETHER.half * EG_TETHER.thin - 1e-9 && near.halfW <= EG_TETHER.half, 'it thins as the pair nears the break');
  assert.deepEqual([near.r, near.r1], [1, 5]);
  assert.ok(Math.abs(near.end[0] - near.origin[0] - 2 * (5 + EG_TETHER.past)) < 1e-9, 'its lane reaches past its tick');
  assert.ok(Math.abs(egPullLook([0, 0], [12, 0], 10).end[0] - 12) < 1e-9, 'past the break: the pair\'s own length');
  assert.deepEqual([egChainLook(4).taut, egChainLook(7).taut, egChainLook(8).taut, egChainLook(9).taut], [0, 0.5, 1, 1]);
  assert.equal(egChainLook(6.8).chip, '6.8/8 m');
  assert.equal(egChainWords('Mira', 6.84), 'Chained to Mira - 6.8/8 m');
  for (let b = 0; b < 4; b++) {
    const c = egPoolRgb(b), src = EG_BAND_RAMPS[b][EG_POOL_RAMP[b]][2];
    assert.ok(Math.abs(c[0] - src[0] / 510) < 1e-9 && Math.abs(c[2] - src[2] / 510) < 1e-9, `band ${b}: its ramp, darkened`);
    assert.ok(!(c[2] > 1.3 * c[0] && c[2] > 1.3 * c[1]), `band ${b}: never blue`);
    assert.notDeepEqual(c, [1.0, 0.42, 0.12]);
  }
  const { s } = findSpec((q) => q.hazards?.some((z) => z.kind === 'eclipse'));
  const L = EG_HAZARDS.eclipse;
  let tTell = null, tLive = null;
  for (let k = 0; k < 8000 && (tTell == null || tLive == null); k++) { const e = egEclipseAt(s, k / 100); if (e && !e.live && e.secs > 5.5 && tTell == null) tTell = k / 100; if (e?.live && tLive == null) tLive = k / 100; }
  const e0 = egEclipseAt(s, tTell);
  assert.ok(e0.havens.length >= 1 && e0.r === L.r);
  assert.equal(egEclipseChip(e0), `The Eclipse - ${Math.ceil(e0.secs - 1e-9)}`);
  assert.equal(egEclipseDark(e0), 0, 'no dark from 6 s out');
  const e2 = egEclipseAt(s, tTell + (L.tell / 1000 - 1) - (6 - e0.secs));
  assert.ok(Math.abs(egEclipseDark(e2) - 0.5) < 0.02, `half dark a second out (${egEclipseDark(e2)})`);
  assert.equal(egEclipseChip(egEclipseAt(s, tLive)), '', 'striking: no chip');
  assert.equal(egEclipseDark(egEclipseAt(s, tLive)), 1);
  assert.equal(egEclipseAt(s, tLive - 20), null, 'between: nothing');
  assert.equal(EG_ECLIPSE_LOOK.dark, 2); assert.equal(EG_ECLIPSE_LOOK.wind, 3);
});

test('EG-ZG THE MARKS, THE RIM, THE RING, WEIGHT (sections 13.2, 25.4, 25.6 and 25.8): each live mark its own sigil (a soul-mark\'s gem with its seconds, the touched rims tinted); a point placed on the screen where the camera sees it, none behind; the yaw read off the view; an aura Vestige\'s holders; every foe rim-lit in the Shade but the dormant Lurker; the heavy blows\' shakes by the LAND_SHAKE law within 8-10 m, nothing under reduced motion; my hit full, an ally\'s at 0.4, my own blow\'s echo never an ally\'s; a Drop\'s landing under me (mutants: two marks one shape; the rim on a dormant Lurker; the shake past its reach; an ally\'s hit full; the echo flashing twice)', () => {
  assert.equal(new Set(EG_SIGILS).size, EG_SIGILS.length, 'each its own shape');
  assert.equal(new Set(Object.values(EG_SIGIL_PATHS)).size, EG_SIGILS.length);
  for (const k of EG_SIGILS) assert.ok(EG_SIGIL_PATHS[k], `${k} drawn`);
  const mk = [['me', 1, 9000, 3], ['me', 2, 4000, 0], ['me', 3, 500, 0], ['ann', 0, 9000, 0]];
  const mine = egSigilsOf(mk, 'me', 1000);
  assert.deepEqual(mine.map((m) => [m.sigil, m.secs]), [['gem', 8], ['flame', 3]], 'my live marks, by kind; the spent gone');
  assert.deepEqual(mine[1].rim, [...EG_SIGIL_RIM[2]], 'the flame\'s rim its fire');
  assert.match(egSigilHtml(mine[0]), /<b>8<\/b>/, 'the gem with its seconds');
  // the screen and the yaw (the hosts' own lens: world/mat4.js perspective, mirrored)
  const eye = [0, 1.6, 0], yaw = 0.4, fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const view = lookAt(eye, [eye[0] + fwd[0], eye[1], eye[2] + fwd[2]], UP_Y), proj = mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500));
  assert.ok(Math.abs(egViewYaw(view) - yaw) < 1e-6, 'the yaw read off the view');
  const vp = multiply(proj, view), ahead = egScreenAt(vp, [fwd[0] * 10, 2.2, fwd[2] * 10]);
  assert.ok(ahead && Math.abs(ahead[0] - 0.5) < 1e-6 && ahead[1] < 0.5, 'ahead and over my eye: the middle, up');
  assert.equal(egScreenAt(vp, [-fwd[0] * 10, 2.2, -fwd[2] * 10]), null, 'behind me: nowhere');
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)], side = egScreenAt(vp, [fwd[0] * 10 + right[0] * 2, 1.6, fwd[2] * 10 + right[2] * 2]);
  assert.ok(side[0] > 0.5, 'my right on the screen\'s right (the mirrored lens)');
  // the aura Vestige's holders
  const E = { ms: [['a', 0, 0, 0, 0, [], [[3, 1]], -1], ['b', 0, 0, 0, 0, [], [[1, 2]], -1], ['c', 0, 0, 0, 0, [], [[21, 1]], -1]] };
  assert.deepEqual(egAuraHolders(E), ['a', 'c'], 'Bastion and the Standard - auras; Stoneskin none');
  assert.equal(EG_AURA_RING.r, 0.6);
  // the rim light
  assert.equal(egRimOf(EG_SHADE_BAND, 0), EG_SHADE_RIM); assert.equal(egRimOf(EG_SHADE_BAND, EG_FL.elite), EG_SHADE_RIM);
  assert.equal(egRimOf(EG_SHADE_BAND, EG_FL.dormant), null, 'the dormant Lurker aside'); assert.equal(egRimOf(EG_SHADE_BAND, EG_FL.friend), null, 'never a friend');
  for (const b of [0, 1, 3]) assert.equal(egRimOf(b, 0), null, 'only in the Shade');
  assert.ok(EG_SHADE_RIM[2] >= EG_SHADE_RIM[0] && EG_SHADE_RIM[0] > 0.6, 'moon-silver');
  // the shakes
  const smash = { nm: 'Smash', s: [['d', 0, 0, 3]] }, gore = { nm: 'Gore', s: [['l', 0, 0, 0, 18, 4]] };
  assert.equal(egHeavyShake(smash, 0, 0), EG_HEAVY_SHAKE.Smash[0]);
  assert.ok(Math.abs(egHeavyShake(smash, 4, 0) - EG_HEAVY_SHAKE.Smash[0] * 0.5) < 1e-9, 'fading over its reach');
  assert.equal(egHeavyShake(smash, 8.01, 0), 0, 'past 8 m: nothing');
  assert.ok(egHeavyShake(gore, 5, 9) > 0 && egHeavyShake(gore, 10.01, 9) === 0, 'a lane by its line, within 10 m');
  assert.equal(egHeavyShake({ nm: 'Cleave', s: [['d', 0, 0, 3]] }, 0, 0), 0, 'a light blow shakes nothing');
  for (const k of ['Savage', 'Smash', 'Whirl', 'Gore', 'Maul']) assert.ok(EG_HEAVY_SHAKE[k][1] >= 8 && EG_HEAVY_SHAKE[k][1] <= 10, `${k}: within 8-10 m`);
  assert.equal(egShakeMotion(true, 1), 0, 'reduced motion: still'); assert.equal(egShakeMotion(false, 0.5), 0.5); assert.equal(egShakeMotion(false, undefined), 1);
  assert.equal(egHeavyShake(smash, 0, 0, egShakeMotion(false, 0.5)), EG_HEAVY_SHAKE.Smash[0] * 0.5, 'Technique camera motion scales it');
  // the flash
  const t = 5000;
  assert.equal(egBodyFlash({ mineAt: t - 10, hurtAt: t - 10 }, t), gateHitFlash(t - 10, -Infinity, t), 'my blow: full');
  assert.ok(Math.abs(egBodyFlash({ hurtAt: t - 10 }, t) - GATE_FLASH_COURT * gateHitFlash(t - 10, -Infinity, t)) < 1e-9 && GATE_FLASH_COURT === 0.4, 'an ally\'s: 0.4');
  assert.equal(egBodyFlash({ mineAt: t - 300, hurtAt: t - 100 }, t), gateHitFlash(t - 300, -Infinity, t), 'the relay\'s word of my own blow is mine, never a second flash');
  assert.ok(egBodyFlash({ mineAt: t - 2000, hurtAt: t - 10 }, t) > 0 && t - 10 - (t - 2000) > EG_MINE_ECHO_MS, 'an ally\'s blow long after mine flashes');
  assert.equal(egBodyFlash({ hurtAt: t - 10, fellAt: t - 5 }, t), 0, 'a fallen body none');
  // a Drop's landing
  const { s } = findSpec((q) => q.steps.some((x) => x.kind === 'drop'));
  const d = s.steps.find((x) => x.kind === 'drop');
  assert.equal(egDropUnder(s, d.x, d.y + 3, d.z), d); assert.equal(egOverDrop(s, d.x, d.y + 3, d.z), true);
  assert.equal(egOverDrop(s, d.x, d.y + 0.5, d.z), false, 'a hop over it is no drop');
  assert.equal(egDropUnder(s, d.x + d.w, d.y + 3, d.z), null, 'beside it: none');
  assert.equal(egDropUnder(s, d.x, d.y + EG_DROP_THUD.over + 0.1, d.z), null);
});

/** A fight in hall `spec` of seed `seed`, my feet where `feet()` says (the hall's frame [x, y, z]), the link's state E. */
function fightIn({ seed, spec, F, extra = {}, feetAt, t0 = 50_000, deps = {} }) {
  const centre = egHallCentre(spec);
  const E = { ...EG_STATE_EMPTY, b: '0123456789abcdef', h: spec.h, seed, geo: 0, sg: 'trial', end: null, hw: 1, fight: F, co: [['acct-mac', 'Mac', 1, 1, 0, 1, 0, 0, 0, 1], ['acct-ann', 'Ann', 2, 1, 0, 1, 0, 0, 0, 1]], ...extra };
  const clock = { t: t0 }, played = [], shook = [];
  const fight = createEgFight({ link: { state: () => E }, now: () => clock.t, feet: () => { const f = feetAt(); return f ? [centre[0] + f[0], centre[1] + f[1], centre[2] + f[2]] : null; }, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-mac',
    audio: { play3d: (clip) => played.push(['3d', clip]), playOneShot: (rec, vol, pitch) => played.push(['one', rec, pitch]) }, shake: (k) => shook.push(k), ...deps });
  return { fight, E, clock, played, shook, centre };
}

test('EG-ZG IN THE FIGHT (scenes/eliteGates/egFight.js): burning ground a Spire pool; a drain a pull-apart, a chain the stay-close with my words under the crosshair; a blow on my feet the peril arrow\'s words and its way; a heavy landing near me shakes the screen, a cut one or under reduced motion never; an aura Vestige\'s ring at my feet on my own ground; a Drop\'s thud and dust, never on a hop; the Eclipse dark over its last seconds, its wind and toll once; the floors planned in the draw (mutants: the burn\'s orange kept; the chain\'s words never said; a feint shaking; the wind every frame)', () => {
  const { seed, s: spec } = findSpec((q) => q.kind === 'yard' && q.fight && q.fl.length >= 1);
  const court = spec.fl.find((f) => f.t === 'd');
  const me = [court.x, 0, court.z];
  const body = (i, role, k, x, z, fl = 0) => ({ i, role, k, pt: 0, x, z, hp: 100, max: 100, fl, mv: null, born: 0 });
  const F = { ...EG_FIGHT_EMPTY, h: spec.h, bodies: [body(1, EG_ROLE.add, 8, court.x + 5, court.z)], blows: [], zones: [], tx: [], mk: [] };
  const peerPos = [court.x - 4, 1.6, court.z];
  const H = fightIn({ seed, spec, F, feetAt: () => me, deps: { peerAt: (sub) => (sub === 'acct-ann' ? (() => { const c = egHallCentre(spec); return [c[0] + peerPos[0], c[1] + peerPos[1], c[2] + peerPos[2]]; })() : null) } });
  const t = H.clock.t;
  F.zones = [{ i: 1, kind: 'burn', s: ['d', court.x + 6, court.z, 2], from: t - 100, until: t + 5000, p: 0.05, b: 0, el: 'fire' }];
  F.tx = [[1, 'acct-mac', 0, 810], ['acct-mac', 'acct-ann', 2, 800]];
  F.blows = [{ i: 7, o: 1, at: t + 900, wu: 1400, s: [['d', court.x, court.z, 3]], ch: 0, el: null, p: 0.3, b: 10, nm: 'Smash', sp: 0, pu: 0 }];
  H.fight.frame();
  const sh = H.fight.shapes();
  const pool = sh.find((x) => x.pool === TELEGRAPH_POOL_SPIRE.pool);
  assert.ok(pool && pool.color.join() === egPoolRgb(spec.band ?? 0).join(), 'burning ground a Spire pool, the band\'s ramp darkened');
  assert.ok(sh.some((x) => x.pool === TELEGRAPH_POOL_SPIRE.pull && x.kind === TELEGRAPH_KIND.lane && x.r1 === 5), 'a drain: the pull-apart, its tick at its break');
  const chain = sh.find((x) => x.pool === TELEGRAPH_POOL_SPIRE.chain);
  assert.ok(chain && chain.t === 0, 'the chain, slack at 4 m');
  assert.ok(sh.every((x) => x.pool !== TELEGRAPH_POOL.path), 'no tether a plain flowing lane any more');
  assert.equal(H.fight.peril()?.name, 'Smash');
  assert.equal(H.fight.ground().warn, 'Smash - move!', 'the peril\'s words take the crosshair');
  // a CHECK with no light in reach: its order, no arrow
  F.blows = [{ i: 6, o: 1, at: t + 900, wu: 1400, s: [['h', court.x + 60, court.z, 3]], ch: 1, el: null, p: 0.3, b: 10, nm: 'The Reckoning', sp: 0, pu: 0 }];
  H.clock.t += 5; H.fight.frame();
  assert.equal(H.fight.ground().warn, 'Stand in the light!', 'the CHECK\'s order');
  assert.equal(H.fight.ground().arrow, null);
  // the peril gone: my chain's words
  F.blows = [];
  H.clock.t += 10; H.fight.frame();
  assert.equal(H.fight.ground().warn, 'Chained to Ann - 4.0/8 m', 'chained: whom, and how far of 8');
  peerPos[0] = court.x - 7; H.clock.t += 10; H.fight.frame();
  assert.ok(H.fight.shapes().find((x) => x.pool === TELEGRAPH_POOL_SPIRE.chain).t > 0.4, 'taut toward 8 m');
  // the heavy landing; a feint's; under reduced motion
  F.tx = [];
  F.blows = [{ i: 8, o: 1, at: H.clock.t + 50, wu: 1300, s: [['d', court.x + 2, court.z, 3]], ch: 0, el: null, p: 0.3, b: 10, nm: 'Smash', sp: 0, pu: 0 },
    { i: 9, o: 1, at: H.clock.t + 50, wu: 1300, s: [['d', court.x, court.z, 3]], ch: 0, el: null, p: 0.3, b: 10, nm: 'Smash', sp: 0, pu: 0, cut: H.clock.t - 400 }];
  H.clock.t += 100; H.fight.frame();
  assert.equal(H.shook.length, 1, 'the landing shook once; the feint never');
  assert.ok(Math.abs(H.shook[0] - egHeavyShake(F.blows[0], court.x, court.z)) < 1e-9);
  setPref('reducedMotion', true);
  try { F.blows = [{ ...F.blows[0], i: 10, at: H.clock.t + 50 }]; H.clock.t += 100; H.fight.frame(); } finally { setPref('reducedMotion', false); }
  assert.equal(H.shook.length, 1, 'reduced motion: still');
  // an aura Vestige's ring at my feet, on my own ground
  H.E.ms = [['acct-mac', 0, 0, 0, 0, [], [[3, 1]], -1]];
  F.blows = []; H.clock.t += 10; H.fight.frame();
  const ring = H.fight.shapes().find((x) => x.pool === TELEGRAPH_POOL_SPIRE.ring);
  assert.ok(ring && ring.r === 0.6 && Math.abs(ring.origin[0] - me[0]) < 1e-9 && ring.y === 0, 'one thin ring at my feet');
  H.E.co = [['acct-mac', 'Mac', 1, 0, 0, 1, 0, 0, 0, 1]];   // fallen
  H.clock.t += 10; H.fight.frame();
  assert.ok(!H.fight.shapes().some((x) => x.pool === TELEGRAPH_POOL_SPIRE.ring), 'a fallen holder\'s aura draws none');
  // the plan in the draw (no GL: the plan still made, nothing drawn)
  assert.equal(H.fight.drawPass(I4, I4, [0, 0, 0], 1), false);
  assert.ok(H.fight.plan() && H.fight.state().floors === spec.fl.length && H.fight.plan().draws.length <= EG_FLOOR_DRAWS_MAX);
  assert.ok(H.fight.shapes().every((x) => x.fogFloor), 'the look laid on');
});

test('EG-ZG A DROP AND THE ECLIPSE IN THE FIGHT, AND THE SPAN\'S WORD TO THE DUNGEON ARM (scenes/eliteGates/egFight.js, scenes/eliteGates/egSpan.js, scenes/dungeonContext.js): falling onto a Drop the course asked for lands on the designed thud and dust, a hop on its landing never; while falling onto it the span says so and the dungeon arm plays no hard-landing grunt; the Eclipse\'s floor darkened over its last 2 s with its moon-shafts kept, its wind once from 3 s out and its toll once at the strike (mutants: the thud on a hop; the grunt kept; the toll every frame)', () => {
  const { seed, c, s: spec } = findSpec((q) => q.steps.some((x) => x.kind === 'drop'));
  const d = spec.steps.find((x) => x.kind === 'drop');
  let y = d.y + 3.5;
  const H = fightIn({ seed, spec, F: null, extra: { sg: 'trial' }, feetAt: () => [d.x, y, d.z] });
  H.E.fight = { ...EG_FIGHT_EMPTY, h: -1 };
  H.fight.frame(); y = d.y + 1.2; H.clock.t += 16; H.fight.frame();
  assert.equal(H.played.filter((p) => p[0] === 'one').length, 0, 'in the air: nothing yet');
  y = d.y; H.clock.t += 16; H.fight.frame();
  const thud = H.played.filter((p) => p[0] === 'one');
  assert.deepEqual(thud.map((p) => [p[1], p[2]]), EG_DROP_THUD.sounds.map((S) => [S.rec, S.pitch]), 'the designed thud');
  const dust = H.fight.shapes().find((x) => x.kind === TELEGRAPH_KIND.discs && x.pool === TELEGRAPH_POOL.ground);
  assert.ok(dust && dust.y === d.y && dust.r >= EG_DROP_THUD.r0, 'and dust on its landing');
  H.clock.t += EG_DROP_THUD.ms + 10; H.fight.frame();
  assert.ok(!H.fight.shapes().some((x) => x.kind === TELEGRAPH_KIND.discs && x.pool === TELEGRAPH_POOL.ground), 'the dust settles');
  // a hop on the landing: no thud
  const n0 = H.played.length;
  y = d.y + 1.6; H.clock.t += 200; H.fight.frame(); y = d.y; H.clock.t += 200; H.fight.frame();
  assert.equal(H.played.length, n0, 'a hop is no drop');
  // the span's word: falling onto it, the arm hears it; standing, or over another step, never
  const span = createEgSpan({ seed, c, geo: 0 });
  span.stand({ dynamicDraws: [], collider: { addMesh: () => {} } });
  const at = (yy, grounded) => ({ pos: realmToDungeon(spec.x0 + d.x, yy, d.z), grounded, groundKey: null, height: 1.8, collider: { move: () => {} } });
  span.ride(10, 0.016, at(d.y + 3, false)); assert.equal(span.overDrop(), true, 'falling onto a Drop');
  span.ride(10, 0.016, at(d.y, true)); assert.equal(span.overDrop(), false, 'standing on it');
  span.ride(10, 0.016, { ...at(d.y + 3, false), pos: realmToDungeon(spec.x0 + d.x + 30, d.y + 3, d.z) }); assert.equal(span.overDrop(), false);
  span.clear();
  const DC = read('src/scenes/dungeonContext.js');
  assert.match(DC, /\} else if \(fell > FALL_DAMAGE_THRESHOLD \/ 2\) \{\n {8}if \(egSpan\?\.overDrop\?\.\(\)\) \{ \/\* EG-ZG[^\n]*\*\/ \}\n {8}else if \(!immersiveFootsteps\.hardFallAlert\(\)\) audio\.playOneShot\(SOUND\.FallHard/, 'no grunt for a Drop\'s landing');
  // THE ECLIPSE
  const ec = findSpec((q) => q.hazards?.some((z) => z.kind === 'eclipse'));
  let tTell = null;
  for (let k = 0; k < 8000 && tTell == null; k++) { const e = egEclipseAt(ec.s, k / 100); if (e && !e.live && e.secs > 5.9) tTell = k * 10; }
  const fc = ec.s.fl.find((f) => f.t === 'd');
  const G = fightIn({ seed: ec.seed, spec: ec.s, F: null, feetAt: () => [fc.x, fc.y, fc.z], t0: tTell });
  G.E.fight = { ...EG_FIGHT_EMPTY, h: -1 };
  const winds = () => G.played.filter((p) => p[0] === 'one' && p[1] === EG_ECLIPSE_LOOK.windSound.rec).length, tolls = () => G.played.filter((p) => p[0] === 'one' && p[1] === EG_ECLIPSE_LOOK.tollSound.rec).length;
  const darkOf = () => G.fight.shapes().find((x) => x.pool === TELEGRAPH_POOL_SPIRE.dark);
  G.fight.frame();
  assert.ok(!darkOf() && winds() === 0, '6 s out: havens, no dark, no wind');
  assert.ok(G.fight.shapes().some((x) => x.pool === TELEGRAPH_POOL.ground && x.edge !== TELEGRAPH_EDGE_DAGON), 'its moon-shafts the havens');
  G.clock.t = tTell + 3200; G.fight.frame(); G.clock.t += 50; G.fight.frame();
  assert.equal(winds(), 1, 'the wind rises from 3 s out, once');
  G.clock.t = tTell + 5000; G.fight.frame();
  const dk = darkOf();
  assert.ok(dk && dk.kind === TELEGRAPH_KIND.all && dk.points.length >= 1 && dk.r === EG_HAZARDS.eclipse.r && dk.t > 0.2 && dk.t < EG_ECLIPSE_LOOK.deep, 'its last 2 s: darkening, the moon-shafts kept');
  G.clock.t = tTell + 6100; G.fight.frame(); G.clock.t += 50; G.fight.frame();
  assert.equal(tolls(), 1, 'a toll at the strike, once');
  assert.ok(Math.abs(darkOf().t - EG_ECLIPSE_LOOK.deep) < 1e-9);
  // the HUD's chip
  const hud = egSpireHudModel({ ...EG_STATE_EMPTY, b: '0123456789abcdef', h: ec.s.h, seed: ec.seed, sg: 'trial', co: [['acct-mac', 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]] }, 'acct-mac', tTell + 1100);
  assert.equal(hud.eclipse, 'The Eclipse - 5', 'the bar\'s chip');
  const rest = egSpireHudModel({ ...EG_STATE_EMPTY, b: '0123456789abcdef', h: ec.s.h, seed: ec.seed, sg: 'rest', co: [['acct-mac', 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]] }, 'acct-mac', tTell + 1100);
  assert.equal(rest.eclipse, '', 'at a rest the place\'s hazards are still: no chip');
});

test('EG-ZG THE MARKS AS SIGILS (sections 13.2 and 25.5; ui/eliteGates/egSpireHud.js): my marks on the HUD as their sigils, their names to a screen reader, never a line of text; a companion\'s over their head where the camera sees it, in the palette\'s danger, moved and rewritten only when they change, gone when their marks are (mutants: the HUD\'s marks a text line; a companion\'s row kept past its marks)', () => {
  const doc = (() => {
    const node = (tag) => { const n = { tagName: tag, children: [], parent: null, attrs: {}, className: '', innerHTML: '', textContent: '', id: '' }; n.style = { _p: {}, setProperty(k, v) { this._p[k] = v; } }; n.append = (...cs) => { for (const x of cs) { if (typeof x === 'string') continue; x.parent = n; n.children.push(x); } }; n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; }; n.setAttribute = (k, v) => { n.attrs[k] = String(v); }; n.addEventListener = () => {}; n.replaceChildren = () => { n.children = []; }; return n; };
    const d = { createElement: node, head: node('head'), body: node('body') };
    d.getElementById = () => null;
    return d;
  })();
  const E = { ...EG_STATE_EMPTY, b: '0123456789abcdef', h: 3, seed: 77, sg: 'trial', co: [['acct-mac', 'Mac', 1, 1, 0, 1, 0, 0, 0, 1]], fight: { ...EG_FIGHT_EMPTY, h: 3, mk: [['acct-mac', 1, 20_000, 2], ['acct-mac', 4, 30_000, 0]] } };
  const m = egSpireHudModel(E, 'acct-mac', 10_000);
  assert.deepEqual(m.marks.map((x) => x.sigil), ['gem', 'chain']);
  assert.equal(m.marksSaid, 'Soul-mark 10s - Chained 20s');
  drawEgSpireHud(m, { doc, skin: 'enhanced' });
  const find = (n, cls) => (String(n.className).split(/\s+/).includes(cls) ? n : n.children.map((x) => find(x, cls)).find(Boolean) ?? null);
  const row = find(doc.body, 'eg-marks');
  assert.ok(row && row.innerHTML.includes(EG_SIGIL_PATHS.gem) && row.innerHTML.includes(EG_SIGIL_PATHS.chain) && row.innerHTML.includes('<b>10</b>'), 'my sigils, the gem\'s seconds');
  assert.ok(!row.textContent, 'never a line of text');
  assert.equal(row.attrs['aria-label'], 'Soul-mark 10s - Chained 20s');
  // a companion's over their head
  drawEgSigils([{ key: 'acct-ann', x: 0.4, y: 0.3, marks: egSigilsOf([['acct-ann', 0, 20_000, 0]], 'acct-ann', 10_000) }], { doc, danger: EG_DANGER_PALETTES.contrast.danger });
  const layer = find(doc.body, 'eg-sigils');
  assert.equal(layer.children.length, 1); assert.equal(layer.children[0].style.left, '40.00%'); assert.ok(layer.children[0].innerHTML.includes(EG_SIGIL_PATHS.tooth));
  assert.equal(layer.style._p['--eg-danger'], 'rgb(255, 38, 191)', 'in the palette\'s danger');
  drawEgSigils([{ key: 'acct-bo', x: 0.6, y: 0.3, marks: egSigilsOf([['acct-bo', 5, 20_000, 0]], 'acct-bo', 10_000) }], { doc });
  assert.equal(layer.children.length, 1, 'a row gone with its marks'); assert.ok(layer.children[0].innerHTML.includes(EG_SIGIL_PATHS.cage));
  drawEgSigils(null, { doc });
  assert.equal(layer.style.display, 'none');
  // the fight places them: a companion ahead, marked
  const { seed, s: spec } = findSpec((q) => q.kind === 'yard' && q.fight);
  const court = spec.fl.find((f) => f.t === 'd'), c0 = egHallCentre(spec);
  const F = { ...EG_FIGHT_EMPTY, h: spec.h, mk: [['acct-ann', 3, 90_000, 0], ['acct-mac', 2, 90_000, 0]] };
  const H = fightIn({ seed, spec, F, feetAt: () => [court.x, 0, court.z], deps: { peerAt: (sub) => (sub === 'acct-ann' ? [c0[0] + court.x, c0[1] + 1.6, c0[2] + court.z + 8] : null) } });
  H.fight.frame();
  const eye = [c0[0] + court.x, c0[1] + 1.6, c0[2] + court.z];
  const view = lookAt(eye, [eye[0], eye[1], eye[2] + 1], UP_Y), proj = mirrorProjectionX(perspective(1.2, 16 / 9, 0.1, 500));
  H.fight.drawPass(proj, view, eye, 1);
  const sg = H.fight.sigils();
  assert.equal(sg.length, 1, 'my own never over my head (they are on my HUD)');
  assert.ok(sg[0].key === 'acct-ann' && Math.abs(sg[0].x - 0.5) < 1e-6 && sg[0].marks[0].sigil === 'flake', 'hers, ahead of me');
  const over = egScreenAt(multiply(proj, view), [eye[0], eye[1] + EG_SIGIL_UP_M, eye[2] + 8]);
  assert.ok(Math.abs(sg[0].y - over[1]) < 1e-6 && sg[0].y < 0.47, `over her head (EG_SIGIL_UP_M over her eye - ${sg[0].y.toFixed(3)}), never at it`);
});

test('EG-ZG THE QUIET COMPANY\'S ALLIES (section 25.4): no word, every ally\'s spell as it always was; the Spire\'s client\'s word in a trial - 60% and no light of their own - read by the spell engine every host shares; a Morrowind effect\'s quads faded by their blend, a flash translucent; the peers\' light put out and their impacts the classic flash alone (mutants: the quiet share outside a trial; the fade on the wrong channel; the flash opaque)', async () => {
  egAllyLookSet(null);
  assert.equal(egAllyLook(), null, 'no word: as they always were');
  const q = egQuietCompany('trial');
  egAllyLookSet(() => ({ alpha: q.allyAlpha, glow: q.allyGlow }));
  assert.deepEqual(egAllyLook(), { alpha: 0.6, glow: 0 }, 'a trial: 60% and no light of their own');
  egAllyLookSet(() => ({ alpha: egQuietCompany('rest').allyAlpha, glow: egQuietCompany('rest').allyGlow }));
  assert.equal(egAllyLook(), null, 'at a rest: full and lit');
  egAllyLookSet(() => { throw new Error('gone'); });
  assert.equal(egAllyLook(), null, 'a word that fails is no word');
  egAllyLookSet(null);
  // the Spire's client says it, from the look's own law
  const C = read('src/scenes/eliteGates/egClient.js');
  assert.match(C, /egAllyLookSet\(\(\) => \{ if \(!inSpire\(\)\) return null; const q = egQuietCompany\(link\.state\(\)\?\.sg\); return \{ alpha: q\.allyAlpha, glow: q\.allyGlow \}; \}\);/);
  // a Morrowind effect's quads: alpha where the blend reads it, all four where it adds the source as it is
  const packed = new Float32Array(2 * VFX_VERTEX_FLOATS).fill(1), out = new Float32Array(packed.length);
  vfxFade(packed, 2, 0.6, 6, out);
  assert.deepEqual([...out.subarray(VFX_COLOR_AT, VFX_COLOR_AT + 4)].map((v) => +v.toFixed(3)), [1, 1, 1, 0.6], 'SRC_ALPHA: its alpha');
  assert.equal(out[0], 1, 'its place untouched');
  vfxFade(packed, 2, 0.6, 0, out);
  assert.deepEqual([...out.subarray(VFX_VERTEX_FLOATS + VFX_COLOR_AT, VFX_VERTEX_FLOATS + VFX_COLOR_AT + 4)].map((v) => +v.toFixed(3)), [0.6, 0.6, 0.6, 0.6], 'ONE: all four');
  // a flash translucent (scenes/hitEffects.js)
  const built = [];
  const fx = createHitEffects({ renderer: { createBillboardBatch: (archive, record, size, centres) => { const b = { archive, record, size, centres }; built.push(b); return b; }, destroyBillboardBatch: () => {} },
    getTexture: async () => ({ recordCount: 8, getFrameCount: () => 4, getSize: () => ({ width: 64, height: 48 }), getScale: () => ({ width: 0, height: 0 }) }), uploadRecordFrame: () => {} });
  fx.showImpactFlash(377, [0, 1, 0], 1, { mode: 3, alpha: 0.6, t: 0, phase: 0 });
  fx.showImpactFlash(377, [0, 1, 0]);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(built.map((b) => b.conceal?.alpha ?? null), [0.6, null], 'an ally\'s flash translucent, everyone else\'s as it was');
  // the spell engine's doors (scenes/hostMagic.js) and the effects' (scenes/mwMagicFx.js)
  const M = read('src/scenes/hostMagic.js');
  assert.match(M, /const quiet = egAllyLook\(\);\n {6}mwFx\.cast\(look, feet, quiet \? \{ alpha: quiet\.alpha \} : undefined\);/, 'a peer\'s casting effects at the share');
  assert.match(M, /visual: true, casterId, quiet \}\)\);/, 'its missile carries it');
  assert.match(M, /if \(m\.quiet\) m\.batch\.conceal = allyConceal\(m\.quiet\);/, 'its flat translucent');
  assert.match(M, /if \(m\.quiet\) \{ impacts\.showImpactFlash\(missileArchive\(m\.spell\.element\), pos, m\.scale \?\? 1, allyConceal\(m\.quiet\)\); return; \}/, 'its impact the classic flash alone - no burst in light, no kick');
  assert.match(M, /if \(rangeType === 1 && !quiet\) landFx\(/, 'a touch\'s spray and light none');
  assert.match(M, /if \(egAllyLook\(\)\?\.glow === 0\) list = null;/, 'a peer\'s light put out');
  assert.match(M, /mode: CONCEAL_MODE\.reveal, alpha: q\.alpha/);
  const X = read('src/scenes/mwMagicFx.js');
  assert.match(X, /e\.gpu\.sync\(r\.streams, e\.alpha\);/); assert.match(X, /for \(const v of plan\.cast\) atActor\(v, feet, body, alpha\);/); assert.match(X, /\}, \{ loop: true, alpha \}\);/);
});

test('EG-ZG THE RIM AND THE FLASH ON THE BODIES, THE LOOK\'S POOLS KEPT (scenes/eliteGates/egFight.js): every body\'s flash egBodyFlash\'s and its glint the Shade\'s rim; my blow marks the body mine; the tethers\' and the pool\'s danger in the palette, a Vestige\'s ring and the Eclipse\'s dark never recoloured; the fight\'s pass the Spire\'s, its draws the floors\' (mutants: the rim never laid; my blow not marked mine; the ring dyed the danger)', () => {
  const S = read('src/scenes/eliteGates/egFight.js');
  assert.match(S, /setBatchHitFlash\(d\.batch, egBodyFlash\(b, t\)\);/);
  assert.match(S, /setBatchGlint\(d\.batch, b\.fellAt \? null : egRimOf\(darkNow > 0 \? EG_SHADE_BAND : band, b\.fl \| 0, lord\)\);/);   // PIN MOVED (AUDIT EG V, b: lane1 #13 - in the place's dark every foe keeps the Shade's rim light; EG-PERFECT's audit: the guard's glint a lord's alone)
  assert.match(S, /b\.hurtAt = b\.mineAt = now\(\);/);
  assert.match(S, /pass\.drawFloors\(plan, proj, view, eye, seconds, fog, centre\);/);
  assert.ok(!/pass\.draw\(sh,/.test(S), 'no shape drawn on one plane at the hall\'s centre any more');
  const acc = { palette: EG_DANGER_PALETTES.contrast, fill: 0.8 };
  const pull = shapeOf({ pool: TELEGRAPH_POOL_SPIRE.pull, color: [1.0, 0.24, 0.28] }), pool = shapeOf({ pool: TELEGRAPH_POOL_SPIRE.pool, color: egPoolRgb(1) });
  const ring = shapeOf({ pool: TELEGRAPH_POOL_SPIRE.ring, color: [...EG_AURA_RING.color], edge: EG_AURA_RING.color });
  egLookShapes([pull, pool, ring], acc, 'trial');
  assert.deepEqual([...pull.edge], [...EG_DANGER_PALETTES.contrast.danger], 'a tether\'s line the palette\'s danger');
  assert.deepEqual([...pool.edge], [...EG_DANGER_PALETTES.contrast.danger], 'a pool\'s dashed rim the palette\'s danger');
  assert.deepEqual([...pool.color], egPoolRgb(1), 'its fill the band\'s');
  assert.deepEqual([...ring.color], [...EG_AURA_RING.color], 'the ring yours, never dyed');
});
