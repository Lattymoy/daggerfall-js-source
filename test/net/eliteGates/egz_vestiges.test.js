// EG-ZR (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md section 15, EG-ZP's "Not built"): THE
// VESTIGES ON THEIR HOLDER - every Vestige section 15 gives its holder's own client, applied on the holder's screen while it
// stands alive in an Elite Breach holding it and let go at every way out (systems/eliteGates/spireVestiges.js): Stoneskin on the live
// maximum (a cushion over the body the room's shares are of), Second Wind on the one damage door's hurt, Spellbane on the
// saving throw, Battlemage's Focus on the cast's price, Shieldweaver on the Shield pool, Fleetfoot on the motor's run,
// Featherstep on my crumbles and the cast-back's cost; on a blow of mine on a Spire body Searing Edge, Momentum, Bloodied
// Fury, Overcharge and an Arcane Echo's repeat (scenes/eliteGates/egFight.js hostHit); Mender's Grace on the receiver's screen. Every
// fixture is the producers' own: the breach and its fight from the director, each run through the wire and the screen's
// fold, the holder from the breach client's own frame, each door its own (hurtPlayer, savingChance, calculateCastCost,
// PlayerMotor, createEgSpan, createEgFight, createEgClient).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, egCircleSpecs, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egCount, egCastBackCost } from '../../../src/net/eliteGates/egBrain.js';
import { egAim, egFightState, egRaise, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { EG_V_BY_KEY, egHymnOf, EG_MOMENTUM_STEP, EG_SECOND_WIND_UNDER, EG_BLOODIED_UNDER, EG_ECHO_SHARE, EG_HYMN_MS, EG_ACCORD_M } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { EG_FAST_RUN_MPS, EG_CRUMBLE_DELAY_S } from '../../../src/net/eliteGates/egSpanLaw.js';
import { foldEg, EG_STATE_EMPTY, egRunOfMember } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight, EG_ECHO_Q } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient, egMenderOf } from '../../../src/scenes/eliteGates/egClient.js';
import { createEgSpan, egStepKey } from '../../../src/scenes/eliteGates/egSpan.js';
import { spireHolderStep, spireHeld, spireCrumbleWait, egHolderBlow, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { defineLiveMaxHealth } from '../../../src/systems/chargen.js';
import { spireHpOf, spireBodyMax } from '../../../src/systems/renownLayer.js';
import { hurtPlayer, registerPlayerDeathSave } from '../../../src/characters/playerEntity.js';
import { savingChance, ELEMENTS, EFFECT_FLAGS } from '../../../src/systems/spellcast.js';
import { calculateCastCost } from '../../../src/systems/spellcost.js';
import { PlayerMotor, runSpeed, walkSpeed, FIXED_DT } from '../../../src/player/motor.js';
import { Collider } from '../../../src/player/collider.js';
import { TRANSPORT_MODES, setCanRunOverride } from '../../../src/systems/transport.js';
import { EG_PRES_TEXT, egBeatPlan } from '../../../src/ui/eliteGates/egBeats.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 2]);
  egGive8(1, [1, 2]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const vId = (key) => EG_V_BY_KEY[key].id;
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A player's body at `max` health, its maximum the live accessor every player's is (chargen's and the load arm's). */
const body = (max = 1000) => defineLiveMaxHealth({ isPlayer: true, level: 30, stats: stats(), skills: new Array(35).fill(40), career: {}, activeEffects: [], items: [], health: max, maxHealth: max, magicka: 50, maxMagicka: 100 });

/** A breach of `n` (seed 12345) in hall 5's trial - a Court, its lord awake - as the director stands it (EG-ZP's). */
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
  return { B, spec, subs: co.map(([sub]) => sub), t: now };
}
/** The screen's state of the breach: the room's `st` and the fight's, through the wire and the fold. */
const screenOf = (B, t) => foldEg(foldEg(EG_STATE_EMPTY, wire(egStateOf(B, t)), t), wire(egFightState(B.F, t)), t);
/** Hold on `e` what the room says `sub`'s run holds (the screen's fold of the director's state - the breach client's own
 *  holder: egClient.js holderNow). */
function hold(e, B, sub, t) {
  const run = egRunOfMember(foldEg(EG_STATE_EMPTY, wire(egStateOf(B, t)), t), sub);
  spireHolderStep(e, { vs: run.vs, mast: run.mast, b: B.b, h: B.h });
}

// ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR THE LAW (section 15, net/eliteGates/egVestige.js): the numbers no rank carries - Momentum 4% a stack, Second Wind under 30%, Bloodied Fury under half, an Echo at half, Shield-Hymn 4 s, an Accord within 10 m - declared once and read by the lines; every client Vestige\'s three ranks as the page writes them; THE FAST BUILD\'s run is Fleetfoot III\'s (net/eliteGates/egSpanLaw.js\'s copy held equal); Shield-Hymn\'s pair: a Bastion holder within 10 m of ANOTHER member holding Rally (mutants: each number; the lines\' literals back; the pair\'s reach; one member a pair; the Bastion holder unread)', () => {
  assert.deepEqual([EG_MOMENTUM_STEP, EG_SECOND_WIND_UNDER, EG_BLOODIED_UNDER, EG_ECHO_SHARE, EG_HYMN_MS, EG_ACCORD_M], [0.04, 0.3, 0.5, 0.5, 4000, 10]);
  const keys = ['stoneskin', 'secondwind', 'searing', 'momentum', 'bloodied', 'featherstep', 'fleetfoot', 'focus', 'overcharge', 'spellbane', 'shieldweaver', 'echo', 'mender'];
  assert.deepEqual(keys.map((k) => [k, EG_V_BY_KEY[k].v, EG_V_BY_KEY[k].by]), [
    ['stoneskin', [0.10, 0.18, 0.25], 'client'], ['secondwind', [0.15, 0.25, 0.35], 'client'], ['searing', [3, 6, 9], 'client'], ['momentum', [3, 4, 5], 'client'],
    ['bloodied', [0.10, 0.18, 0.25], 'client'], ['featherstep', [0.2, 0.35, 0.5], 'client'], ['fleetfoot', [0.04, 0.07, 0.10], 'client'], ['focus', [0.10, 0.18, 0.25], 'client'],
    ['overcharge', [0.08, 0.14, 0.20], 'client'], ['spellbane', [10, 18, 25], 'client'], ['shieldweaver', [0.20, 0.35, 0.50], 'client'], ['echo', [0.10, 0.16, 0.22], 'client'],
    ['mender', [0.15, 0.25, 0.35], 'word'],
  ]);
  assert.equal(EG_V_BY_KEY.momentum.line(3), 'Each hit on one target adds 4% damage, up to 3 times.');
  assert.equal(EG_V_BY_KEY.secondwind.line(0.15), 'Once a hall, falling under 30% health heals you 15%.');
  assert.ok(Math.abs(EG_FAST_RUN_MPS - runSpeed(100, 100) * (1 + EG_V_BY_KEY.fleetfoot.v[2])) < 1e-9, 'the fast build runs at Fleetfoot III');
  const R = [[vId('rally'), 1]], Bs = [[vId('bastion'), 3]];
  assert.deepEqual(egHymnOf([{ sub: 'a', vs: Bs, x: 0, z: 0 }, { sub: 'b', vs: R, x: 6, z: 8 }]), ['a'], 'ten metres: the pair');
  assert.deepEqual(egHymnOf([{ sub: 'a', vs: Bs, x: 0, z: 0 }, { sub: 'b', vs: R, x: 6, z: 8.01 }]), [], 'past ten: none');
  assert.deepEqual(egHymnOf([{ sub: 'a', vs: [...Bs, ...R], x: 0, z: 0 }]), [], 'one member holding both is no pair');
  assert.deepEqual(egHymnOf([{ sub: 'a', vs: [...Bs, ...R], x: 0, z: 0 }, { sub: 'b', vs: [...Bs, ...R], x: 1, z: 0 }]), ['a', 'b'], 'each the other\'s');
  assert.deepEqual(egHymnOf([{ sub: 'a', vs: Bs, x: 0, z: 0 }, { sub: 'b', vs: [[vId('standard'), 1]], x: 1, z: 0 }, { sub: 'c', vs: R, x: 30, z: 0 }]), [], 'no Rally near');
  assert.deepEqual(egHymnOf([{ sub: 'a', vs: [[vId('steadfast'), 3]], x: 0, z: 0 }, { sub: 'b', vs: R, x: 1, z: 0 }]), [], 'no Bastion');
});

