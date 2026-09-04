// DT1 - THE DETECT SCAN'S LOOT POOL WAS SHORT IN THREE OF FOUR HOSTS.
//
// PlayerGPS.UpdateNearbyObjects (:747-776) has ONE loot walk:
//
//     foreach (DaggerfallLoot loot in ActiveGameObjectDatabase.GetActiveLoot())
//
// No scene gate, no kind gate, no item test. GetLootFlags (:822-836)
// then sets the Treasure bit iff `loot.Items.Count > 0`, so an empty
// container is IN the list and simply unlit - which is a different
// thing from being absent, because the activation walks DO filter on
// items and the two must not be confused.
//
// The port had four hosts each deciding for itself which of its own
// loot kinds counted:
//
//   world.js / exterior.js   dropped piles + corpses   (right, at FX1)
//   dungeonContext.js        RDB piles ONLY - no corpses, no drops
//   worldModes.js interior   NOTHING AT ALL
//
// so FX1's own finding (F207: "UpdateNearbyObjects walks EVERY active
// DaggerfallLoot with no scene gate") survived untouched in the two
// hosts where Detect Treasure is actually cast. Underground it missed
// the corpse you had just made and the sack you had just dropped;
// indoors all THREE Detect spells were blind, because that feed was
// handed neither pool.
//
// The interior half had a reason written beside it - "both pools are
// empty until interior loot containers ship" - and it had been false
// since S2b/E2 gave the host containers and shelves and IF gave it a
// foe pool. DaggerfallInterior.AddFurnitureAction (:780-841) is the
// DFU member: shop shelves at :796-801, house containers at :829-838,
// each an AddComponent<DaggerfallLoot>.
//
// The fix is one exported walk (shared.js's nearbyLootRecords) that
// every host names its kinds to, so "every active loot container" is
// one sentence again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpseNearbyRecords, containerNearbyRecord, nearbyLootRecords } from '../src/scenes/shared.js';
import { updateNearbyObjects, getNearbyObjects, detectedMarkers, NEARBY } from '../src/systems/nearbyObjects.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A furniture model as interiorContext builds it: a cpu mesh, a
 *  matrix whose last row is its world translation, and `items: null`
 *  until the player opens it. */
const furniture = (x, y, z, items = null) => ({
  matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  items,
});
const gold = (n) => Array.from({ length: n }, (_, i) => ({ name: `item${i}` }));

test('DT1: a stocked shelf is a Treasure object at its matrix translation', () => {
  const rec = containerNearbyRecord(furniture(3, 1, -4, gold(2)));
  assert.deepEqual(rec.pos, [3, 1, -4]);
  assert.equal(rec.itemCount, 2);
  const list = updateNearbyObjects([0, 0, 0], { loot: [rec] });
  assert.equal(list.length, 1);
  assert.equal(list[0].flags & NEARBY.Treasure, NEARBY.Treasure);
});

test('DT1: an UNBROWSED shelf is IN the list and carries no Treasure bit', () => {
  // PlayerActivate.cs:881-886 stocks a shelf on first access, so
  // Items.Count is 0 until then - the port's `items: null` is that
  // same state, and it must be present-but-unlit, not absent.
  const rec = containerNearbyRecord(furniture(1, 0, 1));
  assert.equal(rec.itemCount, 0);
  const list = updateNearbyObjects([0, 0, 0], { loot: [rec] });
  assert.equal(list.length, 1, 'present in the nearby list');
  assert.equal(list[0].flags & NEARBY.Treasure, 0, 'but not treasure');
  assert.equal(getNearbyObjects(list, NEARBY.Treasure).length, 0);
});

test('DT1: a container with no matrix contributes no position, so the scan drops it', () => {
  assert.equal(containerNearbyRecord({ items: gold(3) }).pos, null);
  assert.equal(updateNearbyObjects([0, 0, 0], { loot: [containerNearbyRecord({})] }).length, 0);
});

test('DT1: corpses are read through BOTH foe pools’ field names', () => {
  // exteriorFoes raises `corpse` beside `corpseMarker`; dungeonContext
  // keeps `corpseBatch`. Same fact, two spellings.
  const ext = { corpse: true, corpseMarker: { pos: [5, 0, 0] }, ai: { feet: [9, 9, 9] }, entity: { items: gold(1) } };
  const dun = { corpseBatch: {}, ai: { feet: [0, 0, 6] }, entity: { items: gold(1) } };
  const recs = corpseNearbyRecords([ext, dun]);
  assert.equal(recs.length, 2);
  assert.deepEqual(recs[0].pos, [5, 0, 0], 'the marker position wins over ai.feet');
  assert.deepEqual(recs[1].pos, [0, 0, 6], 'and ai.feet is the fallback');
});

test('DT1: a live foe and a dead-with-no-corpse foe mint no container', () => {
  const live = { ai: { feet: [1, 0, 1] }, entity: { items: gold(4) } };
  // the cull's "gone, no corpse" arm - DFU mints no CorpseMarker there
  const vanished = { dead: true, ai: { feet: [2, 0, 2] }, entity: { items: gold(4) } };
  assert.deepEqual(corpseNearbyRecords([live, vanished]), []);
  assert.deepEqual(corpseNearbyRecords(null), []);
});

