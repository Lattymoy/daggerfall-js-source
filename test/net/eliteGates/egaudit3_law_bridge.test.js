// AUDIT EG III (2026-10-13; bible/11-Multiplayer/Elite-Gates.md sections 15, 21, 23 and 25) - THE LAW GROUP, lane 1 #7 /
// lane 3 #10: SPIREBRIDGE BUILT. The Fellowship's Mastery ("once a span, a gold bridge over the next gap for the company, for
// 6 s") was offered at every Valkynaz Redoubt and applied nowhere, and section 23's `{k:'mast'}` was on no wire. Now: the ask
// (`mast`, net/wire.js), the room's rule (net/eliteGates/egVestige.js egSpirebridge - once a hall's span, the holder's ask, the next gap
// ahead of the asking member, 6 s, said to the company as `ebridge`), the plank's law (net/eliteGates/egSpanLaw.js egBridgeOf - one for
// the relay and every screen), the fair trail counting it as ground while it stands (net/eliteGates/egFair.js), the screen's plank
// drawn gold under THE EDGE LINE with its collider (scenes/eliteGates/egSpan.js), and the ask offered and taken (scenes/eliteGates/egClient.js - B,
// the pad's up, the touch button, `/breach bridge`). The solver never sees it: a bridge is a help, never needed.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egSpanPairs, egBridgeOf, egBridgeAhead, egBridgeY, egOnBridge, egSpanProof, EG_SB_MS, EG_SB_AHEAD_M, EG_SB_BEHIND_M, EG_SB_LAP_M, EG_SB_W_MIN, EG_SB_W_MAX, EG_SB_RISE_CM, EG_STEP_DOWN_CM } from '../../../src/net/eliteGates/egSpanLaw.js';
import { egSupportAt, egFairNew, egFairPose, EG_HOLD, EG_SUPPORT_UP_M, EG_SUPPORT_DOWN_M } from '../../../src/net/eliteGates/egFair.js';
import { EG_MASTERIES, EG_SPIREBRIDGE_ID, egOfferOf } from '../../../src/net/eliteGates/egVestige.js';
import { egBreachNew, egEnter, egStep, egWord, egPoseIn, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egPick } from '../../../src/net/eliteGates/egRun.js';   // PIN MOVED (AUDIT EG V, a1: L2-15 - a pick word is the rest's alone; the fixture takes the card by its producer)
import { validEgIn, validEgOut, EG_KINDS, EG_FIGHT_KINDS, EG_SB_WIRE_MS } from '../../../src/net/wire.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { createEgSpan, egSpanCollider, egBridgeModel, egBridgeTris, egBridgeLook, EG_STEP_GONE_Y, EG_SB_GROW_S, EG_SB_LAST_S, EG_SB_FALTER_HZ } from '../../../src/scenes/eliteGates/egSpan.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { egSpireHudModel, egTouchButtons, egPadUp, egPadAct, egPadPrompts, egBridgeLine } from '../../../src/ui/eliteGates/egSpireHud.js';
import { EG_PRES_TEXT } from '../../../src/ui/eliteGates/egBeats.js';
import { registerSpireObjs } from '../../../src/systems/eliteGates/spireKit.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { SD_REALM_EDGE_RECORD } from '../../../src/world/superDungeon/sdRealm.js';
import { Collider } from '../../../src/player/collider.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(1, [2]);
});

const T0 = 1_800_000_000_000;
/** Seed 1's Hall 7: a forked Span of the Galleries, its first gap off the arrival plate a plain one. */
const SEED = 1, HALL = 7;
/** A breach of `n` members on hall `h`'s arrival plate, stepped to its wake (test/net/eliteGates/egz_frag.test.js's rig), member 0 holding
 *  Spirebridge through the pick word - the producer of a member's Mastery (net/eliteGates/egRun.js egPick). */
