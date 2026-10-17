// EG-ZR (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 15 and 21, EG-ZP's "Not built"):
// SHIELD-HYMN, BOTH HALVES, AND IMMOVABLE'S PUSH HALF - Rally's heal at a door, with a Bastion holder within 10 m of another
// member holding Rally, gives the company that Bastion for 4 s: the relay's census mints the window at the door
// (net/eliteGates/egBrain.js egHymnStep, read by egCensusDr) and each screen opens its own as Rally's word lands (scenes/eliteGates/egFight.js
// `rally`, read by egShieldDr through the census's own law), so a blow in the window is spared the same on both; and
// Immovable's "pushes do nothing until you move" on the holder's screen (scenes/eliteGates/egFight.js `immovable` - the census's own
// stillness on my trail - beside Iron Footing in scenes/eliteGates/egClient.js's push and the spans' spireFooting). Every fixture is the
// producers' own: the breach and its door from the director, trails from egPoseIn, frames through the wire, the screen from
// createEgFight and createEgClient.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS, EG_ARRIVE_MAX_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egPoseIn, egStateOf, egCount, egFall, egHymnStep } from '../../../src/net/eliteGates/egBrain.js';
import { egAim, egFightState } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { EG_V_BY_KEY, EG_MASTERIES, EG_HYMN_MS } from '../../../src/net/eliteGates/egVestige.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { spireHolderStep, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const vId = (key) => EG_V_BY_KEY[key].id;
const IMMOVABLE = EG_MASTERIES.find((M) => M.key === 'immovable').id;
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

// ── THE DOOR MINTS THE HYMN ──────────────────────────────────────────────────────────────────────────────────────────
/** A breach of `n` at hall `h`'s arrival (EG-ZI's harness): `put` stands a member, `step` beats the director, `pose` feeds
 *  THE FAIR TRAIL. */
function breach(n, h, seed = 12345) {
  let s = seed;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) assert.equal(egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now), null);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + EG_ARRIVE_MAX_MS;
  const pos = {};
  for (const [sub] of co) { const sp = egHallOf(seed, B.h, 0); pos[sub] = { x: sp.arrive.x + Number(sub.slice(5)) * 0.5, z: sp.arrive.z }; }
  const frames = [];
  const step = (ms = 250) => {
    now += ms;
    const sp = egHallOf(seed, B.h, 0);
    const o = egStep(B, now, co.filter(([sub]) => B.mem[sub].alive).map(([sub]) => ({ sub, sx: sp.x0 + pos[sub].x, z: pos[sub].z, dead: false, at: now })), rng);
    for (const f of o) wire(f);
    frames.push(...o);
    return o;
  };
  return { B, co, frames, step, put: (sub, x, z) => { pos[sub] = { x, z }; }, pose: (sub, x, z, y, t) => egPoseIn(B, sub, { sx: egHallOf(seed, B.h, 0).x0 + x, y, z }, t), now: () => now, spec: () => egHallOf(seed, B.h, 0) };
}
/** The span's door opened by acct-0's fair crossing (EG-ZI's), the rest where `stand` puts them: the frames of the beat
 *  that opened it. */
function openDoor(S, stand = () => {}) {
  const { B } = S, sp = S.spec();
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) S.step();
  assert.equal(B.sg, 'trial');
  const hw = B.hw, [i1, i2, i3] = sp.islands, door = { x: sp.end.x, z: sp.end.z - 2, y: 0 };
  for (const [sub] of S.co) S.pose(sub, sp.arrive.x, sp.arrive.z, 0, hw + 100);
  for (const [k, q] of [i1, i2, i3, door].entries()) S.pose('acct-0', q.x, q.z, q.y ?? 0, hw + 550 + 450 * k);
  S.put('acct-0', door.x, door.z);
  stand(sp);
  let o = [];
  for (let k = 0; k < 40 && B.sg === 'trial'; k++) o = S.step();
  assert.equal(B.sg, 'closing', 'acct-0 opened the door');
  return o;
}

