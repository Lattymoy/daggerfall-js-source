// SHIPYARDS (2026-10-11): THE LAWS - systems/portPlaces.js (a port town's places, their keepers, names and keys),
// systems/shipyards.js (what the shipyard sells and buys back, at what price, and when it will not), systems/crewHall.js
// (the day's named recruits, their fees, signing on and paying off) and what they lean on: a ship's named hands enlisted
// and released (naval/shipCrew.js), her crew discharged (naval/navalDamage.js), the shelf's parts minted
// (comeSailAwayItems.js mintParts) and no counter buying a ship (shopStock.js). Design: bible/03-World/Shipyards.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORT_SITE_ORDER, PORT_PLACE_ORDER, PORT_PLACES, PORT_TOWN_TYPES, validPortPlace, validPortSite, isPortTown, FOUND_KIND_ORDER,
  FOUND_TALK_GROUPS, foundBuildingKey, portKeeper, portPlaceName, portDirectoryRows,
} from '../../src/systems/portPlaces.js';
import { YARD_KIND_ORDER, YARD_KINDS, YARD_KEY_BASE, YARD_QUALITY, YARD_PRICE_INDEX, yardKeeper, townSeed, townKeeper, namedAfter, yardName } from '../../src/systems/merchantYards.js';
import {
  SHIPYARD_HULLS, PARTS_HULLS, SHIPYARD_QUALITY, SHIPYARD_PRICE_INDEX, REFIT_RESALE, SALE_FLOOR, HULL_LINES, shipSpec, shipyardItem,
  isBoatItem, refitGold, shipWorth, shipBuyPrice, shipSalePrice, saleRefusal, SHIPYARD_TEXT,
} from '../../src/systems/shipyards.js';
import {
  RECRUITS_A_DAY, HAND_PRICE, RECRUIT_GRADES, RECRUIT_TRADES, recruitFee, recruitsOf, enlistPlan, releasePlan, isRecruitTrade, gradeOf, CREW_HALL_TEXT,
  hireCharge, recruitDay,
} from '../../src/systems/crewHall.js';
import { HULL_PRICES, HULL_NAMES } from '../../src/systems/comeSailAway/comeSailAwayHulls.js';
import { BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE, mintParts } from '../../src/systems/comeSailAway/comeSailAwayItems.js';
import { upgradeCost } from '../../src/systems/fleet.js';
import { calculateCost, calculateTradePrice, shopBuysItem } from '../../src/systems/shopStock.js';
import { getTradePrice } from '../../src/systems/tradeModes.js';
import { createShipCrew, CREW_ROLES, FIRST_MATE } from '../../src/systems/naval/shipCrew.js';
import { createShipDamage, REPAIR_PRICE, SHIP_STATES } from '../../src/systems/naval/navalDamage.js';
import { playerCrewCount, CREW_SHOWN } from '../../src/systems/naval/crewLife.js';
import { CREW_PER_HAND, MOBILE } from '../../src/systems/naval/navalBoarding.js';
import { hullBuild } from '../../src/systems/naval/navalShips.js';
import { LOCATION_TYPES } from '../../src/formats/mapsFile.js';
import { BUILDING_TYPES } from '../../src/world/buildingNames.js';
import { getSeed, setSeed } from '../../src/formats/dfRandom.js';

