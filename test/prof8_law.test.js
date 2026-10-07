// PROF8 (2026-09-30, Mac: "Continue the arc"; "XP follows your rank") - FISHING'S LAW: a haul's key in its one spelling;
// its fish in PROF0 6's order (the roll, a full net's x1.5, a march, a school's fish - a Netter's two - and a
// Slaughterfish's weight); its finds (the sea's Pearl and Slaughterfish only at sea on confirmed ground, each spec's
// multiplier; a trophy anywhere); the rank's own tier for its XP; the act's numbers (Appendix B); the day's two schools;
// the Pearl a Stores material. bible/06-Systems/Professions-Arc.md 5.2, 6, 30.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { haulKey, parseNodeKey, haulYield, haulFinds, haulAtSea, SEA_REGION, schoolSpots, SCHOOL_SPOTS, SCHOOLS_PER_PIXEL, SCHOOL_R, material, MARCH_MULT } from '../src/net/nodeLaw.js';
import {
  HAUL_YIELD, SCHOOL_FISH, FISH_CHANCE, FISH_ACT, FISH_KEY, PEARL, SLAUGHTERFISH_SCALES, haulTier, fishBand, tugWindow, waitMult, throwM,
  harvestXp, topTierOf, TIER_RANKS, TIER_VALUES, MINED_KEYS, PROF_RANK_MAX, SPECIALISATIONS, ACT_YIELD_MAX,
} from '../src/net/professionLaw.js';
import { SEA_REGION as FORAGING_SEA_REGION, FT } from '../src/systems/foragingLaw.js';
import { CLIMATES } from '../src/formats/mapsTables.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** Dice that answer `values` in turn. */
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('PROF8 law: a haul\'s key - `haul:<x>:<y>:<day>:<id>`, twelve hex digits; read back only in its one spelling, on the map', () => {
  const k = haulKey({ x: 412, y: 188, day: 20724, id: '0123456789ab' });
  assert.equal(k, 'haul:412:188:20724:0123456789ab');
  assert.deepEqual(parseNodeKey(k), { kind: 'haul', x: 412, y: 188, day: 20724, id: '0123456789ab' });
  for (const bad of ['haul:0412:188:20724:0123456789ab', 'haul:412:188:020724:0123456789ab', 'haul:412:188:20724:0123456789AB', 'haul:412:188:20724:0123456789a',
    'haul:1000:188:20724:0123456789ab', 'haul:412:500:20724:0123456789ab', 'haul:412:188:20724', 'haul:-1:188:20724:0123456789ab']) {
    assert.equal(parseNodeKey(bad), null, bad);
  }
});

test('PROF8 law: a haul\'s fish in PROF0 6\'s order - 1-2, a full net x1.5 (the act\'s bound), a march\'s +25%, a school\'s one (a Netter\'s two), a Slaughterfish\'s one; the fraction a chance; never less than one', () => {
  assert.deepEqual(HAUL_YIELD, [1, 2]);
  assert.deepEqual(SCHOOL_FISH, { plain: 1, netter: 2 });
  assert.equal(haulYield({ roll: 1 }, 0.99), 1);
  assert.equal(haulYield({ roll: 2 }, 0.99), 2);
  assert.equal(haulYield({ roll: 1, clean: true }, 0.4), 2, 'x1.5: the half a chance, taken');
  assert.equal(haulYield({ roll: 1, clean: true }, 0.6), 1, '...and missed');
  assert.equal(haulYield({ roll: 2, clean: true }, 0.99), 3);
  assert.equal(haulYield({ roll: 2, march: true }, 0.4), 3, `x${MARCH_MULT}: 2.5`);
  assert.equal(haulYield({ roll: 1, school: true }, 0.99), 2);
  assert.equal(haulYield({ roll: 1, school: true, netter: true }, 0.99), 3);
  assert.equal(haulYield({ roll: 1, netter: true }, 0.99), 1, 'a Netter without a school is a plain haul');
  assert.equal(haulYield({ roll: 1, slaughterfish: true }, 0.99), 2, 'the heaviest haul');
  assert.equal(haulYield({ roll: 2, clean: true, march: true, school: true, netter: true, slaughterfish: true }, 0.99), Math.floor(2 * ACT_YIELD_MAX * MARCH_MULT) + 3);
  assert.equal(haulYield({ roll: 0 }, 0.99), 1, 'at least one');
});

