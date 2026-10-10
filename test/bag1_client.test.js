// BAG1 (2026-10-03) - THE MATERIALS BAG, ON THE CLIENT: the bag a player buys at a General Store, carried as DFU carries
// the wagon - a second list beside the pack, its own weight limit - and every harvest, withdrawal and station that reads
// what it holds (bible/06-Systems/Materials-Bag.md). The law is net/bagLaw.js, the save's hands systems/materialsBag.js,
// the book's flows net/profBook.js; the service's half is test/bag1_service.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/systems/profTemplates.js';
import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import { accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook, PROF_QUEUE_MS, PROF_REFRESH_BACKOFF_MS } from '../src/net/profBook.js';
import {
  BAG_TEMPLATE, BAG_KG_LIMIT, BAG_BASE_PRICE, BAG_ROW, BAG_CAPACITY, BAG_WORDS, CARRIED_MAX, DEPOSIT_MAX, goodsWhere, madeWhere, movedFirstText,
} from '../src/net/bagLaw.js';
import { leftWords, actMaterial } from '../src/scenes/gatherHost.js';
import { survivalMinute } from '../src/systems/survival/needs.js';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { withDom } from './invdrag.mjs';
import { BAG_PAGE_WORDS, setProfessionsPages, drawStoresPage, resetProfPages, storesRoomOf } from '../src/ui/profPages.js';
import {
  hasBag, bagItemsOf, materialKeyOfItem, isMaterialItem, heldOf, unitKgOf, bagWeight, roomFor, mintCarried, takeCarried,
  bagStoreRefusal, bagMayLeave, isBagItem, giveCarried, bagTakesOf, emptyBagIntoPack,
} from '../src/systems/materialsBag.js';
import { mintMaterialItem, materialCountLabel } from '../src/systems/profItems.js';
import { setItemFields } from '../src/systems/itemTemplates.js';
import { addItem, carriedWeight } from '../src/systems/inventory.js';
import {
  planBagToggle, hasMaterialsBag, remoteTarget, storeCapacityOf, groundRefusalOf, remoteTargetType, REMOTE_TARGET_TYPES,
} from '../src/systems/inventorySession.js';
import { planStore, REFUSAL } from '../src/systems/itemTransfer.js';
import { localClickDecision } from '../src/systems/tradeModes.js';
import { tradeRefusal, BAG_TRADE_TEXT } from '../src/systems/tradePack.js';
import { tradeableRecord } from '../src/net/realmTradeLaw.js';
import { carriedItemLists } from '../src/net/realmGoldLaw.js';
import { stockShopShelf } from '../src/systems/shopStock.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { snapshotPlayer, restorePlayer, bagTakesSaved, removeAllOrphanedItems } from '../src/systems/save.js';
import { storesFullIn, fullWordsIn, herbKey, STORES_MAX, WITHDRAW_MAX } from '../src/net/professionLaw.js';
import { calculateCost } from '../src/systems/shopStock.js';
import { harvestHauls } from '../src/ui/haulCards.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { sharedClassicMinutes } from '../src/net/wire.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const bagItem = () => setItemFields({ group: 'UselessItems2', templateIndex: BAG_TEMPLATE });
/** A character of strength 50 - a 75 kg pack - with a bag on its back, or none. */
const body = ({ bag = true } = {}) => ({ stats: { strength: 50 }, items: bag ? [bagItem()] : [], bagItems: [], goldPieces: 0 });
const OAK = 'log:oak';   // 2 kg a log
const HERB = 'p1:9';     // 0.25 kg
/** The host's hands on an entity, as scenes/world.js builds them - AUDIT2: the deposits' stamps in its save, every unit
 *  handed over minted (`give`), and `flush` the checkpoint a deposit waits on (none given: the entity IS the save). */
const hands = (e, { flush = null } = {}) => ({
  held: (k) => heldOf(e, k), room: (k) => roomFor(e, k), mint: (k, n) => mintCarried(e, k, n),
  take: (k, n, id, order) => takeCarried(e, k, n, id, order), give: (k, n) => giveCarried(e, k, n),
  stamped: (id) => Object.hasOwn(bagTakesOf(e), id), unstamp: (id) => { delete e.bagTakes?.[id]; },
  stamps: () => Object.entries(bagTakesOf(e)).map(([id, t]) => ({ id, ...t })),
  ...(flush ? { flush } : {}),
});
/** AUDIT2: the save a checkpoint writes of an entity - and the entity a page boots from it. */
const saveOf = (e) => structuredClone(e);
const sumOf = (list, k) => list.filter((i) => materialKeyOfItem(i) === k).reduce((a, i) => a + (i.stackCount ?? 1), 0);

// ─── THE LAW ────────────────────────────────────────────────────────

test('BAG1 the row: DFU\'s own Backpack picture, weightless as the Small Cart, one to a slot, 250 base (500 at a middling shop - "like 500g"), in the professions\' range; it holds 300 kg - two fifths of a wagon - and the service counts 5,000 of a material carried, the Stores\' own bound (mutants: a weight; a stack; the limit)', () => {
  assert.equal(BAG_TEMPLATE, 600);
  assert.deepEqual([BAG_ROW.worldTextureArchive, BAG_ROW.worldTextureRecord], [205, 44], 'ItemTemplates 89\'s picture');
  assert.equal(BAG_ROW.hasNoEncumbrance, true);
  assert.equal(BAG_ROW.stackable, false);
  assert.equal(BAG_BASE_PRICE, 250);
  assert.equal(BAG_KG_LIMIT, 300);
  assert.deepEqual(BAG_CAPACITY, { kg: 300, name: 'Your Materials Bag' });
  assert.equal(CARRIED_MAX, 5000);
  assert.deepEqual([CARRIED_MAX, DEPOSIT_MAX], [STORES_MAX, WITHDRAW_MAX], 'AUDIT2 D16: the Stores\' own bounds, imported');
  assert.deepEqual([1, 10, 20].map((q) => calculateCost(BAG_BASE_PRICE, q)), [456, 500, 550], 'AUDIT2: 456 to 550 by the shop\'s quality');
  const it = bagItem();
  assert.deepEqual([it.name, it.value, isBagItem(it), hasBag([it]), hasBag([])], ['Materials Bag', 250, true, true, false]);
});

test('BAG1 the words: where a harvest\'s goods went - the Stores for an older book, else the bag, the pack or both as the mint put them, and what had no room left where it was gathered (mutants: the pack said as the bag; the left-behind unsaid; AUDIT2: none carried said as the bag)', () => {
  assert.equal(goodsWhere({ carry: false }), 'to your Stores');
  assert.equal(goodsWhere({ carry: true, put: { bag: 3, pack: 0, left: 0 } }), 'to your bag');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 2, left: 0 } }), 'to your pack');
  assert.equal(goodsWhere({ carry: true, put: { bag: 1, pack: 2, left: 0 } }), 'to your bag and pack');
  assert.equal(goodsWhere({ carry: true, put: { bag: 4, pack: 0, left: 1 } }), 'to your bag - 1 left where it was gathered: no room');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 1, left: 3 } }), 'to your pack - 3 left where they were gathered: no room');
  // AUDIT2 K11: none of it carried - never "to your bag" of goods that went nowhere
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 0, left: 3 } }), '- all left where they were gathered: no room in your bag or pack');
  assert.equal(goodsWhere({ carry: true, put: { bag: 0, pack: 0, left: 1 } }), '- all left where it was gathered: no room in your bag or pack');
  assert.match(BAG_WORDS.where, /Every General Store sells the bag/);
});

// ─── THE SAVE'S HANDS ───────────────────────────────────────────────

test('BAG1 an item is a material only as the mint makes it - both of a food\'s skins, every herb, log and hide; never a quest\'s, a summoned, a worn or an enchanted one (mutants: the map unbuilt; a quest item counted)', () => {
  for (const k of [OAK, HERB, 'hide:bear', 'food:meat']) assert.equal(materialKeyOfItem(mintMaterialItem(k)), k, k);
  assert.equal(materialKeyOfItem(mintMaterialItem('food:meat', true)), 'food:meat', 'Climates & Calories\' Raw Meat');
  assert.equal(materialKeyOfItem(mintMaterialItem('food:meat', false)), 'food:meat', 'and the Basket\'s');
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(HERB), questItem: true }), null);
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(HERB), timeForItemToDisappear: 99 }), null);
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(OAK), equipSlot: 3 }), null);
  assert.equal(materialKeyOfItem(bagItem()), null, 'the bag is no material');
  assert.equal(isMaterialItem(setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 })), false);
  assert.equal(bagStoreRefusal(setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 })).text, BAG_WORDS.onlyMaterials);
  assert.equal(bagStoreRefusal(mintMaterialItem(OAK)), null);
});

test('BAG1 a mint fills the bag first, under its 300 kg, then the pack under the character\'s own carry, and says what found no room; a character with no bag mints into the pack alone (mutants: the pack first; the bag past its limit; the left-behind dropped)', () => {
  const e = body();
  assert.equal(unitKgOf(OAK), 2);
  assert.equal(roomFor(e, OAK), 150 + 37, '150 logs in the bag, 37 in a 75 kg pack');
  assert.deepEqual(mintCarried(e, OAK, 200), { bag: 150, pack: 37, left: 13 });
  assert.equal(bagWeight(e), 300);
  assert.equal(heldOf(e, OAK), 187, 'the bag and the pack, together');
  assert.equal(roomFor(e, OAK), 0);
  const none = body({ bag: false });
  assert.deepEqual(mintCarried(none, HERB, 5), { bag: 0, pack: 5, left: 0 });
  assert.equal(none.bagItems.length, 0, 'no bag, nothing into its list');
  assert.equal(heldOf(none, HERB), 5);
  const dry = body();
  assert.deepEqual(mintCarried(dry, 'food:meat', 2, { slowRot: true }), { bag: 2, pack: 0, left: 0 });
  assert.equal(bagItemsOf(dry)[0].slowRot, true, 'a Butcher\'s meat, slow to rot, in the bag as in the pack');
});

