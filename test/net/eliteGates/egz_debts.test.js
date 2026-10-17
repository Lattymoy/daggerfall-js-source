// EG-ZP (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 15 and 21, EG-ZI's "Not built"):
// THE RECEIVER'S VESTIGES - a blow on a member's own screen spared what the relay's census spares it: Bastion near it, its
// Steadfast Line, its Lifeline windows, its Challenger's Oath and its Immovable, together never past 30% (scenes/eliteGates/egFight.js
// egShieldDr - the census's own law, net/eliteGates/egBrain.js egCensusDr, called on what the screen holds; egLifelineOpen), and
// Lifeline's window opened as the member's heal word goes (scenes/eliteGates/egClient.js lifelineSaid - egHeal's own rule, at the
// word's arrival at the room). Every fixture is the producers' own: the breach and its fight from the director (egEnter,
// egStep, egAim's `eb`, egStateOf and egFightState through the wire), the census from egCount and egHeal, the screen from
// createEgFight and createEgClient - and each blow is counted by both on the same inputs.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egCount, egHeal, egBodyWord, egFall, EG_HEAL_WORD_MS, EG_LIFELINE_MS, EG_LIFELINE_LOOK_MS, EG_LIFELINE_UNDER } from '../../../src/net/eliteGates/egBrain.js';
import { egBodiesOf, egAim, egFightState, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { EG_VESTIGES, EG_MASTERIES, EG_DR_MAX } from '../../../src/net/eliteGates/egVestige.js';
import { EG_TRAIL_MS } from '../../../src/net/eliteGates/egFair.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight, egShieldBreach, egLifelineOpen } from '../../../src/scenes/eliteGates/egFight.js';
/** PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen - the room's record of a cast from the healer to the member (server/src/index.js _egCastSaw). */
const CAST_SEEN = () => true;
import { createEgClient, egLifelineOf, EG_HEAL_SEND_MS } from '../../../src/scenes/eliteGates/egClient.js';
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
const vId = (key) => EG_VESTIGES.find((V) => V.key === key).id;
const IMMOVABLE = EG_MASTERIES.find((M) => M.key === 'immovable').id;
/** A room's word as the wire projects it (its `to` the fan's, never the frame's). */
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** A breach of `n` (seed 12345) in hall 5's trial - a Court, its lord awake - as the director stands it. */
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
  const lord = egBodiesOf(B.F, EG_ROLE.lord)[0];
  assert.ok(lord, 'its lord stands');
  return { B, spec, lord, subs: co.map(([sub]) => sub), t: now };
}

/**
 * ONE BLOW, COUNTED BY BOTH: a plain blow aimed at me (`acct-0`) where I stand (`pts[0]`, the hall's frame), the company
 * standing at `pts` (null: unseen) - the relay's census of it (egCount: my count struck, in thousandths, its trails the
 * poses at `pts`) and my screen's (createEgFight over the director's own frames: my body struck at a maximum health of
 * 1000, my companions drawn at `pts`). `o` the blow's thrower, `p` its share, `b` its points; `moved` I stepped a metre
 * aside 800 ms before it landed; `heal` a heal word of `by`'s on me, heard by the room at `ms` before the landing, and
 * the window my screen opens for it (egLifelineOf on my state, egLifelineOpen at the same arrival).
 */
