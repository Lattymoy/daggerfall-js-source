// FIELD BUGS 2026-10-15c - MW-AXES, the Discord's "Morrowind Axes Registered Wrong Due to Reversed Naming Convention":
// "I couldn't equip a torch while seemingly using a one-handed axe, but I could while seemingly using a two-handed axe
// ... In Daggerfall, it's actually the one-handed axes that're called battle-axes, & the two-handed ones that're called
// waraxes". Daggerfall's hands are right (DFU's ItemTemplates: Battle Axe 'Either', War Axe 'Both'); the Morrowind art
// was crossed - DF_TO_MW_WEAPON matched the names, so a War Axe drew Morrowind's one-handed war axe with its clips and a
// Battle Axe the two-handed battle axe. `01-Overview/bugs/Field-Bugs-2026-10-15c.md`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DF_TO_MW_WEAPON, MW_WEAPON_TYPE, MW_TWO_HANDED, weaponFlags, dfWeaponShape, dfWeaponToMw, pickWeaponRecord } from '../../src/formats/morrowind/mwFirstPerson.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { WEAPON_HANDS } from '../../src/characters/equipRules.js';
import { weaponOfMaterial } from '../../src/combat/enemyEquipment.js';

test('MW-AXES: every Daggerfall weapon draws a Morrowind type holding the hands the weapon has - a Battle Axe (one-handed) Morrowind\'s war axe, a War Axe (two-handed) its battle axe; the Flail the one declared fudge (mutants: either axe row crossed back; the shapes uncrossed)', () => {
  const crossed = Object.entries(DF_TO_MW_WEAPON)
    .filter(([name, type]) => ((weaponFlags(type) & MW_TWO_HANDED) !== 0) !== (WEAPON_HANDS[WEAPONS[name]] === 'Both'))
    .map(([name]) => name);
  assert.deepEqual(crossed, ['Flail'], 'Morrowind has no flail: its two-handed Flail stands on BluntOneHand, the table\'s one fudge');
  assert.deepEqual([WEAPON_HANDS[WEAPONS.Battle_Axe], WEAPON_HANDS[WEAPONS.War_Axe]], ['Either', 'Both'], 'Daggerfall\'s rule, kept');
  assert.deepEqual([DF_TO_MW_WEAPON.Battle_Axe, DF_TO_MW_WEAPON.War_Axe], [MW_WEAPON_TYPE.AxeOneHand, MW_WEAPON_TYPE.AxeTwoHand]);
  // the shape tie-break crosses with them, so a Steel Battle Axe finds Morrowind's steel war axe, never its plain axe
  const battle = weaponOfMaterial(WEAPONS.Battle_Axe, 1), war = weaponOfMaterial(WEAPONS.War_Axe, 1);
  assert.deepEqual([dfWeaponShape(battle, WEAPONS), dfWeaponShape(war, WEAPONS)], ['waraxe', 'battleaxe']);
  const pool = [
    { id: 'steel axe', type: MW_WEAPON_TYPE.AxeOneHand, model: 'w/axe.nif', enchanted: false },
    { id: 'steel war axe', type: MW_WEAPON_TYPE.AxeOneHand, model: 'w/waraxe.nif', enchanted: false },
    { id: 'steel battle axe', type: MW_WEAPON_TYPE.AxeTwoHand, model: 'w/battleaxe.nif', enchanted: false },
  ];
  const drawn = (w) => pickWeaponRecord(pool, dfWeaponToMw(w, WEAPONS), 'Steel', { shape: dfWeaponShape(w, WEAPONS) })?.id;
  assert.deepEqual([drawn(battle), drawn(war)], ['steel war axe', 'steel battle axe']);
});
