// M4: the enchantment catalogue against the twenty-four effect
// classes' GetEnchantmentSettings and SoulBound's forced sets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAM_NONE, ENCHANTMENT_COSTS, enchantmentCost, enchantmentParams,
  enchantmentParamValues, enchantmentTypes, defaultParam,
  isPower, isSideEffect, powerTypes, sideEffectTypes,
  enchantmentKey, enchantmentSettings,
  SOUL_FORCED_ENCHANTMENTS, forcedEnchantments,
  pickEnchantment, removeEnchantment, NO_ROOM_IN_ITEM,
  ITEM_MAKER_FLAGS, hasItemMakerFlag, isExclusiveTo,
  primaryPickerList, primaryPick,
} from '../src/systems/enchantmentCatalogue.js';
import { SKILLS, SKILL_COUNT, SKILL_NAMES } from '../src/systems/skills.js';
import { ENEMY_NAMES } from '../src/characters/enemyBasics.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';

test('M4: FOUR SHAPES, and ClassicParam does not mean the same thing in each', () => {
  assert.equal(enchantmentTypes().length, 24);

  // (1) a PARAM TABLE, indexed by ClassicParam 0..n-1
  assert.deepEqual([0, 1, 2, 3].map((p) => enchantmentCost('PotentVs', p)), [800, 900, 1000, 1200]);
  assert.equal(enchantmentCost('PotentVs', 4), null, 'off the end is null, not 0');
  assert.equal(enchantmentCost('PotentVs', PARAM_NONE), null);

  // (2) a SINGLE cost, minted at ClassicParam -1. THIS is the shape a
  // flat `costs[param]` table gets wrong: AbsorbsSpells:45 writes
  // `ClassicParam = -1`, so 0 is a param it never mints.
  assert.equal(PARAM_NONE, -1);
  assert.equal(enchantmentCost('AbsorbsSpells', PARAM_NONE), 1500);
  assert.equal(enchantmentCost('AbsorbsSpells', 0), null, '0 is not a param this effect mints');
  for (const t of ['AbsorbsSpells', 'ExtraWeight', 'FeatherWeight', 'RepairsObjects',
    'StrengthensArmor', 'WeakensArmor']) {
    assert.deepEqual(enchantmentParamValues(t), [PARAM_NONE], t);
    assert.equal(enchantmentCost(t, 0), null, `${t} mints no param 0`);
  }

  // (3) EnhancesSkill: ONE flat cost over a whole domain, and the
  // param is the SKILL id - not an index into a one-entry table
  assert.equal(enchantmentCost('EnhancesSkill', SKILLS.Daedric), 900);
  assert.equal(enchantmentCost('EnhancesSkill', SKILLS.Destruction), 900);
  assert.equal(enchantmentParamValues('EnhancesSkill').length, SKILL_COUNT);
  for (let i = 0; i < SKILL_COUNT; i++) assert.equal(enchantmentCost('EnhancesSkill', i), 900, `skill ${i}`);
  assert.equal(enchantmentCost('EnhancesSkill', SKILL_COUNT), null, 'past the last skill');
  assert.equal(enchantmentCost('EnhancesSkill', PARAM_NONE), null);

  // (4) the three CastWhen*: keyed by classic SPELL id, which is
  // neither an index nor dense. 12 is Resist Fire, not the 13th row.
  assert.equal(enchantmentCost('CastWhenUsed', 12), 1560, 'Resist Fire');
  assert.equal(enchantmentCost('CastWhenUsed', 11), 1560, 'Resist Cold');
  assert.equal(enchantmentCost('CastWhenUsed', 94), 480, 'Recall');
  assert.equal(enchantmentCost('CastWhenUsed', 0), null, 'there is no spell 0');
  assert.equal(enchantmentCost('CastWhenUsed', 1), null);
  assert.equal(enchantmentCost('CastWhenStrikes', 55), 4230, 'Sphere of Negation');
  assert.equal(enchantmentCost('CastWhenHeld', 45), 150, 'Shadow Form is the cheapest held spell');
  // ...and the SAME spell can price differently by station: Ice Storm
  // is 1420 cast-on-use and 840 cast-on-strike. An index-based lookup
  // would never see this because the two lists are ordered alike at
  // neither position.
  assert.equal(enchantmentCost('CastWhenUsed', 20), 1420);
  assert.equal(enchantmentCost('CastWhenStrikes', 20), 840);
  assert.notEqual(enchantmentCost('CastWhenUsed', 20), enchantmentCost('CastWhenStrikes', 20));
  // where they DO agree they agree exactly - Wildfire, Ice Bolt,
  // Wizard's Fire and Fire Storm are shared between the two lists
  for (const id of [33, 16, 7, 25]) {
    assert.equal(enchantmentCost('CastWhenUsed', id), enchantmentCost('CastWhenStrikes', id), `spell ${id}`);
  }

  // an unknown effect, and a param that is not an integer at all, are
  // null - `costs['length']` would answer the array's LENGTH, which
  // is a number and would read as a real price
  assert.equal(enchantmentCost('NoSuchEffect', 0), null);
  assert.equal(enchantmentCost('PotentVs', 'length'), null);
  assert.equal(ENCHANTMENT_COSTS.PotentVs.costs.length, 4, 'which would have been 4 gold');
  assert.equal(enchantmentCost('PotentVs', 1.5), null);
});

