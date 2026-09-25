// DECOR2b (2026-09-25, Mac: decor "sold at shops not available in the world loot pool"; asked, the furniture shop sells
// "DF's own, delivered", and a delivered piece takes its look from Daggerfall's own pieces of its kind - "You pick it"):
// THE FURNISHER. The law's furniture on a model (net/decorLaw.js), the furnisher's pieces and how each stands
// (systems/decorFurnish.js), the Furniture Store's stock (systems/shopStock.js), the shop screens' carry gate and their
// steal (ui/nativeTrade.js driven, ui/enhancedTrade.js by source), the save's deliveries (systems/save.js), the panel's
// look view (ui/decorPanel.js), the tool setting furniture down as its look and taking it back (scenes/decorTool.js),
// and the host's wiring by source. The service's half is pinned with the service (decor1.test.js).
// `06-Systems/Online-Arc.md` DECOR2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decorWhatOf, decorPieceOf, DECOR_CAP, DECOR_FURNITURE_GROUP } from '../src/net/decorLaw.js';
import {
  FURNITURE_TEMPLATES, isFurnishing, furnishingKinds, furnishingLooks, decorFurnishingEntry, furnishingDeliveredLine,
  furnishingBackLine, ownBackLines,
} from '../src/systems/decorFurnish.js';
import { decorOwnBackLine } from '../src/systems/decorItems.js';
import { ITEM_GROUP_NAME_BY_CLASS } from '../src/systems/loot.js';
import { stockShopShelf, SHOP_ITEM_GROUPS, FURNISHER_CHANCE, isShop, shopBuysItem } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { planTake } from '../src/systems/itemTransfer.js';
import { NativeTradeWindow, TRADE_RECTS } from '../src/ui/nativeTrade.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { decorCatalogue, collectDecor } from '../src/systems/decorCatalogue.js';
import {
  createDecorPanel, decorFurnishLine, decorBackTo, decorPlacedSub, decorRowSub, DECOR_LOOK_BUTTON, DECOR_LOOK_LINE,
} from '../src/ui/decorPanel.js';
import { decorLookEntry } from '../src/scenes/decorTool.js';
import { itemLine } from '../src/ui/enhancedInventory.js';
import { settle, fakeDoc, fakeWin, all, one, catalogue, rows, rmb, toolRig } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const furn = (t, extra = {}) => ({ templateIndex: t, group: 'Furniture', stackCount: 1, ...extra });
const statue = () => ({ templateIndex: 265, group: 'ReligiousItems', stackCount: 1 });
const panelOf = (rig) => rig.doc.body.children.find((c) => c.className === 'dfdecor');
const barOf = (rig) => rig.doc.body.children.find((c) => String(c.className).startsWith('dfdecor-bar'));
const btn = (root, label) => all(root, 'dfdecor-btn').find((b) => (typeof label === 'string' ? b.textContent === label : label.test(b.textContent)));
const tab = (root, re) => all(root, 'dfdecor-chip').find((c) => re.test(c.textContent));
const pick = (root) => ['dfdecor-pick-name', 'dfdecor-pick-line', 'dfdecor-pick-price', 'dfdecor-pick-why'].map((c) => one(root, c).textContent);
const key = (rig, code) => rig.win.fire('keydown', { code, target: rig.doc.body });
const named = (root, name) => rows(root).find((r) => one(r, 'dfdecor-row-name').textContent.startsWith(name));

// ─── THE LAW ─────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2b the piece\'s law: a piece of one\'s own furniture may stand as a model - its descriptor\'s group Daggerfall\'s Furniture - and no other own item ever does; the model keeps its own bounds and is never a flat too; free and holding nothing, as every own piece (mutants: the group unread, any item on a model, a bad descriptor passed)', () => {
  assert.equal(DECOR_FURNITURE_GROUP, 8);
  assert.equal(ITEM_GROUP_NAME_BY_CLASS[DECOR_FURNITURE_GROUP], 'Furniture', 'Daggerfall\'s own number for the group');
  const bed = { t: 217, g: DECOR_FURNITURE_GROUP };
  assert.deepEqual(decorWhatOf({ model: 41000, flat: null, item: bed }), { model: 41000, flat: null, item: { t: 217, g: 8, m: null, v: null, a: null, p: null } });
  assert.deepEqual(decorWhatOf({ model: 41000, flat: null }), { model: 41000, flat: null }, 'a catalogue model carries none');
  assert.equal(decorWhatOf({ model: 41000, flat: null, item: { t: 265, g: 10 } }), null, 'a statue is never a model');
  assert.equal(decorWhatOf({ model: 41000, flat: null, item: { t: 217 } }), null, 'nor an item of no group');
  assert.equal(decorWhatOf({ model: 41000, flat: null, item: { t: -1, g: 8 } }), null, 'a bad descriptor refuses the piece');
  assert.equal(decorWhatOf({ model: 0, flat: null, item: bed }), null, 'the model\'s own bounds');
  assert.equal(decorWhatOf({ model: 41000, flat: [210, 3], item: bed }), null, 'never both');
  assert.deepEqual(decorWhatOf({ model: null, flat: [200, 11], item: { t: 235, g: 8 } })?.flat, [200, 11], 'a pillow stands as its own picture');
  const place = { id: 'f1', model: 41000, flat: null, item: bed, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 };
  assert.equal(decorPieceOf(place)?.model, 41000);
  assert.equal(decorPieceOf({ ...place, paid: 20 }), null, 'free');
  assert.equal(decorPieceOf({ ...place, storage: true }), null, 'and holding nothing');
});

