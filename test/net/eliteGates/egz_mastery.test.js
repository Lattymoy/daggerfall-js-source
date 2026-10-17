// EG-ZS (2026-10-12, the Elite Gates arc; bible/11-Multiplayer/Elite-Gates.md sections 8.5, 15 and 21; EG-ZR's and EG-ZQ's
// "Not built"): THE MASTERIES' MISSING HALVES, STONESKIN IN THE CENSUS'S COUNT AND THE MARKYNAZ'S CARD - the capstones'
// client halves (Rooted's immunity to push on the breach client's footing, Spellweave's free fourth damage spell on the cast's
// price and the cast told, Rallying Cry's Second Wind refreshed at a door through the holder), the relay's Bladestorm and
// Deadeye (net/eliteGates/egBrain.js hostHits, struck by the room itself), a Stoneskin holder's count of its whole body (egCountWhole -
// it falls where its screen falls), and the decree the Markynaz lays named on his arrival card (ui/eliteGates/egSpireHud.js
// egMarkynazLine, the relay's own egMarkynazDecree). Every fixture is the producers' own: the breach, its Court and its
// Proving Walk from the director, blows through egBlow, the census by egCount, the screen from createEgClient and its fold
// of the room's words, each door its own (calculateCastCost, tellPlayerCast, hurtPlayer).
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { egHallOf, egCircleOfHall, EG_SEALED_MS, EG_DECREE_BY_KEY } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep, egStateOf, egStageWord, egBlow, egCount, egCountHeals, egBodyWord, egHeal, egCountWhole, egBehind } from '../../../src/net/eliteGates/egBrain.js';
import { egAim, egFightState, egRaise, egBodyAt, egSetFl, EG_ROLE, EG_FL } from '../../../src/net/eliteGates/egBodies.js';
import { egLordsOf, egLordHitX, egLordsWake, EG_OBJ } from '../../../src/net/eliteGates/egLords.js';
import { egThreatX } from '../../../src/net/eliteGates/egRun.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { EG_V_BY_KEY, EG_ACCORDS, egAccordMates, egCardAccords, EG_STORM_N, EG_STORM_M, EG_WEAVE_N, EG_FAR_M, EG_HAMMER_X, EG_AMBUSH_X, EG_WALL_X, EG_KINDLED_M, EG_ECHO_Q } from '../../../src/net/eliteGates/egVestige.js';
import { HIT_KINDS, healRef } from '../../../src/net/gate/gateBrain.js';
import { strikeDamage } from '../../../src/net/gate/gateStrike.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight, EG_ECHO_Q as FIGHT_ECHO_Q } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import { spireHolderStep, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { defineLiveMaxHealth } from '../../../src/systems/chargen.js';
import { spireBodyMax } from '../../../src/systems/renownLayer.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { calculateCastCost } from '../../../src/systems/spellcost.js';
import { tellPlayerCast } from '../../../src/systems/playerCasts.js';
import { egArrivalCard, egArrivalLive, egMarkynazLine, egArrivalShown, drawEgArrivalCard, destroyEgSpireHud } from '../../../src/ui/eliteGates/egSpireHud.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 2]);
  egGive8(1, [14, 15]);
  egGive8(2, [13]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const LINE = { depth: 1, perS: 0.05 };
const vId = (key) => EG_V_BY_KEY[key].id;
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
/** A player's body at `max` health, its maximum the live accessor every player's is (chargen's and the load arm's). */
const body = (max = 1000) => defineLiveMaxHealth({ isPlayer: true, level: 30, stats: stats(), skills: new Array(35).fill(40), career: {}, activeEffects: [], items: [], health: max, maxHealth: max, magicka: 50, maxMagicka: 100 });
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

/** A breach of `n` (seed `seed`) at hall `h`'s arrival - its decrees `dc` - woken by the director (EG-ZQ's breachAt):
 *  `stand` puts the company where it stands for one beat (its poses minted by the director), `step` beats it. */
function breachAt(seed, h, { n = 3, dc = [] } = {}) {
  const rng = seeded(seed);
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  B.dc = dc.map((p) => [...p]);
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const subs = co.map(([sub]) => sub);
  const step = () => { now += 250; return egStep(B, now, subs.map((sub) => ({ sub, ...pos[sub], dead: false, at: now })), rng); };
  const wake = () => { for (let k = 0; k < 80 && B.sg !== 'trial'; k++) step(); assert.equal(B.sg, 'trial', `hall ${h} woke`); };
  const stand = (at) => { for (const [sub, [x, z]] of Object.entries(at)) pos[sub] = { sx: spec.x0 + x, z }; step(); };
  return { B, spec, subs, step, wake, stand, now: () => now, tick: (ms) => { now += ms; return now; } };
}
/** The Court of seed 12345's Hall 5, woken, its company stood on its near disc (centre 0, 41; r 11) and the legion the beats
 *  raised cleared, so the bodies a test raises are the only adds there. */
function court(at = { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] }, dc = []) {
  const S = breachAt(12345, 5, { dc });
  S.wake();
  S.stand(at);
  S.B.F.bodies = S.B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  return S;
}
/** Adds raised at `pts` with `hp` each (the fight's own raise). */
const adds = (S, pts, hp = 500) => egRaise(S.B.F, EG_ROLE.add, 0, pts, hp, S.now(), []);
/** A blow of `sub`'s (`d` claimed, kind `r`) on body `i` from (x, z) on the fight floor, a beat's hand later. */
let seq = 1;
const blow = (S, sub, i, d, r, [x, z]) => egBlow(S.B, sub, { k: 'hit', i, q: seq++, d, r }, { sx: S.spec.x0 + x, y: 0, z }, S.tick(300));