test('M4: the default param is the FIRST one minted, per shape', () => {
  assert.equal(defaultParam('PotentVs'), 0);
  assert.equal(defaultParam('AbsorbsSpells'), PARAM_NONE);
  assert.equal(defaultParam('EnhancesSkill'), 0);
  assert.equal(defaultParam('CastWhenUsed'), 4, 'Levitate heads DFU\'s own list');
  assert.equal(enchantmentCost('CastWhenUsed'), 330, 'and naming no param asks for Levitate');
  assert.equal(enchantmentCost('AbsorbsSpells'), 1500);
  assert.equal(defaultParam('NoSuchEffect'), undefined);

  // the spell lists are in MINT order, which is NOT sorted and NOT
  // what the picker shows either: CastWhenUsed carries
  // AlphaSortSecondaryList, so the picker re-sorts by name. This is
  // the underlying order, and 18 (Open) sits between 10 and 11 in it
  assert.deepEqual(enchantmentParamValues('CastWhenUsed').slice(0, 9),
    [4, 5, 6, 7, 8, 9, 10, 18, 11]);
});

test('M4: the labels line up with the costs, everywhere there are any', () => {
  for (const type of enchantmentTypes()) {
    const labels = enchantmentParams(type);
    if (labels.length === 0) continue;
    assert.equal(labels.length, enchantmentParamValues(type).length, `${type} labels vs params`);
    for (const l of labels) assert.equal(typeof l, 'string', type);
  }
  // the two effects that do NOT own their own names read them from
  // the module that does, so there is no second copy to drift
  assert.deepEqual(enchantmentParams('EnhancesSkill'), SKILL_NAMES);
  assert.equal(enchantmentParams('EnhancesSkill')[SKILLS.Daedric], 'Daedric');
  assert.equal(enchantmentParamValues('EnhancesSkill').length, SKILL_COUNT);
  assert.deepEqual(enchantmentParams('SoulBound'), ENEMY_NAMES.slice(0, 43));
  // and every cost in every shape is a whole number
  for (const type of enchantmentTypes()) {
    for (const p of enchantmentParamValues(type)) {
      assert.ok(Number.isInteger(enchantmentCost(type, p)), `${type}@${p}`);
    }
  }
});

test('M4: the table as a whole, machine-diffed against the twenty-four effect classes', () => {
  // Every cost in this module was diffed cell-for-cell against the
  // C# it came from - twenty-four of twenty-four exact - rather than
  // eyeballed. What a TEST can add on top of that is a guard against
  // later drift, and re-typing the tables here would only assert my
  // own transcription back at me. So: the aggregate, which no single
  // wrong digit anywhere in two hundred cells can survive.
  let cells = 0;
  let sum = 0;
  const perEffect = {};
  for (const type of enchantmentTypes()) {
    const costs = enchantmentParamValues(type).map((p) => enchantmentCost(type, p));
    cells += costs.length;
    perEffect[type] = costs.reduce((a, b) => a + b, 0);
    sum += perEffect[type];
  }
  assert.equal(cells, 209, 'settings the catalogue can mint');
  assert.equal(sum, 99680, 'every cost, added up');

  // and per effect, so a drift names itself instead of leaving one
  // total to hunt through
  assert.deepEqual(perEffect, {
    BadReactionsFrom: -320, BadRepWith: -10000, ExtraSpellPts: 6000, GoodRepWith: 10000,
    HealthLeech: -4700, ImprovesTalents: 1700, IncreasedWeightAllowance: 1000,
    ItemDeteriorates: -5000, LowDamageVs: -3900, PotentVs: 3900, RegensHealth: 10000,
    SoulBound: -23440, UserTakesDamage: -7000, VampiricEffect: 3000, AbsorbsSpells: 1500,
    ExtraWeight: -100, FeatherWeight: 100, RepairsObjects: 900, StrengthensArmor: 700,
    WeakensArmor: -700, EnhancesSkill: 31500, CastWhenUsed: 42040, CastWhenHeld: 26300,
    CastWhenStrikes: 16200,
  });
  // the two halves of the sign split, which is the shape of the whole
  // economy: the powers on offer outweigh the drawbacks many times
  const owed = (list) => list.reduce((a, t) => a + perEffect[t], 0);
  assert.equal(owed(powerTypes()), 154840);
  assert.equal(owed(sideEffectTypes()), -55160);
  assert.equal(owed(powerTypes()) + owed(sideEffectTypes()), sum);
});

