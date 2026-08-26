// M1: the potion law against PotionRecipe.cs, the twenty recipes the
// effect classes register, and DaggerfallPotionMakerWindow's mixing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  POTION_RECIPES, potionRecipeKey, potionKeyFromCauldron, potionBundle,
  potionRecipeByKey, potionRecipeKeys, mixCauldron, isIngredient, knownRecipes,
  CAULDRON_CAPACITY, cauldronAccepts, consumeCauldron, gatherRecipe,
} from '../src/systems/potions.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { applySpell, isHealSpellPoints, HEAL_SPELL_POINTS_KEY } from '../src/systems/effects.js';

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

test('M1: the recipe match answers found AND missing - a miss refuses the whole fill (:283-301)', () => {
  const heal = byName('healing');   // 16, 42, 62, 65
  const all = gatherRecipe(heal, [16, 42, 62, 65, 99]);
  assert.deepEqual(all.found, heal.ingredients);
  assert.deepEqual(all.missing, []);

  // a missing herb is REPORTED - the window refuses the whole recipe
  // with "reqIngredients" whenever `missing` is non-empty (:297-301)
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

// ── U44: DRINKING one ─────────────────────────────────────────────

test('U44: every recipe carries the effect its own class registers', () => {
  // The twenty were transcribed from the fifteen effect classes that
  // call new PotionRecipe(...), and each effect's classic pair from
  // that class's MakeClassicKey. A transposed row here is invisible
  // until someone drinks the wrong thing for an hour, so the whole
  // table is pinned rather than sampled.
  const by = Object.fromEntries(POTION_RECIPES.map((r) => [r.name, r]));
  const EXPECTED = {
    // ElementalResistance's four variants: the enum is Fire 0, Frost 1,
    // DiseaseOrPoison 2, Shock 3 - so SHOCK is 3 and POISON is 2, and
    // the class assigns them in the order Fire/Frost/Shock/Poison
    // (:142-145). That inversion is the transposition to fear.
    resistFire: '8,0', resistFrost: '8,1', resistPoison: '8,2', resistShock: '8,3',
    slowFalling: '25,255', waterBreathing: '30,255', waterWalking: '31,255',
    chameleonForm: '23,0', shadowForm: '24,0', invisibility: '13,0',
    levitation: '14,255', freeAction: '26,255',
    cureDisease: '3,0', purification: '3,0', curePoison: '3,1',
    orcStrength: '9,0',
    // Heal-Health twice (healing / healTrue) and Heal-Fatigue for
    // stamina - one class, two recipes, DFU's own variant ordering
    stamina: '10,9', healing: '10,8', healTrue: '10,8',
    // ...and the one with NO classic pair at all
    restorePower: HEAL_SPELL_POINTS_KEY,
  };
  assert.equal(POTION_RECIPES.length, 20);
  for (const [name, key] of Object.entries(EXPECTED)) {
    assert.ok(by[name], `no recipe named ${name}`);
    assert.equal(by[name].effect, key, `${name}'s effect`);
  }
  assert.deepEqual(Object.keys(EXPECTED).sort(), POTION_RECIPES.map((r) => r.name).sort(),
    'the table and the pin name the same twenty');
  // DisplayName is the recipe NAME used as a localization key, so
  // every row carries the en string that key resolves to
  assert.equal(by.healTrue.displayName, 'Heal True');
  assert.equal(by.orcStrength.displayName, 'Orc Strength');
  assert.equal(by.restorePower.displayName, 'Restore Power');
  for (const r of POTION_RECIPES) assert.ok(r.displayName, `${r.name} has no display name`);
});

test('U44: only the fields that DIFFER are named, and DFU\'s names map to the classic ones', () => {
  // DefaultEffectSettings is all eleven at 1 (EntityEffect.cs:946-968),
  // so a recipe's `settings` names only what its class changed. DFU's
  // EffectSettings names map onto the classic record's through its own
  // converter (EntityEffectBroker.cs:952-976) - ChancePlus is
  // chanceMod, MagnitudePlusMin/Max are magnitudeLevelBase/LevelHigh -
  // and getting that pairing wrong is silent.
  const by = Object.fromEntries(POTION_RECIPES.map((r) => [r.name, r]));
  assert.deepEqual(by.resistFire.settings, { chanceBase: 100 });
  assert.deepEqual(by.resistPoison.settings, { chanceBase: 5, chanceMod: 19 });
  assert.deepEqual(by.cureDisease.settings, { chanceMod: 10 }, 'ChanceBase 1 IS the default - unnamed');
  assert.deepEqual(by.healing.settings,
    { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 9, magnitudeLevelHigh: 9 });
  assert.deepEqual(by.healTrue.settings,
    { magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 19, magnitudeLevelHigh: 19 });
  assert.deepEqual(by.orcStrength.settings,
    { magnitudeLevelBase: 14, magnitudeLevelHigh: 14 }, 'its written-out 1,1 base IS the default');
  assert.equal(by.slowFalling.settings, undefined, 'a pure DefaultEffectSettings recipe names nothing');
  // and the bundle fills the rest in at 1
  const bundle = potionBundle(potionRecipeKey(by.slowFalling.ingredients));
  for (const f of ['durationBase', 'durationMod', 'durationPerLevel', 'chanceBase',
    'chanceMod', 'chancePerLevel', 'magnitudeBaseLow', 'magnitudeBaseHigh',
    'magnitudeLevelBase', 'magnitudeLevelHigh', 'magnitudePerLevel']) {
    assert.equal(bundle.effects[0][f], 1, `${f} defaults to 1`);
  }
});

test('U44: DrinkPotion builds a CasterOnly potion bundle, one settings struct shared', () => {
  // EntityEffectManager.DrinkPotion (:903-947). Purification is the
  // ONLY recipe in DFU with secondary effects, and the single
  // `potionRecipe.Settings` struct is shared by all three (:914-930) -
  // so its Heal-Health and Invisibility inherit cureDisease's numbers
  // rather than their own defaults. A per-effect copy would look
  // identical until someone read the magnitudes.
  const pur = POTION_RECIPES.find((r) => r.name === 'purification');
  const b = potionBundle(potionRecipeKey(pur.ingredients));
  assert.equal(b.name, 'Purification');
  assert.equal(b.rangeType, 0, 'TargetTypes.CasterOnly');
  assert.equal(b.element, 4, 'ElementTypes.Magic - the cast sound\'s element');
  assert.equal(b.bundleType, 'potion');
  assert.deepEqual(b.effects.map((e) => `${e.type},${e.subType}`), ['3,0', '10,8', '13,0'],
    'primary first, then the secondaries in order');
  for (const e of b.effects) {
    assert.equal(e.chanceMod, 10, 'every effect shares the ONE settings struct');
    assert.equal(e.magnitudeLevelHigh, 19);
  }
  // an unknown bottle is drunk and does nothing (the PotionRecipeKey
  // == 0 guard, :906)
  assert.equal(potionBundle(0), null);
  assert.equal(potionBundle(123456), null);
});

test('U44: the one effect with no classic pair rides under its DFU key', () => {
  // Heal-SpellPoints is PotionMaker-only and sets no ClassicKey
  // (HealSpellPoints.cs:21-30), so no SPELLS.STD row can name it -
  // which is why S15 pulled it off (10,9) and effects.js has said
  // since that no classic spell restores magicka. A potion bundle is
  // keyed by STRING, so this one travels that way.
  const rp = POTION_RECIPES.find((r) => r.name === 'restorePower');
  const e = potionBundle(potionRecipeKey(rp.ingredients)).effects[0];
  assert.equal(e.key, HEAL_SPELL_POINTS_KEY);
  assert.equal(e.type, -1, 'no classic pair to carry');
  assert.ok(isHealSpellPoints(e));
  assert.equal(isHealSpellPoints({ type: 10, subType: 9 }), false, 'and it is NOT heal fatigue');
});

test('U44: every host that opens an inventory can DRINK from it', () => {
  // The hook chain is host -> window -> useItem -> the ONE cast
  // engine, and a break anywhere in it is silent: the arm falls back
  // to its `pending` line and the potion does nothing, which is the
  // state this slice found. Swept at the host end; the window's
  // forwarding is pinned in nativeinventory.test.js.
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const rel of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert.match(src, /drinkPotion: \(key\) => magic\.drinkPotion\(key\)/,
      `${rel} hands the drink through its cast engine`);
  }
  // both of world.js's inventory sites, bare and over a loot pile
  const world = readFileSync(join(root, 'src/scenes/world.js'), 'utf8');
  assert.equal((world.match(/drinkPotion: \(key\)/g) ?? []).length, 2,
    'the loot-pile window can drink too');
  // and the engine's own half is DFU's AssignBundle flags
  const hm = readFileSync(join(root, 'src/scenes/hostMagic.js'), 'utf8');
  assert.match(hm, /bypassSavingThrows: true, bypassChance: true/,
    'AssignBundleFlags.BypassSavingThrows | BypassChance (:942)');
});

test('U44: drinking one actually reaches the sinks - the whole point', () => {
  // The arm consumed the bottle and printed "You drink the potion."
  // over an entity nothing had touched, for the whole of the item arc.
  const drink = (name, sinks, level = 6) => {
    const r = POTION_RECIPES.find((x) => x.name === name);
    return applySpell(potionBundle(potionRecipeKey(r.ingredients)), level,
      { health: 10, maxHealth: 100, magicka: 5, maxMagicka: 50, level },
      sinks, () => 0.5, null, { bypassSavingThrows: true, bypassChance: true });
  };
  // GetMagnitude: base + plus-per-level x level. healing is 5 + 9L,
  // healTrue 5 + 19L, restorePower 5 + 4L.
  let healed = 0;
  drink('healing', { heal: (n) => { healed = n; } });
  assert.equal(healed, 5 + 9 * 6);
  healed = 0;
  drink('healTrue', { heal: (n) => { healed = n; } });
  assert.equal(healed, 5 + 19 * 6);
  // ...and the magicka half, which no classic spell can reach
  let mag = 0;
  drink('restorePower', { restoreMagicka: (n) => { mag = n; } });
  assert.equal(mag, 5 + 4 * 6, 'IncreaseMagicka(magnitude) - and NO x64, unlike its fatigue sibling');
  // stamina IS the x64 one
  let fat = 0;
  drink('stamina', { restoreFatigue: (n) => { fat = n; } });
  assert.equal(fat, (5 + 4 * 6) * 64, 'HealFatigue carries the fatigue multiplier');
});
