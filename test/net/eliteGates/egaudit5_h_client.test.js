// AUDIT EG V (2026-10-15, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.2, 22, 25.3 and 30) - FIX GROUP H,
// THE FOLLOWUPS (the screen's halves). Findings pinned here:
//   E NEW-1    THE HALLS GIVEN FORGOTTEN WITH THE BREACH - net/eliteGates/egLaw.js egSpecForget, never called before, is called on every way
//              out of the breach (the frame's way out, away), with what the screen asked and was given of them, so a way back
//              asks again;
//   L3-10 (b)  THE TRAIL - once a span's door opens, the first across's route drawn as a faint gold ribbon for the others: each
//              screen keeps every member's route (world/eliteGates/egLook.js egRibbonPush, a ridden point on its piece), the room names the
//              first across, the line pass draws it in its own buffer (render/eliteGates/egLinePass.js);
//   L3-10 (c)  THE ALLIES ON TRAVERSAL GROUND AT 60% - the host's every-peer veil asks the breach's client (allyVeil), and a veil
//              that keeps the name draws it (net/remotePlayers.js `named`).
// Fixtures from the producers: the halls from the law (egHallOf, egPieceAt), the breach from the director (egBreachNew, egEnter,
// egStateOf) through the wire (validEgOut) into the screen (createEgClient), the line pass on a recording WebGL2, the peers' layer
// (net/remotePlayers.js RemotePlayers).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, egCircleSpecs, egSpecGive, egSpecForget, egSpecDigest, EG_SPEC, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egPieceAt } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egFightFloorAt } from '../../../src/net/eliteGates/egFair.js';
import { egToDungeon } from '../../../src/world/eliteGates/egHall.js';
import { egRibbonPush, egTrailSegs, egEdgeLineColor, EG_TRAIL, EG_LINE_KIND, EG_FOG_FLOOR } from '../../../src/world/eliteGates/egLook.js';
import { EgLinePass, EG_LINE_FS, EG_LINE_VS } from '../../../src/render/eliteGates/egLinePass.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { CONCEAL_MODE } from '../../../src/systems/combatVisuals.js';
import { RemotePlayers } from '../../../src/net/remotePlayers.js';
import { glslFunctions, GlslDiscard } from '../../glsl.mjs';
import { egGive8 } from '../../egGive8.mjs';

const T0 = 1_800_000_000_000, ME = 'acct-0', BID = '0123456789abcdef';
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/**
 * The breach client of a member (`acct-0`) of a breach of two (seed 77) in hall `h` (stage `sg`), the mode machine's seams
 * recorded (the asks sent); `peers` the companions this screen hears (`{ sub, pos }`, the dungeon's frame, their feet), `tell`
 * a word through the wire, `step` the clock on, `state` the room's word of the breach as it stands.
 */
function inBreach(h, sg = 'trial') {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const B = egBreachNew({ b: BID, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co: [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]], site: SITE, wg: [] });
  for (const sub of [ME, 'acct-1']) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock), null);
  B.h = h; B.sg = sg; B.wk = clock - 1000; B.hw = clock - 1000; B.cnt = { left: 1_500_000, at: clock - 1000 };
  const L = { sent: [] };
  const spec = egHallOf(77, h, 0);
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: egToDungeon(spec, spec.arrive.x, 0, spec.arrive.z), height: 1.8, grounded: true, collider: { move: () => {} } };
  const st = { inside: true, circle: Math.ceil(h / 5) };
  const modes = { get mode() { return st.inside ? 'dungeon' : 'exterior'; }, egHallBreach: () => (st.inside ? B.b : null), egHallCircle: () => (st.inside ? st.circle : null),
    egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { st.inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => go(), enterEgHall: (r) => { st.inside = true; st.circle = r.c; return true; },
    forceExitToExterior: () => { st.inside = false; }, egSwapDrop: () => {}, egBandsDown: () => 0, egPrebuild: () => 'building' };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { L.sent.push({ k, ...f }); return true; } };
  const store = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) }; })();
  const peers = [];
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, now: () => clock, entity, player, cam: { pos: [3, 1.6, 4], yaw: 0 },
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true,
    hurt: () => {}, peers: () => peers, store, renderer: null, startWindow: null, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => client.word(wire(w));
  return { client, B, L, st, spec, peers, player, tell, state: () => tell(egStateOf(B, clock)), step: (ms) => { clock += ms; }, now: () => clock };
}
const settle = () => new Promise((r) => setImmediate(r));
/** A recording WebGL2 (the passes' tests' own shape): every call kept, a uniform's location its name, each made object counted. */
function recordingGl() {
  const calls = [], made = { create: 0, del: 0 };
  let ids = 0;
  const gl = new Proxy({ drawingBufferWidth: 1280, drawingBufferHeight: 720 }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => { made.create++; return { id: ++ids }; };
      if (typeof k === 'string' && k.startsWith('delete')) return (...a) => { made.del++; calls.push([k, ...a]); };
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...a) => { calls.push([k, ...a]); };
    },
  });
  return { gl, calls, made };
}