test('M4: the two MIRRORS, and the three tables that are not what you would guess', () => {
  // PotentVs and LowDamageVs are exact mirrors - same magnitudes,
  // same order, opposite signs. So are GoodRepWith and BadRepWith.
  for (let p = 0; p < 4; p++) {
    assert.equal(enchantmentCost('LowDamageVs', p), -enchantmentCost('PotentVs', p), `vs ${p}`);
  }
  for (let p = 0; p < 6; p++) {
    assert.equal(enchantmentCost('BadRepWith', p), -enchantmentCost('GoodRepWith', p), `rep ${p}`);
  }
  assert.deepEqual(enchantmentParams('LowDamageVs'), enchantmentParams('PotentVs'));

  // "All" is the SIXTH reputation param but prices as FIVE groups,
  // not six - buying every group at once is a group cheaper
  assert.equal(enchantmentParams('GoodRepWith')[5], 'All');
  assert.equal(enchantmentCost('GoodRepWith', 5), 5000);
  assert.equal(enchantmentCost('GoodRepWith', 0) * 5, 5000);
  assert.notEqual(enchantmentCost('GoodRepWith', 5), enchantmentCost('GoodRepWith', 0) * 6);

  // BadReactionsFrom is NOT monotonic: Animals is the cheap one and
  // the two ends are equal, so the list order carries no ranking
  assert.deepEqual(ENCHANTMENT_COSTS.BadReactionsFrom.costs, [-120, -80, -120]);
  assert.equal(enchantmentCost('BadReactionsFrom', 0), enchantmentCost('BadReactionsFrom', 2));
  assert.ok(enchantmentCost('BadReactionsFrom', 1) > enchantmentCost('BadReactionsFrom', 0));

  // RegensHealth charges the SAME for sunlight and for darkness -
  // the harder condition is not the dearer one
  assert.equal(enchantmentCost('RegensHealth', 1), enchantmentCost('RegensHealth', 2));
  assert.equal(enchantmentCost('RegensHealth', 0), 4000, 'only "all the time" costs more');
});

test('M4: SoulBound is forty-three rows keyed by monster ID (:160-206)', () => {
  const soul = ENCHANTMENT_COSTS.SoulBound;
  const names = enchantmentParams('SoulBound');
  assert.equal(soul.costs.length, 43, 'monster IDs 0-42');
  assert.equal(names.length, 43);
  // the param IS the MobileTypes id, so the port's own enum indexes it
  assert.equal(names[MOBILE_TYPES.DaedraLord], 'Daedra Lord');
  assert.equal(names[MOBILE_TYPES.Lich], 'Lich');
  assert.equal(names[MOBILE_TYPES.Wraith], 'Wraith');
  // the Daedra Lord is by far the dearest soul
  assert.equal(enchantmentCost('SoulBound', MOBILE_TYPES.DaedraLord), -8000);
  const dearest = Math.min(...soul.costs);
  assert.equal(dearest, -8000);
  assert.equal(soul.costs.filter((c) => c === dearest).length, 1, 'and it is alone at the bottom');

  // the ZEROS are the soulless - DFU's comments beside the costs say
  // so - and the two Dragonlings are the tell. 34 is the general
  // spawn, which classic gives no soul and prices at nothing; 40 is
  // the quest spawn, which has one and costs 5000. THE PICKER CANNOT
  // TELL THEM APART: both rows print the same enemy name, because
  // that is the name the enemy has.
  assert.equal(enchantmentCost('SoulBound', 34), 0);
  assert.equal(enchantmentCost('SoulBound', 40), -5000);
  assert.equal(names[34], 'Dragonling');
  assert.equal(names[40], 'Dragonling');
  assert.equal(names.filter((n) => n === 'Dragonling').length, 2, 'two rows, one name');
  assert.equal(enchantmentCost('SoulBound', 0), 0, 'a rat soul is worth nothing');
  assert.equal(names[0], 'Rat');
});