test('SHIPYARDS THE PLACES: a port town stands a shipyard and a lighthouse (its layout\'s two), and four are asked after - the crew hall inside the yard and the docks; each place\'s keeper, plaque and Where-is group', () => {
  assert.deepEqual([...PORT_SITE_ORDER], ['shipyard', 'lighthouse']);
  assert.deepEqual([...PORT_PLACE_ORDER], ['shipyard', 'crewhall', 'lighthouse', 'docks']);
  assert.deepEqual(PORT_PLACE_ORDER.map((k) => PORT_PLACES[k].group), ['Shipyards', 'Crew halls', 'Lighthouses', 'Docks']);
  assert.deepEqual(PORT_PLACE_ORDER.map((k) => PORT_PLACES[k].keeper), ['Shipmaster', 'Crewmaster', 'Lightkeeper', '']);
  assert.deepEqual([PORT_PLACES.shipyard.sign, PORT_PLACES.crewhall.sign], ['SHIPS', 'CREW'], 'the two boards\' words');
  assert.equal(new Set(PORT_PLACE_ORDER.map((k) => PORT_PLACES[k].seed)).size, 4, 'each place its own salt');
  for (const k of PORT_PLACE_ORDER) assert.equal(validPortPlace(k), k);
  assert.equal(validPortPlace('stable'), null);
  assert.equal(validPortPlace('toString'), null, 'never a prototype\'s key');
  assert.equal(validPortSite('lighthouse'), 'lighthouse');
  assert.equal(validPortSite('crewhall'), null, 'the crew hall stands inside the yard, not on its own ground');
  assert.equal(validPortSite('docks'), null, 'the docks are the harbour\'s quays');
});

test('SHIPYARDS THE TOWNS: a city, a town or a village the port\'s harbour law calls a port - never a farm, a manor, a temple or a dungeon, and never a town that is no port', () => {
  assert.deepEqual([...PORT_TOWN_TYPES], [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage]);
  const at = (locationType) => ({ mapTableData: { locationType } });
  for (const t of PORT_TOWN_TYPES) {
    assert.equal(isPortTown(at(t), true), true);
    assert.equal(isPortTown(at(t), false), false, 'no port, no shipyard');
  }
  for (const t of [LOCATION_TYPES.HomeFarms, LOCATION_TYPES.HomeWealthy, LOCATION_TYPES.ReligionTemple, LOCATION_TYPES.DungeonKeep]) assert.equal(isPortTown(at(t), true), false);
  assert.equal(isPortTown(null, true), false);
});

test('SHIPYARDS-FOUND THE KEYS: the found places\' one order - the yards\' two, then the port\'s four - each a directory key no Daggerfall building holds; the Stable and the Wagon Yard keep the keys they had (mutants: the order or the base moved)', () => {
  assert.deepEqual([...FOUND_KIND_ORDER], [...YARD_KIND_ORDER, ...PORT_PLACE_ORDER, 'carpenter']);   // PIN MOVED (CARP-YARD, 2026-10-12): the joinery after the port's four - every key before it kept
  assert.deepEqual(YARD_KIND_ORDER.map(foundBuildingKey), [YARD_KEY_BASE, YARD_KEY_BASE + 1], 'the yards\' own keys');
  assert.deepEqual(PORT_PLACE_ORDER.map(foundBuildingKey), [2, 3, 4, 5].map((i) => YARD_KEY_BASE + i));
  assert.equal(foundBuildingKey('tavern'), -1);
  for (const k of FOUND_KIND_ORDER) assert.equal(typeof FOUND_TALK_GROUPS[k], 'string');
  assert.equal(FOUND_TALK_GROUPS.docks, 'Docks');
});

test('SHIPYARDS THE KEEPERS AND THE NAMES: the yards\' one keeper draw (townKeeper) on the town\'s map id and the place\'s salt - the same on every client, the global stream put back; the shipyard and the crew hall named for their keepers, the lighthouse and the docks for the town', () => {
  setSeed(12345);
  const a = portKeeper(4242, 'shipyard', 17), b = portKeeper(4242, 'shipyard', 17);
  assert.equal(getSeed(), 12345, 'DFU\'s stream put back');
  assert.deepEqual(a, b, 'the same shipmaster on every client');
  assert.deepEqual(a, townKeeper(townSeed(4242, PORT_PLACES.shipyard.seed), 17), 'the yards\' one draw');
  assert.deepEqual(yardKeeper(4242, 'stable', 17), townKeeper(townSeed(4242, YARD_KINDS.stable.seed), 17), 'the yards\' keeper the same draw (YARD_KINDS\' salt)');
  assert.notDeepEqual(portKeeper(4242, 'crewhall', 17), a, 'the crewmaster is another person');
  assert.notDeepEqual(portKeeper(4243, 'shipyard', 17), a, 'another town, another shipmaster');
  assert.ok(typeof a.name === 'string' && a.name.length > 0 && (a.sex === 'male' || a.sex === 'female'));
  assert.equal(portPlaceName('shipyard', { keeperName: 'Halbrecht Voss' }), namedAfter('Halbrecht Voss', 'Shipyard'));
  assert.equal(portPlaceName('crewhall', { keeperName: 'Anna Wayrest' }), namedAfter('Anna Wayrest', 'Crew Hall'));
  assert.equal(yardName('stable', 'Halbrecht Voss'), namedAfter('Halbrecht Voss', 'Stables'), 'the yards named by the same law');
  assert.equal(portPlaceName('lighthouse', { townName: 'Sentinel' }), 'The Sentinel Light');
  assert.equal(portPlaceName('docks', { townName: 'Sentinel' }), 'Sentinel Docks');
  assert.equal(portPlaceName('lighthouse'), 'The Lighthouse');
  assert.equal(portPlaceName('docks', { townName: '  ' }), 'The Docks');
});

