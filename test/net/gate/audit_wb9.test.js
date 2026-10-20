// AUDIT WB9 (2026-09-30, before the merge - Mac: "Audit this before we merge"). The WB9 slices audited in five parts - the
// relay's brain (WB9b/c), the court's client and its drawing (WB9a/c/d/e), the spoils (WB9f), the Broker's insignia
// (WB9g) and the bodies in a crowd (WB9h) - each finding reproduced, then fixed. The insignia's are pinned beside its own
// (test/net/wb9g_insignia.test.js); the rest here, one test a finding. bible/11-Multiplayer/World-Bosses.md section 14.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ATTACKS, COURTS, COURT_R, WALKS, POSE_SLACK, HIT_KINDS, HIT_CAP_X, RECKON_CLOSE_MS, STUN_MS,
  newFight, joinFight, stepBrain, applyHit, applyCrystalHit, stateOf, dpsRef, reckonOpen, inCourt, BASE_PROFILE,
} from '../../../src/net/gate/gateBrain.js';
import { foldGate, crossLaid, GATE_STATE_EMPTY } from '../../../src/net/gate/gateLink.js';
import { validGateOut } from '../../../src/net/wire.js';
import { createGateCourt, COURT_RECKON_TEXT, spoilsKeep, bossOf } from '../../../src/scenes/gate/gateCourt.js';
import { courtToDungeon, courtFloorTris } from '../../../src/world/gate/gateArena.js';
import { TELEGRAPH_FS, TELEGRAPH_KIND, TELEGRAPH_WALK_QUAD, TELEGRAPH_THROB_MAX_HZ, GateTelegraphRenderer, telegraphShape, telegraphField, poolShapes } from '../../../src/render/gate/gateTelegraph.js';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import { Collider } from '../../../src/player/collider.js';
import { createSpoilsPool } from '../../../src/scenes/spoilsPool.js';
import { quickLootArm, quickLootSpend, foldQuickLoot, quickLootSelection, quickLootTake } from '../../../src/systems/quickLoot.js';
import { resolveHover } from '../../../src/systems/worldHover.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { PeerBodies, BODIES_MAX, SWAP_DWELL_MS, SWAP_EVERY_MS, BODY_REBUILD_MS, EFFECTS_BANK_MAX_S } from '../../../src/net/peer/peerBodies.js';
import { perspective, lookAt, mirrorProjectionX } from '../../../src/world/mat4.js';

/** The relay's own roll, seeded (the fights below are the same every run). */
const seeded = (s) => { let a = s >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const T0 = 1_000_000;
const C1 = COURTS[0], C3 = COURTS[2];

/** A fight in the last court, its walkways laid long ago, two fighters in it - stepped until his first Reckoning grows. */
function reckoning() {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn');
  joinFight(f, 's1', 'P1', 10, T0, true); joinFight(f, 's2', 'P2', 10, T0, true);
  f.phase = 3; f.court = 2; f.pos = [...C3]; f.xa = [T0 - 60000, T0 - 60000]; f.nextAt = T0;
  const bodies = [{ sub: 's1', x: C3[0] + 3, z: C3[1] + 4, dead: false }, { sub: 's2', x: C3[0] - 5, z: C3[1] + 2, dead: false }];
  let atk = null, cx = null, t = T0;
  for (; t < T0 + 60000 && !cx; t += 250) for (const o of stepBrain(f, t, bodies, seeded(t))) { if (o.k === 'atk' && o.a === ATTACKS.reckon.id) atk = o; if (o.k === 'cx') cx = o; }
  return { f, bodies, atk, cx, t };
}
/** A point on walkway `k` `along` metres from its start (court k's end). */
const onWalk = (k, along) => ({ x: WALKS[k].ax + WALKS[k].ux * along, z: WALKS[k].az + WALKS[k].uz * along });

// ═══ THE BRAIN (WB9b/c) ═══════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB9 brain F1 - no blow lands from outside the court he fights in: he chooses, aims at and waits for only those in it, so a caster on a laid walkway, or in a court he has left, struck him (three at the first court\'s rim took him from 66% to 33% while he answered nothing) - on him and on a crystal alike; within POSE_SLACK of its rim it lands (mutants: a blow on him from anywhere on the floor; a crystal\'s)', () => {
  const f = newFight(7, T0, T0 + 3_600_000, 'ruhn');
  joinFight(f, 's1', 'P1', 30, T0, true);
  f.xa = [T0 - 60000];   // walkway 0 laid whole
  const rim = { x: C1[0] + COURT_R + POSE_SLACK / 2, z: C1[1] }, perch = onWalk(0, 12);
  assert.ok(inCourt(rim.x, rim.z, 0, POSE_SLACK) && !inCourt(perch.x, perch.z, 0, POSE_SLACK), 'the rim within the slack, the perch past it');
  let t = T0 + 1000;
  assert.ok(applyHit(f, 's1', 40, HIT_KINDS.Spell, rim, t) > 0, 'at his court\'s rim: lands');
  assert.equal(applyHit(f, 's1', 40, HIT_KINDS.Spell, perch, t += 1000), 0, 'from the laid walkway: refused');
  assert.equal(applyHit(f, 's1', 40, HIT_KINDS.Arrow ?? HIT_KINDS.Spell, { x: COURTS[1][0], z: COURTS[1][1] }, t += 1000), 0, 'nor from a court he is not in');
  // the crystals: a Reckoning in the last court, an archer on the walkway into it
  const R = reckoning();
  const c0 = R.cx.c[0], far = onWalk(1, 8);
  assert.ok(!inCourt(far.x, far.z, 2, POSE_SLACK));
  const d = HIT_CAP_X * dpsRef(10), when = R.atk.at - ATTACKS.reckon.windup / 2;
  assert.deepEqual(applyCrystalHit(R.f, 's1', 0, d, HIT_KINDS.Spell, far, when), [], 'a crystal from the walkway: refused');
  assert.equal(R.f.cx.c[0].h, R.cx.m, 'and nothing taken off it');
  applyCrystalHit(R.f, 's1', 0, d, HIT_KINDS.Spell, { x: c0[0], z: c0[1] }, when + 500);
  assert.ok(R.f.cx.c[0].h < R.cx.m, 'from within his court it lands');
});

