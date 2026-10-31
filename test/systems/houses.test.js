// H1 - HOUSE OWNERSHIP GOES LIVE, and it is the X4 shape: a missing
// PRODUCER with four ported consumers already waiting on it, every
// one of them shipped stubbed to false.
//
//   - the bank window's BUY/SELL HOUSE buttons (worldModes'
//     `ownsHouse: () => false`, flagged at the site);
//   - CanRest's owned-house arm - V5 wrote "the moment a house can be
//     bought, this is the line that lets you sleep in it" and left it
//     FALSE;
//   - buildingLocks.isHouseOwned, whose contract has named the hook
//     since R1 with nothing able to answer it, so your own front door
//     was locked against you;
//   - quest place.js:"else if (buildingType === BT_ANY_HOUSE)", which skips a house you own when choosing a
//     quest site, and defaulted false - so your own home stayed
//     eligible.
//
// What was missing between them was two things: BuildingDirectory's
// houses-for-sale roll, and DaggerfallBankManager's house registry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createHouses, createBankAccounts, ownsHouse, ownedHouseKey, isHouseOwned,
  allocateHouseToPlayer, sellHouse, housesForSale, houseSellPrice, housePrice,
  MAX_HOUSES_FOR_SALE, TRANSACTION_RESULT, purchaseHouse,
  HOUSES_PER_REGION, regionDeeds, allDeeds, regionHousesFull, regionDeedOf, dropDeed, townDeeds, copyHouseSlot, housesFullText,
} from '../../src/systems/banking.js';
import { HOME_CAP, homeDeedOf } from '../../src/net/homeLaw.js';
import {
  receiveHouseDecision, claimHouse, HOUSE_FLAG_MASK, RECEIVE_HOUSE_RANK,
  NO_HOUSE_TEXT_ID, HOUSE_TEXT_ID, ALREADY_GIVEN_HOUSE, armorMaskForRank,
} from '../../src/systems/knightlyGifts.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { serviceDestination } from '../../src/systems/guild/guildServiceFlow.js';
import { locationBuildings } from '../../src/systems/talk/talkTopics.js';
import { MapsFile } from '../../src/formats/mapsFile.js';
import { BlocksFile } from '../../src/formats/blocksFile.js';
import { layoutLocation } from '../../src/world/locationLayout.js';
import { existsSync } from 'node:fs';
import { hostText } from '../hostText.mjs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
const code = (p) => readFileSync(join(SRC, p), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

const house = (type, key) => ({ buildingType: type, buildingKey: key });
const town = (n = 100) => [
  house(BUILDING_TYPES.HouseForSale, 1),
  ...Array.from({ length: n - 1 }, (_, i) => house(BUILDING_TYPES.House1 + (i % 4), i + 10)),
];

test('H1: the registry is keyed by REGION, and that is verbatim', () => {
  // :140-148. One house per region; a house in Daggerfall reads as
  // unowned while you stand in Wayrest. Every consumer is asking about
  // the building in front of them, so the region is always the one
  // they mean.
  const houses = createHouses(4);
  assert.equal(ownsHouse(houses, 1), false);
  assert.equal(ownedHouseKey(houses, 1), 0);
  allocateHouseToPlayer(houses, 1, { buildingKey: 4242, mapId: 99, location: 'Burgley' });
  assert.equal(ownsHouse(houses, 1), true);
  assert.equal(isHouseOwned(houses, 1, 4242), true);
  assert.equal(isHouseOwned(houses, 2, 4242), false, 'another region does not know your house');
  assert.equal(isHouseOwned(houses, 1, 9999), false, 'a different building in the same region');
  // :142 - key 0 means "no building", and answers false before any lookup
  assert.equal(isHouseOwned(houses, 1, 0), false);
});

test('HOUSES-3 (the owner: "Up the house ownership limit to 3 houses per region"): a region holds THREE deeds - the slot its first, the others beside it (`more`), a fourth refused; any of them is the region\'s house to every reader; a sale takes the deed sold and the next stands in the slot; a purchase with no room takes no gold; a save\'s copy shares nothing (mutants: the number; the slot overwritten; a fourth kept; only the first read; the promotion; the guard; the copy shallow)', () => {
  assert.equal(HOUSES_PER_REGION, 3);
  assert.equal(HOUSES_PER_REGION, HOME_CAP, 'the online homes\' own number');
  const houses = createHouses(4);
  const put = (key, mapId = 12) => allocateHouseToPlayer(houses, 1, { buildingKey: key, mapId, location: 'Burgley' });
  assert.equal(regionHousesFull(houses, 1), false);
  const a = put(10), b = put(20), c = put(30, 13);
  assert.equal(houses[1], a, 'the first in the slot');
  assert.deepEqual(houses[1].more, [b, c], 'the others beside it');
  assert.deepEqual(b, { regionIndex: 1, location: 'Burgley', mapId: 12, buildingKey: 20 });
  assert.deepEqual(regionDeeds(houses, 1).map((d) => d.buildingKey), [10, 20, 30]);
  assert.equal(regionHousesFull(houses, 1), true);
  assert.equal(put(40), null, 'no fourth');
  assert.deepEqual(regionDeeds(houses, 1).map((d) => d.buildingKey), [10, 20, 30]);
  assert.equal(regionDeeds(houses, 2).length, 0, 'another region its own three');
  assert.equal(ownsHouse(houses, 1), true);
  for (const key of [10, 20, 30]) assert.equal(isHouseOwned(houses, 1, key), true, `${key} owned`);
  assert.equal(isHouseOwned(houses, 2, 20), false);
  assert.equal(regionDeedOf(houses, 1, 13, 30), c);
  assert.equal(regionDeedOf(houses, 1, 12, 30), null, 'its own town');
  assert.equal(homeDeedOf(houses, 1, 12, 20), b, 'the service\'s hold reads the ones beside the slot too');
  assert.deepEqual(allDeeds(houses).map((d) => d.buildingKey), [10, 20, 30]);
  // the copy a save takes shares no record
  const copy = copyHouseSlot(houses[1]);
  copy.more[0].buildingKey = 99;
  assert.equal(b.buildingKey, 20);
  // a sale takes the deed sold; the slot's own sold, the next stands in it
  const accounts = createBankAccounts(4);
  assert.equal(sellHouse(accounts, houses, 1, { meshRadius: 10, online: false, deed: b }).kind, 'sold');
  assert.deepEqual(regionDeeds(houses, 1).map((d) => d.buildingKey), [10, 30]);
  assert.equal(sellHouse(accounts, houses, 1, { meshRadius: 10, online: false }).kind, 'sold', 'no deed named: the first');
  assert.deepEqual(houses[1], { regionIndex: 1, location: 'Burgley', mapId: 13, buildingKey: 30 }, 'the next in the slot, nothing beside it');
  assert.equal(sellHouse(accounts, houses, 1, { meshRadius: 10, online: false, deed: { ...houses[1] } }).kind, 'none', 'a deed not the region\'s sells nothing');
  dropDeed(houses, 1, houses[1]);
  assert.deepEqual(houses[1], { regionIndex: 1, location: '', mapId: 0, buildingKey: 0 });
  // a purchase in a full region takes no gold
  for (const key of [1, 2, 3]) put(key);
  let paid = 0;
  const player = { gold: () => 1e9, deductGold: (n) => { paid += n; return 0; } };
  assert.deepEqual(purchaseHouse(accounts, houses, 1, { buildingKey: 4 }, player, { meshRadius: 10, online: false }), { result: TRANSACTION_RESULT.NONE });
  assert.equal(paid, 0);
  assert.match(housesFullText(), /3 houses in this region/);
  // the bank's town: the deeds held there that its directory resolves, the first first
  const dir = { mapId: 12, buildings: [{ buildingKey: 3 }, { buildingKey: 1 }] };
  assert.deepEqual(townDeeds(houses, 1, dir).map((o) => [o.deed.buildingKey, o.summary.buildingKey]), [[1, 1], [3, 3]]);
  assert.deepEqual(townDeeds(houses, 1, { mapId: 12, buildings: [] }), [], 'no directory, nothing offered');
});

test('H1: allocation is four things, and three of them are what make it a HOME', () => {
  // AllocateHouseToPlayer (:429-448). Writing the slot is the easy
  // quarter. The building is DISCOVERED under the player's own name,
  // its interior joins the PERMANENT scenes so what you leave there
  // survives the world moving on, and a deed goes in the notebook.
  const houses = createHouses(2);
  const seen = { discovered: null, permanent: null, note: null };
  allocateHouseToPlayer(houses, 0, { buildingKey: 7, mapId: 12, location: 'Tulune' }, {
    playerName: 'MAC', regionName: 'Daggerfall',
    discoverBuilding: (key, name) => { seen.discovered = [key, name]; },
    addPermanentScene: (mapId, key) => { seen.permanent = [mapId, key]; },
    addNote: (text) => { seen.note = text; },
  });
  assert.deepEqual(seen.discovered, [7, "MAC's residence"]);
  assert.deepEqual(seen.permanent, [12, 7]);
  assert.match(seen.note, /Tulune/);
  assert.match(seen.note, /Daggerfall/);
  // ...and the slot itself remembers where, which is what the save keeps
  assert.deepEqual(houses[0], { regionIndex: 0, location: 'Tulune', mapId: 12, buildingKey: 7 });
});

test('H1: selling pays the ACCOUNT, not the purse, and undoes all three', () => {
  // SellHouse (:450-465) credits the bank account - a deed is not
  // pocket money - and the slot resets to a fresh record that still
  // remembers its own region.
  const houses = createHouses(2);
  const accounts = createBankAccounts(2);
  allocateHouseToPlayer(houses, 0, { buildingKey: 7, mapId: 12, location: 'Tulune' });
  const undone = { permanent: null, undiscovered: null };
  const r = sellHouse(accounts, houses, 0, { meshRadius: 10 }, {
    removePermanentScene: (mapId, key) => { undone.permanent = [mapId, key]; },
    undiscoverBuilding: (key) => { undone.undiscovered = key; },
  });
  assert.equal(r.kind, 'sold');
  assert.equal(r.price, houseSellPrice(10));
  assert.equal(accounts[0].accountGold, houseSellPrice(10), 'the ACCOUNT, not the purse');
  assert.deepEqual(undone.permanent, [12, 7]);
  assert.equal(undone.undiscovered, 7);
  assert.deepEqual(houses[0], { regionIndex: 0, location: '', mapId: 0, buildingKey: 0 });
  assert.equal(sellHouse(accounts, houses, 0, {}, {}).kind, 'none', 'selling nothing does nothing');
  // and the price is 85% of the buy price, both truncated
  assert.equal(houseSellPrice(10), Math.trunc(housePrice(10) * 0.85));
});

test('H1: houses for sale - every HouseForSale, topped up from residences to the cap', () => {
  // GetHousesForSale (:156-184). maxForSale = min(buildings/10, 20).
  const t = town(100);
  const list = housesForSale(t, { mapId: 99, month: 3 });
  assert.equal(list.length, 10, 'min(100/10, 20)');
  assert.ok(list.some((b) => b.buildingKey === 1), 'the outright HouseForSale is always on it');
  for (const b of list) {
    assert.ok(b.buildingType === BUILDING_TYPES.HouseForSale
      || (b.buildingType >= BUILDING_TYPES.House1 && b.buildingType <= BUILDING_TYPES.House4),
    'only HouseForSale and House1-4 are ever offered');
  }
  // the 20 ceiling, not buildings/10, on a big city
  assert.equal(housesForSale(town(500), { mapId: 1, month: 0 }).length, MAX_HOUSES_FOR_SALE);
  // a hamlet with nine buildings offers only what is outright for sale
  assert.equal(housesForSale(town(9), { mapId: 1, month: 0 }).length, 1);

  // an active quest site is not for sale (:169, residencesOnly)
  const questy = housesForSale(t, { mapId: 99, month: 3, isActiveQuestBuilding: () => true });
  assert.deepEqual(questy.map((b) => b.buildingKey), [1], 'only the outright one survives');
});

test('H1: the list is stable within a month and turns over between them - THE DEPARTURE', () => {
  // DFU seeds with `buildingDict.GetHashCode() + Now.Month`, and
  // GetHashCode() on a Dictionary is the CLR's object-identity hash -
  // a different number every process run. So DFU's own `+ Month`,
  // which plainly means "the same houses are for sale all month", is
  // defeated by the term it is added to and the list reshuffles on
  // every load. A JS port cannot reproduce a CLR identity hash and
  // should not want to; the seed here is the LOCATION and the month,
  // which is what that expression was reaching for. Ledger A.
  const t = town(100);
  const a = housesForSale(t, { mapId: 99, month: 3 }).map((b) => b.buildingKey);
  const b = housesForSale(t, { mapId: 99, month: 3 }).map((x) => x.buildingKey);
  assert.deepEqual(a, b, 'the same town in the same month offers the same houses');
  const next = housesForSale(t, { mapId: 99, month: 4 }).map((x) => x.buildingKey);
  assert.notDeepEqual(a, next, 'and a new month turns the market over');
  const elsewhere = housesForSale(t, { mapId: 1234, month: 3 }).map((x) => x.buildingKey);
  assert.notDeepEqual(a, elsewhere, 'a different town rolls differently in the same month');
});

test('H1: ReceiveHouse - four refusals in order, then a grant', () => {
  // KnightlyOrder.ReceiveHouse (:222-252).
  const at = (rank, flags = 0) => ({ guild: 'Order:Dragon', rank, flags });
  const market = town(100).slice(0, 3);
  const opts = {
    housesForSale: market, housesFull: false, rolls: () => 0,
    alreadyOwnResult: TRANSACTION_RESULT.ALREADY_OWN_HOUSE,
    noneForSaleResult: TRANSACTION_RESULT.NO_HOUSES_FOR_SALE,
  };
  // 1. rank
  assert.deepEqual(receiveHouseDecision(at(8), opts), { kind: 'refuse', textId: NO_HOUSE_TEXT_ID });
  assert.equal(RECEIVE_HOUSE_RANK, 9);
  // 2. this ORDER has already made its gift
  assert.deepEqual(receiveHouseDecision(at(9, HOUSE_FLAG_MASK), opts),
    { kind: 'refuse', line: ALREADY_GIVEN_HOUSE });
  // 3. you already own one FROM ANY SOURCE - a different refusal on
  //    purpose: the flag is the order's record, the registry is yours.
  //    PIN MOVED (HOUSES-3): the region's THREE, in the bank's words counted to three
  assert.deepEqual(receiveHouseDecision(at(9), { ...opts, housesFull: true }),
    { kind: 'refuse', result: TRANSACTION_RESULT.ALREADY_OWN_HOUSE, line: housesFullText() });
  // 4. nothing on the market
  assert.deepEqual(receiveHouseDecision(at(9), { ...opts, housesForSale: [] }),
    { kind: 'refuse', result: TRANSACTION_RESULT.NO_HOUSES_FOR_SALE });
  // ...and the grant
  const g = receiveHouseDecision(at(9), opts);
  assert.equal(g.kind, 'grant');
  assert.equal(g.textId, HOUSE_TEXT_ID);
  assert.equal(g.mask, HOUSE_FLAG_MASK);
  assert.ok(market.includes(g.house), 'it picks one of the houses actually for sale');
  // uniformly (:242) - not the cheapest, not the first
  assert.equal(receiveHouseDecision(at(9), { ...opts, rolls: () => 0.99 }).house, market[2]);
});

test('H1: the house flag is its OWN bit, and never collides with an armour rank', () => {
  // HouseFlagMask 2, ArmorFlagStart 4 - the house is once per order
  // for ever, where the armour re-opens at every new rank.
  const m = { guild: 'Order:Dragon', rank: 9, flags: 0 };
  claimHouse(m);
  assert.equal(m.flags, HOUSE_FLAG_MASK);
  for (let rank = 0; rank <= 9; rank++) {
    assert.equal(armorMaskForRank(rank) & HOUSE_FLAG_MASK, 0, `rank ${rank}'s armour bit is not the house's`);
  }
  claimHouse(m);
  assert.equal(m.flags, HOUSE_FLAG_MASK, 'claiming twice sets the same bit');
});

test('H1: the four consumers are wired, and each goes through the law', () => {
  // The point of the lane. A rule per consumer, because three of the
  // four are host code with no node coverage.
  const modes = code('scenes/worldModes.js');
  // PIN MOVED (AUDIT CAPTAIN'S SEA P9): the deed read where the building stands - never an isle town's (houseOwnedAt) - the law itself, once
  // PIN MOVED (BAY-LEFT-B): an Arena town's and a country place's again - each held to its own town (banking.js deedHeldIn)
  assert.match(modes, /const houseOwnedAt = \(b, key\) => !isEtherPlaceId\(homeTownOf\(b\)\) && isHouseOwned\(playerEntity\.houses \?\? \[\], b\?\.regionIndex \?\? 0, key, homeTownOf\(b\)\);/, 'the one reading of the law');   // PIN MOVED (TESA2): nor an Arena town's; PIN MOVED (TESA7): nor a country place's; PIN MOVED (AUDIT RELEASE R2-9): the town asking named - a capital's slice's deed its own slice's
  assert.match(modes, /houseOwned: !interiorHome && houseOwnedAt\(b, b\?\.buildingKey \?\? 0\), homeBed: homeBedIsMine\(interiorHome, /, 'CanRest sleeps in a house you own (V5 left this false)');   // HOME1 re-aim: online, in my online home too; HOME-RENT re-aim: and a room I rent in one; PIN MOVED (FIELD BUGS 2026-10-01 RENT-REST): an online home's bed rides as `homeBed`, the offline house as ever
  assert.match(modes, /isHouseOwned: \(key\) => houseOwnedAt\(bd, key\),/, 'the lock ladder knows your own front door');
  assert.match(modes, /ownsHouse: \(\) => ownsHouse\(/, 'the bank window asks the registry');
  assert.match(hostText('src/scenes/world.js'), /isHouseOwned: \(buildingKey\) => isHouseOwned\(/,   // PIN MOVED (TESA's merge): the quest world is scenes/questWorld.js's - the host read whole
    'the quest machine skips a house you own when choosing a site');
  // AUDIT 68 S22: ...and ONLY there - place.js reads `world.isHouseOwned`; the bridge's ctx forward reached a
  // QuestMachine dep nothing reads, keyed by a different region, so an edit to it changed nothing
  assert.doesNotMatch(code('scenes/quest/questBridge.js'), /isHouseOwned/, 'the bridge forwards no second, dead door');
  // the registry has to be MINTED, or every one of them reads an
  // undefined array - createHouses had no caller at all before H1,
  // while the save has round-tripped entity.houses all along.
  assert.match(modes, /playerEntity\.houses \?\?= createHouses\(/);
  assert.match(readFileSync(join(SRC, 'systems/save/save.js'), 'utf8'), /snap\.houses/, 'the save round-trips the registry');
  // and ReceiveHouse is a destination now
  assert.equal(serviceDestination('ReceiveHouse'), 'guildServiceReceiveHouse');
});

test('H1 DEFECT: a house on the market must carry its KEY - on REAL data', { skip: skipReal }, () => {
  // THE BUG THIS TEST EXISTS FOR, and it was mine, shipped an hour
  // before it was found. H1's roll read `location.exterior.buildings`
  // - the raw DFLocation.BuildingData array, whose records carry
  // nameSeed/factionId/quality/buildingType and NO buildingKey. So
  // every house it offered had `buildingKey: undefined`,
  // allocateHouseToPlayer wrote that into the registry, and ownsHouse
  // tests `> 0`: the house a knight was just given was not theirs, and
  // nothing above noticed because every fixture in this file sets the
  // key BY HAND. A synthetic fixture cannot catch a missing field that
  // the fixture itself supplies - so this one runs on the shipped
  // MAPS.BSA and BLOCKS.BSA and asks the question of real records.
  const maps = new MapsFile();
  maps.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))),
  );
  const blocksFile = new BlocksFile();
  blocksFile.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));

  for (const name of ['Daggerfall', 'Burgley']) {
    const loc = maps.getLocationByName('Daggerfall', name);
    assert.ok(loc, `${name} is in the shipped data`);
    const laid = layoutLocation(loc, maps, blocksFile);
    const all = locationBuildings(loc.exterior?.buildings ?? [], laid.blocks);
    assert.ok(all.length > 0, `${name} has buildings`);

    // THE RAW ARRAY HAS NO KEYS - the thing H1 read.
    assert.equal((loc.exterior?.buildings ?? []).some((b) => b.buildingKey !== undefined), false,
      'DFLocation.BuildingData carries no buildingKey; that is why the roll needs the correlation');

    // ...and the correlated list does, on every single record.
    for (const b of all) {
      assert.equal(typeof b.buildingKey, 'number', `${name}: every building has a numeric key`);
      assert.ok(b.buildingKey > 0, `${name}: and it is > 0, which is what ownsHouse tests`);
    }
    // keys are unique within a location, or two houses are one house
    assert.equal(new Set(all.map((b) => b.buildingKey)).size, all.length, `${name}: keys are unique`);

    // and the roll over the REAL list hands back real keys
    for (const h of housesForSale(all, { mapId: loc.mapTableData?.mapId ?? 0, month: 3 })) {
      assert.ok(h.buildingKey > 0, `${name}: a house on the market has a usable key`);
      const houses = createHouses(2);
      allocateHouseToPlayer(houses, 0, { buildingKey: h.buildingKey, mapId: 1, location: name });
      assert.equal(ownsHouse(houses, 0), true, `${name}: and allocating it actually makes it yours`);
    }
  }
});