function both(C, pts, { o = 0, p = 0.4, b = 0, moved = false, heal = null } = {}) {
  const { B, spec, subs } = C, me = subs[0];
  const at = (C.t += 10_000);   // each blow ten seconds after the last: no window of another's
  B.F.blows.length = 0;
  const out = [], [mx, mz] = pts[0];
  assert.ok(egAim(B.F, spec, { o, s: [shDisc(mx, mz, 2)], at, wu: 1500, p, b, el: null, nm: 'Test Blow' }, [], at - 1500, out), 'the blow said');
  let R = 0;
  if (heal) {
    R = at - heal.ms;
    bodyStruck(B.mem[me], 0.8, R - 500, LINE);   // the count under 30% as the word comes
    assert.ok(egHeal(B, me, [[heal.by, 40]], R, LINE, false, CAST_SEEN) > 0, 'the heal believed');   // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen
  }
  // THE CENSUS
  const pose = (i, t) => [t, ...(moved && i === 0 && t === at - 800 ? [mx + 1, 0, mz] : [pts[i][0], 0, pts[i][1]]), B.h];
  const trs = subs.map((sub, i) => (pts[i] ? { sub, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => pose(i, t)) } : null)).filter(Boolean);
  const cs0 = B.mem[me].cs?.[3] ?? 0;
  egCount(B, at + 900, trs, LINE, false);
  const counted = (B.mem[me].cs?.[3] ?? 0) - cs0;
  // MY SCREEN
  let E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, at - 1500)), at - 1500);
  E = foldEg(E, wire(egFightState(B.F, at - 1500)), at - 1500);
  for (const f of out) E = foldEg(E, wire(f), at - 1500);
  let t = at - 1300;
  const struck = [], entity = { health: 1000, maxHealth: 1000 };
  const mine = () => (moved && t >= at - 800 && t < at - 700 ? [mx + 1, mz] : [mx, mz]);
  const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => entity, me: () => me, strike: (d) => struck.push(d),
    feet: () => realmToDungeon(spec.x0 + mine()[0], 0, mine()[1]),
    peerAt: (sub) => { const i = subs.indexOf(sub); return i > 0 && pts[i] ? realmToDungeon(spec.x0 + pts[i][0], 1.6, pts[i][1]) : null; } });   // a companion's pose stands at its eye
  if (heal) {
    fight.lifeline(egLifelineOf(E, me, [heal.by]), R);
    assert.deepEqual(fight.shield().ll, [B.mem[me].ll.at(-1)], 'my window the census\'s own');
  }
  for (; t < at; t += 100) fight.frame();
  t = at; fight.frame();
  assert.equal(struck.length, 1, 'the blow landed on my screen once');
  return { counted, struck: struck[0], fight };
}

test('EG-ZP THE RECEIVER\'S VESTIGES, AGAINST THE CENSUS (sections 15 and 21; EG-ZI\'s "Not built" closed): a blow on my screen spares what the relay\'s census spares the same blow on the same poses - Bastion within 6 m (the strongest, 2% each other holder), my Steadfast Line with three allies within 8 m, my Challenger\'s Oath on a lord\'s blow, my Immovable still a second on the floor, a Lifeline window the census opened, together never past 30%; a companion fallen, gone home or never in, out of reach or unseen spares nothing; the points a blow carries spared by the same share (mutants: the share unapplied; the points unspared; my trail unkept; the trail at the wrong hall; a companion\'s place unshifted; a companion unseen read; the companions\' stamp; the thrower dropped; the runs unread; the Mastery unread; my windows unread; a fallen, a gone-home or an absent companion counted)', () => {
  const C = court(4), { B, lord, subs } = C, [me, a1, a2, a3] = subs;
  const cx = lord.x, cz = lord.z;
  const P = (dx) => [cx + dx, cz];
  const far = [P(0), P(20), P(-20), P(30)], close = [P(0), P(3), P(-3), P(4)];
  const set = (sub, vs, mast = -1) => { B.mem[sub].vs = vs; B.mem[sub].mast = mast; };
  const rows = [];
  const row = (name, pts, o) => { const r = both(C, pts, o); rows.push([name, r.counted, r.struck]); return r; };
  row('none', far);
  set(a1, [[vId('bastion'), 3]]);
  row('Bastion III near', close);
  row('Bastion III far', far);
  set(a2, [[vId('bastion'), 1]]);
  row('two Bastions', close);
  set(a1, []); set(a2, []);
  set(me, [[vId('steadfast'), 2]]);
  row('Steadfast II, three near', close);
  row('Steadfast II, two near', [P(0), P(3), P(-3), P(30)]);
  row('Steadfast II, one unseen', [P(0), P(3), P(-3), null]);
  set(me, [[vId('oath'), 2]]);
  row('the Oath, a lord\'s blow', far, { o: lord.i });
  row('the Oath, the place\'s', far);
  set(me, [], IMMOVABLE);
  row('Immovable, still', far);
  row('Immovable, moved', far, { moved: true });
  set(me, []);
  set(a1, [[vId('lifeline'), 1]]);
  row('Lifeline I', far, { heal: { by: a1, ms: 500 } });
  row('Lifeline I, its window gone', far);
  set(me, [[vId('oath'), 3], [vId('steadfast'), 3]], IMMOVABLE);
  for (const s of [a1, a2, a3]) set(s, [[vId('bastion'), 3], [vId('lifeline'), 3]]);
  row('all of them', close, { o: lord.i, heal: { by: a2, ms: 500 } });
  set(me, []);
  for (const s of [a2, a3]) set(s, []);
  row('the points spared as the share', close, { b: 50 });
  // a companion who cannot shield: never in, gone home (a Redoubt's way home - net/eliteGates/egBrain.js egHome's mark), fallen (egFall)
  set(me, [[vId('steadfast'), 1]]); set(a1, []);
  B.mem[a3].in = false;
  row('Steadfast, one never in', close);
  B.mem[a3].in = true;
  set(me, []); set(a1, [[vId('bastion'), 3]]);
  B.mem[a1].home = C.t;
  row('Bastion III gone home', close);
  B.mem[a1].home = 0;
  egFall(B, a1, C.t, []);
  row('Bastion III fallen', close);
  assert.deepEqual(rows, [
    ['none', 400, 400],
    ['Bastion III near', 352, 352],
    ['Bastion III far', 400, 400],
    ['two Bastions', 344, 344],
    ['Steadfast II, three near', 360, 360],
    ['Steadfast II, two near', 400, 400],
    ['Steadfast II, one unseen', 400, 400],
    ['the Oath, a lord\'s blow', 360, 360],
    ['the Oath, the place\'s', 400, 400],
    ['Immovable, still', 300, 300],
    ['Immovable, moved', 400, 400],
    ['Lifeline I', 320, 320],
    ['Lifeline I, its window gone', 400, 400],
    ['all of them', 280, 280],
    ['the points spared as the share', 352, Math.round(450 * 0.88)],
    ['Steadfast, one never in', 400, 400],
    ['Bastion III gone home', 400, 400],
    ['Bastion III fallen', 400, 400],
  ]);
  assert.equal(Math.round(400 * (1 - EG_DR_MAX)), 280, 'all of them: the census\'s 30%, no more');
});

