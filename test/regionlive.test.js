// RP1 - THE REGION IS READ LIVE, NOT CAPTURED AT BOOT (2026-08-29).
//
// createTownTalk took `regionIndex` as a plain NUMBER, and the world
// host had no choice but to hand it `startLoc.regionIndex`. Every
// region-keyed answer in the module therefore stayed the BOOT region's
// for the whole session, however far the player streamed. Three things
// went stale together:
//
//   - the wandering NPC race, a `const` computed at construction, which
//     is what picks the oath pool (%oth);
//   - the People faction the reaction law reads, resolved once inside
//     ensureLoaded;
//   - and the map-discovery KEY, `${region}:${city}`. That one is the
//     worst: a building discovered in Daggerfall after walking out of
//     Betony was FILED UNDER BETONY, so the reveal never appeared where
//     the player actually was.
//
// The flag said this waited on "the current-pixel region wiring [to
// land] with travel". world.js's _questRegionIndex - the same
// PlayerGPS.CurrentRegionIndex read the quest bridge, the map table and
// the name bank already go through - had shipped. The fifth "blocker
// retired, sentence stayed" of this run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');

test('RP1: the module normalises a NUMBER or a GETTER into one live read', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /const regionNow = typeof regionIndex === 'function' \? regionIndex : \(\) => regionIndex;/,
    'both shapes are accepted - the dev hosts each build one location and cannot stream out of it');
  // and nothing downstream may reach the raw parameter again: that is
  // how one of the three sites would quietly stay stale.
  // the sweep starts AFTER the normalising line - that line is the one
  // place the raw parameter is legitimately named, and a sweep that
  // flags its own subject can never pass (PY1's self-exemption, kept
  // narrow: one line, not a whole named block).
  const norm = tt.indexOf('const regionNow =');
  const body = tt.slice(tt.indexOf('\n', norm) + 1);
  const raw = [...body.matchAll(/(?<![.\w])regionIndex(?![\w:])/g)];
  assert.deepEqual(raw.map((m) => body.slice(Math.max(0, m.index - 40), m.index + 20).trim()), [],
    'every downstream read goes through regionNow(), never the captured parameter');
});

test('RP1: the NPC race is a live read, not a boot constant', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.equal(/const npcRace = REGION_RACES\[/.test(tt), false,
    'the `const` computed at construction is gone');
  assert.match(tt, /const npcRaceNow = \(\) => \(REGION_RACES\[regionNow\(\)\] === 1 \? 'Redguard' : 'Breton'\);/);
  // both %oth expansions read it at CALL time - they are the consumers
  // that made the staleness visible in play (a Redguard region's oaths
  // spoken by Bretons, or the reverse).
  assert.equal((tt.match(/oathTextId\(npcRaceNow\(\)\)/g) ?? []).length, 2,
    'both oath sites call it rather than closing over a value');
});

test('RP1: the People lookup re-runs on a border crossing, and only then', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.match(tt, /if \(r !== _peopleRegion\) \{ _peopleRegion = r; people = getPeopleOfCurrentRegion\(factions\.factionDict, r\); \}/,
    'memoised by region - FACTION.TXT is parsed once and kept; only the per-region lookup re-runs');
  // the guard matters both ways: no cache and every reaction roll
  // re-walks the faction dict; no invalidation and the boot region's
  // people answer for ever, which is the bug this slice is about.
  assert.match(tt, /if \(!factions\) return people;/, 'and it answers honestly before FACTION.TXT loads');
  // every reader goes through the memo, not the raw binding
  for (const call of ['const reaction = peopleNow() ?', 'const rp = peopleNow() ?', 'people: peopleNow()?.name']) {
    assert.ok(tt.includes(call), `reader moved to the memo: ${call}`);
  }
});

test('RP1: the map-discovery key is the CURRENT region', () => {
  const tt = read('src/scenes/townTalk.js');
  assert.equal(tt.includes('discoverBuilding(`${regionIndex}:${cityName()}`'), false,
    'the boot-region key filed a Daggerfall building under Betony');
  assert.match(tt, /discoverBuilding\(`\$\{regionNow\(\)\}:\$\{cityName\(\)\}`, building\)/);
});

test('RP1: the world host passes its live PlayerGPS read; the dev hosts keep their number', () => {
  const world = read('src/scenes/world.js');
  assert.equal(/regionIndex: startLoc\.regionIndex,/.test(world), false, 'the boot capture is gone');
  assert.match(world, /regionIndex: \(\) => _questRegionIndex\(\),/,
    'the world host hands the same CurrentRegionIndex read its quest bridge uses');
  // ...and it is the SAME getter, not a second implementation of it
  assert.match(world, /const _questRegionIndex = \(\) => \{[\s\S]*?maps\.getRegionIndexAt\(px\.x, px\.y\)/);
  // the exterior dev host builds exactly one location and cannot stream
  // out of it, so its number is correct and must not be churned into a
  // getter for symmetry's sake.
  // anchored at the createTownTalk call itself: exterior.js names
  // `regionIndex: dfLocation.regionIndex,` in six other places, and a
  // free-floating match would let the one that matters churn unseen.
  const ex = read('src/scenes/exterior.js');
  const head = ex.slice(ex.indexOf('const townTalk = createTownTalk({'), ex.indexOf('const townTalk = createTownTalk({') + 200);
  assert.match(head, /\n    regionIndex: dfLocation\.regionIndex,\n/,
    'a host that cannot change region keeps its plain value');
});

test('RP1: the retired claim has no second home', () => {
  // CQ1b's discipline, applied at the time rather than an hour later.
  // EF1c's unquote rule: a correction may quote what it retired.
  const world = read('src/scenes/world.js').replace(/"[^"]*"/g, '""');
  assert.equal(/the People faction rides the START location/.test(world), false);
  assert.equal(/cross-region streaming keeps the boot region/.test(world), false);
});