function at(seed = SEED, h = HALL, n = 2) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 }, wg: [] });
  const clock = { now: T0 + EG_SEALED_MS + 100 };
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, clock.now), null);
  B.h = h; B.sg = 'arrive'; B.wk = clock.now; B.cnt = { left: 1_800_000, at: clock.now }; B.pulledAt = clock.now; B.su = clock.now + 30_000;
  const spec = egHallOf(seed, h, 0), pos = {};
  for (const [sub] of co) pos[sub] = { sx: spec.x0 + spec.arrive.x, z: spec.arrive.z };
  const step = (ms = 250) => { clock.now += ms; return egStep(B, clock.now, Object.entries(B.mem).filter(([, m]) => m.alive).map(([sub]) => ({ sub, sx: pos[sub].sx, z: pos[sub].z, dead: false, at: clock.now })), rng); };
  const say = (sub, m) => egWord(B, sub, m, pos[sub], clock.now, rng);
  const put = (sub, x, z) => { pos[sub] = { sx: spec.x0 + x, z }; };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the hall woke');
  B.mem['acct-0'].offer = [EG_SPIREBRIDGE_ID]; B.mem['acct-0'].picks = 1;
  egPick(B, 'acct-0', EG_SPIREBRIDGE_ID);
  assert.equal(B.mem['acct-0'].mast, EG_SPIREBRIDGE_ID, 'Spirebridge taken by the pick');
  return { B, spec, clock, pos, step, say, put, rng };
}

test('AUDIT EG III SPIREBRIDGE - THE PLANK\'S LAW (section 15; net/eliteGates/egSpanLaw.js): a plank over a gap of a hall\'s chain lies at its far piece\'s rest line, lapped EG_SB_LAP_M onto each side, its width inside 1.6-3 m, rising from the near side\'s height to the far side\'s - never over a Drop\'s fall or a riser\'s face (past THE ENVELOPE\'s step down); THE NEXT GAP AHEAD of a member is the first such gap of its road no more than 1.5 m behind it and 6 m ahead, the member on its line - a Drop skipped for the next (mutants: the laps dropped; a Drop\'s fall spanned; the gap behind taken; the reach unbounded; the road\'s line unread)', () => {
  assert.deepEqual([EG_SB_MS, EG_SB_AHEAD_M, EG_SB_BEHIND_M, EG_SB_LAP_M, EG_SB_W_MIN, EG_SB_W_MAX, EG_SB_RISE_CM], [6000, 6, 1.5, 0.3, 1.6, 3, EG_STEP_DOWN_CM]);
  const spec = egHallOf(SEED, HALL, 0), P = egSpanPairs(spec);
  // the first gap: off the arrival plate onto the first piece
  const b0 = egBridgeOf(spec, 0), s0 = P[0].b;
  assert.equal(P[0].a, null, 'from still ground');
  assert.deepEqual([b0.g, b0.road, b0.x, b0.y0, b0.y1], [0, 0, s0.x, 0, s0.y]);
  assert.ok(Math.abs(b0.z0 - (P[0].edge - EG_SB_LAP_M)) < 1e-9 && Math.abs(b0.z1 - (s0.z - s0.d / 2 + EG_SB_LAP_M)) < 1e-9, 'from the plate\'s edge to the piece\'s, lapped onto each');
  assert.equal(b0.w, Math.max(EG_SB_W_MIN, Math.min(EG_SB_W_MAX, s0.w)));
  // a piece to a piece: its near side the piece's own height
  const g1 = P.findIndex((p) => p.a && p.b && (p.a.road ?? 0) === 0);
  const b1 = egBridgeOf(spec, g1);
  assert.deepEqual([b1.y0, b1.y1], [P[g1].a.y, P[g1].b.y]);
  assert.ok(Math.abs(b1.z0 - (P[g1].a.z + P[g1].a.d / 2 - EG_SB_LAP_M)) < 1e-9);
  // a Drop's fall spanned by none (THE FORK's Drop off the High Road), and the next gap ahead of it is the one past it
  const gd = P.findIndex((p) => p.b?.kind === 'drop' && (p.b.road ?? 0) === 0);
  assert.ok(gd > 0, 'the High Road\'s Drop');
  assert.equal(egBridgeOf(spec, gd), null, 'its 4.5 m fall spanned by no plank');
  const dz = P[gd].a.z + P[gd].a.d / 2 - 0.2, next = egBridgeAhead(spec, 0, dz);
  assert.ok(next === -1 || next > gd, 'the next gap ahead is past the Drop, never the Drop');
  assert.equal(egBridgeOf(spec, 999), null);
  assert.equal(egBridgeOf(spec, -1), null);
  // THE NEXT GAP AHEAD
  assert.equal(egBridgeAhead(spec, 0, 0), 0, 'on the arrival plate: its first gap (5 m ahead)');
  assert.equal(egBridgeAhead(spec, 0, b0.z0 + EG_SB_LAP_M + 1.4), 0, 'just off its edge: still that gap');
  assert.notEqual(egBridgeAhead(spec, 0, b0.z0 + EG_SB_LAP_M + 1.6), 0, 'past it: never the gap behind');
  assert.equal(egBridgeAhead(spec, 0, b0.z0 + EG_SB_LAP_M - 6.2), -1, 'more than 6 m short of it: none');
  assert.equal(egBridgeAhead(spec, 4.5, 0), -1, 'off its line: none');
  assert.equal(egBridgeAhead(spec, 0, spec.end.z), -1, 'on the end plate: no gap ahead');
  // THE FORK: the Low Road's gaps to a member on its line, never the High Road's at the same z - its Drop off its island
  // spanned by none
  const gLow = P.findIndex((p, g) => (p.b ?? p.a).road === 1 && !!egBridgeOf(spec, g)), bl = egBridgeOf(spec, gLow);
  assert.ok(gLow > 0 && Math.abs(bl.x - 15) <= 1, 'a Low Road plank, on its line');
  const zl = bl.z0 + EG_SB_LAP_M - 0.5;
  assert.equal(egBridgeAhead(spec, bl.x, zl), gLow, 'on the Low Road\'s line: its own gap');
  const gHigh = egBridgeAhead(spec, 0, zl);
  assert.ok(gHigh !== gLow && (gHigh === -1 || (P[gHigh].b ?? P[gHigh].a).road === 0), 'at that z on the High Road\'s line: the High Road\'s, or none');
  const gd1 = P.findIndex((p) => p.b?.kind === 'drop' && p.b.road === 1);
  assert.equal(egBridgeOf(spec, gd1), null, 'the Low Road\'s Drop off its island: spanned by none');
  // on the plank: its top, its width and its laps, within the support's heights
  const mid = (b0.z0 + b0.z1) / 2;
  assert.equal(egBridgeY(b0, mid), b0.y0 + (b0.y1 - b0.y0) / 2);
  assert.ok(egOnBridge(b0, b0.x, 0, mid, EG_SUPPORT_UP_M, EG_SUPPORT_DOWN_M));
  assert.ok(!egOnBridge(b0, b0.x + b0.w / 2 + 0.5, 0, mid, EG_SUPPORT_UP_M, EG_SUPPORT_DOWN_M), 'beside it');
  assert.ok(!egOnBridge(b0, b0.x, -2, mid, EG_SUPPORT_UP_M, EG_SUPPORT_DOWN_M), 'under it');
  // never asked of the solver: the hall's proof is the same with or without any plank
  assert.ok(egSpanProof(spec).ok);
});

