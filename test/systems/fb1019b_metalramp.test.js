// METAL-RAMP (2026-10-19, Discord #suggestions "Weapon/Armor Materials", through Mac; Mac: "Level ramp"): "any new
// character can wander outside, kill some easy orcs on the overworld, and get orcish gear right from the get-go ...
// Newbies are skipping 90% of the gear material progression by accident". Unleveled Loot's AddOrcish and AddDaedric read
// no level: an Orc Warlord's 19.8% at Luck 50 was Orcish at level 1 as at 40. A granted drop is now its race's metal on a
// draw of Range(0, 20) under the killer's level, and the level's rung of the middle metals when the draw withholds it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METAL_RAMP_FULL, rampMetal, addDaedric, addOrcish, unlevelDroppedLoot, _resetUnleveledLoot, setUnleveledLootWorld, _worldReader } from '../../src/systems/unleveledLoot.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';

const seq = (...vs) => { let i = 0; return () => vs[i++ % vs.length]; };
const fixed = (v) => () => v;
/** A stream that counts its draws. */
const counted = (...vs) => { const f = seq(...vs); const g = () => { g.n++; return f(); }; g.n = 0; return g; };
const draw = (n, of) => (n + 0.5) / of;   // Range(0, of) answers n
const career = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });
const saved = _worldReader();
const world = (level) => setUnleveledLootWorld({
  playerEntity: () => ({ level, stats: { luck: 50 }, gender: 'male', raceId: 1 }),
  insideOpenShop: () => false, buildingQuality: () => 0, insideDungeon: () => true, regionIndex: () => 17, locationDungeonType: () => 7,
});

test('METAL-RAMP: the middle metals by level - Elven 1-4, Dwarven 5-8, Mithril 9-12, Adamantium 13-16, Ebony 17 and up; the ramp full at 20 (mutants: a rung moved, the ramp\'s top moved)', () => {
  assert.equal(METAL_RAMP_FULL, 20);
  assert.deepEqual(Array.from({ length: 21 }, (_, i) => rampMetal(i + 1)),
    [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7]);
  assert.equal(rampMetal(0), 3, 'no level reads as level 1');
});

test('METAL-RAMP: a granted drop is the race\'s metal on exactly `level` of the ramp\'s twenty draws, the level\'s rung on the rest - an Orc Warlord\'s weapon and a Daedra Lord\'s plate, at every level under 20 (mutants: the ramp\'s comparison turned, the rung ignored, the plate\'s metal left Daedric)', () => {
  _resetUnleveledLoot();
  for (let level = 1; level < METAL_RAMP_FULL; level++) {
    let orcish = 0, daedric = 0;
    for (let r = 0; r < 20; r++) {
      const sword = []; addOrcish(sword, 24, seq(0.999, draw(r, 20), 0.999, 0.5, 0.5), level);
      assert.equal(sword.length, 1);
      assert.equal(sword[0].group, 'Weapons');
      if (sword[0].material === 8) orcish++; else assert.equal(sword[0].material, rampMetal(level), `level ${level}: the withheld drop is its rung`);
      const plate = []; addDaedric(plate, 31, seq(0.999, draw(r, 20), 0, 0.5, 0.2, 0.999, 0.999), level);
      assert.equal(plate[0].group, 'Armor');
      if (plate[0].material === 521) daedric++; else assert.equal(plate[0].material, 0x0200 + rampMetal(level), `level ${level}: plate of the rung's metal`);
    }
    assert.equal(orcish, level, `level ${level}: Orcish on ${level} draws in 20`);
    assert.equal(daedric, level, `level ${level}: Daedric on ${level} draws in 20`);
  }
});

test('METAL-RAMP: at 20 and up the mod stands as it was - no draw more, its race\'s metal always; a refused drop draws no ramp either (mutant: the ramp drawn at the full level)', () => {
  _resetUnleveledLoot();
  for (const level of [20, 35]) {
    const g = counted(0.999, 0.999, 0.5, 0.5); const loot = [];
    addOrcish(loot, 24, g, level);
    assert.equal(loot[0].material, 8);
    const at20 = g.n;
    const h = counted(0.999, 0, 0.999, 0.5, 0.5); const low = [];
    addOrcish(low, 24, h, 10);
    assert.equal(h.n, at20 + 1, 'the ramp is one draw, under 20 alone');
  }
  const refused = counted(0.80); addDaedric([], 27, refused, 1);
  assert.equal(refused.n, 1, 'a Daedroth\'s 80 is not over 80: the mod\'s one draw and nothing after');
});

test('METAL-RAMP: the corpse reads the level the raiser names (a room\'s base), else the player\'s (mutants: the corpse\'s level dropped to the default)', () => {
  _resetUnleveledLoot();
  world(30);
  const warlord = makeEnemyEntity(24, ENEMY_BASICS[24], career(), 1, fixed(0.5)); warlord.items = [];
  unlevelDroppedLoot(warlord, { rolls: seq(0.999, 0.999, 0.999, 0.5, 0.5), luck: 50, level: 1 });
  assert.equal(warlord.items[0].material, 3, 'a level-1 room\'s Warlord: Elven, though the player is 30');
  const own = makeEnemyEntity(24, ENEMY_BASICS[24], career(), 1, fixed(0.5)); own.items = [];
  world(2);
  unlevelDroppedLoot(own, { rolls: seq(0.999, 0.999, 0.999, 0.5, 0.5), luck: 50 });
  assert.equal(own.items[0].material, 3, 'the player\'s level 2: Elven');
  setUnleveledLootWorld(saved); _resetUnleveledLoot();
});
