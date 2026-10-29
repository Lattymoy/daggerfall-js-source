// TRAVEL-EVERYWHERE (2026-10-28, the owner: "the travel services won't take you to other provinces", then "Like how it
// works in the bay should be how it works everywhere. These tests are outdated"; bible/03-World/Arena-Provinces.md
// TRAVEL-EVERYWHERE). TESA-NO-FAST is retired: a place past the Bay is travelled to as a Bay place is - on the player's own
// map (the Bay's journey, fast travel or Travel Options' walk), on a carriage driver's map (the mod's refusals and fare, a
// driver's trip) and on the teleport map. AUDIT TRAVEL-EVERYWHERE: a place is one only where the world knows it, by the
// one law the Overworld asks (scenes/mapPlacesHost.js tvPlaceSummary - known by its kind, found, or named by a quest), as
// the Bay's map asks discovery; these pins stand the real places host for it. A captain's map keeps the Bay's docks.
import '../modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { CLIMATES, LOCATION_TYPES as T } from '../../src/formats/mapsFile.js';
import { resetTravelMapState } from '../../src/systems/travel/travelMapState.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { readImmersiveTravelSettings, carriageTripCost, IT_POPUP, IT_TEXT, IMMERSIVE_TRAVEL_VENDOR, CAPITAL_MAP_IDS } from '../../src/systems/immersiveTravel.js';
import { calculateTravelTime } from '../../src/systems/travel/travel.js';
import { isPlayerControlledTravel } from '../../src/ui/travel/travelPopUp.js';
import { createMapPlaces } from '../../src/scenes/mapPlacesHost.js';
import { restoreDiscovery, discoverLocation } from '../../src/systems/discovery.js';
import { setPastBayPlaceLaw, pastBayPlaceSummary } from '../../src/world/pastBayPlaces.js';
import { countryPlaceId } from '../../src/world/tamrielCountry.js';
import { lairPlaceId } from '../../src/world/tamrielDungeons.js';
import { capitalOnPixel, setCapitalsStanding } from '../../src/world/tamrielCapitals.js';
import { tamrielInkFor } from '../../src/ui/tamrielInk.js';
import { hostText } from '../hostText.mjs';

beforeEach(() => { restoreDiscovery(null); setPastBayPlaceLaw(null); });

function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} },
      append(...k) { n.children.push(...k); }, remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelectorAll: () => [],
      className: '', textContent: '', id: '', attrs: {}, setAttribute(k, v) { n.attrs[k] = v; },
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  return { createElement: () => node(), getElementById: () => null, head: node(), body: node(), addEventListener() {}, removeEventListener() {} };
}
function withDocument(fn) {
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  try { return fn(); } finally { delete globalThis.document; delete globalThis.location; }
}
function settings(over = {}) {
  const all = { ...Object.fromEntries(Object.entries(MOD_SETTINGS[IMMERSIVE_TRAVEL_VENDOR].keys).map(([k, d]) => [k, d.default])), ...over };
  return readImmersiveTravelSettings((v, k) => (v === 'roads-hazelnut' ? true : all[k]));
}

/** Places past the Bay as the places host reads them (test/scenes/bayleft_places.test.js's shape): a village of Skyrim, a
 *  lair (a kind never known until found), a temple - each its registry row. */
