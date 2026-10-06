// HOME-PRICE (2026-10-04; asked: "We need to make house pricing make sense online"; offered three ways, the choice was to
// price a house "by what you get (its footprint, scaled by town size) inside a fixed range the server enforces", and the
// sale box to say what the sale really pays, the Empire's account named, every sum with its thousands). Online a door
// asked Daggerfall's price - the model's bounding RADIUS x 1280 - which ran from a few thousand to over 800,000 (a
// hall's door asked 1,274,880 - FIELD BUGS 2026-10-03 HALL-GOLD), and any number the client named was taken by the
// service up to ten million. The law (net/homeLaw.js homeOnlinePrice), the service's range and its `refund`, the
// client's registry, the door's host and the words. `06-Systems/Economy-Arc.md` HOME-PRICE.
// AUDIT HOME-PRICE (`01-Overview/Audit-HomePrice.md`): the hundreds the service holds (L2), the sale's sum told only to
// the character whose door can sell it (L3), the claim's answer saying it (C2), the rent held on it (C3), the door's chain
// run over a model rather than read (D5), a knightly order's deed bought back online at the online price (C1), and the
// rent's words beside the home's (E4) - with the pins the audit's own mutants survived (D1-D4, D6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import {
  HOME_PRICE_PER_M2, HOME_PRICE_MIN, HOME_PRICE_MAX, HOME_PRICE_STEP, HOME_TOWN_BLOCKS_MAX,
  homeTownFactor, homeOnlinePrice, homePriceOk, homeSaleRefund,
} from '../src/net/homeLaw.js';
import {
  homeTownBlocks, homeFootprintM2, homeSaleOffer, homeRefund, createOnlineHomes,
  homeForSaleLine, homeOfferLines, homeShortLine, homeSaleLines, homeSoldLine, homeBuyRows, homeHallBuyRow, hallOfferLabel,
} from '../src/systems/onlineHomes.js';
import { goldSum, accountWords, EMPIRE_ACCOUNT_WORDS, REGION_ACCOUNT_WORDS } from '../src/systems/homeWords.js';
import { rentRowLabel, rentPickLines, rentDaysLines, rentConfirmLines, rentShortLine } from '../src/systems/homeRent.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { createBankAccounts, createHouses, sellHouse, houseSellPrice, EMPIRE_ACCOUNT_REGION } from '../src/systems/banking.js';
import { EXT_NUM_MAX_BLOCKS } from '../src/ui/automapCamera.js';
import { accountRefusalText } from '../src/net/accountClient.js';
import { GLOBAL_SCALE } from '../src/world/meshReader.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const RICH = (name) => ({ name, level: 9, goldPieces: 2_000_000, items: [], bankAccounts: new Array(62).fill(0).map(() => ({ accountGold: 0 })) });
/** The gold a realm character's record holds now - its purse and every bank account. */
const recordGold = async (env, id) => {
  const row = env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id);
  const save = JSON.parse(await (await env.SAVES.get(row.obj)).text());
  return (save.goldPieces ?? 0) + (save.bankAccounts ?? []).reduce((s, a) => s + (a?.accountGold ?? 0), 0);
};
/** Lift a closure out of a host's source, as AUDIT 68 lifts world.js's. */
function lift(text, from, to) {
  const i = text.indexOf(from);
  assert.ok(i >= 0, `lift: ${from.slice(0, 60)} is gone`);
  const j = text.indexOf(to, i);
  assert.ok(j > i, `lift: no ${JSON.stringify(to)} after ${from.slice(0, 60)}`);
  return text.slice(i, j + to.length);
}

