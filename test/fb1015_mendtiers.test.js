// FIELD BUGS 2026-10-15d MEND-TIERS (Unconquerable, "Repair Regression": "worn items should always repair before
// backpack items. If you wear a Cast When Held ring or Item Deteriorates armor and pick up 20 damaged axes, bows, and
// shoes off dungeon mobs to sell in town, the game decides those 20 pieces of vendor trash are more important than the
// ring on your finger"). MEND-STARVE (2026-10-14) put a worn piece that wears itself on the round the tick mends - Cast
// When Held's degrade, Item Deteriorates - behind every other damaged piece, the pack's included, so the ring wore a
// point a tick while the loot was mended. Mac's call: three tiers - what is worn, then a worn piece that wears itself,
// then the pack - and MEND-WORN's mend order within a tier. Through the round's own payloads (enchantmentMagicRound,
// AllowMagicRepairs on as online forces it), every piece from its producer: the item maker's rows (applyEnchantments
// over enchantmentSettings), the mobs' iron and leather (weaponOfMaterial, armorOfMaterial) at Roleplay & Realism's
// found-loot 20-75% (randomConditionLootItems), put on by equipItem. bible/01-Overview/Field-Bugs-2026-10-15c.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enchantmentMagicRound, repairsObjectsTarget } from '../src/systems/enchantments.js';
import { applyEnchantments } from '../src/systems/enchanting.js';
import { enchantmentSettings } from '../src/systems/enchantmentCatalogue.js';
import { equipItem } from '../src/systems/equip.js';
import { armorOfMaterial, weaponOfMaterial } from '../src/combat/enemyEquipment.js';
import { WEAPONS, WEAPON_MATERIALS } from '../src/characters/weapons.js';
import { conditionShare, mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { randomConditionLootItems } from '../src/systems/rriRealism.js';

const CUIRASS = 102, HELM = 107, BOOTS = 108, RING = 135, IRON_PLATE = 0x0200, LEATHER = 0x0000;
const SLOWFALLING = 37;   // a Cast When Held row's spell (lootRarity.js's flavour list carries it)
const ALLOW = { allowMagicRepairs: true };
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const player = () => ({ isPlayer: true, level: 10, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const at = (item, pct) => { item.currentCondition = Math.round(item.maxCondition * pct / 100); return item; };
const ring = (rows) => applyEnchantments(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: RING })), rows);
/** The item maker's pieces: a ring of Repairs Objects, a ring that casts Slowfalling while held, and a helm of
 *  Strengthens Armor paid for by Item Deteriorates (0 all the time, 1 in sunlight). */
const repairsRing = () => ring([enchantmentSettings('RepairsObjects')]);
const heldRing = () => ring([enchantmentSettings('CastWhenHeld', SLOWFALLING)]);
const rottingHelm = (when = 0) => applyEnchantments(armorOfMaterial(HELM, IRON_PLATE), [enchantmentSettings('StrengthensArmor'), enchantmentSettings('ItemDeteriorates', when)]);
/** Twenty pieces off dungeon mobs to sell in town: seven axes, seven bows and six pairs of boots (the report's shoes - a
 *  mob's footwear is armour; the mod's found-loot roll wears armour, weapons and books), at the mod's 20-75%. */
const vendorTrash = () => randomConditionLootItems([
  ...Array.from({ length: 7 }, (_, i) => weaponOfMaterial([WEAPONS.Battle_Axe, WEAPONS.War_Axe][i % 2], WEAPON_MATERIALS.Iron)),
  ...Array.from({ length: 7 }, (_, i) => weaponOfMaterial([WEAPONS.Short_Bow, WEAPONS.Long_Bow][i % 2], WEAPON_MATERIALS.Iron)),
  ...Array.from({ length: 6 }, () => armorOfMaterial(BOOTS, LEATHER)),
], seeded(7));
/** A player wearing the ring of Repairs Objects (the first ring slot, so its payload runs first in a round) and `worn`,
 *  with `carried` in the pack. */
const kitted = (worn, carried) => {
  const p = player();
  const mender = repairsRing();
  p.items.push(mender, ...worn, ...carried);
  for (const it of [mender, ...worn]) equipItem(p, it);
  return p;
};
const rounds = (p, from, to, ctx = {}) => { for (let r = from; r <= to; r++) enchantmentMagicRound(p, r, { ctx: { ...ALLOW, ...ctx } }); };
const conditions = (items) => items.map((it) => it.currentCondition);