test('BAG1 a deposit takes from the bag first, then the pack - whole stacks and a split of the last - and its undo puts back exactly what it took (mutants: the pack first; the split lost on the undo)', () => {
  const e = body();
  mintCarried(e, HERB, 3);
  e.items.push(...[mintMaterialItem(HERB)].map((it) => ({ ...it, stackCount: 4 })));
  assert.equal(heldOf(e, HERB), 7);
  const t = takeCarried(e, HERB, 5);
  assert.equal(t.taken, 5);
  assert.equal(heldOf(e, HERB), 2);
  assert.equal(e.bagItems.length, 0, 'the bag\'s three first');
  assert.equal(e.items.find((i) => materialKeyOfItem(i) === HERB).stackCount, 2, 'then two of the pack\'s four');
  t.back();
  assert.equal(heldOf(e, HERB), 7);
  assert.equal(e.bagItems.reduce((a, i) => a + (i.stackCount ?? 1), 0), 3, 'the bag\'s back in the bag');
  const short = takeCarried(e, HERB, 9);
  assert.equal(short.taken, 7, 'what there is - the caller gives it back');
  short.back();
  assert.equal(heldOf(e, HERB), 7);
});

// ─── THE INVENTORY WINDOW ───────────────────────────────────────────

test('BAG1 the bag button: no bag says where to buy one; with one, a press shows it and hides the wagon, a second hides it; showing, it is the remote list, its own capacity, no floor, a target of its own (mutants: the bag shown with the wagon; the bag a floor)', () => {
  const noBag = planBagToggle({ items: () => [] }, {});
  assert.deepEqual([noBag.ok, noBag.refusal.text], [false, BAG_WORDS.none]);
  const e = body();
  const deps = { items: () => e.items, bagItems: () => e.bagItems, wagonItems: () => ['cart'], dropRefusal: () => 'not here' };
  assert.equal(hasMaterialsBag(e.items), true);
  assert.deepEqual(planBagToggle(deps, { usingWagon: true }), { ok: true, usingBag: true, usingWagon: false });
  assert.deepEqual(planBagToggle(deps, { usingBag: true }), { ok: true, usingBag: false, usingWagon: false });
  mintCarried(e, HERB, 2);
  assert.equal(remoteTarget(deps, { usingBag: true }), e.bagItems);
  assert.equal(storeCapacityOf(deps, { usingBag: true }), BAG_CAPACITY);
  assert.equal(groundRefusalOf(deps, { usingBag: true }), null, 'the bag is no floor - a house\'s word never reaches it');
  assert.equal(groundRefusalOf(deps, {}), 'not here');
  assert.equal(remoteTargetType(deps, { usingBag: true }), REMOTE_TARGET_TYPES.Bag);
});

test('BAG1 a loaded bag stays: it leaves the pack - dropped, stored, sold - only empty; it is never traded to a player nor sent through the realm (mutants: a loaded bag dropped; a loaded bag sold; the bag traded)', () => {
  const bag = bagItem();
  assert.deepEqual(planStore(bag, { bagLoaded: true }), { ok: false, refusal: REFUSAL.bagLoaded });
  assert.equal(REFUSAL.bagLoaded.text, BAG_WORDS.notEmpty);
  assert.notDeepEqual(planStore(bag, { bagLoaded: false }).refusal, REFUSAL.bagLoaded, 'empty, it goes as any item');
  assert.notDeepEqual(planStore(mintMaterialItem(OAK), { bagLoaded: true }).refusal, REFUSAL.bagLoaded, 'the rule is the bag\'s alone');
  assert.deepEqual(localClickDecision('Sell', bag, { bagLoaded: true }), { kind: 'refuse', refusal: 'bagLoaded' });
  assert.notEqual(localClickDecision('Sell', bag, { bagLoaded: false }).kind, 'refuse');
  assert.equal(tradeRefusal(bag), BAG_TRADE_TEXT);
  assert.equal(tradeableRecord(bag), false);
  assert.equal(bagMayLeave({ bagItems: [] }), true);
  assert.equal(bagMayLeave({ bagItems: [mintMaterialItem(OAK)] }), false);
  // every window that plans a move says whether the bag is loaded
  for (const f of ['src/ui/enhancedInventory.js', 'src/ui/nativeInventory.js', 'src/ui/enhancedTrade.js', 'src/ui/nativeTrade.js']) {
    assert.match(src(f), /bagLoaded/, f);
  }
});

test('BAG1 bought: every General Store shelves one online - on every shelf, whoever stocks it (BAG-SHELF: a shelf\'s stock is the room\'s); offline none (mutants: offline; the first shelf alone; none to a bag-owner)', () => {
  const where = globalThis.location;
  try {
    const shelf = (e) => stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, e, { rolls: () => 0.5, torchesFromItems: false });
    globalThis.location = { search: '?online' };
    const on = shelf({ items: [], level: 1 });
    const i = on.findIndex((it) => it.templateIndex === BAG_TEMPLATE);
    assert.ok(i >= 0, 'shelved');   // PIN MOVED (MERCHANT-YARDS): first on the shelf now, no horse and cart before it
    assert.equal(on[i].group, 'UselessItems2');
    assert.equal(on.some((it) => it.group === 'Transportation'), false, 'MERCHANT-YARDS: no horse and no cart on it now - the town\'s yards sell them');
    // BAG-SHELF (FIELD BUGS 2026-10-04, "nobody can find material bags in store"): online a shelf's stock is the room's for
    // the day, so a bag-owner's open stocks it for everyone - the bag is there whoever stocked it
    assert.equal(shelf({ items: [bagItem()], level: 1 }).some((it) => it.templateIndex === BAG_TEMPLATE), true, 'stocked by a bag-owner, still shelved');
    // and on every shelf, as the horse and the cart were (MERCHANT-YARDS: the yards' now) - the first shelf is only the first model the building lists
    const second = stockShopShelf({ buildingType: BUILDING_TYPES.GeneralStore, quality: 10 }, { items: [], level: 1 }, { rolls: () => 0.5, torchesFromItems: false, shelfIndex: 1 });
    assert.deepEqual([second.some((it) => it.templateIndex === BAG_TEMPLATE), second.some((it) => it.group === 'Transportation')], [true, false]);   // PIN MOVED (MERCHANT-YARDS): the second shelf no longer carries the horse and the cart
    globalThis.location = { search: '' };
    assert.equal(shelf({ items: [], level: 1 }).some((it) => it.templateIndex === BAG_TEMPLATE), false, 'offline nothing gathers into it');
  } finally { globalThis.location = where; }
});

test('BAG1 the save keeps the bag\'s list, and the realm counts it with the pack and the wagon; AUDIT2: and the deposits\' stamps, to a deposit\'s bounds (mutants: the list unsaved; the realm blind to it; the stamp unsaved; the stamp dropped on load)', () => {
  const e = { ...body(), isPlayer: true };
  mintCarried(e, OAK, 4);
  const q = { isPlayer: true };
  restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 100 }))));
  assert.equal(q.bagItems.length, 1);
  assert.equal(heldOf(q, OAK), 4);
  assert.equal(materialKeyOfItem(q.bagItems[0]), OAK);
  const lists = carriedItemLists({ items: [{ a: 1 }], bagItems: [{ b: 2 }], wagonItems: [] });
  assert.ok(lists.some((l) => l.some((x) => x.b === 2)), 'the bag\'s list is the record\'s to count');
  // AUDIT2 K3/K7: a deposit's stamp rides the save - its id, material, units and order - and a bad one is dropped
  takeCarried(e, OAK, 3, 'dep-1', 'spend');
  const r = { isPlayer: true };
  restorePlayer(r, JSON.parse(JSON.stringify(snapshotPlayer(e, { classicMinutes: 100 }))));
  assert.deepEqual(r.bagTakes, { 'dep-1': { material: OAK, qty: 3, order: 'spend' } });
  const older = JSON.parse(JSON.stringify(snapshotPlayer({ ...body(), isPlayer: true }, { classicMinutes: 100 })));
  delete older.bagTakes;
  const o = { isPlayer: true };
  restorePlayer(o, older);
  assert.deepEqual(o.bagTakes, {}, 'a save written before holds none');
  assert.deepEqual(bagTakesSaved({ a: { material: OAK, qty: 0 }, b: { material: OAK, qty: 201 }, c: { material: 3, qty: 1 }, d: { material: OAK, qty: 2, order: 'gold' }, [`${'x'.repeat(65)}`]: { material: OAK, qty: 1 } }),
    { d: { material: OAK, qty: 2 } }, 'no units, past a deposit\'s bound, no material, an order no deposit has, an id past its length');
  assert.deepEqual(bagTakesSaved([1]), {});
});

// ─── THE BOOK ───────────────────────────────────────────────────────

