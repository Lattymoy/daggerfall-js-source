// QS1 - THE QUICKSLOTS: the model behind the enhanced HUD's diamond.
//
// A slot holds a KIND (the item's key and name), not a record: no item
// in this port carries a unique id, the save copies every record and
// the pack reorders by splice. Each frame the pack is walked for the
// key; the first match is used, every match is counted, and a kind
// with no match is a ghost that reads 0 and refills on the next buy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  QUICKSLOTS, QUICKSLOT_TEXT, quickslotKey, isQuickConsumable, canSwapTo,
  assignQuickslot, clearQuickslot, clearQuickslots, quickslotOf, quickslotEntry,
  resolveConsumable, resolveSwap, quickslotView, useQuickslot, swapQuickslot,
  quickslotSaveData, restoreQuickslotSaveData,
} from '../src/systems/quickslots.js';
import { equipItem, equipTableOf, EQUIP_SLOTS, isEquipped, getItemHands, ITEM_HANDS } from '../src/systems/equip.js';
import { potionRecipeKeys, potionRecipeByKey } from '../src/systems/potions.js';
import { composeSessionState, restoreSessionState } from '../src/systems/save.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const [HEAL_KEY, FIRE_KEY] = potionRecipeKeys();
const potion = (key, n = 1) => ({ group: 'UselessItems1', templateIndex: 83, name: 'Glass Bottle', potionRecipeKey: key, stackCount: n, currentCondition: 1, maxCondition: 1 });
const drug = () => ({ group: 'Drugs', templateIndex: 136, name: 'Indulcet', stackCount: 1 });
const sword = (over = {}) => ({ group: 'Weapons', templateIndex: 120, material: 0, name: 'Longsword', currentCondition: 800, maxCondition: 1000, ...over });
const dagger = (over = {}) => ({ group: 'Weapons', templateIndex: 113, material: 3, name: 'Dagger', currentCondition: 50, maxCondition: 100, ...over });
const claymore = () => ({ group: 'Weapons', templateIndex: 122, material: 0, name: 'Claymore', currentCondition: 100, maxCondition: 100 });
const shield = () => ({ group: 'Armor', templateIndex: 110, material: 0x0200, name: 'Round Shield', currentCondition: 30, maxCondition: 100 });
const torch = () => ({ group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 40, maxCondition: 100 });
const player = (items = []) => ({ isPlayer: true, level: 5, career: {}, activeEffects: [], spells: [], stats: {}, items });

test.beforeEach(() => clearQuickslots());

test('QS1 key: what a player reads as "the same item", and nothing that wears', () => {
  // Two Potions of the same recipe are one kind; two recipes are two -
  // every potion is one Glass_Bottle template (AUDIT 22 F5).
  assert.equal(quickslotKey(potion(HEAL_KEY)), quickslotKey(potion(HEAL_KEY, 4)));
  assert.notEqual(quickslotKey(potion(HEAL_KEY)), quickslotKey(potion(FIRE_KEY)));
  // Condition and stack size are not in the key.
  assert.equal(quickslotKey(sword()), quickslotKey(sword({ currentCondition: 1 })));
  // Material, enchantment, legendary and affixes are.
  assert.notEqual(quickslotKey(sword()), quickslotKey(sword({ material: 3 })));
  assert.notEqual(quickslotKey(sword()), quickslotKey(sword({ enchantments: [{ type: 1, param: 2 }] })));
  assert.notEqual(quickslotKey(sword()), quickslotKey(sword({ legendary: 'Chrysamere' })));
  assert.notEqual(quickslotKey(sword()), quickslotKey(sword({ affixes: [{ id: 'keen' }] })));
  assert.equal(quickslotKey(null), null);
});