test('SHIPYARDS-FOUND THE ROWS: each port place a row of the town\'s directory as a yard\'s is - its name, its middle in the location frame, a yard\'s quality, its kind and its key; a nameless or unknown place none', () => {
  const rows = portDirectoryRows([
    { kind: 'shipyard', x: 120.5, z: 40, name: 'Voss\'s Shipyard' },
    { kind: 'crewhall', x: 126, z: 37, name: 'Wayrest\'s Crew Hall' },
    { kind: 'lighthouse', x: 300, z: 12, name: 'The Sentinel Light' },
    { kind: 'docks', x: 410, z: -60, name: 'Sentinel Docks' },
    { kind: 'tavern', x: 0, z: 0, name: 'The Rusty Anchor' },
  ]);
  assert.deepEqual(rows.map((r) => r.yard), ['shipyard', 'crewhall', 'lighthouse', 'docks']);
  assert.deepEqual(rows[0], { name: 'Voss\'s Shipyard', buildingType: 'port:shipyard', factionId: 0, quality: YARD_QUALITY, position: [120.5, 0, 40], buildingKey: foundBuildingKey('shipyard'), yard: 'shipyard' });
  assert.deepEqual(rows.map((r) => r.buildingKey), PORT_PLACE_ORDER.map(foundBuildingKey));
  assert.deepEqual(portDirectoryRows(null), []);
});

test('SHIPYARDS THE STOCK: every hull Come Sail Away builds, cheapest first, at the mod\'s own prices - the Rowboat as her parts, every other as her deed, variant I, her number the host\'s; the shipmaster\'s figures for each (mutants: a hull dropped, the parts for a deed)', () => {
  assert.deepEqual([...SHIPYARD_HULLS].sort(), [0, 1, 2, 3, 4], 'every hull');
  assert.deepEqual(SHIPYARD_HULLS.map((h) => HULL_PRICES[h]), [...SHIPYARD_HULLS.map((h) => HULL_PRICES[h])].sort((a, b) => a - b), 'cheapest first');
  assert.deepEqual([...PARTS_HULLS], [0]);
  const parts = shipyardItem(0, 9001), deed = shipyardItem(2, 9002);
  assert.deepEqual([parts.templateIndex, parts.UID, parts.message, parts.value], [BOAT_PARTS_TEMPLATE, 9001, 0, HULL_PRICES[0]]);
  assert.equal(parts.name, 'Parts of Rowboat \'I\'');
  assert.deepEqual(mintParts(0, 0, 9001), parts, 'the shelf\'s own form for her');
  assert.deepEqual([deed.templateIndex, deed.UID, deed.message, deed.value], [BOAT_DEED_TEMPLATE, 9002, 20, HULL_PRICES[2]]);
  assert.equal(isBoatItem(parts) && isBoatItem(deed), true);
  assert.equal(isBoatItem({ templateIndex: 50 }), false);
  assert.throws(() => mintParts(5, 0, 1), /IndexOutOfRangeException/, 'a hull the C#\'s arrays would throw on');
  for (const hull of SHIPYARD_HULLS) {
    const s = shipSpec(hull), b = hullBuild(hull);
    assert.equal(s.name, HULL_NAMES[hull]);
    assert.equal(s.price, HULL_PRICES[hull]);
    assert.equal(s.parts, hull === 0);
    assert.equal(s.crew, b.crew);
    assert.equal(s.hands, playerCrewCount(hull, b.crew), 'the named hands her deck stands at her whole crew');
    assert.ok(s.length > 0 && s.beam > 0 && s.hullHp > 0);
    assert.equal(s.line, HULL_LINES[hull]);
  }
  assert.deepEqual(SHIPYARD_HULLS.map((h) => shipSpec(h).hands), [0, 0, 4, 5, 8], 'the Rowboat and the Large Boat none; a Small Ship four, a Carrack five, a Large Galley eight');
  assert.equal(shipSpec(3).ram, true, 'the galley\'s ram');
});

