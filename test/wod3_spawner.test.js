// WOD3 - WORLD OF DAGGERFALL: THE SPAWN POINTS (LocationEnemySpawner.cs).
//
// A marker is a state machine over the player's distance: Start's 300
// stands it down for good, Update's 100 springs it once. Every arm's
// rolls are Unity's Random.Range - EXCLUSIVE of its maximum - in the
// C#'s own order, so these pins drive the machine with a scripted roll
// stream and read exactly which arm fires on which roll.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WodSpawner, WOD_SPAWN_RADIUS, WOD_STAND_DOWN_RADIUS, WOD_LOOT_LOCATION_INDEX, WOD_LOOT_ALIGN, FOE_MALE_CHANCE } from '../src/world/wodSpawner.js';
import { alignBillboardToGround, alignControllerToGround } from '../src/world/groundAlign.js';
import { enemyControllerHeight } from '../src/characters/enemyAnchor.js';
import { WOD_SPAWN_TYPE, WOD_ENEMY_ID } from '../src/world/wodLocationObjects.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { DUNGEON_LOOT_KEYS } from '../src/systems/loot.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');

/** A roll stream that answers `vals` in order. */
const script = (...vals) => { let i = 0; return () => { if (i >= vals.length) throw new Error('rolled more than scripted'); return vals[i++]; }; };
/** The [0, 1) value that makes rangeInt(min, max) answer n. */
const pick = (n, min, max) => (n - min + 0.5) / (max - min);
const fresh = (spawnType, enemyID = 0) => new WodSpawner({ spawnType, enemyID, questID: 0 });

test('WOD3: Start stands a marker down for good within 300; Update springs it once within 100', () => {
  assert.deepEqual([WOD_STAND_DOWN_RADIUS, WOD_SPAWN_RADIUS], [300, 100]);
  const near = fresh(WOD_SPAWN_TYPE.Loot);
  assert.equal(near.tick(300), null);
  assert.equal(near.active, false, 'a camp that streams in around you never springs');
  assert.equal(near.tick(50, script()), null, 'and never will');
  const far = fresh(WOD_SPAWN_TYPE.Loot);
  assert.equal(far.tick(300.01), null);
  assert.equal(far.active, true);
  assert.equal(far.tick(100.01), null, 'still out of reach');
  assert.deepEqual(far.tick(100, script(pick(50, 1, 100), pick(46, 0, 47))), { kind: 'loot', record: 46 });
  assert.equal(far.active, false, 'SpawnLoot deactivates the marker');
  assert.equal(far.tick(0, script()), null);
});

test('WOD3: the thieves - Range(1, 3) never reaches the Barbarian, SpawnTrue is 50 chances in 99, gender then facing', () => {
  const s = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bandits);
  s.tick(1000);
  assert.deepEqual(s.tick(10, script(pick(2, 1, 3), pick(50, 1, 100), 0.54, pick(179, 0, 180))),
    { kind: 'foe', mobileType: MOBILE_TYPES.Rogue, hostile: true, allied: false, gender: 'male', yawDeg: 179 });
  const t = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bandits); t.tick(1000);
  assert.deepEqual(t.tick(10, script(0.999999, pick(99, 1, 100), FOE_MALE_CHANCE, 0)),
    { kind: 'foe', mobileType: MOBILE_TYPES.Rogue, hostile: true, allied: false, gender: 'female', yawDeg: 0 }, 'the top of the range is the Rogue, never the Barbarian');
  const u = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bandits); u.tick(1000);
  assert.equal(u.tick(10, script(pick(1, 1, 3), pick(49, 1, 100))), null, '49 does not spawn...');
  assert.equal(u.active, false, '...and the marker is spent all the same');
  const v = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bandits); v.tick(1000);
  assert.equal(v.tick(10, script(pick(1, 1, 3), pick(50, 1, 100), 0.1, 0)).mobileType, MOBILE_TYPES.Thief);
});

test('WOD3: the good thieves are passive and allied; the good bear and warrior arms do nothing and leave the marker live', () => {
  const g = fresh(WOD_SPAWN_TYPE.Good, WOD_ENEMY_ID.Bandits); g.tick(1000);
  assert.deepEqual(g.tick(10, script(pick(1, 1, 3), pick(77, 1, 100), 0.9, pick(90, 0, 180))),
    { kind: 'foe', mobileType: MOBILE_TYPES.Thief, hostile: false, allied: true, gender: 'female', yawDeg: 90 });
  const b = fresh(WOD_SPAWN_TYPE.Good, WOD_ENEMY_ID.Bears); b.tick(1000);
  assert.equal(b.tick(10, script()), null);
  assert.equal(b.active, true, 'the commented-out arm never deactivates');
});