// ─── THE FURNISHER'S PIECES ──────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2b the furnisher\'s pieces: Daggerfall\'s Furniture group, twenty-nine items (217 to 245), each furniture only in that group; a bed takes its look from the beds, a table or a chair from the furniture, curtains, a rug, a tapestry or skins from the furniture or the decorations, and a pillow stands as its own picture (TEXTURE.200 record 11); the panel\'s row names it, keys it, carries its numbers and its kinds - and no picture but a pillow\'s; what is said when it comes, and when it comes back from a room, beside the pack\'s own line (mutants: a kind misfiled, a pillow given looks, the group unread, a picture invented, one line for many, the furniture said to be in the pack)', () => {
  assert.deepEqual(FURNITURE_TEMPLATES, Array.from({ length: 29 }, (_, i) => 217 + i));
  assert.equal(isFurnishing(furn(221)), true);
  assert.equal(isFurnishing({ templateIndex: 221, group: 'MiscItems' }), false, 'the group');
  assert.equal(isFurnishing({ templateIndex: 265, group: 'Furniture' }), false, 'the template');
  assert.equal(isFurnishing(null), false);
  assert.deepEqual([217, 220, 221, 228, 229, 232, 233, 234, 237, 240, 241, 243, 244, 245, 235, 236].map((t) => furnishingKinds(furn(t))), [
    ['bed'], ['bed'], ['furniture'], ['furniture'], ['furniture'], ['furniture'], ['furniture', 'decor'], ['furniture', 'decor'],
    ['furniture', 'decor'], ['furniture', 'decor'], ['furniture', 'decor'], ['furniture', 'decor'], ['furniture', 'decor'], ['furniture', 'decor'], null, null,
  ]);
  assert.equal(furnishingKinds(statue()), null);
  const cat = decorCatalogue(collectDecor([rmb([41105, 41106, 41000, 41811], [[210, 3], [209, 0], [200, 7]])]));
  const keys = (kinds) => cat.filter((e) => kinds.includes(e.kind)).map((e) => e.key);
  assert.deepEqual([keys(['bed']), keys(['furniture']), keys(['decor'])], [['m41000'], ['m41105', 'm41106'], ['f200.7']], 'a bed, two tables or chairs, a decoration');
  assert.deepEqual(furnishingLooks(furn(217), cat).map((e) => e.key), ['m41000']);
  assert.deepEqual(furnishingLooks(furn(229), cat).map((e) => e.key), ['m41105', 'm41106']);
  assert.deepEqual(furnishingLooks(furn(237), cat).map((e) => e.key), ['m41105', 'm41106', 'f200.7']);
  assert.deepEqual(furnishingLooks(furn(235), cat), [], 'a pillow has none to choose');
  // the row
  const bed = decorFurnishingEntry(furn(219), 3);
  assert.deepEqual([bed.key, bed.kind, bed.furnishing, bed.own?.templateIndex, bed.name, bed.model, bed.flat, bed.looks, bed.icon, bed.light, bed.storage, bed.count],
    ['furnish:3', 'own', true, 219, 'Plain Double Bed', null, null, ['bed'], null, null, false, 1]);
  assert.deepEqual(bed.item, { t: 219, g: 8, m: null, v: null, a: null, p: null });
  const pillow = decorFurnishingEntry(furn(235), 0);
  assert.deepEqual([pillow.flat, pillow.looks, pillow.icon, pillow.item.g], [[200, 11], null, { archive: 200, record: 11, dye: null }, 8]);
  assert.equal(decorFurnishingEntry(statue(), 0), null);
  // what is said
  assert.equal(furnishingDeliveredLine(['Oak Chair']), 'The Oak Chair will be delivered - set it down from the Decorate panel in any room you can decorate.');
  assert.equal(furnishingDeliveredLine(['Oak Chair', 'Curtains', 'Small Pillow']), '3 pieces of furniture will be delivered - set them down from the Decorate panel in any room you can decorate.');
  assert.equal(furnishingBackLine(1), 'A piece of your furniture came back to Your things.');
  assert.equal(furnishingBackLine(2), '2 pieces of your furniture came back to Your things.');
  assert.equal(ownBackLines([statue(), furn(221), statue(), furn(229)], decorOwnBackLine),
    '2 of your things that stood in it came back to your pack. 2 pieces of your furniture came back to Your things.');
  assert.equal(ownBackLines([furn(221)], decorOwnBackLine), 'A piece of your furniture came back to Your things.', 'no pack line for none');
  assert.equal(ownBackLines([statue()], decorOwnBackLine), 'One of your things that stood in it came back to your pack.');
});

