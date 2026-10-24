// MEND-THIRD (2026-10-19, the Discord's #feature-feedback "Bring back loot price based on the condition!" - "actively
// discourage players to repair an item in order to maximalize the sell price - like with repair kits at early levels,
// and enchants at higher" - through Mac: "Do it"), as AUDIT MEND-THIRD left it (Mac: "Only your own mends", "Keep a
// third"). Online a found piece sells at its mark and a third of what its owner's OWN mends - a Repair Kit, Repairs
// Objects, the Varla Stone - put past it (systems/item/foundMark.js); a smith's paid repair adds nothing, at any counter,
// in any region, at any guild's discount. The first build credited a third of every mend, smith's included, and held it
// to a loss at one counter alone: repaired at a cheap smith and sold at a dear counter, or at the Fighters Guild's rank
// discount, it paid again (L1-1, L1-2). Every piece from its producer (weaponOfMaterial, armorOfMaterial), worn by Roleplay
// & Realism: Items' own roll (randomConditionLootItems), mended by the real kit (repairKitUse), the real ring's rounds
// (runMagicRoundsFor) and the real stone (useVarlaStone), priced through the trade window's own walk.
// bible/06-Systems/Economy-Arc.md, MEND-THIRD; bible/01-Overview/audits/Audit-Mend-Third.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tradeCost, getTradePrice, saleConditionPercentage } from '../../src/systems/tradeModes.js';
import { MEND_SALE_SHARE, creditOwnMend } from '../../src/systems/item/foundMark.js';
import { weaponOfMaterial, armorOfMaterial } from '../../src/combat/enemyEquipment.js';
import { randomConditionLootItems } from '../../src/systems/roleplayRealismItems/rriRealism.js';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { mintFieldRepairKit, repairKitUse } from '../../src/systems/smithItems.js';
import { useVarlaStone } from '../../src/systems/ayleidStones.js';
import { ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { equipItem } from '../../src/systems/equip.js';
import { mintCondition, setItemFields } from '../../src/systems/item/itemTemplates.js';
import { reducedRepairCost } from '../../src/systems/guild/guildServices.js';
import { GUILDS } from '../../src/systems/guild/guilds.js';

const CUIRASS = 102, RING = 135;
const at = (v) => () => v;
/** The page online for `fn`, as the room is - and back. */
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
/** The counter's word on a lot, through the trade window's own walk. */
const quote = (mode, item, { quality = 10, priceAdjustment = 1000, skills = { mercantile: 30, personality: 40 }, reducedRepairCost: discount = null } = {}) => {
  const lot = tradeCost(mode, [item], { quality, priceAdjustment, reducedRepairCost: discount });
  return getTradePrice(mode, lot.cost, quality, skills, lot.pieces);
};
/** A piece as Roleplay & Realism: Items hands it over - worn by its roll at `r`, and marked. */
const found = (piece, r) => randomConditionLootItems([piece], at(r))[0];
const player = (items) => ({ isPlayer: true, level: 20, gender: 'male', activeEffects: [], health: 60, maxHealth: 60, items, spells: [], stats: {}, skills: {}, career: { primarySkills: [], majorSkills: [], luck: 50 } });
const repairsRing = () => Object.assign(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: RING })), { enchantments: [{ type: T.RepairsObjects, param: -1 }] });

