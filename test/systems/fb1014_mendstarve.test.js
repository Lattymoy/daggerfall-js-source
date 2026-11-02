// FIELD BUGS 2026-10-14 MEND-STARVE (Arbeck on the Discord: "my 'Repair items' enchantment is not repairing anything").
// MEND-WORN's order mends what is worn first, the lowest share first - and a worn piece that wears ITSELF on the very
// round the tick mends (Cast When Held's degrade, CastWhenHeld.cs:27; Item Deteriorates, ItemDeteriorates.cs:29) took
// +1 and -1 on the same round: its share never rose, it stayed first, and it took every tick. Nothing else - worn or
// in the pack - was ever mended again (AllowMagicRepairs is the port's default and forced on online, so the enchanted
// piece is always eligible). Through the round's own payloads. bible/01-Overview/bugs/Field-Bugs-2026-10-14.md.
// MEND-TIERS (FIELD BUGS 2026-10-15d, Mac's call) keeps it behind the rest of what is worn and holds it AHEAD of the
// pack, where this fix had put it last of all - test/systems/fb1015_mendtiers.test.js; the one pin that said "then the pack" moved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, enchantmentMagicRound, repairsObjectsTarget, repairsObjectsMend } from '../../src/systems/enchantments.js';
import { equipItem } from '../../src/systems/equip.js';
import { armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';

const CUIRASS = 102, HELM = 107, BOOTS = 108, RING = 135, IRON_PLATE = 0x0200;
const player = () => ({ isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const at = (item, pct) => { item.currentCondition = Math.round(item.maxCondition * pct / 100); return item; };
const repairsRing = () => Object.assign(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: RING })), { enchantments: [{ type: T.RepairsObjects, param: -1 }] });
const rounds = (p, from, to) => { for (let r = from; r <= to; r++) enchantmentMagicRound(p, r, { ctx: { allowMagicRepairs: true } }); };

test('MEND-STARVE: a worn piece that wears itself as the tick mends is mended after the rest of what is worn - the worn cuirass mends past it, and once nothing else worn wants it the tick mends it (mutant: the self-wearing piece first again)', () => {
  const p = player();
  const rot = at(armorOfMaterial(HELM, IRON_PLATE), 20);
  rot.enchantments = [{ type: T.ItemDeteriorates, param: 0 }];   // all the time
  const cuirass = at(armorOfMaterial(CUIRASS, IRON_PLATE), 99);
  const boots = at(armorOfMaterial(BOOTS, IRON_PLATE), 98);   // carried
  const ring = repairsRing();
  p.items.push(rot, cuirass, ring, boots);
  for (const it of [rot, cuirass, ring]) equipItem(p, it);
  assert.equal(repairsObjectsTarget(p.items, { allowMagicRepairs: true }), cuirass, 'the cuirass first, though the helm is the most worn');
  const [r0, c0, b0] = [rot.currentCondition, cuirass.currentCondition, boots.currentCondition];
  // PIN MOVED (FIELD BUGS 2026-10-16b MEND-ARMOUR): a point a tick, the cuirass's 41 took 41 ticks; a tick mends a fiftieth
  // of the piece's own condition now (repairsObjectsMend - 82 of the cuirass's 4,096), so one
  const cuirassTicks = Math.ceil((cuirass.maxCondition - c0) / repairsObjectsMend(cuirass));
  assert.equal(cuirassTicks, 1);
  rounds(p, 1, 4 * cuirassTicks);
  assert.equal(cuirass.currentCondition, cuirass.maxCondition, 'the worn cuirass mended whole, a fiftieth of it a tick');
  assert.equal(boots.currentCondition, b0, 'the worn first');
  assert.equal(rot.currentCondition, r0 - cuirassTicks, 'the helm wore its point a tick while the cuirass mended');
  // PIN MOVED (MEND-TIERS, FIELD BUGS 2026-10-15d, Mac's call): MEND-STARVE mended the carried boots next, "then the
  // pack", and left the worn helm to wear a point a tick behind them. The worn helm is held ahead of the pack now, and
  // the boots wait (test/systems/fb1015_mendtiers.test.js).
  // PIN MOVED (FIELD BUGS 2026-10-16b MEND-ARMOUR): the tick's point HELD the helm against its own; its fiftieth (51) mends
  // it now, to whole less the point it wears on the tick's own round - still below its condition, so the boots still wait
  const from = rot.currentCondition;
  rounds(p, 4 * cuirassTicks + 1, 4 * cuirassTicks + 4);
  assert.equal(rot.currentCondition, from + repairsObjectsMend(rot) - 1, 'nothing else worn wants the tick: it mends the helm against its own wear');
  rounds(p, 4 * cuirassTicks + 5, 4 * cuirassTicks + 400);
  assert.equal(rot.currentCondition, rot.maxCondition - 1, 'whole, less the point it wears on the tick\'s own round');
  assert.equal(boots.currentCondition, b0, 'and the pack waits behind it');
});

test('MEND-STARVE: Cast When Held is the other self-wearing row - its worn piece is passed for a worn piece less worn, and taken when it is the only one; carried, it wears nothing and keeps its place (mutant: Cast When Held left out)', () => {
  const held = Object.assign(at(armorOfMaterial(HELM, IRON_PLATE), 10), { enchantments: [{ type: T.CastWhenHeld, param: 0 }], equipSlot: 'Head' });
  const cuirass = Object.assign(at(armorOfMaterial(CUIRASS, IRON_PLATE), 90), { equipSlot: 'ChestArmor' });
  assert.equal(repairsObjectsTarget([held, cuirass], { allowMagicRepairs: true }), cuirass);
  assert.equal(repairsObjectsTarget([held], { allowMagicRepairs: true }), held);
  const carried = { ...held, equipSlot: null };
  assert.equal(repairsObjectsTarget([carried, Object.assign(at(armorOfMaterial(BOOTS, IRON_PLATE), 90), {})], { allowMagicRepairs: true }), carried, 'in the pack it wears nothing - the most worn there first');
  const worse = at(armorOfMaterial(BOOTS, IRON_PLATE), 5);
  assert.equal(repairsObjectsTarget([carried, worse], { allowMagicRepairs: true }), worse, 'and the pack\'s order is its place: a carried piece more worn goes ahead of it (MEND-TIERS holds only a WORN one ahead of the pack)');
});
