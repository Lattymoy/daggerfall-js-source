// AC-COMPARE (FIELD BUGS 2026-09-29d - SylviaBun on the Discord, #suggestions, Althea's idea: "when in the player
// inventory we should be able to see the total AC of equipped items on our characters. Hovering our cursor over an item
// ... should also allow us to see comparative stats ... a straight up + or - stat next to the items stats in green and
// red so we can quickly see what is better or worse"). THE CHARACTER'S ARMOUR AT A GLANCE AND WHAT A WEAR WOULD CHANGE,
// on the enhanced pack (ui/armourCard.js, composed by ui/enhancedInventory.js).
//
// Every fixture is minted by the port's own makers (itemTemplates setItemFields + mintCondition, enemyEquipment
// createWeapon, lootRarity applyRarity) and worn through the real equip path (equip.js equipItem); the pack is mounted
// on the fake document the pack's own suites drive (test/invdrag.mjs). The comparison is pinned by what the WEAR then
// does: every part the card says a wear would move, and the overall figure after it, is the doll's own once the piece
// is worn, and what it says the wear replaces is what equipItem takes off.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from './invdrag.mjs';
import { equipItem, wearLeavers, bodyPartForSlot, slotForBodyPart, EQUIP_SLOTS } from '../src/systems/equip.js';
import { mintCondition, setItemFields } from '../src/systems/itemTemplates.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL, BODY_PARTS, NUMBER_BODY_PARTS } from '../src/systems/armorMaterials.js';
import { applyRarity, LEGENDARIES, LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { itemIsIdentified } from '../src/systems/tradeModes.js';
import { STRUCK_BODY_PARTS, struckBodyPartTable } from '../src/combat/formulas.js';
import { installPcaao, uninstallPcaao, PCAAO_BODY_PARTS } from '../src/combat/pcaao.js';
import { weaponDamageRange, weaponDamageString, itemLongName } from '../src/systems/itemInfo.js';
import { PART_NAMES, dollArmour, struckCounts, overallArmour, tenth, wearComparison, compareBlock } from '../src/ui/armourCard.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { PAGE_IDS } from '../src/ui/packPages.js';
import { ARMOUR_CSS, PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';

setPref(LOOT_RARITY_KEY, true);   // the ladder is on, as it ships (LR5): an armour affix is one of the doll's points

const armour = (templateIndex, material) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material }));
const clothes = (templateIndex) => mintCondition(setItemFields({ group: 'MensClothing', templateIndex }));
const jewel = (templateIndex) => mintCondition(setItemFields({ group: 'Jewellery', templateIndex }));
const seq = (s) => { let i = 0; return () => s[i++ % s.length]; };
/** lootRarity's own Magic roll, scripted so its first affix is the armour's own +6 (asserted where it is used). */
const magic = (it) => applyRarity(it, 'magic', seq([0.99, 0, 0.99, 0.2, 0.9, 0.3]));
const legendary = (it, id) => applyRarity(it, 'legendary', () => 0, [LEGENDARIES.find((r) => r.id === id)]);
const hero = () => ({
  isPlayer: true, name: 'Aelwyn', career: { name: 'Spellsword' }, level: 5,
  stats: { strength: 50, endurance: 48, agility: 50, speed: 50, luck: 50, willpower: 50, intelligence: 50, personality: 50 },
  skills: new Array(35).fill(30), activeEffects: [], spells: [], items: [], goldPieces: 0,
});
const wear = (e, ...items) => { for (const it of items) { e.items.push(it); equipItem(e, it); } return e; };
const carry = (e, it) => { e.items.push(it); return it; };
/** THE KIT: a Magic iron helm (+6 armour), a steel cuirass, iron greaves, iron boots, an iron kite shield (3 on the left
 *  arm, the hands and the legs) and a steel longsword. The doll reads 13, 0, 3, 9, 3, 10, 7. */
function kitted() {
  const e = hero();
  const k = {
    helm: magic(armour(107, ARMOR_MATERIAL.Iron)), cuirass: armour(102, ARMOR_MATERIAL.Steel), greaves: armour(104, ARMOR_MATERIAL.Iron),
    boots: armour(108, ARMOR_MATERIAL.Iron), kite: armour(111, ARMOR_MATERIAL.Iron), sword: createWeapon(120, 1),
  };
  wear(e, k.helm, k.cuirass, k.greaves, k.boots, k.kite, k.sword);
  return { e, k };
}
const partRows = (cmp) => cmp.parts.map((r) => [PART_NAMES[r.part], r.before, r.after]);

