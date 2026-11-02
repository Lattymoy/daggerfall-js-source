// APPEARANCES (2026-10-27; bible/04-Characters/Wardrobe.md): THE WARDROBE AT THE COUNTER - its row on a Clothing Store's,
// an Armorer's and a Weaponsmith's popup on both skins (the port's own row under DFU's art, the Portal Stone's law), the
// counter the interior host builds once, and the window: the worn pieces, a piece's collected looks with their fees, a
// Wear, a refusal that says why, and its own look back.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MerchantServiceWindow, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H, shopRowRect, portalRowRect, WARDROBE_ROW_KEY, wardrobeRowIndex,
} from '../../src/ui/merchant/merchantServiceWindow.js';
import { MerchantRepairWindow, REPAIR_PANEL_X, REPAIR_PANEL_Y, REPAIR_PANEL_H } from '../../src/ui/merchant/merchantRepairWindow.js';
import { createWardrobeCounter, WARDROBE_ROW } from '../../src/scenes/wardrobeCounter.js';
import { createShopRows } from '../../src/scenes/shopRows.js';
import { mountWardrobeWindow, WARDROBE_WORDS, wardrobeRefusal } from '../../src/ui/wardrobe/wardrobeWindow.js';
import { noteHeldLooks, wardrobeFee, wearAppearance, clearAppearance } from '../../src/systems/appearances.js';
import { lookOfKey } from '../../src/net/appearanceLaw.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { equipItem } from '../../src/systems/equip.js';
import { WEAPONS } from '../../src/characters/weapons.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { withDom } from '../invdrag.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const armour = (templateIndex, material, variant = 0) => mintCondition(setItemFields({ group: 'Armor', templateIndex, material, variant }));
const inside = ([x, y], [rx, ry]) => [x + rx + 2, y + ry + 2];
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;

test('APPEARANCES THE ROW: the port\'s rows stack under the popup\'s art - the Portal Stone\'s, then the Wardrobe\'s - on the merchant\'s and the repair shop\'s popups; pressed or keyed W, the popup closes and the Wardrobe opens; with no Wardrobe, no row (mutants: the rows on one place; the row\'s key; the repair popup\'s row unread; a press with no hook)', () => {
  assert.deepEqual(portalRowRect(MERCHANT_PANEL_H), [5, 44, 120, 10], 'the Portal Stone\'s, as it stood');
  assert.deepEqual(shopRowRect(MERCHANT_PANEL_H, 1), [5, 56, 120, 10], 'the next under it');
  assert.equal(WARDROBE_ROW_KEY, 'KeyW');
  assert.equal(wardrobeRowIndex({ portal: {} }), 1);
  assert.equal(wardrobeRowIndex({}), 0);
  let opened = 0, bought = 0;
  const hooks = (o = {}) => ({ service: 'Sell', onTalk() {}, onService() {}, portal: { label: 'Portal Stone', onBuy: () => { bought++; } }, wardrobe: { label: 'Wardrobe', onOpen: () => { opened++; } }, ...o });
  const svc = new MerchantServiceWindow(hooks());
  svc.click(...inside([MERCHANT_PANEL_X, MERCHANT_PANEL_Y], shopRowRect(MERCHANT_PANEL_H, 1)));
  assert.deepEqual([opened, bought, svc.done], [1, 0, true], 'pressed: the Wardrobe, the popup closed');
  new MerchantServiceWindow(hooks()).input(WARDROBE_ROW_KEY);
  assert.equal(opened, 2, 'W');
  const noPortal = new MerchantServiceWindow(hooks({ portal: undefined }));
  noPortal.click(...inside([MERCHANT_PANEL_X, MERCHANT_PANEL_Y], shopRowRect(MERCHANT_PANEL_H, 0)));
  assert.equal(opened, 3, 'first under the art where no Portal Stone stands');
  const none = new MerchantServiceWindow(hooks({ wardrobe: undefined }));
  none.click(...inside([MERCHANT_PANEL_X, MERCHANT_PANEL_Y], shopRowRect(MERCHANT_PANEL_H, 1)));
  none.input(WARDROBE_ROW_KEY);
  assert.equal(opened, 3, 'no Wardrobe: no row');
  assert.equal(none.done, false, 'and its key and its place do nothing - the popup stays');
  const rep = new MerchantRepairWindow({ onRepair() {}, onTalk() {}, onSell() {}, ...hooks() });
  rep.click(...inside([REPAIR_PANEL_X, REPAIR_PANEL_Y], shopRowRect(REPAIR_PANEL_H, 1)));
  assert.deepEqual([opened, rep.done], [4, true], 'the repair shop\'s popup');
  new MerchantRepairWindow({ onRepair() {}, onTalk() {}, onSell() {}, ...hooks() }).input(WARDROBE_ROW_KEY);
  assert.equal(opened, 5);
  // the Enhanced Plus panels list it as a press of its own, above the Portal Stone's (which stays above Exit)
  for (const f of ['src/ui/merchant/merchantServiceDoor.js', 'src/ui/merchant/merchantRepairDoor.js']) {
    assert.match(read(f), /\.\.\.\(hooks\.wardrobe\n\s*\? \[\n\s*\{\n\s*label: hooks\.wardrobe\.label,\n\s*icon: 'clothing',\n\s*onClick: \(\) => \{\n\s*close\(\);\n\s*hooks\.wardrobe\.onOpen\?\.\(\);\n\s*\},\n\s*\},\n\s*\]\n\s*: \[\]\),/, f);
  }
});