// ─── THE STOCK ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2b the Furniture Store stocks Daggerfall\'s furniture by Daggerfall\'s own stock law - a piece\'s rarity within the shop\'s quality, then the dice by its rarity - at the port\'s own chance (fifty, the clothier\'s), and nothing else; no other shop stocks any of it; the store buys it back, as Daggerfall\'s own table says (mutants: the store skipped, its chance another, the rarity gate)', () => {
  const fs = (quality, roll) => stockShopShelf({ buildingType: BUILDING_TYPES.FurnitureStore, quality }, { level: 1 }, { rolls: () => roll }).map((it) => it.templateIndex);
  assert.equal(FURNISHER_CHANCE, 50);
  assert.deepEqual(SHOP_ITEM_GROUPS[BUILDING_TYPES.FurnitureStore], [0x08, FURNISHER_CHANCE]);
  const best = stockShopShelf({ buildingType: BUILDING_TYPES.FurnitureStore, quality: 21 }, { level: 1 }, { rolls: () => 0 });
  assert.deepEqual(best.map((it) => it.templateIndex), FURNITURE_TEMPLATES, 'every piece, in a shop good enough');
  assert.ok(best.every((it) => it.group === 'Furniture' && isFurnishing(it)));
  assert.deepEqual(fs(3, 0), [217, 218, 219, 221, 225, 226, 229, 230, 231, 233, 235, 236, 237, 243, 244, 245], 'a rarity within the shop\'s quality');
  assert.deepEqual(fs(21, 0.47), [217, 225, 229, 236], 'the dice by rarity: a rarity-one piece at fifty in a hundred, a rarity-two at forty-seven');
  assert.deepEqual(fs(21, 0.46), [217, 219, 221, 225, 229, 230, 235, 236, 237, 243, 245]);
  for (const [name, type] of Object.entries(BUILDING_TYPES)) {
    if (type === BUILDING_TYPES.FurnitureStore || !isShop(type)) continue;
    assert.ok(!stockShopShelf({ buildingType: type, quality: 21 }, { level: 1 }, { rolls: () => 0 }).some((it) => it.group === 'Furniture'), name);
  }
  assert.equal(shopBuysItem(BUILDING_TYPES.FurnitureStore, furn(221)), true);
  // on the enhanced shelf: Daggerfall gives the group no picture but the pillows' - initials, as the classic drawer
  // draws none (nativeInventory.js), never TEXTURE.000's solid colour
  assert.equal(itemLine(furn(221)).image, null);
  assert.deepEqual([itemLine(furn(235)).image?.archive, itemLine(furn(235)).image?.record], [200, 11]);
});

// ─── THE SHOP SCREENS ────────────────────────────────────────────────────────────────────────────────────────────────

function tradeWin(shelf, hooks = {}) {
  const pack = [];
  const log = [];
  const w = new NativeTradeWindow({
    mode: 'Buy', shelfItems: () => shelf, packItems: () => pack, otherItems: () => [], isEquipped: () => false, accepts: () => true,
    enchanted: () => false, priceCtx: () => ({ quality: 10, priceAdjustment: 1, skills: {} }), gold: () => 100000, rows: () => [],
    weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 500 }), commit: () => true,
    icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() },
    entity: { stats: { strength: 50 }, items: pack }, pickpocketSkill: () => 50, tallyPickpocket: () => {}, tallyCrimeGuild: () => {},
    crimeTheft: () => {}, spawnCityGuards: () => {}, say: (line) => log.push(['say', line]), deliver: (items) => log.push(['deliver', items.map((it) => it.templateIndex)]),
    ...hooks,
  });
  return { w, pack, log };
}

