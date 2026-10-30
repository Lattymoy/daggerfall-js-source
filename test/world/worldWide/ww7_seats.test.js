// WW7-3 (2026-10-25, the owner: "we need the same city nodes populating the entire map of tamriel"; asked, a province's
// crown its own kingdom: "Yes"; High Rock and Hammerfell's past the Bay: "Whatever makes sense"; bible/03-World/
// World-Wide.md WW7): the seats past the Bay - a crown at each province's capital, a palace at every Arena city-state -
// the provinces' kingdoms, the law's regions and pixels, a province's gate its own seats'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KINGDOMS, kingdomOf, kingdomSeatName, BAY_KINGDOMS, isMarch, isFreeLand } from '../../../src/net/kingdomLaw.js';
import { CROWN_SEAT_REGIONS, seatRegionOk, seatReportOf, gateRegionOk, KINGDOM_METALS, KINGDOM_BANNER_COLOURS, SEAT_CROWN_GLYPHS, seatGlyphsOf, CROWN_SIEGE_SLOT, siegeWindowOk, seatArrivalLine } from '../../../src/net/townSeatLaw.js';
import { tideLandOf } from '../../../src/net/tideLaw.js';
import { GLYPHS } from '../../../src/net/identityToken.js';
import { GATE_LANE_SPAN } from '../../../src/net/gate/gateLaw.js';
import { deriveTownSeats, tamrielSeatsOf, replaceSeats, seatPixelTest, seatAtMapId } from '../../../src/systems/town/townSeats.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

test('WW7-3 the provinces\' kingdoms: seven crowns past the Bay, each its province\'s region and seated at its capital; High Rock\'s and Hammerfell\'s past the Bay no crown\'s, no March, no Free Land; the Bay\'s three the Tides\' alone (mutants: a crown unseated; a province a Tide\'s land)', () => {
  const past = Object.values(KINGDOMS).filter((k) => !BAY_KINGDOMS.includes(k.id));
  assert.deepEqual(past.map((k) => [k.id, k.seat, k.regions[0]]), [['skyrim', 'Solitude', 64], ['morrowind', 'Mournhold', 65], ['summerset', 'Alinor', 66],
    ['valenwood', 'Falinesti', 67], ['elsweyr', 'Torval', 68], ['blackmarsh', 'Helstrom', 69], ['cyrodiil', 'Imperial City', 70]]);
  for (const k of past) assert.equal(CROWN_SEAT_REGIONS[k.regions[0]], k.id);
  assert.deepEqual([kingdomSeatName('wayrest'), kingdomSeatName('skyrim'), kingdomSeatName('nowhere')], ['Wayrest', 'Solitude', null]);
  for (const r of [62, 63]) assert.deepEqual([kingdomOf(r), isMarch(r), isFreeLand(r)], [null, false, false], `region ${r}`);
  assert.equal(tideLandOf(64), null, 'a province\'s crown is no Tide\'s land');
  assert.equal(tideLandOf(17), 'daggerfall');
  for (const k of Object.keys(KINGDOMS)) {
    assert.ok(KINGDOM_METALS[k] && KINGDOM_BANNER_COLOURS[k] && SEAT_CROWN_GLYPHS[k] && GLYPHS.includes(SEAT_CROWN_GLYPHS[k]), `${k}: its metal, banner and crown`);
    assert.ok(siegeWindowOk(CROWN_SIEGE_SLOT[k].day, CROWN_SIEGE_SLOT[k].hour), `${k}: its crown siege inside the window`);
  }
  assert.equal(new Set(Object.values(KINGDOM_METALS)).size, Object.keys(KINGDOMS).length, 'no two crowns one metal');
  const slots = Object.values(CROWN_SIEGE_SLOT).map((s) => `${s.day}:${s.hour}`);
  assert.equal(new Set(slots).size, slots.length, 'no two crowns\' sieges at once');
  assert.deepEqual(GLYPHS.slice(-14, -7) /* PIN MOVED (BLOOD-OF-COLDHARBOUR): the Coldharbour rose joined the list last */ /* PIN MOVED (STOREFRONT): the bundles' three and the Battle Pass's two joined the list last */ /* PIN MOVED (SHOP): the Origin joined the list last, after the crowns */, Object.values(SEAT_CROWN_GLYPHS).slice(3), 'the new crowns after every glyph a token carries');
  assert.deepEqual(seatGlyphsOf([{ tier: 'crown', region: 64 }, { tier: 'palace', region: 62 }, { tier: 'crown', region: 17 }]), ['tower', 'crownDF', 'crownSK']);
  assert.equal(seatArrivalLine({ name: 'Solitude', tier: 'crown', region: 64 }), 'Solitude, capital of the Kingdom of Skyrim. Its Crown Charter is unheld.');
});

