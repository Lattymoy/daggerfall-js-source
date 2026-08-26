// AUDIT 26, wave ui-core. Five laws the port had drawn but not
// implemented: the large HUD's breath bar, the settings dialog's
// buttons, TransferItem's quest arm (both windows), the remote list's
// quest click, and the trade window's inherited TransferItem guards.
// Every pin here was mutation-proven against the fix it covers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawHud, hudScale, BREATH_BAR_WIDTH, BREATH_BAR_LEFT, BREATH_BAR_BOTTOM,
} from '../src/ui/hud.js';
import { SettingsWindow } from '../src/ui/settingsWindow.js';
import { NativeInventoryWindow, questTransferRefused, SMALL_CART_TEMPLATE } from '../src/ui/nativeInventory.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { localClickDecision } from '../src/systems/tradeModes.js';
import { CANNOT_REMOVE_ITEM_TEXT } from '../src/systems/createItem.js';
import { CELL_X } from '../src/ui/itemScroller.js';
import { effectiveSettings, setValue, _resetForTests } from '../src/systems/settings.js';

const recorder = () => ({
  quads: [],
  uploadTexture: () => 'tex',
  drawScreenQuad(tex, rect) { this.quads.push({ tex, ...rect }); },
});
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

// ---------------------------------------------------------------
// F147  DaggerfallHUD.cs:203 / :214-220 - the large HUD forces the
//       vitals, the compass and the mode icon off. NOT the breath bar.
// ---------------------------------------------------------------

const hudArt = () => ({
  health: { tex: 'tex:MAIN03I0', w: 4, h: 32 },
  fatigue: { tex: 'tex:MAIN04I0', w: 4, h: 32 },
  magicka: { tex: 'tex:MAIN05I0', w: 4, h: 32 },
  compass: { tex: 'tex:COMPASS', w: 258 + 64, h: 17 },
  compassBox: { tex: 'tex:COMPBOX', w: 69, h: 17 },
  breathNormal: { tex: 'tex:breath-normal', w: 1, h: 1 },
  breathShort: { tex: 'tex:breath-short', w: 1, h: 1 },
});
const drowningVitals = {
  health: 50, maxHealth: 50, magicka: 20, maxMagicka: 20, fatigue: 6400,
  stats: { strength: 50, endurance: 50 }, currentBreath: 12,
};

test('audit26 F147: the LARGE HUD keeps the breath bar, at the same HUDBreathBar geometry', () => {
  const canvas = { width: 1280, height: 800 };
  const s = hudScale(canvas.width, canvas.height);
  assert.equal(s, 4);
  // Update() sets breathBar.Enabled from ShowBreathBar every frame
  // (:203) and the large-HUD force-off block (:214-220) lists only
  // vitals, compass and interactionModeIcon - so a player swimming
  // with the large HUD up still gets the drowning warning.
  const r = recorder();
  drawHud(r, canvas, hudArt(), drowningVitals, 0, 0,
    { largeHud: { art: { main: { tex: 'tex:MAIN00I0' } } } });
  const breath = r.quads.find((q) => String(q.tex).startsWith('tex:breath'));
  assert.ok(breath, 'the large HUD draws the breath bar');
  assert.deepEqual(
    [breath.x, breath.y + breath.h, breath.w],
    [10 + BREATH_BAR_LEFT * s, canvas.height + 10 - BREATH_BAR_BOTTOM * s, BREATH_BAR_WIDTH * s],
    'the same 306 / -92 / 6 offsets the small HUD uses - one member, one geometry');
  // and the COMPASS, one of the three things :214-220 DOES force off,
  // stays off - the vitals are still drawn, but at the large bar's
  // own rects out of largeHud.art, not the small HUD's corner.
  const texes = r.quads.map((q) => String(q.tex));
  for (const gone of ['tex:COMPBOX', 'tex:COMPASS']) {
    assert.equal(texes.includes(gone), false, `${gone} is forced off by the large HUD`);
  }
  assert.ok(texes.includes('tex:MAIN00I0'), 'the large bar itself drew');
  // the small HUD is unchanged
  const r2 = recorder();
  drawHud(r2, canvas, hudArt(), drowningVitals, 0);
  const breath2 = r2.quads.find((q) => String(q.tex).startsWith('tex:breath'));
  assert.deepEqual([breath2.x, breath2.y + breath2.h, breath2.w], [breath.x, breath.y + breath.h, breath.w]);
  // no breath held, no bar - on either HUD
  const r3 = recorder();
  drawHud(r3, canvas, hudArt(), { ...drowningVitals, currentBreath: 0 }, 0, 0,
    { largeHud: { art: { main: { tex: 'tex:MAIN00I0' } } } });
  assert.equal(r3.quads.some((q) => String(q.tex).startsWith('tex:breath')), false);
});

