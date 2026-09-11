// AUDIT 64 - THE INVENTORY WINDOW's dropped input bits and its
// missing cell/panel laws.
//
// Eight findings, all against DaggerfallInventoryWindow and the shared
// ItemListScroller (MIT, Daggerfall Workshop):
//
//  F47 GetActionModeRightClick (:1871-1882) had no port - a right
//      click on either list, the paperdoll or an accessory button ran
//      the LEFT mode, and a right click on Exit/a tab/an action button
//      pressed it, where DFU binds no right handler there at all.
//  F48 the window's shared defaultToolTip (:368/:383/:470/:547) was
//      never built, so nothing on the classic screen named a slot.
//  F49 ShowInfoPopup's FIRST arm (:1602-1609) - a potion recipe chains
//      a second box of its ingredient names - was unported.
//  F50 the MIDDLE button's NextVariant (:379/:394/:469) was unported,
//      and fell through to the left-click bodies.
//  F51 UpdateItemInfoPanel's three shortenings (:1142-1152) were
//      unported, so the 37px panel showed the popup's long words.
//  F52 ItemsListPanel_OnMouseScrollUp/Down (ItemListScroller.cs
//      :314-316, :606-616) had no port - the wheel reached the window
//      and was dropped.
//  F53 ItemBackgroundColourHandler (:401-411) was unported, so a lit
//      torch, a quest letter and a summoned item drew like any loot.
//  F54 DoTransferItem's AddPosition.Front for a quest item
//      (:1573-1579) was unported - a taken quest item was appended.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { NativeInventoryWindow, INV_RECTS, ACCESSORY_RECTS, goldPanelRows } from '../src/ui/nativeInventory.js';
import { NativeTradeWindow, TRADE_RECTS, REPAIR_ITEM_BG } from '../src/ui/nativeTrade.js';
import {
  CELL_X, SLOT_H, CELL_W, LIST_SLOTS, ARROW_H, DOWN_ARROW_Y,
  itemBackgroundColour, drawCellBackground,
  QUEST_ITEM_BG, LIGHT_SOURCE_BG, SUMMONED_ITEM_BG,
} from '../src/ui/itemScroller.js';
import {
  infoPanelShorten, itemInfoRows, itemInfoPanelRows,
  PANEL_KG_SRC, PANEL_KG_REP, PANEL_DAM_SRC, PANEL_DAM_REP, PANEL_AR_SRC, PANEL_AR_REP,
} from '../src/systems/itemInfo.js';
import { addItem } from '../src/systems/inventory.js';
import { applyTransfer } from '../src/systems/itemTransfer.js';
import { POTION_RECIPES, potionRecipeKey } from '../src/systems/potions.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { EQUIP_SLOTS, equipOf } from '../src/systems/equip.js';
import { audio } from '../src/systems/audio.js';
import { SOUND } from '../src/systems/soundClips.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const dagger = (extra = {}) => ({ group: 'Weapons', templateIndex: 113, name: 'Dagger', ...extra });
const shirt = () => ({ group: 'MensClothing', templateIndex: 202, name: 'Short shirt', variant: 0 });
/** liveStat reads .stats; a strength gives the carry gate a real
 *  MaxEncumbrance so a take is not refused for weight. */
const hero = (items = []) => { const e = { stats: { strength: 80 }, items }; equipOf(e); return e; };
/** ItemEquipTable.EquipTable[slot] = item, without the equip ladder. */
const wear = (entity, item, slot) => { equipOf(entity).slots[slot] = item; item.equipSlot = slot; return item; };

const LOCAL_SLOT = (s = 0) => [INV_RECTS.localList[0] + CELL_X + 5, INV_RECTS.localList[1] + s * SLOT_H + 5];
const REMOTE_SLOT = (s = 0) => [INV_RECTS.remoteList[0] + CELL_X + 5, INV_RECTS.remoteList[1] + s * SLOT_H + 5];
const LOCAL_RAIL = () => [INV_RECTS.localList[0] + 3, INV_RECTS.localList[1] + 60];
const LOCAL_UP_ARROW = () => [INV_RECTS.localList[0] + 3, INV_RECTS.localList[1] + 3];

const spyAudio = (fn) => {
  const played = [];
  const orig = audio.playOneShot;
  audio.playOneShot = (i) => { played.push(i); return 0.1; };
  try { fn(played); } finally { audio.playOneShot = orig; }
};

// ── F47: GetActionModeRightClick ──────────────────────────────────

test('AUDIT 64 F47: the right-click mode swap is Equip<->Remove, everything else unchanged', () => {
  // DaggerfallInventoryWindow.cs:1871-1882 - Equip->Remove,
  // Remove->Equip, Select->Remove, all other modes returned as they
  // are. (Select has no port: MODES carries no select mode, and DFU
  // sets ActionModes.Select only in DaggerfallTradeWindow.)
  const w = new NativeInventoryWindow({ items: () => [], icons: ICONS });
  const swapped = {};
  for (const m of ['wagon', 'info', 'equip', 'remove', 'use', 'gold']) {
    w.mode = m;
    swapped[m] = w._rightMode();
  }
  assert.deepEqual(swapped, {
    wagon: 'wagon', info: 'info', equip: 'remove', remove: 'equip', use: 'use', gold: 'gold',
  });
});