const SKYRIM = 64;
const VILLAGE = { mapId: countryPlaceId(1234), name: 'Dragon Bridge', px: 1222, py: -84, type: T.TownVillage, region: SKYRIM, location: -900, w: 2, h: 2 };
const LAIR = { mapId: lairPlaceId(1234), name: 'Ingmik Barrow', px: 1240, py: -70, type: T.DungeonRuin, region: SKYRIM, location: -901, w: 2, h: 2 };
const TEMPLE = { mapId: countryPlaceId(4321), name: 'Shrine of Mara', px: 1190, py: -80, type: T.ReligionTemple, region: SKYRIM, location: -902, w: 2, h: 2 };
/** The real places host over those rows - it publishes its law to the held map (world/pastBayPlaces.js). */
function standPlaces(rows = [VILLAGE, LAIR, TEMPLE]) {
  const at = new Map(rows.map((r) => [`${r.px},${r.py}`, r]));
  const pq = { rowAt: (px, py) => at.get(`${px},${py}`) ?? null, standAt: () => null };
  return createMapPlaces({ captainLedger: { isCharted: () => false, chartedCount: () => 0 }, etherPlaceClone: () => null, etherSea: false, locationIndex: new Map(), mapDict: new Map(),
    wildActiveNow: () => null, wildHallStand: () => null, provinceQuestPlaces: pq, worldPlaces: null, _locIndexGen: 0 });
}
/** Two capitals the world stands past the Bay. */
function capitals() {
  setCapitalsStanding(true);
  const caps = tamrielInkFor(null).cities.filter((c) => c.capital && c.pixel);
  return { a: caps[0], b: caps[1] };
}
const BAY_HERE = { x: 5, y: 5, mapId: 1, locationType: T.TownVillage, regionIndex: 17 };

function mkWin({ here = BAY_HERE, politic = (x) => (x >= 1000 ? 128 + SKYRIM : 128 + 17), ...extra } = {}) {
  const commits = [];
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: here.x, y: here.y }), getClimateIndex: () => CLIMATES.Mountain,
    woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false,
    diseaseCount: () => 0, poisonCount: () => 0,
    maps: { getPoliticIndex: politic }, itHere: () => here,
    onTravel: (pick, opts, c) => commits.push({ kind: 'travel', pick, opts, c }),
    onTravelToCoords: (pick, opts) => commits.push({ kind: 'coords', pick, opts }),
    onTeleport: (pick) => commits.push({ kind: 'teleport', pick }),
    ...extra,
  });
  win._tamriel = true;
  return { win, commits };
}
/** A press whose continent answer there is `past` (the hover's own shape, ui/tamrielInk.js tamrielHoverAt). */
function pressAt(win, past) {
  const at = past.city?.pixel ?? past.pixel ?? { x: 1300, y: -100 };
  win._view = { ox: at.x, oy: at.y, scale: 1 };
  win._onSheet = () => true;
  win._markerAt = () => null;
  win._questAt = () => null;
  win._portalCityAt = () => (win.teleportationTravel ? past.city ?? null : null);
  win._pastBayHover = () => past;
  win._pickAt(0.5, 0.5);
}
const markPress = (r) => ({ on: 'mark', label: r.name, name: r.name, pixel: { x: r.px, y: r.py }, city: null });
const cityPress = (c) => ({ on: 'city', label: c.name, city: c });
const begin = (win) => { win._begin(); win._fireCommit(); };
const TO_WALKS = { settings: { shipTravelPortsOnly: true, targetCoordsAllowed: true, cautiousTravel: true, stopAtInnsTravel: true, cautiousTravelMultiplier: 0.8, recklessTravelMultiplier: 1, teleportCost: false }, destinationName: null, isTravelActive: false };