test('AUDIT EG III SPIREBRIDGE - THE ROOM\'S RULE (section 15: "once a span, a gold bridge over the next gap for the company, for 6 s"): the holder\'s ask (`mast`) in a trial stands a plank over the next gap ahead of its own pose for EG_SB_MS - said to the company (`ebridge`, its hall, its gap, its stand and end, who raised it) and kept for the fair trail - once a hall\'s span; refused, nothing spent, to a member who holds none, to a holder with no gap ahead, outside a trial or its closing, to the fallen; the Low Road\'s holder its own road\'s gap; the next span its own again (mutants: no holder\'s check; once a span unread; the gap behind the asker; 6 s lengthened; the word said to nobody)', () => {
  const w = at();
  // a member who holds none: nothing
  assert.deepEqual(w.say('acct-1', { k: 'mast' }), []);
  assert.equal(w.B.sb, undefined);
  // the holder on the arrival plate: the plank over its first gap, for 6 s, said to the company
  const out = w.say('acct-0', { k: 'mast' });
  assert.equal(out.length, 1);
  const f = out[0];
  assert.equal(f.to, undefined, 'said to the company, every member');
  assert.deepEqual(f, { k: 'ebridge', h: HALL, g: 0, at: w.clock.now, until: w.clock.now + 6000, s: 'acct-0', n: 'M0' });
  assert.deepEqual(validEgOut(JSON.parse(JSON.stringify(f))), { ...f });
  assert.deepEqual(w.B.sb, [{ h: HALL, g: 0, from: w.clock.now, until: w.clock.now + 6000 }], 'kept for the fair trail');
  assert.equal(w.B.mem['acct-0'].sbH, HALL);
  // once a span
  w.clock.now += 7000;
  assert.deepEqual(w.say('acct-0', { k: 'mast' }), [], 'spent this span');
  // a second holder with no gap ahead (on the end plate): refused, nothing spent
  const m1 = w.B.mem['acct-1'];
  m1.offer = [EG_SPIREBRIDGE_ID]; m1.picks = 1;
  egPick(w.B, 'acct-1', EG_SPIREBRIDGE_ID);
  w.put('acct-1', w.spec.end.x, w.spec.end.z);
  assert.deepEqual(w.say('acct-1', { k: 'mast' }), [], 'no gap ahead');
  assert.equal(m1.sbH, undefined, 'nothing spent');
  // the Low Road: its own gap, its plank kept beside the first (the expired one let go)
  const low = w.spec.islands.find((q) => q.road === 1);
  w.put('acct-1', low.x, low.z + 18);
  const g1 = egBridgeAhead(w.spec, low.x, low.z + 18);
  const lo = w.say('acct-1', { k: 'mast' });
  if (g1 >= 0) {
    assert.equal(lo[0]?.g, g1, 'the Low Road\'s next gap');
    assert.equal((egSpanPairs(w.spec)[g1].b ?? egSpanPairs(w.spec)[g1].a).road, 1);
    assert.deepEqual(w.B.sb.map((q) => q.g), [g1], 'the spent plank let go');
  } else assert.deepEqual(lo, []);
  // outside a trial or its closing, and the fallen: refused
  const v = at();
  v.B.sg = 'rest';
  assert.deepEqual(v.say('acct-0', { k: 'mast' }), [], 'at a rest');
  v.B.sg = 'closing';
  assert.equal(v.say('acct-0', { k: 'mast' }).length, 1, 'in the closing (the door open, the way still crossed)');
  const d = at();
  d.B.mem['acct-0'].alive = 0;
  assert.deepEqual(d.say('acct-0', { k: 'mast' }), [], 'the fallen ask nothing');
  // the next span: its own again
  const n = at(SEED, HALL);
  assert.equal(n.say('acct-0', { k: 'mast' }).length, 1);
  n.B.mem['acct-0'].sbH = HALL - 1;
  assert.equal(n.say('acct-0', { k: 'mast' }).length, 1, 'a span spent before is no bar here');
  // the Mastery is offered (it is built): the Valkynaz Redoubt's fourth card draws it
  let seen = 0;
  for (let k = 0; k < 400; k++) { let s2 = k + 1; const r = () => { s2 = (Math.imul(s2, 1103515245) + 12345) >>> 0; return s2 / 4294967296; }; if (egOfferOf(r, { vs: [], w: 5, valk: true }).includes(EG_SPIREBRIDGE_ID)) seen++; }
  assert.ok(seen > 40, `Spirebridge offered (${seen} of 400 offers)`);
  assert.equal(EG_MASTERIES.find((M) => M.id === EG_SPIREBRIDGE_ID).key, 'spirebridge');
});

