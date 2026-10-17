// AUDIT EG III (2026-10-13; bible/11-Multiplayer/Elite-Gates.md, the client group's findings - lane4 #1-#13 and lane6 #1):
// THE BREACH CLIENT'S HOSTS, ITS ALLOCATIONS AND ITS SEAMS, PINNED. The witness never cast back, the world host minting both
// witness hooks and the dungeon arm - the Spire's own frame - applying its eye, damped and colliding (section 16.5); the law
// pin's rebuild reached through a host that offers the swap's worker, and no worker's build under another law; the Beats'
// pictures freed with the band dress; THE EDGE LINE and the ghosts in the danger palette; the look keyed on the level that
// stands; the swap's worker let go every way out; the refusal's one type; a receipt carried that a flush in flight heard;
// the frame's lists kept; the start window's question that is put out of its slot; and the veil's look taken while it
// opens. Fixtures from the producers: the breach from the director (egBreachNew, egEnter, egStateOf through the wire), the
// receipts minted (mintEgReceipt), DFU's YesNo box (ui/yesNoBox.js), the veil and the passes over a recording page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEgClient, egWitnessOrbit, egWitnessClear, egWitnessDamp, EG_WITNESS_DAMP_S, EG_WITNESS_SNAP_M, EG_WITNESS_BACK, EG_WITNESS_UP, EG_START_ASKING_TEXT, EG_CLAIM_RETRY_MS } from '../../../src/scenes/eliteGates/egClient.js';
import { egHallOf, egCircleSpecs, egCircleOfHall, egSpecForget, EG_SPEC, EG_SEALED_MS, EG_DECREES } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { validEgOut } from '../../../src/net/wire.js';
import { mintEgReceipt } from '../../../src/net/eliteGates/egReceipt.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { CAMERA_OBSTACLE_LIMIT, MW_UNITS_PER_METER } from '../../../src/player/mwCamera.js';
import { egBeatTellUp, egBeatTellDown, egGhostRgb } from '../../../src/scenes/eliteGates/egSpan.js';
import { EG_BEAT_TELL_RECORDS, egTellArchive } from '../../../src/world/eliteGates/egBandArt.js';
import { egEdgeLineColor, egCircleEdges, EG_EDGE_LINE } from '../../../src/world/eliteGates/egLook.js';
import { EG_DANGER_PALETTES } from '../../../src/ui/eliteGates/egAccess.js';
import { EgLinePass } from '../../../src/render/eliteGates/egLinePass.js';
import { SdStepsPass, SD_GHOST } from '../../../src/render/superDungeon/sdStepsPass.js';
import { createEgOccluders, egOccludersHit } from '../../../src/scenes/eliteGates/egOcclude.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { spireHeld, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { openEgStartWindow, egStartAsk } from '../../../src/ui/eliteGates/egStartWindow.js';
import { YesNoBoxWindow } from '../../../src/ui/yesNoBox.js';
import { createGateVeil, VEIL_CUES, VEIL_BRASS_CUES } from '../../../src/ui/gate/gateVeil.js';
import { EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `${a} .. ${b}`); return src.slice(i, j); };
const settle = () => new Promise((r) => setImmediate(r));
const T0 = 1_800_000_000_000, ME = 'acct-0', BID = '0123456789abcdef';
const subtle = globalThis.crypto.subtle;
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) }; }

/** A recording WebGL2 (the passes' tests' own shape): every call kept, a uniform's location its name. */
function recordingGl() {
  const calls = [];
  let ids = 0;
  const gl = new Proxy({ drawingBufferWidth: 1280, drawingBufferHeight: 720 }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'getProgramParameter' || k === 'getShaderParameter') return () => true;
      if (k === 'getUniformLocation') return (_p, n) => n;
      if (k === 'getAttribLocation') return () => 0;
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ id: ++ids });
      if (typeof k === 'string' && k.toUpperCase() === k) return 1;
      return (...a) => { calls.push([k, ...a]); };
    },
  });
  return { gl, calls };
}

/**
 * A member of a breach of two (seed 77, `acct-0` me) standing in hall `h` in stage `sg`, its state the director's own
 * through the wire; the mode machine's seams recorded (`modes` adds or replaces any), the circle standing `circle` (the
 * company's by default).
 */
