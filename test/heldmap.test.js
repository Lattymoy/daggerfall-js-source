// MAP1 - THE HELD MAP, pinned (2026-09-18; U61's pins carried where the
// law they hold survived the relief map's retirement).
//
// The sprite and the ink are presentation; everything the player
// COMMITS to is law, and every law here is held against the owning
// module's own answer rather than a copied number: the walk against
// calculateTravelTime, the buckets against getPixelColorIndex, the
// trip against calculateTravelTime/calculateTripCost, the envelope
// against travelMapState. The ink renderer is a pure display list over
// small fixtures (bible/10-UI/Held-Map-Arc.md: a coast, a border, a
// road, a junction, a discovered and an undiscovered town, the clamp,
// the zoom bands, the selection) and its paint is driven through a
// recording 2D context; node drives the window through a stub document
// the way the door tests always have.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import {
  walkTravelPath, calculateTravelTime, calculateTripCost, travelDays,
} from '../src/systems/travel.js';
import {
  buildOverworldGrid, buildMarkerModel, routePoints, overworldHeight, overworldTint,
  isWaterPixel, OVERWORLD_SEA_LEVEL, OVERWORLD_RELIEF,
  OVERWORLD_DOT_COLORS, OVERWORLD_DOT_SIZES, OVERWORLD_CLIMATE_COLORS,
} from '../src/ui/overworldModel.js';
import { createTravelMapWindow, travelMapDoorReady } from '../src/ui/travelMapDoor.js';
import {
  HeldMapWindow, HELD_MAP_URL, SPRITE, PAPER, THUMB_ZONES, HAND_LUM, keyHandPixels,
} from '../src/ui/heldMap.js';
import {
  buildInkModel, buildInkMarks, paintInk, placeNames, zoomBand, clampView, scaleMinOf, zoomAt,
  toPaper, toMap, boundarySegments, linkSegments, landAt, roadChains, markKind,
  BAND_MARKS, BAND_NAMES, SCALE_MAX, PEN,
} from '../src/ui/inkMap.js';
import { PARTY_MARK_CSS } from '../src/ui/partyMapMarks.js';
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


// ── THE DOOR ─────────────────────────────────────────────────────

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
  assert.equal(travelMapDoorReady(), true, 'the held map reads no ARENA2 art at all');
});

