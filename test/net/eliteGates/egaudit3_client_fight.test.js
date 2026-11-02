// AUDIT EG III (2026-10-13; bible/11-Multiplayer/Elite-Gates.md sections 13.3, 13.4 and 25.5 - lane1 #4 and #12, their
// SCREEN halves; lane4 #2): THE SOUL CAIRN'S LAWS ON THE STRUCK SCREEN, AND THE COURT'S CARD. The Twins' Touched - "a member
// struck by Vael is Fire-touched for 12 s. They ... take +25% from Vael. The reverse holds for Isk." - on the member's own
// screen as it judges a blow (scenes/eliteGates/egFight.js egTouchedX), and its sigil on the HUD off the mark the relay sends;
// Morvayn's Chaining - "a blow on one is shared with the other" - split over a chain on each chained member's screen
// (egChainMates); and the Burning Court's title card left alone by a breach's fight that holds nothing (lane4 #2). Every
// fixture the producers': the breach and its Court from the director (egBreachNew, egEnter, egStep - the Twins and
// Morvayn stood and woken by their own kits, Morvayn's soul-chains bound by its own tick), each blow egAim's, each mark
// egMark's, the whole fight egFightState's, all through the wire into the link's fold; the screen createEgFight.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validEgOut } from '../../../src/net/wire.js';
import { egHallOf, EG_SEALED_MS } from '../../../src/net/eliteGates/egLaw.js';
import { egBreachNew, egEnter, egStep } from '../../../src/net/eliteGates/egBrain.js';
import { egBodiesOf, egAim, egFightState, egMark, EG_ROLE } from '../../../src/net/eliteGates/egBodies.js';
import { EG_BOSS_KEYS } from '../../../src/net/eliteGates/egLords.js';
import { shDisc } from '../../../src/net/eliteGates/egShape.js';
import { foldEg, EG_STATE_EMPTY } from '../../../src/net/eliteGates/egLink.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight, egTouchedX, egChainMates } from '../../../src/scenes/eliteGates/egFight.js';
import { EG_TOUCH_X } from '../../../src/net/eliteGates/egLords.js';   // the Touched weight's one home (the lords' group's - the relay's dealt half and this taken half)
import { egSpireHudModel } from '../../../src/ui/eliteGates/egSpireHud.js';
import { drawGateTitleCard, titleCardModel, destroyGateTitleCard } from '../../../src/ui/gate/gateTitleCard.js';

const T0 = 1_800_000_000_000, SEED = 12345;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

/** A breach of `n` (seed 12345) in Court hall `h`'s trial, its lord(s) woken by the director - and the fight's words said
 *  meanwhile (the says the screen's wake reads), `steps` more of the director's beats with the company at its places. */
function court(h, n = 4, steps = 0, hook = null) {
  let s = 7;
  const rng = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew: 0, rh: 0, seed: SEED, op: T0, co, site: SITE, wg: [] });
  let now = T0 + EG_SEALED_MS + 100;
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, now);
  const spec = egHallOf(SEED, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const said = [];
  const beat = () => { now += 250; hook?.(B); for (const o of egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng)) if (o.k === 'esay') said.push(o); };
  for (let k = 0; k < 60 && B.sg !== 'trial'; k++) beat();
  assert.equal(B.sg, 'trial', 'the Court woke');
  // the company steps into the wake ring, two by two (a pair a metre apart, the pairs twelve apart)
  co.forEach(([sub], i) => { pos[sub] = { sx: spec.x0 + spec.ring.x + (i % 2) * 1 + (i >= 2 ? 6 : -6), z: spec.ring.z }; });
  for (let k = 0; k < steps; k++) beat();
  return { B, spec, subs: co.map(([sub]) => sub), t: now, said, pos };
}
/** The fight as my screen holds it at `t` (the director's whole fight and its words, through the wire). */
function held(C, t, extra = []) {
  let E = foldEg(EG_STATE_EMPTY, wire({ k: 'st', ...stateOf(C) }), t);
  E = foldEg(E, wire(egFightState(C.B.F, t)), t);
  for (const f of [...C.said, ...extra]) E = foldEg(E, wire(f), t);
  return E;
}
import { egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(12345, [1, 6, 10]);
});
const stateOf = (C) => { const { k: _k, ...rest } = egStateOf(C.B, C.t); return rest; };

/** My screen judging one blow aimed at the hall's (x, z) with radius `r` - me `acct-0` at my place, each companion where
 *  `pts` stands it (the hall's frame) - over a body of 1000: the points struck. */
