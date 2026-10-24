// EG-ZS (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 15 and 21; EG-ZR's "Not built"): THE
// ACCORDS - two members within 10 m holding a named pair from two families, each Accord applied by the relay inside the caps
// and by THE PAIR LAW (net/eliteGates/egVestige.js egAccordMates): HAMMER AND ANVIL and AMBUSH on a blow's factor (net/eliteGates/egRun.js
// egVestigeX), KINDLED STEEL's fire struck by the room itself (net/eliteGates/egBrain.js hostHits), WAR-CHORUS's Echo taken whole
// (net/eliteGates/egRun.js egEchoShare - the screen claims the cast's whole), LIVING WALL on the census's count of a heal
// (egCountHeals, egWallOf) and on the holder's screen (scenes/eliteGates/egClient.js applyHeal, menderGrace - scenes/eliteGates/egFight.js
// accordMates); and the offer's card naming the Accord it takes (ui/eliteGates/egHud.js egPanelModel). Every fixture is the producers'
// own: the breach and its Court from the director, the company's places minted by its beat, blows through egBlow, heals
// through the room's words, the screen from createEgClient.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egBlow, egCountHeals, egWallOf } from '../../../src/net/eliteGates/egBrain.js';
import { egFightState, egRaise, egBodyAt, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, egLegionRaise } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsOf, egLordHitX, egLordsWake } from '../../../src/net/eliteGates/egLords.js';
import { EG_V_BY_KEY, EG_ECHO_Q, EG_HAMMER_X, EG_AMBUSH_X, EG_WALL_X, EG_ECHO_SHARE, EG_FADE_CD_S } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { bodyStruck } from '../../../src/net/bossBody.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { spireHolderStep, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { defineLiveMaxHealth } from '../../../src/systems/chargen.js';
import { egPanelModel, drawEgPanel, destroyEgHud } from '../../../src/ui/eliteGates/egHud.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
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
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const body = (max = 1000) => defineLiveMaxHealth({ isPlayer: true, level: 30, stats: stats(), skills: new Array(35).fill(40), career: {}, activeEffects: [], items: [], health: max, maxHealth: max, magicka: 50, maxMagicka: 100 });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

/** The Court of seed 12345's Hall 5, woken by the director with a company of three, `vs` each member's Vestiges, the company
 *  stood where `at` puts it for one beat (the director mints its places), the legion that beat raised cleared. */