test('PROF8 law: the finds - the sea\'s Pearl (1 in 50; a Pearl Diver x3, a Deep-Sea x2) and Slaughterfish (1 in 100; a Deep-Sea x2) only at sea on confirmed ground; a trophy (1 in 200) anywhere', () => {
  assert.deepEqual(FISH_CHANCE, { pearl: 1 / 50, slaughterfish: 1 / 100, trophy: 1 / 200, pearlDiver: 3, deepSea: 2 });
  const all = () => 0;
  assert.deepEqual(haulFinds({ sea: true, confirmed: true }, all), { pearl: PEARL.key, scales: SLAUGHTERFISH_SCALES, trophy: true });
  assert.deepEqual(haulFinds({ sea: true, confirmed: false }, all), { pearl: null, scales: null, trophy: true }, 'unconfirmed: the trophy alone');
  assert.deepEqual(haulFinds({ sea: false, confirmed: true }, all), { pearl: null, scales: null, trophy: true }, 'inland: the same');
  assert.deepEqual(haulFinds({ sea: true, confirmed: true }, () => 0.999), { pearl: null, scales: null, trophy: false });
  // the edges: just under each chance hits, at it misses
  const at = (p) => haulFinds({ sea: true, confirmed: true }, seq(p, 1, 1)).pearl;
  assert.equal(at(1 / 50 - 1e-9), PEARL.key);
  assert.equal(at(1 / 50), null);
  assert.equal(haulFinds({ sea: true, confirmed: true, pearlDiver: true }, seq(3 / 50 - 1e-9, 1, 1)).pearl, PEARL.key, 'a Pearl Diver x3');
  assert.equal(haulFinds({ sea: true, confirmed: true, deepSea: true }, seq(2 / 50 - 1e-9, 1, 1)).pearl, PEARL.key, 'a Deep-Sea x2');
  assert.equal(haulFinds({ sea: true, confirmed: true, deepSea: true }, seq(2 / 50, 1, 1)).pearl, null);
  assert.equal(haulFinds({ sea: true, confirmed: true }, seq(1, 1 / 100 - 1e-9, 1)).scales, SLAUGHTERFISH_SCALES);
  assert.equal(haulFinds({ sea: true, confirmed: true }, seq(1, 1 / 100, 1)).scales, null);
  assert.equal(haulFinds({ sea: true, confirmed: true, deepSea: true }, seq(1, 2 / 100 - 1e-9, 1)).scales, SLAUGHTERFISH_SCALES);
  assert.equal(haulFinds({ sea: true, confirmed: true, pearlDiver: true }, seq(1, 2 / 100 - 1e-9, 1)).scales, null, 'a Pearl Diver is no Deep-Sea');
  assert.equal(haulFinds({}, seq(1 / 200 - 1e-9)).trophy, true);
  assert.equal(haulFinds({}, seq(1 / 200)).trophy, false);
  // the sea as the net reads it - the Ocean's climate, or the sea coast's region (one number, pinned beside Foraging's)
  assert.equal(SEA_REGION, FORAGING_SEA_REGION);
  assert.equal(haulAtSea(CLIMATES.Ocean, 17), true);
  assert.equal(haulAtSea(231, SEA_REGION), true);
  assert.equal(haulAtSea(231, 17), false);
  // the specialisations the finds read are the page's (3.3)
  assert.deepEqual(SPECIALISATIONS.fishing[100].map((s) => s.id), ['deep-sea', 'pearl-diver']);
  assert.deepEqual(SPECIALISATIONS.fishing[50].map((s) => s.id), ['angler', 'netter']);
});