test('HOME-PRICE the law: 300 gold a square metre of ground, raised by the town\'s side (1 at one block, 2.75 at 8 x 8), to the nearest hundred, never under 5,000 nor over 250,000; a building nobody can measure is not for sale; the service takes whole hundreds in the range alone (mutants: the rate; the town factor; the floor; the cap; the rounding up or down; an unmeasured house priced; the hundreds unread)', () => {
  assert.deepEqual([HOME_PRICE_PER_M2, HOME_PRICE_MIN, HOME_PRICE_MAX, HOME_PRICE_STEP, HOME_TOWN_BLOCKS_MAX], [300, 5_000, 250_000, 100, 64]);
  assert.equal(HOME_TOWN_BLOCKS_MAX, EXT_NUM_MAX_BLOCKS * EXT_NUM_MAX_BLOCKS, 'the widest town is the automap\'s 8 x 8');
  assert.deepEqual([1, 4, 9, 25, 64].map(homeTownFactor), [1, 1.25, 1.5, 2, 2.75], 'the town\'s side: 1x1, 2x2, 3x3, 5x5, 8x8');
  assert.deepEqual([0, -3, NaN, undefined, 100].map(homeTownFactor), [1, 1, 1, 1, 2.75], 'an unknown size is one block; none past 8 x 8');
  // what a house costs, by its ground and its town
  assert.deepEqual([
    homeOnlinePrice(36, 1),     // a 6 x 6 m cottage in a hamlet
    homeOnlinePrice(100, 9),    // a 10 x 10 m house in a 3 x 3 town
    homeOnlinePrice(144, 64),   // a 12 x 12 m house in an 8 x 8 city
    homeOnlinePrice(53.29, 1),  // 7.3 x 7.3 m: 15,987 - up to the nearest hundred
    homeOnlinePrice(36.1, 1),   // AUDIT HOME-PRICE D1: 10,830 - down to the nearest hundred (a ceiling would say 10,900)
    homeOnlinePrice(4, 64),     // a shed: the floor
    homeOnlinePrice(1600, 64),  // a 40 x 40 m palace: the cap
  ], [10_800, 45_000, 118_800, 16_000, 10_800, HOME_PRICE_MIN, HOME_PRICE_MAX]);
  assert.deepEqual([homeOnlinePrice(0, 9), homeOnlinePrice(-5, 9), homeOnlinePrice(NaN, 9), homeOnlinePrice(Infinity, 9)], [0, 0, 0, 0], 'nobody can measure it: not for sale');
  // what you get: more ground never costs less, a bigger town never less
  for (let m2 = 10; m2 < 2000; m2 += 7) assert.ok(homeOnlinePrice(m2 + 7, 9) >= homeOnlinePrice(m2, 9));
  for (let b = 1; b < 64; b++) assert.ok(homeOnlinePrice(150, b + 1) >= homeOnlinePrice(150, b));
  // every price the law makes is one the service takes - and AUDIT HOME-PRICE L2: the service takes whole hundreds alone
  for (let m2 = 1; m2 < 3000; m2 += 13) for (const b of [1, 6, 30, 64]) { const p = homeOnlinePrice(m2, b); assert.ok(homePriceOk(p) && p % HOME_PRICE_STEP === 0, `${m2} m2 in ${b} blocks: ${p}`); }
  assert.deepEqual([homePriceOk(5_100), homePriceOk(5_050), homePriceOk(124_544), homePriceOk(249_999)], [true, false, false, false], 'off the hundreds: Daggerfall\'s radius x 1280, a build from before');
});

test('HOME-PRICE the measures: the ground is the model\'s box, width by depth, at the renderer\'s metres a unit; a town\'s size is its exterior\'s width by height (mutants: the height read for the depth; the scale once; the town\'s width alone)', () => {
  assert.equal(GLOBAL_SCALE, 0.025);
  assert.equal(homeFootprintM2({ x: 400, y: 9999, z: 480 }, GLOBAL_SCALE), 120, '10 m by 12 m - the height is no ground');
  assert.deepEqual([homeFootprintM2(null, GLOBAL_SCALE), homeFootprintM2({ x: 0, y: 1, z: 400 }, GLOBAL_SCALE), homeFootprintM2({ x: NaN, z: 1 }, GLOBAL_SCALE)], [0, 0, 0]);
  assert.equal(homeTownBlocks({ exterior: { exteriorData: { width: 3, height: 4 } } }), 12);
  assert.deepEqual([homeTownBlocks(null), homeTownBlocks({ exterior: {} }), homeTownBlocks({ exterior: { exteriorData: { width: 0, height: 4 } } })], [0, 0, 0]);
});

