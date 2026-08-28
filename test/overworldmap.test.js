// U61 - THE OVERWORLD, pinned.
//
// The relief and the flight are presentation; everything the player
// COMMITS to is law, and every law here is held against the owning
// module's own answer rather than a copied number: the walk against
// calculateTravelTime, the buckets against getPixelColorIndex, the
// trip against calculateTravelTime/calculateTripCost, the envelope
// against travelMapState. The DOM/GL halves are source sweeps plus
// tools/overworldProbe.mjs in a real browser; node drives the window
// through a stub document the way the door tests always have.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  walkTravelPath, calculateTravelTime, calculateTripCost, travelDays,
} from '../src/systems/travel.js';
import {
  buildOverworldGrid, buildMarkerModel, routePoints, overworldHeight, overworldTint,
  isWaterPixel, OVERWORLD_SEA_LEVEL, OVERWORLD_RELIEF,
  OVERWORLD_DOT_COLORS, OVERWORLD_DOT_SIZES, OVERWORLD_CLIMATE_COLORS,
} from '../src/ui/overworldModel.js';
import { createTravelMapWindow, travelMapDoorReady } from '../src/ui/travelMapDoor.js';
import { OverworldMapWindow } from '../src/ui/overworldMap.js';
import { getPixelColorIndex } from '../src/ui/travelMapWindow.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { SCALED_OCEAN_ELEVATION } from '../src/world/terrainSampler.js';
import {
  travelMapFilters, travelMapPopUpState, setTravelMapPopUpState,
  travelMapSaveData, resetTravelMapState,
} from '../src/systems/travelMapState.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

beforeEach(() => resetTravelMapState());

// ── THE WALK IS THE LAW'S OWN ────────────────────────────────────

test('U61: walkTravelPath is exactly the calculator\'s pixel sequence', () => {
  // The travel.test.js pin restated over the WALK: 10 east 4 north is
  // exactly 10 moves - the classic longest-axis stepper, not Bresenham.
  const path = walkTravelPath({ x: 0, y: 0 }, { x: 10, y: -4 });
  assert.equal(path.length, 10, 'exactly max(|dx|,|dy|) moves');
  // `inc > adx`, strictly - so THIS diagonal lands a pixel shy of the
  // destination, which is the classic stepper's own truth and the pin
  // that dies under a >= "fix": with >= the walk ends at y=-4.
  assert.deepEqual(path[path.length - 1], { x: 10, y: -3 },
    'the strict > comparison is load-bearing');
  assert.ok(!path.some((p) => p.x === 0 && p.y === 0), 'the start pixel is never charged');

  // The Y-MAJOR arm, pinned by literal - the review found every
  // coordinate pin above runs the x-major branch, leaving the whole
  // `furthest === ady` arm swappable unnoticed. Hand-traced: inc
  // gains 3 per move, x steps only when inc EXCEEDS 10 - and this
  // diagonal also lands a pixel shy (x=2, not 3).
  assert.deepEqual(walkTravelPath({ x: 0, y: 0 }, { x: 3, y: 10 }), [
    { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }, { x: 1, y: 4 },
    { x: 1, y: 5 }, { x: 1, y: 6 }, { x: 2, y: 7 }, { x: 2, y: 8 },
    { x: 2, y: 9 }, { x: 2, y: 10 },
  ], 'the y-major stepper, literal for literal');

  // Summing the calculator's own per-pixel charge over the walk must
  // reproduce calculateTravelTime EXACTLY - a walk that visits one
  // different pixel lands on a different climate and a different sum.
  const climate = (x, y) => (x < 3 ? CLIMATES.Ocean : (y % 2 ? CLIMATES.Mountain : CLIMATES.Woodlands));
  for (const opts of [{}, { travelShip: true }, { hasHorse: true, sleepModeInn: true },
    { speedCautious: true, hasCart: true }]) {
    const t = calculateTravelTime({ x: 0, y: 0 }, { x: 9, y: 7 }, opts, climate);
    let minutes = 0, ocean = 0;
    for (const { x, y } of walkTravelPath({ x: 0, y: 0 }, { x: 9, y: 7 })) {
      const terrain = climate(x, y);
      let move;
      if (terrain === CLIMATES.Ocean) { ocean++; move = opts.travelShip ? 51 : 255; }
      else {
        const mod = opts.hasHorse ? 128 : opts.hasCart ? 192 : 256;
        const idx = [0, 0, 0, 1, 2, 3, 4, 5, 5, 5][terrain - CLIMATES.Ocean];
        move = (((102 * mod) >> 8) * (256 - [240, 220, 200, 200, 230, 250][idx] + 256)) >> 8;
      }
      if (!opts.sleepModeInn) move = (300 * move) >> 8;
      minutes += move;
    }
    if (!opts.speedCautious) minutes >>= 1;
    assert.equal(t.minutes, minutes, `the walk carries the whole time law (${JSON.stringify(opts)})`);
    assert.equal(t.oceanPixels, ocean, 'and the ocean count');
  }
});

