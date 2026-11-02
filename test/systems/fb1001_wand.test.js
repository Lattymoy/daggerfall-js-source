// FIELD BUGS 2026-10-01 part four (RARITY-WEAR) - Cruor in #bug-reports, "I think I found a bugged ...": a Legendary
// King's Mark came out with "completely different icon and everything", and WEAR did nothing - "If these items spawn
// as wands, they cannot be equipped as wands are not an equippable effectively being useless. Solution: Make these
// items not roll as wands".
//
// A Legendary record renames the piece a maker minted; it never picks the base. The Gate's spoils and a town's thanks
// (gateSpoils.js spoilsBase, raidSpoils.js) drew a jewel over all eight Jewellery templates, and the eighth is the Wand
// (140), which no slot takes (DFU's GetJewelleryEquipSlot answers None; equipRules.js has no row) - so one jewel in
// eight was a wand, every affix and enchantment on it read off worn pieces alone, and a King's Mark on one was dead
// weight. Now no slot, no tier: the spoils' base is made again when it is a piece nothing can wear, the ladder never
// grades one (lootRarity.js rarityEligible), and a save's rolled wands load as the Amulet (repairRarityBases) - the
// same weight and the same condition, the slot a Wand never had. Fixtures are the producers': the real rollSpoils and
// rollRaidSpoils over their seeds, the real applyRarity over a piece minted by setItemFields + mintCondition, the real
// equipItem, and a load through the real snapshotPlayer / restorePlayer.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { setItemFields, mintCondition, templateByIndex, itemBaseValue } from '../../src/systems/item/itemTemplates.js';
import {
  applyRarity, rarityEligible, rollLootRarity, legendaryById, legendariesFor, repairRarityBases, RARITY_HOME, rarityName,
} from '../../src/systems/loot/lootRarity.js';
import { rollSpoils, spoilsBase } from '../../src/systems/gate/gateSpoils.js';
import { rollRaidSpoils } from '../../src/systems/raidSpoils.js';
import { equipItem, wearableItem } from '../../src/systems/equip.js';
import { seededRng } from '../../src/systems/wind/wind.js';
import { ITEM_GROUPS } from '../../src/systems/loot/loot.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

const WAND = 140, AMULET = 133;
const jewel = (templateIndex) => mintCondition(setItemFields({ group: 'Jewellery', templateIndex, flags: 0 }));
const hero = () => ({ name: 'Cruor', items: [], activeEffects: [], stats: { strength: 50 }, skills: [] });
/** A King's Mark as the Gate minted it before: the real ladder over a jewel that came up a Wand. */
const kingsMarkWand = () => {
  const it = jewel(WAND);
  applyRarity(it, 'legendary', seededRng(7), [legendaryById('kings-mark')]);
  it.isIdentified = true;
  return it;
};

test('RARITY-WEAR: the law - a Wand is the one jewel no slot takes, and no tier is rolled on a piece nothing can wear; every other jewel, armour and weapon is graded as before (mutants: the law that answers yes; the wand graded; the eligibility check gone)', () => {
  assert.deepEqual(ITEM_GROUPS.Jewellery, [133, 134, 135, 136, 137, 138, 139, 140]);
  assert.deepEqual(ITEM_GROUPS.Jewellery.filter((t) => !wearableItem(jewel(t))), [WAND], 'the Wand alone');
  for (const t of ITEM_GROUPS.Jewellery) {
    const e = hero();
    assert.equal(equipItem(e, jewel(t)) !== null, t !== WAND, `${templateByIndex(t).name}: the law is equipItem's own`);
  }
  assert.equal(rarityEligible(jewel(WAND)), false, 'a wand takes no tier');
  assert.equal(rarityEligible(jewel(AMULET)), true);
  assert.equal(rarityEligible(jewel(137)), true, 'a Mark');
  assert.equal(rarityEligible(mintCondition(setItemFields({ group: 'Armor', templateIndex: 102, material: 0x0200, flags: 0 }))), true);
  assert.equal(rarityEligible(mintCondition(setItemFields({ group: 'Weapons', templateIndex: 113, material: 0, flags: 0 }))), true);
  // the host door leaves a found wand as DFU made it, and still grades the amulet beside it (the ladder's row on)
  _resetForTests(); setPref('lootRarity', true);
  const list = [jewel(WAND), jewel(AMULET)];
  rollLootRarity(list, { kind: 'dungeon', tier: 5, boss: true }, { rolls: () => 0.0001, luck: 100 });
  assert.equal(list[0].rarity, undefined, 'the wand stays plain');
  assert.equal(list[0].name, 'Wand');
  assert.equal(list[1].rarity, 'legendary', 'the amulet beside it is graded');
});