test('DECOR2b the shop screens: a piece of furniture is staged whatever it weighs - a bed no one could carry - and weighs nothing in what the player walks out with; stolen, the furniture goes to the host\'s delivery and the rest to the pack, and a host with no delivery carries it as before; the enhanced screen asks the one gate at its selection and its click, and its steal delivers both ways (mutants: the gate asked of furniture, the basket\'s furniture weighed, stolen furniture carried)', () => {
  const bed = furn(219, { value: 150, weightInKg: 700 });
  const dagger = { group: 'Weapons', templateIndex: 113, name: 'Dagger', value: 40, weightInKg: 0.5 };
  assert.equal(planTake(bed, { bag: [], entity: { stats: { strength: 50 } } }).ok, false, 'no one carries a bed');
  const shelf = [bed, dagger];
  const { w, pack, log } = tradeWin(shelf);
  w._pickRemote(0);
  w._pickRemote(0);
  assert.deepEqual(w.basket.map((it) => it.templateIndex), [219, 113], 'the bed staged beside the dagger');
  assert.equal(w._carriedWeight(), 0.5, 'the bed weighs nothing the player carries');
  const real = Math.random;
  Math.random = () => 0.99;   // got away with it
  try { const [x, y, rw, rh] = TRADE_RECTS.steal; w.click(x + rw / 2, y + rh / 2); } finally { Math.random = real; }
  assert.deepEqual(log.find((l) => l[0] === 'deliver'), ['deliver', [219]], 'the bed is delivered');
  assert.deepEqual(pack.map((it) => it.templateIndex), [113], 'and only the dagger carried');
  // a host with no delivery
  const bare = tradeWin([furn(229, { value: 35, weightInKg: 10 })], { deliver: undefined });
  bare.w._pickRemote(0);
  Math.random = () => 0.99;
  try { const [x, y, rw, rh] = TRADE_RECTS.steal; bare.w.click(x + rw / 2, y + rh / 2); } finally { Math.random = real; }
  assert.deepEqual(bare.pack.map((it) => it.templateIndex), [229], 'carried as before');
  // the enhanced screen, by source
  const e = src('src/ui/enhancedTrade.js');
  assert.match(e, /if \(inBuy\(\)\) return buyPlan\(item\)\.ok;/, 'the selection\'s dry run asks the one gate');
  assert.match(e, /function pickRemote\(item\) \{\n  if \(inBuy\(\)\) \{\n    const plan = buyPlan\(item\);/, 'and so does the click');
  assert.match(e, /function buyPlan\(item\) \{\n  if \(isFurnishing\(item\)\) return \{ ok: true, amount: item\.stackCount \?\? 1 \};\n  return planTake\(item, \{ bag: \[\.\.\.deps\.packItems\(\), \.\.\.basket\.filter\(\(x\) => !isFurnishing\(x\)\)\], entity: deps\.entity \?\? null \}\);/);
  assert.match(e, /if \(basket\.length\) \{ deliverFurniture\(basket\); transferAll\(basket, deps\.packItems\(\)\); \}\n    else if \(!deliverFurniture\(deps\.shelfItems\(\), items\[0\]\)\) move\(items\[0\], deps\.shelfItems\(\), deps\.packItems\(\)\);/);
  assert.match(e, /if \(!deps\.deliver\) return 0;\n  const going = list\.filter\(\(it\) => isFurnishing\(it\) && \(one === null \|\| it === one\)\);\n  for \(const it of going\) list\.splice\(list\.indexOf\(it\), 1\);\n  if \(going\.length\) deps\.deliver\(going\);\n  return going\.length;/);
  assert.match(e, /return carriedWeight\(entity \?\? \{\}\) \+ totalWeight\(basket\.filter\(\(x\) => !isFurnishing\(x\)\)\);/);
});

// ─── THE SAVE ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2b the save keeps what the furnisher delivered and is standing nowhere - written as copies, read back set as every item is; a save written before holds none (mutants: the deliveries forgotten, shared)', () => {
  const entity = { name: 'Mac', stats: { strength: 55 }, skills: [], items: [], spells: [], furnishings: [furn(229), furn(235)] };
  const snap = snapshotPlayer(entity, {});
  assert.deepEqual(snap.furnishings.map((it) => it.templateIndex), [229, 235]);
  assert.notEqual(snap.furnishings[0], entity.furnishings[0], 'a copy');
  const back = {};
  restorePlayer(back, snap);
  assert.deepEqual(back.furnishings.map((it) => [it.templateIndex, it.group]), [[229, 'Furniture'], [235, 'Furniture']]);
  assert.notEqual(back.furnishings[0], snap.furnishings[0], 'read back as its own, not the snapshot\'s');
  const old = {};
  restorePlayer(old, { ...snap, furnishings: undefined });
  assert.deepEqual(old.furnishings, [], 'none');
});

// ─── THE PANEL ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2b the panel: delivered furniture among "Your things" - its kind\'s letters for a picture (a pillow its own), what it is said to be, and "Choose its look"; pressed, the LOOK view: the catalogue on its kinds alone, every look free, the kind, holding and light chips put away, the furniture\'s own name over the look pointed at; Place hands the tool the furniture and the look, the panel going first; "Your things" is the tab pressed and takes the view back; the furniture gone, the view goes back to the list; showLook opens it on a look; in the room a piece of furniture goes back to "Your things" (mutants: the look view unfiltered, a look priced, Place past the look, the look lost, the furniture\'s name lost, the room\'s words the pack\'s)', async () => {
  const doc = fakeDoc();
  const win = fakeWin();
  const calls = [];
  let closed = 0;
  const panel = createDecorPanel({
    doc, win, onPlace: (e) => calls.push(['place', e.key]), onPlaceLook: (f, l) => calls.push(['look', f.key, l.key]), onClose: () => { closed++; },
    onRemove: (p) => calls.push(['remove', p.id]), thumbOf: async (e) => `data:${e.key}`,
  });
  const entries = decorCatalogue(collectDecor([rmb([41105, 41105, 41106, 41000, 41811], [[210, 3], [209, 0], [200, 7]])]));
  const chairLooks = entries.filter((e) => e.kind === 'furniture').map((e) => e.key);
  const curtainLooks = entries.filter((e) => e.kind === 'furniture' || e.kind === 'decor').map((e) => e.key);
  let own = [decorFurnishingEntry(furn(229), 0), decorFurnishingEntry(furn(235), 1), decorFurnishingEntry(furn(233), 2)];
  const mine = { id: 'f9', model: 41106, flat: null, item: { t: 229, g: 8 }, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 };
  let count = 1;
  const view = () => ({
    where: 'Your house', entries, progress: 1, ready: true, gold: 0, count, cap: DECOR_CAP, radiusOf: () => 0.5, priceOf: () => 75,
    placed: [{ piece: mine, name: 'Oak Chair', entry: null, holds: false, own: true }], own,
  });
  panel.open(view());
  const root = panel.root;
  const card = one(root, 'dfdecor-card');
  tab(root, /^Your things/).fire('click');
  const line = (r) => [one(r, 'dfdecor-row-name').textContent, one(r, 'dfdecor-row-sub').textContent, one(r, 'dfdecor-row-price').textContent];
  assert.deepEqual(rows(root).map(line), [
    ['Oak Chair', 'delivered - free to set down as any of the furniture you choose, and back here when taken down', 'free'],
    ['Large Pillow', 'delivered - free to set down, and back here when taken down', 'free'],
    ['Curtains', 'delivered - free to set down as any of the furniture or decorations you choose, and back here when taken down', 'free'],
  ]);
  assert.equal(decorFurnishLine(own[0]), line(rows(root)[0])[1]);
  await settle();
  assert.deepEqual([one(rows(root)[0], 'dfdecor-thumb').textContent, one(rows(root)[0], 'dfdecor-thumb').children.length], ['Fu', 0], 'no picture of its own: its kind\'s letters');
  assert.equal(one(rows(root)[1], 'dfdecor-thumb').children[0].getAttribute('src'), 'data:furnish:1', 'a pillow\'s own picture');
  rows(root)[1].fire('click');
  assert.equal(btn(root, /^(Place|Choose its look)$/).textContent, 'Place', 'a pillow is set down as it is');
  rows(root)[0].fire('click');
  assert.deepEqual(pick(root), ['Oak Chair', decorFurnishLine(own[0]), 'Free', '']);
  const choose = btn(root, DECOR_LOOK_BUTTON);
  assert.equal(choose.disabled, false);
  choose.fire('click');
  assert.deepEqual([panel.mode(), card.dataset.mode, panel.isOpen(), closed, calls], ['look', 'look', true, 0, []], 'its look first - nothing placed yet');
  assert.deepEqual([rows(root).map((r) => r.dataset.key), chairLooks], [['m41105', 'm41106'], ['m41105', 'm41106']], 'the chair\'s kinds alone');
  assert.ok(rows(root).every((r) => one(r, 'dfdecor-row-price').textContent === 'free' && r.className === 'dfdecor-row'), 'every look free');
  assert.equal(tab(root, /^Your things/).getAttribute('aria-pressed'), 'true', 'a look is chosen within "Your things"');
  assert.deepEqual(pick(root).slice(0, 3), ['Oak Chair', DECOR_LOOK_LINE, 'Free']);
  assert.deepEqual([btn(root, 'Place')?.disabled], [true], 'no look chosen yet');
  const second = entries.find((e) => e.key === chairLooks[1]);
  rows(root)[1].fire('click');
  assert.deepEqual(pick(root), ['Oak Chair', `as ${second.name} - ${decorRowSub(second, 0.5)}`, 'Free', '']);
  assert.equal(btn(root, 'Place').disabled, false, 'free - whatever the gold (none here)');
  count = DECOR_CAP;
  panel.update(view());
  assert.deepEqual([btn(root, 'Place').disabled, pick(root)[3]], [true, `This room already holds ${DECOR_CAP} pieces.`]);
  count = 1;
  panel.update(view());
  btn(root, 'Place').fire('click');
  assert.deepEqual([closed, panel.isOpen(), calls], [1, false, [['look', 'furnish:0', second.key]]], 'the panel goes, then the placing begins');
  // showLook: a look chosen, the kinds of the curtains
  panel.open(view());
  panel.showLook('furnish:2', 'f200.7');
  assert.deepEqual([rows(root).map((r) => r.dataset.key), curtainLooks], [['m41105', 'm41106', 'f200.7'], ['m41105', 'm41106', 'f200.7']]);
  assert.equal(rows(root).find((r) => r.dataset.key === 'f200.7').getAttribute('aria-selected'), 'true');
  assert.equal(pick(root)[0], 'Curtains');
  tab(root, /^Your things/).fire('click');
  assert.deepEqual([panel.mode(), pick(root)[0]], ['own', 'Curtains'], 'the tab takes the view back, the furniture still chosen');
  // the furniture gone while its look was being chosen
  panel.showLook('furnish:0');
  own = own.slice(1);
  panel.update(view());
  assert.deepEqual([panel.mode(), card.dataset.mode], ['own', 'own'], 'back to the list');
  // in the room
  panel.showRoom('f9');
  assert.deepEqual(line(rows(root)[0]), ['Oak Chair', 'yours - back to Your things when taken down', 'yours']);
  assert.equal(pick(root)[2], 'Take down: back to Your things');
  assert.deepEqual([decorBackTo(mine), decorBackTo({ item: { t: 265, g: 10 } }), decorBackTo({ item: { t: 265 } })], ['Your things', 'your pack', 'your pack']);
  assert.equal(decorPlacedSub({ piece: mine, holds: false }), 'yours - back to Your things when taken down');
  panel.destroy();
});

