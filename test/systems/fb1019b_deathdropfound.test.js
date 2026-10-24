// ASF-DEATH (2026-10-19, Discord #suggestions "Weapon/Armor Materials", through Mac): "It is absurdly easy to walk into a
// dungeon full of daedroth, clear them out, and get tens of thousands of gold by vendoring off the daedric armor".
// Unleveled Loot's death drops (dropWeapon, dropArmor) rolled a condition and left no `foundCondition`, so SELL-AS-FOUND
// never reached them: online a Daedric piece off a Daedroth, mended at a smith, sold whole. Each drop now marks it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { _resetUnleveledLoot, setUnleveledLootWorld, _worldReader, unlevelDroppedLoot } from '../../src/systems/unleveledLoot.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { tradeCost, getTradePrice } from '../../src/systems/tradeModes.js';

const seq = (...vs) => { let i = 0; return () => vs[i++ % vs.length]; };
const fixed = (v) => () => v;
const career = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, attackModifierFlags: 0 });
const saved = _worldReader();
const world = (level) => setUnleveledLootWorld({
  playerEntity: () => ({ level, stats: { luck: 50 }, gender: 'male', raceId: 1 }),
  insideOpenShop: () => false, buildingQuality: () => 0, insideDungeon: () => true, regionIndex: () => 17, locationDungeonType: () => 7,
});
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const sell = (item) => { const lot = tradeCost('Sell', [item], { quality: 10, priceAdjustment: 1000 }); return getTradePrice('Sell', lot.cost, 10, { mercantile: 30, personality: 40 }, lot.pieces); };
const drop = (id, rolls, level = 20) => {
  _resetUnleveledLoot(); world(level);
  const foe = makeEnemyEntity(id, ENEMY_BASICS[id], career(), level, fixed(0.5)); foe.items = [];
  unlevelDroppedLoot(foe, { rolls, luck: 50, level });
  setUnleveledLootWorld(saved); _resetUnleveledLoot();
  return foe.items;
};

test('ASF-DEATH: a Daedroth\'s weapon, a Daedra Lord\'s armour and an Orc Warlord\'s weapon each fall marked with the condition they rolled (mutants: either drop\'s mark dropped)', () => {
  const [blade] = drop(27, seq(0.999, 0.999, 0.5, 0.2));
  assert.equal(blade.group, 'Weapons'); assert.equal(blade.material, 9);
  assert.ok(blade.currentCondition < blade.maxCondition);
  assert.equal(blade.foundCondition, blade.currentCondition);
  const [plate] = drop(31, seq(0.999, 0, 0, 0.5, 0.2, 0.999, 0.999));
  assert.equal(plate.group, 'Armor'); assert.equal(plate.material, 521);
  assert.equal(plate.foundCondition, plate.currentCondition);
  const [orcish] = drop(24, seq(0.999, 0.999, 0.5, 0.5));
  assert.equal(orcish.material, 8); assert.equal(orcish.foundCondition, orcish.currentCondition);
});

test('ASF-DEATH: online a mended Daedric drop sells as it fell - the smith\'s repair adds nothing to the sale; offline the mod\'s condition price stands (mutant: the mark dropped)', () => {
  const [plate] = drop(31, seq(0.999, 0, 0, 0.5, 0.2, 0.999, 0.999));
  const mended = { ...plate, currentCondition: plate.maxCondition };
  online(() => assert.equal(sell(mended), sell(plate), 'online: whole sells as found'));
  assert.ok(sell(mended) > sell(plate), 'offline: a mended piece sells higher, the mod\'s own law');
});