function court(vs = {}, at = {}) {
  const rng = seeded(12345);
  const co = Array.from({ length: 3 }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: 12345, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(12345, 5, 0);
  B.h = 5; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const subs = co.map(([sub]) => sub);
  const pos = Object.fromEntries(subs.map((sub, i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const step = () => { now += 250; return egStep(B, now, subs.map((sub) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  for (let k = 0; k < 80 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', 'the Court woke');
  const places = { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46], ...at };
  for (const [sub, [x, z]] of Object.entries(places)) pos[sub] = { sx: spec.x0 + x, z };
  step();
  B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  for (const [sub, v] of Object.entries(vs)) B.mem[sub].vs = v;
  let q = 1;
  return {
    B, spec, rng, step, now: () => now, tick: (ms) => (now += ms),
    adds: (pts, hp = 500) => egRaise(B.F, EG_ROLE.add, 0, pts, hp, now, []),
    /** a blow of `sub`'s (`d` claimed, kind `r`, numbered `seq` or the next) on body `i` from where `sub` stands (or `at`) */
    blow: (sub, i, d, r, seq = q++, at = places[sub]) => { const [x, z] = at; return egBlow(B, sub, { k: 'hit', i, q: seq, d, r }, { sx: spec.x0 + x, y: 0, z }, (now += 300)); },
    /** PIN MOVED (AUDIT EG III, lane2 #6): `sub` back where `places` puts it, as the room last holds its pose - a mark is laid by an
     *  arrow from beyond 12 m (section 21), and the pair law reads where the member stands after */
    stand: (sub) => { const [x, z] = places[sub]; B.mem[sub].pose = { x, z, h: 5 }; },
  };
}

/** PIN MOVED (AUDIT EG III, lane2 #6): a place on the Court's floor 13 m from the foes the Hammer's pins strike - beyond 12 m. */
const FAR = [0, 29.5];
// ── HAMMER AND ANVIL ─────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS HAMMER AND ANVIL (section 15: Challenger\'s Oath with Hunter\'s Mark - "a foe the mark\'s holder marked takes +8% from the oath\'s holder"): a foe my mate\'s first arrow marked takes my blow its mark\'s share and the Accord\'s 8% more while we stand within 10 m; the mark\'s holder\'s own blows the mark alone; the mate past 10 m, a foe marked by none, or my own mark (one member holding both): the mark alone (mutants: the Accord\'s share; the mark\'s layer unkept or unread; the pair\'s reach)', () => {
  const vs = { 'acct-0': [[vId('oath'), 1]], 'acct-1': [[vId('huntersmark'), 1]] };
  const S = court(vs);
  const [A, U] = S.adds([[0, 42.5], [0.5, 39.5]]);
  S.blow('acct-1', A.i, 20, HIT_KINDS.Shaft, undefined, FAR);   // PIN MOVED (AUDIT EG III, lane2 #6): the first arrow from beyond 12 m
  S.stand('acct-1');
  assert.deepEqual([A.hp, A.marked.by, A.marked.x], [480, 'acct-1', 0.05], 'the mate\'s first arrow lands and marks it');
  S.blow('acct-0', A.i, 20, HIT_KINDS.Melee);
  assert.ok(near(480 - A.hp, 20 * 1.05 * (1 + EG_HAMMER_X)), `my blow: the mark and the Accord (${480 - A.hp})`);
  const h1 = A.hp;
  S.blow('acct-1', A.i, 20, HIT_KINDS.Shaft);
  assert.ok(near(h1 - A.hp, 21), 'the mark\'s holder\'s own: the mark alone');
  S.blow('acct-0', U.i, 20, HIT_KINDS.Melee);
  assert.equal(U.hp, 480, 'a foe nobody marked: nothing more');
  // a foe marked by another (a Spotter's mark, no Hunter's Mark of its own) takes its mark from me, never the Accord's share
  S.B.mem['acct-2'].mast = 102;
  const [V] = S.adds([[-5.5, 44]]);
  S.blow('acct-2', V.i, 20, HIT_KINDS.Shaft, undefined, FAR);   // PIN MOVED (AUDIT EG III, lane2 #6): the Spotter's arrow from beyond 12 m
  S.stand('acct-2');
  assert.deepEqual([V.marked.by, V.marked.x], ['acct-2', 0.1]);
  S.blow('acct-0', V.i, 20, HIT_KINDS.Shaft);
  assert.ok(near(480 - V.hp, 22), `the Spotter's mark alone (${480 - V.hp})`);
  const F = court(vs, { 'acct-1': [-10.5, 41] });
  const [A2] = F.adds([[0, 42.5]]);
  F.blow('acct-1', A2.i, 20, HIT_KINDS.Shaft, undefined, FAR);
  F.stand('acct-1');
  F.blow('acct-0', A2.i, 20, HIT_KINDS.Melee);
  assert.ok(near(480 - A2.hp, 21), 'the mate 10.5 m off: the mark alone');
  const M = court({ 'acct-0': [[vId('oath'), 1], [vId('huntersmark'), 1]] });
  const [A3] = M.adds([[0, 42.5]]);
  M.blow('acct-0', A3.i, 20, HIT_KINDS.Shaft, undefined, FAR);
  M.blow('acct-0', A3.i, 20, HIT_KINDS.Melee);
  assert.ok(near(480 - A3.hp, 21), 'my own mark: one member is no Accord');
});

// ── AMBUSH ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS AMBUSH (section 15: Fade with Spire\'s Standard - "the first blow after a Fade, within 10 m of the Standard\'s holder, deals +15%"): the blow after the one that began my Fade deals its 15% more over the Standard\'s own aura, the next none, and again after the next Fade (its 8 s cooldown); the Standard\'s holder past 10 m: neither (mutants: the Accord\'s share; Ambush never armed; never spent; armed without a Fade; the pair\'s reach)', () => {
  const vs = { 'acct-0': [[vId('fade'), 1]], 'acct-1': [[vId('standard'), 1]] };
  const S = court(vs);
  const [A] = S.adds([[0, 42.5]], 5000);
  const dealt = [];
  const hit = () => { const h = A.hp; S.blow('acct-0', A.i, 20, HIT_KINDS.Melee); dealt.push(Math.round((h - A.hp) * 1000) / 1000); };
  hit(); hit(); hit();
  S.tick(EG_FADE_CD_S * 1000);
  hit(); hit(); hit();
  const std = 20 * 1.04, amb = 20 * 1.04 * (1 + EG_AMBUSH_X);
  assert.deepEqual(dealt, [std, amb, std, std, amb, std].map((x) => Math.round(x * 1000) / 1000), 'the Standard near; the blow after each Fade +15%');
  assert.equal(S.B.mem['acct-0'].amb, 0, 'spent');
  const F = court(vs, { 'acct-1': [-10.5, 41] });
  const [A2] = F.adds([[0, 42.5]], 5000);
  F.blow('acct-0', A2.i, 20, HIT_KINDS.Melee); const h = A2.hp; F.blow('acct-0', A2.i, 20, HIT_KINDS.Melee);
  assert.ok(near(h - A2.hp, 20), 'the Standard\'s holder 10.5 m off: no aura, no Ambush');
  const N = court({ 'acct-0': [[vId('fade'), 1]] });
  const [A3] = N.adds([[0, 42.5]], 5000);
  N.blow('acct-0', A3.i, 20, HIT_KINDS.Melee); const h3 = A3.hp; N.blow('acct-0', A3.i, 20, HIT_KINDS.Melee);
  assert.ok(near(h3 - A3.hp, 20), 'no Standard held: none');
  assert.equal(N.B.mem['acct-0'].amb, 0);
});

// ── KINDLED STEEL ────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS KINDLED STEEL (section 15: Searing Edge with Overcharge - "the Edge holder\'s melee fire splashes 2 m (relay host hits)"): my melee blow, my mate holding Overcharge within 10 m, splashes Searing Edge\'s fire - 6 at rank II - on every other foe within 2 m of its target, a lord by its own weight; past 2 m, an arrow, the mate past 10 m or holding none: nothing (mutants: the splash\'s reach; the fire\'s points; the splash about me; an arrow splashing; the pair unread)', () => {
  const vs = { 'acct-0': [[vId('searing'), 2]], 'acct-1': [[vId('overcharge'), 1]] };
  const S = court(vs);
  const [A, X, Y, Z] = S.adds([[0, 42.5], [1.5, 43], [0, 44.45], [2.05, 42.5]]);
  S.blow('acct-0', A.i, 20, HIT_KINDS.Melee);
  assert.deepEqual([A, X, Y, Z].map((b) => b.hp), [480, 494, 494, 500], 'the target its blow, 1.58 and 1.95 m from it the Edge\'s 6 fire, 2.05 m none');
  S.blow('acct-0', A.i, 20, HIT_KINDS.Shaft);
  assert.deepEqual([X, Y].map((b) => b.hp), [494, 494], 'an arrow splashes nothing');
  const F = court(vs, { 'acct-1': [-10.5, 41] });
  const [A2, X2] = F.adds([[0, 42.5], [1.5, 43]]);
  F.blow('acct-0', A2.i, 20, HIT_KINDS.Melee);
  assert.equal(X2.hp, 500, 'the mate 10.5 m off: none');
  const N = court({ 'acct-0': [[vId('searing'), 2], [vId('overcharge'), 1]] });
  const [A3, X3] = N.adds([[0, 42.5], [1.5, 43]]);
  N.blow('acct-0', A3.i, 20, HIT_KINDS.Melee);
  assert.equal(X3.hp, 500, 'both mine: no Accord');
  // a lord within 2 m of the target: by its own weight
  const L = court(vs, { 'acct-0': [15.32, 67.5], 'acct-1': [12, 66] });
  const lord = egLordsOf(L.B.F)[0], [lx, lz] = egBodyAt(lord, L.now()), [A4] = L.adds([[lx, lz - 1.9]]);
  egLordsWake(L.B.F, L.spec, L.now(), [], { n: 3 });   // PIN MOVED (AUDIT EG IV, lane1 #3): a lord asleep takes no blow - woken where he stands (his kit's own wake); before, struck asleep
  const hp0 = lord.hp, w = egLordHitX(L.B.F, lord, 'acct-0', { x: 15.32, z: 67.5 }, HIT_KINDS.Melee, L.now() + 300);
  L.blow('acct-0', A4.i, 20, HIT_KINDS.Melee);
  assert.ok(w > 0 && near(hp0 - lord.hp, 6 * w, 1e-6), `the lord 1.9 m from the target takes the fire by its weight (${hp0 - lord.hp})`);
  const [A5] = L.adds([[lx, lz - 2.1]]), hp1 = lord.hp;
  L.blow('acct-0', A5.i, 20, HIT_KINDS.Melee);
  assert.equal(lord.hp, hp1, '2.1 m: none');
});

// ── WAR-CHORUS ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS WAR-CHORUS AND AN ECHO\'S SHARE (section 15: Arcane Echo with Spire\'s Standard - "within 10 m of the Standard, an Echo repeats at full"): the room takes an Echo\'s claim (a blow numbered past EG_ECHO_Q, which the screen claims at the cast\'s whole) at half - and whole while I stand within 10 m of a mate holding the Standard, its aura with it; a blow of the cast\'s own number is whole either way; the share is the Binder\'s raise\'s too (mutants: the Echo unknown by its number; the share; War-Chorus unread; the Binder\'s raise fed the whole claim)', () => {
  const vs = { 'acct-0': [[vId('echo'), 1]], 'acct-1': [[vId('standard'), 1]] };
  const S = court(vs);
  const [A] = S.adds([[0, 42.5]], 5000);
  let h = A.hp;
  S.blow('acct-0', A.i, 100, HIT_KINDS.Spell, 900);
  assert.ok(near(h - A.hp, 104), 'the cast: whole, the Standard\'s aura on it');
  h = A.hp;
  S.blow('acct-0', A.i, 100, HIT_KINDS.Spell, 901 + EG_ECHO_Q);
  assert.ok(near(h - A.hp, 104), `its Echo in War-Chorus: whole (${h - A.hp})`);
  const F = court(vs, { 'acct-1': [-10.5, 41] });
  const [A2] = F.adds([[0, 42.5]], 5000);
  h = A2.hp;
  F.blow('acct-0', A2.i, 100, HIT_KINDS.Spell, 902 + EG_ECHO_Q);
  assert.ok(near(h - A2.hp, 100 * EG_ECHO_SHARE), `the Standard 10.5 m off: the Echo at half (${h - A2.hp})`);
  h = A2.hp;
  F.blow('acct-0', A2.i, 100, HIT_KINDS.Spell, EG_ECHO_Q - 1);
  assert.ok(near(h - A2.hp, 100), 'a number short of EG_ECHO_Q is no Echo');
  h = A2.hp;
  F.blow('acct-0', A2.i, 100, HIT_KINDS.Spell, 2 * EG_ECHO_Q);
  assert.ok(near(h - A2.hp, 100), 'nor one twice EG_ECHO_Q or past it (no cast is numbered from EG_ECHO_Q)');
  // an Echo on a lord: the seam's blow takes the room's share too
  const lord = egLordsOf(F.B.F)[0];
  egLordsWake(F.B.F, F.spec, F.now(), [], { n: 3 });   // PIN MOVED (AUDIT EG IV, lane1 #3): a lord asleep takes no blow - woken where he stands; before, struck asleep (a member outside his ring)
  const hl = lord.hp, w = egLordHitX(F.B.F, lord, 'acct-0', { x: 0, z: 41 }, HIT_KINDS.Spell, F.now() + 300);
  F.blow('acct-0', lord.i, 100, HIT_KINDS.Spell, 904 + EG_ECHO_Q);
  assert.ok(w > 0 && near(hl - lord.hp, 100 * EG_ECHO_SHARE * w, 1e-6), `the lord takes the Echo's half by its weight (${hl - lord.hp})`);
  // the Binder's raise counts the Echo at the room's share
  const R = court({ 'acct-0': [[vId('echo'), 1]] });
  const [bd, lk] = egLegionRaise(R.B.F, [EG_KIND.binder, EG_KIND.lurker], [[0, 44], [3, 44]], R.now(), [], { wave: 7 });
  R.blow('acct-0', lk.i, 500, HIT_KINDS.Melee);
  assert.ok(!R.B.F.bodies.includes(lk), 'the Lurker slain');
  for (let k = 0; k < 8 && !bd.cast; k++) R.step();
  assert.ok(bd.cast && bd.cast.max === bd.max / 10, 'the Binder raises the fallen');
  R.blow('acct-0', bd.i, 2 * bd.cast.max - 1, HIT_KINDS.Spell, 903 + EG_ECHO_Q);
  assert.ok(bd.cast && near(bd.cast.dmg, bd.cast.max - 0.5), `an Echo counts its half against the raise, short of breaking it (${bd.cast?.dmg})`);
});