// ─── THE TOOL ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function openAll(rig) {
  rig.frame();
  assert.equal(rig.tool.openPanel(), true);
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
}
const flight = async (rig) => { rig.frame(); await settle(); rig.frame(); };
/** From "Your things": the furniture named `name`, its look `lookKey` chosen, and Place - the flight's first frames. */
async function setDownAs(rig, name, lookKey) {
  const root = panelOf(rig);
  if (one(root, 'dfdecor-card').dataset.mode !== 'own') tab(root, /^Your things/).fire('click');
  named(root, name).fire('click');
  btn(root, DECOR_LOOK_BUTTON).fire('click');
  rows(root).find((r) => r.dataset.key === lookKey).fire('click');
  btn(root, 'Place').fire('click');
  await flight(rig);
}

test('DECOR2b setting delivered furniture down: listed among "Your things" after the pack\'s; a bed chooses its look among the beds and the flight flies the look\'s own model, free, its piece the look\'s shape and the bed\'s own numbers; Back is the look view again, the look still chosen; set down, the bed leaves the deliveries whole into the room\'s keeping - never the pack - and stands named as itself; moved it keeps its look and stays free; taken down it is delivered again and said so; a pillow is set down as its own picture (mutants: the look lost, the bed\'s numbers dropped, the bed into the pack, a model moved as a flat, Back to the list, the pack\'s words for furniture)', async () => {
  const rig = toolRig({ gold: 0 });
  const bed = furn(219);
  const pillow = furn(235);
  rig.furnishings.push(bed, pillow);
  rig.pack.push(statue());
  await openAll(rig);
  let root = panelOf(rig);
  tab(root, /^Your things/).fire('click');
  assert.deepEqual(rows(root).map((r) => one(r, 'dfdecor-row-name').textContent), ['Small Statue', 'Plain Double Bed', 'Large Pillow']);
  assert.equal(one(named(root, 'Plain Double Bed'), 'dfdecor-thumb').textContent, 'Be', 'a bed\'s letters are its kind\'s');
  named(root, 'Plain Double Bed').fire('click');
  btn(root, DECOR_LOOK_BUTTON).fire('click');
  assert.deepEqual(rows(root).map((r) => r.dataset.key), rig.entries.filter((e) => e.kind === 'bed').map((e) => e.key), 'the beds alone');
  const look = rig.entries.find((e) => e.model === 41001);
  rows(root).find((r) => r.dataset.key === look.key).fire('click');
  btn(root, 'Place').fire('click');
  await flight(rig);
  assert.equal(rig.tool.flying(), true);
  assert.equal(one(barOf(rig), 'dfdecor-bar-what').textContent, 'Plain Double Bed - free');
  const ghost = rig.tool.ghost();
  assert.deepEqual([ghost.model, ghost.flat, ghost.item, ghost.paid, ghost.storage, ghost.light], [41001, null, { t: 219, g: 8, m: null, v: null, a: null, p: null }, 0, false, null]);
  assert.equal(rig.tool.why(), null, 'no gold needed');
  // Back: the look view, the look still chosen
  key(rig, 'Escape');
  root = panelOf(rig);
  assert.equal(one(root, 'dfdecor-card').dataset.mode, 'look');
  assert.equal(rows(root).find((r) => r.dataset.key === look.key).getAttribute('aria-selected'), 'true');
  btn(root, 'Place').fire('click');
  await flight(rig);
  key(rig, 'KeyE');
  await settle();
  const piece = rig.standing[0];
  assert.deepEqual([piece.model, piece.item.t, piece.item.g, rig.w.paid], [41001, 219, 8, []]);
  assert.equal(rig.owned.get(piece.id), bed, 'the bed itself in the room\'s keeping');
  assert.deepEqual([rig.furnishings.includes(bed), rig.pack.includes(bed)], [false, false], 'out of the deliveries, and never into the pack');
  assert.deepEqual([one(panelOf(rig), 'dfdecor-card').dataset.mode, rig.said.at(-1)], ['own', 'Plain Double Bed set down.']);
  // in the room: named as itself; moved, it keeps its look and stays free
  rig.frame();
  root = panelOf(rig);
  tab(root, /^In this room/).fire('click');
  assert.equal(one(rows(root).find((r) => r.dataset.key === piece.id), 'dfdecor-row-name').textContent, 'Plain Double Bed');
  rows(root).find((r) => r.dataset.key === piece.id).fire('click');
  btn(root, 'Move').fire('click');
  await flight(rig);
  assert.equal(one(barOf(rig), 'dfdecor-bar-what').textContent, 'Moving Plain Double Bed - free');
  assert.deepEqual([rig.tool.ghost().model, rig.tool.ghost().flat, rig.tool.ghost().item?.g], [41001, null, 8], 'the same look, the same bed');
  key(rig, 'Equal');
  rig.frame();
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.standing[0].model, rig.standing[0].scale, rig.standing[0].paid, rig.w.paid], [41001, 1.1, 0, []]);
  // taken down: delivered again
  rig.frame();
  rows(panelOf(rig)).find((r) => r.dataset.key === piece.id).fire('click');
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([rig.standing.length, rig.furnishings.includes(bed), rig.pack.includes(bed)], [0, true, false], 'among the deliveries again');
  assert.equal(rig.said.at(-1), 'Plain Double Bed taken down - set it down again from Your things.');
  // a pillow: as its own picture
  rig.frame();
  root = panelOf(rig);
  tab(root, /^Your things/).fire('click');
  named(root, 'Large Pillow').fire('click');
  btn(root, 'Place').fire('click');
  await flight(rig);
  assert.deepEqual([rig.tool.ghost().model, rig.tool.ghost().flat, rig.tool.ghost().item.t], [null, [200, 11], 235]);
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([rig.standing.length, rig.furnishings.includes(pillow)], [1, false]);
  // the look entry itself: the look's shape, the furniture's own
  const entry = decorLookEntry({ key: 'own:1', own: bed, name: 'Plain Double Bed', item: ghost.item, count: 1 }, { ...look, light: { color: [1, 1, 1], range: 5, intensity: 1 }, storage: true });
  assert.deepEqual([entry.kind, entry.furnishing, entry.name, entry.model, entry.flat, entry.light, entry.storage, entry.look], ['own', true, 'Plain Double Bed', 41001, null, null, false, look.key], 'never the look\'s light or holding');
  const rug = decorLookEntry({ key: 'own:2', own: furn(237), name: 'Small Plain Rug', item: { t: 237, g: 8 }, count: 1 }, { key: 'f200.7', model: null, flat: [200, 7] });
  assert.deepEqual([rug.model, rug.flat, rug.item], [null, [200, 7], { t: 237, g: 8 }], 'a decoration\'s look is its picture');
});

