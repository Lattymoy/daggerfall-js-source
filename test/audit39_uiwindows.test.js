// AUDIT 39 - the ui-windows cluster (F138-F141, F145-F147).
//
// F138 the enhanced spellbook and char-sheet doors answer the HOST
// contract (`input`, not the `onKey` nothing calls) or the first
// unclaimed key throws inside the host's keydown handler; F139 the
// classic inventory grows DFU's twelve accessory buttons, without
// which a worn ring is unreachable in every tab and on the doll;
// F140 the sheet's gold label is GetGoldAmount - coins PLUS letters
// of credit; F141 the paperdoll's censor welds hang off
// ChildGuard/PlayerNudity; F145 the enhanced travel map folds
// GuildManager.FastTravel between the time and the cost; F146 the
// settings screen keeps the onPickMorrowind hook it is handed; F147
// ArrowUp on a freshly opened house list cannot drive scroll to -1.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createSpellbookWindow } from '../src/ui/spellbookDoor.js';
import { createCharSheetWindow } from '../src/ui/charSheetDoor.js';
import {
  NativeInventoryWindow, ACCESSORY_RECTS, ACCESSORY_SLOT_MIN, ACCESSORY_SLOT_MAX, filterByTab,
} from '../src/ui/nativeInventory.js';
import { equipItem, isEquipped, EQUIP_SLOTS } from '../src/systems/equip.js';
import { sheetModel } from '../src/ui/enhancedCharSheet.js';
import { totalGoldAmount } from '../src/systems/court.js';
import { LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { SettingsWindow } from '../src/ui/settingsWindow.js';
import { BankPurchaseWindow, LIST_ROWS } from '../src/ui/bankPurchaseWindow.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

// ── F138: THE DOORS ANSWER THE CONTRACT THE HOSTS CALL ────────────

const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

/** The hosts' own minimum: createElement, body.append, node.remove. */
function withDocument(fn) {
  const node = { id: '', style: {}, removed: false, remove() { this.removed = true; } };
  globalThis.document = { createElement: () => node, body: { append() {} } };
  try { return fn(node); } finally { delete globalThis.document; }
}

test('F138: both enhanced doors answer input/click/wheel - the hosts call them UNGUARDED', () => {
  // dungeonContext `activeOverlay.input(action, e)`, townTalk
  // `overlay.input(a, e)`, worldModes `w.input(code, e)`: no host tests
  // for the arm first, and the enhanced views claim only the keys they
  // use - ui/input.js turns every letter into 'char:x', which reached
  // an object that had `onKey` and nothing else. Enhanced is the
  // DEFAULT skin, so this threw on the shipped one.
  skin('enhanced');
  const entity = { name: 'Aelwyn', stats: {}, skills: {}, items: [] };
  const doors = [
    ['spellbook', () => createSpellbookWindow({ entity, magic: null, castCost: () => 0, rows: () => [] })],
    ['char sheet', () => createCharSheetWindow({ entity })],
  ];
  for (const [name, open] of doors) {
    withDocument((node) => {
      const win = open();
      assert.ok(win, `${name}: the enhanced door opens`);
      assert.equal(win.isChoiceWindow, true, `${name}: raw codes through the overlay seam`);
      for (const arm of ['input', 'click', 'wheel', 'hover', 'tick', 'draw', 'dispose', 'close']) {
        assert.equal(typeof win[arm], 'function', `${name}: the host calls ${arm}()`);
      }
      // THE FAILING CASE, driven: a key the view does not claim.
      win.input('char:w', { key: 'w' });
      win.click(10, 10);
      win.wheel(1);
      win.hover(10, 10);
      win.tick(0.016);
      assert.equal(win.done, false, `${name}: none of that closes the window`);
      // townTalk's showOverlay/dropOverlay free the outgoing window
      // with `win.dispose?.()` - without it the fixed inset:0 div
      // outlives the object and never comes off the screen.
      win.dispose();
      assert.equal(win.done, true, `${name}: dispose ends it`);
      assert.equal(node.removed, true, `${name}: and takes the div with it`);
    });
  }
  skin('classic');
});

test('F138: the dead onKey/onPointer arms are gone from both doors', () => {
  // Nothing in the repo ever called them; they were the fiction that
  // made a missing `input` look deliberate.
  for (const f of ['ui/spellbookDoor.js', 'ui/charSheetDoor.js']) {
    const s = src(f);
    assert.equal(s.includes('onKey()'), false, `${f}: onKey retired`);
    assert.equal(s.includes('onPointer()'), false, `${f}: onPointer retired`);
    assert.match(s, /isChoiceWindow: true,/, `${f}: the seam the sibling doors declare`);
  }
});

// ── F139: THE TWELVE ACCESSORY BUTTONS ────────────────────────────

test('F139: SetupAccessoryElements verbatim - two columns, 21x20, rowOffset 31', () => {
  // DaggerfallInventoryWindow.cs:523-576: col0 (1,11), col1 (24,11),
  // buttonSize (21,20), rowOffset 31, EquipSlots.Amulet0..Crystal1.
  assert.equal(ACCESSORY_SLOT_MIN, EQUIP_SLOTS.Amulet0);
  assert.equal(ACCESSORY_SLOT_MAX, EQUIP_SLOTS.Crystal1);
  assert.equal(ACCESSORY_RECTS.length, 12);
  assert.deepEqual([...ACCESSORY_RECTS[0]], [1, 11, 21, 20]);
  assert.deepEqual([...ACCESSORY_RECTS[1]], [24, 11, 21, 20]);
  assert.deepEqual([...ACCESSORY_RECTS[2]], [1, 42, 21, 20]);
  assert.deepEqual([...ACCESSORY_RECTS[11]], [24, 166, 21, 20]);
});

test('F139: a worn ring is reachable ONLY here - and this unequips it', () => {
  const ring = { group: 'Jewellery', templateIndex: 135, name: 'Ring' };
  const entity = { isPlayer: true, activeEffects: [], items: [ring] };
  equipItem(entity, ring);
  assert.equal(ring.equipSlot, EQUIP_SLOTS.Ring0, 'SLOT_RULES puts a ring in Ring0 (4)');
  assert.ok(isEquipped(ring));
  // THE TRAP: FilterLocalItems drops it from every tab, and
  // PaperDollRenderer blits Jewellery only above slot 11, so nothing
  // the doll hit-tests can reach it either.
  for (const tab of ['weapons', 'magic', 'clothing', 'ingredients']) {
    assert.equal(filterByTab([ring], tab).length, 0, `${tab}: a worn ring is not in the list`);
  }

  const w = new NativeInventoryWindow({ items: () => entity.items, icons: ICONS, entity });
  const [rx, ry] = ACCESSORY_RECTS[EQUIP_SLOTS.Ring0];
  assert.equal(w.mode, 'equip');
  assert.ok(w.click(rx + 2, ry + 2), 'the button owns the click');
  assert.equal(entity.equip.slots[EQUIP_SLOTS.Ring0] ?? null, null, 'Equip mode UNEQUIPS (:1893-1897)');
  assert.equal(isEquipped(ring), false);
  assert.equal(filterByTab([ring], 'clothing').length, 1, 'and the ring is back in the list');
});

test('F139: Info reads and hover fills the panel; an EMPTY button changes nothing', () => {
  const amulet = { group: 'Jewellery', templateIndex: 133, name: 'Amulet' };
  const entity = { isPlayer: true, activeEffects: [], items: [amulet] };
  equipItem(entity, amulet);
  const slot = amulet.equipSlot;
  assert.ok(slot >= ACCESSORY_SLOT_MIN && slot <= ACCESSORY_SLOT_MAX);
  const [rx, ry] = ACCESSORY_RECTS[slot];
  const w = new NativeInventoryWindow({
    items: () => entity.items, icons: ICONS, entity,
    rows: () => [{ text: 'An amulet.', center: true }],
  });
  // AccessoryItemsButton_OnMouseEnter (:2210-2220)
  w.hover(rx + 2, ry + 2);
  assert.equal(w.infoItem, amulet, 'the hover panel reads the worn item');
  // ...and an empty button LEAVES the panel standing, as the doll's
  // own miss does - DFU returns before UpdateItemInfoPanel.
  const empty = ACCESSORY_RECTS[ACCESSORY_SLOT_MAX];
  w.hover(empty[0] + 2, empty[1] + 2);
  assert.equal(w.infoItem, amulet, 'an empty slot clears nothing');
  // Info mode pops the record
  w.click(226 + 5, 36 + 5);
  assert.equal(w.mode, 'info');
  w.click(rx + 2, ry + 2);
  assert.ok(w.topBox, 'ShowInfoPopup (:1898-1901)');
  // an empty button in Info mode: the click is eaten, no box
  w._dismissBox();
  w.click(empty[0] + 2, empty[1] + 2);
  assert.equal(w.topBox, null, 'no item, no popup - the bail is after the click sound');
});

// ── F140: THE GOLD LABEL IS GetGoldAmount ─────────────────────────

test('F140: both sheets show coins PLUS letters of credit', () => {
  // DaggerfallCharacterSheetWindow.cs:401 `PlayerEntity.GetGoldAmount()`
  // = PlayerEntity.cs:1313-1316 `goldPieces + items.GetCreditAmount()`.
  const e = {
    name: 'Aelwyn', level: 1, stats: {}, skills: {},
    goldPieces: 1287,   // E4: PlayerEntity.GoldPieces, the counter
    items: [
      { group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, name: 'Letter of credit', value: 5000 },
    ],
  };
  assert.equal(totalGoldAmount(e), 6287);
  assert.equal(sheetModel(e).gold, 6287, 'the enhanced sheet reads the same figure');
  // ...and the classic label draws it through the same one law, not a
  // second reading of the Currency stack.
  const s = src('ui/charsheet.js');
  assert.match(s, /label\(totalGoldAmount\(e\), 39, 44\);/, 'the (39,44) label is GetGoldAmount');
  assert.equal(s.includes("it.group === 'Currency')?.stackCount"), false,
    'the coins-only read is gone from the sheet');
  // E4: and there is no Currency stack left to read anywhere - the
  // coins are PlayerEntity.GoldPieces.
  assert.equal(sheetModel({ ...e, goldPieces: 0 }).gold, 5000, 'letters alone still show');
});

// ── F141: THE CENSOR WELDS HANG OFF PlayerNudity ──────────────────

test('F141: BlitBody gates BOTH welds on ChildGuard/PlayerNudity', () => {
  // PaperDollRenderer.cs:346-353 wraps exactly the two weld blits in
  // `if (!DaggerfallUnity.Settings.PlayerNudity)`; the nude body above
  // them is drawn either way. The port had only the two slot tests, so
  // a player who turned the shipped toggle on saw no change.
  const s = src('ui/paperDoll.js');
  const body = s.slice(s.indexOf('blit(out, _art.nude);'), s.indexOf('racialOverrideHeadArt(entity)'));
  assert.match(body, /if \(!getBool\('ChildGuard', 'PlayerNudity'\)\) \{/, 'the outer gate');
  const gate = body.indexOf("getBool('ChildGuard', 'PlayerNudity')");
  for (const weld of ['EQUIP_SLOTS.ChestClothes', 'EQUIP_SLOTS.LegsClothes']) {
    assert.ok(body.indexOf(weld) > gate, `${weld}'s weld sits INSIDE the gate`);
  }
  // the nude body is NOT gated - only the welds are
  assert.ok(body.indexOf('blit(out, _art.nude);') < gate);
});

// ── F145: THE ENHANCED MAP FOLDS GuildManager.FastTravel ──────────

test('F145: the travel map prices the trip AFTER the guild blessing', () => {
  // DaggerfallTravelPopUp.cs:281-292 - CalculateTravelTime, then
  // GuildManager.FastTravel, THEN CalculateTripCost, so the Temple of
  // Akatosh's rank shortens the fare and the days as well as the
  // journey (Temple.cs:430-436). The classic popup already folds it at
  // ui/travelPopUp.js:166; the enhanced map skipped the middle step.
  const s = src('ui/overworldMap.js');
  assert.match(s, /import \{ guildFastTravel \} from '\.\.\/systems\/guildVariants\.js';/);
  const trip = s.slice(s.indexOf('_refreshTrip() {'), s.indexOf('_toggleOpt(key) {'));
  const fold = trip.indexOf('guildFastTravel(');
  assert.ok(fold > 0, 'the fold is in _refreshTrip');
  assert.ok(trip.indexOf('this._journey(dest,') < fold, 'after CalculateTravelTime');
  assert.ok(fold < trip.indexOf('calculateTripCost('), 'and BEFORE CalculateTripCost');
  assert.match(trip, /guildFastTravel\(this\.deps\.playerEntity\?\.\(\) \?\? null, time\.minutes\)/,
    'off the same dep the popup reads');
  // the committed trip carries the BLESSED minutes - _confirmDiseased
  // hands st.trip.minutes to the clock.
  assert.match(trip, /st\.trip = \{ \.\.\.time, minutes, \.\.\.cost, days: travelDays\(minutes\) \};/);
});

// ── F146: THE SETTINGS SCREEN KEEPS ITS THIRD HOOK ────────────────

test('F146: onPickMorrowind survives the constructor and reaches both consumers', () => {
  // launcherScene.js passes it in the same object literal as the two
  // hooks that WERE read; the row and the KeyM arm were both wired for
  // it, so the classic skin's only Morrowind door was dead.
  let picked = 0;
  const win = new SettingsWindow({ onPickMusic: () => {}, onPickMorrowind: () => { picked++; } });
  assert.equal(typeof win.onPickMorrowind, 'function', 'the hook is stored, not dropped');
  const d = win._detail('Enhancements/AssetInjection');
  assert.ok(d.buttons.some((b) => b.id === 'pickMw'), 'the M - Morrowind button is offered');
  assert.equal(typeof d.onAlt2, 'function');
  win.dialog = win._detail('Enhancements/AssetInjection');
  win.input('KeyM');
  assert.equal(picked, 1, 'KeyM runs it');
  assert.equal(win.dialog, null, 'and closes the dialog');
  // A host that hands none still gets no button - the honest refusal.
  const bare = new SettingsWindow({ onPickMusic: () => {} });
  assert.equal(bare._detail('Enhancements/AssetInjection').buttons.some((b) => b.id === 'pickMw'), false);
});

// ── F147: ArrowUp CANNOT DRIVE THE HOUSE LIST TO -1 ───────────────

test('F147: ArrowUp on a fresh purchase list is a NO-OP, as ListBox.SelectPrevious is', () => {
  // ListBox.cs:709-719 nests the scroll adjustment INSIDE
  // `if (selectedIndex > 0)`. Hoisted out, SelectNone's -1 assigned
  // `scroll = -1`, and rows() clamps only downward - so `slice(-1, 9)`
  // rendered ONE row, the last house, at index -1, which _buy()'s
  // `if (this.selected < 0) return` then refused.
  const market = Array.from({ length: 14 }, (_, i) => ({ buildingKey: i + 1, meshRadius: 10 + i }));
  const win = new BankPurchaseWindow({ houses: () => market, onClose: () => {} });
  assert.equal(win.selected, -1);
  assert.equal(win.scroll, 0);
  win.input('ArrowUp');
  assert.equal(win.selected, -1, 'nothing to move to');
  assert.equal(win.scroll, 0, 'and the view does not follow it off the top');
  assert.equal(win.rows().length, LIST_ROWS, 'the whole page still lists');
  assert.equal(win.rows()[0].index, 0);
  // the walk still drags the view once there IS a selection
  for (let i = 0; i < LIST_ROWS + 1; i++) win.input('ArrowDown');
  assert.equal(win.selected, LIST_ROWS);
  assert.equal(win.scroll, 1);
  for (let i = 0; i < LIST_ROWS + 4; i++) win.input('ArrowUp');
  assert.equal(win.selected, 0);
  assert.equal(win.scroll, 0, 'back to the top, never past it');
  // and rows() refuses a negative scroll however one arrives
  win.scroll = -3;
  assert.equal(win.rows()[0].index, 0);
  assert.equal(win.scroll, 0);
});