test('AUDIT 64 F47: a right click on the LOCAL list runs the swapped mode', () => {
  // LocalItemListScroller_OnItemRightClick (:2015-2018) hands
  // GetActionModeRightClick() to the same OnItemClick the left
  // handler feeds selectedActionMode - so in EQUIP mode a right click
  // takes the Remove arm (:1993-2004: transfer to remoteItems).
  const it = dagger();
  const bag = [it];
  const pile = [];
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, entity: hero(bag), loot: { items: () => pile },
  });
  w.mode = 'equip';
  w.click(...LOCAL_SLOT(0), true);
  assert.deepEqual(bag, [], 'the right click STORED the dagger rather than equipping it');
  assert.deepEqual(pile, [it], 'and the remote list holds it');
});

test('AUDIT 64 F47: a right click on the REMOTE list takes AND equips, the ladder included', () => {
  // RemoteItemListScroller_OnItemRightClick (:2070-2073) -> the Equip
  // arm at :2039-2042, `TransferItem(..., equip: true)`. The swapped
  // mode has to reach the LADDER as well, since itemTransfer's
  // `equip: mode === 'equip'` is that argument.
  const it = dagger();
  const pile = [it];
  const bag = [];
  const entity = hero(bag);
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, entity, loot: { items: () => pile },
  });
  w.mode = 'remove';
  w.click(...REMOTE_SLOT(0), true);
  assert.deepEqual(pile, [], 'the right click took it');
  assert.equal(bag.length, 1, 'into the pack');
  assert.equal(entity.equip.slots[bag[0].equipSlot], bag[0], 'and EQUIPPED it - the ladder ran on the swapped mode');
});

test('AUDIT 64 F47: a right click on an ACCESSORY button unequips in Remove mode', () => {
  // AccessoryItemsButton_OnRightMouseClick (:1913-1916) -> the
  // Equip/Select arm at :1893-1896, UnequipItem.
  const slot = EQUIP_SLOTS.Amulet0;
  const ring = { group: 'Jewellery', templateIndex: 165, name: 'Amulet', equipSlot: slot };
  const bag = [ring];
  const entity = hero(bag);
  wear(entity, ring, slot);
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity });
  const [ax, ay] = ACCESSORY_RECTS[slot - EQUIP_SLOTS.Amulet0];
  w.mode = 'remove';
  w.click(ax + 5, ay + 5, true);
  assert.equal(entity.equip.slots[slot], null, 'Remove swapped to Equip, which unequips (:1893-1896)');
});

test('AUDIT 64 F47: a right click on Exit, a tab, an action button or a scroll arrow does NOTHING', () => {
  // Setup binds OnMouseClick alone on exitButton (:318), the four tab
  // buttons (:478-490) and the six action buttons (:494-517), and
  // ItemListScroller binds it alone on the two arrows (:299, :307);
  // BaseScreenComponent.RightMouseClick (:927-934) raises only
  // OnRightMouseClick and never falls back to OnMouseClick.
  const bag = [dagger(), dagger(), dagger(), dagger(), dagger(), dagger()];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero(bag) });
  w.mode = 'use';
  w.click(240, 185, true);                       // exitButtonRect
  assert.equal(w.done, false, 'the window stays open');
  w.click(255 + 5, 5, true);                     // ingredientsRect
  assert.equal(w.tab, 'weapons', 'the tab is unchanged');
  w.click(230, 40, true);                        // infoButtonRect
  assert.equal(w.mode, 'use', 'the mode is unchanged');
  w.click(230, 130, true);                       // goldButtonRect - an ACTION, not a mode
  assert.equal(w.topBox, null, 'the drop-gold box never opened');
  const [dx, dy] = [INV_RECTS.localList[0] + 3, INV_RECTS.localList[1] + DOWN_ARROW_Y + 3];
  w.click(dx, dy, true);
  assert.equal(w.scroll, 0, 'the down arrow does not scroll on a right click');
});

// ── F48: the window's shared ToolTip ──────────────────────────────

test('AUDIT 64 F48: the tip names the item on all four surfaces DFU tooltips', () => {
  // Both scrollers (:368, :383) and every accessory button (:547) and
  // the paperdoll (:470) take defaultToolTip; ItemListScroller.cs:340
  // hands it to every item button. The TEXT is ResolveItemLongName
  // (ItemListScroller.cs:462-465 / :995 / :2191).
  const sword = { group: 'Weapons', templateIndex: 118, name: 'Broadsword', material: 9 };
  const bag = [sword];
  const pile = [{ group: 'Weapons', templateIndex: 113, name: 'Dagger', material: 0 }];
  const entity = hero(bag);
  const ring = { group: 'Jewellery', templateIndex: 165, name: 'Amulet', equipSlot: EQUIP_SLOTS.Amulet0 };
  wear(entity, ring, EQUIP_SLOTS.Amulet0);
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity, loot: { items: () => pile } });
  w.hover(...LOCAL_SLOT(0)); w.tick(10);
  assert.equal(w._tip.tip.text, 'Daedric Broadsword', 'the LOCAL slot names its item');
  w.hover(...REMOTE_SLOT(0)); w.tick(10);
  assert.equal(w._tip.tip.text, 'Iron Dagger', 'the REMOTE slot too');
  const [ax, ay] = ACCESSORY_RECTS[0];
  w.hover(ax + 5, ay + 5); w.tick(10);
  assert.equal(w._tip.tip.text, 'Amulet', 'a worn accessory names itself (:995)');
});