test('PROF8 law: XP FOLLOWS THE RANK (Mac) - a haul is worked at the highest tier the rank opens, so no rank\'s haul is quartered and a Master\'s earns a Master\'s', () => {
  for (let r = 0; r <= PROF_RANK_MAX; r++) {
    const tier = haulTier(r);
    assert.equal(tier, topTierOf(r));
    assert.equal(harvestXp(tier, r, false), 15 * tier, `rank ${r}: never quartered`);
  }
  assert.deepEqual([haulTier(0), haulTier(9), haulTier(10), haulTier(55), haulTier(90), haulTier(100)], [1, 1, 2, 5, 7, 7]);
  assert.equal(TIER_RANKS.length, 7);
  assert.ok(harvestXp(1, 55, false) < harvestXp(haulTier(55), 55, false) / 10, 'at its catch\'s own tier a rank 55 haul earned a tenth');
});

test('PROF8 law: the act\'s numbers (Appendix B) - the throw 3-12 m over a 0.3-1.5 s wind; the wait 5-30 s, halved at 07:00 and 17:00, doubled in a storm; the tug 600 ms (an Angler\'s +40%); the band 20% to 30%; 20 s, 2 s slip', () => {
  assert.deepEqual([FISH_ACT.windMinS, FISH_ACT.windMaxS, FISH_ACT.throwMinM, FISH_ACT.throwMaxM, FISH_ACT.waitMinS, FISH_ACT.waitMaxS, FISH_ACT.tugS, FISH_ACT.haulS, FISH_ACT.slipS],
    [0.3, 1.5, 3, 12, 5, 30, 0.6, 20, 2]);
  assert.deepEqual([throwM(0), throwM(0.3), throwM(1.5), throwM(9)], [3, 3, 12, 12]);
  assert.ok(Math.abs(throwM(0.9) - 7.5) < 1e-9, 'straight between');
  assert.deepEqual([waitMult(6), waitMult(7), waitMult(12), waitMult(17), waitMult(12, true), waitMult(7, true)], [1, 0.5, 1, 0.5, 2, 1]);
  assert.equal(tugWindow(false), 0.6);
  assert.ok(Math.abs(tugWindow(true) - 0.84) < 1e-9);
  assert.equal(fishBand(0), 0.2);
  assert.equal(fishBand(100), 0.3);
  assert.ok(Math.abs(fishBand(50) - 0.25) < 1e-9);
});

test('PROF8 law: the day\'s schools - two a pixel, each SCHOOL_SPOTS candidate places in [0, 1), the clock\'s and the same for every client; the next day, other places', () => {
  assert.deepEqual([SCHOOLS_PER_PIXEL, SCHOOL_SPOTS, SCHOOL_R], [2, 24, 10]);
  const a = schoolSpots(300, 200, 20724, 0);
  assert.equal(a.length, SCHOOL_SPOTS);
  assert.ok(a.every((s) => s.u >= 0 && s.u < 1 && s.v >= 0 && s.v < 1));
  assert.deepEqual(schoolSpots(300, 200, 20724, 0), a, 'the same for every client');
  assert.notDeepEqual(schoolSpots(300, 200, 20724, 1), a, 'the second school its own');
  assert.notDeepEqual(schoolSpots(300, 200, 20725, 0), a, 'another day, other places');
});

test('PROF8 law: the catch is Raw Fish (tier 1, a Mark); the Pearl is a Stores material - DFU\'s own (MiscellaneousIngredients2, 77), tier 5 by its 150 gold, in the market\'s catalogue; the node_harvests table takes a haul and its trophy', () => {
  assert.equal(FISH_KEY, 'food:fish');
  assert.deepEqual(material(FISH_KEY), { key: 'food:fish', family: 'food', tier: 1, value: TIER_VALUES[0] });
  assert.deepEqual(material(PEARL.key), { key: 'gem:pearl', family: 'gems', tier: 5, value: TIER_VALUES[4], group: 'MiscellaneousIngredients2', templateIndex: 77 });
  assert.ok(MINED_KEYS.includes(PEARL.key));
  assert.equal(FT.FishingNet, 1603);
  const sql = src('server-account/migrations/0042_fishing.sql');
  assert.match(sql, /kind\s+TEXT NOT NULL CHECK \(kind IN \('herbs', 'food', 'ore', 'stone', 'logs', 'hide', 'fish'\)\)/);
  assert.match(sql, /trophy\s+INTEGER NOT NULL DEFAULT 0 CHECK \(trophy IN \(0, 1\)\)/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_node_harvests_today/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_node_harvests_account/);
});