// ── THE HOLDER ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** My screen in the Court (`acct-0`) - the breach client over the director's breach `C`, its fight the real one, its
 *  peers named by account, its clock corrected against a room 5 s ahead at 100 ms each way (EG-ZP's harness), my body a
 *  live player's; the hurts it takes and the lines it says kept. */
function screen(C, { feet = () => null, peerAt = () => null, collider = null } = {}) {
  const realNow = Date.now;
  let clock = C.t, wall = clock - 5000;
  Date.now = () => wall;
  const sent = [], struck = [], hurts = [], mids = [];
  const entity = Object.assign(body(1000), { fatigue: 0 });
  const spec = C.spec;
  const moved = [];
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: collider ?? { move: (...a) => moved.push(a) } };
  let inside = true;
  const modes = { mode: 'dungeon', egHallBreach: () => (inside ? C.B.b : null), egHallCircle: () => egCircleOfHall(5), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  const ids = { 'peer-ann': 'acct-1', 'peer-bob': 'acct-2', 'peer-me': 'acct-0', 'peer-who': 'acct-9' };
  let fight = null;
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: (n) => hurts.push(n), peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => (fight = createEgFight({ link, player: () => entity, me: () => 'acct-0', strike: (d) => struck.push(d), feet, peerAt })),
    accountOf: (id) => ids[id] ?? null });
  client.word(wire(egStateOf(C.B, clock)));
  for (let k = 0; k < 12; k++) {
    client.frame();
    for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); }
    wall += 250;
  }
  sent.length = 0;
  assert.ok(Math.abs(client.clockOffset() - 5000) <= 1, `the room's clock (${client.clockOffset()})`);
  return { client, entity, sent, struck, hurts, mids, moved, fight: () => fight, step: (ms) => { wall += ms; }, frame: () => client.frame(), now: () => client.sharedNow(), out: () => { inside = false; },
    done: () => { Date.now = realNow; spireHolderStep(entity, null); _resetSpireVestigesForTests(); } };
}

