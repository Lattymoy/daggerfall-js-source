// AUDIT REALM2 (2026-09-28, the trade-and-customs lane of the audit of REALM - bible/06-Systems/Realm-Arc.md sections 3,
// 4 and 6): T1-T7, each reproduced before it was fixed and pinned here. T4 (a boat's parts crossing a trade without
// their cargo) is closed by T1; T6 is another lane's. The service is driven through the REAL Worker over the REAL
// migrations (node:sqlite behind a D1-shaped face whose batch is one transaction, and R2's calls), as
// test/systems/auditrealm.test.js stands it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../server-account/src/index.js';
import { _resetKeyForTests } from '../../server-account/src/signing.js';
import { SESSION_KEY } from '../../src/net/accountClient.js';
import { tradeableRecord, settleRealmTrade, BOAT_TEMPLATES } from '../../src/net/realm/realmTradeLaw.js';
import { createTradePack, tradeRefusal } from '../../src/systems/tradePack.js';
import { BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE, mintBoatItem, boatItemName, boatItemMessage } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { COME_SAIL_AWAY_VENDOR } from '../../src/systems/comeSailAway/comeSailAway.js';
import { realmIo, realmCreate, realmFetch, realmPut, realmTradeCall } from '../../src/systems/realmSaves.js';
import { applyCustoms, liquidWealthOf, stashedItemLists, customsLines } from '../../src/systems/realmCustoms.js';
import { createBankAccounts, createHouses, allocateHouseToPlayer, ownsHouse, ownsShip, sellShip, sellHouse, shipSellPrice, SHIP_TYPES, SHIP_INTERIOR_MAP_IDS, crossedDeedLines, CROSSED_DEED_LINES } from '../../src/systems/banking.js';
import { interiorSceneName, LOOT_CONTAINER_TYPES } from '../../src/systems/sceneCache.js';
import { BUILDING_KEY_0 } from '../../src/systems/talk/talkTopics.js';
import { decorSaleBack } from '../../src/net/decorLaw.js';
import { LETTER_OF_CREDIT_TEMPLATE, goldStack, letterOfCredit } from '../../src/systems/inventory.js';
import { planStore, applyTransfer } from '../../src/systems/item/itemTransfer.js';
import { createWeapon } from '../../src/combat/enemyEquipment.js';
import { r2, freshSave, layRecord } from '../realmSeat.mjs';   // AUDIT REALM2 S1: a realm character's first save is a new one's
import { ACCEPTED } from '../../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

// ---- the service, as test/systems/auditrealm.test.js stands it ------------------------------------------------------------------

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** One service; `player()` is a signed-in guest account on its own device. */
async function realm() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  async function player() {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    return { g, storage, io: realmIo({ fetch: (url, init) => worker.fetch(new Request(url, init), env), storage }) };
  }
  return { env, player };
}
/** A realm character with its first save: `{ id, lease, seq }` after the checkpoint. AUDIT REALM2 S1: the first save a
 *  new character's (the service reads it), and `save` - the record the pin counts from - laid over it (realmSeat.mjs). */
async function character(env, io, name, save) {
  const made = (await realmCreate(io, name)).data;
  const put = await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name })));
  assert.equal(put.ok, true);
  layRecord(env, made.id, save);
  return { id: made.id, lease: made.lease, seq: 1 };
}
const record = async (io, id) => { const r = await realmFetch(io, id); return { seq: r.seq, save: JSON.parse(r.text) }; };

// ---- the goods ----------------------------------------------------------------------------------------------------------

const plain = (x) => JSON.parse(JSON.stringify(x));
const dagger = () => createWeapon(113, 9, () => 0.5);
const torch = () => ({ group: 'UselessItems2', templateIndex: 247, name: 'Torch', currentCondition: 40, maxCondition: 60 });
const candles = (n) => ({ group: 'UselessItems2', templateIndex: 245, name: 'Candle', currentCondition: 30, maxCondition: 30, stackCount: n });
const letter = (value) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, name: 'Letter of Credit', value, stackCount: 1 });
/** Come Sail Away's two items as the mod mints them for a hull and a variant (PackBoat, the shelf and giveboat alike). */
function boatItem(templateIndex, hull, uid) {
  const it = mintBoatItem(templateIndex, uid);
  it.message = boatItemMessage(hull, 0);
  it.name = boatItemName(it.name, hull, 0);
  return it;
}