function struckBy(C, { o, at = (C.t += 10_000), x, z, r = 1.5, p = 0.4, pts }) {
  const { B, spec, subs } = C, me = subs[0];
  B.F.blows.length = 0;
  const out = [];
  assert.ok(egAim(B.F, spec, { o, s: [shDisc(x, z, r)], at, wu: 1500, p, b: 0, el: null, nm: 'Test Blow' }, [], at - 1500, out), 'the blow said');
  let E = held(C, at - 1500, out);
  let t = at - 1300;
  const struck = [], entity = { health: 1000, maxHealth: 1000 };
  const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, player: () => entity, me: () => me, strike: (d) => struck.push(d),
    feet: () => realmToDungeon(spec.x0 + pts[me][0], 0, pts[me][1]),
    peerAt: (sub) => (pts[sub] ? realmToDungeon(spec.x0 + pts[sub][0], 1.6, pts[sub][1]) : null) });   // a companion's pose stands at its eye
  for (; t < at; t += 100) fight.frame();
  t = at; fight.frame();
  t = at + 500; fight.frame();
  E = null;
  return struck.reduce((a, b) => a + b, 0);
}

test('AUDIT EG III lane1 #4 THE TWINS\' TOUCHED ON THE STRUCK SCREEN (section 13.3): a blow of Vael\'s lands on the Fire-touched at EG_TOUCH_X, one of Isk\'s on the Frost-touched; the other twin\'s, a lapsed mark, another member\'s mark and any other body\'s blow land as they are - and the mark the relay sends stands on my HUD as its sigil, a flame or a snowflake (mutants: the weight unapplied; the twins crossed; a lapsed mark weighed; another\'s mark read)', () => {
  const C = court(30, 4);
  const lords = egBodiesOf(C.B.F, EG_ROLE.lord);
  const vael = lords.find((L) => L.pt === 0), isk = lords.find((L) => L.pt === 1);
  assert.ok(vael && isk && EG_BOSS_KEYS[vael.k] === 'twins', 'the Twins stand');
  const me = C.subs[0], f = C.spec.fight, pts = { [me]: [f.x, f.z] };
  const hit = (o) => struckBy(C, { o, x: f.x, z: f.z, pts });
  assert.equal(hit(vael.i), 400, 'unmarked: as it is');
  egMark(C.B.F, me, 2, C.t + 60_000);   // Fire-touched (the relay's mark - net/eliteGates/egBodies.js egMark)
  assert.equal(EG_TOUCH_X, 1.25);
  assert.equal(hit(vael.i), 500, 'Vael on the Fire-touched: +25%');
  assert.equal(hit(isk.i), 400, 'Isk on the Fire-touched: as it is');
  egMark(C.B.F, me, 2, C.t - 1);   // lapsed
  assert.equal(hit(vael.i), 400, 'a lapsed mark weighs nothing');
  egMark(C.B.F, me, 3, C.t + 60_000);   // Frost-touched
  assert.equal(hit(isk.i), 500, 'Isk on the Frost-touched: +25%');
  assert.equal(hit(vael.i), 400);
  egMark(C.B.F, me, 3, C.t - 1);
  egMark(C.B.F, C.subs[1], 2, C.t + 60_000);
  assert.equal(hit(vael.i), 400, 'another\'s mark is not mine');
  // the law itself
  const F = { bodies: [{ i: 1, role: EG_ROLE.lord, k: vael.k, pt: 0 }, { i: 2, role: EG_ROLE.add, k: 0 }], mk: [[me, 2, 5000, 0]] };
  assert.equal(egTouchedX(F, { o: 1 }, me, 4000), EG_TOUCH_X);
  assert.equal(egTouchedX(F, { o: 1 }, me, 5000), 1, 'its until is the last instant not');
  assert.equal(egTouchedX(F, { o: 2 }, me, 4000), 1, 'an add\'s blow');
  assert.equal(egTouchedX(F, {}, me, 4000), 1, 'the place\'s');
  assert.equal(egTouchedX(F, { o: 1 }, null, 4000), 1);
  // the HUD's sigil off the relay's mark
  egMark(C.B.F, me, 2, C.t + 12_000);
  egMark(C.B.F, me, 3, C.t + 6_000);
  const E = held(C, C.t);
  const model = egSpireHudModel(E, me, C.t, { ff: 'desktop' });
  const marks = JSON.stringify(model);
  assert.ok(marks.includes('"sigil":"flame"') && marks.includes('"sigil":"flake"'), 'a flame and a snowflake on my HUD');
});

