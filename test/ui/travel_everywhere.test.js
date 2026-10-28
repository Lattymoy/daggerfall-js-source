// TRAVEL-EVERYWHERE (2026-10-28, the owner: "the travel services won't take you to other provinces", then "Like how it
// works in the bay should be how it works everywhere. These tests are outdated"; bible/03-World/Arena-Provinces.md
// TRAVEL-EVERYWHERE). TESA-NO-FAST is retired: a place past the Bay is travelled to as a Bay place is - on the player's own
// map (the Bay's journey, fast travel or Travel Options' walk), on a carriage driver's map (the mod's refusals and fare, a
// driver's trip) and on the teleport map (a countryside place a portal's end too). A captain's map keeps the Bay's docks.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { CLIMATES, LOCATION_TYPES as T } from '../../src/formats/mapsFile.js';
import { resetTravelMapState } from '../../src/systems/travel/travelMapState.js';
import { MOD_SETTINGS } from '../../src/systems/modSettings.js';
import { readImmersiveTravelSettings, carriageTripCost, IT_POPUP, IT_TEXT, IMMERSIVE_TRAVEL_VENDOR, CAPITAL_MAP_IDS } from '../../src/systems/immersiveTravel.js';
import { calculateTravelTime } from '../../src/systems/travel/travel.js';
import { tamrielCityType, tamrielInkFor } from '../../src/ui/tamrielInk.js';
import { setCapitalsStanding } from '../../src/world/tamrielCapitals.js';
import { isPlayerControlledTravel } from '../../src/ui/travel/travelPopUp.js';

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

/** Solitude's pixel in Skyrim, a village by it, and a province's region past the Bay's 62 (WW-R). */
const SOLITUDE = { name: 'Solitude', pixel: { x: 1210, y: -90 }, capital: true, kind: 'city-state' };
const VILLAGE = { name: 'Dragon Bridge', pixel: { x: 1222, y: -84 }, capital: false, kind: 'village' };
const SKYRIM = 64;
const BAY_HERE = { x: 5, y: 5, mapId: 1, locationType: T.TownVillage, regionIndex: 17 };

function mkWin({ here = BAY_HERE, politic = (x) => (x >= 1000 ? 128 + SKYRIM : 128 + 17), ...extra } = {}) {
  const commits = [];
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: here.x, y: here.y }), getClimateIndex: () => CLIMATES.Mountain,
    woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 1e6, goldPieces: () => 1e6, hasHorse: false, hasCart: false, hasShip: false,
    diseaseCount: () => 0, poisonCount: () => 0,
    maps: { getPoliticIndex: (x, y) => politic(x, y) }, itHere: () => here,
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
const cityPress = (c) => ({ on: 'city', label: c.name, city: c });
const begin = (win) => { win._begin(); win._fireCommit(); };

