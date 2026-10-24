// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): THE FORTIFICATIONS' LAW - the works' table whole (bible/11-Multiplayer/Seats-Arc.md 7.5, Appendix B), who may
// raise what, a Builder's stone, when a tier stands, the drops, what each tier does, the Siege Camp's spend and the
// revolt's numbers (net/fortLaw.js). `06-Systems/Online-Arc.md` SEAT2b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FORT_WORKS, FORT_TIER_DAYS, fortWork, fortMaxTier, fortTierRow, fortMayRaise, fortNeeds, fortStandsAt, fortWanting, fortMet,
  fortDropped, fortsAfterCapture, fortsAfterSeason, defendersWaveMs, GATEHOUSE, gatehouseVitality, RAM, ramVitality, watchtowerShare,
  barracksGuards, marketHallListings, marketHallTitheCap, shrineStanding, shrineGateInfluence, stationSteps, harbourPort,
  RAM_KIT_KEY, campSpent, REVOLT, revoltDue, WALLS_WAVE_MIN_MS,
} from '../../src/net/fortLaw.js';
import { minedMaterial, fortificationStone } from '../../src/net/professionLaw.js';
import { SIEGE_WAVE_MS } from '../../src/net/siege/siegeRef.js';

test('SEAT2b THE WORKS: the 7.5 table whole - ten works, their tiers\' Marks and materials in the order written, every material one the Stores know (mutants: a cost; a material; a tier\'s count)', () => {
  const table = FORT_WORKS.map((w) => [w.id, w.name, w.where, w.tiers.map((t) => [t.marks, t.needs.map(([k, n]) => `${n} ${k}`).join(', ')])]);
  assert.deepEqual(table, [
    ['walls', 'Walls', 'any', [[1000, '400 stone:cut, 100 plank:oak'], [3000, '800 stone:cut, 200 ingot:iron'], [8000, '1600 stone:cut, 200 ingot:steel']]],
    ['gatehouse', 'Gatehouse', 'gate', [[2000, '300 stone:cut, 200 ingot:iron'], [5000, '600 stone:cut, 200 ingot:steel'], [12000, '1000 stone:cut, 100 ingot:mithril']]],
    ['watchtowers', 'Watchtowers', 'any', [[800, '200 stone:cut, 200 plank:pine'], [2000, '400 stone:cut, 100 ingot:iron']]],
    ['barracks', 'Barracks', 'any', [[1500, '300 plank:oak, 100 ingot:iron'], [4000, '600 plank:oak, 200 ingot:steel'], [9000, '800 plank:teak, 100 ingot:mithril']]],
    ['market', 'Market Hall', 'any', [[1000, '200 plank:oak, 100 stone:cut'], [2500, '400 plank:cherry, 200 stone:cut'], [6000, '400 plank:mahogany, 50 metal:gold']]],
    ['shrine', 'Shrine', 'any', [[1000, '100 stone:cut, 20 metal:silver'], [3000, '200 stone:cut, 10 gem:pearl']]],
    ['forge', 'Forge', 'any', [[1000, '200 stone:cut, 100 ingot:iron'], [2500, '300 stone:cut, 100 ingot:steel']]],
    ['workshop', 'Workshop', 'any', [[1000, '200 plank:oak, 50 ingot:iron'], [2500, '300 plank:teak, 50 ingot:steel']]],
    ['apothecary', 'Apothecary', 'any', [[1000, '100 stone:cut, 100 plank:oak'], [2500, '200 stone:cut, 20 gem:pearl']]],
    ['harbour', 'Harbor', 'coast', [[2000, '400 plank:oak, 200 stone:cut'], [5000, '800 plank:teak, 400 stone:cut']]],   // PIN MOVED (VOICE2): the name American (Voice.md rule 8); the id a save key, as it was
  ]);
  for (const w of FORT_WORKS) for (const t of w.tiers) for (const [k] of t.needs) assert.ok(minedMaterial(k), `${w.id}: ${k} is a Stores material`);
  assert.deepEqual(FORT_WORKS.map((w) => fortMaxTier(w.id)), [3, 3, 2, 3, 3, 2, 2, 2, 2, 2]);
  assert.deepEqual([fortWork('nope'), fortWork(3), fortMaxTier('nope'), fortTierRow('walls', 0), fortTierRow('walls', 4), fortTierRow('shrine', 3)], [null, null, 0, null, null, null]);
  assert.equal(fortTierRow('walls', 2).marks, 3000);
  assert.deepEqual([...FORT_TIER_DAYS], [2, 4, 7]);
});