test('TRAVEL-EVERYWHERE the player\'s own map: a place past the Bay the world knows is a place, billed and begun as a Bay place - DFU\'s fast travel without Travel Options, Travel Options\' walked fork with it - never the coordinates walk; a place the world does not know (an unfound lair) is OW-PAST-BAY\'s walk to it, never a journey the host cannot route (AUDIT TRAVEL-EVERYWHERE 1, 2) (mutants: the place a walk again; the commit the coordinates\'; the bill walked; the law unasked; the unknown a place)', () => {
  resetTravelMapState();
  withDocument(() => {
    standPlaces();
    const { win, commits } = mkWin();
    pressAt(win, markPress(VILLAGE));
    assert.deepEqual([win._selected?.place, win._selected?.walk, win._selected?.town, win._panel], [true, false, { locationType: T.TownVillage, capital: false, named: false }, 'travel'], 'a village: known by its kind');
    const st = win._panelState;
    const t = calculateTravelTime(BAY_HERE, { x: VILLAGE.px, y: VILLAGE.py }, { ...st.opts, hasHorse: false, hasCart: false }, () => CLIMATES.Mountain);
    assert.equal(st.trip.minutes, t.minutes, 'DFU\'s own bill to its pixel');
    assert.ok(!st.trip.walked, 'fast travel, as a Bay place without Travel Options');
    begin(win);
    assert.deepEqual([commits[0]?.kind, commits[0]?.pick.pixel, commits[0]?.pick.name, commits[0]?.opts.playerControlled, commits[0]?.pick.place], ['travel', { x: VILLAGE.px, y: VILLAGE.py }, 'Dragon Bridge', false, true], 'the place\'s journey (world.js onTravel), never onTravelToCoords');

    // Travel Options' fork decides, as on the Bay: here it walks (cautious, inns stopped, the ship knocked off off a port)
    const w2 = mkWin({ travelOptions: () => TO_WALKS });
    pressAt(w2.win, markPress(TEMPLE));
    const opts = { ...w2.win._panelState.opts };
    assert.equal(isPlayerControlledTravel(TO_WALKS.settings, opts), true, 'the fork walks it');
    assert.equal(w2.win._panelState.trip.walked, true, 'billed walked, as a Bay place');
    begin(w2.win);
    assert.deepEqual([w2.commits[0]?.kind, w2.commits[0]?.opts.playerControlled], ['travel', true], 'Travel Options\' walked journey to a place');
    const FAST = { ...TO_WALKS, settings: { ...TO_WALKS.settings, stopAtInnsTravel: false } };
    const w5 = mkWin({ travelOptions: () => FAST });
    pressAt(w5.win, markPress(TEMPLE));
    assert.equal(isPlayerControlledTravel(FAST.settings, { ...w5.win._panelState.opts }), false, 'the fork rides it (inns, not stopped at)');
    assert.ok(!w5.win._panelState.trip.walked, 'billed as fast travel, as a Bay place - a place is no bare pixel');
    begin(w5.win);
    assert.deepEqual([w5.commits[0]?.kind, w5.commits[0]?.opts.playerControlled], ['travel', false]);

    // an unfound lair: no place - with Travel Options the walk to its pixel by its name, without it nothing
    const w3 = mkWin({ travelOptions: () => TO_WALKS });
    pressAt(w3.win, markPress(LAIR));
    assert.deepEqual([w3.win._selected?.place, w3.win._selected?.walk, w3.win._selected?.name], [false, true, 'Ingmik Barrow']);
    begin(w3.win);
    assert.equal(w3.commits[0]?.kind, 'coords', 'the walk (world.js onTravelToCoords)');
    const w4 = mkWin();
    pressAt(w4.win, markPress(LAIR));
    assert.equal(w4.win._selected ?? null, null, 'no Travel Options: an unknown place is no destination, as on the Bay');
    w4.win._view = { ox: LAIR.px, oy: LAIR.py, scale: 1 };
    assert.equal(w4.win._hoverLabel(0.5, 0.5)?.cursor ?? '', '', 'and no pointer over it');
    discoverLocation(LAIR.mapId, { locationName: LAIR.name });
    pressAt(w4.win, markPress(LAIR));
    assert.equal(w4.win._selected?.place, true, 'found: a place');
  });
});

