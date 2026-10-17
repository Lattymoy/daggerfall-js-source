import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dfWeaponShape, dfWeaponToMw, pickWeaponRecord, weaponRecords, parseBsaIndex } from '../../src/formats/morrowind/mwFirstPerson.js';
import { fpWeaponKey, weaponPartPaths } from '../../src/combat/fpArm.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { weaponOfMaterial } from '../../src/combat/enemyEquipment.js';

const rows = [
  ['Dagger', 0, 'dagger'], ['Tanto', 0, 'tanto'], ['Shortsword', 0, 'shortsword'], ['Wakazashi', 0, 'wakizashi'],
  ['Longsword', 1, 'longsword'], ['Katana', 1, 'katana'], ['Claymore', 2, 'claymore'], ['Dai_Katana', 2, 'dai-katana'],
  ['Mace', 3, 'mace'], ['Staff', 5, 'staff'], ['Warhammer', 4, 'warhammer'],
  ['War_Axe', 8, 'battle axe'], ['Battle_Axe', 7, 'war axe'], ['Long_Bow', 9, 'long bow'],   // PIN MOVED (MW-AXES): Daggerfall's axe names are Morrowind's crossed
];
const records = rows.map(([, type, name]) => ({ id: `daedric ${name}`, type, model: `w/${name}.nif`, enchanted: false }));
records.push({ id: 'daedric club', type: 3, model: 'w/club.nif', enchanted: false });

for (const [template, , name] of rows) {
  test(`model shape: Daedric ${template} selects its own mesh and preload`, () => {
    const weapon = weaponOfMaterial(WEAPONS[template], 9);
    const expected = records.find((r) => r.id === `daedric ${name}`);
    const got = pickWeaponRecord(records, dfWeaponToMw(weapon, WEAPONS), 'Daedric', { shape: dfWeaponShape(weapon, WEAPONS) });
    assert.equal(got.id, expected.id);
    assert.deepEqual(weaponPartPaths({ weapon, allWeapons: records }), [`meshes/${expected.model}`]);
    assert.equal(pickWeaponRecord([...records].reverse(), got.type, 'Daedric', { shape: dfWeaponShape(weapon, WEAPONS) }).id, expected.id);
  });
}
test('model shape: switching same-class, same-metal weapons invalidates the rig', () => {
  for (const names of [['Dagger', 'Tanto', 'Shortsword', 'Wakazashi'], ['Longsword', 'Katana'], ['Claymore', 'Dai_Katana']]) {
    assert.equal(new Set(names.map((n) => fpWeaponKey(weaponOfMaterial(WEAPONS[n], 9), false))).size, names.length);
  }
  assert.equal(fpWeaponKey({ werecreatureClaws: true }, false), fpWeaponKey(null, false));
});
test('model shape: missing mesh, absent equivalent, material, type and enchantment fallbacks remain safe', () => {
  const shape = 'longsword';
  const pool = [
    { id: 'daedric katana', type: 1, model: 'katana.nif', enchanted: false },
    { id: 'daedric longsword', type: 1, model: 'longsword.nif', enchanted: false },
    { id: 'iron longsword', type: 1, model: 'iron.nif', enchanted: false },
    { id: 'a daedric longsword', type: 1, model: 'enchanted.nif', enchanted: true },
  ];
  assert.equal(pickWeaponRecord(pool, 1, 'Daedric', { shape, has: (p) => p !== 'meshes/longsword.nif' }).id, 'daedric katana');
  assert.equal(pickWeaponRecord(pool, 1, 'Iron', { shape }).id, 'iron longsword');
  assert.equal(pickWeaponRecord(pool, 1, 'Daedric', { shape: 'broadsword' }).id, 'daedric katana');
  assert.equal(pickWeaponRecord(pool, 1, 'Daedric', { shape }).id, 'daedric longsword');
  assert.equal(pickWeaponRecord(pool, 9, 'Daedric', { shape }), null);
});
test('model shape: retail records select existing Daedric meshes', { skip: !process.env.MW_DATA_PATH }, () => {
  const retail = weaponRecords(new Uint8Array(readFileSync(join(process.env.MW_DATA_PATH, 'Morrowind.esm'))));
  const bsa = parseBsaIndex(new Uint8Array(readFileSync(join(process.env.MW_DATA_PATH, 'Morrowind.bsa'))));
  const files = new Set(bsa.files.map((f) => f.name));
  const has = (p) => files.has(p.toLowerCase());
  for (const [template, , name] of rows) {
    const weapon = weaponOfMaterial(WEAPONS[template], 9);
    const got = pickWeaponRecord(retail, dfWeaponToMw(weapon, WEAPONS), 'Daedric', { shape: dfWeaponShape(weapon, WEAPONS), has });
    assert.equal(got.id, `daedric ${name}`);
    assert.ok(has(`meshes/${got.model}`));
    assert.deepEqual(weaponPartPaths({ weapon, allWeapons: retail, has }), [`meshes/${got.model}`]);
  }
});