test('SHIPYARDS THE PRICE: the counter\'s one law at a yard\'s quality and index - calculateCost, then GetTradePrice\'s Buy and Sell with the buyer\'s skills; a ship\'s worth her price and half her refits\' gold, by her hull\'s state down to SALE_FLOOR (mutants: the refits whole, the floor gone)', () => {
  assert.equal(SHIPYARD_QUALITY, YARD_QUALITY);
  assert.equal(SHIPYARD_PRICE_INDEX, YARD_PRICE_INDEX);
  const sk = { mercantile: 30, personality: 55 };
  for (const v of [4000, 100000]) {
    assert.equal(shipBuyPrice(v, sk), getTradePrice('Buy', calculateCost(v, YARD_QUALITY, YARD_PRICE_INDEX), YARD_QUALITY, sk, 1));
    assert.equal(shipSalePrice(v, sk), getTradePrice('Sell', calculateCost(v, YARD_QUALITY, YARD_PRICE_INDEX), YARD_QUALITY, sk, 1));
  }
  assert.ok(shipBuyPrice(100000, { mercantile: 10, personality: 30 }) > shipBuyPrice(100000, { mercantile: 60, personality: 70 }), 'a better haggler pays less');
  const rec = { hull: 2, value: 100000, upgrades: { hold: 2, guns: 1 } };
  const refits = upgradeCost(2, 'hold', 0).gold + upgradeCost(2, 'hold', 1).gold + upgradeCost(2, 'guns', 0).gold;
  assert.equal(refitGold(rec), refits);
  assert.equal(shipWorth(rec), Math.round(100000 + refits * REFIT_RESALE));
  assert.equal(shipWorth(rec, 0), Math.round((100000 + refits * REFIT_RESALE) * SALE_FLOOR), 'a wreck');
  assert.equal(shipWorth(rec, 0.5), Math.round((100000 + refits * REFIT_RESALE) * (SALE_FLOOR + (1 - SALE_FLOOR) * 0.5)));
  assert.equal(shipWorth({ hull: 4 }), HULL_PRICES[4], 'no value: her hull\'s price');
  assert.equal(shipWorth({ hull: 1, value: 2000 }), 2000, 'a claimed prize\'s papers\' value');
});

test('SHIPYARDS NO LOOP ONLINE: the counter\'s online law caps a sale at half the least it asks (REALM P0.4, MERC-RISE) - so buying a ship and selling her back never pays, at any skill (mutants: the cap gone)', () => {
  for (const sk of [{ mercantile: 0, personality: 10 }, { mercantile: 60, personality: 60 }, { mercantile: 100, personality: 100 }, { mercantile: 300, personality: 250 }]) {
    for (const hull of SHIPYARD_HULLS) {
      const v = HULL_PRICES[hull], cost = calculateCost(v, YARD_QUALITY, YARD_PRICE_INDEX);
      const buy = Math.max(1, calculateTradePrice(cost, YARD_QUALITY, sk, false, { online: true }));
      const sell = calculateTradePrice(cost, YARD_QUALITY, sk, true, { online: true });
      assert.ok(sell <= buy / 2 + 1, `hull ${hull} at ${JSON.stringify(sk)}: sold back for ${sell}, bought for ${buy}`);
    }
  }
});

