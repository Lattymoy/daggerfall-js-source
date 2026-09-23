// MAC-N (2026-09-16, Mac's three bug reports): "1. Weapon and Armorsmiths
// dont want to pay for loot / 2. Classic inventory issues in shops. Item
// inventory is very large, scrollbar not working correctly, submenus are
// completely unclickable / 3. Chat UI not visable with classic in online
// mode". Three roots, none of them where the report points:
//
//   N1  the corpse's ARMOR was minted without SetItem's value (the
//       weapon beside it had one), so the staged lot summed to NaN and
//       the smith offered 0 - at exactly the two shops that buy armor.
//   N2  DaggerfallTradeWindow EXTENDS the inventory window and inherits
//       its four TAB PAGES, its wheel and its thumb drag; the port's
//       shop screen had none of the three, so the local list was the
//       whole pack in one column and the painted tabs answered nothing.
//   N3  main.js decided `?online` on an in-memory copy of the params and
//       never wrote it to the URL, which is the ONE read under uiSkin,
//       getPref and modSetting - so the online lane OL1 records was dead
//       for the Play Online button, a Classic player played online on the
//       classic skin, and the chat is the enhanced skin's.
//
// The pins are aimed at the producers and the populations (TEST THE
// SHAPE THE PRODUCER MINTS; ONE DFU MEMBER, ONE EXPORT), not at the one
// line each fix landed on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setItemFields, itemBaseValue, templateByIndex, mintCondition } from '../src/systems/itemTemplates.js';
import { createWeapon, bowDamageArrow, assignEnemyEquipment, equipmentItems, ARMOR_ENUM, WEAPONS_ENUM } from '../src/combat/enemyEquipment.js';
import { stacksWith, isEnchanted } from '../src/systems/inventory.js';
import { tradeCost } from '../src/systems/tradeModes.js';
import { NativeTradeWindow, TRADE_RECTS, initialTradeTab, _setTradeArtForTests } from '../src/ui/nativeTrade.js';
import { INV_RECTS, TABS, tabAccepts, filterByTab, NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { scrollerHit, scrollThumbSpan, beginScrollerDrag, dragScrollerIndex, LIST_SLOTS, SCROLLBAR_Y, SCROLLBAR_H } from '../src/ui/itemScroller.js';
import { dragScrollIndex } from '../src/ui/verticalScrollBar.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';
import { publishBootParams, BOOT_DOOR_KEYS, isOnlinePage } from '../src/systems/onlineLane.js';
import { uiSkin } from '../src/systems/uiSkin.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { FNT_ASCII_START } from '../src/formats/fntFile.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
};
const SRC = walk(join(root, 'src')).map((p) => [p.slice(root.length + 1), readFileSync(p, 'utf8')]);
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const spyAudio = (fn) => {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { return fn(played); } finally { audio.playOneShot = orig; }
};

/** A smith's Sell window over `pack` - accepts Armor and Weapons, the two groups an armorer and a weaponsmith buy. */
const smithHooks = (mode, pack, shelf = []) => ({
  mode,
  shelfItems: () => shelf,
  packItems: () => pack,
  accepts: (it) => it.group === 'Armor' || it.group === 'Weapons',
  enchanted: (it) => isEnchanted(it),
  priceCtx: () => ({ quality: 10, skills: { mercantile: 50, personality: 50 } }),
  gold: () => 1000,
  rows: (id) => [{ text: `#${id}`, center: true }],
  weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
  commit: () => {},
  icons: ICONS,
});
const LOCAL_SLOT0 = [192, 48 + 20];
const REMOTE_SLOT0 = [290, 48 + 20];
const MODE_ACTION = [226 + 15, 134 + 7];
const dagger = (name = 'Dagger') => ({ group: 'Weapons', templateIndex: WEAPONS_ENUM.Dagger, name, value: 40 });

// ─────────────────────────────────────────────────────────────────
// N1  the smith pays for loot again
// ─────────────────────────────────────────────────────────────────