function inBreach({ h = 2, sg = 'trial', egv = null, circle = null, modes: extra = {}, renderer = null, account: acct = {}, startWindow = null, hub = null, wire = null } = {}) {
  let clock = T0 + EG_SEALED_MS + 60_000;
  const co = [[ME, 'Mac', 1], ['acct-1', 'Ann', 2]];
  const Br = egBreachNew({ b: BID, ez: 'z'.repeat(20), s: ME, o: 'Mac', ew: 0, rh: 0, seed: 77, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  for (const [sub] of co) egEnter(Br, sub, `ord${sub}`.padEnd(20, 'x'), 30, clock);
  Br.h = h; Br.sg = sg; Br.wk = clock - 1000; Br.cnt = { left: 1_500_000, at: clock - 1000 };
  if (egv != null) Br.egv = egv;
  const L = { sent: [], said: [], mids: [], hurt: [], drops: 0, steps: 0, prebuilt: [], enter: [], exits: 0, stepGo: [] };
  const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const player = { pos: realmToDungeon(0, 0, 0), height: 1.8, grounded: true, collider: { move: () => {} } };
  const st = { inside: true, circle: circle ?? egCircleOfHall(h) };
  const modes = { get mode() { return st.inside ? 'dungeon' : 'exterior'; }, egHallBreach: () => (st.inside ? Br.b : null), egHallCircle: () => (st.inside ? st.circle : null),
    egPlace: (at) => { player.pos = [...at]; return true; }, egLeave: () => { st.inside = false; return true; }, egHallReturn: () => null, dungeonCtx: { exitDoors: [] },
    stepThroughFire: async (go) => { L.steps++; const g = L.stepGo.shift(); if (g === false) return false; return go(); },
    enterEgHall: (r) => { L.enter.push(r); st.inside = true; st.circle = r.c; return true; }, forceExitToExterior: () => { L.exits++; st.inside = false; },
    egSwapDrop: () => { L.drops++; }, egBandsDown: () => 0, ...extra };
  const online = { welcomes: 1, terminal: false, error: null, sendEg: (k, f = {}) => { L.sent.push({ k, ...f }); return true; } };
  let peers = [];
  const store = memStore();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => hub, now: () => clock, entity, player, cam: { pos: [3, 1.6, 4], yaw: 0 },
    account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }), ...acct },
    say: (t) => L.said.push(t), mid: (t) => L.mids.push(t), site: () => ({}), wire: () => wire, landAt: () => true, hurt: (n) => { L.hurt.push(n); entity.health -= n; },
    peers: () => peers, store, renderer, startWindow, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) } });
  const tell = (w) => { const v = validEgOut(JSON.parse(JSON.stringify(w))); assert.ok(v, `the wire refuses ${w.k}`); client.word(v); };
  tell(egStateOf(Br, clock));
  const spec = egHallOf(77, h, 0);
  if (spec.arrive) player.pos = realmToDungeon(spec.x0 + spec.arrive.x, 0, spec.arrive.z);
  return { client, B: Br, entity, player, L, st, online, tell, spec, store, step: (ms) => { clock += ms; }, now: () => clock, setPeers: (p) => { peers = p; } };
}

// ── lane4 #1, lane6 #1: THE WITNESS ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III lane4 #1 / lane6 #1 THE WITNESS IS NEVER CAST BACK, AND THE HOSTS MINT ITS TWO HOOKS (section 16.5): a fallen member\'s body, held under the hall, owes the void nothing - no hurt, no beat - where a living member\'s cast-back still costs its share; the world host\'s mode-machine host mints `egWitness` and `egWitnessEye` off the breach\'s client (THE SHAPE THE PRODUCER MINTS - its own literal, not a test\'s hand-built host), and the dungeon arm (the Spire\'s frame) applies the eye after its camera, the spans\' ride asking the witness hook (mutants: the cast-back unguarded; either hook unminted; the eye never applied in the dungeon arm)', () => {
  const P = inBreach();
  P.client.frame();
  P.client.castBack();
  assert.equal(P.L.hurt.length, 1, 'a living member pays the void');
  P.entity.health = P.entity.maxHealth;
  assert.equal(P.client.fallSave(), true, 'a fall: the witness');
  P.client.frame();
  const hurtBefore = P.L.hurt.length, beats = P.L.mids.length;
  for (let k = 0; k < 10; k++) P.client.castBack();   // the spans' ride, frame after frame, as a host with no witness hook asked it
  assert.equal(P.L.hurt.length, hurtBefore, 'the witness pays nothing');
  assert.equal(P.L.mids.length, beats, 'and hears no cast-back');
  // the world host's literal hands both hooks to the mode machine, off the client
  const W = rd('src/scenes/world.js');
  const host = between(W, '  var modes = createWorldModes({', '\n  });');
  assert.ok(host.includes('    egWitness: () => !!egClient?.witnessing(),'), 'the witness hook minted');
  assert.ok(host.includes('    egWitnessEye: (v, dt, cast) => egWitnessEye(v, dt, cast),'), 'the eye hook minted');
  assert.match(W, /const egWitnessEye = \(\/\*\* @type \{\{ eye: any \}\} \*\/ v, dt = 0, cast = null\) => \{ if \(egClient\?\.witnessing\(\)\) \{ const c = \{ pos: v\.eye \}; if \(egClient\.witnessEye\(c, cam\.yaw, \{ dt, cast \}\)\) v\.eye = c\.pos; \} \};/);
  // the dungeon arm: the eye after its own camera, before the view is made of it; the spans ask the witness hook
  const WM = rd('src/scenes/worldModes.js');
  const arm = between(WM, '    const mwv = mwViewFrame({\n      fpEye: cam.pos, feet: player.feetAt(), yaw: cam.yaw, pitch: cam.pitch,', '    const view = betterAmbience.view(lookAt(mwv.eye,');
  // PIN MOVED (AUDIT EG V, e: L6-4 - the eye's cast is one function of the arm's, never a closure a Spire frame)
  assert.match(arm, /if \(mode === 'dungeon' && isEgHall\(dungeonLoc\)\) host\.egWitnessEye\?\.\(mwv, dt, egEyeCast\);/);
  assert.match(WM, /const egEyeCast = \(o, r, d, m\) => \{ const h = player\.collider\?\.sphereCast\?\.\(o, r, d, m\)\?\.dist; return Number\.isFinite\(h\) \? h : null; \};/);
  assert.match(WM, /dungeonCtx\?\.egSpanRide\?\.\(dt, player, !overlayHeld && !host\.egWitness\?\.\(\)\)/);
});