// ---- H2: the purchase window ----

test('H2: PurchaseHouse spends the purse FIRST and the account for the rest', () => {
  // :408-427, and the mechanism is DeductGoldAmount's return value:
  // it answers the SHORTFALL, not nothing (court.js:"PlayerEntity.cs:2294-2298" ports it,
  // letters of credit and all). So `accountGold -= deductGold(amount)`
  // subtracts exactly the remainder, and subtracts ZERO when the purse
  // covered it. Written any other way this double-charges, or lets the
  // account pay for a purchase the purse already made.
  const purse = (start) => {
    let g = start;
    return { gold: () => g, deductGold: (n) => { const take = Math.min(g, n); g -= take; return n - take; } };
  };
  const buy = (start, account, radius) => {
    const houses = createHouses(2);
    const accounts = createBankAccounts(2);
    accounts[0].accountGold = account;
    const p = purse(start);
    const r = purchaseHouse(accounts, houses, 0, { buildingKey: 5 }, p,
      { meshRadius: radius, mapId: 1, location: 'Burgley' });
    return { r, purse: p.gold(), account: accounts[0].accountGold, owns: ownsHouse(houses, 0) };
  };
  const price = housePrice(50);

  const rich = buy(price + 1000, 5000, 50);
  assert.equal(rich.r.result, TRANSACTION_RESULT.PURCHASED_HOUSE);
  assert.equal(rich.purse, 1000, 'the purse paid all of it');
  assert.equal(rich.account, 5000, 'and the account was not touched');
  assert.equal(rich.owns, true);

  const topUp = buy(1000, price, 50);
  assert.equal(topUp.r.result, TRANSACTION_RESULT.PURCHASED_HOUSE);
  assert.equal(topUp.purse, 0, 'the purse went first, to the last coin');
  assert.equal(topUp.account, price - (price - 1000), 'and the account covered exactly the remainder');
  assert.equal(topUp.owns, true);

  const broke = buy(10, 10, 50);
  assert.equal(broke.r.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD);
  assert.equal(broke.purse, 10, 'a refused purchase spends NOTHING');
  assert.equal(broke.account, 10);
  assert.equal(broke.owns, false);

  // :410-411 - key 0 is "no building", answered before anything moves
  const none = buy(1e6, 1e6, 50);
  assert.equal(none.r.result, TRANSACTION_RESULT.PURCHASED_HOUSE);
  const zero = createHouses(2);
  assert.equal(purchaseHouse(createBankAccounts(2), zero, 0, { buildingKey: 0 }, purse(1e6),
    { meshRadius: 50 }).result, TRANSACTION_RESULT.NONE);
  assert.equal(ownsHouse(zero, 0), false);
});