// ── LIVING WALL ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** My screen (`acct-0`) in the Court `S` (EG-ZR's harness): its fight the real one drawing each companion at the place the
 *  director holds it, my feet at `feet`, the company named by peer id, my body a live player's. */
function screen(S, feet = [0, 41]) {
  const realNow = Date.now;
  let clock = S.now(), wall = clock - 5000;
  Date.now = () => wall;
  const sent = [], hurts = [];
  const entity = Object.assign(body(1000), { fatigue: 0 });
  const spec = S.spec;
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => S.B.b, egHallCircle: () => egCircleOfHall(5), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  const ids = { 'peer-ann': 'acct-1', 'peer-bob': 'acct-2', 'peer-me': 'acct-0' };
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => hurts.push(n), peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => createEgFight({ link, player: () => entity, me: () => 'acct-0', feet: () => realmToDungeon(spec.x0 + feet[0], 0, feet[1]),
      peerAt: (sub) => { const p = S.B.mem[sub]?.pose; return p ? realmToDungeon(spec.x0 + p.x, 1.6, p.z) : null; } }),
    accountOf: (id) => ids[id] ?? null });
  client.word(wire(egStateOf(S.B, clock)));
  client.word(wire(egFightState(S.B.F, clock)));
  for (let k = 0; k < 12; k++) {
    client.frame();
    for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); }
    wall += 250;
  }
  return { client, entity, hurts, frame: () => client.frame(), state: () => client.word(wire(egStateOf(S.B, S.now()))), done: () => { Date.now = realNow; spireHolderStep(entity, null); _resetSpireVestigesForTests(); } };
}