test('AUDIT EG III SPIREBRIDGE - GROUND ON THE FAIR TRAIL WHILE IT STANDS (sections 15 and 21: "known to the fair trail"): a body on the plank\'s top is held as on a piece from its raising to its end, never before, never after, never in another hall, never beside it or under it; a member who walks it slowly over its gap keeps a fair trail where the same walk with no plank breaks the air\'s law - through the room\'s own pose door (mutants: the plank never ground; its end unread; the room\'s planks not handed to the trail)', () => {
  const spec = egHallOf(SEED, HALL, 0), b0 = egBridgeOf(spec, 0), mid = (b0.z0 + b0.z1) / 2, y = egBridgeY(b0, mid);
  const q = [{ h: HALL, g: 0, from: 10_000, until: 16_000 }];
  assert.equal(egSupportAt(spec, b0.x, y, mid, 12), EG_HOLD.none, 'over the gap: nothing holds');
  assert.equal(egSupportAt(spec, b0.x, y, mid, 12, false, 0, q), EG_HOLD.piece, 'the plank holds, as a piece');
  assert.equal(egSupportAt(spec, b0.x, y, mid, 9.99, false, 0, q), EG_HOLD.none, 'before its raising');
  assert.equal(egSupportAt(spec, b0.x, y, mid, 16, false, 0, q), EG_HOLD.none, 'at its end');
  assert.equal(egSupportAt(spec, b0.x, y, mid, 12, false, 0, [{ ...q[0], h: HALL + 1 }]), EG_HOLD.none, 'another hall\'s');
  assert.equal(egSupportAt(spec, b0.x + b0.w / 2 + 0.6, y, mid, 12, false, 0, q), EG_HOLD.none, 'beside it');
  assert.equal(egSupportAt(spec, b0.x, y - 2, mid, 12, false, 0, q), EG_HOLD.none, 'under it');
  // a slow walk over the gap on its line: three and a half seconds in the air with no plank, held all the way on one
  const walk = (bridges) => {
    const A = egFairNew(HALL);
    for (let t = 0; t <= 9000; t += 200) { const z = Math.min(b0.z1 + 0.5, 2 + (0.75 * t) / 1000); egFairPose(A, spec, { x: b0.x, y: egBridgeY(b0, z), z }, 10_000 + t, bridges); }
    return A;
  };
  const none = walk(null), held = walk([{ h: HALL, g: 0, from: 9000, until: 17_000 }]);
  assert.ok(none.brks > 0 && none.why === 'air', `no plank: the air's law broken (${none.why})`);
  assert.equal(held.brks, 0, 'on the plank: a fair trail');
  // through the room: its plank handed to the member's trail by its own pose door
  const w = at();
  w.say('acct-0', { k: 'mast' });
  const m = w.B.mem['acct-0'];
  m.hereH = HALL;
  const t0 = w.clock.now;
  egPoseIn(w.B, 'acct-0', { sx: w.spec.x0, y: 0, z: 4 }, t0);   // on the arrival plate, near its edge: over the gap inside the plank's 6 s
  for (let t = 200; t <= 7000; t += 200) { const z = Math.min(b0.z1 + 0.5, 4 + (0.75 * t) / 1000); egPoseIn(w.B, 'acct-0', { sx: w.spec.x0 + b0.x, y: egBridgeY(b0, z), z }, t0 + t); }
  assert.equal(m.fair.brks, 0, 'the room\'s trail holds the walk on its plank');
  const u = at();
  u.B.mem['acct-0'].hereH = HALL;
  egPoseIn(u.B, 'acct-0', { sx: u.spec.x0, y: 0, z: 4 }, u.clock.now);
  for (let t = 200; t <= 7000; t += 200) { const z = Math.min(b0.z1 + 0.5, 4 + (0.75 * t) / 1000); egPoseIn(u.B, 'acct-0', { sx: u.spec.x0 + b0.x, y: egBridgeY(b0, z), z }, u.clock.now + t); }
  assert.ok(u.B.mem['acct-0'].fair.brks > 0, 'with none raised, the same walk breaks it');
});