// ── E NEW-1: THE HALLS GIVEN FORGOTTEN WITH THE BREACH ──────────────────────────────────────────────────────────────────────
test('AUDIT EG V E NEW-1 THE HALLS GIVEN ARE FORGOTTEN ON EVERY WAY OUT (section 22, THE LAW PIN: "A few circles\' worth are kept"): a hall the room gave stands for net/eliteGates/egLaw.js egHallOf while the breach does; the screen stepping out of the Spire (the walk out, the frame\'s way out) and the online frame gone (away) forget it - egHallOf draws its own again - and with it what was asked and given, so a way back into a breach the room digests otherwise asks the circle\'s halls again (mutants: egSpecForget never called; the asked halls kept; away keeping them)', async () => {
  try {
    const P = inBreach(7);
    P.state();
    P.client.frame();
    // the room digests hall 7 otherwise than my law: the circle's halls asked, given, built
    const st = egStateOf(P.B, P.now());
    P.tell({ ...st, dg: (st.dg + 1) >>> 0 });
    P.step(500); P.client.frame();
    assert.deepEqual(P.L.sent.filter((w) => w.k === 'spec').map((w) => w.h), [6, 7, 8, 9, 10], 'the circle\'s halls asked');
    for (const s of egCircleSpecs(77, 2, 0)) P.tell({ k: 'spec', egv: EG_SPEC, h: s.h, sp: { ...JSON.parse(JSON.stringify(s)), given: 1 } });
    await settle();
    assert.equal(egHallOf(77, 7, 0).given, 1, 'the given hall stands for egHallOf');
    // the screen steps out of the Spire: the frame's way out forgets it
    P.st.inside = false;
    P.client.frame();
    assert.equal(egHallOf(77, 7, 0).given, undefined, 'stepped out: my own law\'s draw again');
    // a way back into the breach: the room's digest still otherwise - its halls asked again
    P.st.inside = true;
    P.L.sent.length = 0;
    P.tell({ ...egStateOf(P.B, P.now()), dg: (st.dg + 1) >>> 0 });
    P.step(500); P.client.frame();
    assert.deepEqual(P.L.sent.filter((w) => w.k === 'spec').map((w) => w.h), [6, 7, 8, 9, 10], 'asked again');
    // given again, then the online frame gone: away forgets them too
    for (const s of egCircleSpecs(77, 2, 0)) P.tell({ k: 'spec', egv: EG_SPEC, h: s.h, sp: { ...JSON.parse(JSON.stringify(s)), given: 2 } });
    await settle();
    assert.equal(egHallOf(77, 8, 0).given, 2);
    P.client.away();
    assert.equal(egHallOf(77, 8, 0).given, undefined, 'away: forgotten');
    assert.equal(egSpecDigest(egHallOf(77, 7, 0)), egSpecDigest(egHallOf(77, 7, 0, EG_SPEC)), 'my own draw');
    // the breach's own way out - a forsake walks me out - forgets them at its first step, before any frame outside
    const Q = inBreach(7);
    Q.state(); Q.client.frame();
    for (const s of egCircleSpecs(77, 2, 0)) Q.tell({ k: 'spec', egv: EG_SPEC, h: s.h, sp: { ...JSON.parse(JSON.stringify(s)), given: 3 } });
    await settle();
    assert.equal(egHallOf(77, 9, 0).given, 3);
    Q.B.mem[ME].forsaken = true;
    Q.state(); Q.client.frame();
    assert.equal(egHallOf(77, 9, 0).given, undefined, 'walked out: forgotten at the walk\'s first step');
  } finally { egSpecForget(); }
});

