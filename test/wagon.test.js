// W-slice: the WAGON - DaggerfallInventoryWindow's second inventory.
// The button ladder (:1234-1243), ShowWagon as the computed remote
// target (:1047-1080), the 750kg gates (WagonCanHoldAmount :1425-1434
// + the drop-gold clamp :1296-1303), CheckWagonAccess's dungeon exit
// rule (:1082-1116), and the save halves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NativeInventoryWindow, NO_WAGON_TEXT, EXIT_TOO_FAR_TEXT, CANNOT_HOLD_TEXT,
  WAGON_KG_LIMIT, SMALL_CART_TEMPLATE, wagonFullGoldText,
} from '../src/ui/nativeInventory.js';

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const cart = () => ({ group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, name: 'Small Cart' });
const book = (n = 1) => ({ group: 'Books', templateIndex: 277, name: 'Book', stackCount: n });
const wagonBtn = (w) => w.click(226 + 5, 14 + 5);

test('wagon: the button ladder - no cart, the dungeon exit rule, the toggle', () => {
  assert.equal(WAGON_KG_LIMIT, 750);
  assert.equal(SMALL_CART_TEMPLATE, 93);
  // no cart: the noWagon box, nothing toggles
  const bag1 = [book()];
  const w1 = new NativeInventoryWindow({ items: () => bag1, wagonItems: () => [], icons: ICONS });
  assert.ok(wagonBtn(w1));
  assert.equal(w1.topBox.rows[0].text, NO_WAGON_TEXT);
  assert.equal(w1.usingWagon, false);
  // with the cart, outside a dungeon: the toggle swaps the REMOTE
  const wagonList = [];
  const bag2 = [cart(), book()];
  const w2 = new NativeInventoryWindow({ items: () => bag2, wagonItems: () => wagonList, icons: ICONS });
  wagonBtn(w2);
  assert.equal(w2.usingWagon, true);
  assert.equal(w2._remote(), wagonList, 'ShowWagon: the wagon IS the remote list');
  wagonBtn(w2);
  assert.equal(w2.usingWagon, false);
  assert.equal(w2._remote(), w2.dropped, 'toggling off restores the default target');
  // inside a dungeon away from the exit: exitTooFar, no toggle
  const w3 = new NativeInventoryWindow({
    items: () => [cart()], wagonItems: () => [], icons: ICONS,
    dungeon: { inside: true, nearExit: () => false },
  });
  wagonBtn(w3);
  assert.equal(w3.topBox.rows[0].text, EXIT_TOO_FAR_TEXT);
  assert.equal(w3.usingWagon, false);
});

test('wagon: CheckWagonAccess - a no-loot dungeon open near the exit lands ON the wagon in Remove', () => {
  const wagonList = [];
  const w = new NativeInventoryWindow({
    items: () => [cart(), book()], wagonItems: () => wagonList, icons: ICONS,
    dungeon: { inside: true, nearExit: () => true },
  });
  assert.equal(w.allowDungeonWagonAccess, true);
  assert.equal(w.usingWagon, true, 'the classic leave-the-haul flow opens on the cart');
  // NT3 (F161): SHOWN, not armed - proximity keeps OnPush's Equip
  // default; only the exit-door PROMPT arm selects Remove (:1084-1088)
  assert.equal(w.mode, 'equip');
  // with a LOOT target the pile stays the remote (the :1094 arm)
  const pile = [book()];
  const wl = new NativeInventoryWindow({
    items: () => [cart()], wagonItems: () => wagonList, icons: ICONS,
    loot: { items: () => pile },
    dungeon: { inside: true, nearExit: () => true },
  });
  assert.equal(wl.allowDungeonWagonAccess, true);
  assert.equal(wl.usingWagon, false);
  assert.equal(wl._remote(), pile);
  // and the button can now toggle to the wagon (access granted)
  wagonBtn(wl);
  assert.equal(wl.usingWagon, true);
  // no cart in the bag: access never grants
  const wn = new NativeInventoryWindow({
    items: () => [book()], wagonItems: () => [], icons: ICONS,
    dungeon: { inside: true, nearExit: () => true },
  });
  assert.equal(wn.allowDungeonWagonAccess, false);
});