test('AUDIT WB9 brain F2 - a crystal takes no blow once the Reckoning has landed, nor in its last RECKON_CLOSE_MS: the relay judged a break 120 ms after the landing - a court every screen had just wiped told he was stunned, and a screen that heard the stun first spared; the screens stop offering them then too (mutants: a crystal struck after the landing; in the last breath)', () => {
  const R = reckoning();
  const { f, atk, cx } = R;
  assert.equal(RECKON_CLOSE_MS, 500);
  const d = HIT_CAP_X * dpsRef(10);
  // all but the last broken in good time
  let tt = R.t;
  for (let c = 0; c < cx.c.length - 1; c++) { const at = { x: cx.c[c][0], z: cx.c[c][1] }; while (f.cx.c[c].h > 0) { tt += 400; applyCrystalHit(f, c % 2 ? 's2' : 's1', c, d, HIT_KINDS.Spell, at, tt); } }
  const last = cx.c.length - 1, lp = { x: cx.c[last][0], z: cx.c[last][1] };
  f.cx.c[last].h = 5;
  assert.equal(reckonOpen(f, atk.at - RECKON_CLOSE_MS - 1), true);
  assert.equal(reckonOpen(f, atk.at - RECKON_CLOSE_MS), false);
  assert.deepEqual(applyCrystalHit(f, 's1', last, 10, HIT_KINDS.Spell, lp, atk.at - RECKON_CLOSE_MS + 20), [], 'in the last breath: refused');
  assert.deepEqual(applyCrystalHit(f, 's1', last, 10, HIT_KINDS.Spell, lp, atk.at + 120), [], 'after the landing: refused');
  assert.ok(f.atk && f.atk.a === ATTACKS.reckon.id && !(f.stunUntil > atk.at), 'the Reckoning stands, and no stun');
  const g = { atk: null, cx: f.cx, fell: null, wrath: null };
  assert.equal(reckonOpen(g, 0), false, 'no Reckoning in flight: nothing to strike');
  // the screen: no crystal offered in the last breath
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 };
  const c = createGateCourt({ link, now: () => clock.t, feet: () => courtToDungeon(C3[0] + 3, 0, C3[1] + 3), player: () => ({ health: 100, maxHealth: 100 }), sendCrystal: () => true });
  const st = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 3, hp: 400, max: 1000, fighters: 2, wrathAt: 1e12, x: C3[0], z: C3[1],
    atk: { i: 40, a: ATTACKS.reckon.id, at: 30_000, x: C3[0], z: C3[1], yw: 0, tg: [] }, cx: { i: 40, m: 40, c: [[C3[0] + 8, C3[1], 40], [C3[0] - 9, C3[1] + 4, 40]], broke: [] } };
  link.st = st; clock.t = 30_000 - ATTACKS.reckon.windup + 50; c.frame();
  clock.t = 30_000 - RECKON_CLOSE_MS - 400; c.frame();
  assert.equal(c.crystalTargets().length, 2, 'offered while it still winds up');
  assert.equal(c.crystalHit({ c: 0, d: 20, r: HIT_KINDS.Spell }), true);
  clock.t = 30_000 - RECKON_CLOSE_MS + 10; c.frame();
  assert.equal(c.crystalTargets().length, 0, 'none in its last breath');
  assert.equal(c.crystalHit({ c: 1, d: 20, r: HIT_KINDS.Spell }), false, 'nor a blow sent');
});

test('AUDIT WB9 brain F1, on the screen - from outside the court he fights in, no blow of mine is sent and no crystal offered (the relay would refuse them); from within it they are (mutants: a blow sent from a perch)', () => {
  let feet = [C3[0] + 3, 0, C3[1] + 3];
  const link = { st: GATE_STATE_EMPTY, state() { return this.st; } };
  const clock = { t: 0 }, sent = [];
  const c = createGateCourt({ link, now: () => clock.t, feet: () => courtToDungeon(feet[0], 0, feet[2]), player: () => ({ health: 100, maxHealth: 100 }), send: (h) => { sent.push(h); return true; }, sendCrystal: () => true });
  link.st = { ...GATE_STATE_EMPTY, day: 700, boss: 'ruhn', phase: 3, hp: 400, max: 1000, fighters: 2, wrathAt: 1e12, x: C3[0], z: C3[1], shieldUntil: 0,
    atk: { i: 40, a: ATTACKS.reckon.id, at: 30_000, x: C3[0], z: C3[1], yw: 0, tg: [] }, cx: { i: 40, m: 40, c: [[C3[0] + 8, C3[1], 40]], broke: [] } };
  clock.t = 30_000 - ATTACKS.reckon.windup + 50; c.frame();
  clock.t = 25_000; c.frame();
  assert.equal(c.hit({ d: 30, r: HIT_KINDS.Spell }), true, 'in his court: sent');
  assert.equal(c.crystalTargets().length, 1);
  const perch = onWalk(1, 8);
  feet = [perch.x, 0, perch.z];
  c.frame();
  assert.equal(c.hit({ d: 30, r: HIT_KINDS.Spell }), false, 'on the walkway: not sent');
  assert.equal(c.crystalTargets().length, 0, 'and no crystal offered');
  assert.equal(sent.length, 1);
});

