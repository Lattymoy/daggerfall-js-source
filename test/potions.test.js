// M1: the potion law against PotionRecipe.cs, the twenty recipes the
// effect classes register, and DaggerfallPotionMakerWindow's mixing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POTION_RECIPES, potionRecipeKey, potionKeyFromCauldron,
  potionRecipeByKey, potionRecipeKeys, mixCauldron, isIngredient, knownRecipes,
  CAULDRON_CAPACITY, cauldronAccepts, consumeCauldron, gatherRecipe,
} from '../src/systems/potions.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';

const byName = (n) => POTION_RECIPES.find((r) => r.name === n);

test('M1: the hash is DFU\'s, including the int32 WRAP (:295-307)', () => {
  // hash = 17; for each id: hash = hash * 23 + id
  assert.equal(potionRecipeKey([]), 0, 'an empty list is 0, NOT the 17 seed');
  assert.equal(potionRecipeKey(null), 0);
  assert.equal(potionRecipeKey([5]), 17 * 23 + 5);
  assert.equal(potionRecipeKey([5, 7]), (17 * 23 + 5) * 23 + 7);
  // and it WRAPS as a C# int rather than growing into a double, which
  // is the half a JS port gets wrong by default. Nine ingredients of
  // a large id overflow 2^31 in C#; the port must agree.
  const big = [200, 210, 220, 230, 240, 250, 260, 270, 280];
  let ref = 17;
  for (const id of big) ref = (Math.imul(ref, 23) + id) | 0;
  assert.equal(potionRecipeKey(big), ref);
  assert.ok(ref < 0 || Math.abs(ref) <= 2 ** 31, 'the reference really did wrap into int range');
  assert.ok(Number.isSafeInteger(potionRecipeKey(big)));
});

test('M1: the constructor SORTS, so cauldron order does not matter (:121-130)', () => {
  const slow = byName('slowFalling');
  assert.deepEqual([...slow.ingredients], [24, 26, 59]);
  // the same three things in any order key the same recipe - which is
  // the whole reason DFU sorts before hashing, since the hash itself
  // is order-dependent
  const orders = [[24, 26, 59], [59, 26, 24], [26, 59, 24], [59, 24, 26]];
  const keys = orders.map((o) => potionKeyFromCauldron(o));
  assert.equal(new Set(keys).size, 1, 'every order gives one key');
  assert.equal(keys[0], potionRecipeKey(slow.ingredients));
  // ...and the RAW hash really is order-dependent, so the sort is
  // load-bearing rather than decorative
  assert.notEqual(potionRecipeKey([24, 26, 59]), potionRecipeKey([59, 26, 24]));
  // sorting does not mutate the caller's cauldron
  const live = [59, 26, 24];
  potionKeyFromCauldron(live);
  assert.deepEqual(live, [59, 26, 24], 'the cauldron is left as it was');
});

test('M1: the twenty recipes, and every key distinct', () => {
  assert.equal(POTION_RECIPES.length, 20, 'fifteen effect files register twenty recipes');
  // CureDisease alone registers two
  assert.ok(byName('cureDisease') && byName('purification'));
  assert.equal(byName('purification').ingredients.length, 8, 'the eight-ingredient one');
  assert.equal(byName('purification').price, 500, 'and the most expensive');
  assert.equal(byName('stamina').price, 25, 'the cheapest');

  // A COLLISION would silently make one potion unmakeable, and the
  // hash is only 32 bits over a small ingredient space - so this is
  // checked rather than assumed.
  const keys = potionRecipeKeys();
  assert.equal(keys.length, 20);
  assert.equal(new Set(keys).size, 20, 'no two recipes share a key');
  // every recipe is reachable through the lookup by its own key
  for (const r of POTION_RECIPES) {
    assert.equal(potionRecipeByKey(potionRecipeKey(r.ingredients)), r, r.name);
  }
  // and each is stored PRE-SORTED, so the table's keys and the
  // cauldron's agree without the table being sorted at read time
  for (const r of POTION_RECIPES) {
    assert.deepEqual([...r.ingredients], [...r.ingredients].sort((a, b) => a - b), r.name);
  }
});

test('M1: every ingredient is a real template, and IS an ingredient', () => {
  // The ids were resolved from the C# enums; this checks them against
  // the port's OWN shipped data, which is what makes the table
  // trustworthy rather than transcribed.
  for (const r of POTION_RECIPES) {
    for (const id of r.ingredients) {
      const t = templateByIndex(id);
      assert.ok(t, `${r.name}: template ${id} exists`);
      assert.equal(t.isIngredient, true, `${r.name}: ${t.name} (${id}) is flagged an ingredient`);
    }
  }
  // and the predicate the window filters the pack with agrees
  assert.equal(isIngredient({ templateIndex: 59 }), true, 'Pure Water');
  assert.equal(isIngredient({ templateIndex: 131 }), false, 'an Arrow is not');
  assert.equal(isIngredient({}), false);
  assert.equal(isIngredient(null), false);
});

