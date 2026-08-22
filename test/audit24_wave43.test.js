// AUDIT 24, wave 43: the three rolls nobody ran.
//
// SetEnemyCareer does not stop at the loot table (EnemyEntity.cs:388-397):
//
//     DaggerfallLoot.RandomlyAddMap(mobileEnemy.MapChance, items);
//     if (!string.IsNullOrEmpty(mobileEnemy.LootTableKey))
//     {
//         DaggerfallLoot.RandomlyAddPotion(3, items);
//         DaggerfallLoot.RandomlyAddPotionRecipe(2, items);
//     }
//
// `mapChance` sits in all sixty-two rows of ENEMY_BASICS - thirty of
// them non-zero - and had zero readers. So no enemy in the game has
// ever dropped a dungeon map, which in classic is a main way the
// player finds new dungeons at all; nor a potion, nor a recipe.
// LootTables.GenerateLoot:147-159 runs its own, different trio for
// dungeon PILES, and that was missing too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  randomlyAddMap, randomlyAddPotion, randomlyAddPotionRecipe,
  addEnemyLootExtras, addPileLootExtras, createPotion, createRandomPotion,
  CLASSIC_RECIPE_KEYS, PILE_MAP_CHANCES, MAP_TEMPLATE_INDEX,
  POTION_RECIPE_TEMPLATE_INDEX, POTION_TEMPLATE_INDEX, DUNGEON_LOOT_KEYS,
} from '../src/systems/loot.js';
import { isMap, isPotion, isPotionRecipe } from '../src/systems/useItem.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
/** A rolls() that returns a scripted queue, then 0.999 (fail everything). */
const scripted = (...v) => { let i = 0; return () => (i < v.length ? v[i++] : 0.999); };

// Mutation campaign: 23 reintroductions, 23 killed. The map roll gated
// on the loot table or moved inside the gate; each of the three enemy
// chances changed; a dash table counting as a table; the map and
// recipe templates; a potion minted in the wrong group or without its
// key; the last recipe key made unreachable and a key dropped from the
// list; the pile chances, both edges of its J..O window, its potion
// chance, and its alphabet offset; Dice100 turned into `<=`; each of
// the four call sites disabled; and the trio moved to BEFORE the
// equipment.
// Two corrections, both of them mine, both already written down once:
//   - the enemy RECIPE chance (2) had no boundary pin at all, so
//     changing it to 3 survived. The three chances are one apart, so
//     a 2% roll separates them, and that is the pin now.
//   - `basics.mapChance ?? 0` -> `|| 0` was reported as a KILL. It is
//     the same program; it died on `assert.match(src, /mapChance \?\? 0/)`.
//     That is the false-kill wave 42 recorded, made a second time. The
//     spelling assertion is gone, mapChance is asserted by USE, and
//     the mutant survives now, correctly, as the equivalent it is.

test('audit24 wave43: the three items are the templates DFU news up, and the port recognises them', () => {
  assert.equal(MAP_TEMPLATE_INDEX, 287);              // MiscItems index 8
  assert.equal(POTION_RECIPE_TEMPLATE_INDEX, 278);    // MiscItems index 4
  assert.equal(POTION_TEMPLATE_INDEX, 83);            // UselessItems1 index 1 - a potion IS a glass bottle

  const items = [];
  randomlyAddMap(100, items, () => 0);
  randomlyAddPotion(100, items, () => 0);
  randomlyAddPotionRecipe(100, items, () => 0);
  assert.equal(items.length, 3);
  // the port's own predicates must accept what the rolls mint, or the
  // items are unusable the moment they reach an inventory
  assert.ok(isMap(items[0]), 'the map is a map');
  assert.ok(isPotion(items[1]), 'the potion is a potion');
  assert.ok(isPotionRecipe(items[2]), 'the recipe is a recipe');
  // and they carry a condition, as every minted item does
  for (const it of items) assert.ok(it.currentCondition > 0, `${it.templateIndex} has condition`);
  assert.equal(items[1].potionRecipeKey, CLASSIC_RECIPE_KEYS[0]);
  assert.equal(items[2].potionRecipeKey, CLASSIC_RECIPE_KEYS[0]);
});

test('audit24 wave43: Dice100.SuccessRoll - chance 0 never fires, chance 100 always', () => {
  // `Random.Range(0, 100) < chance`, so 0 is impossible and the roll
  // is still CONSUMED - which matters, because the enemy trio rolls
  // the map for every enemy including the thirty-two with chance 0.
  for (const roll of [0, 0.5, 0.99]) {
    const items = [];
    assert.equal(randomlyAddMap(0, items, () => roll), null, `chance 0 at roll ${roll}`);
    assert.equal(items.length, 0);
  }
  const always = [];
  assert.ok(randomlyAddMap(100, always, () => 0.99));
  // the boundary: chance 3 fires on 0, 1, 2 and not on 3
  const at = (chance, pct) => { const i = []; randomlyAddMap(chance, i, () => pct / 100); return i.length; };
  assert.equal(at(3, 2), 1, '2 < 3');
  assert.equal(at(3, 3), 0, '3 is not < 3');
});