// ---- T1: a boat's deed and parts stay with the save that holds the boat -------------------------------------------------

test('AUDIT REALM2 T1: a Come Sail Away boat\'s deed and its parts never change hands - the law the service settles with and the pack the window offers from both refuse them, in words the window can say', () => {
  assert.deepEqual(BOAT_TEMPLATES, [BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE], 'the law\'s rows are the mod\'s two (systems/comeSailAway/comeSailAwayItems.js)');
  const deed = boatItem(BOAT_DEED_TEMPLATE, 3, 1790000000000001), parts = boatItem(BOAT_PARTS_TEMPLATE, 1, 1790000000000002);
  for (const [it, may] of [[deed, false], [parts, false], [torch(), true]]) {   // the torch: their group's plain row still trades
    assert.equal(tradeableRecord(plain(it)), may, it.name);
    assert.equal(tradeRefusal(it) === null, may, `the pack's own law says the same: ${it.name}`);
  }
  assert.equal(tradeRefusal(deed), 'Boat deeds and boat parts cannot be traded.');
  assert.equal(tradeRefusal(parts), tradeRefusal(deed));
  const holder = { items: [deed, parts], goldPieces: 0 };
  const pack = createTradePack(holder);
  assert.equal(pack.offerable(parts), tradeRefusal(parts), 'the window is told why');
  assert.equal(pack.take([{ item: deed, count: 1 }], 0), null, 'and the pack never reserves one');
  assert.deepEqual(holder.items, [deed, parts]);
  // r3: A's galley stands in A's world (a crewed boat keeps its deed) and A gives the deed for 10 gold; the parts carry
  // their cargo in A's save by their UID - either half is refused, and nothing moves
  const saveA = { items: [plain(deed), plain(parts)], goldPieces: 0 }, saveB = { items: [], goldPieces: 10 };
  for (const at of [0, 1]) {
    const give = { items: [plain(saveA.items[at])], gold: 0 }, get = { items: [], gold: 10 };
    assert.deepEqual(settleRealmTrade(saveA, saveB, { give, get, pick: [at] }, { give: get, get: give, pick: [] }), { why: 'goods' }, saveA.items[at].name);
  }
});

test('AUDIT REALM2 T1 / T7: the service, driven - two colluding halves naming a boat\'s deed or its parts are refused whole and move nothing; a settle leaves the giver\'s record lighting the item it lit', { timeout: 60_000 }, async () => {
  const r = await realm();
  const A = await r.player(), B = await r.player();
  A.char = await character(r.env, A.io, 'Arthago', { name: 'Arthago', items: [dagger(), boatItem(BOAT_DEED_TEMPLATE, 3, 1790000000000001), boatItem(BOAT_PARTS_TEMPLATE, 1, 1790000000000002), torch()], lightSourceIndex: 3, goldPieces: 50 });
  B.char = await character(r.env, B.io, 'Brisienna', { name: 'Brisienna', items: [], goldPieces: 50 });
  const before = [await record(A.io, A.char.id), await record(B.io, B.char.id)];
  const ask = (P, sid, give, get, pick) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid, give, get, pick });
  const get = { items: [], gold: 10 };
  for (const [sid, at] of [['sidboat01', 1], ['sidboat02', 2]]) {
    const give = { items: [before[0].save.items[at]], gold: 0 };
    assert.deepEqual((await ask(A, sid, give, get, [at])).data, { state: 'waiting' });
    assert.deepEqual((await ask(B, sid, get, give, [])).data, { state: 'refused', why: 'goods' }, before[0].save.items[at].name);
  }
  assert.deepEqual([await record(A.io, A.char.id), await record(B.io, B.char.id)], before, 'both records as they were: the deed and the parts with A, the gold with B');
  // T7: the dagger leaves from before the lit torch - the record the service writes lights the torch where it now stands
  const give = { items: [before[0].save.items[0]], gold: 0 };
  assert.deepEqual((await ask(A, 'sidlight1', give, get, [0])).data, { state: 'waiting' });
  assert.equal((await ask(B, 'sidlight1', get, give, [])).data.state, 'done');
  const after = (await record(A.io, A.char.id)).save;
  assert.deepEqual([after.lightSourceIndex, after.items[after.lightSourceIndex]?.name], [2, 'Torch']);
});