test('EG-ZP THE BREACH THE CENSUS READS, ON MY SCREEN (scenes/eliteGates/egFight.js egShieldBreach): each member of the company the room says, as its row stands - in, alive, home - with the Vestiges and the Mastery of its run, my Lifeline windows on mine alone; the hall (mutants: a row\'s life misread; the runs unread; the windows on everyone)', () => {
  const C = court(3), { B, subs } = C;
  B.mem[subs[1]].vs = [[vId('bastion'), 2]]; B.mem[subs[2]].mast = IMMOVABLE; egFall(B, subs[2], C.t, []);
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, C.t)), C.t);
  const ll = [[1, 2, 0.2]];
  assert.deepEqual(egShieldBreach(E, subs[0], ll), { h: 5, mem: {
    [subs[0]]: { in: true, alive: true, home: false, vs: [], mast: -1, ll },
    [subs[1]]: { in: true, alive: true, home: false, vs: [[vId('bastion'), 2]], mast: -1 },
    [subs[2]]: { in: true, alive: false, home: false, vs: [], mast: IMMOVABLE },
  } });
});

test('EG-ZP LIFELINE\'S WINDOW, THE CENSUS\'S OWN (scenes/eliteGates/egFight.js egLifelineOpen against net/eliteGates/egBrain.js egHeal): heard at the same arrival, my screen opens the window the census opens - from the heal word\'s second back to 3 s past it, at the healer\'s rank - keeps the last four and lets go of those no blow can still be judged in; a window with no share or no instant opens nothing (mutants: the window\'s ends; the four kept as five; the old kept for ever; a share of nought opened)', () => {
  const C = court(3), { B, subs } = C, [me, by, other] = subs;
  B.mem[by].vs = [[vId('lifeline'), 2]]; B.mem[other].vs = [[vId('lifeline'), 1]]; B.mem[me].vs = [[vId('lifeline'), 3]];
  bodyStruck(B.mem[me], 0.9, C.t, LINE);
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, C.t)), C.t);
  const v = egLifelineOf(E, me, [by]);
  assert.equal(v, 0.25, 'Lifeline II');   // PIN MOVED (AUDIT EG III, lane2 #5): Lifeline rebalanced to 20 / 25 / 30% under the census's 30%
  assert.deepEqual([egLifelineOf(E, me, [other, by]), egLifelineOf(E, me, [me, other]), egLifelineOf(E, me, [null, 'acct-9'])], [0.25, 0.2, 0], 'the strongest of a word\'s healers, never summed; never mine; none unnamed or of no breach');
  let ll = [];
  const R = C.t + 1000;
  for (const dt of [0, 10, 20, 30, 40, EG_LIFELINE_MS + EG_TRAIL_MS + 100]) {
    egBodyWord(B, me, 100, R + dt, LINE, false);   // PIN MOVED (AUDIT EG III): a heal worth a window lifts the count; its own word keeps it seen low
    egHeal(B, me, [[by, 30]], R + dt, LINE, false, CAST_SEEN);   // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen
    ll = egLifelineOpen(ll, v, R + dt);
    assert.deepEqual(ll, B.mem[me].ll, `the census's windows at +${dt}`);
  }
  assert.equal(ll.length, 1, 'the old let go');
  assert.deepEqual(egLifelineOpen([], 0.2, 5000), [[5000 - EG_HEAL_WORD_MS, 5000 + EG_LIFELINE_MS, 0.2]]);
  assert.equal(B.mem[me].ll.length, 1);
  const f = createEgFight({ link: { state: () => EG_STATE_EMPTY, now: () => 0 }, now: () => 0 });
  f.lifeline(0, 5000); f.lifeline(0.2, NaN);
  assert.deepEqual(f.shield().ll, [], 'no share, no instant: nothing');
  f.lifeline(0.2, 5000);
  assert.deepEqual(f.shield().ll, [[4000, 8000, 0.2]]);
  f.leave();
  assert.deepEqual(f.shield(), { ll: [], trail: 0 }, 'out of the breach: let go');
});