test('AUDIT EG III SPIREBRIDGE - THE WIRE (section 23: `{k:\'mast\'}` member -> room; `ebridge` room -> all): the ask carries nothing (the room reads the asker\'s own pose); the word its hall, its gap, its stand and end (at most EG_SB_WIRE_MS, over the law\'s 6 s), who raised it - anything else refused; the client folds it into the hall\'s fight and keeps it through the fight said again (mutants: the ask unheard; a plank of a minute; the word lost at the next whole fight)', () => {
  assert.ok(EG_KINDS.includes('mast') && EG_FIGHT_KINDS.includes('ebridge'));
  assert.deepEqual(validEgIn({ k: 'mast', g: 9 }), { k: 'mast' }, 'nothing carried');
  assert.ok(EG_SB_WIRE_MS >= EG_SB_MS && EG_SB_WIRE_MS === 10_000);
  const f = { k: 'ebridge', h: 7, g: 3, at: T0, until: T0 + EG_SB_MS, s: 'acct-0', n: 'Mira' };
  assert.deepEqual(validEgOut(f), f);
  for (const bad of [{ until: T0 + EG_SB_WIRE_MS + 1 }, { until: T0 }, { g: -1 }, { g: 1000 }, { h: 0 }, { s: 'not an id!' }, { at: 0 }]) assert.equal(validEgOut({ ...f, ...bad }), null, JSON.stringify(bad));
  // the client's fold: kept in the hall's fight, through the whole fight said again, gone with the hall
  let s = foldEg({ ...EG_STATE_EMPTY, b: '0123456789abcdef', h: 7 }, validEgOut(f), T0);
  assert.deepEqual(s.fight.bridges, [{ h: 7, g: 3, at: T0, until: T0 + EG_SB_MS, s: 'acct-0', n: 'Mira' }]);
  s = foldEg(s, validEgOut({ k: 'efs', h: 7, wk: T0, b: [], bl: [], tx: [], mk: [], pg: {}, zs: [] }), T0 + 2000);
  assert.equal(s.fight.bridges.length, 1, 'kept through the fight said again');
  s = foldEg(s, validEgOut({ k: 'efs', h: 8, wk: T0, b: [], bl: [], tx: [], mk: [], pg: {}, zs: [] }), T0 + 4000);
  assert.deepEqual(s.fight.bridges, [], 'another hall\'s fight: none');
});

