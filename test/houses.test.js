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
//   - quest place.js:439, which skips a house you own when choosing a
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
} from '../src/systems/banking.js';
import {
  receiveHouseDecision, claimHouse, HOUSE_FLAG_MASK, RECEIVE_HOUSE_RANK,
  NO_HOUSE_TEXT_ID, HOUSE_TEXT_ID, ALREADY_GIVEN_HOUSE, armorMaskForRank,
} from '../src/systems/knightlyGifts.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';
import { locationBuildings } from '../src/systems/talkTopics.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { BlocksFile } from '../src/formats/blocksFile.js';
import { layoutLocation } from '../src/world/locationLayout.js';
import { existsSync } from 'node:fs';

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(ARENA2)
  ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
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
    housesForSale: market, ownsHouse: false, rolls: () => 0,
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
  //    purpose: the flag is the order's record, the registry is yours
  assert.deepEqual(receiveHouseDecision(at(9), { ...opts, ownsHouse: true }),
    { kind: 'refuse', result: TRANSACTION_RESULT.ALREADY_OWN_HOUSE });
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
  assert.match(modes, /houseOwned: isHouseOwned\(/, 'CanRest sleeps in a house you own (V5 left this false)');
  assert.match(modes, /isHouseOwned: \(key\) => isHouseOwned\(/, 'the lock ladder knows your own front door');
  assert.match(modes, /ownsHouse: \(\) => ownsHouse\(/, 'the bank window asks the registry');
  assert.match(code('scenes/world.js'), /isHouseOwned: \(buildingKey\) => isHouseOwned\(/,
    'the quest machine skips a house you own when choosing a site');
  assert.match(code('scenes/questBridge.js'), /isHouseOwned: \(buildingKey\)/, 'and the bridge forwards it');
  // the registry has to be MINTED, or every one of them reads an
  // undefined array - createHouses had no caller at all before H1,
  // while the save has round-tripped entity.houses all along.
  assert.match(modes, /playerEntity\.houses \?\?= createHouses\(/);
  assert.match(readFileSync(join(SRC, 'systems/save.js'), 'utf8'), /snap\.houses/, 'the save round-trips the registry');
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
  // it answers the SHORTFALL, not nothing (court.js:199 ports it,
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
  const { BankPurchaseWindow, priceRow, LIST_ROWS } = await import('../src/ui/bankPurchaseWindow.js');
  const market = Array.from({ length: 14 }, (_, i) => ({ buildingKey: i + 1, meshRadius: 10 + i }));
  let bought = null;
  const win = new BankPurchaseWindow({
    houses: () => market,
    buy: (h) => { bought = h; return { result: TRANSACTION_RESULT.PURCHASED_HOUSE, amount: housePrice(h.meshRadius) }; },
    rows: () => [{ text: 'Congratulations.', center: true }],
    onClose: () => {},
  });

  // SelectNone (:298) - nothing is picked when it opens, and BUY on
  // nothing does NOTHING AT ALL, which is DFU's own
  // `if (SelectedIndex < 0) return;` and is why the button feels dead.
  assert.equal(win.selected, -1);
  win.input('Enter');
  assert.equal(bought, null, 'BUY with no selection buys nothing and says nothing');
  assert.equal(win.box, null);

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

  // ...and BUY takes the SELECTED house, not the first
  win.input('Enter');
  assert.equal(bought, market[LIST_ROWS + 1]);
  assert.ok(win.box, 'the result is a message');
  assert.equal(win.box.result, TRANSACTION_RESULT.PURCHASED_HOUSE);
  // a completed purchase closes the market with the box
  win._dismissBox();
  assert.equal(win.done, true);
});

test('AUDIT 26 F138: BUY closes the market whatever it answers (:386)', async () => {
  // BuyButton_OnMouseClick calls CloseWindow() UNCONDITIONALLY, above
  // either GeneratePurchase*Popup - the list is gone on a refusal as
  // much as on a deed, and the result box belongs to the banking
  // window behind it. The port used to close only on PURCHASED_HOUSE,
  // leaving a refused player standing in the market.
  const { BankPurchaseWindow } = await import('../src/ui/bankPurchaseWindow.js');
  const win = new BankPurchaseWindow({
    houses: () => [{ buildingKey: 1, meshRadius: 10 }],
    buy: () => ({ result: TRANSACTION_RESULT.NOT_ENOUGH_GOLD, amount: 999 }),
    rows: () => [{ text: 'You do not have enough gold.', center: true }],
    onClose: () => {},
  });
  win.input('ArrowDown');
  win.input('Enter');
  assert.equal(win.box.result, TRANSACTION_RESULT.NOT_ENOUGH_GOLD, 'the refusal still speaks');
  win._dismissBox();
  assert.equal(win.done, true, 'and it speaks over the BANKING window, not over the list');
});

test('H2: the bank routes BUY HOUSE to the window, and the refusals stay the law\'s', () => {
  const bank = code('ui/bankWindow.js');
  assert.match(bank, /if \(d\.kind === 'refuse'\) \{ this\._popup\(d\.result\); return; \}/,
    'already-own-one and nothing-for-sale still answer through buyHouseDecision');
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