test('DECOR2b furniture and an online home: the account service has the model and the bed\'s own numbers first, and only then does the bed leave the deliveries - refused, it never leaves; gone from the deliveries while the service was asked, the piece is taken back out and the bar says so; taken down, the service first, then delivered again (mutants: the bed gone before the answer, a refusal taking it, the undo skipped)', async () => {
  const calls = [];
  const svc = {
    answer: null,
    async place(a) { calls.push(['place', a.piece]); return svc.answer ? svc.answer(a) : { ok: true, data: { piece: a.piece } }; },
    async move(a) { calls.push(['move', a.id]); return { ok: true, data: { piece: a.place } }; },
    async remove(a) { calls.push(['remove', a.id]); return { ok: true, data: {} }; },
  };
  const rig = toolRig({ room: { kind: 'home', where: 'Your home', mapId: 77, buildingKey: 9 }, homeDecor: svc, gold: 0 });
  const bed = furn(217);
  rig.furnishings.push(bed);
  await openAll(rig);
  const look = rig.entries.find((e) => e.model === 41000);
  await setDownAs(rig, 'Plain Single Bed', look.key);
  // refused
  svc.answer = () => ({ ok: false, error: 'decor-rate' });
  key(rig, 'KeyE');
  await settle();
  rig.frame();
  assert.deepEqual([rig.furnishings.includes(bed), rig.standing.length, rig.tool.why()], [true, 0, 'refused: decor-rate'], 'refused: it never leaves');
  const sent = calls[0][1];
  assert.deepEqual([sent.model, sent.flat, sent.item, sent.paid, sent.storage], [41000, null, { t: 217, g: 8, m: null, v: null, a: null, p: null }, 0, false], 'the model and the bed\'s own numbers');
  assert.ok(decorPieceOf(sent), 'a piece the law takes');
  // gone from the deliveries while the service was asked
  svc.answer = (a) => { rig.furnishings.splice(rig.furnishings.indexOf(bed), 1); return { ok: true, data: { piece: a.piece } }; };
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  assert.deepEqual([calls.map((c) => c[0]), rig.standing.length], [['place', 'remove'], 0], 'taken back out');
  rig.frame();
  assert.equal(rig.tool.why(), 'It is no longer among your things.');
  rig.furnishings.push(bed);
  // set down
  svc.answer = null;
  calls.length = 0;
  key(rig, 'KeyE');
  await settle();
  const piece = rig.standing[0];
  assert.ok(piece && rig.owned.get(piece.id) === bed && !rig.furnishings.includes(bed), 'the service had it, then the deliveries gave it up');
  // taken down: the service first, then delivered again
  rig.frame();
  tab(panelOf(rig), /^In this room/).fire('click');
  rows(panelOf(rig)).find((r) => r.dataset.key === piece.id).fire('click');
  btn(panelOf(rig), 'Take down').fire('click');
  await settle();
  assert.deepEqual([calls.map((c) => c[0]), rig.standing.length, rig.furnishings.includes(bed)], [['place', 'remove'], 0, true]);
});

