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
import { test, beforeEach, afterEach } from 'node:test';
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
import { hidesHud } from '../src/ui/windowStack.js';   // MAP-FIELD2: the window that takes the HUD away
import {
  HeldMapWindow, HELD_MAP_URL, appRootFrom, SPRITE, PAPER, THUMB_ZONES, HAND_CHROMA, THUMB_GROW, HELD_MAP_HEIGHT, HELD_MAP_BITE, SPRITE_ART_FOOT, CUFF_BAND, extendCuffs, keyThumbPixels, rgbaCss, wheelPixels,
} from '../src/ui/heldMap.js';
import { simplifyChain, traceChains } from '../src/ui/overworldModel.js';
import { travelMapMarkedMapId, setTravelMapMarkedMapId } from '../src/systems/travelMapState.js';
import { TRAVEL_OPTIONS_TEXT as TO_TEXT, format as toFormat } from '../src/systems/travelOptionsText.js';
import { hasPort, PORT_LOCATION_IDS } from '../src/systems/travelPorts.js';
import { scaleTripCost, ONLINE_TRAVEL_LINE } from '../src/ui/travelPopUp.js';
import { teleportCost } from '../src/ui/travelMapOptions.js';
import { guildFastTravel } from '../src/systems/guildVariants.js';
import {
  buildInkModel, buildInkMarks, paintInk, placeNames, zoomBand, clampView, scaleMinOf, zoomAt, viewCentredOn,
  toPaper, toMap, boundarySegments, linkSegments, landAt, roadChains, markKind, roundCorners,
  paintInkStatic, paintInkOverlay, nameFont,
  BAND_MARKS, BAND_NAMES, SCALE_MAX, PEN, GLYPH_R, paintGlyph,
} from '../src/ui/inkMap.js';
import { PARTY_MARK_CSS } from '../src/ui/partyMapMarks.js';
import { quadPlacement } from '../src/ui/quadMap.js';   // MAP3
// EM1: one map, three sheets
import { createSheetSlot, stripScale, isSheet } from '../src/ui/mapStrip.js';
import { MAP_SHEETS } from '../src/systems/mapTabs.js';
import { getPixelColorIndex } from '../src/ui/travelMapWindow.js';
import { CLIMATES, LOCATION_TYPES, mapPixelToLongitudeLatitude } from '../src/formats/mapsFile.js';
import { SCALED_OCEAN_ELEVATION } from '../src/world/terrainSampler.js';
import {
  travelMapFilters, travelMapPopUpState, setTravelMapPopUpState,
  travelMapSaveData, resetTravelMapState,
} from '../src/systems/travelMapState.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';
// ENH-NOTICE3: the window's click-anywhere boxes ride the enhanced
// notice panel now, so these pins read the stack the way
// test/enhancedNotice.test.js does.
import {
  enhancedNoticeKeys, destroyEnhancedNotice, ENHANCED_NOTICE_ID,
} from '../src/ui/enhancedNotice.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const skin = (v) => { _resetForTests(); globalThis.location = { search: `?skin=${v}` }; };

beforeEach(() => resetTravelMapState());
// ENH-NOTICE3: the panel stack is module state that outlives a fake
// document - a panel left standing would be appended to by the NEXT
// test's document. Dropped after every test, the way the notice
// module's own suite drops it.
afterEach(() => destroyEnhancedNotice());

/** The live notice panels, as the stack holds them: [{ owner, texts }].
 *  LIVE, filtered by the module's own key list: this document's `remove`
 *  is a stub that marks a node rather than detaching it, so a released
 *  panel is still in `stack.children` and reading the DOM alone would
 *  report a notice that is already gone. */
const noticePanels = (doc = globalThis.document) => {
  const live = new Set(enhancedNoticeKeys());
  const stack = (doc?.body?.children ?? []).find((c) => c.id === ENHANCED_NOTICE_ID);
  return (stack?.children ?? [])
    .filter((c) => String(c.className).split(/\s+/).includes('notice') && live.has(c.dataset.owner))
    .map((panel) => ({
      owner: panel.dataset.owner,
      texts: (panel.children.find((c) => c.className === 'notice-body')?.children ?? [])
        .filter((r) => r.style.display !== 'none').map((r) => r.textContent),
    }));
};
const noticeTexts = (doc) => noticePanels(doc).flatMap((p) => p.texts);

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
      // MAP2: the listeners are kept so a pin can fire one (the root's
      // click-anywhere-to-close, the stage's middle click)
      addEventListener(t, fn) { (n.listeners ||= []).push([t, fn]); }, removeEventListener() {},
      setPointerCapture() {}, querySelectorAll: () => [],
      // ENH-NOTICE3: the window raises the enhanced notice panel now,
      // and ui/enhancedNotice.js's stack sets aria-live on its root -
      // so the stub grows the one method that reaches.
      className: '', textContent: '', id: '', attrs: {},
      setAttribute(k, v) { n.attrs[k] = v; },
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
  // MAP-FIELD2: the root is CLEAR on both lanes now - the map is held,
  // so the world is behind it, and the black was what made the sprite a
  // letterboxed picture instead of a pair of hands.
  assert.match(css, /\.hmroot \{\s*\n\s*position: fixed; inset: 0; z-index: 13; overflow: hidden;\s*\n\s*background: transparent;/, 'the held map\'s root is CLEAR - the world is behind the hands');
  assert.doesNotMatch(css, /\.hmroot[^{]*\{[^}]*background: #000/, 'no lane paints its own black');
  assert.match(css, /\.hmink \{ position: absolute; display: block; \}/);
  assert.match(css, /\.hmhands \{[^}]*pointer-events: none;/, 'the hands never take the pointer from the sheet');
});

// ── THE WINDOW'S LAWS ────────────────────────────────────────────

const mkWin = (extra = {}) => new HeldMapWindow(winDeps(extra));
/** Tick the sheet up: the window opens as the sheet RISES (MAP-FIELD7)
 *  and its card is phase-gated on 'map'. */
const open = (win) => { for (let i = 0; i < 20; i++) win.tick(0.05); return win; };

/** How far up the sheet is, read off the stage the way a browser would:
 *  no transform is held, `translateY(N%)` is N per cent down. */
const raiseOf = (win) => {
  const t = win._chrome.stage.style.transform;
  if (!t) return 1;
  const m = /translateY\(([-\d.]+)%\)/.exec(t);
  return m ? 1 - Number(m[1]) / 100 : 1;
};

test('AUDIT MAP-FIELD: the laws these commits argued for, which nothing was checking (mutants: AUDITMAPFIELD-the-bite-is-the-old-one, AUDITMAPFIELD-the-carets-are-ink-again, AUDITMAPFIELD-the-halo-is-the-pen, AUDITMAPFIELD-the-filled-halo-is-not-stroked, AUDITMAPFIELD-the-travel-is-linear)', () => {
  // Every law below was argued at length in a commit message and the
  // arc, and a mutant flipping it SURVIVED the whole file. Found by the
  // pre-merge audit, which is the only reason they are here.

  // MAP-FIELD5, which was unpinned end to end: Mac asked for the sheet
  // LOWER, and every viewport's answer follows from the bite alone. The
  // law is not the literal 0.11 - it is that the painting's foot is
  // carried a real distance past the bottom edge, which 0.03 is not.
  assert.ok(HELD_MAP_BITE >= 0.08, `the sheet sits low: the bite is ${HELD_MAP_BITE}`);
  for (const [vw, vh] of [[1600, 900], [1280, 720], [800, 1200], [640, 360]]) {
    let sh = vh * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sw = sh * SPRITE.w / SPRITE.h;
    if (sw > vw) { sw = vw; sh = sw * SPRITE.h / SPRITE.w; }
    const sy = vh - ((SPRITE_ART_FOOT - HELD_MAP_BITE) * sh);
    // the foot lands BITE * sh past the bottom edge, at every size
    assert.ok((sy + (SPRITE_ART_FOOT * sh)) - vh >= 0.07 * sh,
      `${vw}x${vh}: the painting's foot is carried well past the edge, not just over it`);
  }

  // MAP-FIELD6 #3: the carets are RELIEF, not ink. The commit called
  // quieting them "most of what 'without clutter' asked for", and
  // PEN.relief -> PEN.soft passed every pin.
  assert.ok(PEN.relief !== PEN.soft, 'the relief has a tone of its own');
  const alphaOf = (c) => Number(/,\s*([\d.]+)\)$/.exec(c)[1]);
  assert.ok(alphaOf(PEN.relief) < alphaOf(PEN.soft) * 0.8, 'and it is decidedly lighter than the pen that draws borders and tracks');
  {
    const fx = island();
    const model = buildInkModel({ ...fx, roads: { roads: new Uint8Array(24), tracks: new Uint8Array(24), source: 'basic-roads' } });
    model.high = [{ x: 2, y: 1, peak: false }];
    model.highBands = { far: model.high, mid: model.high, near: model.high };
    const ctx = recordingCtx();
    paintInk(ctx, model, { ox: 0, oy: 0, scale: 8 }, { paperW: 200, paperH: 120, band: 'near' });
    const caret = ctx.calls.find((c) => c.fn === 'moveTo' && c.strokeStyle === PEN.relief);
    assert.ok(caret, 'the high ground is drawn in the relief tone, not the pen that draws everything else');
  }

  // MAP-FIELD6 #2: the halo QUIETS the paper. Setting it to the pen's
  // own colour - a halo that darkens - passed every pin, because every
  // halo assertion compared against PEN.halo itself.
  const rgbOf = (c) => /\((\d+),\s*(\d+),\s*(\d+)/.exec(c).slice(1, 4).map(Number);
  const lumaOf = (c) => { const [r, g, b] = rgbOf(c); return (0.299 * r) + (0.587 * g) + (0.114 * b); };
  assert.ok(lumaOf(PEN.halo) > lumaOf(PEN.line) + 100, 'the halo is PARCHMENT-light, not another pen - it lifts the ink off the sheet rather than ringing it');
  assert.ok(lumaOf(PEN.halo) > lumaOf(PEN.name) + 100, '...lighter than the names it carries too');

  // ...and a FILLED glyph's halo has to be stroked as well as filled,
  // or it sits inside the glyph and shows nothing. The code says so;
  // nothing checked it.
  {
    const ctx = recordingCtx();
    paintGlyph(ctx, 'village', 10, 10, true);
    assert.ok(ctx.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === PEN.halo),
      'a filled glyph is STROKED on the halo pass, or its halo is hidden under it');
    const ink = recordingCtx();
    paintGlyph(ink, 'village', 10, 10, false);
    assert.ok(!ink.calls.some((c) => c.fn === 'stroke'), '...and not on the ink pass, which would fatten the dot');
  }

  // MAP-FIELD7: the sheet is EASED, not linear - "a held thing has
  // weight". smoothstep -> identity passed every pin.
  withDocument(() => {
    // the clock the window actually uses, read off it rather than guessed
    const openS = Number(/const OPEN_S = ([\d.]+);/.exec(read('src/ui/heldMap.js'))[1]);
    const win = mkWin();
    const at = [];
    for (let i = 0; i < 7; i++) { win.tick(openS / 7); at.push(raiseOf(win)); }
    // an eased curve is BELOW the straight line early and above it late
    assert.ok(at[1] < (2 / 7) - 0.02, `eased in: after two sevenths of the clock the sheet is only ${at[1].toFixed(3)} up`);
    assert.ok(at[4] > (5 / 7) + 0.02, `...and eased out: after five sevenths it is already ${at[4].toFixed(3)} up`);
    win.dispose();
  });
});

test('AUDIT MAP-FIELD: a commit survives a teardown, and the retry never takes the sheet into the arm while it is leaving (mutants: AUDITMAPFIELD-dispose-drops-the-commit, AUDITMAPFIELD-the-retry-runs-while-closing)', () => {
  // Both found auditing MAP-FIELD7 before merge.
  //
  // 1. THE JOURNEY SURVIVES A TEARDOWN. The travel/teleport/coords hook
  // only ever fired from tick()'s closing arm, so a host that disposed
  // the window mid-lower - a mode change, an overlay cleared - dropped
  // the trip the player had already paid for, silently.
  withDocument(() => {
    const fired = [];
    const win = open(mkWin({ onTravel: (...a) => fired.push(['travel', ...a]), onClose: () => fired.push(['close']) }));
    win._beginClose({ kind: 'travel', pick: { mapId: 7 }, opts: {}, computed: {} });
    win.tick(0.05);   // mid-lower, the sheet still on its way down
    assert.deepEqual(fired, [], 'nothing has fired yet - the sheet is still coming down');
    win.dispose();
    assert.equal(fired.filter((f) => f[0] === 'travel').length, 1, 'the journey fires rather than being dropped');
    assert.equal(fired.filter((f) => f[0] === 'close').length, 1, 'and onClose is still owed exactly once');
    assert.equal(fired[0][0], 'travel', '...with the travel first, while the window was still alive');
  });
  // ...once, whichever way it goes: a full lower must not fire twice
  withDocument(() => {
    const fired = [];
    const win = open(mkWin({ onTeleport: () => fired.push('teleport'), onClose: () => fired.push('close') }));
    win._beginClose({ kind: 'teleport', pick: { mapId: 9 } });
    for (let i = 0; i < 20; i++) win.tick(0.05);
    win.dispose();
    assert.deepEqual(fired, ['teleport', 'close'], 'the lower fired it, and dispose after found nothing left to fire');
  });

  // 2. THE RETRY DOES NOT RUN WHILE THE SHEET IS LEAVING. The guard on
  // the hands-lane arm said so, but only guarded that arm - the retry
  // fell through at any phase. Taking the arm mid-close hid the
  // painting on the spot and SNAPPED the lowering sheet back up, since
  // _setRaise leaves the hands lane untransformed.
  withDocument(() => {
    let armed = false;
    const holder = holderStub({ corners: () => TRAPEZIUM });
    holder.available = () => armed;
    const win = open(mkWin({ ...bayDeps(), holder }));
    assert.equal(win._lane, 'sprite', 'the arm was not drawn, so the painting stood');
    win._beginClose(null);
    win.tick(0.05);
    const partWay = win._chrome.stage.style.transform;
    assert.match(partWay, /translateY/, 'the sheet is on its way down');
    armed = true;             // the rig poses mid-close - the case the retry exists for
    win.tick(0.05);
    assert.equal(win._lane, 'sprite', 'the arm is NOT taken while the sheet is leaving');
    assert.match(win._chrome.stage.style.transform, /translateY/, '...so the sheet keeps lowering instead of snapping back to held');
    assert.notEqual(win._chrome.stage.style.transform, partWay, 'and it really moved on');
    win.dispose();
  });
});

test('MAP-FIELD7: the sheet TRAVELS in and out at the bottom edge, and the chrome fades where it stands (mutants: MAPFIELD7-the-sheet-fades-again, MAPFIELD7-the-sheet-starts-held, MAPFIELD7-the-chrome-travels-too, MAPFIELD7-a-close-mid-rise-snaps-up)', () => {
  // Mac: "when you open or close your map, I want the sprite to come in
  // and go out at the bottom of the screen instead of fading in".
  withDocument(() => {
    const win = mkWin();
    const c = win._chrome;
    // BEFORE THE FIRST TICK the sheet is already off the bottom, or it
    // shows for one frame in its held place and then jumps down to start
    assert.equal(raiseOf(win), 0, 'mounted DOWN, not mounted held');
    assert.equal(c.card.style.opacity, '0', 'and the chrome is clear with it');
    assert.equal(c.stage.style.opacity, undefined, '...but the STAGE is never faded - that is the whole point');

    const seen = [];
    for (let i = 0; i < 12; i++) { win.tick(0.05); seen.push(raiseOf(win)); }
    assert.ok(seen[0] > 0 && seen[0] < 1, 'it is part way up after one tick - a travel, not a cut');
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], 'and it only ever rises while opening');
    assert.equal(raiseOf(win), 1, 'and it ends HELD, with no transform left on the stage');
    assert.equal(c.stage.style.transform, '', 'exactly none - a stale translateY(0%) is a compositor layer for nothing');
    assert.equal(c.card.style.opacity, '1', 'the chrome arrived too');
    assert.equal(c.stage.style.opacity, undefined, 'and the sheet was never faded on the way, only carried');
    // THE SHEET IS NOT FADED. The fade lives on the chrome rule now, and
    // the root carries the stage, so fading the root would fade the
    // sprite - which is the thing Mac asked to stop.
    assert.ok(!win._chrome.root.style.opacity, 'the root never carries an opacity - that is what faded the sprite');
    assert.match(read('src/ui/heldMap.js'), /for \(const n of c\.root\.children \?\? \[\]\) \{ if \(n !== c\.stage\) n\.style\.opacity = o; \}/,
      'the fade walks the root\'s children and skips the stage BY IDENTITY');

    // ...AND OUT THE SAME WAY
    win._beginClose(null);
    const down = [];
    for (let i = 0; i < 5; i++) { win.tick(0.05); down.push(raiseOf(win)); }
    for (let i = 1; i < down.length; i++) assert.ok(down[i] <= down[i - 1], 'it only ever lowers while closing');
    assert.ok(down[down.length - 1] < 1, 'and it really left');
    win.dispose();
  });

  // A CLOSE ANSWERED MID-RISE lowers from where the sheet IS. The old
  // fade read its start off the DOM; this reads the number the window
  // already holds, and the law is the same - no snap to full first.
  withDocument(() => {
    const win = mkWin();
    win.tick(0.05);
    const caught = raiseOf(win);
    assert.ok(caught > 0 && caught < 1, 'caught it part way up');
    win._beginClose(null);
    win.tick(0.01);
    assert.ok(raiseOf(win) <= caught, 'it lowers from where it was, never jumping to held first');
    win.dispose();
  });

  // ...AND IN THE HANDS LANE NOTHING SLIDES. The arm brings the sheet in
  // itself, and the ink there is laid on the rig's corners by a
  // matrix3d of its own - a translate on the stage would drag the whole
  // sheet off the paper the arm is holding, which is a worse bug than
  // the fade this replaced.
  withDocument(() => {
    const holder = holderStub({ corners: () => TRAPEZIUM });
    const win = open(mkWin({ ...bayDeps(), holder }));
    assert.equal(win._lane, 'hands', 'the fixture really is in the hands lane, or this proves nothing');
    assert.equal(win._chrome.stage.style.transform, '', 'held by the arm: the stage carries no travel of its own');
    win._beginClose(null);
    win.tick(0.05);
    assert.equal(win._chrome.stage.style.transform, '', '...and none on the way out either');
    win.dispose();
  });
});

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
    assert.equal(st.trip.byRoad, undefined, 'AUDIT-MAP2: the relief map\'s byRoad and path went with it - nothing on the card read them');
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
  for (const needle of ['calculateTravelTime(', 'calculateTripCost(', 'travelDays(',
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
  // the edge of the data is NOT a shore: land at the corner of the sheet
  // has two edges against the sea and none along the map's edge
  const corner = { width: 2, height: 2, heightBytes: new Uint8Array([40, 0, 0, 0]), climateAt: () => CLIMATES.Woodlands };
  const cornerChains = linkSegments(boundarySegments(landAt(corner), 2, 2));
  assert.equal(cornerChains.length, 1);
  assert.equal(cornerChains[0].length, 3, 'an open chain of two edges, ending at the map\'s edge');
  // a sheet that is all land draws no coast at all - no box round the bay
  const allLand = { width: 4, height: 3, heightBytes: new Uint8Array(12).fill(40), climateAt: () => CLIMATES.Woodlands };
  assert.equal(boundarySegments(landAt(allLand), 4, 3).length, 0, 'the data\'s outer edge is not drawn');
  // ...and the softened chain is what the pen draws
  const model = buildInkModel(fx);
  assert.equal(model.coast.length, 1);
  assert.ok(model.coast[0].length >= 4, 'simplified and rounded, still a loop');
  const c = model.coast[0];
  assert.deepEqual(c[0], c[c.length - 1], 'and the softened loop still closes');
});