test('QS1 kinds: a consumable is a potion or a drug; a swap is an unequipped weapon that is not an arrow', () => {
  assert.ok(isQuickConsumable(potion(HEAL_KEY)));
  assert.ok(isQuickConsumable(drug()));
  assert.ok(!isQuickConsumable(torch()), 'a torch is the off-hand cell\'s, not a consumable');
  assert.ok(!isQuickConsumable(sword()));
  assert.ok(canSwapTo(sword()));
  assert.ok(!canSwapTo({ group: 'Weapons', templateIndex: 131, name: 'Arrow' }), 'arrows cannot be equipped');
  assert.ok(!canSwapTo(shield()));
  const e = player([sword()]);
  equipItem(e, e.items[0]);
  assert.ok(!canSwapTo(e.items[0]), 'the weapon in your hand is not a swap target');
  // Assignment refuses the wrong kind and changes nothing.
  assert.equal(assignQuickslot('c1', sword()), false);
  assert.equal(quickslotEntry('c1'), null);
  assert.equal(assignQuickslot('swap', potion(HEAL_KEY)), false);
  assert.equal(quickslotEntry('swap'), null);
  assert.throws(() => assignQuickslot('c3', potion(HEAL_KEY)), /no slot/);
  assert.deepEqual([...QUICKSLOTS], ['c1', 'c2', 'swap']);
});

test('QS1 slots: one kind lives in one slot, and the entry is a copy', () => {
  const heal = potion(HEAL_KEY);
  assert.ok(assignQuickslot('c1', heal));
  assert.equal(quickslotOf(heal), 'c1');
  assert.equal(quickslotOf(potion(HEAL_KEY, 9)), 'c1', 'any record of the kind answers the slot');
  assert.equal(quickslotOf(potion(FIRE_KEY)), null);
  // Moving the kind to slot 2 empties slot 1.
  assert.ok(assignQuickslot('c2', heal));
  assert.equal(quickslotEntry('c1'), null);
  assert.equal(quickslotOf(heal), 'c2');
  const entry = quickslotEntry('c2');
  assert.equal(entry.name, `Potion of ${potionRecipeByKey(HEAL_KEY).displayName}`, 'the name is ResolveItemLongName\'s');
  entry.name = 'tampered';
  assert.equal(quickslotEntry('c2').name, `Potion of ${potionRecipeByKey(HEAL_KEY).displayName}`);
  clearQuickslot('c2');
  assert.equal(quickslotOf(heal), null);
  assert.throws(() => clearQuickslot('nope'), /no slot/);
});

test('QS1 resolve: the first record is used, every record is counted, and a missing kind is a GHOST', () => {
  const e = player([potion(FIRE_KEY), potion(HEAL_KEY, 3), sword(), potion(HEAL_KEY, 2)]);
  assignQuickslot('c1', potion(HEAL_KEY));
  const r = resolveConsumable(e, 'c1');
  assert.equal(r.item, e.items[1], 'the FIRST match is what a use consumes');
  assert.equal(r.count, 5, 'both stacks count as one number');
  assert.equal(resolveConsumable(e, 'c2'), null, 'unassigned is null, not a ghost');
  // Reordering the pack changes nothing a slot holds.
  e.items.reverse();
  assert.equal(resolveConsumable(e, 'c1').count, 5);
  // Every bottle gone: a ghost that keeps its name and reads 0...
  e.items = [potion(FIRE_KEY), sword()];
  const ghost = resolveConsumable(e, 'c1');
  assert.equal(ghost.item, null);
  assert.equal(ghost.count, 0);
  assert.equal(ghost.name, r.name);
  // ...and refills on the next buy, with no trip to the tooltip.
  e.items.push(potion(HEAL_KEY, 1));
  assert.equal(resolveConsumable(e, 'c1').count, 1);
  // An entity with no pack resolves to a ghost, never throws.
  assert.equal(resolveConsumable(null, 'c1').count, 0);
});