// ── THE LAW ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS THE LAW (section 15, net/eliteGates/egVestige.js): the capstones\' and the Accords\' numbers declared once - Bladestorm\'s fifth blow within 3 m, Spellweave\'s fourth spell, "beyond 12 m", Hammer and Anvil +8%, Ambush +15%, Living Wall +10%, Kindled Steel 2 m, an Echo numbered 0x40000000 past its cast (the screen\'s the law\'s own); THE PAIR LAW: a member within 10 m of ANOTHER holding the Accord\'s other half, on the side it holds; THE OFFER\'S ACCORDS: a new Vestige with each companion holding its other half (mutants: each number; the reach; one member a pair; the side unread; the mate\'s half unread; a held Vestige or a Mastery taking one)', () => {
  assert.deepEqual([EG_STORM_N, EG_STORM_M, EG_WEAVE_N, EG_FAR_M, EG_HAMMER_X, EG_AMBUSH_X, EG_WALL_X, EG_KINDLED_M, EG_ECHO_Q], [5, 3, 4, 12, 0.08, 0.15, 0.1, 2, 0x40000000]);
  assert.equal(FIGHT_ECHO_Q, EG_ECHO_Q, 'the screen sends the law\'s number');
  assert.deepEqual(EG_ACCORDS.map((A) => [A.key, A.a, A.b]), [['hammer', 'oath', 'huntersmark'], ['hymn', 'bastion', 'rally'], ['ambush', 'fade', 'standard'], ['kindled', 'searing', 'overcharge'],
    ['farwatch', 'longsight', 'watchfire'], ['livingwall', 'stoneskin', 'mender'], ['noquarter', 'culling', 'fallensdue'], ['warchorus', 'echo', 'standard']]);
  const O = [[vId('oath'), 1]], H = [[vId('huntersmark'), 2]];
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: O, x: 0, z: 0 }, { sub: 'b', vs: H, x: 6, z: 8 }], 'a', 'hammer'), ['b'], 'ten metres: the pair');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: O, x: 0, z: 0 }, { sub: 'b', vs: H, x: 6, z: 8.01 }], 'a', 'hammer'), [], 'past ten: none');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: [...O, ...H], x: 0, z: 0 }], 'a', 'hammer'), [], 'one member holding both is no pair');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: H, x: 0, z: 0 }, { sub: 'b', vs: O, x: 1, z: 0 }], 'a', 'hammer'), [], 'the mark\'s holder is not the oath\'s side');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: H, x: 0, z: 0 }, { sub: 'b', vs: O, x: 1, z: 0 }], 'a', 'hammer', 'b'), ['b'], 'but is the other side');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: [[vId('fade'), 1]], x: 0, z: 0 }, { sub: 'b', vs: H, x: 1, z: 0 }], 'a', 'hammer'), [], 'holding neither half, no Accord with the mark\'s holder');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: O, x: 0, z: 0 }, { sub: 'b', vs: [[vId('fade'), 1]], x: 1, z: 0 }, { sub: 'c', vs: H, x: 2, z: 0 }], 'a', 'hammer'), ['c'], 'the mate holds the other half');
  assert.deepEqual(egAccordMates([{ sub: 'a', vs: O, x: 0, z: 0 }], 'a', 'nosuch'), []);
  const co = [['Mira', H], ['Bran', [[vId('rally'), 1], [vId('mender'), 1]]], ['Tov', [[vId('steadfast'), 1]]]];
  assert.deepEqual(egCardAccords(vId('oath'), [], co), [{ key: 'hammer', name: 'Mira', with: "Hunter's Mark" }], 'Takes an Accord with Mira\'s Hunter\'s Mark');
  assert.deepEqual(egCardAccords(vId('bastion'), [], co), [{ key: 'hymn', name: 'Bran', with: 'Rally' }]);
  assert.deepEqual(egCardAccords(vId('stoneskin'), [], co), [{ key: 'livingwall', name: 'Bran', with: "Mender's Grace" }]);
  assert.deepEqual(egCardAccords(vId('oath'), O, co), [], 'held already: it is no new Accord');
  assert.deepEqual(egCardAccords(100, [], co), [], 'a Mastery takes none');
  assert.deepEqual(egCardAccords(vId('standard'), [], [['Ana', [[vId('fade'), 1], [vId('echo'), 2]]]]).map((a) => a.key), ['ambush', 'warchorus'], 'both Accords the Standard takes');
});

// ── THE BREACH CLIENT (EG-ZR's harness) ─────────────────────────────────────────────────────────────────────────────
/** My screen (`acct-0`) in the breach `S` - the breach client over the director's breach, its fight the real one, its
 *  clock corrected against a room 5 s ahead at 100 ms each way, my body a live player's; the collider's moves kept. */