test('MAP1 ink: the corner cut is BOUNDED - a pixel staircase rounds, a long straight run keeps its corner (mutants: chaikin-unbounded, closed-loop-notched)', () => {
  // a square 20 on a side: Chaikin would chamfer each corner by 5; the
  // bound keeps the cut to 1.5 so the square still reads as a square
  const square = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }];
  const r = roundCorners(square);
  assert.deepEqual(r[0], r[r.length - 1], 'closed stays closed');
  const far = r.reduce((m, p) => Math.max(m, Math.min(Math.hypot(p.x, p.y), Math.hypot(p.x - 20, p.y), Math.hypot(p.x - 20, p.y - 20), Math.hypot(p.x, p.y - 20))), 0);
  assert.ok(far <= 1.5 + 1e-9, `no point further than the bound from its corner (${far})`);
  assert.ok(r.some((p) => Math.abs(p.x - 1.5) < 1e-9 && p.y === 0), 'cut 1.5 along the leg, not 5');
  // a one-pixel staircase: the quarter cut, exactly Chaikin's
  const stair = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
  const rs = roundCorners(stair);
  assert.deepEqual(rs[0], { x: 0, y: 0 });
  assert.deepEqual(rs[rs.length - 1], { x: 2, y: 1 }, 'an open chain keeps its ends');
  assert.ok(rs.some((p) => Math.abs(p.x - 0.75) < 1e-9 && p.y === 0), 'a quarter along a one-pixel leg');
  assert.equal(roundCorners([{ x: 0, y: 0 }, { x: 3, y: 0 }]).length, 2, 'two points are a line, untouched');
  // the roads take the same cut
  const ink = read('src/ui/inkMap.js');
  assert.match(ink, /roundCorners\(simplifyChain\(centre\(c\)\)\)/, 'roads');
  assert.match(ink, /return roundCorners\(simplifyChain\(chain, eps\)\);/, 'and the coast and borders');
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
  const arcs = (band, scale) => {
    const ctx = recordingCtx();
    paintInk(ctx, model, { ox: 0, oy: 0, scale }, { paperW: 100, paperH: 60, band });
    return ctx.calls.filter((c) => c.fn === 'arc');
  };
  // MAP-FIELD6: each glyph is laid TWICE - once in the halo, once in
  // ink - so every count here is doubled against the reading before it.
  // A city is a dot and a ring, so four arcs; near, the hamlet's dot
  // adds two more.
  assert.equal(arcs('far', 1).length, 4, 'far: the city (a dot and a ring, haloed then inked) alone');
  assert.equal(arcs('near', 8).length, 6, 'near: the hamlet\'s dot joins it');
  // and EVERY halo is laid before ANY ink. This needs two marks to say
  // at all: with one, halo-then-ink per mark and halo-pass-then-ink-pass
  // are the same sequence. With two it is the whole point - a halo laid
  // per mark falls on the ink of the neighbour already drawn, and bites
  // a hole in it.
  const near = arcs('near', 8);
  const lastHalo = near.map((c) => c.strokeStyle).lastIndexOf(PEN.halo);
  const firstInk = near.map((c) => c.strokeStyle).indexOf(PEN.line);
  assert.ok(near.some((c) => c.strokeStyle === PEN.halo) && near.some((c) => c.strokeStyle === PEN.line), 'both passes ran');
  assert.ok(lastHalo < firstInk, 'every halo is down before the first ink - not halo-then-ink one mark at a time');
  assert.ok(near[lastHalo].lineWidth > near[firstInk].lineWidth, 'and the halo is the fatter pen, or it would clear nothing');
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
  // MAP-FIELD6: and what RANK buys is now the better side rather than
  // the only one - a loser has three more places to try, so the law has
  // to be read where it still shows. Set a city and a hamlet close
  // enough that only one can take the right-hand side, hamlet first in
  // the list so that ignoring rank would hand it the spot.
  const sided = [
    { x: 25, y: 7.5, colorIndex: 12, kind: 'hamlet', name: 'Hamletton', summary: {} },
    { x: 25, y: 5, colorIndex: 11, kind: 'city', name: 'Cityville', summary: {} },
  ];
  const bySide = placeNames(sided, view, 'near', { paperW: 300, paperH: 100, measure });
  const city = bySide.find((n) => n.mark.name === 'Cityville');
  const hamlet = bySide.find((n) => n.mark.name === 'Hamletton');
  assert.ok(city && hamlet, 'both are named - neither is squeezed out');
  assert.ok(city.x > toPaper(view, 25, 5)[0], 'the CITY takes the right-hand side, where a label is looked for');
  assert.ok(hamlet.x + hamlet.w < toPaper(view, 25, 7.5)[0], '...and the hamlet, ranked under it, is set to the left');
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
  // MAP-FIELD6: and each is HALOED first, in the same face, so the two
  // passes cannot drift apart and leave a name stroked in one size and
  // filled in another
  const haloed = ctx.calls.filter((c) => c.fn === 'strokeText');
  assert.deepEqual(haloed.map((c) => c.args[0]), ['Cityville', 'Farvale'], 'every name laid in halo first');
  assert.ok(haloed.every((c) => c.strokeStyle === PEN.halo), 'in the halo, not the pen');
  assert.deepEqual(haloed.map((c) => c.font), texts.map((c) => c.font), 'and in the face the ink uses');
});

test('MAP-FIELD6: a name never lands on another mark\'s GLYPH - it takes another side of its own, or it is dropped (mutants: MAPFIELD6-names-ignore-glyphs, MAPFIELD6-one-candidate-only)', () => {
  // Mac: "Some of the glyphs are hard to read." The fault he could see
  // rather than name: placeNames tested a label only against other
  // LABELS, so it was free to run straight through the next town's mark.
  const measure = (t, size) => t.length * size * 0.5;
  const view = { ox: 0, oy: 0, scale: 4 };
  // AUDIT MAP-FIELD: the box placeNames RESERVED, not a fourth one
  // invented here. This pin used to rebuild the rectangle from the
  // baseline with its own guessed offset, which matched none of the
  // three the code was using - so it was testing a rectangle nothing
  // drew, ~4px below what was reserved. It is returned now.
  const box = (n) => n.box;
  const clear = (n, m) => {
    const [gx, gy] = toPaper(view, m.x, m.y);
    const r = GLYPH_R[m.kind], b = box(n);
    return !(gx - r < b.x + b.w && gx + r > b.x && gy - r < b.y + b.h && gy + r > b.y);
  };
  // two cities close enough that the first's label, set to the right as
  // every label was, would run through the second's ring
  const pair = [
    { x: 50, y: 5, colorIndex: 11, kind: 'city', name: 'Wayrest', summary: {} },
    { x: 57.5, y: 5, colorIndex: 11, kind: 'city', name: 'Daggerfall', summary: {} },
  ];
  const placed = placeNames(pair, view, 'near', { paperW: 400, paperH: 120, measure });
  assert.equal(placed.length, 2, 'BOTH are named - a blocked label has other sides to try, and silence is the last resort');
  for (const n of placed) for (const m of pair) {
    assert.ok(clear(n, m), `${n.mark.name} must not be written over ${m.name}'s glyph`);
  }
  const way = placed.find((n) => n.mark.name === 'Wayrest');
  assert.ok(way.x + way.w <= toPaper(view, 50, 5)[0] - GLYPH_R.city,
    'Wayrest had to leave the right-hand side, where its label would have crossed Daggerfall\'s ring, and set itself to the left');
  // AUDIT MAP-FIELD: BOUNDED ON BOTH AXES. The four candidates bounded
  // x alone at first, so a label with both sides blocked was placed
  // wholly off the top of the sheet - painted where nobody can see it
  // AND holding a box that then blocked a neighbour that could have
  // been drawn, which is strictly worse than the drop the design
  // intends. A fault this work introduced: the one candidate it
  // replaced always sat at the mark's own height.
  const high = [
    { x: 25, y: 1, colorIndex: 11, kind: 'city', name: 'Northmost', summary: {} },
    { x: 25, y: 6, colorIndex: 11, kind: 'city', name: 'Blocker', summary: {} },
  ];
  const narrow = placeNames(high, { ox: 0, oy: 0, scale: 2 }, 'near', { paperW: 100, paperH: 200, measure: () => 60 });
  assert.ok(!narrow.some((n) => n.mark.name === 'Northmost'),
    'a label with no room on either side, and none above without leaving the sheet, is DROPPED - not painted off the top');
  for (const n of narrow) {
    assert.ok(n.box.y >= 0 && n.box.y + n.box.h <= 200, `${n.mark.name}'s box is on the paper vertically`);
    assert.ok(n.box.x >= 0 && n.box.x + n.box.w <= 100, `${n.mark.name}'s box is on the paper horizontally`);
  }
  // ...and the box a placement RESERVES is the box its ink fills. The
  // first draft related each candidate's box to its baseline by a
  // different offset and then threw the box away, so no consumer could
  // rebuild it and this pin invented a fourth rectangle of its own.
  for (const n of [...narrow, ...placed]) {
    assert.ok(n.box.y <= n.y - (n.size * 0.75), `${n.mark.name}: the box covers the ASCENDERS above the baseline`);
    assert.ok(n.box.y + n.box.h >= n.y + (n.size * 0.25), `${n.mark.name}: ...and the DESCENDERS below it`);
    assert.equal(n.box.x, n.x, `${n.mark.name}: the box starts where the text starts`);
    assert.equal(n.box.w, n.w, `${n.mark.name}: ...and is as wide as the text measured`);
  }

  // and when there is NOWHERE clear, the name goes rather than the mark:
  // a town ringed by glyphs on all four sides keeps its mark and loses
  // its label, which is the trade that makes the sheet readable
  const boxed = [
    { x: 20, y: 20, colorIndex: 12, kind: 'hamlet', name: 'Hemmed In', summary: {} },
    ...[[14, 20], [26, 20], [20, 16], [20, 24]].map(([x, y], i) => ({ x, y, colorIndex: 11, kind: 'city', name: `R${i}`, summary: {} })),
  ];
  const tight = placeNames(boxed, view, 'near', { paperW: 200, paperH: 200, measure: (t) => t.length * 4 });
  assert.ok(!tight.some((n) => n.mark.name === 'Hemmed In'), 'no room anywhere: the label is dropped, not smeared over a neighbour');
  assert.ok(tight.length > 0, '...while the neighbours that DO have room keep theirs - the drop is per name, not a bail-out');
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
    const model = win._sheet.ensure();
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
    // EM3: the SHEET answers and the window writes, so the label is
    // asked of the sheet's return rather than read off the chrome
    assert.deepEqual(win._hoverLabel(nx, ny),
      { label: 'Daggerfall : Wayrest', cursor: 'pointer' }, 'the summary\'s region 17, then the name');
    assert.deepEqual(win._hoverLabel(...toPaper(win._view, 1.5, 1.5)),
      { label: 'Alik\'r Desert', cursor: '' }, 'the politic read, region 0');
    win.dispose();
  });
});

test('MAP1 window: pan, wheel and keys move the VIEW under a clamp, the search glides to its pick, and the layout lays the sheet on PAPER of a 4:3 stage (mutants: pan-unclamped, zoom-not-at-cursor, layout-off-paper)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const win = open(mkWin({ mapSize: { width: 1000, height: 500 }, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) } }));
      // MAP-FIELD2 (Mac): the sheet is HELD - the stage is the sprite's
      // 4:3 at HELD_MAP_HEIGHT of the viewport, centred across it and
      // anchored to its BOTTOM, pushed HELD_MAP_OVERHANG of its own
      // height further down so the arms leave the frame.
      const sh = 900 * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sw = sh * SPRITE.w / SPRITE.h;
      assert.ok(sw < 1600, 'this viewport is wide enough that the height rules');
      assert.deepEqual(win._stage, { x: (1600 - sw) / 2, y: 900 - (SPRITE_ART_FOOT - HELD_MAP_BITE) * sh, w: sw, h: sh });
      // THE LAW, not the arithmetic: it sits on the bottom edge and goes
      // PAST it, so there is no gap under the arms at any size.
      assert.ok(win._stage.y + win._stage.h * SPRITE_ART_FOOT > 900, 'the PAINTING\'s foot is below the viewport\'s - the file\'s foot is a fifth of matte lower and means nothing');
      assert.ok(win._stage.y < 900 * 0.2, '...and its head is high on the screen, so the sheet is big enough to read');
      const pw = sw * (PAPER.x1 - PAPER.x0), ph = sh * (PAPER.y1 - PAPER.y0);
      assert.ok(Math.abs(win._paper.w - pw) < 1e-9 && Math.abs(win._paper.h - ph) < 1e-9, 'the canvas is the paper\'s rectangle');
      assert.equal(win._chrome.ink.style.left, `${sw * PAPER.x0}px`);
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
  // MAP-FIELD (2026-09-18, Mac: "The sprite I gave to be used is nowhere
  // to be seen at all"): THE URL IS RESOLVED FROM THE MODULE, NOT THE
  // DOCUMENT. It was the bare relative 'art/held-map.png' - and this pin
  // asserted that string, and a mutant that made it absolute DIED here,
  // so the wrong answer was locked in twice over. The game's document is
  // /play/index.html: the browser asked for /play/art/held-map.png, got
  // the page back instead of a PNG, and the window stood with no
  // parchment and no hands. The build's base is './', so there is no
  // absolute path to hardcode; the module's own URL carries the root.
  assert.ok(HELD_MAP_URL.endsWith('/art/held-map.png'), `the sprite hangs off a root: ${HELD_MAP_URL}`);
  assert.notEqual(HELD_MAP_URL, 'art/held-map.png', 'never the bare document-relative form - that is the bug');
  // AUDIT-FIELD: and the EXPORT is the helper's answer, not the module's
  // own directory. The two lines above pass for `new URL('art/...',
  // import.meta.url)` - the obvious regression, and the same CLASS as the
  // bug this commit exists for - because that also ends in the right
  // characters. Every strong assertion below is on the pure helper, which
  // the export could simply stop calling.
  assert.doesNotMatch(HELD_MAP_URL, /\/(?:assets|src)\//, 'the sprite hangs off the ROOT, never off the module directory');
  assert.equal(HELD_MAP_URL, new URL('art/held-map.png', appRootFrom(import.meta.url.replace('/test/', '/src/ui/'))).href,
    'the export IS appRootFrom\'s answer');
  assert.equal(appRootFrom('https://daggerfalljs.dev/assets/main-abc123.js'), 'https://daggerfalljs.dev/',
    'a build serves the module from <root>/assets/');
  assert.equal(appRootFrom('https://example.test/sub/path/assets/main-abc123.js'), 'https://example.test/sub/path/',
    '...and under a project sub-path, which is why base is relative');
  assert.equal(appRootFrom('http://localhost:5173/src/ui/heldMap.js'), 'http://localhost:5173/',
    'the dev server serves it from <root>/src/');
  assert.equal(appRootFrom('http://localhost:5173/src/ui/heldMap.js?t=1700000000'), 'http://localhost:5173/',
    '...with the dev server\'s own cache-busting query cut off');
  // AUDIT-FIELD F3: THE LAST SUCH SEGMENT, NOT THE FIRST. JS regex matching
  // is leftmost-first and `.*$` being greedy only decides the tail, so the
  // first cut cut at the FIRST `/assets/` or `/src/` on the path. A tree
  // with a directory named exactly `assets` or `src` ABOVE the build's own
  // - unpack dist/ into ~/public_html/assets/dfjs/ and you have one - lost
  // every segment below it and the sprite 404'd again, one directory up
  // from where it lives. The sub-path row above cannot catch this: its
  // sub-path is `/sub/path/`, which contains neither word.
  assert.equal(appRootFrom('https://h.test/assets/dfjs/assets/main-abc.js'), 'https://h.test/assets/dfjs/',
    'a root UNDER a directory called assets keeps every segment below it');
  assert.equal(appRootFrom('https://h.test/a/src/b/assets/main-abc.js'), 'https://h.test/a/src/b/',
    '...and one under a directory called src does too');
  assert.equal(appRootFrom('https://h.test/my-assets/app/assets/main-abc.js'), 'https://h.test/my-assets/app/',
    'and a segment that merely ENDS in assets was never the cut - it takes the slash');
  // AUDIT-FIELD F4: the shapes with no root to find answer null rather than
  // guessing. `blob:`/`data:` cannot be a base at all, and `new URL('art/..',
  // blobUrl)` THROWS - at module evaluation, in a file scenes/world.js
  // imports statically through travelMapDoor.js, so the throw would cost the
  // whole scene and not just the map. A path with neither segment is not a
  // shape this app is served from, and answering the module's own directory
  // there is how the bug this helper exists for looked.
  for (const noRoot of ['blob:https://h.test/0f0f', 'data:text/javascript,0', 'https://h.test/main-abc.js']) {
    assert.equal(appRootFrom(noRoot), null, `no root to find in ${noRoot}`);
  }
  assert.doesNotThrow(() => appRootFrom('blob:https://h.test/0f0f'), 'and it never throws - the import chain rides on it');
  assert.equal(new URL('art/held-map.png', appRootFrom('https://daggerfalljs.dev/assets/main-abc123.js')).href,
    'https://daggerfalljs.dev/art/held-map.png', 'and the sprite lands at the site root, whatever page asked');
  assert.ok(existsSync(new URL('../public/art/held-map.png', import.meta.url)), 'the file ships');
  assert.match(read('test/doctrine.test.js'), /\['public\/art\/held-map\.png', "OURS - Mac's own painting/, 'under the OURS row');
  assert.deepEqual(SPRITE, { w: 1448, h: 1086 });
  assert.ok(PAPER.x0 < THUMB_ZONES[0].x1 && THUMB_ZONES[1].x0 < PAPER.x1, 'the thumb zones reach INTO the paper - that is why they exist');
  assert.ok(THUMB_ZONES[0].y0 > PAPER.y0 && THUMB_ZONES[0].y1 >= PAPER.y1, 'and only its lower half, where the thumbs rest');
  // ...and each STARTS on its own hand, outside the sheet, because that
  // outer column is what the blob is seeded down
  assert.ok(THUMB_ZONES[0].x0 < PAPER.x0 && THUMB_ZONES[1].x1 > PAPER.x1, 'each zone reaches out past the paper, onto the hand it is seeded from');
  assert.deepEqual(THUMB_ZONES.map((z) => z.side), ['left', 'right'], 'and each names the side it is entered from');

  // MAP-FIELD4: THE KEY IS A COLOUR, NOT A BRIGHTNESS. Three paintings
  // proved brightness cannot do this - on this one the sheet's burnt
  // border falls to luma 37 while the glove's lit ridges reach 212 - so
  // the seed is red-minus-blue, on which parchment is warm everywhere
  // and steel is not. tools/heldMapArtProbe.mjs measures both halves.
  assert.equal(HAND_CHROMA, 75);
  assert.ok(THUMB_GROW > 0, 'and the close has a radius, or the lit ridge down the thumb stays a seam');
  // A zone with the thumb entering from the left: steel at the seeded
  // edge, warm parchment beyond it, and one dark SPECK of crack in the
  // middle of the sheet. The speck is the whole point - it is under the
  // seed line, and a threshold key would have laid it on the map.
  const STEEL = [90, 84, 88], WARM = [206, 166, 114], SPECK = [120, 96, 70];
  const w = 12, h = 6;
  const zone = new Uint8ClampedArray(w * h * 4);
  const set2 = (buf, x, y, [r, g, b]) => { const i = ((y * w) + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; };
  const set = (x, y, c) => set2(zone, x, y, c);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, x < 4 ? STEEL : WARM);
  set(9, 3, SPECK);
  assert.ok(SPECK[0] - SPECK[2] < HAND_CHROMA, 'the speck really is under the seed line - otherwise this pin proves nothing');
  keyThumbPixels(zone, w, h, 'left', HAND_CHROMA, 0);
  const alpha = (x, y) => zone[(((y * w) + x) * 4) + 3];
  assert.equal(alpha(0, 3), 255, 'the steel at the seeded edge stays - it is the thumb');
  assert.equal(alpha(3, 3), 255, '...to its far side');
  assert.equal(alpha(5, 3), 0, 'the parchment beyond it goes clear');
  assert.equal(alpha(9, 3), 0, 'and so does the speck - an island the flood cannot reach, however dark it is');
  // seeded from the OTHER side, the same zone keeps nothing: the flood
  // starts on parchment and never reaches the steel
  const flipped = new Uint8ClampedArray(zone.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y * w) + x) * 4; const c = x < 4 ? STEEL : WARM;
    flipped[i] = c[0]; flipped[i + 1] = c[1]; flipped[i + 2] = c[2]; flipped[i + 3] = 255; }
  keyThumbPixels(flipped, w, h, 'right', HAND_CHROMA, 0);
  assert.equal(flipped[(((3 * w) + 0) * 4) + 3], 0, 'seeded from the wrong side, the thumb is not found at all - `side` is load-bearing');
  // OFF THE PAINTING IS NOT STEEL. A transparent pixel reads as red 0,
  // blue 0 - a difference of 0 - so it passes a bare colour test, and
  // without the alpha check the flood runs out through the clear ground
  // around the hand. The damage is not the clear ground itself, which
  // stays invisible whatever is decided about it: it is that clear
  // ground SURROUNDS, and anything it encircles is then enclosed, so
  // the fill hands it back. A zone that is all clear but for one island
  // of parchment is the case that shows it.
  const clear = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y <= 3; y++) for (let x = 4; x <= 7; x++) set2(clear, x, y, WARM);
  keyThumbPixels(clear, w, h, 'left', HAND_CHROMA, 0);
  assert.equal(clear[(((2 * w) + 5) * 4) + 3], 0,
    'clear ground seeds nothing, so the island it surrounds is not handed back as thumb');
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
    const m1 = win._sheet.ensure();
    win._marksDirty = true;
    const m2 = win._sheet.ensure();
    assert.equal(m1.coast, m2.coast, 'the chains are the cached set');
    assert.equal(m1, m2, 'the model object is kept');
    // a second window over the same bytes shares the chains
    const win2 = mkWin({ woods });
    assert.equal(win2._sheet.ensure().coast, m1.coast, 'cached on the height bytes');
    win2.dispose();
    // draw() is a no-op: no renderer, no canvas work
    assert.doesNotThrow(() => win.draw(null, null));
    const src = read('src/ui/heldMap.js');
    // EM1: the paint asks the live SHEET for its model and is guarded
    // on both - a context the stub canvas will not give, and a sheet
    // with nothing to ink.
    assert.match(src, /const model = sheet\?\.ensure\?\.\(\) \?\? null;\s*\n\s*if \(!ctx \|\| !model\) return;/, 'the paint is guarded on the context and the sheet');
    assert.match(src, /const ctx = canvas\?\.getContext\?\.\('2d'\);/, 'and the context is the canvas\'s own');
    assert.match(src, /if \(this\._dirty\) this\._paint\(\);/, 'and runs from tick when something changed');
    assert.equal((src.match(/this\._paint\(\)/g) || []).length, 1, 'from tick alone');
    win.dispose();
  });
});

