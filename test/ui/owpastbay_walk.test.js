// OW-PAST-BAY (2026-10-28, the player: "Youre not able to click on the map outside of the bay and travel to locations" -
// "Im talking about clicking on the map to overworld travel"; bible/03-World/Arena-Provinces.md OW-PAST-BAY): on the
// travel map a press past the Bay is a WALK there - Travel Options' coordinates journey, the Overworld's on the enhanced
// interface. TRAVEL-EVERYWHERE (test/ui/travel_everywhere.test.js): a place the world knows is a place's journey, so the
// walk is bare land's and an unknown place's. The teleport map keeps its portals; a sheet without Travel Options or the
// continent walks nowhere.
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { _resetForTests } from '../../src/systems/uiPrefs.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { tamrielHoverAt } from '../../src/ui/tamrielInk.js';
import { ROOT } from '../qlSources.mjs';

const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
afterEach(() => { _resetForTests(); delete globalThis.location; delete globalThis.document; });

/** Skyrim, north-east of the Bay's table. */
const PAST = { x: 1203, y: -88 };

/** Just enough document for the held map's chrome (test/systems/starts/start3_pastbay_marks.test.js's). */
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
const SETTINGS = { shipTravelPortsOnly: false, targetCoordsAllowed: true, cautiousTravel: true, stopAtInnsTravel: false, cautiousTravelMultiplier: 0.8, recklessTravelMultiplier: 1, teleportCost: false };
function heldMap({ to = true, coords = true } = {}) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  const mod = { settings: { ...SETTINGS, targetCoordsAllowed: coords }, destinationName: null, isTravelActive: false };
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    ...(to ? { travelOptions: () => mod } : {}),
  });
  win._tamriel = true;
  return win;
}
/** The press at a sheet point that maps to `at`, with the continent's answer there `past` (the hover's shape). */
function pressAt(win, at, past) {
  win._view = { ox: at.x, oy: at.y, scale: 1 };
  win._onSheet = () => true;
  win._markerAt = () => null;
  win._questAt = () => null;
  win._pastBayHover = () => past;
  win._pickAt(0.5, 0.5);
}

test('OW-PAST-BAY the press: on the travel map bare land past the Bay is a walk to its pixel, a city or a mark its own pixel by its name (PIN MOVED, TRAVEL-EVERYWHERE: a place\'s journey, test/ui/travel_everywhere.test.js); the panel opens a walked trip with no fare, and Begin hands the host a coordinates journey (mutants: the press dropped; the mark unpicked or pixel-less; the pick never walks)', () => {
  const win = heldMap();
  let commit = null;
  win._beginClose = (c) => { commit = c; };
  pressAt(win, PAST, { on: 'land', label: 'Skyrim', city: null });
  assert.equal(win._selected?.pastBay, true);
  assert.equal(win._selected?.walk, true, 'a walk past the Bay');
  assert.deepEqual([win._selected.x, win._selected.y], [PAST.x + 0.5, PAST.y + 0.5]);
  assert.equal(win._panel, 'travel', 'the travel panel opens');
  assert.equal(win._panelState.trip.walked, true, 'walked, never fast travel');
  assert.ok(Number.isFinite(win._panelState.trip.walkedMinutes), 'an estimate the card can show');
  win._confirmDiseased(true);
  assert.equal(commit?.kind, 'coords', 'Begin: the coordinates journey (world.js onTravelToCoords)');
  assert.deepEqual(commit.pick.pixel, PAST);
  assert.equal(commit.opts.playerControlled, true);

  const city = heldMap();
  pressAt(city, { x: PAST.x + 0.3, y: PAST.y }, { on: 'city', label: 'Solitude', city: { name: 'Solitude', pixel: { x: 1210, y: -90 } } });
  assert.deepEqual([city._selected?.name, city._selected?.x, city._panel, city._selected?.walk], ['Solitude', 1210.5, 'travel', true], 'a city the world does not know: a walk to its pixel, by its name');
  city.deps.pastBayPlace = () => ({ locationType: 0 });   // the world's law knows it (a city, LOCATION_TYPES 0): TRAVEL-EVERYWHERE's place
  pressAt(city, { x: PAST.x + 0.3, y: PAST.y }, { on: 'city', label: 'Solitude', city: { name: 'Solitude', pixel: { x: 1210, y: -90 } } });
  assert.deepEqual([city._selected?.place, city._panel], [true, 'travel'], 'a city it knows: a place');
  // the hover's own mark answer carries the pixel the press walks to (ui/tamrielInk.js tamrielHoverAt)
  const placesIn = () => [{ x: 1190, y: -80, type: 8, name: 'Ilinalta Deep' }];
  const at = tamrielHoverAt(1190.5, -79.5, { ox: 0, oy: 0, scale: 8 }, null, { placesIn, band: 'near', filters: {} });
  assert.deepEqual([at?.on, at?.name, at?.pixel], ['mark', 'Ilinalta Deep', { x: 1190, y: -80 }]);
  const mark = heldMap();
  pressAt(mark, PAST, { on: 'mark', label: 'x', name: 'Ilinalta Deep', pixel: { x: 1190, y: -80 }, city: null });
  assert.deepEqual([mark._selected?.name, mark._selected?.y, mark._panel], ['Ilinalta Deep', -79.5, 'travel'], 'a mark: its pixel, its name');
});

