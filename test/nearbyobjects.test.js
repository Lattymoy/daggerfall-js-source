// X4: PlayerGPS's NEARBY OBJECTS scan - the producer three ported
// laws were waiting on (the three Detect effects, mysticism's
// dispelNearby, and enchantments' nearbyFoes dep).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NEARBY, REFRESH_NEARBY_OBJECTS_INTERVAL, NEARBY_DEFAULT_MAX_RANGE,
  entityFlags, lootFlags, updateNearbyObjects, getNearbyObjects, createNearbyScan,
} from '../src/systems/nearbyObjects.js';

test('X4 nearby: the flag bits are the classic powers of two, and the two constants are DFU\'s', () => {
  assert.deepEqual({ ...NEARBY },
    { None: 0, Enemy: 1, Treasure: 2, Magic: 4, Undead: 8, Daedra: 16, Humanoid: 32, Animal: 64 });
  assert.equal(REFRESH_NEARBY_OBJECTS_INTERVAL, 0.33);   // PlayerGPS.cs:39
  assert.equal(NEARBY_DEFAULT_MAX_RANGE, 14);            // PlayerGPS.cs:538
});

test('X4 nearby: the group bit is the CAREER switch, not the port\'s affinity field', () => {
  // FormulaHelper.GetEnemyEntityEnemyGroup is a hardcoded CareerIndex
  // switch. The port's ENEMY_BASICS.affinity is a DIFFERENT nine-value
  // classification (it carries Darkness/Daylight/Golem/Water, which
  // EnemyGroups has no member for) - reaching for it here would
  // misgroup half the bestiary.
  const g = (mobileType) => entityFlags({ mobileType });
  // an ordinary animal and an ordinary humanoid
  assert.equal(g(0), NEARBY.Enemy | NEARBY.Animal, 'Rat');
  assert.equal(g(7), NEARBY.Enemy | NEARBY.Humanoid, 'Orc');
  assert.equal(g(15), NEARBY.Enemy | NEARBY.Undead, 'SkeletalWarrior');
  assert.equal(g(25), NEARBY.Enemy | NEARBY.Daedra, 'FrostDaedra');
  // the five careers where DFU DEPARTS from classic's grouping - each
  // would land in a different group if the table were guessed
  assert.equal(g(17), NEARBY.Enemy | NEARBY.Undead, 'Zombie is UNDEAD (classic grouped it as animal)');
  assert.equal(g(41), NEARBY.Enemy | NEARBY.Humanoid, 'Dreugh is HUMANOID (classic grouped it as undead)');
  assert.equal(g(42), NEARBY.Enemy | NEARBY.Humanoid, 'Lamia is HUMANOID (classic grouped it as undead)');
  assert.equal(g(39), NEARBY.Enemy | NEARBY.Animal, 'Horse_Invalid is ANIMAL (classic grouped it as undead)');
  assert.equal(g(40), NEARBY.Enemy | NEARBY.Animal, 'Dragonling_Alternate is ANIMAL (classic grouped it as undead)');
  // the four atronachs are an EXPLICIT None - Enemy, no group bit
  for (const at of [35, 36, 37, 38]) assert.equal(g(at), NEARBY.Enemy, `atronach ${at} takes no group bit`);
  // AUDIT 26 F080: a CLASS enemy reaches the switch through its
  // careerIndex (ID - 128) and COLLIDES into a monster career's group
  // - the old pin here asserted the None answer the audit refuted.
  assert.equal(g(128), NEARBY.Enemy | NEARBY.Animal, 'the Mage rides Rat\'s slot');
  assert.equal(g(146), NEARBY.Enemy | NEARBY.Undead, 'the City Watch rides Ghost\'s');
});