test('AC-COMPARE the character\'s armour at a glance: the doll\'s seven numbers are the classic doll\'s own law (the material, the shield on its three parts, a Magic helm\'s armour affix), in BodyParts order under the enum\'s own names; the overall figure weighs them by the struck-part table of the core in force - FormulaHelper\'s twenty (2/3/3/4/4/3/1), the combat overhaul\'s (1/3/3/4/3/4/2) while its redone formula is on, FormulaHelper\'s again when that is off or the overhaul uninstalled; a bare character reads DFU\'s "no armour" (mutants: a struck-table entry moved; the counts not counted; the figure over seven parts, not twenty blows; the figure unweighted; the overhaul\'s table never registered, registered off its switch, or left behind by the uninstall; the formulas read the wrong name; the doll without its modifier channel; the part names off their enum; the tenth a whole)', () => {
  const { e, k } = kitted();
  assert.deepEqual(k.helm.affixes, [{ id: 'armor', value: 6 }, { id: 'weight', value: 19 }], 'the roll gives the helm its armour affix');
  assert.deepEqual(PART_NAMES, ['Head', 'Right arm', 'Left arm', 'Chest', 'Hands', 'Legs', 'Feet']);
  assert.deepEqual(dollArmour(e), [13, 0, 3, 9, 3, 10, 7], 'iron 7 + the affix 6; steel 9; the kite 3; iron 7 + the kite 3; iron 7');
  assert.deepEqual(dollArmour(hero()), [0, 0, 0, 0, 0, 0, 0], 'nothing worn: ArmorValues 100, the doll 0');
  // FormulaHelper.cs:869, and no core overriding it
  assert.deepEqual([...STRUCK_BODY_PARTS], [0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6]);
  assert.equal(struckBodyPartTable(), STRUCK_BODY_PARTS);
  assert.deepEqual(struckCounts(), [2, 3, 3, 4, 4, 3, 1]);
  assert.equal(overallArmour(dollArmour(e)), (2 * 13 + 3 * 0 + 3 * 3 + 4 * 9 + 4 * 3 + 3 * 10 + 1 * 7) / 20);
  assert.equal(tenth(overallArmour(dollArmour(e))), 6);
  // the overhaul with its redone formula on draws from its own twenty
  installPcaao({ read: () => true, other: () => false });
  try {
    assert.equal(struckBodyPartTable(), PCAAO_BODY_PARTS);
    assert.deepEqual(struckCounts(), [1, 3, 3, 4, 3, 4, 2]);
    assert.equal(overallArmour(dollArmour(e)), (13 + 0 + 9 + 36 + 9 + 40 + 14) / 20);
    assert.equal(tenth(overallArmour(dollArmour(e))), 6.1, '6.05, a half, up');
  } finally { uninstallPcaao(); }
  assert.equal(struckBodyPartTable(), STRUCK_BODY_PARTS, 'uninstalled: FormulaHelper\'s again');
  // the overhaul installed with its redone formula OFF declines, as its core does
  installPcaao({ read: (key) => key !== 'armorHitFormulaRedone', other: () => false });
  try { assert.equal(struckBodyPartTable(), STRUCK_BODY_PARTS); } finally { uninstallPcaao(); }
});

test('AC-COMPARE one law for what a wear takes off: wearLeavers is EquipItem\'s three arms in their order (ItemEquipTable.cs:117-137) - a two-hander clears both hands, a shield bumps a two-hander held right (never a one-hander), the destination\'s occupant swaps out - and equipItem takes off exactly the pieces they name; an arrow takes nothing; GetBodyPartForEquipSlot is the inverse of its seven pairs and None for any other slot (mutants: the two-hander\'s arm; the shield bumping any right hand; the occupant never swapped; equipItem off its own leavers; a slot with no part read as the head)', () => {
  const took = (e, slots) => [...new Set(slots.map((s) => e.equip.slots[s]).filter(Boolean))];
  let { e, k } = kitted();
  const clay = carry(e, createWeapon(122, 4));
  let leavers = wearLeavers(e, clay);
  assert.deepEqual(leavers, [EQUIP_SLOTS.LeftHand, EQUIP_SLOTS.RightHand, EQUIP_SLOTS.RightHand]);
  assert.deepEqual(took(e, leavers), [k.kite, k.sword]);
  assert.deepEqual(equipItem(e, clay), [k.kite, k.sword], 'equipItem takes off exactly those, in that order');
  const kite2 = carry(e, armour(111, ARMOR_MATERIAL.Iron));
  leavers = wearLeavers(e, kite2);
  assert.deepEqual(leavers, [EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand], 'a shield bumps the held two-hander');
  assert.deepEqual(equipItem(e, kite2), [clay]);
  ({ e, k } = kitted());
  const buckler = carry(e, armour(109, ARMOR_MATERIAL.Iron));
  assert.deepEqual(wearLeavers(e, buckler), [EQUIP_SLOTS.LeftHand], 'beside a one-hander: the left hand alone');
  assert.deepEqual(equipItem(e, buckler), [k.kite]);
  assert.equal(e.equip.slots[EQUIP_SLOTS.RightHand], k.sword, 'the sword stays');
  const helm2 = carry(e, armour(107, ARMOR_MATERIAL.Steel));
  assert.deepEqual(wearLeavers(e, helm2), [EQUIP_SLOTS.Head]);
  assert.deepEqual(equipItem(e, helm2), [k.helm], 'the helm swaps out');
  assert.deepEqual(wearLeavers(e, createWeapon(131, 0)), [], 'an arrow: no slot, nothing');
  for (let p = 0; p < NUMBER_BODY_PARTS; p++) assert.equal(bodyPartForSlot(slotForBodyPart(p)), p);
  for (const s of [EQUIP_SLOTS.Cloak1, EQUIP_SLOTS.ChestClothes, EQUIP_SLOTS.RightHand, EQUIP_SLOTS.LeftHand, EQUIP_SLOTS.Ring0, EQUIP_SLOTS.None]) {
    assert.equal(bodyPartForSlot(s), -1, `slot ${s}: BodyParts.None`);
  }
});