test('M4: the sign classification partitions all twenty-four, and reads the table itself', () => {
  const all = enchantmentTypes();
  const powers = powerTypes();
  const sides = sideEffectTypes();
  assert.equal(powers.length, 15);
  assert.equal(sides.length, 9);
  assert.equal(powers.length + sides.length, all.length, 'no effect is neither');
  assert.equal(powers.filter((t) => sides.includes(t)).length, 0, 'and none is both');

  // no effect MIXES a positive with a negative across its own params
  for (const type of all) {
    const costs = enchantmentParamValues(type).map((p) => enchantmentCost(type, p));
    const pos = costs.some((c) => c > 0);
    const neg = costs.some((c) => c < 0);
    assert.ok(!(pos && neg), `${type} would be both a power and a drawback`);
  }
  // SoulBound alone mixes ZEROS in among its negatives, and a zero
  // picks no side - which is why the classifiers test <= 0 with a
  // some(< 0) rather than every(< 0)
  assert.ok(ENCHANTMENT_COSTS.SoulBound.costs.some((c) => c === 0));
  assert.ok(ENCHANTMENT_COSTS.SoulBound.costs.some((c) => c < 0));
  assert.equal(isSideEffect('SoulBound'), true, 'still a side effect despite the zeros');
  assert.equal(isPower('SoulBound'), false);

  // the three CastWhen* are POWERS - their spell prices are all
  // positive, which is why they sit in the powers picker
  for (const t of ['CastWhenUsed', 'CastWhenHeld', 'CastWhenStrikes']) assert.ok(isPower(t), t);
  assert.ok(isPower('EnhancesSkill'));
  // an unknown type is neither, rather than defaulting to a power
  assert.equal(isPower('NoSuchEffect'), false);
  assert.equal(isSideEffect('NoSuchEffect'), false);
});

test('M4: SoulBound is the ONLY source of forced enchantments in the game', () => {
  // GetForcedEnchantments is overridden by SoulBound and by nothing
  // else, so M3's forced-vs-chosen split exists to serve bound souls
  // and nothing else. Swept, not asserted on a sample.
  for (const type of enchantmentTypes()) {
    if (type === 'SoulBound') continue;
    for (const p of enchantmentParamValues(type)) {
      assert.equal(forcedEnchantments(type, p), null, `${type}@${p} drags nothing in`);
    }
  }
  // nine of the forty-three souls carry a set
  const withSets = ENCHANTMENT_COSTS.SoulBound.costs
    .map((_, id) => id).filter((id) => forcedEnchantments('SoulBound', id) !== null);
  assert.equal(withSets.length, 9);
  assert.deepEqual(withSets.map((id) => enchantmentParams('SoulBound')[id]).sort(),
    ['Daedra Lord', 'Daedra Seducer', 'Daedroth', 'Fire Atronach', 'Fire Daedra',
      'Frost Daedra', 'Ghost', 'Lich', 'Wraith']);
  assert.equal(forcedEnchantments('SoulBound', 0), null, 'a rat drags nothing in');
});

