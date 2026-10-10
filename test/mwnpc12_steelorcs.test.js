// MWNPC12 (2026-10-10, the MW-NPC arc's twelfth slice - bible/04-Characters/Morrowind-NPCs.md section 17): THE STEEL
// THAT NEVER SHOWED, AND THE ORCS. Every look that dressed a body in steel without an equip table to read - the street's
// guard (MWNPC7), a knightly order's standing person (MWNPC8a), the rosters' steel classes (MWNPC10b) - wrote its
// material as 1, which names no armour material (systems/armorMaterials.js ARMOR_MATERIAL: steel is 0x0201), so
// formats/mwItemMap.js mwArmorRecords resolved none of it and every one of them stood in their clothes - the ones whose
// boots took their feet barefoot. Now they wear ARMOR_MATERIAL.Steel, and this pins it through mwArmorRecords itself.
// And the orcs, Daggerfall's monsters that are people, stand in Morrowind's Orc body: a foe in its own equip table, a
// road's or a roster's in DFU's own kit for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mwArmorRecords } from '../src/formats/mwItemMap.js';
import { ARMOR_MATERIAL } from '../src/systems/armorMaterials.js';
import { ARMOR_ENUM, WEAPONS_ENUM as W } from '../src/combat/enemyEquipment.js';
import { folkLook } from '../src/characters/folkBodies.js';
import { GUARD_TEXTURE } from '../src/characters/mobilePerson.js';
import { personLook } from '../src/characters/peopleBodies.js';
import { RACES } from '../src/systems/races.js';
import { GENDERS } from '../src/characters/nameHelper.js';
import { SOCIAL_GROUPS, GUILD_GROUPS, FACTION_TYPES } from '../src/formats/factionFile.js';
import { rosterLook, foeActor, isClassFoe, isPersonFoe, isBodyFoe, ORC_MOBILES } from '../src/characters/foeBodies.js';
import { residentLook } from '../src/characters/rosterBodies.js';
import { CREATURE_MATCH } from '../src/characters/creatureBodies.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { EQUIP_SLOTS } from '../src/systems/equip.js';
import { createEquipTable } from '../src/characters/equipTable.js';

/** Morrowind's own armour ids, as a retail archive carries them */
const MW_ARMOUR = ['steel_cuirass', 'steel_greaves', 'steel_boots', 'steel_pauldron_left', 'steel_pauldron_right', 'steel_gauntlet_left', 'steel_gauntlet_right', 'steel_helm',
  'iron_cuirass', 'iron_greaves', 'iron_boots', 'iron_pauldron_left', 'iron_pauldron_right', 'iron_helmet', 'iron_shield',
  'netch_leather_cuirass', 'netch_leather_greaves', 'netch_leather_boots', 'netch_leather_pauldron_left', 'netch_leather_pauldron_right', 'netch_leather_helm', 'netch_leather_shield',
  'chain_mail_cuirass', 'chain_mail_greaves', 'chain_mail_helm', 'steel_shield'].map((id) => ({ id }));
const armour = (look) => look.items.filter((it) => it.group === 'Armor');
const resolved = (it) => mwArmorRecords(MW_ARMOUR, it.templateIndex, it.material);

test('MWNPC12-1 every steel look is worn: the street\'s guard, a knightly order\'s person, a roster\'s steel class and the watch - each piece resolves to Morrowind\'s steel; the 1 they wore named no material at all', () => {
  const guard = folkLook({ archive: GUARD_TEXTURE, gender: GENDERS.Male, personFaceRecordId: 0, nameNPC: 'Gaius' }, 'Breton');
  const knight = personLook({}, { race: RACES.Nord, gender: GENDERS.Male, nameSeed: 77, hash: 5, factionID: 0, billboardArchiveIndex: 182, billboardRecordIndex: 1 },
    { type: FACTION_TYPES.Generic, sgroup: SOCIAL_GROUPS.Commoners, ggroup: GUILD_GROUPS.KnightlyOrder });
  const looks = { guard, knight, warrior: rosterLook({}, { mobileType: M.Warrior, seed: 3 }), watch: rosterLook({}, { mobileType: M.Knight_CityWatch, seed: 3 }) };
  for (const [who, look] of Object.entries(looks)) {
    const plate = armour(look);
    assert.ok(plate.length >= 6, `${who}: in plate`);
    for (const it of plate) {
      const r = resolved(it);
      assert.equal(r.note, 'resolved', `${who}: piece ${it.templateIndex} worn (${r.note})`);
      assert.equal(r.material, 'steel', `${who}: in steel`);
    }
  }
  assert.match(mwArmorRecords(MW_ARMOUR, ARMOR_ENUM.Cuirass, 1).note, /no MW material for 1/, 'the 1 they wore: nothing');
});

const foe = ({ mobileType, slots = {}, isClass = mobileType >= 128 }) => {
  const equip = createEquipTable();
  for (const [k, v] of Object.entries(slots)) equip.slots[EQUIP_SLOTS[k]] = v;
  return { mobileType, marker: [3, 0, 7], gender: 'male', entity: { isClass, race: undefined, equip, items: [] }, ai: { feet: [1, 2, 3], yaw: 0, moving: false, giveUpTimer: 0 } };
};

