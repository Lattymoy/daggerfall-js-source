// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE CACHES' LAW. CACHES-ONCE
// (the owner: "Is there a way we can make it non time gated"): every dungeon holds one cache, its id the dungeon's key, its
// check that key's one spelling; the Aurum one gives and the day's forgery bound. Past the Bay beside the Bay's: a lair of
// Cyrodiil keys by its whole map id. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AURUM_CACHE_AURUM, AURUM_CACHE_DAY_MAX, AURUM_CACHE_DUNGEON_MAX, aurumCacheDungeonKey, aurumCacheUnit, aurumCacheIdOk, aurumCacheSpotOf,
} from '../../src/net/aurumCacheLaw.js';
import { DUNGEON_ID_MAX } from '../../src/net/nodeLaw.js';
import { dungeonIdOf } from '../../src/scenes/dungeonIdentity.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { PASS_SOURCES, PASS_DAY_AURUM } from '../../src/net/battlePassLaw.js';   // AURUM-CACHES BALANCE: the finds a cache is weighed against

/** The Bay's dungeons' identities (a Bay pixel id, MapId & 0xfffff) and the lairs' past the Bay (the whole id). */
const BAY = Array.from({ length: 4000 }, (_, i) => dungeonIdOf((7 << 20) | (i * 113 + 17)));
const LAIRS = Array.from({ length: 4000 }, (_, i) => dungeonIdOf(lairPlaceId(i * 97 + 5)));
const DAY = 20_757;

// PIN MOVED (CACHES-ONCE): twenty-five Aurum, three caches a day, one place in four
test('AURUM-CACHES the numbers: ten Aurum a cache, ten claims an account a UTC day (the forgery bound); a dungeon\'s id the professions\' (nodeLaw DUNGEON_ID_MAX) (mutants: the amount, the bound)', () => {
  assert.equal(AURUM_CACHE_AURUM, 10);
  assert.equal(AURUM_CACHE_DAY_MAX, 10);
  assert.equal(AURUM_CACHE_DUNGEON_MAX, DUNGEON_ID_MAX, 'one bound for a dungeon id');
  assert.equal(aurumCacheDungeonKey(0), 'd0');
  assert.equal(aurumCacheDungeonKey(0xffffffff), 'd4294967295');
  for (const bad of [-1, 2 ** 32, 1.5, '12', null, NaN]) assert.equal(aurumCacheDungeonKey(bad), null, `${bad}`);
});

// PIN MOVED (CACHES-ONCE): a cache worth two quests, one in four dungeons, a visit worth 5 to 10 Aurum
test('CACHES-ONCE BALANCE (the owner: "I\'d tune the amount so the total doesn\'t flood the economy"): a cache worth one to two quests\' finds; a regular day (four dungeons, three in five new) finding 20 to 30 Aurum, as the old caches\' 25; the day\'s bound at most the finds\' own and never met by a dedicated day (ten dungeons) (mutants: the Aurum, the bound)', () => {
  assert.ok(AURUM_CACHE_AURUM >= PASS_SOURCES.quest && AURUM_CACHE_AURUM <= 2 * PASS_SOURCES.quest, 'a quest\'s finds or two');
  const regular = 4 * 0.6 * AURUM_CACHE_AURUM, before = 4 * 0.25 * 25;
  assert.ok(regular >= 20 && regular <= 30 && Math.abs(regular - before) <= 5, `a regular day (${regular}, before ${before})`);
  assert.ok(AURUM_CACHE_AURUM * AURUM_CACHE_DAY_MAX <= PASS_DAY_AURUM, 'a forger earns no more than a day\'s finds');
  assert.ok(10 * 0.6 < AURUM_CACHE_DAY_MAX, 'a dedicated day never meets the bound');
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