test('AUDIT 64 F48: the tip CLEARS where DFU writes string.Empty, and carries none where DFU gives no ToolTip', () => {
  // ItemListScroller.cs:387 blanks a slot with no item;
  // DaggerfallInventoryWindow.cs:981 blanks an empty accessory button;
  // :2200/:2204 blank the doll off an item layer. The gold button
  // (:515-520) and the tab/action buttons were never given a ToolTip.
  const sword = { group: 'Weapons', templateIndex: 118, name: 'Broadsword', material: 9 };
  const bag = [sword];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero(bag) });
  const settle = (x, y) => { w.hover(x, y); w.tick(10); return w._tip.tip.text; };
  assert.equal(settle(...LOCAL_SLOT(0)), 'Daedric Broadsword');
  assert.equal(settle(...LOCAL_SLOT(1)), null, 'the empty slot below it clears the tip');
  assert.equal(settle(...ACCESSORY_RECTS[2].slice(0, 2).map((n) => n + 5)), null, 'an empty accessory button clears it');
  assert.equal(settle(INV_RECTS.gold[0] + 5, INV_RECTS.gold[1] + 5), null, 'the gold button has no ToolTip at all');
  assert.equal(settle(INV_RECTS.paperDoll[0] + 5, INV_RECTS.paperDoll[1] + 5), null, 'bare skin clears it');
  assert.equal(settle(...LOCAL_UP_ARROW()), null, 'the scroll arrow carries none');
  assert.equal(settle(-1, -1), null, 'and the pointer leaving the window clears it');
  // a pushed message box is a window of its own over this one
  settle(...LOCAL_SLOT(0));
  w.boxes = [{ rows: [{ text: 'x' }] }];
  assert.equal(settle(...LOCAL_SLOT(0)), null, 'a pushed box takes the pointer with it');
});

test('AUDIT 64 F48: the tip is DRAWN, and drawn LAST - after the message-box pass', () => {
  // DaggerfallBaseWindow.cs:105-112 - `Draw() { base.Draw(); // Draw
  // tooltip last  if (defaultToolTip != null) defaultToolTip.Draw(); }`
  // The tooltip is not a component in the panel tree at all; it is
  // painted after everything the base class drew, which is what puts
  // it over a pushed box as well as over the window.
  //
  // draw() bails without ARENA2 art (`if (!_art)`), so the order is
  // pinned off the source the way F53's cell pass is. What this
  // catches is the whole visible half of F48 going missing: a window
  // that resolves, feeds and times a tooltip nothing ever paints.
  const src = read('src/ui/nativeInventory.js');
  const body = src.slice(src.indexOf('\n  draw(renderer, canvas, font) {'));
  const end = body.indexOf('\n  }\n');
  assert.ok(end > 0, 'draw() has a body');
  const drawBody = body.slice(0, end);
  const tip = drawBody.indexOf('this._tip.draw(renderer, m, font);');
  assert.ok(tip > 0, 'draw() paints the shared tooltip');
  assert.ok(drawBody.indexOf('drawMessageBox(') > 0
    && drawBody.indexOf('drawMessageBox(') < tip,
    'and it paints it AFTER the message box, not under it');
  assert.equal(drawBody.slice(tip).trim(), 'this._tip.draw(renderer, m, font);',
    'the tooltip draw is the LAST statement of draw()');
  assert.equal(src.split('this._tip.draw(').length - 1, 1, 'painted once');
});

// ── F49: ShowInfoPopup's recipe chain ─────────────────────────────

