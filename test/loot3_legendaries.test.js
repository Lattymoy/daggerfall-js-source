// LOOT3 - THIRTY LEGENDARIES (2026-10-01; bible/06-Systems/Loot-Arc.md section 5, Mac: "Do you wanna turn this into an
// arc and do all of the above?" - "More Legendaries. There are 10 today ... About 30 would mean roughly one per weapon
// family and armour slot"). The laws pinned here (LR2's own law over every record is lr1's pin, which reads them all):
//   - THIRTY: ten over twenty more, ids and names unique, no artifact's name.
//   - EVERY PLACE HAS ONE: every weapon family (by the skill that swings it) two or more, and every weapon, every
//     armour place and every kind of jewellery but the wand (which takes the three that name no template) a record
//     that names it.
//   - A HELD SPELL IS A CHEAP ONE: DFU bills a CastWhenHeld's casting cost in condition at the first equip (LR4's watch
//     item 9), so a record's held spell costs a few hundred classic points at most.
//   - NAMED LIKE AN ARTIFACT: the name without a material, the lore last on the card.
//   - THE BROKER AND THE ROOM SEE THEM: the Sigil Broker's base records are the thirty; the Test Room shows each once.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import * as LR from '../src/systems/lootRarity.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { mintCondition } from '../src/systems/itemTemplates.js';
import { GROUP_TEMPLATE_INDICES } from '../src/systems/itemTemplatesData.js';
import { ARTIFACT_SUB_TYPE_NAMES } from '../src/systems/loot.js';
import { weaponSkillUsed } from '../src/characters/weapons.js';
import { enchantmentCost } from '../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES } from '../src/formats/magicDef.js';
import { itemLongName } from '../src/systems/itemInfo.js';
import { brokerStock } from '../src/systems/sigilBroker.js';
import { seedTestLoot } from '../src/systems/testRoom.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const lcg = (seed) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 8) / 0x800000; };
const typeKey = (t) => Object.keys(ENCHANTMENT_TYPES).find((k) => ENCHANTMENT_TYPES[k] === t);
const fits = (t, group) => LR.legendariesFor({ group, templateIndex: t });

test('LOOT3: thirty - ten and twenty more, ids and names their own, never an artifact\'s', () => {
  assert.equal(LR.LEGENDARIES.length, 30);
  const ids = LR.LEGENDARIES.map((l) => l.id), names = LR.LEGENDARIES.map((l) => l.name);
  assert.equal(new Set(ids).size, 30, 'ids unique');
  assert.equal(new Set(names).size, 30, 'names unique');
  assert.equal(new Set(LR.LEGENDARIES.map((l) => l.lore)).size, 30, 'each its own lore');
  const artifacts = ARTIFACT_SUB_TYPE_NAMES.map(([n]) => n.replace(/_/g, ' ').toLowerCase());
  for (const n of names) for (const a of artifacts) if (a !== 'none') assert.ok(!n.toLowerCase().includes(a), `${n} takes no artifact's name (${a})`);
  for (const id of ['wyrmbane', 'nightwhisper', 'graveward', 'stormcaller', 'the-warden', 'titanheart', 'aegis-of-dawn', 'foxglove', 'kings-mark', 'archmages-loop']) {
    assert.ok(LR.legendaryById(id), `the first ten stand: ${id}`);
  }
  const groups = { Weapons: 0, Armor: 0, Jewellery: 0 };
  for (const l of LR.LEGENDARIES) groups[l.group]++;
  assert.deepEqual(groups, { Weapons: 12, Armor: 10, Jewellery: 8 });
});