test('MAP1: the enhanced skin gets the HELD MAP, holding the classic contract', () => {
  skin('enhanced');
  withDocument((doc) => {
    const win = createTravelMapWindow(winDeps());
    assert.ok(win instanceof HeldMapWindow);
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
    // the door names the successor and records the retirement
    const door = read('src/ui/travelMapDoor.js');
    assert.match(door, /import \{ HeldMapWindow \} from '\.\/heldMap\.js';/);
    assert.doesNotMatch(door, /OverworldMapWindow/, 'the relief map is gone from the door');
    assert.match(door, /ui\/overworldMap\.js, RETIRED 2026-09-18/, 'and said so');
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
    'BOTH openers gate on the door predicate');
  const bag = src.slice(src.indexOf('createTravelMapWindow({'));
  assert.match(bag, /\bwoods,/, 'the ink rides the one dep bag');
  assert.match(bag, /getPlayerPixel: playerTravelOrigin/, '...and so does the player pixel');
  assert.match(bag, /roads: \(\) => terrainGen\.roads\(\),/, '...and the network the ink traces');
});

test('U61: the other three hosts still refuse the map, by name', () => {
  for (const rel of ['scenes/exterior.js', 'scenes/dungeonContext.js', 'scenes/worldModes.js']) {
    const src = read(`src/${rel}`);
    assert.doesNotMatch(src, /createTravelMapWindow|new TravelMapWindow|HeldMapWindow|OverworldMapWindow/,
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

test('MAP1: the relief map, its renderer and its probe are RETIRED - no file, no import, no CSS', () => {
  for (const f of ['src/ui/overworldMap.js', 'src/render/overworldRenderer.js', 'tools/overworldProbe.mjs']) {
    assert.equal(existsSync(new URL(`../${f}`, import.meta.url)), false, `${f} is gone`);
  }
  for (const f of ['src/ui/travelMapDoor.js', 'src/ui/heldMap.js', 'src/ui/inkMap.js', 'src/scenes/world.js']) {
    assert.doesNotMatch(read(f), /overworldRenderer|from '\.\/overworldMap\.js'/, `${f} imports nothing retired`);
  }
  const css = read('src/ui/enhancedStyle.js');
  assert.doesNotMatch(css, /\.ov[a-z]/, 'the .ov* rules went with the window they dressed');
  assert.match(css, /\.hmroot \{\s*\n\s*position: fixed; inset: 0; z-index: 13; overflow: hidden;\s*\n\s*background: #000;/, 'the held map\'s root is OPAQUE - the sprite\'s own black');
  assert.match(css, /\.hmink \{ position: absolute; display: block; \}/);
  assert.match(css, /\.hmhands \{[^}]*pointer-events: none;/, 'the hands never take the pointer from the sheet');
});

// ── THE WINDOW'S LAWS ────────────────────────────────────────────

const mkWin = (extra = {}) => new HeldMapWindow(winDeps(extra));
/** Tick the sheet up: the window opens through a short fade and its
 *  card is phase-gated on 'map'. */
const open = (win) => { for (let i = 0; i < 20; i++) win.tick(0.05); return win; };

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
    win._selected = { summary: summaryOf(3, 3, LOCATION_TYPES.TownCity), name: 'T', x: 3.5, y: 3.5 };
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
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
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
    const numbers = (t) => ({
      minutes: t.minutes, oceanPixels: t.oceanPixels,
      piecesCost: t.piecesCost, totalCost: t.totalCost, days: t.days,
    });
    assert.deepEqual(numbers(st.trip), numbers(expect(st.opts)),
      'the numbers are calculateTravelTime/TripCost verbatim');
    assert.equal(st.trip.byRoad, false, 'the journey is never by road - there are no roads');
    win._toggleOpt('speedCautious');
    assert.deepEqual(numbers(st.trip), numbers(expect(st.opts)), 'and they follow every toggle');
    win._toggleOpt('travelShip');
    assert.deepEqual(numbers(st.trip), numbers(expect(st.opts)));
    win.dispose();
  });
});

test('U61: disease speaks BEFORE gold, the gate is two-sided, and the commit is shaped', () => {
  withDocument(() => {
    let sick = 1;
    const win = mkWin({ diseaseCount: () => sick, gold: () => 10000, goldPieces: () => 0 });
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
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

    const sea = mkWin({
      getClimateIndex: () => CLIMATES.Ocean,
      gold: () => 10, goldPieces: () => 10,
    });
    sea._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
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

test('MAP1: Begin mints the classic pick/opts/computed shapes, the sheet lowers and the hooks fire ONCE while the window is alive; teleport the same with no journey (mutants: commit-fires-before-the-fade, commit-fires-twice, teleport-no-closes-the-map)', () => {
  withDocument(() => {
    const traveled = [];
    const ported = [];
    const maps = { getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Wayrest'] }) };
    const win = open(mkWin({
      maps,
      onTravel: (...a) => traveled.push(a),
      onTeleport: (...a) => ported.push(a),
    }));
    assert.equal(win._phase, 'map');
    win._selected = {
      summary: summaryOf(9, 5, LOCATION_TYPES.TownCity),
      name: win._summaryName(summaryOf(9, 5, LOCATION_TYPES.TownCity)), x: 9.5, y: 5.5,
    };
    win._openPanel('travel');
    win._begin();
    assert.equal(win._phase, 'closing', 'the sheet lowers - there is no flight to fly');
    assert.equal(win._panel, null, 'the card is down');
    const c = win._commit;
    assert.equal(c.kind, 'travel');
    assert.deepEqual(Object.keys(c.pick), ['pixel', 'name', 'region', 'mapId', 'regionIndex', 'locationIndex'],
      'fastTravelTo\'s own pick shape');
    assert.deepEqual(c.pick.pixel, { x: 9, y: 5 });
    assert.equal(c.pick.name, 'Wayrest', 'the name is the region\'s own mapNames read');
    assert.deepEqual(Object.keys(c.opts), ['speedCautious', 'sleepModeInn', 'travelShip', 'playerControlled']);
    assert.equal(c.opts.playerControlled, false, 'no mod handed in, so never player-controlled');
    assert.deepEqual(Object.keys(c.computed), ['minutes', 'oceanPixels', 'piecesCost', 'totalCost']);
    assert.equal(traveled.length, 0, 'nothing fires while the sheet is still lowering');
    for (let i = 0; i < 400 && !win.done; i++) win.tick(0.05);
    assert.equal(traveled.length, 1, 'onTravel fired once');
    assert.deepEqual(traveled[0], [c.pick, c.opts, c.computed]);
    assert.equal(win.done, true, 'and the window closed behind it');
    assert.equal(win._commit, null);
    win.dispose();
    assert.equal(traveled.length, 1, 'dispose after the commit fires nothing again');

    // TELEPORT = arrival without the journey, and No leaves the map
    // armed for another pick
    const win2 = open(mkWin({ maps, onTeleport: (...a) => ported.push(a) }));
    win2.activateTeleportationTravel();
    win2._selected = { summary: summaryOf(2, 2, LOCATION_TYPES.TownCity), name: 'B', x: 2.5, y: 2.5 };
    win2._openPanel('teleport');
    win2._confirmTeleport(false);
    assert.equal(win2.teleportationTravel, true, 'No closes the box, the map stays armed');
    assert.equal(win2._phase, 'map');
    win2._selected = { summary: summaryOf(2, 2, LOCATION_TYPES.TownCity), name: 'B', x: 2.5, y: 2.5 };
    win2._openPanel('teleport');
    win2._confirmTeleport(true);
    assert.equal(win2._phase, 'closing');
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

test('MAP1: Escape walks the ladder - the diseased box, the panel, the selection, then the sheet (mutants: escape-closes-through-the-panel)', () => {
  withDocument(() => {
    let closed = 0;
    const win = open(mkWin({ onClose: () => closed++, diseaseCount: () => 1 }));
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
    win._openPanel('travel');
    win._begin();
    assert.equal(win._panelState.confirm, true);
    win.input('Escape');
    assert.equal(win._panelState.confirm, false, 'the box steps back to the panel');
    assert.equal(win._panel, 'travel', 'not out of it');
    win.input('Escape');
    assert.equal(win._panel, null, 'then the panel');
    assert.ok(win._selected, 'the selection stands');
    win.input('Escape');
    assert.equal(win._selected, null, 'then the selection');
    assert.equal(win._phase, 'map');
    win.input('Escape');
    assert.equal(win._phase, 'closing', 'then the sheet lowers');
    for (let i = 0; i < 20 && !win.done; i++) win.tick(0.05);
    assert.equal(closed, 1);
  });
});

// ── SOURCE SWEEPS: no second reading of a law ────────────────────

const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('U61: the window computes no travel law of its own', () => {
  const src = code('src/ui/heldMap.js');
  for (const forbidden of ['>> 8', '(300 *', '102 *', '* 4)', '+ 59)', '1439', '25 *', '5 * Math.trunc']) {
    assert.doesNotMatch(src, new RegExp(forbidden.replace(/[*+()]/g, '\\$&')),
      `the law fragment "${forbidden}" must not be re-derived in the view`);
  }
  for (const needle of ['walkTravelPath(', 'calculateTravelTime(', 'calculateTripCost(', 'travelDays(',
    'travelMapPopUpState()', 'setTravelMapPopUpState(', 'travelMapFilters()', 'checkLocationDiscovered(']) {
    assert.ok(src.includes(needle), `the view runs the owning module: ${needle}`);
  }
  // and the ink's marks go through the classic window's laws by way of
  // the ONE marker model, never a copied table
  const ink = code('src/ui/inkMap.js');
  assert.ok(ink.includes('buildMarkerModel('), 'the one bucket-and-discovery law');
  assert.doesNotMatch(ink, /237|240, 243/, 'no copied FMAP palette indices');
  assert.doesNotMatch(ink, /hasDiscoveredLocationId|_revealUndiscoveredLocations/, 'discovery is not re-read here');
});

test('U61: the model buckets through the classic window, not a copied table', () => {
  const src = code('src/ui/overworldModel.js');
  assert.ok(src.includes('getPixelColorIndex('), 'the one bucket law');
  assert.ok(src.includes('checkLocationDiscovered'), 'the one discovery law');
  assert.doesNotMatch(src, /237|240, 243/, 'no copied FMAP palette indices');
});

test('U61: the no-op host arms say why they are empty', () => {
  const src = read('src/ui/heldMap.js');
  for (const arm of ['click', 'hover', 'wheel', 'draw']) {
    assert.match(src, new RegExp(`${arm}\\(\\) \\{ /\\*`),
      `${arm} must carry its by-design comment - a silently empty arm reads as broken`);
  }
});

// ═══ MAP1: THE PEN, pinned over fixtures ═══════════════════════════
//
// bible/10-UI/Held-Map-Arc.md's own list: "the ink renderer as a pure
// function over a table of fixtures (a coast, a border, a road, a
// junction, a discovered and an undiscovered town), the clamp, the zoom
// bands, the selection."

/** A recording 2D context: every call and every style set, in order. */
function recordingCtx() {
  const calls = [];
  const state = {};
  const ctx = new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: t.length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, strokeStyle: state.strokeStyle, fillStyle: state.fillStyle, lineWidth: state.lineWidth, font: state.font }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
  return ctx;
}
const island = () => {
  // a 6x4 sea with a 2x2 island at (2,1)-(3,2)
  const w = 6, h = 4;
  const bytes = new Uint8Array(w * h);
  for (const [x, y] of [[2, 1], [3, 1], [2, 2], [3, 2]]) bytes[y * w + x] = 40;
  return { width: w, height: h, heightBytes: bytes, climateAt: (x, y) => (bytes[y * w + x] ? CLIMATES.Woodlands : CLIMATES.Ocean) };
};

test('MAP1 ink: the coast is the land set\'s boundary along pixel edges, closed, under the ONE water law (mutants: coast-through-pixel-centres, coast-left-open, coast-ignores-climate)', () => {
  const fx = island();
  const segs = boundarySegments(landAt(fx), fx.width, fx.height);
  assert.equal(segs.length, 8, 'a 2x2 island has eight unit edges');
  const chains = linkSegments(segs);
  assert.equal(chains.length, 1, 'joined into ONE loop');
  const loop = chains[0];
  assert.deepEqual(loop[0], loop[loop.length - 1], 'closed: the first point comes back at the end');
  assert.equal(loop.length, 9, 'eight edges, nine points');
  for (const p of loop) assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y), 'edges lie on the pixel grid, not through centres');
  assert.ok(loop.every((p) => p.x >= 2 && p.x <= 4 && p.y >= 1 && p.y <= 3), 'and around the island');
  // the water law is isWaterPixel: an OCEAN climate pixel is sea however high its byte
  const highSea = { ...fx, climateAt: () => CLIMATES.Ocean };
  assert.equal(boundarySegments(landAt(highSea), fx.width, fx.height).length, 0, 'ocean climate over the whole sheet: no coast at all');
  // the edge of the data counts as outside, so land at the corner closes
  const corner = { width: 2, height: 2, heightBytes: new Uint8Array([40, 0, 0, 0]), climateAt: () => CLIMATES.Woodlands };
  assert.equal(linkSegments(boundarySegments(landAt(corner), 2, 2))[0].length, 5, 'a corner pixel is a closed square');
  // ...and the softened chain is what the pen draws
  const model = buildInkModel(fx);
  assert.equal(model.coast.length, 1);
  assert.ok(model.coast[0].length >= 4, 'simplified and rounded, still a loop');
});

test('MAP1 ink: a province border is an edge between two LAND pixels of different regions - never a sea edge, never a nameless one (mutants: border-on-the-coast, border-through-unnamed, border-one-sided)', () => {
  // a 7x2 sheet. Region 0 at x 0-2 and region 1 at x=3 on both rows.
  // Row 0: x=4 is UNNAMED land, x=5 is SEA (its politic byte still says
  // region 0), x=6 region 1. Row 1: x=4 is SEA (byte says region 0),
  // x=5 is region 0 land, x=6 region 1.
  const w = 7, h = 2;
  const bytes = new Uint8Array(w * h).fill(40);
  bytes[5] = 0; bytes[w + 4] = 0;
  const climateAt = (x, y) => (bytes[y * w + x] ? CLIMATES.Woodlands : CLIMATES.Ocean);
  const regionAt = (x, y) => (x < 3 ? 0 : x === 3 ? 1 : x === 4 ? (y === 0 ? -1 : 0) : x === 5 ? 0 : 1);
  const model = buildInkModel({ width: w, height: h, heightBytes: bytes, climateAt, regionAt, regionCount: 2 });
  const xs = model.borders.map((c) => c[0].x).sort();
  assert.deepEqual(xs, [3, 6], 'TWO border chains: 2|3 on both rows, and 5|6 on row 1 alone');
  const b = model.borders.find((c) => c[0].x === 3);
  assert.ok(b.every((p) => Math.abs(p.x - 3) < 1e-9), 'the first runs along x=3');
  assert.ok(b.some((p) => p.y === 0) && b.some((p) => p.y === 2), 'the whole shared edge, top to bottom');
  // row 0, 3|4 is land against UNNAMED land: no border; row 1, 3|4 is land
  // against SEA: the shore, not a border, whatever the sea's byte says
  assert.ok(!model.borders.some((c) => c.some((p) => Math.abs(p.x - 4) < 1e-9)), 'no border at x=4 on either row');
  const b2 = model.borders.find((c) => c[0].x === 6);
  assert.ok(b2.every((p) => p.y >= 1), 'the 5|6 border is row 1 only - row 0\'s x=5 is sea');
  // the centroids: the mean of each region's LAND, sea and nameless pixels excluded
  assert.deepEqual(model.regions.map((r) => [r.region, r.x, r.y, r.n]), [[0, 14.5 / 7, 7.5 / 7, 7], [1, 5, 1, 4]]);
});

test('MAP1 ink: roads and tracks are inked ONLY from the mod\'s arrays, traced through a junction into three chains (mutants: generated-network-inked, tracks-dropped, junction-one-chain)', () => {
  const w = 5, h = 5;
  // a T junction at (2,2): a road W-E through row 2, a spur north from (2,2)
  const roads = new Uint8Array(w * h);
  const E = 32, W = 2, N = 128, S = 8;
  roads[2 * w + 0] = E; roads[2 * w + 1] = E | W; roads[2 * w + 2] = E | W | N; roads[2 * w + 3] = E | W; roads[2 * w + 4] = W;
  roads[1 * w + 2] = S | N; roads[0 * w + 2] = S;
  const tracks = new Uint8Array(w * h); tracks[4 * w + 0] = E; tracks[4 * w + 1] = W;
  const mod = { roads, tracks, source: 'basic-roads' };
  const ours = { roads, tracks };   // the port's own network carries no source word
  assert.deepEqual(roadChains(ours, w, h), { roads: [], tracks: [] }, 'the generated network is never a map\'s');
  assert.deepEqual(roadChains(null, w, h), { roads: [], tracks: [] });
  const r = roadChains(mod, w, h);
  assert.equal(r.roads.length, 3, 'a junction breaks the road into three chains - two arms and the spur');
  assert.equal(r.tracks.length, 1);
  // chains are pixel CENTRES, so a road meets a town's mark
  const ends = r.roads.flatMap((c) => [c[0], c[c.length - 1]]);
  assert.ok(ends.some((p) => Math.abs(p.x - 2.5) < 1e-9 && Math.abs(p.y - 2.5) < 1e-9), 'the junction pixel\'s centre is an endpoint');
  assert.ok(ends.every((p) => Math.abs((p.x - 0.5) % 1) < 1e-9), 'every endpoint sits on a centre');
  // the model carries them, and the painter strokes them under the flags
  const model = buildInkModel({ width: w, height: h, heightBytes: new Uint8Array(w * h).fill(40), climateAt: () => CLIMATES.Woodlands, roads: mod });
  assert.equal(model.roads.length, 3);
});

test('MAP1 ink: a discovered town is a mark with its name and glyph; an undiscovered one is nothing, through the classic window\'s laws (mutants: undiscovered-inked, filter-ignored, kind-table-copied)', () => {
  const summaries = [
    summaryOf(1, 1, LOCATION_TYPES.TownCity),
    summaryOf(2, 1, LOCATION_TYPES.TownCity, { discovered: false }),
    summaryOf(3, 1, LOCATION_TYPES.DungeonRuin),
    summaryOf(4, 1, LOCATION_TYPES.HomeFarms),
    summaryOf(5, 1, LOCATION_TYPES.ReligionTemple),
  ];
  const nameOf = (s) => `P${s.id}`;
  const marks = buildInkMarks({ summaries, filters: {}, nameOf });
  assert.deepEqual(marks.map((m) => m.kind), ['city', 'dungeon', 'home', 'temple'], 'the undiscovered city is not on the sheet');
  assert.deepEqual(marks.map((m) => [m.x, m.y]), [[1.5, 1.5], [3.5, 1.5], [4.5, 1.5], [5.5, 1.5]], 'pixel CENTRES, y down');
  assert.equal(marks[0].name, `P${summaries[0].id}`, 'the name rides the mark');
  assert.deepEqual(marks.map((m) => m.colorIndex), [11, 2, 5, 8], 'the classic bucket is kept beside the glyph');
  // the filters are the classic window's own: TRUE hides
  assert.deepEqual(buildInkMarks({ summaries, filters: { dungeons: true, homes: true }, nameOf }).map((m) => m.kind), ['city', 'temple']);
  // the glyph table covers the fourteen classic slots, one kind each
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(markKind),
    ['dungeon', 'dungeon', 'dungeon', 'graveyard', 'coven', 'home', 'home', 'home', 'temple', 'cult', 'tavern', 'city', 'hamlet', 'village']);
});

test('MAP1 ink: the zoom bands - far shows the cities alone, mid the towns, temples and dungeons, near everything; the thresholds are the table\'s (mutants: far-shows-hamlets, near-hides-homes, band-boundaries-moved)', () => {
  assert.equal(zoomBand(0.5), 'far');
  assert.equal(zoomBand(2.39), 'far');
  assert.equal(zoomBand(2.4), 'mid');
  assert.equal(zoomBand(5.49), 'mid');
  assert.equal(zoomBand(5.5), 'near');
  assert.equal(zoomBand(14), 'near');
  assert.deepEqual([...BAND_MARKS.far], [11], 'far: the cities alone');
  assert.ok(BAND_MARKS.mid.has(12) && BAND_MARKS.mid.has(13) && BAND_MARKS.mid.has(8) && BAND_MARKS.mid.has(0), 'mid: towns, temples, dungeons');
  assert.ok(!BAND_MARKS.mid.has(5) && !BAND_MARKS.mid.has(3), '...but not homes or graveyards');
  assert.equal(BAND_MARKS.near.size, 14, 'near: every slot');
  assert.ok(BAND_NAMES.far.size <= BAND_MARKS.far.size && BAND_NAMES.mid.size <= BAND_MARKS.mid.size, 'a band names no more than it inks');
  // ...and the painter honours them: at far a hamlet is not drawn, at near it is
  const summaries = [summaryOf(1, 1, LOCATION_TYPES.TownCity), summaryOf(3, 1, LOCATION_TYPES.TownHamlet)];
  const model = buildInkModel({ width: 6, height: 4, heightBytes: new Uint8Array(24).fill(40), climateAt: () => CLIMATES.Woodlands, summaries });
  const glyphs = (band, scale) => {
    const ctx = recordingCtx();
    paintInk(ctx, model, { ox: 0, oy: 0, scale }, { paperW: 100, paperH: 60, band });
    return ctx.calls.filter((c) => c.fn === 'arc').length;
  };
  assert.equal(glyphs('far', 1), 2, 'far: the city (a dot and a ring) alone');
  assert.equal(glyphs('near', 8), 3, 'near: the hamlet\'s dot joins it');
});

test('MAP1 ink: the clamp never lets the map leave the parchment - contain at rest, centred where smaller, panned only to the edge where larger, capped at SCALE_MAX (mutants: clamp-lets-edge-in, clamp-no-centre, ceiling-dropped)', () => {
  const lim = { mapW: 1000, mapH: 500, paperW: 1000, paperH: 600 };
  const rest = clampView({ ox: 0, oy: 0, scale: 0 }, lim);
  assert.equal(rest.scale, scaleMinOf(lim), 'contain: the smaller of the two fits');
  assert.equal(rest.scale, 1);
  assert.equal(rest.ox, 0, 'the width fits exactly');
  assert.equal(rest.oy, -50, 'the height has 100px to spare, split - the map is CENTRED on the sheet');
  // zoomed in: pan is bounded by the map's edge meeting the paper's
  const z = clampView({ ox: -30, oy: -30, scale: 4 }, lim);
  assert.deepEqual([z.ox, z.oy], [0, 0], 'no blank paper at the top-left');
  const far = clampView({ ox: 9999, oy: 9999, scale: 4 }, lim);
  assert.deepEqual([far.ox, far.oy], [1000 - 250, 500 - 150], '...nor at the bottom-right');
  assert.equal(clampView({ ox: 0, oy: 0, scale: 99 }, lim).scale, SCALE_MAX, 'the ceiling');
  // a bay smaller than the sheet (a probe's) is never let shrink off it
  const tiny = { mapW: 10, mapH: 10, paperW: 700, paperH: 400 };
  assert.equal(clampView({ ox: 0, oy: 0, scale: 1 }, tiny).scale, 40, 'contain wins over the ceiling');
  // zoom about a paper point keeps the map point under it still
  const v = { ox: 100, oy: 50, scale: 2 };
  const [mx, my] = toMap(v, 300, 200);
  const z2 = zoomAt(v, 1.5, 300, 200);
  assert.deepEqual(toMap(z2, 300, 200).map((n) => Math.round(n * 1e9) / 1e9), [mx, my], 'the cursor\'s pixel did not move');
  assert.equal(z2.scale, 3);
  // and the two transforms are inverses
  const [px, py] = toPaper(v, 137.5, 88.25);
  assert.deepEqual(toMap(v, px, py), [137.5, 88.25]);
});

test('MAP1 ink: names compete for room in rank order - a city\'s beats a hamlet\'s, and one that would overlap is dropped, never drawn over (mutants: overlap-drawn, rank-ignored, off-sheet-placed)', () => {
  const marks = [
    { x: 5, y: 5, colorIndex: 12, kind: 'hamlet', name: 'Hamletton', summary: {} },
    { x: 5.2, y: 5, colorIndex: 11, kind: 'city', name: 'Cityville', summary: {} },
    { x: 40, y: 5, colorIndex: 13, kind: 'village', name: 'Farvale', summary: {} },
    { x: 500, y: 5, colorIndex: 11, kind: 'city', name: 'Offsheet', summary: {} },
  ];
  const measure = (t, size) => t.length * size * 0.5;
  const view = { ox: 0, oy: 0, scale: 4 };
  const near = placeNames(marks, view, 'near', { paperW: 300, paperH: 100, measure });
  assert.deepEqual(near.map((n) => n.mark.name), ['Cityville', 'Farvale'], 'the city won the room, the hamlet under it was dropped, the off-sheet city never placed');
  const mid = placeNames(marks, view, 'mid', { paperW: 300, paperH: 100, measure });
  assert.deepEqual(mid.map((n) => n.mark.name), ['Cityville'], 'mid names cities and hamlets only - and the hamlet still loses the room');
  const far = placeNames(marks, view, 'far', { paperW: 300, paperH: 100, measure });
  assert.deepEqual(far.map((n) => n.mark.name), ['Cityville']);
  // the painter writes exactly the placed names, in the hand-lettered face
  const ctx = recordingCtx();
  const model = { coast: [], borders: [], roads: [], tracks: [], regions: [], high: [], marks };
  paintInk(ctx, model, view, { paperW: 300, paperH: 100, band: 'near', names: near });
  const texts = ctx.calls.filter((c) => c.fn === 'fillText');
  assert.deepEqual(texts.map((c) => c.args[0]), ['Cityville', 'Farvale']);
  assert.ok(texts.every((c) => c.font.includes('Cormorant')), 'in the display face');
});

test('MAP1 ink: the paint clears the sheet, strokes the coast twice (a wash under the pen), honours the road and track flags, skips the tracks at far, and inks the player, the selection and the party in their own colours (mutants: no-clear, wash-dropped, roads-flag-ignored, tracks-at-far, party-in-ink-colour)', () => {
  const fx = island();
  const roads = new Uint8Array(24); roads[6] = 32; roads[7] = 2;
  const tracks = new Uint8Array(24); tracks[12] = 32; tracks[13] = 2;
  const model = buildInkModel({ ...fx, roads: { roads, tracks, source: 'basic-roads' } });
  const paint = (opts) => {
    const ctx = recordingCtx();
    paintInk(ctx, model, { ox: 0, oy: 0, scale: 10 }, { paperW: 60, paperH: 40, ...opts });
    return ctx.calls;
  };
  const near = paint({ band: 'near', player: { x: 0, y: 0 }, selected: { x: 2.5, y: 1.5 },
    party: [{ x: 3.5, y: 2.5, name: 'Nym', online: true, stack: 0, color: PARTY_MARK_CSS }] });
  assert.equal(near[1].fn, 'clearRect', 'cleared first - the paper beneath IS blank parchment');
  const strokes = near.filter((c) => c.fn === 'stroke');
  assert.equal(strokes[0].strokeStyle, PEN.wash, 'the shore\'s wash');
  assert.equal(strokes[1].strokeStyle, PEN.line, 'then the pen');
  assert.ok(strokes[0].lineWidth > strokes[1].lineWidth, 'the wash is the wider');
  const dashed = near.filter((c) => c.fn === 'setLineDash' && c.args[0].length);
  assert.deepEqual(dashed.map((c) => c.args[0]), [[4, 3], [2, 3]], 'the borders dashed, the tracks dotted');
  const rings = near.filter((c) => c.fn === 'arc');
  assert.ok(rings.some((c) => c.strokeStyle === PARTY_MARK_CSS), 'the party ring is the party green');
  assert.ok(rings.some((c) => c.strokeStyle === PEN.select), 'the selection ring is gold');
  assert.ok(rings.some((c) => c.strokeStyle === PEN.player), 'the player\'s mark is the red');
  assert.ok(near.some((c) => c.fn === 'fillText' && c.args[0] === 'Nym' && c.fillStyle === PARTY_MARK_CSS), 'the member\'s name under the ring, in the green');
  // the flags: TRUE hides (the classic inversion)
  const pen = (calls) => calls.filter((c) => c.fn === 'stroke' && c.strokeStyle === PEN.line).length;
  assert.equal(pen(near), 2, 'the coast and the road are the two pen strokes on an unmarked island');
  const hidden = paint({ band: 'near', filters: { roads: true, tracks: true } });
  assert.equal(pen(hidden), 1, 'a hidden roads flag leaves the coast alone in the pen');
  assert.equal(hidden.filter((c) => c.fn === 'setLineDash' && c.args[0].length).length, 1, 'only the borders are dashed - no tracks');
  const farCalls = paint({ band: 'far' });
  assert.equal(farCalls.filter((c) => c.fn === 'setLineDash' && c.args[0][0] === 2).length, 0, 'no tracks at far');
});

test('MAP1 window: the selection - a click within 16 paper px of an inked mark selects it, a click on bare paper clears it, and a mark the band hides cannot be picked (mutants: pick-radius-in-map-px, hidden-mark-pickable, bare-click-keeps-selection)', () => {
  withDocument(() => {
    const mapDict = new Map();
    for (const s of [summaryOf(3, 3, LOCATION_TYPES.TownCity), summaryOf(9, 9, LOCATION_TYPES.HomeFarms)]) mapDict.set(s.id, s);
    const maps = { regionCount: 1, getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Wayrest'] }), getPoliticIndex: () => 128 };
    const win = open(mkWin({ mapDict, maps }));
    const model = win._ensureModel();
    assert.equal(model.marks.length, 2);
    // the synthetic bay: contain puts the 10x10 sheet at the same scale both ways
    assert.equal(zoomBand(win._view.scale), 'near', 'a 10-pixel bay on a real paper is near');
    const [cx, cy] = toPaper(win._view, 3.5, 3.5);
    win._pickAt(cx + 10, cy - 10);
    assert.equal(win._selected?.name, 'Wayrest', 'within 16px: picked');
    assert.deepEqual([win._selected.x, win._selected.y], [3.5, 3.5]);
    win._pickAt(cx + 30, cy);
    assert.equal(win._selected, null, 'bare paper clears the pick');
    // at the far band the farm is not inked, so it is not there to pick
    // (the view is set by hand: the clamp would refuse a far scale on a
    // ten-pixel bay, and the band law is what is under test)
    win._view.scale = 2.3;
    const [fx, fy] = toPaper(win._view, 9.5, 9.5);
    win._pickAt(fx, fy);
    assert.equal(win._selected, null, 'the far band shows cities alone');
    win._view.scale = 8;
    const [nx, ny] = toPaper(win._view, 9.5, 9.5);
    win._pickAt(nx, ny);
    assert.equal(win._selected?.kind, 'home', 'and near shows the farm');
    // hover reads Region : Location on a mark, the province on bare land
    win._hoverLabel(nx, ny);
    assert.equal(win._chrome.label.textContent, 'Daggerfall : Wayrest', 'the summary\'s region 17, then the name');
    assert.equal(win._chrome.stage.style.cursor, 'pointer');
    win._hoverLabel(...toPaper(win._view, 1.5, 1.5));
    assert.equal(win._chrome.label.textContent, 'Alik\'r Desert', 'the politic read, region 0');
    assert.equal(win._chrome.stage.style.cursor, '');
    win.dispose();
  });
});

test('MAP1 window: pan, wheel and keys move the VIEW under a clamp, the search glides to its pick, and the layout lays the sheet on PAPER of a 4:3 stage (mutants: pan-unclamped, zoom-not-at-cursor, layout-off-paper)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const win = open(mkWin({ mapSize: { width: 1000, height: 500 }, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) } }));
      // the stage: 4:3 letterboxed into 16:9 -> 1200x900 at x=200
      assert.deepEqual(win._stage, { x: 200, y: 0, w: 1200, h: 900 });
      const pw = 1200 * (PAPER.x1 - PAPER.x0), ph = 900 * (PAPER.y1 - PAPER.y0);
      assert.ok(Math.abs(win._paper.w - pw) < 1e-9 && Math.abs(win._paper.h - ph) < 1e-9, 'the canvas is the paper\'s rectangle');
      assert.equal(win._chrome.ink.style.left, `${1200 * PAPER.x0}px`);
      assert.equal(win._view.scale, scaleMinOf(win._limits()), 'at rest the whole bay is on the sheet');
      const rest = { ...win._view };
      // a nudge past the edge is clamped
      win._nudge(-500, 0);
      assert.equal(win._view.ox, rest.ox, 'the map cannot leave the paper westward');
      // zoom about a paper point: the pixel under it holds (the paper's
      // centre, where the clamp has room on every side)
      const [hx, hy] = [win._paper.w / 2, win._paper.h / 2];
      const [mx, my] = toMap(win._view, hx, hy);
      win._zoomBy(2, hx, hy);
      const [mx2, my2] = toMap(win._view, hx, hy);
      assert.ok(Math.abs(mx - mx2) < 1e-6 && Math.abs(my - my2) < 1e-6, 'zoom to the cursor');
      assert.equal(win._view.scale, rest.scale * 2);
      win.input('Equal');
      assert.ok(win._view.scale > rest.scale * 2, '+ zooms');
      win.input('Minus'); win.input('Minus'); win.input('Minus'); win.input('Minus');
      assert.equal(win._view.scale, rest.scale, '- bottoms out at contain');
      // a search pick glides: the GOAL is set at the focus scale, centred on the place, and the view follows
      win._searchPick({ name: 'Wayrest', regionName: 'Wayrest', pos: { x: 700, y: 300 }, summary: summaryOf(700, 300, LOCATION_TYPES.TownCity) });
      assert.equal(win._selected?.name, 'Wayrest');
      assert.ok(win._goal.scale >= 6, 'the focus scale');
      const centre = toMap(win._goal, win._paper.w / 2, win._paper.h / 2);
      assert.ok(Math.abs(centre[0] - 700.5) < 1e-6 && Math.abs(centre[1] - 300.5) < 1e-6, 'centred on the place');
      const before = win._view.scale;
      win.tick(0.05);
      assert.ok(win._view.scale > before, 'and the view is on its way');
      win.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('MAP1: the sprite is the port\'s own under the doctrine row, the paper and thumb geometry are the painting\'s, and the hand key keeps only what is darker than the sheet (mutants: key-threshold-moved, key-clears-hands, url-off-public)', () => {
  assert.equal(HELD_MAP_URL, 'art/held-map.png');
  assert.ok(existsSync(new URL('../public/art/held-map.png', import.meta.url)), 'the file ships');
  assert.match(read('test/doctrine.test.js'), /\['public\/art\/held-map\.png', "OURS - Mac's own painting/, 'under the OURS row');
  assert.deepEqual(SPRITE, { w: 1448, h: 1086 });
  assert.ok(PAPER.x0 < THUMB_ZONES[0].x1 && THUMB_ZONES[1].x0 < PAPER.x1, 'the thumb zones reach INTO the paper - that is why they exist');
  assert.ok(THUMB_ZONES[0].y0 > PAPER.y0 && THUMB_ZONES[0].y1 >= PAPER.y1, 'and only its lower half, where the thumbs rest');
  assert.equal(HAND_LUM, 144);
  // RGBA: a paper pixel goes clear, a gauntlet pixel stays
  const px = new Uint8ClampedArray([204, 169, 116, 255, 100, 70, 40, 255, 143, 143, 143, 255, 145, 145, 145, 255]);
  keyHandPixels(px);
  assert.deepEqual([px[3], px[7], px[11], px[15]], [0, 255, 255, 0], 'the sheet clears, the hand stays, and 144 is the edge');
  // the window keys on load and never before a 2D context exists (node: no-op)
  withDocument(() => {
    const win = mkWin();
    assert.equal(typeof win._chrome.sprite.onload, 'function', 'the key runs when the picture lands');
    assert.equal(win._chrome.sprite.src, HELD_MAP_URL);
    win._chrome.sprite.onload();   // a stub canvas has no context: silent
    win.dispose();
  });
});

test('MAP1: the window paints only from tick, guarded on a real 2D context, and rebuilds the marks - never the chains - when a filter moves (mutants: paint-per-draw, chains-rebuilt-per-filter, model-per-tick)', () => {
  withDocument(() => {
    const woods = { heightMapBuffer: new Uint8Array(100).fill(10) };
    const win = open(mkWin({ woods }));
    const m1 = win._ensureModel();
    win._marksDirty = true;
    const m2 = win._ensureModel();
    assert.equal(m1.coast, m2.coast, 'the chains are the cached set');
    assert.equal(m1, m2, 'the model object is kept');
    // a second window over the same bytes shares the chains
    const win2 = mkWin({ woods });
    assert.equal(win2._ensureModel().coast, m1.coast, 'cached on the height bytes');
    win2.dispose();
    // draw() is a no-op: no renderer, no canvas work
    assert.doesNotThrow(() => win.draw(null, null));
    const src = read('src/ui/heldMap.js');
    assert.match(src, /const ctx = canvas\?\.getContext\?\.\('2d'\);\s*\n\s*const model = this\._ensureModel\(\);\s*\n\s*if \(!ctx \|\| !model\) return;/, 'the paint is guarded on the context');
    assert.match(src, /if \(this\._dirty\) this\._paint\(\);/, 'and runs from tick when something changed');
    assert.equal((src.match(/this\._paint\(\)/g) || []).length, 1, 'from tick alone');
    win.dispose();
  });
});