test('BAG1 the book carries: a harvest asks with `carry` and the held count, never the material\'s name; the answer\'s goods are minted ONCE into the bag - a second settle of the same harvest mints nothing; the haul card says Carried, counting what came (mutants: the material sent; minted twice; the Stores\' count said; AUDIT2 U6: the service\'s count for what came)', async () => {
  const e = body();
  const asked = [];
  let answer = { ok: false, error: 'offline' };
  const door = { account: () => 'a', harvest: async (b) => { asked.push(b); return answer; } };
  let n = 0;
  let t = 1_000_000;   // the harvest's own UTC day (its `at` is 1)
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', now: () => t, rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait, carry: hands(e) });
  assert.equal(book.carrying(), true);
  mintCarried(e, HERB, 2);
  const r0 = await book.harvest({ node: 'n1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  assert.equal(r0.kept, true);
  assert.deepEqual([asked[0].carry, asked[0].held, 'material' in asked[0]], [true, 2, false]);
  answer = { ok: true, data: { carry: true, material: HERB, qty: 3, carried: { material: HERB, own: 5, bought: 0 }, xp: 2, track: { profession: 'herbalism', xp: 2, rank: 0 } } };
  t += 60_000;
  await book.pump();
  assert.equal(heldOf(e, HERB), 5, 'three more, minted');
  assert.equal(e.bagItems.reduce((a, i) => a + (i.stackCount ?? 1), 0), 5, 'into the bag');
  assert.deepEqual(book.carried(HERB), { material: HERB, own: 5, bought: 0 });
  assert.equal(book.storesHeld(HERB), 0, 'the Stores untouched');
  assert.equal(book.held(HERB), 5, 'a station may use what is carried');
  t += 60_000;
  await book.pump();
  assert.equal(heldOf(e, HERB), 5, 'nothing minted twice');
  // TWO TABS settling one kept harvest at once (one storage): both ask, both are answered - the goods minted by the one
  // that lets it go, never by both
  const shared = memStorage();
  const eA = body(), eB = body();
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = { account: () => 'a', harvest: async () => { await gate; return answer; } };
  let t2 = 1_000_000;
  const offline = createProfBook({ door: { account: () => 'a', harvest: async () => ({ ok: false, error: 'offline' }) }, storage: shared, character: () => 'c', now: () => t2, sleep: noWait, carry: hands(eA) });
  await offline.harvest({ node: 'n2', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  const tabA = createProfBook({ door: slow, storage: shared, character: () => 'c', now: () => t2, sleep: noWait, carry: hands(eA) });
  const tabB = createProfBook({ door: slow, storage: shared, character: () => 'c', now: () => t2, sleep: noWait, carry: hands(eB) });
  t2 += 60_000;
  const both = [tabA.pump(), tabB.pump()];
  release();
  await Promise.all(both);
  assert.equal(heldOf(eA, HERB) + heldOf(eB, HERB), 3, 'three herbs answered, three minted - once');
  const [card] = harvestHauls(answer.data);
  assert.equal(card.where, 'Carried');
  assert.equal(card.held, 5);
  // AUDIT2 U6: the card counts what came - one of the three left where it was gathered
  assert.equal(harvestHauls({ ...answer.data, put: { bag: 2, pack: 0, left: 1, lost: [{ key: HERB, n: 1 }] } })[0].count, 2);
  const none = harvestHauls({ ...answer.data, put: { bag: 0, pack: 0, left: 3, lost: [{ key: HERB, n: 3 }] } })[0];
  assert.deepEqual([none.count, none.sub, none.xp], [0, 'left where gathered - no room', 2], 'none came: said, and the XP still on it');
  assert.match(src('src/ui/haulCards.js'), /tag: Number\.isSafeInteger\(l\.held\) \? `\$\{l\.where \?\? 'Stores'\} \$\{num\(l\.held\)\}`/);
});

test('BAG1 a deposit: the items out of the bag first, the service asked with what was held; refused, they come back; no answer, they stay out and the settle asks again with the same id (mutants: the items kept on a refusal; a new id each ask)', async () => {
  const e = body();
  mintCarried(e, HERB, 6);
  const asked = [];
  let answer = { ok: false, error: 'carried-short' };
  const door = { account: () => 'a', deposit: async (...a) => { asked.push(a); return answer; } };
  let n = 0;
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait, carry: hands(e) });
  const refused = await book.deposit(HERB, 4);
  assert.equal(refused.ok, false);
  assert.deepEqual(asked[0].slice(0, 5), ['c', HERB, 4, 6, 'all'], 'the character, the material, the units, what was held, the order');
  assert.equal(heldOf(e, HERB), 6, 'given back');
  answer = { ok: false, error: 'offline' };
  const lost = await book.deposit(HERB, 4);
  assert.equal(lost.kept, true);
  assert.equal(heldOf(e, HERB), 2, 'out, and waiting');
  assert.equal(book.pendingDeposits, 1);
  answer = { ok: true, data: { store: { material: HERB, own: 4, bought: 0 }, carried: { material: HERB, own: 2, bought: 0 } } };
  await book.settle(() => {});
  assert.equal(book.pendingDeposits, 0);
  assert.equal(asked.at(-1)[5], asked.at(-2)[5], 'one deposit, one id');
  assert.equal(book.storesHeld(HERB), 4);
  assert.equal(heldOf(e, HERB), 2);
  assert.deepEqual(await book.deposit(HERB, 9), { ok: false, error: 'carried-short' }, 'never more than is carried');
  assert.equal(heldOf(e, HERB), 2);
});

// ─── THE AUDIT (bible/06-Systems/Materials-Bag.md, the audit) ───────

test('BAG1 (AUDIT B2): what the pack holds is said at each ask, never when the act was kept - a harvest asked after another\'s items were minted says them, and a deposit still out counts as held; with the material it is of and the count as last heard (mutants: held kept from the queue; a deposit out uncounted; `seen` unsent)', async () => {
  const e = body();
  const asked = [];
  let answer = { ok: false, error: 'offline' };
  const door = {
    account: () => 'a',
    harvest: async (b) => { asked.push(b); return answer; },
    deposit: async () => ({ ok: false, error: 'offline' }),
  };
  let t = 1_000_000, n = 0;
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', now: () => t, rid: () => `prof-${String(++n).padStart(6, '0')}`, sleep: noWait, carry: hands(e) });
  await book.harvest({ node: 'n1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  assert.deepEqual([asked[0].held, asked[0].heldKey, asked[0].seen], [0, HERB, 0]);
  mintCarried(e, HERB, 3);   // another act's items, minted meanwhile
  assert.equal((await book.deposit(HERB, 2)).kept, true, 'two of them on their way into the Stores, unanswered');
  t += 60_000;
  await book.pump();
  assert.deepEqual([asked[1].held, asked[1].heldKey, asked[1].seen], [3, HERB, 0], 'the one in the pack and the two still out');
  answer = { ok: true, data: { carry: true, material: HERB, qty: 2, carried: { material: HERB, own: 5, bought: 0 }, xp: 1, track: { profession: 'herbalism', xp: 1, rank: 0 } } };
  t += 60_000;
  await book.pump();
  await book.harvest({ node: 'n2', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  assert.deepEqual([asked.at(-1).held, asked.at(-1).seen], [5, 5], 'the count as the answer said it - and the pack with the two minted');
  // a Basket's food is the service's roll: no material named, no held count
  await book.harvest({ node: 'n3', kind: 'baskets', climate: 231, region: 21, act: {}, at: 1 });
  assert.deepEqual(['held' in asked.at(-1), 'heldKey' in asked.at(-1)], [false, false]);
});

test('BAG1 (AUDIT B1): a carried harvest is never let go unminted - lapsed, it is asked once and a landed one minted (one never landed lapses); heard under another character it waits kept for its own (mutants: lapsed unasked; dropped on a switch)', async () => {
  const e = body();
  let answer = { ok: false, error: 'offline' };
  let who = 'c';
  let onAsk = () => {};
  const door = { account: () => 'a', harvest: async () => { onAsk(); return answer; } };
  let t = 1_000_000;
  const book = createProfBook({ door, storage: memStorage(), character: () => who, now: () => t, sleep: noWait, carry: hands(e) });
  const landed = { ok: true, data: { carry: true, repeat: true, material: HERB, qty: 3, carried: { material: HERB, own: 3, bought: 0 }, xp: 1, track: { profession: 'herbalism', xp: 1, rank: 0 } } };
  await book.harvest({ node: 'n1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  answer = landed;
  t += PROF_QUEUE_MS + 1;
  const said = [];
  await book.pump((h, r) => said.push(r.ok ? 'ok' : r.error));
  assert.deepEqual(said, ['ok'], 'past its ten minutes, asked once: the service answered the harvest it made');
  assert.equal(heldOf(e, HERB), 3, 'and its herbs minted');
  // one that never landed is refused for its age, and lapses
  answer = { ok: false, error: 'offline' };
  await book.harvest({ node: 'n2', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  answer = { ok: false, error: 'prof-late' };
  t += PROF_QUEUE_MS + 1;
  said.length = 0;
  await book.pump((h, r) => said.push(r.ok ? 'ok' : r.error));
  assert.deepEqual(said, ['lapsed']);
  assert.equal(book.pendingHarvests, 0);
  // heard after a switch: the herbs are the first character's, minted by its own next ask
  answer = landed;
  onAsk = () => { who = 'd'; };
  const r = await book.harvest({ node: 'n3', kind: 'herbs', climate: 231, region: 21, act: {}, at: t / 1000 | 0, material: HERB });
  assert.deepEqual([r.ok, r.kept, r.elsewhere], [false, true, true]);
  assert.equal(heldOf(e, HERB), 3, 'nothing minted into the other character\'s pack');
  who = 'c';
  onAsk = () => {};
  assert.equal(book.pendingHarvests, 1, 'kept for its own character');
  await book.pump();
  assert.equal(heldOf(e, HERB), 6, 'minted once its own character asked again');
});

test('BAG1 (AUDIT B17; AUDIT2 K3/K7/H2/H4/D1): a deposit is kept with the other acts and its take STAMPED in the save, the save the realm\'s before it is asked - booted from a save that holds the stamp, a refusal gives back every unit it took, whatever was minted since; booted from one that does not, it was never sent, and is let go untouched; a stamp no kept act names is asked by its own id (mutants: a stamped refusal given nothing; an unstamped deposit asked; asked before the checkpoint; a first ask unsaved kept; a stray stamp swept; given back twice)', async () => {
  const offline = { account: () => 'a', deposit: async () => ({ ok: false, error: 'offline' }) };
  const landed = (m, q) => ({ ok: true, data: { repeat: true, store: { material: m, own: q, bought: 0 }, carried: { material: m, own: 0, bought: 0 } } });
  let answer = { ok: false, error: 'carried-short' };
  const asked = [];
  const door = { account: () => 'a', deposit: async (...a) => { asked.push(a); return answer; } };
  const bookOf = (e, storage, { d = door, flush = null, rid } = {}) => createProfBook({ door: d, storage, character: () => 'c', sleep: noWait, carry: hands(e, { flush }), ...(rid ? { rid } : {}) });

  // K3: the save written after the take holds its stamp; three herbs minted since, before the settle - refused, all four
  // come back (the shortfall the stamp replaced - 6 held then, 5 now - gave back one)
  const s1 = memStorage();
  const e = body();
  mintCarried(e, HERB, 6);
  assert.equal((await bookOf(e, s1, { d: offline }).deposit(HERB, 4)).kept, true);
  const booted = saveOf(e);
  assert.equal(heldOf(booted, HERB), 2);
  assert.deepEqual(Object.values(bagTakesOf(booted)), [{ material: HERB, qty: 4, order: 'all' }], 'the take, stamped in the save');
  mintCarried(booted, HERB, 3);
  const second = bookOf(booted, s1);
  assert.equal(second.pendingDeposits, 1, 'heard by the next page');
  await second.settle(() => {});
  assert.equal(asked.length, 1);
  assert.equal(heldOf(booted, HERB), 9, 'the four given back');
  assert.deepEqual([second.pendingDeposits, bagTakesOf(booted)], [0, {}]);
  // two deposits out: each its own stamp, each given back whole (one shortfall shared by the two gave back once)
  const s2 = memStorage();
  const e2 = body();
  mintCarried(e2, HERB, 6);
  const off2 = bookOf(e2, s2, { d: offline });
  await off2.deposit(HERB, 2);
  await off2.deposit(HERB, 2);
  const booted2 = saveOf(e2);
  asked.length = 0;
  await bookOf(booted2, s2).settle(() => {});
  assert.deepEqual([asked.length, heldOf(booted2, HERB)], [2, 6]);

  // H2: THE TAKE SAVED BEFORE THE ASK - the checkpoint asked first, holding the take and its stamp; refused, a first ask is
  // undone whole and never sent
  const seq = [];
  let saves = true;
  const e5 = body();
  mintCarried(e5, HERB, 6);
  const s5 = memStorage();
  const b5 = bookOf(e5, s5, { d: { account: () => 'a', deposit: async () => { seq.push('ask'); return { ok: false, error: 'offline' }; } }, flush: async () => { seq.push(['flush', heldOf(e5, HERB), Object.keys(bagTakesOf(e5)).length]); return saves; } });
  await b5.deposit(HERB, 4);
  assert.deepEqual([seq[0], seq.slice(1).every((x) => x === 'ask'), seq.length > 1], [['flush', 2, 1], true, true], 'the save with the take and its stamp landed first, then the asks');
  // asked before - it may have landed: a checkpoint refused now keeps it out, unasked, never undone
  seq.length = 0;
  saves = false;
  await b5.settle(() => {});
  assert.deepEqual([seq, b5.pendingDeposits, heldOf(e5, HERB)], [[['flush', 2, 1]], 1, 2]);
  const e4 = body();
  mintCarried(e4, HERB, 6);
  asked.length = 0;
  const b4 = bookOf(e4, memStorage(), { flush: () => false });
  assert.deepEqual(await b4.deposit(HERB, 4), { ok: false, error: 'deposit-unsaved' });
  assert.deepEqual([asked.length, heldOf(e4, HERB), b4.pendingDeposits, bagTakesOf(e4)], [0, 6, 0, {}], 'never sent, all back');
  assert.match(accountRefusalText('deposit-unsaved'), /could not be saved just now, so nothing went into your Stores/);

  // K7: the page gone while its checkpoint was out - the realm's save is the one from BEFORE the take, with no stamp: the
  // deposit was never sent, and is let go unasked; the save keeps its six (asked and landed, it took them out of the save
  // the page booted - and asked from a save that never saw them go, a landing whose page then went was a copy)
  const s3 = memStorage();
  const e3 = body();
  mintCarried(e3, HERB, 6);
  const before3 = saveOf(e3);
  let asked3 = 0;
  void bookOf(e3, s3, { d: { account: () => 'a', deposit: async () => { asked3++; return { ok: false, error: 'offline' }; } }, flush: () => new Promise(() => {}) }).deposit(HERB, 4);
  assert.deepEqual([asked3, heldOf(e3, HERB)], [0, 2], 'taken, its checkpoint out, unasked');
  answer = landed(HERB, 4);
  asked.length = 0;
  const third = bookOf(before3, s3, { flush: () => true });
  assert.equal(third.pendingDeposits, 1);
  await third.settle(() => {});
  assert.deepEqual([asked.length, third.pendingDeposits, heldOf(before3, HERB), bagTakesOf(before3)], [0, 0, 6, {}]);

  // A STRAY STAMP: the answer heard, the page gone before the checkpoint that took the stamp off - the save holds a stamp no
  // kept act names. Asked by its own id and order: the service answers a deposit made as made, and nothing moves
  const s6 = memStorage();
  const e6 = body();
  mintCarried(e6, HERB, 6);
  await bookOf(e6, s6, { d: offline, rid: () => 'dep-6' }).deposit(HERB, 4, { order: 'spend' });
  const record = saveOf(e6);
  await bookOf(e6, s6).settle(() => {});   // heard on that page, its stamp off - the page then gone
  assert.deepEqual(bagTakesOf(e6), {});
  asked.length = 0;
  const b7 = bookOf(record, s6);
  assert.equal(b7.pendingDeposits, 1, 'the stray stamp waits');
  await b7.settle(() => {});
  assert.deepEqual(asked.map((a) => [a[4], a[5]]), [['spend', 'dep-6']], 'asked by its own id, in its own order');
  assert.deepEqual([heldOf(record, HERB), b7.pendingDeposits, bagTakesOf(record)], [2, 0, {}]);
  // kept on ANOTHER DEVICE: this one's storage holds no kept act, its save the stamp - refused, the units come back; and
  // the first device, booting the save the second wrote, finds no stamp - settled elsewhere - and lets its own go unasked
  const d1 = memStorage();
  const e8 = body();
  mintCarried(e8, HERB, 6);
  await bookOf(e8, d1, { d: offline }).deposit(HERB, 4);
  const rec = saveOf(e8);
  answer = { ok: false, error: 'stores-full' };
  asked.length = 0;
  await bookOf(rec, memStorage()).settle(() => {});
  assert.deepEqual([asked.length, heldOf(rec, HERB), bagTakesOf(rec)], [1, 6, {}]);
  const rec2 = saveOf(rec);
  const back1 = bookOf(rec2, d1);
  assert.equal(back1.pendingDeposits, 1);
  await back1.settle(() => {});
  assert.deepEqual([asked.length, heldOf(rec2, HERB), back1.pendingDeposits], [1, 6, 0], 'never asked again, never a copy');

  // H4: a refusal heard when the bag and the pack are full - every unit back, into the pack past its weight (B5's law)
  const s9 = memStorage();
  const e9 = body();
  mintCarried(e9, OAK, 10);
  await bookOf(e9, s9, { d: offline }).deposit(OAK, 10);
  const rec9 = saveOf(e9);
  mintCarried(rec9, OAK, 187);
  assert.equal(roomFor(rec9, OAK), 0);
  await bookOf(rec9, s9).settle(() => {});
  assert.equal(heldOf(rec9, OAK), 197, 'all ten back');

  // D1: TWO TABS on one save, one kept deposit, both asking at once - the stamp read and taken off in one turn: given back once
  const s10 = memStorage();
  const e10 = body();
  mintCarried(e10, HERB, 6);
  await bookOf(e10, s10, { d: offline }).deposit(HERB, 4);
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = { account: () => 'a', deposit: async () => { await gate; return { ok: false, error: 'stores-full' }; } };
  const both = [bookOf(e10, s10, { d: slow }).settle(() => {}), bookOf(e10, s10, { d: slow }).settle(() => {})];
  release();
  await Promise.all(both);
  assert.equal(heldOf(e10, HERB), 6, 'the four back once');
});

test('BAG1 (AUDIT2 K2/K9): while another carried act is kept - a harvest whose answer may have landed unminted - the held count said is never under the count as heard (a state read made `seen` the service\'s own, and the cut took the kept act\'s units); the act asked is not pending for itself; a `carried-full` refusal reads the state again (mutants: held the pack\'s alone; the act pending for itself; carried-full unlearned)', async () => {
  const e = body();
  const asked = [];
  const door = {
    account: () => 'a',
    harvest: async (b) => { asked.push(b); return { ok: false, error: 'offline' }; },
    state: async () => ({ ok: true, data: { carried: [{ material: HERB, own: 5, bought: 0 }] } }),
  };
  let t = 1_000_000, n = 0;
  const storage = memStorage();
  const book = createProfBook({ door, storage, character: () => 'c', now: () => t, rid: () => `h-${++n}`, sleep: noWait, carry: hands(e) });
  await book.harvest({ node: 'n1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });   // landed: its three unminted
  mintCarried(e, HERB, 2);
  await book.refresh({ force: true });   // the count: 5, the kept harvest's three among them
  asked.length = 0;
  await book.harvest({ node: 'n2', kind: 'oak', climate: 231, region: 21, act: {}, at: 1, material: OAK });
  await book.harvest({ node: 'n3', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  assert.deepEqual([asked.at(-1).held, asked.at(-1).seen], [5, 5], 'never 2 - the cut took the three the kept harvest is yet to mint');
  // the kept act's own ask, alone: not pending for itself - the pack's count, so a pack emptied by a sale is believed
  const e2 = body();
  const asked2 = [];
  const door2 = { ...door, harvest: async (b) => { asked2.push(b); return { ok: false, error: 'offline' }; } };
  const b2 = createProfBook({ door: door2, storage: memStorage(), character: () => 'c', now: () => t, sleep: noWait, carry: hands(e2) });
  await b2.harvest({ node: 'n1', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  mintCarried(e2, HERB, 2);
  await b2.refresh({ force: true });
  asked2.length = 0;
  t += 60_000;
  await b2.pump();
  assert.deepEqual([asked2[0].held, asked2[0].seen], [2, 5]);
  // K9: refused at the carried count's bound - the state read again, as a Stores-full refusal is
  const b3 = createProfBook({ door: { ...door, harvest: async () => ({ ok: false, error: 'carried-full' }) }, storage: memStorage(), character: () => 'c', now: () => t, sleep: noWait, carry: hands(body()) });
  await b3.refresh({ force: true });
  assert.equal(b3.stale(), false);
  await b3.harvest({ node: 'n9', kind: 'herbs', climate: 231, region: 21, act: {}, at: t / 1000 | 0, material: HERB });
  t += PROF_REFRESH_BACKOFF_MS;
  assert.equal(b3.stale(), true);
});

test('BAG1 (AUDIT2 K5/K6/K8/K12): a station\'s put-in refused for a later input leaves the earlier in the Stores, said by `moved` and in the station\'s words; one unanswered is `deposit-kept` and no craft is kept; a second press while it is out says so at once, never a second put-in; a deposit while another is on the wire is the deposit\'s own word (mutants: `kept` passed to the craft; a second put-in; the moved inputs unsaid; `prof-busy`)', async () => {
  const e = body();
  mintCarried(e, 'ingot:iron', 2);
  mintCarried(e, 'metal:tin', 2);
  const deposits = [];
  let tin = { ok: false, error: 'stores-full' };
  const door = {
    account: () => 'a',
    state: async () => ({ ok: true, data: { carried: [{ material: 'ingot:iron', own: 2, bought: 0 }, { material: 'metal:tin', own: 2, bought: 0 }] } }),
    deposit: async (c, m, q) => { deposits.push([m, q]); return m === 'metal:tin' ? tin : { ok: true, data: { store: { material: m, own: q, bought: 0 }, carried: { material: m, own: 1, bought: 0 } } }; },
    craft: async () => ({ ok: true, data: {} }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e) });
  await book.refresh({ force: true });
  const r = await book.craft('dagger:iron', {}, () => {});
  assert.deepEqual(r, { ok: false, error: 'stores-full', material: 'metal:tin', moved: 1 }, 'the iron in, the tin refused');
  assert.equal(movedFirstText(r), ' 1 of the materials went into your Stores first - the next try spends them there.');
  assert.equal(movedFirstText({ moved: 0 }), '');
  assert.match(src('src/scenes/world.js'), /text: `\$\{accountRefusalText\(r\?\.error\)\}\$\{movedFirstText\(r\)\}` \};\n\s+\/\/ the fee for the smelt/);
  assert.equal(book.storesHeld('ingot:iron'), 1, 'the iron waits in the Stores for the next craft');
  tin = { ok: false, error: 'offline' };
  const r2 = await book.craft('dagger:iron', {}, () => {});
  assert.deepEqual([r2.error, r2.material, 'kept' in r2, book.pendingCrafts], ['deposit-kept', 'metal:tin', false, 0], 'no craft kept');
  const before = deposits.length;
  const r3 = await book.craft('dagger:iron', {}, () => {});
  assert.deepEqual([r3.error, deposits.length], ['deposit-kept', before], 'said at once - never a second put-in');
  // K12: one deposit at a time, in the deposit's own words
  let release;
  const gate = new Promise((res) => { release = res; });
  const e2 = body();
  mintCarried(e2, HERB, 4);
  const b2 = createProfBook({ door: { account: () => 'a', deposit: async () => { await gate; return { ok: false, error: 'stores-full' }; } }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e2) });
  const first = b2.deposit(HERB, 1);
  assert.deepEqual(await b2.deposit(HERB, 1), { ok: false, error: 'deposit-busy' });
  assert.match(accountRefusalText('deposit-busy'), /still being counted/);
  release();
  await first;
});

test('BAG1 (AUDIT B8/B9): a station\'s put-in with no answer says so; a Court writ\'s card names its shortfall where the book\'s list has none; a station\'s work says where it went; what a harvest left is named each by its own (mutants: `deposit-kept` said as offline; the card unread)', async () => {
  const e = body();
  mintCarried(e, OAK, 10);
  let depositAnswer = { ok: false, error: 'offline' };
  const asked = [];
  const door = {
    account: () => 'a',
    deposit: async (c, m, q, held, order) => { asked.push([m, q, order]); return typeof depositAnswer === 'function' ? depositAnswer(m, q, held) : depositAnswer; },
    harvest: async () => ({ ok: true, data: { carry: true, material: OAK, qty: 0, carried: { material: OAK, own: 10, bought: 0 } } }),
    deliver: async () => ({ ok: true, data: { pay: 5 } }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e) });
  await book.harvest({ node: 'n', kind: 'trees', climate: 231, region: 21, act: {}, at: 1 });
  const kept = await book.ensureInStores([{ key: OAK, n: 2 }]);
  assert.deepEqual([kept.ok, kept.error, kept.kept], [false, 'deposit-kept', true]);
  assert.match(accountRefusalText('deposit-kept'), /on their way into your Stores/);
  await book.settle(() => {});   // the kept one, still unanswered
  depositAnswer = (m, q, held) => ({ ok: true, data: { store: { material: m, own: q, bought: 0 }, carried: { material: m, own: Math.max(0, held - q), bought: 0 } } });
  await book.settle(() => {});
  asked.length = 0;
  const r = await book.deliver('w1', 21, { material: OAK, qty: 5 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(asked, [[OAK, 3, 'spend']], 'the card\'s five: two in the Stores already, three put in');
  assert.equal(madeWhere({ bag: 3, pack: 0, stored: 0 }), 'Into your bag.');
  assert.equal(madeWhere({ bag: 1, pack: 2, stored: 0 }), 'Into your bag and pack.');
  assert.equal(madeWhere({ bag: 2, pack: 0, stored: 1 }), 'Into your bag - 1 stays in your Stores: no room in your bag or pack.');
  assert.equal(madeWhere({ bag: 0, pack: 0, stored: 4 }), '4 stay in your Stores: no room in your bag or pack.');
  assert.equal(madeWhere(undefined), '');
  assert.match(src('src/scenes/world.js'), /const where = madeWhere\(r\.data\.put\)/);
  assert.equal(leftWords({ material: HERB, put: { left: 3, lost: [{ key: HERB, n: 2 }, { key: OAK, n: 1 }] } }), `2 ${materialCountLabel(HERB, 2)} and 1 ${materialCountLabel(OAK, 1)}`);
  assert.equal(leftWords({ material: HERB, put: { left: 2 } }), `2 ${materialCountLabel(HERB, 2)}`, 'a put from before the audit');
  // the book names what it could not mint: a gem the hands could not make is the gem's, not the harvest's (PACK-OVER: a
  // harvest is minted through `give`, so a unit is never left for want of room - only for want of a pack form)
  const full = { ...hands(body()), give: (k, q) => (k === 'gem:ruby' ? { bag: 0, pack: 0, over: 0 } : { bag: q, pack: 0, over: 0 }) };
  const gemDoor = { account: () => 'a', harvest: async () => ({ ok: true, data: { carry: true, material: HERB, qty: 2, gem: 'gem:ruby', carried: { material: HERB, own: 2, bought: 0 } } }) };
  const g = await createProfBook({ door: gemDoor, storage: memStorage(), character: () => 'c', sleep: noWait, carry: full }).harvest({ node: 'n', kind: 'herbs', climate: 231, region: 21, act: {}, at: 1, material: HERB });
  assert.deepEqual(g.data.put, { bag: 2, pack: 0, over: 0, left: 1, lost: [{ key: 'gem:ruby', n: 1 }] });
});

test('BAG1 (AUDIT B6/B7): the wagon\'s are held and taken last; food in the bag rots as the pack\'s does, and a food on its way to putrid is no material (mutants: the wagon unread; the wagon first; the bag a larder with no clock; a rotting haunch counted)', () => {
  const e = { ...body(), wagonItems: [] };
  mintCarried(e, HERB, 2);
  for (let i = 0; i < 3; i++) addItem(e.wagonItems, mintMaterialItem(HERB), 'back');
  assert.equal(heldOf(e, HERB), 5, 'the bag\'s two and the wagon\'s three');
  const t = takeCarried(e, HERB, 3);
  assert.equal(t.taken, 3);
  assert.deepEqual([bagItemsOf(e).length, e.wagonItems.reduce((a, i) => a + (i.stackCount ?? 1), 0)], [0, 2], 'the bag first, the wagon last');
  t.back();
  assert.equal(heldOf(e, HERB), 5);
  // rot
  const inPack = mintMaterialItem('food:meat', true);
  const inBag = mintMaterialItem('food:meat', true);
  const r = { stats: { strength: 50, endurance: 50 }, items: [inPack], wagonItems: [], otherItems: [], bagItems: [inBag], goldPieces: 0 };
  for (let m = 1; m <= 2000; m++) survivalMinute(r, m, { natural: 30 }, { rolls: () => 0.99, autoEat: false, autoDrink: false });
  assert.ok((inPack.foodStage ?? 0) > 0, 'the pack\'s meat turned');
  assert.ok((inBag.foodStage ?? 0) > 0, 'and the bag\'s with it');
  assert.equal(materialKeyOfItem(inBag), null, 'no longer the Basket\'s meat');
  assert.equal(materialKeyOfItem(mintMaterialItem('food:meat', true)), 'food:meat', 'a fresh one is');
});

test('BAG1 (AUDIT2 H3/H12): a take\'s undo puts each unit back by its list\'s role, read at the undo - a split stack whose rest has gone comes back as a record of its own, and the bag\'s go to the pack once the bag has left; only what has a pack form is ever minted (mutants: the undo onto the stale record; into a bag that left; Arcane Essence minted)', () => {
  const e = body();
  mintCarried(e, HERB, 5);
  const t = takeCarried(e, HERB, 2);
  const rest = bagItemsOf(e)[0];
  assert.equal(rest.stackCount, 3);
  bagItemsOf(e).splice(0, 1);   // the rest sold since
  t.back();
  assert.deepEqual([heldOf(e, HERB), bagItemsOf(e).length], [2, 1], 'the two back');
  assert.notEqual(bagItemsOf(e)[0], rest, 'a record of their own, never the one sold');
  const e2 = body();
  mintCarried(e2, HERB, 3);
  const t2 = takeCarried(e2, HERB, 3, 'dep-2');
  assert.deepEqual(bagTakesOf(e2), { 'dep-2': { material: HERB, qty: 3 } });
  e2.items = e2.items.filter((it) => !isBagItem(it));   // the bag, empty, sold
  t2.back();
  assert.equal(sumOf(e2.items, HERB), 3, 'into the pack');
  assert.deepEqual(bagTakesOf(e2), {}, 'the undo takes the stamp off with them');
  assert.deepEqual(mintCarried(body(), 'essence:arcane', 2), { bag: 0, pack: 0, left: 2 });
  assert.deepEqual(mintCarried(body(), 'work:ram', 1), { bag: 0, pack: 0, left: 1 });
});

test('BAG1 (AUDIT2 K4/K10/K13): a station\'s work comes out of the Stores in as many withdrawals as the room takes, each within a withdrawal\'s bound; every unit handed over is minted - past the pack\'s weight where the room shrank meanwhile; what stays says why; a press that threw lets its id go (mutants: one withdrawal of 200; the overflow lost; busy and unanswered said as no room; the id held by a throw)', async () => {
  const PLANK = 'plank:pine';
  const withdrawals = [];
  let onWithdraw = async () => {};
  let wAnswer = null;
  let throwOnce = false;
  const door = {
    account: () => 'a',
    state: async () => ({ ok: true, data: { stores: [{ material: 'log:pine', own: 999, bought: 0 }], carried: [] } }),
    smelt: async (c, recipe, count) => ({ ok: true, data: { recipe, own: count * 2, bought: 0, stores: [{ material: PLANK, own: count * 2, bought: 0 }] } }),   // two planks a log
    withdraw: async (c, m, q) => { withdrawals.push(q); await onWithdraw(q); return wAnswer ?? { ok: true, data: { material: m, qty: q, carried: { material: m, own: q, bought: 0 } } }; },
  };
  const e = body();
  const h = hands(e);
  const carry = { ...h, held: (k) => { if (throwOnce) { throwOnce = false; throw new Error('a host that threw'); } return h.held(k); } };
  let n = 0;
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', rid: () => `r-${++n}`, sleep: noWait, carry });
  await book.refresh();
  assert.equal(roomFor(e, PLANK), 375);
  const r = await book.smelt('saw:pine', 125);
  assert.deepEqual(withdrawals, [200, 50], 'two withdrawals, each within the bound');
  assert.deepEqual(r.data.put, { bag: 250, pack: 0, stored: 0, coming: 0, why: null });
  assert.equal(madeWhere(r.data.put), 'Into your bag.');
  // the room shrank between the ask and the answer (a harvest minted): every unit still minted, the rest over the weight
  withdrawals.length = 0;
  onWithdraw = async () => { mintCarried(e, PLANK, roomFor(e, PLANK) - 30); onWithdraw = async () => {}; };
  const r2 = await book.smelt('saw:pine', 50);
  assert.deepEqual([withdrawals, r2.data.put.stored, r2.data.put.bag + r2.data.put.pack], [[100], 0, 100]);
  assert.equal(heldOf(e, PLANK), 250 + 95 + 100, 'none lost: 70 past the pack\'s weight');
  // no room at all
  const r3 = await book.smelt('saw:pine', 5);
  assert.deepEqual([r3.data.put.stored, r3.data.put.why], [10, 'room']);
  assert.equal(madeWhere(r3.data.put), '10 stay in your Stores: no room in your bag or pack.');
  // unanswered: on its way, said so; refused: the refusal's words; busy: never "no room"
  takeCarried(e, PLANK, 600);
  wAnswer = { ok: false, error: 'offline' };
  const r4 = await book.smelt('saw:pine', 2);
  assert.deepEqual([r4.data.put.coming, r4.data.put.stored, r4.data.put.why], [4, 0, null]);
  assert.equal(madeWhere(r4.data.put), '4 on their way from your Stores: the counting-house has not answered yet.');
  assert.equal(madeWhere({ bag: 200, pack: 0, stored: 50, coming: 0, why: 'kept' }), 'Into your bag - 50 stay in your Stores: take them out once it has.');
  assert.equal(madeWhere({ bag: 0, pack: 0, stored: 3, coming: 0, why: 'busy' }), '3 stay in your Stores: another withdrawal was still being counted.');
  assert.equal(madeWhere({ bag: 0, pack: 0, stored: 3, coming: 0, why: 'refused', text: 'Your Stores do not hold that many.' }), '3 stay in your Stores. Your Stores do not hold that many.');
  wAnswer = { ok: false, error: 'stores-short' };
  const r5 = await book.smelt('saw:pine', 3);
  assert.deepEqual([r5.data.put.why, r5.data.put.text], ['refused', accountRefusalText('stores-short')]);
  let release;
  wAnswer = null;
  onWithdraw = () => new Promise((res) => { release = res; });
  const pending = book.withdraw(PLANK, 1, () => {});
  onWithdraw = async () => {};
  const r6 = await book.smelt('saw:pine', 4);
  assert.deepEqual([r6.data.put.why, r6.data.put.stored], ['busy', 8]);
  release();
  await pending;
  // K13: a press that threw (the host's hands, mid put-in) lets the smelt's id go - the next press is asked
  throwOnce = true;
  await assert.rejects(book.smelt('saw:pine', 6, {}));
  const again = await book.smelt('saw:pine', 6, {});
  assert.equal(again.ok, true, 'asked again, not the same rejected press');
});

test('BAG1 (AUDIT B4/B5; AUDIT2 K4/H5): every gathering kind names the material its goods are, so the held count is said; a withdrawal\'s goods with no room come into the pack, over its weight - the hands\' `give`, which the world\'s withdrawal and a station\'s carry-out both mint through (mutants: no kind named one; the overflow dropped; a thing with no pack form minted)', () => {
  assert.equal(actMaterial({ material: 'log:oak' }), 'log:oak');
  assert.equal(actMaterial({ material: (info) => herbKey(9, info.region), info: { region: 21 } }), herbKey(9, 21), 'a herb\'s by its region');
  assert.equal(actMaterial({ harvest: 'food' }), null, 'the Basket\'s roll: none');
  assert.match(src('src/scenes/gatherHost.js'), /^\s+\.\.\.\(actMaterial\(a\) \? \{ material: actMaterial\(a\) \} : \{\}\),$/m, 'AUDIT2 D3: a line of code, never a comment');
  // AUDIT2 D3: DFU's potion maker reads the bag after the cart and spends it - lines of code, never comments
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /^\s+wagonItems: \(\) => \[\.\.\.\(playerEntity\.wagonItems \?\?= \[\]\), \.\.\.\(playerEntity\.bagItems \?\? \[\]\)\],/m);
  assert.match(modes, /^\s+return where !== 'pack' && removeOne\(playerEntity\.bagItems \?\? \[\], templateIndex, \{ group, allowEnchantedItem: false \}\);/m);
  assert.match(src('src/scenes/herbHost.js'), /plan\.harvest === 'herbs' \? \{ material: \(info\) => herbKey\(p\.herb, info\?\.region \?\? 0\) \}/);
  assert.match(src('src/scenes/treeHost.js'), /material: n\.material,/);
  assert.match(src('src/scenes/mineHost.js'), /n\.what === 'boulder' \? \{\} : \{ material: n\.material \}/);
  assert.match(src('src/scenes/huntHost.js'), /material: b\.hide,/);
  assert.match(src('src/scenes/fishHost.js'), /material: FISH_KEY,/);
  const full = body();
  mintCarried(full, OAK, 187);
  assert.deepEqual(giveCarried(full, OAK, 5), { bag: 0, pack: 0, over: 5 }, 'no room: into the pack past its weight');
  assert.equal(heldOf(full, OAK), 192);
  const some = body();
  mintCarried(some, OAK, 185);
  assert.deepEqual(giveCarried(some, OAK, 4), { bag: 0, pack: 2, over: 2 });
  assert.deepEqual(giveCarried(body(), 'essence:arcane', 2), { bag: 0, pack: 0, over: 0 }, 'the Stores\' own, never an item');
  assert.match(src('src/scenes/world.js'), /const got = carryHands\.give\(key, n\);/);
});

test('BAG1 (AUDIT H1/H2; AUDIT2 U8): the bag opens from a plain pack - its button on the footer while nothing stands beside the pack; never over a reward tray; the bag\'s card offers no Put in bag for what it refuses; the gold field goes with the bag\'s opening (mutants: the door on the side window alone; the bag over a tray; a dagger offered; the field back over the pack)', () => {
  const named = (r) => r.querySelector('.itemname')?.children?.[0]?.textContent ?? '';
  const acts = (host) => host.querySelectorAll('.act').map((b) => b.textContent);
  const dagger = () => setItemFields({ group: 'Weapons', templateIndex: 113, material: 0 });
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'K', stats: { strength: 50 }, items: [bagItem(), dagger()], bagItems: [mintMaterialItem(OAK)], goldPieces: 0 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, bagItems: () => e.bagItems, wagonItems: () => [], onExit: () => {} });
    assert.equal(host.querySelector('.loot-win'), null, 'nothing beside the pack');
    const door = host.querySelectorAll('.act').find((b) => b.textContent === 'Materials Bag');
    assert.ok(door, 'the bag\'s door on the footer');
    door.onclick();
    assert.ok(host.querySelector('.loot-win'), 'the bag beside the pack');
    assert.ok(host.querySelectorAll('.itemrow').some((r) => r.closest('.loot-win') && /Oak/.test(named(r))));
    host.querySelectorAll('.itemrow').find((r) => !r.closest('.loot-win') && /Dagger/.test(named(r))).onclick();
    assert.equal(acts(host).includes('Put in bag'), false, 'a dagger is no material');
    view.unmount();
  });
  // AUDIT2 U8: the gold field opened, then the bag - the field goes, and never comes back when the bag closes
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'K', stats: { strength: 50 }, items: [bagItem()], bagItems: [mintMaterialItem(OAK)], goldPieces: 50 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, bagItems: () => e.bagItems, wagonItems: () => [], onExit: () => {} });
    host.querySelectorAll('.goldbtn')[0].onclick();
    assert.ok(host.querySelector('.goldfield'), 'the field up');
    host.querySelectorAll('.act').find((b) => b.textContent === 'Materials Bag').onclick();
    assert.equal(host.querySelector('.goldfield'), null, 'the bag up: no field');
    host.querySelectorAll('.act').find((b) => b.textContent === 'Close bag').onclick();
    assert.equal(host.querySelector('.goldfield'), null, 'the bag shut: the field stays put away');
    view.unmount();
  });
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'K', stats: { strength: 50 }, items: [bagItem()], bagItems: [mintMaterialItem(OAK)], goldPieces: 0 };
    const reward = [setItemFields({ group: 'Armor', templateIndex: 102, material: 0 })];
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, bagItems: () => e.bagItems, chooseOne: { items: reward, onChoose: () => {} }, onExit: () => {} });
    assert.equal(acts(host).includes('Materials Bag'), false, 'no bag over a reward tray');
    view.unmount();
  });
  assert.deepEqual(planBagToggle({ items: () => [bagItem()] }, { chooseOne: { items: [] } }).refusal, { reason: 'reward', text: BAG_WORDS.reward });
});