function screen(S, feetAt = () => [0, 41]) {
  const realNow = Date.now;
  let clock = S.now(), wall = clock - 5000;
  Date.now = () => wall;
  const sent = [], moved = [];
  const entity = Object.assign(body(1000), { fatigue: 0 });
  const spec = S.spec;
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: (...a) => moved.push(a) } };
  const modes = { mode: 'dungeon', egHallBreach: () => S.B.b, egHallCircle: () => egCircleOfHall(S.B.h), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); assert.ok(w, `the wire refuses my ${k}`); sent.push(w); return true; } };
  let fight = null;
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => clock, entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: () => {}, site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => (fight = createEgFight({ link, player: () => entity, me: () => 'acct-0', feet: () => { const f = feetAt(); return realmToDungeon(spec.x0 + f[0], 0, f[1]); },
      peerAt: (sub) => { const p = S.B.mem[sub]?.pose; return p ? realmToDungeon(spec.x0 + p.x, 1.6, p.z) : null; } })),
    accountOf: () => null });
  client.word(wire(egStateOf(S.B, clock)));
  client.word(wire(egFightState(S.B.F, clock)));
  for (let k = 0; k < 12; k++) {
    client.frame();
    for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); }
    wall += 250;
  }
  sent.length = 0;
  assert.ok(Math.abs(client.clockOffset() - 5000) <= 1, `the room's clock (${client.clockOffset()})`);
  return { client, entity, moved, fight: () => fight, frame: () => client.frame(), said: (f) => client.word(wire(f)), state: () => client.word(wire(egStateOf(S.B, S.now()))),
    done: () => { Date.now = realNow; spireHolderStep(entity, null); _resetSpireVestigesForTests(); } };
}

// ── ROOTED ───────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS ROOTED, THE CLIENT\'S HALF (section 15, Stone\'s capstone: "immune to push"; EG-ZR\'s "not built"): three different Stone Vestiges and a push on my screen moves me not at all - the breach client\'s footing whole, as the spans\' Gust and Pendulum read it - with or without Iron Footing; two, or the third of another family, and Iron Footing\'s share as before (mutants: the resonance unread; another family\'s resonance read; Rooted a share)', () => {
  const S = court();
  const me = S.B.mem['acct-0'];
  const C = screen(S);
  try {
    me.vs = [[vId('stoneskin'), 1], [vId('secondwind'), 1], [vId('bastion'), 1]];
    C.state(); C.frame();
    assert.equal(C.client.footing(), 1, 'Rooted: the whole push off');
    C.moved.length = 0;
    C.client.push(1, 0, 2);
    for (let k = 0; k < 5; k++) C.frame();
    assert.equal(C.moved.length, 0, 'the push does nothing');
    me.vs = [[vId('ironfooting'), 2], [vId('stoneskin'), 1], [vId('fleetfoot'), 1]];
    C.state(); C.frame();
    assert.equal(C.client.footing(), 0.65, 'two of Stone: Iron Footing II\'s share');
    me.vs = [[vId('searing'), 1], [vId('momentum'), 1], [vId('sweeping'), 1]];
    C.state(); C.frame();
    assert.equal(C.client.footing(), 0, 'Blade\'s resonance is no Rooted');
    me.vs = [[vId('ironfooting'), 1], [vId('stoneskin'), 1], [vId('oath'), 1]];
    C.state(); C.frame();
    assert.equal(C.client.footing(), 1, 'with Iron Footing among the three: whole');
  } finally { C.done(); }
});

// ── SPELLWEAVE ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS SPELLWEAVE, THE CLIENT\'S HALF (section 15, Arcana\'s capstone: "every fourth damage spell costs nothing"): resonating in Arcana, each damage spell of mine that leaves the hands (systems/playerCasts.js tellPlayerCast - the cast engine\'s word) is counted, and the fourth, the eighth, are priced at nothing by the cast\'s one price (systems/spellcost.js calculateCastCost - the ready, the spend and the book\'s figure); a spell that is no damage spell is neither counted nor free; two of Arcana, another entity, a foe\'s pricing, the holder let go and another breach\'s count: Daggerfall\'s price (mutants: the fourth\'s number; the damage spell unread; the casts uncounted; the count kept across breaches; the free door on a foe\'s price; another entity\'s spell free)', () => {
  _resetSpireVestigesForTests();
  const S = breachAt(12345, 5), { B } = S;
  const fx = (type, subType) => ({ type, subType, magnitudeBaseLow: 20, magnitudeBaseHigh: 20, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, durationBase: 0, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1 });
  const bolt = { rangeType: 2, effects: [fx(4, 0)] }, heal = { rangeType: 0, effects: [fx(10, 8)] };
  const e = body(100), other = body(100);
  const price = (sp, who = e, o) => calculateCastCost(sp, who, o).sp;
  const plain = price(bolt), plainHeal = price(heal);
  assert.ok(plain > 1 && plainHeal > 1, `prices to free (${plain}, ${plainHeal})`);
  const hold = (vs, b = B.b) => spireHolderStep(e, { vs, mast: -1, b, h: 5 });
  const cast = (sp) => tellPlayerCast(e, sp, price(sp));
  hold([[vId('overcharge'), 1], [vId('spellbane'), 1], [vId('shieldweaver'), 1]]);
  const seen = [];
  for (let k = 1; k <= 8; k++) { seen.push(price(bolt)); cast(bolt); if (k === 2) { assert.equal(price(heal), plainHeal, 'a heal is never free'); cast(heal); } }
  assert.deepEqual(seen, [plain, plain, plain, 0, plain, plain, plain, 0], 'the fourth and the eighth damage spell cost nothing; the heal between counted nothing');
  for (let k = 0; k < 3; k++) cast(bolt);
  assert.equal(price(bolt), 0, 'the twelfth');
  assert.equal(price(heal), plainHeal, 'a heal at the fourth: Daggerfall\'s price');
  assert.equal(price(bolt, other), plain, 'another\'s spell');
  assert.equal(price(bolt, e, { portMods: false }), plain, 'a foe\'s pricing reads no door of mine');
  hold([[vId('overcharge'), 1], [vId('spellbane'), 1]]);
  assert.equal(price(bolt), plain, 'two of Arcana: no Spellweave');
  hold([[vId('overcharge'), 1], [vId('spellbane'), 1], [vId('shieldweaver'), 1]], 'fedcba9876543210');
  assert.equal(price(bolt), plain, 'another breach: its own count');
  cast(bolt); cast(bolt); cast(bolt);
  assert.equal(price(bolt), 0, 'its own fourth');
  spireHolderStep(e, null);
  assert.equal(price(bolt), plain, 'let go: Daggerfall\'s price');
  cast(bolt);
  hold([[vId('overcharge'), 1], [vId('spellbane'), 1], [vId('shieldweaver'), 1]], 'fedcba9876543210');
  assert.equal(price(bolt), 0, 'a cast with nothing held counted nothing');
  _resetSpireVestigesForTests();
  const src = readFileSync(new URL('../../../src/scenes/hostMagic.js', import.meta.url), 'utf8');
  assert.match(src, /const spellPointCost = free \? 0 : calculateCastCost\(sp, playerEntity\)\.sp;/, 'the ready captures the price the spend pays');
  assert.match(src, /if \(v\) tellPlayerCast\(playerEntity, sp, cost\);/, 'a cast that left the hands is told');
});