test('TRAVEL-EVERYWHERE the player\'s own map: a city past the Bay is a place, billed and begun as a Bay place - DFU\'s fast travel without Travel Options, Travel Options\' fork with it - never the coordinates walk; bare land is still OW-PAST-BAY\'s walk (mutants: the city a walk again; the commit the coordinates\'; the bill walked)', () => {
  resetTravelMapState();
  withDocument(() => {
    const { win, commits } = mkWin();
    pressAt(win, cityPress(SOLITUDE));
    assert.deepEqual([win._selected?.place, win._selected?.walk, win._selected?.town, win._panel], [true, false, { locationType: T.TownCity, capital: true }, 'travel']);
    const st = win._panelState;
    const t = calculateTravelTime(BAY_HERE, SOLITUDE.pixel, { ...st.opts, hasHorse: false, hasCart: false }, () => CLIMATES.Mountain);
    assert.equal(st.trip.minutes, t.minutes, 'DFU\'s own bill to its pixel');
    assert.ok(!st.trip.walked, 'fast travel, as a Bay place without Travel Options');
    begin(win);
    assert.equal(commits.length, 1);
    assert.equal(commits[0].kind, 'travel', 'the place\'s journey (world.js onTravel), never onTravelToCoords');
    assert.deepEqual([commits[0].pick.pixel, commits[0].pick.name, commits[0].opts.playerControlled], [SOLITUDE.pixel, 'Solitude', false]);

    // with Travel Options its own fork decides, as on the Bay: cautious with its cautious law walks
    const to = { settings: { shipTravelPortsOnly: false, targetCoordsAllowed: true, cautiousTravel: true, stopAtInnsTravel: false, cautiousTravelMultiplier: 0.8, recklessTravelMultiplier: 1, teleportCost: false }, destinationName: null, isTravelActive: false };
    const w2 = mkWin({ travelOptions: () => to });
    pressAt(w2.win, cityPress(VILLAGE));
    assert.equal(w2.win._selected?.place, true);
    const opts = { ...w2.win._panelState.opts };
    assert.equal(w2.win._panelState.trip.walked, isPlayerControlledTravel(to.settings, opts) || undefined, 'billed by the fork, as a Bay place');
    begin(w2.win);
    assert.equal(w2.commits[0]?.kind, 'travel', 'Travel Options\' journey to a place');
    assert.equal(w2.commits[0].opts.playerControlled, isPlayerControlledTravel(to.settings, opts), 'the fork\'s own word, as on the Bay');
    const w3 = mkWin({ travelOptions: () => to });
    pressAt(w3.win, { on: 'land', label: 'Skyrim', city: null, pixel: { x: 1300, y: -100 } });
    assert.deepEqual([w3.win._selected?.walk, w3.win._selected?.place], [true, false], 'bare land: the walk');
  });
});

test('TRAVEL-EVERYWHERE a carriage driver\'s map: a town past the Bay is the driver\'s, refused by the mod\'s own laws (its type; with RegionLockedCarriages its region, capital to capital) and billed by its calculator; Begin is a driver\'s trip to its pixel - and a captain\'s map picks nothing there (mutants: the driver\'s press dropped; the type unasked; the region unread; the capital lost; the commit not a driver\'s)', () => {
  resetTravelMapState();
  withDocument(() => {
    const s = settings();
    const { win, commits } = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: s } });
    pressAt(win, cityPress(VILLAGE));
    assert.deepEqual([win._selected?.place, win._panel, win._itRefusal ?? null], [true, 'travel', null], 'a village: the driver takes the player');
    const st = win._panelState;
    assert.equal(st.it, IT_POPUP.carriage);
    const t = calculateTravelTime(BAY_HERE, VILLAGE.pixel, { ...st.opts, hasHorse: false, hasCart: false }, () => CLIMATES.Mountain);
    assert.equal(st.trip.totalCost, carriageTripCost(t.minutes, t.oceanPixels, st.opts, s).totalCost, 'the mod\'s fare');
    begin(win);
    assert.deepEqual([commits[0]?.kind, commits[0]?.opts.immersive, commits[0]?.pick.pixel], ['travel', IT_POPUP.carriage, VILLAGE.pixel], 'a driver\'s trip (world.js fastTravelTo)');

    // a countryside mark of a type the driver refuses (a labyrinth): the mod's box, no panel
    const lair = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: s } });
    pressAt(lair.win, { on: 'mark', label: 'x', name: 'The Haunt', pixel: { x: 1240, y: -70 }, type: T.DungeonLabyrinth, city: null });
    assert.deepEqual([lair.win._panel ?? null, lair.win._itRefusal], [null, IT_TEXT.wrongType]);

    // region-locked: a Bay village's driver keeps to its region; a capital's goes capital to capital
    const locked = settings({ 'General.RegionLockedCarriages': true });
    const lk = mkWin({ immersive: { kind: IT_POPUP.carriage, settings: locked } });
    pressAt(lk.win, cityPress(VILLAGE));
    assert.equal(lk.win._itRefusal, IT_TEXT.regionLocked, 'Skyrim is not the region beside a Bay village');
    const capHere = { ...BAY_HERE, mapId: CAPITAL_MAP_IDS[0] };
    const cap = mkWin({ here: capHere, immersive: { kind: IT_POPUP.carriage, settings: locked } });
    pressAt(cap.win, cityPress(SOLITUDE));
    assert.deepEqual([cap.win._panel, cap.win._itRefusal ?? null], ['travel', null], 'a capital to Solitude, a capital');
    const capVillage = mkWin({ here: capHere, immersive: { kind: IT_POPUP.carriage, settings: locked } });
    pressAt(capVillage.win, cityPress(VILLAGE));
    assert.equal(capVillage.win._itRefusal, IT_TEXT.capitalOnly, 'from a capital, a village of another region: its capital first');
    const inSkyrim = mkWin({ here: { x: 1215, y: -88, mapId: 0, locationType: T.TownVillage, regionIndex: SKYRIM }, immersive: { kind: IT_POPUP.carriage, settings: locked } });
    pressAt(inSkyrim.win, cityPress(VILLAGE));
    assert.deepEqual([inSkyrim.win._panel, inSkyrim.win._itRefusal ?? null], ['travel', null], 'inside Skyrim: its own region');

    const sea = mkWin({ immersive: { kind: IT_POPUP.seafarer, settings: s } });
    pressAt(sea.win, cityPress(SOLITUDE));
    assert.equal(sea.win._selected ?? null, null, 'a captain\'s map: the Bay\'s docks alone');
  });
});

