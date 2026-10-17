// SEASON1 part two (2026-10-01, Mac: "Finish the seats"; "Continue"; "Hurry up"): THE TIDES' LAW - the roll (a Tide a
// land a week off the week and a salt, by the gate's own mix), the lands, the weights, Calm where no Season is counted;
// the numbers; the seat-side effects (a Plague's Watch and Festival, a Daedric Incursion's gates, a Royal Wedding's
// Festival and Standing, a Tax Revolt's Tithe) in influence, the Edict's cost, the week's Standing and the Turning's
// plan; the Seat tab's words (bible/11-Multiplayer/Seats-Arc.md 9.3). Pure: src/net/tideLaw.js, src/net/townSeatLaw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIDE_SALT, TIDES, TIDE_LANDS, TIDE_EFFECTS, TIDE_WORDS, tideOf, tideAt, tideLandOf, tideLandName, tideName, tideLine } from '../../src/net/tideLaw.js';
import { gateHash } from '../../src/net/gate/gateLaw.js';
import { accountSeatInfluence, edictCost, edictLine, standingWeek, turningPlan, STANDING_CHANGES, WATCH_INFLUENCE, GATE_INFLUENCE, GATE_WEEK_CAP } from '../../src/net/townSeatLaw.js';

test('SEASON1 THE ROLL (9.3): ten Tides weighted out of 100 in the table\'s order; five lands - the kingdoms, the Marches, the Free Lands - in the roll\'s order; a land\'s Tide the gate\'s mix of its salt, the week and the land walked down the weights; Calm for no land, a week not whole, or no Season counted; the weights hold over many weeks (mutants: each weight; the order; the salt; the walk; the lands; the counted gate)', () => {
  assert.deepEqual(TIDES.map((t) => [t.id, t.weight]), [['calm', 40], ['harvest', 10], ['blight', 5], ['plague', 5], ['orcs', 10], ['daedra', 10], ['wedding', 5], ['bandits', 5], ['storms', 5], ['revolt', 5]]);
  assert.equal(TIDES.reduce((a, t) => a + t.weight, 0), 100);
  assert.deepEqual([...TIDE_LANDS], ['daggerfall', 'wayrest', 'sentinel', 'marches', 'free']);
  assert.equal(TIDE_SALT, 0x71de);
  const walk = (week, i) => { let r = gateHash(TIDE_SALT, week, i) % 100; for (const t of TIDES) { if (r < t.weight) return t.id; r -= t.weight; } return 'calm'; };
  for (let w = 2900; w < 2960; w++) TIDE_LANDS.forEach((land, i) => assert.equal(tideOf(w, land), walk(w, i), `${w} ${land}`));
  assert.deepEqual([tideOf(2950, 'wayrest'), tideOf(2950, 'marches'), tideOf(2951, 'marches'), tideOf(2951, 'free')], [walk(2950, 1), walk(2950, 3), walk(2951, 3), walk(2951, 4)]);
  assert.deepEqual([tideOf(5, 'nowhere'), tideOf(5.5, 'wayrest'), tideOf(5, null)], ['calm', 'calm', 'calm']);
  const count = {};
  for (let w = 0; w < 4000; w++) for (const land of TIDE_LANDS) count[tideOf(w, land)] = (count[tideOf(w, land)] ?? 0) + 1;
  for (const t of TIDES) assert.ok(Math.abs(count[t.id] / 20000 - t.weight / 100) < 0.012, `${t.id} ${count[t.id]}`);
  assert.deepEqual([34, 21, 26, 31, 17, 20].map(tideLandOf), ['wayrest', 'marches', 'free', null, 'daggerfall', 'sentinel']);
  assert.equal(tideAt(2950, 34, true), tideOf(2950, 'wayrest'));
  assert.equal(tideAt(2950, 21, true), tideOf(2950, 'marches'));
  let landed = 0;
  for (let w = 0; w < 200; w++) { assert.equal(tideAt(w, 34, false), 'calm', 'no Season counted'); assert.equal(tideAt(w, 31, true), 'calm', 'the sea'); if (tideAt(w, 34, true) !== 'calm') landed++; }
  assert.ok(landed > 80, 'a counted land does roll');
});