// ── RALLYING CRY ─────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS RALLYING CRY, THE CLIENT\'S HALF (section 15, Fellowship\'s capstone: "every Second Wind in the company refresh[es] when a hall\'s door opens"): a Second Wind spent in this hall is mine again from its door\'s opening (the room\'s `dn`, said by its stage word) while a living member of my company resonates in Fellowship - once a door; no resonance, a fallen holder, or no door: once a hall as before (mutants: the cry unread; the door unread; refreshed every frame; a refresh kept for another hall)', () => {
  _resetSpireVestigesForTests(); _resetPlayerHealForTests();
  const S = court(), { B } = S;
  B.mem['acct-0'].vs = [[vId('secondwind'), 3]];
  B.mem['acct-1'].vs = [[vId('rally'), 1], [vId('standard'), 1], [vId('watchfire'), 1]];
  const C = screen(S);
  const e = C.entity;
  const fall = (from, by) => { e.health = from; hurtPlayer(e, by); return e.health; };
  try {
    C.state(); C.frame();
    assert.equal(fall(500, 300), 550, 'Second Wind III: 35% of 1000');
    assert.equal(fall(500, 300), 200, 'spent for the hall');
    B.sg = 'closing'; B.dn = S.now();
    C.said(egStageWord(B, S.now())); C.frame();
    assert.equal(fall(500, 300), 550, 'the door opened: the Rallying Cry gives it back');
    C.frame(); C.frame();
    assert.equal(fall(500, 300), 200, 'once a door, however many frames');
    // no Fellowship resonance in the company: none at the next door
    B.h = 6; B.sg = 'trial'; B.dn = 0; C.state(); C.said(egStageWord(B, S.now())); C.frame();
    assert.equal(fall(500, 300), 550, 'a new hall: its own Second Wind');
    B.mem['acct-1'].vs = [[vId('rally'), 1], [vId('standard'), 1]];
    B.sg = 'closing'; B.dn = S.now() + 1;
    C.state(); C.said(egStageWord(B, S.now())); C.frame();
    assert.equal(fall(500, 300), 200, 'two of Fellowship: no Cry');
    // the holder fallen: no Cry
    B.mem['acct-1'].vs = [[vId('rally'), 1], [vId('standard'), 1], [vId('watchfire'), 1]];
    B.mem['acct-1'].alive = 0;
    B.h = 7; B.sg = 'trial'; B.dn = 0; C.state(); C.said(egStageWord(B, S.now())); C.frame();
    assert.equal(fall(500, 300), 550);
    B.sg = 'closing'; B.dn = S.now() + 2;
    C.state(); C.said(egStageWord(B, S.now())); C.frame();
    assert.equal(fall(500, 300), 200, 'the Cry\'s holder fallen: none');
    B.mem['acct-1'].alive = 1;
    C.state(); C.frame();
    assert.equal(fall(500, 300), 550, 'standing again at the same door: it is given');
    // my own resonance is the company's too
    B.mem['acct-0'].vs = [[vId('secondwind'), 3], [vId('rally'), 1], [vId('steadfast'), 1], [vId('mender'), 1]];
    B.mem['acct-1'].vs = [];
    B.h = 8; B.sg = 'trial'; B.dn = 0; C.state(); C.said(egStageWord(B, S.now())); C.frame();
    fall(500, 300);
    B.sg = 'closing'; B.dn = S.now() + 3;
    C.state(); C.said(egStageWord(B, S.now())); C.frame();
    assert.equal(fall(500, 300), 550, 'mine refreshes my own');
  } finally { C.done(); }
  // a hall's refresh is no other hall's: the door's instant of hall 9 never frees hall 10's spent wind
  const e2 = body(1000), hold = (h, dn, cry = true) => spireHolderStep(e2, { vs: [[vId('secondwind'), 1]], mast: -1, b: B.b, h, dn, cry });
  hold(9, 0); e2.health = 400; hurtPlayer(e2, 200); assert.equal(e2.health, 350);
  hold(9, 77); hold(10, 0); e2.health = 400; hurtPlayer(e2, 200); assert.equal(e2.health, 350, 'hall 10\'s own');
  e2.health = 400; hurtPlayer(e2, 200); assert.equal(e2.health, 200);
  hold(10, 0); e2.health = 400; hurtPlayer(e2, 200); assert.equal(e2.health, 200, 'no door yet in hall 10');
  hold(11, 0, false); e2.health = 400; hurtPlayer(e2, 200); assert.equal(e2.health, 350);
  hold(11, 0, true); e2.health = 400; hurtPlayer(e2, 200); assert.equal(e2.health, 200, 'a Cry rising mid-hall (its holder recalled) is no door');
  spireHolderStep(e2, null); _resetSpireVestigesForTests();
});

