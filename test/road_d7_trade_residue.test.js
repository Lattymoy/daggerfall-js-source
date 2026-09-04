// ROAD-D7 - THE TRADE RESIDUE. Four sites the closeout re-triage found
// closable, and what each one owed:
//
//  1. the trade window staged a SELECTION over the pack because the
//     HOST made the equipped cut and handed back a fresh filtered
//     array. DFU makes that cut inside FilterLocalItems
//     (DaggerfallTradeWindow.cs:693, :697) and hands the window the
//     LIVE PlayerEntity.Items (:389), so TransferItem (:795) can splice
//     at the click - and OnPop's ClearSelectedItems (:404-407) puts
//     back whatever is still staged when the screen closes.
//  2. the Repair service was a keyed text list; the INVE12I0 native
//     mode is open now, remote list and all (FilterRemoteItems
//     :705-727, the interrupt confirm :842-862).
//  3. a potion RECIPE's info panel read as a generic misc item; DFU
//     builds its four tokens by hand (ItemHelper.cs:794, :848-855).
//  4. the item scroller's buttons had no tooltip; DFU gives every one
//     of them the window's shared ToolTip and sets its text from
//     ResolveItemLongName (ItemListScroller.cs:340, :462-465).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';
import { PotionMakerWindow } from '../src/ui/potionMakerWindow.js';
import { scrollerToolTipText } from '../src/ui/itemScroller.js';
import { itemLongName, resolveItemName, itemInfoRows, POTION_RECIPE_FOR_TEXT, POTION_RECIPE_WEIGHT_TEXT } from '../src/systems/itemInfo.js';
import { repairJobsAt, isBeingRepaired, calculateItemRepairTime, INTERRUPT_REPAIR_TEXT } from '../src/systems/repairService.js';
import { MINUTES_PER_DAY } from '../src/systems/gameDate.js';
import { MB_BUTTONS } from '../src/ui/messageBox.js';
import { POTION_RECIPES, potionRecipeKey } from '../src/systems/potions.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

/** The middle of the first visible slot in each list (nativetrade's). */
const LOCAL_SLOT0 = [192, 48 + 20];
const REMOTE_SLOT0 = [290, 48 + 20];
const MODE_ACTION = [226 + 15, 134 + 7];
const EXIT = [222 + 15, 178 + 10];

const icons = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };

/** THE HOST'S SHAPE AFTER D7 (scenes/worldModes.js's openTradeWindow):
 *  packItems hands back the LIVE array, and the equipped test is the
 *  window's. */
function liveHooks(mode, pack, extra = {}) {
  const entity = { items: [...pack], otherItems: [], wagonItems: [] };
  const committed = [];
  return {
    entity, committed, mode,
    shelfItems: () => [],
    packItems: () => entity.items,
    otherItems: () => entity.otherItems,
    isEquipped: (it) => !!it.equipSlot,
    accepts: () => true,
    enchanted: () => true,
    priceCtx: () => ({ quality: 10, priceAdjustment: 1000, skills: { mercantile: 50, personality: 50 } }),
    gold: () => 100000,
    rows: (id) => [{ text: `#${id}`, center: true }],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }),
    commit: (m, staged, price) => { committed.push({ m, n: staged.length, price, staged: [...staged] }); },
    icons,
    ...extra,
  };
}

const sword = (over = {}) => ({ group: 'Weapons', templateIndex: 118, name: '%it', value: 100, material: 0, maxCondition: 100, currentCondition: 50, ...over });

// ── 1. the live collection, the click transfer and the pop ────────

test('D7: FilterLocalItems drops the EQUIPPED item - the test is the window\'s, not the host\'s', () => {
  const worn = sword({ equipSlot: 'RightHand', name: 'Worn' });
  const spare = sword({ name: 'Spare' });
  const h = liveHooks('Sell', [worn, spare]);
  const w = new NativeTradeWindow(h);
  assert.deepEqual(w.localList(), [spare], 'a worn blade is not for sale (:693)');
  // ...and the pack the host handed over still holds BOTH: it is the
  // live collection, unfiltered, exactly as localItems = PlayerEntity.Items.
  assert.equal(h.entity.items.length, 2, 'the host must not narrow the pack - a filtered view cannot be spliced');
});

test('D7: a staged item LEAVES PlayerEntity.Items at the click (TransferItem :795)', () => {
  const it = sword();
  const h = liveHooks('Sell', [it]);
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  assert.deepEqual(w.staged, [it], 'the click staged it');
  assert.deepEqual(h.entity.items, [], 'and the goods are OUT of the pack there and then');
  // which is the whole point: the weight strip and the letter-of-credit
  // test both read PlayerEntity.CarriedWeight, and DFU has already
  // moved the goods out by the time either is asked.
  w._pickRemote(0);
  assert.deepEqual(h.entity.items, [it], 'clicking it back out returns it to the same collection');
});