// ── THE RELIEF ───────────────────────────────────────────────────

test('U61: the height law is byte*8 floored at the ocean, through one documented relief', () => {
  // The formula, held against terrainSampler's own constant - not a
  // copied 27.2.
  assert.equal(overworldHeight(0), (SCALED_OCEAN_ELEVATION * 1.5 / 819.2) * OVERWORLD_RELIEF);
  assert.equal(overworldHeight(3), overworldHeight(0), 'byte 3 still floors (3*8=24 <= 27.2)');
  assert.ok(overworldHeight(4) > overworldHeight(0), 'byte 4 clears the floor (32 > 27.2)');
  assert.equal(overworldHeight(100), (100 * 8 * 1.5 / 819.2) * OVERWORLD_RELIEF);
  assert.equal(OVERWORLD_SEA_LEVEL, overworldHeight(0));
});

test('U61: both port water tests, OR-ed - and the swamp-green ocean trap is closed', () => {
  assert.ok(isWaterPixel(CLIMATES.Ocean, 200), 'climate 223 is water at any byte');
  assert.ok(isWaterPixel(CLIMATES.Woodlands, 3), 'a floored byte is water under any climate');
  assert.ok(!isWaterPixel(CLIMATES.Woodlands, 4), 'byte 4 is land');
  assert.ok(!isWaterPixel(-1, 10), 'the PAK edge (-1) is not water, it is missing data');
  // Ocean maps to climateType SWAMP in getWorldClimateSettings - the
  // recorded trap. The water tint must be the OCEAN family, not Swamp's.
  const deep = overworldTint(CLIMATES.Ocean, 0);
  assert.deepEqual(deep, OVERWORLD_CLIMATE_COLORS[CLIMATES.Ocean]);
  for (const sea of [deep, overworldTint(CLIMATES.Ocean, 2), overworldTint(CLIMATES.Ocean, 200)]) {
    assert.notDeepEqual(sea, OVERWORLD_CLIMATE_COLORS[CLIMATES.Swamp]);
    assert.ok(sea[2] > sea[0], 'every water depth reads blue');
  }
});