test('SEAT2b WHO MAY RAISE WHAT: a Gatehouse at a crown, or a palace whose Walls stand at tier 3; a Harbour at a coastal seat; the rest anywhere (mutants: the gate\'s rule; the coast)', () => {
  assert.deepEqual([fortMayRaise('gatehouse', { tier: 'crown', walls: 0 }), fortMayRaise('gatehouse', { tier: 'palace', walls: 2 }), fortMayRaise('gatehouse', { tier: 'palace', walls: 3 })], [true, false, true]);
  assert.deepEqual([fortMayRaise('harbour', { tier: 'palace', coastal: false }), fortMayRaise('harbour', { tier: 'palace', coastal: true })], [false, true]);
  assert.deepEqual([fortMayRaise('walls', { tier: 'palace' }), fortMayRaise('nope', { tier: 'crown' })], [true, false]);
});

test('SEAT2b A PROJECT\'S NEEDS AND ITS DAYS: a Builder\'s stone at nine tenths rounded up, nothing else cut; a tier stands 2, 4 or 7 days after its last delivery; what is wanting of what is held (mutants: the share; the rounding; stone only; the days)', () => {
  assert.deepEqual(fortNeeds('walls', 1), { marks: 1000, needs: [['stone:cut', 400], ['plank:oak', 100]] });
  assert.deepEqual(fortNeeds('walls', 1, { builder: true }), { marks: 1000, needs: [['stone:cut', 360], ['plank:oak', 100]] }, 'the planks whole');
  assert.deepEqual(fortNeeds('shrine', 1, { builder: true }).needs, [['stone:cut', 90], ['metal:silver', 20]]);
  assert.deepEqual(fortNeeds('apothecary', 2, { builder: true }).needs, [['stone:cut', 180], ['gem:pearl', 20]]);
  assert.equal(fortNeeds('walls', 4), null);
  // rounded up - PROF11's fortificationStone, the Builder's one law: 7.5's counts are tens, a fraction shows at an odd one
  assert.equal(fortificationStone(333, true), 300);
  assert.deepEqual([fortStandsAt(1000, 1), fortStandsAt(1000, 2), fortStandsAt(1000, 3), fortStandsAt(1000, 4), fortStandsAt(NaN, 1)], [1000 + 2 * 86400, 1000 + 4 * 86400, 1000 + 7 * 86400, null, null]);
  const needs = fortNeeds('walls', 1).needs;
  assert.deepEqual(fortWanting(needs, new Map([['stone:cut', 150]])), [['stone:cut', 250], ['plank:oak', 100]]);
  assert.deepEqual(fortWanting(needs, { 'stone:cut': 500, 'plank:oak': 100 }), [['stone:cut', 0], ['plank:oak', 0]], 'more than enough is enough');
  assert.deepEqual([fortMet(needs, { 'stone:cut': 400, 'plank:oak': 99 }), fortMet(needs, { 'stone:cut': 400, 'plank:oak': 100 })], [false, true]);
});

test('SEAT2b THE DROPS: a capture takes every work a tier down - the Walls kept where a Fortifier saved them; a Season\'s end every work a tier down; never below nought (mutants: the drop; the Fortifier\'s Walls)', () => {
  assert.deepEqual([fortDropped(3), fortDropped(1), fortDropped(0), fortDropped(-2), fortDropped('x')], [2, 0, 0, 0, 0]);
  const forts = { walls: 2, gatehouse: 3, shrine: 1 };
  assert.deepEqual(fortsAfterCapture(forts), { walls: 1, gatehouse: 2, shrine: 0 });
  assert.deepEqual(fortsAfterCapture(forts, { fortifier: true }), { walls: 2, gatehouse: 2, shrine: 0 }, 'only the Walls skip their drop');
  assert.deepEqual(fortsAfterSeason(forts), { walls: 1, gatehouse: 2, shrine: 0 });
  assert.deepEqual(fortsAfterCapture(null), {});
});