test('EG-ZS LIVING WALL, BOTH HALVES (section 15: Stoneskin with Mender\'s Grace - "heals on the Stoneskin holder +10%"): the census counts a room\'s heal on a Stoneskin holder standing within 10 m of a mate holding Mender\'s Grace its 10% more (egWallOf, on the places the director holds), as the holder\'s screen heals it (applyHeal, on the places it draws); a companion\'s heal spell on it heals the Accord\'s share of the whole more, Mender\'s Grace in it (menderGrace); the mate past 10 m, no Mender\'s Grace, no Stoneskin, my own heal or a rest\'s whole: as before (mutants: the Accord\'s share; the census\'s half unread; the screen\'s half unread; the pair\'s reach; my own heal walled)', () => {
  _resetSpireVestigesForTests(); _resetPlayerHealForTests();
  const vs = { 'acct-0': [[vId('stoneskin'), 1]], 'acct-1': [[vId('mender'), 3]] };
  const counted = (S) => { const m = S.B.mem['acct-0']; bodyStruck(m, 0.5, S.now(), LINE); const v0 = m.bd.v; egCountHeals(S.B, [{ k: 'eheal', p: 0.08, why: 'rally' }], S.now(), LINE); return Math.round((m.bd.v - v0) * 1e6) / 1e6; };
  const S = court(vs);
  assert.equal(egWallOf(S.B, 'acct-0'), true);
  assert.equal(egWallOf(S.B, 'acct-1'), false, 'the Mender is not the wall');
  assert.equal(counted(S), Math.round(0.08 * (1 + EG_WALL_X) * 1e6) / 1e6, 'the census: Rally\'s 8% and the Accord\'s tenth of it');
  assert.equal(counted(court(vs, { 'acct-1': [-10.5, 41] })), 0.08, 'the mate 10.5 m off');
  assert.equal(counted(court({ 'acct-0': [[vId('stoneskin'), 1]], 'acct-1': [[vId('rally'), 1]] })), 0.08, 'no Mender\'s Grace');
  assert.equal(counted(court({ 'acct-1': [[vId('mender'), 3]] })), 0.08, 'no Stoneskin');
  const O = court(vs);
  O.B.mem['acct-1'].pose = { ...O.B.mem['acct-1'].pose, h: 4 };
  assert.equal(egWallOf(O.B, 'acct-0'), false, 'the Mender\'s last place was the hall before');
  // the screen: the room's heal and a companion's spell
  const C = screen(S);
  try {
    C.state(); C.frame();
    assert.equal(C.entity.maxHealth, 1100, 'Stoneskin I held');
    C.entity.health = 500;
    C.client.word(wire({ k: 'eheal', p: 0.08, why: 'rally' }));
    assert.equal(C.entity.health, Math.round(500 + 0.08 * 1100 * (1 + EG_WALL_X)), 'Rally\'s 88 and its tenth');
    C.entity.health = 500;
    assert.equal(C.client.menderGrace('peer-ann', 200), 97, 'Mender\'s Grace III and the wall: 200 x (1.35 x 1.1 - 1)');
    assert.equal(C.entity.health, 597);
    assert.equal(C.client.menderGrace('peer-me', 200), 0, 'my own heal: nothing more');
    C.client.word(wire({ k: 'eheal', p: -0.05, why: 'lash' }));
    assert.deepEqual(C.hurts, [50], 'the lash is no heal: its twentieth of the plain 1000');
    C.entity.health = 500;
    S.B.mem['acct-1'].pose = { ...S.B.mem['acct-1'].pose, x: -10.5 };   // where my screen draws the Mender now
    C.client.word(wire({ k: 'eheal', p: 0.08, why: 'rally' }));
    assert.equal(C.entity.health, 588, 'the Mender drawn 10.5 m off: Rally\'s 88 alone');
    assert.equal(C.client.menderGrace('peer-ann', 200), 70, 'Mender\'s Grace alone');
    C.client.word(wire({ k: 'eheal', p: 1, why: 'rest' }));
    assert.equal(C.entity.health, C.entity.maxHealth, 'a rest is whole');
  } finally { C.done(); }
});