test('WOD3: the bears spawn at 40 and up; the warriors take Range(1, 6), which never reaches the Healer', () => {
  const b = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bears); b.tick(1000);
  assert.equal(b.tick(10, script(pick(39, 1, 100))), null);
  const c = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Bears); c.tick(1000);
  assert.deepEqual(c.tick(10, script(pick(40, 1, 100), 0.2, pick(5, 0, 180))),
    { kind: 'foe', mobileType: MOBILE_TYPES.GrizzlyBear, hostile: true, allied: false, gender: 'male', yawDeg: 5 });
  const arms = [];
  for (let n = 1; n <= 5; n++) {
    const w = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Warriors); w.tick(1000);
    arms.push(w.tick(10, script(pick(n, 1, 6), pick(60, 1, 100), 0.1, 0)).mobileType);
  }
  assert.deepEqual(arms, [MOBILE_TYPES.Warrior, MOBILE_TYPES.Sorcerer, MOBILE_TYPES.Ranger, MOBILE_TYPES.Mage, MOBILE_TYPES.Knight]);
  const edge = (n) => { const e = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Warriors); e.tick(1000); const a = e.tick(10, n >= 50 ? script(pick(1, 1, 6), pick(n, 1, 100), 0.1, 0) : script(pick(1, 1, 6), pick(n, 1, 100))); assert.equal(e.active, false); return a && a.mobileType; };
  assert.deepEqual([edge(49), edge(50)], [null, MOBILE_TYPES.Warrior], 'SpawnTrue >= 50');
  const top = fresh(WOD_SPAWN_TYPE.Enemy, WOD_ENEMY_ID.Warriors); top.tick(1000);
  assert.equal(top.tick(10, script(0.999999, pick(60, 1, 100), 0.1, 0)).mobileType, MOBILE_TYPES.Knight, 'the top of Range(1, 6) is the Knight');
});

test('WOD3: the loot - 1..50 of 1..99 drops a pile at a record in 0..46; the captive marker - Range(1, 40) in four bands', () => {
  const l = fresh(WOD_SPAWN_TYPE.Loot); l.tick(1000);
  assert.equal(l.tick(10, script(pick(51, 1, 100))), null);
  const quest = (n) => { const q = fresh(WOD_SPAWN_TYPE.Quest); q.tick(1000); const a = q.tick(10, script(pick(n, 1, 40))); assert.equal(q.active, false); return a && `${a.archive}.${a.record}`; };
  assert.deepEqual([1, 10, 11, 19, 20, 29, 30, 39].map(quest), ['357.6', '357.6', null, null, '182.0', '182.0', '184.31', '184.31']);
  assert.equal(WOD_LOOT_LOCATION_INDEX, 3);
  assert.equal(DUNGEON_LOOT_KEYS[WOD_LOOT_LOCATION_INDEX], 'N', 'GenerateLoot(loot, 3): dungeon type 3\'s key');
});

test('WOD3: the ground aligns move the CENTRE - a pile to hit + 0.52 whatever its sprite, a walker to hit + 0.52 of its capsule', () => {
  assert.deepEqual({ ...WOD_LOOT_ALIGN }, { sizeY: 1, distance: 2 }, 'SpawnLoot: new Vector2(0, 1f), 2');
  assert.equal(alignBillboardToGround(10, 1.2, 1, 2), 10 + 0.2 - 1.2 + 0.52);
  assert.equal(alignBillboardToGround(10, 2, 1, 2), 10 + 0.2 - 2 + 0.52, 'the ray\'s own end still hits');
  assert.equal(alignBillboardToGround(10, 2.5, 1, 2), 10, 'a miss leaves it');
  assert.equal(alignBillboardToGround(10, null, 1, 2), 10);
  assert.equal(alignBillboardToGround(10, 2.5, 1), 10, 'the default reach is 2');
  assert.equal(alignControllerToGround(10, 2.9, 1.9), 10 + 0.2 - 2.9 + 1.9 * 0.52, 'the default reach is 3');
  assert.equal(alignControllerToGround(10, 3.1, 1.9), 10);
  assert.equal(alignControllerToGround(10, null, 1.9), 10);
  // a walker's feet are its sprite's bottom under the dropped transform:
  // a sprite under 1.6 has a 1.6 capsule (BOTTOM-justified), so the
  // drop leaves it standing proud of the ground, as in DFU
  const idleH = 1.2, h = enemyControllerHeight(idleH, 'General');
  assert.equal(h, 1.6);
  assert.ok(alignControllerToGround(10, 1, h) - idleH / 2 > 10 + 0.2 - 1, 'the short sprite floats until it falls');
});