test('M4: forced children are split by their OWN cost sign and marked with the parent', () => {
  const parent = enchantmentKey('SoulBound', MOBILE_TYPES.DaedraLord);
  const { powers, sideEffects } = forcedEnchantments('SoulBound', MOBILE_TYPES.DaedraLord);
  // PotentVs vs Daedra is the one power; the damage and the weight
  // are drawbacks
  assert.deepEqual(powers.map((e) => e.type), ['PotentVs']);
  assert.deepEqual(sideEffects.map((e) => e.type), ['UserTakesDamage', 'ExtraWeight']);
  assert.equal(powers[0].enchantCost, 900, 'PotentVs at param Daedra, not at param 0');
  assert.equal(sideEffects[1].param, PARAM_NONE, 'ExtraWeight is a single-cost effect');
  assert.equal(sideEffects[1].enchantCost, -100);
  // every child carries the PARENT'S key, and its own
  for (const e of [...powers, ...sideEffects]) {
    assert.equal(e.parentEnchantment, parent, e.type);
    assert.equal(e.key, enchantmentKey(e.type, e.param));
    assert.notEqual(e.key, parent);
  }

  // the resolution really is per-param: the Lich and the Fire Daedra
  // both force EnhancesSkill, at two different skills
  const lich = forcedEnchantments('SoulBound', MOBILE_TYPES.Lich);
  const fire = forcedEnchantments('SoulBound', MOBILE_TYPES.FireDaedra);
  assert.equal(lich.powers.find((e) => e.type === 'EnhancesSkill').param, SKILLS.Destruction);
  assert.equal(fire.powers.find((e) => e.type === 'EnhancesSkill').param, SKILLS.Daedric);
  // and the atronach forces a SPELL, priced from the spell table
  const atro = forcedEnchantments('SoulBound', MOBILE_TYPES.FireAtronach);
  assert.deepEqual(atro.sideEffects, []);
  assert.equal(atro.powers.length, 1);
  assert.equal(atro.powers[0].param, 12, 'Resist Fire');
  assert.equal(atro.powers[0].enchantCost, 1560);

  // DFU splits on `EnchantCost > 0` - the INSTANCE's cost, not the
  // effect's classification. The two questions are different, but on
  // the nine sets as shipped they cannot disagree, because no forced
  // child prices at exactly zero. Swept rather than claimed, so that
  // a zero-cost child added later trips this instead of sliding into
  // the wrong list unnoticed.
  for (const id of Object.keys(SOUL_FORCED_ENCHANTMENTS)) {
    const f = forcedEnchantments('SoulBound', Number(id));
    for (const e of [...f.powers, ...f.sideEffects]) {
      assert.notEqual(e.enchantCost, 0, `${e.type} at ${e.param} prices at zero`);
    }
    for (const e of f.powers) assert.ok(e.enchantCost > 0, e.type);
    for (const e of f.sideEffects) assert.ok(e.enchantCost < 0, e.type);
  }
});

test('M4: the room check is only ever run for a bound soul (:884-897)', () => {
  const filler = (n) => Array.from({ length: n }, (_, i) => ({ key: `x:${i}`, enchantCost: 1 }));

  // an enchantment with NO forced children is never checked for room
  // at all - twenty already in the lists and it still says add. M3's
  // SetEnchantments cap is what finally truncates them, SILENTLY.
  const crowded = pickEnchantment('PotentVs', 0, { powers: filler(20), sideEffects: filler(20) });
  assert.equal(crowded.kind, 'add');
  assert.deepEqual(crowded.powers, []);
  assert.deepEqual(crowded.sideEffects, []);
  assert.equal(crowded.settings.enchantCost, 800);

  // a BOUND SOUL is checked, and the +1 is the incoming enchantment
  // itself. The Daedra Seducer drags in five, so five held plus five
  // forced plus one incoming is eleven - one over.
  const seducer = MOBILE_TYPES.DaedraSeducer;
  assert.equal(SOUL_FORCED_ENCHANTMENTS[seducer].length, 5);
  const atFour = pickEnchantment('SoulBound', seducer, { powers: filler(4), sideEffects: [] });
  assert.equal(atFour.kind, 'add', '4 + 5 + 1 = 10 fits exactly');
  assert.equal(atFour.powers.length + atFour.sideEffects.length, 5);
  const atFive = pickEnchantment('SoulBound', seducer, { powers: filler(5), sideEffects: [] });
  assert.equal(atFive.kind, 'noRoom', '5 + 5 + 1 = 11 does not');
  assert.equal(atFive.text, NO_ROOM_IN_ITEM);
  // the count spans BOTH lists, not one
  const split = pickEnchantment('SoulBound', seducer, { powers: filler(3), sideEffects: filler(2) });
  assert.equal(split.kind, 'noRoom');
  // and dropping the +1 would let eleven through - that is the mutant
  assert.equal(pickEnchantment('SoulBound', seducer, { powers: filler(0), sideEffects: [] }).kind, 'add');

  // a soul with a smaller set fits where the Seducer does not
  const atro = pickEnchantment('SoulBound', MOBILE_TYPES.FireAtronach, { powers: filler(5), sideEffects: [] });
  assert.equal(atro.kind, 'add', '5 + 1 + 1 = 7');
  // an unmintable param answers null rather than a free enchantment
  assert.equal(pickEnchantment('PotentVs', 9), null);
  assert.equal(enchantmentSettings('AbsorbsSpells', 0), null);
  assert.equal(enchantmentSettings('AbsorbsSpells', PARAM_NONE).enchantCost, 1500);
});