// ═══ MAP2: TRAVEL OPTIONS ON THE SHEET ═══════════════════════════════
//
// bible/10-UI/Held-Map-Arc.md: "each through the same functions the
// classic window calls, so the two never drift." The fake mod below is
// the settings shape systems/travelOptions.js hands the windows.

const fire = (node, type, ev) => { for (const [t, fn] of node.listeners ?? []) if (t === type) fn(ev); };
/** A port's map id, off the mod's own list, so the harbour laws are asked
 *  about a REAL port rather than a made-up one. */
const A_PORT = PORT_LOCATION_IDS[0];
const modSettings = (over = {}) => ({
  shipTravelPortsOnly: true, targetCoordsAllowed: true, cautiousTravel: true, stopAtInnsTravel: false,
  cautiousTravelMultiplier: 0.8, recklessTravelMultiplier: 1, markLocationColor: [255, 235, 5, 255], teleportCost: false,
  ...over,
});
const modDeps = (extra = {}, settings = {}, mod = {}) => {
  const mapDict = new Map();
  const put = (x, y, t, mapID) => { const sm = summaryOf(x, y, t, { mapID }); mapDict.set(sm.id, sm); return sm; };
  put(3, 3, LOCATION_TYPES.TownCity, A_PORT);          // a harbour town
  put(8, 6, LOCATION_TYPES.TownHamlet, 555001);        // an inland hamlet
  const to = { settings: modSettings(settings), destinationName: null, isTravelActive: false, ...mod };
  // the find box's dictionary: name index 1 ('B') is the inland hamlet at (8,6), index 3 ('Wayrest') the port at (3,3)
  const row = (x, y) => ({ ...mapPixelToLongitudeLatitude(x, y) });
  const mapTable = [row(0, 0), row(8, 6), row(0, 0), row(3, 3)].map((r) => ({ longitude: r.x, latitude: r.y }));
  return winDeps({
    mapDict,
    maps: { regionCount: 1, getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Wayrest'], mapTable, mapNameLookup: new Map() }), getPoliticIndex: () => 128 },
    travelOptions: () => to, coordsAllowed: () => true,
    ...extra,
  });
};

test('MAP2 ports: the filter is the mod\'s law (portsFilterAllows over hasPort) before DFU\'s own discovery test - marks, the find box and the click-through all lose an inland place; the button shows only while the mod restricts ships; per-open; P toggles (mutants: ports-ignored-by-marks, ports-outlives-window, ports-button-always, harbour-at-far)', () => {
  assert.equal(hasPort(A_PORT), true, 'the fixture\'s port is on the mod\'s list');
  withDocument(() => {
    const win = open(mkWin(modDeps()));
    assert.equal(win._chrome.ports.style.display, 'inline-block', 'the ports button, while ShipTravel.OnlyFromPorts is on');
    assert.deepEqual(win._sheet.ensure().marks.map((m) => [m.kind, m.port]), [['city', true], ['hamlet', false]], 'the harbour flag rides the mark');
    win.input('KeyP');
    assert.equal(win.portsFilter, true);
    assert.equal(win._chrome.ports.textContent, 'Ports only');
    assert.deepEqual(win._sheet.ensure().marks.map((m) => m.kind), ['city'], 'the inland hamlet is not on the map at all');
    assert.equal(win._discovered(win.deps.mapDict.get(summaryOf(8, 6, 0).id)), false, 'the one law the search and the click-through ask too');
    assert.equal(win._discovered(win.deps.mapDict.get(summaryOf(3, 3, 0).id)), true);
    // (the ladder still answers the next-best DISCOVERED name, as FindLocation's own does - the cutoff is set at the first kept match)
    assert.ok(!win._findLocations('B').some((e) => e.name === 'B'), 'the find box cannot find the inland hamlet either');
    assert.deepEqual(win._findLocations('Wayrest').map((e) => e.name), ['Wayrest'], 'but the port is there');
    win.input('KeyP');
    assert.equal(win._sheet.ensure().marks.length, 2, 'and back');
    assert.equal(win._findLocations('B')[0]?.name, 'B', 'and so is the hamlet, to the find box');
    // the harbour glyph: beside a port at mid and near, never at far, and
    // only while the mod restricts ships to ports
    const harbours = (band, scale, ports) => {
      const ctx = recordingCtx();
      paintInk(ctx, win._sheet.ensure(), { ox: 0, oy: 0, scale }, { paperW: 200, paperH: 200, band, ports });
      return ctx.calls.filter((c) => c.fn === 'arc' && c.lineWidth === 1.1).length;
    };
    assert.equal(harbours('near', 10, true), 1, 'one anchor, beside the port');
    assert.equal(harbours('far', 1, true), 0, 'none at far');
    assert.equal(harbours('near', 10, false), 0, 'none while ships may sail from anywhere');
    win.dispose();
    // per-open (departure 6): a fresh window opens with the filter off
    const again = mkWin(modDeps());
    assert.equal(again.portsFilter, false);
    again.dispose();
    // no button without the restriction, and P does nothing
    const free = open(mkWin(modDeps({}, { shipTravelPortsOnly: false })));
    assert.equal(free._chrome.ports.style.display, 'none');
    free.input('KeyP');
    assert.equal(free.portsFilter, false);
    free.dispose();
  });
});

test('MAP2 mark: the middle click marks the place under the cursor through the SHARED store and clears it on a second, and the ring is inked in MarkLocationColor at every band (mutants: mark-per-window, mark-never-clears, mark-ring-hidden-at-far, mark-colour-ignored)', () => {
  withDocument(() => {
    setTravelMapMarkedMapId(-1);
    const win = open(mkWin(modDeps()));
    const [cx, cy] = toPaper(win._view, 8.5, 6.5);
    win._markLocationHandler(cx, cy);
    assert.equal(win.markedMapId, 555001, 'the hamlet is marked');
    assert.equal(travelMapMarkedMapId(), 555001, 'in the store, where the junction map reads it after the sheet closes');
    // the stage's own middle button does the same, and does not pan
    fire(win._chrome.stage, 'pointerdown', { button: 1, pointerId: 1, clientX: cx, clientY: cy, preventDefault() {} });
    assert.equal(win.markedMapId, -1, 'a second middle click clears it');
    win._markLocationHandler(cx, cy);
    assert.equal(win.markedMapId, 555001);
    // the ring: at FAR the hamlet itself is not inked, the mark still is
    const rings = (band, scale) => {
      const ctx = recordingCtx();
      paintInk(ctx, win._sheet.ensure(), { ox: 0, oy: 0, scale }, { paperW: 200, paperH: 200, band, markedMapId: win.markedMapId, markColor: rgbaCss([255, 235, 5, 255]) });
      return ctx.calls.filter((c) => c.fn === 'arc' && c.strokeStyle === 'rgba(255, 235, 5, 1)');
    };
    assert.equal(rings('far', 1).length, 1, 'the mark at far, though the hamlet is not');
    assert.equal(rings('near', 10).length, 1);
    assert.deepEqual(rings('near', 10)[0].args.slice(0, 2), toPaper({ ox: 0, oy: 0, scale: 10 }, 8.5, 6.5), 'on the marked place');
    // the window's own paint hands the pen the SETTING's colour
    const ctx = recordingCtx();
    win._chrome.ink.getContext = () => ctx;
    win._dirty = true; win._paint();
    delete win._chrome.ink.getContext;
    assert.equal(ctx.calls.filter((c) => c.fn === 'arc' && c.strokeStyle === 'rgba(255, 235, 5, 1)').length, 1, 'MarkLocationColor, from the mod\'s settings');
    assert.equal(rgbaCss([255, 235, 5, 128]), 'rgba(255, 235, 5, 0.502)');
    assert.equal(rgbaCss(null), null, 'no setting, no ring');
    setTravelMapMarkedMapId(-1);
    win.dispose();
  });
});

test('MAP2 I and H: the building list through locationInfoRows in a box any key or click closes; no knowledge in the mod\'s words; the host\'s help rows in the same box (mutants: info-ignores-guild-line, info-stays-on-key, info-stays-on-click, help-without-rows-silent)', () => {
  withDocument(() => {
    const buildings = [
      { buildingType: 0, displayName: 'The Odd Blades' }, { buildingType: 0, displayName: 'Another' },
      { buildingType: 11, displayName: 'The Fighters Guild' },
    ];
    let helped = 0;
    const win = open(mkWin(modDeps({
      discoveredBuildings: () => buildings, buildingTypeName: (t) => (t === 0 ? 'Alchemist' : String(t)),
      helpRows: () => ['line one', 'line two'], onHelp: () => helped++,
    })));
    win._pickAt(...toPaper(win._view, 3.5, 3.5));
    assert.equal(win._selected?.name, 'Wayrest');
    win.input('KeyI');
    assert.equal(win._info.title, 'Wayrest');
    assert.deepEqual(win._info.rows, ['Guild Halls:    Fighters Guild'], 'the guild hall NAMED, never counted');
    assert.deepEqual(win._info.cells, ['Alchemist  2'], 'the shops counted by type');
    // ENH-NOTICE3: on the enhanced skin (this suite's default) the
    // words are the notice panel's and the .hmbox stays shut - the
    // classic arm of that is pinned below, in the ENH-NOTICE3 test.
    assert.equal(win._chrome.box.style.display, 'none');
    assert.deepEqual(noticeTexts(), ['Wayrest', 'Guild Halls:    Fighters Guild', 'Alchemist  2']);
    win.input('KeyS');
    assert.equal(win._info, null, 'ANY key closes it...');
    assert.equal(win._panelState?.opts?.speedCautious ?? true, true, '...and does nothing else that press');
    win.input('KeyI');
    fire(win._chrome.root, 'pointerdown', { button: 0, stopPropagation() {} });
    assert.equal(win._info, null, '...as does a click anywhere');
    // no knowledge: the mod's own sentence
    const none = open(mkWin(modDeps({ discoveredBuildings: () => [] })));
    none._pickAt(...toPaper(none._view, 3.5, 3.5));
    none.input('KeyI');
    assert.deepEqual(none._info.rows, [toFormat(TO_TEXT.MsgNoKnowledge, 'Wayrest')]);
    assert.ok(noticeTexts().includes(toFormat(TO_TEXT.MsgNoKnowledge, 'Wayrest')),
      'ENH-NOTICE3: DaggerfallUI.MessageBox(MsgNoKnowledge) is the panel too (TravelOptionsMapWindow.cs:462)');
    none.dispose();
    // H: the host's rows; with none, the host's own box
    win.input('KeyH');
    assert.deepEqual(win._info.rows, ['line one', 'line two']);
    win._closeInfo();
    win.dispose();
    const mute = open(mkWin(modDeps({ helpRows: () => null, onHelp: () => helped++ })));
    mute.input('KeyH');
    assert.equal(helped, 1, 'the host\'s onHelp when it hands no rows');
    mute.dispose();
  });
});

// ── ENH-NOTICE3: THE MAP'S OWN BOXES, ON THE PANEL ───────────────

test('ENH-NOTICE3: the card\'s refusal and the I/H box land in the notice panel, leave on the window\'s own dismissal and on its teardown, and the classic skin keeps the card (mutants: card-text-left-in-the-card, box-still-opened, no-release-on-dismissal, no-release-on-teardown, panel-on-the-classic-skin)', () => {
  const buildings = [{ buildingType: 0, displayName: 'The Odd Blades' }];
  const deps = () => modDeps({
    gold: () => 0, goldPieces: () => 0,
    discoveredBuildings: () => buildings, buildingTypeName: () => 'Alchemist',
  });
  // ── the enhanced skin: the words are the panel's ──────────────
  skin('enhanced');
  withDocument((doc) => {
    const win = open(mkWin(deps()));
    win._pickAt(...toPaper(win._view, 3.5, 3.5));
    win._openPanel('travel');
    assert.deepEqual(enhancedNoticeKeys(), [], 'a card with nothing to refuse raises no panel');

    // DaggerfallTravelPopUp.cs:394-406 - showNotEnoughGoldPopup, ClickAnywhereToClose
    win._begin();
    const refusal = win._panelState.notice;
    assert.match(refusal, /gold/, 'the gate really refused - the pin needs a box to move');
    assert.deepEqual(noticeTexts(doc), [refusal], 'the refusal is the panel\'s words, verbatim');
    assert.equal(enhancedNoticeKeys().length, 1, 'one box, one panel');
    assert.equal(
      win._chrome.card.children.filter((c) => c.className === 'hmnotice').length, 0,
      'and NOTHING of it is left in the card - two faces for one box is the bug this closes',
    );

    // the I/H box over the card: a SECOND panel, not a blanking of the first
    win.input('KeyI');
    assert.equal(enhancedNoticeKeys().length, 2, 'the two boxes are independent owners');
    assert.equal(win._chrome.box.style.display, 'none', 'the .hmbox itself never opens - an empty frame is not a notice');
    // (AUDIT-MAP H6's `hmmodal` survives the move off `open` - pinned
    // on the source in the H6/perf test above, because this document's
    // classList is a stub that records nothing.)
    assert.ok(noticeTexts(doc).includes('Wayrest'), 'the info box\'s title rides the panel');

    // THE WINDOW'S OWN DISMISSAL: any key closes the info box (:449-453)
    win.input('KeyS');
    assert.equal(win._info, null);
    assert.equal(enhancedNoticeKeys().length, 1, 'the info panel went with the box it belonged to...');
    assert.deepEqual(noticeTexts(doc), [refusal], '...and the card\'s refusal stayed put');
    // ...and the card's own: closing the travel panel clears its notice
    win._closePanel();
    assert.deepEqual(enhancedNoticeKeys(), [], 'no box, no panel');

    // AND ON THE UNMOUNT: a HELD panel arms no watchdog, so a window
    // torn down with a box up leaks it over the world for the session
    win._openPanel('travel');
    win._begin();
    win.input('KeyI');
    assert.equal(enhancedNoticeKeys().length, 2, 'both up when the teardown comes');
    win.dispose();
    assert.deepEqual(enhancedNoticeKeys(), [], '_teardown releases BOTH owners');

    // THE THIRD BOX: the teleport fee refusal, TravelOptionsMapWindow
    // .cs:497-500's DaggerfallUI.MessageBox(notEnoughGoldId) - the same
    // kind, on the panel; the card keeps its Close (the map's own exit)
    const poor = open(mkWin(modDeps({ magesGuildRank: () => 0, gold: () => 0 }, { teleportCost: true })));
    poor.activateTeleportationTravel();
    poor._pickAt(...toPaper(poor._view, 3.5, 3.5));
    assert.equal(poor._panelState.fee.canPay, false, 'the fee really refused - the pin needs a box to move');
    assert.deepEqual(noticeTexts(doc), ['You do not have enough gold.'], 'mutant: the fee refusal left as the card\'s own prompt');
    assert.equal(poor._chrome.card.children.filter((c) => c.className === 'hmprompt').length, 0, 'and nothing of it in the card');
    assert.equal(poor._chrome.card.children.filter((c) => c.className === 'hmacts').length, 1, 'the Close stays');
    poor.dispose();
    assert.deepEqual(enhancedNoticeKeys(), [], 'released with the map');
  });

  // ── the classic skin: byte for byte what it always drew ───────
  skin('classic');
  withDocument((doc) => {
    const win = open(mkWin(deps()));
    win._pickAt(...toPaper(win._view, 3.5, 3.5));
    win._openPanel('travel');
    win._begin();
    const refusal = win._panelState.notice;
    assert.match(refusal, /gold/);
    assert.equal(
      win._chrome.card.children.filter((c) => c.className === 'hmnotice')
        .map((c) => c.textContent)[0], refusal,
      'the card still says it itself',
    );
    win.input('KeyI');
    assert.equal(win._chrome.box.style.display, 'block', 'and the I/H box still opens');
    assert.equal((doc.body.children ?? []).some((c) => c.id === ENHANCED_NOTICE_ID), false,
      'no stack is ever built on the classic skin');
    assert.deepEqual(enhancedNoticeKeys(), []);
    win.dispose();
  });
  skin('enhanced');
});

test('MAP2 coordinates: a bare pixel is a destination only when the mod allows it, the host can honour it and the visit is not a teleport; the card bills the mod\'s walked estimate and no fare; Begin skips the gold gate and hands onTravelToCoords the popup\'s own {pixel, name} with playerControlled (mutants: coords-without-setting, coords-online, coords-on-teleport, coords-pays-fare, walked-estimate-unscaled)', () => {
  withDocument(() => {
    const coords = [];
    const win = open(mkWin(modDeps({ onTravelToCoords: (...a) => coords.push(a), gold: () => 0, goldPieces: () => 0 })));
    const [bx, by] = toPaper(win._view, 1.5, 1.5);
    win._pickAt(bx, by);
    assert.equal(win._selected?.coords, true);
    assert.equal(win._selected.name, toFormat(TO_TEXT.MsgTargetCoords, 1, 1));
    assert.equal(win._panel, 'travel', 'the decision opens itself, as the coordinates popup does');
    const st = win._panelState;
    assert.equal(st.trip.walked, true);
    // the estimate, verbatim what ui/travelPopUp.js computes for its labels
    const s = win._to.settings;
    const w = calculateTravelTime({ x: 5, y: 5 }, { x: 1, y: 1 }, {
      speedCautious: st.opts.speedCautious && !s.cautiousTravel, sleepModeInn: st.opts.sleepModeInn && !s.stopAtInnsTravel,
      travelShip: st.opts.travelShip, hasHorse: false, hasCart: false,
    }, () => CLIMATES.Woodlands);
    const mult = ((st.opts.speedCautious && s.cautiousTravel) ? s.cautiousTravelMultiplier : s.recklessTravelMultiplier) * 2;
    assert.equal(st.trip.walkedMinutes, Math.trunc(guildFastTravel(null, w.minutes) / mult));
    // the card: hours and minutes, and the mod's words for the fare
    const texts = win._chrome.card.children.flatMap((c) => (c.children ?? []).map((k) => k.textContent));
    assert.ok(texts.includes(toFormat(TO_TEXT.MsgTimeFormat, Math.trunc(st.trip.walkedMinutes / 60), st.trip.walkedMinutes % 60).trim()));
    assert.ok(texts.includes(TO_TEXT.MsgPlayerControlled));
    // penniless, and still allowed: a walked trip pays no fare
    win._begin();
    assert.equal(win._phase, 'closing', 'no gold gate');
    assert.equal(win._commit.kind, 'coords');
    for (let i = 0; i < 20 && !win.done; i++) win.tick(0.05);
    assert.equal(coords.length, 1);
    assert.deepEqual(coords[0][0], { pixel: { x: 1, y: 1 }, name: toFormat(TO_TEXT.MsgTargetCoords, 1, 1) });
    assert.equal(coords[0][1].playerControlled, true);
    assert.deepEqual(Object.keys(coords[0][1]), ['speedCautious', 'sleepModeInn', 'travelShip', 'playerControlled']);
    // the three refusals
    const off = open(mkWin(modDeps({}, { targetCoordsAllowed: false })));
    off._pickAt(...toPaper(off._view, 1.5, 1.5));
    assert.equal(off._selected, null, 'the mod does not allow it');
    off.dispose();
    const online = open(mkWin(modDeps({ coordsAllowed: () => false })));
    online._pickAt(...toPaper(online._view, 1.5, 1.5));
    assert.equal(online._selected, null, 'the host cannot honour it (never online)');
    online.dispose();
    const tele = open(mkWin(modDeps()));
    tele.activateTeleportationTravel();
    tele._pickAt(...toPaper(tele._view, 1.5, 1.5));
    assert.equal(tele._selected, null, 'a bare pixel is no place to appear');
    tele.dispose();
    // the cross on the sheet
    const ctx = recordingCtx();
    paintInk(ctx, { coast: [], borders: [], roads: [], tracks: [], regions: [], high: [], marks: [] }, { ox: 0, oy: 0, scale: 10 },
      { paperW: 100, paperH: 100, band: 'near', selected: { x: 1.5, y: 1.5, coords: true } });
    assert.ok(ctx.calls.some((c) => c.fn === 'stroke' && c.strokeStyle === PEN.coords), 'a cross where no mark is');
  });
});

test('MAP2 walked place: when the mod\'s fork says the player drives the trip to a PLACE, the card shows the walked estimate and no fare, and the commit still carries the classic pick (mutants: walked-shows-days, walked-charged)', () => {
  withDocument(() => {
    const traveled = [];
    // cautiousTravel + stopAtInnsTravel on, no ship: isPlayerControlledTravel is true for the remembered toggles
    const win = open(mkWin(modDeps({ onTravel: (...a) => traveled.push(a), gold: () => 0, goldPieces: () => 0 }, { stopAtInnsTravel: true, shipTravelPortsOnly: false })));
    win._pickAt(...toPaper(win._view, 8.5, 6.5));
    win._openPanel('travel');
    const st = win._panelState;
    assert.equal(st.opts.travelShip, true, 'the remembered toggle');
    win._toggleOpt('travelShip');
    assert.equal(st.trip.walked, true, 'now player-controlled');
    assert.equal(st.trip.path, undefined, 'AUDIT-MAP2: no second walk on the trip');
    const texts = win._chrome.card.children.flatMap((c) => (c.children ?? []).map((k) => k.textContent));
    assert.ok(texts.includes(TO_TEXT.MsgPlayerControlled), 'no fare row');
    assert.ok(!texts.some((t) => /^\d+ days?$/.test(t)), 'no day count');
    win._begin();
    assert.equal(win._phase, 'closing', 'penniless and still allowed');
    assert.equal(win._commit.kind, 'travel');
    assert.equal(win._commit.opts.playerControlled, true);
    assert.deepEqual(win._commit.pick.pixel, { x: 8, y: 6 });
    win.dispose();
  });
});

test('MAP2 resume: a pending destination asks once on the first tick - Yes resumes and lowers the sheet, No stays on the map; a journey in progress centres the sheet on the player instead (mutants: resume-every-tick, no-closes-map, active-asks)', () => {
  withDocument(() => {
    let resumed = 0;
    const win = mkWin(modDeps({ onResumeTravel: () => resumed++ }, {}, { destinationName: 'Wayrest' }));
    assert.equal(win._top, null, 'not before the first tick');
    win.tick(0.05);
    assert.equal(win._top, 'resume');
    assert.equal(win._chrome.box.style.display, 'block');
    assert.ok(win._chrome.box.children.some((c) => c.textContent === toFormat(TO_TEXT.MsgResume, 'Wayrest')), 'the mod\'s own sentence');
    win.input('KeyN');
    assert.equal(win._top, null, 'No pops the box alone');
    assert.equal(win._phase, 'opening', 'and the map stays');
    for (let i = 0; i < 20; i++) win.tick(0.05);
    assert.equal(win._top, null, 'asked once per open');
    win.dispose();
    const yes = mkWin(modDeps({ onResumeTravel: () => resumed++ }, {}, { destinationName: 'Wayrest' }));
    yes.tick(0.05);
    yes.input('KeyY');
    assert.equal(resumed, 1);
    assert.equal(yes._phase, 'closing', 'Yes lowers the sheet');
    for (let i = 0; i < 20 && !yes.done; i++) yes.tick(0.05);
    assert.equal(yes.done, true);
    // a journey in progress: no prompt, the sheet on the player
    const active = mkWin(modDeps({}, {}, { destinationName: 'Wayrest', isTravelActive: true }));
    active.tick(0.05);
    assert.equal(active._top, null);
    // the goal is the view centred on the player's pixel, under the clamp
    // (on a bay the sheet already holds whole, the clamp centres the bay)
    assert.deepEqual(active._goal, clampView(viewCentredOn(5.5, 5.5, active._view.scale, active._limits()), active._limits()), 'aimed at the player\'s pixel');
    const still = mkWin(modDeps({}, {}, { destinationName: null, isTravelActive: false }));
    still.tick(0.05);
    assert.deepEqual(still._goal, still._view, 'no journey: the view rests where it opened');
    active.dispose();
    // no mod: nothing asked, nothing centred
    const plain = open(mkWin());
    assert.equal(plain._top, null);
    plain.dispose();
  });
});

test('MAP2: the additions are the classic window\'s own functions, and the probe reports them', () => {
  const src = read('src/ui/heldMap.js');
  assert.match(src, /import \{ teleportCost, teleportCostPrompt, portsFilterAllows, locationInfoRows, resumePrompt \} from '\.\/travelMapOptions\.js';/);
  assert.match(src, /import \{ hasPort \} from '\.\.\/systems\/travelPorts\.js';/);
  assert.match(src, /if \(!portsFilterAllows\(this\.portsFilter, summary\?\.mapID \?\? summary\?\.mapId\)\) return false;\s*\n\s*return checkLocationDiscovered\(summary\);/, 'the classic override, verbatim');
  assert.match(src, /get: \(\) => travelMapMarkedMapId\(\),\s*\n\s*set: \(v\) => setTravelMapMarkedMapId\(v\),/, 'the mark in the shared store');
  assert.match(src, /const info = locationInfoRows\(summary\?\.locationType,/);
  assert.match(src, /resumePrompt\(this\._to\?\.destinationName \?\? ''\)/);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''), /PORT_SET|PORT_LOCATION_IDS/, 'the port list is never read here');
  withDocument(() => {
    const win = open(mkWin(modDeps()));
    const probe = JSON.parse(globalThis.__heldMap());
    assert.deepEqual([probe.portsFilter, probe.marked, probe.info, probe.top], [false, -1, false, null]);
    win.dispose();
  });
});