test('TRAVEL-EVERYWHERE a quest\'s place past the Bay is a place by its naming, and the pick says so to the host (OW-PLACE-WALK\'s `place`), whose Overworld route and Travel Options\' summary ask the law by it (AUDIT TRAVEL-EVERYWHERE 1, 5) (mutants: the goto unnamed; the quest unnamed; Travel Options by the pick)', () => {
  withDocument(() => {
    standPlaces();
    const { win, commits } = mkWin({ travelOptions: () => TO_WALKS });
    win.gotoPlace({ siteDetails: { regionIndex: SKYRIM, regionName: 'Skyrim', locationName: LAIR.name, worldPixel: { x: LAIR.px, y: LAIR.py } } });
    win._consumeGotoPlace();
    assert.deepEqual([win._selected?.place, win._selected?.town?.named, win._panel], [true, true, 'travel'], 'the journal\'s find: a place, its journey open');
    begin(win);
    assert.deepEqual([commits[0]?.kind, commits[0]?.pick.place], ['travel', true]);
    assert.equal(pastBayPlaceSummary(LAIR.px, LAIR.py), null, 'unfound');
    assert.equal(pastBayPlaceSummary(LAIR.px, LAIR.py, true)?.name, LAIR.name, 'named');
    const W = hostText('src/scenes/world.js');
    assert.match(W, /const summary = !coords \|\| pick\.place \? tvPlaceSummary\(pick\.pixel\.x, pick\.pixel\.y, !!pick\.place\) : null;/, 'the Overworld\'s route asks it by the pick\'s word');
    assert.match(W, /\} : tvPlaceSummary\(pick\.pixel\.x, pick\.pixel\.y, !!pick\.place\) \?\? pick, !!opts\?\.speedCautious, estimateMinutes\);/, 'Travel Options\' journey past the Bay goes by the place\'s own summary, which stands it');
    assert.match(hostText('src/scenes/mapPlacesHost.js'), /setPastBayPlaceLaw\(tvPlaceSummary\);/, 'the host publishes its one law');
  });
});

test('TRAVEL-EVERYWHERE a carriage driver\'s map: a town past the Bay is the driver\'s, refused by the mod\'s own laws (its type; with RegionLockedCarriages its region, capital to capital both ways - a capital past the Bay where the player stands too) and billed by its calculator; Begin is a driver\'s trip to its pixel - and a captain\'s map picks nothing there (AUDIT TRAVEL-EVERYWHERE 4) (mutants: the driver\'s press dropped; the type unasked; the region unread; the capital lost; here\'s capital unread; the commit not a driver\'s)', () => {
  resetTravelMapState();
  withDocument(() => {
    standPlaces();
    const s = settings({ 'AllowedDestinations.Temples': false });
    const { win, commits } = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: s } });
    pressAt(win, markPress(VILLAGE));
    assert.deepEqual([win._selected?.place, win._panel, win._itRefusal ?? null], [true, 'travel', null], 'a village: the driver takes the player');
    const st = win._panelState;
    assert.equal(st.it, IT_POPUP.carriage);
    const t = calculateTravelTime(BAY_HERE, { x: VILLAGE.px, y: VILLAGE.py }, { ...st.opts, hasHorse: false, hasCart: false }, () => CLIMATES.Mountain);
    assert.equal(st.trip.totalCost, carriageTripCost(t.minutes, t.oceanPixels, st.opts, s).totalCost, 'the mod\'s fare');
    begin(win);
    assert.deepEqual([commits[0]?.kind, commits[0]?.opts.immersive, commits[0]?.pick.pixel], ['travel', IT_POPUP.carriage, { x: VILLAGE.px, y: VILLAGE.py }], 'a driver\'s trip (world.js fastTravelTo)');

    const temple = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: s } });
    pressAt(temple.win, markPress(TEMPLE));
    assert.deepEqual([temple.win._panel ?? null, temple.win._itRefusal], [null, IT_TEXT.wrongType], 'a temple, the driver\'s type refused: the mod\'s box, no panel');

    // region-locked: a Bay village's driver keeps to its region; a capital's goes capital to capital - either way
    const { a, b } = capitals();
    const capRow = (c, location) => ({ mapId: c.mapId, name: c.name, px: c.pixel.x, py: c.pixel.y, type: T.TownCity, region: SKYRIM, location, w: 5, h: 5 });
    standPlaces([VILLAGE, LAIR, TEMPLE, capRow(a, -903), capRow(b, -904)]);
    try {
      assert.ok(a && b && capitalOnPixel(a.pixel.x, a.pixel.y) && capitalOnPixel(b.pixel.x, b.pixel.y), 'two capitals stand past the Bay');
      const locked = settings({ 'General.RegionLockedCarriages': true });
      const lk = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: locked } });
      pressAt(lk.win, markPress(VILLAGE));
      assert.equal(lk.win._itRefusal, IT_TEXT.regionLocked, 'Skyrim is not the region beside a Bay village');
      const capHere = { ...BAY_HERE, mapId: CAPITAL_MAP_IDS[0] };
      const cap = mkWin({ here: capHere, immersive: { kind: IT_POPUP.carriage, settings: locked } });
      pressAt(cap.win, cityPress(a));
      assert.deepEqual([cap.win._selected?.town?.capital, cap.win._panel, cap.win._itRefusal ?? null], [true, 'travel', null], `a Bay capital to ${a.name}, a capital`);
      const fromA = { x: a.pixel.x, y: a.pixel.y, mapId: 0, locationType: T.TownCity, regionIndex: SKYRIM };
      // the two capitals in two provinces: the politic map parts them halfway
      const mid = (a.pixel.x + b.pixel.x) / 2, side = (x) => ((x < mid) === (a.pixel.x < mid) ? 128 + SKYRIM : 128 + 70);
      const back = mkWin({ here: fromA, politic: side, immersive: { kind: IT_POPUP.carriage, settings: locked } });
      pressAt(back.win, cityPress(b));
      assert.deepEqual([back.win._panel, back.win._itRefusal ?? null], ['travel', null], `${a.name} to ${b.name}: capital to capital from past the Bay, another province`);
      const backVillage = mkWin({ here: { ...fromA, x: a.pixel.x, y: a.pixel.y }, politic: (x, y) => (x === VILLAGE.px && y === VILLAGE.py ? 128 + 70 : 128 + SKYRIM), immersive: { kind: IT_POPUP.carriage, settings: locked } });
      pressAt(backVillage.win, markPress(VILLAGE));
      assert.equal(backVillage.win._itRefusal, IT_TEXT.capitalOnly, `${a.name} to a village of another region: the capital's own refusal`);
      const capVillage = mkWin({ here: capHere, immersive: { kind: IT_POPUP.carriage, settings: locked } });
      pressAt(capVillage.win, markPress(VILLAGE));
      assert.equal(capVillage.win._itRefusal, IT_TEXT.capitalOnly, 'from a capital, a village of another region: its capital first');
    } finally { setCapitalsStanding(false); }

    const sea = mkWin({ immersive: { kind: IT_POPUP.seafarer, settings: s } });
    pressAt(sea.win, markPress(VILLAGE));
    assert.equal(sea.win._selected ?? null, null, 'a captain\'s map: the Bay\'s docks alone');
  });
});