test('RARITY-WEAR: the Gate\'s spoils and a town\'s thanks are never a wand - every piece over two thousand seeds can be worn, and a King\'s Mark still comes (mutants: the spoils\' base not made again; the base made again for a wearable piece)', () => {
  let marks = 0, jewels = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const lv = 1 + (seed % 30);
    const pieces = [...rollSpoils(seed * 7919, lv).pieces, ...rollRaidSpoils(seed * 104729, lv, 1 + (seed % 4)).pieces];
    for (const { item } of pieces) {
      assert.ok(wearableItem(item), `seed ${seed}: ${item.name} (template ${item.templateIndex}) can be worn`);
      assert.notEqual(equipItem(hero(), item), null, `seed ${seed}: ${item.name} is worn by equipItem`);
      if (item.group === 'Jewellery') jewels++;
      if (item.legendary === 'kings-mark') marks++;
    }
  }
  assert.ok(jewels > 1000, `jewels still come (${jewels})`);
  assert.ok(marks > 0, `King's Marks still come (${marks})`);
  // the base itself: a stream that draws the wand first is made again into the next piece, and the seed's stream
  // goes on from there - a stream that draws a wearable jewel first is taken as it is
  const wandFirst = [2 / 3 + 0.001, 7.5 / 8, 0.9, 0.1];   // k = 2 (a jewel), index 7 (the Wand); then k = 2, index 0
  let i = 0;
  const base = spoilsBase(5, () => wandFirst[i++]);
  assert.equal(base.templateIndex, AMULET, 'made again: the next draw, an Amulet');
  assert.equal(i, 4, 'the wand cost the stream its two draws');
  i = 0;
  const ring = spoilsBase(5, () => [2 / 3 + 0.001, 2.5 / 8][i++]);
  assert.equal(ring.templateIndex, 135, 'a Ring first is a Ring');
  assert.equal(i, 2, 'two draws, as before');
});

test('RARITY-WEAR: a save\'s rolled wand loads as an Amulet - the King\'s Mark keeps its name and is worn; a Magic or Rare wand is renamed for its Amulet; its price moves by the two bases; DFU\'s own wands and a plain one are left; a second load finds nothing (mutants: no repair; a DFU wand moved; the name kept on a Magic piece; the price unmoved; the repair not run on load)', () => {
  assert.deepEqual(RARITY_HOME, { Jewellery: AMULET });
  const mark = kingsMarkWand();
  assert.equal(mark.name, "King's Mark");
  assert.equal(equipItem(hero(), { ...mark }), null, 'before: WEAR does nothing');
  const rare = jewel(WAND);
  applyRarity(rare, 'rare', seededRng(11));
  assert.equal(rare.name, rarityName(rare, 'rare', rare.affixes));
  assert.match(rare.name, /(^|\s)Wand(\s|$)/);
  const dfuWand = { ...jewel(WAND), magic: true, enchantments: [{ type: 0, param: 5 }] };   // MAGIC.DEF's CastWhenUsed
  const plain = jewel(WAND);
  const markValue = mark.value, rareValue = rare.value;
  const list = [mark, rare, dfuWand, plain];
  assert.equal(repairRarityBases(list), 2);
  assert.equal(mark.templateIndex, AMULET);
  assert.equal(mark.name, "King's Mark", 'a Legendary keeps its record\'s name');
  assert.equal(mark.value, markValue - itemBaseValue({ templateIndex: WAND }) + itemBaseValue({ templateIndex: AMULET }));
  assert.equal(mark.maxCondition, templateByIndex(AMULET).hitPoints, 'the same condition (both 800)');
  assert.notEqual(equipItem(hero(), mark), null, 'after: it is worn');
  assert.equal(rare.templateIndex, AMULET);
  assert.equal(rare.name, rarityName(rare, 'rare', rare.affixes));
  assert.match(rare.name, /(^|\s)Amulet(\s|$)/);
  assert.equal(rare.value, rareValue + itemBaseValue({ templateIndex: AMULET }) - itemBaseValue({ templateIndex: WAND }));
  assert.equal(dfuWand.templateIndex, WAND, 'a MAGIC.DEF wand is a wand: its Use fires');
  assert.equal(plain.templateIndex, WAND);
  assert.equal(repairRarityBases(list), 0, 'idempotent');
  assert.equal(repairRarityBases(undefined), 0);
  // across a load: the pack and the wagon
  const entity = {
    name: 'Cruor', gender: 'female', careerIndex: 0, level: 9, reflexes: 2, health: 40, maxHealth: 40, magicka: 0, maxMagicka: 0,
    startingLevelUpSkillSum: 90, currentLevelUpSkillSum: 120, readyToLevelUp: false, pendingLevel: null, chargenDone: true,
    stats: { strength: 55, luck: 50 }, skills: [30, 28], skillUses: [0, 0], career: { name: 'Warrior', hitPointsPerLevel: 8 },
    items: [kingsMarkWand()], wagonItems: [{ ...kingsMarkWand(), UID: 2 }], spells: [], activeEffects: [],
  };
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(entity, { position: [0, 0, 0], classicMinutes: 0, locationKey: 'world' })));
  const loaded = {};
  restorePlayer(loaded, snap, new Map());
  assert.equal(loaded.items[0].templateIndex, AMULET);
  assert.equal(loaded.items[0].name, "King's Mark");
  assert.equal(loaded.wagonItems[0].templateIndex, AMULET);
  // and the ladder's pool for the new base still names it
  assert.ok(legendariesFor(loaded.items[0]).some((l) => l.id === 'kings-mark'));
});