test('M4: removing a PARENT takes its children; removing a child takes nothing', () => {
  const parent = enchantmentKey('SoulBound', MOBILE_TYPES.Ghost);
  const chosen = enchantmentSettings('SoulBound', MOBILE_TYPES.Ghost);
  const { powers, sideEffects } = forcedEnchantments('SoulBound', MOBILE_TYPES.Ghost);
  const unrelated = enchantmentSettings('StrengthensArmor', PARAM_NONE);
  const list = [chosen, unrelated, ...powers, ...sideEffects];
  assert.equal(list.length, 5);

  const afterParent = removeEnchantment(list, parent);
  assert.deepEqual(afterParent.map((e) => e.key), [unrelated.key], 'the soul took all three with it');

  // a CHILD removed on its own takes only itself
  const child = sideEffects[0];
  const afterChild = removeEnchantment(list, child.key);
  assert.equal(afterChild.length, 4);
  assert.ok(!afterChild.includes(child));
  assert.ok(afterChild.includes(chosen), 'and the parent stays');

  // the key is the identity: same type and param, same key
  assert.equal(enchantmentKey('PotentVs', 1), enchantmentKey('PotentVs', 1));
  assert.notEqual(enchantmentKey('PotentVs', 1), enchantmentKey('PotentVs', 2));
  assert.notEqual(enchantmentKey('PotentVs', 1), enchantmentKey('LowDamageVs', 1));
  // a chosen enchantment's parent is 0, never its own key
  assert.equal(chosen.parentEnchantment, 0);
});

test('M4: the flags, four of which are NONE and one of which is missing entirely', () => {
  assert.equal(ITEM_MAKER_FLAGS.AllowMultiplePrimaryInstances, 1);
  assert.equal(ITEM_MAKER_FLAGS.AllowMultipleSecondaryInstances, 2);
  assert.equal(ITEM_MAKER_FLAGS.AlphaSortSecondaryList, 4);
  assert.equal(ITEM_MAKER_FLAGS.WeaponOnly, 8);

  // SIX effects can appear on an item only once - four declare
  // ItemMakerFlags.None outright, IncreasedWeightAllowance sets no
  // flags line at all, and SoulBound carries only the sort flag
  const once = enchantmentTypes()
    .filter((t) => !hasItemMakerFlag(t, ITEM_MAKER_FLAGS.AllowMultiplePrimaryInstances));
  assert.deepEqual(once.sort(), ['ExtraWeight', 'FeatherWeight', 'IncreasedWeightAllowance',
    'SoulBound', 'StrengthensArmor', 'WeakensArmor']);

  // THREE are weapon-only
  const weaponOnly = enchantmentTypes().filter((t) => hasItemMakerFlag(t, ITEM_MAKER_FLAGS.WeaponOnly));
  assert.deepEqual(weaponOnly.sort(), ['CastWhenStrikes', 'LowDamageVs', 'PotentVs']);

  // TWO allow the same secondary twice - the two that can deteriorate
  // or hurt you under more than one condition at once
  const twice = enchantmentTypes().filter((t) => hasItemMakerFlag(t, ITEM_MAKER_FLAGS.AllowMultipleSecondaryInstances));
  assert.deepEqual(twice.sort(), ['ItemDeteriorates', 'UserTakesDamage']);

  // FIVE alpha-sort their secondary list, and they are exactly the
  // five whose params are names rather than a short fixed menu
  const sorted = enchantmentTypes().filter((t) => hasItemMakerFlag(t, ITEM_MAKER_FLAGS.AlphaSortSecondaryList));
  assert.deepEqual(sorted.sort(), ['CastWhenHeld', 'CastWhenStrikes', 'CastWhenUsed',
    'EnhancesSkill', 'SoulBound']);
  assert.equal(hasItemMakerFlag('NoSuchEffect', 1), false);
});