// ---------------------------------------------------------------
// F152  The settings dialog draws buttons; a click has to hit one.
// ---------------------------------------------------------------

const CANVAS = { width: 1280, height: 800 };
const btnRect = (win, i) => win.layout(CANVAS).dialog.buttons[i].rect;
const clickBtn = (win, i) => {
  const [x, y] = btnRect(win, i);
  return win.click(x + 1, y + 1, CANVAS);
};

test('audit26 F152: a drawn dialog button is a real button - Cancel and Keep It DECLINE', () => {
  _resetForTests();
  // Reset Everything: the affirmative is button 0, the refusal is the
  // drawn Cancel. Clicking Cancel used to run onYes and wipe every
  // override, because click() hit-tested nothing at all.
  let reset = 0;
  const win = new SettingsWindow({});
  const resetDialog = () => ({
    title: 'Reset Everything', key: null, lines: ['x'],
    buttons: [{ id: 'yes', label: 'Reset' }, { id: 'no', label: 'Cancel' }],
    onYes: () => { reset++; },
  });

  win.dialog = resetDialog();
  assert.deepEqual(win.layout(CANVAS).dialog.buttons.map((b) => b.label), ['Reset', 'Cancel']);
  assert.ok(clickBtn(win, 1), 'the click is consumed');
  assert.equal(reset, 0, 'Cancel declines');
  assert.equal(win.dialog, null, 'and the dialog closes');

  win.dialog = resetDialog();
  clickBtn(win, 0);
  assert.equal(reset, 1, 'Reset confirms');

  // ...and a click that lands on no button declines too, the way
  // Escape does on the keyboard path.
  win.dialog = resetDialog();
  win.click(0, 0, CANVAS);
  assert.equal(reset, 1, 'a click outside the buttons declines');
  assert.equal(win.dialog, null);
  _resetForTests();
});

test('audit26 F152: "Keep It" on the ShowOptionsAtStart lock-out keeps it', () => {
  _resetForTests();
  const lockOut = () => ({
    title: 'Show Options At Start', key: 'GUI/ShowOptionsAtStart', lines: ['x'],
    buttons: [{ id: 'yes', label: 'Turn Off' }, { id: 'no', label: 'Keep It' }],
  });
  const win = new SettingsWindow({});
  win.dialog = lockOut();
  clickBtn(win, 1);
  assert.equal(effectiveSettings().GUI.ShowOptionsAtStart, 'True', 'Keep It kept it');
  // the affirmative still commits DFU's "False"
  win.dialog = lockOut();
  clickBtn(win, 0);
  assert.equal(effectiveSettings().GUI.ShowOptionsAtStart, 'False');
  _resetForTests();
});

// ---------------------------------------------------------------
// F153  TransferItem's quest arm (DaggerfallInventoryWindow.cs:1480-
//       1505) - the refusal, and the ONLY writer of PlayerDropped.
// ---------------------------------------------------------------

const questResource = (over = {}) => ({
  allowDrop: false, playerDropped: false, madePermanent: false, hasPlayerClicked: false,
  setPlayerClicked() { this.hasPlayerClicked = true; }, ...over,
});
const questItemFor = (res, over = {}) => ({
  group: 'MiscItems', templateIndex: 132, name: 'Ruby',
  questItem: true, questUID: 7, questSymbol: { name: '_ruby_' }, ...over,
});
const questHook = (res) => (uid) => (uid === 7 ? { getItem: () => res } : null);