test('BAG1 (AUDIT): Put everything in says what went in and each material refused, passing over it; the work tab says a carrying book\'s count as held (mutants: a refusal ends the run; the Stores\' words for a carrying book)', () => {
  assert.equal(BAG_PAGE_WORDS.allInDone(12), '12 put in the Stores.');
  assert.equal(BAG_PAGE_WORDS.allInDone(12, [{ name: 'Oak Log', text: 'Your Stores hold 5,000 of that already.' }]), '12 put in the Stores. Oak Log: Your Stores hold 5,000 of that already.');
  assert.equal(BAG_PAGE_WORDS.allInDone(3, [], 'slow'), '3 put in the Stores. slow');
  const page = src('src/ui/profPages.js');
  assert.match(page, /if \(res\?\.kept\) stop = res\.text \?\? null; else refused\.push\(\{ name: r\.name, text: res\?\.text \?\? null \}\); break;/);
  assert.match(page, /const carriedAny = \[\.\.\.all\.values\(\)\]\.some/);
  assert.match(src('src/ui/workTab.js'), /\$\{count\(held\)\} \$\{w\.carrying\?\.\(\) \? 'held' : 'in your Stores'\}/);
});

test('BAG1 (AUDIT2 H1/U2/U1/U11/U14): the Stores page empties the bag into the pack - anywhere, on either skin, as much as the pack carries (the classic inventory draws no bag, and a food rotted in it held it loaded for good); Put in and Put everything in stop at the Stores\' room, said; why Take out or Put in is shut is drawn; the qty field says what it counts (mutants: no way out of the bag; the pack past its weight; the jam left behind; the Stores\' room unread; Put everything in asking a full Store; the reason a title alone; the qty unlabelled)', async () => {
  // the hands
  const e = body();
  mintCarried(e, OAK, 150);   // a full bag: 300 kg
  const rotten = mintMaterialItem('food:meat', true);
  rotten.foodStage = 2;
  bagItemsOf(e).push(rotten);
  assert.equal(materialKeyOfItem(rotten), null, 'no material: no Put in takes it');
  assert.equal(bagMayLeave(e), false);
  const r = emptyBagIntoPack(e);
  assert.ok(e.items.includes(rotten) && !bagItemsOf(e).includes(rotten), 'the rotted meat out first - never left behind by a pack the logs filled');
  const logs = sumOf(e.items, OAK);
  assert.deepEqual([r.moved, r.left], [logs + 1, 150 - logs]);
  assert.equal(logs, Math.floor((75 - carriedWeight(e) + logs * 2) / 2), 'as many logs as the pack\'s 75 kg takes after the meat');
  assert.ok(carriedWeight(e) <= 75, 'never past the pack\'s weight');
  assert.equal(sumOf(bagItemsOf(e), OAK), 150 - logs);
  const light = body();
  mintCarried(light, HERB, 4);
  assert.deepEqual(emptyBagIntoPack(light), { moved: 4, left: 0 });
  assert.equal(bagMayLeave(light), true, 'emptied: the bag may be sold');
  // the page
  const store = body();
  mintCarried(store, OAK, 10);
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { stores: [{ material: OAK, own: STORES_MAX - 3, bought: 0 }], carried: [{ material: OAK, own: 10, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(store) });
  await book.refresh({ force: true });
  assert.equal(storesRoomOf(book, book.store(OAK)), 3);
  const deposits = [];
  let emptied = 0;
  withDom((dom) => {
    resetProfPages();
    const kit = { el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div') };
    let town = false;
    setProfessionsPages({
      book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => town, room: (k) => roomFor(store, k), carriedHeld: (k) => heldOf(store, k),
      bag: () => ({ has: true, kg: bagWeight(store), max: BAG_KG_LIMIT, count: store.bagItems.length }),
      emptyBag: () => { emptied++; return emptyBagIntoPack(store); },
      deposit: async (k, n) => { deposits.push([k, n]); return { ok: true, text: '' }; },
    });
    let root = null;
    const draw = () => { root = dom.mk('div'); drawStoresPage(root, draw, kit); };
    draw();
    const btn = (w) => root.querySelectorAll('button').find((b) => b.textContent === w);
    const said = () => root.querySelectorAll('p').map((n) => n.textContent).join(' ');
    assert.ok(btn(BAG_PAGE_WORDS.emptyBag), 'out of town too');
    btn(BAG_PAGE_WORDS.emptyBag).onclick();
    assert.equal(emptied, 1);
    assert.match(said(), /10 moved into your pack\./);
    assert.equal(btn(BAG_PAGE_WORDS.emptyBag), undefined, 'an empty bag: none');
    town = true;
    draw();
    root.querySelectorAll('button').find((b) => b.className.startsWith('prof-mat') && b.querySelector('b')?.textContent === OAK).onclick();
    const qty = root.querySelectorAll('input').find((i) => i.className === 'prof-qty');
    assert.equal(qty.getAttribute('aria-label'), 'How many', 'the field says what it counts');
    qty.value = '10';
    qty.oninput();
    btn('Put in').onclick();
    assert.deepEqual(deposits, [[OAK, 3]], 'the Stores\' three, never ten for a refusal');
    assert.equal(said().includes(BAG_WORDS.noRoom), false, 'room for the logs: no reason');
    mintCarried(store, OAK, roomFor(store, OAK));   // the bag and the pack full
    draw();
    assert.ok(said().includes(BAG_WORDS.noRoom), 'Take out\'s reason drawn, not a title alone');
  });
  // Put everything in: the Stores full - said, never asked
  await book.refresh({ force: true });
  book.state.stores.set(OAK, { material: OAK, own: STORES_MAX, bought: 0 });
  deposits.length = 0;
  await withDom(async (dom) => {
    resetProfPages();
    const kit = { el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div') };
    setProfessionsPages({
      book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, room: (k) => roomFor(store, k), carriedHeld: (k) => heldOf(store, k),
      bag: () => ({ has: true, kg: bagWeight(store), max: BAG_KG_LIMIT, count: store.bagItems.length }),
      deposit: async (k, n) => { deposits.push([k, n]); return { ok: true, text: '' }; },
    });
    let root = null;
    let drawn = null;
    const draw = () => { root = dom.mk('div'); drawStoresPage(root, draw, kit); drawn = root; };
    draw();
    await drawn.querySelectorAll('button').find((b) => b.textContent === BAG_PAGE_WORDS.allIn).onclick();
    assert.equal(deposits.length, 0);
    assert.match(root.querySelectorAll('p').map((n) => n.textContent).join(' '), new RegExp(`${OAK}: ${BAG_PAGE_WORDS.storesFull}`));
  });
  setProfessionsPages(null);
  assert.match(BAG_PAGE_WORDS.takenNote, /into your Materials Bag, then your pack - and back into the Stores from your bag, pack or wagon/);
});

test('BAG1 (AUDIT2 D3/D4): the bag\'s list in every door that reads a character\'s lists - the orphan sweep, the realm\'s customs, the four hosts\' inventories; an enchanted piece is no material; Put everything in passes a material the service refuses and puts the rest in (mutants: the bag unswept; an enchanted herb counted; a refusal ends the run)', async () => {
  // the orphan sweep reaches the bag (save.js removeAllOrphanedItems)
  const e = { items: [], wagonItems: [], otherItems: [], bagItems: [{ ...mintMaterialItem(HERB), questItem: true, questUID: 7 }, mintMaterialItem(OAK)] };
  assert.equal(removeAllOrphanedItems(e, () => null), 1);
  assert.deepEqual(e.bagItems.map((i) => materialKeyOfItem(i)), [OAK], 'the orphaned quest piece gone from the bag, the log kept');
  assert.match(src('src/systems/realmCustoms.js'), /for \(const list of lists\(snap\.wagonItems, snap\.bagItems, snap\.items\)\) takeFrom\(list\);/);
  for (const f of ['src/scenes/exterior.js', 'src/scenes/dungeonContext.js', 'src/scenes/world.js']) {
    assert.match(src(f), /bagItems: \(\) => \(playerEntity\.bagItems \?\?= \[\]\),/, f);
  }
  // H10: an enchanted piece is never what the mint makes
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(HERB), enchantments: [{ type: 1, param: 0 }] }), null);
  assert.equal(materialKeyOfItem({ ...mintMaterialItem(HERB), customEnchantments: [{ id: 'x' }] }), null);
  // D3: Put everything in - the service refuses one material, the rest still go in, the refused one named
  const store = body();
  mintCarried(store, OAK, 3);
  mintCarried(store, HERB, 2);
  const book = createProfBook({ door: { account: () => 'a', state: async () => ({ ok: true, data: { carried: [{ material: OAK, own: 3, bought: 0 }, { material: HERB, own: 2, bought: 0 }] } }) }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(store) });
  await book.refresh({ force: true });
  const asked = [];
  await withDom(async (dom) => {
    resetProfPages();
    const kit = { el: (tag, cls, text) => { const n = dom.mk(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }, divider: (w) => { const n = dom.mk('h3'); n.textContent = w; return n; }, meter: () => dom.mk('div') };
    setProfessionsPages({
      book, name: (k) => (k === OAK ? 'Oak Log' : 'Red Rose'), withdraw: async () => ({ ok: true, text: '' }), inTown: () => true, room: (k) => roomFor(store, k), carriedHeld: (k) => heldOf(store, k),
      bag: () => ({ has: true, kg: bagWeight(store), max: BAG_KG_LIMIT, count: store.bagItems.length }),
      // the FIRST material asked is refused, whichever the page's order puts first - the run must go on past it
      deposit: async (k, n) => { asked.push([k, n]); return asked.length === 1 ? { ok: false, text: 'Refused.' } : { ok: true, text: '' }; },
    });
    let root = null;
    const draw = () => { root = dom.mk('div'); drawStoresPage(root, draw, kit); };
    draw();
    await root.querySelectorAll('button').find((b) => b.textContent === BAG_PAGE_WORDS.allIn).onclick();
    assert.deepEqual(asked.map((a) => a[0]).sort(), [HERB, OAK].sort(), 'both asked: a refusal passed over');
    const [first, second] = asked;
    const nameOf = (k) => (k === OAK ? 'Oak Log' : 'Red Rose');
    assert.ok(root.querySelectorAll('p').map((n) => n.textContent).join(' ').includes(BAG_PAGE_WORDS.allInDone(second[1], [{ name: nameOf(first[0]), text: 'Refused.' }])));
  });
  setProfessionsPages(null);
});

test('BAG1 a station\'s shortfall goes into the Stores first - bought before own, never gold\'s - every input covered before any moves; what cannot be covered moves nothing (mutants: the spend order; a partial move)', async () => {
  const e = body();
  mintCarried(e, OAK, 10);
  mintCarried(e, HERB, 1);
  const asked = [];
  const door = {
    account: () => 'a',
    deposit: async (c, m, q, held, order) => { asked.push([m, q, held, order]); return { ok: true, data: { store: { material: m, own: q, bought: 0 }, carried: { material: m, own: held - q, bought: 0 } } }; },
    harvest: async () => ({ ok: true, data: { carry: true, material: OAK, qty: 0, carried: { material: OAK, own: 10, bought: 0 } } }),
  };
  const book = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e) });
  await book.harvest({ node: 'n', kind: 'trees', climate: 231, region: 21, act: {}, at: 1 });   // the count, as the service said it
  const short = await book.ensureInStores([{ key: OAK, n: 4 }, { key: HERB, n: 3 }]);
  assert.deepEqual([short.ok, short.error, short.material], [false, 'materials-short', HERB]);
  assert.equal(asked.length, 0, 'nothing moved for the input that could be covered');
  assert.equal(accountRefusalText('materials-short'), 'You do not have that many - in your Stores, your Materials Bag and your pack together.');
  const ok = await book.ensureInStores([{ key: OAK, n: 3 }, { key: OAK, n: 1 }]);
  assert.deepEqual(ok, { ok: true, moved: 4 });
  assert.deepEqual(asked, [[OAK, 4, 10, 'spend']], 'summed by material, bought first');
  assert.equal(heldOf(e, OAK), 6);
  assert.deepEqual(await book.ensureInStores([{ key: OAK, n: 4 }]), { ok: true, moved: 0 }, 'the Stores hold it now');
  const plain = createProfBook({ door, storage: memStorage(), character: () => 'c', sleep: noWait });
  assert.deepEqual(await plain.ensureInStores([{ key: OAK, n: 99 }]), { ok: true, moved: 0 }, 'a book that does not carry spends the Stores as it always has');
});