test('QS1 view: main from the hand, off in the order lit > shield > swap > empty', () => {
  const e = player([sword(), shield(), dagger(), torch()]);
  const [held, sh, dag, tor] = e.items;
  equipItem(e, held);
  // Nothing in the off hand, nothing set: empty.
  let v = quickslotView(e, { weapon: held, sheathed: true });
  assert.deepEqual({ ...v.main, item: null }, { item: null, name: 'Iron Longsword', condition: 80, sheathed: true });
  assert.equal(v.main.item, held);
  assert.deepEqual(v.off, { kind: 'empty', item: null, name: null, condition: null });
  assert.equal(v.c1, null); assert.equal(v.c2, null);
  // No weapon held: main is null, not a cell that says nothing.
  assert.equal(quickslotView(e, { weapon: null }).main, null);
  // A swap set shows in the off cell while the hand is empty...
  assignQuickslot('swap', dag);
  v = quickslotView(e, { weapon: held });
  assert.equal(v.off.kind, 'swap');
  assert.equal(v.off.item, dag);
  assert.equal(v.off.condition, 50);
  // ...as a ghost when the dagger is not in the pack...
  e.items = [held, sh, tor];
  v = quickslotView(e, { weapon: held });
  assert.deepEqual(v.off, { kind: 'swap', item: null, name: 'Elven Dagger', condition: null });
  e.items.push(dag);
  // ...and the shield on the left hand wins over it.
  equipItem(e, sh);
  v = quickslotView(e, { weapon: held });
  assert.equal(v.off.kind, 'shield');
  assert.equal(v.off.item, sh);
  assert.equal(v.off.condition, 30);
  // A LIT light source wins over everything: it is in the hand.
  e.lightSource = tor;
  v = quickslotView(e, { weapon: held });
  assert.equal(v.off.kind, 'torch');
  assert.equal(v.off.condition, 40, 'what is left to burn');
  e.lightSource = null;
  assert.equal(quickslotView(e, { weapon: held }).off.kind, 'shield');
  // The consumables ride the view too.
  e.items.push(potion(HEAL_KEY, 2));
  assignQuickslot('c2', potion(HEAL_KEY));
  v = quickslotView(e, { weapon: held });
  assert.equal(v.c2.count, 2);
  // No entity at all: a view that paints nothing, not a throw.
  clearQuickslots();
  const none = quickslotView(null, {});
  assert.equal(none.main, null);
  assert.equal(none.off.kind, 'empty');
});

test('QS1 use: through the one useItem ladder with the host\'s hooks, and the count follows', () => {
  const e = player([potion(HEAL_KEY, 2), drug()]);
  const said = [];
  const drunk = [];
  const hooks = { drinkPotion: (key) => { drunk.push(key); return { name: 'Healing' }; } };
  // An unassigned slot says so and consumes nothing.
  assert.deepEqual(useQuickslot('c1', { entity: e, hooks, say: (t) => said.push(t) }), { kind: 'empty' });
  assert.deepEqual(said, [QUICKSLOT_TEXT.emptySlot]);
  assignQuickslot('c1', potion(HEAL_KEY));
  let r = useQuickslot('c1', { entity: e, hooks, say: (t) => said.push(t) });
  assert.equal(r.kind, 'used');
  assert.deepEqual(drunk, [HEAL_KEY], 'DrinkPotion through the host\'s cast engine, by recipe key');
  assert.equal(e.items[0].stackCount, 1, 'RemoveOne took one bottle off the stack');
  assert.equal(said.length, 1, 'a potion drunk through a live hook says nothing - the effect is the HUD\'s');
  r = useQuickslot('c1', { entity: e, hooks, say: (t) => said.push(t) });
  assert.equal(resolveConsumable(e, 'c1').count, 0, 'the last bottle is gone');
  // Empty-handed: the ghost's name, nothing consumed, no hook called.
  r = useQuickslot('c1', { entity: e, hooks, say: (t) => said.push(t) });
  assert.equal(r.kind, 'none');
  assert.equal(said.at(-1), QUICKSLOT_TEXT.noneLeft(r.name));
  assert.equal(drunk.length, 2);
  // A host with no hook: the window's own pending stand-in is said.
  e.items.push(potion(FIRE_KEY));
  assignQuickslot('c2', potion(FIRE_KEY));
  useQuickslot('c2', { entity: e, hooks: {}, say: (t) => said.push(t) });
  assert.equal(said.at(-1), 'You drink the potion.');
  // A drug is consumed through the same ladder.
  assignQuickslot('c2', drug());
  r = useQuickslot('c2', { entity: e, hooks, say: (t) => said.push(t) });
  assert.equal(r.result.kind, 'drugged');
  assert.ok(!e.items.some((it) => it.group === 'Drugs'), 'consumed');
  // The swap slot is not a consumable slot.
  assert.throws(() => useQuickslot('swap', { entity: e }), /not a consumable/);
});