test('AUDIT EG III SPIREBRIDGE - THE PLANK ON THIS SCREEN (sections 15, 25.2, 25.3 and 25.7): the room\'s word stands a plank of the relay\'s own law in the collider and the draws - gold, THE EDGE LINE round its top - holding from its raising to its end, laid across over EG_SB_GROW_S and faltering its last second at EG_SB_FALTER_HZ (both still under reduced motion); a body falls onto its top over the gap; at its end its bucket, its draw and its mesh go, and the circle\'s clear frees any left (mutants: the plank never collided; it holds past its end; the mesh kept; reduced motion unread)', () => {
  const spec = egHallOf(SEED, HALL, 0), b0 = egBridgeOf(spec, 0);
  // its look, pure
  const q = { from: 10_000, until: 16_000 };
  assert.deepEqual([EG_SB_GROW_S, EG_SB_LAST_S, EG_SB_FALTER_HZ], [0.25, 1, 2]);
  assert.deepEqual(egBridgeLook(q, 9_999), { stand: false, grow: 0, seen: false });
  assert.deepEqual(egBridgeLook(q, 10_100), { stand: true, grow: 0.4, seen: true });
  assert.deepEqual(egBridgeLook(q, 10_100, true), { stand: true, grow: 1, seen: true }, 'reduced motion: whole at once');
  assert.equal(egBridgeLook(q, 15_100).seen, false, 'its last second falters');
  assert.equal(egBridgeLook(q, 15_400).seen, true);
  assert.equal(egBridgeLook(q, 15_100, true).seen, true, 'steady under reduced motion');
  assert.deepEqual(egBridgeLook(q, 16_000), { stand: false, grow: 0, seen: false });
  // its model: a gold top, the edge line, brass sides; its collider a top and sides
  const M = egBridgeModel(3.5, 2.6, -0.4);
  assert.ok(M.subMeshes.some((sm) => sm.textureRecord === SD_REALM_EDGE_RECORD), 'gold, the edge line');
  assert.equal(egBridgeTris(3.5, 2.6, -0.4).positions.length, 5 * 2 * 3 * 3);
  // on the screen
  const made = [], gone = new Set(), removed = [];
  const R = { createMesh: (m) => { const g = { subMeshes: m.subMeshes }; made.push(g); return g; }, destroyMesh: (g) => { gone.add(g); } };
  const span = createEgSpan({ renderer: R, seed: SEED, c: spec.c }), draws = [], col = new Collider();
  const removeBucket = col.removeBucket.bind(col);
  col.removeBucket = (k) => { removed.push(k); removeBucket(k); };
  // PIN MOVED (AUDIT EG V, e: L6-10 - the plank stood over a bare Collider passed while the dungeon host's own wrapper, which
  // had addMesh alone, kept its bucket for the rest of the circle; it stands through the wrapper the host hands the spans)
  span.stand({ dynamicDraws: draws, collider: egSpanCollider(col, []) });
  const objs = { h: HALL, objs: [], br: [{ g: 0, from: 10_000, until: 16_000 }] };
  registerSpireObjs(() => objs);
  try {
    const n0 = draws.length, made0 = made.length;
    span.ride(9.9, 0.016, null, false);
    assert.equal(span.planks.length, 1, 'stood at its word');
    assert.equal(span.planks[0].holds, false, 'before its raising it holds nothing');
    assert.equal(draws.length, n0 + 1);
    assert.equal(made.length, made0 + 1);
    const plank = made.at(-1);
    assert.ok(plank.subMeshes.some((sm) => sm.textureRecord === SD_REALM_EDGE_RECORD), 'its own mesh, gold');
    span.ride(10.1, 0.016, null, false);
    const P = span.planks[0], at0 = realmToDungeon(spec.x0 + b0.x, b0.y0, b0.z0);
    assert.deepEqual(P.br, b0, 'the relay\'s own plank');
    assert.ok(P.holds && P.T.every((v, k) => Math.abs(v - at0[k]) < 1e-9), 'holding, at its near end');
    assert.ok(P.drawn && Math.abs(P.grow - 0.4) < 1e-6, 'laying itself across');
    // a body over the gap falls onto its top (the real collider)
    const mid = (b0.z0 + b0.z1) / 2, top = realmToDungeon(spec.x0 + b0.x, egBridgeY(b0, mid), mid);
    const d = col.raycast([top[0], top[1] + 2, top[2]], [0, -1, 0], 10);
    assert.ok(Math.abs(d - 2) < 0.02, `its top under the gap (${d})`);
    span.ride(15.1, 0.016, null, false);
    assert.equal(span.planks[0].drawn, false, 'its last second faltering');
    setPref('reducedMotion', true);
    span.ride(15.1, 0.016, null, false);
    assert.equal(span.planks[0].drawn, true, 'steady under reduced motion');
    span.ride(10.05, 0.016, null, false);
    assert.equal(span.planks[0].grow, 1, 'and whole at once');
    setPref('reducedMotion', false);
    span.ride(16.0, 0.016, null, false);
    assert.equal(span.planks.length, 0, 'gone at its end');
    assert.deepEqual(removed, ['eg:bridge:7:0:10000'], 'its bucket out of the collider');
    assert.ok(!Number.isFinite(col.raycast([top[0], top[1] + 2, top[2]], [0, -1, 0], 2.5)), 'nothing under the gap again');
    assert.equal(draws.length, n0, 'its draw out of the draws');
    assert.ok(gone.has(plank) && gone.size === 1, 'its mesh freed, and nothing else');
    // the circle's clear frees one still standing
    objs.br = [{ g: 0, from: 20_000, until: 26_000 }];
    span.ride(21, 0.016, null, false);
    assert.equal(span.planks.length, 1);
    const second = made.at(-1);
    span.clear();
    assert.ok(gone.has(second), 'freed with the circle');
    assert.equal(span.planks.length, 0);
  } finally { registerSpireObjs(null); setPref('reducedMotion', false); }
});