test('wagon: the 750kg gates - the refusal, the split-take, the gold clamp', () => {
  // a wagon holding 740kg: 5 more books (2kg each) offered - exactly
  // 5 fit ((750-740)/2); a 400-book stack (800kg) into an empty
  // wagon split-takes 375
  const wagonList = [];
  const bag = [cart(), book(400)];
  const w = new NativeInventoryWindow({ items: () => bag, wagonItems: () => wagonList, icons: ICONS });
  wagonBtn(w);
  w.mode = 'remove';
  // the local list slot 0 is the Book (the cart draws under clothing);
  // click local slot 0 in the 'clothing' tab where both live - use
  // _pick directly on the filtered index instead of raw coords
  w.tab = 'clothing';
  const idx = w._filtered().indexOf(bag[1]);
  assert.ok(idx >= 0);
  w._pick(idx);
  assert.equal(wagonList.length, 1);
  assert.equal(wagonList[0].stackCount, 375, 'ComputeCanHoldAmount: trunc((750-0)*400 / 800) units fit');
  assert.equal(bag[1].stackCount, 25, 'the bag keeps the remainder (the split-take)');
  // the wagon now holds 750kg dead: another book REFUSES with the box
  w._pick(w._filtered().indexOf(bag[1]));
  assert.equal(w.topBox.rows[0].text, CANNOT_HOLD_TEXT, 'cannotHoldAnymore at zero fit');
  assert.equal(wagonList[0].stackCount, 375);
  assert.equal(bag[1].stackCount, 25);
  // the drop-gold clamp: a full wagon takes nothing; a near-full one
  // clamps to the headroom with the wagonFullGold box
  const wagon2 = [book(370)];   // 740 kg
  // E4: the purse the field reads is PlayerEntity.GoldPieces (:1288),
  // not a stack in the bag.
  const bag2 = [cart()];
  const rich = { items: bag2, goldPieces: 100000 };
  const w2 = new NativeInventoryWindow({ items: () => bag2, entity: rich, wagonItems: () => wagon2, icons: ICONS });
  wagonBtn(w2);
  w2._dropGold();
  w2.topBox.onInput('100000');   // 250kg of gold offered into 10kg of headroom
  const goldInWagon = wagon2.find((it) => it.group === 'Currency');
  assert.ok(goldInWagon, 'the clamp still drops what fits');
  assert.equal(goldInWagon.stackCount, 4000, '10kg headroom / 0.0025kg per piece');
  assert.equal(w2.topBox.rows[0].text, wagonFullGoldText(4000), 'the wagonFullGold box names the clamp');
  // THE PROSE ITSELF, not the formatter compared to itself:
  // Internal_Strings.csv:815 "wagonFullGold", String.Format with
  // wagonCanHold at DaggerfallInventoryWindow.cs:1303.
  assert.equal(w2.topBox.rows[0].text, 'Your wagon could only hold 4000 gold pieces.');
  assert.equal(rich.goldPieces, 96000, 'and only the clamped amount left the counter');
});

test('wagon: the collection rides the save envelope', () => {
  const s = readFileSync(new URL('../src/systems/save.js', import.meta.url), 'utf8');
  assert.ok(s.includes('snap.wagonItems = (entity.wagonItems ?? []).map((it) => ({ ...it }));'), 'the snapshot half');
  assert.ok(s.includes('entity.wagonItems = (snap.wagonItems ?? []).map((it) => ({ ...it }));'), 'the restore half (pre-W saves restore empty)');
  // every inventory construction hands the wagon hook
  for (const host of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    const h = readFileSync(new URL(`../${host}`, import.meta.url), 'utf8');
    assert.ok(h.includes('wagonItems: () => (playerEntity.wagonItems ??= [])'), `${host} wires wagonItems`);
  }
  const dc = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
  assert.ok(dc.includes('<= WAGON_ACCESS_DISTANCE'), 'the dungeon host measures the exit-door distance');
});