test('MEND-THIRD: the shape - a kit\'s mend past the mark counts a third, rounded down; a smith\'s whole repair after it adds nothing; wear eats the credit, below the mark the condition alone; no mark and offline the condition alone (mutants: the share whole; nothing credited; the credit fractional; rounded up; the cap on the owner\'s mends)', () => {
  assert.equal(MEND_SALE_SHARE, 1 / 3);
  // a Daedric cuirass off the roll's low end (20%), mended by a field kit's 15%: the 4,916 above the mark counted as its
  // owner's; 6,553 + a third of it is 8,191 of 32,768 - 24%, where a third rounded up (8,192) would read 25
  const plate = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0);
  assert.deepEqual([plate.currentCondition, plate.maxCondition, plate.foundCondition, plate.selfMended], [6553, 32768, 6553, undefined]);
  const pack = [plate, mintFieldRepairKit()];
  repairKitUse(pack[1], pack);
  assert.deepEqual([plate.currentCondition, plate.selfMended], [11469, 4916], 'the kit\'s 15%, all of it its owner\'s');
  online(() => {
    assert.equal(saleConditionPercentage(plate), 24, 'the mark and a third of the kit\'s mend, never rounded up');
    // AUDIT MEND-THIRD L4-6: two points of the owner's credit nothing (19), three a point (20) - a third left fractional
    // read 20 at two
    const two = creditOwnMend({ ...plate, currentCondition: 6555, selfMended: undefined }, 6553);
    assert.deepEqual([two.selfMended, saleConditionPercentage(two)], [2, 19]);
    assert.equal(saleConditionPercentage(creditOwnMend({ ...plate, currentCondition: 6556, selfMended: undefined }, 6553)), 20);
    assert.equal(saleConditionPercentage({ ...plate, currentCondition: plate.maxCondition }), 24, 'a smith\'s whole repair after the kit: nothing more');
    assert.equal(saleConditionPercentage({ ...plate, currentCondition: 9000 }), 22, 'worn back to 9,000: the 2,447 above the mark, a third of it');
    assert.equal(saleConditionPercentage({ ...plate, currentCondition: 3000 }), 9, 'worn below the mark: its own');
    assert.equal(saleConditionPercentage({ ...plate, foundCondition: undefined }), 35, 'no mark: its own');
    // a kit's mend from below the mark counts only the part above it: worn to 3,000, the kit's 4,916 brings it to 7,916,
    // and 1,363 of that is past the mark - whole at a smith after, 6,553 and a third of 1,363 (21), never of 4,916 (24)
    const low = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0);
    low.currentCondition = 3000;
    const lowPack = [low, mintFieldRepairKit()];
    repairKitUse(lowPack[1], lowPack);
    assert.deepEqual([low.currentCondition, low.selfMended], [7916, 1363]);
    assert.equal(saleConditionPercentage({ ...low, currentCondition: low.maxCondition }), 21);
    // the owner's mends are never counted past what the piece holds above its mark
    const high = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0.999);
    for (let i = 0; i < 3; i++) { const was = high.currentCondition; high.currentCondition = high.maxCondition; creditOwnMend(high, was); high.currentCondition = high.foundCondition; }
    assert.equal(high.selfMended, high.maxCondition - high.foundCondition, 'mended whole three times: the room above the mark, once');
  });
  assert.equal(saleConditionPercentage(plate, { online: false }), 35, 'offline: the condition alone, the mod\'s price');
});

test('MEND-THIRD: online a smith\'s whole repair of a found piece adds nothing to the sale - repaired at any counter and region and sold at any other, at every Fighters Guild rank (AUDIT MEND-THIRD L1-1, L1-2: a third of it, credited, paid +10,433 repaired at a quality-1 smith and sold at a quality-20 counter, and +9,383 at rank 9; mutants: the smith\'s mend credited)', () => {
  const fighters = Object.values(GUILDS).find((g) => g?.name === 'FightersGuild');
  assert.ok(fighters, 'the Fighters Guild');
  const pieces = [
    () => armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), () => armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Steel),
    () => weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Daedric), () => weaponOfMaterial(WEAPONS.Claymore, WEAPON_MATERIALS.Dwarven),
  ];
  online(() => {
    let lots = 0;
    for (const make of pieces) {
      for (const r of [0, 0.5, 0.999]) {
        const piece = found(make(), r);
        const whole = { ...piece, currentCondition: piece.maxCondition };   // the smith's: no credit to its owner
        for (const quality of [1, 10, 20]) {
          for (const priceAdjustment of [500, 1000, 1500]) {
            for (const skills of [{ mercantile: 0, personality: 0 }, { mercantile: 30, personality: 40 }, { mercantile: 100, personality: 100 }]) {
              const c = { quality, priceAdjustment, skills };
              assert.equal(quote('Sell', whole, c), quote('Sell', piece, c), `${piece.name} ${piece.material} r${r} q${quality} adj${priceAdjustment} m${skills.mercantile}: whole sells as found`);
              lots++;
            }
          }
        }
      }
    }
    assert.equal(lots, 324);
    // the field's two: a Daedric cuirass found at 20%, Mercantile 100 / Personality 100 - repaired at a quality-1 smith,
    // sold at a quality-20 counter; and at the Fighters Guild's ninth rank at one counter
    const plate = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0);
    const mended = { ...plate, currentCondition: plate.maxCondition };
    const best = { mercantile: 100, personality: 100 };
    assert.equal(quote('Repair', plate, { quality: 1, skills: best }), 11531);
    assert.equal(quote('Sell', mended, { quality: 20, skills: best }) - quote('Sell', plate, { quality: 20, skills: best }), 0, 'cross-counter: the sale gains nothing for 11,531');
    for (let rank = 0; rank <= 9; rank++) {
      const discount = (price) => reducedRepairCost(fighters, { rank }, price);
      const repair = quote('Repair', plate, { reducedRepairCost: discount });
      assert.ok(repair > 0 && quote('Sell', mended) - quote('Sell', plate) === 0, `rank ${rank}: ${repair} gold for nothing on the sale`);
    }
  });
});

