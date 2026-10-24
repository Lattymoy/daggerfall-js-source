// AUDIT EG IV (2026-10-13, the Elite Gates arc's fourth audit; bible/11-Multiplayer/Elite-Gates.md sections 15, 17.1, 18 and 21;
// the legion group's findings): THE RUN AS WRITTEN - an offer of six refusing a seventh card and a reroll keeping its own law
// (The Hollow Offer's two, the bequest, the shards' card); no card that cannot act for its member; three shards' card a rank of
// the member's own; the Wellhead's strata as section 18 builds them (the season's order, a deeper start's strata, the Mingled
// Legion's waves, the Twin Court's second of another band, the Old Masters and THE MASTERS' GROUND, the Molten Rim a Court's);
// Spotter a verb whose mark joins a Hunter's Mark; Rallying Cry at a Court's phase turn, the relay's word and the screen's
// Second Wind; and the pages that say so. Every fixture is the producers' own: the breach from the director (egBreachNew,
// egEnter, egStep, egBlow), its offers and Surplus (egOffers, egSurplus), the legion from egLegionRaise and egLegionStep, the
// screen from scenes/eliteGates/egClient.js.
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { egHallOf, egCircleOfHall, egStartHall, EG_SEALED_MS, EG_LORDS } from '../../../src/net/eliteGates/egLaw.js';
import * as Brain from '../../../src/net/eliteGates/egBrain.js';
import { egBreachNew, egEnter, egStep, egBlow, egStateOf } from '../../../src/net/eliteGates/egBrain.js';
import * as Run from '../../../src/net/eliteGates/egRun.js';
import { egOffers, egSurplus, egPick, egMarkFoe, EG_STRATA } from '../../../src/net/eliteGates/egRun.js';
import * as Vestige from '../../../src/net/eliteGates/egVestige.js';
import { egOfferOf, EG_V_BY_KEY, EG_VESTIGES, EG_MASTERIES, EG_M_ID, EG_OFFER_MAX, EG_CAPSTONES, EG_SHARDS_PER } from '../../../src/net/eliteGates/egVestige.js';
import { EG_ROLE, EG_FL, egFightNew, egFightState, egHas, egSetFl, egRaise } from '../../../src/net/eliteGates/egBodies.js';
import { EG_KIND, egLegionRaise, egLegionStep, egWaveKinds } from '../../../src/net/eliteGates/egLegion.js';
import { egLordsOf, egLordsWake, egObjsOf } from '../../../src/net/eliteGates/egLords.js';
import { HIT_KINDS } from '../../../src/net/gate/gateBrain.js';
import { arenaSeasonOf, ARENA_SEASON_EPOCH_S } from '../../../src/net/arena/arenaLaw.js';
import { validEgOut, validEgIn } from '../../../src/net/wire.js';
import { realmToDungeon } from '../../../src/net/superDungeon/sdBrain.js';
import { createEgFight } from '../../../src/scenes/eliteGates/egFight.js';
import { createEgClient } from '../../../src/scenes/eliteGates/egClient.js';
import * as Spire from '../../../src/systems/eliteGates/spireVestiges.js';
import { spireHolderStep, _resetSpireVestigesForTests } from '../../../src/systems/eliteGates/spireVestiges.js';
import { defineLiveMaxHealth } from '../../../src/systems/chargen.js';
import { hurtPlayer } from '../../../src/characters/playerEntity.js';
import { _resetPlayerHealForTests } from '../../../src/systems/playerHeal.js';
import { egGive8 } from '../../egGive8.mjs';

// PIN MOVED (THE ASCENT - THE ROOMS, LAW 9 - 2026-10-16): these pins were written on spec law 8's ground (its courses along +z
// from the plate, its courts and its lords where law 8 lays them) and stand on it still - the halls they read are law 8's,
// given as a breach of law 8's are given to a client (test/egGive8.mjs); LAW 9's own ground is test/net/eliteGates/law9_height.test.js's and
// test/net/eliteGates/law9_rooms.test.js's. Given before every test (a client that leaves its breach forgets them)
beforeEach(() => {
  egGive8(1, [3, 22, 23]);
  egGive8(12345, [1]);
});

const T0 = 1_800_000_000_000;
const SITE = { px: 1, py: 1, x: 0, y: 0, z: 0, yaw: 0 };
const seeded = (seed) => { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; }; };
const vId = (key) => EG_V_BY_KEY[key].id;
const keyOf = (card) => (card >= 100 ? EG_MASTERIES.find((M) => M.id === card)?.key : EG_VESTIGES[card]?.key);
const PAGE = 'bible/11-Multiplayer/Elite-Gates.md';

/** A breach of `n` admitted (seed `seed`, opened at `op`, started past Redoubt `ew`), at the wait. */
function opened({ seed = 12345, n = 3, op = T0, ew = 0 } = {}) {
  const co = Array.from({ length: n }, (_, i) => [`acct-${i}`, `M${i}`, i + 1]);
  const B = egBreachNew({ b: '0123456789abcdef', ez: 'z'.repeat(20), s: 'acct-0', o: 'M0', ew, rh: 0, seed, op, co, site: SITE, wg: [], pr: 'pyre' });
  for (const [sub] of co) egEnter(B, sub, `ord${sub}`.padEnd(20, 'x'), 40, op + EG_SEALED_MS + 100);
  return { B, co };
}
/** Breach `seed`'s hall `h` for a company of `n`, woken by the director (its strata `strata`, its tide `tide`, its members'
 *  Vestiges `vs`), the company stood at `at` and the legion its wake raised cleared: `step`, `blow`. */