// ── L3-10 (b): THE TRAIL ─────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-10 (b) THE TRAIL, ITS LAW (section 8.2): a member\'s route kept a point a metre at most (egRibbonPush), at most EG_TRAIL.max; a point on a Drift kept on its piece, so the ribbon rides it; its segments in the dungeon\'s frame, EG_TRAIL.lift over the feet, into the buffer it is given and no further (egTrailSegs) (mutants: no thinning; the cap; a ridden point left where it was; the lift; the buffer overrun)', () => {
  const spec = egHallOf(77, 2, 0), drift = spec.steps.find((s) => s.kind === 'drift');
  assert.ok(drift && !egFightFloorAt(spec, drift.x, drift.y, drift.z), 'a Drift on traversal ground');
  const route = [];
  assert.equal(egRibbonPush(route, spec, 0, 0, 0, 1), true);
  assert.equal(egRibbonPush(route, spec, 0, 0, 0.6, 1), false, 'under a metre on: not kept');
  assert.equal(egRibbonPush(route, spec, 0, 0, 1.2, 1), true);
  // onto the Drift at its place at 3 s: kept on it
  const at3 = egPieceAt(drift, 3);
  assert.equal(egRibbonPush(route, spec, drift.x + at3.dx, drift.y, drift.z + at3.dz, 3), true);
  assert.ok(route[2].pl && route[2].pl[0] === drift.i, 'kept on its piece');
  const o = egToDungeon(spec, 0, EG_TRAIL.lift, 0), segs = new Float32Array(EG_TRAIL.max * 6);
  assert.equal(egTrailSegs(route, spec, 3, segs), 2);
  assert.deepEqual([...segs.subarray(0, 6)].map((v) => Math.round(v * 100) / 100), [o[0], o[1], o[2], o[0], o[1], o[2] + 1.2].map((v) => Math.round(v * 100) / 100), 'its first segment, lifted, in the dungeon\'s frame');
  const end3 = [segs[9], segs[11]];
  // at 6 s the Drift has moved: the ribbon's point rides it
  const at6 = egPieceAt(drift, 6);
  egTrailSegs(route, spec, 6, segs);
  assert.ok(Math.abs(at6.dx - at3.dx) > 0.2 || Math.abs(at6.dz - at3.dz) > 0.2, 'the Drift travels');
  assert.ok(Math.abs(segs[9] - (end3[0] + at6.dx - at3.dx)) < 1e-3 && Math.abs(segs[11] - (end3[1] + at6.dz - at3.dz)) < 1e-3, 'the ribbon rides it');
  // a buffer of one segment takes one; the cap
  assert.equal(egTrailSegs(route, spec, 6, new Float32Array(6)), 1);
  const long = [];
  for (let k = 0; k < EG_TRAIL.max + 40; k++) egRibbonPush(long, spec, 0, 0, 1.5 * k, 1);
  assert.equal(long.length, EG_TRAIL.max, 'at most EG_TRAIL.max');
});

test('AUDIT EG V L3-10 (b) THE TRAIL ON THE SCREEN (section 8.2: "once the door opens, the first across\'s route ... draws as a faint gold ribbon for the others"): a companion crosses a span on this screen - over its plate and onto its Drift - and opens the door; the room names it, and in the closing this screen draws its route; the one it names draws none of its own; a new hall forgets it (mutants: the door\'s name unread; the route unkept; drawn for the first across; drawn in the trial)', () => {
  const P = inBreach(2), spec = P.spec, drift = spec.steps.find((s) => s.kind === 'drift');
  P.state();
  const walk = [[0, 0, 0], [0, 0, 1.5], [0, 0, 3], [0, 0, 4.5]];
  for (const [x, y, z] of walk) { P.peers.length = 0; P.peers.push({ sub: 'acct-1', pos: egToDungeon(spec, x, y, z) }); P.step(200); P.client.frame(); }
  const tS = P.now() / 1000, q = egPieceAt(drift, tS);
  P.peers.length = 0; P.peers.push({ sub: 'acct-1', pos: egToDungeon(spec, drift.x + q.dx, drift.y, drift.z + q.dz) });
  P.client.frame();
  assert.equal(P.client.trail().n, 0, 'nothing drawn in the trial');
  // the door opens on acct-1: the room names it, the closing begins
  P.tell({ k: 'esay', w: 'door', s: ['acct-1'] });
  P.B.sg = 'closing'; P.state();
  P.step(200); P.client.frame();
  const T = P.client.trail();
  assert.equal(T.first, 'acct-1', 'the first across, as the room named it');
  assert.equal(T.n, walk.length, 'its route, a segment a step');
  const o = egToDungeon(spec, 0, EG_TRAIL.lift, 0);
  assert.ok(Math.abs(T.segs[0] - o[0]) < 1e-3 && Math.abs(T.segs[2] - o[2]) < 1e-3, 'from its first step');
  // the one the room names draws none of its own
  const Q = inBreach(2);
  Q.state();
  for (const [x, y, z] of walk) { Q.player.pos = egToDungeon(spec, x, y, z); Q.step(200); Q.client.frame(); }
  Q.tell({ k: 'esay', w: 'door', s: [ME] });
  Q.B.sg = 'closing'; Q.state();
  Q.step(200); Q.client.frame();
  assert.deepEqual([Q.client.trail().first, Q.client.trail().n], [ME, 0], 'the first across draws none');
  // the next hall forgets it
  P.B.h = 3; P.B.sg = 'arrive'; P.state();
  P.step(200); P.client.frame();
  assert.deepEqual([P.client.trail().first, P.client.trail().n], ['', 0], 'a new hall: forgotten');
});