// ---- T7: the settle keeps the lit item lit --------------------------------------------------------------------------------

test('AUDIT REALM2 T7: the settle moves `lightSourceIndex` with its record - to where the record now stands when one before it leaves, to -1 when the lit record leaves whole, onto the stack that leaves in part; a save that carried none gets none', () => {
  // r6: A's lit torch is items[1]; A gives the dagger at 0 for B's lit candle
  const A = { items: [dagger(), torch()], lightSourceIndex: 1, goldPieces: 0 }, B = { items: [candles(1)], lightSourceIndex: 0, goldPieces: 0 };
  const give = { items: [plain(A.items[0])], gold: 0 }, get = { items: [plain(B.items[0])], gold: 0 };
  const s = settleRealmTrade(A, B, { give, get, pick: [0] }, { give: get, get: give, pick: [0] });
  assert.deepEqual([s.a.lightSourceIndex, s.a.items[s.a.lightSourceIndex].name], [0, 'Torch'], 'the torch, never the candle that arrived behind it');
  assert.equal(s.b.lightSourceIndex, -1, 'B\'s lit candle left whole: nothing of B\'s is lit');
  assert.equal(A.lightSourceIndex, 1, 'the saves handed in are never changed');
  // a lit stack that leaves in part stays lit, where it stands
  const C = { items: [dagger(), candles(3)], lightSourceIndex: 1, goldPieces: 0 };
  const giveC = { items: [plain(C.items[0]), { ...plain(C.items[1]), stackCount: 1 }], gold: 0 };
  const t = settleRealmTrade(C, { items: [], goldPieces: 5 }, { give: giveC, get: { items: [], gold: 5 }, pick: [0, 1] }, { give: { items: [], gold: 5 }, get: giveC, pick: [] });
  assert.deepEqual([t.a.lightSourceIndex, t.a.items[t.a.lightSourceIndex].stackCount], [0, 2]);
  // no index before, none after
  const D = { items: [dagger(), torch()], goldPieces: 0 };
  const u = settleRealmTrade(D, { items: [], goldPieces: 5 }, { give: { items: [plain(D.items[0])], gold: 0 }, get: { items: [], gold: 5 }, pick: [0] }, { give: { items: [], gold: 5 }, get: { items: [plain(D.items[0])], gold: 0 }, pick: [] });
  assert.equal('lightSourceIndex' in u.a, false);
});

// ---- T2: customs reads a boat's hold ----------------------------------------------------------------------------------------

test('AUDIT REALM2 T2: customs counts and takes what a Come Sail Away boat holds - each placed boat\'s hold and each packed boat\'s cargo, in the save\'s record of the mod (comeSailAway.js getSaveData)', () => {
  const sword = { name: 'Daedric Longsword', templateIndex: 115, weightInKg: 7 };
  const hold = [letter(2_000_000), goldStack(60_000), sword], cargo = [letter(750_000)];
  const snap = { level: 1, goldPieces: 5_000, items: [], wagonItems: [], bankAccounts: createBankAccounts(), sceneCache: null, dungeon: null, world: { piles: [] },
    modData: { [COME_SAIL_AWAY_VENDOR]: {
      placedBoats: [{ UID: 1790000000000001, Hull: 2, Variant: 0, MapPixel: { X: 100, Y: 200 }, Items: hold, lights: false, inside: false }],
      packedCargoes: { 1790000000000002: cargo },
    } } };
  // r1: customs counted 5,000 of 2,815,000, and the hold and the cargo crossed whole
  assert.equal(liquidWealthOf(snap), 5_000 + 2_000_000 + 60_000 + 750_000);
  const stashed = stashedItemLists(snap);
  assert.ok(stashed.includes(hold) && stashed.includes(cargo));
  const r = applyCustoms(snap);
  assert.deepEqual([r.wealth, r.taken, liquidWealthOf(snap)], [2_815_000, 2_785_000, 30_000]);
  assert.deepEqual(hold, [sword], 'the hold\'s coin and credit went first - its sword stays aboard');
  assert.deepEqual([cargo.map((it) => it.value), snap.goldPieces], [[25_000], 5_000], 'then the cargo\'s letter, down to the allowance; the purse stands');
});