test('AUDIT EG III lane6 #1 THE WITNESS\'S ORBIT, DAMPED AND COLLIDING (section 16.5: "critically damped (0.35 s), colliding as the Morrowind body\'s camera does"): the eye stands at once on its first frame and on a new member watched; a step of the watched member is followed with no overshoot, 40.6% of it still to go at 0.35 s (the critically damped curve\'s (1 + 2) e^-2); a step past EG_WITNESS_SNAP_M stands at once; the sphere cast from the watched member\'s pose along the way out pulls it in, the swept sphere the camera\'s own clearance; and the client\'s eye rides both (mutants: the smoothing time; overshoot; no snap; the cast ignored; the clearance)', () => {
  // the curve
  let e = egWitnessDamp(null, [0, 0, 0], 1 / 60, 'a');
  assert.deepEqual([e.p, e.v], [[0, 0, 0], [0, 0, 0]], 'the first frame: at once');
  let peak = 0, at35 = NaN;
  for (let i = 1; i <= 180; i++) { e = egWitnessDamp(e, [1, 0, 0], 1 / 60, 'a'); peak = Math.max(peak, e.p[0]); if (i === Math.round(EG_WITNESS_DAMP_S * 60)) at35 = 1 - e.p[0]; }
  assert.equal(EG_WITNESS_DAMP_S, 0.35);
  assert.ok(at35 > 0.400 && at35 < 0.412, `${at35} of the step left at the smoothing time`);
  assert.ok(peak <= 1 + 1e-9, 'critically damped: never past it');
  assert.ok(Math.abs(e.p[0] - 1) < 1e-4, 'and there');
  const far = egWitnessDamp(e, [1 + EG_WITNESS_SNAP_M + 0.1, 0, 0], 1 / 60, 'a');
  assert.deepEqual(far.p, [1 + EG_WITNESS_SNAP_M + 0.1, 0, 0], 'a pull to another plate: at once');
  assert.deepEqual(egWitnessDamp(null, [5, 6, 7], 1 / 60, 'b').p, [5, 6, 7]);
  // the orbit and its cast
  const p = [10, 2, 20], o0 = egWitnessOrbit(p, 0);
  assert.deepEqual(o0, [10, 2 + EG_WITNESS_UP + 1.6, 20 - EG_WITNESS_BACK], 'the orbit point');
  assert.deepEqual(egWitnessClear(p, o0), o0, 'no cast: the point');
  const asked = [];
  const pulled = egWitnessClear(p, o0, (o, r, d, m) => { asked.push({ o, r, d, m }); return 1; });
  const len = Math.hypot(EG_WITNESS_UP + 1.6, EG_WITNESS_BACK);
  assert.deepEqual(asked.map((q) => [q.o, q.r]), [[p, CAMERA_OBSTACLE_LIMIT / MW_UNITS_PER_METER]], 'from the pose, the camera\'s clearance');
  assert.ok(Math.abs(asked[0].m - len) < 1e-9 && Math.abs(Math.hypot(...asked[0].d) - 1) < 1e-9);
  for (let a = 0; a < 3; a++) assert.ok(Math.abs(asked[0].d[a] - (o0[a] - p[a]) / len) < 1e-9, 'along the way out');
  assert.ok(Math.abs(Math.hypot(pulled[0] - p[0], pulled[1] - p[1], pulled[2] - p[2]) - 1) < 1e-9, 'pulled in to the hit');
  assert.deepEqual(egWitnessClear(p, o0, () => null), o0, 'no hit: the point');
  assert.deepEqual(egWitnessClear(p, o0, () => len + 3), o0, 'a hit past it: the point');
  // the client's eye
  const P = inBreach();
  P.client.frame();
  P.client.fallSave();
  P.B.mem[ME].alive = 0; P.B.mem[ME].wit = 1; P.B.mem[ME].falls = 1;
  P.tell(egStateOf(P.B, P.now()));
  P.setPeers([{ sub: 'acct-1', pos: [10, 2, 20] }]);
  P.step(60_000); P.client.frame();
  const c = { pos: [0, 0, 0] };
  assert.equal(P.client.witnessEye(c, 0, { dt: 1 / 60 }), true);
  assert.deepEqual(c.pos, egWitnessOrbit([10, 2, 20], 0), 'the first eye: at once');
  P.setPeers([{ sub: 'acct-1', pos: [11, 2, 20] }]);
  P.client.witnessEye(c, 0, { dt: 1 / 60 });
  assert.ok(c.pos[0] > 10 && c.pos[0] < 10.05, `followed, damped: ${c.pos[0]}`);
  P.client.witnessEye(c, 0, { dt: 1 / 60, cast: () => 0.5 });
  assert.ok(Math.abs(Math.hypot(c.pos[0] - 11, c.pos[1] - 2, c.pos[2] - 20) - 0.5) < 1e-9, 'pulled in off the rock at once - never damped into it');
});