test('M4: exclusions - two unconditional pairs, two param-matched, and a stage that decides', () => {
  const at = (type, param) => enchantmentSettings(type, param);

  // UNCONDITIONAL: one of the pair bars the other with no param test,
  // and it bars it at the PRIMARY stage, where there is no param yet
  assert.equal(isExclusiveTo('FeatherWeight', [at('ExtraWeight', PARAM_NONE)]), true);
  assert.equal(isExclusiveTo('ExtraWeight', [at('FeatherWeight', PARAM_NONE)]), true);
  assert.equal(isExclusiveTo('StrengthensArmor', [at('WeakensArmor', PARAM_NONE)]), true);
  assert.equal(isExclusiveTo('WeakensArmor', [at('StrengthensArmor', PARAM_NONE)]), true);
  assert.equal(isExclusiveTo('FeatherWeight', [at('StrengthensArmor', PARAM_NONE)]), false);

  // PARAM-MATCHED: Potent vs Undead bars Low Damage vs Undead and
  // NOTHING ELSE, so an item can be potent against undead and feeble
  // against animals at the same time
  const potentUndead = [at('PotentVs', 0)];
  assert.equal(isExclusiveTo('LowDamageVs', potentUndead, 0), true);
  assert.equal(isExclusiveTo('LowDamageVs', potentUndead, 3), false, 'animals is still open');
  // ...and at the PRIMARY stage, with no param to compare, it does
  // NOT bar the effect - DFU passes no comparerParam there (:651),
  // so the whole effect stays in the list and the clash is caught one
  // screen later. Dropping the param test would bar it a screen early.
  assert.equal(isExclusiveTo('LowDamageVs', potentUndead), false, 'the primary list still offers it');

  // the reputation SELF test: once "All" is on the item that effect
  // is barred outright, at either stage
  const repAll = [at('GoodRepWith', 5)];
  assert.equal(isExclusiveTo('GoodRepWith', repAll), true);
  assert.equal(isExclusiveTo('GoodRepWith', repAll, 0), true);
  // and picking "All" is barred while any single group is present -
  // but only at the SECONDARY stage, where the param is known
  const repOne = [at('GoodRepWith', 0)];
  assert.equal(isExclusiveTo('GoodRepWith', repOne, 5), true, 'All over Commoners');
  assert.equal(isExclusiveTo('GoodRepWith', repOne, 1), false, 'Merchants is fine');
  assert.equal(isExclusiveTo('GoodRepWith', repOne), false, 'primary stage cannot see it');
  // the cross-effect half of the rep pair is param-matched like the
  // damage pair
  assert.equal(isExclusiveTo('BadRepWith', repOne, 0), true);
  assert.equal(isExclusiveTo('BadRepWith', repOne, 1), false);

  // an effect with no rule is never exclusive to anything
  assert.equal(isExclusiveTo('RegensHealth', [at('ItemDeteriorates', 0)], 0), false);
});

test('M4: the primary list filters by instance, by weapon-only, and by exclusion', () => {
  const weapon = { group: 'Weapons' };
  const robe = { group: 'MensClothing' };

  // WEAPON-ONLY: two of the three weapon-only effects are powers, and
  // they leave the list when the item is not a weapon
  const onWeapon = primaryPickerList(true, { item: weapon });
  const onRobe = primaryPickerList(true, { item: robe });
  assert.ok(onWeapon.includes('PotentVs'));
  assert.ok(onWeapon.includes('CastWhenStrikes'));
  assert.ok(!onRobe.includes('PotentVs'));
  assert.ok(!onRobe.includes('CastWhenStrikes'));
  assert.ok(onRobe.includes('CastWhenUsed'), 'the other two cast-whens stay');
  // LowDamageVs is weapon-only too, on the side-effects side
  assert.ok(primaryPickerList(false, { item: weapon }).includes('LowDamageVs'));
  assert.ok(!primaryPickerList(false, { item: robe }).includes('LowDamageVs'));
  // no item selected at all reads as "not a weapon"
  assert.ok(!primaryPickerList(true, {}).includes('PotentVs'));

  // ONE INSTANCE ONLY: StrengthensArmor leaves once it is on the item
  const withArmor = [enchantmentSettings('StrengthensArmor', PARAM_NONE)];
  assert.ok(!primaryPickerList(true, { item: weapon, powers: withArmor }).includes('StrengthensArmor'));
  // ...and so does its opposite, through the exclusion rather than
  // the instance rule - WeakensArmor is a SIDE effect, so this is the
  // filter reaching across both lists
  assert.ok(!primaryPickerList(false, { item: weapon, powers: withArmor }).includes('WeakensArmor'));
  // an effect that ALLOWS multiple primaries stays after one is taken
  const withPotent = [enchantmentSettings('PotentVs', 0)];
  assert.ok(primaryPickerList(true, { item: weapon, powers: withPotent }).includes('PotentVs'));
  // and LowDamageVs is still offered, because the clash is per-param
  assert.ok(primaryPickerList(false, { item: weapon, powers: withPotent }).includes('LowDamageVs'));

  // the two lists never offer the same effect
  const p = primaryPickerList(true, { item: weapon });
  const s = primaryPickerList(false, { item: weapon });
  assert.equal(p.filter((t) => s.includes(t)).length, 0);
  assert.equal(p.length + s.length, 24, 'and together they offer everything, on a weapon');
});