// ── BLADESTORM ───────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS BLADESTORM, THE RELAY\'S HALF (section 15, Blade\'s capstone: "every fifth melee blow strikes every foe within 3 m (relay host hits)"): resonating in Blade, my fifth landed melee blow - and my tenth - strikes every other foe within 3 m of where I struck from as it landed on its target, an add as a splash strikes it, a lord by its own weight with its threat; past 3 m, an arrow, or two of Blade: nothing, the count unmoved (mutants: the fifth; the reach; the storm about the target; an arrow counted; the resonance unread; a lord struck past its weight; the count kept without resonance)', () => {
  const S = court();
  const me = S.B.mem['acct-0'];
  me.vs = [[vId('searing'), 1], [vId('momentum'), 1], [vId('bloodied'), 1]];
  const [A, X, Y, Z, P] = adds(S, [[0, 42.5], [2.5, 41], [0, 38.2], [3.05, 41], [0, 45.4]]);
  // a ward, a friend (a Battlemage's Ghost) and a hidden body within reach are never struck, nor an errand's object (a rift)
  const flagged = adds(S, [[-2, 41], [-1.5, 42], [-2, 40]]);
  [EG_FL.ward, EG_FL.friend, EG_FL.hidden].forEach((f, j) => egSetFl(S.B.F, flagged[j], f, true, []));
  const [rift] = egRaise(S.B.F, EG_ROLE.obj, EG_OBJ.rift, [[1.5, 40]], 300, S.now(), [], { r: 1.3 });
  rift.t = 'rift';
  const hp = () => [A, X, Y, Z, P].map((b) => b.hp);
  const rows = [];
  for (let k = 1; k <= 10; k++) { blow(S, 'acct-0', A.i, 20, HIT_KINDS.Melee, [0, 41]); if (k === 2) blow(S, 'acct-0', A.i, 20, HIT_KINDS.Shaft, [0, 41]); rows.push(hp()); }
  assert.deepEqual([...flagged.map((b) => b.hp), rift.hp], [500, 500, 500, 300], 'a ward, a friend, a hidden body and a rift: untouched');
  assert.deepEqual(rows.map((r) => r.slice(1)), [
    [500, 500, 500, 500], [500, 500, 500, 500], [500, 500, 500, 500], [500, 500, 500, 500], [480, 480, 500, 500],
    [480, 480, 500, 500], [480, 480, 500, 500], [480, 480, 500, 500], [480, 480, 500, 500], [460, 460, 500, 500],
  ], 'the fifth and the tenth melee blow (the arrow between counted nothing): 2.5 and 2.8 m struck, 3.05 m and the add beside the target 4.4 m off me not');
  assert.deepEqual([A.hp, me.storm], [500 - 11 * 20, 10]);
  // two of Blade: nothing, nothing counted
  const T = court();
  T.B.mem['acct-0'].vs = [[vId('searing'), 1], [vId('momentum'), 1]];
  const [A2, X2] = adds(T, [[0, 42.5], [2.5, 41]]);
  for (let k = 0; k < 5; k++) blow(T, 'acct-0', A2.i, 20, HIT_KINDS.Melee, [0, 41]);
  assert.deepEqual([X2.hp, T.B.mem['acct-0'].storm], [500, undefined], 'no resonance: no storm, no count');
  // a lord within 3 m: struck by its own weight (under Unyielding, x0.85), its threat with it
  const L = court({ 'acct-0': [15.32, 70.99], 'acct-1': [-6, 41], 'acct-2': [-6, 46] }, [[EG_DECREE_BY_KEY.unyielding.id, 1]]);
  L.B.mem['acct-0'].vs = [[vId('searing'), 1], [vId('culling'), 1], [vId('sweeping'), 1], [vId('oath'), 1]];   // the Oath: threat x1.5
  const lord = egLordsOf(L.B.F)[0], [A3] = adds(L, [[15.32, 72.6]]);
  egLordsWake(L.B.F, L.spec, L.now(), [], { n: 3 });   // PIN MOVED (AUDIT EG IV, lane1 #3): a lord asleep takes no blow - Grath woken (his kit's own wake) where he stands; before, he was struck asleep
  assert.ok(near(Math.hypot(...egBodyAt(lord, L.now()).map((v, j) => v - [15.32, 70.99][j])), 2, 1e-6), 'the lord 2 m off me');
  for (let k = 0; k < 4; k++) blow(L, 'acct-0', A3.i, 20, HIT_KINDS.Melee, [15.32, 70.99]);
  const hp0 = lord.hp, th0 = lord.threat['acct-0'] ?? 0, w = egLordHitX(L.B.F, lord, 'acct-0', { x: 15.32, z: 70.99 }, HIT_KINDS.Melee, L.now());
  blow(L, 'acct-0', A3.i, 20, HIT_KINDS.Melee, [15.32, 70.99]);
  assert.ok(w > 0 && w < 1 && near(hp0 - lord.hp, 20 * w, 1e-6), `the lord takes the blow by its own weight (${hp0 - lord.hp} of ${20 * w})`);
  assert.equal(egThreatX(L.B.mem['acct-0']), 1.5);
  assert.ok(near((lord.threat['acct-0'] ?? 0) - th0, 20 * w * 1.5, 1e-6), 'and its threat, the Oath\'s with it');
});