test('audit24 wave43: the enemy trio - the map is UNCONDITIONAL, the potions are not', () => {
  // The asymmetry is DFU's, and it is visible in the data: a Ghost has
  // mapChance 1 and loot table "I", a Rat has neither, and the city
  // watch has mapChance 0 and NO table at all.
  assert.equal(ENEMY_BASICS[18].mapChance, 1);
  assert.equal(ENEMY_BASICS[18].lootTableKey, 'I');
  assert.equal(ENEMY_BASICS[146].mapChance, 0, 'the watch never carries a map');
  assert.equal(ENEMY_BASICS[146].lootTableKey, undefined, 'nor a table');
  const withMap = Object.values(ENEMY_BASICS).filter((r) => (r.mapChance ?? 0) > 0).length;
  assert.equal(withMap, 30, 'thirty rows can drop a map, and none of them could');

  // a foe with a table: map (fails), potion (hits), recipe (fails)
  const a = [];
  addEnemyLootExtras(a, { mapChance: 1, lootTableKey: 'I' }, scripted(0.9, 0.0, 0.0, 0.9));
  assert.equal(a.length, 1);
  assert.ok(isPotion(a[0]));

  // a foe with a table and a lucky map roll: all three
  const b = [];
  addEnemyLootExtras(b, { mapChance: 5, lootTableKey: 'I' }, scripted(0.0, 0.0, 0.0, 0.0, 0.0));
  assert.equal(b.length, 3);
  assert.ok(isMap(b[0]) && isPotion(b[1]) && isPotionRecipe(b[2]), 'and in DFU\'s order');

  // NO table: the map still rolls, the potions never do - even on a
  // roll that would certainly have hit
  const c = [];
  addEnemyLootExtras(c, { mapChance: 100, lootTableKey: undefined }, () => 0);
  assert.equal(c.length, 1);
  assert.ok(isMap(c[0]), 'the map arm is outside the gate');
  // the port spells an absent table '-' at its call sites; that is
  // "no table" too, not a table named dash
  const d = [];
  addEnemyLootExtras(d, { mapChance: 100, lootTableKey: '-' }, () => 0);
  assert.equal(d.length, 1);

  // and a zero-chance, tableless enemy gets nothing at all
  const e = [];
  addEnemyLootExtras(e, { mapChance: 0 }, () => 0);
  assert.deepEqual(e, []);
  assert.doesNotThrow(() => addEnemyLootExtras(null, null));

  // THE THREE CHANCES, each at its own edge. The map's comes from the
  // row; the potion's is 3 and the recipe's is 2, and they are one
  // apart, so a 2% roll separates them.
  const trio = (pct) => {
    const out = [];
    addEnemyLootExtras(out, { mapChance: 0, lootTableKey: 'I' }, () => pct / 100);
    return out.map((it) => (isPotion(it) ? 'potion' : isPotionRecipe(it) ? 'recipe' : 'map'));
  };
  assert.deepEqual(trio(1), ['potion', 'recipe'], '1 < 2 and 1 < 3');
  assert.deepEqual(trio(2), ['potion'], '2 < 3 but 2 is NOT < 2 - the recipe chance is two, not three');
  assert.deepEqual(trio(3), [], '3 is not < 3 either');
  // the row's own chance drives the map arm
  const mapAt = (chance, pct) => {
    const out = [];
    addEnemyLootExtras(out, { mapChance: chance }, () => pct / 100);
    return out.length;
  };
  assert.equal(mapAt(1, 0), 1);
  assert.equal(mapAt(1, 1), 0);
  assert.equal(mapAt(15, 14), 1, "the Ancient Lich's fifteen");

  // a row with NO mapChance at all reads as zero rather than throwing
  const f = [];
  assert.doesNotThrow(() => addEnemyLootExtras(f, { lootTableKey: undefined }, () => 0));
  assert.deepEqual(f, [], 'an absent chance is no chance');
});