test('M1: mixing matches by KEY - there is no ingredient comparison (:311-334)', () => {
  const slow = byName('slowFalling');
  const m = mixCauldron([59, 26, 24]);
  assert.equal(m.kind, 'mixed');
  assert.equal(m.recipe.name, 'slowFalling');
  assert.equal(m.key, potionRecipeKey(slow.ingredients));

  // a SUBSET fails - two of the three is a different key entirely
  assert.equal(mixCauldron([59, 26]).kind, 'failed');
  // and so does a SUPERSET: adding a fourth thing does not make it
  // "close enough", because the key is a hash of the whole list
  assert.equal(mixCauldron([59, 26, 24, 8]).kind, 'failed');
  // an empty cauldron fails rather than matching the 0 key
  assert.equal(mixCauldron([]).kind, 'failed');
  // nonsense fails
  assert.equal(mixCauldron([1, 2, 3]).kind, 'failed');
  // ...and a failed mix answers NOTHING to create - DFU's own
  // departure from classic, which makes a useless "Unknown Powers"
  // potion. The comment on that line is why this is asserted.
  assert.equal(mixCauldron([1, 2, 3]).recipe, undefined);
});

test('M1: the RECIPES button shows what the player has LEARNED (:376-382)', () => {
  assert.deepEqual(knownRecipes([]), [], 'an empty list is empty, not everything');
  assert.deepEqual(knownRecipes(), []);
  const slowKey = potionRecipeKey(byName('slowFalling').ingredients);
  const healKey = potionRecipeKey(byName('healing').ingredients);
  assert.deepEqual(knownRecipes([slowKey, healKey]).map((r) => r.name), ['slowFalling', 'healing']);
  // an unknown key is dropped rather than becoming a null row
  assert.deepEqual(knownRecipes([slowKey, 999999]).map((r) => r.name), ['slowFalling']);
});

test('M1: the cauldron holds EIGHT, and purification needs all of them (:253)', () => {
  assert.equal(CAULDRON_CAPACITY, 8);
  assert.equal(byName('purification').ingredients.length, CAULDRON_CAPACITY,
    'the biggest recipe exactly fills the cauldron - the cap is not arbitrary');
  assert.equal(cauldronAccepts([]), true);
  assert.equal(cauldronAccepts(new Array(7).fill({})), true);
  assert.equal(cauldronAccepts(new Array(8).fill({})), false, 'a full cauldron simply refuses');
  assert.equal(cauldronAccepts(new Array(9).fill({})), false);
  // ...and purification really does mix at full capacity
  assert.equal(mixCauldron(byName('purification').ingredients).recipe.name, 'purification');
});

test('M1: the consume walk falls back to the WAGON, and BREAKS mid-loop (:335-356)', () => {
  const cauldron = [{ templateIndex: 59 }, { templateIndex: 26 }, { templateIndex: 24 }];
  // everything in the pack
  const pack = new Set([59, 26, 24]);
  const taken = [];
  let r = consumeCauldron(cauldron, {
    takeFromPack: (i) => (pack.delete(i) ? (taken.push(['pack', i]), true) : false),
    takeFromWagon: () => false,
  });
  assert.equal(r.kind, 'spent');
  assert.deepEqual(taken.map((t) => t[1]), [59, 26, 24]);

  // the middle one only in the CART
  const pack2 = new Set([59, 24]);
  const wagon = new Set([26]);
  const from = [];
  r = consumeCauldron(cauldron, {
    takeFromPack: (i) => (pack2.delete(i) ? (from.push('pack'), true) : false),
    takeFromWagon: (i) => (wagon.delete(i) ? (from.push('wagon'), true) : false),
  });
  assert.equal(r.kind, 'spent');
  assert.deepEqual(from, ['pack', 'wagon', 'pack'], 'the cart covers what the pack lacks');

  // NEITHER has the second one: the walk RETURNS, so the third is
  // never taken. A partial spend that bails mid-loop - verbatim, and
  // DFU's own log line for it is "The cauldron broke".
  const pack3 = new Set([59, 24]);
  const spent = [];
  r = consumeCauldron(cauldron, {
    takeFromPack: (i) => (pack3.delete(i) ? (spent.push(i), true) : false),
    takeFromWagon: () => false,
  });
  assert.equal(r.kind, 'broke');
  assert.equal(r.at, 1, 'it broke on the second ingredient');
  assert.deepEqual(spent, [59], 'the FIRST was spent and the third was not reached');
  assert.equal(pack3.has(24), true, 'the third really is still in the pack');
});

test('M1: the recipe picker fills what it CAN and leaves the rest (:283-309)', () => {
  const heal = byName('healing');   // 16, 42, 62, 65
  const all = gatherRecipe(heal, [16, 42, 62, 65, 99]);
  assert.deepEqual(all.found, heal.ingredients);
  assert.deepEqual(all.missing, []);

  // one missing herb does not refuse the whole recipe
  const partial = gatherRecipe(heal, [16, 62]);
  assert.deepEqual(partial.found, [16, 62]);
  assert.deepEqual(partial.missing, [42, 65]);

  // a DUPLICATE in the pack is consumed once per required unit, not
  // reused - the pool is spent down as it goes
  const twoWater = gatherRecipe({ ingredients: [59, 59] }, [59]);
  assert.deepEqual(twoWater.found, [59]);
  assert.deepEqual(twoWater.missing, [59], 'one Pure Water cannot fill two slots');
  // ...and with two, both slots fill
  assert.deepEqual(gatherRecipe({ ingredients: [59, 59] }, [59, 59]).missing, []);
});