test('EG-ZR THE HOLDER (scenes/eliteGates/egClient.js holderNow, systems/eliteGates/spireVestiges.js spireHolderStep): every frame I stand alive in the breach the room counts me in, my run\'s Vestiges and Mastery as the room says them, the breach and its hall, are handed to the holder\'s doors - Stoneskin on my maximum at once, the fraction kept; gone home, out of the Spire or online gone (`away`), nothing is held and the cushion goes (mutants: the holder never handed; a gone-home member held; held out of the Spire; `away` holding on; the frame\'s holder unrefreshed)', () => {
  const C = court(3), { B } = C;
  B.mem['acct-0'].vs = [[vId('stoneskin'), 3], [vId('spellbane'), 1]];
  const S = screen(C);
  try {
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    assert.deepEqual(spireHeld(), { entity: S.entity, vs: [[vId('stoneskin'), 3], [vId('spellbane'), 1]], mast: -1, b: B.b, h: 5 });
    assert.deepEqual([S.entity.maxHealth, S.entity.health, spireHpOf(S.entity), spireBodyMax(S.entity)], [1250, 1250, 250, 1000], 'Stoneskin III on the live maximum, at full health still full');
    B.mem['acct-0'].vs = [[vId('stoneskin'), 1]];
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    assert.deepEqual([S.entity.maxHealth, S.entity.health], [1100, 1100], 'a new run, the next frame');
    B.mem['acct-0'].home = C.t;
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    assert.deepEqual([spireHeld(), S.entity.maxHealth, S.entity.health], [null, 1000, 1000], 'gone home: nothing held, the cushion gone');
    B.mem['acct-0'].home = 0;
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    assert.equal(S.entity.maxHealth, 1100);
    S.client.away();
    assert.deepEqual([spireHeld(), S.entity.maxHealth], [null, 1000], 'online gone: let go');
    S.frame();
    assert.equal(S.entity.maxHealth, 1100, 'back in the breach\'s frame, held again');
    S.out(); S.frame();
    assert.deepEqual([spireHeld(), S.entity.maxHealth], [null, 1000], 'out of the Spire: let go');
  } finally { S.done(); }
});

// ── STONESKIN ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR STONESKIN (+10 / 18 / 25% maximum health - systems/renownLayer.js setSpireHp on the live accessor): its rank\'s share of the body without it, whole points, on the maximum while held, the fraction kept going on and coming off (500 of 1000 is 625 of 1250 and back); a body without the live accessor carries none; the room\'s shares stay shares of the body without it - a 0.4 blow takes 400 of a Stoneskin III holder\'s 1250, counted the same by the census, and the void\'s, the toll\'s and the lash\'s too (mutants: the share of the whole maximum; the points unrounded; the fraction unkept; a plain entity given points; a blow, the void, the toll or the lash of the cushioned maximum)', () => {
  _resetSpireVestigesForTests();
  const C = court(2), { B, spec, subs } = C, me = subs[0];
  const e = body(1000);
  for (const [r, max] of [[1, 1100], [2, 1180], [3, 1250]]) {
    B.mem[me].vs = [[vId('stoneskin'), r]];
    hold(e, B, me, C.t);
    assert.deepEqual([e.maxHealth, e.health, spireHpOf(e)], [max, max, max - 1000], `rank ${r}`);
  }
  spireHolderStep(e, null);
  e.health = 500;
  hold(e, B, me, C.t);
  assert.deepEqual([e.maxHealth, e.health], [1250, 625], 'the fraction kept going on');
  spireHolderStep(e, null);
  assert.deepEqual([e.maxHealth, e.health, spireHpOf(e)], [1000, 500, 0], 'and coming off');
  const odd = body(998);
  hold(odd, B, me, C.t);
  assert.equal(odd.maxHealth, 998 + 250, 'whole points of the body, rounded (249.5)');
  spireHolderStep(odd, null);
  const plain = { health: 1000, maxHealth: 1000 };
  hold(plain, B, me, C.t);
  assert.deepEqual([plain.maxHealth, plain.health, spireHpOf(plain)], [1000, 1000, 0], 'no live maximum, no points');
  spireHolderStep(plain, null);
  // a blow on the cushioned body: its share of the body without it, as the census counts it
  hold(e, B, me, C.t);
  e.health = e.maxHealth;
  const at = C.t + 10_000, out = [], [mx, mz] = [B.F.bodies[0].x, B.F.bodies[0].z];
  B.F.blows.length = 0;
  assert.ok(egAim(B.F, spec, { o: 0, s: [shDisc(mx, mz, 2)], at, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], at - 1500, out));
  const cs0 = B.mem[me].cs?.[3] ?? 0;
  egCount(B, at + 900, [{ sub: me, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => [t, mx, 0, mz, B.h]) }], LINE, false);
  let E = screenOf(B, at - 1500);
  for (const f of out) E = foldEg(E, wire(f), at - 1500);
  let t = at - 1300;
  const struck = [];
  const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => e, me: () => me, strike: (d) => struck.push(d), feet: () => realmToDungeon(spec.x0 + mx, 0, mz) });
  for (; t <= at; t += 100) fight.frame();
  assert.deepEqual([struck, (B.mem[me].cs?.[3] ?? 0) - cs0], [[400], 400], 'a 0.4 blow takes 400 of 1250: the census\'s 400 thousandths');
  spireHolderStep(e, null);
  // the void's, the toll's and the lash's shares on the breach client: of the body without the cushion
  B.mem[me].vs = [[vId('stoneskin'), 3]];
  const S = screen(C);
  try {
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    assert.deepEqual([S.entity.maxHealth, S.entity.health], [1250, 1250]);
    S.client.castBack();
    S.client.word(wire({ k: 'toll', to: me, q: 2, h: 5 }));
    S.client.word(wire({ k: 'eheal', p: -0.05, why: 'lash' }));
    assert.deepEqual(S.hurts, [100, 100, 50], 'a tenth, two quarters\' tenth and the lash\'s twentieth - of 1000');
  } finally { S.done(); }
});

