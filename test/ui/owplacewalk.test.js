// OW-PLACE-WALK (2026-10-28, the owner: "ensure travel when clicking a point on the held map properly makes you travel";
// bible/03-World/Arena-Provinces.md OW-PLACE-WALK): a press on a city or a mark past the Bay was handed to the host as a bare
// pixel, and the spot's walk refused Solitude's pixel as the sea. A place is now handed as a place (`place`) and walked to
// as the Overworld walks to a place - by its summary, to its door; a bare spot is walked to as before. A flag past the Bay
// is walked to where its land is (BAY-LEFT-MAPS C2's pin moved, test/ui/bayleft_marks.test.js).
import '../modsOff.js';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { _resetForTests } from '../../src/systems/uiPrefs.js';
import { HeldMapWindow } from '../../src/ui/heldMap.js';
import { ROOT } from '../qlSources.mjs';

const WORLD = readFileSync(join(ROOT, 'src/scenes/world.js'), 'utf8');
afterEach(() => { _resetForTests(); delete globalThis.location; delete globalThis.document; });

/** Solitude's pixel past the Bay, Skyrim's land by the land's own law; and the sea west of Hammerfell. */
const SOLITUDE = { x: 1569, y: -430 };
const LAND = { x: 1600, y: -250 };
const SEA = { x: -300, y: 250 };

/** Just enough document for the held map's chrome (test/ui/owpastbay_walk.test.js's). */
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
/** The travel map with Travel Options and the continent, its Begin caught. */
function heldMap() {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.document = fakeDocument();
  const win = new HeldMapWindow({
    getPlayerPixel: () => ({ x: 5, y: 5 }), getClimateIndex: () => 231, woods: { heightMapBuffer: new Uint8Array(100).fill(10) }, mapSize: { width: 10, height: 10 },
    gold: () => 0, goldPieces: () => 0, hasHorse: false, hasCart: false, hasShip: false, diseaseCount: () => 0, poisonCount: () => 0,
    travelOptions: () => ({ settings: { ...SETTINGS }, destinationName: null, isTravelActive: false }),
  });
  win._tamriel = true;
  win._phase = 'map';
  win.commits = [];
  win._beginClose = (c) => { win.commits.push(c); };
  return win;
}
/** A press at a sheet point mapping to `at`, the continent's answer there `past` (the hover's shape). */
function pressAt(win, at, past) {
  win._view = { ox: at.x, oy: at.y, scale: 1 };
  win._onSheet = () => true;
  win._markerAt = () => null;
  win._questAt = () => null;
  win._pastBayHover = () => past;
  win._pickAt(0.5, 0.5);
}
/** Begin on the open panel: what the host is handed. */
const begin = (win) => { win._confirmDiseased(true); return win.commits.at(-1); };