test('SHIPYARDS WHAT IT TAKES BACK: a ship of the player\'s at this port, laid up or packed - never at the helm, afar, fighting, with another player aboard, her hands ashore or her hold full (mutants: each refusal dropped)', () => {
  for (const where of ['here', 'laidup', 'packed']) assert.equal(saleRefusal({ where }), null, where);
  assert.equal(saleRefusal({ where: 'here', atPort: false }), SHIPYARD_TEXT.notPort);
  assert.match(saleRefusal({ where: 'sailing' }), /helm/);
  assert.match(saleRefusal({ where: 'away' }), /this port/);
  assert.match(saleRefusal({ where: 'lost' }), /No such ship/);
  assert.match(saleRefusal({ where: 'here', fighting: true }), /in combat/);
  assert.match(saleRefusal({ where: 'here', aboard: 1 }), /aboard/);
  assert.match(saleRefusal({ where: 'here', ashore: 2 }), /ashore/);
  assert.match(saleRefusal({ where: 'laidup', hold: 3 }), /hold/);
  assert.equal(SHIPYARD_TEXT.sold('The Kestrel', 12345.4), 'The shipmaster buys The Kestrel for 12,345 gold.');
  assert.equal(SHIPYARD_TEXT.short(100000), 'The shipmaster asks 100,000 gold. You don\'t have enough.');
});

test('SHIPYARDS THE SHELVES: no counter shelves or buys either of Come Sail Away\'s two - the shipyard is where a ship is had and let go (a DECLARED departure)', () => {
  for (const t of Object.values(BUILDING_TYPES)) {
    for (const it of [mintParts(0, 0, 5), shipyardItem(2, 6)]) assert.equal(shopBuysItem(t, it), false, `building ${t}`);
  }
});

test('SHIPYARDS THE CREW HALL\'S ROSTER: RECRUITS_A_DAY named sailors a town\'s hall each day, the same on every client and the global stream put back - another day, another roster; a sailor serving a ship of the player\'s is not on it (mutants: the day unread, serving unread)', () => {
  setSeed(777);
  const a = recruitsOf({ mapId: 4242, day: 100, regionIndex: 17 });
  assert.equal(getSeed(), 777, 'DFU\'s stream put back');
  assert.equal(RECRUITS_A_DAY, 6, 'six a day (the page and the notes say six)');
  assert.equal(a.length, 6);
  assert.deepEqual(recruitsOf({ mapId: 4242, day: 100, regionIndex: 17 }), a, 'the same hall the same day');
  assert.notDeepEqual(recruitsOf({ mapId: 4242, day: 101, regionIndex: 17 }).map((r) => r.name), a.map((r) => r.name), 'the next day\'s');
  assert.notDeepEqual(recruitsOf({ mapId: 4243, day: 100, regionIndex: 17 }).map((r) => r.name), a.map((r) => r.name), 'another town\'s');
  // PIN MOVED (AUDIT SHIPYARDS L2-9): the serving are their hall ids - a hand who merely shares a recruit's name hides nobody
  const less = recruitsOf({ mapId: 4242, day: 100, regionIndex: 17, serving: [a[2].id] });
  assert.deepEqual(less.map((r) => r.id), a.filter((_, i) => i !== 2).map((r) => r.id), 'one signed on: off the roster');
  assert.deepEqual(recruitsOf({ mapId: 4242, day: 100, regionIndex: 17, serving: [a[2].name] }).map((r) => r.id), a.map((r) => r.id), 'a name is no hall id');
  assert.equal(recruitDay(a[2].id), 100, 'an id says its day');
  for (const r of a) {
    assert.ok(r.name && (r.sex === 'male' || r.sex === 'female'));
    assert.ok(gradeOf(r.grade), r.grade);
    assert.ok(isRecruitTrade(r.trade), r.trade);
    assert.equal(r.fee, recruitFee(r.grade, r.trade));
    const g = gradeOf(r.grade);
    assert.ok(r.fights >= g.fights[0] && r.fights <= g.fights[1] && r.boardings >= g.boardings[0] && r.boardings <= g.boardings[1]);
    assert.equal(r.trade === 'Bard', r.mobile === MOBILE.Bard, 'a Bard keeps his calling, and only a Bard is one');
    assert.ok(RECRUIT_GRADES.indexOf(g) >= RECRUIT_TRADES[r.trade].least, `a ${r.trade} is ${r.grade}`);
  }
  // across many days: every trade and every grade turns up (AUDIT SHIPYARDS L6-5: a weight of nought dies here); a First
  // Mate is seasoned at the least
  const seen = new Map(), grades = new Set();
  for (let d = 0; d < 300; d++) for (const r of recruitsOf({ mapId: 99, day: d })) { seen.set(`${r.trade}`, (seen.get(r.trade) ?? new Set()).add(r.grade)); grades.add(r.grade); }
  assert.deepEqual([...seen.keys()].sort(), Object.keys(RECRUIT_TRADES).sort(), 'every trade');
  assert.deepEqual([...grades].sort(), RECRUIT_GRADES.map((g) => g.key).sort(), 'every grade');
  for (const g of seen.get(FIRST_MATE) ?? []) assert.ok(['seasoned', 'veteran'].includes(g), `a First Mate ${g}`);
});