test('AUDIT 64 F49: an Info click on a potion recipe chains a SECOND box of ingredient names', () => {
  // :1602-1609 - `messageBoxRecipe.SetTextTokens(item.GetMacroDataSource()
  // .PotionRecipeIngredients(JustifyCenter)); ClickAnywhereToClose;
  // AddNextMessageBox; Show()`. PotionRecipeIngredients is
  // DaggerfallUnityItemMCP.cs:245-260: one CreateTextToken per
  // ingredient, GetItemTemplate(ingredient.id).name, each followed by
  // a CreateFormatToken(format).
  const resistFire = POTION_RECIPES[0];
  assert.equal(resistFire.name, 'resistFire');
  const recipe = { group: 'MiscItems', templateIndex: 278, potionRecipeKey: potionRecipeKey(resistFire.ingredients) };
  const bag = [recipe];
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, entity: hero(bag),
    rows: (id) => [{ text: `RECORD ${id}`, center: false }],
  });
  w.tab = 'clothing';   // MiscItems ride the clothing-and-misc page
  w.mode = 'info';
  w.click(...LOCAL_SLOT(0));
  assert.equal(w.boxes.length, 2, 'the recipe box is CHAINED behind the info box');
  // the reference's own ingredient list, resolved through the item
  // templates the way GetItemTemplate(ingredient.id).name does
  assert.deepEqual(w.boxes[1].rows.map((r) => r.text),
    ['Amber', 'Red Flowers', 'Cactus', "Fairy Dragon's Scales", 'Ichor']);
  assert.deepEqual(resistFire.ingredients.map((i) => templateByIndex(i).name),
    ['Amber', 'Red Flowers', 'Cactus', "Fairy Dragon's Scales", 'Ichor'],
    'and those names ARE the recipe\'s template names, in its own order');
  assert.ok(w.boxes[1].rows.every((r) => r.center === true), 'each line is followed by a JustifyCenter');
});

test('AUDIT 64 F49: an unknown recipe key still chains the box, empty', () => {
  // PotionRecipeIngredients (MCP :247-259) returns an EMPTY token
  // array when GetPotionRecipe(key) is null, and :1605-1608 adds and
  // shows the box regardless - so the chain is unconditional.
  const bag = [{ group: 'MiscItems', templateIndex: 278, potionRecipeKey: 987654 }];
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, entity: hero(bag), rows: () => [{ text: 'x', center: true }],
  });
  w.tab = 'clothing';
  w.mode = 'info';
  w.click(...LOCAL_SLOT(0));
  assert.equal(w.boxes.length, 2);
  assert.deepEqual(w.boxes[1].rows, []);
});

// ── F50: the middle button ────────────────────────────────────────

test('AUDIT 64 F50: a middle click on a list slot advances the item\'s variant, silently', () => {
  // :379/:394 -> :2020-2023/:2075-2078 `NextVariant(item)`.
  // ItemButton_OnClick (ItemListScroller.cs:535-552) raises the event
  // with NO PlayOneShot, so the list arm is silent.
  const it = shirt();
  const bag = [it];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero(bag) });
  w.tab = 'clothing';
  w.mode = 'equip';
  spyAudio((played) => {
    w.click(...LOCAL_SLOT(0), false, true);
    assert.equal(it.variant, 1, 'the variant moved on');
    assert.deepEqual(played, [], 'and the list arm plays nothing');
  });
  assert.deepEqual(bag, [it], 'the middle click did NOT run the Equip body');
  assert.equal(w.mode, 'equip');
});

test('AUDIT 64 F50: a middle click over the PAPERDOLL clicks, item under it or not', () => {
  // PaperDoll_OnMiddleMouseClick (:1964-1971) calls PaperDoll_GetItem,
  // whose FIRST statement is PlayOneShot(SoundClips.ButtonClick)
  // (:1920) - ahead of the `value == 0xff` bail.
  const bag = [];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero(bag) });
  spyAudio((played) => {
    w.click(INV_RECTS.paperDoll[0] + 5, INV_RECTS.paperDoll[1] + 5, false, true);
    assert.deepEqual(played, [SOUND.ButtonClick], 'exactly one ButtonClick, ahead of the bail');
  });
});

test('AUDIT 64 F50: every other surface is INERT under the middle button', () => {
  // BaseScreenComponent routes middle through MiddleMouseClick alone
  // (:710-724, :930-937) and never raises OnMouseClick, and the window
  // binds OnMiddleMouseClick nowhere but the two lists, the doll and
  // the drop-icon panel (:437-439). Today's port closed the window,
  // switched tabs, selected a mode and unequipped a worn ring.
  const slot = EQUIP_SLOTS.Amulet0;
  const ring = { group: 'Jewellery', templateIndex: 165, name: 'Amulet', equipSlot: slot };
  const bag = [ring];
  const entity = hero(bag);
  wear(entity, ring, slot);
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity });
  w.mode = 'use';
  w.click(240, 185, false, true);
  assert.equal(w.done, false, 'Exit is inert');
  w.click(255 + 5, 5, false, true);
  assert.equal(w.tab, 'weapons', 'the tabs are inert');
  w.click(230, 40, false, true);
  assert.equal(w.mode, 'use', 'the action buttons are inert');
  const [ax, ay] = ACCESSORY_RECTS[slot - EQUIP_SLOTS.Amulet0];
  w.click(ax + 5, ay + 5, false, true);
  assert.equal(entity.equip.slots[slot], ring, 'the accessory strip is inert - the ring is still worn');
  w.click(...LOCAL_UP_ARROW(), false, true);
  assert.equal(w.scroll, 0, 'and the scroll arrows are inert');
});

// ── F51: UpdateItemInfoPanel's three shortenings ──────────────────