// ── THE OFFER'S CARD ─────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS THE OFFER\'S CARD NAMES ITS ACCORD (section 15: "The offer card names it: *Takes an Accord with Mira\'s Hunter\'s Mark.*"): a card whose Vestige I do not hold, with a living companion holding the Accord\'s other half, says so under its line - each companion, each Accord; a companion fallen, a Vestige held already, a Mastery: nothing (mutants: the words; a fallen companion counted; the line undrawn)', () => {
  const S = court({ 'acct-0': [[vId('fade'), 1]], 'acct-1': [[vId('huntersmark'), 2], [vId('echo'), 1]], 'acct-2': [[vId('mender'), 1]] });
  const cards = [vId('oath'), vId('standard'), vId('stoneskin'), vId('fade'), 100];
  const E = () => foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(S.B, S.now())), S.now()), wire({ k: 'offer', v: cards, n: 1 }), S.now());
  const lines = () => egPanelModel(E(), 'acct-0', S.now()).offer.cards.map((c) => c.accord);
  // AUDIT EG III (PIN MOVED): and what each Accord does
  assert.deepEqual(lines(), ["Takes an Accord with M1's Hunter's Mark. Hammer and Anvil: A foe under Hunter's Mark takes +8% damage from the Challenger's Oath holder.", "Takes an Accord with M1's Arcane Echo. War-Chorus: Near the Standard, Arcane Echo repeats at full strength.", "Takes an Accord with M2's Mender's Grace. Living Wall: Heals on the Stoneskin holder are 10% stronger.", '', '']);
  S.B.mem['acct-2'].alive = 0;
  assert.deepEqual(lines().slice(2, 3), [''], 'a fallen companion takes no Accord');
  const doc = fakeDocument();
  destroyEgHud();
  drawEgPanel(egPanelModel(E(), 'acct-0', S.now()), { doc });
  const notes = find(doc.body, 'eg-accord').map((n) => n.textContent);
  assert.deepEqual(notes, ["Takes an Accord with M1's Hunter's Mark. Hammer and Anvil: A foe under Hunter's Mark takes +8% damage from the Challenger's Oath holder.", "Takes an Accord with M1's Arcane Echo. War-Chorus: Near the Standard, Arcane Echo repeats at full strength."], 'drawn under their cards');
  destroyEgHud();
});

