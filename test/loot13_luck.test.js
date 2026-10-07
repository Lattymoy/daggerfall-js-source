// LOOT13 - LUCK IS A NUDGE, NEVER THE SOURCE (2026-10-07; bible/06-Systems/Loot-II-Arc.md section 5; Mac: "what could we
// do to make it even more amazing, while also balancing everyrhing?", then "Lets go all in").
//
// Luck was a flat 2 per mille a point over 50 ADDED to every threshold (LR1). On Magic's hundred-and-more that was a
// nudge; on Legendary's one to forty-five it was the whole roll: measured through the real rarityChances, a level-1 rat
// at Luck 65 dropped a Legendary 15 times as often as at 50 and more often than a tier-8 corpse at 50; a plain humanoid
// sat at its Legendary ceiling from Luck 55; and at Luck 44 and under no corpse below level 16 could drop one at all -
// the drought's x3 (LOOT8) multiplying nothing. Luck now MULTIPLIES every threshold before its cap, 1% a point, from
// half at 0 to half again at 100 (`luckMult`), so LR1's law holds again: the source sets the odds, luck leans on them.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { PLAIN_FOE_RARITY_WEIGHTS } from '../src/systems/foeLootCap.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('LOOT13: luck multiplies - 1 at 50, a point 1%, half at 0 and half again at 100, clamped; every threshold leans by it before its cap', () => {
  assert.equal(LR.luckMult(50), 1);
  assert.equal(LR.luckMult(), 1, 'no luck read is 50');
  assert.ok(near(LR.luckMult(65), 1.15) && near(LR.luckMult(40), 0.9) && near(LR.luckMult(51), 1.01));
  assert.equal(LR.luckMult(0), LR.LUCK_MULT_MIN);
  assert.equal(LR.luckMult(100), LR.LUCK_MULT_MAX);
  assert.deepEqual([LR.LUCK_MULT_MIN, LR.LUCK_MULT_MAX, LR.LUCK_PCT_PER_POINT], [0.5, 1.5, 1]);
  assert.equal(LR.luckMult(-40), 0.5, 'a drained luck under 0 reads 0');
  assert.equal(LR.luckMult(400), 1.5, 'a fortified luck past 100 reads 100');
  const base = LR.rarityChances({ kind: 'corpse', tier: 8 });
  const lean = LR.rarityChances({ kind: 'corpse', tier: 8, luck: 65 });
  for (const k of ['magic', 'rare', 'legendary']) assert.ok(near(lean[k], base[k] * 1.15), `${k}: 15% more at Luck 65`);
  const low = LR.rarityChances({ kind: 'corpse', tier: 8, luck: 40 });
  for (const k of ['magic', 'rare', 'legendary']) assert.ok(near(low[k], base[k] * 0.9), `${k}: 10% less at Luck 40`);
  // a ceiling still holds: a Daedra Lord's corpse at Luck 100 sits at the caps, never past them
  assert.deepEqual(LR.rarityChances({ kind: 'corpse', tier: 21, boss: true, luck: 100 }),
    { magic: LR.RARITY_WEIGHTS.magic.cap, rare: LR.RARITY_WEIGHTS.rare.cap, legendary: LR.RARITY_WEIGHTS.legendary.cap });
  // and a champion's own Legendary source leans by it too
  const champ = LR.championSource(LR.corpseSource({ level: 10 }));
  const c50 = LR.rarityChances({ ...champ, luck: 50 }), c80 = LR.rarityChances({ ...champ, luck: 80 });
  assert.ok(near(c80.legendary, c50.legendary * 1.3), 'the champion\'s Legendary threshold leans 30% at Luck 80');
});

test('LOOT13: the source sets the odds again - a rat at Luck 65 stays under a tier-8 corpse at 50, a plain humanoid never reaches its ceiling by luck, and Luck 40 still finds - the drought lifting it', () => {
  const rat = (luck) => LR.rarityChances({ ...LR.corpseSource({ level: 1 }), luck });
  const t8 = (luck) => LR.rarityChances({ ...LR.corpseSource({ level: 8 }), luck });
  assert.ok(near(rat(50).legendary, 2.2), 'a rat at Luck 50: 2.2 per mille, as LR1 measured it');
  assert.ok(rat(65).legendary < 3, `a rat at Luck 65: ${rat(65).legendary.toFixed(2)} per mille (it was 32.2)`);
  assert.ok(rat(65).legendary < t8(50).legendary, 'and under a tier-8 corpse at Luck 50 - the source outranks the luck');
  const plain = (level, luck) => LR.rarityChances({ ...LR.corpseSource({ level }), luck, weights: PLAIN_FOE_RARITY_WEIGHTS });
  assert.ok(plain(1, 55).legendary < PLAIN_FOE_RARITY_WEIGHTS.legendary.cap / 10, 'a plain level-1 humanoid at Luck 55 is a tenth of its ceiling (it sat at it)');
  assert.ok(plain(8, 100).legendary < PLAIN_FOE_RARITY_WEIGHTS.legendary.cap, 'a plain level-8 humanoid at Luck 100 is still under it');
  for (const level of [1, 4, 8, 12, 15]) {
    assert.ok(t8(40).legendary > 0 && LR.rarityChances({ ...LR.corpseSource({ level }), luck: 40 }).legendary > 0, `Luck 40, a level-${level} corpse can still drop a Legendary`);
  }
  const dry = LR.rarityChances({ ...LR.corpseSource({ level: 8 }), luck: 40, find: 3 });
  assert.ok(near(dry.legendary, t8(40).legendary * 3), 'the drought\'s x3 lifts a low-luck character\'s chance - it multiplied nothing at Luck 44');
});

test('LOOT13: one law at the host door - a seeded roll between the leaned thresholds lands as the luck says, and the unique find\'s own small term is unmoved', () => {
  on();
  const src = { kind: 'corpse', tier: 8, family: null };
  const c50 = LR.rarityChances(src);
  const c100 = LR.rarityChances({ ...src, luck: 100 });
  // a roll just over the Magic threshold at 50 and under it at 100
  const r = (c50.magic + c100.magic) / 2 / 1000;
  const at = (v) => { const seq = [v]; return () => (seq.length ? seq.shift() : 0.999); };
  const piece = () => createWeapon(120, 1);
  const a = [piece()]; LR.rollLootRarity(a, src, { rolls: at(r), luck: 50 });
  const b = [piece()]; LR.rollLootRarity(b, src, { rolls: at(r), luck: 100 });
  assert.equal(LR.rarityOf(a[0]), 'common', 'Luck 50: the roll is past the Magic threshold');
  assert.equal(LR.rarityOf(b[0]), 'magic', 'Luck 100: the same roll is under the leaned one');
  // the unique find keeps its own term (a hundredth of the old ladder's, it never handed a find over)
  const find = { id: 'loot13-probe', minTier: 4, weight: 1, mint: () => [] };
  assert.ok(near(LR.uniqueFindChance(find, { kind: 'corpse', tier: 8, luck: 100 }) - LR.uniqueFindChance(find, { kind: 'corpse', tier: 8, luck: 50 }), 1));
});