// ── SECOND WIND ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR SECOND WIND (once a hall, falling under 30% heals 15 / 25 / 35% - characters/playerEntity.js hurtPlayer\'s hurt listener): a hurt that takes me from 30% or over to under it heals its rank\'s share of my maximum - once a hall of the breach, again the next; never a hurt that leaves me at 30% or one already under, never a killing blow a death save turned aside, nothing unheld (mutants: the line; falling from the line itself unheard; the share; once a hall forgotten; the hall unread; a saved blow healed; unheld healed)', () => {
  _resetSpireVestigesForTests(); _resetPlayerHealForTests();
  const C = court(2), { B, subs } = C, me = subs[0];
  const e = body(1000);
  const at = (h, r = 3) => { B.h = h; B.mem[me].vs = [[vId('secondwind'), r]]; hold(e, B, me, C.t); };
  at(5);
  hurtPlayer(e, 600);
  assert.equal(e.health, 400, 'over the line: nothing');
  hurtPlayer(e, 150);
  assert.equal(e.health, 600, 'under it: 35% of 1000 back');
  hurtPlayer(e, 400);
  assert.equal(e.health, 200, 'once a hall');
  at(6);
  hurtPlayer(e, 50);
  assert.equal(e.health, 150, 'already under: nothing');
  e.health = 300; hurtPlayer(e, 1);
  assert.equal(e.health, 649, 'from the line itself, falling under it: the next hall\'s');
  at(7, 1);
  e.health = 500; hurtPlayer(e, 200);
  assert.equal(e.health, 300, 'left at 30%: not under it');
  hurtPlayer(e, 50);
  assert.equal(e.health, 400, 'rank I: 15%');
  at(8);
  registerPlayerDeathSave('egzr-test', () => true);
  try { e.health = 400; hurtPlayer(e, 500); } finally { registerPlayerDeathSave('egzr-test', null); }
  assert.equal(e.health, 1, 'a killing blow a save turned aside: no Second Wind on it');
  e.health = 500; spireHolderStep(e, null); hurtPlayer(e, 300);
  assert.equal(e.health, 200, 'nothing held: nothing');
  e.health = 500; B.b = 'fedcba9876543210';
  B.h = 7; hold(e, B, me, C.t); hurtPlayer(e, 300);
  assert.equal(e.health, 550, 'another breach\'s hall 7 is a hall of its own');
  B.b = '0123456789abcdef';
});

// ── SPELLBANE, FOCUS, SHIELDWEAVER ───────────────────────────────────────────────────────────────────────────────────
test('EG-ZR SPELLBANE (every resistance +10 / 18 / 25 - the resist channel\'s fold, systems/entityMods.js): each element the saving throw names - fire, frost, shock, poison, magic - its chance raised by its rank while held, and back the moment it is let go (mutants: an element missed; the fold unrefolded; the value; another entity\'s fold)', () => {
  _resetSpireVestigesForTests();
  const C = court(2), { B, subs } = C, me = subs[0];
  const e = { isPlayer: false, stats: stats(), career: {}, activeEffects: [], health: 100, maxHealth: 100 };
  const els = [[ELEMENTS.Fire, EFFECT_FLAGS.Fire], [ELEMENTS.Frost, EFFECT_FLAGS.Frost], [ELEMENTS.Shock, EFFECT_FLAGS.Shock], [ELEMENTS.DiseaseOrPoison, EFFECT_FLAGS.Poison], [ELEMENTS.Magic, EFFECT_FLAGS.Magic]];
  const chances = (x) => els.map(([el, fl]) => savingChance(el, fl, x).chance);
  const plain = chances(e);
  assert.deepEqual(plain, [55, 55, 55, 55, 55]);
  B.mem[me].vs = [[vId('spellbane'), 3]];
  hold(e, B, me, C.t);
  assert.deepEqual(chances(e), [80, 80, 80, 80, 80], '+25 on every element');
  const other = { isPlayer: false, stats: stats(), career: {}, activeEffects: [], health: 100, maxHealth: 100 };
  assert.deepEqual(chances(other), plain, 'only the holder\'s');
  B.mem[me].vs = [[vId('spellbane'), 2]];
  hold(e, B, me, C.t);
  assert.deepEqual(chances(e), [73, 73, 73, 73, 73], 'a new rank folds again');
  spireHolderStep(e, null);
  assert.deepEqual(chances(e), plain, 'let go: Daggerfall\'s throw');
});