function hall({ seed = 12345, h = 5, n = 3, strata = [], tide = null, vs = {}, at = null } = {}) {
  const rng = seeded(seed), { B, co } = opened({ seed, n });
  let now = T0 + EG_SEALED_MS + 100;
  B.strata = [...strata]; B.tide = tide;
  for (const [sub, v] of Object.entries(vs)) B.mem[sub].vs = v;
  const spec = egHallOf(seed, h, 0);
  B.h = h; B.sg = 'arrive'; B.wk = now; B.cnt = { left: 1_800_000, at: now }; B.pulledAt = now; B.su = now + 30_000;
  const pos = Object.fromEntries(co.map(([sub], i) => [sub, { sx: spec.x0 + spec.arrive.x + i * 0.5, z: spec.arrive.z }]));
  const frames = [];
  const step = (ms = 250) => { now += ms; const o = egStep(B, now, co.map(([sub]) => ({ sub, ...pos[sub], dead: false, at: now })), rng); frames.push(...o); return o; };
  for (let k = 0; k < 200 && B.sg !== 'trial'; k++) step();
  assert.equal(B.sg, 'trial', `hall ${h} woke`);
  const f = spec.fight ?? spec.fl?.[0] ?? { x: 0, z: 0 };
  const place = at ?? Object.fromEntries(co.map(([sub], i) => [sub, [f.x + i * 1.5, f.z + 1]]));
  for (const [sub, [x, z]] of Object.entries(place)) pos[sub] = { sx: spec.x0 + x, z };
  step();
  if (B.F) B.F.bodies = B.F.bodies.filter((b) => b.role !== EG_ROLE.add);
  let q = 1;
  const blow = (sub, i, d, r, xz = place[sub]) => { now += 300; return egBlow(B, sub, { k: 'hit', i, q: q++, d, r }, { sx: spec.x0 + xz[0], y: 0, z: xz[1] }, now); };
  return { B, spec, frames, step, blow, rng, place, now: () => now, tick: (ms) => (now += ms) };
}

// ── lane1 #13: THE SURPLUS ─────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV THE SURPLUS KEEPS THE OFFER\'S LAW (section 15: "an offer holds at most six cards"; section 18: The Hollow Offer, "two Vestige cards instead of three, one of them always a Mastery"): a fourth card asked of an offer of six is refused and the Surplus kept; under The Hollow Offer a reroll deals two cards again, one a Mastery, its bequest and its shards\' card with them (mutants: a seventh card; the Surplus spent on nothing; the reroll\'s own law forgotten)', () => {
  const { B } = opened({ n: 2 }), rng = seeded(5);
  B.sur = 2; B.strata = ['hollow'];
  const m = B.mem['acct-0'], o = B.mem['acct-1'];
  m.vs = [[vId('stoneskin'), 1]]; m.shards = EG_SHARDS_PER; m.kinds = [4, 4, 4];
  o.bequest = vId('rally');
  egOffers(B, 21, false, rng, T0);
  const kinds = (cards) => cards.map((c) => (c >= 100 ? 'M' : c === vId('rally') ? 'bequest' : c === vId('stoneskin') ? 'mine' : 'V'));
  assert.deepEqual(kinds(m.offer).sort(), ['M', 'V', 'bequest', 'mine'], 'one Vestige, one Mastery, the bequest, the shards\' rank');
  for (let k = 0; k < 6; k++) {
    egSurplus(B, 'acct-0', 'reroll', rng, 21, false);
    B.sur = 2;
    assert.deepEqual(kinds(m.offer).sort(), ['M', 'V', 'bequest', 'mine'], `reroll ${k}: the offer's own law`);
  }
  // six cards: a fourth refused, the Surplus kept
  m.offer = [0, 5, 10, 15, 20, 100];
  B.sur = 1;
  assert.equal(egSurplus(B, 'acct-0', 'card', rng, 21, false), null, 'refused');
  assert.equal(m.offer.length, EG_OFFER_MAX);
  assert.equal(B.sur, 1, 'the Surplus kept');
  m.offer = [0, 5, 10];
  assert.ok(egSurplus(B, 'acct-0', 'card', rng, 21, false), 'a fourth card');
  assert.deepEqual([m.offer.length, B.sur], [4, 0], 'and spent');
});