// ── DEADEYE ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS DEADEYE, THE RELAY\'S HALF (section 15, Hunt\'s capstone: "an arrow from beyond 12 m pierces the add behind its target"): resonating in Hunt, my arrow from beyond 12 m strikes the first add its line meets past its target as it landed - not one before the target, not one off the line, not the second behind; from 12 m or nearer, a spell or a swing, or two of Hunt: nothing (mutants: the reach; the line\'s width; behind read as before; the second pierced; a spell piercing; the resonance unread)', () => {
  const S = court({ 'acct-0': [0, 30.4], 'acct-1': [-6, 41], 'acct-2': [-6, 46] });
  const me = S.B.mem['acct-0'];
  me.vs = [[vId('featherstep'), 1], [vId('fade'), 1], [vId('fleetfoot'), 1]];
  const [A, Bk, C2, D, E] = adds(S, [[0, 43], [0, 46], [0, 49], [0.7, 44.5], [0, 38]]);
  // a ward, a friend and a hidden body on the line between the target and the add behind are never the one pierced
  const flagged = adds(S, [[0, 44], [0, 44.6], [0, 45.2]]);
  [EG_FL.ward, EG_FL.friend, EG_FL.hidden].forEach((f, j) => egSetFl(S.B.F, flagged[j], f, true, []));
  const hp = () => [A, Bk, C2, D, E].map((b) => b.hp);
  assert.equal(egBehind(S.B.F, A, { x: 0, z: 30.4 }, S.now()), Bk, 'the line\'s first add past the target');
  blow(S, 'acct-0', A.i, 30, HIT_KINDS.Shaft, [0, 30.4]);
  assert.deepEqual(hp(), [470, 470, 500, 500, 500], '12.6 m: the add behind pierced, the second behind, the one off the line and the one before the target untouched');
  assert.deepEqual(flagged.map((b) => b.hp), [500, 500, 500], 'the ward, the friend and the hidden body passed through');
  blow(S, 'acct-0', A.i, 30, HIT_KINDS.Spell, [0, 30.4]);
  assert.deepEqual(hp(), [440, 470, 500, 500, 500], 'a spell pierces nothing');
  blow(S, 'acct-0', A.i, 30, HIT_KINDS.Shaft, [0, 31]);
  assert.deepEqual(hp(), [410, 470, 500, 500, 500], '12 m: not beyond it');
  assert.equal(EG_FAR_M, 12);
  me.vs = [[vId('featherstep'), 1], [vId('fade'), 1]];
  blow(S, 'acct-0', A.i, 30, HIT_KINDS.Shaft, [0, 30.4]);
  assert.deepEqual(hp(), [380, 470, 500, 500, 500], 'two of Hunt: no Deadeye');
  D.x = 0.55; D.z = 44.5;
  assert.equal(egBehind(S.B.F, A, { x: 0, z: 30.4 }, S.now()), D, 'within its own radius of the line, nearer than the one behind: the first met');
  // Long Sight reads the same "beyond 12 m" (EG_FAR_M, its literal retired)
  me.vs = [[vId('longsight'), 1]];
  let h = A.hp;
  blow(S, 'acct-0', A.i, 30, HIT_KINDS.Shaft, [0, 30.4]);
  assert.ok(near(h - A.hp, 30 * 1.08), `Long Sight I from 12.6 m (${h - A.hp})`);
  h = A.hp;
  blow(S, 'acct-0', A.i, 30, HIT_KINDS.Shaft, [0, 31]);
  assert.ok(near(h - A.hp, 30), 'from 12 m: none');
});

