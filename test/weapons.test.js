import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEAPONS, WEAPON_MATERIALS, weaponMinDamage, weaponMaxDamage,
  weaponMaterialModifier, weaponToHit, weaponDyeColor, buildWeapon,
  weightMultipliersByMaterial, valueMultipliersByMaterial, conditionMultipliersByMaterial,
} from '../src/characters/weapons.js';
import { DYE_COLORS } from '../src/characters/dyes.js';
import { buildSword } from '../src/characters/pieces/sword.js';
import { STEEL_RAMP } from '../src/characters/pieces/pieceLoft.js';

// Witness against the DFU source (ItemEnums, ItemBuilder,
// DaggerfallUnityItem.GetWeaponMaterialModifier, FormulaHelper
// CalculateWeaponMin/MaxDamage): every constant pinned byte-exact.
test('weapons: verbatim DFU data pins', () => {
  assert.equal(WEAPONS.Dagger, 113);
  assert.equal(WEAPONS.Longsword, 120);
  assert.equal(WEAPONS.Arrow, 131);
  assert.equal(WEAPON_MATERIALS.Iron, 0);
  assert.equal(WEAPON_MATERIALS.Daedric, 9);
  assert.deepEqual([...weightMultipliersByMaterial], [4, 5, 4, 4, 3, 4, 4, 2, 4, 5]);
  assert.deepEqual([...valueMultipliersByMaterial], [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]);
  assert.deepEqual([...conditionMultipliersByMaterial], [4, 6, 6, 8, 12, 16, 20, 24, 28, 32]);
  // FormulaHelper min/max, every weapon.
  const MIN = { Dagger: 1, Tanto: 1, Wakazashi: 1, Shortsword: 1, Broadsword: 1, Staff: 1, Mace: 1, Longsword: 2, Claymore: 2, Battle_Axe: 2, War_Axe: 2, Flail: 2, Saber: 3, Katana: 3, Dai_Katana: 3, Warhammer: 3, Short_Bow: 4, Long_Bow: 4, Arrow: 0 };
  const MAX = { Dagger: 6, Tanto: 8, Shortsword: 8, Staff: 8, Wakazashi: 10, Broadsword: 12, Saber: 12, Battle_Axe: 12, Mace: 12, Flail: 14, Longsword: 16, Katana: 16, War_Axe: 16, Short_Bow: 16, Claymore: 18, Warhammer: 18, Long_Bow: 18, Dai_Katana: 21, Arrow: 0 };
  for (const [name, idx] of Object.entries(WEAPONS)) {
    assert.equal(weaponMinDamage(idx), MIN[name], `min ${name}`);
    assert.equal(weaponMaxDamage(idx), MAX[name], `max ${name}`);
  }
  // Material modifier + to-hit (mod * 10) + dye mapping.
  const MODS = { Iron: -1, Steel: 0, Silver: 0, Elven: 1, Dwarven: 2, Mithril: 3, Adamantium: 3, Ebony: 4, Orcish: 5, Daedric: 6 };
  for (const [name, m] of Object.entries(WEAPON_MATERIALS)) {
    if (m < 0) continue;
    assert.equal(weaponMaterialModifier(m), MODS[name], `mod ${name}`);
    assert.equal(weaponToHit(m), MODS[name] * 10, `hit ${name}`);
    assert.equal(weaponDyeColor(m), DYE_COLORS[name], `dye ${name}`);
  }
  // ApplyWeaponMaterial math on a Daedric Longsword (template 120 -
  // ported row: baseWeight 4.5, hitPoints 800, basePrice 15):
  // value 15*3*512; weight quarter-kg rule with Unity's half-to-EVEN
  // round (trunc(4.5*4)=18, *5=90, /4=22.5 -> 22 -> 5.5kg);
  // condition trunc(800*32/4).
  const d = buildWeapon(WEAPONS.Longsword, WEAPON_MATERIALS.Daedric);
  assert.equal(d.value, 15 * 3 * 512);
  assert.equal(d.weightInKg, 5.5);
  assert.equal(d.maxCondition, Math.trunc((800 * 32) / 4));
  assert.equal(d.currentCondition, d.maxCondition);
  assert.equal(d.dyeColor, DYE_COLORS.Daedric);
  const fem = buildWeapon(WEAPONS.Longsword, WEAPON_MATERIALS.Iron, { female: true });
  assert.equal(fem.playerTextureArchive, d.playerTextureArchive - 1);
});

test('sword piece: grip-baked, armL, point-forward carry (+45 seat)', () => {
  const faces = buildSword(STEEL_RAMP);
  assert.ok(faces.length > 40, 'too few faces');
  const pts = [];
  for (const f of faces) {
    assert.equal(f.g, 'armL');
    assert.equal(f.p.length, 12);
    assert.ok(f.c && f.c.length === 3);
    const nl = Math.hypot(f.n[0], f.n[1], f.n[2]);
    assert.ok(Math.abs(nl - 1) < 1e-6, 'non-unit normal');
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(f.p[i * 3] - -0.235) < 0.10, `off the fist column: x=${f.p[i * 3]}`);
      pts.push([f.p[i * 3], f.p[i * 3 + 1], f.p[i * 3 + 2]]);
    }
  }
  // blade axis = farthest-apart pair; the GRIP bake (Mac's reference)
  // must stand it up-forward ~47deg from vertical with the tip high
  // (+z) and the pommel low behind the fist (-z).
  let A = null, C = null, best = -1;
  for (let i = 0; i < pts.length; i += 7) for (let j = i + 7; j < pts.length; j += 7) {
    const d = (pts[i][0]-pts[j][0])**2 + (pts[i][1]-pts[j][1])**2 + (pts[i][2]-pts[j][2])**2;
    if (d > best) { best = d; A = pts[i]; C = pts[j]; }
  }
  const [tip, pom] = A[1] + A[2] > C[1] + C[2] ? [A, C] : [C, A];
  const tilt = Math.atan2(Math.hypot(tip[0]-pom[0], tip[2]-pom[2]), tip[1]-pom[1]) * 180 / Math.PI;
  // Mac's baked +45 seat: near-horizontal point-forward carry.
  assert.ok(tilt > 84 && tilt < 94, `blade tilt from vertical ${tilt}`);
  assert.ok(tip[2] > 0.70 && tip[1] > 0.78 && tip[1] < 0.92, `tip not point-forward: ${tip}`);
  assert.ok(pom[2] < -0.08 && pom[1] > 0.76 && pom[1] < 0.92, `pommel not behind the fist: ${pom}`);
  const len = Math.sqrt(best);
  assert.ok(len > 0.90 && len < 1.02, `blade span ${len}`);
});