test('X4 nearby: a civilian is Humanoid and NEVER Enemy; the Magic bit is any live effect', () => {
  // DFU's civilian branch is an `else if` - it skips the group switch
  // entirely, so a townsperson is a Detect Enemy miss and a
  // BadReactionsFrom humanoid hit at the same time.
  assert.equal(entityFlags({ civilian: true, mobileType: 0 }), NEARBY.Humanoid);
  // the Magic bit rides EFFECT COUNT alone, on either kind - DFU's own
  // acknowledged approximation ("just assuming entity has active
  // effects"), which is why a buffed friendly civilian lights up
  // Detect Magic
  assert.equal(entityFlags({ civilian: true, effectCount: 1 }), NEARBY.Humanoid | NEARBY.Magic);
  assert.equal(entityFlags({ mobileType: 0, effectCount: 3 }), NEARBY.Enemy | NEARBY.Animal | NEARBY.Magic);
  assert.equal(entityFlags({ mobileType: 0, effectCount: 0 }), NEARBY.Enemy | NEARBY.Animal);
  assert.equal(entityFlags(null), NEARBY.None);
});

test('X4 nearby: an EMPTY container is not treasure', () => {
  assert.equal(lootFlags({ itemCount: 1 }), NEARBY.Treasure);
  assert.equal(lootFlags({ itemCount: 0 }), NEARBY.None);
  assert.equal(lootFlags({}), NEARBY.None);
  assert.equal(lootFlags(null), NEARBY.None);
});

const at = (x, extra = {}) => ({ pos: [x, 0, 0], ...extra });

test('X4 nearby: the query is an ALL-BITS match, not any-bits', () => {
  // `(no.flags & flags) == flags` - the single quirk most likely to be
  // ported as `!== 0` and silently over-report.
  const list = updateNearbyObjects([0, 0, 0], {
    entities: [at(1, { mobileType: 15 }), at(2, { mobileType: 25 })],   // skeleton, frost daedra
  });
  assert.equal(getNearbyObjects(list, NEARBY.Enemy).length, 2);
  assert.equal(getNearbyObjects(list, NEARBY.Undead).length, 1);
  assert.equal(getNearbyObjects(list, NEARBY.Enemy | NEARBY.Undead).length, 1, 'both bits present on the skeleton');
  assert.equal(getNearbyObjects(list, NEARBY.Undead | NEARBY.Daedra).length, 0,
    'no entity carries two group bits, so an any-bits port would wrongly answer 2');
  // a None query answers NULL, not an empty list
  assert.equal(getNearbyObjects(list, NEARBY.None), null);
});

test('X4 nearby: the range test is STRICT, and inactive objects are a separate set', () => {
  const list = updateNearbyObjects([0, 0, 0], {
    entities: [at(13.999, { mobileType: 0 }), at(14, { mobileType: 0 }), at(14.001, { mobileType: 0 })],
  });
  assert.equal(getNearbyObjects(list, NEARBY.Enemy).length, 1,
    'distance < maxRange - exactly 14 is OUT (the port\'s lone existing nearbyFoes used <=)');
  assert.equal(getNearbyObjects(list, NEARBY.Enemy, 15).length, 3);
  // activeInHierarchy is a MATCH, not a filter-out: asking for false
  // returns the inactive ones
  const mixed = updateNearbyObjects([0, 0, 0], {
    entities: [at(1, { mobileType: 0 }), at(2, { mobileType: 0, active: false })],
  });
  assert.equal(getNearbyObjects(mixed, NEARBY.Enemy).length, 1);
  assert.equal(getNearbyObjects(mixed, NEARBY.Enemy, 14, false).length, 1, 'the inactive set is reachable');
});

test('X4 nearby: distance is measured in 3D at rebuild time, and loot follows entities', () => {
  const list = updateNearbyObjects([0, 10, 0], {
    entities: [{ pos: [0, 13, 4], mobileType: 0 }],
    loot: [{ pos: [3, 10, 4], itemCount: 2 }],
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].distance, 5, 'the vertical leg counts (3,4 in the y/z plane)');
  assert.equal(list[1].distance, 5);
  assert.equal(list[0].flags & NEARBY.Enemy, NEARBY.Enemy);
  assert.equal(list[1].flags & NEARBY.Treasure, NEARBY.Treasure);
  // the record keeps the host's own object so a consumer can act on it
  const ref = { id: 'pile-7' };
  const withRef = updateNearbyObjects([0, 0, 0], { loot: [{ pos: [1, 0, 0], itemCount: 1, ref }] });
  assert.equal(withRef[0].ref, ref);
});