// ── lane4 #3: THE LAW PIN'S REBUILD ─────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III lane4 #3 THE LAW PIN\'S REBUILD THROUGH A HOST THAT OFFERS THE SWAP (section 22, EG-H2 departure 4; AUDIT EG V, E NEW-2 - PIN MOVED: the worker builds under another law from the halls the room gave): under another law no worker\'s build is asked while a hall of the circle is not given; once all five halls of the circle standing are given it is built again under the veil from them - the worker handed them with the ask; a step that does not go is asked again by the next frame and the rebuild counted once it runs; while the Court rests the next circle\'s halls are asked of the room and handed to the worker, and the step into that circle, stood from them, is never built again; under my own law the swap is asked as before (mutants: the worker asked before the halls are given; the halls not handed; the rebuild counted before its step; the rebuild never asked again; the next circle not asked at the rest; the circle stood from the halls given built again)', async () => {
  const yard = egCircleSpecs(77, 1, 0)[1];
  const P = inBreach({ h: yard.h, egv: EG_SPEC - 1, modes: { egPrebuild: (r) => { P.L.prebuilt.push({ c: r.c, laid: r.given?.map((s) => s.laid) ?? null }); return null; } } });
  const roomGives = (hs) => { for (const h of hs) P.tell({ k: 'spec', egv: P.B.egv, h, sp: { ...JSON.parse(JSON.stringify(egHallOf(77, h, 0))), laid: 90 + h } }); };
  const asked = () => P.L.sent.filter((f) => f.k === 'spec').map((f) => f.h);
  try {
    P.L.stepGo.push(false);   // the first rebuild's step does not go
    P.client.frame(); P.client.frame();
    assert.deepEqual(asked(), [1, 2, 3, 4, 5], 'the circle\'s halls asked of the room');
    roomGives([1, 2, 3, 4]);
    await settle();
    P.client.frame(); await settle();
    assert.deepEqual(P.L.prebuilt, [], 'no worker\'s build while a hall is not given');
    roomGives([5]);
    await settle();
    for (let i = 0; i < 6; i++) { P.step(500); P.client.frame(); await settle(); }
    assert.ok(P.L.prebuilt.length >= 1 && P.L.prebuilt.every((p) => p.c === 1 && String(p.laid) === '91,92,93,94,95'), `the worker handed the five halls given: ${JSON.stringify(P.L.prebuilt)}`);
    assert.equal(P.L.steps, 2, 'the step that did not go asked again, and the rebuild ran once');
    assert.equal(P.L.enter.length, 1, 'built again from the halls given');
    assert.equal(P.L.exits, 1);
    // the rest under another law: the next circle's halls asked of the room, then handed to the worker
    P.L.prebuilt.length = 0;
    P.B.sg = 'rest'; P.tell(egStateOf(P.B, P.now())); P.client.frame();
    assert.deepEqual(asked().slice(5), [6, 7, 8, 9, 10], 'the next circle\'s halls asked while the Court rests');
    assert.deepEqual(P.L.prebuilt, [], 'not built before they are given');
    roomGives([6, 7, 8, 9, 10]);
    await settle();
    P.client.frame();
    assert.deepEqual(P.L.prebuilt, [{ c: 2, laid: [96, 97, 98, 99, 100] }], 'the next circle built from the halls the room gave');
    // the step into it: stood from them (the worker's, or the old step's from this thread's halls) - never built again
    P.B.h = 6; P.B.sg = 'arrive'; P.tell(egStateOf(P.B, P.now()));
    for (let i = 0; i < 6; i++) { P.step(500); P.client.frame(); await settle(); }
    assert.deepEqual(P.L.enter.map((r) => r.c), [1, 2], 'the next circle stood once');
    assert.equal(P.L.steps, 3);
  } finally { egSpecForget(); }
  // under my own law the rest asks the worker as before, with no halls given
  const Q = inBreach({ h: 5, sg: 'rest', modes: { egPrebuild: (r) => { Q.L.prebuilt.push([r.c, r.given]); return 'building'; } } });
  Q.client.frame();
  assert.deepEqual(Q.L.prebuilt, [[2, undefined]], 'the next circle built while the Court rests');
  assert.ok(!Q.L.sent.some((f) => f.k === 'spec'), 'and nothing asked of the room');
});

test('AUDIT EG V E NEW-2 THE HALLS GIVEN ARE THEIR GROUND\'S (section 22, THE LAW PIN; section 14 - the span decrees lay a circle on its own ground): under another law the next circle\'s halls the room gave while the Court rested, under the ground then in force, build nothing once that circle stands on another - the step is the old one, its halls asked again under its own ground, a late answer under the old one counts for nothing, and the circle is built again once its own five are given (mutants: a hall counted under the ground in force rather than its own; the halls looked up under no ground)', async () => {
  const P = inBreach({ h: 5, sg: 'rest', egv: EG_SPEC - 1, modes: { egPrebuild: (r) => { P.L.prebuilt.push({ c: r.c, geo: r.geo, laid: r.given?.map((s) => s.laid) ?? null }); return null; } } });
  const roomGives = (hs, geo, mark) => { for (const h of hs) P.tell({ k: 'spec', egv: P.B.egv, h, sp: { ...JSON.parse(JSON.stringify(egHallOf(77, h, geo))), laid: mark + h } }); };
  const asked = () => P.L.sent.filter((f) => f.k === 'spec').map((f) => f.h);
  try {
    P.client.frame();
    assert.deepEqual(asked(), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'the circle\'s halls and the next\'s asked while the Court rests');
    roomGives([1, 2, 3, 4, 5], 0, 90); await settle();
    roomGives([6, 7, 8, 9, 10], 0, 90); await settle();
    P.client.frame(); await settle();
    assert.deepEqual(P.L.prebuilt.at(-1), { c: 2, geo: 0, laid: [96, 97, 98, 99, 100] });
    assert.deepEqual(P.L.enter.map((r) => r.c), [1]);
    // the next circle stands on another ground (a span decree in force): its step is the old one, its halls asked again
    const gale = EG_DECREES.find((D) => D.key === 'gale').id;
    P.B.dc = [[gale, 1]]; P.B.h = 6; P.B.sg = 'arrive'; P.tell(egStateOf(P.B, P.now()));
    const geo = P.client.link.state().geo, n0 = P.L.prebuilt.length;
    assert.ok(geo > 0, 'another ground');
    P.client.frame(); await settle();
    assert.equal(P.L.prebuilt.length, n0, 'nothing built from the halls of the old ground');
    assert.deepEqual(P.L.enter.slice(1).map((r) => [r.c, r.geo]), [[2, geo]], 'the old step');
    assert.deepEqual(asked().slice(10), [6, 7, 8, 9, 10], 'its halls asked under its own ground');
    roomGives([6, 7, 8, 9, 10], 0, 150); await settle();
    for (let i = 0; i < 3; i++) { P.step(500); P.client.frame(); await settle(); }
    assert.equal(P.L.prebuilt.length, n0, 'a late answer under the old ground: nothing');
    assert.equal(P.L.enter.length, 2);
    roomGives([6, 7, 8, 9, 10], geo, 200); await settle();
    for (let i = 0; i < 3; i++) { P.step(500); P.client.frame(); await settle(); }
    assert.deepEqual(P.L.prebuilt.slice(n0), [{ c: 2, geo, laid: [206, 207, 208, 209, 210] }], 'its own five handed to the worker');
    assert.deepEqual(P.L.enter.slice(1).map((r) => [r.c, r.geo]), [[2, geo], [2, geo]], 'and the circle built again from them, once');
  } finally { egSpecForget(); }
});

