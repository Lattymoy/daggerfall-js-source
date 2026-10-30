// FOE-METAL (bible/05-Combat/Fixed-PvE.md section 15): a template foe's kit and loot roll DFU's material curve at the
// foe's own level, Unleveled Loot passed by; a weapon and an armour piece each Daedric at 7% at level 25.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomMaterial, randomArmorMaterial, withFoeMaterialLevel, foeMaterialLevel, foeDaedricChance, ARMOR_MATERIAL } from '../../../src/combat/enemyEquipment.js';
import { registerFormulaOverride } from '../../../src/combat/formulas.js';
import { seededRng } from '../../../src/systems/wind/wind.js';

const daedric = (L, n = 20000) => {
  const r = seededRng(7);
  let w = 0, a = 0;
  withFoeMaterialLevel(L, () => { for (let i = 0; i < n; i++) { if (randomMaterial(1, r) === 9) w++; if (randomArmorMaterial(1, r) === ARMOR_MATERIAL.PLATE_BASE + 9) a++; } });
  return [w / n, a / n];
};

test('FOE-METAL: a weapon and an armour piece are each Daedric at the foe\'s chance - none to 10, 7% at 25', () => {
  assert.deepEqual(daedric(5), [0, 0]);
  assert.deepEqual([10, 25, 40].map((L) => +foeDaedricChance(L).toFixed(4)), [0, 0.07, 0.14]);
  for (const L of [20, 25, 30, 45]) {
    const [w, a] = daedric(L);
    assert.ok(Math.abs(w - foeDaedricChance(L)) < 0.008 && Math.abs(a - foeDaedricChance(L)) < 0.008, `L${L}: ${w} ${a}`);
  }
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