test('X4 nearby: the scan rebuilds on the 0.33s timer and resets rather than banking', () => {
  let builds = 0;
  const scan = createNearbyScan(() => { builds++; return [{ flags: NEARBY.Enemy, distance: 1, active: true }]; });
  scan.tick(0.2);
  assert.equal(builds, 0, 'under the interval, no rebuild');
  assert.equal(scan.list.length, 0);
  scan.tick(0.2);
  assert.equal(builds, 1, '0.4 > 0.33 fires');
  assert.equal(scan.list.length, 1);
  // the timer RESETS to 0 rather than subtracting the interval, so a
  // long frame does not bank a second rebuild (PlayerGPS.cs:356)
  scan.tick(5);
  assert.equal(builds, 2);
  scan.tick(0.1);
  assert.equal(builds, 2, 'the 4.67s overshoot was discarded, not carried');
  // a scene change drops the previous scene's objects
  scan.reset();
  assert.equal(scan.list.length, 0);
});

// ── the bridge: a cast Detect spell -> compass markers ────────────
import { applySpell } from '../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';
import { detectedMarkers, hasLiveDetector, DETECT_KIND_FLAG } from '../src/systems/nearbyObjects.js';

const player = () => ({
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [],
  race: 'Breton', level: 1, health: 20, maxHealth: 20,
});
const castDetect = (ent, subType) => applySpell(
  buildCustomSpell({ slots: [{ type: 39, subType, settings: { ...blankEffectSettings(), durationBase: 10 } }], rangeType: 0 }),
  1, ent, {}, () => 0.5, null, {});

test('X4 detect: the cast lands as a plain duration buff and the catalog stops warning', () => {
  const e = player();
  const out = castDetect(e, 1);   // Detect Enemy
  assert.equal(out.skipped, 0, 'the library honours Detect now');
  assert.equal(out.buffs, 1);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['detectEnemy']);
  assert.ok(e.activeEffects[0].roundsRemaining > 0);
  // AddState stacks ROUNDS onto the incumbent and nothing else
  const first = e.activeEffects[0].roundsRemaining;
  castDetect(e, 1);
  assert.equal(e.activeEffects.length, 1, 'one incumbent, not two');
  assert.ok(e.activeEffects[0].roundsRemaining > first);
  for (const k of ['39,0', '39,1', '39,2']) assert.equal(effectByKey(k).ported, true);
});

test('X4 detect: each spell scans with its OWN flag - Enemy misses treasure and vice versa', () => {
  const list = updateNearbyObjects([0, 0, 0], {
    entities: [{ pos: [3, 0, 0], mobileType: 15 }],              // a skeleton, no effects
    loot: [{ pos: [0, 0, 4], itemCount: 1 }],                    // a full pile
  });
  const enemy = player(); castDetect(enemy, 1);
  const treasure = player(); castDetect(treasure, 2);
  const magic = player(); castDetect(magic, 0);
  assert.deepEqual(detectedMarkers(enemy, list), [[3, 0]], 'Detect Enemy finds the skeleton alone');
  assert.deepEqual(detectedMarkers(treasure, list), [[0, 4]], 'Detect Treasure finds the pile alone');
  assert.deepEqual(detectedMarkers(magic, list), [], 'nothing nearby is enchanted');
  assert.deepEqual({ ...DETECT_KIND_FLAG },
    { detectMagic: NEARBY.Magic, detectEnemy: NEARBY.Enemy, detectTreasure: NEARBY.Treasure });
});

test('X4 detect: a buffed foe lights up Detect MAGIC as well as Detect Enemy - one marker each', () => {
  // DFU's acknowledged approximation: the Magic bit is "entity has
  // active effects". An enchanted skeleton is therefore matched by
  // BOTH spells, and DrawTrackedObjects walks detectors OUTSIDE and
  // objects inside - so a player holding both gets TWO markers on
  // the same bearing, drawn on top of each other.
  const list = updateNearbyObjects([0, 0, 0], {
    entities: [{ pos: [3, 0, 0], mobileType: 15, effectCount: 1 }],
  });
  const both = player();
  castDetect(both, 1); castDetect(both, 0);
  assert.equal(both.activeEffects.length, 2);
  assert.deepEqual(detectedMarkers(both, list), [[3, 0], [3, 0]],
    'two live detectors, two markers - never de-duplicated');
});

