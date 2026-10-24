// FIELD BUGS 2026-10-16b MEND-ARMOUR (the Discord: "items not repairing at all with 'repairs objects'" ... "my weapon WILL
// repair but no other worn items are repairing with repair objects"). MEND-WORN (2026-10-07) gave Repairs Objects' tick
// the classic Dagger's share - its point of its 50 - on a weapon on WEAPON-POOL's pool alone (32 of an iron weapon's
// 1,600), and left every other piece DFU's point (RepairsObjects.cs:26): a steel cuirass's 6,144 a point a tick, its %
// on the doll still for an hour of play while the blade's climbed. The owner, 2026-10-16: "Stop trying to match DFU."
// Now ONE LAW: a tick mends a fiftieth of the piece's own condition (repairsObjectsMend), never under DFU's point - a
// weapon, armour of any material, clothing, uses alike - so every worn piece's share climbs 2% a tick. Which piece the
// tick takes is MEND-WORN's and MEND-TIERS' (repairsObjectsTarget), unchanged. Every piece from its producer
// (weaponOfMaterial, armorOfMaterial, the template's mint), put on by equipItem, the rounds the pump's
// (runMagicRoundsFor). bible/01-Overview/bugs/Field-Bugs-2026-10-16b.md MEND-ARMOUR.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ENCHANTMENT_TYPES as T, enchantmentMagicRound, repairsObjectsTarget } from '../../src/systems/enchantments.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { equipItem } from '../../src/systems/equip.js';
import { weaponOfMaterial, armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { mintCondition, setItemFields, conditionPercentage } from '../../src/systems/item/itemTemplates.js';
import { createRegularMagicItem } from '../../src/systems/loot/loot.js';

const CUIRASS = 102, GAUNTLETS = 103, GREAVES = 104, LEFT_PAULDRON = 105, RIGHT_PAULDRON = 106, HELM = 107, BOOTS = 108;
const KITE_SHIELD = 111, RING = 135, ARMBANDS = 142, CASUAL_PANTS = 151, SHORT_SHIRT = 165;
const player = () => ({ isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const at = (item, pct) => { item.currentCondition = Math.round(item.maxCondition * pct / 100); return item; };
/** The law, said here so the pins do not read it back from the module: a fiftieth of the piece's own condition, rounded,
 *  never under DFU's point. */
const fiftieth = (it) => Math.max(1, Math.round(it.maxCondition / 50));
const clothes = (templateIndex) => mintCondition(setItemFields({ group: 'MensClothing', templateIndex }));
/** A ring of Repairs Objects, as the item maker and a Rare's flavour store it. */
const repairsRing = () => Object.assign(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: RING })), { enchantments: [{ type: T.RepairsObjects, param: -1 }] });
const wearing = (pieces) => {
  const p = player();
  const ring = repairsRing();
  p.items.push(...pieces, ring);
  for (const it of [...pieces, ring]) equipItem(p, it);
  return p;
};

test('MEND-ARMOUR: the report - a steel blade at 50% and a suit of steel plate at 70% with clothes under it, the ring worn: through the pump each tick mends the worn piece with the least share left by a fiftieth of its own condition, so the armour\'s % climbs as the blade\'s does and the whole kit is whole in 164 ticks (it was a point a tick: 8,408) (mutants: armour keeps the point, the pool for every piece, the template not the piece)', () => {
  const blade = at(weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Steel), 50);
  const plate = [CUIRASS, GAUNTLETS, GREAVES, LEFT_PAULDRON, RIGHT_PAULDRON, HELM, BOOTS].map((t) => at(armorOfMaterial(t, ARMOR_MATERIAL.Steel), 70));
  const worn = [blade, ...plate, at(clothes(SHORT_SHIRT), 70), at(clothes(CASUAL_PANTS), 70)];
  const p = wearing(worn);
  assert.ok(worn.every((it) => it.equipSlot != null), 'every piece put on');
  assert.deepEqual(worn.map((it) => [it.name, it.maxCondition]), [['Longsword', 2400], ['Cuirass', 6144], ['Gauntlets', 3072], ['Greaves', 4608],
    ['Left Pauldron', 3072], ['Right Pauldron', 3072], ['Helm', 3840], ['Boots', 3840], ['Short Shirt', 100], ['Casual Pants', 150]], 'the producers\' own sizes - steel plate on its x1.5');
  const ticks = worn.reduce((n, it) => n + Math.ceil((it.maxCondition - it.currentCondition) / fiftieth(it)), 0);
  assert.equal(ticks, 164, 'about 55 real minutes at a tick every twenty seconds');
  assert.equal(worn.reduce((n, it) => n + (it === blade ? Math.ceil((it.maxCondition - it.currentCondition) / 32) : it.maxCondition - it.currentCondition), 0), 8408,
    'MEND-WORN\'s law: the blade 32 a tick and every other piece a point - 8,408 ticks, about 47 real hours');
  for (let tick = 1; tick <= ticks; tick++) {
    const want = repairsObjectsTarget(p.items);
    const before = new Map(worn.map((it) => [it, it.currentCondition]));
    assert.equal(runMagicRoundsFor(p, 4 * (tick - 1), 4 * tick, { sinks: {} }), 4);
    const moved = worn.filter((it) => it.currentCondition !== before.get(it));
    assert.deepEqual(moved.map((it) => it.name), [want.name], `tick ${tick}: one piece, the worn one with the least share left`);
    assert.equal(want.currentCondition - before.get(want), Math.min(fiftieth(want), want.maxCondition - before.get(want)), `tick ${tick}: ${want.name} a fiftieth of its own`);
    if (tick === 60) {
      assert.deepEqual(worn.map((it) => conditionPercentage(it)), [80, 80, 79, 79, 79, 79, 80, 80, 80, 80],
        'twenty real minutes in: the blade came up to the armour\'s 70% and every piece has climbed with it since (MEND-WORN\'s law: the blade and the shirt 71%, every other piece 70% - and so after the hour)');
    }
  }
  assert.deepEqual(worn.map((it) => it.currentCondition === it.maxCondition), Array(worn.length).fill(true), 'the whole kit whole on the 164th tick');
});