test('U61: the grid puts a vertex on every pixel CENTER with north at +z', () => {
  const width = 4, height = 3;
  const heightBytes = new Uint8Array([
    0, 0, 10, 60,
    0, 4, 20, 80,
    0, 0, 8, 120,
  ]);
  const grid = buildOverworldGrid({
    heightBytes, width, height,
    climateAt: (x) => (x < 2 ? CLIMATES.Ocean : CLIMATES.Woodlands),
  });
  assert.equal(grid.positions.length, width * height * 3);
  assert.equal(grid.colors.length, width * height * 3);
  assert.equal(grid.indices.length, (width - 1) * (height - 1) * 6);
  // pixel (2, 1): x = 2.5, z = -1.5, y = its own byte through the law
  const i = 1 * width + 2;
  assert.equal(grid.positions[i * 3], 2.5);
  assert.equal(grid.positions[i * 3 + 1], overworldHeight(20));
  assert.equal(grid.positions[i * 3 + 2], -1.5);
  // map y runs SOUTH, scene +z is north: row 0 sits at greater z
  assert.ok(grid.positions[2] > grid.positions[(2 * width) * 3 + 2]);
  for (const idx of grid.indices) assert.ok(idx < width * height);
  // the west is water-blue, the east is not
  const sea = grid.colors.subarray(0, 3);
  const land = grid.colors.subarray((width - 1) * 3, width * 3);
  assert.ok(sea[2] > sea[0], 'sea blue');
  assert.ok(land[1] >= land[2], 'land green-brown');
  // THE SUN IS NORTH-WEST: on a lone peak, the NW flank (which faces
  // the sun) is brighter than the SE flank. The first draft lit the
  // shadow side; the review's verifier executed the shade and caught
  // the swapped operands - so the direction is pinned, not the bounds.
  const w2 = 5, h2 = 5;
  const peak = new Uint8Array(w2 * h2).fill(20);
  peak[2 * w2 + 2] = 120;   // the summit at (2,2)
  const g2 = buildOverworldGrid({
    heightBytes: peak, width: w2, height: h2, climateAt: () => CLIMATES.Woodlands,
  });
  const lum = (px, py) => {
    const i = (py * w2 + px) * 3;
    return g2.colors[i] + g2.colors[i + 1] + g2.colors[i + 2];
  };
  assert.ok(lum(1, 1) > lum(3, 3), 'the NW flank faces the sun; the SE flank is its shadow');
});

// ── THE MARKERS RIDE THE CLASSIC LAWS ────────────────────────────

const summaryOf = (x, y, locationType, extra = {}) => ({
  id: y * 1000 + x, mapID: y * 1000 + x, regionIndex: 17, mapIndex: 3,
  locationType, discovered: true, ...extra,
});

test('U61: marker buckets ARE getPixelColorIndex - one law, both skins', () => {
  const noFilters = { dungeons: false, temples: false, homes: false, towns: false };
  const types = Object.entries(LOCATION_TYPES).filter(([k]) => k !== 'None');
  const summaries = types.map(([, t], i) => summaryOf(10 + i, 20, t));
  const all = buildMarkerModel(summaries, noFilters, { isDiscovered: () => true });
  // HomeYourShips draws NO dot - C#'s empty arm, the classic window's own
  assert.equal(all.length, types.length - 1, 'every type but HomeYourShips');
  for (const m of all) {
    assert.equal(m.colorIndex, getPixelColorIndex(m.summary.locationType, noFilters),
      'the bucket is the classic window\'s own answer');
  }
  // a filter flag TRUE hides its whole bucket
  const dungeonless = buildMarkerModel(summaries, { ...noFilters, dungeons: true }, { isDiscovered: () => true });
  const hidden = [LOCATION_TYPES.DungeonLabyrinth, LOCATION_TYPES.DungeonKeep,
    LOCATION_TYPES.DungeonRuin, LOCATION_TYPES.Graveyard, LOCATION_TYPES.Coven];
  assert.equal(dungeonless.length, all.length - hidden.length);
  assert.ok(!dungeonless.some((m) => hidden.includes(m.summary.locationType)));
});

test('U61: the discovery law gates every marker, and position is the pixel center', () => {
  const noFilters = { dungeons: false, temples: false, homes: false, towns: false };
  const summaries = [summaryOf(7, 5, LOCATION_TYPES.TownCity),
    summaryOf(8, 5, LOCATION_TYPES.TownCity, { discovered: false })];
  // the default gate is checkLocationDiscovered itself: the baked flag
  // shows the first and hides the second (no runtime store entry, no
  // reveal flag, in this process)
  const markers = buildMarkerModel(summaries, noFilters);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].x, 7.5, 'x = px + 0.5');
  assert.equal(markers[0].z, -5.5, 'z = -(py + 0.5)');
});