test('EG-ZR BATTLEMAGE\'S FOCUS (spell cost -10 / 18 / 25% - systems/spellcost.js registerSpellCostMod): my cast\'s price less its rank\'s share, rounded, never under 1, while held; Daggerfall\'s price again once let go; another caster\'s untouched (mutants: the share added; another entity cheapened; held on after)', () => {
  _resetSpireVestigesForTests();
  const C = court(2), { B, subs } = C, me = subs[0];
  const spell = { rangeType: 0, effects: [{ type: 4, subType: 0, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 }] };
  const e = body(100), other = body(100);
  const plain = calculateCastCost(spell, e).sp;
  assert.ok(plain >= 8, `a price to cut (${plain})`);
  for (const [r, k] of [[1, 0.9], [3, 0.75]]) {
    B.mem[me].vs = [[vId('focus'), r]];
    hold(e, B, me, C.t);
    assert.equal(calculateCastCost(spell, e).sp, Math.max(1, Math.round(plain * k)), `rank ${r}`);
    assert.equal(calculateCastCost(spell, other).sp, plain, 'another\'s price');
  }
  spireHolderStep(e, null);
  assert.equal(calculateCastCost(spell, e).sp, plain);
});

test('EG-ZR SHIELDWEAVER (my Shield spell soaks +20 / 35 / 50% - characters/playerEntity.js damageShieldPool\'s soak): a point of my own Shield\'s pool takes 1.5 of a blow at rank III - a 120 blow on a 100 pool fully soaked, 20 left; the next 60 empties it and passes 30 - a party mate\'s Shield on me soaks as Daggerfall\'s does, and mine once let go (mutants: the soak unapplied; the overflow unscaled; a mate\'s gift woven; held on after; the excess unrounded)', () => {
  _resetSpireVestigesForTests();
  const C = court(2), { B, subs } = C, me = subs[0];
  const shield = (o = {}) => ({ kind: 'shield', startingShield: 100, shieldRemaining: 100, roundsRemaining: 5, bundleSelfCast: true, ...o });
  const e = body(1000);
  B.mem[me].vs = [[vId('shieldweaver'), 3]];
  hold(e, B, me, C.t);
  e.activeEffects = [shield()];
  hurtPlayer(e, 120);
  assert.deepEqual([e.health, e.activeEffects[0].shieldRemaining], [1000, 20], '120 soaked by 80 points');
  hurtPlayer(e, 60);
  assert.deepEqual([e.health, e.activeEffects[0].ended], [970, true], 'the last 20 points soak 30: 30 through');
  e.health = 1000; e.activeEffects = [shield({ startingShield: 101, shieldRemaining: 101 })];
  B.mem[me].vs = [[vId('shieldweaver'), 2]];
  hold(e, B, me, C.t);
  hurtPlayer(e, 140);
  assert.equal(e.health, 996, 'rank II: 101 points soak 136.35 - the 3.65 through, whole');
  e.health = 1000; e.activeEffects = [shield({ bundleSelfCast: false, bundleAlly: true })];
  hurtPlayer(e, 120);
  assert.equal(e.health, 980, 'a mate\'s Shield: Daggerfall\'s pool');
  e.health = 1000; e.activeEffects = [shield()];
  spireHolderStep(e, null);
  hurtPlayer(e, 120);
  assert.equal(e.health, 980, 'let go: Daggerfall\'s pool');
});

// ── FLEETFOOT ────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR FLEETFOOT (run speed +4 / 7 / 10% - player/motor.js registerRunSpeedMod): the motor\'s run on foot times its rank while held, the walk and a horse\'s gallop as they were, Daggerfall\'s run again once let go (mutants: the run unscaled; the walk scaled; the gallop scaled; held on after)', () => {
  _resetSpireVestigesForTests();
  const C = court(2), { B, subs } = C, me = subs[0];
  const I = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const speedOf = (input, over = {}) => {
    const col = new Collider(() => 0);
    col.addMesh('floor', [-400, 0, -400, 400, 0, -400, 400, 0, 400, -400, 0, 400], [0, 1, 2, 0, 2, 3], I);
    const m = new PlayerMotor(col);
    m.spawn(0, 0.05, 0);
    Object.assign(m, over);
    for (let f = 0; f < 10; f++) m.update(FIXED_DT, { forward: 1, strafe: 0, run: false, jump: false, up: false, down: false, ...input }, 0);
    return m.speed;
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  setCanRunOverride(() => true);   // a mod's word (RR2): a horse gallops
  const run0 = speedOf({ run: true }), walk0 = speedOf({}), ride0 = speedOf({ run: true }, { transportMode: TRANSPORT_MODES.Horse });
  assert.ok(ride0 > run0, 'a gallop');
  assert.ok(near(run0, runSpeed(50, 30)), 'Daggerfall\'s run');
  assert.ok(near(walk0, walkSpeed(50)));
  for (const [r, k] of [[1, 1.04], [3, 1.1]]) {
    B.mem[me].vs = [[vId('fleetfoot'), r]];
    hold(body(), B, me, C.t);
    assert.ok(near(speedOf({ run: true }), run0 * k), `rank ${r}: the run x${k}`);
    assert.ok(near(speedOf({}), walk0), 'the walk as it was');
    assert.ok(near(speedOf({ run: true }, { transportMode: TRANSPORT_MODES.Horse }), ride0), 'a gallop is the horse\'s');
  }
  spireHolderStep(body(), null);
  assert.ok(near(speedOf({ run: true }), run0), 'let go');
  setCanRunOverride(null);
});

