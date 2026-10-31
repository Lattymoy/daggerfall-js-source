// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE CACHES' LAW. CACHES-ONCE
// (the owner: "Is there a way we can make it non time gated"): every dungeon holds one cache, its id the dungeon's key, its
// check that key's one spelling; the Aurum each gives, 5 to 10 by its hash (CACHE-SPREAD, no day's bound). Past the Bay beside the Bay's: a lair of
// Cyrodiil keys by its whole map id. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AURUM_CACHE_AURUM_MIN, AURUM_CACHE_AURUM_MAX, AURUM_CACHE_DUNGEON_MAX, aurumCacheDungeonKey, aurumCacheUnit, aurumCacheIdOk, aurumCacheSpotOf,
  aurumCacheAurumOf,
} from '../../src/net/aurumCacheLaw.js';
import * as LAW from '../../src/net/aurumCacheLaw.js';
import { DUNGEON_ID_MAX } from '../../src/net/nodeLaw.js';
import { dungeonIdOf } from '../../src/scenes/dungeonIdentity.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { PASS_SOURCES, PASS_DAY_AURUM } from '../../src/net/battlePassLaw.js';   // AURUM-CACHES BALANCE: the finds a cache is weighed against

/** The Bay's dungeons' identities (a Bay pixel id, MapId & 0xfffff) and the lairs' past the Bay (the whole id). */
const BAY = Array.from({ length: 4000 }, (_, i) => dungeonIdOf((7 << 20) | (i * 113 + 17)));
const LAIRS = Array.from({ length: 4000 }, (_, i) => dungeonIdOf(lairPlaceId(i * 97 + 5)));
const DAY = 20_757;

// PIN MOVED (CACHE-SPREAD): ten Aurum a cache and ten claims a UTC day; before CACHES-ONCE twenty-five, three a day, one place in four
test('CACHE-SPREAD the numbers: a cache gives 5 to 10 Aurum, and no day\'s bound is left in the law; a dungeon\'s id the professions\' (nodeLaw DUNGEON_ID_MAX) (mutants: the least, the most)', () => {
  assert.deepEqual([AURUM_CACHE_AURUM_MIN, AURUM_CACHE_AURUM_MAX], [5, 10]);
  assert.deepEqual(Object.keys(LAW).filter((k) => /DAY|CAP/.test(k)), [], 'no day\'s bound (Mac: "no daily cap")');
  assert.equal(AURUM_CACHE_DUNGEON_MAX, DUNGEON_ID_MAX, 'one bound for a dungeon id');
  assert.equal(aurumCacheDungeonKey(0), 'd0');
  assert.equal(aurumCacheDungeonKey(0xffffffff), 'd4294967295');
  for (const bad of [-1, 2 ** 32, 1.5, '12', null, NaN]) assert.equal(aurumCacheDungeonKey(bad), null, `${bad}`);
});

// PIN MOVED (CACHE-SPREAD): ten Aurum a cache, a regular day 24, ten claims a day the forgery bound; before it a cache worth two quests, one in four dungeons
test('CACHE-SPREAD the amount: every cache\'s own, 5 to 10 off its id alone, each of the six about a sixth of the Bay\'s caches and of those past it; a cache worth half to one quest\'s finds; a regular day (four dungeons, three in five new) finding about 18 Aurum (mutants: the least, the most, the amount not the id\'s)', () => {
  for (const [name, list] of [['the Bay', BAY], ['past the Bay', LAIRS]]) {
    const ids = list.map((id) => /** @type {string} */ (aurumCacheDungeonKey(id)));
    const counts = new Map();
    for (const id of ids) {
      const a = aurumCacheAurumOf(id);
      assert.ok(Number.isInteger(a) && a >= AURUM_CACHE_AURUM_MIN && a <= AURUM_CACHE_AURUM_MAX, `${name} ${id}: ${a}`);
      counts.set(a, (counts.get(a) ?? 0) + 1);
    }
    assert.deepEqual([...counts.keys()].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10], `${name}: every amount paid`);
    for (const [a, n] of counts) assert.ok(Math.abs(n / ids.length - 1 / 6) < 0.03, `${name}: ${a} in ${n} of ${ids.length}`);
    const mean = ids.reduce((t, id) => t + aurumCacheAurumOf(id), 0) / ids.length;
    assert.ok(Math.abs(mean - 7.5) < 0.15, `${name}: the mean ${mean}`);
  }
  assert.equal(aurumCacheAurumOf('d5'), aurumCacheAurumOf('d5'), 'the same id, the same amount');
  assert.equal(AURUM_CACHE_AURUM_MAX, PASS_SOURCES.quest, 'the most is a quest\'s finds');
  assert.equal(2 * AURUM_CACHE_AURUM_MIN, PASS_SOURCES.quest, 'the least half of one');
  const mean = (AURUM_CACHE_AURUM_MIN + AURUM_CACHE_AURUM_MAX) / 2, regular = 4 * 0.6 * mean;
  assert.ok(regular >= 15 && regular <= 24 && regular < PASS_DAY_AURUM / 4, `a regular day (${regular}, 24 at ten a cache)`);
});