test('U61: the dot tables carry exactly the fourteen classic slots', () => {
  assert.equal(OVERWORLD_DOT_COLORS.length, 14);
  assert.equal(OVERWORLD_DOT_SIZES.length, 14);
  for (const c of OVERWORLD_DOT_COLORS) {
    assert.equal(c.length, 3);
    for (const v of c) assert.ok(v >= 0 && v <= 255);
  }
});

test('U61: the route line anchors on the start pixel the time law never charges', () => {
  const heightBytes = new Uint8Array(100).fill(10);
  const path = walkTravelPath({ x: 1, y: 1 }, { x: 4, y: 1 });
  const pts = routePoints({ x: 1, y: 1 }, path, { heightBytes, width: 10, height: 10 });
  assert.equal(pts.length, (path.length + 1) * 3);
  assert.equal(pts[0], 1.5, 'the anchor is the start pixel');
  assert.ok(pts[1] > overworldHeight(10), 'lifted off the ground it explains');
  assert.equal(pts[pts.length - 3], 4.5, 'and it ends on the destination');
});

// ── THE DOOR ─────────────────────────────────────────────────────

/** Just enough document for the chrome: elements that append, listen
 *  and classList without rendering anything. */
function fakeDocument() {
  const node = () => {
    const n = {
      children: [], style: {}, dataset: {}, classList: {
        toggle() {}, add() {}, remove() {},
      },
      append(...k) { n.children.push(...k); },
      remove() { n.removed = true; },
      addEventListener() {}, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      set innerHTML(v) { n.children = []; }, get innerHTML() { return ''; },
    };
    return n;
  };
  const body = node();
  return {
    createElement: () => node(),
    getElementById: () => null,
    head: node(),
    body,
    addEventListener() {}, removeEventListener() {},
  };
}

function withDocument(fn) {
  globalThis.document = fakeDocument();
  try { return fn(globalThis.document); } finally { delete globalThis.document; }
}

const winDeps = (extra = {}) => ({
  getPlayerPixel: () => ({ x: 5, y: 5 }),
  getClimateIndex: () => CLIMATES.Woodlands,
  woods: { heightMapBuffer: new Uint8Array(100).fill(10) },
  mapSize: { width: 10, height: 10 },
  gold: () => 10000, goldPieces: () => 10000,
  hasHorse: false, hasCart: false, hasShip: false,
  diseaseCount: () => 0, poisonCount: () => 0,
  ...extra,
});

test('U61: the classic skin still gets the canvas map - or its honest null without art', () => {
  skin('classic');
  withDocument(() => {
    // no TRAV0I00 in this container: the classic arm answers null,
    // exactly as the pre-door factories did
    assert.equal(createTravelMapWindow(winDeps()), null);
  });
});