test('AUDIT WB9 brain F3 - the Wrath\'s word ends a stun on every screen as it ends it on the relay (it overtakes a Reckoning and a stun alike): the screens knelt him and read "Stunned - 5s" through the Wrath\'s wind-up, the relay\'s blows already at 1x; no other attack\'s word touches a stun (mutants: the stun kept through the Wrath)', () => {
  let s = foldGate(GATE_STATE_EMPTY, { k: 'st', d: 700, b: 'ruhn', ph: 3, h: 400, m: 1000, x: C3[0], z: C3[1], yw: 0, mv: null, atk: null, sh: 0, wr: 50_000, n: 2, fell: null, wrath: null, md: null }, 1000);
  s = foldGate(s, { k: 'stun', until: 20_000, at: 12_000 }, 12_000);
  assert.equal(s.stunUntil, 20_000);
  const wr = foldGate(s, { k: 'atk', i: 9, a: ATTACKS.wrath.id, at: 21_000, x: C3[0], z: C3[1], yw: 0, tg: [] }, 15_000);
  assert.equal(wr.stunUntil, 0, 'the Wrath: no longer stunned');
  const other = foldGate(s, { k: 'atk', i: 9, a: ATTACKS.slam.id, at: 21_000, x: C3[0], z: C3[1], yw: 0, tg: [] }, 15_000);
  assert.equal(other.stunUntil, 20_000, 'any other word leaves the stun as the relay said it');
});

test('AUDIT WB9 brain F4 - a kill mid-Reckoning spends its crystals: no beat after the fall clears them, so every later state carried them, and a fighter walking back in a minute on heard three crystals shatter (mutants: the crystals outliving the kill)', () => {
  const { f, t } = reckoning();
  assert.ok(f.cx, 'the crystals stand');
  f.hp = 5; f.players.s1.bucket = 1e6; f.players.s1.rate = 4;
  applyHit(f, 's1', 50, HIT_KINDS.Melee, { x: C3[0] + 2, z: C3[1] + 2 }, t + 1000);
  assert.ok(f.fell, 'he falls');
  assert.equal(f.cx, null, 'and his crystals with him');
  const st = foldGate(GATE_STATE_EMPTY, validGateOut(stateOf(f)), t + 30_000);
  assert.equal(st.cx, null, 'a screen told the fight after it sees none');
});

test('AUDIT WB9 brain F5 - a bound\'s word lays every walkway up to the court it lands in on every screen, as the relay lays them: a fight woken from a checkpoint older than WB9 bounds from the first court to the third, and its screens laid only the last - the first court\'s players held in it until the next whole state (mutants: the last walkway alone)', () => {
  const g = { k: 'atk', i: 3, a: ATTACKS.cross.id, at: 50_000, x: C1[0], z: C1[1], yw: 0, tg: [[C3[0], C3[1]]] };
  const laid = crossLaid({ xa: [] }, g);
  assert.deepEqual(laid.xa, [50_000 - ATTACKS.cross.windup, 50_000 - ATTACKS.cross.windup], 'both walkways, from its word');
  assert.deepEqual(crossLaid({ xa: [40_000] }, g).xa, [40_000, 50_000 - ATTACKS.cross.windup], 'one laid already keeps its own moment');
  assert.deepEqual(crossLaid({ xa: [40_000, 45_000] }, g), {}, 'both laid: nothing');
});

// ═══ THE COURT'S DRAWING (WB9c/e) ═════════════════════════════════════════════════════════════════════════════════

/** The telegraph's fragment stage run over a top-down grid (`step` metres a pixel), its derivatives taken as the GPU
 *  takes them - the difference across each 2x2 quad of whatever `fwidth` is asked of (two passes: the first records each
 *  call's argument per pixel, in the order the shader asks - WB13a's asks three). Answers the red channel per pixel,
 *  and each pixel's point. */