// ═══ AUDIT-MAP (2026-09-18, Mac: "Let's audit everything so far") ═══════
//
// The browser probe (tools/heldMapProbe.mjs) and three reviewer lenses
// over MAP0-MAP2. Each finding below is pinned two-way with the window's
// own expressions.

test('AUDIT-MAP A1: the edge of the data is not a shore, and the corner cut is bounded - the first screenshot framed the bay in a coastline with chamfered corners (mutants: edge-is-a-shore, corner-cut-unbounded, closed-loop-notched)', () => {
  // a bay that runs off the sheet on three sides: the coast is ONE open
  // chain from the top edge to the bottom edge, never a loop round the data
  const w = 8, h = 6;
  const bytes = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 3; x < w; x++) bytes[y * w + x] = 40;
  const model = buildInkModel({ width: w, height: h, heightBytes: bytes, climateAt: (x) => (x < 3 ? CLIMATES.Ocean : CLIMATES.Woodlands) });
  assert.equal(model.coast.length, 1);
  const c = model.coast[0];
  assert.notDeepEqual(c[0], c[c.length - 1], 'open, not a loop');
  assert.ok(c.every((p) => Math.abs(p.x - 3) < 1e-9), 'the shore at x=3 and nothing along the data\'s edge');
  assert.ok(c.some((p) => p.y === 0) && c.some((p) => p.y === h), 'top edge to bottom edge');
  const square = roundCorners([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 0, y: 0 }]);
  assert.ok(Math.abs(square[0].x - 1.5) < 1e-9 && square[0].y === 0, 'a closed loop is cut at its shared corner too - it starts a bound in, not on the raw corner');
});