// ---- T5: every pile and container the save carries ------------------------------------------------------------------------

test('AUDIT REALM2 T5: customs counts and takes from every pile and container the save carries - a treasure pile, a body, a shop\'s shelf, whatever the container, and a dungeon\'s treasure and its fallen: the pack can fill each (itemTransfer.js planStore); a living foe\'s own purse is none of them', () => {
  const T = LOOT_CONTAINER_TYPES;
  const inn = { sceneName: 'inn', lootContainers: [
    { containerType: T.RandomTreasure, key: 'loot:0', items: [letter(70_000)] },
    { containerType: T.CorpseMarker, key: 'body:0', items: [goldStack(7_000)] },
    { containerType: T.ShopShelves, key: 'shelf:0', items: [letter(9_000)] },   // a closed shop's shelf opens both ways (worldModes.js)
    { containerType: T.Nothing, key: 'x:0', items: [goldStack(1_000)] },
  ] };
  const open = { level: 1, goldPieces: 30_000, items: [], wagonItems: [], bankAccounts: createBankAccounts(), sceneCache: { permanentScenes: [], scenes: [inn] }, dungeon: null, world: { piles: [] } };
  assert.equal(liquidWealthOf(open), 30_000 + 70_000 + 7_000 + 9_000 + 1_000);
  const stashed = stashedItemLists(open);
  for (const c of inn.lootContainers) assert.ok(stashed.includes(c.items), `container type ${c.containerType}`);
  applyCustoms(open);
  assert.deepEqual([inn.lootContainers.map((c) => c.items), open.goldPieces], [[[], [], [], []], 30_000], 'every container emptied first; the purse at the door stands');
  // r5: the pack stores a 4,000,000 letter in a dungeon's treasure pile, and the dungeon's save carries it (`world.piles`)
  const entity = { items: [letterOfCredit(4_000_000)], goldPieces: 5_000, wagonItems: [] };
  const pile = { items: [goldStack(120)] };
  const plan = planStore(entity.items[0], { remote: pile.items });
  applyTransfer(entity.items[0], plan, entity.items, pile.items, { entity, fromLocal: true });
  assert.deepEqual([plan.ok, entity.items.length, pile.items.length], [true, 0, 2]);
  const fallen = { dead: true, items: [letter(50_000)] }, standing = { dead: false, items: [goldStack(999)] };
  const deep = { level: 1, goldPieces: 5_000, items: entity.items, wagonItems: [], bankAccounts: createBankAccounts(), dungeon: { id: 7 }, sceneCache: null,
    world: { piles: [pile], droppedLoot: [{ items: [goldStack(2_000)] }], foes: [fallen, standing] } };
  assert.equal(liquidWealthOf(deep), 5_000 + 120 + 4_000_000 + 2_000 + 50_000, 'the treasure, the drop and the body - never the living foe\'s 999');
  applyCustoms(deep);
  assert.equal(liquidWealthOf(deep), 30_000);
  assert.deepEqual([pile.items, deep.world.droppedLoot[0].items, fallen.items.map((it) => it.value), standing.items[0].stackCount, deep.goldPieces], [[], [], [25_000], 999, 5_000]);
});

// ---- T3: the deeds the realm's bank buys back ------------------------------------------------------------------------------

