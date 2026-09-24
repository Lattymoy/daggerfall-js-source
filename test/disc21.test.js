// DISC21 (2026-09-24, three Discord reports relayed by Mac). bible/01-Overview/Field-Bugs-2026-09-23.md, DISC21.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { applyBiographyEffect } from '../src/systems/biography.js';
import { assignSkillEquipment } from '../src/systems/rriKits.js';
import { repairUnmintedConditions, WEARABLE_GROUPS, isQuestionsDagger } from '../src/systems/conditionRepair.js';
import { isBrokenItem, equipItem } from '../src/systems/equip.js';
import { repairRefusal } from '../src/systems/repairService.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { conditionMultipliersByMaterial, WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = () => ({ isPlayer: true, level: 1, gender: 'male', activeEffects: [], health: 30, maxHealth: 30, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const EBONY_DAGGER_MAX = Math.trunc(templateByIndex(WEAPONS.Dagger).hitPoints * conditionMultipliersByMaterial[WEAPON_MATERIALS.Ebony] / 4);

// ── DISC21-A: "Starting ebony dagger says 'broken and cannot be worn,' repair says it isn't damaged" ──
test('DISC21-A: the questions\' ebony dagger is minted as CreateWeapon mints it, and Roleplay & Realism\'s skill-based kit wears it to 20% of a real condition - worn, not broken; equipped; a repairer takes it (mutants: the biography\'s hand-built record; the kit\'s 20% of nothing)', () => {
  const e = P();
  assert.equal(applyBiographyEffect(e, 'IT 3 0 7', { rolls: () => 0.5 }), 'item');   // Weapons, Dagger, Ebony
  const dagger = e.items.find(isQuestionsDagger);
  assert.ok(dagger, 'the questions gave an ebony dagger');
  assert.ok(EBONY_DAGGER_MAX > 1, `a real condition (${EBONY_DAGGER_MAX})`);
  assert.equal(dagger.maxCondition, EBONY_DAGGER_MAX, 'SetItemPropertiesByMaterial\'s maxCondition');
  assert.equal(dagger.currentCondition, EBONY_DAGGER_MAX, 'whole, as minted');
  assert.ok(dagger.minDamage > 0 && dagger.maxDamage >= dagger.minDamage && dagger.value > 0, 'the rest of CreateWeapon\'s record');
  // the kit's law: "Set condition of ebony dagger if player has one from char creation questions"
  assignSkillEquipment(e, { rolls: () => 0.5, torchesFromItems: false });
  assert.equal(dagger.currentCondition, Math.trunc(EBONY_DAGGER_MAX * 0.2), 'worn to 20%');
  assert.equal(isBrokenItem(dagger), false, 'not "broken and cannot be worn"');
  assert.equal(repairRefusal(dagger), null, 'a repairer takes it - it is damaged');
  assert.notEqual(equipItem(e, dagger), null, 'it goes on');
  // a biography armor piece and a bare record mint too (CreateArmor, `new DaggerfallUnityItem`)
  const a = P();
  applyBiographyEffect(a, 'IT 2 0 1', { rolls: () => 0.5 });   // Armor, steel's plate
  assert.ok(a.items[0].maxCondition > 0 && a.items[0].currentCondition === a.items[0].maxCondition, `armor minted whole (${a.items[0].maxCondition})`);
});

test('DISC21-A: a save made since - the questions\' dagger at 0 with no maxCondition, broken and "not damaged" - is minted on load: the kit\'s 20% on its real condition; an arrow keeps CreateWeapon\'s 0; any other wearable whole; nothing minted is touched, and nothing that is not worn (mutants: no repair on load; the dagger whole or at 0; the arrow whole)', () => {
  const stuck = { group: 'Weapons', templateIndex: WEAPONS.Dagger, material: WEAPON_MATERIALS.Ebony, name: 'Dagger', value: 1, currentCondition: 0 };
  assert.equal(isBrokenItem(stuck), true, 'the report: broken');
  assert.equal(repairRefusal(stuck), 'undamaged', 'the report: "it isn\'t damaged"');
  const p = P();
  p.items.push(stuck,
    { group: 'Weapons', templateIndex: 131, material: 0, name: 'Arrow', value: 2, stackCount: 12, currentCondition: 0 },
    { group: 'Armor', templateIndex: 102, material: 0x0201, name: 'Cuirass', value: 5 },
    { group: 'Weapons', templateIndex: WEAPONS.Longsword, material: 1, name: 'Longsword', value: 5, maxCondition: 300, currentCondition: 120 },
    { group: 'PlantIngredients1', templateIndex: 0, name: 'Twigs', value: 1 });
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: 100 }))));
  const [dagger, arrows, cuirass, sword, twigs] = q.items;
  assert.equal(dagger.maxCondition, EBONY_DAGGER_MAX);
  assert.equal(dagger.currentCondition, Math.trunc(EBONY_DAGGER_MAX * 0.2), 'the kit\'s 20%, on the real condition');
  assert.equal(isBrokenItem(dagger), false, 'it can be worn');
  assert.equal(repairRefusal(dagger), null, 'and repaired');
  assert.equal(arrows.maxCondition, templateByIndex(131).hitPoints, 'the arrow\'s template hitPoints');
  assert.equal(arrows.currentCondition, 0, 'and CreateWeapon\'s 0 - "classic does it"');
  assert.ok(cuirass.maxCondition > 0 && cuirass.currentCondition === cuirass.maxCondition, 'another wearable: whole');
  assert.deepEqual([sword.maxCondition, sword.currentCondition], [300, 120], 'a minted item keeps its wear');
  assert.equal(twigs.maxCondition, undefined, 'nothing worn is touched');
  // idempotent
  assert.equal(repairUnmintedConditions(q.items), 0, 'a second load mints nothing');
  assert.deepEqual(WEARABLE_GROUPS, ['Weapons', 'Armor', 'MensClothing', 'WomensClothing', 'Jewellery']);
  // the load door runs it over the pack, the wagon and the repairer's shelf
  assert.match(rd('src/systems/save.js'), /for \(const list of \[entity\.items, entity\.wagonItems, entity\.otherItems\]\) \{\s+const n = repairUnmintedConditions\(list\);/);
});