test('AC-COMPARE what a wear would change, and the wear then does exactly that: a Magic iron cuirass counts its armour affix (+4 over steel, where its iron alone is -2); an ebony one; a tower shield over the kite reaches the head; a two-hander drops the kite\'s three parts and is set against the sword by the card\'s own Damage row; dual-wielding, against the hand it takes, not the dagger it also takes off; a shield bumping a two-hander; clothing boots over iron boots, a part the piece itself does not cover. Each time what it replaces is what equipItem takes off, and every part and the overall figure after it are the doll\'s once worn (mutants: the folds\' points left out; a leaver\'s value never given back; only the covered parts listed; the rival any leaver; a leaver named twice; the new weapon set against itself; %wdm\'s material modifier off one end)', () => {
  const check = (e, item, parts) => {
    const cmp = wearComparison(e, item);
    assert.ok(cmp, `${item.name}: a comparison`);
    assert.deepEqual(partRows(cmp), parts, `${item.name}: the parts`);
    const before = dollArmour(e);
    const tookOff = equipItem(e, item);
    assert.deepEqual(cmp.replaces, tookOff, `${item.name}: what it replaces is what the wear took off`);
    const after = dollArmour(e);
    for (let p = 0; p < NUMBER_BODY_PARTS; p++) {
      const row = cmp.parts.find((r) => r.part === p);
      assert.equal(row ? row.after : before[p], after[p], `${item.name}: ${PART_NAMES[p]} once worn`);
    }
    if (parts.length) assert.deepEqual([cmp.overall.before, cmp.overall.after], [overallArmour(before), overallArmour(after)], `${item.name}: the overall figure, now and once worn`);
    else assert.equal(cmp.overall, null, `${item.name}: no part moves, no overall row`);
    return cmp;
  };
  let { e, k } = kitted();
  const rare = magic(armour(102, ARMOR_MATERIAL.Iron));
  assert.deepEqual(rare.affixes, [{ id: 'armor', value: 6 }, { id: 'weight', value: 19 }]);
  let cmp = check(e, carry(e, rare), [['Chest', 9, 13]]);
  assert.deepEqual([cmp.replaces, cmp.damage], [[k.cuirass], null]);
  ({ e, k } = kitted());
  check(e, carry(e, armour(102, ARMOR_MATERIAL.Ebony)), [['Chest', 9, 17]]);
  ({ e, k } = kitted());
  cmp = check(e, carry(e, armour(112, ARMOR_MATERIAL.Iron)), [['Head', 13, 17], ['Left arm', 3, 4], ['Hands', 3, 4], ['Legs', 10, 11]]);
  assert.deepEqual(cmp.replaces, [k.kite]);
  ({ e, k } = kitted());
  const clay = carry(e, createWeapon(122, 4));
  assert.equal(weaponDamageString(clay), '4 - 20', 'the card\'s own row: a dwarven claymore');
  cmp = check(e, clay, [['Left arm', 3, 0], ['Hands', 3, 0], ['Legs', 10, 7]]);
  assert.deepEqual(cmp.replaces, [k.kite, k.sword]);
  assert.deepEqual(cmp.damage, { against: k.sword, before: [2, 16], after: [4, 20] });
  assert.deepEqual([cmp.damage.before, cmp.damage.after], [weaponDamageRange(k.sword), weaponDamageRange(clay)]);
  // dual-wielding: a dagger in the left hand beside the sword
  const dual = hero();
  const sword = createWeapon(120, 1), dagger = createWeapon(113, 7);
  wear(dual, sword, dagger);
  assert.equal(dual.equip.slots[EQUIP_SLOTS.LeftHand], dagger);
  cmp = check(dual, carry(dual, createWeapon(122, 4)), []);
  assert.deepEqual(cmp.replaces, [dagger, sword]);
  assert.equal(cmp.damage.against, sword, 'the hand it takes - not the ebony dagger it also takes off');
  assert.deepEqual(cmp.damage.before, [2, 16]);
  // a shield over a held two-hander
  const big = hero();
  const held = createWeapon(122, 4);
  wear(big, held);
  cmp = check(big, carry(big, armour(111, ARMOR_MATERIAL.Iron)), [['Left arm', 0, 3], ['Hands', 0, 3], ['Legs', 0, 3]]);
  assert.deepEqual([cmp.replaces, cmp.damage], [[held], null]);
  // clothing boots (leather footwear, 3 on the feet - UpdateEquippedArmorValues' footwear window) over iron boots
  ({ e, k } = kitted());
  cmp = check(e, carry(e, clothes(149)), [['Feet', 7, 3]]);
  assert.deepEqual(cmp.replaces, [k.boots]);
});