test('EG-ZP MY TRAIL, THE CENSUS\'S SHAPE (scenes/eliteGates/egFight.js): while I stand in a hall\'s fight my feet are kept each frame as the census keeps a trail - `[t, x, y, z, h]` in the hall\'s frame, its last EG_TRAIL_MS and the one before - never more (mutants: the trail never trimmed; trimmed short of a second)', () => {
  const C = court(2), { B, spec } = C;
  const E = foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(B, C.t)), C.t), wire(egFightState(B.F, C.t)), C.t);
  let t = C.t;
  const f = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => ({ health: 100, maxHealth: 100 }), me: () => 'acct-0', feet: () => realmToDungeon(spec.x0 + 2, 0, 30) });
  for (let k = 0; k < 100; k++, t += 100) f.frame();
  assert.equal(f.shield().trail, EG_TRAIL_MS / 100 + 1, 'its last three seconds and the one before');
});

// ── LIFELINE, THE RECEIVER'S HALF: my heal word opens the census's window on my screen ───────────────────────────────
/** My screen in the Court (`acct-0`), its fight the real one, its peers named by account (`accountOf`), its clock
 *  corrected against a room 5 s ahead at a 100 ms one-way delay - the director's breach `C` its room. */
function screen(C) {
  const realNow = Date.now;
  let clock = C.t, wall = clock - 5000;
  Date.now = () => wall;
  const sent = [], struck = [];
  const entity = { level: 30, health: 1000, maxHealth: 1000, magicka: 10, maxMagicka: 50, fatigue: 0, stats: {}, items: [] };
  const spec = C.spec;
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => C.B.b, egHallCircle: () => egCircleOfHall(5), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  const ids = { 'peer-ann': 'acct-1', 'peer-bob': 'acct-2', 'peer-me': 'acct-0', 'peer-who': 'acct-9' };
  let fight = null;
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => (fight = createEgFight({ link, player: () => entity, me: () => 'acct-0', strike: (d) => struck.push(d), feet: () => null })),
    accountOf: (id) => ids[id] ?? null });
  client.word(wire(egStateOf(C.B, clock)));
  // the clock corrected: five pings answered, a 5 s skew, 100 ms each way
  for (let k = 0; k < 12; k++) {
    client.frame();
    for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); }
    wall += 250;
  }
  sent.length = 0;
  assert.ok(Math.abs(client.clockOffset() - 5000) <= 1, `the room's clock (${client.clockOffset()})`);
  /** the next heal word out, at a second past the last (EG_HEAL_SEND_MS) - answers the shared instant it went at */
  const say = () => { wall += EG_HEAL_SEND_MS; const at = client.sharedNow(); client.frame(); return at; };
  return { client, entity, sent, struck, fight: () => fight, say, step: (ms) => { wall += ms; }, frame: () => client.frame(), now: () => client.sharedNow(), done: () => { Date.now = realNow; } };
}

