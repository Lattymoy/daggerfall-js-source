// AUDIT MEND-THIRD (2026-10-19, Mac: "Audit this"; bible/01-Overview/audits/Audit-Mend-Third.md): what the four cold
// lanes found of the found-condition law beyond the sale's own arithmetic (mend_third.test.js) - each pinned on the code
// as fixed, red on the code it replaced. L3-1: an enchanted found piece fenced whole online. L3-2: PARTY-LOOT's personal
// bonus and a foe's worn kit handed pieces over worn and unmarked. L3-3 / L1-5: a found book's stack merge and split
// handed it over whole. L3-4: There's a Hole in the Bottom of the Ocean's re-mint left a stale mark. L1-6 / L2-6 / L3-5:
// a temper moved the maximum and left the mark. L3-6: a new character's worn kit, and the questions' dagger, unmarked.
// L1-4: a patron read no condition at all. Every piece from its producer.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tradeCost, getTradePrice, saleConditionPercentage } from '../../src/systems/tradeModes.js';
import { weaponOfMaterial, armorOfMaterial, createWeapon } from '../../src/combat/enemyEquipment.js';
import { randomConditionLootItems } from '../../src/systems/roleplayRealismItems/rriRealism.js';
import { WEAPONS, WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { isEnchanted, addItem, splitStack } from '../../src/systems/inventory.js';
import { sideEffectTypes, enchantmentParamValues, enchantmentSettings } from '../../src/systems/enchantmentCatalogue.js';
import { enchantDecision, applyEnchantments } from '../../src/systems/enchanting.js';
import { installRoleplayRealismItems } from '../../src/systems/roleplayRealismItems/rriInstall.js';
import { spawnEnemyLoot, rollRoomBonus } from '../../src/scenes/hostCombat.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { seededRolls, roomRoller, ROOM_BASE_QUARTERS, ROOM_BASE_LUCK, ROOM_BASE_FIND } from '../../src/systems/roomLoot.js';
import { asTheRoom } from '../../src/systems/online/onlineLane.js';
import { createRandomBook, setBookPrice } from '../../src/systems/books.js';
import { upgradeLoot } from '../../src/world/oceanHoles.js';
import { temperItem } from '../../src/systems/smithItems.js';
import { pieceQuality, temperRefusal } from '../../src/net/temperLaw.js';
import { repoolWeaponConditions, repairUnmintedConditions } from '../../src/systems/conditionRepair.js';
import { creditOwnMend } from '../../src/systems/item/foundMark.js';
import { assignSkillEquipment } from '../../src/systems/roleplayRealismItems/rriKits.js';
import { patronWorth, patronCap } from '../../src/net/patronLaw.js';
import { itemWorth } from '../../src/systems/item/itemLaw.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';

const CUIRASS = 102;
const at = (v) => () => v;
function online(fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: '?online' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const quote = (mode, item, { quality = 10, priceAdjustment = 1000, skills = { mercantile: 30, personality: 40 } } = {}) => {
  const lot = tradeCost(mode, [item], { quality, priceAdjustment });
  return getTradePrice(mode, lot.cost, quality, skills, lot.pieces);
};
const found = (piece, r) => randomConditionLootItems([piece], at(r))[0];
const worn = (it) => it && (it.group === 'Weapons' || it.group === 'Armor' || it.group === 'Books') && it.name !== 'Arrow' && (it.maxCondition ?? 0) > 0 && (it.currentCondition ?? 0) < it.maxCondition;

test('AUDIT MEND-THIRD L3-1: online a found piece fences as it sells - enchanted at the item maker for one side effect at no gold, a Daedric cuirass found at 47% fenced, unmended, at its whole 47,553 where it sold for 22,350; offline, and an unmarked piece, fence as DFU\'s (mutants: the fence reads no mark; reads it offline)', () => {
  const plate = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0.5);
  const side = sideEffectTypes().flatMap((t) => enchantmentParamValues(t).map((p) => enchantmentSettings(t, p))).filter(Boolean)
    .find((se) => { const d = enchantDecision(structuredClone(plate), [], [se], { gold: 0 }); return d.kind === 'enchant' && d.goldCost === 0; });
  assert.ok(side, 'a side effect the item maker takes for no gold');
  applyEnchantments(plate, [side]);
  assert.ok(isEnchanted(plate) && plate.foundCondition === 15564 && plate.currentCondition === 15564);
  online(() => {
    assert.equal(quote('SellMagic', plate), quote('Sell', plate), 'fenced as it sells');
    assert.equal(quote('SellMagic', plate), 22350);
    assert.equal(quote('SellMagic', { ...plate, foundCondition: undefined }), 47553, 'unmarked: DFU\'s whole fence');
  });
  assert.equal(quote('SellMagic', plate), quote('SellMagic', { ...plate, foundCondition: undefined }), 'offline: the mark unread');
  assert.equal(quote('SellMagic', plate), 134400, 'offline: DFU\'s whole fence, its haggle uncapped');
});

test('AUDIT MEND-THIRD L3-2: a foe\'s worn kit is marked as it is worn - PLAIN-LOOT\'s rejects, and PARTY-LOOT\'s personal bonus cloned from them, hand nothing over worn and unmarked over 1,600 class bodies (it was 133 rejects and 43 bonus pieces of 3,200; mutant: the kit\'s mark dropped)', () => {
  installRoleplayRealismItems({ fetchBytes: async () => new Uint8Array() });
  online(() => {
    const player = { level: 20, gender: 'male', characterId: 'c1', stats: { luck: 50 }, activeEffects: [], items: [], isPlayer: true };
    let rejects = 0, bonus = 0, wornPieces = 0, unmarked = 0;
    for (const mob of [141, 142, 143, 144]) {
      for (let n = 0; n < 400; n++) {
        const name = `room|corpse:${n}#${mob}`;
        const rolls = seededRolls(name);
        const out = [];
        const e = makeEnemyEntity(mob, ENEMY_BASICS[mob], { hitPointsPerLevel: 8, name: 'x' }, 20, rolls);
        e.items = []; e.equip = undefined;
        asTheRoom(() => spawnEnemyLoot(e, mob, ENEMY_BASICS[mob], roomRoller(20, 'male'), { where: 'dungeon', rolls, quarters: ROOM_BASE_QUARTERS, luck: ROOM_BASE_LUCK, find: ROOM_BASE_FIND, rejects: out }));
        const pieces = rollRoomBonus({ rolls: seededRolls(`${name}|c1`), player, rejects: out, basics: ENEMY_BASICS[mob], mobileType: mob, level: 20, lootCap: Number.isInteger(e.lootCap) ? e.lootCap : null, baseItems: e.items });
        rejects += out.length; bonus += pieces.length;
        for (const it of [...e.items, ...out, ...pieces]) if (worn(it)) { wornPieces++; if (!Number.isInteger(it.foundCondition)) unmarked++; }
      }
    }
    assert.ok(rejects > 500 && bonus > 200 && wornPieces > 2000, `${rejects} rejects, ${bonus} bonus pieces, ${wornPieces} worn`);
    assert.equal(unmarked, 0, 'every worn piece marked');
  });
});

test('AUDIT MEND-THIRD L3-3, L1-5: a found book stacks only with its like and a split keeps its condition and mark - a worn copy merged into a whole one, or split off two found ones, was handed over whole (mutants: found stacks merge; the split mints whole; arrows held apart)', () => {
  setBookPrice(7, 800);
  const book = () => createRandomBook(() => 0.5, () => 7);
  const whole = book();
  const a = found(book(), 0), b = found(book(), 0);
  assert.ok(worn(a) && a.foundCondition === a.currentCondition);
  const pack = [whole];
  addItem(pack, a);
  assert.equal(pack.length, 2, 'a worn found copy is its own row beside a whole one');
  addItem(pack, b);
  assert.deepEqual([pack.length, pack[1].stackCount], [2, 2], 'two found at the same mark stack');
  const picked = splitStack(pack, pack[1], 1);
  assert.deepEqual([picked.currentCondition, picked.maxCondition, picked.foundCondition], [a.currentCondition, a.maxCondition, a.foundCondition], 'the split part as it was found');
  online(() => assert.equal(quote('Sell', picked), quote('Sell', { ...a, stackCount: 1 })));
  const mended = creditOwnMend({ ...a, currentCondition: a.maxCondition }, a.currentCondition);
  addItem(pack, mended);
  assert.equal(pack.length, 4, 'a copy its owner mended stacks with none of the others');
  // arrows: the roll wears and marks them too, but no mend reaches one - a quiver takes every arrow found
  const quiver = [createWeapon(WEAPONS.Arrow, 0, at(0.5))];
  for (const r of [0, 0.5, 0.999]) addItem(quiver, found(createWeapon(WEAPONS.Arrow, 0, at(0.5)), r));
  assert.equal(quiver.length, 1, 'found arrows at three marks, one quiver');
});

test('AUDIT MEND-THIRD L3-4: There\'s a Hole in the Bottom of the Ocean\'s re-mint is handed over whole and unmarked - an Ebony longsword marked at 31% sold as a whole Orcish one at 51% online; an enchanted piece keeps its condition and its mark (mutant: the stale mark kept)', () => {
  const mint = { remintWeapon: (ti, m) => weaponOfMaterial(ti, m), remintArmor: (ti, m, v) => armorOfMaterial(ti, m, v), isEnchanted };
  const blade = found(weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Ebony), 0.2);
  upgradeLoot([blade], mint);
  assert.deepEqual([blade.material, blade.currentCondition, blade.maxCondition, blade.foundCondition], [WEAPON_MATERIALS.Orcish, 11200, 11200, undefined]);
  assert.equal(saleConditionPercentage(blade, { online: true }), 100);
  const charmed = found(Object.assign(weaponOfMaterial(WEAPONS.Longsword, WEAPON_MATERIALS.Ebony), { enchantments: [{ type: 1, param: 0 }] }), 0.2);
  const [cur, max, mark] = [charmed.currentCondition, charmed.maxCondition, charmed.foundCondition];
  upgradeLoot([charmed], mint);
  assert.deepEqual([charmed.currentCondition, charmed.maxCondition, charmed.foundCondition], [cur, max, mark]);
});