test('HOME-PRICE the service holds the range: a claim at Daggerfall\'s price (a build from before) is asked to update - outside the range or off its hundreds - one under the floor too, and nothing is seated or paid; one inside it lands; a price that is no number is no building; a hall the same (mutants: the range unread; the floor; the hundreds; the update unsaid; the hall\'s guard)', async () => {
  const s = await standService();
  const who = await s.registered('Aldric');
  const R = await seatRealm(s.env, who.secret, 'Aldric', RICH('Aldric'));
  const claim = (buildingKey, price) => s.call('/v1/homes/claim', { mapId: 77, buildingKey, region: 17, character: R.id, price, realm: R.at(), layout: null }, who.secret);
  const before = await recordGold(s.env, R.id);
  for (const [key, price] of [[3, 600_100], [4, HOME_PRICE_MAX + HOME_PRICE_STEP], [5, HOME_PRICE_MIN - HOME_PRICE_STEP], [6, 1], [9, 124_544]]) {
    const r = await claim(key, price);
    assert.deepEqual([r.status, r.body?.error], [426, 'home-update'], `${price}: asked to update`);
    assert.equal(s.env.DB._raw.prepare('SELECT 1 FROM homes WHERE building_key = ?').get(key), undefined, `${price}: nothing seated`);
  }
  assert.equal(await recordGold(s.env, R.id), before, 'and nothing paid');
  assert.equal(accountRefusalText('home-update'), 'This game is out of date. Reload it to buy a home.');
  assert.deepEqual([(await claim(7, 0)).body?.error, (await claim(7, 2.5)).body?.error, (await claim(7, '42000')).body?.error], ['bad-home', 'bad-home', 'bad-home']);
  const ok = await claim(8, HOME_PRICE_MAX);
  assert.equal(ok.status, 200, 'the top of the range lands');
  assert.equal(await recordGold(s.env, R.id), before - HOME_PRICE_MAX, 'and is paid');
  // a hall is a home: the same range, the same word (halls.js buyHall; its behaviour in test/guild1d_service.test.js)
  assert.match(src('server-account/src/halls.js'), /if \(!homePriceOk\(price\)\) return \{ error: 'home-update' \};/);
});