test('SEASON1 THE TIDES\' NUMBERS AND WORDS (9.3): every effect\'s number; a Tide\'s name and words; a land\'s name; the Seat tab\'s line - this week\'s Tide and what it does, then the next\'s; none for no land or no Tide (mutants: each number; the words; the line)', () => {
  assert.deepEqual({ ...TIDE_EFFECTS }, {
    harvestYield: 1.25, blightYield: 0.75, plagueWatch: 0.5, plagueFestival: 2, orcsCampInfluence: 50, orcsCampsDay: 5, orcsInfluenceWeek: 250,
    daedraGates: 2, weddingFestival: 0.5, weddingStanding: 3, banditsCourier: 2, stormsFish: 1.5, stormsSea: 1.5, revoltTithe: 5, revoltStanding: -3,
  });
  assert.deepEqual(Object.keys(TIDE_WORDS), TIDES.map((t) => t.id));
  assert.deepEqual([tideName('daedra'), tideName('orcs'), tideName('nope')], ['Daedric Incursion', 'Orc Raids', null]);
  assert.deepEqual(['wayrest', 'marches', 'free', 'x'].map(tideLandName), ['the Kingdom of Wayrest', 'the Marches', 'the Free Lands', null]);
  assert.equal(tideLine(34, 'plague', 'calm'), 'The Tide in the Kingdom of Wayrest this week: Plague - the Watch counts half, and Festivals cost double. Next week: Calm.');
  assert.equal(tideLine(21, 'calm', null), 'The Tide in the Marches this week: Calm - nothing stirs.');
  assert.deepEqual([tideLine(31, 'plague', 'calm'), tideLine(34, null, 'calm')], [null, null]);
});

test('SEASON1 THE SEAT-SIDE TIDES: a Plague halves the Watch, rounded down; a Daedric Incursion doubles gate kills past their cap; a Festival costs double in a Plague and half in a Royal Wedding, no other Edict; a Royal Wedding\'s week +3 Standing; a Tax Revolt\'s -3 above a 5% Tithe; the Turning\'s plan reads the week\'s Tide for Standing and the coming week\'s for a Festival (mutants: the half; the double; the cap; each cost; the Wedding; the Revolt\'s line; the plan\'s two)', () => {
  const v = { watch: 7, gates: 4 };
  assert.equal(accountSeatInfluence(v), 7 * WATCH_INFLUENCE + GATE_WEEK_CAP);
  assert.equal(accountSeatInfluence({ watch: 7 }, 0, 'plague'), Math.floor(7 * WATCH_INFLUENCE * 0.5));
  assert.equal(accountSeatInfluence({ watch: 7 }, 0.1, 'plague'), Math.floor(7 * WATCH_INFLUENCE * 1.1 * 0.5 + 1e-9), 'after a Free Land\'s tenth');
  assert.equal(accountSeatInfluence({ gates: 1 }, 0, 'daedra'), 2 * GATE_INFLUENCE);
  assert.equal(accountSeatInfluence({ gates: 4 }, 0, 'daedra'), 2 * GATE_WEEK_CAP, 'the cap, then doubled');
  assert.equal(accountSeatInfluence({ watch: 7, gates: 1 }, 0, 'harvest'), 7 * WATCH_INFLUENCE + GATE_INFLUENCE);
  assert.deepEqual([edictCost('festival', 'palace'), edictCost('festival', 'palace', 'plague'), edictCost('festival', 'crown', 'wedding'), edictCost('festival', 'palace', 'daedra')], [2500, 5000, 5000, 2500]);
  assert.deepEqual([edictCost('royal-tourney', 'crown', 'plague'), edictCost('royal-tourney', 'crown', 'wedding')], [5000, 5000], 'the one other Edict with a price, untouched');
  assert.match(edictLine('festival', 'palace', 'plague'), /Costs 5,000 silver\.$/);
  const base = { tier: 'palace', standing: 50, tithe: 6 };
  assert.equal(standingWeek({ ...base, tide: 'wedding' }).standing, standingWeek(base).standing + 3);
  assert.deepEqual(standingWeek({ ...base, tide: 'wedding' }).changes.at(-1), ['wedding', STANDING_CHANGES.wedding]);
  assert.equal(standingWeek({ ...base, tide: 'revolt' }).standing, standingWeek(base).standing - 3);
  assert.equal(standingWeek({ ...base, tithe: 5, tide: 'revolt' }).standing, standingWeek({ ...base, tithe: 5 }).standing, 'at 5% no more');
  assert.deepEqual([STANDING_CHANGES.wedding, STANDING_CHANGES.taxRevolt], [3, -3]);
  const plan = (tide, tideNext) => turningPlan({
    week: 3, treasuries: new Map([['g', 1e6]]),
    seats: [{ key: 1, tier: 'palace', holder: { guild: 'g', standing: 50, tithe: 6, edict: 'festival', tide, tideNext }, guilds: [{ guild: 'g', influence: 10, legacy: 0, pledgedAt: 0 }] }],
  });
  assert.equal(plan('wedding', 'calm').standings[0].standing, plan('calm', 'calm').standings[0].standing + 3);
  assert.deepEqual([plan('calm', 'plague').edicts[0].cost, plan('calm', 'wedding').edicts[0].cost, plan('plague', 'calm').edicts[0].cost], [5000, 1250, 2500], 'the coming week\'s Tide prices it');
});