// ── STONESKIN COUNTED ────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS STONESKIN IN THE CENSUS\'S COUNT (section 15; EG-ZR\'s open issue for EG14, closed): a holder\'s count is a share of its whole body, Stoneskin\'s cushion in it, as its screen\'s maximum is - every share the room takes (a blow\'s, the void\'s, the toll\'s, the lash\'s) of the body without the cushion comes off it over 1 + its rank\'s share; so with the body enforced a Stoneskin III holder stands three 0.4 blows and falls at the fourth, as its 1250 do (400 a blow), where a plain body and Stoneskin I fall at the third; its own word of its body, as its screen says it, claims no mend; the void\'s floor is a quarter of the body without the cushion; an ally\'s heal is a share of the whole (mutants: the count\'s whole unwidened; the rank\'s share; the void\'s floor of the whole; the toll or the lash of the whole; an ally\'s heal of the plain body)', () => {
  assert.deepEqual([egCountWhole([]), egCountWhole([[vId('stoneskin'), 1]]), egCountWhole([[vId('stoneskin'), 3]])], [1, 1.1, 1.25]);
  const run = (vs) => {
    const S = court({ 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] }), { B } = S, me = 'acct-0';
    B.mem[me].vs = vs;
    const fell = [];
    for (let k = 1; k <= 4 && B.mem[me].alive; k++) {
      const at = S.tick(10_000), out = [];
      B.F.blows.length = 0;
      assert.ok(egAim(B.F, S.spec, { o: 0, s: [shDisc(0, 41, 2)], at, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], at - 1500, out));
      const o = egCount(B, at + 900, [{ sub: me, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => [t, 0, 0, 41, B.h]) }], LINE, true);
      if (o.some((f) => f.k === 'bd' && f.to === me)) fell.push(k);
    }
    return { fell, v: B.mem[me].bd?.v, S };
  };
  assert.deepEqual(run([]).fell, [3], 'a plain body: the third');
  assert.deepEqual(run([[vId('stoneskin'), 1]]).fell, [3], 'Stoneskin I (1100 - three blows are 1200): the third');
  const III = run([[vId('stoneskin'), 3]]);
  assert.deepEqual(III.fell, [4], 'Stoneskin III (1250 - three are 1200): the fourth');
  // the screen's own arithmetic: a 0.4 blow takes 400 of the 1250 a holder's live maximum holds
  const e = body(1000);
  spireHolderStep(e, { vs: [[vId('stoneskin'), 3]], mast: -1, b: '0123456789abcdef', h: 5 });
  assert.deepEqual([e.maxHealth, strikeDamage(0.4, spireBodyMax(e), 0)], [1250, 400]);
  spireHolderStep(e, null); _resetSpireVestigesForTests();
  // three blows on a holder: its count is its screen's 50 of 1250, and its word claims nothing
  const S = court(), { B } = S, me = 'acct-0';
  B.mem[me].vs = [[vId('stoneskin'), 3]];
  for (let k = 1; k <= 3; k++) {
    const at = S.tick(10_000);
    B.F.blows.length = 0;
    egAim(B.F, S.spec, { o: 0, s: [shDisc(0, 41, 2)], at, wu: 1500, p: 0.4, b: 0, el: null, nm: 'Test Blow' }, [], at - 1500, []);
    egCount(B, at + 900, [{ sub: me, tr: [at - 1200, at - 800, at - 400, at + 100].map((t) => [t, 0, 0, 41, B.h]) }], LINE, true);
    assert.ok(near(B.mem[me].bd.v * 1250, 1250 - 400 * k, 1e-6), `blow ${k}: the count is the screen's ${1250 - 400 * k} of 1250 (${B.mem[me].bd.v})`);
    egBodyWord(B, me, Math.round(((1250 - 400 * k) / 1250) * 1000), S.now(), LINE);
    assert.ok(B.mem[me].bd.h < 1e-9, `its word claims no mend (${B.mem[me].bd.h})`);
  }
  assert.deepEqual(B.mem[me].cs, [3, 0, 0, 1200], 'the census\'s thousandths are the plain body\'s');
  // the void, the toll and the lash: shares of the plain body off the whole
  const V = court(), m = V.B.mem['acct-0'];
  m.vs = [[vId('stoneskin'), 3]];
  const tr = () => [{ sub: 'acct-0', tr: [[V.now() - 100, 0, 0, 41, 5]] }];
  m.cbOwe = 1; egCount(V.B, V.tick(10), tr(), LINE, true);
  assert.ok(near(m.bd.v, 0.92), `the void's tenth off the whole: 1150 of 1250 (${m.bd.v})`);
  m.bd.v = 0.24; m.cbOwe = 1; egCount(V.B, V.tick(10), tr(), LINE, true);
  assert.ok(near(m.bd.v, 0.2), `at 300 of 1250 the void takes 50, to the floor's 250 of the plain 1000 (${m.bd.v})`);
  assert.deepEqual(m.cs.slice(2), [2, 150]);
  m.bd.v = 1; egCountHeals(V.B, [{ k: 'toll', to: 'acct-0', q: 2 }], V.now(), LINE);
  assert.ok(near(m.bd.v, 0.92), `the toll's two quarters' tenth of the plain 1000, off 1250 (${m.bd.v})`);
  egCountHeals(V.B, [{ k: 'eheal', p: -0.05, why: 'lash' }], V.now(), LINE);
  assert.ok(near(m.bd.v, 0.88), `the lash's twentieth of 1000, off 1250 (${m.bd.v})`);
  m.bd.v = 0.05; egCountHeals(V.B, [{ k: 'toll', to: 'acct-0', q: 2 }], V.now(), LINE);
  assert.ok(near(m.bd.v, 0.01 / 1.25), `at 62.5 of 1250 the toll leaves a hundredth of the plain body (${m.bd.v})`);
  // an ally's heal believed: its points over the reference body, over the whole
  m.bd.v = 0.5; m.lowAt = -Infinity;
  const got = egHeal(V.B, 'acct-0', [['acct-1', 100]], V.now(), LINE, undefined, () => true);   // PIN MOVED (AUDIT EG V, d: lane4 L4-7 - the count is mended, and Lifeline opened, only by a heal a relayed cast backs): the healer's cast seen
  assert.ok(got > 0 && near(m.bd.v, 0.5 + got / healRef(40) / 1.25, 1e-9), `an ally's ${got} healed of the whole (${m.bd.v})`);
});