test('H2: the window lists, scrolls, selects and buys', async () => {
  const { BankPurchaseWindow, priceRow, LIST_ROWS } = await import('../../src/ui/bankPurchaseWindow.js');
  const market = Array.from({ length: 14 }, (_, i) => ({ buildingKey: i + 1, meshRadius: 10 + i }));
  let bought = null;
  let shown = null;
  const win = new BankPurchaseWindow({
    houses: () => market,
    buy: (h) => { bought = h; return { result: TRANSACTION_RESULT.PURCHASED_HOUSE, amount: housePrice(h.meshRadius) }; },
    showResult: (result, amount) => { shown = { result, amount }; },
    onClose: () => {},
  });

  // SelectNone (:298) - nothing is picked when it opens, and BUY on
  // nothing does NOTHING AT ALL, which is DFU's own
  // `if (SelectedIndex < 0) return;` and is why the button feels dead.
  assert.equal(win.selected, -1);
  win.input('Enter');
  assert.equal(bought, null, 'BUY with no selection buys nothing and says nothing');
  assert.equal(win.done, false, 'and the list stays open - the guard is BEFORE CloseWindow');

  // ten rows displayed, the price row verbatim
  assert.equal(win.rows().length, LIST_ROWS);
  assert.equal(win.rows()[0].text, priceRow(housePrice(10)));

  // scrolling stops where the list does
  assert.equal(win.canScrollUp(), false);
  assert.equal(win.canScrollDown(), true);
  for (let i = 0; i < 20; i++) win.wheel(1);
  assert.equal(win.scroll, market.length - LIST_ROWS, 'the last full page, and no further');
  assert.equal(win.canScrollDown(), false);
  for (let i = 0; i < 20; i++) win.wheel(-1);
  assert.equal(win.scroll, 0);

  // the keyboard walk drags the view with the selection
  for (let i = 0; i < LIST_ROWS + 2; i++) win.input('ArrowDown');
  assert.equal(win.selected, LIST_ROWS + 1);
  assert.ok(win.selected >= win.scroll && win.selected < win.scroll + LIST_ROWS, 'the pick stays on screen');

  // ...and BUY takes the SELECTED house, not the first. AUDIT 26
  // F138: CloseWindow() runs BEFORE the outcome is known (:386), so
  // the list is ALREADY closed and the result box is the banking
  // window's own GeneratePopup, through the showResult hook.
  win.input('Enter');
  assert.equal(bought, market[LIST_ROWS + 1]);
  assert.equal(win.done, true, 'the list closed at buy time, not at box-dismiss');
  assert.equal(shown.result, TRANSACTION_RESULT.PURCHASED_HOUSE);
  // AUDIT 64 F25: and the amount GeneratePopup is given is ZERO, not
  // the price - GeneratePurchaseHousePopup (DaggerfallBankingWindow
  // .cs:234-237) passes GeneratePopup only the result, and its
  // `amount` parameter defaults to 0 (:297). It matters now that the
  // window really runs a %a macro pass over the box.
  assert.equal(shown.amount, 0);
});