// ── FEATHERSTEP ──────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR FEATHERSTEP (crumbles wait +0.2 / 0.35 / 0.5 s; cast-backs cost 8 / 6 / 4%): a Crumble my foot sets waits its holder\'s seconds longer - read as the foot lands - and falls after them; the void\'s cost is the census\'s own (net/eliteGates/egBrain.js egCastBackCost) and said as it is, -8% at rank I, -4% at III, -10% unheld (mutants: the wait unread; read but unadded; the fall at Daggerfall\'s delay; the cast-back\'s tenth; its word\'s -10% for every rank)', () => {
  _resetSpireVestigesForTests();
  const C = court(2), { B, subs } = C, me = subs[0];
  let found = null;
  for (let seed = 1; seed <= 600 && !found; seed++) for (let c = 1; c <= 20 && !found; c++) for (const s of egCircleSpecs(seed, c, 0)) { const st = s.steps.find((q) => q.kind === 'crumble'); if (st) { found = { seed, c, s, st }; break; } }
  assert.ok(found, 'a Crumble laid');
  const fallsAt = (wait) => {
    const span = createEgSpan({ seed: found.seed, c: found.c });
    span.stand({ dynamicDraws: [], collider: { addMesh: () => {} } });
    const key = egStepKey(found.s.h, found.st.i);
    const foot = { pos: realmToDungeon(found.s.x0 + found.st.x, found.st.y, found.st.z), grounded: true, groundKey: key, height: 1.8, carryBy: () => {}, collider: { move: () => {} } };
    span.ride(10, 0.016, foot, true);
    foot.grounded = false; foot.groundKey = null;
    const solid = (t) => { span.ride(t, 0.016, foot, true); return span.steps.find((q) => q.key === key).solid; };
    return [solid(10 + EG_CRUMBLE_DELAY_S + wait - 0.03), solid(10 + EG_CRUMBLE_DELAY_S + wait + 0.03)];
  };
  assert.equal(spireCrumbleWait(), 0);
  assert.deepEqual(fallsAt(0), [true, false], 'Daggerfall\'s delay');
  B.mem[me].vs = [[vId('featherstep'), 3]];
  hold(body(), B, me, C.t);
  assert.equal(spireCrumbleWait(), 0.5);
  assert.deepEqual(fallsAt(0.5), [true, false], 'rank III: half a second longer, then down');
  B.mem[me].vs = [[vId('featherstep'), 1]];
  hold(body(), B, me, C.t);
  assert.deepEqual(fallsAt(0.2), [true, false], 'rank I: a fifth');
  // its cracks' three stages spread across the longer wait, no chunk falling before it ends, and its chunks falling the
  // fall Daggerfall's delay falls - a wait later (EG-ZL's tells, on the Steps' own chunk law)
  const [x, y, z] = realmToDungeon(found.s.x0 + found.st.x, found.st.y, found.st.z), away = { pos: [x, y + 50, z], grounded: false, groundKey: null, height: 1.8 };
  const drawn = () => {
    const span = createEgSpan({ renderer: { createMesh: (m) => ({ subMeshes: m.subMeshes, model: m }), destroyMesh: () => {} }, audio: { playOneShot: () => {}, play3d: () => {} }, seed: found.seed, c: found.c, lite: false });
    span.stand({ dynamicDraws: [], collider: null });
    span.ride(100 - 0.016, 0.016, null, false);
    span.ride(100, 0.016, { pos: [x, y, z], grounded: true, groundKey: egStepKey(found.s.h, found.st.i), height: 1.8 }, true);
    return { span, slot: span.slots.find((q) => q.h === found.s.h && q.i === found.st.i) };
  };
  spireHolderStep(body(), null);
  const plain = drawn();
  B.mem[me].vs = [[vId('featherstep'), 3]];
  hold(body(), B, me, C.t);
  const { span, slot } = drawn();
  for (const [since, n] of [[0.3, 1], [0.6, 2], [1.0, 3]]) {
    span.ride(100 + since, 0.016, away, true);
    assert.ok(slot.stages.every((d, k) => (!!d && !d.hidden) === (k === n - 1)), `stage ${n} at ${since} s of a 1.2 s wait`);
  }
  assert.ok(slot.chunks.every((d) => !d || d.hidden), 'no chunk falls inside the wait');
  const chunks = (S, since) => { S.span.ride(100 + since, 0.016, away, true); return S.slot.chunks.map((d) => (d.hidden ? null : [...d.object.matrix])); };
  const fell = chunks(plain, EG_CRUMBLE_DELAY_S + 0.1);
  assert.ok(fell.every(Boolean), 'falling, in sight');
  assert.deepEqual(chunks({ span, slot }, EG_CRUMBLE_DELAY_S + 0.5 + 0.1), fell, 'the same fall, half a second later');
  spireHolderStep(body(), null);
  // the void's cost on the breach client
  for (const [vs, cut, said] of [[[], 100, '-10%'], [[[vId('featherstep'), 1]], 80, '-8%'], [[[vId('featherstep'), 3]], 40, '-4%']]) {
    B.mem[me].vs = vs;
    const S = screen(C);
    try {
      S.client.word(wire(egStateOf(B, C.t)));
      S.frame();
      S.client.castBack();
      assert.deepEqual(S.hurts, [Math.round(egCastBackCost(vs) * 1000)], 'the census\'s cost');
      assert.deepEqual([S.hurts[0], S.mids.at(-1)], [cut, said]);
    } finally { S.done(); }
  }
  assert.deepEqual([EG_PRES_TEXT.castBackCost(0.06), egBeatPlan('castBack', { t: '-6%' }).screen, egBeatPlan('castBack').screen], ['-6%', '-6%', '-10%']);
});