test('WW7-3 the law past the Bay: a seat\'s region any of the 71, its pixel the world\'s grid\'s; a crown bears its capital\'s name in its province; a gate\'s kill counts at its own lane\'s province alone (mutants: the regions the Bay\'s; the lane unasked)', () => {
  assert.deepEqual([seatRegionOk(0), seatRegionOk(61), seatRegionOk(62), seatRegionOk(70), seatRegionOk(71), seatRegionOk(-1)], [true, true, true, true, false, false]);
  const ok = { key: 0xa7_7a120, name: 'Northpoint', region: 62, tier: 'palace', pixel: [-40, 12] };
  assert.ok(seatReportOf(ok));
  assert.equal(seatReportOf({ ...ok, pixel: [-8192, 12] }), null);
  assert.ok(seatReportOf({ key: 1, name: 'Imperial City', region: 70, tier: 'crown', pixel: [2069, 658] }));
  assert.equal(seatReportOf({ key: 1, name: 'Imperial City', region: 64, tier: 'crown', pixel: [2069, 658] }), null, 'a crown in another province');
  assert.equal(seatReportOf({ key: 1, name: 'Hegathe', region: 63, tier: 'crown', pixel: [-30, 300] }), null, 'Hammerfell past the Bay no crown');
  const day = 42, laneOf = (t) => t * GATE_LANE_SPAN + day;
  assert.deepEqual([gateRegionOk(day, 21), gateRegionOk(day, 64), gateRegionOk(laneOf(3), 64), gateRegionOk(laneOf(3), 65), gateRegionOk(laneOf(9), 70), gateRegionOk(laneOf(1), 21)],
    [true, false, true, false, true, false]);
});

test('WW7-3 the seats past the Bay: a crown at each capital, a palace at each Arena city-state, through the law; added to the Bay\'s by source and replaced whole, each region\'s seat of power chosen (a crown first, then the lower key), the Bay\'s untouched; the pixel test made again (mutants: a source never replaced; the power left stale; the pixel test kept)', () => {
  const bay = deriveTownSeats([]);
  bay.powers.set(21, 3021);
  const seats = tamrielSeatsOf({ capitals: [{ key: 900, name: 'Solitude', px: 1600, py: 30, region: 64 }, { key: 901, name: 'Somewhere', px: 1, py: 1, region: 64 }],
    cities: [{ key: 700, name: 'Dragonstar', px: 1500, py: 40, region: 64 }, { key: 600, name: 'Northpoint', px: -40, py: 12, region: 62 }, { key: 650, name: 'Farrun', px: -30, py: 9, region: 62 }, { key: 1, name: 'x'.repeat(49), px: 0, py: 0, region: 62 }]});
  assert.deepEqual(seats.map((s) => [s.key, s.tier, s.kingdom]), [[900, 'crown', 'skyrim'], [700, 'palace', 'skyrim'], [600, 'palace', null], [650, 'palace', null]], 'a crown bearing no capital\'s name and a name the law refuses stand none');
  const atPixel = seatPixelTest(bay);
  assert.equal(atPixel(1600, 30), false);
  replaceSeats(bay, 'tesa', seats);
  assert.equal(seatAtMapId(bay, 900).name, 'Solitude');
  assert.deepEqual([bay.powers.get(64), bay.powers.get(62), bay.powers.get(21)], [900, 600, 3021], 'a crown first, then the lower key; the Bay\'s untouched');
  assert.equal(atPixel(1600, 30), true, 'the pixel test made again');
  assert.equal(bay.list.length, 4);
  replaceSeats(bay, 'tesa', seats.filter((s) => s.key !== 900));
  assert.equal(seatAtMapId(bay, 900), null, 'replaced whole');
  assert.equal(bay.powers.get(64), 700, 'the power chosen again');
  replaceSeats(bay, 'tesa', []);
  assert.deepEqual([bay.list.length, bay.powers.has(64), bay.powers.get(21)], [0, false, 3021]);
});

test('WW7-3 by source: the places module adds the seats past the Bay as it registers the places - each capital\'s centre in its province\'s region, each Arena city-state but a capital\'s pixel\'s - and the host hands it the seats (mutants: the seats never added)', () => {
  const m = rd('src/scenes/tamrielPlacesHost.js');
  assert.match(m, /if \(townSeats\) replaceSeats\(townSeats, 'tesa', tamrielSeatsOf\(seatPlaces\(\)\)\);/);
  assert.match(m, /capitals\.push\(\{ key: capitalPlaceId\(k, 0\), name: CAPITALS\[k\]\.name, px: at\.x, py: at\.y, region: regionOfProvince\(CAPITALS\[k\]\.province\) \}\);/);
  assert.match(m, /filter\(\(p\) => p\.kind === 'city-state' && !capitalOnPixel\(p\.bx, p\.by\)\)/);
  assert.match(rd('src/scenes/world.js'), /townSeats, woodsBytes, worldPlaces,/);
});