test('AUDIT 64 F51: the panel shortens kilograms/points of damage/armor rating', () => {
  // The six strings are the readonly fields at :131-136, resolved from
  // Internal_Strings.csv:838-843, and the chain at :1149 is
  // .Replace(kgSrc,kgRep).Replace(damSrc,damRep).Replace(arSrc,arRep).
  assert.equal(PANEL_KG_SRC, 'kilograms');
  assert.equal(PANEL_KG_REP, 'kg');
  assert.equal(PANEL_DAM_SRC, 'points of damage');
  assert.equal(PANEL_DAM_REP, 'damage');
  assert.equal(PANEL_AR_SRC, 'armor rating');
  assert.equal(PANEL_AR_REP, 'armor');
  const out = infoPanelShorten([
    { text: 'Weight: 3 kilograms', center: true },
    { text: '5 points of damage', center: false },
    { text: '3 armor rating', center: true },
    { text: null },
  ]);
  assert.deepEqual(out.map((r) => r.text),
    ['Weight: 3 kg', '5 damage', '3 armor', ''], 'every occurrence, and a null text is skipped (:1148)');
  assert.equal(out[0].center, true, 'the rest of the row survives');
  assert.equal(infoPanelShorten(null).length, 0, 'the no-hover panel is an empty row list');
});

test('AUDIT 64 F51: the POPUP keeps the long words - the pass is panel-only', () => {
  // ShowInfoPopup (:1594-1601) builds its own GetItemInfo tokens
  // straight into a DaggerfallMessageBox and never calls
  // UpdateItemInfoPanel, which is the panel label's only writer
  // (:1142-1152, reached from :1139 and from :2258).
  const rows = () => [{ text: 'Weight: %kg kilograms', center: true }];
  const it = { group: 'Weapons', templateIndex: 118, name: 'Broadsword' };
  assert.match(itemInfoRows(it, rows)[0].text, /kilograms$/, 'the popup door is untouched');
  assert.match(infoPanelShorten(itemInfoPanelRows(it, rows))[0].text, / kg$/, 'the panel door shortens');
});

test('AUDIT 64 F51: BOTH panel arms end in the one pass, as DFU\'s two callers do', () => {
  // UpdateItemInfoPanelGold (:2249-2259) builds its own tokens and
  // then calls UpdateItemInfoPanel(tokens) - the SAME member the item
  // overload ends in. Wrapping only the item branch would leave the
  // gold arm on a different door than the reference's.
  const inv = read('src/ui/nativeInventory.js');
  const call = /const panelRows = infoPanelShorten\(this\.infoGold\s*\n\s*\? goldPanelRows\(/;
  assert.match(inv, call, 'the shortening wraps the WHOLE ternary, not one branch');
  // it is a no-op on today's gold strings, which already spell kg
  const gold = goldPanelRows(400, 1);
  assert.deepEqual(infoPanelShorten(gold).map((r) => r.text), gold.map((r) => r.text));
});

// ── F52: the wheel ────────────────────────────────────────────────

test('AUDIT 64 F52: the wheel scrolls the list under the cursor, one row a notch, silently', () => {
  // ItemListScroller.cs:314-316 wires OnMouseScrollUp/Down on the
  // ITEMS panel and :606-616 steps ScrollIndex by one with no sound
  // (the ButtonClick is the arrow buttons', :588-604).
  const bag = Array.from({ length: 9 }, () => dagger());
  const pile = Array.from({ length: 9 }, () => dagger());
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, entity: hero(bag), loot: { items: () => pile },
  });
  spyAudio((played) => {
    w.hover(...LOCAL_SLOT(0));
    w.wheel(1);
    assert.equal(w.scroll, 1, 'one row per notch');
    w.wheel(1);
    assert.equal(w.scroll, 2);
    w.wheel(-1);
    assert.equal(w.scroll, 1, 'and back up');
    assert.equal(w.remoteScroll, 0, 'the other list never moved');
    assert.deepEqual(played, [], 'the wheel is silent');
  });
  w.hover(...REMOTE_SLOT(0));
  w.wheel(1);
  assert.equal(w.remoteScroll, 1, 'the pointer picks the list');
  assert.equal(w.scroll, 1, 'and the local one held its place');
  // VerticalScrollBar.cs:152-162 overrides MouseScrollUp/Down too, so
  // the rail scrolls; the ARROWS are plain Buttons and override
  // neither (BaseScreenComponent.cs:725-733 dispatches per rect).
  w.hover(...LOCAL_RAIL());
  w.wheel(1);
  assert.equal(w.scroll, 2, 'the rail carries the wheel');
  w.hover(...LOCAL_UP_ARROW());
  w.wheel(-1);
  assert.equal(w.scroll, 2, 'the arrow buttons do not');
});