// ── THE BLOW ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR A BLOW OF MINE ON A SPIRE BODY (systems/eliteGates/spireVestiges.js egHolderBlow at scenes/eliteGates/egFight.js hostHit): Searing Edge\'s fire on a melee blow alone; Momentum +4% a stack on one body to its rank\'s cap, a stack a blow on the first body it met, a blow on another starting again; Bloodied Fury under half my health; Overcharge on a spell alone - the claim the relay\'s bucket takes; an Arcane Echo repeats a spell on each body it met, claimed whole (EG-ZS: the relay takes its share), one roll a cast, a blow of its own past EG_ECHO_Q (mutants: each Vestige unapplied or on the wrong kind; the stacks uncapped, unbuilt, built per body or never reset; half health\'s line; the echo\'s share, roll, number or a roll a body)', () => {
  const vsAll = [[vId('searing'), 3], [vId('momentum'), 1], [vId('bloodied'), 3], [vId('overcharge'), 3]];
  assert.equal(egHolderBlow(vsAll, 100, HIT_KINDS.Melee), 109);
  assert.equal(egHolderBlow(vsAll, 100, HIT_KINDS.Shaft), 100);
  assert.ok(Math.abs(egHolderBlow(vsAll, 100, HIT_KINDS.Spell) - 120) < 1e-9);
  assert.ok(Math.abs(egHolderBlow(vsAll, 100, HIT_KINDS.Shaft, { stacks: 9, low: true }) - 100 * 1.12 * 1.25) < 1e-9, 'Momentum I caps at three stacks');
  assert.equal(egHolderBlow([], 100, HIT_KINDS.Melee, { stacks: 5, low: true }), 100, 'nothing held: the blow as dealt');
  const C = court(2), { B, spec, subs } = C, me = subs[0];
  const lord = B.F.bodies[0];
  const out = [];
  const [add] = egRaise(B.F, EG_ROLE.add, 0, [[lord.x + 4, lord.z]], 500, C.t, out);
  B.mem[me].vs = [[vId('searing'), 3], [vId('momentum'), 1], [vId('bloodied'), 2], [vId('overcharge'), 1], [vId('echo'), 3]];
  let E = screenOf(B, C.t);
  for (const f of out) E = foldEg(E, wire(f), C.t);
  const sent = [], rolls = [];
  let roll = 0.5, refuse = false;
  const e = { health: 1000, maxHealth: 1000 };
  const fight = createEgFight({ link: { state: () => E, now: () => C.t }, now: () => C.t, player: () => e, me: () => me, sendHit: (h) => { if (refuse) return false; sent.push(h); return true; }, rand: () => { rolls.push(roll); return roll; }, feet: () => realmToDungeon(spec.x0 + lord.x, 0, lord.z - 3) });
  fight.frame();
  const hit = (i, d, r) => { sent.length = 0; assert.equal(fight.hostHit({ i, d, r }), true); return sent.map((h) => [h.i, h.d, h.r]); };
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Melee), [[lord.i, 109, 0]], 'the first blow: the fire, no stack');
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 104, 1]], 'a stack on the lord: +4%, no fire on a shaft');
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 108, 1]]);
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 112, 1]]);
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 112, 1]], 'Momentum I: three stacks and no more');
  fight.frame();
  assert.deepEqual(hit(add.i, 100, HIT_KINDS.Shaft), [[add.i, 100, 1]], 'another body: none');
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 100, 1]], 'and the lord begins again');
  // one blow meeting two bodies builds one stack, on the first it met
  fight.frame();
  hit(add.i, 100, HIT_KINDS.Shaft); hit(lord.i, 100, HIT_KINDS.Shaft);
  fight.frame();
  assert.deepEqual(hit(add.i, 100, HIT_KINDS.Shaft), [[add.i, 104, 1]], 'the blow\'s stack was the add\'s');
  e.health = 499;
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 118, 1]], 'under half: +18%');
  e.health = 500;
  fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 104, 1]], 'at half: not under it');
  // a spell: Overcharge I, and the Echo - its roll under 22% repeats it, once a cast on each body it met (EG-ZS: claimed at the
  // cast's whole - the relay takes its share, half or War-Chorus's whole: test/net/eliteGates/egz_mastery_accords.test.js)
  roll = 0.21; rolls.length = 0;
  fight.frame();
  sent.length = 0;
  assert.equal(fight.hostHit({ i: lord.i, d: 100, r: HIT_KINDS.Spell }), true);
  assert.equal(fight.hostHit({ i: add.i, d: 100, r: HIT_KINDS.Spell }), true);
  const q = sent[0].q;
  assert.deepEqual(sent.map((h) => [h.i, h.q, h.d]), [[lord.i, q, 117], [lord.i, q + EG_ECHO_Q, 117], [add.i, q, 108], [add.i, q + EG_ECHO_Q, 108]], 'Overcharge I and two stacks on the lord, Overcharge alone on the add; the echo claimed whole on both');
  assert.equal(rolls.length, 1, 'one roll a cast');
  for (const h of sent) assert.ok(validEgIn({ k: 'hit', ...h }), 'the wire takes each');
  roll = 0.22;
  fight.frame();
  sent.length = 0;
  fight.hostHit({ i: add.i, d: 100, r: HIT_KINDS.Spell });
  assert.deepEqual(sent.map((h) => h.d), [108], '22% is not under 22%: no echo');
  roll = 0.01; rolls.length = 0;
  fight.frame();
  assert.deepEqual(hit(add.i, 100, HIT_KINDS.Melee).length, 1, 'a melee blow never echoes');
  assert.deepEqual(hit(add.i, 100, HIT_KINDS.Shaft).length, 1, 'nor an arrow');
  assert.equal(rolls.length, 0, 'and rolls nothing');
  assert.equal(egHolderBlow([[vId('echo'), 3]], 100, HIT_KINDS.Spell), 100, 'the Echo is no factor on the blow itself');
  assert.deepEqual([EG_ECHO_SHARE, EG_ECHO_Q], [0.5, 0x40000000]);
  // a blow the wire refused is no blow: no stack, and the host told so
  fight.frame(); hit(lord.i, 100, HIT_KINDS.Shaft);
  refuse = true; fight.frame();
  assert.equal(fight.hostHit({ i: lord.i, d: 100, r: HIT_KINDS.Shaft }), false, 'refused: not sent');
  refuse = false; fight.frame();
  assert.deepEqual(hit(lord.i, 100, HIT_KINDS.Shaft), [[lord.i, 104, 1]], 'one stack, the refused blow none');
});