test('AC-COMPARE no "if worn" where there is no wear: a piece already worn, a broken one, plate to a career that forbids it (leather still compares), an arrow; a ring compares (its slot is read) but draws no block, having no stat to set against another; an UNIDENTIFIED piece\'s affixes are left out - the Warden reads its iron alone until it is identified - and once worn the doll shows them, as DFU\'s doll shows an unidentified piece\'s powers (mutants: the career\'s refusal dropped; the unidentified piece read whole; a block for a piece with no stat)', () => {
  const { e, k } = kitted();
  assert.equal(wearComparison(e, k.cuirass), null, 'worn');
  const broken = carry(e, armour(107, ARMOR_MATERIAL.Steel));
  broken.currentCondition = 0;
  assert.equal(wearComparison(e, broken), null, 'broken');
  const { e: mage } = kitted();
  mage.career = { name: 'Mage', weaponArmorShieldsBitfield: (1 << 2) << 6 };   // plate forbidden (DFCareer's ForbiddenArmors)
  assert.equal(wearComparison(mage, carry(mage, armour(102, ARMOR_MATERIAL.Steel))), null, 'plate, forbidden');
  assert.deepEqual(partRows(wearComparison(mage, carry(mage, armour(102, ARMOR_MATERIAL.Leather)))), [['Chest', 9, 3]], 'leather is not');
  assert.equal(wearComparison(e, carry(e, createWeapon(131, 0))), null, 'an arrow');
  const ring = carry(e, jewel(135));
  const rc = wearComparison(e, ring);
  assert.deepEqual([rc.slot, rc.replaces, rc.parts, rc.damage, rc.overall], [EQUIP_SLOTS.Ring0, [], [], null, null]);
  withDom(() => {
    assert.equal(compareBlock(e, ring), null, 'a ring: no block');
    assert.ok(compareBlock(e, carry(e, armour(107, ARMOR_MATERIAL.Steel))), 'a helm: one');
  });
  const warden = carry(e, legendary(armour(102, ARMOR_MATERIAL.Iron), 'the-warden'));
  assert.equal(warden.affixes[0].id, 'armor');
  assert.equal(itemIsIdentified(warden), false, 'a Legendary drops unidentified');
  assert.deepEqual(partRows(wearComparison(e, warden)), [['Chest', 9, 7]], 'its iron alone');
  warden.isIdentified = true;
  assert.deepEqual(partRows(wearComparison(e, warden)), [['Chest', 9, 22]], 'identified: its +15 too');
  warden.isIdentified = false;
  equipItem(e, warden);
  assert.equal(dollArmour(e)[BODY_PARTS.Chest], 22, 'worn, the affix works and the doll shows it');
});