test('audit24 wave43: the PILE trio is a different trio', () => {
  // LootTables.GenerateLoot:147-159. `int alphabetIndex = key - 64`,
  // so 'A' is 1 and the window is J(10) through O(15) inclusive; the
  // chances are a six-entry table, and the potion chance is FOUR here
  // where the enemy's is three.
  assert.deepEqual([...PILE_MAP_CHANCES], [2, 1, 1, 2, 2, 15]);
  assert.equal(PILE_MAP_CHANCES.length, 6, 'J through O');

  // outside the window: nothing, however lucky the roll
  for (const key of ['A', 'D', 'F', 'I', 'P', 'Q', 'S', 'U', '-']) {
    const items = [];
    addPileLootExtras(items, key, () => 0);
    assert.deepEqual(items, [], `key ${key} is outside J..O`);
  }
  // the edges are IN
  for (const key of ['J', 'O']) {
    const items = [];
    addPileLootExtras(items, key, () => 0);
    assert.equal(items.length, 3, `key ${key} rolls all three`);
  }
  // O is the generous one - a 15% map where J and M and N are 2
  const chanceFor = (key) => PILE_MAP_CHANCES[key.charCodeAt(0) - 64 - 10];
  assert.equal(chanceFor('O'), 15);
  assert.equal(chanceFor('J'), 2);
  assert.equal(chanceFor('K'), 1);
  assert.equal(chanceFor('L'), 1);
  assert.equal(chanceFor('M'), 2);
  assert.equal(chanceFor('N'), 2);
  // the potion chance really is 4, not the enemy's 3: a roll of 3%
  // hits the pile and misses the enemy
  const pile = []; addPileLootExtras(pile, 'K', scripted(0.99, 0.03, 0.99));
  assert.equal(pile.length, 1);
  assert.ok(isPotion(pile[0]), 'a 3% roll beats the pile potion chance of 4');
  const foe = []; addEnemyLootExtras(foe, { mapChance: 0, lootTableKey: 'K' }, scripted(0.99, 0.03, 0.99));
  assert.deepEqual(foe, [], 'and misses the enemy chance of 3');

  // the real dungeon keys the port ships: which of the 19 types roll
  assert.equal(DUNGEON_LOOT_KEYS.length, 19);
  const rolling = DUNGEON_LOOT_KEYS.filter((k) => {
    const i = k.charCodeAt(0) - 64; return i >= 10 && i <= 15;
  });
  assert.equal(rolling.length, 14, 'fourteen of the nineteen dungeon types have a pile that can hold a map');
  // the five that cannot: Coven(Q), Laboratory(U), Harpy Nest(D),
  // Giant Stronghold(F) and Dragon's Den(S) - all outside J..O, so
  // their piles never carry a map, a potion or a recipe. That is DFU's
  // window, not a port omission.
  assert.deepEqual([...new Set(DUNGEON_LOOT_KEYS.filter((k) => {
    const i = k.charCodeAt(0) - 64; return i < 10 || i > 15;
  }))].sort(), ['D', 'F', 'Q', 'S', 'U']);
});

test('audit24 wave43: the potion registry, and CreatePotion', () => {
  // PotionRecipe.cs:28-29 - twenty keys. The vendored effect tree
  // defines twenty PotionRecipes across fifteen files, which is why
  // the broker's registry and this list are the same set unmodded.
  assert.equal(CLASSIC_RECIPE_KEYS.length, 20);
  assert.equal(new Set(CLASSIC_RECIPE_KEYS).size, 20, 'and no duplicates');
  assert.equal(CLASSIC_RECIPE_KEYS[0], 221871);
  assert.equal(CLASSIC_RECIPE_KEYS[19], 2031019196);

  // ItemBuilder.CreatePotion(:752-755) - the bottle carries the key
  const p = createPotion(4975678);
  assert.ok(isPotion(p));
  assert.equal(p.potionRecipeKey, 4975678);
  // CreateRandomPotion picks uniformly over the registry
  assert.equal(createRandomPotion(() => 0).potionRecipeKey, CLASSIC_RECIPE_KEYS[0]);
  assert.equal(createRandomPotion(() => 0.999999).potionRecipeKey, CLASSIC_RECIPE_KEYS[19], 'the last key is reachable');
  const seen = new Set();
  for (let i = 0; i < 20; i++) seen.add(createRandomPotion(() => i / 20 + 1e-9).potionRecipeKey);
  assert.equal(seen.size, 20, 'every recipe can come up');
});

test('audit24 wave43: all four spawn sites roll, AFTER the equipment', () => {
  // AssignEnemyStartingEquipment has already pushed the gear into
  // `items` by EnemyEntity.cs:388, so a map lands after a helmet in
  // the list and not before it.
  for (const f of ['src/scenes/dungeonContext.js', 'src/scenes/exteriorFoes.js', 'src/scenes/cityGuards.js']) {
    const src = rd(f);
    const lines = src.split('\n');
    const eq = lines.map((l, i) => [l, i]).filter(([l]) => l.includes('equipEnemy('));
    const ex = lines.map((l, i) => [l, i]).filter(([l]) => l.trim().startsWith('addEnemyLootExtras('));
    assert.ok(ex.length > 0, `${f}: the trio runs`);
    assert.equal(ex.length, eq.length, `${f}: once per spawn branch (${eq.length})`);
    for (let k = 0; k < ex.length; k++) {
      assert.ok(ex[k][1] > eq[k][1], `${f}: after the equipment, not before`);
    }
  }
  // the dungeon pile takes the OTHER trio, and only it
  const dc = rd('src/scenes/dungeonContext.js');
  assert.ok(dc.split('\n').some((l) => l.trim().startsWith('addPileLootExtras(')), 'the pile rolls');
  assert.doesNotMatch(rd('src/scenes/exteriorFoes.js'), /addPileLootExtras/, 'and nothing else uses the pile trio');
  // mapChance is no longer dead data - asserted by USE, not by
  // spelling. Quoting `basics.mapChance ?? 0` here false-killed an
  // equivalent rewrite to `|| 0` in the first campaign, which is the
  // mistake wave 42 already wrote down once.
  const drops = [];
  addEnemyLootExtras(drops, { mapChance: 100 }, () => 0);
  assert.equal(drops.length, 1, 'the row\'s mapChance reaches the roll');
  assert.ok(isMap(drops[0]));
});
