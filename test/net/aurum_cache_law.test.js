// AURUM-CACHES (2026-10-30, the owner: "Also Aurum caches"; bible/06-Systems/Aurum.md section 3a): THE CACHES' LAW -
// which places hold a cache on a UTC day (a quarter of them, by a hash of the day and the place), a cache's id and its
// check (today's or yesterday's, a place that holds one), the Aurum one gives and the claims a day. Past the Bay beside
// the Bay's: a lair of Cyrodiil keys by its whole map id. tools/mutants/aurum_caches.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AURUM_CACHE_AURUM, AURUM_CACHE_DAY_MAX, AURUM_CACHE_SHARE, AURUM_CACHE_DUNGEON_MAX, aurumCacheDayOf, aurumCacheDungeonKey,
  aurumCacheUnit, aurumCacheHolds, aurumCacheId, aurumCacheOf, aurumCacheIdOk, aurumCacheSpotOf,
} from '../../src/net/aurumCacheLaw.js';
import { DUNGEON_ID_MAX } from '../../src/net/nodeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { dungeonIdOf } from '../../src/scenes/dungeonIdentity.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { PASS_SOURCES, PASS_DAY_AURUM } from '../../src/net/battlePassLaw.js';   // AURUM-CACHES BALANCE: the finds a cache is weighed against

const DAY = utcDay(Date.UTC(2026, 9, 30, 12) / 1000);
/** The Bay's dungeons' identities (a Bay pixel id, MapId & 0xfffff) and the lairs' past the Bay (the whole id). */
const BAY = Array.from({ length: 4000 }, (_, i) => dungeonIdOf((7 << 20) | (i * 113 + 17)));
const LAIRS = Array.from({ length: 4000 }, (_, i) => dungeonIdOf(lairPlaceId(i * 97 + 5)));
/** The first `n` places of `ids` that hold a cache on `day` (and, `none`, that hold none). */
const holding = (ids, day, n, none = false) => ids.map(aurumCacheDungeonKey).filter((p) => aurumCacheHolds(day, p) !== none).slice(0, n);

test('AURUM-CACHES the numbers: twenty-five Aurum a cache, three caches an account a UTC day, one place in four (PIN MOVED, AURUM-CACHES BALANCE: fifteen and one in five); a dungeon\'s id the professions\' (nodeLaw DUNGEON_ID_MAX) and the day marksLaw\'s (mutants: the amount, the cap, the share)', () => {
  assert.equal(AURUM_CACHE_AURUM, 25);
  assert.equal(AURUM_CACHE_DAY_MAX, 3);
  assert.equal(AURUM_CACHE_SHARE, 0.25);
  assert.equal(AURUM_CACHE_DUNGEON_MAX, DUNGEON_ID_MAX, 'one bound for a dungeon id');
  for (const s of [0, 86_399, 86_400, Date.UTC(2026, 9, 30, 23, 59) / 1000, 1.9e9]) assert.equal(aurumCacheDayOf(s), utcDay(s), `${s}`);
  assert.equal(aurumCacheDungeonKey(0), 'd0');
  assert.equal(aurumCacheDungeonKey(0xffffffff), 'd4294967295');
  for (const bad of [-1, 2 ** 32, 1.5, '12', null, NaN]) assert.equal(aurumCacheDungeonKey(bad), null, `${bad}`);
});

test('AURUM-CACHES BALANCE (the owner: "ensure the aurem caches are balanced"): a cache worth at least two quests\' finds; the caches\' day at most three quarters of the finds\' own; a regular day (four dungeons) finding about one; a dungeon visit worth 5 to 10 Aurum on average - noticed, never a reason to skip a quest (mutants: the Aurum, the share)', () => {
  assert.ok(AURUM_CACHE_AURUM >= 2 * PASS_SOURCES.quest, 'a cache is worth two quests');
  assert.ok(AURUM_CACHE_AURUM * AURUM_CACHE_DAY_MAX <= 0.75 * PASS_DAY_AURUM, 'the finds stay the first way Aurum is earned');
  const regular = 4 * AURUM_CACHE_SHARE, visit = AURUM_CACHE_AURUM * AURUM_CACHE_SHARE;
  assert.ok(regular >= 0.9 && regular <= 1.1, `about one cache a regular day (${regular})`);
  assert.ok(visit >= 5 && visit <= 10, `a visit's worth (${visit})`);
});