test('SHIPYARDS THE FEES: a grade\'s ground times the trade\'s premium, to ten gold - never under a shipwright\'s hand (REPAIR_PRICE.crew a man\'s share), and a hire that raises her crew by more men pays the shipwright\'s price for each (AUDIT SHIPYARDS L2-2), so no recruit is the cheaper way to fill her', () => {
  assert.equal(HAND_PRICE, REPAIR_PRICE.crew * CREW_PER_HAND);
  // AUDIT SHIPYARDS L6-5: the page's tables, every figure
  assert.deepEqual(RECRUIT_GRADES.map((g) => [g.key, g.fee, g.lift, g.weight]), [['green', 180, 0, 4], ['able', 260, 2, 4], ['seasoned', 420, 4, 2], ['veteran', 700, 6, 1]]);
  assert.deepEqual(Object.fromEntries(Object.entries(RECRUIT_TRADES).map(([k, t]) => [k, [t.premium, t.least, t.weight]])), {
    [FIRST_MATE]: [1.6, 2, 1], Bosun: [1.3, 1, 1], Gunner: [1.2, 0, 3], Carpenter: [1.2, 0, 2], Lookout: [1, 0, 2], Cook: [1, 0, 1], Deckhand: [1, 0, 3], Bard: [1.1, 0, 0],
  });
  assert.equal(hireCharge(180, 11), 11 * REPAIR_PRICE.crew, 'eleven men raised: the shipwright\'s price for them');
  assert.equal(hireCharge(420, CREW_PER_HAND), 420, 'a man\'s share: his fee');
  assert.equal(hireCharge(260, 0), 260, 'in a hand\'s place: his fee');
  for (const g of RECRUIT_GRADES) for (const t of Object.keys(RECRUIT_TRADES)) {
    const fee = recruitFee(g, t);
    assert.ok(fee >= HAND_PRICE && fee % 10 === 0, `${g.key} ${t}: ${fee}`);
  }
  assert.equal(recruitFee('veteran', FIRST_MATE), Math.round((700 * 1.6) / 10) * 10);
  assert.ok(recruitFee('seasoned', 'Gunner') > recruitFee('seasoned', 'Deckhand'));
  assert.ok(recruitFee('veteran', 'Deckhand') > recruitFee('green', 'Deckhand'));
  assert.ok(CREW_ROLES.every(isRecruitTrade) && isRecruitTrade('Bard') && !isRecruitTrade('Captain'));
});