function runTelegraph(sh, { step = 0.2, span = 13, extra = {} } = {}) {
  const N = Math.round((2 * span) / step), at = (i) => -span + (i + 0.5) * step;
  const pts = Array.from({ length: 10 }, (_, i) => sh.points?.[i] ?? [0, 0]);
  const base = {
    uKind: sh.kind, uOrigin: sh.origin, uYaw: sh.yaw, uR: sh.r, uHalfArc: sh.halfArc, uBody: sh.body, uEnd: sh.end, uHalfW: sh.halfW,
    uR0: sh.r0, uR1: sh.r1, uPts: pts, uCount: sh.points?.length ?? 0, uT: sh.t, uFlash: 0, uAlpha: 1, uColor: [1, 1, 1], uEdgeCol: [1, 1, 1], uCourt: [0, 0], uFloorR: COURT_R,
    uStyle: sh.style ?? 0, uSince: sh.since ?? 0, uSpan: sh.span ?? 1, uAfter: -1, uPool: 0, uRunS: 0, uLineW: 1, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0],
    uOnWalk: 0, uWalkC0: [0, 0], uWalkC1: [0, 0], vCourt: [0, 0], vWorld: [0, 0, 0], o: [0, 0, 0, 0], ...extra,
  };
  let mode = 1, calls = [], k = 0, fws = null;
  const fns = glslFunctions(TELEGRAPH_FS, { ...base, fwidth: (x) => { if (mode === 1) { calls.push(x); return Array.isArray(x) ? x.map(() => 0) : 0; } return fws?.[k++] ?? 0; } });
  const G = fns.globals;
  const run = (i, j) => { G.vCourt = [at(i), at(j)]; G.vWorld = [at(i), 0.05, at(j)]; try { fns.main(); return G.o[0]; } catch (e) { if (e instanceof GlslDiscard) return -1; throw e; } };
  const args = Array.from({ length: N }, () => new Array(N));
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { calls = []; run(i, j); args[i][j] = calls; }
  mode = 2;
  const light = Array.from({ length: N }, () => new Float64Array(N));
  const d = (a, b) => (Array.isArray(a) ? a.map((v, n) => b[n] - v) : b - a);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const qi = i & ~1, qj = j & ~1, A = args[qi][j], BX = args[Math.min(qi + 1, N - 1)][j], AY = args[i][qj], BY = args[i][Math.min(qj + 1, N - 1)];
    fws = A.map((a, n) => {
      const bx = BX[n], ay = AY[n], by = BY[n];
      if (a == null || bx == null || ay == null || by == null) return 0;
      const dx = d(a, bx), dy = d(ay, by);
      return Array.isArray(dx) ? dx.map((v, m) => Math.abs(v) + Math.abs(dy[m])) : Math.abs(dx) + Math.abs(dy);
    });
    k = 0;
    light[i][j] = run(i, j);
  }
  return { N, at, light };
}

test('AUDIT WB9 court F1 - the Cleave\'s telegraph lights its own outline and nothing else: the rim\'s width was read off the edge\'s own derivative, and the cone\'s edge JUMPS (to 1e3 past its arc, along its sides past its reach, at his body) - a quad across the jump read a thousand-metre pixel, and every Cleave drew a full ring at its reach behind him, as bright as its true rim, its sides run on to the floor\'s edge; the pixel\'s footprint on the floor is the width now (mutants: the rim read off the edge\'s derivative)', () => {
  const atk = { i: 1, a: ATTACKS.cleave.id, at: 10000, x: 0, z: 0, yw: 0, tg: [[0, 5]] };
  const sh = telegraphShape(atk, 1, 10000 - 700, BASE_PROFILE);
  assert.equal(sh.kind, TELEGRAPH_KIND.cone);
  const { N, at, light } = runTelegraph(sh);
  let spurious = 0, outline = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const f = telegraphField(sh, at(i), at(j));
    if (!f.inside && f.edge > 1.5 && light[i][j] > 0.2) spurious++;
    if (f.edge < 0.1 && light[i][j] > 0.3) outline++;
  }
  assert.equal(spurious, 0, 'nothing lit well outside its outline - no ring behind him, no sides past its reach');
  assert.ok(outline > 40, `its own outline lit (${outline} pixels)`);
});

test('AUDIT WB9 court F3 - the telegraph\'s throb quickens to the rate it says: its phase is hz * uSince and uT grows with uSince, so its beat is 1.5 + 3 (hz - 1.5) a second. WB13a: on the line alone, three beats a second at the landing at most (WCAG 2.3.1) - it was 6.5, and court-wide through a Reckoning (mutants: the throb three times too fast)', () => {
  const m = TELEGRAPH_FS.match(/float hz = 1\.5 \+ (\d+\.\d+) \* T2;/);
  assert.ok(m, 'the quickening, on the wind-up\'s share squared');
  assert.match(TELEGRAPH_FS, /float T2 = uT \* uT;/);
  const K = Number(m[1]);
  assert.match(TELEGRAPH_FS, /float throb = 0\.85 \+ 0\.15 \* cos\(6\.283185307179586 \* hz \* uSince\);/, 'its phase hz * uSince');
  // the beat counted: the phase's own rate over the last half second of each wind-up, uT = uSince / uSpan
  for (const key of ['cleave', 'meteor', 'nova', 'reckon']) {
    const atk = { i: 1, a: ATTACKS[key].id, at: 100000, x: 0, z: 0, yw: 0, tg: [[3, 3]] };
    const phase = (ms) => { const s = telegraphShape(atk, 3, ms, BASE_PROFILE); return (1.5 + K * s.t * s.t) * s.since; };
    const beats = phase(100000 - 1) - phase(100000 - 501);
    assert.ok(beats / 0.5 <= TELEGRAPH_THROB_MAX_HZ + 0.01 && beats / 0.5 >= 2, `${key}: ${(beats / 0.5).toFixed(2)} beats a second at the landing`);
  }
});