test('SEAT2b WHAT A TIER DOES: the defenders\' wave 3 s faster a tier; the Gatehouse 20,000 and half again a tier; a Ram 3,000 (a Siegewright\'s +50%), 500 every 10 s with two crew within 3 m; the Watchtowers\' half and quarter; the Barracks\' 2, 4, 6; the Market Hall\'s quarter and its point; the Shrine\'s Standing and its 50; the stations\' step; the Harbour\'s port (mutants: each)', () => {
  assert.deepEqual([0, 1, 2, 3].map((t) => defendersWaveMs(SIEGE_WAVE_MS.palace, t)), [20000, 17000, 14000, 11000]);
  assert.deepEqual([0, 3].map((t) => defendersWaveMs(SIEGE_WAVE_MS.crown, t)), [30000, 21000]);
  assert.equal(defendersWaveMs(6000, 3), WALLS_WAVE_MIN_MS, 'never under five seconds');
  assert.equal(defendersWaveMs(20000, 9), 11000, 'three tiers at most');
  assert.deepEqual({ ...GATEHOUSE }, { vitality: 20000, perTier: 0.5, blowShare: 0.1 });
  assert.deepEqual([0, 1, 2, 3].map(gatehouseVitality), [20000, 30000, 40000, 50000]);
  assert.deepEqual({ ...RAM }, { vitality: 3000, damage: 500, everyMs: 10000, crew: 2, crewM: 3, siegewright: 0.5 });
  assert.deepEqual([ramVitality(), ramVitality(true)], [3000, 4500]);
  assert.deepEqual([0, 1, 2].map(watchtowerShare), [null, 0.5, 0.25]);
  assert.deepEqual([0, 1, 2, 3, 7].map(barracksGuards), [0, 2, 4, 6, 6]);
  assert.deepEqual([0, 1, 2, 3].map((t) => marketHallListings(30, t)), [30, 37, 45, 52]);
  assert.deepEqual([0, 1, 3].map((t) => marketHallTitheCap(10, t)), [10, 11, 13]);
  assert.deepEqual([0, 1, 2, 5].map(shrineStanding), [0, 1, 2, 2]);
  assert.deepEqual([0, 1, 2].map(shrineGateInfluence), [0, 50, 100]);
  const forts = { forge: 2, workshop: 1, apothecary: 0 };
  assert.deepEqual(['smithing', 'carpentry', 'masonry', 'outfitting', 'alchemy', 'mining'].map((p) => stationSteps(p, forts)), [2, 1, 1, 1, 0, 0]);
  assert.deepEqual([harbourPort(0), harbourPort(1)], [false, true]);
});

test('SEAT2b THE SIEGE CAMP AT THE TURNING: a camp that won the Right sends its Ram Kits to a siege with a Gatehouse, and burns the rest; a palace without a gate, or a camp that won nothing, burns whole (mutants: the Right; the gate; the kits)', () => {
  const camp = [['stone:cut', 120], [RAM_KIT_KEY, 2], ['plank:oak', 0], ['plank:oak', 30.7]];
  assert.deepEqual(campSpent(camp, { won: true, gated: true }), { rams: 2, burnt: [['stone:cut', 120], ['plank:oak', 30]] });
  assert.deepEqual(campSpent(camp, { won: true, gated: false }), { rams: 0, burnt: [['stone:cut', 120], [RAM_KIT_KEY, 2], ['plank:oak', 30]] }, 'Appendix A: no Ram - a palace has no Gatehouse');
  assert.deepEqual(campSpent(camp, { won: false, gated: true }).rams, 0, 'no Right: burnt whole');
  assert.equal(RAM_KIT_KEY, 'work:ram');
});

test('SEAT2b THE REVOLT\'S NUMBERS: a Rebel Captain of Renown 50, twelve rebels, the window\'s two hours; due at Standing nought (mutants: the numbers; the due)', () => {
  assert.deepEqual({ ...REVOLT }, { captainRenown: 50, rebels: 12, windowMs: 7_200_000 });
  assert.deepEqual([revoltDue(0), revoltDue(1), revoltDue(-3)], [true, false, true]);
});