test('AUDIT MEND-THIRD L1-6, L2-6, L3-5: a temper moves a found piece\'s mark and its owner\'s mends by the same share as its maximum - a Daedric cuirass found at 47% sold at 43% for the gold its temper cost; WEAPON-POOL\'s repool moves the owner\'s mends with the mark (mutants: the mark left at its number; the owner\'s mends left)', () => {
  const plate = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0.5);
  assert.equal(temperRefusal(plate), null);
  assert.ok(temperItem(plate, { quality: pieceQuality(plate) + 1 }));
  assert.deepEqual([plate.currentCondition, plate.maxCondition, plate.foundCondition], [17899, 37683, 17899]);
  online(() => assert.equal(saleConditionPercentage(plate), 47, 'the share it was found at'));
  // the owner's mends past the mark, through the next temper
  const was = plate.currentCondition;
  plate.currentCondition = plate.maxCondition;
  creditOwnMend(plate, was);
  assert.ok(temperItem(plate, { quality: pieceQuality(plate) + 1 }));
  assert.equal(plate.selfMended, plate.maxCondition - plate.foundCondition, 'mended whole, then tempered: the room above the mark, moved');
  // WEAPON-POOL: an iron dagger on its row's 50, found at 25 and mended by its owner to 40, moves to the pool's 1,600
  const dagger = Object.assign(randomConditionLootItems([weaponOfMaterial(WEAPONS.Dagger, WEAPON_MATERIALS.Iron)], at(0.5))[0], { maxCondition: 50, currentCondition: 40, foundCondition: 25, selfMended: 15 });
  assert.equal(repoolWeaponConditions([dagger]), 1);
  assert.deepEqual([dagger.maxCondition, dagger.currentCondition, dagger.foundCondition, dagger.selfMended], [1600, 1280, 800, 480]);
});

