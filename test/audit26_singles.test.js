// AUDIT 26 - two table-key singles (F080, F081).
//
// F080: GetEnemyEntityEnemyGroup switches on CareerIndex, and a class
//       enemy's careerIndex is ID - 128 (EnemyEntity.cs:293) - so the
//       classes COLLIDE into the monster careers' groups, and every
//       consumer (Pacify, Dispel Undead, the nearby-object flags)
//       reads the collision with no class gate. The port had answered
//       None for anything >= 128 and called that DFU behaviour.
// F081: the interior encounter table was keyed by GUESSED BuildingTypes
//       values; the real enum (DFLocation.cs:106-133) puts GuildHall
//       at 11, Temple at 14, Palace at 16.

import test from 'node:test';
import assert from 'node:assert/strict';

import { enemyGroupOf, entityFlags, NEARBY } from '../src/systems/nearbyObjects.js';
import { chooseRandomEnemy, ENCOUNTER_TABLES } from '../src/systems/encounters.js';

const seq = (...vals) => { let i = 0; return () => vals[i++] ?? 0; };

// ── F080 ──────────────────────────────────────────────────────────

test('F080: class enemies take the COLLIDING monster career\'s group', () => {
  // FormulaHelper.cs:2752 switches on careerIndex = ID - 128:
  // Mage 128 -> career 0 = Rat -> Animals; Burglar 135 -> 7 = Orc ->
  // Humanoid; Barbarian 143 -> 15 = SkeletalWarrior, Knight 145 ->
  // 17 = Zombie, City Watch 146 -> 18 = Ghost -> all Undead.
  assert.equal(enemyGroupOf(128), NEARBY.Animal, 'the Mage rides Rat\'s slot');
  assert.equal(enemyGroupOf(135), NEARBY.Humanoid, 'the Burglar rides Orc\'s');
  assert.equal(enemyGroupOf(143), NEARBY.Undead, 'the Barbarian rides SkeletalWarrior\'s');
  assert.equal(enemyGroupOf(145), NEARBY.Undead, 'the Knight rides Zombie\'s');
  assert.equal(enemyGroupOf(146), NEARBY.Undead, 'the City Watch rides Ghost\'s');
  // the monsters answer as before
  assert.equal(enemyGroupOf(0), NEARBY.Animal);
  assert.equal(enemyGroupOf(7), NEARBY.Humanoid);
  assert.equal(enemyGroupOf(25), NEARBY.Daedra);
  for (const at of [35, 36, 37, 38]) assert.equal(enemyGroupOf(at), NEARBY.None, `atronach ${at}`);
});

test('F080: the nearby-object flags carry the class group bit too', () => {
  // GetEntityFlags (:785-804) reads the same switch - Detect scans
  // and Near-X enchantments see a City Watchman as Undead.
  const guard = entityFlags({ mobileType: 146 });
  assert.ok(guard & NEARBY.Enemy);
  assert.ok(guard & NEARBY.Undead, 'the watchman shows on an undead scan');
  const mage = entityFlags({ mobileType: 128 });
  assert.ok(mage & NEARBY.Animal, 'the mage shows on an animal scan');
  // civilians still take Humanoid alone, never Enemy
  const civ = entityFlags({ mobileType: 146, civilian: true });
  assert.equal(civ & NEARBY.Enemy, 0);
  assert.ok(civ & NEARBY.Humanoid);
  assert.equal(civ & NEARBY.Undead, 0, 'the civilian branch skips the group switch');
});

// ── F081 ──────────────────────────────────────────────────────────

test('F081: the interior encounter table keys are the REAL BuildingTypes', () => {
  // RandomEncounters :1351-1363: GuildHall(11)->40, Temple(14)->41,
  // Palace(16) and House1(17)->42, House2(18)->43, House3(19)->44,
  // everything else -> 39. The old map's guessed 10/11/15 sent the
  // Library to the guild list and dropped Temple and Palace to the
  // default.
  const pick = (buildingType) => chooseRandomEnemy({ buildingType, playerLevel: 1 }, seq(0.5, 0));
  assert.equal(pick(11), ENCOUNTER_TABLES[40][0], 'GuildHall');
  assert.equal(pick(14), ENCOUNTER_TABLES[41][0], 'Temple');
  assert.equal(pick(16), ENCOUNTER_TABLES[42][0], 'Palace');
  assert.equal(pick(17), ENCOUNTER_TABLES[42][0], 'House1');
  assert.equal(pick(18), ENCOUNTER_TABLES[43][0], 'House2');
  assert.equal(pick(19), ENCOUNTER_TABLES[44][0], 'House3');
  assert.equal(pick(10), ENCOUNTER_TABLES[39][0], 'Library falls to the default');
  assert.equal(pick(15), ENCOUNTER_TABLES[39][0], 'Tavern falls to the default');
});