test('HOME-PRICE the sale pays what was PAID, and the town tells it to the characters whose doors can sell - ACCOUNT-HOMES: every realm character of the account: its deed share of `paid` and the rent held on it; a carried-in home, and one from before the realm, nothing (crossed); another account\'s, no sum; a claim says its own (mutants: the refund off the price; the character unasked; a home from before the realm told; a crossed house refunded; a refund of nothing dropped; the rent unsaid; the claim\'s answer silent)', async () => {
  const s = await standService();
  const who = await s.registered('Aldric');
  const other = await s.registered('Mara');
  const R2 = await seatRealm(s.env, who.secret, 'Aldric Two', RICH('Aldric Two'));   // first: the account's lease is the last seated's
  const R = await seatRealm(s.env, who.secret, 'Aldric', RICH('Aldric'));
  const raw = s.env.DB._raw;
  const row = (key, charId, price, paid, rentDue = 0) => raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid, rent_due) VALUES (77, ?, ?, ?, 'Aldric', 17, 'private', ?, 1, ?, ?)")
    .run(key, who.id, charId, price, paid, rentDue);
  row(3, R.id, 706_000, 600_100, 240);   // AUDIT HOME-PRICE D2: a price and a payment that differ - the sale reads the payment
  row(4, R.id, 600_100, 0);              // carried in through customs
  row(5, 'char-old', 42_000, 0);         // a home from before the realm
  row(6, R2.id, 120_000, 120_000);       // the account's other character's
  row(10, R.id, 1, 1);                   // AUDIT HOME-PRICE D6: a record that paid 1 under the old law - its share is nothing, and says so
  const town = async (w, character) => Object.fromEntries((await s.call('/v1/homes/town', { mapId: 77, character }, w.secret)).body.homes.map((h) => [h.buildingKey, h]));
  const mine = await town(who, R.id);
  // ACCOUNT-HOMES (PIN MOVED): the home my other character bought is mine to sell too - its sum is said at my door
  assert.deepEqual([3, 4, 5, 6, 10].map((k) => [mine[k].refund, mine[k].rentDue]), [
    [homeSaleRefund(600_100), 240], [undefined, undefined], [undefined, undefined], [homeSaleRefund(120_000), undefined], [0, undefined],
  ]);
  assert.deepEqual([mine[4].crossed, mine[5].crossed], [true, true], 'carried in, or from before the realm: no record paid for either - no sale, the account\'s still');
  assert.equal((await town(who, R2.id))[3].refund, homeSaleRefund(600_100), 'my other character\'s door can sell it too - its sum is said there');
  assert.equal((await town(who, R2.id))[6].refund, homeSaleRefund(120_000));
  assert.ok(Object.values(await town(other, null)).every((h) => !('refund' in h) && !('price' in h) && !('rentDue' in h)), 'another account learns nothing of what was paid');
  assert.ok(Object.values(await town(other, R.id)).every((h) => !('refund' in h) && !('rentDue' in h)), 'nor by naming my character');
  const old = (await town(who, 'char-old'))[5];
  assert.ok(!('refund' in old) && old.crossed === true, 'a home from before the realm is no realm sale, whoever is named - ACCOUNT-HOMES: the account\'s, and crossed');
  // and what the sale pays is that sum, with the rent held on it
  const sold = await s.call('/v1/homes/release', { mapId: 77, buildingKey: 3, realm: R.at() }, who.secret);
  assert.deepEqual([sold.status, sold.body?.refund, sold.body?.rent], [200, mine[3].refund, 240]);
  // AUDIT HOME-PRICE C2: a claim says what its sale pays - a fresh one its own share, one answered as mine already the
  // first one's (a carried-in one: crossed)
  const claim = (buildingKey, price) => s.call('/v1/homes/claim', { mapId: 77, buildingKey, region: 17, character: R.id, price, realm: R.at(), layout: null }, who.secret);
  const fresh = await claim(11, 45_000);
  assert.deepEqual([fresh.status, fresh.body?.refund, fresh.body?.crossed], [200, homeSaleRefund(45_000), undefined]);
  const again = await claim(4, 45_000);
  assert.deepEqual([again.status, again.body?.repeat, again.body?.crossed, again.body?.refund], [200, true, true, undefined]);
});