test('MAC-N1: setItemFields is SetItem\'s name and value - filled from the template and the material, and never overwriting what an item already carries', () => {
  const plate = setItemFields({ group: 'Armor', templateIndex: ARMOR_ENUM.Cuirass, material: 0x0202 });
  assert.equal(plate.name, templateByIndex(ARMOR_ENUM.Cuirass).name);
  assert.equal(plate.value, itemBaseValue({ group: 'Armor', templateIndex: ARMOR_ENUM.Cuirass, material: 0x0202 }), 'SetItem\'s basePrice through the material band (ItemBuilder.cs:649)');
  assert.ok(plate.value > templateByIndex(ARMOR_ENUM.Cuirass).basePrice, 'and a plate piece is worth more than the leather basePrice');
  const own = setItemFields({ group: 'Armor', templateIndex: ARMOR_ENUM.Cuirass, material: 0x0202, name: 'Aegis', value: 9999 });
  assert.equal(own.name, 'Aegis', 'an item minted with its own name keeps it');
  assert.equal(own.value, 9999, 'and its own value - an enchantment\'s sum, a book\'s price');
  const src = { group: 'Armor', templateIndex: ARMOR_ENUM.Helm, material: 0 };
  assert.notEqual(setItemFields(src), src, 'a COPY, as the five copies it replaced answered');
});

test('MAC-N1: a corpse\'s armor is minted with SetItem\'s name and value - the shape the trade window reads raw', () => {
  const entity = { isClass: true, mobileType: 128, careerIndex: 0, armor: 0 };
  // variant 1: a Claymore..Battle Axe right hand and a 75% roll on each of six body pieces; roll 0 lands all six
  const eq = assignEnemyEquipment(entity, 1, 1, seq(0));
  const items = equipmentItems(eq);
  assert.equal(items.length, 7, 'the blade and six pieces');
  for (const it of items) {
    assert.equal(typeof it.name, 'string', `${it.group} ${it.templateIndex} has a name`);
    assert.ok(Number.isFinite(it.value) && it.value > 0, `${it.name} carries a finite value`);
    assert.equal(it.value, itemBaseValue(it), `${it.name}: SetItem's basePrice through the material band`);
    assert.ok(it.maxCondition > 0, `${it.name}: and AUDIT 58's condition still mints`);
  }
  assert.equal(items.filter((it) => it.group === 'Armor').length, 6);
});

test('MAC-N1: the smith PAYS for a corpse\'s cuirass - the staged lot totals a finite price, and the pre-fix shape shows why it did not', () => {
  const eq = assignEnemyEquipment({ isClass: true, mobileType: 128, careerIndex: 0, armor: 0 }, 1, 1, seq(0));
  const loot = equipmentItems(eq);
  const w = new NativeTradeWindow(smithHooks('Sell', loot));
  assert.equal(w.localList().length, 7, 'an armorer takes every piece - Armor and Weapons, on the Weapons & Armor page');
  w.click(...LOCAL_SLOT0);   // the blade
  w.click(...LOCAL_SLOT0);   // then the first armor piece
  assert.equal(w.remoteList().length, 2);
  assert.ok(w.remoteList().some((it) => it.group === 'Armor'), 'a cuirass is in the deal');
  const { cost, modeActionEnabled } = w.cost();
  assert.ok(Number.isFinite(cost) && cost > 0, `the strip totals a number, not NaN: ${cost}`);
  assert.ok(modeActionEnabled);
  w.click(...MODE_ACTION);
  assert.equal(w.box?.buttons, 'YesNo', 'an offer is made');
  assert.ok(w.box.price > 0, `and it is for gold: ${w.box.price}`);

  // THE DISCRIMINATING HALF, re-aimed by JAN1: the shape the corpse used to mint - condition, no value - priced the
  // WHOLE lot at NaN and the offer at 0 (the bug, reproduced through the same window). Every price arm reads
  // `itemValueOf` now (Janome's COST:NaN, a save from before this fix), so the valueless piece prices at its BASE and
  // the lot at the number the set lot answers - the window can no longer print NaN whatever the minter did.
  const bare = [createWeapon(WEAPONS_ENUM.Claymore, 0), mintCondition({ group: 'Armor', templateIndex: ARMOR_ENUM.Cuirass, material: 0 })];
  const before = tradeCost('Sell', bare, { quality: 10 });
  const set = tradeCost('Sell', bare.map((it) => setItemFields(it)), { quality: 10 });
  assert.ok(Number.isFinite(before.cost) && before.cost > 0, `a valueless piece prices at its base, never NaN: ${before.cost}`);
  assert.equal(before.cost, set.cost, 'the same number the set lot answers');
  const b = new NativeTradeWindow(smithHooks('Sell', bare));
  b.click(...LOCAL_SLOT0); b.click(...LOCAL_SLOT0);
  b.click(...MODE_ACTION);
  assert.ok(b.box?.price > 0, `and the smith pays: ${b.box?.price}`);
});