/** A placed piece (net/decorLaw.js decorPieceOf's shape): bought, or (DECOR2a) one of the owner's own things, at no cost. */
const piece = (id, paid, own = false) => ({ id, model: 41000, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, storage: false, paid, ...(own ? { item: { g: 5 } } : {}) });
const room = (sceneName, over = {}) => ({ sceneName, lootContainers: [], droppedPiles: [], decorItems: {}, decor: [], ...over });
/** An offline character's save as customs reads it: the purse, region 0's account, a ship, houses as [region, mapId, key]. */
function holder({ level, gold = 0, bank = 0, ship = SHIP_TYPES.None, houses = [], scenes = [] }) {
  const snap = { level, goldPieces: gold, items: [], wagonItems: [], classicMinutes: 1_000, bankAccounts: createBankAccounts(), houses: createHouses(62), ownedShip: ship,
    sceneCache: { permanentScenes: scenes.map((s) => s.sceneName), scenes }, dungeon: null, world: { piles: [] } };
  snap.bankAccounts[0].accountGold = bank;
  for (const [region, mapId, buildingKey] of houses) allocateHouseToPlayer(snap.houses, region, { buildingKey, mapId, location: 'Daggerfall' });
  return snap;
}
const HOUSE = 85_000;   // what customs counts a house at: the deed's share (banking.js DEED_SELL_MULT) of 100,000

test('AUDIT REALM2 T3 / RESTORE: customs counts each deed at what the realm\'s bank pays for it - the ship, each house, the pieces bought for their rooms - and (RESTORE, Mac: "Keep all, can\'t sell") crosses every one, marked, with every bought piece paying nothing back: none is counted past that and none is taken; the gold alone is capped, and the realm\'s bank buys no crossed deed back', () => {
  const shipRoom = room(interiorSceneName(SHIP_INTERIOR_MAP_IDS[SHIP_TYPES.Large], BUILDING_KEY_0), { decor: [piece('s1', 400), piece('s2', 400)] });
  const room17 = room(interiorSceneName(1017, 5), { lootContainers: [{ containerType: LOOT_CONTAINER_TYPES.HouseContainers, key: 'container:0', items: [goldStack(30_000)] }], decor: [piece('own17', 0, true)] });
  const room18 = room(interiorSceneName(1018, 6), { decor: [...Array.from({ length: 30 }, (_, i) => piece(`p${i}`, 400)), piece('own18', 0, true)] });
  const snap = holder({ level: 10, gold: 10_000, bank: 5_000, ship: SHIP_TYPES.Large, houses: [[17, 1017, 5], [18, 1018, 6]], scenes: [shipRoom, room17, room18] });
  const ship = shipSellPrice(SHIP_TYPES.Large) + decorSaleBack(shipRoom.decor), h18 = HOUSE + decorSaleBack(room18.decor), h17 = HOUSE;
  assert.deepEqual([ship, h18, h17], [170_400, 91_000, 85_000], 'T3\'s count: what the realm\'s bank would pay for each');
  assert.equal(liquidWealthOf(snap), 10_000 + 5_000 + 30_000 + ship + h18 + h17);
  const r = applyCustoms(snap);
  assert.deepEqual([r.wealth, r.allowance, r.taken, r.crossed], [45_000, 120_000, 0, ['ship', 'house', 'house']], 'crossed, the deeds count at nothing: 45,000 of gold is under 120,000');
  assert.deepEqual([ownsShip(snap), ownsHouse(snap.houses, 18), ownsHouse(snap.houses, 17)], [true, true, true], 'every deed crosses');
  assert.deepEqual([snap.shipCrossed, snap.houses[17].crossed, snap.houses[18].crossed], [true, true, true]);
  assert.deepEqual(room18.decor.map((p) => p.paid), [...Array(30).fill(0), 0], 'every piece stands, the bought ones paying nothing back');
  assert.equal(room18.decor.length, 31);
  assert.deepEqual([room17.lootContainers[0].items.map((i) => i.stackCount), snap.bankAccounts[0].accountGold, snap.goldPieces], [[30_000], 5_000, 10_000], 'and the gold, within the allowance, is untouched');
  assert.deepEqual(customsLines(r), ['Your ship and 2 houses came with you, every piece in them; the realm\'s bank does not buy back what comes through customs.']);
  // online, the realm's bank buys none of it back - and says why; offline, a copy is an offline character's and sells
  assert.equal(sellShip(snap.bankAccounts, 0, snap, { online: true }).kind, 'crossed');
  assert.equal(sellHouse(snap.bankAccounts, snap.houses, 18, { meshRadius: 60, found: true, online: true }).kind, 'crossed');
  assert.equal(snap.bankAccounts[18].accountGold, 0, 'nothing paid');
  assert.deepEqual(crossedDeedLines('house', { houses: snap.houses, regionIndex: 17, online: true }), CROSSED_DEED_LINES);
  assert.deepEqual(crossedDeedLines('ship', { player: snap, online: true }), CROSSED_DEED_LINES);
  assert.equal(crossedDeedLines('house', { houses: snap.houses, regionIndex: 17, online: false }), null);
  assert.equal(sellHouse(snap.bankAccounts, snap.houses, 17, { meshRadius: 78, found: true, online: false }).kind, 'sold', 'offline it sells');
});