test('HOME-PRICE the client: the registry keeps my own home\'s refund and held rent; a claim\'s row is the service\'s answer - its refund, or crossed - and the price named only against an older service; the door\'s sale asks the service\'s sum before its own, a sum of nothing included (mutants: the refund dropped; the rent dropped; a refund of nothing unread; the claim\'s answer unread; crossed dropped; the offer off the price)', async () => {
  const answer = [
    { buildingKey: 3, owner: 'Aldric', entry: 'private', mine: true, character: 'r-1', refund: 510_085, rentDue: 1_500 },
    { buildingKey: 4, owner: 'Mara', entry: 'public', mine: false, refund: 'lots' },
    { buildingKey: 5, owner: 'Aldric', entry: 'private', mine: true, character: 'r-1', refund: 0 },
  ];
  let claimAnswer = { ok: true, data: { ok: true, repeat: true, home: { entry: 'private', price: 600_100 }, crossed: true } };
  const api = { town: async () => ({ ok: true, data: { homes: answer } }), claim: async () => claimAnswer };
  const homes = createOnlineHomes({ api, character: () => 'r-1' });
  await homes.ensure(77);
  assert.deepEqual([homes.homeAt(77, 3).refund, homes.homeAt(77, 3).rentDue, homes.homeAt(77, 4).refund, homes.homeAt(77, 5).refund], [510_085, 1_500, null, 0]);
  await homes.claim({ mapId: 77, buildingKey: 9, region: 17, price: 45_000 });
  assert.deepEqual([homes.homeAt(77, 9).crossed, homes.homeAt(77, 9).refund], [true, null], 'a repeat on a carried-in home: crossed, no sum - never the share of its price');
  claimAnswer = { ok: true, data: { ok: true, repeat: true, home: { entry: 'private', price: 60_000 }, refund: 51_000 } };   // mine already, bought at 60,000
  await homes.claim({ mapId: 77, buildingKey: 12, region: 17, price: 45_000 });
  assert.deepEqual([homes.homeAt(77, 12).crossed, homes.homeAt(77, 12).refund], [false, 51_000], 'the service\'s sum - never the share of the price this claim named');
  claimAnswer = { ok: true, data: { ok: true, home: { entry: 'private' } } };   // an older service says neither
  await homes.claim({ mapId: 77, buildingKey: 13, region: 17, price: 45_000 });
  assert.equal(homes.homeAt(77, 13).refund, homeRefund(45_000));
  assert.equal(homeSaleOffer(homes.homeAt(77, 3), 45_000), 510_085, 'the service\'s sum, never the house\'s price now');
  assert.equal(homeSaleOffer(homes.homeAt(77, 5), 45_000), 0, 'a sum of nothing is the service\'s too');
  assert.equal(homeSaleOffer({ refund: null }, 45_000), homeRefund(45_000), 'an older service: the share of the price now');
  assert.equal(homeSaleOffer(null, 45_000), homeRefund(45_000));
});

test('HOME-PRICE the door\'s chain, run (AUDIT HOME-PRICE D5): worldModes\' houseFootprintM2 and homeListPrice over an ARCH3D model price a house by its record\'s ground and its town; a record nobody can read is not for sale; and every host hands the door its town\'s size (mutants: the model read by another key; the town unread; a host without the size)', () => {
  const m = src('src/scenes/worldModes.js');
  const chain = `${lift(m, '  function houseFootprintM2(building) {', '\n  }')}\n${lift(m, '  function homeListPrice(bd) {', '\n  }')}\nreturn { houseFootprintM2, homeListPrice };`;
  const arch = { getRecordIndex: (id) => (id === 456 ? 3 : -1), getMesh: (rec) => (rec === 3 ? { radius: 400, size: { x: 400, y: 300, z: 480 } } : null) };
  const door = new Function('arch', 'homeFootprintM2', 'GLOBAL_SCALE', 'homeOnlinePrice', 'homePriceOk', chain)(arch, homeFootprintM2, GLOBAL_SCALE, homeOnlinePrice, homePriceOk);
  assert.equal(door.houseFootprintM2({ modelIdNum: 456 }), 120);
  assert.deepEqual([door.homeListPrice({ modelIdNum: 456, townBlocks: 9 }), door.homeListPrice({ modelIdNum: 456, townBlocks: 64 }), door.homeListPrice({ modelIdNum: 456 })], [54_000, 99_000, 36_000]);
  assert.deepEqual([door.homeListPrice({ modelIdNum: 999, townBlocks: 9 }), door.homeListPrice({ townBlocks: 9 })], [0, 0], 'no record, no sale');
  assert.match(m, /if \(!homePurchasable\(bd, \{ isActiveQuestBuilding: questSiteHere \}\)\) return 0;\n\s*return homeListPrice\(bd\);\n\s*\}/);
  assert.match(m, /const refund = homeSaleOffer\(home, homeListPrice\(bd\)\);/);
  assert.match(m, /lines: homeSaleLines\(refund, home\?\.rentDue \?\? 0\),/);
  assert.doesNotMatch(m, /\bhousePrice\(/, 'no door asks Daggerfall\'s radius x 1280 online');
  assert.match(src('src/scenes/world.js'), /townBlocks: homeTownBlocks\(dfLoc\),/);
  assert.match(src('src/scenes/exterior.js'), /regionIndex: dfLocation\.regionIndex, townBlocks: homeTownBlocks\(dfLocation\),/);
});