test('MAC-N1: every Armor mint in the tree goes through SetItem\'s writes, and the value law has ONE home', () => {
  // the population: no `mintCondition({ group: 'Armor'` without setItemFields in front of it
  const bareArmor = SRC.filter(([, s]) => /mintCondition\(\{\s*group: 'Armor'/.test(s)).map(([p]) => p);
  assert.deepEqual(bareArmor, [], 'an Armor record minted with a condition and no value');
  const through = SRC.filter(([, s]) => /mintCondition\(setItemFields\(\{\s*group: 'Armor'/.test(s)).map(([p]) => p).sort();
  assert.deepEqual(through, ['src/combat/enemyEquipment.js', 'src/combat/rriEnemyEquipment.js', 'src/scenes/worldModes.js', 'src/systems/createItem.js', 'src/systems/testRoom.js'],
    'the corpse, the knightly gift, the Create Item spell and the test room - the four sites that minted armor bare or by hand (RRI2: and the mod\'s enemy kit, through the same export)');
  // ONE home for `value ?? itemBaseValue` as a MINT (readers - itemInfo's %wth, the keyed shelf's itemValue - may fall back)
  const copies = SRC.filter(([p, s]) => p !== 'src/systems/itemTemplates.js' && /value: item\.value \?\? itemBaseValue\(item\)/.test(s)).map(([p]) => p);
  assert.deepEqual(copies, [], 'the five private copies of SetItem\'s value write are gone');
  assert.match(rd('src/systems/itemTemplates.js'), /export function setItemFields\(item\) \{\s*const named = \{ \.\.\.item, name: item\.name \?\? templateByIndex\(item\.templateIndex\)\?\.name \};[\s\S]{0,700}?return \{\s*\.\.\.named,\s*\.\.\.\(variant \? \{ \.\.\.variant, rriVariant: true \} : \{\}\),\s*[^\n]*\n[^\n]*\n\s*value: itemValueOf\(named\),\s*\};\s*\}/, 'JAN1: the value write reads through itemValueOf - a non-finite saved value is an absent one (AUDIT-RR F5: priced BEFORE the class\'s variant fold, as ApplyArmorMaterial runs before SetVariant)');
});

test('MAC-N1: the recovered arrow is CreateWeapon\'s arrow with stackCount 1 (EnemyAttack.cs:145-147), minted by ONE export at every host', () => {
  const a = bowDamageArrow();
  assert.equal(a.group, 'Weapons');
  assert.equal(a.templateIndex, 131);
  assert.equal(a.stackCount, 1, 'DFU overwrites the arm\'s random stack with 1');
  assert.equal(a.value, templateByIndex(131).basePrice, 'an arrow is worth its basePrice, no material band (AUDIT 17e F14)');
  assert.equal(a.currentCondition, 0, 'the arrow arm\'s own write');
  assert.equal(a.name, templateByIndex(131).name);
  assert.ok(stacksWith(a, createWeapon(131, 0)), 'it merges into a quiver the loot minted');
  assert.ok(stacksWith(a, bowDamageArrow()), 'and into one begun by another recovered shaft');
  // the population: the bare literal that stood at seven sites is gone from the tree
  const literal = SRC.filter(([, s]) => /name: 'Arrow', templateIndex: 131, material: 0, stackCount: 1/.test(s)).map(([p]) => p);
  assert.deepEqual(literal, [], 'a recovered arrow spelt as a literal with no value');
  const sites = SRC.filter(([, s]) => /addItem\([^)]*, bowDamageArrow\(\)\)/.test(s)).map(([p]) => p).sort();
  assert.deepEqual(sites, [
    'src/combat/arrowFlight.js', 'src/scenes/dungeonContext.js', 'src/scenes/exterior.js',
    'src/scenes/exteriorFoes.js', 'src/scenes/world.js', 'src/scenes/worldModes.js',
  ], 'the seven sites across six files, every one on the minter');
});

// ─────────────────────────────────────────────────────────────────
// N2  the shop screen's inherited half
// ─────────────────────────────────────────────────────────────────

test('MAC-N2: the trade window carries the parent\'s four tab rects and opens on WeaponsAndArmor - MagicItems for Identify (DaggerfallTradeWindow.cs:253)', () => {
  for (const k of ['tabWeapons', 'tabMagic', 'tabClothing', 'tabIngredients']) assert.deepEqual([...TRADE_RECTS[k]], [...INV_RECTS[k]], k);
  assert.deepEqual([...TRADE_RECTS.tabWeapons], [0, 0, 92, 10]);
  for (const mode of ['Buy', 'Sell', 'SellMagic', 'Repair']) {
    assert.equal(initialTradeTab(mode), 'weapons', mode);
    assert.equal(new NativeTradeWindow(smithHooks(mode, [])).tab, 'weapons', mode);
  }
  assert.equal(initialTradeTab('Identify'), 'magic');
  assert.equal(new NativeTradeWindow(smithHooks('Identify', [])).tab, 'magic');
});

test('MAC-N2: the local list is the tab page\'s - AddLocalItem over the pack AND the basket - and a tab click switches it, resets the scroll and clicks', () => {
  const book = { group: 'Books', templateIndex: 277, name: 'Book', value: 40 };
  const herb = { group: 'PlantIngredients1', templateIndex: 5, name: 'Turquoise', value: 10 };
  const ench = { group: 'Weapons', templateIndex: 113, name: 'Glowing Dagger', value: 400, enchantments: [{ type: 1, param: 1 }] };
  const pack = [dagger(), book, herb, ench];
  const shelfBook = { group: 'Books', templateIndex: 277, name: 'Shelf Book', value: 40 };
  const shelf = [shelfBook];
  const w = new NativeTradeWindow({ ...smithHooks('Buy', pack, shelf), accepts: () => true });
  assert.deepEqual(w.localList().map((i) => i.name), ['Dagger'], 'Weapons & Armor: the dagger alone, out of four');
  // tabAccepts IS the parent's AddLocalItem - on every page the shop's local list is the pack's filterByTab
  for (const t of TABS) { w.tab = t; assert.deepEqual(w.localList().map((i) => i.name), filterByTab(pack, t).map((i) => i.name), t); }
  w.tab = 'weapons';
  // the basket goes through the same filter, and comes FIRST on its page (:677-686)
  w.click(...REMOTE_SLOT0);
  assert.equal(w.basket.length, 1, 'the shelf book is in the basket');
  assert.deepEqual(w.localList().map((i) => i.name), ['Dagger'], 'a basketed book is not on the Weapons & Armor page');
  w.localScroll = 3;
  spyAudio((played) => {
    assert.ok(w.click(INV_RECTS.tabClothing[0] + 5, 5), 'the Clothing & Misc tab is a live button');
    assert.deepEqual(played, [SOUND.ButtonClick], 'and it clicks (:1209-1227)');
  });
  assert.equal(w.tab, 'clothing');
  assert.equal(w.localScroll, 0, 'SelectTabPage resets the local scroller (:820)');
  assert.deepEqual(w.localList().map((i) => i.name), ['Shelf Book', 'Book'], 'the basket first, then the pack, both on the page');
  assert.ok(w.click(INV_RECTS.tabIngredients[0] + 5, 5));
  assert.deepEqual(w.localList().map((i) => i.name), ['Turquoise']);
  assert.ok(w.click(INV_RECTS.tabMagic[0] + 5, 5));
  assert.deepEqual(w.localList().map((i) => i.name), ['Glowing Dagger']);
  assert.ok(w.click(INV_RECTS.tabWeapons[0] + 5, 5));
  assert.deepEqual(w.localList().map((i) => i.name), ['Dagger']);
  assert.equal(w.basket.length, 1, 'the basket is untouched by a page change');
  // the remote list is NOT tab-filtered - FilterRemoteItems is a flat list (:951-953)
  assert.equal(w.remoteList().length, 0, 'the shelf book is in the basket, and the shelf shows what is left');
});

test('MAC-N2: tabAccepts is AddLocalItem verbatim, and filterByTab is FilterLocalItems over it', () => {
  const items = [
    { group: 'Weapons', templateIndex: 113 }, { group: 'Armor', templateIndex: 102 },
    { group: 'Weapons', templateIndex: 113, enchantments: [{ type: 1 }] },
    { group: 'MiscItems', templateIndex: 132 },   // the spellbook rides Magic Items
    { group: 'PlantIngredients1', templateIndex: 5 }, { group: 'Books', templateIndex: 277 },
    { group: 'Weapons', templateIndex: 113, equipSlot: 5 },
  ];
  const on = (t) => items.filter((i) => tabAccepts(i, t)).length;
  assert.equal(on('weapons'), 3, 'weapon, armor and the WORN weapon - tabAccepts does not know about equipment');
  assert.equal(on('magic'), 2);
  assert.equal(on('ingredients'), 1);
  assert.equal(on('clothing'), 1);
  assert.equal(filterByTab(items, 'weapons').length, 2, 'FilterLocalItems drops the worn one first');
  assert.match(rd('src/ui/nativeInventory.js'), /export function filterByTab\(items, tab\) \{\s*return items\.filter\(\(it\) => \{\s*if \(isEquipped\(it\)\) return false;[^\n]*\n\s*return tabAccepts\(it, tab\);/,
    'one law, read by both windows');
});

test('MAC-N2: the four tab hotkeys work on the shop screen, in the parent\'s add order ahead of the action panel and the exit', () => {
  const w = new NativeTradeWindow(smithHooks('Buy', [dagger()]));
  w.input('F4'); assert.equal(w.tab, 'ingredients', 'InventoryIngredients');
  w.input('F2'); assert.equal(w.tab, 'magic', 'InventoryMagic');
  w.input('F3'); assert.equal(w.tab, 'clothing', 'InventoryClothing');
  w.input('F1'); assert.equal(w.tab, 'weapons', 'InventoryWeapons');
  assert.equal(w.done, false, 'none of them closed anything');
  assert.match(rd('src/ui/nativeTrade.js'), /const hit = firstHotkey\(\[\s*\.\.\.Object\.keys\(TAB_BUTTONS\),\s*\.\.\.\(this\.mode === 'Buy' \? \['TradeSteal'\] : \[\]\),\s*\.\.\.\(action \? \[action\] : \[\]\),\s*'TradeClear',\s*'TradeExit',\s*\], code, e\);/,
    'SetupTabPageButtons (:228) before SetupActionButtons (:229) before the exit button (:249)');
  w.input('KeyX'); assert.equal(w.done, true, 'and exit is still X at the tail');
});

test('MAC-N2: the wheel scrolls the list under the notch one row, on either list, on the rail, not on an arrow, not off the lists, not under a box', () => {
  const pack = Array.from({ length: 6 }, (_, i) => dagger(`D${i}`));
  const shelf = Array.from({ length: 6 }, (_, i) => dagger(`S${i}`));
  const w = new NativeTradeWindow(smithHooks('Buy', pack, shelf));
  spyAudio((played) => {
    w.wheel(1, ...LOCAL_SLOT0);
    assert.equal(w.localScroll, 1, 'one row per notch');
    w.wheel(1, ...LOCAL_SLOT0);
    assert.equal(w.localScroll, 2);
    w.wheel(-1, ...LOCAL_SLOT0);
    assert.equal(w.localScroll, 1, 'and back');
    assert.equal(w.remoteScroll, 0, 'the other list never moved');
    w.wheel(1, ...REMOTE_SLOT0);
    assert.equal(w.remoteScroll, 1, 'the notch picks the list');
    w.wheel(1, TRADE_RECTS.localList[0] + 4, TRADE_RECTS.localList[1] + SCROLLBAR_Y + 30);
    assert.equal(w.localScroll, 2, 'the rail carries the wheel (VerticalScrollBar.cs:152-162)');
    w.wheel(1, TRADE_RECTS.localList[0] + 4, TRADE_RECTS.localList[1] + 5);
    assert.equal(w.localScroll, 2, 'an arrow Button overrides no scroll handler');
    w.wheel(1, 10, 100);
    w.wheel(1);
    w.wheel(1, -1, -1);
    assert.equal(w.localScroll, 2, 'off both lists, with no point, and on the leave sentinel: nothing');
    assert.deepEqual(played, [], 'the wheel is silent - the ButtonClick is the two arrows\' alone');
  });
  w.box = { rows: [{ text: 'x' }], buttons: null };
  w.wheel(1, ...LOCAL_SLOT0);
  assert.equal(w.localScroll, 2, 'a pushed box owns the pointer');
});

test('MAC-N2: the thumb DRAGS (VerticalScrollBar.Update :101-130) - latched on the press, following the held button, dropped on the release', () => {
  const pack = Array.from({ length: 12 }, (_, i) => dagger(`D${i}`));
  const w = new NativeTradeWindow(smithHooks('Sell', pack));
  const [lx, ly] = TRADE_RECTS.localList;
  const span = scrollThumbSpan(0, 12);
  assert.deepEqual(span, { y: 0, h: SCROLLBAR_H * (LIST_SLOTS / 12) }, 'the fixture\'s thumb: the top 39px of the bar');
  const thumbY = ly + SCROLLBAR_Y + 5;
  assert.equal(scrollerHit(TRADE_RECTS.localList, lx + 4, thumbY, 0, 12).kind, 'thumb');
  assert.ok(w.click(lx + 4, thumbY), 'the press is the bar\'s');
  assert.equal(w.localScroll, 0, 'and a press on the thumb moves nothing by itself (MouseClick has no arm for it)');
  assert.ok(w._drag, 'but it LATCHED');
  // the drag arm, as DFU computes it: scale = barH / TOTAL units, (int) truncation, clamped
  w.hover(lx + 4, thumbY + 40, { buttons: 1 });
  assert.equal(w.localScroll, dragScrollIndex(45, 5, 0, SCROLLBAR_H, 12, LIST_SLOTS));
  assert.equal(w.localScroll, 4, '40px at 9.75px a unit is 4 rows, toward zero');
  w.hover(lx + 200, thumbY + 400, { buttons: 1 });
  assert.equal(w.localScroll, 8, 'off the bar entirely, still dragging (DFU keeps the latch wherever the cursor goes) - and clamped');
  w.hover(lx + 4, thumbY + 20, { buttons: 0 });
  assert.equal(w._drag, null, 'the frame the button reads up, the latch drops (:123-129)');
  assert.equal(w.localScroll, 8, 'and that frame moves nothing');
  w.hover(lx + 4, thumbY, { buttons: 1 });
  assert.equal(w.localScroll, 8, 'a held button with no latch is not a drag');
  // the release edge the hosts send on mouseup (ROAD-E E1), for a release with no move to carry it
  w.click(lx + 4, ly + SCROLLBAR_Y + scrollThumbSpan(8, 12).y + 3);
  assert.ok(w._drag);
  w.release();
  assert.equal(w._drag, null);
  // a hover with no event cannot read the button: the latch waits
  w.click(lx + 4, ly + SCROLLBAR_Y + scrollThumbSpan(8, 12).y + 3);
  w.hover(lx + 4, thumbY);
  assert.ok(w._drag, 'no event, no verdict');
  // the shared arithmetic is the scroller's own
  const latch = beginScrollerDrag(TRADE_RECTS.localList, thumbY, 0);
  assert.deepEqual(latch, { rect: TRADE_RECTS.localList, startY: 5, startIndex: 0 });
  assert.equal(dragScrollerIndex(latch, thumbY + 40, 12), 4);
});

test('MAC-N2: the pack\'s thumb drags too - the same latch on the classic inventory, and its release', () => {
  const bag = Array.from({ length: 12 }, (_, i) => ({ group: 'Weapons', templateIndex: 113, name: `D${i}` }));
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS });
  const [lx, ly] = INV_RECTS.localList;
  const thumbY = ly + SCROLLBAR_Y + 5;
  assert.ok(w.click(lx + 4, thumbY));
  assert.ok(w._drag && w._drag.which === 'scroll');
  w.hover(lx + 4, thumbY + 40, { buttons: 1 });
  assert.equal(w.scroll, 4);
  w.hover(lx + 4, thumbY + 40, { buttons: 0 });
  assert.equal(w._drag, null);
  w.click(lx + 4, ly + SCROLLBAR_Y + scrollThumbSpan(4, 12).y + 3, true);
  assert.equal(w._drag, null, 'a RIGHT press latches nothing - GetMouseButton(0) is button 0');
  w.click(lx + 4, ly + SCROLLBAR_Y + scrollThumbSpan(4, 12).y + 3);
  assert.ok(w._drag);
  w.release();
  assert.equal(w._drag, null);
});

test('MAC-N2: the selected tab is drawn as the INVE01I0 cutout over the base, and the art loads the gold sheet', () => {
  const calls = [];
  const renderer = { drawScreenQuad: (tex, dst, src) => calls.push({ tex, dst, src }) };
  const img = (tex) => ({ tex, w: 320, h: 200 });
  _setTradeArtForTests({ base: img('base'), gold: img('gold'), cost: img('cost'), panels: new Map(), font4: null });
  try {
    const chars = [];
    const font = { tex: null, fnt: { fixedHeight: 6, glyphWidth: (gi) => { chars.push(String.fromCharCode(gi + FNT_ASCII_START)); return 4; } } };
    const w = new NativeTradeWindow(smithHooks('Buy', []));
    w.tab = 'clothing';
    w.draw(renderer, { width: 640, height: 400 }, font);
    const gold = calls.filter((c) => c.tex === 'gold');
    assert.equal(gold.length, 1, 'one cutout');
    const [x, y, cw, ch] = INV_RECTS.tabClothing;
    assert.deepEqual(gold[0].dst, { x: x * 2, y: y * 2, w: cw * 2, h: ch * 2 }, 'at the tab\'s own rect, at the 2x metrics of a 640x400 canvas');
    assert.deepEqual(gold[0].src, { u0: x / 320, v0: y / 200, u1: (x + cw) / 320, v1: (y + ch) / 200 }, 'the SUBRECT of the sheet, not the whole of it');
    assert.ok(calls.findIndex((c) => c.tex === 'base') < calls.indexOf(gold[0]), 'over the base');
  } finally { _setTradeArtForTests(null); }
  assert.match(rd('src/ui/nativeTrade.js'), /loadImg\(deps, 'INVE01I0\.IMG'\)/, 'goldTexture (:757) is loaded with the rest');
});

test('MAC-N2: every host that hands a window its pointer hands the trade window the event and the release it drags by', () => {
  // the interior host and the dungeon slot: hover(vx, vy, e) and release() on 'up' (ROAD-E E1's seams, now load-bearing for two more windows)
  assert.match(rd('src/scenes/worldModes.js'), /interiorOverlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/);
  assert.match(rd('src/scenes/worldModes.js'), /interiorOverlay\.release\?\.\(\);/);
  assert.match(rd('src/scenes/dungeonContext.js'), /overlayHover\(vx, vy, e = null\) \{ activeOverlay\?\.hover\?\.\(vx, vy, e\); \}/);
  assert.match(rd('src/scenes/dungeonContext.js'), /if \(phase === 'up'\) activeOverlay\?\.release\?\.\(\);/);
  assert.match(rd('src/scenes/townTalk.js'), /overlay\.hover\(v \? v\[0\] : -1, v \? v\[1\] : -1, e\);/);
  assert.match(rd('src/scenes/townTalk.js'), /if \(phase === 'up'\) overlay\.release\?\.\(\);/);
  // and the wheel reaches the interior slot with its point
  assert.match(rd('src/scenes/worldModes.js'), /interiorOverlay\.wheel\?\.\(Math\.sign\(e\.deltaY\), v \? v\[0\] : -1, v \? v\[1\] : -1\);/);
});

// ─────────────────────────────────────────────────────────────────
// N3  the boot's params are the URL
// ─────────────────────────────────────────────────────────────────

const fakePage = (search = '', pathname = '/play/', hash = '') => {
  const writes = [];
  const location = { pathname, search, hash };
  const history = { state: { s: 1 }, replaceState: (state, title, url) => { writes.push({ state, title, url }); location.search = url.includes('?') ? url.slice(url.indexOf('?')) : ''; } };
  return { writes, location, history };
};

test('MAC-N3: publishBootParams writes the decided params to the URL - the keys the door set, the bare spelling for an empty value, the hash kept', () => {
  const page = fakePage('', '/play/', '#x');
  const params = new URLSearchParams('');
  params.set('load', '1'); params.set('online', '1'); params.set('loadkey', '3'); params.set('classic', '1');
  const search = publishBootParams(params, page);
  assert.equal(search, '?load=1&online=1&loadkey=3&classic=1');
  assert.deepEqual(page.writes, [{ state: { s: 1 }, title: '', url: '/play/?load=1&online=1&loadkey=3&classic=1#x' }]);
  assert.equal(publishBootParams(new URLSearchParams('world=&spawn=random&novideo='), fakePage()), '?world&spawn=random&novideo', 'the menu\'s own test door spelling');
  assert.equal(publishBootParams(new URLSearchParams(''), fakePage('?x=1')), '', 'nothing decided is an empty search');
});

test('MAC-N3: the URL it writes is the URL the lane reads - Play Online is online, and the skin is the lane\'s over a stored Classic', () => {
  _resetForTests();
  setPref('skin', 'classic');
  try {
    const page = fakePage('?skin=classic');
    const params = new URLSearchParams('skin=classic');
    params.set('online', '1'); params.set('load', '1');
    const search = publishBootParams(params, page);
    assert.equal(page.location.search, search, 'the page now carries what the door decided');
    assert.equal(isOnlinePage(search), true);
    assert.equal(uiSkin(search), 'enhanced', 'OL1: online is the enhanced lane, over the stored choice');
    // the other door: every other choice DELETES it, and the lane reads offline again
    params.delete('online');
    const off = publishBootParams(params, page);
    assert.equal(isOnlinePage(off), false);
    assert.equal(uiSkin(off), 'classic', 'offline: the player\'s own shelf');
  } finally { _resetForTests(); }
});

test('MAC-N3: an equal URL is not rewritten, a history that refuses is warned about and survived, and a page with no History API is left alone', () => {
  const page = fakePage('?load=1');
  assert.equal(publishBootParams(new URLSearchParams('load=1'), page), '?load=1');
  assert.deepEqual(page.writes, [], 'no write for no change');
  const warned = [];
  const orig = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    const refusing = { location: { pathname: '/p', search: '', hash: '' }, history: { state: null, replaceState: () => { throw new Error('SecurityError'); } } };
    assert.equal(publishBootParams(new URLSearchParams('online=1'), refusing), '?online=1', 'the search is still answered');
    assert.equal(warned.length, 1, 'and the loss is said');
    assert.match(warned[0], /online lane/);
  } finally { console.warn = orig; }
  assert.equal(publishBootParams(new URLSearchParams('online=1'), { history: undefined, location: undefined }), '?online=1', 'node has neither: no throw');
});

test('MAC-N3: main.js publishes before BOTH world boots the front door reaches, and clears the decided keys before the menu decides them', () => {
  const main = rd('src/main.js');
  const before = main.match(/publishBootParams\(params\);[^\n]*\n\s*return bootWorld\(canvas, renderer, params, status\);/g) ?? [];
  assert.equal(before.length, 2, 'the enhanced menu\'s door and the classic Begin door');
  assert.match(main, /for \(const k of BOOT_DOOR_KEYS\) params\.delete\(k\);\s*\n\s*publishBootParams\(params\);\s*\n\s*const \{ runEnhancedMenu \} = await import\('\.\/ui\/enhancedMenu\.js'\);/,
    'a stale ?online off a previous session\'s URL must not lock the Mods pane of a player who has not chosen yet');
  // BOOT_DOOR_KEYS is exactly the set main.js decides per choice - derived from the source, not listed twice
  const decided = [...new Set([...main.matchAll(/params\.(?:set|delete)\('(\w+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(decided, [...BOOT_DOOR_KEYS].sort());
});

test('MAC-N3: the chat is the enhanced skin\'s, and the skin it asks is the lane\'s read - which is why the URL had to carry the flag', () => {
  const world = rd('src/scenes/world.js');
  assert.match(world, /const enhanced = isEnhanced\(\);/);
  assert.match(world, /if \(enhanced && typeof document !== 'undefined'\) chatStart\(\);/);
  assert.match(rd('src/systems/uiSkin.js'), /return onlineForcedPref\('skin', search\) \?\? skinOverride\(search\)/);
  assert.match(rd('src/systems/onlineLane.js'), /export const isOnlinePage = \(search = globalThis\.location\?\.search \?\? ''\) => new URLSearchParams\(search\)\.has\('online'\);/,
    'the one read, off location.search - the copy main.js edits is not it');
});