test('D7: walking out with goods staged is OnPop -> ClearSelectedItems, not a lost item', () => {
  const it = sword();
  const h = liveHooks('Sell', [it]);
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  assert.deepEqual(h.entity.items, []);
  w.click(...EXIT);
  assert.equal(w.done, true, 'the exit button closes the window');
  assert.deepEqual(h.entity.items, [it], '"Priority is to not lose any items" (:614-626)');
  // the keyboard exits agree with the button
  const h2 = liveHooks('Sell', [sword()]);
  const w2 = new NativeTradeWindow(h2);
  w2.click(...LOCAL_SLOT0);
  w2.input('Escape');
  assert.equal(h2.entity.items.length, 1, 'Escape pops the window too');
});

test('D7: ConfirmTrade clears PER MODE - Identify leaves the lot for the pop to return', () => {
  const amulet = { group: 'Jewellery', templateIndex: 133, name: 'Amulet', value: 500, magic: true, enchantments: [{ type: 1, param: 0 }] };
  const h = liveHooks('Identify', [amulet]);
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  w.click(...MODE_ACTION);
  assert.equal(w.box?.buttons, 'YesNo');
  w.input('KeyY');
  assert.equal(h.committed.length, 1, 'the service was paid');
  assert.deepEqual(w.staged, [amulet], 'ConfirmTrade\'s Identify arm clears NOTHING (:1076-1084)');
  w.input('Escape');
  assert.deepEqual(h.entity.items, [amulet], 'and the pop hands the identified goods back');
});

// ── 2. the native Repair mode ─────────────────────────────────────

/** The Repair window as worldModes opens it: remoteItems IS
 *  PlayerEntity.OtherItems (:392) and the remote LIST is
 *  FilterRemoteItems' walk over it, which is repairJobsAt. */
function repairHooks(pack, { buildingKey = 7, now = 1000 } = {}) {
  const h = liveHooks('Repair', pack);
  h.nowMinutes = () => now;
  h.repairItems = () => repairJobsAt(h.entity, buildingKey, now);
  h.isBeingRepaired = (it) => isBeingRepaired(it);
  h.allowMagicRepairs = false;
  h.buildingKey = buildingKey;
  h.now = now;
  return h;
}

test('D7: Repair mode stages into PlayerEntity.OtherItems and prices the lot', () => {
  const it = sword();
  const h = repairHooks([it]);
  const w = new NativeTradeWindow(h);
  assert.deepEqual(w.remoteList(), [], 'nothing is in for repair yet');
  w.click(...LOCAL_SLOT0);
  assert.deepEqual(h.entity.otherItems, [it], 'the click moved it into the in-repair collection (:392, :795)');
  assert.deepEqual(w.remoteList(), [it], 'and FilterRemoteItems shows it on the right');
  assert.deepEqual(w.localList(), [], 'and it is gone from the left');
  const { cost, modeActionEnabled } = w.cost();
  assert.ok(cost > 0 && modeActionEnabled, 'UpdateCostAndGold prices anything not already being repaired (:466-471)');
});

test('D7: FilterRemoteItems hides a job left at ANOTHER shop and heals a finished one', () => {
  const here = sword({ name: 'Here', repairData: { buildingKey: 7, timeStarted: 0, repairTime: 1e9 } });
  const away = sword({ name: 'Away', repairData: { buildingKey: 99, timeStarted: 0, repairTime: 1e9 } });
  const done = sword({ name: 'Done', currentCondition: 10, repairData: { buildingKey: 7, timeStarted: 0, repairTime: 10 } });
  const h = repairHooks([]);
  h.entity.otherItems.push(here, away, done);
  const w = new NativeTradeWindow(h);
  assert.deepEqual(w.remoteList().map((i) => i.name), ['Here', 'Done'],
    '"not being repaired or are being repaired here" (:711-716)');
  assert.equal(done.currentCondition, done.maxCondition, 'IsRepairFinished heals on the way past (:717-718)');
});