// ── MENDER'S GRACE ───────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR MENDER\'S GRACE, THE RECEIVER\'S HALF ("heals you cast on allies +15 / 25 / 35%" - the receiver\'s client, from the room\'s word): a companion\'s heal of n points on me heals its rank\'s share of n more, read off the caster\'s run as the room says it - never my own, a stranger\'s, an unnamed peer\'s, as a witness or out of the Spire; the host hands every ally cast\'s heal to it (scenes/world.js onCast) (mutants: the share; my own heal graced; the caster unnamed graced; graced out of the Spire; the host\'s door gone)', () => {
  _resetPlayerHealForTests();
  const C = court(3), { B } = C;
  B.mem['acct-1'].vs = [[vId('mender'), 3]];
  B.mem['acct-0'].vs = [[vId('mender'), 2]];
  B.mem['acct-2'].vs = [[vId('mender'), 1]];
  const E = foldEg(EG_STATE_EMPTY, wire(egStateOf(B, C.t)), C.t);
  assert.deepEqual(['acct-1', 'acct-2', 'acct-0', 'acct-9', null].map((s) => egMenderOf(E, 'acct-0', s)), [0.35, 0.15, 0, 0, 0]);
  const S = screen(C);
  try {
    S.client.word(wire(egStateOf(B, C.t)));
    S.frame();
    S.entity.health = 500;
    assert.equal(S.client.menderGrace('peer-ann', 100), 35);
    assert.equal(S.entity.health, 535, 'Mender\'s Grace III: 35 more');
    assert.equal(S.client.menderGrace('peer-bob', 20), 3);
    assert.equal(S.entity.health, 538, 'rank I: 15% of 20');
    for (const id of ['peer-me', 'peer-who', 'peer-nobody']) assert.equal(S.client.menderGrace(id, 100), 0, id);
    S.out();
    assert.equal(S.client.menderGrace('peer-ann', 100), 0, 'out of the Spire');
  } finally { S.done(); }
  const W = readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8');
  assert.match(W, /magic\.applySpellToPlayer\(spell, d\.level, null, \{ allyCast: true, strangerCast: !mate \}\); egClient\?\.menderGrace\?\.\(id, playerEntity\.health - before\);[^\n]*\n\s*const healed = Math\.max\(0, Math\.trunc\(playerEntity\.health - before\)\);/, 'every ally cast\'s heal reaches it, before the heal is told');
});

// ── THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZR THE PAGE (bible/11-Multiplayer/Elite-Gates.md - RETIRING A FLAG DELETES THE SENTENCE): EG-ZP\'s departure 9 (Shield-Hymn and the holder\'s Vestiges found, not built) and its departure 1\'s Immovable push half "not built here" are gone, its departures numbered 1 to 8 without a gap; this slice\'s record follows it, its four hosts named', () => {
  const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
  const i = page.indexOf('### EG-ZP - '), j = page.indexOf('### EG-ZR - ');
  assert.ok(i > 0 && j > i, 'EG-ZR after EG-ZP');
  const zp = page.slice(i, j);
  for (const gone of ['Found, not built here:** Shield-Hymn', 'is applied by neither the census nor any screen', 'Iron Footing is the only one a screen applies', 'Immovable\'s other half (pushes do nothing) is not built here']) assert.ok(!zp.includes(gone), `retired: ${gone}`);
  const deps = zp.slice(zp.indexOf('**Departures, said plainly.**'), zp.indexOf('**Not verified'));
  assert.deepEqual([...deps.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8]);
  const zr = page.slice(j, page.indexOf('\n### ', j + 4) > 0 ? page.indexOf('\n### ', j + 4) : page.length);
  for (const host of ['scenes/world.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js', 'scenes/exterior.js']) assert.ok(zr.includes(`\`src/${host}\` - `), `the four hosts: ${host}`);
});