test('AUDIT WB9 court F2 - the Reckoning broken: its stun is the last word said that frame, after the last crystal\'s - the relay fans them together, and said first, the shatter\'s line took the screen\'s one label and "The Reckoning breaks!" was never read (mutants: the stun said before the last crystal)', () => {
  const said = [];
  let clock = 0, st = GATE_STATE_EMPTY;
  const c = createGateCourt({ link: { state: () => st }, now: () => clock, feet: () => courtToDungeon(C3[0] + 3, 0, C3[1] + 3), player: () => ({ health: 100, maxHealth: 100 }), say: (t) => said.push(t) });
  const fold = (g, t) => { st = foldGate(st, g, t); };
  fold({ k: 'st', d: 700, b: 'ruhn', ph: 3, h: 400, m: 1000, x: C3[0], z: C3[1], yw: 0, mv: null, atk: null, sh: 0, wr: 1e12, n: 2, fell: null, wrath: null, md: null }, 0);
  const at = 30000, grew = at - ATTACKS.reckon.windup;
  fold({ k: 'atk', i: 40, a: ATTACKS.reckon.id, at, x: C3[0], z: C3[1], yw: 0, tg: [] }, grew);
  fold({ k: 'cx', i: 40, m: 40, c: [[C3[0] + 8, C3[1]], [C3[0] - 9, C3[1] + 4]] }, grew);
  clock = grew + 100; c.frame();
  fold({ k: 'cxb', i: 40, c: 0, n: 'Ann', at: grew + 3000 }, grew + 3000);
  clock = grew + 3010; c.frame();
  said.length = 0;
  fold({ k: 'cxb', i: 40, c: 1, n: 'Cyr', at: grew + 6000 }, grew + 6000);
  fold({ k: 'stun', until: grew + 6000 + STUN_MS, at: grew + 6000 }, grew + 6000);
  clock = grew + 6016; c.frame();
  const stun = COURT_RECKON_TEXT.broken(bossOf(st).name);
  assert.deepEqual(said, [COURT_RECKON_TEXT.shattered('Cyr', 0), stun], 'the last crystal, then the stun - the stun left on the label');
});

test('AUDIT WB9 court F4 - his shapes and his burning ground are drawn on over the laid walkways they reach: a Meteor or a pool on a fighter at the rim reaches a walkway past it - floor a fighter stands and is struck on - and the court\'s pass stopped at its rim; each walkway its court joins, as far as it is laid, never his mark; a walkway\'s strip leaves the courts\' own discs to their passes (mutants: no walkway drawn; the courts drawn twice under it)', () => {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4 }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }) });
  const pass = new GateTelegraphRenderer(gl);
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const w = WALKS[0], rim = [C1[0] + w.ux * (COURT_R - 2), C1[1] + w.uz * (COURT_R - 2)];   // a fighter at the rim, where walkway 0 leaves
  const meteor = telegraphShape({ i: 1, a: ATTACKS.meteor.id, at: 10000, x: C1[0], z: C1[1], yw: 0, tg: [rim] }, 2, 9500, BASE_PROFILE);
  pass.draw(meteor, I, I, [0, 0, 0], 1);
  assert.deepEqual([pass.drawn, pass.walked], [1, 0], 'no walkways told: the court alone');
  calls.length = 0;
  pass.draw(meteor, I, I, [0, 0, 0], 1, null, undefined, [0.5, 1]);
  assert.deepEqual([pass.drawn, pass.walked], [1, 1], 'court 0\'s shape: walkway 0 (the one it joins), as far as it is laid');
  const u = (n) => calls.filter((c) => c[0].startsWith('uniform') && c[1] === n).map((c) => c.slice(2));
  assert.deepEqual(u('uOnWalk').map((v) => v[0]), [0, 1, 0], 'the court, the walkway, back');
  assert.ok(Math.abs(u('uWalkLen')[0][0] - WALKS[0].len * 0.5) < 1e-9, 'half laid, half drawn');
  assert.deepEqual(u('uWalkC0')[0], [C1[0], C1[1]]); assert.deepEqual(u('uWalkC1')[0], [COURTS[1][0], COURTS[1][1]]);
  assert.equal(calls.filter((c) => c[0] === 'drawArrays').at(-1)[3], TELEGRAPH_WALK_QUAD.length / 2);
  const inMiddle = telegraphShape({ i: 1, a: ATTACKS.meteor.id, at: 10000, x: COURTS[1][0], z: COURTS[1][1], yw: 0, tg: [[COURTS[1][0], COURTS[1][1]]] }, 2, 9500, BASE_PROFILE);
  pass.draw(inMiddle, I, I, [0, 0, 0], 1, null, undefined, [1, 1]);
  assert.equal(pass.walked, 2, 'the middle court joins both');
  pass.draw(poolShapes([{ x: rim[0], z: rim[1], r: 5, from: 0, until: 5000, pct: 0.1, base: 1, el: 'fire' }], 1000, [1, 0.4, 0])[0], I, I, [0, 0, 0], 1, null, undefined, [1, 0]);
  assert.equal(pass.walked, 1, 'his burning ground too');
  pass.draw({ ...meteor, kind: TELEGRAPH_KIND.mark }, I, I, [0, 0, 0], 1, null, undefined, [1, 1]);
  assert.equal(pass.walked, 0, 'never his mark - he stands in his court');
  // the fragment stage: a point on walkway 0 past the rim, under the Meteor - lit on the walkway's strip, cut by the court's
  const past = [w.ax + w.ux * 4, w.az + w.uz * 4];
  assert.ok(Math.hypot(past[0] - C1[0], past[1] - C1[1]) > COURT_R);
  const fs = (extra, p) => {
    const fns = glslFunctions(TELEGRAPH_FS, { uKind: meteor.kind, uOrigin: meteor.origin, uYaw: 0, uR: meteor.r, uHalfArc: 0, uBody: 0, uEnd: [0, 0], uHalfW: 0, uR0: 0, uR1: 0, uPts: Array.from({ length: 10 }, (_, i) => meteor.points[i] ?? [0, 0]), uCount: meteor.points.length,
      uT: 0.5, uFlash: 0, uAlpha: 1, uColor: [1, 1, 1], uTime: 0, uCourt: [C1[0], C1[1]], uFloorR: COURT_R, uStyle: 0, uSince: 1, uSpan: 2, uAfter: -1, uPool: 0, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0],
      uOnWalk: 0, uWalkC0: [C1[0], C1[1]], uWalkC1: [COURTS[1][0], COURTS[1][1]], vCourt: p, vWorld: [p[0], 0.05, p[1]], o: [0, 0, 0, 0], fwidth: (x) => (Array.isArray(x) ? x.map(() => 0.05) : 0.05), ...extra });
    try { fns.main(); return fns.globals.o[0]; } catch (e) { if (e instanceof GlslDiscard) return -1; throw e; }
  };
  assert.ok(Math.hypot(past[0] - meteor.points[0][0], past[1] - meteor.points[0][1]) < meteor.r, 'the point is under the Meteor');
  assert.equal(fs({ uOnWalk: 0 }, past), -1, 'the court\'s pass: past its rim, cut');
  assert.ok(fs({ uOnWalk: 1 }, past) > 0, 'the walkway\'s: drawn');
  // the court hands the pass how far each walkway is laid, every frame, for his shapes and his ground (never his mark)
  const court = readFileSync(new URL('../../../src/scenes/gate/gateCourt.js', import.meta.url), 'utf8');
  assert.match(court, /for \(const w of WALKS\) _walked\[w\.k\] = walkFormed\(s\.xa, w\.k, t\);/);
  assert.match(court, /for \(const ps of poolDraw\) \{ pass\.draw\(ps, proj, view, eye, seconds, fog, COURT_CENTRE, _walked, _floors\);/);   // WB14b: and the night's floors
  assert.match(court, /if \(mark\) \{ pass\.draw\(mark, proj, view, eye, seconds, fog\); drew = true; \}/);
  assert.match(court, /if \(shape\) \{ pass\.draw\(shape, proj, view, eye, seconds, fog, COURT_CENTRE, _walked, _floors\);/);
  assert.equal(fs({ uOnWalk: 1 }, rim), -1, 'inside the court\'s disc the walkway\'s strip draws nothing - the court\'s pass has it');
  assert.ok(fs({ uOnWalk: 0 }, rim) > 0, 'where the court\'s pass draws it');
});