test('SHIPYARDS SIGNING ON: a recruit takes a place on her deck - her crew raised to the share that stands one more named hand, never past her whole, the men it raises said; a deck already standing every man her whole crew can is FULL (a recruit signs on in a hand\'s place); a boat with no crew none; paid off, a man\'s share less - never the last of her crew (mutants: the deck\'s count unread, the cap gone, the raise unsaid, full unread, the last man paid off)', () => {
  const S = hullBuild(2).crew;
  // PIN MOVED (AUDIT SHIPYARDS L2-2, L7-2): the plan says the men it raises, and whether her deck is full
  assert.deepEqual(enlistPlan({ hull: 2, crew: 12, maxCrew: S, hands: 2 }), { ok: true, full: false, crew: 3 * CREW_PER_HAND, raise: CREW_PER_HAND });
  assert.equal(playerCrewCount(2, 3 * CREW_PER_HAND), 3);
  assert.deepEqual(enlistPlan({ hull: 2, crew: 20, maxCrew: S, hands: 3 }), { ok: true, full: false, crew: Math.min(S, 24), raise: Math.min(S, 24) - 20 }, 'never lowered');
  assert.deepEqual(enlistPlan({ hull: 4, crew: 24, maxCrew: 28, hands: 4 }), { ok: true, full: false, crew: 28, raise: 4 }, 'never past her whole');
  assert.deepEqual(enlistPlan({ hull: 2, crew: 1, maxCrew: S, hands: 1 }), { ok: true, full: false, crew: 2 * CREW_PER_HAND, raise: 2 * CREW_PER_HAND - 1 }, 'a thin crew: the raise the charge reads');
  const full = playerCrewCount(2, S);
  assert.equal(full, 4, 'a Small Ship as she is bought stands four');
  assert.deepEqual(enlistPlan({ hull: 2, crew: S, maxCrew: S, hands: full }), { ok: false, full: true, why: CREW_HALL_TEXT.full }, 'every man her crew stands: full');
  assert.deepEqual(enlistPlan({ hull: 0, crew: 0, maxCrew: 0, hands: 0 }), { ok: false, full: false, why: CREW_HALL_TEXT.noCrew }, 'a rowboat');
  // AUDIT SHIPYARDS (the mutation rerun): a deck already standing more men than are named makes no NEW place - the host
  // syncs her named hands first (navalHost.js crewHands), and a plan handed them behind refuses rather than guess
  assert.deepEqual(enlistPlan({ hull: 3, crew: 60, maxCrew: 60, hands: 2 }), { ok: false, full: false, why: CREW_HALL_TEXT.noPlace }, 'her named hands behind her deck');
  assert.equal(enlistPlan({ hull: 1, crew: 0, maxCrew: hullBuild(1).crew, hands: 0 }).ok, CREW_SHOWN[1] > 0 && playerCrewCount(1, Math.min(hullBuild(1).crew, CREW_PER_HAND)) === 1);
  // PIN MOVED (AUDIT SHIPYARDS L2-1): the last of her crew is never paid off - nobody aboard, she strikes
  assert.deepEqual(releasePlan({ crew: 20 }), { ok: true, crew: 20 - CREW_PER_HAND });
  assert.deepEqual(releasePlan({ crew: CREW_PER_HAND + 1 }), { ok: true, crew: 1 });
  assert.deepEqual(releasePlan({ crew: CREW_PER_HAND }), { ok: false, crew: CREW_PER_HAND, why: CREW_HALL_TEXT.lastMan });
  assert.deepEqual(releasePlan({ crew: 0 }), { ok: false, crew: 0, why: CREW_HALL_TEXT.lastMan });
  // PIN MOVED (AUDIT SHIPYARDS L2-7): no possessive on a ship's name ("Small Ship 'I''s")
  assert.equal(CREW_HALL_TEXT.signed('Anna Voss', 'Gunner', 'The Kestrel'), 'Anna Voss signs on to The Kestrel as Gunner.');
  assert.equal(CREW_HALL_TEXT.swapped('Anna Voss', 'Gunner', 'The Kestrel', 'Bram'), 'Anna Voss signs on to The Kestrel as Gunner, replacing Bram. Bram is paid off.');
  assert.equal(CREW_HALL_TEXT.steppedUp('Bram', 'The Kestrel', 'Odo'), 'Bram is paid off and leaves The Kestrel. Odo takes the open place on deck.');
});

