// IC-PACE (2026-10-26, the owner: "For the Imperial City specifically, the travel speed should be 60x instead of 5";
// bible/06-Systems/Travel-View.md IC-PACE): a journey through the Imperial City's streets - every one of its 625
// slices (IC-GRAND; TS5's forty-nine) - runs its clock to IMPERIAL_PACE_MAX, where every other town's streets hold it to TOWN_PACE_MAX. The
// streets are still walked as a town's; only the ceiling is the city's own. Pinned on the host's pace (scenes/
// townWalkHost.js paceAt, townPace, townWay), the journey's street (systems/travel/travelOptions.js) and the keys' travel
// (scenes/world.js).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { TOWN_PACE_MAX, IMPERIAL_PACE_MAX } from '../../../src/systems/travel/townWalk.js';
import { createTownWalk, paceAt } from '../../../src/scenes/townWalkHost.js';
import { CAPITALS, capitalPixel, capitalCentrePixel, capitalSpanPixels } from '../../../src/world/tamrielCapitals.js';
import { setTamrielFit } from '../../../src/world/tamriel/tamrielFrame.js';
import { CityNavigation, NAV_CELL } from '../../../src/world/city/cityNavigation.js';
import { createTravelOptions, readTravelOptionsSettings } from '../../../src/systems/travel/travelOptions.js';
import { rectOf } from '../../../src/systems/travel/travelAutopilot.js';
import { TravelControlUI } from '../../../src/ui/travel/travelControlUI.js';
import { modSetting } from '../../../src/systems/modSettings.js';
import { mapPixelWorldOrigin } from '../../../src/systems/travel/travelPaths.js';
import { SCENE_MAP_RATIO } from '../../../src/world/streamingWorld.js';
import { hostText } from '../../hostText.mjs';

afterEach(() => setTamrielFit(null));
const FIT = { ox: 38 * 15.5, oy: 57 * 15.5, ppu: 15.5 };   // the freeware's fit (tesa11_imperial, imperialscale)

test('IC-PACE the ceilings: a town five times a walk, the Imperial City sixty (mutants: the city\'s pace a town\'s)', () => {
  assert.equal(TOWN_PACE_MAX, 5);
  assert.equal(IMPERIAL_PACE_MAX, 60);
});

test('IC-PACE the city\'s own pixels: every one of its 625 slices the city\'s pace; the pixel past its edge, another capital\'s and a town of the Bay a town\'s (mutants: the slices unread; every capital the city\'s)', () => {
  setTamrielFit(FIT);
  const span = capitalSpanPixels(0);
  assert.equal(span.length, 625);   // PIN MOVED (IC-GRAND): twenty-five a side, where TS5 stood it on seven
  for (const { x, y } of span) assert.equal(paceAt(x, y), IMPERIAL_PACE_MAX, `slice (${x}, ${y})`);
  const at = capitalCentrePixel(0);
  assert.equal(paceAt(at.px + 13, at.py), TOWN_PACE_MAX, 'a pixel past its edge');
  const solitude = capitalPixel(CAPITALS.find((c) => c.key === 'solitude'));
  assert.ok(solitude, 'Solitude stands');
  assert.equal(paceAt(solitude.px, solitude.py), TOWN_PACE_MAX, 'another capital\'s');
  assert.equal(paceAt(500, 250), TOWN_PACE_MAX, 'a town of the Bay');
});

/** A town of one block on map pixel (px, py), all of it street: its walk host (scenes/townWalkHost.js). */
function townOn(px, py) {
  const nav = new CityNavigation(1, 1);
  nav.grid.fill(15 << 4);
  const o = mapPixelWorldOrigin(px, py);
  const R = SCENE_MAP_RATIO, t = [0, 0, 0], locOrigin = [o.x / R, 0, o.z / R];
  const state = { pixelTranslation: () => t, localFromWorld: (x, z) => [x / R, z / R], worldCoords: (p) => ({ x: p[0] * R, z: p[2] * R }) };
  const cellAt = (gx, gy) => ({ x: (locOrigin[0] + (gx + 0.5) * NAV_CELL) * R, z: (locOrigin[2] + (gy + 0.5) * NAV_CELL) * R });
  return { cellAt, tw: createTownWalk({ built: new Map([[`${px},${py}`, { population: { nav }, locOrigin, cityGates: [] }]]), state }) };
}