// ── lane10 #15: CARDS THAT ACT ─────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV AN OFFER SHOWS NO CARD THAT CANNOT ACT (section 15\'s cards that act): a company of one is never offered a Vestige that acts only through an ally, a company under four never Steadfast Line, and a member never one that reads a blow kind it has not landed in the breach (Searing Edge, Sweeping Arc and Counterstroke melee; Hunter\'s Mark and Spotter an arrow; Overcharge, Arcane Echo and Spillover a spell; Long Sight either) - each offered once it can act; Battlemage\'s Focus and Shieldweaver always; the director\'s offers read the living company and the member\'s landed kinds (mutants: the company unread; the kinds unread; Steadfast at three)', () => {
  const ally = ['bastion', 'standard', 'fallensdue', 'mender', 'lifeline'], melee = ['searing', 'sweeping', 'counterstroke'], arrow = ['huntersmark', 'spotter'], spell = ['overcharge', 'echo', 'spillover'];
  const seen = (o, draws = 1500) => { const s = new Set(), rng = seeded(o.seed ?? 9); for (let k = 0; k < draws; k++) for (const c of egOfferOf(rng, { vs: [], w: 3, valk: true, ...o })) s.add(keyOf(c)); return s; };
  const solo = seen({ n: 1, kinds: [9, 0, 0] });
  for (const k of [...ally, 'steadfast', ...arrow, ...spell, 'longsight']) assert.ok(!solo.has(k), `a melee soloist never offered ${k}`);
  for (const k of [...melee, 'focus', 'shieldweaver', 'rally', 'watchfire', 'immovable', 'spirebridge']) assert.ok(solo.has(k), `but ${k}`);
  const three = seen({ n: 3, kinds: [0, 5, 0] });
  assert.ok(!three.has('steadfast') && ally.every((k) => three.has(k)), 'three: the allies\' cards, never Steadfast Line');
  assert.ok(arrow.every((k) => three.has(k)) && three.has('longsight') && !three.has('searing') && !three.has('overcharge'), 'an archer: the arrow\'s cards');
  const four = seen({ n: 4, kinds: [1, 0, 2] });
  assert.ok(four.has('steadfast') && spell.every((k) => four.has(k)) && melee.every((k) => four.has(k)) && four.has('longsight') && !four.has('huntersmark'));
  assert.ok(seen({}).has('steadfast') && seen({}).has('huntersmark'), 'nothing known: nothing left out');
  // the director: a soloist who has only struck in melee
  for (let s = 1; s <= 40; s++) {
    const { B } = opened({ n: 1 }), m = B.mem['acct-0'];
    m.kinds = [7, 0, 0];
    egOffers(B, 3, false, seeded(s), T0);
    for (const c of m.offer) assert.ok(![...ally, 'steadfast', ...arrow, ...spell, 'longsight'].includes(keyOf(c)), `seed ${s}: ${keyOf(c)}`);
  }
  assert.equal(Vestige.egCardActs?.('steadfast', 3, null), false);
});

// ── lane10 #22: THE SHARDS' CARD ───────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV THREE SHARDS MAKE A RANK OF A HELD VESTIGE (sections 15 and 17.1): an offer to a member holding three shards carries one of its own Vestiges below III at its next rank and a second pick - taking it ranks it and spends the shards; holding none that can rank, a new fourth card instead (mutants: the held card left to chance; a held III offered)', () => {
  for (let s = 1; s <= 30; s++) {
    const { B } = opened({ n: 2 }), m = B.mem['acct-0'];
    m.vs = [[vId('stoneskin'), 1], [vId('rally'), 3]]; m.shards = EG_SHARDS_PER; m.kinds = [3, 3, 3];
    egOffers(B, 2, false, seeded(s), T0);
    assert.ok(m.offer.includes(vId('stoneskin')), `seed ${s}: its own Stoneskin to rank`);
    assert.ok(!m.offer.includes(vId('rally')), 'never one at III');
    assert.equal(m.offer.length, 4);
    assert.equal(m.picks, 2, 'a second pick');
  }
  const { B } = opened({ n: 2 }), m = B.mem['acct-0'];
  m.vs = [[vId('stoneskin'), 1]]; m.shards = EG_SHARDS_PER; m.kinds = [3, 3, 3];
  egOffers(B, 2, false, seeded(3), T0);
  assert.ok(egPick(B, 'acct-0', vId('stoneskin')));
  assert.deepEqual([m.vs, m.shards, m.picks], [[[vId('stoneskin'), 2]], 0, 1], 'ranked, the shards spent, a pick left');
  const { B: C } = opened({ n: 2 }), q = C.mem['acct-0'];
  q.vs = [[vId('stoneskin'), 3]]; q.shards = EG_SHARDS_PER; q.kinds = [3, 3, 3];
  egOffers(C, 2, false, seeded(3), T0);
  assert.equal(q.offer.length, 4, 'none to rank: a new fourth card');
  assert.ok(q.offer.every((c) => c !== vId('stoneskin')));
});