test('HOME-PRICE a knightly order\'s free house, online (AUDIT HOME-PRICE C1): the bank buys its deed back at the deed share of the ONLINE price - never Daggerfall\'s radius x 1280, up to a million - and Daggerfall\'s offline; the grant skips a building that is a player\'s home, and waits for the town\'s homes (mutants: the radius online; the online price offline; the town unread; the grant over a home; the town unasked)', () => {
  // the bank's sale takes the price its host names
  const accounts = createBankAccounts(62), houses = createHouses(62);
  houses[5] = { regionIndex: 5, location: 'Daggerfall', mapId: 9, buildingKey: 300 };
  assert.deepEqual(sellHouse(accounts, houses, 5, { meshRadius: 400, found: true, online: true, price: 84_150 }), { kind: 'sold', price: 84_150 });
  assert.equal(accounts[EMPIRE_ACCOUNT_REGION].accountGold, 84_150, 'into the Empire\'s account');
  houses[5] = { regionIndex: 5, location: 'Daggerfall', mapId: 9, buildingKey: 300 };
  assert.equal(sellHouse(createBankAccounts(62), houses, 5, { meshRadius: 400, found: true, online: false }).price, houseSellPrice(400), 'named none: Daggerfall\'s');
  // the host names it: online the online price's share, offline Daggerfall's
  const m = src('src/scenes/worldModes.js');
  const chain = `${lift(m, '  function houseFootprintM2(building) {', '\n  }')}\n${lift(m, '  function homeListPrice(bd) {', '\n  }')}\n${lift(m, '  function deedSellPrice(owned) {', '\n  }')}\nreturn deedSellPrice;`;
  const arch = { getRecordIndex: (id) => (id === 456 ? 3 : -1), getMesh: () => ({ radius: 400, size: { x: 400, y: 300, z: 480 } }) };
  const priced = (online) => new Function('arch', 'homeFootprintM2', 'GLOBAL_SCALE', 'homeOnlinePrice', 'homePriceOk', 'homeRefund', 'houseSellPrice', 'houseMeshRadius', 'isOnlinePage', 'buildingDirectory', chain)(
    arch, homeFootprintM2, GLOBAL_SCALE, homeOnlinePrice, homePriceOk, homeRefund, houseSellPrice, () => 400, () => online, () => ({ townBlocks: 64 }));
  assert.equal(priced(true)({ modelIdNum: 456 }), homeRefund(99_000), 'online: 120 m2 in an 8 x 8 city, its share');
  assert.equal(priced(false)({ modelIdNum: 456 }), houseSellPrice(400), 'offline: Daggerfall\'s');
  assert.equal(priced(true)(null), 0);
  assert.match(m, /houseSellPrice: \(\) => deedSellPrice\(ownedHouseSummary\(\)\),/);
  assert.match(m, /found: owned !== null, price: deedSellPrice\(owned\) \}/);
  // the grant
  assert.match(m, /if \(homes && !homes\.known\(dir\?\.mapId \?\? 0\)\) \{\n\s*void homes\.ensure\(dir\?\.mapId \?\? 0\);/);
  assert.match(m, /housesForSale: homes \? currentHousesForSale\(\)\.filter\(\(h\) => !homes\.homeAt\(dir\?\.mapId \?\? 0, h\.buildingKey\)\) : currentHousesForSale\(\),/);
  assert.match(src('src/scenes/world.js'), /regionIndex: loc\.regionIndex \?\? 0, townBlocks: homeTownBlocks\(loc\),/);
  assert.match(src('src/scenes/exterior.js'), /regionIndex: dfLocation\.regionIndex \?\? 0, townBlocks: homeTownBlocks\(dfLocation\),/);
});