test('H2: a refused purchase closes the list too - the message shows over the BANK (F138)', async () => {
  // BuyButton_OnMouseClick (:386-390) closes the purchase popup on
  // EVERY outcome; "stay in the market on a refusal" was never DFU's
  // law - the old pin here had encoded the port's invention.
  const { BankPurchaseWindow } = await import('../../src/ui/bankPurchaseWindow.js');
  let shown = null;
  const win = new BankPurchaseWindow({
    houses: () => [{ buildingKey: 1, meshRadius: 10 }],
    buy: () => ({ result: TRANSACTION_RESULT.NOT_ENOUGH_GOLD, amount: 999 }),
    showResult: (result, amount) => { shown = { result, amount }; },
    onClose: () => {},
  });
  win.input('ArrowDown');
  win.input('Enter');
  assert.equal(win.done, true, 'refusal or not, the list is gone');
  assert.equal(shown.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD);
});

test('H2: the bank routes BUY HOUSE to the window, and the refusals stay the law\'s', () => {
  const bank = code('ui/bankWindow.js');
  // PIN MOVED (HOUSES-3): the region's three answered in the bank's words counted to three (`lines`), nothing for sale DFU's
  assert.match(bank, /if \(d\.kind === 'refuse'\) \{\n\s*if \(d\.lines\) this\._lines\(d\.lines\);\n\s*else this\._popup\(d\.result\);\n\s*return;\n\s*\}/,
    'the region\'s three and nothing-for-sale still answer through buyHouseDecision');
  assert.match(bank, /this\.hooks\.openPurchase\?\.\(\)/, 'and a pick opens the purchase window');
  // the host mounts it, restoring the bank when it closes (PushWindow/PopWindow)
  const modes = code('scenes/worldModes.js');
  assert.match(modes, /new BankPurchaseWindow\(\{/);
  assert.match(modes, /onClose: \(\) => \{ if \(interiorOverlay === pw\) interiorOverlay = win; \}/,
    'closing the market returns to the teller, not to the room');
  // and the price comes from the model, not a guess
  assert.match(modes, /function houseMeshRadius\(building\)/);
  assert.match(modes, /arch\.getMesh\(rec\)\?\.radius/);
});

test('H2: a house on the real market resolves a model and a price', { skip: skipReal }, () => {
  // GetHousePrice reads the building's own mesh radius, so the model
  // has to be reachable from the building record. RMBLayout.cs:577 -
  // BuildingSummary.ModelID is the FIRST 3D object of the building's
  // subrecord - and locationBuildings carries it now.
  const maps = new MapsFile();
  maps.load(
    new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))),
    new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))),
    new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))),
  );
  const blocksFile = new BlocksFile();
  blocksFile.load(new Uint8Array(readFileSync(join(ARENA2, 'BLOCKS.BSA'))));
  const loc = maps.getLocationByName('Daggerfall', 'Burgley');
  const all = locationBuildings(loc.exterior?.buildings ?? [], layoutLocation(loc, maps, blocksFile).blocks);
  assert.ok(all.length > 0);
  for (const b of all) {
    assert.equal(typeof b.modelIdNum, 'number', 'every building resolves its own model');
    assert.ok(b.modelIdNum > 0);
  }
});