test('APPEARANCES THE COUNTER: the interior host builds it once and hands its row to both popups - at a Clothing Store, an Armorer and a Weaponsmith, never a General Store; a Wear and a clear are the law\'s on the wearer, the doll told after each that lands and never after a refusal (mutants: the row at every shop; the doll never told; the doll told of a refusal)', () => {
  const me = { items: [], goldPieces: 1000 };
  const sword = createWeapon(WEAPONS.Longsword, 1), katana = createWeapon(WEAPONS.Katana, 7);
  me.items.push(sword, katana);
  equipItem(me, sword);
  let told = 0;
  const mounted = [];
  const counter = createWardrobeCounter({ mount: (w) => { mounted.push(w); return w; }, entity: me, onDressed: () => { told++; } });
  for (const b of [BUILDING_TYPES.ClothingStore, BUILDING_TYPES.Armorer, BUILDING_TYPES.WeaponSmith]) assert.equal(counter.row(b)?.label, WARDROBE_ROW(), String(b));
  for (const b of [BUILDING_TYPES.GeneralStore, BUILDING_TYPES.Alchemist, undefined]) assert.equal(counter.row(b), undefined, String(b));
  assert.equal(WARDROBE_ROW(), 'Wardrobe');
  assert.equal(counter.open(), null, 'no page to draw on: nothing mounted');
  assert.deepEqual(me.appearances, ['120.1.0', '121.7.0'], 'the pack read as it opened');
  assert.equal(counter.wear(sword, lookOfKey('122.9.0')).ok, false);
  assert.equal(told, 0, 'a refusal tells nobody');
  assert.equal(counter.wear(sword, lookOfKey('121.7.0')).ok, true);
  assert.equal(told, 1);
  assert.equal(counter.clear(sword).ok, true);
  assert.equal(told, 2);
  assert.equal(counter.clear(sword).ok, false);
  assert.equal(told, 2);
  withDom(() => {
    const o = counter.open();
    assert.ok(o && mounted[0] === o && o.done === false, 'with a page: an overlay in the host\'s slot');
    o.dispose();
    assert.equal(o.done, true);
  });
  // the shop popups' rows, one door (scenes/shopRows.js): the Wardrobe at its three shops beside the Portal Stone, neither
  // where no shop stands; the host builds it once and spreads its rows into both popups
  const rows = createShopRows({ say: () => {}, mountInterior: () => {}, mountService: (w) => w });
  assert.deepEqual(Object.keys(rows.of(BUILDING_TYPES.Armorer)), ['portal', 'wardrobe']);
  assert.deepEqual(Object.keys(rows.of(BUILDING_TYPES.ClothingStore)), ['portal', 'wardrobe']);
  assert.deepEqual(Object.keys(rows.of(BUILDING_TYPES.GeneralStore)), ['portal'], 'a General Store: the Portal Stone alone');
  assert.deepEqual(Object.keys(rows.of(BUILDING_TYPES.Bank)), [], 'a bank: neither');
  assert.deepEqual(Object.keys(rows.of(null)), [], 'outside a building: neither');
  assert.equal(rows.of(BUILDING_TYPES.WeaponSmith).wardrobe.label, 'Wardrobe');
  const modes = read('src/scenes/worldModes.js');
  assert.match(modes, /const shopRows = createShopRows\(\{ say: \(l\) => say\(l\), mountInterior: \(w\) => mountInterior\(w\), mountService: mountServiceWindow \}\);/, 'built once');
  assert.match(modes, /onSell: \(\) => openMerchantSell\(\),\n\s+\.\.\.shopRows\.of\(interiorBuilding\?\.buildingType\),/, 'the repair shop\'s popup');
  assert.match(modes, /\.\.\.\(banking \|\| custom \? \{\} : shopRows\.of\(interiorBuilding\?\.buildingType\)\),/, 'the merchant\'s - never a teller\'s, never a mod\'s service');
});

