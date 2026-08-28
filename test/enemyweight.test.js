// EW1 - THE ENEMY WEIGHT TERM (2026-08-28).
//
// GetEnemyEntityWeightInClassicUnits (FormulaHelper.cs:2881-2898):
//
//   int itemWeightsClassic = (int)(e.Items.GetWeight() * 4);
//   int baseWeight;
//   if (EnemyMonster)      baseWeight = e.MobileEnemy.Weight;
//   else if (Female)       baseWeight = 240;
//   else                   baseWeight = 350;
//   return itemWeightsClassic + baseWeight;
//
// The port had the base half and nothing else, so every armed or
// armoured foe in the game weighed what a naked one does. Weight is
// weaponKnockbackSpeed's DIVISOR, so the missing kit did not merely
// round something off - it threw foes further with every blow.
//
// THE SHAPE MATTERED AS MUCH AS THE TERM. The port opened with
// `if (!isClass) return mobileWeight ?? 0` - an early exit - and DFU
// computes itemWeightsClassic BEFORE the type branch, adding it to
// whichever base wins. Bolting the term onto the class arm of an
// early-return function would have looked like the fix, passed a pin
// written only for class enemies, and left every monster in the game
// still weighing its bare mobile weight. The branch is a baseWeight
// ASSIGNMENT here, as it is in C#, and the monster arm is pinned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { enemyWeightClassicUnits, weaponKnockbackSpeed } from '../src/combat/formulas.js';
import { totalWeight } from '../src/systems/inventory.js';
import { dfuFile } from './dfuRoot.mjs';   // PY1: DFU_PATH, then the in-tree sparse clone

const HERE = dirname(fileURLToPath(import.meta.url));
/** A real blade + cuirass through the port's own template weights. */
const KIT = [
  { group: 'Weapons', templateIndex: 118, material: 0, stackCount: 1 },
  { group: 'Armor', templateIndex: 102, material: 0, stackCount: 1 },
];

test('EW1: the answer is itemWeightsClassic + baseWeight, on all three bases', () => {
  // the bases alone, unchanged from before the term landed
  assert.equal(enemyWeightClassicUnits(true, 'male', 0), 350);
  assert.equal(enemyWeightClassicUnits(true, 'female', 0), 240);
  assert.equal(enemyWeightClassicUnits(false, 'male', 200), 200, 'a monster is its MobileEnemy.Weight');
  // ...and the kit adds on top of each
  const kitClassic = Math.trunc(totalWeight(KIT) * 4);
  assert.ok(kitClassic > 0, 'the fixture kit actually weighs something');
  assert.equal(enemyWeightClassicUnits(true, 'male', 0, KIT), 350 + kitClassic);
  assert.equal(enemyWeightClassicUnits(true, 'female', 0, KIT), 240 + kitClassic);
});

test('EW1: a MONSTER carries the item term too - the early-return shape would have skipped it', () => {
  // THE PIN THIS FILE EXISTS FOR. DFU computes itemWeightsClassic
  // before the type branch (:2887, above the `if (EntityType ==
  // EnemyMonster)` at :2890), so it lands on the monster base as much
  // as the class one. A fix bolted onto the class arm of the port's
  // old `if (!isClass) return mobileWeight` would pass every other
  // assertion in this file and fail exactly this one.
  const kitClassic = Math.trunc(totalWeight(KIT) * 4);
  assert.equal(enemyWeightClassicUnits(false, 'male', 200, KIT), 200 + kitClassic);
  assert.equal(enemyWeightClassicUnits(false, 'female', 137, KIT), 137 + kitClassic,
    'and a monster ignores GENDER for its base, kit or no kit');
});