test('M4: the SINGLETON SHORTCUT skips the secondary picker (:832-838)', () => {
  // the six single-cost effects are added straight to the list
  for (const t of ['AbsorbsSpells', 'ExtraWeight', 'FeatherWeight', 'RepairsObjects',
    'StrengthensArmor', 'WeakensArmor']) {
    const pick = primaryPick(t, {});
    assert.equal(pick.kind, 'add', t);
    assert.equal(pick.settings.param, PARAM_NONE, t);
    assert.equal(pick.settings.enchantCost, enchantmentCost(t, PARAM_NONE), t);
  }
  // everything else opens a chooser
  for (const t of enchantmentTypes()) {
    if (enchantmentParamValues(t).length === 1) continue;
    assert.equal(primaryPick(t, {}).kind, 'choose', t);
  }
  // DFU also excludes SoulBound from the shortcut BY NAME. It mints
  // forty-three settings and can never reach a length of one, so that
  // clause is defensive and cannot fire - kept verbatim, pinned here
  // as the reason it looks redundant.
  assert.equal(enchantmentParamValues('SoulBound').length, 43);
  assert.equal(primaryPick('SoulBound', {}).kind, 'choose');
  assert.equal(primaryPick('NoSuchEffect', {}), null);
});

test('M4: the secondary list alpha-sorts when flagged, and filters what is already taken', () => {
  // the flagged five sort by the NAME the picker prints, so the spell
  // list comes out alphabetical rather than in DFU's declaration order
  const used = primaryPick('CastWhenUsed', {}).options.map((o) => o.label);
  assert.deepEqual(used.slice(0, 3), ["Balyna's Antidote", 'Cure Poison', 'Far Silence']);
  assert.deepEqual(used, [...used].sort());
  assert.deepEqual(primaryPick('EnhancesSkill', {}).options.map((o) => o.label).slice(0, 3),
    ['Alteration', 'Archery', 'Axe']);
  assert.deepEqual(primaryPick('SoulBound', {}).options.map((o) => o.label).slice(0, 2),
    ['Ancient Lich', 'Ancient Vampire']);
  // an UNFLAGGED effect keeps DFU's own order - Undead first, not
  // Animals first, which alphabetical would give
  assert.deepEqual(primaryPick('PotentVs', {}).options.map((o) => o.label),
    ['Undead', 'Daedra', 'Humanoid', 'Animals']);

  // an exact setting already on the item is filtered out...
  const taken = [enchantmentSettings('PotentVs', 0)];
  const left = primaryPick('PotentVs', { powers: taken }).options.map((o) => o.param);
  assert.deepEqual(left, [1, 2, 3], 'Undead is gone, the rest remain');
  // ...unless the effect allows multiple secondary instances, which
  // exactly two do
  const deteriorating = [enchantmentSettings('ItemDeteriorates', 0)];
  const stillThere = primaryPick('ItemDeteriorates', { sideEffects: deteriorating, selectingPowers: false });
  assert.deepEqual(stillThere.options.map((o) => o.param), [0, 1, 2], 'all three stay');

  // the cross-effect exclusion reaches the secondary list at its own
  // param: with Potent vs Undead taken, Low Damage vs Undead is gone
  // and the other three stay
  const lowDamage = primaryPick('LowDamageVs', { powers: taken, selectingPowers: false });
  assert.deepEqual(lowDamage.options.map((o) => o.param), [1, 2, 3]);
  // and "All" drops out of the reputation list once a group is taken
  const oneGroup = [enchantmentSettings('GoodRepWith', 0)];
  assert.deepEqual(primaryPick('GoodRepWith', { powers: oneGroup }).options.map((o) => o.param),
    [1, 2, 3, 4], 'Commoners taken, All barred, four left');
});