test('OW-PLACE-WALK the hand-off: Begin on a city, a mark, a quest\'s place or a found place past the Bay hands the host the place (`place`); on bare land past the Bay and on the Bay\'s own spot, a bare pixel as before (mutants: the city a spot again; the pick\'s word dropped; a spot made a place)', () => {
  const city = heldMap();
  pressAt(city, SOLITUDE, { on: 'city', label: 'Solitude', city: { name: 'Solitude', pixel: SOLITUDE } });
  assert.equal(city._panel, 'travel');
  assert.deepEqual(begin(city), { kind: 'coords', pick: { pixel: SOLITUDE, name: 'Solitude', place: true }, opts: city.commits.at(-1).opts });

  const mark = heldMap();
  pressAt(mark, LAND, { on: 'mark', label: 'x', name: 'Ilinalta Deep', pixel: { x: 1590, y: -260 }, city: null });
  assert.deepEqual(begin(mark).pick, { pixel: { x: 1590, y: -260 }, name: 'Ilinalta Deep', place: true });

  const land = heldMap();
  pressAt(land, LAND, { on: 'land', label: 'Skyrim', city: null });
  assert.deepEqual(begin(land).pick, { pixel: LAND, name: 'Map spot 1600, -250' }, 'bare land: the spot, no place');

  const quest = heldMap();
  const qp = quest._questPlace({ px: 1590, py: -260, placeName: 'The Haunt' });
  assert.equal(qp.door, true, 'a quest\'s place past the Bay - PIN MOVED (TRAVEL-EVERYWHERE): walked to its door where the world does not know it (`door`), the Bay\'s journey where it does (`place`, test/ui/travel_everywhere.test.js)');
  quest._select(qp);
  quest._openPanel('travel');
  assert.equal(begin(quest).pick.place, true);

  const found = heldMap();
  found._searchPick({ name: 'Solitude', regionName: 'Skyrim', pos: SOLITUDE, pastBay: true });
  found._openPanel('travel');
  assert.deepEqual(begin(found).pick, { pixel: SOLITUDE, name: 'Solitude', place: true }, 'the find box\'s place');

  const goto = heldMap();
  goto._gotoPlace = { siteDetails: { worldPixel: { x: 1590, y: -260 }, locationName: 'The Haunt' } };
  goto._consumeGotoPlace();
  goto._openPanel('travel');
  assert.deepEqual(begin(goto).pick, { pixel: { x: 1590, y: -260 }, name: 'The Haunt', place: true }, 'the journal\'s place');

  const bay = heldMap();
  bay._view = { ox: 3, oy: 3, scale: 1 };
  bay._onSheet = () => true;
  bay._markerAt = () => null;
  bay._questAt = () => null;
  bay._ensureWorldModel = () => ({ marks: [] });
  bay._pickAt(0.5, 0.5);
  assert.equal(bay._panel, 'travel');
  assert.deepEqual(begin(bay).pick, { pixel: { x: 3, y: 3 }, name: 'Map spot 3, 3' }, 'the Bay\'s spot: unchanged');
});

test('OW-PLACE-WALK the flag: "Travel here" on a flag on the land past the Bay opens the walked panel on its pixel and hands a bare spot; on the sea past the Bay, and on the teleport map, nothing (mutants: the flag held to the Bay; the sea flag walked)', () => {
  const win = heldMap();
  assert.equal(win._flagTravels({ mx: LAND.x + 0.5, my: LAND.y + 0.5 }), true);
  win._waypointTravel({ mx: LAND.x + 0.5, my: LAND.y + 0.5 });
  assert.deepEqual([win._selected?.pastBay, win._selected?.walk, win._panel, win._panelState?.trip?.walked], [true, true, 'travel', true]);
  assert.deepEqual(begin(win), { kind: 'coords', pick: { pixel: LAND, name: 'Map spot 1600, -250' }, opts: win.commits.at(-1).opts });

  const sea = heldMap();
  assert.equal(sea._flagTravels({ mx: SEA.x + 0.5, my: SEA.y + 0.5 }), false, 'the sea is no walk');
  sea._waypointTravel({ mx: SEA.x + 0.5, my: SEA.y + 0.5 });
  assert.equal(sea._selected ?? null, null);

  const armed = heldMap();
  armed.teleportationTravel = true;
  assert.equal(armed._flagTravels({ mx: LAND.x + 0.5, my: LAND.y + 0.5 }), false, 'the teleport map: its portals');
  assert.equal(heldMap()._flagTravels({ mx: 3.5, my: 3.5 }), true, 'a flag on the Bay: as ever');
});

// ── the host, lifted: world.js's coordinates door and its fork ─────────────────────────────────────────────────