test('AUDIT 64 F52: off both scrollers nothing scrolls - there is no fallback list', () => {
  const bag = Array.from({ length: 9 }, () => dagger());
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero(bag) });
  // AUDIT 65 UI-5: the notch carries its own point now, so "before the
  // pointer has ever moved" is no longer the inert case - the inert
  // case is a notch with NO point, which falls back to the hosts'
  // (-1,-1) pointer-leave sentinel and hits no rect.
  w.wheel(1, -1, -1);
  assert.equal(w.scroll, 0, 'the pointer-leave sentinel carries no scroll');
  w.wheel(1);
  assert.equal(w.scroll, 0, 'and so does a caller with no point at all');
  w.hover(INV_RECTS.paperDoll[0] + 5, INV_RECTS.paperDoll[1] + 5);
  w.wheel(1);
  assert.equal(w.scroll, 0, 'the paperdoll carries no scroll handler');
  w.hover(INV_RECTS.equip[0] + 5, INV_RECTS.equip[1] + 5);
  w.wheel(1);
  assert.equal(w.scroll, 0, 'nor the action buttons');
  w.hover(...LOCAL_SLOT(0));
  w.boxes = [{ rows: [{ text: 'x' }] }];
  w.wheel(1);
  assert.equal(w.scroll, 0, 'and a pushed box owns the screen');
});

test('AUDIT 64 F52: a notch REPOINTS the hover - the info panel follows the list under a still cursor', () => {
  // ItemListScroller.cs:346-347 binds ItemButton_OnMouseEnter to the
  // button's OWN wheel as well as to the pointer entering it, and its
  // body (:570-581) reads `items[GetScrollIndex() * listWidth + Tag]`
  // AFTER the panel's handler has already moved the index -
  // Panel.cs:94-108 runs base.Update() (the panel's scroll dispatch)
  // before it walks its children. OnItemHover is wired at
  // DaggerfallInventoryWindow.cs:381 and :398 to Local/Remote
  // ItemListScroller_OnHover (:2225-2235) -> :2237-2242 ->
  // UpdateItemInfoPanel(item).
  const letters = 'abcdefghi';
  const bag = [...letters].map((n) => dagger({ name: n, material: 9 }));
  const pile = [...letters].map((n) => dagger({ name: n.toUpperCase(), material: 0 }));
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, entity: hero(bag), loot: { items: () => pile },
  });
  w.hover(...LOCAL_SLOT(0));
  assert.equal(w.infoItem, bag[0], 'the pointer entering slot 0 pointed the panel at the first item');
  w.wheel(1);
  assert.equal(w.scroll, 1);
  assert.equal(w.infoItem, bag[1], 'one notch and slot 0 now holds - and the panel names - the SECOND item');
  w.wheel(1); w.wheel(1);
  assert.equal(w.infoItem, bag[3], 'and it keeps following, notch for notch');
  // the same handler on the remote scroller (:398)
  w.hover(...REMOTE_SLOT(1));
  assert.equal(w.infoItem, pile[1]);
  w.wheel(1);
  assert.equal(w.remoteScroll, 1);
  assert.equal(w.infoItem, pile[2], 'the remote list repoints from its own scroller');
  // Past the END of the list the handler returns at :574-575 without
  // touching the panel, which is the same stickiness every other miss
  // on this window carries.
  w.hover(...REMOTE_SLOT(LIST_SLOTS - 1));
  const last = w.infoItem;
  while (w.remoteScroll < pile.length - LIST_SLOTS) w.wheel(1);
  assert.equal(w.remoteScroll, pile.length - LIST_SLOTS);
  assert.equal(w.infoItem, pile[pile.length - 1], 'the bottom slot reached the last item');
  w.wheel(1);
  assert.equal(w.remoteScroll, pile.length - LIST_SLOTS, 'the list is already at its end');
  assert.equal(w.infoItem, pile[pile.length - 1], 'and the panel is left standing');
  assert.notEqual(last, null);
});

test('AUDIT 64 F52: a notch RESTARTS the tooltip rest clock - "Not hovering while scrolling"', () => {
  // BaseScreenComponent.cs:727-736 ends its wheel block with
  // `hoverTime = 0`, and hoverTime is what gates the tooltip draw at
  // :819. The text itself is re-read from the button, whose
  // ToolTipText the scroll has just rewritten (ItemsScrollBar_OnScroll
  // :583-586 -> UpdateItemsDisplay's :464-466).
  const letters = 'abcdefghi';
  const bag = [...letters].map((n) => dagger({ name: n, material: 9 }));
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, entity: hero(bag) });
  w.hover(...LOCAL_SLOT(0)); w.tick(10);
  assert.equal(w._tip.tip.text, 'Daedric a', 'the settled tip names the first item');
  w.wheel(1);
  assert.equal(w._tip.tip.text, null, 'the notch silences it - hoverTime is back to zero');
  w.tick(10);
  assert.equal(w._tip.tip.text, 'Daedric b', 'and it comes back naming the item that scrolled under the cursor');
  // hoverTime = 0 runs for EVERY component under the pointer on a
  // notch (:727), not only the ones that scroll: at the end of the
  // list the index cannot move and the tip is silenced all the same.
  while (w.scroll < bag.length - LIST_SLOTS) w.wheel(1);
  w.tick(10);
  const settled = w._tip.tip.text;
  assert.equal(settled, `Daedric ${letters[bag.length - LIST_SLOTS]}`);
  w.wheel(1);
  assert.equal(w.scroll, bag.length - LIST_SLOTS, 'nothing scrolled');
  assert.equal(w._tip.tip.text, null, 'the clock restarted regardless');
  w.tick(10);
  assert.equal(w._tip.tip.text, settled, 'and the same text returns after the delay');
});

