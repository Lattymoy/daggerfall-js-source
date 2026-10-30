// FOE-METAL (bible/05-Combat/Fixed-PvE.md section 15): a template foe's kit and loot roll DFU's material curve at the
// foe's own level, Unleveled Loot passed by - Daedric about 8% of weapons at level 20 and 16% at 30, as vanilla.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomMaterial, randomArmorMaterial, withFoeMaterialLevel, foeMaterialLevel, ARMOR_MATERIAL } from '../../../src/combat/enemyEquipment.js';
import { registerFormulaOverride } from '../../../src/combat/formulas.js';
import { seededRng } from '../../../src/systems/wind/wind.js';

const daedric = (L, n = 20000) => {
  const r = seededRng(7);
  let w = 0, a = 0;
  withFoeMaterialLevel(L, () => { for (let i = 0; i < n; i++) { if (randomMaterial(1, r) === 9) w++; if (randomArmorMaterial(1, r) === ARMOR_MATERIAL.PLATE_BASE + 9) a++; } });
  return [w / n, a / n];
};

test('FOE-METAL: the foe\'s level climbs the vanilla curve - none low, about 8% of weapons at 20 and 16% at 30', () => {
  assert.deepEqual(daedric(5), [0, 0]);
  const [w20, a20] = daedric(20), [w30, a30] = daedric(30);
  assert.ok(Math.abs(w20 - 0.083) < 0.01 && Math.abs(w30 - 0.16) < 0.012, `${w20} ${w30}`);
  assert.ok(a20 > 0.005 && a20 < 0.014 && a30 > a20, `armour ${a20} ${a30}`);
  assert.equal(foeMaterialLevel(), null);
  assert.equal(withFoeMaterialLevel(12, () => foeMaterialLevel()), 12);
});

test('FOE-METAL: Unleveled Loot is passed by inside the scope and kept outside it', () => {
  registerFormulaOverride('randomMaterial', () => 3);
  registerFormulaOverride('randomArmorMaterial', () => 0);
  try {
    assert.equal(randomMaterial(1, seededRng(1)), 3);
    assert.equal(randomArmorMaterial(1, seededRng(1)), 0);
    const r = seededRng(1), seen = new Set();
    withFoeMaterialLevel(45, () => { for (let i = 0; i < 200; i++) seen.add(randomMaterial(1, r)); });
    assert.ok(seen.size > 2, 'the curve, not the override');
  } finally { registerFormulaOverride('randomMaterial', null); registerFormulaOverride('randomArmorMaterial', null); }
});

test('FOE-METAL WIRED: a template foe\'s whole loot chain rolls inside the scope at its own level', () => {
  const src = readFileSync(new URL('../../../src/scenes/hostCombat.js', import.meta.url), 'utf8');
  assert.match(src, /return entity\?\.pveTemplate \? withFoeMaterialLevel\(entity\.level, roll\) : roll\(\);/);
});