test('X4 detect: no live detector means no scan at all, and an ENDED one stops detecting', () => {
  const e = player();
  assert.equal(hasLiveDetector(e), false);
  castDetect(e, 1);
  assert.equal(hasLiveDetector(e), true);
  const list = updateNearbyObjects([0, 0, 0], { entities: [{ pos: [1, 0, 0], mobileType: 0 }] });
  assert.equal(detectedMarkers(e, list).length, 1);
  e.activeEffects[0].ended = true;
  assert.equal(hasLiveDetector(e), false, 'HasEnded is what expires it off registeredDetectors');
  assert.equal(detectedMarkers(e, list).length, 0);
  // a non-detect buff never counts as a detector
  const other = player();
  other.activeEffects.push({ kind: 'levitate', roundsRemaining: 5 });
  assert.equal(hasLiveDetector(other), false);
});

test('X4 detect: the 14-unit reach is the DEFAULT and it counts height', () => {
  const e = player(); castDetect(e, 1);
  const near = updateNearbyObjects([0, 0, 0], { entities: [{ pos: [13, 0, 0], mobileType: 0 }] });
  assert.equal(detectedMarkers(e, near).length, 1);
  const far = updateNearbyObjects([0, 0, 0], { entities: [{ pos: [15, 0, 0], mobileType: 0 }] });
  assert.equal(detectedMarkers(e, far).length, 0);
  // a foe two floors up is OUT even when it is directly overhead -
  // DFU measures full 3D distance, so vertical separation counts
  const above = updateNearbyObjects([0, 0, 0], { entities: [{ pos: [0, 20, 0], mobileType: 0 }] });
  assert.equal(detectedMarkers(e, above).length, 0, 'the dungeon level above does not leak onto the compass');
});

test('X4 detect: a recast and a RESTORE both keep detecting - two DFU defects this shape avoids', () => {
  // DFU registers detectors in a list on the compass, pushed by Start
  // and popped by End. A duplicate cast pushes a second detector the
  // manager then discards as a like-kind merge, and nothing ever
  // deregisters it; and there is no Resume() override, so a Detect
  // spell restored from a save never re-registers and shows nothing
  // for the rest of its duration. The port has no separate registry -
  // activeEffects IS the registry - so neither can happen.
  const e = player();
  castDetect(e, 1);
  castDetect(e, 1);
  assert.equal(e.activeEffects.length, 1, 'a recast merges, leaking no second registration');
  const list = updateNearbyObjects([0, 0, 0], { entities: [{ pos: [1, 0, 0], mobileType: 0 }] });
  assert.equal(detectedMarkers(e, list).length, 1, 'and still detects exactly once');
  // a RESTORED entry (a plain object off a save snapshot) detects at
  // once - there is nothing to re-register
  const restored = player();
  restored.activeEffects.push({ kind: 'detectEnemy', roundsRemaining: 4 });
  assert.equal(hasLiveDetector(restored), true);
  assert.equal(detectedMarkers(restored, list).length, 1);
});

test('FX1 (F207): the OUTDOOR feeds carry loot pools - piles and corpses mark above ground', () => {
  // PlayerGPS.UpdateNearbyObjects walks EVERY active DaggerfallLoot
  // with no scene gate (:747, :766-776) - the "no loot piles above
  // ground" premise the two exterior feeds rested on has been false
  // since droppedLoot mounted. Both hosts feed the world piles AND
  // the corpse containers now, the dungeonContext shape.
  const ROOT2 = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const [p, corpses] of [
    ['src/scenes/world.js', /\[\.\.\.cityGuards\.guards, \.\.\.exteriorFoes\.foes\]/],
    ['src/scenes/exterior.js', /\.\.\.cityGuards\.guards\n/],
  ]) {
    const s = readFileSync(join(ROOT2, p), 'utf8');
    assert.match(s, /loot: \(\) => \[\n\s+\.\.\.droppedLoot\._piles\.map\(lootNearbyRecord\),/, `${p} feeds the world piles`);
    assert.match(s, corpses, `${p} feeds its corpse containers`);
    assert.ok(!s.includes('There are no loot PILES above ground'), `${p}: the false premise is gone`);
    assert.ok(!s.includes('No loot piles above\n      // ground'), `${p}: the false premise is gone (short form)`);
  }
});