test('U61: the fork asks the SKIN, not only the document', () => {
  assert.match(read('src/ui/travelMapDoor.js'),
    /if \(isEnhanced\(\) && typeof document !== 'undefined'\) \{/,
    'both clauses, in that order');
});

test('U61: a host with no document keeps the classic arm, on either skin', () => {
  skin('enhanced');
  assert.equal(typeof document, 'undefined', 'this test is only meaningful headless');
  assert.equal(createTravelMapWindow(winDeps()), null, 'headless + no art = the classic null');
});

test('U61: the door needs classic art only where the classic map draws it', () => {
  skin('classic');
  assert.equal(travelMapDoorReady(), false, 'no TRAV0I00 in this container');
  skin('enhanced');
  assert.equal(travelMapDoorReady(), true, 'the overworld reads no art at all');
});

test('U61: the enhanced skin gets the overworld, holding the classic contract', () => {
  skin('enhanced');
  withDocument((doc) => {
    const win = createTravelMapWindow(winDeps());
    assert.ok(win instanceof OverworldMapWindow);
    assert.equal(win.done, false);
    assert.equal(win.isChoiceWindow, true, 'the host hands it raw key codes');
    for (const arm of ['input', 'click', 'wheel', 'hover', 'tick', 'draw', 'dispose',
      'gotoPlace', 'activateTeleportationTravel', 'getTravelMapSaveData']) {
      assert.equal(typeof win[arm], 'function', `${arm} is part of the contract`);
    }
    assert.equal(doc.body.children[0]?.id, 'enhanced-travelmap');
    // teleportationTravel is a ONE-SHOT: armed before showing, cleared
    // by ANY close - a cancelled visit must not leave the next armed
    win.activateTeleportationTravel();
    assert.equal(win.teleportationTravel, true);
    win.dispose();
    assert.equal(win.done, true);
    assert.equal(win.teleportationTravel, false);
  });
});

// ── THE SEAM ─────────────────────────────────────────────────────

test('U61: the world host builds through the door, once, and gates on it', () => {
  const src = read('src/scenes/world.js');
  assert.equal([...src.matchAll(/createTravelMapWindow\(\{/g)].length, 1,
    'ONE construction seam, as G5 demanded');
  assert.doesNotMatch(src, /new TravelMapWindow\(/, 'no host constructs past the door');
  assert.doesNotMatch(src, /travelMapArtLoaded/, 'hosts ask the DOOR, never the raw art');
  assert.equal([...src.matchAll(/if \(!travelMapDoorReady\(\)\)/g)].length, 2,
    'BOTH openers gate on the door predicate - a single match let one drop its gate unnoticed (the review)');
  // R3W (2026-08-28): read as MEMBERSHIP of the one bag, not as two
  // adjacent lines. The first draft required `woods,` and
  // `getPlayerPixel:` to be consecutive, so adding the roads dep
  // between them failed a pin about the relief - a spelling, not the
  // law it names.
  const bag = src.slice(src.indexOf('createTravelMapWindow({'));
  assert.match(bag, /\bwoods,/, 'the relief rides the one dep bag');
  assert.match(bag, /getPlayerPixel: playerTravelPixel/, '...and so does the player pixel');
  assert.match(bag, /roads: \(\) => \{/, '...and the road chains for the map layer');
});

test('U61: the other three hosts still refuse the map, by name', () => {
  // THE FOUR HOSTS: world OWNS it; exterior retired V deliberately;
  // the dungeon context and the interior modes borrow the outer
  // host's teleport door and build nothing themselves.
  for (const rel of ['scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const src = read(`src/${rel}`);
    assert.doesNotMatch(src, /createTravelMapWindow|new TravelMapWindow|OverworldMapWindow/,
      `${rel} must not grow a map of its own`);
  }
  assert.match(read('src/scenes/worldModes.js'), /host\.openTeleportMap\?\.\(\)/,
    'the guild service still reaches the map through the host door');
});

test('U61: the door is a STATIC fork and says why', () => {
  const src = read('src/ui/travelMapDoor.js');
  assert.doesNotMatch(src, /import\(/, 'no dynamic import');
  assert.match(src, /STATIC import/, 'the departure from the DOM doors\' lazy shape is reasoned');
});

// ── THE WINDOW'S LAWS ────────────────────────────────────────────

const mkWin = (extra = {}) => new OverworldMapWindow(winDeps(extra));

test('U61: the filters are the LIVE store object, edited in place', () => {
  withDocument(() => {
    const win = mkWin();
    assert.equal(win.filters, travelMapFilters(),
      'the same object identity the classic window holds - the cross-open law');
    win.dispose();
  });
});

test('U61: the save envelope is travelMapState\'s own, live panel winning', () => {
  withDocument(() => {
    const win = mkWin();
    assert.deepEqual(win.getTravelMapSaveData(), travelMapSaveData(),
      'no panel: the module store answers');
    // a live open panel's toggles win, exactly as the classic window
    // hands its live popup
    win._selected = { summary: summaryOf(3, 3, LOCATION_TYPES.TownCity), name: 'T', x: 3.5, z: -3.5, y: 1 };
    win._openPanel('travel');
    win._toggleOpt('speedCautious');
    assert.equal(win.getTravelMapSaveData().speedCautious, false, 'the live panel wins');
    assert.equal(travelMapSaveData().speedCautious, true, 'and the store has not moved yet');
    win._closePanel();
    assert.equal(travelMapSaveData().speedCautious, false,
      'closing the panel remembers - _rememberPopUpState\'s law');
    win.dispose();
  });
});

test('U61: the trip on the panel is the law\'s own answer, live per toggle', () => {
  withDocument(() => {
    const climate = (x) => (x >= 8 ? CLIMATES.Ocean : CLIMATES.Mountain);
    const win = mkWin({ getClimateIndex: climate, hasShip: () => false, hasHorse: () => true });
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, z: -5.5, y: 1 };
    win._openPanel('travel');
    const st = win._panelState;
    assert.equal(st.hasHorse, true, 'transports are snapshot at open, function or boolean');
    const expect = (opts) => {
      const t = calculateTravelTime({ x: 5, y: 5 }, { x: 9, y: 5 },
        { ...opts, hasHorse: true, hasCart: false }, climate);
      const c = calculateTripCost(t.minutes, t.oceanPixels,
        { sleepModeInn: opts.sleepModeInn, hasShip: false, travelShip: opts.travelShip });
      return { ...t, ...c, days: travelDays(t.minutes) };
    };
    assert.deepEqual(st.trip, expect(st.opts), 'the numbers are calculateTravelTime/TripCost verbatim');
    win._toggleOpt('speedCautious');
    assert.deepEqual(st.trip, expect(st.opts), 'and they follow every toggle');
    win._toggleOpt('travelShip');
    assert.deepEqual(st.trip, expect(st.opts));
    win.dispose();
  });
});

test('U61: disease speaks BEFORE gold, the gate is two-sided, and the commit is shaped', () => {
  withDocument(() => {
    let sick = 1;
    // letters of credit cover the total but taverns want COIN: rich on
    // paper, coinless in the purse
    const win = mkWin({ diseaseCount: () => sick, gold: () => 10000, goldPieces: () => 0 });
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, z: -5.5, y: 1 };
    win._openPanel('travel');
    win._begin();
    assert.equal(win._panelState.confirm, true, 'the diseased box comes first');
    assert.equal(win._panelState.notice, null, 'gold has not been asked yet');
    win._confirmDiseased(false);
    assert.equal(win._panelState.confirm, false, 'No returns to the panel');
    assert.equal(win._commit, null);
    win._begin();
    win._confirmDiseased(true);
    assert.match(win._panelState.notice, /gold pieces/,
      'coins alone gate the inn nights - the two-sided law');
    assert.equal(win._commit, null, 'no commit through a failed gate');
    win.dispose();

    // ...and the OTHER side: coins enough for the inn, the TOTAL pool
    // short of the ship rental. The review deleted the total clause
    // and the suite stayed green - this is the pin that dies now.
    const sea = mkWin({
      getClimateIndex: () => CLIMATES.Ocean,
      gold: () => 10, goldPieces: () => 10,
    });
    sea._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, z: -5.5, y: 1 };
    sea._openPanel('travel');
    assert.ok(sea._panelState.trip.totalCost > sea._panelState.trip.piecesCost,
      'the ship rental makes the sides differ');
    assert.ok(sea._panelState.trip.piecesCost <= 10, 'the coins side alone would pass');
    sea._begin();
    assert.match(sea._panelState.notice, /gold/, 'the TOTAL pool refuses the passage');
    assert.equal(sea._commit, null);
    sea.dispose();
    sick = 0;
    win.dispose();
  });
});

test('U61: Begin mints the classic pick/opts/computed shapes and flies; teleport skips the flight', () => {
  withDocument(() => {
    const traveled = [];
    const ported = [];
    const maps = { getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Wayrest'] }) };
    const win = mkWin({
      maps,
      onTravel: (...a) => traveled.push(a),
      onTeleport: (...a) => ported.push(a),
    });
    win._selected = {
      summary: summaryOf(9, 5, LOCATION_TYPES.TownCity),
      name: win._summaryName(summaryOf(9, 5, LOCATION_TYPES.TownCity)), x: 9.5, z: -5.5, y: 1,
    };
    win._openPanel('travel');
    win._begin();
    assert.equal(win._phase, 'flight', 'the journey begins as a flight');
    assert.ok(win._flight.pts.length >= 2);
    const c = win._commit;
    assert.equal(c.kind, 'travel');
    assert.deepEqual(Object.keys(c.pick), ['pixel', 'name', 'region', 'mapId', 'regionIndex', 'locationIndex'],
      'fastTravelTo\'s own pick shape');
    assert.deepEqual(c.pick.pixel, { x: 9, y: 5 });
    assert.equal(c.pick.name, 'Wayrest', 'the name is the region\'s own mapNames read');
    assert.deepEqual(Object.keys(c.opts), ['speedCautious', 'sleepModeInn', 'travelShip']);
    assert.deepEqual(Object.keys(c.computed), ['minutes', 'oceanPixels', 'piecesCost', 'totalCost']);

    // ride the flight to the commit: the hooks fire exactly once, at
    // the veil's peak, and the phase machine walks to done
    win._flight.t = win._flight.dur;   // the hold-to-skip landing
    win.tick(0.016);
    assert.equal(win._phase, 'descend');
    for (let i = 0; i < 400 && !win.done; i++) win.tick(0.05);
    assert.equal(traveled.length, 1, 'onTravel fired once');
    assert.deepEqual(traveled[0], [c.pick, c.opts, c.computed]);
    assert.equal(win.done, true, 'and the veil walked the window out');
    win.dispose();

    // TELEPORT = arrival without the journey: no flight phase at all,
    // and No leaves the map armed for another pick
    const win2 = mkWin({ maps, onTeleport: (...a) => ported.push(a) });
    win2.activateTeleportationTravel();
    win2._selected = { summary: summaryOf(2, 2, LOCATION_TYPES.TownCity), name: 'B', x: 2.5, z: -2.5, y: 1 };
    win2._openPanel('teleport');
    win2._confirmTeleport(false);
    assert.equal(win2.teleportationTravel, true, 'No closes the box, the map stays armed');
    win2._selected = { summary: summaryOf(2, 2, LOCATION_TYPES.TownCity), name: 'B', x: 2.5, z: -2.5, y: 1 };
    win2._openPanel('teleport');
    win2._confirmTeleport(true);
    assert.equal(win2._phase, 'descend', 'straight down through the cloud - no flight');
    for (let i = 0; i < 400 && !win2.done; i++) win2.tick(0.05);
    assert.equal(ported.length, 1, 'onTeleport fired once');
    assert.deepEqual(Object.keys(ported[0][0]), ['pixel', 'name', 'region', 'mapId', 'regionIndex', 'locationIndex']);
    win2.dispose();
  });
});

test('U61: gotoPlace is a one-shot consumed on the first tick', () => {
  withDocument(() => {
    const win = mkWin();
    win.gotoPlace({ siteDetails: { regionName: 'Nowhere', regionIndex: 2, locationName: 'X' } });
    assert.ok(win._gotoPlace, 'pending until the window ticks');
    win.tick(0.016);
    assert.equal(win._gotoPlace, null, 'consumed on the first tick, resolvable or not');
    win.dispose();
  });
});

test('U61: onClose is owed on every close, once', () => {
  withDocument(() => {
    let closed = 0;
    const win = mkWin({ onClose: () => closed++ });
    win._close();
    win._close();
    assert.equal(closed, 1);
    assert.equal(win.done, true);
    win.dispose();
  });
});

// ── SOURCE SWEEPS: no second reading of a law ────────────────────

const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('U61: the window computes no travel law of its own', () => {
  const src = code('src/ui/overworldMap.js');
  // the fixed-point chain, the reckless halving, the inn arithmetic
  // and the day rounding all live in systems/travel.js - a second
  // spelling here is the drift the ONE-EXPORT rule exists to prevent
  for (const forbidden of ['>> 8', '(300 *', '102 *', '* 4)', '+ 59)', '1439', '25 *', '5 * Math.trunc']) {
    assert.doesNotMatch(src, new RegExp(forbidden.replace(/[*+()]/g, '\\$&')),
      `the law fragment "${forbidden}" must not be re-derived in the view`);
  }
  for (const needle of ['walkTravelPath(', 'calculateTravelTime(', 'calculateTripCost(', 'travelDays(',
    'travelMapPopUpState()', 'setTravelMapPopUpState(', 'travelMapFilters()', 'checkLocationDiscovered(']) {
    assert.ok(src.includes(needle), `the view runs the owning module: ${needle}`);
  }
});

test('U61: the model buckets through the classic window, not a copied table', () => {
  const src = code('src/ui/overworldModel.js');
  assert.ok(src.includes('getPixelColorIndex('), 'the one bucket law');
  assert.ok(src.includes('checkLocationDiscovered'), 'the one discovery law');
  assert.doesNotMatch(src, /237|240, 243/, 'no copied FMAP palette indices');
});

test('U61: the no-op host arms say why they are empty', () => {
  const src = read('src/ui/overworldMap.js');
  for (const arm of ['click', 'hover', 'wheel']) {
    assert.match(src, new RegExp(`${arm}\\(\\) \\{ /\\*`),
      `${arm} must carry its by-design comment - a silently empty arm reads as broken`);
  }
});

test('U61: the overworld pass restores what it touches', () => {
  const src = read('src/render/overworldRenderer.js');
  assert.match(src, /getParameter\(gl\.CURRENT_PROGRAM\)/, 'saves the previous program');
  assert.match(src, /gl\.useProgram\(prev\)/, 'and restores it');
  assert.match(src, /disable\(gl\.CULL_FACE\)/, 'brackets the cull the mirrored world passes need');
  assert.match(src, /enable\(gl\.CULL_FACE\)/, 'both ways');
  assert.match(src, /dispose\(\)/, 'every allocation has an owner');
});

test('U61: the veil phases never open a beginFrame - the host\'s live frame is the world below the clouds', () => {
  const src = read('src/ui/overworldMap.js');
  const draw = src.slice(src.indexOf('  draw(renderer, canvas)'), src.indexOf('  dispose()'));
  const guard = draw.indexOf('if (this._cameraLive)');
  assert.ok(guard >= 0, 'the relief only draws once the camera cut is made');
  // CONTAINMENT, not text order - the review hoisted beginFrame past
  // the arm's close brace and the old indexOf pin stayed green. Walk
  // the braces to the arm's real end and hold every beginFrame inside.
  let depth = 0, end = -1;
  for (let i = draw.indexOf('{', guard); i < draw.length; i++) {
    if (draw[i] === '{') depth++;
    else if (draw[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > guard, 'the arm closes');
  const inside = draw.slice(guard, end);
  assert.match(inside, /renderer\.beginFrame/, 'beginFrame lives inside the camera-live arm');
  const outside = draw.slice(0, guard) + draw.slice(end);
  assert.doesNotMatch(outside, /renderer\.beginFrame/,
    'and NOWHERE else in draw - a veil frame that cleared the host\'s world would break the transition');
  // and the mirror is the world passes' own, on this camera too
  assert.match(inside, /mirrorProjectionX\(perspective\(/,
    'the projection wraps the handedness mirror (the review proved the "right-handed" first draft flipped the bay)');
});
