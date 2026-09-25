import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SPAWN_CHANCE, ELITE_CHANCE, ELITE_FOE_MULTIPLIER, ELITE_HEALTH_SCALE, ELITE_DAMAGE_SCALE, isEliteSpawn, spawnsDungeon, synthesizeDungeonLocation, dungeonSightLine } from '../src/world/spawnedDungeons.js';
import { expandEliteEnemies, ELITE_COPY_OFFSET } from '../src/characters/dungeonEnemies.js';
import { calculateAttackDamage, registerFormulaOverride } from '../src/combat/formulas.js';

test('ELITE: the constants are the requested ones', () => {
  assert.equal(ELITE_FOE_MULTIPLIER, 3);
  assert.equal(ELITE_HEALTH_SCALE, 2);
  assert.equal(ELITE_DAMAGE_SCALE, 2);
});

test('ELITE: 30% normal, 10% elite, never both on one pixel, the same answer every load', () => {
  assert.equal(ELITE_CHANCE, 0.10);
  assert.equal(isEliteSpawn(7, 100, 200), isEliteSpawn(7, 100, 200));
  let normal = 0, elite = 0, n = 0;
  for (let x = 0; x < 300; x++) for (let y = 0; y < 200; y++) {
    n++;
    const any = spawnsDungeon(1234, x, y), el = isEliteSpawn(1234, x, y);
    if (el) assert.ok(any, 'an elite pixel is a spawn pixel');
    if (el) elite++; else if (any) normal++;
  }
  assert.ok(Math.abs(normal / n - SPAWN_CHANCE) < 0.015, `normal ~30%, got ${(normal / n).toFixed(3)}`);
  assert.ok(Math.abs(elite / n - ELITE_CHANCE) < 0.015, `elite ~10%, got ${(elite / n).toFixed(3)}`);
});

test('ELITE: the clone keeps the template look, says Elite in its name and carries the flag', () => {
  const template = {
    name: 'Old Ruin', hasDungeon: true, locationIndex: 3,
    mapTableData: { mapId: 9, dungeonType: 4 },
    exterior: { exteriorData: { width: 1, height: 1, locationId: 5, blockNames: ['A.RMB'] } },
    dungeon: { blocks: [{ blockName: 'N0000001.RDB' }], recordElement: { header: { locationId: 5 } } },
  };
  const elite = synthesizeDungeonLocation(template, { salt: 1, px: 10, py: 20, elite: true });
  const plain = synthesizeDungeonLocation(template, { salt: 1, px: 10, py: 20 });
  assert.equal(elite.elite, true);
  assert.equal(plain.elite, false);
  assert.equal(elite.name, 'Elite Old Ruin (10,20)');
  assert.equal(plain.name, 'Old Ruin (10,20)');
  assert.strictEqual(elite.dungeon.blocks, template.dungeon.blocks, 'same blocks - the same look');
  assert.deepEqual(elite.exterior.exteriorData.blockNames, template.exterior.exteriorData.blockNames);
  assert.match(dungeonSightLine(410, 'North', true), /^You see an Elite Dungeon 410 metres to the North!$/);
  assert.match(dungeonSightLine(410, 'North'), /^You see a Dungeon 410 metres/);
});

test('ELITE: every marker stands three foes, in a fixed order, pulled back from walls', () => {
  const src = [
    { x: 0, y: 0, z: 0, mobileType: 7, fixed: false, reaction: 'hostile', gender: 'unspecified', spawnDistanceType: 1 },
    { x: 10, y: 2, z: 5, mobileType: 140, fixed: true, reaction: 'passive', gender: 'male', spawnDistanceType: 0 },
  ];
  const out = expandEliteEnemies(src, { copies: 3 });
  assert.equal(out.length, 6);
  assert.deepEqual(out.map((e) => e.mobileType), [7, 7, 7, 140, 140, 140]);
  assert.ok(out.every((e) => e.elite === true));
  assert.deepEqual(out.map((e) => !!e.eliteCopy), [false, true, true, false, true, true]);
  assert.deepEqual([out[0].x, out[0].z], [0, 0], 'the original keeps its marker');
  for (const c of [out[1], out[2]]) assert.ok(Math.abs(Math.hypot(c.x, c.z) - ELITE_COPY_OFFSET) < 1e-9);
  assert.deepEqual(expandEliteEnemies(src, { copies: 3 }), out, 'deterministic - every peer builds the same list');
  assert.equal(src[0].elite, undefined, 'the input is not mutated');
  // A wall 0.5 m away on every side: the copies are pulled in to 0.05 m.
  const walled = expandEliteEnemies(src.slice(0, 1), { copies: 3, clearance: () => 0.5 });
  for (const c of walled.slice(1)) assert.ok(Math.hypot(c.x, c.z) <= 0.05 + 1e-9);
  // Hard against a wall: the copy stays on the marker rather than inside the wall.
  const tight = expandEliteEnemies(src.slice(0, 1), { copies: 3, clearance: () => 0.1 });
  for (const c of tight.slice(1)) assert.equal(Math.hypot(c.x, c.z), 0);
});