test('APPEARANCES THE WINDOW: the worn pieces that can take a look, each with what it looks like now; the piece picked shows its own look (free, Worn while it wears no other) and every collected look of its kind with its fee - Wear lays it on and says so, a short purse says how much more, pressed it says why and takes nothing, and the own look\'s press gives it back (mutants: the fee unsaid; a refused press that wears; the own look not offered back; a piece that cannot take a look listed)', () => {
  const me = { items: [], goldPieces: 600 };
  const sword = createWeapon(WEAPONS.Longsword, 1), katana = createWeapon(WEAPONS.Katana, 7), saber = createWeapon(WEAPONS.Saber, 9), chest = armour(102, ARMOR_MATERIAL.Iron, 1);
  const ring = setItemFields({ group: 'Jewellery', templateIndex: 133 });
  me.items.push(sword, katana, saber, chest, ring);
  for (const it of [sword, chest, ring]) equipItem(me, it);
  noteHeldLooks(me);
  const calls = [];
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const view = mountWardrobeWindow(host, {
      entity: me, picture: () => null, nameOf: (it) => it.name,
      wear: (item, look) => { calls.push(['wear', item, look]); return wearAppearance(me, item, look); },
      clear: (item) => { calls.push(['clear', item]); return clearAppearance(me, item); },
    });
    try {
      const shell = one(host, 'wardrobe-shell');
      assert.equal(shell.attrs.role, 'dialog');
      assert.equal(shell.attrs['aria-label'], 'Wardrobe');
      const pieces = kids(shell, 'wardrobe-piece');
      assert.equal(pieces.length, 2, 'the cuirass and the sword - never the ring');
      assert.equal(one(pieces[0], 'broker-set').textContent, 'Chest · Own look');
      assert.equal(pieces[0].attrs['aria-pressed'], 'true', 'the first picked');
      assert.equal(one(shell, 'broker-purse').textContent, '600 gold');
      // the cuirass: its own look, no other collected
      let card = one(shell, 'wardrobe-card');
      assert.equal(kids(card, 'wardrobe-look').length, 1, 'its own look alone');
      assert.equal(one(card, 'wardrobe-nolooks').textContent, WARDROBE_WORDS.noLooks());
      assert.equal(one(card, 'wardrobe-count').textContent, 'Chest: 1 of 32 looks collected');
      // the sword
      pieces[1].onclick();
      card = one(shell, 'wardrobe-card');
      const looks = kids(card, 'wardrobe-look');
      assert.deepEqual(looks.map((l) => one(l, 'wardrobe-name').textContent), ['Its own look', 'Daedric Saber', 'Ebony Katana'], 'its own, then the catalogue\'s order');
      assert.deepEqual(looks.map((l) => one(l, 'broker-price').textContent), ['Free', `${wardrobeFee(lookOfKey('119.9.0'))} gold`, `${wardrobeFee(lookOfKey('121.7.0'))} gold`]);
      assert.equal(one(looks[0], 'wardrobe-press').textContent, 'Worn', 'its own look, worn');
      assert.equal(one(looks[0], 'wardrobe-press').attrs['aria-current'], 'true');
      const dear = one(looks[1], 'wardrobe-press');
      assert.equal(dear.textContent, `Need ${wardrobeFee(lookOfKey('119.9.0')) - 600} more gold`);
      assert.equal(dear.attrs['aria-disabled'], 'true');
      dear.onclick({ stopPropagation() {} });
      assert.equal(calls.length, 0, 'pressed, it takes nothing');
      assert.equal(one(shell, 'broker-note').textContent, wardrobeRefusal('gold'));
      one(looks[2], 'wardrobe-press').onclick({ stopPropagation() {} });
      assert.equal(calls.length, 1);
      assert.equal(one(shell, 'broker-note').textContent, `${sword.name} now looks like Ebony Katana.`);
      assert.equal(me.goldPieces, 600 - 480);
      card = one(shell, 'wardrobe-card');
      const after = kids(card, 'wardrobe-look');
      assert.equal(one(after[2], 'wardrobe-press').textContent, 'Worn');
      assert.equal(one(after[0], 'wardrobe-press').textContent, 'Wear', 'its own look offered back');
      assert.equal(one(kids(shell, 'wardrobe-piece')[1], 'broker-set').textContent, 'Right hand · Looks like Ebony Katana');
      one(after[0], 'wardrobe-press').onclick({ stopPropagation() {} });
      assert.deepEqual(calls.map((c) => c[0]), ['wear', 'clear']);
      assert.equal(one(shell, 'broker-note').textContent, `${sword.name} has its own look again.`);
      assert.equal(me.goldPieces, 120, 'for nothing');
      // nothing worn that can take a look
      me.equip = null; for (const it of me.items) delete it.equipSlot;
      view.repaint();
      assert.equal(one(shell, 'wardrobe-empty').textContent, WARDROBE_WORDS.none());
    } finally { view.unmount(); }
  });
});

test('APPEARANCES THE WORDS: every word the window says goes through the text core and keeps the plain-text law (mutants: a refusal\'s word lost)', () => {
  assert.equal(wardrobeRefusal('gold'), 'Not enough gold');
  assert.equal(wardrobeRefusal('worn'), 'You no longer wear that piece');
  assert.equal(wardrobeRefusal('same'), 'It already wears that look');
  assert.equal(WARDROBE_WORDS.sub(), 'Give a piece you wear any look of its kind you have collected. Only how it looks changes.');
  const src = read('src/ui/wardrobe/wardrobeWindow.js');
  // PIN MOVED (APPEARANCES-II): four more - the preview's head and its figure's name, a look's Try and its own look's
  assert.equal((src.match(/t\('wardrobe\./g) ?? []).length, 27, 'its words, each a key of its own - "Looks like" the pack\'s too (systems/appearances.js lookLine)');
});