test('QS1 swap: equipItem does the work, the leaver becomes the swap, and the pause is billed', () => {
  const e = player([sword(), dagger(), shield()]);
  const [held, dag, sh] = e.items;
  const said = [];
  const say = (t) => said.push(t);
  assert.deepEqual(swapQuickslot({ entity: e, say }), { kind: 'none' });
  assert.equal(said.at(-1), QUICKSLOT_TEXT.noSwap);
  equipItem(e, held);
  equipItem(e, sh);
  assignQuickslot('swap', dag);
  e.equipCountdown = 0;
  let r = swapQuickslot({ entity: e, say });
  assert.equal(r.kind, 'swapped');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], dag, 'the dagger is in the hand');
  assert.ok(!isEquipped(held), 'the longsword left it');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], sh, 'a one-hander leaves the shield alone');
  assert.equal(quickslotOf(held), 'swap', 'the leaver is the next swap - press again to swap back');
  assert.ok(e.equipCountdown > 0, 'the window\'s equip pause is billed here too');
  assert.equal(said.at(-1), QUICKSLOT_TEXT.swapped('Elven Dagger'), 'the long name, material and all');
  r = swapQuickslot({ entity: e, say });
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], held, 'and back');
  assert.equal(quickslotOf(dag), 'swap');
  // A two-hander bumps the shield, as equipItem's own law says.
  e.items.push(claymore());
  assignQuickslot('swap', e.items.at(-1));
  swapQuickslot({ entity: e, say });
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], null, 'the shield came off for the claymore');
  assert.equal(quickslotOf(held), 'swap');
  // Out of empty hands there is nothing to swap back to: the slot clears.
  const e2 = player([dagger()]);
  assignQuickslot('swap', e2.items[0]);
  swapQuickslot({ entity: e2, say });
  assert.equal(equipTableOf(e2)[EQUIP_SLOTS.RightHand], e2.items[0]);
  assert.equal(quickslotEntry('swap'), null);
  // A ghost (the weapon left the pack) says so and equips nothing.
  assignQuickslot('swap', sword());
  const r3 = swapQuickslot({ entity: e2, say });
  assert.equal(r3.kind, 'gone');
  assert.equal(said.at(-1), QUICKSLOT_TEXT.swapGone('Iron Longsword'));
});

// QS2 (2026-09-17): THE GAP THE WIRING FOUND. Every case QS1 pinned above has
// the off hand FULL - a shield, or a two-hander that clears both - so
// `equipItem` evicted the main hand and the swap swapped. With the off hand
// EMPTY, which is how most characters walk around, GetEquipSlot's weapon arm is
// `getFirstSlot(RightHand, LeftHand)` - the first OPEN hand - and the swap
// weapon went into the LEFT hand beside the one already held: nothing left the
// hand, so no leaver, so the slot CLEARED, and the next press said there was
// nothing to swap to. The player pressed swap and started dual-wielding.
test('QS2 swap: with the off hand EMPTY the swap still REPLACES what is held - the off hand is not overflow', () => {
  const e = player([sword(), dagger()]);
  const [held, dag] = e.items;
  equipItem(e, held);
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], null, 'the off hand really is empty');
  assignQuickslot('swap', dag);
  const said = [];
  const r = swapQuickslot({ entity: e, say: (t) => said.push(t) });
  assert.equal(r.kind, 'swapped');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], dag, 'the dagger is in the MAIN hand');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], null, 'and the off hand is still empty - no second weapon appeared');
  assert.ok(!isEquipped(held), 'the longsword left the hand');
  assert.equal(quickslotOf(held), 'swap', 'so there is something to swap BACK to - the Souls behaviour');
  // ...and back, which is the half that was unreachable before.
  swapQuickslot({ entity: e, say: (t) => said.push(t) });
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], held);
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.LeftHand], null);
  assert.equal(quickslotOf(dag), 'swap');
  // THE HAND LAW IS STILL THE EQUIP TABLE'S. A weapon that is LEFT-ONLY by the
  // table's own answer keeps its hand: this only stops the off hand being used
  // as overflow for a weapon that wanted the main one.
  assert.equal(getItemHands(dag), ITEM_HANDS.Either, 'a dagger is either-handed, which is the case the overflow bit');
});