test('EW1: the multiply is x4 TRUNCATED, and reads through totalWeight', () => {
  // (int) in C# truncates toward zero - it does not round. The port's
  // one home for a stack's kg IS ItemCollection.GetWeight, so the pin
  // asserts against totalWeight rather than restating a template
  // number that could drift out from under it.
  const kg = totalWeight(KIT);
  assert.equal(enemyWeightClassicUnits(true, 'male', 0, KIT) - 350, Math.trunc(kg * 4));
  assert.ok(Number.isInteger(enemyWeightClassicUnits(true, 'male', 0, KIT)),
    'the answer is a whole number of classic units');
  // TRUNC vs ROUND, ON A FIXTURE THAT CAN TELL THEM APART. The
  // mutation campaign is why this arm exists: swapping Math.trunc for
  // Math.round SURVIVED the first version of this test, because KIT's
  // weight x 4 lands on a whole number and the two agree there. A pin
  // asserting `answer - 350 === Math.trunc(kg * 4)` is vacuous the
  // moment kg * 4 is already integral - it re-derives the expectation
  // from the same value, so both implementations satisfy it.
  //
  // 4 x 0.1 kg = 0.4 kg = 1.6 classic units: truncation gives 1, and
  // rounding gives 2. Asserted as the LITERAL 1, not as Math.trunc of
  // anything, so the pin cannot follow the implementation.
  const odd = [{ group: 'Ingredients', templateIndex: 253, material: 0, stackCount: 4 }];
  assert.equal(totalWeight(odd), 0.4, 'the fixture still weighs what this arm needs');
  assert.equal(enemyWeightClassicUnits(true, 'male', 0, odd), 350 + 1,
    '0.4 kg is 1.6 classic units and C#\'s (int) cast takes 1 - rounding would take 2');
  // an empty or absent list is the base alone - the honest answer for
  // a foe the port gives no inventory, and the old behaviour exactly
  assert.equal(enemyWeightClassicUnits(true, 'male', 0, []), 350);
  assert.equal(enemyWeightClassicUnits(true, 'male', 0, null), 350);
  assert.equal(enemyWeightClassicUnits(true, 'male', 0), 350);

});

test('EW1: weight is knockback\'s DIVISOR - a kitted foe is thrown LESS', () => {
  // why the missing term was a gameplay bug and not a rounding nit
  const bare = weaponKnockbackSpeed(20, enemyWeightClassicUnits(true, 'male', 0));
  const kitted = weaponKnockbackSpeed(20, enemyWeightClassicUnits(true, 'male', 0, KIT));
  assert.ok(kitted < bare, `kit must reduce knockback (${kitted} vs ${bare})`);
});

test('EW1: every call site hands the foe\'s items through', () => {
  // THE SOURCE SWEEP. The term is only real where a caller passes a
  // list, and a new enemy pool copying an existing three-argument call
  // is exactly how the kit goes missing again for one pool while every
  // pin here still passes. Four pools call this today.
  const SRC = join(HERE, '..', 'src');
  const bad = [];
  let sites = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.js')) continue;
      if (p.endsWith(join('combat', 'formulas.js'))) continue;   // the definition itself
      const src = readFileSync(p, 'utf8');
      for (const m of src.matchAll(/enemyWeightClassicUnits\(([^)]*)\)/g)) {
        sites++;
        // four arguments, the last being the items list
        if (m[1].split(',').length < 4) bad.push(`${relative(SRC, p)}: ${m[0]}`);
      }
    }
  };
  walk(SRC);
  assert.ok(sites >= 4, `expected the four knockback pools to call it, found ${sites}`);
  assert.deepEqual(bad, [],
    'these call sites drop the foe\'s item list, so their pool weighs every enemy as if naked\n'
    + '(FormulaHelper.cs:2887 - the term is half of DFU\'s answer)');
});

// The reference tree is EXTERNAL (Port-Doctrine), resolved through
// dfuRoot.mjs so it is found wherever the checkout lives.
const FORMULA_CS = dfuFile('Assets/Scripts/Game/Formulas/FormulaHelper.cs');

test('EW1: the constants are REGENERATED from FormulaHelper.cs', { skip: !existsSync(FORMULA_CS) }, () => {
  // Not a remembered 240/350/x4 - the numbers read off DFU's own
  // method body, so a change upstream fails here rather than drifting
  // silently (the PY1 discipline).
  const cs = readFileSync(FORMULA_CS, 'utf8');
  const at = cs.indexOf('public static int GetEnemyEntityWeightInClassicUnits');
  assert.ok(at > 0, 'the method is still in FormulaHelper.cs under this name');
  const body = cs.slice(at, cs.indexOf('\n        }', at));
  const mult = /GetWeight\(\)\s*\*\s*(\d+)/.exec(body);
  assert.ok(mult, 'the item-weight multiply is still spelled Items.GetWeight() * N');
  assert.equal(Number(mult[1]), 4, 'the classic-units multiplier');
  const bases = [...body.matchAll(/baseWeight\s*=\s*(\d+);/g)].map((m) => Number(m[1]));
  assert.deepEqual(bases.sort((a, b) => a - b), [240, 350], 'the female/male class bases');
  // the ORDER is the load-bearing part: the item term is computed
  // BEFORE the type branch, which is why a monster gets it too
  assert.ok(body.indexOf('itemWeightsClassic') < body.indexOf('EntityTypes.EnemyMonster'),
    'DFU computes the item term above the type branch - the monster arm shares it');
  assert.match(body, /return\s+itemWeightsClassic\s*\+\s*baseWeight;/,
    'and the return is the SUM, not one or the other');
});