// ── lane4 #4, #5: THE BEATS' PICTURES, THE PALETTE ──────────────────────────────────────────────────────────────────
/** A renderer counting its live textures (keys) - uploads, releases, evictions. */
function countingRenderer() {
  const tex = new Set(), em = new Set();
  return { tex, em, uploadTexture(a, r) { tex.add(`${a}_${r}`); return {}; }, uploadEmissionTexture(a, r) { em.add(`${a}_${r}`); return {}; },
    releaseTexture(a, r) { return tex.delete(`${a}_${r}`); }, evictEmissionTexture(k) { return em.delete(k); } };
}
test('AUDIT EG III lane4 #4 THE BEATS\' PICTURES HAVE AN OWNER (section 29: "band textures are cached per band and freed at the breach\'s end"): every picture the spans put up under a band\'s tell archive - each palette\'s warning stages and the return, albedo and emission - is freed by egBeatTellDown, and the mode machine\'s band dress owner calls it; a second call frees nothing; the next breach uploads them again (mutants: a record kept; the emission kept; the record of them kept; never called from egBandsDown)', () => {
  const r = countingRenderer();
  assert.equal(egBeatTellUp(r, 1, 'standard'), true);
  assert.equal(egBeatTellUp(r, 1, 'contrast'), true);
  assert.equal(egBeatTellUp(r, 3, 'standard'), true);
  const per = EG_BEAT_TELL_RECORDS.warn[0].length, back = EG_BEAT_TELL_RECORDS.back.length;
  const up = r.tex.size + r.em.size;
  assert.equal(r.tex.size, per * 3 + back * 2, 'three palettes\' stages, two bands\' returns');
  assert.equal(r.em.size, r.tex.size);
  assert.ok([...r.tex].every((k) => k.startsWith(`${egTellArchive(1)}_`) || k.startsWith(`${egTellArchive(3)}_`)));
  assert.equal(egBeatTellDown(r), up, 'every one freed');
  assert.deepEqual([r.tex.size, r.em.size], [0, 0]);
  assert.equal(egBeatTellDown(r), 0, 'again: nothing');
  assert.equal(egBeatTellDown(null), 0);
  egBeatTellUp(r, 1, 'standard');
  assert.equal(r.tex.size, per + back, 'the next breach uploads again');
  const WM = rd('src/scenes/worldModes.js');
  assert.match(between(rd('src/scenes/eliteGates/egCircleHost.js'), '  function egBandsDown() {', '  /** EG-G2: a circle\'s band\'s dress uploaded'), /let n = egBeatTellDown\(renderer\);/);
});