// ── F53: ItemBackgroundColourHandler ──────────────────────────────

test('AUDIT 64 F53: the three colours and the else-if order', () => {
  // DaggerfallInventoryWindow.cs:154-156 and the handler at :401-411.
  assert.deepEqual([...QUEST_ITEM_BG], [0, 0.25, 0, 0.5]);
  assert.deepEqual([...LIGHT_SOURCE_BG], [0.6, 0.5, 0, 0.5]);
  assert.deepEqual([...SUMMONED_ITEM_BG], [0.18, 0.32, 0.48, 0.5]);
  const torch = { group: 'UselessItems2', templateIndex: 247, name: 'Torch' };
  const entity = { lightSource: torch };
  const quest = { group: 'MiscItems', templateIndex: 279, questItem: true };
  const summoned = { group: 'Weapons', templateIndex: 113, timeForItemToDisappear: 1000 };
  assert.equal(itemBackgroundColour(quest, entity), QUEST_ITEM_BG);
  assert.equal(itemBackgroundColour(torch, entity), LIGHT_SOURCE_BG);
  assert.equal(itemBackgroundColour(torch, { lightSource: null }), null, 'an UNLIT torch has no tint - the test is identity');
  assert.equal(itemBackgroundColour(summoned, entity), SUMMONED_ITEM_BG);
  assert.equal(itemBackgroundColour(dagger(), entity), null, 'Color.clear');
  // the chain is else-if, so the FIRST match wins
  const bothQuestAndLit = { group: 'UselessItems2', templateIndex: 247, questItem: true };
  assert.equal(itemBackgroundColour(bothQuestAndLit, { lightSource: bothQuestAndLit }), QUEST_ITEM_BG,
    'a lit quest torch reads GREEN - IsQuestItem is tested first (:403)');
  const litAndSummoned = { group: 'UselessItems2', templateIndex: 247, timeForItemToDisappear: 5 };
  assert.equal(itemBackgroundColour(litAndSummoned, { lightSource: litAndSummoned }), LIGHT_SOURCE_BG,
    'and the light source arm beats IsSummoned (:405-407)');
});

test('AUDIT 64 F53: the quad fills the WHOLE 50x38 button cell, not the icon interior', () => {
  // BaseScreenComponent.cs:784-787 paints backgroundColor over myRect,
  // which is itemButtonRects4's 50x38 cell (ItemListScroller.cs:50-56);
  // SetMargins (:339) insets the CHILD icon panel only.
  const quads = [];
  const renderer = { drawScreenQuad: (tex, r, uv, colour) => quads.push({ tex, ...r, colour }) };
  const m = { ox: 0, oy: 0, s: 1 };
  assert.equal(drawCellBackground(renderer, m, [163, 48, 59, 152], 2, QUEST_ITEM_BG), true);
  assert.deepEqual(quads, [{ tex: null, x: 163 + CELL_X, y: 48 + 2 * SLOT_H, w: CELL_W, h: SLOT_H, colour: QUEST_ITEM_BG }]);
  assert.equal(CELL_W, 50);
  assert.equal(SLOT_H, 38);
  assert.equal(drawCellBackground(renderer, m, [163, 48, 59, 152], 0, null), false, 'Color.clear draws nothing (:784)');
  assert.equal(quads.length, 1);
  // and BOTH windows' cell loops paint it FIRST, ahead of the icon:
  // the button's background colour precedes its child icon panel.
  for (const [file, icon] of [
    ['src/ui/nativeInventory.js', 'this._icon('],
    ['src/ui/nativeTrade.js', 'this._drawIcon('],
  ]) {
    const src = read(file);
    const bg = src.indexOf('drawCellBackground(renderer, m, rect, s,');
    assert.ok(bg > 0, `${file} draws no cell background`);
    assert.ok(src.indexOf(icon, bg) > bg, `${file} draws the icon after the colour`);
    assert.ok(src.slice(bg, src.indexOf(icon, bg)).split('\n').length < 4, `${file}: the colour is the cell's first pass`);
  }
});