// ── lane10 #11, lane2 #3: THE SEASON'S STRATA ──────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV THE STRATA ARE THE SEASON\'S (section 18: "drawn without repeat each season from six"): an arena season draws the six in one order; every breach of the season - whatever its seed and dice - meets its first at Redoubt 20 and the next at every fifth, none twice, none past six; another season may order them otherwise; a breach that starts past Redoubt 30 begins with the first three, one that starts short of 20 with none (mutants: a stratum by the breach\'s dice; a deeper start shed; the order from the wrong season)', () => {
  const order = Run.egSeasonStrata?.(arenaSeasonOf(T0 / 1000));
  assert.ok(Array.isArray(order), 'the season\'s order');
  assert.deepEqual([arenaSeasonOf(T0 / 1000), order], [2, ['kynchampions', 'moltenrim', 'oldmasters', 'twincourt', 'hollow', 'mingled']], 'season 2\'s, the law\'s own shuffle');
  assert.deepEqual(Run.egSeasonStrata(3), ['hollow', 'kynchampions', 'oldmasters', 'moltenrim', 'mingled', 'twincourt'], 'season 3\'s');
  assert.deepEqual([...order].sort(), [...EG_STRATA].sort(), 'the six, once each');
  assert.deepEqual(Run.egSeasonStrata(arenaSeasonOf(T0 / 1000)), order, 'one order a season');
  const other = new Set(Array.from({ length: 12 }, (_, s) => Run.egSeasonStrata(s + 1).join()));
  assert.ok(other.size > 1, 'the seasons differ');
  for (const [seed, dice] of [[1, 3], [77, 99], [12345, 7]]) {
    const { B } = opened({ seed }), rng = seeded(dice);
    const got = [];
    for (let w = 5; w <= 60; w += 5) got.push(Run.egStratumAt(B, w, rng));
    assert.deepEqual(got, [null, null, null, ...order, null, null, null], `seed ${seed}: Redoubts 20 to 45, then none`);
    assert.deepEqual(B.strata, order);
  }
  // another season, another order (its epoch's week 20 onward)
  const later = T0 + 20 * 7 * 86_400_000;
  if (arenaSeasonOf(later / 1000) !== arenaSeasonOf(T0 / 1000)) { const { B } = opened({ op: later }); Run.egStratumAt(B, 20); assert.equal(B.strata[0], Run.egSeasonStrata(arenaSeasonOf(later / 1000))[0]); }
  // a deeper start: from its wait to its first hall
  for (const [ew, want] of [[30, order.slice(0, 3)], [24, order.slice(0, 1)], [15, []]]) {
    const { B, co } = opened({ ew }), rng = seeded(1);
    const now = B.su + 1;
    egStep(B, now, co.map(([sub]) => ({ sub, sx: 0, z: 0, dead: false, at: now })), rng);
    assert.equal(B.h, egStartHall(ew), `started past Redoubt ${ew}`);
    assert.deepEqual(B.strata, want, `past Redoubt ${ew}: ${want.join()}`);
  }
  assert.ok(ARENA_SEASON_EPOCH_S > 0);
});

// ── lane1 #14, lane2 #3, lane10 #12: THE MINGLED LEGION ───────────────────────────────────────────────────────────────
test('AUDIT EG IV THE MINGLED LEGION (section 18): a wave is no longer one kind and Harriers - every body is drawn on its own among the lead kinds, Divers only under the sky - and a Daedra Lord leads one Wellhead wave in three, not six; the director stands every Wellhead fight under it once it has joined (mutants: the stratum unread; the Daedra Lord one in six; a wave\'s lead half alone mingled)', () => {
  const F = { band: 3, n: 4, c: 21, bodies: [] }, rng = seeded(4);
  const dl = (mingled) => { F.mingled = mingled; const at = []; for (let w = 0; w < 18; w++) if (egWaveKinds(F, rng, 5, { waveNo: w, sky: true, room: 99 })[0] === EG_KIND.dlord) at.push(w); return at; };
  assert.deepEqual(dl(0), [5, 11, 17], 'one in six');
  assert.deepEqual(dl(1), [2, 5, 8, 11, 14, 17], 'one in three');
  F.mingled = 1;
  let many = 0, harriers = 0, bodies = 0, divers = 0;
  for (let w = 0; w < 300; w++) {
    const k = egWaveKinds(F, rng, 6, { waveNo: 1, sky: w % 2 === 0, room: 99 });
    if (new Set(k).size >= 4) many++;
    harriers += k.filter((x) => x === EG_KIND.harrier).length; bodies += k.length;
    if (w % 2 === 1) divers += k.filter((x) => x === EG_KIND.diver).length;
    assert.ok(k.every((x) => [EG_KIND.harrier, EG_KIND.breaker, EG_KIND.caster, EG_KIND.diver, EG_KIND.wraith].includes(x)));
  }
  assert.ok(many > 50, `waves of four kinds and more (${many})`);
  assert.ok(harriers / bodies < 0.35, `Harriers a lead kind among five (${(harriers / bodies).toFixed(2)})`);
  assert.equal(divers, 0, 'no Diver without the sky');
  // unmingled: the lead's half and Harriers, as ever
  F.mingled = 0;
  for (let w = 0; w < 50; w++) assert.ok(new Set(egWaveKinds(F, rng, 6, { waveNo: 1, sky: true, room: 99 })).size <= 2);
  const S = hall({ seed: 1, h: 106, strata: ['mingled'] });
  assert.equal(S.B.F.mingled, 1, 'the director\'s fight under it');
  assert.ok(!hall({ seed: 1, h: 106 }).B.F.mingled);
});