test('LOOT3: every place has one - each weapon family two or more, every armour place and kind of jewellery one or more', () => {
  const families = new Map();
  for (const t of GROUP_TEMPLATE_INDICES.Weapons.filter((t) => t !== 131)) {   // the arrow is ammunition, never promoted
    const skill = weaponSkillUsed(t);
    const set = families.get(skill) ?? new Set();
    for (const l of fits(t, 'Weapons')) set.add(l.id);
    families.set(skill, set);
  }
  for (const [skill, set] of families) assert.ok(set.size >= 2, `the family that swings by skill ${skill}: ${[...set].join(', ')}`);
  for (const t of GROUP_TEMPLATE_INDICES.Weapons.filter((t) => t !== 131)) {
    assert.ok(fits(t, 'Weapons').some((l) => l.templates?.includes(t)), `weapon template ${t} has a record that names it (a staff its own, a saber its own)`);
  }
  for (const t of GROUP_TEMPLATE_INDICES.Armor) {
    const own = fits(t, 'Armor').filter((l) => l.templates);
    assert.ok(own.length >= 1, `armour template ${t} has a record that names it`);
  }
  for (const t of GROUP_TEMPLATE_INDICES.Jewellery.filter((t) => t !== 140)) {
    assert.ok(fits(t, 'Jewellery').some((l) => l.templates?.includes(t)), `jewellery template ${t} has a record that names it`);
  }
  assert.deepEqual(fits(140, 'Jewellery').map((l) => l.id).sort(), ['archmages-loop', 'foxglove', 'kings-mark'], 'a wand takes the three that name no template');
});

test('LOOT3: a held spell is a cheap one; no record carries an item-maker-only payload', () => {
  for (const rec of LR.LEGENDARIES) {
    const key = typeKey(rec.enchantment.type);
    assert.ok(![ENCHANTMENT_TYPES.FeatherWeight, ENCHANTMENT_TYPES.ExtraWeight].includes(rec.enchantment.type), `${rec.id}: a payload a drop never fires`);
    if (rec.enchantment.type === ENCHANTMENT_TYPES.CastWhenHeld && rec.id !== 'aegis-of-dawn') {   // the first ten's own Spell Resistance, kept as LR2 shipped it
      assert.ok(enchantmentCost(key, rec.enchantment.param) <= 300, `${rec.id}: its held spell bills ${enchantmentCost(key, rec.enchantment.param)} in condition at the first equip`);
    }
  }
});

test('LOOT3: named like an artifact, read whole; the Broker\'s base and the Test Room see the thirty', () => {
  on();
  for (const rec of LR.LEGENDARIES.slice(10)) {
    const t = rec.templates?.[0];
    const base = rec.group === 'Weapons' ? createWeapon(t ?? 120, 3)
      : mintCondition({ group: rec.group, templateIndex: t ?? 135, material: rec.group === 'Armor' ? 0x0200 + 3 : undefined, name: 'X', flags: 0 });
    const it = LR.applyRarity(base, 'legendary', lcg(1), [rec]);
    it.isIdentified = true;
    assert.equal(itemLongName(it), rec.name, `${rec.id}: no material before it`);
    const lines = LR.rarityLines(it);
    assert.equal(lines[0], 'Legendary');
    assert.equal(lines.at(-1), rec.lore, 'its lore last');
    assert.ok(LR.validAffixList(it.affixes));
  }
  // the Broker: its base records are the thirty - over enough days, a new one stands in its stock
  const seen = new Set();
  for (let day = 0; day < 600; day++) for (const o of brokerStock(day)) if (o.item.legendary) seen.add(o.item.legendary);
  assert.ok([...seen].some((id) => LR.LEGENDARIES.slice(10).some((l) => l.id === id)), `a new record in the Broker's stock (${[...seen].join(', ')})`);
  assert.deepEqual(brokerStock(41).map((o) => o.item.name), brokerStock(41).map((o) => o.item.name), 'a day\'s stock is still its day\'s');
  const entity = { isPlayer: true, items: [], stats: {}, skills: new Array(35).fill(30), level: 5, career: {} };
  const added = seedTestLoot(entity, lcg(3));
  const legs = added.filter((i) => i.rarity === 'legendary' && i.isIdentified && !i.exalted).map((i) => i.legendary).sort();
  assert.deepEqual(legs, [...LR.LEGENDARIES, ...LR.WARDROBE_LEGENDARIES].map((l) => l.id).sort(), 'the room shows each once - LOOT15: and the wardrobe\'s six beside the thirty');
  _resetForTests();
});