test('WOD3: the host stands what a marker answers - placed foes out of the cap, passive ones not hostile, piles dying with their pixel', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /tickWodSpawners\(\);   \/\/ WOD3: LocationEnemySpawner\.Update, every exterior frame\n\s*tickCityGates\(minute\);/);
  assert.match(w, /const centre = \[s\.base\[0\], s\.base\[1\] \+ \(h \* s\.scaleY\) \/ 2, s\.base\[2\]\];\n(?:[^\n]*oidSeen[^\n]*\n)?\s*wodSpawners\.push\(\{ spawner: new WodSpawner\(s\), centre, flat: null, restand: false, oid: s\.objectID, oidN: n \}\);/, 'the marker\'s centre, as AlignToBase leaves it');
  assert.match(w, /const kept = carried\.spawners\.get\(w\.centre\.join\(','\)\)\?\.shift\(\);[^\n]*\n\s*if \(!kept\) continue;\n\s*w\.spawner = kept\.spawner;\n\s*w\.flat = kept\.flat;\n\s*w\.restand = !!kept\.flat;/, 'and its state across a rebuild the reference never makes (WOD4\'s carry, WOD5\'s captive), adopted at publish (AUDIT BRANCH (WoD) m4)');
  assert.match(w, /const cx = arriving \? o\[0\] : feet\[0\], cy = arriving \? o\[1\] : feet\[1\] \+ \(standing \? player\.height \/ 2 : 0\), cz = arriving \? o\[2\] : feet\[2\];/, 'PlayerMotor\'s transform is the capsule\'s centre');   // WOD6: the scene origin while an arrival holds it there
  assert.match(w, /const hit = collider\.surfaceHit\(\[x, y \+ 0\.2, z\], _DOWN, 3\);[^\n]*\n\s*exteriorFoes\.spawnFoe\(act\.mobileType, \[x, y, z\], \{ yaw: act\.yawDeg \* Math\.PI \/ 180, gender: act\.gender, allied: act\.allied, placed: true, groundAlign: \{ hitDist: hitDistance\(hit\) \}, site: wodSiteOf\(p, w\) \}\)/, 'made at the marker\'s centre, the ray cast that frame');
  assert.match(w, /if \(f && !act\.hostile && f\.ai\) f\.ai\.isHostile = false;/, 'MobileReactions.Passive');
  assert.match(w, /const hit = collider\.surfaceHit\(\[x, y \+ 0\.2, z\], _DOWN, WOD_LOOT_ALIGN\.distance\);\n\s*const centreY = alignBillboardToGround\(y, hitDistance\(hit\), WOD_LOOT_ALIGN\.sizeY, WOD_LOOT_ALIGN\.distance\);/);
  assert.match(w, /addPileLootExtras\(items, lootKey\);\n\s*rollLootRarity\(items, pileSource\(dungeonRarityTier\(WOD_LOOT_LOCATION_INDEX\)\), \{ luck: liveStat\(playerEntity, 'luck'\) \}\);/, 'LR1: every list a host mints');
  assert.match(w, /droppedLoot\.seedPile\(pile\.items, \[pile\.local\[0\] \+ t\[0\], pile\.local\[1\] \+ t\[1\], pile\.local\[2\] \+ t\[2\]\], \{ archive: pile\.archive, record: pile\.record \}, null, key, \{ unsaved: true \}\);/, 'WOD5: LoadID 0, never saved - pixel-local until it stands (AUDIT BRANCH (WoD) m1)');
  const x = rd('src/scenes/exteriorFoes.js');
  assert.match(x, /const activeCount = \(\) => foes\.filter\(\(f\) => !f\.dead && !f\.puppet && !f\.placed\)\.length;/);
  assert.match(x, /const capped = !questBehaviour && !replacing && !puppet && !placed && !loose;[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(capped && activeCount\(\) \+ spawning\.filter\(\(s\) => s\.capped\)\.length >= MAX_ACTIVE_ENCOUNTER_FOES\) return null;/);   // AUDIT 68 S20-encounter-cap-race: and the spawns still in flight
  assert.match(x, /const pending = \{ feet: \[pos\[0\], pos\[1\] \+ \(feetGiven \|\| groundAlign \? 0 : 0\.1\), pos\[2\]\] \};/, 'no walker\'s lift on an aligned foe');
  assert.match(x, /const centreY = behaviour === 'Flying' \? pos\[1\] : alignControllerToGround\(pos\[1\], groundAlign\.hitDist, enemyControllerHeight\(idleH, behaviour\)\);\n\s*pending\.feet\[1\] \+= centreY - idleH \/ 2 - pos\[1\];/, 'the drop on the capsule the sprite sized, as a delta');
  assert.match(x, /if \(!f\.placed && _playerDist > \(f\.campId != null \? CAMP_CULL_DISTANCE : ENCOUNTER_CULL_DISTANCE\) && /, 'never culled: DFU\'s loose foes stand until a load or a teleport sweeps them');
  assert.match(x, /placed: !!f\.placed,/, 'and across a save');
  assert.match(rd('src/scenes/droppedLoot.js'), /function seedPile\(items, feet, icon, key = null, pixelKey = null, \{ unsaved = false \} = \{\}\)/);
});