// ── lane2 #3, lane1 #14: THE TWIN COURT AND THE OLD MASTERS ───────────────────────────────────────────────────────────
test('AUDIT EG IV A COURT\'S SECOND LORD (section 18): under the Twin Court a lord of another band than the Court\'s own - never the lord itself, as the Hound\'s Court of circle 23 once stood alone - each lord at 0.6 and a Kyn champion beside them whole; under the Old Masters a master beside every lord (the Spellmaster at an odd circle, the Armsmaster at an even one) under the Twins\' law (`oldMasters`); both masters together on THE MASTERS\' GROUND (mutants: the second of the lord\'s own band; the lord itself; the champion at 0.6; the masters by one turn)', () => {
  const second = Brain.egStrataSecond;
  assert.equal(typeof second, 'function');
  for (const key of Object.keys(EG_LORDS)) for (let c = 1; c <= 40; c++) {
    const s = second(['twincourt'], key, c);
    if (EG_LORDS[key].band == null) continue;
    assert.ok(s && s !== key && EG_LORDS[s].band !== EG_LORDS[key].band, `${key} at circle ${c}: ${s}`);
  }
  assert.equal(second([], 'hound', 23), null);
  assert.deepEqual([second(['oldmasters'], 'hound', 23), second(['oldmasters'], 'hound', 24), second(['oldmasters'], 'spellmaster', 23), second(['oldmasters', 'twincourt'], 'armsmaster', 24)], ['spellmaster', 'armsmaster', 'armsmaster', 'spellmaster']);
  // the director: the Hound's Court of circle 23 (seed 1, Hall 115)
  const plain = hall({ seed: 1, h: 115 }), base = egLordsOf(plain.B.F)[0].max;
  assert.equal(plain.spec.lord, 'hound');
  const T = hall({ seed: 1, h: 115, strata: ['twincourt', 'kynchampions'] }), L = egLordsOf(T.B.F);
  const lords = L.filter((x) => !x.champ), champ = L.find((x) => x.champ);
  assert.equal(lords.length, 2, 'two lords');
  assert.notEqual(EG_LORDS[lords[1].key].band, EG_LORDS.hound.band, 'of another band');
  assert.equal(lords[0].max, Math.round(base * Brain.EG_PAIR_HP), 'the Court\'s own at 0.6');
  const C = hall({ seed: 1, h: 115, strata: ['kynchampions'] }), whole = egLordsOf(C.B.F).find((x) => x.champ).max;
  assert.ok(champ && champ.max === whole, 'the champion whole');
  // the Old Masters at the Armsmaster's Court of circle 22 (seed 1, Hall 110): both masters, their ground
  const M = hall({ seed: 1, h: 110, strata: ['oldmasters'] }), F = M.B.F, ms = egLordsOf(F);
  assert.deepEqual(ms.map((x) => x.key).sort(), ['armsmaster', 'spellmaster']);
  assert.deepEqual([F.mem.oldMasters, F.mem.lessonMin, F.mem.runeR], [1, Brain.EG_MASTERS_LESSON_R, Brain.EG_MASTERS_RUNE_R]);
  assert.deepEqual([Brain.EG_MASTERS_LESSON_R, Brain.EG_MASTERS_RUNE_R, Brain.EG_PAIR_HP], [17, 16, 0.6]);
  const H = hall({ seed: 1, h: 115, strata: ['oldmasters'] });
  assert.deepEqual(egLordsOf(H.B.F).map((x) => x.key), ['hound', 'spellmaster']);
  assert.deepEqual([H.B.F.mem.oldMasters, H.B.F.mem.lessonMin], [1, undefined], 'one master: no masters\' ground');
});

test('AUDIT EG IV THE MASTERS\' GROUND (section 18: "The Last Lesson stops at r 17, the havens keep their r 13 ring, the Examination\'s runes stand on a ring of r 16"): with both masters standing, the Armsmaster\'s Last Lesson closes no nearer than r 17 and the Spellmaster\'s Examination lays its runes within r 16 of the court\'s heart - never in the other\'s burning ground (mutants: the Lesson to r 12; the runes on the ground\'s own spots)', () => {
  // the Armsmaster's Court (seed 1, Hall 110: a court of r 20) and the Spellmaster's (Hall 15: r 18, its runes laid at 16.5 m)
  for (const [h, lord, want] of [[110, 'armsmaster', [19, 18, 17]], [15, 'spellmaster', [17]]]) {
    const M = hall({ seed: 1, h, n: 3, strata: ['oldmasters'] }), F = M.B.F, [arms] = egLordsOf(F).filter((x) => x.key === 'armsmaster'), [spell] = egLordsOf(F).filter((x) => x.key === 'spellmaster');
    assert.equal(M.spec.lord, lord);
    if (!arms.up2) egLordsWake(F, M.spec, M.now(), [], { n: 3 });
    const f = M.spec.fl[0];
    arms.hp = arms.max * 0.3; spell.hp = spell.max * 0.6;
    const rings = [], runes = new Map();
    for (let k = 0; k < 4 * 80; k++) {
      for (const z of M.step()) if (z.k === 'ez' && z.kind === 'burn' && z.s[0] === 'r') rings.push(z.s[3]);
      for (const o of egObjsOf(F, 'rune')) runes.set(o.i, o);
      arms.hp = Math.max(arms.hp, 1); spell.hp = Math.max(spell.hp, 1);
    }
    assert.deepEqual(rings, want, `Hall ${h}: the Last Lesson from its court's r ${f.r}, stopped at r 17`);
    assert.ok(runes.size >= 2, 'the Examination\'s runes');
    for (const o of runes.values()) assert.ok(Math.hypot(o.x - f.x, o.z - f.z) <= Brain.EG_MASTERS_RUNE_R + 0.01, `Hall ${h}: a rune at ${Math.hypot(o.x - f.x, o.z - f.z).toFixed(2)} m`);
  }
});