test('MWNPC12-2 an orc foe is a person: not a class, not a creature - Morrowind\'s Orc, in the blade and the armour its own equip table holds, its clothes under; a class foe still the Bay\'s; a rat still its creature', () => {
  assert.deepEqual([...ORC_MOBILES].sort((a, b) => a - b), [M.Orc, M.OrcSergeant, M.OrcShaman, M.OrcWarlord].sort((a, b) => a - b));
  const blade = { templateIndex: W.Longsword, group: 'Weapons', material: 0 }, helm = { templateIndex: ARMOR_ENUM.Helm, group: 'Armor', material: ARMOR_MATERIAL.Iron };
  for (const t of ORC_MOBILES) {
    const o = foe({ mobileType: t, slots: { RightHand: blade, Head: helm } });
    assert.deepEqual([isClassFoe(o), isPersonFoe(o), isBodyFoe(o)], [false, true, true], `${t}`);
    const look = foeActor(o).look;
    assert.equal(look.race, 'Orc', 'Morrowind\'s Orc');
    assert.ok(look.items.some((it) => it.templateIndex === W.Longsword) && look.items.some((it) => it.templateIndex === ARMOR_ENUM.Helm), 'what its table holds');
    assert.ok(look.items.some((it) => it.equipSlot === EQUIP_SLOTS.ChestClothes), 'its clothes under');
    assert.ok(CREATURE_MATCH[t].miss, 'never a creature');
  }
  assert.notEqual(foeActor(foe({ mobileType: M.Thief })).look.race, 'Orc', 'a class foe the Bay\'s');
  assert.deepEqual(foeActor(foe({ mobileType: M.Rat })).look, { creature: ['rat'] });
  assert.equal(isPersonFoe(foe({ mobileType: M.Rat })), false);
});

test('MWNPC12-3 an orc with no table to read (a road\'s, a roster\'s) wears DFU\'s own kit for it: the orc and its shaman a one-hander and half the time a shield, half their armour; the sergeant and the warlord a two-hander, three pieces in four and nine in ten; the armour leather, chain or plate by DFU\'s odds - and a caravan beset by orcs is beset by Orcs', () => {
  const one = [W.Broadsword, W.Saber, W.Longsword], two = [W.Claymore, W['Dai-Katana'], W.Mace, W.Flail, W.Warhammer, W['Battle Axe']];
  const odds = { [M.Orc]: 0.5, [M.OrcShaman]: 0.5, [M.OrcSergeant]: 0.75, [M.OrcWarlord]: 0.9 };
  const mats = new Map();
  for (const t of ORC_MOBILES) {
    let pieces = 0, shields = 0;
    const N = 300;
    for (let s = 0; s < N; s++) {
      const l = rosterLook({}, { mobileType: t, seed: s });
      assert.equal(l.race, 'Orc');
      const w = l.items.filter((it) => it.group === 'Weapons');
      assert.equal(w.length, 1);
      assert.ok((odds[t] === 0.5 ? one : two).includes(w[0].templateIndex), `${t}: its variant's blade (${w[0].templateIndex})`);
      const a = armour(l);
      const sh = a.filter((it) => it.equipSlot === EQUIP_SLOTS.LeftHand);
      shields += sh.length;
      assert.ok(sh.every((it) => it.templateIndex >= ARMOR_ENUM.Buckler && it.templateIndex <= ARMOR_ENUM.Round_Shield), 'a buckler or a round shield');
      pieces += a.length - sh.length;
      for (const it of a) mats.set(it.material, (mats.get(it.material) ?? 0) + 1);
    }
    const share = pieces / (N * 6);
    assert.ok(Math.abs(share - odds[t]) < 0.08, `${t}: each piece at ${odds[t]} (${share.toFixed(2)})`);
    if (odds[t] === 0.5) assert.ok(Math.abs(shields / N - 0.5) < 0.1, `${t}: a shield half the time (${shields / N})`);
    else assert.equal(shields, 0, `${t}: two hands on the blade`);
  }
  const total = [...mats.values()].reduce((a, b) => a + b, 0);
  const of = (m) => (mats.get(m) ?? 0) / total;
  assert.ok(Math.abs(of(ARMOR_MATERIAL.Leather) - 0.69) < 0.06, `leather below 70 (${of(ARMOR_MATERIAL.Leather).toFixed(2)})`);
  assert.ok(Math.abs(of(ARMOR_MATERIAL.Chain) - 0.2) < 0.05, `chain to 89 (${of(ARMOR_MATERIAL.Chain).toFixed(2)})`);
  assert.ok(of(ARMOR_MATERIAL.Iron) > 0.02 && of(ARMOR_MATERIAL.Steel) > 0.02 && [...mats.keys()].every((m) => [ARMOR_MATERIAL.Leather, ARMOR_MATERIAL.Chain, ARMOR_MATERIAL.Iron, ARMOR_MATERIAL.Steel].includes(m)), 'plate iron or steel, nothing else');
  const beset = residentLook({}, { id: 'enc:0', cls: M.Orc, sex: 'male', name: '' });
  assert.equal(beset?.race, 'Orc', 'the road\'s orcs in their bodies');
  assert.ok(armour(rosterLook({}, { mobileType: M.OrcWarlord, seed: 1 })).every((it) => it.material !== 1), 'never the 1 that named nothing');
});