test('AUDIT EG III lane1 #12 MORVAYN\'S CHAINING, "A BLOW ON ONE IS SHARED WITH THE OTHER" (section 13.4), ON EACH CHAINED SCREEN: the soul-chains Morvayn\'s own tick binds split a blow on any of a chain evenly over it - mine alone half, my mate\'s alone half at their feet where my screen draws them, both the whole; a member of another chain, a Wraith an odd member is chained to, or no chain shares nothing (mutants: the share unsplit; the mate\'s blow unjudged; a Wraith read as a mate; another chain read)', () => {
  // EG-PERFECT (PIN MOVED): the Chaining is Morvayn's second phase's - turned at 0.66 as he wakes, its chains bound ten seconds on
  const C = court(50, 4, 40, (B) => { for (const L of B.F ? egBodiesOf(B.F, EG_ROLE.lord) : []) if (L.up2 && L.ph < 2) L.hp = L.max * 0.6; });
  const L = egBodiesOf(C.B.F, EG_ROLE.lord)[0];
  assert.equal(EG_BOSS_KEYS[L.k], 'morvayn');
  const chains = C.B.F.tethers.filter((t) => t[2] === 2);
  assert.ok(chains.length >= 2, `the soul-chains bound: ${JSON.stringify(chains)}`);
  const me = C.subs[0], mates = egChainMates(C.B.F.tethers, me);
  assert.equal(mates.length, 1, 'a pair at four');
  const mate = mates[0], other = C.subs.find((s) => s !== me && s !== mate);
  const f = C.spec.fight;
  const pts = { [me]: [f.x - 8, f.z], [mate]: [f.x + 8, f.z], [other]: [f.x, f.z + 8] };
  const at = (who) => ({ x: pts[who][0], z: pts[who][1] });
  assert.equal(struckBy(C, { o: L.i, ...at(me), pts }), 200, 'on me alone: half');
  assert.equal(struckBy(C, { o: L.i, ...at(mate), pts }), 200, 'on my mate alone: my half');
  assert.equal(struckBy(C, { o: L.i, x: f.x, z: f.z, r: 9, pts: { ...pts, [other]: [f.x, f.z + 20] } }), 400, 'on both: the whole');
  assert.equal(struckBy(C, { o: L.i, ...at(other), pts }), 0, 'another chain\'s: nothing of mine');
  // the law itself
  assert.deepEqual(egChainMates([['a', 'b', 2, 800], ['a', 'c', 2, 800]], 'b').sort(), ['a', 'c'], 'a chain of three: every link reached');
  assert.deepEqual(egChainMates([[17, 'a', 2, 800]], 'a'), [], 'a Wraith shares nothing');
  assert.deepEqual(egChainMates([['a', 'b', 1, 800]], 'a'), [], 'a Blood Tether is no chain');
  assert.deepEqual(egChainMates([['c', 'd', 2, 800]], 'a'), [], 'another chain');
  assert.deepEqual(egChainMates(null, 'a'), []);
});

test('AUDIT EG III lane4 #2 THE BURNING COURT\'S TITLE CARD SURVIVES A BREACH\'S FIGHT THAT HOLDS NOTHING: out of the Spire the breach client asks its fight to leave every frame - after a session\'s first breach that leave touches nothing, so the Court\'s card (drawn first in the frame) stands; a fight that drew its own card (a lord\'s wake) puts it away once as it leaves (mutants: the leave unguarded; the card hidden though not the fight\'s; the fight\'s own card left standing)', () => {
  const made = [];
  const node = () => { const n = { style: {}, className: '', textContent: '', children: [], append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, setAttribute() {}, remove() {} }; made.push(n); return n; };
  const was = globalThis.document;
  globalThis.document = /** @type {any} */ ({ createElement: () => node(), head: node(), body: node(), getElementById: () => null, querySelector: () => null });
  destroyGateTitleCard();
  try {
    const card = () => made.find((n) => typeof n.className === 'string' && n.className.includes('wb-title-card'));
    // a breach's fight that woke a lord: its card, put away once at its leave
    const C = court(30, 4, 20);   // the Twins woken by the company in their ring
    assert.ok(C.said.some((w) => w.w === 'wake'), 'the wake said');
    let t = C.t;
    const E = held(C, t);
    const fight = createEgFight({ link: { state: () => E, now: () => t }, now: () => t, me: () => C.subs[0] });
    fight.frame();
    assert.equal(card()?.style.display, '', 'the Twins\' wake on the card');
    fight.leave();
    assert.equal(card().style.display, 'none', 'put away as the fight leaves');
    // the Court's card, drawn first in the frame, then the breach client's leave every frame out of the Spire
    t += 60_000;
    drawGateTitleCard(titleCardModel({ kind: 'wake', at: t - 100, until: t + 2600, kicker: 'Mehrunes Dagon', main: 'THE PRINCE', sub: '' }, t), {});
    assert.equal(card().style.display, '');
    for (let k = 0; k < 5; k++) fight.leave();
    assert.equal(card().style.display, '', 'the Court\'s card stands');
    const fresh = createEgFight({ link: { state: () => EG_STATE_EMPTY, now: () => t }, now: () => t });
    fresh.leave();
    assert.equal(card().style.display, '', 'a fight that never stood touches nothing');
    // a fight standing in a hall with no card of its own (a span: no lord) neither draws over the card nor puts it away
    const S = court(30, 4);
    S.B.h = 2;
    const E2 = held(S, t);
    const plain = createEgFight({ link: { state: () => E2, now: () => t }, now: () => t, me: () => S.subs[0] });
    plain.frame();
    assert.equal(card().style.display, '', 'its frame draws no card over the one standing');
    plain.leave();
    assert.equal(card().style.display, '', 'its leave puts away no card it did not draw');
  } finally { destroyGateTitleCard(); globalThis.document = was; }
});