test('ELITE: a foe with damageScale 2 lands double; the player and scale-1 foes are untouched', () => {
  // Pin the core to 7 through the public override seam, so the test reads the tail alone.
  registerFormulaOverride('calculateAttackDamage', () => 7);
  try {
    const target = { isPlayer: true, reflexes: 2, health: 100 };
    assert.equal(calculateAttackDamage({ isPlayer: false, damageScale: 2 }, target), 14);
    assert.equal(calculateAttackDamage({ isPlayer: false }, target), 7);
    assert.equal(calculateAttackDamage({ isPlayer: false, damageScale: 1 }, target), 7);
    assert.equal(calculateAttackDamage({ isPlayer: true, damageScale: 2 }, { isPlayer: false, health: 10 }), 7, 'never the player');
    registerFormulaOverride('calculateAttackDamage', () => 0);
    assert.equal(calculateAttackDamage({ isPlayer: false, damageScale: 2 }, target), 0, 'a miss stays a miss');
  } finally {
    registerFormulaOverride('calculateAttackDamage', null);
  }
});

test('ELITE by source: the dungeon host expands an elite list and scales every foe it mints', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.match(src, /dfLocation\?\.elite\s*\?\s*expandEliteEnemies\(/, 'elite spawns expand the layout list');
  assert.equal((src.match(/applyEliteScaling\(entity, e\);/g) ?? []).length, 2, 'both the class and the monster branch scale');
  assert.match(src, /entity\.maxHealth \* ELITE_HEALTH_SCALE/);
  assert.match(src, /entity\.damageScale = ELITE_DAMAGE_SCALE/);
});

test('ELITE: loot - +20% item drop chance and +20% rarity odds, caps unchanged', async () => {
  const { ELITE_LOOT_DROP_MULT, ELITE_LOOT_QUALITY_MULT } = await import('../src/world/spawnedDungeons.js');
  const { rarityChances } = await import('../src/systems/lootRarity.js');
  assert.equal(ELITE_LOOT_DROP_MULT, 1.2);
  assert.equal(ELITE_LOOT_QUALITY_MULT, 1.2);
  const plain = rarityChances({ kind: 'corpse', tier: 5 });
  const elite = rarityChances({ kind: 'corpse', tier: 5, qualityMult: 1.2 });
  for (const k of ['magic', 'rare', 'legendary']) assert.ok(Math.abs(elite[k] - plain[k] * 1.2) < 1e-9, `${k}: x1.2`);
  assert.equal(rarityChances({ kind: 'corpse', tier: 999, qualityMult: 1.2 }).magic, 600, 'the cap still holds');
  const src = (await import('node:fs/promises')).readFile;
  const dc = await src(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.equal((dc.match(/spawnEnemyLoot\(entity, e\.mobileType, basics, D\.playerEntity, eliteLootOpts\(e\)\)/g) ?? []).length, 2, 'both foe branches');
  assert.match(dc, /itemChanceScale: ELITE_LOOT_DROP_MULT/, 'the treasure piles drop more');
  assert.match(dc, /qualityMult: elite \? ELITE_LOOT_QUALITY_MULT : 1/, 'and roll better');
  const hc = await src(new URL('../src/scenes/hostCombat.js', import.meta.url), 'utf8');
  assert.match(hc, /\* lootDropMult;/);
  assert.match(hc, /qualityMult: lootQualityMult/);
});

test('ELITE: the plaque over an elite dungeon reads "Elite Dungeon"', async () => {
  const { staticDoorName } = await import('../src/systems/worldTooltips.js');
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Elite Old Ruin (10,20)', elite: true }), { title: 'Elite Dungeon', subs: ['To Old Ruin (10,20)'] });
  assert.deepEqual(staticDoorName('dungeonEntrance', { locationName: 'Old Ruin (10,20)' }), { title: 'To\nOld Ruin (10,20)' }, 'a normal one is unchanged');
});