test('TRAVEL-EVERYWHERE the player\'s own map under Disable Normal Travel refuses a place past the Bay as it refuses a Bay place; the teleport map takes a known place as a portal\'s end and an unknown one as none (AUDIT TRAVEL-EVERYWHERE 2, 3) (mutants: the player\'s refusal skipped; the mark no portal\'s end; the unknown mark a portal\'s end)', () => {
  withDocument(() => {
    standPlaces();
    const dnt = settings({ 'General.DisableNormalTravel': true, Enabled: true });
    const { win } = mkWin({ immersiveSettings: () => dnt });
    pressAt(win, markPress(VILLAGE));
    assert.deepEqual([win._panel ?? null, win._itRefusal], [null, IT_TEXT.mustTakeCarriage]);

    const armed = mkWin();
    armed.win.teleportationTravel = true;
    pressAt(armed.win, markPress(TEMPLE));
    assert.deepEqual([armed.win._selected?.name, armed.win._selected?.x, armed.win._panel], [TEMPLE.name, TEMPLE.px + 0.5, 'teleport'], 'a known place: a portal\'s end');
    const lair = mkWin();
    lair.win.teleportationTravel = true;
    pressAt(lair.win, markPress(LAIR));
    assert.deepEqual([lair.win._selected ?? null, lair.win._panel ?? null], [null, null], 'an unfound lair: none, as an undiscovered Bay place');
  });
});