test('AUDIT EG V L3-10 (b) THE TRAIL\'S LINE (render/eliteGates/egLinePass.js; sections 25.2 and 25.3): its kind THE EDGE LINE\'s gold at EG_TRAIL.alpha, never pulsing, EG_TRAIL.width times the line\'s width; drawn from its own buffer after the circle\'s lines, as many segments as it is given; freed with the pass, every object it made deleted (mutants: the trail opaque; pulsing; the width the line\'s; no buffer of its own; its buffer leaked)', () => {
  const frag = (kind, t = 0) => {
    const f = glslFunctions(EG_LINE_FS, { vWorld: [0, 0, 1], vAlong: 0.3, vKind: kind, vAlpha: 1, uGold: egEdgeLineColor(), uWhite: [0.95, 0.95, 1], uFogColor: [0, 0, 0], uFogFloor: [EG_FOG_FLOOR.floor, EG_FOG_FLOOR.within, EG_FOG_FLOOR.ease], uTime: t, uFogMode: 0, uFogDensity: 0, uFogRange: [0, 1], uCamPos: [0, 0, 0], uFocus: [0, 0, 0, 0], o: [0, 0, 0, 0] });
    try { f.main(); return [...f.globals.o]; } catch (e) { if (e instanceof GlslDiscard) return null; throw e; }
  };
  const g = egEdgeLineColor(), t0 = frag(EG_LINE_KIND.trail, 0), t1 = frag(EG_LINE_KIND.trail, 0.37);
  assert.equal(EG_LINE_KIND.trail, 3);
  assert.deepEqual(t0, t1, 'never pulsing');
  assert.ok(Math.abs(t0[3] - EG_TRAIL.alpha) < 1e-6, 'faint');
  assert.ok(Math.abs(t0[1] - g[1] * EG_TRAIL.alpha) < 1e-6, 'the line\'s gold');
  assert.match(EG_LINE_VS, new RegExp(`vKind == ${EG_LINE_KIND.trail} \\? uWidth \\* ${EG_TRAIL.width.toFixed(1)}`), 'wider than the line');
  const { gl, calls, made } = recordingGl();
  const lp = new EgLinePass(gl);
  const P0 = new Float32Array(16); P0[0] = P0[5] = P0[10] = P0[15] = 1;
  const segs = new Float32Array([0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 2]);
  assert.equal(lp.draw(P0, P0, [0, 0, 0], 1, null, null, 0, null, 0, 0, segs, 2), true, 'a trail alone draws');
  const draws = calls.filter((c) => c[0] === 'drawArrays');
  assert.deepEqual(draws.at(-1).slice(1), [1, 0, 12], 'its two segments, six vertices each');
  const sub = calls.filter((c) => c[0] === 'bufferSubData').at(-1);
  assert.equal(sub[3][8], EG_LINE_KIND.trail, 'its vertices of its kind');
  lp.destroy();
  assert.equal(made.del, made.create, 'every object it made deleted');
});