test('EG-ZR SHIELD-HYMN, THE CENSUS\'S HALF (net/eliteGates/egBrain.js egHymnStep, at the door): Rally\'s heal said at a span\'s door with a Bastion holder standing within 10 m of another member holding Rally mints the company\'s window - `B.hy` `[the door, the door + 4 s, the Bastion holders]` - on the poses the director holds of this hall; the Rally holder 10 m off, or no Rally held, mints none (mutants: the hymn never stepped; a pose of another hall read; the window\'s length; the pair\'s reach)', () => {
  const vs = (S, map) => { for (const [sub, v] of Object.entries(map)) S.B.mem[sub].vs = v; };
  const S = breach(4, 2);
  vs(S, { 'acct-1': [[vId('bastion'), 3]], 'acct-2': [[vId('rally'), 1]] });
  const o = openDoor(S);
  assert.deepEqual(o.filter((f) => f.k === 'eheal').map((f) => [f.p, f.why]), [[0.08, 'rally']], 'Rally\'s heal said');
  assert.deepEqual(S.B.hy, [S.B.dn, S.B.dn + EG_HYMN_MS, ['acct-1']], 'the company\'s window, Bastion III\'s holder in it');
  assert.equal(S.B.mem['acct-1'].pose.h, 2, 'a pose knows its hall');
  const far = breach(4, 2);
  vs(far, { 'acct-1': [[vId('bastion'), 3]], 'acct-2': [[vId('rally'), 1]] });
  openDoor(far, (sp) => far.put('acct-2', sp.arrive.x + 0.5, sp.arrive.z + 10.6));
  assert.equal(far.B.hy, undefined, 'the Rally holder past 10 m: no hymn');
  const none = breach(4, 2);
  vs(none, { 'acct-1': [[vId('bastion'), 3]] });
  const o2 = openDoor(none);
  assert.deepEqual([o2.filter((f) => f.k === 'eheal').length, none.B.hy], [0, undefined], 'no Rally, no heal and no hymn');
  // a pose of another hall is no place in this one
  const B = S.B;
  B.mem['acct-2'].pose = { ...B.mem['acct-2'].pose, h: 1 };
  B.hy = undefined;
  assert.equal(egHymnStep(B, S.now()), null, 'the Rally holder\'s last place was the hall before');
});

// ── THE CENSUS AND THE SCREEN ────────────────────────────────────────────────────────────────────────────────────────
/** A breach of `n` in hall 5's trial - a Court, its lord awake - the company on the arrival plate (EG-ZP's). */
function court(n = 4) {
  let s = 12345;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(12345, 5, 0);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) { now += 250; egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); }
  assert.equal(B.sg, 'trial', 'the Court woke');
  return { B, spec, lord: B.F.bodies[0], subs: co.map(([sub]) => sub), t: now };
}
/**
 * ONE BLOW, COUNTED BY BOTH (EG-ZP's): a 0.4 blow on me where I stand (`pts[0]`), the company at `pts` - the census's count
 * of it and my screen's. `hymn.ms` before the landing a door said Rally's heal: the census's window from the door's own
 * law (egHymnStep, on the plate the director holds the company at), my screen's from `rally` at the same instant with the
 * company where it draws them then (the same plate).
 */
function both(C, pts, { hymn = null, fall = null } = {}) {
  const { B, spec, subs } = C, me = subs[0];
  const at = (C.t += 10_000);
  B.F.blows.length = 0;
  const out = [], [mx, mz] = pts[0];
  assert.ok(egAim(B.F, spec, { o: 0, s: [shDisc(mx, mz, 2)], at, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], at - 1500, out));
  const R = hymn ? at - hymn.ms : 0;
  if (hymn) egHymnStep(B, R);
  if (fall) egFall(B, fall, R + 10, []);   // fallen after the door said it
  const trs = subs.map((sub, i) => (pts[i] ? { sub, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => [t, pts[i][0], 0, pts[i][1], B.h]) } : null)).filter(Boolean);
  const cs0 = B.mem[me].cs?.[3] ?? 0;
  egCount(B, at + 900, trs, LINE, false);
  const counted = (B.mem[me].cs?.[3] ?? 0) - cs0;
  let E = foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(B, at - 1500)), at - 1500), wire(egFightState(B.F, at - 1500)), at - 1500);
  for (const f of out) E = foldEg(E, wire(f), at - 1500);
  const door = subs.map((sub) => [B.mem[sub].pose.x, B.mem[sub].pose.z]);
  let t = at - 1300, P = pts;
  const struck = [], entity = { health: 1000, maxHealth: 1000 };
  const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => entity, me: () => me, strike: (d) => struck.push(d),
    feet: () => realmToDungeon(spec.x0 + P[0][0], 0, P[0][1]),
    peerAt: (sub) => { const i = subs.indexOf(sub); return i > 0 && P[i] ? realmToDungeon(spec.x0 + P[i][0], 1.6, P[i][1]) : null; } });
  fight.frame();
  if (hymn) { P = door; fight.rally(R); P = pts; }
  for (; t < at; t += 100) fight.frame();
  t = at; fight.frame();
  assert.equal(struck.length, 1, 'the blow landed on my screen once');
  return { counted, struck: struck[0], fight };
}