test('BAG1 full: a carrying book\'s node is full when neither the bag nor the pack has room for one more, or the count is at its bound - said as such; an older book\'s is the Stores\' (mutants: the Stores read for a carrying book)', () => {
  const e = body();
  const book = createProfBook({ door: { account: () => 'a' }, storage: memStorage(), character: () => 'c', sleep: noWait, carry: hands(e) });
  assert.equal(storesFullIn(book, OAK), false);
  mintCarried(e, OAK, 187);
  assert.equal(storesFullIn(book, OAK), true, 'no room for one more log');
  assert.equal(storesFullIn(book, HERB), false, 'a lighter herb still fits... ');
  assert.equal(fullWordsIn(book), BAG_WORDS.noRoom);
  const plain = createProfBook({ door: { account: () => 'a' }, storage: memStorage(), character: () => 'c', sleep: noWait });
  assert.equal(fullWordsIn(plain), 'Stores full');
  assert.equal(storesFullIn(plain, OAK), false);
});

// ─── THE HOST ───────────────────────────────────────────────────────

test('BAG1 wired: the world host hands the book its hands on the bag and the pack, mints each answer there, reaches the Stores in a town, and puts a writ\'s shortfall in first; the potion maker spends the bag (by source)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /mint: \(key, n\) => \{ const got = mintCarried\(playerEntity, key, n, carryOpts\(key\)\);/);
  assert.match(w, /take: \(key, n, stamp = null, order = null\) => \{\n\s+const t = takeCarried\(playerEntity, key, n, stamp, order\);/);
  // AUDIT2: every unit handed over minted; the deposits' stamps in the save; the checkpoint that LANDED before a deposit
  assert.match(w, /give: \(key, n\) => \{ const got = giveCarried\(playerEntity, key, n, carryOpts\(key\)\);/);
  assert.match(w, /stamped: \(id\) => Object\.hasOwn\(bagTakesOf\(playerEntity\), id\),/);
  assert.match(w, /stamps: \(\) => Object\.entries\(bagTakesOf\(playerEntity\)\)\.map\(\(\[id, t\]\) => \(\{ id, \.\.\.t \}\)\),/);
  assert.match(w, /flush: async \(\) => \{\n\s+try \{ const r = await onlineCheckpointLanded\(\); return r === true \|\| r\?\.ok === true; \} catch \{ return false; \}/);
  assert.match(src('src/systems/save.js'), /snap\.bagTakes = bagTakesSaved\(entity\.bagTakes\);/);
  assert.match(w, /const _storesReached = \(\) => \(modes\?\.mode \?\? 'exterior'\) !== 'dungeon' && _musicInLocationRect\(\)/);
  assert.match(w, /const ready = await profBook\.ensureInStores\(\[\{ key: material, n: Number\(ask\.units\) \|\| 0 \}\]\);/);
  assert.match(src('src/scenes/worldModes.js'), /bagItems/);
  assert.match(src('src/systems/save.js'), /bagItems/);
});

// ─── DONE WHEN: THROUGH THE REAL WORKER ─────────────────────────────

const DAY = 86_400;
const WOODS = 231, ANTICLERE = 21;
const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
function secondAt(from, want) {
  for (let s = from; s < from + 2 * 7200; s += 30) if (hourAt(s) === want && hourAt(s - 60) === want && hourAt(s + 60) === want) return s;
  throw new Error('no such hour');
}

test('BAG1 done when: a new character gathers into the pack with no bag, buys a bag and gathers into it; the herbs go into the Stores from the Stores page and come back out into the bag - every count the service\'s, through the real Worker', async () => {
  const NOON = secondAt(utcDay(T0) * DAY + 3600, 12);
  const realNow = Date.now;
  Date.now = () => NOON * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
    const mac = await s.registered('Mac');
    const door = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
    const e = body({ bag: false });
    const book = createProfBook({ door, storage: memStorage(), character: () => mac.character, now: () => NOON * 1000, sleep: noWait, carry: hands(e) });
    assert.equal((await book.refresh()).ok, true);
    const patches = [];
    for (let x = 300; x < 700 && patches.length < 2; x++) {
      const p = herbPatches({ x, y: 200, day: utcDay(NOON), climate: WOODS, confirmed: false }).find((q) => q.tier === 1);
      if (p) patches.push({ x, y: 200, ...p });
    }
    const gather = (p) => book.harvest({
      node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(NOON), slot: p.slot }), kind: 'herbs', climate: WOODS, region: ANTICLERE,
      act: { clean: false, bruised: false }, at: NOON - 2, material: herbKey(p.herb, ANTICLERE),
    });
    const r1 = await gather(patches[0]);
    assert.equal(r1.ok, true, JSON.stringify(r1));
    const k1 = r1.data.material;
    assert.deepEqual(r1.data.put, { bag: 0, pack: r1.data.qty, over: 0, left: 0, lost: [] }, 'no bag yet: the pack');
    assert.equal(heldOf(e, k1), r1.data.qty);
    e.items.push(bagItem());   // bought at a General Store
    const r2 = await gather(patches[1]);
    assert.equal(r2.ok, true, JSON.stringify(r2));
    assert.equal(r2.data.put.bag, r2.data.qty, 'into the bag');
    const k2 = r2.data.material;
    // the Stores page's Put in, in town
    const d = await book.deposit(k2, r2.data.qty);
    assert.equal(d.ok, true, JSON.stringify(d));
    assert.equal(book.storesHeld(k2), r2.data.qty);
    assert.equal(heldOf(e, k2) - (k1 === k2 ? r1.data.qty : 0), 0, 'out of the bag');
    // and back out, carried
    const minted = [];
    const w = await book.withdraw(k2, 1, (k, q) => minted.push(mintCarried(e, k, q)));
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.deepEqual(minted, [{ bag: 1, pack: 0, left: 0 }]);
    assert.equal(book.storesHeld(k2), r2.data.qty - 1);
    assert.equal(book.carried(k2).own, (k1 === k2 ? r1.data.qty : 0) + 1, 'counted as carried again');
  } finally { Date.now = realNow; }
});