test('audit26 F153: TransferItem refuses an undroppable quest item, and PlayerDropped has a writer', () => {
  _resetForTests();
  // ":1486-1494" - CanDropQuestItems ships False, so a quest item
  // whose resource does not AllowDrop cannot leave the pack.
  const res = questResource();
  const item = questItemFor(res);
  assert.equal(questTransferRefused(item, { fromLocal: true, getQuest: questHook(res) }), true);
  assert.equal(res.playerDropped, false);
  // an unresolvable quest item is refused too (:1489's `questItem == null`)
  assert.equal(questTransferRefused(item, { fromLocal: true, getQuest: () => null }), true);

  // ":1496-1498" - AllowDrop out of the pack, and NOT into the wagon,
  // sets PlayerDropped. This is the only writer of the flag the
  // DroppedItemAtPlace trigger polls.
  const ok = questResource({ allowDrop: true });
  assert.equal(questTransferRefused(questItemFor(ok), { fromLocal: true, getQuest: questHook(ok) }), false);
  assert.equal(ok.playerDropped, true, 'a legal drop is recorded');

  // the WAGON is not the ground (remoteTargetType != RemoteTargetTypes.Wagon)
  const cart = questResource({ allowDrop: true });
  assert.equal(questTransferRefused(questItemFor(cart), {
    fromLocal: true, toWagon: true, getQuest: questHook(cart),
  }), false);
  assert.equal(cart.playerDropped, false, 'stashing it in the cart is not dropping it');

  // ":1499-1500" - picking it back up clears the flag
  const back = questResource({ allowDrop: true, playerDropped: true });
  assert.equal(questTransferRefused(questItemFor(back), { fromLocal: false, getQuest: questHook(back) }), false);
  assert.equal(back.playerDropped, false);

  // ":1502-1504" - MakePermanent on a cloned quest item
  const perm = questResource({ allowDrop: true, madePermanent: true });
  const permItem = questItemFor(perm);
  questTransferRefused(permItem, { fromLocal: true, getQuest: questHook(perm) });
  assert.deepEqual([permItem.questItem, permItem.questUID, permItem.questSymbol], [false, 0, null]);

  // GUI/CanDropQuestItems True opens the gate DFU opens (:1487)
  setValue('GUI', 'CanDropQuestItems', 'True');
  const free = questResource();
  assert.equal(questTransferRefused(questItemFor(free), { fromLocal: true, getQuest: questHook(free) }), false);
  _resetForTests();
});

test('audit26 F153: the Remove click on a quest item is refused in the window itself', () => {
  _resetForTests();
  const res = questResource();
  const item = questItemFor(res);
  const bag = [item];
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, getQuest: questHook(res),
  });
  w.tab = 'magic';          // MiscItems.Spellbook template - the magic tab
  w.mode = 'remove';
  w.click(163 + CELL_X + 5, 48 + 5);
  assert.equal(bag.length, 1, 'the item stayed in the pack');
  assert.equal(w.dropped.length, 0, 'and nothing reached the ground pile');
  assert.equal(w.topBox.rows[0].text, CANNOT_REMOVE_ITEM_TEXT);
  _resetForTests();
});

// ---------------------------------------------------------------
// F154  RemoteItemListScroller_OnItemClick's FIRST act (:2027-2037).
// ---------------------------------------------------------------

test('audit26 F154: a remote-list click on a quest item sends the click to the quest system', () => {
  _resetForTests();
  const res = questResource();
  const item = questItemFor(res);
  const pile = [item];
  const bag = [];
  const w = new NativeInventoryWindow({
    items: () => bag, icons: ICONS, getQuest: questHook(res),
    loot: { items: () => pile },
  });
  assert.equal(w.mode, 'remove', 'a loot target opens in Remove mode');
  w.click(261 + CELL_X + 5, 48 + 5);
  assert.equal(res.hasPlayerClicked, true, 'the ClickedItem trigger can fire');
  assert.equal(bag.length, 1, 'and the item was taken');
  assert.equal(res.playerDropped, false);

  // it is the FIRST act, ahead of the action-mode branch, so an INFO
  // click counts as a click too.
  const res2 = questResource();
  const pile2 = [questItemFor(res2)];
  const w2 = new NativeInventoryWindow({
    items: () => [], icons: ICONS, getQuest: questHook(res2), loot: { items: () => pile2 },
  });
  w2.mode = 'info';
  w2.click(261 + CELL_X + 5, 48 + 5);
  assert.equal(res2.hasPlayerClicked, true);
  assert.equal(pile2.length, 1, 'and Info took nothing');

  // the LOCAL list has no such call (LocalItemListScroller_OnItemClick
  // :1974-2007) - the asymmetry is DFU's.
  const res3 = questResource({ allowDrop: true });
  const bag3 = [questItemFor(res3)];
  const w3 = new NativeInventoryWindow({ items: () => bag3, icons: ICONS, getQuest: questHook(res3) });
  w3.tab = 'magic';
  w3.mode = 'remove';
  w3.click(163 + CELL_X + 5, 48 + 5);
  assert.equal(res3.hasPlayerClicked, false, 'the local list does not click the quest system');
  assert.equal(res3.playerDropped, true, 'but it does drop');
  _resetForTests();
});

