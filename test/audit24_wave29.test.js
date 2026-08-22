// AUDIT 24, wave 29: the twelve-slice sweep's two item/equip highs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  weaponProficiencyFlag, isForbiddenEquip, isBrokenItem, equipItem,
  ITEM_BROKEN_TEXT_ID, FORBIDDEN_EQUIPMENT_TEXT_ID,
} from '../src/systems/equip.js';
import { weaponSkillUsed } from '../src/characters/weapons.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const w = (templateIndex, name) => ({ group: 'Weapons', templateIndex, material: 0, name: name ?? templateByIndex(templateIndex)?.name });

test('audit24 wave29: GetWeaponSkillUsed keys on the TEMPLATE, not the name', () => {
  // DaggerfallUnityItem.cs:910-941 switches on TemplateIndex. The port
  // keyed on item.name, and a name is not the template: the JSON
  // spells 117 "Wakizashi" and 123 "Dai-katana" against the weapon
  // table's Wakazashi / Dai_Katana, and createRegularMagicItem renames
  // an enchanted weapon to its MAGIC.DEF name.
  assert.equal(templateByIndex(117).name, 'Wakizashi', 'the JSON spelling that missed');
  assert.equal(templateByIndex(123).name, 'Dai-katana');

  assert.equal(weaponProficiencyFlag(w(117)), 1, 'ShortBlades');
  assert.equal(weaponProficiencyFlag(w(123)), 2, 'LongBlades');
  assert.equal(weaponProficiencyFlag(w(121, 'Wabbajack')), 2, 'a renamed Katana is still a Katana');
  // and the whole partition still maps
  for (const [t, flag] of [[113, 1], [114, 1], [116, 1], [118, 2], [119, 2], [120, 2],
    [121, 2], [122, 2], [127, 8], [128, 8], [124, 16], [125, 16], [126, 16], [115, 16],
    [129, 32], [130, 32]]) {
    assert.equal(weaponProficiencyFlag(w(t)), flag, `template ${t}`);
  }

  // Skills.None is -1 (DFCareer.cs:450), so DFU's `default:` really
  // does return all-bits-set and an unmatched template is forbidden to
  // any career with any restriction. Kept - but it must be reached
  // only by templates DFU does not name.
  assert.equal(weaponSkillUsed(131), null, 'Arrow is not in the switch');
  assert.equal(weaponProficiencyFlag(w(131)), -1);
  assert.equal(weaponProficiencyFlag({ group: 'Weapons', templateIndex: 999 }), -1);
  const axeBan = { weaponArmorShieldsBitfield: 8, forbiddenMaterialsFlags: 0 };   // Axes
  assert.equal(isForbiddenEquip(axeBan, w(131)), true, 'the -1 quirk, deliberately');
  assert.equal(isForbiddenEquip(axeBan, w(117)), false, 'but a Wakizashi is NOT an axe');
  assert.equal(isForbiddenEquip(axeBan, w(123)), false, 'nor is a Dai-katana');
  assert.equal(isForbiddenEquip(axeBan, w(127)), true, 'a Battle Axe still is');

  // one implementation: equip.js maps weapons.js's template partition
  assert.match(rd('src/systems/equip.js'), /PROFICIENCY_OF_SKILL\[weaponSkillUsed\(item\?\.templateIndex\)\]/);
  assert.doesNotMatch(rd('src/systems/equip.js'), /PROFICIENCY_OF_SKILL\[WEAPON_SKILL\[item\?\.name\]\]/);
});

test('audit24 wave29: a BROKEN item cannot be equipped', () => {
  // DaggerfallInventoryWindow.cs:1330-1341 - `if (item.currentCondition
  // < 1)` pops TEXT.RSC 29 and RETURNS, before the prohibition chain is
  // even reached. The port had no such gate at all.
  assert.equal(ITEM_BROKEN_TEXT_ID, 29);
  assert.notEqual(ITEM_BROKEN_TEXT_ID, FORBIDDEN_EQUIPMENT_TEXT_ID, 'two different records');

  // strictly LESS than one: a condition of exactly 1 still equips
  assert.equal(isBrokenItem({ currentCondition: 0 }), true);
  assert.equal(isBrokenItem({ currentCondition: 0.5 }), true);
  assert.equal(isBrokenItem({ currentCondition: 1 }), false);
  assert.equal(isBrokenItem({ currentCondition: -3 }), true);
  // an item with no condition recorded is not broken - the port mints
  // many without one, and DFU's field defaults to the template's
  assert.equal(isBrokenItem({}), false);
  assert.equal(isBrokenItem(null), false);

  // end to end through equipItem
  const entity = { items: [], equip: null, armorValues: null };
  const sword = { group: 'Weapons', templateIndex: 120, material: 0, currentCondition: 0 };
  entity.items.push(sword);
  assert.equal(equipItem(entity, sword), null, 'refused');
  assert.equal(sword.equipSlot, undefined, 'and never took a slot');

  const sound = { group: 'Weapons', templateIndex: 120, material: 0, currentCondition: 1 };
  entity.items.push(sound);
  assert.notEqual(equipItem(entity, sound), null, 'condition 1 equips');
  assert.notEqual(sound.equipSlot, undefined);

  // the gate runs BEFORE the prohibition chain in the UI too
  const ui = rd('src/ui/nativeInventory.js');
  const fn = ui.slice(ui.indexOf('_refuseForbidden(it) {'), ui.indexOf('/** ShowInfoPopup'));
  assert.ok(fn.indexOf('isBrokenItem(it)') < fn.indexOf('isForbiddenEquip('), 'broken first, as DFU orders it');
  assert.match(fn, /ITEM_BROKEN_TEXT_ID/);
});