test('AUDIT EG III lane4 #5 THE EDGE LINE AND THE GHOSTS IN THE DANGER PALETTE (sections 25.2, 25.3 and 25.7): the Standard keeps the line\'s own gold and the Steps\' ghost gold; every other palette draws them in its safety - the edge line at the line\'s luminance - and the tracks and streamers in its hazard; the line pass\'s uniforms and the ghost pass\'s colour carry it, and the client hands the palette to the look (mutants: the palette ignored; the luminance unscaled; the hazard ignored; the ghosts\' colour fixed)', () => {
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.deepEqual(egEdgeLineColor(EG_DANGER_PALETTES.standard), egEdgeLineColor());
  assert.deepEqual(egEdgeLineColor(null), egEdgeLineColor());
  for (const key of ['contrast', 'deutan', 'tritan']) {
    const pal = EG_DANGER_PALETTES[key], c = egEdgeLineColor(pal);
    assert.ok(Math.abs(luma(c) - EG_EDGE_LINE.luma) < 1e-9, `${key} at the line's luminance`);
    const k = c[0] / pal.safety[0];
    for (let a = 0; a < 3; a++) assert.ok(Math.abs(c[a] - pal.safety[a] * k) < 1e-9, `${key} its safety`);
    assert.deepEqual(egGhostRgb(pal), pal.safety);
  }
  assert.deepEqual(egGhostRgb(EG_DANGER_PALETTES.standard), SD_GHOST.color);
  assert.deepEqual(egGhostRgb(null), SD_GHOST.color);
  // the line pass
  const { gl, calls } = recordingGl();
  const lp = new EgLinePass(gl);
  lp.setCircle(egCircleEdges(77, 1, 0));
  const u3 = (name) => calls.filter((c) => c[0] === 'uniform3f' && c[1] === name).at(-1).slice(2);
  const P0 = new Float32Array(16); P0[0] = P0[5] = P0[10] = P0[15] = 1;
  lp.draw(P0, P0, [0, 0, 0], 1);
  assert.deepEqual(u3('uGold'), egEdgeLineColor());
  assert.deepEqual(u3('uWhite'), [...EG_DANGER_PALETTES.standard.hazard]);
  lp.palette(EG_DANGER_PALETTES.contrast);
  lp.draw(P0, P0, [0, 0, 0], 1);
  assert.deepEqual(u3('uGold'), egEdgeLineColor(EG_DANGER_PALETTES.contrast));
  assert.deepEqual(u3('uWhite'), [...EG_DANGER_PALETTES.contrast.hazard]);
  lp.palette(null);
  lp.draw(P0, P0, [0, 0, 0], 1);
  assert.deepEqual(u3('uGold'), egEdgeLineColor(), 'back to the Standard');
  // the ghost pass
  const G = recordingGl(), gp = new SdStepsPass(G.gl, [{ kind: 'beat' }], { max: 4 });
  const state = new Float32Array(16); state[0] = 1;
  gp.draw(P0, P0, new Float32Array(16), state, null, 10, 0, 0, EG_DANGER_PALETTES.tritan.safety);
  assert.deepEqual(G.calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uColor').at(-1).slice(2), [...EG_DANGER_PALETTES.tritan.safety]);
  gp.draw(P0, P0, new Float32Array(16), state);
  assert.deepEqual(G.calls.filter((c) => c[0] === 'uniform3f' && c[1] === 'uColor').at(-1).slice(2), [...SD_GHOST.color], 'the Hour\'s own: its gold');
  // the hands that carry it
  assert.match(rd('src/scenes/eliteGates/egSpan.js'), /vp\?\.\[2\] \?\? 0, vp\?\.\[3\] \?\? 0, egGhostRgb\(access\?\.palette\)\);/);
  // PIN MOVED (AUDIT EG V, e: L6-3 - the look's drawOver takes the world image's rect after the palette; h: and THE TRAIL after it)
  assert.match(rd('src/scenes/eliteGates/egLookDraw.js'), /drawOver\(proj, view, eye, ts, fog = null, pal = null, vp = null, trail = null, tn = 0\) \{\n      if \(!key \|\| !lines\) return false;\n      lines\.palette\(pal\);/);
  assert.match(rd('src/scenes/eliteGates/egClient.js'), /L\?\.drawOver\(proj, view, eye, ts, fog, egAccessNow\(win\)\.palette, renderer\?\._worldViewportPx, trail\.n \? trail\.segs : null, trail\.n\)/);
});

// ── lane4 #6, #7: THE LOOK, THE SWAP'S WORKER ───────────────────────────────────────────────────────────────────────
test('AUDIT EG III lane4 #6 THE LOOK DRAWS THE LEVEL THAT STANDS: while the company\'s word has run ahead into the next circle (the veil closing, a swap\'s wait) the look keeps the circle the mode machine stands and the seed it was built from; the new circle stood, it follows (mutants: the company\'s circle read)', () => {
  const { gl } = recordingGl();
  const P = inBreach({ h: 7, circle: 1, renderer: { gl } });
  const I = new Float32Array(16); I[0] = I[5] = I[10] = I[15] = 1;
  P.client.drawSky(I, I, [0, 0, 0], 0, null);
  assert.equal(P.client.lookState().key, '77:1:0', 'circle 1 stands - hall 7 is the company\'s word');
  P.st.circle = 2;
  P.client.drawSky(I, I, [0, 0, 0], 0, null);
  assert.equal(P.client.lookState().key, '77:2:0');
});

test('AUDIT EG III lane4 #7 THE SWAP\'S WORKER LET GO EVERY WAY OUT (EVERY ALLOCATION HAS AN OWNER): the first frame out of the Spire that is no swap\'s or answer\'s step drops the swap\'s build and its worker, as the band dress goes - not the walk out alone (mutants: the drop left to walkOut)', () => {
  const P = inBreach();
  P.client.frame();
  assert.equal(P.L.drops, 0, 'in the Spire: kept');
  P.st.inside = false;   // a way out that is no walk out (a teleport, a load)
  P.client.frame();
  assert.ok(P.L.drops >= 1, 'out: let go');
});

// ── lane4 #8, #9: THE REFUSAL'S TYPE, THE RECEIPT HEARD MID-FLUSH ─────────────────────────────────────────────────
test('AUDIT EG III lane4 #8 THE REFUSAL ANSWERS ONE TYPE (THE MODAL CONTRACT): the open retried on "the breach is closed" says nothing while it retries; the drain\'s word, a spent order and a word it does not word itself are said by the link; every exit of the refusal answers a boolean (mutants: the retry said; a bare return)', async () => {
  const hubSent = [];
  const hub = { egOk: true, sendEg: (k, f) => { hubSent.push({ k, ...f }); return true; } };
  const P = inBreach({ hub, wire: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, account: { open: async () => ({ ok: true, data: { keys: 1, order: 'o'.repeat(20), b: 'fedcba9876543210' } }) } });
  P.st.inside = false; P.client.frame();
  P.client.useKey();
  await settle();
  assert.equal(hubSent.filter((w) => w.k === 'open').length, 1, 'the open sent');
  const said0 = P.L.said.length;
  P.client.word({ k: 'no', m: 'the breach is closed' });
  assert.equal(P.L.said.length, said0, 'retrying: nothing said');
  P.client.word({ k: 'no', m: 'the road is shut' });
  assert.equal(P.L.said.at(-1), 'The road is shut.', 'the drain said');
  P.client.word({ k: 'no', m: 'the order is spent' });
  assert.equal(P.L.said.at(-1), 'The order is spent.');
  const body = between(rd('src/scenes/eliteGates/egClient.js'), '  function refused(w) {', '\n  }\n');
  assert.ok(!/return;/.test(body), 'no exit answers undefined');
  assert.equal((body.match(/return (true|false);/g) ?? []).length, 5, 'five exits, each a boolean');
});

test('AUDIT EG III lane4 #9 A RECEIPT HEARD WHILE A FLUSH IS IN FLIGHT IS CARRIED AS IT ENDS (ASYNC NEVER DROPS), never left for EG_CLAIM_RETRY_MS (mutants: the second flush dropped)', async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const nowS = Math.floor((T0 + EG_SEALED_MS + 60_000) / 1000);   // the client's clock (inBreach's)
  const r1 = await mintEgReceipt({ q: 'w', b: BID, s: ME, z: 'z'.repeat(16), c: 5, w: 1, h: 5, t: 100, n: 2, ew: 0, l: 30 }, kp.privateKey, { subtle, nowS });
  const r2 = await mintEgReceipt({ q: 'w', b: BID, s: ME, z: 'z'.repeat(16), c: 6, w: 2, h: 10, t: 200, n: 2, ew: 0, l: 30 }, kp.privateKey, { subtle, nowS });
  const asked = [], held = [];
  const P = inBreach({ account: { claim: (r) => { asked.push(r); return new Promise((res) => held.push(() => res({ ok: true, data: { recorded: true, q: 'w', w: 1 } }))); } } });
  P.client.word({ k: 'rcpt', r: r1 });
  await settle();
  assert.deepEqual(asked, [r1], 'the first in flight');
  P.client.word({ k: 'rcpt', r: r2 });   // heard mid-flush
  await settle();
  assert.deepEqual(asked, [r1], 'one flight at a time');
  held.shift()();
  for (let k = 0; k < 6; k++) await settle();
  assert.deepEqual(asked, [r1, r2], 'the second carried as the first ends - no retry wait');
  assert.ok(EG_CLAIM_RETRY_MS >= 60_000);
  held.shift()();
  for (let k = 0; k < 6; k++) await settle();
  assert.equal(asked.length, 2, 'nothing asked twice');
});