test('EG-ZR SHIELD-HYMN, AGAINST THE CENSUS (sections 15 and 21): a blow inside the window - from the door to 4 s past it, both ends in - is spared Bastion\'s protection wherever I stand, on my screen as in the census; one Bastion near and the hymn\'s are one aura, its holder counted once; another holder near stacks as Bastion does (+2%); the window lapsed or not yet open, my own Bastion, a holder fallen since: nothing (mutants: the window\'s ends; the hymn unread by the census or the screen; the holder counted twice; my own Bastion counted; a fallen holder counted; the screen\'s door unread)', () => {
  const C = court(4), { B, lord, subs } = C, [me, a1, a2, a3] = subs;
  const P = (dx) => [lord.x + dx, lord.z];
  const far = [P(0), P(20), P(-20), P(30)];
  const set = (sub, vs) => { B.mem[sub].vs = vs; };
  const rows = [];
  const row = (name, pts, o) => { const r = both(C, pts, o); rows.push([name, r.counted, r.struck]); return r; };
  set(a1, [[vId('bastion'), 3]]); set(a2, [[vId('rally'), 1]]);
  row('none', far);
  const r = row('the hymn, far from its holder', far, { hymn: { ms: 1000 } });
  assert.deepEqual(r.fight.hymn().slice(2), [[a1]], 'my screen\'s window: Bastion III\'s holder');
  row('the hymn at its last instant', far, { hymn: { ms: EG_HYMN_MS } });
  row('the hymn lapsed', far, { hymn: { ms: EG_HYMN_MS + 1 } });
  row('the hymn not yet said', far, { hymn: { ms: -100 } });
  row('the hymn and its holder near', [P(0), P(3), P(-20), P(30)], { hymn: { ms: 1000 } });
  set(a3, [[vId('bastion'), 1]]);
  row('the hymn and another Bastion near', [P(0), P(20), P(-20), P(4)], { hymn: { ms: 1000 } });
  set(a3, []); set(a1, []); set(me, [[vId('bastion'), 3]]);
  row('my own Bastion in the hymn', far, { hymn: { ms: 1000 } });
  set(me, []); set(a1, [[vId('bastion'), 2]]);
  const rf = row('the hymn\'s holder fallen since', far, { hymn: { ms: 1000 }, fall: a1 });
  assert.equal(rf.fight.hymn(), null, 'my screen\'s door counts no fallen member');
  assert.deepEqual(rows, [
    ['none', 400, 400],
    ['the hymn, far from its holder', 352, 352],
    ['the hymn at its last instant', 352, 352],
    ['the hymn lapsed', 400, 400],
    ['the hymn not yet said', 400, 400],
    ['the hymn and its holder near', 352, 352],
    ['the hymn and another Bastion near', 344, 344],
    ['my own Bastion in the hymn', 400, 400],
    ['the hymn\'s holder fallen since', 400, 400],
  ]);
});

// ── THE SCREEN'S WORD, AND IMMOVABLE'S PUSH HALF ─────────────────────────────────────────────────────────────────────
/** My screen in the Court (`acct-0`) - the breach client over the director's breach, its fight the real one, my feet at
 *  `feet()` (the hall's frame), each companion on the arrival plate as the director holds it; the clock corrected against
 *  a room 5 s ahead at 100 ms each way (EG-ZP's harness); the collider's moves kept. */
function screen(C, feetAt) {
  const realNow = Date.now;
  let clock = C.t, wall = clock - 5000;
  Date.now = () => wall;
  const sent = [], moved = [];
  const entity = { level: 30, health: 1000, maxHealth: 1000, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const spec = C.spec;
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: (...a) => moved.push(a) } };
  const modes = { mode: 'dungeon', egHallBreach: () => C.B.b, egHallCircle: () => egCircleOfHall(5), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  let fight = null;
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => (fight = createEgFight({ link, player: () => entity, me: () => 'acct-0', feet: () => { const f = feetAt(); return realmToDungeon(spec.x0 + f[0], 0, f[1]); },
      peerAt: (sub) => { const p = C.B.mem[sub]?.pose; return p ? realmToDungeon(spec.x0 + p.x, 1.6, p.z) : null; } })),
    accountOf: () => null });
  client.word(wire(egStateOf(C.B, clock)));
  client.word(wire(egFightState(C.B.F, clock)));
  for (let k = 0; k < 12; k++) {
    client.frame();
    for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); }
    wall += 250;
  }
  sent.length = 0;
  assert.ok(Math.abs(client.clockOffset() - 5000) <= 1, `the room's clock (${client.clockOffset()})`);
  return { client, moved, fight: () => fight, step: (ms) => { wall += ms; }, frame: () => client.frame(), now: () => client.sharedNow(), done: () => { Date.now = realNow; spireHolderStep(entity, null); _resetSpireVestigesForTests(); } };
}

