// FIELD BUGS 2026-10-04d KNIGHT-HOUSE (the Discord, 2026-10-04: "Houses earned through Knightly Orders still possibly
// purchaseable? I don't know if anyone else can see this, but I don't want to risk my Knight House being bought out from
// under me..." - online, at the knight's own door: "To Arde's residence", "Go in", "Buy it: 554330 gold").
//
// THE ROOT. A Knightly Order's ReceiveHouse (KnightlyOrder.ReceiveHouse; scenes/worldModes.js) writes Daggerfall's deed
// into the save - banking.js allocateHouseToPlayer, the region's slot, the building named "<player>'s residence" - and
// nothing else. The door's offer (worldModes.js homeOfferPrice) read only the account service's list, which never heard
// of it, so: the knight's own door priced their house ("Buy it"); every other player's door did too, and their claim
// LANDED (the building theirs, the knight's door shut on the knight); and the knight's own claim landed as well, paying
// for a house they already had. Online the bank sells no house (HOME1), so the order's gift is the one deed made there.
//
// Held here on the real modules - the deed minted by the real producers (receiveHouseDecision, allocateHouseToPlayer,
// claimHouse), the real account service over node:sqlite with every migration applied, the real client registry over it:
// the door's law, the service's hold off the record and its refusals, the town's answer to the knight and to everyone
// else, the cap, the sale at the bank, the market, and the hosts by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, sessionStorageOf, T0 } from './accountDb.mjs';
import { seatRealm, realmAt } from './realmSeat.mjs';
import { createHouses, allocateHouseToPlayer, housesForSale, isHouseOwned } from '../src/systems/banking.js';
import { receiveHouseDecision, claimHouse, HOUSE_FLAG_MASK } from '../src/systems/knightlyGifts.js';
import {
  createOnlineHomes, realmDeedAt, realmDeedsOf, holdRealmDeeds, homeDoorAnswer, homePurchasable, homeDoorPrompt,
} from '../src/systems/onlineHomes.js';
import { homeDeedOf, HOME_CAP, HOME_ARENA_MAP_ID, HOME_CLAIMS_MAX } from '../src/net/homeLaw.js';
import { accountHomes, SESSION_KEY } from '../src/net/accountClient.js';
import { ROUTES } from '../server-account/src/service.js';
import { configureLayoutPins, _resetLayoutPins } from '../src/systems/layoutPins.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** A town whose map id MAPS.BSA reads signed (past 2^31) - the save keeps it so, the door unsigned; a home's price online
 *  (HOME-PRICE: inside homePriceOk's range - the field's 554330 was Daggerfall's, a build from before it). */
const TOWN = 0x9a5f3c21, TOWN_SIGNED = TOWN | 0, REGION = 17, PRICE = 55_400;
/** The town's buildings, as the directory hands them on (talkTopics.locationBuildings' shape): two HouseForSale, residences. */
const market = Array.from({ length: 40 }, (_, i) => ({
  buildingKey: 0x10200 + i, buildingType: i < 2 ? BUILDING_TYPES.HouseForSale : BUILDING_TYPES.House1, factionId: 0, quality: 5, modelIdNum: 500 + i,
}));

/** THE KNIGHT'S HOUSE, minted as the Seneschal mints it: a rank-9 knight, the town's market, the region's slot. */
function knightsHouse({ mapId = TOWN_SIGNED, pick = 0 } = {}) {
  const membership = { rank: 9, flags: 0 };
  const houses = createHouses(62);
  const d = receiveHouseDecision(membership, { ownsHouse: false, housesForSale: housesForSale(market, { mapId, month: 3 }), rolls: () => pick });
  assert.equal(d.kind, 'grant', 'a rank-9 knight with no house is given one');
  allocateHouseToPlayer(houses, REGION, { buildingKey: d.house.buildingKey, mapId, location: 'Ilessan Hills' }, { playerName: 'Arde' });
  claimHouse(membership);
  return { houses, membership, key: d.house.buildingKey, house: d.house };
}

/** The real client registry over the real worker, as `who` playing realm character `R`. */
const registry = (S, who, R) => createOnlineHomes({ api: accountHomes({ fetch: S.fetch, storage: sessionStorageOf(SESSION_KEY, who) }), character: () => R.id });

/** The real service, Arde and Mara seated as realm characters - Arde's record holding the knight's deed. */
async function stood(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const S = await standService();
  const arde = await S.registered('Arde'), mara = await S.registered('Mara');
  const k = knightsHouse();
  const RA = await seatRealm(S.env, arde.secret, 'Arde', { name: 'Arde', level: 30, goldPieces: 2_000_000, items: [], houses: k.houses });
  const RM = await seatRealm(S.env, mara.secret, 'Mara', { name: 'Mara', level: 9, goldPieces: 2_000_000, items: [] });
  const hold = (who, R, body = {}) => S.call('/v1/homes/deed', { mapId: TOWN, buildingKey: k.key, region: REGION, character: R.id, layout: null, ...body }, who.secret);
  const claim = (who, R, body = {}) => S.call('/v1/homes/claim', { mapId: TOWN, buildingKey: k.key, region: REGION, price: PRICE, character: R.id, realm: R.at(), layout: null, ...body }, who.secret);
  const goldOf = (R) => JSON.parse(new TextDecoder().decode(S.env.SAVES._map.get(S.env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(R.id).obj))).goldPieces;
  const rowOf = (key = k.key) => S.env.DB._raw.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').get(TOWN, key) ?? null;
  return { S, arde, mara, RA, RM, k, hold, claim, goldOf, rowOf, tick: (s) => { now += s; } };
}

test('KNIGHT-HOUSE the door\'s law: the deed the realm gave names its building to its owner - this town\'s, the save\'s signed map id read unsigned - and nothing else: not a neighbour, not the same key in another town or region, never a deed customs carried in (HOME1: an offline house stays offline only), never one asleep in another layout (mutants: the crossed deed counted; the key unread; the map id read signed; a sleeping deed counted)', () => {
  const { houses, key, house } = knightsHouse();
  assert.equal(isHouseOwned(houses, REGION, key), true, 'the producer\'s deed is Daggerfall\'s own house - the lock ladder opens it');
  assert.equal(houses[REGION].mapId, TOWN_SIGNED, 'the save keeps the signed map id the directory hands on');
  // THE BUG: the building is a house anyone could buy, and nothing at the door asked the deed
  assert.equal(homePurchasable(house), true, 'a candidate, no quest in it');
  assert.equal(homeDoorPrompt({ door: 'none', mode: 'grab', price: PRICE }), 'offer', 'priced, the click offered it');
  // THE LAW: the knight's own house, never for sale to the knight
  assert.equal(realmDeedAt(houses, REGION, TOWN, key), true);
  assert.equal(realmDeedAt(houses, REGION, TOWN_SIGNED, key), true, 'either spelling of the town');
  assert.equal(realmDeedAt(houses, REGION, TOWN, key + 1), false, 'the house next door is still for sale');
  assert.equal(realmDeedAt(houses, REGION, TOWN + 1, key), false, 'the same key in another town is another building');
  assert.equal(realmDeedAt(houses, REGION + 1, TOWN, key), false, 'another region\'s slot holds no deed here');
  assert.equal(realmDeedAt(null, REGION, TOWN, key), false);
  assert.deepEqual(realmDeedsOf(houses), [{ region: REGION, mapId: TOWN, buildingKey: key }], 'the one deed, its town unsigned');
  // customs: an offline house stays HOME1's - the server's list decides it online
  const crossed = structuredClone(houses);
  crossed[REGION].crossed = true;
  assert.equal(homeDeedOf(crossed, REGION, TOWN, key), null);
  assert.equal(realmDeedAt(crossed, REGION, TOWN, key), false);
  assert.deepEqual(realmDeedsOf(crossed), []);
  // a deed asleep (WD3 H1): its town stands in another layout now, so its key names another building
  try {
    configureLayoutPins({ vendorOn: (v) => v === 'beautiful-villages', vendorVersion: () => '1.4.2', locationKeyOfMapId: () => 1717 });
    assert.equal(realmDeedAt(houses, REGION, TOWN, key), false, 'given in Daggerfall\'s own town, asleep in the Villages');
    assert.deepEqual(realmDeedsOf(houses), []);
    const now = knightsHouse();
    assert.equal(now.houses[REGION].layout, 'beautiful-villages@1.4.2', 'a deed given there is stamped there');
    assert.equal(realmDeedAt(now.houses, REGION, TOWN, now.key), true, 'and stands there');
  } finally { _resetLayoutPins(); }
});

test('KNIGHT-HOUSE held: unheld, the knight\'s house was nobody\'s to the service (Mara\'s claim on it landed, and Arde\'s own paid for it again - the field\'s two questions, both yes before this); held off the record, Mara is refused (home-taken) and Arde\'s claim is a repeat that pays nothing (mutants: the route unknown; the hold unwritten; the record unread)', async (t) => {
  const { S, arde, mara, RA, RM, k, hold, claim, goldOf, rowOf } = await stood(t);
  // THE ROOT: the deed is the save's alone - the service's answer names nothing at the knight's house, so every door sold it
  assert.equal((await S.call('/v1/homes/town', { mapId: TOWN, character: RM.id }, mara.secret)).body.homes.length, 0, 'unheld, the knight\'s house is nobody\'s to the service');
  const held = await hold(arde, RA);
  assert.equal(held.status, 200, JSON.stringify(held.body));
  assert.deepEqual({ ...held.body.home, boughtAt: undefined }, { mapId: TOWN, buildingKey: k.key, region: REGION, character: RA.id, entry: 'private', price: 0, boughtAt: undefined, deed: true });
  assert.deepEqual([rowOf().deed, rowOf().paid, rowOf().price, rowOf().owner_name], [1, 0, 0, 'Arde'], 'held, never bought: nothing paid');
  // (2) nobody else may claim it
  const theirs = await claim(mara, RM);
  assert.deepEqual([theirs.status, theirs.body?.error], [409, 'home-taken']);
  assert.equal(goldOf(RM), 2_000_000, 'and paid nothing for it');
  // (3) nor may the knight buy it a second time: the building is theirs, answered as the claim, nothing paid
  const gold = goldOf(RA);
  const again = await claim(arde, RA);
  assert.equal(again.status, 200);
  assert.equal(again.body.repeat, true);
  assert.equal(goldOf(RA), gold, 'the knight\'s record paid nothing');
  assert.equal(rowOf().deed, 1, 'and the hold is still the deed\'s');
  // a hold asked again (every boot asks) is a repeat
  assert.deepEqual([(await hold(arde, RA)).body], [{ ok: true, repeat: true }]);
  assert.ok(ROUTES.has('/v1/homes/deed'), 'a route of the service');
});

test('KNIGHT-HOUSE the hold reads the RECORD: no deed there to that building holds nothing - not saved yet, the house next door, another town or region, a deed customs carried in, another layout; a guest, a character no realm made, the arena\'s cell and a building already somebody\'s are refused (mutants: the record unread; the crossed deed held; the layout unasked)', async (t) => {
  const { S, arde, mara, RA, RM, k, hold, rowOf } = await stood(t);
  for (const [body, why] of [
    [{ buildingKey: k.key + 1 }, 'the house next door'],
    [{ mapId: TOWN + 1 }, 'another town'],
    [{ region: REGION + 1 }, 'another region\'s slot'],
    [{ layout: 'beautiful-villages@1.4.2' }, 'given in Daggerfall\'s own town, held in another layout'],
  ]) {
    const r = await hold(arde, RA, body);
    assert.deepEqual([r.status, r.body?.error], [404, 'no-deed'], why);
  }
  assert.deepEqual([(await hold(mara, RM)).status, (await hold(mara, RM)).body?.error], [404, 'no-deed'], 'Mara\'s record holds no deed to it');
  // customs: the same deed, carried in from offline, is no deed the realm gave
  const R2 = await seatRealm(S.env, arde.secret, 'Arde2', { name: 'Arde', level: 30, goldPieces: 0, items: [], houses: k.houses.map((s, i) => (i === REGION ? { ...s, crossed: true } : s)) });
  assert.equal((await hold(arde, R2)).body?.error, 'no-deed', 'an offline house stays offline only');
  assert.equal(rowOf(), null, 'nothing held');
  // the walls before the record
  const g = await S.guest();
  assert.deepEqual([(await S.call('/v1/homes/deed', { mapId: TOWN, buildingKey: k.key, region: REGION, character: RA.id, layout: null }, g.secret)).status], [403], 'a guest holds no house');
  assert.equal((await hold(arde, RA, { character: 'char-arde' })).body?.error, 'realm-only');
  assert.equal((await hold(arde, RA, { mapId: HOME_ARENA_MAP_ID, buildingKey: (4 << 16) | (3 << 8) | 1 })).body?.error, 'home-arena');
  assert.equal((await hold(arde, RA, { region: 99 })).body?.error, 'bad-home');
  // a building somebody bought first is theirs: the deed cannot take it
  const RA3 = realmAt(S.env, RA.id);
  assert.equal((await S.call('/v1/homes/claim', { mapId: TOWN, buildingKey: k.key, region: REGION, price: PRICE, character: RM.id, realm: RM.at(), layout: null }, mara.secret)).status, 200);
  assert.deepEqual([(await hold(arde, RA)).status, (await hold(arde, RA)).body?.error], [409, 'home-taken']);
  assert.equal(rowOf().char_id, RM.id);
  assert.deepEqual(realmAt(S.env, RA.id), RA3, 'a hold moves nothing of the record');
});

test('KNIGHT-HOUSE the hold keeps a claim\'s laws: a town whose homes keep another layout refuses it (409 home-layout, naming the town\'s) before the hour counts it; a hold that would write counts against the hour\'s claims (mutants: the town\'s layout unasked; the hour unread)', async (t) => {
  const { S, arde, mara, RA, RM, k, hold, rowOf } = await stood(t);
  const BV = 'beautiful-villages@1.4.2';
  assert.equal((await S.call('/v1/homes/claim', { mapId: TOWN, buildingKey: k.key + 7, region: REGION, price: 5_000, character: RM.id, realm: RM.at(), layout: BV }, mara.secret)).status, 200, 'the town\'s first home, in the Villages');
  for (let i = 0; i < HOME_CLAIMS_MAX + 2; i++) {
    const r = await hold(arde, RA);
    assert.deepEqual([r.status, r.body?.error, r.body?.layout], [409, 'home-layout', BV], 'a deed given in Daggerfall\'s own town names another building there');
  }
  assert.equal(rowOf(), null);
  // the hour: every hold that reaches the record counts, as a claim does (Mara's claim above spent one)
  for (let i = 1; i < HOME_CLAIMS_MAX; i++) assert.equal((await hold(mara, RM, { mapId: TOWN + 1 })).body?.error, 'no-deed');
  assert.deepEqual([(await hold(mara, RM, { mapId: TOWN + 1 })).status], [429], 'the hour\'s claims spent');
});

test('KNIGHT-HOUSE the town\'s answer and the door: to everyone else the knight\'s house is the knight\'s home, shut, and never for sale; to the knight it is left out - Daggerfall\'s house, off the deed - and a read that still names it (made before the character was known) is no online home to them either (mutants: the deed left in the knight\'s answer; the client blind to `deed`; the own deed taken for an online home)', async (t) => {
  const { S, arde, mara, RA, RM, k, hold } = await stood(t);
  assert.equal((await hold(arde, RA)).status, 200);
  // Mara's door: the knight's home, shut - not for sale
  const hers = S.call('/v1/homes/town', { mapId: TOWN, character: RM.id }, mara.secret);
  const row = (await hers).body.homes.find((h) => h.buildingKey === k.key);
  assert.deepEqual(row, { buildingKey: k.key, owner: 'Arde', entry: 'private', mine: false, deed: true });
  const mreg = registry(S, mara, RM);
  await mreg.ensure(TOWN);
  const home = mreg.homeAt(TOWN, k.key);
  assert.equal(home?.owner, 'Arde', 'the door names its knight');
  assert.equal(homeDoorAnswer(home), 'locked', 'and is shut to Mara');
  assert.equal(homeDoorPrompt({ door: homeDoorAnswer(home), mode: 'grab', price: PRICE }), null, 'and asks her no price');
  // Arde's door: left out of the answer to the knight playing - Daggerfall's house, never an online home
  const his = await S.call('/v1/homes/town', { mapId: TOWN, character: RA.id }, arde.secret);
  assert.equal(his.body.homes.some((h) => h.buildingKey === k.key), false, 'the knight\'s own answer leaves it out');
  const areg = registry(S, arde, RA);
  await areg.ensure(TOWN);
  assert.equal(areg.known(TOWN), true);
  assert.equal(areg.homeAt(TOWN, k.key), null, 'no online home: the deed is the knight\'s house');
  // a read that names no character (before the boot knew it) still lists the row as the account's - the client knows it
  // for the deed it is
  const stale = createOnlineHomes({
    api: { town: () => S.call('/v1/homes/town', { mapId: TOWN }, arde.secret).then((r) => ({ ok: true, data: r.body })) },
    character: () => RA.id,
  });
  await stale.ensure(TOWN);
  assert.equal(stale.homesIn(TOWN).get(k.key)?.deed, true, 'the row read as a deed');
  assert.equal(stale.homeAt(TOWN, k.key), null, 'and never the knight\'s online home');
});

test('KNIGHT-HOUSE the client: every standing deed the realm gave is held through the registry (the boot\'s and the grant\'s one door) - a repeat the second time; a refusal moves nothing; the claim\'s cap counts the homes a knight BOUGHT, never the deed (mutants: the deed counted against the cap; the hold\'s call misspelt)', async (t) => {
  const { S, arde, RA, k, rowOf, tick } = await stood(t);
  const areg = registry(S, arde, RA);
  const first = await holdRealmDeeds(areg, { houses: k.houses, layoutOf: () => null });
  assert.deepEqual(first.map((d) => [d.region, d.mapId, d.buildingKey, d.r]), [[REGION, TOWN, k.key, { ok: true, repeat: false }]]);
  assert.equal(rowOf().deed, 1);
  const second = await holdRealmDeeds(areg, { houses: k.houses, layoutOf: () => null });
  assert.deepEqual(second[0].r, { ok: true, repeat: true });
  assert.deepEqual(await holdRealmDeeds(areg, { houses: createHouses(62) }), [], 'no deed, nothing asked');
  // the cap: three bought homes beside the deed
  for (let i = 0; i < HOME_CAP; i++) {
    tick(60);
    const r = await S.call('/v1/homes/claim', { mapId: TOWN, buildingKey: k.key + 10 + i, region: REGION, price: 5_000, character: RA.id, realm: realmAt(S.env, RA.id), layout: null }, arde.secret);
    assert.equal(r.status, 200, `home ${i + 1} of ${HOME_CAP}: ${JSON.stringify(r.body)}`);
  }
  const over = await S.call('/v1/homes/claim', { mapId: TOWN, buildingKey: k.key + 20, region: REGION, price: 5_000, character: RA.id, realm: realmAt(S.env, RA.id), layout: null }, arde.secret);
  assert.deepEqual([over.status, over.body?.error], [409, 'home-cap'], 'the fourth bought home is past the cap');
});

test('KNIGHT-HOUSE the sale: as the deed sells at the bank its hold is given up (release `deed`) - only a deed\'s row, never a home bought at a door; an ordinary sale never takes a deed\'s row; once gone, the building is anyone\'s again (mutants: the deed\'s release unmarked; a bought home released as a deed)', async (t) => {
  const { S, arde, mara, RA, RM, k, hold, claim, rowOf } = await stood(t);
  assert.equal((await hold(arde, RA)).status, 200);
  // the door's sale (a home's) never takes it: no record paid for it
  const sold = await S.call('/v1/homes/release', { mapId: TOWN, buildingKey: k.key, realm: realmAt(S.env, RA.id) }, arde.secret);
  assert.equal(sold.body?.error, 'home-crossed', 'a deed is no home the realm bought back');
  assert.equal(rowOf().deed, 1);
  // a home Mara bought is never released as a deed
  assert.equal((await S.call('/v1/homes/claim', { mapId: TOWN, buildingKey: k.key + 1, region: REGION, price: PRICE, character: RM.id, realm: RM.at(), layout: null }, mara.secret)).status, 200);
  const notDeed = await S.call('/v1/homes/release', { mapId: TOWN, buildingKey: k.key + 1, deed: true }, mara.secret);
  assert.deepEqual([notDeed.status, notDeed.body?.error], [404, 'no-home']);
  assert.ok(rowOf(k.key + 1), 'her house stands');
  assert.deepEqual((await registry(S, mara, RM).releaseDeed(TOWN, k.key)), { ok: false, error: 'no-home' }, 'nor anyone\'s deed but the caller\'s');
  // the deed sold: its hold given up through the registry, and the building anyone's again
  assert.deepEqual(await registry(S, arde, RA).releaseDeed(TOWN, k.key), { ok: true });
  assert.equal(rowOf(), null);
  assert.equal((await claim(mara, RM)).status, 200, 'free once its deed is sold');
});

test('KNIGHT-HOUSE the market: a building someone owns is never on it - housesForSale\'s `owned` - so the Seneschal hands on no player\'s home and no other knight\'s house, and the bank lists none (mutants: `owned` unread; the host passing none)', async (t) => {
  const { S, arde, mara, RA, RM, k, hold } = await stood(t);
  assert.equal((await hold(arde, RA)).status, 200);
  // Mara stands at a Seneschal in the knight's town: her registry's answer names the knight's house
  const mreg = registry(S, mara, RM);
  await mreg.ensure(TOWN);
  const all = housesForSale(market, { mapId: TOWN_SIGNED, month: 3 });
  assert.ok(all.some((b) => b.buildingKey === k.key), 'the same market without the answer lists the knight\'s house');
  const listed = housesForSale(market, { mapId: TOWN_SIGNED, month: 3, owned: (b) => !!mreg.homeAt(TOWN_SIGNED, b.buildingKey) });
  assert.equal(listed.some((b) => b.buildingKey === k.key), false, 'held: off the market');
  assert.equal(listed.length, all.length, 'the market topped up from the free houses, as GetHousesForSale tops up its list');
  assert.deepEqual(listed.filter((b) => b.buildingKey !== k.key && all.includes(b)).length, all.length - 1, 'the rest of the market stands');
  // and a held HouseForSale (Daggerfall's always-listed arm) too
  const forSale = market.find((b) => b.buildingType === BUILDING_TYPES.HouseForSale && b.buildingKey !== k.key);
  assert.equal(housesForSale(market, { mapId: TOWN_SIGNED, month: 3, owned: (b) => b === forSale }).includes(forSale), false);
  // the host's one producer reads the town's answer
  const m = src('src/scenes/worldModes.js');
  const fn = m.slice(m.indexOf('function currentHousesForSale() {'), m.indexOf('function houseMeshRadius(building)'));
  assert.match(fn, /owned: host\.onlineHomes \? \(bs\) => !!host\.onlineHomes\.homeAt\(dir\.mapId, bs\.buildingKey\) : null,/);
  // and the Seneschal's grant and the bank's market both read that producer (the grant through HOME-PRICE C1's filter,
  // which asks the same answer again)
  assert.match(m, /housesForSale: homes \? currentHousesForSale\(\)\.filter\(\(h\) => !homes\.homeAt\(dir\?\.mapId \?\? 0, h\.buildingKey\)\) : currentHousesForSale\(\),\n\s*alreadyOwnResult: TRANSACTION_RESULT\.ALREADY_OWN_HOUSE,/);
  assert.match(m, /const pricedHousesForSale = \(\) => currentHousesForSale\(\)/);
});

test('KNIGHT-HOUSE the hosts, by source: the door never prices the knight\'s own house (plaque and click both read homeOfferPrice); the Seneschal gives none before the room\'s layouts are heard and holds the house it gives, giving the gift back when the hold is refused as taken; the bank releases the hold before the deed sells; the boot holds every deed once the homes\' towns land; the grant\'s hold waits for a landed checkpoint (mutants: each wire cut)', () => {
  const m = src('src/scenes/worldModes.js');
  // the door
  const offer = m.slice(m.indexOf('function homeOfferPrice(bd) {'), m.indexOf('function homeSaleHover(bd)'));
  assert.match(offer, /if \(realmDeedAt\(playerEntity\.houses, bd\.regionIndex \?\? 0, homeTownOf\(bd\), bd\.buildingKey\)\) return 0;/);
  assert.ok(offer.indexOf('realmDeedAt(') < offer.indexOf('homeListPrice('), 'before the price is read');
  assert.match(m, /const price = homeOfferPrice\(bd\);\n\s*if \(!price\) return null;/, 'the plaque\'s rows read it');
  assert.match(m, /const price = door === 'none' \? homeOfferPrice\(bd\) : 0;/, 'and the click\'s offer');
  // the Seneschal
  const arm = m.slice(m.indexOf("if (destination === 'guildServiceReceiveHouse') {"), m.indexOf("if (destination === 'guildServiceTeleport') {"));
  assert.match(arm, /if \(host\.homeTownsMissing\?\.\(\)\) return \{ rows: \[\{ text: accountRefusalText\('home-towns'\), center: true \}\] \};/);
  assert.match(arm, /if \(host\.homeLayoutsHeard\?\.\(\) === false\) \{ host\.hearHomeLayouts\?\.\(\); return \{ rows: \[\{ text: accountRefusalText\('home-layout'\), center: true \}\] \}; \}/);
  assert.ok(arm.indexOf('homeLayoutsHeard') < arm.indexOf('allocateHouseToPlayer('), 'the gates before the gift');
  assert.match(arm, /claimHouse\(membership\);\n\s*surfacePlayer\(\);\n\s*if \(host\.holdRealmDeed\) holdGrantedHouse\(region, membership\);/);
  const give = m.slice(m.indexOf('function holdGrantedHouse(region, membership) {'), m.indexOf('function currentInteriorScene()'));
  assert.match(give, /if \(r\?\.ok \|\| \(r\?\.error !== 'home-taken' && r\?\.error !== 'home-layout'\)\) return;/, 'given back for a taken building or another layout alone');
  assert.match(give, /if \(now\?\.buildingKey !== key \|\| \(Number\(now\.mapId\) >>> 0\) !== mapId\) return;/, 'never a deed that moved on');
  assert.match(give, /playerEntity\.houses\[region\] = \{ regionIndex: region, location: '', mapId: 0, buildingKey: 0 \};/);
  assert.match(give, /membership\.flags = \(membership\.flags \?\? 0\) & ~HOUSE_FLAG_MASK;/, 'the order gives again');
  assert.match(give, /removePermanentScene\(sceneCache\(\), interiorSceneName\(now\.mapId, key\)\);/);
  assert.match(give, /if \(locId\) undiscoverBuilding\(locId, key\);/);
  assert.equal(HOUSE_FLAG_MASK, 2);
  // the bank's sale
  const sale = m.slice(m.indexOf('      sellHouse: () => {'), m.indexOf('      sellShip: () =>'));
  assert.match(sale, /if \(host\.onlineHomes && owned && realmDeedAt\(playerEntity\.houses, region, slot\?\.mapId, owned\.buildingKey\)\) \{\n\s*host\.onlineHomes\.releaseDeed\(slot\.mapId, owned\.buildingKey\)\n\s*\.then\(\(r\) => \{ if \(r\.ok \|\| r\.error === 'no-home'\) sell\(\); else townTalk\?\.say\?\.\(accountRefusalText\(r\.error\)\); \}\)/);
  assert.match(sale, /found: owned !== null/, 'DFU\'s resolver still guards the sale (AUDIT 64 F26)');
  // world.js
  const w = src('src/scenes/world.js');
  assert.match(w, /void moveArenaHomesOnline\(\);[^\n]*\n\s*void holdRealmDeedsOnline\(\);/, 'held once the homes\' towns land');
  const boot = w.slice(w.indexOf('async function holdRealmDeedsOnline() {'), w.indexOf('async function holdGrantedDeed('));
  assert.match(boot, /if \(!playerSpawned \|\| !_bootLoaded \|\| _loading\) \{ _deedsHeldAsked = false; return null; \}/, 'never the boot\'s stand-in character');
  assert.match(boot, /const held = await holdRealmDeeds\(onlineHomes, \{ houses: playerEntity\.houses \}\);/);
  assert.match(w, /async function holdGrantedDeed\(\{ region, mapId, buildingKey \}\) \{\n\s*if \(!onlineHomes \|\| !checkpointLanded\(await onlineCheckpointLanded\(\)\)\) return \{ ok: false, error: 'offline' \};[^\n]*\n\s*return onlineHomes\.holdDeed\(\{ region, mapId, buildingKey, layout: homeClaimLayout\(mapId\) \}\);/);
  assert.match(w, /holdRealmDeed: onlineHomes \? \(d\) => holdGrantedDeed\(d\) : null,/);
  assert.match(w, /let _deedsHeldAsked = false;/);
  // THE FOUR HOSTS: the fixed city's bench builds the same modes offline - no registry, so every arm above is Daggerfall's
  const ex = src('src/scenes/exterior.js');
  assert.doesNotMatch(ex, /\bonlineHomes\b(?!\.js)|holdRealmDeed/, '?exterior is offline: no online homes to hold against (HOME-PRICE\'s homeTownBlocks is the module\'s, no registry)');
  assert.doesNotMatch(src('src/scenes/dungeonContext.js'), /onlineHomes|holdRealmDeed|guildServiceReceiveHouse/, 'a dungeon has no house door and no Seneschal');
});

test('KNIGHT-HOUSE the deploy: migration 0079 adds `homes.deed` (0 for every home before it); the route is the account\'s, behind the session wall; the service\'s version moved on with it, in the Worker and its config (mutants: the column unadded; the version unmoved)', () => {
  const mig = src('server-account/migrations/0079_home_deed.sql');
  assert.match(mig, /^ALTER TABLE homes ADD COLUMN deed INTEGER NOT NULL DEFAULT 0;$/m);
  assert.match(src('server-account/src/service.js'), /export const ACCOUNT_VERSION = 'acct82';/);   // PIN MOVED: SERPENT1's acct78 came after it at that branch's merge of main, and GLOBAL-MARKET's acct79 after that, and SHADOW-CLOAK's acct80 after that (acct79 on its branch), and SERAPH-WINGS' acct81 after that, and AUDIT ARENA-LADDER's acct82 after that (acct79 on its branch, renumbered past GLOBAL-MARKET, SHADOW-CLOAK and SERAPH-WINGS at its merges)
  assert.match(src('server-account/wrangler.toml'), /^ACCOUNT_VERSION = "acct82"$/m);
  const idx = src('server-account/src/index.js');
  assert.ok(idx.indexOf("if (path === '/v1/homes/deed') {") > idx.indexOf("if (accountKind(who.player) !== 'linked') return no('homes-need-account', 403, origin);"), 'behind the account wall');
});