test('D7: a job still under way raises ConfirmInterruptRepairBox; Yes takes it back partial', () => {
  const job = sword({ currentCondition: 20, repairData: { buildingKey: 7, timeStarted: 0, repairTime: 1e9 } });
  const h = repairHooks([]);
  h.entity.otherItems.push(job);
  const w = new NativeTradeWindow(h);
  w.click(...REMOTE_SLOT0);
  // the row itself, not the constant: DaggerfallTradeWindow.cs:846-848
  // hands GetLocalizedText("interruptRepair") straight to the box
  assert.equal(w.box?.rows?.[0]?.text, "Take back that item before it's repaired?",
    'the confirm is raised with Internal_Strings.csv:819 verbatim, not the item taken (:845-851)');
  assert.equal(INTERRUPT_REPAIR_TEXT, "Take back that item before it's repaired?");
  // and the keyed flow speaks that one constant rather than keeping a
  // second copy of the row of its own
  assert.match(src('scenes/worldModes.js'), /lines: \[INTERRUPT_REPAIR_TEXT\],/);
  assert.deepEqual(h.entity.items, [], 'and nothing has moved yet');
  w.input('KeyN');
  assert.deepEqual(h.entity.otherItems, [job], 'No leaves it with the shop');
  w.click(...REMOTE_SLOT0);
  w.input('KeyY');
  assert.deepEqual(h.entity.items, [job], 'Yes is TakeItemFromRepair (:857-862)');
  assert.equal(isBeingRepaired(job), false, 'RepairData.Collect() - the record leaves whole');
  assert.equal(job.currentCondition, 20, 'partial, and unrefunded');
});

test('D7: ClearSelectedItems returns everything NOT actively under way (:601-610)', () => {
  const staged = sword({ name: 'Staged' });
  const booked = sword({ name: 'Booked', repairData: { buildingKey: 7, timeStarted: 0, repairTime: 1e9 } });
  const h = repairHooks([staged]);
  h.entity.otherItems.push(booked);
  const w = new NativeTradeWindow(h);
  w.click(...LOCAL_SLOT0);
  assert.deepEqual(h.entity.otherItems.map((i) => i.name), ['Booked', 'Staged']);
  w.input('Escape');
  assert.deepEqual(h.entity.items.map((i) => i.name), ['Staged'], 'the unbooked item comes home');
  assert.deepEqual(h.entity.otherItems.map((i) => i.name), ['Booked'], 'the booked one stays with the shop');
});