test('AURUM-CACHES a quarter of the places on a day, the Bay\'s and past it: over sixty days each share holds to 0.25 within a point (PIN MOVED, AURUM-CACHES BALANCE), a place\'s days are independent of each other, and the next day\'s caches are another fifth (mutants: the share\'s test turned, the day not hashed, the place not hashed)', () => {
  for (const [name, ids] of [['the Bay', BAY], ['past the Bay', LAIRS]]) {
    let n = 0, both = 0, first = 0;
    for (let d = DAY; d < DAY + 60; d++) {
      for (const id of ids) {
        const p = aurumCacheDungeonKey(id), h = aurumCacheHolds(d, p);
        n += h ? 1 : 0;
        if (h) { first++; if (aurumCacheHolds(d + 1, p)) both++; }
      }
    }
    const share = n / (ids.length * 60);
    assert.ok(share > 0.24 && share < 0.26, `${name}: ${share}`);
    const again = both / first;
    assert.ok(again > 0.23 && again < 0.27, `${name}: a cache today says nothing of tomorrow (${again})`);
  }
  const today = new Set(holding(BAY, DAY, 1e9)), tomorrow = new Set(holding(BAY, DAY + 1, 1e9));
  const kept = [...today].filter((p) => tomorrow.has(p)).length / today.size;
  assert.ok(kept < 0.35, `the caches move each day (${kept} stay)`);
  assert.ok(aurumCacheUnit('a') !== aurumCacheUnit('b') && aurumCacheUnit('20391:d5') !== aurumCacheUnit('20392:d5'), 'the hash parts its neighbours');
  for (const s of ['', 'x', '20391:d5', '20391:d5|pile']) { const u = aurumCacheUnit(s); assert.ok(u >= 0 && u < 1, s); }
});

test('AURUM-CACHES the id: `<day>:d<dungeon>`, read back to its day and place in its one spelling; a place that holds none that day, a second spelling, another kind of place or a bad day is no cache\'s (mutants: a place not held read as a cache, a leading zero let through)', () => {
  const [p] = holding(BAY, DAY, 1), [q] = holding(LAIRS, DAY, 1), [no] = holding(BAY, DAY, 1, true);
  assert.ok(Number(q.slice(1)) > 0xfffff && Number(p.slice(1)) < 500_000, 'a lair past the Bay keys by its whole id, a Bay dungeon by its pixel id');
  for (const place of [p, q]) {
    const id = aurumCacheId(DAY, place);
    assert.equal(id, `${DAY}:${place}`);
    assert.deepEqual(aurumCacheOf(id), { day: DAY, place });
  }
  assert.equal(aurumCacheOf(aurumCacheId(DAY, no)), null, 'a place that holds no cache today');
  assert.equal(aurumCacheHolds(DAY, no), false);
  const n = p.slice(1);
  for (const bad of [`0${DAY}:${p}`, `${DAY}:d0${n}`, `${DAY}:p${n}`, `${DAY}:${p} `, ` ${DAY}:${p}`, `${DAY}:D${n}`, `-1:${p}`, `${DAY}.5:${p}`,
    `${DAY}:d4294967296`, `${DAY}:d99999999999`, `${DAY}`, p, '', null, 7, { id: `${DAY}:${p}` }]) {
    assert.equal(aurumCacheOf(bad), null, JSON.stringify(bad));
  }
  assert.equal(aurumCacheHolds(-1, p), false);
  assert.equal(aurumCacheHolds(1.5, p), false);
  assert.equal(aurumCacheHolds(DAY, 'd01'), false, 'a place in a second spelling holds nothing');
});

test('AURUM-CACHES the check: a cache\'s id is taken on its own UTC day and on the next (one found just before midnight), never the day after nor before it is found (mutants: yesterday refused, the day after taken, a day ahead taken)', () => {
  const [p] = holding(LAIRS, DAY, 1);
  const id = aurumCacheId(DAY, p), at = (d, h = 0) => (d * 86_400) + h * 3600;
  assert.equal(aurumCacheIdOk(id, at(DAY, 12)), true, 'its own day');
  assert.equal(aurumCacheIdOk(id, at(DAY + 1, 0) + 30), true, 'just past midnight');
  assert.equal(aurumCacheIdOk(id, at(DAY + 1, 23)), true, 'all of the next day');
  assert.equal(aurumCacheIdOk(id, at(DAY + 2, 0)), false, 'the day after that');
  assert.equal(aurumCacheIdOk(id, at(DAY - 1, 23)), false, 'before its day');
  assert.equal(aurumCacheIdOk(`${DAY}:${holding(LAIRS, DAY, 1, true)[0]}`, at(DAY, 12)), false, 'a place that holds none');
  assert.equal(aurumCacheIdOk('nope', at(DAY, 12)), false);
});

test('AURUM-CACHES the spot: a pile in [0, 1) and a bearing in [0, 2 pi) off the id alone - the same on every client, another for another id (mutants: the pile not the id\'s)', () => {
  const ids = holding(BAY, DAY, 50).map((p) => aurumCacheId(DAY, p));
  const spots = ids.map(aurumCacheSpotOf);
  for (const s of spots) assert.ok(s.pile >= 0 && s.pile < 1 && s.bearing >= 0 && s.bearing < 2 * Math.PI);
  assert.deepEqual(aurumCacheSpotOf(ids[0]), spots[0], 'the same id, the same spot');
  assert.ok(new Set(spots.map((s) => Math.floor(s.pile * 8))).size >= 6, 'the piles spread');
  assert.ok(new Set(spots.map((s) => Math.floor(s.bearing))).size >= 5, 'the bearings spread');
  assert.notEqual(spots[0].pile, spots[0].bearing / (2 * Math.PI), 'two draws, not one');
});