test('MEND-ARMOUR: one law for every kind and material - a tick mends a fiftieth of the piece\'s own condition, rounded, so each share climbs 2% a tick: a weapon iron or Daedric, plate of steel, ebony and Daedric, chain, leather, clothes; and never under DFU\'s point, the Armbands\' 15 (mutants: no floor, rounded down, another share)', () => {
  const gain = (piece) => {
    const p = wearing([at(piece, 40)]);
    const from = piece.currentCondition;
    enchantmentMagicRound(p, 4, { ctx: {} });
    return [piece.name, piece.maxCondition, piece.currentCondition - from];
  };
  assert.deepEqual([
    gain(weaponOfMaterial(WEAPONS.Dagger, WEAPON_MATERIALS.Iron)),
    gain(weaponOfMaterial(WEAPONS.Warhammer, WEAPON_MATERIALS.Daedric)),
    gain(armorOfMaterial(HELM, ARMOR_MATERIAL.Steel)),
    gain(armorOfMaterial(KITE_SHIELD, ARMOR_MATERIAL.Ebony)),
    gain(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric)),
    gain(armorOfMaterial(GREAVES, ARMOR_MATERIAL.Chain)),
    gain(armorOfMaterial(BOOTS, ARMOR_MATERIAL.Leather)),
    gain(clothes(SHORT_SHIRT)),
    gain(clothes(ARMBANDS)),
  ], [
    ['Dagger', 1600, 32],         // MEND-WORN's 32: the classic Dagger's point of its 50, as it was
    ['Warhammer', 12800, 256],    // was 32 (0.25%)
    ['Helm', 3840, 77],           // 76.8 - was a point
    ['Kite Shield', 12288, 246],
    ['Cuirass', 32768, 655],      // a point was 1% every 328 ticks
    ['Greaves', 3072, 61],
    ['Boots', 2560, 51],
    ['Short Shirt', 100, 2],
    ['Armbands', 15, 1],          // 0.3: DFU's point, the floor
  ]);
  for (const [name, max, got] of [gain(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Iron)), gain(weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Steel))]) {
    assert.ok(Math.abs(got / max - 1 / 50) <= 0.5 / max, `${name}: 2% a tick, to the point`);
  }
});

test('MEND-ARMOUR AUDIT: a charge is not wear - a MAGIC.DEF piece\'s spent uses come back DFU\'s point a tick through the pump, a rest\'s catch-up included (an 8-hour rest: 120 uses, 12 Cast When Used casts - the fiftieth gave all 1,000), while the steel cuirass worn beside it still mends its fiftieth (mutants: uses on the share)', () => {
  const seeded = (s0) => { let s = s0; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
  const magicDef = [{ index: 0, name: 'Amulet of the Test', type: 0, group: 2, groupIndex: 0, enchantments: [{ type: T.CastWhenUsed, param: 14 }], uses: 1000, value: 0, material: 0 }];
  const charged = createRegularMagicItem(magicDef, 1, 'male', seeded(2));
  assert.deepEqual([charged.magic, charged.maxCondition], [true, 1000], 'the producer\'s piece: its condition its uses');
  charged.currentCondition = 0;
  const p = wearing([charged]);
  runMagicRoundsFor(p, 0, 4, { sinks: {}, enchantCtx: { allowMagicRepairs: true } });
  assert.equal(charged.currentCondition, 1, 'a tick: the point');
  runMagicRoundsFor(p, 4, 480, { sinks: {}, enchantCtx: { allowMagicRepairs: true } });
  assert.equal(charged.currentCondition, 120, 'an 8-hour rest: 120 uses, never the whole 1,000');
  const cuirass = at(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Steel), 50);
  const from = cuirass.currentCondition;
  const q = wearing([cuirass]);
  runMagicRoundsFor(q, 0, 4, { sinks: {}, enchantCtx: { allowMagicRepairs: true } });
  assert.equal(cuirass.currentCondition - from, fiftieth(cuirass), 'armour beside it: its fiftieth');
});