test('SHIPYARDS A NAMED HAND ENLISTED AND RELEASED (shipCrew.js): he joins at his trade\'s post with his record - a First Mate stands the old one down to Deckhand, a trade the deck has no post for is a Deckhand, a name already aboard is refused, his grade lifts her spirits; paid off he leaves wherever he stood; her crew discharged by his share (navalDamage.js), nothing else touched', () => {
  const crew = createShipCrew({ seed: 5 });
  crew.sync([{ mobile: MOBILE.Warrior, gender: 'male' }, { mobile: MOBILE.Archer, gender: 'female' }, { mobile: MOBILE.Monk, gender: 'male' }]);
  if (!crew.hands.some((x) => x.role === FIRST_MATE)) crew.assign(crew.hands[0].name, FIRST_MATE);
  const old = crew.hands.find((x) => x.role === FIRST_MATE);
  const before = crew.morale;
  const h = crew.enlist({ name: 'Anna Voss', role: FIRST_MATE, mobile: MOBILE.Rogue, gender: 'female', fights: 7, boardings: 3, hall: '9:100:2' }, 4);
  // PIN MOVED (AUDIT SHIPYARDS L2-4, L2-9): her hall id and the spirits she actually lifted ride her
  // PIN MOVED (AUDIT CAPTAIN'S SEA C8, at the merge): her record her deeds, and no service kept apart (`prior` 0)
  assert.deepEqual(h, { name: 'Anna Voss', role: FIRST_MATE, mobile: MOBILE.Rogue, gender: 'female', fights: 7, boardings: 3, prior: 0, hall: '9:100:2', lift: 4 });
  assert.equal(crew.hands.at(-1), h, 'at her roster\'s end');
  assert.equal(crew.hands.filter((x) => x.role === FIRST_MATE).length, 1, 'one First Mate');
  assert.equal(old.role, 'Deckhand', 'the old one stood down');
  assert.equal(crew.morale, before + 4, 'a seasoned man steadies them - by his grade\'s lift');
  // the save keeps both (createShipCrew's restore)
  const back = createShipCrew({ seed: 5, record: crew.snapshot() });
  assert.deepEqual(back.hands.find((x) => x.name === 'Anna Voss'), h, 'saved and restored with them');
  assert.equal(crew.enlist({ name: 'Anna Voss', role: 'Cook' }), null, 'no name twice');
  assert.equal(crew.enlist({ name: 'Bram', role: 'Captain' }).role, 'Deckhand', 'a post the deck has not');
  assert.equal(crew.enlist({ name: 'Lute', role: 'Bard', mobile: MOBILE.Bard }).role, 'Bard', 'a Bard keeps his calling');
  assert.equal(crew.enlist({ name: 'Faker', role: 'Bard', mobile: MOBILE.Warrior }).role, 'Deckhand', 'a Bard is a bard');
  const n = crew.hands.length;
  const lifted = crew.morale;
  assert.equal(crew.release('Anna Voss').name, 'Anna Voss');
  assert.equal(crew.hands.length, n - 1);
  assert.equal(crew.morale, lifted - 4, 'AUDIT SHIPYARDS L2-4: the spirits she brought leave with her - no pump');
  assert.equal(crew.release('Nobody'), null);
  const d = createShipDamage({ hullHp: 900, sailHp: 300, crew: 24, player: true });
  const { hull, sail } = d;
  d.discharge(d.crew - CREW_PER_HAND);
  assert.equal(d.crew, 24 - CREW_PER_HAND);
  assert.deepEqual([d.hull, d.sail], [hull, sail], 'her hurts untouched');
  d.discharge(-5);
  assert.equal(d.crew, 0, 'never under none');
  d.discharge(10_000);
  assert.equal(d.crew, 0, 'a discharge never adds a man');
  // AUDIT SHIPYARDS L2-5: a muster raises her crew and nothing else - a wreck stays a wreck (a repair's refloat would float her)
  const w = createShipDamage({ hullHp: 600, sailHp: 200, crew: 24, player: true });
  w.restore({ hull: 30, sail: 0, crew: 6, state: SHIP_STATES.wrecked });
  w.muster(18);
  assert.deepEqual([w.crew, w.state, w.hull], [18, SHIP_STATES.wrecked, 30]);
  w.muster(1000);
  assert.equal(w.crew, 24, 'never past her whole');
  w.muster(3);
  assert.equal(w.crew, 24, 'a muster never lowers');
});