test('AUDIT REALM2 T3 / RESTORE: the rich one of the audit - a Large ship and a house in each of the 62 regions, at level one - brings every one of them and can sell none online, where T3 stripped them all and before it the online bank paid 2,805,000; a house bought in the realm after is the buyer\'s own and sells; a room no deed of the character\'s stands for is left alone', () => {
  const stray = room(interiorSceneName(4242, 9), { decor: [piece('q0', 400)] });   // a room of no deed of this character's
  const rich = holder({ level: 1, ship: SHIP_TYPES.Large, houses: Array.from({ length: 62 }, (_, i) => [i, i + 1, 1_000 + i]), scenes: [stray] });
  assert.equal(liquidWealthOf(rich), 170_000 + 62 * HOUSE);
  const c = applyCustoms(rich);
  assert.deepEqual([c.taken, c.crossed.length, c.crossed[0], liquidWealthOf(rich)], [0, 63, 'ship', 0]);
  let paid = sellShip(rich.bankAccounts, 0, rich, { online: true }).price ?? 0;
  for (let i = 0; i < 62; i++) paid += sellHouse(rich.bankAccounts, rich.houses, i, { meshRadius: 39.0625, found: true, online: true }).price ?? 0;
  assert.equal(paid, 0, 'the realm\'s bank buys none of it back');
  assert.deepEqual([ownsShip(rich), rich.houses.every((h) => h.buildingKey > 0)], [true, true]);
  assert.equal(stray.decor[0].paid, 400, 'no deed stands for that room: customs leaves it be');
  assert.equal(customsLines(c)[0], 'Your ship and 62 houses came with you, every piece in them; the realm\'s bank does not buy back what comes through customs.');
  // a house bought in the realm after is the buyer's own - the slot's customs mark goes with the old deed
  const one = holder({ level: 1, houses: [[3, 4, 5]] });
  applyCustoms(one);
  assert.equal(one.houses[3].crossed, true);
  one.houses[3] = { regionIndex: 3, location: '', mapId: 0, buildingKey: 0, crossed: true };   // the old deed gone, its mark left on the slot
  allocateHouseToPlayer(one.houses, 3, { buildingKey: 9, mapId: 8, location: 'Sentinel' });
  assert.equal(one.houses[3].crossed, undefined);
  assert.equal(sellHouse(one.bankAccounts, one.houses, 3, { meshRadius: 50, found: true, online: true }).kind, 'sold');
  // and a character whose deeds are well within the allowance is told they came, and nothing else
  const home = room(interiorSceneName(1017, 5), { decor: Array.from({ length: 20 }, (_, i) => piece(`p${i}`, 400)) });
  const poor = holder({ level: 30, gold: 10_000, ship: SHIP_TYPES.Large, houses: [[17, 1017, 5]], scenes: [home] });
  const p = applyCustoms(poor);
  assert.deepEqual([p.taken, p.crossed, home.decor.length], [0, ['ship', 'house'], 20]);
  assert.deepEqual(customsLines(p), ['Your ship and your house came with you, every piece in them; the realm\'s bank does not buy back what comes through customs.']);
});