test('MEND-THIRD: the thread\'s ways sell again - a field kit on a found Daedric cuirass, a ring of Repairs Objects through an eight-hour rest over six, and the Varla Stone each lift the online sale by a third of what they mended (mutants: nothing credited; the ring\'s or the stone\'s mend uncredited)', () => {
  // the kit: a Daedric cuirass found at 47% (Mercantile 30, Personality 40, a quality-10 counter) - +2,377
  const plate = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0.5);
  assert.deepEqual([plate.value, plate.currentCondition, plate.maxCondition], [153600, 15564, 32768]);
  assert.equal(online(() => quote('Sell', plate)), 22350);
  const pack = [plate, mintFieldRepairKit()];
  assert.equal(repairKitUse(pack[1], pack).text, 'The Daedric Cuirass is mended: 47% to 62%.');
  online(() => {
    assert.equal(quote('Sell', plate), 24727, 'a third of the kit\'s 15%');
    assert.ok(quote('Sell', plate) < quote('Sell', { ...plate, foundCondition: undefined }), 'never the whole 62%');
  });
  // the ring (AUDIT MEND-THIRD L2-3, the faucet as it stands - Mac: "Keep a third"): six Daedric cuirasses found at 47%,
  // carried through an eight-hour rest's 480 rounds - +37,092 on 134,100, where SELL-AS-FOUND gave nothing
  const six = Array.from({ length: 6 }, () => found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0.5));
  const ring = repairsRing();
  const p = player([...six, ring]);
  equipItem(p, ring);
  const before = online(() => six.reduce((s, it) => s + quote('Sell', it), 0));
  assert.equal(before, 134100);
  runMagicRoundsFor(p, 0, 480, { sinks: {} });
  assert.ok(six.every((it) => it.selfMended === it.currentCondition - it.foundCondition), 'every tick its wearer\'s own');
  assert.equal(online(() => six.reduce((s, it) => s + quote('Sell', it), 0)), 171192);
  // the stone (AUDIT MEND-THIRD L2-7): an enchanted Daedric cuirass found at 20%, worn, mended whole - a third of it sells
  const charmed = found(Object.assign(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), { enchantments: [{ type: T.RepairsObjects, param: -1 }] }), 0);
  const wearer = player([charmed]);
  equipItem(wearer, charmed);
  const asFound = online(() => quote('Sell', { ...charmed, equipSlot: undefined }));
  const stone = { templateIndex: -1, stackCount: 1 };
  useVarlaStone(stone, [stone], wearer);
  assert.deepEqual([charmed.currentCondition, charmed.selfMended], [32768, 26215]);
  online(() => {
    assert.equal(saleConditionPercentage(charmed), 46, '6,553 and a third of 26,215');
    assert.deepEqual([asFound, quote('Sell', { ...charmed, equipSlot: undefined })], [9510, 21874]);
  });
});