test('EG-ZP LIFELINE, THE RECEIVER\'S HALF (scenes/eliteGates/egClient.js lifelineSaid; section 15: "the receiver\'s client"): my heal word with a Lifeline holder\'s heal in it, said while I stood under 30% - my body at a frame, or before the heal that lifted me - opens that holder\'s window on my blows at the word\'s arrival at the room (my shared clock and the half round trip), the census\'s window for the same word to the millisecond; a healer without it, my own heal, a stranger\'s or an unnamed peer\'s, and a body over 30% open none; the look back the census\'s, a second and a beat (mutants: the window never opened; the healer unread; the half round trip dropped; my own heal believed; the frame\'s low unnoted; the heal\'s low unnoted; 30% itself under; the look back a moment short)', () => {
  const C = court(3), { B } = C;
  B.mem['acct-1'].vs = [[vId('lifeline'), 2]];
  B.mem['acct-0'].vs = [[vId('lifeline'), 3]];
  const S = screen(C);
  try {
    const { client, entity } = S;
    const ll = () => S.fight().shield().ll, last = () => ll().at(-1) ?? null;
    /** the window a word said at shared `at` opens: from its arrival (100 ms later) a second back to 3 s on */
    const win = (at, v = 0.25) => [at + 100 - EG_HEAL_WORD_MS, at + 100 + EG_LIFELINE_MS, v];   // PIN MOVED (AUDIT EG III, lane2 #5): Lifeline II's 25%
    const census = (word, R) => { bodyStruck(B.mem['acct-0'], 0.8, R - 10, LINE); egHeal(B, 'acct-0', word.h.map(([id, n]) => [({ 'peer-ann': 'acct-1', 'peer-bob': 'acct-2', 'peer-me': 'acct-0' })[id] ?? '', n]), R, LINE, false, CAST_SEEN); return B.mem['acct-0'].ll?.at(-1) ?? null; };
    // under 30% at a frame, Ann heals: the window at the word's arrival - the census's own
    entity.health = 200; S.frame();
    entity.health += 100; assert.equal(client.healedBy('peer-ann', 100), true);
    const at = S.say();
    const word = S.sent.filter((w) => w.k === 'heal').at(-1);
    assert.deepEqual(word, { k: 'heal', h: [['peer-ann', 100]] });
    assert.deepEqual(ll(), [win(at)], 'Lifeline II, from the word\'s arrival');
    assert.deepEqual(last(), census(word, at + 100), 'the census\'s window for the same word, to the millisecond');
    // a healer without it; my own; a stranger's; a peer this screen cannot name - none (PIN MOVED, AUDIT EG III: the heals below a
    // window's worth, 30 points where they were 10 - net/eliteGates/egBrain.js egLifelineMin)
    const was = last();
    for (const id of ['peer-bob', 'peer-me', 'peer-who', 'peer-nobody']) { entity.health = 200; S.frame(); client.healedBy(id, 30); S.say(); assert.deepEqual(last(), was, `${id}: none`); }
    // AUDIT EG III: Ann's heal short of a window's worth (net/eliteGates/egBrain.js egLifelineMin, at my level - the census's own rule): none
    entity.health = 200; S.frame(); client.healedBy('peer-ann', 10); S.say();
    assert.deepEqual(last(), was, 'ten points, short of the minimum: none');
    // over 30% all along: none
    S.step(EG_LIFELINE_LOOK_MS + 1);
    entity.health = 900; S.frame();
    client.healedBy('peer-ann', 50); S.say();
    assert.deepEqual(last(), was, 'a body over 30%: none');
    // 30% itself is not under it (the census's `v < 0.3`)
    S.step(EG_LIFELINE_LOOK_MS + 1);
    entity.health = 1000 * EG_LIFELINE_UNDER; S.frame();
    entity.health += 30; client.healedBy('peer-ann', 30); S.say();
    assert.deepEqual(last(), was, '30% at a frame and before the heal: not under');
    // under before the heal that lifted me, never seen so at a frame: the heal's own low
    S.step(EG_LIFELINE_LOOK_MS + 1);
    entity.health = 450; client.healedBy('peer-ann', 200);
    const at2 = S.say();
    assert.deepEqual(last(), win(at2), 'the heal found me under 30%');
    // seen under at a frame, stood up by my own potion, then Ann's heal a second and a beat on: the frame's low, within the look back
    S.step(EG_LIFELINE_LOOK_MS + 1);
    entity.health = 250; S.frame();
    entity.health = 800; S.step(EG_LIFELINE_LOOK_MS - EG_HEAL_SEND_MS);
    client.healedBy('peer-ann', 30);
    const at3 = S.say();
    assert.deepEqual(last(), win(at3), 'seen low a second and a beat before the word: within the census\'s look back');
    // and a moment past it: none (the census's own boundary - egBodyWord's low, egHeal a second and a beat and a moment later)
    const was2 = last();
    S.step(EG_LIFELINE_LOOK_MS + 1);
    entity.health = 250; S.frame();
    entity.health = 800; S.step(EG_LIFELINE_LOOK_MS - EG_HEAL_SEND_MS + 1);
    client.healedBy('peer-ann', 30); S.say();
    assert.deepEqual(last(), was2, 'a moment past the look back: none');
    // the host names a healer by its account as it names the company's poses (scenes/world.js - net/social.js accountOfPeer)
    assert.match(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8'), /createEgClient\(\{[\s\S]*?accountOf: \(id\) => social\?\.accountOfPeer\?\.\(id\) \?\? null,[\s\S]*?\}\) : null;/, 'world.js hands the client its peers\' accounts');
    const q = B.mem['acct-2'], tl = C.t + 900_000;
    q.vs = []; bodyStruck(q, 0.1, tl - 10, LINE);
    egBodyWord(B, 'acct-2', 250, tl, LINE);
    egHeal(B, 'acct-2', [['acct-1', 30]], tl + EG_LIFELINE_LOOK_MS + 1, LINE, false, CAST_SEEN);
    assert.equal(q.ll, undefined, 'the census\'s boundary, the same');
  } finally { S.done(); }
});