test('MEND-TIERS: the report - a worn Cast When Held ring, or worn Item Deteriorates armour, is held ahead of twenty damaged axes, bows and boots carried to sell; not one of them is mended while it is below its condition (mutant: MEND-STARVE\'s order, the pack ahead of it)', () => {
  for (const [what, piece] of [['the Cast When Held ring', at(heldRing(), 40)], ['the Item Deteriorates helm', at(rottingHelm(), 30)]]) {
    const trash = vendorTrash();
    assert.deepEqual(trash.map((it) => it.currentCondition < it.maxCondition), Array(20).fill(true), 'twenty damaged pieces carried');
    const p = kitted([piece], trash);
    assert.ok(piece.equipSlot != null, `${what} worn`);
    assert.ok(trash.some((it) => conditionShare(it) < conditionShare(piece)), `carried pieces more worn than ${what}`);
    assert.equal(repairsObjectsTarget(p.items, ALLOW), piece, `${what} first all the same`);
    const [held, packed] = [piece.currentCondition, conditions(trash)];
    rounds(p, 1, 400);
    assert.equal(piece.currentCondition, held, `${what} held: a point mended on each of the 100 ticks it wore one, not left to decay`);
    assert.deepEqual(conditions(trash), packed, 'and the pack waits behind it');
  }
});

test('MEND-TIERS: three tiers - a plain worn cuirass, the least worn, is mended first while the ring and the helm wear; then the tick holds the more worn of the two; the pack waits throughout (mutants: the worn tiers swapped, merged, the tier test reversed)', () => {
  const cuirass = at(armorOfMaterial(CUIRASS, IRON_PLATE), 99), helm = at(rottingHelm(), 30), held = at(heldRing(), 60);
  const trash = vendorTrash();
  const p = kitted([held, helm, cuirass], trash);
  assert.ok(conditionShare(helm) < conditionShare(held) && conditionShare(held) < conditionShare(cuirass), 'the helm the most worn of what is worn, the cuirass the least');
  assert.equal(repairsObjectsTarget(p.items, ALLOW), cuirass, 'the plain worn piece first');
  const [h0, r0, c0, packed] = [helm.currentCondition, held.currentCondition, cuirass.currentCondition, conditions(trash)];
  const wants = cuirass.maxCondition - c0;
  rounds(p, 1, 4 * wants);
  assert.equal(cuirass.currentCondition, cuirass.maxCondition, 'the cuirass mended whole, a point a tick');
  assert.deepEqual([helm.currentCondition, held.currentCondition], [h0 - wants, r0 - wants], 'the helm and the ring wore their point a tick meanwhile');
  assert.deepEqual(conditions(trash), packed, 'the pack waited');
  rounds(p, 4 * wants + 1, 4 * wants + 400);
  assert.equal(helm.currentCondition, h0 - wants, 'then the tick holds the more worn of the two, the helm');
  assert.equal(held.currentCondition, r0 - wants - 100, 'one tick for two pieces that wear: the other wears its point');
  assert.deepEqual(conditions(trash), packed, 'and the pack still waits');
});

test('MEND-TIERS: once nothing worn is below its condition the pack is mended, its most worn piece first - resting indoors, where the ring wears a point in sixty rounds and the helm\'s rot is the sun\'s; and the pack waits again from the tick after they wear', () => {
  const cuirass = armorOfMaterial(CUIRASS, IRON_PLATE), helm = rottingHelm(1), held = heldRing();
  const trash = vendorTrash();
  const p = kitted([held, helm, cuirass], trash);
  for (let r = 1; r <= 56; r++) {
    const before = conditions(trash);
    const want = r % 4 === 0 ? trash.reduce((a, b) => (conditionShare(b) < conditionShare(a) ? b : a)) : null;
    rounds(p, r, r, { isResting: () => true, inSunlight: () => false });
    assert.deepEqual(trash.filter((it, i) => it.currentCondition !== before[i]), want ? [want] : [], `round ${r}: the pack's most worn piece on the tick, nothing between`);
  }
  assert.deepEqual([held, helm, cuirass].map((it) => it.currentCondition === it.maxCondition), [true, true, true], 'what is worn stayed whole');
  // up and out in the sun: the ring wears on every tick's round again, and the helm with it
  rounds(p, 57, 60, { inSunlight: () => true });
  const [packed, pair] = [conditions(trash), held.currentCondition + helm.currentCondition];
  assert.ok(pair < held.maxCondition + helm.maxCondition, 'they wore');
  rounds(p, 61, 460, { inSunlight: () => true });
  assert.deepEqual(conditions(trash), packed, 'from the next tick on the pack waits: a piece that wears on every tick holds every tick (Mac\'s trade-off)');
  assert.equal(held.currentCondition + helm.currentCondition, pair - 100, 'two wearing a point a tick, one mended: the pair a point a tick down');
});
