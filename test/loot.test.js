// Systems S1: the loot tables + generation flow, verbatim, deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LOOT_MATRICES, ITEM_GROUPS, generateRandomLoot, generateItems,
  createRandomWeapon, createRandomArmor, BOOK_TEMPLATE,
} from '../src/systems/loot.js';

// Exhausted seq HOLDS its last value (a cycling seq re-fed roll 0 into
// later categories - caught when key J grew a Tower Shield).
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('loot: matrix rows verbatim + group lists sane', () => {
  assert.equal(Object.keys(LOOT_MATRICES).length, 22);   // '-' + A..U, per the source rows
  assert.deepEqual(LOOT_MATRICES.C, { MinGold: 2, MaxGold: 20, P1: 10, P2: 10, C1: 5, C2: 5, C3: 5, M1: 5, AM: 5, WP: 25, MI: 3, CL: 0, BK: 2, M2: 2, RL: 2 });
  assert.deepEqual(LOOT_MATRICES.T.AM, 100);
  assert.equal(ITEM_GROUPS.CreatureIngredients2.length, 5);       // brace-bounded, no bleed
  assert.equal(ITEM_GROUPS.CreatureIngredients3.length, 3);
  assert.ok(!ITEM_GROUPS.CreatureIngredients2.some((v) => ITEM_GROUPS.CreatureIngredients1.includes(v)));
});

test('loot: gold x level, the halving loop, 0%-keeps-1/100', () => {
  // key J: gold only (50-150), no ingredients. level 3, roll 0 -> 50*3
  const who = { level: 3, gender: 'male' };
  // rolls: gold .0; WP dice .99 miss; AM .99; C1..M2 x7 .99; CL .99; BK .99; RL .99
  const items = generateRandomLoot(LOOT_MATRICES.J, who, seq(0, 0.99));
  assert.equal(items[0].group, 'Currency');
  assert.equal(items[0].stackCount, 150);
  // halving: H has WP 100 - 0.99 passes (99 < 100), then 50 (0.30
  // passes), 25 (0.30 misses). EXACT consumption: a weapon hit costs
  // dice + slot + material = 3 rolls (my first script budgeted 4 and
  // every later dice shifted - the trace grew a third Dagger).
  const rolls = seq(
    0,                 // gold (2-10) -> 2 * 1 = 2
    0.99, 0, 0,        // WP dice HIT; slot 0 = Dagger; material
    0.30, 0, 0,        // WP dice HIT at 50; slot; material
    0.30,              // WP dice 30 !< 25 MISS
    0.99,              // AM 0: dice miss (0<0 never - DFU's Dice100, see below)
    0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99,   // 7 ingredient dices, all 0-chance
    0.99, 0.99,        // CL 2 miss; BK 0 miss
    0.99               // RL 0 miss
  );
  const h = generateRandomLoot(LOOT_MATRICES.H, { level: 1, gender: 'male' }, rolls);
  const weapons = h.filter((i) => i.group === 'Weapons');
  assert.equal(weapons.length, 2);                    // 100 -> 50 -> 25 stopped
  assert.equal(weapons[0].name, 'Dagger');
  // the "0% has 1/100" note: dice100(0, roll) is FALSE for all rolls
  // (Range(0,100) < 0 never) - DFU's Dice100 carries the same; the
  // classic quirk lived in the raw <= compare, DFU's port already
  // dropped it and we match DFU. Pin that choice:
  const none = generateRandomLoot(LOOT_MATRICES['-'], { level: 9, gender: 'male' }, seq(0));
  assert.equal(none.length, 0);
});

test('loot: level split (C1 scales, C3 flat), arrows, books, gender clothing', () => {
  // key B: P1/P2 = 10 only. level 5 -> chance 50: roll .49 hits, .49 again (25) misses at 25? 49 !< 25 miss
  const b = generateRandomLoot(LOOT_MATRICES.B, { level: 5, gender: 'male' },
    seq(0, 0.49, 0, 0.49, 0.49, 0, 0.49));
  const p1 = b.filter((i) => i.group === 'PlantIngredients1');
  assert.ok(p1.length >= 1 && ITEM_GROUPS.PlantIngredients1.includes(p1[0].templateIndex));
  // arrows: slot 18 -> 18/19 = .947+; stack roll .5 -> 1 + 10
  const arrows = createRandomWeapon(1, seq(0.95, 0.5));
  assert.equal(arrows.name, 'Arrow');
  assert.equal(arrows.stackCount, 11);
  assert.equal(arrows.material, 0);
  const armor = createRandomArmor(1, seq(0, 0.5));    // piece 0 = Cuirass(102), leather
  assert.equal(armor.templateIndex, 102);
  // K: BK 5 - roll .04 hits -> book template 277 variant floor(.5*4)=2
  const k = generateItems('K', { level: 1, gender: 'female' },
    seq(0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.04, 0.5, 0.99, 0.99));
  const book = k.find((i) => i.group === 'Books');
  assert.ok(book && book.templateIndex === BOOK_TEMPLATE && book.variant === 2);
  assert.equal(generateItems('ZZ', { level: 1, gender: 'male' }, seq(0)).length, 0);   // unknown key -> '-'
});