// ═══ THE SPOILS (WB9f) ════════════════════════════════════════════════════════════════════════════════════════════

test('AUDIT WB9 spoils F1 - every piece of a kept throw comes to rest on the court\'s floor over the REAL collider: the collider takes no hit nearer than a tenth of a millimetre, so a flight step begun that close above the floor missed it and the next began under it - about one kill in fifty (court 0, the fall at its heart, bearing pi/4, seed 35: the gold 292 m down); they fly over the floor they were kept to now (mutants: flown over the collider alone)', () => {
  const c = new Collider();
  const tris = courtFloorTris(); const n = tris.length / 3;
  const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  c.addMesh('wb:court', tris, idx, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const ray = (from, dir, len) => { const h = c.raycastHit(from, dir, len); return Number.isFinite(h?.dist) ? h : null; };
  for (const [seed, bearing] of [[35, Math.PI / 4], [7, 1.1], [1234, -2.4]]) {
    const at = courtToDungeon(0, 5.6 * 0.55, 0), keep = spoilsKeep(0, 0);
    const clock = { t: 100000 }, mem = new Map();
    const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), set: (k, v) => mem.set(k, JSON.stringify(v)), remove: (k) => mem.delete(k) };
    const p = createSpoilsPool({ ray, now: () => clock.t, take: () => {}, store, who: () => 'c', wall: () => 1 });
    assert.ok(p.spew({ day: 5000 + seed, seed, level: 10, at, bearing, keep }));
    for (let t = 0; t < 8000; t += 16) { clock.t += 16; p.frame(); }
    const pieces = p.state().pieces;
    assert.ok(pieces.length > 0 && pieces.every((q) => q.rest), `seed ${seed}: every piece at rest`);
    const off = pieces.filter((q) => Math.abs(q.pos[1] - keep.floorY) > 1e-6);
    assert.deepEqual(off, [], `seed ${seed}: every piece on the floor`);
  }
});

