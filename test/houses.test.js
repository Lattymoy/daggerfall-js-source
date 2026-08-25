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
  MAX_HOUSES_FOR_SALE, TRANSACTION_RESULT,
} from '../src/systems/banking.js';
import {
  receiveHouseDecision, claimHouse, HOUSE_FLAG_MASK, RECEIVE_HOUSE_RANK,
  NO_HOUSE_TEXT_ID, HOUSE_TEXT_ID, ALREADY_GIVEN_HOUSE, armorMaskForRank,
} from '../src/systems/knightlyGifts.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { serviceDestination } from '../src/systems/guildServiceFlow.js';

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