test('DT1: an EMPTY corpse is in the list, unlit - the activation walk is what filters on items', () => {
  const empty = { corpse: true, ai: { feet: [1, 0, 0] }, entity: { items: [] } };
  const recs = corpseNearbyRecords([empty]);
  assert.equal(recs.length, 1, 'GetActiveLoot has no item test');
  const list = updateNearbyObjects([0, 0, 0], { loot: recs });
  assert.equal(list[0].flags & NEARBY.Treasure, 0, 'GetLootFlags withholds the bit');
});

test('DT1: nearbyLootRecords is the one walk - piles, containers and corpses in that order', () => {
  const out = nearbyLootRecords({
    piles: [{ pos: [1, 0, 0], items: gold(1) }],
    containers: [furniture(2, 0, 0, gold(1))],
    foes: [{ corpse: true, ai: { feet: [3, 0, 0] }, entity: { items: gold(1) } }],
  });
  assert.deepEqual(out.map((r) => r.pos[0]), [1, 2, 3]);
  assert.deepEqual(nearbyLootRecords(), [], 'every kind defaults to nothing');
});

test('DT1: end to end - Detect Treasure indoors marks the stocked shelf and not the empty one', () => {
  const entity = { activeEffects: [{ kind: 'detectTreasure' }] };
  const loot = nearbyLootRecords({
    containers: [furniture(2, 0, 0, gold(3)), furniture(-2, 0, 0)],
  });
  const list = updateNearbyObjects([0, 0, 0], { loot });
  assert.deepEqual(detectedMarkers(entity, list), [[2, 0]]);
});

test('DT1: all four hosts name their kinds to the one walk', () => {
  const feed = (src, marker) => {
    const i = src.indexOf(marker);
    assert.ok(i > 0, `${marker} not found`);
    return src.slice(i, i + 900);
  };
  const wm = read('src/scenes/worldModes.js');
  const w = read('src/scenes/world.js');
  const e = read('src/scenes/exterior.js');
  const d = read('src/scenes/dungeonContext.js');
  // the interior host: containers (shelves AND furniture) + its foes.
  // AUDIT 58 WIDENED BOTH READS. UpdateNearbyObjects walks ONE
  // database (PlayerGPS.cs:747-777) and this host has TWO pools -
  // interiorFoes and ROAD-B's indoor watch - so Detect Enemy showed an
  // empty room with 2-5 Knight_CityWatch standing in it and Detect
  // Treasure missed their corpses. `interiorFoePool()` is the join,
  // raw: the loot walk NEEDS the dead (a corpse is the container).
  const wmFeed = feed(wm, 'const detectFeed = createDetectFeed');
  assert.match(wmFeed, /nearbyLootRecords\(\{/);
  assert.match(wmFeed, /interiorCtx\?\.shelves/);
  assert.match(wmFeed, /interiorCtx\?\.containers/);
  assert.match(wmFeed, /foes: interiorFoePool\(\),/);
  assert.match(wmFeed, /entities: \(\) => interiorFoePool\(\)\.filter\(\(f\) => !f\.dead && f\.ai\)/, 'the entity pool too');
  assert.doesNotMatch(wmFeed, /interiorFoes\?\.foes \?\? \[\]/,
    'and neither read is narrowed to one of the two pools any more');
  assert.match(wm, /const interiorFoePool = \(\) => \[\.\.\.\(interiorFoes\?\.foes \?\? \[\]\), \.\.\.\(interiorGuards\?\.guards \?\? \[\]\)\];/,
    'the join has ONE home in this host');
  // the dungeon: the RDB piles, the player’s drops, and its foes
  const dFeed = feed(d, 'const detectFeed = createDetectFeed');
  assert.match(dFeed, /piles: \[\.\.\.lootPiles, \.\.\.droppedLoot\._piles\], foes \}/);
  // the two exterior hosts
  assert.match(feed(w, 'const detectFeed = createDetectFeed'),
    /nearbyLootRecords\(\{ piles: droppedLoot\._piles, foes: exteriorFoePool\(\) \}\)/);
  assert.match(feed(e, 'const detectFeed = createDetectFeed'),
    /nearbyLootRecords\(\{ piles: droppedLoot\._piles, foes: cityGuards\.guards \}\)/);
  // and no host keeps a private corpse walk any more
  for (const [name, src] of [['worldModes', wm], ['world', w], ['exterior', e], ['dungeonContext', d]]) {
    assert.doesNotMatch(src, /corpseMarker\?\.pos \?\? \w+\.ai\?\.feet/, `${name} still has an inline corpse walk`);
  }
});

test('DT1: the retired sentences are gone from worldModes', () => {
  const wm = read('src/scenes/worldModes.js');
  // each of these was FALSE when DT1 read it, and the port's law is
  // that retiring a flag DELETES the sentence rather than annotating it
  assert.doesNotMatch(wm, /both\s*\n?\s*\/\/ pools are empty until interior loot containers ship/);
  assert.doesNotMatch(wm, /there is nowhere to cash one yet/);
  assert.doesNotMatch(wm, /The BANKING arm stays FLAGGED below/);
  assert.doesNotMatch(wm, /Every other arm is\n\s*\/\/ FLAGGED by name in guildServiceFlow/);
});