test('AUDIT WB9 spoils F2 - P or J pressed over a piece of his spoils is spent on that press: the spoil\'s rung takes it through the host and never read the armed mode, so the next E on a pile of three took all three (or opened its window) (mutants: the arm left standing)', () => {
  setPref('quickLoot', true);
  foldQuickLoot(resolveHover({ key: 'spoil:2', distance: 2, reach: 3.2 }, { name: () => ({ title: 'Ebony Dagger', subs: ['Rare'] }), contents: () => [{ name: 'Ebony Dagger' }] }));
  assert.equal(quickLootArm('QuickLootAll'), true, 'armed over the piece');
  quickLootSpend();   // the spoil's rung (scenes/worldModes.js)
  const pile = [{ name: 'Torch', weight: 0.5 }, { name: 'Apple', weight: 0.1 }, { name: 'Rope', weight: 1 }];
  foldQuickLoot(resolveHover({ key: 'droppedLoot:7', distance: 2, reach: 3.2 }, { name: () => ({ title: 'Loot Pile' }), contents: () => pile }));
  assert.equal(quickLootSelection()?.row ?? 0, 0);
  const player = { items: [], stats: {}, gold: 0 };
  quickLootTake('droppedLoot:7', { items: () => pile }, player, () => {});
  assert.equal(pile.length, 2, 'E took the lit row alone');
});

// ═══ THE BODIES IN A CROWD (WB9h) ═════════════════════════════════════════════════════════════════════════════════

const flush = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await flush(); };
const toScene = (p) => [p.x, p.y, p.z];
const peer = (id, x, z, race = id) => ({ id, name: id, told: true, look: { race, gender: 'male', faceIndex: 0, items: [] },
  shown: { x, y: 0, z, yaw: 0, pitch: 0, mv: 0, wd: 0, an: 0, as: 0, am: 0, sr: 0, cn: 0, cr: 0 } });
/** A counting rig (test/net/peer/wb9h_crowd_bodies.test.js's) that keeps what it was built from, its builds held until released. */
function rigs({ hold = false } = {}) {
  const made = [], gates = [];
  const factory = () => {
    const r = { id: made.length, mode: 'first', steps: [], draws: [], skinned: false, unloaded: false, cam: undefined, builds: 0,
      attach(renderer, cam) { r.cam = cam; },
      async build(opts) { r.opts = opts; r.builds++; if (hold) await new Promise((res) => gates.push(res)); else await flush(); return { ok: true }; },
      canThirdPerson: () => true, raceHeightScale: () => 1,
      setViewMode(m) { r.mode = m; return true; },
      thirdActive: () => r.mode === 'third' && r.skinned,
      update(dt, opts) { r.steps.push({ dt, pose: opts?.pose !== false, effectsDt: opts?.effectsDt }); if (opts?.pose !== false) r.skinned = true; },
      drawThird(canvas, p) { if (!r.thirdActive()) return false; r.draws.push(p); return true; },
      unload() { r.unloaded = true; r.skinned = false; },
    };
    made.push(r);
    return r;
  };
  return { made, factory, release: () => { while (gates.length) gates.shift()(); } };
}
const PROJ = mirrorProjectionX(perspective((70 * Math.PI) / 180, 16 / 9, 0.2, 6000));
const lens = (z) => ({ proj: PROJ, view: lookAt([0, 1.6, 0], [0, 1.6, z], [0, 1, 0]), eye: [0, 1.6, 0] });

test('AUDIT WB9 bodies F1 - a body the view comes back to steps its particles by at most EFFECTS_BANK_MAX_S: out of the view its clocks step unposed and its bank grew without end - a minute behind the eye handed sixty seconds to one particle step, throwing a hip lantern\'s flame out of its sprite (mutants: the bank unbounded)', async () => {
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => 1000 });
  const behind = peer('behind', 0, 8);
  for (let i = 0; i < 10 && !pb.has('behind'); i++) { pb.sync([behind], toScene, 1 / 60, [0, 0, 0]); pb.draw({}, lens(-10)); await settle(); }
  for (let f = 0; f < 600; f++) { pb.sync([behind], toScene, 1 / 60, [0, 0, 0]); pb.draw({}, lens(-10)); }   // ten seconds looking away
  pb.sync([behind], toScene, 1 / 60, [0, 0, 0]); pb.draw({}, lens(10));   // turned round
  const s = pb._bodies.get('behind').rig.steps.at(-1);
  assert.ok(s.pose && s.dt === 0, 'the catch-up pose');
  assert.ok(s.effectsDt > 0 && s.effectsDt <= EFFECTS_BANK_MAX_S + 1e-9, `its particles stepped ${s.effectsDt.toFixed(3)} s`);
});