/** world.js's own beginAcceleratedTravel and the map's onTravelToCoords, run over stubs that record what they are asked. */
function host({ known = new Map(), sea = new Set() } = {}) {
  const at = WORLD.indexOf('  function beginAcceleratedTravel(');
  assert.ok(at >= 0, 'world.js declares beginAcceleratedTravel');
  const fn = WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
  const coords = /\n\s*onTravelToCoords: (\(pick, opts\) => \{ [^\n]*? \}),/.exec(WORLD);
  assert.ok(coords, 'world.js hands the map onTravelToCoords');
  const h = { asked: [], routed: [], walked: [], said: [], talk: [] };
  const env = {
    travelOptions: { beginTravelToCoords: () => { throw new Error('the Overworld routes it'); }, beginTravel: () => { throw new Error('the Overworld routes it'); } },
    tvRoutesJourneys: () => true, travelViewAllowed: () => ({ ok: true }), travelViewCanGo: () => true,
    tvSay: (l) => h.said.push(l), townTalk: { say: (l) => h.talk.push(l) }, TRAVEL_VIEW_TEXT: { water: 'water' },
    tvPlaceSummary: (x, y, named = false) => { h.asked.push([x, y, named]); const p = known.get(`${x},${y}`); return p && (named || p.known) ? { pixel: { x, y }, name: p.name } : null; },
    travelViewRouteTo: (s, o) => { h.routed.push([s.name, o.roads]); return true; },
    travelViewWalkTo: (point, pix, o) => { h.walked.push([pix.x, pix.y, o.roads]); return true; },
    tvMapForcesRoads: () => true,
    mapPixelToWorldCoords: (x, y) => ({ x: x * 32768, z: y * 32768 }), tvSceneOf: (x, z) => [x, 10, z],
    tvWater: (x, y) => sea.has(`${x},${y}`), tvSeaY: () => 0, TV_SEA_EPS_M: 0.25,
    climbingNow: () => false, wagonRiders: null,
    TEST_GODMODE: false, staffPowers: () => ({ god: false }), teleportTo: () => { throw new Error('no god mode'); },
  };
  const body = `${fn}\nconst onTravelToCoords = ${coords[1]};\nreturn { beginAcceleratedTravel, onTravelToCoords };`;
  return Object.assign(h, new Function(...Object.keys(env), body)(...Object.values(env)));
}

test('OW-PLACE-WALK the host: a place handed as its pixel is the Overworld\'s journey to the place (its summary, asked as the sheet names it), never the spot\'s walk that refused Solitude\'s sea pixel; a place it does not know is walked to as a spot; a bare spot, and a place on the Bay, as before (mutants: the place a spot again; the sheet\'s name unasked; a known place dropped)', () => {
  const SOL = `${SOLITUDE.x},${SOLITUDE.y}`;
  const h = host({ known: new Map([[SOL, { name: 'Solitude', known: false }]]), sea: new Set([SOL]) });
  h.onTravelToCoords({ pixel: SOLITUDE, name: 'Solitude', place: true }, { playerControlled: true });
  assert.deepEqual(h.asked, [[SOLITUDE.x, SOLITUDE.y, true]], 'its summary, asked as the sheet names it');
  assert.deepEqual(h.routed, [['Solitude', true]], 'the place\'s journey, by the roads as a map pick goes');
  assert.deepEqual([h.walked, h.said, h.talk], [[], [], []], 'never the spot\'s walk, never "the water"');

  const unknown = host({ sea: new Set() });
  unknown.onTravelToCoords({ pixel: LAND, name: 'Ilinalta Deep', place: true }, { playerControlled: true });
  assert.deepEqual([unknown.routed, unknown.walked], [[], [[LAND.x, LAND.y, true]]], 'no place there the Overworld knows: the spot');

  const spot = host({ known: new Map([[`${LAND.x},${LAND.y}`, { name: 'Somewhere', known: true }]]) });
  spot.onTravelToCoords({ pixel: LAND, name: 'Map spot 1600, -250' }, { playerControlled: true });
  assert.deepEqual([spot.asked, spot.routed, spot.walked], [[], [], [[LAND.x, LAND.y, true]]], 'a bare spot: never asked as a place');

  const wet = host({ sea: new Set([`${SEA.x},${SEA.y}`]) });
  wet.onTravelToCoords({ pixel: SEA, name: 'x' }, { playerControlled: true });
  assert.deepEqual([wet.walked, wet.said], [[], ['water']], 'a spot on the sea: refused, as ever');

  const bay = host({ known: new Map([['510,250', { name: 'Ripwych', known: true }]]) });
  assert.equal(bay.beginAcceleratedTravel({ pixel: { x: 510, y: 250 }, name: 'Ripwych' }, { playerControlled: true }), true);
  assert.deepEqual([bay.asked, bay.routed], [[[510, 250, false]], [['Ripwych', true]]], 'a place picked on the Bay: its own law, unnamed');
  assert.equal(bay.beginAcceleratedTravel({ pixel: { x: 511, y: 250 }, name: 'x' }, { playerControlled: true }), false, 'no place there: no journey');
});