test('AUDIT 64 F53: Repair mode replaces the trade window\'s REMOTE handler only', () => {
  // DaggerfallTradeWindow.cs:242-245 - `if (WindowMode ==
  // WindowModes.Repair) remoteItemListScroller.BackgroundColourHandler
  // = RepairItemBackgroundColourHandler`, defined :269-275 with
  // repairItemBackgroundColor (:88). The LOCAL list is not overridden
  // and keeps the inherited quest/lightSource/summoned handler.
  assert.deepEqual([...REPAIR_ITEM_BG], [0.17, 0.32, 0.7, 0.6]);
  const worn = { group: 'Weapons', templateIndex: 113, currentCondition: 10, maxCondition: 40 };
  const booked = { group: 'Weapons', templateIndex: 113, currentCondition: 10, maxCondition: 40, repairData: {} };
  const quest = { group: 'MiscItems', templateIndex: 279, questItem: true };
  const hooks = {
    icons: ICONS, entity: hero(), packItems: () => [], merchantItems: () => [],
    isBeingRepaired: (it) => !!it.repairData,
  };
  const w = new NativeTradeWindow({ ...hooks, mode: 'Repair' });
  w.mode = 'Repair';
  assert.equal(w._cellColour(booked, true), REPAIR_ITEM_BG, 'an item being repaired is tinted on the remote list');
  assert.equal(w._cellColour(worn, true), null, 'one that is not, is not');
  assert.equal(w._cellColour(quest, true), null, 'and the inherited quest arm does NOT apply there');
  assert.equal(w._cellColour(quest, false), QUEST_ITEM_BG, 'the LOCAL list keeps the inherited handler');
  const sell = new NativeTradeWindow({ ...hooks, mode: 'Sell' });
  sell.mode = 'Sell';
  assert.equal(sell._cellColour(quest, true), QUEST_ITEM_BG, 'and so does the remote list in every other mode');
  assert.equal(sell._cellColour(booked, true), null);
});

// ── F54: DoTransferItem's AddPosition.Front ───────────────────────

test('AUDIT 64 F54: addItem carries ItemCollection.AddItem\'s position, merge first', () => {
  // ItemCollection.cs:217-252 - the stack merge runs first and ignores
  // the position; then DontCare appends, Front inserts at 0, Back
  // inserts at Count (identical to an append on an array).
  const a = dagger({ name: 'a' }), b = dagger({ name: 'b' }), c = dagger({ name: 'c' });
  const list = [a];
  addItem(list, b);
  assert.deepEqual(list.map((i) => i.name), ['a', 'b'], 'the default is Back = append');
  addItem(list, c, 'front');
  assert.deepEqual(list.map((i) => i.name), ['c', 'a', 'b'], 'Front inserts at index 0 (:245-246)');
  addItem(list, dagger({ name: 'd' }), 'dontCare');
  assert.deepEqual(list.map((i) => i.name), ['c', 'a', 'b', 'd'], 'DontCare is items.Add (:242-243)');
  // the merge branch wins over the position (:224-230)
  const stackable = { group: 'Weapons', templateIndex: 131, name: 'Arrow', stackCount: 3 };
  const arrows = [{ ...stackable }];
  const before = arrows[0];
  addItem(arrows, { ...stackable, stackCount: 2 }, 'front');
  assert.equal(arrows.length, 1);
  assert.equal(arrows[0], before, 'a merge ignores the position entirely');
  assert.equal(arrows[0].stackCount, 5);
});

test('AUDIT 64 F54: a transferred QUEST item lands at the front, everything else appends', () => {
  // DaggerfallInventoryWindow.cs:1573-1579 - "Always place quest item
  // pickups to front of list / Otherwise use preferred order":
  // `order = preferredOrder; if (item.IsQuestItem) order =
  // AddPosition.Front;`. preferredOrder is DontCare (:192) and is
  // never reassigned in the whole tree.
  const held = dagger({ name: 'held' });
  const letter = { group: 'UselessItems2', templateIndex: 288, name: 'Letter', questItem: true };
  const bag = [held];
  const pile = [letter];
  applyTransfer(letter, { amount: 1 }, pile, bag);
  assert.deepEqual(bag.map((i) => i.name), ['Letter', 'held'], 'the quest item is FIRST - the first visible row');
  const plain = dagger({ name: 'plain' });
  applyTransfer(plain, { amount: 1 }, [plain], bag);
  assert.deepEqual(bag.map((i) => i.name), ['Letter', 'held', 'plain'], 'an ordinary item still appends');
  // the rule is not scoped to pickups: storing one runs the same member
  const store = [];
  applyTransfer(bag[0], { amount: 1 }, bag, store);
  applyTransfer(dagger({ name: 'x' }), { amount: 1 }, [], store);
  assert.deepEqual(store.map((i) => i.name), ['Letter', 'x'], 'the wagon/ground side takes Front too');
});

test('AUDIT 64 F54: the quest machine\'s `front` flag reaches the host hook', () => {
  // GivePc.cs:179/:186 and GetItem.cs:83 call
  // `AddItem(item.DaggerfallUnityItem, AddPosition.Front)`, which
  // quest/actions.js has always passed as `true`;
  // QuestResourceBehaviour.cs:421 passes no position, so its default
  // Back is the plain append.
  const world = read('src/scenes/world.js');
  assert.match(world, /giveItemToPlayer: \(dfItem, front = false\) => \{[^\n]*addItem\(playerEntity\.items, dfItem, front \? 'front' : 'back'\)/,
    'the host hook no longer drops the flag');
  const actions = read('src/systems/quest/actions.js');
  assert.match(actions, /giveItemToPlayer\?\.\(item\.daggerfallUnityItem, true\)/);
  const behaviour = read('src/systems/quest/resourceBehaviour.js');
  assert.match(behaviour, /giveItemToPlayer\?\.\(item\.daggerfallUnityItem\)\;/,
    'QuestResourceBehaviour keeps AddItem\'s default');
});