test('D7: the host opens the native Repair screen when the art is up, keyed when it is not', () => {
  const wm = src('scenes/worldModes.js');
  const at = wm.indexOf('function openRepairService(ctx = {}) {');
  assert.ok(at > 0, 'openRepairService is gone');
  const body = wm.slice(at, at + 1100);
  assert.match(body, /if \(b && tradeArtLoaded\(\) && _shopFont\) \{/, 'no native arm');
  assert.match(body, /openTradeWindow\(shelf, b, 'Repair'/, 'the native arm must open the trade window in Repair mode');
  assert.match(body, /showRepairList\(0, ctx\);/, 'the keyed list must stay as the no-ARENA2 fallback');
  // ROAD-F GS1: both arms HAND BACK the window they mounted, because
  // the guild's Repair service reads the return value (it used to
  // re-read the interior slot, which above ground is always null) -
  // and the native arm's `b` gate is what makes the keyed list the
  // outdoor answer, there being no building record in the street.
  assert.match(body, /return mountServiceWindow\(openTradeWindow\(/, 'the native arm swallows its window');
  assert.match(body, /return showRepairList\(0, ctx\);/, 'the keyed arm swallows its window');
  // and the window is handed the two collections the mode needs
  assert.match(wm, /otherItems: \(\) => \(playerEntity\.otherItems \?\?= \[\]\),/);
  assert.match(wm, /repairItems: \(\) => repairJobsAt\(playerEntity, b\.buildingKey \?\? 0, Math\.floor\(worldMinutes\(\)\)\),/);
});

test('D7: the booked job carries this shop\'s key and CalculateItemRepairTime', () => {
  // the commit arm is the host's; this pins the two numbers it must
  // write - the shop's own buildingKey and CalculateItemRepairTime's
  // answer - which the keyed flow has always written.
  const wm = src('scenes/worldModes.js');
  assert.match(wm, /leaveForRepair\(it, bk, calculateItemRepairTime\(it\.currentCondition \?\? 0, it\.maxCondition \?\? 0\), now\);/);
  // and the number itself (FormulaHelper.cs:1924-1933): 50 points of
  // damage is trunc(50 * 1440 / 1000) = 72 minutes, which the one-day
  // floor raises to a full day
  assert.equal(calculateItemRepairTime(50, 100), MINUTES_PER_DAY);
  assert.equal(MINUTES_PER_DAY, 1440);
  // an unfloored case, so a constant return cannot pass either
  assert.equal(calculateItemRepairTime(0, 2500), 3600);
});

// ── 3. the potion recipe's info panel ─────────────────────────────

test('D7: a potion RECIPE\'s info panel is BUILT, not read out of TEXT.RSC', () => {
  const key = potionRecipeKey(POTION_RECIPES[0].ingredients);
  const recipe = { group: 'MiscItems', templateIndex: 278, potionRecipeKey: key };
  const rows = itemInfoRows(recipe, (id) => [{ text: `RECORD ${id}`, center: false }]);
  assert.equal(rows.length, 2, 'GetPotionRecipeTokens is four tokens - two lines, two JustifyCenters');
  assert.equal(rows[0].text, 'Recipe for Potion of Resist Fire');
  assert.match(rows[1].text, /^Weight: [\d.]+ kilograms$/);
  assert.ok(rows.every((r) => r.center === true), 'each line is followed by a JustifyCenter (:851, :853)');
  assert.ok(!rows.some((r) => r.text.includes('RECORD')), 'a recipe must not fall through to record 1003');
  // the strings are the reference tree's, macros included
  assert.equal(POTION_RECIPE_FOR_TEXT, 'Recipe for Potion of %po');
  assert.equal(POTION_RECIPE_WEIGHT_TEXT, 'Weight: %kg kilograms');
});

test('D7: an unknown recipe still names itself - DFU\'s own Unknown Powers', () => {
  const rows = itemInfoRows({ group: 'MiscItems', templateIndex: 278, potionRecipeKey: 255 }, () => []);
  assert.equal(rows[0].text, 'Recipe for Potion of Unknown Powers');
});

// ── 4. the item button's tooltip ──────────────────────────────────

test('D7: the scroller tooltip is ResolveItemLongName (ItemListScroller.cs:464)', () => {
  assert.equal(scrollerToolTipText(sword({ material: 9 })), 'Daedric Broadsword', 'the MATERIAL prefix is the long name\'s');
  assert.equal(scrollerToolTipText({ group: 'PlantIngredients1', templateIndex: 4, name: '%it' }), 'Jade (northern)',
    'the two plant groups differentiate their variants (:305-311)');
  assert.equal(scrollerToolTipText(null), null, 'an empty slot has no tip');
});

test('D7: the Books arm is `Books && !IsArtifact`, and the artifact keeps its own name', () => {
  const book = { group: 'Books', templateIndex: 277, name: 'Book', message: 5 };
  const tip = scrollerToolTipText(book);
  assert.equal(tip, "Ark'ay The God", 'GetBookTitle, not the short name');
  const artifactBook = { ...book, artifact: true, name: 'Mysterious Tome' };
  assert.equal(scrollerToolTipText(artifactBook), 'Mysterious Tome', 'an artifact tome reads as the artifact (:464)');
});

test('D7: ResolveItemName gives up the short name when the item is UNIDENTIFIED', () => {
  const enchanted = { group: 'Weapons', templateIndex: 118, name: 'Singing Blade', value: 1, material: 9, enchantments: [{ type: 1, param: 0 }] };
  assert.equal(resolveItemName(enchanted), 'Broadsword', 'the bare template (:270-271)');
  assert.equal(itemLongName(enchanted), 'Broadsword', 'and no material prefix either (:301-303)');
});

test('D7: the trade window carries the tooltip and clears it under a message box', () => {
  const it = sword({ material: 9 });
  const h = liveHooks('Sell', [it]);
  const w = new NativeTradeWindow(h);
  w.hover(...LOCAL_SLOT0);
  w.tick(10);                                  // past the rest delay
  assert.equal(w._tip.tip.text, 'Daedric Broadsword', 'the tip names the slot under the pointer');
  w.hover(2, 2);
  w.tick(10);
  assert.equal(w._tip.tip.text, null, 'and clears off the buttons');
  w.box = { rows: [{ text: 'x' }], buttons: null };
  w.hover(...LOCAL_SLOT0);
  w.tick(10);
  assert.equal(w._tip.tip.text, null, 'a pushed message box takes the mouse events with it');
});

test('D7: the potion maker\'s ingredient buttons carry the same tip', () => {
  const jade = { group: 'PlantIngredients1', templateIndex: 4, name: '%it' };
  const w = new PotionMakerWindow({ packItems: () => [jade], gold: () => 0, icons });
  // the first ingredient button: list rect (5,30) + the 11px scroller inset
  w.hover(5 + 11 + 14, 30 + 14);
  w.tick(10);
  assert.equal(w._tip.tip.text, 'Jade (northern)');
  w.hover(-1, -1);
  w.tick(10);
  assert.equal(w._tip.tip.text, null);
});