// ── THE MARKYNAZ'S CARD ──────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS THE MARKYNAZ\'S DECREE ON HIS CARD (section 8.5: "named on his card"; EG-ZQ\'s "Found, not changed"): a Proving Walk the Markynaz stands in names, on its arrival card, the decree the relay lays as it stands him at the wake - reckoned by the screen from the decrees the room says in force and the hall (egMarkynazDecree, no new word): under Vengeful II at seed 1\'s Hall 68, *The Grand Duke\'s Decree: Colossal*; under Colossal, Unyielding; a Deepway\'s champion\'s chamber names his too; bearing all four, a Kynreeve\'s Walk, a Court: nothing; the card\'s words say it, and the card\'s node draws it (mutants: the line unread off the decrees; the hall unread; the champion unread; the words dropped from the live line; the node unwritten)', () => {
  const D = (k) => EG_DECREE_BY_KEY[k].id;
  const cardOf = (S) => egArrivalCard(foldEg(EG_STATE_EMPTY, wire(egStateOf(S.B, S.now())), S.now()));
  const laid = (seed, h, dc) => {
    const S = breachAt(seed, h, { dc });
    const card = cardOf(S);
    S.wake();
    const M = egLordsOf(S.B.F)[0];
    assert.ok(M, `hall ${h} stands its champion`);
    return { card, decree: M.decree ?? null, champ: S.spec.champ };
  };
  const a = laid(1, 68, [[D('vengeful'), 2]]);
  assert.deepEqual([a.champ, a.card.lays, a.decree], ['markynaz', "The Grand Duke's Decree: Colossal", 'colossal'], 'the card names what the relay laid');
  const b = laid(1, 68, [[D('colossal'), 1]]);
  assert.deepEqual([b.card.lays, b.decree], ["The Grand Duke's Decree: Unyielding", 'unyielding']);
  const c = laid(1, 73, []);
  assert.deepEqual([c.card.lays, c.decree], ["The Grand Duke's Decree: Unyielding", 'unyielding'], 'Hall 73\'s own');
  const d = laid(2, 62, []);
  assert.deepEqual([egHallOf(2, 62, 0).kind, d.card.lays, d.decree], ['deepway', "The Grand Duke's Decree: Vengeful", 'vengeful'], 'a Deepway\'s champion\'s chamber');
  const all = laid(1, 68, [[D('colossal'), 1], [D('unyielding'), 1], [D('vengeful'), 1], [D('grudge'), 1]]);
  assert.deepEqual([all.card.lays, all.decree], ['', null], 'all four borne: none, and none named');
  assert.equal(laid(1, 3, []).card.lays, '', 'a Kynreeve names none');
  const court5 = breachAt(12345, 5);
  assert.equal(cardOf(court5).lays, '', 'a Court\'s card has none');
  assert.equal(egMarkynazLine({ dc: [] }, { champ: 'kynmarcher' }), '');
  // the words and the node
  assert.equal(egArrivalLive(a.card), `${a.card.main}. ${a.card.sub} The Grand Duke's Decree: Colossal.`);
  assert.equal(egArrivalLive(c.card.lays ? { ...c.card, lays: '' } : c.card), `${c.card.main}. ${c.card.sub}`);
  const cl = readFileSync(new URL('../../../src/scenes/eliteGates/egClient.js', import.meta.url), 'utf8');
  assert.match(cl, /if \(pres\.card\) pres\.live = egArrivalLive\(pres\.card\);/, 'the screen reader hears the card\'s words whole');
  const doc = fakeDocument();
  destroyEgSpireHud();
  drawEgArrivalCard(egArrivalShown(a.card, 1000, 2000), { doc });
  assert.equal(one(doc.body, 'eg-card-lays').textContent, "The Grand Duke's Decree: Colossal", 'the card draws it');
  destroyEgSpireHud();
});

// ── THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test('EG-ZS THE PAGE (bible/11-Multiplayer/Elite-Gates.md - RETIRING A FLAG DELETES THE SENTENCE): EG-ZR\'s "Found, not built here" list and its departure on Stoneskin in the census (it did not widen a holder\'s count) are gone, its departures numbered without a gap; EG-ZQ\'s "Found, not changed" (the Markynaz\'s decree not named) is gone; this slice\'s record follows EG-ZR, its four hosts named', () => {
  const page = readFileSync(new URL('../../../bible/11-Multiplayer/Elite-Gates.md', import.meta.url), 'utf8');
  const q = page.indexOf('### EG-ZQ - '), r = page.indexOf('### EG-ZR - '), s = page.indexOf('### EG-ZS - ');
  assert.ok(q > 0 && r > q && s > r, 'EG-ZS after EG-ZR');
  const zq = page.slice(q, r), zr = page.slice(r, s), zs = page.slice(s);
  for (const gone of ['The Markynaz\'s decree is not named on his card', 'FLAGGED to the screen (`scenes/eliteGates/egClient.js`']) assert.ok(!zq.includes(gone), `EG-ZQ retired: ${gone}`);
  for (const gone of ['Found, not built here:**', 'The census does not widen a Stoneskin holder\'s count', 'the capstones\' client halves: Rooted', 'the relay\'s Bladestorm and Deadeye', 'Only Far Watch, No Quarter and now']) assert.ok(!zr.includes(gone), `EG-ZR retired: ${gone}`);
  const deps = zr.slice(zr.indexOf('**Departures, said plainly.**'), zr.indexOf('**Not verified'));
  const nums = [...deps.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepEqual(nums, nums.map((_, i) => i + 1), 'EG-ZR\'s departures without a gap');
  for (const host of ['scenes/world.js', 'scenes/worldModes.js', 'scenes/dungeonContext.js', 'scenes/exterior.js']) assert.ok(zs.includes(`\`src/${host}\` - `), `the four hosts: ${host}`);
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
const one = (n, cls) => find(n, cls)[0] ?? null;