test('QS1 swap refusals: the window\'s own - broken and forbidden - with its words, never a way round', () => {
  const e = player([sword(), dagger({ currentCondition: 0 })]);
  const [held, broken] = e.items;
  equipItem(e, held);
  assignQuickslot('swap', broken);
  const said = [];
  const rows = (id) => [{ text: `TEXT ${id}` }];
  let r = swapQuickslot({ entity: e, say: (t) => said.push(t), rows });
  assert.equal(r.kind, 'broken');
  assert.equal(said.at(-1), 'TEXT 29', 'ITEM_BROKEN_TEXT_ID through the host\'s rows');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], held, 'nothing moved');
  // A SOUND record of the same kind is preferred over the broken one
  // (condition is not in the key), so the refusal only ever says
  // "broken" when broken is all you have.
  e.items.push(dagger());
  assert.equal(resolveSwap(e).item, e.items.at(-1));
  // Forbidden by the class: a career that cannot use short blades.
  assignQuickslot('swap', e.items.at(-1));
  e.career = { weaponArmorShieldsBitfield: 0x3f, forbiddenMaterialsFlags: 0 };
  r = swapQuickslot({ entity: e, say: (t) => said.push(t), rows });
  assert.equal(r.kind, 'forbidden');
  assert.equal(said.at(-1), 'TEXT 1068');
  assert.equal(equipTableOf(e)[EQUIP_SLOTS.RightHand], held);
  // Without rows the refusal is silent but still a refusal.
  const before = said.length;
  r = swapQuickslot({ entity: e, say: (t) => said.push(t) });
  assert.equal(r.kind, 'forbidden');
  assert.equal(said.length, before);
});

test('QS1 save: the slots ride the one session composer, and a save without the block CLEARS them', () => {
  assignQuickslot('c1', potion(HEAL_KEY));
  assignQuickslot('swap', dagger());
  const data = quickslotSaveData();
  assert.deepEqual(Object.keys(data), ['c1', 'c2', 'swap']);
  assert.equal(data.c2, null);
  assert.equal(data.swap.name, 'Elven Dagger');
  assert.equal(JSON.parse(JSON.stringify(data)).c1.key, data.c1.key, 'plain data, JSON-safe');
  // Through the composer every host's save already passes.
  const extras = composeSessionState({});
  assert.deepEqual(extras.quickslots, data);
  clearQuickslots();
  assert.equal(quickslotEntry('c1'), null);
  restoreSessionState(extras, {});
  assert.deepEqual(quickslotSaveData(), data);
  // A pre-QS save, or another character's: cleared, never stale.
  restoreSessionState({ quest: null }, {});
  assert.deepEqual(quickslotSaveData(), { c1: null, c2: null, swap: null });
  // A malformed block is refused entry by entry.
  restoreQuickslotSaveData({ c1: { key: 5, name: 'x' }, c2: { key: 'k', name: 'Potion' }, swap: 'no' });
  assert.equal(quickslotEntry('c1'), null);
  assert.deepEqual(quickslotEntry('c2'), { key: 'k', name: 'Potion' });
  assert.equal(quickslotEntry('swap'), null);
  // The source: the composer and the restorer both name the module.
  const save = read('src/systems/save.js');
  assert.match(save, /quickslots: quickslotSaveData\(\)/);
  assert.match(save, /restoreQuickslotSaveData\(extras\?\.quickslots \?\? null\)/);
});