// ── a fake document (EG-G1's, test/net/eliteGates/egpres_hud.test.js) ───────────────────────────────────────────────────────────────
function fakeDocument() {
  const doc = { writes: 0 };
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, listeners: {}, id: '', _text: '', _cls: '' };
    n.style = { _p: {}, setProperty(k, v) { this._p[k] = String(v); }, getPropertyValue(k) { return this._p[k] ?? ''; } };
    Object.defineProperty(n, 'textContent', { get: () => n._text, set: (v) => { n._text = String(v); doc.writes++; } });
    Object.defineProperty(n, 'className', { get: () => n._cls, set: (v) => { n._cls = String(v); doc.writes++; } });
    Object.defineProperty(n, 'parentNode', { get: () => n.parent });
    n.append = (...cs) => { for (const c of cs) { if (typeof c === 'string') { n._text += c; continue; } c.parent = n; n.children.push(c); } };
    n.remove = () => { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
    n.setAttribute = (k, v) => { n.attrs[k] = String(v); doc.writes++; };
    n.getAttribute = (k) => n.attrs[k] ?? null;
    n.addEventListener = (t, fn) => { (n.listeners[t] ??= []).push(fn); };
    n.querySelectorAll = () => [];
    return n;
  };
  doc.createElement = node;
  doc.head = node('head'); doc.body = node('body');
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