test('AUDIT EG III SPIREBRIDGE - THE ASK ON THIS SCREEN (sections 15, 27.1 and 27.8): while I hold it, alive in a trial, unspent this span, with a gap ahead of my feet by the room\'s own law, it is offered - the stage\'s line, the touch layer\'s button, the pad\'s up - and taken by B, the button, the pad and `/breach bridge` (`mast`); B is the shoulder\'s own key everywhere else; the room\'s word said on my screen and its plank handed to the spans; a plank of mine spends it (mutants: B taken with nothing to ask; the ask sent with no gap; the word unsaid; the plank not handed on)', () => {
  // the HUD's pure halves
  assert.deepEqual(egTouchButtons({ bridge: true }), [{ id: 'bridge', label: EG_PRES_TEXT.touch.bridge }]);
  assert.deepEqual(egTouchButtons({ bridge: true, witness: true }).map((b) => b.id), ['prev', 'next', 'ping', 'forsake'], 'a witness asks nothing');   // PIN MOVED (AUDIT EG V, c: L7-7 - a witness's ping and its cooldown on the touch layer, section 16.5)
  assert.equal(egPadUp({ bridge: true }), true);
  assert.deepEqual(egPadAct('up', 'tap', { bridge: true }), { k: 'bridge' });
  assert.equal(egPadAct('down', 'tap', { bridge: true }), null);
  assert.deepEqual(egPadAct('up', 'tap', { bridge: true, panel: true }), { k: 'take' }, 'the panel first');
  assert.equal(egPadPrompts({ bridge: true })[0][1], EG_PRES_TEXT.pad.bridge);
  const E = { b: 'x', h: 7, fight: { bridges: [{ h: 7, g: 0, at: 1000, until: 7000, s: 'acct-1', n: 'Ann' }] } };
  assert.equal(egBridgeLine(E, 2500, true), `${EG_PRES_TEXT.bridgeStands('Ann', 5)} ${EG_PRES_TEXT.bridgeReady}`);
  assert.equal(egBridgeLine(E, 8000, false), '', 'its end past: nothing');
  // the client
  const ME = 'acct-0';
  const make = (o = {}) => {
    const w = at();
    if (o.unheld) w.B.mem[ME].mast = -1;
    const clock = w.clock.now, sent = [], said = [];
    const player = { pos: realmToDungeon(w.spec.x0 + (o.x ?? 0), 0, o.z ?? 0), height: 1.8, grounded: true, collider: { move: () => {} } };
    const modes = { mode: 'dungeon', egHallBreach: () => w.B.b, egHallCircle: () => w.spec.c, egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
    const online = { welcomes: 1, terminal: false, sendEg: (k, f = {}) => { sent.push({ k, ...f }); return true; } };
    const entity = { level: 30, health: 80, maxHealth: 100, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
    const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => ME, guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0] },
      say: (t) => said.push(t), mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [] });
    client.word(validEgOut(JSON.parse(JSON.stringify(egStateOf(w.B, clock)))));
    return { client, sent, said, w, player };
  };
  const B1 = make();
  assert.equal(B1.client.padUp(), true, 'a gap ahead: the pad\'s up is the ask');
  assert.equal(B1.client.padPrompts()[0][1], EG_PRES_TEXT.pad.bridge);
  assert.equal(B1.client.key({ code: 'KeyB' }), true, 'B takes it');
  assert.deepEqual(B1.sent.at(-1), { k: 'mast' });
  const B2 = make();
  assert.equal(B2.client.touchAct('bridge'), true);
  assert.deepEqual(B2.sent.at(-1), { k: 'mast' }, 'the touch button');
  const B3 = make();
  assert.equal(B3.client.padGesture('up', 'tap'), true);
  assert.deepEqual(B3.sent.at(-1), { k: 'mast' }, 'the pad\'s up');
  const B4 = make();
  B4.client.command('bridge');
  assert.deepEqual(B4.sent.at(-1), { k: 'mast' }, '/breach bridge');
  // nothing to ask: B is the shoulder's, nothing sent, the reason said
  const far = make({ z: egHallOf(SEED, HALL, 0).end.z });
  assert.equal(far.client.key({ code: 'KeyB' }), false, 'no gap ahead: B is not the Spire\'s');
  assert.equal(far.client.padUp(), false);
  far.client.command('bridge');
  assert.equal(far.sent.length, 0);
  assert.equal(far.said.at(-1), EG_PRES_TEXT.bridgeNone);
  const none = make({ unheld: true });
  assert.equal(none.client.key({ code: 'KeyB' }), false, 'holding none: B is not the Spire\'s');
  none.client.command('bridge');
  assert.equal(none.said.at(-1), EG_PRES_TEXT.bridgeNot);
  // the room's word: said, handed to the spans, and mine spends it
  const W = make();
  const word = W.w.say(ME, { k: 'mast' })[0];
  W.client.word(validEgOut(JSON.parse(JSON.stringify(word))));
  assert.equal(W.said.at(-1), EG_PRES_TEXT.bridgeMine);
  assert.deepEqual(W.client.objs().br, [{ g: word.g, from: word.at, until: word.until }], 'its plank handed to the spans');
  assert.equal(W.client.key({ code: 'KeyB' }), false, 'spent this span');
  W.client.command('bridge');
  assert.equal(W.said.at(-1), EG_PRES_TEXT.bridgeSpent);
  const other = make();
  other.client.word(validEgOut({ ...word, s: 'acct-1', n: 'M1' }));
  assert.equal(other.said.at(-1), EG_PRES_TEXT.bridgeRaised('M1'), 'a companion\'s, said with its name');
  assert.equal(other.client.padUp(), true, 'a companion\'s plank spends none of mine');
});
