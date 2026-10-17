// FIELD BUGS 2026-10-15d MEND-TIERS (Unconquerable, "Repair Regression": "worn items should always repair before
// backpack items. If you wear a Cast When Held ring or Item Deteriorates armor and pick up 20 damaged axes, bows, and
// shoes off dungeon mobs to sell in town, the game decides those 20 pieces of vendor trash are more important than the
// ring on your finger"). MEND-STARVE (2026-10-14) put a worn piece that wears itself on the round the tick mends - Cast
// When Held's degrade, Item Deteriorates - behind every other damaged piece, the pack's included, so the ring wore a
// point a tick while the loot was mended. Mac's call: three tiers - what is worn, then a worn piece that wears itself,
// then the pack - and MEND-WORN's mend order within a tier. Through the round's own payloads (enchantmentMagicRound,
// AllowMagicRepairs on as online forces it), every piece from its producer: the item maker's rows (applyEnchantments
// over enchantmentSettings), the mobs' iron and leather (weaponOfMaterial, armorOfMaterial) at Roleplay & Realism's
// found-loot 20-75% (randomConditionLootItems), put on by equipItem. bible/01-Overview/bugs/Field-Bugs-2026-10-15c.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enchantmentMagicRound, repairsObjectsTarget, repairsObjectsMend } from '../../src/systems/enchantments.js';
import { applyEnchantments } from '../../src/systems/enchanting.js';
import { enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { equipItem } from '../../src/systems/equip.js';
import { armorOfMaterial, weaponOfMaterial } from '../../src/combat/enemyEquipment.js';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { conditionShare, mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { randomConditionLootItems } from '../../src/systems/roleplayRealismItems/rriRealism.js';

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
/** Ticks `from`..`to` (multiples of 4) over two worn pieces that wear themselves, `a` ahead of `b` in the pack: each tick
 *  mends the one with the less share left (a tie the pack's first) by its fiftieth (repairsObjectsMend), never past its
 *  condition, and then each wears its point. FIELD BUGS 2026-10-16b MEND-ARMOUR: the tick's fiftieth, where it was a
 *  point - the order is MEND-TIERS'. */
const eachTickTheMoreWorn = (p, a, b, from, to, ctx = {}) => {
  for (let r = from; r <= to; r += 4) {
    const want = conditionShare(b) < conditionShare(a) ? b : a, other = want === a ? b : a;
    const [w0, o0] = [want.currentCondition, other.currentCondition];
    rounds(p, r - 3, r, ctx);
    assert.deepEqual([want.currentCondition, other.currentCondition], [Math.min(want.maxCondition, w0 + repairsObjectsMend(want)) - 1, o0 - 1],
      `round ${r}: the more worn of the two mended, its point worn after; the other wore its point`);
  }
};

test('MEND-TIERS: the report - a worn Cast When Held ring, or worn Item Deteriorates armour, is held ahead of twenty damaged axes, bows and boots carried to sell; not one of them is mended while it is below its condition (mutant: MEND-STARVE\'s order, the pack ahead of it)', () => {
  for (const [what, piece] of [['the Cast When Held ring', at(heldRing(), 40)], ['the Item Deteriorates helm', at(rottingHelm(), 30)]]) {
    const trash = vendorTrash();
    assert.deepEqual(trash.map((it) => it.currentCondition < it.maxCondition), Array(20).fill(true), 'twenty damaged pieces carried');
    const p = kitted([piece], trash);
    assert.ok(piece.equipSlot != null, `${what} worn`);
    assert.ok(trash.some((it) => conditionShare(it) < conditionShare(piece)), `carried pieces more worn than ${what}`);
    assert.equal(repairsObjectsTarget(p.items, ALLOW), piece, `${what} first all the same`);
    const packed = conditions(trash);
    rounds(p, 1, 400);
    // PIN MOVED (FIELD BUGS 2026-10-16b MEND-ARMOUR): a point mended on each tick it wore one held it where it stood; a
    // fiftieth mended now climbs it to whole, less the point it wears on the tick's round - below its condition still,
    // so the pack still waits
    assert.equal(piece.currentCondition, piece.maxCondition - 1, `${what} held ahead of the pack: mended on each of the 100 ticks it wore a point, to whole less that point`);
    assert.deepEqual(conditions(trash), packed, 'and the pack waits behind it');
  }
});

test('MEND-TIERS: three tiers - a plain worn cuirass, the least worn, is mended first while the ring and the helm wear; then the tick mends the more worn of the two; the pack waits throughout (mutants: the worn tiers swapped, merged, the tier test reversed)', () => {
  const cuirass = at(armorOfMaterial(CUIRASS, IRON_PLATE), 99), helm = at(rottingHelm(), 30), held = at(heldRing(), 60);
  const trash = vendorTrash();
  const p = kitted([held, helm, cuirass], trash);
  assert.ok(conditionShare(helm) < conditionShare(held) && conditionShare(held) < conditionShare(cuirass), 'the helm the most worn of what is worn, the cuirass the least');
  assert.equal(repairsObjectsTarget(p.items, ALLOW), cuirass, 'the plain worn piece first');
  const [h0, r0, c0, packed] = [helm.currentCondition, held.currentCondition, cuirass.currentCondition, conditions(trash)];
  // PIN MOVED (FIELD BUGS 2026-10-16b MEND-ARMOUR): a point a tick, the cuirass's 41 took 41 ticks and then the tick HELD
  // the helm while the ring wore; a fiftieth of the piece's own a tick now - the cuirass whole in one, then the more worn
  // of the two mended each tick (the helm first, until the ring has less share left), the other wearing its point
  const ticks = Math.ceil((cuirass.maxCondition - c0) / repairsObjectsMend(cuirass));
  assert.equal(ticks, 1);
  rounds(p, 1, 4 * ticks);
  assert.equal(cuirass.currentCondition, cuirass.maxCondition, 'the cuirass mended whole, a fiftieth of it a tick');
  assert.deepEqual([helm.currentCondition, held.currentCondition], [h0 - ticks, r0 - ticks], 'the helm and the ring wore their point a tick meanwhile');
  assert.deepEqual(conditions(trash), packed, 'the pack waited');
  rounds(p, 4 * ticks + 1, 4 * ticks + 4);
  assert.deepEqual([helm.currentCondition, held.currentCondition], [h0 - ticks + repairsObjectsMend(helm) - 1, r0 - ticks - 1], 'then the tick mends the more worn of the two, the helm; the ring wears its point');
  eachTickTheMoreWorn(p, held, helm, 4 * ticks + 8, 4 * ticks + 400);
  assert.ok(conditionShare(held) > 0.99 && conditionShare(helm) > 0.99, 'both all but whole');
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
  // PIN MOVED (FIELD BUGS 2026-10-16b MEND-ARMOUR): one mended a point and two wearing one, the pair went a point a tick
  // down; the one mended takes its fiftieth now, so the more worn of the two is mended whole each tick
  eachTickTheMoreWorn(p, held, helm, 64, 460, { inSunlight: () => true });
  assert.deepEqual(conditions(trash), packed, 'from the next tick on the pack waits: a piece that wears on every tick holds every tick (Mac\'s trade-off)');
});