test('TRAVEL-EVERYWHERE the player\'s own map under Disable Normal Travel refuses a town past the Bay as it refuses a Bay town; the teleport map takes a countryside place as a portal\'s end; a quest\'s place past the Bay of no type read is a place (mutants: the player\'s refusal skipped; the mark no portal\'s end)', () => {
  withDocument(() => {
    const dnt = settings({ 'General.DisableNormalTravel': true, Enabled: true });
    const { win } = mkWin({ immersiveSettings: () => dnt });
    pressAt(win, cityPress(SOLITUDE));
    assert.deepEqual([win._panel ?? null, win._itRefusal], [null, IT_TEXT.mustTakeCarriage]);

    const armed = mkWin();
    armed.win.teleportationTravel = true;
    pressAt(armed.win, { on: 'mark', label: 'x', name: 'Ilinalta Deep', pixel: { x: 1190, y: -80 }, type: T.HomeFarms, city: null });
    assert.deepEqual([armed.win._selected?.name, armed.win._selected?.x, armed.win._panel], ['Ilinalta Deep', 1190.5, 'teleport']);

    const q = mkWin();
    const pick = q.win._pastBayPick(1240, -70, 'The Haunt');
    assert.deepEqual([pick.place, pick.portal, pick.town], [true, true, { locationType: null, capital: false }]);
    // a named place the sheet can read: a capital it inks, a village the roads' regions laid
    setCapitalsStanding(true);
    try {
      const cap = tamrielInkFor(null).cities.find((c) => c.pixel && c.capital);
      assert.deepEqual(q.win._pastBayPick(cap.pixel.x, cap.pixel.y, cap.name).town, { locationType: T.TownCity, capital: true }, `${cap.name}: a capital`);
    } finally { setCapitalsStanding(false); }
    const laid = mkWin({ tamrielPlacesIn: (x0, y0) => [{ x: x0, y: y0, type: T.TownVillage }] });
    assert.deepEqual(laid.win._pastBayPick(1240, -70, 'Stonehills').town, { locationType: T.TownVillage, capital: false }, 'a village the roads laid');
    assert.equal(tamrielCityType(SOLITUDE), T.TownCity);
    assert.equal(tamrielCityType(VILLAGE), T.TownVillage);
  });
});