// ── lane10 #13: SPOTTER ────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV SPOTTER IS A VERB (section 15: "your arrow from beyond 12 m SPOTS a foe"): a Spotter\'s arrow cuts the blow a Caster is winding (its outline gone, `ecut`), breaks a Binder\'s raise, and marks the foe 10% over any Hunter\'s Mark - either layer joining the other, never halving it; once a mark: a second arrow while it stands breaks nothing (mutants: a Hunter\'s Mark I halving the Mastery; the wind-up left; spotted every arrow)', () => {
  const S = hall({ n: 3, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] } }), { B } = S, F = B.F;
  B.mem['acct-0'].mast = EG_M_ID.spotter; B.mem['acct-0'].vs = [[vId('huntersmark'), 1]];
  B.mem['acct-1'].vs = [[vId('huntersmark'), 3]];
  // a Caster winding a Bolt at acct-1, 14 m from the spotter
  const [c] = egLegionRaise(F, [EG_KIND.caster], [[0, 55]], S.now(), [], {});
  c.up = 0; c.next = 0; c.hp = c.max = 5000;
  const here = [{ sub: 'acct-1', x: -6, z: 41 }];
  egLegionStep(F, M_VIEW(S), S.now(), here, seeded(2), [], {});
  const bolt = F.blows.find((b) => b.o === c.i && b.at > S.now());
  assert.ok(bolt, 'a Bolt winding');
  const o = S.blow('acct-0', c.i, 30, HIT_KINDS.Shaft, [0, 41]);
  assert.ok(o.some((f) => f.k === 'ecut' && f.i === bolt.i), 'cut');
  assert.ok(!F.blows.some((b) => b.i === bolt.i) && !c.atk, 'gone from the fight');
  assert.ok(Math.abs(c.marked.x - (EG_V_BY_KEY.huntersmark.v[0] + 0.1)) < 1e-9, `the Spotter's 10% over its own Hunter's Mark I (${c.marked.x})`);
  // once a mark: the next Bolt it winds is not cut by a second arrow while the mark stands
  c.next = 0; c.atk = null;
  egLegionStep(F, M_VIEW(S), S.now(), here, seeded(2), [], {});
  const again = F.blows.find((b) => b.o === c.i && b.at > S.now());
  assert.ok(again, 'a second Bolt winding');
  const o2 = S.blow('acct-0', c.i, 30, HIT_KINDS.Shaft, [0, 41]);
  assert.ok(!o2.some((f) => f.k === 'ecut'), 'spotted already: nothing broken');
  assert.ok(F.blows.some((b) => b.i === again.i));
  // a Spotter joining another's Hunter's Mark III: 12% and 10% (its own Hunter's Mark I never joins a laid one)
  const [e] = egLegionRaise(F, [EG_KIND.breaker], [[3, 60]], S.now(), [], {});
  e.up = 0; e.hp = e.max = 5000;
  S.blow('acct-1', e.i, 30, HIT_KINDS.Shaft, [-6, 41]);
  assert.ok(Math.abs(e.marked.x - 0.12) < 1e-9);
  S.blow('acct-0', e.i, 30, HIT_KINDS.Shaft, [0, 41]);
  assert.ok(Math.abs(e.marked.x - 0.22) < 1e-9 && e.marked.by === 'acct-1', `the Spotter's 10% joins it (${e.marked.x})`);
  // a Hunter's Mark III joining a Spotter's mark, and the other way
  const [d] = egLegionRaise(F, [EG_KIND.breaker], [[-6, 60]], S.now(), [], {});
  d.up = 0; d.hp = d.max = 5000;
  S.blow('acct-0', d.i, 30, HIT_KINDS.Shaft, [0, 41]);
  S.blow('acct-1', d.i, 30, HIT_KINDS.Shaft, [-6, 41]);
  assert.ok(Math.abs(d.marked.x - (EG_V_BY_KEY.huntersmark.v[0] + 0.1)) < 1e-9, 'the first Hunter\'s Mark stands (the spotter\'s own)');
  const m = { mast: EG_M_ID.spotter, vs: [] }, h = { mast: -1, vs: [[vId('huntersmark'), 3]] }, foe = {};
  egMarkFoe(m, foe, HIT_KINDS.Shaft, T0, 'a', 13);
  egMarkFoe(h, foe, HIT_KINDS.Shaft, T0 + 100, 'b', 13);
  assert.ok(Math.abs(foe.marked.x - 0.22) < 1e-9 && foe.marked.by === 'b', 'a Hunter\'s Mark joins a spotted foe: 12% and 10%, its holder the mark\'s');
  // a Binder's raise
  const [bd, br] = egLegionRaise(F, [EG_KIND.binder, EG_KIND.breaker], [[3, 56], [0, 50]], S.now(), [], { wave: 61 });
  bd.up = br.up = 0; br.hp = 1;
  S.blow('acct-2', br.i, 50, HIT_KINDS.Melee, [-1, 49]);
  S.step(); S.step();
  assert.ok(bd.cast, 'a raise begun');
  const o3 = S.blow('acct-0', bd.i, 1, HIT_KINDS.Shaft, [0, 41]);
  assert.ok(o3.some((f) => f.k === 'esay' && f.w === 'raisebroken') && !bd.cast && bd.raised, 'broken, and spent');
});
/** The hall's fight ground (net/eliteGates/egWalkGraph.js egFightView) a legion's beat reads. */
const M_VIEW = (S) => S.spec;