// ─── THE HOST ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('DECOR2b the host (worldModes.js) by source: the tool reads the deliveries; a piece of furniture lives among them, is taken out of them whole and given back to them - never the pack; bought at the counter, bought by the keyed list, stolen off the shelf by either screen, or carried out of a closed shop, it is delivered and said once for the lot; a sold room and an online home\'s strays say where the furniture went (mutants: the deliveries unread, furniture into the pack at the counter, the keyed buy, the steal or the closed shop, one line per piece)', () => {
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /furnishings: \(\) => playerEntity\.furnishings \?\? \[\],/);
  assert.match(m, /function decorPackTake\(item\) \{\n\s*if \(isFurnishing\(item\)\) \{[^\n]*\n\s*const list = decorHome\(item\);\n\s*const i = list\.indexOf\(item\);\n\s*if \(i < 0\) return null;\n\s*list\.splice\(i, 1\);\n\s*return item;\n\s*\}/, 'whole, out of the deliveries');
  assert.match(m, /function decorPackGive\(item\) \{\n\s*if \(isFurnishing\(item\)\) \{ decorHome\(item\)\.push\(item\); return; \}/, 'given back to the deliveries');
  assert.match(m, /function decorHome\(item\) \{\n\s*if \(isFurnishing\(item\)\) return \(playerEntity\.furnishings \?\?= \[\]\);\n\s*return \(playerEntity\.items \?\?= \[\]\);/);
  assert.match(m, /function decorDeliver\(items\) \{\n\s*if \(!items\.length\) return;\n\s*for \(const it of items\) decorHome\(it\)\.push\(it\);\n\s*say\(furnishingDeliveredLine\(items\.map\(\(it\) => itemLongName\(it\)\)\)\);/, 'said once for the lot');
  assert.match(m, /if \(i >= 0\) shelf\.items\.splice\(i, 1\);\n\s*if \(!isFurnishing\(it\)\) addItem\(playerEntity\.items, it\);\n\s*\}\n\s*decorDeliver\(staged\.filter\(isFurnishing\)\);/, 'the counter');
  assert.match(m, /if \(isFurnishing\(it\)\) decorDeliver\(\[it\]\);[^\n]*\n\s*else addItem\(playerEntity\.items, it\);/, 'the keyed list');
  assert.match(m, /packItems: \(\) => \(playerEntity\.items \?\?= \[\]\),\n\s*deliver: \(items\) => decorDeliver\(items\),/, 'the steal');
  assert.match(m, /if \(shopShelfTheft\(shelfBefore, shelf\.items\.length\)\) tallyCrimeGuildRequirements\(playerEntity, true, 1\);\n\s*decorDeliverCarried\(\);/, 'the closed shop');
  assert.match(m, /function decorDeliverCarried\(\) \{\n\s*const pack = playerEntity\.items \?\? \[\];\n\s*const carried = pack\.filter\(isFurnishing\);\n\s*for \(const it of carried\) pack\.splice\(pack\.indexOf\(it\), 1\);\n\s*decorDeliver\(carried\);/);
  assert.match(m, /if \(own\.length\) say\(ownBackLines\(own, decorOwnBackLine\)\);/, 'a sold house or ship');
  assert.match(m, /homeSoldLine\(r\.refund, r\.decorBack\) \+ \(own\.length \? ` \$\{ownBackLines\(own, decorOwnBackLine\)\}` : ''\)/, 'a sold online home');
  assert.match(m, /if \(back\.length\) say\(ownBackLines\(back, \(n\) =>/, 'the strays');
  const n = src('src/ui/nativeTrade.js');
  assert.match(n, /this\._deliverFurniture\(this\.basket\);[^\n]*\n\s*transferAll\(this\.basket, this\.hooks\.packItems\(\)\);/);
  assert.match(n, /const plan = isFurnishing\(item\) \? \{ ok: true, amount: item\.stackCount \?\? 1 \} : planTake\(item, \{\n\s*bag: \[\.\.\.this\.hooks\.packItems\(\), \.\.\.this\.basket\.filter\(\(x\) => !isFurnishing\(x\)\)\],/);
  const save = src('src/systems/save.js');
  assert.match(save, /snap\.furnishings = \(entity\.furnishings \?\? \[\]\)\.map\(\(it\) => \(\{ \.\.\.it \}\)\);/);
});