test('EG-ZR SHIELD-HYMN, THE SCREEN\'S WORD (scenes/eliteGates/egClient.js): Rally\'s heal heard opens the hymn on my fight at the door\'s opening - the word\'s arrival less its way here (the half round trip) - over the company where my screen draws it; a heal of another kind opens none (mutants: the word unheard; the half round trip kept; another heal heard as Rally\'s)', () => {
  const C = court(3), { B } = C;
  B.mem['acct-1'].vs = [[vId('bastion'), 3]]; B.mem['acct-2'].vs = [[vId('rally'), 2]];
  const S = screen(C, () => [0, 0]);
  try {
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    S.client.word(wire({ k: 'eheal', p: 0.14, why: 'mending' }));
    assert.equal(S.fight().hymn(), null, 'a Mending is no Rally');
    const plate = B.mem['acct-2'].pose.z;
    B.mem['acct-2'].pose.z = plate + 10.6;   // where my screen draws the Rally holder (this harness draws the director's poses)
    S.client.word(wire({ k: 'eheal', p: 0.14, why: 'rally' }));
    assert.equal(S.fight().hymn(), null, 'the Rally holder drawn past 10 m: none on my screen');
    B.mem['acct-2'].pose.z = plate;
    const at = S.now();
    S.client.word(wire({ k: 'eheal', p: 0.14, why: 'rally' }));
    assert.deepEqual(S.fight().hymn(), [at - 100, at - 100 + EG_HYMN_MS, ['acct-1']], 'from the door\'s opening, 4 s');
  } finally { S.done(); }
});

test('EG-ZR IMMOVABLE\'S PUSH HALF (section 15: "pushes do nothing until you move"; EG-ZP\'s "not built"): still a second on a fight floor holding Immovable, a blow\'s push on my screen moves me not at all and the spans\' Gust and Pendulum read the whole of it off (scenes/eliteGates/egClient.js footing - systems/eliteGates/spireKit.js spireFooting\'s word); moved, or short of the second, or off the fight floor, or without the Mastery, Iron Footing\'s share as before (mutants: the stillness unread; Immovable a share; the Mastery unread; the fight floor unread)', () => {
  const C = court(2), { B, lord } = C;
  let feet = [lord.x + 2, lord.z];
  B.mem['acct-0'].mast = IMMOVABLE; B.mem['acct-0'].vs = [[vId('ironfooting'), 2]];
  const S = screen(C, () => feet);
  try {
    S.client.word(wire(egStateOf(B, C.t)));
    const still = (ms) => { for (let k = 0; k < ms / 100; k++) { S.step(100); S.frame(); } };
    feet = [lord.x + 3, lord.z];
    still(500);
    assert.equal(S.client.footing(), 0.65, 'half a second: Iron Footing II\'s share');
    still(700);
    assert.equal(S.fight().immovable(), true);
    assert.equal(S.client.footing(), 1, 'a second still on the floor: the whole push off');
    S.moved.length = 0;
    S.client.push(1, 0, 2); still(500);
    assert.equal(S.moved.length, 0, 'the push does nothing');
    feet = [lord.x + 4, lord.z]; still(100);
    assert.equal(S.client.footing(), 0.65, 'moved: Iron Footing\'s share again');
    S.client.push(1, 0, 2); still(500);
    assert.ok(S.moved.length > 0, 'and the push carries me');
    still(1200);
    assert.equal(S.client.footing(), 1);
    B.mem['acct-0'].mast = -1;
    S.client.word(wire(egStateOf(B, C.t)));
    assert.equal(S.client.footing(), 0.65, 'without the Mastery: Iron Footing alone');
    B.mem['acct-0'].mast = IMMOVABLE;
    S.client.word(wire(egStateOf(B, C.t)));
    feet = [0, 0]; still(1200);
    assert.equal(S.client.footing(), 0.65, 'still on the arrival plate - no fight floor: Iron Footing alone');
  } finally { S.done(); }
  const K = readFileSync(new URL('../../../src/systems/eliteGates/spireKit.js', import.meta.url), 'utf8');
  assert.match(K, /export function spireFooting\(\) \{\s*try \{ const v = Number\(_footing\?\.\(\) \?\? 0\); return Number\.isFinite\(v\) \? Math\.max\(0, Math\.min\(1, v\)\) : 0; \}/, 'the spans read the whole of it');
});