// ── lane10 #14: RALLYING CRY ───────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV RALLYING CRY AT A COURT\'S PHASE TURN (section 15, Fellowship\'s capstone): while a living member resonates in Fellowship, the lord\'s second and third phase each sound it once - Rally\'s heal again (`eheal` `cry`, the strongest holder\'s share, a third under Hungering Dark), the census healing it - and not without the resonance (mutants: no cry; said every beat; the resonance unread; Hungering Dark unread)', () => {
  const fellow = [[vId('rally'), 3], [vId('standard'), 1], [vId('watchfire'), 1]];
  for (const [vs, tide, want] of [[fellow, null, [EG_V_BY_KEY.rally.v[2], EG_V_BY_KEY.rally.v[2]]], [fellow, 'hungering', [EG_V_BY_KEY.rally.v[2] / 3, EG_V_BY_KEY.rally.v[2] / 3]], [[[vId('rally'), 3]], null, []]]) {
    const S = hall({ n: 3, tide, vs: { 'acct-1': vs }, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] } }), F = S.B.F, [L] = egLordsOf(F);
    if (!L.up2) egLordsWake(F, S.spec, S.now(), [], { n: 3 });
    const cries = [];
    const run = (beats) => { for (let k = 0; k < beats; k++) for (const f of S.step()) if (f.k === 'eheal' && f.why === 'cry') cries.push(f.p); };
    run(4);
    L.hp = L.max * 0.6; run(4 * 6);
    L.hp = L.max * 0.3; run(4 * 6);
    assert.equal(L.ph, 3);
    assert.deepEqual(cries.map((p) => Math.round(p * 1e6) / 1e6), want.map((p) => Math.round(p * 1e6) / 1e6), `${tide ?? 'no tide'}: ${JSON.stringify(cries)}`);
  }
  // a Court of two lords: the first of them to turn each phase sounds it, the second's turn nothing
  const T = hall({ n: 3, strata: ['twincourt'], vs: { 'acct-1': fellow }, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] } }), [A, Z] = egLordsOf(T.B.F);
  for (const L of [A, Z]) if (!L.up2) egLordsWake(T.B.F, T.spec, T.now(), [], { n: 3 });
  const two = [];
  const go = (beats) => { for (let k = 0; k < beats; k++) for (const f of T.step()) if (f.k === 'eheal' && f.why === 'cry') two.push(f.p); };
  A.hp = A.max * 0.6; go(4 * 6);
  Z.hp = Z.max * 0.6; go(4 * 6);
  assert.deepEqual([A.ph, Z.ph, two.length], [2, 2, 1], 'one cry for the second phase');
  // the client's half: the word gives back a Second Wind spent in this hall, said
  _resetSpireVestigesForTests();
  const e = body(1000);
  spireHolderStep(e, { vs: [[vId('secondwind'), 3]], mast: -1, b: 'b0', h: 5 });
  assert.equal(Spire.spireRallyingCry?.(), false, 'none spent: nothing');
  e.health = 500; hurtPlayer(e, 300);
  assert.equal(e.health, 550, 'a Second Wind');
  Spire.spireVestigeNews();
  assert.equal(Spire.spireRallyingCry(), true);
  assert.deepEqual(Spire.spireVestigeNews(), [{ k: 'rallyingCry' }]);
  e.health = 500; hurtPlayer(e, 300);
  assert.equal(e.health, 550, 'mine again in the same hall');
  spireHolderStep(e, null);
  _resetSpireVestigesForTests();
});

/** A live player's body (test/net/eliteGates/egaudit3_pres_beats.test.js's). */
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const body = (max = 1000) => defineLiveMaxHealth({ isPlayer: true, level: 30, stats: stats(), skills: new Array(35).fill(40), career: {}, activeEffects: [], items: [], health: max, maxHealth: max, magicka: 50, maxMagicka: 100 });
const wire = (f) => { const { to: _to, ...rest } = f; const v = validEgOut(JSON.parse(JSON.stringify(rest))); assert.ok(v, `the wire refuses ${f.k}`); return v; };