// ---------------------------------------------------------------
// F155  DaggerfallTradeWindow EXTENDS the inventory window: every
//       staging click is a TransferItem call (:795).
// ---------------------------------------------------------------

const shopHooks = (pack, over = {}) => ({
  mode: 'Sell',
  shelfItems: () => [],
  packItems: () => pack,
  accepts: () => true,
  enchanted: () => true,
  gold: () => 1000,
  rows: () => [],
  icons: ICONS,
  entity: { items: pack, wagonItems: [] },
  ...over,
});
const sellClick = (win) => win.click(163 + CELL_X + 5, 48 + 5, CANVAS);

test('audit26 F155: the loaded cart cannot be sold, and a horse still can (:789-794)', () => {
  const cart = { group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, name: 'Small cart' };
  const horse = { group: 'Transportation', templateIndex: 94, name: 'Horse' };
  // "Are we trying to sell the non empty wagon?" - silent, no box.
  assert.deepEqual(localClickDecision('Sell', cart, { wagonLoaded: true, usedWagon: cart }), { kind: 'ignore' });
  assert.deepEqual(localClickDecision('SellMagic', cart, { wagonLoaded: true, usedWagon: cart }), { kind: 'ignore' });
  // an EMPTY wagon sells
  assert.deepEqual(localClickDecision('Sell', cart, { wagonLoaded: false, usedWagon: cart }), { kind: 'stage' });
  // and a horse is Transportation but is not that record
  assert.deepEqual(localClickDecision('Sell', horse, { wagonLoaded: true, usedWagon: cart }), { kind: 'stage' });
});

test('audit26 F155: Sell staging inherits TransferItem\'s summoned and quest guards', () => {
  _resetForTests();
  // A SUMMONED item cannot leave the pack (:1464-1469) - it would
  // vanish out of the shopkeeper's stock an hour later.
  const summoned = { group: 'Weapons', templateIndex: 113, name: 'Steel Dagger', timeForItemToDisappear: 500 };
  const pack = [summoned];
  const win = new NativeTradeWindow(shopHooks(pack));
  sellClick(win);
  assert.deepEqual(win.staged, [], 'the summoned item did not stage');
  assert.equal(win.box.rows[0].text, CANNOT_REMOVE_ITEM_TEXT);

  // A QUEST item cannot be sold either (:1480-1494). No host wires a
  // getQuest into the shop yet, and DFU refuses an unresolvable quest
  // item too, so the missing seam lands on the same side.
  const res = questResource();
  const quest = questItemFor(res);
  const pack2 = [quest];
  const win2 = new NativeTradeWindow(shopHooks(pack2, { getQuest: questHook(res) }));
  sellClick(win2);
  assert.deepEqual(win2.staged, [], 'the quest item did not stage');
  assert.equal(win2.box.rows[0].text, CANNOT_REMOVE_ITEM_TEXT);

  // an ordinary item still stages
  const plain = { group: 'Weapons', templateIndex: 113, name: 'Dagger' };
  const pack3 = [plain];
  const win3 = new NativeTradeWindow(shopHooks(pack3));
  sellClick(win3);
  assert.deepEqual(win3.staged, [plain]);
  assert.equal(win3.box, null);
  _resetForTests();
});