test('IC-PACE the host: a town\'s streets answer its pace, and its way carries it - the Imperial City\'s its own (mutants: the pace the key; the way\'s pace unset)', () => {
  setTamrielFit(FIT);
  const at = capitalCentrePixel(0);
  const ic = townOn(at.px + 1, at.py - 2), bay = townOn(500, 250);
  assert.equal(ic.tw.townPace(ic.cellAt(10, 10)), IMPERIAL_PACE_MAX, 'in the Imperial City');
  assert.equal(bay.tw.townPace(bay.cellAt(10, 10)), TOWN_PACE_MAX, 'in a town of the Bay');
  assert.equal(ic.tw.townKey(ic.cellAt(10, 10)), `${at.px + 1},${at.py - 2}`, 'its key still the pixel\'s');
  assert.equal(ic.tw.townWay(ic.cellAt(10, 10), ic.cellAt(50, 40))?.pace, IMPERIAL_PACE_MAX);
  assert.equal(bay.tw.townWay(bay.cellAt(10, 10), bay.cellAt(50, 40))?.pace, TOWN_PACE_MAX);
});

const mid = (px, py) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + 16384, z: o.z + 16384 }; };
/** The real Travel Options at the dials' top, standing in a town whose way answers `pace` (none: the way of a host
 *  before IC-PACE). */
function journey(pace) {
  const rates = [];
  const ui = new TravelControlUI({ defaultStartingAccel: 100, accelerationLimit: 100 });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  const pos = mid(500, 250);
  const pts = [{ x: pos.x + 400, z: pos.z }, { x: pos.x + 400, z: pos.z + 800 }];
  const to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => pos, mapPixel: () => ({ x: 500, y: 250 }), yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false, localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231, entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => false, diseaseCount: () => 0, say: () => {}, messageBox: () => {},
    setTimeScale: (n) => rates.push(n), now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null, pushWindow: (w) => { w.show(); },
    townKey: () => '500,250', townWay: () => (pace == null ? { pts } : { pts, pace }),
  });
  const legs = [{ x: 501, y: 250, kind: 'road' }, { x: 502, y: 250, kind: 'road' }];
  assert.equal(to.beginTravelAlongRoute({ legs, point: { pixel: { x: 502, y: 250 }, ...mid(502, 250) } }, false, { quiet: true }), true);
  return { to, rate: rates.at(-1) };
}

test('IC-PACE the journey: a street is walked at its own town\'s pace - the Imperial City\'s past a town\'s, never past its own; a way with none a town\'s (mutants: the street\'s pace unread; the city\'s unbounded)', () => {
  const ic = journey(IMPERIAL_PACE_MAX), town = journey(TOWN_PACE_MAX), bare = journey(null);
  assert.equal(ic.to.route.street.pace, IMPERIAL_PACE_MAX);
  assert.equal(ic.rate, IMPERIAL_PACE_MAX, `the Imperial City's streets at its own pace, the dials at their top (x${ic.rate})`);
  assert.equal(journey(20).rate, 20, 'a street\'s pace a ceiling, never passed');
  assert.ok(town.rate <= TOWN_PACE_MAX, `a town's at a town's (x${town.rate})`);
  assert.equal(bare.to.route.street.pace, TOWN_PACE_MAX, 'a way that says none: a town\'s');
  assert.ok(bare.rate <= TOWN_PACE_MAX);
});

test('IC-PACE the host\'s wiring: the keys\' travel held to the pace the town answers, none out of town', () => {
  const w = hostText('src/scenes/world.js');
  assert.match(w, /const tvTownPace = \(\) => townWalk\.townPace\(state\.worldCoords\(player\.pos\)\);/);
  assert.match(w, /const town = tvTownPace\(\) \?\? Infinity;/);
  assert.doesNotMatch(w, /TOWN_PACE_MAX/, 'no town\'s pace of the host\'s own');
});
