// OW6 - THE BANDS VARY AND ROAM MORE, THE SAME FOR EVERY PLAYER (2026-09-29, the player: "Enemies should spawn in varying
// numbers and roam more often"; "Everything needs that persistence between players in the overworld"). The law
// (systems/travelBands.js: a band's own number and level, the chance and pace), the themed group taking a caller's size
// (systems/campEncounters.js rollGroupComposition: a band of one may be a solitary kind), and the host's make lifted out
// of scenes/world.js and RUN: online every player reads one band, whatever their own level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BAND_CHANCE_DAY, BAND_CHANCE_NIGHT, BAND_WANDER_MPS, BAND_LEG_MS, BAND_SIZE_WEIGHTS, BAND_LEVEL_MAX, BAND_LIFE_MS,
  bandOf, bandSizeOf, bandLevelOf, bandLabel, bandMakeSeed, wanderAt,
} from '../src/systems/travelBands.js';
import { rollGroupComposition, CAMP_SIZE, PACK_SIZE } from '../src/systems/campEncounters.js';
import { SOLITARY_TYPES } from '../src/characters/mobileFactions.js';
import { CLIMATES } from '../src/formats/mapsFile.js';
import { enemyDisplayName } from '../src/characters/enemyBasics.js';
import { seededRng } from '../src/systems/wind.js';
import { NATIVE_PER_M } from '../src/systems/travelDungeons.js';
import { WILD_PACK_MULT } from '../src/scenes/exteriorFoes.js';

const land = () => true;
/** Every band a strip of cells holds over `lives` lives - a population to measure. */
const population = (lives, night = false) => {
  const out = [];
  for (let life = 0; life < lives; life++) for (let cx = 0; cx < 10; cx++) { const b = bandOf({ cx, cy: 7, life, night, ok: land }); if (b) out.push(b); }
  return out;
};

test('OW6 law: more bands, roaming - half as many again by day, a third more by night, a brisk walk turning oftener; the land\'s odds hold over a population (mutants: the old chances, the old pace)', () => {
  assert.equal(BAND_CHANCE_DAY, 0.75);
  assert.equal(BAND_CHANCE_NIGHT, 0.9);
  assert.equal(BAND_WANDER_MPS, 2);
  assert.equal(BAND_LEG_MS, 50 * 1000);
  const cells = 10 * 600;
  const day = population(600).length / cells, night = population(600, true).length / cells;
  assert.ok(Math.abs(day - BAND_CHANCE_DAY) < 0.03, `about ${BAND_CHANCE_DAY} of cells by day (${day.toFixed(3)})`);
  assert.ok(Math.abs(night - BAND_CHANCE_NIGHT) < 0.03, `about ${BAND_CHANCE_NIGHT} by night (${night.toFixed(3)})`);
  // it is SEEN to roam: a leg is a hundred metres, and every leg bends
  const b = population(1)[0];
  const one = wanderAt(b, b.bornMs + BAND_LEG_MS, land);
  assert.ok(Math.abs(Math.hypot(one.x - b.born.x, one.z - b.born.z) / NATIVE_PER_M - 100) < 1e-6, 'a hundred metres a leg');
  assert.ok(BAND_LIFE_MS / BAND_LEG_MS >= 14, 'fourteen legs a life and more');
});

test('OW6 law: HOW MANY A BAND IS - one to six by the weights, off its own stream, the same number for every player who asks (mutants: a weight skipped, the size off the birth stream)', () => {
  const pop = population(800);
  const total = BAND_SIZE_WEIGHTS.reduce((a, w) => a + w, 0);
  const counts = new Array(BAND_SIZE_WEIGHTS.length + 1).fill(0);
  for (const b of pop) {
    const n = bandSizeOf(b);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= BAND_SIZE_WEIGHTS.length, `a size in range (${n})`);
    assert.equal(bandSizeOf({ ...b }), n, 'asked again: the same number');
    counts[n]++;
  }
  assert.deepEqual([...BAND_SIZE_WEIGHTS], [12, 20, 24, 20, 14, 10]);
  for (let n = 1; n <= BAND_SIZE_WEIGHTS.length; n++) {
    const got = counts[n] / pop.length, want = BAND_SIZE_WEIGHTS[n - 1] / total;
    assert.ok(Math.abs(got - want) < 0.03, `size ${n}: about ${(want * 100).toFixed(0)}% (${(got * 100).toFixed(1)}%)`);
  }
  // its own stream: not the birth's first draw (under the spawn chance by construction), not the make's
  const firsts = pop.map((b) => bandSizeOf(b));
  assert.ok(firsts.filter((n) => n === 6).length > pop.length * 0.06, 'the top weight comes, a fair share of the time');
});

test('OW6 law: A BAND\'S OWN LEVEL - a function of its seed alone, 1 to BAND_LEVEL_MAX, skewed low: half level 6 or under, a quarter 12 or over (mutants: the square dropped, the bound off)', () => {
  assert.equal(BAND_LEVEL_MAX, 20);
  const levels = population(800).map((b) => bandLevelOf(b));
  for (const l of levels) assert.ok(Number.isInteger(l) && l >= 1 && l <= BAND_LEVEL_MAX, `a level in range (${l})`);
  levels.sort((a, b) => a - b);
  const median = levels[Math.floor(levels.length / 2)];
  assert.ok(median >= 5 && median <= 7, `the median about 6 (${median})`);
  const high = levels.filter((l) => l >= 12).length / levels.length;
  assert.ok(high > 0.2 && high < 0.3, `a quarter 12 or over (${high.toFixed(3)})`);
  assert.ok(levels.includes(1) && levels.includes(BAND_LEVEL_MAX), 'both ends come');
  const b = population(1)[0];
  assert.equal(bandLevelOf({ ...b }), bandLevelOf(b), 'the same for everyone');
});