// PIN MOVED (CACHES-ONCE): the id was `<day>:d<dungeon>`, taken on its day and the next; a quarter of places held one
test('CACHES-ONCE the id: every dungeon\'s key, the Bay\'s and past it, is a cache\'s in its one spelling; a second spelling, another kind of place, a day\'s id and a key past the bound are none (mutants: a leading zero let through, the bound off by one)', () => {
  for (const [name, list] of [['the Bay', BAY], ['past the Bay', LAIRS]]) {
    assert.ok(list.every((id) => aurumCacheIdOk(aurumCacheDungeonKey(id))), `${name}: every dungeon holds one`);
  }
  const p = /** @type {string} */ (aurumCacheDungeonKey(BAY[0])), q = /** @type {string} */ (aurumCacheDungeonKey(LAIRS[0]));
  assert.ok(Number(q.slice(1)) > 0xfffff && Number(p.slice(1)) < 500_000, 'a lair past the Bay keys by its whole id, a Bay dungeon by its pixel id');
  assert.equal(aurumCacheIdOk('d0'), true);
  assert.equal(aurumCacheIdOk('d4294967295'), true);
  const n = p.slice(1);
  for (const bad of [`d0${n}`, `${DAY}:${p}`, `p${n}`, `${p} `, ` ${p}`, `D${n}`, `d${n}.5`, 'd4294967296', 'd99999999999', 'd', 'd01', '', null, 7, { id: p }]) {
    assert.equal(aurumCacheIdOk(bad), false, JSON.stringify(bad));
  }
});

test('AURUM-CACHES the spot: a pile in [0, 1) and a bearing in [0, 2 pi) off the id alone - the same on every client, another for another id; the hash parts neighbours (mutants: the pile not the id\'s)', () => {
  const ids = BAY.slice(0, 50).map((id) => /** @type {string} */ (aurumCacheDungeonKey(id)));
  const spots = ids.map(aurumCacheSpotOf);
  for (const s of spots) assert.ok(s.pile >= 0 && s.pile < 1 && s.bearing >= 0 && s.bearing < 2 * Math.PI);
  assert.deepEqual(aurumCacheSpotOf(ids[0]), spots[0], 'the same id, the same spot');
  assert.ok(new Set(spots.map((s) => Math.floor(s.pile * 8))).size >= 6, 'the piles spread');
  assert.ok(new Set(spots.map((s) => Math.floor(s.bearing))).size >= 5, 'the bearings spread');
  assert.notEqual(spots[0].pile, spots[0].bearing / (2 * Math.PI), 'two draws, not one');
  assert.ok(aurumCacheUnit('a') !== aurumCacheUnit('b') && aurumCacheUnit('d5|pile') !== aurumCacheUnit('d6|pile'), 'the hash parts its neighbours');
  for (const s of ['', 'x', 'd5', 'd5|pile']) { const u = aurumCacheUnit(s); assert.ok(u >= 0 && u < 1, s); }
});