// ── THE PAGE: the debts' sentences retired ────────────────────────────────────────────────────────────────────────────
test('EG-ZP THE PAGE\'S STALE SENTENCES RETIRED (bible/11-Multiplayer/Elite-Gates.md - RETIRING A FLAG DELETES THE SENTENCE): EG-ZI\'s "Not built" for the receiver\'s Vestiges; what of EG-H1\'s departures EG-ZB (the fallen segments, the fire fall, the drain), EG-ZA (the receipt\'s measures), EG-ZD (the feint\'s fade, and its world.js flag), EG-ZG (the client\'s arrow) and EG-H2 (the checkpoint) closed; and layer three\'s straight-walking legion - each gone, EG-H1\'s departures renumbered without a gap, and what stands of them standing', () => {
  const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
  const record = (a, b) => { const i = page.indexOf(a), j = page.indexOf(b, i); assert.ok(i > 0 && j > i, a); return page.slice(i, j); };
  const h1 = record('### EG-H1 - ', '### EG-H3 - '), three = record('### EG-FULL, LAYER THREE - ', '### EG-E (first part) - '), zi = record('### EG-ZI - ', '### EG-ZO - ');
  for (const [text, gone] of [[zi, 'No screen applies a word-Vestige'], [h1, 'fallen segments\n   still hold'], [h1, 'The feint\'s dashed fade is the look\'s (EG16)'], [h1, 'A fire fall and the hammer line (`trav`) stay the screens\' alone'],
    [h1, 'The `e1` receipt\'s `m` is the receipts'], [h1, 'client\'s arrow (section 11.7) is not built'], [h1, 'a breach in a trial cannot be checkpointed'], [h1, 'still read the\n  welcome\'s offset'],
    [three, 'The legion walks straight to'], [three, 'the relay\'s walkers do not yet route through it']]) assert.ok(!text.includes(gone), `retired: ${gone}`);
  const deps = h1.slice(h1.indexOf('**Departures, said plainly.**'), h1.indexOf('**The four hosts.**'));
  const nums = [...deps.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7, 8], 'eight, numbered without a gap');   // PIN MOVED at the merge: EG6a retired the fourth (EG_CROSS_MIN, now the solver's fastest crossing)
  assert.ok(deps.includes('3. Support is the spec\'s law geometry, never the collider. A belt carries under the push\'s allowance, and is\n   not ridden.'), 'the third narrowed to what stands');
  assert.ok(deps.includes('6. The span\'s own Pendulums and Vents stand on traversal ground no aimed blow reaches, so they share no union set.\n'), 'the old ninth narrowed');
  assert.ok(deps.includes('7. A plain blow\'s whole `p` is counted, its points never.'), 'the old tenth stands: the relay holds no maximum health');
  assert.ok(three.includes('  - a chokepoint arch 6 m wide;\n'), 'layer three\'s arch without its pointer');
});