// ── lane4 #10: THE FRAME'S LISTS ────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III lane4 #10 THE FRAME\'S LISTS ARE KEPT, NEVER MADE A FRAME: the dither pass tries and makes nothing in first person or with nothing dithering, and fills its own scratch when it does; the client\'s batches are one list refilled, its errand objects and its holder made again only when the room\'s word moves; the world host\'s Spire lights one list refilled (mutants: a set made a frame; the scratch unfilled; a list a frame; the memo never kept; the holder made a frame)', () => {
  // the dither pass
  const occ = createEgOccluders({ renderer: null });
  const RealSet = globalThis.Set;
  let made = 0;
  globalThis.Set = class extends RealSet { constructor(...a) { super(...a); made++; } };
  try {
    for (let k = 0; k < 5; k++) { occ.frame({ dt: 1 / 60 }); occ.draw(); }
  } finally { globalThis.Set = RealSet; }
  assert.equal(made, 0, 'first person: no set made');
  // a piece the ray crosses, dithering frame after frame: its scratch, never a set a frame
  const lit = createEgOccluders({ renderer: null });
  lit.set({}, { subMeshes: [{ textureArchive: 0, textureRecord: 0, startIndex: 0, primitiveCount: 1 }], positions: new Float32Array([-1, 0, 2, 1, 0, 2, 0, 2, 2]), indices: new Uint16Array([0, 1, 2]), occluders: [{ b: [-1, 0, 1.9, 1, 2, 2.1], r: [[0, 0, 1]] }] });
  made = 0;
  globalThis.Set = class extends RealSet { constructor(...a) { super(...a); made++; } };
  let dithering = 0;
  try { for (let k = 0; k < 5; k++) dithering = lit.frame({ eye: [0, 0.5, 0], points: [[0, 0.5, 5]], dt: 1 / 60 }); } finally { globalThis.Set = RealSet; }
  assert.equal(dithering, 1, 'the piece the ray crosses dithers');
  assert.equal(made, 0, 'and no set was made for it');
  const out = [9, 9];
  assert.equal(egOccludersHit([], new Float32Array(0), [0, 0, 0], [[0, 0, 5]], out), out, 'its scratch filled');
  assert.deepEqual(out, []);
  // the client's lists and memos
  _resetSpireVestigesForTests();
  const P = inBreach({ h: 5 });
  P.client.frame();
  const b1 = P.client.batches(), b2 = P.client.batches();
  assert.equal(b1, b2, 'one list');
  const o1 = P.client.objs();
  assert.equal(P.client.objs(), o1, 'the objects kept while the word stands');
  const held = spireHeld();
  assert.ok(held, 'held');
  P.client.frame(); P.client.frame();
  assert.equal(spireHeld(), held, 'the holder made once while the word stands');
  P.tell(egStateOf(P.B, P.now()));
  assert.notEqual(P.client.objs(), o1, 'a new word: made again');
  P.client.frame();
  assert.notEqual(spireHeld(), held);
  _resetSpireVestigesForTests();
  // the world host's lights
  const W = rd('src/scenes/world.js');
  assert.ok(W.includes("    egLights: () => { _egLightList.length = 0; for (const L of egClient?.lights() ?? NO_EG_LIGHTS) _egLightList.push(L); for (const L of sdSpoilsPool?.lights() ?? NO_EG_LIGHTS) _egLightList.push(L); return _egLightList; },"));
  // the fight's leave, asked every frame out of the Spire, makes nothing once it holds nothing (lane4 #2's other half)
  const f = createEgFight({ link: { state: () => EG_STATE_EMPTY, now: () => 0 }, now: () => 0 });
  f.leave();
  const s1 = f.shield();
  f.leave();
  assert.deepEqual(f.shield(), s1);
});

// ── lane4 #11: THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG III lane4 #11 SECTION 29 SAYS HOW THE OVERLAYS ARE BUILT: the Vestige offer, the company\'s word and the recap are one panel on both skins and say so; there is no rest window; the confirm is a second press; the start window ends by its own choice - the two old sentences gone (RETIRING A FLAG DELETES THE SENTENCE)', () => {
  const page = rd('bible/11-Multiplayer/Elite-Gates.md');
  const s29 = between(page, '## 29. How the arc keeps the Process rules', '## 30. What it does not do, said so');
  assert.ok(!s29.includes('The rest window,\n  the Vestige offer, the company\'s word, the confirm, the board window and the recap are each built from DFU windows'), 'the old native-window sentence gone');
  assert.ok(!s29.includes('the start window, the rest window, the Vestige offer, the\n  company\'s word and the confirm are overlays. Each is closed by the room\'s `st` or `end`'), 'the old overlay sentence gone');
  assert.match(s29, /one\s+DOM panel \(`ui\/eliteGates\/egHud\.js` `drawEgPanel`\) on both skins/);
  assert.match(s29, /There is no rest window/);
  assert.match(s29, /a question put out of its slot unanswered ending it as a cancel/);
});