test('OW6 law: a band\'s words - a lone one its kind alone, the rest its kind and number', () => {
  assert.equal(bandLabel('Giant', 1), 'Giant');
  assert.equal(bandLabel('', 1), 'A lone foe');
  assert.equal(bandLabel('Orc', 4), 'Orc, 4');
  assert.equal(bandLabel('Orc', 2), 'Orc, 2');
  assert.equal(bandLabel('', 6), 'A band, 6');
});

test('OW6: THE THEMED GROUP TAKES A CALLER\'S SIZE - exactly that many, from the one table; a group of ONE may be a solitary kind and a larger never; no size, the camp\'s and pack\'s own ranges as before (mutants: the size ignored, the solitary let in for all, kept out for one)', () => {
  const ctx = (size, seed) => [{ climateIndex: CLIMATES.Mountain, playerLevel: 12, inLocationRect: false, gameMinutes: 0, ...(size ? { size } : {}) }, seededRng(seed)];
  let loneSolitary = 0, groupSolitary = 0;
  for (let k = 1; k <= 3000; k++) {
    for (const size of [1, 2, 3, 4, 5, 6]) {
      const hit = rollGroupComposition(...ctx(size, k));
      if (!hit) continue;
      assert.equal(hit.mobileTypes.length, size, `sized ${size}: that many`);
      if (SOLITARY_TYPES.has(hit.mobileTypes[0])) { if (size === 1) loneSolitary++; else groupSolitary++; }
    }
    const free = rollGroupComposition(...ctx(0, k));
    if (free) assert.ok(free.mobileTypes.length >= Math.min(CAMP_SIZE[0], PACK_SIZE[0]) && free.mobileTypes.length <= Math.max(CAMP_SIZE[1], PACK_SIZE[1]), 'unsized: the old ranges');
    if (free) assert.ok(!SOLITARY_TYPES.has(free.mobileTypes[0]), 'unsized: never a solitary kind');
  }
  assert.ok(loneSolitary > 0, `a band of one is sometimes a solitary kind (${loneSolitary})`);
  assert.equal(groupSolitary, 0, 'a group never leads with one');
});

/** The host's make, lifted from scenes/world.js and run over the real tables. */
const liftMake = () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const m = /\n {2}function bandMake\(b\) \{\n[\s\S]*?\n {2}\}\n/.exec(w);
  assert.ok(m, 'bandMake lifted');
  return (scope) => new Function('s', `const { _bandMake, maps, rollGroupComposition, seededRng, bandMakeSeed, bandLevelOf, bandSizeOf, playerEntity, online, enemyDisplayName, wildBornHere, WILD_PACK_MULT } = s;${m[0]} return bandMake;`)(scope);
};
const makeScope = (level, online) => ({
  _bandMake: new Map(), maps: { getClimateIndex: () => CLIMATES.Mountain }, rollGroupComposition, seededRng, bandMakeSeed, bandLevelOf, bandSizeOf,
  playerEntity: { level }, online, enemyDisplayName,
  wildBornHere: () => false, WILD_PACK_MULT,   // PVPDUNGEONS: no band here is born in the open zone (its pack x WILD_PACK_MULT)
});

test('OW6 host run: ONLINE, ONE BAND FOR EVERY PLAYER - a level-1 and a level-18 player read the same kind and the same number over it (it was each viewer\'s own level); offline the player\'s own, as Daggerfall reads it; its number is its own (mutants: the viewer\'s level online, the size dropped)', () => {
  const lift = liftMake();
  const bands = population(40, true).slice(0, 60);
  let differedOffline = 0;
  for (const b of bands) {
    const low = lift(makeScope(1, { id: 'a' }))(b), high = lift(makeScope(18, { id: 'b' }))(b);
    assert.deepEqual(low, high, `${b.id}: the same band for both players online`);
    if (!low) continue;
    assert.equal(low.mobileTypes.length, bandSizeOf(b), 'its own number');
    assert.equal(low.name, enemyDisplayName(low.mobileTypes[0]));
    const own = rollGroupComposition({ climateIndex: CLIMATES.Mountain, playerLevel: bandLevelOf(b), inLocationRect: false, gameMinutes: 0, size: bandSizeOf(b) }, seededRng(bandMakeSeed(b)));
    assert.deepEqual(low.mobileTypes, own.mobileTypes, 'read at the band\'s own level');
    const offLow = lift(makeScope(1, null))(b), offHigh = lift(makeScope(18, null))(b);
    if (JSON.stringify(offLow) !== JSON.stringify(offHigh)) differedOffline++;
  }
  assert.ok(differedOffline > 0, 'offline the player\'s own level reads the tables (a level-1 and a level-18 player meet different bands)');
  // made once: a second ask is the kept one
  const scope = makeScope(5, { id: 'a' }), bandMake = lift(scope), b = bands[0];
  assert.equal(bandMake(b), bandMake(b));
  assert.ok(scope._bandMake.has(b.id));
});