test('AUDIT MEND-THIRD L3-6: a new character\'s worn kit and the questions\' dagger are handed over marked - at creation and at a classic load\'s mint (mutants: the kit\'s or the dagger\'s mark dropped)', () => {
  installRoleplayRealismItems({ fetchBytes: async () => new Uint8Array() });
  let wornPieces = 0, unmarked = 0;
  for (let s = 0; s < 40; s++) {
    let seed = s * 7919 + 1;
    const rolls = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const e = { gender: 'male', items: [createWeapon(WEAPONS.Dagger, WEAPON_MATERIALS.Ebony, rolls)], career: { primarySkills: [17, 22, 28], majorSkills: [27, 33, 18], luck: 50 }, activeEffects: [] };
    assignSkillEquipment(e, { rolls, torchesFromItems: false });
    for (const it of e.items) if (worn(it)) { wornPieces++; if (it.foundCondition !== it.currentCondition) unmarked++; }
  }
  assert.ok(wornPieces > 80, `${wornPieces} worn pieces`);
  assert.equal(unmarked, 0);
  // a classic load's questions' dagger, never minted: minted at 20% and marked there
  const old = setItemFields({ group: 'Weapons', templateIndex: WEAPONS.Dagger, material: WEAPON_MATERIALS.Ebony });
  delete old.maxCondition; old.currentCondition = 0;
  assert.equal(repairUnmintedConditions([old]), 1);
  assert.ok(old.currentCondition > 0 && old.foundCondition === old.currentCondition);
});

test('AUDIT MEND-THIRD L1-4: a patron values a piece at the condition a counter\'s sale reads, through the mod\'s condition price - a found Daedric cuirass at 20% was worth its whole 153,600 (a cap of 92,160, the best counter paying 25,344); mended at a smith it is worth what it was found at, by its owner\'s kit a third more, whole and unmarked the whole (mutants: the condition unread; the mark unread)', () => {
  const plate = found(armorOfMaterial(CUIRASS, ARMOR_MATERIAL.Daedric), 0);
  assert.equal(itemWorth({ ...plate, value: 0 }), 153600, 'the judge\'s floor reads no condition');
  assert.equal(patronWorth(plate, itemWorth), 30720, 'found at 19%: the mod\'s floor, a fifth');
  assert.equal(patronCap(patronWorth(plate, itemWorth)), 18432);
  assert.equal(patronWorth({ ...plate, currentCondition: plate.maxCondition }, itemWorth), 30720, 'mended at a smith: as found');
  const kit = creditOwnMend({ ...plate, currentCondition: 11469 }, plate.currentCondition);
  assert.equal(patronWorth(kit, itemWorth), 36864, 'a kit\'s third past the mark: 24%');
  assert.equal(patronWorth({ ...plate, currentCondition: plate.maxCondition, foundCondition: undefined }, itemWorth), 153600, 'whole and unmarked: the whole');
  const half = mintCondition(setItemFields({ group: 'Armor', templateIndex: CUIRASS, material: ARMOR_MATERIAL.Daedric }));
  half.currentCondition = Math.trunc(half.maxCondition / 2);
  assert.equal(patronWorth(half, itemWorth), 76800, 'an unmarked piece at half: half');
});