test('HOME-PRICE the words: every sum a home\'s door, sale and rent say with its thousands, and online the gold from and to the Empire\'s account - never "this region\'s" (mutants: a bare number; the region named; the rent\'s clause bare; the held rent unsaid)', () => {
  assert.equal(goldSum(1_274_880), '1,274,880');
  assert.deepEqual([accountWords(true), accountWords(false)], [EMPIRE_ACCOUNT_WORDS, REGION_ACCOUNT_WORDS]);
  assert.equal(EMPIRE_ACCOUNT_WORDS, 'your account at the Bank of the Empire');
  assert.equal(homeForSaleLine(118_800), 'Can be your home: 118,800 gold');
  assert.deepEqual(homeOfferLines(45_000), ['This house can be your home.', 'It costs 45,000 gold, from your purse and your account at the Bank of the Empire.', 'Buy it?']);
  assert.equal(homeShortLine(45_000), 'You need 45,000 gold, in your purse and your account at the Bank of the Empire together.');
  assert.deepEqual(homeSaleLines(510_085).slice(0, 2), ['Sell your home for 510,085 gold?', 'The gold goes to your account at the Bank of the Empire. Anything left inside is lost.']);
  assert.equal(homeSaleLines(510_085, 1_500)[0], 'Sell your home for 510,085 gold, and the 1,500 gold of rent you have not collected?', 'AUDIT HOME-PRICE C3');
  assert.equal(homeSoldLine(38_250, 1_200, 0), 'You sold your home. 39,450 gold went to your account at the Bank of the Empire, 1,200 of it for its placed pieces.');
  assert.equal(homeSoldLine(38_250, 0, 1_500), 'You sold your home. 39,750 gold went to your account at the Bank of the Empire, 1,500 of it rent you had not collected.', 'AUDIT HOME-PRICE D3');
  assert.equal(homeBuyRows(45_000, true)[1].label, 'Click again to buy: 45,000 gold');
  assert.equal(homeHallBuyRow(100_000, { name: 'The Hand', rank: 0, hall: null }).label, 'Buy it for The Hand: 150,000 gold from the treasury');
  assert.equal(hallOfferLabel(100_000, { name: 'The Hand' }), 'G - buy it for The Hand: 150,000 gold from the treasury');
  // AUDIT HOME-PRICE E4: the rent at the same door, said the same way
  assert.equal(rentRowLabel(10_000), 'Rent a room: from 10,000 gold a day');
  assert.equal(rentPickLines('Mara')[1], 'The rent is paid now, from your purse and your account at the Bank of the Empire.');
  assert.equal(rentDaysLines(2, 1_200)[0], 'Room 2 - 1,200 gold a day.');
  assert.equal(rentConfirmLines(2, 30, 1_200)[1], 'It costs 36,000 gold.');
  assert.equal(rentShortLine(36_000), 'You need 36,000 gold, in your purse and your account at the Bank of the Empire together.');
  assert.equal(ARENA_TEXT.homeMove.refund(12_400), '12,400 gold for your catalogue pieces was refunded to your bank account.');
  const tool = src('src/scenes/decorTool.js');
  assert.match(tool, /deps\.say\?\.\(`You collected \$\{goldSum\(res\.gold\)\} gold in rent\. It went to \$\{EMPIRE_ACCOUNT_WORDS\}\.`\)/);
  assert.match(tool, /is offered to rent at \$\{goldSum\(price\)\} gold a day\./);
  assert.match(src('src/scenes/worldModes.js'), /\$\{goldSum\(back\)\} gold to \$\{accountWords\(goldRegion\(playerEntity\.bankAccounts, region\) !== region\)\}\./);
});