// ── lane4 #12: THE START WINDOW'S QUESTION ──────────────────────────────────────────────────────────────────────────
test('AUDIT EG III lane4 #12 THE START WINDOW NEVER ENDS WITHOUT A WORD: its question is DFU\'s YesNo box through egStartAsk, and a box put out of its slot unanswered (the overlay\'s replacement disposes it and tells it nothing) ends the window as a cancel - its onCancel told once; an answered box answers once; and the key turned while a window still asks says so (mutants: the disposal silent; a cancel twice; an answered box cancelled; the key silent)', async () => {
  let shown = null;
  const ask = egStartAsk((w) => { shown = w; }, (o) => new YesNoBoxWindow(o));
  const lists = [], log = [];
  const open = (onChoose) => openEgStartWindow({ keys: 2, me: ME, members: [{ sub: ME, name: 'Mac' }, { sub: 'acct-1', name: 'Ann' }], starts: { [ME]: [0], 'acct-1': null },
    openList: (labels, onPick, onCancel) => { const h = { labels, onPick, onCancel }; lists.push(h); return h; }, closeList: () => {}, ask, onChoose, onCancel: () => log.push(['cancel']) });
  const pickHall1 = () => { const L = lists.at(-1); L.onPick(L.labels.findIndex((l) => l.startsWith('Hall 1'))); };
  // the door itself: a disposal unanswered answers its fourth arm once
  let gone = 0, box = null;
  egStartAsk((b) => { box = b; }, (o) => new YesNoBoxWindow(o))(['?'], () => {}, () => {}, () => { gone++; });
  box.dispose(); box.dispose();
  assert.equal(gone, 1, 'once, however many disposals');
  // put out of its slot unanswered
  const w = open((c) => log.push(['choose', c.ew]));
  pickHall1();
  assert.ok(shown instanceof YesNoBoxWindow, 'asked in DFU\'s box: Go without Ann?');
  shown.dispose();
  assert.deepEqual(log, [['cancel']], 'the window ends as a cancel');
  shown.dispose();
  assert.equal(log.length, 1, 'once');
  assert.equal(w.state().done, true);
  // answered: once, never a cancel
  log.length = 0;
  open((c) => log.push(['choose', c.ew]));
  pickHall1();
  shown.answer(true);
  shown.dispose();
  assert.deepEqual(log, [['choose', 0]], 'answered once, never cancelled');
  // answered no: back to the list, never a cancel
  log.length = 0;
  const before = lists.length;
  open((c) => log.push(['choose', c.ew]));
  pickHall1();
  shown.answer(false);
  shown.dispose();
  assert.deepEqual(log, [], 'no: nothing ended');
  assert.equal(lists.length, before + 2, 'the list back');
  // the key turned while a window asks
  let asks = 0;
  const P = inBreach({ hub: { egOk: true, sendEg: () => true }, startWindow: () => { asks++; return { close() {} }; }, account: { starts: async () => ({ ok: true, data: { keys: 1, starts: { [ME]: [0] } } }) } });
  P.st.inside = false; P.client.frame();
  assert.equal(P.client.useKey(), '', 'the first turn asks');
  await settle();
  assert.equal(asks, 1);
  assert.equal(P.client.useKey(), EG_START_ASKING_TEXT, 'again while it asks: said');
  assert.equal(asks, 1);
});

// ── lane4 #13: THE VEIL'S LOOK ──────────────────────────────────────────────────────────────────────────────────────
function fakePage() {
  const gl = new Proxy({ ARRAY_BUFFER: 1, STATIC_DRAW: 2, FLOAT: 3, TRIANGLES: 4, COLOR_BUFFER_BIT: 5, VERTEX_SHADER: 6, FRAGMENT_SHADER: 7 }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { if (k === 'getShaderParameter' || k === 'getProgramParameter') return true; if (k === 'getUniformLocation') return a[1]; return {}; }; },
  });
  const doc = { body: { appendChild: () => {} }, createElement: (tag) => ({ tag, style: {}, width: 0, height: 0, setAttribute() {}, remove() {}, getContext: () => gl, appendChild() {} }) };
  let frames = [], t = 1000;
  const played = [];
  const step = (ms = 16) => { t += ms; const f = frames; frames = []; for (const g of f) g(); };
  return { doc, raf: (f) => { frames.push(f); }, now: () => t, engine: { soundIndexForId: (id) => 1000 + id, playOneShot: (i) => played.push(i) }, win: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, matchMedia: () => ({ matches: false }) }, step, played };
}
test('AUDIT EG III lane4 #13 A COVER ASKED WHILE THE VEIL STILL OPENS CLOSES IN ITS OWN LOOK: a pull\'s flash in one look, then a step\'s cover in another before the first has opened - the closing is the second\'s (its cues), where a cover asked while the veil is closing keeps the look it closes with (mutants: the opening\'s look kept)', () => {
  const p = fakePage();
  const veil = createGateVeil(p);
  veil.flash('brass');
  for (let i = 0; i < 40 && veil.phase !== 'opening'; i++) { veil.frameDrawn(); p.step(16); }
  assert.equal(veil.phase, 'opening');
  p.played.length = 0;
  veil.cover('fire');
  const fireClose = VEIL_CUES.close.map((c) => (c.id != null ? 1000 + c.id : c.clip));
  assert.deepEqual(p.played, fireClose, 'the cover\'s own look: the fire\'s close');
  assert.notDeepEqual(fireClose, VEIL_BRASS_CUES.close.map((c) => c.clip));
  assert.equal(veil.phase, 'closing');
  p.played.length = 0;
  veil.cover('brass');   // asked again while closing: the look it closes with
  assert.deepEqual(p.played, []);
});