test('AUDIT-MAP A3: zooming past the ceiling keeps the point under the cursor - the anchor is computed for the scale that is SET, after the clamp (mutants: zoom-anchor-before-clamp)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const win = open(mkWin({ mapSize: { width: 1000, height: 500 }, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) } }));
      const [hx, hy] = [win._paper.w / 2, win._paper.h / 2];
      const [mx, my] = toMap(win._view, hx, hy);
      win._zoomBy(100, hx, hy);   // far past SCALE_MAX
      assert.equal(win._view.scale, SCALE_MAX);
      const [mx2, my2] = toMap(win._view, hx, hy);
      assert.ok(Math.abs(mx - mx2) < 1e-6 && Math.abs(my - my2) < 1e-6, 'the cursor\'s pixel did not move at the ceiling');
      win._zoomBy(0.001, hx, hy);   // and back past the floor
      assert.equal(win._view.scale, scaleMinOf(win._limits()));
      win.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('AUDIT-MAP A2: the breathing rings repaint the sheet at PULSE_HZ, not every frame - a paint is the whole bay\'s ink (mutants: pulse-every-frame)', () => {
  withDocument(() => {
    const win = open(mkWin());
    win._selected = { summary: summaryOf(3, 3, LOCATION_TYPES.TownCity), name: 'T', x: 3.5, y: 3.5 };
    let paints = 0;
    const paint = win._paint.bind(win);
    win._paint = () => { paints++; paint(); };
    for (let i = 0; i < 60; i++) win.tick(1 / 60);   // one second at sixty frames
    assert.ok(paints >= 9 && paints <= 12, `ten-ish paints a second, not sixty (${paints})`);
    win.dispose();
  });
});

test('AUDIT-MAP B1: every way out remembers an open panel\'s toggles - the Close button and the resume prompt\'s Yes dropped them (mutants: close-drops-toggles)', () => {
  withDocument(() => {
    const win = open(mkWin());
    win._selected = { summary: summaryOf(3, 3, LOCATION_TYPES.TownCity), name: 'T', x: 3.5, y: 3.5 };
    win._openPanel('travel');
    win._toggleOpt('speedCautious');
    assert.equal(travelMapSaveData().speedCautious, true, 'not yet remembered');
    win._chrome.close.onclick();
    assert.equal(win._phase, 'closing');
    assert.equal(travelMapSaveData().speedCautious, false, 'remembered on the Close button');
    win.dispose();
  });
});

test('AUDIT-MAP B2/B4: the sprite\'s handler is set before its source, the display face landing repaints once, the middle button\'s autoscroll is shut where the browser reads it', () => {
  const src = read('src/ui/heldMap.js');
  assert.ok(src.indexOf('sprite.onload = () => this._keyHands(sprite, hands);') < src.indexOf('sprite.src = HELD_MAP_URL;'), 'onload before src - a cached picture cannot land first');
  assert.match(src, /\(fonts\?\.load\?\.\("14px 'Cormorant'"\) \?\? fonts\?\.ready\)\?\.then\?\.\(landed\);/, 'the face is ASKED for (a canvas font never triggers a load), and the sheet repainted when it lands');
  // MAP-FIELD2: the measure cache went with the names - nothing else on
  // the sheet measures text - so the face's landing drops the kept layer
  // alone. The repaint is still what the landing is FOR.
  assert.match(src, /const landed = \(\) => \{ if \(!this\.done\) \{ this\._staticKey = ''; this\._dirty = true; \} \};/, 'the kept layer is dropped with it');
  assert.doesNotMatch(src, /_measureCache/, 'and no measure cache survives the names it existed for');
  assert.match(src, /stage\.addEventListener\('auxclick', \(e\) => \{ if \(e\.button === 1\) e\.preventDefault\?\.\(\); \}\);/, 'auxclick is where the middle click\'s default lives');
  assert.match(src, /stage\.addEventListener\('mousedown', \(e\) => \{ if \(e\.button === 1\) e\.preventDefault\?\.\(\); \}\);/);
});

test('AUDIT-MAP B3: a second finger pinches - the scale follows the fingers\' distance about their midpoint, the map point under the midpoint holds, and a pinch is never a pick (mutants: pinch-ignored, pinch-picks)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const mapDict = new Map();
      const sm = summaryOf(500, 250, LOCATION_TYPES.TownCity); mapDict.set(sm.id, sm);
      const win = open(mkWin({ mapSize: { width: 1000, height: 500 }, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapDict, maps: { regionCount: 1, getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Wayrest'] }), getPoliticIndex: () => 128 } }));
      const stage = win._chrome.stage;
      const ev = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, button: 0, preventDefault() {} });
      const rest = win._view.scale;
      const [cx, cy] = toPaper(win._view, 500.5, 250.5);   // the city, under the first finger
      fire(stage, 'pointerdown', ev(1, cx, cy));
      fire(stage, 'pointerdown', ev(2, cx + 100, cy));
      const midBefore = toMap(win._view, cx + 50, cy);
      fire(stage, 'pointermove', ev(2, cx + 200, cy));   // the fingers part: twice the distance
      assert.ok(Math.abs(win._view.scale - rest * 2) < 1e-9, `twice the scale (${win._view.scale} vs ${rest * 2})`);
      const midAfter = toMap(win._view, cx + 100, cy);   // the new midpoint
      assert.ok(Math.abs(midAfter[0] - midBefore[0]) < 1e-6 && Math.abs(midAfter[1] - midBefore[1]) < 1e-6, 'the map point under the midpoint holds');
      fire(stage, 'pointerup', ev(2, cx + 200, cy));
      fire(stage, 'pointerup', ev(1, cx, cy));   // lifted where the city is
      assert.equal(win._selected, null, 'a pinch is never a pick');
      // and a plain tap on the city still is
      fire(stage, 'pointerdown', ev(3, cx, cy));
      fire(stage, 'pointerup', ev(3, cx, cy));
      assert.equal(win._selected?.name, 'Wayrest');
      win.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('AUDIT-MAP D1: a walked place-trip hands its WALKED estimate as the minutes the host\'s ETA runs down - the popup\'s own `{ ...trip, minutes: travelTimeTotalMins }` (mutants: eta-dfu-minutes)', () => {
  withDocument(() => {
    const win = open(mkWin(modDeps({}, { stopAtInnsTravel: true, shipTravelPortsOnly: false })));
    win._pickAt(...toPaper(win._view, 8.5, 6.5));
    win._openPanel('travel');
    win._toggleOpt('travelShip');
    const st = win._panelState;
    assert.equal(st.trip.walked, true);
    assert.notEqual(st.trip.walkedMinutes, st.trip.minutes, 'the two estimates differ (the walked one is divided by twice the multiplier)');
    win._begin();
    assert.equal(win._commit.computed.minutes, st.trip.walkedMinutes, 'the ETA reads the walked estimate');
    win.dispose();
    // and a fast-travelled place still hands DFU's own
    const dfu = open(mkWin(modDeps({}, { stopAtInnsTravel: false, cautiousTravel: false, shipTravelPortsOnly: false })));
    dfu._pickAt(...toPaper(dfu._view, 8.5, 6.5));
    dfu._openPanel('travel');
    assert.equal(dfu._panelState.trip.walked, undefined);
    dfu._begin();
    assert.equal(dfu._commit.computed.minutes, dfu._panelState?.trip?.minutes ?? dfu._commit.computed.minutes);
    dfu.dispose();
  });
});

test('AUDIT-MAP D2: the card bills the mod\'s SCALED fare through the popup\'s own pure law - FastTravelCostScaleFactor over the inn nights, ShipTravelCostScaleFactor over the passage, each through the shop-price formula at quality 10 (mutants: fare-unscaled, popup-not-delegating)', () => {
  // the pure law
  const c = { piecesCost: 100, totalCost: 160 };
  assert.deepEqual(scaleTripCost(c, null, null), c, 'no mod, no scaling');
  assert.deepEqual(scaleTripCost(c, { fastTravelCostScaleFactor: 1, shipTravelCostScaleFactor: 1 }, null), c, 'a factor of 1 leaves its half untouched, formula and all');
  const scaled = scaleTripCost(c, { fastTravelCostScaleFactor: 4, shipTravelCostScaleFactor: 1 }, null);
  assert.ok(scaled.piecesCost > c.piecesCost, 'the inn nights scaled');
  assert.equal(scaled.totalCost - scaled.piecesCost, 60, 'the passage untouched at factor 1');
  const both = scaleTripCost(c, { fastTravelCostScaleFactor: 1, shipTravelCostScaleFactor: 3 }, null);
  assert.equal(both.piecesCost, 100);
  assert.ok(both.totalCost - both.piecesCost > 60);
  // the popup's method IS the export
  assert.match(read('src/ui/travelPopUp.js'), /_scaleTripCost\(c\) \{[\s\S]{0,400}?return scaleTripCost\(c, this\._to\?\.settings, this\.deps\.playerEntity\?\.\(\) \?\? null\);/);
  // the card, driven: the same fare the popup would show, and the commit charges it
  withDocument(() => {
    const win = open(mkWin(modDeps({ getClimateIndex: (x) => (x >= 8 ? CLIMATES.Ocean : CLIMATES.Woodlands), hasShip: () => true }, { fastTravelCostScaleFactor: 4, shipTravelCostScaleFactor: 3, cautiousTravel: false, stopAtInnsTravel: false, shipTravelPortsOnly: false })));
    win._pickAt(...toPaper(win._view, 8.5, 6.5));
    win._openPanel('travel');
    const st = win._panelState;
    const raw = calculateTripCost(st.trip.minutes, st.trip.oceanPixels, { sleepModeInn: st.opts.sleepModeInn, hasShip: true, travelShip: st.opts.travelShip });
    const want = scaleTripCost(raw, win._to.settings, null);
    assert.deepEqual([st.trip.piecesCost, st.trip.totalCost], [want.piecesCost, want.totalCost], 'the popup\'s scaled fare');
    assert.ok(st.trip.piecesCost > raw.piecesCost, 'and it is scaled');
    win._begin();
    assert.deepEqual([win._commit.computed.piecesCost, win._commit.computed.totalCost], [want.piecesCost, want.totalCost], 'charged as billed');
    win.dispose();
  });
});

test('AUDIT-MAP D3: on the FEE prompt, No and an empty purse close the MAP (the C#\'s two CloseWindows, the classic teleportcost/teleportpoor arms); without a fee, No leaves the map armed (mutants: fee-no-stays)', () => {
  withDocument(() => {
    const paid = [];
    const rich = open(mkWin(modDeps({ magesGuildRank: () => 0, gold: () => 10000, payTeleport: (c) => paid.push(c) }, { teleportCost: true })));
    rich.activateTeleportationTravel();
    rich._pickAt(...toPaper(rich._view, 3.5, 3.5));
    assert.equal(rich._panel, 'teleport');
    assert.equal(rich._panelState.fee.cost, teleportCost(0));
    rich._confirmTeleport(false);
    assert.equal(rich._phase, 'closing', 'No on the fee closes the map');
    assert.deepEqual(paid, [], 'and nothing was paid');
    rich.dispose();
    const poor = open(mkWin(modDeps({ magesGuildRank: () => 0, gold: () => 0, payTeleport: (c) => paid.push(c) }, { teleportCost: true })));
    poor.activateTeleportationTravel();
    poor._pickAt(...toPaper(poor._view, 3.5, 3.5));
    assert.equal(poor._panelState.fee.canPay, false);
    poor._confirmTeleport(false);   // the no-gold card's Close
    assert.equal(poor._phase, 'closing', 'an empty purse closes the map');
    poor.dispose();
    // Yes pays once and goes
    const yes = open(mkWin(modDeps({ magesGuildRank: () => 0, gold: () => 10000, payTeleport: (c) => paid.push(c) }, { teleportCost: true })));
    yes.activateTeleportationTravel();
    yes._pickAt(...toPaper(yes._view, 3.5, 3.5));
    yes._confirmTeleport(true);
    assert.deepEqual(paid, [teleportCost(0)]);
    assert.equal(yes._commit.kind, 'teleport');
    yes.dispose();
  });
});

test('AUDIT-MAP D4: the box eats the WHOLE press - the click that follows the closing pointer down is swallowed before it reaches a button (mutants: click-not-swallowed)', () => {
  withDocument(() => {
    const win = open(mkWin(modDeps({ helpRows: () => ['a row'] })));
    win.input('KeyH');
    assert.ok(win._info);
    const stopped = [];
    fire(win._chrome.root, 'pointerdown', { button: 0, stopPropagation() { stopped.push('down'); } });
    assert.equal(win._info, null);
    fire(win._chrome.root, 'click', { stopPropagation() { stopped.push('click'); }, preventDefault() {} });
    assert.deepEqual(stopped, ['down', 'click'], 'the down closed the box and the click was eaten');
    fire(win._chrome.root, 'click', { stopPropagation() { stopped.push('click2'); }, preventDefault() {} });
    assert.deepEqual(stopped, ['down', 'click'], 'the NEXT click is the player\'s own');
    win.dispose();
  });
});

test('AUDIT-MAP U5/Q2: the walked card still shows the purse, and the junction disc reads the mark from the STORE, not the last M window', () => {
  withDocument(() => {
    const win = open(mkWin(modDeps({ goldPieces: () => 777 }, { stopAtInnsTravel: true, shipTravelPortsOnly: false })));
    win._pickAt(...toPaper(win._view, 8.5, 6.5));
    win._openPanel('travel');
    win._toggleOpt('travelShip');
    const texts = win._chrome.card.children.flatMap((c) => (c.children ?? []).map((k) => k.textContent));
    assert.ok(texts.includes('777 gold'), 'the purse row on a walked trip (C# UpdateLabels :122 still shows GoldPieces)');
    win.dispose();
  });
  const w = read('src/scenes/world.js');
  assert.match(w, /markedMapId: \(\) => travelMapMarkedMapId\(\),/, 'the store - a mark set on the guild\'s teleport window was invisible to the disc');
  assert.match(w, /import \{ travelMapFilters, travelMapMarkedMapId \} from '\.\.\/systems\/travelMapState\.js';/);
});

test('AUDIT-MAP A5: chains are culled per SEGMENT - a run whose ends are both off the sheet still crosses it, and a chain leaving the view runs to the paper\'s edge (mutants: cull-per-point)', () => {
  const model = { coast: [[{ x: 0, y: 5 }, { x: 100, y: 5 }]], borders: [], roads: [], tracks: [], regions: [], high: [], marks: [] };
  const ctx = recordingCtx();
  paintInk(ctx, model, { ox: 40, oy: 0, scale: 14 }, { paperW: 280, paperH: 140, band: 'near' });
  assert.ok(ctx.calls.some((c) => c.fn === 'lineTo'), 'the long run across the sheet is drawn though neither end is on it');
  const leaving = { ...model, coast: [[{ x: 50, y: 5 }, { x: 90, y: 5 }]] };
  const ctx2 = recordingCtx();
  paintInk(ctx2, leaving, { ox: 40, oy: 0, scale: 14 }, { paperW: 280, paperH: 140, band: 'near' });
  const line = ctx2.calls.find((c) => c.fn === 'lineTo');
  assert.ok(line, 'a chain with one end on the sheet is drawn to its far end');
  assert.deepEqual(line.args, toPaper({ ox: 40, oy: 0, scale: 14 }, 90, 5), '...past the paper, so the pen never lifts short of the edge');
});

test('AUDIT-MAP A7: a chain ends at a junction vertex - three provinces meeting leave no gap in the dashed border once the corners are cut (mutants: junction-walked-through)', () => {
  // three regions meeting at (2,2) on a 4x4 land sheet
  const w = 4, h = 4;
  const regionAt = (x, y) => (y < 2 ? 0 : x < 2 ? 1 : 2);
  const model = buildInkModel({ width: w, height: h, heightBytes: new Uint8Array(16).fill(40), climateAt: () => CLIMATES.Woodlands, regionAt, regionCount: 3 });
  const raw = linkSegments([[0, 2, 1, 2], [1, 2, 2, 2], [2, 2, 3, 2], [3, 2, 4, 2], [2, 2, 2, 3], [2, 3, 2, 4]]);
  assert.equal(raw.length, 3, 'three arms');
  for (const c of raw) {
    const ends = [c[0], c[c.length - 1]];
    assert.ok(ends.some((p) => p.x === 2 && p.y === 2), 'each arm ENDS at the junction');
  }
  // and the softened model keeps every arm's end ON the junction
  assert.equal(model.borders.length, 3);
  for (const c of model.borders) {
    const ends = [c[0], c[c.length - 1]];
    assert.ok(ends.some((p) => Math.abs(p.x - 2) < 1e-9 && Math.abs(p.y - 2) < 1e-9), 'the cut never moves a junction end');
  }
});

test('AUDIT-MAP A4/perf: the simplifier is iterative (a 20k zigzag no longer blows the stack) and the tracer is typed - the same chains as the string-keyed walk (mutants: simplify-recursive-again is a rewrite, not a mutant; tracer-skips-loops)', () => {
  const zig = [];
  for (let i = 0; i < 20000; i++) zig.push({ x: i, y: i % 2 ? 2 : 0 });
  assert.equal(simplifyChain(zig).length, 20000, 'every corner of a 2-high zigzag is a corner at eps 0.9, and none is lost');
  assert.deepEqual(simplifyChain([{ x: 0, y: 0 }, { x: 1, y: 0.2 }, { x: 2, y: 0 }, { x: 3, y: 5 }, { x: 4, y: 0 }], 0.5),
    [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 5 }, { x: 4, y: 0 }], 'the recursive answer, exactly');
  // the tracer: a T junction and a pure loop
  const W = 5, H = 5, E = 32, Wb = 2, N = 128, S = 8;
  const m = new Uint8Array(W * H);
  m[2 * W + 0] = E; m[2 * W + 1] = E | Wb; m[2 * W + 2] = E | Wb | N; m[2 * W + 3] = E | Wb; m[2 * W + 4] = Wb;
  m[1 * W + 2] = S | N; m[0 * W + 2] = S;
  assert.equal(traceChains(m, W, H).length, 3, 'a junction: three chains');
  const loop = new Uint8Array(9);   // a 2x2 ring on a 3x3 sheet: pure loop, no node
  loop[0] = E | S; loop[1] = Wb | S; loop[3] = N | E; loop[4] = N | Wb;
  const chains = traceChains(loop, 3, 3);
  assert.equal(chains.length, 1, 'a pure loop is walked from any pixel on it');
  assert.equal(chains[0].length, 5, 'four edges, five points');
});

test('AUDIT-MAP perf: the carets are thinned once per band at build; the harbour glyph\'s flukes are a fresh subpath (mutants: carets-thinned-per-paint, harbour-joined)', () => {
  const w = 12, h = 12;
  const bytes = new Uint8Array(w * h).fill(120);
  const model = buildInkModel({ width: w, height: h, heightBytes: bytes, climateAt: () => CLIMATES.Mountain });
  assert.equal(model.high.length, 144);
  assert.deepEqual([model.highBands.far.length, model.highBands.mid.length, model.highBands.near.length], [4, 16, 36], 'steps of six, three and two');
  const ctx = recordingCtx();
  paintInk(ctx, model, { ox: 0, oy: 0, scale: 5 }, { paperW: 60, paperH: 60, band: 'far' });
  assert.equal(ctx.calls.filter((c) => c.fn === 'moveTo').length, 4, 'four carets at far, off the thinned list');
  assert.match(read('src/ui/inkMap.js'), /ctx\.moveTo\(ax \+ 3 \* Math\.cos\(Math\.PI \* 0\.15\), ay \+ 0\.5 \+ 3 \* Math\.sin\(Math\.PI \* 0\.15\)\);\s*\n\s*ctx\.arc\(ax, ay \+ 0\.5, 3, Math\.PI \* 0\.15, Math\.PI \* 0\.85\);/);
});

test('AUDIT-MAP A8: every step of the glide is a view the clamp allows (mutants: glide-unclamped)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const win = open(mkWin({ mapSize: { width: 1000, height: 500 }, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) } }));
      win._focusOn(500.5, 10.5, 6);   // a goal near the top edge, from the centred rest view
      for (let i = 0; i < 40; i++) {
        win.tick(1 / 60);
        const v = win._view;
        const c = clampView(v, win._limits());
        assert.ok(Math.abs(v.ox - c.ox) < 1e-9 && Math.abs(v.oy - c.oy) < 1e-9 && Math.abs(v.scale - c.scale) < 1e-9, `step ${i}: no blank parchment (${JSON.stringify(v)} vs ${JSON.stringify(c)})`);
      }
      win.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('AUDIT-MAP A9/H8: a summary with no region index names nothing rather than throwing; a line-mode wheel zooms as a pixel one does (mutants: summary-name-throws, wheel-lines-as-pixels)', () => {
  withDocument(() => {
    const win = mkWin({ maps: { getRegion: () => { throw new Error('getRegion(undefined)'); } } });
    assert.equal(win._summaryName({ mapIndex: 0 }), '');
    assert.equal(win._summaryName(null), '');
    win.dispose();
  });
  assert.equal(wheelPixels({ deltaY: 100, deltaMode: 0 }, 800), 100);
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800), 48, 'sixteen pixels a line');
  assert.equal(wheelPixels({ deltaY: 1, deltaMode: 2 }, 800), 800, 'a page is the sheet');
  assert.equal(wheelPixels({ deltaY: 'x' }, 800), 0);
});

test('AUDIT-MAP H1 + TRAVEL-FARE: online the journey reads "now" and the fare is billed AS OFFLINE, on the same card as the popup\'s line (mutants: online-waives-the-fare, online-counts-days)', () => {
  withDocument(() => {
    const climate = () => CLIMATES.Woodlands;
    const win = open(mkWin({ noWorldTime: () => true, getClimateIndex: climate }));
    win._selected = { summary: summaryOf(9, 5, LOCATION_TYPES.TownCity), name: 'Far', x: 9.5, y: 5.5 };
    win._openPanel('travel');
    const st = win._panelState;
    assert.equal(st.opts.sleepModeInn, true, 'the toggle stands');
    const t = calculateTravelTime({ x: 5, y: 5 }, { x: 9, y: 5 }, { speedCautious: true, sleepModeInn: true, travelShip: true, hasHorse: false, hasCart: false }, climate);
    // TRAVEL-FARE (2026-09-22, kurkku): the card used to be compared
    // against a NO-INN cost, which is what made a free trip look
    // correct here. The two surfaces bill ONE journey, so the enhanced
    // map is compared against the fare a player would pay offline -
    // the inn included, DFU's "always at least one stay" included.
    const withInn = calculateTripCost(t.minutes, t.oceanPixels, { sleepModeInn: true, hasShip: false, travelShip: true });
    const noInn = calculateTripCost(t.minutes, t.oceanPixels, { sleepModeInn: false, hasShip: false, travelShip: true });
    assert.ok(withInn.piecesCost > noInn.piecesCost, 'the fixture really does have an inn to bill');
    assert.equal(st.trip.piecesCost, withInn.piecesCost, 'the inn IS paid online - the fare is the journey\'s price');
    assert.equal(st.trip.days, 0, 'and the arrival is now');
    assert.equal(st.trip.online, true);
    const texts = win._chrome.card.children.flatMap((c) => (c.children ?? []).map((k) => k.textContent));
    assert.ok(texts.includes('now'), 'the journey row');
    assert.ok(win._chrome.card.children.some((c) => c.textContent === ONLINE_TRAVEL_LINE), 'the popup\'s line');
    win.dispose();
  });
});

test('AUDIT-MAP H6/perf: a box holds the whole chrome (the modal class), the static ink is a kept layer painted when its key moves and the overlay per pulse, and the measure uses the paint\'s own font (mutants: modal-class-dropped, static-repainted-per-pulse)', () => {
  const src = read('src/ui/heldMap.js');
  // ENH-NOTICE3 moved the modality off `open`: with the I/H box's words
  // on the notice panel the .hmbox stays closed, and the chrome has to
  // go pointer-dead all the same - so the class reads the box's
  // MODALITY, which `open` is now only half of.
  assert.match(src, /this\._chrome\.root\.classList\.toggle\('hmmodal', modal\);/);
  assert.match(src, /const modal = !!this\._info \|\| this\._top === 'resume';/,
    'mutants: the modality re-derived from the drawn box, which the panel arm leaves shut');
  assert.match(read('src/ui/enhancedStyle.js'), /\.hmroot\.hmmodal \.hmtop, \.hmroot\.hmmodal \.hmcard, \.hmroot\.hmmodal \.hmfoot \{ pointer-events: none; \}/);
  assert.match(src, /if \(key !== this\._staticKey \|\| !lctx\) \{/, 'the static half is painted only when its key moves');
  assert.match(src, /this\._marksVersion, this\._portsShown\(\) \? 1 : 0, this\.markedMapId,/, 'and the key carries what the static half reads');
  assert.equal((src.match(/paintInkStatic\(/g) || []).length, 1);
  assert.equal((src.match(/paintInkOverlay\(/g) || []).length, 1);
  assert.equal(nameFont({ kind: 'city' }, 13), "600 13px 'Cormorant', Georgia, serif");
  assert.equal(nameFont({ kind: 'hamlet' }, 13), "13px 'Cormorant', Georgia, serif");
  // the overlay alone, on a stub: clears when asked, draws the rings, never the coast
  const ctx = recordingCtx();
  paintInkOverlay(ctx, { ox: 0, oy: 0, scale: 10 }, { paperW: 60, paperH: 40, clear: true, player: { x: 1, y: 1 }, selected: { x: 2.5, y: 2.5 } });
  assert.equal(ctx.calls[1].fn, 'clearRect');
  assert.ok(ctx.calls.some((c) => c.fn === 'arc' && c.strokeStyle === PEN.select));
  assert.ok(!ctx.calls.some((c) => c.fn === 'setLineDash' && c.args[0].length), 'no borders in the overlay');
  // the static half alone draws no rings
  const ctx2 = recordingCtx();
  paintInkStatic(ctx2, { coast: [], borders: [], roads: [], tracks: [], regions: [], high: [], marks: [] }, { ox: 0, oy: 0, scale: 10 }, { paperW: 60, paperH: 40, band: 'near' });
  assert.ok(!ctx2.calls.some((c) => c.fn === 'arc'));
});

// ── MAP3: THE HANDS LANE ─────────────────────────────────────────

/** The host's holder, faked: says whether the arm is drawn, takes the
 *  sheet (or not yet), answers the corners it projected. */
const holderStub = ({ available = true, holdOk = () => true, corners = () => null } = {}) => {
  const h = {
    calls: [],
    available: () => available,
    hold: (spec, opts) => { h.calls.push(['hold', spec, opts.aspect]); return holdOk(); },
    release: () => { h.calls.push(['release']); },
    corners,
  };
  return h;
};
const TRAPEZIUM = [[150, 300], [650, 300], [730, 700], [70, 700]];
const bayDeps = () => {
  const mapDict = new Map();
  const sm = summaryOf(500, 250, LOCATION_TYPES.TownCity); mapDict.set(sm.id, sm);
  return { mapSize: { width: 1000, height: 500 }, woods: { heightMapBuffer: new Uint8Array(500000).fill(10) }, mapDict, maps: { regionCount: 1, getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Wayrest'] }), getPoliticIndex: () => 128 } };
};

test('MAP3 hands lane: when the holder says the arm is drawn and takes the sheet, the sprite and its thumbs go, the root goes clear, and the ink canvas is laid over the holder\'s corners by the quad map - the sheet keeps the 4:3 fit\'s size, the pointer maps back through the inverse, a pick lands on the city under the angled sheet, a drag pans in SHEET pixels, no corners hides the ink, and dispose releases the arm once (mutants: lane-never-hands, sprite-shown-in-hands, transform-not-set, pointer-not-inverted, pan-in-screen-px, release-dropped)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      let corners = TRAPEZIUM;
      const holder = holderStub({ corners: () => corners });
      const win = open(mkWin({ ...bayDeps(), holder }));
      assert.equal(win._lane, 'hands');
      assert.equal(holder.calls.filter((c) => c[0] === 'hold').length, 1, 'asked once on the first tick');
      const [, spec, aspect] = holder.calls[0];
      assert.equal(spec, null, 'no spec from the window: the rig\'s pose in force');
      assert.ok(Math.abs(aspect - win._paper.w / win._paper.h) < 1e-9, 'the sheet\'s own aspect, from the 4:3 fit');
      const c = win._chrome;
      assert.equal(c.sheet.style.display, 'none');   // MAP-FIELD2: the CANVAS is the sprite the stage shows; the <img> is only the loader
      assert.equal(c.hands.style.display, 'none', 'the keyed thumbs go with the painting');
      assert.equal(c.stage.style.width, '100%');
      assert.equal(c.ink.style.left, '0px', 'the canvas sits at the origin under its matrix');
      assert.equal(c.ink.style.transformOrigin, '0 0');
      // AUDIT-MAP2: the lane class on the root is NOT the thumbs canvas's
      // class - `.hmhands` is `pointer-events: none`, and the first hands
      // lane in a browser ignored every click for exactly that reason
      const src = read('src/ui/heldMap.js'), css = read('src/ui/enhancedStyle.js');
      assert.match(src, /c\.root\.classList\.toggle\('hmlanehands', true\);/);
      assert.doesNotMatch(src, /classList\.toggle\('hmhands'/);
      assert.match(css, /\.hmroot \{[^}]*background: transparent;/, 'MAP-FIELD2: the root is clear for BOTH lanes, so the hands lane needs no rule of its own');
      assert.doesNotMatch(css, /\.hmroot\.hmhands\b/);
      const q = quadPlacement(win._paper.w, win._paper.h, TRAPEZIUM);
      assert.equal(c.ink.style.transform, q.css, 'the matrix3d of the corners');
      assert.equal(c.ink.style.opacity, '1');
      const probe = JSON.parse(globalThis.__heldMap());
      assert.equal(probe.lane, 'hands'); assert.equal(probe.placed, true);
      // the pointer: the top-right corner is the sheet's (w, 0)
      const tr = win._paperPoint(650, 300);
      assert.ok(Math.abs(tr[0] - win._paper.w) < 1e-6 && Math.abs(tr[1]) < 1e-6, `inverse: ${tr}`);
      // a pick through the angle: the city's sheet point, sent through the forward map
      const stage = c.stage;
      const ev = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, button: 0, preventDefault() {} });
      win._setView({ ox: 450, oy: 220, scale: 8 });   // zoomed in, so a pan has room under the clamp
      assert.equal(win._view.scale, 8);
      const [px, py] = toPaper(win._view, 500.5, 250.5);
      const [sx, sy] = q.toScreen(px, py);
      fire(stage, 'pointerdown', ev(1, sx, sy));
      fire(stage, 'pointerup', ev(1, sx, sy));
      assert.equal(win._selected?.name, 'Wayrest', 'picked under the angled sheet');
      // a drag: the map point under the finger stays under it
      win._selected = null;
      const before = toMap(win._view, ...win._paperPoint(sx, sy));
      fire(stage, 'pointerdown', ev(2, sx, sy));
      fire(stage, 'pointermove', ev(2, sx + 60, sy + 40));
      const after = toMap(win._view, ...win._paperPoint(sx + 60, sy + 40));
      assert.ok(Math.abs(after[0] - before[0]) < 1e-6 && Math.abs(after[1] - before[1]) < 1e-6, 'the pan is measured on the sheet, not the screen');
      fire(stage, 'pointerup', ev(2, sx + 60, sy + 40));
      assert.equal(win._selected, null, 'a drag is not a pick');
      // the arm moves: the corners move, the matrix follows
      corners = TRAPEZIUM.map(([x, y]) => [x + 10, y]);
      win.tick(0.05);
      assert.equal(c.ink.style.transform, quadPlacement(win._paper.w, win._paper.h, corners).css);
      // no corners (the arm has not drawn, or a corner is behind the lens): hidden, not stale
      corners = null;
      win.tick(0.05);
      assert.equal(c.ink.style.opacity, '0');
      assert.equal(JSON.parse(globalThis.__heldMap()).placed, false);
      assert.deepEqual(win._paperPoint(100, 100), [-1e9, -1e9], 'and nothing is under the pointer');
      corners = TRAPEZIUM;
      win.tick(0.05);
      assert.equal(c.ink.style.opacity, '1');
      assert.equal(holder.calls.filter((c2) => c2[0] === 'release').length, 0);
      win.dispose();
      assert.deepEqual(holder.calls.filter((c2) => c2[0] === 'release'), [['release']], 'released once');
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('MAP3 sprite lane stands when the arm is not drawn: no hold is asked, the painting shows, the pointer is the plain offset - and the holder is still released at teardown, whichever lane stood; no holder at all (a host without a rig) is the sprite lane (mutants: hands-without-arm, release-only-in-hands)', () => {
  withDocument(() => {
    const holder = holderStub({ available: false });
    const win = open(mkWin({ holder }));
    assert.equal(win._lane, 'sprite');
    assert.ok(!holder.calls.some((c) => c[0] === 'hold'), 'never asked');
    assert.notEqual(win._chrome.sheet.style.display, 'none');   // MAP-FIELD2
    assert.deepEqual(win._paperPoint(30, 40), [30, 40]);
    assert.equal(JSON.parse(globalThis.__heldMap()).lane, 'sprite');
    for (let i = 0; i < 40; i++) win.tick(0.05);
    assert.ok(!holder.calls.some((c) => c[0] === 'hold'), 'and not later either: an arm that is not drawn is not polled');
    win.dispose();
    assert.deepEqual(holder.calls, [['release']]);
    const bare = open(mkWin());
    assert.equal(bare._lane, 'sprite');
    bare.dispose();
  });
});

test('MAP3 the rig that has not posed yet: the holder refuses the first hold, the window asks again each tick and takes the hands lane when the rig answers; a rig that never answers is asked thirty times and then left alone (mutants: no-retry, retry-forever)', () => {
  withDocument(() => {
    let ok = false;
    const holder = holderStub({ holdOk: () => ok, corners: () => TRAPEZIUM });
    const win = mkWin({ holder });
    win.tick(0.05); win.tick(0.05); win.tick(0.05);
    assert.equal(win._lane, 'sprite');
    assert.equal(holder.calls.filter((c) => c[0] === 'hold').length, 3, 'asked on every tick so far');
    ok = true;
    win.tick(0.05);
    assert.equal(win._lane, 'hands', 'the fourth ask lands');
    assert.equal(win._chrome.sheet.style.display, 'none');   // MAP-FIELD2
    win.tick(0.05);
    assert.equal(holder.calls.filter((c) => c[0] === 'hold').length, 4, 'held: no more asking');
    win.dispose();
    const never = holderStub({ holdOk: () => false });
    const w2 = mkWin({ holder: never });
    for (let i = 0; i < 80; i++) w2.tick(0.05);
    assert.equal(never.calls.filter((c) => c[0] === 'hold').length, 30, 'thirty asks, then the sprite lane for good');
    assert.equal(w2._lane, 'sprite');
    w2.dispose();
  });
});

test('MAP3 a resize in the hands lane: the sheet is the 4:3 fit\'s paper again at the SAME aspect, so the rig is NOT re-asked (AUDIT-MAP2: a hold repacks the whole arm mesh) - the canvas stays at the origin and is re-placed for the new sheet size; a resize while the corners are gone HIDES the ink rather than leaving the old matrix on a new size (the \'\' sentinel collision) (mutants: resize-re-holds, resize-sentinel-collision)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      let corners = TRAPEZIUM;
      const holder = holderStub({ corners: () => corners });
      const win = open(mkWin({ holder }));
      assert.equal(win._lane, 'hands');
      const holds = () => holder.calls.filter((c) => c[0] === 'hold');
      assert.equal(holds().length, 1);
      const a1 = holds()[0][2];
      const w1 = win._paper.w;
      globalThis.innerWidth = 700; globalThis.innerHeight = 900;   // a tall window: the 4:3 fit shrinks
      win.tick(0.05);
      assert.equal(holds().length, 1, 'not re-held: PAPER of a 4:3 stage is the same aspect at any size');
      assert.ok(win._paper.w < w1, 'a smaller sheet');
      assert.ok(Math.abs(a1 - win._paper.w / win._paper.h) < 1e-9);
      assert.equal(win._chrome.ink.style.left, '0px');
      assert.equal(win._chrome.ink.style.transform, quadPlacement(win._paper.w, win._paper.h, TRAPEZIUM).css, 're-placed for the new sheet size');
      // the sentinel: a resize with no corners that tick
      corners = null;
      globalThis.innerWidth = 1600;
      win.tick(0.05);
      assert.equal(win._chrome.ink.style.opacity, '0', 'no corners after a resize: hidden, not the old matrix on the new size');
      assert.equal(win._placement, null);
      win.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('AUDIT-MAP2 the way back: an arm that stops answering corners (paralysed, hidden, unloaded, third person) gives the sheet back to the painting after HANDS_LOST_TICKS - the sprite and thumbs return, the root is opaque again, the layout is redone, the rig is released once and not asked again this open; a brief gap does not (mutants: lane-no-fallback, fallback-re-asks)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      let corners = TRAPEZIUM;
      const holder = holderStub({ corners: () => corners });
      const win = open(mkWin({ holder }));
      assert.equal(win._lane, 'hands');
      corners = null;
      for (let i = 0; i < 20; i++) win.tick(0.016);
      assert.equal(win._lane, 'hands', 'twenty ticks without corners: still the hands, the ink hidden');
      assert.equal(win._chrome.ink.style.opacity, '0');
      corners = TRAPEZIUM;
      win.tick(0.016);
      assert.equal(win._chrome.ink.style.opacity, '1', 'the arm came back: so did the ink');
      corners = null;
      for (let i = 0; i < 50; i++) win.tick(0.016);
      assert.equal(win._lane, 'sprite', 'fifty ticks without corners: the painting');
      assert.equal(win._chrome.sheet.style.display, '');   // MAP-FIELD2
      assert.equal(win._chrome.hands.style.display, '');
      assert.equal(win._chrome.ink.style.transform, '');
      assert.notEqual(win._chrome.stage.style.width, '100%', 'the 4:3 stage is laid out again');
      assert.deepEqual(holder.calls.filter((c) => c[0] === 'release'), [['release']], 'released once');
      const holds = holder.calls.filter((c) => c[0] === 'hold').length;
      corners = TRAPEZIUM;
      for (let i = 0; i < 40; i++) win.tick(0.016);
      assert.equal(win._lane, 'sprite', 'not asked again this open');
      assert.equal(holder.calls.filter((c) => c[0] === 'hold').length, holds);
      assert.deepEqual(win._paperPoint(30, 40), [30, 40], 'the plain offset again');
      win.dispose();
      assert.equal(holder.calls.filter((c) => c[0] === 'release').length, 2, 'teardown releases too (idempotent on the rig)');
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('AUDIT-MAP2 the pointer off the sheet: in the hands lane the stage is the whole viewport, so a press on the world (outside the corners, or beyond the paper\'s vanishing line) starts nothing, a drag that leaves the sheet holds the pan where it was, and the pinch measures the fingers ON THE SHEET; off the paper nothing is hovered, picked or marked in either lane (mutants: off-sheet-press-pans, pinch-in-screen-px, pick-off-paper)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const holder = holderStub({ corners: () => TRAPEZIUM });
      const win = open(mkWin({ ...bayDeps(), holder }));
      win._setView({ ox: 450, oy: 220, scale: 8 });
      const q = win._placement;
      const stage = win._chrome.stage;
      const ev = (id, x, y) => ({ pointerId: id, clientX: x, clientY: y, button: 0, preventDefault() {} });
      const view0 = { ...win._view };
      // a press on the sky, then a drag: no pan
      fire(stage, 'pointerdown', ev(1, 20, 20));
      fire(stage, 'pointermove', ev(1, 120, 80));
      fire(stage, 'pointerup', ev(1, 120, 80));
      assert.deepEqual(win._view, view0, 'the world is not the map');
      // a press on the sky released over the city: not a pick either
      const [cityX, cityY] = q.toScreen(...toPaper(win._view, 500.5, 250.5));
      fire(stage, 'pointerdown', ev(9, 20, 20));
      fire(stage, 'pointerup', ev(9, cityX, cityY));
      assert.equal(win._selected, null, 'a press that began on the world picks nothing');
      // a drag that starts on the sheet and leaves it: the pan stops at the edge
      const [sx, sy] = q.toScreen(200, 150);
      fire(stage, 'pointerdown', ev(2, sx, sy));
      fire(stage, 'pointermove', ev(2, sx + 30, sy));
      const panned = { ...win._view };
      assert.notDeepEqual(panned, view0, 'on the sheet it pans');
      fire(stage, 'pointermove', ev(2, 5, 5));
      assert.deepEqual(win._view, panned, 'off the sheet the pan waits');
      fire(stage, 'pointerup', ev(2, 5, 5));
      // the pinch: two fingers a fixed SHEET distance apart, slid up the leaning sheet
      const rest = win._view.scale;
      const a0 = q.toScreen(200, 400), b0 = q.toScreen(300, 400);
      fire(stage, 'pointerdown', ev(3, ...a0));
      fire(stage, 'pointerdown', ev(4, ...b0));
      const a1 = q.toScreen(200, 100), b1 = q.toScreen(300, 100);
      assert.ok(Math.abs((b1[0] - a1[0]) - (b0[0] - a0[0])) > 5, 'the fixture: the screen distance changes with the foreshortening');
      fire(stage, 'pointermove', ev(3, ...a1));
      fire(stage, 'pointermove', ev(4, ...b1));
      assert.ok(Math.abs(win._view.scale - rest) < 1e-9, `the same sheet distance is no pinch (${win._view.scale} vs ${rest})`);
      fire(stage, 'pointerup', ev(4, ...b1));
      fire(stage, 'pointerup', ev(3, ...a1));
      // off the paper: nothing to pick, hover, or mark - both lanes
      assert.equal(win._onSheet([-9, 10]), false);
      assert.equal(win._onSheet([win._paper.w + 9, 10]), false);
      assert.equal(win._onSheet([10, 10]), true);
      win._selected = { name: 'X' };
      win._pickAt(-50, -50);
      assert.equal(win._selected?.name, 'X', 'a pick off the paper does nothing, not even clear');
      assert.equal(win._hoverLabel(-50, -50), null, 'off the paper the sheet answers nothing at all');
      win.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

test('AUDIT-MAP2 the close: in the hands lane the arms let the sheet go at the START of the close, with the ink, rather than holding a blank parchment through the fade (mutants: close-keeps-sheet)', () => {
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      const holder = holderStub({ corners: () => TRAPEZIUM });
      const win = open(mkWin({ holder }));
      assert.equal(win._chrome.ink.style.opacity, '1');
      win._beginClose(null);
      assert.deepEqual(holder.calls.filter((c) => c[0] === 'release'), [['release']], 'released as the close begins');
      assert.equal(win._chrome.ink.style.opacity, '0');
      assert.equal(win._placement, null);
      win.tick(0.05);
      assert.equal(win._chrome.ink.style.opacity, '0', 'and it stays down through the fade');
      assert.equal(win._lane, 'hands', 'no fallback to the painting mid-fade');
      for (let i = 0; i < 20; i++) win.tick(0.05);
      assert.equal(win.done, true);
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});

// ── AUDIT-MAP2: the MAP1/MAP2 side ───────────────────────────────

test('AUDIT-MAP2 T1/T2: the teleport box - with no purse for the fee there is NO yes (Y closes the map without a teleport, as the classic\'s teleportpoor box closes on any key), and Escape IS the box\'s No (the fee closes the map, DFU\'s own box leaves it armed) (mutants: poor-y-teleports, escape-skips-fee)', () => {
  withDocument(() => {
    const ported = [], paid = [];
    const mk = (gold) => {
      const win = open(mkWin({ ...bayDeps(), magesGuildRank: () => 0, gold: () => gold, goldPieces: () => gold, payTeleport: (c) => paid.push(c), onTeleport: (p) => ported.push(p), travelOptions: () => ({ settings: { teleportCost: true }, destinationName: null, isTravelActive: false }) }));
      win.activateTeleportationTravel();
      win._select({ summary: summaryOf(500, 250, LOCATION_TYPES.TownCity), name: 'Wayrest', x: 500.5, y: 250.5, colorIndex: 11, kind: 'city' });
      return win;
    };
    let win = mk(0);
    assert.equal(win._panel, 'teleport');
    assert.equal(win._panelState.fee?.canPay, false, 'a poor mage');
    win.input('KeyY');
    assert.equal(win._phase, 'closing', 'the map closes');
    assert.equal(win._commit, null, 'with no teleport');
    assert.deepEqual(paid, []);
    for (let i = 0; i < 20; i++) win.tick(0.05);
    assert.deepEqual(ported, []);
    // the fee, affordable: Escape closes the map, as N does
    win = mk(10000);
    assert.equal(win._panelState.fee?.canPay, true);
    win.input('Escape');
    assert.equal(win._phase, 'closing', 'Escape on the fee box closes the map (the classic: N or Escape, one arm)');
    assert.equal(win._commit, null);
    win.dispose();
    // no fee (the rank is high enough): Escape closes the box, the map stays armed
    const w3 = open(mkWin({ ...bayDeps(), magesGuildRank: () => 9, gold: () => 100, goldPieces: () => 100, onTeleport: (p) => ported.push(p), travelOptions: () => ({ settings: { teleportCost: true }, destinationName: null, isTravelActive: false }) }));
    w3.activateTeleportationTravel();
    w3._select({ summary: summaryOf(500, 250, LOCATION_TYPES.TownCity), name: 'Wayrest', x: 500.5, y: 250.5, colorIndex: 11, kind: 'city' });
    assert.equal(w3._panel, 'teleport');
    assert.equal(w3._panelState.fee, null);
    w3.input('Escape');
    assert.equal(w3._phase, 'map', 'DFU\'s TeleportPopUp: Escape is No, the map stays');
    assert.equal(w3._panel, null);
    assert.equal(w3.teleportationTravel, true, 'still armed');
    w3.dispose();
  });
});

test('AUDIT-MAP2 T3: the guild\'s teleport map has no travel arm - a travel panel asked for on the armed map is the teleport box, and the card\'s one button is the teleport (mutants: armed-offers-travel)', () => {
  withDocument(() => {
    const win = open(mkWin({ ...bayDeps(), magesGuildRank: () => 9, gold: () => 100, goldPieces: () => 100, onTeleport: () => {} }));
    win.activateTeleportationTravel();
    win._select({ summary: summaryOf(500, 250, LOCATION_TYPES.TownCity), name: 'Wayrest', x: 500.5, y: 250.5, colorIndex: 11, kind: 'city' });
    assert.equal(win._panel, 'teleport');
    win.input('Escape');
    assert.equal(win._panel, null);
    const texts = (n) => [n.textContent, ...(n.children ?? []).flatMap(texts)].filter(Boolean);
    assert.ok(texts(win._chrome.card).includes('Teleport here'), 'the card offers the teleport');
    assert.ok(!texts(win._chrome.card).includes('Travel here'), 'and never the trip the teleport host has no hook for');
    win._openPanel('travel');
    assert.equal(win._panel, 'teleport', 'a travel panel on the armed map IS the teleport box');
    assert.ok(!win._panelState?.opts, 'no fast-travel state was minted');
    win.dispose();
  });
});

test('AUDIT-MAP2 T4: "bare" is the data\'s word - a click dead on a discovered hamlet the far band hides is not a nameless walk to its pixel (the band still hides it from the pick, MAP1\'s law) (mutants: coords-by-band)', () => {
  withDocument(() => {
    const mapDict = new Map();
    const sm = summaryOf(200, 100, LOCATION_TYPES.TownHamlet); mapDict.set(sm.id, sm);
    const win = open(mkWin({
      mapSize: { width: 400, height: 200 }, woods: { heightMapBuffer: new Uint8Array(80000).fill(10) }, mapDict,
      maps: { regionCount: 1, getRegion: () => ({ mapNames: ['A', 'B', 'C', 'Hamlet'] }), getPoliticIndex: () => 128 },
      coordsAllowed: () => true, onTravelToCoords: () => {},
      travelOptions: () => ({ settings: { targetCoordsAllowed: true, cautiousTravel: true, stopAtInnsTravel: true, cautiousTravelMultiplier: 0.8, recklessTravelMultiplier: 1 }, destinationName: null, isTravelActive: false }),
    }));
    win._view.scale = 2.0; win._goal = { ...win._view };   // the far band by hand: the clamp would refuse it on a small bay
    assert.equal(zoomBand(win._view.scale), 'far');
    assert.ok(win._coordsAllowedHere());
    const [px, py] = toPaper(win._view, 200.5, 100.5);
    win._pickAt(px, py);
    assert.equal(win._selected, null, 'neither the hamlet (the band hides it) nor a coordinates trip');
    assert.equal(win._panel, null);
    // a truly bare pixel next to it still opens the coordinates decision
    const [bx, by] = toPaper(win._view, 210.5, 100.5);
    win._pickAt(bx, by);
    assert.equal(win._selected?.coords, true);
    win.dispose();
  });
});

test('AUDIT-MAP2 perf and polish: the kept static layer is not reset on every pan frame, the Ports toggle keeps the bay-wide index (the law is applied at query time), the fuzzy search keeps two hundred not a thousand, the wheel holds still under a box, the journey carries no second walk, the ink\'s region read is the maps file\'s own where the host hands one, the player\'s pixel is polled with the party (mutants: layer-reset-per-frame, ports-drops-index, wheel-under-box, player-snapshot)', () => {
  const src = read('src/ui/heldMap.js');
  assert.match(src, /if \(lctx && \(layer\.width !== canvas\.width \|\| layer\.height !== canvas\.height\)\) \{ layer\.width = canvas\.width; layer\.height = canvas\.height; \}/);
  assert.equal((src.match(/this\._searchIndex = null;/g) || []).length, 1, 'only the constructor');
  assert.match(src, /distance\.findBestMatches\(name, 200\)/);
  assert.doesNotMatch(src, /path: walkTravelPath/);
  assert.doesNotMatch(src, /byRoad: false/);
  assert.doesNotMatch(src, /walkTravelPath\(/, 'the walk is calculateTravelTime\'s own');
  assert.match(src, /typeof maps\?\.getRegionIndexAt === 'function' \? maps\.getRegionIndexAt\(x, y\)/);
  assert.match(read('src/ui/enhancedStyle.js'), /\.hmroot \.hmfoot \{ background: rgba\(10, 12, 17, 0\.72\);/, 'the foot has its own scrim over the world - MAP-FIELD2: on both lanes, neither having a black behind it');
  withDocument(() => {
    // the region read: a host maps file whose getRegionIndexAt carries the fixups
    const politic = () => 64;   // the High Rock sea coast byte
    // two byte arrays: the chain cache is keyed on the bytes' identity
    const noFix = new HeldMapWindow(winDeps({ maps: { regionCount: 62, getPoliticIndex: politic, getRegion: () => null }, woods: { heightMapBuffer: new Uint8Array(100).fill(10) } }));
    const fixed = new HeldMapWindow(winDeps({ maps: { regionCount: 62, getPoliticIndex: politic, getRegionIndexAt: () => 31, getRegion: () => null }, woods: { heightMapBuffer: new Uint8Array(100).fill(10) } }));
    assert.equal(noFix._sheet.ensure().regions.length, 0, 'a bare -128 on byte 64 names nothing');
    assert.equal(fixed._sheet.ensure().regions.length, 1, 'the maps file\'s own read names the sea coast');
    noFix.dispose(); fixed.dispose();
    // the wheel under a box
    const win = open(mkWin(bayDeps()));
    win._setView({ ox: 450, oy: 220, scale: 8 });
    win._top = 'resume'; win._renderBox();
    fire(win._chrome.stage, 'wheel', { deltaY: -100, deltaMode: 0, clientX: 300, clientY: 300, preventDefault() {} });
    assert.equal(win._view.scale, 8, 'held still');
    win._top = null; win._renderBox();
    win._info = { rows: ['a'] };
    fire(win._chrome.stage, 'wheel', { deltaY: -100, deltaMode: 0, clientX: 300, clientY: 300, preventDefault() {} });
    assert.equal(win._view.scale, 8);
    win._info = null;
    win.dispose();
    // the ports toggle keeps the index (the mod fixture: a real region table)
    const wp = open(new HeldMapWindow(modDeps({}, { shipTravelPortsOnly: true })));
    wp._ensureSearchIndex();
    assert.ok(wp._searchIndex);
    const idx = wp._searchIndex;
    wp._togglePorts();
    assert.equal(wp._searchIndex, idx, 'kept: the ports law is applied per query');
    wp.dispose();
    // the player's pixel, polled
    let p = { x: 5, y: 5 };
    const w2 = open(mkWin({ getPlayerPixel: () => p }));
    assert.deepEqual(w2._player, { x: 5, y: 5 });
    p = { x: 6, y: 7 };
    for (let i = 0; i < 8; i++) w2.tick(0.05);
    assert.deepEqual(w2._player, { x: 6, y: 7 }, 'moved with the poll');
    w2.dispose();
  });
});

// ── AUDIT-FIELD F2: the hands lane's retry ───────────────────────────
//
// MAP-FIELD made this lane reachable in the game for the first time (its
// `available` used to be `armsDrawn()`, which a sheathed player could
// never answer yes to). The retry that lets a map opened before the rig
// is up still find the arms - "in case the rig had not posed yet" - was
// disarmed by the very first no, which is precisely the case it exists
// for. MAP-FIELD pinned none of this lane by execution; this does.
test('AUDIT-FIELD: the hands lane keeps asking after a no - the rig is not always up on the frame the map opens (mutant: hands-retry-disarmed-by-the-first-no)', () => {
  withDocument(() => {
    // the rig is not posed for the first few ticks, then it is
    let up = false, held = false;
    const holder = { available: () => up, hold: () => { held = up; return held; }, corners: () => null, release: () => { held = false; } };
    const win = mkWin({ holder });
    win.tick(0.05);
    assert.equal(win._lane, 'sprite', 'the first ask finds no arm, so the painting stands');
    assert.ok(win._handsTries > 0, 'and the retry is ARMED by that ask - the bug was zeroing it here');
    up = true;
    for (let i = 0; i < 5; i++) win.tick(0.05);
    assert.equal(win._lane, 'hands', 'the moment the rig poses, the sheet goes to the arm');
    win.dispose();
  });
});

test('AUDIT-FIELD: an arm that never comes leaves the painting standing, and the asking stops', () => {
  withDocument(() => {
    const holder = { available: () => false, hold: () => false, corners: () => null, release: () => {} };
    const win = mkWin({ holder });
    for (let i = 0; i < 40; i++) win.tick(0.05);
    assert.equal(win._lane, 'sprite', 'no arm, ever: the classic sprite is the whole window');
    assert.ok(win._handsTries >= 30, 'and the retry ran to its bound rather than for ever');
    win.dispose();
  });
});

// ═══ MAP-FIELD2 (Mac, 2026-09-18) ═══════════════════════════════════
// "The held map should be at the bottom of the screen, arms should sit
// slighty below where there is no gap. The status and magicka/health/
// fatigue UI element's should go away when it is taken out."
test('MAP-FIELD2: the sheet is HELD - bottom-anchored with the arms past the edge, the world behind it, and the vitals go with it (mutants: MAPFIELD2-*)', () => {
  const src = read('src/ui/heldMap.js');

  // 1. THE GEOMETRY, as a law rather than as one viewport's numbers.
  // The sprite was fitted to the whole viewport and CENTRED, which is
  // why it read as a picture of hands in a letterbox instead of hands.
  assert.ok(HELD_MAP_HEIGHT > 0 && HELD_MAP_HEIGHT <= 1, 'the height is a fraction of the viewport');
  assert.ok(HELD_MAP_BITE > 0 && HELD_MAP_BITE < 0.2, 'and the bite a fraction of the sprite, downward');
  // THE MEASUREMENT THIS RESTS ON. Below SPRITE_ART_FOOT every row of
  // `held-map.png` is empty, so anchoring the FILE to the bottom of the
  // screen leaves the arms ending in mid-air with that much of the
  // screen blank under them - which is exactly the gap Mac named. It is
  // measured off the picture (now off its ALPHA, MAP-FIELD4), and the
  // probe that measured it is tools/heldMapArtProbe.mjs.
  assert.ok(SPRITE_ART_FOOT > 0.7 && SPRITE_ART_FOOT < 0.95, `the painting ends at ${SPRITE_ART_FOOT} of the file`);
  assert.ok(SPRITE_ART_FOOT > CUFF_BAND, 'and the cuff band is above it - the cut cuffs end between the two');
  const stageFor = (vw, vh) => {
    let sh = vh * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, sw = sh * SPRITE.w / SPRITE.h;
    if (sw > vw) { sw = vw; sh = sw * SPRITE.h / SPRITE.w; }
    return { x: (vw - sw) / 2, y: vh - (SPRITE_ART_FOOT - HELD_MAP_BITE) * sh, w: sw, h: sh };
  };
  for (const [vw, vh, why] of [[1600, 900, 'a desktop'], [1920, 1080, 'a bigger one'], [2400, 900, 'an ultrawide'],
    [800, 1200, 'a phone held upright'], [640, 360, 'a short landscape phone']]) {
    const g = stageFor(vw, vh);
    assert.ok(g.y + g.h * SPRITE_ART_FOOT > vh, `${why}: the PAINTING's foot goes past the bottom edge - there is no gap under the arms`);
    assert.ok(g.w <= vw + 1e-9, `${why}: and the sheet never runs wider than the screen, which would cut the paper's sides off`);
    assert.ok(Math.abs(g.w / g.h - SPRITE.w / SPRITE.h) < 1e-9, `${why}: the painting keeps its own aspect`);
    assert.ok(g.x >= 0, `${why}: centred across, never off the left`);
  }
  // the ONE case where the height gives way: a viewport too narrow to
  // hold the width the height asks for
  const tall = stageFor(400, 2000);
  assert.equal(tall.w, 400, 'a narrow viewport takes the width and the height follows');
  assert.ok(tall.h < 2000 * HELD_MAP_HEIGHT / SPRITE_ART_FOOT, '...which is SHORTER than the height would have been');
  assert.match(src, /if \(sw > vw\) \{ sw = vw; sh = sw \* SPRITE\.h \/ SPRITE\.w; \}/, 'and that clamp is in the layout, not only in this pin');
  assert.match(src, /const sx = \(vw - sw\) \/ 2, sy = vh - \(SPRITE_ART_FOOT - HELD_MAP_BITE\) \* sh;/, 'anchored on the PAINTING\'s foot and carried past it');

  // 1b. AND THERE IS NO BLACK TO TAKE OFF. MAP-FIELD4: the first
  // painting was fully opaque on its own painted matte, and this module
  // keyed that black out by brightness so bottom-anchoring would not
  // walk a black rectangle down the screen. Mac's second painting
  // carries a real alpha channel, so the key is GONE - and on this art
  // reviving it would be a bug, because these gauntlets are grey and
  // reach luma 0. The departure is recorded in the arc; this is the pin
  // that would catch it coming back by feel.
  assert.doesNotMatch(src, /MATTE_LUM|MATTE_EDGE|keyMattePixels|keyHandPixels/, 'the brightness keys are retired, not merely unused');
  assert.match(src, /const sprite = el\('img'\);/, 'the <img> is the LOADER');
  assert.match(src, /const sprite = el\('img'\);/, 'the <img> is the LOADER');
  assert.match(src, /const sheet = el\('canvas', 'hmsprite'\);/, '...and a canvas is what the stage shows');
  assert.match(src, /stage\.append\(sheet, ink, hands\);/, 'so the keyed sprite is under the ink, where the painting was');

  // 2. THE VITALS GO WITH IT, and not through the covering question.
  // DFU repaints its LARGE hud under its own windows (hud.js's
  // `&& !largeHud?.art`), which is right for a window and wrong for a
  // sheet held in the player's hands - so this is a second, separate
  // word, and it is NOT inside that carve-out.
  assert.equal(hidesHud({ hidesHud: true }), true);
  assert.equal(hidesHud({ hidesHud: 1 }), false, 'the field is the literal true, as previousWindow is');
  assert.equal(hidesHud({}), false); assert.equal(hidesHud(null), false);
  assert.match(src, /this\.hidesHud = true;/, 'the sheet declares it');
  assert.match(read('src/ui/hud.js'), /const hudCovered = hudHidden \|\| \(\(windowCoversHud \?\? cursorActive\) && !largeHud\?\.art\);/,
    'and the hide is OUTSIDE the large-HUD carve-out - inside it, the enhanced skin would keep its bars on the knuckles');
  // the overlay's answer takes NO pause gate: the held map does not stop
  // the world, and the vitals go anyway
  assert.match(read('src/scenes/townTalk.js'), /get hudHidden\(\) \{ return hidesHud\(overlay\); \},/);
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) {
    assert.match(read(h), /hudHidden: townTalk\.hudHidden,/, `${h}: the host asks`);
  }
  // and nothing ELSE in the port claims it, so no DFU window moved
  const claims = [];
  for (const f of ['src/ui/heldMap.js', 'src/ui/travelMapWindow.js', 'src/ui/inventoryWindow.js', 'src/ui/charsheet.js', 'src/ui/pauseWindow.js'])
    if (existsSync(new URL(`../${f}`, import.meta.url)) && /\bhidesHud = true/.test(read(f))) claims.push(f);
  assert.deepEqual(claims, ['src/ui/heldMap.js'], 'the held map is the only window that takes the HUD away');
});

// Mac's second look: "There's still a gap at the bottom of the arms,
// any way you can author the gap?" - and MAP-FIELD4, where the answer
// had to be rebuilt for a third painting.
//
// The cuffs are CUT BY THE FRAME: the picture simply stops partway down
// the forearms. Measured by column (tools/heldMapArtProbe.mjs) the cut
// ends are not level - they run 0.866 to 0.893 of the file. Whether the
// bite alone clears them depends on where Mac wants the sheet to sit:
// at MAP-FIELD2's bite the highest cleared by half a pixel, at
// MAP-FIELD5's by 75. extendCuffs is what makes the law hold at any of
// them, which is why it stays even where the margin is comfortable.
//
// WHICH columns it may carry is the whole difficulty, and two answers
// were wrong before this one. Asking whether a column falls outside
// PAPER's x range smears the sheet's own torn edge, because PAPER is
// inset a few pixels inside the parchment. Asking whether it ends below
// the sheet smears the entire parchment, because the sheet's ragged
// bottom hangs lower than PAPER's foot. The answer that holds is the
// CUFF BAND, and it works because the painting leaves a gap there:
// every column under the sheet ends by 0.733, every cut cuff at 0.866
// or below, and NOTHING ends in between. What would lie in between is
// the hand's own silhouette - drawn to end where it ends, and ruined by
// a streak.
test('MAP-FIELD2/4: the cut cuffs are AUTHORED down to the foot, and nothing else is - through the window itself (mutants: MAPFIELD2-the-cuffs-end-in-mid-air, MAPFIELD2-the-extension-smears-the-parchment, MAPFIELD4-the-extension-streaks-the-silhouette)', () => {
  const W = 100, H = 100;
  const ARM = [96, 88, 92], PAPER_RGB = [206, 183, 141];
  // AUDIT MAP-FIELD: a gauntlet pixel dark enough that ANY brightness
  // key would eat it. The departure recorded at MAP-FIELD4 was guarded
  // by spelling alone - `doesNotMatch(src, /MATTE_LUM|.../)` - and a
  // real key written under any other name sailed through all 84 pins.
  // This pixel is the behavioural half: the painting's own alpha says
  // it is there, and nothing may decide otherwise from its brightness.
  const SHADOW = [6, 5, 7];
  const band = Math.round(CUFF_BAND * H);
  assert.ok(band > 0 && band < H - 2, 'the band is inside the file, or this fixture proves nothing');
  // a sprite the shape of the real one: TRANSPARENT ground (MAP-FIELD4
  // - the painting carries its own alpha now), a parchment block with a
  // torn foot ABOVE the band, two forearms cut BELOW it at different
  // rows, and one silhouette column that ends high on purpose.
  const paint = () => {
    const d = new Uint8ClampedArray(W * H * 4);
    const put = (x, y, [r, g, b]) => { const i = ((y * W) + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; };
    const px0 = Math.floor(PAPER.x0 * W), px1 = Math.ceil(PAPER.x1 * W);
    for (let y = 14; y <= band - 10; y++) for (let x = px0; x < px1; x++) put(x, y, PAPER_RGB);
    for (let y = 50; y <= band + 3; y++) put(5, y, ARM);      // the left forearm, cut just past the band
    for (let y = 54; y <= 58; y++) put(5, y, SHADOW);         // ...and the deep shadow inside its folds
    for (let y = 50; y <= band + 9; y++) put(95, y, ARM);     // the right one, cut lower
    for (let y = 40; y <= band - 20; y++) put(2, y, ARM);     // a hand's silhouette, DRAWN to end there
    return d;
  };
  const data = paint();
  let put = null;
  const sheet = { width: 0, height: 0, getContext: () => ({
    drawImage() {}, getImageData: () => ({ data, width: W, height: H }),
    putImageData(img) { put = img; },
  }) };

  withDocument(() => {
    const win = mkWin();
    win._paintSheet({ naturalWidth: W, naturalHeight: H }, sheet);
    win.dispose();
  });
  assert.equal(sheet.width, W, 'the canvas is sized to the file, not left at zero');
  assert.equal(sheet.height, H);
  assert.ok(put, 'and the painted bytes are written back');

  const at = (x, y) => { const i = ((y * W) + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  // 1. NOTHING IS KEYED. The ground was already transparent; the art is
  // handed through exactly as the painter left it.
  assert.equal(at(50, 5)[3], 0, 'the clear ground above the paper is still clear');
  assert.deepEqual(at(50, 40), [...PAPER_RGB, 255], 'and the parchment is untouched');
  // MAP-FIELD4's departure, pinned by BEHAVIOUR: these gauntlets are
  // grey and reach luma 0, so any brightness key - whatever it is
  // called - punches a hole straight through the arm.
  assert.deepEqual(at(5, 56), [...SHADOW, 255], 'the deep shadow in the arm survives: nothing keys on brightness any more');

  // 2. THE CUT CUFFS RUN OFF THE BOTTOM. Every row under the forearm's
  // last painted one carries its colour, to the file's foot.
  assert.deepEqual(at(5, band + 3), [...ARM, 255], 'the painted cuff is still the painted cuff');
  assert.deepEqual(at(5, band + 4), [...ARM, 255], 'and the row under it is authored');
  assert.deepEqual(at(5, H - 1), [...ARM, 255], 'down to the last row of the file - no gap left to see');
  assert.deepEqual(at(95, H - 1), [...ARM, 255], 'the right arm too, though it was cut lower');
  assert.deepEqual(at(5, 40), [0, 0, 0, 0], 'and ABOVE the arm nothing is invented');

  // 3. THE PARCHMENT IS NOT SMEARED. Its torn bottom edge is art.
  assert.equal(at(50, band - 9)[3], 0, 'under the paper\'s torn foot: still clear');
  assert.equal(at(50, H - 1)[3], 0, '...all the way down');

  // 4. NOR IS THE SILHOUETTE. MAP-FIELD4's own lesson: a column that
  // ends above the band was DRAWN to end there, and streaking it paints
  // an arm the painter never held.
  assert.equal(at(2, band - 19)[3], 0, 'under the hand\'s own last row: clear');
  assert.equal(at(2, H - 1)[3], 0, '...and it stays clear to the foot');

  // the pure law, driven on its own: the same answers, and it RETURNS
  // the buffer it was handed, in place, as the key does
  const solo = paint();
  assert.equal(extendCuffs(solo, W, H), solo, 'in place, like keyThumbPixels');
  // a fringe pixel is half air: its colour is not the arm's, and
  // carrying it down at full opacity paints a streak the arm never had
  const fringe = paint();
  const fi = (((band + 5) * W) + 5) * 4;
  fringe[fi] = 255; fringe[fi + 1] = 0; fringe[fi + 2] = 0; fringe[fi + 3] = 40;
  extendCuffs(fringe, W, H);
  assert.deepEqual([fringe[((H - 1) * W + 5) * 4], fringe[((H - 1) * W + 5) * 4 + 1]], [ARM[0], ARM[1]],
    'the foot is the last pixel the painter made SOLID, not the fringe below it');
  const fsrc = read('src/ui/heldMap.js');
  assert.match(fsrc, /if \(last < band \|\| last >= h - 1\) continue;/, 'the band is the test, so it is one number to turn if the art changes');
  assert.match(fsrc, /extendCuffs\(img\.data, w, h\);/, 'and the window runs it on the sprite it shows');
});

// ═══ EM1: ONE MAP, THREE SHEETS ══════════════════════════════════════
//
// Mac (2026-09-21): "instead of 3 seperate keybinds, adding a tab toggle
// on the map itself. So if you open it in a dungeon, the world map would
// be not accessible, same for the town map."
//
// The window keeps the paper, the hands, the pan, the zoom, the held
// pose and the closing; what is INKED on the sheet is a tab. These pins
// hold the seam rather than the strip's geometry (test/mapstrip.test.js
// has that): the window asks the SHEET for its space, its ink and its
// pointer and never asks WHICH sheet, the strip is asked before the
// sheet on a click, and the bay is still exactly the bay.

test('EM1: the window answers the sheet contract for every sheet it holds', () => {
  withDocument(() => {
    const win = mkWin();
    assert.ok(win._sheets.size >= 1);
    for (const [id, sheet] of win._sheets) {
      assert.equal(sheet.id, id, `_sheets keys by the sheet's own id (${id})`);
      assert.ok(MAP_SHEETS.includes(id), `${id} is not a sheet`);
      assert.ok(isSheet(sheet), `the ${id} sheet is missing a member of the contract`);
    }
    // and the live sheet is one of them
    assert.equal(win._sheet, win._sheets.get(win._slot.live));
    win.dispose();
  });
});

test('EM1: the context is DERIVED off the host flags, never declared - and no flags is the wilderness', () => {
  withDocument(() => {
    const at = (where) => { const w = mkWin(where ? { where: () => where } : {}); const c = w._slot.context; w.dispose(); return c; };
    assert.equal(at(null), 'wilderness', 'a host that says nothing is out in the wild - the bay, as it always was');
    assert.equal(at({}), 'wilderness');
    assert.equal(at({ inLocation: true }), 'town');
    assert.equal(at({ insideBuilding: true, inLocation: true }), 'building', 'a shop in a town is the shop');
    assert.equal(at({ insideDungeon: true }), 'dungeon');
    // the host hands FLAGS. It never names a context and never names a
    // tab: a host that declares is a host that forgets.
    const src = read('src/ui/heldMap.js');
    assert.match(src, /mapContextOf\(deps\.where\?\.\(\) \?\? \{\}\)/, 'the window derives the context itself');
    assert.doesNotMatch(src, /deps\.mapContext\b|deps\.sheets\b/, 'no host declares the context or the sheet list');
  });
});

test('EM1: the slot offers only what this window can ink, so nothing a player reaches has moved', () => {
  withDocument(() => {
    // EM1 ships the WORLD sheet alone, and no host hands `where` yet,
    // so every window that opens today derives the wilderness and inks
    // the bay - the strip reads "The Bay" and there is no second tab.
    for (const extra of [{}, { where: () => ({}) }, { where: () => ({ inLocation: true }) }]) {
      const win = mkWin(extra);
      assert.deepEqual([...win._slot.ids], ['world'], 'until EM3/EM4 there is one sheet to ink');
      assert.equal(win._slot.live, 'world');
      assert.equal(win._slot.toggles, false);
      assert.equal(win._slot.empty, false);
      win.dispose();
    }
    // ...and the gate lifts itself the moment a sheet is added: the
    // narrowing is over `_sheets`, not a literal.
    assert.match(read('src/ui/heldMap.js'), /has: \[\.\.\.this\._sheets\.keys\(\)\]/);
  });
});

test('EM1: a place this window can ink NOTHING for is empty, and an empty window still ticks and closes', () => {
  withDocument(() => {
    // a crypt offers the automap alone (Mac's sentence), and EM1 has no
    // automap sheet - so the slot is EMPTY. This is the state EM3 lifts,
    // and until then it must be a quiet nothing rather than a throw: the
    // host asks `empty` before it opens, and a window that opened anyway
    // inks no sheet, lays an empty strip and closes like any other.
    const win = mkWin({ where: () => ({ insideDungeon: true }) });
    assert.equal(win._slot.empty, true);
    assert.equal(win._slot.live, null);
    assert.equal(win._sheet, null);
    assert.doesNotThrow(() => open(win));
    assert.deepEqual(win._strip.tabs, [], 'no tab names a sheet that cannot be drawn');
    // the clamp still has a space to work in, so the pan and zoom laws
    // do not divide by a missing sheet
    const lim = win._limits();
    assert.equal(lim.mapW, 10); assert.equal(lim.mapH, 10);
    assert.doesNotThrow(() => win._setView({ ox: 3, oy: 3, scale: 2 }));
    assert.doesNotThrow(() => win._selectSheet('automap'));
    assert.equal(win._slot.live, null, 'and a sheet it does not hold cannot be selected');
    assert.doesNotThrow(() => win.dispose());
  });
});

test('EM1: the window asks the SHEET for the space, the ink and the pointer - and never asks WHICH sheet', () => {
  const src = read('src/ui/heldMap.js');
  // the clamp reads the LIVE sheet's own size, so a sheet in world
  // units and a sheet in map pixels each get their own limits
  assert.match(src, /const size = this\._sheet\?\.size\?\.\(\) \?\? this\._size;/);
  // the ink, the pick, the label, the mark and the clock all go through it
  for (const arm of ['ensure', 'paintStatic', 'paintOverlay', 'staticKey', 'pickAt', 'hoverLabel', 'mark', 'tick']) {
    assert.match(src, new RegExp(`sheet\\??\\.?\\??${arm}|_sheet\\?\\.${arm}`), `the window does not route ${arm} through the sheet`);
  }
  // THE GENERATIVE HALF: no branch on a sheet's NAME anywhere in the
  // window. A window that knows which sheet is up is a window that will
  // grow a special case for each one - which is the three windows this
  // arc exists to collapse.
  const body = src.slice(src.indexOf('export class HeldMapWindow'));
  for (const id of MAP_SHEETS) {
    const branch = new RegExp(`(===|!==|case)\\s*'${id}'`);
    assert.doesNotMatch(body, branch, `the window branches on the '${id}' sheet by name`);
  }
  // the one place a sheet's id is written down is where the sheet is BUILT
  assert.equal((body.match(/id: '(?:automap|town|world)'/g) || []).length, body.split('_worldSheet()').length - 1 > 0 ? 1 : 0,
    'a sheet names itself once, at its own construction');
});

test('EM1: the strip is laid out on every paint, in paper pixels, and rides the KEPT layer', () => {
  withDocument(() => {
    const win = open(mkWin());
    assert.ok(win._strip, 'the layout is minted even with no 2D context - the hit test is the pointer\'s');
    assert.deepEqual(win._strip.tabs.map((t) => t.sheet), ['world']);
    assert.equal(win._strip.tabs[0].title, 'The Bay');
    assert.equal(win._strip.tabs[0].live, true);
    // the strip scales with the PAPER, not the screen
    assert.equal(win._strip.scale, stripScale(win._paper.w));
    win.dispose();
    // AUDIT-MAP's kept layer: the tabs are re-lettered only when the
    // static key moves, never on a breathing ring's frame
    const src = read('src/ui/heldMap.js');
    const paint = src.slice(src.indexOf('  _paint() {'), src.indexOf('  _paintStrip('));
    const atStrip = paint.indexOf('this._paintStrip(');
    const atKey = paint.indexOf("if (key !== this._staticKey");
    const atOverlay = paint.indexOf('sheet.paintOverlay(');
    assert.ok(atKey >= 0 && atStrip > atKey, 'the strip is painted inside the static-key branch');
    assert.ok(atOverlay > atStrip, '...and the overlay still goes on top of it');
    // the live tab is part of what makes the layer stale, or a tab
    // press would leave the old rule under the old word
    assert.match(paint, /this\._slot\.live, sheet\.staticKey\(\)/);
  });
});

test('EM1: a click on a tab switches the sheet and never picks the place under it', () => {
  withDocument(() => {
    const win = open(mkWin(modDeps()));
    // give the window a second sheet by hand: EM1 ships one, and this
    // pin is about the SEAM, which must work the moment EM3 lands
    let mounted = 0, inked = 0, picked = 0, labelled = 0;
    win._sheets.set('town', {
      id: 'town', size: () => ({ width: 4, height: 4 }),
      ensure: () => ({ marks: [] }), staticKey: () => 'x',
      paintStatic: () => { inked++; }, paintOverlay: () => {},
      // COUNTED, not ignored: "the tab was not also a pick" is only
      // held if a pick that did happen would show up somewhere
      pickAt: () => { picked++; }, hoverLabel: () => { labelled++; }, mark: () => {},
      tick: () => {}, mount: () => { mounted++; }, unmount: () => {},
      homeView: () => null,
    });
    win._slot = createSheetSlot({ context: 'town', has: [...win._sheets.keys()] });
    win._paint();
    assert.deepEqual(win._strip.tabs.map((t) => t.sheet), ['town', 'world'], 'the strip is the slot');
    assert.equal(win._slot.live, 'town');

    // stand on the bay, then press the TOWN tab
    win._selectSheet('world');
    assert.equal(win._slot.live, 'world');
    mounted = 0;
    win._paint();
    // a pointer down + up on the TOWN tab, with no drag between them
    const tab = win._strip.tabs.find((t) => t.sheet === 'town');
    const [px, py] = [tab.x + tab.w / 2, tab.y + tab.h / 2];
    const markBefore = win.markedMapId;
    fire(win._chrome.stage, 'pointerdown', { button: 0, pointerId: 9, clientX: px, clientY: py });
    fire(win._chrome.stage, 'pointerup', { button: 0, pointerId: 9, clientX: px, clientY: py });
    assert.equal(win._slot.live, 'town', 'the tab was pressed');
    assert.equal(picked, 0, 'and NO sheet was asked to pick the point under the word');
    assert.equal(win._selected, null, 'so nothing on the bay was selected either');
    assert.equal(win.markedMapId, markBefore);
    assert.equal(mounted, 1, 'a sheet is told when it goes up');
    assert.ok(inked >= 0);

    // the same for the pointer's LABEL: a tab names itself, and the
    // sheet under it is never asked what is at that point
    fire(win._chrome.stage, 'pointermove', { pointerId: 11, clientX: px, clientY: py });
    assert.equal(labelled, 0, 'the sheet was asked to label a point on the strip');
    assert.equal(win._chrome.label.textContent, 'Town');
    // ...and a point BELOW the strip is the map's again
    fire(win._chrome.stage, 'pointermove', { pointerId: 11, clientX: px, clientY: py + win._strip.h + 40 });
    assert.equal(labelled, 1, 'the map under the strip still labels');

    // the sheet each tab left is remembered, and found again
    win._selectSheet('world');
    win._setView({ ox: 1, oy: 1, scale: win._view.scale });
    const moved = { ...win._view };
    win._selectSheet('town');
    assert.deepEqual(win._slot.viewOf('world'), moved, 'the bay is where it was left');
    win._selectSheet('world');
    assert.deepEqual({ ...win._view }, moved, 'and it comes back to it');
    win.dispose();
  });
});

test('EM1: the bay is still exactly the bay - the sheet route is a ROUTE, not a rewrite', () => {
  withDocument(() => {
    // the world sheet's ink is the same two inkMap calls with the same
    // options the window passed before the contract existed
    const win = open(mkWin(modDeps()));
    const sheet = win._sheets.get('world');
    const model = sheet.ensure();
    assert.ok(model?.coast, 'the bay\'s chains');
    const env = { model, view: win._view, paperW: 200, paperH: 200, dpr: 1, band: 'near', pulse: 0.5 };
    const a = recordingCtx(); sheet.paintStatic(a, env);
    const b = recordingCtx(); sheet.paintOverlay(b, env);
    assert.ok(a.calls.length > 0, 'the static half still inks the bay');
    assert.ok(b.calls.length > 0, 'and the overlay half still breathes');
    // the two halves are the two inkMap painters, not one merged pass:
    // the static one sets a transform and strokes the coast, the
    // overlay one draws the player's own mark and clears nothing
    assert.ok(a.calls.some((c) => c.fn === 'setTransform'));
    assert.ok(!b.calls.some((c) => c.fn === 'clearRect'), 'the overlay never wipes the kept ink under it');
    // and the world sheet's pointer arms ARE the window's own methods -
    // the same code, reached through the seam
    assert.equal(sheet.pickAt.length, 2);
    assert.equal(sheet.hoverLabel.length, 2);
    const src = read('src/ui/heldMap.js');
    assert.match(src, /pickAt: \(px, py\) => this\._pickAt\(px, py\),/);
    assert.match(src, /hoverLabel: \(px, py\) => this\._hoverLabel\(px, py\),/);
    assert.match(src, /mark: \(px, py\) => this\._markLocationHandler\(px, py\),/);
    win.dispose();
  });
});

test('ENH-NOTICE3 (AUDIT B4/B6): the card\'s refusal wears no hint (nothing dismisses it), the I/H box keeps the default (any key or press closes it), and a card that goes away takes its panel', () => {
  const buildings = [{ buildingType: 0, displayName: 'The Odd Blades' }];
  const deps = () => modDeps({ gold: () => 0, goldPieces: () => 0, discoveredBuildings: () => buildings, buildingTypeName: () => 'Alchemist' });
  skin('enhanced');
  withDocument((doc) => {
    const win = open(mkWin(deps()));
    win._pickAt(...toPaper(win._view, 3.5, 3.5));
    win._openPanel('travel');
    win._begin();
    assert.match(win._panelState.notice, /gold/);
    const hints = () => ((doc.body.children ?? []).find((c) => c.id === ENHANCED_NOTICE_ID)?.children ?? [])
      .flatMap((panel) => panel.children.filter((c) => c.className === 'notice-hint').map((n) => n.textContent));
    assert.deepEqual(hints(), [], 'mutant: the refusal promising "click or press a key" - it clears on the next toggle, never on a press');
    win.input('KeyI');
    assert.deepEqual(hints(), ['click or press a key'], 'the info box really does close on any key or press, and says so');
    win.input('KeyS');
    // the card goes away with the refusal still on it: the selection cleared
    win._selected = null;
    win._renderCard();
    assert.deepEqual(enhancedNoticeKeys(), [], 'mutant: the hold below the early return, so a card that goes away leaves its panel held over the world');
    win.dispose();
  });
});

// ── EM-BUG2 (Mac, 2026-09-21: "You cannot press the M key to stow the
// map") ──────────────────────────────────────────────────────────────
test('EM-BUG2: the key that opens the sheet shuts it - the AutoMap binding as well as TravelMap, on every sheet', () => {
  const held = readFileSync(new URL('../src/ui/heldMap.js', import.meta.url), 'utf8');
  // THE WHOLE BUG IN ONE LINE. This arm was written when the sheet was
  // the WORLD map alone, so it took the TravelMap action and Escape.
  // EM3 and EM4 gave the same window three more doors - a dungeon's
  // plan, a town's, a building's - and every one of them is behind the
  // AutoMap key, so the key that opened the map could not shut it.
  assert.match(held, /const _act = actionForCode\(bindings\(\), code\);\s*\n\s*if \(code === 'Escape' \|\| _act === 'TravelMap' \|\| _act === 'AutoMap'\) \{/,
    'both map actions, and Escape, take the same door out');
  assert.doesNotMatch(held, /if \(code === 'Escape' \|\| actionForCode\(bindings\(\), code\) === 'TravelMap'\) \{/,
    'never the travel action alone again - that is the shape that shipped');
  // the action is resolved ONCE - the arm is taken on every key that
  // reaches the sheet, so this is the hot path's own lookup
  assert.equal((held.match(/const _act = actionForCode\(bindings\(\), code\);/g) || []).length, 1);
  // ...and the classic twin has always taken its own binding back, which
  // is the law this one is keeping rather than inventing
  const classic = readFileSync(new URL('../src/ui/automapWindow.js', import.meta.url), 'utf8');
  assert.match(classic, /if \(this\.automapBinding && normalizeCode\(code, e\) === this\.automapBinding\)/,
    'ui/automapWindow.js: DFU’s own window closes on the AutoMap key');
  // the binding the sheet answers to is the PLAYER's, read live off the
  // store - a rebound map key still closes the map it opened
  assert.match(held, /import \{[^}]*actionForCode[^}]*\} from/);
});

// ═══ MAP-FIT1 (2026-09-22) ══════════════════════════════════════════
// icebreyker and Hog Goblin, Discord bug-reports: "Map gets cut at the
// bottom"; Mac: "the morrowind arms dont show holding the map and it sits
// too low on the screen". The arm's sheet is placed in the ARM's space
// and the ink follows its corners wherever they project - on a screen
// that cannot frame it (a tall phone, a narrow window, a pose off the
// wrong eye) the corners land past the bottom and the sides, the ink is
// laid full-width and cut, and the hands are out of the frame. A sheet
// that does not fit the screen goes back to the painting this open.
test('MAP-FIT1: a sheet whose corners fall off the screen goes back to the painting on the spot, with the corners on the probe; one that fits stays in the hands (mutants: fit-never-judged, misfit-keeps-hands, margin-zero)', async () => {
  const { sheetFits, HANDS_FIT_MARGIN } = await import('../src/ui/heldMap.js');
  // the law on its own
  assert.ok(sheetFits(TRAPEZIUM, 1600, 900));
  assert.ok(!sheetFits([[150, 300], [650, 300], [730, 1100], [70, 1100]], 1600, 900), 'a foot a fifth under the edge');
  assert.ok(!sheetFits([[-300, 300], [1900, 300], [1900, 700], [-300, 700]], 1600, 900), 'wider than the screen');
  assert.ok(sheetFits([[-40, 300], [1640, 300], [1640, 940], [-40, 940]], 1600, 900), 'a torn edge just over the margin is a held thing');
  assert.ok(!sheetFits(null, 1600, 900));
  assert.ok(HANDS_FIT_MARGIN > 0 && HANDS_FIT_MARGIN < 0.2, 'a margin, not a licence');
  withDocument(() => {
    globalThis.innerWidth = 1600; globalThis.innerHeight = 900;
    try {
      // fits: the hands keep the sheet
      const ok = holderStub({ corners: () => TRAPEZIUM });
      const w1 = open(mkWin({ ...bayDeps(), holder: ok }));
      assert.equal(w1._lane, 'hands');
      assert.equal(JSON.parse(globalThis.__heldMap()).misfit, null);
      w1.dispose();
      // does not fit: the reports' sheet - low, wide, its foot under the edge
      const LOW = [[-120, 520], [1720, 520], [1780, 1080], [-180, 1080]];
      const bad = holderStub({ corners: () => LOW });
      const w2 = mkWin({ ...bayDeps(), holder: bad });
      w2.tick(0.05);
      assert.equal(w2._lane, 'sprite', 'the painting stands the moment the corners are read');
      assert.equal(bad.calls.filter((c) => c[0] === 'release').length, 1, 'the arm let the sheet go');
      const c = w2._chrome;
      assert.equal(c.sheet.style.display, '', 'the painting is back');
      assert.notEqual(c.stage.style.width, '100%', 'the stage is the 4:3 fit again');
      const probe = JSON.parse(globalThis.__heldMap());
      assert.equal(probe.lane, 'sprite');
      assert.deepEqual(probe.misfit, LOW, 'the corners that did not fit, for a report');
      for (let i = 0; i < 40; i++) w2.tick(0.05);
      assert.equal(w2._lane, 'sprite', 'and it is not asked again this open');
      assert.equal(bad.calls.filter((c) => c[0] === 'hold').length, 1);
      w2.dispose();
    } finally { delete globalThis.innerWidth; delete globalThis.innerHeight; }
  });
});