test('AUDIT EG IV RALLYING CRY ON THE BREACH CLIENT (scenes/eliteGates/egClient.js): the room\'s `cry` word heals as Rally\'s does, said, and gives my spent Second Wind back - its line said and the wind mine again in the hall (mutants: the cry unheard on the screen)', () => {
  _resetSpireVestigesForTests(); _resetPlayerHealForTests();
  const S = hall({ n: 3, vs: { 'acct-0': [[vId('secondwind'), 3]] }, at: { 'acct-0': [0, 41], 'acct-1': [-6, 41], 'acct-2': [-6, 46] } }), { B, spec } = S;
  const realNow = Date.now;
  let wall = S.now() - 5000;
  Date.now = () => wall;
  const sent = [], mids = [];
  const entity = Object.assign(body(1000), { fatigue: 0 });
  const player = { pos: realmToDungeon(spec.x0, 0, 0), height: 1.8, grounded: true, jumping: false, freezeMotor: 0, collider: { move: () => {} } };
  const modes = { mode: 'dungeon', egHallBreach: () => B.b, egHallCircle: () => egCircleOfHall(B.h), egPlace: () => true, egLeave: () => true, egHallReturn: () => null, dungeonCtx: { exitDoors: [] } };
  const online = { welcomes: 1, terminal: false, poseRide: null, rideAt: null, sendEg: (k, f = {}) => { const w = validEgIn({ ...f, k }); if (w) sent.push(w); return true; } };
  const mem = new Map();
  const client = createEgClient({ modes: () => modes, online: () => online, hub: () => null, account: { me: () => 'acct-0', guest: () => false, keys: async () => ({ ok: false }) }, now: () => S.now(), entity, player, cam: { pos: [0, 0, 0], yaw: 0 },
    say: () => {}, mid: (t) => mids.push(t), site: () => ({}), wire: () => null, landAt: () => true, hurt: () => {}, peers: () => [], store: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) },
    audio: { playOneShot: () => {} }, win: { innerWidth: 1280, innerHeight: 720, matchMedia: () => ({ matches: false }) },
    fight: (link) => createEgFight({ link, audio: { playOneShot: () => {} }, player: () => entity, me: () => 'acct-0', feet: () => realmToDungeon(spec.x0, 0, 41), peerAt: () => null }),
    accountOf: () => null });
  try {
    client.word(wire(egStateOf(B, S.now())));
    client.word(wire(egFightState(B.F, S.now())));
    for (let k = 0; k < 12; k++) { client.frame(); for (const w of sent.splice(0).filter((x) => x.k === 'clk')) { const relayAt = wall + 100 + 5000; wall += 200; client.word({ k: 'clk', c: w.c, now: relayAt }); } wall += 250; }
    client.frame(); client.frame();
    entity.health = 500; hurtPlayer(entity, 300);
    client.frame();
    assert.equal(mids.at(-1), 'Second Wind! 350 health returns.');
    client.word(wire({ k: 'eheal', p: 0.08, why: 'cry' }));
    assert.equal(mids.at(-1), 'Rally! The company heals 8%.', 'healed as Rally heals');
    client.frame();
    assert.equal(mids.at(-1), 'Rallying Cry! Your Second Wind is ready again.');
    entity.health = 500; hurtPlayer(entity, 300);
    assert.ok(entity.health > 500, 'the wind mine again');
  } finally { Date.now = realNow; spireHolderStep(entity, null); _resetSpireVestigesForTests(); }
});

// ── the pages ──────────────────────────────────────────────────────────────────────────────────────────────────────────
test('AUDIT EG IV THE PAGE SAYS WHAT IS BUILT (sections 12, 15, 17.1, 18 and 21; RETIRING A FLAG DELETES THE SENTENCE): the strata as built - the season\'s order, the Mingled Legion\'s waves, the Old Masters beside every lord and their ground, the Molten Rim a Court\'s, the Twin Court of another band; the offer\'s cards that act, the shards\' rank, Spotter\'s verb and the Rallying Cry at a phase turn; section 21\'s time law as built, enforcement on; the census\'s Lifeline 20 / 25 / 30% - and the stale sentences gone', () => {
  const page = readFileSync(PAGE, 'utf8'), brain = readFileSync('src/net/eliteGates/egBrain.js', 'utf8');
  for (const s of ['The\n   six come in the order the arena season draws them', 'begins with every stratum of the Redoubts it starts past', 'Every body of a wave is drawn on its own among the lead', 'a master rises beside every Court\'s lord', 'the Last Lesson stops at r 17', 'the outer 3 m of every disc of a Court is magma',
    '**Cards that act**', 'one of the member\'s own Vestiges below III at its next rank', 'your arrow from beyond 12 m SPOTS a foe', 'come again at each of a Court\'s phase\n  turns', '**Time, the law enforcement stands on**', 'it is on in\n`eg:` rooms (`EG_BODY_ENFORCE`']) assert.ok(page.includes(s), `the page: ${s}`);
  for (const gone of ['drawn\n   without repeat each season from six:', '**The Mingled Legion**: waves draw every band\'s kinds;', 'rise together as one Court, under the Twins\'', 'every court disc is magma', 'make a rank of a held Vestige, or a pick of two new ones', 'your arrows wake Lurkers at any range (as any blow', 'Before EG14 turns it on for `eg:` rooms', 'and only once the time law above is in', 'Spotter\'s wake reads', 'No\n   member\'s tally counts either.'])
    assert.ok(!page.includes(gone), `retired: ${gone}`);
  assert.ok(brain.includes('20 / 25 / 30% less by the healer\'s rank') && !brain.includes('20 / 30 / 40%'), 'the census\'s Lifeline');
  assert.equal(EG_CAPSTONES.fellowship.line, "Rally's heal and the company's Second Winds come again at each Court phase and when a hall's door opens.");
  assert.ok(!EG_MASTERIES.find((M) => M.key === 'spotter').line.includes('wake Lurkers'));
  // the Molten Rim a Court's alone: a Rift-Yard under it lays none
  const Y = hall({ seed: 1, h: 106, strata: ['moltenrim'] });
  assert.ok(!(Y.B.F.zones ?? []).some((z) => z.kind === 'void'), 'a Yard keeps its edge');
  const C = hall({ seed: 1, h: 110, strata: ['moltenrim'] });
  assert.ok((C.B.F.zones ?? []).some((z) => z.kind === 'void' && z.s[0] === 'r'), 'a Court\'s disc rimmed');
  assert.ok(egSetFl && egRaise && egHas && EG_FL && egFightNew, 'imports read');
});