test('AUDIT WB9 bodies F2 - a hand-over allowed on a spare stands the newcomer in it: the body given up, kept as a spare itself, pushed the oldest spare out of a full pool - the very one the hand-over was for - and the newcomer built behind another build while a body turned back into a doll (mutants: the hand-over\'s spare pushed out)', async () => {
  let now = 1000;
  const R = rigs({ hold: true });
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => now });
  const sync = (list) => pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  const land = async () => { await settle(); R.release(); await settle(); };
  const crowd = Array.from({ length: BODIES_MAX }, (_, i) => peer(`s${i}`, 0, -10 - i * 3, i === BODIES_MAX - 1 ? 'Nord' : `look${i}`));
  for (let i = 0; i < 40 && !crowd.every((p) => pb.has(p.id)); i++) { sync(crowd); await land(); }
  const nordKey = pb._bodies.get(`s${BODIES_MAX - 1}`).key;
  const list = [...crowd];
  // four nearer strangers come one by one, each handed the farthest body after its dwell (the Nord's first)
  for (let k = 0; k < 4; k++) {
    list.push(peer(`c${k}`, 0.2 * k, -2 - k * 0.1, `comer${k}`));
    sync(list); now += Math.max(SWAP_DWELL_MS, SWAP_EVERY_MS); sync(list);
    await land(); sync(list); now += 100;
  }
  assert.ok(pb._spares.length >= 4 && pb._spares[0].key === nordKey, 'the pool full, the Nord\'s the oldest spare');
  const nordRig = pb._spares[0].rig;
  // a standing stranger changes gear: rebuilt (a build in flight, held)
  const s1 = list.find((p) => p.id === 's1');
  now += BODY_REBUILD_MS;
  s1.look = { ...s1.look, items: [{ templateIndex: 1, group: 'Armor', equipSlot: 20 }] };   // PIN MOVED (MW-CROWD, FIELD BUGS 2026-10-01 #8): a weapon is the arm's live door and rebuilds no body now - armor does
  sync(list); await settle();
  assert.ok([...pb._bodies.values()].some((b) => b.state === 'building'), 'a build in flight');
  const twin = peer('twin', 1, -1.5, 'Nord');
  list.push(twin);
  sync(list); now += SWAP_DWELL_MS + SWAP_EVERY_MS; sync(list);
  const tb = pb._bodies.get('twin');
  assert.ok(tb, 'the Nord stranger stands');
  assert.equal(tb.state, 'ok', 'at once - no build');
  assert.equal(tb.rig, nordRig, 'in the Nord\'s spare');
  assert.equal(nordRig.unloaded, false);
  assert.equal([...pb._bodies.values()].filter((b) => b.state === 'building').length, 1, 'the one build in flight, no second');
});

test('AUDIT WB9 bodies F3 - a rig is built from the look its key names: the queued build read the peer\'s look when the queue reached it, so a look changed meanwhile was built under the old key - given up as a spare, the next peer in the old look stood in the new look\'s armour for good (mutants: the build reading the look late)', async () => {
  let now = 1000;
  const R = rigs({ hold: true });
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race, items: JSON.stringify(l.items) }), now: () => now });
  const sync = (list) => pb.sync(list, toScene, 1 / 60, [0, 0, 0]);
  const land = async () => { await settle(); R.release(); await settle(); };
  const plate = [{ templateIndex: 107, group: 'Armor', equipSlot: 3, material: 9 }];
  const crowd = Array.from({ length: BODIES_MAX }, (_, i) => peer(`s${i}`, 0, -4 - i * 3, i === BODIES_MAX - 1 ? 'Nord' : `look${i}`));
  const last = crowd[BODIES_MAX - 1];
  last.look.items = plate;
  sync(crowd);   // eight bodies queued; the last waits behind seven builds
  last.look = { ...last.look, items: [] };   // the plate taken off while its build waits
  for (let i = 0; i < 40 && !crowd.every((p) => pb.has(p.id)); i++) { sync(crowd); await land(); }
  const b = pb._bodies.get(last.id);
  assert.equal(b.rig.opts.items, JSON.stringify(plate), 'built from the look its key named when it was asked for - its key\'s, never another\'s');
});

test('AUDIT WB9 bodies F4 - a concealed peer who takes a spare is drawn veiled from the frame it stands: a new body\'s veil was set only on the frames after, and a spare stands the frame it is taken - an invisible player flashed whole for a frame (mutants: the spare\'s first frame drawn open)', async () => {
  let now = 1000;
  const R = rigs();
  const pb = new PeerBodies({ renderer: {}, createRig: R.factory, buildOpts: (l) => ({ race: l.race }), now: () => now });
  const conceal = (id) => (id === 'ghost' ? { kind: 'invisible' } : null);
  const crowd = Array.from({ length: BODIES_MAX }, (_, i) => peer(`c${i}`, 0, -4 - i * 3, 'Nord'));
  const frame = (list) => { pb.sync(list, toScene, 1 / 60, [0, 0, 0], { conceal }); return { open: pb.draw({ clientWidth: 1600, clientHeight: 900 }, lens(-10)), veiled: pb.drawVeiled() }; };
  for (let i = 0; i < 30 && !crowd.every((p) => pb.has(p.id)); i++) { frame(crowd); await settle(); }
  const ghost = peer('ghost', 0, -2, 'Nord');
  frame([...crowd, ghost]); now += SWAP_DWELL_MS;
  pb.sync([...crowd, ghost], toScene, 1 / 60, [0, 0, 0], { conceal });   // the frame it takes a spare
  const g = pb._bodies.get('ghost');
  assert.ok(g && g.state === 'ok', 'the ghost stands in a spare the frame it takes it');
  assert.deepEqual(g.veil, { kind: 'invisible' });
  const before = g.rig.draws.length;   // the spare's draws for its last wearer
  pb.draw({ clientWidth: 1600, clientHeight: 900 }, lens(-10));
  const veiled = pb.drawVeiled();
  const mine = g.rig.draws.slice(before);
  assert.ok(mine.length >= 1 && mine.every((d) => d.conceal), 'drawn veiled - never open');
  assert.ok(veiled >= 1);
});