// ── L3-10 (c): THE ALLIES ON TRAVERSAL GROUND AT 60% ────────────────────────────────────────────────────────────────────────
test('AUDIT EG V L3-10 (c) AN ALLY ON TRAVERSAL GROUND DRAWN AT 60% (section 8.2: "so an ally never hides an edge line"): a living companion standing on a span\'s Drift - no fight floor - is drawn through ECV1\'s plain blend at 0.6, its name kept; on an island (a fight floor), in another hall, out of the Spire, a stranger, and I myself are drawn whole; the host\'s every-peer veil asks it, and the peers\' layer keeps the name of a veil that keeps it (mutants: the veil on a fight floor; the alpha; another hall\'s; the name dropped; the host never asking)', (t) => {
  // PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): written on spec law 8's span hall (its first fight floor an island
  // disc on its course) and read on it still - seed 77's first circle of law 8, given as a breach of law 8's is given to a client
  // (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and test/net/eliteGates/law9_rooms.test.js's
  egGive8(77, [1]);
  t.after(() => egSpecForget());
  const P = inBreach(2), spec = P.spec, drift = spec.steps.find((s) => s.kind === 'drift');
  P.state();
  P.client.frame();
  const id = (p) => p;
  const f0 = spec.fl[0], isle = f0.t === 'd' ? { x: f0.x, y: f0.y ?? 0, z: f0.z } : { x: (f0.ax + f0.bx) / 2, y: f0.y ?? 0, z: (f0.az + f0.bz) / 2 };
  const onDrift = egToDungeon(spec, drift.x, drift.y, drift.z), onIsle = egToDungeon(spec, isle.x, isle.y, isle.z);
  const v = P.client.allyVeil('acct-1', onDrift, id);
  assert.deepEqual(v && [v.mode, v.alpha, v.named], [CONCEAL_MODE.reveal, 0.6, true], 'on the Drift: ECV1\'s plain blend at 60%, named');
  assert.ok(egFightFloorAt(spec, isle.x, isle.y, isle.z), 'the span\'s island a fight floor');
  assert.equal(P.client.allyVeil('acct-1', onIsle, id), null, 'on its island: whole');
  assert.equal(P.client.allyVeil(ME, onDrift, id), null, 'I am no ally of mine');
  assert.equal(P.client.allyVeil('acct-9', onDrift, id), null, 'a stranger: whole');
  assert.equal(P.client.allyVeil('acct-1', egToDungeon(egHallOf(77, 3, 0), drift.x, drift.y, drift.z), id), null, 'another hall\'s: whole');
  P.st.inside = false;
  assert.equal(P.client.allyVeil('acct-1', onDrift, id), null, 'out of the Spire: whole');
  // the peers' layer: a veil that keeps the name draws it; ECV1's concealment does not
  const rp = new RemotePlayers({ renderer: { drawScreenQuad: () => {}, drawScreenQuadRun: () => {} }, deps: null, compose: async () => null });
  const row = { id: 'p1', name: 'ANN', title: null, glyphs: [], shown: { x: 0, y: 0, z: 0, yaw: 0 }, look: null };
  rp.sync([row], (p) => [p.x, p.y, p.z], { bodyHeight: () => 1.8, conceal: () => v });
  assert.equal(rp._shown.length, 1, 'named: its name drawn');
  rp.sync([row], (p) => [p.x, p.y, p.z], { bodyHeight: () => 1.8, conceal: () => ({ mode: CONCEAL_MODE.blend, alpha: 0.3, t: 0, phase: 0 }) });
  assert.equal(rp._shown.length, 0, 'concealed: no name');
  // the doll's and the class sprite's figures keep it as the body's does (the layer's three name sites)
  const named = readFileSync(new URL('../../../src/net/remotePlayers.js', import.meta.url), 'utf8').match(/if \(!veil \|\| (?:\/\*\* @type \{any\} \*\/ \()?veil\)?\.named\) this\._shown\.push/g) ?? [];
  assert.equal(named.length, 3, 'every figure keeps a named veil\'s name');
  // the host asks it for every peer it draws plain (scenes/world.js - the one line of its veil loop)
  assert.match(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8'), /const veil = look\.kind === 'conceal' \? look\.visual : egClient\?\.allyVeil\(social\?\.accountOfPeer\?\.\(d\.id\), d\.shown, onlineToScene\) \?\? null; if \(veil\) _veils\.set\(d\.id, veil\);/);
});