test('OW-PAST-BAY what walks nowhere: the sea; bare land where the mod allows no bare pixel (a city still walks); a sheet without Travel Options (bare land); the teleport map (its portals TESA2\'s); a sheet without the continent (mutants: the sea walked; the coordinates law skipped; the teleport map walked)', () => {
  const sea = heldMap();
  pressAt(sea, PAST, { on: 'sea', label: 'the Sea of Ghosts', city: null });
  assert.equal(sea._selected ?? null, null, 'the sea is no walk');
  assert.equal(sea._pastBayPick(PAST.x, PAST.y, 'x', null).walk, true, 'bare land walks');

  const noCoords = heldMap({ coords: false });
  pressAt(noCoords, PAST, { on: 'land', label: 'Skyrim', city: null });
  assert.equal(noCoords._selected ?? null, null, 'Travel Options travels only to places');
  pressAt(noCoords, PAST, { on: 'city', label: 'Solitude', city: { name: 'Solitude', pixel: { x: 1210, y: -90 } } });
  assert.equal(noCoords._panel, 'travel', 'a place still walks');

  const noMod = heldMap({ to: false });
  assert.equal(noMod._pastBayPick(PAST.x, PAST.y, 'x', null).walk, false, 'no Travel Options: nothing walks bare land, as on the Bay');
  noMod._select(noMod._pastBayPick(PAST.x, PAST.y, 'x', null));
  noMod._openPanel('travel');
  assert.equal(noMod._panel ?? null, null, 'and the panel stays shut');

  const armed = heldMap();
  armed.teleportationTravel = true;
  assert.equal(armed._walksPastBay(), false, 'the teleport map is the portals\' (TESA2, PORTAL-ANYWHERE)');

  const flat = heldMap();
  flat._tamriel = false;
  assert.equal(flat._walksPastBay(), false, 'no continent on the sheet');
});

test('OW-PAST-BAY the host walks it: a coordinates pick on the enhanced interface is the Overworld\'s walk (travelViewWalkTo), and the walk asks no gate past the Bay - the gate is the fast journeys\' (fastTravelTo) alone', () => {
  const W = rd('src/scenes/world.js');
  const fn = W.slice(W.indexOf('  function beginAcceleratedTravel('), W.indexOf('\n  }\n', W.indexOf('  function beginAcceleratedTravel(')));
  assert.match(fn, /return travelViewWalkTo\(at, pick\.pixel, \{ roads: tvMapForcesRoads\(\) \}\);/);
  assert.doesNotMatch(fn, /wildTravelGate|pastBayJourney/);
  assert.match(W, /onTravelToCoords: \(pick, opts\) => \{[^\n]*beginAcceleratedTravel\(pick, opts, \{ coords: true \}\)/);
});