test('AC-COMPARE the pack draws it: each part\'s number on the panel for its slot - filled or empty, a bare part 0 dimmed - and on no other panel; the overall figure\'s plaque at the head of the figure\'s column, saying how it weighs the parts; the hover card and the picked card carry the comparison under their stats - what it replaces, then each row\'s now and after with its difference in the better (up) or worse (down) tone - and a worn piece\'s card none; the rules ride the Plus sheet (mutants: an empty panel\'s number; a filled panel\'s number; the dimmed zero; the head panel losing its part; the plaque; the card\'s block; the tones swapped; the overall difference a whole; the sheet without the rules)', () => {
  withDom((dom) => {
    const { e, k } = kitted();
    const eb = carry(e, armour(102, ARMOR_MATERIAL.Ebony));
    const clay = carry(e, createWeapon(122, 4));
    const host = dom.mk('div');
    dom.body.append(host);
    const was = globalThis.window;
    globalThis.window = { innerWidth: dom.w, innerHeight: dom.h, getComputedStyle: () => ({ position: 'absolute' }) };   // the hover card's placement reads the window
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {} });
    try {
      const txt = (n) => n?.textContent ?? null;
      const onPanels = {};
      for (const n of host.querySelectorAll('.wornrow')) {
        const b = n.querySelector('.wornac');
        onPanels[txt(n.querySelector('.wornslot'))] = b ? [b.textContent, b.classList.contains('nil'), b.title] : null;
      }
      assert.deepEqual(onPanels, {
        Head: ['13', false, 'Head: armour 13'], Cloaks: null,
        'Chest armor': ['9', false, 'Chest: armour 9'], Shirt: null,
        'Left arm': ['3', false, 'Left arm: armour 3'], 'Right arm': ['0', true, 'Right arm: armour 0'],
        Hands: ['3', false, 'Hands: armour 3'], 'R·Weapon': null, 'L·Hand': null,
        'Leg armor': ['10', false, 'Legs: armour 10'], 'Pants / skirt': null, Feet: ['7', false, 'Feet: armour 7'],
        Mount: null, Cart: null,
      });
      const plaque = host.querySelector('.wornac-total');
      assert.deepEqual(plaque.children.map(txt), ['Armour', '6.0']);
      assert.equal(plaque.style.gridArea, '1 / 2', 'the head of the figure\'s column');
      assert.match(plaque.title, /head 2, right arm 3, left arm 3, chest 4, hands 4, legs 3, feet 1 in 20\)$/);
      const tab = (id) => host.querySelector('.packtabs').querySelectorAll('.packtab')[PAGE_IDS.indexOf(id)].onclick({});
      const rowOf = (it) => host.querySelector('.pack-dock').querySelectorAll('.itemrow').find((r) => r._padItem === it);
      const read = (c) => [txt(c.querySelector('.cmp-head')), ...c.querySelectorAll('.pair').map((p) => [
        txt(p.querySelector('dt')), txt(p.querySelector('.cmp-v')), ...p.querySelectorAll('.cmp-d').map((d) => `${d.textContent} ${d.className.split(' ')[1]}`)])];
      // the hover card: the ebony cuirass over the steel one
      tab('armor');
      rowOf(eb).onmouseenter();
      const tip = dom.body.querySelector('.inv-tip');
      assert.ok(tip, 'the hover card is up');
      assert.deepEqual(read(tip.querySelector('.cmp')), [`Replaces ${itemLongName(k.cuirass)}`,
        ['Overall', '6.0 → 7.6', '+1.6 up'], ['Chest', '9 → 17', '+8 up']]);
      rowOf(eb).onmouseleave();
      // the picked card: the claymore over the sword and the kite
      tab('weapons');
      rowOf(clay).onclick();
      const card = host.querySelector('.packtip');
      assert.ok(card, 'the card is up');
      assert.deepEqual(read(card.querySelector('.cmp')), [`Replaces ${itemLongName(k.kite)}, ${itemLongName(k.sword)}`,
        ['Damage', '2 - 16 → 4 - 20', '+2 up', '+4 up'], ['Overall', '6.0 → 4.5', '-1.5 down'],
        ['Left arm', '3 → 0', '-3 down'], ['Hands', '3 → 0', '-3 down'], ['Legs', '10 → 7', '-3 down']]);
      // a worn piece's card has none
      const head = host.querySelectorAll('.wornrow').find((n) => txt(n.querySelector('.wornslot')) === 'Head');
      head.onmouseenter();
      const worn = dom.body.querySelector('.inv-tip');
      assert.ok(worn, 'the worn helm\'s card is up');
      assert.equal(worn.querySelector('.cmp'), null, 'what is worn is what is worn');
    } finally {
      view.unmount();
      globalThis.window = was;
    }
  });
  assert.ok(PLUS_CSS.includes(ARMOUR_CSS), 'the rules ride the Plus sheet');
  assert.match(ARMOUR_CSS, /\.card \.cmp \.cmp-d\.up \{ color: #74d9a0; \}\n\.card \.cmp \.cmp-d\.down \{ color: #d98074; \}/, 'the wear bar\'s green better, its red worse');
});
